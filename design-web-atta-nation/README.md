# Desain web ATTA NATION (Versi 1, "Meja Kerja")

Salinan desain dari canvas Claude, disimpan 10 November 2026.
Canvas aslinya: https://claude.ai/artifact/9fYeMMnDMdTabKF3oeFVUm

## Cara memakai folder ini

File `.dc.html` di folder `project/` adalah sumber desain tiap halaman. File ini
dibuat untuk dibuka di canvas, jadi kalau dibuka langsung di browser tampilannya
tidak lengkap. Gunanya sebagai acuan saat membangun web sungguhan: semua teks,
warna, ukuran, dan susunan ada di dalamnya.

Gambar di dalam file ditulis sebagai `/_blob/<kode>`. Padanannya di folder `assets/`:

| Kode di file | File di assets/ |
|---|---|
| f6864afe2895ff65bb51a3fd6b0191e4 | ds-vault-v2.jpg (layar Dokumen) |
| 74b8b9aa02882804108d57f055e3031c | ds-scanner-v2.jpg (layar Pindai) |
| bbf73f15023e1425bdab3d882da5d91e | ds-tools-v2.jpg (layar Alat PDF) |
| 043a01e2b50038b6bb17f5d859807447 | ds-settings-v2.jpg (layar Pengaturan) |
| 706a560c3e7f1abd3662c1f93eb73c75 | ds-backup-v2.jpg (layar Cadangan) |
| 11a4bba8b7177ece5ad9bd699029f3dc | ds-vault-dark-v2.jpg (mode gelap) |
| 0b2af35522f35052ee8e3eab07a0ac8c | simbol_putih.svg |
| 2d37d6aeb6108b73950ed09e2d2437ab | simbol_hitam.svg |
| 0f864ef5da7808a5a5e9b93238ab25fa | wordmark_putih.svg |
| a06aacb3c3417a77abdb1d9e2fc06eb1 | wordmark_hitam.svg |

## Daftar halaman

| File | Halaman |
|---|---|
| Main.dc.html | Beranda (slider proyek) |
| V1-Aplikasi.dc.html | Katalog aplikasi |
| V1-DocStudio.dc.html | Halaman produk ATTA DocStudio Pro |
| V1-Jasa.dc.html | Katalog jasa dan template (masih kosong) |
| V1-Template.dc.html | Detail template jasa (layout kosong) |
| V1-CaraBeli.dc.html | Cara beli dan memasang |
| V1-Tanya.dc.html | Tanya jawab |
| V1-Checkout.dc.html | Pembayaran |
| V1-Berhasil.dc.html | Status pembayaran: berhasil, menunggu, gagal |
| V1-Akun.dc.html | Masuk dan Akun saya (unduh ulang) |
| V1-Legal.dc.html | Privasi, syarat, refund (draf) |
| V1-Tentang.dc.html | Tentang ATTA NATION |
| V1-404.dc.html | Halaman tidak ditemukan |
| V1-HP-Beranda.dc.html | Beranda di layar HP (390 px) |
| V1-HP-Aplikasi.dc.html | Katalog di layar HP (390 px) |

## Gaya

- Huruf: Bricolage Grotesque (Google Fonts), tebal 800 untuk judul.
- Warna: hijau alas potong `#24392F`, kertas `#FAFAF7`, tinta `#17211C`,
  kuning stabilo `#F2C94C`, hijau label `#3A6B52`, teks redup `#C9D6CE`.
- Latar hijau memakai garis kotak-kotak 40 px.
- Tampilan aplikasi selalu berupa layar HP. Jangan sebut PWA atau APK di teks.

## Keputusan yang sudah diambil

- Harga ATTA DocStudio Pro: Rp30.000, sekali bayar, tanpa kode lisensi.
- Hanya DocStudio Pro yang dijual. SmartScanner Pro dan PDF Studio Pro tidak ditampilkan.
- Akun dibuat saat membeli. Akun dipakai untuk unduh ulang dan untuk masuk di iPhone.
- Cara bayar di desain: QRIS, transfer bank, e-wallet.

## Yang belum diisi

- Alamat web DocStudio untuk iPhone, tautan unduhan, nomor pesanan.
- Isi katalog template jasa.
- Jumlah hari di kebijakan refund. Teks legal masih draf.
- Halaman berbahasa Inggris (baru ada tombolnya).
