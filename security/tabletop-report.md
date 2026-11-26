# Laporan tabletop Kyrion: tebakan OTP sampai pemulihan (sec-0.3 Bagian B)

| | |
|---|---|
| Tanggal latihan | 2026-11-25 |
| Rilis | sec-0.3 |
| Jenis | Tabletop diskusi, skenario sintetis (IP 203.0.113.50, rentang dokumentasi). Tanpa data nyata, tanpa perintah dijalankan di VM |
| Peserta | Arif memegang semua peran. Fasilitator inject: Claude (alat bantu) |
| Diuji | `playbooks/PB-01-tebakan-otp-dan-rute-sensitif.md`, `bcp.md` (versi sebelum perbaikan dari latihan ini) |

Latihan ini menguji keputusan, bukan perintah. Tidak ada waktu penahanan atau pemulihan yang terukur.

## 1. Skenario dan tujuan

Tebakan OTP dari satu IP berujung dugaan pengambilalihan akun Admin dan pengesahan versi regulasi yang tidak sah. Risiko: R-14 (T-11), R-03, R-12, R-15. Tujuan: menguji apakah peran, decision point, penahanan, dan pemulihan di PB-01 dapat dijalankan, serta menemukan celah.

## 2. Linimasa

Menit relatif. Kolom "Isi inject" adalah **ringkasan yang direkonstruksi dari jawaban operator**; teks asli inject tidak disimpan di repo. Kolom "Jawaban operator" direkam menurut jawaban Arif, termasuk yang keliru; koreksi ada di bagian 4.

| Waktu | Isi inject (ringkasan) | Jawaban operator | Keputusan | Rujukan PB-01 |
|---|---|---|---|---|
| T+0 | Alert D-1: lonjakan request dari 203.0.113.50 | Peran IC merangkap Lead Responder; catat waktu deteksi; buka Grafana/Loki dan log Nginx; siapkan kanal isolasi. DP-1: periksa apakah lonjakan request dari 203.0.113.50 menyasar endpoint sensitif (sign-in/OTP) dengan pola otomatis/berulang, bukan crawling atau uji internal. | DP-1 | Fase 1, 2 |
| T+10 | Sekitar 40 kegagalan OTP, lalu satu 200, lalu akses `/admin` | DP-2 = true positive dengan indikasi kompromi akun (confirmed account takeover) karena ~40 kegagalan OTP lalu satu 200 lalu akses /admin. DP-3: P-3 (isolasi akun dan blokir jaringan), atau P-4 bila akses admin dibekukan: blokir IP di firewall/Nginx, cabut semua token/sesi admin terkait, paksa rotasi kredensial/MFA. | DP-2, DP-3; P-3 atau P-4 | Fase 2, 3 |
| T+25 | PENGESAHAN tidak sah (rujukan waktu jawaban: T+8) | Pemberantasan: cabut semua sesi aktif, rotasi secret key JWT/aplikasi dan kredensial admin, periksa akun admin baru atau perubahan lain di audit_logs, tambal celah rate limit OTP sebelum dibuka. BCP aktif karena PENGESAHAN tidak sah melanggar integritas data regulasi dan tidak bisa dihapus manual tanpa risiko inkonsistensi status; pulih ke titik bersih sebelum T+8; data setelah cadangan terakhir diterima hilang. | Pemberantasan; BCP aktif; pulihkan | Fase 4, 5; `bcp.md` 4 |
| T+40 | Rencana pemulihan, perkiraan waktu, titik gagal | Cadangan bersih terakhir sebelum T+8, dari penyimpanan cadangan off-site/lokal terisolasi yang dibuat manual. Estimasi: verifikasi cadangan dan hentikan layanan ~15 menit; restore DB dan verifikasi skema ~30; rotasi kunci rahasia dan perketat rate limit ~20; uji fungsional ~15; total ~80 menit < RTO 2 jam. Titik gagal: restore DB korup atau migrasi skema tidak cocok karena cadangan belum teruji lewat timer. Karena timer belum pernah jalan, kehilangan data bisa melampaui RPO 24 jam (temuan kritis). | Rencana pemulihan; temuan RPO | Fase 5; RTO dan RPO |
| Penutup | Evaluasi: perbaikan dan kekurangan dokumen | Perbaikan: (1) aktifkan dan verifikasi systemd timer cadangan harian beserta pemantauan kegagalannya, hari ini; (2) perketat batas percobaan OTP per akun dan per IP di Nginx dan autentikasi, 24 jam; (3) uji restore berkala di staging, bulanan. Kekurangan PB-01/bcp.md: tidak ada prosedur verifikasi kesiapan cadangan sebelum pemulihan, dan tidak ada panduan bila timer belum pernah menghasilkan snapshot dalam jendela RPO. | Pasca-insiden | Fase 6 |

## 3. Evaluasi RTO/RPO

### RPO (target 24 jam, `bcp.md`)

- Bukti tidak memuat cadangan buatan timer. Dua cadangan tercatat dibuat manual lewat unit `kyrion-backup.service` (`backup-restore.md` 3). `kyrion-backup.timer` terpasang dengan jadwal pertama 2026-11-23 02:00 UTC (`bukti/03-backup.txt`).
- Pemeriksaan VM sesudah latihan (`bukti/11-timer-backup-gagal.txt`): servis berjalan lagi pada 2026-11-23T08:22:54Z dan 2026-11-25T06:10:42Z, masing-masing sebagai entri pertama unit ini pada boot baru (tanda `-- Boot`); jarak dari saat boot tidak tercatat. Keduanya gagal (exit 1; baris `status=1/FAILURE`) dengan `pg_dump: ... FATAL:  the database system is starting up`. Pemicu oleh timer ditunjukkan `list-timers` (kolom LAST, terpotong, "2h 43min ago") dan `TriggeredBy` untuk run 25 Nov; untuk run 23 Nov, pemicunya tidak tertulis di log dan disimpulkan dari konfigurasi timer. Tidak ada berkas cadangan baru.
- **Koreksi atas T+40:** "timer belum pernah jalan" keliru. Timer memicu tetapi servis gagal dan belum pernah menghasilkan cadangan.
- Cadangan terbaru tercatat: `kyrion-backup-20261122T100758Z.tar.age`, 2026-11-22T10:07:58Z (`bukti/03-backup.txt`). `bukti/offsite-checksum.txt` (2026-11-23T08:20:18Z) memuat checksum yang sama dengan salinan offsite berkas itu; itu bukan cadangan baru.
- Umur cadangan terbaru saat pengecekan (`date -u -d`, selisih detik epoch): 2026-11-25T08:54:11Z (1795596851) - 2026-11-22T10:07:58Z (1795342078) = 254773 detik = **70 jam 46 menit 13 detik**.
- Rumus: selisih = waktu perubahan tidak sah - 2026-11-22T10:07:58Z. Jam perubahan pada hari latihan tidak ditetapkan (skenario memakai menit relatif), jadi dihitung batasnya untuk 2026-11-25 UTC:
  - paling awal: 2026-11-25T00:00:00Z - 2026-11-22T10:07:58Z = **61 jam 52 menit 2 detik**;
  - paling lambat: kurang dari 85 jam 52 menit 2 detik.
- Selisih minimum melewati target sebesar 37 jam 52 menit 2 detik. **RPO 24 jam tidak terpenuhi secara operasional karena servis cadangan yang dipicu timer gagal.** Daftar folder cadangan di VM pada 2026-11-25T08:54:11Z hanya memuat dua cadangan 22 Nov (`bukti/11-timer-backup-gagal.txt`).

### Penyebab kegagalan cadangan

- **Fakta:** pada kedua run yang gagal, database masih dalam proses start saat `pg_dump` dijalankan.
- **Berkas:** timer memakai `OnCalendar=*-*-* 02:00:00 UTC` dan `Persistent=true`. Servis memakai `After=docker.service` dan `Requires=docker.service`, tanpa `Restart=`. Urutan itu hanya menunggu Docker; di unit dan `deploy/backup/backup.sh` tidak ada langkah menunggu database siap (skrip hanya memeriksa container ada, lewat `docker inspect`).
- **Inferensi:** `Persistent=true` menyusulkan jadwal 02:00 yang terlewat sesudah VM menyala, sehingga cadangan berlomba dengan start database. Waktu run (bukan 02:00) dan tanda boot cocok dengan ini; waktu VM dimatikan dan dinyalakan tidak ada di bukti, dan inferensi ini belum diuji.
- Salinan "offsite" berada di laptop yang sama dengan host VM; RPO bila VM atau laptop hilang tidak dapat diturunkan.

### RTO (target 2 jam, usulan Arif, asumsi awal)

- Estimasi operator: 15 + 30 + 20 + 15 = 80 menit. Ini **tebakan tanpa pengukuran**.
- Langkah yang tidak terhitung dalam rincian estimasi: pemulihan storage PDF; kunci Ed25519, keyring, dan kunci induk HMAC; `roles.sql`; rebuild image atau VM bila perlu.
- Satu-satunya hasil terukur: pemulihan cadangan 61 KB ke container sementara, sekitar 2 detik. Itu **bukan RTO**. Pulih produksi (`backup-restore.md` 5 langkah 6-9) belum diuji.
- **RTO 2 jam belum terbukti.**

## 4. Temuan evaluasi

| | Deviasi atau celah | Mengapa penting | Rujukan |
|---|---|---|---|
| a | P-2 dan P-3 tertukar: blokir IP adalah P-2; P-3 adalah rotasi secret Better Auth. Jawaban juga menyebut "isolasi akun", yang bukan isi P-3 | Salah pilih dapat mematikan semua sesi, atau membiarkan sesi yang diambil alih tetap berlaku bila hanya IP diblokir | PB-01 fase 3, DP-3 |
| b | Istilah tidak sesuai dokumen: "JWT" dan peran "Lead Responder". "MFA", rotasi "kredensial admin", dan blokir IP di Nginx juga tidak punya prosedur di PB-01 atau `secrets.md` | Eksekutor dapat mencari rahasia, peran, atau kontrol yang tidak ada saat insiden | PB-01 Peran dan fase 3; `secrets.md` 3 |
| c | "Confirmed takeover" ditetapkan terlalu cepat; 2xx saja belum membuktikan pengambilalihan. Menurut DP-2, tanda itu cukup untuk eskalasi, bukan untuk kepastian | Cakupan dampak dapat salah dinilai; sesi dan `audit_logs` perlu diperiksa dulu | PB-01 DP-1, DP-2 |
| d | Pembatalan lewat aplikasi tidak dipertimbangkan sebelum memutuskan pemulihan. Alasan operator hanya menolak penghapusan manual | Pemulihan membuang perubahan sah sesudah cadangan. Syaratnya data tidak dapat dibetulkan lewat aplikasi, dan itu belum dinilai | PB-01 fase 4 langkah 2, fase 5; `bcp.md` 4 |
| e | Tidak ada prosedur cabut sesi per pengguna, nonaktifkan akun, dan perintah stop/start `kyrion-vm`; jawaban mengandaikan pencabutan sesi tersedia | Penahanan terarah dan P-4 belum dapat dijalankan menurut dokumen (sudah tercatat) | PB-01 fase 3; `bcp.md` 3 |
| f | Cadangan "offsite" ada di laptop yang sama dengan host VM; jawaban menyebutnya terisolasi, dan isolasi itu tidak ada di bukti | Satu kejadian pada laptop dapat menghilangkan data, cadangan, dan kunci age (R-12) | `backup-restore.md` 1, 8; `bcp.md` 3 |
| g | Tidak ada pemeriksaan kesehatan cadangan sebelum pemulihan (temuan Arif sendiri), termasuk panduan bila tidak ada cadangan dalam jendela RPO | Cadangan rusak atau terlalu tua baru ketahuan saat dibutuhkan | PB-01 fase 5; `backup-restore.md` 7 |
| h | Timer cadangan memicu, tetapi servis gagal pada dua boot berturut-turut (23 dan 25 Nov). Tidak ada pemantauan kegagalan unit di dokumen atau aturan deteksi; kegagalan tidak terdeteksi sampai diperiksa manual sesudah latihan | Cadangan harian dianggap ada padahal tidak, sehingga RPO terlampaui tanpa diketahui (R-12) | `bukti/11-timer-backup-gagal.txt`; `deploy/backup/kyrion-backup.service` |

## 5. Perbaikan

Status di bawah adalah status pelaksanaan. Pemilik semua butir: Arif.

| No | Apa | Berkas atau konfigurasi | Risiko | Pemilik | Target | Status |
|---|---|---|---|---|---|---|
| 1 | Perbaiki kegagalan timer: skrip atau unit harus menunggu database siap (retry atau pemeriksaan kesiapan) dan kegagalan unit harus terlihat (mis. cek status di Grafana atau log); lalu jalankan sekali dan catat bukti | `deploy/backup/kyrion-backup.service`, `deploy/backup/backup.sh` | R-12 | Arif | 2026-11-26 | sebagian, 2026-11-25: skrip menunggu database siap (`pg_isready`, maksimal 120 detik, gagal tertutup) dan teruji lewat boot dengan jadwal terlewat dan lewat database ditahan 6 detik (`bukti/13-timer-backup-diperbaiki.txt`). Kegagalan unit cadangan belum terlihat di Grafana atau aturan deteksi; belum dikerjakan |
| 2 | Evaluasi pembatas OTP per akun selain per IP. Saat ini di Nginx: `$binary_remote_addr`, zona `kyrion_otp` `rate=10r/m`, `burst=5 nodelay`, untuk endpoint kirim dan sign-in OTP. Di aplikasi: 3 per 60 detik untuk kedua endpoint, `allowedAttempts: 3` per OTP, jeda kirim 60 detik per alamat | `deploy/nginx/kyrion.conf`, `apps/web/lib/auth/index.ts`, `apps/web/lib/auth/jeda.ts` | R-14 | Arif | 2026-11-27 | belum dikerjakan |
| 3 | Periksa umur cadangan sebelum pemulihan (PB-01 fase 5 langkah 0) dan jadwalkan uji pulih bulanan di staging | PB-01, `deploy/backup/restore-test.sh` | R-12 | Arif | Bulanan; tanggal mulai belum ditetapkan | uji berkala belum dikerjakan; teks langkah 0 ditambahkan ke PB-01 sesudah latihan, belum diuji |
| 4 | Ukur RTO nyata lewat latihan pulih produksi bertahap di staging | `backup-restore.md` 5 langkah 6-9 | R-12 | Arif | Sebelum v1.0 | belum dikerjakan |

## 6. Kesimpulan

Yang berjalan: alur triase dimulai dari waktu deteksi dan log, dan operator sendiri menemukan celah RPO serta kesiapan cadangan; deteksi D-1 menjadi titik awal skenario, dengan bukti Firing yang berasal dari simulasi terpisah (`alerts-analysis.md`), bukan dari latihan ini. Yang gagal: pilihan penahanan tertukar dan memakai istilah di luar dokumen, pengambilalihan dinyatakan pasti terlalu cepat, dan pembatalan lewat aplikasi tidak dinilai sebelum memilih pemulihan. RPO 24 jam tidak terpenuhi karena timer memicu tetapi servis cadangan gagal, dan RTO 2 jam belum terbukti.
