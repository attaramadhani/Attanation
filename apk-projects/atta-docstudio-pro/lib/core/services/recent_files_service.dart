import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/processed_file.dart';

class RecentFilesService {
  static const String _key = 'recent_processed_files';

  static Future<List<ProcessedFile>> getRecentFiles() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];
    final List<ProcessedFile> files = [];

    for (final str in jsonList) {
      try {
        final item = ProcessedFile.fromJson(jsonDecode(str));
        if (File(item.path).existsSync()) {
          files.add(item);
        }
      } catch (_) {}
    }
    files.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return files;
  }

  static Future<void> addFile(ProcessedFile file) async {
    final prefs = await SharedPreferences.getInstance();
    final List<ProcessedFile> current = await getRecentFiles();
    current.removeWhere((item) => item.path == file.path || item.id == file.id);
    current.insert(0, file);

    final strList = current.map((item) => jsonEncode(item.toJson())).toList();
    await prefs.setStringList(_key, strList);
  }

  static Future<ProcessedFile?> renameFile(String id, String rawNewName) async {
    final prefs = await SharedPreferences.getInstance();
    final List<ProcessedFile> current = await getRecentFiles();
    final idx = current.indexWhere((item) => item.id == id);
    if (idx == -1) return null;

    final item = current[idx];
    final cleanBase = rawNewName.trim().replaceAll(RegExp(r'[\\/:*?"<>|]+'), '_');
    if (cleanBase.isEmpty) return null;

    final origExt = p.extension(item.name);
    final newName = (origExt.isNotEmpty && !cleanBase.toLowerCase().endsWith(origExt.toLowerCase()))
        ? '$cleanBase$origExt'
        : cleanBase;

    var newPath = item.path;
    final oldFile = File(item.path);
    if (await oldFile.exists()) {
      final dir = p.dirname(item.path);
      var target = p.join(dir, newName);
      if (target != item.path) {
        final stem = p.basenameWithoutExtension(newName);
        final ext = p.extension(newName);
        var n = 2;
        while (await File(target).exists()) {
          target = p.join(dir, '${stem}_$n$ext');
          n++;
        }
        final renamed = await oldFile.rename(target);
        newPath = renamed.path;
      }
    }

    final updated = ProcessedFile(
      id: item.id,
      name: p.basename(newPath),
      path: newPath,
      sizeInBytes: await File(newPath).exists() ? await File(newPath).length() : item.sizeInBytes,
      createdAt: item.createdAt,
      toolUsed: item.toolUsed,
    );
    current[idx] = updated;
    await prefs.setStringList(_key, current.map((e) => jsonEncode(e.toJson())).toList());
    return updated;
  }

  static Future<void> removeFile(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final List<ProcessedFile> current = await getRecentFiles();
    current.removeWhere((item) => item.id == id);
    final strList = current.map((item) => jsonEncode(item.toJson())).toList();
    await prefs.setStringList(_key, strList);
  }

  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
