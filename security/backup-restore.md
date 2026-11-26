# Backup dan Pemulihan Kyrion (sec-0.3 Bagian A2; R-12, T-20, T-26)

| | |
|---|---|
| Tanggal (UTC) | 2026-11-22 |
| Hash commit | f079344 (`git rev-parse --short HEAD`); bukti diambil di commit 8460d22 |
| Perintah | `.\deploy\uji\03-backup.ps1` (ssh -t kyrion-staging sudo bash 03-backup-vm.sh pasang \| restore; deploy\backup\offsite.ps1); `git rev-parse --short HEAD` |
| Berkas bukti ditemukan | [security/bukti/03-backup.txt](security/bukti/03-backup.txt) (pasang=0, offsite=0, restore=0) dan [security/bukti/03-backup-percobaan-1.txt](security/bukti/03-backup-percobaan-1.txt) (offsite gagal karena bug pengecekan jalur di offsite.ps1, sudah diperbaiki). Tidak ada berkas dengan "restore" di nama; log uji pemulihan ada di bagian "FASE RESTORE" pada 03-backup.txt. |
| Sumber | deploy/backup/backup.sh, restore-test.sh, kyrion-backup.service, kyrion-backup.timer, offsite.ps1, deploy/uji/03-backup.ps1, security/data-classification.md, security/risk-register.md |

Keterangan bertanda **(keterangan Arif)** berasal dari laporan Arif, bukan dari berkas bukti. Skala bukti: konfigurasi < konfigurasi efektif < uji negatif < bukti operasional. Tidak ada angka RTO yang ditulis di sini (bagian 7).

## 1. Strategi: pemetaan 3-2-1 apa adanya

| Syarat | Keadaan | Terpenuhi? |
|--------|---------|------------|
| 3 salinan | (1) data hidup di VM; (2) cadangan terenkripsi di /srv/kyrion/backup (2 berkas pada 22 Nov); (3) satu salinan di laptop, C:\Projects\offsite-kyrion | Ya, jumlahnya |
| 2 media berbeda | Data hidup dan cadangan VM berada di disk yang sama (/dev/sda2, VM). Salinan laptop ada di disk laptop, tetapi disk virtual VM juga ada di laptop yang sama. | Sebagian: berbeda secara logis, satu perangkat fisik |
| 1 salinan di lokasi terpisah | "Offsite" adalah laptop yang sama dengan host VM (keterangan Arif). | **Belum** |

Konsekuensi: satu kejadian pada laptop (hilang, rusak, atau terkena ransomware) dapat menghilangkan data hidup, cadangan VM, salinan offsite, dan kunci privat age sekaligus (bagian 8).

## 2. Cakupan data

Menurut [deploy/backup/backup.sh](deploy/backup/backup.sh), satu arsip (kyrion-backup-<UTC>.tar.age) berisi:

| Komponen | Sumber |
|----------|--------|
| Dump PostgreSQL (`pg_dump -Fc`) | container kyrion-vm-db-1 |
| Hitungan baris per tabel (pembanding uji pulih) | container db |
| Volume Docker PDF versi dan checksum tiap berkas | kyrion-vm_kyrion-storage |
| Folder kunci Ed25519 dan keyring | /srv/kyrion/keys |
| Kunci induk HMAC | /srv/kyrion/secrets/kyrion_master_key |

**Tidak dicakup:** /srv/kyrion/env (kyrion.env, seed.env), rahasia lain di /srv/kyrion/secrets (kyrion_database_url, kyrion_better_auth_secret, kyrion_mailtrap_api_token, kata sandi peran DB), /srv/kyrion/tls (kunci dan sertifikat server), konfigurasi compose di VM, image Docker, log, dan kunci privat age. Rahasia lain dapat dibuat ulang (rotasi) tetapi bukan dipulihkan dari cadangan; ini belum diputuskan.

## 3. Jadwal

kyrion-backup.timer: `OnCalendar=*-*-* 02:00:00 UTC`, `AccuracySec=1s`, `Persistent=yes` (keluaran `systemctl show` di 03-backup.txt; berikutnya Mon 2026-11-23 02:00:00 UTC). Unit service dijalankan sekali lewat systemd pada pengujian (kode keluar 0). Dua cadangan di VM pada 22 Nov dibuat manual lewat unit (10:05:02Z dan 10:07:58Z); **belum ada cadangan yang dibuat oleh timer**. Pemicu timer dan `Persistent` belum teruji.

> **Catatan 2026-11-25** (`bukti/11-timer-backup-gagal.txt`): servis berjalan lagi 2026-11-23T08:22:54Z dan 2026-11-25T06:10:42Z dan gagal (`pg_dump`: the database system is starting up). Timer memicu tetapi belum menghasilkan cadangan; cadangan terbaru tetap 2026-11-22T10:07:58Z.

> **Perbaikan 2026-11-25** (`bukti/13-timer-backup-diperbaiki.txt`): `deploy/backup/backup.sh` kini menunggu `pg_isready` sukses (maksimal 120 detik, gagal tertutup) sebelum dump. Teruji lewat boot dengan jadwal terlewat (cadangan berhasil, tunggu sekitar 1 detik) dan lewat database ditahan 6 detik (`menunggu database siap` 13:30:05, `database siap` 13:30:11, cadangan selesai).

## 3a. Enkripsi dan pengelolaan kunci age

- age 1.1.1 di VM (03-backup.txt). Enkripsi ke penerima publik di deploy/backup/age-recipient.txt (di repo; berisi kunci publik saja, pemeriksaan di backup.sh menolak berkas yang memuat AGE-SECRET-KEY).
- Berkas cadangan berawalan `age-encryption.org/v1` (pemeriksaan `od -c` di 03-backup.txt). Penyusunan arsip terjadi di /dev/shm (tmpfs), sehingga data mentah tidak ditulis ke disk tanpa enkripsi (diturunkan dari kode; tidak ada uji terpisah).
- Kunci privat: di laptop, C:\Projects\kyrion-backup-key\age-key.txt, ACL dibatasi ke akun Arif **(keterangan Arif)**. Kunci dikirim sementara ke /dev/shm VM hanya selama uji pulih lalu dihapus; /dev/shm kosong sesudahnya **(keterangan Arif)**.
- Tidak ada salinan kunci privat di tempat lain: kehilangan kunci berarti semua cadangan tidak dapat dibuka.

## 4. Retensi

- Cadangan di VM: 14 hari (keputusan Arif, security/data-classification.md); `RETENSI_HARI=14` di backup.sh, penghapusan memakai `find -mtime`, dan cadangan terbaru tidak pernah dihapus. **Rotasi belum teruji**: dua cadangan yang ada baru berumur beberapa menit.
- Salinan offsite di laptop: retensi 14 hari hanya berlaku di VM (Keputusan Arif 2026-11-22). offsite.ps1 tidak menghapus apa pun, sehingga salinan offsite tidak dipangkas otomatis dan dibersihkan manual. Alasan diterima: data sintetis dan kecil. Dicatat sebagai residual (bagian 8, butir 9); tidak ada kode penghapusan yang ditambahkan.

## 5. Prosedur pemulihan langkah demi langkah

Status: langkah 1 sampai 4 dan pemulihan dump ke container sementara (langkah 5, versi uji) **teruji** oleh restore-test.sh. Pemulihan ke produksi (langkah 5 sampai 9 versi produksi) **belum diuji**; disusun dari struktur arsip dan skrip.

1. Ambil berkas .tar.age dan .sha256 dari /srv/kyrion/backup (VM) atau C:\Projects\offsite-kyrion (laptop).
2. Verifikasi checksum: `sha256sum -c kyrion-backup-<UTC>.tar.age.sha256` (OK pada 03-backup.txt).
3. Dekripsi dan ekstrak: `age -d -i <kunci-privat> <berkas> | tar -xf - -C <folder>`; periksa `sha256sum -c komponen.sha256` (db.dump, storage.tar, keys.tar, kyrion_master_key: OK).
4. Periksa checksum tiap PDF terhadap storage-files.sha256 (2 berkas: OK).
5. **Uji (teruji):** `sudo bash restore-test.sh <kunci> [berkas]` memulihkan db.dump ke container PostgreSQL sementara tanpa jaringan dan membandingkan hitungan baris.
6. **Produksi (belum teruji):** hentikan app dan nginx; pulihkan dump ke database baru dengan `pg_restore`, lalu jalankan deploy/db/roles.sql (idempotent) untuk memulihkan kepemilikan dan hak peran kyrion_ddl dan kyrion_app. Restore-test memakai `--no-owner --no-privileges`, sehingga langkah peran belum terbukti.
7. Pulihkan isi storage.tar ke volume kyrion-vm_kyrion-storage dengan pemilik UID 10001.
8. Pulihkan keys.tar ke /srv/kyrion/keys (folder 0700, berkas 0600, UID 10001) dan kyrion_master_key ke /srv/kyrion/secrets (0400, UID 10001).
9. Jalankan app dan nginx; verifikasi: login OTP, unduh dan verifikasi satu PDF, hitungan baris.

## 6. Hasil uji pemulihan

Sumber: bagian "FASE RESTORE (VM)" di 03-backup.txt.

| Item | Hasil |
|------|-------|
| Berkas diuji | kyrion-backup-20261122T100758Z.tar.age (61.640 byte) |
| Mulai (UTC) | 2026-11-22T10:08:29Z |
| Selesai (UTC) | 2026-11-22T10:08:31Z |
| Durasi (log) | 2 detik |
| Checksum berkas terenkripsi | LULUS |
| Dekripsi age dan ekstraksi | LULUS |
| Checksum komponen (db.dump, storage.tar, keys.tar, kunci induk) | LULUS |
| Checksum 2 berkas PDF di storage | LULUS (sama dengan saat backup) |
| pg_restore ke container sementara | LULUS tanpa galat |
| Hitungan baris per tabel | LULUS, sama dengan saat backup: _prisma_migrations 10, accounts 0, audit_logs 4, categories 2, changes 6, regulations 4, sessions 2, signing_keys 1, users 2, verifications 0, versions 10 |
| Pembersihan | container sisa 0, folder kerja tidak ada |
| Offsite | offsite.ps1 mencetak SHA-256 laptop sama dengan VM (586cc13d...b3b9) untuk kyrion-backup-20261122T100758Z.tar.age. Verifikasi oleh Arif dengan Get-FileHash: **belum terbukti sampai Arif menempel hasilnya**. |

Durasi 2 detik berasal dari data uji kecil (61 KB) dan **bukan RTO**.

## 7. RTO dan RPO: hanya yang dapat diturunkan

**RPO (cadangan di VM).** Diturunkan dari jadwal dan durasi terukur:

- Interval jadwal: harian 02:00 UTC, T = 24 jam.
- Durasi satu backup: 10:05:01Z sampai 10:05:02Z dan 10:07:57Z sampai 10:07:58Z, sekitar 1 detik (log systemd).
- Kehilangan data terburuk = data yang ditulis sejak backup terakhir sampai kegagalan, paling banyak sesaat sebelum backup berikutnya: RPO ≤ T + durasi ≈ 24 jam + 1 detik.
- `Persistent=yes` menjalankan backup yang terlewat saat VM menyala kembali; bila VM mati melewati 02:00, selang dapat lebih dari 24 jam sebesar lama mati. Pemicu itu diuji 2026-11-25 dengan cap waktu timer disimulasikan lalu reboot: backup berjalan sendiri 23 detik sesudah boot dan berhasil (bukti/13-timer-backup-diperbaiki.txt, uji A).
- Hitungan ini hanya berlaku bila kegagalan tidak memusnahkan VM beserta isinya.

> **Catatan 2026-11-25** (`bukti/11-timer-backup-gagal.txt`): RPO di atas adalah turunan dari jadwal dengan anggapan tiap run berhasil. Anggapan itu tidak terpenuhi: servis gagal pada 23 dan 25 Nov. Pada 2026-11-25T08:54:11Z umur cadangan terbaru 70 jam 46 menit 13 detik, sehingga RPO 24 jam tidak terpenuhi.

**RPO (kehilangan VM atau laptop).** Tidak dapat diturunkan: offsite.ps1 dijalankan manual dan tidak ada jadwal. Saat ini salinan offsite terakhir adalah 22 Nov 10:07:58Z; selisih sampai kejadian tidak dibatasi oleh apa pun di sistem.

**RTO.** Tidak dapat diturunkan sekarang. Yang terukur hanya komponen data: 2 detik untuk memulihkan 61 KB ke container sementara. Tidak terukur: waktu deteksi dan keputusan, mengambil berkas dari offsite, memulihkan ke produksi (langkah 6 sampai 9), rebuild image atau VM, dan verifikasi. Nilai target ditetapkan di Tugas 10 dari ukuran terukur, setelah uji pemulihan produksi dan data lebih besar.

## 8. Residual

| # | Residual |
|---|----------|
| 1 | Offsite = laptop yang sama dengan host VM; syarat lokasi terpisah 3-2-1 belum terpenuhi. |
| 2 | Kunci privat age ada di laptop yang sama dengan salinan offsite. Hilangnya laptop menghilangkan cadangan dan kuncinya sekaligus; T-26 ("kunci age disimpan terpisah") hanya sebagian terpenuhi. Tidak ada salinan kunci. |
| 3 | Kunci privat sementara berada di tmpfs VM selama uji pulih (paparan jangka pendek). |
| 4 | Tidak dicakup: kyrion.env, rahasia lain, kunci TLS, konfigurasi (bagian 2). |
| 5 | Jadwal timer, rotasi 14 hari, dan pemulihan ke produksi belum teruji. |
| 6 | age mengenkripsi ke kunci publik tetapi tidak menandatangani pengirim; checksum .sha256 disimpan di folder yang sama. Pihak dengan akses tulis ke folder backup dapat mengganti berkas dan checksum-nya bersamaan. Belum ada tanda tangan cadangan. |
| 7 | Hitungan baris pembanding tidak diambil dalam satu snapshot dengan dump; tulis aplikasi di sela keduanya dapat menimbulkan selisih (tidak terjadi pada uji). |
| 8 | Uji hanya dengan data 61 KB; waktu pada data besar tidak diketahui. |
| 9 | Salinan offsite tidak dipangkas otomatis dan dibersihkan manual; retensi 14 hari hanya di VM. Salinan berisi data kelas Rahasia (sintetis dan kecil) dan bisa tertinggal lebih lama dari 14 hari. |

> **Catatan 2026-11-25** atas butir 5: jadwal timer kini terbukti gagal menghasilkan cadangan (`bukti/11-timer-backup-gagal.txt`); rotasi 14 hari dan pemulihan produksi tetap belum teruji.

## 9. Tabel bukti per klaim

| Klaim | Bukti | Kekuatan |
|-------|-------|----------|
| Timer 02:00 UTC, AccuracySec=1s, Persistent=yes terpasang | 03-backup.txt, systemctl show | Konfigurasi efektif |
| Unit systemd menghasilkan cadangan terenkripsi (kode keluar 0) | 03-backup.txt, journalctl | Bukti operasional (sekali, dipicu manual) |
| Berkas cadangan terenkripsi age dan terbaca grup arif saja (root:arif 640) | 03-backup.txt, od -c dan stat | Konfigurasi efektif |
| Checksum offsite sama dengan VM | 03-backup.txt, fase offsite (keluaran offsite.ps1); verifikasi Get-FileHash oleh Arif | **Belum terbukti** sampai hasil Get-FileHash ditempel Arif |
| Cadangan dapat didekripsi dan dipulihkan ke container sementara, baris dan PDF sama | 03-backup.txt, fase restore | Bukti operasional (data kecil) |
| Kunci privat age tidak tertinggal di VM | keterangan Arif (/dev/shm kosong) | Tidak ada berkas bukti |
| Cadangan dibuat oleh timer | 13-timer-backup-diperbaiki.txt, uji A | Bukti operasional (sekali, jadwal terlewat disimulasikan; belum lewat jadwal 02:00 UTC sungguhan) |
| Rotasi retensi 14 hari | - | **Belum terbukti** |
| Pemulihan ke produksi | - | **Belum terbukti** |
| RTO | - | **Belum terukur** |

> **Catatan 2026-11-25** atas baris "Cadangan dibuat oleh timer": dua percobaan sesudah 22 Nov gagal (`bukti/11-timer-backup-gagal.txt`).

> **Catatan 2026-11-25 (sesudah perbaikan)** atas baris itu: timer memicu dan cadangan berhasil pada uji boot (`bukti/13-timer-backup-diperbaiki.txt`). RPO 24 jam belum terbukti secara operasional: belum ada rangkaian cadangan harian dari jadwal 02:00 UTC sungguhan. Pemantauan kegagalan unit juga belum ada (`tabletop-report.md` bagian 5 butir 1).
