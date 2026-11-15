import { describe, expect, it } from "vitest";
import { kanonisasiVersi } from "./kanonis";
import { bangunPayloadPengesahan, type MasukanPengesahan } from "./payload-pengesahan";

// DATA SINTETIS.
const DASAR: MasukanPengesahan = {
  id: "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b",
  regulationId: "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c",
  versionNumber: "1.0",
  effectiveDate: "2026-01-15",
  fileSha256: "a".repeat(64),
  fileName: "peraturan.pdf",
  fileSize: 1234,
  approvedById: "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2d",
  approvedAt: new Date("2026-02-01T10:20:30.123Z"),
  signingKeyId: "b".repeat(32),
};

describe("bangunPayloadPengesahan", () => {
  it("deterministik", () => {
    expect(bangunPayloadPengesahan(DASAR).equals(bangunPayloadPengesahan({ ...DASAR }))).toBe(true);
  });

  const ubahan: [keyof MasukanPengesahan, MasukanPengesahan[keyof MasukanPengesahan]][] = [
    ["id", "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a99"],
    ["regulationId", "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a98"],
    ["versionNumber", "2.0"],
    ["effectiveDate", "2026-01-16"],
    ["fileSha256", "c".repeat(64)],
    ["fileName", "lain.pdf"],
    ["fileSize", 1235],
    ["approvedById", "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a97"],
    ["approvedAt", new Date("2026-02-01T10:20:31.123Z")],
    ["signingKeyId", "d".repeat(32)],
  ];

  it.each(ubahan)("mengubah %s mengubah payload", (field, nilai) => {
    const lain = bangunPayloadPengesahan({ ...DASAR, [field]: nilai });
    expect(lain.equals(bangunPayloadPengesahan(DASAR))).toBe(false);
  });

  it("approvedAt beda 1 ms: berbeda", () => {
    const lain = bangunPayloadPengesahan({ ...DASAR, approvedAt: new Date(DASAR.approvedAt.getTime() + 1) });
    expect(lain.equals(bangunPayloadPengesahan(DASAR))).toBe(false);
  });

  it("berbeda dari kanonisasiVersi dengan tujuh field sama (pemisah domain)", () => {
    const { id, regulationId, versionNumber, effectiveDate, fileSha256, fileName, fileSize } = DASAR;
    const f31 = kanonisasiVersi({ id, regulationId, versionNumber, effectiveDate, fileSha256, fileName, fileSize });
    expect(bangunPayloadPengesahan(DASAR).equals(f31)).toBe(false);
  });

  it("menolak Date tidak valid", () => {
    expect(() => bangunPayloadPengesahan({ ...DASAR, approvedAt: new Date("x") })).toThrow(RangeError);
  });

  it("menolak approvedById bukan UUID, pesan tanpa nilai", () => {
    expect(() => bangunPayloadPengesahan({ ...DASAR, approvedById: "rahasia-bukan-uuid" })).toThrow(
      /approvedById/,
    );
    expect(() => bangunPayloadPengesahan({ ...DASAR, approvedById: "rahasia-bukan-uuid" })).not.toThrow(
      /rahasia/,
    );
  });

  it("menerima approvedById UUIDv4 dan UUIDv7", () => {
    const v4 = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
    const v7 = "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2d";
    expect(() => bangunPayloadPengesahan({ ...DASAR, approvedById: v4 })).not.toThrow();
    expect(() => bangunPayloadPengesahan({ ...DASAR, approvedById: v7 })).not.toThrow();
  });

  it.each(["abc", "B".repeat(32), "b".repeat(31), "b".repeat(33), "g".repeat(32)])(
    "menolak signingKeyId bukan 32 hex huruf kecil: %s",
    (kunci) => {
      expect(() => bangunPayloadPengesahan({ ...DASAR, signingKeyId: kunci })).toThrow(/signingKeyId/);
    },
  );
});
