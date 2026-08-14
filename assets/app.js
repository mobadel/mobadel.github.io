/* ══════════════════════════════════════════════════════════════
   مبدل — app.js
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ── ابزار اعداد ─────────────────────────────────────────────
   ورودی کاربر می‌تواند فارسی، عربی یا انگلیسی باشد؛ خروجی همیشه
   فارسی است.                                                    */
var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
var DIGIT_MAP = {};
'۰۱۲۳۴۵۶۷۸۹'.split('').forEach(function (d, i) { DIGIT_MAP[d] = String(i); });
'٠١٢٣٤٥٦٧٨٩'.split('').forEach(function (d, i) { DIGIT_MAP[d] = String(i); });

function toEnDigits(s) {
  return String(s).replace(/[۰-۹٠-٩]/g, function (d) { return DIGIT_MAP[d]; });
}
function toFaDigits(s) {
  return String(s).replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; });
}
function group(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** رشتهٔ ورودی کاربر → عدد (NaN اگر خالی/نامعتبر) */
function parseAmount(str) {
  var s = toEnDigits(str).replace(/[,\s٬،]/g, '').replace(/[٫،]/g, '.');
  if (!s || s === '.') return NaN;
  var n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/** تعداد اعشار مناسب بر اساس بزرگی عدد */
function smartDp(v, hint) {
  var a = Math.abs(v);
  if (a === 0) return 0;
  if (a >= 1000) return 0;
  if (a >= 100)  return Math.min(hint, 2);
  if (a >= 1)    return Math.min(hint, 4);
  if (a >= 0.01) return Math.min(Math.max(hint, 4), 6);
  return Math.min(Math.max(hint, 6), 8);
}

/** عدد → رشتهٔ فارسیِ سه‌رقم‌جداشده */
function fmt(v, hint) {
  if (!isFinite(v)) return '';
  var dp = smartDp(v, hint == null ? 2 : hint);
  var s = v.toFixed(dp);
  if (dp > 0) s = s.replace(/\.?0+$/, '');           // صفرهای انتهایی
  var parts = s.split('.');
  return toFaDigits(group(parts[0]) + (parts[1] ? '.' + parts[1] : ''));
}

/** فرمت فشرده برای فهرست انتخاب: ۱۱۰٫۲ هزار / ۴٫۵ میلیارد */
function fmtCompact(v) {
  if (!isFinite(v) || v <= 0) return '';
  var units = [[1e12, 'همت'], [1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']];
  for (var i = 0; i < units.length; i++) {
    if (v >= units[i][0]) {
      var q = v / units[i][0];
      return toFaDigits((q >= 100 ? q.toFixed(0) : q.toFixed(1)).replace(/\.0$/, '')) + ' ' + units[i][1];
    }
  }
  return fmt(v, 4);
}

/* ── نرمال‌سازی متن برای جستجو ───────────────────────────────── */
function norm(s) {
  return toEnDigits(String(s))
    .toLowerCase()
    .replace(/[يى]/g, 'ی')   // ي ى → ی
    .replace(/ك/g, 'ک')           // ك → ک
    .replace(/[ةۀ]/g, 'ه')   // ة ۀ → ه
    .replace(/[‌‏‎]/g, '')
    .replace(/[ً-ْ]/g, '')   // اعراب
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── وضعیت ──────────────────────────────────────────────────── */
var BY_ID = {};
ASSETS.forEach(function (a) {
  BY_ID[a.id] = a;
  a._hay = norm([a.name, a.sym, a.id].concat(a.alias || []).join(' '));
});

var state = {
  from: 'irt',
  to: 'usdt',
  amount: 10000000,
  edited: 'from',          // کدام فیلد آخرین‌بار ویرایش شده
  prices: {},              // id → قیمت به تومان
  updated: null,
  seed: false,
  pickerSide: null
};

var els = {};
['amount-from', 'amount-to', 'asset-from', 'asset-to', 'chips-from', 'chips-to',
 'swap', 'rate-text', 'rate-meta', 'refresh', 'theme', 'banner', 'picker',
 'picker-close', 'picker-list', 'picker-empty', 'search', 'tabs',
 'ladder-body', 'ladder-title', 'ladder-h1', 'ladder-h2'].forEach(function (id) {
  els[id] = document.getElementById(id);
});

/* ── تبدیل ──────────────────────────────────────────────────── */
function priceOf(id) {
  if (id === 'irt') return 1;
  var p = state.prices[id];
  return (typeof p === 'number' && p > 0) ? p : null;
}
function convert(amount, fromId, toId) {
  var pf = priceOf(fromId), pt = priceOf(toId);
  if (pf == null || pt == null || !isFinite(amount)) return null;
  return amount * pf / pt;
}

/* ── رندر ───────────────────────────────────────────────────── */
function paintAssetBtn(btn, asset) {
  var ico = btn.querySelector('[data-ico]');
  ico.textContent = asset.glyph;
  ico.style.background = asset.color;
  btn.querySelector('[data-name]').textContent = asset.name;
  btn.querySelector('[data-sym]').textContent = asset.sym;
}

var writing = false;   // جلوگیری از حلقهٔ رویداد بین دو ورودی

function setInput(el, value) {
  writing = true;
  el.value = value;
  writing = false;
}

function render() {
  var A = BY_ID[state.from], B = BY_ID[state.to];
  paintAssetBtn(els['asset-from'], A);
  paintAssetBtn(els['asset-to'], B);

  // مقدار سمت مقابلِ فیلدی که کاربر تایپ کرده را محاسبه کن
  if (state.edited === 'from') {
    var out = convert(state.amount, state.from, state.to);
    setInput(els['amount-to'], out == null ? '' : fmt(out, B.dp));
  } else {
    var back = convert(state.amount, state.to, state.from);
    setInput(els['amount-from'], back == null ? '' : fmt(back, A.dp));
  }

  paintChips();
  paintRate();
  paintLadder();
  updateHash();
}

function paintRate() {
  var A = BY_ID[state.from], B = BY_ID[state.to];
  var one = convert(1, state.from, state.to);

  if (one == null) {
    els['rate-text'].textContent = 'قیمت ' +
      (priceOf(state.from) == null ? A.name : B.name) + ' در دسترس نیست.';
  } else {
    els['rate-text'].textContent = '۱ ' + A.name + ' = ' + fmt(one, B.dp) + ' ' + B.name;
  }

  var meta = els['rate-meta'];
  if (!state.updated) { meta.textContent = ''; return; }
  var mins = Math.round((Date.now() - state.updated) / 60000);
  var when = mins < 1 ? 'همین الان' :
             mins < 60 ? toFaDigits(mins) + ' دقیقه پیش' :
             toFaDigits(Math.round(mins / 60)) + ' ساعت پیش';
  meta.textContent = 'آخرین به‌روزرسانی: ' + when;
  meta.classList.toggle('stale', mins > 30);
}

function paintChips() {
  [['from', els['chips-from']], ['to', els['chips-to']]].forEach(function (pair) {
    var side = pair[0], box = pair[1];
    if (box.dataset.built) {
      Array.prototype.forEach.call(box.children, function (c) {
        c.setAttribute('aria-pressed', String(c.dataset.id === state[side]));
      });
      return;
    }
    box.innerHTML = '';
    QUICK.forEach(function (id) {
      var a = BY_ID[id]; if (!a) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = id;
      b.textContent = a.name;
      b.setAttribute('aria-pressed', String(id === state[side]));
      b.addEventListener('click', function () { pick(side, id); });
      box.appendChild(b);
    });
    box.dataset.built = '1';
  });
}

function paintLadder() {
  var A = BY_ID[state.from], B = BY_ID[state.to];
  els['ladder-title'].textContent = 'جدول تبدیل ' + A.name + ' به ' + B.name;
  els['ladder-h1'].textContent = A.name;
  els['ladder-h2'].textContent = B.name;

  var body = els['ladder-body'];
  body.innerHTML = '';
  if (convert(1, state.from, state.to) == null) return;

  // پلهٔ پایه را از روی مقدار فعلی می‌سازیم تا ردیف‌ها معنادار باشند
  var seed = isFinite(state.amount) && state.amount > 0 ? state.amount : 1;
  var unit = Math.pow(10, Math.floor(Math.log10(seed)));
  [1, 2, 5, 10, 20, 50, 100].forEach(function (m) {
    var v = unit * m;
    var r = convert(v, state.from, state.to);
    if (r == null) return;
    var tr = document.createElement('tr');
    var td1 = document.createElement('td');
    var td2 = document.createElement('td');
    td1.textContent = fmt(v, A.dp) + ' ' + A.name;
    td2.textContent = fmt(r, B.dp) + ' ' + B.name;
    tr.appendChild(td1); tr.appendChild(td2);
    body.appendChild(tr);
  });
}

/* ── انتخاب دارایی ──────────────────────────────────────────── */
function pick(side, id) {
  if (!BY_ID[id]) return;
  var other = side === 'from' ? 'to' : 'from';
  if (state[other] === id) {            // انتخاب تکراری ⇒ جابه‌جایی
    state[other] = state[side];
  }
  state[side] = id;
  render();
}

function swap() {
  var f = state.from;
  state.from = state.to;
  state.to = f;
  // مقدارِ نمایش‌داده‌شده در سمت مقصد به مبدأ منتقل می‌شود
  var shown = parseAmount(els['amount-to'].value);
  if (isFinite(shown) && shown > 0) state.amount = shown;
  state.edited = 'from';
  setInput(els['amount-from'], fmt(state.amount, BY_ID[state.from].dp));
  els['swap'].classList.toggle('turn');
  render();
}

/* ── ورودی‌ها با حفظ مکان نشانگر ────────────────────────────── */
function attachInput(el, side) {
  el.addEventListener('input', function () {
    if (writing) return;
    var caret = el.selectionStart;
    var raw = el.value;
    var digitsBefore = toEnDigits(raw.slice(0, caret)).replace(/[^\d.]/g, '').length;

    var n = parseAmount(raw);
    state.edited = side;
    state.amount = isFinite(n) ? n : NaN;

    // بازنویسیِ فرمت‌شده فقط وقتی کاربر در حال تایپ اعشار نیست
    if (isFinite(n) && !/[.,٫،]\s*$/.test(raw) && !/\.\d*0$/.test(toEnDigits(raw))) {
      var hint = BY_ID[state[side]].dp;
      var formatted = fmt(n, Math.max(hint, 8));
      setInput(el, formatted);
      // نشانگر را پس از همان تعداد رقم قرار بده
      var seen = 0, pos = 0;
      for (; pos < formatted.length && seen < digitsBefore; pos++) {
        if (/[۰-۹.]/.test(formatted[pos])) seen++;
      }
      try { el.setSelectionRange(pos, pos); } catch (e) {}
    }

    if (side === 'from') {
      var out = convert(state.amount, state.from, state.to);
      setInput(els['amount-to'], out == null ? '' : fmt(out, BY_ID[state.to].dp));
    } else {
      var back = convert(state.amount, state.to, state.from);
      setInput(els['amount-from'], back == null ? '' : fmt(back, BY_ID[state.from].dp));
    }
    paintLadder();
  });

  el.addEventListener('focus', function () { el.select(); });
}

/* ── پنجرهٔ انتخاب ──────────────────────────────────────────── */
var picker = { cat: 'all', q: '', rows: [], cursor: 0 };

function openPicker(side) {
  state.pickerSide = side;
  picker.q = ''; picker.cat = 'all'; picker.cursor = 0;
  els['search'].value = '';
  buildTabs();
  renderPicker();
  els['picker'].hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(function () { els['search'].focus(); }, 30);
}
function closePicker() {
  els['picker'].hidden = true;
  document.body.style.overflow = '';
  var btn = document.getElementById('asset-' + state.pickerSide);
  if (btn) btn.focus();
  state.pickerSide = null;
}

function buildTabs() {
  if (els['tabs'].dataset.built) {
    Array.prototype.forEach.call(els['tabs'].children, function (t) {
      t.setAttribute('aria-selected', String(t.dataset.cat === picker.cat));
    });
    return;
  }
  els['tabs'].innerHTML = '';
  CATEGORIES.forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.dataset.cat = c.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(c.id === picker.cat));
    b.textContent = c.label;
    b.addEventListener('click', function () {
      picker.cat = c.id; picker.cursor = 0;
      buildTabs(); renderPicker();
    });
    els['tabs'].appendChild(b);
  });
  els['tabs'].dataset.built = '1';
}

function matches(a) {
  if (picker.cat !== 'all' && a.cat !== picker.cat) return false;
  if (!picker.q) return true;
  var terms = picker.q.split(' ');
  return terms.every(function (t) { return a._hay.indexOf(t) !== -1; });
}

function renderPicker() {
  var list = els['picker-list'];
  list.innerHTML = '';
  picker.rows = ASSETS.filter(matches);

  els['picker-empty'].hidden = picker.rows.length > 0;
  if (!picker.rows.length) return;

  var current = state[state.pickerSide];
  var lastCat = null;

  picker.rows.forEach(function (a, i) {
    if (picker.cat === 'all' && a.cat !== lastCat) {
      lastCat = a.cat;
      var h = document.createElement('li');
      h.className = 'grp';
      h.setAttribute('role', 'presentation');
      h.textContent = (CATEGORIES.filter(function (c) { return c.id === a.cat; })[0] || {}).label || '';
      list.appendChild(h);
    }
    var li = document.createElement('li');
    li.setAttribute('role', 'presentation');

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (i === picker.cursor ? ' cursor' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(a.id === current));
    b.dataset.id = a.id;

    var ico = document.createElement('span');
    ico.className = 'asset-ico';
    ico.style.background = a.color;
    ico.textContent = a.glyph;

    var txt = document.createElement('span');
    txt.className = 'opt-text';
    var n1 = document.createElement('span'); n1.className = 'opt-name'; n1.textContent = a.name;
    var n2 = document.createElement('span'); n2.className = 'opt-sub';  n2.textContent = a.sym;
    txt.appendChild(n1); txt.appendChild(n2);

    var pr = document.createElement('span');
    pr.className = 'opt-price';
    var p = priceOf(a.id);
    pr.textContent = (a.id === 'irt' || p == null) ? '' : fmtCompact(p) + ' ت';

    b.appendChild(ico); b.appendChild(txt); b.appendChild(pr);
    b.addEventListener('click', function () {
      pick(state.pickerSide, a.id);
      closePicker();
    });
    li.appendChild(b);
    list.appendChild(li);
  });
}

function moveCursor(delta) {
  if (!picker.rows.length) return;
  picker.cursor = (picker.cursor + delta + picker.rows.length) % picker.rows.length;
  var opts = els['picker-list'].querySelectorAll('.opt');
  Array.prototype.forEach.call(opts, function (o, i) {
    o.classList.toggle('cursor', i === picker.cursor);
    if (i === picker.cursor) o.scrollIntoView({ block: 'nearest' });
  });
}

/* ── همگام‌سازی با آدرس صفحه (لینک اشتراک‌پذیر) ─────────────── */
var hashLock = false;
function updateHash() {
  hashLock = true;
  var h = '#' + state.from + '-' + state.to;
  if (location.hash !== h) history.replaceState(null, '', h);
  setTimeout(function () { hashLock = false; }, 0);
}
function readHash() {
  var m = /^#([a-z0-9_]+)-([a-z0-9_]+)$/.exec(location.hash || '');
  if (m && BY_ID[m[1]] && BY_ID[m[2]] && m[1] !== m[2]) {
    state.from = m[1]; state.to = m[2];
    return true;
  }
  return false;
}

/* ── قیمت‌ها ────────────────────────────────────────────────── */
function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (v) { clearTimeout(t); resolve(v); },
                 function (e) { clearTimeout(t); reject(e); });
  });
}

/** ۱) عکس فوری ذخیره‌شده در ریپو — همیشه در دسترس، بدون CORS */
function loadSnapshot() {
  return withTimeout(fetch('data/prices.json?t=' + Date.now()).then(function (r) {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }), 8000).then(function (j) {
    if (j && j.prices) {
      Object.keys(j.prices).forEach(function (k) {
        var v = j.prices[k];
        if (typeof v === 'number' && v > 0) state.prices[k] = v;
      });
      state.updated = j.updated ? Date.parse(j.updated) : Date.now();
      state.seed = !!j.seed;
    }
  });
}

/** ۲) نوبیتکس مستقیم از مرورگر — تازه‌ترین قیمت تومانی رمزارزها */
function loadNobitex() {
  var list = ASSETS.filter(function (a) { return a.nobitex; });
  var src = list.map(function (a) { return a.nobitex; }).join(',');
  var url = 'https://api.nobitex.ir/market/stats?srcCurrency=' + src + '&dstCurrency=rls';

  return withTimeout(fetch(url).then(function (r) {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }), 7000).then(function (j) {
    if (!j || !j.stats) throw new Error('bad payload');
    var hit = 0;
    list.forEach(function (a) {
      var s = j.stats[a.nobitex + '-rls'];
      if (!s) return;
      var rial = parseFloat(s.latest);
      if (isFinite(rial) && rial > 0) {
        state.prices[a.id] = rial / 10;   // ریال → تومان
        hit++;
      }
    });
    if (!hit) throw new Error('no stats');
    state.updated = Date.now();
    state.seed = false;
  });
}

function showBanner(msg) {
  els['banner'].textContent = msg;
  els['banner'].hidden = false;
}
function hideBanner() { els['banner'].hidden = true; }

/* عکس فوری و نوبیتکس باید *پشت سر هم* اجرا شوند، نه موازی: اگر
   موازی باشند و پاسخ فایل دیرتر برسد، دادهٔ تازهٔ نوبیتکس را
   بازنویسی می‌کند. نوبیتکس همیشه حرف آخر را می‌زند. */
function refresh() {
  els['refresh'].classList.add('spin');
  hideBanner();

  var snapOk = false, liveOk = false;

  return loadSnapshot()
    .then(function () { snapOk = true; }, function () {})
    .then(function () {
      return loadNobitex().then(function () { liveOk = true; }, function () {});
    })
    .then(function () {
      els['refresh'].classList.remove('spin');

      if (!Object.keys(state.prices).length) {
        showBanner('دریافت قیمت‌ها ممکن نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
      } else if (state.seed) {
        showBanner('قیمت‌ها هنوز به‌روزرسانی نشده‌اند و مقادیر نمونه هستند.');
      } else if (!snapOk && !liveOk) {
        showBanner('قیمت‌ها ممکن است قدیمی باشند.');
      }
      render();
    });
}

/* ── پوسته ──────────────────────────────────────────────────── */
function initTheme() {
  var saved = null;
  try { saved = localStorage.getItem('mobadel-theme'); } catch (e) {}
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  els['theme'].addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    if (!cur) {
      cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mobadel-theme', next); } catch (e) {}
  });
}

/* ── راه‌اندازی ─────────────────────────────────────────────── */
function init() {
  initTheme();
  readHash();

  attachInput(els['amount-from'], 'from');
  attachInput(els['amount-to'], 'to');

  els['swap'].addEventListener('click', swap);
  els['refresh'].addEventListener('click', function () { refresh(); });
  els['asset-from'].addEventListener('click', function () { openPicker('from'); });
  els['asset-to'].addEventListener('click', function () { openPicker('to'); });
  els['picker-close'].addEventListener('click', closePicker);

  els['picker'].addEventListener('mousedown', function (e) {
    if (e.target === els['picker']) closePicker();
  });

  els['search'].addEventListener('input', function () {
    picker.q = norm(els['search'].value);
    picker.cursor = 0;
    renderPicker();
  });

  els['search'].addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var a = picker.rows[picker.cursor];
      if (a) { pick(state.pickerSide, a.id); closePicker(); }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !els['picker'].hidden) closePicker();
  });

  window.addEventListener('hashchange', function () {
    if (hashLock) return;
    if (readHash()) render();
  });

  setInput(els['amount-from'], fmt(state.amount, 0));
  render();
  refresh();

  // تازه‌سازی خودکار هنگام بازگشت به تب و هر ۲ دقیقه
  setInterval(function () {
    if (!document.hidden) refresh();
  }, 120000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.updated && Date.now() - state.updated > 120000) refresh();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
