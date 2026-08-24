const assert = require("node:assert/strict");

// بدون این، خطای داخل کال‌بک async به‌صورت unhandledRejection
// رد می‌شود و تست بی‌صدا سبز می‌ماند.
process.on("unhandledRejection", (error) => { console.error(error); process.exit(1); });
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const styles = fs.readFileSync("assets/styles.css", "utf8");
assert.match(html, /<title>تبدیل قیمت دلار، طلا، ارز دیجیتال و سایر دارایی‌ها \| مبدل قیمت \| تبدکس<\/title>/);
assert.match(html, /<meta name="description" content="تبدیل قیمت دلار، طلا، سکه، تتر، بیت کوین، ارزهای دیجیتال، نقره و سایر دارایی‌ها با نرخ لحظه ای بازار ایران و جهان در تبدکس\.">/);
assert.match(html, /<link rel="canonical" href="https:\/\/tabdex\.ir\/">/);
assert.match(html, /<link rel="icon" href="\/assets\/favicon-48x48\.png" type="image\/png" sizes="48x48">/);
assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/apple-touch-icon\.png" sizes="180x180">/);
assert.doesNotMatch(html, /mobadel\.github\.io/);
assert.match(html, /<h1 id="page-title">تبدیل دلار به تومان<\/h1>/);
assert.match(html, /<script src="\/assets\/app\.js\?v=20260824-1"><\/script>/);
// دکمهٔ به‌روزرسانی حذف شد؛ نباید هیچ ردی از آن بماند
assert.doesNotMatch(html, /refresh-button|id="refresh"/, "دکمهٔ به‌روزرسانی باید حذف شده باشد");
assert.doesNotMatch(styles, /\.refresh-button/, "استایل دکمهٔ به‌روزرسانی باید حذف شده باشد");
// عنوان و زیرعنوان دارایی باید یک‌خطی بمانند
assert.match(styles, /\.currency-text strong,\s*\n\.currency-text small \{[^}]*white-space: nowrap/);
assert.match(styles, /\.currency-badge \{[\s\S]*?flex: 0 0 auto;/);
assert.ok(fs.existsSync("assets/favicon.ico"));
assert.ok(fs.existsSync("assets/favicon-48x48.png"));
assert.ok(fs.existsSync("assets/apple-touch-icon.png"));
assert.match(html, /<span class="brand-mark"[^>]*>[\s\S]*?<svg viewBox="0 0 64 64">[\s\S]*?<path d="M18 21h28l-7-7M46 43H18l7 7"\/>/);
assert.match(html, /<rect x="\.5" y="\.5" width="63" height="63" rx="17\.5" fill="#16815f"\/>/);
assert.match(styles, /\.brand-mark svg \{[^}]*stroke: none;[^}]*shape-rendering: geometricPrecision;/);
const brandMarkRule = styles.match(/\.brand-mark \{([^}]*)\}/)[1];
assert.doesNotMatch(brandMarkRule, /border-radius|box-shadow/);

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === true) this.values.add(value);
    else if (force === false) this.values.delete(value);
    else if (this.values.has(value)) this.values.delete(value);
    else this.values.add(value);
  }
}

class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.value = "";
    this.hidden = false;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.classList = new FakeClassList();
    this.selectionStart = 0;
    this._textContent = "";
    this._innerHTML = "";
  }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  dispatch(name, details = {}) {
    // target قابل بازنویسی است تا بشود کلیک روی یک فرزند را روی
    // شنوندهٔ والد شبیه‌سازی کرد (تگ‌های دسته از تفویض رویداد استفاده می‌کنند).
    (this.listeners[name] || []).forEach((callback) => callback({ key: details.key, target: details.target || this }));
  }
  closest(selector) {
    return selector === "[data-group]" && this.dataset.group ? this : null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelector() { return this.backdrop || null; }
  focus() { document.activeElement = this; }
  select() {}
  setSelectionRange(start) { this.selectionStart = start; }
  remove() {}
  set textContent(value) { this._textContent = String(value); this.children = []; }
  get textContent() { return this._textContent; }
  set innerHTML(value) { this._innerHTML = String(value); }
  get innerHTML() { return this._innerHTML; }
}

const ids = [
  "amount-from", "amount-to", "currency-from", "currency-to", "page-title", "rate-value",
  "rate-status", "swap", "refresh", "asset-dialog", "asset-dialog-title", "dialog-close",
  "asset-search", "asset-list", "asset-empty", "asset-filters", "asset-dialog-panel"
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id.includes("amount") || id === "asset-search" ? "input" : "div")]));
const filterChips = Object.fromEntries(["all", "crypto", "metal", "commodity", "fiat"].map((group) => {
  const button = new FakeElement("button");
  button.dataset.group = group;
  return [group, button];
}));
elements["asset-filters"].children = Object.values(filterChips);
elements["amount-from"].value = "۱۰۰";
elements["asset-dialog"].hidden = true;
elements["asset-dialog"].backdrop = new FakeElement();

// تگ‌های head که برنامه هنگام تغییر جفت به‌روزشان می‌کند
const headTags = {
  'link[rel="canonical"]': new FakeElement("link"),
  'meta[name="description"]': new FakeElement("meta"),
  'meta[property="og:title"]': new FakeElement("meta"),
  'meta[property="og:description"]': new FakeElement("meta"),
  'meta[name="twitter:title"]': new FakeElement("meta"),
  'meta[name="twitter:description"]': new FakeElement("meta"),
  'meta[property="og:url"]': new FakeElement("meta")
};

global.document = {
  activeElement: null,
  title: "",
  body: new FakeElement("body"),
  getElementById: (id) => elements[id],
  createElement: (tag) => new FakeElement(tag),
  querySelector: (selector) => headTags[selector] || null,
  addEventListener() {}
};
const windowListeners = {};
// pointerFine را تست عوض می‌کند تا هر دو حالت موبایل و دسکتاپ سنجیده شود
const media = { pointerFine: false };
global.window = {
  setTimeout,
  matchMedia(query) { return { matches: query.includes("pointer: fine") && media.pointerFine }; },
  addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); },
  dispatch(name) { (windowListeners[name] || []).forEach((callback) => callback({})); }
};
global.location = { hash: "", pathname: "/", search: "" };
// تاریخچهٔ جعلی: آدرس را روی location می‌نشاند تا بشود بررسی کرد
// چه چیزی به نوار آدرس رفته.
const historyStack = [];
global.history = {
  replaceState(stateObject, title, url) { if (url) location.pathname = url.split("?")[0]; },
  pushState(stateObject, title, url) {
    historyStack.push(url);
    if (url) location.pathname = url.split("?")[0];
  }
};

const stats = {
  status: "ok",
  stats: {
    "usdt-rls": { latest: "1000000" },
    "btc-rls": { latest: "50000000000" },
    "eth-rls": { latest: "2500000000" },
    "btc-usdt": { latest: "51000" }
  }
};
const options = {
  status: "ok",
  coins: [
    { coin: "btc", name: "Bitcoin", displayPrecision: "0.00000001" },
    { coin: "eth", name: "Ethereum", displayPrecision: "0.00000001" },
    { coin: "usdt", name: "Tether", displayPrecision: "0.0001" }
  ]
};
const currencyNames = {
  currencies: {
    irt: { fa: "تومان", en: "Toman", alt: "ریال" },
    usdt: { fa: "تتر", en: "Tether", alt: "" },
    btc: { fa: "بیت کوین", en: "Bitcoin", alt: "" },
    eth: { fa: "اتریوم", en: "Ethereum", alt: "اتر" }
  }
};

// اعداد عمداً گرد انتخاب شده‌اند تا ادعاهای تست خوانا بمانند:
// یورو ÷ دلار = ۱٫۲ دقیق.
const proxyRates = {
  updated: "2026-08-20T16:14:01+00:00",
  stale: false,
  assets: {
    gold18: { toman: 20000000, group: "gold", unit: "gram", name: "طلای ۱۸ عیار" },
    goldounce: { toman: 860000000, group: "gold", unit: "ounce", name: "انس طلا" },
    emami: { toman: 200000000, group: "coin", unit: "piece", name: "سکه امامی" },
    usd: { toman: 200000, group: "fiat", unit: "unit", name: "دلار" },
    eur: { toman: 240000, group: "fiat", unit: "unit", name: "یورو" },
    try: { toman: 4000, group: "fiat", unit: "unit", name: "لیر ترکیه" },
    aed: { toman: 54000, group: "fiat", unit: "unit", name: "درهم امارات" },
    silver: { toman: 420000, group: "commodity", unit: "gram", name: "شمش نقره" },
    copper: { toman: 2397310, group: "commodity", unit: "kilogram", name: "مس کاتد" }
  }
};

global.fetch = async (url) => {
  if (String(url).includes("api/rates.php")) return { ok: true, json: async () => proxyRates };
  if (String(url).includes("data/prices.json")) return { ok: false, status: 404, json: async () => ({}) };
  if (String(url).includes("data/currencies.json")) return { ok: true, json: async () => currencyNames };
  if (String(url).includes("/market/stats")) return { ok: true, json: async () => stats };
  if (String(url).includes("/v2/options")) return { ok: true, json: async () => options };
  throw new Error(`Unexpected URL: ${url}`);
};

vm.runInThisContext(fs.readFileSync("assets/app.js", "utf8"), { filename: "assets/app.js" });

setTimeout(async () => {
  assert.match(elements["page-title"].textContent, /تبدیل دلار به تومان/);
  assert.match(elements["rate-value"].textContent, /۱ دلار.*۲۰۰٬۰۰۰ تومان/);
  assert.equal(elements["amount-from"].value, "۱۰۰");
  assert.equal(elements["amount-to"].value, "۲۰٬۰۰۰٬۰۰۰");
  assert.equal(document.title, "تبدیل قیمت دلار، طلا، ارز دیجیتال و سایر دارایی‌ها | مبدل قیمت | تبدکس");

  elements["amount-from"].value = "100.55";
  elements["amount-from"].selectionStart = elements["amount-from"].value.length;
  elements["amount-from"].dispatch("input");
  assert.equal(elements["amount-from"].value, "۱۰۰٫۵۵");

  elements["amount-from"].value = "100.55.555";
  elements["amount-from"].selectionStart = elements["amount-from"].value.length;
  elements["amount-from"].dispatch("input");
  assert.equal(elements["amount-from"].value, "۱۰۰٫۵۵۵۵۵");

  elements["currency-from"].dispatch("click");
  const optionsInDialog = elements["asset-list"].children;
  // ۴ دارایی نوبیتکسی + ۹ دارایی پراکسی (شامل انس طلا، نقره و مس).
  assert.equal(optionsInDialog.length, 13);

  /* ترتیب باید بر اساس اهمیت باشد نه الفبا. قبلاً دلار ته فهرست ارزها
     می‌افتاد چون AED و EUR الفبایی جلوترند. */
  const order = optionsInDialog.map((item) => item.dataset.currency);
  assert.equal(order[0], "irt", "تومان باید اول باشد");
  assert.equal(order[1], "usdt", "تتر باید دوم باشد");
  assert.ok(order.indexOf("btc") < order.indexOf("eth"), "بیت کوین قبل از اتریوم");
  assert.ok(order.indexOf("usd") < order.indexOf("eur"), "دلار باید قبل از یورو بیاید");
  assert.ok(order.indexOf("usd") < order.indexOf("aed"), "دلار باید قبل از درهم بیاید");
  assert.ok(order.indexOf("usd") < order.indexOf("try"), "دلار باید قبل از لیر بیاید");
  assert.ok(order.indexOf("gold18") < order.indexOf("emami"), "طلای ۱۸ قبل از سکه امامی");
  assert.ok(order.indexOf("silver") < order.indexOf("usd"), "فلزات قبل از ارز فیات");
  const bitcoinOption = optionsInDialog.find((item) => item.dataset.currency === "btc");
  assert.ok(bitcoinOption);
  assert.equal(bitcoinOption.children.length, 3);
  assert.equal(bitcoinOption.children[1].children[0].textContent, "بیت کوین");
  assert.equal(bitcoinOption.children[1].children[1].textContent, "Bitcoin");
  assert.equal(bitcoinOption.children[2].textContent, "BTC");

  elements["asset-search"].value = "Ethereum";
  elements["asset-search"].dispatch("input");
  assert.equal(elements["asset-list"].children.length, 1);
  assert.equal(elements["asset-list"].children[0].dataset.currency, "eth");

  elements["asset-search"].value = "اتر";
  elements["asset-search"].dispatch("input");
  assert.equal(elements["asset-list"].children.length, 1);
  assert.equal(elements["asset-list"].children[0].dataset.currency, "eth");

  elements["asset-search"].value = "btc";
  elements["asset-search"].dispatch("input");
  assert.equal(elements["asset-list"].children.length, 1);
  elements["asset-list"].children[0].dispatch("click");
  assert.match(elements["page-title"].textContent, /بیت کوین به تومان/);
  assert.match(elements["rate-value"].textContent, /۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان/);

  elements["currency-to"].dispatch("click");
  const tether = elements["asset-list"].children.find((item) => item.dataset.currency === "usdt");
  tether.dispatch("click");
  assert.match(elements["rate-value"].textContent, /۵۱٬۰۰۰ تتر/);

  elements["swap"].dispatch("click");
  assert.match(elements["page-title"].textContent, /تتر به بیت کوین/);
  assert.ok(elements["rate-value"].textContent.startsWith("۱ تتر"));

  /* ── تگ‌های دسته ─────────────────────────────────────────── */
  const openDialog = (side) => elements[`currency-${side}`].dispatch("click");
  const listIds = () => elements["asset-list"].children.map((item) => item.dataset.currency);
  const clickChip = (group) => elements["asset-filters"].dispatch("click", { target: filterChips[group] });

  // محدودیت دسته‌ای برداشته شده: حتی وقتی مقصد بیت کوین است، طلا هم
  // باید در مبدأ قابل انتخاب باشد.
  openDialog("from");
  assert.ok(listIds().includes("gold18"), "طلا باید در برابر بیت کوین هم قابل انتخاب باشد");
  clickChip("metal");
  assert.deepEqual(listIds().sort(), ["emami", "gold18", "goldounce"], "تگ طلا و سکه در برابر بیت کوین هم باید پر باشد");

  openDialog("to");
  elements["asset-search"].value = "تومان";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "irt").dispatch("click");

  openDialog("from");
  assert.equal(elements["asset-filters"].children[0].attributes["aria-pressed"], "true", "تگ «همه» باید در آغاز فعال باشد");

  clickChip("metal");
  assert.deepEqual(listIds().sort(), ["emami", "gold18", "goldounce"], "تگ طلا و سکه فقط اقلام همان دسته را نشان دهد");

  clickChip("fiat");
  // تومان عمداً در دستهٔ ارز است، نه دستهٔ جدا.
  assert.deepEqual(listIds().sort(), ["aed", "eur", "irt", "try", "usd"], "تومان باید زیر تگ ارز بیاید");

  clickChip("commodity");
  assert.deepEqual(listIds().sort(), ["copper", "silver"], "تگ فلزات فقط نقره و مس");

  clickChip("crypto");
  assert.ok(!listIds().includes("irt"), "تومان نباید زیر تگ ارز دیجیتال بیاید");
  assert.ok(listIds().includes("btc"));
  assert.ok(!listIds().includes("silver"), "نقره نباید زیر تگ ارز دیجیتال بیاید");

  // تگ و متن جستجو باید AND شوند، نه OR.
  elements["asset-search"].value = "یورو";
  elements["asset-search"].dispatch("input");
  assert.equal(elements["asset-list"].children.length, 0, "یورو زیر تگ ارز دیجیتال نباید پیدا شود");

  /* ── طلا: بدون نماد، با واحد، و قابل تبدیل به همه ─────────── */
  openDialog("from");
  elements["asset-search"].value = "طلا";
  elements["asset-search"].dispatch("input");
  const goldOption = elements["asset-list"].children.find((item) => item.dataset.currency === "gold18");
  // بیت کوین سه فرزند دارد (آیکون، برچسب، نماد) ولی طلا نماد ندارد.
  assert.equal(goldOption.children.length, 2, "طلا نباید ستون نماد داشته باشد");
  assert.equal(goldOption.children[1].children[0].textContent, "طلای ۱۸ عیار");
  assert.equal(goldOption.children[1].children[1].textContent, "هر گرم");

  goldOption.dispatch("click");
  assert.match(elements["page-title"].textContent, /طلای ۱۸ عیار به تومان/);
  // واحد باید در نرخ دیده شود وگرنه «۱» مبهم است.
  assert.match(elements["rate-value"].textContent, /^۱ گرم طلای ۱۸ عیار = ۲۰٬۰۰۰٬۰۰۰ تومان$/);

  // در خود مبدل هم خط پررنگ باید نام فارسی باشد نه نماد.
  assert.equal(elements["currency-from"].children[1].children[0].textContent, "طلای ۱۸ عیار");
  assert.equal(elements["currency-from"].children[1].children[1].textContent, "هر گرم");

  // محدودیت برداشته شده: طلا حالا به همه چیز تبدیل می‌شود.
  openDialog("to");
  const fromGold = listIds();
  ["irt", "btc", "eth", "usdt", "eur", "usd", "emami"].forEach((id) => {
    assert.ok(fromGold.includes(id), `طلا باید به ${id} تبدیل شود`);
  });

  /* ── فیات به فیات از راه تومان ───────────────────────────── */
  openDialog("from");
  elements["asset-search"].value = "یورو";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "eur").dispatch("click");

  openDialog("to");
  const dollarOption = elements["asset-list"].children.find((item) => item.dataset.currency === "usd");
  assert.ok(dollarOption, "دلار باید در برابر یورو قابل انتخاب باشد");
  dollarOption.dispatch("click");
  assert.match(elements["rate-value"].textContent, /^۱ یورو = ۱٫۲ دلار$/);

  // ارز فیات هم به همه چیز، از جمله طلا و سکه.
  openDialog("to");
  const fromEuro = listIds();
  ["btc", "gold18", "emami", "irt", "usdt"].forEach((id) => {
    assert.ok(fromEuro.includes(id), `یورو باید به ${id} تبدیل شود`);
  });

  /* ── مسیریابی ─────────────────────────────────────────────── */

  // تغییر جفت باید آدرس را عوض کند.
  openDialog("from");
  elements["asset-search"].value = "btc";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "btc").dispatch("click");
  openDialog("to");
  elements["asset-list"].children.find((item) => item.dataset.currency === "irt").dispatch("click");
  assert.equal(location.pathname, "/btc-to-irt/", "تغییر جفت باید آدرس را عوض کند");
  assert.equal(document.title, "تبدیل بیت کوین به تومان | مبدل قیمت | تبدکس");
  assert.equal(headTags['meta[name="description"]'].attributes.content, "تبدیل بیت کوین به تومان با قیمت لحظه ای. مبدل نرخ بیت کوین به تومان.");
  assert.equal(headTags['link[rel="canonical"]'].attributes.href, "https://tabdex.ir/btc-to-irt/");

  // ولی تغییر مقدار نباید آدرس را دست بزند.
  const beforeAmount = location.pathname;
  const historyDepth = historyStack.length;
  elements["amount-from"].value = "۷۷۷";
  elements["amount-from"].selectionStart = 3;
  elements["amount-from"].dispatch("input");
  assert.equal(location.pathname, beforeAmount, "تغییر مقدار نباید آدرس را عوض کند");
  assert.equal(historyStack.length, historyDepth, "تغییر مقدار نباید رکورد تاریخچه بسازد");

  // جابه‌جایی طرفین آدرس معکوس می‌سازد.
  elements["swap"].dispatch("click");
  assert.equal(location.pathname, "/irt-to-btc/", "جابه‌جایی باید آدرس معکوس بسازد");

  // تتر به تومان، با وجود نمایش‌دادن همین جفت در نسخه‌های قدیمی خانه،
  // باید مسیر و canonical مستقل خودش را داشته باشد.
  openDialog("from");
  elements["asset-search"].value = "usdt";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "usdt").dispatch("click");
  openDialog("to");
  elements["asset-list"].children.find((item) => item.dataset.currency === "irt").dispatch("click");
  assert.equal(location.pathname, "/usdt-to-irt/", "تتر به تومان باید آدرس اسلاگ‌دار بدهد");
  assert.equal(
    headTags['link[rel="canonical"]'].attributes.href,
    "https://tabdex.ir/usdt-to-irt/",
    "canonical تتر به تومان باید مستقل باشد"
  );

  // برگشتن به جفت پیش‌فرض جدید هم نباید آدرس را به خانه تبدیل کند.
  openDialog("from");
  elements["asset-search"].value = "usd";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "usd").dispatch("click");
  assert.equal(location.pathname, "/usd-to-irt/", "دلار به تومان باید آدرس مستقل خودش را نشان دهد");
  assert.equal(headTags['link[rel="canonical"]'].attributes.href, "https://tabdex.ir/usd-to-irt/");

  /* ── فلزات: منبع به‌جای نماد لاتین ────────────────────────── */
  openDialog("from");
  clickChip("commodity");
  const silverOption = elements["asset-list"].children.find((item) => item.dataset.currency === "silver");
  assert.equal(silverOption.children.length, 3, "نقره باید ستون سوم داشته باشد");
  assert.equal(silverOption.children[2].textContent, "بورس کالا", "به‌جای نماد لاتین باید منبع نوشته شود");
  assert.equal(silverOption.children[1].children[0].textContent, "نقره ۹۹۹");
  assert.equal(silverOption.children[1].children[1].textContent, "هر گرم");

  const copperOption = elements["asset-list"].children.find((item) => item.dataset.currency === "copper");
  assert.equal(copperOption.children[2].textContent, "بورس کالا");
  assert.equal(copperOption.children[1].children[0].textContent, "مس", "عنوان مس باید کوتاه باشد، نه «مس کاتد»");
  assert.equal(copperOption.children[1].children[1].textContent, "هر کیلو");

  /* ── واحد نباید در نام تکرار شود ────────────────────────────
     «انس طلا» واحدش هم «انس» است، پس نباید بشود «۱ انس انس طلا».
     ولی «طلای ۱۸ عیار» که واحدش «گرم» است باید پیشوند بگیرد. */
  media.pointerFine = false;
  openDialog("from");
  elements["asset-search"].value = "انس";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "goldounce").dispatch("click");
  openDialog("to");
  elements["asset-list"].children.find((item) => item.dataset.currency === "irt").dispatch("click");
  assert.ok(
    elements["rate-value"].textContent.startsWith("۱ انس طلا ="),
    `واحد نباید تکرار شود، ولی نتیجه این بود: ${elements["rate-value"].textContent}`
  );
  assert.doesNotMatch(elements["rate-value"].textContent, /انس انس/, "«انس انس» نباید تکرار شود");

  openDialog("from");
  elements["asset-search"].value = "طلای ۱۸";
  elements["asset-search"].dispatch("input");
  elements["asset-list"].children.find((item) => item.dataset.currency === "gold18").dispatch("click");
  assert.ok(
    elements["rate-value"].textContent.startsWith("۱ گرم طلای ۱۸ عیار"),
    "دارایی‌هایی که نامشان با واحد شروع نمی‌شود باید پیشوند واحد بگیرند"
  );

  /* ── فوکوس هنگام باز شدن دیالوگ ────────────────────────────
     روی موبایل نباید فیلد جستجو فوکوس بگیرد، وگرنه کیبورد باز می‌شود
     و فهرست دارایی‌ها را می‌پوشاند. */
  await new Promise((resolve) => setTimeout(resolve, 5));

  media.pointerFine = false;               // موبایل
  document.activeElement = null;
  openDialog("from");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.notEqual(document.activeElement, elements["asset-search"], "روی موبایل فیلد جستجو نباید خودکار فوکوس بگیرد");
  assert.equal(document.activeElement, elements["asset-dialog-panel"], "فوکوس باید داخل دیالوگ برود، نه بیرون آن");

  media.pointerFine = true;                // دسکتاپ
  document.activeElement = null;
  openDialog("to");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(document.activeElement, elements["asset-search"], "روی دسکتاپ فوکوس خودکار باید بماند");

  media.pointerFine = false;
  assert.match(styles, /\.asset-dialog-panel:focus \{ outline: none; \}/, "فوکوس برنامه‌ای نباید حلقه نشان دهد");
  assert.match(html, /id="asset-dialog-panel" tabindex="-1"/, "پنل باید قابل فوکوس برنامه‌ای باشد");

  console.log("converter tests passed");
}, 30);
