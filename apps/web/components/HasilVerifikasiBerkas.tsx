import {
  JUDUL_HASIL,
  TEKS_ALASAN,
  type HasilVerifikasi,
} from "@/lib/crypto/hasil-verifikasi";

// Hasil dinyatakan dengan kata (judul + alasan); warna hanya penguat.
const KELAS = {
  "asli-sah": "border-green-700 bg-green-50",
  "asli-digantikan": "border-amber-700 bg-amber-50",
  "tidak-cocok": "border-red-700 bg-red-50",
} as const;

export default function HasilVerifikasiBerkas({ hasil }: { hasil: HasilVerifikasi[] }) {
  return (
    <ul className="mt-6 space-y-4">
      {hasil.map((h, i) => (
        <li key={i} className={`rounded-lg border-2 p-4 ${KELAS[h.hasil]}`}>
          <h2 className="text-lg font-semibold">Hasil: {JUDUL_HASIL[h.hasil]}</h2>
          <p className="mt-1">{TEKS_ALASAN[h.alasan]}</p>
          {h.versi && (
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
              <dt className="font-medium">Regulasi</dt>
              <dd>{h.versi.regulasi}</dd>
              <dt className="font-medium">Versi</dt>
              <dd>{h.versi.nomorVersi}</dd>
              <dt className="font-medium">Tanggal berlaku</dt>
              <dd>{h.versi.tanggalBerlaku}</dd>
              {h.versi.status && (
                <>
                  <dt className="font-medium">Status</dt>
                  <dd>{h.versi.status === "SAH" ? "Sah" : "Digantikan"}</dd>
                </>
              )}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
