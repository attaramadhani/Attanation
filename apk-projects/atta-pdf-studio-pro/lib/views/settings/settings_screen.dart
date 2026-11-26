import 'package:flutter/material.dart';
import '../../core/services/ai_intelligence_service.dart';
import '../../core/services/atta_cloud_service.dart';
import '../../core/theme/app_colors.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _apiKeyController = TextEditingController();
  final TextEditingController _licenseController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  bool _hasApiKey = false;
  bool _checkingUpdate = false;
  bool _activatingLicense = false;
  AttaCloudLicenseStatus? _licenseStatus;
  AttaUpdateInfo? _updateInfo;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final key = await AiIntelligenceService.getApiKey();
    final lic = await AttaCloudService.getLocalLicenseStatus();
    if (!mounted) return;
    setState(() {
      if (key != null && key.isNotEmpty) {
        _hasApiKey = true;
        _apiKeyController.text = key;
      }
      _licenseStatus = lic;
      _licenseController.text = lic.licenseKey;
      _emailController.text = lic.customerEmail;
    });
  }

  Future<void> _saveApiKey() async {
    await AiIntelligenceService.saveApiKey(_apiKeyController.text.trim());
    setState(() {
      _hasApiKey = _apiKeyController.text.trim().isNotEmpty;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kunci API Gemini berhasil disimpan!')),
      );
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
        backgroundColor: res.isPro ? const Color(0xFF0F766E) : Colors.redAccent,
      ),
    );
  }

  Future<void> _checkForUpdates() async {
    setState(() => _checkingUpdate = true);
    final info = await AttaCloudService.checkForUpdate(
      productSlug: 'atta-docstudio-pro',
      currentVersionCode: 20,
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
              : 'Anda sudah menggunakan versi terbaru ATTA DocStudio Pro (v2.0.0).',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lic = _licenseStatus;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lisensi, Pembaruan & AI', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ATTA NATION Brand & Pro Status Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF141414), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.16),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Image.asset(
                      'assets/brand/atta_symbol_white.png',
                      width: 32,
                      height: 32,
                      errorBuilder: (_, __, ___) => const Icon(Icons.verified, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ATTA DocStudio Pro',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                          ),
                          Text(
                            lic?.planName ?? 'ATTA NATION Pro Lifetime',
                            style: const TextStyle(color: Color(0xFF2DD4BF), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF14B8A6).withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF2DD4BF).withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.workspace_premium_rounded, color: Color(0xFF2DD4BF), size: 15),
                          const SizedBox(width: 4),
                          Text(
                            (lic?.isPro ?? true) ? 'PRO AKTIF' : 'STANDAR',
                            style: const TextStyle(color: Color(0xFF2DD4BF), fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  lic?.message ??
                      'Seluruh pemrosesan dokumen & penyimpanan file berjalan 100% di HP Anda. Sinkronisasi ke Web ATTA NATION hanya untuk lisensi & auto-update.',
                  style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12.5, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          // Web License Activation & Direct OTA Update Section
          const Text(
            'SINKRONISASI LISENSI & AUTO-UPDATE WEB ATTA NATION',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.vpn_key_rounded, color: Color(0xFF0F766E)),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Aktivasi Kode Pembelian Web (Midtrans)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Masukkan email dan kode lisensi (ATTA-XXXX-XXXX) yang Anda terima setelah pembayaran di website resmi ATTA NATION.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email Pelanggan',
                      hintText: 'nama@email.com',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _licenseController,
                    decoration: InputDecoration(
                      labelText: 'Kode Lisensi ATTA NATION',
                      hintText: 'ATTA-DOCS-2026-XXXX',
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
                          label: const Text('Cek Update APK'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _activatingLicense ? null : _activateLicense,
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF141414)),
                          icon: const Icon(Icons.verified_rounded, size: 18),
                          label: const Text('Verifikasi'),
                        ),
                      ),
                    ],
                  ),
                  if (_updateInfo != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Update Tersedia: v${_updateInfo!.versionName}',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
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
          const SizedBox(height: 22),

          // AI Intelligence Section
          const Text('KECERDASAN BUATAN (AI)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome_rounded, color: AppColors.intelligenceAi),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Google Gemini API Key (Opsional)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ),
                      if (_hasApiKey)
                        const Icon(Icons.check_circle_rounded, color: Colors.green, size: 20),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Digunakan untuk fitur Perangkum AI, Terjemahan PDF, dan Markdown Generator. Gratis dari Google AI Studio.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
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
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton(
                      onPressed: _saveApiKey,
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.intelligenceAi),
                      child: const Text('Simpan Kunci API'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),

          // General Settings
          const Text('ARSITEKTUR PRIVASI & PENYIMPANAN', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                const ListTile(
                  leading: Icon(Icons.phone_android_rounded, color: Color(0xFF0F766E)),
                  title: Text('Penyimpanan 100% Lokal di HP Anda'),
                  subtitle: Text('Dokumen hasil scan dan PDF disimpan langsung di memori perangkat Anda, tidak membebani cloud.'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Container(
                    width: 32,
                    height: 32,
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF141414),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Image.asset('assets/brand/atta_symbol_white.png', fit: BoxFit.contain),
                  ),
                  title: const Text('ATTA NATION — Technology Product Studio'),
                  subtitle: const Text('From Reflection to Creation · v2.0.0 (Build 20)'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
