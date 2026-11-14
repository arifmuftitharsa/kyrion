import { describe, expect, it } from "vitest";
import { type Keputusan, type Syarat, putuskanAkses } from "./keputusan";

describe("putuskanAkses", () => {
  it.each<[string, { role: string } | null, Syarat, Keputusan]>([
    ["anonim, syarat masuk", null, "masuk", "masuk"],
    ["anonim, syarat admin", null, "admin", "masuk"],
    ["SIVITAS, syarat masuk", { role: "SIVITAS" }, "masuk", "izinkan"],
    ["SIVITAS, syarat admin", { role: "SIVITAS" }, "admin", "tolak"],
    ["ADMIN, syarat masuk", { role: "ADMIN" }, "masuk", "izinkan"],
    ["ADMIN, syarat admin", { role: "ADMIN" }, "admin", "izinkan"],
    ["peran tak dikenal, syarat masuk", { role: "TAMU" }, "masuk", "tolak"],
    ["peran tak dikenal, syarat admin", { role: "TAMU" }, "admin", "tolak"],
  ])("%s", (_nama, sesi, syarat, harapan) => {
    expect(putuskanAkses(sesi, syarat)).toBe(harapan);
  });
});
