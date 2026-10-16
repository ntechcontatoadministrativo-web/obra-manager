import { describe, it, expect } from "vitest";
import {
  conciliarAutomaticos, contarPorFaixa, estaAtivo, exposicaoDaObra, faixa,
  grade, nivel, regraClima, regraCusto, regraPrazo, type RiscoBase,
} from "../risco";

const r = (p: number, i: number, situacao?: RiscoBase["situacao"]): RiscoBase =>
  ({ probabilidade: p, impacto: i, situacao });

describe("nível e faixa", () => {
  it("o nível é o produto dos dois eixos", () => {
    expect(nivel(r(5, 5))).toBe(25);
    expect(nivel(r(1, 1))).toBe(1);
    expect(nivel(r(3, 4))).toBe(12);
  });

  it("valor fora da escala é trazido para dentro, não quebra a matriz", () => {
    expect(nivel(r(9, 3))).toBe(15);  // 5 x 3
    expect(nivel(r(0, 3))).toBe(3);   // 1 x 3
    expect(nivel(r(2.6, 2))).toBe(6); // arredonda para 3 x 2
  });

  it("as faixas seguem os cortes documentados", () => {
    expect(faixa(1)).toBe("baixo");
    expect(faixa(4)).toBe("baixo");
    expect(faixa(5)).toBe("moderado");
    expect(faixa(9)).toBe("moderado");
    expect(faixa(10)).toBe("alto");
    expect(faixa(14)).toBe("alto");
    expect(faixa(15)).toBe("critico");
    expect(faixa(25)).toBe("critico");
  });
});

describe("risco ativo", () => {
  it("encerrado sai da conta; materializado continua pesando", () => {
    expect(estaAtivo(r(3, 3, "ENCERRADO"))).toBe(false);
    expect(estaAtivo(r(3, 3, "MATERIALIZADO"))).toBe(true);
    expect(estaAtivo(r(3, 3, "IDENTIFICADO"))).toBe(true);
    expect(estaAtivo(r(3, 3))).toBe(true);
  });
});

describe("exposição da obra", () => {
  it("obra sem risco cadastrado fica em zero", () => {
    expect(exposicaoDaObra([])).toBe(0);
  });

  it("um risco crítico sozinho leva ao topo", () => {
    expect(exposicaoDaObra([r(5, 5)])).toBe(100);
  });

  it("um crítico cercado de banais ainda fica alto, mas não em 100", () => {
    const riscos = [r(5, 5), ...Array.from({ length: 9 }, () => r(1, 1))];
    const e = exposicaoDaObra(riscos);
    expect(e).toBeGreaterThan(55);
    expect(e).toBeLessThan(75);
  });

  it("muitos moderados somam sem saturar", () => {
    const e = exposicaoDaObra(Array.from({ length: 10 }, () => r(3, 3)));
    expect(e).toBe(36); // 0,6 x 9/25 + 0,4 x 9/25
  });

  it("riscos encerrados não contam", () => {
    expect(exposicaoDaObra([r(5, 5, "ENCERRADO"), r(1, 1)])).toBe(4);
  });

  it("é monotônica: agravar um risco nunca baixa a exposição", () => {
    const antes = exposicaoDaObra([r(2, 2), r(3, 3)]);
    const depois = exposicaoDaObra([r(2, 2), r(5, 4)]);
    expect(depois).toBeGreaterThan(antes);
  });
});

describe("resumo e grade", () => {
  it("conta por faixa só os ativos", () => {
    const c = contarPorFaixa([r(5, 5), r(1, 1), r(3, 3), r(5, 5, "ENCERRADO")]);
    expect(c.critico).toBe(1);
    expect(c.baixo).toBe(1);
    expect(c.moderado).toBe(1);
  });

  it("a grade tem as 25 células, com o pior no canto de cima", () => {
    const g = grade([]);
    expect(g).toHaveLength(25);
    expect(g[0].probabilidade).toBe(5);
    expect(g[0].impacto).toBe(1);
    expect(g[4]).toEqual({ probabilidade: 5, impacto: 5, quantidade: 0, faixa: "critico" });
  });

  it("cada risco cai na sua célula", () => {
    const g = grade([r(4, 2), r(4, 2), r(1, 5)]);
    expect(g.find((c) => c.probabilidade === 4 && c.impacto === 2)!.quantidade).toBe(2);
    expect(g.find((c) => c.probabilidade === 1 && c.impacto === 5)!.quantidade).toBe(1);
    expect(g.find((c) => c.probabilidade === 3 && c.impacto === 3)!.quantidade).toBe(0);
  });
});

describe("regra de clima", () => {
  it("chuva fraca não vira risco", () => {
    expect(regraClima(5, ["Concretagem"])).toBeNull();
  });
  it("sem etapa sensível, chuva não vira risco", () => {
    expect(regraClima(60, [])).toBeNull();
  });
  it("quanto mais chuva, maior a probabilidade", () => {
    expect(regraClima(12, ["Concretagem"])!.probabilidade).toBe(3);
    expect(regraClima(25, ["Concretagem"])!.probabilidade).toBe(4);
    expect(regraClima(50, ["Concretagem"])!.probabilidade).toBe(5);
  });
  it("a descrição nomeia a etapa afetada", () => {
    expect(regraClima(50, ["Concretagem"])!.descricao).toMatch(/Concretagem/);
  });
});

describe("regra de custo", () => {
  it("CPI saudável não vira risco", () => {
    expect(regraCusto(1.02)).toBeNull();
    expect(regraCusto(0.9)).toBeNull();
  });
  it("sem CPI (obra no começo) não vira risco", () => {
    expect(regraCusto(null)).toBeNull();
  });
  it("CPI ruim escala probabilidade e impacto", () => {
    const leve = regraCusto(0.88)!;
    const grave = regraCusto(0.7)!;
    expect(grave.probabilidade).toBeGreaterThan(leve.probabilidade);
    expect(grave.impacto).toBeGreaterThan(leve.impacto);
    expect(nivel(grave)).toBe(25);
  });
});

describe("regra de prazo", () => {
  it("sem etapa crítica atrasada, nada", () => {
    expect(regraPrazo([])).toBeNull();
  });
  it("atraso em etapa crítica é certo: probabilidade máxima", () => {
    expect(regraPrazo([{ nome: "Estrutura", diasAtraso: 3 }])!.probabilidade).toBe(5);
  });
  it("o impacto cresce com o tamanho do atraso", () => {
    expect(regraPrazo([{ nome: "A", diasAtraso: 3 }])!.impacto).toBe(2);
    expect(regraPrazo([{ nome: "A", diasAtraso: 10 }])!.impacto).toBe(3);
    expect(regraPrazo([{ nome: "A", diasAtraso: 20 }])!.impacto).toBe(4);
    expect(regraPrazo([{ nome: "A", diasAtraso: 45 }])!.impacto).toBe(5);
  });
  it("com uma etapa só, a descrição a nomeia; com várias, conta", () => {
    expect(regraPrazo([{ nome: "Estrutura", diasAtraso: 5 }])!.descricao).toMatch(/"Estrutura"/);
    expect(regraPrazo([{ nome: "A", diasAtraso: 5 }, { nome: "B", diasAtraso: 9 }])!.descricao).toMatch(/2 etapas/);
  });
});

describe("conciliação dos riscos automáticos", () => {
  const sug = regraCusto(0.7)!;

  it("regra nova vira risco novo", () => {
    const r = conciliarAutomaticos([sug], []);
    expect(r.criar).toHaveLength(1);
    expect(r.atualizar).toHaveLength(0);
  });

  it("risco automático já existente é atualizado", () => {
    const r = conciliarAutomaticos([sug], [{ codigo: "R01", origemRegra: "CUSTO_CPI", automatico: true }]);
    expect(r.criar).toHaveLength(0);
    expect(r.atualizar).toHaveLength(1);
    expect(r.atualizar[0].codigo).toBe("R01");
  });

  it("risco que a pessoa assumiu à mão não é sobrescrito", () => {
    const r = conciliarAutomaticos([sug], [{ codigo: "R01", origemRegra: "CUSTO_CPI", automatico: false }]);
    expect(r.criar).toHaveLength(0);
    expect(r.atualizar).toHaveLength(0);
    expect(r.encerrar).toHaveLength(0);
  });

  it("regra que parou de disparar encerra o risco automático", () => {
    const r = conciliarAutomaticos([], [{ codigo: "R01", origemRegra: "CUSTO_CPI", automatico: true }]);
    expect(r.encerrar).toEqual(["R01"]);
  });

  it("risco manual nunca é encerrado pela conciliação", () => {
    const r = conciliarAutomaticos([], [{ codigo: "R02", origemRegra: null, automatico: false }]);
    expect(r.encerrar).toHaveLength(0);
  });
});
