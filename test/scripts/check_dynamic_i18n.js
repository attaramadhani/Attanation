const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pwaDir = process.env.PWA_DIR || path.resolve(__dirname, '../../pwa-docstudio-pro');
const i18nCode = fs.readFileSync(path.join(pwaDir, 'js/i18n.js'), 'utf8');

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
vm.createContext(sandbox);
vm.runInContext(i18nCode + '\nwindow.tr = tr; window.I18N_EN = I18N_EN;', sandbox);
const tr = sandbox.window.tr;

const jsFiles = ['db.js', 'pdf-render.js', 'tools-engine.js', 'account.js', 'settings.js', 'app.js'];
const untranslated = [];

for (const f of jsFiles) {
  const code = fs.readFileSync(path.join(pwaDir, 'js', f), 'utf8');
  // Find strings assigned to textContent, innerHTML options, Error(...), showToast, setPinSheetError, etc.
  for (const m of code.matchAll(/(?:textContent\s*=\s*|new Error\(|setPinSheetError\(|setAccountError\(|showFallback\(|<option[^>]*>)([^;<\n]+)/g)) {
    const snippet = m[1].trim();
    for (const sm of snippet.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const s = sm[2].trim();
      if (!s || s.length < 3) continue;
      if (/^[a-z0-9_.\-#/]+$/i.test(s) && !s.includes(' ')) continue;
      if (s.includes('${')) continue;
      const out = tr(s);
      if (out === s) {
        untranslated.push({ file: f, str: s });
      }
    }
  }
}

console.log('=== Untranslated dynamic JS strings ===');
console.log(untranslated);

if (untranslated.length > 0) {
  process.exit(1);
} else {
  console.log('0 untranslated strings found.');
}
