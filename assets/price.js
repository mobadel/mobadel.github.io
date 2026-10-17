(function () {
  "use strict";

  var ORIGIN = "https://tabdex.ir";
  var CATEGORIES = {
    crypto: { name: "ارزهای دیجیتال", singular: "ارز دیجیتال", description: "قیمت لحظه ای ارزهای دیجیتال در بازار تتری و تومانی ایران", icon: "/assets/crypto-icons/btc.svg" },
    gold: { name: "طلا", singular: "طلا", description: "قیمت طلای ۱۸ و ۲۴ عیار، طلای آب‌شده و انس جهانی", icon: "/assets/gold-18k.svg" },
    coin: { name: "سکه", singular: "سکه", description: "قیمت لحظه ای انواع سکه در بازار ایران", icon: "/assets/coin-emami.webp?v=20260825-2" },
    commodity: { name: "فلزات", singular: "فلز", description: "قیمت لحظه ای نقره ۹۹۹ و مس کاتد بورس کالا", icon: "/assets/silver.svg" },
    energy: { name: "انرژی", singular: "حامل انرژی", description: "قیمت لحظه ای نفت برنت و بنزین در بازارهای جهانی", icon: "/assets/crude-oil.svg" },
    fiat: { name: "ارز", singular: "ارز", description: "قیمت لحظه ای دلار، یورو و دیگر ارزهای رایج به تومان", icon: "/assets/flags/us.svg" }
  };
  var CATEGORY_ORDER = ["fiat", "gold", "coin", "commodity", "energy", "crypto"];
  var GROUP_SLUGS = { fiat: "currency" };
  var SLUGS = { goldmelted: "melted", goldounce: "ounce", bahar: "baharazadi", halfcoin: "nim", quartercoin: "rob", gramcoin: "gerami" };
  var SLUG_TO_ID = {};
  Object.keys(SLUGS).forEach(function (id) { SLUG_TO_ID[SLUGS[id]] = id; });
  var UNIT_LABELS = { gram: "گرم", piece: "عدد", mesghal: "مثقال", ounce: "انس", kilogram: "کیلو", barrel: "بشکه", gallon: "گالن" };
  var RANKED = ["btc", "usdt", "eth", "usdc", "xrp", "bnb", "sol", "doge", "trx", "ada", "gold18", "gold24", "goldmelted", "goldounce", "emami", "bahar", "halfcoin", "quartercoin", "gramcoin", "silver", "copper", "brent", "gasoline", "usd", "eur", "gbp", "aed", "try", "chf", "cad", "aud"];
  var RANK = {};
  var cmcRanks = {};
  var USD_STABLECOINS = { usdt: true, usdc: true, dai: true, busd: true, usde: true, tusd: true, fdusd: true, usdd: true, pyusd: true, gusd: true, susd: true, frax: true };
  RANKED.forEach(function (id, index) { RANK[id] = index; });

  var FIXED = [
    { id: "gold18", name: "طلای ۱۸ عیار", englishName: "18K Gold", group: "gold", unit: "gram", icon: "/assets/gold-18k.svg" },
    { id: "gold24", name: "طلای ۲۴ عیار", englishName: "24K Gold", group: "gold", unit: "gram", icon: "/assets/gold-18k.svg" },
    { id: "goldmelted", name: "طلای آب‌شده", englishName: "Melted Gold", group: "gold", unit: "mesghal", icon: "/assets/gold-18k.svg" },
    { id: "goldounce", name: "انس جهانی طلا", englishName: "Gold Ounce", group: "gold", unit: "ounce", icon: "/assets/gold-18k.svg" },
    { id: "emami", name: "سکه امامی", englishName: "Emami Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "bahar", name: "سکه بهار آزادی", englishName: "Bahar Azadi Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "halfcoin", name: "نیم سکه", englishName: "Half Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "quartercoin", name: "ربع سکه", englishName: "Quarter Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "gramcoin", name: "سکه یک گرمی", englishName: "One Gram Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "silver", name: "نقره ۹۹۹", englishName: "Silver 999", group: "commodity", unit: "gram", icon: "/assets/silver.svg" },
    { id: "copper", name: "مس", englishName: "Copper Cathode", code: "بورس کالا", group: "commodity", unit: "kilogram", icon: "/assets/copper.svg" },
    { id: "brent", name: "نفت برنت", englishName: "Brent Crude", code: "BRENT", group: "energy", unit: "barrel", icon: "/assets/crude-oil.svg" },
    { id: "gasoline", name: "بنزین آمریکا", englishName: "RBOB Gasoline", code: "RBOB", group: "energy", unit: "gallon", icon: "/assets/gasoline.svg" },
    { id: "usd", name: "دلار", englishName: "US Dollar", code: "USD", group: "fiat", icon: "/assets/flags/us.svg" },
    { id: "eur", name: "یورو", englishName: "Euro", code: "EUR", group: "fiat", icon: "/assets/flags/eu.svg" },
    { id: "gbp", name: "پوند", englishName: "British Pound", code: "GBP", group: "fiat", icon: "/assets/flags/gb.svg" },
    { id: "chf", name: "فرانک سوئیس", englishName: "Swiss Franc", code: "CHF", group: "fiat", icon: "/assets/flags/ch.svg" },
    { id: "aed", name: "درهم امارات", englishName: "UAE Dirham", code: "AED", group: "fiat", icon: "/assets/flags/ae.svg" },
    { id: "try", name: "لیر ترکیه", englishName: "Turkish Lira", code: "TRY", group: "fiat", icon: "/assets/flags/tr.svg" },
    { id: "jpy", name: "یکصد ین ژاپن", englishName: "100 Japanese Yen", code: "JPY", group: "fiat", icon: "/assets/flags/jp.svg" },
    { id: "cny", name: "یوآن چین", englishName: "Chinese Yuan", code: "CNY", group: "fiat", icon: "/assets/flags/cn.svg" },
    { id: "aud", name: "دلار استرالیا", englishName: "Australian Dollar", code: "AUD", group: "fiat", icon: "/assets/flags/au.svg" },
    { id: "cad", name: "دلار کانادا", englishName: "Canadian Dollar", code: "CAD", group: "fiat", icon: "/assets/flags/ca.svg" },
    { id: "rub", name: "روبل روسیه", englishName: "Russian Ruble", code: "RUB", group: "fiat", icon: "/assets/flags/ru.svg" },
    { id: "sek", name: "کرون سوئد", englishName: "Swedish Krona", code: "SEK", group: "fiat", icon: "/assets/flags/se.svg" },
    { id: "inr", name: "روپیه هند", englishName: "Indian Rupee", code: "INR", group: "fiat", icon: "/assets/flags/in.svg" },
    { id: "pkr", name: "روپیه پاکستان", englishName: "Pakistani Rupee", code: "PKR", group: "fiat", icon: "/assets/flags/pk.svg" },
    { id: "afn", name: "افغانی", englishName: "Afghan Afghani", code: "AFN", group: "fiat", icon: "/assets/flags/af.svg" },
    { id: "myr", name: "رینگیت مالزی", englishName: "Malaysian Ringgit", code: "MYR", group: "fiat", icon: "/assets/flags/my.svg" },
    { id: "thb", name: "بات تایلند", englishName: "Thai Baht", code: "THB", group: "fiat", icon: "/assets/flags/th.svg" },
    { id: "sar", name: "ریال عربستان", englishName: "Saudi Riyal", code: "SAR", group: "fiat", icon: "/assets/flags/sa.svg" },
    { id: "qar", name: "ریال قطر", englishName: "Qatari Riyal", code: "QAR", group: "fiat", icon: "/assets/flags/qa.svg" },
    { id: "kwd", name: "دینار کویت", englishName: "Kuwaiti Dinar", code: "KWD", group: "fiat", icon: "/assets/flags/kw.svg" },
    { id: "bhd", name: "دینار بحرین", englishName: "Bahraini Dinar", code: "BHD", group: "fiat", icon: "/assets/flags/bh.svg" },
    { id: "omr", name: "ریال عمان", englishName: "Omani Rial", code: "OMR", group: "fiat", icon: "/assets/flags/om.svg" },
    { id: "iqd", name: "دینار عراق", englishName: "Iraqi Dinar", code: "IQD", group: "fiat", icon: "/assets/flags/iq.svg" },
    { id: "syp", name: "لیر سوریه", englishName: "Syrian Pound", code: "SYP", group: "fiat", icon: "/assets/flags/sy.svg" },
    { id: "azn", name: "منات آذربایجان", englishName: "Azerbaijani Manat", code: "AZN", group: "fiat", icon: "/assets/flags/az.svg" },
    { id: "amd", name: "درام ارمنستان", englishName: "Armenian Dram", code: "AMD", group: "fiat", icon: "/assets/flags/am.svg" },
    { id: "gel", name: "لاری گرجستان", englishName: "Georgian Lari", code: "GEL", group: "fiat", icon: "/assets/flags/ge.svg" }
  ];

  var assets = {};
  FIXED.forEach(function (asset) { assets[asset.id] = Object.assign({}, asset); });
  var latestUpdate = null;
  /* وضعیت باز یا بسته بودن هر بازار از rates.php. گروه «ارز» در پاسخ
     «fiat» است؛ انس طلا بازار جهانی دارد و رمزارزها شبانه‌روزی‌اند. */
  var marketStatus = null;
  function marketClosed(asset) {
    if (!marketStatus || !asset || asset.group === "crypto" || asset.id === "goldounce") return false;
    return marketStatus[asset.group === "currency" ? "fiat" : asset.group] === false;
  }
  function closedHint() {
    var hint = document.createElement("span"); hint.className = "market-closed-hint"; hint.tabIndex = 0; hint.setAttribute("role", "img");
    var tip = "بازار رسمی این دارایی در حال حاضر بسته است."; hint.setAttribute("aria-label", tip); hint.setAttribute("data-tip", tip); hint.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
    return hint;
  }

  function packagedSlug(id) { var match = String(id || "").toLowerCase().match(/^\d+[kmb]_(.+)$/); return match ? match[1] : null; }
  function registerSlug(id) { var slug = packagedSlug(id); if (slug && (!SLUG_TO_ID[slug] || SLUG_TO_ID[slug] === id)) SLUG_TO_ID[slug] = id; }
  function slugOf(id) { return SLUGS[id] || packagedSlug(id) || id; }
  function idFromSlug(slug) { return SLUG_TO_ID[slug] || slug; }
  function groupSlug(group) { return GROUP_SLUGS[group] || group; }
  function groupFromSlug(slug) { return slug === "currency" ? "fiat" : slug; }
  function assetUrl(asset) { return "/price/" + groupSlug(asset.group) + "/" + slugOf(asset.id) + "/"; }
  function categoryUrl(group) { return "/price/" + groupSlug(group) + "/"; }
  function normalizeId(id) { id = String(id || "").toLowerCase(); return id === "rls" ? "irt" : id; }
  function rank(asset) { if (asset.group === "crypto") return Number.isFinite(cmcRanks[asset.id]) ? cmcRanks[asset.id] : 999999; return RANK[asset.id] == null ? RANKED.length : RANK[asset.id]; }
  function compareAssets(a, b) { return rank(a) - rank(b) || a.name.localeCompare(b.name, "fa"); }
  function formatNumber(value, digits) { return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits == null ? 0 : digits }).format(value); }
  function formatPrice(value, asset) { return Number.isFinite(value) ? formatNumber(value, asset && (asset.group === "crypto" || asset.priceCurrency === "USD") && value >= 1 ? 2 : value < 1 ? 6 : 0) : "ناموجود"; }
  function priceLabel(asset) { return asset.priceCurrency === "USDT" ? "تتر" : asset.priceCurrency === "USD" ? "دلار" : "تومان"; }
  function formattedPrice(asset) { return formatPrice(asset.price, asset) + " " + priceLabel(asset); }
  /* عنصر قیمت: عدد در span.num با قلم Estedad و واحد با قلم بدنه. */
  function priceEl(tag, className, value, unit) {
    var node = el(tag, className); node.append(el("span", "num", value), document.createTextNode(" " + unit)); return node;
  }
  function assetPriceEl(tag, className, asset) {
    return Number.isFinite(asset.price) ? priceEl(tag, className, formatPrice(asset.price, asset), priceLabel(asset)) : el(tag, className, formatPrice(asset.price, asset));
  }
  function formatChange(value) { if (!Number.isFinite(value)) return "—"; var sign = value > 0 ? "+" : ""; return sign + formatNumber(value, 2) + "٪"; }
  function formatAbsoluteChange(value) { return Number.isFinite(value) ? formatNumber(Math.abs(value), 2) + "٪" : "—"; }
  function changeClass(value) { return value > 0 ? "positive" : value < 0 ? "negative" : "neutral"; }
  /* ساعت تهران، نه ساعت دستگاه: کاربرِ خارج از ایران یا دستگاهی با
     منطقهٔ زمانی اشتباه وگرنه عددی می‌دید که با بازار نمی‌خواند.

     گرد کردن به نزدیک‌ترین دقیقه هم لازم است: زمانِ داده ثانیه دارد و
     قیچی‌کردنش باعث می‌شد نرخی که در ۱۳:۳۹:۵۰ ساخته شده تا ۱۳:۴۰:۴۹
     روی «۱۳:۳۹» بماند — یعنی همیشه یک دقیقه عقب به نظر برسد. فقط
     جلو نمی‌افتد: اگر گرد کردن از زمان حال رد شود، به پایین برمی‌گردد
     تا ساعتی از آینده نمایش داده نشود. */
  var TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" });

  function roundToMinute(date) {
    var rounded = new Date(Math.round(date.getTime() / 60000) * 60000);
    return rounded.getTime() > Date.now() ? new Date(Math.floor(date.getTime() / 60000) * 60000) : rounded;
  }

  function formatTime(date) { return date ? TIME_FORMATTER.format(roundToMinute(date)) : "—"; }
  function todayLabel() {
    var formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    var values = {};
    formatter.formatToParts(new Date()).forEach(function (part) { if (part.type !== "literal") values[part.type] = part.value; });
    return values.weekday + " " + values.day + " " + values.month + " " + values.year;
  }
  function unitText(asset) { return asset.unit && UNIT_LABELS[asset.unit] ? UNIT_LABELS[asset.unit] : "واحد"; }
  function text(el, value) { if (el) el.textContent = value; }

  function setMeta(attribute, key, value) {
    var tag = document.querySelector('meta[' + attribute + '="' + key + '"]');
    if (tag) tag.setAttribute("content", value);
  }
  function setDocumentMeta(title, description, path) {
    document.title = title;
    setMeta("name", "description", description); setMeta("property", "og:title", title); setMeta("property", "og:description", description); setMeta("property", "og:url", ORIGIN + path);
    var canonical = document.querySelector('link[rel="canonical"]'); if (canonical) canonical.href = ORIGIN + path;
  }
  function setSchema(graph) {
    var script = document.getElementById("price-schema");
    if (script) script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }
  function breadcrumb(items) {
    return { "@type": "BreadcrumbList", itemListElement: items.map(function (item, index) { return { "@type": "ListItem", position: index + 1, name: item.name, item: ORIGIN + item.path }; }) };
  }

  function iconPath(id) {
    if (id === "usdt") return "/assets/usdt-logo.svg";
    var png = { sent: true, tao: true, zk: true };
    return "/assets/crypto-icons/" + encodeURIComponent(id) + (png[id] ? ".png" : ".svg");
  }
  function createIcon(asset, className) {
    var wrap = document.createElement("span"); wrap.className = className || "asset-icon";
    if (!asset.icon) { wrap.textContent = (asset.code || asset.name || "؟").slice(0, 1); return wrap; }
    var image = document.createElement("img"); image.src = asset.icon; image.alt = ""; image.loading = "lazy";
    image.addEventListener("error", function () { image.remove(); wrap.textContent = (asset.code || asset.name || "؟").slice(0, 1); });
    wrap.appendChild(image); return wrap;
  }

  function loadJson(url, timeout) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : null;
    return fetch(url, { cache: "no-store", signal: controller ? controller.signal : undefined }).then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); }).finally(function () { if (timer) clearTimeout(timer); });
  }
  function loadNobitex() {
    return Promise.all([loadJson("https://apiv2.nobitex.ir/market/stats", 12000), loadJson("/data/currencies.json?t=" + Date.now(), 5000)]).then(function (responses) {
      var stats = responses[0] && responses[0].stats || {}; var names = responses[1] && responses[1].currencies || {};
      Object.keys(stats).forEach(function (key) {
        var match = key.match(/^(.+)-rls$/); if (!match) return;
        var id = normalizeId(match[1]); if (!id || id === "irt") return;
        var tomanRow = stats[key]; var tomanPrice = Number(tomanRow && tomanRow.latest) / 10; if (!Number.isFinite(tomanPrice) || tomanPrice <= 0) return;
        var usdtRow = stats[id + "-usdt"]; var usdtPrice = Number(usdtRow && usdtRow.latest); var useUsdt = !USD_STABLECOINS[id] && Number.isFinite(usdtPrice) && usdtPrice > 0;
        var nameRow = names[id] || {}; registerSlug(id); assets[id] = {
          id: id, name: nameRow.fa || id.toUpperCase(), englishName: nameRow.en || id.toUpperCase(), code: id.toUpperCase(), group: "crypto", unit: null,
          icon: iconPath(id), price: useUsdt ? usdtPrice : tomanPrice, priceCurrency: useUsdt ? "USDT" : "IRT", tomanPrice: useUsdt ? tomanPrice : null, tomanChange: useUsdt ? Number(tomanRow.dayChange) : null,
          change: Number((useUsdt ? usdtRow : tomanRow).dayChange), source: useUsdt ? "بازار تتری نوبیتکس" : "بازار تومانی نوبیتکس", updatedAt: new Date()
        };
      });
      latestUpdate = new Date();
    });
  }
  // سن و عمر کش سرور؛ زمان‌بند تازه‌سازی از همین‌ها فاز می‌گیرد.
  var proxyCache = { fetchedUnix: 0, ttl: 0 };

  function loadProxy() {
    return loadJson("/api/rates.php?t=" + Date.now(), 9000).then(function (payload) {
      proxyCache = { fetchedUnix: Number(payload && payload.fetched_unix) || 0, ttl: Number(payload && payload.ttl) || 0 };
      marketStatus = payload && payload.markets && typeof payload.markets === "object" ? payload.markets : null;
      var rows = payload && payload.assets || {}; var at = payload.updated ? new Date(payload.updated) : new Date(); if (!Number.isFinite(at.getTime())) at = new Date();
      Object.keys(rows).forEach(function (id) { if (!assets[id]) return; var row = rows[id]; var usd = Number(row.usd); // انرژی هم مثل انس طلا دلاری معامله می‌شود، پس عدد اصلی دلار است
        // و تومان زیرش می‌آید.
        var dollarPrimary = (id === "goldounce" || assets[id].group === "energy") && Number.isFinite(usd) && usd > 0; assets[id].price = dollarPrimary ? usd : Number(row.toman); assets[id].priceCurrency = dollarPrimary ? "USD" : "IRT"; assets[id].tomanPrice = dollarPrimary ? Number(row.toman) : null; assets[id].tomanChange = dollarPrimary ? Number(row.toman_change) : null; assets[id].change = Number(row.change); assets[id].source = assets[id].group === "energy" ? "بازار جهانی انرژی" : dollarPrimary ? "بازار جهانی طلا" : id === "copper" ? "بورس کالا" : "بازار ایران"; assets[id].updatedAt = at; });
      if (!latestUpdate || at > latestUpdate) latestUpdate = at;
    });
  }
  function loadCmcRanks() {
    return loadJson("/data/cmc-ranks.json?t=" + Date.now(), 5000).then(function (payload) {
      cmcRanks = payload && payload.ranks || {};
    });
  }
  function loadAll() { return Promise.allSettled([loadNobitex(), loadProxy(), loadCmcRanks()]); }
  function availableAssets(group) { return Object.keys(assets).map(function (id) { return assets[id]; }).filter(function (asset) { return asset.group === group && Number.isFinite(asset.price); }).sort(compareAssets); }

  /* ── خلاصهٔ روزانه از سرور ──────────────────────────────────────
     ستون‌های روند و بازهٔ چندروزه از یک درخواست چنددارایی می‌آیند.
     سرور پاسخ را پنج دقیقه کش می‌کند و اینجا هم هر دسته فقط یک‌بار در
     هر نیم ساعت دوباره خواسته می‌شود. رمزارزها تاریخچهٔ سرور ندارند. */
  var HISTORY_GROUPS = { fiat: true, gold: true, coin: true, commodity: true };
  var dailyHistory = {};
  var dailyRequests = {};
  function loadDaily(ids, days) {
    var wanted = ids.filter(function (id) { return id; }).slice(0, 40);
    if (!wanted.length) return Promise.resolve(false);
    var key = wanted.join(",") + "|" + days;
    var previous = dailyRequests[key];
    if (previous && Date.now() - previous.at < 30 * 60000) return previous.promise;
    var promise = fetch("/api/history.php?assets=" + encodeURIComponent(wanted.join(",")) + "&days=" + days, { headers: { Accept: "application/json" } })
      .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .then(function (payload) { var rows = payload && payload.assets || {}; Object.keys(rows).forEach(function (id) { if (Array.isArray(rows[id])) dailyHistory[id] = rows[id]; }); return true; })
      .catch(function () { delete dailyRequests[key]; return false; });
    dailyRequests[key] = { at: Date.now(), promise: promise };
    return promise;
  }
  function dailyValues(id) { return (dailyHistory[id] || []).map(function (point) { return Number(point[1]); }).filter(function (value) { return Number.isFinite(value) && value > 0; }); }
  function percentBetween(now, before) { return Number.isFinite(now) && Number.isFinite(before) && before > 0 ? (now - before) / before * 100 : NaN; }
  function valuesSince(id, seconds) { var since = Date.now() / 1000 - seconds; return (dailyHistory[id] || []).filter(function (point) { return Number(point[0]) >= since && Number(point[1]) > 0; }).map(function (point) { return Number(point[1]); }); }

  var SVG_NS = "http://www.w3.org/2000/svg";
  function sparkline(values) {
    if (!values || values.length < 2) { var empty = document.createElement("span"); empty.className = "spark-empty"; empty.textContent = "—"; return empty; }
    var low = Math.min.apply(null, values); var high = Math.max.apply(null, values); var span = high - low || 1;
    var svg = document.createElementNS(SVG_NS, "svg"); svg.setAttribute("viewBox", "0 0 96 28"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "spark " + changeClass(values[values.length - 1] - values[0]));
    var line = document.createElementNS(SVG_NS, "polyline");
    line.setAttribute("points", values.map(function (value, index) { return (index * 96 / (values.length - 1)).toFixed(1) + "," + (26 - (value - low) / span * 24).toFixed(1); }).join(" "));
    svg.appendChild(line); return svg;
  }
  function el(tag, className, content) { var node = document.createElement(tag); if (className) node.className = className; if (content != null) node.textContent = content; return node; }
  function roundIcon(asset) { return createIcon(asset, "round-icon"); }
  // در دسته‌ها و فهرست‌ها رمزارزها جدا حساب می‌شوند؛ تغییر روزانه‌شان مقیاس دیگری دارد.
  function trackedAssets() { return Object.keys(assets).map(function (id) { return assets[id]; }).filter(function (asset) { return asset.group !== "crypto" && Number.isFinite(asset.price) && Number.isFinite(asset.change); }); }

  function renderCategoryCards() {
    var grid = document.getElementById("category-grid"); if (!grid) return; grid.replaceChildren();
    CATEGORY_ORDER.forEach(function (id) {
      var category = CATEGORIES[id]; var panel = document.createElement("div"); panel.className = "category-panel";
      var link = document.createElement("a"); link.className = "category-card"; link.href = categoryUrl(id); link.setAttribute("data-category", id);
      var icon = document.createElement("span"); icon.className = "category-card-icon"; var image = document.createElement("img"); image.src = category.icon; image.alt = ""; icon.appendChild(image);
      var details = document.createElement("span"); details.className = "category-card-details"; var strong = document.createElement("strong"); strong.textContent = category.name; var small = document.createElement("small"); var list = availableAssets(id); var count = list.length; small.textContent = count ? formatNumber(count) + " دارایی" : "در حال دریافت…"; details.append(strong, small);
      var arrow = document.createElement("span"); arrow.className = "category-card-arrow icon-chevron"; arrow.setAttribute("aria-hidden", "true");
      link.append(icon, details, arrow); panel.appendChild(link);
      var top = el("ul", "category-top");
      if (!count) top.appendChild(el("li", "loading", "در حال دریافت قیمت‌ها…"));
      list.slice(0, 3).forEach(function (asset) {
        var item = document.createElement("li"); var row = document.createElement("a"); row.href = assetUrl(asset);
        row.append(el("span", "", asset.name), assetPriceEl("b", "", asset), el("em", changeClass(asset.change), formatChange(asset.change)));
        item.appendChild(row); top.appendChild(item);
      });
      panel.appendChild(top); grid.appendChild(panel);
    });
  }

  var HUB_INDICES = ["usd", "eur", "gold18", "emami"];
  function renderIndices() {
    var box = document.getElementById("hub-indices"); if (!box) return;
    var cards = HUB_INDICES.map(function (id) { return assets[id]; }).filter(function (asset) { return asset && Number.isFinite(asset.price); }).map(function (asset) {
      var card = el("a", "index-card"); card.href = assetUrl(asset);
      var top = el("span", "index-card-top"); top.append(roundIcon(asset), el("strong", "", asset.name), el("span", "change-badge " + changeClass(asset.change), formatChange(asset.change)));
      var bottom = el("span", "index-card-bottom"); var value = el("span"); value.appendChild(el("b", "", formatPrice(asset.price, asset)));
      var month = valuesSince(asset.id, 31 * 86400); var monthChange = month.length > 1 ? percentBetween(asset.price, month[0]) : NaN;
      var meta = el("small", "", priceLabel(asset)); if (Number.isFinite(monthChange)) { meta.appendChild(document.createTextNode(" · ۳۰ روز ")); meta.appendChild(el("span", "ltr-num " + changeClass(monthChange), formatChange(monthChange))); } value.appendChild(meta);
      bottom.append(value, sparkline(month)); card.append(top, bottom); return card;
    });
    box.replaceChildren.apply(box, cards);
  }

  function renderMovers() {
    var box = document.getElementById("hub-movers"); if (!box) return;
    var moving = trackedAssets().filter(function (asset) { return asset.change !== 0; });
    var gainers = moving.filter(function (asset) { return asset.change > 0; }).sort(function (a, b) { return b.change - a.change; }).slice(0, 5);
    var losers = moving.filter(function (asset) { return asset.change < 0; }).sort(function (a, b) { return a.change - b.change; }).slice(0, 5);
    function card(title, mark, tone, list) {
      var wrap = el("div", "card movers-card"); var heading = el("h2"); heading.append(el("span", tone, mark), document.createTextNode(title)); wrap.appendChild(heading);
      var ol = document.createElement("ol");
      list.forEach(function (asset) { var li = document.createElement("li"); var link = document.createElement("a"); link.href = assetUrl(asset); link.append(el("span", "", asset.name), assetPriceEl("small", "", asset), el("em", changeClass(asset.change), formatChange(asset.change))); li.appendChild(link); ol.appendChild(li); });
      wrap.appendChild(ol); return wrap;
    }
    var parts = [];
    if (gainers.length) parts.push(card("بیشترین رشد ۲۴ ساعته", "▲", "positive", gainers));
    if (losers.length) parts.push(card("بیشترین افت ۲۴ ساعته", "▼", "negative", losers));
    if (parts.length) parts[parts.length - 1].appendChild(el("p", "", "رمزارزها در این فهرست نیستند؛ تغییراتشان را در صفحهٔ ارزهای دیجیتال ببینید."));
    box.replaceChildren.apply(box, parts); box.hidden = !parts.length;
  }

  function normalizeQuery(value) { return String(value || "").trim().toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " "); }
  function searchAssets(query) {
    var normalized = normalizeQuery(query); if (!normalized) return [];
    return Object.keys(assets).map(function (id) { return assets[id]; }).filter(function (asset) {
      return Number.isFinite(asset.price) && normalizeQuery([asset.name, asset.englishName, asset.code, asset.id].join(" ")).indexOf(normalized) >= 0;
    }).sort(compareAssets).slice(0, 12);
  }
  function bindHubSearch() {
    var input = document.getElementById("hub-search"); var results = document.getElementById("hub-search-results");
    if (!input || !results || input.dataset.searchBound) return; input.dataset.searchBound = "1";
    function paint() {
      var query = input.value; if (!normalizeQuery(query)) { results.hidden = true; results.replaceChildren(); return; }
      var found = searchAssets(query);
      if (!found.length) { results.replaceChildren(el("li", "empty", "دارایی‌ای با این عبارت پیدا نشد.")); results.hidden = false; return; }
      results.replaceChildren.apply(results, found.map(function (asset) { var li = document.createElement("li"); var link = document.createElement("a"); link.href = assetUrl(asset); link.append(roundIcon(asset), el("span", "", asset.name), assetPriceEl("small", "", asset)); li.appendChild(link); return li; }));
      results.hidden = false;
    }
    input.addEventListener("input", paint);
    input.addEventListener("keydown", function (event) { if (event.key === "Escape") { input.value = ""; paint(); } });
    document.addEventListener("click", function (event) { if (!results.hidden && !event.target.closest(".hub-search")) results.hidden = true; });
    input.addEventListener("focus", function () { if (normalizeQuery(input.value)) paint(); });
    // دکمهٔ جستجوی هدر به /price/#search می‌آید؛ همان‌جا فیلد آماده است.
    function focusFromHash() { if (location.hash === "#search") { input.focus(); if (input.scrollIntoView) input.scrollIntoView({ block: "center" }); } }
    window.addEventListener("hashchange", focusFromHash);
    focusFromHash();
  }

  function renderHub() {
    renderCategoryCards();
    renderIndices();
    renderMovers();
    bindHubSearch();
    loadDaily(HUB_INDICES, 31).then(function (changed) { if (changed) renderIndices(); });
    setDocumentMeta("قیمت لحظه ای دلار، طلا، سکه و ارز دیجیتال امروز " + todayLabel(), "مشاهده قیمت لحظه ای دلار، تتر، طلا، سکه، بیت کوین و ارزهای دیجیتال در بازار ایران و جهان.", "/price/");
    var path = "/price/"; setSchema([{ "@type": "WebPage", "@id": ORIGIN + path + "#page", name: "قیمت لحظه ای دارایی‌ها", url: ORIGIN + path, inLanguage: "fa-IR" }, breadcrumb([{ name: "تبدکس", path: "/" }, { name: "قیمت‌ها", path: path }]), { "@type": "ItemList", name: "دسته‌بندی بازارهای تبدکس", itemListElement: CATEGORY_ORDER.map(function (id, index) { return { "@type": "ListItem", position: index + 1, name: CATEGORIES[id].name, url: ORIGIN + categoryUrl(id) }; }) }]);
  }

  // آخرین تابع ترسیم ردیف‌ها؛ لیسنر جستجو از طریق آن همیشه به لیست
  // تازه دسترسی دارد بدون اینکه دوباره بسته شود.
  var searchPaint = null;
  var categorySort = "rank";

  function bindCategorySort() {
    var group = document.getElementById("market-sort"); if (!group || group.dataset.sortBound) return; group.dataset.sortBound = "1";
    group.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-sort]") : null; if (!button) return;
      categorySort = button.getAttribute("data-sort");
      Array.prototype.forEach.call(group.querySelectorAll("[data-sort]"), function (item) { item.setAttribute("aria-pressed", item === button ? "true" : "false"); });
      var input = document.getElementById("market-search"); if (searchPaint) searchPaint(input ? input.value : "");
    });
  }

  function renderCategoryStats(list) {
    var box = document.getElementById("category-stats"); if (!box) return;
    var changes = list.filter(function (asset) { return Number.isFinite(asset.change); });
    if (!list.length) { box.replaceChildren(); return; }
    function stat(title, value, extra, tone) { var item = el("div", "category-stat"); var strong = el("strong", ((tone || "") + (/^[\s+\-−\u200e۰-۹٬٫٪]+$/.test(value) ? " num" : "")).trim(), value); if (extra) strong.appendChild(extra); item.append(el("small", "", title), strong); return item; }
    var parts = [stat("تعداد دارایی", formatNumber(list.length))];
    if (changes.length) {
      var average = changes.reduce(function (sum, asset) { return sum + asset.change; }, 0) / changes.length;
      parts.push(stat("میانگین تغییر امروز", formatChange(average), null, changeClass(average)));
      var leader = changes.slice().sort(function (a, b) { return b.change - a.change; })[0];
      if (leader && leader.change > 0) { var note = el("em", "positive num", " " + formatChange(leader.change)); parts.push(stat("پیشتاز امروز", leader.name, note)); }
    }
    box.replaceChildren.apply(box, parts);
  }

  function renderOtherMarkets(group) {
    var list = document.getElementById("other-markets"); var section = document.getElementById("category-more"); if (!list || !section) return;
    list.replaceChildren.apply(list, CATEGORY_ORDER.filter(function (id) { return id !== group; }).map(function (id) {
      var category = CATEGORIES[id]; var count = availableAssets(id).length; var li = document.createElement("li"); var link = document.createElement("a"); link.href = categoryUrl(id);
      var icon = el("span", "round-icon"); var image = document.createElement("img"); image.src = category.icon; image.alt = ""; image.loading = "lazy"; icon.appendChild(image);
      link.append(icon, el("strong", "", category.name), el("small", "", count ? formatNumber(count) + " دارایی" : "")); li.appendChild(link); return li;
    }));
    section.hidden = false;
  }

  function categoryFromPath() { var parts = location.pathname.split("/").filter(Boolean); return groupFromSlug(parts[1] || ""); }
  function assetSlugFromPath() { var parts = location.pathname.split("/").filter(Boolean); return parts[2] || ""; }
  function renderCategory() {
    var group = categoryFromPath(); var category = CATEGORIES[group]; if (!category) return renderNotFound("دسته‌بندی پیدا نشد");
    var path = categoryUrl(group); var title = "قیمت لحظه ای " + category.name + " امروز " + todayLabel(); var description = category.description + " امروز " + todayLabel() + ". مشاهده قیمت و تغییرات ۲۴ ساعته."; setDocumentMeta(title, description, path);
    text(document.getElementById("category-crumb"), category.name); text(document.getElementById("category-eyebrow"), "بازار " + category.name); text(document.getElementById("category-title"), "قیمت لحظه ای " + category.name); text(document.getElementById("category-description"), category.description + ". نرخ هر دارایی با واحد اصلی بازار آن نمایش داده می‌شود.");
    var heroIcon = document.getElementById("category-hero-icon"); if (heroIcon) { heroIcon.classList.toggle("is-full-bleed", group === "gold" || group === "commodity" || group === "energy"); heroIcon.replaceChildren(); var img = document.createElement("img"); img.src = category.icon; img.alt = ""; heroIcon.appendChild(img); }
    var list = availableAssets(group); var input = document.getElementById("market-search");
    var withHistory = HISTORY_GROUPS[group] === true;
    var wrap = document.getElementById("market-table-wrap"); if (wrap) wrap.classList.toggle("no-history", !withHistory);
    renderCategoryStats(list);
    renderOtherMarkets(group);
    function convertHref(asset) { return "/convert/" + slugOf(asset.id) + (asset.group === "energy" ? "-to-usd/" : "-to-irt/"); }
    function sorted(items) {
      var copy = items.slice();
      if (categorySort === "gain") copy.sort(function (a, b) { return (Number.isFinite(b.change) ? b.change : -Infinity) - (Number.isFinite(a.change) ? a.change : -Infinity); });
      else if (categorySort === "loss") copy.sort(function (a, b) { return (Number.isFinite(a.change) ? a.change : Infinity) - (Number.isFinite(b.change) ? b.change : Infinity); });
      else if (categorySort === "price") copy.sort(function (a, b) { return (b.tomanPrice || (b.priceCurrency === "IRT" ? b.price : 0)) - (a.tomanPrice || (a.priceCurrency === "IRT" ? a.price : 0)) || b.price - a.price; });
      return copy;
    }
    function historyCells(asset) {
      var week = valuesSince(asset.id, 7 * 86400); var month = valuesSince(asset.id, 31 * 86400);
      // بدون هیچ دادهٔ تاریخی، یک متن به‌جای سه خانهٔ خالی.
      if (week.length < 2 && month.length < 2) return [el("span", "market-row-nohistory history-col", "بدون دادهٔ تاریخی")];
      var range = el("span", "market-row-range history-col");
      if (week.length > 1) {
        var low = Math.min.apply(null, week.concat([asset.price])); var high = Math.max.apply(null, week.concat([asset.price]));
        var labels = el("span"); labels.append(el("span", "", formatPrice(low, asset)), el("span", "", formatPrice(high, asset)));
        var bar = el("span", "range-bar"); var dot = document.createElement("i"); dot.style.insetInlineStart = (high > low ? (asset.price - low) / (high - low) * 100 : 50).toFixed(1) + "%"; bar.appendChild(dot);
        range.setAttribute("aria-label", "کمترین " + formatPrice(low, asset) + " و بیشترین " + formatPrice(high, asset) + " در هفت روز");
        range.append(labels, bar);
      } else range.appendChild(el("span", "spark-empty", "—"));
      var monthChange = month.length > 1 ? percentBetween(asset.price, month[0]) : NaN;
      var monthCell = el("span", "market-row-month history-col " + changeClass(monthChange), formatChange(monthChange));
      var trend = el("span", "history-col"); trend.appendChild(sparkline(month));
      return [range, monthCell, trend];
    }
    // ورودی جستجو بین رندرها باقی می‌ماند، پس لیسنر باید یک‌بار بسته
    // شود وگرنه هر تازه‌سازی یکی روی قبلی‌ها سوار می‌کرد.
    function paintRows(query) { var rows = document.getElementById("market-rows"); rows.replaceChildren(); var normalized = normalizeQuery(query); var filtered = sorted(list).filter(function (asset) { return !normalized || normalizeQuery([asset.name, asset.englishName, asset.code, asset.id].join(" ")).indexOf(normalized) >= 0; }); if (!filtered.length) { var empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = list.length ? "دارایی‌ای با این عبارت پیدا نشد." : "دریافت قیمت‌ها موقتاً ممکن نیست."; rows.appendChild(empty); return; } filtered.forEach(function (asset, index) { var row = document.createElement("div"); row.className = "market-row"; var rankCell = el("span", "market-row-rank", formatNumber(index + 1)); var identity = document.createElement("a"); identity.className = "market-row-identity"; identity.href = assetUrl(asset); identity.appendChild(createIcon(asset, "market-row-icon")); var label = document.createElement("span"); label.className = "market-row-label"; var strong = document.createElement("strong"); strong.textContent = asset.name; var small = document.createElement("small"); small.textContent = asset.code || ""; label.append(strong, small); identity.appendChild(label); var price = document.createElement("span"); price.className = "market-row-price"; if (Number.isFinite(asset.price)) price.append(el("span", "num", formatPrice(asset.price, asset)), document.createTextNode(" " + priceLabel(asset))); else price.textContent = formatPrice(asset.price, asset); var change = document.createElement("span"); change.className = "market-row-change change-badge " + changeClass(asset.change); change.textContent = formatChange(asset.change); var action = el("a", "market-row-action", "تبدیل"); action.href = convertHref(asset); action.setAttribute("aria-label", "تبدیل " + asset.name); row.append(rankCell, identity, price, change); if (withHistory) historyCells(asset).forEach(function (cell) { row.appendChild(cell); }); row.appendChild(action); rows.appendChild(row); }); }
    searchPaint = paintRows;
    if (input && !input.dataset.searchBound) {
      input.dataset.searchBound = "1";
      input.addEventListener("input", function () { if (searchPaint) searchPaint(input.value); });
    }
    bindCategorySort();
    // عبارتی که کاربر تایپ کرده نباید با تازه‌سازی پاک شود.
    paintRows(input ? input.value : "");
    if (withHistory && list.length) loadDaily(list.map(function (asset) { return asset.id; }), 31).then(function (changed) { if (changed && searchPaint === paintRows) paintRows(input ? input.value : ""); });
    setSchema([{ "@type": "CollectionPage", "@id": ORIGIN + path + "#page", name: "قیمت لحظه ای " + category.name, description: description, url: ORIGIN + path, inLanguage: "fa-IR" }, breadcrumb([{ name: "تبدکس", path: "/" }, { name: "قیمت‌ها", path: "/price/" }, { name: category.name, path: path }]), { "@type": "ItemList", name: "فهرست قیمت " + category.name, numberOfItems: list.length, itemListElement: list.map(function (asset, index) { return { "@type": "ListItem", position: index + 1, name: asset.name, url: ORIGIN + assetUrl(asset) }; }) }]);
  }

  function descriptionFor(asset) { var units = priceLabel(asset) + (Number.isFinite(asset.tomanPrice) ? " و تومان" : ""); return "قیمت لحظه ای " + asset.name + " امروز " + todayLabel() + " به " + units + "، میزان تغییر قیمت و اطلاعات بازار " + asset.name + "."; }
  function assetSubtitle(asset) {
    if (asset.id === "silver") return "هر گرم";
    if (asset.id === "copper") return "هر کیلوگرم در بورس کالا";
    if (asset.id === "gold18" || asset.id === "gold24") return "هر گرم";
    if (asset.id === "goldmelted") return "هر مثقال";
    if (asset.group === "fiat") return asset.code || "";
    if (asset.group === "crypto") return asset.englishName + (asset.code ? " · " + asset.code : "");
    return "";
  }
  function renderAsset() {
    var group = categoryFromPath(); var id = idFromSlug(assetSlugFromPath()); var category = CATEGORIES[group]; var asset = assets[id]; if (!category || (asset && asset.group !== group)) return renderNotFound("این مسیر قیمت معتبر نیست");
    if (!asset || !Number.isFinite(asset.price)) return renderUnavailable();
    setMeta("name", "robots", "index, follow, max-image-preview:large");
    var path = assetUrl(asset); var title = "قیمت لحظه ای " + asset.name + " امروز " + todayLabel(); var description = descriptionFor(asset); setDocumentMeta(title, description, path);
    var categoryLink = document.getElementById("asset-category-link"); if (categoryLink) { categoryLink.href = categoryUrl(group); categoryLink.textContent = category.name; }
    text(document.getElementById("asset-crumb"), asset.name); text(document.getElementById("asset-title"), "قیمت " + asset.name); var english = document.getElementById("asset-english"); if (english) { var subtitle = assetSubtitle(asset); english.hidden = !subtitle; text(english, subtitle); }
    var icon = document.getElementById("asset-main-icon"); if (icon) { icon.classList.toggle("is-full-bleed", asset.group === "gold" || asset.group === "commodity" || asset.group === "energy"); icon.replaceChildren(); icon.appendChild(createIcon(asset, "asset-main-icon-inner")); }
    text(document.getElementById("asset-price"), formatPrice(asset.price, asset)); text(document.getElementById("asset-unit"), priceLabel(asset)); var secondary = document.getElementById("asset-secondary"); if (secondary) { var hasToman = Number.isFinite(asset.tomanPrice) && asset.group !== "energy"; secondary.hidden = !hasToman; text(document.getElementById("asset-secondary-price"), hasToman ? formatPrice(asset.tomanPrice) : "—"); var secondaryChange = document.getElementById("asset-secondary-change"); if (secondaryChange) { secondaryChange.className = "price-change secondary-change " + (hasToman ? changeClass(asset.tomanChange) : "neutral"); text(secondaryChange.querySelector("strong"), hasToman ? formatChange(asset.tomanChange) : "—"); } } var changeBox = document.getElementById("asset-change"); if (changeBox) { changeBox.className = "price-change " + changeClass(asset.change); var strong = changeBox.querySelector("strong"); text(strong, formatChange(asset.change)); }
    var freshness = document.getElementById("asset-freshness"); if (freshness) { var dot = document.createElement("i"); dot.setAttribute("aria-hidden", "true"); if (marketClosed(asset)) freshness.replaceChildren(dot, document.createTextNode(" آخرین نرخ بازار "), closedHint()); else freshness.replaceChildren(dot, document.createTextNode(" آخرین به‌روزرسانی " + formatTime(asset.updatedAt || latestUpdate))); }
    text(document.getElementById("asset-content-title"), "قیمت " + asset.name + " امروز"); var movement = asset.change > 0 ? "افزایش" : asset.change < 0 ? "کاهش" : "بدون تغییر"; var tomanSentence = Number.isFinite(asset.tomanPrice) && asset.group !== "energy" ? " نرخ آن در بازار تومانی " + formatPrice(asset.tomanPrice) + " تومان است." : ""; text(document.getElementById("asset-content-lead"), "قیمت هر " + unitText(asset) + " " + asset.name + " اکنون " + formattedPrice(asset) + " است." + tomanSentence + " این قیمت در ۲۴ ساعت گذشته " + formatAbsoluteChange(asset.change) + " " + movement + " داشته است.");
    text(document.getElementById("asset-about-title"), "درباره " + asset.name); text(document.getElementById("asset-about-text"), asset.name + (asset.code ? " با نماد " + asset.code : "") + " در دسته " + category.name + " قرار دارد. این صفحه آخرین قیمت قابل دریافت از " + (asset.source || "بازار") + " را نمایش می‌دهد و برای پیگیری ارزش روز این دارایی به‌روزرسانی می‌شود.");
    text(document.getElementById("asset-usage-text"), "با مقایسه قیمت لحظه ای و درصد تغییر ۲۴ ساعته می‌توانید جهت حرکت کوتاه‌مدت قیمت " + asset.name + " را بهتر ببینید. این داده صرفاً برای محاسبه و اطلاع‌رسانی است و پیشنهاد خرید یا فروش محسوب نمی‌شود.");
    // دکمهٔ بالای صفحه به مبدل همین دارایی به تومان می‌رود: «مبدل قیمت دلار».
    var heroConvert = document.getElementById("asset-hero-convert"); if (heroConvert) { heroConvert.setAttribute("href", "/convert/" + slugOf(asset.id) + "-to-irt/"); var heroArrow = document.createElement("span"); heroArrow.className = "icon-chevron"; heroArrow.setAttribute("aria-hidden", "true"); heroConvert.replaceChildren(document.createTextNode("مبدل قیمت " + asset.name + " "), heroArrow); }
    renderQuickConvert(asset);
    renderRelated(asset);
    renderAbsoluteChange(asset);
    var sourceBox = document.getElementById("data-source-note"); if (sourceBox) { text(document.getElementById("data-source-text"), "قیمت " + asset.name + " از " + (asset.source || "بازار") + " دریافت می‌شود."); sourceBox.hidden = false; }
    var measured = [{ "@type": "PropertyValue", name: "قیمت به " + priceLabel(asset), value: asset.price, unitText: priceLabel(asset) }, { "@type": "PropertyValue", name: "تغییر ۲۴ ساعته", value: Number.isFinite(asset.change) ? asset.change : null, unitText: "درصد" }]; if (Number.isFinite(asset.tomanPrice)) measured.push({ "@type": "PropertyValue", name: "قیمت تومانی", value: asset.tomanPrice, unitText: "تومان" }); var dataset = { "@type": "Dataset", name: "قیمت لحظه ای " + asset.name, description: description, url: ORIGIN + path, dateModified: (asset.updatedAt || latestUpdate || new Date()).toISOString(), variableMeasured: measured };
    setSchema([{ "@type": "WebPage", "@id": ORIGIN + path + "#page", name: title.replace(" | تبدکس", ""), description: description, url: ORIGIN + path, inLanguage: "fa-IR", about: { "@type": "Thing", name: asset.name, alternateName: asset.code || asset.englishName }, mainEntity: { "@id": ORIGIN + path + "#dataset" } }, breadcrumb([{ name: "تبدکس", path: "/" }, { name: "قیمت‌ها", path: "/price/" }, { name: category.name, path: categoryUrl(group) }, { name: asset.name, path: path }]), Object.assign({ "@id": ORIGIN + path + "#dataset" }, dataset)]);
  }

  /* تبدیل سریع کنار صفحهٔ دارایی: مقدار × قیمت هر واحد با همان واحد
     اصلی صفحه. مبدل کامل برای جفت‌های دیگر همچنان یک کلیک فاصله دارد. */
  var quickAsset = null;
  function parseQuickAmount(value) {
    var normalized = String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); }).replace(/[\s,٬،]/g, "").replace(/٫/g, ".");
    var amount = Number(normalized); return normalized && Number.isFinite(amount) && amount >= 0 ? amount : NaN;
  }
  /* مثل مبدل: هر رقمی (فارسی، عربی یا انگلیسی) هنگام تایپ فارسی و سه‌رقم
     سه‌رقم با «٬» جدا می‌شود و جای مکان‌نما بعد از قالب‌بندی حفظ می‌شود. */
  function quickToEnglish(value) { return String(value).replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); }).replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); }); }
  function quickTokens(value) {
    var seenDecimal = false; var tokens = 0;
    quickToEnglish(value).replace(/٫/g, ".").split("").forEach(function (c) { if (/\d/.test(c)) tokens += 1; else if (c === "." && !seenDecimal) { seenDecimal = true; tokens += 1; } });
    return tokens;
  }
  function formatQuickAmount(value) {
    var integer = ""; var fraction = ""; var seenDecimal = false;
    quickToEnglish(value).replace(/[\s,٬،]/g, "").replace(/٫/g, ".").split("").forEach(function (c) {
      if (/\d/.test(c)) { if (seenDecimal) fraction += c; else integer += c; } else if (c === "." && !seenDecimal) seenDecimal = true;
    });
    if (!integer && seenDecimal) integer = "0";
    integer = integer.replace(/^0+(?=\d)/, "");
    var grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "٬") + (seenDecimal ? "٫" + fraction : "");
    return grouped.replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[Number(d)]; });
  }
  function formatQuickInput(input) {
    var raw = input.value; var caret = input.selectionStart == null ? raw.length : input.selectionStart;
    var before = quickTokens(raw.slice(0, caret)); var formatted = formatQuickAmount(raw);
    if (formatted === raw) return;
    input.value = formatted;
    var seen = 0; var position = 0;
    while (position < formatted.length && seen < before) { if (/[۰-۹٫]/.test(formatted[position])) seen += 1; position += 1; }
    try { input.setSelectionRange(position, position); } catch (error) { /* نوع ورودی پشتیبانی نمی‌کند */ }
  }
  function paintQuickConvert() {
    var asset = quickAsset; var input = document.getElementById("asset-quick-input"); var output = document.getElementById("asset-quick-output");
    if (!asset || !input || !output) return;
    var amount = parseQuickAmount(input.value); output.replaceChildren();
    if (!Number.isFinite(amount)) { output.textContent = "مقدار معتبر وارد کنید"; return; }
    output.append(el("span", "num", formatPrice(amount * asset.price, asset)), document.createTextNode(" "), el("small", "", priceLabel(asset)));
  }
  function renderQuickConvert(asset) {
    var section = document.getElementById("asset-quick"); var input = document.getElementById("asset-quick-input"); if (!section || !input) return;
    quickAsset = asset;
    var unit = asset.unit && UNIT_LABELS[asset.unit] ? UNIT_LABELS[asset.unit] : (asset.code || asset.name);
    text(document.getElementById("asset-quick-unit"), unit);
    text(document.getElementById("asset-quick-label"), "مقدار " + asset.name);
    if (!input.dataset.quickBound) { input.dataset.quickBound = "1"; input.addEventListener("input", function () { formatQuickInput(input); paintQuickConvert(); }); formatQuickInput(input); }
    var table = document.getElementById("asset-quick-table");
    if (table) table.replaceChildren.apply(table, [1, 5, 10, 100].map(function (amount) { var row = document.createElement("tr"); row.append(priceEl("td", "", formatNumber(amount), unit), priceEl("td", "", formatPrice(amount * asset.price, asset), priceLabel(asset))); return row; }));
    paintQuickConvert(); section.hidden = false;
  }
  /* کنار درصد، مقدار مطلق تغییر هم با واحد اصلی می‌آید: «+۱٬۱۶۰».
     از قیمت فعلی و درصد ۲۴ ساعته بازسازی می‌شود. */
  function renderAbsoluteChange(asset) {
    var box = document.getElementById("asset-change"); if (!box) return;
    var node = box.querySelector(".price-change-abs");
    if (!node) { node = el("small", "price-change-abs"); box.appendChild(node); }
    var delta = Number.isFinite(asset.change) && asset.change > -100 ? asset.price - asset.price / (1 + asset.change / 100) : NaN;
    node.textContent = Number.isFinite(delta) && delta !== 0 ? "(" + (delta > 0 ? "+" : "−") + formatPrice(Math.abs(delta), asset) + ")" : "";
  }
  function renderRelated(asset) {
    var section = document.getElementById("asset-related"); var list = document.getElementById("asset-related-list"); if (!section || !list) return;
    var related = availableAssets(asset.group).filter(function (item) { return item.id !== asset.id; }).slice(0, 5);
    text(document.getElementById("asset-related-title"), "دیگر دارایی‌های " + (CATEGORIES[asset.group] ? CATEGORIES[asset.group].name : "این بازار"));
    list.replaceChildren.apply(list, related.map(function (item) {
      var li = document.createElement("li"); var link = document.createElement("a"); link.href = assetUrl(item);
      var value = el("span", "related-meta"); value.append(assetPriceEl("b", "", item), el("em", changeClass(item.change), formatChange(item.change)));
      link.append(roundIcon(item), el("strong", "", item.name), value); li.appendChild(link); return li;
    }));
    section.hidden = !related.length;
  }

  function renderUnavailable() {
    var freshness = document.getElementById("asset-freshness");
    text(freshness, "دریافت نرخ تازه موقتاً ممکن نیست؛ نرخ ذخیره‌شده، اگر موجود باشد، نرخ لحظه‌ای نیست.");
  }

  function renderNotFound(message) {
    document.title = "صفحه قیمت پیدا نشد"; setMeta("name", "robots", "noindex, follow"); var main = document.getElementById("price-main"); if (!main) return;
    // با تازه‌سازی دوره‌ای این تابع می‌تواند چند بار صدا زده شود؛ بدون
    // این، هر بار یک کادر خطای دیگر زیر قبلی‌ها اضافه می‌شد.
    var box = main.querySelector(".empty-state[data-not-found]");
    if (!box) { box = document.createElement("div"); box.className = "empty-state"; box.setAttribute("data-not-found", ""); main.appendChild(box); }
    box.textContent = message;
  }
  function start() {
    var mode = document.body.getAttribute("data-price-page"); if (mode === "hub") { renderCategoryCards(); bindHubSearch(); }
    function render() { if (mode === "hub") renderHub(); else if (mode === "category") renderCategory(); else if (mode === "asset") renderAsset(); }
    loadAll().then(render);

    /* ── تازه‌سازی دوره‌ای ─────────────────────────────────────────
       صفحهٔ قیمت دقیقاً همان‌جایی است که کاربر انتظار عدد لحظه‌ای
       دارد، ولی تا پیش از این فقط یک‌بار موقع لود داده می‌گرفت.
       تبِ پنهان و صفحهٔ رهاشده درخواستی نمی‌سازند. */
      /* محیط تست مرورگر کامل نیست؛ بدون این بررسی، بارگذاریِ فایل
       همان‌جا می‌شکست. */
    if (typeof window.setTimeout === "function" && typeof window.clearTimeout === "function"
      && typeof window.addEventListener === "function" && typeof document.addEventListener === "function") {
      /* فاصلهٔ ثابت با انقضای کش سرور هم‌فاز نبود، پس می‌شد یک لحظه
         پیش از تازه شدن کش درخواست داد و تا یک دور بعد نرخِ همان موقع
         کهنه‌شده را نشان داد. سرور حالا سن و عمر کشش را می‌گوید و
         درخواست بعدی درست بعد از انقضای آن می‌نشیند. */
      var REFRESH_MAX = 60000;
      var MIN_GAP = 5000;
      var IDLE_TIMEOUT = 15 * 60000;
      var lastRefresh = Date.now();
      var lastActivity = Date.now();
      var refreshTimer = null;

      function markActivity() { lastActivity = Date.now(); }
      ["pointerdown", "keydown", "focus"].forEach(function (name) {
        window.addEventListener(name, markActivity, true);
      });

      function nextDelay() {
        if (!proxyCache.fetchedUnix || !proxyCache.ttl) return REFRESH_MAX;
        var age = Date.now() / 1000 - proxyCache.fetchedUnix;
        // دو ثانیه تحمل تا درخواست زودتر از انقضا نرسد و کش قبلی را بگیرد.
        return Math.min(REFRESH_MAX, Math.max(MIN_GAP, (proxyCache.ttl - age + 2) * 1000));
      }

      function maybeRefresh() {
        if (document.visibilityState !== "visible") return;
        if (Date.now() - lastActivity > IDLE_TIMEOUT) return;
        if (Date.now() - lastRefresh < MIN_GAP) return;
        lastRefresh = Date.now();
        loadAll().then(render);
      }

      function scheduleRefresh() {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(function () { maybeRefresh(); scheduleRefresh(); }, nextDelay());
      }

      scheduleRefresh();
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible") return;
        markActivity();
        maybeRefresh();
        scheduleRefresh();
      });
    }
  }
  start();
}());
