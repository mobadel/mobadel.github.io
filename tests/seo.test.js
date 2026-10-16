const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
execFileSync(process.execPath, ['scripts/build-pages.mjs'], {stdio:'pipe'});
const root = path.resolve('_site');
const sitemap = fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(new Set(urls).size,urls.length,'canonical sitemap URLs must be unique');
for (const url of urls) {
  const parsed = new URL(url); const pathname = parsed.pathname;
  // صفحه‌های «تبدیل‌های پرتکرار» (?amount=…) فایل ایستای خودشان را دارند.
  const amount = parsed.searchParams.get('amount');
  const file = amount ? path.join(root,pathname,`amount-${amount}.html`) : path.join(root,pathname,'index.html');
  assert.ok(fs.existsSync(file),`${url} must have initial HTML`);
  const html = fs.readFileSync(file,'utf8');
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`),`${url} must have self canonical`);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${url} must have one primary heading`);
  assert.ok(!/<title>[^<]*۱۴۰۵/.test(html),`${url} must not advertise a stale build-day title`);
  assert.ok(html.includes('href="/contact/"')&&html.includes('href="/about/"'));
  if (pathname.startsWith('/convert/')&&pathname!='/convert/') {
    const reverse = pathname.replace(/([a-z0-9]+)-to-([a-z0-9]+)/,'$2-to-$1');
    assert.ok(html.includes(`href="${reverse}"`));
    assert.ok(fs.existsSync(path.join(root,reverse,'index.html')),'reverse destination must exist');
    // کادر «روش محاسبه» عمداً حذف شده؛ محتوایش تکراری بود.
    assert.ok(!html.includes('این مثال نرخ واقعی بازار نیست'),'pair page must not repeat the methodology box');
  }
}
// تبدیل‌های پرتکرار: صفحهٔ مقدار canonical خودش، H1 مقدار، فیلد پرشده و قاعدهٔ .htaccess.
{
  const freq = JSON.parse(fs.readFileSync('data/frequent-conversions.json','utf8'));
  let count = 0;
  for (const [key, entry] of Object.entries(freq.pairs)) for (const item of entry.items) {
    const url = `https://tabdex.ir/convert/${key}/?amount=${item.amount}`;
    assert.ok(urls.includes(url), `${url} در سایت‌مپ`);
    const html = fs.readFileSync(path.join(root,'convert',key,`amount-${item.amount}.html`),'utf8');
    assert.ok(html.includes(`<h1 id="page-title">${item.text}؟</h1>`), `${url}: H1`);
    assert.ok(html.includes(`data-amount-page="${item.amount}"`), `${url}: نشان صفحهٔ مقدار`);
    assert.ok(html.includes(`href="/convert/${key}/?amount=${item.amount}" aria-current="page"`), `${url}: دکمهٔ فعلی`);
    count += 1;
  }
  assert.equal(count, 309);
  const pair = fs.readFileSync(path.join(root,'convert','usd-to-irt','index.html'),'utf8');
  assert.ok(pair.includes('<link rel="canonical" href="https://tabdex.ir/convert/usd-to-irt/">'), 'صفحهٔ مادر canonical خودش');
  assert.match(pair, /<section class="frequent-conversions" id="frequent-conversions" data-pair="usd-to-irt"[^>]*><h2 id="frequent-title">تبدیل‌های پرتکرار<\/h2>[\s\S]*?<h2>۱۰۰۰ دلار چند تومان است<\/h2>/, 'بخش و دکمه‌ها تیتر ۲');
  // بخش فقط روی جفت «دارایی دارای داده → تومان»؛ بقیه فقط جای خالی پنهان دارند.
  // دکمه‌ها مال جفت خودشان‌اند: تومان به دلار و دلار به لیر دکمهٔ خودشان را دارند،
  // جفت‌های بی‌داده هیچ.
  assert.match(fs.readFileSync(path.join(root,'convert','irt-to-usd','index.html'),'utf8'), /data-pair="irt-to-usd"[\s\S]*?<h2>۱۰ میلیون تومان چند دلار است<\/h2>/);
  const usdTry = fs.readFileSync(path.join(root,'convert','usd-to-try','index.html'),'utf8');
  assert.match(usdTry, /data-pair="usd-to-try"[\s\S]*?href="\/convert\/usd-to-try\/\?amount=100"/);
  assert.ok(!usdTry.includes('-to-irt/?amount='), 'دلار به لیر دکمهٔ جفت دیگری ندارد');
  for (const slug of ['btc-to-irt','irt-to-btc','usd-to-gold18','gold18-to-eur']) {
    const other = fs.readFileSync(path.join(root,'convert',slug,'index.html'),'utf8');
    assert.ok(other.includes('<section class="frequent-conversions" id="frequent-conversions" data-pair="" aria-labelledby="frequent-title" hidden></section>'), `${slug}: بخش پنهان و خالی`);
    assert.ok(!other.includes('تبدیل‌های پرتکرار'), `${slug}: بی‌تیتر پرتکرار`);
  }
  assert.match(fs.readFileSync(path.join(root,'convert','index.html'),'utf8'), /id="frequent-conversions"[^>]*hidden><\/section>/, 'صفحهٔ اصلی مبدل (پاسخ جفت‌های ساخته‌نشده) فقط جای خالی دارد');
  if (fs.existsSync(path.join(root,'.htaccess'))) {
    const ht = fs.readFileSync(path.join(root,'.htaccess'),'utf8');
    assert.ok(ht.includes('RewriteCond %{QUERY_STRING} ^amount=0\\.5$\n  RewriteRule ^convert/gold18-to-irt/?$ convert/gold18-to-irt/amount-0.5.html [L]'), '.htaccess قاعدهٔ مقدار اعشاری');
    assert.ok(ht.indexOf('amount-1000.html') < ht.indexOf('RewriteCond %{REQUEST_FILENAME} -f'), 'قاعده‌ها پیش از پوشهٔ واقعی');
  }
}
for (const slug of ['cake','hype','safe']) {
 const html=fs.readFileSync(path.join(root,'convert',slug+'-to-irt','index.html'),'utf8');
 assert.ok(!html.includes('<h1 id="page-title">تبدیل دلار به تومان</h1>'));
}
assert.ok(!fs.readFileSync(path.join(root,'price/index.html'),'utf8').includes('دسترسی به صفحات قیمت'),'هاب قیمت نباید فهرست «دسترسی به صفحات قیمت» داشته باشد');
for (const group of ['currency','gold','coin','commodity','energy','crypto']) assert.ok(!fs.readFileSync(path.join(root,'price',group,'index.html'),'utf8').includes('دسترسی به صفحات قیمت'),`صفحهٔ دسته ${group} نباید فهرست «دسترسی به صفحات قیمت» داشته باشد`);
const contact=fs.readFileSync(path.join(root,'contact/index.html'),'utf8');
assert.ok(contact.includes('mailto:info@tabdex.ir')&&!contact.includes('tel:')&&!contact.includes('09981903599'),'contact page: email only, no phone number');
// Exercise the real rendering branch with missing upstream rates; indexing and
// the pre-rendered identity must survive the outage.
const script=fs.readFileSync('assets/price.js','utf8');
const functions=script.slice(script.indexOf('function renderAsset()'),script.indexOf('function start()'));
const fields={ 'asset-freshness': {textContent:''} };
let noindex=false;
const context={assets:{},CATEGORIES:{crypto:{name:'ارزهای دیجیتال'}},categoryFromPath:()=> 'crypto',assetSlugFromPath:()=> 'btc',idFromSlug:x=>x,text:(el,t)=>{if(el)el.textContent=t;},document:{title:'قیمت بیت کوین',getElementById:id=>fields[id]||null},setMeta:(a,k,v)=>{if(k==='robots'&&v.includes('noindex'))noindex=true;}};
vm.runInNewContext(functions+';renderAsset();',context);
assert.equal(noindex,false,'temporary rate failure must not noindex a valid asset');
assert.equal(context.document.title,'قیمت بیت کوین');
assert.ok(fields['asset-freshness'].textContent.includes('موقتاً'));
console.log(`SEO checks passed for ${urls.length} canonical HTML pages and upstream outage handling.`);
const pendingApp = fs.readFileSync('assets/app.js','utf8');
for (const name of ['paintConversion','paintPairContent','paintRate']) {
 const start=pendingApp.indexOf('function '+name+'()');
 const end=pendingApp.indexOf('\n  function ',start+1);
 const state={pendingRoute:{from:'cake',to:'irt'}};
 const elements={pageTitle:{textContent:'تبدیل پنکیک سواپ به تومان'},pairContentTitle:{textContent:'پنکیک سواپ'},rateValue:{textContent:''}};
 vm.runInNewContext(pendingApp.slice(start,end)+';'+name+'();',{state,elements});
 assert.equal(elements.pageTitle.textContent,'تبدیل پنکیک سواپ به تومان');
 assert.equal(elements.pairContentTitle.textContent,'پنکیک سواپ');
}
