# F-31: Integritas catatan versi (HMAC-SHA256)

Dokumen ini hanya memuat hal yang dapat dicocokkan dengan kode di `apps/web`. Hasil uji
manual (bagian 11) dilaporkan oleh pemilik repo; hal yang tidak diuji manual dicatat di bagian itu.

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

Hasil di bagian ini dilaporkan oleh pemilik repo dari pengujian pada 1 November 2026, di
lingkungan lokal Windows dengan PostgreSQL 18 di Docker. Bukan keluaran yang dihasilkan ulang
untuk dokumen ini.

| ID | Kondisi | Hasil diharapkan | Hasil nyata |
|---|---|---|---|
| M-01 | Unggah PDF lewat aplikasi, lalu unduh | Tag dibuat saat tulis dan unduhan lolos | PDF terbuka; kolom `integrity_tag` berawalan `v1$` dengan panjang 67 |
| M-02 | Ubah nomor versi langsung di basis data, lalu unduh | Ditolak | Respons 500 dengan teks tetap "Berkas gagal diverifikasi: isinya tidak sama dengan yang tercatat."; log server hanya memuat `file_key` dan nama galat `IntegritasGagal`. Setelah nilai dikembalikan, unduhan berhasil kembali (200) |
| M-03 (serangan utama) | PDF di `storage/`, `file_sha256`, dan `file_size` diganti bersamaan di basis data | Ditolak oleh HMAC walau hash polos cocok | Hash berkas di disk sama dengan `file_sha256` di basis data (pemeriksaan hash polos saja akan meloloskan), tetapi unduhan ditolak: 500, teks tetap, log `IntegritasGagal`. Setelah PDF dan nilai asli dikembalikan, PDF asli terbuka kembali |
| M-04 | Ubah tanggal berlaku Draf berberkas lewat aplikasi tanpa PDF baru | Tag dihitung ulang dan unduhan lolos | Ringkasan MD5 tag berubah (`6368c05517bd47a488abfc6ae93151aa` menjadi `7cc9ee1a250c16e1fd4bacce874f456d`) dan PDF tetap terbuka |
| M-05 | Buat Draf tanpa PDF, lalu ubah tanggalnya lewat aplikasi | Berhasil tersimpan | Berhasil tanpa galat; `integrity_tag` dan `file_key` bernilai `NULL` |
| M-06 | Tambahkan PDF ke Draf yang semula tanpa berkas lewat Ubah | Tag dibuat | `integrity_tag` terisi dan unduhan terbuka |
| M-07 | Kosongkan `integrity_tag` (meniru data lama), coba unduh, jalankan backfill, unduh lagi | Ditolak, lalu lolos setelah backfill | Unduhan ditolak; backfill menampilkan "1 versi diperiksa, ditandatangani 1"; unduhan berhasil. Diulang dua kali dengan hasil sama |
| M-08 | Jalankan backfill kedua kali tanpa perubahan data | Tidak menimpa tag | "0 versi diperiksa" |

### Flag `--conditions=react-server`

Dilaporkan oleh pemilik repo: skrip dijalankan dengan perintah
`npx tsx --conditions=react-server prisma/backfill-integritas.ts` dan berjalan tanpa galat
`server-only`. Skrip membaca berkas dari storage lewat modul penyimpanan, terbukti karena
menandatangani 1 versi (M-07). Dijalankan tanpa flag: tidak diuji.

Pengujian ini hanya mengamati hasil akhirnya; mekanisme di baliknya (cara `tsx` meneruskan flag
dan pengaruh kondisi itu terhadap modul lain yang diimpor skrip) tidak diperiksa secara terpisah.

### Bukti pengelolaan kunci

Dilaporkan oleh pemilik repo:

- Berkas kunci berukuran 65 byte (64 karakter hex dan satu karakter baris baru).
- Folder kunci hanya dapat diakses akun pemilik, SYSTEM, dan Administrators (diperiksa dengan `icacls`).
- Salinan cadangan di drive terpisah punya hash identik dengan berkas asli, dan aksesnya dibatasi dengan `icacls`.

### Yang tidak diuji manual

- Kunci salah hanya diuji otomatis (lihat [tabel-skenario.md](tabel-skenario.md)).
- Rute unduh publik (versi berstatus pernah disahkan) tidak diuji karena versi uji berstatus Draf.
- Uji izin POSIX tidak berjalan di Windows.
- Pengaruh perubahan status langsung di basis data tidak diuji karena status memang di luar tag.

Skenario pada kerangka awal bagian ini yang tidak termasuk laporan di atas, sehingga tidak diklaim
hasilnya di sini: menjalankan `buat-kunci.ts` kedua kali, `buat-kunci.ts` dengan lokasi di dalam
repository, mengubah satu byte PDF di `storage/`, dan kunci dihapus atau dipindah.
