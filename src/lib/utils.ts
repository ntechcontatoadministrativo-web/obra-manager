import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export const brl = (v: number | string | { toString(): string }) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

export const dataBR = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(d));

/** Aceita "1.800.000,50", "1800000.50" ou "1800000". Retorna NaN se inválido. */
export function parseNumeroBR(texto: string): number {
  const t = texto.trim();
  if (!t) return NaN;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}
