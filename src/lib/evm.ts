/**
 * Análise de valor agregado (EVM).
 *
 * As três grandezas saem do que o banco já tem:
 *   PV (valor planejado)  = valorOrcado x % previsto na data, por etapa
 *   EV (valor agregado)   = valorOrcado x Etapa.percentual
 *   AC (custo real)       = soma das despesas da obra até a data
 *
 * Duas decisões que mudam o resultado e por isso ficam explícitas:
 *
 * 1. O PV usa as datas da BASELINE, não as datas atuais da etapa. Medir
 *    contra o cronograma remanejado faz o SPI dar sempre 1,00 — o atraso
 *    some junto com a data antiga.
 *
 * 2. O avanço previsto dentro de uma etapa é linear entre início e fim.
 *    É a convenção usual e a única honesta sem curva de histograma por
 *    etapa. Para etapa longa com desembolso concentrado, o PV fica um
 *    pouco otimista no começo.
 *
 * Os valores entram e saem como number (reais, com centavos). Em obra de
 * até algumas centenas de milhões o double tem precisão de sobra; o que
 * for gravado volta para Decimal no Prisma.
 */

/** Etapa folha. Etapa-pai não entra: o valor dela é a soma das filhas. */
export type EtapaEvm = {
  id: string;
  /** Datas da baseline ativa. Sem baseline, as previstas da própria etapa. */
  inicioPrevisto: Date;
  fimPrevisto: Date;
  valorOrcado: number;
  /** Avanço informado, de 0 a 100. */
  percentual: number;
};

export type Indicadores = {
  /** Valor planejado até a data (BCWS). */
  pv: number;
  /** Valor agregado — o que foi entregue, a preço de orçamento (BCWP). */
  ev: number;
  /** Custo real incorrido (ACWP). */
  ac: number;
  /** Orçamento no término. */
  bac: number;

  /** Variação de custo: positivo é economia. */
  cv: number;
  /** Variação de prazo em reais: positivo é adiantamento. */
  sv: number;

  /** EV/AC. null quando ainda não houve despesa. */
  cpi: number | null;
  /** EV/PV. null antes de a obra ter trabalho previsto. */
  spi: number | null;

  /** Custo final estimado mantendo o desempenho atual (BAC/CPI). */
  eac: number | null;
  /** Variante pessimista: custo e prazo continuam ruins. */
  eacComPrazo: number | null;
  /** Variante otimista: o que falta sai pelo orçado. */
  eacRestanteNoOrcado: number;
  /** Quanto ainda vai custar (EAC - AC). */
  etc: number | null;
  /** Sobra (+) ou estouro (-) previsto no fim. */
  vac: number | null;
  /** Desempenho necessário daqui para a frente para fechar no orçamento. */
  tcpi: number | null;

  /** Avanço físico global ponderado pelo valor, de 0 a 100. */
  avancoFisicoPct: number;
};

const emMs = 86_400_000;

/** Fração prevista de uma etapa numa data, de 0 a 1. */
export function fracaoPrevista(etapa: EtapaEvm, data: Date): number {
  const ini = etapa.inicioPrevisto.getTime();
  const fim = etapa.fimPrevisto.getTime();
  const t = data.getTime();

  // Marco ou etapa de duração zero vem primeiro: no próprio dia ele já
  // conta como previsto, enquanto uma etapa comum no dia de início ainda
  // está em 0%. Testar na ordem inversa zera o marco para sempre.
  if (fim <= ini) return t >= fim ? 1 : 0;
  if (t <= ini) return 0;
  if (t >= fim) return 1;
  return (t - ini) / (fim - ini);
}

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const arredondar = (n: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Valor planejado acumulado numa data. */
export function valorPlanejado(etapas: EtapaEvm[], data: Date): number {
  let total = 0;
  for (const e of etapas) total += e.valorOrcado * fracaoPrevista(e, data);
  return total;
}

/** Valor agregado — avanço informado a preço de orçamento. */
export function valorAgregado(etapas: EtapaEvm[]): number {
  let total = 0;
  for (const e of etapas) total += e.valorOrcado * (limitar(e.percentual, 0, 100) / 100);
  return total;
}

export function orcamentoTotal(etapas: EtapaEvm[]): number {
  let total = 0;
  for (const e of etapas) total += e.valorOrcado;
  return total;
}

/**
 * Calcula todos os indicadores numa data.
 *
 * @param etapas    etapas folha, com datas da baseline ativa
 * @param custoReal soma das despesas até a data
 * @param data      data de corte (normalmente hoje ou o fim da semana)
 */
export function calcularEvm(etapas: EtapaEvm[], custoReal: number, data: Date): Indicadores {
  const pv = valorPlanejado(etapas, data);
  const ev = valorAgregado(etapas);
  const ac = Math.max(0, custoReal);
  const bac = orcamentoTotal(etapas);

  // Divisor zero não é erro: é obra que ainda não começou a gastar ou a
  // produzir. Devolver null deixa a tela mostrar "—" em vez de Infinity.
  const cpi = ac > 0 ? ev / ac : null;
  const spi = pv > 0 ? ev / pv : null;

  const eac = cpi !== null && cpi > 0 ? bac / cpi : null;
  const eacRestanteNoOrcado = ac + (bac - ev);
  const eacComPrazo =
    cpi !== null && spi !== null && cpi * spi > 0 ? ac + (bac - ev) / (cpi * spi) : null;

  const etc = eac !== null ? eac - ac : null;
  const vac = eac !== null ? bac - eac : null;

  // TCPI: o quanto o trabalho restante precisa render para fechar no BAC.
  // Com AC já acima do orçamento, não existe desempenho que salve — null.
  const restanteOrcamento = bac - ac;
  const tcpi = restanteOrcamento > 0 ? (bac - ev) / restanteOrcamento : null;

  return {
    pv: arredondar(pv), ev: arredondar(ev), ac: arredondar(ac), bac: arredondar(bac),
    cv: arredondar(ev - ac), sv: arredondar(ev - pv),
    cpi: cpi === null ? null : arredondar(cpi, 3),
    spi: spi === null ? null : arredondar(spi, 3),
    eac: eac === null ? null : arredondar(eac),
    eacComPrazo: eacComPrazo === null ? null : arredondar(eacComPrazo),
    eacRestanteNoOrcado: arredondar(eacRestanteNoOrcado),
    etc: etc === null ? null : arredondar(etc),
    vac: vac === null ? null : arredondar(vac),
    tcpi: tcpi === null ? null : arredondar(tcpi, 3),
    avancoFisicoPct: bac > 0 ? arredondar((ev / bac) * 100) : 0,
  };
}

// ----------------------------------------------------------- curva S --

export type PontoCurva = {
  /** Segunda-feira da semana. */
  semana: Date;
  pv: number;
  /** Só existe em semana já fechada. */
  ev: number | null;
  ac: number | null;
};

/** Segunda-feira da semana de uma data, à meia-noite UTC. */
export function segundaDaSemana(data: Date): Date {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const diaDaSemana = d.getUTCDay(); // 0 = domingo
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  d.setUTCDate(d.getUTCDate() - recuo);
  return d;
}

/**
 * Monta a série da curva S.
 *
 * O PV é calculado para toda a duração prevista, porque a curva
 * planejada vai até o fim da obra. EV e AC vêm dos fechamentos semanais
 * já gravados e param na última semana fechada — é isso que produz o
 * desenho característico: a linha planejada segue e as realizadas param.
 */
export function curvaS(
  etapas: EtapaEvm[],
  fechamentos: { semana: Date; valorAgregado: number; custoReal: number }[],
  limiteSemanas = 520,
): PontoCurva[] {
  if (!etapas.length) return [];

  const inicio = segundaDaSemana(new Date(Math.min(...etapas.map((e) => e.inicioPrevisto.getTime()))));
  const fim = new Date(Math.max(...etapas.map((e) => e.fimPrevisto.getTime())));

  const porSemana = new Map<number, { valorAgregado: number; custoReal: number }>();
  for (const f of fechamentos) porSemana.set(segundaDaSemana(f.semana).getTime(), f);

  const pontos: PontoCurva[] = [];
  const cursor = new Date(inicio);
  let guarda = 0;

  while (cursor.getTime() <= fim.getTime() + 6 * emMs && guarda++ < limiteSemanas) {
    // O PV da semana é o acumulado no domingo, fim dela.
    const fimDaSemana = new Date(cursor.getTime() + 6 * emMs);
    const fechado = porSemana.get(cursor.getTime());
    pontos.push({
      semana: new Date(cursor),
      pv: arredondar(valorPlanejado(etapas, fimDaSemana)),
      ev: fechado ? arredondar(fechado.valorAgregado) : null,
      ac: fechado ? arredondar(fechado.custoReal) : null,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return pontos;
}

// -------------------------------------------------------- avaliação ---

export type Severidade = "bom" | "atencao" | "critico";

/**
 * Faixa de leitura de CPI e SPI. Os cortes em 0,95 e 0,90 são a
 * convenção de mercado e estão no spec; ficam aqui em um lugar só para
 * poderem virar configuração da empresa depois.
 */
export function faixaIndice(valor: number | null): Severidade | null {
  if (valor === null) return null;
  if (valor >= 0.95) return "bom";
  if (valor >= 0.9) return "atencao";
  return "critico";
}

/** Texto curto para a tela e para o alerta. */
export function lerIndicadores(i: Indicadores): string[] {
  const avisos: string[] = [];
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  if (i.cpi !== null && i.cpi < 0.9) {
    avisos.push(`Custo acima do previsto: cada R$ 1,00 gasto entregou R$ ${i.cpi.toFixed(2)} de obra.`);
  }
  if (i.spi !== null && i.spi < 0.9) {
    avisos.push(`Obra atrasada: entregue ${(i.spi * 100).toFixed(0)}% do que era previsto para hoje.`);
  }
  if (i.vac !== null && i.vac < 0) {
    avisos.push(`Estouro previsto de ${brl(Math.abs(i.vac))} se o ritmo de custo continuar.`);
  }
  if (i.tcpi !== null && i.tcpi > 1.1) {
    avisos.push(`Para fechar no orçamento, o resto da obra precisa render ${i.tcpi.toFixed(2)}x — pouco provável.`);
  }
  return avisos;
}
