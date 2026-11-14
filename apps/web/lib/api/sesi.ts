// Bentuk sesi untuk tampilan dan API: hanya id, waktu, dan penanda sesi ini.
export interface SesiRingkas {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export function petakanSesi(
  baris: { id: string; createdAt: Date; expiresAt: Date },
  sesiIdSaatIni: string,
): SesiRingkas {
  return {
    id: baris.id,
    createdAt: baris.createdAt.toISOString(),
    expiresAt: baris.expiresAt.toISOString(),
    current: baris.id === sesiIdSaatIni,
  };
}
