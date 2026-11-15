# Laporan Uji Akses v0.3 (B3)

Laporan ini melengkapi `security/access-tests.md` (snapshot sec-0.2, tidak diubah). Semua angka dan nama uji diambil dari `security/bukti/vitest-akses-v0.3.txt` dan `security/bukti/akses-v0.3-*.txt`.

## 1. Ringkasan

Sumber: `security/bukti/vitest-akses-v0.3.txt`, baris 900-901 (Vitest 5.0.4).

- Berkas uji: 63 lulus dari 63.
- Uji: 892 lulus, 3 dilewati, 0 gagal (total 895).

## 2. Kondisi negatif

Nama uji ditulis persis seperti di keluaran Vitest. Singkatan: AA = `app/admin/aksi-admin.test.ts`. Uji AA berulang untuk 15 aksi (daftar di Lampiran); satu contoh tiap pola ditulis penuh.

### Tanpa sesi (anonim)

| Area | Berkas uji | Nama uji |
|---|---|---|
| Halaman admin | `lib/sesi.test.ts` | `wajibAdmin > anonim -> redirect /masuk` |
| Halaman admin | `proxy.test.ts` | `proxy > tanpa cookie sesi -> redirect ke /masuk` |
| Server Action admin | AA | `kategori: simpanKategori > anonim -> melempar REDIRECT:/masuk dan data tidak tersentuh` (pola sama untuk 15 aksi) |
| Route handler API | `lib/akses/jaga-route.test.ts` | `jagaRoute bentuk problem > anonim -> 401` |
| Route handler API | `app/api/v1/sessions/route.test.ts` | `GET /api/v1/sessions > anonim -> 401` |
| Route handler API | `app/api/v1/sessions/[id]/route.test.ts` | `DELETE /api/v1/sessions/{id} > anonim (Origin benar) -> 401` |
| Route handler API | `app/api/v1/regulations/[slug]/versions/[versionId]/approval/route.test.ts` | `POST approval: akses > anonim (Origin benar) -> 401` |
| Route handler API | `app/api/v1/regulations/route.test.ts` (juga `[slug]` dan `current-version`) | `tanpa sesi > 401 application/problem+json, lapisan data tidak dipanggil` |
| Unduhan PDF | `app/admin/regulasi/[slug]/versi/[versionId]/berkas/route.test.ts` | `GET unduh berkas admin: penolakan menurut peran > anonim -> 401 teks, data dan berkas tidak disentuh` |
| Sesi | `lib/sesi.test.ts` | `bacaSesi > tanpa sesi -> null` |

### Peran salah

| Area | Berkas uji | Nama uji |
|---|---|---|
| Halaman admin | `lib/sesi.test.ts` | `wajibAdmin > SIVITAS -> notFound, bukan redirect` |
| Server Action admin | AA | `kategori: simpanKategori > SIVITAS -> melempar NOT_FOUND dan data tidak tersentuh` (×15) |
| Server Action admin | `app/admin/verifikasi/actions.test.ts` | `periksaBerkas > B-09 Sivitas: wajibAdmin melempar notFound, layanan tidak dipanggil` |
| Route handler API | `lib/akses/jaga-route.test.ts` | `jagaRoute bentuk problem > SIVITAS dengan syarat admin -> 403`; `jagaRoute syarat admin, peran tak dikenal > TAMU, bentuk problem -> 403` |
| Route handler API | `.../approval/route.test.ts` | `POST approval: akses > Sivitas -> 403` |
| Unduhan PDF | `.../berkas/route.test.ts` | `GET unduh berkas admin: penolakan menurut peran > SIVITAS -> 403 teks, data dan berkas tidak disentuh`; `GET unduh berkas admin: penolakan menurut peran > peran tak dikenal -> 403 teks, data dan berkas tidak disentuh` |
| Sesi | tidak ada | endpoint dan aksi sesi menerima kedua peran (`GET /api/v1/sessions > SIVITAS -> 200`, `GET /api/v1/sessions > ADMIN -> 200`) |

### Objek milik orang lain

Admin berwenang atas semua regulasi (model `Regulation` tidak punya kolom pemilik, `apps/web/prisma/schema.prisma:77-91`). Karena itu pada Halaman admin dan Server Action admin "objek milik orang lain" tidak bermakna; yang bermakna hanya kecocokan slug dan versi, dan itu diuji pada baris Route handler API (`POST approval: 404 > versi bukan milik slug itu`) dan Unduhan PDF (`GET unduh berkas admin: ADMIN > versi milik regulasi lain: ...`) di bawah.

| Area | Berkas uji | Nama uji |
|---|---|---|
| Halaman admin | tidak ada | lihat catatan di atas |
| Server Action admin | tidak ada | lihat catatan di atas; tidak ada uji kecocokan slug dan versi pada 15 aksi |
| Server Action (akun) | `app/akun/sesi/actions.test.ts` | `cabutSesiSaya > cabutSesi false -> pesan umum, tanpa redirect`; `cabutSesiSaya > SIVITAS mencabut sesi bukan miliknya -> pesan umum yang sama, tanpa redirect`; `cabutSesiSaya > ADMIN mencabut sesi bukan miliknya -> pesan umum yang sama, tanpa redirect` |
| Route handler API | `app/api/v1/sessions/[id]/route.test.ts` | `DELETE /api/v1/sessions/{id} > A mencabut sesi B -> cabutSesi(idB, userIdA) false -> 404`; `DELETE /api/v1/sessions/{id} > SIVITAS mencabut sesi akun lain -> cabutSesi(idTarget, userIdPelaku) false -> 404 problem+json`; `DELETE /api/v1/sessions/{id} > ADMIN mencabut sesi akun lain -> cabutSesi(idTarget, userIdPelaku) false -> 404 problem+json` |
| Route handler API | `.../approval/route.test.ts` | `POST approval: 404 > versi bukan milik slug itu` |
| Unduhan PDF | `.../berkas/route.test.ts` | `GET unduh berkas admin: ADMIN > versi milik regulasi lain: findVersionFile(regulasi.id, versionId) kosong -> 404` |
| Sesi (data) | `lib/data/sesi.test.ts` | `cabutSesi > where memuat id DAN userId`; `cabutSesi > A mencabut sesi B: tidak ada baris cocok -> false` |

### Status tepat

| Area | Berkas uji | Nama uji |
|---|---|---|
| Halaman admin | `proxy.test.ts` | `proxy > tanpa cookie sesi -> redirect ke /masuk` (menegaskan 307 dan Location) |
| Server Action admin | tidak ada | Server Action tidak punya status HTTP; penolakan dibuktikan lewat `REDIRECT:/masuk` dan `NOT_FOUND` pada dua tabel pertama |
| Route handler API | `.../approval/route.test.ts` | `POST approval: galat domain dan lainnya > penandatangan belum siap -> 503 service-unavailable, pesan galat tidak bocor`; `... > VersionNotEditableError -> 409 state-conflict, detail tetap`; `... > panggilan kedua (versi sudah tidak Draf) -> 409` |
| Route handler API | `app/api/[[...jalur]]/route.test.ts` | `jalur /api tak dikenal > GET -> 404 problem+json` (juga POST, PUT, PATCH, DELETE) |
| Route handler API | `app/api/v1/sessions/[id]/route.test.ts` | `DELETE /api/v1/sessions/{id} > sesi sendiri -> 204 tanpa body dan tanpa Content-Type` |
| Unduhan PDF | `.../berkas/route.test.ts` | `GET unduh berkas admin: ADMIN > regulasi tidak ada -> 404, berkas tidak dicari`; `GET unduh berkas admin: ADMIN > unduhan tidak bergantung pada status versi: 200 dengan header unduhan` |
| Sesi | `lib/data/users.test.ts` | `findActiveUserById > akun nonaktif atau tidak ada (findFirst null) -> undefined` |

## 3. Bukti dinamis (curl, localhost)

Sumber: baris ringkasan tiap `security/bukti/akses-v0.3-<tahap>.txt`.

| Tahap | Ringkasan | Dibuktikan |
|---|---|---|
| anonim | 19 PASS, 0 FAIL | Halaman terlindung dialihkan 307 ke `/masuk`; API 401 problem+json; DELETE tanpa Origin atau Origin asing 403; jalur `/api` tak dikenal dan endpoint auth di luar allowlist 404; OTP ke email non-kampus dan tipe OTP tak didukung 400 dengan kode galat yang benar |
| sivitas | 18 PASS, 0 FAIL | Halaman admin 404, unduh PDF 403, `/regulasi/<slug>` tanpa tautan `/berkas`, tiga endpoint regulasi tanpa 8 kunci terlarang, approval 403, DELETE sesi Admin 404 (S18) |
| admin | 10 PASS, 0 FAIL | Halaman admin 200, unduh versi SAH dan DRAF 200 dengan header unduhan, versi regulasi lain 404, DELETE sesi Sivitas 404 (D08), kedua sesi tetap 200 |
| 503 | 4 PASS, 0 FAIL | Pengesahan tanpa kunci siap 503 problem+json, `type` dan `detail` sesuai, badan tanpa pola jalur berkas |
| pemilik | 2 PASS, 0 FAIL | P01 mencabut sesi sendiri 204; P02 cookie yang dicabut langsung 401 |

Total 53 PASS, 0 FAIL.

## 4. Analisis dan keterbatasan

1. **Uji cakupan guard bersifat statis.** `apps/web/lib/akses/cakupan-guard.test.ts:6-18` menyatakan sendiri bahwa uji ini hanya membuktikan teks penjaga ada dan urutannya (`await` pertama), bukan perilaku. Perilakunya dibuktikan `lib/sesi.test.ts`, `app/admin/aksi-admin.test.ts`, dan uji rute.
2. **Uji peran pada pencabutan sesi nyaris duplikat.** Baris `SIVITAS mencabut...` dan `ADMIN mencabut...` di `app/api/v1/sessions/[id]/route.test.ts` dan `app/akun/sesi/actions.test.ts` menegaskan hal yang sama, karena `cabutSesi(id, userId)` (`apps/web/lib/data/sesi.ts:25`) tidak menerima peran; route memanggilnya dengan `jaga.sesi.userId` (`app/api/v1/sessions/[id]/route.ts:22`) dan aksi dengan `sesi.userId` (`app/akun/sesi/actions.ts:18`). Bukti yang sebenarnya: kondisi `where: { id, userId }` (`lib/data/sesi.ts:26`, diuji `lib/data/sesi.test.ts`) dan bukti dinamis S18 serta D08 (DELETE sesi orang lain 404). P01 dan P02 membuktikan hal lain: pencabutan sesi sendiri berlaku seketika.
3. **Uji akses memakai mock lapisan sesi dan data.** Contohnya `jagaRoute` dan `cabutSesi` (`app/api/v1/sessions/[id]/route.test.ts:8-9`), `wajibMasuk` dan `cabutSesi` (`app/akun/sesi/actions.test.ts:15-16`), `getPrisma` (`lib/data/sesi.test.ts:6`), `bacaSesi` (`lib/akses/jaga-route.test.ts:8`). Hanya 18 dari 63 berkas uji yang memakai `vi.mock`, tetapi hampir semua uji akses termasuk di antaranya. Perilaku Prisma yang sebenarnya (hasil `deleteMany`, `omit`, `findFirst`) hanya dibuktikan lewat bukti dinamis.
4. **Tiga uji dilewati bukan uji akses endpoint.** Ketiganya `it.skipIf(!POSIX)` dengan `POSIX = process.platform !== "win32"`: `lib/crypto/penandatangan.test.ts:59` dan `lib/crypto/kunci.test.ts:76` ("menolak berkas yang bisa dibaca grup atau pengguna lain"), dan `kunci.test.ts:105` ("membuat berkas dengan mode 0o600"). Uji ini dilewati di Windows.
5. **Bukti dari satu mesin; keterkaitan skrip dan bukti dari riwayat commit.** Skrip default ke `http://localhost:3000` (`security/uji-akses-v0.3.ps1:34`) dan menulis ulang berkas keluarannya (`:28`, `:520`). Dari `git log -- security/uji-akses-v0.3.ps1 security/bukti`:
   - Skrip pertama kali tercatat di `5496708` (2026-11-15 20:04:49 +0700). Satu commit sesudahnya hanya mengoreksi komentar kepala skrip (tanpa perubahan kode), jadi kode skrip tidak berubah setelah commit pertama.
   - `5496708` juga memuat tiga berkas bukti pertama: `akses-v0.3-anonim.txt`, `akses-v0.3-sivitas.txt`, `akses-v0.3-admin.txt`.
   - `akses-v0.3-503.txt` ada di `5906eaf` (20:08:59), `akses-v0.3-pemilik.txt` di `a3cc29a` (22:45:10), dan `vitest-akses-v0.3.txt` di `760ec79` (22:46:10).
   - Jadi kode skrip yang menghasilkan semua bukti dinamis tidak berubah setelah commit pertamanya; satu commit sesudahnya hanya mengoreksi komentar kepala. Riwayat commit tidak dapat memastikan versi skrip yang dipakai tiap run sebelum `5496708`, karena skrip pertama kali tercatat di commit itu. Tidak dapat dipastikan juga kapan tiap berkas bukti dihasilkan di mesin (berkas admin pernah dipulihkan dengan `git checkout`, sehingga waktu berkas tidak dipakai).

Yang tidak diklaim: bahwa data pada basis data uji bersifat sintetis. Dari berkas hanya terbukti alamat email di skrip rekaan (`security/uji-akses-v0.3.ps1:50-51`).

## Lampiran: pola uji `app/admin/aksi-admin.test.ts`

Untuk setiap aksi, empat uji berpola sama (contoh untuk `kategori: simpanKategori`):

- `anonim -> melempar REDIRECT:/masuk dan data tidak tersentuh`
- `SIVITAS -> melempar NOT_FOUND dan data tidak tersentuh`
- `akun nonaktif -> melempar REDIRECT:/masuk dan data tidak tersentuh`
- `ADMIN aktif lolos penjaga: data tersentuh, galat berasal dari tiruan data bukan penjaga`

Lima belas aksi per modul, persis seperti nama ekspor di berkas aksi: **kategori**: `simpanKategori`, `gantiNamaKategori`, `hapusKategori`; **regulasi**: `simpanRegulasi`, `ubahRegulasi`, `hapusRegulasi`; **versi**: `simpanVersi`, `ubahVersi`, `hapusVersi`, `sahkanVersi`, `batalkanVersi`; **perubahan**: `simpanPerubahan`, `ubahPerubahan`, `hapusPerubahan`; **verifikasi**: `periksaBerkas`.
