(function () {
  "use strict";

  var rotatingAsset = document.getElementById("rotating-asset");
  var rotatingName = document.getElementById("rotating-asset-name");
  var rotatingIcon = document.getElementById("rotating-asset-icon");
  var rotatingItems = [
    { name: "دلار", icon: "/assets/flags/us.svg" },
    { name: "طلا", icon: "/assets/gold-18k.svg" },
    { name: "تتر", icon: "/assets/usdt-logo.svg" },
    { name: "سکه", icon: "/assets/coin-emami.webp?v=20260825-2" },
    { name: "بیت‌کوین", icon: "/assets/crypto-icons/btc.svg" }
  ];
  var rotatingIndex = 0;
  if (rotatingAsset && rotatingName && rotatingIcon && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    window.setInterval(function () {
      rotatingAsset.classList.add("is-changing");
      window.setTimeout(function () {
        rotatingIndex = (rotatingIndex + 1) % rotatingItems.length;
        rotatingName.textContent = rotatingItems[rotatingIndex].name;
        rotatingIcon.src = rotatingItems[rotatingIndex].icon;
        rotatingAsset.classList.remove("is-changing");
      }, 220);
    }, 2600);
  }

  var rows = document.getElementById("home-market-rows");
  if (!rows) return;

  /* group فقط برای تگ‌های بالای جدول است؛ history یعنی سرور تاریخچهٔ
     روزانهٔ این دارایی را دارد و ستون روند ۳۰ روزه برایش رسم می‌شود. */
  var definitions = [
    { id: "usd", name: "دلار", code: "USD", url: "/price/currency/usd/", icon: "/assets/flags/us.svg", source: "proxy", group: "fiat", history: true },
    { id: "usdt", name: "تتر", code: "USDT", url: "/price/crypto/usdt/", icon: "/assets/usdt-logo.svg", source: "toman", group: "crypto" },
    { id: "gold18", name: "طلای ۱۸ عیار", code: "هر گرم", url: "/price/gold/gold18/", icon: "/assets/gold-18k.svg", source: "proxy", group: "metal", history: true },
    { id: "emami", name: "سکه امامی", code: "هر عدد", url: "/price/coin/emami/", icon: "/assets/coin-emami.webp?v=20260825-2", source: "proxy", group: "metal", history: true },
    { id: "btc", name: "بیت کوین", code: "BTC", url: "/price/crypto/btc/", icon: "/assets/crypto-icons/btc.svg", source: "usdt", group: "crypto" },
    { id: "eur", name: "یورو", code: "EUR", url: "/price/currency/eur/", icon: "/assets/flags/eu.svg", source: "proxy", group: "fiat", history: true },
    // نفت برنت هم از همان پراکسی می‌آید، ولی بازارش دلاری است و قیمتش
    // هم دلاری نشان داده می‌شود؛ تغییرش هم تغییر دلاری است.
    { id: "brent", name: "نفت برنت", code: "هر بشکه", url: "/price/energy/brent/", icon: "/assets/crude-oil.svg", source: "proxy", currency: "usd", group: "energy" }
  ];

  /* «بیشترین تغییر امروز» میان دارایی‌های تومانی پراکسی انتخاب می‌شود.
     رمزارزها عمداً بیرون‌اند: نوسانشان همیشه بالای فهرست می‌نشست و
     تصویر بازار ایران را نشان نمی‌داد. */
  var FLAG = "/assets/flags/";
  var GOLD = "/assets/gold-18k.svg";
  var COIN = "/assets/coin-emami.webp?v=20260825-2";
  var MOVERS = [
    ["usd", "دلار", "/price/currency/usd/", FLAG + "us.svg"], ["eur", "یورو", "/price/currency/eur/", FLAG + "eu.svg"],
    ["gbp", "پوند", "/price/currency/gbp/", FLAG + "gb.svg"], ["aed", "درهم امارات", "/price/currency/aed/", FLAG + "ae.svg"],
    ["try", "لیر ترکیه", "/price/currency/try/", FLAG + "tr.svg"], ["cny", "یوآن چین", "/price/currency/cny/", FLAG + "cn.svg"],
    ["rub", "روبل روسیه", "/price/currency/rub/", FLAG + "ru.svg"], ["chf", "فرانک سوئیس", "/price/currency/chf/", FLAG + "ch.svg"],
    ["cad", "دلار کانادا", "/price/currency/cad/", FLAG + "ca.svg"], ["aud", "دلار استرالیا", "/price/currency/aud/", FLAG + "au.svg"],
    ["afn", "افغانی", "/price/currency/afn/", FLAG + "af.svg"], ["iqd", "دینار عراق", "/price/currency/iqd/", FLAG + "iq.svg"],
    ["gold18", "طلای ۱۸ عیار", "/price/gold/gold18/", GOLD], ["gold24", "طلای ۲۴ عیار", "/price/gold/gold24/", GOLD],
    ["goldmelted", "طلای آب‌شده", "/price/gold/melted/", GOLD], ["emami", "سکه امامی", "/price/coin/emami/", COIN],
    ["bahar", "سکه بهار آزادی", "/price/coin/baharazadi/", COIN], ["halfcoin", "نیم سکه", "/price/coin/nim/", COIN],
    ["quartercoin", "ربع سکه", "/price/coin/rob/", COIN], ["gramcoin", "سکه یک گرمی", "/price/coin/gerami/", COIN],
    ["silver", "نقره ۹۹۹", "/price/commodity/silver/", "/assets/silver.svg"], ["copper", "مس", "/price/commodity/copper/", "/assets/copper.svg"]
  ];
  var KPI_IDS = ["usd", "gold18", "emami"];

  function getJson(url, init) {
    return fetch(url, init || { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  function number(value, digits) {
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits == null ? 0 : digits }).format(value);
  }

  function changeText(value) {
    if (!Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + number(value, 2) + "٪";
  }

  function toneOf(value) { return value > 0 ? "positive" : value < 0 ? "negative" : "neutral"; }

  function roundIcon(src) {
    var wrap = document.createElement("span"); wrap.className = "round-icon";
    var image = document.createElement("img"); image.src = src; image.alt = ""; image.loading = "lazy";
    wrap.appendChild(image); return wrap;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  function sparkline(points) {
    var values = (points || []).map(function (point) { return Number(point[1]); }).filter(function (value) { return Number.isFinite(value) && value > 0; });
    if (values.length < 2) { var empty = document.createElement("span"); empty.className = "spark-empty"; empty.textContent = "—"; return empty; }
    var low = Math.min.apply(null, values); var high = Math.max.apply(null, values); var span = high - low || 1;
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 96 28"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "spark " + toneOf(values[values.length - 1] - values[0]));
    var line = document.createElementNS(SVG_NS, "polyline");
    line.setAttribute("points", values.map(function (value, index) {
      return (index * 96 / (values.length - 1)).toFixed(1) + "," + (26 - (value - low) / span * 24).toFixed(1);
    }).join(" "));
    svg.appendChild(line); return svg;
  }

  function quoteFor(definition, stats, proxy) {
    var price = NaN; var change = NaN; var unit = "تومان";
    if (definition.source === "proxy") {
      var proxyRow = proxy && proxy.assets && proxy.assets[definition.id];
      var inUsd = definition.currency === "usd";
      price = Number(proxyRow && (inUsd ? proxyRow.usd : proxyRow.toman)); change = Number(proxyRow && proxyRow.change);
      if (inUsd) unit = "دلار";
    } else if (definition.source === "toman") {
      var tomanRow = stats && stats.stats && stats.stats[definition.id + "-rls"];
      price = Number(tomanRow && tomanRow.latest) / 10; change = Number(tomanRow && tomanRow.dayChange);
    } else {
      var usdtRow = stats && stats.stats && stats.stats[definition.id + "-usdt"];
      price = Number(usdtRow && usdtRow.latest); change = Number(usdtRow && usdtRow.dayChange); unit = "تتر";
    }
    return { price: price, change: change, unit: unit };
  }

  function priceText(price, unit) {
    return Number.isFinite(price) && price > 0 ? number(price, price < 1 ? 6 : unit === "دلار" ? 2 : 0) + " " + unit : "ناموجود";
  }

  var activeFilter = "all";
  var lastStats = null; var lastProxy = null; var daily = {};

  function applyFilter() {
    Array.prototype.forEach.call(rows.querySelectorAll(".home-market-row"), function (row) {
      row.hidden = activeFilter !== "all" && row.getAttribute("data-group") !== activeFilter;
    });
  }

  function paint(stats, proxy) {
    rows.replaceChildren();
    definitions.forEach(function (definition) {
      var quote = quoteFor(definition, stats, proxy);
      var price = quote.price; var change = quote.change; var unit = quote.unit;

      var link = document.createElement("a"); link.className = "home-market-row"; link.href = definition.url;
      link.setAttribute("data-group", definition.group);
      var identity = document.createElement("span"); identity.className = "home-market-identity";
      var icon = document.createElement("span"); icon.className = "home-market-icon";
      var image = document.createElement("img"); image.src = definition.icon; image.alt = ""; icon.appendChild(image);
      var label = document.createElement("span"); label.className = "home-market-label";
      var strong = document.createElement("strong"); strong.textContent = definition.name;
      var small = document.createElement("small"); small.textContent = definition.code;
      label.append(strong, small); identity.append(icon, label);
      var priceCell = document.createElement("span"); priceCell.className = "home-market-price";
      priceCell.textContent = priceText(price, unit);
      var changeCell = document.createElement("span"); changeCell.className = "home-market-change " + (change > 0 ? "positive" : change < 0 ? "negative" : "neutral"); changeCell.textContent = changeText(change);
      var trend = document.createElement("span"); trend.className = "home-market-trend";
      trend.appendChild(definition.history ? sparkline(daily[definition.id]) : sparkline(null));
      link.append(identity, priceCell, changeCell, trend); rows.appendChild(link);
    });
    applyFilter();
    paintKpis(proxy);
    paintMovers(proxy);
  }

  function paintKpis(proxy) {
    var box = document.getElementById("home-kpis");
    if (!box) return;
    var cards = [];
    KPI_IDS.forEach(function (id) {
      var definition = definitions.filter(function (item) { return item.id === id; })[0];
      var quote = quoteFor(definition, null, proxy);
      if (!(quote.price > 0)) return;
      var card = document.createElement("a"); card.className = "home-kpi"; card.href = definition.url;
      var name = document.createElement("span"); name.className = "home-kpi-name"; name.append(roundIcon(definition.icon), document.createTextNode(definition.name));
      // واحد کنار نام می‌نشیند تا عدد بلند سکه در کارت باریک بریده نشود.
      var value = document.createElement("strong"); value.textContent = number(quote.price, quote.unit === "دلار" ? 2 : 0);
      var unitNote = document.createElement("span"); unitNote.className = "home-kpi-unit"; unitNote.textContent = quote.unit; name.appendChild(unitNote);
      var delta = document.createElement("small"); delta.className = toneOf(quote.change); delta.textContent = changeText(quote.change);
      card.append(name, value, delta); cards.push(card);
    });
    box.replaceChildren.apply(box, cards);
  }

  function paintMovers(proxy) {
    var card = document.getElementById("home-movers");
    var list = document.getElementById("home-movers-list");
    if (!card || !list) return;
    var assets = proxy && proxy.assets || {};
    var movers = MOVERS.map(function (row) {
      var data = assets[row[0]];
      return { id: row[0], name: row[1], url: row[2], icon: row[3], price: Number(data && data.toman), change: Number(data && data.change) };
    }).filter(function (item) { return item.price > 0 && Number.isFinite(item.change) && item.change !== 0; })
      .sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); })
      .slice(0, 5);
    list.replaceChildren.apply(list, movers.map(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a"); link.className = "mover"; link.href = item.url;
      var label = document.createElement("span"); label.className = "mover-label";
      var strong = document.createElement("strong"); strong.textContent = item.name;
      var small = document.createElement("small"); small.textContent = number(item.price) + " تومان";
      label.append(strong, small);
      var badge = document.createElement("span"); badge.className = "change-badge " + toneOf(item.change); badge.textContent = changeText(item.change);
      link.append(roundIcon(item.icon), label, badge); li.appendChild(link); return li;
    }));
    card.hidden = movers.length === 0;
  }

  function paintUsdChart() {
    var card = document.getElementById("home-usd-chart");
    var points = (daily.usd || []).filter(function (point) { return Number(point[1]) > 0; });
    if (!card) return;
    if (points.length < 3) { card.hidden = true; return; }
    var values = points.map(function (point) { return Number(point[1]); });
    var low = Math.min.apply(null, values); var high = Math.max.apply(null, values); var span = high - low || 1;
    var coords = values.map(function (value, index) { return [(index * 760 / (values.length - 1)), 8 + (high - value) / span * 204]; });
    var line = "M" + coords.map(function (c) { return c[0].toFixed(1) + "," + c[1].toFixed(1); }).join(" L");
    document.getElementById("home-usd-chart-line").setAttribute("d", line);
    document.getElementById("home-usd-chart-area").setAttribute("d", line + " L760,220 L0,220 Z");
    document.getElementById("home-usd-chart-low").textContent = number(low);
    document.getElementById("home-usd-chart-high").textContent = number(high);
    var change = (values[values.length - 1] - values[0]) / values[0] * 100;
    var badge = document.getElementById("home-usd-chart-change");
    badge.className = "change-badge " + toneOf(change); badge.textContent = changeText(change);
    document.getElementById("home-usd-chart-svg").setAttribute("aria-label", "نمودار قیمت دلار در ۳۰ روز اخیر، از " + number(values[0]) + " تا " + number(values[values.length - 1]) + " تومان");
    card.hidden = false;
  }

  // سن و عمر کش سرور؛ زمان‌بند تازه‌سازی از همین‌ها فاز می‌گیرد.
  var proxyCache = { fetchedUnix: 0, ttl: 0 };

  function load() {
    return Promise.allSettled([
      getJson("https://apiv2.nobitex.ir/market/stats"),
      getJson("/api/rates.php?t=" + Date.now())
    ]).then(function (results) {
      var proxy = results[1].status === "fulfilled" ? results[1].value : null;
      if (proxy) proxyCache = { fetchedUnix: Number(proxy.fetched_unix) || 0, ttl: Number(proxy.ttl) || 0 };
      lastStats = results[0].status === "fulfilled" ? results[0].value : null; lastProxy = proxy;
      paint(lastStats, lastProxy);
    });
  }

  /* خلاصهٔ روزانه یک درخواست برای همهٔ ستون‌های روند است و سرور آن را
     پنج دقیقه کش می‌کند؛ هر نیم ساعت یک‌بار تازه شدنش کافی است. */
  var lastDaily = 0;
  function loadDaily() {
    lastDaily = Date.now();
    var ids = definitions.filter(function (item) { return item.history; }).map(function (item) { return item.id; });
    return getJson("/api/history.php?assets=" + ids.join(",") + "&days=31", { headers: { Accept: "application/json" } }).then(function (payload) {
      daily = payload && payload.assets || {};
      paint(lastStats, lastProxy);
      paintUsdChart();
    }).catch(function () { /* ستون روند خالی می‌ماند */ });
  }

  var filters = document.getElementById("home-market-filters");
  if (filters && filters.addEventListener) {
    filters.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-filter]") : null;
      if (!button) return;
      activeFilter = button.getAttribute("data-filter");
      Array.prototype.forEach.call(filters.querySelectorAll("[data-filter]"), function (item) { item.setAttribute("aria-pressed", item === button ? "true" : "false"); });
      applyFilter();
    });
  }

  /* مجله روی همین دامنه و جدا از این مخزن منتشر می‌شود. اگر پاسخ نداد
     یا ساختارش آشنا نبود، بخش مجله پنهان می‌ماند؛ هیچ متن جانشینی
     نمایش داده نمی‌شود. */
  function safeLink(value) {
    try { var url = new URL(String(value || ""), location.origin); return url.origin === location.origin && /^\/mag\//.test(url.pathname) ? url.href : null; }
    catch (error) { return null; }
  }
  function safeImage(value) {
    try { var url = new URL(String(value || ""), location.origin); return url.protocol === "https:" || url.origin === location.origin ? url.href : null; }
    catch (error) { return null; }
  }
  function plain(html) {
    var doc = new DOMParser().parseFromString("<body>" + String(html || ""), "text/html");
    return (doc.body.textContent || "").trim();
  }
  function paintMag(posts) {
    var section = document.getElementById("home-mag"); var list = document.getElementById("home-mag-list");
    if (!section || !list) return;
    var valid = posts.filter(function (post) { return post.title && post.link; }).slice(0, 3);
    if (!valid.length) return;
    var formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", day: "numeric", month: "long", year: "numeric" });
    list.replaceChildren.apply(list, valid.map(function (post) {
      var li = document.createElement("li");
      var card = document.createElement("a"); card.className = "mag-card"; card.href = post.link;
      var media = document.createElement("span"); media.className = "mag-card-media";
      if (post.image) { var image = document.createElement("img"); image.src = post.image; image.alt = ""; image.loading = "lazy"; media.appendChild(image); }
      var body = document.createElement("span"); body.className = "mag-card-body";
      var title = document.createElement("strong"); title.textContent = post.title;
      body.appendChild(title);
      if (post.date && Number.isFinite(post.date.getTime())) { var date = document.createElement("small"); date.textContent = formatter.format(post.date); body.appendChild(date); }
      card.append(media, body); li.appendChild(card); return li;
    }));
    section.hidden = false;
  }
  function loadMag() {
    if (typeof DOMParser !== "function" || typeof URL !== "function") return;
    getJson("/mag/wp-json/wp/v2/posts?per_page=3&_embed=wp:featuredmedia", { headers: { Accept: "application/json" } }).then(function (posts) {
      if (!Array.isArray(posts)) throw new Error("shape");
      return posts.map(function (post) {
        var media = post._embedded && post._embedded["wp:featuredmedia"] && post._embedded["wp:featuredmedia"][0];
        return { title: plain(post.title && post.title.rendered), link: safeLink(post.link), date: new Date(post.date_gmt ? post.date_gmt + "Z" : post.date), image: media ? safeImage(media.source_url) : null };
      });
    }).catch(function () {
      return fetch("/mag/feed/").then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.text(); }).then(function (xml) {
        var doc = new DOMParser().parseFromString(xml, "application/xml");
        return Array.prototype.slice.call(doc.querySelectorAll("item")).map(function (item) {
          var pick = function (name) { var node = item.getElementsByTagName(name)[0]; return node ? node.textContent : ""; };
          var enclosure = item.getElementsByTagName("enclosure")[0];
          return { title: plain(pick("title")), link: safeLink(pick("link")), date: new Date(pick("pubDate")), image: enclosure ? safeImage(enclosure.getAttribute("url")) : null };
        });
      });
    }).then(function (posts) { if (posts) paintMag(posts); }).catch(function () { /* بخش مجله پنهان می‌ماند */ });
  }

  load();
  loadDaily();
  loadMag();

  /* ── تازه‌سازی دوره‌ای ───────────────────────────────────────────
     جدول صفحهٔ اول فقط یک‌بار موقع لود پر می‌شد و تا رفرش دستی همان
     اعداد می‌ماند. تبِ پنهان و صفحهٔ رهاشده درخواستی نمی‌سازند، پس
     سهمیهٔ BrsApi جای نگرانی ندارد؛ کش سرور هم مشترک است. */
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
    var DAILY_REFRESH = 30 * 60000;
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
      load();
      if (Date.now() - lastDaily > DAILY_REFRESH) loadDaily();
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
}());
