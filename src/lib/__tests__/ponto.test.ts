import { describe, it, expect } from "vitest";
import { acoesPermitidas, dataLocalISO, dataParaBanco, validarFoto, dataISOValida } from "../ponto";

const d = (h: number) => new Date(2026, 9, 6, h);
const vazio = { entradaEm: null, almocoSaidaEm: null, almocoVoltaEm: null, saidaEm: null };

describe("acoesPermitidas", () => {
  it("fluxo completo do dia", () => {
    expect(acoesPermitidas(null)).toEqual(["ENTRADA"]);
    expect(acoesPermitidas(vazio)).toEqual(["ENTRADA"]);
    expect(acoesPermitidas({ ...vazio, entradaEm: d(7) })).toEqual(["ALMOCO_SAIDA", "SAIDA"]);
    expect(acoesPermitidas({ ...vazio, entradaEm: d(7), almocoSaidaEm: d(12) })).toEqual(["ALMOCO_VOLTA"]);
    expect(acoesPermitidas({ ...vazio, entradaEm: d(7), almocoSaidaEm: d(12), almocoVoltaEm: d(13) })).toEqual(["SAIDA"]);
    expect(acoesPermitidas({ ...vazio, entradaEm: d(7), saidaEm: d(16) })).toEqual([]);
  });
});

describe("datas no fuso de Belém (UTC-3)", () => {
  it("23h30 em Belém ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC", () => {
    expect(dataLocalISO(new Date("2026-10-07T02:30:00Z"))).toBe("2026-10-06");
  });
  it("02h em UTC cai no dia anterior em Belém; 03h já é o dia novo", () => {
    expect(dataLocalISO(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-07");
  });
  it("converte para a coluna de data", () => {
    expect(dataParaBanco("2026-10-06").toISOString()).toBe("2026-10-06T00:00:00.000Z");
    expect(dataISOValida("2026-13-45")).toBe(false);
    expect(dataISOValida("2026-10-06")).toBe(true);
  });
});

describe("validarFoto", () => {
  const jpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
  it("aceita JPEG pequeno", () => expect(validarFoto(jpeg).ok).toBe(true));
  it("recusa tipos e conteúdos errados", () => {
    expect(validarFoto("data:image/png;base64,AAAA").ok).toBe(false);
    expect(validarFoto("data:image/jpeg;base64," + Buffer.from("not a jpeg").toString("base64")).ok).toBe(false);
    expect(validarFoto(undefined).ok).toBe(false);
    expect(validarFoto("<script>").ok).toBe(false);
  });
  it("recusa foto grande demais", () => {
    const grande = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(300 * 1024)]).toString("base64");
    expect(validarFoto(grande).ok).toBe(false);
  });
});
