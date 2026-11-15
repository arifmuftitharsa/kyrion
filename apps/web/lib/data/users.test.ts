import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { findActiveUserById } from "./users";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

const findFirst = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue({
    user: { findFirst },
  } as unknown as ReturnType<typeof getPrisma>);
});

describe("findActiveUserById", () => {
  it("where memuat id DAN isActive: true; select hanya id, email, role", async () => {
    findFirst.mockResolvedValue(null);
    await findActiveUserById("user-a");
    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true, email: true, role: true },
      where: { id: "user-a", isActive: true },
    });
  });

  it("akun nonaktif atau tidak ada (findFirst null) -> undefined", async () => {
    findFirst.mockResolvedValue(null);
    expect(await findActiveUserById("user-a")).toBeUndefined();
  });

  it.each(["ADMIN", "SIVITAS"] as const)("akun aktif %s -> baris apa adanya", async (role) => {
    const baris = { id: "user-a", email: "sivitas.uji.kyrion@student.universitaspertamina.ac.id", role };
    findFirst.mockResolvedValue(baris);
    expect(await findActiveUserById("user-a")).toEqual(baris);
  });
});
