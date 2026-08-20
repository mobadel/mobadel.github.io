<?php
declare(strict_types=1);

/*
 * پراکسی نرخ طلا، سکه و ارز فیات — بین مرورگر و BrsApi می‌نشیند.
 *
 * چرا اصلاً وجود دارد: سهمیهٔ رایگان BrsApi روزی ۱۵۰۰ درخواست است و
 * کلید هم نباید در جاوااسکریپت عمومی دیده شود. اگر مرورگرِ هر
 * بازدیدکننده مستقیم صدا می‌زد، سهمیه با ترافیک بسیار کم ته می‌کشید.
 * با کش ۱۲۰ ثانیه‌ای مصرف روزانه حدود ۷۲۰ درخواست می‌شود، مستقل از
 * اینکه چند نفر سایت را باز کنند.
 *
 * ارز دیجیتال عمداً از اینجا نمی‌آید. آن‌ها را مرورگر مستقیم از
 * نوبیتکس می‌گیرد. اگر هر دو منبع یک دارایی را قیمت بدهند، دو نرخ
 * متفاوت وارد یک گراف می‌شود و تبدیل‌ها با هم نمی‌خوانند.
 */

const CACHE_TTL        = 120;
const UPSTREAM_TIMEOUT = 12;
const UPSTREAM_URL     = 'https://api.brsapi.ir/Market/Gold_Currency.php';

/* افزودن دارایی جدید = یک ردیف در همین جدول. هیچ جای دیگری لازم
   نیست عوض شود. نمادها از پاسخ واقعی BrsApi گرفته شده‌اند. */
const ASSET_MAP = [
    'IR_GOLD_18K'   => ['id' => 'gold18', 'group' => 'gold', 'unit' => 'gram'],
    'IR_COIN_EMAMI' => ['id' => 'emami',  'group' => 'coin', 'unit' => 'piece'],
    'USD'           => ['id' => 'usd',    'group' => 'fiat', 'unit' => 'unit'],
    'EUR'           => ['id' => 'eur',    'group' => 'fiat', 'unit' => 'unit'],
    'TRY'           => ['id' => 'try',    'group' => 'fiat', 'unit' => 'unit'],
    'AED'           => ['id' => 'aed',    'group' => 'fiat', 'unit' => 'unit'],
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');

$cacheDir  = __DIR__ . '/cache';
$cacheFile = $cacheDir . '/rates.json';

/* ── کش تازه؟ همان را بده و تمام ─────────────────────────────── */
$cached = null;
if (is_readable($cacheFile)) {
    $raw = @file_get_contents($cacheFile);
    if ($raw !== false) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && !empty($decoded['assets'])) {
            $cached = $decoded;
            $age = time() - (int) ($decoded['fetched_unix'] ?? 0);
            if ($age >= 0 && $age < CACHE_TTL) {
                echo $raw;
                exit;
            }
        }
    }
}

/* ── کلید: از متغیر محیطی یا config.php که هنگام دیپلوی ساخته
      می‌شود. هیچ‌وقت داخل ریپو نیست. ─────────────────────────── */
$key = getenv('BRSAPI_KEY') ?: '';
if ($key === '' && is_readable(__DIR__ . '/config.php')) {
    $config = require __DIR__ . '/config.php';
    if (is_array($config)) {
        $key = (string) ($config['brsapi_key'] ?? '');
    }
}

/* ── ناتوانی در تازه‌سازی هرگز نباید صفحه را خالی کند ────────── */
function serveStale(?array $cached, string $reason): never
{
    if ($cached !== null) {
        $cached['stale']  = true;
        $cached['reason'] = $reason;
        echo json_encode($cached, JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(503);
        echo json_encode([
            'updated' => null,
            'stale'   => true,
            'reason'  => $reason,
            'assets'  => new stdClass(),
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if ($key === '') {
    serveStale($cached, 'missing_key');
}

/* ── گرفتن از بالادست ────────────────────────────────────────── */
$channel = curl_init(UPSTREAM_URL . '?key=' . urlencode($key));
curl_setopt_array($channel, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => UPSTREAM_TIMEOUT,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_USERAGENT      => 'tabdex-rates/1.0 (+https://tabdex.ir)',
]);
$body     = curl_exec($channel);
$httpCode = curl_getinfo($channel, CURLINFO_HTTP_CODE);
curl_close($channel);

if ($body === false || $httpCode !== 200) {
    serveStale($cached, 'upstream_http_' . $httpCode);
}

$payload = json_decode((string) $body, true);
if (!is_array($payload)) {
    serveStale($cached, 'upstream_not_json');
}

/* ── نرمال‌سازی به قرارداد خودمان ────────────────────────────── */
$assets = [];
$latest = 0;

foreach ($payload as $section) {
    if (!is_array($section)) {
        continue;
    }
    foreach ($section as $row) {
        if (!is_array($row) || !isset($row['symbol'])) {
            continue;
        }
        $symbol = (string) $row['symbol'];
        if (!isset(ASSET_MAP[$symbol])) {
            continue;
        }
        $price = (float) ($row['price'] ?? 0);
        if ($price <= 0) {
            continue;
        }
        // BrsApi اقلام ایرانی را به تومان می‌دهد، ولی اگر روزی واحد را
        // به ریال عوض کرد، بی‌سروصدا صد برابر غلط نشویم.
        if (str_contains((string) ($row['unit'] ?? ''), 'ریال')) {
            $price /= 10;
        }
        $meta = ASSET_MAP[$symbol];
        $assets[$meta['id']] = [
            'toman'  => $price,
            'group'  => $meta['group'],
            'unit'   => $meta['unit'],
            'name'   => (string) ($row['name'] ?? $meta['id']),
            'change' => (float) ($row['change_percent'] ?? 0),
        ];
        $latest = max($latest, (int) ($row['time_unix'] ?? 0));
    }
}

if ($assets === []) {
    serveStale($cached, 'no_mapped_assets');
}

$result = [
    'updated'      => gmdate('c', $latest > 0 ? $latest : time()),
    'fetched_unix' => time(),
    'stale'        => false,
    'assets'       => $assets,
];

if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0775, true);
}
$encoded = json_encode($result, JSON_UNESCAPED_UNICODE);
// نوشتن اتمیک تا درخواست هم‌زمان، فایل نیمه‌نوشته نخواند.
$temp = $cacheFile . '.' . getmypid() . '.tmp';
if (@file_put_contents($temp, $encoded) !== false) {
    @rename($temp, $cacheFile);
}

echo $encoded;
