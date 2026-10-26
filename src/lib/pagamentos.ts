import type { PrismaClient } from "@prisma/client";
import { acessaTodasAsObras, can, type Role } from "./auth/permissions";
import { gerarPix } from "./pix";

/**
 * Contas a pagar. Cada conta é uma Despesa: entra no custo real da obra
 * pela competência (análise de valor agregado) e fica "em aberto" até ter
 * data de pagamento.
 */

export type Situacao = "paga" | "vencida" | "vence_hoje" | "a_vencer" | "sem_vencimento";

export const ROTULO_SITUACAO: Record<Situacao, { rotulo: string; tom: "ok" | "perigo" | "alerta" | "neutro" | "info" }> = {
  paga: { rotulo: "Paga", tom: "ok" },
  vencida: { rotulo: "Vencida", tom: "perigo" },
  vence_hoje: { rotulo: "Vence hoje", tom: "alerta" },
  a_vencer: { rotulo: "A vencer", tom: "info" },
  sem_vencimento: { rotulo: "Sem vencimento", tom: "neutro" },
};

/** `hoje` e `vencimento` em AAAA-MM-DD (datas sem hora, como no banco). */
export function situacao(vencimento: string | null, pagoEm: string | null, hoje: string): Situacao {
  if (pagoEm) return "paga";
  if (!vencimento) return "sem_vencimento";
  if (vencimento < hoje) return "vencida";
  if (vencimento === hoje) return "vence_hoje";
  return "a_vencer";
}

export type ContaResumo = { obraId: string; valor: number; vencimento: string | null };

/** Totais por obra das contas em aberto: a pagar, vencido, e o próximo vencimento. */
export function resumoPorObra(contas: ContaResumo[], hoje: string) {
  const m = new Map<string, { aPagar: number; vencido: number; quantidade: number; proximo: string | null }>();
  for (const c of contas) {
    const r = m.get(c.obraId) ?? { aPagar: 0, vencido: 0, quantidade: 0, proximo: null };
    r.aPagar += c.valor;
    r.quantidade += 1;
    if (c.vencimento && c.vencimento < hoje) r.vencido += c.valor;
    if (c.vencimento && c.vencimento >= hoje && (!r.proximo || c.vencimento < r.proximo)) r.proximo = c.vencimento;
    m.set(c.obraId, r);
  }
  return m;
}

/** Contas em aberto primeiro as vencidas, depois por vencimento; sem data no fim. */
export function ordenarPorVencimento<T extends { vencimento: string | null }>(contas: T[]): T[] {
  return [...contas].sort((a, b) => (a.vencimento ?? "9999") < (b.vencimento ?? "9999") ? -1 : (a.vencimento ?? "9999") > (b.vencimento ?? "9999") ? 1 : 0);
}

type U = { id: string; role: Role; empresaId: string };

/**
 * Obras em que o usuário pode ver o financeiro, com o perfil dele em cada uma.
 * Mesmo critério das telas de obra: Dono e Visitante veem todas; os demais, só as suas.
 */
export async function obrasComFinanceiro(db: PrismaClient, user: U) {
  if (acessaTodasAsObras(user.role)) {
    const obras = await db.obra.findMany({ where: { empresaId: user.empresaId, status: { not: "ARQUIVADA" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
    return can(user.role, "financeiro", "ver") ? obras.map((o) => ({ ...o, perfil: user.role })) : [];
  }
  const membros = await db.obraMembro.findMany({
    where: { userId: user.id, obra: { empresaId: user.empresaId, status: { not: "ARQUIVADA" } } },
    select: { role: true, obra: { select: { id: true, nome: true } } },
    orderBy: { obra: { nome: "asc" } },
  });
  return membros
    .filter((m) => can(m.role as Role, "financeiro", "ver"))
    .map((m) => ({ ...m.obra, perfil: m.role as Role }));
}

const isoOuNull = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Contas em aberto das obras dadas, já com o PIX pronto para copiar. */
export async function contasEmAberto(db: PrismaClient, obraIds: string[]) {
  if (!obraIds.length) return [];
  const linhas = await db.despesa.findMany({
    where: { obraId: { in: obraIds }, pagamento: null },
    select: {
      id: true, obraId: true, descricao: true, favorecido: true, valor: true, vencimento: true, tipo: true,
      pixChave: true, pixCopiaECola: true, linhaDigitavel: true, origem: true, documentoNome: true, documentoUrl: true,
      obra: { select: { nome: true } },
      fornecedor: { select: { nome: true } },
      ordem: { select: { numero: true } },
    },
  });
  return ordenarPorVencimento(linhas.map((l) => {
    const valor = Number(l.valor);
    const favorecido = l.favorecido ?? l.fornecedor?.nome ?? "";
    return {
      id: l.id, obraId: l.obraId, obraNome: l.obra.nome, descricao: l.descricao, favorecido, valor,
      vencimento: isoOuNull(l.vencimento), tipo: l.tipo, origem: l.origem, documentoNome: l.documentoNome, documentoUrl: l.documentoUrl,
      ordemNumero: l.ordem?.numero ?? null, linhaDigitavel: l.linhaDigitavel, pixChave: l.pixChave,
      pix: pixDaConta({ pixCopiaECola: l.pixCopiaECola, pixChave: l.pixChave, valor, favorecido, id: l.id }),
    };
  }));
}

/** O código do documento, se veio um; senão gera a partir da chave, com o valor da conta. */
export function pixDaConta(c: { pixCopiaECola: string | null; pixChave: string | null; valor: number; favorecido: string; id: string }): string | null {
  if (c.pixCopiaECola) return c.pixCopiaECola;
  if (!c.pixChave) return null;
  try {
    return gerarPix({ chave: c.pixChave, valor: c.valor, nome: c.favorecido || "Recebedor", txid: c.id.slice(-25) });
  } catch {
    return null;
  }
}
