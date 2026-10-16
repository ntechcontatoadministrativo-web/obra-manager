/**
 * Comparativo entre obras e média histórica da empresa.
 *
 * O índice global existe para ordenar uma lista, não para julgar obra.
 * Por isso ele é explícito e simples de contestar: quatro parcelas com
 * peso declarado. Quem discordar do peso muda aqui, num lugar só.
 */

export type ObraComparada = {
  id: string;
  nome: string;
  status: string;
  cpi: number | null;
  spi: number | null;
  /** Dias além da previsão. Negativo é folga. */
  desvioPrazoDias: number | null;
  /** Diferença entre custo estimado e orçamento. Negativo é estouro. */
  vac: number | null;
  orcamento: number;
  avancoFisicoPct: number;
  /** 0 a 100, da matriz de risco. */
  exposicaoRisco: number;
};

export type LinhaComparativo = ObraComparada & {
  /** 0 a 10. */
  indice: number;
  posicao: number;
};

const limitar = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

/**
 * Índice de 0 a 10, com os pesos à vista:
 *   custo 30% · prazo 30% · risco 20% · avanço 20%
 *
 * Índice sem CPI ou SPI (obra que mal começou) usa 1,00 como neutro, em
 * vez de tratar a ausência como zero — obra nova não é obra ruim.
 */
export function indiceGlobal(o: ObraComparada): number {
  const custo = limitar((o.cpi ?? 1) / 1.1);
  const prazo = limitar((o.spi ?? 1) / 1.1);
  const risco = limitar(1 - o.exposicaoRisco / 100);
  const avanco = limitar(o.avancoFisicoPct / 100);
  return Math.round((custo * 0.3 + prazo * 0.3 + risco * 0.2 + avanco * 0.2) * 10 * 10) / 10;
}

export function ranquear(obras: ObraComparada[]): LinhaComparativo[] {
  return obras
    .map((o) => ({ ...o, indice: indiceGlobal(o), posicao: 0 }))
    .sort((a, b) => b.indice - a.indice)
    .map((o, i) => ({ ...o, posicao: i + 1 }));
}

export type Media = {
  cpi: number | null;
  spi: number | null;
  exposicaoRisco: number | null;
  indice: number | null;
  /** Quantas obras entraram na média. */
  base: number;
};

/**
 * Média da empresa, para servir de referência no gráfico.
 *
 * Só entra obra com indicador existente: incluir obra sem CPI puxaria a
 * média para um valor que ninguém mediu.
 */
export function mediaDaEmpresa(obras: ObraComparada[]): Media {
  const media = (valores: (number | null)[]) => {
    const v = valores.filter((x): x is number => x !== null && Number.isFinite(x));
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 1000) / 1000 : null;
  };
  return {
    cpi: media(obras.map((o) => o.cpi)),
    spi: media(obras.map((o) => o.spi)),
    exposicaoRisco: media(obras.map((o) => o.exposicaoRisco)),
    indice: media(obras.map((o) => indiceGlobal(o))),
    base: obras.length,
  };
}

/**
 * Padrões que aparecem ao cruzar as obras. Cada achado só é devolvido
 * com base suficiente — abaixo de 3 obras por grupo, a diferença é
 * ruído, não padrão.
 */
export function padroes(obras: ObraComparada[]): string[] {
  const achados: string[] = [];
  const comCpi = obras.filter((o) => o.cpi !== null);
  if (comCpi.length < 6) return achados;

  const mediana = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };

  const corte = mediana(comCpi.map((o) => o.orcamento));
  const pequenas = comCpi.filter((o) => o.orcamento <= corte);
  const grandes = comCpi.filter((o) => o.orcamento > corte);

  if (pequenas.length >= 3 && grandes.length >= 3) {
    const mp = pequenas.reduce((s, o) => s + o.cpi!, 0) / pequenas.length;
    const mg = grandes.reduce((s, o) => s + o.cpi!, 0) / grandes.length;
    const dif = Math.round(Math.abs(mp - mg) * 1000) / 10;
    if (dif >= 5) {
      achados.push(
        mp > mg
          ? `Obras de orçamento menor fecham com desempenho de custo ${dif}% melhor.`
          : `Obras de orçamento maior fecham com desempenho de custo ${dif}% melhor.`,
      );
    }
  }

  const atrasadas = obras.filter((o) => (o.desvioPrazoDias ?? 0) > 0);
  if (atrasadas.length >= 3) {
    const comRiscoAlto = atrasadas.filter((o) => o.exposicaoRisco >= 50).length;
    if (comRiscoAlto / atrasadas.length >= 0.6) {
      achados.push(`${comRiscoAlto} das ${atrasadas.length} obras atrasadas já tinham exposição a risco acima de 50.`);
    }
  }

  return achados;
}
