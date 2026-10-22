/**
 * Comandos de voz: o que a pessoa falou → o que o sistema deve fazer.
 *
 * O reconhecimento (fala → texto) é do navegador. Aqui só se interpreta o
 * texto, por regras, sem modelo de IA: assim o comando funciona sempre,
 * é previsível e pode ser testado. Frases que não casam com nada viram
 * "desconhecido" e a tela sugere dizer "ajuda".
 */

export type Destino =
  | "painel" | "obras" | "pagamentos" | "fornecedores" | "comparar"
  | "obra" | "ponto" | "diario" | "rdo" | "etapas" | "medicoes" | "analise" | "riscos" | "compras";

export type Comando =
  | { tipo: "ajuda" }
  | { tipo: "a_pagar"; obra: string | null; soVencidas: boolean }
  | { tipo: "pix"; indice: number | null; alvo: string | null }
  | { tipo: "compras_pendentes"; obra: string | null }
  | { tipo: "navegar"; destino: Destino; obra: string | null }
  | { tipo: "desconhecido" };

export const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const ORDINAIS: Record<string, number> = {
  primeiro: 1, primeira: 1, um: 1, uma: 1,
  segundo: 2, segunda: 2, dois: 2, duas: 2,
  terceiro: 3, terceira: 3, tres: 3,
  quarto: 4, quarta: 4, quatro: 4,
  quinto: 5, quinta: 5, cinco: 5,
  sexto: 6, sexta: 6, seis: 6,
  setimo: 7, setima: 7, sete: 7,
  oitavo: 8, oitava: 8, oito: 8,
  nono: 9, nona: 9, nove: 9,
  decimo: 10, decima: 10, dez: 10,
};

/** "pix do segundo", "pix do pedido 3", "pix número dois" → 2, 3, 2. */
function indiceFalado(t: string): number | null {
  const num = t.match(/\b(?:numero|item|pedido|conta|n)?\s*(\d{1,2})\b/);
  if (num) return Number(num[1]);
  for (const palavra of t.split(" ")) if (ORDINAIS[palavra]) return ORDINAIS[palavra];
  return null;
}

/** O que vem depois de "da obra", "do", "de" etc. */
function obraFalada(t: string): string | null {
  const m = t.match(/\b(?:da obra|na obra|obra)\s+(.+)$/);
  if (m) return m[1].trim() || null;
  return null;
}

const MODULOS: [RegExp, Destino][] = [
  [/\b(rdo|relatorio diario)\b/, "rdo"],
  [/\bdiario\b/, "diario"],
  [/\bponto\b/, "ponto"],
  [/\b(etapa|etapas|cronograma|gantt)\b/, "etapas"],
  [/\b(medicao|medicoes|boletim)\b/, "medicoes"],
  [/\b(analise|curva s|valor agregado)\b/, "analise"],
  [/\b(risco|riscos)\b/, "riscos"],
  [/\b(compra|compras|pedidos de compra)\b/, "compras"],
  [/\b(pagamento|pagamentos|contas)\b/, "pagamentos"],
  [/\b(fornecedor|fornecedores)\b/, "fornecedores"],
  [/\b(comparar|comparativo)\b/, "comparar"],
  [/\b(painel|inicio|dashboard)\b/, "painel"],
  [/\bobras\b/, "obras"],
];

export function interpretar(falado: string): Comando {
  const t = normalizar(falado);
  if (!t) return { tipo: "desconhecido" };

  if (/\b(ajuda|comandos)\b|o que (voce )?(sabe|pode) fazer/.test(t)) return { tipo: "ajuda" };

  if (/\bpix\b|copia e cola/.test(t)) {
    const indice = indiceFalado(t);
    // "pix da casa do construtor": o nome vem depois de do/da/de (e não é um número).
    const alvo = indice == null ? t.replace(/.*\bpix\b\s*/, "").replace(/^(do|da|de|para|pro|pra)\s+/, "").replace(/^(pedido|conta|fornecedor)\s+/, "").trim() : null;
    return { tipo: "pix", indice, alvo: alvo || null };
  }

  const falaDePagar = /\b(pagar|pagamento|pagamentos|contas?|boleto|boletos)\b/.test(t);
  if (falaDePagar && /\b(falta|faltam|pendente|pendentes|aberto|aberta|abertas|vencid\w*|atrasad\w*|tenho|tem|preciso|precisa|quanto|quais|qual|devo|devendo)\b/.test(t)) {
    return { tipo: "a_pagar", obra: obraFalada(t), soVencidas: /\b(vencid\w*|atrasad\w*)\b/.test(t) };
  }

  if (/\b(compra|compras|pedido|pedidos|solicitac\w*)\b/.test(t) && /\b(aprovar|aprovacao|aprova|pendente|pendentes|aguardando|falta)\b/.test(t)) {
    return { tipo: "compras_pendentes", obra: obraFalada(t) };
  }

  if (/^(abrir|abre|abra|ir|vai|va|vamos|mostrar|mostra|mostre|ver|entrar|entra)\b/.test(t) || /\b(abrir|abre|abra|mostra|mostrar)\b/.test(t)) {
    const resto = t.replace(/^(abrir|abre|abra|ir para|ir pra|vai para|vai pra|va para|va pra|vamos para|mostrar|mostra|mostre|ver|entrar em|entra em|entrar|entra)\s*/, "");
    const obra = obraFalada(resto);
    for (const [re, destino] of MODULOS) {
      if (re.test(resto)) return { tipo: "navegar", destino, obra };
    }
    if (obra) return { tipo: "navegar", destino: "obra", obra };
  }

  return { tipo: "desconhecido" };
}

/**
 * Melhor correspondência de um nome falado (obra, fornecedor) numa lista.
 * Conta palavras em comum, ignorando as curtas; empate fica com o nome mais curto.
 */
export function melhorCorrespondencia<T extends { nome: string }>(falado: string, opcoes: T[]): T | null {
  const alvo = normalizar(falado).split(" ").filter((p) => p.length > 2);
  if (!alvo.length) return null;
  let melhor: T | null = null, pontos = 0;
  for (const o of opcoes) {
    const nome = normalizar(o.nome);
    const palavras = new Set(nome.split(" "));
    let p = 0;
    for (const a of alvo) {
      if (palavras.has(a)) p += 2;
      else if (nome.includes(a)) p += 1;
    }
    if (p > pontos || (p === pontos && p > 0 && melhor && o.nome.length < melhor.nome.length)) { melhor = o; pontos = p; }
  }
  return pontos > 0 ? melhor : null;
}

/** Valor em reais do jeito que se fala: "R$ 1.234,50" → "1.234 reais e 50 centavos". */
export function reaisFalado(v: number): string {
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  const r = `${reais.toLocaleString("pt-BR")} ${reais === 1 ? "real" : "reais"}`;
  return centavos ? `${r} e ${centavos} centavo${centavos === 1 ? "" : "s"}` : r;
}

export const AJUDA = [
  "“O que falta pagar?” — total em aberto e as próximas contas",
  "“O que falta pagar da obra Residencial?” — só daquela obra",
  "“Contas vencidas”",
  "“Pix do primeiro” ou “Pix da Casa do Construtor” — copia o PIX",
  "“Compras para aprovar”",
  "“Abrir diário da obra Residencial”, “Abrir pagamentos”, “Abrir compras”",
];
