export const LOCALE = (import.meta.env.VITE_APP_LOCALE || 'es-CL').trim();

const SIMBOLO_MONEDA = (
  import.meta.env.VITE_APP_MONEDA_SIMBOLO || '$'
).trim();

const PALABRAS_IGNORADAS = new Set([
  'y',
  'e',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
]);

export function formatearMonto(valor: number | null | undefined): string {
  return `${SIMBOLO_MONEDA}${Math.round(Number(valor || 0)).toLocaleString(LOCALE)}`;
}

export function formatearMontoConSigno(valor: number | null | undefined): string {
  const absoluto = Math.abs(Math.round(Number(valor || 0)));
  const prefijo = Number(valor || 0) < 0 ? `-${SIMBOLO_MONEDA}` : SIMBOLO_MONEDA;

  return `${prefijo}${absoluto.toLocaleString(LOCALE)}`;
}

export function formatearNumero(valor: number | null | undefined): string {
  return Number(valor || 0).toLocaleString(LOCALE);
}

/**
 * Acepta fechas "YYYY-MM-DD" (les fija hora local 12:00 para evitar el
 * desfase de Date con UTC) o timestamps ISO completos (created_at, etc.).
 */
export function formatearFecha(valor: string): string {
  const fecha = new Date(valor.length <= 10 ? `${valor}T12:00:00` : valor);

  return fecha.toLocaleDateString(LOCALE);
}

/** Iniciales (hasta 2 letras) de un nombre, para usarlas como marca/logo. */
export function iniciales(nombre: string, maxLetras = 2): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra && !PALABRAS_IGNORADAS.has(palabra.toLowerCase()));

  if (palabras.length === 0) {
    return '';
  }

  return palabras
    .slice(0, maxLetras)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}
