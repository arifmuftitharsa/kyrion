# Klasifikasi Data Kyrion (sec-0.3 Bagian A2)

| | |
|---|---|
| Tanggal (UTC) | 2026-11-22 |
| Hash commit | 1b1ae1e (`git rev-parse --short HEAD`) |
| Perintah | `git rev-parse --short HEAD`; `date -u +%Y-%m-%dT%H:%MZ` |
| Sumber di repo | security/asset-inventory.md (A-01 sampai A-24, termasuk Pembaruan sec-0.2 dan sec-0.3), security/dfd.md, security/risk-register.md, KEPUTUSAN.md (bagian 1), compose.vm.yaml |
| Tidak ada di repo | PRD-Kyrion.md (ada di Project Kyrion, tidak ada di repo). Isinya dikutip dari PRD-Kyrion.md, bukan dibaca dari repo: bagian 4 Keputusan 1.4 (Kyrion hanya untuk sivitas akademika UP, tidak ada akses publik, semua halaman wajib login akun kampus); bagian 4 peran (Sivitas hanya melihat metadata regulasi, tidak membuka atau mengunduh PDF dan tidak melihat halaman perubahan antarversi; PDF hanya dibuka Admin Akademik); F-05 (PDF hanya Admin, Sivitas dan anonim ditolak); bagian 4.3 (dokumen yang diunggah dianggap dokumen umum bagi seluruh sivitas) |

Berkas ini hanya klasifikasi dan aturan penanganan. Tidak ada nilai rahasia dan tidak ada email nyata. Status kontrol (misalnya backup, log terpusat) mengikuti asset-inventory.md dan belum berarti terpasang; bukti ada di berkas masing-masing.

## 1. Skema klasifikasi

Kelas ditentukan oleh rating **Kerahasiaan (C)** aset di asset-inventory.md, dengan dua penaikan:

1. Aset yang menurut PRD aksesnya dibatasi pada pengguna terautentikasi atau peran tertentu naik minimal ke Internal meski rating C Rendah (A-03 dan A-04).
2. **Aturan data pribadi (Keputusan 2 dan 5, 2026-11-22):** aset yang memuat data pribadi umum berkelas minimal Rahasia, mengikuti skema contoh materi pekan 10 dan 11. Yang dihitung data pribadi umum di Kyrion: email kampus (memuat NIM), alamat IP, dan user agent, selain jenis pada UU 27/2022 Pasal 4 ayat 3. Aset yang tidak memuat data itu tidak dinaikkan. Rating C di asset-inventory.md tidak diubah oleh berkas ini; selisihnya dicatat di bagian 7.

Rating **Integritas (I) Tinggi** tidak menaikkan kelas, tetapi menambah penanda **[I]**: aset wajib punya kontrol integritas dan perubahannya harus tercatat.

| Kelas | C | Definisi | Penyimpanan | Akses | Enkripsi | Retensi | Backup |
|-------|---|----------|-------------|-------|----------|---------|--------|
| Publik | Rendah | Boleh dibaca siapa pun tanpa merugikan Kyrion. | Boleh di repositori publik atau volume aplikasi. | Baca terbuka; ubah hanya lewat peninjauan Arif. | Tidak wajib; TLS saat dilayani (R-10). | Tidak ada ketentuan retensi khusus di dokumen repo. | Tidak wajib untuk repo (salinan di GitHub); data aplikasi mengikuti A-20. |
| Internal | Sedang | Hanya untuk operator dan proses sistem; terbuka akan merugikan terbatas (detail internal, dokumen dan metadata yang aksesnya dibatasi). | Di luar repositori, di VM atau layanan terkelola, tidak di image. | Operator (Arif) dan proses aplikasi yang membutuhkan; peran DB terbatas (R-13). | TLS saat transit (R-10); saat diam tidak ada enkripsi disk VM (Keputusan 3). | Versi lama regulasi dan PDF: permanen (ASUMSI, Keputusan 6). | Ya, masuk A-20 terenkripsi; salinan dipertahankan 14 hari. |
| Rahasia | Tinggi, atau memuat data pribadi umum | Kebocoran langsung membuka sistem, memungkinkan pemalsuan, atau membuka data pribadi orang. | Tidak pernah di repositori atau image; berkas izin 0600 atau 0700, lewat /run/secrets atau mount hanya-baca (R-11). | Hanya proses yang butuh dan operator; tidak dicetak ke log atau bukti; email kampus tidak boleh muncul polos di log Loki. | Kunci dan hash memakai kriptografi (tabel di bawah); cadangan wajib terenkripsi age (R-12); saat diam tidak ada enkripsi disk VM (Keputusan 3). | Log 30 hari; cadangan 14 hari; sesi 7 hari (asset-inventory.md); akun nonaktif 12 bulan (ASUMSI); audit_logs minimal 1 tahun (Keputusan 1). Rotasi kunci diatur di secrets.md (Tugas 4). | Ya, hanya dalam bentuk terenkripsi dan kunci dekripsi disimpan terpisah (T-26); salinan dipertahankan 14 hari. |

## 2. Pemetaan aset ke kelas

Rating dikutip dari asset-inventory.md. Kolom Jenis data pribadi memakai UU 27/2022 Pasal 4 ayat 3 (data pribadi umum) ditambah Keputusan 2 dan 5 (email kampus, IP, user agent); yang tidak dapat disimpulkan ditandai [PERLU KEPUTUSAN ARIF] (saat ini tidak ada). A-06 dan A-07 tetap Publik karena kelas mengikuti rating C meski diakses setelah login (PRD Keputusan 1.4); aksesnya dibatasi oleh kontrol akses, bukan oleh kelas. **Krip** = dilindungi mekanisme kriptografi (apps/web/lib/crypto/ atau mekanisme yang dicatat kolom Kripto asset-inventory.md); "rencana" berarti belum berjalan menurut inventaris.

| Aset | Lokasi | Kelas | Jenis data pribadi | Alasan (C/I/A) | Penanganan khusus | Krip | Risiko |
|------|------|------|------|------|------|------|------|
| A-01 Kode sumber (repo publik) | GitHub repo publik arifmuftitharsa/kyrion | Publik [I] | bukan data pribadi | C Rendah (repo memang publik), I Tinggi, A Sedang. | Tidak boleh memuat rahasia; gitleaks riwayat penuh. | Tidak | T-27, R-11 |
| A-02 Modul sidik SHA-256 | apps/web/lib/crypto/fingerprint.ts | Publik [I] | bukan data pribadi | C Rendah, I Tinggi, A Tinggi. | Perubahan lewat peninjauan; uji tetap hijau. | Ya (SHA-256, timingSafeEqual) | R-05, T-09 |
| A-03 Berkas PDF regulasi | Volume Docker kyrion-storage (dipasang ke /app/storage di container app) | Internal [I] | bukan data pribadi | C Rendah di inventaris, tetapi naik ke Internal: PRD membatasi akses pada sivitas terautentikasi dan PDF hanya dibuka Admin (F-05); I Tinggi, A Sedang. | Hanya aplikasi yang menulis volume; verifikasi hash dan tag sebelum dikirim. | Ya (SHA-256, HMAC lewat A-04) | T-09, R-05, T-20, R-12 |
| A-04 Metadata regulasi dan status versi | Tabel versions di PostgreSQL (container db, volume kyrion-pgdata) | Internal [I] | bukan data pribadi | C Rendah di inventaris, tetapi naik ke Internal: tidak ada akses publik dan semua halaman wajib login (PRD Keputusan 1.4); I Tinggi, A Tinggi. | Kolom terlindung HMAC dan tanda tangan Ed25519 pada versi Sah (K-2 di KEPUTUSAN.md). | Ya (HMAC-SHA256, Ed25519) | T-09, R-05, T-06, R-03 |
| A-05 Riwayat versi dan log audit | Tabel audit_logs di PostgreSQL (container db) | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Sedang di inventaris, naik ke Rahasia: memuat identitas admin (actor_id) sebagai data pribadi umum (Keputusan 2). I Tinggi, A Sedang. | audit_logs hanya INSERT dan SELECT bagi peran aplikasi; ditulis satu transaksi dengan perubahannya; retensi minimal 1 tahun, penghapusan hanya lewat peran DDL dan tercatat (Keputusan 1; pencatatannya belum terbukti). | Rencana (dikoordinasikan dengan Kripto T2) | T-03, T-18, R-13, T-21, R-15 |
| A-06 Formulir verifikasi dan validasi klien | apps/web/app/verifikasi/page.tsx, apps/web/components/VerifyForm.tsx, apps/web/lib/validation/verify-form.ts | Publik | bukan data pribadi | C Rendah, I Sedang, A Tinggi. | Validasi klien tidak dipercaya; server memvalidasi ulang. | Tidak | T-04, R-02, T-01, R-01 |
| A-07 Server Actions dan endpoint server | Container app (P-06), kode di apps/web/ | Publik [I] | bukan data pribadi | C Rendah, I Tinggi, A Tinggi. | Sesi dan peran diperiksa di awal tiap aksi pengubah. | Tidak | T-06, R-03, R-02 |
| A-08 Basis data utama | Container db, volume kyrion-pgdata | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Sedang di inventaris, naik ke Rahasia: menyimpan A-18 (email kampus, IP, user agent) dan A-05 (Keputusan 2 dan 5). I Tinggi, A Tinggi. | Tanpa port ke host, jaringan backend internal; peran DB terpisah (R-13); cadangan 14 hari. | Rencana (dikoordinasikan dengan Kripto T2) | T-18, R-13, T-20, R-12, T-16 |
| A-09 Kredensial admin dan token sesi (kini OTP dan tabel sessions) | Tabel verifications dan sessions di container db | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Tinggi, I Tinggi, A Sedang. Tabel sessions memuat ip_address dan user_agent (Keputusan 5). | OTP disimpan sebagai hash; sesi berlaku 7 hari (asset-inventory.md, sec-0.3); tidak dicetak ke log. | Ya (hash OTP, token sesi unik) | T-11, T-12, T-13, R-14, T-17, R-11 |
| A-10 Kunci lingkungan dan API key (.env, kyrion.env) | /srv/kyrion/env/kyrion.env di VM; target /run/secrets (R-11) | Rahasia [I] | bukan data pribadi | C Tinggi, I Tinggi, A Sedang. | Di luar repo dan image; mode 0600; target pindah ke /run/secrets (R-11). | Tidak | T-05, T-17, T-27, R-11 |
| A-11 Layanan LLM eksternal | Endpoint API penyedia AI eksternal (Rancangan) | Internal | bukan data pribadi | C Sedang, I Sedang, A Rendah. Status Rancangan (E-03 belum berjalan, dfd.md), belum ada data yang dikirim. | Jangan kirim data Rahasia ke pihak ketiga. | Tidak | T-10 (tanpa R- prioritas; lihat bagian 5) |
| A-12 Dependensi npm | package.json, package-lock.json, node_modules | Publik [I] | bukan data pribadi | C Rendah, I Tinggi, A Sedang. | Integritas lewat package-lock.json. | Ya (SHA-512 lockfile) | T-07, T-24, R-08 |
| A-13 VM staging | Laptop Arif (VirtualBox), 192.168.56.101 | Internal [I] | bukan data pribadi | C Sedang, I Tinggi, A Sedang (data uji sintetis). | SSH kunci publik, firewall host. | Ya (SSH kunci publik) | T-23, R-09, R-07 |
| A-14 Kunci privat SSH | Laptop Arif, folder .ssh | Rahasia [I] | bukan data pribadi | C Tinggi, I Tinggi, A Sedang. Di laptop Arif (.ssh), berpassphrase. | Tidak disalin ke VM, repo, atau bukti. | Ya (asimetris, passphrase) | R-07, R-09 (Keputusan 4: tidak langsung, tidak ada risiko baru; alasan di bagian 5) |
| A-15 Image kyrion-web:hardened dan :tools | Docker daemon di VM; definisi apps/web/Dockerfile | Publik [I] | bukan data pribadi | C Rendah, I Tinggi, A Sedang. | Digest basis di-pin; pindai Trivy. | Ya (digest di-pin) | T-24, R-08 |
| A-16 Kunci induk HMAC (/srv/kyrion/secrets/kyrion_master_key) | /srv/kyrion/secrets/kyrion_master_key di VM | Rahasia [I] | bukan data pribadi | C Tinggi, I Tinggi, A Sedang. | Mount hanya-baca ke app; tidak masuk repo atau image; ikut cadangan hanya terenkripsi. | Ya (kunci HMAC, KEPUTUSAN.md K-4) | T-09, R-05, T-17, R-11, T-20, T-26, R-12 |
| A-17 Kunci Ed25519 dan keyring (/srv/kyrion/keys/) | /srv/kyrion/keys/ di VM | Rahasia [I] | bukan data pribadi | C Tinggi, I Tinggi, A Sedang. Folder 0700, berkas 0600. | Mount /keys hanya-baca; kunci publik terpisah di tabel signing_keys. | Ya (Ed25519) | T-19, T-17, R-11, T-20, T-26, R-12 |
| A-18 Akun, OTP, sesi (users, verifications, sessions, accounts) | Tabel users, verifications, sessions, accounts di container db | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Sedang di inventaris, naik ke Rahasia: email kampus memuat NIM sehingga mengidentifikasi orang secara langsung dan kebocorannya memungkinkan phishing terarah (Keputusan 2); sessions memuat IP dan user agent (Keputusan 5). I Tinggi (role dan is_active), A Sedang. Data uji sintetis. | Kolom role dan is_active hanya diubah lewat jalur admin; akun nonaktif disimpan 12 bulan (ASUMSI, ditinjau di v1.0); email tidak boleh muncul polos di log Loki; tanpa email nyata di bukti. | Ya (OTP hash) | T-11, T-12, T-13, R-14, T-18, R-13 |
| A-19 Log operasional | stdout container app (docker logs); rencana: log akses Nginx dan log UFW di VM | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Sedang di inventaris, naik ke Rahasia: log Nginx dan sesi memuat IP klien (Keputusan 5) dan email bila tidak disamarkan (Keputusan 2). I Tinggi, A Sedang. | Retensi log 30 hari; UTC; tidak mencetak nilai rahasia (T-22); email tidak boleh muncul polos di log Loki; Loki tidak terbuka keluar VM. | Tidak | T-21, T-22, T-25, R-15 |
| A-20 Cadangan | Kondisi awal ~/kyrion-pra-sec-0.3.dump di VM; lokasi cadangan terjadwal tidak tertulis di repo (rencana: salinan lokal dan di luar VM) | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Tinggi, I Tinggi, A Tinggi. Memuat semua data dan kunci A-16, A-17. | Hanya terenkripsi age; kunci dekripsi tidak berdampingan; uji pemulihan berwaktu; retensi cadangan 14 hari (Keputusan 1). | Ya (rencana: age) | T-20, T-26, R-12 |
| A-21 Konfigurasi firewall dan Nginx | deploy/nginx/kyrion.conf, deploy/ufw/docker-user.rules, security/firewall-rules.md; aturan aktif di VM | Publik [I] | bukan data pribadi | C Rendah (masuk repo), I Tinggi, A Tinggi. | Tanpa rahasia; berkas ada di deploy/ dan security/firewall-rules.md (security/config/ hanya berisi konfigurasi hardening SSH dan kernel, bukan firewall atau Nginx). | Tidak | T-23, R-09, T-12, R-14 |
| A-22 Layanan email Mailtrap | API Mailtrap (penyedia eksternal); token di /srv/kyrion/env/kyrion.env | Internal | bukan data pribadi (isi sandbox hanya data uji sintetis; menjadi umum bila sandbox pernah berisi email sivitas nyata) | C Sedang, I Sedang, A Tinggi. Token ada di A-10. Kelas tidak dinaikkan karena sandbox staging hanya menerima surat OTP ke alamat sintetis, tanpa email sivitas nyata, sehingga aturan data pribadi umum belum terpicu; A-22 tetap Internal (Keputusan 7) dan naik ke Rahasia bila sandbox pernah berisi email sivitas nyata (lihat bagian 7). | Hanya data sintetis di sandbox; token tidak dicetak. | Tidak | T-13, T-14, R-14 |
| A-23 Sertifikat TLS, kunci privat server, CA lokal | Kunci privat server di VM di luar repo dan image (jalur tidak tertulis di repo); CA lokal di laptop | Rahasia [I] | bukan data pribadi | C Tinggi, I Tinggi, A Sedang. | Kunci privat server di VM, di luar repo dan image; CA lokal di laptop. | Ya (TLS 1.2 dan 1.3) | T-15, R-10 |
| A-24 Stack log terpusat (Alloy, Loki, Grafana) | Container di VM; volume data Loki (Rancangan) | Rahasia [I] | umum (UU 27/2022 Pasal 4 ayat 3) | C Sedang di inventaris, naik ke Rahasia: menyimpan salinan A-19 (IP, dan email bila tidak disamarkan) (Keputusan 2 dan 5). I Tinggi, A Sedang. Status Rancangan. | Retensi log 30 hari; email tidak boleh muncul polos di Loki (samarkan sebelum atau saat masuk); kredensial Grafana bawaan diganti; Loki tanpa autentikasi sehingga hanya di jaringan internal. | Tidak | T-25, R-15 |

Catatan pemetaan: T-19 dan T-26 hanya memiliki R- tidak langsung. T-19 tidak punya baris di "Risiko prioritas" (responsnya Accept dengan kompensasi), dan T-26 ditangani lewat R-12. Untuk A-14 lihat Keputusan 4 dan untuk T-19 Keputusan 8 di bagian 5.

## 3. Kunci kriptografi dan penyimpanan PDF sebagai aset KKS

| Aset | Jalur tertulis di repo | Kelas | Catatan |
|------|------------------------|-------|---------|
| Kunci induk HMAC (A-16) | /srv/kyrion/secrets/kyrion_master_key (VM; asset-inventory.md, compose.vm.yaml `kyrion_master_key`) | Rahasia [I] | Dipasang ke container app sebagai secret hanya-baca (DF-23). Kunci MAC diturunkan dengan HKDF-SHA256 dari kunci induk (KEPUTUSAN.md K-4). |
| Kunci Ed25519 dan keyring (A-17) | /srv/kyrion/keys/ (VM), dipasang sebagai /keys hanya-baca (compose.vm.yaml); berkas kunci-1.pem dan keyring.json | Rahasia [I] | Kunci publik juga di tabel signing_keys; kunci privat tidak. |
| Folder storage PDF versi (A-03) | Volume Docker kyrion-storage dipasang ke /app/storage (compose.vm.yaml); di pengembangan lokal apps/web/storage/ (KEPUTUSAN.md bagian 1.1; README.md menyebut KYRION_STORAGE_DIR dan diabaikan Git) | Internal [I] | Isinya dokumen umum bagi sivitas (PRD 4.3) tetapi akses dibatasi: PDF hanya dibuka Admin (PRD F-05) dan tidak ada akses publik (PRD Keputusan 1.4); integritasnya kritis; ikut cadangan (A-20, DF-34). |

Dua kunci di atas tidak boleh terpisah dari cadangannya secara tidak sengaja: kehilangan A-16 membuat verifikasi tag gagal tetapi PDF tetap terbaca (KEPUTUSAN.md bagian 2.1); kehilangan A-17 menghentikan pengesahan baru sampai rotasi (asset-inventory.md, A-17).

## 4. Hubungan dengan kontrol sec-0.3

- Aset Rahasia dan Internal wajib masuk cadangan terenkripsi (R-12), dipertahankan 14 hari, dan tidak boleh muncul sebagai nilai di bukti (R-11).
- Data pribadi umum (email, IP, user agent) di log: email disamarkan sebelum masuk Loki (kontrol di Tugas 6; **belum terbukti**).
- Aset berkelas Rahasia di VM bergantung pada kontrol R-11 (/run/secrets). Kontrol itu sudah di-commit tetapi belum dibangun atau diuji di VM, jadi **belum terbukti**.
- Cadangan (A-20) berstatus Rancangan di asset-inventory.md; **belum terbukti** ada backup terjadwal atau uji pemulihan.

## 5. Keputusan dan pertanyaan terbuka

### Keputusan (Arif, 2026-11-22, final)

| # | Keputusan | Catatan |
|---|-----------|---------|
| 1 | Retensi: log 30 hari; cadangan 14 hari; akun nonaktif 12 bulan; audit_logs minimal 1 tahun (aplikasi hanya INSERT dan SELECT; penghapusan hanya lewat peran DDL dan tercatat). | Retensi akun nonaktif adalah **ASUMSI**, ditinjau di v1.0 karena percakapan pengguna permanen. Penerapan (Loki, rotasi backup, pencatatan penghapusan) belum terbukti. |
| 2 | Email kampus (A-18) berkelas Rahasia. Alasan: mengidentifikasi orang secara langsung (memuat NIM), termasuk data pribadi, kebocoran memungkinkan phishing terarah. | Konsekuensi: email tidak boleh muncul polos di log Loki. Dampak ke kelas aset lain di bagian 7. |
| 3 | Disk VM tidak dienkripsi (tanpa LUKS). Risiko diterima untuk staging. | Kompensasi: cadangan terenkripsi, izin berkas rahasia, kunci tidak di image. BitLocker laptop belum dicek. |
| 4 | A-14 (kunci SSH): tidak langsung, tidak ada risiko baru. Aturan Arif: soal kunci SSH atau akses host tetap tidak langsung. | Dirujuk ke R-07 karena kontrolnya (SSH hanya kunci publik dan hanya akun arif, login root mati) mempersempit jalur yang memakai kunci A-14, dan ke R-09 karena kontrolnya membatasi SSH ke satu alamat admin sehingga kunci A-14 yang bocor tetap hanya berguna dari alamat itu (belum terbukti sampai bukti firewall diuji). R-06 (hash kata sandi admin, tidak berlaku sejak v0.3) dan R-08 (rantai pasok image) teksnya tidak menyangkut kunci SSH sehingga tidak dirujuk. |
| 5 | IP dan user agent (tabel sessions, log Nginx) termasuk data pribadi umum. | Dipakai pada bagian 7. |
| 6 | Versi lama regulasi dan PDF-nya disimpan permanen. | **ASUMSI**: inti fitur riwayat versi. Belum dicocokkan dengan PRD bagian 9 dan 11 (PRD tidak terbaca dari repo). |
| 7 | A-22 (Mailtrap sandbox) tetap Internal. | Naik ke Rahasia bila sandbox pernah berisi email sivitas nyata. |
| 8 | T-19: diputuskan saat Tugas 13 (pembaruan risk-register), setelah kontrol tahap 3 ada. | Tidak ada risiko baru yang ditulis sekarang. |

### Pertanyaan terbuka

1. BitLocker laptop **belum dicek**. Laptop menyimpan A-14, CA lokal A-23, dan salinan cadangan bila offsite = laptop. Ini butuh pengecekan, bukan keputusan; masuk daftar periksa di bawah.

### Daftar periksa pra-v1.0

- [ ] Cek BitLocker laptop (menjawab pertanyaan terbuka 1 dan melengkapi kompensasi Keputusan 3).
- [ ] Tinjau retensi akun nonaktif 12 bulan (ASUMSI, Keputusan 1) karena percakapan pengguna permanen.
- [ ] Cocokkan retensi permanen versi lama dan PDF (ASUMSI, Keputusan 6) dengan PRD bagian 9 dan 11.
- [ ] Periksa apakah sandbox Mailtrap pernah berisi email sivitas nyata; bila ya, naikkan A-22 ke Rahasia (Keputusan 7).

## 6. Batas

- Klasifikasi adalah keputusan dokumen; belum ada pengujian bahwa penanganan di atas dijalankan di VM.
- Keputusan 3: disk VM tidak dienkripsi; **risiko diterima untuk staging** dengan kompensasi cadangan terenkripsi, izin berkas rahasia, dan kunci tidak di image. Kompensasi itu sendiri belum terbukti (R-11 dan R-12 belum diuji di VM). BitLocker laptop belum dicek.
- Pertanyaan terbuka 1 (BitLocker laptop) belum dijawab karena belum dicek; tidak ada kolom Jenis data pribadi yang masih bertanda [PERLU KEPUTUSAN ARIF]. Keputusan 8 (T-19) ditunda ke Tugas 13. Keputusan 6 belum dicocokkan dengan PRD.
- Kutipan PRD berasal dari PRD-Kyrion.md di Project Kyrion; tidak ada di repo sehingga tidak diverifikasi terhadap repo.
- Kolom Kripto mengikuti asset-inventory.md; yang berstatus "rencana" belum diverifikasi di berkas ini.

## 7. DAMPAK KEPUTUSAN 2 DAN 5

Aturan: aset yang memuat data pribadi umum (email kampus, IP, user agent) berkelas minimal Rahasia. Tabel ini untuk Arif menolak atau menyetujui satu per satu.

| Aset | Kelas lama | Kelas baru | Alasan |
|------|-----------|------------|--------|
| A-18 Akun, OTP, sesi | Internal | Rahasia | Email kampus (NIM), IP, dan user agent (Keputusan 2 dan 5). |
| A-05 Riwayat dan log audit | Internal | Rahasia | actor_id mengidentifikasi admin; Arif menetapkan A-05 memuat data pribadi umum. |
| A-08 Basis data utama | Internal | Rahasia | Menyimpan A-18 dan A-05. |
| A-19 Log operasional | Internal | Rahasia | IP klien di log Nginx (Keputusan 5); email bila tidak disamarkan (Keputusan 2). |
| A-24 Stack log terpusat | Internal | Rahasia | Menyimpan salinan A-19. |
| A-22 Mailtrap sandbox | Internal | Internal (tidak berubah) | Isi sandbox hanya data uji sintetis; naik ke Rahasia bila sandbox pernah berisi email sivitas nyata. Keputusan 7: tetap Internal. |
| A-09, A-20 | Rahasia | Rahasia (tidak berubah) | Sudah Rahasia; kolom jenis data pribadi diisi umum. |
| A-13, A-11 | Internal | Internal (tidak berubah) | Bukan data pribadi menurut Arif (A-11 belum berjalan). Catatan: A-13 menjadi host A-08, tetapi kelas A-13 mengikuti keputusan Arif. |

Selisih dengan asset-inventory.md (tidak diubah di sini): rating C untuk A-05, A-08, A-18, A-19, dan A-24 di inventaris masih Sedang, sedangkan kelas di berkas ini Rahasia. Perlu diselaraskan di tugas lain bila Arif setuju.
