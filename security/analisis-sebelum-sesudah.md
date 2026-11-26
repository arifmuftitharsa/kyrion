# Analisis sebelum-sesudah risiko prioritas (sec-0.3)

- Tanggal: 2026-11-25. Rilis: sec-0.3. Jalur berkas relatif terhadap `security/`.
- Sumber: `risk-register.md`, `firewall-rules.md`, `data-classification.md`, `secrets.md`, `backup-restore.md`, `alerts-analysis.md`, `monitoring/README.md`, `access-tests-v0.3.md`, berkas pindai, dan `bukti/`.
- Skema register: Skor = L x I (1-5); Very High 15-25, High 8-14, Moderate 4-7, Low 1-3.
- "Sebelum" = nilai register. **Semua "skor sesudah" adalah usulan Arif, belum di register.** Register hanya memuat target L. Register tidak diubah. I tidak diubah karena kontrol yang dinilai menyasar L.
- Aturan penilaian: L turun penuh sesuai target hanya bila ada uji untuk inti kontrol; bila bagian penting belum teruji, turun sebagian atau tetap.
- Kekuatan bukti: konfigurasi < konfigurasi efektif < uji negatif < bukti operasional.

## 1. Risiko prioritas

Dipilih: risiko prioritas yang disentuh kontrol sec-0.3 (R-01, R-03, R-08 dari sebelumnya; R-09 sampai R-15), satu baris per ancaman utama, urut skor sebelum. R-08 memakai T-24 (T-07, skor 4, tidak dinilai ulang).

| Risiko (ancaman) | Sebelum | Kontrol sec-0.3 | Bukti (kekuatan) | Sesudah (usulan) | Alasan |
|---|---|---|---|---|---|
| R-01 (T-01) | 4x4=16 | `client_max_body_size 11m`, `limit_req` umum di Nginx | `firewall-rules.md` 2.4 (konfigurasi saja) | 4x4=**16** | Tidak ada uji muatan besar atau laju umum yang dibaca, jadi L tetap. |
| R-03 (T-06) | 3x4=12 | Hanya deteksi D-2; penjaga akses sudah diuji di v0.3 | `bukti/10-simulasi-D-2-serangan.txt`, `access-tests-v0.3.md` | 3x4=**12** | D-2 mendeteksi, tidak mencegah, dan register tidak memberi angka target L. |
| R-09 (T-23) | 3x4=12 | UFW default deny, DOCKER-USER, D-3 | `scan-after.txt`, `bukti/firewall-konfigurasi.txt`, `bukti/uji-docker-user-negatif.txt` (uji negatif) | 2x4=**8** | Pemblokiran 443 teruji, tetapi target L=1 belum diberikan karena IPv6 belum diuji dan aturan 80/443 masih /24. |
| R-10 (T-15) | 3x4=12 | Nginx TLS 1.2/1.3; HSTS dan cookie Secure | `tls-check.txt` (uji negatif TLS); HSTS: `firewall-rules.md` 2.3 (konfigurasi saja); cookie Secure: tidak ada di bukti | 2x4=**8** | TLS lama terbukti ditolak, tetapi perlindungan cookie sesi belum terbukti sehingga target L=1 belum diberikan. |
| R-11 (T-17) | 3x4=12 | Rahasia lewat `/run/secrets` | `bukti/secrets-efektif.txt` (konfigurasi efektif; cek `docker inspect` lemah, tanpa kontrol positif) | 2x4=**8** | Sesuai target; nilai masih ada di environment proses (disimpulkan dari kode, belum diuji). |
| R-12 (T-20) | 3x4=12 | Backup terenkripsi, timer, salinan laptop | `bukti/03-backup.txt` (bukti operasional, 61 KB), `bukti/11-timer-backup-gagal.txt` | 3x4=**12** (usulan Arif, L tidak turun) | Timer terbukti gagal dua kali (bukti 11), lalu penyebabnya diperbaiki dan cadangan oleh timer berhasil pada boot dengan jadwal terlewat yang disimulasikan (`bukti/13-timer-backup-diperbaiki.txt`). L tetap 12: belum ada rangkaian cadangan harian dari jadwal 02:00 UTC sungguhan, kegagalan unit belum terpantau, dan salinan offsite masih di laptop yang sama. |
| R-15 (T-21) | 4x3=12 | Alloy, Loki, Grafana, D-1..D-3 | `bukti/06-monitoring-jalankan.txt`, `bukti/07-deteksi-periksa.txt`, `bukti/10-simulasi-*-serangan.txt` (bukti operasional, simulasi) | 3x3=**9** | Tiga simulasi mencapai Firing, tetapi `audit_logs` tidak dikirim dan tidak ada notifikasi, sehingga target L=2 belum diberikan. |
| R-11 (T-27) | 2x5=10 | gitleaks riwayat penuh | `bukti/gitleaks-catatan.txt`, `gitleaks.json` (pemindaian efektif) | 1x5=**5** | 190 commit menghasilkan 0 temuan sesudah 3 positif palsu diabaikan; terbatas pada aturan bawaan. |
| R-14 (T-12) | 3x3=9 | XFF ditimpa `$remote_addr`, `limit_req` | `bukti/bukti-sebelum-tahap-2.txt`, `bukti/uji-rate-limit.txt` (uji negatif) | 1x3=**3** | Bypass XFF terbukti sebelumnya, dan sesudahnya XFF palsu yang berganti-ganti tetap berujung 429. |
| R-14 (T-13) | 3x3=9 | `limit_req` pada endpoint OTP | `firewall-rules.md` 2.4 (konfigurasi saja untuk endpoint kirim OTP) | 3x3=**9** | Uji pembatas hanya pada sign-in, bukan endpoint kirim OTP, sehingga L tetap. |
| R-15 (T-25) | 3x3=9 | Loki internal, Grafana hanya loopback, kredensial diganti, retensi 30 hari | `bukti/06-monitoring-jalankan.txt` (jaringan dan port: konfigurasi efektif); kredensial dan retensi: `monitoring/README.md` (konfigurasi) | 2x3=**6** | Sesuai target karena jaringan internal dan satu port loopback teramati; kredensial dan retensi belum diuji. |
| R-08 (T-24) | 2x4=8 | Pemindaian Trivy dan SBOM image v0.3 | `bukti/image-scan-v0.3-before.txt`, `bukti/sbom-v0.3.cdx.json` | 2x4=**8** | Pindai sesudah perbaikan `effect` tidak ada di bukti. |
| R-12 (T-26) | 2x4=8 | Enkripsi age sebelum disalin | `bukti/03-backup.txt` (konfigurasi efektif) | 2x4=**8** | Enkripsi terbukti, tetapi kunci privat ada di laptop yang sama dengan salinan (keterangan Arif), sehingga target L=1 belum diberikan. |
| R-13 (T-18) | 2x4=8 | Peran DDL dan DML; `audit_logs` hanya INSERT/SELECT | `bukti/02-peran-db.txt` (uji negatif, 17 lulus, 0 gagal) | 2x4=**8** | Hak peran teruji, tetapi pemakaian `kyrion_app` oleh aplikasi belum terbukti langsung dan superuser masih ada. |
| R-14 (T-11) | 2x4=8 | Deteksi D-1, `limit_req` | `bukti/10-simulasi-D-1-serangan.txt` | 2x4=**8** | Sesuai register: terdeteksi, bukan dicegah. |

T-22 (R-15, 3x2=6) tidak berubah: register menetapkan `console.error` hanya didaftar sebagai temuan, bukan diubah.

Catatan R-09: register menyebut D-3 sebagai deteksi percobaan SSH, sedangkan D-3 yang dibuat mendeteksi pemindaian port; deteksi percobaan SSH tidak ada pada D-3.

## 2. Perbandingan terukur

### Trivy, image aplikasi (HIGH dan CRITICAL)

| Berkas | Image, tanggal | Lapisan OS | Paket Node |
|---|---|---|---|
| `image-scan-before.txt` | naif (Debian 12.15), 2026-11-01 | 472 (452 HIGH, 20 CRITICAL) | baris Total: 6 HIGH, 0 CRITICAL |
| `image-scan-after.txt` | hardened (Alpine 3.24.3), 2026-11-01 | 0 | tidak ada temuan di tabel ringkasan |
| `bukti/image-scan-v0.3-before.txt` | hardened v0.3, 2026-11-21 | 0 | 1 HIGH (`effect` 3.20.0, CVE-2026-121707, perbaikan 3.22.1) |

Dua baris pertama adalah perubahan **sec-0.2**, bukan hasil sec-0.3. Pindai image aplikasi sesudah kontrol sec-0.3: tidak ada di bukti.

Image monitoring (baru di sec-0.3, tanpa pembanding sebelum; `bukti/06-monitoring-siapkan.txt`): Alloy HIGH 15, Loki HIGH 0, Grafana HIGH 20; CRITICAL 0 untuk ketiganya.

### Port, segmentasi, dan kontrol lain

| Aspek | Sebelum | Sesudah | Bukti |
|---|---|---|---|
| Firewall host | UFW inactive, DOCKER-USER kosong | UFW active, deny incoming; SSH hanya dari 192.168.56.1; DOCKER-USER berisi aturan | `risk-register.md` (bukti per ancaman), `bukti/firewall-konfigurasi.txt` |
| Port dari laptop (TCP IPv4) | 22 open; 65.534 closed | 22, 80, 443 open; 65.532 filtered | `scan-before.txt`, `scan-after.txt` |
| 3000, 5432 | tidak open (3000 hanya di 127.0.0.1) | filtered (juga 8443) | `scan-before.txt`, `bukti/scan-after-pembanding.txt` |
| TLS | HTTP tanpa TLS (uraian T-15; uji sebelum tidak ada di bukti) | TLS 1.3 dan 1.2 diterima; 1.1 dan 1.0 ditolak | `tls-check.txt` |
| XFF palsu pada sign-in OTP | empat XFF tunggal berbeda semuanya 400 (loopback VM) | 3x 400 lalu 429 (dari laptop lewat Nginx) | `bukti/bukti-sebelum-tahap-2.txt`, `bukti/uji-rate-limit.txt` |
| Peran DB | hanya `kyrion` (superuser) | `kyrion` (superuser), `kyrion_app`, `kyrion_ddl` (keduanya bukan superuser) | `risk-register.md`, `bukti/02-peran-db.txt` |
| Rahasia di environment app | nama variabel sensitif tampak di `docker inspect` | tiga rahasia tidak ada di daftar nama variabel | `risk-register.md`, `bukti/secrets-efektif.txt` |
| Jejak OTP gagal | 12 permintaan salah tanpa baris `audit_logs` | respons non-2xx terhitung D-1 dari log Nginx; `audit_logs` tidak diuji ulang | `risk-register.md`, `bukti/10-simulasi-D-1-serangan.txt` |

Port terbuka bertambah dari 22 menjadi 22, 80, 443 karena layanan kini sengaja dibuka lewat Nginx. Opsi waktu nmap sebelum dan sesudah berbeda (alasannya ada di keterangan `scan-after.txt`). Pemindaian tidak mencakup UDP atau IPv6.

## 3. Risiko tersisa

"Rencana (usulan)" belum menjadi keputusan yang tercatat. "Diterima" hanya dipakai bila dokumen sumber menyatakannya.

| Risiko | Residual | Mengapa belum ditutup | Rencana atau status |
|---|---|---|---|
| R-13, R-11 | Service `tools` masih memakai URL superuser; peran `kyrion` masih ada | Diff URL DDL belum diterapkan (`secrets.md` residual 2, 5) | Rencana (usulan): terapkan URL `kyrion_ddl`, uji `migrate deploy`, buktikan peran koneksi app |
| R-11 | `.bak-superuser` belum dihapus (keterangan Arif); rahasia ada di environment proses; belum diketahui apakah nilai diganti saat dipindah; rotasi belum diuji | `secrets.md` bagian 3 dan 5 | Hapus `.bak` (tercatat harus dihapus); rotasi sekali sebelum v1.0; paparan environment: status penerimaan tidak tercatat |
| R-12 | Salinan "offsite" dan kunci privat age di laptop yang sama dengan host VM | Belum ada lokasi terpisah (`backup-restore.md` 1, 8) | Rencana (usulan): salinan dan kunci di media terpisah |
| R-12 | Cadangan oleh timer terbukti gagal dua kali (bukti 11); rotasi 14 hari dan pulih produksi belum teruji; RTO belum terukur (2 detik untuk 61 KB bukan RTO) | `backup-restore.md` 6, 7; `bukti/11-timer-backup-gagal.txt` | Perbaikan: `tabletop-report.md` bagian 5 butir 1 (sebagian: tunggu database siap teruji di `bukti/13-timer-backup-diperbaiki.txt`; pemantauan kegagalan unit belum dikerjakan); target RTO ditetapkan di Tugas 10 sesudah pengukuran |
| R-12 | Salinan offsite tidak dipangkas otomatis | Data sintetis dan kecil | Diterima (`backup-restore.md` 4) |
| R-08 | `effect` HIGH di image v0.3; jalur tak langsung belum ditelusuri | Pindai sesudah perbaikan tidak ada di bukti | Register: Mitigate; rencana (usulan): naikkan versi lalu pindai ulang |
| R-15 | Trivy: Alloy HIGH 15, Grafana HIGH 20, CRITICAL 0; relevansi tiap temuan belum terbukti | Residu image yang dipakai | Diterima (`monitoring/README.md`) |
| R-15 | Ambang D-1, D-2 tanpa baseline; D-3 dari satu pengukuran; D-3 benign tidak dijalankan; tanpa uji batas ambang | `alerts-analysis.md` | Rencana (usulan): ukur baseline, jalankan D-3 benign |
| R-14, R-09 | D-1 tidak mencakup endpoint kirim OTP; D-3 bisa dilewati scan lambat, bucket log UFW dipakai bersama, port Docker tidak dicatat (dampak dua terakhir belum diuji) | Batas desain rule | Alasan belum ditutup dan rencana: tidak tercatat |
| R-15, R-03 | D-2 menghitung 404 data yang memang tidak ada dan tidak menghitung 307; annotation `{{ .Labels.* }}` belum diverifikasi | `alerts-analysis.md` | Rencana (usulan): verifikasi annotation; alasan 307 tidak tercatat |
| R-15 | Tanpa kanal notifikasi eksternal | Keputusan Arif; bukti hanya status Firing | Keputusan: tidak dibuat di rilis ini |
| R-14 | Penyerang dengan banyak IP tidak terhambat | Pembatas per IP (`firewall-rules.md` 4) | Rencana tidak tercatat |
| R-09 | IPv6 belum diuji; aturan 80/443 masih /24 | `firewall-rules.md` 4 | Rencana (usulan): uji IPv6, persempit sumber |
| R-10 | HSTS tanpa bukti uji; cookie Secure tidak ada di bukti; kunci server tanpa passphrase | Bukti hanya mencakup TLS; kunci dilindungi izin berkas | Rencana (usulan): rekam header HSTS dan atribut cookie |
| R-01 | Batas muatan dan laju umum belum dibuktikan dengan uji | Tidak ada uji di bukti yang dibaca | Rencana (usulan): uji muatan di atas 11 MB |

## 4. Kesimpulan

Menurut bukti, yang paling jelas membaik adalah pembatasan jaringan dan TLS, penutupan bypass pembatas laju lewat XFF palsu, hak peran DB aplikasi, cadangan terenkripsi yang dapat dipulihkan ke container sementara, dan tiga simulasi serangan yang mencapai Firing. Dengan usulan ini, skor turun pada T-12, T-15, T-17, T-21, T-23, T-25, dan T-27, tetapi hanya T-12, T-25, dan T-27 yang turun sampai level di bawah High. Yang belum selesai mencakup R-01 (skor tertinggi, hanya konfigurasi), superuser pada `tools`, cadangan dan kuncinya yang bergantung pada satu laptop, pemulihan produksi dan RTO, temuan HIGH yang tersisa, serta deteksi tanpa baseline dan notifikasi.
