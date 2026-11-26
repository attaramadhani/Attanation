import 'dart:convert';
import 'dart:io';
import 'package:archive/archive.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/processed_file.dart';
import '../../scanner_suite/models/scanned_document.dart';
import '../../scanner_suite/services/document_service.dart';
import '../utils/file_helper.dart';
import 'recent_files_service.dart';

class BackupExportResult {
  final String zipPath;
  final String zipName;
  final int totalFiles;
  final int sizeBytes;

  const BackupExportResult({
    required this.zipPath,
    required this.zipName,
    required this.totalFiles,
    required this.sizeBytes,
  });
}

class BackupImportResult {
  final int restoredCount;
  final String? exportedAt;

  const BackupImportResult({
    required this.restoredCount,
    this.exportedAt,
  });
}

/// Layanan Cadangan & Pemulihan Arsip .ZIP penuh (port dari PWA AttaStorage.exportFullBackupZip).
/// Menyertakan seluruh dokumen hasil alat PDF + proyek Scanner OpenCV + preferensi non-rahasia,
/// dan secara ketat mengecualikan API key serta kunci privat dari manifest ZIP.
class BackupService {
  static const String _prefLastBackup = 'last_backup_at';
  static const Set<String> _excludedPrefs = {
    'gemini_api_key',
    'atta_license_key',
    'atta_customer_email',
    'atta_global_app_lock',
    'biometric_lock',
  };

  static Future<String?> getLastBackupAt() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefLastBackup);
  }

  static Future<({int fileCount, int totalBytes})> getStorageSummary() async {
    final recents = await RecentFilesService.getRecentFiles();
    final scans = await DocumentService.loadHistory();
    int totalBytes = 0;
    for (final f in recents) {
      totalBytes += f.sizeInBytes;
    }
    for (final s in scans) {
      totalBytes += s.fileSize;
    }
    return (fileCount: recents.length + scans.length, totalBytes: totalBytes);
  }

  static Future<BackupExportResult> exportFullBackupZip() async {
    final archive = Archive();
    final recents = await RecentFilesService.getRecentFiles();
    final scans = await DocumentService.loadHistory();
    final prefs = await SharedPreferences.getInstance();

    final recentMeta = <Map<String, dynamic>>[];
    int exportedCount = 0;

    for (final item in recents) {
      final f = File(item.path);
      if (!await f.exists()) continue;
      final safeName = '${item.id}_${item.name.replaceAll(RegExp(r'[^a-zA-Z0-9_\-.]'), '_')}';
      final archivePath = 'files/$safeName';
      final bytes = await f.readAsBytes();
      archive.addFile(ArchiveFile(archivePath, bytes.length, bytes));
      recentMeta.add({
        ...item.toJson(),
        'archivePath': archivePath,
      });
      exportedCount++;
    }

    final scansMeta = <Map<String, dynamic>>[];
    for (final doc in scans) {
      final rawEntries = <String>[];
      final dispEntries = <String>[];
      for (int i = 0; i < doc.filePaths.length; i++) {
        final rawFile = File(doc.filePaths[i]);
        if (await rawFile.exists()) {
          final entryPath = 'scans/${doc.id}/raw_$i.jpg';
          final rawBytes = await rawFile.readAsBytes();
          archive.addFile(ArchiveFile(entryPath, rawBytes.length, rawBytes));
          rawEntries.add(entryPath);
        } else {
          rawEntries.add('');
        }

        final dispPath = doc.displayPathAt(i);
        final dispFile = File(dispPath);
        if (dispPath != doc.filePaths[i] && await dispFile.exists()) {
          final entryPath = 'scans/${doc.id}/display_$i.jpg';
          final dispBytes = await dispFile.readAsBytes();
          archive.addFile(ArchiveFile(entryPath, dispBytes.length, dispBytes));
          dispEntries.add(entryPath);
        } else {
          dispEntries.add('');
        }
      }
      scansMeta.add({
        ...doc.toJson(),
        'rawArchivePaths': rawEntries,
        'displayArchivePaths': dispEntries,
      });
      exportedCount++;
    }

    final safePrefs = <String, dynamic>{};
    for (final key in prefs.getKeys()) {
      if (_excludedPrefs.contains(key)) continue;
      if (key == 'recent_processed_files' || key == 'scanned_documents_history_projects_v2') continue;
      final val = prefs.get(key);
      if (val is String || val is bool || val is int || val is double) {
        safePrefs[key] = val;
      }
    }

    final nowIso = DateTime.now().toIso8601String();
    final manifest = {
      'app': 'ATTA DocStudio Pro APK',
      'studio': 'ATTA NATION — Independent Technology Product Studio',
      'backupVersion': '3.0.0',
      'exportedAt': nowIso,
      'totalFiles': exportedCount,
      'settings': safePrefs,
      'recentFiles': recentMeta,
      'scannedDocuments': scansMeta,
    };

    final manifestBytes = utf8.encode(const JsonEncoder.withIndent('  ').convert(manifest));
    archive.addFile(ArchiveFile('atta-backup-manifest.json', manifestBytes.length, manifestBytes));

    final zipBytes = ZipEncoder().encode(archive);
    if (zipBytes == null) {
      throw Exception('Gagal mengemas arsip cadangan ZIP.');
    }

    final stamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final zipName = 'ATTA_DocStudio_Backup_$stamp.zip';
    final outDir = await getTemporaryDirectory();
    final outPath = p.join(outDir.path, zipName);
    await File(outPath).writeAsBytes(zipBytes, flush: true);
    await prefs.setString(_prefLastBackup, nowIso);

    return BackupExportResult(
      zipPath: outPath,
      zipName: zipName,
      totalFiles: exportedCount,
      sizeBytes: zipBytes.length,
    );
  }

  static Future<BackupImportResult> importBackupZip(File zipFile) async {
    final bytes = await zipFile.readAsBytes();
    final archive = ZipDecoder().decodeBytes(bytes);
    final manifestEntry = archive.findFile('atta-backup-manifest.json');
    if (manifestEntry == null) {
      throw Exception('File ZIP bukan arsip backup resmi ATTA DocStudio Pro.');
    }

    final manifestText = utf8.decode(manifestEntry.content, allowMalformed: true);
    final manifest = jsonDecode(manifestText) as Map<String, dynamic>;

    final prefs = await SharedPreferences.getInstance();
    int restored = 0;

    // 1. Pulihkan berkas dari menu Alat PDF / Dokumen
    final recentRaw = manifest['recentFiles'];
    if (recentRaw is List) {
      final existing = await RecentFilesService.getRecentFiles();
      final existingIds = existing.map((e) => e.id).toSet();
      final outDirPath = await FileHelper.getAppOutputDirectory();

      for (final item in recentRaw) {
        if (item is! Map<String, dynamic>) continue;
        final id = (item['id'] ?? '').toString();
        final archivePath = (item['archivePath'] ?? '').toString();
        if (id.isEmpty || archivePath.isEmpty || existingIds.contains(id)) continue;

        final entry = archive.findFile(archivePath);
        if (entry == null) continue;

        final name = (item['name'] ?? p.basename(archivePath)).toString();
        var dest = File(p.join(outDirPath, name));
        var n = 2;
        while (await dest.exists()) {
          dest = File(p.join(outDirPath, '${p.basenameWithoutExtension(name)}_$n${p.extension(name)}'));
          n++;
        }
        await dest.writeAsBytes(entry.content, flush: true);

        await RecentFilesService.addFile(
          ProcessedFile(
            id: id,
            name: p.basename(dest.path),
            path: dest.path,
            sizeInBytes: entry.content.length,
            createdAt: DateTime.tryParse((item['createdAt'] ?? '').toString()) ?? DateTime.now(),
            toolUsed: (item['toolUsed'] ?? 'Pulihan ZIP').toString(),
          ),
        );
        existingIds.add(id);
        restored++;
      }
    }

    // 2. Pulihkan proyek Scanner OpenCV
    final scansRaw = manifest['scannedDocuments'];
    if (scansRaw is List) {
      final existingScans = await DocumentService.loadHistory();
      final existingScanIds = existingScans.map((e) => e.id).toSet();
      final baseDocs = await getApplicationDocumentsDirectory();
      final rawDir = await Directory(p.join(baseDocs.path, 'scans', 'raw')).create(recursive: true);
      final dispDir = await Directory(p.join(baseDocs.path, 'scans', 'display')).create(recursive: true);

      for (final rawDoc in scansRaw) {
        if (rawDoc is! Map<String, dynamic>) continue;
        final id = (rawDoc['id'] ?? '').toString();
        if (id.isEmpty || existingScanIds.contains(id)) continue;

        final rawArchives = List<String>.from((rawDoc['rawArchivePaths'] as List?) ?? const []);
        final dispArchives = List<String>.from((rawDoc['displayArchivePaths'] as List?) ?? const []);
        final restoredRaws = <String>[];
        final restoredDisps = <String>[];

        for (int i = 0; i < rawArchives.length; i++) {
          final rawEntryPath = rawArchives[i];
          if (rawEntryPath.isEmpty) continue;
          final rawEntry = archive.findFile(rawEntryPath);
          if (rawEntry == null) continue;

          final ts = DateTime.now().microsecondsSinceEpoch + i;
          final localRawPath = p.join(rawDir.path, 'raw_${ts}_$i.jpg');
          await File(localRawPath).writeAsBytes(rawEntry.content, flush: true);
          restoredRaws.add(localRawPath);

          String localDispPath = localRawPath;
          if (i < dispArchives.length && dispArchives[i].isNotEmpty) {
            final dispEntry = archive.findFile(dispArchives[i]);
            if (dispEntry != null) {
              localDispPath = p.join(dispDir.path, 'display_${ts}_$i.jpg');
              await File(localDispPath).writeAsBytes(dispEntry.content, flush: true);
            }
          }
          restoredDisps.add(localDispPath);
        }

        if (restoredRaws.isNotEmpty) {
          final parsedDoc = ScannedDocument.fromJson(rawDoc).copyWith(
            filePaths: restoredRaws,
            displayFilePaths: restoredDisps,
          );
          await DocumentService.updateProject(parsedDoc);
          existingScanIds.add(id);
          restored++;
        }
      }
    }

    // 3. Pulihkan preferensi aman (opsional)
    final settingsRaw = manifest['settings'];
    if (settingsRaw is Map<String, dynamic>) {
      for (final entry in settingsRaw.entries) {
        if (_excludedPrefs.contains(entry.key)) continue;
        final v = entry.value;
        if (v is String) await prefs.setString(entry.key, v);
        if (v is bool) await prefs.setBool(entry.key, v);
        if (v is int) await prefs.setInt(entry.key, v);
        if (v is double) await prefs.setDouble(entry.key, v);
      }
    }

    return BackupImportResult(
      restoredCount: restored,
      exportedAt: manifest['exportedAt']?.toString(),
    );
  }
}
