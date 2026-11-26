import 'package:flutter_test/flutter_test.dart';
import 'package:atta_docstudio_pro/core/services/ai_intelligence_service.dart';
import 'package:atta_docstudio_pro/core/services/app_preferences.dart';
import 'package:atta_docstudio_pro/core/utils/file_helper.dart';
import 'package:atta_docstudio_pro/main.dart';

void main() {
  testWidgets('ATTA DocStudio Pro smoke test and tool listings', (WidgetTester tester) async {
    await tester.pumpWidget(const AttaDocStudioApp());
    await tester.pump(const Duration(milliseconds: 500));

    // Verify primary tools exist
    expect(find.text('Gabungkan PDF'), findsOneWidget);
    expect(find.text('Pisahkan PDF'), findsOneWidget);
  });

  test('FileHelper formatBytes formats byte sizes accurately', () {
    expect(FileHelper.formatBytes(0), '0 B');
    expect(FileHelper.formatBytes(1024), '1.00 KB');
    expect(FileHelper.formatBytes(1048576), '1.00 MB');
    expect(FileHelper.formatBytes(1073741824), '1.00 GB');
  });

  test('AiIntelligenceService generates offline summary, entity extraction and markdown cleanly', () {
    const sampleText = '''
PT NUSANTARA MANDIRI
Jl. Jend. Sudirman Kav. 21, Jakarta Selatan
Nomor: INV/2026/11/0482
Perihal: Tagihan Layanan Pemeliharaan Sistem Bulan November 2026
NPWP: 01.234.567.8-901.000
Dokumen ini menyatakan bahwa total tagihan layanan sebesar Rp 14.500.000,00 wajib dibayar sebelum tanggal 25/11/2026.
Sistem ini menggunakan algoritma enkripsi modern dan kompresi tanpa kehilangan data.

Kolom A  Kolom B  Kolom C
Data 1   Data 2   Data 3
Data 4   Data 5   Data 6
''';

    final entities = AiIntelligenceService.analyzeLocalEntities(sampleText);
    expect(entities['docNumbers'], contains('INV/2026/11/0482'));
    expect(entities['npwps'], contains('01.234.567.8-901.000'));
    expect(entities['subject'], contains('Tagihan Layanan'));

    final summary = AiIntelligenceService.summarizeTextLocally(sampleText);
    expect(summary, contains('Ringkasan Dokumen (Mode Offline Pintar)'));
    expect(summary, contains('Total Kata'));
    expect(summary, contains('Nomor Dokumen'));
    expect(summary, contains('Rp 14.500.000,00'));
    expect(summary, isNot(contains('- Jl. Jend. Sudirman Kav. 21')));

    final markdown = AiIntelligenceService.convertToMarkdownLocally(sampleText);
    expect(markdown, contains('Dokumen Terstruktur (Markdown)'));
    expect(markdown, contains('| Kolom A | Kolom B | Kolom C |'));
  });

  test('AppPreferences tr switches between Indonesian and English cleanly', () {
    final prefs = AppPreferences.instance;
    expect(prefs.tr('Dokumen', 'Documents'), 'Dokumen');
  });
}
