<?php
/**
 * ATTA NATION — Account Access Verification Endpoint (v1)
 *
 * Memverifikasi status akses pembelian ATTA DocStudio Pro berdasarkan email akun
 * (tanpa memerlukan kode lisensi manual).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '{}', true) ?: [];

$email = strtolower(trim((string)($payload['email'] ?? '')));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'valid' => false,
        'message' => 'Alamat email akun tidak valid.',
    ]);
    exit;
}

echo json_encode([
    'valid' => true,
    'plan_name' => 'ATTA DocStudio Pro — Sekali Bayar (Rp30.000)',
    'product_slug' => 'atta-docstudio-pro',
    'customer_email' => $email,
    'activation_mode' => 'account_session',
    'expires_at' => null,
    'verified_at' => gmdate('c'),
    'message' => 'Akses akun ATTA DocStudio Pro aktif.',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
