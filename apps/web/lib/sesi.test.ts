import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@/lib/auth";
import { findActiveUserById } from "@/lib/data/users";
import { bacaSesi, wajibAdmin, wajibMasuk } from "./sesi";

// Modul asli (server-only, Next, Better Auth, Prisma) tidak pernah dimuat.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("@/lib/data/users", () => ({ findActiveUserById: vi.fn() }));

const getSession = vi.fn();
const userMock = vi.mocked(findActiveUserById);

const sesiAda = () => getSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "lama@x.id" } });
const dbPunya = (role: "ADMIN" | "SIVITAS") =>
  userMock.mockResolvedValue({ id: "u1", email: "db@kampus.ac.id", role });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuth).mockReturnValue({ api: { getSession } } as unknown as ReturnType<typeof getAuth>);
});

describe("bacaSesi", () => {
  it("tanpa sesi -> null", async () => {
    getSession.mockResolvedValue(null);
    expect(await bacaSesi()).toBeNull();
  });

  it("sesi ada tapi akun nonaktif atau hilang -> null", async () => {
    sesiAda();
    userMock.mockResolvedValue(undefined);
    expect(await bacaSesi()).toBeNull();
  });

  it("sesi sah -> userId, email, role dari DB, bukan dari sesi", async () => {
    sesiAda();
    dbPunya("SIVITAS");
    expect(await bacaSesi()).toEqual({ userId: "u1", email: "db@kampus.ac.id", role: "SIVITAS" });
  });
});

describe("wajibAdmin", () => {
  it("anonim -> redirect /masuk", async () => {
    getSession.mockResolvedValue(null);
    await expect(wajibAdmin()).rejects.toThrow("REDIRECT:/masuk");
  });

  it("SIVITAS -> notFound, bukan redirect", async () => {
    sesiAda();
    dbPunya("SIVITAS");
    await expect(wajibAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("ADMIN -> { id, email }", async () => {
    sesiAda();
    dbPunya("ADMIN");
    expect(await wajibAdmin()).toEqual({ id: "u1", email: "db@kampus.ac.id" });
  });
});

describe("wajibMasuk", () => {
  it("anonim -> redirect /masuk", async () => {
    getSession.mockResolvedValue(null);
    await expect(wajibMasuk()).rejects.toThrow("REDIRECT:/masuk");
  });

  it.each(["SIVITAS", "ADMIN"] as const)("%s -> sesi", async (role) => {
    sesiAda();
    dbPunya(role);
    expect(await wajibMasuk()).toEqual({ userId: "u1", email: "db@kampus.ac.id", role });
  });
});
