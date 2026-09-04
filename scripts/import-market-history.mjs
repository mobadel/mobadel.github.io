/*
 * دادهٔ CSV روزانهٔ بازار ایران را به قرارداد سادهٔ نمودار تبدیل می‌کند.
 * ورودی را بیرون از مخزن نگه می‌داریم؛ خروجیِ قابل انتشار data/market-history.json است.
 * اجرا: node scripts/import-market-history.mjs "C:/path/to/prices"
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const INPUT = process.argv[2];
if (!INPUT) throw new Error("مسیر پوشهٔ CSVها لازم است.");

const SOURCES = {
  AEDIRT: "aed", AFNIRT: "afn", CNYIRT: "cny", EURIRT: "eur", GBPIRT: "gbp",
  GOLD18IRT: "gold18", IRCOINBAIRT: "bahar", IRCOINEMIRT: "emami", RUBIRT: "rub",
  TRYIRT: "try", USDIRT: "usd"
};

const history = {};
for (const file of await readdir(INPUT)) {
  const match = file.match(/^([A-Z0-9]+)\.csv$/);
  if (!match || !SOURCES[match[1]]) continue;
  const text = await readFile(resolve(INPUT, file), "utf8");
  const points = text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [time, price] = line.split(",");
    return [Number(time), Number(price)];
  }).filter(([time, price]) => Number.isFinite(time) && Number.isFinite(price) && price > 0);
  points.sort((a, b) => a[0] - b[0]);
  history[SOURCES[match[1]]] = points;
}

await writeFile(resolve(ROOT, "data/market-history.json"), JSON.stringify({
  source: "دادهٔ تاریخی تأمین‌شده توسط تبدکس؛ تکمیل روزهای جدید از TGJU و اسنپ‌شات BRS",
  unit: "toman",
  updated: new Date().toISOString(),
  assets: history
}));
console.log(`Imported ${Object.keys(history).length} assets.`);
