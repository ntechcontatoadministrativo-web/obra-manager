/**
 * Validação de localização do ponto: distância (Haversine) entre o
 * registro do funcionário e o centro da obra.
 */
const RAIO_TERRA_M = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Retorna true/false se há coordenadas dos dois lados; null quando não dá
 * para validar (obra sem coordenadas ou GPS negado) — o chamador decide
 * se exige justificativa nesse caso.
 */
export function dentroDoRaio(
  ponto: { lat?: number | null; lng?: number | null },
  obra: { lat?: number | null; lng?: number | null },
  raioMetros: number,
): boolean | null {
  if (ponto.lat == null || ponto.lng == null || obra.lat == null || obra.lng == null) return null;
  return distanciaMetros(ponto.lat, ponto.lng, obra.lat, obra.lng) <= raioMetros;
}
