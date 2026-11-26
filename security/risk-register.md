# Risk Register

Penilaian likelihood dan impact tiap threat beserta rencana kontrol untuk risiko prioritas.

Skala 1-5 untuk Kemungkinan (L) dan Dampak (I); Skor = L x I. Level: Very High 15-25, High 8-14, Moderate 4-7, Low 1-3. Skala dan level mengikuti ketentuan handoff tugas, bukan definisi dari dosen.

| ID Threat | L | Alasan L | I | Alasan I | Skor | Level |
|-----------|---|----------|---|----------|------|-------|
| T-01 | 4 | Batas 10 MB saat ini hanya ditegakkan di sisi klien (verify-form.ts) sehingga penyerang mudah membanjiri server dengan request HTTP langsung jika kontrol ukuran payload server belum dirancang. | 4 | Kehabisan alokasi memori server memicu crash total yang melumpuhkan layanan verifikasi regulasi sebagai fungsi inti Kyrion bagi seluruh pengguna. | 16 | Very High |
| T-02 | 3 | Endpoint autentikasi publik adalah target umum serangan otomatis, sehingga mudah dicoba jika pembatasan laju percobaan masuk belum disiapkan pada rancangan modul. | 4 | Pengambilalihan akun admin memungkinkan pelaku memanipulasi katalog dan status keabsahan regulasi secara bebas. | 12 | High |
| T-03 | 2 | Manipulasi riwayat audit hanya dapat dilakukan pihak yang sudah memiliki akses langsung ke basis data internal. | 3 | Hilangnya integritas catatan audit menghambat pembuktian forensik saat sengketa perubahan data, meskipun verifikasi publik tetap berjalan. | 6 | Moderate |
| T-04 | 4 | Validasi validateVerifyForm saat ini murni berjalan di browser, sehingga penyerang teknis mudah melewatinya dengan alat pengirim request seperti curl atau Postman. | 3 | Data kotor di luar skema mengacaukan pemrosesan logika sistem setelah endpoint server aktif (dampak dinilai saat P-03 ada; kemungkinan dinilai dari kelemahan yang sudah ada di P-01). | 12 | High |
| T-05 | 2 | Kebocoran kunci via NEXT_PUBLIC_ membutuhkan kelalaian konfigurasi spesifik saat pengembang mendefinisikan variabel lingkungan. | 3 | Kuota pemanggilan AI eksternal terkuras oleh pihak luar, namun fungsi utama verifikasi keaslian regulasi tidak terhenti. | 6 | Moderate |
| T-06 | 3 | Server Actions di Next.js terbuka sebagai endpoint publik, sehingga kelalaian memvalidasi sesi admin adalah celah umum yang mudah dieksploitasi. | 4 | Perubahan metadata regulasi oleh pihak tidak berhak merusak keabsahan status hukum aturan yang disajikan kepada publik. | 12 | High |
| T-07 | 2 | Kerentanan stack exhaustion berada pada rantai devDependencies (eslint-config-next) dengan 0 kerentanan di produksi (npm audit --omit=dev pada 15 Nov 2026; sudah usang: audit 26 Nov 2026 menyisakan 3 high pada rantai effect, lihat T-24 dan R-08, security/bukti/npm-audit-2026-11-26.txt), sehingga hanya terpicu saat analisis statis lokal. | 2 | Dampak hanya membekukan sementara linting atau pengujian di mesin pengembang tanpa mengganggu aplikasi di server produksi. | 4 | Moderate |
| T-08 | 2 | Penyerang harus lebih dulu menembus perimeter infrastruktur untuk mengekstrak tabel kredensial admin. | 4 | Rekonstruksi kata sandi admin lewat cracking offline berujung pada kompromi akun tingkat tinggi yang membahayakan seluruh data aplikasi. | 8 | High |
| T-09 | 1 | Mengganti berkas PDF dan nilai sidik di basis data secara bersamaan memerlukan hak akses tulis ganda dan koordinasi penyerang tingkat lanjut. | 5 | Dokumen regulasi palsu dinyatakan sah oleh sistem, menggagalkan tujuan eksistensi produk Kyrion. | 5 | Moderate |
| T-10 | 3 | Pengguna publik dapat menyematkan teks instruksi manipulatif ke dokumen PDF sebelum diunggah (alur ekstraksi ke AI masih asumsi arsitektur). | 3 | Pengguna memperoleh interpretasi hukum keliru dari ringkasan AI yang terdistorsi, walaupun hasil verifikasi sidik tetap akurat. | 9 | High |

## Risiko Prioritas

| ID Risiko | Threat | Kontrol | Turunkan L/I | Tugas | MK terkait | Alasan |
|-----------|--------|---------|--------------|-------|------------|--------|
| R-01 | T-01 (skor 16) | Pembatasan ukuran muatan di tingkat server (opsi konfigurasi serverActions.bodySizeLimit pada Next.js; nama opsi diverifikasi saat implementasi T2) dan rate limiting pada endpoint verifikasi | L | T2/T3 (cakupan perlu dicek di LMS) | PAW (052355), KKS (052353) | Ukuran muatan ditolak di gerbang awal HTTP sebelum alokasi buffer memori, sedangkan rate limiting membatasi volume permintaan per satuan waktu sehingga penyerang tidak dapat membanjiri server hingga kehabisan memori. Dipilih karena skor tertinggi dan mengancam fungsi inti. |
| R-02 | T-04 (skor 12) | Validasi skema masukan di sisi server pada Server Action sebelum data diproses (kandidat: Zod, belum menjadi dependensi; validasi manual juga sah) | L | T2/T3 (cakupan perlu dicek di LMS) | PAW (052355), KKS (052353) | Permintaan yang melewati antarmuka browser tetap ditolak server bila melanggar skema. Dipilih karena akar masalah sudah berjalan di VerifyForm dan paling murah dipasang saat P-03 dibuat. |
| R-03 | T-06 (skor 12) | Verifikasi sesi dan pemeriksaan otorisasi peran (role-based access control) di awal setiap Server Action yang mengubah data | L | T2/T3 (cakupan perlu dicek di LMS) | PAW (052355), KKS (052353) | Eksekusi operasi admin dibatalkan jika pemanggil tidak membawa klaim sesi admin terautentikasi, sehingga eskalasi hak akses dicegah. Dipilih karena dampaknya fatal pada seluruh metadata regulasi. |
| R-04 | T-02 (skor 12) | Pembatasan laju percobaan masuk (rate limiting / exponential backoff) pada endpoint login, dikombinasikan dengan fungsi derivasi kunci berkekuatan tinggi (kandidat: scrypt dengan salt acak; diputuskan di Kripto T2) | L | T2/T3 (cakupan perlu dicek di LMS) | KKS (052353), Kriptografi (052357) | Pembatasan percobaan meredam volume tebakan otomatis, sedangkan hashing yang lambat membuat tebakan berulang tidak layak. Dipilih karena brute-force adalah ancaman paling umum pada login publik. |
| R-05 | T-09 (skor 5) | Kandidat perlindungan integritas berbasis kunci (misalnya HMAC atas metadata sidik berkas, dikoordinasikan dengan Kripto T2), didukung pemantauan log audit berkala | L, dan memitigasi I lewat deteksi dini | T2/T3 (cakupan perlu dicek di LMS) | Kriptografi (052357), KKS (052353) | Penyerang dengan akses tulis ke basis data jauh lebih sulit memalsukan sidik tanpa kunci HMAC (syarat: kunci disimpan terpisah di variabel lingkungan A-10); pemantauan log audit mempercepat deteksi sehingga dampak (I) dapat dihentikan. Dipilih walau skor Moderate karena dampak I=5 dan terhubung langsung ke Kriptografi. |
| R-06 | T-08 (skor 8) | Kata sandi admin disimpan sebagai hash scrypt (N=65536, r=8, p=2, salt acak per akun); implementasi berasal dari Kriptografi (apps/web/lib/crypto/); bukti parameter di security/bukti/hash-kata-sandi.txt | L | sec-0.2 (ditambahkan sec-0.2) | KKS (052353), Kriptografi (052357) | Hash lambat dan bersalt membuat rekonstruksi kata sandi dari baris tabel users yang bocor jauh lebih mahal, sehingga kemungkinan kompromi akun turun walau penyerang sudah membaca basis data. Dipilih karena T-08 berdampak 4 dan keputusan algoritmanya sudah dijalankan di Kriptografi. |
| R-07 | T-08 (skor 8) | Hardening perimeter host dan container: SSH hanya kunci publik dan hanya akun arif, login root mati (security/config/00-hardening.conf, security/bukti/sshd-T-final.txt); audit Lynis sebelum dan sesudah (security/lynis-before.txt, security/lynis-after.txt); container app non-root, rootfs read-only, semua kapabilitas dilepas; db tanpa port ke host di jaringan internal (security/bukti/container-hardening.txt, security/bukti/access-port-laptop.txt) | L | sec-0.2 (ditambahkan sec-0.2) | KKS (052353) | Alasan L pada T-08 adalah penyerang harus lebih dulu menembus perimeter infrastruktur; kontrol ini mempersempit jalur masuk itu (SSH tanpa kata sandi, port basis data tertutup, proses dalam container berhak minimal). Dipilih karena satu-satunya jalan ke tabel kredensial adalah lewat host dan container ini. |
| R-08 | T-07 (skor 4; kecocokan sebagian, lihat catatan) | Image runtime dibangun multi-stage dengan digest image dasar di-pin, dipindai Trivy 0.69.3 sebelum dan sesudah (security/image-scan-before.txt, security/image-scan-after.txt), dan SBOM CycloneDX dibuat (security/sbom.cdx.json) | L | sec-0.2 (ditambahkan sec-0.2) | KKS (052353) | Pemindaian dan SBOM membuat paket rentan di image yang benar-benar berjalan terlihat dan bisa ditindaklanjuti sebelum dipakai, sehingga kemungkinan eksploitasi komponen pihak ketiga turun. Dipilih karena tugas meminta bukti pemindaian dan SBOM, dan T-07 adalah threat rantai dependensi yang paling dekat. |

Kandidat yang tidak dipilih: T-10 (skor 9) karena AI hanya fitur pendukung dan alur ekstraksi PDF masih asumsi; T-08 (skor 8) karena L=2 (butuh akses basis data lebih dulu) dan kontrolnya (pilihan hash kata sandi) dikerjakan di Kripto T2.

Catatan sec-0.2: R-03 (T-06) dirujuk oleh uji akses di security/access-tests.md. R-04 (T-02) hanya terpenuhi sebagian: hash scrypt sudah ada (R-06), tetapi pembatasan laju percobaan masuk belum diimplementasikan, sehingga L untuk T-02 belum diturunkan dan menjadi sisa risiko. R-08 memakai T-07 sebagai induk karena paling dekat (rantai dependensi), padahal T-07 semula membahas devDependencies saja; kerentanan pada image runtime belum punya threat sendiri di threat-model.md.

## Pembaruan sec-0.3

Bagian sebelumnya tidak diubah. Penilaian T-11 sampai T-27 dan risiko prioritas R-09 sampai R-15 ditambahkan pada tahap 1 Tugas 3 (kondisi per 21 Nov 2026, rilis v0.3). Semua risiko di bagian ini ditambahkan sec-0.3. Nilai adalah penilaian awal sebelum kontrol sec-0.3 dipasang; perilaku yang berasal dari pembacaan kode ditandai "belum diuji" dan dibuktikan pada tahap pengumpulan bukti, lalu nilai ditinjau ulang bila hasil uji berbeda.

### Penilaian ancaman baru

| ID Threat | L | Alasan L | I | Alasan I | Skor | Level |
|-----------|---|----------|---|----------|------|-------|
| T-11 | 2 | Tebakan OTP dibatasi satu OTP baru per alamat tiap 60 detik dan 3 percobaan per OTP, sehingga peluang per alamat kecil (sekitar 0,43 persen per hari bila nonstop; hitungan dari kode, belum diuji). | 4 | Pengambilalihan akun; bila Admin, status keabsahan regulasi dapat diubah. | 8 | High |
| T-12 | 3 | Kunci pembatas bergantung pada X-Forwarded-For tanpa trustedProxies dan pembatas baru aktif bila NODE_ENV=production (belum diuji). | 3 | Pembatas terhindari atau semua pengguna terblokir, tetapi tidak membuka data. | 9 | High |
| T-13 | 3 | OTP dapat diminta ke alamat kampus mana pun tanpa cek akun; pembatas ada tetapi mudah dipenuhi dari banyak IP. | 3 | Korban menerima surat tak diminta dan login terhenti bila kuota Mailtrap habis. | 9 | High |
| T-14 | 4 | Sandbox menangkap semua surat, sehingga pemegang inbox (Arif) pasti dapat masuk sebagai alamat mana pun; ancaman nyata hanya bila akses inbox bocor. | 2 | Dampak terbatas pada lingkungan staging dengan data sintetis. | 8 | High (respons: Accept dengan catatan keterbatasan sandbox di PRD bagian 14) |
| T-15 | 3 | Layanan nanti dibuka lewat jaringan dan HTTP tanpa TLS mudah disadap di jaringan bersama. | 4 | OTP dan cookie sesi terbaca sehingga sesi, termasuk Admin, dapat dibajak. | 12 | High |
| T-16 | 1 | Jaringan backend internal hanya dihuni app dan db. | 3 | Isi tabel terbaca bila jaringan itu ditembus. | 3 | Low (respons: Accept) |
| T-17 | 3 | docker inspect terbuka bagi siapa pun dengan akses Docker atau root di host dan rahasia lewat environment compose (belum dibuktikan). | 4 | Cookie sesi dapat dipalsukan dan basis data dapat diakses. | 12 | High |
| T-18 | 2 | Perlu penguasaan proses app dan peran DB belum diperiksa (diduga superuser atau berhak UPDATE dan DELETE). | 4 | Jejak audit dapat dimanipulasi; deviasi dari PRD F-15 bila terbukti. | 8 | High |
| T-19 | 2 | Perlu penguasaan proses app; proses app memang butuh akses baca kunci. | 5 | Tanda tangan pengesahan palsu merusak dasar kepercayaan keabsahan dokumen. | 10 | High (respons: Accept dengan kompensasi, karena akses baca kunci diperlukan fungsi tanda tangan) |
| T-20 | 3 | Tidak ada backup terjadwal; hanya satu dump pra-migrasi tak terenkripsi; disk VM terisi sekitar 77 persen. | 4 | PDF, basis data, dan kunci hilang; layanan tidak pulih dan verifikasi dokumen lama gagal. | 12 | High |
| T-21 | 4 | Kegagalan login, pembuatan akun, dan penolakan pengesahan memang tidak dicatat dan aktor anonim tak dapat dicatat. | 3 | Serangan tidak terdeteksi dan tidak dapat ditelusuri. | 12 | High |
| T-22 | 3 | console.error mencetak objek galat penuh di banyak Server Action dan akan diteruskan ke Loki. | 2 | Detail internal terbaca oleh pengakses log; isi nilai sebenarnya belum diperiksa. | 6 | Moderate |
| T-23 | 3 | SSH terbuka ke seluruh subnet host-only tanpa firewall host; port Docker melewati UFW. | 4 | Pintu masuk ke VM terbuka dan seluruh aset di dalamnya terancam. | 12 | High |
| T-24 | belum dinilai | Menunggu pemindaian Trivy untuk image v0.3. | belum dinilai | Menunggu hasil pemindaian. | belum dinilai | belum dinilai |
| T-25 | 3 | Loki tanpa autentikasi bawaan, Alloy butuh akses log container, dan Grafana berkredensial bawaan. | 3 | Log bocor atau disusupi dan disk VM dapat penuh. | 9 | High |
| T-26 | 2 | Cadangan di luar VM berpeluang bocor bila tidak terenkripsi atau kunci age disimpan berdampingan. | 4 | Seluruh data dan kunci ikut bocor. | 8 | High |
| T-27 | 2 | Repositori publik; belum ada bukti rahasia ter-commit, belum dipindai dengan gitleaks git. | 5 | Rahasia di riwayat tidak dapat ditarik tanpa rotasi. | 10 | High |

### Risiko prioritas baru

| ID Risiko | Threat | Kontrol | Turunkan L/I | Tugas | MK terkait | Alasan |
|-----------|--------|---------|--------------|-------|------------|--------|
| R-09 | T-23 | UFW default deny masuk, aturan di DOCKER-USER, hanya port 80 dan 443 dibuka, SSH dibatasi ke satu alamat admin; bukti nmap sebelum dan sesudah serta deteksi pemindaian port yang diblokir UFW (D-3); percobaan SSH tidak terdeteksi. | L 3 ke 1 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS | Permukaan jaringan VM adalah pintu masuk ke semua aset dan memenuhi syarat nmap tidak menemukan 3000 dan 5432. |
| R-10 | T-15 | Nginx dengan TLS 1.2/1.3 dan sertifikat CA lokal kyrion.test, HSTS, BETTER_AUTH_URL berawalan https agar cookie Secure; bukti tls-check. | L 3 ke 1 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS, Kriptografi (konfigurasi TLS dikoordinasikan), PAW (deployment) | OTP dan sesi Admin adalah aset paling bernilai di jalur jaringan. |
| R-11 | T-17, T-27 | Rahasia dibaca dari /run/secrets lewat entrypoint tanpa mengubah kode aplikasi; gitleaks git riwayat penuh bersih; docker inspect tidak lagi menampilkan nilai rahasia (disamarkan di bukti). | T-17 L 3 ke 2 (target; tetap terbaca lewat /proc dan docker exec, risiko turun bukan hilang), T-27 L 2 ke 1 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS, Kriptografi (kunci), PAW (deployment) | Rahasia bocor membuka sesi dan basis data sekaligus. |
| R-12 | T-20, T-26 | Backup terjadwal dump db, volume kyrion-storage, /srv/kyrion/keys, dan kunci induk HMAC; dienkripsi age; salinan di luar VM; kunci age disimpan terpisah; uji pemulihan berwaktu dengan RTO dan RPO. | T-20 L 3 ke 1 (target), T-26 L 2 ke 1 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS, Kriptografi (kunci), PAW | Hilangnya PDF, basis data, atau kunci induk HMAC lebih merusak daripada hilangnya kunci privat penandatangan. |
| R-13 | T-18 | Peran DB terpisah: peran DDL untuk migrasi dan peran DML terbatas untuk aplikasi; audit_logs hanya INSERT dan SELECT; uji negatif UPDATE dan DELETE audit_logs ditolak; bukti \du. | L 2 ke 1 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS, PAW (PRD F-15) | Integritas jejak audit adalah dasar deteksi dan pembuktian. |
| R-14 | T-11, T-12, T-13 | limit_req di Nginx dengan X-Forwarded-For ditimpa dari $remote_addr; deteksi D-1 menghitung semua respons non-2xx pada /api/auth/sign-in/email-otp per IP (bukan hanya 429); R-04 ditinjau ulang. | T-11 L 2 ke 2 (terdeteksi, bukan dicegah), T-12 L 3 ke 1 (target), T-13 L 3 ke 2 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS, PAW | Serangan tebakan di bawah batas tidak memicu 429, sehingga deteksi harus menghitung semua kegagalan. |
| R-15 | T-21, T-25, T-22 | Log terpusat Alloy, Loki, Grafana dalam UTC; aturan deteksi D-1..D-3 (D-2 juga merujuk R-03); Loki tidak terbuka ke luar VM; kredensial Grafana diganti; retensi log dibatasi; console.error yang mencetak objek galat penuh didaftar sebagai temuan, bukan diubah di sec-0.3. | T-21 L 4 ke 2 (target), T-25 L 3 ke 2 (target) | sec-0.3 (ditambahkan sec-0.3) | KKS | Tanpa jejak, tidak ada deteksi dan tidak ada respons insiden. |

### Catatan tinjauan ulang (sec-0.3)

- R-04 (T-02): login kata sandi digantikan OTP email (PRD F-20); padanannya sekarang T-11 dan T-12 yang ditangani R-14. Teks R-04 tidak diubah; R-04 ditinjau ulang sec-0.3.
- R-06 (T-08): tidak berlaku sejak v0.3 (users.password_hash dihapus). Teks R-06 tidak diubah; R-06 ditinjau ulang sec-0.3.
- T-02 dan T-08: penilaian lama tidak diubah; keduanya ditinjau ulang sec-0.3 (lihat threat-model.md, "Tinjauan ulang ancaman lama").
- R-08: T-24 ditambahkan sebagai induk tambahan, karena image runtime kini punya threat sendiri; nilai T-24 menunggu pemindaian Trivy.
- Risiko yang sengaja tidak diangkat: batas sumber daya container (C-9 di PRD) ditunda dengan alasan YAGNI sampai deployment PAW.

## Catatan bukti tahap 2 sec-0.3

Bukti "sebelum" kontrol sec-0.3 diambil pada 2026-11-21 sampai 2026-11-22 (UTC), Kyrion v0.3, VM kyrion-staging. Tidak ada baris di bagian sebelumnya yang diubah. Berkas bukti: security/bukti/bukti-sebelum-tahap-2.txt, security/bukti/bukti-sebelum-tahap-2b.txt, security/bukti/image-scan-v0.3-before.txt, security/bukti/sbom-v0.3.cdx.json, security/gitleaks-before.json, security/scan-before.txt.

### Penilaian T-24 (menggantikan "belum dinilai" di tabel sebelumnya)

| ID Threat | L | Alasan L | I | Alasan I | Skor | Level |
|-----------|---|----------|---|----------|------|-------|
| T-24 | 2 | Eksploitasi butuh input tak tepercaya yang sampai ke Schema.TemplateLiteral milik effect; git grep tidak menemukan impor langsung effect di kode aplikasi; tidak diberi 1 karena paketnya ada di image runtime dan jalur tidak langsungnya belum ditelusuri. | 4 | ReDoS menghabiskan CPU sehingga berdampak ke ketersediaan proses. | 8 | High (respons: Mitigate, kontrol diputuskan di tahap 3) |

Induk: R-08 (catatan T-24 sebagai induk tambahan sudah tercantum di bagian sebelumnya).

### Bukti per ancaman

| ID | Bukti yang didapat | Berkas | Batas kesimpulan |
|----|--------------------|--------|------------------|
| T-17 / R-11 | Nama variabel lingkungan sensitif (BETTER_AUTH_SECRET, MAILTRAP_API_TOKEN, DATABASE_URL, POSTGRES_PASSWORD) tampak lewat docker inspect (konfigurasi); nilai disamarkan di bukti. Kunci kriptografi hanya berupa jalur berkas. | bukti-sebelum-tahap-2.txt | Menunjukkan eksposur di konfigurasi container, bukan nilai rahasianya. |
| T-18 / R-13 | \du menampilkan hanya satu peran, kyrion, dengan Superuser, Create role, Create DB, Replication, Bypass RLS (konfigurasi efektif). | bukti-sebelum-tahap-2.txt | Bahwa aplikasi memakai peran itu disimpulkan dari satu-satunya peran yang ada, tidak teramati langsung. |
| T-23 / R-09 | ufw inactive; iptables DOCKER-USER kosong; ss -tlnp: port 22 di semua alamat (IPv4 dan IPv6), 127.0.0.1:3000, tidak ada 5432; nmap dari laptop (IPv4): hanya 22/tcp open, 65.534 port lain filtered (no-responses). | bukti-sebelum-tahap-2.txt, bukti-sebelum-tahap-2b.txt, scan-before.txt | Penyebab status filtered belum diketahui: INPUT ACCEPT tanpa aturan dan tabel raw hanya berisi dua aturan sempit milik Docker, jadi bukan dari aturan VM; dua uji tcpdump tidak konklusif. Karena itu scan-before.txt tidak dipakai sendirian sebagai bukti T-23. Pindai nmap tidak mencakup IPv6, padahal sshd mendengarkan di IPv6. |
| T-11, T-12 / R-14 | Uji dari loopback VM dengan email sintetis dan OTP salah: tanpa XFF, 3 respons 400 lalu 429; empat nilai XFF tunggal berbeda semuanya 400 (bypass terbukti); empat nilai XFF berlapis berbeda, 3 respons 400 lalu 429 (bucket bersama), dan log aplikasi mencatat WARN Better Auth "could not determine a client IP". Status: terbukti sebagian. | bukti-sebelum-tahap-2.txt | Membuktikan perilaku aplikasi terhadap header, bukan dampak dari jaringan nyata. Percobaan di bawah batas hanya menghasilkan 400, sehingga deteksi D-1 harus menghitung semua respons non-2xx. |
| T-13 | Sandbox Mailtrap terbaca 7 / 50 pesan di akun (2026-11-21). | belum disimpan sebagai berkas | Periode batas (bulanan atau tidak) belum dikonfirmasi; tangkapan layar menyusul di security/img/. |
| T-21 | Query audit_logs per aksi: hanya UNGGAH_BERKAS (2 baris) dan PENGESAHAN (2 baris); 12 permintaan OTP salah tidak meninggalkan baris. | bukti-sebelum-tahap-2.txt | Kondisi tabel pada saat uji. |
| T-22 | Log stdout aplikasi 6 baris, 0 baris berpola Error, Prisma, atau stack trace. | bukti-sebelum-tahap-2.txt | Jalur galat belum dipicu; T-22 tetap berbasis pembacaan kode. |
| T-24 / R-08 | Trivy 0.69.3 atas kyrion-web:hardened (ID sha256:4dfad4f15693beb0e41afa34078752790aa0fdfecebe333e433386355fbaabb7): OS Alpine 3.24.3 tanpa baris Total; node-pkg Total 1 HIGH: effect 3.20.0, CVE-2026-121707, perbaikan di 3.22.1. Rantai: web, prisma@7.10.1, @prisma/config@7.10.1, effect. | image-scan-v0.3-before.txt, sbom-v0.3.cdx.json | "OS 0 HIGH/CRITICAL" disimpulkan dari tidak adanya baris Total, belum dikonfirmasi dari tabel ringkasan. |
| T-27 / R-11 | gitleaks 8.30.1 atas 176 commit: 1 temuan private-key di apps/web/lib/crypto/penandatangan.test.ts baris 52-105 (commit f186ed16cd4d8d5bb0bb67b7c008c3982d2f4638), dinilai positif palsu: kunci uji dibangkitkan saat runtime dan satu-satunya literal PEM adalah string palsu. | gitleaks-before.json | Hanya baris 46-110 yang dibaca; gitleaks hanya mengenali pola yang dikenalnya. Tindak lanjut tahap 3: .gitleaksignore berbasis fingerprint dengan alasan di secrets.md. |

## Catatan sec-0.3 (2026-11-25)

Skor di bagian sebelumnya tidak diubah; teks hanya diubah pada R-09 (butir 1).

1. **R-09 / T-23:** teks R-09 dikoreksi pada 2026-11-26: D-3 mendeteksi pemindaian port yang diblokir UFW (security/detection/D-3-pemindaian-port.yml). Deteksi percobaan SSH tetap tidak ada.
2. **R-12 / T-20:** servis cadangan gagal dua kali sesudah 22 Nov (23 dan 25 Nov); cadangan terbaru 2026-11-22T10:07:58Z, sehingga RPO 24 jam tidak terpenuhi (security/bukti/11-timer-backup-gagal.txt, security/tabletop-report.md bagian 3). Pembaruan 2026-11-25: penyebab (database belum siap saat boot) diperbaiki di backup.sh dan teruji (security/bukti/13-timer-backup-diperbaiki.txt); cadangan dari jadwal 02:00 UTC sungguhan dan pemantauan kegagalan unit belum ada, jadi skor tidak diubah.
3. **R-14:** D-1 tidak mencakup endpoint kirim OTP (security/detection/D-1-tebak-otp.yml, security/alerts-analysis.md).
4. **R-15:** deteksi tanpa notifikasi eksternal, dan ambang D-1 dan D-2 tanpa baseline (security/alerts-analysis.md; notifikasi: security/detection/README.md).
