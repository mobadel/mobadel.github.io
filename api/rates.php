<?php
declare(strict_types=1);

/*
 * پراکسی نرخ طلا، سکه و ارز فیات — بین مرورگر و BrsApi می‌نشیند.
 *
 * چرا اصلاً وجود دارد: سهمیهٔ رایگان BrsApi روزی ۱۵۰۰ درخواست است و
 * کلید هم نباید در جاوااسکریپت عمومی دیده شود. اگر مرورگرِ هر
 * بازدیدکننده مستقیم صدا می‌زد، سهمیه با ترافیک بسیار کم ته می‌کشید.
 * با کش مشترک، مصرف روزانه مستقل از اینکه چند نفر سایت را باز کنند
 * ثابت می‌ماند؛ عمر کش به ساعت بازار بستگی دارد (بخش marketTtl).
 *
 * ارز دیجیتال عمداً از اینجا نمی‌آید. آن‌ها را مرورگر مستقیم از
 * نوبیتکس می‌گیرد. اگر هر دو منبع یک دارایی را قیمت بدهند، دو نرخ
 * متفاوت وارد یک گراف می‌شود و تبدیل‌ها با هم نمی‌خوانند.
 */

const UPSTREAM_TIMEOUT = 12;
const UPSTREAM_URL     = 'https://api.brsapi.ir/Market/Gold_Currency.php';

/* گواهی سپردهٔ بورس کالا (نقره و مس) اندپوینت جداست و روزی یک‌بار
   تسویه می‌شود، نه لحظه‌ای. پس کش خیلی طولانی‌تری می‌گیرد.

   سهمیهٔ رایگان BrsApi روی همهٔ سرویس‌هایش روی‌هم ۱۵۰۰ درخواست در روز
   است و این عدد از همان بودجه کم می‌کند. چون داده‌اش روزی یک‌بار عوض
   می‌شود، ۱۵ دقیقه‌ای گرفتنش فقط سهمیه هدر می‌داد؛ با نیم‌ساعت حدود
   ۴۸ درخواست می‌شود و جا برای تازه‌سازیِ یک‌دقیقه‌ای نرخ‌های لحظه‌ای
   باز می‌کند. */
const IME_CACHE_TTL = 1800;
const IME_URL       = 'https://api.brsapi.ir/IME/Certificate.php';

/* ── عمر کش بر اساس ساعت بازار ───────────────────────────────────
   TTL ثابتِ ۳۰۰ ثانیه دو جا اشتباه بود: در ساعات بازار برای کاربر
   کند بود، و شب و جمعه که هیچ نرخی تکان نمی‌خورد سهمیه را الکی
   می‌سوزاند. حالا همان بودجه جایی خرج می‌شود که ارزش دارد.

   حساب بدترین روز (شنبه تا پنجشنبه):
     ۰۹:۰۰–۱۹:۰۰  ۶۰ ثانیه  → ۶۰۰ درخواست
     ۰۷:۰۰–۰۹:۰۰ و ۱۹:۰۰–۲۳:۰۰  ۱۸۰ ثانیه → ۱۲۰
     بقیهٔ ساعات  ۶۰۰ ثانیه → ۴۸
   جمعاً ~۷۶۸ به‌علاوهٔ ~۴۸ تای بورس کالا ≈ ۸۱۶ از سقف ۱۵۰۰ رایگان.
   این سقفِ نظری است؛ تازه‌سازی فقط وقتی رخ می‌دهد که درخواستی برسد. */
const TTL_MARKET   = 60;
const TTL_SHOULDER = 180;
const TTL_CLOSED   = 600;

function marketTtl(): int
{
    $now  = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
    $hour = (int) $now->format('G');

    /* جمعه بازار ایران تعطیل است؛ نرخ‌ها تا شنبه تکان نمی‌خورند. */
    if ($now->format('N') === '5') {
        return TTL_CLOSED;
    }
    if ($hour >= 9 && $hour < 19) {
        return TTL_MARKET;
    }
    if ($hour >= 7 && $hour < 23) {
        return TTL_SHOULDER;
    }

    return TTL_CLOSED;
}

/* ── ترمز سهمیهٔ روزانه ──────────────────────────────────────────
   حسابِ بالا فقط تا وقتی درست است که هیچ‌چیز غیرمنتظره‌ای پیش نیاید:
   کرون اضافه، اسکریپت اشتباه، یا سرویس دیگری که همین کلید را مصرف
   کند. شمارنده تضمین می‌کند هر اتفاقی بیفتد کلید به سقف نرسد، چون
   مسدودیِ کلید تا باز شدن سهمیه برطرف نمی‌شود.

   شمارش به تاریخ تهران گره خورده و نه UTC، چون نیمه‌شب تهران مرزی
   است که خودمان با آن فکر می‌کنیم. */
const QUOTA_FILE       = __DIR__ . '/cache/quota.json';
const QUOTA_SOFT_LIMIT = 1200;
const TTL_THROTTLED    = 300;

function tehranToday(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran')))->format('Y-m-d');
}

function quotaToday(): int
{
    if (!is_readable(QUOTA_FILE)) {
        return 0;
    }
    $decoded = json_decode((string) @file_get_contents(QUOTA_FILE), true);
    if (!is_array($decoded)) {
        return 0;
    }
    /* شمارندهٔ دیروز یعنی روز عوض شده و بودجه از نو شروع می‌شود. */
    if ((string) ($decoded['day'] ?? '') !== tehranToday()) {
        return 0;
    }

    return (int) ($decoded['count'] ?? 0);
}

function countUpstreamCall(): void
{
    @file_put_contents(
        QUOTA_FILE,
        json_encode(['day' => tehranToday(), 'count' => quotaToday() + 1]),
        LOCK_EX
    );
}

function effectiveTtl(): int
{
    return quotaToday() >= QUOTA_SOFT_LIMIT
        ? max(TTL_THROTTLED, marketTtl())
        : marketTtl();
}

/* ── انرژی ────────────────────────────────────────────────────────
   نفت و فرآورده‌هایش از اندپوینت Commodity می‌آیند، نه Gold_Currency.
   قیمت‌ها دلاری‌اند و مثل انس طلا با نرخ دلار به تومان تبدیل می‌شوند.

   بازارشان بازار آتی آمریکاست، پس ساعت کاری‌اش هیچ ربطی به بازار
   ایران ندارد: تقریباً شبانه‌روز باز است و فقط آخر هفتهٔ غربی و یک
   وقفهٔ روزانه تعطیل می‌شود. جزئیاتش در market-history.php. */
const COMMODITY_URL = 'https://api.brsapi.ir/Market/Commodity.php';

/* بازار باز ده دقیقه، بسته یک ساعت. نفت آن‌قدر پرنوسان نیست که ارزش
   تازه‌سازی دقیقه‌ای داشته باشد، و سهمیه هم باید برای نرخ‌های ایرانی
   بماند که کاربر لحظه‌ای دنبالشان است. */
const ENERGY_TTL_OPEN   = 600;
const ENERGY_TTL_CLOSED = 3600;

const ENERGY_MAP = [
    'BRENT' => ['id' => 'brent',    'group' => 'energy', 'unit' => 'barrel'],
    'RBOB'  => ['id' => 'gasoline', 'group' => 'energy', 'unit' => 'gallon'],
];

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

/* هدر با TTL واقعی هم‌گام است. اگر max-age ثابت می‌ماند، کش مرورگر و
   CDN داده را کهنه‌تر از چیزی که سرور دارد سرو می‌کرد و کم‌کردن TTL
   هیچ اثری برای کاربر نداشت. */
$ttl = effectiveTtl();
header('Cache-Control: public, max-age=' . $ttl);

$cacheDir  = __DIR__ . '/cache';
$cacheFile = $cacheDir . '/rates.json';

/* زودتر از قبل ساخته می‌شود: فایل قفل و فایل عقب‌نشینی هم اینجا
   می‌نشینند و خیلی پیش از نوشتنِ کش لازم می‌شوند. */
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0775, true);
}

/* ── کش تازه؟ همان را بده و تمام ─────────────────────────────── */
$cached = null;
if (is_readable($cacheFile)) {
    $raw = @file_get_contents($cacheFile);
    if ($raw !== false) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && !empty($decoded['assets'])) {
            $cached = $decoded;
            $age = time() - (int) ($decoded['fetched_unix'] ?? 0);
            if ($age >= 0 && $age < $ttl) {
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

/* ── عقب‌نشینی بعد از خطای بالادست ───────────────────────────────
   BrsApi کلید را وقتی از سقف رد شود مسدود می‌کند، و در صفحهٔ هشدارش
   نوشته ادامهٔ کوبیدن یعنی مسدودی دائمِ حساب. تا پیش از این هیچ
   عقب‌نشینی‌ای نبود: کلیدِ مسدود هم هر بار که کش منقضی می‌شد دوباره
   صدا زده می‌شد، یعنی دقیقاً همان رفتاری که هشدار داده‌اند.

   حالا بعد از هر شکست تا مدتی اصلاً به بالادست دست نمی‌زنیم و همان
   کش قدیمی سرو می‌شود. مسدودی کلید تا بازنشدنِ سهمیه برطرف نمی‌شود،
   پس عقب‌نشینی‌اش بلند است؛ خطای گذرا زود دوباره امتحان می‌شود. */
const BACKOFF_FILE       = __DIR__ . '/cache/backoff.json';
const BACKOFF_BLOCKED    = 1800;
const BACKOFF_TRANSIENT  = 120;

/* اثرانگشت کلید، نه خود کلید: فایل عقب‌نشینی نباید هیچ‌وقت کلید را
   روی دیسک نگه دارد. */
function keyFingerprint(string $key): string
{
    return substr(hash('sha256', $key), 0, 16);
}

function backoffUntil(string $key): array
{
    if (!is_readable(BACKOFF_FILE)) {
        return [0, ''];
    }
    $decoded = json_decode((string) @file_get_contents(BACKOFF_FILE), true);
    if (!is_array($decoded)) {
        return [0, ''];
    }

    /* عقب‌نشینی به کلیدی تعلق دارد که شکست خورده. با کلید تازه باید
       بلافاصله دوباره امتحان شود، وگرنه بعد از تعویض کلیدِ مسدود
       نیم‌ساعت الکی صبر می‌کردیم. */
    if ((string) ($decoded['key'] ?? '') !== keyFingerprint($key)) {
        return [0, ''];
    }

    return [(int) ($decoded['until'] ?? 0), (string) ($decoded['reason'] ?? '')];
}

function recordFailure(string $reason, int $code, string $key): void
{
    /* ۴۰۳ و ۴۲۹ یعنی سهمیه؛ اینها با تلاش دوباره درست نمی‌شوند. */
    $cooldown = in_array($code, [401, 403, 429], true) ? BACKOFF_BLOCKED : BACKOFF_TRANSIENT;
    @file_put_contents(
        BACKOFF_FILE,
        json_encode([
            'until'  => time() + $cooldown,
            'reason' => $reason,
            'key'    => keyFingerprint($key),
        ], JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
}

function clearBackoff(): void
{
    if (is_file(BACKOFF_FILE)) {
        @unlink(BACKOFF_FILE);
    }
}

/* ── فقط یک تازه‌سازی هم‌زمان ────────────────────────────────────
   کش قفل نداشت، پس وقتی منقضی می‌شد هر درخواستی که هم‌زمان می‌رسید
   جداگانه به بالادست می‌زد. یک لحظه ترافیک یعنی چند برابر شدن مصرف
   سهمیه — همان چیزی که کلید را به سقف رساند.

   قفل نابلاک‌کننده است: هر که نگرفت منتظر نمی‌ماند، کش قبلی را
   می‌گیرد. چند ثانیه قدیمی‌تر بودنِ نرخ از سوزاندن سهمیه بهتر است. */
function acquireRefreshLock()
{
    $handle = @fopen(__DIR__ . '/cache/refresh.lock', 'c');
    if ($handle === false) {
        return null;
    }
    if (!flock($handle, LOCK_EX | LOCK_NB)) {
        fclose($handle);
        return false;
    }

    return $handle;
}

/* ── تماس با بالادست ─────────────────────────────────────────────
   ریدایرکت را دنبال می‌کند: BrsApi گاهی به‌جای کد خطای صریح، ۳۰۲
   می‌دهد و بدون دنبال‌کردن، پاسخ سالمِ پشتِ ریدایرکت هم از دست
   می‌رفت.

   هدر Location و تکه‌ای از بدنه را هم برمی‌گرداند تا وقتی بالادست
   خطا داد بشود از بیرون فهمید چرا. بدون این، `upstream_http_302`
   تنها چیزی بود که می‌دیدیم و فرقی بین «سهمیه تمام شد» و «آی‌پی
   بلاک شد» نمی‌گذاشت. */
function upstreamGet(string $url): array
{
    $channel = curl_init($url);
    curl_setopt_array($channel, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => UPSTREAM_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_USERAGENT      => 'tabdex-rates/1.0 (+https://tabdex.ir)',
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
    ]);
    $body = curl_exec($channel);
    $info = curl_getinfo($channel);
    $err  = curl_error($channel);
    curl_close($channel);

    return [
        'body'      => $body,
        'code'      => (int) ($info['http_code'] ?? 0),
        'effective' => (string) ($info['url'] ?? ''),
        'hops'      => (int) ($info['redirect_count'] ?? 0),
        'error'     => $err,
    ];
}

/* کلید داخل query string است و `reason` در پاسخ عمومی JSON دیده
   می‌شود. پس هر چیزی که ثبت می‌کنیم اول باید کلید را از دست بدهد. */
function redactKey(string $text): string
{
    return (string) preg_replace('/([?&]key=)[^&\s]*/i', '$1***', $text);
}

/* ── مسطح‌کردن پاسخ بالادست ──────────────────────────────────────
   BrsApi سه شکل مختلف برمی‌گرداند و کدام‌یک را می‌دهد جایی مستند نیست:
   گاهی لیست تخت، گاهی زیر کلید data، و گاهی بخش‌بندی‌شده — مثل
   Commodity که ردیف‌هایش زیر metal_precious، metal_base و energy
   نشسته‌اند. همین یکی باعث شد دستهٔ انرژی خالی منتشر شود: حلقه روی
   آرایه‌ها می‌رفت و هیچ نمادی پیدا نمی‌کرد.

   این تابع هر سه شکل را می‌پذیرد و فقط ردیف‌های نمادداری را برمی‌گرداند. */
function flattenSymbolRows(array $payload): array
{
    if (is_array($payload['data'] ?? null)) {
        $payload = $payload['data'];
    }

    $rows = [];
    foreach ($payload as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (isset($item['symbol'])) {
            $rows[] = $item;
            continue;
        }
        foreach ($item as $child) {
            if (is_array($child) && isset($child['symbol'])) {
                $rows[] = $child;
            }
        }
    }

    return $rows;
}

/* شرحی که بشود با آن عیب را تشخیص داد، نه فقط یک عدد. */
function upstreamReason(array $res): string
{
    $reason = 'upstream_http_' . $res['code'];

    if ($res['error'] !== '') {
        $reason .= ' curl=' . redactKey($res['error']);
    }
    if ($res['hops'] > 0) {
        $reason .= ' via=' . redactKey($res['effective']);
    }
    if (is_string($res['body']) && $res['body'] !== '') {
        $snippet = (string) preg_replace('/\s+/', ' ', mb_substr($res['body'], 0, 200));
        $reason .= ' body=' . redactKey(trim($snippet));
    }

    return $reason;
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
[$blockedUntil, $blockedReason] = backoffUntil($key);
if ($blockedUntil > time()) {
    serveStale($cached, 'backoff ' . $blockedReason);
}

$lock = acquireRefreshLock();
if ($lock === false) {
    serveStale($cached, 'refresh_in_progress');
}

countUpstreamCall();
$upstream = upstreamGet(UPSTREAM_URL . '?key=' . urlencode($key));
$body     = $upstream['body'];

if ($body === false || $upstream['code'] !== 200) {
    $reason = upstreamReason($upstream);
    recordFailure($reason, $upstream['code'], $key);
    serveStale($cached, $reason);
}

clearBackoff();

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
$usdChange = 0.0;
foreach ($payload as $section) {
    if (!is_array($section)) {
        continue;
    }
    foreach ($section as $row) {
        if (is_array($row) && ($row['symbol'] ?? '') === 'USD') {
            $usdToman = (float) ($row['price'] ?? 0);
            $usdChange = (float) ($row['change_percent'] ?? 0);
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
        $rowChange = (float) ($row['change_percent'] ?? 0);
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

        $tomanChange = $rowChange;
        if ($symbol === 'XAUUSD') {
            $tomanChange = ((1 + $rowChange / 100) * (1 + $usdChange / 100) - 1) * 100;
        }

        $meta = ASSET_MAP[$symbol];
        $assets[$meta['id']] = [
            'toman'  => $price,
            'usd'    => $usdPrice,
            'group'  => $meta['group'],
            'unit'   => $meta['unit'],
            'name'   => (string) ($row['name'] ?? $meta['id']),
            'change' => $rowChange,
            'toman_change' => $tomanChange,
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
    /* همان کلید و همان سهمیه؛ پس همان عقب‌نشینی. */
    [$imeBlockedUntil] = backoffUntil($key);
    $imeResult = $imeBlockedUntil > time()
        ? ['body' => false, 'code' => 0, 'effective' => '', 'hops' => 0, 'error' => 'backoff']
        : (static function () use ($key) {
            countUpstreamCall();

            return upstreamGet(IME_URL . '?key=' . urlencode($key));
        })();
    $imeBody   = $imeResult['body'];
    $imeCode   = $imeResult['code'];

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

/* ── انرژی: نفت برنت و بنزین ─────────────────────────────────────
   کش مستقل، چون عمرش با نرخ‌های ایرانی فرق دارد: بازار آتی آمریکا
   شبانه‌روز باز است ولی آن‌قدر پرنوسان نیست که ارزش تازه‌سازی دقیقه‌ای
   داشته باشد. وقتی هم بسته است اصلاً ارزش پرسیدن ندارد.

   مثل بورس کالا، شکست این بخش نباید بقیهٔ نرخ‌ها را از بین ببرد. */
$energyCacheFile = $cacheDir . '/energy.json';
$energyRows      = null;
$energyDecoded   = null;

require_once __DIR__ . '/market-history.php';
$energyTtl = energyMarketIsOpen(time()) ? ENERGY_TTL_OPEN : ENERGY_TTL_CLOSED;

if (is_readable($energyCacheFile)) {
    $energyRaw = @file_get_contents($energyCacheFile);
    if ($energyRaw !== false) {
        $energyDecoded = json_decode($energyRaw, true);
        if (is_array($energyDecoded) && isset($energyDecoded['data'])) {
            $energyAge = time() - (int) ($energyDecoded['fetched_unix'] ?? 0);
            if ($energyAge >= 0 && $energyAge < $energyTtl) {
                $energyRows = $energyDecoded['data'];
            }
        }
    }
}

if ($energyRows === null) {
    /* همان کلید و همان سهمیه، پس همان عقب‌نشینی. */
    [$energyBlockedUntil] = backoffUntil($key);
    $energyResult = $energyBlockedUntil > time()
        ? ['body' => false, 'code' => 0, 'effective' => '', 'hops' => 0, 'error' => 'backoff']
        : (static function () use ($key) {
            countUpstreamCall();

            return upstreamGet(COMMODITY_URL . '?key=' . urlencode($key));
        })();

    if ($energyResult['body'] !== false && $energyResult['code'] === 200) {
        $energyPayload = json_decode((string) $energyResult['body'], true);
        if (is_array($energyPayload)) {
            // پاسخ Commodity بخش‌بندی‌شده است؛ مسطح‌سازی هر سه شکل را می‌پذیرد.
            $energyRows = flattenSymbolRows($energyPayload);
            $energyEncoded = json_encode(
                ['fetched_unix' => time(), 'data' => $energyRows],
                JSON_UNESCAPED_UNICODE
            );
            $energyTemp = $energyCacheFile . '.' . getmypid() . '.tmp';
            if (@file_put_contents($energyTemp, $energyEncoded) !== false) {
                @rename($energyTemp, $energyCacheFile);
            }
        }
    }

    // اگر تازه‌سازی نشد، کش قدیمی بهتر از هیچ است.
    if ($energyRows === null && is_array($energyDecoded) && isset($energyDecoded['data'])) {
        $energyRows = $energyDecoded['data'];
    }
}

if (is_array($energyRows)) {
    // کشی که نسخهٔ قبلی نوشته هنوز بخش‌بندی‌شده است؛ مسطح‌سازی روی ردیف
    // تخت بی‌اثر است، پس کش قدیم و جدید هر دو درست خوانده می‌شوند.
    foreach (flattenSymbolRows($energyRows) as $row) {
        if (!is_array($row) || !isset($row['symbol'])) {
            continue;
        }
        $symbol = (string) $row['symbol'];
        if (!isset(ENERGY_MAP[$symbol])) {
            continue;
        }
        $usdPrice = (float) ($row['price'] ?? 0);
        // بدون نرخ دلار نمی‌شود تومانی داد، و عدد دلاری در گراف تومانی
        // هزاران برابر غلط می‌شد. پس قلم را می‌اندازیم بیرون.
        if ($usdPrice <= 0 || $usdToman <= 0) {
            continue;
        }
        $meta = ENERGY_MAP[$symbol];
        $rowChange = (float) ($row['change_percent'] ?? 0);
        $assets[$meta['id']] = [
            'toman'  => $usdPrice * $usdToman,
            'usd'    => $usdPrice,
            'group'  => $meta['group'],
            'unit'   => $meta['unit'],
            'name'   => (string) ($row['name'] ?? $meta['id']),
            'change' => $rowChange,
            // تغییر تومانی، مثل انس طلا، تغییر دلار را هم در خود دارد.
            'toman_change' => ((1 + $rowChange / 100) * (1 + $usdChange / 100) - 1) * 100,
        ];
    }
}

/* ── زمانی که به کاربر نشان داده می‌شود ──────────────────────────
   updated تا امروز بزرگ‌ترین time_unix پاسخ BrsApi بود، یعنی زمانی که
   آن‌ها آخرین بار قیمت را تکان داده‌اند. آن عدد دست ما نیست و می‌تواند
   دقایقی عقب باشد، پس برچسب «آخرین به‌روزرسانی» همیشه از ساعت کاربر
   عقب می‌افتاد — حتی وقتی ما همین ثانیه نرخ را گرفته بودیم.

   حالا updated یعنی «ما آخرین بار کی نرخ را تازه کردیم»، که دقیقاً
   همان چیزی است که برچسب ادعا می‌کند و سقفش هم به اندازهٔ TTL است.
   زمان خودِ منبع در source_updated می‌ماند، چون برای تشخیص کهنه‌بودنِ
   بالادست به کار می‌آید.

   ttl هم بیرون داده می‌شود تا مرورگر بداند کش کی منقضی می‌شود و درست
   همان موقع دوباره بگیرد، نه با فاز دلخواه. */
$result = [
    'updated'        => gmdate('c'),
    'source_updated' => $latest > 0 ? gmdate('c', $latest) : null,
    'fetched_unix'   => time(),
    'ttl'            => $ttl,
    'stale'          => false,
    'assets'         => $assets,
];

$encoded = json_encode($result, JSON_UNESCAPED_UNICODE);
// نوشتن اتمیک تا درخواست هم‌زمان، فایل نیمه‌نوشته نخواند.
$temp = $cacheFile . '.' . getmypid() . '.tmp';
if (@file_put_contents($temp, $encoded) !== false) {
    @rename($temp, $cacheFile);
}

/* ── ثبت نقطهٔ نمودار ────────────────────────────────────────────
   تا امروز تنها منبع نقطه‌های نمودار، کرون GitHub بود. روی کاغذ هر پنج
   دقیقه، ولی GitHub کرون‌های پرتکرار را throttle می‌کند و در عمل هر دو
   تا پنج ساعت یک‌بار اجرا می‌شد — آن هم در ساعتی دلخواه، که اغلب بیرون
   از پنجرهٔ بازار می‌افتاد و همان یکی هم دور ریخته می‌شد. نتیجه: نمودار
   ۲۴ ساعته با یکی دو نقطه، و ساعت‌های شلوغ بازار غایب.

   اینجا بهترین جای ثبت است، چون دقیقاً همان لحظه‌ای است که نرخ تازه
   از بالادست رسیده. سطل پنج‌دقیقه‌ای یعنی تماس‌های دقیقه‌ای حجم فایل را
   بالا نمی‌برند. کرون هم می‌ماند، برای ساعت‌هایی که سایت بازدید ندارد.

   شکست ثبت نباید پاسخ نرخ را از بین ببرد؛ نمودار از نرخ کم‌اهمیت‌تر
   است. قفل رفرش هنوز در دست است، پس دو درخواست هم‌زمان روی هم
   نمی‌نویسند. */
try {
    require_once __DIR__ . '/market-history.php';
    recordHistoryPoints($assets, $result['fetched_unix']);
} catch (Throwable $historyError) {
    // عمداً بی‌صدا: نرخ‌ها باید سرو شوند حتی اگر نمودار ثبت نشود.
}

echo $encoded;
