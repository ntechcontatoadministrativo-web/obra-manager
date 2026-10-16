/**
 * MS Project XML (MSPDI).
 *
 * Gerado por Arquivo → Salvar como → XML dentro do MS Project. O .mpp
 * binário não é lido aqui, e não é descuido: não existe leitor confiável
 * dele fora das bibliotecas da Microsoft.
 *
 * A hierarquia vem em OutlineLevel (1, 2, 3…) na ordem do arquivo, e não
 * por referência ao pai — por isso ela é reconstruída com uma pilha.
 */
import { lerXml, filho, filhos, num, txt, type No } from "./xml";
import { lerData, type Cronograma, type DependenciaImportada, type TarefaImportada } from "./formato";

/** Tipo de vínculo no MSPDI: 0=TT, 1=TI, 2=IT, 3=II. */
const TIPO: Record<string, DependenciaImportada["tipo"]> = {
  "0": "TT", "1": "TI", "2": "IT", "3": "II",
};

/**
 * LinkLag vem em décimos de minuto. A conversão para dias usa jornada de
 * 8 horas, que é o padrão do MS Project — uma folga de "2 dias" lá vira
 * 2 aqui. Para calendário diferente o número sai aproximado, e a tela
 * avisa.
 */
function folgaEmDias(linkLag: number, formato: number): number {
  if (!linkLag) return 0;
  const minutos = linkLag / 10;
  // LagFormat 7 e 8 são dias; 9 e 10, semanas; 5 e 6, horas.
  if (formato === 9 || formato === 10) return Math.round(minutos / (60 * 8 * 5));
  if (formato === 5 || formato === 6) return Math.round(minutos / (60 * 8));
  return Math.round(minutos / (60 * 8));
}

export function ehMspdi(texto: string): boolean {
  return /<Project[\s>]/.test(texto.slice(0, 4000));
}

export function lerMspdi(texto: string): Cronograma {
  const raiz = lerXml(texto);
  if (raiz.nome !== "Project") throw new Error("Este XML não parece ser de um projeto do MS Project.");

  const avisos: string[] = [];
  const tarefas: TarefaImportada[] = [];
  const dependencias: DependenciaImportada[] = [];

  const blocoTarefas = filho(raiz, "Tasks");
  if (!blocoTarefas) throw new Error("O arquivo não tem a seção de tarefas.");

  // Pilha de pais por nível de estrutura de tópicos.
  const pilha: { nivel: number; chave: string }[] = [];
  let semData = 0, comFolgaAproximada = 0;

  for (const t of filhos(blocoTarefas, "Task")) {
    const uid = txt(t, "UID");
    if (!uid) continue;

    const nome = txt(t, "Name").trim();
    const inicio = lerData(txt(t, "Start"));
    const fim = lerData(txt(t, "Finish"));
    const nivel = Math.max(1, num(t, "OutlineLevel", 1));

    // A tarefa 0 do MS Project é o projeto inteiro; não vira etapa.
    if (uid === "0" && nivel <= 0) continue;

    if (!nome) continue;
    if (!inicio || !fim) { semData++; continue; }

    while (pilha.length && pilha[pilha.length - 1].nivel >= nivel) pilha.pop();
    const chavePai = pilha.length ? pilha[pilha.length - 1].chave : null;
    pilha.push({ nivel, chave: uid });

    tarefas.push({
      chave: uid,
      chavePai,
      nome,
      inicio,
      fim: fim < inicio ? inicio : fim,
      percentual: Math.min(100, Math.max(0, num(t, "PercentComplete", 0))),
      valor: num(t, "Cost", 0),
      ehMarco: txt(t, "Milestone") === "1",
      ehResumo: txt(t, "Summary") === "1",
    });

    for (const link of filhos(t, "PredecessorLink")) {
      const pred = txt(link, "PredecessorUID");
      if (!pred) continue;
      const formato = num(link, "LagFormat", 7);
      const lag = num(link, "LinkLag", 0);
      if (lag && formato !== 7 && formato !== 8) comFolgaAproximada++;
      dependencias.push({
        predecessora: pred,
        sucessora: uid,
        tipo: TIPO[txt(link, "Type")] ?? "TI",
        folgaDias: folgaEmDias(lag, formato),
      });
    }
  }

  if (semData) avisos.push(`${semData} tarefa(s) sem data de início ou fim foram ignoradas.`);
  if (comFolgaAproximada) {
    avisos.push(`${comFolgaAproximada} folga(s) vieram em outra unidade e foram convertidas para dias com jornada de 8 horas.`);
  }
  const conhecidas = new Set(tarefas.map((t) => t.chave));
  const orfas = dependencias.filter((d) => !conhecidas.has(d.predecessora)).length;
  if (orfas) avisos.push(`${orfas} dependência(s) apontavam para tarefa fora do arquivo e foram descartadas.`);

  return {
    origem: "MS Project (XML)",
    nomeProjeto: txt(raiz, "Name") || txt(raiz, "Title") || null,
    tarefas,
    dependencias: dependencias.filter((d) => conhecidas.has(d.predecessora) && conhecidas.has(d.sucessora)),
    avisos,
  };
}

/** Exposto para teste e para quem quiser inspecionar um nó específico. */
export type { No };
