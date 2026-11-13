import { describe, expect, it } from "vitest";
import { bacaKonfigurasiAuth, GalatKonfigurasiAuth, type EnvAuth } from "./konfigurasi";

const RAHASIA = "r".repeat(32);
const valid: EnvAuth = { BETTER_AUTH_SECRET: RAHASIA, BETTER_AUTH_URL: "http://localhost:3000" };

function galatDari(env: EnvAuth): GalatKonfigurasiAuth {
  try {
    bacaKonfigurasiAuth(env);
  } catch (e) {
    expect(e).toBeInstanceOf(GalatKonfigurasiAuth);
    return e as GalatKonfigurasiAuth;
  }
  throw new Error("seharusnya melempar");
}

describe("bacaKonfigurasiAuth", () => {
  it("menerima env valid (http dan https)", () => {
    expect(bacaKonfigurasiAuth(valid)).toEqual(valid);
    expect(bacaKonfigurasiAuth({ ...valid, BETTER_AUTH_URL: "https://kyrion.contoh.test" }).BETTER_AUTH_URL).toBe(
      "https://kyrion.contoh.test",
    );
  });

  it.each([undefined, "", "pendek".repeat(5)])("menolak rahasia %j tanpa membocorkan nilainya", (s) => {
    const galat = galatDari({ ...valid, BETTER_AUTH_SECRET: s });
    expect(galat.variabel).toEqual(["BETTER_AUTH_SECRET"]);
    if (s) expect(galat.message).not.toContain(s);
  });

  it.each([undefined, "", "bukan-url", "ftp://contoh.test", "javascript:alert(1)"])("menolak URL %j", (u) => {
    expect(galatDari({ ...valid, BETTER_AUTH_URL: u }).variabel).toEqual(["BETTER_AUTH_URL"]);
  });

  it("menyebut kedua nama bila keduanya salah", () => {
    expect(galatDari({}).variabel).toEqual(["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"]);
  });
});
