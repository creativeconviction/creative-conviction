#!/usr/bin/env node
// Brand identity test across 9 scripts, with English as the control.
//  W  wordmarks: 2 names × 9 scripts × 7 image models
//  L  bilingual lockups (native + English): 5 scripts × 7 models
//  M  "a logo for a fintech from <country>" (no text): 6 countries × 7 models, for motif clichés
//  C  calibration: the same texts rendered correctly in a browser, to measure the read-back model's own accuracy per script
// Usage: node run.js [--only W,L,M,C] [--dry-run]
const fs = require('fs');
const path = require('path');
const { config, image, chat, extractJson } = require('../../arabic-launch-test/scripts/lib');

const N = JSON.parse(fs.readFileSync(path.join(__dirname, 'names.json'), 'utf8'));
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const parts = (arg('--only') || 'C,W,L,M').split(',');
const dry = process.argv.includes('--dry-run');
const models = config.image_models;

const jobs = [];
for (const [code, s] of Object.entries(N.scripts)) for (const len of ['short', 'long'])
  jobs.push({ part: 'W', key: `W__${code}__${len}`, text: s[len], prompt: N.prompts.wordmark.replace('{text}', s[len]), script: code });
for (const code of N.lockups) {
  const s = N.scripts[code], en = N.scripts.en.short;
  jobs.push({ part: 'L', key: `L__${code}`, text: `${s.short} | ${en}`, native: s.short, english: en, prompt: N.prompts.lockup.replace('{native}', s.short).replace('{english}', en), script: code });
}
for (const c of N.motif_countries) jobs.push({ part: 'M', key: `M__${c.replace(/\s/g, '-')}`, prompt: N.prompts.motif.replace('{country}', c), country: c });

async function calibration() {
  // Render each text correctly with a proper font, so we can measure how well the read-back model reads each script.
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  for (const [code, s] of Object.entries(N.scripts)) for (const len of ['short', 'long']) {
    const f = path.join(OUT, `C__${code}__${len}.png`);
    if (fs.existsSync(f)) continue;
    const p = await b.newPage({ viewport: { width: 1024, height: 576 } });
    await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.font)}:wght@700&display=swap" rel="stylesheet"></head>
      <body style="margin:0;display:grid;place-items:center;height:100vh;background:#fff"><div style="font:700 96px '${s.font}';color:#0f6b4f">${s.text || s[len]}</div></body></html>`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: f }); await p.close();
    fs.writeFileSync(f.replace('.png', '.json'), JSON.stringify({ part: 'C', key: `C__${code}__${len}`, text: s[len], script: code, model: 'browser' }, null, 2));
  }
  await b.close();
}

(async () => {
  if (parts.includes('C') && !dry) { await calibration(); console.log('calibration images done'); }
  const todo = [];
  for (const j of jobs.filter((j) => parts.includes(j.part))) for (const m of models) {
    const base = path.join(OUT, `${j.key}__${m.id}`);
    if (!fs.existsSync(base + '.png') && !fs.existsSync(base + '.jpg')) todo.push({ ...j, m, base });
  }
  console.log(`${todo.length} images to generate`);
  if (dry) return;
  let fails = 0;
  const byModel = {}; for (const t of todo) (byModel[t.m.id] ||= []).push(t);
  await Promise.all(Object.values(byModel).map(async (list) => {
    for (const t of list) {
      try {
        fs.writeFileSync(t.base + '.png', await image(t.m, t.prompt));
        const { m, base, ...meta } = t;
        fs.writeFileSync(t.base + '.json', JSON.stringify({ ...meta, model: m.id, endpoint: m.endpoint, at: new Date().toISOString() }, null, 2));
        process.stdout.write('.');
      } catch (e) {
        fails++; console.error(`\n  ✗ ${path.basename(t.base)} ${e.message.slice(0, 140)}`);
        if (/locked|TOP_UP|balance/i.test(e.message)) { console.error('fal.ai balance is empty.'); process.exit(1); }
      }
    }
  }));
  console.log(`\ndone, ${fails} failed`);
})();
