# Rencana respons insiden Kyrion (ir-plan, sec-0.3)

Versi 1, 2026-11-26 (sec-0.3). Satu halaman: peran, kontak, severity, komunikasi. Langkah per jenis insiden ada di playbook (`playbooks/`). Langkah teknis ada di runbook: `backup-restore.md`, `hardening-notes.md`, `secrets.md`. Rencana ini dirujuk oleh semua playbook agar severity dan komunikasi tidak ditulis ulang.

## 1. Peran

Pada proyek ini semua peran dipegang Arif. Saat mengambil keputusan, catat peran yang sedang dipegang (sama dengan tabel di PB-01).

| Peran | Tanggung jawab |
|---|---|
| Incident Commander | Menetapkan dan merevisi severity; memutuskan penahanan besar (hentikan layanan, rotasi rahasia, pulih dari cadangan) dan penutupan insiden |
| Analis | Triase log, menentukan cakupan dan dampak |
| Eksekutor | Menjalankan perintah penahanan dan pemulihan di VM, memverifikasi hasilnya |
| Pencatat | Linimasa UTC, bukti, laporan |

## 2. Kontak dan eskalasi

| Siapa | Kapan dihubungi | Kanal |
|---|---|---|
| Dosen pengampu KKS (pengelola eksternal) | S1 dan S2 | Email kampus; pesan langsung bila mendesak |
| Dosen pengampu PAW dan Kriptografi | S1 bila kunci atau rahasia terlibat (kunci dipakai bersama tiga mata kuliah) | Email kampus; pesan langsung bila mendesak |

Nama dan alamat kontak tidak ditulis di repo publik; yang dicatat hanya jenis kanal. Pada insiden, kontak diambil dari data resmi mata kuliah (e-learning).

## 3. Severity

Severity ditentukan oleh fakta yang ditemukan, bukan oleh nama rule. Rule yang sama dapat berujung S3 atau S1. Severity boleh direvisi saat analisis, dan revisinya dicatat.

| Severity | Kriteria (fakta di log atau sistem) | Contoh di Kyrion |
|---|---|---|
| **S3** | Percobaan terdeteksi, tidak ada akses berhasil dan tidak ada perubahan data | Rentetan non-2xx pada OTP (D-1); pemindaian port yang diblokir UFW (D-3) |
| **S2** | Akses berhasil atau perubahan tidak sah terhadap aset berkelas Internal, atau layanan tidak tersedia | 2xx pada sign-in OTP dari sumber tidak dikenal; sesi tidak dikenal; baris `audit_logs` tidak dikenal; cadangan tidak ada saat dibutuhkan |
| **S1** | Aset berkelas **Rahasia** terbaca, berubah, atau bocor, atau rahasia dan kunci diduga dikuasai pihak lain | A-05, A-08, A-09 (data pribadi umum, token sesi); kunci age, kunci induk HMAC, kunci tanda tangan, rahasia Better Auth (`data-classification.md`, `secrets.md`) |

## 4. Komunikasi

| Severity | Siapa diberi tahu | Kapan | Catatan |
|---|---|---|---|
| S3 | Tidak ada pemberitahuan; dicatat | Saat triase | Catat di linimasa; amati |
| S2 | Dosen pengampu KKS | ≤ 1 jam sesudah severity ditetapkan (target, menurut slide pekan 13) | Sertakan ringkasan dan bukti |
| S1 | Dosen pengampu (KKS, dan PAW atau Kriptografi bila kunci terlibat) | ≤ 1 jam (target, menurut slide pekan 13) | Mulai penilaian kewajiban notifikasi UU PDP |

Kewajiban hukum: bila ada kegagalan pelindungan data pribadi, UU 27/2022 mengatur pemberitahuan kepada subjek data dan lembaga. Menurut slide pekan 13, pemberitahuan kepada subjek data dan lembaga paling lambat 3 x 24 jam; angka itu diambil dari slide dan belum diperiksa ke teks UU. Data di staging sintetis, sehingga kewajiban ini baru berlaku nyata bila Kyrion memuat data pribadi sungguhan (rilis v1.0).

## 5. Penutupan dan review

Insiden ditutup oleh Incident Commander bila exit criteria di playbook terpenuhi dan bukti disimpan. Review dijadwalkan sesudah penutupan: dokumen ini dan playbook diperbarui setelah setiap tabletop dan insiden (catat di bagian "Pasca-insiden" tiap playbook).

## 6. Playbook

| ID | Skenario | Pemicu |
|---|---|---|
| PB-01 | Tebakan OTP dan penolakan berulang pada rute sensitif | D-1, D-2 |
| PB-02 | Pemindaian port | D-3 |
| PB-03 | Rahasia atau kunci diduga bocor | Manual (tidak ada rule DET) |
