import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------- Botão ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "contorno" | "fantasma" | "perigo" };
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { className, variante = "primario", ...p }, ref,
) {
  const v = {
    primario: "bg-laranja text-laranja-fg hover:brightness-110",
    contorno: "border border-line bg-card text-ink hover:bg-bg",
    fantasma: "text-ink hover:bg-bg",
    perigo: "bg-perigo text-white hover:brightness-110",
  }[variante];
  return (
    <button ref={ref} {...p}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none", v, className)} />
  );
});

/* ---------- Campos ---------- */
const campo = "min-h-11 w-full rounded border border-line bg-card px-3 text-base text-ink placeholder:text-muted/70";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) { return <input ref={ref} className={cn(campo, className)} {...p} />; });
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={cn(campo, "min-h-24 py-2", p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className={cn(campo, p.className)} />;

export function Campo({ label, erro, dica, children }: { label: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {dica && !erro && <span className="block text-xs text-muted">{dica}</span>}
      {erro && <span role="alert" className="block text-xs font-medium text-perigo">{erro}</span>}
    </label>
  );
}

/* ---------- Cartão ---------- */
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
  <div {...p} className={cn("rounded-md border border-line bg-card", className)} />;

/* ---------- Selo de status ---------- */
const TONS = {
  neutro: "bg-bg text-muted border-line",
  ok: "bg-ok/10 text-ok border-ok/30",
  alerta: "bg-amarelo/20 text-alerta border-amarelo/50",
  perigo: "bg-perigo/10 text-perigo border-perigo/30",
  info: "bg-laranja/10 text-laranja border-laranja/30",
};
export const Badge = ({ tom = "neutro", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tom?: keyof typeof TONS }) =>
  <span {...p} className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold", TONS[tom], className)} />;

/* ---------- Barra de progresso (régua de obra: marcas a cada 10%) ---------- */
export function Progresso({ valor, rotulo, tom = "laranja" }: { valor: number; rotulo: string; tom?: "laranja" | "ok" | "alerta" | "perigo" }) {
  const v = Math.max(0, Math.min(100, valor));
  const cor = { laranja: "bg-laranja", ok: "bg-ok", alerta: "bg-amarelo", perigo: "bg-perigo" }[tom];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted">{rotulo}</span>
        <span className="font-display text-base font-semibold tabular-nums">{v.toFixed(1).replace(".", ",")}%</span>
      </div>
      <div role="progressbar" aria-label={rotulo} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}
        className="relative h-3 overflow-hidden rounded-sm bg-bg ring-1 ring-line">
        <div className={cn("h-full", cor)} style={{ width: `${v}%` }} />
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgb(var(--card)) calc(10% - 1px) 10%)" }} />
      </div>
    </div>
  );
}

export const TITULO = "font-display text-2xl font-semibold tracking-tight md:text-3xl";
