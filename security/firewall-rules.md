# Firewall, Segmentasi, dan TLS (Kyrion staging, sec-0.3 Bagian A1)

Tanggal: 2026-11-22. Basis commit: b600ecf (cabang sec-0.3/tahap-3, pra-tag sec-0.3).
Lingkup: VM kyrion-staging (Ubuntu 24.04, host-only 192.168.56.101). Data sintetis.
Risiko terkait di risk-register.md: R-09 (T-23), R-10 (T-15), R-14 (T-11 sampai T-13).

## 1. Zona dan segmentasi

| Zona | Wujud | Aturan akses |
|---|---|---|
| Luar VM (laptop admin 192.168.56.1) | NIC host-only enp0s8 | SSH hanya dari 192.168.56.1; 80 dan 443 dari 192.168.56.0/24 |
| NAT VM | NIC enp0s3 | Tidak ada trafik masuk yang diizinkan ke container (DROP di DOCKER-USER) |
| Docker network frontend | nginx, app | Satu-satunya jalur masuk dari luar adalah Nginx |
| Docker network backend (internal) | app, db | Tidak punya rute keluar; db tanpa port yang dipublikasikan |

Port aplikasi 3000 dan PostgreSQL 5432 tidak dipublikasikan ke host (compose.vm.yaml: service app tanpa ports, db tanpa ports). Satu-satunya port yang dipublikasikan adalah 80 dan 443 milik Nginx.

## 2. Kontrol

### 2.1 Firewall host (UFW)
Daftar aturan efektif lengkap ada di security/bukti/firewall-konfigurasi.txt (diambil dari VM). Dokumen ini tidak menyalinnya agar tidak berbeda dari sumber.

Intisari yang sudah dicocokkan dengan berkas itu (2026-11-22): kebijakan default deny (incoming), allow (outgoing), deny (routed); satu aturan masuk, 22/tcp pada enp0s8 hanya dari 192.168.56.1 (komentar SSH-admin-laptop). Port 80 dan 443 tidak diatur di UFW karena trafiknya melewati DOCKER-USER (bagian 2.2).

### 2.2 Pembatas port Docker (R-09, T-23)
Port yang dipublikasikan Docker melewati chain INPUT (DNAT ke FORWARD), sehingga UFW biasa tidak membatasinya. Pembatas dipasang di chain DOCKER-USER (deploy/ufw/docker-user.rules, ditambahkan ke /etc/ufw/after.rules). Aturan permanen:

    -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
    -A DOCKER-USER -s 192.168.56.0/24 -i enp0s8 -p tcp -m conntrack --ctorigdstport 80 -j RETURN
    -A DOCKER-USER -s 192.168.56.0/24 -i enp0s8 -p tcp -m conntrack --ctorigdstport 443 -j RETURN
    -A DOCKER-USER -i enp0s8 -j DROP
    -A DOCKER-USER -i enp0s3 -j DROP
    -A DOCKER-USER -j RETURN

Alasan: ESTABLISHED/RELATED lebih dulu agar egress container tidak putus. Port dicocokkan dengan --ctorigdstport (port asli sebelum DNAT) karena di dalam container Nginx mendengar 8080/8443. Hanya trafik yang masuk lewat NIC fisik yang dibatasi, sehingga trafik antarcontainer tidak terganggu.

### 2.3 Nginx reverse proxy dan TLS (R-10, T-15)
Berkas: deploy/nginx/kyrion.conf; deployment: compose.vm.yaml (image nginx-unprivileged, read_only, cap_drop ALL, no-new-privileges).
- TLS 1.2 dan 1.3 saja; cipher ECDHE-ECDSA (AES-GCM, ChaCha20); session tickets mati.
- Sertifikat ECDSA P-256 dari CA lokal di laptop (kunci CA tidak pernah di server, berada di luar repo). Kunci server dibuat di VM, mode 400, milik uid 101.
- HSTS max-age=300 tanpa includeSubDomains dan preload (nilai kecil sengaja, ini lingkungan uji).
- Server default menolak handshake untuk host selain kyrion.test; port 80 hanya mengalihkan (301) ke HTTPS.
- server_tokens off: versi Nginx tidak ditampilkan.

### 2.4 Header proxy dan pembatasan laju (R-14, T-11 sampai T-13)
- X-Forwarded-For ditimpa dengan $remote_addr, sehingga klien tidak bisa memalsukan alamat yang dipakai pembatas laju Better Auth.
- limit_req: zona umum 20 r/s (burst 40) dan zona OTP 10 r/menit (burst 5) untuk dua endpoint OTP; status 429. client_max_body_size 11m.

## 3. Bukti

| Klaim | Berkas bukti | Kekuatan |
|---|---|---|
| 3000 dan 5432 tidak terlihat dari laptop | security/scan-before.txt (22 port terbuka) vs security/scan-after.txt (22, 80, 443 terbuka; sisanya filtered) | Uji negatif |
| Aturan UFW dan DOCKER-USER aktif | security/bukti/firewall-konfigurasi.txt | Konfigurasi efektif |
| DOCKER-USER benar-benar memblokir 443 lalu pulih; port 80 tetap hidup sebagai kontrol | security/bukti/uji-docker-user-negatif.txt | Uji negatif |
| TLS 1.3 dan 1.2 diterima, TLS 1.1 dan 1.0 ditolak | security/tls-check.txt | Uji negatif |
| Pembatasan laju dua lapis | security/bukti/uji-rate-limit.txt (percobaan 1-3 status 400, 4-6 429 JSON dari aplikasi, 7-10 429 HTML dari Nginx) | Uji negatif |
| Akses via IP tanpa nama host ditolak | security/bukti/uji-akses-via-ip.txt (handshake ditolak, kode 000) | Uji negatif |

Catatan arsip: security/bukti/scan-before-awal-filtered.txt dan diagnosis-filtered.txt menjelaskan mengapa scan awal melaporkan filtered (artefak timing klien Windows), dan mengapa opsi --min-rtt-timeout 3s --max-retries 1 dipakai.

## 4. Residual (belum ditutup)
- Pembatasan laju per alamat IP: penyerang dengan banyak alamat tidak terhambat.
- IPv6: docker-proxy mendengar di [::]:80 dan [::]:443; belum diuji apakah DOCKER-USER (IPv4) membatasinya.
- Aturan 80/443 di DOCKER-USER masih memakai subnet /24, tidak hanya 192.168.56.1.
- Kunci server TLS tanpa passphrase; perlindungannya izin berkas (uid 101, mode 400).
- Uji negatif DOCKER-USER: pada percobaan pertama pemulihan terlambat karena AccuracySec timer systemd-run (dugaan, tidak diukur); lihat bagian 3 dan 4 berkas buktinya.

## 5. Uji ulang (dari laptop)
1. Scan: nmap -sT -p- --min-rtt-timeout 3s --max-retries 1 192.168.56.101 (harapan: hanya 22, 80, 443 terbuka).
2. TLS: perintah persis ada di security/tls-check.txt.
3. HTTPS: curl.exe -sS -o NUL -w "%{http_code}" --ssl-no-revoke https://kyrion.test/masuk (harapan 200); HTTP ke port 80 harus 301.