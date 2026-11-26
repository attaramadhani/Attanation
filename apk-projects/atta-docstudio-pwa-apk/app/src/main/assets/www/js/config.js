/**
 * Konfigurasi ATTA DocStudio Pro.
 * accountApi: alamat lengkap file account.php di hosting ATTA NATION,
 *             misalnya 'https://api.attanation.com/docstudio/account.php'.
 * versionUrl: alamat file version.json di hosting ATTA NATION untuk cek update APK,
 *             misalnya 'https://docstudio.attanation.com/version.json'.
 * Biarkan kosong bila server belum dipasang (PWA akan memakai ./version.json).
 */
window.ATTA_CONFIG = {
  accountApi: '',
  versionUrl: ''
};
