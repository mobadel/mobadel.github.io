(function () {
  "use strict";

  if (!/^\/price\/crypto\/btc\/?$/.test(location.pathname)) return;

  var API = "https://apiv2.nobitex.ir/market/udf/history";
  var RANGE_CONFIG = {
    "24h": { resolution: "60", seconds: 86400 },
    "7d": { resolution: "240", seconds: 7 * 86400 },
    "1m": { resolution: "D", seconds: 30 * 86400 },
    "1y": { resolution: "D", seconds: 365 * 86400 },
    all: { resolution: "D", from: 1483228800, paged: true }
  };
  var cache = {};
  var activeRange = "24h";
  var activePoints = [];
  var requestController = null;

  var section = document.getElementById("btc-price-chart");
  var stage = document.getElementById("btc-chart-stage");
  var svg = document.getElementById("btc-chart-svg");
  var grid = document.getElementById("btc-chart-grid");
  var area = document.getElementById("btc-chart-area");
  var line = document.getElementById("btc-chart-line");
  var crosshair = document.getElementById("btc-chart-crosshair");
  var marker = document.getElementById("btc-chart-marker");
  var tooltip = document.getElementById("btc-chart-tooltip");
  var tooltipDate = document.getElementById("btc-chart-tooltip-date");
  var tooltipPrice = document.getElementById("btc-chart-tooltip-price");
  var status = document.getElementById("btc-chart-status");
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-chart-range]"));

  if (!section || !stage || !svg) return;
  section.hidden = false;

  var priceFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
  var dateFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric"
  });
  var dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  function fetchJson(url, signal) {
    return fetch(url, { signal: signal, headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) throw new Error("http_" + response.status);
      return response.json();
    });
  }

  function fetchPage(config, from, to, page, signal) {
    var params = new URLSearchParams({
      symbol: "BTCUSDT",
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
      cache[range] = normalized;
      return normalized;
    });
  }

  function pathFor(points, width, height, padding, min, max) {
    var span = max - min || 1;
    return points.map(function (point, index) {
      var x = padding + index * (width - padding * 2) / Math.max(1, points.length - 1);
      var y = padding + (max - point.price) * (height - padding * 2) / span;
      return { x: x, y: y, command: (index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2) };
    });
  }

  function renderGrid(width, height, padding) {
    grid.replaceChildren();
    for (var index = 0; index < 5; index += 1) {
      var y = padding + index * (height - padding * 2) / 4;
      var rule = document.createElementNS("http://www.w3.org/2000/svg", "line");
      rule.setAttribute("x1", padding);
      rule.setAttribute("x2", width - padding);
      rule.setAttribute("y1", y);
      rule.setAttribute("y2", y);
      grid.appendChild(rule);
    }
  }

  function renderChart(points) {
    activePoints = points.slice().sort(function (a, b) { return a.time - b.time; });
    var width = Math.max(280, stage.clientWidth);
    var height = Math.max(220, svg.clientHeight || 300);
    var padding = 18;
    var prices = activePoints.map(function (point) { return point.price; });
    var min = Math.min.apply(Math, prices);
    var max = Math.max.apply(Math, prices);
    var margin = Math.max((max - min) * 0.08, max * 0.002);
    min -= margin;
    max += margin;
    var plotted = pathFor(activePoints, width, height, padding, min, max);
    var linePath = plotted.map(function (point) { return point.command; }).join(" ");
    var floor = height - padding;
    var areaPath = linePath + " L" + plotted[plotted.length - 1].x.toFixed(2) + " " + floor + " L" + plotted[0].x.toFixed(2) + " " + floor + " Z";

    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    renderGrid(width, height, padding);
    line.setAttribute("d", linePath);
    area.setAttribute("d", areaPath);
    svg.dataset.width = String(width);
    svg.dataset.padding = String(padding);
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
    var padding = Number(svg.dataset.padding);
    var width = Number(svg.dataset.width);
    var relative = Math.max(0, Math.min(rect.width, clientX - rect.left));
    var chartX = relative / rect.width * width;
    var ratio = (chartX - padding) / Math.max(1, width - padding * 2);
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
    tooltipDate.textContent = (activeRange === "24h" || activeRange === "7d" ? dateTimeFormatter : dateFormatter).format(new Date(point.time * 1000));
    tooltipPrice.textContent = priceFormatter.format(point.price) + " تتر";
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
    loadRange(range).then(renderChart).catch(function (error) {
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
  stage.addEventListener("pointerleave", hideTooltip);
  window.addEventListener("resize", function () {
    if (activePoints.length) renderChart(activePoints);
  });

  selectRange(activeRange);
})();
