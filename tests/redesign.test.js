/*
 * قرارداد بازطراحی مهر ۱۴۰۵: هدر با منو و فوتر کامل در همهٔ قالب‌ها،
 * بخش‌های تازهٔ هر صفحه، و حالت خلاصهٔ روزانهٔ api/history.php.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { execFileSync, spawnSync } = require("node:child_process");

const read = (path) => fs.readFileSync(path, "utf8");
const templates = {
  home: read("index.html"), convert: read("convert/index.html"),
  hub: read("price/index.html"), category: read("price/category.html"), asset: read("price/asset.html")
};
const css = read("assets/site.css");

for (const file of ["site.js", "convert-extras.js", "asset-insights.js", "home.js", "price.js", "app.js"]) {
  new vm.Script(read(`assets/${file}`), { filename: file });
}

for (const [name, html] of Object.entries(templates)) {
  assert.match(html, /<nav class="site-nav" id="site-nav" aria-label="منوی اصلی">/, `${name}: منوی اصلی لازم است`);
  for (const href of ["/price/", "/price/currency/", "/price/gold/", "/price/coin/", "/price/crypto/", "/convert/", "/mag/"]) {
    assert.ok(html.includes(`class="site-nav"`) && new RegExp(`site-nav[^\\n]*href="${href}"`).test(html), `${name}: منو باید ${href} را داشته باشد`);
  }
  // فوتر کامل، نه فهرست خلاصه، در همهٔ صفحه‌ها
  assert.match(html, /class="site-footer"><?[\s\S]*class="site-shell footer-inner"[\s\S]*class="footer-brand"/, `${name}: فوتر کامل لازم است`);
  for (const label of ["قیمت‌ها", "ابزارها و محتوا", "تبدکس"]) assert.match(html, new RegExp(`<strong>${label}</strong>`), `${name}: ستون «${label}» فوتر`);
  assert.match(html, /\/assets\/site\.css\?v=20261014-[a-z0-9-]+/, `${name}: site.css`);
  assert.match(html, /\/assets\/site\.js\?v=20261014-fixes/, `${name}: site.js`);
  assert.doesNotMatch(html, /←/, `${name}: فلش متنی نباید باشد`);
  // هدر موبایل: لوگو، دکمهٔ جستجو و دکمهٔ منو که فهرست را باز می‌کند.
  assert.match(html, /class="header-actions"><a class="header-icon" href="\/price\/#search" aria-label="جستجوی دارایی">[\s\S]*?id="menu-toggle"[^>]*aria-expanded="false" aria-controls="site-nav"/, `${name}: دکمه‌های هدر موبایل`);
}

assert.match(templates.home, /id="home-kpis"[\s\S]*class="converter-card"[\s\S]*id="quick-amounts"/, "هوم: شاخص‌ها و مبدل با مبلغ سریع");
// بخش مبدل هوم با طراحی اولیه: عنوان بیرون و بالای کارت، «مبدل کامل» وسط و در ردیف جدا.
assert.match(templates.home, /<section class="intro" aria-labelledby="page-title">[\s\S]*?<\/section>\s*<section class="converter-card"/, "هوم: عنوان مبدل بالای کارت");
assert.match(templates.home, /<\/div>\s*<div class="converter-more"><a class="section-link" href="\/convert\/">مبدل کامل/, "هوم: مبدل کامل در ردیف جدا");
assert.match(css, /\.converter-more \{[^}]*justify-content: center/, "مبدل کامل وسط‌چین");
assert.match(css, /\.home-converter-col \.rate-summary \{ grid-template-columns: 1fr;/, "نرخ و زمان به‌روزرسانی زیر هم");
assert.doesNotMatch(css, /\.converter-card \.(?:rate-summary|rate-status|field-control|currency-badge) \{/, "کارت مبدل نباید روی طراحی اولیهٔ styles.css بازنویسی شود");
// فوتر روشن
assert.match(css, /\.site-footer \{[^}]*background: var\(--surface\);/, "پس‌زمینهٔ فوتر روشن");
assert.match(templates.home, /id="home-market-filters"[\s\S]*class="home-market-trend">روند ۳۰ روز/, "هوم: تگ‌های دسته و ستون روند");
assert.match(templates.home, /id="home-usd-chart" hidden[\s\S]*id="home-movers" hidden/, "هوم: کارت‌های کناری تا رسیدن داده پنهان‌اند");
assert.match(templates.home, /class="home-mag" id="home-mag"[^>]*hidden/, "هوم: مجله بدون داده پنهان می‌ماند");
assert.doesNotMatch(templates.home, /home-faq|class="ticker/, "پرسش‌ها و نوار تیکر عمداً حذف شده‌اند");
assert.match(templates.convert, /id="quick-amounts"[\s\S]*id="converter-insights"[^>]*hidden[\s\S]*id="conversion-tables"[^>]*hidden[\s\S]*class="pair-content"/, "مبدل: مبلغ سریع، خلاصه و جدول تبدیل");
assert.match(templates.hub, /id="hub-search"[\s\S]*id="hub-indices"[\s\S]*id="category-grid"[\s\S]*id="hub-movers"/, "هاب: جستجو، شاخص‌ها، دسته‌ها و بیشترین تغییرات");
assert.match(templates.category, /id="category-stats"[\s\S]*id="market-sort"[\s\S]*id="market-table-wrap"[\s\S]*id="other-markets"/, "دسته: آمار، مرتب‌سازی، جدول و بازارهای دیگر");
assert.match(templates.convert, /<body data-inline-picker>[\s\S]*class="convert-layout">[\s\S]*class="converter-card"[\s\S]*id="asset-dialog"[\s\S]*id="asset-recent"[\s\S]*<\/div>\n    <\/div>\n\n    <section class="conversion-tables"/, "مبدل: انتخابگر کنار مبدل");
assert.match(templates.asset, /id="asset-days-csv"[\s\S]*id="data-source-note"/, "دارایی: دانلود CSV و یادداشت منبع");
assert.match(templates.asset, /id="asset-hero-convert"[\s\S]*id="asset-share"[\s\S]*id="asset-stats"[^>]*hidden[\s\S]*id="btc-price-chart"[\s\S]*id="asset-days"[^>]*hidden[\s\S]*class="asset-content"[\s\S]*id="asset-quick"[\s\S]*id="asset-related"/, "دارایی: اقدام‌ها، آمار، نمودار، روزها، محتوا و ستون کناری");

// آیکون همهٔ دارایی‌ها گرد است.
for (const selector of [".round-icon", ".round-icon img"]) {
  assert.match(css, new RegExp(selector.replace(/\./g, "\\.") + " \\{[^}]*border-radius: 50%"), `${selector} باید گرد باشد`);
}
assert.match(read("assets/styles.css"), /\.field-control \{[^}]*flex-direction: row-reverse;/, "ترتیب مبدل: آیکون و نام راست، عدد چپ");

// app.js جفت و نرخ را برای بخش‌های کمکی می‌فرستد، بی‌خطر در محیط بدون CustomEvent.
const app = read("assets/app.js");
assert.match(app, /function paint\(\) \{[^}]*notifyPair\(\);[^}]*\}/);
assert.match(app, /typeof CustomEvent !== "function"\) return;/);
assert.match(read("assets/convert-extras.js"), /addEventListener\("tabdex:pair"/);

// ── api/history.php: خلاصهٔ روزانهٔ چنددارایی ──────────────────────
const php = spawnSync("php", ["-v"], { encoding: "utf8" });
if (php.status === 0) {
  const run = (code) => execFileSync("php", ["-r", code], { cwd: "api", encoding: "utf8" });
  // دو نقطه در یک روز تهران و یکی در روز بعد؛ پایانی هر روز باید بماند.
  const closes = JSON.parse(run(`require "market-history.php"; echo json_encode(historyDailyCloses([[1757300400,10],[1757340000,30],[1757394000,40],[1757200000,5]], 1757250000));`));
  assert.deepEqual(closes, [[1757340000, 30], [1757394000, 40]], "یک نقطهٔ پایانی برای هر روز تهران، با فیلتر شروع بازه");
  const merged = JSON.parse(run(`require "market-history.php"; echo json_encode(historyMergedPoints("x", "", ["assets"=>["x"=>[[200,2],[100,1]]]], ["assets"=>["x"=>[[200,3],[0,9],[300,-1]]]]));`));
  assert.deepEqual(merged, [[100, 1], [200, 3]], "ادغام seed و کش: مرتب، بی‌تکرار و بدون نقطهٔ نامعتبر");
  const call = (query) => run(`parse_str(${JSON.stringify(query)}, $_GET); include "history.php";`);
  assert.equal(JSON.parse(call("assets=usd,../x")).error, "invalid_assets", "شناسهٔ نامعتبر رد شود");
  assert.equal(JSON.parse(call("assets=" + Array.from({ length: 41 }, (_, i) => "a" + i).join(","))).error, "invalid_assets", "بیش از ۴۰ دارایی رد شود");
  const batch = JSON.parse(call("assets=usd,eur&days=99999"));
  assert.equal(batch.days, 400, "بازه به ۴۰۰ روز محدود شود");
  assert.ok(Array.isArray(batch.assets.usd) && Array.isArray(batch.assets.eur), "هر دارایی آرایهٔ خودش را دارد");
  assert.ok(Array.isArray(JSON.parse(call("asset=usd")).points), "حالت تک‌دارایی نمودار دست‌نخورده می‌ماند");
} else {
  console.log("php در دسترس نیست؛ بررسی history.php رد شد");
}

console.log("redesign tests passed");
