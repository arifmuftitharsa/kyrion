import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES } from "../crypto/fingerprint";
import {
  PESAN_UKURAN_MAKS,
  ambilBerkasOpsional,
  melebihiBatasUkuran,
  sanitasiNamaBerkas,
  validasiBerkasPdf,
} from "./berkas-pdf";

const awalPdf = new TextEncoder().encode("%PDF-1.7\n");

describe("validasiBerkasPdf", () => {
  it("menolak berkas kosong", () => {
    expect(validasiBerkasPdf({ size: 0, awal: new Uint8Array() })).toBe("Berkas PDF kosong.");
  });

  it("menerima PDF tepat sebesar batas F-30", () => {
    expect(validasiBerkasPdf({ size: MAX_INPUT_BYTES, awal: awalPdf })).toBeUndefined();
  });

  it("menolak berkas satu byte di atas batas", () => {
    expect(validasiBerkasPdf({ size: MAX_INPUT_BYTES + 1, awal: awalPdf })).toBe(
      "Ukuran berkas maksimal 10 MB.",
    );
  });

  it.each([
    ["ZIP yang diberi ekstensi .pdf", Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0x14)],
    ["teks biasa", new TextEncoder().encode("halo dunia")],
    ["awalan %PDF tanpa tanda hubung", new TextEncoder().encode("%PDF")],
  ])("menolak %s", (_label, awal) => {
    expect(validasiBerkasPdf({ size: 100, awal })).toBe("Berkas bukan PDF yang valid.");
  });
});

describe("batas ukuran bersama klien dan server", () => {
  it("melebihiBatasUkuran: tepat di batas lolos, satu byte di atas tidak", () => {
    expect(melebihiBatasUkuran(MAX_INPUT_BYTES)).toBe(false);
    expect(melebihiBatasUkuran(MAX_INPUT_BYTES + 1)).toBe(true);
  });

  it("pesan klien sama dengan pesan galat server", () => {
    expect(PESAN_UKURAN_MAKS).toBe("Ukuran berkas maksimal 10 MB.");
    expect(validasiBerkasPdf({ size: MAX_INPUT_BYTES + 1, awal: awalPdf })).toBe(PESAN_UKURAN_MAKS);
  });
});

describe("ambilBerkasOpsional", () => {
  it("null bila field tidak ada", () => {
    expect(ambilBerkasOpsional(null)).toBeNull();
  });

  it("null bila nilainya string, bukan File", () => {
    expect(ambilBerkasOpsional("teks")).toBeNull();
  });

  it("null untuk File kosong tanpa nama (parser web biasa)", () => {
    expect(ambilBerkasOpsional(new File([], ""))).toBeNull();
  });

  it('null untuk File kosong bernama "undefined" (Server Action Next)', () => {
    // new File([], undefined) menghasilkan name "undefined", persis seperti busboy + React.
    expect(ambilBerkasOpsional(new File([], undefined as unknown as string))).toBeNull();
  });

  it("File bernama 0 byte dikembalikan agar galat 'kosong' tetap muncul", () => {
    const berkas = new File([], "kosong.pdf");
    expect(ambilBerkasOpsional(berkas)).toBe(berkas);
  });

  it("File bernama berisi dikembalikan", () => {
    const berkas = new File(["%PDF-1.7"], "pedoman.pdf");
    expect(ambilBerkasOpsional(berkas)).toBe(berkas);
  });
});

describe("sanitasiNamaBerkas", () => {
  it("membuang path", () => {
    expect(sanitasiNamaBerkas("../../etc/passwd")).toBe("passwd.pdf");
    expect(sanitasiNamaBerkas("C:\\Users\\a\\Pedoman.PDF")).toBe("Pedoman.pdf");
  });

  it("membuang tanda kutip dan karakter kontrol", () => {
    expect(sanitasiNamaBerkas('a"b\r\n.pdf')).toBe("ab.pdf");
  });

  it("memotong nama panjang dan tetap berakhiran .pdf", () => {
    const hasil = sanitasiNamaBerkas(`${"x".repeat(300)}.pdf`);
    expect(hasil.length).toBeLessThanOrEqual(120);
    expect(hasil.endsWith(".pdf")).toBe(true);
  });

  it("memberi nama bawaan bila kosong setelah dibersihkan", () => {
    expect(sanitasiNamaBerkas('""')).toBe("dokumen.pdf");
  });
});
