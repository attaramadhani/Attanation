import 'package:flutter/material.dart';

/// Token warna "Versi 3+: Kertas dan Tinta" — diselaraskan dengan pwa-docstudio-pro/DESIGN.md
/// sambil mempertahankan alias konstanta agar seluruh layar alat PDF tetap kompatibel.
class AppColors {
  // Aksentuasi Tinta Pena Biru (Pen)
  static const Color primaryBlue = Color(0xFF2445C9);
  static const Color primaryBlueDark = Color(0xFF1D39AB);
  static const Color primaryBlueLight = Color(0xFFE7ECF8);
  static const Color penDarkText = Color(0xFF93A9FF);

  // Alias kompatibilitas layar alat PDF
  static const Color primaryRed = primaryBlue;
  static const Color primaryRedDark = primaryBlueDark;
  static const Color primaryRedLight = primaryBlueLight;

  // Warna kategori alat (dibuat tenang & terbaca baik di atas Kertas & Meja)
  static const Color organizeOrange = Color(0xFFC25E00);
  static const Color optimizeGreen = Color(0xFF0F766E);
  static const Color convertBlue = Color(0xFF2445C9);
  static const Color editPurple = Color(0xFF4F46E5);
  static const Color securityNavy = Color(0xFF17202B);
  static const Color intelligenceAi = Color(0xFF1D39AB);
  static const Color workflowsAmber = Color(0xFFB45309);

  // Token Terang ("Meja & Kertas")
  static const Color background = Color(0xFFDCE2E7); // --desk
  static const Color surface = Color(0xFFFBFBF8);    // --paper
  static const Color paperCool = Color(0xFFF3F6F9);
  static const Color cardBorder = Color(0xFFC9D1D9); // --line
  static const Color lineStrong = Color(0xFF9AA6B2);

  // Token Gelap ("Meja & Panel Gelap")
  static const Color darkDesk = Color(0xFF12161B);
  static const Color darkSurface = Color(0xFF1D232B);
  static const Color darkInk = Color(0xFFE6EAEE);
  static const Color darkMuted = Color(0xFFA1ACB8);
  static const Color darkLine = Color(0xFF2C3440);
  static const Color darkDanger = Color(0xFFFF8A80);

  // Warna Teks
  static const Color textPrimary = Color(0xFF17202B);   // --ink
  static const Color textSecondary = Color(0xFF55606D); // --muted
  static const Color textMuted = Color(0xFF6B7785);
  static const Color danger = Color(0xFFB3261E);

  // Lencana
  static const Color badgeNewBg = Color(0xFFE6F4F1);
  static const Color badgeNewText = Color(0xFF0F766E);
  static const Color badgeProBg = Color(0xFFE7ECF8);
  static const Color badgeProText = Color(0xFF2445C9);
  static const Color badgeAiBg = Color(0xFFE7ECF8);
  static const Color badgeAiText = Color(0xFF1D39AB);

  // Helper adaptif tema
  static bool isDark(BuildContext context) => Theme.of(context).brightness == Brightness.dark;
  static Color deskOf(BuildContext context) => isDark(context) ? darkDesk : background;
  static Color surfaceOf(BuildContext context) => isDark(context) ? darkSurface : surface;
  static Color inkOf(BuildContext context) => isDark(context) ? darkInk : textPrimary;
  static Color mutedOf(BuildContext context) => isDark(context) ? darkMuted : textSecondary;
  static Color lineOf(BuildContext context) => isDark(context) ? darkLine : cardBorder;
  static Color penOf(BuildContext context) => isDark(context) ? penDarkText : primaryBlue;
  static Color dangerOf(BuildContext context) => isDark(context) ? darkDanger : danger;
}
