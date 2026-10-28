<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/server/DriveSyncService.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Referrer-Policy: no-referrer');

function sync_reply(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}
function sync_csrf(): void {
    if (!is_string($_SERVER['HTTP_X_SYNC_CSRF'] ?? null) ||
        !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_SYNC_CSRF'])) throw new SyncFailure('csrf', 403);
}
function sync_body(): array {
    if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') throw new SyncFailure('invalid', 415);
    $body = file_get_contents('php://input', false, null, 0, 220001);
    if ($body === false || strlen($body) > 220000) throw new SyncFailure('invalid', 413);
    $decoded = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) throw new SyncFailure('invalid', 422);
    return $decoded;
}
try {
    $action = $_GET['action'] ?? 'status';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = getenv('AIGB_SYNC_CONFIG') ?: dirname(__DIR__, 2) . '/.aigb-sync/config.php';
    $private = realpath($path);
    $public = realpath(dirname(__DIR__));
    if (!$private || str_starts_with($private, $public . DIRECTORY_SEPARATOR)) {
        if ($action === 'status') sync_reply(['available' => false]);
        throw new SyncFailure('unavailable', 503);
    }
    $config = require $private;
    if (!is_array($config) || ($config['enabled'] ?? false) !== true) {
        if ($action === 'status') sync_reply(['available' => false]);
        throw new SyncFailure('unavailable', 503);
    }
    if ((fileperms($private) & 0077) !== 0) throw new SyncFailure('configuration');
    $key = base64_decode($config['encryption_key'] ?? '', true);
    if (!$key || strlen($key) !== 32 || empty($config['client_id']) || empty($config['client_secret'])) throw new SyncFailure('configuration');
    $origin = rtrim($config['origin'] ?? '', '/');
    if (!preg_match('#^https://[a-z0-9.-]+$#D', $origin) ||
        $origin !== 'https://' . ($_SERVER['HTTP_HOST'] ?? '') ||
        ($_SERVER['HTTPS'] ?? '') !== 'on' ||
        ($config['redirect_uri'] ?? '') !== $origin . '/api/drive-sync.php?action=callback') throw new SyncFailure('origin', 403);
    if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] !== $origin) throw new SyncFailure('origin', 403);
    $directory = $config['state_directory'] ?? '';
    if (!is_string($directory) || !str_starts_with($directory, '/') || str_contains($directory, '..') ||
        !is_dir(dirname($directory)) || str_starts_with(realpath(dirname($directory)) . '/' . basename($directory) . '/', $public . '/')) throw new SyncFailure('configuration');
    if (is_dir($directory) && str_starts_with(realpath($directory) . '/', $public . '/')) throw new SyncFailure('configuration');
    $vault = new SyncVault($directory, $key);
    if (!is_dir($directory . '/sessions')) mkdir($directory . '/sessions', 0700);
    session_save_path($directory . '/sessions');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '2592000');
    session_name('__Host-aigb_sync');
    session_set_cookie_params(['lifetime' => 2592000, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    $service = new DriveSyncService($config, $vault);

    if ($method === 'GET' && $action === 'callback') {
        $pending = $_SESSION['oauth'] ?? null;
        unset($_SESSION['oauth']);
        if (!is_array($pending) || time() - $pending['at'] > 600 || !is_string($_GET['state'] ?? null) ||
            !hash_equals($pending['state'], $_GET['state'])) throw new SyncFailure('csrf', 403);
        $return = $origin . '/?' . (!empty($pending['preview']) ? 'drive-sync=preview&' : '') . 'sync=';
        if (isset($_GET['error'])) {
            header('Location: ' . $return . 'cancelled', true, 303); exit;
        }
        $code = $_GET['code'] ?? '';
        if (!is_string($code) || strlen($code) > 4096 || $code === '') throw new SyncFailure('auth', 401);
        try {
            $identity = $service->exchange($code, $pending['verifier']);
            session_regenerate_id(true);
            $_SESSION['account'] = $identity['accountId'];
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            header('Location: ' . $return . 'connected', true, 303); exit;
        } catch (Throwable $error) {
            header('Location: ' . $return . 'failed', true, 303); exit;
        }
    }
    if ($method === 'GET' && $action === 'status') {
        $subject = $_SESSION['account'] ?? null;
        $account = is_string($subject) ? $vault->get($subject) : null;
        $authenticated = $account && !empty($account['refresh']);
        sync_reply(['available' => true, 'authenticated' => (bool) $authenticated, 'csrf' => $_SESSION['csrf'],
            'accountId' => $authenticated ? $subject : null, 'email' => $authenticated ? $account['email'] : null,
            'folderUrl' => $authenticated && !empty($account['folder']) ? 'https://drive.google.com/drive/folders/' . rawurlencode($account['folder']) : null]);
    }
    if ($method === 'POST') sync_csrf();
    if ($method === 'POST' && $action === 'authorize') {
        $input = sync_body();
        if (($input['disclosureAccepted'] ?? false) !== true) throw new SyncFailure('consent', 400);
        if (time() - ($_SESSION['auth_start'] ?? 0) < 5) throw new SyncFailure('busy', 429);
        $_SESSION['auth_start'] = time();
        $verifier = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        $state = bin2hex(random_bytes(32));
        $_SESSION['oauth'] = ['state' => $state, 'verifier' => $verifier, 'at' => time(), 'preview' => ($input['preview'] ?? false) === true];
        sync_reply(['url' => 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $config['client_id'], 'redirect_uri' => $config['redirect_uri'], 'response_type' => 'code',
            'scope' => DriveSyncService::SCOPE, 'access_type' => 'offline', 'prompt' => 'consent select_account',
            'state' => $state, 'code_challenge_method' => 'S256',
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
        ])]);
    }
    $subject = $_SESSION['account'] ?? null;
    if (!is_string($subject)) throw new SyncFailure('auth', 401);
    session_write_close(); // Account lock, not the browser session lock, coordinates devices.
    if ($method === 'POST' && $action === 'setup') { sync_body(); sync_reply($service->setup($subject)); }
    if ($method === 'GET' && $action === 'plan') sync_reply($service->read($subject));
    if ($method === 'POST' && $action === 'plan') sync_reply($service->write($subject, sync_body()));
    if ($method === 'GET' && $action === 'recovery') sync_reply($service->recovery($subject));
    if ($method === 'POST' && $action === 'recreate') sync_reply($service->recreate($subject, sync_body()));
    if ($method === 'POST' && $action === 'disconnect') {
        sync_body(); $service->disconnect($subject); sync_reply(['disconnected' => true]);
    }
    throw new SyncFailure('not_found', 404);
} catch (SyncFailure $error) {
    sync_reply(['error' => $error->reason], $error->httpStatus);
} catch (JsonException $error) {
    sync_reply(['error' => 'invalid'], 422);
} catch (Throwable $error) {
    // No request, plan, token, email, or upstream response is logged by this endpoint.
    sync_reply(['error' => 'temporary'], 503);
}
