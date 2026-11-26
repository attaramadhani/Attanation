<?php
/**
 * ATTA NATION — Midtrans Snap Checkout Compatibility Endpoint (v1)
 *
 * Meneruskan permintaan ke logika harga terkunci Rp30.000 untuk ATTA DocStudio Pro
 * (sekali bayar, tanpa kode lisensi).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '{}', true) ?: [];

$productSlug = 'atta-docstudio-pro';
$customerName = htmlspecialchars(trim((string)($data['name'] ?? 'Pelanggan ATTA NATION')), ENT_QUOTES, 'UTF-8');
$customerEmail = strtolower(trim((string)($data['email'] ?? 'pelanggan@attanation.com')));
$amount = 30000;

$orderId = 'ATTA-' . gmdate('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

echo json_encode([
    'status' => 'ready',
    'order_id' => $orderId,
    'product_slug' => $productSlug,
    'product_name' => 'ATTA DocStudio Pro',
    'amount_idr' => $amount,
    'customer' => [
        'name' => $customerName,
        'email' => $customerEmail,
    ],
    'activation_type' => 'account_login',
    'message' => 'Pesanan Rp30.000 berhasil disiapkan. Gunakan endpoint /api/create-order.php untuk alur penuh Midtrans Snap.',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
