import Link from "next/link";
import type { Gantt } from "@/lib/etapas";
import { dataBR } from "@/lib/utils";

const COR = {
  CONCLUIDA: "bg-ok", EM_ANDAMENTO: "bg-laranja", ATRASADA: "bg-perigo", PARALISADA: "bg-alerta", NAO_INICIADA: "bg-muted/50",
} as const;
const ROTULO = { CONCLUIDA: "Concluída", EM_ANDAMENTO: "Em andamento", ATRASADA: "Atrasada", PARALISADA: "Paralisada", NAO_INICIADA: "Não iniciada" } as const;

/**
 * Gantt em HTML/CSS: barra de cima = PLANEJADO (com o preenchido = % concluído);
 * barra fina de baixo = REALIZADO (do início real até hoje ou até o fim real).
 * Atrasadas ficam em vermelho. Toque na etapa para editar (quem pode).
 */
export function GanttView({ gantt, obraId, editavel }: { gantt: Gantt; obraId: string; editavel: boolean }) {
  const largura = Math.max(640, gantt.totalDias * 7);
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
          const nome = <span className="truncate" style={{ paddingLeft: (l.nivel - 1) * 12 }}>{l.nome}</span>;
          return (
            <div key={l.id} className="flex items-center border-b border-line/60 last:border-0">
              <div className="flex w-[200px] shrink-0 items-center p-2 text-sm">
                {editavel ? <Link href={`/obras/${obraId}/etapas?editar=${l.id}#formulario`} className="flex min-h-9 w-full items-center truncate hover:text-laranja hover:underline">{nome}</Link> : nome}
              </div>
              <div className="relative flex-1 py-2" style={{ minWidth: largura }}>
                {gantt.hojePct != null && <div className="absolute top-0 z-10 h-full w-px bg-perigo" style={{ left: `${gantt.hojePct}%` }} aria-hidden />}
                <div className="relative h-4" title={`${l.nome}\nPrevisto: ${dataBR(l.inicio)} a ${dataBR(l.fim)}\n${l.percentual.toString().replace(".", ",")}% concluída · ${ROTULO[l.status]}`}>
                  <div className="absolute h-4 overflow-hidden rounded-sm border border-muted/40 bg-bg" style={{ left: `${l.plan.esq}%`, width: `${l.plan.larg}%` }}>
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
        {(["ATRASADA", "EM_ANDAMENTO", "CONCLUIDA", "PARALISADA"] as const).map((s) => <span key={s} className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-sm ${COR[s]}`} /> {ROTULO[s]}</span>)}
      </div>
    </div>
  );
}
