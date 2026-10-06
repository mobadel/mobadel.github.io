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
  const pathname = new URL(url).pathname;
  const file = path.join(root,pathname,'index.html');
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
    assert.ok(html.includes('این مثال نرخ واقعی بازار نیست'));
  }
}
for (const slug of ['cake','hype','safe']) {
 const html=fs.readFileSync(path.join(root,'convert',slug+'-to-irt','index.html'),'utf8');
 assert.ok(!html.includes('<h1 id="page-title">تبدیل دلار به تومان</h1>'));
}
const contact=fs.readFileSync(path.join(root,'contact/index.html'),'utf8');
assert.ok(contact.includes('mailto:info@tabdex.ir')&&contact.includes('tel:+989981903599'));
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
