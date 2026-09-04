<?php
declare(strict_types=1);

/* تاریخچهٔ نمودارهای طلا، سکه و ارز.
 * بخش بلندمدت از data/market-history.json می‌آید و اسنپ‌شات‌های پنج‌دقیقه‌ای
 * BRS در cache/market-history.json نگهداری می‌شوند. کلید هرگز به مرورگر
 * برنمی‌گردد؛ فقط گردش‌کار GitHub برای ثبت اسنپ‌شات آن را در هدر می‌فرستد. */

const CACHE_FILE = __DIR__ . '/cache/market-history.json';
const SEED_FILE = __DIR__ . '/../data/market-history.json';
const RATES_FILE = __DIR__ . '/cache/rates.json';

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
foreach ([$seed, $dynamic] as $source) {
    foreach (($source['assets'][$id] ?? []) as $point) {
        if (!is_array($point) || !isset($point[0], $point[1])) continue;
        $time = (int) $point[0]; $price = (float) $point[1];
        if ($time > 0 && $price > 0) $merged[$time] = [$time, $price];
    }
}
ksort($merged, SORT_NUMERIC);
echo json_encode(['asset' => $id, 'unit' => 'toman', 'points' => array_values($merged)], JSON_UNESCAPED_UNICODE);
