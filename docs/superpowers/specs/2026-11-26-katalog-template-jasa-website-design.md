# Spesifikasi Desain: Katalog & Paket Template Jasa Pembuatan Website (ATTA NATION)

**Tanggal:** 26 November 2026  
**Referensi Utama:** `https://www.webekspor.com/templates`  
**Tujuan:** Menyediakan etalase dan koleksi template website lintas industri yang rapi, modern, responsif, dan berkarakter unik (tidak terasa seperti template AI generik) sehingga klien dari bidang usaha apa pun dapat memilih desain, melihat preview Desktop/HP secara langsung, lalu mengajukan permintaan pembuatan atau penyesuaian.  
**Target Pembaca Dokumen:** Pemilik proyek & tim developer lanjutan di GitHub.

---

## 1. Tujuan, Non-Tujuan, dan Batasan

### Tujuan (Goals)
1. Menghadirkan halaman katalog template yang berfungsi layaknya etalase nyata: ada filter kategori industri, pencarian cepat, kartu preview yang menampilkan hasil desain asli, mode pratinjau layar Desktop dan Ponsel, serta tombol **Pilih & Request Template**.
2. Menyediakan **12 template website siap pakai lintas 6 kategori usaha** (dikerjakan dalam 2 gelombang: 6 template inti terlebih dahulu, lalu 6 template ekspansi).
3. Menjamin setiap template memiliki identitas visual, kombinasi huruf (*font pairing*), struktur *hero*, dan palet warna khas industrinya sendiri sehingga tidak terlihat seperti 1 template yang hanya diganti warnanya.
4. Memastikan seluruh template ringan, berbasis HTML5 + CSS3 + JavaScript modern tanpa build-step wajib, sehingga kelak mudah digabungkan ke dalam satu domain utama bersama situs ATTA NATION (`web-platform/`).

### Non-Tujuan (Non-Goals untuk Tahap Ini)
- Belum membangun sistem CMS/admin dashboard backend atau generator website otomatis (builder drag-and-drop).
- Belum membahas konfigurasi server, DNS, atau integrasi database produksi (semua alur request template sementara mengarah ke formulir ringkas + tautan WhatsApp terstruktur).
- Tidak menyertakan template aplikasi Android atau script Python desktop di dalam etalase jasa website ini.

### Batasan Teknis & Kualitas
- **Zero-framework / Portable Static Assets**: Setiap template berdiri mandiri dalam foldernya (`/templates/<slug>/`) memakai HTML semantik, CSS dengan custom properties (`--bg`, `--surface`, `--ink`, `--accent`, dll.), dan JS vanilla seperlunya.
- **Performa & Aset Lokal**: Seluruh foto disimpan lokal di folder `assets/img/` dalam format `.webp` atau `.jpg` terkompres (`< 180 KB` per foto), dilengkapi `width`, `height`, `alt`, dan `loading="lazy"` (kecuali gambar utama hero memakai `fetchpriority="high"`).
- **Aksesibilitas & Responsif**: Wajib lolos tampilan `360x780` (ponsel), `768px` (tablet), dan `1280px+` (desktop) tanpa scroll horizontal, kontras teks minimal `4.5:1` (WCAG AA), serta area klik/sentuh minimal `44x44px`.

---

## 2. Arsitektur Pendekatan yang Dipilih

Dipilih **Arsitektur Katalog Berbasis Data JSON + Demo Template Modular Independen** di bawah satu struktur folder web:

- **Mengapa bukan 1 stylesheet global untuk semua template?** Karena kalau seluruh template memakai CSS yang sama, semua demo akan terasa seragam dan monoton.
- **Mengapa belum memakai React/Next.js di repo template ini?** Karena seluruh aset nantinya digabung dalam satu domain statis/PHP yang sudah berjalan (`web-platform`), dan struktur HTML/CSS modular jauh lebih cepat dikerjakan paralel di GitHub, mudah di-clone klien, dan nol biaya build saat deployment.

Struktur akhir yang disiapkan agar mudah diintegrasikan ke satu domain:

```text
/
├── data/
│   └── templates.json              # Sumber tunggal metadata katalog (judul, kategori, tag, path demo, palet, fitur)
├── templates/
│   ├── _starter/                   # Panduan kerangka minimal & tokens starter (jangan disalin membabi-buta)
│   ├── profil-arsitek-kontraktor/
│   ├── profil-konsultan-hukum/
│   ├── ekspor-komoditas-agro/
│   ├── ekspor-kriya-furnitur/
│   ├── toko-fashion-katalog/
│   ├── toko-retail-grosir/
│   ├── kuliner-kafe-roastery/
│   ├── kuliner-katering-harian/
│   ├── jasa-klinik-kesehatan/
│   ├── jasa-rental-otomotif/
│   ├── landing-produk-digital/
│   └── landing-event-edukasi/
├── katalog-demo/                   # Halaman etalase interaktif (pengganti layout sementara di jasa.html)
│   ├── index.html
│   ├── preview.html                # Viewer split Desktop / Mobile untuk demo mana pun
│   └── app.js
└── docs/
    ├── DESIGN-RULES-ANTISLOP.md    # Aturan anti-generik & checklist QA
    └── ASSET-SOURCES.md            # Daftar sumber foto komersial & cara optimasi
```

---

## 3. Matriks 12 Template Jasa Website (Anti-Monoton)

Setiap template **wajib** memiliki tata letak *hero*, tipografi, palet warna, dan komponen interaktif spesifik industri:

| Gelombang | Slug Template | Industri / Target Klien | Gaya Visual & Palet (Bukan Ungu-Biru AI) | Struktur Hero & Fitur Kunci |
|---|---|---|---|---|
| **Wave 1** | `ekspor-komoditas-agro` | Eksportir briket, kopi, rempah, hasil bumi | *Industrial Earth Editorial*: Putih gading `#F7F5F0`, arang `#1B241E`, terakota/tembaga `#9A4D2A`; Font: *Space Grotesk + IBM Plex Sans* | Hero foto pabrik/komoditas full-width + strip angka kapasitas ekspor (`tabular-nums`), tabel spek HS Code/MOQ/FOB, toggle Bahasa ID/EN, tombol Request Sample/Quote ke WA |
| **Wave 1** | `profil-arsitek-kontraktor` | Arsitek, kontraktor bangun, studio interior | *Swiss Architectural Grid*: Abu semen hangat `#F2F1EE`, hitam pekat `#111315`, aksen kuningan `#B68938`; Font: *Syne / Instrument Sans + Inter* | Hero garis grid tegas + nomor proyek besar, galeri proyek filter *Residen / Komersial*, rincian alur kerja 4 fase, form estimasi luas & anggaran |
| **Wave 1** | `toko-fashion-katalog` | Brand fashion, batik, modest wear UMKM | *Warm Lookbook Magazine*: Krem sutra `#FBF9F5`, cokelat tua `#231B15`, aksen marun `#7C2D36`; Font: *Cormorant Garamond + Plus Jakarta Sans* | Hero editorial foto vertikal split, grid katalog asimetris, pemilih ukuran & warna per produk, mini-cart / checkout langsung format pesan WhatsApp |
| **Wave 1** | `kuliner-kafe-roastery` | Coffee shop, resto, bakery | *Warm Roastery Tactile*: Krem hangat `#FAF3E8`, espresso `#1E1612`, aksen karamel `#C05621`; Font: *Fraunces + DM Sans* | Menu filter interaktif (*Kopi / Non-Kopi / Makanan*) dengan harga rata kanan, jam operasional langsung, galeri suasana, tombol reservasi meja |
| **Wave 1** | `jasa-klinik-kesehatan` | Klinik kecantikan, dokter gigi, fisioterapi | *Calm Clinical Paper*: Putih bersih `#FAFBFD`, biru batu `#1E2E3E`, hijau sage `#2E6F5E`; Font: *Plus Jakarta Sans + Inter* | Hero ramah & tenang (tanpa efek neon), daftar layanan per keluhan, kartu profil dokter/terapis dengan nomor izin praktik, formulir booking jadwal kunjungan |
| **Wave 1** | `landing-produk-digital` | SaaS lokal, aplikasi bisnis, agensi kursus | *Sharp Light Bento / Editorial*: Latar kertas `#F6F7F9`, tinta `#0F172A`, aksen kobalt `#1D4ED8`; Font: *Bricolage Grotesque + Inter* | Demo pratinjau antarmuka interaktif (tab fitur nyata), perbandingan paket harga transparan (toggle Bulanan/Tahunan), FAQ akordeon native `<details>` |
| **Wave 2** | `ekspor-kriya-furnitur` | Pengrajin kayu jati, rotan, kerajinan | *Natural Craft Studio*: Pasir hangat `#F4EFE6`, kayu tua `#261F1A`, zaitun `#4A5D3F`; Font: *Lora + Work Sans* | Galeri material & *finish*, spesifikasi dimensi ekspor, unduh brosur spesifikasi |
| **Wave 2** | `profil-konsultan-hukum` | Firma hukum, akuntan pajak, konsultan bisnis | *Classic Authority Serif*: Biru malam `#101B2D`, putih kertas `#FCFCFA`, aksen perak/emas redup `#A68B5B`; Font: *Newsreader + Public Sans* | Layout 2 kolom tegas, daftar bidang hukum/konsultasi, studi kasus singkat, jadwalkan konsultasi |
| **Wave 2** | `toko-retail-grosir` | Toko elektronik, bahan bangunan, grosir | *Clean Utility Commerce*: Putih `#FFFFFF`, abu panel `#F1F5F9`, aksen oranye tegas `#D95D16`; Font: *Plus Jakarta Sans* | Bar pencarian + filter merek, badge stok tersedia, tabel harga grosir bertingkat (*tier pricing*) |
| **Wave 2** | `kuliner-katering-harian` | Katering acara, nasi box, frozen food | *Fresh Kitchen Bright*: Krem segar `#FFFDF7`, hijau daun `#1E4620`, kuning kunyit `#CA8A04`; Font: *Outfit + Nunito Sans* | Kalkulator simulasi jumlah porsi & total biaya acara, tab jadwal menu Senin–Sabtu |
| **Wave 2** | `jasa-rental-otomotif` | Rental mobil, travel wisata, bengkel | *Crisp Mobility Grid*: Abu terang `#F3F4F6`, hitam aspal `#14181F`, merah teknik `#C81E1E`; Font: *Space Grotesk + Inter* | Filter jenis kendaraan/layanan, tarif lepas kunci vs dengan sopir, cek estimasi hari |
| **Wave 2** | `landing-event-edukasi` | Sekolah modern, pondok/kursus, event seminar | *Modern Campus Editorial*: Putih gading `#F9F8F4`, biru tinta `#1B365D`, aksen kuning hangat `#D97706`; Font: *Plus Jakarta Sans +Merriweather* | Timeline jadwal acara/kurikulum, daftar pengajar/pembicara, formulir pendaftaran peserta |

---

## 4. Halaman Etalase & Preview (`katalog-demo/`)

1. **Grid Etalase + Filter (`index.html`)**:
   - Filter kategori: `Semua`, `Company Profile`, `Ekspor & Manufaktur`, `Toko Online`, `Kuliner & Kafe`, `Jasa & Klinik`, `Landing Page`.
   - Pencarian kata kunci (mencari nama template, industri, atau fitur).
   - Tiap kartu menampilkan screenshot asli / *live scaled thumbnail* (bukan kotak wireframe abstrak), 1 baris ringkasan industri, rentang estimasi pengerjaan, tombol **`Lihat Demo`**, dan tombol **`Pilih Template`**.
2. **Viewer Demo Desktop & Ponsel (`preview.html?tpl=<slug>`)**:
   - Header ringkas di atas iframe: nama template, tombol ganti ukuran **Desktop / Tablet / HP (`390px`)**, tombol buka tab penuh, dan tombol utama **`Gunakan Template Ini`** yang membuka form request singkat (Nama Usaha, Bidang, Referensi Domain, Catatan Kustom) lalu mengirim format terstruktur ke WhatsApp.
