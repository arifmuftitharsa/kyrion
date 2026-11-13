"use client";

import { useEffect, useRef, useState } from "react";
import { KODE_GALAT } from "@/lib/auth/kode-galat";
import { emailKampusSah, normalkanEmail } from "@/lib/domain/akun-kampus";
import { PESAN_KODE_TERKIRIM, petakanGalatMasuk, type GalatMasuk } from "@/lib/masuk/pesan";

const kolom = "mt-1 block w-full rounded border px-3 py-2";
const tombolUtama = "rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60";
const tombolTaut = "text-blue-800 underline underline-offset-4 disabled:opacity-60";

// Dikirim dari peramban agar pembatas laju Better Auth berlaku. null = sukses.
async function kirim(jalur: string, isi: Record<string, string>): Promise<GalatMasuk | null> {
  try {
    const res = await fetch(`/api/auth/${jalur}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isi),
    });
    if (res.ok) return null;
    const badan: unknown = await res.json().catch(() => null);
    const kode =
      typeof badan === "object" && badan !== null && "code" in badan && typeof badan.code === "string"
        ? badan.code
        : undefined;
    return { status: res.status, kode };
  } catch {
    return "jaringan";
  }
}

export default function FormMasuk() {
  const [langkah, setLangkah] = useState<"email" | "kode">("email");
  const [email, setEmail] = useState("");
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [menunggu, setMenunggu] = useState(false);
  const kodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (langkah === "kode") kodeRef.current?.focus();
  }, [langkah]);

  async function mintaKode(alamatMentah: string): Promise<boolean> {
    const alamat = normalkanEmail(alamatMentah);
    setPesan("");
    setGalat("");
    if (!emailKampusSah(alamat)) {
      setGalat(KODE_GALAT.EMAIL_BUKAN_KAMPUS.message);
      return false;
    }
    setMenunggu(true);
    const hasil = await kirim("email-otp/send-verification-otp", { email: alamat, type: "sign-in" });
    setMenunggu(false);
    if (hasil) {
      setGalat(petakanGalatMasuk(hasil));
      return false;
    }
    setEmail(alamat);
    setPesan(PESAN_KODE_TERKIRIM);
    return true;
  }

  async function kirimEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nilai = String(new FormData(e.currentTarget).get("email") ?? "");
    if (await mintaKode(nilai)) setLangkah("kode");
  }

  async function kirimKode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("kode") ?? "").trim();
    setPesan("");
    setGalat("");
    setMenunggu(true);
    const hasil = await kirim("sign-in/email-otp", { email, otp });
    if (hasil) {
      setMenunggu(false);
      setGalat(petakanGalatMasuk(hasil));
      return;
    }
    // Tanpa tujuan dari URL: halaman server /masuk yang mengalihkan menurut peran.
    window.location.assign(new URL("/masuk", window.location.origin));
  }

  function gantiAlamat() {
    setLangkah("email");
    setPesan("");
    setGalat("");
  }

  const status = (
    <p role="status" aria-live="polite" className={galat ? "text-sm text-red-700" : "text-sm"}>
      {galat || pesan}
    </p>
  );

  if (langkah === "email") {
    return (
      <form onSubmit={kirimEmail} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block font-medium">Email kampus</label>
          <input
            id="email" name="email" type="email" autoComplete="username"
            defaultValue={email} className={kolom} required
            aria-invalid={!!galat} aria-describedby="status-masuk"
          />
        </div>
        <button type="submit" disabled={menunggu} className={tombolUtama}>
          {menunggu ? "Mengirim..." : "Kirim kode"}
        </button>
        <div id="status-masuk">{status}</div>
      </form>
    );
  }

  return (
    <form onSubmit={kirimKode} className="mt-6 space-y-4">
      <p>Kode 6 digit dikirim ke <strong>{email}</strong>.</p>
      <div>
        <label htmlFor="kode" className="block font-medium">Kode</label>
        <input
          ref={kodeRef} id="kode" name="kode" type="text"
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          className={kolom} required
          aria-invalid={!!galat} aria-describedby="status-masuk"
        />
      </div>
      <button type="submit" disabled={menunggu} className={tombolUtama}>
        {menunggu ? "Memeriksa..." : "Masuk"}
      </button>
      <div className="flex gap-4">
        <button type="button" disabled={menunggu} onClick={() => mintaKode(email)} className={tombolTaut}>
          Kirim ulang kode
        </button>
        <button type="button" disabled={menunggu} onClick={gantiAlamat} className={tombolTaut}>
          Ganti alamat
        </button>
      </div>
      <div id="status-masuk">{status}</div>
    </form>
  );
}
