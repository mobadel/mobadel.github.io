/*
 * اسکریپت ساخت صفحه‌ها جدول نام و اسلاگ خودش را دارد، چون نمی‌تواند
 * جدول داخل IIFE فایل app.js را import کند. این تست جلوی جدا افتادن
 * آن دو را می‌گیرد: اگر نامی در app.js عوض شود ولی در اسکریپت نه،
 * اینجا شکست می‌خورد نه در تولید.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const app = fs.readFileSync("assets/app.js", "utf8");
const builder = fs.readFileSync("scripts/build-pages.mjs", "utf8");

/* ── ۱) اسلاگ‌های ویژه در هر دو فایل یکی باشند ────────────────── */
const appOverrides = {};
const overrideBlock = app.match(/var SLUG_OVERRIDES = \{([\s\S]*?)\};/);
assert.ok(overrideBlock, "SLUG_OVERRIDES در app.js پیدا نشد");
for (const [, id, slug] of overrideBlock[1].matchAll(/(\w+):\s*"([^"]+)"/g)) {
  appOverrides[id] = slug;
}

const builderSlugs = {};
for (const [, id, slug] of builder.matchAll(/^\s{2}(\w+):\s*\{\s*slug:\s*"([^"]+)"/gm)) {
  builderSlugs[id] = slug;
}

for (const [id, slug] of Object.entries(appOverrides)) {
  assert.equal(builderSlugs[id], slug, `اسلاگ ${id} در اسکریپت ساخت با app.js نمی‌خواند`);
}

// هر دارایی‌ای که در اسکریپت هست و اسلاگ ویژه ندارد، اسلاگش باید خود شناسه باشد.
for (const [id, slug] of Object.entries(builderSlugs)) {
  if (!appOverrides[id]) {
    assert.equal(slug, id, `دارایی ${id} اسلاگ ویژه ندارد پس اسلاگش باید خود شناسه باشد`);
  }
}

/* ── ۲) نام فارسی هر دارایی با app.js یکی باشد ────────────────── */
const appNames = {};
for (const [, id, name] of app.matchAll(/\{\s*id:\s*"(\w+)",[^}]*?name:\s*"([^"]+)"/g)) {
  appNames[id] = name;
}
// تومان و تتر در شیء اولیه تعریف شده‌اند، نه در جدول آرایه‌ای
for (const [, id, name] of app.matchAll(/(\w+):\s*\{\s*id:\s*"\1",\s*code:[^}]*?name:\s*"([^"]+)"/g)) {
  appNames[id] = name;
}

const builderNames = {};
for (const [, id, name] of builder.matchAll(/^\s{2}(\w+):\s*\{\s*slug:\s*"[^"]+",\s*name:\s*"([^"]+)"/gm)) {
  builderNames[id] = name;
}

let checked = 0;
for (const [id, name] of Object.entries(builderNames)) {
  if (!appNames[id]) continue; // رمزارزهایی که نامشان از PERSIAN_NAMES می‌آید
  assert.equal(name, appNames[id], `نام فارسی ${id} در اسکریپت ساخت با app.js نمی‌خواند`);
  checked += 1;
}
// آستانه فقط برای این است که اگر الگوها روزی هیچ‌چیز را نگرفتند،
// تست بی‌سروصدا سبز نشود. عمداً پایین‌تر از تعداد واقعی است تا با
// افزودن یا حذف یک دارایی نشکند.
assert.ok(checked >= 15, `انتظار داشتیم دست‌کم ۱۵ نام بررسی شود، ${checked} شد`);

/* ── ۲ب) هیچ مسیر نسبی‌ای در app.js نماند ─────────────────────
   صفحه‌ها روی مسیرهایی مثل /btc-to-irt/ سرو می‌شوند، پس مسیر نسبی
   «assets/…» به «/btc-to-irt/assets/…» تبدیل می‌شود و ۴۰۴ می‌گیرد.
   همهٔ مسیرهای زمان اجرا باید ریشه‌ای باشند. */
const relativeIcons = app.match(/localIcon:\s*"(?!\/)[^"]+"/g) || [];
assert.deepEqual(relativeIcons, [], "مسیر آیکون باید با اسلش شروع شود");

const relativeFetches = app.match(/fetchJson\("(?!\/|https?:)[^"]+"/g) || [];
assert.deepEqual(relativeFetches, [], "مسیر fetch باید ریشه‌ای باشد");

assert.match(app, /var GOLD_ICON = "\//);
assert.match(app, /var COIN_ICON = "\//);

/* ── ۳) اسکریپت واقعاً اجرا شود و خروجی درست بدهد ─────────────── */
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "tabdex-pages-"));
fs.cpSync("index.html", path.join(workdir, "index.html"));
fs.mkdirSync(path.join(workdir, "scripts"), { recursive: true });
fs.cpSync("scripts/build-pages.mjs", path.join(workdir, "scripts/build-pages.mjs"));

execFileSync(process.execPath, ["scripts/build-pages.mjs"], { cwd: workdir, stdio: "pipe" });

const generated = path.join(workdir, "_site", "gold18-to-irt", "index.html");
assert.ok(fs.existsSync(generated), "صفحهٔ gold18-to-irt ساخته نشد");

const html = fs.readFileSync(generated, "utf8");
assert.match(html, /<title>تبدیل طلای ۱۸ عیار به تومان \| مبدل قیمت \| تبدکس<\/title>/);
assert.match(html, /<meta name="description" content="تبدیل طلای ۱۸ عیار به تومان با قیمت لحظه ای\. مبدل نرخ طلای ۱۸ عیار به تومان\.">/);
assert.match(html, /<link rel="canonical" href="https:\/\/tabdex\.ir\/gold18-to-irt\/">/);
assert.match(html, /<h1 id="page-title">تبدیل طلای ۱۸ عیار به تومان<\/h1>/);
// مسیرها باید مطلق شده باشند وگرنه از داخل پوشه به فایل نمی‌رسند
assert.match(html, /src="\/assets\/app\.js/);
assert.doesNotMatch(html, /src="assets\//);

// همهٔ جفت‌ها، حتی جفت نمایش‌داده‌شده روی خانه، صفحهٔ مستقل دارند.
assert.ok(fs.existsSync(path.join(workdir, "_site", "usdt-to-irt")), "تتر به تومان باید صفحهٔ واقعی داشته باشد");
assert.ok(fs.existsSync(path.join(workdir, "_site", "usd-to-irt")), "دلار به تومان باید صفحهٔ واقعی داشته باشد");
assert.ok(fs.existsSync(path.join(workdir, "_site", "irt-to-usdt")), "جهت معکوس باید صفحه داشته باشد");

const sitemap = fs.readFileSync(path.join(workdir, "_site", "sitemap.xml"), "utf8");
assert.match(sitemap, /<loc>https:\/\/tabdex\.ir\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/tabdex\.ir\/melted-to-irt\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/tabdex\.ir\/irt-to-baharazadi\/<\/loc>/);
// نقره و مس هم در هر دو جهت با تومان صفحه دارند
["silver-to-irt", "irt-to-silver", "copper-to-irt", "irt-to-copper"].forEach((slug) => {
  assert.match(sitemap, new RegExp(`<loc>https://tabdex\\.ir/${slug}/</loc>`), `${slug} باید در سایت‌مپ باشد`);
  assert.ok(fs.existsSync(path.join(workdir, "_site", slug, "index.html")), `${slug} باید صفحهٔ واقعی داشته باشد`);
});

/* نام فارسی دارایی‌ها باید بدون افزودن واحد در قالب توضیحات بیاید. */
const ouncePage = fs.readFileSync(path.join(workdir, "_site", "ounce-to-irt", "index.html"), "utf8");
assert.match(ouncePage, /تبدیل انس طلا به تومان با قیمت لحظه ای\. مبدل نرخ انس طلا به تومان\./);

const silverPage = fs.readFileSync(path.join(workdir, "_site", "silver-to-irt", "index.html"), "utf8");
assert.match(silverPage, /<h1 id="page-title">تبدیل نقره ۹۹۹ به تومان<\/h1>/);
assert.match(silverPage, /تبدیل نقره ۹۹۹ به تومان با قیمت لحظه ای\. مبدل نرخ نقره ۹۹۹ به تومان\./);

const pageCount = (sitemap.match(/<loc>/g) || []).length;
assert.ok(pageCount > 50, `انتظار بیش از ۵۰ آدرس در سایت‌مپ، ${pageCount} بود`);

fs.rmSync(workdir, { recursive: true, force: true });

console.log(`pages tests passed (${checked} نام بررسی شد، ${pageCount} آدرس تولید شد)`);
