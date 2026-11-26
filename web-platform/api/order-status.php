<?php
/**
 * ATTA NATION — Pemeriksaan Status Pesanan (Polling / Redirect Handler)
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

$orderId = trim((string)($_GET['order'] ?? ''));
if ($orderId === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_order_id']);
    exit;
}

$order = atta_get_order($orderId);
if (!$order) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'order_not_found']);
    exit;
}

$status = (string)($order['status'] ?? 'pending');
$uiState = 'menunggu';
if (in_array($status, ['settlement', 'standby_ready'], true)) {
    $uiState = 'berhasil';
} elseif ($status === 'failed') {
    $uiState = 'gagal';
}

$dlToken = $order['download_token'] ?? atta_create_download_token($orderId, (string)$order['email'], $config);

echo json_encode([
    'ok'                  => true,
    'midtrans_configured' => !empty($config['midtrans_server_key']),
    'order_id'            => $order['order_id'],
    'item'                => $order['item_name'] ?? 'ATTA DocStudio Pro',
    'amount_idr'          => (int)($order['amount_idr'] ?? 30000),
    'status'              => $status,
    'ui_state'            => $uiState,
    'target_device'       => $order['target_device'] ?? 'android',
    'payment_method'      => $order['payment_method'] ?? 'qris',
    'download_url'        => in_array($status, ['settlement', 'standby_ready'], true)
        ? ('api/download.php?' . ($dlToken['query'] ?? ''))
        : null,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
