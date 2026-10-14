/* رفتارهای مشترک همهٔ صفحه‌ها: علامت‌گذاری صفحهٔ فعال در منو، سال
   شمسی فوتر و دکمهٔ اشتراک‌گذاری صفحهٔ دارایی. */
(function () {
  "use strict";
  if (typeof document === "undefined" || !document.querySelectorAll) return;

  /* هر آدرس به یک بخش منو تعلق دارد. صفحهٔ دسته و دارایی‌های آن هر دو
     زیر همان دسته علامت می‌خورند، و دسته‌هایی که در منو جا ندارند
     (فلزات، انرژی) زیر «قیمت‌ها». */
  function sectionFor(pathname) {
    var path = String(pathname || "/");
    if (/^\/convert(\/|$)/.test(path)) return "/convert/";
    if (/^\/mag(\/|$)/.test(path)) return "/mag/";
    var match = path.match(/^\/price\/([a-z]+)(\/|$)/);
    if (match && ["currency", "gold", "coin", "crypto"].indexOf(match[1]) >= 0) return "/price/" + match[1] + "/";
    if (/^\/price(\/|$)/.test(path)) return "/price/";
    return "";
  }

  var current = sectionFor(location.pathname);
  Array.prototype.forEach.call(document.querySelectorAll(".site-nav a"), function (link) {
    if (link.getAttribute("href") === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  /* منوی موبایل: دکمهٔ سه‌خط فهرست را زیر هدر باز می‌کند. با Escape،
     کلیک بیرون از هدر یا انتخاب یک گزینه بسته می‌شود. */
  var header = document.querySelector(".site-header");
  var toggle = document.getElementById("menu-toggle");
  if (header && toggle) {
    var setOpen = function (open) {
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
    };
    toggle.addEventListener("click", function () { setOpen(!header.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && header.classList.contains("menu-open")) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", function (event) {
      if (header.classList.contains("menu-open") && !header.contains(event.target)) setOpen(false);
    });
    Array.prototype.forEach.call(header.querySelectorAll(".site-nav a"), function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
  }

  try {
    var year = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", { timeZone: "Asia/Tehran", year: "numeric" }).format(new Date());
    Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (node) { node.textContent = year; });
  } catch (error) { /* سال ثابت داخل HTML می‌ماند */ }

  var share = document.getElementById("asset-share");
  var feedback = document.getElementById("asset-share-feedback");
  if (share) {
    share.addEventListener("click", function () {
      var url = location.origin + location.pathname;
      var title = document.title;
      function say(message) {
        if (!feedback) return;
        feedback.textContent = message;
        setTimeout(function () { feedback.textContent = ""; }, 2600);
      }
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () { /* کاربر لغو کرد */ });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { say("پیوند صفحه کپی شد"); }, function () { say("کپی پیوند ممکن نشد"); });
      } else {
        say(url);
      }
    });
  }
}());
