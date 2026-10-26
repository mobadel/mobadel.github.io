/* دارایی‌هایی که قیمتشان به دستور کارگروه تعیین مصادیق محتوای مجرمانه
   موقتاً در سایت نمایش داده نمی‌شود: دلار، کل گروه طلا و کل گروه سکه.

   فقط نمایش پنهان می‌شود. سرور (api/rates.php، تاریخچه، کرون‌ها) مثل
   قبل نرخ را می‌گیرد و ذخیره می‌کند تا با برداشته شدن محدودیت، با حذف
   همین فهرست همه‌چیز سر جایش برگردد.

   این فایل باید پیش از app.js، home.js، price.js، btc-chart.js و
   asset-insights.js بارگذاری شود؛ همهٔ آن‌ها از window.TabdexRestricted
   می‌پرسند. برای برداشتن محدودیت IDS و GROUPS را خالی کنید. */
(function (root) {
  "use strict";

  var IDS = { usd: true };
  var GROUPS = { gold: true, coin: true };
  /* گروهِ دارایی همه‌جا یکسان نام‌گذاری نشده (home.js طلا و سکه را با هم
     «metal» می‌نامد)، پس شناسه‌های این دو گروه هم صریحاً آمده‌اند. */
  var GROUP_IDS = {
    gold18: true, gold24: true, goldmelted: true, goldounce: true,
    emami: true, bahar: true, halfcoin: true, quartercoin: true, gramcoin: true
  };
  /* اسلاگ آدرس صفحه‌ها (مثلاً /price/coin/nim/) گاهی با شناسه فرق دارد. */
  var SLUG_IDS = { melted: "goldmelted", ounce: "goldounce", baharazadi: "bahar", nim: "halfcoin", rob: "quartercoin", gerami: "gramcoin" };

  var MASK = "***";
  var NOTICE = "قیمت این دارایی به دستور کارگروه تعیین مصادیق محتوای مجرمانه موقتاً نمایش داده نمی‌شود.";

  function is(id, group) {
    if (id && typeof id === "object") { group = id.group; id = id.id; }
    id = SLUG_IDS[id] || id;
    return !!((id && (IDS[id] || GROUP_IDS[id])) || (group && GROUPS[group]));
  }

  /* «!» کنار متن هشدار. compact فقط فاصله‌ها را کم می‌کند؛ متن همیشه
     دیده می‌شود. */
  function notice(compact) {
    var doc = root.document;
    var box = doc.createElement("span");
    box.className = "restricted-note" + (compact ? " is-compact" : "");
    box.setAttribute("role", "note");
    var icon = doc.createElement("span");
    icon.className = "restricted-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = "!";
    var text = doc.createElement("span");
    text.className = "restricted-text"; text.textContent = NOTICE;
    box.append(icon, text);
    return box;
  }

  /* «***» به‌جای عدد، و هشدار کنارش. */
  function price(compact) {
    var doc = root.document;
    var wrap = doc.createElement("span");
    wrap.className = "restricted-price";
    var mask = doc.createElement("span");
    mask.className = "restricted-mask num"; mask.textContent = MASK;
    mask.setAttribute("aria-label", "قیمت نمایش داده نمی‌شود");
    wrap.append(mask, notice(compact));
    return wrap;
  }

  /* همان ساختار برای HTML ایستا (scripts/build-pages.mjs). */
  function noticeHtml(compact) {
    return '<span class="restricted-note' + (compact ? " is-compact" : "") + '" role="note"><span class="restricted-icon" aria-hidden="true">!</span><span class="restricted-text">' + NOTICE + "</span></span>";
  }

  var api = { MASK: MASK, NOTICE: NOTICE, is: is, notice: notice, price: price, noticeHtml: noticeHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TabdexRestricted = api;
}(typeof window !== "undefined" ? window : null));
