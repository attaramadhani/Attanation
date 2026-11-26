<?php
/**
 * ATTA NATION — Midtrans Payment Notification Webhook Endpoint
 *
 * Keamanan Kriptografis:
 * - Memverifikasi `signature_key` menggunakan SHA-512(`order_id` + `status_code` + `gross_amount` + `ServerKey`)
 *   dengan perbandingan waktu-konstan `hash_equals()` untuk mencegah timing attack & pemalsuan status.
 * - Bersifat Idempotent: notifikasi ulang (webhook retry) dari Midtrans dengan status yang sama
 *   tidak akan merusak data atau membuat duplikasi lisensi.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

$raw = file_get_contents('php://input') ?: '';
$notif = json_decode($raw, true);

if (!is_array($notif)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json_payload']);
    exit;
}

$orderId           = (string)($notif['order_id'] ?? '');
$statusCode        = (string)($notif['status_code'] ?? '');
$grossAmount       = (string)($notif['gross_amount'] ?? '');
$signatureKey      = (string)($notif['signature_key'] ?? '');
$transactionStatus = (string)($notif['transaction_status'] ?? '');
$fraudStatus       = (string)($notif['fraud_status'] ?? 'accept');

if ($orderId === '' || $statusCode === '' || $grossAmount === '' || $signatureKey === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_required_fields']);
    exit;
}

$serverKey = trim((string)($config['midtrans_server_key'] ?? ''));
if ($serverKey === '') {
    // Jika Server Key belum diisi di config.php, tolak webhook eksternal demi keamanan
    http_response_code(503);
    echo json_encode([
        'ok'      => false,
        'error'   => 'midtrans_key_not_configured',
        'message' => 'midtrans_server_key di api/config.php masih kosong.',
    ]);
    exit;
}

// Verifikasi Signature SHA-512 resmi Midtrans
$expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);
if (!hash_equals($expectedSignature, strtolower($signatureKey))) {
    http_response_code(403);
    echo json_encode([
        'ok'      => false,
        'error'   => 'invalid_signature',
        'message' => 'Tanda tangan kriptografis HMAC/SHA-512 Midtrans tidak cocok.',
    ]);
    exit;
}

$order = atta_get_order($orderId);
if (!$order) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'order_not_found']);
    exit;
}

// Idempotency: jika pesanan sudah berstatus 'settlement', langsung balas 200 OK
if (($order['status'] ?? '') === 'settlement') {
    echo json_encode([
        'ok'         => true,
        'idempotent' => true,
        'order_id'   => $orderId,
        'status'     => 'settlement',
    ]);
    exit;
}

// Pemetaan status transaksi Midtrans
$newStatus = $order['status'] ?? 'pending';
if ($transactionStatus === 'capture') {
    $newStatus = ($fraudStatus === 'accept') ? 'settlement' : 'pending';
} elseif ($transactionStatus === 'settlement') {
    $newStatus = 'settlement';
} elseif ($transactionStatus === 'pending') {
    $newStatus = 'pending';
} elseif (in_array($transactionStatus, ['deny', 'expire', 'cancel'], true)) {
    $newStatus = 'failed';
}

$order['status']                  = $newStatus;
$order['midtrans_transaction_id'] = (string)($notif['transaction_id'] ?? '');
$order['midtrans_payment_type']   = (string)($notif['payment_type'] ?? '');
$order['updated_at']              = gmdate('c');

// Perbarui masa aktif token unduhan 24 jam sejak lunas
if ($newStatus === 'settlement') {
    $order['settled_at']     = gmdate('c');
    $order['download_token'] = atta_create_download_token($orderId, (string)$order['email'], $config);
}

atta_save_order($order);

echo json_encode([
    'ok'       => true,
    'order_id' => $orderId,
    'status'   => $newStatus,
]);
