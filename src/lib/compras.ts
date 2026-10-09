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

/** Alerta de desvio de preço: cotação acima da média histórica em X%. */
export function desvioDePreco(precoCotado: number, historico: number[], limitePct: number) {
  if (historico.length === 0) return { alerta: false, media: null as number | null, desvioPct: null as number | null };
  const media = historico.reduce((a, b) => a + b, 0) / historico.length;
  const desvioPct = ((precoCotado - media) / media) * 100;
  return { alerta: desvioPct > limitePct, media, desvioPct };
}
