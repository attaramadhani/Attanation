# Panduan Aktivasi Midtrans — ATTA NATION

Saat ini sistem pembayaran di `web-platform/api/config.php` disetel dengan **`midtrans_server_key` dan `midtrans_client_key` kosong (`''`)**.

## 1. Cara Kerja Saat Key Masih Kosong (Mode Standby Hari Ini)
- Ketika pelanggan mengisi formulir di `checkout.html` dan menekan **Bayar Rp30.000**:
  1. Pesanan tetap tercatat secara resmi dengan nomor unik (`ATN-YYYYMMDD-XXXX`) dan harga dikunci mutlak **Rp30.000** di server.
  2. Akun pembeli otomatis dibuat dan disimpan.
  3. Pelanggan diarahkan ke halaman `status-pembayaran.html` yang menyediakan tombol **Konfirmasi Pembayaran via WhatsApp** (otomatis mengisi nomor pesanan, nama, dan email) serta akses instalasi aplikasi.

## 2. Cara Mengaktifkan Midtrans Otomatis (Saat Akun Midtrans Sudah Jadi)
Begitu akun Midtrans Anda sudah selesai diverifikasi:

1. Login ke [Dashboard Midtrans (MAP)](https://dashboard.midtrans.com/).
2. Buka menu **Settings > Access Keys**, lalu salin **Server Key** dan **Client Key**.
3. Buka file [`api/config.php`](./config.php) di hosting Anda, lalu isi kedua baris berikut:
   ```php
   'midtrans_is_production' => false, // Ubah ke true jika memakai kunci Production (Live)
   'midtrans_server_key'    => 'SB-Mid-server-XXXXXXXXXXXXXXXX',
   'midtrans_client_key'    => 'SB-Mid-client-XXXXXXXXXXXXXXXX',
   ```
4. Buka menu **Settings > Configuration** di Dashboard Midtrans, lalu isi **Payment Notification URL** dengan:
   ```text
   https://domainanda.com/api/midtrans-webhook.php
   ```
5. Selesai! Halaman `checkout.html` akan otomatis memunculkan **Pop-up Midtrans Snap (QRIS, Virtual Account Bank, GoPay/ShopeePay)** dan memverifikasi tanda tangan kriptografis SHA-512 secara otomatis tanpa perlu mengubah kode HTML/JS sedikit pun.
