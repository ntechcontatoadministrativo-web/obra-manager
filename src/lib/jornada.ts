/** Cálculo de horas trabalhadas e extras a partir do ponto. */
export interface PontoDia {
  entradaEm: Date | null;
  saidaEm: Date | null;
  almocoSaidaEm?: Date | null;
  almocoVoltaEm?: Date | null;
}

const MS_HORA = 3_600_000;

export function horasTrabalhadas(p: PontoDia): number {
  if (!p.entradaEm || !p.saidaEm || p.saidaEm <= p.entradaEm) return 0;
  let ms = p.saidaEm.getTime() - p.entradaEm.getTime();
  if (p.almocoSaidaEm && p.almocoVoltaEm && p.almocoVoltaEm > p.almocoSaidaEm) {
    ms -= p.almocoVoltaEm.getTime() - p.almocoSaidaEm.getTime();
  }
  return Math.max(0, ms / MS_HORA);
}

/** Horas extras = excedente sobre a jornada padrão configurada. */
export function horasExtras(p: PontoDia, jornadaHorasDia: number): number {
  return Math.max(0, horasTrabalhadas(p) - jornadaHorasDia);
}
