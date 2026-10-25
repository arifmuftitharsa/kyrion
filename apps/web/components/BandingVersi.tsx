import { getPublicVersionsForComparison } from "@/lib/data/changes";
import { perubahanAntaraVersi, type GalatBanding } from "@/lib/domain/banding";
import { formatDate } from "@/lib/format";
import { skemaBanding } from "@/lib/skema";
import { focusRing } from "@/lib/styles";
import { SUMBER_PERUBAHAN_LABEL, VERSION_STATUS_LABEL, type Version } from "@/lib/types";

const PESAN_GALAT: Record<GalatBanding, string> = {
  VERSI_SAMA: "Pilih dua versi yang berbeda untuk dibandingkan.",
  // Sengaja tanpa kata "disahkan": Draf dan id asing mendapat pesan yang sama.
  TIDAK_DITEMUKAN: "Salah satu versi tidak ditemukan. Pilih dari daftar versi yang tersedia.",
};

const selectClass = `mt-1 block rounded border border-slate-300 px-3 py-2 ${focusRing}`;

interface BandingVersiProps {
  slug: string;
  /** Versi publik regulasi ini (SAH/DIGANTIKAN), untuk pilihan formulir. */
  versions: Version[];
  /** Nilai mentah query string; undefined bila belum ada pencarian. */
  dari?: string | string[];
  ke?: string | string[];
}

/** Perbandingan perubahan antarversi (F-04): formulir GET, hasil dirender di server. */
export default async function BandingVersi({ slug, versions, dari, ke }: BandingVersiProps) {
  const sudahBanding = dari !== undefined || ke !== undefined;
  const masukan = skemaBanding.safeParse({ dari, ke });

  let galat: string | undefined;
  let hasil: Awaited<ReturnType<typeof bandingkan>> | undefined;
  if (sudahBanding) {
    if (!masukan.success) {
      galat = masukan.error.issues[0].message;
    } else {
      hasil = await bandingkan(slug, masukan.data.dari, masukan.data.ke);
      if (!hasil.ok) galat = PESAN_GALAT[hasil.galat];
    }
  }

  return (
    <section
      id="banding"
      aria-labelledby="banding-judul"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 id="banding-judul" className="mb-4 text-xl font-semibold text-slate-900">
        Bandingkan Versi
      </h2>
      <form method="get" action={`/regulasi/${slug}#banding`} className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="dari" className="font-medium">Versi lama</label>
          <select
            id="dari" name="dari" required
            defaultValue={masukan.success ? masukan.data.dari : ""} className={selectClass}
          >
            <option value="">Pilih versi</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionNumber} ({VERSION_STATUS_LABEL[v.status]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ke" className="font-medium">Versi baru</label>
          <select
            id="ke" name="ke" required
            defaultValue={masukan.success ? masukan.data.ke : ""} className={selectClass}
          >
            <option value="">Pilih versi</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionNumber} ({VERSION_STATUS_LABEL[v.status]})
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={`rounded bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900 ${focusRing}`}
        >
          Bandingkan
        </button>
      </form>

      {galat && (
        <p role="alert" className="mt-4 font-medium text-red-800">{galat}</p>
      )}

      {hasil?.ok && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Perubahan dari versi {hasil.dari.versionNumber} ke versi {hasil.ke.versionNumber}
          </h3>
          {hasil.ditukar && (
            <p role="status" className="text-sm text-slate-700">
              Urutan dibalik: ditampilkan dari versi lama ke versi baru.
            </p>
          )}
          {hasil.kelompok.map(({ versi, perubahan }) => (
            <div key={versi.id}>
              <h4 className="font-semibold text-slate-900">
                Versi {versi.versionNumber}{" "}
                <span className="text-sm font-normal text-slate-600">
                  (berlaku sejak{" "}
                  <time dateTime={versi.effectiveDate}>{formatDate(versi.effectiveDate)}</time>)
                </span>
              </h4>
              {perubahan.length === 0 ? (
                <p className="text-slate-700">Tidak ada perubahan tercatat untuk versi ini.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-6 text-slate-800">
                  {perubahan.map((p) => (
                    <li key={p.id}>
                      {p.description}{" "}
                      <span className="text-sm text-slate-600">
                        ({SUMBER_PERUBAHAN_LABEL[p.source]}
                        {p.page !== null && `, hlm. ${p.page}`})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {hasil.kelompok.every((k) => k.perubahan.length === 0) && (
            <p className="text-slate-700">Tidak ada perubahan tercatat di antara kedua versi ini.</p>
          )}
          <p className="text-sm text-slate-600">Daftar ini dicatat manual oleh Admin.</p>
        </div>
      )}
    </section>
  );
}

async function bandingkan(slug: string, dari: string, ke: string) {
  return perubahanAntaraVersi(await getPublicVersionsForComparison(slug), dari, ke);
}
