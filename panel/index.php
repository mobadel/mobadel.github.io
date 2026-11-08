<?php
declare(strict_types=1);

/* پوستهٔ پنل. منطق صفحه‌ها در assets/panel.js و داده از api.php می‌آید. */

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");

$version = '20261108-1';
?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>پنل محتوای تبدکس</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/panel.css?v=<?= $version ?>">
</head>
<body>
  <div id="app" aria-live="polite"></div>
  <div id="toasts" role="status" aria-live="polite"></div>
  <script src="vendor/tinymce/tinymce.min.js?v=6.8.6"></script>
  <script src="assets/panel.js?v=<?= $version ?>"></script>
</body>
</html>
