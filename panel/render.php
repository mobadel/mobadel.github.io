<?php
declare(strict_types=1);

/*
 * صفحه‌های دارای محتوای پنل از اینجا سرو می‌شوند. .htaccess فقط وقتی
 * به این فایل بازنویسی می‌کند که برای همان آدرس محتوای منتشرشده باشد،
 * پس بقیهٔ صفحه‌ها مثل قبل کاملاً ایستا می‌مانند.
 */

require __DIR__ . '/lib/core.php';

ini_set('display_errors', '0');

$key = cms_key_from_path((string) ($_SERVER['REQUEST_URI'] ?? ''));
$base = $key === null ? null : cms_base_html($key);
if ($key === null || $base === null) {
    http_response_code(404);
    exit;
}

header('Content-Type: text/html; charset=UTF-8');

$token = isset($_GET['cms_preview']) ? (string) $_GET['cms_preview'] : '';
if ($token !== '') {
    /* لینک پیش‌نمایش نباید ایندکس یا کش شود و پیش‌نویس را هم فقط تا زمان
       اعتبار امضایش نشان می‌دهد. */
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    if (cms_preview_valid($key, $token)) {
        $record = cms_read(cms_page_store_name($key));
        $draft = (string) ($record['draft_html'] ?? '');
        if ($draft !== '') {
            $html = cms_inject($base, $draft, $key);
            $banner = '<div style="position:fixed;inset-block-end:16px;inset-inline-start:16px;z-index:9999;padding:8px 14px;border-radius:10px;background:#0c5f45;color:#fff;font:14px/1.6 Tahoma,sans-serif">پیش‌نمایش پیش‌نویس؛ این صفحه هنوز منتشر نشده است</div>';
            echo str_replace('</body>', $banner . '</body>', $html);
            exit;
        }
    }
}

header('Cache-Control: no-cache');
$content = cms_read_published($key);
echo $content === null ? $base : cms_inject($base, $content, $key);
