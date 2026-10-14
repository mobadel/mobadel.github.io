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

  // نوار منو در موبایل افقی اسکرول می‌خورد؛ گزینهٔ فعال باید دیده شود.
  var active = document.querySelector(".site-nav a[aria-current]");
  if (active && active.scrollIntoView && window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
    try { active.scrollIntoView({ block: "nearest", inline: "center" }); } catch (error) { /* قدیمی */ }
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
