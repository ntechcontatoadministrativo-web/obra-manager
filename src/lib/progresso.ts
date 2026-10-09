/**
 * Indicadores de progresso da obra.
 * Físico: média das etapas RAIZ ponderada pelo valor orçado (etapa cara pesa mais).
 * Se nenhuma etapa tem orçamento, usa média simples.
 */
export interface EtapaResumo {
  paiId: string | null;
  percentual: number;
  valorOrcado: number;
}

export function progressoFisico(etapas: EtapaResumo[]): number {
  const raiz = etapas.filter((e) => e.paiId === null);
  if (raiz.length === 0) return 0;
  const totalOrcado = raiz.reduce((s, e) => s + e.valorOrcado, 0);
  const pct =
    totalOrcado > 0
      ? raiz.reduce((s, e) => s + e.percentual * e.valorOrcado, 0) / totalOrcado
      : raiz.reduce((s, e) => s + e.percentual, 0) / raiz.length;
  return Math.round(pct * 10) / 10;
}

/** Financeiro: custo realizado / orçamento total das etapas raiz. */
export function progressoFinanceiro(custoRealizado: number, orcamentoTotal: number): number {
  if (orcamentoTotal <= 0) return 0;
  return Math.round((custoRealizado / orcamentoTotal) * 1000) / 10;
}

export type Semaforo = "verde" | "amarelo" | "vermelho";

/**
 * "Temperatura do cronograma": compara o avanço físico real com o esperado pelo tempo decorrido.
 * Atraso até 5 pontos = verde; até 15 = amarelo; acima = vermelho.
 */
export function semaforoCronograma(fisicoPct: number, inicio: Date, fim: Date, hoje = new Date()): Semaforo {
  const total = fim.getTime() - inicio.getTime();
  if (total <= 0) return "verde";
  const esperado = Math.min(100, Math.max(0, ((hoje.getTime() - inicio.getTime()) / total) * 100));
  const atraso = esperado - fisicoPct;
  if (atraso <= 5) return "verde";
  if (atraso <= 15) return "amarelo";
  return "vermelho";
}
