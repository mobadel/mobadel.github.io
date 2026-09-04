/* تکمیل دادهٔ روزانهٔ جدید از جدول عمومی «قیمت پایانی» TGJU. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profiles = {
  usd: "price_dollar_rl", eur: "price_eur", gbp: "price_gbp", aed: "price_aed",
  try: "price_try", cny: "price_cny", rub: "price_rub", afn: "price_afn",
  gold18: "geram18", emami: "sekee"
};
const historyPath = resolve(ROOT, "data/market-history.json");
const history = JSON.parse(await readFile(historyPath, "utf8"));

function cells(row) {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}
for (const [id, profile] of Object.entries(profiles)) {
  const response = await fetch(`https://www.tgju.org/profile/${profile}/history`, { headers: { "user-agent": "tabdex-history-sync/1.0 (+https://tabdex.ir)" } });
  if (!response.ok) throw new Error(`TGJU ${id}: ${response.status}`);
  const html = await response.text();
  const points = new Map((history.assets[id] || []).map((point) => [point[0], point]));
  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const columns = cells(row[0]);
    if (columns.length < 7 || !/^\d{4}\/\d{2}\/\d{2}$/.test(columns[6])) continue;
    const time = Math.floor(Date.parse(columns[6].replaceAll("/", "-") + "T00:00:00Z") / 1000);
    const rial = Number(columns[3].replaceAll(",", ""));
    if (Number.isFinite(time) && rial > 0) points.set(time, [time, rial / 10]);
  }
  history.assets[id] = [...points.values()].sort((a, b) => a[0] - b[0]);
}
history.updated = new Date().toISOString();
await writeFile(historyPath, JSON.stringify(history));
console.log("TGJU history synced.");
