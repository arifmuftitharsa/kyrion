# Catatan Desain API Kyrion (v0.3)

Dokumen ini menjelaskan **alasan** di balik desain API Kyrion. Bentuk persisnya (path, parameter, skema, contoh) ada di [`openapi.yaml`](./openapi.yaml); dokumen ini tidak mengulanginya.

Status: mencakup semua endpoint di `openapi.yaml`: tiga endpoint baca regulasi, pengesahan versi (POST), dan dua endpoint sesi milik sendiri (GET, DELETE), ditambah route catch-all untuk jalur `/api` yang tidak dikenal. Autentikasi memakai cookie sesi (bagian 12).

## 1. Dari kebutuhan ke resource

API diturunkan dari kebutuhan produk, bukan dari tabel basis data.

| Kebutuhan | Pertanyaan pengguna | Endpoint |
|---|---|---|
| F-01 | Regulasi apa saja yang ada, dan versi mana yang berlaku sekarang? | `GET /api/v1/regulations` |
| F-02 | Bagaimana riwayat versi satu regulasi? | `GET /api/v1/regulations/{slug}` |
| F-03 | Versi mana yang berlaku pada tanggal tertentu? | `GET /api/v1/regulations/{slug}/current-version` |

Resource utamanya **regulasi**. Versi tidak dijadikan resource tingkat atas karena versi tidak bermakna tanpa regulasinya, sehingga ia muncul sebagai bagian dari regulasi.

`current-version` dimodelkan sebagai sub-resource, bukan sebagai filter pada daftar versi, karena jawabannya selalu **paling banyak satu** versi dan ditentukan oleh aturan bisnis, bukan oleh penyaringan sederhana.

## 2. Penamaan dan pengenal

- Path memakai kata benda jamak berbahasa Inggris (`regulations`), sedangkan rute halaman memakai bahasa Indonesia (`/regulasi`). Keduanya sengaja dibedakan: halaman untuk manusia, API untuk program.
- Regulasi dikenali lewat `slug`, bukan ID basis data. Slug stabil, terbaca, dan sama dengan yang tampil di alamat halaman.
- Awalan `/api/v1` memberi ruang untuk perubahan yang tidak kompatibel di kemudian hari tanpa mematahkan klien lama.

## 3. Metode dan kode status

Tiga endpoint regulasi hanya membaca, jadi semuanya `GET`: aman dan idempoten. Pengesahan memakai `POST`, pencabutan sesi memakai `DELETE`, dan daftar sesi memakai `GET`.

| Status | Kapan | Alasan |
|---|---|---|
| 200 | Permintaan sah, termasuk bila hasilnya kosong | Daftar kosong dan "belum ada versi berlaku" adalah jawaban yang sah, bukan galat |
| 400 | Parameter query tidak sah, tidak dikenal, atau diulang | Kesalahan ada pada bentuk permintaan |
| 401 | Tidak ada sesi yang sah | Pengguna belum masuk |
| 403 | Peran bukan Admin (pengesahan), atau header `Origin` tidak sama dengan origin aplikasi (`POST` dan `DELETE`) | Pengguna dikenal tetapi tidak berwenang, atau asal permintaan ditolak |
| 404 | Regulasi tidak ada, atau slug berformat salah | Resource yang dituju tidak ada |
| 409 | Versi tidak dapat disahkan: bukan Draf atau sudah berubah, belum punya berkas PDF lengkap, atau tanggal berlaku sudah dipakai versi sah lain | Permintaan sah, tetapi keadaan versi tidak mengizinkan |
| 500 | Galat tak terduga di server | Rincian disimpan di log server, tidak dikirim |
| 503 | Penandatangan belum siap saat pengesahan | Masalah konfigurasi sisi operator, bukan kesalahan permintaan |

Tiga keputusan yang perlu dijelaskan:

1. **Kategori tak dikenal menghasilkan 200 dengan daftar kosong, bukan 404.** `category` adalah penyaring atas daftar. Penyaring yang tidak cocok dengan apa pun menghasilkan daftar kosong; daftar regulasinya sendiri tetap ada.
2. **Belum ada versi berlaku menghasilkan 200 dengan `currentVersion: null`, bukan 404.** Dengan begitu 404 hanya punya satu arti (regulasi tidak ada), dan ketiga endpoint memakai bentuk yang sama untuk keadaan ini.
3. **Slug berformat salah dijawab 404, bukan 400, dan diperiksa sebelum query.** Bagi klien, slug yang mustahil dan slug yang tidak terdaftar sama-sama berarti "regulasi itu tidak ada". Lapisan data tidak dipanggil untuk slug berformat salah.

## 4. Format galat

Semua galat memakai Problem Details (RFC 9457) dengan `Content-Type: application/problem+json` dan anggota `type`, `title`, `status`, `detail`, `instance`.

- **Satu pembuat respons galat** (`lib/api/masalah.ts`) dipakai semua endpoint, sehingga bentuknya tidak bisa berbeda antarendpoint. Status HTTP dan `status` di body dibaca dari satu tabel.
- **`type` berbentuk path relatif penuh** (`/problems/<jenis>`). RFC 9457 menganjurkan URI absolut bila memungkinkan, dan bila relatif, memakai path penuh. Kyrion belum punya domain produksi yang tetap, dan mengganti `type` kelak berarti perubahan yang tidak kompatibel, jadi dipilih bentuk yang tidak bergantung pada domain.
- **`errors` hanya ada pada galat validasi**, berisi satu butir per parameter yang bermasalah, supaya klien bisa menunjukkan letak kesalahannya.
- **Galat 500 selalu berisi kalimat umum yang tetap.** Fungsi pembuat galat tidak menerima objek galat sama sekali, sehingga pesan, nama, atau jejak tumpukan tidak mungkin terkirim. Log server hanya mencatat nama galat.
- **`instance` hanya memuat path**, tanpa query string, supaya nilai yang dikirim klien tidak dipantulkan kembali.

## 5. Validasi masukan

- Semua parameter divalidasi di server dengan Zod sebelum menyentuh data.
- **Skema bersifat ketat**: parameter yang tidak dikenal ditolak, tidak diabaikan. Salah ketik nama parameter langsung ketahuan, dan perilaku API tidak bergantung pada masukan yang tidak terdokumentasi.
- **Parameter yang diulang ditolak.** Tanpa aturan ini, `?date=A&date=B` bisa ditafsirkan berbeda oleh lapisan yang berbeda.
- **Kunci `__proto__` diperlakukan sebagai parameter biasa** dan ikut ditolak. Objek query disusun dengan `Object.fromEntries`, yang selalu membuat properti biasa.
- **Tanggal harus tanggal kalender yang sah** berformat `YYYY-MM-DD`; `2026-02-30` ditolak.
- Pola slug didefinisikan sekali dan dipakai oleh semua skema yang membutuhkannya.

## 6. Bentuk respons sukses

- **Pembungkus `{ "data": ... }`** dipakai di semua respons sukses. Ini memberi tempat untuk metadata (misalnya paginasi) tanpa mengubah bentuk yang sudah dipakai klien.
- **Daftar tidak memuat seluruh versi**, hanya versi yang berlaku. Riwayat lengkap tersedia di endpoint detail. Ini menjaga respons daftar tetap kecil.
- **`date` dikembalikan di respons versi berlaku**, yaitu tanggal acuan yang benar-benar dipakai. Bila klien tidak mengirim `date`, ia tetap tahu tanggal mana yang digunakan server.
- Nilai yang bisa tidak ada ditulis `null` secara eksplisit, bukan dihilangkan, supaya bentuk respons tetap.

## 7. Aturan versi berlaku

Versi yang berlaku pada tanggal T adalah, di antara versi yang pernah disahkan (Sah atau Digantikan), versi dengan tanggal mulai berlaku paling akhir yang tidak melewati T.

- Aturan ini ditulis **satu kali** sebagai fungsi murni di `lib/domain/versi.ts` dan dipanggil oleh halaman maupun API. Route Handler tidak memuat aturan bisnis.
- Untuk tanggal lampau, hasilnya bisa versi yang kini berstatus Digantikan. Itu sengaja: yang ditanyakan adalah ketentuan yang berlaku saat itu.
- Versi Draf dan Dibatalkan tidak pernah keluar dari API baca. Penyaringannya ada di lapisan data.
- "Hari ini" dihitung di zona waktu Asia/Jakarta, bukan UTC.

## 8. Tembolok

Semua respons memakai `Cache-Control: no-store`. Isi regulasi bisa berubah saat versi baru disahkan, dan respons memerlukan sesi, sehingga respons tidak boleh disimpan perantara.

## 9. Yang belum ada

| Hal | Keadaan | Rencana |
|---|---|---|
| Paginasi daftar | Tidak ada | Belum dibutuhkan pada jumlah regulasi saat ini; pembungkus `data` memungkinkan penambahan kelak |
| Penentu seri dua versi bertanggal sama | Sisi tulis: pengesahan ditolak bila ada versi lain pada regulasi yang sama berstatus SAH atau DIGANTIKAN dengan tanggal berlaku sama. Pemeriksaannya di `isiTransaksiSahkan` (`lib/data/pengesahan.ts`), di dalam transaksi pengesahan; hasilnya `VersionEffectiveDateTakenError`, dijawab 409 (API) atau `PESAN_TANGGAL_KEMBAR` (UI). UI juga punya pra-cek (`alasanTolakSahkan`) untuk pesan cepat. Sisi baca: tetap mengikuti urutan dari lapisan data, masih sementara. | Perlindungan terhadap dua pengesahan bersamaan atas tanggal yang sama belum diuji. |
| Lisensi dan URL produksi di spesifikasi | Belum ada; dua peringatan Redocly dibiarkan | Diisi saat berkas lisensi dan deployment tersedia |

## 10. Pengujian

- Setiap endpoint punya uji Vitest pada handler-nya, mencakup jalur berhasil dan jalur gagal (400, 401, 403, 404, 409, 500, 503, sesuai endpoint).
- Lapisan data ditiru di uji handler, sehingga uji tidak membutuhkan basis data dan memeriksa handler saja. Yang **tidak** dibuktikan uji ini adalah kueri ke basis data sungguhan; itu diperiksa dengan permintaan nyata ke server pengembangan.
- Aturan versi berlaku diuji terpisah sebagai fungsi murni.
- Spesifikasi diperiksa dengan `npx @redocly/cli lint docs/api/openapi.yaml` (keluarannya: `docs/api/bukti-lint-redocly.txt`).

Cara menjalankan uji: `npm test` di `apps/web`.

## 11. Label status Digantikan

Label "Digantikan" dihitung saat dibaca (`terapkanStatusTurunan` di `lib/domain/versi.ts`, dipasang di lapisan data), bukan disimpan. Status SAH dan DIGANTIKAN yang tersimpan diperlakukan sama sebagai "pernah disahkan".

- **Nilai di basis data tidak sama dengan label di aplikasi.** Hasil `psql` yang menampilkan SAH untuk versi yang di aplikasi tampil Digantikan bukan galat.
- **Versi yang disahkan dengan tanggal berlaku lebih awal dari versi berlaku saat ini langsung tampil Digantikan.** Itu disengaja: yang menentukan label adalah tanggal berlaku terhadap hari ini (WIB), bukan urutan pengesahan.
- Guard dan operasi tulis (`versiBolehDiubah`, `versiBolehDihapus`, filter `DRAF`) tetap memakai status tersimpan.

## 12. Autentikasi dan akses

Autentikasi memakai cookie sesi (skema `cookieSesi` di `openapi.yaml`), bukan token bearer. Keputusan hak peran ada di fungsi murni `putuskanAkses` (`lib/akses/keputusan.ts`), dan `jagaRoute` (`lib/akses/jaga-route.ts`) menerjemahkannya menjadi respons untuk Route Handler.

- **Tanpa sesi: 401.** `putuskanAkses` mengembalikan "masuk" bila sesi kosong; `jagaRoute` menjawab `/problems/unauthenticated` dengan `detail` "Perlu masuk.".
- **Peran tidak cukup: 403.** Peran ADMIN selalu diizinkan, SIVITAS hanya untuk syarat "masuk", dan peran lain, termasuk yang tidak dikenal, ditolak (deny by default). Jawabannya `/problems/forbidden` dengan `detail` "Tidak diizinkan.".
- **Pengesahan khusus Admin.** Handler `POST` di `app/api/v1/regulations/[slug]/versions/[versionId]/approval/route.ts` memanggil `jagaRoute("admin", ...)`, sehingga peran selain ADMIN dijawab 403.
- **Origin.** `periksaOrigin` (`lib/api/origin.ts`) dipakai rute berbasis cookie (`POST`, `DELETE`), karena Next.js hanya memeriksa Origin untuk Server Action. Origin yang diizinkan adalah origin `BETTER_AUTH_URL`; permintaan tanpa header `Origin` ditolak (tanpa fallback `Referer`) dengan 403 dan `detail` "Origin tidak diizinkan.". Pada endpoint pengesahan, pemeriksaan ini dipanggil sebelum `jagaRoute`, sehingga permintaan anonim dengan Origin salah dijawab 403, bukan 401.

## 13. Penandatangan belum siap (503)

Pengesahan gagal tertutup bila penandatangan belum siap. Ada dua pemicu di kode:

- Kunci privat atau keyring tidak valid. `siapkanPenandatanganDariEnv` (`lib/data/penandatangan-env.ts`) membungkus galat penandatangan dan keyring menjadi `PenandatanganBelumSiapError` dengan pesan tetap, tanpa jalur berkas.
- Kunci tidak terdaftar atau tidak berstatus AKTIF di tabel `signing_keys` saat transaksi pengesahan (`lib/data/pengesahan.ts`).

API menjawab 503 `/problems/service-unavailable` (Galat503 di `openapi.yaml`); Server Action menampilkan `PESAN_KUNCI_BELUM_SIAP`. Penyebabnya konfigurasi sisi operator, bukan kesalahan permintaan.

## 14. Jalur `/api` yang tidak dikenal

`app/api/[[...jalur]]/route.ts` menjawab 404 `application/problem+json` (`detail` "Sumber daya tidak ditemukan.") untuk GET, POST, PUT, PATCH, dan DELETE. Route ini sengaja tanpa `jagaRoute` dan `periksaOrigin`, sehingga anonim maupun pengguna masuk mendapat jawaban yang sama dan keberadaan jalur tidak bocor. Segmen yang lebih spesifik (`auth/[...all]`, `v1/...`) tetap diutamakan router.
