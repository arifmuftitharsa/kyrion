# PB-02: Pemindaian port terhadap VM

| | |
|---|---|
| Versi, tanggal | 1, 2026-11-26 (sec-0.3) |
| Pemicu | Alert D-3 berstatus Firing di Grafana, folder "Kyrion Deteksi" (`../detection/D-3-pemindaian-port.yml`) |
| Technique ATT&CK | T1046 Network Service Discovery (usulan di rule D-3, belum diverifikasi Arif di attack.mitre.org) |
| Risiko | R-09, R-15 |
| Rencana induk | Peran, kontak, severity, dan komunikasi ada di `../ir-plan.md` |
| Status | Belum dilatih. Tindakan yang dirujuk ke PB-01 membawa status ujinya sendiri; pemeriksaan di bagian 5 belum dijalankan dalam konteks playbook ini |

D-3: satu `src` tercatat diblokir UFW pada lebih dari 3 port tujuan (DPT) berbeda dalam 5 menit (ambang dari satu pengukuran, belum divalidasi). Tidak ada notifikasi eksternal: alert hanya terlihat bila operator membuka Grafana (`../monitoring/README.md`).

**Batas deteksi, dibaca sebelum menyimpulkan "aman":** D-3 tidak melihat pemindaian lambat (3 DPT atau kurang per 5 menit), pemindaian dari banyak alamat, percobaan SSH, dan pemindaian port 80 dan 443 (DROP di DOCKER-USER tidak punya target LOG). Tidak ada alert bukan bukti tidak ada pemindaian.

## Peran

Sama dengan `../ir-plan.md` bagian 1 (semua dipegang Arif; catat peran yang sedang dipegang saat memutuskan).

## 1. Deteksi

1. Catat waktu UTC, rule, label `src`, dan waktu evaluasi alert.
2. Pada simulasi, D-3 Firing untuk `src=192.168.56.1` (`../alerts-analysis.md`). Itu bukan jaminan waktu deteksi.

## 2. Triase dan analisis

1. Di Grafana (Explore, Loki), buka `{job="loki.source.journal.kernel"} |= "[UFW BLOCK]"` pada rentang alert dan saring menurut `SRC=<src>`. Catat jumlah baris, daftar `DPT`, protokol, dan urutan waktu. Simpan salinan sebelum bertindak.
2. Periksa apakah `src` pernah masuk ke layanan setelah pemindaian:
   - Nginx: `{container="kyrion-vm-nginx-1"}` disaring menurut IP itu. Cari 2xx, terutama pada `/admin` dan `/api/v1/`.
   - sshd: `{unit="ssh.service"}` pada rentang yang sama. Cari baris `Accepted` dan `Failed`. Aturan UFW hanya mengizinkan 22/tcp dari 192.168.56.1 (`../firewall-rules.md` 2.1), sehingga `Accepted` dari alamat lain tidak diharapkan.
3. Periksa apakah `src` adalah alamat yang dikenal: 192.168.56.1 adalah laptop admin; subnet 192.168.56.0/24 boleh mengakses 80 dan 443.

**Severity** (definisi lengkap di `../ir-plan.md` bagian 3):

- S3 bila semua paket diblokir dan tidak ada akses berhasil.
- S2 bila `src` mengakses layanan (mis. 2xx pada rute sensitif, atau sesi baru yang tidak dikenal) sesudah pemindaian; lanjutkan juga dengan PB-01.
- S1 bila ada `Accepted` pada sshd dari alamat tidak dikenal, atau tanda rahasia atau kunci dikuasai pihak lain; lanjutkan juga dengan PB-03.

**DP-1, true atau false positive.**

- JIKA `src` dan waktunya cocok dengan uji atau pemindaian yang dijalankan operator sendiri (mis. nmap dari laptop admin), MAKA catat sebagai uji yang disengaja (rule bekerja), tanpa penahanan.
- JIKA perangkat atau layanan sah di jaringan yang sama menyentuh beberapa port tertutup (termasuk paket UDP siaran), MAKA kandidat false positive: catat bukti dan amati (false positive ini belum terbukti, `../detection/D-3-pemindaian-port.yml`).
- JIKA `src` tidak dikenal, MAKA true positive.

**DP-2, akses berhasil atau data berubah.**

- JIKA ada `Accepted` pada sshd dari `src` itu, 2xx pada rute sensitif dari `src` itu, atau sesi atau baris `audit_logs` yang tidak dikenal, MAKA eskalasi ke S2 atau S1 menurut `../ir-plan.md`, tahan (bagian 3), dan lanjutkan ke PB-01 atau PB-03.
- JIKA semuanya tidak ditemukan, MAKA S3. Tulis "tidak ditemukan pada sumber yang diperiksa", bukan "tidak terjadi".

**DP-3, tingkat penahanan.**

- JIKA `src` di luar subnet admin: UFW sudah menjatuhkan paketnya (default deny). MAKA pantau; tidak perlu aturan tambahan.
- JIKA `src` berada di 192.168.56.0/24 (mampu menjangkau 80 dan 443) dan terus mencoba, MAKA blok sementara di port 443 (P-2, PB-01 bagian 3).
- JIKA ada `Accepted` pada sshd dari alamat tak dikenal, MAKA anggap host terancam dan lanjutkan PB-03.

## 3. Penahanan

| No | Tindakan | Status uji |
|---|---|---|
| P-1 | Tidak ada tindakan: UFW default deny sudah menjatuhkan paket ke port yang tidak diizinkan | konfigurasi efektif (`../bukti/firewall-konfigurasi.txt`) |
| P-2 | Blok sementara satu IP di port 443, perintah di PB-01 bagian 3 | diuji hanya untuk 192.168.56.1 (`../bukti/uji-docker-user-negatif.txt`); IP lain dan IPv6 belum diuji |
| P-3 | Penghentian layanan (PB-01 P-4) bila host diduga dikuasai | belum diuji |

Prosedur menutup akses SSH, mencabut atau mengganti kunci SSH admin, dan memutus jaringan VM **tidak ada di dokumen sumber**.

## 4. Pemberantasan

1. Catat akar masalah: pemindai dikenal, perangkat sah, atau pihak tidak dikenal. Bila belum diketahui, tulis "belum diketahui".
2. Bila ada akses berhasil, ikuti PB-01 bagian 4 atau PB-03.

## 5. Pemulihan dan penutupan

Pemindaian yang seluruhnya diblokir tidak mengubah data, sehingga tidak ada pemulihan data. Yang dipastikan adalah konfigurasi jaringan tidak berubah.

1. Pemeriksaan konfigurasi (baca saja): `sudo ufw status verbose` dan `sudo iptables -S DOCKER-USER`; bandingkan dengan `../bukti/firewall-konfigurasi.txt`.
2. Dari laptop admin, ulangi pemindaian sesuai `../firewall-rules.md` bagian 5 dan bandingkan dengan `../scan-after.txt` (harapan: hanya 22, 80, 443 terbuka).
3. Pastikan blok sementara (bila dipakai) sudah hilang.
4. Bila ada akses berhasil, pemulihan mengikuti PB-01 bagian 5.
5. Selesai JIKA konfigurasi sama dengan baseline, tidak ada `Accepted` atau 2xx yang tidak dikenal, dan D-3 tidak Firing minimal satu jendela 5 menit.

## RTO dan RPO

Tidak ada dampak data pada S3, jadi tidak ada RTO atau RPO tersendiri. Bila berlanjut ke S2 atau S1, targetnya mengikuti `../bcp.md` dan PB-01 bagian 5 (RTO belum terukur).

## 6. Komunikasi

S3: tidak ada pemberitahuan, dicatat. S2 dan S1: sesuai `../ir-plan.md` bagian 4.

## 7. Pasca-insiden dan review

1. Susun linimasa UTC: deteksi, keputusan DP-1 sampai DP-3 dan pembuatnya, tindakan, penutupan.
2. Simpan bukti tanpa nilai rahasia atau email asli.
3. Tulis pelajaran, termasuk apakah ambang D-3 perlu disesuaikan dengan lalu lintas nyata dan apakah celah deteksi di atas masih diterima. Teks R-09 di `../risk-register.md` yang menyebut D-3 sebagai deteksi SSH perlu diselaraskan (atas keputusan Arif).
4. Jadwalkan review dalam 7 hari (usulan, mengikuti contoh di slide pekan 13).

## Kategori CSF 2.0

Triase DE.AE dan RS.MA; analisis RS.AN; respons RS.MI; komunikasi RS.CO dan RC.CO; pemulihan RC.RP; review ID.IM.
