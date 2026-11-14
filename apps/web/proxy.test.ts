import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

vi.mock("better-auth/cookies", () => ({ getSessionCookie: vi.fn() }));

const cookieMock = vi.mocked(getSessionCookie);

// Hanya pendekatan atas sintaks path-to-regexp Next (anchor ^...$ pada RegExp biasa).
// Buktinya sebenarnya curl terhadap server nyata di tahap 5d.
const cocok = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

describe("config.matcher", () => {
  it.each(["/", "/regulasi/x", "/admin/regulasi", "/masukan", "/apiary"])("cocok %s", (p) =>
    expect(cocok(p)).toBe(true),
  );

  it.each([
    "/masuk", "/masuk/x", "/api/auth/x", "/api/v1/regulations", "/_next/static/a.js", "/favicon.ico",
  ])("tidak cocok %s", (p) => expect(cocok(p)).toBe(false));
});

describe("proxy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tanpa cookie sesi -> redirect ke /masuk", () => {
    cookieMock.mockReturnValue(null);
    const res = proxy(new Request("http://localhost/regulasi/x") as never);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/masuk");
  });

  it("dengan cookie sesi -> lanjut", () => {
    cookieMock.mockReturnValue("token");
    const res = proxy(new Request("http://localhost/regulasi/x") as never);
    expect(res.headers.get("x-middleware-next")).toBe(NextResponse.next().headers.get("x-middleware-next"));
    expect(res.headers.get("location")).toBeNull();
  });
});
