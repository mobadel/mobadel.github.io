/* دارایی‌هایی که قیمتشان به دستور کارگروه تعیین مصادیق محتوای مجرمانه
   موقتاً در سایت نمایش داده نمی‌شود: دلار، یورو، پوند و دلار کانادا.

   فقط نمایش پنهان می‌شود. سرور (api/rates.php، تاریخچه، کرون‌ها) مثل
   قبل نرخ را می‌گیرد و ذخیره می‌کند تا با برداشته شدن محدودیت، با حذف
   همین فهرست همه‌چیز سر جایش برگردد.

   این فایل باید پیش از app.js، home.js، price.js، btc-chart.js و
   asset-insights.js بارگذاری شود؛ همهٔ آن‌ها از window.TabdexRestricted
   می‌پرسند. برای برداشتن محدودیت IDS و GROUPS را خالی کنید. */
(function (root) {
  "use strict";

  var IDS = { usd: true, eur: true, gbp: true, cad: true };
  /* گروه کامل (مثلاً { gold: true }) هم پشتیبانی می‌شود؛ فعلاً هیچ گروهی کامل پنهان نیست. */
  var GROUPS = {};

  var MASK = "***";
  var NOTICE = "قیمت این دارایی به دستور کارگروه تعیین مصادیق محتوای مجرمانه موقتاً نمایش داده نمی‌شود.";

  function is(id, group) {
    if (id && typeof id === "object") { group = id.group; id = id.id; }
    return !!((id && IDS[id]) || (group && GROUPS[group]));
  }

  /* فقط آیکون «!»؛ متن هشدار با هاور، فوکوس یا کلیک در یک کادر شناور
     می‌آید و بعد پنهان می‌شود. آیکون اغلب داخل لینک (کارت یا ردیف) است،
     پس دکمهٔ واقعی نیست و کلیک رویش لینک را باز نمی‌کند. */
  function notice() {
    var doc = root.document;
    var icon = doc.createElement("span");
    icon.className = "restricted-note";
    icon.setAttribute("role", "button"); icon.setAttribute("tabindex", "0");
    icon.setAttribute("aria-label", NOTICE); icon.setAttribute("data-restricted-tip", "");
    icon.textContent = "!";
    return icon;
  }

  /* «***» به‌جای عدد، و آیکون کنارش. */
  function price() {
    var doc = root.document;
    var wrap = doc.createElement("span");
    wrap.className = "restricted-price";
    var mask = doc.createElement("span");
    mask.className = "restricted-mask num"; mask.textContent = MASK;
    mask.setAttribute("aria-label", "قیمت نمایش داده نمی‌شود");
    wrap.append(mask, notice());
    return wrap;
  }

  /* همان ساختار برای HTML ایستا (scripts/build-pages.mjs). */
  function noticeHtml() {
    return '<span class="restricted-note" role="button" tabindex="0" aria-label="' + NOTICE + '" data-restricted-tip>!</span>';
  }
  function priceHtml() {
    return '<span class="restricted-price"><span class="restricted-mask num" aria-label="قیمت نمایش داده نمی‌شود">' + MASK + "</span>" + noticeHtml() + "</span>";
  }

  /* ── کادر شناور ─────────────────────────────────────────────────
     یک کادر برای کل صفحه که به body اضافه می‌شود، تا overflow ردیف‌ها و
     کارت‌ها آن را نبرد. */
  var tip = null; var owner = null; var pinned = false; var hideTimer = null;
  function ensureTip() {
    if (tip) return tip;
    tip = root.document.createElement("div");
    tip.className = "restricted-tip"; tip.setAttribute("role", "tooltip"); tip.textContent = NOTICE; tip.hidden = true;
    root.document.body.appendChild(tip);
    return tip;
  }
  function show(icon, sticky) {
    var box = ensureTip(); owner = icon; pinned = !!sticky;
    if (hideTimer) { root.clearTimeout(hideTimer); hideTimer = null; }
    box.hidden = false;
    var r = icon.getBoundingClientRect(); var w = box.offsetWidth; var h = box.offsetHeight; var vw = root.innerWidth;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    var top = r.top - h - 8; var below = top < 8; if (below) top = r.bottom + 8;
    box.style.left = (left + root.scrollX) + "px"; box.style.top = (top + root.scrollY) + "px";
    box.classList.toggle("is-below", below);
    // کلیک در موبایل هاوری ندارد که تمام شود؛ کادر خودش بعد از چند ثانیه می‌رود.
    if (sticky) hideTimer = root.setTimeout(hide, 4000);
  }
  function hide() {
    if (hideTimer) { root.clearTimeout(hideTimer); hideTimer = null; }
    if (tip) tip.hidden = true; owner = null; pinned = false;
  }
  function iconFrom(event) { var t = event.target; return t && t.closest ? t.closest("[data-restricted-tip]") : null; }

  if (root && root.document && typeof root.document.addEventListener === "function") {
    var doc = root.document;
    doc.addEventListener("mouseover", function (event) { var icon = iconFrom(event); if (icon && !pinned) show(icon, false); }, true);
    doc.addEventListener("mouseout", function (event) { var icon = iconFrom(event); if (icon && icon === owner && !pinned) hide(); }, true);
    doc.addEventListener("focusin", function (event) { var icon = iconFrom(event); if (icon) show(icon, false); });
    doc.addEventListener("focusout", function (event) { if (iconFrom(event) && !pinned) hide(); });
    doc.addEventListener("click", function (event) {
      var icon = iconFrom(event);
      if (!icon) { if (owner) hide(); return; }
      event.preventDefault(); event.stopPropagation();
      if (owner === icon && pinned) hide(); else show(icon, true);
    }, true);
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { hide(); return; }
      var icon = iconFrom(event);
      if (icon && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); if (owner === icon && pinned) hide(); else show(icon, true); }
    }, true);
    if (typeof root.addEventListener === "function") {
      root.addEventListener("scroll", function () { if (owner) hide(); }, true);
      root.addEventListener("resize", function () { if (owner) hide(); });
    }
  }

  var api = { MASK: MASK, NOTICE: NOTICE, is: is, notice: notice, price: price, noticeHtml: noticeHtml, priceHtml: priceHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TabdexRestricted = api;
}(typeof window !== "undefined" ? window : null));
