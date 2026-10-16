"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { fecharSemana } from "@/lib/analise";
import { segundaDaSemana } from "@/lib/evm";
import { dataISOValida, dataLocalISO, dataParaBanco } from "@/lib/ponto";

type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
const refresh = (obraId: string) => {
  for (const p of ["analise", "etapas", ""]) revalidatePath(`/obras/${obraId}${p ? `/${p}` : ""}`);
  revalidatePath("/dashboard");
};

const Obra = z.object({ obraId: z.string().min(1) });

/**
 * Congela o cronograma atual como nova baseline e a ativa.
 *
 * A anterior fica guardada: o histórico de revisões é o que sustenta a
 * conversa "o prazo mudou no aditivo de março, não agora".
 */
export async function criarBaseline(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Obra.extend({
    nome: z.string().trim().min(3, "Dê um nome à revisão.").max(80),
    observacao: z.string().trim().max(500).optional(),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Confira os campos.", erros: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };

  const { obraId, nome, observacao } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "analise", "criar")) return NEGADO;

  const etapas = await prisma.etapa.findMany({
    where: { obraId },
    select: { id: true, paiId: true, inicioPrevisto: true, fimPrevisto: true, valorOrcado: true },
  });
  const comFilha = new Set(etapas.map((e) => e.paiId).filter(Boolean) as string[]);
  const folhas = etapas.filter((e) => !comFilha.has(e.id));
  if (!folhas.length) return { ok: false, mensagem: "Cadastre as etapas antes de congelar uma baseline." };

  const ultima = await prisma.cronogramaBaseline.findFirst({
    where: { obraId }, orderBy: { numero: "desc" }, select: { numero: true },
  });

  const criada = await prisma.$transaction(async (tx) => {
    await tx.cronogramaBaseline.updateMany({ where: { obraId, ativa: true }, data: { ativa: false } });
    return tx.cronogramaBaseline.create({
      data: {
        obraId, numero: (ultima?.numero ?? 0) + 1, nome, observacao: observacao || null,
        ativa: true, criadoPorId: user.id,
        itens: {
          create: folhas.map((f) => ({
            etapaId: f.id, inicioPrevisto: f.inicioPrevisto, fimPrevisto: f.fimPrevisto, valorOrcado: f.valorOrcado,
          })),
        },
      },
      select: { id: true, numero: true },
    });
  });

  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "CRIAR_BASELINE", entidade: "CronogramaBaseline", entidadeId: criada.id,
  });
  refresh(obraId);
  return { ok: true, mensagem: `Baseline ${criada.numero} congelada com ${folhas.length} etapas.` };
}

/** Troca qual baseline é a régua. Não apaga nenhuma. */
export async function ativarBaseline(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Obra.extend({ baselineId: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };

  const { obraId, baselineId } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "analise", "editar")) return NEGADO;

  // Confere que a baseline é desta obra — senão vira porta para IDOR.
  const alvo = await prisma.cronogramaBaseline.findFirst({
    where: { id: baselineId, obraId }, select: { id: true, numero: true },
  });
  if (!alvo) return { ok: false, mensagem: "Baseline não encontrada nesta obra." };

  await prisma.$transaction([
    prisma.cronogramaBaseline.updateMany({ where: { obraId, ativa: true }, data: { ativa: false } }),
    prisma.cronogramaBaseline.update({ where: { id: alvo.id }, data: { ativa: true } }),
  ]);

  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "ATIVAR_BASELINE", entidade: "CronogramaBaseline", entidadeId: alvo.id,
  });
  refresh(obraId);
  return { ok: true, mensagem: `Baseline ${alvo.numero} agora é a régua da obra.` };
}

/**
 * Grava o fechamento de uma semana. Refazer a mesma semana sobrescreve —
 * é comum lançar despesa atrasada e precisar refechar.
 */
export async function fecharSemanaAction(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Obra.extend({
    data: z.string().refine(dataISOValida, "Informe uma data válida.").optional(),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };

  const { obraId } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "analise", "criar")) return NEGADO;

  const alvo = dataParaBanco(p.data.data ?? dataLocalISO());
  const segunda = segundaDaSemana(alvo);

  // Semana que ainda não começou não tem o que fechar.
  if (segunda.getTime() > Date.now()) return { ok: false, mensagem: "Essa semana ainda não começou." };

  const registro = await fecharSemana(prisma, obraId, segunda);

  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "FECHAR_SEMANA", entidade: "IndicadorSemanal", entidadeId: registro.id,
  });
  refresh(obraId);

  const rotulo = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(segunda);
  return { ok: true, mensagem: `Semana de ${rotulo} fechada.` };
}
