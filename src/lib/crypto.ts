/**
 * Criptografia de campos sensíveis (CPF, dados bancários, segredo TOTP).
 * - AES-256-GCM: confidencialidade + integridade (autenticada).
 * - HMAC-SHA256: hash determinístico do CPF, usado só para buscar/garantir
 *   unicidade sem descriptografar a tabela inteira.
 * Formato do texto cifrado: v1:<iv>:<tag>:<dados> (tudo em base64).
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

function chave(nome: "ENCRYPTION_KEY" | "HASH_KEY"): Buffer {
  const hex = process.env[nome];
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${nome} ausente ou inválida: use 32 bytes em hex (openssl rand -hex 32).`);
  }
  return Buffer.from(hex, "hex");
}

export function criptografar(textoPlano: string): string {
  const iv = randomBytes(12); // 96 bits, recomendado para GCM
  const cipher = createCipheriv("aes-256-gcm", chave("ENCRYPTION_KEY"), iv);
  const dados = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), dados.toString("base64")].join(":");
}

export function descriptografar(payload: string): string {
  const [versao, iv, tag, dados] = payload.split(":");
  if (versao !== "v1" || !iv || !tag || !dados) throw new Error("Formato de dado criptografado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", chave("ENCRYPTION_KEY"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dados, "base64")), decipher.final()]).toString("utf8");
}

/** Remove tudo que não for dígito. */
export function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function hashCpf(cpf: string): string {
  return createHmac("sha256", chave("HASH_KEY")).update(normalizarCpf(cpf)).digest("hex");
}

/** Validação dos dígitos verificadores do CPF. */
export function cpfValido(cpf: string): boolean {
  const n = normalizarCpf(cpf);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  const dv = (base: string, pesoInicial: number) => {
    const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(n.slice(0, 9), 10) === Number(n[9]) && dv(n.slice(0, 10), 11) === Number(n[10]);
}

/** Mascara para exibição: ***.456.789-** */
export function mascararCpf(cpf: string): string {
  const n = normalizarCpf(cpf);
  return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`;
}
