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

require __DIR__ . '/rates.php';
