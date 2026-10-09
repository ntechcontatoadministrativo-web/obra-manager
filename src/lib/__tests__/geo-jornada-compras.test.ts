import { describe, it, expect } from "vitest";
import { distanciaMetros, dentroDoRaio } from "../geo";
import { horasTrabalhadas, horasExtras } from "../jornada";
import { statusAposAprovacaoAdminObra, transicaoValida, desvioDePreco } from "../compras";

describe("geo", () => {
  it("distância ~0 para o mesmo ponto", () => {
    expect(distanciaMetros(-1.4558, -48.4902, -1.4558, -48.4902)).toBeCloseTo(0, 5);
  });
  it("0,001° de latitude ≈ 111 m", () => {
    expect(distanciaMetros(0, 0, 0.001, 0)).toBeGreaterThan(110);
    expect(distanciaMetros(0, 0, 0.001, 0)).toBeLessThan(112);
  });
  it("valida raio e retorna null sem coordenadas", () => {
    const obra = { lat: -1.4558, lng: -48.4902 };
    expect(dentroDoRaio({ lat: -1.4559, lng: -48.4902 }, obra, 150)).toBe(true);
    expect(dentroDoRaio({ lat: -1.47, lng: -48.4902 }, obra, 150)).toBe(false);
    expect(dentroDoRaio({ lat: null, lng: null }, obra, 150)).toBeNull();
  });
});

describe("jornada", () => {
  const d = (h: number, m = 0) => new Date(2026, 9, 2, h, m);
  it("desconta almoço", () => {
    const p = { entradaEm: d(7), saidaEm: d(17), almocoSaidaEm: d(12), almocoVoltaEm: d(13) };
    expect(horasTrabalhadas(p)).toBe(9);
    expect(horasExtras(p, 8)).toBe(1);
  });
  it("sem saída = 0 horas", () => {
    expect(horasTrabalhadas({ entradaEm: d(7), saidaEm: null })).toBe(0);
  });
  it("sem extras dentro da jornada", () => {
    expect(horasExtras({ entradaEm: d(8), saidaEm: d(16) }, 8)).toBe(0);
  });
});

describe("compras", () => {
  it("acima do limite vai para o Super Admin", () => {
    expect(statusAposAprovacaoAdminObra(6000, 5000)).toBe("AGUARDANDO_SUPER_ADMIN");
    expect(statusAposAprovacaoAdminObra(5000, 5000)).toBe("APROVADA");
  });
  it("não permite pular etapas do fluxo", () => {
    expect(transicaoValida("AGUARDANDO_ADMIN_OBRA", "ENTREGUE")).toBe(false);
    expect(transicaoValida("APROVADA", "PO_EMITIDA")).toBe(true);
    expect(transicaoValida("ENTREGUE", "CANCELADA")).toBe(false);
  });
  it("alerta de desvio de preço", () => {
    expect(desvioDePreco(40, [30, 32, 34], 15).alerta).toBe(true);
    expect(desvioDePreco(33, [30, 32, 34], 15).alerta).toBe(false);
    expect(desvioDePreco(40, [], 15).alerta).toBe(false);
  });
});
