<?php
declare(strict_types=1);
// Run after loading server/DriveSyncService.php. No real Google requests are made.
if (!class_exists('SyncVault')) require_once dirname(__DIR__) . '/server/DriveSyncService.php';
$count = 0;
function check(bool $condition, string $message): void {
    global $count; if (!$condition) throw new RuntimeException($message); $count++;
}
function failure(callable $fn, string $reason): void {
    try { $fn(); } catch (SyncFailure $error) { check($error->reason === $reason, 'Expected ' . $reason . ', got ' . $error->reason); return; }
    throw new RuntimeException('Expected failure: ' . $reason);
}
$directory = sys_get_temp_dir() . '/aigb-sync-test-' . bin2hex(random_bytes(8));
$key = random_bytes(32);
$vault = new SyncVault($directory, $key);
$calls = []; $cloud = null; $manual = null; $lost = false; $refreshFailure = false; $allocated = 0;
$plan = ['startingBalance' => 1000, 'lastRefreshDate' => '2026-10-28', 'projectionDays' => 30,
    'thresholds' => ['red' => 100, 'yellow' => 200, 'green' => 300], 'recurringRules' => [], 'skippedInstances' => []];
$vault->put('alice', ['refresh' => 'private-refresh', 'access' => 'access', 'expires' => time() + 600, 'email' => 'alice@example.test', 'folder' => 'folder']);
$http = function ($method, $url, $headers, $body) use (&$calls, &$cloud, &$manual, &$lost, &$refreshFailure, &$allocated): array {
    $calls[] = [$method, $url];
    if (str_contains($url, '/token')) return $refreshFailure ? ['status' => 400, 'data' => ['error' => 'invalid_grant']] :
        ['status' => 200, 'data' => ['access_token' => 'new-access', 'expires_in' => 3600]];
    if (str_contains($url, 'generateIds')) return ['status' => 200, 'data' => ['ids' => [++$allocated === 1 ? 'current-id' : 'backup-id']]];
    if (str_contains($url, '/folder?')) return ['status' => 200, 'data' => ['id' => 'folder', 'mimeType' => 'application/vnd.google-apps.folder', 'trashed' => false]];
    if (str_contains($url, 'uploadType=multipart')) {
        $pieces = explode("\r\nContent-Type: application/json\r\n\r\n", $body);
        $data = json_decode(explode("\r\n--", $pieces[1])[0], true, 64, JSON_THROW_ON_ERROR);
        if (isset($data['version'])) $manual = $data; else $cloud = $data;
        if ($lost) { $lost = false; throw new SyncFailure('temporary'); }
        return ['status' => 200, 'data' => ['id' => 'current-id']];
    }
    if (str_contains($url, 'uploadType=media')) {
        $cloud = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
        if ($lost) { $lost = false; throw new SyncFailure('temporary'); }
        return ['status' => 200, 'data' => ['id' => 'current-id']];
    }
    if (str_contains($url, '/current-id?alt=media')) return ['status' => $cloud ? 200 : 404, 'data' => $cloud];
    if (str_contains($url, '/backup-id?alt=media')) return ['status' => $manual ? 200 : 404, 'data' => $manual];
    if (str_contains($url, '/current-id?')) return ['status' => $cloud ? 200 : 404, 'data' => ['id' => 'current-id', 'trashed' => false]];
    if (str_contains($url, '/backups-folder?')) return ['status' => 200, 'data' => ['id' => 'backups-folder', 'mimeType' => 'application/vnd.google-apps.folder', 'trashed' => false]];
    if ($method === 'POST' && str_contains($url, '/drive/v3/files?fields=id')) return ['status' => 200, 'data' => ['id' => 'backups-folder']];
    if (str_contains($url, '?q=')) {
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        if (str_contains($query['q'], "value='manual-backup-folder'")) return ['status' => 200, 'data' => ['files' => []]];
        if (str_contains($query['q'], "value='manual-backup'")) return ['status' => 200, 'data' => ['files' => $manual ? [['id' => 'backup-id']] : []]];
        return ['status' => 200, 'data' => ['files' => $cloud ? [['id' => 'current-id']] : []]];
    }
    throw new RuntimeException('Unexpected mock request: ' . $method . ' ' . $url);
};
$service = new DriveSyncService(['client_id' => 'client', 'client_secret' => 'secret', 'redirect_uri' => 'https://example.test/callback'], $vault, $http);
try {
    check(DriveSyncService::validPlan($plan), 'Valid plan accepted');
    $invalid = $plan; $invalid['lastRefreshDate'] = '2026-02-30';
    check(!DriveSyncService::validPlan($invalid), 'Impossible dates rejected');
    $invalid = $plan; $invalid['thresholds'] = 'invalid'; check(!DriveSyncService::validPlan($invalid), 'Bad thresholds rejected');
    check(!str_contains(file_get_contents($directory . '/accounts.sqlite'), 'private-refresh'), 'Refresh token encrypted at rest');
    check(!str_contains(file_get_contents($directory . '/accounts.sqlite'), 'alice@example.test'), 'Account email encrypted at rest');
    check((fileperms($directory . '/accounts.sqlite') & 0777) === 0600, 'Database permissions private');
    $empty = $service->read('alice'); check($empty['plan'] === null && $empty['revision'] === null, 'New account starts empty');
    check(count(array_filter($calls, fn($call) => $call[0] === 'POST')) === 0, 'Read creates no files');
    $request = ['accountId' => 'alice', 'expectedRevision' => null, 'operationId' => 'operation-0001', 'plan' => $plan];
    $first = $service->write('alice', $request);
    check($first['plan']['startingBalance'] === 1000, 'First write acknowledged');
    check(str_contains(json_encode($first), '"skippedInstances":{}'), 'Empty map remains a JSON object');
    $writeCount = count(array_filter($calls, fn($call) => $call[0] === 'POST' || $call[0] === 'PATCH'));
    $again = $service->write('alice', $request);
    check($again['revision'] === $first['revision'], 'Duplicate operation acknowledged');
    check(count(array_filter($calls, fn($call) => $call[0] === 'POST' || $call[0] === 'PATCH')) === $writeCount, 'Retry creates no additional cloud writes');
    $next = $request; $next['operationId'] = 'operation-0002'; $next['plan']['startingBalance'] = 1200;
    failure(fn() => $service->write('alice', $next), 'conflict');
    check($cloud['plan']['startingBalance'] === 1000, 'Stale write leaves cloud unchanged');
    $next['expectedRevision'] = $first['revision']; $second = $service->write('alice', $next);
    check($second['revision'] !== $first['revision'], 'Changed content gets a new revision');
    check($cloud['recovery'][0]['plan']['startingBalance'] === 1000, 'Previous plan preserved in bounded recovery');
    $wrong = $next; $wrong['accountId'] = 'bob'; failure(fn() => $service->write('alice', $wrong), 'account');
    $bad = $next; $bad['plan']['startingBalance'] = '1200'; failure(fn() => $service->write('alice', $bad), 'invalid');
    for ($i = 3; $i <= 8; $i++) {
        $next['expectedRevision'] = $second['revision']; $next['operationId'] = 'operation-000' . $i;
        $next['plan']['startingBalance'] = 1200 + $i; $second = $service->write('alice', $next);
    }
    check(count($cloud['recovery']) === 3, 'Recovery history bounded to three previous versions');
    $recovery = $service->recovery('alice');
    check(count($recovery['versions']) === 3 && $recovery['accountId'] === 'alice', 'Recovery read is bounded and account-bound');
    check($vault->locked('alice', fn() => $vault->locked('other', fn() => true)) === true, 'Different accounts have independent locks');
    failure(fn() => $vault->locked('alice', fn() => $vault->locked('alice', fn() => true)), 'busy');
    $lost = true; $next['expectedRevision'] = $second['revision']; $next['operationId'] = 'operation-0009'; $next['plan']['startingBalance'] = 1300;
    failure(fn() => $service->write('alice', $next), 'temporary');
    check($service->write('alice', $next)['plan']['startingBalance'] === 1300, 'Lost acknowledgement retries idempotently');
    $snapshot = ['accountId' => 'alice', 'operationId' => 'snapshot-0001', 'plan' => $plan];
    $backup = $service->backup('alice', $snapshot);
    check($backup['accountId'] === 'alice', 'Manual backup bound to account');
    check($cloud['plan']['startingBalance'] === 1300, 'Manual snapshot does not replace current sync file');
    check($manual['data']['startingBalance'] === 1000 && $manual['version'] === 3, 'Manual snapshot uses import-compatible format');
    check($service->latestBackup('alice')['backup']['data']['startingBalance'] === 1000, 'Newest manual backup remains discoverable');
    $account = $vault->get('alice'); $account['expires'] = 0; $vault->put('alice', $account);
    check($service->read('alice')['plan']['startingBalance'] === 1300, 'Expired access refreshes server-side');
    $account = $vault->get('alice'); $account['expires'] = 0; $vault->put('alice', $account); $refreshFailure = true;
    failure(fn() => $service->read('alice'), 'auth'); $refreshFailure = false;
    $service->disconnect('alice'); check($vault->get('alice') === null, 'Disconnect removes stored credentials');
    check($cloud['plan']['startingBalance'] === 1300, 'Disconnect retains Drive data');
    failure(fn() => $service->read('alice'), 'auth');
    $cloud = null;
    $vault->put('legacy-account', ['refresh' => 'refresh', 'access' => 'access', 'expires' => time() + 600, 'email' => 'legacy@example.test', 'folder' => 'folder']);
    $beforeLegacy = count($calls);
    $legacy = $service->read('legacy-account');
    check($legacy['plan']['startingBalance'] === 1000, 'Returning manual-backup user discovers the existing plan');
    check(str_starts_with($legacy['revision'], 'legacy:backup-id:'), 'Manual baseline has an account-service version');
    check(count(array_filter(array_slice($calls, $beforeLegacy), fn($call) => $call[0] !== 'GET')) === 0, 'Discovering an old backup makes no Drive writes');
    $migrate = ['accountId' => 'legacy-account', 'expectedRevision' => null, 'operationId' => 'migrate-0001', 'plan' => $plan];
    failure(fn() => $service->write('legacy-account', $migrate), 'conflict');
    $migrate['expectedRevision'] = $legacy['revision'];
    $manual['data']['startingBalance'] = 1050;
    failure(fn() => $service->write('legacy-account', $migrate), 'conflict');
    $latestLegacy = $service->read('legacy-account');
    $migrate['expectedRevision'] = $latestLegacy['revision']; $migrate['plan']['startingBalance'] = 1100;
    $migrated = $service->write('legacy-account', $migrate);
    check($migrated['plan']['startingBalance'] === 1100, 'First change creates a separate current sync plan');
    check($manual['data']['startingBalance'] === 1050, 'Migration retains the original manual backup unchanged');
    check($cloud['recovery'][0]['plan']['startingBalance'] === 1050, 'Original manual candidate enters current-plan recovery');
    $cloud = null; $allocated = 0;
    $vault->put('connect-account', ['refresh' => 'refresh', 'access' => 'access', 'expires' => time() + 600, 'email' => 'connect@example.test', 'folder' => 'folder']);
    $connected = $service->setup('connect-account');
    check($connected['folderUrl'] === 'https://drive.google.com/drive/folders/folder', 'Connect returns the app folder');
    check($cloud['plan']['startingBalance'] === 1050, 'Connect places the existing cloud plan in a separate working file immediately');
    check($manual['data']['startingBalance'] === 1050, 'Connecting retains the older backup');
    $afterSetup = count($calls);
    $service->setup('connect-account');
    check(count(array_filter(array_slice($calls, $afterSetup), fn($call) => $call[0] !== 'GET')) === 0, 'Repeated connect creates no extra Drive writes');
    $manual = null;
    $cloud = null; $allocated = 0; $lost = true;
    $vault->put('new-account', ['refresh' => 'refresh-new', 'access' => 'access', 'expires' => time() + 600, 'email' => 'new@example.test', 'folder' => 'folder']);
    $create = ['accountId' => 'new-account', 'expectedRevision' => null, 'operationId' => 'create-00001', 'plan' => $plan];
    failure(fn() => $service->write('new-account', $create), 'temporary');
    $afterLostCreate = $service->write('new-account', $create);
    check($afterLostCreate['plan']['startingBalance'] === 1000 && $allocated === 1, 'Lost initial create reuses one Drive file');
    failure(fn() => $service->recreate('new-account', ['accountId' => 'new-account', 'confirmed' => false]), 'consent');
    failure(fn() => $service->recreate('new-account', ['accountId' => 'new-account', 'confirmed' => true]), 'conflict');
    $cloud = null;
    $replacement = $service->recreate('new-account', ['accountId' => 'new-account', 'confirmed' => true]);
    check($replacement['accountId'] === 'new-account' && !isset($vault->get('new-account')['current']), 'Missing destination can be replaced explicitly');
    check(count(array_filter($calls, fn($call) => $call[0] === 'DELETE')) === 0, 'Replacement never deletes existing Drive data');
    $authMode = 'ok';
    $authHttp = function ($method, $url, $headers, $body) use (&$authMode): array {
        if (str_contains($url, '/token')) {
            parse_str($body, $form);
            check(($form['code_verifier'] ?? '') === 'test-verifier', 'Authorization code uses the PKCE verifier');
            $tokens = ['access_token' => 'test-access', 'expires_in' => 3600,
                'scope' => $authMode === 'no-scope' ? 'openid email' : DriveSyncService::SCOPE];
            if ($authMode !== 'no-refresh') $tokens['refresh_token'] = 'test-offline-refresh';
            return ['status' => 200, 'data' => $tokens];
        }
        return ['status' => 200, 'data' => ['sub' => $authMode === 'no-refresh' ? 'auth-without-refresh' : 'auth-test',
            'email' => 'verified@example.test', 'email_verified' => $authMode !== 'unverified']];
    };
    $authService = new DriveSyncService(['client_id' => 'client', 'client_secret' => 'secret', 'redirect_uri' => 'https://example.test/callback'], $vault, $authHttp);
    $identity = $authService->exchange('test-code', 'test-verifier');
    check($identity['accountId'] === 'auth-test', 'Identity comes from verified userinfo');
    check(!isset($identity['refresh_token']) && !isset($identity['access_token']), 'OAuth tokens never returned as browser identity');
    check($vault->get('auth-test')['refresh'] === 'test-offline-refresh', 'Offline connection retained only in the vault');
    $authMode = 'unverified'; failure(fn() => $authService->exchange('test-code', 'test-verifier'), 'auth');
    $authMode = 'no-scope'; failure(fn() => $authService->exchange('test-code', 'test-verifier'), 'auth');
    $authMode = 'no-refresh'; failure(fn() => $authService->exchange('test-code', 'test-verifier'), 'offline_access');
    echo "Drive service: $count assertions passed; no real Google requests.\n";
} finally {
    foreach (glob($directory . '/*') as $file) unlink($file);
    rmdir($directory);
}
