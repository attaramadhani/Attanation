/**
 * ATTA DocStudio Pro — akun opsional (profil saja).
 * Berbicara dengan server-api/account.php milik ATTA NATION.
 * Token sesi disimpan di HP ini (IndexedDB) dan tidak ikut file cadangan.
 * Dokumen tidak pernah dikirim ke server akun.
 */

const ACCOUNT_ERRORS = {
  name: 'Nama minimal 2 huruf.',
  email: 'Format email tidak valid.',
  password: 'Kata sandi minimal 8 karakter.',
  mismatch: 'Kedua kata sandi tidak sama.',
  exists: 'Email ini sudah terdaftar. Silakan masuk.',
  credentials: 'Email atau kata sandi salah.',
  rate: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.',
  session: 'Sesi berakhir. Silakan masuk lagi.',
  network: 'Tidak bisa terhubung ke server akun. Periksa internet.',
  server: 'Server akun sedang bermasalah. Coba lagi nanti.',
  noserver: 'Server akun belum dipasang di aplikasi ini.'
};

let accountMode = 'login'; // 'login' | 'register'

function accountApiBase() {
  return (window.ATTA_CONFIG && window.ATTA_CONFIG.accountApi) || '';
}

async function getAccount() {
  return AttaStorage.getSetting('account', null);
}

async function setAccount(value) {
  await AttaStorage.setSetting('account', value);
}

/** Panggil API akun. Melempar Error dengan .code yang dipetakan ke ACCOUNT_ERRORS */
async function accountRequest(action, body, token) {
  const base = accountApiBase();
  if (!base) {
    const e = new Error('noserver');
    e.code = 'noserver';
    throw e;
  }
  let res;
  try {
    res = await fetch(`${base}?action=${encodeURIComponent(action)}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
  } catch (_) {
    const e = new Error('network');
    e.code = 'network';
    throw e;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok || !data || data.ok !== true) {
    const code = data && ACCOUNT_ERRORS[data.error] ? data.error : res.status === 401 ? 'session' : 'server';
    const e = new Error(code);
    e.code = code;
    throw e;
  }
  return data;
}

function accountErrorText(err) {
  return ACCOUNT_ERRORS[(err && err.code) || 'server'] || ACCOUNT_ERRORS.server;
}

/* ---------------------------------------------------------------------------
 * Tampilan di Pengaturan
 * ------------------------------------------------------------------------- */
async function renderAccountSection() {
  const acc = await getAccount();
  const out = document.getElementById('accountLoggedOut');
  const inn = document.getElementById('accountLoggedIn');
  if (!out || !inn) return;
  const loggedIn = Boolean(acc && acc.token && acc.user);
  out.classList.toggle('is-hidden', loggedIn);
  inn.classList.toggle('is-hidden', !loggedIn);
  if (loggedIn) {
    document.getElementById('accountName').textContent = acc.user.name;
    document.getElementById('accountEmail').textContent = acc.user.email;
    document.getElementById('accountAvatar').textContent = (acc.user.name || '?').trim().charAt(0).toUpperCase();
  }
}

/** Perbarui profil dari server bila online; sesi kedaluwarsa = keluar otomatis */
async function refreshAccountFromServer() {
  const acc = await getAccount();
  if (!acc || !acc.token || !navigator.onLine || !accountApiBase()) return;
  try {
    const data = await accountRequest('me', null, acc.token);
    await setAccount({ token: acc.token, user: data.user });
  } catch (err) {
    if (err.code === 'session') {
      await setAccount(null);
      showToast(ACCOUNT_ERRORS.session, true);
    }
  }
  await renderAccountSection();
}

/* ---------------------------------------------------------------------------
 * Masuk / Daftar
 * ------------------------------------------------------------------------- */
function setAccountFormError(msg) {
  const el = document.getElementById('accountFormError');
  el.textContent = msg || '';
  el.classList.toggle('is-hidden', !msg);
}

function applyAccountMode() {
  const reg = accountMode === 'register';
  document.getElementById('accountSheetTitle').textContent = reg ? 'Daftar akun' : 'Masuk';
  document.getElementById('accountSheetDesc').textContent = reg
    ? 'Buat akun untuk menyimpan nama dan email profilmu. Dokumen tetap di HP ini.'
    : 'Masuk untuk menampilkan profilmu di aplikasi. Dokumen tidak dikirim ke server.';
  document.getElementById('accountNameGroup').classList.toggle('is-hidden', !reg);
  document.getElementById('accountPassword2Group').classList.toggle('is-hidden', !reg);
  document.getElementById('accountForgotBtn').classList.toggle('is-hidden', reg);
  document.getElementById('accountSubmitBtn').textContent = reg ? 'Daftar' : 'Masuk';
  document.getElementById('accountSwitchBtn').textContent = reg
    ? 'Sudah punya akun? Masuk'
    : 'Belum punya akun? Daftar';
  document.getElementById('accountPasswordInput').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
  setAccountFormError('');
}

function openAccountSheet(mode) {
  accountMode = mode;
  document.getElementById('accountForm').reset();
  applyAccountMode();
  if (!accountApiBase()) setAccountFormError(ACCOUNT_ERRORS.noserver);
  document.getElementById('accountSheet').classList.add('show');
}

function closeAccountSheet() {
  document.getElementById('accountSheet').classList.remove('show');
}

function switchAccountMode() {
  accountMode = accountMode === 'login' ? 'register' : 'login';
  applyAccountMode();
}

function openAccountForgot() {
  setAccountFormError('');
  const msg = currentLang === 'en'
    ? 'Hello, I forgot my ATTA DocStudio Pro account password. My email: '
    : 'Halo, saya lupa kata sandi akun ATTA DocStudio Pro. Email saya: ';
  AttaLock.skipNext();
  window.open(`https://wa.me/6281235928712?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

async function submitAccountForm(event) {
  event.preventDefault();
  const reg = accountMode === 'register';
  const name = document.getElementById('accountNameInput').value.trim();
  const email = document.getElementById('accountEmailInput').value.trim().toLowerCase();
  const password = document.getElementById('accountPasswordInput').value;
  const password2 = document.getElementById('accountPassword2Input').value;

  if (reg && name.length < 2) return setAccountFormError(ACCOUNT_ERRORS.name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAccountFormError(ACCOUNT_ERRORS.email);
  if (reg && password.length < 8) return setAccountFormError(ACCOUNT_ERRORS.password);
  if (!reg && !password) return setAccountFormError(ACCOUNT_ERRORS.credentials);
  if (reg && password !== password2) return setAccountFormError(ACCOUNT_ERRORS.mismatch);

  const btn = document.getElementById('accountSubmitBtn');
  btn.disabled = true;
  try {
    const data = await accountRequest(reg ? 'register' : 'login', reg ? { name, email, password } : { email, password });
    await setAccount({ token: data.token, user: data.user });
    closeAccountSheet();
    await renderAccountSection();
    showToast(reg ? 'Akun dibuat. Kamu sudah masuk.' : `Halo, ${data.user.name}.`);
  } catch (err) {
    setAccountFormError(accountErrorText(err));
  } finally {
    btn.disabled = false;
  }
}

/* ---------------------------------------------------------------------------
 * Ubah nama, keluar, hapus akun
 * ------------------------------------------------------------------------- */
async function openAccountNameSheet() {
  const acc = await getAccount();
  document.getElementById('accountNewNameInput').value = acc && acc.user ? acc.user.name : '';
  document.getElementById('accountNameError').classList.add('is-hidden');
  openInfoSheet('accountNameSheet');
}

async function saveAccountName() {
  const name = document.getElementById('accountNewNameInput').value.trim();
  const errEl = document.getElementById('accountNameError');
  const showErr = (m) => {
    errEl.textContent = m;
    errEl.classList.remove('is-hidden');
  };
  if (name.length < 2) return showErr(ACCOUNT_ERRORS.name);
  const acc = await getAccount();
  const btn = document.getElementById('accountNameSaveBtn');
  btn.disabled = true;
  try {
    const data = await accountRequest('update', { name }, acc.token);
    await setAccount({ token: acc.token, user: data.user });
    closeInfoSheet('accountNameSheet');
    await renderAccountSection();
    showToast('Nama diperbarui.');
  } catch (err) {
    if (err.code === 'session') await setAccount(null);
    showErr(accountErrorText(err));
    await renderAccountSection();
  } finally {
    btn.disabled = false;
  }
}

async function logoutAccount() {
  const acc = await getAccount();
  if (acc && acc.token) {
    // Hapus sesi di server bila bisa; di HP tetap keluar walau offline
    accountRequest('logout', {}, acc.token).catch(() => {});
  }
  await setAccount(null);
  await renderAccountSection();
  showToast('Kamu sudah keluar dari akun.');
}

function openAccountDeleteSheet() {
  document.getElementById('accountDeletePassword').value = '';
  document.getElementById('accountDeleteError').classList.add('is-hidden');
  openInfoSheet('accountDeleteSheet');
}

async function confirmAccountDelete() {
  const password = document.getElementById('accountDeletePassword').value;
  const errEl = document.getElementById('accountDeleteError');
  const acc = await getAccount();
  const btn = document.getElementById('accountDeleteBtn');
  btn.disabled = true;
  try {
    await accountRequest('delete', { password }, acc && acc.token);
    await setAccount(null);
    closeInfoSheet('accountDeleteSheet');
    await renderAccountSection();
    showToast('Akun dihapus.');
  } catch (err) {
    errEl.textContent = err.code === 'credentials' ? 'Kata sandi salah.' : accountErrorText(err);
    errEl.classList.remove('is-hidden');
  } finally {
    btn.disabled = false;
  }
}
