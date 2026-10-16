/**
 * Porta de entrada do importador: descobre o formato e devolve sempre a
 * mesma estrutura.
 */
import { ehMspdi, lerMspdi } from "./mspdi";
import { ehXer, lerXer } from "./xer";
import type { Cronograma } from "./formato";

export * from "./formato";
export { lerXml } from "./xml";

export function importarCronograma(texto: string): Cronograma {
  if (ehXer(texto)) return lerXer(texto);
  if (ehMspdi(texto)) return lerMspdi(texto);

  if (/^\s*PK\x03\x04/.test(texto) || /Microsoft\.?Project/i.test(texto.slice(0, 2000))) {
    throw new Error(
      "Isto parece um arquivo .mpp. Ele é binário e fechado. No MS Project, use Arquivo → Salvar como → XML e envie o .xml.",
    );
  }
  throw new Error("Formato não reconhecido. Envie XML do MS Project ou XER do Primavera P6.");
}

/**
 * Prepara o que vai para o banco: ordena, numera e resolve a árvore.
 *
 * Tarefa de resumo entra como etapa-pai sem valor próprio — o projeto já
 * calcula o pai pela soma das filhas, e manter o valor dos dois lados
 * contaria o orçamento duas vezes.
 */
export function paraEtapas(c: Cronograma) {
  const porChave = new Map(c.tarefas.map((t) => [t.chave, t]));

  // Profundidade de cada tarefa, para ordenar pai antes de filha.
  const profundidade = (chave: string, visto = new Set<string>()): number => {
    const t = porChave.get(chave);
    if (!t || !t.chavePai || visto.has(chave)) return 0;
    visto.add(chave);
    return 1 + profundidade(t.chavePai, visto);
  };

  const ordenadas = [...c.tarefas].sort((a, b) => {
    const d = profundidade(a.chave) - profundidade(b.chave);
    if (d !== 0) return d;
    return a.inicio.getTime() - b.inicio.getTime();
  });

  return ordenadas.map((t, i) => ({
    chave: t.chave,
    chavePai: t.chavePai && porChave.has(t.chavePai) ? t.chavePai : null,
    nome: t.nome.slice(0, 120),
    ordem: i + 1,
    inicioPrevisto: t.inicio,
    fimPrevisto: t.fim,
    percentual: t.ehResumo ? 0 : t.percentual,
    valorOrcado: t.ehResumo ? 0 : t.valor,
    ehMarco: t.ehMarco,
  }));
}
