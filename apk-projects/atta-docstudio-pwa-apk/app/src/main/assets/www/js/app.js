/**
 * ATTA DocStudio Pro — Versi 3+: "Kertas dan Tinta"
 * Produk dari ATTA NATION
 * Sumber kebenaran tampilan & kontrak DOM: DESIGN.md
 */

const APP_CURRENT_VERSION = '1.0.0';
// File statis di folder aplikasi; ubah isinya setiap merilis versi baru
const VERSION_CHECK_ENDPOINT = './version.json';

let currentTab = 'vault';
let previousNonScannerTab = 'vault';
let currentVaultFilter = 'all';
let currentVaultToolOrigin = null;
let currentScanFilter = 'magic';
let currentScanMode = 'standard'; // 'standard' | 'idcard' | 'perspective'
let currentScannerFlowMode = 'single'; // 'single' | 'batch' | 'idcard'
let deferredInstallPrompt = null;
let waitingServiceWorker = null;

// State tanda tangan & editor penempatan TTD interaktif
let sigCanvas = null;
let sigCtx = null;
let isDrawingSig = false;
let hasSignatureStroke = false;
let currentSigColor = '#2445C9';
window.currentSignatureColor = '#2445C9';
let currentSigWidth = 2.6;
let customColorTarget = 'draw';
let customColorSelectedHex = '#2445C9';

// State lembar aksi, hasil alat, & riwayat per alat
let activeSheetItemId = null;
let activePreviewObjectUrl = null;
let pendingCompressTargetKB = 200;
let pendingWatermarkText = 'SALINAN VERIFIKASI';
let activePageToolType = 'split'; // 'split' | 'remove' | 'organize' | 'pagenum' | 'crop' | 'redact'
let pendingPdfExportFormat = 'doc';
let pendingStampVaultItemId = null;
let currentToolResultItem = null;
let activeToolHistoryOrigin = null;
let lastCompareReportText = '';
let redactTouchMode = 'draw'; // 'draw' | 'pan'

// Sesi pemindaian 2 tahap: Tahap 1 kumpul foto ke scanSessionPages (+ draft IndexedDB), Tahap 2 tinjau/filter/ekspor
let scanSessionPages = [];
let scanReviewActiveIdx = 0;
let isCapturingShutter = false;
let scannerStream = null;
let scannerCloseArmed = false;
let currentScanModeLabel = 'Mode dokumen';
let scanProcessingCount = 0;
let lastScannedItemId = null;
let scannerFlashOn = false;

// State interaktif 4 sudut perspektif
let cropSourceImage = null;
let cropSourceFileName = 'Scan Dokumen';
let cropReturnToScanReview = false;
let cropOpenReviewAfterSave = false;
let cropAutoPaperEnabled = true;
let cropCornersNorm = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 }
];
let cropRotationDeg = 0;
let draggingCornerIdx = -1; // 0..3 sudut, 4..7 sisi tengah (adaptasi SmartScanner)

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/* ============================================================================
 * 1. INISIALISASI APLIKASI, SERVICE WORKER & PENYIMPANAN LOKAL
 * ============================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initStorageAndPersistence();
    await removeLegacySampleDocs();
    await backfillPdfPageCounts();
    await migrateLegacyPinLocks();
    await bootSettingsAndLock();
    await renderFileVault();
  } catch (err) {
    console.error('Gagal memulai aplikasi:', err);
  } finally {
    hideSplash();
  }
  backfillPdfThumbnails();
  initSignatureCanvas();
  initStampInteractiveStage();
  initCropInteractiveCanvas();
  initRedactCanvas();
  initModalDismissHandlers();
  handleLaunchActionParam();
  registerServiceWorkerWithAutoUpdate();
  setupInstallPromptListener();
  restoreScanDraftIfAny();

  setTimeout(() => {
    checkServerVersionAndUpdate(true);
  }, 3000);
});

function getTopmostOpenSheet() {
  const openSheets = Array.from(document.querySelectorAll('.sheet-backdrop.show'));
  if (openSheets.length === 0) return null;
  openSheets.sort((a, b) => {
    const za = parseInt(window.getComputedStyle(a).zIndex || '120', 10) || 120;
    const zb = parseInt(window.getComputedStyle(b).zIndex || '120', 10) || 120;
    return za - zb;
  });
  return openSheets[openSheets.length - 1];
}

window.handleNativeBackPressed = function () {
  const topSheet = getTopmostOpenSheet();
  if (topSheet) {
    dismissBackdropElement(topSheet);
    return true;
  }
  if (currentTab === 'scanner') {
    closeScannerView();
    return true;
  }
  if (currentTab === 'settings') {
    closeSettingsView();
    return true;
  }
  return false;
};

function handleLaunchActionParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'scan') {
      switchTab('scanner');
    } else if (action === 'tools') {
      switchTab('tools');
    }
  } catch (_) {}
}

function initModalDismissHandlers() {
  document.querySelectorAll('.sheet-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target !== backdrop) return;
      dismissBackdropElement(backdrop);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const topSheet = getTopmostOpenSheet();
    if (!topSheet) return;
    e.preventDefault();
    dismissBackdropElement(topSheet);
  });
}

function dismissBackdropElement(backdrop) {
  if (!backdrop) return;
  if (backdrop.id === 'pinLockSheet') {
    closePinLockSheet();
  } else if (backdrop.id === 'previewSheet') {
    closePreviewSheet();
  } else if (backdrop.id === 'redactEditorSheet') {
    closeRedactEditor();
  } else if (backdrop.id === 'scanReviewSheet') {
    closeScanReviewSheet();
  } else if (backdrop.id === 'toolResultSheet') {
    closeToolResultSheet();
  } else if (backdrop.id === 'toolHistoryHubSheet') {
    closeToolHistoryHubSheet();
  } else if (backdrop.id === 'toolHistorySheet') {
    closeToolHistorySheet();
  } else if (backdrop.id === 'stampSignSheet') {
    closeStampSignToPdfSheet();
  } else if (backdrop.id === 'customColorSheet') {
    closeCustomColorSheet();
  } else if (backdrop.id === 'appPinSetupSheet') {
    cancelAppPinSetup();
  } else if (backdrop.id === 'forgotLockSheet') {
    closeForgotLockSheet();
  } else {
    backdrop.classList.remove('show');
  }
}

async function initStorageAndPersistence() {
  const versionRow = document.getElementById('appVersionRowTitle');
  if (versionRow) versionRow.textContent = `Versi ${APP_CURRENT_VERSION}`;
  await AttaStorage.initPersistence();
  await refreshStorageMeterUI();
  await refreshToolHistoryCounts();
  hideInstallRowIfInstalled();
  const savedGeminiKey = await AttaStorage.getSetting('gemini_api_key', '');
  const geminiInput = document.getElementById('geminiApiKeyInput');
  if (geminiInput && savedGeminiKey) {
    geminiInput.value = savedGeminiKey;
  }
}

/**
 * Versi sebelumnya sempat menaruh 4 dokumen contoh ke penyimpanan pengguna.
 * Fungsi ini menghapusnya sekali saja, tanpa menyentuh berkas milik pengguna.
 */
async function removeLegacySampleDocs() {
  try {
    const done = await AttaStorage.getSetting('legacy_samples_removed', false);
    if (done) return;
    const seeded = await db.files.filter((f) => typeof f.uuid === 'string' && f.uuid.startsWith('atta-seed-')).toArray();
    for (const item of seeded) {
      await AttaStorage.deleteFileById(item.id);
    }
    await AttaStorage.setSetting('legacy_samples_removed', true);
  } catch (err) {
    console.warn('Pembersihan dokumen contoh dilewati:', err);
  }
}

/**
 * Hitung ulang jumlah halaman PDF lama yang tercatat "1 halaman" tanpa dibaca.
 */
async function backfillPdfPageCounts() {
  try {
    const done = await AttaStorage.getSetting('pagecount_backfilled', false);
    if (done || !window.PDFLib) return;
    const pdfs = await db.files.filter((f) => f.mimeType === 'application/pdf' && !f.pageCount && f.blob).toArray();
    for (const item of pdfs) {
      const count = await AttaStorage.countPdfPages(item.blob);
      if (count) {
        const notes = /^\d+ halaman$/i.test(item.notes || '') || !item.notes ? `${count} halaman` : item.notes;
        await db.files.update(item.id, { pageCount: count, notes });
      }
    }
    await AttaStorage.setSetting('pagecount_backfilled', true);
  } catch (err) {
    console.warn('Hitung ulang halaman dilewati:', err);
  }
}

/** Versi lama menyimpan PIN apa adanya. Ubah jadi enkripsi sungguhan, lalu hapus PIN-nya. */
async function migrateLegacyPinLocks() {
  try {
    const pinMap = (await AttaStorage.getSetting('locked_file_pins', null)) || null;
    if (!pinMap || !Object.keys(pinMap).length) return;
    for (const [id, pin] of Object.entries(pinMap)) {
      const item = await AttaStorage.getFileById(id);
      if (item && !item.encrypted) {
        await AttaStorage.lockFile(item.id, String(pin));
        await db.files.update(item.id, { notes: '' });
      }
    }
    await db.settings.delete('locked_file_pins');
  } catch (err) {
    console.warn('Migrasi kunci PIN lama dilewati:', err);
  }
}

/** Buat thumbnail halaman asli untuk PDF lama yang belum punya (berjalan di belakang) */
async function backfillPdfThumbnails() {
  try {
    const pdfs = await db.files
      .filter((f) => f.mimeType === 'application/pdf' && !f.thumbnailDataUrl && f.blob && !f.encrypted)
      .toArray();
    if (!pdfs.length) return;
    await AttaPdfRender.ready();
    for (const item of pdfs) {
      try {
        const thumb = await AttaPdfRender.firstPageThumb(item.blob);
        await db.files.update(item.id, { thumbnailDataUrl: thumb });
      } catch (_) {}
    }
    renderFileVault();
  } catch (err) {
    console.warn('Thumbnail PDF lama dilewati:', err);
  }
}

/* ============================================================================
 * 2. PEMFORMATAN ANGKA, UKURAN & WAKTU BAHASA INDONESIA
 * ============================================================================ */
function formatSizeId(bytes) {
  const num = Number(bytes) || 0;
  if (num < 1024) return `${num} B`;
  const kb = num / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} KB`;
  }
  const mbRaw = (kb / 1024).toFixed(1);
  const mb = currentLang === 'en' ? mbRaw : mbRaw.replace('.', ',');
  return `${mb} MB`;
}

function formatRelativeTimeId(isoString) {
  if (!isoString) return 'baru saja';
  const date = new Date(isoString);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 90) return 'baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'kemarin';
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return `${MONTH_NAMES_ID[date.getMonth()]} ${date.getFullYear()}`;
}

function getTimeGroupLabel(isoString) {
  if (!isoString) return 'Hari ini';
  const date = new Date(isoString);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) return 'Hari ini';

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays < 7) {
    return 'Minggu ini';
  }

  const monthName = MONTH_NAMES_ID[date.getMonth()] || 'Bulan lalu';
  if (date.getFullYear() !== now.getFullYear()) {
    return `${monthName} ${date.getFullYear()}`;
  }
  return monthName;
}

async function refreshStorageMeterUI() {
  const stats = await AttaStorage.getStorageStats();
  const lastBackupIso = await AttaStorage.getSetting('last_backup_at', null);

  const usedLabel = formatSizeId(stats.appUsedBytes);
  const usedTextEl = document.getElementById('storageUsedText');
  const countTextEl = document.getElementById('storageCountText');
  const vaultLeadEl = document.getElementById('vaultLeadText');
  const persistLabelEl = document.getElementById('persistStatusLabel');
  const persistBadgeEl = document.getElementById('persistStatusBadge');
  const barFillEl = document.getElementById('storageBarFill');

  if (usedTextEl) {
    usedTextEl.textContent = usedLabel;
  }

  let backupPhrase = 'Belum pernah dicadangkan.';
  if (lastBackupIso) {
    backupPhrase = `Terakhir dicadangkan ${formatRelativeTimeId(lastBackupIso)}.`;
  }

  if (countTextEl) {
    countTextEl.textContent = `${stats.fileCount} berkas tersimpan di HP ini. ${backupPhrase}`;
  }

  if (vaultLeadEl) {
    if (stats.fileCount === 0) {
      vaultLeadEl.textContent = 'Semua dokumen tersimpan di HP ini.';
    } else {
      vaultLeadEl.textContent = `${stats.fileCount} berkas, ${usedLabel}. Semuanya ada di HP ini.`;
    }
  }

  if (persistLabelEl) {
    persistLabelEl.textContent = 'Siap dipakai offline';
  }

  if (persistBadgeEl) {
    persistBadgeEl.textContent = stats.persisted ? 'Permanen' : 'Lokal';
  }

  if (barFillEl) {
    barFillEl.setAttribute('data-percent', stats.percentUsed);
  }
}

/* ============================================================================
 * 3. NAVIGASI TAB UTAMA, SUB-TAB ALAT PDF & OVERLAY PENCARIAN
 * ============================================================================ */
function switchTab(tabId) {
  if (tabId === 'settings') openSettingsView();
  if (tabId !== 'scanner') {
    previousNonScannerTab = tabId;
  }
  currentTab = tabId;

  // Pindah tab selalu menutup lembar bawah yang masih terbuka
  document.querySelectorAll('.sheet-backdrop.show').forEach((el) => {
    if (el.id === 'pinLockSheet') closePinLockSheet();
    else el.classList.remove('show');
  });

  const shell = document.getElementById('appShell');
  const bottomNav = document.getElementById('bottomNav');

  document.querySelectorAll('.tab-view').forEach((sec) => {
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`view-${tabId}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  document.querySelectorAll('.bnav-btn').forEach((btn) => {
    const isMatch = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isMatch);
  });

  if (tabId === 'scanner') {
    if (shell) shell.classList.add('scanner-mode');
    if (bottomNav) bottomNav.classList.add('is-hidden');
    updateScannerHeaderCount();
    startScannerCamera();
  } else {
    if (shell) shell.classList.remove('scanner-mode');
    // Pengaturan adalah halaman turunan: tanpa navigasi bawah
    if (bottomNav) bottomNav.classList.toggle('is-hidden', tabId === 'settings');
    stopScannerCamera();
  }

  if (tabId === 'vault') {
    renderFileVault();
  } else if (tabId === 'tools') {
    refreshToolHistoryCounts();
    setTimeout(resizeSignatureCanvas, 50);
  } else if (tabId === 'backup') {
    refreshStorageMeterUI();
  }

  window.scrollTo({ top: 0, behavior: 'auto' });
}

function switchToolsSubtab(subId, btnEl) {
  document.querySelectorAll('#view-tools .tools-tabs .tab-btn').forEach((b) => {
    b.setAttribute('aria-selected', 'false');
  });
  if (btnEl) {
    btnEl.setAttribute('aria-selected', 'true');
  }

  document.querySelectorAll('#view-tools .tool-subview').forEach((v) => {
    v.classList.remove('active');
  });
  const target = document.getElementById(`tools-sub-${subId}`);
  if (target) {
    target.classList.add('active');
  }
  if (subId === 'utama') {
    setTimeout(resizeSignatureCanvas, 40);
  }
}

function closeScannerView() {
  if (scanSessionPages.length > 0 && !scannerCloseArmed) {
    scannerCloseArmed = true;
    showToast(`${scanSessionPages.length} halaman belum disimpan. Tutup lagi untuk membuang.`);
    return;
  }
  scanSessionPages = [];
  scannerCloseArmed = false;
  AttaStorage.clearScanDraftPages().catch(() => {});
  updateScannerHeaderCount();
  switchTab(previousNonScannerTab || 'vault');
}

function openVaultSearch() {
  const defaultHead = document.getElementById('vaultHeaderDefault');
  const searchBar = document.getElementById('vaultSearchBar');
  const searchInput = document.getElementById('vaultSearchInput');

  if (defaultHead) defaultHead.classList.add('is-hidden');
  if (searchBar) searchBar.classList.remove('is-hidden');
  if (searchInput) searchInput.focus();
}

function closeVaultSearch() {
  const defaultHead = document.getElementById('vaultHeaderDefault');
  const searchBar = document.getElementById('vaultSearchBar');
  const searchInput = document.getElementById('vaultSearchInput');

  if (searchInput) searchInput.value = '';
  if (searchBar) searchBar.classList.add('is-hidden');
  if (defaultHead) defaultHead.classList.remove('is-hidden');
  renderFileVault();
}

/* ============================================================================
 * 4. LAYAR 1: DOKUMEN (TUMPUKAN TERBARU, TIRUAN KERTAS & DAFTAR BERKAS)
 * ============================================================================ */
function filterVaultByCategory(cat, btnEl) {
  currentVaultFilter = cat;
  document.querySelectorAll('#view-vault .tabs .tab-btn').forEach((b) => {
    b.setAttribute('aria-selected', 'false');
  });
  if (btnEl) {
    btnEl.setAttribute('aria-selected', 'true');
  }
  renderFileVault();
}

function filterVaultByToolOrigin(origin) {
  currentVaultToolOrigin = origin || null;
  currentVaultFilter = 'all';
  document.querySelectorAll('#view-vault .tabs .tab-btn').forEach((b) => {
    b.setAttribute('aria-selected', String(b.getAttribute('data-cat') === 'all'));
  });
  renderFileVault();
}

function clearVaultToolOriginFilter() {
  currentVaultToolOrigin = null;
  renderFileVault();
}

function detectDocumentArchetype(item) {
  const nameLower = (item.name || '').toLowerCase();
  if (item.category === 'signed' || nameLower.includes('tanda tangan')) {
    return 'signed';
  }
  if (nameLower.includes('ktp') || nameLower.includes('kartu') || nameLower.includes('sim') || nameLower.includes('npwp')) {
    return 'ktp';
  }
  if (nameLower.includes('kwitansi') || nameLower.includes('nota') || nameLower.includes('struk') || nameLower.includes('bukti')) {
    return 'kwitansi';
  }
  if (nameLower.includes('transkrip') || nameLower.includes('nilai') || nameLower.includes('tabel') || nameLower.includes('kk') || nameLower.includes('.csv')) {
    return 'transkrip';
  }
  return 'surat';
}

function buildDocThumbMarkup(item) {
  if (item.encrypted) {
    return `
      <span class="doc-thumb locked" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
      </span>
    `;
  }
  if (item.thumbnailDataUrl && item.category !== 'signed') {
    return `
      <span class="doc-thumb" aria-hidden="true">
        <img src="${item.thumbnailDataUrl}" alt="" class="real-thumb" loading="lazy" />
      </span>
    `;
  }

  const kind = detectDocumentArchetype(item);

  if (kind === 'ktp') {
    return `
      <span class="doc-thumb ktp" aria-hidden="true">
        <span class="ktp-block"></span>
        <span class="sheet-line w-85"></span>
        <span class="sheet-line w-60"></span>
      </span>
    `;
  }

  if (kind === 'kwitansi') {
    return `
      <span class="doc-thumb" aria-hidden="true">
        <span class="micro-head">KWITANSI</span>
        <span class="sheet-line ink w-70"></span>
        <span class="sheet-line w-90"></span>
        <span class="sheet-line w-65"></span>
      </span>
    `;
  }

  if (kind === 'transkrip') {
    return `
      <span class="doc-thumb" aria-hidden="true">
        <span class="sheet-line ink w-75"></span>
        <span class="table-block"></span>
        <span class="sheet-line w-90"></span>
        <span class="sheet-line w-60"></span>
      </span>
    `;
  }

  if (kind === 'signed') {
    return `
      <span class="doc-thumb" aria-hidden="true">
        <span class="sheet-line w-65"></span>
        <svg viewBox="0 0 32 16" aria-hidden="true">
          <path d="M3 12 C9 3, 15 14, 29 5" fill="none" stroke="#2445C9" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span class="sheet-line w-80"></span>
      </span>
    `;
  }

  return `
    <span class="doc-thumb" aria-hidden="true">
      <span class="kop-row">
        <span class="kop-circle"></span>
        <span class="sheet-line ink w-70"></span>
      </span>
      <span class="micro-head">SURAT</span>
      <span class="sheet-line w-90"></span>
      <span class="sheet-line w-85"></span>
      <span class="sheet-line w-65"></span>
    </span>
  `;
}

function buildStackSheetMarkup(item, roleClass, animateDrop) {
  const dropClass = animateDrop ? ' drop-in' : '';
  if (item && item.encrypted) {
    return `<div class="stack-sheet ${roleClass}${dropClass} locked-sheet"></div>`;
  }
  if (item && item.thumbnailDataUrl && item.category !== 'signed') {
    return `
      <div class="stack-sheet ${roleClass}${dropClass}">
        <img src="${item.thumbnailDataUrl}" alt="" class="real-thumb" />
      </div>
    `;
  }

  const kind = item ? detectDocumentArchetype(item) : 'surat';
  const docHeading =
    kind === 'kwitansi'
      ? 'KWITANSI'
      : kind === 'ktp'
      ? 'KARTU IDENTITAS'
      : kind === 'transkrip'
      ? 'TRANSKRIP NILAI'
      : 'SURAT KETERANGAN';

  return `
    <div class="stack-sheet ${roleClass}${dropClass}">
      <div class="sheet-kop">
        <span class="sheet-kop-logo"></span>
        <div class="sheet-kop-lines">
          <span class="sheet-line ink w-85"></span>
          <span class="sheet-line w-65"></span>
        </div>
      </div>
      <div class="sheet-doc-title">${docHeading}</div>
      <div class="sheet-body-lines">
        <span class="sheet-line w-90"></span>
        <span class="sheet-line w-85"></span>
        <span class="sheet-line w-90"></span>
        <span class="sheet-line w-70"></span>
        <span class="sheet-line w-85"></span>
        <span class="sheet-line w-60"></span>
      </div>
      <svg class="sheet-sig-mark" viewBox="0 0 44 16" aria-hidden="true">
        <path d="M4 13 C12 3, 22 15, 40 4" fill="none" stroke="#2445C9" stroke-width="2" stroke-linecap="round" />
      </svg>
    </div>
  `;
}

function formatItemMetaLine(item, omitTypePrefix = false) {
  if (item.encrypted) {
    return `Dikunci PIN, ${formatSizeId(item.size)}`;
  }
  const extMatch = (item.name || '').match(/\.([a-z0-9]+)$/i);
  const typeLabel = extMatch
    ? extMatch[1].toUpperCase()
    : item.mimeType === 'application/pdf'
    ? 'PDF'
    : item.category === 'signed'
    ? 'PNG'
    : 'JPG';
  const sizeLabel = formatSizeId(item.size);
  if (item.notes && item.notes.trim().length > 0) {
    if (omitTypePrefix || item.notes.toLowerCase().startsWith('scan')) {
      return `${item.notes}, ${sizeLabel}`;
    }
    return `${typeLabel}, ${item.notes}, ${sizeLabel}`;
  }
  const pagePart = item.pageCount ? `${item.pageCount} halaman, ` : '';
  if (omitTypePrefix) {
    return `${pagePart}${sizeLabel}`;
  }
  return `${typeLabel}, ${pagePart}${sizeLabel}`;
}

async function renderFileVault() {
  const stackRegion = document.getElementById('vaultStackRegion');
  const listContainer = document.getElementById('vaultListContainer');
  const searchInput = document.getElementById('vaultSearchInput');
  if (!listContainer || !stackRegion) return;

  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const allFiles = await AttaStorage.getAllFiles();
  refreshStorageMeterUI();
  refreshToolHistoryCounts();

  const originPill = document.getElementById('vaultToolOriginPill');
  const originLabel = document.getElementById('vaultToolOriginLabel');
  if (originPill && originLabel) {
    if (currentVaultToolOrigin && AttaStorage.TOOL_ORIGIN_META[currentVaultToolOrigin]) {
      originLabel.textContent = `${tr('Menampilkan hasil')}: ${tr(AttaStorage.TOOL_ORIGIN_META[currentVaultToolOrigin].label)}`;
      originPill.classList.remove('is-hidden');
    } else {
      originPill.classList.add('is-hidden');
    }
  }

  if (allFiles.length === 0) {
    stackRegion.innerHTML = '';
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-sheet" aria-hidden="true">
          <span class="sheet-line w-70"></span>
          <span class="sheet-line w-90"></span>
          <span class="sheet-line w-60"></span>
        </div>
        <h2 class="section-heading">Belum ada dokumen</h2>
        <p class="screen-lead">Pindai KTP, surat, atau kwitansi pertamamu. Semua tersimpan di HP ini.</p>
        <button type="button" class="btn-ink" onclick="switchTab('scanner')">Pindai dokumen</button>
      </div>
    `;
    return;
  }

  const latestItem = allFiles[0];
  const secondItem = allFiles[1] || latestItem;
  const thirdItem = allFiles[2] || secondItem;
  const shouldAnimateFront = lastScannedItemId === latestItem.id;
  if (shouldAnimateFront) {
    lastScannedItemId = null;
  }

  if (!query && currentVaultFilter === 'all' && !currentVaultToolOrigin) {
    stackRegion.classList.remove('is-hidden');
    stackRegion.innerHTML = `
      <div class="stack">
        <div class="stack-pile" onclick="openFileActionSheet(${latestItem.id})" style="cursor:pointer;">
          ${buildStackSheetMarkup(thirdItem, 'back-2', false)}
          ${buildStackSheetMarkup(secondItem, 'back-1', false)}
          ${buildStackSheetMarkup(latestItem, 'front', shouldAnimateFront)}
        </div>
        <div class="stack-meta-col">
          <span class="stack-time">Baru dipindai, ${formatRelativeTimeId(latestItem.createdAt)}</span>
          <h2 class="stack-doc-name" onclick="openFileActionSheet(${latestItem.id})" style="cursor:pointer;">${escapeHtml(stripExtensionForDisplay(latestItem.name))}</h2>
          <span class="stack-doc-sub">${escapeHtml(formatItemMetaLine(latestItem, true))}</span>
          <button type="button" class="btn-ink full" onclick="saveItemToPhone(${latestItem.id}, false)">Simpan ke Files</button>
          <button type="button" class="btn-text" onclick="saveItemToPhone(${latestItem.id}, true)">Bagikan</button>
        </div>
      </div>
    `;
  } else {
    stackRegion.classList.add('is-hidden');
    stackRegion.innerHTML = '';
  }

  // Semua dokumen selalu tampil lengkap di daftar di bawah agar hasil alat PDF & scan langsung terlihat
  const sourceList = allFiles;

  const filtered = sourceList.filter((item) => {
    const matchCat = currentVaultFilter === 'all' || item.category === currentVaultFilter;
    const itemOrigin = item.toolOrigin || AttaStorage.inferToolOrigin(item);
    const matchOrigin = !currentVaultToolOrigin || itemOrigin === currentVaultToolOrigin;
    const matchQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      (item.filterUsed && item.filterUsed.toLowerCase().includes(query));
    return matchCat && matchOrigin && matchQuery;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <h2 class="section-heading">Tidak ada berkas yang cocok</h2>
        <p class="screen-lead">Coba kata kunci lain atau pilih kategori Semua.</p>
      </div>
    `;
    return;
  }

  const groups = new Map();
  for (const item of filtered) {
    const label = getTimeGroupLabel(item.createdAt);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(item);
  }

  let html = '';
  for (const [groupName, items] of groups.entries()) {
    html += `<div class="group-label">${escapeHtml(groupName)}</div>`;
    for (const item of items) {
      html += `
        <button type="button" class="file-row" onclick="openFileActionSheet(${item.id})">
          ${buildDocThumbMarkup(item)}
          <span class="file-row-body">
            <span class="file-row-name">${escapeHtml(stripExtensionForDisplay(item.name))}</span>
            <span class="file-row-meta">${escapeHtml(formatItemMetaLine(item))}</span>
          </span>
        </button>
      `;
    }
  }

  listContainer.innerHTML = html;
}

function stripExtensionForDisplay(filename) {
  if (!filename) return 'Dokumen';
  return filename.replace(/\.(pdf|jpg|jpeg|png|doc|docx|csv|md|txt)$/i, '');
}

/**
 * Helper untuk mengisi daftar pilihan berkas lokal (.vault-picker-list) di dalam bottom sheet alat PDF
 */
async function populateVaultPickerList(containerId, actionCallbackName, pdfOnly = true) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const all = await AttaStorage.getAllFiles();
  const candidates = pdfOnly ? all.filter((f) => f.mimeType === 'application/pdf') : all;

  if (candidates.length === 0) {
    el.innerHTML = `<div class="vault-picker-item"><span>Belum ada berkas di aplikasi</span></div>`;
    return;
  }

  el.innerHTML = candidates
    .slice(0, 10)
    .map(
      (item) => `
      <button type="button" class="vault-picker-item${item.encrypted ? ' is-locked-item' : ''}" onclick="${actionCallbackName}(${item.id})">
        <span data-no-i18n>${escapeHtml(stripExtensionForDisplay(item.name))}</span>
        <span class="vault-picker-sub">${escapeHtml(formatItemMetaLine(item, true))}</span>
      </button>
    `
    )
    .join('');
}

/* ============================================================================
 * 5. LEMBAR AKSI BERKAS, PRATINJAU, KUNCI PIN, GANTI NAMA & HAPUS
 * ============================================================================ */
async function openFileActionSheet(id) {
  const item = await AttaStorage.getFileById(id);
  if (!item) return;

  activeSheetItemId = item.id;
  const titleEl = document.getElementById('fileActionSheetTitle');
  const metaEl = document.getElementById('fileActionSheetMeta');
  const sheet = document.getElementById('fileActionSheet');

  if (titleEl) titleEl.textContent = stripExtensionForDisplay(item.name);
  if (metaEl) metaEl.textContent = formatItemMetaLine(item);
  const pinAction = document.getElementById('sheetPinAction');
  if (pinAction) pinAction.textContent = item.encrypted ? 'Buka kunci PIN' : 'Kunci dengan PIN';
  if (sheet) sheet.classList.add('show');
}

function closeFileActionSheet() {
  const sheet = document.getElementById('fileActionSheet');
  if (sheet) sheet.classList.remove('show');
}

/* ---------- Kunci PIN (enkripsi sungguhan, lihat AttaStorage.lockFile) ---------- */
let pinSheetMode = 'lock'; // 'lock' | 'open' | 'remove'
let pinSheetItem = null;
let pinSheetResolver = null;

function setPinSheetError(msg) {
  const err = document.getElementById('pinErrorText');
  if (!err) return;
  err.textContent = msg || '';
  err.classList.toggle('is-hidden', !msg);
}

function showPinSheet(mode, item) {
  pinSheetMode = mode;
  pinSheetItem = item;
  const title = document.getElementById('pinLockTitle');
  const desc = document.getElementById('pinLockDesc');
  const confirmGroup = document.getElementById('pinConfirmGroup');
  const btn = document.getElementById('pinConfirmBtn');
  const input = document.getElementById('pinCodeInput');
  const input2 = document.getElementById('pinCodeConfirmInput');
  if (input) input.value = '';
  if (input2) input2.value = '';
  setPinSheetError('');
  const name = item ? stripExtensionForDisplay(item.name) : 'berkas';
  if (mode === 'lock') {
    title.textContent = 'Kunci dengan PIN';
    desc.textContent = `Isi "${name}" akan dienkripsi. Tanpa PIN, berkas tidak bisa dibuka, termasuk dari file cadangan. PIN yang lupa tidak bisa dipulihkan.`;
    confirmGroup.classList.remove('is-hidden');
    btn.textContent = 'Kunci berkas';
  } else if (mode === 'remove') {
    title.textContent = 'Buka kunci permanen';
    desc.textContent = `Masukkan PIN "${name}" untuk menyimpan kembali berkas tanpa kunci.`;
    confirmGroup.classList.add('is-hidden');
    btn.textContent = 'Buka kunci';
  } else {
    title.textContent = 'Berkas terkunci';
    desc.textContent = `Masukkan PIN untuk membuka "${name}".`;
    confirmGroup.classList.add('is-hidden');
    btn.textContent = 'Buka';
  }
  const sheet = document.getElementById('pinLockSheet');
  if (sheet) sheet.classList.add('show');
  setTimeout(() => input && input.focus(), 60);
}

function closePinLockSheet() {
  const sheet = document.getElementById('pinLockSheet');
  if (sheet) sheet.classList.remove('show');
  if (pinSheetResolver) {
    pinSheetResolver(null);
    pinSheetResolver = null;
  }
}

/** Minta PIN lalu kembalikan isi berkas yang sudah didekripsi (atau null bila batal) */
function requestUnlockedBlob(item) {
  return new Promise((resolve) => {
    pinSheetResolver = resolve;
    showPinSheet('open', item);
  });
}

/** Isi berkas siap pakai. Berkas terkunci meminta PIN dulu. */
async function getPlainBlob(item) {
  if (!item) return null;
  if (!item.encrypted) return item.blob;
  const res = await requestUnlockedBlob(item);
  return res ? res.blob : null;
}

async function openPinLockSheet() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  const item = id ? await AttaStorage.getFileById(id) : null;
  if (!item) return;
  showPinSheet(item.encrypted ? 'remove' : 'lock', item);
}

async function confirmPinLockAction() {
  const item = pinSheetItem;
  if (!item) return;
  const pin = (document.getElementById('pinCodeInput').value || '').trim();
  const btn = document.getElementById('pinConfirmBtn');

  if (pinSheetMode === 'lock') {
    const pin2 = (document.getElementById('pinCodeConfirmInput').value || '').trim();
    if (!/^\d{4,8}$/.test(pin)) return setPinSheetError('PIN harus 4 sampai 8 angka.');
    if (pin !== pin2) return setPinSheetError('Kedua PIN tidak sama.');
    btn.disabled = true;
    try {
      await AttaStorage.lockFile(item.id, pin);
      closePinLockSheet();
      await renderFileVault();
      showToast('Berkas dikunci.');
    } catch (err) {
      setPinSheetError(err.message || 'Berkas gagal dikunci.');
    } finally {
      btn.disabled = false;
    }
    return;
  }

  if (!pin) return setPinSheetError('Masukkan PIN.');
  btn.disabled = true;
  try {
    if (pinSheetMode === 'remove') {
      await AttaStorage.unlockFilePermanently(item.id, pin);
      closePinLockSheet();
      await renderFileVault();
      showToast('Kunci dibuka.');
    } else {
      const fresh = await AttaStorage.getFileById(item.id);
      const plain = await AttaStorage.decryptFile(fresh, pin);
      const resolve = pinSheetResolver;
      pinSheetResolver = null;
      document.getElementById('pinLockSheet').classList.remove('show');
      if (resolve) resolve(plain);
    }
  } catch (err) {
    setPinSheetError(err.code === 'BAD_PIN' ? 'PIN salah. Coba lagi.' : 'Berkas tidak bisa dibuka.');
  } finally {
    btn.disabled = false;
  }
}

async function handleSheetPreview() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (id) await previewItem(id);
}

async function handleSheetSaveToFiles() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (id) await saveItemToPhone(id, false);
}

async function handleSheetShare() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (id) await saveItemToPhone(id, true);
}

async function handleSheetAnalyze() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (!id) return;
  const item = await AttaStorage.getFileById(id);
  const blob = await getPlainBlob(item);
  if (!blob) return;
  await openAnalyzeDocSheet();
  await runDocumentAnalysisOnBlob(blob, item.name, item.mimeType, { forceLocal: true });
}

async function handleSheetStampSignature() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (!id) return;
  const item = await AttaStorage.getFileById(id);
  if (!item || item.mimeType !== 'application/pdf') {
    showToast('Tanda tangan hanya bisa ditempel ke PDF.', true);
    return;
  }
  const blob = await getPlainBlob(item);
  if (!blob) return;

  pendingStampVaultItemId = item.id;
  switchTab('tools');
  const mainTabBtn = document.getElementById('tab-btn-utama');
  switchToolsSubtab('utama', mainTabBtn);

  const savedSigs = await getSavedSignatureItems();
  if (hasSignatureStroke || savedSigs.length > 0) {
    await openStampSignToPdfSheet();
  } else {
    showToast('Goreskan tanda tangan di kotak, lalu ketuk Tempel ke PDF.');
  }
}

async function handleSheetDelete() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (id) await removeItem(id);
}

async function openRenameSheet() {
  const id = activeSheetItemId;
  closeFileActionSheet();
  if (!id) return;

  const item = await AttaStorage.getFileById(id);
  if (!item) return;

  const renameInput = document.getElementById('renameInput');
  const renameSheet = document.getElementById('renameSheet');
  if (renameInput) {
    renameInput.value = stripExtensionForDisplay(item.name);
  }
  if (renameSheet) {
    renameSheet.classList.add('show');
    if (renameInput) renameInput.focus();
  }
}

function closeRenameSheet() {
  const renameSheet = document.getElementById('renameSheet');
  if (renameSheet) renameSheet.classList.remove('show');
}

async function confirmRenameItem() {
  if (!activeSheetItemId) return;
  const renameInput = document.getElementById('renameInput');
  const rawName = renameInput ? renameInput.value.trim() : '';
  if (!rawName) {
    showToast('Nama berkas tidak boleh kosong.', true);
    return;
  }

  const item = await AttaStorage.getFileById(activeSheetItemId);
  if (!item) return;

  const extMatch = (item.name || '').match(/(\.[a-z0-9]+)$/i);
  const ext = extMatch
    ? extMatch[1]
    : item.mimeType === 'application/pdf'
    ? '.pdf'
    : item.category === 'signed'
    ? '.png'
    : '.jpg';
  const finalName = rawName.toLowerCase().endsWith(ext.toLowerCase()) ? rawName : `${rawName}${ext}`;

  await AttaStorage.renameFile(activeSheetItemId, finalName);
  closeRenameSheet();
  await renderFileVault();
  if (currentToolResultItem && currentToolResultItem.id === activeSheetItemId) {
    const fresh = await AttaStorage.getFileById(activeSheetItemId);
    if (fresh) openToolResultSheet(fresh);
  }
  if (activeToolHistoryOrigin && document.getElementById('toolHistorySheet')?.classList.contains('show')) {
    await renderToolHistorySheetList(activeToolHistoryOrigin);
  }
  showToast('Nama berkas diperbarui.');
}

async function saveItemToPhone(id, useShare = false) {
  try {
    const item = await AttaStorage.getFileById(id);
    if (!item) return showToast('Berkas tidak ditemukan di penyimpanan lokal.', true);
    const blob = await getPlainBlob(item);
    if (!blob) return;
    if (window.AttaLock) AttaLock.skipNext();
    await AttaStorage.saveToDeviceStorage({ ...item, blob }, useShare);
    if (useShare) {
      showToast('Membuka menu bagikan.');
    } else if (isNativeAndroidApp()) {
      showToast(`Disimpan ke Download/ATTA DocStudio Pro: ${item.name}`);
    } else {
      showToast(`Disimpan ke Files: ${item.name}`);
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    showToast('Berkas belum bisa disimpan. Coba ulangi.', true);
  }
}

let previewRenderSeq = 0;

async function renderPdfPagesIntoPreviewBox(boxEl, plainBlob, renderToken, fallbackObjectUrl) {
  const stack = document.createElement('div');
  stack.className = 'preview-pdf-stack';
  const loadingNote = document.createElement('p');
  loadingNote.className = 'preview-pdf-note';
  loadingNote.textContent = tr('Memuat pratinjau PDF...');
  stack.appendChild(loadingNote);
  boxEl.innerHTML = '';
  boxEl.appendChild(stack);

  let doc = null;
  try {
    doc = await AttaPdfRender.loadDoc(plainBlob);
    if (renderToken !== previewRenderSeq) return;
    loadingNote.remove();
    const maxPages = Math.min(doc.numPages, 15);
    const targetW = Math.min(760, Math.max(360, (boxEl.clientWidth || 340) * 1.6));
    for (let i = 1; i <= maxPages; i++) {
      if (renderToken !== previewRenderSeq) return;
      const page = await doc.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, Math.max(0.5, targetW / Math.max(1, vp1.width)));
      page.cleanup();
      const { canvas } = await AttaPdfRender.renderPage(doc, i, scale);
      if (renderToken !== previewRenderSeq) {
        canvas.width = canvas.height = 0;
        return;
      }
      canvas.className = 'preview-pdf-page';
      stack.appendChild(canvas);
    }
    if (doc.numPages > maxPages) {
      const note = document.createElement('p');
      note.className = 'preview-pdf-note';
      note.textContent = tr(`Menampilkan ${maxPages} dari ${doc.numPages} halaman. Simpan ke HP untuk melihat semua halaman.`);
      stack.appendChild(note);
    }
  } catch (_) {
    if (renderToken === previewRenderSeq && fallbackObjectUrl) {
      boxEl.innerHTML = `<iframe src="${fallbackObjectUrl}" title="Pratinjau PDF"></iframe>`;
    }
  } finally {
    if (doc) AttaPdfRender.closeDoc(doc);
  }
}

async function previewItem(id) {
  const item = await AttaStorage.getFileById(id);
  if (!item || (!item.blob && !item.encrypted)) {
    showToast('Berkas tidak ditemukan.', true);
    return;
  }

  if (activePreviewObjectUrl) {
    URL.revokeObjectURL(activePreviewObjectUrl);
    activePreviewObjectUrl = null;
  }

  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  const renderToken = ++previewRenderSeq;
  activePreviewObjectUrl = URL.createObjectURL(plainBlob);
  const titleEl = document.getElementById('previewSheetTitle');
  const metaEl = document.getElementById('previewSheetMeta');
  const boxEl = document.getElementById('previewBoxContainer');
  const saveBtn = document.getElementById('previewSaveBtn');
  const sheet = document.getElementById('previewSheet');

  if (titleEl) titleEl.textContent = stripExtensionForDisplay(item.name);
  if (metaEl) metaEl.textContent = formatItemMetaLine(item);

  if (saveBtn) {
    saveBtn.onclick = () => {
      closePreviewSheet();
      saveItemToPhone(item.id, false);
    };
  }

  if (sheet) sheet.classList.add('show');

  if (boxEl) {
    if (item.mimeType === 'application/pdf') {
      const useCanvasPdfPreview =
        (isNativeAndroidApp() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) &&
        window.AttaPdfRender &&
        typeof AttaPdfRender.renderPage === 'function';
      if (useCanvasPdfPreview) {
        renderPdfPagesIntoPreviewBox(boxEl, plainBlob, renderToken, activePreviewObjectUrl);
      } else {
        boxEl.innerHTML = `<iframe src="${activePreviewObjectUrl}" title="Pratinjau PDF"></iframe>`;
      }
    } else if (item.mimeType && item.mimeType.startsWith('image/')) {
      boxEl.innerHTML = `<img src="${activePreviewObjectUrl}" alt="${escapeHtml(item.name)}" />`;
    } else {
      const text = await plainBlob.text();
      boxEl.innerHTML = `<div class="analysis-output">${escapeHtml(text.slice(0, 4000))}</div>`;
    }
  }
}

function closePreviewSheet() {
  previewRenderSeq++;
  const sheet = document.getElementById('previewSheet');
  const boxEl = document.getElementById('previewBoxContainer');
  if (sheet) sheet.classList.remove('show');
  if (boxEl) {
    boxEl.querySelectorAll('canvas').forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
    boxEl.innerHTML = '';
  }
  if (activePreviewObjectUrl) {
    URL.revokeObjectURL(activePreviewObjectUrl);
    activePreviewObjectUrl = null;
  }
}

async function removeItem(id) {
  const snapshot = await AttaStorage.getFileById(id);
  await AttaStorage.deleteFileById(id);
  await refreshToolHistoryCounts();
  await renderFileVault();
  if (snapshot) {
    showToast('Berkas dihapus.', false, 'Urungkan', async () => {
      await AttaStorage.restoreDeletedFileRecord(snapshot);
      await refreshToolHistoryCounts();
      await renderFileVault();
      showToast('Berkas dikembalikan.');
    });
  } else {
    showToast('Berkas dihapus.');
  }
}

/* ============================================================================
 * 6. LAYAR 2: PINDAI DOKUMEN, MODE KTP DEPAN-BELAKANG & PERSPEKTIF 4 SUDUT
 * ============================================================================ */
function selectScannerFilter(filterId, btnEl) {
  currentScanFilter = filterId;
  document.querySelectorAll('.filter-preview .filter-radio').forEach((b) => {
    b.setAttribute('aria-checked', 'false');
  });
  if (btnEl) {
    btnEl.setAttribute('aria-checked', 'true');
  }
}

function selectScannerMode(modeId, btnEl) {
  currentScannerFlowMode = modeId === 'batch' || modeId === 'idcard' ? modeId : 'single';
  currentScanMode = currentScannerFlowMode === 'idcard' ? 'idcard' : 'standard';
  document.querySelectorAll('#scannerModeStrip .vf-mode-pill').forEach((pill) => {
    const active = pill === btnEl || pill.getAttribute('data-scan-mode') === currentScannerFlowMode;
    pill.classList.toggle('is-active', active);
    pill.setAttribute('aria-checked', String(active));
  });
  if (currentScannerFlowMode === 'single') {
    currentScanModeLabel = '1 Halaman';
    showToast('Mode 1 halaman: potret lalu sesuaikan 4 sudut.');
  } else if (currentScannerFlowMode === 'batch') {
    currentScanModeLabel = 'Banyak Halaman';
    showToast('Mode banyak halaman: potret beberapa halaman berurutan.');
  } else {
    currentScanModeLabel = 'KTP A4';
    showToast('Mode KTP A4: ambil sisi depan lalu sisi belakang.');
  }
}

function openScanModeSheet() {
  const sheet = document.getElementById('scanModeSheet');
  if (sheet) sheet.classList.add('show');
}

function closeScanModeSheet() {
  const sheet = document.getElementById('scanModeSheet');
  if (sheet) sheet.classList.remove('show');
}

function chooseScanMode(modeId, pillLabel) {
  currentScanMode = modeId;
  currentScanModeLabel = pillLabel;
  closeScanModeSheet();
}

async function toggleScannerFlash() {
  const btn = document.getElementById('scannerFlashBtn');
  const track = scannerStream ? scannerStream.getVideoTracks()[0] : null;
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  if (!track || !caps.torch) {
    showToast('Lampu kilat tidak didukung kamera atau browser ini.', true);
    return;
  }
  try {
    scannerFlashOn = !scannerFlashOn;
    await track.applyConstraints({ advanced: [{ torch: scannerFlashOn }] });
    if (btn) btn.classList.toggle('is-active', scannerFlashOn);
    if (btn) btn.setAttribute('aria-pressed', String(scannerFlashOn));
  } catch (_) {
    scannerFlashOn = false;
    showToast('Lampu kilat tidak bisa dinyalakan.', true);
  }
}

function openQualitySheet() {
  const sheet = document.getElementById('qualitySheet');
  if (sheet) sheet.classList.add('show');
}

function closeQualitySheet() {
  const sheet = document.getElementById('qualitySheet');
  if (sheet) sheet.classList.remove('show');
}

function chooseScannerQuality(valueStr, labelStr) {
  const selectEl = document.getElementById('scanQualitySelect');
  if (selectEl) selectEl.value = valueStr;
  closeQualitySheet();
}

function syncQualityFromSelect() {
  const selectEl = document.getElementById('scanQualitySelect');
  return selectEl ? selectEl.value : '0.78';
}

function openNativeCameraCapture() {
  stopScannerCamera();
  if (window.AttaLock) AttaLock.skipNext();
  try {
    localStorage.setItem('atta_pending_camera', '1');
  } catch (_) {}
  const camInput = document.getElementById('cameraInput');
  if (camInput) camInput.click();
}

function flashViewfinderEffect() {
  const fx = document.getElementById('vfFlashEffect');
  if (!fx) return;
  fx.classList.add('flash-on');
  setTimeout(() => fx.classList.remove('flash-on'), 160);
}

async function triggerCameraShutter() {
  if (isCapturingShutter) return;
  const video = document.getElementById('scannerVideo');
  const btn = document.getElementById('scannerShutterBtn');

  if (scannerStream && video && video.videoWidth > 0 && video.readyState >= 2) {
    isCapturingShutter = true;
    if (btn) btn.classList.add('is-busy');
    flashViewfinderEffect();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95));
      canvas.width = canvas.height = 0;
      if (!blob) {
        openNativeCameraCapture();
        return;
      }
      await addImageToScanSession(blob);
      await routeAfterScannerCapture(1);
    } finally {
      isCapturingShutter = false;
      if (btn) btn.classList.remove('is-busy');
    }
    return;
  }

  openNativeCameraCapture();
}

async function routeAfterScannerCapture(addedCount = 1) {
  if (!scanSessionPages.length) return;
  if (currentScannerFlowMode === 'single' && addedCount === 1 && scanSessionPages.length === 1) {
    scanReviewActiveIdx = 0;
    await openCropForActiveScanPage({ openReviewAfterSave: true });
    return;
  }
  if (currentScannerFlowMode === 'idcard') {
    if (scanSessionPages.length === 1) {
      showToast('Sisi depan tersimpan. Potret sisi belakang kartu.');
      return;
    }
    if (scanSessionPages.length >= 2) {
      await openScanReviewStage();
      const fmtSel = document.getElementById('scanOutputFormatSelect');
      if (fmtSel) {
        fmtSel.value = 'idcard_a4';
        onScanOutputFormatChange('idcard_a4');
      }
      showToast('Dua sisi kartu siap disusun ke 1 lembar A4.');
    }
  }
}

function triggerGalleryPicker() {
  if (window.AttaLock) AttaLock.skipNext();
  const galInput = document.getElementById('galleryInput');
  if (galInput) galInput.click();
}

function updateScannerHeaderCount() {
  const pageTitle = document.getElementById('scannerPageTitle');
  const trayBadge = document.getElementById('scannerTrayCount');
  const trayBtn = document.querySelector('.page-tray-btn');
  const trayImg = document.getElementById('scannerTrayThumb');
  const count = scanSessionPages.length;
  if (pageTitle) pageTitle.textContent = `Halaman ${count + 1}`;
  if (trayBadge) {
    trayBadge.textContent = String(count);
    trayBadge.classList.toggle('is-hidden', count === 0);
  }
  if (trayImg) {
    if (count > 0 && scanSessionPages[count - 1].dataUrl) {
      trayImg.src = scanSessionPages[count - 1].dataUrl;
      trayImg.classList.remove('is-hidden');
    } else {
      trayImg.removeAttribute('src');
      trayImg.classList.add('is-hidden');
    }
  }
  if (trayBtn) {
    trayBtn.setAttribute(
      'aria-label',
      count === 0 ? 'Tambah foto dari galeri' : `${count} halaman sudah dipindai. Tambah foto dari galeri`
    );
  }
  const doneBtn = document.getElementById('scannerNextBtn') || document.querySelector('.shutter-done');
  if (doneBtn) doneBtn.textContent = count === 0 ? 'Tutup' : `Lanjut (${count})`;
}

let scannerEdgeLoopTimer = null;

function updateScannerSmartBtnVisibility() {
  const smartBtn = document.getElementById('scannerMlKitBtn');
  if (!smartBtn) return;
  const hasNativeScanner = Boolean(
    window.AttaNativeAndroid && typeof window.AttaNativeAndroid.startDocumentScanner === 'function'
  );
  smartBtn.classList.toggle('is-hidden', !hasNativeScanner);
}

function drawScannerEdgeOverlay(corners, confidence) {
  const canvas = document.getElementById('scannerEdgeOverlay');
  const video = document.getElementById('scannerVideo');
  if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) return;

  const cw = canvas.clientWidth || 320;
  const ch = canvas.clientHeight || 480;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);

  if (!corners || corners.length !== 4 || confidence < 0.45) return;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2;
  const offsetY = (ch - vh * scale) / 2;
  const pts = corners.map((c) => ({
    x: offsetX + c.x * vw * scale,
    y: offsetY + c.y * vh * scale
  }));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(36, 69, 201, 0.14)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#60A5FA';
  ctx.stroke();

  for (const pt of pts) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2445C9';
    ctx.stroke();
  }
  ctx.restore();
}

function startLiveEdgeDetectionLoop() {
  stopLiveEdgeDetectionLoop();
  const overlay = document.getElementById('scannerEdgeOverlay');
  if (overlay) overlay.classList.remove('is-hidden');
  scannerEdgeLoopTimer = setInterval(() => {
    if (currentTab !== 'scanner' || !scannerStream) return;
    const video = document.getElementById('scannerVideo');
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.classList.contains('is-hidden')) return;
    if (!window.AttaToolsEngine || typeof AttaToolsEngine.detectDocumentCornersDetailed !== 'function') return;
    const res = AttaToolsEngine.detectDocumentCornersDetailed(video);
    drawScannerEdgeOverlay(res.corners, res.confidence);
  }, 260);
}

function stopLiveEdgeDetectionLoop() {
  if (scannerEdgeLoopTimer) {
    clearInterval(scannerEdgeLoopTimer);
    scannerEdgeLoopTimer = null;
  }
  const overlay = document.getElementById('scannerEdgeOverlay');
  if (overlay) {
    const ctx = overlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    overlay.classList.add('is-hidden');
  }
}

function launchAndroidMlKitScanner() {
  if (window.AttaNativeAndroid && typeof window.AttaNativeAndroid.startDocumentScanner === 'function') {
    if (window.AttaLock) AttaLock.skipNext();
    try {
      window.AttaNativeAndroid.startDocumentScanner(20);
      return true;
    } catch (_) {
      showToast('Gagal membuka pemindai dokumen.', true);
      return false;
    }
  }
  showToast('Gunakan kamera atau galeri untuk memindai dokumen.');
  return false;
}

window.__onAttaDocumentScanResult = async function (urlsInput) {
  try {
    const urls = Array.isArray(urlsInput) ? urlsInput : JSON.parse(String(urlsInput || '[]'));
    if (!urls.length) return;
    for (const u of urls) {
      const resp = await fetch(u);
      const blob = await resp.blob();
      if (blob && blob.size > 0) {
        await addImageToScanSession(blob, { skipAutoCrop: true });
      }
    }
    if (scanSessionPages.length > 0) {
      await openScanReviewStage();
    }
  } catch (_) {
    showToast('Gagal memuat hasil pemindai dokumen.', true);
  }
};

window.__onAttaDocumentScanFallback = function (reason) {
  const msg = String(reason || '');
  if (msg && !msg.toLowerCase().includes('cancel')) {
    showToast('Menggunakan kamera pratinjau standar.');
  }
  if (currentTab === 'scanner') {
    startScannerCamera();
  }
};

/* Kamera langsung (getUserMedia). Bila ditolak/tidak ada, tampilkan pilihan kamera HP & galeri. */
async function startScannerCamera() {
  updateScannerSmartBtnVisibility();
  const video = document.getElementById('scannerVideo');
  const fallback = document.getElementById('scannerFallback');
  const guide = document.getElementById('scannerGuide');
  const showFallback = (msg) => {
    stopLiveEdgeDetectionLoop();
    if (video) video.classList.add('is-hidden');
    if (guide) guide.classList.add('is-hidden');
    if (fallback) {
      fallback.classList.remove('is-hidden');
      const m = fallback.querySelector('.vf-fallback-msg');
      if (m && msg) m.textContent = msg;
    }
  };
  if (scannerStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) {
    showFallback('Kamera langsung tidak tersedia di perangkat ini. Ketuk Buka kamera HP.');
    return;
  }
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    if (currentTab !== 'scanner') {
      stopScannerCamera();
      return;
    }
    if (video) {
      video.srcObject = scannerStream;
      video.classList.remove('is-hidden');
      await video.play().catch(() => {});
      if (video.videoWidth === 0) {
        await new Promise((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadedmetadata', onReady);
            resolve();
          };
          video.addEventListener('loadedmetadata', onReady);
          setTimeout(onReady, 1500);
        });
      }
      if (video.videoWidth === 0 && currentTab === 'scanner') {
        stopScannerCamera();
        showFallback('Pratinjau kamera belum siap. Ketuk Buka kamera HP untuk memotret.');
        return;
      }
    }
    if (guide) guide.classList.remove('is-hidden');
    if (fallback) fallback.classList.add('is-hidden');
    startLiveEdgeDetectionLoop();
  } catch (err) {
    scannerStream = null;
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    showFallback(
      denied
        ? 'Izin kamera ditolak. Izinkan kamera di pengaturan HP, atau pakai Buka kamera HP.'
        : 'Kamera langsung tidak bisa dibuka. Pakai Buka kamera HP atau pilih dari galeri.'
    );
  }
}

function stopScannerCamera() {
  stopLiveEdgeDetectionLoop();
  if (scannerStream) {
    scannerStream.getTracks().forEach((t) => t.stop());
    scannerStream = null;
  }
  scannerFlashOn = false;
  const btn = document.getElementById('scannerFlashBtn');
  if (btn) btn.classList.remove('is-active');
  const video = document.getElementById('scannerVideo');
  if (video) video.srcObject = null;
}

const SCAN_FILTER_NAMES = {
  original: 'Asli',
  enhance: 'Tingkatkan',
  noshadow: 'Tanpa Bayang',
  magic: 'Warna Ajaib',
  lighten: 'Pencerah',
  bw: 'Hitam Putih',
  gray: 'Abu-Abu'
};

function formatScanTitleId(date = new Date()) {
  const d = date.getDate();
  const m = tr(MONTH_NAMES_ID[date.getMonth()]).slice(0, 3);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d} ${m} ${date.getFullYear()}, ${hh}.${mm}`;
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(',');
  const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(parts[1] || '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

/** Simpan foto ke sesi pindai (+ deteksi sudut otomatis & draft IndexedDB) */
async function addImageToScanSession(fileOrBlob, opts = {}) {
  scanProcessingCount++;
  try {
    fileOrBlob = await AttaStorage.normalizeImageOrientation(fileOrBlob);
    const srcImg = await AttaStorage._loadImageFromSource(fileOrBlob);
    const skipAutoCrop = Boolean(opts && opts.skipAutoCrop);
    const fullQuad = [
      { x: 0.01, y: 0.01 },
      { x: 0.99, y: 0.01 },
      { x: 0.99, y: 0.99 },
      { x: 0.01, y: 0.99 }
    ];
    const det =
      !skipAutoCrop && AttaToolsEngine && typeof AttaToolsEngine.detectDocumentCornersDetailed === 'function'
        ? AttaToolsEngine.detectDocumentCornersDetailed(srcImg)
        : { corners: fullQuad, confidence: skipAutoCrop ? 1 : 0 };

    let workingBlob = fileOrBlob;
    let workingImg = srcImg;
    let autoCropped = skipAutoCrop;
    const cornersNorm = det.corners || [
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 }
    ];

    if (!skipAutoCrop && det.confidence >= 0.45 && det.corners && AttaToolsEngine.warpPerspectiveImage) {
      try {
        const warped = AttaToolsEngine.warpPerspectiveImage(srcImg, det.corners, 0, 'original', 0.92);
        if (warped && warped.dataUrl) {
          workingBlob = dataUrlToBlob(warped.dataUrl);
          workingImg = await AttaStorage._loadImageFromSource(warped.dataUrl);
          autoCropped = true;
        }
      } catch (_) {}
    }

    const thumbRes = await AttaStorage.compressAndFilterImage(workingBlob, {
      imgEl: workingImg,
      maxDimension: 960,
      quality: 0.78,
      filter: currentScanFilter
    });
    const draft = await AttaStorage.addScanDraftPage({
      rawBlob: workingBlob,
      unCroppedBlob: fileOrBlob,
      cornersNorm,
      autoCropped,
      width: thumbRes.width,
      height: thumbRes.height,
      filter: currentScanFilter,
      rotationDeg: 0,
      originalSize: fileOrBlob.size || thumbRes.originalSize
    });
    scanSessionPages.push({
      draftId: draft ? draft.id : null,
      rawBlob: workingBlob,
      unCroppedBlob: fileOrBlob,
      cornersNorm,
      autoCropped,
      rotationDeg: 0,
      dataUrl: thumbRes.dataUrl,
      blob: thumbRes.blob,
      width: thumbRes.width,
      height: thumbRes.height,
      originalSize: fileOrBlob.size || thumbRes.originalSize,
      filter: currentScanFilter,
      filterThumbs: null
    });
    scannerCloseArmed = false;
    updateScannerHeaderCount();
    showToast(
      autoCropped
        ? `Halaman ${scanSessionPages.length} ditambahkan (sudut otomatis).`
        : `Halaman ${scanSessionPages.length} ditambahkan.`
    );
  } catch (err) {
    showToast('Foto tidak bisa diproses. Coba ambil ulang.', true);
  } finally {
    scanProcessingCount = Math.max(0, scanProcessingCount - 1);
  }
}

async function restoreScanDraftIfAny() {
  try {
    const drafts = await AttaStorage.getScanDraftPages();
    let pendingCam = false;
    try {
      pendingCam = localStorage.getItem('atta_pending_camera') === '1';
      localStorage.removeItem('atta_pending_camera');
    } catch (_) {}
    if (!drafts || !drafts.length) return;
    scanSessionPages = [];
    for (const d of drafts) {
      if (!d.rawBlob) continue;
      const rot = d.rotationDeg || 0;
      const preview = await AttaStorage.compressAndFilterImage(d.rawBlob, {
        maxDimension: 800,
        quality: 0.76,
        filter: d.filter || currentScanFilter,
        rotationDeg: rot
      });
      scanSessionPages.push({
        draftId: d.id,
        rawBlob: d.rawBlob,
        unCroppedBlob: d.unCroppedBlob || null,
        cornersNorm: d.cornersNorm || null,
        autoCropped: Boolean(d.autoCropped),
        rotationDeg: rot,
        dataUrl: preview.dataUrl,
        blob: preview.blob,
        width: preview.width,
        height: preview.height,
        originalSize: d.originalSize || d.rawBlob.size,
        filter: d.filter || currentScanFilter,
        filterThumbs: null
      });
    }
    if (scanSessionPages.length > 0) {
      updateScannerHeaderCount();
      if (pendingCam && !(window.AttaLock && AttaLock.isLocked())) {
        switchTab('scanner');
        openScanReviewStage();
      } else {
        showToast(`${scanSessionPages.length} foto pindai sebelumnya tersimpan.`, false, 'Lanjut', () => {
          switchTab('scanner');
          openScanReviewStage();
        });
      }
    }
  } catch (_) {}
}

async function finishScannerSession() {
  if (scanProcessingCount > 0) {
    showToast('Tunggu, halaman terakhir masih diproses.');
    return;
  }
  if (scanSessionPages.length === 0) {
    await AttaStorage.clearScanDraftPages();
    switchTab(previousNonScannerTab || 'vault');
    return;
  }
  await openScanReviewStage();
}

async function openScanReviewStage() {
  if (!scanSessionPages.length) return;
  stopScannerCamera();
  scanReviewActiveIdx = Math.max(0, Math.min(scanSessionPages.length - 1, scanReviewActiveIdx));

  const nameInput = document.getElementById('scanOutputNameInput');
  if (nameInput && !nameInput.value.trim()) {
    nameInput.value = `Scan ${formatScanTitleId()}`;
  }

  const pref = (await AttaStorage.getSetting('pref_scan', null)) || {};
  const qSel = document.getElementById('scanQualitySelect');
  if (qSel && pref.quality) qSel.value = pref.quality;
  const fmtSel = document.getElementById('scanOutputFormatSelect');
  if (fmtSel) {
    fmtSel.value = pref.pdf === false ? 'jpg' : 'pdf';
    onScanOutputFormatChange(fmtSel.value);
  }

  const sheet = document.getElementById('scanReviewSheet');
  if (sheet) sheet.classList.add('show');
  await renderScanReviewStage(true);
}

function closeScanReviewSheet() {
  const sheet = document.getElementById('scanReviewSheet');
  if (sheet) sheet.classList.remove('show');
  if (currentTab === 'scanner') {
    startScannerCamera();
  }
}

function closeScanReviewToCamera() {
  closeScanReviewSheet();
}

function onScanOutputFormatChange(fmt) {
  const pdfWrap = document.getElementById('scanPdfOptionsWrap');
  const qWrap = document.getElementById('scanQualityWrap');
  const ocrRow = document.getElementById('scanSearchableOcrRow');
  if (pdfWrap) pdfWrap.classList.toggle('is-hidden', fmt !== 'pdf');
  if (qWrap) qWrap.classList.toggle('is-hidden', fmt === 'png' || fmt === 'txt_ocr' || fmt === 'md_ocr');
  if (ocrRow) ocrRow.classList.toggle('is-hidden', !isNativeAndroidApp());
}

function renderScanReviewHeaderAndThumbsOnly() {
  if (!scanSessionPages.length) return;
  scanReviewActiveIdx = Math.max(0, Math.min(scanSessionPages.length - 1, scanReviewActiveIdx));
  const active = scanSessionPages[scanReviewActiveIdx];

  const metaEl = document.getElementById('scanReviewMeta');
  if (metaEl) {
    metaEl.textContent = `${tr('Halaman')} ${scanReviewActiveIdx + 1} ${tr('dari')} ${scanSessionPages.length} • ${tr(SCAN_FILTER_NAMES[active.filter] || 'Warna Ajaib')}`;
  }

  const imgEl = document.getElementById('scanReviewPreviewImg');
  if (imgEl && imgEl.src !== active.dataUrl) {
    imgEl.src = active.dataUrl;
  }

  const stripEl = document.getElementById('scanReviewPageStrip');
  if (stripEl) {
    stripEl.innerHTML = scanSessionPages
      .map(
        (pg, idx) => `
        <button type="button" class="scan-page-thumb${idx === scanReviewActiveIdx ? ' active' : ''}" onclick="selectScanReviewPage(${idx})">
          <img src="${pg.dataUrl}" alt="" />
          <span class="scan-page-num">${idx + 1}</span>
        </button>`
      )
      .join('');
  }
}

function renderScanFilterStripDom(active) {
  const filterStrip = document.getElementById('scanReviewFilterStrip');
  if (!filterStrip || !active) return;
  filterStrip.innerHTML = AttaStorage.FILTER_CATALOG.map((f) => {
    const thumbUrl = (active.filterThumbs && active.filterThumbs[f.id]) || active.dataUrl;
    const isAct = active.filter === f.id;
    return `
      <button type="button" class="scan-filter-chip${isAct ? ' active' : ''}" onclick="applyReviewFilterChoice('${f.id}')">
        <span class="scan-filter-img-wrap"><img src="${thumbUrl}" alt="" /></span>
        <span class="scan-filter-name">${tr(f.label)}</span>
      </button>`;
  }).join('');
}

async function renderScanReviewStage(rebuildThumbs = false) {
  if (!scanSessionPages.length) {
    closeScanReviewSheet();
    return;
  }
  renderScanReviewHeaderAndThumbsOnly();
  const active = scanSessionPages[scanReviewActiveIdx];

  if (rebuildThumbs || !active.filterThumbs) {
    renderScanFilterStripDom(active);
    try {
      const targetPage = active;
      const thumbs = await AttaStorage.generateAllFilterThumbnails(targetPage.rawBlob, 68, targetPage.rotationDeg || 0);
      targetPage.filterThumbs = thumbs;
      if (scanSessionPages[scanReviewActiveIdx] === targetPage) {
        renderScanFilterStripDom(targetPage);
      }
    } catch (_) {
      active.filterThumbs = {};
    }
    return;
  }

  renderScanFilterStripDom(active);
}

async function selectScanReviewPage(idx) {
  scanReviewActiveIdx = idx;
  await renderScanReviewStage(false);
}

async function applyReviewFilterChoice(filterId) {
  const applyAll = document.getElementById('scanApplyFilterAllCheck')?.checked;
  const targets = applyAll ? scanSessionPages : [scanSessionPages[scanReviewActiveIdx]];
  for (const pg of targets) {
    if (!pg) continue;
    pg.filter = filterId;
    const res = await AttaStorage.compressAndFilterImage(pg.rawBlob, {
      maxDimension: 960,
      quality: 0.8,
      filter: filterId,
      rotationDeg: pg.rotationDeg || 0
    });
    pg.dataUrl = res.dataUrl;
    pg.blob = res.blob;
    pg.width = res.width;
    pg.height = res.height;
    if (pg.draftId) {
      AttaStorage.updateScanDraftPage(pg.draftId, { filter: filterId }).catch(() => {});
    }
  }
  updateScannerHeaderCount();
  renderScanReviewHeaderAndThumbsOnly();
  renderScanFilterStripDom(scanSessionPages[scanReviewActiveIdx]);
}

async function rotateActiveScanPage(deg = 90) {
  const active = scanSessionPages[scanReviewActiveIdx];
  if (!active) return;
  const step = ((deg % 360) + 360) % 360;
  active.rotationDeg = ((active.rotationDeg || 0) + step) % 360;

  try {
    const rotated = await AttaStorage.rotateImageSourceFast(active.dataUrl || active.rawBlob, step, 960, 0.84);
    active.dataUrl = rotated.dataUrl;
    active.blob = rotated.blob;
    active.width = rotated.width;
    active.height = rotated.height;

    updateScannerHeaderCount();
    renderScanReviewHeaderAndThumbsOnly();

    if (active.filterThumbs) {
      const nextThumbs = {};
      for (const [k, url] of Object.entries(active.filterThumbs)) {
        try {
          const rotT = await AttaStorage.rotateImageSourceFast(url, step, 68, 0.78);
          nextThumbs[k] = rotT.dataUrl;
        } catch (_) {
          nextThumbs[k] = url;
        }
      }
      active.filterThumbs = nextThumbs;
      if (scanSessionPages[scanReviewActiveIdx] === active) {
        renderScanFilterStripDom(active);
      }
    }

    if (active.draftId) {
      AttaStorage.updateScanDraftPage(active.draftId, { rotationDeg: active.rotationDeg }).catch(() => {});
    }
  } catch (_) {
    showToast('Gagal memutar halaman.', true);
  }
}

async function moveActiveScanPage(delta) {
  const targetIdx = scanReviewActiveIdx + delta;
  if (targetIdx < 0 || targetIdx >= scanSessionPages.length) return;
  const tmp = scanSessionPages[scanReviewActiveIdx];
  scanSessionPages[scanReviewActiveIdx] = scanSessionPages[targetIdx];
  scanSessionPages[targetIdx] = tmp;
  scanReviewActiveIdx = targetIdx;
  updateScannerHeaderCount();
  renderScanReviewHeaderAndThumbsOnly();
  AttaStorage.replaceScanDraftOrder(scanSessionPages.map((p) => p.draftId).filter(Boolean)).catch(() => {});
}

async function deleteActiveScanPage() {
  const removed = scanSessionPages.splice(scanReviewActiveIdx, 1)[0];
  if (removed && removed.draftId) {
    await AttaStorage.deleteScanDraftPage(removed.draftId);
  }
  updateScannerHeaderCount();
  if (scanSessionPages.length === 0) {
    closeScanReviewSheet();
    showToast('Halaman dihapus. Silakan potret lagi.');
    return;
  }
  scanReviewActiveIdx = Math.min(scanReviewActiveIdx, scanSessionPages.length - 1);
  await renderScanReviewStage(false);
}

async function openCropForActiveScanPage(opts = {}) {
  const active = scanSessionPages[scanReviewActiveIdx];
  if (!active) return;
  cropReturnToScanReview = true;
  cropOpenReviewAfterSave = Boolean(opts && opts.openReviewAfterSave);
  const sourceBlob = active.unCroppedBlob || active.rawBlob;
  const initialCorners = active.unCroppedBlob && active.cornersNorm ? active.cornersNorm : null;
  await openInteractivePerspectiveCropForFile(
    new File([sourceBlob], `scan-hal-${scanReviewActiveIdx + 1}.jpg`, { type: 'image/jpeg' }),
    initialCorners,
    active.rotationDeg || 0
  );
}

async function commitScanReviewSession() {
  if (!scanSessionPages.length) return;
  const btn = document.getElementById('scanCommitSaveBtn');
  const fmt = document.getElementById('scanOutputFormatSelect')?.value || 'pdf';
  const paperSize = document.getElementById('scanPaperSizeSelect')?.value || 'a4';
  const quality = parseFloat(document.getElementById('scanQualitySelect')?.value || '0.78');
  const wantSearchableOcr = Boolean(document.getElementById('scanSearchableOcrCheck')?.checked);
  const rawName = (document.getElementById('scanOutputNameInput')?.value || '').trim();
  const baseTitle = rawName.replace(/\.(pdf|jpg|jpeg|png|docx|txt|md)$/i, '') || `Scan ${formatScanTitleId()}`;

  if (fmt === 'idcard_a4' && scanSessionPages.length < 2) {
    showToast('Format KTP 1 lembar A4 membutuhkan minimal 2 foto (depan & belakang).', true);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = tr('Memproses halaman...');
  }

  try {
    const outMimeImg = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const processedPages = [];
    for (const pg of scanSessionPages) {
      const rendered = await AttaStorage.compressAndFilterImage(pg.rawBlob, {
        maxDimension: 1850,
        quality,
        filter: pg.filter,
        outputMime: outMimeImg,
        rotationDeg: pg.rotationDeg || 0
      });
      processedPages.push({
        ...rendered,
        filter: pg.filter,
        mimeType: outMimeImg
      });
    }

    const totalOrig = scanSessionPages.reduce((s, p) => s + (p.originalSize || 0), 0);
    const filterLabel = SCAN_FILTER_NAMES[scanSessionPages[0].filter] || 'Warna Ajaib';
    let savedRecord = null;
    let extraNote = '';

    if (fmt === 'pdf') {
      let ocrPages = [];
      if (wantSearchableOcr && isNativeAndroidApp()) {
        for (const p of processedPages) {
          ocrPages.push(await AttaToolsEngine.runOfflineOcrOnBlob(p.blob));
        }
      }
      const pdfBlob = await AttaToolsEngine.buildMultiImagePdfWithOptions(processedPages, {
        pageSize: paperSize,
        ocrPages
      });
      savedRecord = await AttaStorage.saveFileRecord({
        name: `${baseTitle}.pdf`,
        category: 'scan',
        toolOrigin: 'scanner',
        mimeType: 'application/pdf',
        blob: pdfBlob,
        thumbnailDataUrl: processedPages[0].dataUrl,
        filterUsed: filterLabel,
        originalSize: totalOrig,
        notes: ''
      });
    } else if (fmt === 'jpg' || fmt === 'png') {
      const ext = fmt === 'png' ? '.png' : '.jpg';
      for (let i = 0; i < processedPages.length; i++) {
        const p = processedPages[i];
        const fName = processedPages.length > 1 ? `${baseTitle} (${i + 1})${ext}` : `${baseTitle}${ext}`;
        const rec = await AttaStorage.saveFileRecord({
          name: fName,
          category: 'scan',
          toolOrigin: 'scanner',
          mimeType: outMimeImg,
          blob: p.blob,
          thumbnailDataUrl: p.dataUrl,
          filterUsed: SCAN_FILTER_NAMES[p.filter] || filterLabel,
          originalSize: p.originalSize,
          notes: SCAN_FILTER_NAMES[p.filter] || filterLabel
        });
        if (i === 0) savedRecord = rec;
      }
      if (processedPages.length > 1) {
        extraNote = `${processedPages.length} gambar tersimpan (${fmt.toUpperCase()})`;
      }
    } else if (fmt === 'docx_photo') {
      const docxBlob = await AttaToolsEngine.buildDocxFromImages(processedPages, baseTitle, []);
      savedRecord = await AttaStorage.saveFileRecord({
        name: `${baseTitle}.docx`,
        category: 'export',
        toolOrigin: 'scanner',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        blob: docxBlob,
        thumbnailDataUrl: processedPages[0].dataUrl,
        filterUsed: filterLabel,
        originalSize: totalOrig,
        notes: `${processedPages.length} halaman foto`
      });
    } else if (fmt === 'docx_ocr' || fmt === 'txt_ocr' || fmt === 'md_ocr') {
      const ocrTexts = [];
      for (const p of processedPages) {
        const res = await AttaToolsEngine.runOfflineOcrOnBlob(p.blob);
        if (res && res.text && res.text.trim()) ocrTexts.push(res.text.trim());
        else ocrTexts.push('');
      }
      const joinedText = ocrTexts.filter(Boolean).join('\n\n').trim();
      if (fmt === 'docx_ocr') {
        const docxBlob = joinedText
          ? await AttaToolsEngine.buildDocxBlob(joinedText, baseTitle)
          : await AttaToolsEngine.buildDocxFromImages(processedPages, baseTitle, []);
        if (!joinedText) {
          extraNote = 'Teks tidak terdeteksi; foto disisipkan rapi ke dalam Word.';
        }
        savedRecord = await AttaStorage.saveFileRecord({
          name: `${baseTitle}.docx`,
          category: 'export',
          toolOrigin: 'scanner',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          blob: docxBlob,
          thumbnailDataUrl: processedPages[0].dataUrl,
          filterUsed: 'Scan ke Word',
          notes: joinedText ? 'Hasil teks OCR' : 'Halaman foto Word'
        });
      } else {
        if (!joinedText) {
          showToast(
            isNativeAndroidApp()
              ? 'Tidak ada teks yang terbaca dari foto. Coba filter Hitam Putih atau foto lebih dekat.'
              : 'Ekstrak teks foto offline hanya tersedia di APK Android.',
            true
          );
          return;
        }
        const outFmt = fmt === 'md_ocr' ? 'md' : 'txt';
        const out = AttaToolsEngine.convertTextToOutputBlob(joinedText, baseTitle, outFmt);
        savedRecord = await AttaStorage.saveFileRecord({
          name: `${baseTitle}${out.ext}`,
          category: 'export',
          toolOrigin: 'scanner',
          mimeType: out.mime,
          blob: out.blob,
          filterUsed: `OCR ${out.ext.toUpperCase()}`,
          notes: 'Hasil baca teks foto'
        });
      }
    } else if (fmt === 'idcard_a4') {
      const stitched = await AttaToolsEngine.stitchIdCardFrontBack(
        processedPages[0].blob,
        processedPages[1].blob,
        'original'
      );
      savedRecord = await AttaStorage.saveFileRecord({
        name: `${baseTitle}.pdf`,
        category: 'scan',
        toolOrigin: 'idcard',
        mimeType: 'application/pdf',
        blob: stitched.pdfBlob,
        thumbnailDataUrl: stitched.thumbnailDataUrl,
        filterUsed: 'Kartu ID A4',
        notes: '1 halaman A4'
      });
    }

    await AttaStorage.clearScanDraftPages();
    scanSessionPages = [];
    updateScannerHeaderCount();
    const reviewSheet = document.getElementById('scanReviewSheet');
    if (reviewSheet) reviewSheet.classList.remove('show');
    if (savedRecord) lastScannedItemId = savedRecord.id;
    switchTab(previousNonScannerTab || 'vault');
    if (savedRecord) {
      await renderFileVault();
      openToolResultSheet(savedRecord, extraNote);
    }
  } catch (err) {
    showToast('Dokumen gagal disimpan. Coba ulangi.', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = tr('Simpan hasil');
    }
  }
}

async function handleCameraOrGalleryInput(inputEl) {
  try {
    localStorage.removeItem('atta_pending_camera');
  } catch (_) {}
  const files = Array.from(inputEl.files || []);
  const fromCameraInput = inputEl.id === 'cameraInput';
  inputEl.value = '';
  if (!files.length) return;

  try {
    let importedPdf = null;
    let pdfCount = 0;
    let addedImgCount = 0;

    for (const file of files) {
      if (file.type === 'application/pdf') {
        importedPdf = await AttaStorage.saveFileRecord({
          name: file.name,
          category: 'pdf',
          toolOrigin: 'import',
          mimeType: 'application/pdf',
          blob: file,
          filterUsed: 'PDF',
          originalSize: file.size,
          notes: ''
        });
        lastScannedItemId = importedPdf.id;
        pdfCount++;
      } else if (file.type.startsWith('image/') || fromCameraInput) {
        await addImageToScanSession(file);
        addedImgCount++;
      }
    }

    if (addedImgCount > 0 && (fromCameraInput || scanSessionPages.length > 0)) {
      if (currentScannerFlowMode === 'single' && addedImgCount === 1 && scanSessionPages.length === 1) {
        scanReviewActiveIdx = 0;
        await openCropForActiveScanPage({ openReviewAfterSave: true });
        return;
      }
      if (currentScannerFlowMode === 'idcard' && scanSessionPages.length === 1 && !fromCameraInput) {
        showToast('Sisi depan tersimpan. Pilih atau potret sisi belakang kartu.');
        return;
      }
      await openScanReviewStage();
      if (currentScannerFlowMode === 'idcard' && scanSessionPages.length >= 2) {
        const fmtSel = document.getElementById('scanOutputFormatSelect');
        if (fmtSel) {
          fmtSel.value = 'idcard_a4';
          onScanOutputFormatChange('idcard_a4');
        }
      }
      return;
    }

    if (pdfCount > 0) {
      showToast(pdfCount === 1 ? 'PDF ditambahkan ke Dokumen.' : `${pdfCount} PDF ditambahkan ke Dokumen.`);
      switchTab('vault');
      if (pdfCount === 1 && importedPdf) {
        openToolResultSheet(importedPdf);
      }
    }
  } catch (err) {
    showToast('Berkas gagal diproses. Coba pilih ulang berkasnya.', true);
  }
}

async function buildMultiImagePdfBlob(pages) {
  const { PDFDocument } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  for (const p of pages) {
    const jpgImage = await pdfDoc.embedJpg(p.dataUrl);
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const scale = Math.min((pageWidth - margin * 2) / p.width, (pageHeight - margin * 2) / p.height);
    const w = p.width * scale;
    const h = p.height * scale;
    page.drawImage(jpgImage, { x: (pageWidth - w) / 2, y: (pageHeight - h) / 2, width: w, height: h });
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

async function buildSingleImagePdfBlob(jpegDataUrl, imgWidth, imgHeight) {
  const { PDFDocument } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const jpgImage = await pdfDoc.embedJpg(jpegDataUrl);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 24;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const scale = Math.min(maxW / imgWidth, maxH / imgHeight);
  const drawW = imgWidth * scale;
  const drawH = imgHeight * scale;

  page.drawImage(jpgImage, {
    x: (pageWidth - drawW) / 2,
    y: (pageHeight - drawH) / 2,
    width: drawW,
    height: drawH
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/* ============================================================================
 * 7. INTERAKTIF 4 SUDUT PERSPEKTIF (Port dari CropScreen & HomographyService)
 * ============================================================================ */
function triggerPerspectiveCropPicker() {
  const input = document.getElementById('perspectiveCropInput');
  if (input) input.click();
}

async function handlePerspectiveCropInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await openInteractivePerspectiveCropForFile(file);
}

function onCropAutoPaperToggle(checked) {
  cropAutoPaperEnabled = Boolean(checked);
  updateCropPaperBadge();
}

function updateCropPaperBadge() {
  const badge = document.getElementById('cropPaperBadge');
  if (!badge) return;
  if (!cropSourceImage || !AttaToolsEngine || typeof AttaToolsEngine.estimateDocumentSize !== 'function') {
    badge.classList.add('is-hidden');
    return;
  }
  const iw = cropSourceImage.naturalWidth || cropSourceImage.width || 1000;
  const ih = cropSourceImage.naturalHeight || cropSourceImage.height || 1400;
  const ptsPx = cropCornersNorm.map((c) => ({ x: c.x * iw, y: c.y * ih }));
  const est = AttaToolsEngine.estimateDocumentSize(ptsPx, iw, ih, cropAutoPaperEnabled, 1800);
  badge.textContent = est && est.paperName ? est.paperName : cropAutoPaperEnabled ? 'Otomatis' : 'Bebas';
  badge.classList.remove('is-hidden');
}

async function openInteractivePerspectiveCropForFile(file, initialCorners = null, initialRotDeg = 0) {
  cropSourceFileName = file.name.replace(/\.[^/.]+$/, '');
  cropRotationDeg = 0;
  const autoPaperEl = document.getElementById('cropAutoPaperCheck');
  cropAutoPaperEnabled = autoPaperEl ? autoPaperEl.checked : true;

  let img = await AttaStorage._loadImageFromSource(file);
  if (initialRotDeg && ((initialRotDeg % 360) + 360) % 360 !== 0) {
    const rotRes = await AttaStorage.rotateImageSourceFast(img, initialRotDeg, 1800, 0.92);
    img = await AttaStorage._loadImageFromSource(rotRes.dataUrl);
  }

  cropSourceImage = img;
  const canvas = document.getElementById('cropInteractiveCanvas');
  if (canvas) {
    const iw = img.naturalWidth || img.width || 360;
    const ih = img.naturalHeight || img.height || 460;
    canvas.width = 360;
    canvas.height = Math.max(210, Math.min(480, Math.round((ih / Math.max(1, iw)) * 360)));
  }

  cropCornersNorm =
    Array.isArray(initialCorners) && initialCorners.length === 4 && !initialRotDeg
      ? initialCorners.map((c) => ({ x: c.x, y: c.y }))
      : AttaToolsEngine.detectDocumentCornersFromImage(img);
  hideCropLoupe();
  drawCropInteractiveCanvas();

  const sheet = document.getElementById('cropPerspectiveSheet');
  if (sheet) sheet.classList.add('show');
}

function autoDetectCropCorners() {
  if (!cropSourceImage) return;
  cropCornersNorm = AttaToolsEngine.detectDocumentCornersFromImage(cropSourceImage);
  drawCropInteractiveCanvas();
  showToast('Sudut dokumen dideteksi ulang.');
}

function closeCropPerspectiveSheet() {
  hideCropLoupe();
  cropReturnToScanReview = false;
  cropOpenReviewAfterSave = false;
  const sheet = document.getElementById('cropPerspectiveSheet');
  if (sheet) sheet.classList.remove('show');
}

function rotateCropPreview(deg) {
  if (!cropSourceImage) return;
  const step = ((deg % 360) + 360) % 360;
  if (step === 90) {
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = cropSourceImage.naturalHeight || cropSourceImage.height;
    rotCanvas.height = cropSourceImage.naturalWidth || cropSourceImage.width;
    const rCtx = rotCanvas.getContext('2d');
    rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rCtx.rotate(Math.PI / 2);
    rCtx.drawImage(cropSourceImage, -rotCanvas.height / 2, -rotCanvas.width / 2);
    const rotatedImg = new Image();
    rotatedImg.onload = () => {
      cropSourceImage = rotatedImg;
      const canvas = document.getElementById('cropInteractiveCanvas');
      if (canvas) {
        const iw = rotatedImg.naturalWidth || rotatedImg.width || 360;
        const ih = rotatedImg.naturalHeight || rotatedImg.height || 460;
        canvas.width = 360;
        canvas.height = Math.max(210, Math.min(480, Math.round((ih / Math.max(1, iw)) * 360)));
      }
      const prev = cropCornersNorm.map((c) => ({ x: 1 - c.y, y: c.x }));
      cropCornersNorm = [prev[3], prev[0], prev[1], prev[2]];
      cropRotationDeg = 0;
      drawCropInteractiveCanvas();
    };
    rotatedImg.src = rotCanvas.toDataURL('image/jpeg', 0.92);
    showToast('Gambar diputar 90 derajat.');
    return;
  }
  cropRotationDeg = (cropRotationDeg + deg) % 360;
  drawCropInteractiveCanvas();
  showToast(`Rotasi disetel ke ${cropRotationDeg} derajat.`);
}

function resetCropCorners() {
  cropCornersNorm = [
    { x: 0.02, y: 0.02 },
    { x: 0.98, y: 0.02 },
    { x: 0.98, y: 0.98 },
    { x: 0.02, y: 0.98 }
  ];
  drawCropInteractiveCanvas();
}

function getCropEdgeMidpoints() {
  const c = cropCornersNorm;
  return [
    { x: (c[0].x + c[1].x) * 0.5, y: (c[0].y + c[1].y) * 0.5 }, // 4: Atas
    { x: (c[1].x + c[2].x) * 0.5, y: (c[1].y + c[2].y) * 0.5 }, // 5: Kanan
    { x: (c[2].x + c[3].x) * 0.5, y: (c[2].y + c[3].y) * 0.5 }, // 6: Bawah
    { x: (c[3].x + c[0].x) * 0.5, y: (c[3].y + c[0].y) * 0.5 }  // 7: Kiri
  ];
}

function hideCropLoupe() {
  const loupe = document.getElementById('cropLoupeCanvas');
  if (loupe) loupe.classList.add('is-hidden');
}

function drawCropLoupeAtNorm(normPos) {
  const loupe = document.getElementById('cropLoupeCanvas');
  if (!loupe || !cropSourceImage || !normPos) return;
  const iw = cropSourceImage.naturalWidth || cropSourceImage.width;
  const ih = cropSourceImage.naturalHeight || cropSourceImage.height;
  if (!iw || !ih) return;

  loupe.classList.remove('is-hidden');
  loupe.classList.toggle('is-right', normPos.x < 0.48);

  const lCtx = loupe.getContext('2d');
  const lw = loupe.width;
  const lh = loupe.height;
  lCtx.clearRect(0, 0, lw, lh);
  lCtx.fillStyle = '#0B1220';
  lCtx.fillRect(0, 0, lw, lh);

  const cropPatchRatio = 0.16;
  const sw = Math.max(24, iw * cropPatchRatio);
  const sh = sw * (lh / lw);
  const sx = normPos.x * iw - sw / 2;
  const sy = normPos.y * ih - sh / 2;
  lCtx.drawImage(cropSourceImage, sx, sy, sw, sh, 0, 0, lw, lh);

  // Garis bidik kaca pembesar ala SmartScanner
  lCtx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  lCtx.lineWidth = 1.2;
  lCtx.beginPath();
  lCtx.moveTo(lw / 2, 10);
  lCtx.lineTo(lw / 2, lh - 10);
  lCtx.moveTo(10, lh / 2);
  lCtx.lineTo(lw - 10, lh / 2);
  lCtx.stroke();

  lCtx.fillStyle = '#2445C9';
  lCtx.strokeStyle = '#FFFFFF';
  lCtx.lineWidth = 2;
  lCtx.beginPath();
  lCtx.arc(lw / 2, lh / 2, 4.5, 0, Math.PI * 2);
  lCtx.fill();
  lCtx.stroke();
}

function initCropInteractiveCanvas() {
  const canvas = document.getElementById('cropInteractiveCanvas');
  if (!canvas) return;
  let lastDragNorm = null;

  const getNormPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0.02, Math.min(0.98, (clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0.02, Math.min(0.98, (clientY - rect.top) / Math.max(1, rect.height)))
    };
  };

  const clampN = (v) => Math.max(0.02, Math.min(0.98, v));

  const onStart = (e) => {
    if (!cropSourceImage) return;
    const pos = getNormPos(e);
    let bestIdx = -1;
    let bestDist = 0.12;
    cropCornersNorm.forEach((c, idx) => {
      const d = Math.hypot(c.x - pos.x, c.y - pos.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    if (bestIdx === -1) {
      let edgeBestDist = 0.11;
      getCropEdgeMidpoints().forEach((m, eIdx) => {
        const d = Math.hypot(m.x - pos.x, m.y - pos.y);
        if (d < edgeBestDist) {
          edgeBestDist = d;
          bestIdx = 4 + eIdx;
        }
      });
    }
    if (bestIdx !== -1) {
      e.preventDefault();
      draggingCornerIdx = bestIdx;
      lastDragNorm = pos;
      drawCropInteractiveCanvas();
      drawCropLoupeAtNorm(bestIdx < 4 ? cropCornersNorm[bestIdx] : getCropEdgeMidpoints()[bestIdx - 4]);
    }
  };

  const onMove = (e) => {
    if (draggingCornerIdx === -1) return;
    e.preventDefault();
    const pos = getNormPos(e);
    if (draggingCornerIdx < 4) {
      cropCornersNorm[draggingCornerIdx] = pos;
    } else if (lastDragNorm) {
      const dx = pos.x - lastDragNorm.x;
      const dy = pos.y - lastDragNorm.y;
      const edgePairs = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0]
      ];
      const [a, b] = edgePairs[draggingCornerIdx - 4];
      cropCornersNorm[a] = { x: clampN(cropCornersNorm[a].x + dx), y: clampN(cropCornersNorm[a].y + dy) };
      cropCornersNorm[b] = { x: clampN(cropCornersNorm[b].x + dx), y: clampN(cropCornersNorm[b].y + dy) };
    }
    lastDragNorm = pos;
    drawCropInteractiveCanvas();
    const focusPt =
      draggingCornerIdx < 4 ? cropCornersNorm[draggingCornerIdx] : getCropEdgeMidpoints()[draggingCornerIdx - 4];
    drawCropLoupeAtNorm(focusPt);
  };

  const onEnd = () => {
    if (draggingCornerIdx !== -1) {
      draggingCornerIdx = -1;
      lastDragNorm = null;
      hideCropLoupe();
      drawCropInteractiveCanvas();
    }
  };

  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);
}

function drawCropInteractiveCanvas() {
  const canvas = document.getElementById('cropInteractiveCanvas');
  if (!canvas || !cropSourceImage) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(cropSourceImage, 0, 0, w, h);

  const pts = cropCornersNorm.map((c) => ({ x: c.x * w, y: c.y * h }));

  // Mask gelap di luar area dokumen (gaya SmartScanner / CamScanner)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(11, 18, 32, 0.54)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Garis tepi dokumen + kisi bantu tipis di dalam area
  ctx.fillStyle = 'rgba(36, 69, 201, 0.08)';
  ctx.strokeStyle = '#7C95FF';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 4 pegangan sisi tengah (Atas, Kanan, Bawah, Kiri)
  const edges = [
    [pts[0], pts[1]],
    [pts[1], pts[2]],
    [pts[2], pts[3]],
    [pts[3], pts[0]]
  ];
  edges.forEach(([pA, pB], eIdx) => {
    const mx = (pA.x + pB.x) * 0.5;
    const my = (pA.y + pB.y) * 0.5;
    const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
    const active = draggingCornerIdx === 4 + eIdx;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.fillStyle = active ? '#2445C9' : '#FBFBF8';
    ctx.strokeStyle = '#2445C9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-12, -4, 24, 8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // 4 pegangan sudut
  pts.forEach((p, idx) => {
    const active = draggingCornerIdx === idx;
    ctx.fillStyle = active ? '#2445C9' : '#FBFBF8';
    ctx.strokeStyle = active ? '#FFFFFF' : '#2445C9';
    ctx.lineWidth = active ? 3.2 : 2.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, active ? 11 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  updateCropPaperBadge();
}

async function applyPerspectiveCropAndSave() {
  if (!cropSourceImage) return;
  try {
    const useOriginalForReview = Boolean(cropReturnToScanReview && scanSessionPages[scanReviewActiveIdx]);
    const shouldOpenReviewAfter = Boolean(cropOpenReviewAfterSave);
    const warped = AttaToolsEngine.warpPerspectiveImage(
      cropSourceImage,
      cropCornersNorm,
      cropRotationDeg,
      useOriginalForReview ? 'original' : currentScanFilter,
      useOriginalForReview ? 0.94 : 0.84,
      { autoPaper: cropAutoPaperEnabled }
    );

    const blob = dataUrlToBlob(warped.dataUrl);
    if (useOriginalForReview) {
      const active = scanSessionPages[scanReviewActiveIdx];
      cropReturnToScanReview = false;
      cropOpenReviewAfterSave = false;
      active.rawBlob = blob;
      active.rotationDeg = 0;
      active.autoCropped = true;
      active.cornersNorm = cropCornersNorm.map((c) => ({ x: c.x, y: c.y }));
      active.filterThumbs = null;
      const preview = await AttaStorage.compressAndFilterImage(blob, {
        maxDimension: 960,
        quality: 0.8,
        filter: active.filter
      });
      active.dataUrl = preview.dataUrl;
      active.blob = preview.blob;
      active.width = preview.width;
      active.height = preview.height;
      if (active.draftId) {
        AttaStorage.updateScanDraftPage(active.draftId, {
          rawBlob: blob,
          rotationDeg: 0,
          autoCropped: true,
          cornersNorm: active.cornersNorm
        }).catch(() => {});
      }
      closeCropPerspectiveSheet();
      updateScannerHeaderCount();
      if (shouldOpenReviewAfter) {
        await openScanReviewStage();
      } else {
        await renderScanReviewStage(true);
      }
      const fullSheet = document.getElementById('scanFullPreviewSheet');
      if (fullSheet && fullSheet.classList.contains('show')) {
        await renderScanFullPreviewImage();
      }
      showToast(warped.paperName ? `Halaman diluruskan (${warped.paperName}).` : 'Halaman diluruskan.');
      return;
    }

    cropReturnToScanReview = false;
    cropOpenReviewAfterSave = false;
    const pdfBlob = await buildSingleImagePdfBlob(warped.dataUrl, warped.width, warped.height);
    const saved = await AttaStorage.saveFileRecord({
      name: `${cropSourceFileName} (${tr('Lurus')}).pdf`,
      category: 'scan',
      toolOrigin: 'crop_4corner',
      mimeType: 'application/pdf',
      blob: pdfBlob,
      thumbnailDataUrl: warped.dataUrl,
      filterUsed: 'Luruskan 4 sudut',
      notes: warped.paperName ? `${warped.paperName}` : ''
    });
    lastScannedItemId = saved.id;
    closeCropPerspectiveSheet();
    showToast('Dokumen diluruskan dan disimpan.');
    await renderFileVault();
    openToolResultSheet(saved);
  } catch (err) {
    cropReturnToScanReview = false;
    cropOpenReviewAfterSave = false;
    showToast('Gagal meluruskan perspektif gambar.', true);
  }
}

/* ============================================================================
 * 8. LAYAR 3: ALAT PDF LENGKAP (DENGAN DUKUNGAN PILIH DARI DOKUMEN LOKAL)
 * ============================================================================ */
function openMergeSheet() {
  mergeSelection = [];
  renderMergeVaultList();
  const sheet = document.getElementById('mergeSheet');
  if (sheet) sheet.classList.add('show');
}

function closeMergeSheet() {
  const sheet = document.getElementById('mergeSheet');
  if (sheet) sheet.classList.remove('show');
}

function triggerMergeInput() {
  closeMergeSheet();
  const input = document.getElementById('mergePdfInput');
  if (input) input.click();
}

/* Gabung dari Dokumen: pengguna memilih berkas dan urutannya sendiri */
let mergeSelection = [];

async function renderMergeVaultList() {
  const el = document.getElementById('mergeVaultList');
  const btn = document.getElementById('mergeSelectedBtn');
  if (!el) return;
  const all = (await AttaStorage.getAllFiles()).filter(
    (f) => (f.blob || f.encrypted) && (f.mimeType === 'application/pdf' || (f.mimeType || '').startsWith('image/'))
  );
  if (!all.length) {
    el.innerHTML = '<p class="sheet-hint">Belum ada PDF atau foto di Dokumen.</p>';
  } else {
    el.innerHTML = all
      .map((item) => {
        const order = mergeSelection.indexOf(item.id);
        const on = order >= 0;
        return `
        <button type="button" class="merge-pick${on ? ' is-on' : ''}${item.encrypted ? ' is-locked-item' : ''}" aria-pressed="${on}" onclick="toggleMergeItem(${item.id})">
          <span class="merge-order" aria-hidden="true">${on ? order + 1 : ''}</span>
          <span class="merge-pick-body">
            <span class="file-row-name">${escapeHtml(stripExtensionForDisplay(item.name))}</span>
            <span class="file-row-meta">${escapeHtml(formatItemMetaLine(item, true))}</span>
          </span>
        </button>`;
      })
      .join('');
  }
  if (btn) {
    if (mergeSelection.length === 0) {
      btn.disabled = true;
      btn.textContent = 'Pilih minimal 2 berkas';
    } else if (mergeSelection.length === 1) {
      const firstItem = all.find((x) => x.id === mergeSelection[0]);
      const isSingleImage = Boolean(firstItem && (firstItem.mimeType || '').startsWith('image/'));
      btn.disabled = !isSingleImage;
      btn.textContent = isSingleImage ? 'Jadikan PDF (1 foto)' : 'Pilih minimal 2 berkas';
    } else {
      btn.disabled = false;
      btn.textContent = `Gabungkan ${mergeSelection.length} berkas`;
    }
  }
}

function toggleMergeItem(id) {
  const i = mergeSelection.indexOf(id);
  if (i >= 0) mergeSelection.splice(i, 1);
  else mergeSelection.push(id);
  renderMergeVaultList();
}

async function mergeSelectedVaultItems() {
  if (mergeSelection.length === 0) return;
  const files = [];
  for (const id of mergeSelection) {
    const item = await AttaStorage.getFileById(id);
    if (!item) continue;
    const plainBlob = await getPlainBlob(item);
    if (!plainBlob) return;
    files.push(new File([plainBlob], item.name, { type: item.mimeType }));
  }
  if (files.length === 1 && !files[0].type.startsWith('image/')) {
    showToast('Pilih minimal 2 berkas PDF untuk digabung.', true);
    return;
  }
  closeMergeSheet();
  await mergeFileObjects(files);
}

/** Satukan PDF dan foto (urutan sesuai daftar) menjadi satu PDF baru */
async function mergeFileObjects(files) {
  try {
    const { PDFDocument } = window.PDFLib;
    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      if (file.type === 'application/pdf') {
        const srcDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((pg) => mergedPdf.addPage(pg));
      } else if (file.type.startsWith('image/')) {
        const img = await AttaStorage.compressAndFilterImage(file, { maxDimension: 2000, quality: 0.85, filter: 'original' });
        const jpg = await mergedPdf.embedJpg(img.dataUrl);
        const page = mergedPdf.addPage([595.28, 841.89]);
        const scale = Math.min(547 / img.width, 794 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(jpg, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
      }
    }
    if (mergedPdf.getPageCount() === 0) throw new Error('Tidak ada halaman yang bisa digabung');
    const blob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
    const isSinglePhoto = files.length === 1 && files[0].type.startsWith('image/');
    const outName = isSinglePhoto
      ? `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`
      : `${currentLang === 'en' ? 'Merged' : 'Gabungan'} ${formatScanTitleId()}.pdf`;
    const saved = await AttaStorage.saveFileRecord({
      name: outName,
      category: 'pdf',
      toolOrigin: 'merge',
      mimeType: 'application/pdf',
      blob,
      filterUsed: isSinglePhoto ? 'Foto ke PDF' : 'Gabung PDF',
      notes: ''
    });
    lastScannedItemId = saved.id;
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast(
      isSinglePhoto
        ? 'Foto disimpan sebagai PDF.'
        : `${files.length} berkas digabung jadi ${mergedPdf.getPageCount()} halaman.`
    );
    openToolResultSheet(saved);
  } catch (err) {
    showToast('PDF tidak bisa digabung. Mungkin ada berkas yang rusak atau terkunci sandi.', true);
  }
}

async function handleMergePdfsTool(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  if (files.length === 0) return;
  if (files.length === 1 && !files[0].type.startsWith('image/')) {
    showToast('Pilih minimal 2 berkas PDF, atau 1 foto untuk dijadikan PDF.', true);
    return;
  }
  await mergeFileObjects(files);
}

/* Alat: Kecilkan Ukuran (Target 200 KB / 500 KB / 1 MB) */
async function openCompressTargetSheet() {
  await populateVaultPickerList('compressVaultPickerList', 'compressVaultItemById', false);
  const sheet = document.getElementById('compressTargetSheet');
  if (sheet) sheet.classList.add('show');
}

function closeCompressTargetSheet() {
  const sheet = document.getElementById('compressTargetSheet');
  if (sheet) sheet.classList.remove('show');
}

function selectCompressLimit(kbLimit) {
  pendingCompressTargetKB = kbLimit;
  const subEl = document.getElementById('compressTargetSub');
  if (subEl) {
    subEl.textContent = kbLimit >= 1024 ? 'Target maks 1 MB' : `Target maks ${kbLimit} KB`;
  }
  showToast(`Batas ukuran disetel ke ${kbLimit >= 1024 ? '1 MB' : kbLimit + ' KB'}. Pilih berkasnya.`);
}

function selectCompressLimitAndPick(kbLimit) {
  selectCompressLimit(kbLimit);
  triggerCompressFileInput();
}

function triggerCompressFileInput() {
  closeCompressTargetSheet();
  const input = document.getElementById('compressTargetInput');
  if (input) input.click();
}

async function compressVaultItemById(id) {
  closeCompressTargetSheet();
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  const fileObj = new File([plainBlob], item.name, { type: item.mimeType || 'application/pdf' });
  await processCompressFileObject(fileObj);
}

async function handleCompressToTargetTool(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await processCompressFileObject(file);
}

/**
 * Kecilkan sampai di bawah batas unggah. Dicoba bertahap dari kualitas tertinggi,
 * berhenti di percobaan pertama yang muat. Kalau tetap tidak muat, hasil terkecil
 * disimpan dan pengguna diberi tahu ukuran sebenarnya.
 */
async function processCompressFileObject(file) {
  const targetBytes = pendingCompressTargetKB * 1024;
  const limitLabel = pendingCompressTargetKB >= 1024 ? '1 MB' : `${pendingCompressTargetKB} KB`;
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  showToast(`Mengecilkan ke maksimal ${limitLabel}...`);

  try {
    let best = null;
    let saved = null;

    if (file.type.startsWith('image/')) {
      const steps = [
        [2000, 0.85], [1800, 0.75], [1600, 0.68], [1400, 0.6], [1200, 0.55],
        [1024, 0.5], [900, 0.45], [800, 0.4], [700, 0.35], [600, 0.3]
      ];
      for (const [maxDimension, quality] of steps) {
        const r = await AttaStorage.compressAndFilterImage(file, { maxDimension, quality, filter: 'original' });
        if (!best || r.blob.size < best.blob.size) best = { blob: r.blob, thumb: r.dataUrl };
        if (r.blob.size <= targetBytes) break;
      }
      saved = await AttaStorage.saveFileRecord({
        name: `${baseName} (${tr('maks')} ${limitLabel}).jpg`,
        category: 'scan',
        toolOrigin: 'compress',
        mimeType: 'image/jpeg',
        blob: best.blob,
        thumbnailDataUrl: best.thumb,
        filterUsed: `Maks ${limitLabel}`,
        originalSize: file.size,
        notes: ''
      });
      lastScannedItemId = saved.id;
    } else {
      // 1) Simpan ulang dengan object stream (teks tetap bisa disalin)
      const { PDFDocument } = window.PDFLib;
      const srcDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const resaved = new Blob([await srcDoc.save({ useObjectStreams: true })], { type: 'application/pdf' });
      best = { blob: resaved.size < file.size ? resaved : file, rasterized: false };

      // 2) Bila masih terlalu besar, gambar ulang halaman dengan resolusi dan kualitas lebih rendah
      if (best.blob.size > targetBytes) {
        const steps = [
          [1.6, 0.72], [1.4, 0.62], [1.2, 0.55], [1.0, 0.5], [0.9, 0.45],
          [0.8, 0.4], [0.7, 0.35], [0.6, 0.3], [0.5, 0.28]
        ];
        for (const [scale, quality] of steps) {
          const r = await AttaPdfRender.rasterizeWithRedactions(file, {}, { scale, quality });
          if (r.blob.size < best.blob.size) best = { blob: r.blob, rasterized: true };
          if (r.blob.size <= targetBytes) break;
        }
      }
      saved = await AttaStorage.saveFileRecord({
        name: `${baseName} (${tr('maks')} ${limitLabel}).pdf`,
        category: 'pdf',
        toolOrigin: 'compress',
        mimeType: 'application/pdf',
        blob: best.blob,
        filterUsed: `Maks ${limitLabel}`,
        originalSize: file.size,
        notes: ''
      });
      lastScannedItemId = saved.id;
    }

    await refreshToolHistoryCounts();
    await renderFileVault();
    const finalSize = formatSizeId(best.blob.size);
    if (best.blob.size <= targetBytes) {
      showToast(
        best.rasterized
          ? `Jadi ${finalSize}, muat batas ${limitLabel}. Teks di PDF ini tidak bisa disalin lagi.`
          : `Jadi ${finalSize}, muat batas ${limitLabel}.`
      );
    } else {
      showToast(`Paling kecil ${finalSize}, masih di atas ${limitLabel}. Coba pisahkan halamannya dulu.`, true);
    }
    openToolResultSheet(saved, `Ukuran akhir: ${finalSize}`);
  } catch (err) {
    showToast('Berkas belum bisa dikecilkan. PDF mungkin rusak atau dikunci sandi.', true);
  }
}

/* Alat: Beri Watermark */
async function openWatermarkSheet() {
  const input = document.getElementById('watermarkTextInput');
  const sheet = document.getElementById('watermarkSheet');
  if (input && !input.value) {
    input.value = pendingWatermarkText;
  }
  await populateVaultPickerList('watermarkVaultPickerList', 'watermarkVaultItemById', true);
  if (sheet) {
    sheet.classList.add('show');
  }
}

function closeWatermarkSheet() {
  const sheet = document.getElementById('watermarkSheet');
  if (sheet) sheet.classList.remove('show');
}

function confirmWatermarkTextAndPick() {
  const input = document.getElementById('watermarkTextInput');
  const text = input ? input.value.trim() : '';
  if (!text) {
    showToast('Tulis teks watermark terlebih dahulu.', true);
    return;
  }
  pendingWatermarkText = text;
  closeWatermarkSheet();

  const fileInput = document.getElementById('watermarkPdfInput');
  if (fileInput) fileInput.click();
}

async function watermarkVaultItemById(id) {
  const input = document.getElementById('watermarkTextInput');
  if (input && input.value.trim()) {
    pendingWatermarkText = input.value.trim();
  }
  closeWatermarkSheet();
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  const fileObj = new File([plainBlob], item.name, { type: 'application/pdf' });
  await processWatermarkFileObject(fileObj);
}

async function handleWatermarkPdfTool(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await processWatermarkFileObject(file);
}

async function processWatermarkFileObject(file) {
  const rawWmText = (pendingWatermarkText || 'SALINAN VERIFIKASI').toUpperCase();
  const wmText = rawWmText.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
  try {
    const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib;
    const ab = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const maxDiagWidth = Math.hypot(width, height) * 0.62;
      let fontSize = Math.min(36, Math.max(16, Math.floor(width / 14)));
      let textWidth = font.widthOfTextAtSize(wmText, fontSize);
      if (textWidth > maxDiagWidth && textWidth > 0) {
        fontSize = Math.max(12, Math.floor(fontSize * (maxDiagWidth / textWidth)));
        textWidth = font.widthOfTextAtSize(wmText, fontSize);
      }
      const angleRad = (34 * Math.PI) / 180;
      const x = width / 2 - (textWidth / 2) * Math.cos(angleRad);
      const y = height / 2 - (textWidth / 2) * Math.sin(angleRad);
      page.drawText(wmText, {
        x: Math.max(24, x),
        y: Math.max(24, y),
        size: fontSize,
        font,
        color: rgb(0.14, 0.27, 0.79),
        opacity: 0.22,
        rotate: degrees(34)
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const baseName = file.name.replace(/\.pdf$/i, '');

    const saved = await AttaStorage.saveFileRecord({
      name: `${baseName} (${tr('Watermark')}).pdf`,
      category: 'pdf',
      toolOrigin: 'watermark',
      mimeType: 'application/pdf',
      blob,
      filterUsed: `Watermark: ${wmText}`,
      notes: `${pages.length} halaman`
    });

    lastScannedItemId = saved.id;
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast('Watermark ditambahkan ke PDF.');
    openToolResultSheet(saved);
  } catch (err) {
    showToast('Gagal memberi watermark pada PDF.', true);
  }
}

/* Alat Halaman PDF: Split, Remove, Organize/Rotate, Page Numbers, Crop, Redact */
let pendingPageToolFile = null;

function getPageToolOriginKey(toolType = activePageToolType) {
  if (toolType === 'crop') return 'crop_pdf';
  return toolType || 'split';
}

async function openPageToolSheet(toolType) {
  activePageToolType = toolType;
  pendingPageToolFile = null;
  const titleEl = document.getElementById('pageToolSheetTitle');
  const descEl = document.getElementById('pageToolSheetDesc');
  const inputGroup = document.getElementById('pageToolInputGroup');
  const paramLabel = document.getElementById('pageToolParamLabel');
  const paramInput = document.getElementById('pageToolParamInput');
  const selectGroup = document.getElementById('pageToolSelectGroup');
  const selectLabel = document.getElementById('pageToolSelectLabel');
  const selectInput = document.getElementById('pageToolSelectInput');
  const fileInfoEl = document.getElementById('pageToolFileInfo');
  const execBtn = document.getElementById('pageToolExecuteBtn');
  const histCountEl = document.getElementById('pageToolHistoryCount');
  const sheet = document.getElementById('pageToolSheet');

  if (!sheet) return;

  inputGroup.classList.remove('is-hidden');
  selectGroup.classList.add('is-hidden');
  if (fileInfoEl) {
    fileInfoEl.textContent = '';
    fileInfoEl.classList.add('is-hidden');
  }
  if (execBtn) execBtn.textContent = 'Pilih PDF dari penyimpanan HP';

  if (toolType === 'split') {
    titleEl.textContent = 'Pisahkan halaman PDF';
    descEl.textContent = 'Masukkan rentang halaman yang ingin dipisahkan menjadi berkas PDF baru.';
    paramLabel.textContent = 'Rentang halaman (mis. 1, 2-3)';
    paramInput.value = '1, 2';
    paramInput.placeholder = 'Mis. 1, 2-3';
  } else if (toolType === 'remove') {
    titleEl.textContent = 'Hapus halaman PDF';
    descEl.textContent = 'Masukkan nomor halaman yang ingin dibuang dari dokumen PDF.';
    paramLabel.textContent = 'Nomor halaman yang dihapus';
    paramInput.value = '2';
    paramInput.placeholder = 'Mis. 2';
  } else if (toolType === 'organize') {
    titleEl.textContent = 'Susun dan putar halaman';
    descEl.textContent = 'Atur urutan halaman baru (kosongkan jika hanya ingin memutar seluruh halaman).';
    paramLabel.textContent = 'Urutan halaman baru (opsional)';
    paramInput.value = '';
    paramInput.placeholder = 'Mis. 2, 1';
    selectGroup.classList.remove('is-hidden');
    selectLabel.textContent = 'Rotasi halaman';
    selectInput.innerHTML = `
      <option value="90" selected>Putar 90 derajat searah jarum jam</option>
      <option value="180">Putar 180 derajat</option>
      <option value="270">Putar 270 derajat</option>
      <option value="0">Tanpa rotasi (hanya ubah urutan)</option>
    `;
  } else if (toolType === 'pagenum') {
    titleEl.textContent = 'Nomor halaman otomatis';
    descEl.textContent = 'Sisipkan penomoran Halaman 1 dari N pada setiap lembar PDF.';
    paramLabel.textContent = 'Format teks nomor halaman';
    paramInput.value = currentLang === 'en' ? 'Page {page} of {total}' : 'Halaman {page} dari {total}';
    selectGroup.classList.remove('is-hidden');
    selectLabel.textContent = 'Posisi nomor halaman';
    selectInput.innerHTML = `
      <option value="bottom" selected>Bawah tengah (Footer)</option>
      <option value="top">Atas tengah (Header)</option>
    `;
  } else if (toolType === 'crop') {
    titleEl.textContent = 'Potong margin PDF';
    descEl.textContent = 'Rapikan tepi kosong di sekeliling halaman PDF.';
    paramLabel.textContent = 'Lebar margin yang dipotong (point, 10 sampai 72)';
    paramInput.value = '28';
  } else if (toolType === 'redact') {
    titleEl.textContent = 'Samarkan info';
    descEl.textContent = 'Pilih PDF, lalu tandai bagian yang ingin ditutup hitam di setiap halaman.';
    inputGroup.classList.add('is-hidden');
  }

  if (histCountEl && AttaStorage.getToolOriginCounts) {
    const counts = await AttaStorage.getToolOriginCounts();
    histCountEl.textContent = String(counts[getPageToolOriginKey(toolType)] || 0);
  }

  await populateVaultPickerList('pageToolVaultPickerList', 'runPageToolOnVaultItem', true);
  sheet.classList.add('show');
}

function closePageToolSheet() {
  pendingPageToolFile = null;
  const sheet = document.getElementById('pageToolSheet');
  if (sheet) sheet.classList.remove('show');
}

function openHistoryFromActivePageTool() {
  openToolHistorySheet(getPageToolOriginKey(activePageToolType));
}

async function triggerPageToolFilePicker() {
  if (pendingPageToolFile) {
    const file = pendingPageToolFile;
    pendingPageToolFile = null;
    await executePageToolOnFileObject(file);
    return;
  }
  const input = document.getElementById('pageToolFileInput');
  if (input) input.click();
}

async function inspectAndSelectPageToolFile(file) {
  if (!file) return;
  if (activePageToolType === 'redact') {
    await executePageToolOnFileObject(file);
    return;
  }
  pendingPageToolFile = file;
  const pages = await AttaStorage.countPdfPages(file);
  const fileInfoEl = document.getElementById('pageToolFileInfo');
  const execBtn = document.getElementById('pageToolExecuteBtn');
  if (fileInfoEl) {
    const pageStr = pages ? `${pages} halaman` : 'PDF';
    fileInfoEl.textContent = `${stripExtensionForDisplay(file.name)} (${pageStr}, ${formatSizeId(file.size)})`;
    fileInfoEl.classList.remove('is-hidden');
  }
  if (execBtn) {
    execBtn.textContent = 'Proses berkas ini';
  }
}

async function runPageToolOnVaultItem(id) {
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  const fileObj = new File([plainBlob], item.name, { type: 'application/pdf' });
  await inspectAndSelectPageToolFile(fileObj);
}

async function handlePageToolFileInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await inspectAndSelectPageToolFile(file);
}

async function executePageToolOnFileObject(file) {
  const paramInput = document.getElementById('pageToolParamInput');
  const selectInput = document.getElementById('pageToolSelectInput');
  const paramVal = paramInput ? paramInput.value.trim() : '';
  const selectVal = selectInput ? selectInput.value : '';
  const baseName = file.name.replace(/\.pdf$/i, '');

  closePageToolSheet();

  try {
    if (activePageToolType === 'split') {
      const outputs = await AttaToolsEngine.splitPdfByRangeString(file, paramVal || '1');
      let lastSaved = null;
      for (const out of outputs) {
        lastSaved = await AttaStorage.saveFileRecord({
          name: out.name,
          category: 'pdf',
          toolOrigin: 'split',
          mimeType: 'application/pdf',
          blob: out.blob,
          filterUsed: 'Pisah PDF',
          notes: `${out.pageCount} halaman`
        });
      }
      if (lastSaved) {
        lastScannedItemId = lastSaved.id;
        await refreshToolHistoryCounts();
        await renderFileVault();
        showToast(`${outputs.length} berkas PDF hasil pemisahan disimpan.`);
        openToolResultSheet(lastSaved, `${outputs.length} berkas terpisah`);
      }
    } else if (activePageToolType === 'remove') {
      const res = await AttaToolsEngine.removePagesFromPdf(file, paramVal || '1');
      const saved = await AttaStorage.saveFileRecord({
        name: `${baseName} (${tr('Tanpa Hal')} ${paramVal}).pdf`,
        category: 'pdf',
        toolOrigin: 'remove',
        mimeType: 'application/pdf',
        blob: res.blob,
        filterUsed: 'Hapus Halaman',
        notes: `${res.keptCount} halaman`
      });
      lastScannedItemId = saved.id;
      await refreshToolHistoryCounts();
      await renderFileVault();
      showToast(`${res.removedCount} halaman dihapus dari PDF.`);
      openToolResultSheet(saved);
    } else if (activePageToolType === 'organize') {
      const rot = parseInt(selectVal, 10) || 0;
      const res = await AttaToolsEngine.organizeAndRotatePdf(file, paramVal, rot);
      const suffix = rot === 0 ? tr('Susun Ulang') : `${tr('Putar')} ${rot}°`;
      const saved = await AttaStorage.saveFileRecord({
        name: `${baseName} (${suffix}).pdf`,
        category: 'pdf',
        toolOrigin: 'organize',
        mimeType: 'application/pdf',
        blob: res.blob,
        filterUsed: 'Susun & Putar',
        notes: `${res.pageCount} halaman`
      });
      lastScannedItemId = saved.id;
      await refreshToolHistoryCounts();
      await renderFileVault();
      showToast('Urutan dan rotasi halaman PDF disimpan.');
      openToolResultSheet(saved);
    } else if (activePageToolType === 'pagenum') {
      const res = await AttaToolsEngine.addPageNumbersToPdf(
        file,
        selectVal || 'bottom',
        paramVal || (currentLang === 'en' ? 'Page {page} of {total}' : 'Halaman {page} dari {total}')
      );
      const saved = await AttaStorage.saveFileRecord({
        name: `${baseName} (${tr('Bernomor')}).pdf`,
        category: 'pdf',
        toolOrigin: 'pagenum',
        mimeType: 'application/pdf',
        blob: res.blob,
        filterUsed: 'Nomor Halaman',
        notes: `${res.pageCount} halaman`
      });
      lastScannedItemId = saved.id;
      await refreshToolHistoryCounts();
      await renderFileVault();
      showToast('Nomor halaman ditambahkan ke PDF.');
      openToolResultSheet(saved);
    } else if (activePageToolType === 'crop') {
      const marginPt = Math.max(8, Math.min(90, parseFloat(paramVal) || 28));
      const res = await AttaToolsEngine.cropPdfMargins(file, marginPt);
      const saved = await AttaStorage.saveFileRecord({
        name: `${baseName} (${tr('Potong Margin')}).pdf`,
        category: 'pdf',
        toolOrigin: 'crop_pdf',
        mimeType: 'application/pdf',
        blob: res.blob,
        filterUsed: 'Potong Margin',
        notes: `${res.pageCount} halaman`
      });
      lastScannedItemId = saved.id;
      await refreshToolHistoryCounts();
      await renderFileVault();
      showToast('Margin halaman PDF berhasil dirapikan.');
      openToolResultSheet(saved);
    } else if (activePageToolType === 'redact') {
      await openRedactEditor(file, baseName);
    }
  } catch (err) {
    showToast(err.message || 'Gagal memproses halaman PDF.', true);
  }
}

/* ============================================================================
 * Samarkan info (redaksi permanen) + toggle geser halaman
 * ============================================================================ */
const redactState = { file: null, baseName: '', page: 1, numPages: 1, rects: {}, drag: null, canvasImage: null };
const redactViewState = { fitMode: true, zoom: 1, panActive: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };

function setRedactTouchMode(mode) {
  redactTouchMode = mode === 'pan' ? 'pan' : 'draw';
  const canvas = document.getElementById('redactCanvas');
  const stage = document.getElementById('redactStage');
  if (canvas) canvas.classList.toggle('pan-mode', redactTouchMode === 'pan');
  if (stage) stage.classList.toggle('is-pan-mode', redactTouchMode === 'pan');
  document.querySelectorAll('#redactModeSeg button').forEach((btn) => {
    const active = btn.getAttribute('data-redact-mode') === redactTouchMode;
    btn.setAttribute('aria-checked', String(active));
  });
}

function applyRedactViewportSize() {
  const stage = document.getElementById('redactStage');
  const canvas = document.getElementById('redactCanvas');
  if (!stage || !canvas || !canvas.width || !canvas.height) return;
  const availW = Math.max(200, (stage.clientWidth || 320) - 20);
  const availH = Math.max(220, (stage.clientHeight || 360) - 20);
  const pageRatio = canvas.width / Math.max(1, canvas.height);
  let fitW = availW;
  let fitH = fitW / pageRatio;
  if (fitH > availH) {
    fitH = availH;
    fitW = fitH * pageRatio;
  }
  const scale = redactViewState.fitMode ? 1 : redactViewState.zoom;
  canvas.style.width = `${Math.round(fitW * scale)}px`;
  canvas.style.height = `${Math.round(fitH * scale)}px`;

  const fitBtn = document.getElementById('redactFitBtn');
  const zoomBadge = document.getElementById('redactZoomLabel');
  if (fitBtn) fitBtn.classList.toggle('is-active', redactViewState.fitMode);
  if (zoomBadge) zoomBadge.textContent = redactViewState.fitMode ? tr('Fit') : `${Math.round(scale * 100)}%`;
}

function fitRedactViewport() {
  redactViewState.fitMode = true;
  redactViewState.zoom = 1;
  applyRedactViewportSize();
  const stage = document.getElementById('redactStage');
  if (stage) {
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
  }
}

function stepRedactZoom(delta) {
  const base = redactViewState.fitMode ? 1 : redactViewState.zoom;
  redactViewState.zoom = Math.max(0.75, Math.min(2.8, Number((base + delta).toFixed(2))));
  redactViewState.fitMode = Math.abs(redactViewState.zoom - 1) < 0.05 && delta < 0;
  applyRedactViewportSize();
}

async function openRedactEditor(file, baseName) {
  redactState.file = file;
  redactState.baseName = baseName;
  redactState.page = 1;
  redactState.rects = {};
  redactState.drag = null;
  redactViewState.fitMode = true;
  redactViewState.zoom = 1;
  setRedactTouchMode('draw');
  const sheet = document.getElementById('redactEditorSheet');
  if (sheet) sheet.classList.add('show');
  await renderRedactPage();
}

function closeRedactEditor() {
  const sheet = document.getElementById('redactEditorSheet');
  if (sheet) sheet.classList.remove('show');
  redactState.file = null;
  redactState.canvasImage = null;
}

async function renderRedactPage() {
  const canvas = document.getElementById('redactCanvas');
  const label = document.getElementById('redactPageLabel');
  if (!canvas || !redactState.file) return;
  const renderWidth = Math.max(680, Math.min((canvas.parentElement.clientWidth || 360) * 2.4, 1280));
  try {
    const out = await AttaPdfRender.renderPageImage(redactState.file, redactState.page, renderWidth);
    redactState.numPages = out.numPages;
    redactState.canvasImage = out.canvas;
    canvas.width = out.canvas.width;
    canvas.height = out.canvas.height;
    drawRedactCanvas();
    applyRedactViewportSize();
    if (label) label.textContent = `Halaman ${redactState.page} dari ${redactState.numPages}`;
    document.getElementById('redactPrevBtn').disabled = redactState.page <= 1;
    document.getElementById('redactNextBtn').disabled = redactState.page >= redactState.numPages;
  } catch (err) {
    showToast('PDF ini tidak bisa dibuka. Coba berkas lain.', true);
    closeRedactEditor();
  }
}

function drawRedactCanvas() {
  const canvas = document.getElementById('redactCanvas');
  if (!canvas || !redactState.canvasImage) return;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(redactState.canvasImage, 0, 0);
  ctx.fillStyle = '#000000';
  const list = (redactState.rects[redactState.page] || []).concat(redactState.drag ? [redactState.drag] : []);
  for (const r of list) {
    const x = Math.min(r.x, r.x + r.w) * canvas.width;
    const y = Math.min(r.y, r.y + r.h) * canvas.height;
    ctx.fillRect(x, y, Math.abs(r.w) * canvas.width, Math.abs(r.h) * canvas.height);
  }
  const count = Object.values(redactState.rects).reduce((a, l) => a + l.length, 0);
  const saveBtn = document.getElementById('redactSaveBtn');
  if (saveBtn) saveBtn.disabled = count === 0;
  const undoBtn = document.getElementById('redactUndoBtn');
  if (undoBtn) undoBtn.disabled = !(redactState.rects[redactState.page] || []).length;
}

function redactPointerPos(ev) {
  const canvas = document.getElementById('redactCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height))
  };
}

function initRedactCanvas() {
  const canvas = document.getElementById('redactCanvas');
  const stage = document.getElementById('redactStage');
  if (!canvas) return;
  canvas.addEventListener('pointerdown', (ev) => {
    if (redactTouchMode === 'pan') return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    const p = redactPointerPos(ev);
    redactState.drag = { x: p.x, y: p.y, w: 0, h: 0 };
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (redactTouchMode === 'pan' || !redactState.drag) return;
    const p = redactPointerPos(ev);
    redactState.drag.w = p.x - redactState.drag.x;
    redactState.drag.h = p.y - redactState.drag.y;
    drawRedactCanvas();
  });
  const finish = () => {
    if (!redactState.drag) return;
    const d = redactState.drag;
    redactState.drag = null;
    if (d && Math.abs(d.w) > 0.01 && Math.abs(d.h) > 0.005) {
      const norm = {
        x: Math.min(d.x, d.x + d.w),
        y: Math.min(d.y, d.y + d.h),
        w: Math.abs(d.w),
        h: Math.abs(d.h)
      };
      (redactState.rects[redactState.page] = redactState.rects[redactState.page] || []).push(norm);
    }
    drawRedactCanvas();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  if (stage) {
    stage.addEventListener('pointerdown', (ev) => {
      if (redactTouchMode !== 'pan') return;
      redactViewState.panActive = true;
      redactViewState.startX = ev.clientX;
      redactViewState.startY = ev.clientY;
      redactViewState.scrollLeft = stage.scrollLeft;
      redactViewState.scrollTop = stage.scrollTop;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!redactViewState.panActive) return;
      stage.scrollLeft = redactViewState.scrollLeft - (ev.clientX - redactViewState.startX);
      stage.scrollTop = redactViewState.scrollTop - (ev.clientY - redactViewState.startY);
    });
    const endPan = () => {
      redactViewState.panActive = false;
    };
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
  }
}

async function changeRedactPage(delta) {
  const next = redactState.page + delta;
  if (next < 1 || next > redactState.numPages) return;
  redactState.page = next;
  await renderRedactPage();
}

function undoRedactBox() {
  const list = redactState.rects[redactState.page] || [];
  list.pop();
  drawRedactCanvas();
}

async function saveRedactedPdf() {
  if (!redactState.file) return;
  const btn = document.getElementById('redactSaveBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
  }
  try {
    const res = await AttaPdfRender.rasterizeWithRedactions(redactState.file, redactState.rects);
    const saved = await AttaStorage.saveFileRecord({
      name: `${redactState.baseName} (${currentLang === 'en' ? 'Redacted' : 'Disamarkan'}).pdf`,
      category: 'pdf',
      toolOrigin: 'redact',
      mimeType: 'application/pdf',
      blob: res.blob,
      filterUsed: 'Disamarkan',
      notes: ''
    });
    lastScannedItemId = saved.id;
    closeRedactEditor();
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast('Versi tersamarkan disimpan.');
    openToolResultSheet(saved);
  } catch (err) {
    showToast('Gagal menyamarkan PDF. Coba lagi.', true);
  } finally {
    if (btn) btn.textContent = 'Simpan versi tersamarkan';
  }
}

/* Alat: KTP Depan & Belakang ke 1 Lembar A4 */
function openIdCardStitchSheet() {
  const sheet = document.getElementById('idCardStitchSheet');
  if (sheet) sheet.classList.add('show');
}

function closeIdCardStitchSheet() {
  const sheet = document.getElementById('idCardStitchSheet');
  if (sheet) sheet.classList.remove('show');
}

function triggerIdCardFilesPicker() {
  const input = document.getElementById('idCardFilesInput');
  if (input) input.click();
}

async function handleIdCardStitchInput(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  if (files.length < 2) {
    showToast('Pilih 2 foto kartu (sisi depan dan belakang).', true);
    return;
  }
  closeIdCardStitchSheet();
  try {
    const res = await AttaToolsEngine.stitchIdCardFrontBack(files[0], files[1], 'magic');
    const saved = await AttaStorage.saveFileRecord({
      name: `${tr('Kartu Identitas Depan Belakang A4')}.pdf`,
      category: 'scan',
      toolOrigin: 'idcard',
      mimeType: 'application/pdf',
      blob: res.pdfBlob,
      thumbnailDataUrl: res.thumbnailDataUrl,
      filterUsed: 'Kartu ID A4',
      notes: '1 halaman A4'
    });
    lastScannedItemId = saved.id;
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast('Kartu depan dan belakang disusun ke 1 lembar A4.');
    openToolResultSheet(saved);
  } catch (err) {
    showToast('Gagal menyusun foto kartu identitas.', true);
  }
}

/* Alat: Konversi Word, Excel, CSV, TXT ke PDF */
function triggerOfficeToPdfPicker() {
  const input = document.getElementById('officeToPdfInput');
  if (input) input.click();
}

async function handleOfficeToPdfInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;

  try {
    const res = await AttaToolsEngine.convertOfficeDocumentToPdf(file);
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const saved = await AttaStorage.saveFileRecord({
      name: `${baseName}.pdf`,
      category: 'pdf',
      toolOrigin: 'office_to_pdf',
      mimeType: 'application/pdf',
      blob: res.blob,
      filterUsed: 'Konversi ke PDF',
      notes: `${res.pageCount} halaman`
    });
    lastScannedItemId = saved.id;
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast(`Dokumen dikonversi ke PDF (${res.pageCount} halaman).`);
    openToolResultSheet(saved);
  } catch (err) {
    showToast(err.message || 'Gagal mengonversi dokumen ke PDF.', true);
  }
}

/* Alat: PDF ke Word (.doc), Excel (.csv), Markdown (.md), Teks (.txt) */
async function openPdfExportFormatSheet() {
  await populateVaultPickerList('exportVaultPickerList', 'exportVaultItemById', true);
  const sheet = document.getElementById('pdfExportFormatSheet');
  if (sheet) sheet.classList.add('show');
}

function closePdfExportFormatSheet() {
  const sheet = document.getElementById('pdfExportFormatSheet');
  if (sheet) sheet.classList.remove('show');
}

function syncExportFormatSelect(selectEl) {
  if (selectEl) pendingPdfExportFormat = selectEl.value;
}

function triggerPdfExportFileInput() {
  const sel = document.getElementById('exportFormatSelect');
  if (sel) pendingPdfExportFormat = sel.value;
  closePdfExportFormatSheet();
  const input = document.getElementById('pdfExportFileInput');
  if (input) input.click();
}

async function exportVaultItemById(id) {
  const sel = document.getElementById('exportFormatSelect');
  if (sel) pendingPdfExportFormat = sel.value;
  closePdfExportFormatSheet();
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  await executePdfExportOnBlob(plainBlob, item.name);
}

async function handlePdfExportFileInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await executePdfExportOnBlob(file, file.name);
}

async function executePdfExportOnBlob(blob, fileName) {
  try {
    const baseName = (fileName || 'Dokumen').replace(/\.pdf$/i, '');

    if (pendingPdfExportFormat === 'jpg') {
      showToast('Mengubah halaman PDF menjadi gambar...');
      const res = await AttaPdfRender.exportPagesAsJpegs(blob, { scale: 2, quality: 0.88, maxPages: 30 });
      if (!res.pages || res.pages.length === 0) {
        showToast('Halaman PDF tidak bisa diubah menjadi gambar.', true);
        return;
      }
      if (res.pages.length === 1) {
        const pg = res.pages[0];
        const saved = await AttaStorage.saveFileRecord({
          name: `${baseName}.jpg`,
          category: 'export',
          toolOrigin: 'pdf_export',
          mimeType: 'image/jpeg',
          blob: pg.blob,
          thumbnailDataUrl: pg.thumbDataUrl,
          filterUsed: 'PDF ke Gambar',
          notes: '1 halaman JPG'
        });
        lastScannedItemId = saved.id;
        await refreshToolHistoryCounts();
        await renderFileVault();
        showToast(`${baseName}.jpg disimpan.`);
        openToolResultSheet(saved);
      } else {
        const zip = new JSZip();
        let lastSaved = null;
        for (const pg of res.pages) {
          const jpgName = `${baseName} - Hal ${pg.pageNumber}.jpg`;
          zip.file(jpgName, pg.blob);
          lastSaved = await AttaStorage.saveFileRecord({
            name: jpgName,
            category: 'export',
            toolOrigin: 'pdf_export',
            mimeType: 'image/jpeg',
            blob: pg.blob,
            thumbnailDataUrl: pg.thumbDataUrl,
            filterUsed: 'PDF ke Gambar',
            notes: `Halaman ${pg.pageNumber} dari ${res.totalPages}`
          });
        }
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const savedZip = await AttaStorage.saveFileRecord({
          name: `${baseName}_Gambar_Halaman.zip`,
          category: 'export',
          toolOrigin: 'pdf_export',
          mimeType: 'application/zip',
          blob: zipBlob,
          filterUsed: 'PDF ke Gambar ZIP',
          notes: `${res.pages.length} gambar JPG`
        });
        lastScannedItemId = (savedZip || lastSaved).id;
        await refreshToolHistoryCounts();
        await renderFileVault();
        showToast(`${res.pages.length} halaman PDF disimpan sebagai gambar JPG.`);
        openToolResultSheet(savedZip || lastSaved, `${res.pages.length} gambar JPG`);
      }
      return;
    }

    const extractedText = await AttaToolsEngine.extractTextFromPdfBlob(blob, fileName);
    if (!extractedText || extractedText.replace(/\s+/g, '').length < 3) {
      showToast('PDF ini tidak punya teks yang bisa diambil. Kemungkinan isinya hasil scan.', true);
      return;
    }
    const out = AttaToolsEngine.convertTextToOutputBlob(extractedText, baseName, pendingPdfExportFormat);
    const outBlob = out.build ? await AttaToolsEngine.buildDocxBlob(extractedText, baseName) : out.blob;

    const saved = await AttaStorage.saveFileRecord({
      name: `${baseName}${out.ext}`,
      category: 'export',
      toolOrigin: 'pdf_export',
      mimeType: out.mime,
      blob: outBlob,
      filterUsed: `Ekspor ${out.ext.toUpperCase()}`,
      notes: 'Hasil konversi'
    });

    lastScannedItemId = saved.id;
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast(`${baseName}${out.ext} disimpan.`);
    openToolResultSheet(saved);
  } catch (err) {
    showToast('Isi PDF gagal diambil. Coba berkas lain.', true);
  }
}

/* Alat: Perbaiki Struktur PDF (Repair PDF) */
async function openRepairPdfSheet() {
  await populateVaultPickerList('repairVaultPickerList', 'repairVaultItemById', true);
  const sheet = document.getElementById('repairPdfSheet');
  if (sheet) sheet.classList.add('show');
}

function closeRepairPdfSheet() {
  const sheet = document.getElementById('repairPdfSheet');
  if (sheet) sheet.classList.remove('show');
}

function triggerRepairPdfPicker() {
  closeRepairPdfSheet();
  const input = document.getElementById('repairPdfInput');
  if (input) input.click();
}

async function repairVaultItemById(id) {
  closeRepairPdfSheet();
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  const fileObj = new File([plainBlob], item.name, { type: 'application/pdf' });
  await executeRepairOnFileObject(fileObj);
}

async function handleRepairPdfInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await executeRepairOnFileObject(file);
}

async function executeRepairOnFileObject(file) {
  try {
    const res = await AttaToolsEngine.repairPdfFile(file);
    const baseName = file.name.replace(/\.pdf$/i, '');
    const saved = await AttaStorage.saveFileRecord({
      name: `${baseName} (${tr('Diperbaiki')}).pdf`,
      category: 'pdf',
      toolOrigin: 'repair',
      mimeType: 'application/pdf',
      blob: res.blob,
      filterUsed: 'Perbaikan PDF',
      notes: `${res.pageCount} halaman`
    });
    lastScannedItemId = saved.id;
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast(`Struktur PDF berhasil diperbaiki (${res.pageCount} halaman).`);
    openToolResultSheet(saved);
  } catch (err) {
    showToast('Berkas PDF rusak berat dan tidak dapat dipulihkan.', true);
  }
}

/* Alat: Bandingkan 2 Dokumen PDF */
function openComparePdfSheet() {
  const outEl = document.getElementById('compareResultOutput');
  const saveBtn = document.getElementById('saveCompareReportBtn');
  const sheet = document.getElementById('comparePdfSheet');
  lastCompareReportText = '';
  if (outEl) {
    outEl.textContent = '';
    outEl.classList.add('is-hidden');
  }
  if (saveBtn) saveBtn.classList.add('is-hidden');
  if (sheet) sheet.classList.add('show');
}

function closeComparePdfSheet() {
  const sheet = document.getElementById('comparePdfSheet');
  if (sheet) sheet.classList.remove('show');
}

function triggerComparePdfPicker() {
  const input = document.getElementById('comparePdfFilesInput');
  if (input) input.click();
}

async function compareLatestTwoVaultPdfs() {
  const all = await AttaStorage.getAllFiles();
  const pdfs = all.filter((f) => f.mimeType === 'application/pdf' && (f.blob || f.encrypted));
  if (pdfs.length < 2) {
    showToast('Minimal harus ada 2 dokumen PDF di HP untuk dibandingkan.', true);
    return;
  }
  const b1 = await getPlainBlob(pdfs[0]);
  if (!b1) return;
  const b2 = await getPlainBlob(pdfs[1]);
  if (!b2) return;
  const f1 = new File([b1], pdfs[0].name, { type: 'application/pdf' });
  const f2 = new File([b2], pdfs[1].name, { type: 'application/pdf' });
  const report = await AttaToolsEngine.compareTwoPdfFiles(f1, f2);
  lastCompareReportText = report;
  const outEl = document.getElementById('compareResultOutput');
  const saveBtn = document.getElementById('saveCompareReportBtn');
  if (outEl) {
    outEl.textContent = report;
    outEl.classList.remove('is-hidden');
  }
  if (saveBtn) saveBtn.classList.remove('is-hidden');
  showToast('Perbandingan dua dokumen selesai.');
}

async function handleComparePdfInput(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  if (files.length < 2) {
    showToast('Pilih 2 berkas PDF sekaligus untuk dibandingkan.', true);
    return;
  }

  try {
    const report = await AttaToolsEngine.compareTwoPdfFiles(files[0], files[1]);
    lastCompareReportText = report;
    const outEl = document.getElementById('compareResultOutput');
    const saveBtn = document.getElementById('saveCompareReportBtn');
    if (outEl) {
      outEl.textContent = report;
      outEl.classList.remove('is-hidden');
    }
    if (saveBtn) saveBtn.classList.remove('is-hidden');
    showToast('Perbandingan dua dokumen selesai.');
  } catch (err) {
    showToast('Gagal membandingkan kedua berkas PDF.', true);
  }
}

async function saveCompareReportToVault() {
  if (!lastCompareReportText) return;
  const blob = new Blob([lastCompareReportText], { type: 'text/plain;charset=utf-8' });
  const saved = await AttaStorage.saveFileRecord({
    name: `${currentLang === 'en' ? 'Comparison Report' : 'Laporan Banding'} ${formatScanTitleId()}.txt`,
    category: 'export',
    toolOrigin: 'compare',
    mimeType: 'text/plain',
    blob,
    filterUsed: 'Bandingkan PDF',
    notes: 'Laporan selisih PDF'
  });
  lastScannedItemId = saved.id;
  closeComparePdfSheet();
  await refreshToolHistoryCounts();
  await renderFileVault();
  showToast('Laporan perbandingan disimpan.');
  openToolResultSheet(saved);
}

/* Alat: Analisis, OCR, Ringkasan & Terjemahan Dokumen */
async function openAnalyzeDocSheet() {
  await populateVaultPickerList('analyzeVaultPickerList', 'analyzeVaultItemById', false);
  const sheet = document.getElementById('analyzeDocSheet');
  if (sheet) sheet.classList.add('show');
}

function closeAnalyzeDocSheet() {
  const sheet = document.getElementById('analyzeDocSheet');
  if (sheet) sheet.classList.remove('show');
}

function triggerAnalyzeFilePicker() {
  const input = document.getElementById('analyzeFileInput');
  if (input) input.click();
}

async function analyzeVaultItemById(id) {
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  await runDocumentAnalysisOnBlob(plainBlob, item.name, item.mimeType);
}

async function handleAnalyzeFileInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await runDocumentAnalysisOnBlob(file, file.name, file.type);
}

let lastAnalyzedDocName = 'Dokumen';
let lastAnalyzedDocMode = 'summarize';

async function runDocumentAnalysisOnBlob(blobOrFile, fileName, mimeType, options = {}) {
  const modeSelect = document.getElementById('analyzeModeSelect');
  const apiKeyInput = document.getElementById('geminiApiKeyInput');
  const consentCheckbox = document.getElementById('geminiConsentCheckbox');
  const badgeEl = document.getElementById('analyzeModeBadge');
  const outEl = document.getElementById('analyzeResultOutput');
  const copyBtn = document.getElementById('copyAnalysisBtn');
  const saveBtn = document.getElementById('saveAnalysisBtn');

  const mode = modeSelect ? modeSelect.value : 'summarize';
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
  const allowExternal = !options.forceLocal && Boolean(consentCheckbox && consentCheckbox.checked && apiKey);
  const type = mimeType || blobOrFile.type || '';
  const lowerName = (fileName || '').toLowerCase();

  lastAnalyzedDocName = (fileName || 'Dokumen').replace(/\.[^/.]+$/, '');
  lastAnalyzedDocMode = mode;

  // Kunci disimpan hanya di HP ini dan tidak ikut file cadangan
  await AttaStorage.setSetting('gemini_api_key', apiKey);

  if (badgeEl) badgeEl.classList.add('is-hidden');
  if (outEl) {
    outEl.textContent = tr('Membaca isi dokumen...');
    outEl.classList.remove('is-hidden');
  }
  if (copyBtn) copyBtn.classList.add('is-hidden');
  if (saveBtn) saveBtn.classList.add('is-hidden');

  try {
    let rawText = '';
    if (type === 'application/pdf' || lowerName.endsWith('.pdf')) {
      rawText = await AttaToolsEngine.extractTextFromPdfBlob(blobOrFile, fileName);
    } else if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(lowerName)) {
      rawText = await AttaToolsEngine.runOfflineOcrOnBlob(blobOrFile);
    } else if (/\.(docx|xlsx|txt|md|csv)$/.test(lowerName) || type.startsWith('text/')) {
      rawText = await AttaToolsEngine.extractTextFromOfficeFile(blobOrFile, fileName);
    }

    if (!rawText || rawText.replace(/\s+/g, '').length < 3) {
      const msg = type.startsWith('image/') || /^scan /.test(lowerName)
        ? 'Tidak ada teks yang terbaca dari foto ini. Pastikan tulisan jelas atau jalankan di APK Android untuk OCR offline.'
        : 'Tidak ada teks yang bisa dibaca di berkas ini. Kemungkinan isinya hasil scan atau gambar.';
      if (outEl) outEl.textContent = tr(msg);
      return;
    }

    if (outEl && allowExternal) {
      outEl.textContent = tr('Mengirim teks ke Gemini...');
    }
    const resultText = await AttaToolsEngine.processWithGeminiOrLocal({
      text: rawText,
      mode,
      targetLang: 'Inggris',
      apiKey,
      allowExternal
    });

    const usedGemini = AttaToolsEngine.lastAnalysisMeta && AttaToolsEngine.lastAnalysisMeta.source === 'gemini';
    if (badgeEl) {
      badgeEl.textContent = usedGemini
        ? tr('Diproses melalui Google Gemini API atas persetujuan Anda.')
        : tr('Diproses 100% lokal di perangkat ini — isi dokumen tidak dikirim keluar.');
      badgeEl.classList.remove('is-hidden');
    }

    if (outEl) outEl.textContent = resultText;
    if (copyBtn) copyBtn.classList.remove('is-hidden');
    if (saveBtn) saveBtn.classList.remove('is-hidden');
  } catch (err) {
    if (outEl) outEl.textContent = tr('Berkas ini tidak bisa dianalisis. Coba berkas lain.');
    showToast('Dokumen tidak bisa dianalisis.', true);
  }
}

async function copyAnalysisResultText() {
  const outEl = document.getElementById('analyzeResultOutput');
  if (!outEl || !outEl.textContent) return;
  try {
    if (isNativeAndroidApp() && typeof window.AttaNativeAndroid.copyText === 'function') {
      window.AttaNativeAndroid.copyText(outEl.textContent);
    } else {
      await navigator.clipboard.writeText(outEl.textContent);
    }
    showToast('Hasil analisis disalin ke papan klip.');
  } catch (_) {
    showToast('Teks siap disalin.', false);
  }
}

async function saveAnalysisResultToVault() {
  const outEl = document.getElementById('analyzeResultOutput');
  if (!outEl || !outEl.textContent) return;
  const isMd = lastAnalyzedDocMode === 'markdown';
  const ext = isMd ? '.md' : '.txt';
  const mime = isMd ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
  const suffix =
    lastAnalyzedDocMode === 'translate'
      ? tr('Terjemahan')
      : lastAnalyzedDocMode === 'markdown'
      ? 'Markdown'
      : tr('Ringkasan');
  const blob = new Blob([outEl.textContent], { type: mime });
  const saved = await AttaStorage.saveFileRecord({
    name: `${lastAnalyzedDocName} (${suffix})${ext}`,
    category: 'export',
    toolOrigin: 'analyze',
    mimeType: isMd ? 'text/markdown' : 'text/plain',
    blob,
    filterUsed: `Analisis: ${suffix}`,
    notes: 'Hasil analisis dokumen'
  });
  lastScannedItemId = saved.id;
  closeAnalyzeDocSheet();
  await refreshToolHistoryCounts();
  await renderFileVault();
  showToast('Hasil analisis disimpan ke Dokumen.');
  openToolResultSheet(saved);
}

/* ============================================================================
 * 9. SLIP TANDA TANGAN & TEMPEL TANDA TANGAN LANGSUNG KE PDF
 * ============================================================================ */
function initSignatureCanvas() {
  sigCanvas = document.getElementById('sigCanvas');
  if (!sigCanvas) return;
  sigCtx = sigCanvas.getContext('2d');
  clearSignatureCanvas();

  const getPos = (e) => {
    const rect = sigCanvas.getBoundingClientRect();
    const scaleX = sigCanvas.width / rect.width;
    const scaleY = sigCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const start = (e) => {
    e.preventDefault();
    isDrawingSig = true;
    hasSignatureStroke = true;
    const p = getPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!isDrawingSig) return;
    e.preventDefault();
    const p = getPos(e);
    sigCtx.lineTo(p.x, p.y);
    sigCtx.stroke();
  };

  const end = () => {
    isDrawingSig = false;
  };

  sigCanvas.addEventListener('mousedown', start);
  sigCanvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  sigCanvas.addEventListener('touchstart', start, { passive: false });
  sigCanvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);
}

function resizeSignatureCanvas() {
  if (!sigCanvas || !sigCtx) return;
  sigCtx.strokeStyle = currentSigColor;
  sigCtx.lineWidth = currentSigWidth;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
}

function clearSignatureCanvas() {
  if (!sigCanvas || !sigCtx) return;
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  sigCtx.strokeStyle = currentSigColor;
  sigCtx.lineWidth = currentSigWidth;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  hasSignatureStroke = false;
}

async function saveSignatureToVault() {
  if (!sigCanvas || !hasSignatureStroke) {
    showToast('Goreskan tanda tangan terlebih dahulu.', true);
    return;
  }

  const dataUrl = sigCanvas.toDataURL('image/png');
  sigCanvas.toBlob(async (blob) => {
    if (!blob) return;
    const stamp = formatScanTitleId();
    const saved = await AttaStorage.saveFileRecord({
      name: `${currentLang === 'en' ? 'Signature' : 'Tanda tangan'} ${stamp}.png`,
      category: 'signed',
      toolOrigin: 'sign',
      mimeType: 'image/png',
      blob,
      thumbnailDataUrl: dataUrl,
      filterUsed:
        currentSigColor === '#2445C9'
          ? 'Tinta biru'
          : currentSigColor === '#17202B'
          ? 'Tinta hitam'
          : currentSigColor === '#16308F'
          ? 'Tinta biru tua'
          : currentSigColor === '#B42318'
          ? 'Tinta merah'
          : `Tinta ${currentSigColor}`,
      notes: 'Tanda tangan'
    });
    lastScannedItemId = saved.id;
    clearSignatureCanvas();
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast('Tanda tangan disimpan.');
    openToolResultSheet(saved);
  }, 'image/png');
}

function parseHexColor(hexColor) {
  let hex = String(hexColor || '#2445C9').replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) return { r: 36, g: 69, b: 201 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function retintCanvasSignature(canvas, hexColor) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const { r, g, b } = parseHexColor(hexColor);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function retintSignatureDataUrl(dataUrl, hexColor) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve('');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width || 680;
      c.height = img.height || 300;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      const { r, g, b } = parseHexColor(hexColor);
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) {
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      const res = c.toDataURL('image/png');
      c.width = c.height = 0;
      resolve(res);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function selectSigColor(hexColor, btnEl) {
  currentSigColor = hexColor;
  window.currentSignatureColor = hexColor;
  if (sigCtx) sigCtx.strokeStyle = currentSigColor;
  if (sigCanvas && hasSignatureStroke) {
    retintCanvasSignature(sigCanvas, currentSigColor);
  }
  const palette = document.getElementById('sigColorPalette');
  if (palette) {
    palette.querySelectorAll('.sig-color-dot').forEach((dot) => {
      const isMatch = dot === btnEl || dot.getAttribute('data-color') === hexColor;
      dot.classList.toggle('is-active', isMatch);
      dot.setAttribute('aria-checked', String(isMatch));
    });
    const customBtn = document.getElementById('sigCustomColorBtn') || palette.querySelector('.sig-color-custom-wrap');
    if (customBtn) customBtn.classList.remove('is-active');
  }
}

function onSelectCustomSigColor(hexColor) {
  currentSigColor = hexColor;
  window.currentSignatureColor = hexColor;
  if (sigCtx) sigCtx.strokeStyle = currentSigColor;
  if (sigCanvas && hasSignatureStroke) {
    retintCanvasSignature(sigCanvas, currentSigColor);
  }
  const palette = document.getElementById('sigColorPalette');
  if (palette) {
    palette.querySelectorAll('.sig-color-dot').forEach((dot) => {
      dot.classList.remove('is-active');
      dot.setAttribute('aria-checked', 'false');
    });
    const customBtn = document.getElementById('sigCustomColorBtn') || palette.querySelector('.sig-color-custom-wrap');
    if (customBtn) customBtn.classList.add('is-active');
  }
  const swatch = document.getElementById('sigCustomColorSwatch');
  if (swatch) swatch.style.background = hexColor;
}

const CUSTOM_INK_PRESETS = [
  '#2445C9', '#17202B', '#16308F', '#B42318', '#0F766E', '#6D28D9',
  '#0369A1', '#BE123C', '#9A3412', '#15803D', '#374151', '#7C2D12'
];

function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const col = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * col).toString(16).padStart(2, '0').toUpperCase();
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHueAndLight(hex) {
  const { r, g, b } = parseHexColor(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h: Math.round(h), l: Math.max(10, Math.min(75, Math.round(l * 100))) };
}

function renderCustomColorPreviewUI(hex) {
  customColorSelectedHex = hex;
  const chip = document.getElementById('customColorPreviewChip');
  const hexIn = document.getElementById('customColorHexInput');
  if (chip) chip.style.background = hex;
  if (hexIn && document.activeElement !== hexIn) hexIn.value = hex;
  document.querySelectorAll('#customColorPresets .custom-color-swatch').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-hex') === hex.toUpperCase());
  });
}

function openCustomColorSheet(target = 'draw') {
  customColorTarget = target === 'stamp' ? 'stamp' : 'draw';
  const startHex = customColorSelectedHex || currentSigColor || '#2445C9';
  const grid = document.getElementById('customColorPresets');
  if (grid && !grid.childElementCount) {
    grid.innerHTML = CUSTOM_INK_PRESETS.map(
      (hex) =>
        `<button type="button" class="custom-color-swatch" data-hex="${hex}" style="--swatch:${hex};" aria-label="${hex}" onclick="pickCustomColorPreset('${hex}')"></button>`
    ).join('');
  }
  const { h, l } = hexToHueAndLight(startHex);
  const hueEl = document.getElementById('customHueSlider');
  const lightEl = document.getElementById('customLightSlider');
  if (hueEl) hueEl.value = String(h);
  if (lightEl) lightEl.value = String(l);
  renderCustomColorPreviewUI(startHex);
  const sheet = document.getElementById('customColorSheet');
  if (sheet) sheet.classList.add('show');
}

function pickCustomColorPreset(hex) {
  const { h, l } = hexToHueAndLight(hex);
  const hueEl = document.getElementById('customHueSlider');
  const lightEl = document.getElementById('customLightSlider');
  if (hueEl) hueEl.value = String(h);
  if (lightEl) lightEl.value = String(l);
  renderCustomColorPreviewUI(hex);
}

function updateCustomColorFromSliders() {
  const h = parseFloat(document.getElementById('customHueSlider')?.value || '226');
  const l = parseFloat(document.getElementById('customLightSlider')?.value || '42');
  renderCustomColorPreviewUI(hslToHex(h, 78, l));
}

function updateCustomColorFromHex(val) {
  const cleaned = String(val || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
    renderCustomColorPreviewUI(cleaned.toUpperCase());
  }
}

function confirmCustomColorSheet() {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(customColorSelectedHex) ? customColorSelectedHex.toUpperCase() : '#2445C9';
  closeCustomColorSheet();
  if (customColorTarget === 'stamp') {
    changeStampSignatureColor(hex);
  } else {
    onSelectCustomSigColor(hex);
  }
}

function closeCustomColorSheet() {
  const sheet = document.getElementById('customColorSheet');
  if (sheet) sheet.classList.remove('show');
}

function onSigStrokeWidthChange(val) {
  currentSigWidth = parseFloat(val) || 2.6;
  if (sigCtx) sigCtx.lineWidth = currentSigWidth;
  const label = document.getElementById('sigStrokeVal');
  if (label) label.textContent = `${currentSigWidth.toFixed(1)} px`;
}

async function changeStampSignatureColor(hexColor, btnEl) {
  if (!stampStageState.rawSigDataUrl && stampStageState.sigDataUrl) {
    stampStageState.rawSigDataUrl = stampStageState.sigDataUrl;
  }
  const srcUrl = stampStageState.rawSigDataUrl || stampStageState.sigDataUrl;
  if (!srcUrl) return;

  const retinted = await retintSignatureDataUrl(srcUrl, hexColor);
  stampStageState.sigDataUrl = retinted;
  const img = document.getElementById('stampDragImg');
  if (img) img.src = retinted;

  const palette = document.getElementById('stampColorPalette');
  if (palette) {
    palette.querySelectorAll('.sig-color-dot').forEach((dot) => {
      const isMatch = dot === btnEl || dot.getAttribute('data-color') === hexColor;
      dot.classList.toggle('is-active', isMatch);
      dot.setAttribute('aria-checked', String(isMatch));
    });
    const customBtn = document.getElementById('stampCustomColorBtn') || palette.querySelector('.sig-color-custom-wrap');
    if (customBtn) {
      customBtn.classList.toggle(
        'is-active',
        !btnEl && !palette.querySelector(`.sig-color-dot[data-color="${hexColor}"]`)
      );
    }
  }
  const swatch = document.getElementById('stampCustomColorSwatch');
  if (swatch) swatch.style.background = hexColor;
}

async function rotateStampPreviewPage(deg = 90) {
  stampStageState.userRotationDeg = (((stampStageState.userRotationDeg || 0) + deg) % 360 + 360) % 360;
  await renderStampPreviewCanvas();
}

async function rotateStampSignature90() {
  const srcUrl = stampStageState.sigDataUrl;
  if (!srcUrl) return;
  try {
    const rotateUrl90 = async (url) => {
      const img = await AttaStorage._loadImageFromSource(url);
      const w = img.naturalWidth || img.width || 1;
      const h = img.naturalHeight || img.height || 1;
      const canvas = document.createElement('canvas');
      canvas.width = h;
      canvas.height = w;
      const ctx = canvas.getContext('2d');
      ctx.translate(h / 2, w / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -w / 2, -h / 2);
      const outUrl = canvas.toDataURL('image/png');
      canvas.width = canvas.height = 0;
      return { url: outUrl, aspect: h / Math.max(1, w) };
    };

    const rotated = await rotateUrl90(srcUrl);
    if (stampStageState.rawSigDataUrl && stampStageState.rawSigDataUrl !== srcUrl) {
      const rawRot = await rotateUrl90(stampStageState.rawSigDataUrl);
      stampStageState.rawSigDataUrl = rawRot.url;
    } else {
      stampStageState.rawSigDataUrl = rotated.url;
    }
    stampStageState.sigDataUrl = rotated.url;
    stampStageState.sigAspect = rotated.aspect;
    const dragImg = document.getElementById('stampDragImg');
    if (dragImg) dragImg.src = rotated.url;
    applyStampBoxDom();
    showToast('Tanda tangan diputar 90 derajat.');
  } catch (_) {
    showToast('Gagal memutar tanda tangan.', true);
  }
}

const stampStageState = {
  pdfBlob: null,
  origName: 'Dokumen.pdf',
  sigDataUrl: '',
  rawSigDataUrl: '',
  sigAspect: 2.2,
  pageIndex: 0,
  numPages: 1,
  userRotationDeg: 0,
  xNorm: 0.56,
  yNorm: 0.72,
  widthNorm: 0.30,
  dragMode: null, // null | 'move' | 'resize'
  startX: 0,
  startY: 0,
  startXNorm: 0.56,
  startYNorm: 0.72,
  startWidthNorm: 0.30
};

async function getSavedSignatureItems() {
  const all = await AttaStorage.getAllFiles();
  return all.filter(
    (f) => f.category === 'signed' && !f.encrypted && (f.mimeType || '').startsWith('image/') && f.blob
  );
}

function getSigAspectFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im.width > 0 && im.height > 0 ? im.width / im.height : 2.2);
    im.onerror = () => resolve(2.2);
    im.src = dataUrl;
  });
}

function selectStampSignatureChoice(dataUrl, btnEl) {
  stampStageState.sigDataUrl = dataUrl;
  stampStageState.rawSigDataUrl = dataUrl;
  document.querySelectorAll('#stampSavedSigsStrip .saved-sig-chip').forEach((b) => {
    b.classList.remove('is-selected');
  });
  if (btnEl) btnEl.classList.add('is-selected');
  getSigAspectFromDataUrl(dataUrl).then((asp) => {
    stampStageState.sigAspect = asp;
  });
}

const stampViewState = {
  fitMode: true,
  zoom: 1,
  touchMode: 'sig',
  panActive: false,
  panStartX: 0,
  panStartY: 0,
  scrollLeft: 0,
  scrollTop: 0
};

function setStampTouchMode(mode) {
  stampViewState.touchMode = mode === 'pan' ? 'pan' : 'sig';
  const wrap = document.getElementById('stampStageWrap');
  const stage = document.getElementById('stampPreviewStage');
  if (wrap) wrap.classList.toggle('is-pan-mode', stampViewState.touchMode === 'pan');
  if (stage) stage.classList.toggle('pan-mode', stampViewState.touchMode === 'pan');
  document.querySelectorAll('#stampTouchModeSeg button').forEach((btn) => {
    const active = btn.getAttribute('data-stamp-mode') === stampViewState.touchMode;
    btn.setAttribute('aria-checked', String(active));
  });
}

function applyStampStageViewportSize() {
  const wrap = document.getElementById('stampStageWrap');
  const stage = document.getElementById('stampPreviewStage');
  const canvas = document.getElementById('stampPreviewCanvas');
  if (!wrap || !stage || !canvas || !canvas.width || !canvas.height) return;
  const availW = Math.max(180, (wrap.clientWidth || 320) - 20);
  const availH = Math.max(200, (wrap.clientHeight || 340) - 20);
  const pageRatio = canvas.width / Math.max(1, canvas.height);
  let fitW = availW;
  let fitH = fitW / pageRatio;
  if (fitH > availH) {
    fitH = availH;
    fitW = fitH * pageRatio;
  }
  const scale = stampViewState.fitMode ? 1 : stampViewState.zoom;
  const wPx = Math.round(fitW * scale);
  const hPx = Math.round(fitH * scale);
  stage.style.width = `${wPx}px`;
  stage.style.height = `${hPx}px`;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const fitBtn = document.getElementById('stampFitBtn');
  const zoomLabel = document.getElementById('stampZoomLabel');
  if (fitBtn) fitBtn.classList.toggle('is-active', stampViewState.fitMode);
  if (zoomLabel) zoomLabel.textContent = stampViewState.fitMode ? tr('Fit') : `${Math.round(scale * 100)}%`;
  applyStampBoxDom();
}

function fitStampViewport() {
  stampViewState.fitMode = true;
  stampViewState.zoom = 1;
  applyStampStageViewportSize();
  const wrap = document.getElementById('stampStageWrap');
  if (wrap) {
    wrap.scrollLeft = 0;
    wrap.scrollTop = 0;
  }
}

function stepStampZoom(delta) {
  const base = stampViewState.fitMode ? 1 : stampViewState.zoom;
  stampViewState.zoom = Math.max(0.75, Math.min(2.8, Number((base + delta).toFixed(2))));
  stampViewState.fitMode = Math.abs(stampViewState.zoom - 1) < 0.05 && delta < 0;
  applyStampStageViewportSize();
}

function alignStampQuickPreset(preset) {
  const stage = document.getElementById('stampPreviewStage');
  const rect = stage ? stage.getBoundingClientRect() : { width: 300, height: 400 };
  const stageW = rect.width || 300;
  const stageH = rect.height || 400;
  const wPx = stampStageState.widthNorm * stageW;
  const hPx = wPx / Math.max(0.4, stampStageState.sigAspect);
  const hNorm = Math.min(0.6, hPx / stageH);

  if (preset === 'center') {
    stampStageState.xNorm = Math.max(0.02, (1 - stampStageState.widthNorm) * 0.5);
    stampStageState.yNorm = Math.max(0.02, (1 - hNorm) * 0.5);
  } else {
    stampStageState.xNorm = Math.max(0.02, 0.94 - stampStageState.widthNorm);
    stampStageState.yNorm = Math.max(0.02, 0.94 - hNorm);
  }
  applyStampBoxDom();
  showToast('Posisi tanda tangan dirapikan.');
}

function initStampInteractiveStage() {
  const stage = document.getElementById('stampPreviewStage');
  const wrap = document.getElementById('stampStageWrap');
  const box = document.getElementById('stampDragBox');
  const handle = document.getElementById('stampResizeHandle');
  if (!stage || !box || !handle) return;

  const beginDrag = (mode, ev) => {
    if (stampViewState.touchMode === 'pan') return;
    ev.preventDefault();
    ev.stopPropagation();
    stampStageState.dragMode = mode;
    stampStageState.startX = ev.clientX;
    stampStageState.startY = ev.clientY;
    stampStageState.startXNorm = stampStageState.xNorm;
    stampStageState.startYNorm = stampStageState.yNorm;
    stampStageState.startWidthNorm = stampStageState.widthNorm;
    if (box.setPointerCapture) {
      try {
        box.setPointerCapture(ev.pointerId);
      } catch (_) {}
    }
  };

  box.addEventListener('pointerdown', (ev) => {
    if (ev.target === handle) return;
    beginDrag('move', ev);
  });
  handle.addEventListener('pointerdown', (ev) => {
    beginDrag('resize', ev);
  });

  if (wrap) {
    wrap.addEventListener('pointerdown', (ev) => {
      if (stampViewState.touchMode !== 'pan') return;
      stampViewState.panActive = true;
      stampViewState.panStartX = ev.clientX;
      stampViewState.panStartY = ev.clientY;
      stampViewState.scrollLeft = wrap.scrollLeft;
      stampViewState.scrollTop = wrap.scrollTop;
    });
  }

  const onMove = (ev) => {
    if (stampViewState.panActive && wrap) {
      wrap.scrollLeft = stampViewState.scrollLeft - (ev.clientX - stampViewState.panStartX);
      wrap.scrollTop = stampViewState.scrollTop - (ev.clientY - stampViewState.panStartY);
      return;
    }
    if (!stampStageState.dragMode) return;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dxNorm = (ev.clientX - stampStageState.startX) / rect.width;
    const dyNorm = (ev.clientY - stampStageState.startY) / rect.height;

    if (stampStageState.dragMode === 'move') {
      const boxHeightNorm = (stampStageState.widthNorm * (rect.width / Math.max(1, stampStageState.sigAspect))) / rect.height;
      stampStageState.xNorm = Math.max(0.01, Math.min(0.99 - stampStageState.widthNorm, stampStageState.startXNorm + dxNorm));
      stampStageState.yNorm = Math.max(0.01, Math.min(0.99 - boxHeightNorm, stampStageState.startYNorm + dyNorm));
    } else if (stampStageState.dragMode === 'resize') {
      const nextW = Math.max(0.12, Math.min(0.62, stampStageState.startWidthNorm + dxNorm));
      stampStageState.widthNorm = Math.min(nextW, 0.99 - stampStageState.xNorm);
      const pct = Math.round(stampStageState.widthNorm * 100);
      const slider = document.getElementById('stampSizeSlider');
      const badge = document.getElementById('stampSizeValBadge');
      if (slider) slider.value = String(pct);
      if (badge) badge.textContent = `${pct}%`;
    }
    applyStampBoxDom();
  };

  const endDrag = () => {
    stampStageState.dragMode = null;
    stampViewState.panActive = false;
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => {
    const stampSheet = document.getElementById('stampSignSheet');
    if (stampSheet && stampSheet.classList.contains('show')) applyStampStageViewportSize();
    const redactSheet = document.getElementById('redactEditorSheet');
    if (redactSheet && redactSheet.classList.contains('show')) applyRedactViewportSize();
  });
}

function applyStampBoxDom() {
  const stage = document.getElementById('stampPreviewStage');
  const box = document.getElementById('stampDragBox');
  const img = document.getElementById('stampDragImg');
  if (!stage || !box) return;
  if (img && stampStageState.sigDataUrl && img.src !== stampStageState.sigDataUrl) {
    img.src = stampStageState.sigDataUrl;
  }
  const rect = stage.getBoundingClientRect();
  const stageW = rect.width || 300;
  const stageH = rect.height || 400;
  const wPx = stampStageState.widthNorm * stageW;
  const hPx = wPx / Math.max(0.4, stampStageState.sigAspect);
  const hNorm = Math.min(0.6, hPx / stageH);
  stampStageState.xNorm = Math.max(0.01, Math.min(0.99 - stampStageState.widthNorm, stampStageState.xNorm));
  stampStageState.yNorm = Math.max(0.01, Math.min(0.99 - hNorm, stampStageState.yNorm));
  box.style.left = `${(stampStageState.xNorm * 100).toFixed(2)}%`;
  box.style.top = `${(stampStageState.yNorm * 100).toFixed(2)}%`;
  box.style.width = `${(stampStageState.widthNorm * 100).toFixed(2)}%`;
  box.style.height = `${(hNorm * 100).toFixed(2)}%`;
}

async function openStampSignToPdfSheet() {
  const savedSigs = await getSavedSignatureItems();
  if ((!sigCanvas || !hasSignatureStroke) && savedSigs.length === 0) {
    showToast('Goreskan tanda tangan di kotak atau pilih tanda tangan tersimpan terlebih dahulu.', true);
    return;
  }

  const strip = document.getElementById('stampSavedSigsStrip');
  const choices = [];
  if (sigCanvas && hasSignatureStroke) {
    choices.push({ label: 'Kanvas sekarang', dataUrl: sigCanvas.toDataURL('image/png') });
  }
  for (const s of savedSigs.slice(0, 6)) {
    const url = s.thumbnailDataUrl || (await AttaStorage.blobToDataUrl(s.blob));
    choices.push({ label: stripExtensionForDisplay(s.name), dataUrl: url });
  }

  stampStageState.sigDataUrl = choices[0].dataUrl;
  stampStageState.rawSigDataUrl = choices[0].dataUrl;
  stampStageState.userRotationDeg = 0;
  stampStageState.sigAspect = await getSigAspectFromDataUrl(choices[0].dataUrl);

  if (strip) {
    strip.innerHTML = '';
    choices.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `saved-sig-chip${idx === 0 ? ' is-selected' : ''}`;
      btn.innerHTML = `<img src="${c.dataUrl}" alt="${escapeHtml(c.label)}" /><span>${escapeHtml(c.label)}</span>`;
      btn.onclick = () => selectStampSignatureChoice(c.dataUrl, btn);
      strip.appendChild(btn);
    });
  }

  await populateVaultPickerList('stampVaultPickerList', 'stampSignatureOnVaultItemById', true);

  const sourceStep = document.getElementById('stampSourceStep');
  const placeStep = document.getElementById('stampPlacementStep');
  if (sourceStep) sourceStep.classList.remove('is-hidden');
  if (placeStep) placeStep.classList.add('is-hidden');

  const sheet = document.getElementById('stampSignSheet');
  if (sheet) sheet.classList.add('show');

  if (pendingStampVaultItemId) {
    const targetId = pendingStampVaultItemId;
    pendingStampVaultItemId = null;
    const item = await AttaStorage.getFileById(targetId);
    if (item) {
      const plainBlob = await getPlainBlob(item);
      if (plainBlob) {
        await startStampPlacementOnPdfBlob(plainBlob, item.name);
      }
    }
  }
}

function closeStampSignToPdfSheet() {
  const sheet = document.getElementById('stampSignSheet');
  if (sheet) sheet.classList.remove('show');
  stampStageState.pdfBlob = null;
  stampStageState.userRotationDeg = 0;
  stampStageState.rawSigDataUrl = '';
}

function backToStampSourceStep() {
  const sourceStep = document.getElementById('stampSourceStep');
  const placeStep = document.getElementById('stampPlacementStep');
  if (placeStep) placeStep.classList.add('is-hidden');
  if (sourceStep) sourceStep.classList.remove('is-hidden');
}

async function stampSignatureOnVaultItemById(id) {
  const item = await AttaStorage.getFileById(id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  await startStampPlacementOnPdfBlob(plainBlob, item.name);
}

async function confirmStampSignTarget() {
  if (pendingStampVaultItemId) {
    const item = await AttaStorage.getFileById(pendingStampVaultItemId);
    pendingStampVaultItemId = null;
    if (item) {
      const plainBlob = await getPlainBlob(item);
      if (plainBlob) {
        await startStampPlacementOnPdfBlob(plainBlob, item.name);
        return;
      }
    }
  }
  const input = document.getElementById('stampPdfFileInput');
  if (input) input.click();
}

async function handleStampSignPdfInput(inputEl) {
  const file = (inputEl.files || [])[0];
  inputEl.value = '';
  if (!file) return;
  await startStampPlacementOnPdfBlob(file, file.name);
}

async function startStampPlacementOnPdfBlob(pdfBlob, origName) {
  if (!stampStageState.sigDataUrl && sigCanvas && hasSignatureStroke) {
    stampStageState.sigDataUrl = sigCanvas.toDataURL('image/png');
  }
  if (!stampStageState.sigDataUrl) {
    showToast('Pilih atau goreskan tanda tangan terlebih dahulu.', true);
    return;
  }

  stampStageState.pdfBlob = pdfBlob;
  stampStageState.origName = origName || 'Dokumen.pdf';
  stampStageState.widthNorm = 0.30;
  stampStageState.xNorm = 0.56;
  stampStageState.yNorm = 0.72;
  stampStageState.userRotationDeg = 0;
  if (!stampStageState.rawSigDataUrl && stampStageState.sigDataUrl) {
    stampStageState.rawSigDataUrl = stampStageState.sigDataUrl;
  }

  const slider = document.getElementById('stampSizeSlider');
  if (slider) slider.value = '30';
  const badge = document.getElementById('stampSizeValBadge');
  if (badge) badge.textContent = '30%';
  const allCheck = document.getElementById('stampAllPagesCheck');
  if (allCheck) allCheck.checked = false;

  stampViewState.fitMode = true;
  stampViewState.zoom = 1;
  setStampTouchMode('sig');

  const sourceStep = document.getElementById('stampSourceStep');
  const placeStep = document.getElementById('stampPlacementStep');
  if (sourceStep) sourceStep.classList.add('is-hidden');
  if (placeStep) placeStep.classList.remove('is-hidden');

  const count = (await AttaStorage.countPdfPages(pdfBlob)) || 1;
  stampStageState.numPages = count;
  stampStageState.pageIndex = Math.max(0, count - 1);
  await renderStampPreviewCanvas();
}

async function renderStampPreviewCanvas() {
  const canvas = document.getElementById('stampPreviewCanvas');
  const label = document.getElementById('stampPageLabel');
  const prevBtn = document.getElementById('stampPrevPageBtn');
  const nextBtn = document.getElementById('stampNextPageBtn');
  if (!canvas || !stampStageState.pdfBlob) return;

  try {
    const out = await AttaPdfRender.renderPageImage(
      stampStageState.pdfBlob,
      stampStageState.pageIndex + 1,
      960,
      stampStageState.userRotationDeg || 0
    );
    stampStageState.numPages = out.numPages || stampStageState.numPages;
    canvas.width = out.canvas.width;
    canvas.height = out.canvas.height;
    canvas.getContext('2d').drawImage(out.canvas, 0, 0);
    if (label) label.textContent = `Halaman ${stampStageState.pageIndex + 1} dari ${stampStageState.numPages}`;
    if (prevBtn) prevBtn.disabled = stampStageState.pageIndex <= 0;
    if (nextBtn) nextBtn.disabled = stampStageState.pageIndex >= stampStageState.numPages - 1;
    requestAnimationFrame(() => applyStampStageViewportSize());
  } catch (err) {
    showToast('Pratinjau halaman PDF gagal dimuat.', true);
    backToStampSourceStep();
  }
}

async function changeStampPreviewPage(delta) {
  const next = stampStageState.pageIndex + delta;
  if (next < 0 || next >= stampStageState.numPages) return;
  stampStageState.pageIndex = next;
  await renderStampPreviewCanvas();
}

function updateStampSizeFromSlider(valStr) {
  const pct = Math.max(12, Math.min(62, parseFloat(valStr) || 30));
  stampStageState.widthNorm = pct / 100;
  const badge = document.getElementById('stampSizeValBadge');
  if (badge) badge.textContent = `${Math.round(pct)}%`;
  applyStampBoxDom();
}

async function commitInteractiveSignatureStamp() {
  if (!stampStageState.pdfBlob || !stampStageState.sigDataUrl) return;
  const applyAll = Boolean(document.getElementById('stampAllPagesCheck')?.checked);
  await executeStampSignatureOnPdfBlob(stampStageState.pdfBlob, stampStageState.origName, {
    sigDataUrl: stampStageState.sigDataUrl,
    pageIndex: stampStageState.pageIndex,
    applyAll,
    xNorm: stampStageState.xNorm,
    yNorm: stampStageState.yNorm,
    widthNorm: stampStageState.widthNorm,
    userRotationDeg: stampStageState.userRotationDeg || 0
  });
}

async function executeStampSignatureOnPdfBlob(pdfBlob, origName, placementOpts = null) {
  const btn = document.getElementById('stampApplySaveBtn');
  if (btn) btn.disabled = true;
  try {
    const sigPngUrl = (placementOpts && placementOpts.sigDataUrl) || (sigCanvas ? sigCanvas.toDataURL('image/png') : '');
    const opts = placementOpts
      ? {
          pageIndex: placementOpts.pageIndex,
          applyAll: placementOpts.applyAll,
          xNorm: placementOpts.xNorm,
          yNorm: placementOpts.yNorm,
          widthNorm: placementOpts.widthNorm,
          userRotationDeg: placementOpts.userRotationDeg || 0
        }
      : { targetPages: 'last', position: 'bottom_right' };
    const res = await AttaToolsEngine.stampSignatureToPdf(pdfBlob, sigPngUrl, opts);
    const baseName = (origName || 'Dokumen').replace(/\.pdf$/i, '');
    const saved = await AttaStorage.saveFileRecord({
      name: `${baseName} (${tr('Ditandatangani')}).pdf`,
      category: 'signed',
      toolOrigin: 'sign',
      mimeType: 'application/pdf',
      blob: res.blob,
      filterUsed: 'Tanda tangan PDF',
      notes: `${res.pageCount} halaman`
    });
    lastScannedItemId = saved.id;
    clearSignatureCanvas();
    closeStampSignToPdfSheet();
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast('Tanda tangan ditempel ke PDF.');
    openToolResultSheet(saved);
  } catch (err) {
    showToast('Gagal menempelkan tanda tangan ke PDF.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================================
 * 10. LAYAR 4: CADANGAN & PEMULIHAN ZIP, CEK UPDATE & LISENSI PRO
 * ============================================================================ */
async function triggerExportBackupZip(shareAfterSave = false) {
  try {
    if (shareAfterSave && window.AttaLock) AttaLock.skipNext();
    const res = await AttaStorage.exportFullBackupZip(shareAfterSave);
    await refreshStorageMeterUI();
    showToast(
      shareAfterSave
        ? `${res.count} berkas disiapkan di ${res.zipName} untuk dibagikan.`
        : `${res.count} berkas dicadangkan ke ${res.zipName}.`
    );
  } catch (err) {
    showToast(`Cadangan gagal dibuat. ${err.message}.`, true);
  }
}

function triggerRestorePicker() {
  const input = document.getElementById('restoreArchiveInput');
  if (input) input.click();
}

async function triggerImportRestoreFile(inputEl) {
  const file = (inputEl.files || [])[0];
  if (!file) return;

  try {
    const res = await AttaStorage.importBackupArchive(file);
    await renderFileVault();
    backfillPdfThumbnails();
    showToast(`${res.restoredCount} berkas dipulihkan ke HP ini.`);
    switchTab('vault');
  } catch (err) {
    showToast(`Gagal memulihkan cadangan. ${err.message}`, true);
  } finally {
    inputEl.value = '';
  }
}

/** Tanya nomor versi langsung ke service worker baru, bukan ditulis tetap di kode */
function getWorkerVersion(worker) {
  return new Promise((resolve) => {
    try {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 1500);
      channel.port1.onmessage = (ev) => {
        clearTimeout(timer);
        resolve(ev.data && ev.data.version ? String(ev.data.version) : null);
      };
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch (_) {
      resolve(null);
    }
  });
}

function isNativeAndroidApp() {
  return typeof window !== 'undefined' && Boolean(window.AttaNativeAndroid);
}

function getVersionCheckEndpoint() {
  const cfg = typeof window !== 'undefined' && window.ATTA_CONFIG ? window.ATTA_CONFIG : null;
  const customUrl = cfg && typeof cfg.versionUrl === 'string' ? cfg.versionUrl.trim() : '';
  return customUrl || VERSION_CHECK_ENDPOINT;
}

function registerServiceWorkerWithAutoUpdate() {
  if (isNativeAndroidApp()) return;
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('./service-worker.js')
    .then((reg) => {
      if (reg.waiting) {
        waitingServiceWorker = reg.waiting;
        getWorkerVersion(reg.waiting).then((version) =>
          showUpdateNotificationPopup({
            version,
            changelog: 'Versi terbaru siap dipasang. Dokumen di HP ini tetap aman.'
          })
        );
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingServiceWorker = newWorker;
            getWorkerVersion(newWorker).then((version) =>
              showUpdateNotificationPopup({
                version,
                changelog: 'Pembaruan sudah diunduh dan siap dipasang.'
              })
            );
          }
        });
      });
    })
    .catch((err) => console.warn('Pendaftaran Service Worker:', err));

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function isNewerVersion(remote, local) {
  const r = String(remote).split('.').map((n) => parseInt(n, 10) || 0);
  const l = String(local).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

async function checkServerVersionAndUpdate(silent = false) {
  try {
    if ('serviceWorker' in navigator && !isNativeAndroidApp()) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    }

    const endpoint = getVersionCheckEndpoint();
    if (isNativeAndroidApp() && endpoint === VERSION_CHECK_ENDPOINT) {
      if (!silent) {
        showToast('Alamat cek update server belum diatur di config.js.');
      }
      return;
    }

    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`${endpoint}${sep}t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Offline');
    const data = await res.json();
    if (data && data.offline) throw new Error('Offline');

    if (data && data.latest_version && isNewerVersion(data.latest_version, APP_CURRENT_VERSION)) {
      showUpdateNotificationPopup({
        version: data.latest_version,
        changelog: data.changelog || 'Perbaikan dan peningkatan.',
        apkDownloadUrl: data.download_url || null
      });
    } else if (!silent) {
      showToast(`Sudah versi terbaru (${APP_CURRENT_VERSION}).`);
    }
  } catch (_) {
    if (!silent) {
      showToast('Tidak ada internet. Cek update lagi nanti.', true);
    }
  }
}

function showUpdateNotificationPopup({ version, changelog, apkDownloadUrl }) {
  const popup = document.getElementById('updatePopup');
  const verBadge = document.getElementById('updateVersionBadge');
  const logEl = document.getElementById('updateChangelogText');
  const swBtn = document.getElementById('updateSwApplyBtn');
  const apkBtn = document.getElementById('updateApkDirectBtn');

  if (verBadge && version) verBadge.textContent = version;
  if (logEl && changelog) logEl.textContent = changelog;

  const inApk = isNativeAndroidApp();
  if (swBtn) {
    swBtn.classList.toggle('is-hidden', inApk);
  }
  if (apkBtn) {
    if (apkDownloadUrl) {
      apkBtn.href = apkDownloadUrl;
      apkBtn.classList.remove('is-hidden');
      apkBtn.classList.toggle('btn-ink', inApk);
      apkBtn.classList.toggle('btn-out', !inApk);
    } else {
      apkBtn.href = '#';
      apkBtn.classList.add('is-hidden');
      apkBtn.classList.remove('btn-ink');
      apkBtn.classList.add('btn-out');
    }
  }
  if (popup) popup.classList.add('show');
}

function dismissUpdatePopup() {
  const popup = document.getElementById('updatePopup');
  if (popup) popup.classList.remove('show');
}

function applyServiceWorkerUpdateNow() {
  if (waitingServiceWorker) {
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

function setupInstallPromptListener() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('nativeInstallBtn');
    const guideBtn = document.getElementById('guideInstallBtn');
    if (installBtn) installBtn.classList.remove('is-hidden');
    if (guideBtn) guideBtn.classList.add('is-hidden');
  });
}

async function triggerAndroidInstall() {
  if (!deferredInstallPrompt) {
    openInstallGuideModal();
    return;
  }
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    showToast('Aplikasi dipasang ke layar utama.');
  }
  deferredInstallPrompt = null;
}

function openInstallGuideModal() {
  const modal = document.getElementById('installGuideModal');
  if (modal) modal.classList.add('show');
}

function closeInstallGuideModal() {
  const modal = document.getElementById('installGuideModal');
  if (modal) modal.classList.remove('show');
}

/** Di APK atau PWA yang sudah terpasang, baris "Pasang di layar utama" tidak perlu */
function hideInstallRowIfInstalled() {
  const standalone =
    isNativeAndroidApp() ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  const row = document.getElementById('installAppRow');
  if (standalone && row) row.classList.add('is-hidden');
}

/* ============================================================================
 * 11. TOAST & HELPER KEAMANAN HTML
 * ============================================================================ */
let toastTimer = null;
function showToast(message, isError = false, actionLabel = '', actionCallback = null) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.classList.toggle('error', Boolean(isError));
  if (actionLabel && typeof actionCallback === 'function') {
    toast.classList.add('has-action');
    toast.innerHTML = '';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = tr(message);
    const actBtn = document.createElement('button');
    actBtn.type = 'button';
    actBtn.className = 'toast-action';
    actBtn.textContent = tr(actionLabel);
    actBtn.onclick = () => {
      toast.classList.remove('show', 'has-action');
      clearTimeout(toastTimer);
      actionCallback();
    };
    toast.appendChild(msgSpan);
    toast.appendChild(actBtn);
  } else {
    toast.classList.remove('has-action');
    toast.textContent = message;
  }
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      toast.classList.remove('show', 'has-action');
    },
    actionLabel ? 5000 : 3000
  );
}

/** Kompatibilitas kontrak DOM DESIGN.md §8 */
function verifyLicenseInPwa() {
  showToast('Semua fitur di aplikasi ini sudah terbuka tanpa batas.');
}
window.verifyLicenseInPwa = verifyLicenseInPwa;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================================
 * 12. LAYAR HASIL PASCA-ALAT & RIWAYAT KHUSUS PER FITUR ALAT
 * ============================================================================ */
async function refreshToolHistoryCounts() {
  if (!window.AttaStorage || typeof AttaStorage.getToolOriginCounts !== 'function') return;
  try {
    const counts = await AttaStorage.getToolOriginCounts();
    document.querySelectorAll('[data-tool-count]').forEach((el) => {
      const origin = el.getAttribute('data-tool-count');
      el.textContent = String(counts[origin] || 0);
    });
    const histCountEl = document.getElementById('pageToolHistoryCount');
    if (histCountEl && activePageToolType) {
      histCountEl.textContent = String(counts[getPageToolOriginKey(activePageToolType)] || 0);
    }
  } catch (_) {}
}

function getToolOriginLabel(origin) {
  const meta = window.AttaStorage && AttaStorage.TOOL_ORIGIN_META && AttaStorage.TOOL_ORIGIN_META[origin];
  return meta ? tr(meta.label) : tr('Alat PDF');
}

function openToolResultSheet(savedItem, extraNote = '') {
  if (!savedItem) return;
  currentToolResultItem = savedItem;
  refreshToolHistoryCounts();

  const origin =
    savedItem.toolOrigin ||
    (window.AttaStorage && AttaStorage.inferToolOrigin ? AttaStorage.inferToolOrigin(savedItem) : 'import');

  const badgeEl = document.getElementById('toolResultOriginBadge');
  const thumbBox = document.getElementById('toolResultThumbBox');
  const nameEl = document.getElementById('toolResultFileName');
  const metaEl = document.getElementById('toolResultMetaLine');
  const nextWrap = document.getElementById('toolResultNextWrap');
  const nextChips = document.getElementById('toolResultNextChips');

  if (badgeEl) {
    badgeEl.textContent = `${tr('Tersimpan di:')} ${getToolOriginLabel(origin)}`;
  }
  if (thumbBox) {
    if (savedItem.thumbnailDataUrl) {
      thumbBox.innerHTML = `<img src="${savedItem.thumbnailDataUrl}" alt="" />`;
    } else {
      const extLabel =
        savedItem.mimeType === 'application/pdf'
          ? 'PDF'
          : (savedItem.name || '').split('.').pop().toUpperCase().slice(0, 4) || 'DOC';
      thumbBox.textContent = extLabel;
    }
  }
  if (nameEl) nameEl.textContent = stripExtensionForDisplay(savedItem.name);
  if (metaEl) {
    const baseMeta = formatItemMetaLine(savedItem);
    metaEl.textContent = extraNote ? `${baseMeta} · ${tr(extraNote)}` : baseMeta;
  }

  if (nextWrap && nextChips) {
    let actions = [];
    if (savedItem.mimeType === 'application/pdf') {
      actions = [
        ['compress', 'Kecilkan ukuran'],
        ['watermark', 'Beri watermark'],
        ['sign', 'Tempel tanda tangan'],
        ['organize', 'Susun / putar'],
        ['split', 'Pisah halaman'],
        ['redact', 'Samarkan info'],
        ['pdf_export', 'Konversi PDF'],
        ['analyze', 'Analisis / OCR']
      ];
    } else if ((savedItem.mimeType || '').startsWith('image/')) {
      actions = [
        ['compress', 'Kecilkan ukuran'],
        ['crop_4corner', 'Luruskan 4 sudut'],
        ['to_pdf', 'Jadikan PDF'],
        ['analyze', 'Baca teks OCR / Analisis']
      ];
    }

    const filteredActions = actions.filter(([key]) => key !== origin);
    if (filteredActions.length === 0) {
      nextWrap.classList.add('is-hidden');
      nextChips.innerHTML = '';
    } else {
      nextWrap.classList.remove('is-hidden');
      nextChips.innerHTML = filteredActions
        .map(
          ([key, label]) =>
            `<button type="button" class="chip-btn" onclick="triggerNextToolFromResult('${key}')">${escapeHtml(tr(label))}</button>`
        )
        .join('');
    }
  }

  const sheet = document.getElementById('toolResultSheet');
  if (sheet) sheet.classList.add('show');
}

function closeToolResultSheet() {
  const sheet = document.getElementById('toolResultSheet');
  if (sheet) sheet.classList.remove('show');
  renderFileVault();
}

async function handleToolResultPreview() {
  if (!currentToolResultItem) return;
  await previewItem(currentToolResultItem.id);
}

async function handleToolResultRename() {
  if (!currentToolResultItem) return;
  activeSheetItemId = currentToolResultItem.id;
  await openRenameSheet();
}

async function handleToolResultSavePhone(share = false) {
  if (!currentToolResultItem) return;
  await saveItemToPhone(currentToolResultItem.id, share);
}

async function openToolResultHistory() {
  if (!currentToolResultItem) return;
  const origin =
    currentToolResultItem.toolOrigin ||
    (window.AttaStorage && AttaStorage.inferToolOrigin ? AttaStorage.inferToolOrigin(currentToolResultItem) : 'import');
  closeToolResultSheet();
  await openToolHistorySheet(origin);
}

async function openCropPerspectiveFromBlob(blob, fileName) {
  const objUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(objUrl);
    cropReturnToScanReview = false;
    cropSourceImage = img;
    cropSourceFileName = (fileName || 'Dokumen').replace(/\.[^/.]+$/, '');
    cropRotationDeg = 0;
    resetCropCorners();
    const sheet = document.getElementById('cropPerspectiveSheet');
    if (sheet) sheet.classList.add('show');
  };
  img.onerror = () => {
    URL.revokeObjectURL(objUrl);
    showToast('Gambar tidak bisa dibuka untuk koreksi sudut.', true);
  };
  img.src = objUrl;
}

async function triggerNextToolFromResult(targetTool) {
  if (!currentToolResultItem) return;
  const item = await AttaStorage.getFileById(currentToolResultItem.id);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  const fileObj = new File([plainBlob], item.name, { type: item.mimeType || 'application/pdf' });
  const baseName = stripExtensionForDisplay(item.name);

  closeToolResultSheet();

  if (targetTool === 'compress') {
    await openCompressTargetSheet();
  } else if (targetTool === 'watermark') {
    await openWatermarkSheet();
  } else if (targetTool === 'sign') {
    pendingStampVaultItemId = item.id;
    await openStampSignToPdfSheet();
  } else if (targetTool === 'organize' || targetTool === 'split' || targetTool === 'remove' || targetTool === 'pagenum') {
    await openPageToolSheet(targetTool);
    await inspectAndSelectPageToolFile(fileObj);
  } else if (targetTool === 'redact') {
    await openRedactEditor(fileObj, baseName);
  } else if (targetTool === 'pdf_export') {
    await openPdfExportFormatSheet();
  } else if (targetTool === 'analyze') {
    await openAnalyzeDocSheet();
    await runDocumentAnalysisOnBlob(plainBlob, item.name, item.mimeType);
  } else if (targetTool === 'crop_4corner') {
    await openCropPerspectiveFromBlob(plainBlob, item.name);
  } else if (targetTool === 'to_pdf') {
    await mergeFileObjects([fileObj]);
  }
}

async function openToolHistoryHubSheet() {
  const listEl = document.getElementById('toolHistoryHubList');
  if (!listEl) return;
  const metaMap = (window.AttaStorage && AttaStorage.TOOL_ORIGIN_META) || {};
  const counts = (window.AttaStorage && AttaStorage.getToolOriginCounts) ? await AttaStorage.getToolOriginCounts() : {};
  const entries = Object.entries(metaMap);
  listEl.innerHTML = entries
    .map(([key, info]) => {
      const cnt = counts[key] || 0;
      return `
        <div class="tool-hub-row">
          <div class="tool-hub-info">
            <div class="tool-hub-title">${escapeHtml(tr(info.label))}</div>
            <div class="tool-hub-sub">${cnt > 0 ? escapeHtml(`${cnt} ${tr('berkas tersimpan')}`) : escapeHtml(tr('Belum ada berkas'))}</div>
          </div>
          <button type="button" class="btn-out" onclick="openToolHistorySheet('${key}')">${cnt > 0 ? escapeHtml(tr('Buka')) : '0'}</button>
        </div>
      `;
    })
    .join('');
  const sheet = document.getElementById('toolHistoryHubSheet');
  if (sheet) sheet.classList.add('show');
}

function closeToolHistoryHubSheet() {
  const sheet = document.getElementById('toolHistoryHubSheet');
  if (sheet) sheet.classList.remove('show');
}

async function openToolHistorySheet(origin) {
  activeToolHistoryOrigin = origin || 'import';
  const titleEl = document.getElementById('toolHistoryTitle');
  const descEl = document.getElementById('toolHistoryDesc');
  const label = getToolOriginLabel(activeToolHistoryOrigin);
  if (titleEl) titleEl.textContent = label;
  if (descEl) descEl.textContent = `${tr('Berkas yang dihasilkan melalui fitur:')} ${label}`;
  await renderToolHistorySheetList(activeToolHistoryOrigin);
  const sheet = document.getElementById('toolHistorySheet');
  if (sheet) sheet.classList.add('show');
}

async function renderToolHistorySheetList(origin) {
  const listEl = document.getElementById('toolHistoryFileList');
  if (!listEl) return;
  const items =
    window.AttaStorage && AttaStorage.getFilesByToolOrigin
      ? await AttaStorage.getFilesByToolOrigin(origin)
      : [];
  if (!items.length) {
    listEl.innerHTML = `<p class="sheet-desc">${escapeHtml(tr('Belum ada hasil tersimpan untuk fitur ini.'))}</p>`;
    return;
  }
  listEl.innerHTML = items
    .map(
      (item) => `
      <div class="tool-history-row">
        <div class="tool-hub-info" onclick="historyPreviewItem(${item.id})" style="cursor:pointer;">
          <div class="tool-hub-title">${escapeHtml(stripExtensionForDisplay(item.name))}</div>
          <div class="tool-hub-sub">${escapeHtml(formatItemMetaLine(item))}</div>
        </div>
        <div class="tool-history-actions">
          <button type="button" class="chip-btn" onclick="historyPreviewItem(${item.id})">${escapeHtml(tr('Lihat'))}</button>
          <button type="button" class="chip-btn" onclick="historySaveItem(${item.id})">${escapeHtml(tr('Simpan'))}</button>
          <button type="button" class="chip-btn" onclick="historyRenameItem(${item.id})">${escapeHtml(tr('Ubah nama'))}</button>
          <button type="button" class="chip-btn danger" onclick="historyDeleteItem(${item.id})">${escapeHtml(tr('Hapus'))}</button>
        </div>
      </div>
    `
    )
    .join('');
}

function closeToolHistorySheet() {
  const sheet = document.getElementById('toolHistorySheet');
  if (sheet) sheet.classList.remove('show');
}

function openToolOriginInVault() {
  const origin = activeToolHistoryOrigin;
  closeToolHistorySheet();
  closeToolHistoryHubSheet();
  closeMergeSheet();
  closeCompressTargetSheet();
  closeWatermarkSheet();
  closePageToolSheet();
  closeIdCardStitchSheet();
  closeStampSignToPdfSheet();
  closePdfExportFormatSheet();
  closeRepairPdfSheet();
  closeComparePdfSheet();
  closeAnalyzeDocSheet();
  closePhotoConvertSheet();
  if (origin) {
    filterVaultByToolOrigin(origin);
  }
  switchTab('vault');
}

async function historyPreviewItem(id) {
  await previewItem(id);
}

async function historySaveItem(id) {
  await saveItemToPhone(id, false);
}

async function historyRenameItem(id) {
  activeSheetItemId = id;
  await openRenameSheet();
}

async function historyDeleteItem(id) {
  await removeItem(id);
  await refreshToolHistoryCounts();
  if (activeToolHistoryOrigin) {
    await renderToolHistorySheetList(activeToolHistoryOrigin);
  }
}

/* ============================================================================
 * 13. R2: PRATINJAU PENUH HASIL EDIT SCAN (ZOOM & PAN RESOLUSI TINGGI)
 * ============================================================================ */
const scanFullPreviewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  pointerDown: false,
  startX: 0,
  startY: 0,
  origPanX: 0,
  origPanY: 0,
  lastTapAt: 0,
  gesturesBound: false
};

function applyScanFullTransform() {
  const wrap = document.getElementById('scanFullCanvasWrap');
  const label = document.getElementById('scanFullZoomLabel');
  const slider = document.getElementById('scanFullZoomSlider');
  if (scanFullPreviewState.zoom <= 1.01) {
    scanFullPreviewState.panX = 0;
    scanFullPreviewState.panY = 0;
  }
  if (wrap) {
    wrap.style.transform = `translate3d(${scanFullPreviewState.panX}px, ${scanFullPreviewState.panY}px, 0) scale(${scanFullPreviewState.zoom})`;
  }
  const pct = Math.round(scanFullPreviewState.zoom * 100);
  if (label) label.textContent = `${pct}%`;
  if (slider) slider.value = String(pct);
}

function resetScanFullPreviewTransform() {
  scanFullPreviewState.zoom = 1;
  scanFullPreviewState.panX = 0;
  scanFullPreviewState.panY = 0;
  applyScanFullTransform();
}

function stepScanFullZoom(delta) {
  scanFullPreviewState.zoom = Math.max(1, Math.min(3, Number((scanFullPreviewState.zoom + delta).toFixed(2))));
  applyScanFullTransform();
}

function setScanFullZoomPercent(valStr) {
  const pct = Math.max(100, Math.min(300, parseFloat(valStr) || 100));
  scanFullPreviewState.zoom = Number((pct / 100).toFixed(2));
  applyScanFullTransform();
}

function initScanFullPreviewGestures() {
  if (scanFullPreviewState.gesturesBound) return;
  const stage = document.getElementById('scanFullPreviewStage');
  if (!stage) return;
  scanFullPreviewState.gesturesBound = true;

  stage.addEventListener('pointerdown', (ev) => {
    const now = Date.now();
    if (now - scanFullPreviewState.lastTapAt < 280) {
      scanFullPreviewState.lastTapAt = 0;
      if (scanFullPreviewState.zoom > 1.05) {
        resetScanFullPreviewTransform();
      } else {
        scanFullPreviewState.zoom = 2;
        applyScanFullTransform();
      }
      return;
    }
    scanFullPreviewState.lastTapAt = now;
    if (scanFullPreviewState.zoom <= 1.01) return;
    scanFullPreviewState.pointerDown = true;
    scanFullPreviewState.startX = ev.clientX;
    scanFullPreviewState.startY = ev.clientY;
    scanFullPreviewState.origPanX = scanFullPreviewState.panX;
    scanFullPreviewState.origPanY = scanFullPreviewState.panY;
    try {
      stage.setPointerCapture(ev.pointerId);
    } catch (_) {}
  });

  stage.addEventListener('pointermove', (ev) => {
    if (!scanFullPreviewState.pointerDown) return;
    scanFullPreviewState.panX = scanFullPreviewState.origPanX + (ev.clientX - scanFullPreviewState.startX);
    scanFullPreviewState.panY = scanFullPreviewState.origPanY + (ev.clientY - scanFullPreviewState.startY);
    applyScanFullTransform();
  });

  const endPan = () => {
    scanFullPreviewState.pointerDown = false;
  };
  stage.addEventListener('pointerup', endPan);
  stage.addEventListener('pointercancel', endPan);

  stage.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      stepScanFullZoom(ev.deltaY < 0 ? 0.25 : -0.25);
    },
    { passive: false }
  );
}

async function renderScanFullPreviewImage() {
  if (!scanSessionPages.length) return;
  scanReviewActiveIdx = Math.max(0, Math.min(scanSessionPages.length - 1, scanReviewActiveIdx));
  const active = scanSessionPages[scanReviewActiveIdx];
  const img = document.getElementById('scanFullPreviewImg');
  const metaEl = document.getElementById('scanFullPreviewMeta');
  const prevBtn = document.getElementById('scanFullPrevBtn');
  const nextBtn = document.getElementById('scanFullNextBtn');

  const filterName = tr(SCAN_FILTER_NAMES[active.filter] || 'Warna Ajaib');
  if (metaEl) {
    metaEl.textContent = `${tr('Halaman')} ${scanReviewActiveIdx + 1} ${tr('dari')} ${scanSessionPages.length} • ${filterName}`;
  }
  if (prevBtn) prevBtn.disabled = scanReviewActiveIdx <= 0;
  if (nextBtn) nextBtn.disabled = scanReviewActiveIdx >= scanSessionPages.length - 1;

  if (img && active.dataUrl) {
    img.src = active.dataUrl;
  }

  const cacheKey = `${active.filter}:${active.rotationDeg || 0}:${active.width}x${active.height}`;
  if (active.highResPreviewKey === cacheKey && active.highResDataUrl) {
    if (img) img.src = active.highResDataUrl;
    return;
  }

  try {
    const hi = await AttaStorage.compressAndFilterImage(active.rawBlob, {
      maxDimension: 1800,
      quality: 0.9,
      filter: active.filter,
      rotationDeg: active.rotationDeg || 0
    });
    active.highResPreviewKey = cacheKey;
    active.highResDataUrl = hi.dataUrl;
    const sheet = document.getElementById('scanFullPreviewSheet');
    if (img && sheet && sheet.classList.contains('show') && scanSessionPages[scanReviewActiveIdx] === active) {
      img.src = hi.dataUrl;
    }
  } catch (_) {}
}

async function openScanFullPreview() {
  if (!scanSessionPages.length) return;
  initScanFullPreviewGestures();
  resetScanFullPreviewTransform();
  const sheet = document.getElementById('scanFullPreviewSheet');
  if (sheet) sheet.classList.add('show');
  await renderScanFullPreviewImage();
}

function closeScanFullPreview() {
  const sheet = document.getElementById('scanFullPreviewSheet');
  if (sheet) sheet.classList.remove('show');
}

async function stepScanFullPage(delta) {
  const next = scanReviewActiveIdx + delta;
  if (next < 0 || next >= scanSessionPages.length) return;
  scanReviewActiveIdx = next;
  resetScanFullPreviewTransform();
  await renderScanReviewStage(false);
  await renderScanFullPreviewImage();
}

async function openCropFromFullPreview() {
  await openCropForActiveScanPage();
}

async function rotateFromFullPreview() {
  await rotateActiveScanPage(90);
  resetScanFullPreviewTransform();
  await renderScanFullPreviewImage();
}

/* ============================================================================
 * 14. R4: KONVERSI FOTO KE PDF & FOTO KE WORD (.DOCX)
 * ============================================================================ */
const photoConvertState = {
  mode: 'pdf',
  items: []
};

function openPhotoToPdfSheet() {
  openPhotoConvertSheet('pdf');
}

function openPhotoToWordSheet() {
  openPhotoConvertSheet('docx');
}

async function openPhotoConvertSheet(mode = 'pdf') {
  photoConvertState.items = [];
  const modeSel = document.getElementById('photoConvertModeSelect');
  if (modeSel) modeSel.value = mode === 'docx' ? 'docx' : 'pdf';
  setPhotoConvertMode(mode);
  await renderPhotoConvertVaultList();
  renderPhotoConvertQueue();
  const sheet = document.getElementById('photoConvertSheet');
  if (sheet) sheet.classList.add('show');
}

function closePhotoConvertSheet() {
  const sheet = document.getElementById('photoConvertSheet');
  if (sheet) sheet.classList.remove('show');
}

function setPhotoConvertMode(mode) {
  photoConvertState.mode = mode === 'docx' ? 'docx' : 'pdf';
  const isWord = photoConvertState.mode === 'docx';
  const titleEl = document.getElementById('photoConvertTitle');
  const pdfOpts = document.getElementById('photoConvertPdfOptions');
  const wordOpts = document.getElementById('photoConvertWordOptions');
  const nameInput = document.getElementById('photoConvertNameInput');
  const histCountEl = document.getElementById('photoConvertHistoryCount');

  if (titleEl) titleEl.textContent = tr(isWord ? 'Foto ke Word' : 'Foto ke PDF');
  if (pdfOpts) pdfOpts.classList.toggle('is-hidden', isWord);
  if (wordOpts) wordOpts.classList.toggle('is-hidden', !isWord);
  if (nameInput && (!nameInput.value.trim() || nameInput.value.startsWith('Foto ke '))) {
    nameInput.value = `${isWord ? tr('Foto ke Word') : tr('Foto ke PDF')} ${formatScanTitleId()}`;
  }
  if (histCountEl) {
    const origin = isWord ? 'img2word' : 'img2pdf';
    const badge = document.querySelector(`[data-tool-count="${origin}"]`);
    histCountEl.textContent = badge ? badge.textContent : '0';
  }
}

function triggerPhotoConvertPicker() {
  if (window.AttaLock) AttaLock.skipNext();
  const inp = document.getElementById('photoConvertFileInput');
  if (inp) inp.click();
}

async function measureAndAddPhotoConvertItem(blob, name) {
  const normalized = await AttaStorage.normalizeImageOrientation(blob);
  const comp = await AttaStorage.compressAndFilterImage(normalized, {
    maxDimension: 1800,
    quality: 0.9,
    filter: 'original'
  });
  photoConvertState.items.push({
    key: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name || `Foto ${photoConvertState.items.length + 1}.jpg`,
    blob: comp.blob || normalized,
    dataUrl: comp.dataUrl,
    width: comp.width || 1000,
    height: comp.height || 1400,
    mimeType: 'image/jpeg'
  });
}

async function handlePhotoConvertFilesSelected(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  if (!files.length) return;
  for (const f of files) {
    try {
      await measureAndAddPhotoConvertItem(f, f.name);
    } catch (_) {
      showToast('Salah satu foto tidak bisa dibaca.', true);
    }
  }
  renderPhotoConvertQueue();
}

async function renderPhotoConvertVaultList() {
  const listEl = document.getElementById('photoConvertVaultList');
  if (!listEl) return;
  const all = await AttaStorage.getAllFiles();
  const imgs = all.filter((f) => (f.mimeType || '').startsWith('image/') && f.category !== 'signed');
  if (!imgs.length) {
    listEl.innerHTML = `<div class="vault-picker-empty">${escapeHtml(tr('Belum ada foto tersimpan di Dokumen.'))}</div>`;
    return;
  }
  listEl.innerHTML = imgs
    .slice(0, 20)
    .map(
      (f) => `
      <button type="button" class="vault-picker-item" onclick="addVaultPhotoToConvert(${f.id})">
        <span class="vault-picker-name">${escapeHtml(stripExtensionForDisplay(f.name))}</span>
        <span class="vault-picker-meta">${escapeHtml(AttaStorage.formatBytes(f.size || 0))}</span>
      </button>
    `
    )
    .join('');
}

async function addVaultPhotoToConvert(fileId) {
  const item = await AttaStorage.getFileById(fileId);
  if (!item) return;
  const plainBlob = await getPlainBlob(item);
  if (!plainBlob) return;
  try {
    await measureAndAddPhotoConvertItem(plainBlob, item.name);
    renderPhotoConvertQueue();
    showToast('Foto ditambahkan ke antrean konversi.');
  } catch (_) {
    showToast('Foto tidak bisa dimuat.', true);
  }
}

function renderPhotoConvertQueue() {
  const listEl = document.getElementById('photoConvertQueueList');
  const countEl = document.getElementById('photoConvertCountBadge');
  if (countEl) countEl.textContent = String(photoConvertState.items.length);
  if (!listEl) return;

  if (!photoConvertState.items.length) {
    listEl.innerHTML = `<div class="vault-picker-empty">${escapeHtml(tr('Belum ada foto dipilih.'))}</div>`;
    return;
  }

  listEl.innerHTML = photoConvertState.items
    .map(
      (it, idx) => `
      <div class="photo-queue-item">
        <span class="photo-queue-name">${idx + 1}. ${escapeHtml(it.name)}</span>
        <span class="photo-queue-actions">
          <button type="button" class="photo-queue-btn" aria-label="Geser naik" onclick="movePhotoConvertItem(${idx}, -1)">^</button>
          <button type="button" class="photo-queue-btn" aria-label="Geser turun" onclick="movePhotoConvertItem(${idx}, 1)">v</button>
          <button type="button" class="photo-queue-btn" aria-label="Hapus foto" onclick="removePhotoConvertItem(${idx})">x</button>
        </span>
      </div>
    `
    )
    .join('');
}

function movePhotoConvertItem(idx, delta) {
  const target = idx + delta;
  if (target < 0 || target >= photoConvertState.items.length) return;
  const tmp = photoConvertState.items[idx];
  photoConvertState.items[idx] = photoConvertState.items[target];
  photoConvertState.items[target] = tmp;
  renderPhotoConvertQueue();
}

function removePhotoConvertItem(idx) {
  photoConvertState.items.splice(idx, 1);
  renderPhotoConvertQueue();
}

async function openPhotoConvertHistory() {
  const origin = photoConvertState.mode === 'docx' ? 'img2word' : 'img2pdf';
  await openToolHistorySheet(origin);
}

async function commitPhotoConvert() {
  if (!photoConvertState.items.length) {
    showToast('Pilih minimal satu foto terlebih dahulu.', true);
    return;
  }
  const btn = document.getElementById('photoConvertCommitBtn');
  if (btn) btn.disabled = true;

  try {
    const rawName = (document.getElementById('photoConvertNameInput')?.value || '').trim();
    const baseName = (rawName || (photoConvertState.mode === 'docx' ? 'Foto ke Word' : 'Foto ke PDF')).replace(/\.(pdf|docx?)$/i, '');
    const pages = photoConvertState.items;

    if (photoConvertState.mode === 'docx') {
      const wordType = document.getElementById('photoConvertWordTypeSelect')?.value || 'photo';
      let outBlob;
      if (wordType === 'ocr' && window.AttaToolsEngine && typeof AttaToolsEngine.runOfflineOcrOnBlob === 'function') {
        const textChunks = [];
        for (let i = 0; i < pages.length; i++) {
          const ocrRes = await AttaToolsEngine.runOfflineOcrOnBlob(pages[i].blob || pages[i].dataUrl).catch(() => null);
          const txt = ocrRes && ocrRes.text ? String(ocrRes.text).trim() : '';
          if (txt) {
            textChunks.push(pages.length > 1 ? `--- ${tr('Halaman')} ${i + 1} ---\n${txt}` : txt);
          }
        }
        if (textChunks.length) {
          outBlob = await AttaToolsEngine.buildDocxBlob(textChunks.join('\n\n'), baseName);
        } else {
          showToast('Teks OCR kosong; memakai layout gambar ke Word.');
          outBlob = await AttaToolsEngine.buildDocxFromImages(pages, baseName, []);
        }
      } else {
        outBlob = await AttaToolsEngine.buildDocxFromImages(pages, baseName, []);
      }

      const saved = await AttaStorage.saveFileRecord({
        name: `${baseName}.docx`,
        category: 'export',
        toolOrigin: 'img2word',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        blob: outBlob,
        thumbnailDataUrl: pages[0]?.dataUrl || '',
        filterUsed: wordType === 'ocr' ? 'Foto ke Word (OCR)' : 'Foto ke Word',
        notes: `${pages.length} foto`
      });
      lastScannedItemId = saved.id;
      closePhotoConvertSheet();
      await refreshToolHistoryCounts();
      await renderFileVault();
      showToast('Foto berhasil diubah ke Word (.docx).');
      openToolResultSheet(saved);
      return;
    }

    const pageSize = document.getElementById('photoConvertPageSizeSelect')?.value || 'auto';
    const withOcr = Boolean(document.getElementById('photoConvertOcrCheck')?.checked);
    const ocrPages = [];
    if (withOcr && window.AttaToolsEngine && typeof AttaToolsEngine.runOfflineOcrOnBlob === 'function') {
      for (const pg of pages) {
        const res = await AttaToolsEngine.runOfflineOcrOnBlob(pg.blob || pg.dataUrl).catch(() => null);
        ocrPages.push(res || { lines: [] });
      }
    }

    const pdfBlob = await AttaToolsEngine.buildMultiImagePdfWithOptions(pages, { pageSize, ocrPages });
    const saved = await AttaStorage.saveFileRecord({
      name: `${baseName}.pdf`,
      category: 'pdf',
      toolOrigin: 'img2pdf',
      mimeType: 'application/pdf',
      blob: pdfBlob,
      thumbnailDataUrl: pages[0]?.dataUrl || '',
      filterUsed: 'Foto ke PDF',
      notes: `${pages.length} foto`
    });
    lastScannedItemId = saved.id;
    closePhotoConvertSheet();
    await refreshToolHistoryCounts();
    await renderFileVault();
    showToast('Foto berhasil diubah menjadi PDF.');
    openToolResultSheet(saved);
  } catch (_) {
    showToast('Gagal mengonversi foto.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}
