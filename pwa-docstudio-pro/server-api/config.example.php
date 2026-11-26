<?php
// Salin file ini menjadi config.php lalu isi sesuai hosting kamu.
// JANGAN unggah config.php ke GitHub.
return [
    // Koneksi database MySQL dari panel hosting
    'db_dsn'  => 'mysql:host=localhost;dbname=NAMA_DATABASE;charset=utf8mb4',
    'db_user' => 'USER_DATABASE',
    'db_pass' => 'PASSWORD_DATABASE',

    // Alamat tempat aplikasi DocStudio dibuka (tanpa garis miring di akhir).
    // Tambahkan semua alamat yang dipakai, termasuk alamat uji coba.
    'allowed_origins' => [
        'https://docstudio.attanation.com',
        'http://localhost:8080',
    ],

    // Lama sesi login (hari)
    'session_days' => 90,
];
