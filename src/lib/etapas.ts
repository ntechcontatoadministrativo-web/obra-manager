/**
 * Regras do cronograma (WBS): árvore de etapas, soma automática das sub-etapas,
 * status, Gantt e medição. Tudo puro (sem banco) para ser testável.
 *
 * Convenção: etapas FOLHA (sem sub-etapas) guardam orçamento e percentual digitados.
 * Etapas PAI são calculadas a partir das filhas (nunca digitadas).
 */
export type EtapaStatus = "NAO_INICIADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "ATRASADA" | "PARALISADA";
export const PROFUNDIDADE_MAX = 3; // etapa > sub-etapa > sub-sub-etapa

export interface EtapaNo {
  id: string; paiId: string | null; nome: string; ordem: number;
  inicioPrevisto: Date; fimPrevisto: Date; inicioReal: Date | null; fimReal: Date | null;
  percentual: number; valorOrcado: number; status: EtapaStatus;
}

const MS_DIA = 86_400_000;
export const diasEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_DIA);
const r2 = (n: number) => Math.round(n * 100) / 100;

export const filhosDe = (e: EtapaNo[], id: string) => e.filter((x) => x.paiId === id);
export const ehFolha = (e: EtapaNo[], id: string) => filhosDe(e, id).length === 0;
export const folhas = (e: EtapaNo[]) => e.filter((x) => ehFolha(e, x.id));

/** Raiz = 1. */
export function profundidade(e: EtapaNo[], id: string): number {
  let n = 1, atual = e.find((x) => x.id === id);
  while (atual?.paiId) { n++; atual = e.find((x) => x.id === atual!.paiId); if (n > 20) break; }
  return n;
}
/** Quantos níveis existem da etapa para baixo (ela mesma = 1). */
export function altura(e: EtapaNo[], id: string): number {
  const f = filhosDe(e, id);
  return f.length === 0 ? 1 : 1 + Math.max(...f.map((x) => altura(e, x.id)));
}
/** `candidato` está dentro da subárvore de `ancestral` (ou é ela mesma)? Evita ciclos ao mudar o pai. */
export function estaDentroDe(e: EtapaNo[], candidatoId: string, ancestralId: string): boolean {
  let atual = e.find((x) => x.id === candidatoId), n = 0;
  while (atual && n++ < 20) { if (atual.id === ancestralId) return true; atual = atual.paiId ? e.find((x) => x.id === atual!.paiId) : undefined; }
  return false;
}

/** Lista em ordem de árvore (pai, filhas, próxima etapa...), com o nível de cada uma. */
export function emOrdemDeArvore(e: EtapaNo[]): (EtapaNo & { nivel: number })[] {
  const out: (EtapaNo & { nivel: number })[] = [];
  const visita = (paiId: string | null, nivel: number) => {
    e.filter((x) => x.paiId === paiId).sort((a, b) => a.ordem - b.ordem || a.inicioPrevisto.getTime() - b.inicioPrevisto.getTime())
      .forEach((x) => { out.push({ ...x, nivel }); visita(x.id, nivel + 1); });
  };
  visita(null, 1);
  return out;
}

/** Status de hoje. "Atrasada" aparece sozinha quando o prazo passa sem concluir. */
export function statusEfetivo(e: Pick<EtapaNo, "percentual" | "fimPrevisto" | "inicioReal" | "status">, hoje: Date): EtapaStatus {
  if (e.percentual >= 100) return "CONCLUIDA";
  if (e.status === "PARALISADA") return "PARALISADA";
  if (e.fimPrevisto.getTime() < hoje.getTime()) return "ATRASADA";
  if (e.percentual > 0 || e.inicioReal) return "EM_ANDAMENTO";
  return "NAO_INICIADA";
}

export interface Agregado {
  percentual: number; valorOrcado: number; inicioPrevisto: Date; fimPrevisto: Date; inicioReal: Date | null; fimReal: Date | null;
}

/** Calcula os valores das etapas-pai a partir das filhas (de baixo para cima). */
export function rolarParaCima(etapas: EtapaNo[]): Map<string, Agregado> {
  const atual = new Map<string, EtapaNo | (EtapaNo & Agregado)>(etapas.map((x) => [x.id, x]));
  const res = new Map<string, Agregado>();
  const pais = etapas.filter((x) => !ehFolha(etapas, x.id)).sort((a, b) => profundidade(etapas, b.id) - profundidade(etapas, a.id));
  for (const p of pais) {
    const fs = filhosDe(etapas, p.id).map((f) => atual.get(f.id)!);
    const orc = fs.reduce((s, f) => s + f.valorOrcado, 0);
    const pct = orc > 0 ? fs.reduce((s, f) => s + f.percentual * f.valorOrcado, 0) / orc : fs.reduce((s, f) => s + f.percentual, 0) / fs.length;
    const iniReais = fs.map((f) => f.inicioReal).filter((d): d is Date => !!d);
    const todasFim = fs.every((f) => f.fimReal);
    const ag: Agregado = {
      percentual: r2(pct), valorOrcado: r2(orc),
      inicioPrevisto: new Date(Math.min(...fs.map((f) => f.inicioPrevisto.getTime()))),
      fimPrevisto: new Date(Math.max(...fs.map((f) => f.fimPrevisto.getTime()))),
      inicioReal: iniReais.length ? new Date(Math.min(...iniReais.map((d) => d.getTime()))) : null,
      fimReal: todasFim ? new Date(Math.max(...fs.map((f) => f.fimReal!.getTime()))) : null,
    };
    res.set(p.id, ag);
    atual.set(p.id, { ...p, ...ag });
  }
  return res;
}

/** Aplica o rolar-para-cima sobre a lista e devolve a lista com os pais atualizados. */
export function comPaisCalculados(etapas: EtapaNo[]): EtapaNo[] {
  const ag = rolarParaCima(etapas);
  return etapas.map((e) => (ag.has(e.id) ? { ...e, ...ag.get(e.id)! } : e));
}

// ---------------- Gantt ----------------
export interface LinhaGantt {
  id: string; nome: string; nivel: number; percentual: number; status: EtapaStatus;
  plan: { esq: number; larg: number }; real: { esq: number; larg: number } | null;
  inicio: Date; fim: Date;
}
export interface Gantt { inicio: Date; fim: Date; totalDias: number; meses: { rotulo: string; esq: number; larg: number }[]; hojePct: number | null; linhas: LinhaGantt[] }

export function calcularGantt(etapas: EtapaNo[], hoje: Date): Gantt | null {
  if (etapas.length === 0) return null;
  const datas = etapas.flatMap((e) => [e.inicioPrevisto, e.fimPrevisto, ...(e.inicioReal ? [e.inicioReal] : []), ...(e.fimReal ? [e.fimReal] : [])]);
  const inicio = new Date(Math.min(...datas.map((d) => d.getTime())));
  const fim = new Date(Math.max(...datas.map((d) => d.getTime()), hoje.getTime()));
  const total = diasEntre(inicio, fim) + 1;
  const esq = (d: Date) => (diasEntre(inicio, d) / total) * 100;
  const larg = (a: Date, b: Date) => ((diasEntre(a, b) + 1) / total) * 100;

  const meses: Gantt["meses"] = [];
  let m = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
  while (m <= fim) {
    const prox = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
    const ini = m < inicio ? inicio : m, f = new Date(Math.min(prox.getTime() - MS_DIA, fim.getTime()));
    meses.push({ rotulo: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(m), esq: esq(ini), larg: larg(ini, f) });
    m = prox;
  }

  const linhas = emOrdemDeArvore(etapas).map((e) => {
    const fimReal = e.fimReal ?? (e.inicioReal && e.percentual < 100 ? (hoje < e.inicioReal ? e.inicioReal : hoje) : null);
    return {
      id: e.id, nome: e.nome, nivel: e.nivel, percentual: e.percentual, status: statusEfetivo(e, hoje),
      plan: { esq: esq(e.inicioPrevisto), larg: larg(e.inicioPrevisto, e.fimPrevisto) },
      real: e.inicioReal && fimReal ? { esq: esq(e.inicioReal), larg: larg(e.inicioReal, fimReal) } : null,
      inicio: e.inicioPrevisto, fim: e.fimPrevisto,
    };
  });
  return { inicio, fim, totalDias: total, meses, hojePct: hoje >= inicio && hoje <= fim ? esq(hoje) : null, linhas };
}

// ---------------- Medição ----------------
export interface ItemMedicao { etapaId: string; nome: string; valorOrcado: number; anterior: number; acumulado: number; periodo: number; valorPeriodo: number }
export function calcularMedicao(fol: { id: string; nome: string; valorOrcado: number; percentual: number }[], anteriores: Map<string, number>) {
  const itens: ItemMedicao[] = fol.map((f) => {
    const anterior = anteriores.get(f.id) ?? 0;
    const periodo = Math.max(0, r2(f.percentual - anterior));
    return { etapaId: f.id, nome: f.nome, valorOrcado: f.valorOrcado, anterior, acumulado: f.percentual, periodo, valorPeriodo: r2((periodo / 100) * f.valorOrcado) };
  });
  return {
    itens,
    valorPeriodo: r2(itens.reduce((s, i) => s + i.valorPeriodo, 0)),
    regressoes: itens.filter((i) => i.acumulado < i.anterior).map((i) => `${i.nome} (de ${i.anterior}% para ${i.acumulado}%)`),
  };
}

// ---------------- Modelo de etapas ----------------
const MODELO: [string, number][] = [
  ["Serviços preliminares", 4], ["Fundação", 12], ["Estrutura", 22], ["Alvenaria", 14], ["Cobertura", 8],
  ["Instalações elétricas", 8], ["Instalações hidrossanitárias", 8], ["Revestimentos", 10], ["Esquadrias", 4], ["Pintura", 6], ["Limpeza e entrega", 4],
];
/** Etapas típicas de obra residencial, em sequência, divididas pelo prazo da obra (sem valores: o orçamento é preenchido depois). */
export function etapasPadrao(inicio: Date, fim: Date) {
  const total = Math.max(MODELO.length, diasEntre(inicio, fim) + 1);
  let acum = 0;
  return MODELO.map(([nome, peso], i) => {
    const d0 = Math.round((acum / 100) * total);
    acum += peso;
    const d1 = Math.max(d0, Math.round((acum / 100) * total) - 1);
    return { nome, ordem: i + 1, inicioPrevisto: new Date(inicio.getTime() + d0 * MS_DIA), fimPrevisto: new Date(inicio.getTime() + d1 * MS_DIA) };
  });
}
