<?php
declare(strict_types=1);

/* کاوشگر سرویس‌های BrsApi.
 *
 * جواب این سؤال را می‌دهد: با همین کلید رایگان، چه داده‌ای در دسترس
 * است که سایت هنوز از آن استفاده نمی‌کند؟ مستندات همیشه با آنچه یک
 * کلید مشخص اجازه دارد یکی نیست، پس معیار، پاسخ واقعی سرور است.
 *
 * فقط می‌خواند و چیزی را تغییر نمی‌دهد. کلید از متغیر محیطی می‌آید و
 * هیچ‌جای خروجی چاپ نمی‌شود.
 *
 * اجرا: BRSAPI_KEY=... php tools/brs-probe.php
 */

$key = getenv('BRSAPI_KEY') ?: '';
if ($key === '') {
    fwrite(STDERR, "BRSAPI_KEY تعریف نشده.\n");
    exit(1);
}

/* نمادهایی که همین حالا استفاده می‌کنیم، مستقیم از خود rates.php
   خوانده می‌شوند تا این فهرست هیچ‌وقت از واقعیت عقب نماند. */
function mappedSymbols(string $constant): array
{
    $source = (string) file_get_contents(__DIR__ . '/../api/rates.php');
    if (!preg_match('/const ' . $constant . ' = \[(.*?)\n\];/s', $source, $m)) return [];
    preg_match_all("/'([A-Za-z0-9_]+)'\s*=>\s*\['id'/", $m[1], $rows);
    return $rows[1] ?? [];
}

function probe(string $label, string $url, string $key): ?array
{
    $channel = curl_init($url . (str_contains($url, '?') ? '&' : '?') . 'key=' . urlencode($key));
    curl_setopt_array($channel, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => 'tabdex-probe/1.0 (+https://tabdex.ir)',
    ]);
    $body = curl_exec($channel);
    $code = (int) (curl_getinfo($channel)['http_code'] ?? 0);
    curl_close($channel);

    if ($body === false || $code !== 200) {
        printf("  ✗ %-28s HTTP %d\n", $label, $code);
        return null;
    }
    $payload = json_decode((string) $body, true);
    if (!is_array($payload)) {
        // پاسخ ۲۰۰ ولی غیر JSON معمولاً یعنی صفحهٔ خطای «دسترسی ندارید».
        printf("  ✗ %-28s پاسخ JSON نبود (%s…)\n", $label, mb_substr(trim(preg_replace('/\s+/', ' ', (string) $body)), 0, 60));
        return null;
    }
    printf("  ✓ %-28s در دسترس\n", $label);
    return $payload;
}

/* ردیف‌های تخت از پاسخ، هر شکلی که داشته باشد. */
function rowsOf(array $payload): array
{
    $rows = [];
    $walk = static function ($node) use (&$walk, &$rows) {
        if (!is_array($node)) return;
        if (isset($node['symbol']) || isset($node['name']) || isset($node['contract_code'])) { $rows[] = $node; return; }
        foreach ($node as $child) $walk($child);
    };
    $walk($payload);
    return $rows;
}

$used = array_merge(mappedSymbols('ASSET_MAP'), mappedSymbols('IME_MAP'));
printf("نمادهایی که سایت الان استفاده می‌کند: %d\n\n", count($used));

$targets = [
    'Gold_Currency (فعلی)'   => 'https://api.brsapi.ir/Market/Gold_Currency.php',
    'Gold_Currency crypto'   => 'https://api.brsapi.ir/Market/Gold_Currency.php?section=cryptocurrency',
    'Commodity'              => 'https://api.brsapi.ir/Market/Commodity.php',
    'IME/Certificate (فعلی)' => 'https://api.brsapi.ir/IME/Certificate.php',
    'IME/Option'             => 'https://api.brsapi.ir/IME/Option.php',
    'Tsetmc/AllSymbols'      => 'https://api.brsapi.ir/Tsetmc/AllSymbols.php',
    'Tsetmc/Index'           => 'https://api.brsapi.ir/Tsetmc/Index.php',
];

echo "── در دسترس بودن اندپوینت‌ها ──\n";
$payloads = [];
foreach ($targets as $label => $url) {
    $payloads[$label] = probe($label, $url, $key);
    usleep(400000);
}

echo "\n── محتوا ──\n";
foreach ($payloads as $label => $payload) {
    if ($payload === null) continue;
    $rows = rowsOf($payload);
    printf("\n%s — %d ردیف\n", $label, count($rows));
    $shown = 0;
    foreach ($rows as $row) {
        $symbol = (string) ($row['symbol'] ?? $row['contract_code'] ?? '');
        $name   = (string) ($row['name'] ?? $row['commodity'] ?? $row['name_en'] ?? '');
        $price  = $row['price'] ?? $row['pl'] ?? '';
        $unit   = (string) ($row['unit'] ?? '');
        $isNew  = $symbol !== '' && !in_array($symbol, $used, true);
        // فقط نمادهایی که نداریم؛ بقیه را می‌شناسیم.
        if (!$isNew) continue;
        printf("   • %-16s %-34s %14s %s\n", $symbol, mb_substr($name, 0, 34), (string) $price, $unit);
        if (++$shown >= 40) { printf("   … و %d ردیف دیگر\n", count($rows) - $shown); break; }
    }
    if ($shown === 0) echo "   (همهٔ ردیف‌ها را از قبل داریم)\n";
}
