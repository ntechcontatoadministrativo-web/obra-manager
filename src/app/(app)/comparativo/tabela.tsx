import { faixaIndice } from "@/lib/evm";
import type { LinhaComparativo, Media } from "@/lib/comparativo";
import { cn } from "@/lib/utils";

const brl = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number | null, casas = 2) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const TOM = { bom: "text-ok", atencao: "text-alerta", critico: "text-perigo" } as const;

function Indice({ valor }: { valor: number | null }) {
  const f = faixaIndice(valor);
  return (
    <span className={cn("font-semibold tabular-nums", f && TOM[f])}>
      {num(valor)}
    </span>
  );
}

/**
 * Comparativo em tabela, não em gráfico: são poucas obras e muitas
 * métricas de escalas diferentes. Um gráfico com CPI, dias e reais no
 * mesmo eixo mentiria, e em eixos separados seria pior de ler que isto.
 *
 * A linha da média fecha a tabela como referência.
 */
export function Tabela({ linhas, media }: { linhas: LinhaComparativo[]; media: Media }) {
  const cab = "py-2 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted";
  const cel = "py-2.5 px-3 text-sm tabular-nums";

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-card">
      <table className="w-full min-w-[640px]">
        <caption className="sr-only">Comparativo de desempenho entre as obras selecionadas</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={cab}>Obra</th>
            <th scope="col" className={cn(cab, "text-right")}>Índice</th>
            <th scope="col" className={cn(cab, "text-right")}>CPI</th>
            <th scope="col" className={cn(cab, "text-right")}>SPI</th>
            <th scope="col" className={cn(cab, "text-right")}>Prazo</th>
            <th scope="col" className={cn(cab, "text-right")}>Sobra/estouro</th>
            <th scope="col" className={cn(cab, "text-right")}>Avanço</th>
            <th scope="col" className={cn(cab, "text-right")}>Risco</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b border-line/60 last:border-0">
              <th scope="row" className={cn(cel, "text-left font-medium")}>{l.nome}</th>
              <td className={cn(cel, "text-right font-display font-semibold")}>
                {l.indice.toFixed(1).replace(".", ",")}
              </td>
              <td className={cn(cel, "text-right")}><Indice valor={l.cpi} /></td>
              <td className={cn(cel, "text-right")}><Indice valor={l.spi} /></td>
              <td className={cn(cel, "text-right")}>
                {l.desvioPrazoDias === null ? "—" : (
                  <span className={l.desvioPrazoDias > 0 ? "text-perigo" : l.desvioPrazoDias < 0 ? "text-ok" : ""}>
                    {l.desvioPrazoDias > 0 ? "+" : ""}{l.desvioPrazoDias} d
                  </span>
                )}
              </td>
              <td className={cn(cel, "text-right")}>
                <span className={l.vac === null ? "" : l.vac < 0 ? "text-perigo" : "text-ok"}>{brl(l.vac)}</span>
              </td>
              <td className={cn(cel, "text-right")}>{l.avancoFisicoPct.toFixed(0)}%</td>
              <td className={cn(cel, "text-right")}>
                <span className={l.exposicaoRisco >= 50 ? "text-perigo" : l.exposicaoRisco >= 25 ? "text-alerta" : ""}>
                  {l.exposicaoRisco}
                </span>
              </td>
            </tr>
          ))}

          <tr className="border-t-2 border-line bg-bg">
            <th scope="row" className={cn(cel, "text-left font-medium text-muted")}>
              Média da empresa <span className="font-normal">({media.base} obras)</span>
            </th>
            <td className={cn(cel, "text-right text-muted")}>
              {media.indice === null ? "—" : media.indice.toFixed(1).replace(".", ",")}
            </td>
            <td className={cn(cel, "text-right text-muted")}>{num(media.cpi)}</td>
            <td className={cn(cel, "text-right text-muted")}>{num(media.spi)}</td>
            <td className={cn(cel, "text-right text-muted")}>—</td>
            <td className={cn(cel, "text-right text-muted")}>—</td>
            <td className={cn(cel, "text-right text-muted")}>—</td>
            <td className={cn(cel, "text-right text-muted")}>
              {media.exposicaoRisco === null ? "—" : Math.round(media.exposicaoRisco)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-line p-3 text-xs text-muted">
        Prazo: dias além da previsão da obra (negativo é folga). Sobra/estouro: diferença
        entre orçamento e custo final estimado. Risco: exposição de 0 a 100.
      </p>
    </div>
  );
}
