<?php
declare(strict_types=1);

/* تاریخچهٔ نمودارهای طلا، سکه و ارز.
 * بخش بلندمدت از data/market-history.json می‌آید و اسنپ‌شات‌های پنج‌دقیقه‌ای
 * BRS در cache/market-history.json نگهداری می‌شوند. کلید هرگز به مرورگر
 * برنمی‌گردد؛ فقط گردش‌کار GitHub برای ثبت اسنپ‌شات آن را در هدر می‌فرستد.
 *
 * منطق ساعت بازار و نوشتن نقطه در market-history.php است، چون rates.php
 * هم همان را صدا می‌زند. */

require __DIR__ . '/market-history.php';

header('Content-Type: application/json; charset=utf-8');

// سقف شمار دارایی در یک درخواست خلاصهٔ روزانه؛ بزرگ‌ترین دسته (ارز) ۲۷ تاست.
const HISTORY_BATCH_LIMIT = 40;
header('Cache-Control: public, max-age=60');

function configKey(): string {
    $key = getenv('HISTORY_CAPTURE_TOKEN') ?: '';
    if ($key === '' && is_readable(__DIR__ . '/config.php')) {
        $config = require __DIR__ . '/config.php';
        $key = is_array($config) ? (string) ($config['history_capture_token'] ?? '') : '';
    }
    return $key;
}

/* گروه دارایی از کش نرخ‌ها می‌آید؛ همان‌جایی که ثبت اسنپ‌شات هم از آن
   می‌خواند. اگر پیدا نشد رشتهٔ خالی برمی‌گردد و آن‌وقت هیچ فیلتری
   اعمال نمی‌شود — ارز دیجیتال دقیقاً همین حالت است و بازارش تعطیلی
   ندارد. */
function assetGroup(string $id): string {
    $rates = historyReadJson(HISTORY_RATES_FILE);
    return (string) ($rates['assets'][$id]['group'] ?? '');
}

/* ثبت دستی از راه کرون. تور ایمنی است، نه مسیر اصلی: rates.php خودش
   هر بار که کش را تازه می‌کند نقطه ثبت می‌کند، چون کرون GitHub در عمل
   هر دو تا پنج ساعت یک‌بار اجرا می‌شود و نه هر پنج دقیقه. */
function capture(): array {
    $key = configKey();
    $provided = (string) ($_SERVER['HTTP_X_TABDEX_INTERNAL_KEY'] ?? '');
    if ($key === '' || !hash_equals($key, $provided)) {
        http_response_code(403);
        return ['error' => 'forbidden'];
    }
    $rates = historyReadJson(HISTORY_RATES_FILE);
    if (empty($rates['assets']) || !is_array($rates['assets'])) {
        http_response_code(503);
        return ['error' => 'rates_unavailable'];
    }
    $time = recordHistoryPoints($rates['assets'], (int) ($rates['fetched_unix'] ?? time()));
    $history = historyReadJson(HISTORY_CACHE_FILE);

    return ['ok' => true, 'captured_at' => $time, 'assets' => count($history['assets'] ?? [])];
}

if (($_GET['capture'] ?? '') === '1') {
    echo json_encode(capture(), JSON_UNESCAPED_UNICODE);
    exit;
}

/* حالت خلاصهٔ روزانه برای چند دارایی در یک درخواست: نمودارهای کوچک
   صفحهٔ اصلی و جدول دسته‌ها. بدون این، هر ردیف یک درخواست جدا با کل
   تاریخچهٔ چندساله می‌زد. فقط قیمت پایانی هر روز برمی‌گردد. */
if (isset($_GET['assets'])) {
    $ids = array_values(array_unique(array_filter(
        array_map('trim', explode(',', strtolower((string) $_GET['assets']))),
        static fn($id) => $id !== ''
    )));
    $valid = $ids && count($ids) <= HISTORY_BATCH_LIMIT;
    foreach ($ids as $id) if (!preg_match('/^[a-z0-9]+$/', $id)) $valid = false;
    if (!$valid) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_assets']);
        exit;
    }
    $days = (int) ($_GET['days'] ?? 30);
    $days = max(2, min(400, $days));
    $since = time() - $days * 86400;
    $seed = historyReadJson(HISTORY_SEED_FILE);
    $dynamic = historyReadJson(HISTORY_CACHE_FILE);
    $rates = historyReadJson(HISTORY_RATES_FILE);
    $result = [];
    foreach ($ids as $id) {
        $group = (string) ($rates['assets'][$id]['group'] ?? '');
        $result[$id] = historyDailyCloses(historyMergedPoints($id, $group, $seed, $dynamic), $since);
    }
    header('Cache-Control: public, max-age=300');
    echo json_encode(['unit' => 'toman', 'days' => $days, 'assets' => $result], JSON_UNESCAPED_UNICODE);
    exit;
}

$id = strtolower((string) ($_GET['asset'] ?? ''));
if (!preg_match('/^[a-z0-9]+$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_asset']);
    exit;
}
/* فیلتر روزهای تعطیل اینجا هم اعمال می‌شود، نه فقط هنگام ثبت. قاعدهٔ
   ساعت کاری بعداً اضافه شد و نقطه‌هایی که پیش از آن ثبت شده بودند در
   نمودار مانده‌اند — مثلاً جمعه ۱۳ شهریور ۱۴۰۵. فیلتر هنگام خواندن،
   مستقل از اینکه نقطه کِی ثبت شده، تعطیلی را از نمودار بیرون می‌گذارد. */
$points = historyMergedPoints($id, assetGroup($id), historyReadJson(HISTORY_SEED_FILE), historyReadJson(HISTORY_CACHE_FILE));
echo json_encode(['asset' => $id, 'unit' => 'toman', 'points' => $points], JSON_UNESCAPED_UNICODE);
