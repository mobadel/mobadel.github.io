const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

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
    (this.listeners[name] || []).forEach((callback) => callback({ key: details.key, target: this }));
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
  "asset-search", "asset-list", "asset-empty"
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id.includes("amount") || id === "asset-search" ? "input" : "div")]));
elements["amount-from"].value = "۱۰٬۰۰۰٬۰۰۰";
elements["asset-dialog"].hidden = true;
elements["asset-dialog"].backdrop = new FakeElement();

global.document = {
  activeElement: null,
  body: new FakeElement("body"),
  getElementById: (id) => elements[id],
  createElement: (tag) => new FakeElement(tag),
  addEventListener() {}
};
global.window = { setTimeout };
global.location = { hash: "", pathname: "/", search: "" };
global.history = { replaceState() {} };

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
    btc: { fa: "بیت‌کوین", en: "Bitcoin", alt: "" },
    eth: { fa: "اتریوم", en: "Ethereum", alt: "اتر" }
  }
};

global.fetch = async (url) => {
  if (String(url).includes("data/prices.json")) return { ok: false, status: 404, json: async () => ({}) };
  if (String(url).includes("data/currencies.json")) return { ok: true, json: async () => currencyNames };
  if (String(url).includes("/market/stats")) return { ok: true, json: async () => stats };
  if (String(url).includes("/v2/options")) return { ok: true, json: async () => options };
  throw new Error(`Unexpected URL: ${url}`);
};

vm.runInThisContext(fs.readFileSync("assets/app.js", "utf8"), { filename: "assets/app.js" });

setTimeout(() => {
  assert.match(elements["page-title"].textContent, /تبدیل تومان به تتر/);
  assert.match(elements["rate-value"].textContent, /۱ تومان.*تتر/);
  assert.equal(elements["amount-to"].value, "۱۰۰");

  elements["currency-from"].dispatch("click");
  const optionsInDialog = elements["asset-list"].children;
  assert.equal(optionsInDialog.length, 4);
  const bitcoinOption = optionsInDialog.find((item) => item.dataset.currency === "btc");
  assert.ok(bitcoinOption);
  assert.equal(bitcoinOption.children.length, 3);
  assert.equal(bitcoinOption.children[1].children[0].textContent, "بیت‌کوین");
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
  assert.match(elements["page-title"].textContent, /بیت‌کوین به تتر/);
  assert.match(elements["rate-value"].textContent, /۵۱٬۰۰۰/);

  elements["currency-to"].dispatch("click");
  const toman = elements["asset-list"].children.find((item) => item.dataset.currency === "irt");
  toman.dispatch("click");
  assert.match(elements["rate-value"].textContent, /۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان/);

  elements["swap"].dispatch("click");
  assert.match(elements["page-title"].textContent, /تومان به بیت‌کوین/);
  assert.ok(elements["rate-value"].textContent.startsWith("۱ تومان"));

  console.log("converter tests passed");
}, 30);
