import { describe, expect, it } from "vitest";
import { buatJedaOtp } from "./jeda";

function buat(maksEntri?: number) {
  let t = 1_000_000;
  const jeda = buatJedaOtp({ jam: () => t, maksEntri });
  return { jeda, maju: (ms: number) => (t += ms) };
}

describe("buatJedaOtp", () => {
  it("menolak permintaan kedua dalam 60 detik", () => {
    const { jeda, maju } = buat();
    expect(jeda.cobaCatat("a@x")).toBe(true);
    maju(59_999);
    expect(jeda.cobaCatat("a@x")).toBe(false);
  });

  it("menerima lagi setelah 60 detik", () => {
    const { jeda, maju } = buat();
    jeda.cobaCatat("a@x");
    maju(60_000);
    expect(jeda.cobaCatat("a@x")).toBe(true);
  });

  it("penolakan tidak memperpanjang jeda", () => {
    const { jeda, maju } = buat();
    jeda.cobaCatat("a@x");
    maju(40_000);
    expect(jeda.cobaCatat("a@x")).toBe(false);
    maju(20_000);
    expect(jeda.cobaCatat("a@x")).toBe(true);
  });

  it("alamat berbeda tidak saling memengaruhi", () => {
    const { jeda } = buat();
    expect(jeda.cobaCatat("a@x")).toBe(true);
    expect(jeda.cobaCatat("b@x")).toBe(true);
  });

  it("menegakkan batas entri dengan membuang yang tertua", () => {
    const { jeda, maju } = buat(2);
    jeda.cobaCatat("a@x");
    maju(1);
    jeda.cobaCatat("b@x");
    maju(1);
    jeda.cobaCatat("c@x"); // a terbuang
    expect(jeda.cobaCatat("a@x")).toBe(true); // a lupa, b terbuang
    expect(jeda.cobaCatat("c@x")).toBe(false); // c masih tercatat
  });

  it("membersihkan entri kedaluwarsa sebelum menghitung batas", () => {
    const { jeda, maju } = buat(2);
    jeda.cobaCatat("a@x");
    jeda.cobaCatat("b@x");
    maju(60_000);
    jeda.cobaCatat("c@x"); // a, b kedaluwarsa dan dibersihkan, bukan dibuang paksa
    expect(jeda.cobaCatat("c@x")).toBe(false);
  });
});
