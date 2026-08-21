(function () {
  "use strict";

  var DIGIT_MAP = {};
  "۰۱۲۳۴۵۶۷۸۹".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });
  "٠١٢٣٤٥٦٧٨٩".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });

  var PERSIAN_NAMES = {
    irt: "تومان", usdt: "تتر", btc: "بیت‌کوین", eth: "اتریوم", ltc: "لایت‌کوین",
    xrp: "ریپل", bch: "بیت‌کوین کش", bnb: "بایننس کوین", doge: "دوج‌کوین",
    xlm: "استلار", trx: "ترون", ada: "کاردانو", xmr: "مونرو", etc: "اتریوم کلاسیک",
    link: "چین‌لینک", dai: "دای", dot: "پولکادات", uni: "یونی‌سواپ", aave: "آوه",
    sol: "سولانا", fil: "فایل‌کوین", grt: "گراف", atom: "کازماس", avax: "آوالانچ",
    near: "نیر", mana: "دیسنترالند", sand: "سندباکس", usdc: "یو‌اس‌دی کوین",
    algo: "الگورند", ton: "تون‌کوین", shib: "شیبا اینو", pepe: "پپه", paxg: "پکس گلد"
  };

  // دستهٔ هر دارایی تعیین می‌کند به چه چیزهایی تبدیل می‌شود. تومان
  // عمداً در دستهٔ «فیات» است، نه دستهٔ جدا.
  var currencies = {
    irt: { id: "irt", code: "IRT", name: "تومان", englishName: "Toman", decimals: 0, group: "fiat", unit: null, localIcon: "/assets/flags/ir.svg" },
    usdt: { id: "usdt", code: "USDT", name: "تتر", englishName: "Tether", decimals: 4, group: "crypto", unit: null, localIcon: "/assets/usdt-logo.svg" }
  };

  /* دارایی‌هایی که از پراکسی می‌آیند نه از نوبیتکس. اینجا فقط
     ظاهرشان تعریف می‌شود؛ نرخشان را loadProxyRates می‌آورد و تا وقتی
     نرخ نیامده باشد در فهرست ظاهر نمی‌شوند.
     افزودن دارایی جدید = یک ردیف اینجا و یک ردیف در ASSET_MAP
     فایل api/rates.php. */
  var GOLD_ICON = "/assets/gold-18k.svg";
  var COIN_ICON = "/assets/coin-emami.png";

  [
    // طلا و سکه — نماد ندارند، چون «۱۸K» یا «EMAMI» چیزی به کاربر
    // فارسی‌زبان نمی‌گوید. به‌جایش نام و واحد نمایش داده می‌شود.
    { id: "gold18",      name: "طلای ۱۸ عیار",     englishName: "18K Gold",        decimals: 4, group: "gold", unit: "gram",    localIcon: GOLD_ICON },
    { id: "gold24",      name: "طلای ۲۴ عیار",     englishName: "24K Gold",        decimals: 4, group: "gold", unit: "gram",    localIcon: GOLD_ICON },
    { id: "goldmelted",  name: "طلای آب‌شده",       englishName: "Melted Gold",     decimals: 4, group: "gold", unit: "mesghal", localIcon: GOLD_ICON },
    { id: "goldounce",   name: "انس طلا",           englishName: "Gold Ounce",      decimals: 4, group: "gold", unit: "ounce",   localIcon: GOLD_ICON },

    { id: "emami",       name: "سکه امامی",         englishName: "Emami Coin",      decimals: 4, group: "coin", unit: "piece",   localIcon: COIN_ICON },
    { id: "bahar",       name: "سکه بهار آزادی",    englishName: "Bahar Azadi Coin", decimals: 4, group: "coin", unit: "piece",  localIcon: COIN_ICON },
    { id: "halfcoin",    name: "نیم سکه",           englishName: "Half Coin",       decimals: 4, group: "coin", unit: "piece",   localIcon: COIN_ICON },
    { id: "quartercoin", name: "ربع سکه",           englishName: "Quarter Coin",    decimals: 4, group: "coin", unit: "piece",   localIcon: COIN_ICON },
    { id: "gramcoin",    name: "سکه یک گرمی",       englishName: "One Gram Coin",   decimals: 4, group: "coin", unit: "piece",   localIcon: COIN_ICON },

    // ارز فیات — این‌ها نماد دارند و نمادشان معنادار است.
    { id: "usd", code: "USD", name: "دلار",              englishName: "US Dollar",        decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/us.svg" },
    { id: "eur", code: "EUR", name: "یورو",              englishName: "Euro",             decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/eu.svg" },
    { id: "gbp", code: "GBP", name: "پوند",              englishName: "British Pound",    decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/gb.svg" },
    { id: "chf", code: "CHF", name: "فرانک سوئیس",       englishName: "Swiss Franc",      decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/ch.svg" },
    { id: "aed", code: "AED", name: "درهم امارات",       englishName: "UAE Dirham",       decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/ae.svg" },
    { id: "try", code: "TRY", name: "لیر ترکیه",         englishName: "Turkish Lira",     decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/tr.svg" },
    { id: "jpy", code: "JPY", name: "یکصد ین ژاپن",      englishName: "100 Japanese Yen", decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/jp.svg" },
    { id: "cny", code: "CNY", name: "یوآن چین",          englishName: "Chinese Yuan",     decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/cn.svg" },
    { id: "aud", code: "AUD", name: "دلار استرالیا",     englishName: "Australian Dollar", decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/au.svg" },
    { id: "cad", code: "CAD", name: "دلار کانادا",       englishName: "Canadian Dollar",  decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/ca.svg" },
    { id: "rub", code: "RUB", name: "روبل روسیه",        englishName: "Russian Ruble",    decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/ru.svg" },
    { id: "sek", code: "SEK", name: "کرون سوئد",         englishName: "Swedish Krona",    decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/se.svg" },
    { id: "inr", code: "INR", name: "روپیه هند",         englishName: "Indian Rupee",     decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/in.svg" },
    { id: "pkr", code: "PKR", name: "روپیه پاکستان",     englishName: "Pakistani Rupee",  decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/pk.svg" },
    { id: "afn", code: "AFN", name: "افغانی",            englishName: "Afghan Afghani",   decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/af.svg" },
    { id: "myr", code: "MYR", name: "رینگیت مالزی",      englishName: "Malaysian Ringgit", decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/my.svg" },
    { id: "thb", code: "THB", name: "بات تایلند",        englishName: "Thai Baht",        decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/th.svg" },
    { id: "sar", code: "SAR", name: "ریال عربستان",      englishName: "Saudi Riyal",      decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/sa.svg" },
    { id: "qar", code: "QAR", name: "ریال قطر",          englishName: "Qatari Riyal",     decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/qa.svg" },
    { id: "kwd", code: "KWD", name: "دینار کویت",        englishName: "Kuwaiti Dinar",    decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/kw.svg" },
    { id: "bhd", code: "BHD", name: "دینار بحرین",       englishName: "Bahraini Dinar",   decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/bh.svg" },
    { id: "omr", code: "OMR", name: "ریال عمان",         englishName: "Omani Rial",       decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/om.svg" },
    { id: "iqd", code: "IQD", name: "دینار عراق",        englishName: "Iraqi Dinar",      decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/iq.svg" },
    { id: "syp", code: "SYP", name: "لیر سوریه",         englishName: "Syrian Pound",     decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/sy.svg" },
    { id: "azn", code: "AZN", name: "منات آذربایجان",    englishName: "Azerbaijani Manat", decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/az.svg" },
    { id: "amd", code: "AMD", name: "درام ارمنستان",     englishName: "Armenian Dram",    decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/am.svg" },
    { id: "gel", code: "GEL", name: "لاری گرجستان",      englishName: "Georgian Lari",    decimals: 2, group: "fiat", unit: null, localIcon: "/assets/flags/ge.svg" }
  ].forEach(function (asset) { currencies[asset.id] = asset; });

  // برچسب واحد: طلا به گرم است و سکه به عدد. بدون این، عددی که کاربر
  // وارد می‌کند مبهم است.
  var UNIT_LABELS = { gram: "گرم", piece: "عدد", mesghal: "مثقال", ounce: "انس" };

  /* ── اسلاگ آدرس ──────────────────────────────────────────────
     هر جفت تبدیل آدرس خودش را دارد: gold18-to-irt و برعکسش
     irt-to-gold18. برای بیشتر دارایی‌ها اسلاگ همان شناسه است؛ فقط
     این چند مورد اسلاگ خواناتری دارند. */
  var SLUG_OVERRIDES = {
    goldmelted: "melted",
    goldounce: "ounce",
    bahar: "baharazadi",
    halfcoin: "nim",
    quartercoin: "rob",
    gramcoin: "gerami"
  };

  var SLUG_TO_ID = {};
  Object.keys(SLUG_OVERRIDES).forEach(function (id) { SLUG_TO_ID[SLUG_OVERRIDES[id]] = id; });

  function slugOf(id) { return SLUG_OVERRIDES[id] || id; }

  function idFromSlug(slug) {
    slug = String(slug || "").toLowerCase();
    return SLUG_TO_ID[slug] || slug;
  }

  // صفحهٔ اصلی همین جفت پیش‌فرض را نشان می‌دهد، پس عمداً آدرس جداگانه
  // نمی‌گیرد؛ وگرنه دو آدرس با محتوای یکسان می‌داشتیم.
  var DEFAULT_FROM = "usdt";
  var DEFAULT_TO = "irt";

  function unitLabel(currency) {
    return currency && currency.unit ? (UNIT_LABELS[currency.unit] || null) : null;
  }

  var state = {
    from: "usdt", to: "irt", amount: 100, edited: "from", rate: null,
    graph: {}, updatedAt: null, live: false, loading: false, dialogSide: null, lastFocused: null,
    filterGroup: "all", proxyAssets: null, pendingRoute: null,
    // دو منبع مستقل داریم. وضعیت هرکدام جدا نگه داشته می‌شود چون نوار
    // وضعیت باید زمانِ همان منبعی را نشان بدهد که جفت فعلی از آن آمده.
    sources: {
      nobitex: { live: false, at: null },
      proxy:   { live: false, at: null }
    }
  };

  var elements = {
    amountFrom: document.getElementById("amount-from"), amountTo: document.getElementById("amount-to"),
    currencyFrom: document.getElementById("currency-from"), currencyTo: document.getElementById("currency-to"),
    pageTitle: document.getElementById("page-title"), rateValue: document.getElementById("rate-value"),
    rateStatus: document.getElementById("rate-status"), swap: document.getElementById("swap"),
    refresh: document.getElementById("refresh"), dialog: document.getElementById("asset-dialog"),
    dialogTitle: document.getElementById("asset-dialog-title"), dialogClose: document.getElementById("dialog-close"),
    assetSearch: document.getElementById("asset-search"), assetList: document.getElementById("asset-list"),
    assetEmpty: document.getElementById("asset-empty"), assetFilters: document.getElementById("asset-filters")
  };

  var writing = false;

  function toEnglishDigits(value) {
    return String(value).replace(/[۰-۹٠-٩]/g, function (digit) { return DIGIT_MAP[digit]; });
  }

  function toPersianDigits(value) {
    return String(value).replace(/\d/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
  }

  function parseAmount(value) {
    var normalized = toEnglishDigits(value).replace(/[\s,٬،]/g, "").replace(/٫/g, ".");
    if (!normalized || normalized === ".") return NaN;
    var number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : NaN;
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) return "";
    var maximumFractionDigits = decimals;
    if (value > 0 && value < 1) maximumFractionDigits = Math.max(decimals, 8);
    if (value > 0 && value < 0.00000001) maximumFractionDigits = 12;
    return new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: Math.min(maximumFractionDigits, 12), minimumFractionDigits: 0
    }).format(value).replace(/−/g, "-");
  }

  function formatTime(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function decimalsFromPrecision(value) {
    var text = String(value || "");
    if (/e-/i.test(text)) return Math.min(Number(text.split(/e-/i)[1]) || 8, 12);
    var dot = text.indexOf(".");
    if (dot === -1) return 0;
    return Math.min(text.slice(dot + 1).replace(/0+$/, "").length, 12);
  }

  function normalizeId(id) {
    id = String(id || "").toLowerCase();
    return id === "rls" ? "irt" : id;
  }

  function displayName(id, englishName) {
    return PERSIAN_NAMES[id] || englishName || id.toUpperCase();
  }

  function getOptionIconUrls(option, id) {
    var values = [
      option.icon, option.iconUrl, option.icon_url, option.iconPath,
      option.logo, option.logoUrl, option.logo_url,
      option.image, option.imageUrl, option.image_url
    ];
    var urls = values.map(function (value) {
      if (typeof value !== "string") return null;
      if (value.indexOf("//") === 0) return "https:" + value;
      if (value.indexOf("/") === 0) return "https://nobitex.ir" + value;
      return value;
    }).filter(function (value) {
      return value && /^https:\/\/([a-z0-9-]+\.)*nobitex\.ir\//i.test(value);
    });
    if (id !== "irt") urls.push("https://cdn.nobitex.ir/crypto/" + encodeURIComponent(id) + ".svg");
    return urls;
  }

  function upsertCurrency(id, option) {
    id = normalizeId(id);
    if (!id || id === "global") return null;
    option = option || {};
    var current = currencies[id] || {};
    var englishName = option.name || current.englishName || id.toUpperCase();
    currencies[id] = {
      id: id, code: id === "irt" ? "IRT" : id.toUpperCase(), name: displayName(id, englishName),
      englishName: englishName,
      decimals: id === "irt" ? 0 : (option.displayPrecision ? decimalsFromPrecision(option.displayPrecision) : (current.decimals == null ? 8 : current.decimals)),
      // این تابع کل رکورد را بازمی‌سازد، پس دسته و واحد باید صریحاً حفظ
      // شوند وگرنه با هر به‌روزرسانی نرخ از بین می‌روند. هر دارایی‌ای که
      // از نوبیتکس بیاید و دستهٔ از پیش تعیین‌شده نداشته باشد، ارز دیجیتال است.
      group: option.group || current.group || (id === "irt" ? "fiat" : "crypto"),
      unit: option.unit || current.unit || null,
      localIcon: current.localIcon || null, iconUrls: getOptionIconUrls(option, id),
      aliases: current.aliases || []
    };
    return currencies[id];
  }

  /* ── سیاست تبدیل ─────────────────────────────────────────────
     هر دارایی به هر دارایی دیگری تبدیل می‌شود. محدودیت دسته‌ای که
     قبلاً طلا و سکه را فقط به تومان وصل می‌کرد برداشته شد.

     دسته‌ها همچنان وجود دارند، ولی نقششان عوض شده: حالا فقط برای
     تگ‌های فیلتر در فهرست و برای تشخیص منبعِ نرخ در نوار وضعیت
     به کار می‌روند، نه برای محدود کردن تبدیل. ─────────────────── */

  function groupOf(id) {
    var currency = currencies[id];
    return (currency && currency.group) || "crypto";
  }

  function isPairAllowed(from, to) {
    return Boolean(from && to && from !== to);
  }

  function setEdge(from, to, rate) {
    if (!Number.isFinite(rate) || rate <= 0 || from === to) return;
    if (!state.graph[from]) state.graph[from] = {};
    if (!state.graph[to]) state.graph[to] = {};
    state.graph[from][to] = rate;
    state.graph[to][from] = 1 / rate;
  }

  function buildMarketGraph(payload) {
    var stats = payload && payload.stats;
    if (!stats || typeof stats !== "object") throw new Error("invalid market payload");
    state.graph = {};
    Object.keys(stats).forEach(function (key) {
      if (key === "global") return;
      var separator = key.lastIndexOf("-");
      if (separator < 1) return;
      var rawFrom = key.slice(0, separator).toLowerCase();
      var rawTo = key.slice(separator + 1).toLowerCase();
      var from = normalizeId(rawFrom);
      var to = normalizeId(rawTo);
      var market = stats[key];
      var rate = Number(market && market.latest);
      if (!Number.isFinite(rate) || rate <= 0) return;
      if (rawTo === "rls") rate /= 10;
      if (rawFrom === "rls") rate *= 10;
      upsertCurrency(from);
      upsertCurrency(to);
      setEdge(from, to, rate);
    });
    if (!Object.keys(state.graph).length) throw new Error("empty market graph");
  }

  function applyOptions(payload) {
    var coins = payload && payload.coins;
    if (!Array.isArray(coins)) return;
    coins.forEach(function (coin) {
      var id = normalizeId(coin && coin.coin);
      if (currencies[id]) upsertCurrency(id, coin);
    });
  }

  function applyCurrencyNames(payload) {
    var names = payload && payload.currencies;
    if (!names || typeof names !== "object") return;
    Object.keys(names).forEach(function (rawId) {
      var id = normalizeId(rawId);
      var currency = currencies[id];
      var item = names[rawId];
      if (!currency || !item) return;
      currency.name = item.fa || currency.name;
      currency.englishName = item.en || currency.englishName || currency.code;
      currency.aliases = item.alt ? [item.alt] : [];
    });
  }

  function directRate(from, to) {
    return state.graph[from] && state.graph[from][to];
  }

  function findRate(from, to) {
    if (from === to) return 1;
    if (!isPairAllowed(from, to)) return null;
    var direct = directRate(from, to);
    if (direct) return direct;
    if (from === "irt" || to === "irt") return null;
    var viaIrtA = directRate(from, "irt");
    var viaIrtB = directRate("irt", to);
    if (viaIrtA && viaIrtB) return viaIrtA * viaIrtB;
    var viaUsdtA = directRate(from, "usdt");
    var viaUsdtB = directRate("usdt", to);
    if (viaUsdtA && viaUsdtB) return viaUsdtA * viaUsdtB;
    return null;
  }

  function updateRate() { state.rate = findRate(state.from, state.to); }

  // آیا نرخ این دارایی از پراکسی می‌آید؟ تومان از هیچ‌کدام نمی‌آید و
  // همیشه در دسترس است.
  function isProxyAsset(id) {
    var group = groupOf(id);
    return group === "gold" || group === "coin" || (group === "fiat" && id !== "irt");
  }

  /* نوار وضعیت باید دربارهٔ همین جفت راست بگوید، نه دربارهٔ کل سایت.
     تبدیل دلار به بیت‌کوین از هر دو منبع عبور می‌کند، پس قدیمی‌ترین
     زمان و بدبینانه‌ترین حالتِ «زنده بودن» نمایش داده می‌شود. */
  function refreshPairStatus() {
    var needed = [];
    if (groupOf(state.from) === "crypto" || groupOf(state.to) === "crypto") needed.push("nobitex");
    if (isProxyAsset(state.from) || isProxyAsset(state.to)) needed.push("proxy");
    if (!needed.length) needed.push("nobitex");

    var live = true;
    var oldest = null;
    needed.forEach(function (key) {
      var source = state.sources[key];
      if (!source.live) live = false;
      if (source.at && (!oldest || source.at < oldest)) oldest = source.at;
    });
    state.live = live;
    state.updatedAt = oldest;
  }

  function convertEditedAmount() {
    if (!Number.isFinite(state.rate) || state.rate <= 0 || !Number.isFinite(state.amount)) return null;
    return state.edited === "from" ? state.amount * state.rate : state.amount / state.rate;
  }

  function setInput(input, value) {
    writing = true; input.value = value; writing = false;
  }

  // وقتی هیچ تصویری بار نشود، این دو حرف داخل دایره نشان داده می‌شود.
  // طلا و سکه نماد ندارند، پس برایشان از نام فارسی استفاده می‌شود.
  function fallbackGlyph(currency) {
    var source = currency.code || currency.name || currency.id || "";
    return String(source).slice(0, 2);
  }

  function createCurrencyIcon(currency, className) {
    var wrap = document.createElement("span");
    wrap.className = "currency-icon" + (className ? " " + className : "");
    wrap.setAttribute("aria-hidden", "true");
    if (currency.localIcon || (currency.iconUrls && currency.iconUrls.length)) {
      var image = document.createElement("img");
      var sources = (currency.localIcon ? [currency.localIcon] : []).concat(currency.iconUrls || []);
      var index = 0;
      image.alt = "";
      image.src = sources[index];
      image.addEventListener("error", function () {
        index += 1;
        if (sources[index]) image.src = sources[index];
        else {
          image.remove(); wrap.classList.add("letter-icon"); wrap.textContent = fallbackGlyph(currency);
        }
      });
      wrap.appendChild(image);
    } else {
      wrap.classList.add("letter-icon"); wrap.textContent = fallbackGlyph(currency);
    }
    return wrap;
  }

  function paintCurrency(container, currency) {
    container.setAttribute("aria-label", "انتخاب " + currency.name);
    container.replaceChildren();
    container.appendChild(createCurrencyIcon(currency));
    var label = document.createElement("span");
    label.className = "currency-text";
    // طلا و سکه نماد ندارند: خط پررنگ خودِ نام فارسی است و خط کم‌رنگ
    // واحد. برای بقیه همان نماد بالا و نام پایین می‌ماند.
    var unit = unitLabel(currency);
    var code = document.createElement("strong");
    var name = document.createElement("small");
    if (unit) {
      code.textContent = currency.name;
      name.textContent = "هر " + unit;
    } else {
      code.textContent = currency.code;
      name.textContent = currency.name;
    }
    label.append(code, name); container.appendChild(label);
    var chevron = document.createElement("span");
    chevron.className = "currency-chevron"; chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML = '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>';
    container.appendChild(chevron);
  }

  function paintConversion() {
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    if (!fromCurrency || !toCurrency) return;
    var heading = "تبدیل " + fromCurrency.name + " به " + toCurrency.name;
    elements.pageTitle.textContent = heading;
    paintDocumentMeta(heading, fromCurrency, toCurrency);
    paintCurrency(elements.currencyFrom, fromCurrency);
    paintCurrency(elements.currencyTo, toCurrency);
    var result = convertEditedAmount();
    if (state.edited === "from") setInput(elements.amountTo, result === null ? "" : formatNumber(result, toCurrency.decimals));
    else setInput(elements.amountFrom, result === null ? "" : formatNumber(result, fromCurrency.decimals));
  }

  /* عنوان و متای صفحه با جفت فعلی هم‌راستا می‌شوند. صفحه‌های ایستایی
     که هنگام دیپلوی ساخته می‌شوند همین مقادیر را از ابتدا در HTML
     دارند؛ این تابع برای بقیهٔ آدرس‌هاست که از بازنویسی می‌آیند و
     برای وقتی که کاربر بدون بارگذاری دوباره جفت را عوض می‌کند. */
  function paintDocumentMeta(heading, fromCurrency, toCurrency) {
    if (typeof document === "undefined") return;

    var unit = unitLabel(fromCurrency);
    var subject = (unit ? "هر " + unit + " " : "") + fromCurrency.name;
    document.title = heading + " | تبدکس";

    var description = "محاسبهٔ لحظه‌ای " + heading + ". قیمت " + subject +
      " بر حسب " + toCurrency.name + " با نرخ روز بازار ایران.";
    setMeta("name", "description", description);
    setMeta("property", "og:title", document.title);
    setMeta("property", "og:description", description);

    var canonical = document.querySelector ? document.querySelector('link[rel="canonical"]') : null;
    if (canonical && canonical.setAttribute) {
      canonical.setAttribute("href", "https://tabdex.ir" + pathForPair(state.from, state.to));
    }
    setMeta("property", "og:url", "https://tabdex.ir" + pathForPair(state.from, state.to));
  }

  function setMeta(attribute, key, value) {
    if (!document.querySelector) return;
    var tag = document.querySelector("meta[" + attribute + '="' + key + '"]');
    if (tag && tag.setAttribute) tag.setAttribute("content", value);
  }

  function paintRate() {
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    if (!Number.isFinite(state.rate) || state.rate <= 0) {
      elements.rateValue.textContent = state.loading ? "در حال دریافت…" : "نرخ این تبدیل در دسترس نیست";
      elements.rateStatus.classList.toggle("error", !state.loading);
      // دیگر فقط نوبیتکس نیست، پس متن عمومی شد.
      elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
        (state.loading ? "در حال دریافت نرخ‌ها" : "نرخ این تبدیل در دسترس نیست");
      return;
    }
    // «۱ گرم طلای ۱۸ عیار» به‌جای «۱ طلای ۱۸ عیار»
    var fromUnit = unitLabel(fromCurrency);
    elements.rateValue.textContent = "۱ " + (fromUnit ? fromUnit + " " : "") + fromCurrency.name +
      " = " + formatNumber(state.rate, toCurrency.decimals) + " " + toCurrency.name;
    elements.rateStatus.classList.toggle("error", !state.live);
    elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
      (state.live ? "آخرین به‌روزرسانی " + formatTime(state.updatedAt) : "نمایش آخرین نرخ ذخیره‌شده");
  }

  function paint() { updateRate(); refreshPairStatus(); paintConversion(); paintRate(); }

  function editableTokens(value) {
    var normalized = toEnglishDigits(value).replace(/٫/g, ".");
    var seenDecimal = false; var tokens = 0;
    normalized.split("").forEach(function (character) {
      if (/\d/.test(character)) tokens += 1;
      else if (character === "." && !seenDecimal) { seenDecimal = true; tokens += 1; }
    });
    return tokens;
  }

  function formatEditableAmount(value) {
    var normalized = toEnglishDigits(value).replace(/[\s,٬،]/g, "").replace(/٫/g, ".");
    var integer = ""; var fraction = ""; var seenDecimal = false;
    normalized.split("").forEach(function (character) {
      if (/\d/.test(character)) {
        if (seenDecimal) fraction += character;
        else integer += character;
      } else if (character === "." && !seenDecimal) {
        seenDecimal = true;
      }
    });
    if (!integer && seenDecimal) integer = "0";
    integer = integer.replace(/^0+(?=\d)/, "");
    var grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
    return toPersianDigits(grouped + (seenDecimal ? "٫" + fraction : ""));
  }

  function formatInputWhileTyping(input) {
    var raw = input.value;
    var caret = input.selectionStart == null ? raw.length : input.selectionStart;
    var tokensBeforeCaret = editableTokens(raw.slice(0, caret));
    var formatted = formatEditableAmount(raw);
    setInput(input, formatted);
    var seen = 0; var position = 0;
    while (position < formatted.length && seen < tokensBeforeCaret) {
      if (/[۰-۹٫]/.test(formatted[position])) seen += 1;
      position += 1;
    }
    try { input.setSelectionRange(position, position); } catch (error) { /* unsupported input type */ }
    return parseAmount(formatted);
  }

  function onInput(side, input) {
    input.addEventListener("input", function () {
      if (writing) return;
      var amount = formatInputWhileTyping(input);
      state.edited = side; state.amount = amount;
      paintConversion();
    });
  }

  function clearLegacyHash() {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  /* ── مسیریابی ────────────────────────────────────────────────
     آدرس‌ها به شکل /btc-to-irt/ هستند و روی سرور همه به index.html
     بازنویسی می‌شوند (rules در .htaccess). پارامتر amount هم پشتیبانی
     می‌شود: /btc-to-irt/?amount=300

     عمداً فقط هنگام بارگذاری خوانده می‌شود. تغییر مقدار توسط کاربر
     نباید آدرس را عوض کند؛ فقط تغییر جفت دارایی آدرس را عوض می‌کند. */

  function parseRoute(pathname) {
    var match = String(pathname || "").match(/\/([a-z0-9]+)-to-([a-z0-9]+)\/?$/i);
    if (!match) return null;
    var from = idFromSlug(match[1]);
    var to = idFromSlug(match[2]);
    if (from === to) return null;
    return { from: from, to: to };
  }

  function parseAmountParam(search) {
    var match = String(search || "").match(/[?&]amount=([^&]+)/);
    if (!match) return null;
    var value = parseAmount(decodeURIComponent(match[1]));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function pathForPair(from, to) {
    if (from === DEFAULT_FROM && to === DEFAULT_TO) return "/";
    return "/" + slugOf(from) + "-to-" + slugOf(to) + "/";
  }

  // بعد از هر تغییر جفت صدا زده می‌شود. pushState تا دکمهٔ بازگشت
  // مرورگر کاربر را به جفت قبلی برگرداند.
  function syncRoute() {
    var target = pathForPair(state.from, state.to);
    if (location.pathname === target) return;
    try {
      history.pushState({ from: state.from, to: state.to }, "", target);
    } catch (error) {
      /* اگر مرورگر اجازه نداد، آدرس دست‌نخورده می‌ماند و برنامه کار می‌کند */
    }
  }

  function applyRoute(route) {
    if (!route || !currencies[route.from] || !currencies[route.to]) return false;
    state.from = route.from;
    state.to = route.to;
    return true;
  }

  /* رمزارزها هنگام بوت هنوز وجود ندارند؛ فقط بعد از پاسخ نوبیتکس
     ساخته می‌شوند. پس اگر آدرس ورودی به دارایی‌ای اشاره کند که هنوز
     نیامده، کنار گذاشته می‌شود و به‌محض رسیدن داده اعمال می‌گردد.
     بدون این، ورود مستقیم به /btc-to-irt/ به جفت پیش‌فرض می‌افتاد. */
  function resolvePendingRoute() {
    if (!state.pendingRoute) return false;
    if (!applyRoute(state.pendingRoute)) return false;
    state.pendingRoute = null;
    return true;
  }

  function swapCurrencies() {
    var visibleResult = parseAmount(elements.amountTo.value);
    var previousFrom = state.from;
    state.from = state.to; state.to = previousFrom; state.edited = "from";
    state.amount = Number.isFinite(visibleResult) ? visibleResult : 0;
    setInput(elements.amountFrom, formatNumber(state.amount, currencies[state.from].decimals));
    elements.swap.classList.toggle("turned"); syncRoute(); paint();
    if (elements.dialog.hidden) { elements.amountFrom.focus(); elements.amountFrom.select(); }
  }

  // counterpartId دارایی طرف مقابل است. اگر داده شود، فهرست فقط
  // گزینه‌هایی را نشان می‌دهد که با آن جفت مجاز می‌سازند؛ این‌طور کاربر
  // هیچ‌وقت به بن‌بست «نرخ در دسترس نیست» نمی‌خورد.
  function availableCurrencies(counterpartId) {
    return Object.keys(currencies).filter(function (id) {
      var hasRate = id === "irt" || (state.graph[id] && Object.keys(state.graph[id]).length);
      if (!hasRate) return false;
      if (!counterpartId) return true;
      return id === counterpartId || isPairAllowed(id, counterpartId);
    }).map(function (id) { return currencies[id]; }).sort(function (a, b) {
      var priority = { irt: 0, usdt: 1, btc: 2, eth: 3 };
      var aPriority = priority[a.id] == null ? 99 : priority[a.id];
      var bPriority = priority[b.id] == null ? 99 : priority[b.id];
      // طلا و سکه نماد ندارند، پس با نام فارسی مرتب می‌شوند.
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.code && b.code) return a.code.localeCompare(b.code, "en");
      if (a.code) return 1;
      if (b.code) return -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "fa");
    });
  }

  function normalizedSearch(value) {
    return toEnglishDigits(value).trim().toLowerCase().replace(/[_‌\s-]+/g, " ");
  }

  function renderAssetList() {
    var query = normalizedSearch(elements.assetSearch.value);
    var counterpart = state.dialogSide ? state[state.dialogSide === "from" ? "to" : "from"] : null;
    var allowedGroups = FILTER_GROUPS[state.filterGroup] || null;
    var assets = availableCurrencies(counterpart).filter(function (currency) {
      // تگ دسته و متن جستجو با هم AND می‌شوند.
      if (allowedGroups && allowedGroups.indexOf(currency.group || "crypto") === -1) return false;
      var haystack = normalizedSearch([currency.code, currency.name, currency.englishName].concat(currency.aliases || []).join(" "));
      return !query || haystack.indexOf(query) !== -1;
    });
    elements.assetList.replaceChildren();
    elements.assetEmpty.hidden = assets.length > 0;
    assets.forEach(function (currency) {
      var option = document.createElement("button");
      option.className = "asset-option"; option.type = "button"; option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(currency.id === state[state.dialogSide]));
      option.dataset.currency = currency.id;
      option.appendChild(createCurrencyIcon(currency, "asset-option-icon"));
      var label = document.createElement("span"); label.className = "asset-option-label";
      var name = document.createElement("strong"); name.textContent = currency.name;
      var english = document.createElement("small");
      // برای طلا و سکه، واحد مفیدتر از نام انگلیسی است.
      var unit = unitLabel(currency);
      english.textContent = unit ? "هر " + unit : (currency.englishName || currency.code);
      label.append(name, english);
      // طلا و سکه نماد ندارند، پس ستون سمت چپ برایشان ساخته نمی‌شود.
      if (currency.code) {
        var code = document.createElement("b"); code.className = "asset-option-code"; code.textContent = currency.code;
        option.append(label, code);
      } else {
        option.append(label);
      }
      option.addEventListener("click", function () { selectCurrency(currency.id); });
      elements.assetList.appendChild(option);
    });
  }

  /* تگ‌های دسته زیر فیلد جستجو. «طلا و سکه» عمداً یک تگ است چون
     کاربر آن‌ها را یک خانواده می‌بیند، هرچند داخل کد دو دستهٔ جدا
     هستند. تومان هم عمداً زیر «ارز» می‌آید. */
  var FILTER_GROUPS = {
    all: null,
    crypto: ["crypto"],
    metal: ["gold", "coin"],
    fiat: ["fiat"]
  };

  function paintFilters() {
    if (!elements.assetFilters || !elements.assetFilters.children) return;
    Array.prototype.forEach.call(elements.assetFilters.children, function (button) {
      var active = (button.dataset && button.dataset.group) === state.filterGroup;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setFilterGroup(group) {
    if (!Object.prototype.hasOwnProperty.call(FILTER_GROUPS, group)) return;
    state.filterGroup = group;
    paintFilters();
    renderAssetList();
  }

  function openDialog(side) {
    state.dialogSide = side; state.lastFocused = document.activeElement;
    elements.dialogTitle.textContent = side === "from" ? "انتخاب دارایی مبدأ" : "انتخاب دارایی مقصد";
    elements.assetSearch.value = ""; elements.dialog.hidden = false;
    state.filterGroup = "all"; paintFilters();
    document.body.classList.add("dialog-open"); renderAssetList();
    window.setTimeout(function () { elements.assetSearch.focus(); }, 0);
  }

  function closeDialog() {
    if (elements.dialog.hidden) return;
    elements.dialog.hidden = true; document.body.classList.remove("dialog-open"); state.dialogSide = null;
    if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus();
  }

  function selectCurrency(id) {
    var side = state.dialogSide;
    if (!side || !currencies[id]) return;
    var otherSide = side === "from" ? "to" : "from";
    if (state[otherSide] === id) {
      var previous = state[side]; state[side] = id; state[otherSide] = previous;
    } else state[side] = id;
    // جابه‌جایی بالا می‌تواند جفت نامعتبر بسازد (مثلاً طلا در برابر
    // بیت‌کوین). در آن صورت طرف مقابل به تومان برمی‌گردد که با هر
    // دارایی‌ای جفت مجاز می‌سازد.
    if (!isPairAllowed(state.from, state.to)) {
      state[otherSide] = state[side] === "irt" ? "usdt" : "irt";
    }
    state.edited = "from"; state.amount = parseAmount(elements.amountFrom.value);
    closeDialog(); syncRoute(); paint();
  }

  function withTimeout(promise, milliseconds) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("timeout")); }, milliseconds);
      promise.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }

  function fetchJson(url, timeout) {
    return withTimeout(fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }), timeout);
  }

  function attemptEndpoints(paths, timeout) {
    // apiv2 اول است: نام api.nobitex.ir در DNS وجود ندارد و هر بار یک
    // درخواست محکوم‌به‌شکست می‌ساخت. به‌عنوان فالبک نگه داشته شده تا اگر
    // روزی دوباره فعال شد، سایت بدون تغییر کار کند.
    var hosts = ["https://apiv2.nobitex.ir", "https://api.nobitex.ir"];
    var urls = [];
    hosts.forEach(function (host) { paths.forEach(function (path) { urls.push(host + path); }); });
    function attempt(index) {
      if (index >= urls.length) return Promise.reject(new Error("Nobitex unavailable"));
      return fetchJson(urls[index], timeout).catch(function () { return attempt(index + 1); });
    }
    return attempt(0);
  }

  function loadSnapshot() {
    return fetchJson("/data/prices.json?t=" + Date.now(), 5000).then(function (payload) {
      var savedRate = Number(payload.rate || (payload.prices && payload.prices.usdt));
      if (Number.isFinite(savedRate) && savedRate > 0) {
        setEdge("usdt", "irt", savedRate);
        state.sources.nobitex.at = payload.updated ? new Date(payload.updated) : null;
        state.sources.nobitex.live = false;
        paint();
      }
    }).catch(function () { /* snapshot is only a fallback */ });
  }

  /* طلا، سکه و ارز فیات از پراکسی هم‌دامنه می‌آیند، نه مستقیم از
     BrsApi: سهمیهٔ رایگان روزی ۱۵۰۰ درخواست است و کلید هم نباید در
     جاوااسکریپت عمومی دیده شود. جزئیات در api/rates.php. */
  /* یال‌های پراکسی جدا نگه داشته می‌شوند چون buildMarketGraph کل گراف
     را از نو می‌سازد. نوبیتکس معمولاً دیرتر از پراکسی جواب می‌دهد، و
     بدون این کار طلا و ارز فیات درست بعد از رسیدن پاسخ نوبیتکس از
     فهرست ناپدید می‌شدند. */
  function applyProxyEdges() {
    var assets = state.proxyAssets;
    if (!assets) return 0;
    var applied = 0;
    Object.keys(assets).forEach(function (id) {
      if (!currencies[id]) return;
      var toman = Number(assets[id] && assets[id].toman);
      if (!Number.isFinite(toman) || toman <= 0) return;
      setEdge(id, "irt", toman);
      applied += 1;
    });
    return applied;
  }

  function loadProxyRates() {
    return fetchJson("/api/rates.php?t=" + Date.now(), 8000).then(function (payload) {
      var assets = payload && payload.assets;
      if (!assets || typeof assets !== "object") throw new Error("invalid rates payload");
      state.proxyAssets = assets;
      if (!applyProxyEdges()) throw new Error("no usable rates");
      state.sources.proxy.live = !payload.stale;
      state.sources.proxy.at = payload.updated ? new Date(payload.updated) : new Date();
      paint();
    }).catch(function () {
      // نبودِ این منبع نباید بخش ارز دیجیتال را از کار بیندازد.
      state.sources.proxy.live = false;
      paint();
    });
  }

  function loadLiveRates() {
    state.loading = true; elements.refresh.classList.add("loading"); elements.refresh.disabled = true; paintRate();
    var statsRequest = attemptEndpoints(["/market/stats"], 12000);
    var optionsRequest = attemptEndpoints(["/v2/options"], 12000).catch(function () { return null; });
    var namesRequest = fetchJson("/data/currencies.json?t=" + Date.now(), 5000).catch(function () { return null; });
    return Promise.all([statsRequest, optionsRequest, namesRequest]).then(function (responses) {
      buildMarketGraph(responses[0]); applyOptions(responses[1]); applyCurrencyNames(responses[2]);
      // buildMarketGraph گراف را از نو ساخت، پس یال‌های پراکسی باید
      // دوباره سوار شوند.
      applyProxyEdges();
      // رمزارزها تازه حالا وجود دارند، پس آدرسی که منتظر مانده بود
      // می‌تواند اعمال شود.
      resolvePendingRoute();
      state.sources.nobitex.live = true; state.sources.nobitex.at = new Date();
      state.loading = false; paint();
      if (!elements.dialog.hidden) renderAssetList();
    }).catch(function () {
      state.loading = false; state.sources.nobitex.live = false; paint();
    }).finally(function () {
      elements.refresh.classList.remove("loading"); elements.refresh.disabled = false;
    });
  }

  clearLegacyHash();
  onInput("from", elements.amountFrom); onInput("to", elements.amountTo);
  elements.swap.addEventListener("click", swapCurrencies);
  // دکمهٔ تازه‌سازی باید هر دو منبع را تازه کند، نه فقط نوبیتکس.
  function refreshAll() {
    loadProxyRates();
    return loadLiveRates();
  }

  elements.refresh.addEventListener("click", refreshAll);
  if (elements.assetFilters) {
    elements.assetFilters.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-group]") : null;
      if (button && button.dataset) setFilterGroup(button.dataset.group);
    });
  }
  elements.currencyFrom.addEventListener("click", function () { openDialog("from"); });
  elements.currencyTo.addEventListener("click", function () { openDialog("to"); });
  elements.dialogClose.addEventListener("click", closeDialog);
  elements.dialog.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  elements.assetSearch.addEventListener("input", renderAssetList);
  document.addEventListener("keydown", function (event) {
    if (!elements.dialog.hidden && event.key === "Escape") closeDialog();
  });
  // آدرس ورودی، جفت و مقدار اولیه را تعیین می‌کند. قبل از اولین paint
  // انجام می‌شود تا صفحه یک‌بار با جفت پیش‌فرض رسم و بعد عوض نشود.
  var bootRoute = parseRoute(location.pathname);
  if (!applyRoute(bootRoute)) state.pendingRoute = bootRoute;
  var initialAmount = parseAmountParam(location.search);
  if (initialAmount !== null) {
    state.amount = initialAmount;
    state.edited = "from";
    setInput(elements.amountFrom, formatNumber(initialAmount, currencies[state.from].decimals));
  }

  // دکمهٔ بازگشت مرورگر باید به جفت قبلی برگردد، نه از سایت بیرون ببرد.
  if (window && typeof window.addEventListener === "function") {
    window.addEventListener("popstate", function () {
      if (applyRoute(parseRoute(location.pathname))) paint();
    });
  }

  paint();
  paintFilters();
  loadSnapshot().finally(refreshAll);
})();
