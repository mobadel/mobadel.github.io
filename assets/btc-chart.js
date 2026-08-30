(function () {
  "use strict";

  var routeMatch = location.pathname.match(/^\/price\/crypto\/(btc|usdt)\/?$/);
  if (!routeMatch) return;

  var API = "https://apiv2.nobitex.ir/market/udf/history";
  var MARKETS = {
    btc: {
      symbol: "BTCUSDT", statsKey: "btc-usdt", src: "btc", dst: "usdt", liveScale: 1,
      title: "نمودار قیمت بیت کوین", unit: "تتر", source: "بر اساس داده‌های بازار «بیت کوین/تتر»"
    },
    usdt: {
      symbol: "USDTIRT", statsKey: "usdt-irt", src: "usdt", dst: "irt", liveScale: 0.1,
      title: "نمودار قیمت تتر", unit: "تومان", source: "بر اساس داده‌های بازار «تتر/تومان»"
    }
  };
  var marketConfig = MARKETS[routeMatch[1]];
  var STATS_API = "https://apiv2.nobitex.ir/market/stats?srcCurrency=" + marketConfig.src + "&dstCurrency=" + marketConfig.dst;
  var RANGE_CONFIG = {
    "24h": { resolution: "15", seconds: 86400 },
    "7d": { resolution: "60", seconds: 7 * 86400 },
    "1m": { resolution: "240", seconds: 30 * 86400 },
    "1y": { resolution: "D", seconds: 365 * 86400 },
    all: { resolution: "D", from: 1483228800, paged: true, weekly: true }
  };
  var cache = {};
  var activeRange = "24h";
  var activePoints = [];
  var requestController = null;

  var section = document.getElementById("btc-price-chart");
  var stage = document.getElementById("btc-chart-stage");
  var svg = document.getElementById("btc-chart-svg");
  var xAxis = document.getElementById("btc-chart-x-axis");
  var area = document.getElementById("btc-chart-area");
  var line = document.getElementById("btc-chart-line");
  var crosshair = document.getElementById("btc-chart-crosshair");
  var marker = document.getElementById("btc-chart-marker");
  var tooltip = document.getElementById("btc-chart-tooltip");
  var tooltipDate = document.getElementById("btc-chart-tooltip-date");
  var tooltipPrice = document.getElementById("btc-chart-tooltip-price");
  var status = document.getElementById("btc-chart-status");
  var chartTitle = document.getElementById("btc-chart-title");
  var chartSource = section && section.querySelector(".btc-chart-source");
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-chart-range]"));

  if (!section || !stage || !svg) return;
  chartTitle.textContent = marketConfig.title;
  chartSource.textContent = marketConfig.source;
  svg.setAttribute("aria-label", "نمودار تاریخی " + marketConfig.title.replace("نمودار ", "") + " به " + marketConfig.unit);
  section.hidden = false;

  var priceFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
  var dateFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric"
  });
  var dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  var axisTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit"
  });
  var axisDateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", month: "numeric", day: "numeric", hour: "2-digit"
  });
  var axisDayFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", month: "long", day: "numeric"
  });
  var axisMonthFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", month: "long"
  });
  var axisYearFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", year: "numeric"
  });

  function fetchJson(url, signal) {
    return fetch(url, { signal: signal, headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) throw new Error("http_" + response.status);
      return response.json();
    });
  }

  function fetchPage(config, from, to, page, signal) {
    var params = new URLSearchParams({
      symbol: marketConfig.symbol,
      resolution: config.resolution,
      from: String(from),
      to: String(to),
      page: String(page)
    });
    return fetchJson(API + "?" + params.toString(), signal);
  }

  function pointsFromPayload(payload) {
    if (!payload || payload.s !== "ok" || !Array.isArray(payload.t) || !Array.isArray(payload.c)) return [];
    return payload.t.map(function (time, index) {
      return { time: Number(time), price: Number(payload.c[index]) };
    }).filter(function (point) {
      return Number.isFinite(point.time) && Number.isFinite(point.price);
    });
  }

  function aggregateWeekly(points) {
    var buckets = {};
    points.forEach(function (point) {
      buckets[Math.floor(point.time / 604800)] = point;
    });
    return Object.keys(buckets).map(function (key) { return buckets[key]; }).sort(function (a, b) {
      return a.time - b.time;
    });
  }

  function fetchLivePoint(signal) {
    return fetchJson(STATS_API, signal).then(function (payload) {
      var market = payload && payload.stats && payload.stats[marketConfig.statsKey];
      var price = market && Number(market.latest) * marketConfig.liveScale;
      if (!Number.isFinite(price)) throw new Error("no_live_price");
      return { time: Math.floor(Date.now() / 1000), price: price, live: true };
    });
  }

  function appendLivePoint(points, livePoint) {
    var normalized = points.filter(function (point) { return !point.live; }).sort(function (a, b) { return a.time - b.time; });
    if (normalized.length && normalized[normalized.length - 1].time === livePoint.time) normalized.pop();
    normalized.push(livePoint);
    return normalized;
  }

  function loadRange(range) {
    if (cache[range]) return Promise.resolve(cache[range]);
    var config = RANGE_CONFIG[range];
    var to = Math.floor(Date.now() / 1000);
    var from = config.from || to - config.seconds;

    if (!config.paged) {
      return fetchPage(config, from, to, 1, requestController.signal).then(function (payload) {
        var points = pointsFromPayload(payload);
        if (!points.length) throw new Error("no_data");
        cache[range] = points;
        return points;
      });
    }

    var collected = [];
    function next(page) {
      if (page > 10) return Promise.resolve(collected);
      return fetchPage(config, from, to, page, requestController.signal).then(function (payload) {
        var points = pointsFromPayload(payload);
        if (!points.length) return collected;
        collected = collected.concat(points);
        return next(page + 1);
      });
    }
    return next(1).then(function (points) {
      var unique = {};
      points.forEach(function (point) { unique[point.time] = point; });
      var normalized = Object.keys(unique).map(function (key) { return unique[key]; });
      if (!normalized.length) throw new Error("no_data");
      normalized = config.weekly ? aggregateWeekly(normalized) : normalized;
      cache[range] = normalized;
      return normalized;
    });
  }

  function pathFor(points, width, height, padding, min, max) {
    var span = max - min || 1;
    return points.map(function (point, index) {
      var x = padding.left + index * (width - padding.left - padding.right) / Math.max(1, points.length - 1);
      var y = padding.top + (max - point.price) * (height - padding.top - padding.bottom) / span;
      return { x: x, y: y, command: (index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2) };
    });
  }

  function renderXAxis(points, width, height, padding) {
    xAxis.replaceChildren();
    var labelCount = width < 520 ? 4 : Math.max(5, Math.min(8, Math.floor(width / 105)));
    var axisInset = width < 520 ? 27 : 38;
    for (var index = 0; index < labelCount; index += 1) {
      var pointIndex = Math.round(index * (points.length - 1) / Math.max(1, labelCount - 1));
      var point = points[pointIndex];
      var x = axisInset + index * (width - axisInset * 2) / Math.max(1, labelCount - 1);
      var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      var formatter = activeRange === "24h" ? axisTimeFormatter : (activeRange === "7d" || activeRange === "1m" ? axisDayFormatter : axisMonthFormatter);
      label.setAttribute("x", x);
      label.setAttribute("y", height - 8);
      label.setAttribute("text-anchor", "middle");
      var labelDate = new Date(point.time * 1000);
      label.textContent = activeRange === "1y" || activeRange === "all"
        ? axisMonthFormatter.format(labelDate) + " " + axisYearFormatter.format(labelDate)
        : formatter.format(labelDate);
      xAxis.appendChild(label);
    }
  }

  function renderChart(points) {
    activePoints = points.slice().sort(function (a, b) { return a.time - b.time; });
    var width = Math.max(280, stage.clientWidth);
    var height = stage.clientWidth < 520 ? 250 : 300;
    var sidePadding = stage.clientWidth < 520 ? 3 : 7;
    var padding = { top: 12, right: sidePadding, bottom: 34, left: sidePadding };
    var prices = activePoints.map(function (point) { return point.price; });
    var min = Math.min.apply(Math, prices);
    var max = Math.max.apply(Math, prices);
    var margin = Math.max((max - min) * 0.08, max * 0.002);
    min -= margin;
    max += margin;
    var plotted = pathFor(activePoints, width, height, padding, min, max);
    var linePath = plotted.map(function (point) { return point.command; }).join(" ");
    var floor = height - padding.bottom;
    var areaPath = linePath + " L" + plotted[plotted.length - 1].x.toFixed(2) + " " + floor + " L" + plotted[0].x.toFixed(2) + " " + floor + " Z";

    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    crosshair.setAttribute("y1", padding.top);
    crosshair.setAttribute("y2", height - padding.bottom);
    renderXAxis(activePoints, width, height, padding);
    line.setAttribute("d", linePath);
    area.setAttribute("d", areaPath);
    svg.dataset.width = String(width);
    svg.dataset.paddingLeft = String(padding.left);
    svg.dataset.paddingRight = String(padding.right);
    svg.dataset.points = JSON.stringify(plotted.map(function (point) { return [point.x, point.y]; }));
    status.hidden = true;
    svg.removeAttribute("hidden");
  }

  function hideTooltip() {
    tooltip.hidden = true;
    crosshair.setAttribute("hidden", "");
    marker.setAttribute("hidden", "");
  }

  function showPoint(clientX) {
    if (!activePoints.length) return;
    var rect = svg.getBoundingClientRect();
    var paddingLeft = Number(svg.dataset.paddingLeft);
    var paddingRight = Number(svg.dataset.paddingRight);
    var width = Number(svg.dataset.width);
    var relative = Math.max(0, Math.min(rect.width, clientX - rect.left));
    var chartX = relative / rect.width * width;
    var ratio = (chartX - paddingLeft) / Math.max(1, width - paddingLeft - paddingRight);
    var index = Math.max(0, Math.min(activePoints.length - 1, Math.round(ratio * (activePoints.length - 1))));
    var plotted = JSON.parse(svg.dataset.points || "[]")[index];
    var point = activePoints[index];
    if (!plotted || !point) return;

    crosshair.setAttribute("x1", plotted[0]);
    crosshair.setAttribute("x2", plotted[0]);
    marker.setAttribute("cx", plotted[0]);
    marker.setAttribute("cy", plotted[1]);
    crosshair.removeAttribute("hidden");
    marker.removeAttribute("hidden");
    tooltipDate.textContent = (activeRange === "24h" || activeRange === "7d" || activeRange === "1m" ? dateTimeFormatter : dateFormatter).format(new Date(point.time * 1000));
    tooltipPrice.textContent = priceFormatter.format(point.price) + " " + marketConfig.unit;
    tooltip.hidden = false;
    var tooltipWidth = tooltip.offsetWidth || 145;
    var left = relative - tooltipWidth / 2;
    tooltip.style.left = Math.max(8, Math.min(rect.width - tooltipWidth - 8, left)) + "px";
  }

  function selectRange(range) {
    activeRange = range;
    buttons.forEach(function (button) {
      var active = button.dataset.chartRange === range;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    hideTooltip();
    svg.setAttribute("hidden", "");
    status.hidden = false;
    status.textContent = "در حال دریافت داده‌های نمودار…";
    if (requestController) requestController.abort();
    requestController = new AbortController();
    Promise.all([loadRange(range), fetchLivePoint(requestController.signal)]).then(function (results) {
      renderChart(appendLivePoint(results[0], results[1]));
    }).catch(function (error) {
      if (error && error.name === "AbortError") return;
      status.hidden = false;
      status.textContent = "داده‌های نمودار در حال حاضر در دسترس نیست.";
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () { selectRange(button.dataset.chartRange); });
  });
  stage.addEventListener("pointermove", function (event) { showPoint(event.clientX); });
  stage.addEventListener("pointerdown", function (event) { showPoint(event.clientX); });
  stage.addEventListener("pointerup", function (event) {
    if (event.pointerType !== "mouse") hideTooltip();
  });
  stage.addEventListener("pointercancel", hideTooltip);
  stage.addEventListener("pointerleave", hideTooltip);
  window.addEventListener("resize", function () {
    if (activePoints.length) renderChart(activePoints);
  });
  window.setInterval(function () {
    var rangeAtRequest = activeRange;
    fetchLivePoint().then(function (livePoint) {
      if (rangeAtRequest === activeRange && activePoints.length) renderChart(appendLivePoint(activePoints, livePoint));
    }).catch(function () {});
  }, 60000);

  selectRange(activeRange);
})();
