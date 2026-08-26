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

/* گواهی سپردهٔ بورس کالا (نقره و مس) اندپوینت جداست و روزی یک‌بار
   تسویه می‌شود، نه لحظه‌ای. پس کش خیلی طولانی‌تری می‌گیرد.

   این عدد مهم است: سهمیهٔ رایگان BrsApi روی همهٔ سرویس‌هایش روی‌هم
   ۱۵۰۰ درخواست در روز است. با TTL صد و بیست ثانیه، اندپوینت طلا و ارز
   حدود ۷۲۰ درخواست می‌برد. اگر بورس کالا هم همان TTL را داشت، مجموع
   به ۱۴۴۰ می‌رسید که خطرناک نزدیک سقف است. با ۹۰۰ ثانیه فقط حدود ۹۶
   درخواست می‌شود و مجموع زیر ۸۵۰ می‌ماند. */
const IME_CACHE_TTL = 900;
const IME_URL       = 'https://api.brsapi.ir/IME/Certificate.php';

/* نمادهای بورس کالا. قیمت‌ها به ریال‌اند. */
const IME_MAP = [
    'SilverBar'  => ['id' => 'silver', 'group' => 'commodity', 'unit' => 'gram'],
    'CopperCthd' => ['id' => 'copper', 'group' => 'commodity', 'unit' => 'kilogram'],
];

/* افزودن دارایی جدید = یک ردیف در همین جدول. هیچ جای دیگری لازم
   نیست عوض شود. نمادها از پاسخ واقعی BrsApi گرفته شده‌اند.

   USDT_IRT عمداً اینجا نیست: تتر از نوبیتکس می‌آید و دو منبع برای یک
   دارایی یعنی دو نرخ ناسازگار در یک گراف. */
const ASSET_MAP = [
    // طلا
    'IR_GOLD_18K'     => ['id' => 'gold18',      'group' => 'gold', 'unit' => 'gram'],
    'IR_GOLD_24K'     => ['id' => 'gold24',      'group' => 'gold', 'unit' => 'gram'],
    'IR_GOLD_MELTED'  => ['id' => 'goldmelted',  'group' => 'gold', 'unit' => 'mesghal'],
    'XAUUSD'          => ['id' => 'goldounce',   'group' => 'gold', 'unit' => 'ounce'],

    // سکه
    'IR_COIN_EMAMI'   => ['id' => 'emami',       'group' => 'coin', 'unit' => 'piece'],
    'IR_COIN_BAHAR'   => ['id' => 'bahar',       'group' => 'coin', 'unit' => 'piece'],
    'IR_COIN_HALF'    => ['id' => 'halfcoin',    'group' => 'coin', 'unit' => 'piece'],
    'IR_COIN_QUARTER' => ['id' => 'quartercoin', 'group' => 'coin', 'unit' => 'piece'],
    'IR_COIN_1G'      => ['id' => 'gramcoin',    'group' => 'coin', 'unit' => 'piece'],

    // ارز فیات
    'USD' => ['id' => 'usd', 'group' => 'fiat', 'unit' => 'unit'],
    'EUR' => ['id' => 'eur', 'group' => 'fiat', 'unit' => 'unit'],
    'GBP' => ['id' => 'gbp', 'group' => 'fiat', 'unit' => 'unit'],
    'CHF' => ['id' => 'chf', 'group' => 'fiat', 'unit' => 'unit'],
    'AED' => ['id' => 'aed', 'group' => 'fiat', 'unit' => 'unit'],
    'TRY' => ['id' => 'try', 'group' => 'fiat', 'unit' => 'unit'],
    'JPY' => ['id' => 'jpy', 'group' => 'fiat', 'unit' => 'unit'],
    'CNY' => ['id' => 'cny', 'group' => 'fiat', 'unit' => 'unit'],
    'AUD' => ['id' => 'aud', 'group' => 'fiat', 'unit' => 'unit'],
    'CAD' => ['id' => 'cad', 'group' => 'fiat', 'unit' => 'unit'],
    'RUB' => ['id' => 'rub', 'group' => 'fiat', 'unit' => 'unit'],
    'SEK' => ['id' => 'sek', 'group' => 'fiat', 'unit' => 'unit'],
    'INR' => ['id' => 'inr', 'group' => 'fiat', 'unit' => 'unit'],
    'PKR' => ['id' => 'pkr', 'group' => 'fiat', 'unit' => 'unit'],
    'AFN' => ['id' => 'afn', 'group' => 'fiat', 'unit' => 'unit'],
    'MYR' => ['id' => 'myr', 'group' => 'fiat', 'unit' => 'unit'],
    'THB' => ['id' => 'thb', 'group' => 'fiat', 'unit' => 'unit'],
    'SAR' => ['id' => 'sar', 'group' => 'fiat', 'unit' => 'unit'],
    'QAR' => ['id' => 'qar', 'group' => 'fiat', 'unit' => 'unit'],
    'KWD' => ['id' => 'kwd', 'group' => 'fiat', 'unit' => 'unit'],
    'BHD' => ['id' => 'bhd', 'group' => 'fiat', 'unit' => 'unit'],
    'OMR' => ['id' => 'omr', 'group' => 'fiat', 'unit' => 'unit'],
    'IQD' => ['id' => 'iqd', 'group' => 'fiat', 'unit' => 'unit'],
    'SYP' => ['id' => 'syp', 'group' => 'fiat', 'unit' => 'unit'],
    'AZN' => ['id' => 'azn', 'group' => 'fiat', 'unit' => 'unit'],
    'AMD' => ['id' => 'amd', 'group' => 'fiat', 'unit' => 'unit'],
    'GEL' => ['id' => 'gel', 'group' => 'fiat', 'unit' => 'unit'],
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

/* ── نرمال‌سازی به قرارداد خودمان ──────────────────────────────

   همهٔ نرخ‌ها باید تومانی باشند چون گراف تبدیل در مرورگر بر پایهٔ
   تومان است. ولی BrsApi انس طلا (XAUUSD) را به دلار می‌دهد، پس اول
   نرخ دلار را پیدا می‌کنیم تا بتوانیم تبدیلش کنیم. بدون این، انس طلا
   با عدد ۴۵۸۲ به‌عنوان تومان وارد گراف می‌شد. */
$usdToman = 0.0;
foreach ($payload as $section) {
    if (!is_array($section)) {
        continue;
    }
    foreach ($section as $row) {
        if (is_array($row) && ($row['symbol'] ?? '') === 'USD') {
            $usdToman = (float) ($row['price'] ?? 0);
            break 2;
        }
    }
}

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
        $rowUnit = (string) ($row['unit'] ?? '');
        $usdPrice = str_contains($rowUnit, 'دلار') ? $price : null;

        // BrsApi اقلام ایرانی را به تومان می‌دهد، ولی اگر روزی واحد را
        // به ریال عوض کرد، بی‌سروصدا صد برابر غلط نشویم.
        if (str_contains($rowUnit, 'ریال')) {
            $price /= 10;
        }

        // اقلام دلاری (فعلاً فقط انس طلا) به تومان تبدیل می‌شوند.
        // اگر نرخ دلار در دسترس نباشد، قلم را می‌اندازیم بیرون؛ نمایش
        // نشدن خیلی بهتر از نمایشِ عددی است که هزاران برابر غلط است.
        if (str_contains($rowUnit, 'دلار')) {
            if ($usdToman <= 0) {
                continue;
            }
            $price *= $usdToman;
        }

        $meta = ASSET_MAP[$symbol];
        $assets[$meta['id']] = [
            'toman'  => $price,
            'usd'    => $usdPrice,
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

/* ── بورس کالا: نقره و مس ─────────────────────────────────────
   کش مستقل با عمر طولانی‌تر. اگر این بخش شکست بخورد، بقیهٔ نرخ‌ها
   نباید از دست بروند، پس هیچ خطایی اینجا کل پاسخ را متوقف نمی‌کند. */
$imeCacheFile = $cacheDir . '/ime.json';
$imeRows      = null;

if (is_readable($imeCacheFile)) {
    $imeRaw = @file_get_contents($imeCacheFile);
    if ($imeRaw !== false) {
        $imeDecoded = json_decode($imeRaw, true);
        if (is_array($imeDecoded) && isset($imeDecoded['data'])) {
            $imeAge = time() - (int) ($imeDecoded['fetched_unix'] ?? 0);
            if ($imeAge >= 0 && $imeAge < IME_CACHE_TTL) {
                $imeRows = $imeDecoded['data'];
            }
        }
    }
}

if ($imeRows === null) {
    $imeChannel = curl_init(IME_URL . '?key=' . urlencode($key));
    curl_setopt_array($imeChannel, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => UPSTREAM_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_USERAGENT      => 'tabdex-rates/1.0 (+https://tabdex.ir)',
    ]);
    $imeBody = curl_exec($imeChannel);
    $imeCode = curl_getinfo($imeChannel, CURLINFO_HTTP_CODE);
    curl_close($imeChannel);

    if ($imeBody !== false && $imeCode === 200) {
        $imePayload = json_decode((string) $imeBody, true);
        if (is_array($imePayload) && !empty($imePayload['data'])) {
            $imeRows = $imePayload['data'];
            $imeEncoded = json_encode(
                ['fetched_unix' => time(), 'data' => $imeRows],
                JSON_UNESCAPED_UNICODE
            );
            $imeTemp = $imeCacheFile . '.' . getmypid() . '.tmp';
            if (@file_put_contents($imeTemp, $imeEncoded) !== false) {
                @rename($imeTemp, $imeCacheFile);
            }
        }
    }

    // اگر تازه‌سازی نشد، کش قدیمی بهتر از هیچ است.
    if ($imeRows === null && isset($imeDecoded['data'])) {
        $imeRows = $imeDecoded['data'];
    }
}

if (is_array($imeRows)) {
    foreach ($imeRows as $row) {
        if (!is_array($row) || !isset($row['contract_code'])) {
            continue;
        }
        $code = (string) $row['contract_code'];
        if (!isset(IME_MAP[$code])) {
            continue;
        }
        $rial = (float) ($row['pl'] ?? 0);
        if ($rial <= 0) {
            continue;
        }
        $meta = IME_MAP[$code];
        $assets[$meta['id']] = [
            // بورس کالا همیشه ریال می‌دهد.
            'toman'  => $rial / 10,
            'group'  => $meta['group'],
            'unit'   => $meta['unit'],
            'name'   => (string) ($row['commodity'] ?? $meta['id']),
            'change' => (float) ($row['plp'] ?? 0),
            // تاریخ آخرین معامله، چون بورس کالا فقط شنبه تا چهارشنبه باز است
            'traded' => (string) ($row['date_update'] ?? ''),
        ];
    }
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
