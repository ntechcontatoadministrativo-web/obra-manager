/**
 * Primavera P6 — arquivo XER.
 *
 * É texto separado por tabulação, em blocos: %T declara a tabela, %F os
 * nomes das colunas e cada %R é uma linha. Lemos duas tabelas: TASK
 * (atividades) e TASKPRED (vínculos). PROJWBS, quando existe, dá a
 * hierarquia.
 */
import { lerData, type Cronograma, type DependenciaImportada, type TarefaImportada } from "./formato";

const TIPO: Record<string, DependenciaImportada["tipo"]> = {
  PR_FS: "TI", PR_SS: "II", PR_FF: "TT", PR_SF: "IT",
};

type Tabela = { colunas: string[]; linhas: string[][] };

export function ehXer(texto: string): boolean {
  return texto.slice(0, 200).startsWith("ERMHDR");
}

export function lerTabelas(texto: string): Map<string, Tabela> {
  const tabelas = new Map<string, Tabela>();
  let atual: Tabela | null = null;

  for (const bruta of texto.split(/\r\n|\r|\n/)) {
    if (!bruta) continue;
    const campos = bruta.split("\t");
    const marcador = campos[0];

    if (marcador === "%T") {
      atual = { colunas: [], linhas: [] };
      tabelas.set(campos[1]?.trim() ?? "", atual);
    } else if (marcador === "%F" && atual) {
      atual.colunas = campos.slice(1).map((c) => c.trim());
    } else if (marcador === "%R" && atual) {
      atual.linhas.push(campos.slice(1));
    }
  }
  return tabelas;
}

/** Transforma as linhas em objetos nomeados pelas colunas. */
function registros(t: Tabela | undefined): Record<string, string>[] {
  if (!t) return [];
  return t.linhas.map((linha) => {
    const o: Record<string, string> = {};
    t.colunas.forEach((c, i) => { o[c] = (linha[i] ?? "").trim(); });
    return o;
  });
}

const numero = (s: string | undefined, padrao = 0) => {
  const n = Number.parseFloat((s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
};

export function lerXer(texto: string): Cronograma {
  const tabelas = lerTabelas(texto);
  const tarefasBrutas = registros(tabelas.get("TASK"));
  if (!tarefasBrutas.length) throw new Error("O XER não tem a tabela TASK.");

  const avisos: string[] = [];
  const tarefas: TarefaImportada[] = [];
  let semData = 0;

  for (const r of tarefasBrutas) {
    const id = r.task_id;
    if (!id) continue;

    const nome = (r.task_name || r.task_code || "").trim();
    // Prefere as datas reais; se não houver, usa as planejadas.
    const inicio = lerData(r.act_start_date || r.target_start_date || r.early_start_date || "");
    const fim = lerData(r.act_end_date || r.target_end_date || r.early_end_date || "");

    if (!nome) continue;
    if (!inicio || !fim) { semData++; continue; }

    // Marco no P6: tipo de tarefa começa com TT_Mile.
    const ehMarco = (r.task_type || "").startsWith("TT_Mile");

    // O P6 grava o avanço como fração (0 a 1) em phys_complete_pct quando
    // o tipo de percentual é físico; em outros casos vem de 0 a 100.
    const bruto = numero(r.phys_complete_pct, numero(r.complete_pct, 0));
    const percentual = bruto <= 1 && bruto > 0 ? bruto * 100 : bruto;

    tarefas.push({
      chave: id,
      chavePai: r.wbs_id || null,
      nome,
      inicio,
      fim: fim < inicio ? inicio : fim,
      percentual: Math.min(100, Math.max(0, percentual)),
      valor: numero(r.target_cost, numero(r.total_cost, 0)),
      ehMarco,
      ehResumo: false, // no XER a WBS é outra tabela; a tarefa é sempre folha
    });
  }

  const conhecidas = new Set(tarefas.map((t) => t.chave));

  const dependencias: DependenciaImportada[] = [];
  for (const r of registros(tabelas.get("TASKPRED"))) {
    const pred = r.pred_task_id, suc = r.task_id;
    if (!pred || !suc) continue;
    if (!conhecidas.has(pred) || !conhecidas.has(suc)) continue;
    dependencias.push({
      predecessora: pred,
      sucessora: suc,
      tipo: TIPO[r.pred_type] ?? "TI",
      // lag_hr_cnt vem em horas; jornada de 8 h por dia.
      folgaDias: Math.round(numero(r.lag_hr_cnt, 0) / 8),
    });
  }

  // A WBS vira hierarquia só quando as tarefas apontam para ela.
  const wbs = registros(tabelas.get("PROJWBS"));
  if (wbs.length) {
    const nomes = new Map(wbs.map((w) => [w.wbs_id, (w.wbs_name || "").trim()]));
    const usadas = new Set(tarefas.map((t) => t.chavePai).filter(Boolean) as string[]);
    for (const id of usadas) {
      if (!nomes.has(id)) continue;
      // A WBS entra como etapa-pai, sem data própria: as datas saem das filhas.
      const filhas = tarefas.filter((t) => t.chavePai === id);
      if (!filhas.length) continue;
      tarefas.push({
        chave: id,
        chavePai: null,
        nome: nomes.get(id)!,
        inicio: new Date(Math.min(...filhas.map((f) => f.inicio.getTime()))),
        fim: new Date(Math.max(...filhas.map((f) => f.fim.getTime()))),
        percentual: 0,
        valor: 0,
        ehMarco: false,
        ehResumo: true,
      });
    }
  } else {
    // Sem PROJWBS não há como resolver o pai; as tarefas entram planas.
    for (const t of tarefas) t.chavePai = null;
  }

  if (semData) avisos.push(`${semData} atividade(s) sem data foram ignoradas.`);
  if (!tabelas.has("TASKPRED")) avisos.push("O arquivo não trouxe a tabela de vínculos (TASKPRED); as etapas entram sem dependência.");
  avisos.push("Folgas convertidas de horas para dias com jornada de 8 horas.");

  const projeto = registros(tabelas.get("PROJECT"))[0];

  return {
    origem: "Primavera P6 (XER)",
    nomeProjeto: projeto?.proj_short_name || projeto?.proj_name || null,
    tarefas,
    dependencias,
    avisos,
  };
}
