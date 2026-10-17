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

/* آخرین صدازننده از هر نوع، تا از بیرون معلوم باشد کدام کرون کار می‌کند.
   آی‌پی به کار نمی‌آمد: کرون خود سرور هم از آی‌پی عمومی‌اش می‌آید.
   پس از User-Agent: curl و php خط فرمان یعنی کرون پارس‌پک، cron-job.org
   یعنی سرویس بیرونی. فقط زمان ثبت می‌شود. */
(static function (): void {
    $file  = __DIR__ . '/cache/cron.json';
    $agent = strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if (PHP_SAPI === 'cli') {
        $kind = 'server_php';
    } elseif (str_starts_with($agent, 'curl/') || str_starts_with($agent, 'wget/')) {
        $kind = 'server_curl';
    } elseif (str_contains($agent, 'cron-job.org')) {
        $kind = 'cron_job_org';
    } else {
        $kind = 'other';
    }
    $seen = json_decode((string) @file_get_contents($file), true);
    $seen = is_array($seen) ? $seen : [];
    unset($seen['local'], $seen['external']);
    $seen[$kind] = gmdate('c');
    if (!is_dir(dirname($file))) {
        @mkdir(dirname($file), 0775, true);
    }
    @file_put_contents($file, json_encode($seen), LOCK_EX);
})();

require __DIR__ . '/rates.php';
