import { describe, it, expect } from "vitest";
import {
  atrasoContraBaseline, calcularRede, caminhoCritico, criariaCiclo,
  type Dependencia, type EtapaRede,
} from "../cronograma";

const d = (iso: string) => new Date(iso + "T00:00:00Z");
const iso = (data: Date) => data.toISOString().slice(0, 10);

const etapa = (id: string, ini: string, fim: string, ehMarco = false): EtapaRede =>
  ({ id, nome: id.toUpperCase(), inicioPrevisto: d(ini), fimPrevisto: d(fim), ehMarco });

const dep = (p: string, s: string, tipo: Dependencia["tipo"] = "TI", folgaDias = 0): Dependencia =>
  ({ predecessoraId: p, sucessoraId: s, tipo, folgaDias });

describe("rede simples em sequência", () => {
  // fundação (10 dias) -> estrutura (20 dias) -> alvenaria (15 dias)
  const etapas = [
    etapa("fund", "2026-01-01", "2026-01-11"),
    etapa("estr", "2026-01-01", "2026-01-21"),
    etapa("alv", "2026-01-01", "2026-01-16"),
  ];
  const deps = [dep("fund", "estr"), dep("estr", "alv")];

  it("empurra cada etapa para depois da anterior", () => {
    const r = calcularRede(etapas, deps);
    const por = Object.fromEntries(r.nos.map((n) => [n.id, n]));
    expect(iso(por.fund.inicioCedo)).toBe("2026-01-01");
    expect(iso(por.fund.fimCedo)).toBe("2026-01-11");
    expect(iso(por.estr.inicioCedo)).toBe("2026-01-11"); // começa quando a fundação acaba
    expect(iso(por.estr.fimCedo)).toBe("2026-01-31");
    expect(iso(por.alv.inicioCedo)).toBe("2026-01-31");
    expect(iso(r.terminoProjeto!)).toBe("2026-02-15");
  });

  it("em fila única, tudo é crítico e a folga é zero", () => {
    const r = calcularRede(etapas, deps);
    expect(r.nos.every((n) => n.ehCritica)).toBe(true);
    expect(r.nos.every((n) => n.folgaTotalDias === 0)).toBe(true);
    expect(caminhoCritico(r)).toHaveLength(3);
  });
});

describe("frentes em paralelo", () => {
  // Depois da fundação, duas frentes; a curta tem folga.
  const etapas = [
    etapa("fund", "2026-01-01", "2026-01-11"),
    etapa("longa", "2026-01-01", "2026-01-31"), // 30 dias
    etapa("curta", "2026-01-01", "2026-01-11"), // 10 dias
    etapa("fim", "2026-01-01", "2026-01-06"),
  ];
  const deps = [
    dep("fund", "longa"), dep("fund", "curta"),
    dep("longa", "fim"), dep("curta", "fim"),
  ];

  it("só a frente longa é crítica", () => {
    const r = calcularRede(etapas, deps);
    const por = Object.fromEntries(r.nos.map((n) => [n.id, n]));
    expect(por.longa.ehCritica).toBe(true);
    expect(por.curta.ehCritica).toBe(false);
    expect(por.fund.ehCritica).toBe(true);
    expect(por.fim.ehCritica).toBe(true);
  });

  it("a folga da frente curta é a diferença de duração", () => {
    const r = calcularRede(etapas, deps);
    const curta = r.nos.find((n) => n.id === "curta")!;
    expect(curta.folgaTotalDias).toBe(20); // 30 - 10
  });

  it("o fim do projeto é ditado pela frente longa", () => {
    const r = calcularRede(etapas, deps);
    expect(iso(r.terminoProjeto!)).toBe("2026-02-15"); // 11/01 + 30 + 5
  });
});

describe("tipos de dependência", () => {
  const base = [etapa("a", "2026-01-01", "2026-01-11"), etapa("b", "2026-01-01", "2026-01-06")];

  it("TI: a sucessora começa quando a predecessora termina", () => {
    const r = calcularRede(base, [dep("a", "b", "TI")]);
    expect(iso(r.nos.find((n) => n.id === "b")!.inicioCedo)).toBe("2026-01-11");
  });

  it("II: as duas começam juntas", () => {
    const etapas = [etapa("a", "2026-01-10", "2026-01-20"), etapa("b", "2026-01-01", "2026-01-06")];
    const r = calcularRede(etapas, [dep("a", "b", "II")]);
    expect(iso(r.nos.find((n) => n.id === "b")!.inicioCedo)).toBe("2026-01-10");
  });

  it("TT: as duas terminam juntas", () => {
    const etapas = [etapa("a", "2026-01-01", "2026-01-21"), etapa("b", "2026-01-01", "2026-01-06")];
    const r = calcularRede(etapas, [dep("a", "b", "TT")]);
    const b = r.nos.find((n) => n.id === "b")!;
    expect(iso(b.fimCedo)).toBe("2026-01-21");
    expect(iso(b.inicioCedo)).toBe("2026-01-16"); // 5 dias antes do fim
  });

  it("IT: a sucessora termina quando a predecessora começa", () => {
    const etapas = [etapa("a", "2026-01-20", "2026-01-30"), etapa("b", "2026-01-01", "2026-01-06")];
    const r = calcularRede(etapas, [dep("a", "b", "IT")]);
    expect(iso(r.nos.find((n) => n.id === "b")!.fimCedo)).toBe("2026-01-20");
  });
});

describe("folga na ligação", () => {
  it("folga positiva atrasa a sucessora (cura do concreto)", () => {
    const etapas = [etapa("laje", "2026-01-01", "2026-01-11"), etapa("alv", "2026-01-01", "2026-01-06")];
    const r = calcularRede(etapas, [dep("laje", "alv", "TI", 7)]);
    expect(iso(r.nos.find((n) => n.id === "alv")!.inicioCedo)).toBe("2026-01-18");
  });

  it("folga negativa sobrepõe as etapas", () => {
    const etapas = [etapa("estr", "2026-01-01", "2026-01-21"), etapa("alv", "2026-01-01", "2026-01-11")];
    const r = calcularRede(etapas, [dep("estr", "alv", "TI", -5)]);
    expect(iso(r.nos.find((n) => n.id === "alv")!.inicioCedo)).toBe("2026-01-16");
  });
});

describe("a data prevista é piso", () => {
  it("etapa não é puxada para antes da própria data prevista", () => {
    // A termina em 05/01, mas B só pode começar em 20/01 por contrato.
    const etapas = [etapa("a", "2026-01-01", "2026-01-05"), etapa("b", "2026-01-20", "2026-01-25")];
    const r = calcularRede(etapas, [dep("a", "b")]);
    expect(iso(r.nos.find((n) => n.id === "b")!.inicioCedo)).toBe("2026-01-20");
  });

  it("o deslocamento mostra quanto a dependência empurrou a etapa", () => {
    const etapas = [etapa("a", "2026-01-01", "2026-01-11"), etapa("b", "2026-01-01", "2026-01-06")];
    const r = calcularRede(etapas, [dep("a", "b")]);
    expect(r.nos.find((n) => n.id === "b")!.deslocamentoDias).toBe(10);
  });
});

describe("marcos", () => {
  it("marco tem duração zero e não ocupa prazo", () => {
    const etapas = [
      etapa("obra", "2026-01-01", "2026-01-31"),
      etapa("vistoria", "2026-01-01", "2026-01-01", true),
    ];
    const r = calcularRede(etapas, [dep("obra", "vistoria")]);
    const m = r.nos.find((n) => n.id === "vistoria")!;
    expect(m.duracaoDias).toBe(0);
    expect(iso(m.inicioCedo)).toBe("2026-01-31");
    expect(iso(m.fimCedo)).toBe("2026-01-31");
  });
});

describe("ciclos", () => {
  it("rede com ciclo não calcula nada e nomeia os envolvidos", () => {
    const etapas = [etapa("a", "2026-01-01", "2026-01-05"), etapa("b", "2026-01-01", "2026-01-05")];
    const r = calcularRede(etapas, [dep("a", "b"), dep("b", "a")]);
    expect(r.ciclo.length).toBe(2);
    expect(r.nos).toHaveLength(0);
    expect(r.terminoProjeto).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/Ciclo/);
  });

  it("detecta o ciclo antes de gravar", () => {
    const existentes = [dep("a", "b"), dep("b", "c")];
    expect(criariaCiclo("c", "a", existentes)).toBe(true);  // fecharia a volta
    expect(criariaCiclo("a", "c", existentes)).toBe(false); // atalho, não é ciclo
    expect(criariaCiclo("a", "a", existentes)).toBe(true);  // laço em si mesma
  });
});

describe("robustez", () => {
  it("obra sem etapas devolve resultado vazio", () => {
    const r = calcularRede([], []);
    expect(r.nos).toHaveLength(0);
    expect(r.terminoProjeto).toBeNull();
  });

  it("dependência apontando para etapa apagada é ignorada com aviso", () => {
    const r = calcularRede([etapa("a", "2026-01-01", "2026-01-05")], [dep("a", "fantasma")]);
    expect(r.nos).toHaveLength(1);
    expect(r.avisos.join(" ")).toMatch(/ignorada/);
  });

  it("etapa que termina antes de começar vira duração zero, com aviso", () => {
    const r = calcularRede([etapa("torta", "2026-01-20", "2026-01-10")], []);
    expect(r.nos[0].duracaoDias).toBe(0);
    expect(r.avisos.join(" ")).toMatch(/termina antes/);
  });

  it("devolve as etapas na ordem em que entraram", () => {
    const etapas = [etapa("z", "2026-01-20", "2026-01-25"), etapa("a", "2026-01-01", "2026-01-05")];
    const r = calcularRede(etapas, [dep("a", "z")]);
    expect(r.nos.map((n) => n.id)).toEqual(["z", "a"]);
  });

  it("rede grande em cadeia roda sem estourar", () => {
    const n = 500;
    const etapas = Array.from({ length: n }, (_, i) => etapa("e" + i, "2026-01-01", "2026-01-02"));
    const deps = Array.from({ length: n - 1 }, (_, i) => dep("e" + i, "e" + (i + 1)));
    const r = calcularRede(etapas, deps);
    expect(r.nos).toHaveLength(n);
    expect(r.nos.every((x) => x.ehCritica)).toBe(true);
  });
});

describe("atraso contra a baseline", () => {
  it("conta os dias de diferença", () => {
    expect(atrasoContraBaseline(d("2026-03-10"), d("2026-03-01"))).toBe(9);
    expect(atrasoContraBaseline(d("2026-02-25"), d("2026-03-01"))).toBe(-4);
    expect(atrasoContraBaseline(null, d("2026-03-01"))).toBeNull();
  });
});
