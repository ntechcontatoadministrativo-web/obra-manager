import { describe, it, expect } from "vitest";
import { interpretar, melhorCorrespondencia, reaisFalado } from "../voz";

describe("comandos de voz", () => {
  it("o que falta pagar, com e sem obra", () => {
    expect(interpretar("O que falta pagar?")).toEqual({ tipo: "a_pagar", obra: null, soVencidas: false });
    expect(interpretar("quanto falta pagar da obra Residencial Ipê")).toEqual({ tipo: "a_pagar", obra: "residencial ipe", soVencidas: false });
    expect(interpretar("tem algum pedido que falta pagar")).toMatchObject({ tipo: "a_pagar" });
    expect(interpretar("contas vencidas")).toEqual({ tipo: "a_pagar", obra: null, soVencidas: true });
  });

  it("pix por posição na lista ou por nome", () => {
    expect(interpretar("pix do primeiro")).toEqual({ tipo: "pix", indice: 1, alvo: null });
    expect(interpretar("pega o pix do pedido 3")).toEqual({ tipo: "pix", indice: 3, alvo: null });
    expect(interpretar("Pix da segunda conta")).toEqual({ tipo: "pix", indice: 2, alvo: null });
    expect(interpretar("pix da Casa do Construtor")).toEqual({ tipo: "pix", indice: null, alvo: "casa do construtor" });
    expect(interpretar("me dá o pix")).toEqual({ tipo: "pix", indice: null, alvo: null });
  });

  it("compras para aprovar", () => {
    expect(interpretar("compras para aprovar")).toEqual({ tipo: "compras_pendentes", obra: null });
    expect(interpretar("tem solicitação pendente na obra Centro")).toEqual({ tipo: "compras_pendentes", obra: "centro" });
  });

  it("navegação", () => {
    expect(interpretar("abrir diário da obra Residencial")).toEqual({ tipo: "navegar", destino: "diario", obra: "residencial" });
    expect(interpretar("abre os pagamentos")).toMatchObject({ tipo: "navegar", destino: "pagamentos" });
    expect(interpretar("mostrar o RDO da obra Centro")).toEqual({ tipo: "navegar", destino: "rdo", obra: "centro" });
    expect(interpretar("abrir obra Residencial")).toEqual({ tipo: "navegar", destino: "obra", obra: "residencial" });
  });

  it("ajuda e desconhecido", () => {
    expect(interpretar("ajuda")).toEqual({ tipo: "ajuda" });
    expect(interpretar("bom dia")).toEqual({ tipo: "desconhecido" });
  });

  it("acha a obra pelo nome falado", () => {
    const obras = [{ nome: "Residencial Ipê Amarelo" }, { nome: "Galpão Centro Logístico" }, { nome: "Residencial Ipê" }];
    expect(melhorCorrespondencia("residencial ipe", obras)?.nome).toBe("Residencial Ipê");
    expect(melhorCorrespondencia("centro", obras)?.nome).toBe("Galpão Centro Logístico");
    expect(melhorCorrespondencia("hospital", obras)).toBeNull();
  });

  it("valor falado", () => {
    expect(reaisFalado(1234.5)).toBe("1.234 reais e 50 centavos");
    expect(reaisFalado(1)).toBe("1 real");
  });
});
