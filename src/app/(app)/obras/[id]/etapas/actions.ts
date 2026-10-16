"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { altura, estaDentroDe, etapasPadrao, ehFolha, profundidade, PROFUNDIDADE_MAX, rolarParaCima, type EtapaNo, type EtapaStatus } from "@/lib/etapas";
import { dataISOValida, dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { parseNumeroBR } from "@/lib/utils";
import { criariaCiclo, type Dependencia } from "@/lib/cronograma";
import { carregarRede } from "@/lib/analise";

type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
const refresh = (obraId: string) => { for (const p of ["etapas", "medicoes", ""]) revalidatePath(`/obras/${obraId}${p ? `/${p}` : ""}`); revalidatePath("/dashboard"); revalidatePath("/obras"); };

async function carregar(obraId: string): Promise<EtapaNo[]> {
  const rows = await prisma.etapa.findMany({ where: { obraId } });
  return rows.map((r) => ({
    id: r.id, paiId: r.paiId, nome: r.nome, ordem: r.ordem, inicioPrevisto: r.inicioPrevisto, fimPrevisto: r.fimPrevisto,
    inicioReal: r.inicioReal, fimReal: r.fimReal, percentual: Number(r.percentual), valorOrcado: Number(r.valorOrcado), status: r.status as EtapaStatus,
  }));
}

/** Depois de qualquer mudança: recalcula as etapas-pai (orçamento, %, datas) a partir das filhas. */
async function recalcular(obraId: string) {
  const etapas = await carregar(obraId);
  const ag = rolarParaCima(etapas);
  const ups = [...ag.entries()].map(([id, a]) =>
    prisma.etapa.update({ where: { id }, data: { percentual: a.percentual, valorOrcado: a.valorOrcado, inicioPrevisto: a.inicioPrevisto, fimPrevisto: a.fimPrevisto, inicioReal: a.inicioReal, fimReal: a.fimReal } }));
  if (ups.length) await prisma.$transaction(ups);
}

const Data = z.string().refine(dataISOValida, "Informe uma data válida.").transform(dataParaBanco);
const Valor = z.string().transform((s) => (s.trim() === "" ? 0 : parseNumeroBR(s))).refine((n) => !Number.isNaN(n) && n >= 0 && n <= 1e12, "Valor inválido.");
const QtdOpc = z.string().transform((s) => (s.trim() === "" ? null : parseNumeroBR(s))).refine((n) => n === null || (!Number.isNaN(n) && n >= 0), "Quantidade inválida.");
const EtapaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da etapa.").max(100),
  paiId: z.string().optional().transform((s) => s || null),
  inicioPrevisto: Data, fimPrevisto: Data,
  valorOrcado: Valor, criterioMedicao: z.string().trim().max(20).optional().transform((s) => s || null),
  quantidadePrevista: QtdOpc,
  responsavelId: z.string().optional().transform((s) => s || null),
  paralisada: z.string().optional().transform((s) => s === "sim"),
}).refine((e) => e.fimPrevisto >= e.inicioPrevisto, { path: ["fimPrevisto"], message: "O fim não pode ser antes do início." });

function erros(e: z.ZodError) { const o: Record<string, string> = {}; for (const i of e.issues) o[String(i.path[0])] ??= i.message; return o; }

async function validarRelacoes(obraId: string, etapas: EtapaNo[], paiId: string | null, responsavelId: string | null, selfId?: string): Promise<Record<string, string> | null> {
  if (paiId) {
    const pai = etapas.find((x) => x.id === paiId);
    if (!pai) return { paiId: "Etapa-pai não encontrada nesta obra." };
    if (selfId && estaDentroDe(etapas, paiId, selfId)) return { paiId: "Uma etapa não pode ficar dentro dela mesma ou de uma sub-etapa dela." };
    const alturaSub = selfId ? altura(etapas, selfId) : 1;
    if (profundidade(etapas, paiId) + alturaSub > PROFUNDIDADE_MAX) return { paiId: `No máximo ${PROFUNDIDADE_MAX} níveis (etapa, sub-etapa e sub-sub-etapa).` };
  }
  if (responsavelId) {
    const m = await prisma.obraMembro.count({ where: { obraId, userId: responsavelId } });
    if (!m) return { responsavelId: "O responsável precisa ser da equipe da obra." };
  }
  return null;
}

export async function criarEtapa(obraId: string, entrada: Record<string, string>): Promise<Res> {
  const user = await requireUser();
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "criar")) return NEGADO;
  const p = EtapaSchema.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Corrija os campos destacados.", erros: erros(p.error) };
  const etapas = await carregar(obraId);
  const rel = await validarRelacoes(obraId, etapas, p.data.paiId, p.data.responsavelId);
  if (rel) return { ok: false, mensagem: "Corrija os campos destacados.", erros: rel };

  const irmas = etapas.filter((x) => x.paiId === p.data.paiId).length;
  const { paralisada, ...dados } = p.data;
  const nova = await prisma.etapa.create({ data: { ...dados, obraId, ordem: irmas + 1, status: paralisada ? "PARALISADA" : "NAO_INICIADA" } });
  await recalcular(obraId);
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR", entidade: "Etapa", entidadeId: nova.id, depois: { nome: nova.nome, paiId: nova.paiId } });
  refresh(obraId);
  return { ok: true, mensagem: "Etapa criada." };
}

export async function editarEtapa(obraId: string, etapaId: string, entrada: Record<string, string>): Promise<Res> {
  const user = await requireUser();
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "criar")) return NEGADO;
  const p = EtapaSchema.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Corrija os campos destacados.", erros: erros(p.error) };
  const etapas = await carregar(obraId);
  const atual = etapas.find((x) => x.id === etapaId);
  if (!atual) return { ok: false, mensagem: "Etapa não encontrada." };
  const rel = await validarRelacoes(obraId, etapas, p.data.paiId, p.data.responsavelId, etapaId);
  if (rel) return { ok: false, mensagem: "Corrija os campos destacados.", erros: rel };

  const folha = ehFolha(etapas, etapaId);
  const { paralisada, ...d } = p.data;
  // Etapa-pai: orçamento e datas vêm das filhas (o recálculo abaixo reescreve); só nome, pai, responsável e critério valem.
  await prisma.etapa.update({
    where: { id: etapaId },
    data: {
      nome: d.nome, paiId: d.paiId, responsavelId: d.responsavelId, criterioMedicao: d.criterioMedicao, quantidadePrevista: d.quantidadePrevista,
      ...(folha ? { inicioPrevisto: d.inicioPrevisto, fimPrevisto: d.fimPrevisto, valorOrcado: d.valorOrcado, status: paralisada ? "PARALISADA" : atual.percentual >= 100 ? "CONCLUIDA" : atual.percentual > 0 ? "EM_ANDAMENTO" : "NAO_INICIADA" } : {}),
    },
  });
  await recalcular(obraId);
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "EDITAR", entidade: "Etapa", entidadeId: etapaId, antes: { nome: atual.nome, valorOrcado: atual.valorOrcado, paiId: atual.paiId }, depois: { nome: d.nome, valorOrcado: folha ? d.valorOrcado : "calculado", paiId: d.paiId } });
  refresh(obraId);
  return { ok: true, mensagem: "Etapa salva." };
}

/** O encarregado informa o andamento: só folhas, 0 a 100. */
export async function atualizarPercentual(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), etapaId: z.string().min(1), percentual: z.number().min(0).max(100) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Informe um número de 0 a 100." };
  const { obraId, etapaId, percentual } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "editar")) return NEGADO;
  const etapas = await carregar(obraId);
  const e = etapas.find((x) => x.id === etapaId);
  if (!e) return { ok: false, mensagem: "Etapa não encontrada." };
  if (!ehFolha(etapas, etapaId)) return { ok: false, mensagem: "Esta etapa tem sub-etapas: o andamento dela é a soma das sub-etapas." };

  const hoje = dataParaBanco(dataLocalISO());
  const pct = Math.round(percentual * 100) / 100;
  await prisma.etapa.update({
    where: { id: etapaId },
    data: {
      percentual: pct,
      inicioReal: pct > 0 ? e.inicioReal ?? hoje : null,
      fimReal: pct >= 100 ? e.fimReal ?? hoje : null,
      status: pct >= 100 ? "CONCLUIDA" : e.status === "PARALISADA" ? "PARALISADA" : pct > 0 ? "EM_ANDAMENTO" : "NAO_INICIADA",
    },
  });
  await recalcular(obraId);
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "ATUALIZAR_ANDAMENTO", entidade: "Etapa", entidadeId: etapaId, antes: { percentual: e.percentual }, depois: { percentual: pct } });
  refresh(obraId);
  return { ok: true, mensagem: `${e.nome}: ${pct.toString().replace(".", ",")}% concluída.` };
}

export async function excluirEtapa(obraId: string, etapaId: string): Promise<Res> {
  const user = await requireUser();
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "excluir")) return NEGADO;
  const etapas = await carregar(obraId);
  const e = etapas.find((x) => x.id === etapaId);
  if (!e) return { ok: false, mensagem: "Etapa não encontrada." };
  if (!ehFolha(etapas, etapaId)) return { ok: false, mensagem: "Apague ou mova antes as sub-etapas desta etapa." };
  const [diario, medicao, despesas, compras, fotos] = await Promise.all([
    prisma.diarioAtividade.count({ where: { etapaId } }), prisma.medicaoItem.count({ where: { etapaId } }),
    prisma.despesa.count({ where: { etapaId } }), prisma.solicitacaoCompra.count({ where: { etapaId } }), prisma.foto.count({ where: { etapaId } }),
  ]);
  if (diario + medicao + despesas + compras + fotos > 0)
    return { ok: false, mensagem: "Esta etapa já tem diário, medição, despesa, compra ou foto ligados a ela, então não pode ser apagada. Marque-a como paralisada, se for o caso." };
  await prisma.etapa.delete({ where: { id: etapaId } });
  await recalcular(obraId);
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "EXCLUIR", entidade: "Etapa", entidadeId: etapaId, antes: { nome: e.nome } });
  refresh(obraId);
  return { ok: true, mensagem: "Etapa apagada." };
}

/** Atalho para quem está começando: cria o conjunto típico de etapas, dividido pelo prazo da obra. */
export async function criarEtapasPadrao(obraId: string): Promise<Res> {
  const user = await requireUser();
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "criar")) return NEGADO;
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { dataInicio: true, previsaoTermino: true, _count: { select: { etapas: true } } } });
  if (!obra) return NEGADO;
  if (obra._count.etapas > 0) return { ok: false, mensagem: "A obra já tem etapas." };
  const modelo = etapasPadrao(obra.dataInicio, obra.previsaoTermino);
  await prisma.etapa.createMany({ data: modelo.map((m) => ({ ...m, obraId })) });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR", entidade: "Etapa", entidadeId: "modelo-padrao", depois: { quantidade: modelo.length } });
  refresh(obraId);
  return { ok: true, mensagem: `${modelo.length} etapas criadas. Agora preencha o valor orçado de cada uma.` };
}

// -------------------------- DEPENDÊNCIAS DA REDE ---------------------

const TIPOS_DEP = ["TI", "II", "TT", "IT"] as const;

/**
 * Liga duas etapas. Recusa antes de gravar quando a ligação fecharia um
 * ciclo — é mais barato explicar na tela do que deixar a rede inteira
 * parar de calcular depois.
 */
export async function criarDependencia(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1),
    predecessoraId: z.string().min(1),
    sucessoraId: z.string().min(1),
    tipo: z.enum(TIPOS_DEP).default("TI"),
    folgaDias: z.coerce.number().int().min(-365).max(365).default(0),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Confira os campos da ligação." };

  const { obraId, predecessoraId, sucessoraId, tipo, folgaDias } = p.data;
  if (predecessoraId === sucessoraId) return { ok: false, mensagem: "Uma etapa não depende dela mesma." };

  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "editar")) return NEGADO;

  // As duas etapas têm de ser desta obra — senão vira porta para IDOR.
  const etapas = await prisma.etapa.findMany({
    where: { obraId, id: { in: [predecessoraId, sucessoraId] } },
    select: { id: true, nome: true },
  });
  if (etapas.length !== 2) return { ok: false, mensagem: "Etapa não encontrada nesta obra." };

  const existentes = await prisma.etapaDependencia.findMany({
    where: { predecessora: { obraId } },
    select: { predecessoraId: true, sucessoraId: true, tipo: true, folgaDias: true },
  });
  if (criariaCiclo(predecessoraId, sucessoraId, existentes as Dependencia[])) {
    return { ok: false, mensagem: "Essa ligação fecharia um ciclo: a segunda etapa já vem antes da primeira." };
  }

  const jaExiste = existentes.some((d) => d.predecessoraId === predecessoraId && d.sucessoraId === sucessoraId);
  if (jaExiste) return { ok: false, mensagem: "Essas duas etapas já estão ligadas." };

  const criada = await prisma.etapaDependencia.create({
    data: { predecessoraId, sucessoraId, tipo, folgaDias },
    select: { id: true },
  });

  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "CRIAR_DEPENDENCIA", entidade: "EtapaDependencia", entidadeId: criada.id,
  });
  await marcarCriticas(obraId);
  refresh(obraId);
  return { ok: true, mensagem: "Ligação criada." };
}

export async function removerDependencia(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), dependenciaId: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };

  const { obraId, dependenciaId } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "editar")) return NEGADO;

  const alvo = await prisma.etapaDependencia.findFirst({
    where: { id: dependenciaId, predecessora: { obraId } },
    select: { id: true },
  });
  if (!alvo) return { ok: false, mensagem: "Ligação não encontrada." };

  await prisma.etapaDependencia.delete({ where: { id: alvo.id } });
  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "REMOVER_DEPENDENCIA", entidade: "EtapaDependencia", entidadeId: alvo.id,
  });
  await marcarCriticas(obraId);
  refresh(obraId);
  return { ok: true, mensagem: "Ligação removida." };
}

/**
 * Recalcula a rede e grava, em cada etapa, se ela é crítica e qual a
 * folga. Guardar o resultado permite ao painel e ao dashboard filtrarem
 * por etapa crítica sem recalcular a rede inteira a cada consulta.
 */
export async function marcarCriticas(obraId: string) {
  const rede = await carregarRede(prisma, obraId);
  if (rede.ciclo.length) return; // com ciclo não há folga a gravar
  const ups = rede.nos.map((n) =>
    prisma.etapa.update({
      where: { id: n.id },
      data: { ehCritica: n.ehCritica, folgaTotalDias: n.folgaTotalDias },
    }));
  if (ups.length) await prisma.$transaction(ups);
}
