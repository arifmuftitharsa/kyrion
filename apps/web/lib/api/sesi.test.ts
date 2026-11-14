import { describe, expect, it } from "vitest";
import { petakanSesi } from "./sesi";

const baris = {
  id: "s1",
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  expiresAt: new Date("2026-11-08T00:00:00.000Z"),
};

describe("petakanSesi", () => {
  it("hanya id, createdAt, expiresAt, current", () => {
    const hasil = petakanSesi({ ...baris, token: "rahasia", ipAddress: "1.2.3.4", userAgent: "UA" } as typeof baris, "s1");
    expect(hasil).toEqual({
      id: "s1",
      createdAt: "2026-11-01T00:00:00.000Z",
      expiresAt: "2026-11-08T00:00:00.000Z",
      current: true,
    });
    expect(JSON.stringify(hasil)).not.toMatch(/rahasia|1\.2\.3\.4|UA/);
  });

  it("current false untuk sesi lain", () => {
    expect(petakanSesi(baris, "s2").current).toBe(false);
  });
});
