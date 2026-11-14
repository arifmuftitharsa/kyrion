import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { originSah, periksaOrigin } from "./origin";

const SAH = "http://localhost:3000";

describe("originSah", () => {
  it("sama persis -> sah", () => {
    expect(originSah(SAH, SAH)).toBe(true);
  });

  it.each([
    ["beda host", "http://evil.example"],
    ["beda port", "http://localhost:3001"],
    ["beda skema", "https://localhost:3000"],
    ["subdomain", "http://a.localhost:3000"],
    ["null", "null"],
    ["kosong", ""],
  ])("%s -> tidak sah", (_nama, origin) => {
    expect(originSah(origin, SAH)).toBe(false);
  });

  it("tanpa header -> tidak sah", () => {
    expect(originSah(null, SAH)).toBe(false);
  });
});

describe("periksaOrigin", () => {
  beforeEach(() => {
    // Nilai tiruan; env asli tidak dibaca.
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  });
  afterEach(() => vi.unstubAllEnvs());

  const buat = (origin?: string) =>
    new Request("http://localhost:3000/api/v1/x", {
      method: "POST",
      headers: origin === undefined ? {} : { Origin: origin },
    });

  it("Origin sah -> null", () => {
    expect(periksaOrigin(buat(SAH))).toBeNull();
  });

  it.each([["https://evil.example"], [undefined], ["null"]])("Origin %s -> 403 problem+json", async (origin) => {
    const respons = periksaOrigin(buat(origin));
    expect(respons?.status).toBe(403);
    expect(respons?.headers.get("Content-Type")).toBe("application/problem+json");
    expect((await respons?.json()).detail).toBe("Origin tidak diizinkan.");
  });

  it("BETTER_AUTH_URL ber-path tetap dibandingkan sebagai origin", () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000/base");
    expect(periksaOrigin(buat(SAH))).toBeNull();
  });
});
