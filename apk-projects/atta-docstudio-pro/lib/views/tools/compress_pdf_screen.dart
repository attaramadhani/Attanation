import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../../core/services/app_preferences.dart';
import '../../core/services/pdf_engine_service.dart';
import '../../core/services/raster_pdf_service.dart';
import '../../core/services/recent_files_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/file_helper.dart';
import '../../models/processed_file.dart';
import '../../widgets/processing_dialog.dart';
import '../viewer/pdf_viewer_screen.dart';

class CompressPdfScreen extends StatefulWidget {
  const CompressPdfScreen({super.key});

  @override
  State<CompressPdfScreen> createState() => _CompressPdfScreenState();
}

class _CompressPdfScreenState extends State<CompressPdfScreen> {
  File? _selectedFile;
  // 0: Ringan, 1: Rekomendasi (144 DPI), 2: Ekstrem (96 DPI),
  // 200: Target Maks 200 KB, 500: Target Maks 500 KB, 1024: Target Maks 1 MB
  int _compressionLevel = 1;

  Future<void> _pickFile() async {
    final files = await AppPreferences.instance.runExternal(
      () => FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      ),
    );
    if (!mounted) return;

    if (files.isNotEmpty && files.first.path != null) {
      setState(() {
        _selectedFile = File(files.first.path!);
      });
    }
  }

  Future<void> _compressPdf() async {
    if (_selectedFile == null) return;

    ProcessingDialog.show(
      context,
      title: 'Mengompres PDF',
      message: _compressionLevel >= 200
          ? 'Menyesuaikan ukuran berkas agar di bawah ${_compressionLevel >= 1024 ? '1 MB' : '$_compressionLevel KB'}...'
          : 'Mengoptimalkan stream data dan memperkecil ukuran berkas...',
    );

    try {
      final originalSize = _selectedFile!.lengthSync();

      // Tahap 1: optimasi lossless (teks tetap bisa dipilih/dicari).
      String bestPath = await PdfEngineService.optimizePdf(_selectedFile!);
      int bestSize = File(bestPath).lengthSync();
      bool targetMet = true;
      int? targetBytes;

      if (_compressionLevel >= 200) {
        // Target KB ketat (port terbaik dari PWA ATTA DocStudio Pro)
        targetBytes = _compressionLevel * 1024;
        if (bestSize > targetBytes) {
          const steps = <(double dpi, int quality)>[
            (144, 76),
            (120, 65),
            (104, 55),
            (90, 46),
            (76, 38),
            (64, 30),
          ];
          for (int s = 0; s < steps.length; s++) {
            final (dpi, quality) = steps[s];
            ProcessingDialog.updateProgress(
              'Uji tahap ${s + 1}/${steps.length} (${dpi.toInt()} DPI)...',
            );
            try {
              final rasterPath = await RasterPdfService.rasterizePdf(
                _selectedFile!,
                prefix: 'Compressed',
                dpi: dpi,
                jpegQuality: quality,
              );
              final rasterSize = File(rasterPath).lengthSync();
              if (rasterSize < bestSize) {
                await File(bestPath).delete();
                bestPath = rasterPath;
                bestSize = rasterSize;
              } else {
                await File(rasterPath).delete();
              }
              if (bestSize <= targetBytes) break;
            } catch (_) {
              // Lanjut ke langkah berikutnya bila tahap ini gagal
            }
          }
        }
        targetMet = bestSize <= targetBytes;
      } else if (_compressionLevel > 0) {
        // Preset Rekomendasi (144 DPI) / Ekstrem (96 DPI)
        final double dpi = _compressionLevel == 2 ? 96 : 144;
        final int quality = _compressionLevel == 2 ? 50 : 72;
        try {
          final rasterPath = await RasterPdfService.rasterizePdf(
            _selectedFile!,
            prefix: 'Compressed',
            dpi: dpi,
            jpegQuality: quality,
            onProgress: (done, total) => ProcessingDialog.updateProgress('Halaman $done dari $total'),
          );
          final rasterSize = File(rasterPath).lengthSync();
          final threshold = _compressionLevel == 2 ? 1.0 : 0.7;
          if (rasterSize < bestSize * threshold) {
            await File(bestPath).delete();
            bestPath = rasterPath;
            bestSize = rasterSize;
          } else {
            await File(rasterPath).delete();
          }
        } catch (_) {}
      }

      // Jangan pernah memberikan hasil yang lebih besar dari aslinya.
      if (bestSize >= originalSize) {
        await File(bestPath).writeAsBytes(await _selectedFile!.readAsBytes());
        bestSize = originalSize;
      }

      final outputPath = bestPath;
      final outputFile = File(outputPath);
      final newSize = bestSize;

      final processedFile = ProcessedFile(
        id: const Uuid().v4(),
        name: outputFile.uri.pathSegments.last,
        path: outputPath,
        sizeInBytes: newSize,
        createdAt: DateTime.now(),
        toolUsed: _compressionLevel >= 200
            ? 'Kompres Maks ${_compressionLevel >= 1024 ? '1 MB' : '$_compressionLevel KB'}'
            : 'Kompres PDF',
      );

      await RecentFilesService.addFile(processedFile);

      if (mounted) {
        ProcessingDialog.hide(context);
        _showSuccessDialog(
          originalSize,
          newSize,
          outputPath,
          processedFile.name,
          targetBytes: targetBytes,
          targetMet: targetMet,
        );
      }
    } catch (e) {
      if (mounted) {
        ProcessingDialog.hide(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal mengompres PDF: ${PdfEngineService.friendlyError(e)}')),
        );
      }
    }
  }

  void _showSuccessDialog(
    int oldSize,
    int newSize,
    String path,
    String title, {
    int? targetBytes,
    bool targetMet = true,
  }) {
    final reduction = oldSize > 0 ? (((oldSize - newSize) / oldSize) * 100).clamp(0, 99).toInt() : 0;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              targetMet ? Icons.check_circle_rounded : Icons.info_rounded,
              color: targetMet ? AppColors.optimizeGreen : Colors.orange,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(targetMet ? 'Kompresi Selesai' : 'Hasil Terkecil Tersedia'),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.optimizeGreen.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Sebelum:', style: TextStyle(fontSize: 12, color: AppColors.mutedOf(context))),
                      Text(FileHelper.formatBytes(oldSize), style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const Icon(Icons.arrow_forward_rounded, color: AppColors.optimizeGreen),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Sesudah:', style: TextStyle(fontSize: 12, color: AppColors.mutedOf(context))),
                      Text(
                        FileHelper.formatBytes(newSize),
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.optimizeGreen),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              !targetMet && targetBytes != null
                  ? 'Ukuran paling kecil yang bisa dicapai adalah ${FileHelper.formatBytes(newSize)} (masih di atas target ${FileHelper.formatBytes(targetBytes, 0)}). Coba pisahkan halamannya terlebih dahulu.'
                  : reduction > 0
                      ? 'Ukuran berhasil dihemat sebesar $reduction%. Berkas siap digunakan!'
                      : 'Dokumen ini sudah optimal. Coba pilih tingkat "Maksimal" atau batas KB bila diperlukan.',
              style: const TextStyle(fontSize: 13),
            ),
          ],
        ),
        actions: [
          OutlinedButton.icon(
            onPressed: () {
              FileHelper.saveToLocalDevice(context, sourcePath: path, preferredName: title);
            },
            icon: const Icon(Icons.file_download_rounded, size: 18),
            label: const Text('Simpan'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (_) => PdfViewerScreen(filePath: path, title: title),
                ),
              );
            },
            icon: const Icon(Icons.visibility_rounded, size: 18),
            label: const Text('Buka PDF'),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.optimizeGreen),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final muted = AppColors.mutedOf(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kompres & Kecilkan PDF', style: TextStyle(fontWeight: FontWeight.bold)),
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
                        color: AppColors.optimizeGreen.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.compress_rounded, size: 64, color: AppColors.optimizeGreen),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Pilih File PDF untuk Dikompres',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Pilih mode kualitas otomatis atau tentukan batas ukuran tepat (200 KB, 500 KB, 1 MB) untuk syarat unggah portal.',
                      style: TextStyle(fontSize: 14, color: muted),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton.icon(
                      onPressed: _pickFile,
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Pilih Berkas PDF'),
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.optimizeGreen),
                    ),
                  ],
                ),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Card(
                    child: ListTile(
                      leading: Icon(Icons.picture_as_pdf_rounded, color: AppColors.penOf(context), size: 36),
                      title: Text(
                        _selectedFile!.uri.pathSegments.last,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        'Ukuran saat ini: ${FileHelper.formatBytes(_selectedFile!.lengthSync())}',
                        style: TextStyle(color: muted),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.change_circle_outlined),
                        onPressed: _pickFile,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('Target Batas Ukuran (Syarat Unggah)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _buildTargetChip(200, 'Maks 200 KB'),
                      _buildTargetChip(500, 'Maks 500 KB'),
                      _buildTargetChip(1024, 'Maks 1 MB'),
                    ],
                  ),
                  const SizedBox(height: 22),
                  const Text('Atau Pilih Tingkat Kualitas', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  _buildLevelTile(0, 'Kompresi Ringan', 'Optimasi struktur tanpa mengubah isi. Teks tetap bisa dipilih & dicari.'),
                  const SizedBox(height: 10),
                  _buildLevelTile(1, 'Kompresi Rekomendasi (Terbaik)', 'Gambar halaman dikompres 144 DPI. Otomatis memilih hasil terkecil.'),
                  const SizedBox(height: 10),
                  _buildLevelTile(2, 'Kompresi Maksimal (96 DPI)', 'Ukuran sekecil mungkin tanpa target angka pasti.'),
                  const SizedBox(height: 30),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _compressPdf,
                      icon: const Icon(Icons.compress_rounded),
                      label: const Text('Mulai Kompres Dokumen'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.optimizeGreen,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildTargetChip(int kb, String label) {
    final selected = _compressionLevel == kb;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontWeight: selected ? FontWeight.bold : FontWeight.w500,
          color: selected ? Colors.white : AppColors.inkOf(context),
        ),
      ),
      selected: selected,
      selectedColor: AppColors.optimizeGreen,
      backgroundColor: AppColors.surfaceOf(context),
      side: BorderSide(color: selected ? AppColors.optimizeGreen : AppColors.lineOf(context)),
      onSelected: (_) => setState(() => _compressionLevel = kb),
    );
  }

  Widget _buildLevelTile(int level, String title, String subtitle) {
    final isSelected = _compressionLevel == level;
    return InkWell(
      onTap: () => setState(() => _compressionLevel = level),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.optimizeGreen.withValues(alpha: 0.12)
              : AppColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.optimizeGreen : AppColors.lineOf(context),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
              color: isSelected ? AppColors.optimizeGreen : AppColors.mutedOf(context),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: TextStyle(fontSize: 12, color: AppColors.mutedOf(context))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
