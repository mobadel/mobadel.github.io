(function () {
  "use strict";

  var rows = document.getElementById("home-market-rows");
  if (!rows) return;

  var definitions = [
    { id: "usd", name: "دلار", code: "USD", url: "/price/currency/usd/", icon: "/assets/flags/us.svg", source: "proxy" },
    { id: "usdt", name: "تتر", code: "USDT", url: "/price/crypto/usdt/", icon: "/assets/usdt-logo.svg", source: "toman" },
    { id: "gold18", name: "طلای ۱۸ عیار", code: "", url: "/price/gold/gold18/", icon: "/assets/gold-18k.svg", source: "proxy" },
    { id: "emami", name: "سکه امامی", code: "", url: "/price/coin/emami/", icon: "/assets/coin-emami.webp?v=20260825-2", source: "proxy" },
    { id: "btc", name: "بیت کوین", code: "BTC", url: "/price/crypto/btc/", icon: "/assets/crypto-icons/btc.svg", source: "usdt" },
    { id: "eur", name: "یورو", code: "EUR", url: "/price/currency/eur/", icon: "/assets/flags/eu.svg", source: "proxy" }
  ];

  function getJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  function number(value, digits) {
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits == null ? 0 : digits }).format(value);
  }

  function changeText(value) {
    if (!Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + number(value, 2) + "٪";
  }

  function paint(stats, proxy) {
    rows.replaceChildren();
    definitions.forEach(function (definition) {
      var price = NaN; var change = NaN; var unit = "تومان";
      if (definition.source === "proxy") {
        var proxyRow = proxy && proxy.assets && proxy.assets[definition.id];
        price = Number(proxyRow && proxyRow.toman); change = Number(proxyRow && proxyRow.change);
      } else if (definition.source === "toman") {
        var tomanRow = stats && stats.stats && stats.stats[definition.id + "-rls"];
        price = Number(tomanRow && tomanRow.latest) / 10; change = Number(tomanRow && tomanRow.dayChange);
      } else {
        var usdtRow = stats && stats.stats && stats.stats[definition.id + "-usdt"];
        price = Number(usdtRow && usdtRow.latest); change = Number(usdtRow && usdtRow.dayChange); unit = "تتر";
      }

      var link = document.createElement("a"); link.className = "home-market-row"; link.href = definition.url;
      var identity = document.createElement("span"); identity.className = "home-market-identity";
      var icon = document.createElement("span"); icon.className = "home-market-icon";
      var image = document.createElement("img"); image.src = definition.icon; image.alt = ""; icon.appendChild(image);
      var label = document.createElement("span"); label.className = "home-market-label";
      var strong = document.createElement("strong"); strong.textContent = definition.name;
      var small = document.createElement("small"); small.textContent = definition.code;
      label.append(strong, small); identity.append(icon, label);
      var priceCell = document.createElement("span"); priceCell.className = "home-market-price";
      priceCell.textContent = Number.isFinite(price) && price > 0 ? number(price, price < 1 ? 6 : 0) + " " + unit : "ناموجود";
      var changeCell = document.createElement("span"); changeCell.className = "home-market-change " + (change > 0 ? "positive" : change < 0 ? "negative" : "neutral"); changeCell.textContent = changeText(change);
      link.append(identity, priceCell, changeCell); rows.appendChild(link);
    });
  }

  Promise.allSettled([
    getJson("https://apiv2.nobitex.ir/market/stats"),
    getJson("/api/rates.php?t=" + Date.now())
  ]).then(function (results) {
    paint(results[0].status === "fulfilled" ? results[0].value : null, results[1].status === "fulfilled" ? results[1].value : null);
  });
}());
