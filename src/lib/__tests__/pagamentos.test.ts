import { describe, it, expect } from "vitest";
import { crc16, gerarPix, lerPix, acharPixNoTexto } from "../pix";
import { lerBoleto, vencimentoDoFator, acharBoletoNoTexto, formatarLinha } from "../boleto";
import { extrairDadosDoTexto } from "../documento";
import { situacao, resumoPorObra, ordenarPorVencimento, pixDaConta } from "../pagamentos";
import { statusAoAprovar, numeroOrdem } from "../compras";

describe("pix", () => {
  it("CRC16-CCITT confere com o valor de referência", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("gera e lê de volta: chave, valor, nome e cidade", () => {
    const c = gerarPix({ chave: "11111111000111", valor: 1234.5, nome: "Casa do Construtor Ltda", cidade: "Belém", txid: "OC20260001" });
    const p = lerPix(c)!;
    expect(p.chave).toBe("11111111000111");
    expect(p.valor).toBe(1234.5);
    expect(p.nome).toBe("CASA DO CONSTRUTOR LTDA");
    expect(p.cidade).toBe("BELEM");
    expect(p.txid).toBe("OC20260001");
  });

  it("recusa código adulterado (CRC não confere)", () => {
    const c = gerarPix({ chave: "fornecedor@exemplo.com", valor: 10, nome: "X" });
    expect(lerPix(c.replace("10.00", "99.00"))).toBeNull();
    expect(lerPix("qualquer coisa")).toBeNull();
  });

  it("acha o código no meio de um texto, mesmo quebrado em linhas", () => {
    const c = gerarPix({ chave: "+5591999990000", valor: 50, nome: "Joao" });
    const texto = `Pague com PIX:\n${c.slice(0, 40)}\n${c.slice(40)}\nObrigado`;
    expect(acharPixNoTexto(texto)).toBe(c);
  });
});

// Monta uma linha digitável bancária válida, com os dígitos verificadores, para o teste.
function mod10(n: string) {
  let soma = 0, peso = 2;
  for (let i = n.length - 1; i >= 0; i--) {
    let p = Number(n[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}
function mod11(n: string) {
  let soma = 0, peso = 2;
  for (let i = n.length - 1; i >= 0; i--) { soma += Number(n[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = 11 - (soma % 11);
  return r === 0 || r === 10 || r === 11 ? 1 : r;
}
function linhaBancaria(fator: number, centavos: number) {
  const livre = "1234567890123456789012345";
  const semDv = "3419" + String(fator).padStart(4, "0") + String(centavos).padStart(10, "0") + livre;
  const barras = semDv.slice(0, 4) + mod11(semDv) + semDv.slice(4);
  const c1 = barras.slice(0, 4) + barras.slice(19, 24);
  const c2 = barras.slice(24, 34);
  const c3 = barras.slice(34, 44);
  return { barras, linha: c1 + mod10(c1) + c2 + mod10(c2) + c3 + mod10(c3) + barras[4] + barras.slice(5, 19) };
}

describe("boleto", () => {
  it("fator de vencimento nos dois ciclos (o de 1997 e o reiniciado em 2025)", () => {
    expect(vencimentoDoFator(1000, new Date("2025-03-01"))).toBe("2025-02-22");
    expect(vencimentoDoFator(1000, new Date("2000-07-01"))).toBe("2000-07-03");
    expect(vencimentoDoFator(0)).toBeNull();
  });

  it("lê valor e vencimento da linha digitável e do código de barras", () => {
    const { barras, linha } = linhaBancaria(1000, 345_67);
    const hoje = new Date("2025-02-20");
    for (const entrada of [linha, formatarLinha(linha), barras]) {
      const b = lerBoleto(entrada, hoje)!;
      expect(b.tipo).toBe("bancario");
      expect(b.valor).toBe(345.67);
      expect(b.vencimento).toBe("2025-02-22");
      expect(b.codigoBarras).toBe(barras);
    }
  });

  it("recusa linha com dígito trocado", () => {
    const { linha } = linhaBancaria(1500, 1000_00);
    const errada = linha.slice(0, 40) + ((Number(linha[40]) + 1) % 10) + linha.slice(41);
    expect(lerBoleto(errada)).toBeNull();
  });

  it("conta de consumo (começa com 8): valor sem vencimento", () => {
    const barras = "8" + "2" + "6" + "0" + String(98_76).padStart(11, "0") + "0".repeat(29);
    const b = lerBoleto(barras)!;
    expect(b.tipo).toBe("arrecadacao");
    expect(b.valor).toBe(98.76);
    expect(b.vencimento).toBeNull();
  });

  it("acha a linha impressa no meio do texto do PDF", () => {
    const { linha } = linhaBancaria(1200, 250_00);
    const texto = `Banco Itaú\nLinha digitável: ${formatarLinha(linha)}\nPagável em qualquer banco`;
    expect(acharBoletoNoTexto(texto, new Date("2025-08-01"))?.valor).toBe(250);
  });
});

describe("leitura de documento", () => {
  it("nota fiscal: valor, vencimento e favorecido pelos rótulos", () => {
    const texto = [
      "DANFE - Documento Auxiliar da Nota Fiscal",
      "Razão Social: Madeireira Rio Guamá Ltda   CNPJ 22.333.444/0001-55",
      "Fatura: Duplicata 001 Vencimento: 15/11/2026",
      "Valor total da nota R$ 8.450,90",
    ].join("\n");
    const d = extrairDadosDoTexto(texto);
    expect(d.valor).toBe(8450.9);
    expect(d.vencimento).toBe("2026-11-15");
    expect(d.favorecido).toBe("Madeireira Rio Guamá Ltda");
    expect(d.cnpj).toBe("22.333.444/0001-55");
  });

  it("PIX no documento manda no valor e traz a chave", () => {
    const pix = gerarPix({ chave: "financeiro@areia.com.br", valor: 1980, nome: "Areial Bom Jesus" });
    const d = extrairDadosDoTexto(`Total a pagar R$ 2.000,00\nPIX copia e cola: ${pix}`);
    expect(d.valor).toBe(1980);
    expect(d.pixChave).toBe("financeiro@areia.com.br");
    expect(d.pixCopiaECola).toBe(pix);
  });

  it("linha digitável com verificador errado não vira valor: vale o rótulo", () => {
    // Texto real extraído de um PDF de teste; a linha foi digitada sem os verificadores certos.
    const texto = "Beneficiario: Casa do Construtor Ltda\nVencimento: 30/11/2026\nValor do documento R$ 4.520,00\nLinha digitavel: 34191.23456 67890.123456 78901.234567 1 00000000452000";
    const d = extrairDadosDoTexto(texto, new Date("2026-10-21"));
    expect(d.valor).toBe(4520);
    expect(d.vencimento).toBe("2026-11-30");
    expect(d.linhaDigitavel).toBeNull();
    expect(d.cnpj).toBeNull();
  });

  it("CNPJ só formatado ou depois do rótulo", () => {
    expect(extrairDadosDoTexto("CNPJ: 22333444000155").cnpj).toBe("22333444000155");
    expect(extrairDadosDoTexto("Documento 22333444000155").cnpj).toBeNull();
  });

  it("sem rótulo, fica com o maior valor em R$ e avisa para conferir", () => {
    const d = extrairDadosDoTexto("Areia R$ 300,00\nBrita R$ 1.150,00\nFrete R$ 80,00");
    expect(d.valor).toBe(1150);
    expect(d.achados.join(" ")).toMatch(/confira/);
  });
});

describe("contas a pagar", () => {
  it("situação pela data", () => {
    expect(situacao("2026-10-20", null, "2026-10-21")).toBe("vencida");
    expect(situacao("2026-10-21", null, "2026-10-21")).toBe("vence_hoje");
    expect(situacao("2026-10-30", null, "2026-10-21")).toBe("a_vencer");
    expect(situacao(null, null, "2026-10-21")).toBe("sem_vencimento");
    expect(situacao("2026-10-01", "2026-10-02", "2026-10-21")).toBe("paga");
  });

  it("resumo por obra: total, vencido e próximo vencimento", () => {
    const r = resumoPorObra([
      { obraId: "a", valor: 100, vencimento: "2026-10-10" },
      { obraId: "a", valor: 50, vencimento: "2026-10-25" },
      { obraId: "a", valor: 20, vencimento: "2026-10-22" },
      { obraId: "b", valor: 70, vencimento: null },
    ], "2026-10-21");
    expect(r.get("a")).toEqual({ aPagar: 170, vencido: 100, quantidade: 3, proximo: "2026-10-22" });
    expect(r.get("b")).toEqual({ aPagar: 70, vencido: 0, quantidade: 1, proximo: null });
  });

  it("ordena por vencimento com as sem data no fim", () => {
    const o = ordenarPorVencimento([{ vencimento: null }, { vencimento: "2026-11-01" }, { vencimento: "2026-10-01" }]);
    expect(o.map((c) => c.vencimento)).toEqual(["2026-10-01", "2026-11-01", null]);
  });

  it("PIX da conta: usa o código do documento ou gera pela chave com o valor", () => {
    expect(pixDaConta({ pixCopiaECola: "codigo-do-boleto", pixChave: "x", valor: 1, favorecido: "F", id: "c1" })).toBe("codigo-do-boleto");
    const gerado = pixDaConta({ pixCopiaECola: null, pixChave: "11111111000111", valor: 99.9, favorecido: "Casa", id: "c1" })!;
    expect(lerPix(gerado)?.valor).toBe(99.9);
    expect(pixDaConta({ pixCopiaECola: null, pixChave: null, valor: 1, favorecido: "F", id: "c1" })).toBeNull();
  });
});

describe("aprovação de compras", () => {
  it("engenheiro aprova até o limite; acima, sobe para o dono", () => {
    expect(statusAoAprovar("ADMIN_OBRA", "AGUARDANDO_ADMIN_OBRA", 4000, 5000)).toBe("APROVADA");
    expect(statusAoAprovar("ADMIN_OBRA", "AGUARDANDO_ADMIN_OBRA", 6000, 5000)).toBe("AGUARDANDO_SUPER_ADMIN");
    expect(statusAoAprovar("ADMIN_OBRA", "AGUARDANDO_SUPER_ADMIN", 6000, 5000)).toBeNull();
  });
  it("dono aprova em qualquer fase; encarregado nunca", () => {
    expect(statusAoAprovar("SUPER_ADMIN", "AGUARDANDO_ADMIN_OBRA", 90000, 5000)).toBe("APROVADA");
    expect(statusAoAprovar("SUPER_ADMIN", "AGUARDANDO_SUPER_ADMIN", 90000, 5000)).toBe("APROVADA");
    expect(statusAoAprovar("ENCARREGADO", "AGUARDANDO_ADMIN_OBRA", 10, 5000)).toBeNull();
    expect(statusAoAprovar("SUPER_ADMIN", "ENTREGUE", 10, 5000)).toBeNull();
  });
  it("número da ordem", () => {
    expect(numeroOrdem(2026, 7)).toBe("OC-2026-0007");
  });
});
