<?php
declare(strict_types=1);

// No request handler here. The public entry point is api/drive-sync.php.
final class SyncFailure extends RuntimeException
{
    public function __construct(public readonly string $reason, public readonly int $httpStatus = 503)
    {
        parent::__construct($reason); // Never include Google response bodies or credentials in errors.
    }
}

final class SyncVault
{
    private PDO $db;
    public function __construct(private readonly string $directory, private readonly string $key)
    {
        if (strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) throw new SyncFailure('configuration');
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new SyncFailure('configuration');
        chmod($directory, 0700);
        $this->db = new PDO('sqlite:' . $directory . '/accounts.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        chmod($directory . '/accounts.sqlite', 0600);
        $this->db->exec('PRAGMA busy_timeout=5000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS accounts (subject TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    }
    public function get(string $subject): ?array
    {
        $query = $this->db->prepare('SELECT payload FROM accounts WHERE subject = ?');
        $query->execute([$subject]);
        $value = $query->fetchColumn();
        if ($value === false) return null;
        $binary = base64_decode($value, true);
        if ($binary === false) throw new SyncFailure('storage');
        $json = sodium_crypto_secretbox_open(substr($binary, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), substr($binary, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $this->key);
        if ($json === false) throw new SyncFailure('storage');
        return json_decode($json, true, 64, JSON_THROW_ON_ERROR);
    }
    public function put(string $subject, array $value): void
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $sealed = base64_encode($nonce . sodium_crypto_secretbox(json_encode($value, JSON_THROW_ON_ERROR), $nonce, $this->key));
        $query = $this->db->prepare('INSERT INTO accounts(subject,payload) VALUES(?,?) ON CONFLICT(subject) DO UPDATE SET payload=excluded.payload');
        $query->execute([$subject, $sealed]);
    }
    public function remove(string $subject): void
    {
        $query = $this->db->prepare('DELETE FROM accounts WHERE subject = ?');
        $query->execute([$subject]);
    }
    public function locked(string $subject, callable $work): mixed
    {
        // All service writers for an account use this same lock, including OAuth/token refresh.
        $file = fopen($this->directory . '/' . hash_hmac('sha256', $subject, $this->key) . '.lock', 'c');
        if (!$file) throw new SyncFailure('storage');
        chmod(stream_get_meta_data($file)['uri'], 0600);
        try {
            $until = microtime(true) + 2;
            do {
                if (flock($file, LOCK_EX | LOCK_NB)) {
                    try { return $work(); } finally { flock($file, LOCK_UN); }
                }
                usleep(20000);
            } while (microtime(true) < $until);
            throw new SyncFailure('busy', 429);
        } finally { fclose($file); }
    }
}

final class SyncHttp
{
    public static function request(string $method, string $url, array $headers = [], ?string $body = null): array
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (parse_url($url, PHP_URL_SCHEME) !== 'https' || !in_array($host, ['oauth2.googleapis.com', 'www.googleapis.com', 'openidconnect.googleapis.com'], true)) {
            throw new SyncFailure('configuration');
        }
        $curl = curl_init($url);
        $response = '';
        curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 25, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$response): int {
                if (strlen($response) + strlen($chunk) > 1200000) return 0;
                $response .= $chunk; return strlen($chunk);
            }]);
        if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        $success = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        if ($success === false) throw new SyncFailure('temporary');
        $data = json_decode($response, true);
        return ['status' => $status, 'data' => $data];
    }
}

final class DriveSyncService
{
    private const DRIVE = 'https://www.googleapis.com/drive/v3/files';
    public const SCOPE = 'openid email https://www.googleapis.com/auth/drive.file';
    private Closure $http;
    public function __construct(private readonly array $config, private readonly SyncVault $vault, ?callable $http = null)
    {
        $this->http = Closure::fromCallable($http ?? [SyncHttp::class, 'request']);
    }
    public static function validPlan(mixed $plan): bool
    {
        if (!is_array($plan) || !isset($plan['startingBalance'], $plan['lastRefreshDate'], $plan['projectionDays'], $plan['thresholds'], $plan['recurringRules'])) return false;
        $number = static fn($v) => (is_int($v) || is_float($v)) && is_finite((float) $v);
        $date = static function ($v): bool {
            if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $v)) return false;
            [$year, $month, $day] = array_map('intval', explode('-', $v));
            return checkdate($month, $day, $year);
        };
        if (!$number($plan['startingBalance']) || !$date($plan['lastRefreshDate']) || !in_array($plan['projectionDays'], [30,60,90,120,180,365], true)) return false;
        if (!is_array($plan['thresholds'])) return false;
        foreach (['red','yellow','green'] as $key) if (!$number($plan['thresholds'][$key] ?? null)) return false;
        if ($plan['thresholds']['red'] > $plan['thresholds']['yellow'] || $plan['thresholds']['yellow'] > $plan['thresholds']['green']) return false;
        if (!is_array($plan['recurringRules']) || !array_is_list($plan['recurringRules']) || count($plan['recurringRules']) > 500) return false;
        $ids = [];
        foreach ($plan['recurringRules'] as $rule) {
            if (!is_array($rule) || !is_string($rule['id'] ?? null) || $rule['id'] === '' || isset($ids[$rule['id']]) ||
                !is_string($rule['name'] ?? null) || trim($rule['name']) === '' || !$number($rule['amount'] ?? null) || $rule['amount'] < 0 ||
                !empty($rule['pendingSchedule']) || !in_array($rule['direction'] ?? '', ['credit','debit'], true) ||
                !in_array($rule['scheduleType'] ?? '', ['weekly','biweekly','monthly','adhoc'], true)) return false;
            $ids[$rule['id']] = true;
            foreach (['startDate','endDate'] as $field) if (!empty($rule[$field]) && !$date($rule[$field])) return false;
            if (($rule['limitType'] ?? '') === 'date' && !empty($rule['startDate']) && !empty($rule['endDate']) && $rule['startDate'] > $rule['endDate']) return false;
            if ($rule['scheduleType'] === 'monthly' && (!is_int($rule['dayOfMonth'] ?? null) || $rule['dayOfMonth'] < 1 || $rule['dayOfMonth'] > 31)) return false;
            if (in_array($rule['scheduleType'], ['weekly','biweekly'], true) && (!is_int($rule['dayOfWeek'] ?? null) || $rule['dayOfWeek'] < 0 || $rule['dayOfWeek'] > 6)) return false;
            if (in_array($rule['scheduleType'], ['adhoc','biweekly'], true) && !$date($rule['scheduleDate'] ?? null)) return false;
            if (($rule['limitType'] ?? '') === 'count' && (!is_int($rule['instanceLimit'] ?? null) || $rule['instanceLimit'] < 1)) return false;
            if (($rule['limitType'] ?? '') === 'count' && !in_array($rule['scheduleType'], ['biweekly','adhoc'], true) && !$date($rule['startDate'] ?? null)) return false;
            if (($rule['limitType'] ?? '') === 'date' && !$date($rule['endDate'] ?? null)) return false;
        }
        if (strlen(json_encode($plan, JSON_THROW_ON_ERROR)) > 200000) return false;
        return true;
    }
    private static function canonical(mixed $value): mixed
    {
        if (is_object($value)) {
            $properties = get_object_vars($value); ksort($properties);
            return (object) array_map([self::class, 'canonical'], $properties);
        }
        if (!is_array($value)) return $value;
        if (!array_is_list($value)) ksort($value);
        return array_map([self::class, 'canonical'], $value);
    }
    private static function hash(array $value): string
    {
        return hash('sha256', json_encode(self::canonical($value), JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }
    private static function normalizePlan(array $plan): array
    {
        // Preserve the JSON object type of an empty exclusion map across PHP decoding.
        $plan['skippedInstances'] = (object) ($plan['skippedInstances'] ?? []);
        return $plan;
    }
    public function exchange(string $code, string $verifier): array
    {
        $result = ($this->http)('POST', 'https://oauth2.googleapis.com/token', ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
            'client_id' => $this->config['client_id'], 'client_secret' => $this->config['client_secret'],
            'redirect_uri' => $this->config['redirect_uri'], 'grant_type' => 'authorization_code',
            'code' => $code, 'code_verifier' => $verifier,
        ]));
        $tokens = $result['data'];
        if ($result['status'] !== 200 || !is_string($tokens['access_token'] ?? null)) throw new SyncFailure('auth', 401);
        $scopes = explode(' ', (string) ($tokens['scope'] ?? ''));
        if (!in_array('https://www.googleapis.com/auth/drive.file', $scopes, true)) throw new SyncFailure('auth', 401);
        $profile = ($this->http)('GET', 'https://openidconnect.googleapis.com/v1/userinfo', ['Authorization: Bearer ' . $tokens['access_token']], null);
        $identity = $profile['data'];
        if ($profile['status'] !== 200 || !is_string($identity['sub'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $identity['sub']) ||
            !is_string($identity['email'] ?? null) || ($identity['email_verified'] ?? false) !== true) throw new SyncFailure('auth', 401);
        $this->vault->locked($identity['sub'], function () use ($identity, $tokens): void {
            $record = $this->vault->get($identity['sub']) ?? [];
            $record['refresh'] = $tokens['refresh_token'] ?? ($record['refresh'] ?? null);
            if (!$record['refresh']) throw new SyncFailure('offline_access', 401);
            $record['access'] = $tokens['access_token'];
            $record['expires'] = time() + min(7200, (int) ($tokens['expires_in'] ?? 0)) - 60;
            $record['email'] = $identity['email'];
            $this->vault->put($identity['sub'], $record);
        });
        return ['accountId' => $identity['sub'], 'email' => $identity['email']];
    }
    private function token(string $subject, array &$account): string
    {
        if (($account['expires'] ?? 0) > time() && !empty($account['access'])) return $account['access'];
        if (empty($account['refresh'])) throw new SyncFailure('auth', 401);
        $result = ($this->http)('POST', 'https://oauth2.googleapis.com/token', ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
            'client_id' => $this->config['client_id'], 'client_secret' => $this->config['client_secret'],
            'grant_type' => 'refresh_token', 'refresh_token' => $account['refresh'],
        ]));
        if ($result['status'] === 400 || $result['status'] === 401) throw new SyncFailure('auth', 401);
        if ($result['status'] !== 200 || empty($result['data']['access_token'])) throw new SyncFailure('temporary');
        $account['access'] = $result['data']['access_token'];
        $account['expires'] = time() + min(7200, (int) ($result['data']['expires_in'] ?? 0)) - 60;
        $this->vault->put($subject, $account);
        return $account['access'];
    }
    private function drive(string $subject, array &$account, string $method, string $url, array|string|null $body = null, array $headers = []): array
    {
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $contentType = $headers ?: ['Content-Type: application/json'];
            $result = ($this->http)($method, $url, array_merge(['Authorization: Bearer ' . $this->token($subject, $account)], $contentType),
                is_string($body) || $body === null ? $body : json_encode($body, JSON_THROW_ON_ERROR));
            $status = $result['status'];
            if ($status === 401 && $attempt === 0) { $account['expires'] = 0; continue; }
            if ($status >= 200 && $status < 300) return $result['data'] ?? [];
            if ($status === 404 || $status === 410) throw new SyncFailure('missing', 410);
            if ($status === 409 || $status === 412) throw new SyncFailure('conflict', 409);
            $reason = $result['data']['error']['errors'][0]['reason'] ?? '';
            if ($status === 403 && in_array($reason, ['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded'], true)) throw new SyncFailure('busy', 429);
            if ($status === 401 || $status === 403) throw new SyncFailure('auth', 401);
            throw new SyncFailure('temporary', $status === 429 ? 429 : 503);
        }
        throw new SyncFailure('auth', 401);
    }
    private function query(string $subject, array &$account, string $query): array
    {
        $data = $this->drive($subject, $account, 'GET', self::DRIVE . '?' . http_build_query([
            'q' => "trashed = false and appProperties has { key='app' and value='am-i-going-broke' } and " . $query,
            'pageSize' => 2, 'fields' => 'files(id,name)', 'spaces' => 'drive',
        ]));
        return $data['files'] ?? [];
    }
    private function id(string $id): string
    {
        if (!preg_match('/^[A-Za-z0-9_-]{1,256}$/D', $id)) throw new SyncFailure('remote', 422);
        return rawurlencode($id);
    }
    private function ensureFolder(string $subject, array &$account, string $key, string $purpose, string $name, ?string $parent = null): string
    {
        if (!empty($account[$key])) {
            $file = $this->drive($subject, $account, 'GET', self::DRIVE . '/' . $this->id($account[$key]) . '?fields=id,trashed,mimeType');
            if (!empty($file['trashed']) || ($file['mimeType'] ?? '') !== 'application/vnd.google-apps.folder') throw new SyncFailure('missing', 410);
            return $account[$key];
        }
        $query = "appProperties has { key='purpose' and value='$purpose' }";
        if ($parent !== null) $query .= " and '" . $this->id($parent) . "' in parents";
        $found = $this->query($subject, $account, $query);
        if (count($found) > 1) throw new SyncFailure('ambiguous', 409);
        if ($found) $id = $found[0]['id'];
        else {
            $meta = ['name' => $name, 'mimeType' => 'application/vnd.google-apps.folder', 'appProperties' => ['app' => 'am-i-going-broke', 'purpose' => $purpose]];
            if ($parent !== null) $meta['parents'] = [$parent];
            $id = $this->drive($subject, $account, 'POST', self::DRIVE . '?fields=id', $meta)['id'];
        }
        $account[$key] = $id;
        $this->vault->put($subject, $account);
        return $id;
    }
    public function account(string $subject): array
    {
        $account = $this->vault->get($subject);
        if (!$account || empty($account['refresh'])) throw new SyncFailure('auth', 401);
        return $account;
    }
    private function operation(string $subject, callable $work): mixed
    {
        return $this->vault->locked($subject, function () use ($subject, $work) {
            $account = $this->account($subject);
            $minute = intdiv(time(), 60);
            $count = ($account['minute'] ?? -1) === $minute ? (int) ($account['requests'] ?? 0) : 0;
            if ($count >= 90) throw new SyncFailure('busy', 429);
            $account['minute'] = $minute; $account['requests'] = $count + 1;
            $this->vault->put($subject, $account);
            return $work($account);
        });
    }
    public function setup(string $subject): array
    {
        return $this->operation($subject, function (array &$account) use ($subject): array {
            $folder = $this->ensureFolder($subject, $account, 'folder', 'sync-folder', 'Am I Going Broke?');
            return ['accountId' => $subject, 'folderUrl' => 'https://drive.google.com/drive/folders/' . $this->id($folder)];
        });
    }
    private function current(string $subject, array &$account): array
    {
        // Reads do not create a folder. Setup is a separate, deliberate action.
        if (empty($account['folder'])) throw new SyncFailure('setup', 409);
        $this->ensureFolder($subject, $account, 'folder', 'sync-folder', 'Am I Going Broke?');
        if (empty($account['current'])) {
            $files = $this->query($subject, $account, "appProperties has { key='purpose' and value='sync-current' } and '" . $this->id($account['folder']) . "' in parents");
            if (count($files) > 1) throw new SyncFailure('ambiguous', 409);
            if (!$files) {
                // Existing manual users are returning users too. Expose their latest
                // backup as a read-only baseline; never replace that backup on migration.
                $legacy = $this->manualBackup($subject, $account);
                if (!$legacy) return ['format' => 1, 'plan' => null, 'revision' => null, 'savedAt' => null];
                $data = $legacy['backup'];
                if (($data['version'] ?? 3) > 3 || !empty($data['data']['sampleScenario']) || !self::validPlan($data['data'] ?? null)) throw new SyncFailure('remote', 422);
                $plan = self::normalizePlan($data['data']);
                return ['format' => 1, 'plan' => $plan, 'revision' => 'legacy:' . $legacy['id'] . ':' . self::hash($plan),
                    'savedAt' => $data['exportedAt'] ?? $legacy['modifiedTime'], 'recovery' => []];
            }
            $account['current'] = $files[0]['id']; $this->vault->put($subject, $account);
        }
        $meta = $this->drive($subject, $account, 'GET', self::DRIVE . '/' . $this->id($account['current']) . '?fields=id,trashed');
        if (!empty($meta['trashed'])) throw new SyncFailure('missing', 410);
        $file = $this->drive($subject, $account, 'GET', self::DRIVE . '/' . $this->id($account['current']) . '?alt=media');
        if (($file['format'] ?? null) !== 1 || !self::validPlan($file['plan'] ?? null) || !is_string($file['savedAt'] ?? null)) throw new SyncFailure('remote', 422);
        $file['plan'] = self::normalizePlan($file['plan']);
        $file['revision'] = self::hash($file['plan']);
        return $file;
    }
    private function response(string $subject, array $file): array
    {
        return ['accountId' => $subject, 'plan' => $file['plan'], 'revision' => $file['revision'], 'savedAt' => $file['savedAt']];
    }
    public function read(string $subject): array
    {
        return $this->operation($subject, function (array &$account) use ($subject): array {
            return $this->response($subject, $this->current($subject, $account));
        });
    }
    public function write(string $subject, array $request): array
    {
        if (($request['accountId'] ?? null) !== $subject) throw new SyncFailure('account', 403);
        if (!self::validPlan($request['plan'] ?? null) || !is_string($request['operationId'] ?? null) ||
            !preg_match('/^[A-Za-z0-9:_-]{8,160}$/D', $request['operationId'])) throw new SyncFailure('invalid', 422);
        if (!array_key_exists('expectedRevision', $request)) throw new SyncFailure('invalid', 422);
        $request['plan'] = self::normalizePlan($request['plan']);
        return $this->operation($subject, function (array &$account) use ($subject, $request): array {
            $current = $this->current($subject, $account);
            $hash = self::hash($request['plan']);
            if (($current['operationId'] ?? null) === $request['operationId']) {
                if ($current['revision'] !== $hash) throw new SyncFailure('invalid', 422);
                return $this->response($subject, $current);
            }
            if ($current['revision'] !== $request['expectedRevision']) throw new SyncFailure('conflict', 409);
            if ($current['revision'] === $hash) return $this->response($subject, $current);
            $history = array_slice($current['recovery'] ?? [], -2);
            if ($current['plan'] !== null) $history[] = ['plan' => $current['plan'], 'savedAt' => $current['savedAt']];
            $next = ['format' => 1, 'plan' => $request['plan'], 'savedAt' => gmdate('c'), 'operationId' => $request['operationId'], 'recovery' => $history];
            if (!empty($account['current'])) {
                $this->drive($subject, $account, 'PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' . $this->id($account['current']) . '?uploadType=media', $next);
            } else {
                // Allocate a Drive file ID first; retrying a timed-out create reuses the same ID.
                if (empty($account['reserved'])) {
                    $ids = $this->drive($subject, $account, 'GET', self::DRIVE . '/generateIds?count=1&space=drive&type=files');
                    $account['reserved'] = $ids['ids'][0]; $this->vault->put($subject, $account);
                }
                $id = $account['reserved'];
                $boundary = 'aigb-' . bin2hex(random_bytes(16));
                $metadata = [
                    'id' => $id, 'name' => 'Current plan.json', 'mimeType' => 'application/json', 'parents' => [$account['folder']],
                    'appProperties' => ['app' => 'am-i-going-broke', 'purpose' => 'sync-current'],
                ];
                $multipart = '--' . $boundary . "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" . json_encode($metadata, JSON_THROW_ON_ERROR) .
                    "\r\n--" . $boundary . "\r\nContent-Type: application/json\r\n\r\n" . json_encode($next, JSON_THROW_ON_ERROR) . "\r\n--" . $boundary . "--";
                try {
                    $this->drive($subject, $account, 'POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', $multipart, ['Content-Type: multipart/related; boundary=' . $boundary]);
                } catch (SyncFailure $error) {
                    if ($error->reason !== 'conflict') throw $error;
                    $existing = $this->drive($subject, $account, 'GET', self::DRIVE . '/' . $this->id($id) . '?alt=media');
                    if (($existing['operationId'] ?? null) !== $request['operationId'] || !self::validPlan($existing['plan'] ?? null) ||
                        self::hash(self::normalizePlan($existing['plan'])) !== $hash) throw new SyncFailure('conflict', 409);
                    $next = $existing;
                }
                $account['current'] = $id; unset($account['reserved']); $this->vault->put($subject, $account);
            }
            $next['revision'] = $hash;
            return $this->response($subject, $next);
        });
    }
    public function disconnect(string $subject): void
    {
        $this->vault->locked($subject, function () use ($subject): void {
            // Remove this service's stored credentials; do not delete the user's Drive files.
            $this->vault->remove($subject);
        });
    }
    public function backup(string $subject, array $request): array
    {
        if (($request['accountId'] ?? null) !== $subject) throw new SyncFailure('account', 403);
        if (!self::validPlan($request['plan'] ?? null) || !is_string($request['operationId'] ?? null) ||
            !preg_match('/^[A-Za-z0-9:_-]{8,160}$/D', $request['operationId'])) throw new SyncFailure('invalid', 422);
        return $this->operation($subject, function (array &$account) use ($subject, $request): array {
            if (empty($account['folder'])) throw new SyncFailure('setup', 409);
            $this->ensureFolder($subject, $account, 'folder', 'sync-folder', 'Am I Going Broke?');
            $folder = $this->ensureFolder($subject, $account, 'backups', 'manual-backup-folder', 'Backups', $account['folder']);
            $hash = self::hash(self::normalizePlan($request['plan']));
            $operation = $account['manualOperation'] ?? [];
            if (($operation['operationId'] ?? null) !== $request['operationId']) {
                $ids = $this->drive($subject, $account, 'GET', self::DRIVE . '/generateIds?count=1&space=drive&type=files');
                $operation = ['operationId' => $request['operationId'], 'id' => $ids['ids'][0], 'at' => gmdate('c'), 'hash' => $hash];
                $account['manualOperation'] = $operation; $this->vault->put($subject, $account);
            }
            if ($operation['hash'] !== $hash) throw new SyncFailure('invalid', 422);
            $boundary = 'aigb-' . bin2hex(random_bytes(16));
            $meta = ['id' => $operation['id'], 'name' => 'am-i-going-broke-' . str_replace([':', '+'], '-', $operation['at']) . '.json',
                'mimeType' => 'application/json', 'parents' => [$folder],
                'appProperties' => ['app' => 'am-i-going-broke', 'purpose' => 'manual-backup']];
            $data = ['version' => 3, 'exportedAt' => $operation['at'], 'data' => self::normalizePlan($request['plan'])];
            $body = '--' . $boundary . "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" . json_encode($meta, JSON_THROW_ON_ERROR) .
                "\r\n--" . $boundary . "\r\nContent-Type: application/json\r\n\r\n" . json_encode($data, JSON_THROW_ON_ERROR) . "\r\n--" . $boundary . "--";
            try {
                $this->drive($subject, $account, 'POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', $body, ['Content-Type: multipart/related; boundary=' . $boundary]);
            } catch (SyncFailure $error) {
                if ($error->reason !== 'conflict') throw $error;
                $existing = $this->drive($subject, $account, 'GET', self::DRIVE . '/' . $this->id($operation['id']) . '?alt=media');
                if (!self::validPlan($existing['data'] ?? null) || self::hash(self::normalizePlan($existing['data'])) !== $hash) throw new SyncFailure('remote', 422);
            }
            return ['accountId' => $subject, 'savedAt' => $operation['at']];
        });
    }
    public function latestBackup(string $subject): array
    {
        return $this->operation($subject, function (array &$account) use ($subject): array {
            $legacy = $this->manualBackup($subject, $account);
            if (!$legacy) throw new SyncFailure('no_backup', 404);
            return ['accountId' => $subject, 'backup' => $legacy['backup']];
        });
    }
    private function manualBackup(string $subject, array &$account): ?array
    {
        $result = $this->drive($subject, $account, 'GET', self::DRIVE . '?' . http_build_query([
            'q' => "trashed = false and appProperties has { key='app' and value='am-i-going-broke' } and appProperties has { key='purpose' and value='manual-backup' }",
            'pageSize' => 1, 'orderBy' => 'modifiedTime desc', 'fields' => 'files(id,modifiedTime)', 'spaces' => 'drive',
        ]));
        $meta = $result['files'][0] ?? null;
        if (!$meta) return null;
        return ['id' => $meta['id'], 'modifiedTime' => $meta['modifiedTime'] ?? null,
            'backup' => $this->drive($subject, $account, 'GET', self::DRIVE . '/' . $this->id($meta['id']) . '?alt=media')];
    }
    public function recovery(string $subject): array
    {
        return $this->operation($subject, function (array &$account) use ($subject): array {
            $current = $this->current($subject, $account);
            $versions = [];
            foreach (array_reverse(array_slice($current['recovery'] ?? [], -3)) as $version) {
                if (!self::validPlan($version['plan'] ?? null) || !is_string($version['savedAt'] ?? null)) throw new SyncFailure('remote', 422);
                $versions[] = ['plan' => self::normalizePlan($version['plan']), 'savedAt' => $version['savedAt']];
            }
            return ['accountId' => $subject, 'versions' => $versions];
        });
    }
    public function recreate(string $subject, array $request): array
    {
        if (($request['accountId'] ?? null) !== $subject || ($request['confirmed'] ?? false) !== true) throw new SyncFailure('consent', 400);
        return $this->operation($subject, function (array &$account) use ($subject): array {
            try {
                $current = $this->current($subject, $account);
                if ($current['plan'] !== null) throw new SyncFailure('conflict', 409);
            } catch (SyncFailure $error) { if ($error->reason !== 'missing' && $error->reason !== 'setup') throw $error; }
            unset($account['folder'], $account['current'], $account['reserved'], $account['backups']);
            $this->vault->put($subject, $account);
            $folder = $this->ensureFolder($subject, $account, 'folder', 'sync-folder', 'Am I Going Broke?');
            return ['accountId' => $subject, 'folderUrl' => 'https://drive.google.com/drive/folders/' . $this->id($folder)];
        });
    }
}
