import { describe, it, expect } from "vitest";
import { climaDoCodigoWMO, impactoSugerido, interpretarOpenMeteo } from "../clima";
import { pendenciasConclusao, diasSemDiario, ehDiaDeTrabalho, somarDias } from "../diario";

describe("clima", () => {
  it("traduz códigos WMO", () => {
    expect(climaDoCodigoWMO(0)).toBe("ENSOLARADO");
    expect(climaDoCodigoWMO(2)).toBe("ENSOLARADO");
    expect(climaDoCodigoWMO(3)).toBe("NUBLADO");
    expect(climaDoCodigoWMO(61)).toBe("CHUVOSO");
    expect(climaDoCodigoWMO(81)).toBe("CHUVOSO");
    expect(climaDoCodigoWMO(95)).toBe("TEMPESTADE");
  });
  it("sugere impacto pela chuva", () => {
    expect(impactoSugerido(0, "ENSOLARADO")).toBe("SEM_IMPACTO");
    expect(impactoSugerido(10, "CHUVOSO")).toBe("PRODUCAO_REDUZIDA");
    expect(impactoSugerido(40, "CHUVOSO")).toBe("PARALISACAO_PARCIAL");
    expect(impactoSugerido(0, "TEMPESTADE")).toBe("PRODUCAO_REDUZIDA");
  });
  it("interpreta a resposta e rejeita lixo", () => {
    const r = interpretarOpenMeteo({ daily: { weather_code: [63], temperature_2m_max: [29.6], precipitation_sum: [12.34] } });
    expect(r).toMatchObject({ clima: "CHUVOSO", temperaturaC: 30, chuvaMm: 12.3, impacto: "PRODUCAO_REDUZIDA" });
    expect(interpretarOpenMeteo({})).toBeNull();
    expect(interpretarOpenMeteo({ daily: { weather_code: ["x"] } })).toBeNull();
  });
});

const ok = { descricao: "Concretagem da laje do primeiro pavimento concluída.", temperaturaC: 31, impactoClima: "SEM_IMPACTO" as const, obsClima: "", pessoas: 8, atividades: 2, fotos: 3 };

describe("pendenciasConclusao", () => {
  it("diário completo não tem pendências", () => expect(pendenciasConclusao(ok)).toEqual([]));
  it("lista cada falta", () => {
    const p = pendenciasConclusao({ ...ok, descricao: "curto", temperaturaC: null, pessoas: 0, atividades: 0, fotos: 1 });
    expect(p).toHaveLength(5);
  });
  it("tempo que afetou a obra exige explicação", () => {
    expect(pendenciasConclusao({ ...ok, impactoClima: "PRODUCAO_REDUZIDA" })).toHaveLength(1);
    expect(pendenciasConclusao({ ...ok, impactoClima: "PRODUCAO_REDUZIDA", obsClima: "Chuva forte à tarde" })).toEqual([]);
  });
  it("paralisação total dispensa equipe e atividades, mas pede explicação e 1 foto", () => {
    const parado = { ...ok, impactoClima: "PARALISACAO_TOTAL" as const, pessoas: 0, atividades: 0, fotos: 1, obsClima: "Tempestade o dia todo" };
    expect(pendenciasConclusao(parado)).toEqual([]);
    expect(pendenciasConclusao({ ...parado, fotos: 0 })).toHaveLength(1);
  });
});

describe("dias sem diário", () => {
  it("fim de semana", () => {
    expect(ehDiaDeTrabalho("2026-10-10", 5)).toBe(false); // sábado
    expect(ehDiaDeTrabalho("2026-10-10", 6)).toBe(true);
    expect(ehDiaDeTrabalho("2026-10-11", 6)).toBe(false); // domingo
  });
  it("lista só dias úteis sem diário e respeita o início da obra", () => {
    // 2026-10-07 é quarta-feira
    const r = diasSemDiario({ hoje: "2026-10-07", inicio: "2026-10-05", concluidos: new Set(["2026-10-06"]), diasPorSemana: 5, janela: 14 });
    expect(r).toEqual(["2026-10-07", "2026-10-05"]);
  });
  it("somarDias atravessa o mês", () => expect(somarDias("2026-10-01", -1)).toBe("2026-09-30"));
});
