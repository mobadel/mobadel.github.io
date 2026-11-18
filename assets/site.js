/* رفتارهای مشترک صفحه‌ها: منو، سال شمسی، اشتراک‌گذاری و پیش‌نمایش توضیحات. */
(function () {
  "use strict";
  if (typeof document === "undefined" || !document.querySelectorAll) return;

  /* هر آدرس به یک بخش منو تعلق دارد. صفحهٔ دسته و دارایی‌های آن هر دو
     زیر همان دسته علامت می‌خورند، و دسته‌هایی که در منو جا ندارند
     (فلزات، انرژی) زیر «قیمت‌ها». */
  function sectionFor(pathname) {
    var path = String(pathname || "/");
    if (/^\/convert\/rahn-ejare(\/|$)/.test(path)) return "/convert/rahn-ejare/";
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

  if (/^\/(price|convert)(\/|$)/.test(location.pathname)) {
    Array.prototype.forEach.call(document.querySelectorAll(
      "main > .pair-content, .asset-layout-main > .asset-content, main > .seo-content.cms-content"
    ), function (section, index) {
      var relatedLinks = section.querySelector(":scope > .pair-links");
      var preview = document.createElement("div");
      var body = document.createElement("div");
      var toggleContent = document.createElement("button");
      preview.id = "content-preview-" + (index + 1);
      preview.className = "content-preview";
      body.className = "content-preview-body";
      toggleContent.type = "button";
      toggleContent.className = "content-preview-toggle";
      toggleContent.setAttribute("aria-controls", preview.id);
      toggleContent.hidden = true;

      // پیوندهای جفت‌های مرتبط همچنان پایین کارت در دسترس‌اند.
      Array.from(section.childNodes).forEach(function (node) {
        if (node !== relatedLinks) body.appendChild(node);
      });
      preview.appendChild(body);
      section.insertBefore(preview, relatedLinks);
      section.insertBefore(toggleContent, relatedLinks);

      function checkOverflow() {
        if (preview.classList.contains("is-collapsed")) {
          toggleContent.hidden = preview.scrollHeight <= preview.clientHeight + 1;
        }
      }

      function setExpanded(expanded) {
        preview.classList.toggle("is-collapsed", !expanded);
        toggleContent.setAttribute("aria-expanded", String(expanded));
        toggleContent.textContent = expanded ? "نمایش کمتر" : "ادامه مطلب";
        if (!expanded) checkOverflow();
      }

      setExpanded(false);
      if (typeof ResizeObserver === "function") {
        new ResizeObserver(checkOverflow).observe(body);
      } else {
        window.addEventListener("resize", checkOverflow);
        window.addEventListener("load", checkOverflow);
      }

      toggleContent.addEventListener("click", function () {
        var expanded = toggleContent.getAttribute("aria-expanded") === "true";
        setExpanded(!expanded);
        if (expanded && !toggleContent.hidden) toggleContent.scrollIntoView({ block: "nearest" });
      });

      preview.addEventListener("focusin", function (event) {
        // پیوندی که با Tab فوکوس می‌گیرد باید بالاتر از ناحیهٔ محو باشد.
        if (!toggleContent.hidden && preview.classList.contains("is-collapsed") &&
            event.target.getBoundingClientRect().bottom > preview.getBoundingClientRect().bottom - 34) {
          setExpanded(true);
        }
      });
    });
  }

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
