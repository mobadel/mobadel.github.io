# کارهای باقی‌ماندهٔ اسکیمای تبدکس (برای ادامه روی سیستم دیگر)

> این فایل را به‌عنوان پرامپت به Claude بده. همهٔ زمینهٔ لازم داخل خودش است.
> تاریخ: 2026-11-04 · نوشته‌شده پس از PR «اسکیما: یک گراف JSON-LD سرورساخته برای هر صفحه»

## زمینه

- سایت: https://tabdex.ir — مبدل و قیمت لحظه‌ای ارز، طلا، سکه و رمزارز (فارسی، RTL).
- مخزن: https://github.com/mobadel/mobadel.github.io
- شاخه: `fix/schema-overhaul` · PR: https://github.com/mobadel/mobadel.github.io/pull/121
- مجله روی `https://tabdex.ir/mag/` یک وردپرس جداست (افزونهٔ Yoast SEO) و در این مخزن نیست.
- مرجع کامل تصمیم‌ها: `docs/SCHEMA.md` (چه صفحه‌ای چه نودی می‌گیرد و چرا؛ تصمیم‌های ردشده).

### ساختار کد اسکیما

- `scripts/schema.mjs` — سازنده‌های خالص (`buildOrganization`، `buildWebSite`، `buildConverter`،
  `buildThing`، `buildDataset`، …) و `replaceJsonLd` که در هر صفحه دقیقاً یک بلاک می‌گذارد.
- `scripts/build-pages.mjs` — تصمیم «هر صفحه چه نودی» (`assetThing`، `pairNodes`، `categoryNodes`،
  `assetNodes`، `hubNodes`، `staticPageNodes`).
- `assets/price.js` — صفحه‌های `data-built` را بازنویسی نمی‌کند؛ فقط برای آدرس‌های بازنویسی‌شده اسکیمای ساده و بدون قیمت می‌سازد.
- `tests/schema.test.js` — روی همهٔ آدرس‌های سایت‌مپ: یک بلاک معتبر، بدون `Offer`/`price`/`seller`، هر `@id` ارجاع‌شده تعریف دارد.

### اجرای تست‌ها (پیش از هر PR)

```bash
rm -rf _site && mkdir -p _site
cp index.html robots.txt sitemap.xml .htaccess _site/
cp -R assets data api price convert _site/
node --test tests/*.test.js
git checkout sitemap.xml   # ساخت فقط lastmod را عوض می‌کند؛ کامیت نکن
```

### قواعدی که نباید شکسته شوند

1. هر نود فقط وقتی منتشر می‌شود که محتوایش واقعاً روی همان صفحه باشد.
2. هیچ `Offer`، `price`، `seller`، `availability`، `Product` یا `FinancialProduct` — تبدکس چیزی نمی‌فروشد.
3. عدد قیمت لحظه‌ای هرگز داخل اسکیما نمی‌رود (گوگل روزها کش می‌کند).
4. `about: #organization` فقط روی «درباره ما» و «تماس»؛ بقیه فقط `publisher`.
5. تاریخ‌ها ISO میلادی؛ تاریخ شمسی شکل ISO دارد ولی غلط خوانده می‌شود.
6. لینک `sameAs` فقط وقتی دستی و قطعاً درست است؛ لینک غلط از نبودنش بدتر است.
7. تومان کد ISO ندارد؛ واحد قانونی ریال (`IRR`) است و ۱ تومان = ۱۰ ریال.

---

## ۱. ادغام و دیپلوی PR شمارهٔ ۱۲۱ — کد

- [ ] PR را مرور کن و اگر تأیید شد مرج کن (دیپلوی از راه `.github/workflows/deploy-parspack.yml` انجام می‌شود).
- [ ] بعد از دیپلوی، خروجی زنده را با اسکریپت زیر بگیر (`ld.py`):

```python
import io, sys, re, json, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
def one(p):
    req = urllib.request.Request(p, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    print("=====", p)
    blocks = re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S)
    print("  blocks:", len(blocks))
    for b in blocks:
        d = json.loads(b)
        for n in (d.get("@graph") or [d]):
            print("   ", json.dumps(n, ensure_ascii=False)[:300])
for u in sys.argv[1:]:
    try: one(u)
    except Exception as e: print("=====", u, "ERR:", e)
```

```bash
python ld.py https://tabdex.ir/ https://tabdex.ir/convert/ https://tabdex.ir/convert/usd-to-irt/ \
  "https://tabdex.ir/convert/usd-to-irt/?amount=1000" https://tabdex.ir/price/ https://tabdex.ir/price/gold/ \
  https://tabdex.ir/price/currency/usd/ https://tabdex.ir/price/crypto/btc/ \
  https://tabdex.ir/about/ https://tabdex.ir/contact/ https://tabdex.ir/methodology/
```

چک‌لیست:
- [ ] هر صفحه دقیقاً ۱ بلاک دارد و اولین دو نودش `Organization` (`https://tabdex.ir/#organization`) و `WebSite` است.
- [ ] هیچ‌جا `Offer` یا `price` نیست.
- [ ] `/price/currency/usd/` یک `Dataset` با `temporalCoverage: "2012-06-19/.."` دارد؛ `/price/crypto/btc/` ندارد.
- [ ] اسکیمای `/price/...` همان بلاک `data-built` است (اگر `Dataset` با قیمت دیدی، کش `price.js` قدیمی است؛ نسخهٔ `?v=` در `price/*.html` باید `20261104-schema` باشد).

## ۲. اعتبارسنجی گوگل — دستی

- [ ] [Rich Results Test](https://search.google.com/test/rich-results) و [Schema Markup Validator](https://validator.schema.org/) روی: صفحهٔ اصلی، `/convert/usd-to-irt/`، `/price/currency/usd/`، `/price/gold/`، `/about/`. ملاک: **صفر خطا**. نبودِ «نتیجهٔ ویژه» اشکال نیست.
- [ ] هشدار «Missing field: offers» برای `WebApplication` **عمداً** است (`docs/SCHEMA.md` ← تصمیم‌های ردشده). آن را با اضافه کردن `Offer` «درست» نکن.
- [ ] چند هفته بعد در Search Console: بخش Enhancements و Manual actions.

## ۳. مجلهٔ وردپرس — پنل و کد قالب

وضعیت فعلی (اندازه‌گیری‌شده 2026-11-04): هر نوشته یک `Article` دارد (درست است)، ولی سازمان مجله
شناسهٔ جدا `https://tabdex.ir/mag/#organization` دارد. یعنی گوگل دو برند می‌بیند و اعتبار مقاله‌ها به برند اصلی نمی‌رسد.
`alternateName` آن هم غلط تایپی «مجله تدبکس» است.

- [ ] **پنل:** Yoast SEO ← Settings ← Site representation: نام سازمان «تبدکس»، نام جایگزین **«Tabdex»**، لوگو همان لوگوی سایت اصلی.
  Yoast ← Settings ← Site basics: «Alternate website name» را از «مجله تدبکس» اصلاح کن.
- [ ] **کد:** شناسهٔ سازمان مجله را با سایت اصلی یکی کن. پیشنهاد (تست‌نشده؛ در یک افزونهٔ کوچک یا `functions.php` قالب فرزند بگذار و اول روی استیجینگ امتحان کن):

```php
<?php
/* سازمان مجله همان سازمان tabdex.ir است؛ همهٔ ارجاع‌ها به #organization مجله
   به شناسهٔ سایت اصلی برگردانده می‌شوند. */
add_filter( 'wpseo_schema_graph', function ( $graph ) {
    $old = home_url( '/' ) . '#organization';           // https://tabdex.ir/mag/#organization
    $new = 'https://tabdex.ir/#organization';
    $swap = function ( $value ) use ( &$swap, $old, $new ) {
        if ( is_array( $value ) ) {
            foreach ( $value as $key => $item ) {
                $value[ $key ] = ( $key === '@id' && $item === $old ) ? $new : $swap( $item );
            }
        }
        return $value;
    };
    $graph = $swap( $graph );
    foreach ( $graph as $i => $node ) {
        if ( ( $node['@id'] ?? '' ) === $new ) {
            $graph[ $i ]['url']           = 'https://tabdex.ir/';
            $graph[ $i ]['name']          = 'تبدکس';
            $graph[ $i ]['alternateName'] = 'Tabdex';
            $graph[ $i ]['sameAs']        = [ 'https://t.me/tabdexir', 'https://www.instagram.com/tabdex.ir' ];
        }
    }
    return $graph;
} );
```

- [ ] بعد از تغییر، با `ld.py` روی `https://tabdex.ir/mag/` و یک نوشته چک کن:
  `@id` سازمان `https://tabdex.ir/#organization` باشد، `publisher` مقاله به همان اشاره کند، و هنوز **دقیقاً یک** `Article` و یک `BreadcrumbList` باشد (قالب نباید اسکیمای دوم بسازد).

## ۴. لوگوی بزرگ‌تر — کد

لوگوی `Organization` الان `https://tabdex.ir/assets/apple-touch-icon.png` (۱۸۰×۱۸۰) است.
مجله یک نسخهٔ ۵۱۲ پیکسلی دارد: `https://tabdex.ir/mag/wp-content/uploads/2026/09/tabdex-icon-512.png`.

- [ ] آن فایل (یا نسخهٔ رسمی از طراح) را به `assets/logo-512.png` اضافه کن.
- [ ] در `scripts/schema.mjs` ← `buildOrganization()` آدرس و `width`/`height` را عوض کن.
- [ ] همین لوگو را در Yoast هم بگذار تا هر دو یکی باشند.

## ۵. هویت دارایی‌ها با ویکی‌دیتا — کد + بررسی دستی

`buildThing(id, { name, alternateName, sameAs })` از قبل `sameAs` را می‌پذیرد، ولی عمداً خالی مانده.

- [ ] برای هر دارایی مهم، صفحهٔ ویکی‌دیتا را **دستی باز کن و تأیید کن** (مثلاً دلار آمریکا، یورو، بیت کوین، اتریوم، طلا).
  حدس نزن؛ شناسه را فقط از خود wikidata.org بردار.
- [ ] یک allowlist صریح بساز (مثلاً `data/wikidata.json` به شکل `{ "usd": "https://www.wikidata.org/wiki/Q…" }`)
  و در `assetThing()` داخل `scripts/build-pages.mjs` به `buildThing` بده. اسلاگ بدون ورودی ⇒ بدون `sameAs`.
- [ ] تستی اضافه کن که هر مقدار allowlist با `^https://www\.wikidata\.org/wiki/Q\d+$` بخواند.

## ۶. اختیاری — فقط اگر داده‌اش را داری

- [ ] **`foundingDate`**: اگر تاریخ دقیق راه‌اندازی تبدکس را داری، به میلادی تبدیل کن و در `buildOrganization()` بگذار (`YYYY-MM-DD` یا `YYYY`). تاریخ شمسی نگذار.
- [ ] **`Dataset` برای نمودار رمزارزها**: فقط اگر تاریخ شروع واقعی دادهٔ هر بازار نوبیتکس معلوم است (`2017-01-01` در `btc-chart.js` کف درخواست است، نه شروع داده).
  در `assetNodes()` شرط `group === "crypto" ? null` را با جدول تاریخ واقعی جایگزین کن.
- [ ] **طلای ۲۲، ۲۱، ۲۰، ۱۷ و ۱۴ عیار**: نمودار دارند ولی سری جدا در `data/market-history.json` ندارند؛ اگر سری‌شان اضافه شد، `Dataset` خودکار ساخته می‌شود.

## ۷. وقتی همه تمام شد

- [ ] `docs/SCHEMA.md` را به‌روز کن (بخش «کارهای باقی‌مانده» و هر تصمیم تازه با تاریخ).
- [ ] این فایل (`docs/SCHEMA-TODO.md`) را حذف کن.
