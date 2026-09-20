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

$id = strtolower((string) ($_GET['asset'] ?? ''));
if (!preg_match('/^[a-z0-9]+$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_asset']);
    exit;
}
$seed = historyReadJson(HISTORY_SEED_FILE);
$dynamic = historyReadJson(HISTORY_CACHE_FILE);
$merged = [];
/* فیلتر روزهای تعطیل اینجا هم اعمال می‌شود، نه فقط هنگام ثبت. قاعدهٔ
   ساعت کاری بعداً اضافه شد و نقطه‌هایی که پیش از آن ثبت شده بودند در
   نمودار مانده‌اند — مثلاً جمعه ۱۳ شهریور ۱۴۰۵. فیلتر هنگام خواندن،
   مستقل از اینکه نقطه کِی ثبت شده، تعطیلی را از نمودار بیرون می‌گذارد. */
$group = assetGroup($id);
foreach ([$seed, $dynamic] as $source) {
    foreach (($source['assets'][$id] ?? []) as $point) {
        if (!is_array($point) || !isset($point[0], $point[1])) continue;
        $time = (int) $point[0]; $price = (float) $point[1];
        if ($time <= 0 || $price <= 0) continue;
        if (!marketDayIsOpen($group, $time)) continue;
        $merged[$time] = [$time, $price];
    }
}
ksort($merged, SORT_NUMERIC);
echo json_encode(['asset' => $id, 'unit' => 'toman', 'points' => array_values($merged)], JSON_UNESCAPED_UNICODE);
