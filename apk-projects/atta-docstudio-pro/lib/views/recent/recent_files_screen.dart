import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/services/app_preferences.dart';
import '../../core/services/recent_files_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/file_helper.dart';
import '../../models/processed_file.dart';
import '../tools/ai_intelligence_screen.dart';
import '../viewer/pdf_viewer_screen.dart';

class RecentFilesScreen extends StatefulWidget {
  final VoidCallback? onGoToTools;

  const RecentFilesScreen({super.key, this.onGoToTools});

  @override
  RecentFilesScreenState createState() => RecentFilesScreenState();
}

class RecentFilesScreenState extends State<RecentFilesScreen> {
  List<ProcessedFile> _files = [];
  bool _isLoading = true;
  String _searchQuery = '';
  String _selectedFilter = 'Semua'; // 'Semua', 'PDF', 'Gambar', 'Lainnya'
  Timer? _pendingDeleteTimer;
  ProcessedFile? _pendingDeleteFile;

  @override
  void initState() {
    super.initState();
    loadFiles();
  }

  @override
  void dispose() {
    _commitPendingDelete();
    super.dispose();
  }

  Future<void> _commitPendingDelete() async {
    _pendingDeleteTimer?.cancel();
    _pendingDeleteTimer = null;
    final pending = _pendingDeleteFile;
    _pendingDeleteFile = null;
    if (pending != null && File(pending.path).existsSync()) {
      try {
        File(pending.path).deleteSync();
      } catch (_) {}
    }
  }

  Future<void> loadFiles() async {
    if (mounted) setState(() => _isLoading = true);
    final files = await RecentFilesService.getRecentFiles();
    if (mounted) {
      setState(() {
        _files = files;
        _isLoading = false;
      });
    }
  }

  List<ProcessedFile> get _filteredFiles {
    return _files.where((f) {
      final matchesSearch = _searchQuery.isEmpty ||
          f.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          f.toolUsed.toLowerCase().contains(_searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      final lower = f.path.toLowerCase();
      final isPdf = lower.endsWith('.pdf');
      final isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');

      if (_selectedFilter == 'PDF') return isPdf;
      if (_selectedFilter == 'Gambar') return isImage;
      if (_selectedFilter == 'Lainnya') return !isPdf && !isImage;
      return true;
    }).toList();
  }

  Future<void> _openFile(ProcessedFile file) async {
    final lower = file.path.toLowerCase();
    if (lower.endsWith('.pdf')) {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (ctx) => PdfViewerScreen(filePath: file.path, title: file.name),
        ),
      );
      return;
    }

    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (ctx) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(file.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold)),
                    ),
                    IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
              ),
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.file(File(file.path), fit: BoxFit.contain),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        FileHelper.saveToLocalDevice(context, sourcePath: file.path, preferredName: file.name);
                      },
                      icon: const Icon(Icons.file_download_rounded, size: 18),
                      label: Text(AppPreferences.instance.tr('Simpan', 'Save')),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: file.name));
                      },
                      icon: const Icon(Icons.share_rounded, size: 18),
                      label: Text(AppPreferences.instance.tr('Bagikan', 'Share')),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
      return;
    }

    if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) {
      final text = await File(file.path).readAsString();
      if (!mounted) return;
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
        builder: (ctx) => DraggableScrollableSheet(
          initialChildSize: 0.72,
          maxChildSize: 0.92,
          minChildSize: 0.4,
          expand: false,
          builder: (_, scrollCtrl) => Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(file.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const Divider(),
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollCtrl,
                    child: SelectableText(text, style: const TextStyle(fontSize: 13.5, height: 1.5)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      return;
    }

    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: 'Dokumen: ${file.name}'),
    );
  }

  Future<void> _renameFile(ProcessedFile file) async {
    final controller = TextEditingController(
      text: file.name.replaceFirst(RegExp(r'\.[^.]+$'), ''),
    );
    final prefs = AppPreferences.instance;
    final newName = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(prefs.tr('Ganti Nama Berkas', 'Rename File')),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            labelText: prefs.tr('Nama baru', 'New name'),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          onSubmitted: (val) => Navigator.pop(ctx, val),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(prefs.tr('Batal', 'Cancel'))),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(prefs.tr('Simpan', 'Save')),
          ),
        ],
      ),
    );
    if (newName == null || newName.trim().isEmpty) return;
    await RecentFilesService.renameFile(file.id, newName.trim());
    await loadFiles();
  }

  Future<void> _deleteWithUndo(ProcessedFile file) async {
    // Pastikan penghapusan tertunda sebelumnya diselesaikan terlebih dahulu
    await _commitPendingDelete();

    await RecentFilesService.removeFile(file.id);
    _pendingDeleteFile = file;
    await loadFiles();

    _pendingDeleteTimer = Timer(const Duration(seconds: 5), () {
      _commitPendingDelete();
    });

    if (!mounted) return;
    final prefs = AppPreferences.instance;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 5),
        content: Text(prefs.tr('"${file.name}" dihapus.', '"${file.name}" deleted.')),
        action: SnackBarAction(
          label: prefs.tr('Urungkan', 'Undo'),
          onPressed: () async {
            _pendingDeleteTimer?.cancel();
            _pendingDeleteTimer = null;
            final restored = _pendingDeleteFile;
            _pendingDeleteFile = null;
            if (restored != null && File(restored.path).existsSync()) {
              await RecentFilesService.addFile(restored);
              await loadFiles();
            }
          },
        ),
      ),
    );
  }

  void _showFileActionsSheet(ProcessedFile file) {
    final prefs = AppPreferences.instance;
    final lower = file.path.toLowerCase();
    final canAnalyze = lower.endsWith('.pdf') ||
        lower.endsWith('.docx') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.csv') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.md') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png');

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(file.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${file.toolUsed} • ${FileHelper.formatBytes(file.sizeInBytes)}'),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.visibility_outlined),
              title: Text(prefs.tr('Buka / Pratinjau', 'Open / Preview')),
              onTap: () {
                Navigator.pop(ctx);
                _openFile(file);
              },
            ),
            if (canAnalyze)
              ListTile(
                leading: Icon(Icons.auto_awesome_outlined, color: AppColors.penOf(context)),
                title: Text(prefs.tr('Analisis & Rangkum AI', 'AI Summary & Analysis')),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => AiIntelligenceScreen(initialFile: File(file.path)),
                    ),
                  );
                },
              ),
            ListTile(
              leading: Icon(Icons.file_download_outlined, color: AppColors.penOf(context)),
              title: Text(prefs.tr('Simpan ke Download / Files', 'Save to Local Files')),
              onTap: () {
                Navigator.pop(ctx);
                FileHelper.saveToLocalDevice(context, sourcePath: file.path, preferredName: file.name);
              },
            ),
            ListTile(
              leading: const Icon(Icons.share_outlined),
              title: Text(prefs.tr('Bagikan', 'Share')),
              onTap: () {
                Navigator.pop(ctx);
                SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: file.name));
              },
            ),
            ListTile(
              leading: const Icon(Icons.drive_file_rename_outline_rounded),
              title: Text(prefs.tr('Ganti nama', 'Rename')),
              onTap: () {
                Navigator.pop(ctx);
                _renameFile(file);
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.delete_outline_rounded, color: AppColors.dangerOf(context)),
              title: Text(prefs.tr('Hapus', 'Delete'), style: TextStyle(color: AppColors.dangerOf(context))),
              onTap: () {
                Navigator.pop(ctx);
                _deleteWithUndo(file);
              },
            ),
          ],
        ),
      ),
    );
  }

  IconData _getFileIcon(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.pdf')) return Icons.picture_as_pdf_rounded;
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return Icons.image_rounded;
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return Icons.description_rounded;
    if (lower.endsWith('.csv') || lower.endsWith('.xls') || lower.endsWith('.xlsx')) return Icons.table_chart_rounded;
    return Icons.insert_drive_file_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredFiles;
    final prefs = AppPreferences.instance;
    final pen = AppColors.penOf(context);
    final muted = AppColors.mutedOf(context);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Text(prefs.tr('Dokumen', 'Documents'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
            if (_files.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: pen.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_files.length}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: pen),
                ),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: prefs.tr('Segarkan', 'Refresh'),
            onPressed: loadFiles,
          ),
          if (_files.isNotEmpty)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded),
              onSelected: (val) async {
                if (val == 'clear') {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      title: Text(prefs.tr('Bersihkan Daftar Riwayat?', 'Clear Document List?')),
                      content: Text(
                        prefs.tr(
                          'Semua daftar riwayat akan dibersihkan dari aplikasi. Berkas yang sudah Anda ekspor ke folder Download tidak hilang.',
                          'All document entries will be cleared from the app list. Files already exported to Downloads will remain.',
                        ),
                      ),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(prefs.tr('Batal', 'Cancel'))),
                        ElevatedButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
                          child: Text(prefs.tr('Bersihkan', 'Clear')),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true) {
                    await _commitPendingDelete();
                    await RecentFilesService.clearAll();
                    loadFiles();
                  }
                }
              },
              itemBuilder: (ctx) => [
                PopupMenuItem(
                  value: 'clear',
                  child: Row(
                    children: [
                      Icon(Icons.delete_sweep_rounded, color: AppColors.dangerOf(context), size: 20),
                      const SizedBox(width: 10),
                      Text(prefs.tr('Bersihkan Riwayat', 'Clear History'), style: TextStyle(color: AppColors.dangerOf(context))),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadFiles,
        color: pen,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: TextField(
                onChanged: (val) => setState(() => _searchQuery = val),
                decoration: InputDecoration(
                  hintText: prefs.tr('Cari nama berkas atau alat...', 'Search files or tool...'),
                  prefixIcon: Icon(Icons.search_rounded, color: muted),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear_rounded, size: 18), onPressed: () => setState(() => _searchQuery = ''))
                      : null,
                  filled: true,
                  fillColor: AppColors.surfaceOf(context),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.lineOf(context))),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.lineOf(context))),
                ),
              ),
            ),
            if (_files.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _buildFilterChip('Semua', prefs.tr('Semua', 'All'), _files.length),
                      const SizedBox(width: 8),
                      _buildFilterChip('PDF', 'PDF', _files.where((f) => f.path.toLowerCase().endsWith('.pdf')).length),
                      const SizedBox(width: 8),
                      _buildFilterChip(
                        'Gambar',
                        prefs.tr('Gambar', 'Images'),
                        _files.where((f) {
                          final l = f.path.toLowerCase();
                          return l.endsWith('.png') || l.endsWith('.jpg') || l.endsWith('.jpeg');
                        }).length,
                      ),
                      const SizedBox(width: 8),
                      _buildFilterChip(
                        'Lainnya',
                        prefs.tr('Lainnya', 'Other'),
                        _files.where((f) {
                          final l = f.path.toLowerCase();
                          return !l.endsWith('.pdf') && !l.endsWith('.png') && !l.endsWith('.jpg') && !l.endsWith('.jpeg');
                        }).length,
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: _isLoading
                  ? Center(child: CircularProgressIndicator(color: pen))
                  : filtered.isEmpty
                      ? _buildEmptyState()
                      : ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) => _buildFileItemCard(filtered[index]),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String value, String label, int count) {
    final isSelected = _selectedFilter == value;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = value),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryBlue : AppColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppColors.primaryBlue : AppColors.lineOf(context)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$label ($count)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : AppColors.inkOf(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileItemCard(ProcessedFile file) {
    final icon = _getFileIcon(file.path);
    final pen = AppColors.penOf(context);
    final muted = AppColors.mutedOf(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => _openFile(file),
        onLongPress: () => _showFileActionsSheet(file),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: pen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: pen, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      file.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${file.toolUsed} • ${FileHelper.formatBytes(file.sizeInBytes)} • ${FileHelper.formatDate(file.createdAt)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11.5, color: muted),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.more_horiz_rounded, color: muted),
                tooltip: AppPreferences.instance.tr('Menu Dokumen', 'File Actions'),
                onPressed: () => _showFileActionsSheet(file),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final prefs = AppPreferences.instance;
    final pen = AppColors.penOf(context);
    final muted = AppColors.mutedOf(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.12),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: pen.withValues(alpha: 0.1), shape: BoxShape.circle),
                  child: Icon(Icons.folder_open_rounded, size: 56, color: pen),
                ),
                const SizedBox(height: 20),
                Text(
                  prefs.tr('Belum ada dokumen', 'No documents yet'),
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  prefs.tr(
                    'Hasil pindaian, PDF yang diproses, dan rangkuman tersimpan lokal di sini.',
                    'Scanned documents, processed PDFs, and AI summaries are stored locally here.',
                  ),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: muted, height: 1.4),
                ),
                const SizedBox(height: 24),
                if (widget.onGoToTools != null)
                  ElevatedButton.icon(
                    onPressed: widget.onGoToTools,
                    icon: const Icon(Icons.grid_view_rounded, size: 18),
                    label: Text(prefs.tr('Buka Alat PDF', 'Open PDF Tools')),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
