import type { DataVersiTerlindung } from "./kanonis";
import type { Penandatangan } from "./penandatangan";
import { bangunPayloadPengesahan } from "./payload-pengesahan";
import { tandatangani } from "./tanda-tangan";

/** Tanda tangan 64 byte atas payload pengesahan; signingKeyId diambil dari penandatangan. */
export function tandatanganiPengesahan(masukan: {
  penandatangan: Penandatangan;
  versi: DataVersiTerlindung;
  approvedById: string;
  approvedAt: Date;
}): Buffer {
  const { penandatangan, versi, approvedById, approvedAt } = masukan;
  const payload = bangunPayloadPengesahan({ ...versi, approvedById, approvedAt, signingKeyId: penandatangan.idKunci });
  return tandatangani(payload, penandatangan.kunciPrivat);
}
