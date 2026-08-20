<?php
/*
 * پروب موقت فاز صفر — بعد از گرفتن نتیجه حذف می‌شود.
 * سه چیز را می‌سنجد که هر سه برای پراکسی نرخ لازم‌اند:
 *   ۱) آیا PHP اصلاً اجرا می‌شود و نسخه‌اش چند است
 *   ۲) آیا می‌شود در کنار همین فایل، پوشه و فایل کش ساخت
 *   ۳) آیا اتصال خروجی HTTPS به BrsApi از روی سرور باز است
 * مورد سوم مهم‌ترین است: خیلی از هاست‌های اشتراکی اتصال خروجی
 * را می‌بندند و در آن صورت پراکسی اصلاً کار نمی‌کند.
 */
header('Content-Type: application/json; charset=utf-8');

$result = [
    'php_version'   => PHP_VERSION,
    'json'          => function_exists('json_encode'),
    'curl'          => function_exists('curl_init'),
    'allow_url_fopen' => (bool) ini_get('allow_url_fopen'),
];

// ۲) نوشتن در پوشه کش
$cacheDir = __DIR__ . '/cache';
$write = ['dir_created' => false, 'file_written' => false, 'error' => null];
if (!is_dir($cacheDir)) {
    $write['dir_created'] = @mkdir($cacheDir, 0775, true);
} else {
    $write['dir_created'] = true;
}
if ($write['dir_created']) {
    $probeFile = $cacheDir . '/_probe.txt';
    $write['file_written'] = @file_put_contents($probeFile, (string) time()) !== false;
    if ($write['file_written']) {
        @unlink($probeFile);
    } else {
        $write['error'] = 'file_put_contents failed';
    }
} else {
    $write['error'] = 'mkdir failed';
}
$result['cache_writable'] = $write;

// ۳) اتصال خروجی به BrsApi (بدون کلید — فقط برقراری اتصال مهم است)
$outbound = ['ok' => false, 'http_code' => null, 'error' => null, 'sample' => null];
if (function_exists('curl_init')) {
    $ch = curl_init('https://api.brsapi.ir/Market/Gold_Currency.php?key=probe');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_USERAGENT      => 'tabdex-probe/1.0',
    ]);
    $body = curl_exec($ch);
    if ($body === false) {
        $outbound['error'] = curl_error($ch);
    } else {
        $outbound['ok']        = true;
        $outbound['http_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $outbound['sample']    = mb_substr((string) $body, 0, 180);
    }
    curl_close($ch);
} else {
    $outbound['error'] = 'cURL extension missing';
}
$result['outbound_brsapi'] = $outbound;

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
