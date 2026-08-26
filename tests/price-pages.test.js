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
assert.match(script, /crypto:[\s\S]*gold:[\s\S]*coin:/, "طلا و سکه باید دسته‌های جدا باشند");
assert.match(script, /\^\(\.\+\)-rls\$/, "فقط بازار مستقیم تومانی رمزارزها پذیرفته شود");
assert.match(script, /Number\(row && row\.latest\) \/ 10/, "ریال نوبیتکس باید مستقیم به تومان تبدیل شود");
assert.match(script, /change: Number\(row\.dayChange\)/, "تغییر ۲۴ ساعته نوبیتکس استفاده شود");
assert.match(script, /assets\[id\]\.change = Number\(row\.change\)/, "تغییر دارایی‌های پراکسی استفاده شود");
assert.doesNotMatch(script, /cdn\.nobitex\.ir/, "آیکون‌ها نباید از CDN نوبیتکس خوانده شوند");
assert.match(styles, /@media\(max-width:600px\)/, "نمای موبایل لازم است");

assert.match(htaccess, /\^price\/\(crypto\|gold\|coin\|commodity\|fiat\)\/\?\$/, "مسیر دسته قیمت باید بازنویسی شود");
assert.match(htaccess, /price\/asset\.html/, "مسیر دارایی قیمت باید بازنویسی شود");
assert.match(deploy, /assets data scripts api price _site\//, "پوشه price باید منتشر شود");

// تا پایان تست محصول، هیچ صفحه قیمت وارد سایت‌مپ یا سازنده آن نشود.
assert.doesNotMatch(sitemap, /\/price\//, "صفحات قیمت فعلاً نباید در سایت‌مپ باشند");
assert.doesNotMatch(builder, /\/price\//, "سازنده سایت‌مپ فعلاً نباید صفحه قیمت بسازد");

console.log("price page tests passed");
