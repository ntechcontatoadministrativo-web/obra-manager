/**
 * Fluxo de aprovação de compras:
 * Solicitação (Encarregado) -> Admin da Obra -> [se acima do limite] Super Admin -> PO.
 */
export type CompraStatus =
  | "AGUARDANDO_ADMIN_OBRA" | "AGUARDANDO_SUPER_ADMIN" | "APROVADA" | "REPROVADA"
  | "PO_EMITIDA" | "ENVIADA_FORNECEDOR" | "ENTREGUE" | "CANCELADA";

/** Próximo status quando o Admin da Obra aprova. */
export function statusAposAprovacaoAdminObra(valorEstimado: number, limite: number): CompraStatus {
  return valorEstimado > limite ? "AGUARDANDO_SUPER_ADMIN" : "APROVADA";
}

/** Transições permitidas (qualquer outra deve ser rejeitada pela API). */
const TRANSICOES: Record<CompraStatus, CompraStatus[]> = {
  AGUARDANDO_ADMIN_OBRA: ["AGUARDANDO_SUPER_ADMIN", "APROVADA", "REPROVADA", "CANCELADA"],
  AGUARDANDO_SUPER_ADMIN: ["APROVADA", "REPROVADA", "CANCELADA"],
  APROVADA: ["PO_EMITIDA", "CANCELADA"],
  REPROVADA: [],
  PO_EMITIDA: ["ENVIADA_FORNECEDOR", "CANCELADA"],
  ENVIADA_FORNECEDOR: ["ENTREGUE", "CANCELADA"],
  ENTREGUE: [], // dispara lançamento contábil automático (Despesa)
  CANCELADA: [],
};

export function transicaoValida(de: CompraStatus, para: CompraStatus): boolean {
  return TRANSICOES[de].includes(para);
}

/**
 * Para onde vai a solicitação quando este perfil aprova, ou null se ele
 * não pode aprovar nesta fase. O dono aprova direto em qualquer fase;
 * o engenheiro só na primeira, e acima do limite a compra sobe para o dono.
 */
export function statusAoAprovar(
  perfil: string, atual: CompraStatus, valorEstimado: number, limite: number,
): CompraStatus | null {
  const dono = perfil === "SUPER_ADMIN" || perfil === "VISITANTE";
  if (atual === "AGUARDANDO_ADMIN_OBRA") {
    if (dono) return "APROVADA";
    if (perfil === "ADMIN_OBRA") return statusAposAprovacaoAdminObra(valorEstimado, limite);
    return null;
  }
  if (atual === "AGUARDANDO_SUPER_ADMIN") return dono ? "APROVADA" : null;
  return null;
}

/** Número da ordem de compra: OC-2026-0007. */
export const numeroOrdem = (ano: number, sequencial: number) => `OC-${ano}-${String(sequencial).padStart(4, "0")}`;

export const ROTULO_COMPRA: Record<CompraStatus, { rotulo: string; tom: "neutro" | "ok" | "alerta" | "perigo" | "info" }> = {
  AGUARDANDO_ADMIN_OBRA: { rotulo: "Aguardando engenheiro", tom: "alerta" },
  AGUARDANDO_SUPER_ADMIN: { rotulo: "Aguardando dono", tom: "alerta" },
  APROVADA: { rotulo: "Aprovada", tom: "info" },
  REPROVADA: { rotulo: "Reprovada", tom: "perigo" },
  PO_EMITIDA: { rotulo: "Ordem emitida", tom: "info" },
  ENVIADA_FORNECEDOR: { rotulo: "Com o fornecedor", tom: "info" },
  ENTREGUE: { rotulo: "Entregue", tom: "ok" },
  CANCELADA: { rotulo: "Cancelada", tom: "neutro" },
};

/** Alerta de desvio de preço: cotação acima da média histórica em X%. */
export function desvioDePreco(precoCotado: number, historico: number[], limitePct: number) {
  if (historico.length === 0) return { alerta: false, media: null as number | null, desvioPct: null as number | null };
  const media = historico.reduce((a, b) => a + b, 0) / historico.length;
  const desvioPct = ((precoCotado - media) / media) * 100;
  return { alerta: desvioPct > limitePct, media, desvioPct };
}
