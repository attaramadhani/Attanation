# Rencana Implementasi & Handoff GitHub: Katalog Template Jasa Website (ATTA NATION)

> **Untuk dikerjakan oleh tim / developer di GitHub (serta AI coding agent pendamping):** Gunakan dokumen ini berurutan per Task. Centang `[x]` setiap langkah setelah terverifikasi di browser desktop (1280px) dan mobile (390px).

**Goal:** Membangun etalase katalog jasa pembuatan website ala `webekspor.com/templates` beserta 12 demo template lintas industri yang profesional, berkarakter unik (bebas desain AI generik), berfoto nyata legal, dan siap digabung ke dalam satu domain ATTA NATION.

**Architecture:** Satu katalog pusat berbasis `data/templates.json` dengan viewer pratinjau Desktop/HP, dipasangkan dengan folder demo template independen di `templates/<slug>/` menggunakan HTML5 semantik, CSS modern ber-token per industri, dan JavaScript vanilla ringan tanpa ketergantungan build framework rumit.

**Tech Stack:** HTML5 semantik, CSS3 (Grid, Flexbox, Custom Properties, `aspect-ratio`), Vanilla JS ES6+, Google Fonts / self-hosted WOFF2, aset gambar `.webp`/`.jpg` terkompres lokal.

**Spec:** [2026-11-26-katalog-template-jasa-website-design.md](../specs/2026-11-26-katalog-template-jasa-website-design.md)

---

## Global Constraints (Aturan Wajib di Setiap PR / Branch)

1. **Bebas AI Slop**: Dilarang memakai gradien ungu-biru neon, kartu 3-kolom identik dengan ikon bulat di tengah terus-menerus, *glowing blur orbs* di hero, atau teks klise AI (*"Revolusioner", "Solusi terdepan di era digital"*).
2. **Uji Tukar Logo**: Setiap template wajib punya tipografi, palet warna, dan komposisi hero yang berbeda dari template lain.
3. **Semua Tombol Berfungsi**: Pencarian, filter, tab menu, keranjang WhatsApp, kalkulator harga, dan form simulasi di tiap demo harus benar-benar bekerja di browser—tidak ada link mati `#`.
4. **Aset Foto Legal & Lokal**: Seluruh gambar diunduh dan disimpan di `templates/<slug>/assets/img/` dalam `.webp` / `.jpg` (`< 180 KB` per file). Dilarang hardcode URL CDN pihak ketiga yang bisa mati sewaktu-waktu.
5. **Fokus UI/UX & Tanpa File Dokumen Tambahan**: Developer tidak perlu membuat file `.md` tambahan di tiap template—langsung fokus merancang tampilan UI/UX, aset gambar, dan interaksi demo di browser.
6. **Responsive & WCAG AA**: Zero horizontal overflow di viewport `360px` & `390px`, target klik/sentuh `>= 44x44px`, rasio kontras teks `>= 4.5:1`.

---

## Panduan Skill Wajib (Untuk Mencegah Desain Generik)

Jika developer memakai AI coding agent (Antigravity / Claude Code / Codex / Cursor), muat skill berikut sesuai tahapannya (lokasi skill lokal: `C:\Users\Atta\.gemini\config\skills\` atau pasang dari marketplace/GitHub masing-masing):

| Urutan | Nama Skill | Fungsi Utama Saat Mengerjakan Repo |
|---|---|---|
| 1 | `ui-ux-pro-max` | Menentukan kombinasi gaya visual, palet warna khusus industri, dan pairing font sebelum menulis kode (`--design-system` / `--domain typography,color`). |
| 2 | `antislop` + `antislop-ui` | Filter utama penolak desain AI klise: memaksa tiap elemen visual lulus *Purpose Test* (menolak glassmorphism berlebihan, radius seragam di semua elemen, shadow mengambang di setiap kartu). |
| 3 | `antislop-copywriting` | Memastikan judul, subjudul, tombol CTA, dan studi kasus memakai bahasa Indonesia/Inggris yang konkret dan alami, bukan gaya terjemahan AI bertele-tele. |
| 4 | `antislop-layoutmobile` | Menjaga tata letak Grid/Bento tetap rapi di layar HP (`360px–390px`), tanpa teks kepotong atau grid penyok. |
| 5 | `modern-web-guidance` | Referensi wajib (`npx -y modern-web-guidance@latest`) sebelum membangun modal preview, akordeon `<details>`, lazy-load gambar, dan navigasi mobile modern. |
| 6 | `frontend-ui-engineering` | Merapikan struktur komponen, state interaksi (`hover`, `focus-visible`, `disabled`, `empty state`), dan pemisahan CSS/JS per folder. |
| 7 | `web-design-guidelines` + `accessibility-engineering` | Audit akhir sebelum membuka Pull Request di GitHub (cek kontras, semantik heading, `aria-label`, dan ukuran sentuh `44x44px`). |

---

## Panduan Sumber Foto Internet Gratis & Aman Komersial

Gunakan sumber foto berlisensi bebas komersial yang mengizinkan pemakaian di dalam **template website jasa/komersial tanpa wajib atribusi**:

1. **Unsplash (`unsplash.com`)** — Terbaik untuk foto *hero editorial*, arsitektur, kantor, eksterior bangunan, dan suasana kafe. *(Hindari menyiratkan model wajah memberi testimoni palsu atau dukungan medis/politik.)*
2. **Pexels (`pexels.com`)** — Lisensi secara eksplisit mengizinkan pemakaian di *website templates*; sangat kuat untuk foto UMKM, interaksi kerja tim, klinik, fashion, serta **video pendek gratis** bila perlu hero dinamis.
3. **Pixabay (`pixabay.com`)** — Baik untuk variasi produk, bahan mentah, dan ilustrasi pendukung. **Wajib filter "Photos" & matikan gambar AI** agar tidak mendapat foto berdistorsi.
4. **Foodiesfeed (`foodiesfeed.com`)** — Spesialis fotografi kuliner/makanan/minuman beresolusi tinggi (lisensi CC0), jauh lebih natural untuk template *Kafe, Resto, Katering*.
5. **Nappy (`nappy.co`)** — Foto portrait & aktivitas bisnis yang natural dan tidak kaku untuk bagian tim/komunitas.
6. **Wikimedia Commons (`commons.wikimedia.org`)** — Untuk komoditas spesifik Indonesia (mis. briket tempurung kelapa, kopi nusantara, rempah, rotan, batik) bila tidak tersedia di Unsplash/Pexels. **Wajib pilih lisensi `CC0` / `Public Domain`** agar aman tanpa kewajiban mencantumkan kredit di halaman klien.

**Kata kunci pencarian yang disarankan (pakai Bahasa Inggris agar hasil lebih banyak & tajam):**
- *Ekspor Agro*: `coconut charcoal briquette`, `coffee beans roasting factory`, `indonesia spices cloves cinnamon`, `shipping container port logistics`
- *Arsitektur & Kontraktor*: `modern minimalist concrete house`, `architectural studio blueprints table`, `construction engineer site`
- *Fashion & UMKM*: `linen clothing editorial studio`, `batik fabric artisan craft`, `minimalist boutique display`
- *Kuliner & Kafe*: `latte art wooden cafe table`, `artisan sourdough bakery`, `asian rice bowl minimal table` (dari Foodiesfeed)
- *Klinik & Jasa*: `clean modern dental clinic interior`, `skincare minimalist aesthetic clinic`, `mechanic modern auto workshop`

---

## Review Focus (Risiko Kegagalan yang Harus Dicek di Setiap Task)

1. **Teks terlalu panjang memecahkan layout HP (`360px`)**: Nama usaha atau judul fitur panjang tidak boleh membuat kartu melebar atau meluap horizontal (`overflow-x: hidden` bukan solusi—gunakan `minmax(0, 1fr)` dan `word-break` wajar).
2. **Gambar eksternal mati atau memperlambat LCP**: Semua foto demo harus berada di lokal `assets/img/` dengan rasio dimensi terkunci (`aspect-ratio`) agar bebas *layout shift* (CLS).
3. **Iframe Preview di `katalog-demo/preview.html` memblokir link eksternal / WhatsApp**: Link CTA WhatsApp di dalam demo wajib memakai `target="_blank" rel="noopener"` agar bisa terbuka keluar dari iframe preview.
4. **Form & filter katalog terasa mati saat 0 hasil**: Pencarian etalase dengan kata kunci yang tidak cocok wajib menampilkan pesan kosong yang jelas + tombol `Reset filter`.
5. **Inkonsistensi Bahasa & Mata Uang**: Template ekspor B2B wajib rapi memakai format angka `tabular-nums` dan saklar ID/EN tanpa merusak tata letak tombol.

---

## Alur Kerja GitHub untuk Temanmu

- **Branch utama**: `main` (hanya berisi template & katalog yang sudah lolos review).
- **Penamaan branch kerja**:
  - Fondasi katalog: `feat/katalog-etalase`
  - Tiap template baru: `feat/tpl-<slug>` (contoh: `feat/tpl-ekspor-komoditas-agro`)
- **Format Commit**: `feat(tpl-ekspor-agro): tambah layout, tabel spek, dan aset lokal`
- **Syarat Merge PR**: Melampirkan screenshot tampilan Desktop (`1280px`) dan Ponsel (`390px`) plus hasil cek `0 broken images` & `0 horizontal overflow`.

---

## Daftar Task Bertahap

### Task 1: Siapkan Data Katalog & Etalase Live Preview (`data/templates.json` + `katalog-demo/`)
**Files:**
- Create: `data/templates.json` (skema array objek: `slug`, `title`, `category`, `industry`, `tagline`, `palette`, `fonts`, `features`, `demoPath`, `thumbPath`, `wave`, `status`)
- Create: `katalog-demo/index.html`
- Create: `katalog-demo/styles.css`
- Create: `katalog-demo/app.js`
- Create: `katalog-demo/preview.html`

- [ ] **Step 1:** Buat `data/templates.json` berisi daftar metadata 12 template (Wave 1 dan Wave 2).
- [ ] **Step 2:** Bangun `katalog-demo/index.html`, `styles.css`, dan `app.js` untuk render kartu template, filter kategori (`Semua`, `Company Profile`, `Ekspor & Manufaktur`, `Toko Online`, `Kuliner & Kafe`, `Jasa & Klinik`, `Landing Page`), pencarian real-time, dan empty-state dengan tombol reset.
- [ ] **Step 3:** Bangun `katalog-demo/preview.html?tpl=<slug>` berupa viewer UI/UX dengan toolbar saklar viewport **`Desktop (100%)`**, **`Tablet (768px)`**, **`HP (390px)`**, link buka tab baru, dan modal **Form Request Template** yang menyusun pesan WhatsApp otomatis.
- [ ] **Step 4:** Uji buka lewat server statis lokal (`npx serve .`), pastikan filter, empty-state, pergantian mode HP/Desktop di `preview.html`, dan tombol WhatsApp berfungsi tanpa error konsol, lalu commit ke branch `feat/katalog-etalase`.

---

### Task 2 (Wave 1 - Template 1): `templates/ekspor-komoditas-agro/`
**Files:**
- Create: `templates/ekspor-komoditas-agro/index.html`, `style.css`, `app.js`, `assets/img/*.webp`

- [ ] **Step 1:** Riset palet & pairing font lewat `ui-ux-pro-max` (*Industrial Earth Editorial*: `#F7F5F0`, `#1B241E`, `#9A4D2A`; *Space Grotesk + IBM Plex Sans*).
- [ ] **Step 2:** Unduh 5–7 foto komoditas & logistik (kopi/briket/rempah/kontainer) dari Unsplash/Pexels/Wikimedia `CC0`, kompres `.webp` (`< 180 KB`).
- [ ] **Step 3:** Bangun UI/UX: Navbar bersih + toggle bahasa `ID | EN`, Hero fotografi penuh dengan badge angka kapasitas ekspor (`tabular-nums`), Grid Katalog Komoditas (klik untuk lihat spek teknis), Tabel Spesifikasi Ekspor (HS Code, Moisture, Packaging, MOQ, Port of Loading), Alur Pengiriman & Sertifikasi, Form *Request Quotation* ke WhatsApp/email.
- [ ] **Step 4:** Audit via checklist `antislop` + cek responsif `390px` & `1280px`, ambil screenshot `thumb.webp` untuk kartu di `data/templates.json`, lalu commit `feat/tpl-ekspor-komoditas-agro`.

---

### Task 3 (Wave 1 - Template 2): `templates/profil-arsitek-kontraktor/`
**Files:**
- Create: `templates/profil-arsitek-kontraktor/index.html`, `style.css`, `app.js`, `assets/img/*.webp`

- [ ] **Step 1:** Terapkan *Swiss Architectural Grid* (`#F2F1EE`, `#111315`, `#B68938`; *Syne / Instrument Sans + Inter*) dengan garis pemisah `1px` tegas dan penomoran proyek (`01`, `02`, `03`).
- [ ] **Step 2:** Bangun Hero tipografi besar + 1 foto proyek utama, Galeri Portofolio interaktif dengan filter (*Semua / Rumah Tinggal / Komersial / Interior*) + modal detail spesifikasi proyek (luas tanah, tahun selesai, lokasi), Timeline proses kerja, serta Form Konsultasi Estimasi Bangun.
- [ ] **Step 3:** Uji interaksi modal proyek & responsif mobile/desktop, buat `thumb.webp`, commit `feat/tpl-profil-arsitek-kontraktor`.

---

### Task 4 (Wave 1 - Template 3): `templates/toko-fashion-katalog/`
**Files:**
- Create: `templates/toko-fashion-katalog/index.html`, `style.css`, `app.js`, `assets/img/*.webp`

- [ ] **Step 1:** Terapkan *Warm Lookbook Magazine* (`#FBF9F5`, `#231B15`, `#7C2D36`; *Cormorant Garamond + Plus Jakarta Sans*).
- [ ] **Step 2:** Bangun Hero *split* editorial foto vertikal, Filter Koleksi, Kartu Produk dengan pemilih varian **Ukuran (S/M/L/XL)** dan **Warna**, Drawer Keranjang Belanja hidup (tambah, kurang, hapus, hitung total otomatis), dan tombol **Pesan lewat WhatsApp** dengan daftar belanja terformat rapi.
- [ ] **Step 3:** Uji tambah ke keranjang, ubah jumlah, dan hapus hingga kosong di layar `390px`, buat `thumb.webp`, commit `feat/tpl-toko-fashion-katalog`.

---

### Task 5 (Wave 1 - Template 4): `templates/kuliner-kafe-roastery/`
**Files:**
- Create: `templates/kuliner-kafe-roastery/index.html`, `style.css`, `app.js`, `assets/img/*.webp`

- [ ] **Step 1:** Gunakan foto tajam dari **Foodiesfeed** dan Pexels + palet *Warm Roastery* (`#FAF3E8`, `#1E1612`, `#C05621`; *Fraunces + DM Sans*).
- [ ] **Step 2:** Bangun Hero bertekstur hangat, Tab Menu Interaktif (*Signature Coffee / Artisan Tea / Bakery & Bites*) dengan daftar harga rapi `tabular-nums`, Strip Jam Buka & Lokasi Cabang, dan Formulir Reservasi Meja ke WhatsApp.
- [ ] **Step 3:** Cek kontras teks putih/krem di atas foto gelap, buat `thumb.webp`, commit `feat/tpl-kuliner-kafe-roastery`.

---

### Task 6 (Wave 1 - Template 5): `templates/jasa-klinik-kesehatan/`
**Files:**
- Create: `templates/jasa-klinik-kesehatan/index.html`, `style.css`, `app.js`, `assets/img/*.webp`

- [ ] **Step 1:** Terapkan *Calm Clinical Paper* (`#FAFBFD`, `#1E2E3E`, `#2E6F5E`; *Plus Jakarta Sans + Inter*).
- [ ] **Step 2:** Bangun Daftar Layanan berbasis kategori keluhan/perawatan, Profil Dokter/Praktisi (pakai foto natural non-endorsement dengan keterangan demo jelas), Akordeon `<details>` FAQ Persiapan Kunjungan, dan Form *Booking Slot Jadwal* (pilih layanan, tanggal, jam, kirim ke WhatsApp).
- [ ] **Step 3:** Audit aksesibilitas form (`<label for="...">`, pesan validasi jelas), buat `thumb.webp`, commit `feat/tpl-jasa-klinik-kesehatan`.

---

### Task 7 (Wave 1 - Template 6): `templates/landing-produk-digital/`
**Files:**
- Create: `templates/landing-produk-digital/index.html`, `style.css`, `app.js`, `assets/img/*.webp`

- [ ] **Step 1:** Terapkan *Sharp Light Bento / Editorial* (`#F6F7F9`, `#0F172A`, `#1D4ED8`; *Bricolage Grotesque + Inter*) **tanpa gradien ungu-biru dan tanpa neon glow**.
- [ ] **Step 2:** Bangun Hero + mockup interaktif (tab switch fitur aplikasi), Tabel Perbandingan Paket dengan toggle **Bayar Bulanan vs Tahunan**, Testimoni studi kasus terukur, dan CTA Uji Coba / Konsultasi.
- [ ] **Step 3:** Uji seluruh tab, toggle harga, dan akordeon di Chrome DevTools mobile/desktop, buat `thumb.webp`, commit `feat/tpl-landing-produk-digital`.

---

### Task 8: Ekspansi Wave 2 (6 Template Tambahan) & Quality Gate Final UI/UX
**Files:**
- Modify: `data/templates.json` (aktifkan `"status": "ready"` untuk tiap template Wave 2 setelah selesai)
- Create:
  - `templates/ekspor-kriya-furnitur/`
  - `templates/profil-konsultan-hukum/`
  - `templates/toko-retail-grosir/`
  - `templates/kuliner-katering-harian/`
  - `templates/jasa-rental-otomotif/`
  - `templates/landing-event-edukasi/`

- [ ] **Step 1:** Kerjakan masing-masing template Wave 2 dalam branch `feat/tpl-<slug>` terpisah mengikuti alur riset `ui-ux-pro-max` + filter `antislop` + aset foto lokal terkompres.
- [ ] **Step 2:** Jalankan verifikasi lintas semua 12 template: cek tidak ada gambar `404`, tidak ada horizontal overflow pada `360px`/`390px`/`1280px`, semua filter di `katalog-demo/index.html` dan switcher HP/Desktop di `preview.html` bekerja penuh.
- [ ] **Step 3:** Jalankan audit akhir menggunakan `web-design-guidelines` dan `accessibility-engineering` sebelum rilis dan sebelum nantinya digabung ke domain utama `attanation.com`.
