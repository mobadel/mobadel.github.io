<?php
declare(strict_types=1);

/* منطق مشترک تاریخچهٔ نمودار.
 *
 * تا امروز ثبت نقطه فقط از راه کرون GitHub انجام می‌شد؛ کرون روی کاغذ
 * هر پنج دقیقه بود ولی GitHub آن را به‌شدت throttle می‌کند و در عمل هر
 * دو تا پنج ساعت یک‌بار اجرا می‌شد. نتیجه این بود که نمودار ۲۴ ساعته
 * روزی یکی دو نقطه داشت و ساعت‌های شلوغ بازار اصلاً در آن نبودند.
 *
 * حالا rates.php هم هر بار که کشش را تازه می‌کند همین‌جا نقطه ثبت
 * می‌کند. کرون به‌عنوان تور ایمنی می‌ماند برای وقتی که سایت ترافیک
 * ندارد. */

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

const HISTORY_CACHE_FILE = __DIR__ . '/cache/market-history.json';
const HISTORY_SEED_FILE  = __DIR__ . '/../data/market-history.json';
const HISTORY_RATES_FILE = __DIR__ . '/cache/rates.json';

/* نقطه‌ها در سطل‌های پنج‌دقیقه‌ای می‌نشینند. rates.php هر دقیقه صدا
   می‌زند، ولی نقطهٔ هم‌سطل جایگزین قبلی می‌شود، پس حجم فایل همان
   می‌ماند و نمودار رزولوشن پنج‌دقیقه‌ای می‌گیرد. */
const HISTORY_BUCKET = 300;

function historyReadJson(string $path): array {
    if (!is_readable($path)) return [];
    $decoded = json_decode((string) @file_get_contents($path), true);
    return is_array($decoded) ? $decoded : [];
}

function historyWriteJson(string $path, array $payload): bool {
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) return false;
    return @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

/* آیا بازار در آن روز اصلاً باز بوده؟ تعطیل رسمی یا روزِ تعطیلِ هفته.
   عمداً به ساعت کاری نگاه نمی‌کند: دادهٔ بلندمدت یک بستهٔ روزانه با
   تایم‌استمپ ۰۳:۳۰ تهران است و معیار ساعتی هر ۳۸۰۰ نقطهٔ تاریخی را
   دور می‌ریخت. */
/* ── بازار آتی انرژی ──────────────────────────────────────────────
   نفت برنت و بنزین در بازار آتی آمریکا معامله می‌شوند، نه ایران. پس
   تقویمشان هم آمریکایی است: از یکشنبه ۱۸:۰۰ تا جمعه ۱۷:۰۰ به وقت
   نیویورک باز است، با یک وقفهٔ یک‌ساعته هر روز بین ۱۷ و ۱۸.

   عمداً به وقت نیویورک حساب می‌شود و نه با اختلاف ثابت از تهران، چون
   آمریکا ساعت تابستانی دارد و ایران ندارد؛ با عدد ثابت، سال دو بار
   یک ساعت اشتباه می‌شد. */
function energyMarketIsOpen(int $time): bool {
    $newYork = (new DateTimeImmutable('@' . $time))->setTimezone(new DateTimeZone('America/New_York'));
    $weekday = (int) $newYork->format('N'); // دوشنبه=۱ … جمعه=۵، شنبه=۶، یکشنبه=۷
    $minutes = (int) $newYork->format('G') * 60 + (int) $newYork->format('i');
    $close   = 17 * 60;
    $open    = 18 * 60;

    if ($weekday === 6) return false;                  // شنبه تمام‌روز بسته
    if ($weekday === 7) return $minutes >= $open;      // یکشنبه از ۱۸:۰۰ باز می‌شود
    if ($weekday === 5) return $minutes < $close;      // جمعه ۱۷:۰۰ می‌بندد
    return $minutes < $close || $minutes >= $open;     // بقیهٔ روزها با وقفهٔ ۱۷ تا ۱۸
}

function marketDayIsOpen(string $group, int $time): bool {
    // انرژی تقویم خودش را دارد؛ روز و ساعتش از هم جدا نیست.
    if ($group === 'energy') return energyMarketIsOpen($time);
    if (!in_array($group, ['fiat', 'gold', 'coin', 'commodity'], true)) return true;
    $tehran = (new DateTimeImmutable('@' . $time))->setTimezone(new DateTimeZone('Asia/Tehran'));
    if (in_array($tehran->format('Y-m-d'), OFFICIAL_HOLIDAYS_1405, true)) return false;
    $weekday = (int) $tehran->format('N'); // دوشنبه=۱ … پنجشنبه=۴، جمعه=۵، شنبه=۶
    // بورس کالا پنجشنبه‌ها هم بسته است، برخلاف بازار طلا و ارز.
    return in_array($weekday, $group === 'commodity' ? [6, 7, 1, 2, 3] : [6, 7, 1, 2, 3, 4], true);
}

function marketIsOpen(string $group, int $time): bool {
    if ($group === 'energy') return energyMarketIsOpen($time);
    if (!marketDayIsOpen($group, $time)) return false;
    if (!in_array($group, ['fiat', 'gold', 'coin', 'commodity'], true)) return true;
    $tehran = (new DateTimeImmutable('@' . $time))->setTimezone(new DateTimeZone('Asia/Tehran'));
    $weekday = (int) $tehran->format('N');
    $hour = (int) $tehran->format('G');
    if ($group === 'commodity') return $hour >= 12 && $hour < 18;
    if ($weekday === 4) return $hour >= 11 && $hour < 18;
    return $hour >= 11 && $hour < 20;
}

/* ثبت یک اسنپ‌شات از نرخ‌های همین لحظه. هم rates.php بعد از تازه‌کردن
   کش صدایش می‌زند، هم کرون از راه history.php. */
function recordHistoryPoints(array $assets, int $fetchedUnix): int {
    $history = historyReadJson(HISTORY_CACHE_FILE);
    $history['assets'] = is_array($history['assets'] ?? null) ? $history['assets'] : [];
    $time = $fetchedUnix - ($fetchedUnix % HISTORY_BUCKET);
    $cutoff = time() - 400 * 86400;

    foreach ($assets as $id => $asset) {
        if (!is_array($asset)) continue;
        if (!marketIsOpen((string) ($asset['group'] ?? ''), $time)) continue;
        $price = (float) ($asset['toman'] ?? 0);
        if ($price <= 0) continue;
        $points = is_array($history['assets'][$id] ?? null) ? $history['assets'][$id] : [];
        $last = $points ? end($points) : null;
        // نقطهٔ هم‌سطل جایگزین می‌شود تا هر پنج دقیقه یک نقطه بماند.
        if (is_array($last) && (int) ($last[0] ?? 0) === $time) array_pop($points);
        $points[] = [$time, $price];
        // حدود ۴۰۰ روز؛ دادهٔ روزانهٔ بلندمدت در فایل seed باقی می‌ماند.
        $history['assets'][$id] = array_values(array_filter(
            $points,
            static fn($point) => is_array($point) && (int) ($point[0] ?? 0) >= $cutoff
        ));
    }

    $history['updated'] = gmdate('c');
    historyWriteJson(HISTORY_CACHE_FILE, $history);

    return $time;
}
