// Aturan akun kampus: fungsi murni, tanpa efek samping.

const DOMAIN_KAMPUS = new Set(["universitaspertamina.ac.id", "student.universitaspertamina.ac.id"]);

export function normalkanEmail(masukan: string): string {
  return masukan.trim().toLowerCase();
}

/**
 * Benar hanya bila email sudah normal, tepat satu "@", bagian lokal tidak kosong,
 * dan domain SAMA PERSIS dengan salah satu domain kampus (bukan pencocokan akhiran).
 */
export function emailKampusSah(email: string): boolean {
  if (email !== normalkanEmail(email)) return false;
  const bagian = email.split("@");
  if (bagian.length !== 2) return false;
  const [lokal, domain] = bagian;
  return lokal.length > 0 && DOMAIN_KAMPUS.has(domain);
}

/** Email Admin seed: dinormalkan, wajib email kampus sah. Galat hanya menyebut nama variabel, tidak nilainya. */
export function emailAdminSeed(mentah: string | undefined): string {
  const email = normalkanEmail(mentah ?? "");
  if (!emailKampusSah(email)) {
    throw new Error("ADMIN_SEED_EMAIL wajib diisi dengan alamat email kampus yang sah");
  }
  return email;
}
