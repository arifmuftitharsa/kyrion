# Tabel skenario uji F-31 (integritas catatan versi)

Seluruh hasil di bawah diambil dari [bukti/vitest.txt](bukti/vitest.txt), keluaran `vitest run lib/crypto`
(Vitest v5.0.4, mulai 15:07:52). Tidak ada hasil yang ditambahkan dari sumber lain.

Ringkasan dari `vitest.txt` apa adanya: `Test Files 7 passed (7)` dan
`Tests 112 passed | 2 skipped (114)`. Rinciannya per berkas, dihitung dari baris di `vitest.txt`:
`kanonis.test.ts` 20, `mac.test.ts` 9, `data-terlindung.test.ts` 12, `fingerprint.test.ts` 11,
`verifikasi.test.ts` 27, `kunci.test.ts` 20 (2 dilewati), `password.test.ts` 15. Tabel memuat 13
skenario yang paling relevan untuk F-31; `fingerprint.test.ts` dan `password.test.ts` berasal dari
tugas sebelumnya dan tidak dimasukkan.

Cara membaca kolom **Nama uji**: bentuk di `vitest.txt` adalah `berkas > blok > nama uji`. Bila satu
sel memuat beberapa uji, awalan `berkas > blok` ditulis sekali di baris "Awalan", lalu nama ujinya
satu per baris persis seperti di `vitest.txt`.

★ menandai **uji kritis**: uji yang menjalankan tujuan utama F-31, yaitu PDF dan `file_sha256` diganti
bersamaan tetap ditolak. Penandaan ini bersumber dari komentar di `verifikasi.test.ts` di atas uji
itu ("Skenario penyerang yang bisa menulis DB dan storage/: PDF diganti dan file_sha256 ditimpa dengan
hash PDF baru. Hash polos F-30 saja lolos; tag lama sudah tidak cocok.").

| ID | Jenis | Kondisi | Hasil diharapkan | Nama uji | Hasil nyata |
|---|---|---|---|---|---|
| U-01 | positif | Data, berkas, dan tag asli | Lolos, tidak melempar | Awalan: `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi`<br>`meloloskan data, berkas, dan tag asli` | lulus |
| U-02 | negatif | Salah satu dari tujuh field terlindung diubah (id, regulationId, versionNumber, effectiveDate, fileSha256, fileName, fileSize) | Ditolak dengan `IntegritasGagal` | Awalan: `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi`<br>`menolak bila field id diubah`<br>`menolak bila field regulationId diubah`<br>`menolak bila field versionNumber diubah`<br>`menolak bila field effectiveDate diubah`<br>`menolak bila field fileSha256 diubah`<br>`menolak bila field fileName diubah`<br>`menolak bila field fileSize diubah` | lulus (7 dari 7) |
| U-03 | negatif | Satu bit pada tag diubah (format tetap sah) | Ditolak dengan `IntegritasGagal` | `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak bila satu bit tag diubah` | lulus |
| U-04 | negatif | Kunci induk valid tetapi berbeda dari yang dipakai menandatangani | Ditolak dengan `IntegritasGagal` | `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak bila kunci valid tetapi berbeda` | lulus |
| U-05 | negatif | Kunci pendek atau bukan hex | `KunciTidakValid` | Awalan: `lib/crypto/kunci.test.ts`<br>`parseKunciInduk > menolak teks terlalu pendek (62 karakter) dengan KunciTidakValid`<br>`parseKunciInduk > menolak teks bukan hex dengan KunciTidakValid`<br>`bacaKunciInduk > menolak berkas berisi kunci pendek atau bukan hex` | lulus (3 dari 3) |
| U-06 | negatif | Isi dan tag asli disalin ke baris dengan id berbeda | Ditolak dengan `IntegritasGagal` | `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak tag dan data asli yang disalin ke baris dengan id lain` | lulus |
| U-07 | negatif | Tag `null`, kosong, atau rusak (tanpa awalan, awalan versi lain, hex huruf besar, terlalu pendek, terlalu panjang, bukan hex, spasi di ujung, teks acak) | Ditolak dengan `IntegritasGagal`, tidak crash | Awalan: `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi`<br>`menolak tag null dengan IntegritasGagal, tanpa crash`<br>`menolak tag kosong dengan IntegritasGagal, tanpa crash`<br>`menolak tag tanpa awalan dengan IntegritasGagal, tanpa crash`<br>`menolak tag awalan versi lain dengan IntegritasGagal, tanpa crash`<br>`menolak tag hex huruf besar dengan IntegritasGagal, tanpa crash`<br>`menolak tag terlalu pendek dengan IntegritasGagal, tanpa crash`<br>`menolak tag terlalu panjang dengan IntegritasGagal, tanpa crash`<br>`menolak tag bukan hex dengan IntegritasGagal, tanpa crash`<br>`menolak tag spasi di ujung dengan IntegritasGagal, tanpa crash`<br>`menolak tag teks acak dengan IntegritasGagal, tanpa crash` | lulus (10 dari 10) |
| U-08 | positif | Kunci induk byte 0..31 dan satu data sintetis tetap; nilai harapan dihitung skrip Python stdlib terpisah (menurut komentar di `mac.test.ts`) | Tag sama dengan nilai acuan | `lib/crypto/mac.test.ts > buatTagVersi > sama dengan tag acuan hitungan Python` | lulus |
| U-09 | negatif | Hanya byte PDF yang diganti; `fileSha256` dan tag tetap asli (tag masih cocok dengan data) | Ditolak pada langkah `verifyFingerprint` (F-30) | `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak bila hanya byte PDF yang diganti (langkah verifyFingerprint)` | lulus |
| U-10 ★ | negatif | PDF dan `fileSha256` diganti bersamaan, tag lama dipertahankan | Ditolak dengan `IntegritasGagal` | `lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak bila PDF dan fileSha256 diganti bersamaan dengan tag lama` | lulus |
| U-11 | batas | Batas antarbagian kanonis bergeser: `versionNumber` "ab" dan `fileName` "c.pdf" dibandingkan dengan "a" dan "bc.pdf"; juga nilai dua field bertukar tempat | Byte kanonis berbeda | Awalan: `lib/crypto/kanonis.test.ts > kanonisasiVersi`<br>`membedakan data bila batas antarbagian bergeser (awalan panjang)`<br>`membedakan data bila nilai dua field bertukar tempat (urutan field bagian dari format)` | lulus (2 dari 2) |
| U-12 | positif | Vektor uji RFC 4231 Test Case 1 dan 2 untuk `hmacSha256` | Sama dengan nilai di RFC | Awalan: `lib/crypto/mac.test.ts > hmacSha256`<br>`sesuai RFC 4231 Test Case 1`<br>`sesuai RFC 4231 Test Case 2` | lulus (2 dari 2) |
| U-13 | batas | Dua uji khusus POSIX: berkas kunci yang bisa dibaca grup atau pengguna lain ditolak, dan berkas kunci baru dibuat dengan mode 0o600 | Ditolak dengan `KunciTidakValid` dan mode berkas `0o600` | Awalan: `lib/crypto/kunci.test.ts`<br>`bacaKunciInduk > menolak berkas yang bisa dibaca grup atau pengguna lain`<br>`buatBerkasKunci > membuat berkas dengan mode 0o600` | dilewati (2) |

## Alasan dua uji dilewati (U-13)

Keduanya ditulis dengan `it.skipIf(!POSIX)` di `apps/web/lib/crypto/kunci.test.ts`, dengan
`POSIX = process.platform !== "win32"`. Komentar di berkas uji untuk uji pertama: "Hanya bermakna di POSIX;
di Windows pemeriksaan izin sengaja dilewati." Pada `vitest.txt` keduanya muncul dengan tanda `↓` (dilewati)
karena run itu dilakukan di Windows.

Akibatnya, pemeriksaan bit izin `0o077` di `bacaKunciInduk` dan mode `0o600` di `buatBerkasKunci`
**belum teruji oleh bukti ini**. Bukti yang ada hanya menunjukkan bahwa uji lainnya lulus di Windows.
