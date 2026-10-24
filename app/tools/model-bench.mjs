// How the GPT models were picked: each model alone (no fallback) draws a few subjects through lib/openai.mjs, timed.
// node tools/model-bench.mjs <out dir> "gpt-6.1-sol:low,gpt-5.6-sol:low" "draw the oxford logo|draw a cat"   (spends credits)
import { writeFileSync } from "node:fs";
process.loadEnvFile(new URL("../.env", import.meta.url));
const gpt = await import("../lib/openai.mjs");
const OUT = process.argv[2], models = process.argv[3].split(","), asks = process.argv[4].split("|");
const rows = await Promise.all(models.flatMap((spec) => asks.map(async (ask) => {
  const t0 = Date.now();
  try {
    const out = await gpt.chat([{ role: "user", text: ask }], [], null, { key: process.env.OPENAI_API_KEY, models: [spec], timeoutMs: 60000 });
    const svg = out.actions.find((a) => a.svg)?.svg || "";
    const tag = `${spec.split(":")[0]}__${ask.replace(/\W+/g, "-")}`; writeFileSync(`${OUT}/${tag}.svg`, svg);
    return { model: spec, ask, s: ((Date.now() - t0) / 1000).toFixed(1), paths: (svg.match(/<path/g) || []).length, reply: out.reply.slice(0, 50), tag };
  } catch (e) { return { model: spec, ask, s: ((Date.now() - t0) / 1000).toFixed(1), error: e.message.slice(0, 80) }; }
})));
console.table(rows.map(({ tag, ...r }) => r));
writeFileSync(`${OUT}/rows.json`, JSON.stringify(rows, null, 1));
