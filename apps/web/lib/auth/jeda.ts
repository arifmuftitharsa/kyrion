// Jeda permintaan OTP per alamat. Memori proses: tiap instans server punya jedanya sendiri
// (shortcut: tidak dibagi antarproses, naikkan ke penyimpanan bersama bila server >1 instans).

export type JedaOtp = {
  /** true = diizinkan dan langsung dicatat; false = masih dalam jeda. */
  cobaCatat(email: string): boolean;
};

export function buatJedaOtp(opsi: {
  jam: () => number;
  jedaMs?: number;
  maksEntri?: number;
}): JedaOtp {
  const { jam, jedaMs = 60_000, maksEntri = 1000 } = opsi;
  const terakhir = new Map<string, number>();

  return {
    cobaCatat(email) {
      const sekarang = jam();
      // Map menjaga urutan sisip, jadi entri tertua selalu di depan.
      for (const [kunci, waktu] of terakhir) {
        if (sekarang - waktu < jedaMs) break;
        terakhir.delete(kunci);
      }
      const waktu = terakhir.get(email);
      if (waktu !== undefined && sekarang - waktu < jedaMs) return false;
      terakhir.delete(email); // sisip ulang agar urutan tetap menurut waktu
      if (terakhir.size >= maksEntri) {
        const tertua = terakhir.keys().next().value;
        if (tertua !== undefined) terakhir.delete(tertua);
      }
      terakhir.set(email, sekarang);
      return true;
    },
  };
}
