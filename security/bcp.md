# Rencana kelangsungan layanan (BCP) Kyrion staging

Versi 1, 2026-11-25 (sec-0.3). Sumber: `backup-restore.md`, `risk-register.md`, `monitoring/README.md`, `playbooks/PB-01-tebakan-otp-dan-rute-sensitif.md`, `../compose.vm.yaml`. Rencana ini dilatih sekali sebagai tabletop diskusi 2026-11-25 (tanpa pengukuran waktu).

## 1. Layanan kritis dan urutan pemulihan

Layanan: `db`, `app`, `nginx` (project `kyrion-vm`); Alloy, Loki, Grafana (project `kyrion-mon`).

| Urutan | Langkah | Dasar dan alasan | Risiko |
|---|---|---|---|
| 1 | Periksa, dekripsi, dan uji cadangan | `backup-restore.md` 5 langkah 1-5: cadangan diperiksa sebelum dipakai | R-12 |
| 2 | `db`: hentikan app dan nginx, pulihkan ke database baru, jalankan `roles.sql` | langkah 6 (butuh `db` berjalan; memulihkan peran) | R-12 |
| 3 | Isi storage (PDF), lalu kunci Ed25519, keyring, dan kunci induk HMAC | langkah 7-8: dipulihkan sebelum aplikasi dijalankan | R-12 |
| 4 | Jalankan `app` dan `nginx`, lalu verifikasi | langkah 9. Urutan `app` sebelum `nginx` tidak ada di `backup-restore.md`; dasarnya `compose.vm.yaml`: `app` menunggu `db` sehat, `nginx` menunggu `app` sehat | R-12 |
| - | Monitoring (Alloy, Loki, Grafana) | Urutan pemulihan: tidak ada di dokumen. Usulan: pastikan berjalan sebelum akses dibuka lagi agar verifikasi log dapat dilakukan | R-15 |

## 2. Target RPO dan RTO

| Layanan | RPO | RTO | Dasar | Status bukti |
|---|---|---|---|---|
| Data (db, PDF, kunci Ed25519 dan keyring, kunci induk HMAC) | Target 24 jam, **hanya bila VM selamat** | Target 2 jam (**usulan Arif, asumsi awal**) | RPO: timer harian 02:00 UTC, turunan ≤ 24 jam + sekitar 1 detik (`backup-restore.md` 7) | **Timer memicu pada 2026-11-23 dan 2026-11-25 tetapi gagal (`bukti/11-timer-backup-gagal.txt`); cadangan terbaru 2026-11-22T10:07:58Z.** RTO belum terukur; tabletop tidak mengukur waktu; pengukuran adalah perbaikan no. 4 di `tabletop-report.md` |
| `app`, `nginx` | Tidak ada RPO tersendiri di dokumen | Masuk target 2 jam di atas (usulan Arif, asumsi awal) | Data yang dipakai `app` ada di baris data | Belum terukur |
| Bila VM atau laptop hilang | **Tidak dapat diturunkan** | Target 2 jam tidak didukung bukti untuk kejadian ini | Salinan ke laptop manual, tanpa jadwal | Tidak terukur |
| Monitoring dan log (Loki, Grafana) | Tidak ada di dokumen. **Usulan:** tanpa jaminan; log boleh hilang seluruhnya | Tidak ada di dokumen. **Usulan:** 4 jam | Log tidak masuk cadangan (`backup-restore.md` 2); retensi 30 hari bukan RPO (`monitoring/README.md`) | Belum terukur; retensi juga belum diukur |

- Uji pulih yang ada (61 KB, 2 detik, container sementara) **bukan RTO**. Waktu deteksi dan keputusan, pengambilan cadangan, pulih produksi, rebuild image atau VM, dan verifikasi tidak terukur.
- `backup-restore.md` 7 menyebut target ditetapkan di Tugas 10 dari ukuran terukur. Angka RTO di sini hanya asumsi awal sebelum pengukuran itu.

## 3. Ketergantungan dan batas

- **R-12:** salinan "offsite" dan kunci privat age ada di laptop yang sama dengan host VM. Kehilangan laptop dapat menghilangkan data, cadangan, dan kunci sekaligus. Tidak ada salinan kunci.
- **R-12:** pulih produksi (`backup-restore.md` 5 langkah 6-9) **belum teruji**; uji pulih memakai `--no-owner --no-privileges`, sehingga pemulihan peran juga belum terbukti.
- **R-12:** tidak dicadangkan: `/srv/kyrion/env`, rahasia selain kunci induk HMAC, TLS, konfigurasi compose di VM, image Docker, log, kunci age.
- **R-12:** pemicu timer dan rotasi 14 hari belum teruji. Perintah stop dan start `kyrion-vm` untuk pemulihan tidak ada di dokumen.
- **R-15:** deteksi bergantung pada Alloy, Loki, dan Grafana; tidak ada notifikasi eksternal.

## 4. Aktivasi

Pemutus: **Incident Commander (Arif)**.

| Kondisi di PB-01 | Keputusan | Risiko |
|---|---|---|
| DP-2 positif (akses berhasil atau data berubah) | Eskalasi: tahan, pemberantasan, lalu nilai pemulihan. DP-2 positif saja belum berarti memulihkan dari cadangan | R-14, R-12 |
| DP-2 positif, dan data rusak atau berubah serta tidak dapat dibetulkan lewat aplikasi (PB-01 fase 5) | **Aktifkan BCP:** pindah dari penahanan ke pemulihan menurut bagian 1 | R-12 |
| DP-3 memilih penghentian stack (P-4) | **Aktifkan BCP.** Layanan dihidupkan lagi sesudah penyebab ditahan; pulihkan data hanya bila syarat baris di atas terpenuhi | R-14, R-12 |
| DP-2 negatif dan penahanan P-1 atau P-2 cukup | BCP tidak diaktifkan | R-14 |

Sebelum memulihkan: pilih cadangan sebelum awal insiden, terima kehilangan data sesudahnya, dan jangan menimpa database lama (PB-01 fase 5). Catat keputusan dan waktu UTC.
