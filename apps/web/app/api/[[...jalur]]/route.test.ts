import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

const METODE = { GET, POST, PUT, PATCH, DELETE };

const panggil = (metode: keyof typeof METODE, url: string) =>
  METODE[metode](new Request(url, { method: metode }));

describe("jalur /api tak dikenal", () => {
  it.each(Object.keys(METODE) as (keyof typeof METODE)[])("%s -> 404 problem+json", async (metode) => {
    const respons = await panggil(metode, "http://localhost/api/v1/tidak-ada?x=1");
    expect(respons.status).toBe(404);
    expect(respons.headers.get("Content-Type")).toBe("application/problem+json");
    expect(respons.headers.get("Cache-Control")).toBe("no-store");
    expect(await respons.json()).toMatchObject({
      type: "/problems/not-found",
      status: 404,
      detail: "Sumber daya tidak ditemukan.",
      instance: "/api/v1/tidak-ada",
    });
  });

  it("/api polos -> 404 problem+json, instance /api", async () => {
    const respons = await panggil("GET", "http://localhost/api");
    expect(respons.status).toBe(404);
    expect((await respons.json()).instance).toBe("/api");
  });
});
