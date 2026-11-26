# ATTA NATION — Website Resmi, Produk Aplikasi & Katalog Template Jasa

Repositori utama ekosistem teknologi **ATTA NATION** oleh **Attala Alif Ramadhani Tri Hida**:
- **Website resmi & etalase layanan** (`web-platform/`) — halaman brand, katalog aplikasi **ATTA DocStudio Pro**, sistem checkout/order Midtrans, serta etalase jasa pembuatan website.
- **Rencana & spesifikasi Katalog Template Jasa Website** (`docs/superpowers/plans/` & `docs/superpowers/specs/`) — panduan teknis langkah demi langkah bagi kontributor/tim untuk membangun **12 template website siap pilih** lintas industri ala katalog *Web Ekspor*.
- **Aplikasi web & proyek Android pendamping** (`pwa-docstudio-pro/`, `apk-projects/`, dan `test/`).

---

## Untuk Tim / Developer yang Melanjutkan di GitHub

Jika kamu melanjutkan pengembangan **Katalog Template Jasa Website**, mulai langsung dari dua dokumen utama ini:

1. **Spesifikasi Desain (12 Template & Identitas Visual):**  
   [`docs/superpowers/specs/2026-11-26-katalog-template-jasa-website-design.md`](./docs/superpowers/specs/2026-11-26-katalog-template-jasa-website-design.md)
2. **Plan Kerja Bertahap (Task 1–8, Fokus UI/UX, Aturan Skill Anti-Generik & Sumber Foto Legal):**  
   [`docs/superpowers/plans/2026-11-26-katalog-template-jasa-website.md`](./docs/superpowers/plans/2026-11-26-katalog-template-jasa-website.md)

Ringkasan alur kerja:
- Gunakan branch fitur terpisah dari `main`, misal `feat/katalog-etalase` atau `feat/tpl-<slug>`.
- Fokus penuh ke desain UI/UX, interaksi browser, dan pembuatan demo template (belum perlu membuat file `.md` dokumentasi tambahan).
- Setiap template baru ditempatkan di folder modular masing-masing dengan tipografi, palet warna, dan komposisi hero unik (bebas gaya *AI slop*).
- Simpan seluruh foto aset legal secara lokal (`.webp`/`.jpg` terkompres) di dalam folder `assets/img/` tiap template.

---

## Struktur Folder Proyek

```text
.
├── README.md                                  # Dokumentasi utama & peta repositori
├── .gitignore                                 # Pengecualian build cache, APK, dan config rahasia
├── DESIGN.md                                  # Panduan desain internal "Versi 3+ Kertas dan Tinta"
│
├── web-platform/                              # Website utama ATTA NATION (HTML/CSS/JS + PHP API)
│   ├── index.html                             # Beranda showcase ATTA NATION
│   ├── aplikasi.html                          # Katalog aplikasi
│   ├── docstudio.html                         # Halaman produk ATTA DocStudio Pro
│   ├── jasa.html                              # Halaman layanan & etalase template jasa
│   ├── template-*.html                        # Halaman detail template awal (layout dasar)
│   ├── checkout.html / status-pembayaran.html # Alur pemesanan & status transaksi
│   ├── cara-beli.html / tanya-jawab.html      # Panduan pembelian & FAQ
│   ├── akun.html / tentang.html / legal.html  # Akun, profil studio, dan dokumen legal
│   ├── en/                                    # Versi bahasa Inggris website utama
│   ├── api/                                   # Backend PHP untuk order, akun, & webhook Midtrans
│   └── assets/                                # Brand logo, stylesheet global, script, & media web
│
├── docs/                                      # Dokumentasi perencanaan & arsitektur GitHub
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-11-26-katalog-template-jasa-website-design.md
│       └── plans/
│           └── 2026-11-26-katalog-template-jasa-website.md
│
├── pwa-docstudio-pro/                         # Aplikasi Progressive Web App ATTA DocStudio Pro
│   ├── index.html                             # Antarmuka utama scanner, PDF, tanda tangan, & QR
│   ├── manifest.json / service-worker.js      # Konfigurasi offline-first & precache aset
│   ├── css/                                   # Stylesheet tema Terang & Gelap
│   ├── js/                                    # Logika aplikasi, mesin PDF/QR, i18n, & library vendor
│   ├── assets/                                # Ikon, font, & brand aplikasi
│   └── server-api/                            # Contoh skema & API akun opsional (PHP + SQL)
│
├── apk-projects/                              # Proyek wrapper Android & Flutter
│   ├── atta-docstudio-pwa-apk/                # Wrapper WebView Kotlin Android + ML Kit + script sync
│   ├── atta-docstudio-pro/                    # Source aplikasi Flutter DocStudio Pro
│   ├── atta-pdf-studio-pro/                   # Source proyek PDF Studio Pro
│   └── atta-smartscanner-pro/                 # Source proyek SmartScanner Pro
│
├── test/                                      # Suite verifikasi otomatis PWA & E2E
│   ├── runners/                               # Runner utama (run_all_e2e.js)
│   ├── scripts/                               # Audit HTML/i18n & verifikasi alur (audit_pwa.js, dll.)
│   ├── harness/                               # Sandbox DOM untuk pengujian Node.js
│   └── suites/                                # Kumpulan test suite Tier 1–4
│
├── design-web-atta-nation/                    # Referensi aset & dokumen acuan desain "Meja Kerja"
│   ├── assets/                                # Aset mentah acuan desain
│   └── project/                               # File desain per halaman (.dc.html)
│
└── _archive_legacy_portfolio/                 # Arsip tampilan portofolio versi awal
```

---

## Menjalankan Secara Lokal

### 1. Preview Website (`web-platform/`)
Jalankan server statis lokal dari root proyek:
```bash
npx serve web-platform
```
Atau jika ingin menguji endpoint PHP di `web-platform/api/`:
```bash
cd web-platform
php -S localhost:8080
```
*(Salin `web-platform/api/config.example.php` menjadi `web-platform/api/config.php` bila menguji integrasi Midtrans lokal. Jangan pernah commit `config.php` ke GitHub.)*

### 2. Menjalankan Suite Pengujian PWA (`test/`)
```bash
cd test
node ./scripts/audit_pwa.js
node ./scripts/verify_pwa_flows.js
node ./runners/run_all_e2e.js
```

### 3. Sinkronisasi Aset PWA ke Proyek APK Android
```powershell
powershell -ExecutionPolicy Bypass -File ".\apk-projects\atta-docstudio-pwa-apk\sync-pwa.ps1"
```

---

## Kontak Pengelola

- **Pengelola:** Attala Alif Ramadhani Tri Hida (ATTA NATION)
- **Email:** attalaaliframadhanitrihida@gmail.com
- **WhatsApp:** +62 812-3592-8712
- **GitHub:** https://github.com/attaramadhani
