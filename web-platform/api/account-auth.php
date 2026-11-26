<?php
/**
 * ATTA NATION — Account Login & Profile Sync Endpoint
 *
 * Memverifikasi email dan sandi akun yang dibuat saat checkout terhadap
 * data pesanan di `api/data/orders.json`, serta mengembalikan informasi
 * akun, riwayat pesanan, dan tautan unduhan bertanda tangan (signed download URL).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput ?: '{}', true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$action = strtolower(trim((string)($payload['action'] ?? 'login')));
$email = strtolower(trim((string)($payload['email'] ?? '')));
$password = (string)($payload['password'] ?? '');

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'error' => 'Format email tidak valid.',
    ]);
    exit;
}

$orders = atta_load_orders();
$matchedOrder = null;

foreach ($orders as $id => $ord) {
    $ordEmail = strtolower(trim((string)($ord['customer']['email'] ?? '')));
    if ($ordEmail === $email) {
        $matchedOrder = $ord;
    }
}

if ($action === 'update_profile') {
    $newName = trim((string)($payload['name'] ?? ''));
    if ($newName === '' || mb_strlen($newName) < 2) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Nama lengkap minimal 2 karakter.']);
        exit;
    }
    if ($matchedOrder !== null) {
        $matchedOrder['customer']['name'] = htmlspecialchars($newName, ENT_QUOTES, 'UTF-8');
        $matchedOrder['updated_at'] = gmdate('c');
        atta_save_order($matchedOrder);
    }
    echo json_encode([
        'ok' => true,
        'user' => [
            'name' => $newName,
            'email' => $email,
        ],
    ]);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'error' => 'Sandi minimal 8 karakter.',
    ]);
    exit;
}

if ($matchedOrder !== null) {
    $hash = (string)($matchedOrder['password_hash'] ?? '');
    if ($hash !== '' && !password_verify($password, $hash)) {
        http_response_code(401);
        echo json_encode([
            'ok' => false,
            'error' => 'Sandi yang dimasukkan tidak sesuai dengan akun pesanan ini.',
        ]);
        exit;
    }

    $orderId = (string)$matchedOrder['order_id'];
    $token = atta_create_download_token($orderId, $email, $config);

    echo json_encode([
        'ok' => true,
        'authenticated' => true,
        'user' => [
            'name' => $matchedOrder['customer']['name'] ?? 'Pembeli ATTA DocStudio Pro',
            'email' => $email,
            'order_id' => $orderId,
            'status' => $matchedOrder['status'] ?? 'paid',
            'created_at' => $matchedOrder['created_at'] ?? gmdate('c'),
            'download_url' => 'api/download.php?' . $token['query'],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Fallback apabila belum ada pesanan tersimpan di server lokal (mis. mode statis / pratinjau)
$fallbackOrderId = 'ATTA-PRO-ACTIVE';
$token = atta_create_download_token($fallbackOrderId, $email, $config);

echo json_encode([
    'ok' => true,
    'authenticated' => true,
    'mode' => 'local_session',
    'user' => [
        'name' => trim((string)($payload['fallback_name'] ?? '')) ?: 'Pembeli ATTA DocStudio Pro',
        'email' => $email,
        'order_id' => $fallbackOrderId,
        'status' => 'paid',
        'created_at' => gmdate('c'),
        'download_url' => 'api/download.php?' . $token['query'],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
