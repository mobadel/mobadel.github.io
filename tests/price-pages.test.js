const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const read = (path) => fs.readFileSync(path, "utf8");
const hub = read("price/index.html");
const category = read("price/category.html");
const asset = read("price/asset.html");
const script = read("assets/price.js");
const styles = read("assets/price.css");
const htaccess = read(".htaccess");
const deploy = read(".github/workflows/deploy-parspack.yml");
const sitemap = read("sitemap.xml");
const builder = read("scripts/build-pages.mjs");
const ratesApi = read("api/rates.php");
const converter = read("index.html");

// فایل جاوااسکریپت باید مستقل و از نظر نحوی معتبر باشد.
new vm.Script(script, { filename: "assets/price.js" });

for (const [name, html] of [["hub", hub], ["category", category], ["asset", asset]]) {
  assert.match(html, /class="breadcrumbs"/, `${name}: بردکرامب لازم است`);
  assert.match(html, /id="price-schema"[^>]*application\/ld\+json/, `${name}: جایگاه JSON-LD لازم است`);
  assert.match(html, /<h1\b/, `${name}: H1 لازم است`);
  assert.match(html, /<meta name="robots" content="index, follow(?:,|\")/, `${name}: robots باید صریح باشد`);
  assert.match(html, /<link rel="canonical"/, `${name}: canonical لازم است`);
}

assert.ok(asset.indexOf('id="asset-price"') < asset.indexOf('class="asset-content"'), "قیمت باید بالاتر از محتوای SEO باشد");
assert.match(hub, /<h1>قیمت لحظه‌ای<\/h1>/, "عنوان صفحه اصلی قیمت باید کوتاه باشد");
assert.match(converter, /<p class="eyebrow">مبدل قیمت<\/p>/, "هوم‌پیج باید برچسب مبدل قیمت داشته باشد");
assert.doesNotMatch(hub, /دارایی‌های پرکاربرد|featured-assets|updated-label|market-overview/, "هاب قیمت فقط باید دسته‌بندی‌ها را نشان دهد");
assert.match(script, /className = "category-card-details"/, "نام و تعداد هر دسته باید در یک ستون جمع‌وجور باشند");
assert.match(script, /CATEGORY_ORDER = \["fiat", "gold", "coin", "commodity", "crypto"\]/, "ترتیب هاب باید ارز، طلا، سکه، فلزات و ارز دیجیتال باشد");
assert.doesNotMatch(script, /FEATURED|featured-assets|updated-label/, "منطق سکشن پرکاربرد باید کامل حذف شود");
assert.match(script, /small\.textContent = asset\.code \|\| ""/, "زیرعنوان ردیف‌های بازار باید فقط نماد دارایی باشد");
assert.doesNotMatch(script, /small\.textContent = asset\.group === "crypto" \? asset\.englishName/, "نام انگلیسی رمزارز نباید در فهرست دسته نمایش داده شود");
assert.doesNotMatch(asset, /asset-facts|asset-code|asset-group|asset-source/, "کارت‌های نماد، دسته و منبع باید حذف شوند");
assert.doesNotMatch(asset, />قیمت هر واحد<|>تغییر ۲۴ ساعت</, "برچسب‌های توضیحی اضافی در هدر دارایی لازم نیستند");
assert.match(script, /text\(document\.getElementById\("asset-unit"\), priceLabel\(asset\)\)/, "واحد قیمت باید فقط تومان، دلار یا تتر باشد");
assert.match(styles, /\/\* Compact price hub category rows \*\/[\s\S]*\.category-grid\{[^}]*grid-template-columns:1fr/, "دسته‌های هاب باید همیشه تک‌ستونه باشند");
assert.doesNotMatch(hub, /دید کلی بازار|انتخاب بازار|نرخ‌های لحظه ای/, "متن‌های تزئینی اضافه نباید در هاب قیمت باشند");
assert.doesNotMatch(category + asset, /class="(?:eyebrow|section-kicker)"/, "برچسب سبز بالای عنوان در صفحات قیمت لازم نیست");
assert.match(converter, /class="main-nav"[\s\S]*href="\/price\/"/, "سوییچ مبدل و قیمت باید در صفحه مبدل هم باشد");
assert.match(script, /crypto:[\s\S]*gold:[\s\S]*coin:/, "طلا و سکه باید دسته‌های جدا باشند");
assert.match(script, /fiat:\s*\{ name: "ارز", singular: "ارز"/, "نام دسته فیات باید ارز باشد");
assert.match(script, /asset\.group === "crypto" \? asset\.englishName/, "نام انگلیسی فقط برای رمزارز نمایش داده شود");
assert.match(script, /\^\(\.\+\)-rls\$/, "فقط بازار مستقیم تومانی رمزارزها پذیرفته شود");
assert.match(script, /Number\(tomanRow && tomanRow\.latest\) \/ 10/, "بازار مستقیم ریالی نوبیتکس باید برای معادل تومان استفاده شود");
assert.match(script, /stats\[id \+ "-usdt"\]/, "قیمت اصلی رمزارز غیراستیبل باید از بازار تتری بیاید");
assert.match(script, /!USD_STABLECOINS\[id\]/, "استیبل‌کوین دلاری نباید قیمت تتری اصلی بگیرد");
assert.match(script, /useUsdt \? usdtRow : tomanRow/, "درصد تغییر باید از همان بازار قیمت اصلی بیاید");
assert.match(script, /assets\[id\]\.change = Number\(row\.change\)/, "تغییر دارایی‌های پراکسی استفاده شود");
assert.match(ratesApi, /'usd'\s*=>\s*\$usdPrice/, "API باید قیمت خام دلاری انس را حفظ کند");
assert.match(asset, /id="asset-secondary" hidden/, "معادل تومان باید فقط در صفحه تکی و به‌صورت ثانویه باشد");
assert.match(styles, /\.price-secondary strong[^}]*font-size:16px/, "قیمت تومانی ثانویه باید کوچک‌تر باشد");
assert.match(asset, /class="asset-quote"[\s\S]*id="asset-change"[\s\S]*id="asset-price"[\s\S]*id="asset-unit"/, "درصد، قیمت و واحد باید در ردیف قیمت مشترک باشند");
assert.match(asset, /class="price-freshness"[^>]*>[\s\S]*<i aria-hidden="true"><\/i>/, "زمان به‌روزرسانی باید نشانگر سبز داشته باشد");
assert.match(script, /freshness\.replaceChildren\(dot, document\.createTextNode/, "رندر زمان نباید نشانگر سبز را حذف کند");
assert.match(styles, /\.asset-price-hero::before\{content:none\}/, "پس‌زمینه گرد تزئینی کارت قیمت باید حذف شود");
assert.match(styles, /grid-template-areas:"unit price change"/, "واحد، قیمت و درصد باید به ترتیب بصری خواسته‌شده چیده شوند");
assert.match(styles, /\.price-change\{[^}]*align-self:center/, "درصد تغییر باید در موبایل از نظر عمودی وسط ردیف قیمت باشد");
assert.match(styles, /\.asset-english\{[^}]*text-align:right/, "زیرعنوان انگلیسی دارایی باید راست‌چین باشد");
assert.match(styles, /\.site-header>\.wide-shell\{width:min\(100% - 32px,720px\)\}/, "عرض هدر صفحات قیمت باید با مبدل یکسان باشد");
assert.match(styles, /\.price-main\.wide-shell\{width:min\(100% - 32px,720px\)\}/, "عرض محتوای دسکتاپ صفحات قیمت نباید از هدر بیشتر باشد");
assert.match(styles, /\.site-header>\.wide-shell,\.price-main\.wide-shell\{width:min\(100% - 24px,720px\)\}/, "عرض موبایل باید حاشیه فعلی را حفظ کند");
assert.match(styles, /@media\(max-width:600px\)[\s\S]*\.brand-mark,\.brand-mark svg\{width:40px;height:40px\}/, "اندازه لوگوی موبایل باید با مبدل یکسان بماند");
assert.doesNotMatch(script, /cdn\.nobitex\.ir/, "آیکون‌ها نباید از CDN نوبیتکس خوانده شوند");
assert.match(styles, /@media\(max-width:600px\)/, "نمای موبایل لازم است");
assert.match(styles, /\.category-card-icon\{[^}]*border-radius:50%/, "آیکون دسته‌ها باید گرد باشد");
assert.match(script, /heroIcon\.classList\.toggle\("is-full-bleed", group === "gold" \|\| group === "commodity"\)/, "آیکون بزرگ دسته طلا و فلزات باید تمام دایره را پر کند");
assert.match(script, /icon\.classList\.toggle\("is-full-bleed", asset\.group === "gold" \|\| asset\.group === "commodity"\)/, "آیکون صفحه تکی طلا و فلزات باید تمام دایره را پر کند");
assert.match(styles, /\.asset-main-icon\.is-full-bleed \.asset-main-icon-inner[^}]*width:100%;height:100%/, "ظرف داخلی آیکون full-bleed باید هم‌اندازه دایره باشد");

assert.match(htaccess, /\^price\/\(crypto\|gold\|coin\|commodity\|fiat\)\/\?\$/, "مسیر دسته قیمت باید بازنویسی شود");
assert.match(htaccess, /price\/asset\.html/, "مسیر دارایی قیمت باید بازنویسی شود");
assert.match(deploy, /assets data scripts api price _site\//, "پوشه price باید منتشر شود");

// تا پایان تست محصول، هیچ صفحه قیمت وارد سایت‌مپ یا سازنده آن نشود.
assert.doesNotMatch(sitemap, /\/price\//, "صفحات قیمت فعلاً نباید در سایت‌مپ باشند");
assert.doesNotMatch(builder, /\/price\//, "سازنده سایت‌مپ فعلاً نباید صفحه قیمت بسازد");

console.log("price page tests passed");
