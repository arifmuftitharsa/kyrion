# Analisis peringatan D-1..D-3

- Rilis: sec-0.3. Tanggal bukti: 2026-11-25 (semua waktu UTC). Sasaran: VM milik sendiri (192.168.56.101).
- Perintah penghasil bukti:
  - `.\deploy\uji\08-deteksi-uji.ps1` (uji query jendela 15 menit, tanpa ambang).
  - `.\deploy\uji\09-deteksi-pasang.ps1` (memuat rule alert ke Grafana).
  - `.\deploy\uji\10-deteksi-simulasi.ps1 -Skenario <D-n> -Mode <benign|serangan>` (hash commit di kepala bukti: `caa36eb`).
- Berkas bukti ada di `bukti/`; definisi rule di `detection/`.

## Hasil per rule

Evaluasi rule tiap 1 menit, pending 1 menit (`detection/README.md`).

| | D-1 Tebakan OTP | D-2 Rute sensitif | D-3 Pemindaian port |
|---|---|---|---|
| Risiko | R-14 | R-03, R-15 | R-09, R-15 |
| Alert bila | > 10 non-2xx per `ip` | > 10 respons 401/403/404 per `ip` | > 3 DPT berbeda per `src` |
| Jendela | 5 menit | 5 menit | 5 menit |
| Lalu lintas benign | 3 POST sign-in OTP: 400=3 | 20 GET `/admin` (307) dan 3 POST approval (401) | **tidak dijalankan** |
| Hasil benign | tidak memicu (pantauan 241 detik, 0 transisi) | tidak memicu D-2 (pantauan 246 detik, 0 transisi) | tidak ada bukti |
| Lalu lintas serangan | 30 POST: 400=3, 429=27 | 15 POST approval: 401=15 | nmap 30 port (9001-9030), semua `filtered` |
| Pending: evaluasi / teramati | 07:42:30 / 07:42:33 | 07:54:30 / 07:55:08 | 08:15:30 / 08:15:42 |
| Firing: evaluasi / teramati | 07:43:30 / 07:43:43 | 07:55:30 / 07:55:38 | 08:16:30 / 08:16:42 |
| Bukti benign | `10-simulasi-D-1-benign.txt` | `10-simulasi-D-2-benign.txt` | - |
| Bukti serangan | `10-simulasi-D-1-serangan.txt` | `10-simulasi-D-2-serangan.txt` | `10-simulasi-D-3-serangan.txt` |

"Evaluasi" adalah `lastEvaluation` rule; "teramati" adalah waktu skrip pemantau pertama kali melihat status itu, sehingga bukan waktu transisi persis. Nilai hitungan saat alert tidak tercatat: `value=1e+00` di bukti bukan jumlah request atau port.

## Klasifikasi

| Alert | Label sumber | Klasifikasi | Dasar |
|---|---|---|---|
| D-1 Firing | `ip=192.168.56.1` | True positive | lalu lintas serangan dibangkitkan Arif dari laptop |
| D-2 Firing | `ip=192.168.56.1` | True positive | sama |
| D-3 Firing | `src=192.168.56.1` | True positive | sama |

True positive di sini berarti rule mendeteksi simulasi yang dimaksud, bukan serangan pihak lain.

**False positive: tidak ada yang teramati** pada bukti simulasi. Ini bukan bukti bahwa rule bebas false positive: hanya ada dua run benign (D-1 dan D-2), dengan jumlah yang dihitung rule jauh di bawah ambang (masing-masing 3 request), dan tanpa lalu lintas pengguna nyata. Daftar kemungkinan false positive di tiap berkas rule belum diuji.

Catatan pengamatan:

- Pada keadaan awal run D-2 benign (07:47:00), D-1 masih `firing` (`activeAt` 07:43:30), dan `inactive` pada keadaan dasar pantauan (evaluasi 07:47:30). Ini tidak diklasifikasikan false positive. Penafsiran: sisa serangan D-1 (07:41:55) yang masih dalam jendela 5 menit pada evaluasi 07:46:30. Jarak ke run itu sekitar 5 menit, kurang dari 6 menit yang diminta catatan skrip. D-2 sendiri `inactive`.
- Sebelum run D-3 serangan, instance D-3 untuk `src=192.168.56.1` sudah ada dengan status `Normal (NoData)` (`activeAt` 08:08:30). Lalu lintas asalnya tidak tercatat di berkas bukti. Rule D-3 `inactive` sebelum lalu lintas dikirim.
- Status di luar jendela pantauan tiap run tidak terekam di bukti.

## Penyetelan (tuning)

### D-3: ambang 20 menjadi > 3 (minimal 4 DPT berbeda)

- Angka 20 berasal dari slide. Slide tidak ada di repo (**belum terbukti**), dan bukti tidak menunjukkan rule ber-ambang 20 pernah dipasang.
- Pengukuran (satu kali): pindai 30 port menghasilkan 10 baris `[UFW BLOCK]` dengan 5 DPT berbeda (`bukti/08-deteksi-uji.txt`, bagian A dan B2). Pada kondisi itu ambang 20 tidak tercapai.
- Aturan LOG UFW dibatasi `--limit 3/min --limit-burst 10` (bagian B1). Pembatas ini penjelasan yang cocok dengan angka di atas, tetapi **belum diuji terpisah** (`detection/D-3-pemindaian-port.yml`).
- Hasil: run serangan 30 port mencapai Firing. Ambang ini belum divalidasi dengan pengukuran kedua maupun lalu lintas normal.
- Query B5 pada bukti 08 menghasilkan 7 DPT dengan jendela 15 menit; jendela itu juga memuat lalu lintas uji sebelumnya, sehingga tidak dipakai sebagai hasil pindaian tunggal.

### D-2: 307 dikecualikan

- Alasan pengecualian: **alasan tidak tercatat**.
- Yang tercatat: GET `/admin` tanpa cookie dijawab 307 (`bukti/08-deteksi-uji.txt` bagian A); run benign dengan 20 kali 307 tidak memicu D-2. Run itu tidak membandingkan rule yang menghitung 307.
- Konsekuensi tercatat: percobaan anonim ke halaman `/admin` yang dialihkan ke `/masuk` tidak terhitung (`detection/D-2-rute-sensitif.yml`).

Tidak ada penyetelan lain sesudah simulasi yang tercatat di bukti.

## Keterbatasan

- Ambang D-1 dan D-2 (> 10) adalah keputusan Arif, belum diukur dari baseline lalu lintas normal.
- Uji di batas ambang (tepat di bawah dan tepat di atas) tidak dilakukan.
- Ambang D-3 hanya dari satu pengukuran.
- Bucket pembatas log UFW dipakai bersama semua sumber (dampaknya belum diuji).
- Pemindaian lambat (3 DPT tercatat atau kurang dalam 5 menit) tidak memicu D-3.
- Port yang dipublikasikan Docker (DOCKER-USER) tidak dicatat sebagai `[UFW BLOCK]` (belum diuji dengan lalu lintas).
- D-3 benign tidak dijalankan.
- D-1 tidak mencakup endpoint kirim OTP.
- D-2 ikut menghitung 404 untuk data yang memang tidak ada. Status 403 dan 404 tidak diuji pada simulasi.
- Hasil render annotation `{{ .Labels.ip }}` dan `{{ .Labels.src }}` belum diverifikasi.
- Tidak ada kanal notifikasi eksternal (keputusan Arif). Bukti alert adalah status Firing.
