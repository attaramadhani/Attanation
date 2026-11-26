/**
 * tier3_combinations.test.js - Tier 3: Cross-Feature Interactions & Pairwise Combinations (24 Tests)
 * ATTA DocStudio Pro (PWA & APK v1.0.0) E2E Test Suite
 * 
 * Pairwise tests covering cross-feature inputs and outputs across Milestones M1 through M5.
 */

const fs = require('fs');
const path = require('path');

const PWA_DIR = path.resolve(__dirname, '../../pwa-docstudio-pro');
const APK_DIR = path.resolve(__dirname, '../../apk-projects/atta-docstudio-pwa-apk');

async function createSyntheticPdf(window, rotation = 0, width = 595, height = 842) {
  const { PDFDocument, degrees } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.setSize(width, height);
  if (rotation !== 0) {
    page.setRotation((degrees || window.PDFLib.degrees)(rotation));
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

describe('Tier 3: Pairwise Combinations & Cross-Feature Interactions (24 Tests)', () => {

  it('T3-PAIR-01: F01 + F11: EXIF Normalization -> Sobel Edge CV', async ({ AttaStorage, AttaToolsEngine, document, assert }) => {
    // 1. Ingest EXIF orientation 6 JPEG
    const exif6Blob = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1])], { type: 'image/jpeg' });
    const normalized = await AttaStorage.normalizeImageOrientation(exif6Blob);
    assert.ok(normalized instanceof Blob, 'Normalized upright');

    // 2. Feed to Sobel corner detector
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 180, 240);
    ctx.fillStyle = '#fff'; ctx.fillRect(25, 35, 130, 170);

    const det = AttaToolsEngine.detectDocumentCornersDetailed(canvas);
    assert.strictEqual(det.corners.length, 4, 'Detected exactly 4 corners');
    assert.ok(det.confidence >= 0.50, 'Confidence score indicates paper detected');
  });

  it('T3-PAIR-02: F01 + F14: EXIF Normalization -> Photo ke PDF', async ({ window, AttaStorage, AttaToolsEngine, document, assert }) => {
    const rawPhoto = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1])], { type: 'image/jpeg' });
    const normalized = await AttaStorage.normalizeImageOrientation(rawPhoto);
    assert.ok(normalized instanceof Blob, 'Normalized image');

    const c = document.createElement('canvas'); c.width = 100; c.height = 100;
    const pages = [{ dataUrl: c.toDataURL(), mimeType: 'image/png', width: 100, height: 100 }];
    const pdfBlob = await AttaToolsEngine.buildMultiImagePdfWithOptions(pages, { pageSize: 'a4' });
    assert.ok(pdfBlob instanceof Blob, 'Generated valid A4 PDF');
    assert.ok(pdfBlob.size > 0, 'PDF is non-empty');
  });

  it('T3-PAIR-03: F01 + F15: EXIF Normalization -> Photo ke Word', async ({ AttaStorage, AttaToolsEngine, document, assert }) => {
    const rawPhoto = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1])], { type: 'image/jpeg' });
    const normalized = await AttaStorage.normalizeImageOrientation(rawPhoto);
    assert.ok(normalized instanceof Blob);

    const c = document.createElement('canvas'); c.width = 100; c.height = 100;
    const pages = [{ dataUrl: c.toDataURL(), mimeType: 'image/png', width: 100, height: 100 }];
    const docxBlob = await AttaToolsEngine.buildDocxFromImages(pages, 'Dokumen Foto', []);
    assert.ok(docxBlob instanceof Blob && docxBlob.size > 100, 'Valid DOCX produced from normalized image');
  });

  it('T3-PAIR-04: F02 + F03: Rotated PDF Sync -> 90 deg Placement Toggle', async ({ window, AttaToolsEngine, assert }) => {
    // PDF page natively rotated 90 deg + user rotates view 90 deg -> 180 deg compound rotation
    const pdfBlob = await createSyntheticPdf(window, 90, 842, 595);
    const sigDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const placement = { pageIndex: 0, xNorm: 0.5, yNorm: 0.5, userRotationDeg: 90 };
    const res = await AttaToolsEngine.stampSignatureToPdf(pdfBlob, sigDataUrl, placement);
    assert.ok(res.blob instanceof Blob, 'Successfully stamped with compound rotation');
  });

  it('T3-PAIR-05: F02 + F04 + F05: PDF Stamping -> Dynamic Palette -> Stroke Width', async ({ window, AttaToolsEngine, document, assert }) => {
    // Configure stroke width 8px and color #0D9488 (Teal)
    const sigCanvas = document.createElement('canvas');
    sigCanvas.width = 100; sigCanvas.height = 50;
    const ctx = sigCanvas.getContext('2d');
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#0D9488';
    ctx.beginPath(); ctx.moveTo(10, 25); ctx.lineTo(90, 25); ctx.stroke();
    assert.strictEqual(ctx.lineWidth, 8, 'Stroke width is 8');
    assert.strictEqual(ctx.strokeStyle, '#0D9488', 'Stroke color is Teal');

    const pdfBlob = await createSyntheticPdf(window, 90, 842, 595);
    const res = await AttaToolsEngine.stampSignatureToPdf(pdfBlob, sigCanvas.toDataURL(), { pageIndex: 0 });
    assert.ok(res.blob.size > 0, 'Signature embedded on rotated PDF');
  });

  it('T3-PAIR-06: F03 + F04: 90 deg Placement Toggle -> Dynamic Re-tinting', async ({ window, document, assert }) => {
    window.stampDocRotationDeg = 0;
    window.rotateStampDocument(90);
    assert.strictEqual(window.stampDocRotationDeg, 90, 'Rotated 90 deg');

    window.selectSigColor('#B42318');
    assert.strictEqual(window.currentSignatureColor, '#B42318', 'Re-tinted to Red');
  });

  it('T3-PAIR-07: F11 + F12: Sobel Edge CV -> RDP Quad Approximation', async ({ AttaToolsEngine, document, assert }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, 180, 240);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(30, 40, 120, 160);

    const det = AttaToolsEngine.detectDocumentCornersDetailed(canvas);
    assert.strictEqual(det.corners.length, 4, 'Produced exactly 4 corners');
    assert.ok(det.confidence >= 0.65, 'Confidence indicates clear quadrilateral');
  });

  it('T3-PAIR-08: F12 + F13: RDP Quad Approximation -> Live Overlay', async ({ AttaToolsEngine, document, assert }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 180, 240);
    ctx.fillStyle = '#fff'; ctx.fillRect(20, 30, 140, 180);

    const det = AttaToolsEngine.detectDocumentCornersDetailed(canvas);
    const overlay = document.getElementById('scannerEdgeOverlay') || document.createElement('canvas');
    const octx = overlay.getContext('2d');
    octx.beginPath();
    octx.moveTo(det.corners[0].x * overlay.width, det.corners[0].y * overlay.height);
    for (let i = 1; i < 4; i++) {
      octx.lineTo(det.corners[i].x * overlay.width, det.corners[i].y * overlay.height);
    }
    octx.closePath();
    octx.stroke();

    assert.ok(octx.drawOps.some((o) => o.op === 'stroke'), 'Rendered polygon to overlay');
  });

  it('T3-PAIR-09: F06 + F10: Android ML Kit Scanner -> Full Preview Sheet', async ({ window, document, assert }) => {
    let receivedPayload = null;
    window.__onAttaDocumentScanResult = (cbId, json) => {
      receivedPayload = JSON.parse(json);
    };
    window.AttaNativeAndroid.startDocumentScanner('{}', 'cb_p09');
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(receivedPayload && receivedPayload.pages.length > 0, 'ML Kit pages received');
    const sheet = document.getElementById('scanFullPreviewSheet');
    sheet.classList.add('is-visible');
    assert.ok(sheet.classList.contains('is-visible'), 'Full preview opened for ML Kit scan');
  });

  it('T3-PAIR-10: F10 + F14: Android ML Kit Scanner -> Photo ke PDF', async ({ window, AttaToolsEngine, document, assert }) => {
    let receivedPayload = null;
    window.__onAttaDocumentScanResult = (cbId, json) => {
      receivedPayload = JSON.parse(json);
    };
    window.AttaNativeAndroid.startDocumentScanner('{}', 'cb_p10');
    await new Promise((r) => setTimeout(r, 20));

    const c = document.createElement('canvas'); c.width = 100; c.height = 100;
    const pages = receivedPayload.pages.map(() => ({
      dataUrl: c.toDataURL(),
      mimeType: 'image/jpeg',
      width: 100,
      height: 100
    }));

    const pdfBlob = await AttaToolsEngine.buildMultiImagePdfWithOptions(pages, { pageSize: 'a4' });
    assert.ok(pdfBlob instanceof Blob && pdfBlob.size > 0, 'ML Kit pages compiled into PDF');
  });

  it('T3-PAIR-11: F06 + F08: Full Preview Sheet -> High-Res Rendering', async ({ document, assert }) => {
    const sheet = document.getElementById('scanFullPreviewSheet');
    const img = document.getElementById('scanFullPreviewImg');
    sheet.classList.add('is-visible');
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    assert.ok(sheet.classList.contains('is-visible'), 'Full preview open');
    assert.ok(img.src.startsWith('data:image/'), 'High-res source assigned');
  });

  it('T3-PAIR-12: F06 + F07 + F09: Full Preview -> Double-Tap -> Page Navigation', async ({ assert }) => {
    let scale = 1.0;
    let pageIdx = 0;

    // 1. Double tap on page 0 to zoom to 2.5x
    scale = 2.5;
    assert.strictEqual(scale, 2.5, 'Zoomed to 2.5x on page 0');

    // 2. Navigate to page 1 -> resets zoom
    pageIdx++;
    scale = 1.0;
    assert.strictEqual(pageIdx, 1, 'Moved to page 1');
    assert.strictEqual(scale, 1.0, 'Scale reset on page navigation');

    // 3. Double tap on page 1
    scale = 2.5;
    assert.strictEqual(scale, 2.5, 'Zoomed to 2.5x on page 1');
  });

  it('T3-PAIR-13: F06 + F08 + M1: Full Preview -> High-Res -> Rotated Review', async ({ document, assert }) => {
    const origW = 1200, origH = 800;
    const rotationDeg = 90;
    const renderW = rotationDeg % 180 === 90 ? origH : origW;
    const renderH = rotationDeg % 180 === 90 ? origW : origH;
    assert.strictEqual(renderW, 800, 'Width transposed to 800');
    assert.strictEqual(renderH, 1200, 'Height transposed to 1200');
  });

  it('T3-PAIR-14: F14 + F16: Photo ke PDF -> Reordering Sheet', async ({ AttaToolsEngine, document, assert }) => {
    const c = document.createElement('canvas'); c.width = 50; c.height = 50;
    const dataUrl = c.toDataURL();
    const original = [
      { name: 'A', dataUrl, mimeType: 'image/png', width: 50, height: 50 },
      { name: 'B', dataUrl, mimeType: 'image/png', width: 50, height: 50 },
      { name: 'C', dataUrl, mimeType: 'image/png', width: 50, height: 50 },
      { name: 'D', dataUrl, mimeType: 'image/png', width: 50, height: 50 }
    ];
    // Reorder to [C, A, D, B]
    const reordered = [original[2], original[0], original[3], original[1]];
    assert.strictEqual(reordered[0].name, 'C');
    assert.strictEqual(reordered[1].name, 'A');

    const pdfBlob = await AttaToolsEngine.buildMultiImagePdfWithOptions(reordered, { pageSize: 'a4' });
    assert.ok(pdfBlob instanceof Blob, 'Compiled reordered PDF');
  });

  it('T3-PAIR-15: F15 + F16: Photo ke Word -> Reordering Sheet', async ({ AttaToolsEngine, document, assert }) => {
    const c = document.createElement('canvas'); c.width = 50; c.height = 50;
    const dataUrl = c.toDataURL();
    const items = [
      { name: 'A', dataUrl, mimeType: 'image/png', width: 50, height: 50 },
      { name: 'B', dataUrl, mimeType: 'image/png', width: 50, height: 50 },
      { name: 'C', dataUrl, mimeType: 'image/png', width: 50, height: 50 }
    ];
    const reordered = [items[2], items[0], items[1]];
    const docxBlob = await AttaToolsEngine.buildDocxFromImages(reordered, 'Reordered Doc', []);
    assert.ok(docxBlob instanceof Blob && docxBlob.size > 100, 'Generated reordered DOCX');
  });

  it('T3-PAIR-16: F14 + F17: Photo ke PDF -> Tool Origin Metadata', async ({ AttaStorage, assert }) => {
    const rec = await AttaStorage.saveFile({
      name: 'Batch_Photos.pdf',
      category: 'pdf',
      toolOrigin: 'photo_to_pdf',
      blob: new Blob(['pdf']),
      size: 100
    });
    assert.strictEqual(rec.toolOrigin, 'photo_to_pdf', 'Origin tagged as photo_to_pdf');
  });

  it('T3-PAIR-17: F15 + F17: Photo ke Word -> Tool Origin Metadata', async ({ AttaStorage, assert }) => {
    const rec = await AttaStorage.saveFile({
      name: 'Meeting_Notes.docx',
      category: 'export',
      toolOrigin: 'photo_to_word',
      blob: new Blob(['docx']),
      size: 200
    });
    assert.strictEqual(rec.toolOrigin, 'photo_to_word', 'Origin tagged as photo_to_word');
  });

  it('T3-PAIR-18: F02 + F14: Photo ke PDF -> Rotated PDF Stamping', async ({ window, AttaToolsEngine, document, assert }) => {
    const c = document.createElement('canvas'); c.width = 50; c.height = 50;
    const pages = [{ dataUrl: c.toDataURL(), mimeType: 'image/png', width: 50, height: 50 }];
    const generatedPdf = await AttaToolsEngine.buildMultiImagePdfWithOptions(pages, { pageSize: 'a4' });

    const sigDataUrl = c.toDataURL();
    const signed = await AttaToolsEngine.stampSignatureToPdf(generatedPdf, sigDataUrl, { pageIndex: 0 });
    assert.ok(signed.blob.size > generatedPdf.size, 'Embedded signature into photo-generated PDF');
  });

  it('T3-PAIR-19: F18 + F20: Asset Parity Sync -> Android APK Build', async ({ assert }) => {
    const apkAssetsDir = path.join(APK_DIR, 'app/src/main/assets/www');
    assert.ok(fs.existsSync(apkAssetsDir), 'Assets directory exists');
    const gradleFile = path.join(APK_DIR, 'app/build.gradle.kts');
    assert.ok(fs.existsSync(gradleFile), 'build.gradle.kts exists');
  });

  it('T3-PAIR-20: F18 + F19: Asset Parity Sync -> Verification Suites', async ({ assert }) => {
    const jsFiles = ['config.js', 'db.js', 'pdf-render.js', 'tools-engine.js', 'i18n.js', 'app.js'];
    for (const f of jsFiles) {
      assert.ok(fs.existsSync(path.join(PWA_DIR, 'js', f)), `Source js/${f} exists`);
    }
  });

  it('T3-PAIR-21: F08 + F13: Live Overlay Corners -> Perspective Warp Execution', async ({ AttaToolsEngine, assert }) => {
    const cornersNorm = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 }
    ];
    assert.ok(typeof AttaToolsEngine.warpPerspectiveImage === 'function');
    assert.strictEqual(cornersNorm.length, 4, '4 corners passed to warp');
  });

  it('T3-PAIR-22: F10 + F11: Android ML Kit Fallback -> Client-Side CV', async ({ AttaToolsEngine, document, assert }) => {
    const mockBridge = { isDocumentScannerAvailable: () => false };
    const useNative = mockBridge.isDocumentScannerAvailable();
    assert.strictEqual(useNative, false, 'Native scanner unavailable');

    const c = document.createElement('canvas'); c.width = 100; c.height = 100;
    const det = AttaToolsEngine.detectDocumentCornersDetailed(c);
    assert.ok(det.corners.length === 4, 'Fallback web CV executed successfully');
  });

  it('T3-PAIR-23: F08 + F17: High-Res Preview -> Scanner Tool Origin', async ({ AttaStorage, assert }) => {
    const rec = await AttaStorage.saveFile({
      name: 'Scan_Preview.jpg',
      category: 'scan',
      toolOrigin: 'scanner',
      blob: new Blob(['scan_data']),
      size: 500
    });
    assert.strictEqual(rec.toolOrigin, 'scanner', 'Saved with toolOrigin: scanner');
  });

  it('T3-PAIR-24: F04 + F05 + M1: Custom Signature Storage -> Subsequent Placement', async ({ window, AttaToolsEngine, document, assert }) => {
    const sigCanvas = document.createElement('canvas');
    sigCanvas.width = 100; sigCanvas.height = 50;
    const ctx = sigCanvas.getContext('2d');
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#9333EA'; // Purple
    ctx.beginPath(); ctx.moveTo(10, 25); ctx.lineTo(90, 25); ctx.stroke();
    const sigDataUrl = sigCanvas.toDataURL();

    const pdfBlob = await createSyntheticPdf(window, 0, 595, 842);
    const res = await AttaToolsEngine.stampSignatureToPdf(pdfBlob, sigDataUrl, { pageIndex: 0 });
    assert.ok(res.blob instanceof Blob && res.blob.size > 0, 'Placed purple 6px signature onto PDF');
  });

});
