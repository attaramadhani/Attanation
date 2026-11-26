# Server akun ATTA DocStudio Pro

API kecil untuk akun opsional (nama dan email saja). Dokumen pengguna tidak pernah
dikirim ke server ini.

## Isi folder

| File | Fungsi |
|---|---|
| `account.php` | Semua endpoint: `?action=register`, `login`, `me`, `update`, `logout`, `delete` |
| `schema.sql` | Tabel MySQL: `users`, `sessions`, `login_attempts` |
| `config.example.php` | Contoh konfigurasi; salin menjadi `config.php` |
| `.htaccess` | Menutup akses langsung ke `config.php` dan `schema.sql` (Apache) |

## Cara pasang di hosting (cPanel / hosting PHP biasa)

1. Buat database MySQL dan user-nya di panel hosting.
2. Buka phpMyAdmin, pilih database itu, lalu impor `schema.sql`.
3. Unggah folder ini, misalnya ke `public_html/docstudio-api/`.
4. Salin `config.example.php` menjadi `config.php`, lalu isi:
   - `db_dsn`, `db_user`, `db_pass` sesuai database.
   - `allowed_origins`: alamat tempat aplikasi DocStudio dibuka, misalnya
     `https://docstudio.attanation.com`. Untuk APK berbasis TWA, isi dengan
     domain PWA-nya.
5. Pastikan hosting memakai HTTPS dan PHP 8.0 atau lebih baru.
6. Buka `js/config.js` di folder aplikasi dan isi:
   ```js
   window.ATTA_CONFIG = {
     accountApi: 'https://domainmu.com/docstudio-api/account.php'
   };
   ```
7. Naikkan nomor versi (lihat DESIGN.md) agar pengguna lama mendapat `config.js` baru.

## Keamanan yang sudah ada

- Kata sandi disimpan dengan `password_hash` (bcrypt/argon2 sesuai PHP).
- Token sesi 64 karakter acak; yang disimpan di database hanya hash SHA-256-nya.
  Sesi berlaku 90 hari (ubah di `session_days`).
- Batas percobaan gagal: 10 per email dan 50 per IP dalam 15 menit.
- Semua query memakai prepared statement.
- Hanya origin yang terdaftar yang boleh memanggil API (CORS).
- Pengguna bisa menghapus akunnya sendiri dari aplikasi (wajib untuk Google Play).

## Lupa kata sandi

Belum ada reset lewat email (butuh SMTP). Pengguna diarahkan ke WhatsApp. Untuk
mengatur ulang secara manual:

```bash
php -r "echo password_hash('SandiBaruSementara123', PASSWORD_DEFAULT), PHP_EOL;"
```

Lalu di phpMyAdmin:

```sql
UPDATE users SET password_hash = 'HASIL_DI_ATAS' WHERE email = 'email@pengguna.com';
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'email@pengguna.com');
```

Minta pengguna masuk dengan sandi sementara itu.
