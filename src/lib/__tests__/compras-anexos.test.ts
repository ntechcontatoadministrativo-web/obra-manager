import { describe, it, expect } from "vitest";
import { aceitaAnexo, LIMITE_ANEXOS, pagamentoDaConta, tipoDoAnexo } from "../compras";
import { gerarPix } from "../pix";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("anexos da compra", () => {
  it("reconhece o tipo pelos bytes, não pelo nome", () => {
    expect(tipoDoAnexo(bytes(0x25, 0x50, 0x44, 0x46))).toBe("application/pdf");
    expect(tipoDoAnexo(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(tipoDoAnexo(bytes(0x89, 0x50, 0x4e, 0x47))).toBe("image/png");
    expect(tipoDoAnexo(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });
  it("recusa HTML, SVG e o resto", () => {
    expect(tipoDoAnexo(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(tipoDoAnexo(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(tipoDoAnexo(new Uint8Array())).toBeNull();
  });
  it("até 3 pedidos e 1 boleto; reprovada e cancelada não recebem", () => {
    expect(LIMITE_ANEXOS).toEqual({ PEDIDO: 3, BOLETO: 1 });
    expect(aceitaAnexo("AGUARDANDO_ADMIN_OBRA")).toBe(true);
    expect(aceitaAnexo("ENTREGUE")).toBe(true);
    expect(aceitaAnexo("REPROVADA")).toBe(false);
    expect(aceitaAnexo("CANCELADA")).toBe(false);
  });
});

describe("pagamento da conta gerada na entrega", () => {
  const sem = { meioPagamento: null, pagamentoPix: null, pagamentoLinhaDigitavel: null };

  it("sem escolha: PIX do cadastro do fornecedor", () => {
    expect(pagamentoDaConta(sem, "12.345.678/0001-90")).toEqual({ pixChave: "12.345.678/0001-90", pixCopiaECola: null, linhaDigitavel: null });
  });
  it("PIX com chave informada no pedido vence a do cadastro", () => {
    expect(pagamentoDaConta({ ...sem, meioPagamento: "PIX", pagamentoPix: "loja@exemplo.com" }, "outra")).toEqual({ pixChave: "loja@exemplo.com", pixCopiaECola: null, linhaDigitavel: null });
  });
  it("PIX copia e cola válido vai como código", () => {
    const codigo = gerarPix({ chave: "loja@exemplo.com", valor: 100, nome: "Loja" });
    expect(pagamentoDaConta({ ...sem, meioPagamento: "PIX", pagamentoPix: codigo }, null).pixCopiaECola).toBe(codigo);
  });
  it("boleto: linha digitável e nenhum PIX", () => {
    expect(pagamentoDaConta({ ...sem, meioPagamento: "BOLETO", pagamentoLinhaDigitavel: "123" }, "chave")).toEqual({ pixChave: null, pixCopiaECola: null, linhaDigitavel: "123" });
  });
});
