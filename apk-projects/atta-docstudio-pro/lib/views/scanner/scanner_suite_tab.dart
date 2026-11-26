import 'dart:io';
import 'package:flutter/material.dart';
import '../../scanner_suite/models/scanned_document.dart';
import '../../scanner_suite/services/document_service.dart';
import '../../scanner_suite/services/image_filter_service.dart';
import '../../scanner_suite/screens/dashboard_screen.dart';
import '../../core/theme/app_colors.dart';

/// Jembatan tampilan Scanner OpenCV di dalam ATTA DocStudio Pro.
/// Menyediakan akses penuh ke mesin pemindai OpenCV (Single, Batch, KTP/ID Card 2-sisi,
/// 7 Filter Cerdas, Offline OCR ML Kit, dan e-Signature) langsung sebagai tab utama.
class ScannerSuiteTab extends StatelessWidget {
  const ScannerSuiteTab({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF12161B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF14B8A6),
          secondary: Color(0xFF93A9FF),
          surface: Color(0xFF1D232B),
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Color(0xFFE6EAEE),
          error: Color(0xFFFF8A80),
        ),
        scaffoldBackgroundColor: const Color(0xFF12161B),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1D232B),
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: Color(0xFFE6EAEE),
            fontSize: 19,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.2,
          ),
          iconTheme: IconThemeData(color: Color(0xFFE6EAEE)),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1D232B),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: Color(0xFF2C3440), width: 1),
          ),
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: Color(0xFF2445C9),
          foregroundColor: Colors.white,
        ),
      ),
      child: const DashboardScreen(),
    );
  }
}
