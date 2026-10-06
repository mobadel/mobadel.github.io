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
function todayLabel(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const values = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.weekday} ${values.day} ${values.month} ${values.year}`;
}

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

  brent:    { slug: "brent",    name: "نفت برنت",     unit: "بشکه" },
  gasoline: { slug: "gasoline", name: "بنزین آمریکا", unit: "گالن" },

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
  "brent", "gasoline",
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
  commodity: ["silver", "copper"],
  energy: ["brent", "gasoline"]
};
/* نام و توضیح هر دسته باید با CATEGORIES در assets/price.js یکی بماند،
   وگرنه عنوان سرورساخته با چیزی که جاوااسکریپت بعداً می‌نویسد فرق می‌کند.
   tests/price-pages.test.js این هم‌خوانی را بررسی می‌کند. */
const PRICE_CATEGORIES = {
  crypto:    { name: "ارزهای دیجیتال" },
  gold:      { name: "طلا" },
  coin:      { name: "سکه" },
  commodity: { name: "فلزات" },
  energy:    { name: "انرژی" },
  currency:  { name: "ارز" }
};

const TOP_CRYPTO = [
  "btc", "usdt", "eth", "usdc", "xrp", "bnb", "sol", "doge", "trx", "ada",
  "link", "avax", "dot", "ltc", "bch", "1k_shib", "dai", "near", "uni", "atom",
  "etc", "xlm", "fil", "apt", "arb", "op", "inj", "imx", "hbar", "algo",
  "grt", "aave", "render", "qnt", "egld", "sand", "mana", "xtz", "chz", "ena",
  "jup", "sui", "1m_pepe", "wld", "pyth", "fet", "tao", "hype", "pol", "cake"
];

// صفحه‌های رمزارزِ canonical که در گزارش ایندکس سرچ کنسول دیده شده‌اند
// و خارج از فهرست پرمخاطب بالا هستند.
const INDEXED_CRYPTO = [
  "api3", "at", "ath", "bard", "coti", "edu", "eigen", "esp", "glm", "la",
  "me", "met", "one", "opg", "orca", "re", "safe", "turbo", "x"
];

// این جفت‌ها canonical هستند ولی هنوز در فهرست صفحه‌های ایستای پرتقاضا
// قرار ندارند؛ برای پایدار ماندن حضورشان در سایت‌مپ جداگانه ثبت می‌شوند.
const INDEXED_CONVERT_PATHS = ["cake-to-irt", "hype-to-irt", "safe-to-irt"];
// چند جفت پرتقاضا که یک سرشان تومان نیست.
const EXTRA_PAIRS = [
  ["btc", "usdt"], ["usdt", "btc"],
  ["eth", "usdt"], ["usdt", "eth"],
  ["gold18", "usd"], ["usd", "gold18"],
  ["goldounce", "gold18"], ["gold18", "goldounce"],
  ["eur", "usd"], ["usd", "eur"],
  ["emami", "usd"], ["gold18", "eur"],
  // انرژی در بازار دلاری معامله می‌شود؛ تبدیل به دلار جفت اصلی آن است.
  ["brent", "usd"], ["gasoline", "usd"]
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
  for (const [from, to] of EXTRA_PAIRS) { add(from, to); add(to, from); }
  return pairs;
}

/* شناسه‌های ضریب‌دار (1k_shib) فقط داخلی‌اند؛ .htaccess آدرس عمومی را
   به شکل بدون ضریب ۳۰۱ می‌کند، پس سایت‌مپ هم باید همان را بدهد وگرنه
   خودمان آدرس ریدایرکتی به گوگل معرفی می‌کنیم. */
function cryptoSlug(id) {
  const match = /^[0-9]+[kmb]_(.+)$/.exec(id);
  return match ? match[1] : id;
}

/* نام فارسی دارایی‌ها دو منبع دارد: جدول ASSETS بالا برای ارز و طلا و
   سکه، و data/currencies.json برای رمزارزها. همان منبعی که price.js در
   مرورگر می‌خواند، تا متن ایستا و متن جاوااسکریپت یکی دربیاید. */
const currencyNames = JSON.parse(await readFile(resolve(ROOT, "data", "currencies.json"), "utf8")).currencies;
const NAME_BY_SLUG = new Map();
for (const asset of Object.values(ASSETS)) NAME_BY_SLUG.set(asset.slug, asset.name);

function cryptoName(id) {
  const entry = currencyNames[id];
  if (!entry || !entry.fa) throw new Error(`نام فارسی رمزارز «${id}» در data/currencies.json نیست.`);
  return entry.fa;
}

function priceName(group, slug, id) {
  if (group === "crypto") return cryptoName(id);
  const name = NAME_BY_SLUG.get(slug);
  if (!name) throw new Error(`نام فارسی دارایی «${slug}» در جدول ASSETS نیست.`);
  return name;
}

/* چند جفت در سرچ کنسول رتبهٔ ۷ تا ۱۰ دارند: یعنی گوگل صفحه را مرتبط
   می‌داند ولی صفحه چیزی بیش از خودِ مبدل ارائه نمی‌دهد و پایین صفحهٔ
   اول می‌ماند. متن اختصاصی زیر برای همین جفت‌هاست و به جای تکرار نام
   دارایی، به سؤال واقعی کسی که این عبارت را جستجو می‌کند جواب می‌دهد.
   نرخ و عدد عمداً در متن نمی‌آید؛ آن را مبدل بالای صفحه لحظه ای نشان
   می‌دهد و متن ایستا سریع کهنه می‌شود. */
const PAIR_CONTENT = {
  "afn-to-irt": `
      <h3>نرخ افغانی به تومان چطور تعیین می‌شود؟</h3>
      <p>افغانی نرخ رسمی مستقیمی با تومان ندارد. عددی که در صرافی‌های ایران و افغانستان می‌بینید یک نرخ متقاطع است: افغانی نسبت به دلار سنجیده می‌شود و دلار نسبت به تومان. به همین دلیل وقتی بازار ارز ایران نوسان می‌کند، نرخ افغانی هم جابه‌جا می‌شود، حتی اگر در کابل هیچ اتفاقی نیفتاده باشد.</p>
      <h3>چرا نرخ صرافی با این عدد فرق دارد؟</h3>
      <p>نرخ بالا نرخ مرجع بازار است، نه قیمت نهایی صرافی. صرافی‌ها اختلاف خرید و فروش و کارمزد انتقال را روی آن حساب می‌کنند، و این اختلاف در مسیرهای پرتقاضا مثل هرات و مشهد معمولاً محسوس‌تر است. برای همین بهتر است این عدد را مبنای مقایسه بگیرید، نه رقمی که قرار است دقیقاً دریافت کنید.</p>
      <h3>بهترین زمان بررسی نرخ</h3>
      <p>بیشترین جابه‌جایی نرخ در ساعات فعال بازار ارز ایران رخ می‌دهد. اگر قصد تبدیل مبلغ قابل‌توجهی را دارید، نرخ را در چند نوبت از روز ببینید تا به جای یک عدد لحظه ای، دامنهٔ واقعی نوسان آن روز دستتان بیاید.</p>`,

  "iqd-to-irt": `
      <h3>دینار عراق را کجا تبدیل کنیم؟</h3>
      <p>اگر دینار باقی‌مانده از سفر دارید، تبدیل آن در مرزها و شهرهای زیارتی معمولاً ساده‌تر از شهرهای دیگر ایران است، چون تقاضا برای دینار همان‌جا متمرکز است. در شهرهای دیگر ممکن است صرافی دینار نقدی را با اختلاف بیشتری بخرد.</p>
      <h3>چرا نرخ دینار در ایام اربعین فرق می‌کند؟</h3>
      <p>دینار عراق به دلار میخکوب شده و نرخ رسمی‌اش تقریباً ثابت است، اما نرخ نقدی آن در ایران تابع عرضه و تقاضاست. در فصل زیارت تقاضای دینار بالا می‌رود و اختلاف قیمت خرید و فروش بیشتر می‌شود؛ پس از پایان فصل، همین اختلاف معمولاً کم می‌شود.</p>
      <h3>نکتهٔ اسکناس</h3>
      <p>دینار عراق بیشتر با اسکناس‌های درشت در گردش است و ارقام روی اسکناس‌ها بزرگ‌اند. هنگام شمارش، تعداد صفرها را با دقت ببینید؛ بیشترین اشتباه در تبدیل دینار از همین‌جا می‌آید، نه از نرخ.</p>`,

  "irt-to-iqd": `
      <h3>برای سفر به عراق چقدر دینار لازم است؟</h3>
      <p>هزینه‌های داخل عراق را می‌توانید با همین مبدل به تومان برآورد کنید و بعد تصمیم بگیرید چه بخشی از پول را از ایران دینار کنید. معمولاً بخشی از مبلغ را قبل از سفر تبدیل می‌کنند تا در بدو ورود دست خالی نباشند، و باقی را در مقصد.</p>
      <h3>تبدیل در ایران یا در عراق؟</h3>
      <p>هر دو گزینه مزیت خودش را دارد: تبدیل در ایران نرخ را از قبل قطعی می‌کند، تبدیل در عراق معمولاً با اختلاف کمتری انجام می‌شود ولی نرخش را از پیش نمی‌دانید. مقایسهٔ نرخ امروز با چند روز اخیر کمک می‌کند بفهمید کدام‌یک به‌صرفه‌تر است.</p>
      <h3>دینار نقدی یا کارت؟</h3>
      <p>پذیرش کارت‌های بانکی ایران در عراق وجود ندارد، بنابراین پول نقد یا کارت‌های بین‌المللی تنها گزینه‌اند. همین موضوع باعث می‌شود برآورد دقیق مبلغ پیش از سفر اهمیت بیشتری پیدا کند.</p>`,

  "amd-to-irt": `
      <h3>درام ارمنستان و نرخ تومان</h3>
      <p>درام واحد پول ارمنستان است و مثل افغانی، نرخ آن به تومان از مسیر دلار محاسبه می‌شود. نوسان درام نسبت به دلار معمولاً ملایم است، پس بیشتر تغییری که در این نرخ می‌بینید از سمت بازار ارز ایران می‌آید.</p>
      <h3>برای سفر به ایروان</h3>
      <p>در ایروان تبدیل ریال و تومان در همهٔ صرافی‌ها رایج نیست و معمولاً نرخ بهتری برای دلار می‌گیرید. بسیاری ترجیح می‌دهند در ایران دلار تهیه کنند و در مقصد به درام تبدیل کنند؛ با همین مبدل می‌توانید هر دو مسیر را مقایسه کنید.</p>
      <h3>ارقام درام بزرگ‌اند</h3>
      <p>واحدهای درام عددهای بزرگی دارند و قیمت‌های روزمره در ارمنستان با هزار درام و بالاتر نوشته می‌شود. هنگام مقایسه با تومان، مراقب تعداد صفرها باشید.</p>`,

  "irt-to-try": `
      <h3>لیر ترکیه چرا مدام تغییر می‌کند؟</h3>
      <p>لیر ترکیه سال‌هاست تورم بالایی را تجربه می‌کند و ارزش آن نسبت به دلار روند نزولی داشته است. نتیجه این است که نرخ لیر به تومان از دو سمت تحت فشار است: هم تغییرات لیر، هم تغییرات بازار ارز ایران. برای همین نرخ این جفت معمولاً بی‌ثبات‌تر از ارزهای دیگر است.</p>
      <h3>برای خرید و سفر</h3>
      <p>اگر قیمتی را به لیر دیده‌اید و می‌خواهید بدانید به تومان چقدر می‌شود، عدد را در مبدل بالا وارد کنید. چون لیر نوسان روزانه دارد، برای خریدهای بزرگ‌تر بهتر است نرخ را نزدیک زمان پرداخت دوباره ببینید تا برآوردتان کهنه نباشد.</p>
      <h3>نرخ فرودگاه را مبنا نگیرید</h3>
      <p>صرافی‌های فرودگاهی در ترکیه معمولاً بدترین نرخ را می‌دهند. نرخ مرجعی که اینجا می‌بینید به نرخ صرافی‌های شهری نزدیک‌تر است و برای مقایسه مناسب‌تر.</p>`,

  "rub-to-irt": `
      <h3>روبل روسیه به تومان</h3>
      <p>نرخ روبل به تومان هم از مسیر دلار به دست می‌آید. روبل نسبت به سال‌های گذشته نوسان بیشتری پیدا کرده و تغییرات آن می‌تواند در بازهٔ کوتاه محسوس باشد، بنابراین نرخ دیروز لزوماً نرخ امروز نیست.</p>
      <h3>چه کسانی این نرخ را دنبال می‌کنند؟</h3>
      <p>بیشتر مراجعه‌ها از سمت تجارت و سفر است: قیمت‌گذاری کالا، برآورد هزینهٔ سفر، یا بررسی ارزش مبلغی که قرار است دریافت یا پرداخت شود. برای هر سه، آنچه اهمیت دارد نرخ لحظه ای است، نه عددی که چند روز پیش دیده‌اید.</p>
      <h3>تبدیل نقدی روبل در ایران</h3>
      <p>روبل نقدی در ایران بازار محدودی دارد و همهٔ صرافی‌ها آن را معامله نمی‌کنند. نرخی که اینجا می‌بینید نرخ مرجع بازار است؛ برای مبالغ بزرگ بهتر است پیش از اقدام، نرخ خرید واقعی چند صرافی را بپرسید.</p>`
};

/* واحد فقط وقتی جلوی نام می‌آید که نام خودش با آن شروع نشده باشد،
   وگرنه «انس طلا» می‌شود «هر انس انس طلا». همین قاعده در unitPrefix
   فایل assets/app.js هم هست و تست هم‌خوانی‌شان را بررسی می‌کند. */
function metaFor(from, to) {
  const heading = `تبدیل ${from.name} به ${to.name}`;
  const date = todayLabel();
  return {
    heading,
    fromName: from.name,
    toName: to.name,
    fromSlug: from.slug,
    toSlug: to.slug,
    title: `${heading} | مبدل قیمت`,
    description: `${heading} با نرخ مرجع بازار. مبدل نرخ ${from.name} به ${to.name}.`,
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

  for (const [side, slug, name] of [["from", meta.fromSlug, meta.fromName], ["to", meta.toSlug, meta.toName]]) {
    const pattern = new RegExp('(<button[^>]*id="currency-' + side + '"[^>]*>)[\\s\\S]*?(</button>)');
    html = html.replace(pattern, `$1<span class="currency-text"><strong>${esc(slug.toUpperCase())}</strong><small>${esc(name)}</small></span>$2`);
  }

  /* متن اختصاصی زیر بندِ عمومی پایان بخش می‌نشیند تا سه بند بالایی که
     app.js با نرخ لحظه ای بازنویسی‌شان می‌کند دست‌نخورده بمانند. */
  const extra = PAIR_CONTENT[`${meta.fromSlug}-to-${meta.toSlug}`];
  if (extra) {
    const closing = /(<p id="pair-content-rate">[\s\S]*?<\/p>\s*<p>[\s\S]*?<\/p>)(\s*<\/section>)/;
    if (!closing.test(html)) {
      throw new Error("پایان بخش pair-content پیدا نشد؛ قالب عوض شده است.");
    }
    html = html.replace(closing, `$1${extra}$2`);
  }

  // مسیرهای نسبی یک سطح عمیق‌تر می‌شوند، پس مطلقشان می‌کنیم.
  return enrichPage(html, meta.path)
    .replace(/(src|href)="assets\//g, '$1="/assets/')
    .replace(/(src|href)="data\//g, '$1="/data/');
}

/* صفحه‌های قیمت تا امروز فقط از راه بازنویسی به price/asset.html
   می‌رسیدند، یعنی هر ۱۳۰ صفحه همین یک HTML را با عنوان «قیمت دارایی»
   و canonical «/price/» تحویل می‌دادند و تفکیکشان به اجرای جاوااسکریپت
   توسط خزنده وابسته بود. همان کاری که برای جفت‌های تبدیل می‌کنیم اینجا
   هم لازم است: فایل واقعی با عنوان و canonical خودِ دارایی. */
function renderPricePage(template, meta) {
  const replacements = [
    [/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`],
    [/(<meta name="description" content=")[^"]*(">)/, `$1${meta.description}$2`],
    [/(<meta property="og:title" content=")[^"]*(">)/, `$1${meta.title}$2`],
    [/(<meta property="og:description" content=")[^"]*(">)/, `$1${meta.description}$2`],
    [/(<link rel="canonical" href=")[^"]*(">)/, `$1${ORIGIN}${meta.path}$2`],
    [/(<meta property="og:url" content=")[^"]*(">)/, `$1${ORIGIN}${meta.path}$2`],
    ...meta.slots
  ];

  /* قالب‌های قیمت کارت توییتر ندارند. نبودشان خطا نیست، ولی اگر روزی
     اضافه شدند باید مثل بقیه پر شوند و از قالب عقب نمانند. */
  const optional = [
    [/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${meta.title}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${meta.description}$2`]
  ];

  let html = template;
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(html)) {
      throw new Error(`الگوی «${pattern}» در قالب صفحهٔ قیمت پیدا نشد؛ قالب عوض شده است.`);
    }
    html = html.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of optional) html = html.replace(pattern, replacement);
  return html;
}

/* عنوان‌ها دقیقاً همان چیزی است که renderAsset و renderCategory در
   assets/price.js می‌نویسند، تا بین HTML اولیه و بعد از اجرای
   جاوااسکریپت پرشی در عنوان و h1 دیده نشود. */
function priceAssetMeta(group, slug, name) {
  const category = PRICE_CATEGORIES[group];
  const date = todayLabel();
  return {
    title: `قیمت لحظه ای ${name} امروز`,
    description: `قیمت لحظه ای ${name} امروز، میزان تغییر قیمت و اطلاعات بازار ${name}.`,
    path: `/price/${group}/${slug}/`,
    slots: [
      [/(<h1 id="asset-title">)[^<]*(<\/h1>)/, `$1قیمت ${name}$2`],
      [/(<li id="asset-crumb" aria-current="page">)[^<]*(<\/li>)/, `$1${name}$2`],
      [/(<a id="asset-category-link" href=")[^"]*(">)[^<]*(<\/a>)/, `$1/price/${group}/$2${category.name}$3`],
      [/(<h2 id="asset-content-title">)[^<]*(<\/h2>)/, `$1قیمت ${name} امروز$2`],
      [/(<h3 id="asset-about-title">)[^<]*(<\/h3>)/, `$1درباره ${name}$2`]
    ]
  };
}

function priceCategoryMeta(group) {
  const category = PRICE_CATEGORIES[group];
  const date = todayLabel();
  return {
    title: `قیمت لحظه ای ${category.name} امروز`,
    description: `فهرست قیمت لحظه ای ${category.name} امروز. مشاهده قیمت و تغییرات ۲۴ ساعته.`,
    path: `/price/${group}/`,
    slots: [
      [/(<h1 id="category-title">)[^<]*(<\/h1>)/, `$1قیمت لحظه ای ${category.name}$2`],
      [/(<li id="category-crumb" aria-current="page">)[^<]*(<\/li>)/, `$1${category.name}$2`]
    ]
  };
}

const snapshots = {};
try {
  const history = JSON.parse(await readFile(resolve(ROOT, "data/market-history.json"), "utf8"));
  for (const [id, points] of Object.entries(history.assets || {})) {
    const point = points.reduce((a, b) => !a || b[0] > a[0] ? b : a, null);
    if (point && Number.isFinite(point[1]) && point[1] > 0) snapshots[id] = { toman: point[1], at: new Date(point[0] * 1000).toISOString() };
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
try { Object.assign(snapshots, JSON.parse(await readFile(resolve(SITE, "data/seo-rates.json"), "utf8"))); }
catch (error) { if (error.code !== "ENOENT") throw error; }

function esc(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"); }
function assetForSlug(slug) { return Object.values(ASSETS).find(a => a.slug === slug); }
function groupFor(slug) { return Object.entries(PRICE_GROUPS).find(([, ids]) => ids.includes(slug))?.[0] || "crypto"; }
function assetLink(slug) { const a = assetForSlug(slug); return `<a href="/price/${groupFor(slug)}/${slug}/">قیمت ${esc(a?.name || cryptoName([...TOP_CRYPTO, ...INDEXED_CRYPTO].find(id => cryptoSlug(id) === slug) || slug))}</a>`; }
function savedQuote(slug) {
  const id = Object.keys(ASSETS).find(id => ASSETS[id].slug === slug) || [...TOP_CRYPTO, ...INDEXED_CRYPTO].find(id => cryptoSlug(id) === slug) || slug;
  const row = snapshots[id];
  if (!row || !Number.isFinite(row.toman) || row.toman <= 0 || !Number.isFinite(Date.parse(row.at))) return "";
  const date = new Intl.DateTimeFormat("fa-IR", {timeZone:"Asia/Tehran", dateStyle:"medium", timeStyle:"short"}).format(new Date(row.at));
  return `<p class="saved-quote">نرخ ذخیره‌شده: ${new Intl.NumberFormat("fa-IR", {maximumFractionDigits: 4}).format(row.toman)} تومان؛ زمان دریافت یا ثبت داده: <time datetime="${esc(row.at)}">${date}</time>. این عدد نرخ لحظه‌ای نیست؛ نرخ تازه در بالای صفحه نمایش داده می‌شود.</p>`;
}
const GROUP_HELP = {
  currency: ["این نرخ متعلق به چه بازاری است؟", "نرخ ارز از سرویس BrsApi دریافت می‌شود. نرخ نمایش‌داده‌شده را با قیمت خرید، فروش، حواله یا نرخ رسمی یکسان نگیرید؛ پیش از پرداخت، نوع نرخ و کارمزد را از ارائه‌دهنده معامله بپرسید. یک تومان برابر ده ریال است. نرخ ین در این سایت برای یکصد ین نمایش داده می‌شود."],
  gold: ["وزن و عیار طلا چه اثری در محاسبه دارد؟", "طلای ۱۸ و ۲۴ عیار به گرم، طلای آب‌شده به مثقال و انس جهانی با واحد انس نمایش داده می‌شوند. محاسبه ارزش وزن طلا با قیمت هر واحد انجام می‌شود؛ این برآورد قیمت نهایی زیورآلات نیست و اجرت، سود فروشنده و هزینه‌های معامله را محاسبه نمی‌کند."],
  coin: ["قیمت سکه با ارزش طلای آن چه تفاوتی دارد؟", "واحد قیمت سکه یک عدد از همان نوع سکه است. سکه امامی، بهار آزادی، نیم، ربع و یک‌گرمی قیمت‌های جدا دارند؛ قیمت سکه ممکن است با ارزش طلای داخل آن متفاوت باشد. نرخ مرجع، قیمت قطعی خرید یا فروش فروشنده نیست."],
  commodity: ["این نرخ فلز مربوط به کدام واحد است؟", "نقره ۹۹۹ در این سایت به گرم و مس به کیلوگرم نمایش داده می‌شوند و منبع داده گواهی سپرده بورس کالا از طریق BrsApi است. این نرخ را با قیمت مصنوعات، مس مصرفی یا فلز دارای عیار متفاوت یکسان نگیرید. در توقف منبع، زمان داده ذخیره‌شده را بررسی کنید."],
  energy: ["نرخ انرژی چه چیزی را اندازه می‌گیرد؟", "نفت برنت به دلار برای هر بشکه و بنزین آمریکا (RBOB) به دلار برای هر گالن نمایش داده می‌شوند. این ارقام نرخ بازار جهانی انرژی هستند و قیمت بنزین جایگاه‌های ایران یا قیمت تحویل محلی را نشان نمی‌دهند."],
  crypto: ["قیمت تومانی و تتری چرا متفاوت است؟", "نرخ رمزارز از آخرین معامله در بازار عمومی نوبیتکس دریافت می‌شود. بازار تومان و بازار تتر سفارش‌های جدا دارند؛ به همین دلیل نرخ تومانی الزاماً برابر حاصل‌ضرب قیمت تتری در قیمت تتر نیست. آخرین معامله نیز تضمین قیمت اجرای سفارش جدید نیست."]
};
function enrichPage(html, path) {
  // A persistent section is outside the slots refreshed by live JavaScript.
  let content = "";
  const match = /^\/price\/(\w+)\/([^/]+)\/$/.exec(path);
  const pair = /^\/convert\/([a-z0-9]+)-to-([a-z0-9]+)\/$/.exec(path);
  if (match) {
    const [, group, slug] = match; const help = GROUP_HELP[group];
    content = `<h2>${help[0]}</h2><p>${help[1]}</p>${savedQuote(slug)}<p><a href="/convert/${slug}-to-${group === "energy" ? "usd" : "irt"}/">محاسبه ارزش این دارایی</a></p>`;
    html = html.replace(/(<a class="converter-link" id="asset-converter-link" href=")[^"]*/, `$1/convert/${slug}-to-${group === "energy" ? "usd" : "irt"}/`);
  } else if (pair) {
    const [, from, to] = pair; const a = assetForSlug(from), b = assetForSlug(to);
    const nameA = esc(a.name), nameB = esc(b.name);
    content = `<h2>روش محاسبه ${nameA} به ${nameB}</h2><p>مقدار مبدأ × نرخ تومانی هر واحد مبدأ ÷ نرخ تومانی هر واحد مقصد = مقدار معادل مقصد. نرخ تومان در این فرمول یک است. برای مثال با نرخ فرضی ۱۰۰ تومان برای مبدأ و ۲۰۰ تومان برای مقصد، ۱۰ واحد مبدأ معادل ۵ واحد مقصد است؛ این مثال نرخ واقعی بازار نیست.</p><p>${GROUP_HELP[groupFor(from === "irt" ? to : from)][1]}</p><p>این ابزار ارزش معادل را محاسبه می‌کند و خرید، فروش یا انتقال دارایی انجام نمی‌دهد. نتیجه شامل اختلاف خرید و فروش و کارمزد معامله نیست. واحد انتخاب‌شده کنار نام دارایی را بررسی کنید.</p><nav aria-label="قیمت‌ها و تبدیل مرتبط"><ul>${[from,to].filter(x=>x!=="irt").map(x=>`<li>${assetLink(x)}</li>`).join("")}<li><a href="/convert/${to}-to-${from}/">تبدیل ${nameB} به ${nameA}</a></li></ul></nav>`;
  } else if (path.startsWith("/price/")) {
    const group = path.split("/")[2];
    const list = group ? (group === "crypto" ? [...TOP_CRYPTO,...INDEXED_CRYPTO].map(cryptoSlug) : PRICE_GROUPS[group] || []) : ["usd","gold18","emami","btc","usdt","eur"];
    content = `<h2>دسترسی به صفحات قیمت</h2><ul>${list.map(slug=>`<li>${assetLink(slug)}</li>`).join("")}</ul>`;
  } else {
    content = `<h2>تبدیل‌های پرکاربرد</h2><p class="popular-conversions-intro">تبدیل موردنظر را انتخاب کنید و ارزش معادل دارایی‌تان را ببینید.</p><ul class="popular-conversions-grid">${["gold18-to-eur","afn-to-irt","irt-to-iqd","usd-to-irt","aed-to-irt"].map(slug=>{const [a,b]=slug.split("-to-");return `<li><a class="popular-conversion" href="/convert/${slug}/"><span class="popular-conversion-symbol" aria-hidden="true">${esc(a === "gold18" ? "۱۸" : a.toUpperCase())}</span><span class="popular-conversion-label"><strong>${esc(assetForSlug(a).name)} به ${esc(assetForSlug(b).name)}</strong><span>محاسبه و تبدیل</span></span><span class="icon-chevron" aria-hidden="true"></span></a></li>`;}).join("")}</ul>`;
    return html.replace(/<\/main>/, `<section class="seo-content popular-conversions" aria-label="تبدیل‌های پرکاربرد">${content}</section></main>`);
  }
  return html.replace(/<\/main>/, `<section class="seo-content" aria-label="راهنما و صفحات مرتبط">${content}<p><a href="/methodology/">منابع داده و روش محاسبه تبدکس</a></p></section></main>`);
}

const template = await readFile(resolve(ROOT, "convert", "index.html"), "utf8");
const assetTemplate = await readFile(resolve(ROOT, "price", "asset.html"), "utf8");
const categoryTemplate = await readFile(resolve(ROOT, "price", "category.html"), "utf8");
for (const slug of ["cake", "hype", "safe"]) {
  ASSETS[slug] = { slug, name: cryptoName(slug) };
  WITH_TOMAN.push(slug);
}
const pairs = buildPairs();
const today = new Date().toISOString().slice(0, 10);
const urls = [`  <url>\n    <loc>${ORIGIN}/</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>`];

function addSitemapUrl(path, priority = "0.7") {
  urls.push(`  <url>\n    <loc>${ORIGIN}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`);
}

addSitemapUrl("/price/", "0.9");
addSitemapUrl("/convert/", "0.9");

async function writePricePage(path, html) {
  const directory = resolve(SITE, path.replace(/^\/|\/$/g, ""));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), enrichPage(html, path), "utf8");
}

let pricePages = 0;
for (const group of [...Object.keys(PRICE_GROUPS), "crypto"]) {
  const meta = priceCategoryMeta(group);
  await writePricePage(meta.path, renderPricePage(categoryTemplate, meta));
  addSitemapUrl(meta.path, "0.8");
  pricePages += 1;
}

/* شناسهٔ داخلی با اسلاگ عمومی یکی نیست؛ رمزارزهای ضریب‌دار با نام
   بدون ضریب آدرس می‌گیرند ولی نامشان زیر شناسهٔ اصلی ثبت شده است. */
const priceAssets = [
  ...Object.entries(PRICE_GROUPS).flatMap(([group, slugs]) => slugs.map((slug) => ({ group, slug, id: slug }))),
  ...[...TOP_CRYPTO, ...INDEXED_CRYPTO].map((id) => ({ group: "crypto", slug: cryptoSlug(id), id }))
];

const seenPricePaths = new Set();
for (const { group, slug, id } of priceAssets) {
  const meta = priceAssetMeta(group, slug, priceName(group, slug, id));
  if (seenPricePaths.has(meta.path)) continue;
  seenPricePaths.add(meta.path);
  await writePricePage(meta.path, renderPricePage(assetTemplate, meta));
  addSitemapUrl(meta.path);
  pricePages += 1;
}

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

// Previously sitemap-only paths are now generated by buildPairs().

/* آدرس‌های قدیمی بدون پیشوند /convert/ از کامیت 3d17369 با ۳۰۱ به
   مسیر تازه می‌روند، ولی گوگل تا صفحه‌ای را دوباره نخزد ریدایرکت را
   نمی‌بیند و هر دو نسخه در نتایج می‌مانند و رتبهٔ هم را می‌خورند.
   این سایت‌مپ فقط برای همین است: گوگل می‌خزد، ۳۰۱ را می‌بیند و دو
   نسخه را یکی می‌کند. عمداً از sitemap.xml اصلی جداست و بعد از
   ادغام شدن آدرس‌ها باید حذف شود؛ سایت‌مپ جای آدرس ریدایرکتی نیست.
   TON نام قدیمی GRAM است و .htaccess هر دو شکلش را جابه‌جا می‌کند. */
const legacyPaths = [
  ...pairs.map(([fromId, toId]) => `/${ASSETS[fromId].slug}-to-${ASSETS[toId].slug}/`),
  "/ton-to-irt/",
  "/irt-to-ton/"
];
const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${legacyPaths
  .map((path) => `  <url>\n    <loc>${ORIGIN}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.1</priority>\n  </url>`)
  .join("\n")}\n</urlset>\n`;
await writeFile(resolve(SITE, "sitemap-legacy.xml"), legacyXml, "utf8");

// Generate the hubs as well; deployment copies their templates before this step.
for (const [path, file] of [["/", "index.html"], ["/price/", "price/index.html"], ["/convert/", "convert/index.html"]]) {
  let html = await readFile(resolve(ROOT, file), "utf8");
  html = html.replace(/ امروز (?:پنجشنبه|دوشنبه) [^<".]+۱۴۰۵/g, " امروز");
  await writePricePage(path, html);
}
const methodTemplate = await readFile(resolve(ROOT, "price/index.html"), "utf8");
const methodBody = `<main class="wide-shell price-main" id="price-main"><section class="seo-content"><h1>منابع داده و روش محاسبه تبدکس</h1><p>تبدکس ابزار نمایش نرخ و محاسبه ارزش معادل دارایی‌هاست و معامله یا انتقال وجه انجام نمی‌دهد.</p><h2>منابع قیمت</h2>${Object.values(GROUP_HELP).map(([h,t])=>`<h3>${h}</h3><p>${t}</p>`).join("")}<h2>زمان داده و قطع ارتباط</h2><p>زمان دریافت داده توسط تبدکس ممکن است با زمان آخرین معامله در منبع تفاوت داشته باشد. نرخ ذخیره‌شده با زمان خودش مشخص می‌شود و نباید نرخ لحظه‌ای تلقی شود. در نبود داده تازه، پیش از تصمیم‌گیری نرخ را با منبع معامله بررسی کنید.</p><h2>فرمول تبدیل</h2><p>ارزش مقدار مبدأ به تومان بر نرخ تومانی هر واحد مقصد تقسیم می‌شود. نرخ‌هایی که از نوبیتکس به ریال دریافت می‌شوند برای نمایش تومان بر ۱۰ تقسیم می‌شوند.</p><p><a href="/convert/">مبدل قیمت</a> · <a href="/price/">فهرست قیمت‌ها</a></p></section></main>`;
let methodology = methodTemplate.replace(/<main[\s\S]*?<\/main>/, methodBody).replace(/<title>[^<]+<\/title>/,"<title>منابع داده و روش محاسبه | تبدکس</title>").replace(/(<link rel="canonical" href=")[^"]+/, '$1https://tabdex.ir/methodology/').replace(/(<meta property="og:url" content=")[^"]+/, '$1https://tabdex.ir/methodology/').replace(/(<meta (?:name="description"|property="og:description") content=")[^"]+/g, '$1منابع نرخ، واحد دارایی‌ها و روش محاسبه ارزش معادل در تبدکس.').replace(/(<meta property="og:title" content=")[^"]+/, '$1منابع داده و روش محاسبه | تبدکس').replace(/<script id="price-schema"[\s\S]*?<\/script>/, '').replace(/<script src="\/assets\/price.js[^<]+<\/script>/, '');
await mkdir(resolve(SITE,"methodology"), {recursive:true});
await writeFile(resolve(SITE,"methodology/index.html"), methodology);
addSitemapUrl("/methodology/", "0.5");
for (const [path, title, body] of [
  ["/about/", "درباره تبدکس", "<p>تبدکس توسط تیمی متشکل از جوانان علاقه‌مند به اقتصاد و بازارهای مالی گردانده می‌شود.</p><p>هدف ما فراهم کردن دسترسی ساده به نرخ دارایی‌ها و محاسبه ارزش معادل آن‌هاست. تبدکس نرخ‌های منابع بیرونی را نمایش می‌دهد و خدمات خرید، فروش یا انتقال وجه ارائه نمی‌کند.</p><p><a href='/methodology/'>منابع داده و روش محاسبه</a> · <a href='/contact/'>تماس با ما</a></p>"],
  ["/contact/", "تماس با تبدکس", "<p>برای ارتباط با تیم تبدکس، ارسال پیشنهاد یا گزارش خطا در قیمت‌ها و ابزار تبدیل، از راه‌های زیر استفاده کنید.</p><ul><li>ایمیل: <a href='mailto:info@tabdex.ir' dir='ltr'>info@tabdex.ir</a></li><li>شماره تماس: <a href='tel:+989981903599' dir='ltr'>09981903599</a></li></ul><p>برای گزارش خطا، آدرس صفحه و زمان مشاهده مشکل را همراه توضیح ارسال کنید.</p>"]
]) {
  let html = methodology.replace(/<main[\s\S]*?<\/main>/, `<main class="wide-shell price-main" id="price-main"><section class="seo-content"><h1>${title}</h1>${body}</section></main>`);
  html = html.replace(/منابع داده و روش محاسبه \| تبدکس/g, `${title} | تبدکس`).replaceAll("https://tabdex.ir/methodology/", ORIGIN + path).replace(/منابع نرخ، واحد دارایی‌ها و روش محاسبه ارزش معادل در تبدکس\./g, title + "؛ معرفی و راه‌های ارتباط با تیم تبدکس.");
  await mkdir(resolve(SITE,path.slice(1)), {recursive:true});
  await writeFile(resolve(SITE,path.slice(1),"index.html"),html);
  addSitemapUrl(path,"0.5");
}
const completeSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
await writeFile(resolve(SITE,"sitemap.xml"),completeSitemap);
await writeFile(resolve(ROOT,"sitemap.xml"),completeSitemap);

console.log(`${pairs.length} converter pages, ${pricePages} price pages; ${urls.length} canonical URLs with initial HTML.`);
