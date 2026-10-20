import { connection } from "next/server";

export default async function UjiGalatPage() {
  // Dirender saat ada permintaan, bukan saat build. Kalau tidak,
  // galat ini akan menggagalkan npm run build.
  await connection();
  throw new Error("Koneksi ke sumber data gagal (galat uji)");
}