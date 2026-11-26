import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import '../core/services/app_preferences.dart';
import '../core/theme/app_colors.dart';
import 'home/home_screen.dart';
import 'recent/recent_files_screen.dart';
import 'scanner/scanner_suite_tab.dart';
import 'settings/settings_screen.dart';

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> with WidgetsBindingObserver {
  int _currentIndex = 0;
  final GlobalKey<RecentFilesScreenState> _recentKey = GlobalKey<RecentFilesScreenState>();
  final LocalAuthentication _auth = LocalAuthentication();

  bool _isLocked = false;
  bool _authRunning = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (AppPreferences.instance.globalLockEnabled) {
      _isLocked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _authenticate());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final prefs = AppPreferences.instance;
    if (!prefs.globalLockEnabled) {
      if (_isLocked && mounted) setState(() => _isLocked = false);
      return;
    }
    if (state == AppLifecycleState.paused && !_authRunning && !prefs.isExternalActivityActive) {
      if (mounted) setState(() => _isLocked = true);
    } else if (state == AppLifecycleState.resumed && _isLocked && !_authRunning) {
      _authenticate();
    }
  }

  Future<void> _authenticate() async {
    if (_authRunning) return;
    _authRunning = true;
    try {
      final supported = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
      if (!supported) {
        if (mounted) setState(() => _isLocked = false);
        return;
      }
      final ok = await _auth.authenticate(
        localizedReason: AppPreferences.instance.tr(
          'Buka kunci untuk mengakses ATTA DocStudio Pro',
          'Unlock to access ATTA DocStudio Pro',
        ),
        options: const AuthenticationOptions(stickyAuth: true, biometricOnly: false),
      );
      if (ok && mounted) setState(() => _isLocked = false);
    } catch (_) {
      if (mounted) setState(() => _isLocked = false);
    } finally {
      _authRunning = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefs = AppPreferences.instance;
    final pen = AppColors.penOf(context);

    if (_isLocked) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline_rounded, size: 60, color: pen),
                const SizedBox(height: 18),
                Text(
                  prefs.tr('ATTA DocStudio Pro Terkunci', 'ATTA DocStudio Pro Locked'),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  prefs.tr(
                    'Verifikasi sidik jari, wajah, atau PIN HP Anda untuk melanjutkan.',
                    'Verify your fingerprint, face, or device PIN to continue.',
                  ),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.mutedOf(context)),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _authenticate,
                  icon: const Icon(Icons.fingerprint_rounded),
                  label: Text(prefs.tr('Buka Kunci', 'Unlock')),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          const HomeScreen(),
          const ScannerSuiteTab(),
          RecentFilesScreen(
            key: _recentKey,
            onGoToTools: () => setState(() => _currentIndex = 0),
          ),
          SettingsScreen(
            onDataRestored: () => _recentKey.currentState?.loadFiles(),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
          if (index == 2) {
            _recentKey.currentState?.loadFiles();
          }
        },
        elevation: 0,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.grid_view_rounded),
            selectedIcon: Icon(Icons.grid_view_rounded, color: pen),
            label: prefs.tr('Alat PDF', 'PDF Tools'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.document_scanner_outlined),
            selectedIcon: Icon(Icons.document_scanner_rounded, color: pen),
            label: prefs.tr('Pindai', 'Scan'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.folder_outlined),
            selectedIcon: Icon(Icons.folder_rounded, color: pen),
            label: prefs.tr('Dokumen', 'Documents'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.tune_rounded),
            selectedIcon: Icon(Icons.tune_rounded, color: pen),
            label: prefs.tr('Cadangan', 'Backup & Settings'),
          ),
        ],
      ),
    );
  }
}
