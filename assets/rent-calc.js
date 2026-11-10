/* ماشین حساب تبدیل رهن و اجاره (/convert/rahn-ejare/)
   رهن کامل = رهن + اجارهٔ ماهانه ÷ نرخ ماهانه. مبدا رهن کامل را می‌سازد و
   در مقصد هر فیلدی که کاربر دست بزند ثابت می‌ماند و دیگری محاسبه می‌شود.
   گیج پایین همان مقصد را با کشیدن بین «اجارهٔ کامل» و «رهن کامل» جابه‌جا می‌کند. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  var fa = function (s) { return String(s).replace(/\d/g, function (d) { return FA[d]; }); };
  var toEn = function (s) {
    return String(s)
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); });
  };
  var digits = function (el) { return toEn(el.value).replace(/[^\d]/g, ""); };
  var parse = function (el) { var v = digits(el); return v ? Number(v) : 0; };
  var sep = function (n) { return fa(Math.round(n).toLocaleString("en-US").replace(/,/g, "٬")); };

  function words(n) {
    n = Math.round(n);
    if (!n) return "";
    var parts = [];
    var units = [[1e12, "هزار میلیارد"], [1e9, "میلیارد"], [1e6, "میلیون"], [1e3, "هزار"]];
    units.forEach(function (u) {
      var q = Math.floor(n / u[0]);
      if (q) { parts.push(fa(q) + " " + u[1]); n -= q * u[0]; }
    });
    if (n) parts.push(fa(n));
    return parts.join(" و ") + " تومان";
  }

  var ids = ["src-rahn", "src-ejare", "dst-rahn", "dst-ejare"];
  var el = {};
  ids.forEach(function (id) { el[id] = $(id); });
  var gauge = $("rent-gauge");
  var rateChips = document.querySelectorAll("[data-rate]");
  var rate = 0.03;
  var fixed = "rahn"; // فیلد مقصدی که کاربر تعیین کرده

  function setField(input, n) {
    input.value = n > 0 ? sep(n) : (input.dataset.touched ? "۰" : "");
  }

  function markComputed() {
    $("dst-rahn-control").classList.toggle("output-control", fixed !== "rahn");
    $("dst-ejare-control").classList.toggle("output-control", fixed !== "ejare");
    $("dst-rahn-tag").hidden = fixed === "rahn";
    $("dst-ejare-tag").hidden = fixed === "ejare";
  }

  function render() {
    var total = parse(el["src-rahn"]) + parse(el["src-ejare"]) / rate;
    var warn = $("rent-warn");
    warn.hidden = true;

    $("rent-total").innerHTML = total
      ? 'رهن کامل: <span class="num">' + sep(total) + "</span> تومان"
      : "مبلغ فعلی را وارد کنید";
    $("rent-full-rahn").textContent = total ? words(total) : "—";
    $("rent-full-ejare").textContent = total ? words(total * rate) : "—";

    if (total) {
      if (fixed === "rahn") {
        var r = parse(el["dst-rahn"]);
        if (r > total) { warn.textContent = "رهن واردشده از رهن کامل بیشتر است؛ اجاره صفر در نظر گرفته شد."; warn.hidden = false; }
        setField(el["dst-ejare"], Math.max(0, (total - r) * rate));
      } else {
        var e = parse(el["dst-ejare"]);
        if (e / rate > total) { warn.textContent = "اجارهٔ واردشده از اجارهٔ کامل بیشتر است؛ رهن صفر در نظر گرفته شد."; warn.hidden = false; }
        setField(el["dst-rahn"], Math.max(0, total - e / rate));
      }
    }
    markComputed();
    syncGauge(total);
    ids.forEach(function (id) { $(id + "-words").textContent = words(parse(el[id])); });
  }

  function syncGauge(total) {
    gauge.disabled = !total;
    var share = total ? Math.min(1, parse(el["dst-rahn"]) / total) : 0;
    gauge.value = String(Math.round(share * 1000));
    gauge.style.setProperty("--fill", (share * 100).toFixed(2) + "%");
    gauge.setAttribute("aria-valuetext", fa(Math.round(share * 100)) + " درصد رهن");
    $("gauge-rahn-pct").textContent = fa(Math.round(share * 100)) + "٪";
    $("gauge-ejare-pct").textContent = fa(100 - Math.round(share * 100)) + "٪";
  }

  function onType(event) {
    var input = event.target;
    input.dataset.touched = "1";
    input.value = digits(input) ? sep(parse(input)) : "";
  }

  el["src-rahn"].addEventListener("input", function (e) { onType(e); render(); });
  el["src-ejare"].addEventListener("input", function (e) { onType(e); render(); });
  el["dst-rahn"].addEventListener("input", function (e) { onType(e); fixed = "rahn"; render(); });
  el["dst-ejare"].addEventListener("input", function (e) { onType(e); fixed = "ejare"; render(); });

  gauge.addEventListener("input", function () {
    var total = parse(el["src-rahn"]) + parse(el["src-ejare"]) / rate;
    if (!total) return;
    var share = Number(gauge.value) / 1000;
    // گام گرد: یک میلیون تومان، و برای مبلغ‌های کوچک صد هزار تومان
    var step = total >= 1e8 ? 1e6 : 1e5;
    var rahn = share >= 1 ? total : Math.round((total * share) / step) * step;
    el["dst-rahn"].dataset.touched = el["dst-ejare"].dataset.touched = "1";
    setField(el["dst-rahn"], Math.min(total, rahn));
    fixed = "rahn";
    render();
  });

  Array.prototype.forEach.call(rateChips, function (chip) {
    chip.addEventListener("click", function () {
      rate = Number(chip.getAttribute("data-rate")) / 100;
      Array.prototype.forEach.call(rateChips, function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      $("rent-rate-note").textContent = "هر ۱ میلیون تومان رهن = " + sep(1e6 * rate) + " تومان اجارهٔ ماهانه";
      render();
    });
  });

  $("rent-reset").addEventListener("click", function () {
    ids.forEach(function (id) { el[id].value = ""; delete el[id].dataset.touched; });
    fixed = "rahn";
    render();
    el["src-rahn"].focus();
  });

  render();
}());
