/* ماشین حساب تبدیل رهن و اجاره (/convert/rahn-ejare/)
   رهن کامل = رهن + اجارهٔ ماهانه ÷ نرخ ماهانه. مبدا رهن کامل را می‌سازد و
   در مقصد هر فیلدی که کاربر دست بزند ثابت می‌ماند و دیگری محاسبه می‌شود.
   گیج پایین همان مقصد را با کشیدن بین «اجارهٔ کامل» و «رهن کامل» جابه‌جا می‌کند.
   فیلدهای رهن data-scale="1000000" دارند: عدد به میلیون تومان وارد و نمایش
   داده می‌شود (۱۰۰۰ یعنی یک میلیارد)، ولی همهٔ محاسبه‌ها به تومان است. */
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
  var scale = function (el) { return Number(el.getAttribute("data-scale")) || 1; };
  // ورودی پاک‌شده: فقط رقم و (برای فیلدهای میلیونی) یک ممیز
  var clean = function (el) {
    var v = toEn(el.value).replace(/[٫\/,]/g, function (c) { return c === "," ? "" : "."; });
    if (scale(el) === 1) return v.replace(/[^\d]/g, "");
    v = v.replace(/[^\d.]/g, "");
    var dot = v.indexOf(".");
    if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 3);
    return v;
  };
  var digits = clean;
  // مقدار به تومان
  var parse = function (el) { var v = clean(el); return v && v !== "." ? Number(v) * scale(el) : 0; };
  var sep = function (n) { return fa(Math.round(n).toLocaleString("en-US").replace(/,/g, "٬")); };
  // نمایش یک مبلغ تومانی در واحد فیلد؛ میلیونی‌ها تا سه رقم اعشار
  var display = function (el, toman) {
    var unit = scale(el);
    if (unit === 1) return sep(toman);
    var v = Math.round((toman / unit) * 1000) / 1000;
    var parts = String(v).split(".");
    return sep(Number(parts[0])) + (parts[1] ? "٫" + fa(parts[1]) : "");
  };

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
    input.value = n > 0 ? display(input, n) : (input.dataset.touched ? "۰" : "");
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
      ? 'رهن کامل: <span class="num">' + words(total).replace(/ تومان$/, "") + "</span> تومان"
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
    var v = clean(input);
    if (!v) { input.value = ""; return; }
    var dot = v.indexOf(".");
    var whole = dot >= 0 ? v.slice(0, dot) : v;
    // ممیز و رقم‌های اعشار همان‌طور که تایپ شده می‌مانند تا وسط تایپ «۱٫» پاک نشود
    input.value = sep(Number(whole || 0)) + (dot >= 0 ? "٫" + fa(v.slice(dot + 1)) : "");
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
