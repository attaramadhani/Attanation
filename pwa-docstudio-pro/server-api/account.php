<?php
/**
 * ATTA DocStudio Pro — API akun (profil saja).
 * Satu file, dipanggil dengan ?action=register|login|me|update|logout|delete
 * Dokumen pengguna TIDAK pernah dikirim ke server ini.
 */
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

/* ---------- CORS ---------- */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['allowed_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Max-Age: 600');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $code, string $message): void
{
    respond($status, ['ok' => false, 'error' => $code, 'message' => $message]);
}

function now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function public_user(array $u): array
{
    return ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'created_at' => $u['created_at']];
}

try {
    $pdo = new PDO($config['db_dsn'], $config['db_user'] ?? null, $config['db_pass'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    fail(500, 'db_unavailable', 'Server akun sedang bermasalah. Coba lagi nanti.');
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

function too_many_attempts(PDO $pdo, string $ip, string $email): bool
{
    // Per email 10 kali gagal, per IP 50 kali gagal (banyak pengguna seluler berbagi IP), dalam 15 menit
    $since = gmdate('Y-m-d H:i:s', time() - 15 * 60);
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND created_at > ?');
    $st->execute([$email, $since]);
    if ((int)$st->fetchColumn() >= 10) return true;
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND created_at > ?');
    $st->execute([$ip, $since]);
    return (int)$st->fetchColumn() >= 50;
}

function record_attempt(PDO $pdo, string $ip, string $email): void
{
    $pdo->prepare('INSERT INTO login_attempts (ip, email, created_at) VALUES (?, ?, ?)')->execute([$ip, $email, now()]);
}

function create_session(PDO $pdo, int $userId, int $days): string
{
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)')
        ->execute([$userId, hash('sha256', $token), now(), gmdate('Y-m-d H:i:s', time() + $days * 86400)]);
    return $token;
}

function current_user(PDO $pdo): ?array
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $auth, $m)) {
        return null;
    }
    $st = $pdo->prepare(
        'SELECT u.*, s.id AS session_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
    );
    $st->execute([hash('sha256', $m[1]), now()]);
    $row = $st->fetch();
    return $row ?: null;
}

function clean_name(string $name): string
{
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    return mb_substr($name, 0, 80);
}

set_exception_handler(function (Throwable $e): void {
    error_log('DocStudio API: ' . $e->getMessage());
    fail(500, 'server', 'Terjadi kesalahan di server akun. Coba lagi nanti.');
});

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = input();

switch ($action) {
    case 'register':
        if ($method !== 'POST') fail(405, 'method', 'Metode tidak didukung.');
        $name = clean_name((string)($body['name'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if (mb_strlen($name) < 2) fail(422, 'name', 'Nama minimal 2 huruf.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'email', 'Format email tidak valid.');
        if (strlen($password) < 8) fail(422, 'password', 'Kata sandi minimal 8 karakter.');
        if (too_many_attempts($pdo, $ip, $email)) fail(429, 'rate', 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
        $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([$email]);
        if ($st->fetch()) {
            record_attempt($pdo, $ip, $email);
            fail(409, 'exists', 'Email ini sudah terdaftar. Silakan masuk.');
        }
        $pdo->prepare('INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), now(), now()]);
        $id = (int)$pdo->lastInsertId();
        $token = create_session($pdo, $id, (int)$config['session_days']);
        $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
        respond(201, ['ok' => true, 'token' => $token, 'user' => public_user($st->fetch())]);

    case 'login':
        if ($method !== 'POST') fail(405, 'method', 'Metode tidak didukung.');
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if (too_many_attempts($pdo, $ip, $email)) fail(429, 'rate', 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
        $st = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([$email]);
        $user = $st->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            record_attempt($pdo, $ip, $email);
            fail(401, 'credentials', 'Email atau kata sandi salah.');
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        $token = create_session($pdo, (int)$user['id'], (int)$config['session_days']);
        respond(200, ['ok' => true, 'token' => $token, 'user' => public_user($user)]);

    case 'me':
        $user = current_user($pdo);
        if (!$user) fail(401, 'session', 'Sesi berakhir. Silakan masuk lagi.');
        respond(200, ['ok' => true, 'user' => public_user($user)]);

    case 'update':
        if ($method !== 'POST') fail(405, 'method', 'Metode tidak didukung.');
        $user = current_user($pdo);
        if (!$user) fail(401, 'session', 'Sesi berakhir. Silakan masuk lagi.');
        $name = clean_name((string)($body['name'] ?? ''));
        if (mb_strlen($name) < 2) fail(422, 'name', 'Nama minimal 2 huruf.');
        $pdo->prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?')->execute([$name, now(), $user['id']]);
        $user['name'] = $name;
        respond(200, ['ok' => true, 'user' => public_user($user)]);

    case 'logout':
        if ($method !== 'POST') fail(405, 'method', 'Metode tidak didukung.');
        $user = current_user($pdo);
        if ($user) $pdo->prepare('DELETE FROM sessions WHERE id = ?')->execute([$user['session_id']]);
        respond(200, ['ok' => true]);

    case 'delete':
        if ($method !== 'POST') fail(405, 'method', 'Metode tidak didukung.');
        $user = current_user($pdo);
        if (!$user) fail(401, 'session', 'Sesi berakhir. Silakan masuk lagi.');
        if (!password_verify((string)($body['password'] ?? ''), $user['password_hash'])) {
            record_attempt($pdo, $ip, $user['email']);
            fail(401, 'credentials', 'Kata sandi salah.');
        }
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]);
        respond(200, ['ok' => true]);

    default:
        fail(404, 'action', 'Permintaan tidak dikenal.');
}
