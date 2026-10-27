import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Optional publication snapshot. No API keys; failures leave the offline fallback intact.
const snapshot = {};
const jobs = [
  ['https://tabdex.ir/api/rates.php', payload => {
    const at = payload.updated;
    if (!Number.isFinite(Date.parse(at))) return;
    for (const [id, row] of Object.entries(payload.assets || {})) {
      const toman = Number(row.toman);
      if (!(Number.isFinite(toman) && toman > 0)) continue;
      // usd و change برای کارت‌های ایستای صفحهٔ اصلی (نفت به دلار، درصد تغییر).
      snapshot[id] = { ...snapshot[id], toman, at };
      if (Number(row.usd) > 0) snapshot[id].usd = Number(row.usd);
      if (Number.isFinite(Number(row.change))) snapshot[id].change = Number(row.change);
    }
  }],
  ['https://apiv2.nobitex.ir/market/stats', payload => {
    for (const [market, row] of Object.entries(payload.stats || {})) {
      const usdt = /^(.+)-usdt$/.exec(market);
      if (usdt && Number(row.latest) > 0) {
        snapshot[usdt[1]] = { ...snapshot[usdt[1]], usdt: Number(row.latest), usdtChange: Number(row.dayChange) };
        continue;
      }
      const match = /^(.+)-rls$/.exec(market);
      const toman = Number(row.latest) / 10;
      if (!match || !Number.isFinite(toman) || toman <= 0) continue;
      // Mark response receipt time separately from the exchange's last-trade time.
      snapshot[match[1]] = { ...snapshot[match[1]], toman, at: new Date().toISOString() };
    }
  }]
];
await Promise.allSettled(jobs.map(async ([url, consume]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  consume(await response.json());
}));
if (Object.keys(snapshot).length) {
  const directory = resolve('_site/data');
  await mkdir(directory, {recursive:true});
  await writeFile(resolve(directory, 'seo-rates.json'), JSON.stringify(snapshot));
}
console.log(`Publication snapshot: ${Object.keys(snapshot).length} rates; unavailable sources use dated offline history.`);
