"use client";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";

export type PontoSerializado = { semana: string; pv: number; ev: number | null; ac: number | null };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Rótulo curto do eixo: R$ 1,2 mi / R$ 340 mil / R$ 900. */
function curto(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `R$ ${Math.round(n / 1_000)} mil`;
  return `R$ ${Math.round(n)}`;
}

const mesAno = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(iso));
const diaMes = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(iso));

/** Escolhe um passo "redondo" para a grade: 1, 2 ou 5 vezes potência de 10. */
function passoRedondo(maximo: number, alvoDeLinhas = 4) {
  const bruto = maximo / alvoDeLinhas;
  const potencia = 10 ** Math.floor(Math.log10(Math.max(bruto, 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (potencia * m >= bruto) return potencia * m;
  return potencia * 10;
}

/**
 * Curva S: planejado (PV), agregado (EV) e custo real (AC).
 *
 * O PV é linha de referência — cinza tracejada — porque não é um dos dois
 * valores que se comparam entre si, é a régua contra a qual os outros
 * são lidos. Sobram duas séries com cor, e esse par passou nos testes de
 * daltonismo nos dois temas.
 */
export function CurvaS({ pontos }: { pontos: PontoSerializado[] }) {
  const [tabela, setTabela] = useState(false);
  const [ativo, setAtivo] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const idGrade = useId();

  const L = 64, R = 16, T = 12, B = 28; // margens para os rótulos caberem
  const W = 760, H = 300;
  const larguraPlot = W - L - R, alturaPlot = H - T - B;

  const { maximo, passo, x, y } = useMemo(() => {
    const valores = pontos.flatMap((p) => [p.pv, p.ev ?? 0, p.ac ?? 0]);
    const bruto = Math.max(1, ...valores);
    const passo = passoRedondo(bruto);
    const maximo = Math.ceil(bruto / passo) * passo;
    return {
      maximo, passo,
      x: (i: number) => L + (pontos.length <= 1 ? larguraPlot / 2 : (i / (pontos.length - 1)) * larguraPlot),
      y: (v: number) => T + alturaPlot - (v / maximo) * alturaPlot,
    };
  }, [pontos, larguraPlot, alturaPlot]);

  if (!pontos.length) {
    return (
      <p className="rounded-md border border-line bg-card p-6 text-sm text-muted">
        Sem curva ainda: cadastre as etapas com datas e orçamento para a obra ter uma linha planejada.
      </p>
    );
  }

  const linha = (campo: "pv" | "ev" | "ac") => {
    const pts = pontos
      .map((p, i) => ({ v: p[campo], i }))
      .filter((p): p is { v: number; i: number } => p.v !== null);
    if (!pts.length) return "";
    return pts.map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  };

  const ultimoCom = (campo: "ev" | "ac") => {
    for (let i = pontos.length - 1; i >= 0; i--) if (pontos[i][campo] !== null) return i;
    return -1;
  };
  const fimEv = ultimoCom("ev"), fimAc = ultimoCom("ac");

  const marcasY = Array.from({ length: Math.round(maximo / passo) + 1 }, (_, k) => k * passo);
  // Rótulo de mês só quando o mês muda, para não empilhar texto no eixo.
  const marcasX = pontos
    .map((p, i) => ({ i, rotulo: mesAno(p.semana) }))
    .filter((m, k, lista) => k === 0 || m.rotulo !== lista[k - 1].rotulo);

  function aoMover(ev: React.MouseEvent<HTMLDivElement>) {
    const caixa = areaRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const rel = ((ev.clientX - caixa.left) / caixa.width) * W;
    const prop = (rel - L) / larguraPlot;
    const i = Math.round(prop * (pontos.length - 1));
    setAtivo(i >= 0 && i < pontos.length ? i : null);
  }

  const p = ativo !== null ? pontos[ativo] : null;

  return (
    <div className="rounded-md border border-line bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line p-3">
        <h3 className="font-display text-base font-semibold">Curva S</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke="rgb(var(--muted))" strokeWidth="2" strokeDasharray="4 3" /></svg>
            Planejado
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke="rgb(var(--serie-ev))" strokeWidth="2" /></svg>
            Agregado
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke="rgb(var(--serie-ac))" strokeWidth="2" /></svg>
            Custo real
          </span>
        </div>
        <Button variante="fantasma" className="ml-auto min-h-9 px-2 text-xs" onClick={() => setTabela((t) => !t)}>
          {tabela ? "Ver gráfico" : "Ver tabela"}
        </Button>
      </div>

      {tabela ? (
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[420px] text-sm tabular-nums">
            <caption className="sr-only">Valores semanais de planejado, agregado e custo real</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">Semana</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Planejado</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Agregado</th>
                <th scope="col" className="py-2 text-right font-semibold">Custo real</th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((pt) => (
                <tr key={pt.semana} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 pr-3">{diaMes(pt.semana)}</td>
                  <td className="py-1.5 pr-3 text-right">{brl(pt.pv)}</td>
                  <td className="py-1.5 pr-3 text-right">{pt.ev === null ? "—" : brl(pt.ev)}</td>
                  <td className="py-1.5 text-right">{pt.ac === null ? "—" : brl(pt.ac)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={areaRef}
          className="relative p-2"
          onMouseMove={aoMover}
          onMouseLeave={() => setAtivo(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
            aria-label={`Curva S: planejado chega a ${curto(pontos[pontos.length - 1].pv)}. Use "Ver tabela" para os valores.`}>
            {/* Grade horizontal, recuada */}
            {marcasY.map((v) => (
              <g key={v}>
                <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="rgb(var(--line))" strokeWidth="1" />
                <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">{curto(v)}</text>
              </g>
            ))}
            {marcasX.map((m) => (
              <text key={`${idGrade}-${m.i}`} x={x(m.i)} y={H - 8} textAnchor="middle" fontSize="11"
                fill="rgb(var(--muted))" className="capitalize">{m.rotulo}</text>
            ))}

            <path d={linha("pv")} fill="none" stroke="rgb(var(--muted))" strokeWidth="2" strokeDasharray="5 4" />
            <path d={linha("ac")} fill="none" stroke="rgb(var(--serie-ac))" strokeWidth="2" strokeLinecap="round" />
            <path d={linha("ev")} fill="none" stroke="rgb(var(--serie-ev))" strokeWidth="2" strokeLinecap="round" />

            {/* Marcador no fim de cada série realizada, com anel da superfície */}
            {fimAc >= 0 && (
              <circle cx={x(fimAc)} cy={y(pontos[fimAc].ac!)} r="4.5"
                fill="rgb(var(--serie-ac))" stroke="rgb(var(--card))" strokeWidth="2" />
            )}
            {fimEv >= 0 && (
              <circle cx={x(fimEv)} cy={y(pontos[fimEv].ev!)} r="4.5"
                fill="rgb(var(--serie-ev))" stroke="rgb(var(--card))" strokeWidth="2" />
            )}

            {ativo !== null && (
              <line x1={x(ativo)} y1={T} x2={x(ativo)} y2={T + alturaPlot}
                stroke="rgb(var(--ink))" strokeWidth="1" opacity="0.35" />
            )}
          </svg>

          {p && (
            <div className="pointer-events-none absolute left-2 top-2 rounded border border-line bg-bg/95 p-2 text-xs shadow-sm">
              <div className="mb-1 font-semibold">Semana de {diaMes(p.semana)}</div>
              <div className="space-y-0.5 tabular-nums">
                <div className="flex justify-between gap-4"><span className="text-muted">Planejado</span><span>{brl(p.pv)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted">Agregado</span><span>{p.ev === null ? "—" : brl(p.ev)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted">Custo real</span><span>{p.ac === null ? "—" : brl(p.ac)}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="border-t border-line p-3 text-xs text-muted">
        As linhas de agregado e custo real param na última semana fechada; a planejada segue até o fim da obra.
      </p>
    </div>
  );
}
