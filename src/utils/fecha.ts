/**
 * Devuelve una fecha YYYY-MM-DD usando la zona horaria local del navegador.
 * Evita el desfase que puede producir Date#toISOString() al trabajar en UTC.
 */
export function fechaLocalISO(fecha = new Date()): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function mesLocalISO(fecha = new Date()): string {
  return fechaLocalISO(fecha).slice(0, 7);
}
