(function () {
  "use strict";

  var ORIGIN = "https://tabdex.ir";
  var CATEGORIES = {
    crypto: { name: "ارزهای دیجیتال", singular: "ارز دیجیتال", description: "قیمت لحظه ای ارزهای دیجیتال در بازار تتری و تومانی ایران", icon: "/assets/crypto-icons/btc.svg" },
    gold: { name: "طلا", singular: "طلا", description: "قیمت طلای ۱۸ و ۲۴ عیار، طلای آب‌شده و انس جهانی", icon: "/assets/gold-18k.svg" },
    coin: { name: "سکه", singular: "سکه", description: "قیمت لحظه ای انواع سکه در بازار ایران", icon: "/assets/coin-emami.webp?v=20260825-2" },
    commodity: { name: "فلزات", singular: "فلز", description: "قیمت لحظه ای نقره و مس بر پایه داده‌های بورس کالا", icon: "/assets/silver.svg" },
    fiat: { name: "ارز", singular: "ارز", description: "قیمت لحظه ای دلار، یورو و دیگر ارزهای رایج به تومان", icon: "/assets/flags/us.svg" }
  };
  var CATEGORY_ORDER = ["crypto", "gold", "coin", "commodity", "fiat"];
  var SLUGS = { goldmelted: "melted", goldounce: "ounce", bahar: "baharazadi", halfcoin: "nim", quartercoin: "rob", gramcoin: "gerami" };
  var SLUG_TO_ID = {};
  Object.keys(SLUGS).forEach(function (id) { SLUG_TO_ID[SLUGS[id]] = id; });
  var UNIT_LABELS = { gram: "گرم", piece: "عدد", mesghal: "مثقال", ounce: "انس", kilogram: "کیلو" };
  var RANKED = ["btc", "usdt", "eth", "usdc", "xrp", "bnb", "sol", "doge", "trx", "ada", "gold18", "gold24", "goldmelted", "goldounce", "emami", "bahar", "halfcoin", "quartercoin", "gramcoin", "silver", "copper", "usd", "eur", "gbp", "aed", "try", "chf", "cad", "aud", "irt"];
  var RANK = {};
  var USD_STABLECOINS = { usdt: true, usdc: true, dai: true, busd: true, usde: true, tusd: true, fdusd: true, usdd: true, pyusd: true, gusd: true, susd: true, frax: true };
  RANKED.forEach(function (id, index) { RANK[id] = index; });

  var FIXED = [
    { id: "irt", name: "تومان", englishName: "Toman", code: "IRT", group: "fiat", unit: null, icon: "/assets/flags/ir.svg", price: 1, change: 0, source: "واحد پایه تبدکس" },
    { id: "gold18", name: "طلای ۱۸ عیار", englishName: "18K Gold", group: "gold", unit: "gram", icon: "/assets/gold-18k.svg" },
    { id: "gold24", name: "طلای ۲۴ عیار", englishName: "24K Gold", group: "gold", unit: "gram", icon: "/assets/gold-18k.svg" },
    { id: "goldmelted", name: "طلای آب‌شده", englishName: "Melted Gold", group: "gold", unit: "mesghal", icon: "/assets/gold-18k.svg" },
    { id: "goldounce", name: "انس طلا", englishName: "Gold Ounce", group: "gold", unit: "ounce", icon: "/assets/gold-18k.svg" },
    { id: "emami", name: "سکه امامی", englishName: "Emami Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "bahar", name: "سکه بهار آزادی", englishName: "Bahar Azadi Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "halfcoin", name: "نیم سکه", englishName: "Half Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "quartercoin", name: "ربع سکه", englishName: "Quarter Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "gramcoin", name: "سکه یک گرمی", englishName: "One Gram Coin", group: "coin", unit: "piece", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { id: "silver", name: "نقره ۹۹۹", englishName: "Silver 999", code: "بورس کالا", group: "commodity", unit: "gram", icon: "/assets/silver.svg" },
    { id: "copper", name: "مس", englishName: "Copper Cathode", code: "بورس کالا", group: "commodity", unit: "kilogram", icon: "/assets/copper.svg" },
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

  function slugOf(id) { return SLUGS[id] || id; }
  function idFromSlug(slug) { return SLUG_TO_ID[slug] || slug; }
  function assetUrl(asset) { return "/price/" + asset.group + "/" + slugOf(asset.id) + "/"; }
  function categoryUrl(group) { return "/price/" + group + "/"; }
  function normalizeId(id) { id = String(id || "").toLowerCase(); return id === "rls" ? "irt" : id; }
  function rank(asset) { return RANK[asset.id] == null ? RANKED.length : RANK[asset.id]; }
  function compareAssets(a, b) { return rank(a) - rank(b) || a.name.localeCompare(b.name, "fa"); }
  function formatNumber(value, digits) { return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits == null ? 0 : digits }).format(value); }
  function formatPrice(value) { return Number.isFinite(value) ? formatNumber(value, value < 1 ? 6 : 0) : "ناموجود"; }
  function priceLabel(asset) { return asset.priceCurrency === "USDT" ? "تتر" : asset.priceCurrency === "USD" ? "دلار" : "تومان"; }
  function formattedPrice(asset) { return formatPrice(asset.price) + " " + priceLabel(asset); }
  function formatChange(value) { if (!Number.isFinite(value)) return "—"; var sign = value > 0 ? "+" : ""; return sign + formatNumber(value, 2) + "٪"; }
  function formatAbsoluteChange(value) { return Number.isFinite(value) ? formatNumber(Math.abs(value), 2) + "٪" : "—"; }
  function changeClass(value) { return value > 0 ? "positive" : value < 0 ? "negative" : "neutral"; }
  function formatTime(date) { return date ? new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date) : "—"; }
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
        var nameRow = names[id] || {}; assets[id] = {
          id: id, name: nameRow.fa || id.toUpperCase(), englishName: nameRow.en || id.toUpperCase(), code: id.toUpperCase(), group: "crypto", unit: null,
          icon: iconPath(id), price: useUsdt ? usdtPrice : tomanPrice, priceCurrency: useUsdt ? "USDT" : "IRT", tomanPrice: useUsdt ? tomanPrice : null,
          change: Number((useUsdt ? usdtRow : tomanRow).dayChange), source: useUsdt ? "بازار تتری نوبیتکس" : "بازار تومانی نوبیتکس", updatedAt: new Date()
        };
      });
      latestUpdate = new Date();
    });
  }
  function loadProxy() {
    return loadJson("/api/rates.php?t=" + Date.now(), 9000).then(function (payload) {
      var rows = payload && payload.assets || {}; var at = payload.updated ? new Date(payload.updated) : new Date(); if (!Number.isFinite(at.getTime())) at = new Date();
      Object.keys(rows).forEach(function (id) { if (!assets[id]) return; var row = rows[id]; var usd = Number(row.usd); var dollarPrimary = id === "goldounce" && Number.isFinite(usd) && usd > 0; assets[id].price = dollarPrimary ? usd : Number(row.toman); assets[id].priceCurrency = dollarPrimary ? "USD" : "IRT"; assets[id].tomanPrice = dollarPrimary ? Number(row.toman) : null; assets[id].change = Number(row.change); assets[id].source = dollarPrimary ? "بازار جهانی طلا" : id === "silver" || id === "copper" ? "بورس کالا" : "بازار ایران"; assets[id].updatedAt = at; });
      if (!latestUpdate || at > latestUpdate) latestUpdate = at;
    });
  }
  function loadAll() { return Promise.allSettled([loadNobitex(), loadProxy()]); }
  function availableAssets(group) { return Object.keys(assets).map(function (id) { return assets[id]; }).filter(function (asset) { return asset.group === group && Number.isFinite(asset.price); }).sort(compareAssets); }

  function renderCategoryCards() {
    var grid = document.getElementById("category-grid"); if (!grid) return; grid.replaceChildren();
    CATEGORY_ORDER.forEach(function (id) {
      var category = CATEGORIES[id]; var link = document.createElement("a"); link.className = "category-card"; link.href = categoryUrl(id); link.setAttribute("data-category", id);
      var icon = document.createElement("span"); icon.className = "category-card-icon"; var image = document.createElement("img"); image.src = category.icon; image.alt = ""; icon.appendChild(image);
      var details = document.createElement("span"); details.className = "category-card-details"; var strong = document.createElement("strong"); strong.textContent = category.name; var small = document.createElement("small"); var count = availableAssets(id).length; small.textContent = count ? formatNumber(count) + " دارایی" : "در حال دریافت…"; details.append(strong, small);
      var arrow = document.createElement("span"); arrow.className = "category-card-arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.textContent = "←";
      link.append(icon, details, arrow); grid.appendChild(link);
    });
  }
  function renderHub() {
    renderCategoryCards();
    var path = "/price/"; setSchema([{ "@type": "WebPage", "@id": ORIGIN + path + "#page", name: "قیمت لحظه ای دارایی‌ها", url: ORIGIN + path, inLanguage: "fa-IR" }, breadcrumb([{ name: "تبدکس", path: "/" }, { name: "قیمت‌ها", path: path }]), { "@type": "ItemList", name: "دسته‌بندی بازارهای تبدکس", itemListElement: CATEGORY_ORDER.map(function (id, index) { return { "@type": "ListItem", position: index + 1, name: CATEGORIES[id].name, url: ORIGIN + categoryUrl(id) }; }) }]);
  }

  function categoryFromPath() { var parts = location.pathname.split("/").filter(Boolean); return parts[1] || ""; }
  function assetSlugFromPath() { var parts = location.pathname.split("/").filter(Boolean); return parts[2] || ""; }
  function renderCategory() {
    var group = categoryFromPath(); var category = CATEGORIES[group]; if (!category) return renderNotFound("دسته‌بندی پیدا نشد");
    var path = categoryUrl(group); var title = "قیمت لحظه ای " + category.name + " | تبدکس"; var description = category.description + ". مشاهده قیمت و تغییرات ۲۴ ساعته در تبدکس."; setDocumentMeta(title, description, path);
    text(document.getElementById("category-crumb"), category.name); text(document.getElementById("category-eyebrow"), "بازار " + category.name); text(document.getElementById("category-title"), "قیمت لحظه ای " + category.name); text(document.getElementById("category-description"), category.description + ". نرخ هر دارایی با واحد اصلی بازار آن نمایش داده می‌شود.");
    var heroIcon = document.getElementById("category-hero-icon"); if (heroIcon) { heroIcon.replaceChildren(); var img = document.createElement("img"); img.src = category.icon; img.alt = ""; heroIcon.appendChild(img); }
    var list = availableAssets(group); var input = document.getElementById("market-search");
    function paintRows(query) { var rows = document.getElementById("market-rows"); rows.replaceChildren(); var normalized = String(query || "").trim().toLowerCase(); var filtered = list.filter(function (asset) { return !normalized || [asset.name, asset.englishName, asset.code, asset.id].join(" ").toLowerCase().indexOf(normalized) >= 0; }); if (!filtered.length) { var empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "دارایی‌ای با این عبارت پیدا نشد."; rows.appendChild(empty); return; } filtered.forEach(function (asset) { var link = document.createElement("a"); link.className = "market-row"; link.href = assetUrl(asset); var identity = document.createElement("span"); identity.className = "market-row-identity"; identity.appendChild(createIcon(asset, "market-row-icon")); var label = document.createElement("span"); label.className = "market-row-label"; var strong = document.createElement("strong"); strong.textContent = asset.name; var small = document.createElement("small"); small.textContent = asset.code || ""; label.append(strong, small); identity.appendChild(label); var price = document.createElement("span"); price.className = "market-row-price"; price.textContent = formattedPrice(asset); var change = document.createElement("span"); change.className = "market-row-change " + changeClass(asset.change); change.textContent = formatChange(asset.change); link.append(identity, price, change); rows.appendChild(link); }); }
    paintRows(""); if (input) input.addEventListener("input", function () { paintRows(input.value); });
    setSchema([{ "@type": "CollectionPage", "@id": ORIGIN + path + "#page", name: "قیمت لحظه ای " + category.name, description: description, url: ORIGIN + path, inLanguage: "fa-IR" }, breadcrumb([{ name: "تبدکس", path: "/" }, { name: "قیمت‌ها", path: "/price/" }, { name: category.name, path: path }]), { "@type": "ItemList", name: "فهرست قیمت " + category.name, numberOfItems: list.length, itemListElement: list.map(function (asset, index) { return { "@type": "ListItem", position: index + 1, name: asset.name, url: ORIGIN + assetUrl(asset) }; }) }]);
  }

  function descriptionFor(asset) { var units = priceLabel(asset) + (Number.isFinite(asset.tomanPrice) ? " و معادل تومان" : ""); return "قیمت لحظه ای " + asset.name + " امروز به " + units + "، درصد تغییرات ۲۴ ساعته و اطلاعات بازار " + asset.name + " در تبدکس."; }
  function renderAsset() {
    var group = categoryFromPath(); var id = idFromSlug(assetSlugFromPath()); var category = CATEGORIES[group]; var asset = assets[id]; if (!category || !asset || asset.group !== group || !Number.isFinite(asset.price)) return renderNotFound("قیمت این دارایی در دسترس نیست");
    var path = assetUrl(asset); var title = "قیمت لحظه ای " + asset.name + " امروز | تبدکس"; var description = descriptionFor(asset); setDocumentMeta(title, description, path);
    var categoryLink = document.getElementById("asset-category-link"); if (categoryLink) { categoryLink.href = categoryUrl(group); categoryLink.textContent = category.name; }
    text(document.getElementById("asset-crumb"), asset.name); text(document.getElementById("asset-title"), "قیمت " + asset.name); var english = document.getElementById("asset-english"); if (english) { english.hidden = asset.group !== "crypto"; text(english, asset.group === "crypto" ? asset.englishName + (asset.code ? " · " + asset.code : "") : ""); }
    var icon = document.getElementById("asset-main-icon"); if (icon) { icon.replaceChildren(); icon.appendChild(createIcon(asset, "asset-main-icon-inner")); }
    text(document.getElementById("asset-price"), formatPrice(asset.price)); text(document.getElementById("asset-unit"), priceLabel(asset)); var secondary = document.getElementById("asset-secondary"); if (secondary) { secondary.hidden = !Number.isFinite(asset.tomanPrice); text(document.getElementById("asset-secondary-price"), Number.isFinite(asset.tomanPrice) ? formatPrice(asset.tomanPrice) + " تومان" : "—"); } var changeBox = document.getElementById("asset-change"); if (changeBox) { changeBox.className = "price-change " + changeClass(asset.change); var strong = changeBox.querySelector("strong"); text(strong, formatChange(asset.change)); }
    var freshness = document.getElementById("asset-freshness"); if (freshness) { var dot = document.createElement("i"); dot.setAttribute("aria-hidden", "true"); freshness.replaceChildren(dot, document.createTextNode(" آخرین به‌روزرسانی " + formatTime(asset.updatedAt || latestUpdate))); }
    text(document.getElementById("asset-content-title"), "قیمت " + asset.name + " امروز"); var movement = asset.change > 0 ? "افزایش" : asset.change < 0 ? "کاهش" : "بدون تغییر"; var tomanSentence = Number.isFinite(asset.tomanPrice) ? " معادل تومانی آن " + formatPrice(asset.tomanPrice) + " تومان است." : ""; text(document.getElementById("asset-content-lead"), "قیمت هر " + unitText(asset) + " " + asset.name + " اکنون " + formattedPrice(asset) + " است." + tomanSentence + " این قیمت در ۲۴ ساعت گذشته " + formatAbsoluteChange(asset.change) + " " + movement + " داشته است.");
    text(document.getElementById("asset-about-title"), "درباره " + asset.name); text(document.getElementById("asset-about-text"), asset.name + (asset.code ? " با نماد " + asset.code : "") + " در دسته " + category.name + " قرار دارد. این صفحه آخرین قیمت قابل دریافت از " + (asset.source || "بازار") + " را نمایش می‌دهد و برای پیگیری ارزش روز این دارایی به‌روزرسانی می‌شود.");
    text(document.getElementById("asset-usage-text"), "با مقایسه قیمت لحظه ای و درصد تغییر ۲۴ ساعته می‌توانید جهت حرکت کوتاه‌مدت قیمت " + asset.name + " را بهتر ببینید. این داده صرفاً برای محاسبه و اطلاع‌رسانی است و پیشنهاد خرید یا فروش محسوب نمی‌شود.");
    var converter = document.getElementById("asset-converter-link"); if (converter) { converter.href = "/" + slugOf(asset.id) + "-to-irt/"; converter.firstChild.nodeValue = "تبدیل " + asset.name + " به تومان در مبدل "; }
    var measured = [{ "@type": "PropertyValue", name: "قیمت به " + priceLabel(asset), value: asset.price, unitText: priceLabel(asset) }, { "@type": "PropertyValue", name: "تغییر ۲۴ ساعته", value: Number.isFinite(asset.change) ? asset.change : null, unitText: "درصد" }]; if (Number.isFinite(asset.tomanPrice)) measured.push({ "@type": "PropertyValue", name: "معادل تومانی", value: asset.tomanPrice, unitText: "تومان" }); var dataset = { "@type": "Dataset", name: "قیمت لحظه ای " + asset.name, description: description, url: ORIGIN + path, dateModified: (asset.updatedAt || latestUpdate || new Date()).toISOString(), variableMeasured: measured };
    setSchema([{ "@type": "WebPage", "@id": ORIGIN + path + "#page", name: title.replace(" | تبدکس", ""), description: description, url: ORIGIN + path, inLanguage: "fa-IR", about: { "@type": "Thing", name: asset.name, alternateName: asset.code || asset.englishName }, mainEntity: { "@id": ORIGIN + path + "#dataset" } }, breadcrumb([{ name: "تبدکس", path: "/" }, { name: "قیمت‌ها", path: "/price/" }, { name: category.name, path: categoryUrl(group) }, { name: asset.name, path: path }]), Object.assign({ "@id": ORIGIN + path + "#dataset" }, dataset)]);
  }

  function renderNotFound(message) {
    document.title = "صفحه قیمت پیدا نشد | تبدکس"; setMeta("name", "robots", "noindex, follow"); var main = document.getElementById("price-main"); if (main) { var box = document.createElement("div"); box.className = "empty-state"; box.textContent = message; main.appendChild(box); }
  }
  function start() {
    var mode = document.body.getAttribute("data-price-page"); if (mode === "hub") renderCategoryCards();
    loadAll().then(function () { if (mode === "hub") renderHub(); else if (mode === "category") renderCategory(); else if (mode === "asset") renderAsset(); });
  }
  start();
}());
