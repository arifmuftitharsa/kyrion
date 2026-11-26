# Keamanan Kyrion v0.3 (OWASP Top 10:2025)

Jalur kode relatif ke `apps/web/` kecuali diawali `docs/`, `security/`, atau `README.md`.

## 1. Ruang lingkup dan sumber bukti

Dokumen ini mencakup kontrol akses, autentikasi, dan otorisasi di server untuk v0.3, dipetakan ke OWASP Top 10:2025. Bukti ada dua jenis: uji Vitest (`security/bukti/vitest-akses-v0.3.txt`: 63 berkas, 892 lulus, 3 dilewati, 0 gagal) dan uji curl terhadap dev server (`security/bukti/akses-v0.3-*.txt`, 53 PASS, 0 FAIL). ID bukti curl tahap anonim ditulis `anonim-A01` sampai `anonim-A19` agar tidak tertukar dengan label kategori OWASP A01 sampai A10; tahap lain memakai S (sivitas), D (admin), X (503), P (pemilik). Analisis uji ada di `security/access-tests-v0.3.md`. Klaim yang hanya berasal dari pembacaan kode ditandai **belum dibuktikan dinamis**.

## 2. Matriks akses

Hitungan diverifikasi ke `lib/akses/cakupan-guard.test.ts` dan berkas yang diuji (hasil di `vitest-akses-v0.3.txt`): 19 halaman admin, 3 halaman lain (`page.tsx`, `akun/sesi/page.tsx`, `regulasi/[slug]/page.tsx`) ditambah `masuk/page.tsx` yang sengaja terbuka (`cakupan-guard.test.ts:42`); 14 aksi admin + `periksaBerkas` = 15 aksi (`app/admin/aksi-admin.test.ts:157`); `akun/sesi/actions.ts` (1 aksi); `masuk/actions.ts` hanya `keluar` (`cakupan-guard.test.ts:49`); 9 `route.ts`, 7 memakai `jagaRoute(` dan 2 pengecualian (`api/auth/[...all]`, `api/[[...jalur]]`, `cakupan-guard.test.ts:52-58`).

| Sumber daya | Anonim | Sivitas | Admin | Bukti |
|---|---|---|---|---|
| `/masuk` | ya | dialihkan ke `/` | dialihkan ke `/admin/regulasi` | `app/masuk/page.tsx:10-12`; anonim-A01 |
| `/`, `/akun/sesi` | 307 ke `/masuk` | ya | ya | `proxy.ts:8-13`; `app/page.tsx:26`; `app/akun/sesi/page.tsx:17`; anonim-A02 sampai anonim-A04, S01, S02 |
| `/regulasi/[slug]` | 307 ke `/masuk` | ya, tanpa tautan unduh dan banding | ya, plus unduh dan banding | `app/regulasi/[slug]/page.tsx:26,77-89`; S03, S04, D07 |
| `/admin/**` (19 halaman) | 307 ke `/masuk` | 404 | ya | `lib/sesi.ts:27-34,47-50`; S05, S06, D01, D02 |
| Aksi admin (15) | redirect `/masuk` | `notFound` (404) | ya | `aksi-admin.test.ts` (60 kasus), `cakupan-guard.test.ts (c)` |
| `cabutSesiSaya` | redirect `/masuk` | hanya sesi sendiri | hanya sesi sendiri | `app/akun/sesi/actions.ts:14-18` |
| `keluar` | terbuka (`signOut` tanpa sesi) | ya | ya | `app/masuk/actions.ts:8-11`; belum diuji dinamis |
| Unduh `/admin/.../berkas` | 307 (proxy), 401 jika langsung ke handler | 403 | 200, semua status | `berkas/route.ts:13-23`; anonim-A06, S07, D03 sampai D05 |
| `GET /api/v1/regulations`, `/{slug}`, `/{slug}/current-version` | 401 | 200 (metadata) | 200 | `jagaRoute("masuk")`; anonim-A07, S08 sampai S13 |
| `GET /api/v1/sessions` | 401 | milik sendiri | milik sendiri | `sessions/route.ts:9-18`; anonim-A08, S14, S15 |
| `DELETE /api/v1/sessions/{id}` | 403 tanpa Origin / 401 ber-Origin | sendiri 204, orang lain 404 | sama | `sessions/[id]/route.ts:14-22`; anonim-A09 sampai anonim-A11, S17, S18, D08, P01 |
| `POST .../versions/{id}/approval` | 401 | 403 | ya (Origin wajib) | `approval/route.ts:27-30`; anonim-A12, S16 |
| Jalur `/api` tak dikenal, `/api/auth/*` di luar allowlist | 404 | 404 | 404 | `app/api/[[...jalur]]/route.ts`; `lib/auth/izin.ts:6-9`; anonim-A13 sampai anonim-A15 |

## 3. Otentikasi dan otorisasi di server

1. **Login hanya OTP email**, 6 digit, berlaku 300 detik, 3 percobaan (`lib/auth/index.ts:70-73`). OTP disimpan sebagai hash (`:75`, `lib/auth/otp.ts`). Domain harus persis salah satu domain kampus (`lib/domain/akun-kampus.ts:13-19`), diperiksa di hook (`index.ts:93-95`) dan saat akun dibuat (`:111-113`).
2. **Sesi di basis data** (`prisma/schema.prisma:194-207`), berlaku 7 hari (`index.ts:61`). Akun nonaktif ditolak saat sesi dibuat (`index.ts:116-125`).
3. **Peran dibaca ulang dari basis data** di setiap `bacaSesi`; peran di token hanya petunjuk, akun nonaktif atau hilang menghasilkan `null` (`lib/sesi.ts:17-23`, `lib/data/users.ts:12-16`).
4. **`proxy.ts` hanya pemeriksaan optimistik**: mengecek keberadaan cookie, bukan keabsahannya (`proxy.ts:5-13`), semua halaman kecuali `/masuk`, `/api`, aset (`:17-19`).
5. **Keputusan akses satu fungsi murni**, deny by default (`lib/akses/keputusan.ts:9-14`), dipakai halaman dan Server Action lewat `wajibMasuk`/`wajibAdmin` (`lib/sesi.ts:27-50`; anonim redirect, peran kurang 404) dan route handler lewat `jagaRoute` (`lib/akses/jaga-route.ts:10-34`; 401/403 tanpa redirect).
6. **Origin diperiksa sebelum `jagaRoute`** pada POST dan DELETE berbasis cookie (`sessions/[id]/route.ts:14-17`, `approval/route.ts:27-30`); tanpa Origin ditolak (`lib/api/origin.ts:9-18`).
7. **Allowlist `/api/auth`**: hanya `POST /email-otp/send-verification-otp` dan `POST /sign-in/email-otp` (`lib/auth/izin.ts:6-9`), ditegakkan di `hooks.before` (`index.ts:88-90`).

## 4. Kategori OWASP Top 10:2025

| Kategori | Ancaman | Kontrol | Bukti | Prioritas dan alasan |
|---|---|---|---|---|
| **A01 Broken Access Control** | Sivitas membuka halaman, aksi, atau PDF admin; satu pengguna mencabut sesi orang lain; Sivitas menerima ringkasan perubahan | `lib/akses/keputusan.ts:9-14`; `lib/sesi.ts:27-50`; `lib/akses/jaga-route.ts:10-34`; `lib/data/sesi.ts:25-26` (`where {id,userId}`); `lib/data/regulations.ts:26` (`omit changeSummary`) | Uji: `lib/akses/jaga-route.test.ts > jagaRoute bentuk problem > SIVITAS dengan syarat admin -> 403`; `app/admin/aksi-admin.test.ts > kategori: simpanKategori > SIVITAS -> melempar NOT_FOUND dan data tidak tersentuh` (×15); `.../berkas/route.test.ts > GET unduh berkas admin: penolakan menurut peran > SIVITAS -> 403 teks, data dan berkas tidak disentuh`; `lib/data/sesi.test.ts > cabutSesi > where memuat id DAN userId`; `lib/data/regulations.test.ts > getRegulations > kolom changeSummary tidak muncul pada hasil`. Dinamis: S05, S06, S07, S13, S18, D05, D08 | **Tinggi**: melindungi PDF dan perubahan regulasi sebelum disahkan, serta sesi (kredensial) pengguna lain |
| **A02 Security Misconfiguration** | Endpoint auth bawaan terbuka; CSRF pada API berbasis cookie; konfigurasi salah diam-diam | Allowlist `lib/auth/izin.ts:6-9`; Origin `lib/api/origin.ts:9-18`; env divalidasi gagal tertutup `lib/auth/konfigurasi.ts:5-8`; header dasar `next.config.ts:14-19`, `poweredByHeader: false` (`:5`) | Uji: `lib/auth/izin.test.ts > permintaanDiizinkan > menolak /get-session GET`; `lib/api/origin.test.ts > periksaOrigin > Origin https://evil.example -> 403 problem+json`; `lib/auth/konfigurasi.test.ts > bacaKonfigurasiAuth > menolak rahasia "" tanpa membocorkan nilainya`. Dinamis: anonim-A10, anonim-A11, anonim-A14, anonim-A15. Header di `next.config.ts`: **belum dibuktikan dinamis** | **Tinggi**: satu endpoint auth terbuka (mis. `/get-session`) mengembalikan token sesi (`lib/auth/izin.ts:3-5`) |
| **A03 Software Supply Chain Failures** | Dependensi dengan kerentanan yang sudah diketahui | Versi inti dipatok (`better-auth` `1.7.22`, `package.json:15`), `package-lock.json`; `next` dinaikkan 16.4.2 ke 16.4.6 pada 26 November 2026 (`package.json:16`) | Hasil 15 November 2026 **sudah usang**: `npm audit --omit=dev` dari `apps/web` (perintah dicatat di dokumen ini karena berkas keluaran hanya berisi hasilnya), `security/bukti/npm-audit-v0.3.txt`: `found 0 vulnerabilities`. Pada 26 November 2026, `next` 16.0.0-16.4.4 terkena 7 advisori (moderate) (keterangan Arif; tidak tercatat di berkas bukti berikut). Sesudah `next` 16.4.6, `npm audit --omit=dev` menyisakan 3 high pada rantai `effect`, `@prisma/config`, `prisma` (`security/bukti/npm-audit-2026-11-26.txt`; lihat bagian 6). Sesudah kenaikan, `npm test` 63 berkas, 892 lulus, 3 dilewati, dan `npm run build` lolos dengan Next.js 16.4.6 (dijalankan Arif, keterangan Arif). Batas: hanya advisori yang sudah diketahui | **Sedang**: aplikasi memakai auth dan ORM pihak ketiga; hasil audit bukan jaminan |
| **A04 Cryptographic Failures** | OTP bocor dari basis data; pemalsuan pengesahan | OTP di-hash HMAC (`index.ts:75`, `lib/auth/otp.ts`); tanda tangan Ed25519 (`lib/crypto/tanda-tangan.ts`); kunci di luar repositori (`docs/kriptografi/peran-kunci.md:15-18`) | Uji: `lib/auth/otp.test.ts > hashOtp > keluaran heksadesimal 64 karakter dan tidak memuat OTP`; `lib/crypto/tanda-tangan.test.ts > pasangan kunci dan tanda tangan > tanda tangan diubah 1 byte: false` | **Sedang**: OTP berlaku 5 menit; tanda tangan melindungi keaslian pengesahan, bukan kerahasiaan |
| **A05 Injection** | SQL injection, XSS lewat input | Prisma terparameter lewat `getPrisma()` (mis. `lib/data/sesi.ts:14-18`); Zod ketat (`lib/skema.ts`, `strictObject` `:116-130`); grep: `queryRawUnsafe`, `executeRawUnsafe`, `dangerouslySetInnerHTML` | `security/bukti/grep-injeksi-v0.3.txt` (0 kecocokan, tanpa berkas uji dan md); Uji: `app/api/v1/regulations/[slug]/route.test.ts > GET /api/v1/regulations/{slug}: 404 not-found > slug berformat salah SALAH!: data tidak dipanggil` | **Sedang**: aplikasi hanya membaca input teks pendek (slug, UUID, nama); grep tidak mencakup `$queryRaw` tagged |
| **A07 Authentication Failures** | Brute force OTP, pembuatan akun dari domain luar, akun nonaktif tetap masuk | Batas 3 per menit (`index.ts:62-68`), jeda per email (`index.ts:102`, `lib/auth/jeda.ts`), 3 percobaan OTP (`:73`), akun nonaktif (`:116-125`, `lib/data/users.ts:12-16`) | Uji: `lib/auth/jeda.test.ts > buatJedaOtp > menolak permintaan kedua dalam 60 detik`; `lib/domain/akun-kampus.test.ts > emailKampusSah > menolak: akhiran palsu`; `lib/data/users.test.ts > findActiveUserById > akun nonaktif atau tidak ada (findFirst null) -> undefined`. Dinamis: anonim-A16 sampai anonim-A19 (400 `EMAIL_BUKAN_KAMPUS` dan `TIPE_OTP_TIDAK_DIDUKUNG`), P02 (sesi dicabut langsung 401) | **Tinggi**: OTP adalah satu-satunya kredensial; kegagalan memberi akses Admin |
| **A08 Software or Data Integrity Failures** | Versi regulasi atau berkas diubah di basis data atau disk | Saat unduh hanya SHA-256 berkas dan tag HMAC F-31 yang diperiksa (`lib/unduhan-pdf.ts:35-46` memanggil `periksaBerkasVersi`, `lib/integritas-versi.ts:35-47`). Tanda tangan Ed25519 dibuat saat pengesahan atas payload tertanda (`lib/data/pengesahan.ts:72-79`) dan diperiksa hanya di `/admin/verifikasi` (`lib/data/verifikasi-berkas.ts:42` memanggil `verifikasiBerkas`, `lib/crypto/verifikasi-pengesahan.ts:162`), tidak pada tiap unduhan | Uji: `lib/crypto/verifikasi-pengesahan.test.ts > negatif: tanda tangan dan payload > A-05 fileName diubah`; `lib/crypto/verifikasi-pengesahan.test.ts > negatif: kunci > B-06 kunci dicabut`; `lib/data/pengesahan.test.ts > isiTransaksiSahkan > tanda tangan > ubah fileSha256 membuat verifikasi gagal` | **Tinggi**: dokumen regulasi sah dipakai sebagai acuan; perubahan diam-diam harus terdeteksi |
| **A09 Security Logging and Alerting Failures** | Tidak ada jejak siapa mengesahkan dan membatalkan; log membocorkan data | Audit hanya-tambah (`lib/data/audit.ts:4,19-30`) dalam transaksi yang sama dengan perubahan; log galat hanya nama (`sessions/route.ts:20-22`) | Uji: `lib/data/audit.test.ts > catatAudit > mengirim data sesuai entri ke auditLog.create tepat sekali`; `app/api/v1/sessions/route.test.ts > GET /api/v1/sessions > galat tak terduga -> 500, log hanya nama galat`. Tidak ada bukti dinamis. Pengecualian: lihat bagian 6 | **Sedang**: perubahan sah punya jejak, tetapi penghapusan regulasi dan kategori belum tercakup di audit_logs |
| **A10 Mishandling of Exceptional Conditions** | Kegagalan kunci atau rute tak dikenal membuka jalur tanpa tanda tangan atau membocorkan detail | Pengesahan gagal tertutup 503 sebelum transaksi (`lib/data/versions.ts:324-325`, `approval/route.ts:56-60`); 404 problem+json seragam (`app/api/[[...jalur]]/route.ts`); unduhan gagal tertutup 500 (`lib/unduhan-pdf.ts:35-46`) | Uji: `.../approval/route.test.ts > POST approval: galat domain dan lainnya > penandatangan belum siap -> 503 service-unavailable, pesan galat tidak bocor`; `app/api/[[...jalur]]/route.test.ts > jalur /api tak dikenal > GET -> 404 problem+json`. Dinamis: X01 sampai X04, anonim-A13 | **Tinggi**: kegagalan di jalur pengesahan tidak boleh menghasilkan versi sah tanpa tanda tangan |

## 5. Konfigurasi

Nama variabel dari rujukan `process.env` di kode; nilai tidak ditulis.

| Variabel | Fungsi | Sumber |
|---|---|---|
| `BETTER_AUTH_URL` | Origin aplikasi; **harus sama dengan origin peramban**, dipakai pemeriksaan Origin (salah ⇒ semua POST dan DELETE API 403) | `lib/auth/konfigurasi.ts:7`, `lib/api/origin.ts:15` |
| `BETTER_AUTH_SECRET` | Rahasia Better Auth dan turunan kunci hash OTP, minimal 32 karakter | `lib/auth/konfigurasi.ts:6`, `lib/auth/index.ts:50-51` |
| `KYRION_MASTER_KEY_FILE` | Lokasi kunci induk HMAC, di luar repositori | `lib/integritas-versi.ts:21`, `prisma/buat-kunci.ts:31` |
| `KYRION_SIGNING_KEY_FILE` | Lokasi kunci privat tanda tangan | `lib/data/penandatangan-env.ts:13` |
| `KYRION_KEYRING_FILE` | Lokasi keyring kunci publik | `lib/data/penandatangan-env.ts:14`, `lib/data/verifikasi-env.ts:10` |
| `KYRION_STORAGE_DIR` | Folder PDF (bawaan `storage/`) | `lib/penyimpanan.ts:13` |
| `EMAIL_ADAPTER`, `EMAIL_FROM`, `MAILTRAP_API_TOKEN`, `MAILTRAP_SANDBOX_ID`, `NODE_ENV` | Pemilihan pengirim email (`memori`, `konsol`, `mailtrap`); memori dan konsol ditolak di produksi | `lib/email/konfigurasi.ts:12-19,56-58` |
| `DATABASE_URL`, `ADMIN_SEED_EMAIL` | Koneksi basis data; email Admin seed (wajib email kampus) | `lib/prisma.ts:10`, `prisma/seed.ts:194` |

## 6. Keterbatasan dan risiko sisa

"Belum dibuktikan dinamis" = hanya dari pembacaan kode.

| Butir | Fakta dan sumber | Catatan |
|---|---|---|
| Tidak ada CSP dan HSTS | `next.config.ts:7-9` (komentar sengaja), header hanya empat (`:14-19`) | Belum dibuktikan dinamis |
| Token sesi di badan respons `/sign-in/email-otp` | `node_modules/better-auth/dist/plugins/email-otp/routes.mjs:326,413,429` mengembalikan `token: session.token`; `FormMasuk.tsx:20` hanya membaca `res.ok` | Belum dibuktikan dinamis |
| Batas laju dan jeda OTP di memori proses | `lib/auth/index.ts:62-68` (`storage: "memory"`), `lib/auth/jeda.ts:1-2`, `index.ts:22-23` | Hilang saat restart, tidak dibagi antar instans |
| `X-Forwarded-For` dapat dipalsukan tanpa proksi tepercaya | `index.ts` tidak menyetel `advanced.ipAddress`; bawaan `["x-forwarded-for"]` (`node_modules/@better-auth/core/dist/types/init-options.d.mts:249`) | Dampak (menghindari batas per IP) belum diuji; jeda per email tetap berlaku (`index.ts:102`) |
| Akun Sivitas dibuat otomatis untuk email kampus sah | `index.ts:74` (`disableSignUp: false`), `:107-114` hanya cek domain | Siapa pun dengan kotak surat kampus dapat membuat akun Sivitas |
| "Kode terkirim" tetap tampil walau penyedia menolak | `index.ts:35-47` (kirim tanpa menunggu), `FormMasuk.tsx:60,119`, `lib/masuk/pesan.ts:7` | Disengaja agar tidak membocorkan keberadaan akun; belum dibuktikan dinamis |
| Email OTP hanya ke sandbox Mailtrap | `lib/email/mailtrap.ts:28` (`sandbox.api.mailtrap.io`); adapter lain hanya memori dan konsol (`konfigurasi.ts:13`) | Tidak ada adapter email produksi di kode |
| Query publik masih membaca kolom berkas lalu membuangnya | `lib/data/regulations.ts:19-29` hanya `omit changeSummary`; `toRegulation` memetakan lima field (`:41-50`) | Tidak keluar ke klien (uji G6); belum dibuktikan dinamis |
| Penghapusan regulasi dan kategori tidak masuk `audit_logs` | `lib/data/regulations.ts:217-223`, `lib/data/categories.ts:129-132`, `lib/data/audit.ts:7` (`ObjectTypeAudit = "version"`) | |
| Log audit dan berkas PDF yatim bila baris dihapus lewat psql | `prisma/schema.prisma:181-182` (`objectId` tanpa FK, disengaja); aplikasi menghapus berkas setelah baris (`lib/data/versions.ts:294-297`) | **Inferensi**, belum diuji |
| Keyring tidak ditandatangani | `docs/kriptografi/peran-kunci.md:18` (perlindungan integritas keyring selain izin berkas tidak ada di kode) | |
| Penandatanganan ulang setelah pencabutan ditunda | `docs/kriptografi/peran-kunci.md:17`, `README.md:636`, `prisma/kelola-kunci.ts:88` | |
| Balapan dua pengesahan atas tanggal berlaku sama | Perlindungan duplikat di aplikasi (`lib/data/pengesahan.ts:54-63`); indeks unik hanya `@@unique([regulationId, versionNumber])` (`prisma/schema.prisma:130`); `$transaction` tanpa `isolationLevel` (`lib/data/versions.ts:310-312`) | **Inferensi**, belum diuji; pengesahan ganda atas satu versi sudah dijaga `updateMany` dengan `updatedAt` (`pengesahan.ts:81-83`) |
| Admin wajib email kampus | `lib/domain/akun-kampus.ts:21-28` (`emailAdminSeed`), `prisma/seed.ts:194`, hook pembuatan akun `lib/auth/index.ts:111-113` | Hanya fakta kode; K4 dan PRD 4.1 tidak ditemukan di repositori sebagai dasarnya |
| `cookieCache` harus tetap nonaktif; `generateId: "uuid"` | `index.ts:61` tanpa `cookieCache`, bawaan `false` (`init-options.d.mts:1009-1011`); `lib/sesi.ts:12-16` baca basis data tiap permintaan; `index.ts:57-58` (komentar: ID dibuat basis data) | Pencabutan seketika dibuktikan P01 dan P02; tidak ada uji yang mengunci konfigurasi ini |
| `keluar` terbuka dan belum diuji dinamis | `app/masuk/actions.ts:8-11`, `cakupan-guard.test.ts:49` | Tanpa sesi, `signOut` tidak berefek; belum dibuktikan |
| `app/regulasi/layout.tsx` tidak tercakup uji statis | `layout.tsx:11` memanggil `wajibMasuk()`, tetapi `cakupan-guard.test.ts` hanya memeriksa `page.tsx`, `actions.ts`, `route.ts` | Halaman di bawahnya tetap menjaga sendiri |
| Perilaku hook auth tidak diuji unit | `lib/auth/index.ts:85-125` (allowlist, domain, tipe, jeda, akun nonaktif); tidak ada uji yang memuat modul ini (`lib/sesi.test.ts:2` hanya meniru `getAuth`) | Sebagian dibuktikan anonim-A14 sampai anonim-A19; akun nonaktif tidak |
| Bukti dinamis dari satu mesin, berkas ditimpa tiap run skrip | Lihat `security/access-tests-v0.3.md` butir 5 | |
| Unduhan tidak memeriksa tanda tangan Ed25519 | `periksaBerkasVersi` hanya SHA-256 dan tag HMAC (`lib/integritas-versi.ts:35-47`); tag HMAC melindungi tujuh field versi dan tidak mencakup status atau pengesah (`lib/crypto/kanonis.ts:8-19`, komentar `DataVersiTerlindung`) | Perubahan status atau pengesah langsung di basis data tidak terdeteksi saat unduh, tetapi terdeteksi saat verifikasi di `/admin/verifikasi` |
| 3 temuan high sisa pada dependensi produksi | `security/bukti/npm-audit-2026-11-26.txt`: rantai `effect` <=3.22.0, `@prisma/config`, `prisma` (ReDoS pada `Schema.TemplateLiteral`, GHSA-7589-6fvf-x4pw); `effect` terpasang 3.20.0. Hanya transitif, tidak ada impor langsung di kode aplikasi (pencarian kode Claude 26 November 2026, sejalan dengan T-24 di security/risk-register.md; belum tersimpan sebagai berkas bukti). Perbaikan yang ditawarkan npm hanya menurunkan `prisma` ke 6.12 (breaking; stack wajib Prisma 7), sehingga tidak diterapkan | Tidak ada perbaikan non-breaking yang ditawarkan npm. Apakah `@prisma/config` dimuat di jalur request **belum diverifikasi**. Belum diuji dinamis |

## 7. Rujukan

`security/access-tests-v0.3.md`; `security/bukti/vitest-akses-v0.3.txt`; `security/bukti/akses-v0.3-{anonim,sivitas,admin,503,pemilik}.txt`; `security/bukti/npm-audit-v0.3.txt`; `security/bukti/npm-audit-2026-11-26.txt`; `security/bukti/grep-injeksi-v0.3.txt`; `security/uji-akses-v0.3.ps1`; `docs/kriptografi/peran-kunci.md`; `docs/api/openapi.yaml`.
