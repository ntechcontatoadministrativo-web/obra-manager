import Link from "next/link";
import type { Gantt } from "@/lib/etapas";
import { dataBR } from "@/lib/utils";

const COR = {
  CONCLUIDA: "bg-ok", EM_ANDAMENTO: "bg-laranja", ATRASADA: "bg-perigo", PARALISADA: "bg-alerta", NAO_INICIADA: "bg-muted/50",
} as const;
const ROTULO = { CONCLUIDA: "Concluída", EM_ANDAMENTO: "Em andamento", ATRASADA: "Atrasada", PARALISADA: "Paralisada", NAO_INICIADA: "Não iniciada" } as const;

/** Dados da rede por etapa. Opcional: sem isto o Gantt é o de sempre. */
export type InfoRede = Map<string, {
  ehCritica: boolean;
  folgaTotalDias: number;
  deslocamentoDias: number;
  predecessoras: string[];
}>;

/**
 * Gantt em HTML/CSS: barra de cima = PLANEJADO (com o preenchido = % concluído);
 * barra fina de baixo = REALIZADO (do início real até hoje ou até o fim real).
 * Atrasadas ficam em vermelho. Toque na etapa para editar (quem pode).
 *
 * Com a rede calculada, acrescenta três leituras:
 *   - etapa do caminho crítico ganha marca à esquerda e contorno;
 *   - a folga aparece como extensão hachurada depois da barra planejada —
 *     é o quanto a etapa pode escorregar sem empurrar o fim da obra;
 *   - o nome mostra quantas predecessoras a etapa tem.
 */
export function GanttView({ gantt, obraId, editavel, rede }: {
  gantt: Gantt; obraId: string; editavel: boolean; rede?: InfoRede;
}) {
  const largura = Math.max(640, gantt.totalDias * 7);
  const porDia = 100 / gantt.totalDias; // largura de um dia, em % da faixa

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-card" role="region" aria-label="Cronograma (Gantt)" tabIndex={0}>
      <div style={{ minWidth: largura + 200 }}>
        <div className="flex border-b border-line text-xs text-muted">
          <div className="w-[200px] shrink-0 p-2">Etapa</div>
          <div className="relative flex-1" style={{ minWidth: largura }}>
            {gantt.meses.map((m, i) => <div key={i} className="absolute top-0 h-full border-l border-line p-2 capitalize" style={{ left: `${m.esq}%`, width: `${m.larg}%` }}>{m.larg > 6 ? m.rotulo : ""}</div>)}
            <div className="h-8" />
          </div>
        </div>

        {gantt.linhas.map((l) => {
          const r = rede?.get(l.id);
          const critica = r?.ehCritica ?? false;
          const folgaLarg = r && r.folgaTotalDias > 0 ? r.folgaTotalDias * porDia : 0;

          const nome = (
            <span className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: (l.nivel - 1) * 12 }}>
              <span className="truncate">{l.nome}</span>
              {r && r.predecessoras.length > 0 && (
                <span className="shrink-0 text-[10px] text-muted" title={`Depende de: ${r.predecessoras.join(", ")}`}>
                  ⇠{r.predecessoras.length}
                </span>
              )}
            </span>
          );

          const dica = [
            l.nome,
            `Previsto: ${dataBR(l.inicio)} a ${dataBR(l.fim)}`,
            `${l.percentual.toString().replace(".", ",")}% concluída · ${ROTULO[l.status]}`,
            r && (critica
              ? "Caminho crítico: atrasar esta etapa atrasa a obra."
              : `Folga de ${r.folgaTotalDias} dia${r.folgaTotalDias === 1 ? "" : "s"}.`),
            r && r.predecessoras.length > 0 ? `Depende de: ${r.predecessoras.join(", ")}` : null,
          ].filter(Boolean).join("\n");

          return (
            <div key={l.id} className="flex items-center border-b border-line/60 last:border-0">
              <div className="flex w-[200px] shrink-0 items-center gap-1.5 p-2 text-sm">
                {rede && (
                  <i
                    className={`h-4 w-1 shrink-0 rounded-sm ${critica ? "bg-perigo" : "bg-transparent"}`}
                    aria-hidden
                    title={critica ? "Caminho crítico" : undefined}
                  />
                )}
                {editavel
                  ? <Link href={`/obras/${obraId}/etapas?editar=${l.id}#formulario`} className="flex min-h-9 w-full min-w-0 items-center hover:text-laranja hover:underline">{nome}</Link>
                  : nome}
              </div>

              <div className="relative flex-1 py-2" style={{ minWidth: largura }}>
                {gantt.hojePct != null && <div className="absolute top-0 z-10 h-full w-px bg-perigo" style={{ left: `${gantt.hojePct}%` }} aria-hidden />}

                <div className="relative h-4" title={dica}>
                  {/* Folga: até onde a etapa pode escorregar sem mexer no fim da obra */}
                  {folgaLarg > 0 && (
                    <div
                      className="absolute h-4 rounded-sm border border-dashed border-muted/40"
                      style={{
                        left: `${l.plan.esq + l.plan.larg}%`,
                        width: `${folgaLarg}%`,
                        backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--muted)/0.14) 0 4px, transparent 4px 8px)",
                      }}
                      aria-hidden
                    />
                  )}
                  <div
                    className={`absolute h-4 overflow-hidden rounded-sm bg-bg ${critica ? "border-2 border-perigo" : "border border-muted/40"}`}
                    style={{ left: `${l.plan.esq}%`, width: `${l.plan.larg}%` }}
                  >
                    <div className={`h-full ${COR[l.status]}`} style={{ width: `${Math.min(100, l.percentual)}%` }} />
                  </div>
                </div>

                <div className="relative mt-1 h-1.5">
                  {l.real && <div className={`absolute h-1.5 rounded-sm ${COR[l.status]} opacity-70`} style={{ left: `${l.real.esq}%`, width: `${l.real.larg}%` }} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line p-3 text-xs text-muted">
        <span>Barra de cima: <strong className="text-ink">planejado</strong> (preenchido = % concluído)</span>
        <span>Barra fina: <strong className="text-ink">realizado</strong></span>
        <span className="text-perigo">Linha vermelha: hoje</span>
        {rede && (
          <>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-perigo" /> Caminho crítico</span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-muted/60"
                style={{ backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--muted)/0.2) 0 3px, transparent 3px 6px)" }} />
              Folga
            </span>
            <span>⇠ n: quantas etapas vêm antes</span>
          </>
        )}
        {(["ATRASADA", "EM_ANDAMENTO", "CONCLUIDA", "PARALISADA"] as const).map((s) => <span key={s} className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-sm ${COR[s]}`} /> {ROTULO[s]}</span>)}
      </div>
    </div>
  );
}
