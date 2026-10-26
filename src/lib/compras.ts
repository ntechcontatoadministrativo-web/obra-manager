import { lerPix } from "./pix";

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

/** Anexos da solicitação, guardados no banco: até 3 pedidos (do fornecedor, orçamento) e 1 boleto. */
export type CategoriaAnexo = "PEDIDO" | "BOLETO";
export const LIMITE_ANEXOS: Record<CategoriaAnexo, number> = { PEDIDO: 3, BOLETO: 1 };
export const MAX_ANEXO_BYTES = 1_500_000; // o corpo da Server Action vai até 2 MB

export type TipoAnexo = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/** Tipo real pelos primeiros bytes; o que o navegador diz não vale. Fora da lista = null. */
export function tipoDoAnexo(b: Uint8Array): TipoAnexo | null {
  const ini = (...m: number[]) => m.every((v, i) => b[i] === v);
  if (ini(0x25, 0x50, 0x44, 0x46)) return "application/pdf"; // %PDF
  if (ini(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ini(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (ini(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp"; // RIFF....WEBP
  return null;
}

/** Status em que a solicitação ainda aceita anexos. */
export const aceitaAnexo = (s: CompraStatus) => s !== "REPROVADA" && s !== "CANCELADA";

/** Como o fornecedor quer receber. */
export type MeioPagamento = "PIX" | "BOLETO";

/**
 * Dados de pagamento da conta que nasce na entrega. Pediu PIX: o código copia e cola
 * (se válido) ou a chave informada. Pediu boleto: a linha digitável, sem PIX, para
 * ninguém pagar pelo caminho errado. Sem escolha: a chave PIX do cadastro do fornecedor.
 */
export function pagamentoDaConta(
  s: { meioPagamento: string | null; pagamentoPix: string | null; pagamentoLinhaDigitavel: string | null },
  pixDoFornecedor: string | null,
): { pixChave: string | null; pixCopiaECola: string | null; linhaDigitavel: string | null } {
  if (s.meioPagamento === "BOLETO") return { pixChave: null, pixCopiaECola: null, linhaDigitavel: s.pagamentoLinhaDigitavel };
  if (s.meioPagamento === "PIX" && s.pagamentoPix) {
    return lerPix(s.pagamentoPix)
      ? { pixChave: pixDoFornecedor, pixCopiaECola: s.pagamentoPix, linhaDigitavel: null }
      : { pixChave: s.pagamentoPix, pixCopiaECola: null, linhaDigitavel: null };
  }
  return { pixChave: pixDoFornecedor, pixCopiaECola: null, linhaDigitavel: null };
}

/** Alerta de desvio de preço: cotação acima da média histórica em X%. */
export function desvioDePreco(precoCotado: number, historico: number[], limitePct: number) {
  if (historico.length === 0) return { alerta: false, media: null as number | null, desvioPct: null as number | null };
  const media = historico.reduce((a, b) => a + b, 0) / historico.length;
  const desvioPct = ((precoCotado - media) / media) * 100;
  return { alerta: desvioPct > limitePct, media, desvioPct };
}
