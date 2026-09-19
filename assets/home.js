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

  var definitions = [
    { id: "usd", name: "دلار", code: "USD", url: "/price/currency/usd/", icon: "/assets/flags/us.svg", source: "proxy" },
    { id: "usdt", name: "تتر", code: "USDT", url: "/price/crypto/usdt/", icon: "/assets/usdt-logo.svg", source: "toman" },
    { id: "gold18", name: "طلای ۱۸ عیار", code: "هر گرم", url: "/price/gold/gold18/", icon: "/assets/gold-18k.svg", source: "proxy" },
    { id: "emami", name: "سکه امامی", code: "هر عدد", url: "/price/coin/emami/", icon: "/assets/coin-emami.webp?v=20260825-2", source: "proxy" },
    { id: "btc", name: "بیت کوین", code: "BTC", url: "/price/crypto/btc/", icon: "/assets/crypto-icons/btc.svg", source: "usdt" },
    { id: "eur", name: "یورو", code: "EUR", url: "/price/currency/eur/", icon: "/assets/flags/eu.svg", source: "proxy" }
  ];

  function getJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (response) {
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

  function paint(stats, proxy) {
    rows.replaceChildren();
    definitions.forEach(function (definition) {
      var price = NaN; var change = NaN; var unit = "تومان";
      if (definition.source === "proxy") {
        var proxyRow = proxy && proxy.assets && proxy.assets[definition.id];
        price = Number(proxyRow && proxyRow.toman); change = Number(proxyRow && proxyRow.change);
      } else if (definition.source === "toman") {
        var tomanRow = stats && stats.stats && stats.stats[definition.id + "-rls"];
        price = Number(tomanRow && tomanRow.latest) / 10; change = Number(tomanRow && tomanRow.dayChange);
      } else {
        var usdtRow = stats && stats.stats && stats.stats[definition.id + "-usdt"];
        price = Number(usdtRow && usdtRow.latest); change = Number(usdtRow && usdtRow.dayChange); unit = "تتر";
      }

      var link = document.createElement("a"); link.className = "home-market-row"; link.href = definition.url;
      var identity = document.createElement("span"); identity.className = "home-market-identity";
      var icon = document.createElement("span"); icon.className = "home-market-icon";
      var image = document.createElement("img"); image.src = definition.icon; image.alt = ""; icon.appendChild(image);
      var label = document.createElement("span"); label.className = "home-market-label";
      var strong = document.createElement("strong"); strong.textContent = definition.name;
      var small = document.createElement("small"); small.textContent = definition.code;
      label.append(strong, small); identity.append(icon, label);
      var priceCell = document.createElement("span"); priceCell.className = "home-market-price";
      priceCell.textContent = Number.isFinite(price) && price > 0 ? number(price, price < 1 ? 6 : 0) + " " + unit : "ناموجود";
      var changeCell = document.createElement("span"); changeCell.className = "home-market-change " + (change > 0 ? "positive" : change < 0 ? "negative" : "neutral"); changeCell.textContent = changeText(change);
      link.append(identity, priceCell, changeCell); rows.appendChild(link);
    });
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
      paint(results[0].status === "fulfilled" ? results[0].value : null, proxy);
    });
  }

  load();

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
