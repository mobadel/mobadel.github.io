# تبدکس

تبدکس یک مبدل سبک و فارسی برای تبدیل دارایی‌های دیجیتال و **تومان (IRT)** با نرخ بازار نوبیتکس روی GitHub Pages است.

## منبع نرخ

صفحه مستقیماً از endpoint عمومی آمار بازار نوبیتکس استفاده می‌کند:

```text
GET https://api.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls
```

فیلد `latest` در پاسخ به ریال است و قبل از نمایش بر ۱۰ تقسیم می‌شود تا نرخ تومان به دست بیاید. API عمومی است و به توکن نیاز ندارد. اگر ارتباط مستقیم برقرار نشود، آخرین نرخ موجود در `data/prices.json` با هشدار «نرخ ذخیره‌شده» نمایش داده می‌شود.

پرچم ایرانِ آیکون تومان از مجموعهٔ [Flag Icons](https://flagicons.lipis.dev/) و نسخهٔ مربعی `ir` داخل پروژه نگهداری می‌شود. فونت Vazirmatn نیز به‌صورت محلی و مطابق مجوز SIL Open Font License ارائه می‌شود.

## ساختار

```text
index.html           ساختار صفحه و مبدل
robots.txt           راهنمای خزش موتورهای جست‌وجو
sitemap.xml          نقشهٔ سایت
assets/styles.css    طراحی RTL و واکنش‌گرا
assets/app.js        تبدیل، فرمت اعداد و دریافت نرخ نوبیتکس
assets/usdt-logo.svg نشان تتر
assets/og-cover.png  تصویر اشتراک‌گذاری شبکه‌های اجتماعی
data/prices.json     نرخ پشتیبان برای حالت قطع ارتباط
```

## اجرای محلی

به‌دلیل استفاده از `fetch`، سایت را با یک وب‌سرور محلی باز کنید:

```bash
python -m http.server 8000
```

سپس به `http://localhost:8000` بروید.

## رفتار مبدل

- هر دو ورودی قابل ویرایش‌اند.
- دکمهٔ وسط، جهت تبدیل را جابه‌جا می‌کند.
- جهت پیش‌فرض تتر به تومان با مقدار اولیه ۱۰۰ تتر است و تغییر جهت، آدرس صفحه را عوض نمی‌کند.
- اعداد فارسی، عربی و لاتین پذیرفته می‌شوند و خروجی با قالب فارسی نمایش داده می‌شود.

## گزارش سرچ کنسول

`scripts/gsc/` دادهٔ Search Console را می‌گیرد و تحلیل می‌کند. property از
نوع Domain است (`sc-domain:tabdex.ir`)، پس نسخهٔ URL-prefix دسترسی جدا
می‌خواهد.

```bash
pip install google-auth google-api-python-client
GSC_KEY=~/gsc-key.json python3 scripts/gsc/pull.py -o gsc.json
python3 scripts/gsc/report.py gsc.json
```

کلید سرویس‌اکانت هیچ‌وقت در مخزن نمی‌آید؛ مسیرش از `GSC_KEY` یا `--key`
خوانده می‌شود. سرویس‌اکانت باید در Search Console روی property دسترسی
خواندن داشته باشد.

بخش «آدرس‌های قدیمی که هنوز ایندکس‌اند» در گزارش، وضعیت
`sitemap-legacy.xml` را نشان می‌دهد: وقتی به صفر رسید، آن سایت‌مپ و
تولیدش در `scripts/build-pages.mjs` دیگر لازم نیست و باید حذف شود.
