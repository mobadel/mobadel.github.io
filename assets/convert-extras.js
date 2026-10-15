/* بخش‌های کمکی مبدل: دکمه‌های مبلغ سریع، جدول تبدیل دوطرفه و خلاصهٔ
   روزهای اخیر. app.js بعد از هر رندر رویداد «tabdex:pair» را با جفت و
   نرخ فعلی می‌فرستد؛ این فایل فقط همان را می‌خواند و به منطق مبدل دست
   نمی‌زند. */
(function () {
  "use strict";
  if (typeof document === "undefined" || !document.getElementById) return;

  var input = document.getElementById("amount-from");
  var quick = document.getElementById("quick-amounts");
  var tables = document.getElementById("conversion-tables");
  var grid = document.getElementById("conversion-grid");
  var tablesTitle = document.getElementById("conversion-tables-title");
  var insights = document.getElementById("converter-insights");

  function format(value, digits) {
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(value);
  }
  function smartFormat(value, currency) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "۰";
    if (value < 0.0001) return format(value, 10);
    if (value < 1) return format(value, 6);
    if (currency && currency.group === "crypto") return format(value, value < 100 ? 6 : 4);
    if (value < 100) return format(value, 2);
    return format(value, currency && currency.decimals ? Math.min(2, currency.decimals) : 0);
  }
  function label(currency) { return (currency.unit ? currency.unit + " " : "") + currency.name; }

  /* مبلغ سریع همان مسیر تایپ کاربر را طی می‌کند: مقدار در فیلد نوشته
     و رویداد input فرستاده می‌شود، پس قالب‌بندی و آدرس صفحه دقیقاً مثل
     ورود دستی رفتار می‌کنند. */
  if (quick && input) {
    quick.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-amount]") : null;
      if (!button) return;
      input.value = format(Number(button.getAttribute("data-amount")), 0);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      Array.prototype.forEach.call(quick.querySelectorAll("[data-amount]"), function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
    });
    input.addEventListener("input", function (event) {
      if (event.isTrusted === false) return;
      Array.prototype.forEach.call(quick.querySelectorAll("[data-amount]"), function (item) { item.removeAttribute("aria-pressed"); });
    });
  }

  function steps(rate) {
    // پله‌ها با بزرگی نرخ مقیاس می‌گیرند تا جدول عددهای معنادار داشته باشد:
    // «۱۰۰ هزار تومان به دلار» نه «۱ تومان به دلار».
    var base = rate >= 1 ? 1 : Math.pow(10, Math.ceil(Math.log10(1 / rate)) - 1);
    return [1, 5, 10, 50, 100, 500, 1000].map(function (value) { return value * base; });
  }

  function buildTable(fromCurrency, toCurrency, rate) {
    var table = document.createElement("table"); table.className = "conversion-table";
    var head = document.createElement("thead"); var headRow = document.createElement("tr");
    [fromCurrency, toCurrency].forEach(function (currency) {
      var th = document.createElement("th"); th.scope = "col";
      th.textContent = currency.name + (currency.code && currency.code !== currency.name ? " (" + currency.code + ")" : "");
      headRow.appendChild(th);
    });
    head.appendChild(headRow); table.appendChild(head);
    var body = document.createElement("tbody");
    steps(rate).forEach(function (amount) {
      var row = document.createElement("tr");
      var a = document.createElement("td"); a.textContent = smartFormat(amount, fromCurrency) + " " + label(fromCurrency);
      var b = document.createElement("td"); b.textContent = smartFormat(amount * rate, toCurrency) + " " + label(toCurrency);
      row.append(a, b); body.appendChild(row);
    });
    table.appendChild(body);
    return table;
  }

  function paintTables(detail) {
    if (!tables || !grid) return;
    if (!detail.rate) { tables.hidden = true; return; }
    if (tablesTitle) tablesTitle.textContent = "جدول تبدیل " + detail.from.name + " و " + detail.to.name;
    grid.replaceChildren(buildTable(detail.from, detail.to, detail.rate), buildTable(detail.to, detail.from, 1 / detail.rate));
    tables.hidden = false;
  }

  /* خلاصهٔ روزهای اخیر فقط برای دارایی‌هایی که سرور تاریخچه‌شان را
     نگه می‌دارد معنا دارد: ارز، طلا، سکه و فلزات در برابر تومان. */
  var historyCache = {};
  function loadDaily(id) {
    if (historyCache[id]) return historyCache[id];
    historyCache[id] = fetch("/api/history.php?assets=" + encodeURIComponent(id) + "&days=40", { headers: { Accept: "application/json" } })
      .then(function (response) { if (!response.ok) throw new Error("http_" + response.status); return response.json(); })
      .then(function (payload) { return (payload && payload.assets && payload.assets[id]) || []; })
      .catch(function () { delete historyCache[id]; return []; });
    return historyCache[id];
  }

  var HISTORY_GROUPS = { fiat: true, gold: true, coin: true, commodity: true };
  var insightToken = 0;

  function insightItem(title, value, tone) {
    var item = document.createElement("div");
    var span = document.createElement("span"); span.textContent = title;
    var strong = document.createElement("strong"); strong.textContent = value;
    if (tone) strong.className = tone;
    item.append(span, strong);
    return item;
  }

  function percent(now, before) {
    if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) return null;
    return (now - before) / before * 100;
  }
  function percentText(value) { return value === null ? "—" : (value > 0 ? "+" : "") + format(value, 2) + "٪"; }
  function tone(value) { return value === null ? "neutral" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral"; }

  function paintInsights(detail) {
    if (!insights) return;
    var token = ++insightToken;
    var asset = detail.to.id === "irt" ? detail.from : detail.from.id === "irt" ? detail.to : null;
    if (!asset || asset.id === "goldounce" || !HISTORY_GROUPS[asset.group] || !detail.rate) { insights.hidden = true; return; }
    var live = detail.to.id === "irt" ? detail.rate : 1 / detail.rate;
    loadDaily(asset.id).then(function (points) {
      if (token !== insightToken) return;
      if (!points || points.length < 2) { insights.hidden = true; return; }
      var now = Date.now() / 1000;
      var todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
      var dayKey = function (time) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date(time * 1000)); };
      // «دیروز» یعنی آخرین روز معاملاتیِ پیش از امروز، نه لزوماً تقویم دیروز.
      var previous = null;
      for (var i = points.length - 1; i >= 0; i -= 1) { if (dayKey(points[i][0]) !== todayKey) { previous = points[i]; break; } }
      var monthAgo = null;
      for (var j = points.length - 1; j >= 0; j -= 1) { if (points[j][0] <= now - 30 * 86400) { monthAgo = points[j]; break; } }
      var dayChange = previous ? percent(live, previous[1]) : null;
      var monthChange = monthAgo ? percent(live, monthAgo[1]) : null;
      var items = [];
      if (previous) items.push(insightItem("پایانی آخرین روز معاملاتی", smartFormat(previous[1], { group: asset.group, decimals: 0 }) + " تومان"));
      if (dayChange !== null) items.push(insightItem("تغییر نسبت به آن روز", percentText(dayChange), tone(dayChange)));
      if (monthChange !== null) items.push(insightItem("تغییر ۳۰ روزه", percentText(monthChange), tone(monthChange)));
      if (!items.length) { insights.hidden = true; return; }
      insights.replaceChildren.apply(insights, items);
      insights.hidden = false;
    });
  }

  /* عدد بلند نباید از لبهٔ فیلد بیرون بزند (۲٬۳۵۱٬۸۸۰٬۰۰۰ در موبایل).
     اندازهٔ قلم به اندازهٔ طبیعی برمی‌گردد و اگر عدد جا نشد به نسبت کوچک
     می‌شود؛ کمترین اندازه ۱۵ پیکسل است. */
  var fields = [input, document.getElementById("amount-to")].filter(Boolean);
  function fitField(field) {
    field.style.fontSize = "";
    if (!field.clientWidth || field.scrollWidth <= field.clientWidth) return;
    var size = parseFloat(window.getComputedStyle(field).fontSize) || 28;
    field.style.fontSize = Math.max(15, Math.floor(size * field.clientWidth / field.scrollWidth) - 1) + "px";
  }
  function fitFields() { fields.forEach(fitField); }
  document.addEventListener("input", function (event) { if (fields.indexOf(event.target) >= 0) fitFields(); });
  window.addEventListener("resize", fitFields);

  document.addEventListener("tabdex:pair", function (event) {
    fitFields();
    var detail = event.detail;
    if (!detail || !detail.from || !detail.to) return;
    paintTables(detail);
    paintInsights(detail);
  });
}());
