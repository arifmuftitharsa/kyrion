# Aturan deteksi Kyrion (sec-0.3, Tugas 7)

Status ketiga rule: **test**. Query bentuk [15m] sudah dijawab Loki di VM (`security/bukti/08-deteksi-uji.txt`). Berkas alert Grafana (query [5m]) termuat di VM (`security/bukti/09-deteksi-pasang.txt`; D-3 belum dievaluasi saat itu). Status Firing ketiga rule teramati pada simulasi serangan (`security/bukti/10-simulasi-*-serangan.txt`).

| Berkas | Isi |
|---|---|
| D-1-tebak-otp.yml, D-2-rute-sensitif.yml, D-3-pemindaian-port.yml | dokumen rule (format ala Sigma) |
| ../monitoring/grafana/provisioning/alerting/rules.yaml | rule alert Grafana (datasource uid `kyrion-loki`) |

## Ringkasan

Query penuh ada di tiap berkas rule; harus sama dengan `expr` di rules.yaml.

| Rule | Query singkat (jendela 5 menit) | Alert bila | Risiko | ATT&CK (usul) |
|---|---|---|---|---|
| D-1 | non-2xx pada `/api/auth/sign-in/email-otp`, per `ip` | > 10 | R-14 (T-11, T-12, T-13) | T1110 |
| D-2 | 401, 403, 404 pada awalan `/admin` atau `/api/v1/`, per `ip`; 307 dikecualikan | > 10 | R-03, R-15 | T1190 |
| D-3 | jumlah `DPT` berbeda pada `[UFW BLOCK]`, per `src` | > 3 (minimal 4) | R-09, R-15 | T1046 |

**Semua ID ATT&CK adalah USUL dan harus diverifikasi Arif di attack.mitre.org.**

Teks R-09 di `security/risk-register.md` menyebut D-3 sebagai deteksi percobaan SSH. Itu bertentangan dengan D-3 di sini (pemindaian port) dan diselesaikan di Tugas 13. R-09 tidak diubah.

## Alert Grafana

- Tiap rule: query instant (A), reduce `last` per seri (B), threshold (C); satu instance alert per `ip` atau `src`.
- Evaluasi tiap 1 menit, pending 1 menit, `noDataState: OK`, `execErrState: Error`. Label: `rule`, `severity`, `risk`.
- Karena pending 1 menit, kondisi harus bertahan pada evaluasi berikutnya sebelum Firing.
- **Notifikasi tidak ada.** Keputusan Arif: tanpa saluran eksternal. Berkas ini tidak membuat contact point maupun notification policy. Bukti alert adalah status **Firing** dan **riwayat alert** di Grafana (ketersediaan riwayat di VM belum terbukti). Perilaku pengiriman bawaan Grafana tidak dikonfigurasi dan belum diperiksa.
- Belum ada tautan playbook.

### Memuat rule

Grafana membaca provisioning saat start. Menyalin berkas saja, atau `up -d` tanpa perubahan konfigurasi container, tidak cukup. Sesudah rules.yaml ada di `/srv/kyrion/monitoring/grafana/provisioning/alerting/` di VM:

```bash
cd /srv/kyrion/monitoring && sudo docker compose -p kyrion-mon --env-file images.env -f compose.monitoring.yaml restart grafana
```

Sesudahnya periksa di Grafana (Alerting, Alert rules) bahwa tiga rule tampil di folder "Kyrion Deteksi" dan tidak berstatus Error, dan periksa log container Grafana untuk galat provisioning.

## Cara uji

Skrip simulasi untuk memicu tiap rule: `security/detection/simulasi.ps1` (pembangkit lalu lintas) dan `deploy/uji/10-deteksi-simulasi.ps1` beserta `10-deteksi-simulasi-vm.sh` (menjalankan dan memantau status alert). Bukti: `security/bukti/10-simulasi-*.txt`. **D-3 benign TIDAK dijalankan** (tidak ada berkas `10-simulasi-D-3-benign.txt`).

`deploy/uji/08-deteksi-uji.ps1` hanya menguji query tanpa ambang; skrip itu tidak membuktikan alert Firing.

## Bukti per angka

| Angka atau klaim | Bukti |
|---|---|
| Bentuk baris Nginx | `07-deteksi-periksa.txt` baris 53-56 |
| IP asli klien dari laptop: 192.168.56.1 | `08-deteksi-uji.txt` baris 51-53 |
| Query D-1 dan D-2 ([15m]) dijawab Loki | `08-deteksi-uji.txt` baris 57-63 |
| Query D-3 ([15m]) dijawab Loki: 7 DPT, 20 baris | `08-deteksi-uji.txt` baris 65-69 |
| GET /admin 307, POST approval 401, sign-in 400 | `08-deteksi-uji.txt` baris 8-10 |
| Pembatas OTP: 3 kali 400 lalu 429 | `uji-rate-limit.txt` baris 5-14 |
| Bentuk baris `[UFW BLOCK]` | `07-deteksi-periksa.txt` baris 61-70 |
| Limit log UFW 3/menit, burst 10 | `08-deteksi-uji.txt` baris 27-30 |
| Pindai 30 port: 10 baris, 5 DPT (satu pengukuran) | `08-deteksi-uji.txt` baris 11-19 dan 32-34 |
| Nilai label job stream kernel | `08-deteksi-uji.txt` baris 38 |
| Ambang D-1 > 10 dan D-2 > 10 | keputusan Arif; tidak ada pengukuran pendukung (**belum terbukti**) |
| Ambang 20 pada slide | slide tidak ada di repo (**belum terbukti**) |

Berkas bukti ada di `security/bukti/`.

## Daftar batas

| Rule | Batas |
|---|---|
| D-1 | Endpoint kirim OTP tidak tercakup. 5xx saat aplikasi mati ikut terhitung (belum diuji). Tebakan lambat atau dari banyak IP lolos. |
| D-2 | 404 untuk data yang memang tidak ada ikut terhitung. Access log tanpa peran. Server Action belum teruji. 307 tidak dihitung. |
| D-3 | Bucket pembatas log dipakai bersama (dampak belum diuji). Port yang dipublikasikan Docker (DOCKER-USER) tidak dilog (belum diuji dengan lalu lintas). Pemindaian lambat bisa lolos. Ambang dari satu pengukuran. |
| Semua | Bergantung pada Alloy dan Loki; bila log tidak masuk, `noDataState: OK` membuat rule tampak aman. |

Daftar lengkap beserta false positive ada di blok `false_positive` dan `batas` tiap berkas rule.
