#!/usr/bin/env node
/*
 * انتشار خودکار قیمت‌ها در کانال تلگرام تبدکس (t.me/tabdexir)، هر ساعت راس ساعت تهران.
 *
 * چرا روی GitHub Actions و نه سرور پارس‌پک: تلگرام در ایران فیلتر است و
 * سرور ایرانی بدون پراکسی به api.telegram.org نمی‌رسد. ریپو عمومی است،
 * پس دقیقه‌های Actions برایش رایگان و نامحدود است.
 *
 * کرون گیت‌هاب سر وقت اجرا نمی‌شود (معمولاً چند دقیقه، گاهی بیشتر، تأخیر
 * دارد و گاهی ساعت‌ها اصلاً اجرا نمی‌شود). پس ورک‌فلو چند دقیقه زودتر از
 * یک کرون دقیق بیرونی صدا زده می‌شود و این اسکریپت تا راس ساعت (SLOT) صبر
 * می‌کند. جزئیات و جلوگیری از پست تکراری در telegram-prices.yml است.
 *
 * منابع همان منابع سایت‌اند تا عدد کانال با عدد سایت یکی باشد:
 *   - ارز، طلا، سکه، فلزات، انرژی: https://tabdex.ir/api/rates.php
 *   - ارز دیجیتال: نوبیتکس (apiv2)، مثل assets/app.js
 *
 * بدون TELEGRAM_BOT_TOKEN فقط متن پست را چاپ می‌کند (dry run).
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "@tabdexir";
const UA = "tabdex-telegram/1.0 (+https://tabdex.ir)";

/* علامت راست‌به‌چپ (RLM). تلگرام جهت هر خط را از اولین نویسهٔ «قوی» حدس
   می‌زند و پرچم/ایموجی خنثی‌اند، پس خط‌هایی مثل «🇺🇸 دلار» گاهی چپ‌چین
   می‌شدند. RLM اول هر خط جهت را راست‌به‌چپ قفل می‌کند. */
const RLM = "‏";

/* هر بخش = یک عنوان و چند ردیف. افزودن/حذف دارایی = یک ردیف.
   src: "brs" یعنی کلید پاسخ rates.php، "nobitex" یعنی جفت بازار نوبیتکس.
   usd: true یعنی قیمت دلاری نمایش داده شود. */
const SECTIONS = [
  {
    title: "ارز",
    items: [
      { src: "brs", id: "usd", emoji: "🇺🇸", label: "دلار" },
      { src: "brs", id: "eur", emoji: "🇪🇺", label: "یورو" },
      { src: "brs", id: "aed", emoji: "🇦🇪", label: "درهم امارات" },
      { src: "brs", id: "iqd", emoji: "🇮🇶", label: "دینار عراق" },
      { src: "brs", id: "afn", emoji: "🇦🇫", label: "افغانی" },
    ],
  },
  {
    title: "طلا و سکه",
    items: [
      { src: "brs", id: "gold18", emoji: "🟡", label: "طلای ۱۸ عیار (گرم)" },
      { src: "brs", id: "goldounce", emoji: "🟡", label: "انس جهانی طلا", usd: true },
      { src: "brs", id: "emami", emoji: "🪙", label: "سکه امامی" },
      { src: "brs", id: "halfcoin", emoji: "🪙", label: "نیم‌سکه" },
      { src: "brs", id: "quartercoin", emoji: "🪙", label: "ربع‌سکه" },
    ],
  },
  {
    title: "فلزات",
    items: [
      { src: "brs", id: "silver", emoji: "🥈", label: "نقره ۹۹۹ (گرم)" },
      { src: "brs", id: "copper", emoji: "🥉", label: "مس (کیلوگرم)" },
    ],
  },
  {
    title: "ارز دیجیتال",
    items: [
      { src: "nobitex", id: "usdt-rls", emoji: "🔸", label: "تتر" },
      { src: "nobitex", id: "btc-usdt", emoji: "🔸", label: "بیت‌کوین", usd: true },
      { src: "nobitex", id: "eth-usdt", emoji: "🔸", label: "اتریوم", usd: true },
    ],
  },
  {
    title: "نفت و بنزین",
    items: [
      { src: "brs", id: "brent", emoji: "🛢", label: "نفت برنت", usd: true },
      { src: "brs", id: "gasoline", emoji: "⛽️", label: "بنزین آمریکا", usd: true },
    ],
  },
];

/* ارقام فارسی با جداکنندهٔ «,» و ممیز «.»، مطابق نمونهٔ پست. */
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function fa(n, maxDecimals = 0) {
  let [int, dec] = Number(n).toFixed(maxDecimals).split(".");
  dec = dec ? dec.replace(/0+$/, "") : "";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = dec ? `${grouped}.${dec}` : grouped;
  return out.replace(/\d/g, (d) => FA_DIGITS[d]);
}

/* زیر ۱۰۰۰ دو رقم اعشار (دینار، نفت)، بالاتر عدد صحیح. */
const amount = (v) => fa(v, Math.abs(v) < 1000 ? 2 : 0);

/* قالب «(٪۱.۲-)» همان‌طور که در نمونه آمده. */
function change(pct) {
  const v = Number(pct);
  if (pct === null || pct === undefined || !Number.isFinite(v)) return "";
  const r = Math.round(v * 10) / 10;
  if (r === 0) return " (٪۰)";
  return ` (٪${fa(Math.abs(r), 1)}${r > 0 ? "+" : "-"})`;
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
    /* t= تا هیچ کش میانی (CDN، پراکسی) نسخهٔ قدیمی ندهد؛ خود سرور هر دقیقه
       تازه می‌شود، پس عدد راس ساعت حداکثر یک دقیقه کهنه است. */
    const data = await getJson(`https://tabdex.ir/api/rates.php?t=${Date.now()}`);
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

/* «جمعه ۲۴ مهر ۱۴۰۵ - ساعت ۱۴:۰۰» به وقت تهران. */
function tehranStamp(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", {
      timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const toFa = (s) => String(s).replace(/[0-9]/g, (x) => FA_DIGITS[x]).replace(/[٠-٩]/g, (x) => FA_DIGITS["٠١٢٣٤٥٦٧٨٩".indexOf(x)]);
  return `${parts.weekday} ${toFa(parts.day)} ${parts.month} ${toFa(parts.year)} - ساعت ${toFa(parts.hour)}:${toFa(parts.minute)}`;
}

async function buildPost() {
  const [assets, rls, usdt] = await Promise.all([
    brsRates(),
    nobitex("usdt", "rls"),
    nobitex("btc,eth", "usdt"),
  ]);
  const stats = { ...rls, ...usdt };

  const lines = [`${RLM}📊 <b>قیمت‌های مهم بازار</b>`, ""];
  let count = 0;

  for (const section of SECTIONS) {
    const rows = [];
    for (const item of section.items) {
      let value = null;
      let pct = null;
      if (item.src === "brs") {
        const a = assets[item.id];
        if (!a || !(a.toman > 0)) continue;
        if (item.usd) {
          if (!(a.usd > 0)) continue;
          value = `${amount(a.usd)} دلار`;
          pct = a.change;
        } else {
          value = `${amount(a.toman)} تومان`;
          pct = a.toman_change ?? a.change;
        }
      } else {
        const s = stats[item.id];
        const latest = s && Number(s.latest);
        if (!(latest > 0)) continue;
        value = item.id.endsWith("-rls") ? `${amount(latest / 10)} تومان` : `${amount(latest)} دلار`;
        pct = s.dayChange;
      }
      rows.push(`${RLM}${item.emoji} ${item.label}: ${value}${change(pct)}`);
    }
    if (!rows.length) continue;
    count += rows.length;
    lines.push(`${RLM}<b>${section.title}</b>`, "", ...rows, "");
  }

  if (count < 5) {
    throw new Error(`فقط ${count} قیمت آمد؛ پست منتشر نمی‌شود تا کانال عدد ناقص نبیند.`);
  }

  lines.push(
    `${RLM}⏰ ${tehranStamp()}`,
    "",
    `${RLM}📲 <a href="https://tabdex.ir/?utm_source=telegram&amp;utm_medium=channel">Tabdex.ir</a>`,
  );
  return lines.join("\n");
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

/* SLOT (ثانیهٔ یونیکس راس ساعت تهران) را ورک‌فلو حساب می‌کند. اگر در آینده
   است تا همان لحظه صبر می‌کنیم، بعد قیمت می‌گیریم تا عددها مال راس ساعت باشند. */
const SLOT = Number(process.env.SLOT || 0);
if (SLOT > 0) {
  const wait = SLOT * 1000 - Date.now();
  if (wait > 0) {
    console.log(`صبر ${Math.round(wait / 1000)} ثانیه تا راس ساعت تهران`);
    await new Promise((r) => setTimeout(r, wait));
  }
}
const text = await buildPost();
console.log(text);
if (!TOKEN) {
  console.log("::notice::TELEGRAM_BOT_TOKEN تعریف نشده؛ فقط پیش‌نمایش چاپ شد.");
} else {
  await send(text);
}
