/*
 * ساخت صفحه‌های ایستا برای جفت‌های پرجستجو + سایت‌مپ.
 * هنگام دیپلوی صفحه‌ها را داخل _site می‌سازد و sitemap.xml ریشه را هم
 * با همان خروجی همگام نگه می‌دارد تا نسخهٔ داخل مخزن کهنه نماند.
 *
 * چرا فقط بخشی از جفت‌ها؟ با ۲۸۴ دارایی، تعداد جفت‌های جهت‌دار حدود
 * ۸۰ هزار است. همهٔ آن آدرس‌ها از راه بازنویسی .htaccess کار می‌کنند و
 * جاوااسکریپت عنوان و متا را تنظیم می‌کند؛ ولی برای جفت‌هایی که واقعاً
 * جستجو می‌شوند فایل واقعی با عنوان و توضیحات سرورساخته می‌سازیم تا
 * ایندکس شدنشان به اجرای جاوااسکریپت توسط خزنده وابسته نباشد.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(ROOT, "_site");
const ORIGIN = "https://tabdex.ir";

/* نام‌ها باید با جدول دارایی‌ها در assets/app.js یکی باشند. تست
   tests/pages.test.js این هم‌خوانی را بررسی می‌کند تا از هم جدا نیفتند. */
const ASSETS = {
  irt:  { slug: "irt",  name: "تومان" },
  usdt: { slug: "usdt", name: "تتر" },
  btc:  { slug: "btc",  name: "بیت کوین" },
  eth:  { slug: "eth",  name: "اتریوم" },
  usdc: { slug: "usdc", name: "یو‌اس‌دی کوین" },
  xrp:  { slug: "xrp",  name: "ریپل" },
  doge: { slug: "doge", name: "دوج‌کوین" },
  trx:  { slug: "trx",  name: "ترون" },
  sol:  { slug: "sol",  name: "سولانا" },
  ada:  { slug: "ada",  name: "کاردانو" },
  shib: { slug: "shib", name: "شیبا اینو" },
  gram: { slug: "gram", name: "گرام" },

  gold18:     { slug: "gold18",     name: "طلای ۱۸ عیار", unit: "گرم" },
  gold24:     { slug: "gold24",     name: "طلای ۲۴ عیار", unit: "گرم" },
  goldmelted: { slug: "melted",     name: "طلای آب‌شده",  unit: "مثقال" },
  goldounce:  { slug: "ounce",      name: "انس طلا",      unit: "انس" },

  silver: { slug: "silver", name: "نقره ۹۹۹", unit: "گرم" },
  copper: { slug: "copper", name: "مس",      unit: "کیلو" },

  emami:       { slug: "emami",      name: "سکه امامی",      unit: "عدد" },
  bahar:       { slug: "baharazadi", name: "سکه بهار آزادی", unit: "عدد" },
  halfcoin:    { slug: "nim",        name: "نیم سکه",        unit: "عدد" },
  quartercoin: { slug: "rob",        name: "ربع سکه",        unit: "عدد" },
  gramcoin:    { slug: "gerami",     name: "سکه یک گرمی",    unit: "عدد" },

  usd: { slug: "usd", name: "دلار" },
  eur: { slug: "eur", name: "یورو" },
  gbp: { slug: "gbp", name: "پوند" },
  aed: { slug: "aed", name: "درهم امارات" },
  try: { slug: "try", name: "لیر ترکیه" },
  chf: { slug: "chf", name: "فرانک سوئیس" },
  cad: { slug: "cad", name: "دلار کانادا" },
  aud: { slug: "aud", name: "دلار استرالیا" },
  jpy: { slug: "jpy", name: "یکصد ین ژاپن" },
  cny: { slug: "cny", name: "یوآن چین" },
  rub: { slug: "rub", name: "روبل روسیه" },
  sek: { slug: "sek", name: "کرون سوئد" },
  inr: { slug: "inr", name: "روپیه هند" },
  pkr: { slug: "pkr", name: "روپیه پاکستان" },
  afn: { slug: "afn", name: "افغانی" },
  myr: { slug: "myr", name: "رینگیت مالزی" },
  thb: { slug: "thb", name: "بات تایلند" },
  sar: { slug: "sar", name: "ریال عربستان" },
  qar: { slug: "qar", name: "ریال قطر" },
  kwd: { slug: "kwd", name: "دینار کویت" },
  bhd: { slug: "bhd", name: "دینار بحرین" },
  omr: { slug: "omr", name: "ریال عمان" },
  iqd: { slug: "iqd", name: "دینار عراق" },
  syp: { slug: "syp", name: "لیر سوریه" },
  azn: { slug: "azn", name: "منات آذربایجان" },
  amd: { slug: "amd", name: "درام ارمنستان" },
  gel: { slug: "gel", name: "لاری گرجستان" }
};

// هر کدام از این‌ها در هر دو جهت با تومان صفحه می‌گیرد.
const WITH_TOMAN = [
  "usdt", "btc", "eth", "usdc", "xrp", "doge", "trx", "sol", "ada", "shib", "gram",
  "gold18", "gold24", "goldmelted", "goldounce",
  "emami", "bahar", "halfcoin", "quartercoin", "gramcoin",
  "silver", "copper",
  "usd", "eur", "gbp", "aed", "try", "chf", "cad", "aud", "jpy", "cny",
  "rub", "sek", "inr", "pkr", "afn", "myr", "thb", "sar", "qar", "kwd",
  "bhd", "omr", "iqd", "syp", "azn", "amd", "gel"
];

// همهٔ صفحات قیمت غیرکریپتو ایندکس می‌شوند. برای رمزارزها عمداً فقط
// ۵۰ دارایی مهم و پرشناخت در سایت‌مپ می‌آیند تا نقشهٔ سایت روی صفحات
// باارزش‌تر متمرکز بماند. شناسه‌ها با data/currencies.json هم‌خوان‌اند.
const PRICE_GROUPS = {
  currency: ["usd", "eur", "gbp", "chf", "aed", "try", "jpy", "cny", "aud", "cad", "rub", "sek", "inr", "pkr", "afn", "myr", "thb", "sar", "qar", "kwd", "bhd", "omr", "iqd", "syp", "azn", "amd", "gel"],
  gold: ["gold18", "gold24", "melted", "ounce"],
  coin: ["emami", "baharazadi", "nim", "rob", "gerami"],
  commodity: ["silver", "copper"]
};
const TOP_CRYPTO = [
  "btc", "usdt", "eth", "usdc", "xrp", "bnb", "sol", "doge", "trx", "ada",
  "link", "avax", "dot", "ltc", "bch", "1k_shib", "dai", "near", "uni", "atom",
  "etc", "xlm", "fil", "apt", "arb", "op", "inj", "imx", "hbar", "algo",
  "grt", "aave", "render", "qnt", "egld", "sand", "mana", "xtz", "chz", "ena",
  "jup", "sui", "1m_pepe", "wld", "pyth", "fet", "tao", "hype", "pol", "cake"
];

// چند جفت پرتقاضا که یک سرشان تومان نیست.
const EXTRA_PAIRS = [
  ["btc", "usdt"], ["usdt", "btc"],
  ["eth", "usdt"], ["usdt", "eth"],
  ["gold18", "usd"], ["usd", "gold18"],
  ["goldounce", "gold18"], ["gold18", "goldounce"],
  ["eur", "usd"], ["usd", "eur"],
  ["emami", "usd"], ["gold18", "eur"]
];

function buildPairs() {
  const pairs = [];
  const seen = new Set();
  const add = (from, to) => {
    if (from === to) return;
    const key = `${from}>${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([from, to]);
  };
  for (const id of WITH_TOMAN) { add(id, "irt"); add("irt", id); }
  for (const [from, to] of EXTRA_PAIRS) add(from, to);
  return pairs;
}

/* واحد فقط وقتی جلوی نام می‌آید که نام خودش با آن شروع نشده باشد،
   وگرنه «انس طلا» می‌شود «هر انس انس طلا». همین قاعده در unitPrefix
   فایل assets/app.js هم هست و تست هم‌خوانی‌شان را بررسی می‌کند. */
function metaFor(from, to) {
  const heading = `تبدیل ${from.name} به ${to.name}`;
  return {
    heading,
    fromName: from.name,
    toName: to.name,
    title: `${heading} | مبدل قیمت | تبدکس`,
    description: `${heading} با قیمت لحظه ای. مبدل نرخ ${from.name} به ${to.name}.`,
    path: `/convert/${from.slug}-to-${to.slug}/`
  };
}

/* جایگزینی روی HTML اصلی انجام می‌شود تا صفحه‌ها هیچ‌وقت از قالب عقب
   نیفتند. اگر یکی از این الگوها پیدا نشود، عمداً خطا می‌دهیم؛ تولید
   بی‌سروصدای صفحه‌های ناقص بدتر از شکست دیپلوی است. */
function renderPage(template, meta) {
  const replacements = [
    [/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`],
    [/(<meta name="description" content=")[^"]*(">)/, `$1${meta.description}$2`],
    [/(<meta property="og:title" content=")[^"]*(">)/, `$1${meta.title}$2`],
    [/(<meta property="og:description" content=")[^"]*(">)/, `$1${meta.description}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${meta.title}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${meta.description}$2`],
    [/(<link rel="canonical" href=")[^"]*(">)/, `$1${ORIGIN}${meta.path}$2`],
    [/(<meta property="og:url" content=")[^"]*(">)/, `$1${ORIGIN}${meta.path}$2`],
    [/(<h1 id="page-title">)[^<]*(<\/h1>)/, `$1${meta.heading}$2`],
    [/(<h2 id="pair-content-title">)[^<]*(<\/h2>)/, `$1${meta.heading} با قیمت لحظه ای و سریع$2`],
    [/(<p id="pair-content-intro">)[^<]*(<\/p>)/, `$1با سرویس مبدل تبدکس، می‌توانید به‌سادگی ${meta.fromName} خود را به ${meta.toName} تبدیل کنید. قیمت لحظه ای هر دارایی به شما کمک می‌کند قبل از انجام تبدیل، ارزش دارایی خود را مشاهده کنید.$2`],
    [/(<p id="pair-content-rate">)[^<]*(<\/p>)/, `$1در حال دریافت نرخ لحظه ای ${meta.fromName} و ${meta.toName}…$2`]
  ];

  let html = template;
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(html)) {
      throw new Error(`الگوی «${pattern}» در index.html پیدا نشد؛ قالب عوض شده است.`);
    }
    html = html.replace(pattern, replacement);
  }

  // مسیرهای نسبی یک سطح عمیق‌تر می‌شوند، پس مطلقشان می‌کنیم.
  return html
    .replace(/(src|href)="assets\//g, '$1="/assets/')
    .replace(/(src|href)="data\//g, '$1="/data/');
}

const template = await readFile(resolve(ROOT, "convert", "index.html"), "utf8");
const pairs = buildPairs();
const today = new Date().toISOString().slice(0, 10);
const urls = [`  <url>\n    <loc>${ORIGIN}/</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>`];

function addSitemapUrl(path, priority = "0.7") {
  urls.push(`  <url>\n    <loc>${ORIGIN}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`);
}

addSitemapUrl("/price/", "0.9");
addSitemapUrl("/convert/", "0.9");
for (const group of [...Object.keys(PRICE_GROUPS), "crypto"]) addSitemapUrl(`/price/${group}/`, "0.8");
for (const [group, slugs] of Object.entries(PRICE_GROUPS)) {
  for (const slug of slugs) addSitemapUrl(`/price/${group}/${slug}/`);
}
for (const slug of TOP_CRYPTO) addSitemapUrl(`/price/crypto/${slug}/`);

for (const [fromId, toId] of pairs) {
  const from = ASSETS[fromId];
  const to = ASSETS[toId];
  if (!from || !to) throw new Error(`دارایی ناشناخته در فهرست جفت‌ها: ${fromId} یا ${toId}`);
  const meta = metaFor(from, to);
  const directory = resolve(SITE, "convert", `${from.slug}-to-${to.slug}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), renderPage(template, meta), "utf8");
  urls.push(`  <url>\n    <loc>${ORIGIN}${meta.path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>`);
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
await Promise.all([
  writeFile(resolve(ROOT, "sitemap.xml"), sitemapXml, "utf8"),
  writeFile(resolve(SITE, "sitemap.xml"), sitemapXml, "utf8")
]);

console.log(`${pairs.length} صفحهٔ ایستا ساخته شد و ${urls.length} آدرس در سایت‌مپ ثبت شد.`);
