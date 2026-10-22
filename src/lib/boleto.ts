/**
 * Boleto: valor e vencimento lidos da linha digitável ou do código de barras.
 *
 * Dois formatos:
 * - Bancário: 47 dígitos na linha, 44 no código. O valor e o "fator de
 *   vencimento" estão dentro do código.
 * - Arrecadação/convênio (contas de água, luz, tributos): começa com 8,
 *   48 dígitos na linha. Tem valor, mas não tem vencimento padronizado.
 */

export type DadosBoleto = {
  tipo: "bancario" | "arrecadacao";
  /** Os 44 dígitos do código de barras. */
  codigoBarras: string;
  /** A linha como veio (só dígitos). */
  linha: string;
  valor: number | null;
  /** AAAA-MM-DD, quando o boleto informa. */
  vencimento: string | null;
};

const BASE_1997 = Date.UTC(1997, 9, 7);
// Em 22/02/2025 o fator chegou a 9999 e voltou a 1000: nova base = 22/02/2025 − 1000 dias.
const BASE_2022 = Date.UTC(2022, 4, 29);
const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Converte o fator de vencimento na data, escolhendo o ciclo mais perto de `hoje`. */
export function vencimentoDoFator(fator: number, hoje: Date = new Date()): string | null {
  if (!fator) return null;
  const candidatos = [BASE_1997 + fator * DIA, BASE_2022 + fator * DIA];
  const t = hoje.getTime();
  candidatos.sort((a, b) => Math.abs(a - t) - Math.abs(b - t));
  return iso(candidatos[0]);
}

function dvModulo11Bancario(codigo43: string): number {
  let soma = 0, peso = 2;
  for (let i = codigo43.length - 1; i >= 0; i--) {
    soma += Number(codigo43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = 11 - (soma % 11);
  return r === 0 || r === 10 || r === 11 ? 1 : r;
}

/** Dígito verificador módulo 10 (pesos 2,1,2,1… da direita), usado nos campos da linha. */
function dvModulo10(n: string): number {
  let soma = 0, peso = 2;
  for (let i = n.length - 1; i >= 0; i--) {
    let p = Number(n[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** Dígito verificador módulo 11 das contas de consumo (pesos 2 a 9). */
function dvModulo11Arrecadacao(n: string): number {
  let soma = 0, peso = 2;
  for (let i = n.length - 1; i >= 0; i--) { soma += Number(n[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return r === 0 || r === 1 ? 0 : 11 - r;
}

/** Os três primeiros campos da linha bancária têm, cada um, o seu dígito verificador. */
function camposBancariosValidos(l: string): boolean {
  return [[0, 9], [10, 20], [21, 31]].every(([i, f]) => dvModulo10(l.slice(i, f)) === Number(l[f]));
}

/** Cada bloco de 11 dígitos da conta de consumo termina num verificador (mód. 10 ou 11, pelo 3º dígito). */
function blocosArrecadacaoValidos(l: string): boolean {
  const dv = l[2] === "6" || l[2] === "7" ? dvModulo10 : dvModulo11Arrecadacao;
  return [0, 12, 24, 36].every((i) => dv(l.slice(i, i + 11)) === Number(l[i + 11]));
}

/** Monta o código de barras (44) a partir da linha digitável bancária (47). */
function barrasDaLinhaBancaria(l: string): string {
  return l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
}

function lerBancario(barras: string, linha: string, hoje: Date): DadosBoleto | null {
  const dv = Number(barras[4]);
  if (dvModulo11Bancario(barras.slice(0, 4) + barras.slice(5)) !== dv) return null;
  const fator = Number(barras.slice(5, 9));
  const centavos = Number(barras.slice(9, 19));
  return {
    tipo: "bancario", codigoBarras: barras, linha,
    valor: centavos > 0 ? centavos / 100 : null,
    vencimento: vencimentoDoFator(fator, hoje),
  };
}

function lerArrecadacao(barras: string, linha: string): DadosBoleto {
  // 3º dígito: 6 ou 7 = valor efetivo em reais; 8 ou 9 = valor de referência (não é dinheiro).
  const emReais = barras[2] === "6" || barras[2] === "7";
  const centavos = Number(barras.slice(4, 15));
  return { tipo: "arrecadacao", codigoBarras: barras, linha, valor: emReais && centavos > 0 ? centavos / 100 : null, vencimento: null };
}

/** Lê linha digitável (47 ou 48 dígitos) ou código de barras (44). Aceita pontos e espaços. */
export function lerBoleto(entrada: string, hoje: Date = new Date()): DadosBoleto | null {
  const d = entrada.replace(/\D/g, "");
  if (d.length === 47) return camposBancariosValidos(d) ? lerBancario(barrasDaLinhaBancaria(d), d, hoje) : null;
  if (d.length === 48 && d[0] === "8") {
    if (!blocosArrecadacaoValidos(d)) return null;
    // Quatro blocos de 11 dígitos + 1 dígito verificador cada.
    const barras = [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join("");
    return lerArrecadacao(barras, d);
  }
  if (d.length === 44) return d[0] === "8" ? lerArrecadacao(d, d) : lerBancario(d, d, hoje);
  return null;
}

/** Procura uma linha digitável ou código de barras dentro de um texto. */
export function acharBoletoNoTexto(texto: string, hoje: Date = new Date()): DadosBoleto | null {
  // Blocos de dígitos separados por ponto/espaço, como a linha aparece impressa.
  const trechos = texto.match(/\d[\d.\s-]{42,70}\d/g) ?? [];
  for (const t of trechos) {
    const digitos = t.replace(/\D/g, "");
    const exato = lerBoleto(digitos, hoje);
    if (exato?.valor != null) return exato;
    // Trecho com dígitos sobrando em volta (número de documento colado na linha):
    // só vale a linha digitável, que tem um verificador por campo. Código de barras
    // solto (44) num pedaço maior acerta o verificador por acaso 1 vez em 11.
    for (const tamanho of [48, 47]) {
      for (let i = 0; i + tamanho <= digitos.length; i++) {
        const r = lerBoleto(digitos.slice(i, i + tamanho), hoje);
        if (r?.valor != null) return r;
      }
    }
  }
  return null;
}

/** Linha digitável formatada para leitura: 00000.00000 00000.000000 00000.000000 0 00000000000000 */
export function formatarLinha(linha: string): string {
  const d = linha.replace(/\D/g, "");
  if (d.length !== 47) return d;
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
}
