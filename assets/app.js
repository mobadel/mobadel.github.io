(function () {
  "use strict";

  var DIGIT_MAP = {};
  "۰۱۲۳۴۵۶۷۸۹".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });
  "٠١٢٣٤٥٦٧٨٩".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });

  var HUB_TITLE = "تبدکس | قیمت لحظه‌ای دلار، طلا، سکه و ارز دیجیتال";
  var HUB_DESCRIPTION = "قیمت لحظه‌ای دلار، تتر، طلا، سکه، بیت کوین و یورو و دسترسی سریع به مبدل قیمت در تبدکس.";
  var CONVERT_HEADING = "تبدیل قیمت دلار، طلا، ارز دیجیتال و سایر دارایی‌ها";
  var CONVERT_DESCRIPTION_BASE = "تبدیل قیمت دلار، طلا، سکه، تتر، بیت کوین، ارزهای دیجیتال، نقره و سایر دارایی‌ها با نرخ لحظه ای بازار ایران و جهان";

  var PERSIAN_NAMES = {
    irt: "تومان", usdt: "تتر", btc: "بیت کوین", eth: "اتریوم", ltc: "لایت‌کوین",
    xrp: "ریپل", bch: "بیت کوین کش", bnb: "بایننس کوین", doge: "دوج‌کوین",
    xlm: "استلار", trx: "ترون", ada: "کاردانو", xmr: "مونرو", etc: "اتریوم کلاسیک",
    link: "چین‌لینک", dai: "دای", dot: "پولکادات", uni: "یونی‌سواپ", aave: "آوه",
    sol: "سولانا", fil: "فایل‌کوین", grt: "گراف", atom: "کازماس", avax: "آوالانچ",
    near: "نیر", mana: "دیسنترالند", sand: "سندباکس", usdc: "یو‌اس‌دی کوین",
    algo: "الگورند", gram: "گرام", ton: "تون‌کوین", shib: "شیبا اینو", pepe: "پپه", paxg: "پکس گلد"
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
  var COIN_ICON = "/assets/coin-emami.webp?v=20260825-2";

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

    /* فلزات از گواهی سپردهٔ بورس کالا می‌آیند، نه از بازار آزاد. به‌جای
       نماد لاتین، منبعشان نوشته می‌شود تا کاربر بداند قیمت از کجاست. */
    { id: "silver", code: "بورس کالا", name: "نقره ۹۹۹", englishName: "Silver 999",     decimals: 4, group: "commodity", unit: "gram",     localIcon: "/assets/silver.svg" },
    { id: "copper", code: "بورس کالا", name: "مس",       englishName: "Copper Cathode", decimals: 4, group: "commodity", unit: "kilogram", localIcon: "/assets/copper.svg" },

    /* انرژی در بازار آتی آمریکا معامله می‌شود و قیمتش دلاری است؛ مثل
       انس طلا با نرخ دلار به تومان می‌آید. «بنزین آمریکا» عمداً نام
       کامل‌تری دارد تا با بنزین جایگاه‌های داخلی اشتباه نشود. */
    { id: "brent",    code: "BRENT", name: "نفت برنت",    englishName: "Brent Crude",   decimals: 4, group: "energy", unit: "barrel", localIcon: "/assets/crude-oil.svg" },
    { id: "gasoline", code: "RBOB",  name: "بنزین آمریکا", englishName: "RBOB Gasoline", decimals: 4, group: "energy", unit: "gallon", localIcon: "/assets/gasoline.svg" },

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
  var UNIT_LABELS = { gram: "گرم", piece: "عدد", mesghal: "مثقال", ounce: "انس", kilogram: "کیلو", barrel: "بشکه", gallon: "گالن" };

  /* ترتیب فهرست دارایی‌ها. بدون این، مرتب‌سازی الفبایی بود و مثلاً دلار
     ته فهرست ارزها می‌افتاد در حالی که پرکاربردترین است. هر چیزی که
     اینجا نباشد بعد از این‌ها و به‌ترتیب الفبا می‌آید. */
  var IMPORTANCE = [
    "irt", "usdt",
    // ارز دیجیتال
    "btc", "eth", "usdc", "xrp", "bnb", "sol", "doge", "trx", "ada", "gram",
    "shib", "dot", "avax", "link", "ltc", "bch", "atom", "near", "pepe",
    // طلا و سکه
    "gold18", "gold24", "goldmelted", "goldounce",
    "emami", "bahar", "halfcoin", "quartercoin", "gramcoin",
    // فلزات
    "silver", "copper",
    // ارز فیات
    "usd", "eur", "gbp", "aed", "try", "chf", "cad", "aud", "cny", "jpy",
    "rub", "sar", "qar", "kwd", "omr", "bhd", "iqd", "afn", "inr", "pkr",
    "sek", "myr", "thb", "azn", "amd", "gel", "syp"
  ];

  var RANK = {};
  IMPORTANCE.forEach(function (id, index) { RANK[id] = index; });

  function rankOf(id) { return RANK[id] == null ? IMPORTANCE.length : RANK[id]; }

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

  /* بعضی بازارهای نوبیتکس با ضریب بسته‌بندی نام‌گذاری شده‌اند؛ مثلاً
     100k_floki. ضریب فقط بخشی از شناسه و نماد بازار است؛ اسلاگ عمومی
     کوتاه و پایدار می‌ماند: floki. نگاشت معکوس هنگام ثبت دارایی ساخته می‌شود. */
  function packagedSlug(id) {
    var match = String(id || "").toLowerCase().match(/^\d+[kmb]_(.+)$/);
    return match ? match[1] : null;
  }

  function registerSlug(id) {
    var slug = packagedSlug(id);
    if (slug && (!SLUG_TO_ID[slug] || SLUG_TO_ID[slug] === id)) SLUG_TO_ID[slug] = id;
  }

  function slugOf(id) { return SLUG_OVERRIDES[id] || packagedSlug(id) || id; }

  function idFromSlug(slug) {
    slug = String(slug || "").toLowerCase();
    return SLUG_TO_ID[slug] || slug;
  }

  // جفتی که هنگام ورود به صفحهٔ اصلی نشان داده می‌شود. مسیر ریشه فقط
  // نقطهٔ ورود است؛ خود جفت‌ها همیشه آدرس مستقلشان را دارند.
  var DEFAULT_FROM = "usd";
  var DEFAULT_TO = "irt";

  function unitLabel(currency) {
    return currency && currency.unit ? (UNIT_LABELS[currency.unit] || null) : null;
  }

  /* واحد را فقط وقتی جلوی نام می‌گذارد که نام خودش با آن شروع نشده
     باشد. بدون این، «انس طلا» که واحدش هم «انس» است می‌شد
     «۱ انس انس طلا». قاعده عمومی است تا اگر بعداً دارایی مشابهی
     اضافه شد (مثلاً «گرم نقره») همین مشکل تکرار نشود. */
  function unitPrefix(currency) {
    var unit = unitLabel(currency);
    if (!unit) return "";
    return String((currency && currency.name) || "").indexOf(unit) === 0 ? "" : unit;
  }

  function unitizedName(currency) {
    var unit = unitPrefix(currency);
    return (unit ? unit + " " : "") + currency.name;
  }

  var state = {
    from: "usd", to: "irt", amount: 100, edited: "from", rate: null,
    graph: {}, updatedAt: null, live: false, loading: false, dialogSide: null, lastFocused: null,
    proxyCache: null,
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
    pairContentTitle: document.getElementById("pair-content-title"),
    pairContentIntro: document.getElementById("pair-content-intro"),
    pairContentRate: document.getElementById("pair-content-rate"),
    rateStatus: document.getElementById("rate-status"), swap: document.getElementById("swap"),
    dialog: document.getElementById("asset-dialog"),
    dialogTitle: document.getElementById("asset-dialog-title"), dialogClose: document.getElementById("dialog-close"),
    assetSearch: document.getElementById("asset-search"), assetList: document.getElementById("asset-list"),
    assetEmpty: document.getElementById("asset-empty"), assetFilters: document.getElementById("asset-filters"),
    dialogPanel: document.getElementById("asset-dialog-panel")
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

  function formatTime(date) {
    if (!date) return "";
    return TIME_FORMATTER.format(roundToMinute(date));
  }

  function formatCurrencyNumber(value, currency) {
    var decimals = currency && currency.group === "crypto" && value >= 1 ? 2 : currency.decimals;
    return formatNumber(value, decimals);
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

  function localCryptoIcon(id) {
    // NXT20 شاخص تجمیعی بازار است و آیکون رسمی منتشرشده ندارد.
    if (id === "nxt20") return null;
    var pngIcons = { sent: true, tao: true, zk: true };
    return "/assets/crypto-icons/" + encodeURIComponent(id) + (pngIcons[id] ? ".png" : ".svg");
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
      localIcon: current.localIcon || (id === "irt" ? null : localCryptoIcon(id)),
      iconUrls: [],
      aliases: current.aliases || []
    };
    registerSlug(id);
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
    // نقره و مس و انرژی هم از همین پراکسی می‌آیند؛ نبودنشان در این
    // فهرست یعنی نوار وضعیت برای آن جفت‌ها منبع اشتباه را گزارش می‌کرد.
    return group === "gold" || group === "coin" || group === "commodity" || group === "energy"
      || (group === "fiat" && id !== "irt");
  }

  /* نوار وضعیت باید دربارهٔ همین جفت راست بگوید، نه دربارهٔ کل سایت.
     تبدیل دلار به بیت کوین از هر دو منبع عبور می‌کند، پس قدیمی‌ترین
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
    if (state.pendingRoute) return;
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    if (!fromCurrency || !toCurrency) return;
    var heading = "تبدیل " + fromCurrency.name + " به " + toCurrency.name;
    elements.pageTitle.textContent = heading;
    paintDocumentMeta(heading, fromCurrency, toCurrency);
    paintCurrency(elements.currencyFrom, fromCurrency);
    paintCurrency(elements.currencyTo, toCurrency);
    var result = convertEditedAmount();
    if (state.edited === "from") setInput(elements.amountTo, result === null ? "" : formatCurrencyNumber(result, toCurrency));
    else setInput(elements.amountFrom, result === null ? "" : formatCurrencyNumber(result, fromCurrency));
  }

  /* عنوان و متای صفحه با جفت فعلی هم‌راستا می‌شوند. صفحه‌های ایستایی
     که هنگام دیپلوی ساخته می‌شوند همین مقادیر را از ابتدا در HTML
     دارند؛ این تابع برای بقیهٔ آدرس‌هاست که از بازنویسی می‌آیند و
     برای وقتی که کاربر بدون بارگذاری دوباره جفت را عوض می‌کند. */
  function paintDocumentMeta(heading, fromCurrency, toCurrency) {
    if (typeof document === "undefined") return;

    /* در ورود مستقیم، رمزارزها بعد از پاسخ API شناخته می‌شوند. تا آن
       زمان متادیتای دقیقِ سرورساخته را با جفت پیش‌فرض جایگزین نکن؛
       خزنده ممکن است همان canonical موقت و اشتباه را ثبت کند. */
    if (state.pendingRoute) return;

    var pairPath = canonicalForPair(state.from, state.to);
    var pathname = String(location.pathname || "/").replace(/\/+$/, "") || "/";
    var isHub = pathname === "/";
    var isConvertHome = pathname === "/convert";
    var date = todayLabel();
    document.title = isHub ? HUB_TITLE : isConvertHome ? CONVERT_HEADING + " امروز " + date + " | مبدل قیمت" : heading + " امروز " + date + " | مبدل قیمت";

    var description = isHub ? HUB_DESCRIPTION : isConvertHome ? CONVERT_DESCRIPTION_BASE + " امروز " + date + "." :
      heading + " با قیمت لحظه ای امروز " + date + ". مبدل نرخ " + fromCurrency.name + " به " + toCurrency.name + ".";
    setMeta("name", "description", description);
    setMeta("property", "og:title", document.title);
    setMeta("property", "og:description", description);
    setMeta("name", "twitter:title", document.title);
    setMeta("name", "twitter:description", description);

    var canonical = document.querySelector ? document.querySelector('link[rel="canonical"]') : null;
    if (canonical && canonical.setAttribute) {
      canonical.setAttribute("href", "https://tabdex.ir" + pairPath);
    }
    setMeta("property", "og:url", "https://tabdex.ir" + pairPath);
  }

  function setMeta(attribute, key, value) {
    if (!document.querySelector) return;
    var tag = document.querySelector("meta[" + attribute + '="' + key + '"]');
    if (tag && tag.setAttribute) tag.setAttribute("content", value);
  }

  function todayLabel() {
    var formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    var values = {};
    formatter.formatToParts(new Date()).forEach(function (part) { if (part.type !== "literal") values[part.type] = part.value; });
    return values.weekday + " " + values.day + " " + values.month + " " + values.year;
  }

  function paintRate() {
    if (state.pendingRoute) {
      elements.rateValue.textContent = "در حال دریافت نرخ این تبدیل…";
      return;
    }
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
    var fromUnit = unitPrefix(fromCurrency);
    elements.rateValue.textContent = "۱ " + (fromUnit ? fromUnit + " " : "") + fromCurrency.name +
      " = " + formatCurrencyNumber(state.rate, toCurrency) + " " + toCurrency.name;
    elements.rateStatus.classList.toggle("error", !state.live);
    elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
      (state.live ? "آخرین به‌روزرسانی " + formatTime(state.updatedAt) : "نمایش آخرین نرخ ذخیره‌شده");
  }

  function paintPairContent() {
    if (state.pendingRoute) return;
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    if (!fromCurrency || !toCurrency || !elements.pairContentTitle) return;
    elements.pairContentTitle.textContent = "تبدیل " + fromCurrency.name + " به " + toCurrency.name +
      " با قیمت لحظه ای و سریع";
    elements.pairContentIntro.textContent = "با سرویس مبدل تبدکس، می‌توانید به‌سادگی " + fromCurrency.name +
      " خود را به " + toCurrency.name + " تبدیل کنید. قیمت لحظه ای هر دارایی به شما کمک می‌کند قبل از انجام تبدیل، ارزش دارایی خود را مشاهده کنید.";
    if (!Number.isFinite(state.rate) || state.rate <= 0) {
      elements.pairContentRate.textContent = "در حال دریافت نرخ لحظه ای " + fromCurrency.name + " و " + toCurrency.name + "…";
      return;
    }
    var reverseRate = 1 / state.rate;
    elements.pairContentRate.textContent = "هر یک " + unitizedName(fromCurrency) + " معادل " +
      formatCurrencyNumber(state.rate, toCurrency) + " " + unitizedName(toCurrency) + " و هر یک " + unitizedName(toCurrency) +
      " برابر با " + formatCurrencyNumber(reverseRate, fromCurrency) + " " + unitizedName(fromCurrency) + " است.";
  }

  function paint() { updateRate(); refreshPairStatus(); paintConversion(); paintRate(); paintPairContent(); }

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
     آدرس‌ها به شکل /convert/btc-to-irt/ هستند و روی سرور همه به convert/index.html
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

  /* آدرسی که کاربر باید ببیند. جفت پیش‌فرض هم آدرس اسلاگ‌دار خودش را
     می‌گیرد: اگر کسی از bitcoin-to-gold18 به تتر و تومان برگردد، باید
     روی usdt-to-irt بنشیند نه اینکه به ریشه پرتاب شود. */
  function pathForPair(from, to) {
    return "/convert/" + slugOf(from) + "-to-" + slugOf(to) + "/";
  }

  /* ریشه متای عمومی صفحهٔ اصلی را دارد. ورود مستقیم به هر جفت یا
     رسیدن به آن حین کار، از جمله جفت پیش‌فرض، canonical مستقل همان
     جفت را می‌گیرد و به ریشه تبدیل نمی‌شود. */
  function canonicalForPair(from, to) {
    var pathname = String(location.pathname || "/").replace(/\/+$/, "") || "/";
    if (pathname === "/") return "/";
    if (pathname === "/convert") return "/convert/";
    // روی مسیر جفت معتبر، خود URL منبع canonical است. این باعث می‌شود
    // تأخیر API هیچ‌وقت canonical را موقتاً به جفت پیش‌فرض تغییر ندهد.
    if (/^\/convert\/[a-z0-9]+-to-[a-z0-9]+$/i.test(pathname)) return pathname + "/";
    return pathForPair(from, to);
  }

  // بعد از هر تغییر جفت صدا زده می‌شود. pushState تا دکمهٔ بازگشت
  // مرورگر کاربر را به جفت قبلی برگرداند.
  function syncRoute() {
    var target = pathForPair(state.from, state.to);
    if (location.pathname === target) return;
    // هوم‌پیج قالب متفاوتی دارد. با تغییر جفت باید یک navigation واقعی
    // انجام شود تا جدول قیمت و محتوای هاب در صفحهٔ مبدل باقی نماند.
    if ((String(location.pathname || "/").replace(/\/+$/, "") || "/") === "/") {
      location.href = target;
      return;
    }
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
    // نگاشت اسلاگ‌های کوتاه رمزارزهای ضریب‌دار تازه هنگام دریافت فهرست
    // بازار ساخته می‌شود؛ بنابراین مسیر را با نگاشت تازه دوباره می‌خوانیم.
    var route = parseRoute(location.pathname) || state.pendingRoute;
    if (!applyRoute(route)) return false;
    state.pendingRoute = null;
    return true;
  }

  function swapCurrencies() {
    var visibleResult = parseAmount(elements.amountTo.value);
    var previousFrom = state.from;
    state.from = state.to; state.to = previousFrom; state.edited = "from";
    state.amount = Number.isFinite(visibleResult) ? visibleResult : 0;
    setInput(elements.amountFrom, formatCurrencyNumber(state.amount, currencies[state.from]));
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
      var aRank = rankOf(a.id);
      var bRank = rankOf(b.id);
      if (aRank !== bRank) return aRank - bRank;
      // هم‌رتبه‌ها (یعنی هر دو خارج از فهرست اهمیت) الفبایی می‌آیند.
      var aKey = a.code || a.name || a.id;
      var bKey = b.code || b.name || b.id;
      return String(aKey).localeCompare(String(bKey), "fa");
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
    commodity: ["commodity"],
    energy: ["energy"],
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
    window.setTimeout(function () {
      /* روی موبایل فوکوس خودکار روی فیلد جستجو کیبورد را باز می‌کند و
         فهرست دارایی‌ها را می‌پوشاند، پس کاربر مجبور می‌شود اول کیبورد
         را ببندد. کیبورد فقط وقتی باید بیاید که خودِ کاربر روی فیلد
         جستجو زده باشد.

         روی دسکتاپ برعکس است: فوکوس خودکار یعنی می‌شود بلافاصله تایپ
         کرد و هیچ ضرری هم ندارد. پس تفکیک بر اساس نوع اشاره‌گر است،
         نه اندازهٔ صفحه؛ تبلت با قلم یا لپ‌تاپ لمسی هم درست رفتار کند. */
      if (prefersAutoFocus()) {
        elements.assetSearch.focus();
      } else if (elements.dialogPanel && elements.dialogPanel.focus) {
        // فوکوس باید داخل دیالوگ برود وگرنه کاربرِ صفحه‌کلید و
        // صفحه‌خوان بیرون از پنجرهٔ باز گیر می‌کند.
        elements.dialogPanel.focus();
      }
    }, 0);
  }

  function prefersAutoFocus() {
    if (!window || typeof window.matchMedia !== "function") return false;
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch (error) {
      return false;
    }
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
    // بیت کوین). در آن صورت طرف مقابل به تومان برمی‌گردد که با هر
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
      // سن و عمر کش سرور: زمان‌بند از همین‌ها می‌فهمد کی دوباره بگیرد.
      state.proxyCache = { fetchedUnix: Number(payload.fetched_unix) || 0, ttl: Number(payload.ttl) || 0 };
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
    state.loading = true; paintRate();
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
    });
  }

  clearLegacyHash();
  onInput("from", elements.amountFrom); onInput("to", elements.amountTo);
  elements.swap.addEventListener("click", swapCurrencies);
  // هر دو منبع با هم تازه می‌شوند.
  function refreshAll() {
    loadProxyRates();
    return loadLiveRates();
  }
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
    setInput(elements.amountFrom, formatCurrencyNumber(initialAmount, currencies[state.from]));
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

  /* ── تازه‌سازی دوره‌ای ───────────────────────────────────────────
     تا پیش از این نرخ‌ها فقط یک‌بار موقع لود گرفته می‌شدند: هر کس
     صفحه را باز می‌گذاشت، تا رفرش‌نکردن همان عدد لحظهٔ ورود را
     می‌دید — حتی وقتی کش سرور ده بار تازه شده بود.

     سه قید جلوی هدررفتِ سهمیه و باتری را می‌گیرد: تبِ پنهان اصلاً
     درخواست نمی‌دهد، صفحه‌ای که ربع ساعت هیچ تعاملی نداشته خوابیده
     حساب می‌شود، و برگشتن به تب فقط وقتی درخواست می‌سازد که داده
     واقعاً کهنه باشد. سرور هم کش مشترک دارد، پس چند تب باز هم‌زمان
     بیش از یک تماس با بالادست نمی‌سازد. */
  /* محیط تست مرورگر کامل نیست؛ بدون این بررسی، بارگذاریِ فایل
     همان‌جا می‌شکست. */
  if (typeof window.setTimeout === "function" && typeof window.clearTimeout === "function"
    && typeof window.addEventListener === "function" && typeof document.addEventListener === "function") {
    /* فاصلهٔ ثابت شصت‌ثانیه‌ای با انقضای کش سرور هم‌فاز نبود: می‌شد
       درست یک لحظه قبل از تازه شدن کش درخواست داد و تا شصت ثانیهٔ بعد
       نرخی را نشان داد که همان موقع کهنه شده بود. برچسب ساعت هم همان
       اندازه عقب می‌افتاد.

       حالا سرور سن و عمر کشش را می‌گوید و درخواست بعدی درست بعد از
       انقضای آن می‌نشیند. تعداد درخواست‌ها همان است، فقط فازش درست
       می‌شود؛ سقف شصت ثانیه هم برای ارز دیجیتال است که کش سرور ندارد
       و شبانه‌روز تکان می‌خورد. */
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
      var cache = state.proxyCache;
      if (!cache || !cache.fetchedUnix || !cache.ttl) return REFRESH_MAX;
      var age = Date.now() / 1000 - cache.fetchedUnix;
      // دو ثانیه تحمل تا درخواست زودتر از انقضا نرسد و کش قبلی را بگیرد.
      var remaining = (cache.ttl - age + 2) * 1000;
      return Math.min(REFRESH_MAX, Math.max(MIN_GAP, remaining));
    }

    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity > IDLE_TIMEOUT) return;
      if (Date.now() - lastRefresh < MIN_GAP) return;
      lastRefresh = Date.now();
      refreshAll();
    }

    function scheduleRefresh() {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(function () {
        maybeRefresh();
        scheduleRefresh();
      }, nextDelay());
    }

    scheduleRefresh();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      // برگشتن به تب خودش تعامل است، وگرنه صفحه‌ای که مدتی پنهان بوده
      // بیدار می‌شد ولی بی‌درنگ بیکار حساب می‌شد و هرگز تازه نمی‌شد.
      markActivity();
      maybeRefresh();
      scheduleRefresh();
    });
  }
})();
