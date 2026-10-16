import { AlertTriangle, Check, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import { faixaIndice, type Indicadores } from "@/lib/evm";
import { cn } from "@/lib/utils";

const brl = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number | null, casas = 2) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const TOM = {
  bom: { texto: "text-ok", fundo: "bg-ok", rotulo: "No esperado", Icone: Check },
  atencao: { texto: "text-alerta", fundo: "bg-amarelo", rotulo: "Atenção", Icone: AlertTriangle },
  critico: { texto: "text-perigo", fundo: "bg-perigo", rotulo: "Crítico", Icone: AlertTriangle },
} as const;

/**
 * Medidor de índice (CPI/SPI). Régua de 0,5 a 1,5 com a marca de 1,00
 * destacada: é a referência que importa, e ler "o ponteiro passou da
 * marca" é mais rápido que ler o número.
 *
 * A situação vem sempre com ícone e texto, nunca só pela cor — quem não
 * distingue vermelho de verde precisa ler a mesma coisa.
 */
function Medidor({ titulo, valor, explica }: { titulo: string; valor: number | null; explica: string }) {
  const f = faixaIndice(valor);
  const t = f ? TOM[f] : null;
  const pos = valor === null ? null : Math.min(100, Math.max(0, ((valor - 0.5) / 1) * 100));

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-muted">{titulo}</h3>
        {t && (
          <span className={cn("flex items-center gap-1 text-xs font-semibold", t.texto)}>
            <t.Icone size={13} aria-hidden /> {t.rotulo}
          </span>
        )}
      </div>

      <p className={cn("mt-1 font-display text-3xl font-semibold tabular-nums", t?.texto)}>
        {num(valor)}
      </p>

      <div className="relative mt-3 h-2 rounded-sm bg-bg ring-1 ring-line">
        {/* Marca de 1,00 — o ponto de equilíbrio */}
        <div className="absolute top-[-3px] h-[14px] w-px bg-muted" style={{ left: "50%" }} aria-hidden />
        {pos !== null && (
          <div className={cn("absolute top-[-3px] h-[14px] w-[3px] rounded-sm", t?.fundo)}
            style={{ left: `calc(${pos}% - 1.5px)` }} aria-hidden />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0,50</span><span>1,00</span><span>1,50</span>
      </div>

      <p className="mt-2 text-xs text-muted">{explica}</p>
    </Card>
  );
}

function Valor({ titulo, valor, explica, sinal }: {
  titulo: string; valor: number | null; explica: string; sinal?: boolean;
}) {
  const Seta = valor === null || !sinal ? Minus : valor >= 0 ? TrendingUp : TrendingDown;
  const cor = !sinal || valor === null ? "" : valor >= 0 ? "text-ok" : "text-perigo";
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-muted">{titulo}</h3>
      <p className={cn("mt-1 flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums", cor)}>
        {sinal && <Seta size={18} aria-hidden />}
        {brl(valor)}
      </p>
      <p className="mt-2 text-xs text-muted">{explica}</p>
    </Card>
  );
}

export function PainelIndicadores({ i }: { i: Indicadores }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Medidor
        titulo="Desempenho de custo (CPI)"
        valor={i.cpi}
        explica={
          i.cpi === null
            ? "Sem despesa lançada ainda."
            : `Cada R$ 1,00 gasto entregou R$ ${num(i.cpi).replace(".", ",")} de obra.`
        }
      />
      <Medidor
        titulo="Desempenho de prazo (SPI)"
        valor={i.spi}
        explica={
          i.spi === null
            ? "A obra ainda não tem trabalho previsto para hoje."
            : `Entregue ${Math.round(i.spi * 100)}% do que era previsto para hoje.`
        }
      />
      <Valor
        titulo="Custo final estimado (EAC)"
        valor={i.eac}
        explica={`Orçamento de ${brl(i.bac)} mantendo o ritmo de custo atual.`}
      />
      <Valor
        titulo="Sobra ou estouro (VAC)"
        valor={i.vac}
        sinal
        explica={
          i.vac === null ? "Depende do CPI, que ainda não existe."
            : i.vac >= 0 ? "Previsão de fechar abaixo do orçamento."
              : "Previsão de estourar o orçamento."
        }
      />

      <Valor titulo="Valor agregado (EV)" valor={i.ev} explica="O que foi entregue, a preço de orçamento." />
      <Valor titulo="Custo real (AC)" valor={i.ac} explica="Soma das despesas lançadas na obra." />
      <Valor titulo="Variação de custo (CV)" valor={i.cv} sinal explica="Agregado menos custo real." />
      <Valor
        titulo="Falta gastar (ETC)"
        valor={i.etc}
        explica={
          i.tcpi === null
            ? "O orçamento já foi consumido; não há folga para o que falta."
            : `Para fechar no orçamento, o resto precisa render ${num(i.tcpi)} (TCPI).`
        }
      />
    </div>
  );
}
