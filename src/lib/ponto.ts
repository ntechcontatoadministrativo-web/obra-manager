/**
 * Regras puras do controle de ponto (sem banco), fáceis de testar.
 */
export type AcaoPonto = "ENTRADA" | "ALMOCO_SAIDA" | "ALMOCO_VOLTA" | "SAIDA";

export const ROTULO_ACAO: Record<AcaoPonto, string> = {
  ENTRADA: "Registrar entrada",
  ALMOCO_SAIDA: "Saí para o almoço",
  ALMOCO_VOLTA: "Voltei do almoço",
  SAIDA: "Registrar saída",
};

/** Entrada e saída exigem foto + GPS; o almoço só registra o horário. */
export const EXIGE_FOTO: Record<AcaoPonto, boolean> = {
  ENTRADA: true, ALMOCO_SAIDA: false, ALMOCO_VOLTA: false, SAIDA: true,
};

export interface RegistroDia {
  entradaEm: Date | null;
  almocoSaidaEm: Date | null;
  almocoVoltaEm: Date | null;
  saidaEm: Date | null;
}

/** Quais batidas fazem sentido agora, dado o que o funcionário já registrou hoje. */
export function acoesPermitidas(r: RegistroDia | null): AcaoPonto[] {
  if (!r || !r.entradaEm) return ["ENTRADA"];
  if (r.saidaEm) return [];
  if (r.almocoSaidaEm && !r.almocoVoltaEm) return ["ALMOCO_VOLTA"];
  if (!r.almocoSaidaEm) return ["ALMOCO_SAIDA", "SAIDA"];
  return ["SAIDA"];
}

// ---- Datas no fuso da obra (Brasil, sem horário de verão) ----
export const FUSO = "America/Belem";

/** "2026-10-06" no fuso local — o dia de trabalho, não o dia em UTC. */
export function dataLocalISO(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);
}
/** Coluna @db.Date: meia-noite UTC do dia local. */
export const dataParaBanco = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const dataISOValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const horaLocal = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(d);

// ---- Foto ----
export const FOTO_MAX_BYTES = 250 * 1024;

/** Aceita só JPEG em data URL, com assinatura de arquivo conferida e tamanho limitado. */
export function validarFoto(dataUrl: unknown): { ok: true } | { ok: false; erro: string } {
  if (typeof dataUrl !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl))
    return { ok: false, erro: "Foto inválida. Tire a foto de novo." };
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  if (bytes.length > FOTO_MAX_BYTES) return { ok: false, erro: "Foto muito grande. Tire a foto de novo." };
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    return { ok: false, erro: "Arquivo não é uma foto válida." };
  return { ok: true };
}
