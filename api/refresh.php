<?php
declare(strict_types=1);

/*
 * نقطهٔ ورود کرون: هر دقیقه صدا زده می‌شود تا نرخ‌ها بدون بازدید کاربر
 * تازه بمانند. خودش منطقی ندارد؛ rates.php را با حاشیهٔ کرون اجرا می‌کند.
 *
 *   بازار باز (شنبه تا پنجشنبه ۸ تا ۲۰)  → هر ۱ دقیقه تازه
 *   ۷ تا ۸ و ۲۰ تا ۲۳                     → هر ۲ دقیقه
 *   شب و جمعه                              → هر ۱۵ دقیقه
 *
 * کرون پیشنهادی (هر دو کار می‌کند):
 *   * * * * * curl -fsS -o /dev/null https://tabdex.ir/api/refresh.php
 *   * * * * * php /path/to/public_html/api/refresh.php > /dev/null
 */
const TABDEX_CRON = true;

/* آخرین صدازننده از هر نوع، تا از بیرون معلوم باشد کدام کرون کار می‌کند:
   local یعنی کرون خود سرور (پارس‌پک)، external یعنی سرویس بیرونی. فقط
   زمان ثبت می‌شود، نه آی‌پی. */
(static function (): void {
    $file = __DIR__ . '/cache/cron.json';
    $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $server = (string) ($_SERVER['SERVER_ADDR'] ?? '');
    $local  = PHP_SAPI === 'cli' || $remote === '' || $remote === $server
        || $remote === '127.0.0.1' || $remote === '::1';
    $seen = json_decode((string) @file_get_contents($file), true);
    $seen = is_array($seen) ? $seen : [];
    $seen[$local ? 'local' : 'external'] = gmdate('c');
    if (!is_dir(dirname($file))) {
        @mkdir(dirname($file), 0775, true);
    }
    @file_put_contents($file, json_encode($seen), LOCK_EX);
})();

require __DIR__ . '/rates.php';
