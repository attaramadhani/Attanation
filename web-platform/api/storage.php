<?php
/**
 * ATTA NATION — Penyimpanan Pesanan Idempotent & Generator Token Unduhan Aman
 */
declare(strict_types=1);

function atta_data_dir(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    return $dir;
}

function atta_orders_file(): string
{
    return atta_data_dir() . '/orders.json';
}

/**
 * Baca seluruh pesanan dari penyimpanan lokal dengan file lock aman
 */
function atta_load_orders(): array
{
    $file = atta_orders_file();
    if (!file_exists($file)) {
        return [];
    }
    $fp = @fopen($file, 'rb');
    if (!$fp) {
        return [];
    }
    @flock($fp, LOCK_SH);
    $raw = stream_get_contents($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);

    $decoded = json_decode($raw ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Simpan atau perbarui satu pesanan secara atomik (idempotent terhadap order_id)
 */
function atta_save_order(array $order): bool
{
    $orderId = (string)($order['order_id'] ?? '');
    if ($orderId === '') {
        return false;
    }

    $file = atta_orders_file();
    $fp = @fopen($file, 'c+b');
    if (!$fp) {
        return false;
    }
    @flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $orders = json_decode($raw ?: '{}', true);
    if (!is_array($orders)) {
        $orders = [];
    }

    $orders[$orderId] = $order;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);
    return true;
}

/**
 * Ambil satu pesanan berdasarkan order_id
 */
function atta_get_order(string $orderId): ?array
{
    $orders = atta_load_orders();
    return $orders[$orderId] ?? null;
}

/**
 * Buat Signed Download Token (HMAC-SHA256) yang kedaluwarsa otomatis
 */
function atta_create_download_token(string $orderId, string $email, array $config): array
{
    $hours = (int)($config['download_expiry_hours'] ?? 24);
    $expiresAt = time() + ($hours * 3600);
    $secret = (string)($config['download_secret_key'] ?? 'atta_default_secret');
    $payload = $orderId . '|' . strtolower(trim($email)) . '|' . $expiresAt;
    $sig = hash_hmac('sha256', $payload, $secret);

    return [
        'expires_at' => $expiresAt,
        'expires_iso' => gmdate('c', $expiresAt),
        'signature'  => $sig,
        'query'      => http_build_query([
            'order' => $orderId,
            'email' => strtolower(trim($email)),
            'exp'   => $expiresAt,
            'sig'   => $sig,
        ]),
    ];
}

/**
 * Verifikasi Signed Download Token (Constant-time comparison dengan hash_equals)
 */
function atta_verify_download_token(string $orderId, string $email, int $expiresAt, string $sig, array $config): bool
{
    if ($orderId === '' || $sig === '' || $expiresAt < time()) {
        return false;
    }
    $secret = (string)($config['download_secret_key'] ?? 'atta_default_secret');
    $payload = $orderId . '|' . strtolower(trim($email)) . '|' . $expiresAt;
    $expected = hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $sig);
}
