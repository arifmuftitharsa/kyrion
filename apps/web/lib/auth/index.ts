import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { emailKampusSah } from "@/lib/domain/akun-kampus";
import { getPengirimEmail } from "@/lib/email";
import { GalatPengirimEmail } from "@/lib/email/pengirim";
import { getPrisma } from "@/lib/prisma";
import { bacaKonfigurasiAuth } from "./konfigurasi";
import { permintaanDiizinkan } from "./izin";
import { buatJedaOtp } from "./jeda";
import { KODE_GALAT } from "./kode-galat";
import { hashOtp, turunkanKunciOtp } from "./otp";

// Titik masuk tunggal ke env untuk Better Auth. Dibuat malas pada pemanggilan pertama, bukan
// saat impor, agar build dan test tidak butuh env. Hanya hasil sukses yang di-cache.

const JALUR_OTP = ["/email-otp/send-verification-otp", "/sign-in/email-otp"];
// Di globalThis agar jeda tidak hilang saat Fast Refresh memuat ulang modul.
const g = globalThis as unknown as { jedaOtp?: ReturnType<typeof buatJedaOtp> };
const jedaOtp = (g.jedaOtp ??= buatJedaOtp({ jam: Date.now }));

/** Hanya nama galat serta alasan/status; OTP, alamat, dan isi email tidak pernah dicatat. */
function catatGalatKirim(e: unknown): void {
  console.error(
    "Pengiriman OTP gagal:",
    e instanceof GalatPengirimEmail
      ? { nama: e.name, alasan: e.alasan, status: e.status }
      : { nama: e instanceof Error ? e.name : "Tak dikenal" },
  );
}

function kirimOtpTanpaMenunggu(email: string, otp: string): void {
  try {
    getPengirimEmail()
      .kirim({
        penerima: email,
        subjek: "Kode masuk Kyrion",
        teks: `Kode masuk Kyrion Anda: ${otp}. Kode berlaku 5 menit.`,
      })
      .catch(catatGalatKirim);
  } catch (e) {
    catatGalatKirim(e);
  }
}

function buatAuth() {
  const { BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: baseURL } = bacaKonfigurasiAuth(process.env);
  const kunciOtp = turunkanKunciOtp(secret);

  return betterAuth({
    secret,
    baseURL,
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    // ID dibuat basis data (uuidv7), bukan Better Auth.
    advanced: { database: { generateId: "uuid" } },
    // Tanpa input: peran tidak bisa diisi dari API; DB memberi default SIVITAS.
    user: { additionalFields: { role: { type: ["ADMIN", "SIVITAS"], required: false, input: false } } },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    rateLimit: {
      storage: "memory",
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 3 },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        disableSignUp: false,
        storeOTP: { hash: async (otp) => hashOtp(kunciOtp, otp) },
        // Tidak menunggu pengiriman (hindari timing attack); tipe selain sign-in diabaikan.
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") return;
          kirimOtpTanpaMenunggu(email, otp);
        },
      }),
      nextCookies(), // wajib terakhir
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Tanpa ctx.request = panggilan auth.api.* dari kode server kita; permintaan HTTP selalu
        // membawanya, jadi hanya path+metode di allowlist yang dilayani. Berjalan sebelum handler.
        if (!permintaanDiizinkan(ctx.path, ctx.request?.method)) {
          throw new APIError("NOT_FOUND", { message: "Not Found" });
        }
        if (!JALUR_OTP.includes(ctx.path)) return;
        const body = ctx.body as { email?: unknown; type?: unknown } | undefined;
        if (typeof body?.email !== "string" || !emailKampusSah(body.email)) {
          throw APIError.from("BAD_REQUEST", KODE_GALAT.EMAIL_BUKAN_KAMPUS);
        }
        if (ctx.path !== "/email-otp/send-verification-otp") return;
        // Hanya OTP sign-in yang boleh dibuat.
        if (body.type !== "sign-in") {
          throw APIError.from("BAD_REQUEST", KODE_GALAT.TIPE_OTP_TIDAK_DIDUKUNG);
        }
        // Terakhir: jeda dicatat hanya bila semua pemeriksaan lain lolos.
        if (!jedaOtp.cobaCatat(body.email)) {
          throw APIError.from("TOO_MANY_REQUESTS", KODE_GALAT.JEDA_OTP);
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // throw (bukan return false) agar respons 4xx, bukan 500 dari create() yang null.
          before: async (user) => {
            if (!emailKampusSah(user.email)) throw APIError.from("BAD_REQUEST", KODE_GALAT.EMAIL_BUKAN_KAMPUS);
          },
        },
      },
      session: {
        create: {
          before: async (sesi) => {
            const pengguna = await getPrisma().user.findUnique({
              where: { id: sesi.userId },
              select: { isActive: true },
            });
            if (!pengguna?.isActive) throw APIError.from("FORBIDDEN", KODE_GALAT.AKUN_TIDAK_AKTIF);
          },
        },
      },
    },
  });
}

let auth: ReturnType<typeof buatAuth> | undefined;

export function getAuth(): ReturnType<typeof buatAuth> {
  auth ??= buatAuth();
  return auth;
}
