<?php
declare(strict_types=1);

/* تاریخچهٔ نمودارهای طلا، سکه و ارز.
 * بخش بلندمدت از data/market-history.json می‌آید و اسنپ‌شات‌های پنج‌دقیقه‌ای
 * BRS در cache/market-history.json نگهداری می‌شوند. کلید هرگز به مرورگر
 * برنمی‌گردد؛ فقط گردش‌کار GitHub برای ثبت اسنپ‌شات آن را در هدر می‌فرستد. */

const CACHE_FILE = __DIR__ . '/cache/market-history.json';
const SEED_FILE = __DIR__ . '/../data/market-history.json';
const RATES_FILE = __DIR__ . '/cache/rates.json';

/* تعطیلات رسمی سال ۱۴۰۵، طبق https://www.bahesab.ir/time/1405/ .
 * این فهرست فقط جلوی ذخیرهٔ اسنپ‌شات‌های جدید را می‌گیرد؛ به دادهٔ
 * تاریخی منتشرشده هیچ تغییری نمی‌دهد. */
const OFFICIAL_HOLIDAYS_1405 = [
    '2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-04-01', '2026-04-02',
    '2026-04-14', '2026-05-27', '2026-06-04', '2026-06-05', '2026-06-24', '2026-06-25',
    '2026-08-04', '2026-08-12', '2026-08-13', '2026-08-21', '2026-08-30', '2026-11-13',
    '2026-12-23', '2027-01-06', '2027-01-24', '2027-02-11', '2027-02-28', '2027-03-10',
    '2027-03-11', '2027-03-20',
];

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

function readJson(string $path): array {
    if (!is_readable($path)) return [];
    $decoded = json_decode((string) file_get_contents($path), true);
    return is_array($decoded) ? $decoded : [];
}

function writeJson(string $path, array $payload): bool {
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) return false;
    return file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

/* آیا بازار در آن روز اصلاً باز بوده؟ تعطیل رسمی یا روزِ تعطیلِ هفته.
   عمداً به ساعت کاری نگاه نمی‌کند: دادهٔ بلندمدت یک بستهٔ روزانه با
   تایم‌استمپ ۰۳:۳۰ تهران است و معیار ساعتی هر ۳۸۰۰ نقطهٔ تاریخی را
   دور می‌ریخت. */
function marketDayIsOpen(string $group, int $time): bool {
    if (!in_array($group, ['fiat', 'gold', 'coin', 'commodity'], true)) return true;
    $tehran = (new DateTimeImmutable('@' . $time))->setTimezone(new DateTimeZone('Asia/Tehran'));
    if (in_array($tehran->format('Y-m-d'), OFFICIAL_HOLIDAYS_1405, true)) return false;
    $weekday = (int) $tehran->format('N'); // دوشنبه=۱ … پنجشنبه=۴، جمعه=۵، شنبه=۶
    // بورس کالا پنجشنبه‌ها هم بسته است، برخلاف بازار طلا و ارز.
    return in_array($weekday, $group === 'commodity' ? [6, 7, 1, 2, 3] : [6, 7, 1, 2, 3, 4], true);
}

function marketIsOpen(string $group, int $time): bool {
    if (!marketDayIsOpen($group, $time)) return false;
    if (!in_array($group, ['fiat', 'gold', 'coin', 'commodity'], true)) return true;
    $tehran = (new DateTimeImmutable('@' . $time))->setTimezone(new DateTimeZone('Asia/Tehran'));
    $weekday = (int) $tehran->format('N');
    $hour = (int) $tehran->format('G');
    if ($group === 'commodity') return $hour >= 12 && $hour < 18;
    if ($weekday === 4) return $hour >= 11 && $hour < 18;
    return $hour >= 11 && $hour < 20;
}

/* گروه دارایی از کش نرخ‌ها می‌آید؛ همان‌جایی که ثبت اسنپ‌شات هم از آن
   می‌خواند. اگر پیدا نشد رشتهٔ خالی برمی‌گردد و آن‌وقت هیچ فیلتری
   اعمال نمی‌شود — ارز دیجیتال دقیقاً همین حالت است و بازارش تعطیلی
   ندارد. */
function assetGroup(string $id): string {
    $rates = readJson(RATES_FILE);
    return (string) ($rates['assets'][$id]['group'] ?? '');
}

function capture(): array {
    $key = configKey();
    $provided = (string) ($_SERVER['HTTP_X_TABDEX_INTERNAL_KEY'] ?? '');
    if ($key === '' || !hash_equals($key, $provided)) {
        http_response_code(403);
        return ['error' => 'forbidden'];
    }
    $rates = readJson(RATES_FILE);
    if (empty($rates['assets']) || !is_array($rates['assets'])) {
        http_response_code(503);
        return ['error' => 'rates_unavailable'];
    }
    $history = readJson(CACHE_FILE);
    $history['assets'] = is_array($history['assets'] ?? null) ? $history['assets'] : [];
    $time = (int) ($rates['fetched_unix'] ?? time());
    $time -= $time % 300;
    foreach ($rates['assets'] as $id => $asset) {
        if (!marketIsOpen((string) ($asset['group'] ?? ''), $time)) continue;
        $price = (float) ($asset['toman'] ?? 0);
        if ($price <= 0) continue;
        $points = is_array($history['assets'][$id] ?? null) ? $history['assets'][$id] : [];
        $last = $points ? end($points) : null;
        if (is_array($last) && (int) ($last[0] ?? 0) === $time) array_pop($points);
        $points[] = [$time, $price];
        // حدود ۴۰۰ روز؛ دادهٔ روزانهٔ بلندمدت در فایل seed باقی می‌ماند.
        $history['assets'][$id] = array_values(array_filter($points, static fn($point) => is_array($point) && (int) ($point[0] ?? 0) >= time() - 400 * 86400));
    }
    $history['updated'] = gmdate('c');
    writeJson(CACHE_FILE, $history);
    return ['ok' => true, 'captured_at' => $time, 'assets' => count($history['assets'])];
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
$seed = readJson(SEED_FILE);
$dynamic = readJson(CACHE_FILE);
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
