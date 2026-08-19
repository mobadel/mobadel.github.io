(function () {
  "use strict";

  var DIGIT_MAP = {};
  "۰۱۲۳۴۵۶۷۸۹".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });
  "٠١٢٣٤٥٦٧٨٩".split("").forEach(function (digit, index) { DIGIT_MAP[digit] = String(index); });

  var PERSIAN_NAMES = {
    irt: "تومان", usdt: "تتر", btc: "بیت‌کوین", eth: "اتریوم", ltc: "لایت‌کوین",
    xrp: "ریپل", bch: "بیت‌کوین کش", bnb: "بایننس کوین", doge: "دوج‌کوین",
    xlm: "استلار", trx: "ترون", ada: "کاردانو", xmr: "مونرو", etc: "اتریوم کلاسیک",
    link: "چین‌لینک", dai: "دای", dot: "پولکادات", uni: "یونی‌سواپ", aave: "آوه",
    sol: "سولانا", fil: "فایل‌کوین", grt: "گراف", atom: "کازماس", avax: "آوالانچ",
    near: "نیر", mana: "دیسنترالند", sand: "سندباکس", usdc: "یو‌اس‌دی کوین",
    algo: "الگورند", ton: "تون‌کوین", shib: "شیبا اینو", pepe: "پپه", paxg: "پکس گلد"
  };

  var currencies = {
    irt: { id: "irt", code: "IRT", name: "تومان", englishName: "Toman", decimals: 0, localIcon: "assets/flags/ir.svg" },
    usdt: { id: "usdt", code: "USDT", name: "تتر", englishName: "Tether", decimals: 4, localIcon: "assets/usdt-logo.svg" }
  };

  var state = {
    from: "usdt", to: "irt", amount: 100, edited: "from", rate: null,
    graph: {}, updatedAt: null, live: false, loading: false, dialogSide: null, lastFocused: null
  };

  var elements = {
    amountFrom: document.getElementById("amount-from"), amountTo: document.getElementById("amount-to"),
    currencyFrom: document.getElementById("currency-from"), currencyTo: document.getElementById("currency-to"),
    pageTitle: document.getElementById("page-title"), rateValue: document.getElementById("rate-value"),
    rateStatus: document.getElementById("rate-status"), swap: document.getElementById("swap"),
    refresh: document.getElementById("refresh"), dialog: document.getElementById("asset-dialog"),
    dialogTitle: document.getElementById("asset-dialog-title"), dialogClose: document.getElementById("dialog-close"),
    assetSearch: document.getElementById("asset-search"), assetList: document.getElementById("asset-list"),
    assetEmpty: document.getElementById("asset-empty")
  };

  var writing = false;

  function toEnglishDigits(value) {
    return String(value).replace(/[۰-۹٠-٩]/g, function (digit) { return DIGIT_MAP[digit]; });
  }

  function toPersianDigits(value) {
    return String(value).replace(/\d/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
  }

  function parseAmount(value) {
    var normalized = toEnglishDigits(value).replace(/[\s,٬،]/g, "").replace(/٫/g, ".");
    if (!normalized || normalized === ".") return NaN;
    var number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : NaN;
  }

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) return "";
    var maximumFractionDigits = decimals;
    if (value > 0 && value < 1) maximumFractionDigits = Math.max(decimals, 8);
    if (value > 0 && value < 0.00000001) maximumFractionDigits = 12;
    return new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: Math.min(maximumFractionDigits, 12), minimumFractionDigits: 0
    }).format(value).replace(/−/g, "-");
  }

  function formatTime(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function decimalsFromPrecision(value) {
    var text = String(value || "");
    if (/e-/i.test(text)) return Math.min(Number(text.split(/e-/i)[1]) || 8, 12);
    var dot = text.indexOf(".");
    if (dot === -1) return 0;
    return Math.min(text.slice(dot + 1).replace(/0+$/, "").length, 12);
  }

  function normalizeId(id) {
    id = String(id || "").toLowerCase();
    return id === "rls" ? "irt" : id;
  }

  function displayName(id, englishName) {
    return PERSIAN_NAMES[id] || englishName || id.toUpperCase();
  }

  function getOptionIconUrls(option, id) {
    var values = [
      option.icon, option.iconUrl, option.icon_url, option.iconPath,
      option.logo, option.logoUrl, option.logo_url,
      option.image, option.imageUrl, option.image_url
    ];
    var urls = values.map(function (value) {
      if (typeof value !== "string") return null;
      if (value.indexOf("//") === 0) return "https:" + value;
      if (value.indexOf("/") === 0) return "https://nobitex.ir" + value;
      return value;
    }).filter(function (value) {
      return value && /^https:\/\/([a-z0-9-]+\.)*nobitex\.ir\//i.test(value);
    });
    if (id !== "irt") urls.push("https://cdn.nobitex.ir/crypto/" + encodeURIComponent(id) + ".svg");
    return urls;
  }

  function upsertCurrency(id, option) {
    id = normalizeId(id);
    if (!id || id === "global") return null;
    option = option || {};
    var current = currencies[id] || {};
    var englishName = option.name || current.englishName || id.toUpperCase();
    currencies[id] = {
      id: id, code: id === "irt" ? "IRT" : id.toUpperCase(), name: displayName(id, englishName),
      englishName: englishName,
      decimals: id === "irt" ? 0 : (option.displayPrecision ? decimalsFromPrecision(option.displayPrecision) : (current.decimals == null ? 8 : current.decimals)),
      localIcon: current.localIcon || null, iconUrls: getOptionIconUrls(option, id),
      aliases: current.aliases || []
    };
    return currencies[id];
  }

  function setEdge(from, to, rate) {
    if (!Number.isFinite(rate) || rate <= 0 || from === to) return;
    if (!state.graph[from]) state.graph[from] = {};
    if (!state.graph[to]) state.graph[to] = {};
    state.graph[from][to] = rate;
    state.graph[to][from] = 1 / rate;
  }

  function buildMarketGraph(payload) {
    var stats = payload && payload.stats;
    if (!stats || typeof stats !== "object") throw new Error("invalid market payload");
    state.graph = {};
    Object.keys(stats).forEach(function (key) {
      if (key === "global") return;
      var separator = key.lastIndexOf("-");
      if (separator < 1) return;
      var rawFrom = key.slice(0, separator).toLowerCase();
      var rawTo = key.slice(separator + 1).toLowerCase();
      var from = normalizeId(rawFrom);
      var to = normalizeId(rawTo);
      var market = stats[key];
      var rate = Number(market && market.latest);
      if (!Number.isFinite(rate) || rate <= 0) return;
      if (rawTo === "rls") rate /= 10;
      if (rawFrom === "rls") rate *= 10;
      upsertCurrency(from);
      upsertCurrency(to);
      setEdge(from, to, rate);
    });
    if (!Object.keys(state.graph).length) throw new Error("empty market graph");
  }

  function applyOptions(payload) {
    var coins = payload && payload.coins;
    if (!Array.isArray(coins)) return;
    coins.forEach(function (coin) {
      var id = normalizeId(coin && coin.coin);
      if (currencies[id]) upsertCurrency(id, coin);
    });
  }

  function applyCurrencyNames(payload) {
    var names = payload && payload.currencies;
    if (!names || typeof names !== "object") return;
    Object.keys(names).forEach(function (rawId) {
      var id = normalizeId(rawId);
      var currency = currencies[id];
      var item = names[rawId];
      if (!currency || !item) return;
      currency.name = item.fa || currency.name;
      currency.englishName = item.en || currency.englishName || currency.code;
      currency.aliases = item.alt ? [item.alt] : [];
    });
  }

  function directRate(from, to) {
    return state.graph[from] && state.graph[from][to];
  }

  function findRate(from, to) {
    if (from === to) return 1;
    var direct = directRate(from, to);
    if (direct) return direct;
    if (from === "irt" || to === "irt") return null;
    var viaIrtA = directRate(from, "irt");
    var viaIrtB = directRate("irt", to);
    if (viaIrtA && viaIrtB) return viaIrtA * viaIrtB;
    var viaUsdtA = directRate(from, "usdt");
    var viaUsdtB = directRate("usdt", to);
    if (viaUsdtA && viaUsdtB) return viaUsdtA * viaUsdtB;
    return null;
  }

  function updateRate() { state.rate = findRate(state.from, state.to); }

  function convertEditedAmount() {
    if (!Number.isFinite(state.rate) || state.rate <= 0 || !Number.isFinite(state.amount)) return null;
    return state.edited === "from" ? state.amount * state.rate : state.amount / state.rate;
  }

  function setInput(input, value) {
    writing = true; input.value = value; writing = false;
  }

  function createCurrencyIcon(currency, className) {
    var wrap = document.createElement("span");
    wrap.className = "currency-icon" + (className ? " " + className : "");
    wrap.setAttribute("aria-hidden", "true");
    if (currency.localIcon || (currency.iconUrls && currency.iconUrls.length)) {
      var image = document.createElement("img");
      var sources = (currency.localIcon ? [currency.localIcon] : []).concat(currency.iconUrls || []);
      var index = 0;
      image.alt = "";
      image.src = sources[index];
      image.addEventListener("error", function () {
        index += 1;
        if (sources[index]) image.src = sources[index];
        else {
          image.remove(); wrap.classList.add("letter-icon"); wrap.textContent = currency.code.slice(0, 2);
        }
      });
      wrap.appendChild(image);
    } else {
      wrap.classList.add("letter-icon"); wrap.textContent = currency.code.slice(0, 2);
    }
    return wrap;
  }

  function paintCurrency(container, currency) {
    container.setAttribute("aria-label", "انتخاب " + currency.name);
    container.replaceChildren();
    container.appendChild(createCurrencyIcon(currency));
    var label = document.createElement("span");
    label.className = "currency-text";
    var code = document.createElement("strong"); code.textContent = currency.code;
    var name = document.createElement("small"); name.textContent = currency.name;
    label.append(code, name); container.appendChild(label);
    var chevron = document.createElement("span");
    chevron.className = "currency-chevron"; chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML = '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>';
    container.appendChild(chevron);
  }

  function paintConversion() {
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    if (!fromCurrency || !toCurrency) return;
    elements.pageTitle.textContent = "تبدیل " + fromCurrency.name + " به " + toCurrency.name;
    paintCurrency(elements.currencyFrom, fromCurrency);
    paintCurrency(elements.currencyTo, toCurrency);
    var result = convertEditedAmount();
    if (state.edited === "from") setInput(elements.amountTo, result === null ? "" : formatNumber(result, toCurrency.decimals));
    else setInput(elements.amountFrom, result === null ? "" : formatNumber(result, fromCurrency.decimals));
  }

  function paintRate() {
    var fromCurrency = currencies[state.from];
    var toCurrency = currencies[state.to];
    if (!Number.isFinite(state.rate) || state.rate <= 0) {
      elements.rateValue.textContent = state.loading ? "در حال دریافت…" : "نرخ این تبدیل در دسترس نیست";
      elements.rateStatus.classList.toggle("error", !state.loading);
      elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
        (state.loading ? "اتصال به نوبیتکس" : "بازار مستقیم تومانی موجود نیست");
      return;
    }
    elements.rateValue.textContent = "۱ " + fromCurrency.name + " = " + formatNumber(state.rate, toCurrency.decimals) + " " + toCurrency.name;
    elements.rateStatus.classList.toggle("error", !state.live);
    elements.rateStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>' +
      (state.live ? "آخرین به‌روزرسانی " + formatTime(state.updatedAt) : "نمایش آخرین نرخ ذخیره‌شده");
  }

  function paint() { updateRate(); paintConversion(); paintRate(); }

  function editableTokens(value) {
    var normalized = toEnglishDigits(value).replace(/٫/g, ".");
    var seenDecimal = false; var tokens = 0;
    normalized.split("").forEach(function (character) {
      if (/\d/.test(character)) tokens += 1;
      else if (character === "." && !seenDecimal) { seenDecimal = true; tokens += 1; }
    });
    return tokens;
  }

  function formatEditableAmount(value) {
    var normalized = toEnglishDigits(value).replace(/[\s,٬،]/g, "").replace(/٫/g, ".");
    var integer = ""; var fraction = ""; var seenDecimal = false;
    normalized.split("").forEach(function (character) {
      if (/\d/.test(character)) {
        if (seenDecimal) fraction += character;
        else integer += character;
      } else if (character === "." && !seenDecimal) {
        seenDecimal = true;
      }
    });
    if (!integer && seenDecimal) integer = "0";
    integer = integer.replace(/^0+(?=\d)/, "");
    var grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
    return toPersianDigits(grouped + (seenDecimal ? "٫" + fraction : ""));
  }

  function formatInputWhileTyping(input) {
    var raw = input.value;
    var caret = input.selectionStart == null ? raw.length : input.selectionStart;
    var tokensBeforeCaret = editableTokens(raw.slice(0, caret));
    var formatted = formatEditableAmount(raw);
    setInput(input, formatted);
    var seen = 0; var position = 0;
    while (position < formatted.length && seen < tokensBeforeCaret) {
      if (/[۰-۹٫]/.test(formatted[position])) seen += 1;
      position += 1;
    }
    try { input.setSelectionRange(position, position); } catch (error) { /* unsupported input type */ }
    return parseAmount(formatted);
  }

  function onInput(side, input) {
    input.addEventListener("input", function () {
      if (writing) return;
      var amount = formatInputWhileTyping(input);
      state.edited = side; state.amount = amount;
      paintConversion();
    });
  }

  function clearLegacyHash() {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function swapCurrencies() {
    var visibleResult = parseAmount(elements.amountTo.value);
    var previousFrom = state.from;
    state.from = state.to; state.to = previousFrom; state.edited = "from";
    state.amount = Number.isFinite(visibleResult) ? visibleResult : 0;
    setInput(elements.amountFrom, formatNumber(state.amount, currencies[state.from].decimals));
    elements.swap.classList.toggle("turned"); paint();
    if (elements.dialog.hidden) { elements.amountFrom.focus(); elements.amountFrom.select(); }
  }

  function availableCurrencies() {
    return Object.keys(currencies).filter(function (id) {
      return id === "irt" || (state.graph[id] && Object.keys(state.graph[id]).length);
    }).map(function (id) { return currencies[id]; }).sort(function (a, b) {
      var priority = { irt: 0, usdt: 1, btc: 2, eth: 3 };
      var aPriority = priority[a.id] == null ? 99 : priority[a.id];
      var bPriority = priority[b.id] == null ? 99 : priority[b.id];
      return aPriority - bPriority || a.code.localeCompare(b.code, "en");
    });
  }

  function normalizedSearch(value) {
    return toEnglishDigits(value).trim().toLowerCase().replace(/[_‌\s-]+/g, " ");
  }

  function renderAssetList() {
    var query = normalizedSearch(elements.assetSearch.value);
    var assets = availableCurrencies().filter(function (currency) {
      var haystack = normalizedSearch([currency.code, currency.name, currency.englishName].concat(currency.aliases || []).join(" "));
      return !query || haystack.indexOf(query) !== -1;
    });
    elements.assetList.replaceChildren();
    elements.assetEmpty.hidden = assets.length > 0;
    assets.forEach(function (currency) {
      var option = document.createElement("button");
      option.className = "asset-option"; option.type = "button"; option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(currency.id === state[state.dialogSide]));
      option.dataset.currency = currency.id;
      option.appendChild(createCurrencyIcon(currency, "asset-option-icon"));
      var label = document.createElement("span"); label.className = "asset-option-label";
      var name = document.createElement("strong"); name.textContent = currency.name;
      var english = document.createElement("small");
      english.textContent = currency.englishName || currency.code;
      label.append(name, english);
      var code = document.createElement("b"); code.className = "asset-option-code"; code.textContent = currency.code;
      option.append(label, code);
      option.addEventListener("click", function () { selectCurrency(currency.id); });
      elements.assetList.appendChild(option);
    });
  }

  function openDialog(side) {
    state.dialogSide = side; state.lastFocused = document.activeElement;
    elements.dialogTitle.textContent = side === "from" ? "انتخاب دارایی مبدأ" : "انتخاب دارایی مقصد";
    elements.assetSearch.value = ""; elements.dialog.hidden = false;
    document.body.classList.add("dialog-open"); renderAssetList();
    window.setTimeout(function () { elements.assetSearch.focus(); }, 0);
  }

  function closeDialog() {
    if (elements.dialog.hidden) return;
    elements.dialog.hidden = true; document.body.classList.remove("dialog-open"); state.dialogSide = null;
    if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus();
  }

  function selectCurrency(id) {
    var side = state.dialogSide;
    if (!side || !currencies[id]) return;
    var otherSide = side === "from" ? "to" : "from";
    if (state[otherSide] === id) {
      var previous = state[side]; state[side] = id; state[otherSide] = previous;
    } else state[side] = id;
    state.edited = "from"; state.amount = parseAmount(elements.amountFrom.value);
    closeDialog(); paint();
  }

  function withTimeout(promise, milliseconds) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("timeout")); }, milliseconds);
      promise.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }

  function fetchJson(url, timeout) {
    return withTimeout(fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }), timeout);
  }

  function attemptEndpoints(paths, timeout) {
    var hosts = ["https://api.nobitex.ir", "https://apiv2.nobitex.ir"];
    var urls = [];
    hosts.forEach(function (host) { paths.forEach(function (path) { urls.push(host + path); }); });
    function attempt(index) {
      if (index >= urls.length) return Promise.reject(new Error("Nobitex unavailable"));
      return fetchJson(urls[index], timeout).catch(function () { return attempt(index + 1); });
    }
    return attempt(0);
  }

  function loadSnapshot() {
    return fetchJson("data/prices.json?t=" + Date.now(), 5000).then(function (payload) {
      var savedRate = Number(payload.rate || (payload.prices && payload.prices.usdt));
      if (Number.isFinite(savedRate) && savedRate > 0) {
        setEdge("usdt", "irt", savedRate);
        state.updatedAt = payload.updated ? new Date(payload.updated) : null;
        state.live = false; paint();
      }
    }).catch(function () { /* snapshot is only a fallback */ });
  }

  function loadLiveRates() {
    state.loading = true; elements.refresh.classList.add("loading"); elements.refresh.disabled = true; paintRate();
    var statsRequest = attemptEndpoints(["/market/stats"], 12000);
    var optionsRequest = attemptEndpoints(["/v2/options"], 12000).catch(function () { return null; });
    var namesRequest = fetchJson("data/currencies.json?t=" + Date.now(), 5000).catch(function () { return null; });
    return Promise.all([statsRequest, optionsRequest, namesRequest]).then(function (responses) {
      buildMarketGraph(responses[0]); applyOptions(responses[1]); applyCurrencyNames(responses[2]);
      state.updatedAt = new Date(); state.live = true; state.loading = false; paint();
      if (!elements.dialog.hidden) renderAssetList();
    }).catch(function () {
      state.loading = false; state.live = false; paint();
    }).finally(function () {
      elements.refresh.classList.remove("loading"); elements.refresh.disabled = false;
    });
  }

  clearLegacyHash();
  onInput("from", elements.amountFrom); onInput("to", elements.amountTo);
  elements.swap.addEventListener("click", swapCurrencies);
  elements.refresh.addEventListener("click", loadLiveRates);
  elements.currencyFrom.addEventListener("click", function () { openDialog("from"); });
  elements.currencyTo.addEventListener("click", function () { openDialog("to"); });
  elements.dialogClose.addEventListener("click", closeDialog);
  elements.dialog.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  elements.assetSearch.addEventListener("input", renderAssetList);
  document.addEventListener("keydown", function (event) {
    if (!elements.dialog.hidden && event.key === "Escape") closeDialog();
  });
  paint();
  loadSnapshot().finally(loadLiveRates);
})();
