/**
 * Leitor de XML mínimo, só o que o arquivo do MS Project usa.
 *
 * Escrito à mão de propósito: trazer uma biblioteca de XML para dentro
 * do projeto por causa de um importador é peso que não se paga, e o
 * MSPDI é um dialeto simples — elementos, texto e nada de namespace
 * relevante.
 *
 * Não cobre DTD, entidade declarada pelo usuário nem processamento de
 * namespace. Cobre: elemento, atributo, texto, vazio, comentário, CDATA,
 * instrução de processamento e as cinco entidades padrão.
 */

export type No = {
  nome: string;
  atributos: Record<string, string>;
  filhos: No[];
  texto: string;
};

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

function decodificar(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (inteiro, corpo: string) => {
    if (corpo[0] === "#") {
      const n = corpo[1] === "x" || corpo[1] === "X"
        ? Number.parseInt(corpo.slice(2), 16)
        : Number.parseInt(corpo.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : inteiro;
    }
    return ENTIDADES[corpo] ?? inteiro;
  });
}

export function lerXml(texto: string): No {
  let i = 0;
  const n = texto.length;

  const pular = () => { while (i < n && /\s/.test(texto[i])) i++; };

  function lerAtributos(): Record<string, string> {
    const fora: Record<string, string> = {};
    for (;;) {
      pular();
      if (i >= n || texto[i] === ">" || texto[i] === "/") break;
      const ini = i;
      while (i < n && !/[\s=/>]/.test(texto[i])) i++;
      const chave = texto.slice(ini, i);
      if (!chave) { i++; continue; }
      pular();
      if (texto[i] !== "=") { fora[chave] = ""; continue; }
      i++; pular();
      const aspas = texto[i];
      if (aspas !== '"' && aspas !== "'") { fora[chave] = ""; continue; }
      i++;
      const vi = i;
      while (i < n && texto[i] !== aspas) i++;
      fora[chave] = decodificar(texto.slice(vi, i));
      i++;
    }
    return fora;
  }

  /** Consome comentário, CDATA, instrução e declaração; devolve o texto do CDATA. */
  function especial(): string | null {
    if (texto.startsWith("<!--", i)) {
      const fim = texto.indexOf("-->", i);
      i = fim === -1 ? n : fim + 3;
      return "";
    }
    if (texto.startsWith("<![CDATA[", i)) {
      const fim = texto.indexOf("]]>", i);
      const conteudo = texto.slice(i + 9, fim === -1 ? n : fim);
      i = fim === -1 ? n : fim + 3;
      return conteudo;
    }
    if (texto.startsWith("<?", i)) {
      const fim = texto.indexOf("?>", i);
      i = fim === -1 ? n : fim + 2;
      return "";
    }
    if (texto.startsWith("<!", i)) {
      // <!DOCTYPE ...> — pula até o > correspondente, contando colchetes.
      let nivel = 0;
      while (i < n) {
        if (texto[i] === "[") nivel++;
        else if (texto[i] === "]") nivel--;
        else if (texto[i] === ">" && nivel <= 0) { i++; break; }
        i++;
      }
      return "";
    }
    return null;
  }

  function lerElemento(): No {
    i++; // consome "<"
    const ini = i;
    while (i < n && !/[\s/>]/.test(texto[i])) i++;
    const nomeCompleto = texto.slice(ini, i);
    // Prefixo de namespace é descartado: o MSPDI usa um só.
    const nome = nomeCompleto.includes(":") ? nomeCompleto.split(":").pop()! : nomeCompleto;

    const atributos = lerAtributos();
    pular();

    const no: No = { nome, atributos, filhos: [], texto: "" };

    if (texto[i] === "/") { i += 2; return no; } // <tag/>
    i++; // consome ">"

    const pedacos: string[] = [];
    while (i < n) {
      if (texto[i] === "<") {
        if (texto.startsWith("</", i)) {
          const fim = texto.indexOf(">", i);
          i = fim === -1 ? n : fim + 1;
          break;
        }
        const cdata = especial();
        if (cdata !== null) { if (cdata) pedacos.push(cdata); continue; }
        no.filhos.push(lerElemento());
        continue;
      }
      const ti = i;
      while (i < n && texto[i] !== "<") i++;
      pedacos.push(decodificar(texto.slice(ti, i)));
    }

    no.texto = pedacos.join("").trim();
    return no;
  }

  while (i < n) {
    pular();
    if (i >= n) break;
    if (texto[i] !== "<") { i++; continue; }
    if (especial() !== null) continue;
    return lerElemento();
  }
  throw new Error("Arquivo XML sem elemento raiz.");
}

// ------------------------------------------------------------ acesso --

/** Primeiro filho direto com esse nome. */
export function filho(no: No, nome: string): No | undefined {
  return no.filhos.find((f) => f.nome === nome);
}

/** Todos os filhos diretos com esse nome. */
export function filhos(no: No, nome: string): No[] {
  return no.filhos.filter((f) => f.nome === nome);
}

/** Texto de um filho direto, ou "" se não houver. */
export function txt(no: No | undefined, nome: string): string {
  if (!no) return "";
  return filho(no, nome)?.texto ?? "";
}

export function num(no: No | undefined, nome: string, padrao = 0): number {
  const v = Number.parseFloat(txt(no, nome));
  return Number.isFinite(v) ? v : padrao;
}

/** Procura o primeiro descendente com esse nome, em largura. */
export function procurar(no: No, nome: string): No | undefined {
  const fila = [...no.filhos];
  while (fila.length) {
    const atual = fila.shift()!;
    if (atual.nome === nome) return atual;
    fila.push(...atual.filhos);
  }
  return undefined;
}
