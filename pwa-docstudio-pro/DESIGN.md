# DESIGN.md — ATTA DocStudio Pro (Versi 3+: "Kertas dan Tinta")

Dokumen ini adalah sumber kebenaran tunggal untuk tampilan ATTA DocStudio Pro.
Siapa pun yang mengubah UI — manusia atau agen AI — wajib membaca file ini dulu
dan mengikutinya. Kalau ada konflik antara file ini dan kebiasaan bawaan model
("default AI"), **file ini yang menang**.

Referensi visual: kanvas desain "ATTA DocStudio Pro — 5 Arah Redesign",
artboard **Versi 3+: Kertas dan Tinta** (4 layar: Dokumen, Pindai, Alat PDF, Cadangan).

---

## 1. Produk dalam satu paragraf

ATTA DocStudio Pro adalah PWA pemindai dokumen dan alat PDF yang berjalan
**100% offline di HP**. Berkas disimpan di IndexedDB perangkat, tidak pernah
diunggah. Penggunanya orang Indonesia (mahasiswa, pekerja, pelamar kerja) yang
perlu memindai KTP, KK, ijazah, transkrip, surat, dan kwitansi, lalu
mengecilkannya agar lolos batas unggah portal (pendaftaran, lamaran, beasiswa).
Produk dari **ATTA NATION**; nama "ATTA NATION" tidak boleh diubah atau disingkat.

**Tugas utama layar:** pindai dokumen → simpan/bagikan. Semua keputusan desain
melayani dua aksi itu.

---

## 2. Konsep visual: "Kertas dan Tinta"

Bayangkan meja kerja berwarna biru keabuan. Di atasnya ada lembaran kertas
sungguhan, dan satu pulpen bertinta biru.

- **Meja** = latar aplikasi (`--desk`).
- **Kertas** = dokumen milik pengguna. Dokumen adalah tokoh utama; ia digambar
  seperti kertas asli (kop surat, kartu KTP, kwitansi bernominal), bukan ikon.
- **Tinta biru** = satu-satunya warna aksen. Dipakai untuk aksi utama,
  tanda tangan, dan penanda status aktif. Tidak dipakai untuk dekorasi.

Kepribadian: tenang, rapi, praktis, terasa seperti alat kantor yang dipakai
setiap hari. Bukan "startup AI", bukan futuristik, bukan ramai.

---

## 3. Prinsip (urutkan prioritas dari atas)

1. **Dokumen dulu, chrome belakangan.** Thumbnail dan pratinjau dokumen
   adalah elemen paling kaya di layar. Tombol, label, dan panel dibuat diam.
2. **Satu aksen, satu tempat.** Tinta biru hanya muncul di aksi utama layar,
   tab aktif, tanda tangan, dan garis deteksi kamera.
3. **Tanpa kartu kalau tidak perlu.** Daftar berkas langsung di atas meja,
   dipisah garis tipis. Panel (`--paper`) hanya untuk alat dan blok input.
4. **Struktur = informasi.** Pengelompokan berdasarkan waktu ("Minggu ini",
   "Oktober"), bukan nomor dekoratif. Tidak ada 01/02/03 kecuali isinya urutan.
5. **Ritme bervariasi.** Satu elemen besar per layar (tumpukan dokumen, angka
   12,4 MB, alat Gabung PDF), sisanya kecil dan disiplin.
6. **Kata-kata seperlunya.** Kalimat pendek, bahasa sehari-hari, kata kerja
   jelas.

---

## 4. Token desain

Tempel blok ini ke `css/app.css` sebagai satu-satunya sumber warna/ukuran.
Jangan menulis hex langsung di komponen.

```css
:root {
  /* Warna */
  --desk:        #DCE2E7; /* latar aplikasi (meja) */
  --paper:       #FBFBF8; /* kertas, panel, nav bar */
  --paper-cool:  #EEF1F4; /* kertas foto / kartu KTP */
  --ink:         #17202B; /* teks utama, ikon aktif */
  --muted:       #55606D; /* teks sekunder (kontras 4,9:1 di --desk, 6,2:1 di --paper) */
  --pen:         #2445C9; /* aksen tunggal: tinta pulpen */
  --pen-hover:   #16308F;
  --pen-soft:    #8EA4FF; /* garis deteksi kamera di atas latar gelap */
  --line:        #C9D1D9; /* pemisah baris */
  --line-strong: #9AA6B2; /* border tombol outline, input, garis tanda tangan */
  --sheet-line:  #C9CFD5; /* garis teks di dalam thumbnail dokumen */
  --ktp:         #B8CCDD; /* blok kartu identitas di thumbnail */
  --camera:      #2B3138; /* latar viewfinder kamera */
  --danger:      #B42318; /* hanya untuk hapus & error */

  /* Tipografi */
  --font: 'Schibsted Grotesk', system-ui, sans-serif;

  /* Radius: hanya 3 nilai */
  --r-sheet: 3px;   /* semua kertas/dokumen */
  --r-ctl:   12px;  /* tombol, input, panel, pill */
  --r-round: 999px; /* hanya tombol shutter, tombol ikon bulat di kamera, badge angka */

  /* Bayangan: hanya untuk kertas */
  --shadow-sheet: 0 1px 1px rgba(23,32,43,.10), 0 10px 24px rgba(23,32,43,.12);
  --shadow-thumb: 0 1px 1px rgba(23,32,43,.12), 0 3px 8px rgba(23,32,43,.10);

  /* Spasi (kelipatan 4) */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 20px; --s6: 24px; --s8: 32px;
  --gutter: 20px;   /* margin kiri-kanan layar */
  --tap: 44px;      /* tinggi minimum semua target sentuh */

  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 4.1 Warna — aturan pakai

| Token | Boleh untuk | Dilarang untuk |
|---|---|---|
| `--pen` | tombol utama (1 per layar), tab aktif (garis bawah), tombol Pindai di nav, tanda tangan, titik sudut deteksi | latar besar, gradien, ikon dekoratif, teks paragraf |
| `--paper` | kertas, panel alat, nav bar, input | latar layar penuh |
| `--desk` | latar semua layar kecuali kamera | — |
| `--danger` | aksi Hapus, toast error | aksen biasa |

Tidak ada warna lain. **Dilarang**: ungu/lavender, gradien dekoratif,
teal/cyan lama (`#14b8a6`, `#2dd4bf`), glow, glassmorphism.
Satu-satunya gradien yang diizinkan: thumbnail filter "Asli" (meniru foto kertas
berbayang).

### 4.2 Tipografi

Font: **Schibsted Grotesk** (Google Fonts, bobot 400/500/600/700/800).
Simpan file `.woff2` di `assets/fonts/` dan daftarkan ke service worker agar
tetap tampil offline. Fallback: `system-ui`.

| Peran | Ukuran / tinggi baris | Bobot | Catatan |
|---|---|---|---|
| Judul layar (h1) | 32 / 1.0 | 800 | letter-spacing −0.03em |
| Angka besar (momen tipografi) | 60 / 1.0 | 800 | −0.045em, `tabular-nums`; hanya 1 per aplikasi (Cadangan) |
| Judul dokumen unggulan | 18 / 1.2 | 700 | |
| Judul seksi (h2) | 18 / 1.2 | 700 | |
| Nama berkas / item | 16 / 1.25 | 600 | |
| Body / setelan | 15 / 1.45 | 400–600 | |
| Lead (di bawah h1) | 14 / 1.45 | 400 | warna `--muted` |
| Meta, label grup | 13 / 1.4 | 400–600 | warna `--muted` |
| Label nav | 12 | 500 (aktif 700) | |

Aturan:
- Sentence case di semua UI. **Tidak ada huruf kapital semua untuk label.**
  Pengecualian: teks yang memang tercetak di dalam dokumen tiruan
  (mis. "SURAT KETERANGAN", "KWITANSI").
- Tidak memberi warna/italic pada satu kata di judul.
- Tidak ada label kecil (eyebrow) di atas judul.
- Tidak ada font monospace.
- Angka ukuran memakai format Indonesia: `12,4 MB`, `412 KB`, `Rp 850.000`.

### 4.3 Ikon

- Garis (stroke) 2px, ujung `round`, kotak 24×24, ditampilkan 20–22px.
- Warna mengikuti teks (`currentColor`).
- Ikon berdiri sendiri, **tanpa kotak/tile berlatar** di belakangnya.
- **Tidak ada emoji** di mana pun di UI (termasuk tombol, toast, empty state).
- Tombol ikon tanpa teks wajib punya `aria-label`.

Set ikon yang dipakai: dokumen (berkas dengan lipatan), dua lembar (Alat PDF),
panah melingkar (Cadangan), bingkai pindai (4 sudut), kaca pembesar, silang,
petir (flash), chevron kanan.

### 4.4 Gerak (motion)

- Gerak hanya sebagai jawaban atas aksi pengguna: tekan tombol (turun 1px,
  120ms), ganti tab (garis bawah bergeser 180ms), toast masuk dari bawah (200ms).
- Satu momen terorkestrasi: setelah scan berhasil, lembar baru "jatuh" ke
  tumpukan di layar Dokumen (rotasi kecil + turun, 320ms, `ease-out`).
- **Dilarang**: fade-in setiap section/kartu, animasi berulang tanpa pemicu,
  parallax, bounce, pulse, shimmer.
- Hormati `prefers-reduced-motion: reduce` → semua transisi menjadi instan.

---

## 5. Komponen

Nama class di bawah adalah nama yang dipakai saat rebuild. Pertahankan
fungsi JS yang sudah ada (lihat §8).

### 5.1 Kertas (`.sheet`)
- Latar `--paper`, radius `--r-sheet`, bayangan `--shadow-sheet`.
- Isi digambar dengan garis teks (`.sheet-line`: tinggi 2–3px, warna
  `--sheet-line`) dan sesekali teks mikro berbobot 800.
- Boleh diputar −8° s/d +8° **hanya** dalam tumpukan dan diagram alat.

### 5.2 Thumbnail dokumen (`.doc-thumb`, 34×46 di daftar, 52×68 di filter)
Gunakan `thumbnailDataUrl` asli bila ada. Bila tidak ada, tampilkan
**tiruan sesuai kategori**, bukan label "PDF"/"JPG":

| Jenis | Tiruan |
|---|---|
| Surat / PDF umum | kop (lingkaran logo + 2 garis) + judul mikro + garis paragraf |
| KTP / kartu | latar `--paper-cool`, blok `--ktp` setinggi ~35% |
| Kwitansi / nota | judul mikro "KWITANSI" + 2 garis |
| Transkrip / tabel | garis + blok abu tipis |
| Tanda tangan | kertas polos + coretan tinta `--pen` |

### 5.3 Tumpukan terbaru (`.stack`) — elemen utama layar Dokumen
- 3 berkas terbaru sebagai kertas bertumpuk (rotasi 7°, −5°, 1,5°),
  146×196px, kiri.
- Di kanan: "Baru dipindai, {waktu relatif}" (13, muted), nama berkas (18/700),
  meta (13, muted), tombol utama **Simpan ke Files**, tombol teks **Bagikan**.
- Bila berkas kosong, tumpukan diganti empty state (§5.13).

### 5.4 Baris berkas (`.file-row`)
- Tinggi min 64px, padding horizontal `--gutter`, garis bawah `--line`.
- Kiri: thumbnail 34×46. Tengah: nama (16/600, satu baris, ellipsis) + meta
  "PDF, 2 halaman, 412 KB" (13, muted). **Tanpa tag berwarna** seperti
  "DOKUMEN PDF"/"HASIL SCAN".
- Seluruh baris bisa disentuh → membuka lembar aksi (bottom sheet) berisi:
  Lihat, Simpan ke Files, Bagikan, Ganti nama, Hapus (merah, paling bawah).
- Tidak ada deretan 4 tombol di setiap baris.

### 5.5 Label grup (`.group-label`)
13/600, `--muted`, margin 16px atas. Isi: "Hari ini", "Minggu ini",
lalu nama bulan ("Oktober", "September 2025" bila beda tahun).

### 5.6 Tab teks (`.tabs`)
Teks 15px, jarak 22px, garis bawah aktif 2,5px `--pen`, garis dasar `--line`.
Isi: Semua, Scan, PDF, Tanda tangan. Bukan chip/pill berwarna.

### 5.7 Tombol
| Varian | Gaya | Contoh |
|---|---|---|
| Utama (`.btn-ink`) | latar `--pen`, teks putih, 46–52px, radius 12 | Simpan ke Files, Cadangkan semua ke ZIP |
| Outline (`.btn-out`) | border 1,5px `--line-strong`, latar transparan | Pulihkan dari cadangan, Verifikasi |
| Teks (`.btn-text`) | tanpa latar, warna `--pen`, 44px | Bagikan, Cek update, Pasang |
| Bahaya | teks/border `--danger` | Hapus |

- Maks **satu** tombol utama per layar atau per panel.
- Tidak menambahkan panah "→" atau ikon "+"/"⬇" di teks tombol.
- Label = kata kerja + objek ("Simpan tanda tangan", bukan "Simpan" atau "Submit").

### 5.8 Bilah navigasi bawah (`.nav`)
- Latar `--paper`, garis atas `--line`, tinggi 82px + safe area.
- Grid `1fr 1fr 1fr 1.5fr`: **Dokumen**, **Alat PDF**, **Cadangan**, lalu
  tombol **Pindai** (latar `--pen`, teks putih, 48px, radius 12, ikon bingkai pindai).
- Item aktif: warna `--ink` + bobot 700. Tidak ada latar/pill di item aktif.
- Tombol Pindai **tidak melayang**, tidak bulat, tidak berbayang.

### 5.9 Baris setelan (`.setting-row`)
Min 56px, teks 15px, garis bawah `--line`. Kanan berisi nilai (muted) +
chevron, toggle (checkbox `accent-color: var(--pen)`), atau tombol teks.

### 5.10 Pratinjau filter (`.filter-preview`)
4 thumbnail 52×68 yang menampilkan **hasil** tiap filter: Tajam, Hitam putih,
Abu-abu, Asli. Pilihan aktif: `outline: 2.5px solid var(--pen); outline-offset: 2px`
+ label 700. `role="radiogroup"`/`role="radio"`.

### 5.11 Viewfinder kamera (`.viewfinder`)
- Tinggi ±56% layar, latar `--camera`, full-bleed (tanpa radius/margin).
- Garis deteksi: poligon `--pen-soft` 2px + isi `rgba(36,69,201,.10)` + 4
  titik sudut (lingkaran 7px, isi `--paper`, garis `--pen`).
- Atas: tombol bulat Tutup dan Flash (44px, latar `rgba(23,32,43,.55)`),
  tengah "Halaman 3".
- Bawah: pesan status pada pil `--paper` ("Tepi pas. Tahan sebentar.").

### 5.12 Shutter & baki halaman
Grid 3 kolom: baki halaman (2 kertas mini bertumpuk + badge angka `--ink`),
shutter 76px (cincin 4px `--ink`, isi `--pen`), tombol teks **Selesai**.

### 5.13 Panel alat (`.tool`)
- **Gabung PDF** = panel besar (lebar penuh) berisi diagram 2 kertas
  menumpuk, judul, deskripsi 1 kalimat, tombol utama "Pilih berkas".
- **Kecilkan ukuran** dan **Beri watermark** = 2 panel kecil berdampingan,
  masing-masing diagram mini (kertas besar → kertas kecil; kertas dengan
  teks miring "SALINAN") + judul + 1 baris keterangan.
- Ukuran panel sengaja berbeda; jangan dijadikan grid kartu seragam.

### 5.14 Slip tanda tangan (`.sig-slip`)
`<canvas id="sigCanvas">` bergaya kertas (`--paper`, radius 3, bayangan
ringan), tinggi 150px. Garis putus-putus `--line-strong` 34px dari bawah,
teks bantu "Gores dengan jari atau stylus". Goresan default tinta `--pen`,
lebar 2,6px. Di bawah: tombol teks **Hapus** (kiri) dan tombol utama
**Simpan tanda tangan** (kanan).

### 5.15 Angka penyimpanan
"12,4 MB" ukuran 60/800 di layar Cadangan, diikuti 1 kalimat: "{n} berkas
tersimpan di HP ini. Terakhir dicadangkan {waktu}." Tidak ada progress bar
gradien. (Isi dari `storageUsedText`/`storageCountText`.)

### 5.16 Input
46px, radius 12, border 1,5px `--line-strong`, latar `--paper`. Setiap input
punya `<label>` (boleh visually-hidden). Placeholder berupa format, mis.
`ATTA-DOCS-XXXX-XXXX`. **Jangan mengisi nilai contoh** seperti
`member@attanation.com` atau `ATTA-PRO-FOUNDER-EDITION` ke dalam `value`.

### 5.17 Toast
Pil `--ink` dengan teks putih 14/600 di atas nav, 1 baris. Error: latar
`--danger`. Hilang otomatis 3 detik. Tanpa emoji dan tanpa tanda seru.

### 5.18 Lembar bawah (bottom sheet) & modal
Untuk aksi berkas, panduan instal, dan pemberitahuan update. Latar `--paper`,
radius atas 12px, handle 36×4px, backdrop `rgba(23,32,43,.45)` tanpa blur.

### 5.19 Empty state
Satu kertas kosong miring (tiruan), judul "Belum ada dokumen", kalimat
"Pindai KTP, surat, atau kwitansi pertamamu. Semua tersimpan di HP ini.",
tombol utama **Pindai dokumen**.

---

## 6. Layar

Semua layar: lebar mobile 360–430px, konten max-width 480px di tengah untuk
tablet/desktop, margin `--gutter`.

### 6.1 Dokumen (tab default)
```
┌────────────────────────────────┐
│ Dokumen                    (⌕) │  h1 + tombol cari
│ 38 berkas, 12,4 MB. Semua…     │  lead
│ ┌──┐╲                          │
│ │▤▤│ ╲  Baru dipindai, 10 mnt  │  TUMPUKAN (elemen utama)
│ │▤▤│  │ Surat keterangan aktif │
│ └──┘  │ [ Simpan ke Files ]    │
│       │   Bagikan              │
│ Semua  Scan  PDF  Tanda tangan │  tab teks
│ Minggu ini                     │  label grup
│ ▫ Foto KTP sisi depan          │  baris
│ ▫ Kwitansi kos Oktober         │
│ Oktober                        │
│ ▫ Transkrip nilai semester 4   │
├────────────────────────────────┤
│ Dokumen  Alat PDF  Cadangan [Pindai] │
└────────────────────────────────┘
```
Pencarian: ketuk ⌕ → kolom cari menggantikan h1 (input `vaultSearchInput`).

### 6.2 Pindai
```
┌────────────────────────────────┐
│ (×)        Halaman 3       (⚡) │
│     ╱‾‾‾‾‾‾‾‾‾‾╲               │  VIEWFINDER full-bleed
│    │  kertas    │  ← garis biru │
│     ╲__________╱               │
│     [Tepi pas. Tahan sebentar.]│
│ [▤] [▤] [▤] [▤]                │  pratinjau filter
│ Tajam Hitam putih Abu-abu Asli │
│ Ukuran hasil   Seimbang, ~180 KB ›│
│ Langsung jadi PDF A4       [✓] │
│ [▤▤2]      ( ● )      Selesai  │  baki – shutter – selesai
└────────────────────────────────┘
```
Tanpa nav bawah (alur layar penuh). Tombol × kembali ke tab sebelumnya.
Pilihan ukuran membuka lembar bawah: Seimbang (0.78), Ekstra hemat (0.58),
Kualitas penuh (0.90) — nilai yang sama dengan `compressionQualitySelect`.
Di browser tanpa akses kamera langsung, viewfinder diganti tombol besar
"Buka kamera" (input `capture="environment"`) dan "Pilih dari galeri".

### 6.3 Alat PDF
```
│ Alat PDF                       │
│ Diproses di HP. Tidak ada…     │
│ ┌────────────────────────────┐ │
│ │ ▤▤  Gabung PDF dan foto     │ │  panel besar
│ │     [ Pilih berkas ]        │ │
│ └────────────────────────────┘ │
│ ┌────────────┐ ┌────────────┐  │
│ │ ▤→▫ Kecilkan│ │ ▤ Watermark│  │  2 panel kecil
│ └────────────┘ └────────────┘  │
│ Tanda tangan                   │
│ ┌────────────────────────────┐ │
│ │   ~~~~~ (tinta biru)        │ │  slip tanda tangan
│ │ - - - - - - - - - - - - -   │ │
│ └────────────────────────────┘ │
│ Hapus        [Simpan tanda tangan] │
```

### 6.4 Cadangan
```
│ Cadangan                       │
│ 12,4 MB                        │  angka besar
│ 38 berkas … dicadangkan 3 hari │
│ [ Cadangkan semua ke ZIP ]     │
│ ( Pulihkan dari cadangan )     │
│ Simpan file ZIP-nya di Drive…  │
│ Aplikasi                       │
│ Versi 2.0.0, siap offline  Cek update │
│ Installer APK Android      Unduh      │
│ Pasang di layar utama      Pasang     │
│ Lisensi Pro                    │
│ [ATTA-DOCS-XXXX-XXXX] (Verifikasi) │
```
Banner instal dan meter penyimpanan **tidak lagi tampil permanen di atas
semua tab**; keduanya pindah ke layar ini.

---

## 7. Penulisan (UX writing)

- Bahasa Indonesia sehari-hari, sapaan implisit ("Pindai KTP-mu"), tidak
  memakai "Anda" berulang-ulang.
- Kalimat pendek. Satu elemen = satu tugas.
- Tidak menjual diri: hindari "100%", "Pintar", "Canggih", "Super", "Magic",
  "Pro" di luar nama produk, dan tanda seru.
- Status dan error menyebut apa yang terjadi + apa yang harus dilakukan.

### 7.1 Kosakata baku (pakai persis, konsisten di tombol & toast)
| Pakai | Jangan |
|---|---|
| Dokumen (tab), berkas (item) | Berkas Lokal, Vault, File Vault |
| Pindai | Scan Kamera, Pindai Kamera |
| Simpan ke Files | Simpan ke Galeri/Files, Unduh permanen |
| Bagikan | Share |
| Cadangkan / Pulihkan | Backup / Restore, Ekspor/Impor Data |
| Kecilkan ukuran | Kompres, Kompresi Hemat Memori |
| Tanda tangan | e-Signature, TTD (boleh di tab sempit) |
| Pasang di layar utama | Instal App, Add to Home Screen |

### 7.2 Contoh toast (ganti teks lama di `app.js`)
| Lama | Baru |
|---|---|
| `Tersimpan di HP! Ukuran dihemat 65% dengan kompresi otomatis.` | `Tersimpan. Ukuran 65% lebih kecil.` |
| `PDF berhasil digabungkan dan disimpan di HP Anda!` | `PDF digabung dan disimpan.` |
| `Pilih minimal 2 berkas PDF atau gambar untuk digabungkan.` | `Pilih minimal 2 berkas untuk digabung.` |
| `Gagal menggabungkan PDF: {err}` | `PDF tidak bisa digabung. {err}. Coba pilih ulang berkasnya.` |
| `Backup berhasil! {n} berkas diunduh sebagai {zip}.` | `{n} berkas dicadangkan ke {zip}.` |
| `Tanda tangan digital berhasil disimpan ke Berkas Lokal!` | `Tanda tangan disimpan.` |
| `Berkas dihapus dari penyimpanan lokal.` | `Berkas dihapus.` (+ tombol teks "Urungkan" bila memungkinkan) |

---

## 8. Kontrak dengan kode yang sudah ada

Rebuild **hanya mengganti tampilan**. Logika di `js/db.js` dan fungsi di
`js/app.js` dipertahankan. ID dan fungsi berikut wajib tetap ada (boleh
dipindah posisinya di DOM):

- Navigasi: `switchTab('vault'|'scanner'|'tools'|'backup')`, `section#view-vault`,
  `#view-scanner`, `#view-tools`, `#view-backup`, `.bnav-btn[data-tab]`
  (boleh diganti class baru asal `switchTab` diperbarui).
- Dokumen: `#vaultListContainer`, `#vaultSearchInput`, `renderFileVault()`,
  `filterVaultByCategory('all'|'scan'|'pdf'|'signed', el)`,
  `saveItemToPhone(id, share)`, `previewItem(id)`, `removeItem(id)`.
- Pindai: `selectScannerFilter('magic'|'bw'|'gray'|'original', el)`,
  `#compressionQualitySelect` (nilai 0.78/0.58/0.90), `#autoPdfToggle`,
  `handleCameraOrGalleryInput(input)`.
- Alat: `handleMergePdfsTool(input)`, `handleWatermarkPdfTool(input)`,
  `#sigCanvas`, `clearSignatureCanvas()`, `saveSignatureToVault()`.
- Cadangan: `triggerExportBackupZip()`, `triggerImportRestoreFile(input)`,
  `checkServerVersionAndUpdate()`, `verifyLicenseInPwa()`, `#licEmailInput`,
  `#licKeyInput`, `#storageUsedText`, `#storageCountText`, `#storageBarFill`,
  `#persistStatusBadge`.
- Instal & update: `triggerAndroidInstall()`, `#nativeInstallBtn`,
  `openInstallGuideModal()`, `closeInstallGuideModal()`, `#installGuideModal`,
  `#updatePopup`, `applyServiceWorkerUpdateNow()`, `#updateApkDirectBtn`.
- Toast: `showToast(msg, isError)`, `#appToast`.

Perubahan yang **perlu** dilakukan di `renderFileVault()`:
- Ganti markup `.file-card` menjadi `.file-row` (§5.4) dan kelompokkan per
  waktu (§5.5) berdasarkan `item.createdAt`.
- Hapus tag `DOKUMEN PDF`/`HASIL SCAN` dan 4 tombol per kartu; pindahkan
  aksi ke lembar bawah.
- Isi `.stack` dengan 3 item terbaru.
- Ganti empty state (§5.19), hapus emoji `📑`.

Fitur baru di desain yang **belum ada** di kode (tandai "segera hadir" atau
implementasikan, jangan biarkan tombol mati):
- Alat "Kecilkan ukuran" dengan target 200 KB / 500 KB / 1 MB
  (saat ini tile Kompres hanya membuka tab Pindai).
- Pencarian sebagai overlay di header.
- Lembar bawah aksi berkas dan "Ganti nama".
- Waktu "Terakhir dicadangkan" (simpan timestamp di `settings` Dexie).

Bersihkan juga:
- `meta viewport`: hapus `maximum-scale=1, user-scalable=no` (aksesibilitas zoom).
- `theme-color` → `#DCE2E7`; `manifest.json` `background_color` → `#DCE2E7`,
  `theme_color` → `#DCE2E7`.
- Hapus semua `style="..."` inline dari `index.html`; semuanya lewat class.
- Tambahkan font ke daftar cache `service-worker.js` dan naikkan versi cache.

---

## 9. Larangan (daftar periksa anti-slop)

Kalau salah satu muncul, desain dianggap gagal:

- [ ] Emoji di UI (📁 📷 🛠️ 🛡️ ✨ 📄 🪨 🖼️ 📑 🗜️ 📦 ✍️ 🔄 🤖 🔑 🚀 ⚡ 📱 🍎).
- [ ] Ikon di dalam kotak/tile berwarna di setiap baris atau di atas judul.
- [ ] Deretan kartu identik (ukuran, ikon, padding sama).
- [ ] Gradien dekoratif, glow, blur kaca, ungu/lavender, teal lama.
- [ ] Tombol mengambang bulat dengan bayangan berwarna.
- [ ] Label HURUF KAPITAL SEMUA, eyebrow di atas judul, teks "A · B · C".
- [ ] Satu kata di judul diberi warna/italic berbeda.
- [ ] Panah "→" atau simbol "+ ⬇ ↗ ↻" di teks tombol.
- [ ] Copy promosi: "100% offline", "Pintar", "Magic", "Canggih", tanda seru.
- [ ] Angka/testimoni/statistik karangan di UI produksi.
- [ ] Nilai contoh terisi di input (`value="member@…"`).
- [ ] Fade-in per section, animasi berulang tanpa pemicu.
- [ ] Lebih dari satu tombol utama `--pen` di satu layar/panel.
- [ ] Banner/kartu permanen di atas semua tab.
- [ ] Tombol atau menu yang tidak melakukan apa pun.

---

## 10. Aksesibilitas (wajib)

- Kontras teks ≥ 4,5:1 (`--muted` di `--desk` = 4,9:1; putih di `--pen` = 7,6:1; `--ink` di `--desk` = 12,6:1).
- Target sentuh ≥ 44×44px, jarak antartarget ≥ 8px.
- Elemen interaktif memakai `<button>`, `<a href>`, `<input>` + `<label>`;
  tidak ada `onclick` di `<div>`.
- Fokus keyboard terlihat: `outline: 2.5px solid var(--pen); outline-offset: 2px`.
- Tab memakai `role="tablist"`/`role="tab"`/`aria-selected`; filter memakai
  `role="radiogroup"`.
- Zoom browser tidak diblokir.
- `prefers-reduced-motion` dihormati.

---

## 11. Cara kerja untuk agen AI

1. Baca file ini sampai habis sebelum menyentuh `index.html` / `app.css` / `app.js`.
2. Tulis token §4 ke `:root` lebih dulu; komponen hanya memakai `var(--…)`.
3. Bangun komponen §5, lalu susun layar §6. Jangan menambah section,
   kartu, atau dekorasi yang tidak ada di dokumen ini.
4. Pertahankan kontrak §8. Jalankan uji: pindai 1 foto, gabung 2 PDF,
   watermark, simpan tanda tangan, cadangkan & pulihkan ZIP, mode offline.
5. Sebelum selesai, centang daftar §9 dan §10 satu per satu, buka aplikasi di
   lebar 360px dan 430px, lalu perbaiki 3 masalah terbesar yang terlihat.
6. Bila ragu antara dua pilihan, pilih yang lebih tenang dan lebih sedikit
   elemen.

---

## 12. Tambahan v2.4: layar pembuka, Pengaturan, tema gelap, kunci aplikasi

### 12.1 Token tambahan
```css
:root {
  --surface:     #FBFBF8; /* panel, nav, lembar bawah, input */
  --pen-text:    #2445C9; /* tinta sebagai warna teks */
  --danger-text: #B42318;
}
html[data-theme="dark"] {
  --desk: #12161B; --surface: #1D232B; --ink: #E6EAEE; --muted: #A1ACB8;
  --line: #2C3440; --line-strong: #4B5664; --pen-text: #93A9FF; --danger-text: #FF8A80;
}
```
- Di tema gelap **meja dan panel** jadi gelap, tetapi **kertas dokumen tetap putih**
  dengan tinta gelap (thumbnail, tumpukan, slip tanda tangan, editor samarkan).
  Caranya: elemen kertas mendeklarasikan ulang `--ink`, `--muted`, `--line` versi terang.
- Isian tinta di tombol utama tetap `--pen` (#2445C9) di kedua tema; teks tautan
  memakai `--pen-text`.
- Tema dipilih di Pengaturan: Terang, Gelap, atau Ikuti HP. Pilihan disalin ke
  `localStorage` agar dipasang sebelum halaman tampil (tidak berkedip).

### 12.2 Layar pembuka (splash)
- Latar `--desk`, logo B7 64px warna `--ink`, nama "DocStudio" 22/800, garis
  kemajuan 96×3px (`--line` dengan isian `--pen` bergeser), "ATTA NATION" 12px
  di bawah.
- Tampil minimal 450ms, hilang setelah penyimpanan siap (pudar 200ms). Pengaman:
  paksa hilang setelah 8 detik. `prefers-reduced-motion`: garis diam, tanpa pudar.

### 12.3 Layar kunci aplikasi
- Penuh layar di atas semua lembar (z-index 450). Ikon gembok, "Masukkan PIN",
  titik PIN, pesan error `--danger-text`, papan angka 3×4 (tombol 76×64,
  latar `--surface`), "Lupa PIN" kiri bawah, hapus angka kanan bawah.
- PIN 4–8 angka disimpan sebagai hash PBKDF2-SHA256 (210.000 iterasi + salt),
  tidak pernah apa adanya. 5 kali salah → papan angka terkunci 30 detik.
- Mengunci lagi setelah aplikasi ditinggal sesuai pilihan: langsung, 1 menit
  (bawaan), 5 menit. Membuka pemilih berkas atau menu bagikan tidak memicu kunci.
- Lupa PIN → lembar "Hapus semua data" (ketik HAPUS). Tidak ada pintu belakang.

### 12.4 Layar Pengaturan
Dibuka dari ikon roda gigi di header Dokumen dan Cadangan. Halaman turunan:
tombol kembali di kiri judul, **tanpa** navigasi bawah. Urutan grup:

| Grup | Isi |
|---|---|
| Tampilan | Tema (kontrol segmen 3 pilihan) |
| Pindai | Filter bawaan, Ukuran hasil, Langsung jadi PDF A4 (dipakai saat layar Pindai dibuka) |
| Keamanan | Kunci aplikasi dengan PIN, Kunci lagi setelah ditinggal |
| Gemini (pilihan) | Status kunci API + Hapus; catatan bahwa teks dikirim ke Google |
| Penyimpanan | Jumlah berkas & ukuran, status penyimpanan permanen, Hapus semua data |
| Tentang | Versi + Cek update, Pasang di layar utama, Privasi, Lisensi pihak ketiga |

- Label grup 15/600 `--muted`. Baris memakai `.setting-row` (min 56px).
- Setiap kontrol di Pengaturan harus benar-benar bekerja. Jangan menambah baris
  yang belum ada fungsinya (mis. bahasa, kontak) sampai fiturnya dibuat.
- Model bisnis: bayar sekali, semua fitur termasuk. Tidak ada layar lisensi,
  langganan, atau tombol "upgrade".

---

## 13. Tambahan v2.5: bahasa, akun, sidik jari, kontak

### 13.1 Dua bahasa (Indonesia dan English)
- Teks sumber **selalu ditulis dalam Bahasa Indonesia** di HTML dan JS.
- Terjemahan Inggris ada di `js/i18n.js`: `I18N_EN` untuk teks tetap,
  `I18N_PATTERNS` untuk teks berisi angka atau nama. Setiap teks baru wajib
  ditambahkan ke sana.
- Penerjemah DOM mengganti teks dan atribut (`placeholder`, `aria-label`,
  `title`, `alt`) otomatis, termasuk toast dan isi yang dibuat JS.
- Data pengguna **tidak diterjemahkan**: nama berkas, nama/email akun, isi
  dokumen. Tandai elemennya dengan `data-no-i18n` atau tambahkan selektornya ke
  `I18N_SKIP`.
- Teks yang tidak lewat DOM (nama berkas baru, isi PDF, hasil analisis) memakai
  `tr('...')` atau `currentLang` langsung di kode.
- Bahasa bawaan mengikuti bahasa HP (Indonesia bila `id`, selain itu English),
  bisa diganti di Pengaturan > Tampilan > Bahasa.
- Format angka: `12,4 MB` untuk Indonesia, `12.4 MB` untuk English.

### 13.2 Akun opsional (profil saja)
- Grup "Akun" paling atas di Pengaturan. Belum masuk: tombol teks Masuk dan
  Daftar. Sudah masuk: avatar huruf awal (lingkaran `--pen`), nama, email, Ubah
  nama, Keluar, Hapus akun (merah).
- Lembar Masuk/Daftar memakai satu formulir; tautan teks untuk berpindah mode
  dan "Lupa kata sandi?" (membuka WhatsApp).
- Server: `server-api/account.php` (PHP + MySQL milik ATTA NATION). Alamatnya di
  `js/config.js`. Kosong = lembar akun menampilkan "Server akun belum dipasang".
- Token sesi disimpan di HP (`settings.account`), tidak ikut file cadangan.
- Aplikasi tetap bisa dipakai penuh tanpa akun dan tanpa internet.

### 13.3 Sidik jari atau wajah
- Opsi di Keamanan, hanya muncul bila kunci aplikasi aktif dan HP punya
  autentikator bawaan (WebAuthn `isUserVerifyingPlatformAuthenticatorAvailable`).
- Layar kunci menawarkan sidik jari/wajah otomatis; PIN tetap selalu bisa dipakai.

### 13.4 Kontak
- Pengaturan > Tentang: "Hubungi lewat WhatsApp" (+62 812-3592-8712) dan
  "Kirim email" (attalaaliframadhanitrihida@gmail.com). Pesan pembuka otomatis
  menyebut versi aplikasi.
