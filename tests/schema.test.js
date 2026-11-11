const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

/* قرارداد داده‌های ساختاریافته (docs/SCHEMA.md): هر صفحهٔ سایت‌مپ یک
   بلاک JSON-LD معتبر، هویت یکسان برند، نود صفحه با @id پایدار، هیچ
   ادعای فروش و هیچ ارجاع بی‌مقصد. */
execFileSync(process.execPath, ['scripts/build-pages.mjs'], {stdio:'pipe'});
const root = path.resolve('_site');
const ORIGIN = 'https://tabdex.ir';

function graphOf(html, url) {
  const blocks = [...html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, `${url}: دقیقاً یک بلاک JSON-LD`);
  assert.ok(!blocks[0][1].includes('<'), `${url}: < باید escape شده باشد`);
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@context'], 'https://schema.org', `${url}: @context`);
  return data['@graph'] || [data];
}
// هر آبجکتی که جز @id کلید دیگری دارد تعریف است؛ آبجکت تک‌کلید @id ارجاع.
function walk(value, defined, referenced) {
  if (Array.isArray(value)) { value.forEach(v => walk(v, defined, referenced)); return; }
  if (!value || typeof value !== 'object') return;
  const keys = Object.keys(value);
  if (value['@id'] && keys.length === 1) referenced.add(value['@id']);
  else if (value['@id']) defined.add(value['@id']);
  for (const key of keys) if (key !== '@id') walk(value[key], defined, referenced);
}
const FORBIDDEN = ['Offer', 'AggregateOffer', 'seller', 'availability', 'price', 'priceCurrency', 'priceSpecification', 'FinancialProduct', 'Product', 'potentialAction', 'aggregateRating'];

const sitemap = fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const graphs = {};
for (const url of urls) {
  const parsed = new URL(url);
  const amount = parsed.searchParams.get('amount');
  const file = amount ? path.join(root,parsed.pathname,`amount-${amount}.html`) : path.join(root,parsed.pathname,'index.html');
  const graph = graphOf(fs.readFileSync(file,'utf8'), url);
  graphs[url] = graph;
  const text = JSON.stringify(graph);
  for (const word of FORBIDDEN) assert.ok(!text.includes(`"${word}"`), `${url}: «${word}» نباید در اسکیما باشد`);
  const org = graph.find(n => n['@type'] === 'Organization');
  const site = graph.find(n => n['@type'] === 'WebSite');
  assert.equal(org && org['@id'], `${ORIGIN}/#organization`, `${url}: سازمان با @id یکسان`);
  assert.equal(site && site['@id'], `${ORIGIN}/#website`, `${url}: وب‌سایت با @id یکسان`);
  assert.equal(org.name, 'تبدکس'); assert.equal(org.alternateName, 'Tabdex');
  const page = graph.find(n => n['@id'] === `${url}#webpage`);
  assert.ok(page, `${url}: نود صفحه با @id پایدار`);
  assert.equal(page.url, url, `${url}: url نود صفحه همان canonical است`);
  const defined = new Set(), referenced = new Set();
  walk(graph, defined, referenced);
  for (const id of referenced) assert.ok(defined.has(id), `${url}: ارجاع بی‌مقصد ${id}`);
  // about: #organization فقط روی «درباره ما» و «تماس».
  const aboutOrg = JSON.stringify(page.about || null).includes('#organization');
  assert.equal(aboutOrg, ['/about/','/contact/'].includes(parsed.pathname), `${url}: about سازمان فقط روی درباره و تماس`);
}

const typeOf = (url) => graphs[ORIGIN + url].find(n => n['@id'] === `${ORIGIN}${url}#webpage`)['@type'];
assert.equal(typeOf('/'), 'CollectionPage');
assert.equal(typeOf('/price/'), 'CollectionPage');
assert.equal(typeOf('/price/gold/'), 'CollectionPage');
assert.equal(typeOf('/about/'), 'AboutPage');
assert.equal(typeOf('/contact/'), 'ContactPage');
assert.equal(typeOf('/methodology/'), 'WebPage');
assert.equal(typeOf('/convert/usd-to-irt/'), 'WebPage');
assert.equal(typeOf('/convert/rahn-ejare/'), 'WebPage');
const rentGraph = graphs[`${ORIGIN}/convert/rahn-ejare/`];
const rentApp = rentGraph.find(n => n['@type'] === 'WebApplication');
assert.equal(rentApp['@id'], `${ORIGIN}/convert/rahn-ejare/#application`);
assert.equal(rentApp.url, `${ORIGIN}/convert/rahn-ejare/`);
assert.equal(rentApp.name, 'ماشین حساب تبدیل رهن و اجاره');
assert.equal(rentApp.isAccessibleForFree, true);
assert.equal(rentGraph.find(n => n['@type'] === 'WebPage').mainEntity['@id'], rentApp['@id']);

// نمودار با تاریخ شروع واقعی ⇒ Dataset؛ رمزارز (تاریخ شروع نامعلوم) و طلای ۲۲ (بی‌سری) ⇒ نه.
const usd = graphs[`${ORIGIN}/price/currency/usd/`].find(n => n['@type'] === 'Dataset');
const history = JSON.parse(fs.readFileSync('data/market-history.json','utf8')).assets.usd;
const since = new Date(Math.min(...history.map(p => p[0])) * 1000).toISOString().slice(0,10);
assert.equal(usd && usd.temporalCoverage, `${since}/..`, 'دلار: بازهٔ واقعی داده');
assert.ok(!('license' in usd), 'Dataset: مجوز باز ادعا نمی‌شود');
for (const url of ['/price/crypto/btc/', '/price/gold/gold22/', '/price/energy/brent/']) {
  assert.ok(!graphs[ORIGIN + url].some(n => n['@type'] === 'Dataset'), `${url}: بدون Dataset`);
}
assert.ok(graphs[`${ORIGIN}/price/coin/baharazadi/`].some(n => n['@type'] === 'Dataset'), 'بهار آزادی با شناسهٔ تاریخچهٔ bahar');
// رمزارزها فهرست ثابت ندارند؛ بقیهٔ دسته‌ها دارند.
assert.ok(!graphs[`${ORIGIN}/price/crypto/`].some(n => n['@type'] === 'ItemList'));
assert.ok(graphs[`${ORIGIN}/price/gold/`].some(n => n['@type'] === 'ItemList'));
// صفحهٔ قیمت و جفت مبدلش به یک موجودیت اشاره می‌کنند.
const pairAbout = graphs[`${ORIGIN}/convert/usd-to-irt/`].find(n => n['@id'] === `${ORIGIN}/convert/usd-to-irt/#webpage`).about.map(t => t['@id']);
assert.ok(pairAbout.includes(`${ORIGIN}/price/currency/usd/#thing`));

// price.js اسکیمای سرورساخته را بازنویسی نمی‌کند.
for (const file of ['price/index.html','price/gold/index.html','price/crypto/btc/index.html']) {
  assert.match(fs.readFileSync(path.join(root,file),'utf8'), /<script id="price-schema" data-built type="application\/ld\+json">/, `${file}: نشان data-built`);
}
const priceJs = fs.readFileSync('assets/price.js','utf8');
assert.ok(priceJs.includes('!script.hasAttribute("data-built")'));
for (const word of ['"Dataset"', 'PropertyValue', '"Offer"']) assert.ok(!priceJs.includes(word), `price.js: ${word} نباید باشد`);

import('../scripts/schema.mjs').then((s) => {
  assert.equal(s.buildDataset('/x/', {name:'x'}), null, 'بدون تاریخ شروع ⇒ null');
  // تاریخ شمسی شکل ISO دارد و بی‌صدا «۱۴۰۴ میلادی» می‌شد؛ سال بیرون از بازه رد می‌شود.
  assert.equal(s.buildDataset('/x/', {name:'x', since:'1404-11-01'}), null);
  assert.equal(s.buildDataset('/x/', {name:'x', since:'2999-01-01'}), null);
  assert.equal(s.buildDataset('/x/', {name:'x', since:'2012-06-19'}).temporalCoverage, '2012-06-19/..');
  assert.equal(s.buildItemList('/x/', 'x', []), null, 'فهرست خالی ⇒ null');
  assert.equal(s.jsonLdScript([]), '');
  const script = s.jsonLdScript([{ '@type':'Thing', name:'</script><script>alert(1)</script>' }]);
  assert.equal(script.match(/<\/script>/g).length, 1, 'متن داخل JSON-LD تگ را نمی‌بندد');
  assert.ok(!s.jsonLdScript([{ '@type':'Thing', name:'x' }]).includes('@graph'), 'تک‌نود بدون @graph');
  console.log(`Schema checks passed for ${urls.length} canonical pages.`);
}).catch((error) => { console.error(error); process.exitCode = 1; });
