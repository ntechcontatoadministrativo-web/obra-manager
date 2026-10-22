/**
 * PIX "copia e cola" (BR Code, padrão EMV-MPM do Banco Central).
 *
 * O código é uma sequência de campos ID(2) + TAMANHO(2) + VALOR, terminada
 * pelo CRC16 (campo 63). Daqui saem duas coisas para o módulo de
 * pagamentos: ler um código que veio num boleto ou nota (valor, chave,
 * nome) e gerar um código a partir da chave do fornecedor, já com o valor
 * da conta, para o banco preencher tudo sozinho.
 */

export type DadosPix = {
  chave: string | null;
  /** Pix dinâmico: o banco busca os dados nesta URL. */
  url: string | null;
  valor: number | null;
  nome: string | null;
  cidade: string | null;
  txid: string | null;
};

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF), como exige o BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function campos(texto: string): Map<string, string> | null {
  const m = new Map<string, string>();
  let i = 0;
  while (i < texto.length) {
    const id = texto.slice(i, i + 2);
    const tam = Number(texto.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(tam) || i + 4 + tam > texto.length) return null;
    m.set(id, texto.slice(i + 4, i + 4 + tam));
    i += 4 + tam;
  }
  return m;
}

/** Lê um código PIX. Devolve null se não for um BR Code válido (CRC confere). */
export function lerPix(codigo: string): DadosPix | null {
  const t = codigo.trim();
  if (!t.startsWith("000201") || t.length < 30) return null;
  const crc = t.slice(-4).toUpperCase();
  if (t.slice(-8, -4) !== "6304" || crc16(t.slice(0, -4)) !== crc) return null;

  const top = campos(t);
  if (!top) return null;

  // Conta do recebedor: pode vir em qualquer campo de 26 a 51; o do PIX tem o GUI br.gov.bcb.pix.
  let chave: string | null = null, url: string | null = null;
  for (let id = 26; id <= 51; id++) {
    const sub = top.get(String(id));
    if (!sub) continue;
    const c = campos(sub);
    if (!c || c.get("00")?.toLowerCase() !== "br.gov.bcb.pix") continue;
    chave = c.get("01") ?? null;
    url = c.get("25") ?? null;
    break;
  }
  if (!chave && !url) return null;

  const valorTxt = top.get("54");
  const adicional = top.get("62") ? campos(top.get("62")!) : null;
  return {
    chave, url,
    valor: valorTxt && /^\d+(\.\d{1,2})?$/.test(valorTxt) ? Number(valorTxt) : null,
    nome: top.get("59") ?? null,
    cidade: top.get("60") ?? null,
    txid: adicional?.get("05") ?? null,
  };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Nome e cidade no BR Code: sem acento, só caracteres seguros, com limite de tamanho. */
const limpo = (s: string, max: number) =>
  semAcento(s).replace(/[^A-Za-z0-9 .\-]/g, "").replace(/\s+/g, " ").trim().slice(0, max).toUpperCase();

const campo = (id: string, valor: string) => id + String(valor.length).padStart(2, "0") + valor;

/**
 * Gera o "copia e cola" de um PIX estático com valor.
 * A chave vai como foi cadastrada; telefone precisa estar no formato +55DDDNÚMERO.
 */
export function gerarPix(o: { chave: string; valor: number; nome: string; cidade?: string; txid?: string; descricao?: string }): string {
  const chave = o.chave.trim();
  if (!chave) throw new Error("Chave PIX vazia.");
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave) +
    (o.descricao ? campo("02", limpo(o.descricao, 40)) : "");
  const txid = (o.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (o.valor > 0 ? campo("54", o.valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpo(o.nome, 25) || "RECEBEDOR") +
    campo("60", limpo(o.cidade ?? "BRASIL", 15) || "BRASIL") +
    campo("62", campo("05", txid === "" ? "***" : txid)) +
    "6304";
  return corpo + crc16(corpo);
}

/** Procura um BR Code dentro de um texto qualquer (PDF, OCR, colado). */
export function acharPixNoTexto(texto: string): string | null {
  // Quebras de linha no meio do código são comuns em PDF: tenta com e sem elas.
  for (const fonte of [texto, texto.replace(/\s*\n\s*/g, "")]) {
    const m = fonte.match(/000201[\s\S]*?6304[0-9A-Fa-f]{4}/g) ?? [];
    for (const c of m) if (lerPix(c)) return c;
  }
  return null;
}
