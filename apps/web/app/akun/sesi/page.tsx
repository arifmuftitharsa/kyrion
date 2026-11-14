import type { Metadata } from "next";
import FormKonfirmasi from "@/components/FormKonfirmasi";
import { cabutSesiSaya } from "@/app/akun/sesi/actions";
import { petakanSesi } from "@/lib/api/sesi";
import { daftarSesiAktif } from "@/lib/data/sesi";
import { wajibMasuk } from "@/lib/sesi";

export const metadata: Metadata = { title: "Sesi Aktif | Kyrion" };

const waktu = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export default async function HalamanSesi() {
  const sesi = await wajibMasuk();
  const daftar = (await daftarSesiAktif(sesi.userId, new Date())).map((b) =>
    petakanSesi(b, sesi.sesiId),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-3xl font-bold">Sesi Aktif</h1>
      <p>Perangkat atau peramban yang sedang masuk dengan akun Anda. Waktu dalam WIB.</p>
      {daftar.length === 0 ? (
        <p>Tidak ada sesi aktif.</p>
      ) : (
        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {daftar.map((s) => (
            <li key={s.id} className="py-3">
              <p className="font-medium">
                Masuk {waktu.format(new Date(s.createdAt))}
                {s.current && <span className="ml-2 text-sm text-blue-800">(sesi ini)</span>}
              </p>
              <p className="text-sm text-slate-700">Berlaku sampai {waktu.format(new Date(s.expiresAt))}</p>
              <FormKonfirmasi
                aksi={cabutSesiSaya.bind(null, s.id)}
                labelTombol={s.current ? "Cabut sesi ini (keluar)" : `Cabut sesi masuk ${waktu.format(new Date(s.createdAt))}`}
                labelProses="Mencabut..."
                varian="bahaya"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
