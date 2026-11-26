import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AiIntelligenceService {
  static const String _apiKeyPref = 'gemini_api_key';

  static Future<String?> getApiKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_apiKeyPref);
  }

  static Future<void> saveApiKey(String apiKey) async {
    final prefs = await SharedPreferences.getInstance();
    final trimmed = apiKey.trim();
    if (trimmed.isEmpty) {
      await prefs.remove(_apiKeyPref);
    } else {
      await prefs.setString(_apiKeyPref, trimmed);
    }
  }

  /// Panggilan ke Gemini API (Mencoba model Flash aktif berurutan via header x-goog-api-key).
  static Future<String> generateAiResponse(String prompt, {String? apiKeyOverride}) async {
    final apiKey = (apiKeyOverride ?? await getApiKey())?.trim();
    if (apiKey == null || apiKey.isEmpty) {
      throw Exception(
        'Kunci API Gemini belum diatur. Masukkan Google Gemini API Key di Pengaturan, atau gunakan Mode Offline (Lokal).',
      );
    }

    const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
    String lastError = '';

    for (final model in models) {
      try {
        final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent',
        );

        final response = await http
            .post(
              url,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: jsonEncode({
                'contents': [
                  {
                    'parts': [
                      {'text': prompt}
                    ]
                  }
                ]
              }),
            )
            .timeout(const Duration(seconds: 90));

        if (response.statusCode == 200) {
          final data = jsonDecode(utf8.decode(response.bodyBytes));
          final parts = data['candidates']?[0]?['content']?['parts'] as List?;
          final text = parts?.map((p) => p['text'] ?? '').join().trim() ?? '';
          if (text.isNotEmpty) return text;
          lastError = 'Respons AI kosong (mungkin diblokir filter keamanan).';
        } else if (response.statusCode == 400 || response.statusCode == 401 || response.statusCode == 403) {
          throw Exception('Kunci API Gemini tidak valid atau tidak punya akses. Periksa kembali di Pengaturan.');
        } else if (response.statusCode == 429) {
          lastError = 'Kuota API habis / terlalu banyak permintaan. Coba lagi beberapa saat.';
        } else {
          lastError = 'Server AI ($model) merespons kode ${response.statusCode}.';
        }
      } on TimeoutException {
        lastError = 'Waktu habis menunggu respons AI. Periksa koneksi internet.';
      } on SocketException {
        throw Exception('Tidak ada koneksi internet.');
      }
    }

    throw Exception('Gagal menghubungi Google Gemini AI. $lastError');
  }

  /// Batas karakter yang dikirim ke AI agar tidak melebihi batas permintaan.
  static const int maxChars = 120000;

  static String _limit(String text) {
    final clean = text.trim();
    if (clean.length <= maxChars) return clean;
    return '${clean.substring(0, maxChars)}\n\n[... teks dipotong karena terlalu panjang ...]';
  }

  /// Ringkasan AI (Online via Gemini — hanya dipanggil setelah persetujuan eksplisit pengguna).
  static Future<String> summarizeText(String pdfText) async {
    final prompt = '''
Anda adalah asisten AI dari ATTA DocStudio Pro. Tolong buatkan ringkasan yang sangat jelas, terstruktur, dan komprehensif dari teks dokumen berikut dalam Bahasa Indonesia.
Sajikan dengan format:
1. Ringkasan Eksekutif (1-2 paragraf)
2. Poin-Poin Kunci & Entitas Penting (tanggal, nomor dokumen, nominal, pihak)
3. Kesimpulan / Tindak Lanjut

Teks Dokumen:
${_limit(pdfText)}
''';
    return await generateAiResponse(prompt);
  }

  /// Terjemahkan Dokumen (Online via Gemini — hanya dipanggil setelah persetujuan eksplisit pengguna).
  static Future<String> translateText(String pdfText, String targetLanguage) async {
    final prompt = '''
Terjemahkan teks dokumen berikut secara akurat ke bahasa: $targetLanguage.
Pertahankan struktur judul, paragraf, daftar isi, dan istilah teknis dengan tepat.

Teks Dokumen:
${_limit(pdfText)}
''';
    return await generateAiResponse(prompt);
  }

  /// Ubah PDF ke Markdown Terstruktur (Online via Gemini — hanya dipanggil setelah persetujuan eksplisit pengguna).
  static Future<String> convertToMarkdown(String pdfText) async {
    final prompt = '''
Konversikan teks dokumen mentah berikut menjadi dokumen format Markdown (.md) yang rapi dan terstruktur dengan heading (#, ##, ###), tabel jika ada, dan formatting yang bersih.

Teks Dokumen:
${_limit(pdfText)}
''';
    return await generateAiResponse(prompt);
  }

  /// Analisis entitas lokal 100% offline (menggabungkan keakuratan regex dokumen Indonesia dari PWA + Scanner Suite).
  static Map<String, dynamic> analyzeLocalEntities(String text) {
    final lower = text.toLowerCase();

    String category = 'Dokumen Umum';
    if (lower.contains('nik') ||
        (lower.contains('provinsi') && lower.contains('kartu tanda penduduk')) ||
        lower.contains('gol. darah') ||
        lower.contains('rt/rw')) {
      category = 'Kartu Identitas (KTP)';
    } else if (lower.contains('invoice') ||
        lower.contains('tagihan') ||
        lower.contains('jatuh tempo') ||
        lower.contains('due date') ||
        lower.contains('faktur')) {
      category = 'Faktur / Tagihan (Invoice)';
    } else if (lower.contains('kwitansi') ||
        lower.contains('kembalian') ||
        lower.contains('kasir') ||
        lower.contains('tunai') ||
        lower.contains('lunas') ||
        lower.contains('receipt')) {
      category = 'Kwitansi / Bukti Pembayaran';
    } else if (lower.contains('perjanjian') ||
        lower.contains('pihak pertama') ||
        lower.contains('pihak kedua') ||
        lower.contains('pasal ')) {
      category = 'Kontrak / Perjanjian';
    } else if (lower.contains('surat keputusan') ||
        lower.contains('surat keterangan') ||
        lower.contains('kepada yth') ||
        lower.contains('perihal') ||
        lower.contains('nomor:')) {
      category = 'Surat Resmi';
    }

    final nikRegex = RegExp(r'\b\d{16}\b');
    final npwpRegex = RegExp(r'\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b');
    final emailRegex = RegExp(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', caseSensitive: false);
    final phoneRegex = RegExp(r'(?:\+?62|0)[89]\d{7,11}\b');
    final dateRegex = RegExp(
      r'\b\d{1,2}[-/\s](?:\d{1,2}|Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agu(?:stus)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/\s]\d{2,4}\b',
      caseSensitive: false,
    );
    final moneyRegex = RegExp(r'\b(?:Rp\.?|IDR|\$|EUR)\s?\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?\b', caseSensitive: false);
    final docNoRegex = RegExp(r'(?:Nomor|No\.?|Invoice|Ref)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]{3,34})', caseSensitive: false);
    final subjectMatch = RegExp(r'(?:Perihal|Hal|Subject)\s*:\s*([^\r\n]{3,90})', caseSensitive: false).firstMatch(text);

    final docNumbers = <String>{};
    for (final m in docNoRegex.allMatches(text)) {
      final candidate = (m.group(1) ?? '').trim();
      if (RegExp(r'\d').hasMatch(candidate)) docNumbers.add(candidate);
      if (docNumbers.length >= 4) break;
    }

    return {
      'category': category,
      'subject': subjectMatch?.group(1)?.trim() ?? '',
      'docNumbers': docNumbers.toList(),
      'niks': nikRegex.allMatches(text).map((m) => m.group(0)!).toSet().toList(),
      'npwps': npwpRegex.allMatches(text).map((m) => m.group(0)!).toSet().toList(),
      'emails': emailRegex.allMatches(text).map((m) => m.group(0)!).toSet().toList(),
      'phones': phoneRegex.allMatches(text).map((m) => m.group(0)!).toSet().toList(),
      'dates': dateRegex.allMatches(text).map((m) => m.group(0)!).toSet().toList(),
      'amounts': moneyRegex.allMatches(text).map((m) => m.group(0)!).toSet().toList(),
    };
  }

  /// Ringkasan Cerdas Offline (Tanpa API Key / Internet) dengan ekstraksi entitas & sentence scoring.
  static String summarizeTextLocally(String pdfText) {
    final lines = pdfText
        .split(RegExp(r'\r?\n'))
        .map((l) => l.replaceAll(RegExp(r'\s+'), ' ').trim())
        .where((l) => l.isNotEmpty)
        .toList();
    if (lines.isEmpty) return 'Dokumen tidak memiliki teks yang cukup untuk diringkas.';

    final entities = analyzeLocalEntities(pdfText);
    final words = pdfText.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final totalWords = words.length;
    final totalChars = pdfText.length;
    final paragraphs = lines.where((l) => l.length > 40).toList();

    final buffer = StringBuffer();
    buffer.writeln('# 📄 Ringkasan Dokumen (Mode Offline Pintar)\n');
    buffer.writeln('> *Diproses 100% lokal di perangkat tanpa internet. Isi dokumen tidak dikirim keluar.*\n');
    buffer.writeln('### 📊 Statistik & Klasifikasi');
    buffer.writeln('- **Kategori Terdeteksi:** ${entities['category']}');
    buffer.writeln('- **Total Kata:** $totalWords kata ($totalChars karakter)');
    buffer.writeln('- **Jumlah Paragraf Utama:** ${paragraphs.length} paragraf');

    final subject = entities['subject'] as String;
    final docNumbers = List<String>.from(entities['docNumbers'] as List);
    final amounts = List<String>.from(entities['amounts'] as List);
    final dates = List<String>.from(entities['dates'] as List);
    final phones = List<String>.from(entities['phones'] as List);
    final emails = List<String>.from(entities['emails'] as List);
    final niks = List<String>.from(entities['niks'] as List);
    final npwps = List<String>.from(entities['npwps'] as List);

    if (subject.isNotEmpty) buffer.writeln('- **Perihal / Subjek:** $subject');
    if (docNumbers.isNotEmpty) buffer.writeln('- **Nomor Dokumen:** ${docNumbers.join(', ')}');
    if (amounts.isNotEmpty) buffer.writeln('- **Nominal Terdeteksi:** ${amounts.join(', ')}');
    if (dates.isNotEmpty) buffer.writeln('- **Tanggal Penting:** ${dates.join(', ')}');
    if (phones.isNotEmpty) buffer.writeln('- **Nomor Telepon:** ${phones.join(', ')}');
    if (emails.isNotEmpty) buffer.writeln('- **Alamat Email:** ${emails.join(', ')}');
    if (niks.isNotEmpty) buffer.writeln('- **NIK (16 digit):** ${niks.join(', ')}');
    if (npwps.isNotEmpty) buffer.writeln('- **NPWP:** ${npwps.join(', ')}');

    // Skor kalimat/baris untuk memilih inti isi (menghindari baris kop/alamat surat)
    final cueRegex = RegExp(
      r'\b(bahwa|bertujuan|menyatakan|total|jumlah|pembayaran|tagihan|kesimpulan|berlaku|wajib|setuju|hasil|tanggal|sebesar|menerangkan|keputusan|tujuan|penelitian|metode|summary|total|amount|therefore|agreed)\b',
      caseSensitive: false,
    );
    final boilerplateRegex = RegExp(r'^(jl\.|jalan|telp|fax|email|website|http|www\.)', caseSensitive: false);

    final scored = <({String line, int idx, int score})>[];
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      int score = 0;
      if (line.length >= 28 && line.length <= 220) {
        score += 3;
      } else if (line.length > 220) {
        score += 1;
      }
      if (cueRegex.hasMatch(line)) score += 4;
      if (RegExp(r'\b(?:Rp\.?|IDR|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b', caseSensitive: false).hasMatch(line)) score += 3;
      if (i == 0 && line.length >= 8 && line.length <= 90) score += 2;
      if (boilerplateRegex.hasMatch(line)) score -= 5;
      scored.add((line: line, idx: i, score: score));
    }

    final nonBoilerplate = scored.where((e) => e.score >= 0).toList();
    final pool = nonBoilerplate.isNotEmpty ? nonBoilerplate : scored;
    pool.sort((a, b) => b.score != a.score ? b.score.compareTo(a.score) : a.idx.compareTo(b.idx));
    final picked = pool.take(6).toList()..sort((a, b) => a.idx.compareTo(b.idx));

    buffer.writeln('\n### 🎯 Poin-Poin Penting');
    for (final item in picked) {
      buffer.writeln('- ${item.line}');
    }

    buffer.writeln('\n### 📝 Ringkasan Penutup');
    if (paragraphs.length > 2) {
      buffer.writeln(paragraphs.last);
    } else if (picked.isNotEmpty) {
      buffer.writeln(picked.last.line);
    } else {
      buffer.writeln('Dokumen telah berhasil dianalisis secara lokal.');
    }

    return buffer.toString();
  }

  /// Ubah PDF ke Markdown Secara Lokal (Tanpa API Key / Internet)
  static String convertToMarkdownLocally(String pdfText) {
    final lines = pdfText.split(RegExp(r'\r?\n'));
    final buffer = StringBuffer();
    buffer.writeln('# Dokumen Terstruktur (Markdown)\n');
    buffer.writeln('> *Dikonversi ke format Markdown (.md) terstruktur secara lokal di perangkat.*\n');

    bool inTable = false;
    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) {
        if (inTable) inTable = false;
        buffer.writeln();
        continue;
      }

      final parts = trimmed.split(RegExp(r'\s{2,}|\t|\s\|\s'));
      if (parts.length >= 2) {
        if (!inTable) {
          buffer.writeln('| ${parts.map((p) => p.trim()).join(' | ')} |');
          buffer.writeln('| ${parts.map((_) => '---').join(' | ')} |');
          inTable = true;
        } else {
          buffer.writeln('| ${parts.map((p) => p.trim()).join(' | ')} |');
        }
      } else {
        inTable = false;
        if (trimmed.length < 45 && !trimmed.endsWith('.')) {
          buffer.writeln('\n## $trimmed\n');
        } else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
          buffer.writeln('* ${trimmed.substring(1).trim()}');
        } else {
          buffer.writeln('$trimmed\n');
        }
      }
    }
    return buffer.toString();
  }
}
