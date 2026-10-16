import { grade, ROTULO_FAIXA, type RiscoBase } from "@/lib/risco";
import { cn } from "@/lib/utils";

/** Fundo de cada faixa. Status, não série: por isso usa as cores de estado. */
const FUNDO = {
  baixo: "bg-ok/15 text-ok",
  moderado: "bg-bg text-muted",
  alto: "bg-amarelo/25 text-alerta",
  critico: "bg-perigo/15 text-perigo",
} as const;

const EIXO = ["Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"];

/**
 * Matriz 5×5 de probabilidade × impacto.
 *
 * A probabilidade desce de cima para baixo e o impacto cresce da
 * esquerda para a direita, então o canto superior direito é o pior —
 * é a convenção e é para onde o olho vai primeiro.
 *
 * A faixa é dita por cor e por texto (o rótulo aparece na dica de cada
 * célula e na legenda), nunca só por cor.
 */
export function MatrizRisco({ riscos }: { riscos: RiscoBase[] }) {
  const celulas = grade(riscos);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-[2px]">
          <caption className="sr-only">
            Matriz de risco: probabilidade nas linhas, impacto nas colunas, com a quantidade de riscos em cada cruzamento
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-24 p-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                Prob. \ Impacto
              </th>
              {EIXO.map((e) => (
                <th key={e} scope="col" className="p-1 text-center text-[10px] font-medium text-muted">{e}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((p) => (
              <tr key={p}>
                <th scope="row" className="p-1 text-left text-[10px] font-medium text-muted">{EIXO[p - 1]}</th>
                {[1, 2, 3, 4, 5].map((i) => {
                  const c = celulas.find((x) => x.probabilidade === p && x.impacto === i)!;
                  return (
                    <td
                      key={i}
                      className={cn(
                        "h-11 rounded-sm text-center align-middle text-sm font-semibold tabular-nums",
                        FUNDO[c.faixa],
                        c.quantidade === 0 && "opacity-45",
                      )}
                      title={`${ROTULO_FAIXA[c.faixa]} (nível ${p * i}) — ${c.quantidade} risco(s)`}
                    >
                      {c.quantidade || ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(["baixo", "moderado", "alto", "critico"] as const).map((f) => (
          <span key={f} className="flex items-center gap-1.5">
            <i className={cn("inline-block h-3 w-3 rounded-sm", FUNDO[f])} aria-hidden />
            {ROTULO_FAIXA[f]}
          </span>
        ))}
        <span className="ml-auto">Nível = probabilidade × impacto</span>
      </div>
    </div>
  );
}

