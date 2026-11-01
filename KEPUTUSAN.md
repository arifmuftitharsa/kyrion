# KEPUTUSAN.md: Tugas 2 Kriptografi (krip-0.2)

| | |
|---|---|
| Mata kuliah | Kriptografi (052357) |
| Produk | Kyrion (`apps/web`) |
| Pemilik | Arif Mufti Tharsa (105224041) |
| Milestone | Tugas 2: Enkripsi Terautentikasi dan Integritas Data (tag `krip-0.2`) |
| Fitur | F-31: integritas catatan versi (PRD-Kyrion 1.5, bagian 7.4 dan 10.3) |
| Tanggal | 1 November 2026 |
| Commit kriptografi | `059d294` (modul), `f982f75` (integrasi), `c622805` (skrip dan dokumentasi); commit akhir menyusul |

## Ringkasan keputusan

| # | Keputusan | Pilihan |
|---|---|---|
| K-1 | Mekanisme integritas catatan versi | HMAC-SHA256 |
| K-2 | Data yang dilindungi | `id`, `regulation_id`, `version_number`, `effective_date`, `file_sha256`, `file_name`, `file_size` |
| K-3 | Data di luar perlindungan | `status`, `updated_at`, `change_summary`, tabel `changes` |
| K-4 | Kunci | Kunci induk 32 byte dari CSPRNG, kunci MAC diturunkan dengan HKDF-SHA256, disimpan di berkas di luar repository |
| K-5 | Waktu verifikasi | Saat unduh PDF, sebelum satu byte pun dikirim; gagal tertutup |
| K-6 | Hash kata sandi Admin | scrypt bawaan `node:crypto` (N=65536, r=8, p=2, salt acak) |

---

## 1. Kebutuhan perlindungan

### 1.1 Data dan tujuan keamanan

| Data | Tujuan keamanan | Ancaman |
|---|---|---|
| Berkas PDF versi (di `apps/web/storage/`) dan metadatanya (nomor versi, tanggal berlaku, hash, nama, ukuran) | Integritas dan autentisitas asal | Penyerang yang bisa menulis ke basis data mengganti PDF dan `file_sha256` sekaligus |
| Kata sandi akun Admin | Kerahasiaan verifikator | Basis data bocor, kata sandi ditebak secara offline |

### 1.2 Celah yang ditutup

Sebelum F-31, setiap berkas versi punya `file_sha256` (F-30, Tugas 1) yang dicocokkan ulang saat unduh. Hash polos itu tidak memakai rahasia, sehingga penyerang yang bisa menulis ke basis data dan ke folder penyimpanan cukup mengganti PDF-nya, menghitung SHA-256 PDF palsu, lalu menimpa `file_sha256`. Pemeriksaan lama akan lolos. F-31 menambahkan tag HMAC dengan kunci yang tidak ada di basis data.

### 1.3 Kenapa kerahasiaan bukan kebutuhan

Berkas regulasi memang dibuat untuk dibaca semua Sivitas dengan hak baca yang sama (PRD bagian 4.1), jadi tidak ada yang perlu dirahasiakan lewat enkripsi. Yang perlu dijaga adalah integritas (isi berkas dan metadatanya tidak diubah diam-diam) dan autentisitas asal (benar-benar berasal dari Kyrion) terhadap penyerang yang bisa menulis ke basis data.

---

## 2. Keputusan K-1: mekanisme integritas

### 2.1 Alternatif yang dibandingkan

| Kriteria | A. SHA-256 polos (keadaan sebelum F-31) | **B. HMAC-SHA256 (dipilih)** | C. AES-256-GCM | D. Tanda tangan Ed25519 |
|---|---|---|---|---|
| Menahan penyerang yang menulis ke basis data | Tidak | Ya | Ya | Ya |
| Kerahasiaan | Tidak | Tidak | Ya | Tidak |
| Butuh nonce unik | Tidak | Tidak | Ya | Tidak |
| Akibat kunci hilang | Tidak ada | Verifikasi gagal, PDF tetap bisa dibaca | PDF tidak bisa dibuka | Verifikasi gagal |
| Kelas mekanisme di RPS Tugas 2 | Tidak sesuai (hash tanpa kunci untuk integritas terhadap penyerang) | HMAC untuk integritas | AEAD | Kunci publik (Tugas 3 Bagian A) |

### 2.2 Alasan memilih HMAC

HMAC-SHA256 dipilih karena kebutuhannya integritas dan autentisitas tanpa kerahasiaan, dan HMAC memenuhinya tanpa nonce. Kalau kunci hilang, PDF tetap bisa dibaca.

- **A (hash polos)** tidak menahan penyerang yang bisa menulis hash, seperti dijelaskan di bagian 1.2.
- **C (AES-256-GCM)** tidak dipilih karena PDF tidak perlu dienkripsi. Nonce yang berulang pada GCM membocorkan kunci autentikasinya sehingga tag bisa dipalsukan, dan kunci yang hilang membuat semua PDF tidak bisa dibuka.
- **D (Ed25519)** tidak dipilih untuk Tugas 2 karena tanda tangan kunci publik baru diperlukan bila pihak lain harus memverifikasi sendiri, sedangkan di sini aplikasi yang sama yang membuat dan memeriksa tag. Mekanisme itu dipakai di Tugas 3 (F-32, tanda tangan saat pengesahan).

---

## 3. Keputusan K-2 dan K-3: data dalam tag dan di luar tag

### 3.1 Daftar

| Data | Dalam tag | Alasan |
|---|---|---|
| `id` | Ya | Mengikat tag ke baris tertentu |
| `regulation_id` | Ya | Mengikat tag ke regulasi tertentu |
| `version_number` | Ya | Isi yang terkunci setelah pengesahan |
| `effective_date` | Ya | Menentukan versi yang berlaku (F-03) |
| `file_sha256` | Ya | Jembatan ke F-30: hash isi PDF ikut dilindungi |
| `file_name`, `file_size` | Ya | Bagian dari catatan berkas |
| `status` | **Tidak** | Berubah wajar oleh sistem (Sah menjadi Digantikan, PRD bagian 5.1); bila ikut tag, tag harus dihitung ulang setiap transisi |
| `updated_at`, `change_summary`, tabel `changes` | Tidak | Bukan isi yang terkunci |

### 3.2 Alasan `id` dan `regulation_id` ikut tag

Supaya tag terikat ke baris dan regulasi tertentu. Penyerang yang menyalin isi beserta tagnya dari satu baris ke baris lain ditolak, karena pesan yang dihitung ulang memuat `id` baris tujuan sehingga berbeda dari pesan yang dulu ditandatangani.

### 3.3 Konsekuensi `status` di luar tag

Perubahan `status` langsung di basis data (misalnya Draf menjadi Sah) tidak terdeteksi di v0.2. Ini keterbatasan terpenting (lihat bagian 7). Penutupnya direncanakan: tanda tangan saat pengesahan (F-32), rantai versi (F-34), log audit (F-15), dan hak akses basis data seminimal mungkin (KKS).

---

## 4. Parameter dan format

### 4.1 Parameter

| Parameter | Nilai |
|---|---|
| Algoritma | HMAC-SHA256 (`node:crypto`) |
| Kunci induk | 32 byte dari CSPRNG (`randomBytes`) |
| Turunan kunci | HKDF-SHA256, salt kosong, `info` = `kyrion v0.2 version-mac`, keluaran 32 byte |
| Format tag | `v1$<hex64>` (panjang 67 karakter) |
| Perbandingan tag | `timingSafeEqual` (waktu konstan) |
| Nonce | Tidak ada |

### 4.2 Kanonikalisasi (bentuk byte yang ditandatangani)

Pesan yang di-HMAC bukan `JSON.stringify`, karena urutan kunci dan penulisan angka bisa berbeda untuk makna yang sama dan itu membuat tag tidak cocok. Bentuk yang dipakai:

| Aturan | Isi |
|---|---|
| Label | `kyrion:version:v1`, juga diberi awalan panjang |
| Setiap field | Awalan panjang 4 byte (big-endian), lalu isi dalam UTF-8 |
| Urutan field | Tetap, sesuai antarmuka `DataVersiTerlindung` |
| Teks | Dinormalisasi NFC; string dengan surrogate yatim ditolak |
| Tanggal | `YYYY-MM-DD` |
| Angka | Teks desimal |
| `file_sha256` | 64 karakter hex huruf kecil |

Awalan panjang membuat tiap field punya batas yang jelas, sehingga dua data berbeda tidak bisa menghasilkan byte yang sama (misalnya `"ab"` dan `"c"` tidak sama dengan `"a"` dan `"bc"`).

### 4.3 Kenapa tanpa nonce

HMAC tidak butuh nonce karena fungsinya deterministik dan keamanannya tidak bergantung pada keacakan masukan. Tujuannya verifikasi dengan menghitung ulang, jadi pesan yang sama harus menghasilkan tag yang sama. Nonce dibutuhkan pada enkripsi seperti GCM untuk mencegah pemakaian ulang aliran kunci. `id` tidak menggantikan nonce; fungsinya mengikat tag ke baris.

### 4.4 Kenapa HKDF

HKDF-SHA256 menurunkan kunci MAC dari kunci induk, sehingga satu kunci induk bisa dipakai untuk tujuan lain (misalnya kunci penandatanganan di Tugas 3) tanpa memakai byte kunci yang sama. Dua tahapnya:

```
Extract: PRK = HMAC-SHA256(salt, kunci_induk)       salt kosong dianggap 32 byte nol
Expand : OKM = HMAC-SHA256(PRK, info || 0x01)        untuk 32 byte cukup satu blok
```

Extract meratakan bahan kunci (di sini sudah acak penuh). Expand menghasilkan kunci dari `info`, dan `info` yang berbeda menghasilkan kunci yang tampak tidak berhubungan.

---

## 5. Alur kerja dan penanganan galat

### 5.1 Kapan tag dibuat dan diperiksa

| Kejadian | Perilaku |
|---|---|
| Membuat versi (`createVersion`) | `id` dibuat aplikasi dengan `randomUUID()`; tag dihitung bila ada berkas; tanpa berkas, tag `NULL` |
| Mengubah Draf (`updateDraftVersion`) | Dalam satu transaksi: baca baris, gabungkan dengan nilai baru, hitung ulang tag, tulis |
| Mengunduh PDF | Sebelum respons dibuat: format tag, lalu `verifyFingerprint` (F-30), lalu HMAC dengan `timingSafeEqual`; gagal tertutup |
| Data lama (tag kosong) | Ditolak sampai `backfill-integritas.ts` dijalankan |

### 5.2 Jenis galat

| Galat | Penyebab | Respons ke pengguna |
|---|---|---|
| `KunciTidakValid` | Kunci tidak ada, panjang salah, atau bukan hex | HTTP 500, pesan tetap |
| `IntegritasGagal` | Tag kosong, formatnya rusak, atau tidak cocok | HTTP 500, pesan tetap: "Berkas gagal diverifikasi: isinya tidak sama dengan yang tercatat." |

Log server hanya mencatat `file_key` dan nama galat, tanpa stack, tag, kunci, atau isi data.

### 5.3 Kenapa kunci salah tidak bisa dibedakan dari data diubah, dan kenapa pesannya tunggal

Saat verifikasi, sistem hanya membandingkan tag tersimpan dengan tag yang dihitung ulang. Keluaran HMAC bersifat pseudoacak, jadi perbedaan sekecil apa pun tampak sama dan tidak memberi petunjuk apakah penyebabnya data diubah atau kunci salah. Yang bisa dibedakan hanya kunci yang rusak atau hilang (format tidak valid, `KunciTidakValid`) dengan kunci valid yang tidak cocok (`IntegritasGagal`).

Dua mekanisme terpisah menjaga agar tidak ada petunjuk bagi penyerang:
- **Pesan tunggal:** penyerang tidak tahu bagian mana yang berubah.
- **`timingSafeEqual`:** tag tidak bisa ditebak lewat lama respons.

---

## 6. Keputusan K-4 dan K-6: pengelolaan kunci dan hash kata sandi

### 6.1 Pengelolaan kunci (K-4)

| Aspek | Keputusan |
|---|---|
| Pembangkitan | `randomBytes(32)` oleh skrip `prisma/buat-kunci.ts`, ditulis sebagai hex |
| Lokasi | `C:/Users/Arif/.kyrion/kyrion-master.key`, **di luar repository** |
| Cara diacu | Variabel `KYRION_MASTER_KEY_FILE` di `.env.local` (diabaikan Git). `.env.local` hanya menyimpan **lokasinya**, bukan kuncinya |
| Anti-penimpaan | Dibuat dengan flag `wx`; skrip menolak bila berkas sudah ada dan menolak lokasi di dalam repository |
| Akses | Hanya akun pemilik, SYSTEM, dan Administrators (diperiksa dengan `icacls`) |
| Cadangan | Salinan di drive terpisah (D:) dengan akses dibatasi; hash identik dengan berkas asli |
| Kunci hilang | Semua unduhan versi berberkas gagal tertutup; data lama tidak bisa ditandatangani ulang tanpa kunci baru |
| Kunci bocor | Semua tag dianggap bisa dipalsukan. Kunci baru harus dibuat dan data dicek terhadap salinan tepercaya sebelum ditandatangani ulang |
| Rotasi | **Belum didukung di v0.2.** Menjadi bagian siklus hidup kunci di Tugas 3. Rancangan konsepnya: tag memuat pengenal kunci, penandatanganan memakai kunci baru, verifikasi menerima kunci lama atau baru, lalu tag lama diganti bertahap |
| Windows | Mode `0600` tidak berlaku seperti di POSIX; akses dibatasi dengan ACL (`icacls`). Uji izin POSIX tidak berjalan di Windows |

### 6.2 Hash kata sandi Admin (K-6)

| Parameter | Nilai |
|---|---|
| Algoritma | scrypt bawaan `node:crypto` |
| Parameter | N=65536 (2^16, 64 MiB), r=8, p=2 |
| Salt | Acak, per kata sandi |
| Format | `scrypt$N$r$p$salt$hash` |

Parameter ini adalah salah satu dari lima konfigurasi setara yang tercantum di OWASP Password Storage Cheat Sheet (pustaka [7] di RPS).

- **Kenapa scrypt dan bukan Argon2id:** OWASP menaruh Argon2id di urutan pertama dan scrypt di kedua. scrypt dipilih karena tersedia di `node:crypto` tanpa dependensi baru dan diterima RPS Tugas 2.
- **Kenapa lambat dan memakan memori:** supaya tebakan brute-force mahal. HKDF cepat karena kunci induknya sudah acak penuh, sedangkan kata sandi buatan manusia tidak.
- **Fungsi salt:** membuat kata sandi yang sama menghasilkan hash berbeda dan menggagalkan rainbow table.
- Di Kyrion, scrypt dipakai untuk menyimpan **verifikator** kata sandi Admin, bukan untuk menurunkan kunci.

---

## 7. Keterbatasan

Urut dari yang terpenting:

| # | Keterbatasan | Dampak | Arah perbaikan |
|---|---|---|---|
| 1 | `status` di luar tag | Penyerang basis data bisa mengubah Draf menjadi Sah dan memublikasikan draf | F-32, F-34, F-15, hak akses basis data minimal |
| 2 | Verifikasi hanya saat unduh | Nomor versi dan tanggal yang tampil di halaman tidak diverifikasi | F-33 (Tugas 3) |
| 3 | HMAC tidak melindungi dari pembaca kunci | Penyerang yang bisa membaca berkas kunci di server bisa membuat tag palsu | Pembatasan akses, siklus hidup kunci (Tugas 3) |
| 4 | Versi tanpa berkas tidak bertag | `version_number` dan `effective_date` versi tanpa PDF tidak terlindungi | Pengesahan mewajibkan berkas (v0.3) |
| 5 | Backfill mempercayai isi basis data saat dijalankan | Data yang sudah dirusak sebelum backfill bisa ikut ditandatangani bila hash polosnya cocok | Backfill memeriksa hash berkas dulu dan melewati yang tidak cocok; selebihnya dijalankan hanya pada data tepercaya |
| 6 | Kunci hilang | Semua unduhan versi berberkas gagal | Cadangan kunci |
| 7 | Rotasi belum didukung | Kunci tidak bisa diganti tanpa menandatangani ulang | Tugas 3 |
| 8 | Uji izin POSIX tidak berjalan di Windows | Pemeriksaan mode berkas hanya teruji di non-Windows | Jalankan di WSL atau Docker |

---

## 8. Dampak ke mata kuliah lain

| Mata kuliah | Dampak |
|---|---|
| KKS | Kunci HMAC adalah aset baru: catat di inventaris aset dan register risiko. Pada container (Dockerfile dan `compose.yaml`), berkas kunci harus dimasukkan lewat volume atau secret, tidak ada di image atau repository |
| PAW | Unggah PDF (F-12) dan unduhan (F-05) kini bergantung pada kunci; kolom baru `integrity_tag` di tabel `versions` (sudah di ERD `docs/tugas-2/erd-v0.2.mmd`) |
| Kriptografi Tugas 3 | F-32 (tanda tangan saat pengesahan), F-33 (verifikasi dan siklus hidup kunci), dan F-34 (rantai versi) melanjutkan keterbatasan nomor 1, 2, dan 7 |

---

## 9. Bukti dan rujukan

| Bukti | Lokasi |
|---|---|
| Dokumentasi parameter, kunci, dan hasil uji manual M-01 sampai M-08 | `docs/kriptografi/integritas-versi.md` |
| Tabel skenario uji otomatis (U-01 sampai U-13) | `docs/kriptografi/tabel-skenario.md` |
| Keluaran uji otomatis (7 berkas, 112 lulus, 2 dilewati) | `docs/kriptografi/bukti/vitest.txt` |
| Bagian README dan tabel sambungan Tugas 1 ke Tugas 2 | `README.md`, bagian "Kriptografi: krip-0.2 (F-31)" |
| Catatan penggunaan AI | `AI_LOG.md` (penanda `[KRIP]`) |

### Pemetaan ke rubrik R2

| Kriteria | Dijawab di |
|---|---|
| K1 Pemilihan mekanisme | Bagian 1 dan 2 (kebutuhan, alternatif, alasan; kerahasiaan dijelaskan bukan kebutuhan) |
| K2 Implementasi dan parameter | Bagian 4 dan 5 (parameter, kanonikalisasi, tanpa nonce, HKDF) |
| K3 Masukan dan kunci | Bagian 4.2 (validasi), 5 (gagal tertutup), 6.1 (kunci) |
| K4 Skenario uji dan kondisi tidak sah | `tabel-skenario.md`, `vitest.txt`, hasil uji manual |
| K5 Dokumentasi, demonstrasi, AI_LOG | Dokumen ini, `integritas-versi.md`, `AI_LOG.md` |

### Rujukan

- RFC 2104 (HMAC), RFC 4231 (vektor uji HMAC-SHA256), RFC 5869 (HKDF).
- NIST SP 800-57 Bagian 1 (pemisahan kunci per tujuan).
- OWASP Password Storage Cheat Sheet (parameter scrypt).
