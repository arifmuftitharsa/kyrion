# PB-01: Tebakan OTP dan penolakan berulang pada rute sensitif

| | |
|---|---|
| Versi, tanggal | 1, 2026-11-25 (sec-0.3) |
| Pemicu | Alert D-1 dan/atau D-2 berstatus Firing di Grafana, folder "Kyrion Deteksi" |
| Risiko | R-14, R-03, R-15 |
| Technique ATT&CK | D-1: T1110 Brute Force. D-2: T1190 Exploit Public-Facing Application (usulan di rule D-1 dan D-2, belum diverifikasi Arif di attack.mitre.org) |
| Rencana induk | Peran, kontak, severity, dan komunikasi ada di `../ir-plan.md` |
| Status | Dilatih sekali sebagai tabletop diskusi pada 2026-11-25 (`../tabletop-report.md`); perintah penahanan dan pemulihan tidak dijalankan |

D-1: > 10 respons non-2xx pada `/api/auth/sign-in/email-otp` per `ip` dalam 5 menit. D-2: > 10 respons 401/403/404 pada `/admin` atau `/api/v1/` per `ip` dalam 5 menit (307 tidak dihitung). Query: `../detection/D-1-tebak-otp.yml`, `D-2-rute-sensitif.yml`.

Tidak ada notifikasi eksternal: alert hanya terlihat bila operator membuka Grafana. Akses: `ssh -L 3001:127.0.0.1:3001 kyrion-staging`, lalu http://127.0.0.1:3001 (`../monitoring/README.md`).

## Peran

Pada proyek ini semua peran dipegang Arif. Saat mengambil keputusan, catat peran yang sedang dipegang.

| Peran | Tanggung jawab |
|---|---|
| Incident Commander (Pemilik Sistem di tabletop) | Memutuskan di tiap decision point, termasuk penghentian layanan, pemulihan, dan penutupan insiden |
| Analis (Penanggap Insiden) | Triase log, menentukan cakupan dan dampak |
| Eksekutor penahanan/pemulihan (Penanggap Insiden) | Menjalankan perintah di VM dan memverifikasi hasilnya |
| Pencatat/komunikasi (Pencatat waktu dan keputusan) | Linimasa UTC, bukti, laporan |

Eskalasi pihak luar dan kontak: lihat ../ir-plan.md bagian 2 dan 4.

## 1. Deteksi

1. Catat waktu UTC, rule, label `ip`, dan waktu evaluasi alert.
2. Pada simulasi, Firing teramati 07:43:43 (lalu lintas D-1 mulai 07:41:55) dan 07:55:38 (D-2 mulai 07:53:57) (`../alerts-analysis.md`). Ini bukan jaminan waktu deteksi.

## 2. Triase

1. Di Grafana, buka log `{container="kyrion-vm-nginx-1"}` pada rentang alert, saring menurut `ip`. Catat path, status, jumlah, dan urutan waktu. Simpan salinan sebelum bertindak.
2. Periksa apakah ada 2xx dari `ip` yang sama sesudah rentetan non-2xx.
3. Periksa `audit_logs` dan `sessions` untuk rentang yang sama. Login gagal tidak tercatat di `audit_logs` (T-21); tabel itu tidak dikirim ke Loki. Perintah kueri tidak ada di dokumen sumber.

**Severity** (definisi lengkap di `../ir-plan.md` bagian 3): S3 bila semua percobaan gagal dan tidak ada akses berhasil; S2 bila ada 2xx pada sign-in OTP dari sumber tak dikenal, sesi baru yang tidak dikenal, atau baris `audit_logs` yang tidak dikenal; S1 bila aset berkelas Rahasia terbaca atau berubah, atau rahasia dan kunci diduga dikuasai pihak lain (lanjutkan dengan PB-03). Severity ditentukan oleh fakta yang ditemukan, bukan oleh nama rule, dan boleh direvisi saat analisis.

**DP-1, true atau false positive.**

- JIKA `ip` dan waktunya cocok dengan uji yang dijalankan operator sendiri, MAKA catat sebagai uji yang disengaja (rule bekerja), tanpa penahanan.
- JIKA hanya 404 tersebar pada data yang tidak ada (D-2), atau beberapa kegagalan OTP lalu 2xx milik pengguna yang mengonfirmasi percobaannya, MAKA kandidat false positive: catat bukti dan terus amati.
- JIKA sumber tidak dikenal, atau ada 2xx sesudah rentetan non-2xx tanpa konfirmasi, MAKA perlakukan sebagai true positive. 2xx saja belum membuktikan pengambilalihan.
- Alert tidak lagi Firing bukan bukti aman: hitungan memakai jendela 5 menit, dan `noDataState: OK` membuat log yang hilang tampak aman.

**DP-2, akses berhasil atau data berubah.**

- JIKA ada 2xx pada sign-in OTP dari `ip` tersebut, 2xx pada rute sensitif, sesi baru yang tidak dikenal, atau baris `audit_logs` (mis. PENGESAHAN) yang tidak dikenal, MAKA eskalasi: tahan (fase 3), lanjut fase 4 dan 5, dan beri tahu jalur eskalasi.
- JIKA semuanya tidak ditemukan, MAKA tahan bila lalu lintas masih berlanjut, lalu ke fase 6. Tulis "tidak ditemukan pada sumber yang diperiksa", bukan "tidak terjadi". 2xx pada rute publik bukan tanda akses tidak sah.

**DP-3, tingkat penahanan.**

- JIKA satu atau sedikit IP, lalu lintas berlanjut, dan DP-2 negatif, MAKA tahan di firewall (P-2).
- JIKA ada sesi atau akun yang diduga diambil alih, MAKA tahan di tingkat aplikasi (P-3); memblokir IP tidak mencabut sesi.
- JIKA data terus berubah, rahasia atau host diduga dikuasai, atau banyak IP melewati pembatas dan langkah di atas tidak menghentikannya, MAKA hentikan stack (P-4).

## 3. Penahanan

`ufw deny` biasa tidak membatasi 80 dan 443 karena port Docker melewati chain INPUT (`../firewall-rules.md` 2.2). Pemblokiran web dilakukan di DOCKER-USER.

| No | Tindakan | Status uji |
|---|---|---|
| P-1 | Pembatas otomatis yang sudah aktif: Nginx `limit_req` OTP (10r/m, burst 5) dan pembatas aplikasi, jawaban 429. Pastikan 429 muncul. Ini tidak memblokir IP. | diuji (`../bukti/uji-rate-limit.txt`; D-1 serangan 400=3, 429=27) |
| P-2 | Blok sementara satu IP di port 443 (perintah di bawah). | diuji hanya untuk 192.168.56.1: blokir dan pulih (`../bukti/uji-docker-user-negatif.txt`); saat persis penghapusan oleh timer tidak teramati. IP lain dan IPv6: belum diuji |
| P-3 | Rotasi `kyrion_better_auth_secret`: nilai baru ke berkas rahasia (0400, UID 10001), lalu ganti-pasang container app. Semua sesi menjadi tidak valid (`../secrets.md` 3). | belum diuji (dibahas di tabletop 2026-11-25, tidak dijalankan); perintah rinci tidak ada di dokumen |
| P-4 | Hentikan app dan nginx (`../backup-restore.md` 5 langkah 6). | belum diuji (dibahas di tabletop 2026-11-25, tidak dijalankan); perintah stop tidak ada di dokumen |

**Pengingat:** P-2 = blokir IP (hanya 443, sementara); P-3 = rotasi secret better-auth (mematikan SEMUA sesi). Jangan tertukar.

P-2, dijalankan di VM. Ganti `<IP>` di kedua tempat:

```bash
sudo iptables -I DOCKER-USER 1 -i enp0s8 -s <IP> -p tcp -m conntrack --ctorigdstport 443 -j DROP && sudo systemd-run --on-active=90s /usr/sbin/iptables -D DOCKER-USER -i enp0s8 -s <IP> -p tcp -m conntrack --ctorigdstport 443 -j DROP
```

- Aturan dihapus otomatis sesudah sekitar 90 detik (pada uji, penghapusan bisa terlambat; `--timer-property=AccuracySec=1s` disarankan di bukti). Ini penahanan sementara, tidak ditulis ke `after.rules`. Perintah blok permanen tidak ada di dokumen.
- Di lab, 192.168.56.1 adalah laptop admin: memblokirnya memutus akses web admin. Aturan ini hanya port 443, bukan SSH.
- Pencabutan sesi pengguna lain dan penonaktifan akun: prosedur tidak ada di dokumen sumber. Endpoint DELETE sesi menolak sesi milik orang lain (404, `../access-tests-v0.3.md`).

## 4. Pemberantasan

1. Daftar akun, sesi, dan versi regulasi yang terdampak dari `audit_logs` dan `sessions`.
2. Untuk pengesahan tidak sah, Incident Commander memutuskan pembatalan lewat aplikasi (PEMBATALAN, `../tabletop-report.md` bagian 4 butir d). Belum diuji dalam skenario insiden.
3. JIKA rahasia diduga bocor, rotasi menurut `../secrets.md` 3 (belum diuji). Kunci induk HMAC dan Ed25519 mengikuti prosedur khusus di bagian itu.
4. JIKA akun email korban atau inbox Mailtrap diduga bocor, rotasi token Mailtrap dan amankan akses inbox (T-14).
5. Catat akar masalah. Bila belum diketahui, tulis "belum diketahui".

## 5. Pemulihan

Pulihkan dari cadangan hanya bila data rusak atau berubah dan tidak dapat dibetulkan lewat aplikasi. Pemulihan membuang perubahan sesudah waktu cadangan.

0. Periksa umur cadangan terbaru (tanggal-waktu berkas); bila lebih dari 24 jam, catat selisih RPO aktual dan lanjutkan hanya atas keputusan Incident Commander.
1. Pilih cadangan **sebelum** awal insiden. Ikuti `../backup-restore.md` 5 langkah 1-4 (checksum, dekripsi, periksa komponen): teruji.
2. Langkah 5, uji ke container sementara dengan `sudo bash restore-test.sh <kunci> [berkas]`: teruji pada data 61 KB.
3. Langkah 6-9 (produksi: database baru, `roles.sql`, storage, kunci, jalankan app dan nginx): **teruji satu kali** (`../bukti/15-rto-latihan-pulih.txt`). Jangan menimpa database lama; simpan sebagai bukti.
4. Sesudah pulih, periksa kembali sesi dan akun terdampak, karena cadangan dapat memuat sesi yang masih berlaku. Pertimbangkan P-3. Pada latihan `../bukti/15-rto-latihan-pulih.txt`, tabel `sessions` ikut terpulihkan dan halaman terproteksi terbuka tanpa login OTP baru sebelum keluar (disimpulkan dari log nginx dan pengamatan di browser, tidak diuji langsung); untuk menguji OTP, keluar terlebih dahulu.
5. Verifikasi:
   - Data: hitungan baris dibandingkan dengan cadangan, checksum PDF, verifikasi HMAC dan tanda tangan versi terdampak.
   - Layanan: `https://kyrion.test/masuk` 200 dan port 80 menjawab 301 (`../firewall-rules.md` 5), login OTP, unduh dan verifikasi satu PDF (harus akun ADMIN: unduh di `/admin/regulasi/<slug>/versi`, periksa berkas di `/admin/verifikasi`; akun Sivitas dijawab 404 menurut desain).
   - Log: log Nginx masuk ke Loki, tiga rule tampil dan tidak Error. Bila app atau nginx dibuat ulang, sertakan overlay journald (`../monitoring/README.md`).
6. Selesai JIKA semua verifikasi lulus, blok sementara sudah hilang, tidak ada 2xx atau perubahan tidak dikenal baru, dan D-1 serta D-2 tidak Firing selama minimal satu jendela 5 menit dengan log terbukti masuk.

## RTO dan RPO

Lihat `../bcp.md`. RTO belum terukur (`../backup-restore.md` 7).

## 6. Pasca-insiden

1. Susun linimasa UTC: deteksi, tiap keputusan (DP-1 sampai DP-3) dan pembuatnya, tindakan, pemulihan, penutupan.
2. Simpan bukti tanpa nilai rahasia atau email asli.
3. Tulis pelajaran: yang berjalan, yang gagal, celah playbook, tindakan perbaikan beserta pemilik dan target.
4. Usulkan perubahan rule, playbook, atau skor risiko; `../risk-register.md` diubah hanya atas keputusan Arif.
5. Komunikasi menurut `../ir-plan.md` bagian 4. Jadwalkan review dalam 7 hari (usulan, mengikuti contoh di slide pekan 13).
