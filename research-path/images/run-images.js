#!/usr/bin/env node
// Runs the imagery tests across image models via fal.ai (FAL_KEY), using the model setup in
// ../../arabic-launch-test/config.json. Image IDs match the "Image tags" tab of research-log.xlsx.
//
//   node run-images.js --dry-run          # list what would be generated + rough cost
//   node run-images.js --only T,D1,A2     # run some prompts only (by ID or ID prefix)
//   node run-images.js                    # run everything (skips images that already exist)
// Contact sheets (one comparison grid per prompt) are built at the end, in sheets/.
const fs = require('fs');
const path = require('path');
const { config, image } = require('../../arabic-launch-test/scripts/lib');

const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const only = arg('--only') ? arg('--only').split(',') : null;
const dry = process.argv.includes('--dry-run');
// Rough per-image prices (USD) for planning only; check fal.ai for current pricing.
const PRICE = { 'gpt-image': 0.2, 'nano-banana': 0.12, ideogram: 0.09, recraft: 0.21, seedream: 0.07, 'qwen-image': 0.03, flux: 0.14 };

const jobs = [];
for (const p of P.imagery) {
  if (only && !only.some((o) => p.id.startsWith(o))) continue;
  const cities = p.city === 'each' ? [...P.cities, P.control_city] : p.city === 'one' ? ['Cairo'] : ['none'];
  const langs = p.ar ? ['en', 'ar'] : ['en'];
  for (const city of cities) for (const lang of langs) {
    if (lang === 'ar' && city === P.control_city) continue;
    const tpl = lang === 'ar' ? p.ar : p.en;
    const prompt = tpl.split('[CITY]').join(lang === 'ar' ? (P.cities_ar[city] || city) : city);
    for (const m of P.model_groups[p.models]) jobs.push({ id: `${p.id}__${city}__${lang}__${m}`, model: m, prompt, p: p.id });
  }
}
const exists = (j) => ['.jpg', '.png'].some((x) => fs.existsSync(path.join(OUT, j.id + x)));
const todo = jobs.filter((j) => !exists(j));
const cost = todo.reduce((s, j) => s + (PRICE[j.model] || 0.15), 0);
console.log(`${jobs.length} images planned, ${todo.length} to generate, ~$${cost.toFixed(0)}`);
if (dry) { for (const j of todo.slice(0, 12)) console.log('  ', j.id, '→', j.prompt.slice(0, 70)); process.exit(0); }

(async () => {
  const byModel = {};
  for (const j of todo) (byModel[j.model] ||= []).push(j);
  let fails = 0;
  await Promise.all(Object.entries(byModel).map(async ([mid, list]) => {
    const spec = config.image_models.find((m) => m.id === mid);
    for (const j of list) {
      try {
        fs.writeFileSync(path.join(OUT, j.id + '.png'), await image(spec, j.prompt));
        fs.writeFileSync(path.join(OUT, j.id + '.json'), JSON.stringify({ ...j, endpoint: spec.endpoint, at: new Date().toISOString() }, null, 2));
        console.log('  ✓', j.id);
      } catch (e) {
        fails++; console.error('  ✗', j.id, e.message.slice(0, 160));
        if (/locked|TOP_UP|balance/i.test(e.message)) { console.error('fal.ai balance is empty: top up and re-run.'); process.exit(1); }
      }
    }
  }));
  require('child_process').execSync(`python3 "${path.join(__dirname, 'contact-sheets.py')}"`, { stdio: 'inherit' });
  if (fails) { console.error(`${fails} failed; re-run to retry.`); process.exitCode = 1; }
})();
