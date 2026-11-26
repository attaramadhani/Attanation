const fs = require('fs');
const path = require('path');

const pwaDir = process.env.PWA_DIR || path.resolve(__dirname, '../../pwa-docstudio-pro');
const html = fs.readFileSync(path.join(pwaDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(pwaDir, 'css/app.css'), 'utf8');
const sw = fs.readFileSync(path.join(pwaDir, 'service-worker.js'), 'utf8');

const jsFiles = ['config.js', 'db.js', 'pdf-render.js', 'tools-engine.js', 'i18n.js', 'account.js', 'settings.js', 'app.js'];
const jsContents = {};
for (const f of jsFiles) {
  jsContents[f] = fs.readFileSync(path.join(pwaDir, 'js', f), 'utf8');
}
const allJs = Object.values(jsContents).join('\n');

let totalErrors = 0;

// 1. Check all IDs in index.html vs getElementById in JS
const htmlIds = new Set();
for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
  htmlIds.add(m[1]);
}
// Also check dynamic IDs created in JS
for (const m of allJs.matchAll(/\bid="([^"]+)"/g)) {
  htmlIds.add(m[1]);
}

const missingIds = [];
for (const [file, content] of Object.entries(jsContents)) {
  for (const m of content.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
    const id = m[1];
    if (!htmlIds.has(id) && !id.includes('${')) {
      missingIds.push({ file, id });
    }
  }
}
console.log('=== 1. Missing getElementById targets ===');
console.log(missingIds);
if (missingIds.length > 0) totalErrors += missingIds.length;

// 2. Check inline event handlers in index.html vs defined functions
const definedFuncs = new Set();
for (const m of allJs.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/g)) {
  definedFuncs.add(m[1]);
}
for (const m of allJs.matchAll(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g)) {
  definedFuncs.add(m[1]);
}
const missingHandlers = [];
for (const m of html.matchAll(/\bon(?:click|change|input|submit)="([^"]+)"/g)) {
  const expr = m[1];
  const fnMatch = expr.match(/^([a-zA-Z0-9_.]+)\s*\(/);
  if (fnMatch) {
    const fn = fnMatch[1];
    if (!fn.includes('.') && !definedFuncs.has(fn)) {
      missingHandlers.push({ expr, fn });
    }
  }
}
console.log('=== 2. Missing inline event handlers ===');
console.log(missingHandlers);
if (missingHandlers.length > 0) totalErrors += missingHandlers.length;

// 3. Check service-worker.js STATIC_ASSETS vs disk
const swAssetsMatch = sw.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
const swAssets = [];
if (swAssetsMatch) {
  for (const m of swAssetsMatch[1].matchAll(/'([^']+)'/g)) {
    swAssets.push(m[1]);
  }
}
const missingSwFiles = [];
for (const a of swAssets) {
  if (a === './') continue;
  const rel = a.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(pwaDir, rel))) {
    missingSwFiles.push(a);
  }
}
console.log('=== 3. Missing SW precache files on disk ===');
console.log(missingSwFiles);
if (missingSwFiles.length > 0) totalErrors += missingSwFiles.length;

// List all files in pwaDir (excluding server-api, DESIGN.md, README) to see if any client asset is missing from SW
function walkDir(dir, base = '') {
  let res = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'server-api' || entry.name === 'test') continue;
      res = res.concat(walkDir(path.join(dir, entry.name), rel));
    } else {
      if (entry.name.endsWith('.md')) continue;
      res.push(`./${rel}`);
    }
  }
  return res;
}
const allClientFiles = walkDir(pwaDir);
const uncachedFiles = allClientFiles.filter(f => !swAssets.includes(f));
console.log('=== 3b. Client files not in STATIC_ASSETS ===');
console.log(uncachedFiles);

// 4. Test i18n coverage on index.html text nodes & attributes + JS showToast / textContent strings
const i18nCode = jsContents['i18n.js'];
const sandbox = {
  localStorage: { getItem: () => 'en', setItem: () => {} },
  navigator: { language: 'en-US' },
  document: {
    documentElement: { setAttribute: () => {} },
    body: {},
    querySelectorAll: () => [],
    createTreeWalker: () => ({ nextNode: () => null }),
    addEventListener: () => {},
    getElementById: () => null
  },
  MutationObserver: class { observe() {} },
  NodeFilter: { SHOW_TEXT: 4 },
  window: {}
};
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(i18nCode + '\nwindow.tr = tr; window.I18N_EN = I18N_EN;', sandbox);
const tr = sandbox.window.tr;

// Strip script and style from html
const cleanHtml = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const untranslatedHtml = [];
for (const m of cleanHtml.matchAll(/>([^<]+)</g)) {
  const txt = m[1].replace(/\s+/g, ' ').trim();
  if (!txt) continue;
  if (/^[\d\s.,×+%/@\-–—:;()A-Z0-9]+$/.test(txt) && !/[a-z]{3,}/.test(txt)) continue;
  if (['ATTA DocStudio Pro', 'ATTA NATION', 'Indonesia', 'English', 'WhatsApp', 'atta.nation.id@gmail.com', 'PDF.js', 'pdf-lib', 'Dexie.js', 'JSZip', 'Google Drive'].includes(txt)) continue;
  const out = tr(txt);
  if (out === txt) {
    untranslatedHtml.push(txt);
  }
}
console.log('=== 4a. Untranslated HTML text nodes (when lang=en) ===');
console.log([...new Set(untranslatedHtml)]);

const untranslatedAttrs = [];
for (const m of cleanHtml.matchAll(/\b(?:placeholder|aria-label|title|alt)="([^"]+)"/g)) {
  const txt = m[1].replace(/\s+/g, ' ').trim();
  if (!txt) continue;
  if (['ATTA DocStudio Pro', 'AIza...'].includes(txt)) continue;
  const out = tr(txt);
  if (out === txt) {
    untranslatedAttrs.push(txt);
  }
}
console.log('=== 4b. Untranslated HTML attributes (when lang=en) ===');
console.log([...new Set(untranslatedAttrs)]);

// Check all showToast('...') strings in JS
const untranslatedToasts = [];
for (const [file, content] of Object.entries(jsContents)) {
  for (const m of content.matchAll(/showToast\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    let raw = m[2];
    const sample = raw
      .replace(/\$\{[^}]*Count[^}]*\}/gi, '2')
      .replace(/\$\{[^}]*length[^}]*\}/gi, '2')
      .replace(/\$\{[^}]*pct[^}]*\}/gi, '35')
      .replace(/\$\{[^}]*pagesLabel[^}]*\}/gi, '2 halaman')
      .replace(/\$\{[^}]*importedPdf[^}]*\}/gi, '2')
      .replace(/\$\{[^}]*cropRotationDeg[^}]*\}/gi, '90')
      .replace(/\$\{[^}]*limitLabel[^}]*\}/gi, '200 KB')
      .replace(/\$\{[^}]*finalSize[^}]*\}/gi, '150 KB')
      .replace(/\$\{[^}]*res\.removedCount[^}]*\}/gi, '1')
      .replace(/\$\{[^}]*res\.pageCount[^}]*\}/gi, '2')
      .replace(/\$\{[^}]*res\.count[^}]*\}/gi, '3')
      .replace(/\$\{[^}]*res\.zipName[^}]*\}/gi, 'backup.zip')
      .replace(/\$\{[^}]*res\.restoredCount[^}]*\}/gi, '3')
      .replace(/\$\{[^}]*APP_CURRENT_VERSION[^}]*\}/gi, '2.5.0')
      .replace(/\$\{[^}]*item\.name[^}]*\}/gi, 'dokumen.pdf')
      .replace(/\$\{[^}]*baseName[^}]*\}/gi, 'dokumen')
      .replace(/\$\{[^}]*out\.ext[^}]*\}/gi, '.docx')
      .replace(/\$\{[^}]*err\.message[^}]*\}/gi, 'Error')
      .replace(/\$\{[^}]*\}/g, '2');
    const out = tr(sample);
    if (out === sample) {
      untranslatedToasts.push({ file, raw, sample });
    }
  }
}
console.log('=== 4c. Untranslated showToast strings ===');
console.log(untranslatedToasts);

// 5. Check DESIGN.md Section 8 contract IDs & functions
const contractIds = [
  'splashScreen', 'appLockScreen', 'appLockPinDots', 'appLockMsg', 'appLockBioBtn',
  'appShell', 'view-vault', 'view-scanner', 'view-tools', 'view-backup', 'view-settings', 'bottomNav',
  'vaultHeaderDefault', 'vaultSearchBar', 'vaultSearchInput', 'vaultLeadText', 'vaultStackRegion', 'vaultListContainer',
  'scannerVideo', 'scannerGuide', 'scannerFallback', 'scannerFlashBtn',
  'scannerPageTitle', 'scannerStatusPill', 'scannerTrayThumb', 'scannerTrayCount',
  'compressionQualitySelect', 'qualityCurrentLabel', 'autoPdfToggle', 'cameraInput', 'galleryInput',
  'mergePdfInput', 'compressTargetInput', 'compressTargetSub', 'watermarkPdfInput', 'watermarkTextInput',
  'sigCanvas', 'stampPdfFileInput', 'stampPageModeSelect', 'stampPositionSelect', 'stampVaultPickerList',
  'pageToolFileInput', 'pageToolParamInput', 'pageToolSelectInput', 'pageToolVaultPickerList',
  'redactEditorSheet', 'redactCanvas', 'redactPageLabel', 'redactPrevBtn', 'redactNextBtn', 'redactUndoBtn', 'redactSaveBtn',
  'idCardFilesInput', 'officeToPdfInput', 'pdfExportFileInput', 'exportFormatSelect', 'exportVaultPickerList',
  'perspectiveCropInput', 'cropInteractiveCanvas', 'repairPdfInput', 'repairVaultPickerList',
  'comparePdfFilesInput', 'compareResultOutput',
  'analyzeFileInput', 'analyzeModeSelect', 'geminiApiKeyInput', 'analyzeResultOutput', 'copyAnalysisBtn', 'analyzeVaultPickerList',
  'storageUsedText', 'storageCountText', 'storageBarFill', 'persistStatusLabel', 'persistStatusBadge', 'restoreArchiveInput',
  'accountCardOut', 'accountCardIn', 'accountAvatar', 'accountName', 'accountEmail',
  'accountSheet', 'accountForm', 'accountSheetTitle', 'accountSheetLead', 'accountNameGroup', 'accountNameInput',
  'accountEmailGroup', 'accountEmailInput', 'accountPassGroup', 'accountPassLabel', 'accountPassInput',
  'accountPass2Group', 'accountPass2Input', 'accountErrorText', 'accountSubmitBtn', 'accountSwitchBtn', 'accountForgotBtn',
  'settingScanFilter', 'settingScanSize', 'settingAutoPdf', 'settingAppLockToggle', 'settingBioRow', 'settingBioToggle',
  'settingAutoLockRow', 'settingAutoLockSelect', 'geminiKeyStatus', 'clearGeminiKeyBtn', 'appVersionRowTitle',
  'installAppRow', 'nativeInstallBtn', 'guideInstallBtn',
  'fileActionSheet', 'renameSheet', 'previewSheet', 'pinLockSheet', 'scanModeSheet', 'qualitySheet', 'mergeSheet',
  'compressTargetSheet', 'watermarkSheet', 'stampSignSheet', 'pageToolSheet', 'idCardStitchSheet', 'pdfExportFormatSheet',
  'cropPerspectiveSheet', 'repairPdfSheet', 'comparePdfSheet', 'analyzeDocSheet', 'appPinSetupSheet', 'appPinDisableSheet',
  'wipeDataSheet', 'forgotAppPinSheet', 'privacySheet', 'licensesSheet', 'installGuideModal', 'updatePopup', 'appToast'
];
const missingContractIds = contractIds.filter(id => !htmlIds.has(id));
console.log('=== 5. Missing DESIGN.md Contract IDs ===');
console.log(missingContractIds);
if (missingContractIds.length > 0) totalErrors += missingContractIds.length;

console.log(`\nAudit completed with ${totalErrors} critical errors.`);
process.exit(totalErrors > 0 ? 1 : 0);
