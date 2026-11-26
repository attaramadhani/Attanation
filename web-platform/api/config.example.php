<?php
/**
 * ATTA NATION — Contoh Konfigurasi Pembayaran Midtrans & Backend Order
 * Salin file ini menjadi `config.php` di server produksi Hostinger Anda.
 */

return [
    // 1. KONFIGURASI MIDTRANS (Kosongkan dulu jika belum daftar Midtrans)
    'midtrans_is_production' => false,
    'midtrans_server_key'    => '', // Isi dengan Midtrans Server Key nanti
    'midtrans_client_key'    => '', // Isi dengan Midtrans Client Key nanti

    // 2. KEAMANAN TOKEN UNDUHAN & KONTAK ADMIN
    'download_secret_key'    => 'GANTI_DENGAN_STRING_ACAK_PANJANG_ANDA',
    'download_expiry_hours'  => 24,
    'whatsapp_admin'         => '6281235928712',
    'support_email'          => 'attalaaliframadhanitrihida@gmail.com',

    // 3. KATALOG PRODUK RESMI (Harga dikunci di sisi server)
    'products' => [
        'atta-docstudio-pro' => [
            'id'           => 'atta-docstudio-pro',
            'name'         => 'ATTA DocStudio Pro',
            'version'      => '2.5.0',
            'price_idr'    => 30000,
            'download_uri' => '../pwa-docstudio-pro/',
        ],
    ],

    // 4. DATABASE OPSIONAL
    'db_dsn'  => '',
    'db_user' => '',
    'db_pass' => '',
];
