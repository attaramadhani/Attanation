/**
 * ATTA DocStudio Pro — bahasa Indonesia / English.
 * Teks sumber ditulis dalam Bahasa Indonesia. Saat bahasa Inggris dipilih,
 * teks di layar diterjemahkan lewat kamus (teks tetap) dan pola (teks berisi angka/nama).
 * Data pengguna (nama berkas, nama akun, isi dokumen) tidak pernah diterjemahkan.
 */
let currentLang = (() => {
  try {
    const saved = localStorage.getItem('atta_lang');
    if (saved === 'id' || saved === 'en') return saved;
  } catch (_) {}
  return (navigator.language || 'id').toLowerCase().startsWith('id') ? 'id' : 'en';
})();

const I18N_EN = {
  /* Umum */
  'Membuka aplikasi': 'Opening the app',
  'Masukkan PIN': 'Enter PIN',
  'Pakai sidik jari atau wajah': 'Use fingerprint or face',
  'Lupa PIN': 'Forgot PIN',
  'Hapus angka': 'Delete digit',
  'Dokumen': 'Documents',
  'Cari dokumen': 'Search documents',
  'Pengaturan': 'Settings',
  'Cari nama berkas': 'Search file name',
  'Tutup': 'Close',
  'Memuat berkas di HP ini.': 'Loading files on this phone.',
  'Kategori dokumen': 'Document category',
  'Semua': 'All',
  'Tanda tangan': 'Signatures',
  'Pindai dokumen': 'Scan document',
  'Tutup pemindai': 'Close scanner',
  'Lampu kilat': 'Flash',
  'Pratinjau kamera': 'Camera preview',
  'Kamera langsung tidak tersedia di browser ini.': 'Live camera is not available in this browser.',
  'Buka kamera HP': 'Open phone camera',
  'Pilih dari galeri': 'Choose from gallery',
  'Ganti mode pindai': 'Change scan mode',
  'Mode dokumen': 'Document mode',
  'Mode KTP depan dan belakang': 'ID card front and back',
  'Mode atur 4 sudut': 'Adjust 4 corners',
  'Filter hasil pindaian': 'Scan filter',
  'Tajam': 'Sharp',
  'Hitam putih': 'Black and white',
  'Abu-abu': 'Grayscale',
  'Asli': 'Original',
  'Ukuran hasil': 'Output size',
  'Seimbang, sekitar 180 KB per halaman': 'Balanced, about 180 KB per page',
  'Ekstra hemat, sekitar 95 KB per halaman': 'Extra small, about 95 KB per page',
  'Kualitas penuh, sekitar 420 KB per halaman': 'Full quality, about 420 KB per page',
  'Ukuran hasil kompresi': 'Compressed size',
  'Seimbang': 'Balanced',
  'Ekstra hemat': 'Extra small',
  'Kualitas penuh': 'Full quality',
  'Langsung jadi PDF A4': 'Save as A4 PDF',
  'Tambah foto dari galeri': 'Add photo from gallery',
  'Pindai halaman': 'Scan page',
  'Ambil foto dokumen dari kamera': 'Take a document photo',
  'Pilih berkas dari galeri': 'Choose files from gallery',
  'Selesai': 'Done',
  'Memproses halaman...': 'Processing page...',

  /* Alat PDF */
  'Alat PDF': 'PDF tools',
  'Diproses di HP. Tidak ada yang diunggah.': 'Processed on your phone. Nothing is uploaded.',
  'Kelompok alat PDF': 'PDF tool groups',
  'Utama': 'Main',
  'Halaman': 'Pages',
  'Konversi': 'Convert',
  'Keamanan dan AI': 'Security and AI',
  'Gabung PDF dan foto': 'Merge PDFs and photos',
  'Pilih beberapa berkas, atur urutannya, jadikan satu PDF.': 'Pick several files, set their order, and make one PDF.',
  'Pilih berkas': 'Choose files',
  'Pilih berkas untuk digabung': 'Choose files to merge',
  'Kecilkan ukuran': 'Reduce size',
  'Untuk batas unggah': 'For upload limits',
  'Beri watermark': 'Add watermark',
  'Teks miring tiap halaman': 'Diagonal text on every page',
  'Tempel ke PDF': 'Place on PDF',
  'Gores dengan jari atau stylus': 'Sign with your finger or a stylus',
  'Hapus': 'Delete',
  'Simpan tanda tangan': 'Save signature',
  /* Tanda Tangan & Rotasi Stempel */
  'Putar 90°': 'Rotate 90°',
  'Tinta biru': 'Blue ink',
  'Tinta hitam': 'Black ink',
  'Tinta biru tua': 'Dark blue ink',
  'Tinta merah': 'Red ink',
  'Pilih warna lain': 'Choose other color',
  'Pilih warna kustom': 'Choose custom color',
  'Warna tinta tanda tangan': 'Signature ink color',
  'Warna tanda tangan stempel': 'Stamp signature color',
  'Warna tanda tangan': 'Signature color',
  'Tebal': 'Width',
  'Ketebalan goresan tanda tangan': 'Signature stroke width',
  'Pisahkan halaman PDF': 'Split PDF pages',
  'Ekstrak rentang halaman tertentu (mis. 1-2, 4) menjadi dokumen PDF terpisah.':
    'Extract page ranges (e.g. 1-2, 4) into separate PDFs.',
  'Pilih halaman': 'Choose pages',
  'Susun dan putar': 'Reorder and rotate',
  'Ubah urutan atau putar 90, 180, 270 derajat': 'Change the order or rotate 90, 180, 270 degrees',
  'Hapus halaman': 'Delete pages',
  'Buang halaman yang tidak diperlukan': 'Remove pages you do not need',
  'Nomor halaman': 'Page numbers',
  'Sisipkan nomor di atas atau bawah': 'Add numbers at the top or bottom',
  'Potong margin': 'Trim margins',
  'Rapikan tepi kosong dokumen PDF': 'Trim empty edges of a PDF',
  'KTP depan dan belakang ke 1 lembar A4': 'ID card front and back on one A4 page',
  'Susun 2 foto kartu identitas proporsional di halaman A4': 'Place 2 ID card photos neatly on an A4 page',
  'Word, Excel, CSV, TXT ke PDF': 'Word, Excel, CSV, TXT to PDF',
  'Ubah dokumen .docx, lembar kerja .xlsx, tabel .csv, atau teks .txt menjadi PDF A4.':
    'Turn .docx documents, .xlsx sheets, .csv tables, or .txt files into A4 PDFs.',
  'Pilih dokumen': 'Choose document',
  'PDF ke Word atau CSV': 'PDF to Word or CSV',
  'Ekstrak isi ke .docx, .csv, .md, .txt': 'Extract text to .docx, .csv, .md, .txt',
  'Luruskan 4 sudut': 'Straighten 4 corners',
  'Ratakan foto miring jadi persegi A4': 'Turn a tilted photo into a flat A4 page',
  'Analisis dan ringkasan': 'Analysis and summary',
  'Ambil nominal Rupiah, tanggal, dan nomor HP dari PDF berteks, lalu ringkas isinya.':
    'Pull amounts, dates, and phone numbers from text PDFs, then summarize them.',
  'Analisis dokumen': 'Analyze document',
  'Samarkan info': 'Redact info',
  'Tutup NIK atau nomor rekening': 'Hide ID or account numbers',
  'Bandingkan 2 PDF': 'Compare 2 PDFs',
  'Lihat selisih halaman dan teks': 'See differences in pages and text',
  'Perbaiki struktur PDF': 'Repair PDF structure',
  'Bangun ulang berkas PDF yang korup atau sulit dibuka': 'Rebuild PDFs that are corrupt or hard to open',
  'Pilih berkas untuk dikecilkan ukurannya': 'Choose a file to reduce',
  'Pilih PDF untuk diberi watermark': 'Choose a PDF to watermark',
  'Pilih dokumen Word, Excel, CSV, atau TXT': 'Choose a Word, Excel, CSV, or TXT file',
  'Pilih PDF untuk diperbaiki': 'Choose a PDF to repair',
  'Pilih foto dokumen untuk diluruskan': 'Choose a document photo to straighten',

  /* Cadangan */
  'Cadangan': 'Backup',
  'Cadangkan semua ke ZIP': 'Back up everything to ZIP',
  'Pulihkan dari cadangan': 'Restore from backup',
  'Pilih file cadangan ZIP atau JSON': 'Choose a ZIP or JSON backup file',
  'Simpan file ZIP-nya di Google Drive atau laptop, lalu pulihkan saat ganti HP.':
    'Keep the ZIP file in Google Drive or on a laptop, then restore it on your new phone.',
  'Belum pernah dicadangkan.': 'Never backed up.',
  'Semua dokumen tersimpan di HP ini.': 'All documents are stored on this phone.',

  /* Pengaturan */
  'Kembali': 'Back',
  'Akun': 'Account',
  'Belum masuk': 'Not signed in',
  'Akun tidak wajib. Dokumen tetap tersimpan di HP ini.': 'An account is optional. Documents stay on this phone.',
  'Masuk': 'Sign in',
  'Daftar': 'Sign up',
  'Ubah nama': 'Change name',
  'Keluar dari akun': 'Sign out',
  'Keluar': 'Sign out',
  'Hapus akun': 'Delete account',
  'Dokumen di HP ini tidak ikut terhapus': 'Documents on this phone are kept',
  'Tampilan': 'Appearance',
  'Tema': 'Theme',
  'Terang': 'Light',
  'Gelap': 'Dark',
  'Ikuti HP': 'System',
  'Bahasa': 'Language',
  'Pindai': 'Scan',
  'Filter bawaan': 'Default filter',
  'Kalau mati, tiap halaman disimpan sebagai foto': 'When off, each page is saved as a photo',
  'Keamanan': 'Security',
  'Kunci aplikasi dengan PIN': 'Lock the app with a PIN',
  'PIN diminta setiap kali aplikasi dibuka': 'Ask for the PIN every time the app opens',
  'Buka dengan sidik jari atau wajah': 'Unlock with fingerprint or face',
  'PIN tetap bisa dipakai sebagai cadangan': 'The PIN still works as a backup',
  'Kunci lagi setelah ditinggal': 'Lock again after leaving',
  'Langsung': 'Immediately',
  '1 menit': '1 minute',
  '5 menit': '5 minutes',
  'Gemini (pilihan)': 'Gemini (optional)',
  'Kunci API Gemini': 'Gemini API key',
  'Belum diisi. Analisis tetap jalan di HP.': 'Not set. Analysis still runs on your phone.',
  'Tersimpan di HP ini.': 'Saved on this phone.',
  'Isi kuncinya di layar Analisis dokumen. Bila diisi, teks dokumen yang dianalisis dikirim ke Google.':
    'Enter the key on the Analyze document screen. When set, the analyzed text is sent to Google.',
  'Penyimpanan': 'Storage',
  'Siap dipakai offline': 'Ready to use offline',
  'Hapus semua data': 'Delete all data',
  'Semua dokumen dan pengaturan di HP ini': 'All documents and settings on this phone',
  'Tentang': 'About',
  'Versi': 'Version',
  'ATTA DocStudio Pro dari ATTA NATION': 'ATTA DocStudio Pro by ATTA NATION',
  'Cek update': 'Check for updates',
  'Pasang di layar utama': 'Add to home screen',
  'Pasang': 'Install',
  'Hubungi lewat WhatsApp': 'Contact us on WhatsApp',
  'Kirim email': 'Send an email',
  'Privasi': 'Privacy',
  'Lisensi pihak ketiga': 'Third-party licenses',
  'Semua fitur sudah termasuk dalam pembelianmu.': 'All features are included in your purchase.',
  'Navigasi utama': 'Main navigation',

  /* Lembar aksi berkas */
  'Nama berkas': 'File name',
  'Lihat': 'View',
  'Simpan ke Files': 'Save to Files',
  'Bagikan': 'Share',
  'Analisis dan ekstrak teks': 'Analyze and extract text',
  'Tempel tanda tangan': 'Place signature',
  'Kunci dengan PIN': 'Lock with PIN',
  'Buka kunci PIN': 'Remove PIN lock',
  'Ganti nama': 'Rename',
  'Ganti nama berkas': 'Rename file',
  'Gunakan nama yang mudah dicari saat melamar atau mendaftar.': 'Use a name that is easy to find when you apply or register.',
  'Nama berkas baru': 'New file name',
  'Simpan nama': 'Save name',
  'Batal': 'Cancel',
  'Pratinjau': 'Preview',
  'Mode pindai': 'Scan mode',
  'Pilih cara pemindaian sesuai jenis dokumen fisik.': 'Choose how to scan based on the paper document.',
  'Dokumen A4': 'A4 document',
  'Surat, ijazah, kwitansi': 'Letters, certificates, receipts',
  'Kartu KTP depan-belakang': 'ID card front and back',
  '2 foto jadi 1 lembar A4': '2 photos on one A4 page',
  'Potong 4 sudut dan luruskan': 'Crop 4 corners and straighten',
  'Koreksi perspektif miring': 'Fix a tilted perspective',
  'Ukuran hasil pindai': 'Scan output size',
  'Pilih ukuran berkas yang sesuai dengan kebutuhan unggah.': 'Choose a file size that fits your upload needs.',
  'sekitar 180 KB per halaman': 'about 180 KB per page',
  'sekitar 95 KB per halaman': 'about 95 KB per page',
  'sekitar 420 KB per halaman': 'about 420 KB per page',
  'Ketuk berkas sesuai urutan yang kamu mau. Nomor menunjukkan urutan halaman di PDF hasil.':
    'Tap files in the order you want. The numbers show the page order in the result.',
  'Pilih minimal 2 berkas': 'Choose at least 2 files',
  'Pilih dari penyimpanan HP': 'Choose from phone storage',
  'Kecilkan ukuran berkas': 'Reduce file size',
  'Pilih batas ukuran portal pendaftaran, lalu pilih berkasnya.': 'Choose the size limit of the upload portal, then choose the file.',
  'Maksimal 200 KB': 'Up to 200 KB',
  'Portal CPNS dan beasiswa': 'Civil service and scholarship portals',
  'Maksimal 500 KB': 'Up to 500 KB',
  'Lamaran kerja dan kampus': 'Job and university applications',
  'Maksimal 1 MB': 'Up to 1 MB',
  'Arsip dokumen jelas': 'Clear document archive',
  'Atau langsung kecilkan berkas di Dokumen HP ini:': 'Or reduce a file from Documents on this phone:',
  'Pilih berkas dari penyimpanan HP': 'Choose a file from phone storage',
  'Beri watermark pada PDF': 'Watermark a PDF',
  'Teks akan dicetak miring di setiap halaman PDF agar dokumen tidak disalahgunakan.':
    'The text is printed diagonally on every page so the document is not misused.',
  'Teks watermark': 'Watermark text',
  'Mis. SALINAN VERIFIKASI': 'e.g. VERIFICATION COPY',
  'Pilih dari Dokumen di HP ini:': 'Choose from Documents on this phone:',
  'Pilih PDF dari penyimpanan HP': 'Choose a PDF from phone storage',
  'Atur halaman PDF': 'Manage PDF pages',
  'Atur opsi pemrosesan lalu pilih berkas PDF.': 'Set the options, then choose a PDF.',
  'Rentang atau nomor halaman': 'Page range or numbers',
  'Mis. 1-2, 4': 'e.g. 1-2, 4',
  'Pilihan pengaturan': 'Option',
  'Putar 90 derajat searah jarum jam': 'Rotate 90 degrees clockwise',
  'Putar 180 derajat': 'Rotate 180 degrees',
  'Putar 270 derajat': 'Rotate 270 degrees',
  'Tanpa rotasi (hanya ubah urutan)': 'No rotation (reorder only)',
  'Pilih langsung dari Dokumen di HP ini:': 'Choose directly from Documents on this phone:',
  'Pilih berkas PDF untuk diproses': 'Choose a PDF to process',
  'Pisahkan halaman': 'Split pages',
  'Masukkan rentang halaman yang ingin dipisahkan menjadi berkas PDF baru.': 'Enter the page ranges to split into new PDFs.',
  'Rentang halaman (mis. 1, 2-3)': 'Page range (e.g. 1, 2-3)',
  'Mis. 1, 2-3': 'e.g. 1, 2-3',
  'Hapus halaman PDF': 'Delete PDF pages',
  'Masukkan nomor halaman yang ingin dibuang dari dokumen PDF.': 'Enter the page numbers to remove from the PDF.',
  'Nomor halaman yang dihapus': 'Pages to delete',
  'Mis. 2': 'e.g. 2',
  'Susun dan putar halaman': 'Reorder and rotate pages',
  'Atur urutan halaman baru (kosongkan jika hanya ingin memutar seluruh halaman).':
    'Set the new page order (leave empty to only rotate all pages).',
  'Urutan halaman baru (opsional)': 'New page order (optional)',
  'Mis. 2, 1': 'e.g. 2, 1',
  'Rotasi halaman': 'Page rotation',
  'Nomor halaman otomatis': 'Automatic page numbers',
  'Sisipkan penomoran Halaman 1 dari N pada setiap lembar PDF.': 'Add "Page 1 of N" numbering to every PDF page.',
  'Format teks nomor halaman': 'Page number format',
  'Posisi nomor halaman': 'Page number position',
  'Potong margin PDF': 'Trim PDF margins',
  'Rapikan tepi kosong di sekeliling halaman PDF.': 'Trim the empty edges around PDF pages.',
  'Lebar margin yang dipotong (point, 10 sampai 72)': 'Margin to trim (points, 10 to 72)',
  'Pilih PDF, lalu tandai bagian yang ingin ditutup hitam di setiap halaman.': 'Choose a PDF, then mark the parts to black out on each page.',
  'Atas': 'Top',
  'Bawah': 'Bottom',
  'Tengah bawah': 'Bottom center',
  'Kanan bawah': 'Bottom right',
  'Kiri bawah': 'Bottom left',

  /* PIN aplikasi, hapus data, privasi */
  'Buat PIN aplikasi': 'Create app PIN',
  'PIN ini diminta setiap kali aplikasi dibuka. Kalau lupa, satu-satunya cara masuk adalah menghapus semua data.':
    'This PIN is asked every time the app opens. If you forget it, the only way in is to delete all data.',
  'PIN (4 sampai 8 angka)': 'PIN (4 to 8 digits)',
  'Ulangi PIN': 'Repeat PIN',
  'Simpan PIN': 'Save PIN',
  'Matikan kunci aplikasi': 'Turn off app lock',
  'Masukkan PIN aplikasi untuk mematikan kunci.': 'Enter the app PIN to turn off the lock.',
  'Matikan kunci': 'Turn off lock',
  'Hapus semua data?': 'Delete all data?',
  'Semua dokumen, tanda tangan, dan pengaturan di HP ini akan hilang dan tidak bisa dikembalikan. Cadangkan dulu kalau masih perlu.':
    'All documents, signatures, and settings on this phone will be gone for good. Back up first if you still need them.',
  'Ketik HAPUS untuk melanjutkan': 'Type HAPUS to continue',
  'Lupa PIN aplikasi': 'Forgot app PIN',
  'PIN tidak bisa dipulihkan. Untuk masuk lagi, semua data di aplikasi ini harus dihapus. Dokumen yang pernah dicadangkan ke ZIP bisa dipulihkan setelahnya.':
    'The PIN cannot be recovered. To get back in, all data in this app must be deleted. Documents backed up to ZIP can be restored afterwards.',
  'Dokumen, foto, dan tanda tanganmu disimpan di penyimpanan browser HP ini. Aplikasi tidak menyimpan berkas di server mana pun.':
    'Your documents, photos, and signatures are stored in this phone’s browser storage. The app does not store files on any server.',
  'Pemindaian, gabung PDF, kecilkan ukuran, watermark, samarkan info, dan kunci PIN semuanya diproses di HP.':
    'Scanning, merging, size reduction, watermarks, redaction, and PIN locks all run on your phone.',
  'Satu pengecualian: kalau kamu mengisi kunci API Gemini, teks dokumen yang kamu analisis dikirim ke Google untuk diproses.':
    'One exception: if you enter a Gemini API key, the text of documents you analyze is sent to Google for processing.',
  'Kalau kamu membuat akun, nama, email, dan kata sandi (dalam bentuk acak) disimpan di server ATTA NATION. Dokumen tidak pernah dikirim ke server itu. Akun bisa dihapus kapan saja dari Pengaturan.':
    'If you create an account, your name, email, and password (as a one-way hash) are stored on the ATTA NATION server. Documents are never sent there. You can delete the account anytime in Settings.',
  'Selain itu, aplikasi menghubungi internet hanya untuk memeriksa versi terbaru. Tidak ada iklan dan tidak ada pelacakan.':
    'Otherwise, the app only goes online to check for the latest version. No ads and no tracking.',
  'Menghapus data browser atau aplikasi akan menghapus dokumenmu. Cadangkan ke ZIP secara berkala.':
    'Clearing browser or app data deletes your documents. Back up to ZIP regularly.',
  ', Stuart Knightley dan kontributor. MIT License atau GPLv3, dipakai di bawah MIT.':
    ', Stuart Knightley and contributors. MIT License or GPLv3, used under MIT.',
  'dan font standar PDF.js. SIL Open Font License 1.1 dan lisensi Foxit (lihat folder js/vendor/pdfjs).':
    'and the PDF.js standard fonts. SIL Open Font License 1.1 and the Foxit license (see js/vendor/pdfjs).',

  /* Samarkan */
  'Tandai bagian yang ditutup': 'Mark the parts to hide',
  'Geser jari di atas halaman untuk menutup NIK, nomor rekening, atau info lain. Hasilnya disimpan sebagai salinan baru.':
    'Drag over the page to cover ID numbers, account numbers, or other info. The result is saved as a new copy.',
  'Halaman PDF. Geser untuk menutup bagian rahasia.': 'PDF page. Drag to cover private parts.',
  'Halaman sebelumnya': 'Previous page',
  'Sebelum': 'Previous',
  'Halaman berikutnya': 'Next page',
  'Lanjut': 'Next',
  'Hapus kotak terakhir': 'Remove last box',
  'Setiap halaman disimpan sebagai gambar, jadi teks di PDF hasil tidak bisa disalin lagi.':
    'Each page is saved as an image, so text in the result can no longer be copied.',
  'Simpan versi tersamarkan': 'Save redacted copy',
  'Menyimpan...': 'Saving...',

  /* KTP, luruskan, tanda tangan */
  'Pilih 2 foto kartu identitas (sisi depan dan sisi belakang). Keduanya akan disusun otomatis di tengah halaman A4.':
    'Choose 2 ID card photos (front and back). Both are placed in the middle of an A4 page.',
  'Pilih foto sisi depan dan belakang kartu': 'Choose front and back photos of the card',
  'Pilih 2 foto kartu': 'Choose 2 card photos',
  'Luruskan perspektif 4 sudut': 'Straighten using 4 corners',
  'Geser titik biru ke 4 sudut kertas atau putar halaman sebelum disimpan.': 'Drag the blue dots to the 4 corners of the paper, or rotate before saving.',
  'Putar 90 derajat': 'Rotate 90 degrees',
  'Atur ulang sudut': 'Reset corners',
  'Luruskan dan simpan': 'Straighten and save',
  'Tempel tanda tangan ke PDF': 'Place signature on PDF',
  'Tanda tangan pada kanvas akan dibubuhkan langsung ke halaman PDF.': 'The signature you drew is placed directly on the PDF page.',
  'Halaman tujuan': 'Target page',
  'Halaman terakhir': 'Last page',
  'Halaman pertama': 'First page',
  'Semua halaman': 'All pages',
  'Posisi tanda tangan': 'Signature position',
  'Pilih berkas PDF yang akan ditandatangani': 'Choose the PDF to sign',

  /* Konversi, perbaiki, bandingkan, analisis */
  'Konversi PDF ke dokumen lain': 'Convert PDF to another format',
  'Pilih format keluaran, lalu ketuk dokumen di bawah atau pilih dari penyimpanan HP.': 'Choose an output format, then tap a document below or choose from phone storage.',
  'Format hasil konversi': 'Output format',
  'Word (.docx), bisa diedit': 'Word (.docx), editable',
  'CSV, dibuka di Excel': 'CSV, opens in Excel',
  'Teks biasa (.txt)': 'Plain text (.txt)',
  'Pilih berkas PDF untuk dikonversi': 'Choose a PDF to convert',
  'Bangun ulang tabel referensi dan halaman PDF agar dapat dibuka kembali dengan normal.': 'Rebuild the PDF’s reference table and pages so it opens normally again.',
  'Bandingkan dua dokumen PDF': 'Compare two PDFs',
  'Bandingkan jumlah halaman, ukuran berkas, dan selisih baris teks.': 'Compare page counts, file sizes, and text line differences.',
  'Pilih 2 berkas PDF untuk dibandingkan': 'Choose 2 PDFs to compare',
  'Bandingkan 2 dokumen terbaru di HP ini': 'Compare the 2 newest documents on this phone',
  'Pilih 2 berkas PDF dari penyimpanan': 'Choose 2 PDFs from storage',
  'Analisis dan ringkasan dokumen': 'Document analysis and summary',
  'Bekerja untuk PDF yang teksnya bisa disalin. Foto hasil scan belum bisa dibaca.': 'Works for PDFs with selectable text. Scanned photos cannot be read yet.',
  'Mode hasil': 'Result mode',
  'Ringkasan dan deteksi entitas (Lokal / Gemini)': 'Summary and key details (on device / Gemini)',
  'Ubah ke struktur Markdown': 'Convert to Markdown',
  'Terjemahkan ke Bahasa Inggris (dengan API Key)': 'Translate to English (needs API key)',
  'Kunci API Gemini (opsional, kosongkan untuk mode offline)': 'Gemini API key (optional, leave empty to stay offline)',
  'Kosongkan untuk analisis lokal di HP': 'Leave empty to analyze on your phone',
  'Bila kunci diisi, isi teks dokumen dikirim ke server Google untuk diproses. Kosongkan kalau dokumennya rahasia.':
    'With a key, the document text is sent to Google for processing. Leave it empty for private documents.',
  'Ketuk dokumen di HP ini untuk langsung dianalisis:': 'Tap a document on this phone to analyze it:',
  'Pilih berkas PDF atau teks untuk dianalisis': 'Choose a PDF or text file to analyze',
  'Salin hasil teks': 'Copy result',
  'Masukkan PIN untuk berkas ini.': 'Enter the PIN for this file.',
  'Kunci berkas': 'Lock file',
  'Buka kunci permanen': 'Remove lock',
  'Buka kunci': 'Unlock',
  'Berkas terkunci': 'Locked file',
  'Buka': 'Open',
  'Membaca isi dokumen...': 'Reading the document...',
  'Mengirim teks ke Gemini...': 'Sending text to Gemini...',
  'Berkas ini berupa foto, jadi teksnya belum bisa dibaca. Analisis bekerja untuk PDF yang teksnya bisa disalin, seperti PDF dari Word atau surat elektronik.':
    'This file is a photo, so its text cannot be read yet. Analysis works for PDFs with selectable text, such as PDFs from Word or email.',
  'Tidak ada teks yang bisa dibaca di berkas ini. Kemungkinan isinya hasil scan atau gambar.':
    'No readable text in this file. It is probably a scan or an image.',
  'Berkas ini tidak bisa dianalisis. Coba berkas lain.': 'This file cannot be analyzed. Try another file.',
  'Terjemahan butuh kunci API Gemini. Isi kuncinya di atas, atau pilih mode ringkasan untuk analisis di HP.':
    'Translation needs a Gemini API key. Enter it above, or choose summary mode to analyze on your phone.',

  /* Panduan pasang & update */
  'Buka aplikasi langsung dari layar utama HP seperti aplikasi biasa, tetap berjalan tanpa sinyal.':
    'Open the app from your home screen like any other app. It works without signal.',
  'iPhone dan iPad (Safari)': 'iPhone and iPad (Safari)',
  'Ketuk ikon Bagikan di bagian bawah Safari, pilih Tambah ke Layar Utama, lalu ketuk Tambah.':
    'Tap the Share icon at the bottom of Safari, choose Add to Home Screen, then tap Add.',
  'Ketuk menu titik tiga di pojok kanan atas Chrome, lalu pilih Tambahkan ke layar utama atau Instal aplikasi.':
    'Tap the three-dot menu at the top right of Chrome, then choose Add to Home screen or Install app.',
  'Mengerti': 'Got it',
  'baru': 'new',
  'tersedia': 'available',
  'Pembaruan siap dipasang. Seluruh dokumen di HP ini tetap aman.': 'An update is ready to install. All documents on this phone stay safe.',
  'Perbarui sekarang': 'Update now',
  'Unduh installer APK': 'Download APK installer',
  'Nanti saja': 'Later',
  'Versi terbaru siap dipasang. Dokumen di HP ini tetap aman.': 'The latest version is ready to install. Documents on this phone stay safe.',
  'Pembaruan sudah diunduh dan siap dipasang.': 'The update is downloaded and ready to install.',
  'Perbaikan dan peningkatan.': 'Fixes and improvements.',

  /* Akun */
  'Daftar akun': 'Create account',
  'Buat akun untuk menyimpan nama dan email profilmu. Dokumen tetap di HP ini.': 'Create an account to keep your profile name and email. Documents stay on this phone.',
  'Masuk untuk menampilkan profilmu di aplikasi. Dokumen tidak dikirim ke server.': 'Sign in to show your profile in the app. Documents are not sent to the server.',
  'Nama': 'Name',
  'Email': 'Email',
  'Kata sandi': 'Password',
  'Ulangi kata sandi': 'Repeat password',
  'Belum punya akun? Daftar': 'No account yet? Sign up',
  'Sudah punya akun? Masuk': 'Already have an account? Sign in',
  'Lupa kata sandi?': 'Forgot password?',
  'Hapus akun?': 'Delete account?',
  'Nama dan email akan dihapus dari server ATTA NATION. Dokumen di HP ini tetap ada.': 'Your name and email will be removed from the ATTA NATION server. Documents on this phone stay.',
  'Nama minimal 2 huruf.': 'Name needs at least 2 letters.',
  'Format email tidak valid.': 'That email address is not valid.',
  'Kata sandi minimal 8 karakter.': 'Password needs at least 8 characters.',
  'Kedua kata sandi tidak sama.': 'The passwords do not match.',
  'Email ini sudah terdaftar. Silakan masuk.': 'This email is already registered. Please sign in.',
  'Email atau kata sandi salah.': 'Wrong email or password.',
  'Terlalu banyak percobaan. Coba lagi 15 menit lagi.': 'Too many attempts. Try again in 15 minutes.',
  'Sesi berakhir. Silakan masuk lagi.': 'Your session ended. Please sign in again.',
  'Tidak bisa terhubung ke server akun. Periksa internet.': 'Cannot reach the account server. Check your internet.',
  'Server akun sedang bermasalah. Coba lagi nanti.': 'The account server has a problem. Try again later.',
  'Server akun belum dipasang di aplikasi ini.': 'The account server is not set up in this app yet.',
  'Akun dibuat. Kamu sudah masuk.': 'Account created. You are signed in.',
  'Nama diperbarui.': 'Name updated.',
  'Kamu sudah keluar dari akun.': 'You are signed out.',
  'Akun dihapus.': 'Account deleted.',
  'Kata sandi salah.': 'Wrong password.',

  /* Toast & pesan */
  'Mode dokumen.': 'Document mode.',
  'PIN harus 4 sampai 8 angka.': 'The PIN must be 4 to 8 digits.',
  'Kedua PIN tidak sama.': 'The PINs do not match.',
  'Berkas dikunci.': 'File locked.',
  'Berkas gagal dikunci.': 'The file could not be locked.',
  'Masukkan PIN.': 'Enter the PIN.',
  'Kunci dibuka.': 'Lock removed.',
  'PIN salah. Coba lagi.': 'Wrong PIN. Try again.',
  'PIN salah.': 'Wrong PIN.',
  'Berkas tidak bisa dibuka.': 'The file cannot be opened.',
  'Tanda tangan hanya bisa ditempel ke PDF.': 'Signatures can only be placed on PDFs.',
  'Buka kunci PIN berkas ini dulu sebelum ditandatangani.': 'Remove this file’s PIN lock before signing it.',
  'Goreskan tanda tangan, lalu ketuk Tempel ke PDF.': 'Draw your signature, then tap Place on PDF.',
  'Nama berkas tidak boleh kosong.': 'The file name cannot be empty.',
  'Nama berkas diperbarui.': 'File renamed.',
  'Berkas tidak ditemukan di penyimpanan lokal.': 'File not found on this phone.',
  'Membuka menu bagikan.': 'Opening the share menu.',
  'Berkas belum bisa disimpan. Coba ulangi.': 'The file could not be saved. Try again.',
  'Berkas tidak ditemukan.': 'File not found.',
  'Berkas dihapus.': 'File deleted.',
  'Lampu kilat tidak didukung kamera atau browser ini.': 'Flash is not supported by this camera or browser.',
  'Lampu kilat tidak bisa dinyalakan.': 'The flash could not be turned on.',
  'Kamera langsung tidak tersedia di browser ini. Pakai kamera HP atau pilih dari galeri.': 'Live camera is not available in this browser. Use the phone camera or choose from the gallery.',
  'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai kamera HP.': 'Camera permission was denied. Allow it in browser settings, or use the phone camera.',
  'Kamera tidak bisa dibuka. Pakai kamera HP atau pilih dari galeri.': 'The camera could not open. Use the phone camera or choose from the gallery.',
  'Foto tidak bisa diproses. Coba ambil ulang.': 'The photo could not be processed. Try taking it again.',
  'Tunggu, halaman terakhir masih diproses.': 'Wait, the last page is still processing.',
  'Dokumen gagal disimpan. Halaman masih ada, coba ketuk Selesai lagi.': 'The document could not be saved. Your pages are kept, tap Done again.',
  'Pilih 2 foto: sisi depan lalu sisi belakang.': 'Choose 2 photos: front, then back.',
  'KTP depan dan belakang disusun ke 1 lembar A4.': 'ID card front and back placed on one A4 page.',
  'PDF ditambahkan ke Dokumen.': 'PDF added to Documents.',
  'Berkas gagal diproses. Coba pilih ulang berkasnya.': 'The file could not be processed. Try choosing it again.',
  'Dokumen diluruskan dan disimpan.': 'Document straightened and saved.',
  'Gagal meluruskan perspektif gambar.': 'Could not straighten the image.',
  'PDF tidak bisa digabung. Mungkin ada berkas yang rusak atau terkunci sandi.': 'The PDFs could not be merged. A file may be damaged or password-protected.',
  'Pilih minimal 2 berkas untuk digabung.': 'Choose at least 2 files to merge.',
  'Target maks 1 MB': 'Target up to 1 MB',
  'Berkas belum bisa dikecilkan. PDF mungkin rusak atau dikunci sandi.': 'The file could not be reduced. The PDF may be damaged or password-protected.',
  'Tulis teks watermark terlebih dahulu.': 'Enter the watermark text first.',
  'Watermark ditambahkan ke PDF.': 'Watermark added to the PDF.',
  'Gagal memberi watermark pada PDF.': 'Could not watermark the PDF.',
  'Urutan dan rotasi halaman PDF disimpan.': 'Page order and rotation saved.',
  'Nomor halaman ditambahkan ke PDF.': 'Page numbers added to the PDF.',
  'Margin halaman PDF berhasil dirapikan.': 'PDF margins trimmed.',
  'Gagal memproses halaman PDF.': 'Could not process the PDF pages.',
  'PDF ini tidak bisa dibuka. Coba berkas lain.': 'This PDF cannot be opened. Try another file.',
  'Versi tersamarkan disimpan.': 'Redacted copy saved.',
  'Gagal menyamarkan PDF. Coba lagi.': 'Could not redact the PDF. Try again.',
  'Pilih 2 foto kartu (sisi depan dan belakang).': 'Choose 2 card photos (front and back).',
  'Kartu depan dan belakang disusun ke 1 lembar A4.': 'Card front and back placed on one A4 page.',
  'Gagal menyusun foto kartu identitas.': 'Could not arrange the ID card photos.',
  'Gagal mengonversi dokumen ke PDF.': 'Could not convert the document to PDF.',
  'PDF ini tidak punya teks yang bisa diambil. Kemungkinan isinya hasil scan.': 'This PDF has no text to extract. It is probably a scan.',
  'Isi PDF gagal diambil. Coba berkas lain.': 'Could not read the PDF. Try another file.',
  'Berkas PDF rusak berat dan tidak dapat dipulihkan.': 'The PDF is too damaged to repair.',
  'Minimal harus ada 2 dokumen PDF di HP untuk dibandingkan.': 'You need at least 2 PDFs on this phone to compare.',
  'Perbandingan dua dokumen selesai.': 'Comparison finished.',
  'Pilih 2 berkas PDF sekaligus untuk dibandingkan.': 'Choose 2 PDFs at once to compare.',
  'Gagal membandingkan kedua berkas PDF.': 'Could not compare the PDFs.',
  'Dokumen tidak bisa dianalisis.': 'The document cannot be analyzed.',
  'Hasil analisis disalin ke papan klip.': 'Result copied to the clipboard.',
  'Teks siap disalin.': 'Text ready to copy.',
  'Goreskan tanda tangan terlebih dahulu.': 'Draw your signature first.',
  'Tanda tangan disimpan.': 'Signature saved.',
  'Goreskan tanda tangan di kotak atas terlebih dahulu.': 'Draw your signature in the box first.',
  'Tanda tangan ditempel ke PDF.': 'Signature placed on the PDF.',
  'Gagal menempelkan tanda tangan ke PDF.': 'Could not place the signature on the PDF.',
  'Tidak ada internet. Cek update lagi nanti.': 'No internet. Check for updates later.',
  'Alamat cek update server belum diatur di config.js.': 'Server update URL is not configured in config.js yet.',
  'Memuat pratinjau PDF...': 'Loading PDF preview...',
  'Gagal membaca data berkas.': 'Could not read file data.',
  'Penyimpanan ke perangkat dibatalkan atau gagal.': 'Saving to device was cancelled or failed.',
  'Gagal menulis potongan berkas ke perangkat.': 'Could not write file data to device.',
  'Aplikasi dipasang ke layar utama.': 'App added to the home screen.',
  'Pengaturan pindai disimpan.': 'Scan settings saved.',
  'Verifikasi tidak berhasil. Masukkan PIN.': 'Verification failed. Enter your PIN.',
  'Sidik jari atau wajah dibatalkan. Masukkan PIN.': 'Fingerprint or face was cancelled. Enter your PIN.',
  'Kunci aplikasi aktif.': 'App lock is on.',
  'Kunci aplikasi dimatikan.': 'App lock is off.',
  'Sidik jari atau wajah aktif.': 'Fingerprint or face unlock is on.',
  'Buka dengan sidik jari atau wajah dimatikan.': 'Fingerprint or face unlock is off.',
  'Sidik jari atau wajah belum diaktifkan. Coba lagi.': 'Fingerprint or face unlock was not turned on. Try again.',
  'Pengaturan kunci disimpan.': 'Lock settings saved.',
  'Kunci API Gemini dihapus.': 'Gemini API key removed.',
  'Belum ada berkas di aplikasi': 'No files in the app yet',
  'Belum ada PDF atau foto di Dokumen.': 'No PDFs or photos in Documents yet.',
  'Belum ada dokumen': 'No documents yet',
  'Pindai KTP, surat, atau kwitansi pertamamu. Semua tersimpan di HP ini.': 'Scan your first ID card, letter, or receipt. Everything stays on this phone.',
  'Baru dipindai': 'Just scanned',
  'Mengecilkan...': 'Reducing...',

  /* Tanggal & keterangan berkas */
  'baru saja': 'just now',
  'Hari ini': 'Today',
  'Minggu ini': 'This week',
  'Bulan lalu': 'Last month',
  'Januari': 'January', 'Februari': 'February', 'Maret': 'March', 'April': 'April', 'Mei': 'May', 'Juni': 'June',
  'Juli': 'July', 'Agustus': 'August', 'September': 'September', 'Oktober': 'October', 'November': 'November', 'Desember': 'December',
  'Scan warna tajam': 'Sharp color scan',
  'Dikunci PIN': 'PIN locked',
  'Hasil konversi': 'Converted',
  'Disamarkan': 'Redacted',
  'Gabung PDF': 'Merged PDF',
  'Lokal': 'Local',
  'Ditandatangani': 'Signed',
  'Diperbaiki': 'Repaired',
  'Lurus': 'Straightened',
  'Bernomor': 'Numbered',
  'Potong Margin': 'Trimmed',
  'Tanpa Hal': 'Without p.',
  'maks': 'max',
  'Kartu Identitas Depan Belakang A4': 'ID card front and back A4',
  'SURAT': 'LETTER',
  'SALINAN': 'COPY',
  'RINGKASAN': 'SUMMARY',
  'HAL 1': 'P. 1',
  'HAL 2': 'P. 2',
  'Permanen': 'Persistent',
  'kemarin': 'yesterday',
  'Urungkan': 'Undo',
  'Berkas dikembalikan.': 'File restored.',
  'Tidak ada berkas yang cocok': 'No matching files',
  'Coba kata kunci lain atau pilih kategori Semua.': 'Try another keyword or choose the All category.',
  'Kanvas penyesuaian 4 sudut dokumen': '4-corner document adjustment canvas',
  'Gambar halaman (.jpg)': 'Page images (.jpg)',
  'Saya setuju mengirim teks dokumen ini ke Google Gemini saat kunci API diisi': 'I agree to send this document text to Google Gemini when an API key is provided',
  'Saya setuju mengirim teks dokumen ini ke layanan eksternal Google Gemini untuk dianalisis.': 'I agree to send this document text to the external Google Gemini service for analysis.',
  'Pratinjau dokumen. Geser titik biru ke 4 sudut kertas.': 'Document preview. Drag the blue dots to the 4 corners of the paper.',
  'Kanvas penyesuaian 4 sudut dokumen': '4-corner document adjustment canvas',
  'Gagal membaca berkas gambar.': 'Could not read the image file.',
  'Format gambar tidak didukung.': 'Image format is not supported.',
  'Gagal mengompresi gambar.': 'Could not compress the image.',
  'Berkas ini sudah dikunci.': 'This file is already locked.',
  'Data berkas tidak ditemukan.': 'File data not found.',
  'Dokumen tidak memiliki teks atau tabel yang dapat dikonversi.': 'Document has no text or tables that can be converted.',
  'Tidak ada halaman yang bisa digabung': 'No pages can be merged',
  'Simpan hasil ke Dokumen': 'Save result to Documents',
  'Hasil analisis disimpan ke Dokumen.': 'Analysis result saved to Documents.',
  'Diproses melalui Google Gemini API atas persetujuan Anda.': 'Processed via Google Gemini API with your consent.',
  'Diproses 100% lokal di perangkat ini — isi dokumen tidak dikirim keluar.': 'Processed 100% locally on this device — document text was not sent externally.',
  'Bawah tengah (Footer)': 'Bottom center (Footer)',
  'Atas tengah (Header)': 'Top center (Header)',
  'Gambar diputar 90 derajat.': 'Image rotated 90 degrees.',
  'Jadikan PDF (1 foto)': 'Convert to PDF (1 photo)',
  'Pilih minimal 2 berkas PDF untuk digabung.': 'Choose at least 2 PDF files to merge.',
  'Pilih minimal 2 berkas PDF, atau 1 foto untuk dijadikan PDF.': 'Choose at least 2 PDFs, or 1 photo to convert to PDF.',
  'Foto disimpan sebagai PDF.': 'Photo saved as PDF.',
  'Foto ke PDF': 'Photo to PDF',
  'Susun Ulang': 'Reordered',
  'Putar': 'Rotated',
  'Mengubah halaman PDF menjadi gambar...': 'Converting PDF pages to images...',
  'Halaman PDF tidak bisa diubah menjadi gambar.': 'Could not convert PDF pages to images.',
  'PDF ke Gambar': 'PDF to Image',
  '1 halaman JPG': '1 JPG page',
  'Terjemahan': 'Translation',
  'Ringkasan': 'Summary',
  'Hasil analisis dokumen': 'Document analysis result',
  'Semua fitur di aplikasi ini sudah terbuka tanpa batas.': 'All features in this app are already unlocked without limits.',
  'Pembaca PDF belum siap.': 'PDF reader is not ready yet.',
  'Masukkan minimal 1 nomor halaman yang valid.': 'Enter at least 1 valid page number.',
  'Sebutkan nomor halaman yang ingin dihapus.': 'Specify the page numbers to remove.',
  'Nomor halaman yang dimasukkan melebihi jumlah halaman PDF.': 'The entered page numbers exceed the PDF page count.',
  'Sisakan minimal 1 halaman di dalam dokumen PDF.': 'Keep at least 1 page in the PDF document.',
  'Isi dokumen Word (.docx) tidak ditemukan.': 'Word document (.docx) content not found.',
  'Lembar kerja Excel (.xlsx) tidak ditemukan.': 'Excel worksheet (.xlsx) not found.',
  'Format dokumen belum didukung. Pilih berkas .docx, .xlsx, .csv, atau .txt.': 'Document format not supported yet. Choose a .docx, .xlsx, .csv, or .txt file.',
  'File ZIP bukan arsip backup resmi ATTA DocStudio Pro.': 'This ZIP file is not an official ATTA DocStudio Pro backup archive.',
  'Format JSON backup tidak valid.': 'Invalid JSON backup format.',
  'Pilih file arsip .zip atau .json hasil backup ATTA DocStudio Pro.': 'Choose an ATTA DocStudio Pro .zip or .json backup file.',
  'Catatan: Kedua PDF berisi gambar hasil pindaian tanpa lapisan teks yang bisa dibandingkan baris demi baris.': 'Note: Both PDFs contain scanned images without a text layer that can be compared line by line.',
  'Catatan: Salah satu PDF berisi gambar pindaian tanpa lapisan teks.': 'Note: One of the PDFs contains scanned images without a text layer.',

  /* Pembaruan v1.0.0: Kamera 2 Tahap, 7 Filter, Multi-Format, Kunci Multi-Opsi, Editor TTD & Riwayat Alat */
  'DocStudio': 'DocStudio',
  'Lupa kunci': 'Forgot lock',
  'Scan': 'Scan',
  'Hasil fitur alat': 'Tool results',
  'Lihat semua': 'View all',
  'Kamera langsung tidak tersedia di perangkat ini.': 'Live camera is not available on this device.',
  'Kamera langsung tidak tersedia di perangkat ini. Ketuk Buka kamera HP.': 'Live camera is not available on this device. Tap Open phone camera.',
  'Pratinjau kamera belum siap. Ketuk Buka kamera HP untuk memotret.': 'Camera preview is not ready. Tap Open phone camera to take a photo.',
  'Riwayat alat': 'Tool history',
  'Susun 2 foto kartu identitas proporsional di halaman A4.': 'Arrange 2 ID card photos neatly on one A4 page.',
  'Susun 2 foto kartu': 'Arrange 2 ID photos',
  'Bangun ulang berkas PDF yang korup atau sulit dibuka.': 'Rebuild corrupted or hard-to-open PDF files.',
  'Pilih berkas PDF': 'Choose PDF file',
  'Bagikan file cadangan ZIP': 'Share ZIP backup file',
  'email': 'email',
  'Email': 'Email',
  'attalaaliframadhanitrihida@gmail.com': 'attalaaliframadhanitrihida@gmail.com',
  'Warna Ajaib': 'Magic Color',
  'Tanpa Bayang': 'No Shadow',
  'Tingkatkan': 'Enhance',
  'Pencerah': 'Lighten',
  'Hitam Putih': 'Black & White',
  'Abu-Abu': 'Grayscale',
  'Kunci aplikasi': 'App lock',
  'PIN, Pola 3x3, atau Kata Sandi setiap kali aplikasi dibuka': 'PIN, 3x3 Pattern, or Password whenever the app opens',
  'Metode kunci aktif': 'Active lock method',
  'PIN Angka': 'Numeric PIN',
  'Ganti kunci': 'Change lock',
  'Atur kunci utama terlebih dahulu': 'Set a primary lock first',
  'Kunci utama tetap bisa dipakai sebagai cadangan': 'Primary lock remains available as fallback',
  '30 detik': '30 seconds',
  '15 menit': '15 minutes',
  'Lihat riwayat hasil (': 'View tool history (',
  'Buat kunci aplikasi': 'Create app lock',
  'Ganti kunci aplikasi': 'Change app lock',
  'Kunci diminta setiap kali aplikasi dibuka. Kalau lupa, satu-satunya cara masuk adalah menghapus semua data.': 'Lock is required whenever you open the app. If forgotten, the only way in is wiping all data.',
  'Pilih jenis kunci': 'Choose lock type',
  'Pola 3x3': '3x3 Pattern',
  'Hubungkan minimal 4 titik untuk membuat pola.': 'Connect at least 4 dots to create a pattern.',
  'Gambar ulang pola yang sama untuk konfirmasi.': 'Draw the same pattern again to confirm.',
  'Kata sandi (minimal 4 karakter)': 'Password (at least 4 characters)',
  'Simpan kunci': 'Save lock',
  'Masukkan kunci aplikasi saat ini untuk mematikan penguncian.': 'Enter your current app lock to turn locking off.',
  'Lupa kunci aplikasi': 'Forgot app lock',
  'Kunci aplikasi tidak bisa dipulihkan. Untuk masuk lagi, semua data di aplikasi ini harus dihapus. Dokumen yang pernah dicadangkan ke ZIP bisa dipulihkan setelahnya.': 'The app lock cannot be recovered. To get back in, all app data must be wiped. Documents backed up to ZIP can be restored afterwards.',
  ', Mozilla Foundation. Apache License 2.0.': ', Mozilla Foundation. Apache License 2.0.',
  ', Andrew Dillon. MIT License.': ', Andrew Dillon. MIT License.',
  ', David Fahlander. Apache License 2.0.': ', David Fahlander. Apache License 2.0.',
  'Schibsted Grotesk': 'Schibsted Grotesk',
  ', Schibsted. SIL Open Font License 1.1.': ', Schibsted. SIL Open Font License 1.1.',
  'Liberation Sans': 'Liberation Sans',
  'Tandai hitam': 'Blackout',
  'Geser halaman': 'Pan page',
  'Pilih tanda tangan yang ingin dipakai, lalu pilih dokumen PDF tujuannya.': 'Choose the signature you want to use, then pick the target PDF document.',
  'Pilih tanda tangan (kanvas atau tersimpan):': 'Choose signature (canvas or saved):',
  'Pilih PDF dari Dokumen di HP ini:': 'Choose PDF from Documents on this phone:',
  'Geser tanda tangan langsung ke posisi yang diinginkan di halaman, atau tarik titik sudut untuk atur ukuran.': 'Drag the signature directly onto the page, or drag the corner dot to resize.',
  'Ukuran tanda tangan': 'Signature size',
  'Tempel di posisi yang sama pada semua halaman PDF': 'Place in the same position on all PDF pages',
  'Tempel dan simpan PDF': 'Place & save PDF',
  'Ganti berkas PDF': 'Change PDF file',
  'Markdown (.md)': 'Markdown (.md)',
  'Simpan laporan perbandingan ke Dokumen': 'Save comparison report to Documents',
  'Membaca teks dari PDF, Office, maupun foto hasil pindai (OCR offline di APK Android).': 'Extract text from PDF, Office, or scanned photos (offline OCR in Android APK).',
  'Pilih berkas PDF, foto, atau teks untuk dianalisis': 'Choose PDF, photo, or text file to analyze',
  'Android (Chrome)': 'Android (Chrome)',
  'Atur hasil pindai': 'Arrange scanned pages',
  'Tambah foto': 'Add photo',
  'Potong 4 sudut': 'Crop 4 corners',
  'Geser kiri': 'Move left',
  'Geser kanan': 'Move right',
  'Filter dokumen (7 pilihan)': 'Document filter (7 options)',
  'Terapkan filter ini ke semua halaman': 'Apply this filter to all pages',
  'Jadikan hasil foto sebagai': 'Save photos as',
  'Dokumen PDF': 'PDF Document',
  'Gambar JPG': 'JPG Image',
  'Gambar PNG (lossless)': 'PNG Image (lossless)',
  'Dokumen Word (.docx bergambar)': 'Word Document (.docx with images)',
  'Dokumen Word (.docx teks OCR)': 'Word Document (.docx OCR text)',
  'Teks Biasa (.txt OCR)': 'Plain Text (.txt OCR)',
  'Markdown (.md OCR)': 'Markdown (.md OCR)',
  'KTP Depan-Belakang 1 Lembar A4': 'ID Card Front-Back on 1 A4 Sheet',
  'Ukuran kertas PDF': 'PDF paper size',
  'Sesuai ukuran foto': 'Fit photo size',
  'Letter': 'Letter',
  'PDF bisa dicari dan disalin teksnya (OCR)': 'Searchable & copyable PDF text (OCR)',
  'Ukuran dan kualitas gambar': 'Image size and quality',
  'Ukuran & kualitas gambar': 'Image size and quality',
  'Simpan hasil': 'Save result',
  'Kembali ke kamera': 'Back to camera',
  'Tersimpan di: Alat PDF': 'Saved in: PDF Tools',
  'Tersimpan di:': 'Saved in:',
  'Hasil selesai diproses': 'Processing complete',
  'Tersimpan di perangkat': 'Saved on device',
  'Lihat penuh': 'Full view',
  'Simpan ke HP': 'Save to phone',
  'Edit lanjutan pada berkas ini:': 'Further edits for this file:',
  'Lihat semua hasil fitur ini': 'View all results from this tool',
  'Penyimpanan per fitur alat': 'Storage per tool feature',
  'Pilih fitur alat untuk melihat semua berkas hasil prosesnya secara terpisah.': 'Choose a tool feature to view all files created by it separately.',
  'Berkas tersimpan khusus dari fitur ini.': 'Files stored specifically from this feature.',
  'Buka di layar Dokumen': 'Open in Documents',
  'Proses berkas ini': 'Process this file',
  'Pola kunci 3x3': '3x3 unlock pattern',
  'Masukkan kata sandi': 'Enter password',
  'Jenis kunci aplikasi': 'App lock method',
  'Kanvas buat pola 3x3': 'Create 3x3 pattern canvas',
  'Mode sentuh halaman': 'Page touch mode',
  'Halaman PDF untuk menempatkan tanda tangan': 'PDF page for placing signature',
  'Pratinjau halaman pindai': 'Scanned page preview',
  'Nama berkas hasil pindai': 'Scanned file name',
  'Kunci pola aplikasi aktif.': 'App pattern lock is on.',
  'Kunci PIN aplikasi aktif.': 'App PIN lock is on.',
  'Kunci kata sandi aplikasi aktif.': 'App password lock is on.',
  'Goreskan tanda tangan di kotak, lalu ketuk Tempel ke PDF.': 'Draw your signature in the box, then tap Place on PDF.',
  'Halaman dihapus. Silakan potret lagi.': 'Page deleted. Please take another photo.',
  'Format KTP 1 lembar A4 membutuhkan minimal 2 foto (depan & belakang).': '1-sheet A4 ID card format requires at least 2 photos (front & back).',
  'Dokumen gagal disimpan. Coba ulangi.': 'Document could not be saved. Try again.',
  'Halaman diluruskan.': 'Page straightened.',
  'Laporan perbandingan disimpan.': 'Comparison report saved.',
  'Goreskan tanda tangan di kotak atau pilih tanda tangan tersimpan terlebih dahulu.': 'Draw a signature in the box or choose a saved signature first.',
  'Pilih atau goreskan tanda tangan terlebih dahulu.': 'Choose or draw a signature first.',
  'Pratinjau halaman PDF gagal dimuat.': 'PDF page preview failed to load.',
  'Gambar tidak bisa dibuka untuk koreksi sudut.': 'Image could not be opened for corner correction.',
  'Menjalankan OCR offline...': 'Running offline OCR...',
  'Kanvas sekarang': 'Current canvas',
  'Lihat': 'View',
  'Simpan': 'Save',
  'Ubah nama': 'Rename',
  'Buka': 'Open',
  'berkas tersimpan': 'files saved',
  'Belum ada berkas': 'No files yet',
  'Belum ada hasil tersimpan untuk fitur ini.': 'No saved results for this tool yet.',
  'Berkas yang dihasilkan melalui fitur:': 'Files generated by feature:',
  'Susun / putar': 'Reorder / rotate',
  'Konversi format': 'Convert format',
  'Jadikan PDF': 'Convert to PDF',
  'Baca teks OCR / Analisis': 'Read OCR text / Analyze',
  'Analisis / OCR': 'Analyze / OCR',
  'Tidak ada teks yang terbaca dari foto ini. Pastikan tulisan jelas atau jalankan di APK Android untuk OCR offline.': 'No text detected from this photo. Ensure clear text or run in the Android APK for offline OCR.',
  'Pindai Kamera': 'Camera Scan',
  'Kecilkan Ukuran': 'Reduce Size',
  'Watermark PDF': 'PDF Watermark',
  'Pisahkan PDF': 'Split PDF',
  'Susun & Putar PDF': 'Reorder & Rotate PDF',
  'Hapus Halaman PDF': 'Delete PDF Pages',
  'Nomor Halaman PDF': 'PDF Page Numbers',
  'Potong Margin PDF': 'Trim PDF Margins',
  'Luruskan 4 Sudut': 'Straighten 4 Corners',
  'KTP Depan-Belakang A4': 'ID Card Front-Back A4',
  'Office / Teks ke PDF': 'Office / Text to PDF',
  'Konversi PDF': 'Convert PDF',
  'Samarkan Info PDF': 'Redact PDF',
  'Perbaiki Struktur PDF': 'Repair PDF',
  'Bandingkan 2 PDF': 'Compare 2 PDFs',
  'Analisis & Ringkasan': 'Analyze & Summarize',
  'Impor Berkas': 'Imported Files',
  'Auto sudut': 'Auto corners',
  'Sudut dokumen dideteksi ulang.': 'Document corners re-detected.',
  'Gagal memutar halaman.': 'Failed to rotate page.',
  'Pakai Face Key atau sidik jari': 'Use Face Key or fingerprint',
  'Pakai kunci kedua': 'Use backup key',
  'Kembali ke kunci utama': 'Back to primary key',
  'Metode kunci utama': 'Primary lock method',
  'Kunci kedua: Face Key / Sidik Jari': 'Second lock: Face Key / Fingerprint',
  'Pakai pemindai wajah atau sidik jari HP sebagai kunci tambahan': 'Use phone face or fingerprint scanner as an extra lock',
  'Perangkat atau browser ini tidak mendukung Face Key / Sidik Jari': 'This device or browser does not support Face Key / Fingerprint',
  'Kunci kedua: PIN / Pola / Sandi': 'Second lock: Backup PIN / Pattern / Password',
  'Belum diatur': 'Not set',
  'Tambah': 'Add',
  'Ubah': 'Edit',
  'Aktif': 'Active',
  'Pemulihan saat lupa kunci': 'Recovery when lock is forgotten',
  'Belum diatur — disarankan isi agar data tetap aman': 'Not set — recommended so your files stay safe',
  'Sudah diatur — aman jika lupa kunci': 'Set up — protected if lock is forgotten',
  'Atur': 'Set up',
  'Atur pertanyaan keamanan dan simpan kode darurat ini. Keduanya memulihkan kunci aplikasi tanpa menghapus satu pun dokumen.': 'Set a security question and save this emergency code. Either can recover the app lock without wiping any documents.',
  'Pertanyaan keamanan': 'Security question',
  'Apa nama sekolah dasar pertamamu?': 'What was the name of your first elementary school?',
  'Apa nama hewan peliharaan pertamamu?': 'What was your first pet name?',
  'Di kota mana kamu lahir?': 'Which city were you born in?',
  'Apa nama panggilan masa kecilmu?': 'What was your childhood nickname?',
  'Jawaban (minimal 2 huruf)': 'Answer (at least 2 letters)',
  'Kode pemulihan darurat': 'Emergency recovery code',
  'Salin': 'Copy',
  'Catat atau salin kode di atas ke tempat aman agar selalu bisa membuka aplikasi bila lupa kunci.': 'Save or copy the code above to a safe place so you can always unlock the app if needed.',
  'Simpan pemulihan': 'Save recovery',
  'Pulihkan kunci aplikasi': 'Recover app lock',
  'Pilih salah satu cara di bawah untuk membuat kunci baru tanpa menghapus dokumen di HP ini.': 'Choose any method below to create a new lock without deleting documents on this phone.',
  '1. Face Key, sidik jari, atau kunci layar HP': '1. Face Key, fingerprint, or device screen lock',
  'Verifikasi kepemilikan perangkat lewat kunci layar / biometrik HP.': 'Verify device ownership using screen lock or biometrics.',
  'Verifikasi lewat perangkat': 'Verify via device',
  '2. Jawab pertanyaan keamanan': '2. Answer security question',
  'Pertanyaan': 'Question',
  'Verifikasi jawaban': 'Verify answer',
  '3. Masukkan kode pemulihan darurat': '3. Enter emergency recovery code',
  'Pakai kode pemulihan': 'Use recovery code',
  '4. Verifikasi akun ATTA': '4. Verify ATTA account',
  'Verifikasi akun ATTA': 'Verify ATTA account',
  'Opsi terakhir: hapus semua data': 'Last resort: erase all data',
  'Tulis jawabanmu': 'Type your answer',
  'Masukkan jawaban': 'Enter answer',
  'Contoh: ATTA-XXXX-XXXX': 'Example: ATTA-XXXX-XXXX',
  'Masukkan kata sandi akun ATTA': 'Enter ATTA account password',
  'Kunci baru disimpan. Aplikasi terbuka kembali.': 'New lock saved. App unlocked.',
  'Kunci kedua (PIN) aktif.': 'Second lock (PIN) is on.',
  'Kunci kedua (Pola) aktif.': 'Second lock (Pattern) is on.',
  'Kunci kedua (Kata sandi) aktif.': 'Second lock (Password) is on.',
  'Kunci cadangan kedua dihapus.': 'Second backup lock removed.',
  'Perangkat atau browser ini belum mendukung Face Key / Sidik Jari.': 'This device or browser does not support Face Key / Fingerprint yet.',
  'Face Key / Sidik Jari aktif sebagai kunci tambahan.': 'Face Key / Fingerprint is active as second lock.',
  'Kunci Face Key / Sidik Jari dimatikan.': 'Face Key / Fingerprint lock turned off.',
  'Face Key / Sidik Jari belum diaktifkan. Coba lagi.': 'Face Key / Fingerprint was not enabled. Try again.',
  'Kode pemulihan disalin.': 'Recovery code copied.',
  'Pertanyaan keamanan & kode pemulihan disimpan.': 'Security question & recovery code saved.',
  'Buat kunci aplikasi baru': 'Create new app lock',
  'Pemulihan berhasil. Pilih PIN, Pola 3x3, atau Kata Sandi baru untuk membuka aplikasi ini.': 'Recovery succeeded. Set a new PIN, 3x3 Pattern, or Password for this app.',
  'Ubah kunci kedua': 'Change second lock',
  'Tambah kunci cadangan kedua': 'Add second backup lock',
  'Kunci kedua dipakai sebagai alternatif cepat apabila kunci utama lupa atau tidak nyaman dipakai.': 'The second lock serves as a fast alternative if the primary lock is forgotten.',
  'Pilih PIN, Pola 3x3, atau Kata Sandi. Setelah disimpan, kamu bisa menambahkan Face Key, sidik jari, dan pemulihan.': 'Choose PIN, 3x3 Pattern, or Password. After saving, you can add Face Key, fingerprint, and recovery.',
  'Masukkan kunci aplikasi utama saat ini untuk mematikan penguncian.': 'Enter your current primary lock to turn locking off.',
  'Jawaban pertanyaan keamanan minimal 2 huruf.': 'Security question answer must be at least 2 characters.',
  'Semua dokumen, tanda tangan, dan pengaturan di HP ini akan dihapus agar aplikasi terbuka kembali.': 'All documents, signatures, and settings on this phone will be erased to unlock the app.',
  'Verifikasi perangkat dibatalkan.': 'Device verification was cancelled.',
  'Masukkan jawaban terlebih dahulu.': 'Enter an answer first.',
  'Jawaban tidak cocok. Coba lagi.': 'Answer does not match. Try again.',
  'Masukkan kode pemulihan terlebih dahulu.': 'Enter recovery code first.',
  'Kode pemulihan salah atau tidak cocok.': 'Recovery code is wrong or does not match.',
  'Belum ada akun ATTA yang masuk.': 'No signed-in ATTA account.',
  'Masukkan kata sandi akun ATTA.': 'Enter ATTA account password.',
  '2.6 px': '2.6 px',
  'Gagal memproses gambar.': 'Failed to process image.',
  'Format gambar tidak didukung.': 'Unsupported image format.',
  'Pindai Cerdas Otomatis': 'Smart Auto Scan',
  'FOTO': 'PHOTO',
  'Foto ke PDF': 'Photo to PDF',
  'Ubah foto galeri atau kamera jadi PDF rapi': 'Turn gallery or camera photos into neat PDFs',
  'Foto ke Word': 'Photo to Word',
  'Jadikan foto dokumen Word (.docx)': 'Convert photos into a Word (.docx) document',
  'Putar dokumen 90°': 'Rotate document 90°',
  'Putar TTD 90°': 'Rotate signature 90°',
  'Ketuk untuk lihat pratinjau penuh': 'Tap to view full preview',
  'Ketuk untuk perbesar': 'Tap to zoom',
  'Lihat pratinjau penuh': 'Full preview',
  'Pratinjau penuh': 'Full preview',
  'Perkecil': 'Zoom out',
  'Perbesar': 'Zoom in',
  '100%': '100%',
  '1:1': '1:1',
  '-': '-',
  '+': '+',
  '^': '^',
  'v': 'v',
  'x': 'x',
  'Pratinjau resolusi penuh hasil pindai': 'Full-resolution scan preview',
  'Tingkat perbesaran': 'Zoom level',
  'Pilih satu atau beberapa foto dari galeri maupun dokumen tersimpan, atur urutannya, lalu konversi secara offline.': 'Select one or more photos from gallery or saved documents, reorder them, and convert offline.',
  'Mode konversi': 'Conversion mode',
  'Foto ke PDF (.pdf)': 'Photo to PDF (.pdf)',
  'Foto ke Word (.docx)': 'Photo to Word (.docx)',
  'Tambah foto dari galeri HP': 'Add photos from phone gallery',
  'Pilih foto dari galeri untuk dikonversi': 'Select photos from gallery to convert',
  'Atau tambah dari Dokumen tersimpan:': 'Or add from saved Documents:',
  'Daftar foto terpilih (': 'Selected photos (',
  'Ukuran dan orientasi kertas PDF': 'PDF page size and orientation',
  'Otomatis sesuai rasio foto (A4 Potret / Lanskap)': 'Auto fit photo ratio (A4 Portrait / Landscape)',
  'A4 Potret standar': 'Standard A4 Portrait',
  'Letter standar': 'Standard Letter',
  'Sesuai dimensi asli foto': 'Match original photo dimensions',
  'Tambahkan lapisan teks OCR agar PDF bisa disalin': 'Add searchable OCR text layer to PDF',
  'Format isi Word (.docx)': 'Word (.docx) content format',
  'Layout gambar bersih dalam dokumen Word': 'Clean image layout in Word document',
  'Teks hasil OCR yang bisa langsung diedit': 'Editable OCR text in Word document',
  'Nama berkas hasil': 'Output file name',
  'Nama berkas hasil konversi': 'Converted file name',
  'Proses dan simpan hasil': 'Process and save result',
  'Gagal membuka pemindai dokumen.': 'Failed to open document scanner.',
  'Gunakan kamera atau galeri untuk memindai dokumen.': 'Use camera or gallery to scan documents.',
  'Gagal memuat hasil pemindai dokumen.': 'Failed to load document scanner results.',
  'Menggunakan kamera pratinjau standar.': 'Using standard preview camera.',
  'Tanda tangan diputar 90 derajat.': 'Signature rotated 90 degrees.',
  'Gagal memutar tanda tangan.': 'Failed to rotate signature.',
  'Salah satu foto tidak bisa dibaca.': 'One of the photos could not be read.',
  'Belum ada foto tersimpan di Dokumen.': 'No photos saved in Documents yet.',
  'Foto ditambahkan ke antrean konversi.': 'Photo added to conversion queue.',
  'Foto tidak bisa dimuat.': 'Photo could not be loaded.',
  'Belum ada foto dipilih.': 'No photos selected yet.',
  'Geser naik': 'Move up',
  'Geser turun': 'Move down',
  'Hapus foto': 'Remove photo',
  'Pilih minimal satu foto terlebih dahulu.': 'Select at least one photo first.',
  'Teks OCR kosong; memakai layout gambar ke Word.': 'OCR text is empty; using image layout in Word.',
  'Foto berhasil diubah ke Word (.docx).': 'Photos converted to Word (.docx).',
  'Foto berhasil diubah menjadi PDF.': 'Photos converted to PDF.',
  'Gagal mengonversi foto.': 'Failed to convert photos.',
  'Foto ke Word (OCR)': 'Photo to Word (OCR)',

  /* SmartScanner Mode, Crop 8-Handle, Fit/Zoom & Pemilih Warna */
  'Mode pindai dokumen': 'Document scan mode',
  '1 Halaman': '1 Page',
  'Banyak Halaman': 'Batch Pages',
  'KTP A4': 'ID Card A4',
  'Mode 1 halaman: potret lalu sesuaikan 4 sudut.': 'Single page mode: snap and adjust 4 corners.',
  'Mode banyak halaman: potret beberapa halaman berurutan.': 'Batch mode: capture multiple pages sequentially.',
  'Mode KTP A4: ambil sisi depan lalu sisi belakang.': 'ID Card A4 mode: capture front then back.',
  'Sisi depan tersimpan. Potret sisi belakang kartu.': 'Front side saved. Now capture the back side.',
  'Sisi depan tersimpan. Pilih atau potret sisi belakang kartu.': 'Front side saved. Choose or snap the back side.',
  'Dua sisi kartu siap disusun ke 1 lembar A4.': 'Both sides are ready to lay out on one A4 page.',
  'Geser sudut atau sisi kertas; kaca pembesar aktif otomatis saat ditarik.':
    'Drag corners or edges; magnifier loupe activates automatically while dragging.',
  'Sesuaikan proporsi ukuran kertas otomatis (A4, F4, Kartu ID)':
    'Auto-snap paper aspect ratio (A4, F4, ID Card)',
  'Otomatis': 'Auto',
  'Bebas': 'Free',
  'Fit': 'Fit',
  'Seluruh halaman tampil utuh. Geser tanda tangan atau perbesar halaman untuk menata letaknya.':
    'The full page is shown cleanly. Drag the signature or zoom in to adjust layout.',
  'Mode sentuh editor': 'Editor touch mode',
  'Atur TTD': 'Move sign',
  'Geser halaman': 'Pan page',
  'Perbesar dokumen PDF': 'Zoom PDF document',
  'Perbesar halaman': 'Zoom page',
  'Kanan bawah': 'Bottom right',
  'Tengah': 'Center',
  'Posisi tanda tangan dirapikan.': 'Signature position aligned.',
  'Tinta hijau': 'Green ink',
  'Tinta ungu': 'Purple ink',
  'Pilih warna tinta': 'Choose ink color',
  'Pilih palet siap pakai atau atur warna tinta tanda tangan sesuai keinginan.':
    'Pick a preset ink swatch or customize your signature ink color.',
  'Corak warna (Hue)': 'Color Hue',
  'Kecerahan tinta': 'Ink Lightness',
  'Warna yang dipilih': 'Selected color',
  'Kode warna hex': 'Hex color code',
  'Terapkan warna': 'Apply color'
};

/* Teks dengan angka/nama: [pola, pengganti]. Grup yang ditandai t() ikut diterjemahkan. */
const I18N_PATTERNS = [
  [/^Kode pemulihan: (.+)$/, (m) => `Recovery code: ${m[1]}`],
  [/^Halaman (\d+) ditambahkan \(sudut otomatis\)\.$/, (m) => `Page ${m[1]} added (auto corners).`],
  [/^Disimpan ke Download\/ATTA DocStudio Pro: (.+)$/, (m) => `Saved to Download/ATTA DocStudio Pro: ${m[1]}`],
  [/^(\d+) foto pindai sebelumnya tersimpan\.$/, (m) => `${m[1]} previous scan photos kept.`],
  [/^Ukuran akhir: (.+)$/, (m) => `Final size: ${m[1]}`],
  [/^(\d+) gambar JPG$/, (m) => `${m[1]} JPG images`],
  [/^(\d+) berkas terpisah$/, (m) => `${m[1]} split files`],
  [/^(\d+) berkas disiapkan di (.+) untuk dibagikan\.$/, (m) => `${m[1]} files prepared in ${m[2]} for sharing.`],
  [/^(\d+) halaman$/, (m) => `${m[1]} ${m[1] === '1' ? 'page' : 'pages'}`],
  [/^Halaman (\d+)$/, (m) => `Page ${m[1]}`],
  [/^Halaman (\d+) dari (\d+)$/, (m) => `Page ${m[1]} of ${m[2]}`],
  [/^(\d+) menit lalu$/, (m) => `${m[1]} min ago`],
  [/^(\d+) jam lalu$/, (m) => `${m[1]} h ago`],
  [/^(\d+) hari lalu$/, (m) => `${m[1]} ${m[1] === '1' ? 'day' : 'days'} ago`],
  [/^Baru dipindai, (.+)$/, (m) => `Just scanned, ${tr(m[1])}`],
  [/^(\S+) (\d{4})$/, (m) => (I18N_EN[m[1]] ? `${I18N_EN[m[1]]} ${m[2]}` : null)],
  [/^Versi (.+)$/, (m) => `Version ${m[1]}`],
  [/^(\d+) berkas$/, (m) => `${m[1]} ${m[1] === '1' ? 'file' : 'files'}`],
  [/^(\d+) berkas, (.+)\. Semuanya ada di HP ini\.$/, (m) => `${m[1]} ${m[1] === '1' ? 'file' : 'files'}, ${m[2]}. All on this phone.`],
  [/^(\d+) berkas, (.+)$/, (m) => `${m[1]} ${m[1] === '1' ? 'file' : 'files'}, ${m[2]}`],
  [/^(\d+) berkas tersimpan di HP ini\. (.+)$/, (m) => `${m[1]} ${m[1] === '1' ? 'file' : 'files'} stored on this phone. ${tr(m[2])}`],
  [/^Terakhir dicadangkan (.+)\.$/, (m) => `Last backed up ${tr(m[1])}.`],
  [/^Dikunci PIN, (.+)$/, (m) => `PIN locked, ${m[1]}`],
  [/^(\d+) halaman belum disimpan\. Tutup lagi untuk membuang\.$/, (m) => `${m[1]} unsaved ${m[1] === '1' ? 'page' : 'pages'}. Close again to discard.`],
  [/^(\d+) halaman sudah dipindai\. Tambah foto dari galeri$/, (m) => `${m[1]} pages scanned. Add photo from gallery`],
  [/^Halaman (\d+) ditambahkan\.$/, (m) => `Page ${m[1]} added.`],
  [/^Halaman (\d+) diluruskan dan ditambahkan\.$/, (m) => `Page ${m[1]} straightened and added.`],
  [/^(\d+) halaman tersimpan\. Ukuran (\d+)% lebih kecil\.$/, (m) => `${m[1]} ${m[1] === '1' ? 'page' : 'pages'} saved. ${m[2]}% smaller.`],
  [/^(\d+) halaman tersimpan\.$/, (m) => `${m[1]} ${m[1] === '1' ? 'page' : 'pages'} saved.`],
  [/^(\d+) PDF ditambahkan ke Dokumen\.$/, (m) => `${m[1]} PDFs added to Documents.`],
  [/^Rotasi disetel ke (\d+) derajat\.$/, (m) => `Rotation set to ${m[1]} degrees.`],
  [/^Gabungkan (\d+) berkas$/, (m) => `Merge ${m[1]} files`],
  [/^(\d+) berkas digabung jadi (\d+) halaman\.$/, (m) => `${m[1]} files merged into ${m[2]} pages.`],
  [/^Target maks (\d+) KB$/, (m) => `Target up to ${m[1]} KB`],
  [/^Batas ukuran disetel ke (.+)\. Pilih berkasnya\.$/, (m) => `Size limit set to ${m[1]}. Choose the file.`],
  [/^Mengecilkan ke maksimal (.+)\.\.\.$/, (m) => `Reducing to ${m[1]} or less...`],
  [/^Jadi (.+), muat batas (.+)\. Teks di PDF ini tidak bisa disalin lagi\.$/, (m) => `Now ${m[1]}, within ${m[2]}. Text in this PDF can no longer be copied.`],
  [/^Jadi (.+), muat batas (.+)\.$/, (m) => `Now ${m[1]}, within ${m[2]}.`],
  [/^Paling kecil (.+), masih di atas (.+)\. Coba pisahkan halamannya dulu\.$/, (m) => `Smallest possible is ${m[1]}, still above ${m[2]}. Try splitting the pages first.`],
  [/^Maks (.+)$/, (m) => `Up to ${m[1]}`],
  [/^(\d+) berkas PDF hasil pemisahan disimpan\.$/, (m) => `${m[1]} split PDFs saved.`],
  [/^(\d+) halaman dihapus dari PDF\.$/, (m) => `${m[1]} ${m[1] === '1' ? 'page' : 'pages'} removed from the PDF.`],
  [/^Dokumen dikonversi ke PDF \((\d+) halaman\)\.$/, (m) => `Document converted to PDF (${m[1]} pages).`],
  [/^(.+) disimpan\.$/, (m) => (/\.\w{2,4}$/.test(m[1]) ? `${m[1]} saved.` : null)],
  [/^Struktur PDF berhasil diperbaiki \((\d+) halaman\)\.$/, (m) => `PDF structure repaired (${m[1]} pages).`],
  [/^(\d+) berkas dicadangkan ke (.+)\.$/, (m) => `${m[1]} files backed up to ${m[2]}.`],
  [/^Cadangan gagal dibuat\. (.*)$/, (m) => `Backup failed. ${m[1]}`],
  [/^(\d+) berkas dipulihkan ke HP ini\.$/, (m) => `${m[1]} files restored to this phone.`],
  [/^Gagal memulihkan cadangan\. (.*)$/, (m) => `Restore failed. ${m[1]}`],
  [/^Sudah versi terbaru \((.+)\)\.$/, (m) => `You have the latest version (${m[1]}).`],
  [/^Disimpan ke Files: (.+)$/, (m) => `Saved to Files: ${m[1]}`],
  [/^Terlalu banyak percobaan\. Coba lagi dalam (\d+) detik\.$/, (m) => `Too many attempts. Try again in ${m[1]} seconds.`],
  [/^Halo, (.+)\.$/, (m) => `Hello, ${m[1]}.`],
  [/^Isi "(.+)" akan dienkripsi\. Tanpa PIN, berkas tidak bisa dibuka, termasuk dari file cadangan\. PIN yang lupa tidak bisa dipulihkan\.$/,
    (m) => `"${m[1]}" will be encrypted. Without the PIN it cannot be opened, even from a backup. A forgotten PIN cannot be recovered.`],
  [/^Masukkan PIN "(.+)" untuk menyimpan kembali berkas tanpa kunci\.$/, (m) => `Enter the PIN for "${m[1]}" to save it without a lock.`],
  [/^Masukkan PIN untuk membuka "(.+)"\.$/, (m) => `Enter the PIN to open "${m[1]}".`],
  [/^Berkas A: (.+) \((\d+) halaman, (.+)\)$/, (m) => `File A: ${m[1]} (${m[2]} pages, ${m[3]})`],
  [/^Berkas B: (.+) \((\d+) halaman, (.+)\)$/, (m) => `File B: ${m[1]} (${m[2]} pages, ${m[3]})`],
  [/^Baris identik: (\d+) baris$/, (m) => `Identical lines: ${m[1]}`],
  [/^Baris baru di Berkas B: (\d+) baris$/, (m) => `New lines in file B: ${m[1]}`],
  [/^Baris yang dihapus dari Berkas A: (\d+) baris$/, (m) => `Lines removed from file A: ${m[1]}`],
  [/^Contoh Penambahan di Berkas B:$/, () => 'Examples added in file B:'],
  [/^Contoh Penghapusan dari Berkas A:$/, () => 'Examples removed from file A:'],
  [/^(\d+) halaman PDF disimpan sebagai gambar JPG\.$/, (m) => `${m[1]} PDF pages saved as JPG images.`],
  [/^Nomor halaman tidak valid\. Masukkan angka antara 1 sampai (\d+)\.$/, (m) => `Invalid page number. Enter a number between 1 and ${m[1]}.`],
  [/^Menampilkan (\d+) dari (\d+) halaman\. Simpan ke HP untuk melihat semua halaman\.$/, (m) => `Showing ${m[1]} of ${m[2]} pages. Save to your phone to view all pages.`],
  [/^(Scan|PDF|Foto|JPG|PNG|DOCX|TXT|CSV|MD)$/, (m) => ({ Foto: 'Photo' }[m[1]] || m[1])]
];

function i18nNormalize(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/** Terjemahkan satu teks. Bahasa Indonesia = teks sumber, dikembalikan apa adanya. */
function tr(input) {
  if (currentLang === 'id' || input == null) return input;
  const raw = String(input);
  const key = i18nNormalize(raw);
  if (!key) return raw;
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];

  if (Object.prototype.hasOwnProperty.call(I18N_EN, key)) return lead + I18N_EN[key] + trail;
  for (const [re, fn] of I18N_PATTERNS) {
    const m = key.match(re);
    if (m) {
      const out = fn(m);
      if (out != null) return lead + out + trail;
    }
  }
  // Teks berbaris banyak: terjemahkan per baris
  if (raw.includes('\n')) {
    const lines = raw.split('\n');
    const outLines = lines.map((l) => (l.trim() ? tr(l) : l));
    return outLines.join('\n');
  }
  // Keterangan berkas seperti "PDF, 2 halaman, 412 KB": terjemahkan per bagian
  if (key.includes(', ')) {
    const parts = key.split(', ');
    const out = parts.map((p) => tr(p));
    if (out.some((p, i) => p !== parts[i])) return lead + out.join(', ') + trail;
  }
  return raw;
}

/* ---------------------------------------------------------------------------
 * Penerjemah DOM: menyimpan teks asli agar bisa kembali ke Bahasa Indonesia
 * ------------------------------------------------------------------------- */
const I18N_SKIP = [
  '.file-row-name',
  '.stack-doc-name',
  '#fileActionSheetTitle',
  '#previewSheetTitle',
  '#accountName',
  '#accountEmail',
  '#accountAvatar',
  '#analyzeResultOutput',
  '[data-no-i18n]',
  'script',
  'style',
  'textarea'
].join(',');
const I18N_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const i18nOrig = new WeakMap();
const i18nLast = new WeakMap();
const i18nTracked = new Set();
let i18nApplying = false;

function i18nSkip(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !el || Boolean(el.closest(I18N_SKIP));
}

function i18nText(node) {
  if (i18nSkip(node)) return;
  const current = node.nodeValue;
  if (!i18nOrig.has(node) || i18nLast.get(node) !== current) i18nOrig.set(node, current);
  const src = i18nOrig.get(node);
  const out = currentLang === 'id' ? src : tr(src);
  i18nTracked.add(node);
  i18nLast.set(node, out);
  if (current !== out) node.nodeValue = out;
}

function i18nAttrs(el) {
  if (i18nSkip(el)) return;
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    const origKey = `data-i18n-${a}`;
    const lastKey = `data-i18n-last-${a}`;
    if (!el.hasAttribute(origKey) || el.getAttribute(lastKey) !== cur) el.setAttribute(origKey, cur);
    const src = el.getAttribute(origKey);
    const out = currentLang === 'id' ? src : tr(src);
    el.setAttribute(lastKey, out);
    if (cur !== out) el.setAttribute(a, out);
  }
}

function i18nWalk(root) {
  if (!root) return;
  if (root.nodeType === 3) return i18nText(root);
  if (root.nodeType !== 1) return;
  i18nAttrs(root);
  root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(i18nAttrs);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeValue.trim()) i18nText(n);
  }
}

function i18nApplyAll() {
  i18nApplying = true;
  try {
    document.documentElement.setAttribute('lang', currentLang);
    i18nWalk(document.body);
    for (const n of Array.from(i18nTracked)) {
      if (!n.isConnected) i18nTracked.delete(n);
    }
    document.querySelectorAll('[data-lang-choice]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.getAttribute('data-lang-choice') === currentLang));
    });
  } finally {
    i18nApplying = false;
  }
}

const i18nObserver = new MutationObserver((mutations) => {
  if (i18nApplying) return;
  i18nApplying = true;
  try {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => i18nWalk(n));
      } else if (m.type === 'characterData') {
        if (i18nLast.get(m.target) !== m.target.nodeValue) i18nText(m.target);
      } else if (m.type === 'attributes' && I18N_ATTRS.includes(m.attributeName)) {
        const el = m.target;
        if (el.getAttribute(`data-i18n-last-${m.attributeName}`) !== el.getAttribute(m.attributeName)) i18nAttrs(el);
      }
    }
  } finally {
    i18nApplying = false;
  }
});

async function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'id';
  try {
    localStorage.setItem('atta_lang', currentLang);
  } catch (_) {}
  if (window.AttaStorage) await AttaStorage.setSetting('pref_lang', currentLang);
  i18nApplyAll();
  applyLanguageDefaults();
  if (typeof refreshSettingsView === 'function' && currentTab === 'settings') refreshSettingsView();
}

/** Nilai bawaan di kolom isian (bukan teks layar) ikut bahasa */
function applyLanguageDefaults() {
  const wm = document.getElementById('watermarkTextInput');
  const ID_WM = 'SALINAN VERIFIKASI';
  const EN_WM = 'VERIFICATION COPY';
  if (wm && (wm.value === ID_WM || wm.value === EN_WM || !wm.value)) wm.value = currentLang === 'en' ? EN_WM : ID_WM;
  if (typeof pendingWatermarkText !== 'undefined' && (pendingWatermarkText === ID_WM || pendingWatermarkText === EN_WM)) {
    pendingWatermarkText = currentLang === 'en' ? EN_WM : ID_WM;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  i18nApplyAll();
  applyLanguageDefaults();
  i18nObserver.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: I18N_ATTRS
  });
});
