import "server-only";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/crypto/password";
import { findUserForLogin } from "@/lib/data/users";

// Hash tiruan dengan parameter yang sama, dihitung sekali per proses. Dipakai
// saat email tidak terdaftar agar waktu respons tidak membocorkan email mana
// yang ada (kerja scrypt sama di semua jalur gagal).
let hashTiruan: Promise<string> | undefined;
function ambilHashTiruan(): Promise<string> {
  hashTiruan ??= hashPassword(randomBytes(32).toString("base64"));
  return hashTiruan;
}

/**
 * Admin aktif bila kredensial cocok; null untuk semua kegagalan, sehingga
 * pemanggil menampilkan satu pesan yang sama. Email harus sudah huruf kecil.
 */
export async function verifikasiKredensialAdmin(
  email: string,
  kataSandi: string,
): Promise<{ id: string; role: "ADMIN" } | null> {
  const user = await findUserForLogin(email);
  // Verifikasi SELALU dijalankan sekali, juga untuk akun tanpa kata sandi (SSO).
  const cocok = await verifyPassword(kataSandi, user?.passwordHash ?? (await ambilHashTiruan()));
  if (!user?.passwordHash || !cocok || !user.isActive || user.role !== "ADMIN") return null;
  return { id: user.id, role: "ADMIN" };
}
