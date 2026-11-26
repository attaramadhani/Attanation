import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/services/ai_intelligence_service.dart';
import '../../core/services/app_preferences.dart';
import '../../core/services/atta_cloud_service.dart';
import '../../core/services/backup_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/file_helper.dart';
import '../../widgets/processing_dialog.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback? onDataRestored;

  const SettingsScreen({super.key, this.onDataRestored});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _apiKeyController = TextEditingController();
  final TextEditingController _licenseController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final LocalAuthentication _auth = LocalAuthentication();

  bool _hasApiKey = false;
  bool _checkingUpdate = false;
  bool _activatingLicense = false;
  AttaCloudLicenseStatus? _licenseStatus;
  AttaUpdateInfo? _updateInfo;

  int _storageCount = 0;
  int _storageBytes = 0;
  String? _lastBackupAt;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _apiKeyController.dispose();
    _licenseController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final key = await AiIntelligenceService.getApiKey();
    final lic = await AttaCloudService.getLocalLicenseStatus();
    final storage = await BackupService.getStorageSummary();
    final lastBackup = await BackupService.getLastBackupAt();
    if (!mounted) return;
    setState(() {
      if (key != null && key.isNotEmpty) {
        _hasApiKey = true;
        _apiKeyController.text = key;
      } else {
        _hasApiKey = false;
        _apiKeyController.clear();
      }
      _licenseStatus = lic;
      _licenseController.text = lic.licenseKey;
      _emailController.text = lic.customerEmail;
      _storageCount = storage.fileCount;
      _storageBytes = storage.totalBytes;
      _lastBackupAt = lastBackup;
    });
  }

  Future<void> _saveApiKey() async {
    final trimmed = _apiKeyController.text.trim();
    await AiIntelligenceService.saveApiKey(trimmed);
    setState(() => _hasApiKey = trimmed.isNotEmpty);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            trimmed.isEmpty
                ? 'Kunci API Gemini dihapus dari perangkat.'
                : 'Kunci API Gemini disimpan lokal (tetap minta izin sebelum kirim teks).',
          ),
        ),
      );
    }
  }

  Future<void> _exportBackupZip() async {
    ProcessingDialog.show(
      context,
      title: 'Membuat Cadangan ZIP',
      message: 'Mengemas seluruh dokumen PDF, hasil scan OpenCV, dan pengaturan...',
    );
    try {
      final res = await BackupService.exportFullBackupZip();
      if (!mounted) return;
      ProcessingDialog.hide(context);
      await _loadSettings();
      if (!mounted) return;

      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cadangan ZIP Siap'),
          content: Text(
            '${res.totalFiles} berkas dikemas ke ${res.zipName} (${FileHelper.formatBytes(res.sizeBytes)}).\n\n'
            'Simpan ke Google Drive/Files atau bagikan agar bisa dipulihkan saat ganti HP.',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                SharePlus.instance.share(
                  ShareParams(files: [XFile(res.zipPath)], text: res.zipName),
                );
              },
              child: const Text('Bagikan'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                FileHelper.saveToLocalDevice(
                  context,
                  sourcePath: res.zipPath,
                  preferredName: res.zipName,
                );
              },
              child: const Text('Simpan ke HP'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ProcessingDialog.hide(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal membuat cadangan ZIP: $e')),
        );
      }
    }
  }

  Future<void> _importBackupZip() async {
    final picked = await AppPreferences.instance.runExternal(
      () => FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['zip'],
      ),
    );
    if (!mounted || picked.isEmpty || picked.first.path == null) return;

    ProcessingDialog.show(
      context,
      title: 'Memulihkan Cadangan',
      message: 'Membaca arsip ZIP dan mengembalikan dokumen lokal...',
    );
    try {
      final res = await BackupService.importBackupZip(File(picked.first.path!));
      if (!mounted) return;
      ProcessingDialog.hide(context);
      await AppPreferences.instance.load();
      await _loadSettings();
      widget.onDataRestored?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${res.restoredCount} berkas berhasil dipulihkan!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ProcessingDialog.hide(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memulihkan ZIP: $e')),
        );
      }
    }
  }

  Future<void> _toggleGlobalLock(bool nextValue) async {
    try {
      final supported = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
      if (!supported) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Perangkat tidak mendukung kunci biometrik / PIN layar.')),
          );
        }
        return;
      }
      final ok = await AppPreferences.instance.runExternal(
        () => _auth.authenticate(
          localizedReason: nextValue
              ? 'Konfirmasi untuk mengaktifkan kunci aplikasi ATTA DocStudio Pro'
              : 'Konfirmasi untuk mematikan kunci aplikasi',
          options: const AuthenticationOptions(stickyAuth: true, biometricOnly: false),
        ),
      );
      if (!ok) return;
      await AppPreferences.instance.setGlobalLockEnabled(nextValue);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(nextValue ? 'Kunci aplikasi global diaktifkan.' : 'Kunci aplikasi dimatikan.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal mengatur kunci aplikasi: $e')),
        );
      }
    }
  }

  Future<void> _activateLicense() async {
    setState(() => _activatingLicense = true);
    final res = await AttaCloudService.activateLicense(
      licenseKey: _licenseController.text,
      email: _emailController.text,
      productSlug: 'atta-docstudio-pro',
    );
    if (!mounted) return;
    setState(() {
      _activatingLicense = false;
      _licenseStatus = res;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message),
        backgroundColor: res.isPro ? AppColors.optimizeGreen : AppColors.danger,
      ),
    );
  }

  Future<void> _checkForUpdates() async {
    setState(() => _checkingUpdate = true);
    final info = await AttaCloudService.checkForUpdate(
      productSlug: 'atta-docstudio-pro',
      currentVersionCode: 25,
    );
    if (!mounted) return;
    setState(() {
      _checkingUpdate = false;
      _updateInfo = info;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          info != null
              ? 'Versi baru v${info.versionName} tersedia dari server ATTA NATION!'
              : 'Anda sudah menggunakan versi terbaru ATTA DocStudio Pro (v2.5.0).',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lic = _licenseStatus;
    final prefs = AppPreferences.instance;
    final muted = AppColors.mutedOf(context);
    final pen = AppColors.penOf(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          prefs.tr('Cadangan & Pengaturan', 'Backup & Settings'),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: prefs.tr('Hitung ulang penyimpanan', 'Refresh storage'),
            onPressed: _loadSettings,
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: prefs,
        builder: (context, _) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // 1. Kartu Penyimpanan Lokal & Cadangan ZIP (Port terbaik dari PWA)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        prefs.tr('PENYIMPANAN & CADANGAN LOKAL', 'LOCAL STORAGE & BACKUP'),
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: muted, letterSpacing: 0.6),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        FileHelper.formatBytes(_storageBytes),
                        style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, letterSpacing: -1),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$_storageCount ${prefs.tr('dokumen tersimpan lokal di HP ini.', 'documents stored locally on this phone.')}'
                        '${_lastBackupAt != null ? '\n${prefs.tr('Terakhir dicadangkan', 'Last backed up')}: ${_lastBackupAt!.substring(0, 10)}' : ''}',
                        style: TextStyle(fontSize: 13, color: muted),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _exportBackupZip,
                              icon: const Icon(Icons.archive_outlined, size: 18),
                              label: Text(prefs.tr('Cadangkan ZIP', 'Export ZIP')),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _importBackupZip,
                              icon: const Icon(Icons.unarchive_outlined, size: 18),
                              label: Text(prefs.tr('Pulihkan ZIP', 'Restore ZIP')),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // 2. Tampilan, Bahasa & Keamanan (Kertas dan Tinta + Global Lock)
              Text(
                prefs.tr('TAMPILAN, BAHASA & KEAMANAN', 'APPEARANCE, LANGUAGE & SECURITY'),
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: muted),
              ),
              const SizedBox(height: 8),
              Card(
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(prefs.tr('Tema', 'Theme'), style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: SegmentedButton<ThemeMode>(
                              segments: [
                                ButtonSegment(value: ThemeMode.light, label: Text(prefs.tr('Terang', 'Light'))),
                                ButtonSegment(value: ThemeMode.dark, label: Text(prefs.tr('Gelap', 'Dark'))),
                                ButtonSegment(value: ThemeMode.system, label: Text(prefs.tr('Sistem', 'System'))),
                              ],
                              selected: {prefs.themeMode},
                              onSelectionChanged: (set) => prefs.setThemeMode(set.first),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(prefs.tr('Bahasa Antarmuka', 'App Language'), style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: SegmentedButton<String>(
                              segments: const [
                                ButtonSegment(value: 'id', label: Text('Indonesia')),
                                ButtonSegment(value: 'en', label: Text('English')),
                              ],
                              selected: {prefs.lang},
                              onSelectionChanged: (set) => prefs.setLanguage(set.first),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      secondary: Icon(Icons.fingerprint_rounded, color: pen),
                      title: Text(prefs.tr('Kunci Aplikasi (Biometrik / PIN HP)', 'App Lock (Biometric / Device PIN)')),
                      subtitle: Text(
                        prefs.tr(
                          'Meminta sidik jari, wajah, atau PIN HP saat membuka aplikasi.',
                          'Require fingerprint, face, or device PIN when opening the app.',
                        ),
                        style: const TextStyle(fontSize: 12),
                      ),
                      value: prefs.globalLockEnabled,
                      onChanged: _toggleGlobalLock,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // 3. Google Gemini API Key
              Text(
                prefs.tr('KECERDASAN BUATAN (AI)', 'AI INTELLIGENCE'),
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: muted),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.auto_awesome_rounded, color: pen),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'Google Gemini API Key (Opsional)',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                          ),
                          if (_hasApiKey) const Icon(Icons.check_circle_rounded, color: AppColors.optimizeGreen, size: 20),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        prefs.tr(
                          'Ringkasan dan Markdown bekerja 100% offline tanpa API Key. Kunci hanya dipakai untuk fitur AI awan dan tetap meminta persetujuan per dokumen sebelum teks dikirim keluar.',
                          'Summary and Markdown work 100% offline without an API key. Your key is used only when you grant explicit per-document consent.',
                        ),
                        style: TextStyle(fontSize: 12, color: muted),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _apiKeyController,
                        obscureText: true,
                        decoration: InputDecoration(
                          hintText: 'Masukkan Kunci API...',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (_hasApiKey)
                            TextButton(
                              onPressed: () {
                                _apiKeyController.clear();
                                _saveApiKey();
                              },
                              child: Text(prefs.tr('Hapus Kunci', 'Remove Key')),
                            ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: _saveApiKey,
                            child: Text(prefs.tr('Simpan Kunci', 'Save Key')),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // 4. Web License & Update Status
              Text(
                prefs.tr('LISENSI & PEMBARUAN ATTA NATION', 'LICENSE & UPDATES'),
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: muted),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Image.asset(
                            'assets/brand/atta_symbol_black.png',
                            width: 26,
                            height: 26,
                            errorBuilder: (_, __, ___) => Icon(Icons.verified, color: pen),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              lic?.planName ?? 'ATTA NATION Pro Lifetime',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.optimizeGreen.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              (lic?.isPro ?? true) ? 'PRO AKTIF' : 'STANDAR',
                              style: const TextStyle(color: AppColors.optimizeGreen, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: 'Email Pelanggan',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _licenseController,
                        decoration: InputDecoration(
                          labelText: 'Kode Lisensi ATTA NATION',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _checkingUpdate ? null : _checkForUpdates,
                              icon: _checkingUpdate
                                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.system_update_rounded, size: 18),
                              label: Text(prefs.tr('Cek Update', 'Check Update')),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _activatingLicense ? null : _activateLicense,
                              icon: const Icon(Icons.verified_rounded, size: 18),
                              label: Text(prefs.tr('Verifikasi', 'Verify')),
                            ),
                          ),
                        ],
                      ),
                      if (_updateInfo != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.optimizeGreen.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Update Tersedia: v${_updateInfo!.versionName}',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.optimizeGreen),
                              ),
                              const SizedBox(height: 4),
                              Text(_updateInfo!.changelog, style: const TextStyle(fontSize: 12)),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Center(
                child: Text(
                  'ATTA DocStudio Pro · v2.5.0 (Build 25) · ATTA NATION',
                  style: TextStyle(fontSize: 12, color: muted),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
