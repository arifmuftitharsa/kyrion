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

- **SSH** (config/00-hardening.conf, bukti nilai efektif di bukti/sshd-T-final.txt): `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes`, `AllowUsers arif`, `MaxAuthTries 3`, `LoginGraceTime 30`, `X11Forwarding no`, `PermitEmptyPasswords no`, `AllowTcpForwarding local`.
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
| AUTH-9229, AUTH-9230, AUTH-9262, AUTH-9282, AUTH-9286 | Kebijakan hash, kekuatan, dan umur kata sandi akun | Tidak diterapkan; hanya satu akun dan login jarak jauh memakai kunci. Kata sandi akun masih dipakai untuk `sudo`, sehingga ini tetap sisa risiko rendah. |
| FILE-6310 | Partisi terpisah untuk /home, /tmp, /var | Tidak diterapkan; partisi harus ditentukan saat instalasi dan VM staging ini memakai satu disk. |
| NAME-4028 | Domain DNS | Tidak relevan pada jaringan host-only. |
| NETW-3200 | Protokol dccp, sctp, rds, tipc | Sebagian modul sudah diblokir (config/kyrion-disable-modules.conf). Mengapa Lynis tetap menampilkannya belum diperiksa. |
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
- Wording tugas "port app dan db tidak dipublikasikan": db memang tidak mempublikasikan port apa pun; app terikat ke `127.0.0.1:3000` di VM dan dibuka dari laptop lewat SSH tunnel. Apakah ini memenuhi syarat sedang ditanyakan ke dosen; bila tidak, cadangannya adalah menghapus `ports:` dan membuka aplikasi lewat tunnel ke alamat container.
- VM sesekali mengalami henti sementara dari sisi host (log kernel menunjukkan soft lockup pada keempat vCPU) yang memutus koneksi SSH; penyebabnya belum dipastikan.
- Kunci induk HMAC juga memiliki salinan di laptop pengembangan; lokasinya belum dicatat di dokumen ini.
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