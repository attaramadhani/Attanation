import 'dart:convert';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';
import '../../core/services/ai_intelligence_service.dart';
import '../../core/services/app_preferences.dart';
import '../../core/services/document_convert_service.dart';
import '../../core/services/pdf_engine_service.dart';
import '../../core/services/raster_pdf_service.dart';
import '../../core/services/recent_files_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/file_helper.dart';
import '../../models/processed_file.dart';
import '../../scanner_suite/services/ocr_service.dart';
import '../../widgets/processing_dialog.dart';

class AiIntelligenceScreen extends StatefulWidget {
  final String initialMode; // 'summarize', 'translate', 'markdown'
  final File? initialFile;

  const AiIntelligenceScreen({
    super.key,
    this.initialMode = 'summarize',
    this.initialFile,
  });

  @override
  State<AiIntelligenceScreen> createState() => _AiIntelligenceScreenState();
}

class _AiIntelligenceScreenState extends State<AiIntelligenceScreen> {
  File? _selectedFile;
  String _extractedText = '';
  String _aiResult = '';
  late String _currentMode;
  String _targetLanguage = 'Bahasa Indonesia';
  bool _hasApiKey = false;
  bool _externalConsent = false;
  bool _lastResultWasExternal = false;
  bool _usedOfflineOcr = false;

  @override
  void initState() {
    super.initState();
    _currentMode = widget.initialMode;
    _refreshApiKeyState();
    if (widget.initialFile != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadDocument(widget.initialFile!);
      });
    }
  }

  Future<void> _refreshApiKeyState() async {
    final key = await AiIntelligenceService.getApiKey();
    if (!mounted) return;
    setState(() => _hasApiKey = key != null && key.trim().isNotEmpty);
  }

  Future<void> _pickFile() async {
    final files = await AppPreferences.instance.runExternal(
      () => FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'jpg', 'jpeg', 'png'],
      ),
    );
    if (!mounted) return;

    if (files.isNotEmpty && files.first.path != null) {
      await _loadDocument(File(files.first.path!));
    }
  }

  Future<void> _loadDocument(File file) async {
    final ext = p.extension(file.path).toLowerCase();
    ProcessingDialog.show(
      context,
      title: 'Membaca Isi Dokumen',
      message: ext == '.pdf'
          ? 'Mengekstrak teks PDF (otomatis beralih ke OCR offline jika scan)...'
          : 'Membaca isi berkas secara lokal di perangkat...',
    );

    try {
      String text = '';
      bool usedOcr = false;

      if (ext == '.pdf') {
        text = await PdfEngineService.extractText(file);
        final meaningful = text.replaceAll(RegExp(r'\s'), '').length;
        if (meaningful < 10) {
          // PDF berupa gambar hasil scan -> jalankan OCR ML Kit Offline secara lokal (maks 15 halaman pertama agar cepat)
          usedOcr = true;
          final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
          final buf = StringBuffer();
          int page = 0;
          try {
            await for (final imagePath in RasterPdfService.renderPagesToTempPng(file)) {
              page++;
              ProcessingDialog.updateProgress('OCR Offline Halaman $page...');
              final res = await recognizer.processImage(InputImage.fromFilePath(imagePath));
              if (res.text.trim().isNotEmpty) buf.writeln(res.text.trim());
              try {
                await File(imagePath).delete();
              } catch (_) {}
              if (page >= 15) break;
            }
          } finally {
            await recognizer.close();
          }
          text = buf.toString().trim();
        }
      } else if (ext == '.jpg' || ext == '.jpeg' || ext == '.png') {
        usedOcr = true;
        final ocrPage = await OcrService.recognizeFile(file.path);
        text = ocrPage.text.trim();
      } else {
        text = await DocumentConvertService.extractPlainText(file);
      }

      if (!mounted) return;
      ProcessingDialog.hide(context);
      setState(() {
        _selectedFile = file;
        _extractedText = text;
        _aiResult = '';
        _usedOfflineOcr = usedOcr;
      });
    } catch (e) {
      if (mounted) {
        ProcessingDialog.hide(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal membaca dokumen: ${PdfEngineService.friendlyError(e)}')),
        );
      }
    }
  }

  void _runOffline() {
    if (_extractedText.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak ada teks yang terbaca pada dokumen ini.')),
      );
      return;
    }
    String result = '';
    if (_currentMode == 'summarize') {
      result = AiIntelligenceService.summarizeTextLocally(_extractedText);
    } else if (_currentMode == 'markdown') {
      result = AiIntelligenceService.convertToMarkdownLocally(_extractedText);
    } else {
      result =
          'Mode Terjemahan memerlukan Google Gemini API dan persetujuan pengiriman teks di bawah. Gunakan mode Ringkasan atau Markdown untuk pemrosesan 100% lokal tanpa internet.';
    }
    setState(() {
      _aiResult = result;
      _lastResultWasExternal = false;
    });
  }

  Future<void> _showApiKeyDialog() async {
    final existing = await AiIntelligenceService.getApiKey();
    if (!mounted) return;
    final controller = TextEditingController(text: existing ?? '');
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.key_rounded, color: AppColors.intelligenceAi),
            SizedBox(width: 8),
            Expanded(child: Text('Kunci API Gemini (Opsional)')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Kunci disimpan lokal di HP ini saja. Anda tetap harus mencentang persetujuan sebelum teks dokumen dikirim keluar.',
              style: TextStyle(fontSize: 13, color: AppColors.mutedOf(context)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: 'AIzaSy...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await AiIntelligenceService.saveApiKey('');
              if (ctx.mounted) Navigator.pop(ctx);
              await _refreshApiKeyState();
              if (mounted) setState(() => _externalConsent = false);
            },
            child: const Text('Hapus Kunci'),
          ),
          ElevatedButton(
            onPressed: () async {
              await AiIntelligenceService.saveApiKey(controller.text.trim());
              if (ctx.mounted) Navigator.pop(ctx);
              await _refreshApiKeyState();
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  Future<void> _runAi() async {
    if (_extractedText.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak ada teks yang terbaca pada dokumen ini.')),
      );
      return;
    }

    final apiKey = await AiIntelligenceService.getApiKey();
    if (apiKey == null || apiKey.trim().isEmpty || !_externalConsent) {
      _runOffline();
      if (mounted && (apiKey != null && apiKey.trim().isNotEmpty && !_externalConsent)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Persetujuan belum dicentang — diproses 100% lokal di perangkat ini.'),
          ),
        );
      }
      return;
    }

    ProcessingDialog.show(
      context,
      title: 'Memproses via Google Gemini',
      message: 'Mengirim teks dokumen atas persetujuan Anda...',
    );

    try {
      String result = '';
      if (_currentMode == 'summarize') {
        result = await AiIntelligenceService.summarizeText(_extractedText);
      } else if (_currentMode == 'translate') {
        result = await AiIntelligenceService.translateText(_extractedText, _targetLanguage);
      } else {
        result = await AiIntelligenceService.convertToMarkdown(_extractedText);
      }

      if (mounted) {
        ProcessingDialog.hide(context);
        setState(() {
          _aiResult = result;
          _lastResultWasExternal = true;
        });
      }
    } catch (e) {
      if (mounted) {
        ProcessingDialog.hide(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${e.toString().replaceFirst('Exception: ', '')} — beralih ke analisis lokal.'),
          ),
        );
        _runOffline();
      }
    }
  }

  Future<void> _saveToVaultAndDevice({bool exportPicker = false}) async {
    if (_aiResult.isEmpty) return;
    final ext = _currentMode == 'markdown' ? '.md' : '.txt';
    final base = _selectedFile != null ? p.basenameWithoutExtension(_selectedFile!.path) : 'Analisis';
    final filePath = await FileHelper.generateOutputPath('${base}_$_currentMode', ext);
    final bytes = Uint8List.fromList(utf8.encode(_aiResult));
    await File(filePath).writeAsBytes(bytes, flush: true);

    await RecentFilesService.addFile(
      ProcessedFile(
        id: const Uuid().v4(),
        name: p.basename(filePath),
        path: filePath,
        sizeInBytes: bytes.length,
        createdAt: DateTime.now(),
        toolUsed: _currentMode == 'markdown' ? 'Markdown AI' : 'Rangkuman AI',
      ),
    );

    if (exportPicker && mounted) {
      await FileHelper.saveToLocalDevice(context, sourcePath: filePath, preferredName: p.basename(filePath));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${p.basename(filePath)} disimpan ke tab Dokumen!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = AppColors.mutedOf(context);
    final pen = AppColors.penOf(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analisis & Rangkuman AI', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Icon(_hasApiKey ? Icons.key_rounded : Icons.key_off_rounded),
            tooltip: 'Kunci API Gemini (Opsional)',
            onPressed: _showApiKeyDialog,
          ),
        ],
      ),
      body: _selectedFile == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: pen.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.auto_awesome_rounded, size: 64, color: pen),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Pilih Dokumen untuk Dianalisis',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Mendukung PDF (otomatis OCR offline bila scan), Word (.docx), Excel (.xlsx), CSV, TXT, Markdown, dan Foto JPG/PNG.',
                      style: TextStyle(fontSize: 14, color: muted),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton.icon(
                      onPressed: _pickFile,
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Pilih Berkas Dokumen'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: AppColors.surfaceOf(context),
                  child: Row(
                    children: [
                      Icon(Icons.description_rounded, color: pen),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p.basename(_selectedFile!.path),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            Text(
                              '${FileHelper.formatBytes(_selectedFile!.lengthSync())} • ${_extractedText.length} karakter${_usedOfflineOcr ? ' (via OCR offline)' : ''}',
                              style: TextStyle(fontSize: 11, color: muted),
                            ),
                          ],
                        ),
                      ),
                      TextButton(onPressed: _pickFile, child: const Text('Ganti')),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                  child: Row(
                    children: [
                      _buildModeChip('summarize', 'Ringkasan', Icons.summarize_rounded),
                      const SizedBox(width: 8),
                      _buildModeChip('translate', 'Terjemahkan', Icons.translate_rounded),
                      const SizedBox(width: 8),
                      _buildModeChip('markdown', 'Markdown', Icons.code_rounded),
                    ],
                  ),
                ),
                if (_currentMode == 'translate')
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    child: DropdownButtonFormField<String>(
                      initialValue: _targetLanguage,
                      decoration: InputDecoration(
                        labelText: 'Bahasa Tujuan',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      items: ['Bahasa Indonesia', 'English', 'Español', 'Français', 'Deutsch', '日本語', 'العربية']
                          .map((lang) => DropdownMenuItem(value: lang, child: Text(lang)))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _targetLanguage = val);
                      },
                    ),
                  ),
                if (_hasApiKey)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                    child: CheckboxListTile(
                      value: _externalConsent,
                      onChanged: (v) => setState(() => _externalConsent = v ?? false),
                      dense: true,
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      title: const Text(
                        'Saya setuju mengirim teks dokumen ini ke layanan eksternal Google Gemini API untuk dianalisis.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceOf(context),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.lineOf(context)),
                    ),
                    child: _aiResult.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.auto_awesome_outlined, size: 46, color: muted),
                                const SizedBox(height: 12),
                                Text(
                                  _hasApiKey && _externalConsent
                                      ? 'Siap diproses via Google Gemini API (dengan izin Anda).'
                                      : 'Siap dianalisis 100% lokal di HP tanpa mengirim teks keluar.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: muted, fontSize: 13),
                                ),
                                const SizedBox(height: 16),
                                Wrap(
                                  spacing: 10,
                                  runSpacing: 8,
                                  alignment: WrapAlignment.center,
                                  children: [
                                    ElevatedButton.icon(
                                      onPressed: _runOffline,
                                      icon: const Icon(Icons.shield_outlined),
                                      label: const Text('Analisis Lokal (Offline)'),
                                    ),
                                    if (_hasApiKey)
                                      OutlinedButton.icon(
                                        onPressed: _runAi,
                                        icon: const Icon(Icons.cloud_upload_outlined),
                                        label: const Text('Proses via Gemini'),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          )
                        : SingleChildScrollView(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: (_lastResultWasExternal ? pen : AppColors.optimizeGreen).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    _lastResultWasExternal
                                        ? 'Diproses melalui Google Gemini API atas persetujuan Anda.'
                                        : 'Diproses 100% lokal di perangkat ini — isi dokumen tidak dikirim keluar.',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: _lastResultWasExternal ? pen : AppColors.optimizeGreen,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Hasil Analisis', style: TextStyle(fontWeight: FontWeight.bold)),
                                    Row(
                                      children: [
                                        IconButton(
                                          icon: Icon(Icons.save_alt_rounded, size: 20, color: pen),
                                          tooltip: 'Simpan ke Dokumen',
                                          onPressed: () => _saveToVaultAndDevice(exportPicker: false),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.file_download_rounded, size: 20),
                                          tooltip: 'Ekspor File',
                                          onPressed: () => _saveToVaultAndDevice(exportPicker: true),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.copy_rounded, size: 20),
                                          tooltip: 'Salin Teks',
                                          onPressed: () {
                                            Clipboard.setData(ClipboardData(text: _aiResult));
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(content: Text('Hasil disalin ke papan klip!')),
                                            );
                                          },
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const Divider(),
                                SelectableText(
                                  _aiResult,
                                  style: const TextStyle(fontSize: 14, height: 1.6),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    TextButton.icon(
                                      onPressed: _runOffline,
                                      icon: const Icon(Icons.refresh_rounded, size: 16),
                                      label: const Text('Ulangi Lokal'),
                                    ),
                                    if (_hasApiKey && _externalConsent)
                                      TextButton.icon(
                                        onPressed: _runAi,
                                        icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                                        label: const Text('Ulangi Gemini'),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildModeChip(String mode, String label, IconData icon) {
    final isSelected = _currentMode == mode;
    final pen = AppColors.penOf(context);
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _currentMode = mode),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primaryBlue : AppColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? AppColors.primaryBlue : AppColors.lineOf(context),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: isSelected ? Colors.white : pen),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : AppColors.inkOf(context),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
