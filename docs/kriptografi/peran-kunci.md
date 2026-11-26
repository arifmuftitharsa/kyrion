# Peran kunci Kyrion (krip-0.2 dan krip-0.3)

Dokumen ini hanya memuat hal yang dapat dicocokkan dengan kode di `apps/web` dan dengan
[KEPUTUSAN.md](../../KEPUTUSAN.md) (bagian 6.1 dan bagian 10). Sel yang tidak dapat dipastikan dari
kode ditulis "tidak ada di kode". Dokumen ini tidak memuat hasil uji; lihat
[tabel-skenario-krip-0.3.md](tabel-skenario-krip-0.3.md).

## 1. Tabel peran kunci

Empat baris: dua kunci rahasia simetris dari F-31 (krip-0.2), satu kunci privat dan satu kunci
publik dari F-32 dan F-33 (krip-0.3).

| Kunci | Jenis | Tujuan | Dibangkitkan oleh | Disimpan di | Dipakai oleh | Siklus hidup | Bila hilang | Bila bocor |
|---|---|---|---|---|---|---|---|---|
| Kunci induk HMAC (krip-0.2) | Simetris, rahasia. 32 byte acak, ditulis sebagai 64 karakter hex | Bahan untuk menurunkan kunci MAC tag integritas versi (F-31). Tidak dipakai langsung sebagai kunci HMAC | `buatBerkasKunci` (`lib/crypto/kunci.ts`, `randomBytes(32)`), dipanggil skrip `prisma/buat-kunci.ts` | Berkas di luar repository; lokasinya di `KYRION_MASTER_KEY_FILE`. Berkas dibuat dengan flag `wx` dan mode `0o600`. Dibaca `bacaKunciInduk` (POSIX: ditolak bila bit grup atau other aktif; Windows: pemeriksaan dilewati). Disalin ke memori proses oleh `muatKunciInduk` (`lib/integritas-versi.ts`), hanya hasil sukses yang di-cache. Tidak ada di basis data | `turunkanKunciMac` (`lib/crypto/mac.ts`) lewat `buatTagVersi`. Pemanggil: `tandatanganiVersi` dan `periksaBerkasVersi` (`lib/integritas-versi.ts`), `verifikasiBerkasDenganDb` (`lib/data/verifikasi-berkas.ts`, untuk F-33), `prisma/backfill-integritas.ts` | Dibuat sekali. Rotasi dan pencabutan: tidak ada di kode (KEPUTUSAN bagian 6.1: belum didukung) | `bacaKunciInduk` melempar `KunciTidakValid`. Unduhan versi berberkas dan pemeriksaan F-33 gagal tertutup (F-33: `periksaBerkas` mengembalikan pesan galat umum). Skrip pemulihan: tidak ada di kode | Pemegang kunci yang juga bisa menulis basis data dapat membuat tag HMAC yang sah. Alat tanggapan (kunci baru dan tanda tangan ulang seluruh versi): tidak ada di kode. Kunci tanda tangan Ed25519 tidak ikut terbuka karena tidak diturunkan dari kunci ini (bagian 2) |
| Kunci MAC versi (turunan HKDF) | Simetris, rahasia. 32 byte, hasil HKDF-SHA256 dengan salt kosong dan `info` = `INFO_KUNCI_MAC` (`kyrion v0.2 version-mac`) | Kunci HMAC-SHA256 atas byte kanonis `kanonisasiVersi`, menghasilkan tag `integrity_tag` berformat `v1$` + 64 hex | `turunkanKunciMac` (`lib/crypto/mac.ts`, `hkdfSync`), dihitung ulang pada setiap `buatTagVersi` | Tidak disimpan: tidak ada kode yang menulisnya ke berkas atau basis data. Hanya ada di memori selama satu panggilan | `buatTagVersi` memanggil `hmacSha256`; `periksaIntegritasVersi` (`lib/crypto/verifikasi.ts`) memakai tag itu, dipanggil dari `periksaBerkasVersi` (unduhan) dan dari `integritasLolos` di `lib/crypto/verifikasi-pengesahan.ts` (F-33) | Mengikuti kunci induk; tidak punya siklus sendiri. `info` bersifat tetap di kode | Ikut kunci induk: tanpa kunci induk, kunci ini tidak dapat dihitung | Tidak ada di kode (tidak ada jalur yang menyimpan atau mencatat kunci turunan). Siapa pun yang memegang kunci induk dapat menghitungnya ulang |
| Kunci privat tanda tangan Ed25519 | Asimetris, rahasia. Ed25519, PEM PKCS#8 | Menandatangani payload pengesahan (F-32, K-7): `tandatangani` (`lib/crypto/tanda-tangan.ts`) menghasilkan tanda tangan 64 byte | `bangkitkanPasanganKunci` (`lib/crypto/tanda-tangan.ts`, `generateKeyPairSync("ed25519")`), dipanggil `buatKunci` dan `putarKunciOperator` (`lib/crypto/operasi-kunci.ts`) lewat `prisma/kelola-kunci.ts buat` dan `putar` | Berkas PEM di luar repository; lokasinya di `KYRION_SIGNING_KEY_FILE` (K-8). Ditulis `tulisPrivatBaru` dengan flag `wx` dan mode `0o600`. `lokasiLuarRepo` menolak lokasi di dalam repository (folder induk di-`realpath`). Tidak ada di basis data dan tidak ada di keyring | `muatKunciPrivat` dan `siapkanPenandatangan` (`lib/crypto/penandatangan.ts`), dipanggil `siapkanPenandatanganDariEnv` (`lib/data/penandatangan-env.ts`), dipanggil `sahkanVersiDenganAudit` (`lib/data/versions.ts`); `tandatanganiPengesahan` (`lib/crypto/tanda-tangan-pengesahan.ts`) dipanggil `isiTransaksiSahkan` (`lib/data/pengesahan.ts`) | Dibuat oleh operator (`buat`, `putar`). Hanya dipakai bila kunci publik pasangannya ada di keyring dengan status `aktif` (`siapkanPenandatangan`). Setelah `putar`, kunci lama tidak dapat menandatangani lagi. Penghapusan berkas privat oleh kode: hanya pembersihan berkas milik proses itu sendiri bila operasi gagal sebelum keyring ditulis (`denganPembersihan`) | `muatKunciPrivat` melempar `PenandatanganTidakValid`, dibungkus `PenandatanganBelumSiapError`: pengesahan ditolak sebelum transaksi dibuka. Verifikasi berkas tidak terpengaruh karena hanya memakai kunci publik. `putarKunciOperator` tidak membaca berkas privat lama (hanya keyring dan basis data), sehingga operator masih dapat memutar ke kunci baru | Pemegangnya dapat membuat tanda tangan yang lolos `verifikasiTandaTangan` selama kunci publik pasangannya belum dicabut. Pemeriksaan F-33 juga mensyaratkan tag HMAC lolos lebih dulu (`integritasLolos`), jadi pemalsuan penuh butuh kunci induk juga. Tanggapan: `cabutKunciOperator` (semua tanda tangan kunci itu ditolak, K-9). Tanda tangan ulang: tidak ada di kode (pesan `kelola-kunci.ts`: ditunda ke v1.0) |
| Kunci publik tanda tangan | Asimetris, tidak rahasia. Ed25519, SPKI DER (base64 di keyring, `bytea` di tabel) | Memverifikasi tanda tangan pengesahan (F-33). Identitasnya `idKunci`: 32 hex pertama dari SHA-256 atas SPKI DER | Satu pasangan dengan kunci privat (`bangkitkanPasanganKunci`). Entri keyring dibuat `entriBaru` lewat `tambahKunciAktif` atau `putarKunci` (`lib/crypto/keyring.ts`). Baris tabel dibuat `barisBaru` (`operasi-kunci.ts`) | Dua tempat. (1) Keyring: berkas JSON di luar repository dan di luar basis data, lokasi di `KYRION_KEYRING_FILE`, ditulis atomik oleh `tulisKeyring` (berkas sementara lalu `rename`); ini akar kepercayaan (K-10). (2) Tabel `signing_keys`, yang harus sama dengan keyring dalam lima hal (kunci publik, status, `dibuatPada`, `dirotasiPada`, `dicabutPada`) oleh `kunciSinkron`. Baris kunci tidak pernah dihapus (komentar `schema.prisma`; relasi `versions.signing_key_id` memakai `onDelete: Restrict`) | `verifikasiBerkas` (`lib/crypto/verifikasi-pengesahan.ts`): `cariKunci`, `kunciSinkron`, `kunciBolehMemverifikasi`, `verifikasiTandaTangan`. Keyring dibaca `bacaKeyringDariEnv` (`lib/data/verifikasi-env.ts`) dan `siapkanPenandatangan`. Tabel dibaca `verifikasiBerkasDenganDb` dan `isiTransaksiSahkan` (kunci harus `AKTIF`) | `aktif` lalu `dirotasi` (`putarKunci`) lalu `dicabut` (`cabutKunci`), diubah operator lewat `prisma/kelola-kunci.ts`. Paling banyak satu `aktif` (`periksaAturan`; indeks `signing_keys_satu_aktif_idx`). `kunciBolehMemverifikasi`: `dicabut` selalu ditolak; `dirotasi` hanya untuk `approvedAt` sampai `dirotasiPada`; semua status menolak `approvedAt` sebelum `dibuatPada` (K-9) | Keyring hilang atau rusak: `bacaKeyring` melempar `KeyringTidakValid`, tidak pernah dianggap keyring kosong; pengesahan dan pemeriksaan berkas gagal tertutup. `buatKunci` menolak menyambung bila keyring tidak ada tetapi `signing_keys` berisi. Pemulihan: manual dari salinan keyring (`PEMULIHAN_MANUAL` di `kelola-kunci.ts`); skrip otomatis tidak ada di kode | Tidak ada dampak kerahasiaan. Ancamannya disisipi atau diganti. Penyerang yang hanya menulis tabel `signing_keys` ditolak `kunciSinkron` (hasil `kunci-tidak-sinkron`). Penyerang yang bisa menulis berkas keyring: perlindungan integritas keyring selain izin berkas atau ACL tidak ada di kode (keyring tidak ditandatangani atau di-MAC) |

**Keaslian kunci publik (K-10).** Registri kunci publik adalah berkas keyring di luar basis data dan repository; saat verifikasi, baris `signing_keys` untuk kunci yang dirujuk versi harus sama persis dengan entri keyring (lima hal pada tabel di atas), dan bila tidak, hasilnya gagal tertutup "Kunci tidak dikenal atau tidak sinkron." (`kunci-tidak-sinkron`; skenario B-07).

## 2. Pemisahan kunci per tujuan

Tiap kunci di atas dipakai untuk satu tujuan saja.

- Kunci induk HMAC (krip-0.2) menghasilkan kunci MAC lewat HKDF dengan `info` tetap
  `kyrion v0.2 version-mac`. Tujuannya integritas catatan versi saat unduh dan saat F-33.
- Kunci tanda tangan Ed25519 **tidak diturunkan dari kunci induk HMAC**. Keputusan K-8
  (bagian 10.2 di KEPUTUSAN.md) menolak alternatif (c), menurunkannya dengan HKDF dari kunci
  induk, karena bocornya satu berkas lalu memberi kemampuan memalsukan HMAC dan tanda tangan
  sekaligus, dan rotasi keduanya jadi terikat. Di kode, pasangan kunci Ed25519 dibangkitkan
  sendiri oleh `bangkitkanPasanganKunci`, tidak menerima masukan dari kunci induk, dan lokasi
  berkasnya variabel lingkungan terpisah (`KYRION_SIGNING_KEY_FILE` dan `KYRION_KEYRING_FILE`
  untuk F-32 dan F-33; `KYRION_MASTER_KEY_FILE` untuk F-31).
- Pemisahan juga ada pada pesan yang ditandatangani. Payload pengesahan diawali label domain
  `kyrion/pengesahan-versi/v1` (`LABEL_PENGESAHAN`), berbeda dari label kanonis F-31
  `kyrion:version:v1`, sehingga payload ini tidak pernah sama dengan keluaran `kanonisasiVersi`.
- Konsekuensinya di F-33: satu versi dinyatakan asli dan sah hanya bila **dua** kunci yang
  berbeda sama-sama lolos. Pemeriksaan pertama di `periksaKandidat` memakai kunci induk
  (`integritasLolos`), pemeriksaan kelima memakai kunci publik dari keyring
  (`tandaTanganValid`).

## 3. Variabel lingkungan

| Variabel | Isi | Dibaca di |
|---|---|---|
| `KYRION_MASTER_KEY_FILE` | Lokasi berkas kunci induk HMAC | `lib/integritas-versi.ts` (`muatKunciInduk`), `prisma/buat-kunci.ts`, `prisma/backfill-integritas.ts` |
| `KYRION_SIGNING_KEY_FILE` | Lokasi berkas PEM kunci privat Ed25519 | `lib/data/penandatangan-env.ts` |
| `KYRION_KEYRING_FILE` | Lokasi berkas keyring (kunci publik saja) | `lib/data/penandatangan-env.ts`, `lib/data/verifikasi-env.ts`, `prisma/kelola-kunci.ts` |

Variabel hanya menyimpan lokasi, bukan isi kunci.
