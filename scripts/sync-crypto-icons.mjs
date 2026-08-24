import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OPTIONS_URL = "https://apiv2.nobitex.ir/v2/options";
const ICON_BASE_URL = "https://cdn.nobitex.ir/crypto/";
const OUTPUT_DIR = path.resolve("assets/crypto-icons");
const CONCURRENCY = 12;
const PNG_FALLBACKS = {
  sent: "https://s2.coinmarketcap.com/static/img/coins/128x128/38868.png",
  tao: "https://s2.coinmarketcap.com/static/img/coins/128x128/22974.png",
  zk: "https://s2.coinmarketcap.com/static/img/coins/128x128/24091.png"
};

const optionsResponse = await fetch(OPTIONS_URL);
if (!optionsResponse.ok) throw new Error(`Options request failed: ${optionsResponse.status}`);
const payload = await optionsResponse.json();
const symbols = [...new Set((payload.coins || [])
  .map((item) => String(item?.coin || "").toLowerCase())
  .filter((symbol) => symbol && symbol !== "rls" && /^[a-z0-9_]+$/.test(symbol)))]
  .sort();

await mkdir(OUTPUT_DIR, { recursive: true });
let nextIndex = 0;
let saved = 0;
const missing = [];

async function worker() {
  while (nextIndex < symbols.length) {
    const symbol = symbols[nextIndex++];
    const response = await fetch(`${ICON_BASE_URL}${encodeURIComponent(symbol)}.svg`);
    if (!response.ok) {
      if (PNG_FALLBACKS[symbol]) {
        const fallback = await fetch(PNG_FALLBACKS[symbol]);
        if (fallback.ok) {
          await writeFile(path.join(OUTPUT_DIR, `${symbol}.png`), Buffer.from(await fallback.arrayBuffer()));
          saved += 1;
          continue;
        }
      }
      missing.push(`${symbol} (${response.status})`);
      continue;
    }
    const svg = await response.text();
    if (!/<svg[\s>]/i.test(svg)) {
      if (PNG_FALLBACKS[symbol]) {
        const fallback = await fetch(PNG_FALLBACKS[symbol]);
        if (fallback.ok) {
          await writeFile(path.join(OUTPUT_DIR, `${symbol}.png`), Buffer.from(await fallback.arrayBuffer()));
          saved += 1;
          continue;
        }
      }
      missing.push(`${symbol} (invalid SVG)`);
      continue;
    }
    await writeFile(path.join(OUTPUT_DIR, `${symbol}.svg`), svg, "utf8");
    saved += 1;
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Saved ${saved}/${symbols.length} crypto icons to ${OUTPUT_DIR}`);
if (missing.length) {
  console.warn(`Missing ${missing.length}: ${missing.join(", ")}`);
}
