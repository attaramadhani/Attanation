import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/services/ai_intelligence_service.dart';

class AIAnalysisService {
  /// Analisis dokumen 100% offline dengan regex & klasifikasi entitas Indonesia.
  static Map<String, dynamic> localHeuristicAnalysis(String text) {
    return AiIntelligenceService.analyzeLocalEntities(text);
  }

  /// Mengirim teks ke model Gemini aktif (dengan fallback berurutan & header x-goog-api-key)
  /// hanya setelah pengguna memberi persetujuan eksplisit.
  static Future<String> analyzeWithGemini(String text, String apiKey) async {
    final prompt = 'Analisis dokumen berikut secara profesional dan berikan output dalam format Markdown yang rapi:\n\n'
        '1. **Tipe Dokumen**: Kategori dokumen ini (misal: Kwitansi Belanja, KTP, Surat Perjanjian, Tagihan Listrik).\n'
        '2. **Ringkasan**: 2-3 kalimat ringkasan singkat mengenai isi dokumen.\n'
        '3. **Rincian Penting**: Tampilkan data penting (seperti nama pihak, tanggal, nomor tagihan, total biaya, alamat) dalam bentuk tabel Markdown atau daftar poin.\n'
        '4. **Analisis Tambahan**: Hal penting lainnya (misal: tanggal jatuh tempo yang mendesak, kejanggalan dokumen, atau instruksi tindak lanjut).\n\n'
        'Berikut adalah teks hasil scan dokumen:\n\n'
        '---\n'
        '${text.length > 80000 ? text.substring(0, 80000) : text}\n'
        '---';

    return AiIntelligenceService.generateAiResponse(prompt, apiKeyOverride: apiKey);
  }

  /// Tanya-jawab interaktif dokumen berbasis model Gemini aktif (via header x-goog-api-key).
  static Future<String> chatWithGemini({
    required String docText,
    required List<Map<String, String>> chatHistory,
    required String question,
    required String apiKey,
  }) async {
    const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
    final contents = <Map<String, dynamic>>[
      {
        'role': 'user',
        'parts': [
          {
            'text': 'Berikut adalah teks dari dokumen yang dipindai:\n\n'
                '=== DOKUMEN ===\n'
                '${docText.length > 80000 ? docText.substring(0, 80000) : docText}\n'
                '================\n\n'
                'Jawablah semua pertanyaan pengguna berikutnya berdasarkan isi dokumen di atas. '
                'Gunakan bahasa Indonesia yang santun, jelas, dan profesional. '
                'Jika jawabannya tidak terdapat di dalam dokumen, jelaskan secara jujur bahwa informasi tersebut tidak ditemukan.'
          }
        ]
      },
      {
        'role': 'model',
        'parts': [
          {'text': 'Baik, saya telah membaca dokumen tersebut. Silakan ajukan pertanyaan Anda.'}
        ]
      },
    ];

    for (final msg in chatHistory) {
      contents.add({
        'role': msg['role'] == 'user' ? 'user' : 'model',
        'parts': [
          {'text': msg['text']!}
        ]
      });
    }

    contents.add({
      'role': 'user',
      'parts': [
        {'text': question}
      ]
    });

    String lastError = '';
    for (final model in models) {
      try {
        final uri = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent',
        );
        final res = await http
            .post(
              uri,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey.trim(),
              },
              body: jsonEncode({'contents': contents}),
            )
            .timeout(const Duration(seconds: 90));

        if (res.statusCode == 200) {
          final decoded = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
          final parts = decoded['candidates']?[0]?['content']?['parts'] as List?;
          final reply = parts?.map((p) => p['text'] ?? '').join().trim() ?? '';
          if (reply.isNotEmpty) return reply;
          lastError = 'Respons Gemini kosong.';
        } else if (res.statusCode == 400 || res.statusCode == 401 || res.statusCode == 403) {
          throw Exception('Kunci API Gemini tidak valid atau tidak memiliki akses.');
        } else {
          lastError = 'Status ${res.statusCode}';
        }
      } catch (e) {
        if (e.toString().contains('Kunci API Gemini')) rethrow;
        lastError = e.toString().replaceFirst('Exception: ', '');
      }
    }
    throw Exception('Gagal menghubungi Gemini API: $lastError');
  }
}
