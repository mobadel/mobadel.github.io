<?php
declare(strict_types=1);

/*
 * هستهٔ مشترک پنل محتوا و render.php.
 *
 * ذخیره‌سازی عمداً فایلی است: هاست فقط PHP و FTP را تضمین می‌کند و سایت
 * اصلی دیتابیس ندارد. همهٔ داده‌ها در cms-data است که روی خود سرور ساخته
 * می‌شود و چون lftp با mirror بدون --delete اجرا می‌شود، دیپلوی به آن
 * دست نمی‌زند. هر فایل با یک خط «exit» شروع می‌شود تا حتی اگر قاعدهٔ
 * .htaccess روزی از کار افتاد، محتوایش از بیرون خوانده نشود.
 */

const CMS_GUARD = "<?php exit; ?>\n";
const CMS_KEY_PATTERN = '~^(?:price(?:/[a-z0-9-]+){0,2}|convert(?:/(?:[a-z0-9]+-to-[a-z0-9]+|rahn-ejare))?)$~D';
const CMS_PAIR_PATTERN = '~^convert/[a-z0-9]+-to-[a-z0-9]+$~D';
const CMS_CSS_VERSION = '20261108-1';

define('CMS_ROOT', dirname(__DIR__, 2));
define('CMS_DATA', CMS_ROOT . '/cms-data');
define('CMS_MEDIA', CMS_ROOT . '/cms-media');

function cms_key_from_path(string $path): ?string
{
    $path = (string) parse_url($path, PHP_URL_PATH);
    $key = trim($path, '/');
    return preg_match(CMS_KEY_PATTERN, $key) === 1 ? $key : null;
}

function cms_path_from_key(string $key): string
{
    return '/' . $key . '/';
}

function cms_read(string $name, $default = null)
{
    $file = CMS_DATA . '/' . $name . '.php';
    if (!is_file($file)) {
        return $default;
    }
    $raw = file_get_contents($file);
    if ($raw === false || !str_starts_with($raw, CMS_GUARD)) {
        return $default;
    }
    $data = json_decode(substr($raw, strlen(CMS_GUARD)), true);
    return is_array($data) ? $data : $default;
}

function cms_atomic_write(string $file, string $contents): void
{
    $dir = dirname($file);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('پوشهٔ ذخیره‌سازی ساخته نشد.');
    }
    $tmp = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($tmp, $contents, LOCK_EX) !== strlen($contents)) {
        @unlink($tmp);
        throw new RuntimeException('فایل ذخیره نشد؛ فضای هاست را بررسی کنید.');
    }
    if (!rename($tmp, $file)) {
        @unlink($tmp);
        throw new RuntimeException('فایل جایگزین نشد.');
    }
}

function cms_write(string $name, array $data): void
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('داده قابل ذخیره نیست.');
    }
    cms_atomic_write(CMS_DATA . '/' . $name . '.php', CMS_GUARD . $json);
}

/* فایل‌های مشترک (کاربران، فهرست صفحات و…) فقط داخل این قفل تغییر می‌کنند
   تا دو ذخیرهٔ هم‌زمان نتیجهٔ هم را پاک نکنند. */
function cms_locked(string $name, callable $callback)
{
    $dir = CMS_DATA . '/locks';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $handle = fopen($dir . '/' . $name . '.lock', 'c');
    if ($handle === false) {
        throw new RuntimeException('قفل ذخیره‌سازی در دسترس نیست.');
    }
    flock($handle, LOCK_EX);
    try {
        return $callback();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function cms_secret(): string
{
    $data = cms_read('secret');
    if (is_array($data) && isset($data['key'])) {
        return (string) $data['key'];
    }
    return (string) cms_locked('secret', static function (): string {
        $existing = cms_read('secret');
        if (is_array($existing) && isset($existing['key'])) {
            return (string) $existing['key'];
        }
        $key = bin2hex(random_bytes(32));
        cms_write('secret', ['key' => $key]);
        return $key;
    });
}

function cms_preview_token(string $key, int $ttl = 1800): string
{
    $expires = time() + $ttl;
    return $expires . '.' . hash_hmac('sha256', $key . '|' . $expires, cms_secret());
}

function cms_preview_valid(string $key, string $token): bool
{
    if (!preg_match('/^(\d{10})\.([a-f0-9]{64})$/D', $token, $parts) || (int) $parts[1] < time()) {
        return false;
    }
    return hash_equals(hash_hmac('sha256', $key . '|' . $parts[1], cms_secret()), $parts[2]);
}

function cms_page_store_name(string $key): string
{
    return 'pages/' . str_replace('/', '__', $key);
}

function cms_published_file(string $key): string
{
    return CMS_DATA . '/published/' . $key . '.php';
}

function cms_read_published(string $key): ?string
{
    $file = cms_published_file($key);
    if (!is_file($file)) {
        return null;
    }
    $raw = file_get_contents($file);
    if ($raw === false || !str_starts_with($raw, CMS_GUARD)) {
        return null;
    }
    return substr($raw, strlen(CMS_GUARD));
}

/* صفحه‌ای که فایل ایستا دارد از همان فایل، و بقیه از همان قالبی که
   .htaccess به آن بازنویسی می‌کند ساخته می‌شوند. */
function cms_base_html(string $key): ?string
{
    $candidates = [CMS_ROOT . '/' . $key . '/index.html'];
    if (preg_match(CMS_PAIR_PATTERN, $key) === 1) {
        $candidates[] = CMS_ROOT . '/convert/index.html';
    } elseif (substr_count($key, '/') === 1) {
        $candidates[] = CMS_ROOT . '/price/category.html';
    } elseif (substr_count($key, '/') === 2) {
        $candidates[] = CMS_ROOT . '/price/asset.html';
    }
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $html = file_get_contents($file);
            return $html === false ? null : $html;
        }
    }
    return null;
}

function cms_replace_section(string $html, string $class, callable $callback): ?string
{
    $pattern = '~<section class="' . preg_quote($class, '~') . '"[^>]*>.*?</section>~s';
    $count = 0;
    $result = preg_replace_callback($pattern, $callback, $html, 1, $count);
    return ($result === null || $count !== 1) ? null : $result;
}

/* محتوای پنل داخل HTML اولیه می‌نشیند تا خزنده بدون اجرای جاوااسکریپت
   آن را ببیند. اگر قالب عوض شده باشد و جای محتوا پیدا نشود، صفحهٔ
   خودکار دست‌نخورده برمی‌گردد؛ صفحهٔ سالم بهتر از صفحهٔ شکسته است. */
function cms_inject(string $html, string $content, string $key): string
{
    $body = '<div class="cms-body">' . $content . '</div>';
    $result = null;

    if (str_starts_with($key, 'convert')) {
        $result = cms_replace_section($html, 'pair-content', static function (array $match) use ($body): string {
            $links = preg_match('~<p class="pair-links">.*?</p>~s', $match[0], $found) ? $found[0] : '';
            return '<section class="pair-content cms-content" aria-label="توضیحات">' . $body . $links . '</section>';
        });
    } elseif (substr_count($key, '/') === 2) {
        $result = cms_replace_section($html, 'asset-content', static function () use ($body): string {
            return '<section class="asset-content cms-content" aria-label="توضیحات">' . $body . '</section>';
        });
    } else {
        $section = '<section class="seo-content cms-content" aria-label="توضیحات">' . $body . '</section>';
        $position = strpos($html, '</main>');
        if ($position !== false) {
            $result = substr($html, 0, $position) . $section . substr($html, $position);
        }
    }

    if ($result === null) {
        error_log('tabdex panel: content slot not found for ' . $key);
        return $html;
    }

    $link = '<link rel="stylesheet" href="/assets/cms-content.css?v=' . CMS_CSS_VERSION . '">';
    $head = strpos($result, '</head>');
    return $head === false ? $result : substr($result, 0, $head) . $link . substr($result, $head);
}
