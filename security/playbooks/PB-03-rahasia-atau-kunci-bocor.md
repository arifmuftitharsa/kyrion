# PB-03: Rahasia atau kunci diduga bocor

| | |
|---|---|
| Versi, tanggal | 1, 2026-11-26 (sec-0.3) |
| Pemicu | Manual: temuan gitleaks, rahasia terlihat di repo, log, bukti atau layar bersama, laptop atau berkas kunci hilang, atau tanda penyalahgunaan dari PB-01 atau PB-02. **Tidak ada rule DET untuk skenario ini** |
| Technique ATT&CK | T1552 Unsecured Credentials (usulan, belum diverifikasi Arif di attack.mitre.org) |
| Risiko | R-11, T-17 (`../risk-register.md`); kunci: `../../docs/kriptografi/peran-kunci.md` |
| Rencana induk | Peran, kontak, severity, dan komunikasi ada di `../ir-plan.md` |
| Status | Belum dilatih. Semua langkah rotasi di bagian 3 berstatus "belum diuji" (`../secrets.md` bagian 3) |

Playbook ini juga menjawab pertanyaan Kriptografi: apa keputusan bila kunci diduga bocor (kunci induk HMAC dan kunci tanda tangan Ed25519).

**Prinsip:** rahasia yang sudah terpapar dianggap terbuka. Menghapusnya dari berkas atau riwayat git tidak membatalkan paparan; yang menutup risiko adalah mengganti nilainya (rotasi) atau mencabutnya.

## Peran

Sama dengan `../ir-plan.md` bagian 1.

## 1. Deteksi

1. Catat waktu UTC, siapa atau apa yang menemukan, dan di mana rahasia terlihat.
2. Sumber temuan yang ada di proyek: gitleaks atas riwayat git (`../secrets.md` bagian 4; perintah di `../bukti/gitleaks-catatan.txt`) dan pemeriksaan manual. Tidak ada deteksi otomatis atas kebocoran di luar repo.

## 2. Triase dan analisis

Jawab berurutan, catat jawabannya:

1. **Rahasia apa?** Cocokkan dengan inventaris di `../secrets.md` bagian 1 (URL database, rahasia Better Auth, token Mailtrap, kunci induk HMAC, kunci Ed25519 dan keyring, kata sandi peran DB, kunci privat age, kunci privat SSH, kunci privat TLS).
2. **Terpapar ke mana?** Repo publik (`arifmuftitharsa/kyrion` berstatus publik), bukti atau tangkapan layar yang dibagikan, pesan, atau hanya berkas lokal. Simpan salinan temuan tanpa menempelkan nilainya.
3. **Adakah bukti dipakai pihak lain?**
   - Sesi atau baris `audit_logs` yang tidak dikenal (PB-01 bagian 2).
   - sshd: `{unit="ssh.service"}` di Loki, cari `Accepted` dari alamat tak dikenal.
   - Mailtrap: aktivitas inbox atau pengiriman tak dikenal di dashboard Mailtrap.
   - Basis data: koneksi atau perubahan data tak dikenal (perintah kueri tidak ada di dokumen sumber).

**Severity** (definisi di `../ir-plan.md` bagian 3):

- S1 bila rahasia diduga dikuasai pihak lain (terpapar di tempat publik, atau ada tanda dipakai).
- S2 bila rahasia salah tempat tetapi tidak terpapar ke pihak luar (mis. tersimpan di berkas lokal yang bukan repo) dan tidak ada tanda dipakai.

**DP-1, seberapa luas paparan.**

- JIKA rahasia ada di repo publik atau berkas yang dibagikan, MAKA anggap terbuka bagi siapa pun: rotasi wajib (DP-3).
- JIKA hanya di berkas lokal dan tidak pernah dibagikan, MAKA catat; rotasi tetap diputuskan Incident Commander dengan alasan tertulis.

**DP-2, apakah sudah dipakai.**

- JIKA ada tanda dipakai (butir 3), MAKA lanjutkan juga PB-01 (akses aplikasi) atau PB-02 (akses jaringan) dan perlakukan sebagai S1.
- JIKA tidak ditemukan, MAKA tulis "tidak ditemukan pada sumber yang diperiksa", bukan "tidak terjadi".

**DP-3, rahasia mana dirotasi atau dicabut.** Gunakan tabel bagian 3 menurut rahasia yang terpapar.

## 3. Penahanan: rotasi dan pencabutan

Urutan umum: (1) cabut atau ganti nilai di sumbernya, (2) tulis nilai baru ke berkas rahasia, (3) ganti-pasang layanan, (4) verifikasi, (5) pastikan nilai lama tidak dapat dipakai lagi.

| Rahasia | Tindakan | Dampak | Status uji |
|---|---|---|---|
| `kyrion_better_auth_secret` | Nilai acak baru ke berkas rahasia (0400, UID 10001), ganti-pasang container app (`../secrets.md` 3) | Semua sesi tidak valid; pengguna masuk ulang | belum diuji |
| `kyrion_mailtrap_api_token` | Terbitkan token baru di Mailtrap, tulis ke berkas, ganti-pasang app, cabut token lama | OTP gagal terkirim selama jeda | belum diuji |
| `kyrion_database_url` dan kata sandi peran DB | `ALTER ROLE ... PASSWORD` lewat `roles.sql` dengan nilai baru, perbarui berkas rahasia, ganti-pasang app (`../secrets.md` 3) | Koneksi app terputus sebentar | belum diuji |
| Kunci privat Ed25519 (tanda tangan) | **Cabut**: `npx tsx prisma/kelola-kunci.ts cabut --id <id>` (semua tanda tangan kunci itu ditolak, K-9). Lalu buat kunci baru: `... buat --out <berkas>` atau `putar` bila hanya rotasi (README bagian kunci) | Tanda tangan lama dari kunci dicabut menjadi "tidak cocok"; **tanda tangan ulang belum ada, ditunda ke v1.0** (`prisma/kelola-kunci.ts`) | alat ada dan teruji di Kriptografi; dipakai sebagai respons insiden: belum diuji |
| Kunci induk HMAC | **Tidak ada alat tanggapan di kode** (`../../docs/kriptografi/peran-kunci.md`). Yang ada hanya cadangan baru (`../secrets.md` 3). Tidak ada alat untuk menghitung ulang tag yang sudah terisi, karena `prisma/backfill-integritas.ts` hanya mengisi tag `null`; satu-satunya jalur yang tertulis bersifat manual, yaitu tag lama dikosongkan lalu backfill dijalankan (`../../docs/kriptografi/integritas-versi.md`, butir "Kunci hilang"), dan jalur itu belum diuji sebagai prosedur penggantian kunci induk (uji manual M-07 hanya meniru data lama); untuk kunci yang bocor, data harus dicek terhadap salinan tepercaya sebelum tag ditandatangani ulang (`../../KEPUTUSAN.md` K-4, baris 181), karena backfill mempercayai isi basis data saat dijalankan (`../../KEPUTUSAN.md` baris 213) | Verifikasi gagal sampai tag dihitung ulang. Pemegang kunci yang juga bisa menulis basis data dapat membuat tag HMAC sah. Kunci Ed25519 tidak ikut terbuka (tidak diturunkan dari kunci induk) | **celah playbook**: prosedur lengkap belum ada |
| Kunci privat age (cadangan) | Pasangan kunci baru, ganti `age-recipient.txt`, buat cadangan baru. Cadangan lama tetap dapat dibuka pemegang kunci lama; **tindakan atas cadangan lama tidak ada di dokumen** | Cadangan baru memakai penerima baru | belum diuji |
| Kunci privat SSH admin | **Prosedur tidak ada di dokumen sumber** | - | celah playbook |
| Kunci privat TLS (`server.key`) | **Prosedur tidak ada di dokumen sumber** | - | celah playbook |

Bila host diduga dikuasai, hentikan layanan (PB-01 P-4, belum diuji) sebelum rotasi.

## 4. Pemberantasan

1. Tentukan akar masalah (kebocoran lewat commit, bukti, layar, berkas hilang). Bila belum diketahui, tulis "belum diketahui".
2. Bersihkan sumber paparan (hapus dari repo, tarik bukti), dengan catatan bahwa paparan yang sudah terjadi tidak terhapus.
3. Jalankan pemeriksaan gitleaks ulang atas riwayat setelah perbaikan (`../bukti/gitleaks-catatan.txt`).

## 5. Pemulihan dan penutupan

1. Verifikasi layanan: `https://kyrion.test/masuk` 200, login OTP berhasil, unduh dan verifikasi satu PDF (harus akun ADMIN: unduh di `/admin/regulasi/<slug>/versi`, periksa berkas di `/admin/verifikasi`; akun Sivitas dijawab 404 menurut desain) (PB-01 bagian 5 langkah 5).
2. Pastikan nilai lama tidak dapat dipakai (token lama dicabut di Mailtrap, kata sandi lama ditolak DB, kunci dicabut ditolak verifikasi).
3. Bila data berubah atau rusak, pulihkan dari cadangan menurut PB-01 bagian 5.
4. Selesai JIKA layanan normal, semua rahasia terpapar sudah dirotasi atau dicabut dan terbukti, serta tidak ada akses tak dikenal baru.

## RTO dan RPO

Rotasi tidak menghilangkan data. Dampak ketersediaan: sesi hilang, OTP tertunda, atau koneksi terputus sebentar. Target dan celah pengukuran: `../bcp.md` (RTO belum terukur).

## 6. Komunikasi

Sesuai `../ir-plan.md` bagian 4. Bila kunci tanda tangan atau kunci induk HMAC terlibat, beri tahu juga dosen pengampu Kriptografi dan PAW karena kunci itu dipakai bersama.

## 7. Pasca-insiden dan review

1. Susun linimasa UTC: temuan, keputusan DP-1 sampai DP-3 dan pembuatnya, tindakan, verifikasi, penutupan.
2. Simpan bukti tanpa nilai rahasia.
3. Catat tanggal rotasi di `../secrets.md` bagian 3 dan perbarui celah playbook yang terbukti (prosedur kunci induk HMAC, SSH, TLS, cadangan lama).
4. Jadwalkan review dalam 7 hari (usulan, mengikuti contoh di slide pekan 13).

## Kategori CSF 2.0

Triase DE.AE dan RS.MA; analisis RS.AN; respons RS.MI; komunikasi RS.CO dan RC.CO; pemulihan RC.RP; review ID.IM.
