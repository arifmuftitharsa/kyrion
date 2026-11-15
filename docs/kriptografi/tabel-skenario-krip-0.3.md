# Tabel skenario uji krip-0.3 (F-32 tanda tangan pengesahan, F-33 verifikasi berkas)

Hasil uji otomatis di bawah diambil dari [bukti/krip-0.3-vitest.txt](bukti/krip-0.3-vitest.txt)
saja (Vitest v5.0.4, mulai 17:58:20). Bukti manual hanya merujuk berkas di `docs/kriptografi/bukti/`.
Tidak ada hasil yang ditambahkan dari sumber lain.

Ringkasan dari `krip-0.3-vitest.txt` apa adanya:

```
 Test Files  19 passed (19)
      Tests  270 passed | 3 skipped (273)
```

Tabel memuat 159 dari 273 uji: semua uji dari `verifikasi-pengesahan.test.ts`, `actions.test.ts`
(verifikasi), `tanda-tangan.test.ts`, `payload-pengesahan.test.ts`, `keyring.test.ts`,
`penandatangan.test.ts`, `penandatangan-env.test.ts`, `operasi-kunci.test.ts`, `versions.test.ts`,
blok `isiTransaksiSahkan` di `pengesahan.test.ts`, ditambah tiga uji F-31 dan F-30 yang namanya
cocok dengan skenario A-04 dan A-05 (`fingerprint.test.ts` satu uji, `verifikasi.test.ts` dua uji).
Sisa 114 uji tidak dimasukkan karena bukan bagian F-32 dan F-33: `kanonis` 20, `fingerprint` 10,
`mac` 9, `verifikasi` 25, `kunci` 20, `data-terlindung` 12 (F-31 atau sebelumnya; lihat
[tabel-skenario.md](tabel-skenario.md)), serta `versi-tulis` 7, `audit` 5, `sesi` 3, dan blok
`isiTransaksiBatalkan` 3.

Tiga uji berstatus dilewati di seluruh run: dua di `kunci.test.ts` (tidak dimasukkan tabel) dan satu
di `penandatangan.test.ts` (baris T-07).

## Cara membaca

- **Nama uji** memakai bentuk di `krip-0.3-vitest.txt`: `berkas > blok > nama uji`, tanpa durasi
  di ujung baris. Bila satu sel memuat beberapa uji, awalan `berkas > blok` ditulis sekali pada
  "Awalan", lalu nama ujinya satu per baris persis seperti di berkas bukti.
- **ID, Skenario, Jenis, Kritis** pada bagian 1 mengikuti definisi skenario dari rancangan Tugas 3.
  Kritis "ya" bila skenario itu bertanda K di rancangan. Kolom Kritis tidak diisi penilaian lain.
- Satu skenario boleh punya beberapa uji. Uji dipetakan ke skenario hanya bila namanya jelas menguji
  perilaku skenario itu. Uji yang sama bisa muncul di dua skenario (ditulis di kolom Nama uji).
- **Tingkat bukti.** Semua uji otomatis di sini berjalan pada fungsi murni, tiruan transaksi Prisma
  (`isiTransaksiSahkan` memakai `buatTx` dengan `vi.fn`), atau Server Action dengan layanan tiruan
  (`actions.test.ts` meniru `wajibAdmin` dan `verifikasiBerkasDenganDb`). Tidak ada uji otomatis
  yang menjalankan basis data nyata, `storage/`, atau browser. Bukti manual hanya yang tercantum di
  bagian 2.
- Satu uji ber-awalan "A-06" di nama ujinya ("A-06 hanya DRAF/DIBATALKAN yang cocok...") dipetakan
  menurut definisi di bagian 1, yaitu ke B-04, bukan menurut awalan di nama uji.

## 1. Pemetaan skenario ke bukti

| ID | Skenario | Jenis | Kritis | Nama uji (otomatis) | Bukti manual | Hasil uji |
|---|---|---|---|---|---|---|
| A-01 | Pembungkus tandatangani dan verifikasi dengan vektor RFC 8032 bagian 7.1 TEST 1 | positif | ya | Awalan: `lib/crypto/tanda-tangan.test.ts > RFC 8032 TEST 1`<br>`tandatangani menghasilkan tanda tangan RFC`<br>`verifikasi tanda tangan RFC lolos` | - | lulus (2 dari 2) |
| A-02 | Sahkan versi Draf berberkas: status Sah, signature 64 B, `signing_key_id` = kunci aktif | positif | tidak | Awalan: `lib/data/pengesahan.test.ts > isiTransaksiSahkan`<br>`menulis status, pengesah, waktu, tanda tangan dengan penanda updatedAt, lalu audit di tx yang sama`<br>`tanda tangan > 64 byte dan terverifikasi dengan node:crypto atas payload pengesahan` | - | lulus (2 dari 2) |
| A-03 | Versi lama yang Digantikan tetap lolos verifikasi | positif | tidak | `lib/crypto/verifikasi-pengesahan.test.ts > positif > asli-digantikan: ada versi lebih baru yang sudah berlaku` | - | lulus |
| A-04 | Ubah satu byte berkas di `storage/` | negatif | ya | `lib/crypto/fingerprint.test.ts > verifyFingerprint > mengembalikan true untuk data asli dan false bila satu byte diubah`<br>`lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak bila hanya byte PDF yang diganti (langkah verifyFingerprint)` | - | lulus (2 dari 2) |
| A-05 | Ubah `effective_date` langsung di DB | negatif | ya | Awalan: `lib/crypto/verifikasi-pengesahan.test.ts > negatif: tanda tangan dan payload`<br>`A-05 effectiveDate diubah`<br>`A-05 versionNumber diubah`<br>`A-05 fileName diubah`<br>`A-05 fileSize diubah`<br>Lainnya:<br>`lib/crypto/verifikasi.test.ts > periksaIntegritasVersi > menolak bila field effectiveDate diubah`<br>`lib/data/pengesahan.test.ts > isiTransaksiSahkan > tanda tangan > ubah effectiveDate membuat verifikasi gagal` | - | lulus (6 dari 6) |
| A-06 | Ubah status Draf ke Sah langsung di DB tanpa tanda tangan | negatif | ya | `lib/crypto/verifikasi-pengesahan.test.ts > negatif: berkas dan status > A-06 status DRAF diubah ke SAH tanpa tanda tangan` | - (UJI-SAH-1 di M-03 bukan bukti A-06) | lulus |
| A-07 | Salin `signature` dan `signing_key_id` dari versi lain | negatif | ya | `lib/crypto/verifikasi-pengesahan.test.ts > negatif: tanda tangan dan payload > A-07 signature + signingKeyId disalin dari versi lain` | - | lulus |
| A-08 | Ganti `approved_by_id` | negatif | tidak | Awalan: `lib/crypto/verifikasi-pengesahan.test.ts > negatif: tanda tangan dan payload`<br>`A-08 approvedById diubah`<br>`A-08 approvedAt diubah (masih dalam masa kunci)`<br>Lainnya:<br>`lib/data/pengesahan.test.ts > isiTransaksiSahkan > tanda tangan > ubah approvedById membuat verifikasi gagal` | - | lulus (3 dari 3) |
| A-09 | `signing_key_id` diganti ke kunci lain yang sah | negatif | ya | `lib/crypto/verifikasi-pengesahan.test.ts > negatif: tanda tangan dan payload > A-09 signingKeyId diubah ke kunci lain yang terdaftar`<br>`lib/data/pengesahan.test.ts > isiTransaksiSahkan > tanda tangan > ubah signingKeyId membuat verifikasi gagal` | - | lulus (2 dari 2) |
| A-10 | Berkas kunci privat tidak ada atau kunci tidak siap saat sahkan: pengesahan ditolak, tidak ada perubahan | negatif | ya | Awalan: `lib/data/versions.test.ts > sahkanVersiDenganAudit`<br>`penandatangan tidak siap: ditolak sebelum transaksi dibuka`<br>Awalan: `lib/data/pengesahan.test.ts > isiTransaksiSahkan`<br>`kunci DB tidak ada atau bukan AKTIF ditolak tanpa updateMany dan audit`<br>`kegagalan menandatangani (kunci privat rusak) tanpa updateMany dan audit`<br>Awalan: `lib/data/penandatangan-env.test.ts > siapkanPenandatanganDariEnv`<br>`PenandatanganTidakValid dibungkus PenandatanganBelumSiapError dengan pesan tetap tanpa jalur berkas`<br>`KeyringTidakValid dibungkus PenandatanganBelumSiapError dengan pesan tetap tanpa jalur berkas`<br>Awalan: `lib/crypto/penandatangan.test.ts`<br>`muatKunciPrivat > menolak lokasi belum diatur dan berkas tidak ada`<br>`siapkanPenandatangan > galat bila kunci tidak ada di keyring`<br>`siapkanPenandatangan > galat bila kunci ada tetapi dirotasi atau dicabut`<br>`siapkanPenandatangan > galat bila keyring tidak ada atau lokasinya belum diatur`<br>`siapkanPenandatangan > PEM bukan Ed25519 atau rusak = galat` | - | lulus (10 dari 10) |
| B-01 | Unggah PDF identik versi berlaku: "Asli dan sah" | positif | tidak | `lib/crypto/verifikasi-pengesahan.test.ts > positif > asli-sah: versi berlaku hari ini` | [krip-0.3-k6-asli-dan-tanpa-ttd.png](bukti/krip-0.3-k6-asli-dan-tanpa-ttd.png): UJI-D2 "Asli dan sah", Pedoman Akademik, 2026-10-06 | lulus |
| B-02 | Unggah PDF versi yang Digantikan: "Asli tetapi digantikan" | positif | tidak | `lib/crypto/verifikasi-pengesahan.test.ts > positif > asli-digantikan: ada versi lebih baru yang sudah berlaku` (uji yang sama dengan A-03) | - | lulus |
| B-03 | PDF diubah satu byte: "Tidak cocok" | negatif | ya | - (tidak ada uji otomatis yang namanya menyebut satu byte pada pemeriksaan F-33) | [krip-0.3-k6-satu-byte.png](bukti/krip-0.3-k6-satu-byte.png): "Tidak cocok: berkas tidak dikenal" | tidak ada uji otomatis |
| B-04 | PDF identik versi Draf atau Dibatalkan: "Tidak cocok" (sama dengan berkas tidak dikenal) | negatif | tidak | `lib/crypto/verifikasi-pengesahan.test.ts > negatif: berkas dan status > A-06 hanya DRAF/DIBATALKAN yang cocok: hasil SAMA dengan tidak dikenal` (bernama "A-06" di berkas uji, tetapi isinya sama dengan B-04) | - | lulus |
| B-05 | Rotasi kunci: versi lama tetap lolos, pengesahan baru memakai kunci baru | positif | tidak | `lib/crypto/verifikasi-pengesahan.test.ts > positif > B-05 kunci DIROTASI tetap sah untuk approvedAt <= dirotasiPada`<br>`lib/crypto/keyring.test.ts > kunciBolehMemverifikasi > dirotasi: tepat di dirotasiPada boleh, 1 ms sesudahnya tidak`<br>`lib/crypto/operasi-kunci.test.ts > putarKunciOperator > lama ke DIROTASI dulu, baru baru AKTIF; keyring konsisten` | Pendukung status kunci: M-02 ([krip-0.3-k4-keyring.json](bukti/krip-0.3-k4-keyring.json)), bukan bukti verifikasinya | lulus (3 dari 3) |
| B-06 | Kunci dicabut: "Tidak cocok: kunci dicabut" | negatif | ya | `lib/crypto/verifikasi-pengesahan.test.ts > negatif: kunci > B-06 kunci dicabut`<br>`lib/crypto/keyring.test.ts > kunciBolehMemverifikasi > dicabut selalu ditolak` | Pendukung status kunci: M-02 ([krip-0.3-k4-keyring.json](bukti/krip-0.3-k4-keyring.json)), bukan bukti verifikasinya | lulus (2 dari 2) |
| B-07 | Kunci publik palsu di tabel tanpa keyring: "kunci tidak sinkron" | negatif | ya | `lib/crypto/verifikasi-pengesahan.test.ts > negatif: kunci > B-07 kunci ada di tabel tetapi tidak di keyring`<br>`lib/crypto/verifikasi-pengesahan.test.ts > negatif: kunci > kunci publik tabel berbeda dari keyring` | - | lulus (2 dari 2) |
| B-08 | Bukan PDF atau lebih dari 10 MB: ditolak | negatif | tidak | Awalan: `app/admin/verifikasi/actions.test.ts > periksaBerkas`<br>`B-08 bukan PDF ditolak`<br>`B-08 di atas 10 MB ditolak` | - | lulus (2 dari 2) |
| B-09 | Sivitas membuka `/admin/verifikasi`: 404 | negatif | tidak | `app/admin/verifikasi/actions.test.ts > periksaBerkas > B-09 Sivitas: wajibAdmin melempar notFound, layanan tidak dipanggil` (tingkat Server Action; `wajibAdmin` ditiru) | - | lulus |

## 2. Uji manual

Hanya merujuk berkas bukti. Isinya tidak dihasilkan ulang untuk dokumen ini.

Dipetakan ke skenario:

| Skenario | Berkas bukti | Isi |
|---|---|---|
| B-01 | [krip-0.3-k6-asli-dan-tanpa-ttd.png](bukti/krip-0.3-k6-asli-dan-tanpa-ttd.png) | Halaman `/admin/verifikasi`: "Hasil: Asli dan sah", regulasi Pedoman Akademik, versi UJI-D2, tanggal berlaku 2026-10-06, status Sah |
| B-03 | [krip-0.3-k6-satu-byte.png](bukti/krip-0.3-k6-satu-byte.png) | Halaman `/admin/verifikasi`: "Hasil: Tidak cocok", "Berkas tidak dikenal: tidak cocok dengan versi regulasi yang pernah disahkan." |

Uji manual tambahan (tidak dipetakan ke A atau B, kecuali pendukung yang disebut):

| ID | Berkas bukti | Isi |
|---|---|---|
| M-01 | [krip-0.3-k3-probe.txt](bukti/krip-0.3-k3-probe.txt) | 14 probe batasan skema basis data (P01 sampai P14), masing-masing berlabel "harus BERHASIL" atau "harus GAGAL" disertai nama constraint dan diikuti keluaran `psql`; semuanya sesuai harapan. Mencakup `signing_keys_id_hex_check`, `signing_keys_public_key_len_check`, `signing_keys_status_stempel_check`, `signing_keys_satu_aktif_idx`, `versions_signature_len_check`, `versions_signature_kunci_check`, dan `versions_signing_key_id_fkey` |
| M-02 | [krip-0.3-k4-keyring.json](bukti/krip-0.3-k4-keyring.json) | Keyring setelah operasi buat, putar, dan cabut: dua entri, satu `dicabut` (dengan `dirotasiPada` dan `dicabutPada` terisi) dan satu `aktif`; hanya kunci publik. Bukti **pendukung** status kunci untuk B-05 dan B-06, bukan bukti verifikasinya |
| M-03 | [krip-0.3-k6-asli-dan-tanpa-ttd.png](bukti/krip-0.3-k6-asli-dan-tanpa-ttd.png) (gambar yang sama dengan B-01) | Gambar yang sama juga menampilkan UJI-SAH-1 (versi Sah dari seed, tanpa tanda tangan): "Hasil: Tidak cocok", "Versi tidak bertanda tangan.", Pedoman Akademik, tanggal berlaku 2026-10-01. Tidak diklaim sebagai A-06 |

## 3. Uji otomatis tambahan (tidak cocok dengan definisi skenario mana pun)

Uji yang relevan untuk F-32 dan F-33 tetapi namanya tidak jelas menguji salah satu A-01 sampai
B-09. Kolom Kritis diberi "-" karena tidak ada tanda K untuk uji tambahan. ID `T-xx` hanya urutan
di dokumen ini.

| ID | Cakupan | Jenis | Kritis | Nama uji | Hasil |
|---|---|---|---|---|---|
| T-01 | Ed25519 pada pembungkus: tanda tangan 64 byte, pesan atau tanda tangan diubah 1 byte, kunci publik lain, panjang salah, masukan sampah, `idKunci` | positif dan negatif | - | Awalan: `lib/crypto/tanda-tangan.test.ts`<br>`pasangan kunci dan tanda tangan > tanda tangan 64 byte dan lolos verifikasi`<br>`pasangan kunci dan tanda tangan > pesan diubah 1 byte: false`<br>`pasangan kunci dan tanda tangan > tanda tangan diubah 1 byte: false`<br>`pasangan kunci dan tanda tangan > kunci publik lain: false`<br>`pasangan kunci dan tanda tangan > panjang tanda tangan 63 dan 65 byte: false`<br>`pasangan kunci dan tanda tangan > masukan sampah: false dan tidak melempar`<br>`pasangan kunci dan tanda tangan > dua kali tandatangani pesan sama: identik`<br>`idKunci > 32 hex huruf kecil, deterministik, beda antarkunci` | lulus (8 dari 8) |
| T-02 | Payload pengesahan: deterministik; tiap field berubah mengubah payload; beda dari `kanonisasiVersi`; validasi `Date`, `approvedById`, `signingKeyId` | positif dan negatif | - | Awalan: `lib/crypto/payload-pengesahan.test.ts > bangunPayloadPengesahan`<br>`deterministik`<br>`mengubah id mengubah payload`<br>`mengubah regulationId mengubah payload`<br>`mengubah versionNumber mengubah payload`<br>`mengubah effectiveDate mengubah payload`<br>`mengubah fileSha256 mengubah payload`<br>`mengubah fileName mengubah payload`<br>`mengubah fileSize mengubah payload`<br>`mengubah approvedById mengubah payload`<br>`mengubah approvedAt mengubah payload`<br>`mengubah signingKeyId mengubah payload`<br>`approvedAt beda 1 ms: berbeda`<br>`berbeda dari kanonisasiVersi dengan tujuh field sama (pemisah domain)`<br>`menolak Date tidak valid`<br>`menolak approvedById bukan UUID, pesan tanpa nilai`<br>`menerima approvedById UUIDv4 dan UUIDv7`<br>`menolak signingKeyId bukan 32 hex huruf kecil: abc`<br>`menolak signingKeyId bukan 32 hex huruf kecil: BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`<br>`menolak signingKeyId bukan 32 hex huruf kecil: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`<br>`menolak signingKeyId bukan 32 hex huruf kecil: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`<br>`menolak signingKeyId bukan 32 hex huruf kecil: gggggggggggggggggggggggggggggggg` | lulus (21 dari 21) |
| T-03 | `isiTransaksiSahkan` selain yang sudah dipetakan: tiap field payload lain diubah membuat verifikasi gagal; versi bukan `DRAF`; tanpa berkas; tanggal kembar; `count` 0; galat audit | positif dan negatif | - | Awalan: `lib/data/pengesahan.test.ts > isiTransaksiSahkan`<br>`tanda tangan > ubah approvedAt membuat verifikasi gagal`<br>`tanda tangan > ubah versionNumber membuat verifikasi gagal`<br>`tanda tangan > ubah fileSha256 membuat verifikasi gagal`<br>`tanda tangan > ubah fileName membuat verifikasi gagal`<br>`tanda tangan > ubah fileSize membuat verifikasi gagal`<br>`versi tidak ada sebagai DRAF melempar NotEditable tanpa tanda tangan dan audit`<br>`tanpa berkas lengkap ditolak sebelum penandatanganan`<br>`tanggal kembar ditolak sebelum penandatanganan`<br>`count 0 melempar NotEditable dan audit tidak dipanggil`<br>`galat catatAudit merambat` | lulus (10 dari 10) |
| T-04 | `sahkanVersiDenganAudit`: membentuk keterangan dan waktu; galat transaksi diteruskan | positif dan negatif | - | Awalan: `lib/data/versions.test.ts > sahkanVersiDenganAudit`<br>`membentuk keterangan dan waktu, lalu memanggil isiTransaksiSahkan di transaksi`<br>`galat dari transaksi diteruskan apa adanya` | lulus (2 dari 2) |
| T-05 | `siapkanPenandatanganDariEnv`: lokasi dari env; galat lain tidak dibungkus | positif dan negatif | - | Awalan: `lib/data/penandatangan-env.test.ts > siapkanPenandatanganDariEnv`<br>`meneruskan lokasi dari env dan mengembalikan penandatangan`<br>`galat lain tidak dibungkus` | lulus (2 dari 2) |
| T-06 | Pemuat kunci privat dan `siapkanPenandatangan`: PEM Ed25519 sah, PEM RSA, PEM rusak, kunci cocok dengan entri aktif | positif dan negatif | - | Awalan: `lib/crypto/penandatangan.test.ts`<br>`muatKunciPrivat > memuat PEM Ed25519 yang bisa menandatangani`<br>`muatKunciPrivat > menolak PEM RSA`<br>`muatKunciPrivat > PEM rusak ditolak dan pesan galat tidak memuat PEM`<br>`siapkanPenandatangan > lolos bila kunci privat cocok dengan entri aktif` | lulus (4 dari 4) |
| T-07 | Berkas kunci privat yang bisa dibaca grup atau pengguna lain ditolak (khusus POSIX) | negatif | - | `lib/crypto/penandatangan.test.ts > muatKunciPrivat > menolak berkas yang bisa dibaca grup atau pengguna lain` | dilewati |
| T-08 | Keyring: `parseKeyring` menerima yang valid dan menolak id tidak cocok, dua aktif, id ganda, status, stempel waktu, field tak dikenal, versi, kunci bukan SPKI Ed25519, JSON rusak; siklus tambah, putar, cabut; `kunciBolehMemverifikasi` sebelum `dibuatPada`; baca dan tulis berkas | positif dan negatif | - | Awalan: `lib/crypto/keyring.test.ts`<br>`parseKeyring > menerima keyring valid`<br>`parseKeyring > menolak: id tidak cocok dengan kunci`<br>`parseKeyring > menolak: dua aktif`<br>`parseKeyring > menolak: id ganda`<br>`parseKeyring > menolak: status tidak dikenal`<br>`parseKeyring > menolak: aktif dengan dirotasiPada`<br>`parseKeyring > menolak: aktif dengan dicabutPada`<br>`parseKeyring > menolak: dirotasi tanpa dirotasiPada`<br>`parseKeyring > menolak: dicabut tanpa dicabutPada`<br>`parseKeyring > menolak: field tak dikenal di entri`<br>`parseKeyring > menolak: field tak dikenal di akar`<br>`parseKeyring > menolak: versi salah`<br>`parseKeyring > menolak kunci publik yang bukan SPKI Ed25519 (RSA, sampah, base64 longgar)`<br>`parseKeyring > menolak JSON rusak tanpa membocorkan isinya`<br>`siklus kunci > tambah, putar, lalu cabut dari aktif dan dari dirotasi`<br>`siklus kunci > menolak: cabut dua kali, cabut id tak dikenal, putar tanpa aktif, tambah saat sudah ada aktif`<br>`siklus kunci > menolak kunci yang sudah ada dan kunci bukan Ed25519`<br>`siklus kunci > tidak mengubah masukan`<br>`kunciBolehMemverifikasi > 1 ms sebelum dibuatPada ditolak (aktif dan dirotasi); tepat di dibuatPada boleh`<br>`berkas keyring > berkas tidak ada adalah galat, bukan keyring kosong`<br>`berkas keyring > berkas rusak adalah galat`<br>`berkas keyring > tulis lalu baca kembali sama, dan tidak meninggalkan berkas sementara`<br>`berkas keyring > menolak menulis keyring tidak valid dan tidak mengubah berkas lama` | lulus (23 dari 23) |
| T-09 | Operasi operator kunci selain yang sudah dipetakan: pemetaan status, `didalamRepository`, `buatKunci`, `putarKunciOperator`, `cabutKunciOperator`, kegagalan di tengah (rollback, keadaan tidak pasti) | positif dan negatif | - | Awalan: `lib/crypto/operasi-kunci.test.ts`<br>`pemetaan status > dua arah, nilai tak dikenal ditolak`<br>`didalamRepository > membedakan dalam, luar, dan folder bernama mirip`<br>`buatKunci > membuat berkas privat, entri keyring publik-saja, dan baris DB AKTIF`<br>`buatKunci > kata kunci: id hasil buat == idKunci(kunci publik di berkas keyring)`<br>`buatKunci > menolak berkas --out yang sudah ada tanpa menimpanya`<br>`buatKunci > menolak --out dan keyring di dalam repo, menerima folder bernama mirip di luar`<br>`buatKunci > menolak --out sama dengan berkas keyring`<br>`buatKunci > menolak bila keyring sudah punya kunci aktif; tidak ada berkas privat dibuat`<br>`buatKunci > menolak keyring hilang tetapi tabel berisi; berkas privat dihapus, DB rollback`<br>`buatKunci > keyring ada tetapi rusak ditolak (bukan dianggap kosong)`<br>`putarKunciOperator > menolak tanpa kunci aktif`<br>`putarKunciOperator > menolak keyring belum ada`<br>`putarKunciOperator > DB tidak cocok (updateMany count 0): rollback, privat baru dihapus, keyring utuh`<br>`cabutKunciOperator > mencabut kunci AKTIF: status dan revoked_at benar, peringatan tak ada aktif`<br>`cabutKunciOperator > mencabut kunci DIROTASI: kunci aktif tetap ada`<br>`cabutKunciOperator > menolak id tak dikenal, id berformat salah, dan kunci sudah dicabut`<br>`cabutKunciOperator > menolak keyring di dalam repo`<br>`kegagalan di tengah > tulisKeyring gagal di dalam tx: DB rollback, privat baru dihapus, keyring lama utuh`<br>`kegagalan di tengah > rm pembersihan gagal: galat asli tetap yang diteruskan`<br>`kegagalan di tengah > commit gagal setelah keyring ditulis: keyring tidak diubah, privat tidak dihapus, galat tidak pasti` | lulus (20 dari 20) |
| T-10 | Verifikasi berkas, kasus sah selain yang dipetakan: versi berlaku di masa depan; duplikat sha256 | positif | - | Awalan: `lib/crypto/verifikasi-pengesahan.test.ts > positif`<br>`versi berlaku di masa depan tetap asli-sah`<br>`duplikat sha256: satu hasil per kandidat, kandidat gagal tidak tersembunyi` | lulus (2 dari 2) |
| T-11 | Verifikasi berkas, berkas dan status: tanpa kandidat; tag HMAC tidak valid atau kosong; versi `SAH` seed tanpa signature; `signature`, `signingKeyId`, `approvedById`, atau `approvedAt` null; hasil tidak-cocok tanpa status | negatif | - | Awalan: `lib/crypto/verifikasi-pengesahan.test.ts > negatif: berkas dan status`<br>`berkas tidak dikenal (tanpa kandidat): tanpa metadata versi`<br>`tag HMAC tidak valid`<br>`tag kosong`<br>`versi SAH seed tanpa signature`<br>`signature null: tanpa tanda tangan`<br>`signingKeyId null: tanpa tanda tangan`<br>`approvedById null: tanpa tanda tangan`<br>`approvedAt null: tanpa tanda tangan`<br>`hasil tidak-cocok dari kandidat memuat identitas versi tanpa status` | lulus (9 dari 9) |
| T-12 | Verifikasi berkas, kunci selain yang dipetakan: `approvedAt` setelah kunci dirotasi atau sebelum kunci dibuat; kunci di keyring tidak di tabel; status, `rotatedAt`, `revokedAt`, `createdAt` tabel berbeda dari keyring | negatif | - | Awalan: `lib/crypto/verifikasi-pengesahan.test.ts > negatif: kunci`<br>`approvedAt setelah kunci dirotasi`<br>`approvedAt sebelum kunci dibuat`<br>`kunci ada di keyring tetapi tidak di tabel`<br>`status tabel berbeda dari keyring`<br>`status tabel tidak dikenal`<br>`rotatedAt tabel berbeda dari dirotasiPada keyring (1 ms)`<br>`revokedAt tabel berbeda dari dicabutPada keyring (1 ms)`<br>`createdAt tabel berbeda dari dibuatPada keyring -> kunci-tidak-sinkron` | lulus (8 dari 8) |
| T-13 | Verifikasi berkas, tanda tangan dan payload selain yang dipetakan: tanda tangan diubah satu byte; panjang bukan 64 byte; galat payload dihitung tidak-cocok, bukan lemparan | negatif | - | Awalan: `lib/crypto/verifikasi-pengesahan.test.ts > negatif: tanda tangan dan payload`<br>`tanda tangan diubah satu byte`<br>`tanda tangan panjang bukan 64 byte`<br>`galat payload (approvedById bukan UUID) = tidak-cocok, bukan lemparan` | lulus (3 dari 3) |
| T-14 | Hasil verifikasi tidak memuat tanda tangan, kunci, atau tag | negatif | - | `lib/crypto/verifikasi-pengesahan.test.ts > kerahasiaan hasil > tidak memuat tanda tangan, kunci, atau tag` | lulus |
| T-15 | `periksaBerkas` selain B-08 dan B-09: tanpa berkas dan berkas kosong; PDF valid memberi hasil dari layanan dan berkas tidak ditulis ke penyimpanan; galat operasional memberi galat umum tanpa detail | positif dan negatif | - | Awalan: `app/admin/verifikasi/actions.test.ts > periksaBerkas`<br>`tanpa berkas dan berkas kosong ditolak`<br>`PDF valid: hasil dari layanan; berkas tidak ditulis ke penyimpanan`<br>`galat operasional (keyring, kunci induk, DB): galat umum, bukan hasil verifikasi, tanpa detail` | lulus (3 dari 3) |

## 4. Skenario tanpa bukti

Setelah pemetaan di bagian 1 dan bukti manual di bagian 2, tidak ada skenario A-01 sampai A-10
atau B-01 sampai B-09 yang kosong: **belum ada bukti: tidak ada.**

Batasan yang perlu dibaca bersama bagian 1 (bukan skenario kosong, tetapi tingkat buktinya lebih
rendah dari bunyi definisinya):

- B-03 hanya punya bukti manual; tidak ada uji otomatis yang namanya menyebut satu byte pada
  pemeriksaan F-33.
- A-04 dipetakan ke uji pada fungsi murni di memori (`verifyFingerprint`, `periksaIntegritasVersi`),
  bukan ke berkas yang diubah di `storage/`. Uji `verifikasi.test.ts` memakai PDF pengganti, bukan
  perubahan satu byte.
- A-02, A-10, B-04, B-05, B-06, B-07 dan B-09 hanya terbukti pada tingkat fungsi murni, tiruan
  transaksi Prisma, atau Server Action dengan layanan tiruan. Bukti manual untuk B-05 dan B-06
  (M-02) hanya menunjukkan status kunci di keyring, bukan hasil verifikasi.
- B-04 dan A-06 punya awalan "A-06" yang sama pada dua uji di berkas uji; pemetaan di sini
  mengikuti definisi, sehingga uji "hanya DRAF/DIBATALKAN yang cocok" dipetakan ke B-04.
