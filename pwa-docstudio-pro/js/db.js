/**
 * ATTA DocStudio Pro — Local-First Storage Engine (Dexie.js / IndexedDB)
 *
 * Fitur Wajib yang Diimplementasikan:
 * 1. Database IndexedDB menggunakan Dexie.js untuk menyimpan:
 *    - `files`: Dokumen pindaian foto, berkas PDF, e-Sign, teks OCR, dan Blob biner langsung di HP pengguna.
 *    - `settings`: Lisensi ATTA NATION Pro, preferensi kualitas kompresi, dan riwayat backup.
 * 2. `requestPersistentStorage()`: Memanggil `navigator.storage.persist()` saat aplikasi dibuka
 *    untuk mencegah penghapusan otomatis di iOS Safari & Android Chrome.
 * 3. `compressImageClientSide()`: Kompresi & filter gambar (Magic Color, B&W, Grayscale, Asli)
 *    otomatis di sisi klien sebelum disimpan ke IndexedDB agar memori HP tetap hemat.
 * 4. `exportBackupZip()` & `importBackupFile()`: Backup mandiri seluruh berkas & metadata
 *    ke dalam 1 file `.zip` (menggunakan JSZip) atau `.json` untuk pindah HP dengan aman.
 */

const db = new Dexie('AttaDocStudioLocalDB');

const ATTA_FILTER_CATALOG = [
  { id: 'original', label: 'Asli' },
  { id: 'enhance', label: 'Tingkatkan' },
  { id: 'noshadow', label: 'Tanpa Bayang' },
  { id: 'magic', label: 'Warna Ajaib' },
  { id: 'lighten', label: 'Pencerah' },
  { id: 'bw', label: 'Hitam Putih' },
  { id: 'gray', label: 'Abu-Abu' }
];

const ATTA_TOOL_ORIGIN_META = {
  scanner: { label: 'Pindai Kamera', defaultCategory: 'scan' },
  merge: { label: 'Gabung PDF & Foto', defaultCategory: 'pdf' },
  compress: { label: 'Kecilkan Ukuran', defaultCategory: 'pdf' },
  watermark: { label: 'Watermark PDF', defaultCategory: 'pdf' },
  split: { label: 'Pisahkan PDF', defaultCategory: 'pdf' },
  organize: { label: 'Susun & Putar PDF', defaultCategory: 'pdf' },
  remove: { label: 'Hapus Halaman PDF', defaultCategory: 'pdf' },
  pagenum: { label: 'Nomor Halaman PDF', defaultCategory: 'pdf' },
  crop_pdf: { label: 'Potong Margin PDF', defaultCategory: 'pdf' },
  crop_4corner: { label: 'Luruskan 4 Sudut', defaultCategory: 'scan' },
  idcard: { label: 'KTP Depan-Belakang A4', defaultCategory: 'scan' },
  sign: { label: 'Tanda Tangan', defaultCategory: 'signed' },
  office_to_pdf: { label: 'Office / Teks ke PDF', defaultCategory: 'pdf' },
  img2pdf: { label: 'Foto ke PDF', defaultCategory: 'pdf' },
  img2word: { label: 'Foto ke Word', defaultCategory: 'export' },
  pdf_export: { label: 'Konversi PDF', defaultCategory: 'export' },
  redact: { label: 'Samarkan Info PDF', defaultCategory: 'pdf' },
  repair: { label: 'Perbaiki Struktur PDF', defaultCategory: 'pdf' },
  compare: { label: 'Bandingkan 2 PDF', defaultCategory: 'export' },
  analyze: { label: 'Analisis & Ringkasan', defaultCategory: 'export' },
  import: { label: 'Impor Berkas', defaultCategory: 'pdf' }
};

function inferToolOriginFromRecord(rec) {
  if (rec && rec.toolOrigin && ATTA_TOOL_ORIGIN_META[rec.toolOrigin]) return rec.toolOrigin;
  const f = String((rec && rec.filterUsed) || '').toLowerCase();
  const n = String((rec && rec.name) || '').toLowerCase();
  if (f.includes('foto ke word')) return 'img2word';
  if (f.includes('foto ke pdf')) return 'img2pdf';
  if (f.includes('gabung')) return 'merge';
  if (f.startsWith('maks')) return 'compress';
  if (f.startsWith('watermark')) return 'watermark';
  if (f.includes('pisah')) return 'split';
  if (f.includes('susun') || f.includes('putar')) return 'organize';
  if (f.includes('hapus halaman')) return 'remove';
  if (f.includes('nomor halaman')) return 'pagenum';
  if (f.includes('potong margin')) return 'crop_pdf';
  if (f.includes('4 sudut')) return 'crop_4corner';
  if (f.includes('kartu id')) return 'idcard';
  if (f.includes('tanda tangan') || f.includes('tinta biru') || rec?.category === 'signed') return 'sign';
  if (f.includes('konversi ke pdf')) return 'office_to_pdf';
  if (f.includes('ekspor') || f.includes('pdf ke gambar')) return 'pdf_export';
  if (f.includes('disamarkan')) return 'redact';
  if (f.includes('perbaikan pdf')) return 'repair';
  if (f.includes('bandingkan') || n.includes('perbandingan')) return 'compare';
  if (f.startsWith('analisis')) return 'analyze';
  if (f === 'pdf' && rec?.category === 'pdf') return 'import';
  if (rec?.category === 'export') return 'pdf_export';
  if (rec?.category === 'scan') return 'scanner';
  return 'import';
}

db.version(1).stores({
  files: '++id, uuid, name, category, mimeType, size, filterUsed, createdAt, updatedAt',
  settings: 'key'
});

db.version(2)
  .stores({
    files: '++id, uuid, name, category, toolOrigin, mimeType, size, filterUsed, createdAt, updatedAt',
    settings: 'key',
    scan_drafts: '++id, order'
  })
  .upgrade(async (tx) => {
    await tx.table('files').toCollection().modify((rec) => {
      if (!rec.toolOrigin) {
        rec.toolOrigin = inferToolOriginFromRecord(rec);
      }
    });
  });

const AttaStorage = {
  /**
   * 1. Meminta izin Persistent Storage ke Browser (Sangat penting untuk iOS Safari & Android)
   */
  async initPersistence() {
    let persisted = false;
    try {
      if (navigator.storage && navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
        if (!persisted && navigator.storage.persist) {
          persisted = await navigator.storage.persist();
        }
      }
    } catch (err) {
      console.warn('Persistent storage check warning:', err);
    }
    return persisted;
  },

  /**
   * 2. Menghitung pemakaian memori penyimpanan lokal HP secara akurat (MB & Persentase)
   */
  async getStorageStats() {
    const allFiles = await db.files.toArray();
    const appUsedBytes = allFiles.reduce((acc, item) => acc + (item.size || 0), 0);

    let quotaBytes = 1024 * 1024 * 1024; // Default estimasi 1 GB jika browser tidak melaporkan kuota
    let browserUsedBytes = appUsedBytes;
    let persisted = false;

    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.quota) quotaBytes = est.quota;
        if (est.usage) browserUsedBytes = Math.max(appUsedBytes, est.usage);
      }
      if (navigator.storage && navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
    } catch (_) {}

    return {
      fileCount: allFiles.length,
      appUsedBytes,
      appUsedMB: (appUsedBytes / (1024 * 1024)).toFixed(2),
      browserUsedMB: (browserUsedBytes / (1024 * 1024)).toFixed(2),
      quotaMB: (quotaBytes / (1024 * 1024)).toFixed(0),
      percentUsed: Math.min(100, Math.max(1, ((appUsedBytes / (500 * 1024 * 1024)) * 100))).toFixed(1),
      persisted
    };
  },

  FILTER_CATALOG: ATTA_FILTER_CATALOG,
  TOOL_ORIGIN_META: ATTA_TOOL_ORIGIN_META,
  inferToolOrigin: inferToolOriginFromRecord,

  /**
   * 3a. Estimasi peta pencahayaan kertas (untuk Tanpa Bayang, Warna Ajaib, Hitam Putih, Abu-Abu)
   */
  _buildIlluminationMap(d, width, height) {
    const bw = Math.min(96, width);
    const bh = Math.max(1, Math.round((height * bw) / Math.max(1, width)));
    const gridR = new Float32Array(bw * bh);
    const gridG = new Float32Array(bw * bh);
    const gridB = new Float32Array(bw * bh);

    // Ambil maks lokal per blok agar teks gelap tersingkir dan menyisakan latar kertas
    for (let gy = 0; gy < bh; gy++) {
      const y0 = Math.floor((gy * height) / bh);
      const y1 = Math.min(height, Math.max(y0 + 1, Math.floor(((gy + 1) * height) / bh)));
      for (let gx = 0; gx < bw; gx++) {
        const x0 = Math.floor((gx * width) / bw);
        const x1 = Math.min(width, Math.max(x0 + 1, Math.floor(((gx + 1) * width) / bw)));
        let maxLum = -1;
        let mr = 255, mg = 255, mb = 255;
        const stepX = Math.max(1, Math.floor((x1 - x0) / 3));
        const stepY = Math.max(1, Math.floor((y1 - y0) / 3));
        for (let y = y0; y < y1; y += stepY) {
          for (let x = x0; x < x1; x += stepX) {
            const idx = (y * width + x) * 4;
            const r = d[idx], g = d[idx + 1], b = d[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum > maxLum) {
              maxLum = lum;
              mr = r;
              mg = g;
              mb = b;
            }
          }
        }
        const gi = gy * bw + gx;
        gridR[gi] = Math.max(30, mr);
        gridG[gi] = Math.max(30, mg);
        gridB[gi] = Math.max(30, mb);
      }
    }

    // Haluskan 2 pass (box blur 3x3) agar transisi pencahayaan mulus tanpa halo
    const smoothPass = (src) => {
      const out = new Float32Array(src.length);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          let sum = 0, cnt = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = Math.min(bh - 1, Math.max(0, y + dy));
            for (let dx = -1; dx <= 1; dx++) {
              const nx = Math.min(bw - 1, Math.max(0, x + dx));
              sum += src[ny * bw + nx];
              cnt++;
            }
          }
          out[y * bw + x] = sum / cnt;
        }
      }
      return out;
    };

    const sR = smoothPass(smoothPass(gridR));
    const sG = smoothPass(smoothPass(gridG));
    const sB = smoothPass(smoothPass(gridB));
    return { bw, bh, sR, sG, sB };
  },

  _sampleIllumination(map, x, y, width, height) {
    const gx = Math.min(map.bw - 1.001, Math.max(0, (x / Math.max(1, width)) * (map.bw - 1)));
    const gy = Math.min(map.bh - 1.001, Math.max(0, (y / Math.max(1, height)) * (map.bh - 1)));
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(map.bw - 1, x0 + 1), y1 = Math.min(map.bh - 1, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const i00 = y0 * map.bw + x0;
    const i10 = y0 * map.bw + x1;
    const i01 = y1 * map.bw + x0;
    const i11 = y1 * map.bw + x1;
    const interp = (arr) =>
      (arr[i00] * (1 - fx) + arr[i10] * fx) * (1 - fy) +
      (arr[i01] * (1 - fx) + arr[i11] * fx) * fy;
    return [interp(map.sR), interp(map.sG), interp(map.sB)];
  },

  _computeAutoLevels(d, pixelCount) {
    const hist = new Uint32Array(256);
    const step = Math.max(1, Math.floor(pixelCount / 16000));
    let sampled = 0;
    for (let i = 0; i < pixelCount; i += step) {
      const idx = i * 4;
      const lum = Math.min(255, Math.max(0, Math.round(0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2])));
      hist[lum]++;
      sampled++;
    }
    const pct = (p) => {
      const target = sampled * p;
      let acc = 0;
      for (let i = 0; i < 256; i++) {
        acc += hist[i];
        if (acc >= target) return i;
      }
      return 255;
    };
    const black = Math.min(120, Math.max(20, pct(0.01)));
    const white = Math.min(250, Math.max(200, pct(0.55) - 8));
    return { black, white, lo: pct(0.01), hi: pct(0.97) };
  },

  _applyUnsharp(d, width, height, amount = 0.45) {
    if (width < 4 || height < 4) return;
    const copy = new Uint8ClampedArray(d);
    const rowStride = width * 4;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const avg =
            (copy[i - rowStride + c] +
              copy[i + rowStride + c] +
              copy[i - 4 + c] +
              copy[i + 4 + c] +
              copy[i + c] * 2) /
            6;
          d[i + c] = Math.min(255, Math.max(0, Math.round(copy[i + c] + (copy[i + c] - avg) * amount)));
        }
      }
    }
  },

  /**
   * 3b. Terapkan 7 filter dokumen (disesuaikan dengan ImageFilterService APK GitHub) pada CanvasRenderingContext2D
   */
  applyFilterToCanvas(ctx, width, height, filter = 'magic') {
    if (!filter || filter === 'original') return;
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const pixelCount = width * height;

    if (filter === 'enhance') {
      const { lo, hi } = this._computeAutoLevels(d, pixelCount);
      const range = Math.max(30, hi - lo);
      for (let i = 0; i < d.length; i += 4) {
        let r = ((d[i] - lo) / range) * 255;
        let g = ((d[i + 1] - lo) / range) * 255;
        let b = ((d[i + 2] - lo) / range) * 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum + (r - lum) * 1.15;
        g = lum + (g - lum) * 1.15;
        b = lum + (b - lum) * 1.15;
        d[i] = Math.min(255, Math.max(0, Math.round(r)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
      }
      this._applyUnsharp(d, width, height, 0.45);
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    if (filter === 'lighten') {
      const { lo, hi } = this._computeAutoLevels(d, pixelCount);
      const low = lo * 0.5;
      const range = Math.max(40, hi - low);
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const t = Math.min(1, Math.max(0, (d[i + c] - low) / range));
          d[i + c] = Math.min(255, Math.max(0, Math.round(Math.pow(t, 0.78) * 255)));
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    // Filter berbasis perataan iluminasi kertas: noshadow, magic, bw, gray
    const map = this._buildIlluminationMap(d, width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const [br, bg, bb] = this._sampleIllumination(map, x, y, width, height);
        d[idx] = Math.min(255, Math.max(0, Math.round((d[idx] / br) * 255)));
        d[idx + 1] = Math.min(255, Math.max(0, Math.round((d[idx + 1] / bg) * 255)));
        d[idx + 2] = Math.min(255, Math.max(0, Math.round((d[idx + 2] / bb) * 255)));
      }
    }

    const { black, white } = this._computeAutoLevels(d, pixelCount);
    const levelMap = (v, b, w, gamma) => {
      const t = Math.min(1, Math.max(0, (v - b) / Math.max(1, w - b)));
      return Math.min(255, Math.max(0, Math.round(Math.pow(t, gamma) * 255)));
    };

    if (filter === 'noshadow') {
      const b0 = black * 0.6;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = levelMap(d[i], b0, white, 1.2);
        d[i + 1] = levelMap(d[i + 1], b0, white, 1.2);
        d[i + 2] = levelMap(d[i + 2], b0, white, 1.2);
      }
      this._applyUnsharp(d, width, height, 0.4);
    } else if (filter === 'magic') {
      for (let i = 0; i < d.length; i += 4) {
        let r = levelMap(d[i], black, white, 1.4);
        let g = levelMap(d[i + 1], black, white, 1.4);
        let b = levelMap(d[i + 2], black, white, 1.4);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i] = Math.min(255, Math.max(0, Math.round(lum + (r - lum) * 1.45)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round(lum + (g - lum) * 1.45)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round(lum + (b - lum) * 1.45)));
      }
      this._applyUnsharp(d, width, height, 0.55);
    } else if (filter === 'bw') {
      const thresh = white - 0.35 * (white - black);
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const t = Math.min(1, Math.max(0, (lum - (thresh - 25)) / 42));
        const val = Math.min(255, Math.max(0, Math.round(Math.pow(t, 1.45) * 255)));
        d[i] = d[i + 1] = d[i + 2] = val;
      }
    } else if (filter === 'gray') {
      const b0 = black * 0.7;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = levelMap(lum, b0, white, 1.25);
        d[i] = d[i + 1] = d[i + 2] = val;
      }
      this._applyUnsharp(d, width, height, 0.4);
    }

    ctx.putImageData(imgData, 0, 0);
  },

  /**
   * Parse orientation integer (1-8) from JPEG EXIF APP1 ArrayBuffer.
   * Returns 1 (normal upright) if non-JPEG, missing EXIF, or corrupted.
   */
  _parseExifOrientation(buffer) {
    if (!buffer || buffer.byteLength < 4) return 1;
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xFFD8) return 1; // Not JPEG

    let offset = 2;
    const maxBytes = view.byteLength;
    while (offset + 4 <= maxBytes) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xFFE1) {
        // APP1
        const length = view.getUint16(offset, false);
        offset += 2;
        if (length < 8 || offset + length - 2 > maxBytes) return 1;
        // Check 'Exif\0\0' (0x45786966 followed by 0x0000)
        if (view.getUint32(offset, false) === 0x45786966 && view.getUint16(offset + 4, false) === 0x0000) {
          const tiffOffset = offset + 6;
          if (tiffOffset + 8 > maxBytes) return 1;
          const endianWord = view.getUint16(tiffOffset, false);
          const littleEndian = endianWord === 0x4949; // 'II'
          if (!littleEndian && endianWord !== 0x4D4D) return 1; // 'MM'
          if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x002A) return 1; // 42
          const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian);
          const dirOffset = tiffOffset + ifd0Offset;
          if (dirOffset + 2 > maxBytes) return 1;
          const numEntries = view.getUint16(dirOffset, littleEndian);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = dirOffset + 2 + i * 12;
            if (entryOffset + 12 > maxBytes) return 1;
            const tag = view.getUint16(entryOffset, littleEndian);
            if (tag === 0x0112) {
              const val = view.getUint16(entryOffset + 8, littleEndian);
              if (val >= 1 && val <= 8) return val;
              return 1;
            }
          }
        }
        offset += length - 2;
      } else if ((marker & 0xFF00) === 0xFF00) {
        if (marker === 0xFFDA || marker === 0xFFD9) break; // SOS or EOI
        const length = view.getUint16(offset, false);
        if (length < 2) break; // Corrupted length
        offset += length;
      } else {
        break;
      }
    }
    return 1;
  },

  /**
   * Fast asynchronous orientation extraction from File/Blob header (first 64KB).
   */
  async getExifOrientation(fileOrBlob) {
    if (!fileOrBlob || typeof fileOrBlob.slice !== 'function') return 1;
    try {
      const slice = fileOrBlob.slice(0, 65536);
      const buffer = await slice.arrayBuffer();
      return this._parseExifOrientation(buffer);
    } catch (_) {
      return 1;
    }
  },

  /**
   * Normalizes image orientation, baking pixels upright onto canvas.
   * Accepts Blob or File. Returns Promise<Blob>.
   */
  async normalizeImageOrientation(fileOrBlob) {
    if (!fileOrBlob || typeof fileOrBlob !== 'object' || typeof fileOrBlob.slice !== 'function') {
      return fileOrBlob;
    }

    try {
      // 1. Fast detection: Read EXIF orientation tag from first 64KB
      const orientation = await this.getExifOrientation(fileOrBlob);
      // If already upright (orientation 1 or not JPEG/no EXIF tag), return untouched
      if (orientation === 1) {
        return fileOrBlob;
      }

      const outMime = fileOrBlob.type && fileOrBlob.type.includes('png') ? 'image/png' : 'image/jpeg';

      // 2. Primary Pathway: createImageBitmap with imageOrientation: 'from-image'
      if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
        try {
          const bitmap = await window.createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' });
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            const normalizedBlob = await new Promise((resolve, reject) => {
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Gagal memproses gambar.'))),
                outMime,
                outMime === 'image/png' ? undefined : 0.96
              );
            });
            canvas.width = canvas.height = 0;
            return normalizedBlob;
          }
        } catch (_) {
          // If createImageBitmap fails or option unsupported, fallback to Canvas 2D transform
        }
      }

      // 3. Fallback Pathway: Binary EXIF + Canvas 2D Transform
      const tempUrl = URL.createObjectURL(fileOrBlob);
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Format gambar tidak didukung.'));
        el.src = tempUrl;
      });
      URL.revokeObjectURL(tempUrl);

      const rawW = img.naturalWidth || img.width;
      const rawH = img.naturalHeight || img.height;
      const isRotated90or270 = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
      const cw = isRotated90or270 ? rawH : rawW;
      const ch = isRotated90or270 ? rawW : rawH;

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) return fileOrBlob;

      switch (orientation) {
        case 2: // Horizontal flip
          ctx.setTransform(-1, 0, 0, 1, cw, 0);
          break;
        case 3: // 180° rotation
          ctx.setTransform(-1, 0, 0, -1, cw, ch);
          break;
        case 4: // Vertical flip
          ctx.setTransform(1, 0, 0, -1, 0, ch);
          break;
        case 5: // Transpose
          ctx.setTransform(0, 1, 1, 0, 0, 0);
          break;
        case 6: // 90° CW
          ctx.setTransform(0, 1, -1, 0, cw, 0);
          break;
        case 7: // Transverse
          ctx.setTransform(0, -1, -1, 0, cw, ch);
          break;
        case 8: // 270° CW (90° CCW)
          ctx.setTransform(0, -1, 1, 0, 0, ch);
          break;
        default:
          break;
      }
      ctx.drawImage(img, 0, 0);

      const bakedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Gagal memproses gambar.'))),
          outMime,
          outMime === 'image/png' ? undefined : 0.96
        );
      });
      canvas.width = canvas.height = 0;
      return bakedBlob;
    } catch (err) {
      console.warn('normalizeImageOrientation skipped due to error:', err);
      return fileOrBlob;
    }
  },

  async _loadImageFromSource(source) {
    if (source && typeof source === 'object' && source.tagName === 'IMG' && source.complete) {
      return source;
    }
    if (typeof source === 'string') {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
        img.onload = () => resolve(img);
        img.src = source;
      });
    }

    let normalizedSource = source;
    if (source && (source instanceof Blob || (typeof source === 'object' && typeof source.slice === 'function'))) {
      try {
        normalizedSource = await this.normalizeImageOrientation(source);
      } catch (_) {
        normalizedSource = source;
      }
    }

    const objUrl = URL.createObjectURL(normalizedSource);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Format gambar tidak didukung.'));
      };
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve(img);
      };
      img.src = objUrl;
    });
  },

  async rotateImageSourceFast(source, deg = 90, maxDim = 960, quality = 0.82) {
    const img = await this._loadImageFromSource(source);
    const step = ((deg % 360) + 360) % 360;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (maxDim && (w > maxDim || h > maxDim)) {
      const s = maxDim / Math.max(w, h);
      w = Math.max(16, Math.round(w * s));
      h = Math.max(16, Math.round(h * s));
    }
    const cw = step % 180 === 0 ? w : h;
    const ch = step % 180 === 0 ? h : w;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((step * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    const dataUrl = c.toDataURL('image/jpeg', quality);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    c.width = c.height = 0;
    return { dataUrl, blob, width: cw, height: ch };
  },

  async generateAllFilterThumbnails(source, thumbWidth = 68, rotationDeg = 0) {
    const img = await this._loadImageFromSource(source);
    const rot = ((rotationDeg % 360) + 360) % 360;
    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;
    const scale = thumbWidth / Math.max(1, rot % 180 === 0 ? rawW : rawH);
    const drawW = Math.max(24, Math.round(rawW * scale));
    const drawH = Math.max(24, Math.round(rawH * scale));
    const cw = rot % 180 === 0 ? drawW : drawH;
    const ch = rot % 180 === 0 ? drawH : drawW;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = cw;
    baseCanvas.height = ch;
    const baseCtx = baseCanvas.getContext('2d');
    baseCtx.fillStyle = '#FFFFFF';
    baseCtx.fillRect(0, 0, cw, ch);
    baseCtx.translate(cw / 2, ch / 2);
    baseCtx.rotate((rot * Math.PI) / 180);
    baseCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    baseCtx.setTransform(1, 0, 0, 1, 0, 0);

    const out = {};
    for (const f of ATTA_FILTER_CATALOG) {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext('2d');
      ctx.drawImage(baseCanvas, 0, 0);
      this.applyFilterToCanvas(ctx, cw, ch, f.id);
      out[f.id] = c.toDataURL('image/jpeg', 0.78);
      c.width = c.height = 0;
    }
    baseCanvas.width = baseCanvas.height = 0;
    return out;
  },

  /**
   * 3c. Kompresi Gambar & Filter Dokumen Otomatis di Sisi Klien (Client-Side Canvas)
   */
  async compressAndFilterImage(fileOrSource, options = {}) {
    const maxDim = options.maxDimension || 1800;
    const quality = options.quality || 0.78;
    const filter = options.filter || 'magic';
    const outputMime = options.outputMime === 'image/png' ? 'image/png' : 'image/jpeg';
    const rot = (((options.rotationDeg || 0) % 360) + 360) % 360;

    const img = options.imgEl || (await this._loadImageFromSource(fileOrSource));
    let drawW = img.naturalWidth || img.width;
    let drawH = img.naturalHeight || img.height;
    if (drawW > maxDim || drawH > maxDim) {
      if (drawW > drawH) {
        drawH = Math.round((drawH * maxDim) / drawW);
        drawW = maxDim;
      } else {
        drawW = Math.round((drawW * maxDim) / drawH);
        drawH = maxDim;
      }
    }

    const width = rot % 180 === 0 ? drawW : drawH;
    const height = rot % 180 === 0 ? drawH : drawW;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.applyFilterToCanvas(ctx, width, height, filter);

    const dataUrl = outputMime === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Gagal mengompresi gambar.'))),
        outputMime,
        outputMime === 'image/png' ? undefined : quality
      );
    });
    canvas.width = canvas.height = 0;

    return {
      blob,
      dataUrl,
      width,
      height,
      originalSize: (typeof fileOrSource === 'object' && fileOrSource && fileOrSource.size) || blob.size,
      compressedSize: blob.size
    };
  },

  /**
   * 4. Simpan Berkas (Foto Scan / PDF / Hasil Alat) ke IndexedDB HP Pelanggan
   */
  async saveFileRecord({
    name,
    category = 'scan', // 'scan' | 'pdf' | 'export' | 'signed'
    toolOrigin = null,
    mimeType = 'image/jpeg',
    blob,
    thumbnailDataUrl = null,
    filterUsed = 'Warna Ajaib',
    originalSize = null,
    notes = ''
  }) {
    const now = new Date().toISOString();
    const uuid = 'atta-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    let pageCount = null;
    if (mimeType === 'application/pdf' && blob) {
      pageCount = await this.countPdfPages(blob);
      if (pageCount && (!notes || /^\d+ halaman$/i.test(notes) || /^1 halaman A4$/i.test(notes))) {
        notes = `${pageCount} halaman`;
      }
    }

    const resolvedOrigin = toolOrigin || inferToolOriginFromRecord({ category, filterUsed, name });

    const id = await db.files.add({
      uuid,
      name,
      category,
      toolOrigin: resolvedOrigin,
      mimeType,
      size: blob ? blob.size : 0,
      originalSize: originalSize || (blob ? blob.size : 0),
      filterUsed,
      blob,
      thumbnailDataUrl,
      notes,
      pageCount,
      createdAt: now,
      updatedAt: now
    });
    const record = await db.files.get(id);

    // Hasilkan thumbnail PDF di latar belakang agar penyimpanan & tampilan daftar Dokumen langsung tampil
    if (mimeType === 'application/pdf' && blob && !thumbnailDataUrl && window.AttaPdfRender) {
      setTimeout(async () => {
        try {
          const thumb = await window.AttaPdfRender.firstPageThumb(blob);
          if (thumb) {
            await db.files.update(id, { thumbnailDataUrl: thumb });
            if (typeof window.renderFileVault === 'function') {
              window.renderFileVault();
            }
          }
        } catch (_) {}
      }, 60);
    }

    return record;
  },

  async getFilesByToolOrigin(toolOrigin) {
    if (!toolOrigin) return this.getAllFiles();
    const all = await this.getAllFiles();
    return all.filter((f) => (f.toolOrigin || inferToolOriginFromRecord(f)) === toolOrigin);
  },

  async getToolOriginCounts() {
    const all = await db.files.toArray();
    const counts = {};
    for (const f of all) {
      const origin = f.toolOrigin || inferToolOriginFromRecord(f);
      counts[origin] = (counts[origin] || 0) + 1;
    }
    return counts;
  },

  async addScanDraftPage(pageRecord) {
    const existing = await db.scan_drafts.orderBy('order').toArray();
    const nextOrder = existing.length ? (existing[existing.length - 1].order || 0) + 1 : 0;
    const id = await db.scan_drafts.add({
      order: nextOrder,
      rawBlob: pageRecord.rawBlob,
      unCroppedBlob: pageRecord.unCroppedBlob || null,
      cornersNorm: pageRecord.cornersNorm || null,
      autoCropped: Boolean(pageRecord.autoCropped),
      width: pageRecord.width || 0,
      height: pageRecord.height || 0,
      filter: pageRecord.filter || 'magic',
      rotationDeg: pageRecord.rotationDeg || 0,
      originalSize: pageRecord.originalSize || (pageRecord.rawBlob ? pageRecord.rawBlob.size : 0),
      createdAt: Date.now()
    });
    return db.scan_drafts.get(id);
  },

  async getScanDraftPages() {
    return db.scan_drafts.orderBy('order').toArray();
  },

  async updateScanDraftPage(id, changes) {
    return db.scan_drafts.update(Number(id), changes);
  },

  async deleteScanDraftPage(id) {
    return db.scan_drafts.delete(Number(id));
  },

  async replaceScanDraftOrder(orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.scan_drafts.update(Number(orderedIds[i]), { order: i });
    }
  },

  async clearScanDraftPages() {
    return db.scan_drafts.clear();
  },

  async countPdfPages(blob) {
    try {
      if (!window.PDFLib || !blob) return null;
      const doc = await window.PDFLib.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
      return doc.getPageCount();
    } catch (_) {
      return null;
    }
  },

  /* ---------- Kunci PIN: enkripsi AES-GCM 256, kunci diturunkan dari PIN (PBKDF2) ---------- */
  _b64(buf) {
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },

  _unb64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  async _deriveKey(pin, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /** Enkripsi isi berkas + thumbnail-nya. PIN tidak pernah disimpan. */
  async lockFile(id, pin) {
    const item = await db.files.get(Number(id));
    if (!item || !item.blob) throw new Error('Berkas tidak ditemukan.');
    if (item.encrypted) throw new Error('Berkas ini sudah dikunci.');
    const iterations = 210000;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this._deriveKey(pin, salt, iterations);
    const payload = JSON.stringify({ thumb: item.thumbnailDataUrl || null });
    const plainBytes = new Uint8Array(await item.blob.arrayBuffer());
    const header = new TextEncoder().encode(payload);
    // Format: [4 byte panjang header][header JSON][isi berkas]
    const joined = new Uint8Array(4 + header.length + plainBytes.length);
    new DataView(joined.buffer).setUint32(0, header.length);
    joined.set(header, 4);
    joined.set(plainBytes, 4 + header.length);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, joined);
    await db.files.update(item.id, {
      blob: new Blob([cipher], { type: 'application/octet-stream' }),
      encrypted: true,
      cryptoMeta: { v: 1, alg: 'AES-GCM-256', kdf: 'PBKDF2-SHA256', iterations, salt: this._b64(salt), iv: this._b64(iv) },
      thumbnailDataUrl: null,
      updatedAt: new Date().toISOString()
    });
  },

  /** Kembalikan isi asli tanpa mengubah data tersimpan. Melempar error bila PIN salah. */
  async decryptFile(item, pin) {
    const m = item.cryptoMeta;
    const key = await this._deriveKey(pin, this._unb64(m.salt), m.iterations);
    let plain;
    try {
      plain = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this._unb64(m.iv) }, key, await item.blob.arrayBuffer())
      );
    } catch (_) {
      const err = new Error('PIN salah.');
      err.code = 'BAD_PIN';
      throw err;
    }
    const headerLen = new DataView(plain.buffer).getUint32(0);
    const header = JSON.parse(new TextDecoder().decode(plain.slice(4, 4 + headerLen)));
    const blob = new Blob([plain.slice(4 + headerLen)], { type: item.mimeType || 'application/octet-stream' });
    return { blob, thumbnailDataUrl: header.thumb || null };
  },

  /** Buka kunci permanen: simpan lagi isi aslinya */
  async unlockFilePermanently(id, pin) {
    const item = await db.files.get(Number(id));
    if (!item || !item.encrypted) return;
    const plain = await this.decryptFile(item, pin);
    await db.files.update(item.id, {
      blob: plain.blob,
      encrypted: false,
      cryptoMeta: null,
      thumbnailDataUrl: plain.thumbnailDataUrl,
      updatedAt: new Date().toISOString()
    });
  },

  async getAllFiles() {
    return db.files.orderBy('id').reverse().toArray();
  },

  async getFileById(id) {
    return db.files.get(Number(id));
  },

  async deleteFileById(id) {
    return db.files.delete(Number(id));
  },

  async renameFile(id, newName) {
    return db.files.update(Number(id), {
      name: newName.trim(),
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * 5a. Konversi Blob ke Base64 agar bisa dikirim aman via bridge native Android
   */
  _readBlobAsBase64(blobSlice) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error('Gagal membaca data berkas.'));
      reader.readAsDataURL(blobSlice);
    });
  },

  /**
   * 5b. Bridge ke wrapper APK Android agar simpan file, ZIP, & bagikan bekerja di WebView
   */
  async _saveBlobViaNativeBridge(blob, fileName, mimeType, shareAfterSave = false) {
    const bridge = typeof window !== 'undefined' ? window.AttaNativeAndroid : null;
    if (!bridge) return false;

    const cleanMime = mimeType || 'application/octet-stream';
    if (
      typeof bridge.beginFileSave === 'function' &&
      typeof bridge.appendFileChunk === 'function' &&
      typeof bridge.finishFileSave === 'function'
    ) {
      const token = bridge.beginFileSave(fileName, cleanMime);
      if (!token) {
        throw new Error('Penyimpanan ke perangkat dibatalkan atau gagal.');
      }
      const chunkSize = 512 * 1024;
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const chunkB64 = await this._readBlobAsBase64(blob.slice(offset, Math.min(blob.size, offset + chunkSize)));
        if (chunkB64 && !bridge.appendFileChunk(token, chunkB64)) {
          throw new Error('Gagal menulis potongan berkas ke perangkat.');
        }
      }
      if (!bridge.finishFileSave(token, Boolean(shareAfterSave))) {
        throw new Error('Penyimpanan ke perangkat dibatalkan atau gagal.');
      }
      return true;
    }

    if (typeof bridge.saveFile === 'function') {
      const base64Data = await this._readBlobAsBase64(blob);
      const ok = bridge.saveFile(base64Data, fileName, cleanMime, Boolean(shareAfterSave));
      if (ok === false) {
        throw new Error('Penyimpanan ke perangkat dibatalkan atau gagal.');
      }
      return true;
    }

    return false;
  },

  /**
   * 5. Tombol "Simpan ke Galeri / Files HP" (Permanent Local Device Download & Native Web Share)
   */
  async saveToDeviceStorage(fileRecord, useShareIfMobile = false) {
    const blob = fileRecord.blob;
    if (!blob) throw new Error('Data berkas tidak ditemukan.');

    const extByMime = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'text/plain': '.txt',
      'text/markdown': '.md',
      'text/csv': '.csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
    };
    const ext = extByMime[fileRecord.mimeType] || '';
    const fileName = !ext || fileRecord.name.toLowerCase().endsWith(ext) ? fileRecord.name : `${fileRecord.name}${ext}`;

    // Di dalam APK Android wrapper: delegasikan simpan / bagikan ke bridge native
    if (await this._saveBlobViaNativeBridge(blob, fileName, fileRecord.mimeType, useShareIfMobile)) {
      return;
    }

    // Pada iOS Safari / Android modern: dukung Web Share API ke "Save to Files / Simpan ke Foto"
    if (useShareIfMobile && navigator.canShare) {
      const shareFile = new File([blob], fileName, { type: fileRecord.mimeType });
      if (navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          title: fileName,
          files: [shareFile]
        });
        return;
      }
    }

    // Unduh langsung ke folder Download / Files di HP
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 600);
  },

  /**
   * 6. FITUR KEAMANAN DATA MANDIRI: Ekspor / Backup Seluruh Data IndexedDB ke 1 File .ZIP (JSZip)
   */
  async exportFullBackupZip(shareAfterSave = false) {
    const allFiles = await db.files.toArray();
    // Kunci API dan data rahasia lain tidak ikut dicadangkan
    const privateKeys = new Set(['gemini_api_key', 'locked_file_pins', 'account', 'app_lock']);
    const allSettings = (await db.settings.toArray()).filter((st) => !privateKeys.has(st.key));

    const zip = new JSZip();
    const metaList = [];

    for (const item of allFiles) {
      const ext = item.encrypted
        ? '.terkunci'
        : ({ 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' }[item.mimeType] || '');
      const safeFileName = `${item.id}_${item.name.replace(/[^a-zA-Z0-9_\-.]/g, '_')}${item.name.endsWith(ext) ? '' : ext}`;

      if (item.blob) {
        zip.file(`files/${safeFileName}`, item.blob);
      }

      metaList.push({
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        category: item.category,
        toolOrigin: item.toolOrigin || inferToolOriginFromRecord(item),
        mimeType: item.mimeType,
        size: item.size,
        originalSize: item.originalSize,
        filterUsed: item.filterUsed,
        thumbnailDataUrl: item.thumbnailDataUrl,
        notes: item.notes,
        pageCount: item.pageCount || null,
        encrypted: Boolean(item.encrypted),
        cryptoMeta: item.cryptoMeta || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        archivePath: `files/${safeFileName}`
      });
    }

    const backupManifest = {
      app: 'ATTA DocStudio Pro PWA',
      studio: 'ATTA NATION — Independent Technology Product Studio',
      backupVersion: '2.1.0',
      exportedAt: new Date().toISOString(),
      totalFiles: metaList.length,
      settings: allSettings,
      files: metaList
    };

    zip.file('atta-backup-manifest.json', JSON.stringify(backupManifest, null, 2));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const zipName = `ATTA_DocStudio_Backup_${stamp}.zip`;

    if (await this._saveBlobViaNativeBridge(zipBlob, zipName, 'application/zip', Boolean(shareAfterSave))) {
      await db.settings.put({ key: 'last_backup_at', value: new Date().toISOString() });
      return { count: metaList.length, zipName, sizeBytes: zipBlob.size };
    }

    if (shareAfterSave && navigator.canShare) {
      const shareFile = new File([zipBlob], zipName, { type: 'application/zip' });
      if (navigator.canShare({ files: [shareFile] })) {
        await navigator.share({ title: zipName, files: [shareFile] });
        await db.settings.put({ key: 'last_backup_at', value: new Date().toISOString() });
        return { count: metaList.length, zipName, sizeBytes: zipBlob.size };
      }
    }

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 800);

    await db.settings.put({ key: 'last_backup_at', value: new Date().toISOString() });
    return { count: metaList.length, zipName, sizeBytes: zipBlob.size };
  },

  /**
   * 7. FITUR KEAMANAN DATA MANDIRI: Impor / Restore Data dari File Backup (.ZIP atau .JSON)
   */
  async importBackupArchive(archiveFile) {
    const fileName = archiveFile.name.toLowerCase();
    let restoredCount = 0;

    if (fileName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(archiveFile);
      const manifestEntry = zip.file('atta-backup-manifest.json');
      if (!manifestEntry) {
        throw new Error('File ZIP bukan arsip backup resmi ATTA DocStudio Pro.');
      }

      const manifestText = await manifestEntry.async('string');
      const manifest = JSON.parse(manifestText);

      if (Array.isArray(manifest.settings)) {
        const skip = new Set(['gemini_api_key', 'locked_file_pins', 'account', 'app_lock']);
        for (const st of manifest.settings) {
          if (st && st.key && !skip.has(st.key)) await db.settings.put(st);
        }
      }

      if (Array.isArray(manifest.files)) {
        for (const meta of manifest.files) {
          const binEntry = zip.file(meta.archivePath);
          if (!binEntry) continue;
          // Berkas yang sudah ada (uuid sama) tidak digandakan
          if (meta.uuid && (await db.files.where('uuid').equals(meta.uuid).count()) > 0) continue;
          const arrayBuffer = await binEntry.async('arraybuffer');
          const blob = new Blob([arrayBuffer], {
            type: meta.encrypted ? 'application/octet-stream' : meta.mimeType || 'application/octet-stream'
          });

          await db.files.add({
            uuid: meta.uuid || ('atta-restored-' + Date.now() + '-' + restoredCount),
            name: meta.name,
            category: meta.category || 'scan',
            toolOrigin: meta.toolOrigin || inferToolOriginFromRecord(meta),
            mimeType: meta.mimeType || 'image/jpeg',
            size: blob.size,
            originalSize: meta.originalSize || blob.size,
            filterUsed: meta.filterUsed || 'Restored',
            blob,
            thumbnailDataUrl: meta.encrypted ? null : meta.thumbnailDataUrl || null,
            notes: meta.notes || '',
            pageCount: meta.pageCount || null,
            encrypted: Boolean(meta.encrypted),
            cryptoMeta: meta.cryptoMeta || null,
            createdAt: meta.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          restoredCount++;
        }
      }
      return { restoredCount, exportedAt: manifest.exportedAt };
    }

    if (fileName.endsWith('.json')) {
      const text = await archiveFile.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.files)) {
        throw new Error('Format JSON backup tidak valid.');
      }
      for (const item of data.files) {
        if (item.uuid && (await db.files.where('uuid').equals(item.uuid).count()) > 0) continue;
        let blob = null;
        if (item.base64Data && typeof item.base64Data === 'string') {
          const commaIdx = item.base64Data.indexOf(',');
          const b64 = commaIdx >= 0 ? item.base64Data.slice(commaIdx + 1) : item.base64Data;
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          blob = new Blob([bytes], { type: item.mimeType || 'application/octet-stream' });
        }
        await db.files.add({
          uuid: item.uuid || ('atta-json-' + Date.now() + '-' + restoredCount),
          name: item.name,
          category: item.category || 'scan',
          toolOrigin: item.toolOrigin || inferToolOriginFromRecord(item),
          mimeType: item.mimeType || 'image/jpeg',
          size: blob ? blob.size : item.size || 0,
          originalSize: item.originalSize || (blob ? blob.size : 0),
          filterUsed: item.filterUsed || 'Restored',
          blob,
          thumbnailDataUrl: item.thumbnailDataUrl || null,
          notes: item.notes || '',
          pageCount: item.pageCount || null,
          encrypted: Boolean(item.encrypted),
          cryptoMeta: item.cryptoMeta || null,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        restoredCount++;
      }
      return { restoredCount, exportedAt: data.exportedAt };
    }

    throw new Error('Pilih file arsip .zip atau .json hasil backup ATTA DocStudio Pro.');
  },

  async restoreDeletedFileRecord(record) {
    if (!record) return null;
    const copy = { ...record, updatedAt: new Date().toISOString() };
    return db.files.put(copy);
  },

  async getSetting(key, defaultValue = null) {
    const row = await db.settings.get(key);
    return row ? row.value : defaultValue;
  },

  async setSetting(key, value) {
    return db.settings.put({ key, value });
  }
};

window.AttaStorage = AttaStorage;
window.normalizeImageOrientation = AttaStorage.normalizeImageOrientation.bind(AttaStorage);
