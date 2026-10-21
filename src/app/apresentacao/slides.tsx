"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot, Camera, Check, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, GanttChart, HardHat, LayoutDashboard,
  Lock, LogIn, MapPin, Maximize, NotebookPen, Rocket, Scale, ShieldAlert, ShieldCheck, Smartphone, TrendingUp, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NTECH, NtechMarca } from "@/components/ntech";

/**
 * Apresentação comercial do sistema, um slide por função.
 *
 * Teclado: → / espaço / PageDown avança, ← / PageUp volta, Home e End,
 * F tela cheia. No celular, deslize. O número do slide fica no endereço
 * (#5), então recarregar a página não perde a posição.
 *
 * As ilustrações são desenhos das telas com dados de exemplo, não leituras
 * do banco: a página é pública e não pode expor obra de cliente.
 */

type Icone = typeof HardHat;
type Slide =
  | { tipo: "capa" }
  | { tipo: "problema" }
  | { tipo: "visao" }
  | { tipo: "fim" }
  | { tipo: "funcao"; icone: Icone; modulo: string; titulo: string; frase: string; itens: string[]; visual: () => JSX.Element };

// ------------------------------------------------------------------ ilustrações --

const Painel = ({ className, children }: { className?: string; children: React.ReactNode }) =>
  <div className={cn("rounded-lg border border-line bg-card p-4 shadow-2xl shadow-black/40", className)}>{children}</div>;

const Barra = ({ v, cor = "bg-laranja" }: { v: number; cor?: string }) => (
  <div className="h-2 overflow-hidden rounded-sm bg-bg ring-1 ring-line"><div className={cn("h-full", cor)} style={{ width: `${v}%` }} /></div>
);

const Selo = ({ tom, children }: { tom: "ok" | "alerta" | "perigo" | "info"; children: React.ReactNode }) => {
  const c = { ok: "bg-ok/15 text-ok border-ok/30", alerta: "bg-amarelo/20 text-amarelo border-amarelo/40", perigo: "bg-perigo/15 text-perigo border-perigo/30", info: "bg-laranja/15 text-laranja border-laranja/30" }[tom];
  return <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold", c)}>{children}</span>;
};

function VisualPainel() {
  const obras = [
    { n: "Residencial Jardins", f: 68, c: 61, s: ["ok", "No prazo"] as const },
    { n: "Galpão Logístico BR-316", f: 41, c: 57, s: ["perigo", "Atrasada"] as const },
    { n: "UBS Icoaraci", f: 83, c: 79, s: ["alerta", "Atenção ao prazo"] as const },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[["5", "em andamento"], ["1", "atrasada"], ["7", "obras"], ["R$ 18,4 mi", "contratos"]].map(([v, r], i) => (
          <Painel key={r} className={cn("p-3", i === 1 && "border-perigo/50")}>
            <p className={cn("font-display text-lg font-semibold tabular-nums", i === 1 && "text-perigo")}>{v}</p>
            <p className="text-[11px] text-muted">{r}</p>
          </Painel>
        ))}
      </div>
      {obras.map((o) => (
        <Painel key={o.n} className="space-y-2 p-3">
          <div className="flex items-center justify-between"><p className="font-display font-semibold">{o.n}</p><Selo tom={o.s[0]}>{o.s[1]}</Selo></div>
          <div className="grid grid-cols-2 gap-3 text-[11px] text-muted">
            <div>Avanço físico {o.f}%<Barra v={o.f} /></div>
            <div>Custo / orçamento {o.c}%<Barra v={o.c} cor={o.c > o.f ? "bg-perigo" : "bg-laranja"} /></div>
          </div>
        </Painel>
      ))}
    </div>
  );
}

function VisualObra() {
  const mods = [[Clock, "Ponto"], [NotebookPen, "Diário"], [GanttChart, "Etapas"], [FileSpreadsheet, "Medições"], [TrendingUp, "Análise"], [ShieldAlert, "Riscos"]] as const;
  return (
    <Painel className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2"><p className="font-display text-xl font-semibold">Residencial Jardins</p><Selo tom="info">Em andamento</Selo><Selo tom="ok">No prazo</Selo></div>
        <p className="text-xs text-muted">Av. Augusto Montenegro, 4200 · Belém/PA</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {mods.map(([I, r]) => (
          <div key={r} className="flex items-center gap-2 rounded border border-line bg-bg px-2 py-2 text-xs font-semibold"><I size={14} className="text-laranja" />{r}</div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5 text-muted">
          <p>Cliente <span className="float-right text-ink">Construtora Norte</span></p>
          <p>Início <span className="float-right text-ink">03/02/2026</span></p>
          <p>Término <span className="float-right text-ink">30/04/2027</span></p>
          <p>Área <span className="float-right text-ink">4.850 m²</span></p>
        </div>
        <div className="relative h-24 overflow-hidden rounded border border-line"
          style={{ background: "repeating-linear-gradient(35deg, rgb(var(--bg)) 0 18px, rgb(var(--line)) 18px 19px), rgb(var(--bg))" }}>
          <MapPin className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-laranja" size={26} fill="currentColor" />
        </div>
      </div>
    </Painel>
  );
}

function VisualPonto() {
  return (
    <div className="mx-auto w-64 rounded-[2rem] border-4 border-line bg-card p-4 shadow-2xl shadow-black/40">
      <p className="text-center text-[11px] text-muted">Residencial Jardins</p>
      <p className="text-center font-display text-3xl font-semibold tabular-nums">07:02</p>
      <div className="mx-auto my-3 grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-laranja/60 bg-bg">
        <Camera className="text-laranja" size={32} />
      </div>
      <div className="mb-3 flex items-center justify-center gap-1.5 rounded bg-ok/15 py-1.5 text-xs font-semibold text-ok"><MapPin size={13} /> Dentro do raio · 42 m de 150 m</div>
      <div className="space-y-1.5 text-xs">
        {[["Entrada", "07:02", true], ["Saída almoço", "—", false], ["Volta almoço", "—", false], ["Saída", "—", false]].map(([r, h, f]) => (
          <div key={r as string} className={cn("flex justify-between rounded border px-2 py-1.5", f ? "border-ok/40" : "border-line")}>
            <span>{r}</span><span className="tabular-nums text-muted">{h}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualDiario() {
  const itens = [["Clima", "29 °C · pancadas de chuva", "automático"], ["Equipe", "14 pessoas presentes", "do ponto"], ["Etapas em andamento", "Alvenaria, Instalações", "automático"], ["Atividades", "3 registradas", ""], ["Fotos", "5 anexadas (mín. 3)", ""]];
  return (
    <Painel className="space-y-3">
      <div className="flex items-center justify-between"><p className="font-display text-lg font-semibold">Diário · 21/10/2026</p><Selo tom="ok">Concluído</Selo></div>
      {itens.map(([r, v, a]) => (
        <div key={r} className="flex items-center gap-3 text-sm">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-white"><Check size={12} strokeWidth={3} /></span>
          <span className="flex-1"><span className="font-medium">{r}</span> <span className="text-muted">— {v}</span></span>
          {a && <span className="rounded bg-laranja/15 px-1.5 py-0.5 text-[10px] font-semibold text-laranja">{a}</span>}
        </div>
      ))}
      <div className="grid grid-cols-5 gap-1.5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="aspect-square rounded bg-bg ring-1 ring-line" />)}</div>
      <p className="flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted"><Lock size={12} /> Assinado por Eng. Carlos Lima às 17:42 · bloqueado para edição</p>
    </Painel>
  );
}

function VisualGantt() {
  const linhas = [
    { n: "Serviços preliminares", p: [0, 12], r: [0, 13], ok: true },
    { n: "Fundações", p: [10, 28], r: [12, 30], ok: true },
    { n: "Estrutura", p: [25, 55], r: [28, 52], ok: false },
    { n: "Alvenaria", p: [45, 70], r: [50, 58], ok: false },
    { n: "Instalações", p: [55, 85], r: [60, 66], ok: false },
    { n: "Acabamento", p: [75, 100], r: null, ok: false },
  ];
  return (
    <Painel className="space-y-2">
      <div className="mb-1 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-sm bg-line" /> planejado</span>
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-sm bg-laranja" /> realizado</span>
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-sm bg-perigo" /> atrasada</span>
      </div>
      <div className="relative">
        <div className="absolute bottom-0 top-0 z-10 w-px bg-amarelo" style={{ left: `calc(38% + 62% * 0.6)` }}><span className="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold text-amarelo">hoje</span></div>
        {linhas.map((l, i) => (
          <div key={l.n} className="grid grid-cols-[38%_62%] items-center py-1.5 text-xs">
            <span className="truncate pr-2">{l.n}</span>
            <div className="relative h-5">
              <div className="absolute top-0 h-2 rounded-sm bg-line" style={{ left: `${l.p[0]}%`, width: `${l.p[1] - l.p[0]}%` }} />
              {l.r && <div className={cn("absolute top-2.5 h-2 rounded-sm", i === 3 ? "bg-perigo" : "bg-laranja")} style={{ left: `${l.r[0]}%`, width: `${l.r[1] - l.r[0]}%` }} />}
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-line pt-2 text-[11px] text-muted">Importado do MS Project (.xml) · dependências e caminho crítico calculados</p>
    </Painel>
  );
}

function VisualMedicao() {
  const l = [["Fundações", 100, 100, "0,0"], ["Estrutura", 62, 78, "16,0"], ["Alvenaria", 20, 41, "21,0"], ["Instalações", 5, 18, "13,0"]];
  return (
    <Painel>
      <div className="mb-3 flex items-center justify-between"><p className="font-display text-lg font-semibold">Boletim de medição nº 07</p><span className="text-xs text-muted">01/10 a 31/10/2026</span></div>
      <table className="w-full text-xs">
        <thead className="text-muted"><tr className="border-b border-line"><th className="py-1.5 text-left font-medium">Etapa</th><th className="text-right font-medium">Anterior</th><th className="text-right font-medium">Atual</th><th className="text-right font-medium">No período</th></tr></thead>
        <tbody>{l.map(([n, a, b, p]) => (
          <tr key={n as string} className="border-b border-line/60"><td className="py-1.5">{n}</td><td className="text-right tabular-nums">{a}%</td><td className="text-right tabular-nums">{b}%</td><td className="text-right font-semibold tabular-nums text-laranja">{p} p.p.</td></tr>
        ))}</tbody>
      </table>
      <div className="mt-3 flex items-center justify-between rounded bg-bg px-3 py-2 text-sm"><span className="text-muted">Valor medido no período</span><span className="font-display text-lg font-semibold">R$ 412.860,00</span></div>
    </Painel>
  );
}

function VisualAnalise() {
  // Curvas de exemplo (x de 0 a 100, y de 0 a 100; SVG cresce para baixo).
  const pv = "M0,98 C20,95 35,75 50,52 S80,10 100,4";
  const ev = "M0,98 C20,96 35,82 50,64";
  const ac = "M0,98 C20,95 35,78 50,58";
  return (
    <Painel className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[["CPI", "0,91", "perigo", "custo acima do previsto"], ["SPI", "0,88", "alerta", "ritmo abaixo do plano"], ["EAC", "R$ 5,2 mi", "info", "estimativa no término"]].map(([k, v, t, d]) => (
          <div key={k} className="rounded border border-line bg-bg p-2">
            <p className="text-[11px] text-muted">{k}</p>
            <p className={cn("font-display text-xl font-semibold", t === "perigo" ? "text-perigo" : t === "alerta" ? "text-amarelo" : "text-laranja")}>{v}</p>
            <p className="text-[10px] leading-tight text-muted">{d}</p>
          </div>
        ))}
      </div>
      <svg viewBox="-2 -2 104 104" className="h-44 w-full" preserveAspectRatio="none" aria-label="Curva S de exemplo">
        {[25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgb(var(--line))" strokeWidth="0.4" />)}
        <line x1="50" x2="50" y1="0" y2="100" stroke="rgb(var(--amarelo))" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d={pv} fill="none" stroke="rgb(var(--muted))" strokeWidth="1.2" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <path d={ac} fill="none" stroke="rgb(var(--serie-ac))" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <path d={ev} fill="none" stroke="rgb(var(--serie-ev))" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-muted" /> Planejado (baseline)</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-serie-ev" /> Agregado</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-serie-ac" /> Custo real</span>
      </div>
    </Painel>
  );
}

function VisualRiscos() {
  const cor = (n: number) => n >= 15 ? "bg-perigo/80" : n >= 10 ? "bg-laranja/80" : n >= 5 ? "bg-amarelo/70" : "bg-ok/60";
  const pontos: Record<string, number> = { "4-5": 2, "3-4": 1, "5-3": 1, "2-2": 3, "3-2": 1, "1-4": 1 };
  return (
    <Painel>
      <div className="flex gap-2">
        <span className="self-center text-[10px] text-muted [writing-mode:vertical-rl] rotate-180">Probabilidade</span>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {[5, 4, 3, 2, 1].flatMap((p) => [1, 2, 3, 4, 5].map((i) => (
              <div key={`${p}-${i}`} className={cn("grid aspect-square place-items-center rounded-sm text-xs font-bold text-white", cor(p * i))}>
                {pontos[`${p}-${i}`] ?? ""}
              </div>
            )))}
          </div>
          <p className="mt-1 text-center text-[10px] text-muted">Impacto</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        <p className="flex justify-between rounded bg-perigo/10 px-2 py-1.5"><span>Atraso na entrega do aço</span><Selo tom="perigo">Crítico · 20</Selo></p>
        <p className="flex justify-between rounded bg-bg px-2 py-1.5"><span>Chuvas acima da média em novembro</span><Selo tom="alerta">Alto · 12</Selo></p>
      </div>
    </Painel>
  );
}

function VisualAssistente() {
  return (
    <Painel className="space-y-3 text-sm">
      <div className="rounded-lg rounded-tl-none bg-bg p-3">
        <p className="mb-1 text-[11px] font-semibold text-laranja">RESUMO EXECUTIVO · gerado automaticamente</p>
        <p className="text-muted">A obra está com 68% de avanço físico e 61% do orçamento consumido. O ritmo está 4 dias à frente da baseline. Há 1 risco crítico aberto (fornecimento de aço) e nenhum dia útil sem diário.</p>
      </div>
      <div className="ml-auto w-fit max-w-[80%] rounded-lg rounded-tr-none bg-laranja px-3 py-2 text-laranja-fg">Qual etapa mais ameaça o prazo final?</div>
      <div className="flex gap-2">
        <Bot size={20} className="shrink-0 text-laranja" />
        <p className="rounded-lg rounded-tl-none bg-bg p-3 text-muted">Estrutura: está no caminho crítico, sem folga, e o SPI dela é 0,86. Recuperar 3 dias ali antecipa o término da obra.</p>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted"><Lock size={11} /> CPF, dados bancários e nomes de funcionários nunca são enviados à IA</p>
    </Painel>
  );
}

function VisualComparativo() {
  const l = [["UBS Icoaraci", 8.7, "1,04", "1,02"], ["Residencial Jardins", 7.9, "0,98", "1,01"], ["Escola Marituba", 6.4, "0,95", "0,93"], ["Galpão BR-316", 4.1, "0,86", "0,81"]] as const;
  return (
    <Painel>
      <p className="mb-3 font-display text-lg font-semibold">Ranking das obras</p>
      <div className="space-y-2">
        {l.map(([n, idx, cpi, spi], i) => (
          <div key={n} className="grid grid-cols-[20px_1fr_44px_44px] items-center gap-2 text-xs">
            <span className="font-display text-base font-semibold text-muted">{i + 1}</span>
            <div><p className="font-medium">{n}</p><Barra v={idx * 10} cor={idx >= 7 ? "bg-ok" : idx >= 5 ? "bg-amarelo" : "bg-perigo"} /></div>
            <span className="text-right tabular-nums text-muted">CPI {cpi}</span>
            <span className="text-right tabular-nums text-muted">SPI {spi}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded bg-bg p-2 text-[11px] text-muted">Padrão encontrado: obras de orçamento menor fecham com desempenho de custo 7,5% melhor.</p>
    </Painel>
  );
}

function VisualPerfis() {
  const p = [["Dono da empresa", "tudo, em todas as obras"], ["Engenheiro", "gere as próprias obras e a equipe delas"], ["Encarregado", "ponto, diário e andamento das etapas"], ["Fiscal", "acompanha e registra ocorrências"], ["Cliente", "só visualiza o andamento"], ["Visitante", "demonstração, sem alterar nada"]];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {p.map(([r, d], i) => (
        <Painel key={r} className="flex items-start gap-3 p-3">
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold", i === 0 ? "bg-laranja text-laranja-fg" : "bg-bg text-laranja ring-1 ring-line")}>{r[0]}</span>
          <div><p className="text-sm font-semibold">{r}</p><p className="text-xs text-muted">{d}</p></div>
        </Painel>
      ))}
    </div>
  );
}

function VisualSeguranca() {
  const s = [["Senhas com bcrypt", "bloqueio após tentativas erradas"], ["Verificação em duas etapas", "código no app autenticador (TOTP)"], ["Dados sensíveis criptografados", "CPF e dados bancários com AES-256-GCM"], ["Trilha de auditoria", "quem fez o quê e quando, em toda ação crítica"], ["Acesso por obra", "ninguém enxerga obra que não é sua"], ["202 testes automatizados", "rodam a cada atualização do sistema"]];
  return (
    <div className="space-y-2">
      {s.map(([t, d]) => (
        <Painel key={t} className="flex items-center gap-3 p-3">
          <ShieldCheck className="shrink-0 text-ok" size={20} />
          <div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted">{d}</p></div>
        </Painel>
      ))}
    </div>
  );
}

function VisualMobilidade() {
  return (
    <div className="flex items-end justify-center gap-4">
      <div className="w-72 rounded-lg border-4 border-line bg-card p-2 shadow-2xl shadow-black/40">
        <div className="grid grid-cols-[50px_1fr] gap-2">
          <div className="space-y-1.5 rounded bg-asfalto p-1.5">{Array.from({ length: 5 }, (_, i) => <div key={i} className={cn("h-2 rounded-sm", i === 1 ? "bg-amarelo" : "bg-white/20")} />)}</div>
          <div className="space-y-1.5">{[70, 45, 85].map((v) => <div key={v} className="rounded bg-bg p-1.5"><Barra v={v} /></div>)}</div>
        </div>
      </div>
      <div className="w-24 rounded-2xl border-4 border-line bg-card p-1.5 shadow-2xl shadow-black/40">
        <div className="space-y-1.5">{[60, 30, 90].map((v) => <div key={v} className="rounded bg-bg p-1"><Barra v={v} /></div>)}</div>
        <div className="mt-2 grid grid-cols-4 gap-0.5 border-t border-line pt-1">{Array.from({ length: 4 }, (_, i) => <div key={i} className={cn("h-1.5 rounded-sm", i === 0 ? "bg-amarelo" : "bg-line")} />)}</div>
      </div>
    </div>
  );
}

function VisualRoadmap() {
  const r = [["Compras", "solicitação → aprovação por alçada → pedido → entrega lançada no custo", "regras já prontas"], ["Financeiro", "contas a pagar, fluxo de caixa e custo por etapa", ""], ["Documentos e contratos", "plantas, ART, laudos e aditivos por obra", ""], ["Segurança do trabalho", "EPIs, treinamentos e ocorrências", ""], ["Ponto offline", "marcação sem sinal, enviada quando a conexão voltar", ""]];
  return (
    <div className="relative space-y-3 pl-6">
      <div className="absolute bottom-2 left-2 top-2 w-px bg-line" />
      {r.map(([t, d, tag], i) => (
        <div key={t} className="relative">
          <span className={cn("absolute -left-[22px] top-1.5 h-3 w-3 rounded-full ring-4 ring-bg", i === 0 ? "bg-amarelo" : "bg-line")} />
          <p className="text-sm font-semibold">{t} {tag && <span className="ml-1 rounded bg-amarelo/20 px-1.5 py-0.5 text-[10px] font-semibold text-amarelo">{tag}</span>}</p>
          <p className="text-xs text-muted">{d}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------- roteiro --

const SLIDES: Slide[] = [
  { tipo: "capa" },
  { tipo: "problema" },
  { tipo: "visao" },
  { tipo: "funcao", icone: LayoutDashboard, modulo: "Painel geral", titulo: "Todas as obras numa tela só", frase: "O dono abre o sistema e sabe, em segundos, onde agir.",
    itens: ["Obras em andamento, atrasadas e valor total dos contratos", "Avanço físico e custo sobre o orçamento de cada obra", "Semáforo de prazo: no prazo, atenção ou atrasada", "Cada pessoa só vê as obras liberadas para ela"], visual: VisualPainel },
  { tipo: "funcao", icone: HardHat, modulo: "Obras", titulo: "A ficha completa de cada obra", frase: "Cliente, prazos, contrato, equipe e localização no mesmo lugar.",
    itens: ["Cadastro com cliente, engenheiro, área e valor do contrato", "Mapa com a localização exata do canteiro", "Situação da obra: planejamento, andamento, paralisada, concluída", "Atalhos para todos os módulos daquela obra"], visual: VisualObra },
  { tipo: "funcao", icone: Clock, modulo: "Controle de ponto", titulo: "Ponto com foto e GPS, direto do celular", frase: "Fim do ponto de papel e do “bati por ele”.",
    itens: ["Entrada, almoço e saída com foto da câmera do celular", "Só aceita a marcação dentro do raio da obra (padrão 150 m)", "Horário gravado pelo servidor, no fuso de Belém — não dá para adiantar o relógio", "Horas trabalhadas e horas extras calculadas automaticamente"], visual: VisualPonto },
  { tipo: "funcao", icone: NotebookPen, modulo: "Diário de obra", titulo: "O diário que se preenche sozinho", frase: "O encarregado só registra o que só ele sabe.",
    itens: ["Clima e temperatura buscados pela localização da obra", "Equipe do dia puxada do controle de ponto", "Só conclui com resumo, atividades e no mínimo 3 fotos", "Concluído = assinado e bloqueado; alerta de dia sem diário", "Relatório do período pronto para imprimir ou salvar em PDF"], visual: VisualDiario },
  { tipo: "funcao", icone: GanttChart, modulo: "Etapas e cronograma", titulo: "Cronograma vivo, planejado x realizado", frase: "Do MS Project para o canteiro, sem redigitar nada.",
    itens: ["Etapas em árvore com orçamento e % que somam sozinhos", "Gráfico de Gantt com a linha de hoje e atrasos em vermelho", "Dependências entre etapas e caminho crítico", "Importa MS Project (.xml) e Primavera P6 (.xer)", "Modelo pronto com 11 etapas típicas de obra"], visual: VisualGantt },
  { tipo: "funcao", icone: FileSpreadsheet, modulo: "Medições", titulo: "Boletim de medição em um clique", frase: "O que foi executado no período, pronto para faturar.",
    itens: ["Fecha a medição pelo andamento real das etapas", "Calcula o executado no período contra a medição anterior", "Histórico de todas as medições fechadas", "Boletim para imprimir ou enviar em PDF ao cliente"], visual: VisualMedicao },
  { tipo: "funcao", icone: TrendingUp, modulo: "Análise do projeto", titulo: "Valor agregado: o atraso antes de virar prejuízo", frase: "A mesma metodologia usada em grandes obras (PMBOK), sem planilha.",
    itens: ["Curva S: planejado, agregado e custo real", "CPI e SPI mostram se a obra gasta e anda como deveria", "Estimativa de custo e de data no término", "Baseline congelada: o atraso não some ao remanejar o cronograma"], visual: VisualAnalise },
  { tipo: "funcao", icone: ShieldAlert, modulo: "Riscos", titulo: "Riscos mapeados e tratados", frase: "Saber o que pode dar errado antes que dê.",
    itens: ["Matriz probabilidade × impacto 5×5", "Classificação automática: baixo, moderado, alto, crítico", "Acompanhamento: identificado, em mitigação, materializado, encerrado", "Índice de exposição a risco de cada obra"], visual: VisualRiscos },
  { tipo: "funcao", icone: Bot, modulo: "Assistente", titulo: "Um assistente que conhece a sua obra", frase: "Relatório executivo pronto e perguntas em linguagem natural.",
    itens: ["Resumo executivo escrito a partir dos dados reais da obra", "Funciona mesmo sem inteligência artificial contratada", "Com IA ativada, responde perguntas sobre prazo, custo e risco", "Dados pessoais e bancários nunca saem do sistema"], visual: VisualAssistente },
  { tipo: "funcao", icone: Scale, modulo: "Comparativo", titulo: "Compare obras e aprenda com o histórico", frase: "Qual obra vai bem, qual precisa de atenção — e por quê.",
    itens: ["Ranking por custo, prazo, avanço e exposição a risco", "Comparação com a média histórica da empresa", "Padrões encontrados automaticamente entre as obras", "Índice com pesos declarados, fácil de auditar"], visual: VisualComparativo },
  { tipo: "funcao", icone: Users, modulo: "Perfis de acesso", titulo: "Cada um vê e faz só o que deve", frase: "Seis perfis prontos, com permissões por obra.",
    itens: ["Dono, Engenheiro, Encarregado, Fiscal, Cliente e Visitante", "Permissões de ver, criar, editar, aprovar e exportar", "O cliente acompanha a obra sem ver custos internos", "Um mesmo usuário pode ter papéis diferentes em obras diferentes"], visual: VisualPerfis },
  { tipo: "funcao", icone: Lock, modulo: "Segurança", titulo: "Segurança levada a sério", frase: "Dados de funcionários e da empresa protegidos de ponta a ponta.",
    itens: ["Verificação em duas etapas opcional", "Dados pessoais criptografados, em linha com a LGPD", "Auditoria de todas as ações críticas", "Testes automáticos a cada atualização"], visual: VisualSeguranca },
  { tipo: "funcao", icone: Smartphone, modulo: "Em qualquer lugar", titulo: "No escritório e no canteiro", frase: "Computador, tablet ou celular — sem instalar nada da loja.",
    itens: ["Instala como aplicativo no celular (PWA)", "Menu lateral no computador, barra inferior no celular", "Tema claro e escuro", "Hospedado na nuvem, com servidores em São Paulo", "Relatórios para imprimir ou salvar em PDF"], visual: VisualMobilidade },
  { tipo: "funcao", icone: Rocket, modulo: "Próximos passos", titulo: "Um sistema que continua crescendo", frase: "A base já está pronta para os próximos módulos.",
    itens: ["Banco de dados já modelado para os módulos seguintes", "Compras com fluxo de aprovação por alçada de valor", "Financeiro e custo por etapa", "Prioridade definida junto com o cliente"], visual: VisualRoadmap },
  { tipo: "fim" },
];

const FUNCOES = SLIDES.map((s, i) => ({ s, i })).filter((x): x is { s: Extract<Slide, { tipo: "funcao" }>; i: number } => x.s.tipo === "funcao");

// ------------------------------------------------------------------- slides fixos --

function Capa() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-8 flex items-center gap-3">
        <NtechMarca className="h-12 w-12" />
        <span className="font-display text-2xl font-bold tracking-[0.18em] text-white">NTECH</span>
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">apresenta</span>
      </div>
      <div className="faixa-obra mb-6 h-3 w-48 rounded-sm" />
      <h1 className="font-display text-6xl font-semibold leading-none md:text-8xl">Obra Manager</h1>
      <p className="mt-5 max-w-xl text-lg text-muted md:text-2xl">O canteiro inteiro na palma da mão.</p>
      <p className="mt-10 text-sm text-muted">Pressione <Kbd>→</Kbd> para começar · <Kbd>F</Kbd> tela cheia</p>
    </div>
  );
}

function Problema() {
  const dores = [
    ["Ponto em papel", "Sem prova de quem estava na obra, nem de que horas chegou."],
    ["Diário esquecido", "Dias sem registro viram problema na hora da fiscalização ou do pleito."],
    ["Planilha e WhatsApp", "Cada obra num arquivo, informação espalhada, versão desatualizada."],
    ["Atraso descoberto tarde", "Quando o atraso aparece, o prejuízo já aconteceu."],
  ];
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col justify-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amarelo">O problema</p>
      <h2 className="font-display text-4xl font-semibold md:text-6xl">Obra gerida no improviso<br /><span className="text-laranja">custa caro.</span></h2>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {dores.map(([t, d]) => (
          <div key={t} className="rounded-lg border border-line bg-card p-5">
            <p className="font-display text-xl font-semibold">{t}</p>
            <p className="mt-1 text-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Visao({ ir }: { ir: (i: number) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col justify-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amarelo">A solução</p>
      <h2 className="font-display text-4xl font-semibold md:text-5xl">Um sistema, {FUNCOES.length - 1} funções, todas as obras.</h2>
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {FUNCOES.map(({ s, i }) => {
          const I = s.icone;
          return (
            <button key={s.modulo} onClick={() => ir(i)}
              className="group flex items-center gap-3 rounded-lg border border-line bg-card p-4 text-left transition hover:border-laranja">
              <I size={22} className="shrink-0 text-laranja" />
              <span className="font-semibold">{s.modulo}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">Clique em uma função para ir direto a ela.</p>
    </div>
  );
}

function Fim() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <NtechMarca className="mb-8 h-20 w-20" />
      <h2 className="font-display text-5xl font-semibold md:text-7xl">Vamos tirar a sua obra<br />da planilha?</h2>
      <p className="mt-6 max-w-xl text-lg text-muted">Implantação, treinamento da equipe e suporte pela NTECH.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded px-6 font-semibold" style={{ background: NTECH.neon, color: NTECH.fundo }}>
          <LogIn size={18} /> Ver o sistema funcionando
        </Link>
      </div>
      <div className="mt-10 flex gap-6 font-mono text-sm text-muted">
        <span>ntech.dev.br</span><span>@ntech.bel</span>
      </div>
    </div>
  );
}

function Funcao({ s, numero }: { s: Extract<Slide, { tipo: "funcao" }>; numero: number }) {
  const I = s.icone;
  const V = s.visual;
  return (
    <div className="mx-auto grid h-full max-w-6xl items-center gap-10 md:grid-cols-[1fr_1.05fr]">
      <div>
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-amarelo">
          <span className="grid h-9 w-9 place-items-center rounded bg-laranja text-laranja-fg"><I size={18} /></span>
          {String(numero).padStart(2, "0")} · {s.modulo}
        </p>
        <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">{s.titulo}</h2>
        <p className="mt-3 text-lg text-muted">{s.frase}</p>
        <ul className="mt-8 space-y-3">
          {s.itens.map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-laranja/20 text-laranja"><Check size={13} strokeWidth={3} /></span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="pointer-events-none select-none"><V /></div>
    </div>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) =>
  <kbd className="mx-0.5 rounded border border-line bg-card px-1.5 py-0.5 font-sans text-xs">{children}</kbd>;

// ----------------------------------------------------------------------- moldura --

export function Apresentacao() {
  const [atual, setAtual] = useState(0);
  const toque = useRef<number | null>(null);
  const total = SLIDES.length;

  const ir = useCallback((i: number) => {
    const n = Math.max(0, Math.min(total - 1, i));
    setAtual(n);
    history.replaceState(null, "", n ? `#${n + 1}` : location.pathname + location.search);
  }, [total]);

  useEffect(() => {
    const n = Number(location.hash.slice(1));
    if (n >= 1 && n <= total) setAtual(n - 1);
  }, [total]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Enter/espaço num botão focado é clique nele, não "avançar".
      if ((e.key === " " || e.key === "Enter") && (e.target as HTMLElement).closest("button, a")) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); ir(atual + 1); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); ir(atual - 1); }
      else if (e.key === "Home") ir(0);
      else if (e.key === "End") ir(total - 1);
      else if (e.key.toLowerCase() === "f") telaCheia();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [atual, ir, total]);

  function telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  const s = SLIDES[atual];
  const numeroFuncao = FUNCOES.findIndex((f) => f.i === atual) + 1;

  return (
    <div className="dark fixed inset-0 flex flex-col overflow-hidden bg-bg text-ink"
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current == null) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        if (Math.abs(dx) > 50) ir(atual + (dx < 0 ? 1 : -1));
        toque.current = null;
      }}>
      <div className="h-1 bg-card"><div className="h-full bg-laranja transition-all duration-300" style={{ width: `${((atual + 1) / total) * 100}%` }} /></div>

      <header className="flex items-center justify-between px-5 py-3 md:px-10">
        <div className="flex items-center gap-2 text-sm">
          <NtechMarca className="h-6 w-6" />
          <span className="font-display font-bold tracking-[0.14em] text-white">NTECH</span>
          <span className="text-muted">· Obra Manager</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={telaCheia} title="Tela cheia (F)" className="grid h-9 w-9 place-items-center rounded text-muted hover:bg-card hover:text-ink"><Maximize size={16} /><span className="sr-only">Tela cheia</span></button>
          <Link href="/login" className="hidden min-h-9 items-center gap-2 rounded border border-line px-3 text-sm font-semibold hover:border-laranja sm:inline-flex"><LogIn size={15} /> Entrar no sistema</Link>
        </div>
      </header>

      <main key={atual} className="slide-entra flex-1 overflow-y-auto px-5 pb-6 md:px-10" aria-live="polite">
        {s.tipo === "capa" && <Capa />}
        {s.tipo === "problema" && <Problema />}
        {s.tipo === "visao" && <Visao ir={ir} />}
        {s.tipo === "funcao" && <Funcao s={s} numero={numeroFuncao} />}
        {s.tipo === "fim" && <Fim />}
      </main>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 md:px-10">
        <button onClick={() => ir(atual - 1)} disabled={atual === 0}
          className="inline-flex min-h-10 items-center gap-1 rounded px-3 text-sm font-semibold hover:bg-card disabled:opacity-30"><ChevronLeft size={18} /> Anterior</button>
        <div className="hidden gap-1.5 md:flex" aria-label="Slides">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => ir(i)} aria-label={`Slide ${i + 1}`} aria-current={i === atual ? "step" : undefined}
              className={cn("h-2 rounded-full transition-all", i === atual ? "w-6 bg-laranja" : "w-2 bg-line hover:bg-muted")} />
          ))}
        </div>
        <span className="text-sm tabular-nums text-muted md:hidden">{atual + 1} / {total}</span>
        <button onClick={() => ir(atual + 1)} disabled={atual === total - 1}
          className="inline-flex min-h-10 items-center gap-1 rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg hover:brightness-110 disabled:opacity-30">Próximo <ChevronRight size={18} /></button>
      </footer>
    </div>
  );
}
