/* آمار چندروزه و جدول روزهای اخیر صفحهٔ دارایی. فقط برای ارز، طلا،
   سکه و فلزات که سرور قیمت پایانی روزانه‌شان را نگه می‌دارد؛ رمزارز،
   انرژی و انس جهانی (دلاری) بی‌صدا رد می‌شوند و این بخش‌ها پنهان
   می‌مانند. */
(function () {
  "use strict";
  if (typeof document === "undefined" || !document.getElementById) return;

  var route = location.pathname.match(/^\/price\/(currency|gold|coin|commodity)\/([a-z0-9]+)\/?$/);
  if (!route) return;
  var SLUG_TO_ID = { melted: "goldmelted", ounce: "goldounce", baharazadi: "bahar", nim: "halfcoin", rob: "quartercoin", gerami: "gramcoin" };
  var id = SLUG_TO_ID[route[2]] || route[2];
  if (id === "goldounce") return;
  // دلار، یورو، پوند و دلار کانادا به دستور کارگروه: آمار و جدول روزانه (که قیمت دارند) ساخته نمی‌شوند.
  if (window.TabdexRestricted && window.TabdexRestricted.is(id, route[1])) return;

  var statsBox = document.getElementById("asset-stats");
  var daysBox = document.getElementById("asset-days");
  var daysRows = document.getElementById("asset-days-rows");
  if (!statsBox && !daysBox) return;

  var number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
  var percent = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
  var dayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", day: "numeric", month: "long", year: "numeric" });

  function change(now, before) { return Number.isFinite(now) && Number.isFinite(before) && before > 0 ? (now - before) / before * 100 : null; }
  function changeText(value) { return value === null ? "—" : (value > 0 ? "+" : "") + percent.format(value) + "٪"; }
  function tone(value) { return value === null ? "neutral" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral"; }
  function pointAtOrBefore(points, time) { for (var i = points.length - 1; i >= 0; i -= 1) if (points[i][0] <= time) return points[i]; return null; }

  function stat(label, value, className) {
    var item = document.createElement("div"); item.className = "asset-stat";
    var small = document.createElement("small"); small.textContent = label;
    var strong = document.createElement("strong"); strong.textContent = value; if (className) strong.className = className;
    item.append(small, strong); return item;
  }

  function render(points) {
    if (!points || points.length < 2) return;
    // جملهٔ ثبت تاریخچه فقط وقتی نمایش داده می‌شود که واقعاً تاریخچه‌ای رسیده باشد.
    var historyNote = document.getElementById("data-source-history"); if (historyNote) historyNote.hidden = false;
    var last = points[points.length - 1]; var now = last[0];
    var week = points.filter(function (point) { return point[0] > now - 7 * 86400; }).map(function (point) { return point[1]; });
    var year = points.filter(function (point) { return point[0] > now - 365 * 86400; }).map(function (point) { return point[1]; });
    var monthPoint = pointAtOrBefore(points, now - 30 * 86400);
    var yearPoint = points[0][0] <= now - 330 * 86400 ? pointAtOrBefore(points, now - 365 * 86400) || points[0] : null;
    var items = [];
    if (week.length > 1) {
      items.push(stat("بیشترین ۷ روز", number.format(Math.max.apply(null, week))));
      items.push(stat("کمترین ۷ روز", number.format(Math.min.apply(null, week))));
    }
    if (monthPoint) { var month = change(last[1], monthPoint[1]); items.push(stat("تغییر ۳۰ روزه", changeText(month), tone(month))); }
    if (yearPoint) { var annual = change(last[1], yearPoint[1]); items.push(stat("تغییر یک‌ساله", changeText(annual), tone(annual))); }
    if (year.length > 30) items.push(stat("بیشترین در یک سال", number.format(Math.max.apply(null, year))));
    if (statsBox && items.length) { statsBox.replaceChildren.apply(statsBox, items); statsBox.hidden = false; }

    if (daysBox && daysRows) {
      var recent = points.slice(-11);
      var rows = [];
      for (var i = recent.length - 1; i >= 1; i -= 1) {
        var row = document.createElement("tr");
        var date = document.createElement("td"); date.textContent = dayFormatter.format(new Date(recent[i][0] * 1000));
        var value = document.createElement("td"); value.className = "num"; value.textContent = number.format(recent[i][1]);
        var delta = change(recent[i][1], recent[i - 1][1]);
        var cell = document.createElement("td"); cell.textContent = changeText(delta); cell.className = "num " + tone(delta);
        row.append(date, value, cell); rows.push(row);
      }
      if (rows.length) { daysRows.replaceChildren.apply(daysRows, rows); daysBox.hidden = false; }
      bindCsv(points);
    }
  }

  /* همهٔ قیمت‌های پایانی روزانهٔ دریافت‌شده (تا ۴۰۰ روز) به‌صورت CSV.
     BOM اول فایل لازم است تا اکسل متن فارسی را درست باز کند. */
  var csvPoints = [];
  function bindCsv(points) {
    csvPoints = points;
    var button = document.getElementById("asset-days-csv");
    if (!button || button.dataset.bound) return; button.dataset.bound = "1";
    button.addEventListener("click", function () {
      var iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" });
      var jalali = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" });
      var lines = ["date,jalali_date,close_toman"].concat(csvPoints.map(function (point) {
        var date = new Date(point[0] * 1000);
        return iso.format(date) + "," + jalali.format(date).replace(/[^0-9/]/g, "") + "," + point[1];
      }));
      var blob = new Blob(["\ufeff" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
      var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "tabdex-" + id + "-daily.csv";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    });
  }

  fetch("/api/history.php?assets=" + encodeURIComponent(id) + "&days=400", { headers: { Accept: "application/json" } })
    .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
    .then(function (payload) {
      var points = (payload && payload.assets && payload.assets[id] || []).map(function (point) { return [Number(point[0]), Number(point[1])]; })
        .filter(function (point) { return point[0] > 0 && point[1] > 0; });
      render(points);
    })
    .catch(function () { /* بخش‌ها پنهان می‌مانند */ });
}());
