#!/usr/bin/env node
// Rendering layer: a vision model reads back the Arabic text in each generated image,
// then we compare it to the requested text (character similarity after normalization)
// and record the judge's failure flags. Human spot-check ~20% of these.
// Usage: node scripts/score-images.js [--mock]
const fs = require('fs');
const path = require('path');
const { config, out, resultsDir, chat, extractJson, normAr } = require('./lib');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const similarity = (a, b) => { const x = normAr(a), y = normAr(b); return Math.max(x.length, y.length) ? +(1 - lev(x, y) / Math.max(x.length, y.length)).toFixed(3) : 1; };

const Q = `Transcribe the Arabic text that appears in this image exactly as rendered, letter by letter — including mistakes, missing dots, wrong letters, or reversed order. Do not correct it. Then assess the rendering.
Return only JSON: {"transcription": string, "joined_letters": "yes"|"mostly"|"no", "direction_correct": true|false, "invented_glyphs": true|false, "missing_dots": true|false, "legible": 1-5, "notes": short}`;

(async () => {
  const rows = [];
  for (const kind of ['render', 'concept']) {
    const dir = path.dirname(out('images', kind, 'x'));
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const png = path.join(dir, f.replace('.json', '.png'));
      const data = fs.readFileSync(png).toString('base64');
      const mime = data.startsWith('/9j') ? 'image/jpeg' : 'image/png';
      let j;
      try {
        j = extractJson(await chat(config.judge, { messages: [{ role: 'user', content: [{ type: 'image', mime, data }, { type: 'text', text: Q }] }], maxTokens: 600, temperature: 0 }));
      } catch (e) { j = { error: e.message }; }
      const [model] = f.split('__');
      const market = meta.tag.split('__').find((t) => ['riyadh', 'cairo', 'casablanca'].includes(t));
      rows.push({ kind, model, market, tag: meta.tag, image: path.relative(path.dirname(dir), png), requested: meta.text, ...j,
        exact_match: j.transcription ? normAr(j.transcription) === normAr(meta.text) : null,
        char_similarity: j.transcription ? similarity(j.transcription, meta.text) : null });
      console.log('  ✓', f, rows.at(-1).char_similarity);
    }
  }
  const dir = resultsDir('images');
  fs.writeFileSync(path.join(dir, 'images.json'), JSON.stringify(rows, null, 2));
  console.log(`${rows.length} images → ${dir}/images.json`);
})();
