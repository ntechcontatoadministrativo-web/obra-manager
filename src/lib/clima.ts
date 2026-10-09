/**
 * Tempo do dia para o Diário de Obra.
 * Fonte: Open-Meteo (gratuito, sem chave; uso gratuito é só para fins NÃO comerciais —
 * para uso comercial é preciso uma chave paga deles). Se falhar, o preenchimento é manual.
 */
export type ClimaDia = "ENSOLARADO" | "NUBLADO" | "CHUVOSO" | "TEMPESTADE";
export type ImpactoClima = "SEM_IMPACTO" | "PRODUCAO_REDUZIDA" | "PARALISACAO_PARCIAL" | "PARALISACAO_TOTAL";

/** Códigos WMO usados pelo Open-Meteo → as 4 opções do diário. */
export function climaDoCodigoWMO(code: number): ClimaDia {
  if (code >= 95) return "TEMPESTADE";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) return "CHUVOSO";
  if (code <= 2) return "ENSOLARADO";
  return "NUBLADO"; // 3 (encoberto), 45/48 (neblina)
}

/** Só uma SUGESTÃO: quem preenche confirma ou muda. */
export function impactoSugerido(chuvaMm: number, clima: ClimaDia): ImpactoClima {
  if (chuvaMm > 25) return "PARALISACAO_PARCIAL";
  if (chuvaMm >= 5 || clima === "TEMPESTADE") return "PRODUCAO_REDUZIDA";
  return "SEM_IMPACTO";
}

export interface TempoDoDia {
  clima: ClimaDia;
  temperaturaC: number;
  chuvaMm: number;
  impacto: ImpactoClima;
  nota: string;
}

export function interpretarOpenMeteo(json: unknown): TempoDoDia | null {
  const d = (json as { daily?: Record<string, unknown[]> })?.daily;
  const code = Number(d?.weather_code?.[0]);
  const temp = Number(d?.temperature_2m_max?.[0]);
  const chuva = Number(d?.precipitation_sum?.[0] ?? 0);
  if (!Number.isFinite(code) || !Number.isFinite(temp) || !Number.isFinite(chuva)) return null;
  const clima = climaDoCodigoWMO(code);
  return {
    clima,
    temperaturaC: Math.round(temp),
    chuvaMm: Math.round(chuva * 10) / 10,
    impacto: impactoSugerido(chuva, clima),
    nota: chuva > 0 ? `Chuva no dia: ${chuva.toFixed(1).replace(".", ",")} mm (Open-Meteo).` : "Sem chuva registrada (Open-Meteo).",
  };
}

export async function buscarTempoDoDia(lat: number, lng: number, diaISO: string): Promise<TempoDoDia | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(lat), longitude: String(lng),
    daily: "weather_code,temperature_2m_max,precipitation_sum",
    timezone: "America/Belem", start_date: diaISO, end_date: diaISO,
  }).toString();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) return null;
    return interpretarOpenMeteo(await r.json());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
