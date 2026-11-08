<?php
declare(strict_types=1);

const CMS_SESSION_IDLE = 7200;
const CMS_SESSION_MAX = 43200;
const CMS_LOGIN_LIMIT = 8;
const CMS_LOGIN_WINDOW = 900;
const CMS_PASSWORD_MIN = 10;
const CMS_ROLES = ['admin', 'editor'];

class CmsError extends RuntimeException
{
    public int $status;

    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function cms_init_storage(): void
{
    foreach ([CMS_DATA, CMS_DATA . '/sessions', CMS_DATA . '/pages', CMS_DATA . '/published', CMS_DATA . '/tmp', CMS_DATA . '/locks', CMS_MEDIA] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new CmsError('پوشهٔ ذخیره‌سازی ساخته نشد؛ دسترسی نوشتن هاست را بررسی کنید.', 500);
        }
    }
    $deny = "Require all denied\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
    if (!is_file(CMS_DATA . '/.htaccess')) {
        file_put_contents(CMS_DATA . '/.htaccess', $deny);
    }
    if (!is_file(CMS_MEDIA . '/.htaccess')) {
        file_put_contents(CMS_MEDIA . '/.htaccess', "Options -Indexes -ExecCGI\n<FilesMatch \"\\.(?i:php[0-9]*|phtml|phar|pl|py|cgi|asp|aspx|jsp|sh|shtml)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_headers.c>\n  Header set X-Content-Type-Options \"nosniff\"\n</IfModule>\n");
    }
}

function cms_is_local(): bool
{
    $host = strtolower((string) preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    return in_array($host, ['localhost', '127.0.0.1', '[::1]'], true);
}

function cms_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) CMS_SESSION_MAX);
    session_name('tabdex_panel');
    session_save_path(CMS_DATA . '/sessions');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/panel/',
        'secure' => !cms_is_local(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function cms_users(): array
{
    return cms_read('users', []);
}

function cms_public_user(array $user): array
{
    return [
        'id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'role' => $user['role'],
        'active' => $user['active'],
        'created_at' => $user['created_at'],
        'last_login_at' => $user['last_login_at'] ?? null,
    ];
}

function cms_normalize_username(string $username): string
{
    return strtolower(trim($username));
}

function cms_check_username(string $username): void
{
    if (preg_match('/^[a-z0-9._-]{3,32}$/D', $username) !== 1) {
        throw new CmsError('نام کاربری باید ۳ تا ۳۲ حرف انگلیسی کوچک، عدد یا . _ - باشد.');
    }
}

function cms_check_password(string $password): void
{
    if (mb_strlen($password) < CMS_PASSWORD_MIN) {
        throw new CmsError('رمز عبور باید دست‌کم ' . CMS_PASSWORD_MIN . ' نویسه باشد.');
    }
    if (strlen($password) > 200) {
        throw new CmsError('رمز عبور بیش از حد طولانی است.');
    }
}

function cms_check_role(string $role): void
{
    if (!in_array($role, CMS_ROLES, true)) {
        throw new CmsError('نقش انتخاب‌شده معتبر نیست.');
    }
}

function cms_check_display_name(string $name): string
{
    $name = trim($name);
    if ($name === '' || mb_strlen($name) > 60) {
        throw new CmsError('نام نمایشی باید بین ۱ تا ۶۰ نویسه باشد.');
    }
    return $name;
}

function cms_new_user(string $username, string $displayName, string $role, string $password, string $createdBy): array
{
    return [
        'id' => bin2hex(random_bytes(8)),
        'username' => $username,
        'display_name' => $displayName,
        'role' => $role,
        'active' => true,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'password_version' => bin2hex(random_bytes(6)),
        'created_at' => gmdate('c'),
        'created_by' => $createdBy,
    ];
}

/* هم آی‌پی و هم نام کاربری شمرده می‌شوند: اولی جلوی آزمودن نام‌ها از یک
   آدرس و دومی جلوی آزمودن رمز یک حساب از آدرس‌های مختلف را می‌گیرد. */
function cms_throttle_keys(string $username): array
{
    return ['ip:' . hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? '')), 'user:' . hash('sha256', $username)];
}

function cms_throttle_check(string $username): void
{
    $now = time();
    $data = cms_read('throttle', []);
    foreach (cms_throttle_keys($username) as $key) {
        $entry = $data[$key] ?? null;
        if ($entry && $entry['until'] > $now && $entry['count'] >= CMS_LOGIN_LIMIT) {
            throw new CmsError('تلاش‌های ناموفق زیاد بود. ' . (int) ceil(($entry['until'] - $now) / 60) . ' دقیقهٔ دیگر دوباره امتحان کنید.', 429);
        }
    }
}

function cms_throttle_record(string $username, bool $success): void
{
    cms_locked('throttle', static function () use ($username, $success): void {
        $now = time();
        $data = array_filter(cms_read('throttle', []), static fn (array $entry): bool => $entry['until'] > $now);
        foreach (cms_throttle_keys($username) as $key) {
            if ($success) {
                if (str_starts_with($key, 'user:')) {
                    unset($data[$key]);
                }
                continue;
            }
            $data[$key] = ['count' => ($data[$key]['count'] ?? 0) + 1, 'until' => $now + CMS_LOGIN_WINDOW];
        }
        cms_write('throttle', $data);
    });
}

function cms_login(string $username, string $password): array
{
    $username = cms_normalize_username($username);
    cms_throttle_check($username);

    $match = null;
    foreach (cms_users() as $user) {
        if ($user['username'] === $username) {
            $match = $user;
            break;
        }
    }
    /* برای نام ناموجود هم هش بررسی می‌شود تا زمان پاسخ وجود حساب را لو ندهد. */
    $hash = $match['password_hash'] ?? '$2y$10$usesomesillystringforsaltOQnJbVjV7mKxN6wzJ3r0gkYk9mQW2';
    $valid = password_verify($password, $hash);

    if (!$match || !$valid || !$match['active']) {
        cms_throttle_record($username, false);
        throw new CmsError('نام کاربری یا رمز عبور درست نیست.', 401);
    }

    cms_throttle_record($username, true);
    session_regenerate_id(true);
    $_SESSION = [
        'uid' => $match['id'],
        'password_version' => $match['password_version'],
        'started' => time(),
        'seen' => time(),
        'csrf' => bin2hex(random_bytes(32)),
    ];

    cms_locked('users', static function () use ($match, $password): void {
        $users = cms_users();
        foreach ($users as &$user) {
            if ($user['id'] === $match['id']) {
                $user['last_login_at'] = gmdate('c');
                if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                    $user['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
                }
            }
        }
        cms_write('users', $users);
    });
    return $match;
}

function cms_logout(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    setcookie('tabdex_panel', '', ['expires' => time() - 3600, 'path' => '/panel/', 'secure' => !cms_is_local(), 'httponly' => true, 'samesite' => 'Strict']);
}

/* کاربر هر بار از فایل خوانده می‌شود تا غیرفعال شدن حساب یا تغییر رمز
   فوراً همهٔ نشست‌های بازِ آن حساب را از کار بیندازد. */
function cms_current_user(): ?array
{
    $uid = $_SESSION['uid'] ?? null;
    if (!is_string($uid)) {
        return null;
    }
    $now = time();
    if ($now - (int) ($_SESSION['seen'] ?? 0) > CMS_SESSION_IDLE || $now - (int) ($_SESSION['started'] ?? 0) > CMS_SESSION_MAX) {
        cms_logout();
        return null;
    }
    foreach (cms_users() as $user) {
        if ($user['id'] === $uid) {
            if (!$user['active'] || !hash_equals($user['password_version'], (string) ($_SESSION['password_version'] ?? ''))) {
                cms_logout();
                return null;
            }
            $_SESSION['seen'] = $now;
            return $user;
        }
    }
    cms_logout();
    return null;
}

function cms_setup_token(): string
{
    $file = dirname(__DIR__) . '/config.php';
    if (!is_file($file)) {
        return '';
    }
    $config = include $file;
    return is_array($config) ? (string) ($config['setup_token'] ?? '') : '';
}

function cms_create_first_admin(string $token, string $username, string $displayName, string $password): void
{
    $expected = cms_setup_token();
    $throttleName = 'setup';
    cms_throttle_check($throttleName);
    if (strlen($expected) < 16 || !hash_equals($expected, $token)) {
        cms_throttle_record($throttleName, false);
        throw new CmsError('کلید راه‌اندازی درست نیست.', 403);
    }
    $username = cms_normalize_username($username);
    cms_check_username($username);
    cms_check_password($password);
    $displayName = cms_check_display_name($displayName);

    cms_locked('users', static function () use ($username, $displayName, $password): void {
        if (cms_users() !== []) {
            throw new CmsError('راه‌اندازی قبلاً انجام شده است.', 409);
        }
        cms_write('users', [cms_new_user($username, $displayName, 'admin', $password, 'setup')]);
    });
    cms_throttle_record($throttleName, true);
}

function cms_create_user(array $input, array $actor): array
{
    $username = cms_normalize_username((string) ($input['username'] ?? ''));
    cms_check_username($username);
    $displayName = cms_check_display_name((string) ($input['display_name'] ?? ''));
    $role = (string) ($input['role'] ?? 'editor');
    cms_check_role($role);
    $password = (string) ($input['password'] ?? '');
    cms_check_password($password);

    return cms_locked('users', static function () use ($username, $displayName, $role, $password, $actor): array {
        $users = cms_users();
        foreach ($users as $user) {
            if ($user['username'] === $username) {
                throw new CmsError('این نام کاربری قبلاً ثبت شده است.', 409);
            }
        }
        $created = cms_new_user($username, $displayName, $role, $password, $actor['id']);
        $users[] = $created;
        cms_write('users', $users);
        return cms_public_user($created);
    });
}

function cms_active_admins(array $users): int
{
    return count(array_filter($users, static fn (array $user): bool => $user['active'] && $user['role'] === 'admin'));
}

function cms_update_user(array $input): array
{
    $id = (string) ($input['id'] ?? '');
    return cms_locked('users', static function () use ($id, $input): array {
        $users = cms_users();
        foreach ($users as &$user) {
            if ($user['id'] !== $id) {
                continue;
            }
            if (array_key_exists('display_name', $input)) {
                $user['display_name'] = cms_check_display_name((string) $input['display_name']);
            }
            if (array_key_exists('role', $input)) {
                cms_check_role((string) $input['role']);
                $user['role'] = (string) $input['role'];
            }
            if (array_key_exists('active', $input)) {
                $user['active'] = (bool) $input['active'];
            }
            if (($input['password'] ?? '') !== '') {
                cms_check_password((string) $input['password']);
                $user['password_hash'] = password_hash((string) $input['password'], PASSWORD_DEFAULT);
                $user['password_version'] = bin2hex(random_bytes(6));
            }
            if (cms_active_admins($users) < 1) {
                throw new CmsError('دست‌کم یک مدیر فعال باید باقی بماند.', 409);
            }
            cms_write('users', $users);
            return cms_public_user($user);
        }
        throw new CmsError('کاربر پیدا نشد.', 404);
    });
}

function cms_delete_user(string $id, array $actor): void
{
    if ($id === $actor['id']) {
        throw new CmsError('حساب خودتان را نمی‌توانید حذف کنید.', 409);
    }
    cms_locked('users', static function () use ($id): void {
        $users = cms_users();
        $remaining = array_values(array_filter($users, static fn (array $user): bool => $user['id'] !== $id));
        if (count($remaining) === count($users)) {
            throw new CmsError('کاربر پیدا نشد.', 404);
        }
        if (cms_active_admins($remaining) < 1) {
            throw new CmsError('دست‌کم یک مدیر فعال باید باقی بماند.', 409);
        }
        cms_write('users', $remaining);
    });
}

function cms_change_own_password(array $actor, string $current, string $next): void
{
    cms_check_password($next);
    if (!password_verify($current, $actor['password_hash'])) {
        throw new CmsError('رمز فعلی درست نیست.', 403);
    }
    $version = bin2hex(random_bytes(6));
    cms_locked('users', static function () use ($actor, $next, $version): void {
        $users = cms_users();
        foreach ($users as &$user) {
            if ($user['id'] === $actor['id']) {
                $user['password_hash'] = password_hash($next, PASSWORD_DEFAULT);
                $user['password_version'] = $version;
            }
        }
        cms_write('users', $users);
    });
    /* نشست همین مرورگر می‌ماند و بقیهٔ نشست‌ها باطل می‌شوند. */
    session_regenerate_id(true);
    $_SESSION['password_version'] = $version;
}
