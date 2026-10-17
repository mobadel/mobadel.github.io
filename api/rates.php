<?php
declare(strict_types=1);

/*
 * پراکسی نرخ طلا، سکه، ارز فیات، فلزات و انرژی — بین مرورگر و منابع می‌نشیند.
 *
 * منابع (از ۲۵ مهر ۱۴۰۵):
 *   طلا، سکه و ارز فیات  ← TGJU (call*.tgju.org/ajax.json)
 *   انس طلا، نفت، بنزین   ← BrsApi Commodity
 *   نقره و مس             ← BrsApi IME/Certificate (بورس کالا)
 *
 * BrsApi اعلام کرد Gold_Currency را دیگر برای طلا و ارز سرویس نمی‌دهد؛
 * از بامداد پنجشنبه ۲۴ مهر همهٔ ردیف‌هایش قیمت صفر داشت. پس طلا و ارز
 * کامل به TGJU رفت و BrsApi فقط برای بورس کالا و Commodity می‌ماند.
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

/* ── TGJU برای طلا، سکه و ارز ───────────────────────────────────
   فید عمومی همان چیزی است که صفحات خود tgju.org با آن زنده می‌شوند.
   کلید و سهمیه ندارد، ولی چند میزبان دارد که هر کدام ممکن است لحظه‌ای
   نرسد؛ پس به ترتیب امتحان می‌شوند. قیمت‌ها ریالی‌اند و رشته با جداکنندهٔ
   هزارگان ("2,648,000"). زمان (ts) به وقت تهران است.

   سمت جهت تغییر: dp همیشه مثبت است و جهت در dt می‌آید ("low" یعنی افت). */
const TGJU_HOSTS   = ['https://call1.tgju.org', 'https://call2.tgju.org', 'https://call3.tgju.org', 'https://call4.tgju.org'];
const TGJU_PATH    = '/ajax.json';
const TGJU_TIMEOUT = 8;
const TGJU_TRIES   = 2;
const TGJU_UA      = 'Mozilla/5.0 (compatible; tabdex-rates/2.0; +https://tabdex.ir)';

/* گواهی سپردهٔ بورس کالا (نقره و مس) اندپوینت جداست و روزی یک‌بار
   تسویه می‌شود، نه لحظه‌ای. پس کش خیلی طولانی‌تری می‌گیرد.

   سهمیهٔ رایگان BrsApi روی همهٔ سرویس‌هایش روی‌هم ۱۵۰۰ درخواست در روز
   است و این عدد از همان بودجه کم می‌کند.

   نیم‌ساعتِ ثابت شبانه‌روز ۴۸ درخواست می‌برد، ولی بورس کالا فقط شنبه
   تا چهارشنبه ۱۲ تا ۱۸ باز است. بیرون از آن پنجره گواهی سپرده اصلاً
   تغییر نمی‌کند، پس پرسیدنش فقط بودجهٔ نرخ‌های لحظه‌ای را می‌خورد.
   با پنجره‌آگاه شدن حدود ۱۵ درخواست می‌شود. */
const IME_TTL_OPEN   = 1800;
const IME_TTL_CLOSED = 21600;
const IME_URL        = 'https://api.brsapi.ir/IME/Certificate.php';

function imeTtl(): int
{
    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
    /* شنبه=۶، یکشنبه=۷، دوشنبه=۱ … چهارشنبه=۳ */
    $open = in_array((int) $now->format('N'), [6, 7, 1, 2, 3], true)
        && (int) $now->format('G') >= 12
        && (int) $now->format('G') < 18;

    return $open ? IME_TTL_OPEN : IME_TTL_CLOSED;
}

/* ── عمر کش بر اساس ساعت بازار ───────────────────────────────────
   TTL ثابتِ ۳۰۰ ثانیه دو جا اشتباه بود: در ساعات بازار برای کاربر
   کند بود، و شب و جمعه که هیچ نرخی تکان نمی‌خورد سهمیه را الکی
   می‌سوزاند. حالا همان بودجه جایی خرج می‌شود که ارزش دارد.

   زیر ۶۰ ثانیه رفتن بی‌فایده است: خود BrsApi زمان هر نرخ را با دقت
   دقیقه می‌دهد ("time":"12:31")، پس تازه‌سازی سریع‌تر از منبع فقط
   سهمیه می‌سوزاند بی‌آنکه عدد تازه‌ای بیاورد. بنابراین بودجه صرف
   پهن‌تر کردن پنجرهٔ یک‌دقیقه‌ای می‌شود، نه کوتاه‌تر کردن دوره.

   حساب بدترین روز (شنبه تا پنجشنبه):
     ۰۸:۰۰–۲۰:۰۰  ۶۰ ثانیه  → ۷۲۰ درخواست
     ۰۷:۰۰–۰۸:۰۰ و ۲۰:۰۰–۲۳:۰۰  ۱۲۰ ثانیه → ۱۲۰
     بقیهٔ ساعات  ۹۰۰ ثانیه → ۳۲
   جمعاً ~۸۷۲، به‌علاوهٔ ~۱۵ بورس کالا و ~۹۰ انرژی ≈ ۹۷۷ از ۱۵۰۰.

   حساب قبلی انرژی را جا انداخته بود و ~۸۱۶ می‌گفت در حالی که واقعیت
   ~۹۵۰ بود؛ همین جا افتادن یک اندپوینت از بودجه، دو بار کلید را به
   سقف رساند. هر اندپوینت تازه باید به این جمع اضافه شود. */
const TTL_MARKET   = 60;
const TTL_SHOULDER = 120;
const TTL_CLOSED   = 900;

function marketTtl(): int
{
    $now  = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
    $hour = (int) $now->format('G');

    /* جمعه بازار ایران تعطیل است؛ نرخ‌ها تا شنبه تکان نمی‌خورند. */
    if ($now->format('N') === '5') {
        return TTL_CLOSED;
    }
    if ($hour >= 8 && $hour < 20) {
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

/* دو مرحله، و مرحلهٔ دوم واقعاً متوقف می‌کند.

   نسخهٔ قبلی فقط یک سقف نرم داشت که TTL را به ۳۰۰ می‌برد ولی همچنان
   ادامه می‌داد — یعنی سقف مؤثرش ۱۲۰۰ + ۲۸۸ ≈ ۱۴۸۸ در برابر محدودیت
   ۱۵۰۰ می‌شد. دوازده درخواست فاصله، ترمز نیست؛ لبهٔ پرتگاه است.

   حالا از QUOTA_SOFT_LIMIT کند می‌شود و از QUOTA_HARD_LIMIT به بعد
   هیچ تماسی با بالادست گرفته نمی‌شود و کش سرو می‌شود. قیمتِ کمی کهنه
   بی‌نهایت بهتر از کلیدِ مسدود است: مسدودی با ریست روزانه باز نمی‌شود
   و فقط پشتیبانی BrsApi رفعش می‌کند — دو بار این را دیدیم. */
const QUOTA_SOFT_LIMIT = 1050;
const QUOTA_HARD_LIMIT = 1300;
const TTL_THROTTLED    = 300;

/* یک‌بار، فقط ۲۵ مهر ۱۴۰۵: باگِ قیمت صفر (PR #104) ۱۳۰۰ تماس را بیهوده
   سوزاند و نفت را تا نیمه‌شب قفل کرد. تا نیمه‌شب با TTL جمعه حدود ۳۰
   تماس لازم است؛ ۶۰ تا جا، و هنوز بیش از ۱۴۰ تا تا سقف ۱۵۰۰ فاصله.
   فردا خودبه‌خود بی‌اثر است. */
function quotaHardLimit(): int
{
    return tehranToday() === '2026-10-16' ? QUOTA_HARD_LIMIT + 60 : QUOTA_HARD_LIMIT;
}

function quotaExhausted(): bool
{
    return quotaToday() >= quotaHardLimit();
}

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
const ENERGY_TTL_OPEN   = 900;
const ENERGY_TTL_CLOSED = 3600;

/* انس طلا هم از همین پاسخ می‌آید (زیر metal_precious). نرخ جهانی است و
   Gold_Currency دیگر آن را نمی‌دهد. */
const ENERGY_MAP = [
    'XAUUSD' => ['id' => 'goldounce', 'group' => 'gold',   'unit' => 'ounce'],
    'BRENT' => ['id' => 'brent',    'group' => 'energy', 'unit' => 'barrel'],
    'RBOB'  => ['id' => 'gasoline', 'group' => 'energy', 'unit' => 'gallon'],
];

/* نمادهای بورس کالا. قیمت‌ها به ریال‌اند. */
const IME_MAP = [
    'SilverBar'  => ['id' => 'silver', 'group' => 'commodity', 'unit' => 'gram'],
    'CopperCthd' => ['id' => 'copper', 'group' => 'commodity', 'unit' => 'kilogram'],
];

/* افزودن دارایی جدید = یک ردیف در همین جدول. کلید، نام نماد در فید TGJU
   است. واحدها با آخرین نرخ سالم BrsApi مقایسه شدند (نسبت ۰٫۹۷ تا ۱٫۰۳،
   یعنی همان دارایی با همان واحد)؛ ین مثل قبل برای ۱۰۰ واحد است.

   USDT_IRT عمداً اینجا نیست: تتر از نوبیتکس می‌آید و دو منبع برای یک
   دارایی یعنی دو نرخ ناسازگار در یک گراف. */
const TGJU_MAP = [
    // طلا
    'geram18' => ['id' => 'gold18',      'group' => 'gold', 'unit' => 'gram'],
    'geram24' => ['id' => 'gold24',      'group' => 'gold', 'unit' => 'gram'],
    'mesghal' => ['id' => 'goldmelted',  'group' => 'gold', 'unit' => 'mesghal'],

    // سکه
    'sekee'   => ['id' => 'emami',       'group' => 'coin', 'unit' => 'piece'],
    'sekeb'   => ['id' => 'bahar',       'group' => 'coin', 'unit' => 'piece'],
    'nim'     => ['id' => 'halfcoin',    'group' => 'coin', 'unit' => 'piece'],
    'rob'     => ['id' => 'quartercoin', 'group' => 'coin', 'unit' => 'piece'],
    'gerami'  => ['id' => 'gramcoin',    'group' => 'coin', 'unit' => 'piece'],

    // ارز فیات
    'price_dollar_rl' => ['id' => 'usd', 'group' => 'fiat', 'unit' => 'unit'],
    'price_eur' => ['id' => 'eur', 'group' => 'fiat', 'unit' => 'unit'],
    'price_gbp' => ['id' => 'gbp', 'group' => 'fiat', 'unit' => 'unit'],
    'price_chf' => ['id' => 'chf', 'group' => 'fiat', 'unit' => 'unit'],
    'price_aed' => ['id' => 'aed', 'group' => 'fiat', 'unit' => 'unit'],
    'price_try' => ['id' => 'try', 'group' => 'fiat', 'unit' => 'unit'],
    'price_jpy' => ['id' => 'jpy', 'group' => 'fiat', 'unit' => 'unit'],
    'price_cny' => ['id' => 'cny', 'group' => 'fiat', 'unit' => 'unit'],
    'price_aud' => ['id' => 'aud', 'group' => 'fiat', 'unit' => 'unit'],
    'price_cad' => ['id' => 'cad', 'group' => 'fiat', 'unit' => 'unit'],
    'price_rub' => ['id' => 'rub', 'group' => 'fiat', 'unit' => 'unit'],
    'price_sek' => ['id' => 'sek', 'group' => 'fiat', 'unit' => 'unit'],
    'price_inr' => ['id' => 'inr', 'group' => 'fiat', 'unit' => 'unit'],
    'price_pkr' => ['id' => 'pkr', 'group' => 'fiat', 'unit' => 'unit'],
    'price_afn' => ['id' => 'afn', 'group' => 'fiat', 'unit' => 'unit'],
    'price_myr' => ['id' => 'myr', 'group' => 'fiat', 'unit' => 'unit'],
    'price_thb' => ['id' => 'thb', 'group' => 'fiat', 'unit' => 'unit'],
    'price_sar' => ['id' => 'sar', 'group' => 'fiat', 'unit' => 'unit'],
    'price_qar' => ['id' => 'qar', 'group' => 'fiat', 'unit' => 'unit'],
    'price_kwd' => ['id' => 'kwd', 'group' => 'fiat', 'unit' => 'unit'],
    'price_bhd' => ['id' => 'bhd', 'group' => 'fiat', 'unit' => 'unit'],
    'price_omr' => ['id' => 'omr', 'group' => 'fiat', 'unit' => 'unit'],
    'price_iqd' => ['id' => 'iqd', 'group' => 'fiat', 'unit' => 'unit'],
    'price_syp' => ['id' => 'syp', 'group' => 'fiat', 'unit' => 'unit'],
    'price_azn' => ['id' => 'azn', 'group' => 'fiat', 'unit' => 'unit'],
    'price_amd' => ['id' => 'amd', 'group' => 'fiat', 'unit' => 'unit'],
    'price_gel' => ['id' => 'gel', 'group' => 'fiat', 'unit' => 'unit'],
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

/* وضعیت بازارها در لحظهٔ پاسخ، نه لحظهٔ ساخت کش: کش یک ساعته هم نباید
   بازارِ تازه‌بسته را «باز» نشان دهد. پس به هر پاسخ جدا افزوده می‌شود. */
require_once __DIR__ . '/market-history.php';
function withMarketStatus(array $payload): array {
    $payload['markets'] = marketStatusMap(time());
    return $payload;
}

/* ── تازه‌سازی زمان‌بندی‌شده ──────────────────────────────────────
   نرخ نباید منتظر بازدید بماند. refresh.php (یا اجرای خط فرمانِ همین
   فایل) را یک کرون هر دقیقه صدا می‌زند و آن، کش را کمی زودتر از انقضا
   تازه می‌کند. بدون این حاشیه، کرون دقیقه‌ای با کش ۶۰ ثانیه‌ای اغلب
   کشِ ۵۹ ثانیه‌ای را «هنوز تازه» می‌دید و تازه‌سازی عملاً دو دقیقه‌ای
   می‌شد. بیرون از بازار (کش ۱۵ دقیقه) همان کرون دقیقه‌ای کاری نمی‌کند
   تا ربع ساعت پر شود.

   بی‌خطر است حتی اگر هر کسی صدایش بزند: باز هم حداکثر هر ۴۰ ثانیه
   یک‌بار تازه می‌شود، و BrsApi کش‌های طولانی خودش را دارد. */
function isCronRefresh(): bool
{
    return PHP_SAPI === 'cli' || (defined('TABDEX_CRON') && TABDEX_CRON);
}

function cronMargin(int $ttl): int
{
    return isCronRefresh() ? min(20, intdiv($ttl, 3)) : 0;
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
            if ($age >= 0 && $age < $ttl - cronMargin($ttl)) {
                echo json_encode(withMarketStatus($decoded), JSON_UNESCAPED_UNICODE);
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
function upstreamGet(string $url, int $timeout = UPSTREAM_TIMEOUT, string $agent = 'tabdex-rates/1.0 (+https://tabdex.ir)'): array
{
    $channel = curl_init($url);
    curl_setopt_array($channel, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => min(8, $timeout),
        CURLOPT_USERAGENT      => $agent,
        CURLOPT_ENCODING       => '',
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
        $cached['quota']  = ['used' => quotaToday(), 'limit' => quotaHardLimit()];
        echo json_encode(withMarketStatus($cached), JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(503);
        echo json_encode([
            'updated' => null,
            'stale'   => true,
            'reason'  => $reason,
            'quota'   => ['used' => quotaToday(), 'limit' => quotaHardLimit()],
            'assets'  => new stdClass(),
            'markets' => marketStatusMap(time()),
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

/* ── TGJU ─────────────────────────────────────────────────────── */

/* "2,648,000" → 2648000. ارقام فارسی هم پذیرفته می‌شود که اگر روزی فید
   فارسی شد بی‌صدا صفر نشویم. */
function tgjuNumber($value): float
{
    $text = strtr((string) $value, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9', ',' => '', '٬' => '', ' ' => '']);

    return is_numeric($text) ? (float) $text : 0.0;
}

/* dp بدون علامت است؛ dt جهت را می‌گوید. */
function tgjuChange(array $row): float
{
    $percent = abs((float) ($row['dp'] ?? 0));

    return ((string) ($row['dt'] ?? '')) === 'low' ? -$percent : $percent;
}

function tgjuTime(array $row): int
{
    $ts = (string) ($row['ts'] ?? '');
    if ($ts === '') {
        return 0;
    }
    try {
        return (new DateTimeImmutable($ts, new DateTimeZone('Asia/Tehran')))->getTimestamp();
    } catch (Throwable $error) {
        return 0;
    }
}

/* [ردیف‌ها, شرح]. ردیف‌ها null یعنی هیچ میزبانی پاسخ قابل‌استفاده نداد. */
function fetchTgju(): array
{
    $hosts = TGJU_HOSTS;
    /* شروع از میزبانی تصادفی تا بار روی یکی نیفتد و اگر یکی کند شد همه‌ی
       درخواست‌ها پشتش نمانند. */
    $offset = random_int(0, count($hosts) - 1);
    $hosts  = array_merge(array_slice($hosts, $offset), array_slice($hosts, 0, $offset));

    $reasons = [];
    foreach (array_slice($hosts, 0, TGJU_TRIES) as $host) {
        /* بدون rev، CDN میزبان‌ها نسخهٔ ۳۰ تا ۵۵ دقیقه کهنه می‌دهد (۲۵ مهر
           دیده شد: call4 ساعت ۱۲:۰۱ را می‌داد وقتی ساعت ۱۲:۵۶ بود). با rev
           نرخ چندثانیه‌ای می‌آید. */
        $res = upstreamGet($host . TGJU_PATH . '?rev=' . time(), TGJU_TIMEOUT, TGJU_UA);
        $label = parse_url($host, PHP_URL_HOST);
        if ($res['body'] === false || $res['code'] !== 200) {
            $reasons[] = $label . ' ' . upstreamReason($res);
            continue;
        }
        $decoded = json_decode((string) $res['body'], true);
        $current = is_array($decoded) ? ($decoded['current'] ?? null) : null;
        if (!is_array($current) || count($current) < 50) {
            $reasons[] = $label . ' not_tgju_json';
            continue;
        }

        return [$current, 'ok ' . $label];
    }

    return [null, implode(' | ', $reasons)];
}

/* قفل پیش از هر تماس بیرونی؛ حالا TGJU هم پشت همین قفل است. */
$lock = acquireRefreshLock();
if ($lock === false) {
    serveStale($cached, 'refresh_in_progress');
}
/* قفل ساخته نشد. با کشِ موجود، کهنه سرو کردن بهتر از تازه‌سازی بی‌قفل
   است — بی‌قفل یعنی هر درخواستِ هم‌زمان جدا به بالادست می‌زند و همین
   بود که بار اول سهمیه را سوزاند. اگر هنوز هیچ کشی نداریم چاره‌ای جز
   ادامه نیست، وگرنه سایت هیچ‌وقت راه نمی‌افتد. */
if ($lock === null && $cached !== null) {
    serveStale($cached, 'refresh_lock_unavailable');
}

$cachedAssets = (is_array($cached) && is_array($cached['assets'] ?? null)) ? $cached['assets'] : [];
$assets  = [];
$carried = [];
$latest  = 0;
/* هر منبع چه شد، در خود پاسخ. پوشهٔ کش از راه وب بسته است و بدون این،
   علت حذف یا کهنه‌ماندن یک دسته فقط حدس می‌ماند. */
$sources = [];

/* قلمی که این بار نرخ تازه نگرفت، آخرین نرخ معتبرش را از کش نگه می‌دارد
   و در carried می‌آید. نمایش نرخ کمی کهنه بهتر از حذف ناگهانی قلم است. */
$carry = static function (string $id) use (&$assets, &$carried, $cachedAssets): void {
    if (!isset($assets[$id]) && is_array($cachedAssets[$id] ?? null)) {
        $assets[$id] = $cachedAssets[$id];
        $carried[]   = $id;
    }
};

[$tgjuRows, $sources['tgju']] = fetchTgju();

foreach (TGJU_MAP as $tgjuKey => $meta) {
    $row  = is_array($tgjuRows) && is_array($tgjuRows[$tgjuKey] ?? null) ? $tgjuRows[$tgjuKey] : null;
    $rial = $row !== null ? tgjuNumber($row['p'] ?? '') : 0.0;
    if ($rial <= 0) {
        $carry($meta['id']);
        continue;
    }
    $change = tgjuChange($row);
    $assets[$meta['id']] = [
        // TGJU همیشه ریال می‌دهد؛ گراف تبدیل تومانی است.
        'toman'  => $rial / 10,
        'usd'    => null,
        'group'  => $meta['group'],
        'unit'   => $meta['unit'],
        'name'   => (string) ($cachedAssets[$meta['id']]['name'] ?? $meta['id']),
        'change' => $change,
        'toman_change' => $change,
    ];
    $latest = max($latest, tgjuTime($row));
}

/* دلار برای تبدیل اقلام دلاری (انس، نفت، بنزین) لازم است. */
$usdToman  = (float) ($assets['usd']['toman'] ?? 0);
$usdChange = (float) ($assets['usd']['change'] ?? 0);

if ($assets === []) {
    serveStale($cached, 'no_mapped_assets tgju=' . $sources['tgju']);
}

/* ── BrsApi: فقط بورس کالا و Commodity ──────────────────────────
   همان کلید، همان سهمیه، همان عقب‌نشینی. بی‌کلید هم سایت بالا می‌ماند:
   طلا و ارز از TGJU می‌آیند و این دو بخش از کش خودشان سرو می‌شوند. */
function brsBlocked(string $key): bool
{
    if ($key === '' || quotaExhausted()) {
        return true;
    }
    [$until] = backoffUntil($key);

    return $until > time();
}

function brsBlockedReason(string $key): string
{
    if ($key === '') {
        return 'missing_key';
    }
    if (quotaExhausted()) {
        return 'quota_exhausted ' . quotaToday() . '/' . quotaHardLimit();
    }
    [, $reason] = backoffUntil($key);

    return 'backoff ' . $reason;
}

/* هر تماس BrsApi نتیجه‌اش را در عقب‌نشینی ثبت می‌کند. تا امروز این کار
   را فقط تماس Gold_Currency می‌کرد؛ حالا که آن تماس نیست، بدون این،
   کلیدِ مسدود هر ربع ساعت دوباره کوبیده می‌شد. */
function brsGet(string $url, string $key): array
{
    countUpstreamCall();
    $res = upstreamGet($url . '?key=' . urlencode($key));
    if ($res['body'] !== false && $res['code'] === 200) {
        clearBackoff();
    } else {
        recordFailure(upstreamReason($res), $res['code'], $key);
    }

    return $res;
}

/* ── بورس کالا: نقره و مس ─────────────────────────────────────
   کش مستقل با عمر طولانی‌تر. اگر این بخش شکست بخورد، بقیهٔ نرخ‌ها
   نباید از دست بروند، پس هیچ خطایی اینجا کل پاسخ را متوقف نمی‌کند.

   ۲۵ مهر نقره و مس یک‌باره از پاسخ افتادند در حالی که BrsApi سالم
   می‌داد: حلقه ردیفِ بی‌قیمت را دور می‌انداخت و جایگزینی از کش
   نداشت. حالا مثل طلا و ارز آخرین نرخ معتبر می‌ماند، پاسخ بی‌قیمت
   ردیف‌های سالم قبلی را در کش پاک نمی‌کند، و بعدش نیم‌ساعته دوباره
   پرسیده می‌شود نه شش‌ساعته. */
$imeCacheFile = $cacheDir . '/ime.json';
$imeRows      = null;
$imeDecoded   = null;
$sources['ime'] = 'cache';

function imeHasPrice($rows): bool
{
    if (!is_array($rows)) {
        return false;
    }
    foreach ($rows as $row) {
        if (is_array($row) && isset(IME_MAP[(string) ($row['contract_code'] ?? '')]) && (float) ($row['pl'] ?? 0) > 0) {
            return true;
        }
    }

    return false;
}

if (is_readable($imeCacheFile)) {
    $imeRaw = @file_get_contents($imeCacheFile);
    if ($imeRaw !== false) {
        $imeDecoded = json_decode($imeRaw, true);
        if (is_array($imeDecoded) && isset($imeDecoded['data'])) {
            $imeAge = time() - (int) ($imeDecoded['fetched_unix'] ?? 0);
            /* تلاشِ بی‌قیمت هم زمانش ثبت می‌شود تا هر درخواست دوباره
               نپرسد؛ ولی نیم‌ساعته دوباره امتحان می‌شود، نه شش‌ساعته. */
            $imeFreshFor = empty($imeDecoded['unpriced']) ? imeTtl() : min(imeTtl(), IME_TTL_OPEN);
            if ($imeAge >= 0 && $imeAge < $imeFreshFor) {
                $imeRows = $imeDecoded['data'];
            }
        }
    }
}

if ($imeRows === null) {
    if (brsBlocked($key)) {
        $sources['ime'] = brsBlockedReason($key);
    } else {
        $imeResult = brsGet(IME_URL, $key);
        if ($imeResult['body'] !== false && $imeResult['code'] === 200) {
            $imePayload = json_decode((string) $imeResult['body'], true);
            $imeData    = is_array($imePayload) ? ($imePayload['data'] ?? null) : null;
            if (imeHasPrice($imeData)) {
                $imeRows = $imeData;
                $sources['ime'] = 'fetched';
                $imeEncoded = json_encode(
                    ['fetched_unix' => time(), 'data' => $imeRows],
                    JSON_UNESCAPED_UNICODE
                );
                $imeTemp = $imeCacheFile . '.' . getmypid() . '.tmp';
                if (@file_put_contents($imeTemp, $imeEncoded) !== false) {
                    @rename($imeTemp, $imeCacheFile);
                }
            } else {
                $sources['ime'] = 'no_priced_rows rows=' . (is_array($imeData) ? count($imeData) : 'none');
                /* ردیف‌های قیمت‌دار قبلی می‌مانند؛ فقط زمان تلاش ثبت می‌شود. */
                $keep = (is_array($imeDecoded) && imeHasPrice($imeDecoded['data'] ?? null))
                    ? $imeDecoded['data']
                    : (is_array($imeData) ? $imeData : []);
                $imeEncoded = json_encode(
                    ['fetched_unix' => time(), 'unpriced' => true, 'data' => $keep],
                    JSON_UNESCAPED_UNICODE
                );
                $imeTemp = $imeCacheFile . '.' . getmypid() . '.tmp';
                if (@file_put_contents($imeTemp, $imeEncoded) !== false) {
                    @rename($imeTemp, $imeCacheFile);
                }
            }
        } else {
            $sources['ime'] = upstreamReason($imeResult);
        }
    }

    // اگر تازه‌سازی نشد، کش قدیمی بهتر از هیچ است.
    if ($imeRows === null && is_array($imeDecoded) && is_array($imeDecoded['data'] ?? null)) {
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
foreach (IME_MAP as $meta) {
    $carry($meta['id']);
}

/* ── Commodity: انس طلا، نفت برنت و بنزین ────────────────────────
   کش مستقل، چون عمرش با نرخ‌های ایرانی فرق دارد: بازار آتی آمریکا
   شبانه‌روز باز است ولی آن‌قدر پرنوسان نیست که ارزش تازه‌سازی دقیقه‌ای
   داشته باشد. وقتی هم بسته است اصلاً ارزش پرسیدن ندارد.

   مثل بورس کالا، شکست این بخش نباید بقیهٔ نرخ‌ها را از بین ببرد. */
$energyCacheFile = $cacheDir . '/energy.json';
$energyRows      = null;
$energyDecoded   = null;
$sources['commodity'] = 'cache';

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
    if (brsBlocked($key)) {
        $sources['commodity'] = brsBlockedReason($key);
    } else {
        $energyResult = brsGet(COMMODITY_URL, $key);
        if ($energyResult['body'] !== false && $energyResult['code'] === 200) {
            $energyPayload = json_decode((string) $energyResult['body'], true);
            if (is_array($energyPayload)) {
                // پاسخ Commodity بخش‌بندی‌شده است؛ مسطح‌سازی هر سه شکل را می‌پذیرد.
                $energyRows = flattenSymbolRows($energyPayload);
                $sources['commodity'] = 'fetched';
                $energyEncoded = json_encode(
                    ['fetched_unix' => time(), 'data' => $energyRows],
                    JSON_UNESCAPED_UNICODE
                );
                $energyTemp = $energyCacheFile . '.' . getmypid() . '.tmp';
                if (@file_put_contents($energyTemp, $energyEncoded) !== false) {
                    @rename($energyTemp, $energyCacheFile);
                }
            } else {
                $sources['commodity'] = 'upstream_not_json';
            }
        } else {
            $sources['commodity'] = upstreamReason($energyResult);
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
        // تغییر تومانی، تغییر دلار را هم در خود دارد.
        $tomanChange = ((1 + $rowChange / 100) * (1 + $usdChange / 100) - 1) * 100;
        $assets[$meta['id']] = [
            'toman'  => $usdPrice * $usdToman,
            'usd'    => $usdPrice,
            'group'  => $meta['group'],
            'unit'   => $meta['unit'],
            'name'   => (string) ($row['name'] ?? $meta['id']),
            'change' => $rowChange,
            'toman_change' => $tomanChange,
        ];
    }
}
foreach (ENERGY_MAP as $meta) {
    $carry($meta['id']);
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
// همهٔ نرخ‌های ایرانی از کش آمده‌اند؟ زمان منبع هم همان قبلی است.
$sourceUpdated = $latest > 0 ? gmdate('c', $latest) : ($cached['source_updated'] ?? null);

$result = [
    'updated'        => gmdate('c'),
    'source_updated' => $sourceUpdated,
    'fetched_unix'   => time(),
    'ttl'            => $ttl,
    /* مصرف امروز در خودِ پاسخ می‌آید. پوشهٔ کش از راه وب بسته است و
       وقتی کلید مسدود شد هیچ راهی نبود بفهمیم شمارنده کجاست — بدون
       این عدد، علت فقط حدس می‌ماند. حساس نیست. */
    'quota'          => ['used' => quotaToday(), 'limit' => quotaHardLimit()],
    'stale'          => false,
    'carried'        => $carried,
    'sources'        => $sources,
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
    // نرخ منتقل‌شده از کش نقطهٔ تازه نیست و نمودار را صاف و دروغین می‌کرد.
    recordHistoryPoints(array_diff_key($assets, array_flip($carried)), $result['fetched_unix']);
} catch (Throwable $historyError) {
    // عمداً بی‌صدا: نرخ‌ها باید سرو شوند حتی اگر نمودار ثبت نشود.
}

echo json_encode(withMarketStatus($result), JSON_UNESCAPED_UNICODE);
