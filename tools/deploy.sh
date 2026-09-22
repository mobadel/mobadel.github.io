#!/usr/bin/env bash
# دیپلوی دستی به پارس‌پک — همان کاری که ورک‌فلوی GitHub می‌کند.
#
# چرا وجود دارد: وقتی GitHub Actions از کار می‌افتد (سهمیه، اختلال،
# مشکل حساب)، تنها راه انتشار همین بود و هیچ‌جا نوشته نشده بود. این
# اسکریپت آن وابستگی را می‌شکند و از هر جایی اجرا می‌شود — ویندوز با
# Git Bash یا WSL، مک، لینوکس.
#
# لازم است: lftp، و این متغیرهای محیطی:
#   FTP_SERVER FTP_PORT FTP_USERNAME FTP_PASSWORD FTP_DIRECTORY
#   BRSAPI_KEY HISTORY_CAPTURE_TOKEN   (دو تای آخر اختیاری)
#
# نمونه:
#   export FTP_SERVER=... FTP_USERNAME=... FTP_PASSWORD=... FTP_DIRECTORY=/public_html
#   bash tools/deploy.sh
#
# حالت‌ها:
#   (بدون گزینه)  دیپلوی کامل — همهٔ صفحه‌ها را می‌سازد و آپلود می‌کند
#   --quick       فقط api/ و assets/ و HTMLهای دست‌نویس؛ چند ثانیه
#   --dry-run     فقط می‌سازد و فهرست را نشان می‌دهد، آپلود نمی‌کند

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=no
QUICK=no
case "${1:-}" in
  --dry-run) DRY_RUN=yes ;;
  # فقط فایل‌های دست‌نویس و API. صفحه‌های تولیدی دست نمی‌خورند، پس وقتی
  # تغییر در کد است و نه در فهرست دارایی‌ها، چند ثانیه طول می‌کشد به‌جای
  # چند دقیقه.
  --quick)   QUICK=yes ;;
esac

need() {
  [ -n "${!1:-}" ] || { echo "متغیر $1 تعریف نشده." >&2; exit 1; }
}

echo "▸ ساخت _site"
rm -rf _site
mkdir -p _site
cp index.html robots.txt sitemap.xml _site/
cp .htaccess _site/
# scripts عمداً کپی نمی‌شود؛ روی سرور فقط سطح حمله اضافه می‌کرد.
cp -R assets data api price convert _site/

if [ "$QUICK" = "yes" ]; then
  echo "▸ حالت سریع: مولد صفحه‌ها اجرا نمی‌شود"
else
  echo "▸ ساخت صفحه‌های جفت‌ها و قیمت"
  node scripts/build-pages.mjs
fi

if [ -n "${BRSAPI_KEY:-}" ]; then
  echo "▸ نوشتن config.php"
  mkdir -p _site/api
  encoded=$(printf '%s' "$BRSAPI_KEY" | base64 | tr -d '\n')
  history_encoded=$(printf '%s' "${HISTORY_CAPTURE_TOKEN:-}" | base64 | tr -d '\n')
  printf '<?php\nreturn ["brsapi_key" => base64_decode("%s"), "history_capture_token" => base64_decode("%s")];\n' \
    "$encoded" "$history_encoded" > _site/api/config.php
else
  echo "▸ BRSAPI_KEY تعریف نشده؛ config.php دست‌نخورده روی سرور می‌ماند."
fi

if [ "$DRY_RUN" = "yes" ]; then
  echo "▸ dry-run: $(find _site -type f | wc -l) فایل ساخته شد، چیزی آپلود نشد."
  exit 0
fi

need FTP_SERVER; need FTP_USERNAME; need FTP_PASSWORD; need FTP_DIRECTORY
command -v lftp >/dev/null || { echo "lftp نصب نیست." >&2; exit 1; }

echo "▸ آپلود با lftp"
{
  echo 'set cmd:fail-exit yes'
  echo 'set net:max-retries 2'
  echo 'set net:timeout 20'
  echo 'set xfer:timeout 90'
  echo 'set net:reconnect-interval-max 15'
  echo 'set ftp:ssl-force yes'
  echo 'set ftp:ssl-protect-data yes'
  echo 'set ftp:ssl-auth TLS'
  # گواهی FTPS پارس‌پک زنجیرهٔ کامل ندارد.
  echo 'set ssl:verify-certificate no'
  if [ "$QUICK" != "yes" ]; then
    echo "mirror --reverse --verbose --parallel=4 --ignore-time _site/ \"$FTP_DIRECTORY\""
  fi
  # mirror فقط اندازه را می‌بیند، پس تغییر هم‌اندازه بی‌صدا جا می‌ماند.
  # فایل‌های دست‌نویس بی‌قیدوشرط هم فرستاده می‌شوند — و در حالت سریع
  # تنها چیزی هستند که فرستاده می‌شوند.
  for file in index.html convert/index.html assets/*.js assets/*.css api/*.php; do
    [ -f "_site/$file" ] || continue
    directory=$(dirname "$file")
    target="$FTP_DIRECTORY"
    [ "$directory" != "." ] && target="$FTP_DIRECTORY/$directory"
    echo "put -O \"$target\" \"_site/$file\""
  done
  echo bye
} | lftp -u "$FTP_USERNAME","$FTP_PASSWORD" -p "${FTP_PORT:-21}" "$FTP_SERVER"

echo "▸ تأیید انتشار"
mismatch=0
for file in index.html assets/app.js assets/home.js assets/price.js assets/styles.css; do
  [ -f "_site/$file" ] || continue
  expected=$(md5sum "_site/$file" | cut -d' ' -f1)
  actual=$(curl -fsS --max-time 25 -H 'Cache-Control: no-cache' \
    "https://tabdex.ir/$file?deploy=$(date +%s)" | md5sum | cut -d' ' -f1) || actual='unreachable'
  if [ "$expected" = "$actual" ]; then echo "  ✓ $file"; else echo "  ✗ $file"; mismatch=1; fi
done
[ "$mismatch" -eq 0 ] && echo "▸ انتشار کامل." || { echo "▸ انتشار ناقص بود." >&2; exit 1; }
