import { describe, it, expect } from "vitest";
import {
  calcularEvm, curvaS, fracaoPrevista, faixaIndice, lerIndicadores,
  segundaDaSemana, valorAgregado, valorPlanejado, type EtapaEvm,
} from "../evm";

const d = (iso: string) => new Date(iso + "T00:00:00Z");

/** Obra de R$ 100.000 em duas etapas de R$ 50.000, uma em cada mês. */
const etapas = (pct1: number, pct2: number): EtapaEvm[] => [
  { id: "a", inicioPrevisto: d("2026-01-01"), fimPrevisto: d("2026-01-31"), valorOrcado: 50_000, percentual: pct1 },
  { id: "b", inicioPrevisto: d("2026-02-01"), fimPrevisto: d("2026-02-28"), valorOrcado: 50_000, percentual: pct2 },
];

describe("fração prevista dentro da etapa", () => {
  const e = etapas(0, 0)[0];

  it("é zero antes de começar e um depois de terminar", () => {
    expect(fracaoPrevista(e, d("2025-12-15"))).toBe(0);
    expect(fracaoPrevista(e, d("2026-03-01"))).toBe(1);
  });

  it("vai pela metade no meio do intervalo", () => {
    expect(fracaoPrevista(e, d("2026-01-16"))).toBeCloseTo(0.5, 2);
  });

  it("trata marco (duração zero) sem dividir por zero", () => {
    const marco: EtapaEvm = {
      id: "m", inicioPrevisto: d("2026-01-10"), fimPrevisto: d("2026-01-10"),
      valorOrcado: 1000, percentual: 0,
    };
    expect(fracaoPrevista(marco, d("2026-01-09"))).toBe(0);
    expect(fracaoPrevista(marco, d("2026-01-10"))).toBe(1);
  });
});

describe("indicadores", () => {
  it("obra no começo, sem despesa: CPI e SPI ficam nulos em vez de Infinity", () => {
    const i = calcularEvm(etapas(0, 0), 0, d("2025-12-01"));
    expect(i.pv).toBe(0);
    expect(i.ev).toBe(0);
    expect(i.cpi).toBeNull();
    expect(i.spi).toBeNull();
    expect(i.eac).toBeNull();
    expect(i.bac).toBe(100_000);
  });

  it("no prazo e no custo: CPI e SPI ficam em 1,00", () => {
    // Fim de janeiro: previsto 50% da obra; entregue a etapa A inteira.
    const i = calcularEvm(etapas(100, 0), 50_000, d("2026-01-31"));
    expect(i.pv).toBe(50_000);
    expect(i.ev).toBe(50_000);
    expect(i.cpi).toBe(1);
    expect(i.spi).toBe(1);
    expect(i.cv).toBe(0);
    expect(i.sv).toBe(0);
    expect(i.eac).toBe(100_000);
    expect(i.vac).toBe(0);
  });

  it("gastou 25% a mais do que entregou: CPI abaixo de 1 e estouro previsto", () => {
    const i = calcularEvm(etapas(100, 0), 62_500, d("2026-01-31"));
    expect(i.cpi).toBe(0.8);
    expect(i.cv).toBe(-12_500);
    expect(i.eac).toBe(125_000);       // 100.000 / 0,8
    expect(i.vac).toBe(-25_000);       // estouro
    expect(i.etc).toBe(62_500);
  });

  it("entregou metade do previsto: SPI em 0,50", () => {
    // Fim de janeiro, etapa A só 50%.
    const i = calcularEvm(etapas(50, 0), 25_000, d("2026-01-31"));
    expect(i.pv).toBe(50_000);
    expect(i.ev).toBe(25_000);
    expect(i.spi).toBe(0.5);
    expect(i.sv).toBe(-25_000);
  });

  it("TCPI diz o esforço necessário para fechar no orçamento", () => {
    const i = calcularEvm(etapas(100, 0), 62_500, d("2026-01-31"));
    // Falta entregar 50.000 com 37.500 de orçamento restante.
    expect(i.tcpi).toBeCloseTo(1.333, 3);
  });

  it("com o orçamento já estourado, TCPI vira nulo em vez de negativo", () => {
    const i = calcularEvm(etapas(50, 0), 120_000, d("2026-01-31"));
    expect(i.tcpi).toBeNull();
  });

  it("percentual fora da faixa é limitado, não propaga erro", () => {
    expect(valorAgregado(etapas(150, -20))).toBe(50_000);
  });

  it("obra inteira concluída e paga: tudo fecha", () => {
    const i = calcularEvm(etapas(100, 100), 100_000, d("2026-03-15"));
    expect(i.ev).toBe(100_000);
    expect(i.pv).toBe(100_000);
    expect(i.cpi).toBe(1);
    expect(i.spi).toBe(1);
    expect(i.avancoFisicoPct).toBe(100);
  });

  it("obra sem etapas não quebra", () => {
    const i = calcularEvm([], 0, d("2026-01-01"));
    expect(i.bac).toBe(0);
    expect(i.avancoFisicoPct).toBe(0);
    expect(i.tcpi).toBeNull();
  });

  it("as três variantes de EAC se separam quando custo e prazo pioram", () => {
    const i = calcularEvm(etapas(50, 0), 40_000, d("2026-01-31"));
    expect(i.eac).not.toBeNull();
    // Otimista (resto sai pelo orçado) é a menor das três.
    expect(i.eacRestanteNoOrcado).toBeLessThan(i.eac!);
    // Pessimista (custo e prazo continuam) é a maior.
    expect(i.eacComPrazo!).toBeGreaterThan(i.eac!);
  });
});

describe("avanço planejado acumulado", () => {
  it("soma as duas etapas no meio da segunda", () => {
    // Meio de fevereiro: etapa A inteira + metade da B.
    const pv = valorPlanejado(etapas(0, 0), d("2026-02-14"));
    expect(pv).toBeGreaterThan(70_000);
    expect(pv).toBeLessThan(80_000);
  });
});

describe("semana", () => {
  it("segunda-feira volta para ela mesma", () => {
    expect(segundaDaSemana(d("2026-01-05")).toISOString().slice(0, 10)).toBe("2026-01-05");
  });
  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(segundaDaSemana(d("2026-01-11")).toISOString().slice(0, 10)).toBe("2026-01-05");
  });
  it("quarta-feira recua para a segunda", () => {
    expect(segundaDaSemana(d("2026-01-07")).toISOString().slice(0, 10)).toBe("2026-01-05");
  });
});

describe("curva S", () => {
  it("o planejado vai até o fim e o realizado para na última semana fechada", () => {
    const pontos = curvaS(etapas(100, 0), [
      { semana: d("2026-01-05"), valorAgregado: 10_000, custoReal: 12_000 },
      { semana: d("2026-01-12"), valorAgregado: 25_000, custoReal: 28_000 },
    ]);

    expect(pontos.length).toBeGreaterThan(5);
    // Todo ponto tem PV; só os dois fechados têm EV e AC.
    expect(pontos.every((p) => typeof p.pv === "number")).toBe(true);
    expect(pontos.filter((p) => p.ev !== null)).toHaveLength(2);

    // O PV é monótono: curva acumulada nunca desce.
    for (let k = 1; k < pontos.length; k++) {
      expect(pontos[k].pv).toBeGreaterThanOrEqual(pontos[k - 1].pv);
    }
    // E termina no orçamento total.
    expect(pontos[pontos.length - 1].pv).toBe(100_000);
  });

  it("obra sem etapas devolve série vazia", () => {
    expect(curvaS([], [])).toEqual([]);
  });

  it("cronograma absurdo não gera série infinita", () => {
    const longa: EtapaEvm[] = [{
      id: "x", inicioPrevisto: d("2000-01-01"), fimPrevisto: d("2200-01-01"),
      valorOrcado: 1000, percentual: 0,
    }];
    expect(curvaS(longa, []).length).toBeLessThanOrEqual(520);
  });
});

describe("leitura para a tela", () => {
  it("classifica as faixas de índice", () => {
    expect(faixaIndice(1.02)).toBe("bom");
    expect(faixaIndice(0.93)).toBe("atencao");
    expect(faixaIndice(0.7)).toBe("critico");
    expect(faixaIndice(null)).toBeNull();
  });

  it("obra saudável não gera aviso", () => {
    expect(lerIndicadores(calcularEvm(etapas(100, 0), 50_000, d("2026-01-31")))).toHaveLength(0);
  });

  it("obra cara e atrasada gera avisos de custo e de prazo", () => {
    const avisos = lerIndicadores(calcularEvm(etapas(40, 0), 50_000, d("2026-01-31")));
    expect(avisos.join(" ")).toMatch(/Custo acima/);
    expect(avisos.join(" ")).toMatch(/atrasada/);
  });
});
