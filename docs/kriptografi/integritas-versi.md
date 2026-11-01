# F-31: Integritas catatan versi (HMAC-SHA256)

Dokumen ini hanya memuat hal yang dapat dicocokkan dengan kode di `apps/web`. Hal yang
belum diuji ditandai `[diisi setelah uji manual]` atau `[diisi setelah dijalankan]`.

## 1. Tujuan dan ancaman

F-30 menyimpan SHA-256 berkas PDF di kolom `versions.file_sha256` dan mencocokkannya
saat unduh. Hash polos itu tidak punya kunci, sehingga siapa pun yang bisa menulis ke
basis data **dan** ke `storage/` dapat mengganti PDF lalu menimpa `file_sha256` dengan
hash PDF baru; pemeriksaan F-30 tetap lolos.

F-31 menambahkan tag HMAC-SHA256 (`versions.integrity_tag`) atas metadata versi dan hash
berkas. Kuncinya tidak ada di basis data. Penyerang yang hanya memegang akses tulis DB
dan storage tidak dapat membuat tag yang sah, sehingga penggantian berkas atau
perubahan field terlindungi terdeteksi saat unduh.

Yang **tidak** ditangani: penyerang yang memegang kunci (bagian 5), dan perubahan pada
field di luar tag (bagian 2 dan 8).

## 2. Data dalam tag dan di luar tag

| Field | Dalam tag | Alasan |
|---|---|---|
| `id` | ya | Mengikat tag pada satu baris; salinan isi dan tag ke baris lain ditolak |
| `regulation_id` | ya | Versi tidak bisa dipindah ke regulasi lain tanpa terdeteksi |
| `version_number` | ya | Bagian identitas versi |
| `effective_date` | ya | Menentukan kapan versi berlaku |
| `file_sha256` | ya | Hash berkas ikut ditandatangani, sehingga menimpanya tidak lagi cukup |
| `file_name` | ya | Nama yang tampil di header unduhan |
| `file_size` | ya | Ukuran tercatat berkas |
| `status` | tidak | Keputusan rancangan. Di v0.2 versi baru selalu `DRAF` dan status lain hanya berasal dari seed; pengesahan direncanakan di v0.3. Menandatangani status berarti tanda tangan ulang pada setiap transisi |
| `updated_at` | tidak | Berubah pada setiap penulisan, termasuk yang tidak relevan |
| `change_summary` | tidak | Teks bebas yang tidak memengaruhi keaslian berkas |
| tabel `changes` | tidak | Entitas terpisah dengan siklus hidup sendiri |
| `file_key`, `file_uploaded_at` | tidak | `file_key` tidak perlu: isi berkas di bawah key itu dicocokkan dengan `file_sha256` yang ikut ditandatangani |

## 3. Format

### 3.1 Byte kanonis (`lib/crypto/kanonis.ts`)

`kanonisasiVersi` menyusun byte, bukan memakai `JSON.stringify`. Setiap bagian ditulis
sebagai **4 byte panjang (big-endian, `UInt32BE`) lalu isi UTF-8**. Teks dinormalisasi
NFC. Urutan bagian tetap:

| No | Bagian | Isi | Panjang isi |
|---|---|---|---|
| 1 | label | `kyrion:version:v1` | 17 byte |
| 2 | `id` | UUID huruf kecil | 36 byte |
| 3 | `regulationId` | UUID huruf kecil | 36 byte |
| 4 | `versionNumber` | teks NFC | variabel |
| 5 | `effectiveDate` | `YYYY-MM-DD` (tanggal nyata, basis UTC) | 10 byte |
| 6 | `fileSha256` | 64 hex huruf kecil | 64 byte |
| 7 | `fileName` | teks NFC | variabel |
| 8 | `fileSize` | desimal teks | variabel |

Field yang bentuknya tidak sah ditolak dengan `RangeError` yang hanya menyebut nama field:
UUID bukan huruf kecil atau salah format, tanggal mustahil, sha256 bukan 64 hex huruf kecil,
`fileSize` bukan bilangan bulat aman `>= 0`, dan string dengan surrogate yatim (yang
diam-diam menjadi U+FFFD di UTF-8 sehingga dua nilai berbeda bisa menghasilkan byte sama).

Pemetaan baris ke data terlindung ada di `lib/crypto/data-terlindung.ts`
(`dataTerlindungDariBaris`): hasilnya `null` bila `fileSha256`, `fileName`, atau `fileSize`
kosong, dan tanggal selalu diformat dengan `toISOString().slice(0, 10)` (UTC).

### 3.2 Format tag

`v1$` + 64 hex huruf kecil (HMAC-SHA256 = 32 byte), total 67 karakter. Pola yang sah:
`/^v1\$[0-9a-f]{64}$/` (`POLA_TAG` di `lib/crypto/mac.ts`). Awalan `v1` hanya penanda versi
format; tag tidak memuat identitas kunci.

## 4. Parameter

| Parameter | Nilai | Sumber |
|---|---|---|
| MAC | HMAC-SHA256 | `lib/crypto/mac.ts` (`createHmac("sha256", ...)`) |
| Kunci induk | 32 byte dari `randomBytes` | `lib/crypto/kunci.ts` (`buatBerkasKunci`) |
| Turunan kunci | HKDF-SHA256, salt kosong, keluaran 32 byte | `hkdfSync` di `mac.ts` |
| `info` HKDF | `kyrion v0.2 version-mac` | `INFO_KUNCI_MAC` |
| Perbandingan tag | `timingSafeEqual` atas dua string 67 karakter | `lib/crypto/verifikasi.ts` |

Kunci induk tidak dipakai langsung; kunci MAC diturunkan dengan `info` yang mengikatnya pada
tujuan ini. Tes `mac.test.ts` membandingkan kunci turunan dan tag dengan nilai acuan yang
dihitung skrip Python stdlib terpisah (HKDF RFC 5869 ditulis manual dua langkah).

**Tanpa nonce.** Nonce atau IV diperlukan skema enkripsi agar pesan yang sama tidak
menghasilkan keluaran yang sama. F-31 tidak mengenkripsi apa pun dan tidak menyembunyikan
data; ia hanya memberi tanda keaslian. HMAC bersifat deterministik, dan keunikan per baris
dijamin oleh `id` yang ada di dalam data yang ditandatangani.

## 5. Penanganan kunci

- **Pembuatan:** `randomBytes(32)` (CSPRNG `node:crypto`), disimpan sebagai 64 karakter hex
  ditambah newline. Berkas dibuat dengan flag `wx` (gagal bila sudah ada, tidak pernah
  menimpa) dan mode `0o600`.
- **Lokasi:** satu variabel lingkungan, `KYRION_MASTER_KEY_FILE`, harus di luar repository.
  `prisma/buat-kunci.ts` menolak lokasi di dalam repository.
- **Izin POSIX:** `bacaKunciInduk` menolak berkas yang bit izin grup atau other-nya aktif
  (`mode & 0o077`).
- **Windows:** bit izin POSIX tidak bermakna, sehingga pemeriksaan itu **dilewati**. Pembatasan
  akses bergantung pada ACL folder. Contoh (belum diuji di proyek ini) membatasi berkas
  ke pengguna saat ini:

  ```
  icacls "D:\kunci\kyrion.key" /inheritance:r /grant:r "%USERNAME%:R"
  ```
- **Membuat dan mencadangkan:** jalankan `buat-kunci.ts` (bagian 9), lalu salin berkas ke
  tempat aman di luar mesin ini. Skrip tidak pernah mencetak isi kunci.
- **Kunci hilang:** `KunciTidakValid` pada setiap unduhan versi berberkas; semua unduhan
  ditolak (gagal tertutup). Belum ada skrip pemulihan: `backfill-integritas.ts` hanya
  menandatangani baris dengan tag `NULL`, sehingga tag lama harus dikosongkan manual dan
  ditandatangani ulang dengan kunci baru.
- **Kunci bocor:** pemegang kunci yang juga bisa menulis DB dapat membuat tag yang sah.
  Tanggapannya adalah kunci baru dan tanda tangan ulang seluruh versi; alat untuk itu belum ada.
- **Rotasi kunci BELUM didukung di v0.2.** Tag tidak membawa identitas kunci, sehingga dua
  kunci tidak bisa hidup berdampingan. Rotasi menjadi bagian siklus hidup kunci di Tugas 3.

## 6. Jenis galat

| Galat | Kapan | Sumber |
|---|---|---|
| `KunciTidakValid` | lokasi belum diatur, berkas tidak terbaca, izin POSIX longgar, isi bukan 64 hex | `lib/crypto/kunci.ts` |
| `IntegritasGagal` | tag kosong atau rusak, hash berkas tidak cocok, tag tidak cocok, atau galat internal apa pun saat memeriksa | `lib/crypto/verifikasi.ts` |

Pesan `IntegritasGagal` tetap (`Integritas versi gagal diverifikasi.`) dan tidak memuat kunci,
tag, atau data. `KunciTidakValid` hanya memuat alasan dari daftar tetap. `unduhan-pdf.ts`
menjawab keduanya dengan respons 500 bertulisan tetap tanpa byte PDF, dan hanya mencatat
`error.name`.

**Kunci salah tidak dapat dibedakan dari data diubah.** Kunci yang berformat sah tetapi
berbeda menghasilkan HMAC berbeda, persis seperti data yang diubah, dan verifier hanya melihat
"tag tidak cocok". Itu disengaja: tidak ada keluaran yang memberi tahu penyerang bagian mana
yang salah. Yang dapat dibedakan hanya kunci yang tidak ada atau tidak sah bentuknya
(`KunciTidakValid`).

## 7. Alur

- **Tulis:** `createVersion` (`lib/data/versions.ts`, `hitungTag` sekitar baris 180) dan
  `updateDraftVersion` (sekitar baris 229) menghitung tag dari nilai yang **akan ditulis**,
  lalu menyimpannya di `integrity_tag`. `id` dibuat dengan `randomUUID()` sebelum INSERT karena
  ikut ditandatangani. Versi tanpa berkas bertag `NULL`.
- **Unduh:** `unduhan-pdf.ts:36` memanggil `periksaBerkasVersi`, yang memanggil
  `periksaIntegritasVersi` (`integritas-versi.ts:46`). Urutan di dalamnya: format tag,
  `verifyFingerprint` atas byte berkas, lalu perbandingan HMAC. Gagal berarti 500 tanpa byte PDF.
- **Urutan rollout yang disarankan:** migrasi, `buat-kunci.ts`, `backfill-integritas.ts`,
  baru kode baru dijalankan. Kode lama mengabaikan kolom baru.

## 8. Keterbatasan

- **Status di luar tag.** Penyerang yang bisa menulis DB dapat mengubah status `DRAF` menjadi
  `SAH` dan memublikasikan draf; F-31 tidak mendeteksinya.
- **Verifikasi hanya saat unduh.** `effective_date` dan `version_number` yang tampil di halaman
  dibaca langsung dari DB tanpa verifikasi tag.
- **Versi tanpa berkas tidak bertag** (`integrity_tag` `NULL`); tidak ada yang diverifikasi untuk
  versi itu.
- **Backfill percaya isi DB saat dijalankan.** Ia hanya memastikan hash berkas di disk cocok
  dengan `file_sha256` di DB; bila DB dan berkas sudah diubah bersamaan sebelum backfill,
  keadaan yang sudah diubah itu yang ditandatangani.
- **Uji izin POSIX tidak berjalan di Windows.** Dua tes di `kunci.test.ts` dilewati
  (`skipIf(win32)`), dan pemeriksaan izin di `bacaKunciInduk` dilewati di Windows.
- **Kunci hilang berarti semua unduhan berberkas gagal tertutup.**
- **`buat-kunci.ts` tidak mendeteksi symlink** dari luar ke dalam repository; pemeriksaan hanya
  membandingkan path (`path.relative`).
- **Skrip CLI bergantung pada `process.cwd()` = `apps/web`:** `loadEnvConfig` dan akar
  repository dihitung dari sana.
- **Flag `--conditions=react-server`** hanya dipakai di skrip CLI `backfill-integritas.ts`,
  tidak di aplikasi.
- Tidak ada uji otomatis untuk jalur DB (`createVersion`, `updateDraftVersion`) maupun respons
  HTTP `responsPdf`.

## 9. Cara menjalankan

Semua perintah dari `apps/web`.

Membuat kunci (sekali; `KYRION_MASTER_KEY_FILE` harus sudah diisi di `.env.local`, di luar repository):

```bash
npx tsx prisma/buat-kunci.ts
```

Menandatangani versi berkas lama (idempoten; kode keluar 2 bila ada hash berkas yang tidak
cocok dengan DB):

```bash
npx tsx --conditions=react-server prisma/backfill-integritas.ts
```

Menjalankan uji modul kriptografi:

```bash
npx vitest run lib/crypto
```

## 10. Sambungan Tugas 1 ke Tugas 2

F-30 (fingerprint SHA-256) menjadi masukan F-31:

| Titik | Berkas dan baris | Peran |
|---|---|---|
| Hash saat unggah | `app/admin/regulasi/[slug]/versi/actions.ts:118` | `fingerprint(bytes)` menghasilkan `sha256` yang disimpan ke `file_sha256` |
| Hash masuk tag | `lib/crypto/data-terlindung.ts` (`fileSha256`), `lib/data/versions.ts` (`hitungTag`) | `file_sha256` menjadi salah satu dari 7 field yang ditandatangani |
| Cek hash saat unduh | `lib/crypto/verifikasi.ts:38` | `verifyFingerprint(bytes, data.fileSha256)` dijalankan lebih dulu |
| Cek tag saat unduh | `lib/crypto/verifikasi.ts:40` | HMAC dihitung ulang dan dibandingkan dengan `timingSafeEqual` |
| Pemanggil | `lib/unduhan-pdf.ts:36` | Menggantikan pemeriksaan `verifyFingerprint` yang berdiri sendiri |
| Batas ukuran | `lib/crypto/fingerprint.ts` (`MAX_INPUT_BYTES`) | `InputTooLargeError` dibungkus menjadi `IntegritasGagal` |

Uji sambungannya: `verifikasi.test.ts` memuat uji yang gagal bila panggilan
`verifyFingerprint` dihapus dan uji PDF beserta `fileSha256` yang diganti bersamaan.

## 11. Hasil uji manual

Belum dijalankan. Setiap baris diisi dengan keluaran asli.

| Uji | Hasil |
|---|---|
| Membuat kunci dengan `buat-kunci.ts` | [diisi setelah uji manual] |
| Menjalankan `buat-kunci.ts` lagi (berkas sudah ada, tidak ditimpa, kode keluar 1) | [diisi setelah uji manual] |
| `buat-kunci.ts` dengan lokasi di dalam repository (ditolak) | [diisi setelah uji manual] |
| `backfill-integritas.ts` pada data lama (ringkasan) | [diisi setelah uji manual] |
| `backfill-integritas.ts` dijalankan ulang (idempoten) | [diisi setelah uji manual] |
| Unduh PDF normal | [diisi setelah uji manual] |
| Ubah satu byte PDF di `storage/` | [diisi setelah uji manual] |
| Ubah PDF dan `file_sha256` di DB bersamaan | [diisi setelah uji manual] |
| Ubah `version_number` di DB | [diisi setelah uji manual] |
| Kunci dihapus atau dipindah | [diisi setelah uji manual] |

### Flag `--conditions=react-server`

Cara kerja flag ini pada `tsx` belum diverifikasi. Hal yang perlu dicek: apakah `tsx`
meneruskan flag ke Node, apakah `server-only` benar-benar menunjuk ke `empty.js`, dan
apakah kondisi itu mengubah resolusi modul lain yang diimpor skrip.

[diisi setelah dijalankan]
