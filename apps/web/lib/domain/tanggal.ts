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

/** Nama bulan untuk masukan tanggal; indeks 0 = Januari (nilai bulan 1). */
export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

const duaDigit = (angka: number) => String(angka).padStart(2, "0");

/**
 * Menyusun tanggal ISO "YYYY-MM-DD" dari tiga kolom terpisah, agar urutan
 * hari/bulan tidak bergantung bahasa browser. Validitas kalender (31 Juni,
 * 29 Februari) dicek terpisah oleh skema.
 */
export function susunTanggalIso(hari: number, bulan: number, tahun: number): string {
  return `${String(tahun).padStart(4, "0")}-${duaDigit(bulan)}-${duaDigit(hari)}`;
}

/** Kebalikan susunTanggalIso, untuk mengisi kolom form dari tanggal tersimpan. */
export function pecahTanggalIso(iso: string): { hari: number; bulan: number; tahun: number } {
  const [tahun, bulan, hari] = iso.split("-").map(Number);
  return { hari, bulan, tahun };
}
