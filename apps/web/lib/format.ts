// Formatter dibuat sekali lalu dipakai ulang agar tidak membuat objek Intl
// di setiap render. timeZone "UTC" wajib: tanpa itu server dan browser bisa
// menghasilkan tanggal berbeda (zona waktu berbeda) dan memicu hydration mismatch.
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Mengubah "2025-08-01" menjadi "1 Agustus 2025". */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

const angkaFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Mengubah ukuran byte menjadi teks, mis. 1258291 menjadi "1,2 MB" (basis 1024). */
export function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${angkaFormatter.format(Math.round(bytes / 1024))} KB`;
  return `${angkaFormatter.format(bytes / (1024 * 1024))} MB`;
}
