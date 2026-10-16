/**
 * O que um importador devolve, qualquer que seja a origem.
 *
 * Nota sobre o .mpp: é formato binário fechado da Microsoft e não há
 * leitor confiável em JavaScript. O caminho que funciona é um passo no
 * próprio MS Project — Arquivo → Salvar como → XML — que gera o MSPDI,
 * este sim documentado e legível. O mesmo vale para o P6: ele exporta
 * XER, que é texto.
 */

export type TarefaImportada = {
  /** Identificador dentro do arquivo, usado para religar as dependências. */
  chave: string;
  /** Chave da tarefa-pai, quando o arquivo traz hierarquia. */
  chavePai: string | null;
  nome: string;
  inicio: Date;
  fim: Date;
  /** 0 a 100. */
  percentual: number;
  /** Custo ou orçamento da tarefa, quando o arquivo traz. */
  valor: number;
  ehMarco: boolean;
  /** Tarefa de resumo (pai). O valor dela é soma das filhas. */
  ehResumo: boolean;
};

export type DependenciaImportada = {
  predecessora: string;
  sucessora: string;
  tipo: "TI" | "II" | "TT" | "IT";
  folgaDias: number;
};

export type Cronograma = {
  origem: "MS Project (XML)" | "Primavera P6 (XER)";
  nomeProjeto: string | null;
  tarefas: TarefaImportada[];
  dependencias: DependenciaImportada[];
  /** O que foi descartado ou aproximado, para a tela contar ao usuário. */
  avisos: string[];
};

/** Data ISO parcial ("2026-03-01T08:00:00") ou "2026-03-01 08:00". */
export function lerData(bruta: string): Date | null {
  const s = bruta.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // P6 às vezes grava dd-MMM-yy; deixamos passar para o Date nativo.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
