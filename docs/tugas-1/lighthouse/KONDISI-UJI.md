# Kondisi Uji Lighthouse — Tugas 1 (v0.1)

| Halaman | URL | Skor Accessibility | Laporan |
|---|---|---|---|
| Beranda | http://localhost:3000/ | 100 | beranda.html |
| Detail regulasi | http://localhost:3000/regulasi/pedoman-akademik | 100 | detail.html |
| Verifikasi | http://localhost:3000/verifikasi | 100 | verifikasi.html |

- Tanggal uji: 13 Oktober 2026, 19.22–19.23 WIB
- Lighthouse: 13.4.1 (Chrome DevTools)
- Versi Chrome: 155.0.8059.40 (Official Build, 64-bit), Windows 11
- Mode: Navigation
- Perangkat emulasi: Mobile (Moto G Power), throttling Slow 4G simulasi
- Kategori: Accessibility
- Server: build produksi (`npm run build` lalu `npm start`)
- Jendela: Incognito (tanpa ekstensi)

## Pemeriksaan manual
Dilakukan 13 Oktober 2026 di Chrome 155 pada build produksi (localhost:3000).

- Navigasi hanya dengan Tab/Shift+Tab: semua elemen interaktif (tautan navigasi, filter kategori, kartu, field formulir, tombol) dapat dijangkau dan cincin fokus terlihat.
- Skip link "Lewati ke konten utama": muncul saat Tab pertama dan memindahkan fokus ke konten utama (URL berubah menjadi #konten).
- Submit formulir kosong: muncul tiga pesan galat per field ("Regulasi wajib dipilih.", "Versi wajib dipilih.", "Dokumen PDF wajib diunggah."); berkas .txt ditolak dengan pesan "Berkas harus berformat PDF."
- Zoom 200%: tidak ada gulir horizontal pada halaman beranda; konten tersusun ke bawah dan tidak terpotong.