import { describe, it, expect } from "vitest";
import { indiceGlobal, mediaDaEmpresa, padroes, ranquear, type ObraComparada } from "../comparativo";

const obra = (p: Partial<ObraComparada> = {}): ObraComparada => ({
  id: "o" + Math.random().toString(36).slice(2, 7),
  nome: "Obra", status: "EM_ANDAMENTO",
  cpi: 1, spi: 1, desvioPrazoDias: 0, vac: 0,
  orcamento: 1_000_000, avancoFisicoPct: 50, exposicaoRisco: 0,
  ...p,
});

describe("índice global", () => {
  it("obra perfeita chega ao topo", () => {
    expect(indiceGlobal(obra({ cpi: 1.1, spi: 1.1, exposicaoRisco: 0, avancoFisicoPct: 100 }))).toBe(10);
  });

  it("obra no limite inferior fica em zero", () => {
    expect(indiceGlobal(obra({ cpi: 0, spi: 0, exposicaoRisco: 100, avancoFisicoPct: 0 }))).toBe(0);
  });

  it("obra sem CPI nem SPI é tratada como neutra, não como ruim", () => {
    const nova = obra({ cpi: null, spi: null, avancoFisicoPct: 0, exposicaoRisco: 0 });
    const ruim = obra({ cpi: 0.3, spi: 0.3, avancoFisicoPct: 0, exposicaoRisco: 0 });
    expect(indiceGlobal(nova)).toBeGreaterThan(indiceGlobal(ruim));
  });

  it("é monotônico em cada parcela", () => {
    const base = obra({ cpi: 0.8, spi: 0.8, exposicaoRisco: 50, avancoFisicoPct: 40 });
    expect(indiceGlobal({ ...base, cpi: 0.9 })).toBeGreaterThan(indiceGlobal(base));
    expect(indiceGlobal({ ...base, spi: 0.9 })).toBeGreaterThan(indiceGlobal(base));
    expect(indiceGlobal({ ...base, exposicaoRisco: 20 })).toBeGreaterThan(indiceGlobal(base));
    expect(indiceGlobal({ ...base, avancoFisicoPct: 70 })).toBeGreaterThan(indiceGlobal(base));
  });

  it("CPI acima de 1,1 não rende bônus extra", () => {
    const a = indiceGlobal(obra({ cpi: 1.1 }));
    const b = indiceGlobal(obra({ cpi: 3 }));
    expect(a).toBe(b);
  });
});

describe("ranking", () => {
  it("ordena do melhor para o pior e numera a posição", () => {
    const lista = ranquear([
      obra({ id: "ruim", cpi: 0.6, spi: 0.6, exposicaoRisco: 80 }),
      obra({ id: "boa", cpi: 1.05, spi: 1.02, exposicaoRisco: 10 }),
      obra({ id: "media", cpi: 0.9, spi: 0.9, exposicaoRisco: 40 }),
    ]);
    expect(lista.map((o) => o.id)).toEqual(["boa", "media", "ruim"]);
    expect(lista.map((o) => o.posicao)).toEqual([1, 2, 3]);
  });

  it("lista vazia não quebra", () => {
    expect(ranquear([])).toEqual([]);
  });
});

describe("média da empresa", () => {
  it("calcula sobre quem tem o indicador", () => {
    const m = mediaDaEmpresa([obra({ cpi: 1 }), obra({ cpi: 0.8 }), obra({ cpi: null })]);
    expect(m.cpi).toBe(0.9);
    expect(m.base).toBe(3);
  });

  it("devolve nulo quando ninguém tem o indicador", () => {
    const m = mediaDaEmpresa([obra({ cpi: null, spi: null })]);
    expect(m.cpi).toBeNull();
    expect(m.spi).toBeNull();
  });

  it("empresa sem obra devolve tudo nulo", () => {
    const m = mediaDaEmpresa([]);
    expect(m.cpi).toBeNull();
    expect(m.indice).toBeNull();
    expect(m.base).toBe(0);
  });
});

describe("padrões", () => {
  it("cala a boca com amostra pequena", () => {
    expect(padroes([obra(), obra(), obra()])).toEqual([]);
  });

  it("encontra a diferença de custo por porte quando ela é grande", () => {
    const pequenas = Array.from({ length: 4 }, () => obra({ orcamento: 200_000, cpi: 1.05 }));
    const grandes = Array.from({ length: 4 }, () => obra({ orcamento: 5_000_000, cpi: 0.85 }));
    const achados = padroes([...pequenas, ...grandes]);
    expect(achados.join(" ")).toMatch(/orçamento menor/);
  });

  it("não inventa padrão quando a diferença é pequena", () => {
    const pequenas = Array.from({ length: 4 }, () => obra({ orcamento: 200_000, cpi: 1.0 }));
    const grandes = Array.from({ length: 4 }, () => obra({ orcamento: 5_000_000, cpi: 0.99 }));
    expect(padroes([...pequenas, ...grandes]).join(" ")).not.toContain("orçamento");
  });

  it("liga atraso a risco alto quando a maioria coincide", () => {
    const atrasadas = Array.from({ length: 4 }, () => obra({ desvioPrazoDias: 20, exposicaoRisco: 70, cpi: 0.9 }));
    const resto = Array.from({ length: 4 }, () => obra({ cpi: 1 }));
    expect(padroes([...atrasadas, ...resto]).join(" ")).toMatch(/exposição a risco acima de 50/);
  });
});
