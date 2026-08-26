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
assert.doesNotMatch(script, /cdn\.nobitex\.ir/, "آیکون‌ها نباید از CDN نوبیتکس خوانده شوند");
assert.match(styles, /@media\(max-width:600px\)/, "نمای موبایل لازم است");
assert.match(styles, /\.category-card-icon\{[^}]*border-radius:50%/, "آیکون دسته‌ها باید گرد باشد");

assert.match(htaccess, /\^price\/\(crypto\|gold\|coin\|commodity\|fiat\)\/\?\$/, "مسیر دسته قیمت باید بازنویسی شود");
assert.match(htaccess, /price\/asset\.html/, "مسیر دارایی قیمت باید بازنویسی شود");
assert.match(deploy, /assets data scripts api price _site\//, "پوشه price باید منتشر شود");

// تا پایان تست محصول، هیچ صفحه قیمت وارد سایت‌مپ یا سازنده آن نشود.
assert.doesNotMatch(sitemap, /\/price\//, "صفحات قیمت فعلاً نباید در سایت‌مپ باشند");
assert.doesNotMatch(builder, /\/price\//, "سازنده سایت‌مپ فعلاً نباید صفحه قیمت بسازد");

console.log("price page tests passed");
