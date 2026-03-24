/** Konvertiert deutschen Zahlenwert (z.B. "17.214,44") in float. */
export function parseGermanFloat(s: string): number {
  return parseFloat(s.trim().replace(/\./g, "").replace(",", "."));
}

/** Konvertiert deutschen Zahlenwert (z.B. "1.234" oder "-1.234") in int. */
export function parseGermanInt(s: string): number {
  return parseInt(s.trim().replace(/\./g, ""), 10);
}

/** Formatiert float als deutschen Zahlenwert, z.B. 17214.44 -> "17.214,44". */
export function formatGermanFloat(val: number): string {
  const s = val.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return s;
}
