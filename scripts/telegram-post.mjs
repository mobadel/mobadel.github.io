#!/usr/bin/env node
/*
 * انتشار خودکار قیمت‌ها در کانال تلگرام تبدکس (t.me/tabdexir).
 *
 * چرا روی GitHub Actions و نه سرور پارس‌پک: تلگرام در ایران فیلتر است و
 * سرور ایرانی بدون پراکسی به api.telegram.org نمی‌رسد. ریپو عمومی است،
 * پس دقیقه‌های Actions برایش رایگان و نامحدود است.
 *
 * منابع دقیقاً همان منابع سایت‌اند تا عدد کانال با عدد سایت یکی باشد:
 *   - طلا، سکه، ارز فیات: https://tabdex.ir/api/rates.php (کش مشترک BrsApi)
 *   - ارز دیجیتال: نوبیتکس (apiv2)، مثل assets/app.js
 *
 * بدون TELEGRAM_BOT_TOKEN فقط متن پست را چاپ می‌کند (dry run).
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "@tabdexir";
const UA = "tabdex-telegram/1.0 (+https://tabdex.ir)";

/* افزودن/حذف دارایی = یک ردیف. id همان کلید پاسخ rates.php است. */
const BRS_ITEMS = [
  { id: "usd", label: "دلار آمریکا", emoji: "🇺🇸" },
  { id: "eur", label: "یورو", emoji: "🇪🇺" },
  { id: "gbp", label: "پوند انگلیس", emoji: "🇬🇧" },
  { id: "aed", label: "درهم امارات", emoji: "🇦🇪" },
  { id: "gold18", label: "طلای ۱۸ عیار (گرم)", emoji: "🟡" },
  { id: "emami", label: "سکه امامی", emoji: "🪙" },
  { id: "halfcoin", label: "نیم‌سکه", emoji: "🪙" },
  { id: "quartercoin", label: "ربع‌سکه", emoji: "🪙" },
  { id: "goldounce", label: "انس جهانی طلا", emoji: "🌐", usd: true },
];

/* ارز دیجیتال از نوبیتکس. تتر به تومان، بقیه به دلار (تتر). */
const CRYPTO_ITEMS = [
  { pair: "usdt-rls", label: "تتر", emoji: "💵" },
  { pair: "btc-usdt", label: "بیت‌کوین", emoji: "₿" },
  { pair: "eth-usdt", label: "اتریوم", emoji: "💠" },
];

const fa = (n, digits = 0) =>
  Number(n).toLocaleString("fa-IR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

function change(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return "";
  const v = Number(pct);
  if (Math.abs(v) < 0.005) return " ⚪️ ۰٪";
  const arrow = v > 0 ? "🟢 ▲" : "🔴 ▼";
  return ` ${arrow}${fa(Math.abs(v), 2)}٪`;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, "cache-control": "no-cache" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function brsRates() {
  try {
    const data = await getJson("https://tabdex.ir/api/rates.php");
    return data && data.assets ? data.assets : {};
  } catch (err) {
    console.warn("::warning::rates.php پاسخ نداد:", err.message);
    return {};
  }
}

async function nobitex(src, dst) {
  for (const host of ["https://apiv2.nobitex.ir", "https://api.nobitex.ir"]) {
    try {
      const data = await getJson(`${host}/market/stats?srcCurrency=${src}&dstCurrency=${dst}`);
      if (data && data.stats) return data.stats;
    } catch (err) {
      console.warn(`::warning::نوبیتکس (${host}) پاسخ نداد:`, err.message);
    }
  }
  return {};
}

function tehranStamp() {
  const d = new Date();
  const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return `${date} — ساعت ${time}`;
}

async function buildPost() {
  const [assets, rls, usdt] = await Promise.all([
    brsRates(),
    nobitex("usdt", "rls"),
    nobitex("btc,eth", "usdt"),
  ]);
  const stats = { ...rls, ...usdt };

  const fiatGold = [];
  for (const item of BRS_ITEMS) {
    const a = assets[item.id];
    if (!a || !(a.toman > 0)) continue;
    const pct = a.toman_change ?? a.change;
    const value = item.usd && a.usd ? `${fa(a.usd, 2)} دلار` : `${fa(a.toman)} تومان`;
    fiatGold.push(`${item.emoji} ${item.label}: <b>${value}</b>${change(pct)}`);
  }

  const crypto = [];
  for (const item of CRYPTO_ITEMS) {
    const s = stats[item.pair];
    const latest = s && Number(s.latest);
    if (!(latest > 0)) continue;
    const value = item.pair.endsWith("-rls")
      ? `${fa(latest / 10)} تومان`
      : `${fa(latest, 2)} دلار`;
    crypto.push(`${item.emoji} ${item.label}: <b>${value}</b>${change(s.dayChange)}`);
  }

  if (fiatGold.length + crypto.length < 3) {
    throw new Error("دادهٔ کافی نیامد؛ پست منتشر نمی‌شود تا کانال عدد ناقص نبیند.");
  }

  const parts = [`📊 <b>قیمت لحظه‌ای بازار</b>`, `🗓 ${tehranStamp()}`, ""];
  if (fiatGold.length) parts.push("💱 <b>ارز، طلا و سکه</b>", ...fiatGold, "");
  if (crypto.length) parts.push("🪙 <b>ارز دیجیتال</b>", ...crypto, "");
  parts.push(
    "🔄 تبدیل لحظه‌ای و نمودار: <a href=\"https://tabdex.ir/?utm_source=telegram&amp;utm_medium=channel\">tabdex.ir</a>",
    "🆔 @tabdexir",
  );
  return parts.join("\n");
}

async function send(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(25000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(`تلگرام خطا داد: HTTP ${res.status} ${body.description || ""}`);
  }
  console.log(`منتشر شد: message_id=${body.result.message_id}`);
}

const text = await buildPost();
console.log(text);
if (!TOKEN) {
  console.log("::notice::TELEGRAM_BOT_TOKEN تعریف نشده؛ فقط پیش‌نمایش چاپ شد.");
} else {
  await send(text);
}
