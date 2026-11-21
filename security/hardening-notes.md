# Catatan Hardening (sec-0.2)

Catatan keputusan, bukti, dan keterbatasan untuk hardening VM staging dan container Kyrion. Setiap kontrol merujuk risiko di `risk-register.md` (R-03, R-04, R-06, R-07, R-08).

## 1. Ringkasan hasil

| Kontrol | Sebelum | Sesudah | Bukti | Risiko |
|---------|---------|---------|-------|--------|
| Indeks hardening Lynis | 63 | 77 (syarat tugas: minimal 70) | lynis-before.txt, lynis-after.txt | R-07 |
| Saran Lynis | 47 | 34 | lynis-before.txt, lynis-after.txt | R-07 |
| Peringatan Lynis | 1 | 1 (FIRE-4512, lihat bagian 6) | lynis-before.txt, lynis-after.txt | R-07 |
| Temuan image di lapisan OS (HIGH/CRITICAL) | 472 (452 HIGH, 20 CRITICAL), image naif Debian 12.15 | 0, image hardened Alpine 3.24.3 | image-scan-before.txt, image-scan-after.txt | R-08 |
| SBOM image yang berjalan | tidak ada | CycloneDX 1.6, 211 komponen library | sbom.cdx.json | R-08 |
| Login SSH | lihat sshd-T-before.txt | hanya kunci publik, root dan kata sandi dimatikan, hanya akun arif | bukti/sshd-T-before.txt, bukti/sshd-T-after.txt, bukti/sshd-T-final.txt | R-07 |
| Proses container app | root (image naif) | UID 10001, rootfs read-only, semua kapabilitas dilepas, no-new-privileges | bukti/container-hardening.txt | R-07 |
| Port basis data | milik compose pengembangan di laptop | tidak ada port ke host, jaringan backend internal | bukti/container-hardening.txt, bukti/access-port-laptop.txt | R-07 |
| Penyimpanan kata sandi | lihat access-tests.md | hash scrypt N=65536, r=8, p=2 | bukti/hash-kata-sandi.txt | R-06 |
| Kontrol akses per peran | - | 12 uji positif dan 12 uji negatif lolos | access-tests.md | R-03 |

## 2. Lingkungan

- VM: Ubuntu Server 24.04 LTS di VirtualBox (laptop Windows 11), dua antarmuka jaringan (NAT dan host-only, alamat host-only 192.168.56.101). VM ini adalah server staging Kyrion, bukan VM latihan.
- Docker Engine dari repositori resmi Docker, aplikasi dijalankan lewat `compose.vm.yaml` (berkas terpisah dari `compose.yaml` pengembangan, yang tidak diubah).
- Akun harian `arif` tidak dimasukkan ke grup docker; perintah Docker dijalankan dengan `sudo docker`, karena keanggotaan grup docker setara dengan akses root.
- Lingkungan uji hanya VM dan container milik sendiri, dengan data sintetis.

## 3. Hardening VM

- **SSH** (config/00-hardening.conf; nilai efektif di bukti/sshd-T-final.txt, daftar lengkap di bukti/sshd-T-after.txt): `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes`, `AllowUsers arif`, `MaxAuthTries 3`, `LoginGraceTime 30`, `X11Forwarding no`, `PermitEmptyPasswords no`, `AllowTcpForwarding local`, ditambah `AllowAgentForwarding no`, `LogLevel VERBOSE`, `ClientAliveInterval 300`, `ClientAliveCountMax 2`, `MaxSessions 2`, `TCPKeepAlive no`, dan `Banner /etc/issue.net`.
- `AllowTcpForwarding local` sengaja dipertahankan karena aplikasi dibuka dari laptop lewat SSH tunnel (`-L`); forwarding lain tidak diizinkan.
- Berkas drop-in diberi awalan `00-` karena pada sshd nilai pertama yang terbaca yang menang, sehingga berkas ini mengalahkan `50-cloud-init.conf`. Karena itu bukti yang dipakai adalah `sshd -T` (konfigurasi efektif), bukan isi berkas konfigurasi saja.
- **Sysctl** (config/99-zz-kyrion-hardening.conf): antara lain `kernel.kptr_restrict = 2`, `kernel.sysrq = 0`, `fs.suid_dumpable = 0`, `fs.protected_fifos = 2`, `net.ipv4.conf.all.rp_filter = 1`. Berkas dinamai `99-zz-` agar dibaca terakhir; sebelumnya `fs.protected_fifos` tetap 1 karena berkas lain (`99-protect-links.conf`) menang, dan `fs.suid_dumpable` kembali ke 2 setelah reboot karena apport.
- **Apport dinonaktifkan** dan core dump dimatikan (config/99-no-core.conf), karena apport menimpa `fs.suid_dumpable`.
- **Modul kernel** tertentu diblokir dengan `install <modul> /bin/false` (config/kyrion-disable-modules.conf).
- **umask 027** diterapkan; efek sampingnya, berkas yang dibuat menjadi 660 milik root dan arsip harus diekstrak dengan `tar -p` agar izin tidak berubah. Ini sempat menyebabkan galat `EACCES` pada build image dan sudah diperbaiki dengan mengekstrak ulang konteks build.
- **Bukti "sebelum"** (lynis-before.txt, sshd-T-before.txt) diambil sebelum konfigurasi diubah.

## 4. Hardening container

Definisi di `compose.vm.yaml` dan `apps/web/Dockerfile`; bukti pada image yang sedang berjalan di bukti/container-hardening.txt.

- **app:** UID/GID 10001, `read_only: true` (hanya `/tmp`, `/app/.next/cache`, dan volume `kyrion-storage` yang dapat ditulis), `cap_drop: ALL`, `no-new-privileges`, port hanya `127.0.0.1:3000`, kunci induk HMAC masuk lewat `secrets` (hanya-baca), bukan lewat image atau repositori. Uji tulis membuktikan `/app` ditolak (`Read-only file system`) sedangkan `storage` bisa ditulis. `CapEff` dan `CapBnd` bernilai nol.
- **db:** PostgreSQL 18.6, tidak ada port yang dipublikasikan ke host, hanya berada di jaringan `backend` yang bersifat `internal`. `cap_drop: ALL` dengan lima kapabilitas ditambahkan kembali (CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID) karena entrypoint resmi PostgreSQL memulai sebagai root lalu menurunkan hak ke pengguna `postgres`. **Karena itu db tidak read-only dan tidak berjalan non-root sejak awal.** Klaim yang benar untuk db adalah: kapabilitas dibatasi dan `no-new-privileges`.
- Image dibangun multi-stage; `npm`, `npx`, dan `corepack` dihapus dari image runtime. Yarn bawaan image dasar masih ada (`opt/yarn-v1.22.22`); pemindaian tidak menemukan kerentanan padanya.
- Image dasar dipin dengan digest (bukan hanya tag).
- UID 10001 dipilih agar berbeda dari UID 1000 milik akun `arif` di host.

## 5. Pemindaian image dan SBOM

- Alat: Trivy 0.69.3, pemindai `vuln`, filter HIGH dan CRITICAL.
- **Sebelum:** `kyrion-web:naif`, dibangun dari `security/Dockerfile.naif` (`FROM node:24`, Debian 12.15): 472 temuan di lapisan OS, 452 HIGH dan 20 CRITICAL.
- **Sesudah:** `kyrion-web:hardened` (Alpine 3.24.3), image ID `sha256:cbb9946bce20c20db24d45fafc9bac2181b4843f002f2d7e713b4e66cfc25d40`: 0 temuan, termasuk seluruh paket Node. ID yang sama terbukti dipakai container `app` yang berjalan.
- Image `hardened` dibangun ulang setelah pemindaian pertama, sehingga pemindaian "sesudah" dan SBOM diambil ulang untuk image yang benar-benar berjalan (berkas yang lama tidak dipakai).
- SBOM: CycloneDX 1.6, 211 komponen bertipe library, dibuat dari image yang sama.
- Pesan `This OS version is not on the EOL list` untuk Alpine 3.24 muncul karena versi Trivy ini belum mengenal rilis itu; deteksi kerentanan Alpine tetap berjalan pada pemindaian yang sama.
- `DATABASE_URL=postgresql://build:build@localhost:5432/build` di `Dockerfile.naif` adalah nilai tiruan untuk fase build, bukan kredensial.

## 6. Saran Lynis yang tidak dikerjakan

Peringatan tersisa: **FIRE-4512** (modul iptables dimuat tetapi belum ada aturan aktif). Tidak ditindaklanjuti di sec-0.2. Jalur masuk jaringan dibatasi dengan cara lain: hanya port 22 yang terbuka dari luar VM (bukti/access-port-laptop.txt) dan aplikasi terikat ke 127.0.0.1. Firewall host menjadi kandidat untuk keamanan jaringan di sec-0.3.

| Kode Lynis | Saran | Keputusan dan alasan |
|------------|-------|----------------------|
| LYNIS | Rilis Lynis lebih dari 4 bulan | Tidak diubah; ini soal alat audit, bukan konfigurasi sistem. |
| DEB-0280, DEB-0810, DEB-0811 | libpam-tmpdir, apt-listbugs, apt-listchanges | Tidak dipasang; kemudahan administrasi, bukan pengurangan risiko jalur utama, dan menambah paket. |
| DEB-0880 | fail2ban | Tidak dipasang; login kata sandi sudah dimatikan dan `MaxAuthTries` 3, sehingga tebakan kata sandi via SSH tidak berlaku; komponen tambahan dihindari. |
| BOOT-5122 | Kata sandi GRUB | Tidak diterapkan; akses fisik atau konsol VirtualBox berada di luar model ancaman staging ini, dan mengunci GRUB berisiko mengunci diri sendiri. |
| BOOT-5264 | Hardening layanan sistemd | Belum dikerjakan; dapat menjadi pekerjaan lanjutan. |
| AUTH-9229, AUTH-9230 | Putaran hash kata sandi di PAM dan /etc/login.defs | Tidak diubah; kata sandi akun sudah di-hash dengan yescrypt bawaan Ubuntu dan login jarak jauh tidak memakai kata sandi. |
| AUTH-9262, AUTH-9282, AUTH-9286 | Modul kekuatan kata sandi, tanggal kedaluwarsa, umur minimum dan maksimum kata sandi | Tidak diterapkan; rotasi paksa berkala tidak dianjurkan oleh NIST SP 800-63B, hanya ada satu akun, dan login jarak jauh memakai kunci. Kata sandi akun masih dipakai untuk `sudo`, sehingga ini tetap sisa risiko rendah. |
| FILE-6310 | Partisi terpisah untuk /home, /tmp, /var | Tidak diterapkan; partisi harus ditentukan saat instalasi dan VM staging ini memakai satu disk. |
| NAME-4028 | Domain DNS | Tidak relevan pada jaringan host-only. |
| NETW-3200 | Protokol dccp, sctp, rds, tipc | Modul-modul itu sudah diblokir lewat config/kyrion-disable-modules.conf; `modprobe -n -v` menghasilkan `install /bin/false` (bukti/os-hardening-after.txt). Lynis 3.0.9 tetap menampilkan saran ini; penyebabnya (kemungkinan cara pemeriksaannya) belum diverifikasi. |
| SSH-7408 (dua butir) | Saran hardening SSH tambahan | Dua butir masih tersisa; rinciannya ada pada bagian detail lynis-after.txt dan belum ditinjau satu per satu. |
| LOGG-2154 | Log ke host eksternal | Ditunda ke sec-0.3 bagian B (log terpusat). |
| BANN-7126, BANN-7130 | Banner hukum di /etc/issue dan /etc/issue.net | Banner peringatan sudah tampil saat login SSH; mengapa Lynis tetap menyarankannya belum diperiksa. |
| ACCT-9622, ACCT-9626, ACCT-9628 | Process accounting, sysstat, auditd | Ditunda ke sec-0.3 bagian B (logging dan deteksi). |
| FINT-4350 | Alat integritas berkas | Ditunda; kandidat untuk sec-0.3. |
| TOOL-5002 | Alat otomasi sistem | Tidak relevan. |
| FILE-7524 | Pembatasan izin berkas | Belum ditinjau satu per satu. |
| KRNL-6000 | Nilai sysctl berbeda dari profil | Satu nilai berbeda: `kernel.modules_disabled` (harapan 1). Tidak diterapkan karena nilai 1 melarang pemuatan modul kernel baru sampai reboot, yang berisiko bagi Docker. |
| HRDN-7230 | Pemindai malware | Tidak dipasang; server staging berdata sintetis, dan deteksi menjadi cakupan sec-0.3. |

## 7. Keterbatasan dan sisa risiko

- Sesi admin disimpan di memori proses aplikasi: hilang saat restart (terbukti di access-tests.md, D-N3) dan tidak dibagi antar instance.
- Belum ada pembatasan laju percobaan masuk. R-04 (T-02) hanya terpenuhi sebagian: hash lambat (R-06) sudah ada, rate limiting belum.
- Header halaman masih menampilkan menu admin selama cookie ada walaupun sesi sudah tidak valid; hanya tampilan, aksi dan halaman admin tetap ditolak.
- Kata sandi basis data dibaca aplikasi lewat variabel lingkungan `DATABASE_URL`, sehingga nilainya terlihat bagi siapa pun yang dapat menjalankan `docker inspect` (yaitu root atau pengguna sudo di VM).
- Keputusan port: wording tugas "port app dan db tidak dipublikasikan" dipenuhi seperti ini: db tidak mempublikasikan port apa pun, sedangkan app hanya dipublikasikan ke loopback VM (`127.0.0.1:3000`) sehingga tidak dapat dijangkau dari luar VM (terbukti: port 3000 pada alamat VM tertutup dari laptop, bukti/access-port-laptop.txt) dan dibuka dari laptop lewat SSH tunnel. Pola loopback sengaja dipertahankan karena merupakan pola standar untuk server di belakang reverse proxy. Jika dibaca lebih ketat (tidak ada `ports:` sama sekali), cadangannya adalah menghapus `ports:` dan membuka aplikasi lewat tunnel ke alamat container. Pada sec-0.3 (TLS dan jaringan) direncanakan reverse proxy menjadi satu-satunya pintu masuk dan `ports:` pada app dihapus.
- VM sesekali mengalami henti sementara dari sisi host (log kernel menunjukkan soft lockup pada keempat vCPU) yang memutus koneksi SSH; penyebabnya belum dipastikan.
- Kunci induk HMAC di VM dibuat khusus di VM (bukan salinan kunci laptop) dan dimiliki UID 10001 dengan izin 0400. Kunci pengembangan di laptop adalah kunci yang berbeda; lokasi berkas kunci laptop belum dicatat di dokumen ini.
- Tahap `tools` pada Dockerfile (dipakai untuk migrasi dan seed) belum memiliki `ENV PATH` permanen; saat ini dijalankan dengan `-e PATH=...`. Perbaikan permanen ditunda.
- Mode `standalone` pada Next.js ditunda ke pekerjaan PAW.

## 8. Keaslian unduhan dan rantai pasok

- ISO Ubuntu: diverifikasi dengan checksum SHA-256, yang membuktikan keutuhan berkas, bukan keasliannya; verifikasi tanda tangan GPG tidak dilakukan.
- Kunci GPG repositori Docker: sidik jari kunci belum dikonfirmasi terhadap sumber resmi.
- Trivy 0.69.3: versi diperiksa terhadap advisory GHSA-69fq-xp46-6x23; berkas unduhan hanya diverifikasi dengan checksum (keutuhan), tanda tangan cosign tidak diverifikasi. Versi ini tidak dinaikkan tanpa verifikasi ulang.

## 9. Ditunda

- Rate limiting login, firewall host, auditd dan log terpusat, serta alat integritas berkas: cakupan sec-0.3 atau sesudahnya.
- Penyesuaian header agar konsisten dengan status sesi (lihat bagian 7).

## 10. Peta bukti

Semua berkas ada di folder `security/`.

- Lynis: lynis-before.txt, lynis-after.txt, bukti/os-hardening-after.txt
- SSH: bukti/sshd-T-before.txt, bukti/sshd-T-after.txt, bukti/sshd-T-final.txt, config/00-hardening.conf
- Sysctl dan modul: config/99-zz-kyrion-hardening.conf, config/99-no-core.conf, config/kyrion-disable-modules.conf
- Container dan port: bukti/container-hardening.txt, bukti/access-port-laptop.txt
- Image: image-scan-before.txt, image-scan-after.txt, sbom.cdx.json, Dockerfile.naif
- Akses dan kata sandi: access-tests.md, bukti/access-*.txt, bukti/server-action-guard.txt, bukti/hash-kata-sandi.txt, img/

## 11. Tahap 0 sec-0.3: VM ke v0.3

Bukti: `bukti/v0.3-deploy-vm.txt`. Butir diamati Arif di VM atau lewat peramban dan tunnel SSH; yang bersumber dari luar VM ditandai. Berkas bukti tersimpan hanya untuk keadaan akhir VM dan uji penolakan `--out`. Login OTP, `pg_dump`, seed, dan uji pengesahan diamati langsung tanpa berkas bukti; tangkapan layarnya belum disimpan di `img/`.

- **Sumber kode:** arsip commit `1e5a8d9` (branch `sec-0.3/tahap-0`; commit sebelumnya `dd711cc`). Snapshot VM "pra-sec-0.3" dibuat sebelum perubahan. Arsip harus diekstrak dengan `tar -p`: tanpa `-p`, berkas hasil ekstrak berizin 660 (diamati: `-rw-rw----`). Pada sec-0.2 kondisi serupa sempat menyebabkan `EACCES` saat build (lihat catatan umask di bagian awal berkas ini); dengan `-p` berkas 664.
- **`compose.vm.yaml`:** 8 variabel baru di `app` (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `EMAIL_ADAPTER`, `EMAIL_FROM`, `MAILTRAP_API_TOKEN`, `MAILTRAP_SANDBOX_ID`, `KYRION_SIGNING_KEY_FILE`, `KYRION_KEYRING_FILE`), semuanya lewat `environment`. **Nilainya diperkirakan terlihat di `docker inspect` (belum dibuktikan; dibuktikan di tahap 2)**; ini kondisi "sebelum" untuk risiko rahasia dan diperbaiki di tahap 3. Volume `/srv/kyrion/keys:/keys:ro` untuk `app` dan baca-tulis untuk `tools`; folder host `/srv/kyrion/keys` milik 10001, mode 0700.
- **Dockerfile tahap `tools`:** kini `FROM ${NODE_IMAGE}` lalu `COPY --from=build /app` (bukan `FROM build`). Ukuran `kyrion-web:tools` 1,91 GB menjadi 1,4 GB; `kyrion-web:hardened` 1,14 GB menjadi 1,25 GB. `tools` bekerja di `/opt/kyrion/apps/web`.
- **Penyiasatan `.git`:** `/opt/kyrion/.git` adalah folder kosong yang hanya menjadi PENANDA akar, bukan repository sungguhan, karena `prisma/kelola-kunci.ts` menghitung akar = `cwd/../..` dan mensyaratkan `.git`. Maksud cek (kunci di luar repository) tetap terpenuhi selama kunci di-mount di `/keys`. Kode kriptografi (krip-0.3) tidak diubah; mengubah `kelola-kunci.ts` dicatat sebagai utang untuk Kriptografi setelah krip-0.3 dikumpulkan.
- **Dockerfile tahap `build`:** `BETTER_AUTH_SECRET` dan `BETTER_AUTH_URL` bernilai tiruan hanya pada perintah `npm run build` (bukan `ENV`/`ARG`), karena `next build` mem-prerender `/_not-found` dan `lib/auth/konfigurasi.ts` memvalidasi kedua variabel (galat `GalatKonfigurasiAuth` saat build tanpa nilai). Pencarian kata `build-only-dummy` di `.next` image `tools` dan di `/app` image `hardened`: tidak ditemukan (exit=1). Temuan untuk PAW: Dockerfile yang sama dipakai deployment pekan 14.
- **Migrasi:** 4 migrasi baru diterapkan (`20261113031249_audit_dan_pengesahan`, `20261113083954_better_auth_tabel_inti`, `20261113154720_hapus_password_hash`, `20261115093400_tanda_tangan_dan_kunci`); status akhir "Database schema is up to date!". Sebelum migrasi: `pg_dump` (`kyrion-pra-sec-0.3.dump`, 14455 byte, sha256 `7ac2768046cfc690f918d7d5dc3f787bcb4046934dbc99b8b0cd8677ad4a1ca2`, 46 entri) dan hitung backfill `integrity_tag` = 0.
- **Seed:** baris `ADMIN_SEED_PASSWORD` dihapus dari `seed.env` VM (tidak dibaca seed v0.3); seed idempoten (users = 1, versions = 8, tidak berubah).
- **Kunci penandatangan:** id `5e4349b486e5d53dc7a7ad6dfbbc19cd`, status aktif; `kunci-1.pem` dan `keyring.json` mode 0600 milik 10001.
- **Uji:**
  - Login OTP lewat Mailtrap sandbox berhasil; login dengan alamat kampus yang belum terdaftar otomatis membuat akun SIVITAS (users 1 menjadi 2).
  - Negatif: `kelola-kunci.ts buat --out /opt/kyrion/x.pem` ditolak, "Operasi kunci gagal: --out berada di dalam repository.", exit=1, berkas tidak terbentuk, `signing_keys` tetap 1.
  - Pengesahan versi 2028/2029 (PDF sintetis 630 B) berhasil; Periksa Berkas menampilkan "Hasil: Asli dan sah".
  - Dengan izin `kunci-1.pem` 0644, pengesahan versi 2029/2030 ditolak: "Pengesahan tidak dapat dilakukan: kunci penandatangan belum siap; hubungi operator."; setelah kembali 0600, pengesahan versi yang sama berhasil.
- **Pengamatan:** log stdout aplikasi kosong saat penolakan pengesahan, jadi tidak ada jejak untuk deteksi; sumber deteksi Bagian B harus `audit_logs` atau log Nginx. Dua versi berbeda boleh memakai PDF yang sama persis (belum diperiksa apakah disengaja). Kuota Mailtrap gratis 50 email uji per bulan (sumber: halaman harga Mailtrap, dibaca 2026-11-21; belum dicek di akun Arif). Disk VM 77% (8,6 GB bebas) setelah build.
- **Data uji tambahan** di Pedoman Akademik: versi 2028/2029 dan 2029/2030 (sintetis, Sah).
