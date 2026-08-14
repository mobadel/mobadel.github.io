/* ────────────────────────────────────────────────────────────────
   assets.js — رجیستری دارایی‌ها
   این فایل هم در مرورگر و هم در اسکریپت Node (GitHub Actions) خوانده
   می‌شود، بنابراین نه از import استفاده می‌کند نه از export.

   هر دارایی:
     id        شناسه یکتا (کلید در prices.json)
     name      نام فارسی
     sym       نماد نمایشی
     cat       crypto | gold | fiat
     color     رنگ نشان
     glyph     متن داخل نشان (۱ تا ۳ نویسه یا اموجی)
     dp        تعداد رقم اعشار پیشنهادی برای نمایش مقدار
     alias     واژه‌های کمکی برای جستجو
     nobitex   نماد در API نوبیتکس (قیمت تومانی)
     binance   نماد در API بایننس (قیمت دلاری)
     brs       نامزدهای symbol/name در BrsApi (اولین تطابق برنده است)
   ──────────────────────────────────────────────────────────────── */

var CATEGORIES = [
  { id: 'all',    label: 'همه' },
  { id: 'crypto', label: 'ارز دیجیتال' },
  { id: 'gold',   label: 'طلا و سکه' },
  { id: 'fiat',   label: 'ارز' }
];

var ASSETS = [
  /* ── پایه ───────────────────────────────────────────────── */
  { id: 'irt', name: 'تومان', sym: 'IRT', cat: 'fiat', color: '#22c55e', glyph: 'ت', dp: 0,
    alias: ['toman', 'tooman', 'irr', 'rial', 'ریال', 'تومن'], base: true },

  /* ── ارز دیجیتال ────────────────────────────────────────── */
  { id: 'usdt', name: 'تتر', sym: 'USDT', cat: 'crypto', color: '#26a17b', glyph: '₮', dp: 2,
    alias: ['tether', 'usdt', 'تتر'], nobitex: 'usdt', binance: 'USDTUSD' },

  { id: 'btc', name: 'بیت‌کوین', sym: 'BTC', cat: 'crypto', color: '#f7931a', glyph: '₿', dp: 8,
    alias: ['bitcoin', 'btc', 'بیتکوین', 'بیت کوین'], nobitex: 'btc', binance: 'BTCUSDT' },

  { id: 'eth', name: 'اتریوم', sym: 'ETH', cat: 'crypto', color: '#627eea', glyph: 'Ξ', dp: 6,
    alias: ['ethereum', 'eth', 'اتر', 'اتریم'], nobitex: 'eth', binance: 'ETHUSDT' },

  { id: 'ton', name: 'تون‌کوین', sym: 'TON', cat: 'crypto', color: '#0098ea', glyph: '◈', dp: 4,
    alias: ['toncoin', 'ton', 'گرام', 'gram', 'تون کوین', 'تلگرام'], nobitex: 'ton', binance: 'TONUSDT' },

  { id: 'xrp', name: 'ریپل', sym: 'XRP', cat: 'crypto', color: '#23292f', glyph: '✕', dp: 4,
    alias: ['ripple', 'xrp', 'ریپل'], nobitex: 'xrp', binance: 'XRPUSDT' },

  { id: 'bnb', name: 'بی‌ان‌بی', sym: 'BNB', cat: 'crypto', color: '#f0b90b', glyph: 'B', dp: 5,
    alias: ['binance coin', 'bnb', 'بایننس'], nobitex: 'bnb', binance: 'BNBUSDT' },

  /* ── طلا و سکه ──────────────────────────────────────────── */
  { id: 'gold18', name: 'طلای ۱۸ عیار', sym: 'گرم', cat: 'gold', color: '#d4a017', glyph: '🥇', dp: 3,
    alias: ['طلا', 'gold', '18', '۱۸', 'هجده', 'گرم طلا'],
    brs: ['IR_GOLD_18K', 'طلای 18 عیار', 'طلای ۱۸ عیار', 'طلا 18 عیار'] },

  { id: 'coin_emami', name: 'سکه امامی', sym: 'سکه', cat: 'gold', color: '#eab308', glyph: '🪙', dp: 4,
    alias: ['سکه', 'امامی', 'coin', 'emami', 'تمام سکه'],
    brs: ['IR_COIN_EMAMI', 'سکه امامی', 'سکه امام'] },

  { id: 'coin_bahar', name: 'سکه بهار آزادی', sym: 'بهار', cat: 'gold', color: '#ca8a04', glyph: '🪙', dp: 4,
    alias: ['بهار', 'آزادی', 'bahar', 'azadi', 'سکه بهار'],
    brs: ['IR_COIN_BAHAR', 'سکه بهار آزادی', 'بهار آزادی'] },

  { id: 'coin_half', name: 'نیم سکه', sym: 'نیم', cat: 'gold', color: '#facc15', glyph: '🪙', dp: 4,
    alias: ['نیم', 'half', 'نیم سکه'],
    brs: ['IR_COIN_HALF', 'نیم سکه'] },

  { id: 'coin_quarter', name: 'ربع سکه', sym: 'ربع', cat: 'gold', color: '#fde047', glyph: '🪙', dp: 4,
    alias: ['ربع', 'quarter', 'ربع سکه'],
    brs: ['IR_COIN_QUARTER', 'ربع سکه'] },

  { id: 'coin_gram', name: 'سکه گرمی', sym: 'گرمی', cat: 'gold', color: '#fef08a', glyph: '🪙', dp: 4,
    alias: ['گرمی', 'سکه گرمی', 'gerami', '1g'],
    brs: ['IR_COIN_1G', 'سکه گرمی', 'سکه یک گرمی'] },

  { id: 'silver999', name: 'نقره ۹۹۹', sym: 'گرم', cat: 'gold', color: '#94a3b8', glyph: '🥈', dp: 3,
    alias: ['نقره', 'silver', '999', '۹۹۹', 'گرم نقره'],
    brs: ['IR_SILVER_999', 'نقره 999', 'نقره ۹۹۹', 'گرم نقره'] },

  /* ── ارز ────────────────────────────────────────────────── */
  { id: 'usd', name: 'دلار آمریکا', sym: 'USD', cat: 'fiat', color: '#16a34a', glyph: '$', dp: 2,
    alias: ['dollar', 'usd', 'دلار', 'آمریکا'],
    brs: ['USD', 'دلار', 'دلار آمریکا'] },

  { id: 'eur', name: 'یورو', sym: 'EUR', cat: 'fiat', color: '#2563eb', glyph: '€', dp: 2,
    alias: ['euro', 'eur', 'یورو'],
    brs: ['EUR', 'یورو'] },

  { id: 'gbp', name: 'پوند انگلیس', sym: 'GBP', cat: 'fiat', color: '#7c3aed', glyph: '£', dp: 2,
    alias: ['pound', 'gbp', 'پوند', 'انگلیس', 'استرلینگ'],
    brs: ['GBP', 'پوند', 'پوند انگلیس'] },

  { id: 'aed', name: 'درهم امارات', sym: 'AED', cat: 'fiat', color: '#059669', glyph: 'د', dp: 2,
    alias: ['dirham', 'aed', 'درهم', 'امارات', 'دبی'],
    brs: ['AED', 'درهم', 'درهم امارات'] },

  { id: 'try', name: 'لیر ترکیه', sym: 'TRY', cat: 'fiat', color: '#dc2626', glyph: '₺', dp: 2,
    alias: ['lira', 'try', 'لیر', 'ترکیه', 'ترک'],
    brs: ['TRY', 'لیر', 'لیر ترکیه'] },

  { id: 'afn', name: 'افغانی', sym: 'AFN', cat: 'fiat', color: '#0891b2', glyph: '؋', dp: 2,
    alias: ['afghani', 'afn', 'افغانی', 'افغانستان'],
    brs: ['AFN', 'افغانی', 'افغانستان'] },

  { id: 'thb', name: 'بات تایلند', sym: 'THB', cat: 'fiat', color: '#db2777', glyph: '฿', dp: 2,
    alias: ['baht', 'thb', 'بات', 'تایلند'],
    brs: ['THB', 'بات', 'بات تایلند'] },

  { id: 'gel', name: 'لاری گرجستان', sym: 'GEL', cat: 'fiat', color: '#b91c1c', glyph: '₾', dp: 2,
    alias: ['lari', 'gel', 'لاری', 'گرجستان', 'گرجی'],
    brs: ['GEL', 'لاری', 'لاری گرجستان'] },

  { id: 'amd', name: 'درام ارمنستان', sym: 'AMD', cat: 'fiat', color: '#ea580c', glyph: '֏', dp: 2,
    alias: ['dram', 'amd', 'درام', 'ارمنستان', 'ارمنی'],
    brs: ['AMD', 'درام', 'درام ارمنستان'] }
];

/* دارایی‌های پرکاربرد که به‌صورت چیپ زیر هر فیلد نشان داده می‌شوند */
var QUICK = ['irt', 'usdt', 'usd', 'gold18', 'btc', 'coin_emami'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ASSETS: ASSETS, CATEGORIES: CATEGORIES, QUICK: QUICK };
}
