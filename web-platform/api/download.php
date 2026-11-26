<?php
/**
 * ATTA NATION — Gerbang Unduhan Bertanda Tangan (Signed Download Token Verifier)
 *
 * Mencegah hotlinking atau pembajakan tautan langsung:
 * Hanya tautan dengan HMAC-SHA256 valid dan belum melewati batas waktu 24 jam
 * yang diizinkan mengakses paket instalasi ATTA DocStudio Pro.
 */
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

$orderId   = trim((string)($_GET['order'] ?? ''));
$email     = strtolower(trim((string)($_GET['email'] ?? '')));
$expiresAt = (int)($_GET['exp'] ?? 0);
$sig       = trim((string)($_GET['sig'] ?? ''));

if (!atta_verify_download_token($orderId, $email, $expiresAt, $sig, $config)) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tautan Kedaluwarsa — ATTA NATION</title>';
    echo '<style>body{font-family:system-ui,sans-serif;background:#24392F;color:#FAFAF7;display:grid;place-items:center;min-height:90vh;padding:24px;margin:0}.card{background:#FAFAF7;color:#17211C;max-width:480px;padding:36px;border-radius:12px;border:2px solid #17211C}a{display:inline-block;margin-top:18px;background:#17211C;color:#FAFAF7;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700}</style></head>';
    echo '<body><div class="card"><h1 style="margin:0 0 12px;font-size:26px">Tautan unduhan tidak valid atau kedaluwarsa</h1><p style="line-height:1.6;margin:0">Demi keamanan lisensi, tautan unduhan memiliki batas waktu 24 jam. Silakan masuk ke halaman <strong>Akun saya</strong> untuk mengunduh ulang aplikasi Anda.</p><a href="../akun.html">Buka Akun Saya</a></div></body></html>';
    exit;
}

// Jika valid, arahkan ke aplikasi DocStudio Pro
$targetUri = $config['products']['atta-docstudio-pro']['download_uri'] ?? '../pwa-docstudio-pro/';
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Location: ' . $targetUri);
exit;
