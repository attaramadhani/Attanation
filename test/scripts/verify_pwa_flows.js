const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pwaDir = process.env.PWA_DIR || path.resolve(__dirname, '../../pwa-docstudio-pro');
const html = fs.readFileSync(path.join(pwaDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(pwaDir, 'css/app.css'), 'utf8');
const jsFiles = ['config.js', 'pdf-render.js', 'db.js', 'tools-engine.js', 'i18n.js', 'account.js', 'settings.js', 'app.js'];

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    console.log('PASS:', label);
    passed++;
  } else {
    console.error('FAIL:', label);
    failed++;
  }
}

// 1. Check DESIGN.md §8 required global functions
const allJs = jsFiles.map((f) => fs.readFileSync(path.join(pwaDir, 'js', f), 'utf8')).join('\n');
const requiredFns = [
  'switchTab', 'renderFileVault', 'filterVaultByCategory', 'openFileActionSheet',
  'previewItem', 'saveItemToPhone', 'removeItem', 'openRenameSheet', 'confirmRenameItem',
  'openPinLockSheet', 'confirmPinLockAction', 'selectScannerFilter', 'handleCameraOrGalleryInput',
  'openInteractivePerspectiveCropForFile', 'applyPerspectiveCropAndSave',
  'handleMergePdfsTool', 'openCompressTargetSheet', 'selectCompressLimit', 'handleCompressToTargetTool',
  'openWatermarkSheet', 'confirmWatermarkTextAndPick', 'handleWatermarkPdfTool', 'openPageToolSheet',
  'executePageToolOnFileObject', 'openIdCardStitchSheet', 'handleIdCardStitchInput',
  'triggerOfficeToPdfPicker', 'handleOfficeToPdfInput', 'openPdfExportFormatSheet',
  'executePdfExportOnBlob', 'openRepairPdfSheet', 'executeRepairOnFileObject',
  'openComparePdfSheet', 'handleComparePdfInput', 'openAnalyzeDocSheet',
  'runDocumentAnalysisOnBlob', 'copyAnalysisResultText', 'saveAnalysisResultToVault',
  'initSignatureCanvas', 'clearSignatureCanvas', 'saveSignatureToVault',
  'openStampSignToPdfSheet', 'executeStampSignatureOnPdfBlob',
  'triggerExportBackupZip', 'triggerRestorePicker', 'triggerImportRestoreFile',
  'checkServerVersionAndUpdate', 'applyServiceWorkerUpdateNow',
  'triggerAndroidInstall', 'openInstallGuideModal', 'closeInstallGuideModal', 'verifyLicenseInPwa', 'showToast'
];
const missingFns = requiredFns.filter((fn) => !new RegExp(`function\\s+${fn}\\b|window\\.${fn}\\s*=`).test(allJs));
assert(missingFns.length === 0, `All ${requiredFns.length} DESIGN.md §8 + new functions defined (missing: ${missingFns.join(', ')})`);

// 2. Check DESIGN.md §9 anti-slop rules: zero emojis in HTML, CSS, JS
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert(!emojiRegex.test(html), 'Zero emojis in index.html');
assert(!emojiRegex.test(css), 'Zero emojis in css/app.css');
assert(!emojiRegex.test(allJs), 'Zero emojis in js/*.js');

// 3. Load i18n.js + tools-engine.js in VM to test AI summary, consent gate, and PDF text extraction
const sandbox = {
  window: {},
  localStorage: { getItem: () => 'id', setItem: () => {} },
  document: {
    documentElement: { setAttribute: () => {} },
    body: {},
    addEventListener: () => {},
    querySelectorAll: () => [],
    createElement: () => ({})
  },
  MutationObserver: function() { return { observe: () => {} }; },
  NodeFilter: { SHOW_TEXT: 4 },
  fetch: async () => {
    throw new Error('EXTERNAL_FETCH_CALLED');
  },
  Blob,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout,
  Uint8Array,
  ArrayBuffer,
  Set,
  Map,
  WeakMap,
  console
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(pwaDir, 'js/i18n.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(pwaDir, 'js/tools-engine.js'), 'utf8'), sandbox);

(async () => {
  const engine = sandbox.window.AttaToolsEngine;

  // Test 3a: extractTextFromPdfBlob on scanned PDF (0 text streams) returns '' instead of fake 3-line placeholder
  const dummyScannedPdf = {
    size: 20480,
    arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF').buffer
  };
  const extractedEmpty = await engine.extractTextFromPdfBlob(dummyScannedPdf, 'Scan_KTP.pdf');
  assert(extractedEmpty === '', `extractTextFromPdfBlob returns '' on scanned PDF (got: ${JSON.stringify(extractedEmpty)})`);

  // Test 3b: analyzeDocumentLocally & summarizeTextLocally on Indonesian official letter/invoice
  const sampleLetter = [
    'PT NUSANTARA TEKNOLOGI MANDIRI',
    'Jl. Jend. Sudirman Kav. 21, Jakarta Selatan',
    'Telp: 081234567890 | Email: finance@nusantara.co.id',
    'Nomor: INV/2026/11/0482',
    'Perihal: Tagihan Layanan Pemeliharaan Sistem Bulan November 2026',
    'Tanggal: 10 November 2026',
    'NPWP: 01.234.567.8-901.000',
    'Dengan hormat,',
    'Bersama surat ini kami menyatakan bahwa total tagihan layanan sebesar Rp 14.500.000,00 wajib diselesaikan sebelum tanggal 25/11/2026.',
    'Pembayaran dapat ditransfer ke rekening resmi perusahaan.'
  ].join('\n');

  const analysis = engine.analyzeDocumentLocally(sampleLetter);
  assert(analysis.docNumbers.includes('INV/2026/11/0482'), `Detected document number: ${analysis.docNumbers.join(', ')}`);
  assert(analysis.subject.includes('Tagihan Layanan'), `Detected subject: ${analysis.subject}`);
  assert(analysis.npwps.includes('01.234.567.8-901.000'), `Detected NPWP: ${analysis.npwps.join(', ')}`);
  assert(analysis.amounts.length === 1 && analysis.amounts[0].includes('14.500.000'), `Detected amount: ${analysis.amounts.join(', ')}`);

  const summary = engine.summarizeTextLocally(sampleLetter);
  assert(summary.includes('Perihal / Subjek:'), 'Summary includes Perihal / Subjek');
  assert(summary.includes('Nomor Dokumen: INV/2026/11/0482'), 'Summary includes Nomor Dokumen');
  assert(!summary.includes('- Jl. Jend. Sudirman'), 'Summary skips address header boilerplate in favor of informative sentences');
  assert(summary.includes('total tagihan layanan sebesar Rp 14.500.000,00'), 'Summary picks high-salience sentence with discourse marker and amount');

  // Test 3c: Consent gate in processWithGeminiOrLocal
  // Even when apiKey is non-empty, if allowExternal is false, fetch MUST NOT be called!
  const localRes = await engine.processWithGeminiOrLocal({
    text: sampleLetter,
    mode: 'summarize',
    apiKey: 'AIzaSyDummyKeyThatShouldNotBeUsedWithoutConsent',
    allowExternal: false
  });
  assert(engine.lastAnalysisMeta.source === 'local', 'processWithGeminiOrLocal stays 100% local when allowExternal=false');
  assert(localRes.includes('Kategori Terdeteksi'), 'processWithGeminiOrLocal returns local summary when allowExternal=false');

  const translateBlocked = await engine.processWithGeminiOrLocal({
    text: sampleLetter,
    mode: 'translate',
    apiKey: 'AIzaSyDummyKeyThatShouldNotBeUsedWithoutConsent',
    allowExternal: false
  });
  assert(translateBlocked.includes('Centang persetujuan'), 'Translate mode prompts for explicit consent when allowExternal=false');

  // 4. Test db.js v2 catalog: 7 filters & 19 toolOrigin buckets
  function FakeDexie() {
    this.version = () => ({ stores: () => ({ upgrade: () => ({}) }) });
  }
  sandbox.Dexie = FakeDexie;
  sandbox.navigator = { language: 'id-ID' };
  vm.runInContext(fs.readFileSync(path.join(pwaDir, 'js/db.js'), 'utf8'), sandbox);
  const storage = sandbox.window.AttaStorage;
  assert(Array.isArray(storage.FILTER_CATALOG) && storage.FILTER_CATALOG.length === 7, 'db.js exports 7 document filters');
  const filterIds = storage.FILTER_CATALOG.map((x) => x.id).join(',');
  assert(
    filterIds === 'original,enhance,noshadow,magic,lighten,bw,gray',
    `All 7 filter IDs match expected order (${filterIds})`
  );
  assert(storage.inferToolOrigin({ filterUsed: 'Warna Ajaib', category: 'scan' }) === 'scanner', 'inferToolOrigin maps scanner');
  assert(storage.inferToolOrigin({ filterUsed: 'Gabung PDF', category: 'pdf' }) === 'merge', 'inferToolOrigin maps merge');
  assert(storage.inferToolOrigin({ filterUsed: 'Tanda tangan PDF', category: 'signed' }) === 'sign', 'inferToolOrigin maps sign');
  assert(storage.inferToolOrigin({ filterUsed: 'Luruskan 4 sudut', category: 'scan' }) === 'crop_4corner', 'inferToolOrigin maps crop_4corner');
  assert(storage.inferToolOrigin({ filterUsed: 'Bandingkan PDF', category: 'export' }) === 'compare', 'inferToolOrigin maps compare');

  // Test 5: DOCX builders (text & OCR) + JSZip packaging
  if (fs.existsSync(path.join(pwaDir, 'js/vendor/jszip.min.js'))) {
    vm.runInContext(fs.readFileSync(path.join(pwaDir, 'js/vendor/jszip.min.js'), 'utf8'), sandbox);
    const docxBlob = await engine.buildDocxBlob(sampleLetter, 'Surat Tagihan');
    assert(docxBlob && docxBlob.size > 100, `buildDocxBlob produces valid non-empty blob (${docxBlob?.size} bytes)`);
    const docxImgsBlob = await engine.buildDocxFromImages([], 'Scan Kosong', ['Teks halaman 1']);
    assert(docxImgsBlob && docxImgsBlob.size > 100, `buildDocxFromImages produces valid DOCX (${docxImgsBlob?.size} bytes)`);
  }

  // Test 6: All new interactive v1.0.0 functions present + auto corner detector + multi-lock/recovery
  const v1Fns = [
    'openScanReviewStage', 'applyReviewFilterChoice', 'commitScanReviewSession',
    'openToolResultSheet', 'triggerNextToolFromResult', 'openToolHistoryHubSheet',
    'openToolHistorySheet', 'initStampInteractiveStage', 'commitInteractiveSignatureStamp',
    'setRedactTouchMode', 'saveCompareReportToVault', 'selectAppLockMethod', 'autoDetectCropCorners',
    'openRecoverySetupSheet', 'confirmRecoverySetup', 'openForgotPinSheet',
    'recoverViaDeviceOrBiometric', 'recoverViaSecurityQuestion', 'recoverViaRecoveryCode',
    'recoverViaAttaAccount', 'removeSecondAppLock'
  ];
  const missingV1Fns = v1Fns.filter((fn) => !new RegExp(`function\\s+${fn}\\b|window\\.${fn}\\s*=`).test(allJs));
  assert(missingV1Fns.length === 0, `All ${v1Fns.length} new v1.0.0 interactive functions defined (missing: ${missingV1Fns.join(', ')})`);

  // Test 7: Auto 4-corner quadrilateral detector on synthetic bright page over dark desk
  const origDocCreate = sandbox.document.createElement;
  const mockW = 180, mockH = 240;
  const mockBuf = new Uint8ClampedArray(mockW * mockH * 4);
  for (let y = 0; y < mockH; y++) {
    for (let x = 0; x < mockW; x++) {
      const idx = (y * mockW + x) * 4;
      const inPaper = x >= 27 && x <= 153 && y >= 36 && y <= 204;
      const v = inPaper ? 245 : 75;
      mockBuf[idx] = v; mockBuf[idx + 1] = v; mockBuf[idx + 2] = v; mockBuf[idx + 3] = 255;
    }
  }
  sandbox.document.createElement = () => ({
    width: mockW,
    height: mockH,
    getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: mockBuf }) })
  });
  const det = engine.detectDocumentCornersDetailed({ naturalWidth: mockW, naturalHeight: mockH });
  sandbox.document.createElement = origDocCreate;
  assert(det && det.confidence >= 0.45 && det.corners.length === 4, `Auto corner detector detects paper quad (confidence=${det?.confidence?.toFixed(2)})`);
  assert(det.corners[0].x > 0.10 && det.corners[0].x < 0.22 && det.corners[2].x > 0.78 && det.corners[2].x < 0.90, `Detected corners align with synthetic paper bounds (TL.x=${det.corners[0].x}, BR.x=${det.corners[2].x})`);

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
