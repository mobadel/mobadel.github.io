const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/* قاعده‌های سرور: دادهٔ پنل بسته بماند و محتوا پیش از «فایل واقعی» برسد. */
const htaccess = read(".htaccess");
assert.match(htaccess, /RewriteRule \^cms-data\(\?:\/\|\$\) - \[F,L\]/, "cms-data باید بسته باشد");
assert.match(htaccess, /RewriteRule \^panel\/\(\?:lib/, "کد داخلی پنل باید بسته باشد");
assert.match(htaccess, /\^cms-media\/\.\*\\\.\(\?:php/, "اجرای PHP در پوشهٔ رسانه باید بسته باشد");
assert.ok(htaccess.indexOf("panel/render.php") < htaccess.indexOf("RewriteCond %{REQUEST_FILENAME} -f"), "محتوای پنل باید پیش از قاعدهٔ فایل واقعی باشد");
assert.match(htaccess, /%\{DOCUMENT_ROOT\}\/cms-data\/published\/\$1\.php -f/, "فقط صفحه‌های منتشرشده باید از PHP بگذرند");

/* قاعده‌های ?amount= باید بالاتر از پنل بنشینند، وگرنه صفحه‌های مقدار از کار می‌افتند. */
assert.match(read("scripts/build-pages.mjs"), /const anchor = " {2}# محتوای دستی پنل:";/);
assert.ok(htaccess.includes("  # محتوای دستی پنل:"), "جای قاعده‌های مقدار باید در .htaccess بماند");

/* انتشار و محرمانگی */
for (const file of [".github/workflows/deploy-parspack.yml", "tools/deploy.sh"]) {
  assert.match(read(file), /cp -R panel _site\//, `${file}: پنل باید منتشر شود`);
  assert.match(read(file), /PANEL_SETUP_TOKEN/, `${file}: کلید راه‌اندازی باید از محیط بیاید`);
}
assert.match(read(".github/workflows/deploy-parspack.yml"), /cms-data\/users\.php panel\/lib\/core\.php/, "بسته بودن داده پس از دیپلوی باید بررسی شود");
const ignored = read(".gitignore");
for (const entry of ["panel/config.php", "panel/catalog.json", "cms-data/", "cms-media/"]) assert.ok(ignored.includes(entry), `${entry} نباید کامیت شود`);
assert.ok(!fs.existsSync(path.join(root, "panel/config.php")), "کلید راه‌اندازی نباید در مخزن باشد");

/* مبدل بدون رفرش جفت را عوض می‌کند؛ متن دستی نباید روی جفت دیگر بماند. */
const app = read("assets/app.js");
assert.match(app, /querySelector\("\.cms-content"\)[\s\S]{0,60}location\.href = target/);
assert.match(app, /\/cms-media\/custom-pairs\.json/);

/* ادیتور باید از خود سایت بار شود. */
assert.match(read("panel/index.php"), /src="vendor\/tinymce\/tinymce\.min\.js/);
assert.ok(fs.existsSync(path.join(root, "panel/vendor/tinymce/langs/fa.js")), "زبان فارسی ادیتور");

/* پاک‌سازی و تزریق با خود PHP بررسی می‌شوند. */
const php = process.env.PHP_BIN || "php";
if (spawnSync(php, ["-v"]).status !== 0) {
  console.log("php در دسترس نیست؛ بررسی پاک‌سازی پنل رد شد");
} else {
  const script = `
    require ${JSON.stringify(path.join(root, "panel/lib/core.php"))};
    require ${JSON.stringify(path.join(root, "panel/lib/sanitize.php"))};
    $clean = cms_sanitize(file_get_contents("php://stdin"));
    $page = '<head></head><main><section class="pair-content" aria-labelledby="x"><h2 id="pair-content-title">auto</h2><p class="pair-links"><a href="/l">l</a></p></section></main>';
    echo json_encode([
      "clean" => $clean,
      "pair" => cms_inject($page, '<p>$1 \\\\1</p>', "convert/usd-to-irt"),
      "missing" => cms_inject("<main></main>", "<p>x</p>", "price/gold/gold18"),
      "traversal" => cms_key_from_path("/price/../../cms-data/users"),
      "newline" => cms_key_from_path("/price/gold\\n"),
      "dynamic" => cms_key_from_path("/convert/btc-to-eur/?amount=3"),
    ], JSON_UNESCAPED_UNICODE);
  `;
  const input = `<h1>تیتر</h1><p onclick="x()" style="color:#f00;background:url(javascript:x)">متن <a href="java&#10;script:x()">a</a><a href="https://a.example/" target="_blank">b</a></p><script>x()</script><img src=x onerror=y()><iframe src="https://e.example"></iframe><video src="/v.mp4" autoplay></video>`;
  const run = spawnSync(php, ["-r", script], { input, encoding: "utf8" });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
  const out = JSON.parse(run.stdout);
  assert.ok(!/onclick|onerror|javascript:|<script|<iframe|autoplay|url\(/i.test(out.clean), out.clean);
  assert.ok(out.clean.includes("<h2>تیتر</h2>"), "h1 باید h2 شود");
  assert.ok(out.clean.includes("متن"), "متن فارسی باید سالم بماند");
  assert.ok(out.clean.includes('rel="noopener noreferrer"'), out.clean);
  assert.ok(out.clean.includes('controls="controls"'), out.clean);
  assert.ok(!out.clean.includes("<img"), "عکس بدون نشانی معتبر حذف شود");
  assert.ok(out.pair.includes("<p>$1 \\1</p>"), "کاراکترهای $ و \\ در متن نباید تفسیر شوند");
  assert.ok(out.pair.includes('class="pair-links"'), "لینک‌های مرتبط باید بمانند");
  assert.ok(!out.pair.includes("pair-content-title"), "متن خودکار باید جایگزین شود");
  assert.strictEqual(out.missing, "<main></main>", "بدون جای محتوا، صفحه دست‌نخورده برگردد");
  assert.strictEqual(out.traversal, null);
  assert.strictEqual(out.newline, null);
  assert.strictEqual(out.dynamic, "convert/btc-to-eur");
}

console.log("panel tests passed");
