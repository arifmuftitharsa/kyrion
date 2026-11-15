import { bagian, kanonisasiVersi, type DataVersiTerlindung } from "./kanonis";

// Byte yang ditandatangani saat versi disahkan (F-32). Label domain di depan
// membuat payload ini tidak pernah sama dengan keluaran kanonisasiVersi (F-31).

export const LABEL_PENGESAHAN = "kyrion/pengesahan-versi/v1";

export interface MasukanPengesahan extends DataVersiTerlindung {
  approvedById: string;
  approvedAt: Date;
  /** ID kunci: 32 hex huruf kecil (lihat idKunci). */
  signingKeyId: string;
}

// Sama dengan UUID_PATTERN di kanonis.ts: tidak terikat versi UUID (v4 dan v7 diterima).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ID_KUNCI_PATTERN = /^[0-9a-f]{32}$/;

/** Pesan hanya menyebut nama field, tidak pernah nilainya. */
function wajib(sah: boolean, nama: keyof MasukanPengesahan): void {
  if (!sah) throw new RangeError(`Field tidak sah: ${nama}`);
}

/** Status adalah literal "SAH", bukan masukan. Melempar RangeError bila ada field tidak sah. */
export function bangunPayloadPengesahan(masukan: MasukanPengesahan): Buffer {
  wajib(UUID_PATTERN.test(masukan.approvedById), "approvedById");
  wajib(masukan.approvedAt instanceof Date && !Number.isNaN(masukan.approvedAt.getTime()), "approvedAt");
  wajib(ID_KUNCI_PATTERN.test(masukan.signingKeyId), "signingKeyId");

  const { id, regulationId, versionNumber, effectiveDate, fileSha256, fileName, fileSize } = masukan;
  return Buffer.concat([
    bagian(LABEL_PENGESAHAN),
    kanonisasiVersi({ id, regulationId, versionNumber, effectiveDate, fileSha256, fileName, fileSize }),
    bagian("SAH"),
    bagian(masukan.approvedById),
    bagian(masukan.approvedAt.toISOString()),
    bagian(masukan.signingKeyId),
  ]);
}
