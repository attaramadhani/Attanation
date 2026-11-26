<?php
/**
 * ATTA NATION — Endpoint Pembuatan Pesanan & Integrasi Midtrans Snap
 *
 * Fitur Keamanan & Produksi:
 * - Penguncian harga mutlak di sisi server (Rp30.000) — anti manipulasi inspect element.
 * - Idempotency Key support — mencegah pesanan ganda saat tombol diklik berkali-kali.
 * - Otomatis mendeteksi apakah `midtrans_server_key` sudah diisi di `config.php`:
 *   a) Jika sudah diisi -> Memanggil Midtrans Snap API (Sandbox/Production) & mengembalikan `snap_token`.
 *   b) Jika masih kosong ('') -> Berjalan mulus dalam Mode Standby (mencatat pesanan + link konfirmasi WA).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed', 'message' => 'Gunakan metode POST.']);
    exit;
}

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

$raw = file_get_contents('php://input') ?: '';
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = $_POST;
}

$name          = trim((string)($input['name'] ?? ''));
$email         = strtolower(trim((string)($input['email'] ?? '')));
$password      = (string)($input['password'] ?? '');
$phone         = preg_replace('/[^0-9+]/', '', (string)($input['phone'] ?? ''));
$targetDevice  = in_array($input['target_device'] ?? '', ['android', 'ios'], true) ? $input['target_device'] : 'android';
$paymentMethod = in_array($input['payment_method'] ?? '', ['qris', 'bank', 'ewallet'], true) ? $input['payment_method'] : 'qris';
$productId     = strtolower(trim((string)($input['product_id'] ?? 'atta-docstudio-pro')));
$idemKey       = trim((string)($input['idempotency_key'] ?? ''));

// Validasi input
if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_name', 'message' => 'Nama lengkap harus diisi (2–80 karakter).']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_email', 'message' => 'Format alamat email tidak valid.']);
    exit;
}
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'weak_password', 'message' => 'Kata sandi minimal 8 karakter.']);
    exit;
}

// Kunci produk & harga dari server
$catalog = $config['products'] ?? [];
$product = $catalog[$productId] ?? $catalog['atta-docstudio-pro'];
$grossAmount = (int)$product['price_idr']; // Mutlak 30000 dari server

// Cek Idempotency jika idempotency_key dikirim
if ($idemKey !== '') {
    $existingOrders = atta_load_orders();
    foreach ($existingOrders as $existing) {
        if (($existing['idempotency_key'] ?? '') === $idemKey && ($existing['email'] ?? '') === $email) {
            echo json_encode([
                'ok'                  => true,
                'idempotent_replay'   => true,
                'mode'                => $existing['mode'] ?? 'standby_no_key',
                'midtrans_configured' => !empty($config['midtrans_server_key']),
                'order'               => [
                    'order_id'       => $existing['order_id'],
                    'item'           => $existing['item_name'],
                    'amount_idr'     => $existing['amount_idr'],
                    'status'         => $existing['status'],
                    'payment_method' => $existing['payment_method'],
                    'target_device'  => $existing['target_device'],
                    'created_at'     => $existing['created_at'],
                ],
                'snap_token'          => $existing['snap_token'] ?? null,
                'redirect_url'        => $existing['redirect_url'] ?? null,
                'download_token'      => $existing['download_token'] ?? null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }
    }
}

$orderId = 'ATN-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(2)));
$dlToken = atta_create_download_token($orderId, $email, $config);

$serverKey    = trim((string)($config['midtrans_server_key'] ?? ''));
$clientKey    = trim((string)($config['midtrans_client_key'] ?? ''));
$isProduction = (bool)($config['midtrans_is_production'] ?? false);

$orderRecord = [
    'order_id'        => $orderId,
    'idempotency_key' => $idemKey,
    'product_id'      => $product['id'],
    'item_name'       => $product['name'],
    'amount_idr'      => $grossAmount,
    'customer_name'   => $name,
    'email'           => $email,
    'phone'           => $phone,
    'password_hash'   => password_hash($password, PASSWORD_DEFAULT),
    'target_device'   => $targetDevice,
    'payment_method'  => $paymentMethod,
    'status'          => 'pending',
    'created_at'      => gmdate('c'),
    'updated_at'      => gmdate('c'),
    'download_token'  => $dlToken,
];

// ============================================================================
// KONDISI A: Kunci Midtrans SUDAH diisi -> Panggil Midtrans Snap API
// ============================================================================
if ($serverKey !== '') {
    $snapEndpoint = $isProduction
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    $enabledPayments = ['other_qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'echannel', 'permata_va'];
    if ($paymentMethod === 'qris') {
        $enabledPayments = ['other_qris', 'gopay', 'shopeepay'];
    } elseif ($paymentMethod === 'bank') {
        $enabledPayments = ['bca_va', 'echannel', 'bni_va', 'bri_va', 'permata_va'];
    } elseif ($paymentMethod === 'ewallet') {
        $enabledPayments = ['gopay', 'shopeepay', 'other_qris'];
    }

    $midtransPayload = [
        'transaction_details' => [
            'order_id'     => $orderId,
            'gross_amount' => $grossAmount,
        ],
        'item_details' => [
            [
                'id'       => $product['id'],
                'price'    => $grossAmount,
                'quantity' => 1,
                'name'     => $product['name'] . ' (v' . $product['version'] . ')',
            ],
        ],
        'customer_details' => [
            'first_name' => $name,
            'email'      => $email,
            'phone'      => $phone,
        ],
        'enabled_payments' => $enabledPayments,
    ];

    $ch = curl_init($snapEndpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Basic ' . base64_encode($serverKey . ':'),
        ],
        CURLOPT_POSTFIELDS     => json_encode($midtransPayload),
        CURLOPT_TIMEOUT        => 15,
    ]);

    $respBody = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    $snapData = json_decode((string)$respBody, true);

    if ($httpCode >= 200 && $httpCode < 300 && !empty($snapData['token'])) {
        $orderRecord['mode']         = 'midtrans_snap';
        $orderRecord['snap_token']   = $snapData['token'];
        $orderRecord['redirect_url'] = $snapData['redirect_url'] ?? '';
        atta_save_order($orderRecord);

        echo json_encode([
            'ok'                  => true,
            'mode'                => 'midtrans_snap',
            'midtrans_configured' => true,
            'is_production'       => $isProduction,
            'client_key'          => $clientKey,
            'snap_token'          => $snapData['token'],
            'redirect_url'        => $snapData['redirect_url'] ?? '',
            'order'               => [
                'order_id'       => $orderId,
                'item'           => $product['name'],
                'amount_idr'     => $grossAmount,
                'status'         => 'pending',
                'payment_method' => $paymentMethod,
                'target_device'  => $targetDevice,
            ],
            'download_token'      => $dlToken,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Jika gagal memanggil Midtrans (misal key salah), kembalikan pesan jelas
    http_response_code(502);
    echo json_encode([
        'ok'      => false,
        'error'   => 'midtrans_gateway_error',
        'message' => 'Gagal menghubungi Midtrans Snap API. Periksa Server Key Anda di api/config.php.',
        'detail'  => $snapData['error_messages'] ?? $curlErr,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================================
// KONDISI B: Kunci Midtrans MASIH KOSONG ('') -> Mode Standby Siap Pakai
// ============================================================================
$orderRecord['mode']   = 'standby_no_key';
$orderRecord['status'] = 'standby_ready';
atta_save_order($orderRecord);

$waAdmin = $config['whatsapp_admin'] ?? '6281235928712';
$waText  = rawurlencode(
    "Halo ATTA NATION, saya ingin menyelesaikan pesanan aplikasi:\n" .
    "- No. Pesanan: {$orderId}\n" .
    "- Produk: {$product['name']} (Rp30.000)\n" .
    "- Nama: {$name}\n" .
    "- Email: {$email}\n" .
    "- Metode: " . strtoupper($paymentMethod)
);

echo json_encode([
    'ok'                   => true,
    'mode'                 => 'standby_no_key',
    'midtrans_configured'  => false,
    'message'              => 'Pesanan dicatat. Kunci Midtrans di api/config.php masih dikosongkan (Mode Standby aktif).',
    'order'                => [
        'order_id'       => $orderId,
        'item'           => $product['name'],
        'amount_idr'     => $grossAmount,
        'status'         => 'standby_ready',
        'payment_method' => $paymentMethod,
        'target_device'  => $targetDevice,
    ],
    'download_token'       => $dlToken,
    'download_url'         => 'api/download.php?' . $dlToken['query'],
    'whatsapp_confirm_url' => "https://wa.me/{$waAdmin}?text={$waText}",
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
