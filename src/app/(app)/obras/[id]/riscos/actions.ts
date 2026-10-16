"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { carregarEvm, carregarRede } from "@/lib/analise";
import { conciliarAutomaticos, regraCusto, regraPrazo, type Sugestao } from "@/lib/risco";

type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
const refresh = (obraId: string) => {
  for (const p of ["riscos", "analise", ""]) revalidatePath(`/obras/${obraId}${p ? `/${p}` : ""}`);
};

const CATEGORIAS = ["PRAZO", "CUSTO", "QUALIDADE", "SEGURANCA", "CLIMA", "SUPRIMENTOS", "REGULATORIO", "MAO_DE_OBRA"] as const;
const SITUACOES = ["IDENTIFICADO", "EM_MITIGACAO", "MATERIALIZADO", "ENCERRADO"] as const;
const Escala = z.coerce.number().int().min(1, "De 1 a 5.").max(5, "De 1 a 5.");

/** Próximo código livre da obra (R01, R02...). */
async function proximoCodigo(obraId: string) {
  const ultimo = await prisma.risco.findFirst({
    where: { obraId }, orderBy: { codigo: "desc" }, select: { codigo: true },
  });
  const n = ultimo ? Number.parseInt(ultimo.codigo.replace(/\D/g, ""), 10) + 1 : 1;
  return "R" + String(Number.isFinite(n) ? n : 1).padStart(2, "0");
}

export async function salvarRisco(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1),
    riscoId: z.string().optional(),
    descricao: z.string().trim().min(10, "Descreva o risco em pelo menos 10 letras.").max(500),
    categoria: z.enum(CATEGORIAS),
    probabilidade: Escala,
    impacto: Escala,
    situacao: z.enum(SITUACOES).optional(),
    planoMitigacao: z.string().trim().max(1000).optional(),
    etapaId: z.string().optional(),
  }).safeParse(entrada);
  if (!p.success) {
    return { ok: false, mensagem: "Confira os campos.", erros: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  const { obraId, riscoId, etapaId, ...dados } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil) return NEGADO;
  if (!can(perfil, "risco", riscoId ? "editar" : "criar")) return NEGADO;

  // Etapa tem de ser desta obra — senão o campo vira porta para IDOR.
  let etapaValida: string | null = null;
  if (etapaId) {
    const e = await prisma.etapa.findFirst({ where: { id: etapaId, obraId }, select: { id: true } });
    if (!e) return { ok: false, mensagem: "Etapa não encontrada nesta obra." };
    etapaValida = e.id;
  }

  if (riscoId) {
    const atual = await prisma.risco.findFirst({ where: { id: riscoId, obraId }, select: { id: true, automatico: true } });
    if (!atual) return { ok: false, mensagem: "Risco não encontrado." };

    await prisma.$transaction([
      prisma.risco.update({
        where: { id: atual.id },
        // Edição à mão desliga a regra: a pessoa passa a mandar neste risco.
        data: { ...dados, etapaId: etapaValida, automatico: false },
      }),
      prisma.riscoHistorico.create({
        data: {
          riscoId: atual.id, probabilidade: dados.probabilidade, impacto: dados.impacto,
          situacao: dados.situacao ?? "IDENTIFICADO", alteradoPorId: user.id,
          nota: atual.automatico ? "Assumido manualmente (a regra automática deixa de atualizar)." : null,
        },
      }),
    ]);
    await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "EDITAR_RISCO", entidade: "Risco", entidadeId: atual.id });
    refresh(obraId);
    return { ok: true, mensagem: "Risco atualizado." };
  }

  const codigo = await proximoCodigo(obraId);
  const criado = await prisma.risco.create({
    data: {
      obraId, codigo, etapaId: etapaValida, criadoPorId: user.id,
      ...dados, situacao: dados.situacao ?? "IDENTIFICADO",
      historico: {
        create: {
          probabilidade: dados.probabilidade, impacto: dados.impacto,
          situacao: dados.situacao ?? "IDENTIFICADO", alteradoPorId: user.id, nota: "Cadastro inicial.",
        },
      },
    },
    select: { id: true, codigo: true },
  });

  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR_RISCO", entidade: "Risco", entidadeId: criado.id });
  refresh(obraId);
  return { ok: true, mensagem: `Risco ${criado.codigo} cadastrado.` };
}

export async function encerrarRisco(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), riscoId: z.string().min(1), nota: z.string().trim().max(300).optional() }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };

  const { obraId, riscoId, nota } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "risco", "editar")) return NEGADO;

  const alvo = await prisma.risco.findFirst({ where: { id: riscoId, obraId }, select: { id: true, probabilidade: true, impacto: true } });
  if (!alvo) return { ok: false, mensagem: "Risco não encontrado." };

  await prisma.$transaction([
    prisma.risco.update({ where: { id: alvo.id }, data: { situacao: "ENCERRADO", automatico: false } }),
    prisma.riscoHistorico.create({
      data: {
        riscoId: alvo.id, probabilidade: alvo.probabilidade, impacto: alvo.impacto,
        situacao: "ENCERRADO", alteradoPorId: user.id, nota: nota || "Encerrado.",
      },
    }),
  ]);
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "ENCERRAR_RISCO", entidade: "Risco", entidadeId: alvo.id });
  refresh(obraId);
  return { ok: true, mensagem: "Risco encerrado." };
}

/**
 * Roda as regras automáticas e concilia com o que já existe.
 *
 * Risco que alguém editou à mão não é tocado — a regra sugere, a pessoa
 * decide. Regra que parou de disparar encerra o risco que ela mesma abriu.
 */
export async function recalcularAutomaticos(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };

  const { obraId } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "risco", "criar")) return NEGADO;

  const [evm, rede, existentes] = await Promise.all([
    carregarEvm(prisma, obraId),
    carregarRede(prisma, obraId),
    prisma.risco.findMany({ where: { obraId }, select: { id: true, codigo: true, origemRegra: true, automatico: true } }),
  ]);

  const sugestoes = [regraCusto(evm.indicadores.cpi), regraPrazo(rede.criticasAtrasadas)]
    .filter((s): s is Sugestao => s !== null);

  const plano = conciliarAutomaticos(sugestoes, existentes);
  const porCodigo = new Map(existentes.map((e) => [e.codigo, e.id]));

  let codigo = await proximoCodigo(obraId);
  const operacoes = [];

  for (const s of plano.criar) {
    operacoes.push(prisma.risco.create({
      data: {
        obraId, codigo, criadoPorId: user.id, descricao: s.descricao, categoria: s.categoria,
        probabilidade: s.probabilidade, impacto: s.impacto,
        automatico: true, origemRegra: s.codigoRegra,
        historico: { create: { probabilidade: s.probabilidade, impacto: s.impacto, situacao: "IDENTIFICADO", nota: "Aberto por regra automática." } },
      },
    }));
    codigo = "R" + String(Number.parseInt(codigo.slice(1), 10) + 1).padStart(2, "0");
  }
  for (const a of plano.atualizar) {
    const id = porCodigo.get(a.codigo);
    if (!id) continue;
    operacoes.push(prisma.risco.update({
      where: { id },
      data: { descricao: a.sugestao.descricao, probabilidade: a.sugestao.probabilidade, impacto: a.sugestao.impacto },
    }));
    operacoes.push(prisma.riscoHistorico.create({
      data: { riscoId: id, probabilidade: a.sugestao.probabilidade, impacto: a.sugestao.impacto, situacao: "IDENTIFICADO", nota: "Atualizado por regra automática." },
    }));
  }
  for (const c of plano.encerrar) {
    const id = porCodigo.get(c);
    if (!id) continue;
    operacoes.push(prisma.risco.update({ where: { id }, data: { situacao: "ENCERRADO" } }));
  }

  if (operacoes.length) await prisma.$transaction(operacoes);
  refresh(obraId);

  const partes = [
    plano.criar.length && `${plano.criar.length} aberto(s)`,
    plano.atualizar.length && `${plano.atualizar.length} atualizado(s)`,
    plano.encerrar.length && `${plano.encerrar.length} encerrado(s)`,
  ].filter(Boolean);

  return {
    ok: true,
    mensagem: partes.length ? `Riscos automáticos: ${partes.join(", ")}.` : "Nenhuma regra disparou agora.",
  };
}
