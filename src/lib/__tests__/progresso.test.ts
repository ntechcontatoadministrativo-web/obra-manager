import { describe, it, expect } from "vitest";
import { progressoFisico, progressoFinanceiro, semaforoCronograma } from "../progresso";

describe("progresso", () => {
  it("pondera pelo valor orçado e ignora sub-etapas", () => {
    const r = progressoFisico([
      { paiId: null, percentual: 100, valorOrcado: 100 },
      { paiId: null, percentual: 0, valorOrcado: 300 },
      { paiId: "x", percentual: 100, valorOrcado: 9999 },
    ]);
    expect(r).toBe(25);
  });
  it("sem orçamento usa média simples; sem etapas = 0", () => {
    expect(progressoFisico([{ paiId: null, percentual: 50, valorOrcado: 0 }, { paiId: null, percentual: 100, valorOrcado: 0 }])).toBe(75);
    expect(progressoFisico([])).toBe(0);
  });
  it("financeiro", () => {
    expect(progressoFinanceiro(50, 200)).toBe(25);
    expect(progressoFinanceiro(50, 0)).toBe(0);
  });
  it("semáforo do cronograma", () => {
    const ini = new Date("2026-01-01"), fim = new Date("2026-01-11"), meio = new Date("2026-01-06");
    expect(semaforoCronograma(50, ini, fim, meio)).toBe("verde");
    expect(semaforoCronograma(40, ini, fim, meio)).toBe("amarelo");
    expect(semaforoCronograma(10, ini, fim, meio)).toBe("vermelho");
  });
});

import { parseNumeroBR } from "../utils";
describe("parseNumeroBR", () => {
  it("entende formato brasileiro e simples", () => {
    expect(parseNumeroBR("1.800.000,50")).toBe(1800000.5);
    expect(parseNumeroBR("1800000")).toBe(1800000);
    expect(parseNumeroBR("-1,455")).toBe(-1.455);
    expect(parseNumeroBR("abc")).toBeNaN();
    expect(parseNumeroBR("")).toBeNaN();
  });
});
