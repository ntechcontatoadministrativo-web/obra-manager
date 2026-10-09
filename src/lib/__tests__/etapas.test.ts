import { describe, it, expect } from "vitest";
import { rolarParaCima, statusEfetivo, calcularGantt, calcularMedicao, etapasPadrao, estaDentroDe, profundidade, altura, emOrdemDeArvore, comPaisCalculados, type EtapaNo } from "../etapas";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const e = (id: string, paiId: string | null, o: Partial<EtapaNo> = {}): EtapaNo => ({
  id, paiId, nome: id, ordem: 0, inicioPrevisto: d("2026-10-01"), fimPrevisto: d("2026-10-10"), inicioReal: null, fimReal: null,
  percentual: 0, valorOrcado: 0, status: "NAO_INICIADA", ...o,
});

describe("árvore", () => {
  const arv = [e("A", null), e("B", "A"), e("C", "B"), e("D", null)];
  it("profundidade, altura e ciclos", () => {
    expect(profundidade(arv, "C")).toBe(3);
    expect(altura(arv, "A")).toBe(3);
    expect(estaDentroDe(arv, "C", "A")).toBe(true);
    expect(estaDentroDe(arv, "A", "C")).toBe(false);
    expect(estaDentroDe(arv, "A", "A")).toBe(true);
  });
  it("ordem de árvore com nível", () => {
    expect(emOrdemDeArvore(arv).map((x) => `${x.id}${x.nivel}`)).toEqual(["A1", "B2", "C3", "D1"]);
  });
});

describe("rolarParaCima", () => {
  it("pai = soma do orçamento e média ponderada das filhas", () => {
    const lista = [
      e("P", null),
      e("f1", "P", { valorOrcado: 100, percentual: 100, inicioReal: d("2026-10-01"), fimReal: d("2026-10-05") }),
      e("f2", "P", { valorOrcado: 300, percentual: 0, inicioPrevisto: d("2026-10-05"), fimPrevisto: d("2026-10-20") }),
    ];
    const r = rolarParaCima(lista).get("P")!;
    expect(r.valorOrcado).toBe(400);
    expect(r.percentual).toBe(25);
    expect(r.inicioPrevisto).toEqual(d("2026-10-01"));
    expect(r.fimPrevisto).toEqual(d("2026-10-20"));
    expect(r.fimReal).toBeNull(); // nem todas terminaram
    expect(r.inicioReal).toEqual(d("2026-10-01"));
  });
  it("sem orçamento usa média simples; vários níveis", () => {
    const lista = [e("A", null), e("B", "A"), e("c1", "B", { percentual: 50 }), e("c2", "B", { percentual: 100 })];
    const r = rolarParaCima(lista);
    expect(r.get("B")!.percentual).toBe(75);
    expect(r.get("A")!.percentual).toBe(75);
    expect(comPaisCalculados(lista).find((x) => x.id === "A")!.percentual).toBe(75);
  });
});

describe("statusEfetivo", () => {
  const hoje = d("2026-10-15");
  const base = { percentual: 0, fimPrevisto: d("2026-10-20"), inicioReal: null as Date | null, status: "NAO_INICIADA" as const };
  it("cada caso", () => {
    expect(statusEfetivo({ ...base, percentual: 100 }, hoje)).toBe("CONCLUIDA");
    expect(statusEfetivo({ ...base, percentual: 30 }, hoje)).toBe("EM_ANDAMENTO");
    expect(statusEfetivo({ ...base, fimPrevisto: d("2026-10-10"), percentual: 30 }, hoje)).toBe("ATRASADA");
    expect(statusEfetivo({ ...base, fimPrevisto: d("2026-10-15") }, hoje)).toBe("NAO_INICIADA"); // vence hoje: ainda no prazo
    expect(statusEfetivo({ ...base, status: "PARALISADA" as never, percentual: 10 }, hoje)).toBe("PARALISADA");
    expect(statusEfetivo({ ...base, fimPrevisto: d("2026-10-10"), percentual: 100 }, hoje)).toBe("CONCLUIDA");
  });
});

describe("gantt", () => {
  it("posiciona barras em porcentagem", () => {
    const g = calcularGantt([e("A", null, { inicioPrevisto: d("2026-10-01"), fimPrevisto: d("2026-10-10") }), e("B", null, { inicioPrevisto: d("2026-10-11"), fimPrevisto: d("2026-10-20") })], d("2026-10-05"))!;
    expect(g.totalDias).toBe(20);
    expect(g.linhas[0].plan).toEqual({ esq: 0, larg: 50 });
    expect(g.linhas[1].plan).toEqual({ esq: 50, larg: 50 });
    expect(g.hojePct).toBe(20);
    expect(g.meses).toHaveLength(1);
  });
  it("barra real vai até hoje enquanto não termina", () => {
    const g = calcularGantt([e("A", null, { inicioReal: d("2026-10-03"), percentual: 40 })], d("2026-10-06"))!;
    expect(g.linhas[0].real).not.toBeNull();
  });
  it("lista vazia", () => expect(calcularGantt([], d("2026-10-01"))).toBeNull());
});

describe("medição", () => {
  it("calcula o período contra a medição anterior", () => {
    const m = calcularMedicao(
      [{ id: "a", nome: "Fundação", valorOrcado: 1000, percentual: 100 }, { id: "b", nome: "Estrutura", valorOrcado: 2000, percentual: 30 }],
      new Map([["a", 60], ["b", 0]]),
    );
    expect(m.itens[0]).toMatchObject({ periodo: 40, valorPeriodo: 400 });
    expect(m.itens[1]).toMatchObject({ periodo: 30, valorPeriodo: 600 });
    expect(m.valorPeriodo).toBe(1000);
    expect(m.regressoes).toEqual([]);
  });
  it("avisa quando uma etapa voltou", () => {
    const m = calcularMedicao([{ id: "a", nome: "Fundação", valorOrcado: 1000, percentual: 50 }], new Map([["a", 60]]));
    expect(m.itens[0].periodo).toBe(0);
    expect(m.regressoes).toHaveLength(1);
  });
});

describe("modelo padrão", () => {
  it("cobre o prazo todo, em sequência e sem sobrepor", () => {
    const m = etapasPadrao(d("2026-01-01"), d("2026-12-31"));
    expect(m).toHaveLength(11);
    expect(m[0].inicioPrevisto).toEqual(d("2026-01-01"));
    expect(m[10].fimPrevisto.getTime()).toBeLessThanOrEqual(d("2026-12-31").getTime());
    expect(d("2026-12-31").getTime() - m[10].fimPrevisto.getTime()).toBeLessThan(4 * 86400000);
    for (let i = 1; i < m.length; i++) expect(m[i].inicioPrevisto.getTime()).toBeGreaterThan(m[i - 1].fimPrevisto.getTime() - 1);
    for (const x of m) expect(x.fimPrevisto.getTime()).toBeGreaterThanOrEqual(x.inicioPrevisto.getTime());
  });
  it("obra curta ainda gera datas válidas", () => {
    for (const x of etapasPadrao(d("2026-01-01"), d("2026-01-03"))) expect(x.fimPrevisto.getTime()).toBeGreaterThanOrEqual(x.inicioPrevisto.getTime());
  });
});
