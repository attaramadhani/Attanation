import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pengelola preferensi aplikasi global (Tema Terang/Gelap/Sistem, Bahasa ID/EN,
/// Kunci Aplikasi global) agar konsisten di seluruh layar APK & selaras dengan PWA.
class AppPreferences extends ChangeNotifier {
  AppPreferences._();

  static final AppPreferences instance = AppPreferences._();

  static const String _prefTheme = 'atta_theme_mode';
  static const String _prefLang = 'atta_lang';
  static const String _prefGlobalLock = 'atta_global_app_lock';

  ThemeMode _themeMode = ThemeMode.system;
  String _lang = 'id';
  bool _globalLockEnabled = false;
  bool _loaded = false;

  /// Penahan sementara agar membuka kamera / pemilih berkas tidak memicu kunci ulang saat kembali ke aplikasi.
  int _externalActivityDepth = 0;
  bool get isExternalActivityActive => _externalActivityDepth > 0;

  ThemeMode get themeMode => _themeMode;
  String get lang => _lang;
  bool get isEnglish => _lang == 'en';
  bool get globalLockEnabled => _globalLockEnabled;
  bool get isLoaded => _loaded;

  String tr(String idText, String enText) => _lang == 'en' ? enText : idText;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final themeStr = prefs.getString(_prefTheme) ?? 'system';
      _themeMode = switch (themeStr) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
      _lang = (prefs.getString(_prefLang) ?? 'id') == 'en' ? 'en' : 'id';
      _globalLockEnabled = prefs.getBool(_prefGlobalLock) ?? false;
    } catch (_) {
      // Gunakan bawaan jika SharedPreferences belum siap (mis. di widget test)
    } finally {
      _loaded = true;
      notifyListeners();
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      final val = switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };
      await prefs.setString(_prefTheme, val);
    } catch (_) {}
  }

  Future<void> setLanguage(String langCode) async {
    _lang = langCode == 'en' ? 'en' : 'id';
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefLang, _lang);
    } catch (_) {}
  }

  Future<void> setGlobalLockEnabled(bool enabled) async {
    _globalLockEnabled = enabled;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefGlobalLock, enabled);
    } catch (_) {}
  }

  Future<T> runExternal<T>(Future<T> Function() action) async {
    _externalActivityDepth++;
    try {
      return await action();
    } finally {
      if (_externalActivityDepth > 0) _externalActivityDepth--;
    }
  }
}
