/**
 * Regras do Diário de Obra: o que precisa estar preenchido para CONCLUIR,
 * e quais dias úteis ficaram sem diário concluído.
 */
import type { ImpactoClima } from "./clima";

export const MIN_FOTOS = 3;           // exigência da especificação
export const MIN_FOTOS_PARALISADO = 1; // dia de paralisação total
export const MIN_RESUMO = 20;

export interface DadosConclusao {
  descricao: string;
  temperaturaC: number | null;
  impactoClima: ImpactoClima;
  obsClima: string;
  pessoas: number;      // soma do efetivo
  atividades: number;   // linhas de atividade
  fotos: number;
}

/** Lista (em português, para o usuário) tudo o que ainda impede de concluir. Vazia = pode concluir. */
export function pendenciasConclusao(d: DadosConclusao): string[] {
  const p: string[] = [];
  const parado = d.impactoClima === "PARALISACAO_TOTAL";
  if (d.temperaturaC === null || Number.isNaN(d.temperaturaC)) p.push("Informe a temperatura do dia.");
  if (d.impactoClima !== "SEM_IMPACTO" && d.obsClima.trim().length < 5)
    p.push("Explique, nas observações do tempo, como ele afetou a obra.");
  if (d.descricao.trim().length < MIN_RESUMO) p.push(`Escreva o resumo do dia (pelo menos ${MIN_RESUMO} letras).`);
  if (!parado && d.pessoas <= 0) p.push("Informe quantas pessoas trabalharam (equipe).");
  if (!parado && d.atividades < 1) p.push("Registre pelo menos uma atividade executada.");
  const minFotos = parado ? MIN_FOTOS_PARALISADO : MIN_FOTOS;
  if (d.fotos < minFotos) p.push(`Anexe pelo menos ${minFotos} foto${minFotos > 1 ? "s" : ""} (faltam ${minFotos - d.fotos}).`);
  return p;
}

// ---- Dias sem diário ----
export function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 5 dias/semana = seg a sex; 6 ou mais = seg a sáb. */
export function ehDiaDeTrabalho(iso: string, diasPorSemana: number): boolean {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
  if (dow === 0) return false;
  if (dow === 6) return diasPorSemana >= 6;
  return true;
}

/** Dias de trabalho (do mais recente ao mais antigo) dentro da janela, desde o início da obra, sem diário concluído. */
export function diasSemDiario(o: { hoje: string; inicio: string; concluidos: Set<string>; diasPorSemana: number; janela: number }): string[] {
  const out: string[] = [];
  for (let i = 0; i < o.janela; i++) {
    const dia = somarDias(o.hoje, -i);
    if (dia < o.inicio) break;
    if (ehDiaDeTrabalho(dia, o.diasPorSemana) && !o.concluidos.has(dia)) out.push(dia);
  }
  return out;
}

export const dataLonga = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
export const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
