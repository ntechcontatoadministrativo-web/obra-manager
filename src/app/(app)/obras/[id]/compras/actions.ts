"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { numeroOrdem, statusAoAprovar, transicaoValida, type CompraStatus } from "@/lib/compras";
import { dataISOValida, dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { somarDias } from "@/lib/diario";

type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };
type U = Awaited<ReturnType<typeof requireUser>>;

async function perfilOuNull(user: U, obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
const refresh = (obraId: string) => {
  for (const p of [`/obras/${obraId}/compras`, `/obras/${obraId}`, "/pagamentos", "/dashboard"]) revalidatePath(p);
};
const errosDe = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));

/** Solicitação desta obra (o id vem do navegador: sempre conferir a obra). */
async function solicitacao(obraId: string, id: string) {
  return prisma.solicitacaoCompra.findFirst({
    where: { id, obraId },
    select: { id: true, status: true, valorEstimado: true, obra: { select: { empresaId: true } }, ordem: { select: { id: true, numero: true, valorTotal: true, prazoPagamentoDias: true, fornecedorId: true } } },
  });
}

async function mudarStatus(user: U, obraId: string, id: string, de: CompraStatus, para: CompraStatus, extra: Record<string, unknown> = {}) {
  if (!transicaoValida(de, para)) return false;
  // updateMany com o status antigo no filtro: dois cliques simultâneos não aprovam duas vezes.
  const r = await prisma.solicitacaoCompra.updateMany({ where: { id, obraId, status: de }, data: { status: para, ...extra } });
  if (r.count === 0) return false;
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: `COMPRA_${para}`, entidade: "SolicitacaoCompra", entidadeId: id, antes: { status: de }, depois: { status: para } });
  return true;
}

const Item = z.object({
  nome: z.string().trim().min(2, "Nome do material.").max(120),
  unidade: z.string().trim().min(1, "Unidade.").max(20),
  quantidade: z.coerce.number().positive("Quantidade."),
  preco: z.coerce.number().nonnegative().optional(),
});

export async function criarSolicitacao(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1),
    etapaId: z.string().optional(),
    urgencia: z.enum(["URGENTE", "NORMAL", "PLANEJADA"]),
    justificativa: z.string().trim().min(5, "Para que é a compra?").max(500),
    itens: z.array(Item).min(1, "Inclua pelo menos um item.").max(40),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Confira os campos.", erros: errosDe(p.error) };

  const { obraId, etapaId, itens, ...dados } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "compra", "criar")) return NEGADO;

  let etapa: string | null = null;
  if (etapaId) {
    const e = await prisma.etapa.findFirst({ where: { id: etapaId, obraId }, select: { id: true } });
    if (!e) return { ok: false, mensagem: "Etapa não encontrada nesta obra." };
    etapa = e.id;
  }

  // Material novo entra no catálogo da empresa; o mesmo nome reaproveita o cadastro (e o histórico de preço).
  const insumos: { id: string }[] = [];
  for (const i of itens) {
    insumos.push(await prisma.insumo.upsert({
      where: { empresaId_nome: { empresaId: user.empresaId, nome: i.nome } },
      update: {},
      create: { empresaId: user.empresaId, nome: i.nome, unidade: i.unidade, categoria: "Geral" },
      select: { id: true },
    }));
  }
  const valorEstimado = itens.reduce((s, i) => s + i.quantidade * (i.preco ?? 0), 0);

  const criada = await prisma.solicitacaoCompra.create({
    data: {
      obraId, etapaId: etapa, solicitanteId: user.id, ...dados, valorEstimado,
      itens: { create: itens.map((i, n) => ({ insumoId: insumos[n].id, quantidade: i.quantidade, precoUnitEstimado: i.preco ?? null })) },
    },
    select: { id: true },
  });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR_COMPRA", entidade: "SolicitacaoCompra", entidadeId: criada.id, depois: { valorEstimado, itens: itens.length } });
  refresh(obraId);
  return { ok: true, mensagem: "Solicitação enviada para aprovação." };
}

export async function aprovarSolicitacao(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), id: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const { obraId, id } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "compra", "aprovar")) return NEGADO;

  const s = await solicitacao(obraId, id);
  if (!s) return { ok: false, mensagem: "Solicitação não encontrada." };
  const cfg = await prisma.configuracao.findUnique({ where: { empresaId: s.obra.empresaId }, select: { limiteAprovacaoCompra: true } });
  const limite = Number(cfg?.limiteAprovacaoCompra ?? 5000);
  const para = statusAoAprovar(perfil, s.status, Number(s.valorEstimado), limite);
  if (!para) return { ok: false, mensagem: s.status === "AGUARDANDO_SUPER_ADMIN" ? "Acima do limite: só o dono aprova." : "Esta solicitação não está aguardando a sua aprovação." };

  const quem = perfil === "ADMIN_OBRA" ? { aprovadoAdminObraPorId: user.id } : { aprovadoSuperAdminPorId: user.id };
  if (!(await mudarStatus(user, obraId, id, s.status, para, quem))) return { ok: false, mensagem: "A solicitação mudou enquanto você olhava. Recarregue a página." };
  refresh(obraId);
  return { ok: true, mensagem: para === "AGUARDANDO_SUPER_ADMIN" ? "Aprovada por você. Como passa do limite, segue para o dono." : "Compra aprovada. Já pode emitir a ordem de compra." };
}

export async function reprovarSolicitacao(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), id: z.string().min(1), motivo: z.string().trim().min(3, "Diga o motivo.").max(300) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Confira os campos.", erros: errosDe(p.error) };
  const { obraId, id, motivo } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "compra", "aprovar")) return NEGADO;

  const s = await solicitacao(obraId, id);
  if (!s) return { ok: false, mensagem: "Solicitação não encontrada." };
  // Quem pode aprovar nesta fase é quem pode reprovar.
  if (!statusAoAprovar(perfil, s.status, Number(s.valorEstimado), Infinity)) return NEGADO;
  if (!(await mudarStatus(user, obraId, id, s.status, "REPROVADA", { motivoReprovacao: motivo }))) return { ok: false, mensagem: "Não foi possível reprovar agora." };
  refresh(obraId);
  return { ok: true, mensagem: "Solicitação reprovada." };
}

/** Emitir e enviar a ordem é trabalho de quem compra (Comprador, engenheiro, dono): pede "editar", não "aprovar". */
export async function emitirOrdem(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1),
    id: z.string().min(1),
    fornecedorId: z.string().optional(),
    novoFornecedor: z.object({
      nome: z.string().trim().min(2, "Nome do fornecedor.").max(120),
      cnpj: z.string().trim().max(20).optional(),
      telefone: z.string().trim().max(30).optional(),
      pixChave: z.string().trim().max(140).optional(),
    }).optional(),
    valorTotal: z.coerce.number().positive("Valor fechado com o fornecedor.").max(1e11),
    prazoPagamentoDias: z.coerce.number().int().min(0).max(365),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Confira os campos.", erros: errosDe(p.error) };
  const d = p.data;
  const perfil = await perfilOuNull(user, d.obraId);
  if (!perfil || !can(perfil, "compra", "editar")) return NEGADO;

  const s = await solicitacao(d.obraId, d.id);
  if (!s) return { ok: false, mensagem: "Solicitação não encontrada." };
  if (s.status !== "APROVADA" || s.ordem) return { ok: false, mensagem: "Só compra aprovada e sem ordem pode receber ordem de compra." };

  let fornecedorId = d.fornecedorId ?? null;
  if (fornecedorId) {
    const f = await prisma.fornecedor.findFirst({ where: { id: fornecedorId, empresaId: user.empresaId }, select: { id: true } });
    if (!f) return { ok: false, mensagem: "Fornecedor não encontrado." };
  } else if (d.novoFornecedor) {
    if (!can(perfil, "fornecedor", "criar")) return NEGADO;
    const f = await prisma.fornecedor.create({
      data: { empresaId: user.empresaId, nome: d.novoFornecedor.nome, cnpj: d.novoFornecedor.cnpj || null, telefone: d.novoFornecedor.telefone || null, pixChave: d.novoFornecedor.pixChave || null },
      select: { id: true },
    }).catch(() => null);
    if (!f) return { ok: false, mensagem: "Já existe um fornecedor com este CNPJ. Escolha-o na lista." };
    fornecedorId = f.id;
  } else {
    return { ok: false, mensagem: "Confira os campos.", erros: { fornecedorId: "Escolha ou cadastre o fornecedor." } };
  }

  const ano = Number(dataLocalISO().slice(0, 4));
  const ordem = await prisma.$transaction(async (tx) => {
    const ultimo = await tx.ordemCompra.findFirst({ where: { numero: { startsWith: `OC-${ano}-` } }, orderBy: { numero: "desc" }, select: { numero: true } });
    const seq = ultimo ? Number(ultimo.numero.slice(-4)) + 1 : 1;
    const o = await tx.ordemCompra.create({
      data: { solicitacaoId: s.id, fornecedorId: fornecedorId!, numero: numeroOrdem(ano, seq), valorTotal: d.valorTotal, prazoPagamentoDias: d.prazoPagamentoDias, emitidaPorId: user.id },
      select: { id: true, numero: true },
    });
    await tx.solicitacaoCompra.update({ where: { id: s.id }, data: { status: "PO_EMITIDA" } });
    // O preço fechado alimenta o histórico do material: é dele que sai o alerta de preço fora da média.
    const itens = await tx.solicitacaoItem.findMany({ where: { solicitacaoId: s.id, precoUnitEstimado: { not: null } }, select: { insumoId: true, precoUnitEstimado: true } });
    if (itens.length) await tx.precoHistorico.createMany({ data: itens.map((i) => ({ insumoId: i.insumoId, fornecedorId: fornecedorId!, preco: i.precoUnitEstimado! })) });
    return o;
  });

  await registrarAuditoria(prisma, { userId: user.id, obraId: d.obraId, acao: "EMITIR_ORDEM_COMPRA", entidade: "OrdemCompra", entidadeId: ordem.id, depois: { numero: ordem.numero, valorTotal: d.valorTotal } });
  refresh(d.obraId);
  return { ok: true, mensagem: `Ordem ${ordem.numero} emitida.` };
}

export async function marcarEnviada(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), id: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const perfil = await perfilOuNull(user, p.data.obraId);
  if (!perfil || !can(perfil, "compra", "editar")) return NEGADO;
  const s = await solicitacao(p.data.obraId, p.data.id);
  if (!s?.ordem) return { ok: false, mensagem: "Solicitação sem ordem de compra." };
  if (!(await mudarStatus(user, p.data.obraId, s.id, s.status, "ENVIADA_FORNECEDOR"))) return { ok: false, mensagem: "Não foi possível mudar agora." };
  await prisma.ordemCompra.update({ where: { id: s.ordem.id }, data: { enviadaEm: new Date() } });
  refresh(p.data.obraId);
  return { ok: true, mensagem: `Ordem ${s.ordem.numero} marcada como enviada ao fornecedor.` };
}

/**
 * Entrega confirmada = a conta nasce: uma Despesa ligada à ordem, com o
 * PIX do fornecedor e vencimento pelo prazo combinado. A partir daí ela
 * aparece em Pagamentos e no custo real da obra.
 */
export async function confirmarEntrega(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), id: z.string().min(1), data: z.string().refine(dataISOValida, "Data inválida.").optional() }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const { obraId } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  // Quem está no canteiro recebe o material: o encarregado também confirma.
  if (!perfil || !(can(perfil, "compra", "aprovar") || can(perfil, "compra", "criar"))) return NEGADO;

  const s = await prisma.solicitacaoCompra.findFirst({
    where: { id: p.data.id, obraId },
    select: {
      id: true, status: true, etapaId: true, justificativa: true,
      itens: { select: { quantidade: true, insumo: { select: { nome: true, unidade: true } } } },
      ordem: { select: { id: true, numero: true, valorTotal: true, prazoPagamentoDias: true, fornecedor: { select: { id: true, nome: true, pixChave: true } } } },
    },
  });
  if (!s?.ordem) return { ok: false, mensagem: "Solicitação sem ordem de compra." };
  if (s.status !== "ENVIADA_FORNECEDOR" && s.status !== "PO_EMITIDA") return { ok: false, mensagem: "Esta compra não está aguardando entrega." };

  const entrega = p.data.data ?? dataLocalISO();
  const resumo = s.itens.map((i) => `${Number(i.quantidade).toLocaleString("pt-BR")} ${i.insumo.unidade} ${i.insumo.nome}`).join(", ");
  const ordem = s.ordem;
  // PO_EMITIDA → ENTREGUE passa por ENVIADA_FORNECEDOR: material que chegou foi enviado.
  const caminho: CompraStatus[] = s.status === "PO_EMITIDA" ? ["ENVIADA_FORNECEDOR", "ENTREGUE"] : ["ENTREGUE"];

  const feito = await prisma.$transaction(async (tx) => {
    let de: CompraStatus = s.status;
    for (const para of caminho) {
      const r = await tx.solicitacaoCompra.updateMany({ where: { id: s.id, status: de }, data: { status: para } });
      if (r.count === 0) return false;
      de = para;
    }
    await tx.ordemCompra.update({ where: { id: ordem.id }, data: { entregueEm: dataParaBanco(entrega), enviadaEm: s.status === "PO_EMITIDA" ? new Date() : undefined } });
    await tx.despesa.create({
      data: {
        obraId, etapaId: s.etapaId, ordemCompraId: ordem.id, tipo: "MATERIAL",
        descricao: `${ordem.numero}: ${resumo}`.slice(0, 200), valor: ordem.valorTotal,
        formaPagamento: ordem.prazoPagamentoDias > 0 ? "A_PRAZO" : "A_VISTA",
        competencia: dataParaBanco(entrega), vencimento: dataParaBanco(somarDias(entrega, ordem.prazoPagamentoDias)),
        favorecido: ordem.fornecedor.nome, fornecedorId: ordem.fornecedor.id, pixChave: ordem.fornecedor.pixChave,
        origem: "COMPRA", criadoPorId: user.id,
      },
    });
    return true;
  });
  if (!feito) return { ok: false, mensagem: "A compra mudou enquanto você olhava. Recarregue a página." };

  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "COMPRA_ENTREGUE", entidade: "OrdemCompra", entidadeId: ordem.id, depois: { entrega, valor: Number(ordem.valorTotal) } });
  refresh(obraId);
  return { ok: true, mensagem: `Entrega registrada. A conta de ${ordem.fornecedor.nome} entrou em Pagamentos, vencendo em ${ordem.prazoPagamentoDias} dia(s).` };
}

export async function cancelarSolicitacao(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), id: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const { obraId, id } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil) return NEGADO;

  const s = await prisma.solicitacaoCompra.findFirst({ where: { id, obraId }, select: { id: true, status: true, solicitanteId: true } });
  if (!s) return { ok: false, mensagem: "Solicitação não encontrada." };
  // Quem pediu cancela enquanto ninguém aprovou; depois disso, só quem aprova.
  const propria = s.solicitanteId === user.id && s.status === "AGUARDANDO_ADMIN_OBRA";
  if (!propria && !can(perfil, "compra", "aprovar")) return NEGADO;
  if (!(await mudarStatus(user, obraId, id, s.status, "CANCELADA"))) return { ok: false, mensagem: "Esta compra não pode mais ser cancelada." };
  refresh(obraId);
  return { ok: true, mensagem: "Solicitação cancelada." };
}
