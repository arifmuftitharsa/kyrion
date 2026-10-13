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
