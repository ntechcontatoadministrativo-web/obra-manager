import { acharPixNoTexto, lerPix } from "./pix";
import { acharBoletoNoTexto } from "./boleto";
import { parseNumeroBR } from "./utils";

/**
 * Leitura de uma conta a pagar a partir do texto de um documento (boleto,
 * nota fiscal, orçamento, recibo) — o texto vem do PDF, de um QR code lido
 * pela câmera ou colado à mão.
 *
 * Sem inteligência artificial: o que tem formato fixo (PIX, linha
 * digitável) é lido com certeza; o resto é procurado pelos rótulos que
 * esses documentos usam. A tela sempre mostra o resultado para a pessoa
 * conferir antes de salvar.
 */

export type DadosDocumento = {
  valor: number | null;
  vencimento: string | null;
  favorecido: string | null;
  cnpj: string | null;
  pixCopiaECola: string | null;
  pixChave: string | null;
  linhaDigitavel: string | null;
  /** O que foi encontrado e de onde, para a tela explicar. */
  achados: string[];
};

const DINHEIRO = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/;

/** Rótulos de valor em ordem de confiança: o primeiro que aparecer ganha. */
const ROTULOS_VALOR = [
  /valor\s+(?:total\s+)?(?:a\s+pagar|cobrado)/i,
  /total\s+a\s+pagar/i,
  /valor\s+do\s+documento/i,
  /valor\s+total\s+da\s+nota/i,
  /valor\s+total/i,
  /total\s+geral/i,
  /\btotal\b/i,
  /\bvalor\b/i,
];

function valorRotulado(texto: string): number | null {
  for (const rotulo of ROTULOS_VALOR) {
    const re = new RegExp(rotulo.source + String.raw`[^\d\n]{0,25}` + DINHEIRO.source, "i");
    const m = texto.match(re);
    if (m) {
      const v = parseNumeroBR(m[1]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return null;
}

function maiorValorEmReais(texto: string): number | null {
  const valores = [...texto.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)]
    .map((m) => parseNumeroBR(m[1]))
    .filter((v) => Number.isFinite(v) && v > 0);
  return valores.length ? Math.max(...valores) : null;
}

function dataBRparaISO(d: string): string | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

function vencimentoRotulado(texto: string): string | null {
  const m = texto.match(/venc\w*[^\d\n]{0,25}(\d{2}\/\d{2}\/\d{4})/i);
  return m ? dataBRparaISO(m[1]) : null;
}

function favorecidoRotulado(texto: string): string | null {
  const m = texto.match(/(?:benefici[aá]rio|cedente|favorecido|raz[aã]o\s+social|emitente|fornecedor)\s*[:\-]?\s*([^\n]{3,80})/i);
  if (!m) return null;
  // Corta o que costuma vir grudado na mesma linha (CNPJ, agência, endereço).
  const nome = m[1].split(/\s{2,}|\bCNPJ\b|\bCPF\b|\bAg[eê]ncia\b|\d{2}\.\d{3}\.\d{3}/i)[0].trim().replace(/[,;:\-]+$/, "");
  return nome.length >= 3 ? nome.slice(0, 80) : null;
}

// Formatado, ou só dígitos logo depois do rótulo: 14 dígitos soltos são, quase sempre, parte do boleto.
const CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|(?<=CNPJ[:\s]{1,3})\d{14}\b/i;

export function extrairDadosDoTexto(texto: string, hoje: Date = new Date()): DadosDocumento {
  const achados: string[] = [];
  const r: DadosDocumento = {
    valor: null, vencimento: null, favorecido: null, cnpj: null,
    pixCopiaECola: null, pixChave: null, linhaDigitavel: null, achados,
  };

  const pix = acharPixNoTexto(texto);
  if (pix) {
    const p = lerPix(pix)!;
    r.pixCopiaECola = pix;
    r.pixChave = p.chave;
    if (p.valor) { r.valor = p.valor; achados.push("valor do código PIX"); }
    if (p.nome) r.favorecido = p.nome;
    achados.push("código PIX copia e cola");
  }

  const boleto = acharBoletoNoTexto(texto, hoje);
  if (boleto) {
    r.linhaDigitavel = boleto.linha;
    achados.push(boleto.tipo === "bancario" ? "linha digitável do boleto" : "código de conta de consumo/tributo");
    if (r.valor == null && boleto.valor != null) { r.valor = boleto.valor; achados.push("valor do boleto"); }
    if (boleto.vencimento) { r.vencimento = boleto.vencimento; achados.push("vencimento do boleto"); }
  }

  if (r.valor == null) {
    const v = valorRotulado(texto);
    if (v != null) { r.valor = v; achados.push("valor pelo rótulo do documento"); }
    else {
      const maior = maiorValorEmReais(texto);
      if (maior != null) { r.valor = maior; achados.push("maior valor em R$ do documento (confira)"); }
    }
  }
  if (!r.vencimento) {
    const v = vencimentoRotulado(texto);
    if (v) { r.vencimento = v; achados.push("vencimento pelo rótulo do documento"); }
  }
  const fav = favorecidoRotulado(texto);
  if (fav) r.favorecido = fav; // o rótulo do documento é mais completo que o nome curto do PIX
  const cnpj = texto.match(CNPJ);
  if (cnpj) r.cnpj = cnpj[0];

  return r;
}
