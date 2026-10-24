// Formatter dibuat sekali lalu dipakai ulang. Locale "en-CA" menghasilkan
// format ISO "YYYY-MM-DD", dan timeZone memastikan tanggal mengikuti WIB.
const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
});

/**
 * Tanggal kalender di zona Asia/Jakarta (WIB) pada saat `now`, dalam format
 * ISO "YYYY-MM-DD". `now` diteruskan oleh pemanggil agar fungsi tetap murni.
 */
export function todayInJakarta(now: Date): string {
  return jakartaDateFormatter.format(now);
}
