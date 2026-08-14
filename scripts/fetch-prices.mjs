/* ══════════════════════════════════════════════════════════════
   fetch-prices.mjs — روی GitHub Actions اجرا می‌شود
   سه منبع را می‌خواند و data/prices.json را می‌سازد.

     نوبیتکس  → قیمت تومانی رمزارزها      (بدون کلید)
     بایننس   → قیمت دلاری رمزارزها       (بدون کلید)
     BrsApi   → طلا، سکه، نقره و ارز      (کلید در Secrets)

   اصل مهم: اگر منبعی از کار بیفتد، مقدار قبلیِ همان دارایی از
   فایل موجود حفظ می‌شود تا صفحه هرگز خالی نشود.
   ══════════════════════════════════════════════════════════════ */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'data/prices.json');

const require = createRequire(import.meta.url);
const { ASSETS } = require(resolve(ROOT, 'assets/assets.js'));

const TIMEOUT = 20000;
const report = {};

/* ── کمکی ───────────────────────────────────────────────────── */
const norm = (s) =>
  String(s ?? '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[‌‎‏]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function getJSON(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'user-agent': 'mobadel-price-bot/1.0 (+https://mobadel.github.io)', ...(opts.headers || {}) }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ── ۱) نوبیتکس: قیمت تومانی رمزارز ─────────────────────────── */
async function fromNobitex() {
  const list = ASSETS.filter((a) => a.nobitex);
  const src = list.map((a) => a.nobitex).join(',');
  const data = await getJSON(
    `https://api.nobitex.ir/market/stats?srcCurrency=${src}&dstCurrency=rls`
  );
  if (!data?.stats) throw new Error('پاسخ بدون stats');

  const out = {};
  for (const a of list) {
    const rial = num(data.stats[`${a.nobitex}-rls`]?.latest);
    if (rial) out[a.id] = rial / 10;          // ریال → تومان
  }
  if (!Object.keys(out).length) throw new Error('هیچ نمادی یافت نشد');
  return out;
}

/* ── ۲) بایننس: قیمت دلاری رمزارز ───────────────────────────── */
async function fromBinance() {
  const list = ASSETS.filter((a) => a.binance && a.id !== 'usdt');
  const symbols = JSON.stringify(list.map((a) => a.binance));
  const path = `/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`;

  // api.binance.com به آی‌پی‌های آمریکا HTTP 451 می‌دهد و runnerهای گیت‌هاب
  // هم آمریکا هستند. data-api.binance.vision میزبان رسمیِ دادهٔ عمومی بازار
  // است و این محدودیت را ندارد؛ api.binance.com فقط پشتیبان می‌ماند.
  const hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
  let rows = null, lastErr = null;
  for (const h of hosts) {
    try { rows = await getJSON(h + path); break; }
    catch (e) { lastErr = new Error(`${h.replace('https://', '')}: ${e.message}`); }
  }
  if (!rows) throw lastErr;
  if (!Array.isArray(rows)) throw new Error('پاسخ آرایه نیست');

  const bySym = Object.fromEntries(rows.map((r) => [r.symbol, num(r.price)]));
  const out = { usdt: 1 };
  for (const a of list) {
    const p = bySym[a.binance];
    if (p) out[a.id] = p;
  }
  if (Object.keys(out).length < 2) throw new Error('هیچ نمادی یافت نشد');
  return out;
}

/* ── ۳) BrsApi: طلا، سکه، نقره و ارز ────────────────────────── */
async function fromBrsApi(key) {
  if (!key) throw new Error('کلید BRSAPI_KEY تنظیم نشده است');
  const data = await getJSON(
    `https://BrsApi.ir/Api/Market/Gold_Currency.php?key=${encodeURIComponent(key)}`
  );

  // پاسخ چند آرایه دارد (gold / currency / …). همه را یکجا می‌کنیم.
  const rows = [];
  const collect = (v) => {
    if (Array.isArray(v)) rows.push(...v.filter((r) => r && typeof r === 'object'));
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(data);
  if (!rows.length) throw new Error('پاسخ خالی');

  // نرخ هر رکورد را به تومان تبدیل کن
  const priceOfRow = (r) => {
    const p = num(r.price ?? r.value ?? r.close ?? r.rate);
    if (!p) return null;
    const unit = norm(r.unit ?? r.currency ?? '');
    return unit.includes('ریال') ? p / 10 : p;
  };

  const out = {};
  for (const a of ASSETS) {
    if (!a.brs) continue;
    for (const cand of a.brs) {
      const c = norm(cand);
      const hit =
        rows.find((r) => norm(r.symbol) === c) ??
        rows.find((r) => norm(r.name) === c) ??
        rows.find((r) => norm(r.name).includes(c) && c.length > 2);
      if (hit) {
        const p = priceOfRow(hit);
        if (p) { out[a.id] = p; break; }
      }
    }
  }
  // تشخیص: نام‌های واقعی BrsApi از بیرون قابل دیدن نیست، پس هر رکوردی
  // که به دارایی‌های ما نخورد اینجا چاپ می‌شود تا فیلد brs در
  // assets/assets.js با نام درست اصلاح شود. کلید API چاپ نمی‌شود.
  const matchedNames = new Set(
    ASSETS.filter((a) => out[a.id]).map((a) => norm(a.name))
  );
  const leftovers = rows.filter((r) => !matchedNames.has(norm(r.name)));
  console.log(`\n── BrsApi: ${rows.length} رکورد، ${Object.keys(out).length} تطبیق ──`);
  for (const r of leftovers.slice(0, 80)) {
    console.log(`   symbol=${JSON.stringify(r.symbol)}  name=${JSON.stringify(r.name)}  price=${r.price}  unit=${JSON.stringify(r.unit)}`);
  }
  if (leftovers.length > 80) console.log(`   … و ${leftovers.length - 80} رکورد دیگر`);

  if (!Object.keys(out).length) throw new Error('هیچ داراییِ متناظری یافت نشد');
  return out;
}

/* ── اجرا ───────────────────────────────────────────────────── */
async function attempt(name, fn) {
  try {
    const v = await fn();
    report[name] = `ok (${Object.keys(v).length})`;
    return v;
  } catch (err) {
    report[name] = `fail: ${err.message}`;
    console.error(`✗ ${name}: ${err.message}`);
    return null;
  }
}

async function main() {
  // فایل قبلی به‌عنوان پشتیبان
  let prev = { prices: {}, usd: {} };
  try {
    prev = JSON.parse(await readFile(OUT, 'utf8'));
  } catch { /* اولین اجرا */ }

  const [nobitex, binance, brs] = await Promise.all([
    attempt('nobitex', fromNobitex),
    attempt('binance', fromBinance),
    attempt('brsapi', () => fromBrsApi(process.env.BRSAPI_KEY))
  ]);

  const prices = {};   // تومان
  const usd = {};      // دلار
  const fresh = new Set();   // چه چیزهایی *در همین اجرا* تازه گرفته شدند

  if (binance) Object.assign(usd, binance);

  // نرخ مرجع تومان برای هر دلار: اول تتر نوبیتکس، بعد دلار BrsApi
  const usdtToman = nobitex?.usdt ?? brs?.usd ?? prev.prices?.usdt ?? null;

  // رمزارزها: اولویت با قیمت تومانی نوبیتکس
  for (const a of ASSETS) {
    if (a.cat !== 'crypto') continue;
    if (nobitex?.[a.id]) { prices[a.id] = nobitex[a.id]; fresh.add(a.id); }
    else if (usd[a.id] && usdtToman) {                    // پل بایننس
      prices[a.id] = usd[a.id] * usdtToman;
      fresh.add(a.id);
    }
  }

  // طلا، سکه، نقره و ارز: فقط BrsApi
  if (brs) for (const [id, p] of Object.entries(brs)) { prices[id] = p; fresh.add(id); }

  // هرچه به دست نیامد، از اجرای قبلی نگه دار
  const kept = [];
  for (const a of ASSETS) {
    if (a.base) continue;
    if (!prices[a.id] && prev.prices?.[a.id]) {
      prices[a.id] = prev.prices[a.id];
      kept.push(a.id);
    }
  }

  const missing = ASSETS.filter((a) => !a.base && !prices[a.id]).map((a) => a.id);

  if (!Object.keys(prices).length) {
    console.error('✗ هیچ قیمتی به دست نیامد؛ فایل دست‌نخورده باقی می‌ماند.');
    process.exit(1);
  }

  // اگر هیچ منبعی جواب نداده باشد، همهٔ اعداد ارثیِ اجرای قبلی‌اند و
  // نباید وانمود کنیم تازه‌اند. seed را فقط وقتی خاموش می‌کنیم که واقعاً
  // دادهٔ زنده گرفته باشیم، وگرنه صفحه قیمت ساختگی را واقعی نشان می‌دهد.
  const payload = {
    updated: new Date().toISOString(),
    seed: prev.seed === true && fresh.size === 0,
    stale: fresh.size === 0,      // هیچ‌چیز در این اجرا تازه نشد
    sources: report,
    fresh: [...fresh],
    kept,        // از اجرای قبلی مانده‌اند (احتمالاً قدیمی)
    missing,     // اصلاً قیمتی ندارند
    prices,
    usd
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log('منابع:', report);
  console.log(`قیمت‌ها: ${Object.keys(prices).length} مورد` +
              (kept.length ? ` | قدیمی: ${kept.join(', ')}` : '') +
              (missing.length ? ` | بدون قیمت: ${missing.join(', ')}` : ''));
}

main().catch((err) => { console.error(err); process.exit(1); });
