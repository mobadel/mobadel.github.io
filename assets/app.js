(function () {
  "use strict";

  var FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  var DIGIT_MAP = {};
  "۰۱۲۳۴۵۶۷۸۹".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });
  "٠١٢٣٤٥٦٧٨٩".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });

  var currencies = {
    usdt: { id: "usdt", code: "USDT", name: "تتر", icon: "₮", iconClass: "tether", decimals: 4 },
    irt: { id: "irt", code: "IRT", name: "تومان", icon: "ت", iconClass: "toman", decimals: 0 }
  };

  var state = {
    from: "irt",
    to: "usdt",
    amount: 10000000,
    edited: "from",
    rate: null,
    updatedAt: null,
    live: false,
    loading: false
  };

  var elements = {
    amountFrom: document.getElementById("amount-from"),
    amountTo: document.getElementById("amount-to"),
    currencyFrom: document.getElementById("currency-from"),
    currencyTo: document.getElementById("currency-to"),
    pageTitle: document.getElementById("page-title"),
    rateValue: document.getElementById("rate-value"),
    rateStatus: document.getElementById("rate-status"),
    swap: document.getElementById("swap"),
    refresh: document.getElementById("refresh")
  };

  var writing = false;

  function toEnglishDigits(value) {
    return String(value).replace(/[۰-۹٠-٩]/g, function (digit) { return DIGIT_MAP[digit]; });
  }

  function parseAmount(value) {
    var normalized = toEnglishDigits(value)
      .replace(/[\s,٬،]/g, "")
      .replace(/٫/g, ".");
    if (!normalized || normalized === ".") return NaN;
    var number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : NaN;
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) return "";
    var maximumFractionDigits = decimals;
    if (value > 0 && value < 1) maximumFractionDigits = Math.max(decimals, 6);
    return new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: maximumFractionDigits,
      minimumFractionDigits: 0
    }).format(value).replace(/−/g, "-");
  }

  function formatTime(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function convert(amount, from) {
    if (!Number.isFinite(state.rate) || state.rate <= 0 || !Number.isFinite(amount)) return null;
    return from === "usdt" ? amount * state.rate : amount / state.rate;
  }

  function setInput(input, value) {
    writing = true;
    input.value = value;
    writing = false;
  }

  function paintCurrency(container, currency) {
    container.setAttribute("aria-label", currency.name);
    container.innerHTML =
      '<span class="currency-icon ' + currency.iconClass + '" aria-hidden="true">' + currency.icon + "</span>" +
      '<span class="currency-text"><strong>' + currency.name + "</strong><small>" + currency.code + "</small></span>" +
      '<span class="currency-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span>';
  }

  function paintConversion() {
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    var conversionTitle = "تبدیل " + fromCurrency.name + " به " + toCurrency.name;
    elements.pageTitle.textContent = conversionTitle;
    document.title = conversionTitle.replace("تبدیل", "مبدل") + " | نرخ لحظه‌ای USDT";
    paintCurrency(elements.currencyFrom, fromCurrency);
    paintCurrency(elements.currencyTo, toCurrency);

    if (state.edited === "from") {
      var result = convert(state.amount, state.from);
      setInput(elements.amountTo, result === null ? "" : formatNumber(result, toCurrency.decimals));
    } else {
      var reverseResult = convert(state.amount, state.to);
      setInput(elements.amountFrom, reverseResult === null ? "" : formatNumber(reverseResult, fromCurrency.decimals));
    }
  }

  function paintRate() {
    if (!Number.isFinite(state.rate) || state.rate <= 0) {
      elements.rateValue.textContent = state.loading ? "در حال دریافت…" : "نرخ در دسترس نیست";
      elements.rateStatus.classList.toggle("error", !state.loading);
      elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
        (state.loading ? "اتصال به نوبیتکس" : "خطا در دریافت نرخ");
      return;
    }

    elements.rateValue.textContent = "۱ تتر = " + formatNumber(state.rate, 0) + " تومان";
    elements.rateStatus.classList.toggle("error", !state.live);
    elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
      (state.live ? "آخرین به‌روزرسانی " + formatTime(state.updatedAt) : "نمایش آخرین نرخ ذخیره‌شده");
  }

  function paint() {
    paintConversion();
    paintRate();
  }

  function formatInputWhileTyping(input, amount) {
    var raw = input.value;
    if (!Number.isFinite(amount) || /[.٫]/.test(raw)) return;
    var caret = input.selectionStart || raw.length;
    var digitsBefore = toEnglishDigits(raw.slice(0, caret)).replace(/\D/g, "").length;
    var formatted = formatNumber(amount, 0);
    setInput(input, formatted);

    var seen = 0;
    var position = 0;
    while (position < formatted.length && seen < digitsBefore) {
      if (/[۰-۹]/.test(formatted[position])) seen += 1;
      position += 1;
    }
    try { input.setSelectionRange(position, position); } catch (error) { /* unsupported input type */ }
  }

  function onInput(side, input) {
    input.addEventListener("input", function () {
      if (writing) return;
      var amount = parseAmount(input.value);
      state.edited = side;
      state.amount = amount;
      formatInputWhileTyping(input, amount);
      paintConversion();
    });
  }

  function clearLegacyHash() {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function swapCurrencies() {
    var visibleResult = parseAmount(elements.amountTo.value);
    var previousFrom = state.from;
    state.from = state.to;
    state.to = previousFrom;
    state.edited = "from";
    state.amount = Number.isFinite(visibleResult) ? visibleResult : 0;
    setInput(elements.amountFrom, formatNumber(state.amount, currencies[state.from].decimals));
    elements.swap.classList.toggle("turned");
    paint();
    elements.amountFrom.focus();
    elements.amountFrom.select();
  }

  function withTimeout(promise, milliseconds) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("timeout")); }, milliseconds);
      promise.then(function (value) {
        clearTimeout(timer);
        resolve(value);
      }, function (error) {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function fetchJson(url, timeout) {
    return withTimeout(fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }), timeout);
  }

  function loadSnapshot() {
    return fetchJson("data/prices.json?t=" + Date.now(), 5000).then(function (payload) {
      var savedRate = Number(payload.rate || (payload.prices && payload.prices.usdt));
      if (Number.isFinite(savedRate) && savedRate > 0) {
        state.rate = savedRate;
        state.updatedAt = payload.updated ? new Date(payload.updated) : null;
        state.live = false;
        paint();
      }
    }).catch(function () { /* snapshot is only a fallback */ });
  }

  function extractNobitexRate(payload) {
    var stats = payload && payload.stats;
    var market = stats && (stats["usdt-rls"] || stats.USDTIRT || stats.usdt_rls);
    var rial = Number(market && market.latest);
    if (!Number.isFinite(rial) || rial <= 0) throw new Error("invalid payload");
    return rial / 10;
  }

  function loadLiveRate() {
    var endpoints = [
      "https://api.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls",
      "https://apiv2.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls"
    ];

    function attempt(index) {
      if (index >= endpoints.length) return Promise.reject(new Error("Nobitex unavailable"));
      return fetchJson(endpoints[index], 8000).catch(function () { return attempt(index + 1); });
    }

    state.loading = true;
    elements.refresh.classList.add("loading");
    elements.refresh.disabled = true;
    paintRate();

    return attempt(0).then(function (payload) {
      state.rate = extractNobitexRate(payload);
      state.updatedAt = new Date();
      state.live = true;
      state.loading = false;
      paint();
    }).catch(function () {
      state.loading = false;
      state.live = false;
      paint();
    }).finally(function () {
      elements.refresh.classList.remove("loading");
      elements.refresh.disabled = false;
    });
  }

  clearLegacyHash();
  onInput("from", elements.amountFrom);
  onInput("to", elements.amountTo);
  elements.swap.addEventListener("click", swapCurrencies);
  elements.refresh.addEventListener("click", loadLiveRate);
  paint();
  loadSnapshot().finally(loadLiveRate);
})();
