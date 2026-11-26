/**
 * AttaPdfRender — membaca dan menggambar PDF di HP dengan pdf.js.
 * Semua proses lokal; tidak ada berkas yang dikirim ke server.
 */
const AttaPdfRender = (() => {
  const base = new URL('./js/vendor/pdfjs/', document.baseURI).href;
  let readyPromise = null;

  function ready(timeoutMs = 8000) {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!readyPromise) {
      readyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Pembaca PDF belum siap.')), timeoutMs);
        window.addEventListener(
          'pdfjs-ready',
          () => {
            clearTimeout(timer);
            resolve(window.pdfjsLib);
          },
          { once: true }
        );
      });
    }
    return readyPromise;
  }

  function closeDoc(doc) {
    try {
      if (doc && doc.loadingTask && typeof doc.loadingTask.destroy === 'function') doc.loadingTask.destroy();
      else if (doc && typeof doc.destroy === 'function') doc.destroy();
    } catch (_) {}
  }

  async function loadDoc(blobOrBuffer) {
    const lib = await ready();
    const data =
      blobOrBuffer instanceof ArrayBuffer
        ? new Uint8Array(blobOrBuffer.slice(0))
        : new Uint8Array(await blobOrBuffer.arrayBuffer());
    return lib.getDocument({
      data,
      standardFontDataUrl: `${base}standard_fonts/`,
      wasmUrl: `${base}wasm/`,
      isEvalSupported: false
    }).promise;
  }

  async function renderPage(doc, pageNumber, scale, extraRotation = 0) {
    const page = await doc.getPage(pageNumber);
    const totalRotation = (((page.rotate || 0) + (extraRotation || 0)) % 360 + 360) % 360;
    const viewport = page.getViewport({ scale, rotation: totalRotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const base1 = page.getViewport({ scale: 1, rotation: totalRotation });
    page.cleanup();
    return { canvas, widthPt: base1.width, heightPt: base1.height };
  }

  /** Gambar kecil halaman pertama (JPEG data URL) untuk daftar dokumen */
  async function firstPageThumb(blob, targetWidth = 220) {
    const doc = await loadDoc(blob);
    try {
      const page = await doc.getPage(1);
      const scale = targetWidth / page.getViewport({ scale: 1 }).width;
      page.cleanup();
      const { canvas } = await renderPage(doc, 1, Math.min(2, Math.max(0.2, scale)));
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      canvas.width = canvas.height = 0;
      return dataUrl;
    } finally {
      closeDoc(doc);
    }
  }

  /** Ekspor halaman PDF menjadi rangkaian gambar JPEG berlatar putih (PDF ke Gambar) */
  async function exportPagesAsJpegs(blob, { scale = 2, quality = 0.88, maxPages = 30 } = {}) {
    const doc = await loadDoc(blob);
    const pages = [];
    try {
      const limit = Math.min(doc.numPages, maxPages);
      for (let i = 1; i <= limit; i++) {
        const { canvas } = await renderPage(doc, i, scale);
        const jpgBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        const thumbCanvas = document.createElement('canvas');
        const ratio = 220 / Math.max(1, canvas.width);
        thumbCanvas.width = 220;
        thumbCanvas.height = Math.max(1, Math.round(canvas.height * ratio));
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.fillStyle = '#FFFFFF';
        tCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
        thumbCanvas.width = thumbCanvas.height = 0;
        canvas.width = canvas.height = 0;
        if (jpgBlob) {
          pages.push({ pageNumber: i, blob: jpgBlob, thumbDataUrl });
        }
      }
      return { pages, totalPages: doc.numPages };
    } finally {
      closeDoc(doc);
    }
  }

  /** Teks per halaman. Hasil scan (gambar) biasanya tidak punya teks. */
  async function extractText(blob, maxPages = 50) {
    const doc = await loadDoc(blob);
    try {
      const pages = [];
      const n = Math.min(doc.numPages, maxPages);
      for (let i = 1; i <= n; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let line = '';
        for (const item of content.items) {
          if (!('str' in item)) continue;
          line += item.str + (item.hasEOL ? '\n' : ' ');
        }
        pages.push(line.replace(/[ \t]+\n/g, '\n').trim());
        page.cleanup();
      }
      return { pages, text: pages.join('\n\n').trim(), numPages: doc.numPages };
    } finally {
      closeDoc(doc);
    }
  }

  /** Gambar satu halaman untuk dipakai di layar (mis. memilih area redaksi atau stempel) */
  async function renderPageImage(blob, pageNumber, targetWidth, extraRotation = 0) {
    const doc = await loadDoc(blob);
    try {
      const page = await doc.getPage(pageNumber);
      const totalRotation = (((page.rotate || 0) + (extraRotation || 0)) % 360 + 360) % 360;
      const v1 = page.getViewport({ scale: 1, rotation: totalRotation });
      const scale = targetWidth / Math.max(1, v1.width);
      page.cleanup();
      const out = await renderPage(doc, pageNumber, scale, extraRotation);
      return { ...out, numPages: doc.numPages };
    } finally {
      closeDoc(doc);
    }
  }

  /**
   * Redaksi permanen: setiap halaman digambar ulang menjadi gambar, area yang
   * dipilih ditutup hitam, lalu disusun lagi menjadi PDF. Teks asli tidak ikut
   * tersimpan, jadi tidak bisa disalin atau dicari lagi.
   * @param {Blob} blob PDF asal
   * @param {Object<number, Array<{x:number,y:number,w:number,h:number}>>} rectsByPage
   *        koordinat 0..1 relatif terhadap lebar/tinggi halaman (asal kiri-atas)
   */
  async function rasterizeWithRedactions(blob, rectsByPage, { scale = 2, quality = 0.85 } = {}) {
    const { PDFDocument } = window.PDFLib;
    const doc = await loadDoc(blob);
    const out = await PDFDocument.create();
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const { canvas, widthPt, heightPt } = await renderPage(doc, i, scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        for (const r of rectsByPage[i] || []) {
          ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
        }
        const jpgBytes = await new Promise((resolve) =>
          canvas.toBlob((b) => b.arrayBuffer().then(resolve), 'image/jpeg', quality)
        );
        const img = await out.embedJpg(jpgBytes);
        const page = out.addPage([widthPt, heightPt]);
        page.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt });
        canvas.width = canvas.height = 0;
      }
    } finally {
      closeDoc(doc);
    }
    out.setProducer('ATTA DocStudio Pro');
    out.setCreator('ATTA DocStudio Pro');
    const bytes = await out.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), pageCount: out.getPageCount() };
  }

  return { ready, loadDoc, renderPage, closeDoc, firstPageThumb, exportPagesAsJpegs, extractText, renderPageImage, rasterizeWithRedactions };
})();

window.AttaPdfRender = AttaPdfRender;
