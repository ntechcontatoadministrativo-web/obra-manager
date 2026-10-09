import { describe, it, expect, beforeAll } from "vitest";
import { criptografar, descriptografar, hashCpf, cpfValido, mascararCpf } from "../crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  process.env.HASH_KEY = "b".repeat(64);
});

describe("crypto", () => {
  it("faz round-trip e gera cifras diferentes (IV aleatório)", () => {
    const a = criptografar("529.982.247-25");
    const b = criptografar("529.982.247-25");
    expect(a).not.toEqual(b);
    expect(descriptografar(a)).toBe("529.982.247-25");
  });

  it("detecta adulteração (GCM)", () => {
    const [v, iv, tag, dados] = criptografar("segredo").split(":");
    const adulterado = [v, iv, tag, Buffer.from("xxxxxxx").toString("base64")].join(":");
    expect(() => descriptografar(adulterado)).toThrow();
    expect(dados).toBeTruthy();
  });

  it("hash do CPF é estável e ignora pontuação", () => {
    expect(hashCpf("529.982.247-25")).toBe(hashCpf("52998224725"));
  });

  it("valida CPF", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("529.982.247-24")).toBe(false);
  });

  it("mascara CPF", () => {
    expect(mascararCpf("52998224725")).toBe("***.982.247-**");
  });

  it("falha com chave ausente", () => {
    const k = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => criptografar("x")).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = k;
  });
});
