/**
 * ATTA DocStudio Pro — layar pembuka, kunci aplikasi multi-opsi, dan Pengaturan.
 * Mendukung PIN, Pola 3x3, Kata Sandi, serta Biometrik (Sidik Jari / Face Unlock via BiometricPrompt).
 */

/* ---------------------------------------------------------------------------
 * Tema
 * ------------------------------------------------------------------------- */
const THEME_COLORS = { light: '#DCE2E7', dark: '#12161B' };
let themePreference = (() => {
  try {
    return localStorage.getItem('atta_theme') || 'system';
  } catch (_) {
    return 'system';
  }
})();
const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemDarkQuery && systemDarkQuery.matches ? 'dark' : 'light';
}

function applyTheme(pref) {
  themePreference = pref || 'system';
  const theme = resolveTheme(themePreference);
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  document.querySelectorAll('[data-theme-choice]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.getAttribute('data-theme-choice') === themePreference));
  });
  if (typeof window !== 'undefined' && window.AttaNativeAndroid && typeof window.AttaNativeAndroid.setSystemBars === 'function') {
    try {
      window.AttaNativeAndroid.setSystemBars(theme === 'dark');
    } catch (_) {}
  }
}

async function setThemePreference(pref) {
  applyTheme(pref);
  try {
    localStorage.setItem('atta_theme', pref);
  } catch (_) {}
  await AttaStorage.setSetting('pref_theme', pref);
}

if (systemDarkQuery) {
  const onSystemChange = () => {
    if (themePreference === 'system') applyTheme('system');
  };
  if (systemDarkQuery.addEventListener) systemDarkQuery.addEventListener('change', onSystemChange);
  else if (systemDarkQuery.addListener) systemDarkQuery.addListener(onSystemChange);
}

/* ---------------------------------------------------------------------------
 * Layar pembuka
 * ------------------------------------------------------------------------- */
const SPLASH_MIN_MS = 450;

function hideSplash() {
  const splash = document.getElementById('splashScreen');
  if (!splash || splash.classList.contains('is-done')) return;
  const elapsed = performance.now();
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    splash.classList.add('is-done');
    setTimeout(() => splash.remove(), 260);
  }, wait);
}

setTimeout(hideSplash, 8000);

/* ---------------------------------------------------------------------------
 * Preferensi pindai (7 Filter + Kualitas + PDF A4)
 * ------------------------------------------------------------------------- */
const VALID_FILTER_IDS = new Set(['original', 'enhance', 'noshadow', 'magic', 'lighten', 'bw', 'gray']);

async function applyScanPreferences() {
  const pref = (await AttaStorage.getSetting('pref_scan', null)) || {};
  const filter = VALID_FILTER_IDS.has(pref.filter) ? pref.filter : 'magic';
  const quality = pref.quality || '0.78';
  const pdf = pref.pdf !== false;

  currentScanFilter = filter;
  document.querySelectorAll('.filter-preview .filter-radio').forEach((b) => {
    b.setAttribute('aria-checked', String(b.getAttribute('data-filter') === filter));
  });
  const q = document.getElementById('scanQualitySelect');
  if (q) q.value = quality;
  const outSel = document.getElementById('scanOutputFormatSelect');
  if (outSel && (outSel.value === 'pdf' || outSel.value === 'jpg')) {
    outSel.value = pdf ? 'pdf' : 'jpg';
  }

  const f1 = document.getElementById('prefScanFilter');
  const f2 = document.getElementById('prefScanQuality');
  const f3 = document.getElementById('prefScanPdf');
  if (f1) f1.value = filter;
  if (f2) f2.value = quality;
  if (f3) f3.checked = pdf;
}

async function saveScanPreferences() {
  const pref = {
    filter: document.getElementById('prefScanFilter').value,
    quality: document.getElementById('prefScanQuality').value,
    pdf: document.getElementById('prefScanPdf').checked
  };
  await AttaStorage.setSetting('pref_scan', pref);
  await applyScanPreferences();
  showToast('Pengaturan pindai disimpan.');
}

/* ---------------------------------------------------------------------------
 * Komponen Pola 3x3 Interaktif (Canvas) untuk Setup & Layar Kunci
 * ------------------------------------------------------------------------- */
function attachPatternPad(canvasEl, { onProgress, onComplete, onTooShort } = {}) {
  if (!canvasEl) return { reset: () => {}, draw: () => {} };
  const ctx = canvasEl.getContext('2d');
  const size = canvasEl.width;
  const pad = Math.round(size * 0.18);
  const step = (size - pad * 2) / 2;
  const centers = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      centers.push({ idx: r * 3 + c, x: pad + c * step, y: pad + r * step });
    }
  }

  let selected = [];
  let pointer = null;
  let dragging = false;

  const isDarkTheme = () => document.documentElement.getAttribute('data-theme') === 'dark';

  function draw(errorState = false) {
    ctx.clearRect(0, 0, size, size);
    const inkColor = isDarkTheme() ? '#E6EAEE' : '#17202B';
    const mutedBorder = isDarkTheme() ? '#4B5664' : '#9AA6B2';
    const lineColor = errorState ? (isDarkTheme() ? '#FF8A80' : '#B42318') : isDarkTheme() ? '#93A9FF' : '#2445C9';

    if (selected.length > 0) {
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(4, Math.round(size * 0.022));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      selected.forEach((id, idx) => {
        const pt = centers[id];
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      if (dragging && pointer) {
        ctx.lineTo(pointer.x, pointer.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of centers) {
      const active = selected.includes(pt.idx);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, active ? Math.round(size * 0.068) : Math.round(size * 0.055), 0, Math.PI * 2);
      ctx.fillStyle = active ? lineColor : 'transparent';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = active ? lineColor : mutedBorder;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.round(size * 0.018), 0, Math.PI * 2);
      ctx.fillStyle = active ? '#FFFFFF' : inkColor;
      ctx.fill();
    }
  }

  function getCanvasPos(ev) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = size / Math.max(1, rect.width);
    const scaleY = size / Math.max(1, rect.height);
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  }

  function addNodeWithBridge(nextIdx) {
    if (selected.includes(nextIdx)) return;
    if (selected.length > 0) {
      const prevIdx = selected[selected.length - 1];
      const pr = Math.floor(prevIdx / 3), pc = prevIdx % 3;
      const nr = Math.floor(nextIdx / 3), nc = nextIdx % 3;
      if ((pr + nr) % 2 === 0 && (pc + nc) % 2 === 0) {
        const midIdx = ((pr + nr) / 2) * 3 + (pc + nc) / 2;
        if (!selected.includes(midIdx)) selected.push(midIdx);
      }
    }
    selected.push(nextIdx);
  }

  function hitTest(pos) {
    const hitRadius = Math.max(22, size * 0.115);
    for (const pt of centers) {
      if (Math.hypot(pt.x - pos.x, pt.y - pos.y) <= hitRadius) {
        addNodeWithBridge(pt.idx);
      }
    }
  }

  const onDown = (ev) => {
    ev.preventDefault();
    dragging = true;
    selected = [];
    pointer = getCanvasPos(ev);
    hitTest(pointer);
    draw(false);
    if (onProgress) onProgress(selected.slice());
  };

  const onMove = (ev) => {
    if (!dragging) return;
    ev.preventDefault();
    pointer = getCanvasPos(ev);
    hitTest(pointer);
    draw(false);
    if (onProgress) onProgress(selected.slice());
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    pointer = null;
    if (selected.length === 0) {
      draw(false);
      return;
    }
    if (selected.length < 4) {
      draw(true);
      if (onTooShort) onTooShort();
      setTimeout(() => {
        selected = [];
        draw(false);
      }, 420);
      return;
    }
    const seq = selected.join('-');
    draw(false);
    if (onComplete) onComplete(seq, selected.slice());
  };

  canvasEl.addEventListener('pointerdown', onDown);
  canvasEl.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  draw(false);
  return {
    reset: (isError = false) => {
      selected = [];
      pointer = null;
      dragging = false;
      draw(isError);
    },
    draw
  };
}

/* ---------------------------------------------------------------------------
 * Kunci Aplikasi Multi-Opsi (PIN / Pola 3x3 / Kata Sandi / Biometrik Native)
 * ------------------------------------------------------------------------- */
const AttaLock = (() => {
  let entered = '';
  let wrongCount = 0;
  let lockCooldownUntil = 0;
  let hiddenAt = 0;
  let skipNext = false;
  let locked = false;
  let lockPatternPad = null;

  function isNativeBioBridge() {
    return (
      typeof window !== 'undefined' &&
      window.AttaNativeAndroid &&
      typeof window.AttaNativeAndroid.isBiometricAvailable === 'function' &&
      typeof window.AttaNativeAndroid.authenticateBiometric === 'function'
    );
  }

  function isNativeDeviceCredBridge() {
    return (
      typeof window !== 'undefined' &&
      window.AttaNativeAndroid &&
      typeof window.AttaNativeAndroid.isDeviceOrBiometricAvailable === 'function' &&
      typeof window.AttaNativeAndroid.authenticateWithDeviceCredential === 'function'
    );
  }

  async function hashSecret(secretStr, saltB64, iterations) {
    const salt = AttaStorage._unb64(saltB64);
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secretStr)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256);
    return AttaStorage._b64(bits);
  }

  async function getConfig() {
    const cfg = await AttaStorage.getSetting('app_lock', null);
    if (cfg && !cfg.method) cfg.method = 'pin';
    return cfg;
  }

  async function setSecret(secretStr, method = 'pin') {
    const iterations = 210000;
    const salt = AttaStorage._b64(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashSecret(secretStr, salt, iterations);
    const prev = (await getConfig()) || {};
    await AttaStorage.setSetting('app_lock', {
      ...prev,
      method,
      salt,
      hash,
      iterations,
      delay: prev.delay != null ? prev.delay : 60000,
      bioId: prev.bioId || null,
      bioNative: Boolean(prev.bioNative),
      secondLock: prev.secondLock || null
    });
  }

  async function setSecondSecret(secretStr, method = 'pin') {
    const cfg = await getConfig();
    if (!cfg) throw new Error('Atur kunci utama terlebih dahulu');
    const iterations = 210000;
    const salt = AttaStorage._b64(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashSecret(secretStr, salt, iterations);
    cfg.secondLock = { method, salt, hash, iterations };
    await AttaStorage.setSetting('app_lock', cfg);
  }

  async function removeSecondSecret() {
    const cfg = await getConfig();
    if (!cfg) return;
    cfg.secondLock = null;
    await AttaStorage.setSetting('app_lock', cfg);
  }

  async function setRecoveryData({ question, answer, recoveryCode }) {
    const cfg = await getConfig();
    if (!cfg) return;
    const iterations = 150000;
    if (question && answer) {
      const normAns = String(answer).trim().toLowerCase().replace(/\s+/g, ' ');
      const aSalt = AttaStorage._b64(crypto.getRandomValues(new Uint8Array(16)));
      cfg.recoveryQuestion = question;
      cfg.recoverySalt = aSalt;
      cfg.recoveryHash = await hashSecret(normAns, aSalt, iterations);
      cfg.recoveryIterations = iterations;
    }
    if (recoveryCode) {
      const normCode = String(recoveryCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const kSalt = AttaStorage._b64(crypto.getRandomValues(new Uint8Array(16)));
      cfg.recoveryKeySalt = kSalt;
      cfg.recoveryKeyHash = await hashSecret(normCode, kSalt, iterations);
      cfg.recoveryIterations = iterations;
    }
    await AttaStorage.setSetting('app_lock', cfg);
  }

  async function verifyRecoveryAnswer(answer) {
    const cfg = await getConfig();
    if (!cfg || !cfg.recoveryHash || !cfg.recoverySalt) return false;
    const norm = String(answer || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!norm) return false;
    const h = await hashSecret(norm, cfg.recoverySalt, cfg.recoveryIterations || 150000);
    return h === cfg.recoveryHash;
  }

  async function verifyRecoveryCode(code) {
    const cfg = await getConfig();
    if (!cfg || !cfg.recoveryKeyHash || !cfg.recoveryKeySalt) return false;
    const norm = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!norm) return false;
    const h = await hashSecret(norm, cfg.recoveryKeySalt, cfg.recoveryIterations || 150000);
    return h === cfg.recoveryKeyHash;
  }

  async function verify(secretStr, slot = 'primary') {
    const cfg = await getConfig();
    if (!cfg) return true;
    const target = slot === 'second' ? cfg.secondLock : cfg;
    if (!target || !target.salt || !target.hash) return false;
    return (await hashSecret(secretStr, target.salt, target.iterations)) === target.hash;
  }

  function renderDots() {
    const dots = document.getElementById('appLockDots');
    if (!dots) return;
    const total = Math.max(4, entered.length);
    dots.innerHTML = Array.from({ length: total }, (_, i) => `<span class="${i < entered.length ? 'on' : ''}"></span>`).join('');
  }

  function setMsg(msg) {
    const el = document.getElementById('appLockMsg');
    if (el) el.textContent = msg || '';
  }

  function setKeypadDisabled(disabled) {
    document.querySelectorAll('#appLockKeypad button').forEach((b) => {
      if (!b.classList.contains('keypad-text') || b.getAttribute('aria-label')) b.disabled = disabled;
    });
    const pwBtn = document.getElementById('appLockPasswordBtn');
    if (pwBtn) pwBtn.disabled = disabled;
  }

  function handleFailedAttempt() {
    wrongCount++;
    entered = '';
    renderDots();
    if (lockPatternPad) lockPatternPad.reset(true);
    const pwIn = document.getElementById('appLockPasswordInput');
    if (pwIn) pwIn.value = '';

    if (wrongCount >= 5) {
      lockCooldownUntil = Date.now() + 30000;
      setKeypadDisabled(true);
      const tick = () => {
        const left = Math.max(0, Math.ceil((lockCooldownUntil - Date.now()) / 1000));
        if (left <= 0) {
          wrongCount = 0;
          lockCooldownUntil = 0;
          setKeypadDisabled(false);
          setMsg('');
        } else {
          setMsg(`Terlalu banyak percobaan. Coba lagi dalam ${left} detik.`);
          setTimeout(tick, 1000);
        }
      };
      tick();
    } else {
      const cfgMethodMsg = {
        pin: 'PIN salah. Coba lagi.',
        pattern: 'Pola salah. Coba lagi.',
        password: 'Kata sandi salah. Coba lagi.'
      };
      setMsg(cfgMethodMsg[currentLockMethod] || 'Kunci salah. Coba lagi.');
    }
  }

  let currentLockMethod = 'pin';
  let activeLockSlot = 'primary'; // 'primary' | 'second'

  function getMethodLabelId(method) {
    if (method === 'pattern') return 'Pola 3x3';
    if (method === 'password') return 'Kata sandi';
    return 'PIN';
  }

  async function renderLockScreenForSlot() {
    const cfg = await getConfig();
    if (!cfg) return;
    const useSecond = activeLockSlot === 'second' && cfg.secondLock;
    activeLockSlot = useSecond ? 'second' : 'primary';
    currentLockMethod = useSecond ? (cfg.secondLock.method || 'pin') : (cfg.method || 'pin');
    entered = '';
    setMsg('');
    renderDots();

    const titleEl = document.getElementById('appLockTitle');
    const dotsEl = document.getElementById('appLockDots');
    const keypadEl = document.getElementById('appLockKeypad');
    const patternWrap = document.getElementById('appLockPatternWrap');
    const passwordWrap = document.getElementById('appLockPasswordWrap');
    const switchBtn = document.getElementById('appLockSwitchKeyBtn');
    const pwIn = document.getElementById('appLockPasswordInput');

    if (dotsEl) dotsEl.classList.toggle('is-hidden', currentLockMethod !== 'pin');
    if (keypadEl) keypadEl.classList.toggle('is-hidden', currentLockMethod !== 'pin');
    if (patternWrap) patternWrap.classList.toggle('is-hidden', currentLockMethod !== 'pattern');
    if (passwordWrap) passwordWrap.classList.toggle('is-hidden', currentLockMethod !== 'password');

    if (titleEl) {
      const baseTitle =
        currentLockMethod === 'pattern'
          ? 'Gambar pola kunci'
          : currentLockMethod === 'password'
          ? 'Masukkan kata sandi'
          : 'Masukkan PIN';
      titleEl.textContent = tr(baseTitle);
    }

    if (switchBtn) {
      if (cfg.secondLock && cfg.secondLock.hash) {
        const nextSlotLabel =
          activeLockSlot === 'primary'
            ? `${tr('Pakai kunci kedua')} (${tr(getMethodLabelId(cfg.secondLock.method))})`
            : `${tr('Kembali ke kunci utama')} (${tr(getMethodLabelId(cfg.method))})`;
        switchBtn.textContent = nextSlotLabel;
        switchBtn.classList.remove('is-hidden');
      } else {
        switchBtn.classList.add('is-hidden');
      }
    }

    if (currentLockMethod === 'pattern') {
      const pad = ensureLockPatternPad();
      if (pad) pad.reset(false);
    } else if (currentLockMethod === 'password' && pwIn) {
      pwIn.value = '';
    }
  }

  async function toggleActiveLockSlot() {
    const cfg = await getConfig();
    if (!cfg || !cfg.secondLock) return;
    activeLockSlot = activeLockSlot === 'primary' ? 'second' : 'primary';
    await renderLockScreenForSlot();
  }

  function ensureLockPatternPad() {
    if (lockPatternPad) return lockPatternPad;
    const canvas = document.getElementById('appLockPatternCanvas');
    if (!canvas) return null;
    lockPatternPad = attachPatternPad(canvas, {
      onTooShort: () => setMsg('Hubungkan minimal 4 titik.'),
      onComplete: async (seq) => {
        if (Date.now() < lockCooldownUntil) return;
        const ok = await verify(seq, activeLockSlot);
        if (ok) {
          wrongCount = 0;
          hide();
        } else {
          handleFailedAttempt();
        }
      }
    });
    return lockPatternPad;
  }

  async function show() {
    const cfg = await getConfig();
    if (!cfg) return false;
    locked = true;
    activeLockSlot = 'primary';
    await renderLockScreenForSlot();

    const scr = document.getElementById('appLockScreen');
    if (scr) scr.classList.remove('is-hidden');
    if (typeof stopScannerCamera === 'function') stopScannerCamera();

    const bioBtn = document.getElementById('appLockBioBtn');
    const hasBioConfig = Boolean(cfg.bioNative || cfg.bioId);
    const canBio = hasBioConfig && (await biometricAvailable());
    if (bioBtn) bioBtn.classList.toggle('is-hidden', !canBio);
    const pwIn = document.getElementById('appLockPasswordInput');
    if (currentLockMethod === 'password' && pwIn && !canBio) {
      setTimeout(() => pwIn.focus(), 80);
    }
    if (canBio && document.visibilityState === 'visible') {
      setTimeout(biometricUnlock, 220);
    }
    return true;
  }

  function hide() {
    locked = false;
    entered = '';
    const scr = document.getElementById('appLockScreen');
    if (scr) scr.classList.add('is-hidden');
    if (currentTab === 'scanner' && typeof startScannerCamera === 'function') startScannerCamera();
  }

  async function tryUnlockPin() {
    if (entered.length < 4 || Date.now() < lockCooldownUntil) return;
    const ok = await verify(entered, activeLockSlot);
    if (ok) {
      wrongCount = 0;
      hide();
      return;
    }
    handleFailedAttempt();
  }

  async function submitPasswordUnlock() {
    if (!locked || Date.now() < lockCooldownUntil) return;
    const pwIn = document.getElementById('appLockPasswordInput');
    const val = pwIn ? pwIn.value : '';
    if (!val) return setMsg('Masukkan kata sandi.');
    const ok = await verify(val, activeLockSlot);
    if (ok) {
      wrongCount = 0;
      if (pwIn) pwIn.value = '';
      hide();
    } else {
      handleFailedAttempt();
    }
  }

  async function biometricAvailable() {
    try {
      if (isNativeBioBridge()) {
        return Boolean(window.AttaNativeAndroid.isBiometricAvailable());
      }
      return Boolean(
        window.PublicKeyCredential &&
          (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
      );
    } catch (_) {
      return false;
    }
  }

  function runNativeBiometricPrompt(title, subtitle, cancelLabel) {
    return new Promise((resolve) => {
      skipNext = true;
      window.__onAttaBiometricResult = (success, message) => {
        window.__onAttaBiometricResult = null;
        resolve({ success: Boolean(success), message: message || '' });
      };
      try {
        window.AttaNativeAndroid.authenticateBiometric(title, subtitle, cancelLabel);
      } catch (e) {
        window.__onAttaBiometricResult = null;
        resolve({ success: false, message: (e && e.message) || 'Biometrik tidak tersedia' });
      }
    });
  }

  async function registerBiometric() {
    const cfg = await getConfig();
    if (!cfg) throw new Error('Atur kunci utama terlebih dahulu');
    if (isNativeBioBridge()) {
      const res = await runNativeBiometricPrompt(
        'Aktifkan sidik jari atau wajah',
        'Verifikasi biometrik perangkat untuk membuka ATTA DocStudio Pro',
        'Batal'
      );
      if (!res.success) throw new Error(res.message || 'Dibatalkan');
      cfg.bioNative = true;
      await AttaStorage.setSetting('app_lock', cfg);
      return;
    }

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'ATTA DocStudio Pro' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'docstudio', displayName: 'DocStudio' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000
      }
    });
    if (!cred) throw new Error('Dibatalkan');
    cfg.bioId = AttaStorage._b64(cred.rawId);
    await AttaStorage.setSetting('app_lock', cfg);
  }

  async function removeBiometric() {
    const cfg = await getConfig();
    if (!cfg) return;
    cfg.bioId = null;
    cfg.bioNative = false;
    await AttaStorage.setSetting('app_lock', cfg);
  }

  async function biometricUnlock() {
    const cfg = await getConfig();
    if (!cfg || !locked) return;
    if (isNativeBioBridge() && cfg.bioNative) {
      const res = await runNativeBiometricPrompt(
        'Buka ATTA DocStudio Pro',
        'Gunakan sidik jari atau wajah yang terdaftar di HP',
        'Pakai kunci cadangan'
      );
      if (res.success) {
        wrongCount = 0;
        hide();
      } else {
        setMsg('Sidik jari atau wajah dibatalkan. Gunakan kunci cadangan.');
      }
      return;
    }

    if (!cfg.bioId) return;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: AttaStorage._unb64(cfg.bioId) }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      const authData = new Uint8Array(assertion.response.authenticatorData);
      if (authData.length > 32 && authData[32] & 0x04) {
        wrongCount = 0;
        hide();
      } else {
        setMsg('Verifikasi tidak berhasil. Masukkan kunci.');
      }
    } catch (_) {
      setMsg('Sidik jari atau wajah dibatalkan. Gunakan kunci cadangan.');
    }
  }

  let autoTimer = null;
  function key(k) {
    if (!locked || currentLockMethod !== 'pin' || Date.now() < lockCooldownUntil) return;
    if (k === 'back') {
      entered = entered.slice(0, -1);
    } else if (entered.length < 8) {
      entered += k;
      setMsg('');
    }
    renderDots();
    clearTimeout(autoTimer);
    if (entered.length >= 4) autoTimer = setTimeout(tryUnlockPin, entered.length === 8 ? 0 : 450);
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (skipNext) {
      skipNext = false;
      return;
    }
    const cfg = await getConfig();
    if (cfg && !locked && hiddenAt && Date.now() - hiddenAt >= (cfg.delay || 0)) {
      show();
    }
  });

  document.addEventListener(
    'click',
    (e) => {
      if (e.target && e.target.matches && e.target.matches('input[type="file"]')) skipNext = true;
    },
    true
  );

  document.addEventListener('keydown', (e) => {
    if (!locked || currentLockMethod !== 'pin') return;
    if (/^[0-9]$/.test(e.key)) key(e.key);
    else if (e.key === 'Backspace') key('back');
  });

  async function deviceRecoveryAvailable() {
    try {
      if (isNativeDeviceCredBridge() && window.AttaNativeAndroid.isDeviceOrBiometricAvailable()) {
        return true;
      }
      const cfg = await getConfig();
      if (cfg && cfg.bioId && (await biometricAvailable())) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  async function authenticateDeviceForRecovery() {
    if (isNativeDeviceCredBridge() && window.AttaNativeAndroid.isDeviceOrBiometricAvailable()) {
      return new Promise((resolve) => {
        skipNext = true;
        window.__onAttaBiometricResult = (success, message) => {
          window.__onAttaBiometricResult = null;
          resolve({ success: Boolean(success), message: message || '' });
        };
        try {
          window.AttaNativeAndroid.authenticateWithDeviceCredential(
            'Pulihkan kunci aplikasi',
            'Verifikasi dengan Face Key, sidik jari, atau kunci layar HP'
          );
        } catch (e) {
          window.__onAttaBiometricResult = null;
          resolve({ success: false, message: (e && e.message) || 'Tidak tersedia' });
        }
      });
    }
    const cfg = await getConfig();
    if (cfg && cfg.bioId && window.PublicKeyCredential) {
      try {
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ type: 'public-key', id: AttaStorage._unb64(cfg.bioId) }],
            userVerification: 'required',
            timeout: 60000
          }
        });
        const authData = new Uint8Array(assertion.response.authenticatorData);
        if (authData.length > 32 && authData[32] & 0x04) {
          return { success: true, message: '' };
        }
      } catch (e) {
        return { success: false, message: 'Verifikasi biometrik dibatalkan.' };
      }
    }
    return { success: false, message: 'Biometrik atau kunci layar tidak tersedia di browser ini.' };
  }

  return {
    getConfig,
    setPin: (pin) => setSecret(pin, 'pin'),
    setSecret,
    setSecondSecret,
    removeSecondSecret,
    setRecoveryData,
    verifyRecoveryAnswer,
    verifyRecoveryCode,
    verify,
    show,
    hide,
    key,
    submitPasswordUnlock,
    toggleActiveLockSlot,
    skipNext: () => {
      skipNext = true;
    },
    biometricAvailable,
    deviceRecoveryAvailable,
    authenticateDeviceForRecovery,
    registerBiometric,
    removeBiometric,
    biometricUnlock,
    isLocked: () => locked
  };
})();

function appLockKey(k) {
  AttaLock.key(k);
}

/* ---------------------------------------------------------------------------
 * Pengaturan: Dialog Atur Kunci Aplikasi (PIN / Pola / Kata Sandi)
 * ------------------------------------------------------------------------- */
let appPinSetupMode = 'create'; // 'create' | 'disable'
let selectedSetupMethod = 'pin'; // 'pin' | 'pattern' | 'password'
let setupPatternStep = 1;
let setupPatternFirst = '';
let setupPatternPad = null;

function setAppPinError(msg) {
  const el = document.getElementById('appPinSetupError');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-hidden', !msg);
}

function selectAppLockMethod(method) {
  selectedSetupMethod = method;
  setupPatternStep = 1;
  setupPatternFirst = '';
  setAppPinError('');

  document.querySelectorAll('#appLockMethodSeg button').forEach((btn) => {
    btn.setAttribute('aria-checked', String(btn.getAttribute('data-lock-method') === method));
  });

  const pinGroup = document.getElementById('appLockSetupPinGroup');
  const patternGroup = document.getElementById('appLockSetupPatternGroup');
  const passGroup = document.getElementById('appLockSetupPasswordGroup');
  const btn = document.getElementById('appPinSetupBtn');

  if (pinGroup) pinGroup.classList.toggle('is-hidden', method !== 'pin');
  if (patternGroup) patternGroup.classList.toggle('is-hidden', method !== 'pattern');
  if (passGroup) passGroup.classList.toggle('is-hidden', method !== 'password');

  const isCreateLike = appPinSetupMode === 'create' || appPinSetupMode === 'second' || appPinSetupMode === 'recover_reset';
  const confirmPinWrap = document.getElementById('appPinConfirmGroup');
  const confirmPassWrap = document.getElementById('appPassConfirmGroup');
  if (confirmPinWrap) confirmPinWrap.classList.toggle('is-hidden', !isCreateLike);
  if (confirmPassWrap) confirmPassWrap.classList.toggle('is-hidden', !isCreateLike);

  if (btn) {
    btn.classList.toggle('is-hidden', method === 'pattern');
    btn.textContent = isCreateLike ? 'Simpan kunci' : 'Matikan kunci';
  }

  if (method === 'pattern') {
    const hint = document.getElementById('patternSetupHint');
    if (hint) {
      hint.textContent = isCreateLike
        ? 'Hubungkan minimal 4 titik untuk membuat pola.'
        : 'Gambar pola saat ini untuk mematikan kunci.';
    }
    ensureSetupPatternPad();
    if (setupPatternPad) setupPatternPad.reset(false);
  }
}

async function finishCreateOrResetLock(toastMsg) {
  const wasRecover = appPinSetupMode === 'recover_reset';
  const wasCreate = appPinSetupMode === 'create';
  cancelAppPinSetup();
  if (wasRecover) {
    AttaLock.hide();
    showToast('Kunci baru disimpan. Aplikasi terbuka kembali.');
  } else {
    showToast(toastMsg);
  }
  await refreshSettingsView();
  if (wasCreate) {
    const cfg = await AttaLock.getConfig();
    if (cfg && (!cfg.recoveryHash || !cfg.recoveryKeyHash)) {
      setTimeout(() => openRecoverySetupSheet(), 180);
    }
  }
}

function ensureSetupPatternPad() {
  if (setupPatternPad) return setupPatternPad;
  const canvas = document.getElementById('patternSetupCanvas');
  if (!canvas) return null;
  setupPatternPad = attachPatternPad(canvas, {
    onTooShort: () => setAppPinError('Hubungkan minimal 4 titik.'),
    onComplete: async (seq) => {
      setAppPinError('');
      if (appPinSetupMode === 'disable') {
        const ok = await AttaLock.verify(seq, 'primary');
        if (!ok) {
          setAppPinError('Pola salah. Coba lagi.');
          setupPatternPad.reset(true);
          return;
        }
        await db.settings.delete('app_lock');
        cancelAppPinSetup();
        await refreshSettingsView();
        showToast('Kunci aplikasi dimatikan.');
        return;
      }

      if (setupPatternStep === 1) {
        setupPatternFirst = seq;
        setupPatternStep = 2;
        const hint = document.getElementById('patternSetupHint');
        if (hint) hint.textContent = 'Gambar ulang pola yang sama untuk konfirmasi.';
        setTimeout(() => setupPatternPad && setupPatternPad.reset(false), 260);
      } else {
        if (seq !== setupPatternFirst) {
          setAppPinError('Kedua pola tidak sama. Ulangi dari awal.');
          setupPatternStep = 1;
          setupPatternFirst = '';
          const hint = document.getElementById('patternSetupHint');
          if (hint) hint.textContent = 'Hubungkan minimal 4 titik untuk membuat pola.';
          setupPatternPad.reset(true);
          return;
        }
        if (appPinSetupMode === 'second') {
          await AttaLock.setSecondSecret(seq, 'pattern');
          await finishCreateOrResetLock('Kunci kedua (Pola) aktif.');
        } else {
          await AttaLock.setSecret(seq, 'pattern');
          await finishCreateOrResetLock('Kunci pola aplikasi aktif.');
        }
      }
    }
  });
  return setupPatternPad;
}

async function toggleAppLockSetting(checkbox) {
  const cfg = await AttaLock.getConfig();
  checkbox.checked = Boolean(cfg);
  openAppPinSetup(cfg ? 'disable' : 'create');
}

async function openAppPinSetup(mode) {
  appPinSetupMode = mode;
  const title = document.getElementById('appPinSetupTitle');
  const desc = document.getElementById('appPinSetupDesc');
  const methodRow = document.getElementById('appLockMethodRowSetup');
  const sheet = document.getElementById('appPinSetupSheet');

  ['appPinNew', 'appPinConfirm', 'appPasswordNew', 'appPasswordConfirm'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  setAppPinError('');

  const cfg = await AttaLock.getConfig();
  if (mode === 'recover_reset') {
    title.textContent = 'Buat kunci aplikasi baru';
    desc.textContent = 'Pemulihan berhasil. Pilih PIN, Pola 3x3, atau Kata Sandi baru untuk membuka aplikasi ini.';
    if (methodRow) methodRow.classList.remove('is-hidden');
    selectAppLockMethod((cfg && cfg.method) || 'pin');
  } else if (mode === 'second') {
    title.textContent = cfg && cfg.secondLock ? 'Ubah kunci kedua' : 'Tambah kunci cadangan kedua';
    desc.textContent = 'Kunci kedua dipakai sebagai alternatif cepat apabila kunci utama lupa atau tidak nyaman dipakai.';
    if (methodRow) methodRow.classList.remove('is-hidden');
    const fallbackSecond = cfg && cfg.method === 'pin' ? 'pattern' : 'pin';
    selectAppLockMethod((cfg && cfg.secondLock && cfg.secondLock.method) || fallbackSecond);
  } else if (mode === 'create') {
    title.textContent = cfg ? 'Ganti kunci aplikasi' : 'Buat kunci aplikasi';
    desc.textContent =
      'Pilih PIN, Pola 3x3, atau Kata Sandi. Setelah disimpan, kamu bisa menambahkan Face Key, sidik jari, dan pemulihan.';
    if (methodRow) methodRow.classList.remove('is-hidden');
    selectAppLockMethod((cfg && cfg.method) || 'pin');
  } else {
    title.textContent = 'Matikan kunci aplikasi';
    desc.textContent = 'Masukkan kunci aplikasi utama saat ini untuk mematikan penguncian.';
    if (methodRow) methodRow.classList.add('is-hidden');
    selectAppLockMethod((cfg && cfg.method) || 'pin');
  }

  if (sheet) {
    sheet.classList.toggle('over-lock', mode === 'recover_reset');
    sheet.classList.add('show');
  }
  if (selectedSetupMethod === 'pin') {
    setTimeout(() => document.getElementById('appPinNew')?.focus(), 60);
  } else if (selectedSetupMethod === 'password') {
    setTimeout(() => document.getElementById('appPasswordNew')?.focus(), 60);
  }
}

function cancelAppPinSetup() {
  const sheet = document.getElementById('appPinSetupSheet');
  if (sheet) sheet.classList.remove('show', 'over-lock');
}

function togglePasswordVisibility(inputId, btnEl) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  if (btnEl) btnEl.textContent = tr(show ? 'Sembunyikan' : 'Lihat');
}

async function confirmAppPinSetup() {
  const btn = document.getElementById('appPinSetupBtn');
  if (appPinSetupMode === 'create' || appPinSetupMode === 'second' || appPinSetupMode === 'recover_reset') {
    if (selectedSetupMethod === 'pin') {
      const pin = document.getElementById('appPinNew').value.trim();
      const pin2 = document.getElementById('appPinConfirm').value.trim();
      if (!/^\d{4,8}$/.test(pin)) return setAppPinError('PIN harus 4 sampai 8 angka.');
      if (pin !== pin2) return setAppPinError('Kedua PIN tidak sama.');
      btn.disabled = true;
      if (appPinSetupMode === 'second') {
        await AttaLock.setSecondSecret(pin, 'pin');
        btn.disabled = false;
        await finishCreateOrResetLock('Kunci kedua (PIN) aktif.');
      } else {
        await AttaLock.setSecret(pin, 'pin');
        btn.disabled = false;
        await finishCreateOrResetLock('Kunci PIN aplikasi aktif.');
      }
    } else if (selectedSetupMethod === 'password') {
      const pass = document.getElementById('appPasswordNew').value;
      const pass2 = document.getElementById('appPasswordConfirm').value;
      if (pass.length < 4) return setAppPinError('Kata sandi minimal 4 karakter.');
      if (pass !== pass2) return setAppPinError('Kedua kata sandi tidak sama.');
      btn.disabled = true;
      if (appPinSetupMode === 'second') {
        await AttaLock.setSecondSecret(pass, 'password');
        btn.disabled = false;
        await finishCreateOrResetLock('Kunci kedua (Kata sandi) aktif.');
      } else {
        await AttaLock.setSecret(pass, 'password');
        btn.disabled = false;
        await finishCreateOrResetLock('Kunci kata sandi aplikasi aktif.');
      }
    }
    return;
  }

  const secret =
    selectedSetupMethod === 'password'
      ? document.getElementById('appPasswordNew').value
      : document.getElementById('appPinNew').value.trim();
  if (!secret) return setAppPinError('Masukkan kunci terlebih dahulu.');
  btn.disabled = true;
  const ok = await AttaLock.verify(secret, 'primary');
  btn.disabled = false;
  if (!ok) return setAppPinError('Kunci salah.');
  await db.settings.delete('app_lock');
  cancelAppPinSetup();
  await refreshSettingsView();
  showToast('Kunci aplikasi dimatikan.');
}

async function removeSecondAppLock() {
  await AttaLock.removeSecondSecret();
  await refreshSettingsView();
  showToast('Kunci cadangan kedua dihapus.');
}

async function toggleBiometricUnlock(checkbox) {
  const want = checkbox.checked;
  if (want && !(await AttaLock.biometricAvailable())) {
    checkbox.checked = false;
    showToast('Perangkat atau browser ini belum mendukung Face Key / Sidik Jari.', true);
    return;
  }
  checkbox.disabled = true;
  try {
    if (want) {
      await AttaLock.registerBiometric();
      showToast('Face Key / Sidik Jari aktif sebagai kunci tambahan.');
    } else {
      await AttaLock.removeBiometric();
      showToast('Kunci Face Key / Sidik Jari dimatikan.');
    }
  } catch (_) {
    checkbox.checked = !want;
    showToast('Face Key / Sidik Jari belum diaktifkan. Coba lagi.', true);
  } finally {
    checkbox.disabled = false;
  }
}

async function saveAppLockDelay(value) {
  const cfg = await AttaLock.getConfig();
  if (!cfg) return;
  cfg.delay = Number(value);
  await AttaStorage.setSetting('app_lock', cfg);
  showToast('Pengaturan kunci disimpan.');
}

/* ---------------------------------------------------------------------------
 * Pengaturan: Gemini, penyimpanan, hapus data
 * ------------------------------------------------------------------------- */
async function clearGeminiKey() {
  await AttaStorage.setSetting('gemini_api_key', '');
  const input = document.getElementById('geminiApiKeyInput');
  if (input) input.value = '';
  await refreshSettingsView();
  showToast('Kunci API Gemini dihapus.');
}

let wipeFromLockScreen = false;

function openWipeDataSheet() {
  wipeFromLockScreen = false;
  document.getElementById('wipeDataTitle').textContent = 'Hapus semua data?';
  document.getElementById('wipeDataDesc').textContent =
    'Semua dokumen, tanda tangan, dan pengaturan di HP ini akan hilang dan tidak bisa dikembalikan. Cadangkan dulu kalau masih perlu.';
  showWipeSheet();
}

let generatedRecoveryCode = '';

function generateRecoveryCodeString() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const p1 = Array.from(arr.slice(0, 4), (b) => chars[b % chars.length]).join('');
  const p2 = Array.from(arr.slice(4, 8), (b) => chars[b % chars.length]).join('');
  return `ATTA-${p1}-${p2}`;
}

async function openRecoverySetupSheet() {
  const qSel = document.getElementById('recoveryQuestionSelect');
  const ansIn = document.getElementById('recoveryAnswerInput');
  const codeEl = document.getElementById('recoveryCodeDisplay');
  const errEl = document.getElementById('recoverySetupError');
  const cfg = await AttaLock.getConfig();
  if (!cfg) return;

  generatedRecoveryCode = generateRecoveryCodeString();
  if (qSel && cfg.recoveryQuestion) qSel.value = cfg.recoveryQuestion;
  if (ansIn) ansIn.value = '';
  if (codeEl) codeEl.value = generatedRecoveryCode;
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('is-hidden');
  }
  const sheet = document.getElementById('recoverySetupSheet');
  if (sheet) sheet.classList.add('show');
}

function closeRecoverySetupSheet() {
  const sheet = document.getElementById('recoverySetupSheet');
  if (sheet) sheet.classList.remove('show');
}

async function copyGeneratedRecoveryCode() {
  if (!generatedRecoveryCode) return;
  try {
    if (window.AttaNativeAndroid && typeof window.AttaNativeAndroid.copyText === 'function') {
      window.AttaNativeAndroid.copyText(generatedRecoveryCode);
    } else {
      await navigator.clipboard.writeText(generatedRecoveryCode);
    }
    showToast('Kode pemulihan disalin.');
  } catch (_) {
    showToast(`Kode pemulihan: ${generatedRecoveryCode}`);
  }
}

async function confirmRecoverySetup() {
  const qSel = document.getElementById('recoveryQuestionSelect');
  const ansIn = document.getElementById('recoveryAnswerInput');
  const errEl = document.getElementById('recoverySetupError');
  const question = qSel ? qSel.value : '';
  const answer = ansIn ? ansIn.value.trim() : '';

  if (answer.length < 2) {
    if (errEl) {
      errEl.textContent = tr('Jawaban pertanyaan keamanan minimal 2 huruf.');
      errEl.classList.remove('is-hidden');
    }
    return;
  }

  await AttaLock.setRecoveryData({
    question,
    answer,
    recoveryCode: generatedRecoveryCode
  });
  closeRecoverySetupSheet();
  await refreshSettingsView();
  showToast('Pertanyaan keamanan & kode pemulihan disimpan.');
}

function setForgotLockError(msg) {
  const el = document.getElementById('forgotLockError');
  if (!el) return;
  el.textContent = msg ? tr(msg) : '';
  el.classList.toggle('is-hidden', !msg);
}

async function openForgotPinSheet() {
  setForgotLockError('');
  const cfg = await AttaLock.getConfig();
  const deviceCard = document.getElementById('forgotDeviceCard');
  const qCard = document.getElementById('forgotQuestionCard');
  const qLabel = document.getElementById('forgotQuestionLabel');
  const qInput = document.getElementById('forgotQuestionAnswer');
  const codeCard = document.getElementById('forgotCodeCard');
  const codeInput = document.getElementById('forgotRecoveryCodeInput');
  const accCard = document.getElementById('forgotAccountCard');
  const accEmailEl = document.getElementById('forgotAccountEmailLabel');
  const accPassIn = document.getElementById('forgotAccountPassInput');

  const canDevice = await AttaLock.deviceRecoveryAvailable();
  if (deviceCard) deviceCard.classList.toggle('is-hidden', !canDevice);

  const hasQuestion = Boolean(cfg && cfg.recoveryHash && cfg.recoveryQuestion);
  if (qCard) qCard.classList.toggle('is-hidden', !hasQuestion);
  if (qLabel && hasQuestion) qLabel.textContent = tr(cfg.recoveryQuestion);
  if (qInput) qInput.value = '';

  const hasCode = Boolean(cfg && cfg.recoveryKeyHash);
  if (codeCard) codeCard.classList.toggle('is-hidden', !hasCode);
  if (codeInput) codeInput.value = '';

  const acct = typeof getAccount === 'function' ? await getAccount() : null;
  const hasAcct = Boolean(acct && acct.email);
  if (accCard) accCard.classList.toggle('is-hidden', !hasAcct);
  if (accEmailEl && hasAcct) accEmailEl.textContent = acct.email;
  if (accPassIn) accPassIn.value = '';

  const sheet = document.getElementById('forgotLockSheet');
  if (sheet) sheet.classList.add('show');
}

function closeForgotLockSheet() {
  const sheet = document.getElementById('forgotLockSheet');
  if (sheet) sheet.classList.remove('show');
}

function finishRecoveryAndResetLock() {
  closeForgotLockSheet();
  openAppPinSetup('recover_reset');
}

async function recoverViaDeviceOrBiometric() {
  setForgotLockError('');
  const res = await AttaLock.authenticateDeviceForRecovery();
  if (res.success) {
    finishRecoveryAndResetLock();
  } else {
    setForgotLockError(res.message || 'Verifikasi perangkat dibatalkan.');
  }
}

async function recoverViaSecurityQuestion() {
  setForgotLockError('');
  const ans = document.getElementById('forgotQuestionAnswer')?.value || '';
  if (!ans.trim()) return setForgotLockError('Masukkan jawaban terlebih dahulu.');
  const ok = await AttaLock.verifyRecoveryAnswer(ans);
  if (ok) {
    finishRecoveryAndResetLock();
  } else {
    setForgotLockError('Jawaban tidak cocok. Coba lagi.');
  }
}

async function recoverViaRecoveryCode() {
  setForgotLockError('');
  const code = document.getElementById('forgotRecoveryCodeInput')?.value || '';
  if (!code.trim()) return setForgotLockError('Masukkan kode pemulihan terlebih dahulu.');
  const ok = await AttaLock.verifyRecoveryCode(code);
  if (ok) {
    finishRecoveryAndResetLock();
  } else {
    setForgotLockError('Kode pemulihan salah atau tidak cocok.');
  }
}

async function recoverViaAttaAccount() {
  setForgotLockError('');
  const pass = document.getElementById('forgotAccountPassInput')?.value || '';
  const btn = document.getElementById('forgotAccountBtn');
  const acct = typeof getAccount === 'function' ? await getAccount() : null;
  if (!acct || !acct.email) return setForgotLockError('Belum ada akun ATTA yang masuk.');
  if (!pass) return setForgotLockError('Masukkan kata sandi akun ATTA.');
  if (btn) btn.disabled = true;
  try {
    const res = await accountRequest('login', { email: acct.email, password: pass });
    if (res && res.user && typeof setAccount === 'function') {
      await setAccount({ token: res.token, ...res.user });
    }
    finishRecoveryAndResetLock();
  } catch (err) {
    setForgotLockError((typeof ACCOUNT_ERRORS !== 'undefined' && ACCOUNT_ERRORS[err.code]) || 'Kata sandi akun salah.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openWipeFromForgotSheet() {
  closeForgotLockSheet();
  wipeFromLockScreen = true;
  document.getElementById('wipeDataTitle').textContent = 'Lupa kunci aplikasi';
  document.getElementById('wipeDataDesc').textContent =
    'Semua dokumen, tanda tangan, dan pengaturan di HP ini akan dihapus agar aplikasi terbuka kembali.';
  showWipeSheet();
}

function showWipeSheet() {
  const input = document.getElementById('wipeConfirmInput');
  input.value = '';
  syncWipeButton();
  const sheet = document.getElementById('wipeDataSheet');
  sheet.classList.add('show');
  sheet.classList.toggle('over-lock', wipeFromLockScreen);
}

function syncWipeButton() {
  const ok = document.getElementById('wipeConfirmInput').value.trim().toUpperCase() === 'HAPUS';
  document.getElementById('wipeConfirmBtn').disabled = !ok;
}

function closeWipeDataSheet() {
  document.getElementById('wipeDataSheet').classList.remove('show', 'over-lock');
}

async function confirmWipeAllData() {
  const btn = document.getElementById('wipeConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Menghapus...';
  try {
    await db.files.clear();
    await db.settings.clear();
    if (db.scan_drafts) await db.scan_drafts.clear();
    try {
      localStorage.removeItem('atta_theme');
    } catch (_) {}
  } finally {
    location.reload();
  }
}

function openInfoSheet(id) {
  const sheet = document.getElementById(id);
  if (sheet) sheet.classList.add('show');
}

function closeInfoSheet(id) {
  const sheet = document.getElementById(id);
  if (sheet) sheet.classList.remove('show');
}

/* ---------------------------------------------------------------------------
 * Layar Pengaturan
 * ------------------------------------------------------------------------- */
let settingsReturnTab = 'vault';

async function refreshSettingsView() {
  applyTheme(themePreference);
  if (typeof renderAccountSection === 'function') {
    await renderAccountSection();
    refreshAccountFromServer();
  }
  await applyScanPreferences();

  const cfg = await AttaLock.getConfig();
  const lockBox = document.getElementById('prefAppLock');
  const methodRow = document.getElementById('appLockMethodRow');
  const methodValue = document.getElementById('appLockMethodValue');
  const secondRow = document.getElementById('appLockSecondMethodRow');
  const secondVal = document.getElementById('appLockSecondValue');
  const secondBtn = document.getElementById('appLockSecondBtn');
  const secondClearBtn = document.getElementById('appLockSecondClearBtn');
  const recRow = document.getElementById('appLockRecoveryRow');
  const recStatus = document.getElementById('appLockRecoveryStatus');
  const delayRow = document.getElementById('appLockDelayRow');
  if (lockBox) {
    lockBox.checked = Boolean(cfg);
    lockBox.closest('.setting-row').classList.toggle('border-bottom', !cfg);
  }
  if (methodRow) methodRow.classList.toggle('is-hidden', !cfg);
  const labelMap = { pin: 'PIN Angka', pattern: 'Pola 3x3', password: 'Kata Sandi' };
  if (methodValue && cfg) {
    methodValue.textContent = tr(labelMap[cfg.method || 'pin'] || 'PIN Angka');
  }
  if (secondRow) secondRow.classList.toggle('is-hidden', !cfg);
  if (cfg) {
    const hasSec = Boolean(cfg.secondLock && cfg.secondLock.hash);
    if (secondVal) {
      secondVal.textContent = hasSec
        ? `${tr(labelMap[cfg.secondLock.method] || 'PIN')} (${tr('Aktif')})`
        : tr('Belum diatur');
    }
    if (secondBtn) secondBtn.textContent = tr(hasSec ? 'Ubah' : 'Tambah');
    if (secondClearBtn) secondClearBtn.classList.toggle('is-hidden', !hasSec);
  }
  if (recRow) recRow.classList.toggle('is-hidden', !cfg);
  if (recStatus && cfg) {
    recStatus.textContent =
      cfg.recoveryHash || cfg.recoveryKeyHash
        ? tr('Sudah diatur — aman jika lupa kunci')
        : tr('Belum diatur — disarankan isi agar data tetap aman');
  }
  if (delayRow) delayRow.classList.toggle('is-hidden', !cfg);
  if (cfg) {
    const dSel = document.getElementById('prefAppLockDelay');
    if (dSel) dSel.value = String(cfg.delay != null ? cfg.delay : 60000);
  }

  const bioRow = document.getElementById('appLockBioRow');
  const bioBox = document.getElementById('prefAppLockBio');
  const bioStatus = document.getElementById('appLockBioStatus');
  const bioOk = cfg ? await AttaLock.biometricAvailable() : false;
  if (bioRow) bioRow.classList.toggle('is-hidden', !cfg);
  if (bioBox) {
    bioBox.checked = Boolean(cfg && bioOk && (cfg.bioNative || cfg.bioId));
    bioBox.disabled = !bioOk;
  }
  if (bioStatus) {
    bioStatus.textContent = bioOk
      ? tr('Pakai pemindai wajah atau sidik jari HP sebagai kunci tambahan')
      : tr('Perangkat atau browser ini tidak mendukung Face Key / Sidik Jari');
  }

  const wa = document.getElementById('contactWhatsappLink');
  if (wa) {
    const msg =
      currentLang === 'en'
        ? `Hello, I use ATTA DocStudio Pro version ${APP_CURRENT_VERSION}.`
        : `Halo, saya pengguna ATTA DocStudio Pro versi ${APP_CURRENT_VERSION}.`;
    wa.href = `https://wa.me/6281235928712?text=${encodeURIComponent(msg)}`;
  }
  const mail = document.getElementById('contactEmailLink');
  if (mail) {
    mail.href = `mailto:attalaaliframadhanitrihida@gmail.com?subject=${encodeURIComponent(`ATTA DocStudio Pro ${APP_CURRENT_VERSION}`)}`;
  }

  const key = await AttaStorage.getSetting('gemini_api_key', '');
  const status = document.getElementById('geminiKeyStatus');
  const clearBtn = document.getElementById('geminiKeyClearBtn');
  if (status) status.textContent = key ? 'Tersimpan di HP ini.' : 'Belum diisi. Analisis tetap jalan di HP.';
  if (clearBtn) clearBtn.classList.toggle('is-hidden', !key);

  const stats = await AttaStorage.getStorageStats();
  const title = document.getElementById('settingsStorageTitle');
  if (title) title.textContent = `${stats.fileCount} berkas, ${formatSizeId(stats.appUsedBytes)}`;
}

function openSettingsView() {
  if (currentTab !== 'settings') settingsReturnTab = currentTab || 'vault';
  refreshSettingsView();
}

function closeSettingsView() {
  switchTab(settingsReturnTab && settingsReturnTab !== 'settings' ? settingsReturnTab : 'vault');
}

async function bootSettingsAndLock() {
  const pref = await AttaStorage.getSetting('pref_theme', null);
  if (pref) {
    applyTheme(pref);
    try {
      localStorage.setItem('atta_theme', pref);
    } catch (_) {}
  } else {
    applyTheme(themePreference);
  }
  await applyScanPreferences();
  await AttaLock.show();
}

window.AttaLock = AttaLock;
