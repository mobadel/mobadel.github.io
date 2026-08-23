/*
 * تست ورود مستقیم از آدرس.
 *
 * از converter.test.js جداست چون آنجا app.js یک‌بار و با آدرس ریشه
 * بارگذاری می‌شود، در حالی که اینجا باید هر بار با آدرس متفاوتی از نو
 * اجرا شود تا رفتار «کاربر مستقیم روی این لینک آمده» سنجیده شود.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/app.js", "utf8");

const stats = {
  status: "ok",
  stats: {
    "usdt-rls": { latest: "1000000" },
    "btc-rls": { latest: "50000000000" },
    "eth-rls": { latest: "2500000000" }
  }
};
const options = { status: "ok", coins: [{ coin: "btc", name: "Bitcoin", displayPrecision: "0.00000001" }] };
const proxyRates = {
  updated: "2026-08-20T16:14:01+00:00",
  stale: false,
  assets: {
    gold18: { toman: 20000000 }, gold24: { toman: 26000000 },
    goldmelted: { toman: 86000000 }, goldounce: { toman: 860000000 },
    emami: { toman: 200000000 }, bahar: { toman: 199000000 },
    halfcoin: { toman: 102000000 }, quartercoin: { toman: 56000000 },
    gramcoin: { toman: 29000000 },
    usd: { toman: 200000 }, eur: { toman: 240000 }
  }
};

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  toggle(v, force) {
    if (force === true) this.values.add(v);
    else if (force === false) this.values.delete(v);
    else if (this.values.has(v)) this.values.delete(v);
    else this.values.add(v);
  }
}

class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.value = ""; this.hidden = false; this.children = [];
    this.listeners = {}; this.attributes = {}; this.dataset = {};
    this.classList = new FakeClassList(); this.selectionStart = 0;
    this._textContent = ""; this._innerHTML = "";
  }
  addEventListener(name, cb) { (this.listeners[name] ||= []).push(cb); }
  dispatch(name, details = {}) {
    (this.listeners[name] || []).forEach((cb) => cb({ key: details.key, target: details.target || this }));
  }
  closest(selector) { return selector === "[data-group]" && this.dataset.group ? this : null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  querySelector() { return this.backdrop || null; }
  focus() {} select() {} setSelectionRange(s) { this.selectionStart = s; } remove() {}
  set textContent(v) { this._textContent = String(v); this.children = []; }
  get textContent() { return this._textContent; }
  set innerHTML(v) { this._innerHTML = String(v); }
  get innerHTML() { return this._innerHTML; }
}

// هر بار یک محیط تازه می‌سازد، app.js را با آدرس داده‌شده اجرا می‌کند
// و وضعیت قابل مشاهده را برمی‌گرداند.
function loadAt(pathname, search = "") {
  const ids = [
    "amount-from", "amount-to", "currency-from", "currency-to", "page-title", "rate-value",
    "rate-status", "swap", "refresh", "asset-dialog", "asset-dialog-title", "dialog-close",
    "asset-search", "asset-list", "asset-empty", "asset-filters"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id.includes("amount") ? "input" : "div")]));
  elements["amount-from"].value = "۱۰۰";
  elements["asset-dialog"].hidden = true;
  elements["asset-dialog"].backdrop = new FakeElement();

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
    activeElement: null, title: "", body: new FakeElement("body"),
    getElementById: (id) => elements[id],
    createElement: (tag) => new FakeElement(tag),
    querySelector: (s) => headTags[s] || null,
    addEventListener() {}
  };
  global.window = { setTimeout, addEventListener() {} };
  global.location = { hash: "", pathname, search };
  global.history = { replaceState() {}, pushState(s, t, url) { if (url) global.location.pathname = url.split("?")[0]; } };
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("api/rates.php")) return { ok: true, json: async () => proxyRates };
    if (u.includes("data/prices.json")) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes("data/currencies.json")) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes("/market/stats")) return { ok: true, json: async () => stats };
    if (u.includes("/v2/options")) return { ok: true, json: async () => options };
    throw new Error(`Unexpected URL: ${u}`);
  };

  vm.runInThisContext(source, { filename: "assets/app.js" });
  return { elements, headTags, heading: () => elements["page-title"].textContent };
}

(async () => {
  // ── جفت از روی آدرس خوانده می‌شود ─────────────────────────────
  let page = loadAt("/gold18-to-eur/");
  assert.equal(page.heading(), "تبدیل طلای ۱۸ عیار به یورو", "جفت باید از آدرس خوانده شود");

  // ── پارامتر amount ────────────────────────────────────────────
  page = loadAt("/gold18-to-irt/", "?amount=300");
  assert.equal(page.elements["amount-from"].value, "۳۰۰", "مقدار باید از پارامتر آدرس بیاید");

  // ── اسلاگ‌های ویژه ────────────────────────────────────────────
  const slugCases = [
    ["/melted-to-irt/", "تبدیل طلای آب‌شده به تومان"],
    ["/ounce-to-irt/", "تبدیل انس طلا به تومان"],
    ["/baharazadi-to-irt/", "تبدیل سکه بهار آزادی به تومان"],
    ["/nim-to-irt/", "تبدیل نیم سکه به تومان"],
    ["/rob-to-irt/", "تبدیل ربع سکه به تومان"],
    ["/gerami-to-irt/", "تبدیل سکه یک گرمی به تومان"],
    ["/gold24-to-usd/", "تبدیل طلای ۲۴ عیار به دلار"]
  ];
  slugCases.forEach(([path, expected]) => {
    assert.equal(loadAt(path).heading(), expected, `اسلاگ ${path} باید درست نگاشت شود`);
  });

  // ── بدون اسلش پایانی هم باید کار کند ──────────────────────────
  assert.equal(loadAt("/emami-to-irt").heading(), "تبدیل سکه امامی به تومان");

  // ── آدرس نامعتبر نباید صفحه را بشکند؛ به پیش‌فرض برمی‌گردد ─────
  assert.equal(loadAt("/totally-unknown-thing/").heading(), "تبدیل تتر به تومان", "اسلاگ ناشناخته باید بی‌خطر باشد");
  assert.equal(loadAt("/btc-to-btc/").heading(), "تبدیل تتر به تومان", "جفت یکسان باید نادیده گرفته شود");

  // ── ریشه همان پیش‌فرض می‌ماند ─────────────────────────────────
  const rootPage = loadAt("/");
  assert.equal(rootPage.heading(), "تبدیل تتر به تومان");
  assert.equal(document.title, "تبدیل قیمت دلار، طلا، ارز دیجیتال و سایر دارایی‌ها | مبدل قیمت | تبدکس");
  assert.equal(rootPage.headTags['meta[name="description"]'].attributes.content, "تبدیل قیمت دلار، طلا، سکه، تتر، بیت کوین، ارزهای دیجیتال، نقره و سایر دارایی‌ها با نرخ لحظه ای بازار ایران و جهان در تبدکس.");

  /* آدرس اسلاگ‌دار جفت پیش‌فرض هم باید مستقیماً کار کند، چون کاربر با
     عوض کردن جفت روی همین آدرس می‌نشیند و ممکن است لینکش را بفرستد.
     فایل ایستا ندارد و از راه بازنویسی سرو می‌شود. */
  assert.equal(loadAt("/usdt-to-irt/").heading(), "تبدیل تتر به تومان");
  assert.equal(loadAt("/irt-to-usdt/").heading(), "تبدیل تومان به تتر");

  /* ── رمزارزها هنگام بوت هنوز وجود ندارند ──────────────────────
     نوبیتکس دارایی‌هایش را async می‌آورد، پس آدرس رمزارزی در لحظهٔ
     بوت قابل اعمال نیست و باید بعد از رسیدن داده اعمال شود. بدون این،
     ورود مستقیم به /btc-to-irt/ روی جفت پیش‌فرض می‌ماند. */
  const cryptoPage = loadAt("/btc-to-irt/");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(cryptoPage.heading(), "تبدیل بیت کوین به تومان", "آدرس رمزارزی باید بعد از رسیدن داده اعمال شود");

  const cryptoPair = loadAt("/eth-to-btc/");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(cryptoPair.heading(), "تبدیل اتریوم به بیت کوین");

  // ترکیب رمزارز و دارایی پراکسی هم باید کار کند.
  const mixed = loadAt("/btc-to-gold18/", "?amount=2");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(mixed.heading(), "تبدیل بیت کوین به طلای ۱۸ عیار");
  assert.equal(mixed.elements["amount-from"].value, "۲");

  console.log("routing tests passed");
})();
