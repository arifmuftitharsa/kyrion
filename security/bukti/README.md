# Indeks bukti sec-0.3

Disusun 2026-11-25. Jalur relatif terhadap `security/`. Isi tabel hanya dari berkasnya sendiri; untuk berkas tanpa kepala, dari dokumen yang merujuknya (disebut "dari ..."). "v0.3" adalah versi aplikasi seperti tertulis, bukan nama rilis keamanan. Waktu UTC kecuali disebut lain. Folder `bukti/` juga memuat bukti sec-0.2. "Berdasarkan riwayat git" berarti rilis tidak tertulis di berkas, tetapi commit yang menambahkan berkas itu dibuat sesudah tag `v0.3` dan termasuk riwayat branch `sec-0.3/tahap-3`; anotasi ini bukan bukti kapan berkas dihasilkan.

## Berkas `bukti/`

| Berkas | Tanggal | Rilis | Perintah atau skrip penghasil |
|---|---|---|---|
| `02-peran-db.txt`, `-percobaan-1.txt` | 2026-11-22 | sec-0.3 (berdasarkan riwayat git: commit bb928e1) | `uji-negatif-peran.sh` lewat ssh (percobaan 1: `--terapkan-roles`) |
| `03-backup.txt`, `-percobaan-1.txt` | 2026-11-22 | sec-0.3 (berdasarkan riwayat git: commit f079344) | `deploy/uji/03-backup.ps1` |
| `06-monitoring-siapkan.txt`, `-percobaan-1.txt` | 2026-11-23 | sec-0.3 (berdasarkan riwayat git: commit ad8342a) | `06-monitoring.ps1 -Fase siapkan` |
| `06-monitoring-jalankan-percobaan-1.txt` sampai `-4.txt` | 2026-11-23 | sec-0.3 (berdasarkan riwayat git: commit ad8342a) | `06-monitoring.ps1 -Fase jalankan` |
| `06-monitoring-jalankan.txt` | 2026-11-25 | sec-0.3 (berdasarkan riwayat git: commit ad8342a) | `06-monitoring.ps1 -Fase jalankan` |
| `07-deteksi-periksa.txt` | 2026-11-25 | sec-0.3 (berdasarkan riwayat git: commit f1a9310) | `07-deteksi-periksa.ps1` |
| `08-deteksi-uji.txt` | 2026-11-25 | sec-0.3 (berdasarkan riwayat git: commit f1a9310) | `08-deteksi-uji.ps1` |
| `09-deteksi-pasang.txt` | 2026-11-25 | sec-0.3 (berdasarkan riwayat git: commit caa36eb) | `09-deteksi-pasang.ps1` |
| `10-simulasi-D-1-benign.txt`, `D-1-serangan`, `D-2-benign`, `D-2-serangan`, `D-3-serangan` | 2026-11-25 | sec-0.3 (berdasarkan riwayat git: commit 08c9418) | `10-deteksi-simulasi.ps1 -Skenario <D-n> -Mode <mode>` |
| `11-timer-backup-gagal.txt` | 2026-11-25 | sec-0.3 | dua perintah `ssh` (`systemctl`, `journalctl`, `ls`) |
| `13-timer-backup-diperbaiki.txt` | 2026-11-25 | sec-0.3 | `sudo touch` pada stamp timer lalu `sudo reboot`, `sudo docker pause` dengan `systemctl start --no-block`, dan `journalctl -b` |
| `14-timer-backup-catchup-boot.txt` | 2026-11-26 | sec-0.3 | `ssh kyrion-staging`, lalu `uptime -s`, `sudo journalctl -u kyrion-backup.service -b --no-pager`, `systemctl list-timers kyrion-backup.timer --no-pager` |
| `15-rto-latihan-pulih.txt` | 2026-11-26 | sec-0.3 | `restore-test.sh` (uji terisolasi), lalu latihan pulih produksi: fase 1 (hentikan layanan, ambil dan verifikasi cadangan), fase 2 (DB lama diganti nama `kyrion_lama`, DB baru, `pg_restore`, `roles.sql`), fase 3a (storage dan kunci), fase 3b (jalankan kembali layanan), dan verifikasi browser; teks perintah per fase tidak tercatat di berkas |
| `16-hsts-header-https.txt` | 2026-11-26 | sec-0.3 | di VM: `date -u`, `curl -skI --resolve kyrion.test:443:127.0.0.1 https://kyrion.test/masuk`, `curl -sI http://127.0.0.1/ -H "Host: kyrion.test"` |
| `17-cookie-sesi-atribut.png` | 2026-11-26 (keterangan Arif; tidak tercatat di gambar) | sec-0.3 | DevTools Chrome, tab Application, Cookies (tangkapan layar; kolom Value disamarkan) |
| `ir-plan.md` | 2026-11-26 | sec-0.3 | tidak tercatat di berkas (dokumen) |
| `playbooks/PB-02-pemindaian-port.md` | 2026-11-26 | sec-0.3 | tidak tercatat di berkas (dokumen) |
| `playbooks/PB-03-rahasia-atau-kunci-bocor.md` | 2026-11-26 | sec-0.3 | tidak tercatat di berkas (dokumen) |
| `vm-sumber-daya.txt` | 2026-11-23 | sec-0.3 (berdasarkan riwayat git: commit 111ee53) | `06-sumber-daya-vm.sh` lewat ssh |
| `bukti-sebelum-tahap-2.txt` | 2026-11-21 | sebelum sec-0.3, v0.3 | perintah tercetak di berkas (baris `+`); nama skrip tidak tercatat di berkas |
| `bukti-sebelum-tahap-2b.txt` | 2026-11-22 | sebelum sec-0.3, v0.3 | perintah tercetak di berkas (baris `$`) |
| `v0.3-deploy-vm.txt` | 2026-11-21 | v0.3 | perintah tercetak di berkas (baris `$`) |
| `image-scan-v0.3-before.txt` | 2026-11-21 | sec-0.3 (berdasarkan riwayat git: commit 47075f4) | `trivy image ... kyrion-web:hardened` |
| `sbom-v0.3.cdx.json` | 2026-11-21 (metadata; Trivy 0.69.3) | sebelum sec-0.3, v0.3 (dari `risk-register.md`) | tidak tercatat di berkas |
| `scan-before-awal-filtered.txt` | 2026-11-21 | sebelum sec-0.3, v0.3 | `nmap` (baris 1) |
| `diagnosis-filtered.txt`, `tcpdump-filtered.txt` | 2026-11-22 | v0.3 | perintah tercatat di berkas (`Test-NetConnection`, `nmap`, `tcpdump`) |
| `scan-after-pembanding.txt` | 2026-11-22 | sec-0.3 (berdasarkan riwayat git: commit 38d08b1) | `nmap` (baris 1) |
| `firewall-konfigurasi.txt` | 2026-11-22 | v0.3 | perintah `ufw`, `iptables`, `ss`, `docker ps` (kepala) |
| `uji-docker-user-negatif.txt` | 2026-11-22 | v0.3 | `curl.exe`, `iptables`, `systemd-run` |
| `uji-rate-limit.txt` | 2026-11-22 | v0.3 + kontrol sec-0.3 | `curl.exe` POST (kepala) |
| `uji-akses-via-ip.txt` | 2026-11-22 | sec-0.3 (berdasarkan riwayat git: commit da46e3b) | `curl.exe ... https://192.168.56.101/masuk` |
| `secrets-efektif.txt` | 2026-11-22 | sec-0.3 (berdasarkan riwayat git: commit 8460d22) | tidak tercatat di berkas |
| `gitleaks-catatan.txt` | 2026-11-22 | sec-0.3 | `gitleaks git` (perintah di berkas) |
| `offsite-checksum.txt` | 2026-11-23 | sec-0.3 (berdasarkan riwayat git: commit 490b664) | tidak tercatat di berkas |
| `access-admin.txt`, `access-admin-keluar.txt`, `access-admin-restart.txt`, `access-admin-tambahan.txt`, `access-anonim.txt` | 2026-11-01 | tidak tercatat di berkas | tidak tercatat di berkas |
| `access-port-laptop.txt`, `container-hardening.txt`, `hash-kata-sandi.txt`, `sshd-T-final.txt` | 2026-11-01 | sec-0.2 | tidak tercatat di berkas |
| `access-server-action-tanpa-sesi.txt` | 2026-11-01 | sec-0.2 | uji manual A-N7; perintah VM tercetak di berkas |
| `os-hardening-after.txt` | 2026-11-01 | tidak tercatat di berkas | tidak tercatat di berkas |
| `sshd-T-before.txt`, `sshd-T-after.txt` | tidak tercatat di berkas | sec-0.2 (dari `hardening-notes.md`) | tidak tercatat di berkas |
| `server-action-guard.txt` | tidak tercatat di berkas | sec-0.2 (dari `access-tests.md`) | pencarian statis; perintah tidak tercatat di berkas (dari `access-tests.md`) |
| `akses-v0.3-anonim.txt`, `-sivitas`, `-admin`, `-503`, `-pemilik` | tidak tercatat di berkas (`access-tests-v0.3.md`: waktu run tidak dapat dipastikan) | v0.3 (dari dokumen itu) | `uji-akses-v0.3.ps1` (dari dokumen itu) |
| `vitest-akses-v0.3.txt` | tidak tercatat di berkas | v0.3 (dari `access-tests-v0.3.md`) | Vitest 5.0.4 (dari dokumen itu); perintah tidak tercatat di berkas |
| `npm-audit-v0.3.txt`, `grep-injeksi-v0.3.txt` | tidak tercatat di berkas | tidak tercatat di berkas | tidak tercatat di berkas (tidak ada dokumen `.md` perujuk yang ditemukan) |

## Berkas lain di `security/`

| Berkas | Tanggal | Rilis | Perintah atau skrip penghasil |
|---|---|---|---|
| `scan-before.txt`, `scan-after.txt` | 2026-11-22 | sebelum dan sesudah kontrol sec-0.3, v0.3 | `nmap` (baris 1) |
| `tls-check.txt` | 2026-11-22 | v0.3 + kontrol sec-0.3 | `openssl s_client`, `nmap ssl-enum-ciphers` |
| `gitleaks.json` | 2026-11-22 (dari `secrets.md`) | sec-0.3 (dari `secrets.md`) | gitleaks 8.30.1; perintah di `bukti/gitleaks-catatan.txt` (dari `secrets.md`) |
| `firewall-rules.md` | 2026-11-22 | sec-0.3 | tidak tercatat di berkas (perintah uji ulang di bagian 5) |
| `data-classification.md` | 2026-11-22 | sec-0.3 | `git rev-parse`, `date -u` |
| `secrets.md` | 2026-11-22 | sec-0.3 | `git rev-parse`; merujuk bukti VM dan gitleaks |
| `backup-restore.md` (ada catatan 2026-11-25) | 2026-11-22 | sec-0.3 | `deploy/uji/03-backup.ps1`, `git rev-parse` |
| `alerts-analysis.md` | 2026-11-25 | sec-0.3 | skrip `deploy/uji/08`, `09`, `10` |
| `detection/README.md` | tidak tercatat di berkas | sec-0.3 | tidak tercatat di berkas (cara uji merujuk skrip simulasi) |
| `detection/D-1-tebak-otp.yml`, `D-2-rute-sensitif.yml`, `D-3-pemindaian-port.yml` | tidak tercatat di berkas | sec-0.3 (berdasarkan riwayat git: commit a7f4ea8) | tidak tercatat di berkas (dokumen rule) |
| `detection/simulasi.ps1` | tidak tercatat di berkas | sec-0.3 (berdasarkan riwayat git: commit 08c9418) | skrip pembangkit lalu lintas (bukan keluaran) |
| `playbooks/PB-01-tebakan-otp-dan-rute-sensitif.md` | 2026-11-25 | sec-0.3 | tidak tercatat di berkas (dokumen) |
| `bcp.md` | 2026-11-25 | sec-0.3 | tidak tercatat di berkas (dokumen) |
| `tabletop-report.md` | 2026-11-25 | sec-0.3 | tidak tercatat di berkas (tabletop diskusi, tanpa perintah di VM) |

## Celah: berkas dengan data tidak lengkap

- **Tanggal tidak tercatat di berkas:** `sshd-T-before`, `sshd-T-after`, `server-action-guard`, `akses-v0.3-*` (lima), `vitest-akses-v0.3`, `npm-audit-v0.3`, `grep-injeksi-v0.3`, `detection/*`.
- **Rilis tidak tercatat di berkas:** `access-admin.txt`, `access-admin-keluar.txt`, `access-admin-restart.txt`, `access-admin-tambahan.txt`, `access-anonim.txt`, `os-hardening-after.txt`, `npm-audit-v0.3.txt`, `grep-injeksi-v0.3.txt` (commit yang menambahkannya sudah ada sebelum atau pada tag `v0.3`).
- **Perintah atau skrip tidak tercatat di berkas:** `bukti-sebelum-tahap-2` (nama skrip), `sbom-v0.3`, `secrets-efektif`, `offsite-checksum`, `access-admin*` (empat), `access-anonim`, `access-port-laptop`, `container-hardening`, `hash-kata-sandi`, `sshd-T-*` (tiga), `os-hardening-after`, `server-action-guard`, `vitest-akses-v0.3`, `npm-audit-v0.3`, `grep-injeksi-v0.3`; dokumen: `firewall-rules`, `detection/README`, rule `.yml`, PB-01, `bcp`, `tabletop-report`.
