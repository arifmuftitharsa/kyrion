# Uji Akses (sec-0.2)

Dokumen ini memuat matriks hak akses per peran, uji positif dan negatif terhadap Kyrion yang berjalan di VM staging, serta bukti tiap uji. Kontrol yang diuji merujuk risiko R-03 (T-06, ketiadaan pemeriksaan sesi dan peran pada Server Action) di `risk-register.md`; uji login merujuk R-04 (T-02) dan R-06 (T-08).

## Lingkungan uji

- Aplikasi: container `kyrion-web:hardened` pada VM staging (Ubuntu Server 24.04 LTS). Aplikasi hanya terikat ke 127.0.0.1:3000 di VM.
- Akses dari laptop: SSH tunnel `-L 13000:127.0.0.1:3000`, sehingga semua uji menembak `http://localhost:13000`.
- Alat uji: `curl.exe` dari PowerShell dengan format keluaran `%{http_code}|%{redirect_url}`. Nilai cookie sesi tidak pernah ditulis ke berkas bukti.
- Data: sintetis. Akun uji: admin.uji@universitaspertamina.ac.id (peran ADMIN).
- Semua waktu dalam UTC.

## Peran yang ada saat ini

Hanya dua peran yang benar-benar ada pada versi yang diuji: **Anonim** (tanpa sesi) dan **Admin Akademik**. Peran Sivitas dan login akun kampus baru dibangun di PAW Tugas 3 (v0.3), sehingga belum bisa diuji di sini.

## Matriks hak akses

| Sumber daya | Anonim | Admin Akademik |
|-------------|--------|----------------|
| Halaman publik: `/`, `/masuk`, `/verifikasi`, `/regulasi/<slug>` | Boleh | Boleh |
| Halaman admin: `/admin/regulasi`, `/admin/kategori`, `/admin/regulasi/baru`, `/admin/kategori/baru`, `.../versi` | Ditolak (307 ke `/masuk`) | Boleh |
| Unduh berkas versi: `/admin/regulasi/<slug>/versi/<id>/berkas` | Ditolak (307 ke `/masuk`) | Tidak diuji pada matriks ini |
| Server Action admin (12 fungsi) | Ditolak (dialihkan ke `/masuk`, tidak berefek) | Dirancang boleh; tidak diuji pada matriks ini |
| Sesi lama (setelah Keluar atau setelah restart aplikasi) | Diperlakukan sebagai anonim | Diperlakukan sebagai anonim |

## Lapisan kontrol

1. `proxy.ts`: memeriksa **keberadaan** cookie `sesi` pada rute `/admin`. Tanpa cookie, permintaan dialihkan ke `/masuk`.
2. `wajibAdmin()`: dipanggil di awal setiap Server Action admin dan halaman admin; memeriksa sesi di server (dan memeriksa ulang ke basis data) sehingga cookie yang masih ada tetapi sesinya sudah tidak valid tetap ditolak.

Dua lapis dipakai karena lapis pertama hanya melihat ada atau tidaknya cookie, sedangkan keputusan sebenarnya ada di lapis kedua.

## Uji positif (12)

| ID | Peran | Aksi | Harapan | Hasil | Bukti |
|----|-------|------|---------|-------|-------|
| A-P1 | Anonim | GET `/` | 200 | 200 | bukti/access-anonim.txt |
| A-P2 | Anonim | GET `/masuk` | 200 | 200 | bukti/access-anonim.txt |
| A-P3 | Anonim | GET `/verifikasi` | 200 | 200 | bukti/access-anonim.txt |
| A-P4 | Anonim | GET `/regulasi/pedoman-akademik` | 200 | 200 | bukti/access-anonim.txt |
| D-P1 | Admin | Login dengan email dan kata sandi benar | Masuk ke halaman admin | Halaman Kelola Regulasi tampil | img/sec02-admin-login-benar.png |
| D-P2 | Admin | GET `/admin/regulasi` | 200 | 200 | bukti/access-admin.txt |
| D-P3 | Admin | GET `/admin/kategori` | 200 | 200 | bukti/access-admin.txt |
| D-P4 | Admin | GET `/admin/regulasi/baru` | 200 | 200 | bukti/access-admin.txt |
| D-P5 | Admin | GET `/admin/regulasi/pedoman-akademik/versi` | 200 | 200 | bukti/access-admin.txt |
| D-P6 | Admin | GET `/admin/kategori/baru` | 200 | 200 | bukti/access-admin-tambahan.txt |
| D-P7 | Admin | GET `/` (halaman publik saat login) | 200 | 200 | bukti/access-admin-tambahan.txt |
| D-P8 | Admin | GET `/verifikasi` (halaman publik saat login) | 200 | 200 | bukti/access-admin-tambahan.txt |

## Uji negatif (12)

| ID | Peran | Aksi | Harapan | Hasil | Bukti |
|----|-------|------|---------|-------|-------|
| A-N1 | Anonim | GET `/admin/regulasi` | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-anonim.txt |
| A-N2 | Anonim | GET `/admin/kategori` | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-anonim.txt |
| A-N3 | Anonim | GET `/admin/regulasi/baru` | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-anonim.txt |
| A-N4 | Anonim | GET `/admin/regulasi/pedoman-akademik/versi/<UUID nol>/berkas` | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-anonim.txt |
| A-N5 | Anonim | `/admin/regulasi` (variasi uji; metode tidak dicatat) | Ditolak | 307 ke `/masuk` | bukti/access-anonim.txt |
| A-N6 | Anonim | `/admin/regulasi/pedoman-akademik/versi/<UUID nol>/berkas` (variasi uji; metode tidak dicatat) | Ditolak | 307 ke `/masuk` | bukti/access-anonim.txt |
| A-N7 | Cookie ada, sesi sudah hilang | Kirim formulir Server Action "kategori baru" setelah aplikasi direstart | Dialihkan ke `/masuk`, tidak ada kategori baru | Dialihkan ke `/masuk`; jumlah kategori tetap 2 | bukti/access-server-action-tanpa-sesi.txt, img/sec02-admin-aksi-tanpa-sesi.png |
| D-N1 | Anonim | Login dengan kata sandi salah | Ditolak, pesan galat seragam | Ditolak | img/sec02-admin-login-salah.png |
| D-N2a | Admin (sesi lama) | GET `/admin/regulasi` dengan cookie setelah klik Keluar | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-admin-keluar.txt |
| D-N2b | Admin (sesi lama) | GET `/admin/kategori` dengan cookie setelah klik Keluar | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-admin-keluar.txt |
| D-N3a | Admin (sesi sebelum restart) | GET `/admin/regulasi` dengan cookie sah sebelum restart, dipakai sesudah restart | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-admin-restart.txt |
| D-N3b | Admin (sesi sebelum restart) | GET `/admin/kategori` dengan cookie sah sebelum restart, dipakai sesudah restart | 307 ke `/masuk` | 307 ke `/masuk` | bukti/access-admin-restart.txt |

## Bukti pendukung

- **Semua Server Action admin dijaga:** pencarian statis menunjukkan 12 fungsi `export async function` di folder `apps/web/app/admin` masing-masing memanggil `await wajibAdmin();` beberapa baris setelah deklarasinya (bukti/server-action-guard.txt). Bukti ini menunjukkan keberadaan pemeriksaan, bukan bahwa itu pernyataan pertama secara harfiah; karena itu uji dinamis A-N7 dilakukan.
- **Kata sandi disimpan sebagai hash lambat:** satu akun ADMIN dengan hash scrypt (N=65536, r=8, p=2), salt 24 karakter, hash 44 karakter. Hanya parameter dan panjang yang ditampilkan, nilai hash dan salt tidak (bukti/hash-kata-sandi.txt; risiko R-06).
- **Port tidak terbuka dari luar VM:** dari laptop, port 22 terbuka, sedangkan port 3000 dan 5432 pada alamat VM tidak dapat dijangkau (bukti/access-port-laptop.txt).

## Keterbatasan

- Hanya dua peran yang diuji (Anonim dan Admin Akademik); peran Sivitas menunggu v0.3.
- Uji A-N1 sampai A-N4 dan semua uji D memakai GET. Metode pada A-N5 dan A-N6 tidak dicatat, sehingga keduanya hanya dicantumkan sebagai hasil yang tercatat.
- Sesi disimpan di memori proses aplikasi: hilang saat restart (terbukti pada D-N3) dan tidak dibagi antar instance.
- Belum ada pembatasan laju percobaan masuk (R-04 hanya terpenuhi sebagian: hash lambat ada, rate limiting belum).
- Header halaman masih menampilkan menu admin selama cookie ada, walaupun sesinya sudah tidak valid (terlihat pada tangkapan layar A-N7). Ini hanya tampilan; semua halaman dan aksi admin tetap ditolak.
- Pengujian hanya terhadap VM dan container milik sendiri dengan data sintetis.