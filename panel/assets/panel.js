(function () {
  "use strict";

  var CHUNK_SIZE = 1048576;
  var LIMITS = { image: 15728640, audio: 62914560, video: 262144000 };
  var STATUS = { auto: "متن خودکار", draft: "پیش‌نویس", published: "منتشرشده", changed: "تغییر منتشرنشده" };
  var TYPES = { category: "دسته و هاب", asset: "دارایی", convert: "مبدل" };
  var ACTIONS = { draft: "پیش‌نویس", publish: "انتشار", unpublish: "برداشتن از انتشار" };
  var ROLES = { admin: "مدیر", editor: "ویرایشگر" };
  var KINDS = { image: "عکس", video: "ویدیو", audio: "صوت" };

  var app = document.getElementById("app");
  var session = { user: null, csrf: null };
  var editorState = null;
  var skipGuard = false;
  var lastHash = "";

  /* همهٔ متن‌ها با textContent می‌نشینند تا نام کاربر یا فایل نتواند HTML تزریق کند. */
  function h(tag, props) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (value === undefined || value === null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), value);
      else if (key === "value" || key === "checked" || key === "disabled" || key === "hidden" || key === "selected") node[key] = value;
      else node.setAttribute(key, value);
    });
    for (var i = 2; i < arguments.length; i += 1) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child === undefined || child === null || child === false) return;
    if (Array.isArray(child)) child.forEach(function (item) { append(node, item); });
    else node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  function toast(message, isError) {
    var item = h("div", { class: "toast" + (isError ? " error" : ""), text: message });
    var box = document.getElementById("toasts");
    /* دیالوگ باز در top layer است و اعلان بیرون آن پشتش می‌ماند. */
    var open = document.querySelector("dialog[open]");
    (open || box).appendChild(item);
    if (open) { item.style.position = "sticky"; item.style.bottom = "0"; item.style.marginTop = "8px"; }
    setTimeout(function () { item.remove(); }, isError ? 7000 : 3500);
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));
  }

  function formatSize(bytes) {
    var mb = bytes / 1048576;
    return mb >= 1 ? mb.toFixed(1) + " مگابایت" : Math.max(1, Math.round(bytes / 1024)) + " کیلوبایت";
  }

  function api(action, options) {
    options = options || {};
    var query = new URLSearchParams(Object.assign({ action: action }, options.query || {}));
    var init = { credentials: "same-origin", headers: {} };
    if (options.body !== undefined || options.form) {
      init.method = "POST";
      if (session.csrf) init.headers["X-CSRF-Token"] = session.csrf;
      if (options.form) init.body = options.form;
      else { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); }
    }
    return fetch("api.php?" + query.toString(), init).then(function (response) {
      return response.json().catch(function () { return { ok: false, error: "پاسخ سرور قابل خواندن نیست." }; }).then(function (data) {
        if (data.ok) return data;
        if (response.status === 401 && session.user) {
          session.user = null;
          skipGuard = true;
          boot();
        }
        var error = new Error(data.error || "خطای ناشناخته");
        error.status = response.status;
        throw error;
      });
    });
  }

  function report(error) { toast(error.message || "خطایی رخ داد.", true); }

  function dialog(className) {
    var node = h("dialog", { class: className || "" });
    node.addEventListener("close", function () { node.remove(); });
    document.body.appendChild(node);
    return node;
  }

  function dialogHead(node, title) {
    return h("div", { class: "dialog-head" }, h("h2", { text: title }), h("button", { class: "btn small", type: "button", text: "بستن", onclick: function () { node.close(); } }));
  }

  function confirmBox(title, message, actionLabel) {
    return new Promise(function (resolve) {
      var node = dialog();
      var result = false;
      append(node, [
        h("h2", { text: title }),
        h("p", { text: message, style: "margin:8px 0 16px" }),
        h("div", { class: "dialog-foot" },
          h("button", { class: "btn", type: "button", text: "انصراف", onclick: function () { node.close(); } }),
          h("button", { class: "btn danger", type: "button", text: actionLabel, onclick: function () { result = true; node.close(); } }))
      ]);
      node.addEventListener("close", function () { resolve(result); });
      node.showModal();
    });
  }

  function field(label, control, hint) { return h("label", { class: "field" }, label, control, hint ? h("small", { text: hint }) : null); }

  /* ── ورود و راه‌اندازی ─────────────────────────────── */

  function authScreen(title, intro, fields, submitLabel, onSubmit) {
    var error = h("p", { class: "error-text" });
    var button = h("button", { class: "btn primary block", type: "submit", text: submitLabel });
    var form = h("form", { onsubmit: function (event) {
      event.preventDefault();
      button.disabled = true;
      error.textContent = "";
      onSubmit(new FormData(form)).catch(function (err) { error.textContent = err.message; button.disabled = false; });
    } }, fields, error, button);
    clear(app).appendChild(h("div", { class: "auth" }, h("div", { class: "auth-card" }, h("h1", { text: title }), h("p", { text: intro }), form)));
    var first = form.querySelector("input");
    if (first) first.focus();
  }

  function renderSetup(ready) {
    if (!ready) {
      clear(app).appendChild(h("div", { class: "auth" }, h("div", { class: "auth-card" },
        h("h1", { text: "پنل هنوز فعال نشده است" }),
        h("p", { text: "کلید راه‌اندازی روی سرور تعریف نشده است. سکرت PANEL_SETUP_TOKEN را در GitHub اضافه کنید و دیپلوی را دوباره اجرا کنید." }))));
      return;
    }
    authScreen("ساخت حساب مدیر", "اولین حساب پنل را بسازید. بعد از این، این صفحه دیگر در دسترس نیست.", [
      field("کلید راه‌اندازی", h("input", { name: "token", type: "password", required: true, dir: "ltr", autocomplete: "off" })),
      field("نام نمایشی", h("input", { name: "display_name", type: "text", required: true })),
      field("نام کاربری", h("input", { name: "username", type: "text", required: true, dir: "ltr", autocomplete: "username" })),
      field("رمز عبور", h("input", { name: "password", type: "password", required: true, dir: "ltr", autocomplete: "new-password", minlength: 10 }), "دست‌کم ۱۰ نویسه")
    ], "ساخت حساب", function (data) {
      return api("setup", { body: Object.fromEntries(data) }).then(function () { toast("حساب ساخته شد. وارد شوید."); boot(); });
    });
  }

  function renderLogin() {
    authScreen("ورود به پنل محتوا", "مدیریت محتوای صفحه‌های قیمت و مبدل تبدکس", [
      field("نام کاربری", h("input", { name: "username", type: "text", required: true, dir: "ltr", autocomplete: "username" })),
      field("رمز عبور", h("input", { name: "password", type: "password", required: true, dir: "ltr", autocomplete: "current-password" }))
    ], "ورود", function (data) {
      return api("login", { body: Object.fromEntries(data) }).then(function (result) {
        session.user = result.user;
        session.csrf = result.csrf;
        if (!location.hash) location.hash = "#/pages";
        route();
      });
    });
  }

  function boot() {
    teardownEditor();
    api("status").then(function (status) {
      session.user = status.user;
      session.csrf = status.csrf;
      if (status.needs_setup) renderSetup(status.setup_ready);
      else if (!status.user) renderLogin();
      else route();
    }).catch(function (error) {
      clear(app).appendChild(h("div", { class: "auth" }, h("div", { class: "auth-card" }, h("h1", { text: "پنل در دسترس نیست" }), h("p", { text: error.message }))));
    });
  }

  /* ── چارچوب صفحه ──────────────────────────────────── */

  function shell(active) {
    var main = h("main", { class: "main" });
    var links = [["pages", "صفحه‌ها"], ["media", "رسانه‌ها"]];
    if (session.user.role === "admin") links.push(["users", "کاربران"]);
    links.push(["account", "حساب من"]);
    clear(app).appendChild(h("div", { class: "layout" },
      h("aside", { class: "side" },
        h("div", { class: "brand" }, h("img", { src: "/assets/favicon.svg", alt: "" }), h("span", { text: "پنل تبدکس" })),
        h("nav", { class: "nav", "aria-label": "بخش‌های پنل" }, links.map(function (link) {
          return h("a", { href: "#/" + link[0], text: link[1], class: active === link[0] ? "active" : "" });
        })),
        h("div", { class: "side-foot" },
          h("strong", { text: session.user.display_name }),
          h("span", { text: ROLES[session.user.role] }),
          h("button", { class: "btn small", type: "button", text: "خروج", onclick: function () {
            if (!guardLeave()) return;
            api("logout", { body: {} }).catch(function () {}).then(function () { session.user = null; session.csrf = null; location.hash = ""; boot(); });
          } }))),
      main));
    return main;
  }

  function pill(status) { return h("span", { class: "pill " + status, text: STATUS[status] }); }

  function pager(data, onPage) {
    if (data.pages <= 1) return null;
    return h("div", { class: "pager" },
      h("button", { class: "btn small", type: "button", text: "قبلی", disabled: data.page <= 1, onclick: function () { onPage(data.page - 1); } }),
      h("span", { text: "صفحهٔ " + data.page.toLocaleString("fa-IR") + " از " + data.pages.toLocaleString("fa-IR") }),
      h("button", { class: "btn small", type: "button", text: "بعدی", disabled: data.page >= data.pages, onclick: function () { onPage(data.page + 1); } }));
  }

  function debounce(callback, wait) {
    var timer;
    return function () { clearTimeout(timer); timer = setTimeout(callback, wait); };
  }

  function editHash(path) { return "#/edit/" + encodeURIComponent(path); }

  /* ── فهرست صفحه‌ها ─────────────────────────────────── */

  function renderPages() {
    var main = shell("pages");
    var body = h("div", {});
    var state = { q: "", type: "", status: "", page: 1 };

    function load() {
      api("pages", { query: state }).then(function (data) {
        clear(body);
        if (!data.items.length) { body.appendChild(h("div", { class: "card empty", text: "صفحه‌ای با این مشخصات پیدا نشد." })); return; }
        body.appendChild(h("div", { class: "table-wrap" }, h("table", { class: "list" },
          h("thead", {}, h("tr", {}, ["صفحه", "نوع", "وضعیت", "آخرین تغییر", ""].map(function (label) { return h("th", { text: label }); }))),
          h("tbody", {}, data.items.map(function (item) {
            return h("tr", {},
              h("td", { class: "grow" }, h("a", { class: "title", href: editHash(item.path), text: item.title }), h("small", { text: item.path })),
              h("td", { text: TYPES[item.type] || "" }),
              h("td", {}, pill(item.status)),
              h("td", {}, formatDate(item.updated_at), item.updated_by ? h("small", { text: item.updated_by, style: "direction:rtl" }) : null),
              h("td", {}, h("a", { class: "btn small", href: editHash(item.path), text: "ویرایش" })));
          })))));
        append(body, pager(data, function (page) { state.page = page; load(); }));
      }).catch(report);
    }

    var search = debounce(load, 250);
    var pathInput = h("input", { type: "text", dir: "ltr", placeholder: "/convert/btc-to-eur/", "aria-label": "آدرس صفحه" });
    append(main, [
      h("div", { class: "head" }, h("div", {}, h("h1", { text: "صفحه‌ها" }), h("p", { text: "صفحه‌ای که متن دستی نداشته باشد همان متن خودکار را نشان می‌دهد." }))),
      h("div", { class: "filters" },
        h("input", { type: "search", placeholder: "جستجو در نام یا آدرس صفحه", "aria-label": "جستجو", oninput: function (event) { state.q = event.target.value; state.page = 1; search(); } }),
        h("select", { "aria-label": "نوع صفحه", onchange: function (event) { state.type = event.target.value; state.page = 1; load(); } },
          h("option", { value: "", text: "همهٔ نوع‌ها" }), Object.keys(TYPES).map(function (key) { return h("option", { value: key, text: TYPES[key] }); })),
        h("select", { "aria-label": "وضعیت", onchange: function (event) { state.status = event.target.value; state.page = 1; load(); } },
          h("option", { value: "", text: "همهٔ وضعیت‌ها" }), Object.keys(STATUS).map(function (key) { return h("option", { value: key, text: STATUS[key] }); }))),
      body,
      h("form", { class: "card", style: "margin-top:14px", onsubmit: function (event) {
        event.preventDefault();
        var value = pathInput.value.trim().replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0];
        if (!value) return;
        if (value.charAt(0) !== "/") value = "/" + value;
        if (value.slice(-1) !== "/") value += "/";
        location.hash = editHash(value.toLowerCase());
      } },
        h("h2", { text: "صفحه‌ای در فهرست نیست؟" }),
        h("p", { text: "ده‌ها هزار جفت مبدل فایل جدا ندارند. آدرس هر جفت یا دارایی را وارد کنید.", style: "color:var(--muted);font-size:14px" }),
        h("div", { class: "add-path" }, pathInput, h("button", { class: "btn primary", type: "submit", text: "باز کردن" })))
    ]);
    load();
  }

  /* ── آپلود و رسانه ────────────────────────────────── */

  function uploadId() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (byte) { return ("0" + byte.toString(16)).slice(-2); }).join("");
  }

  function guessKind(file) { return (file.type || "").split("/")[0]; }

  function uploadFile(file, onProgress) {
    var kind = guessKind(file);
    if (LIMITS[kind] && file.size > LIMITS[kind]) return Promise.reject(new Error("حجم «" + file.name + "» بیش از سقف مجاز " + KINDS[kind] + " است."));
    if (!file.size) return Promise.reject(new Error("فایل خالی است."));
    var id = uploadId();

    function send(offset, attempt) {
      var form = new FormData();
      form.append("upload_id", id);
      form.append("offset", String(offset));
      form.append("total", String(file.size));
      form.append("name", file.name);
      form.append("chunk", file.slice(offset, offset + CHUNK_SIZE), "chunk");
      return api("media.upload", { form: form }).then(function (result) {
        if (result.done) { if (onProgress) onProgress(1); return result.item; }
        if (onProgress) onProgress(result.received / file.size);
        return send(result.received, 0);
      }).catch(function (error) {
        /* قطعی لحظه‌ای شبکه نباید آپلود یک ویدیوی بزرگ را از اول کند. */
        if (attempt < 2 && (!error.status || error.status >= 500)) return send(offset, attempt + 1);
        throw error;
      });
    }
    return send(0, 0);
  }

  function mediaPreview(item) {
    if (item.kind === "image") return h("img", { src: item.url, alt: item.alt });
    if (item.kind === "video") return h("video", { src: item.url, controls: "controls", preload: "metadata" });
    return h("audio", { src: item.url, controls: "controls", preload: "metadata" });
  }

  function openMediaDetails(item, onChange) {
    var node = dialog();
    var alt = h("input", { type: "text", value: item.alt });
    var url = location.origin + item.url;
    append(node, [
      dialogHead(node, item.name),
      h("div", { class: "media-preview" }, mediaPreview(item)),
      h("div", { class: "meta-line" }, h("span", { text: "حجم" }), h("span", { text: formatSize(item.size) })),
      h("div", { class: "meta-line" }, h("span", { text: "بارگذاری" }), h("span", { text: item.uploaded_by + "، " + formatDate(item.uploaded_at) })),
      item.kind === "image" ? field("متن جایگزین (alt)", alt, "برای سئو و کاربران صفحه‌خوان") : null,
      field("نشانی فایل", h("input", { type: "text", value: url, dir: "ltr", readonly: "readonly" })),
      h("div", { class: "dialog-foot" },
        h("button", { class: "btn danger", type: "button", text: "حذف فایل", onclick: function () {
          confirmBox("حذف فایل", "این فایل برای همیشه حذف می‌شود.", "حذف").then(function (yes) {
            if (!yes) return;
            api("media.delete", { body: { id: item.id } }).then(function () { toast("فایل حذف شد."); node.close(); onChange(); }).catch(report);
          });
        } }),
        h("button", { class: "btn", type: "button", text: "کپی نشانی", onclick: function () {
          navigator.clipboard.writeText(url).then(function () { toast("نشانی کپی شد."); }).catch(function () { toast("کپی نشد؛ نشانی را دستی بردارید.", true); });
        } }),
        item.kind === "image" ? h("button", { class: "btn primary", type: "button", text: "ذخیره", onclick: function () {
          api("media.update", { body: { id: item.id, alt: alt.value } }).then(function () { toast("ذخیره شد."); node.close(); onChange(); }).catch(report);
        } }) : null)
    ]);
    node.showModal();
  }

  function mediaLibrary(container, options) {
    options = options || {};
    var state = { kind: options.kind || "", q: "", page: 1 };
    var grid = h("div", {});
    var progress = h("div", { class: "progress" });
    var accept = { image: "image/jpeg,image/png,image/webp,image/gif", video: "video/mp4,video/webm", audio: "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.m4a,.mp3" };
    var input = h("input", { type: "file", multiple: "multiple", hidden: true, accept: options.kind ? accept[options.kind] : [accept.image, accept.video, accept.audio].join(","), onchange: function () { handle(input.files); input.value = ""; } });

    function load() {
      api("media", { query: state }).then(function (data) {
        clear(grid);
        if (!data.items.length) { grid.appendChild(h("div", { class: "empty", text: "هنوز فایلی اینجا نیست." })); return; }
        grid.appendChild(h("div", { class: "media-grid" }, data.items.map(function (item) {
          return h("button", { class: "media-item", type: "button", title: item.name, onclick: function () {
            if (options.onPick) options.onPick(item); else openMediaDetails(item, load);
          } },
            h("div", { class: "media-thumb" }, item.kind === "image" ? h("img", { src: item.url, alt: item.alt, loading: "lazy" }) : KINDS[item.kind]),
            h("span", { class: "media-name", text: item.name }));
        })));
        append(grid, pager(data, function (page) { state.page = page; load(); }));
      }).catch(report);
    }

    function handle(files) {
      Array.prototype.reduce.call(files, function (chain, file) {
        return chain.then(function () {
          var bar = h("i", { style: "width:0" });
          var row = h("div", { class: "progress-row" }, h("div", { text: file.name }), h("div", { class: "progress-bar" }, bar));
          progress.appendChild(row);
          return uploadFile(file, function (ratio) { bar.style.width = Math.round(ratio * 100) + "%"; })
            .then(function () { state.page = 1; load(); })
            .catch(report)
            .then(function () { row.remove(); });
        });
      }, Promise.resolve());
    }

    var drop = h("div", { class: "drop" }, "فایل را اینجا بکشید یا ", h("button", { class: "btn small", type: "button", text: "انتخاب فایل", onclick: function () { input.click(); } }), h("div", { text: "عکس تا ۱۵، صوت تا ۶۰ و ویدیو تا ۲۵۰ مگابایت" }));
    drop.addEventListener("dragover", function (event) { event.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (event) { event.preventDefault(); drop.classList.remove("over"); handle(event.dataTransfer.files); });

    var searchLater = debounce(load, 250);
    append(container, [
      input, drop, progress,
      h("div", { class: "media-tools" },
        h("input", { type: "search", placeholder: "جستجو در نام فایل", "aria-label": "جستجوی فایل", oninput: function (event) { state.q = event.target.value; state.page = 1; searchLater(); } }),
        options.kind ? null : h("select", { "aria-label": "نوع فایل", onchange: function (event) { state.kind = event.target.value; state.page = 1; load(); } },
          h("option", { value: "", text: "همهٔ فایل‌ها" }), Object.keys(KINDS).map(function (key) { return h("option", { value: key, text: KINDS[key] }); }))),
      grid
    ]);
    load();
  }

  function renderMedia() {
    var main = shell("media");
    append(main, h("div", { class: "head" }, h("div", {}, h("h1", { text: "رسانه‌ها" }), h("p", { text: "عکس، ویدیو و صوت‌هایی که در صفحه‌ها استفاده می‌کنید." }))));
    var box = h("div", { class: "card" });
    main.appendChild(box);
    mediaLibrary(box);
  }

  function openLibrary(kind, onPick) {
    var node = dialog("wide");
    var box = h("div", {});
    append(node, [dialogHead(node, kind ? "انتخاب " + KINDS[kind] : "افزودن رسانه"), box]);
    mediaLibrary(box, { kind: kind, onPick: function (item) { node.close(); onPick(item); } });
    node.showModal();
  }

  /* ── ویرایشگر ─────────────────────────────────────── */

  function teardownEditor() {
    if (window.tinymce) window.tinymce.remove();
    editorState = null;
  }

  function guardLeave() {
    if (skipGuard || !editorState || !editorState.dirty) { skipGuard = false; return true; }
    return window.confirm("تغییرات ذخیره نشده‌اند. از این صفحه خارج می‌شوید؟");
  }

  function insertMedia(editor, item) {
    var src = editor.dom.encode(item.url);
    if (item.kind === "image") editor.insertContent('<p><img src="' + src + '" alt="' + editor.dom.encode(item.alt || "") + '"></p>');
    else if (item.kind === "video") editor.insertContent('<p><video src="' + src + '" controls="controls" preload="metadata"></video></p>');
    else editor.insertContent('<p><audio src="' + src + '" controls="controls" preload="metadata"></audio></p>');
  }

  function renderEditor(path) {
    var main = shell("pages");
    append(main, h("div", { class: "empty", text: "در حال بارگذاری…" }));
    api("page", { query: { path: path } }).then(function (view) { buildEditor(main, path, view); }).catch(function (error) {
      clear(main);
      append(main, [h("div", { class: "card empty", text: error.message }), h("a", { class: "btn", href: "#/pages", text: "بازگشت به فهرست", style: "margin-top:12px" })]);
    });
  }

  function buildEditor(main, path, initial) {
    var state = editorState = { path: path, view: initial, dirty: false, busy: false };
    var textarea = h("textarea", { id: "cms-editor" });
    textarea.value = initial.html;
    var statusBox = h("span", {});
    var updated = h("span", {});
    var published = h("span", {});
    var revisions = h("div", { class: "revisions" });
    var dirtyNote = h("div", { class: "notice", text: "تغییرات ذخیره نشده‌اند.", hidden: true });
    var unpublish = h("button", { class: "btn danger", type: "button", text: "برداشتن از انتشار", onclick: doUnpublish });
    var buttons = [
      h("button", { class: "btn primary", type: "button", text: "انتشار", onclick: function () { save(true); } }),
      h("button", { class: "btn", type: "button", text: "ذخیرهٔ پیش‌نویس", onclick: function () { save(false); } }),
      h("button", { class: "btn", type: "button", text: "پیش‌نمایش", onclick: preview })
    ];

    function setDirty(value) { state.dirty = value; dirtyNote.hidden = !value; }

    function setBusy(value) {
      state.busy = value;
      buttons.concat(unpublish).forEach(function (button) { button.disabled = value; });
    }

    function refresh() {
      var view = state.view;
      clear(statusBox).appendChild(pill(view.status));
      updated.textContent = view.updated_at ? formatDate(view.updated_at) + (view.updated_by ? "، " + view.updated_by : "") : "—";
      published.textContent = formatDate(view.published_at);
      unpublish.hidden = view.status === "auto" || view.status === "draft";
      clear(revisions);
      if (!view.revisions.length) revisions.appendChild(h("p", { text: "هنوز نسخه‌ای ثبت نشده است.", style: "color:var(--muted);font-size:13.5px" }));
      view.revisions.forEach(function (revision) {
        revisions.appendChild(h("div", { class: "revision" },
          h("div", {}, ACTIONS[revision.action], h("small", { text: formatDate(revision.at) + "، " + revision.by })),
          h("button", { class: "btn small", type: "button", text: "بازگردانی", onclick: function () { restore(revision.id); } })));
      });
    }

    function content() { return window.tinymce.get("cms-editor").getContent(); }

    function applyView(view) {
      state.view = view;
      window.tinymce.get("cms-editor").setContent(view.html);
      setDirty(false);
      refresh();
    }

    function save(publish) {
      if (state.busy) return Promise.resolve();
      setBusy(true);
      return api(publish ? "page.publish" : "page.save", { body: { path: path, html: content(), version: state.view.version } }).then(function (view) {
        applyView(view);
        toast(publish ? "منتشر شد و همین حالا روی سایت است." : "پیش‌نویس ذخیره شد.");
      }).catch(report).then(function () { setBusy(false); });
    }

    function preview() {
      /* پنجره باید همزمان با کلیک باز شود وگرنه مسدودکنندهٔ پاپ‌آپ جلویش را می‌گیرد. */
      var tab = window.open("about:blank", "_blank");
      var ready = (state.dirty || state.view.version === 0) ? save(false) : Promise.resolve();
      ready.then(function () { return api("page.preview", { body: { path: path } }); })
        .then(function (result) { if (tab) tab.location = result.url; else toast("پنجرهٔ پیش‌نمایش مسدود شد.", true); })
        .catch(function (error) { if (tab) tab.close(); report(error); });
    }

    function doUnpublish() {
      confirmBox("برداشتن از انتشار", "این صفحه دوباره متن خودکار را نشان می‌دهد. محتوای شما به‌صورت پیش‌نویس می‌ماند.", "برداشتن").then(function (yes) {
        if (!yes) return;
        setBusy(true);
        api("page.unpublish", { body: { path: path } }).then(function (view) { applyView(view); toast("از انتشار برداشته شد."); }).catch(report).then(function () { setBusy(false); });
      });
    }

    function restore(id) {
      api("page.revision", { query: { path: path, id: id } }).then(function (result) {
        window.tinymce.get("cms-editor").setContent(result.html);
        setDirty(true);
        toast("نسخه در ویرایشگر قرار گرفت. برای اعمال، ذخیره یا منتشر کنید.");
      }).catch(report);
    }

    clear(main);
    append(main, [
      h("div", { class: "head" },
        h("div", {}, h("h1", { text: initial.page.title }), h("a", { class: "page-link", href: path, target: "_blank", rel: "noopener", text: path })),
        h("a", { class: "btn", href: "#/pages", text: "بازگشت به فهرست" })),
      initial.from_auto && initial.html ? h("div", { class: "notice", text: "متن فعلی صفحه برای شروع در ویرایشگر قرار گرفت. تا انتشار نزنید چیزی روی سایت عوض نمی‌شود." }) : null,
      h("div", { class: "editor-grid" },
        h("div", {}, textarea),
        h("aside", { class: "editor-side" },
          h("div", { class: "card" },
            h("div", { class: "meta-line" }, h("span", { text: "وضعیت" }), statusBox),
            h("div", { class: "meta-line" }, h("span", { text: "آخرین تغییر" }), updated),
            h("div", { class: "meta-line" }, h("span", { text: "آخرین انتشار" }), published),
            dirtyNote,
            h("div", { class: "actions" }, buttons, unpublish)),
          h("div", { class: "card" }, h("h2", { text: "نسخه‌های قبلی" }), revisions)))
    ]);
    refresh();

    window.tinymce.remove();
    window.tinymce.init({
      target: textarea,
      base_url: "/panel/vendor/tinymce",
      suffix: ".min",
      language: "fa",
      directionality: "rtl",
      height: 620,
      branding: false,
      promotion: false,
      menubar: "edit view insert format table",
      plugins: "advlist autolink charmap code directionality fullscreen image link lists nonbreaking quickbars searchreplace table visualblocks wordcount",
      toolbar: "undo redo | blocks | bold italic underline strikethrough | forecolor backcolor removeformat | alignright aligncenter alignleft alignjustify | bullist numlist outdent indent | blockquote link addmedia table hr | rtl ltr | code fullscreen",
      toolbar_mode: "wrap",
      quickbars_insert_toolbar: false,
      quickbars_selection_toolbar: "bold italic underline | blocks | link blockquote",
      block_formats: "پاراگراف=p;تیتر ۲=h2;تیتر ۳=h3;تیتر ۴=h4;متن آماده=pre",
      content_css: "/panel/assets/editor-content.css",
      invalid_elements: "h1,script,style,iframe,object,embed,form",
      extended_valid_elements: "video[src|poster|controls|preload|width|height|style|class|playsinline],audio[src|controls|preload|style|class],source[src|type]",
      relative_urls: false,
      remove_script_host: true,
      convert_urls: false,
      link_default_protocol: "https",
      link_title: false,
      link_target_list: [{ title: "همین پنجره", value: "" }, { title: "پنجرهٔ جدید", value: "_blank" }],
      link_rel_list: [{ title: "عادی", value: "" }, { title: "nofollow", value: "nofollow" }, { title: "sponsored", value: "sponsored nofollow" }],
      image_caption: true,
      image_title: false,
      image_description: true,
      image_dimensions: true,
      automatic_uploads: true,
      paste_data_images: true,
      file_picker_types: "image",
      file_picker_callback: function (callback) {
        openLibrary("image", function (item) { callback(item.url, { alt: item.alt || "" }); });
      },
      images_upload_handler: function (blobInfo, progress) {
        var file = new File([blobInfo.blob()], blobInfo.filename(), { type: blobInfo.blob().type });
        return uploadFile(file, function (ratio) { progress(ratio * 100); }).then(function (item) { return item.url; }).catch(function (error) { throw error.message; });
      },
      setup: function (editor) {
        editor.ui.registry.addButton("addmedia", {
          text: "افزودن رسانه",
          icon: "image",
          tooltip: "افزودن عکس، ویدیو یا صوت",
          onAction: function () { openLibrary("", function (item) { insertMedia(editor, item); }); }
        });
        editor.ui.registry.addMenuItem("addmedia", {
          text: "افزودن رسانه",
          icon: "image",
          onAction: function () { openLibrary("", function (item) { insertMedia(editor, item); }); }
        });
        editor.on("input change undo redo", function () { if (state === editorState) setDirty(true); });
        editor.on("keydown", function (event) {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(false); }
        });
      }
    });
  }

  /* ── کاربران و حساب ────────────────────────────────── */

  function roleSelect(value) {
    return h("select", { name: "role" }, Object.keys(ROLES).map(function (key) { return h("option", { value: key, text: ROLES[key], selected: key === value }); }));
  }

  function formDialog(title, fields, submitLabel, onSubmit) {
    var node = dialog();
    var error = h("p", { class: "error-text" });
    var form = h("form", { onsubmit: function (event) {
      event.preventDefault();
      error.textContent = "";
      onSubmit(new FormData(form), form).then(function () { node.close(); }).catch(function (err) { error.textContent = err.message; });
    } }, fields, error, h("div", { class: "dialog-foot" },
      h("button", { class: "btn", type: "button", text: "انصراف", onclick: function () { node.close(); } }),
      h("button", { class: "btn primary", type: "submit", text: submitLabel })));
    append(node, [h("h2", { text: title, style: "margin-bottom:14px" }), form]);
    node.showModal();
  }

  function renderUsers() {
    var main = shell("users");
    var body = h("div", {});

    function createUser() {
      formDialog("کاربر جدید", [
        field("نام نمایشی", h("input", { name: "display_name", type: "text", required: true })),
        field("نام کاربری", h("input", { name: "username", type: "text", required: true, dir: "ltr", autocomplete: "off" }), "حروف انگلیسی کوچک، عدد و . _ -"),
        field("نقش", roleSelect("editor"), "ویرایشگر به صفحه‌ها و رسانه‌ها دسترسی دارد. مدیر کاربران را هم مدیریت می‌کند."),
        field("رمز عبور", h("input", { name: "password", type: "password", required: true, dir: "ltr", autocomplete: "new-password", minlength: 10 }), "دست‌کم ۱۰ نویسه")
      ], "ساخت کاربر", function (data) {
        return api("user.create", { body: Object.fromEntries(data) }).then(function () { toast("کاربر ساخته شد."); load(); });
      });
    }

    function editUser(user) {
      var active = h("input", { name: "active", type: "checkbox", checked: user.active });
      formDialog("ویرایش " + user.username, [
        field("نام نمایشی", h("input", { name: "display_name", type: "text", required: true, value: user.display_name })),
        field("نقش", roleSelect(user.role)),
        h("label", { class: "check" }, active, "حساب فعال باشد"),
        field("رمز جدید", h("input", { name: "password", type: "password", dir: "ltr", autocomplete: "new-password", minlength: 10 }), "خالی بماند یعنی رمز تغییر نکند. با تغییر رمز، کاربر از همهٔ دستگاه‌ها خارج می‌شود.")
      ], "ذخیره", function (data) {
        return api("user.update", { body: { id: user.id, display_name: data.get("display_name"), role: data.get("role"), active: active.checked, password: data.get("password") } })
          .then(function () { toast("ذخیره شد."); load(); });
      });
    }

    function removeUser(user) {
      confirmBox("حذف کاربر", "حساب «" + user.username + "» حذف می‌شود. نوشته‌های او سر جایشان می‌مانند.", "حذف").then(function (yes) {
        if (!yes) return;
        api("user.delete", { body: { id: user.id } }).then(function () { toast("کاربر حذف شد."); load(); }).catch(report);
      });
    }

    function load() {
      api("users").then(function (data) {
        clear(body).appendChild(h("div", { class: "table-wrap" }, h("table", { class: "list" },
          h("thead", {}, h("tr", {}, ["کاربر", "نقش", "وضعیت", "آخرین ورود", ""].map(function (label) { return h("th", { text: label }); }))),
          h("tbody", {}, data.items.map(function (user) {
            return h("tr", {},
              h("td", { class: "grow" }, h("strong", { text: user.display_name }), h("small", { text: user.username })),
              h("td", { text: ROLES[user.role] }),
              h("td", {}, h("span", { class: "pill " + (user.active ? "published" : "off"), text: user.active ? "فعال" : "غیرفعال" })),
              h("td", { text: formatDate(user.last_login_at) }),
              h("td", {}, h("div", { class: "row-actions" },
                h("button", { class: "btn small", type: "button", text: "ویرایش", onclick: function () { editUser(user); } }),
                user.id === session.user.id ? null : h("button", { class: "btn small danger", type: "button", text: "حذف", onclick: function () { removeUser(user); } }))));
          })))));
      }).catch(report);
    }

    append(main, [
      h("div", { class: "head" }, h("div", {}, h("h1", { text: "کاربران" }), h("p", { text: "کسانی که می‌توانند وارد پنل شوند." })),
        h("button", { class: "btn primary", type: "button", text: "کاربر جدید", onclick: createUser })),
      body
    ]);
    load();
  }

  function renderAccount() {
    var main = shell("account");
    var error = h("p", { class: "error-text" });
    var form = h("form", { class: "card", style: "max-width:440px", onsubmit: function (event) {
      event.preventDefault();
      error.textContent = "";
      var data = new FormData(form);
      if (data.get("password") !== data.get("repeat")) { error.textContent = "تکرار رمز با رمز جدید یکی نیست."; return; }
      api("account.password", { body: { current: data.get("current"), password: data.get("password") } })
        .then(function () { form.reset(); toast("رمز تغییر کرد. نشست‌های دیگر بسته شدند."); })
        .catch(function (err) { error.textContent = err.message; });
    } },
      field("رمز فعلی", h("input", { name: "current", type: "password", required: true, dir: "ltr", autocomplete: "current-password" })),
      field("رمز جدید", h("input", { name: "password", type: "password", required: true, dir: "ltr", autocomplete: "new-password", minlength: 10 }), "دست‌کم ۱۰ نویسه"),
      field("تکرار رمز جدید", h("input", { name: "repeat", type: "password", required: true, dir: "ltr", autocomplete: "new-password", minlength: 10 })),
      error,
      h("button", { class: "btn primary", type: "submit", text: "تغییر رمز" }));
    append(main, [h("div", { class: "head" }, h("div", {}, h("h1", { text: "حساب من" }), h("p", { text: session.user.display_name + " (" + session.user.username + ")" }))), form]);
  }

  /* ── مسیرها ───────────────────────────────────────── */

  function route() {
    if (!session.user) return;
    var hash = location.hash || "#/pages";
    teardownEditor();
    lastHash = hash;
    if (hash.indexOf("#/edit/") === 0) renderEditor(decodeURIComponent(hash.slice(7)));
    else if (hash === "#/media") renderMedia();
    else if (hash === "#/users" && session.user.role === "admin") renderUsers();
    else if (hash === "#/account") renderAccount();
    else renderPages();
  }

  window.addEventListener("hashchange", function () {
    if (location.hash === lastHash) return;
    if (!guardLeave()) { history.replaceState(null, "", lastHash); return; }
    route();
  });
  window.addEventListener("beforeunload", function (event) {
    if (editorState && editorState.dirty) { event.preventDefault(); event.returnValue = ""; }
  });

  boot();
})();
