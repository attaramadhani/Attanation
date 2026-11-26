<?php
/**
 * ATTA NATION — App Version & Release Metadata Endpoint (v1)
 *
 * Menyediakan informasi versi terbaru ATTA DocStudio Pro (v2.5.0).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$response = [
    'product_slug' => 'atta-docstudio-pro',
    'product_name' => 'ATTA DocStudio Pro',
    'version_name' => '2.5.0',
    'version_code' => 25,
    'price_idr'    => 30000,
    'billing_type' => 'one_time',
    'download_url' => '../pwa-docstudio-pro/',
    'changelog'    => 'Versi 2.5.0: Scan kamera presisi, 25+ alat PDF offline, brankas terenkripsi AES-256-GCM, dan aktivasi otomatis via akun.',
    'mandatory'    => false,
];

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
