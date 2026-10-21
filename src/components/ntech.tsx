import { cn } from "@/lib/utils";

/** Cores da marca NTECH. Ficam fora da paleta do tema de propósito: a marca não muda no modo escuro. */
export const NTECH = { neon: "#5CFF4F", fundo: "#0B0F0E" } as const;

export function NtechMarca({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill={NTECH.neon} />
      <path d="M18 46V22c0-3 2-5 5-5s4 1 5 3l9 16V18h9v24c0 3-2 5-5 5s-4-1-5-3l-9-16v18z" fill={NTECH.fundo} />
    </svg>
  );
}

/** Assinatura discreta "desenvolvido por NTECH", para rodapés e menu. */
export function AssinaturaNtech({ className }: { className?: string }) {
  return (
    <a href="https://ntech.dev.br" target="_blank" rel="noreferrer"
      className={cn("inline-flex items-center gap-2 text-xs opacity-70 transition hover:opacity-100", className)}>
      <NtechMarca className="h-4 w-4" />
      <span>desenvolvido por <strong className="font-semibold tracking-[0.08em]">NTECH</strong></span>
    </a>
  );
}
