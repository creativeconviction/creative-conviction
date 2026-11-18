#!/usr/bin/env node
// Reads back the text in every wordmark/lockup (and the calibration images) with a vision model from a lab
// that makes no image model in the test, then scores exact match and character similarity.
// Motif images (M) get a short visual description for cliché tagging.
const fs = require('fs');
const path = require('path');
const { config, chat, extractJson, normAr } = require('../../arabic-launch-test/scripts/lib');

const OUT = path.join(__dirname, 'out');
const RES = path.join(__dirname, 'results'); fs.mkdirSync(RES, { recursive: true });

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const norm = (s) => normAr(String(s || '')).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const sim = (a, b) => { const x = norm(a), y = norm(b); const m = Math.max(x.length, y.length); return m ? +(1 - lev(x, y) / m).toFixed(3) : 1; };

const READ = `Transcribe every piece of text that appears in this logo image exactly as rendered, letter by letter, including mistakes, missing dots, extra or wrong letters. Do not correct anything.
Return only JSON: {"texts": [each separate text you see], "arabic_letters_joined": "yes"|"partly"|"no"|"n/a", "invented_or_garbled": true|false, "notes": short}`;
const DESCRIBE = `Describe this logo's visual motifs. Return only JSON: {"motifs": [short noun phrases for every symbol/shape/pattern], "colors": [main colors], "has_text": true|false,
"tropes": [any of: crescent, star, palm_tree, calligraphy, arabesque_pattern, mosque_dome, camel, desert_dunes, lantern, falcon, pyramid, sphinx, eye_of_horus, zellige_tile, keyhole_arch, flag_colors, generic_abstract, none]}`;

(async () => {
  const files = fs.readdirSync(OUT).filter((f) => /\.(png|jpg)$/.test(f)).sort();
  const cacheFile = path.join(RES, 'readback.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  for (const f of files) {
    if (cache[f]) continue;
    const metaFile = path.join(OUT, f.replace(/\.(png|jpg)$/, '.json'));
    if (!fs.existsSync(metaFile)) continue;
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const data = fs.readFileSync(path.join(OUT, f)).toString('base64');
    const mime = f.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    try {
      const q = meta.part === 'M' ? DESCRIBE : READ;
      cache[f] = extractJson(await chat(config.image_reader, { messages: [{ role: 'user', content: [{ type: 'image', mime, data }, { type: 'text', text: q }] }], maxTokens: 500, temperature: 0 }));
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
      process.stdout.write('.');
    } catch (e) { console.error('\n ✗', f, e.message.slice(0, 120)); if (/locked|TOP_UP|balance/i.test(e.message)) process.exit(1); }
  }

  const rows = [];
  for (const f of files) {
    const metaFile = path.join(OUT, f.replace(/\.(png|jpg)$/, '.json'));
    if (!fs.existsSync(metaFile) || !cache[f]) continue;
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const rb = cache[f];
    const row = { file: f, part: meta.part, model: meta.model, script: meta.script, country: meta.country, requested: meta.text };
    if (meta.part === 'M') { Object.assign(row, { tropes: (rb.tropes || []).join('|'), motifs: (rb.motifs || []).join('; '), has_text: rb.has_text }); }
    else {
      const texts = rb.texts || [];
      const targets = meta.part === 'L' ? [meta.native, meta.english] : [meta.text];
      row.read = texts.join(' | ');
      row.scores = targets.map((t) => Math.max(0, ...texts.map((x) => sim(x, t))));
      row.exact = row.scores.every((s) => s === 1);
      row.best_similarity = +(row.scores.reduce((a, b) => a + b, 0) / row.scores.length).toFixed(3);
      if (meta.part === 'L') { row.native_similarity = row.scores[0]; row.english_similarity = row.scores[1]; }
      row.joined = rb.arabic_letters_joined; row.garbled = rb.invented_or_garbled;
    }
    rows.push(row);
  }
  fs.writeFileSync(path.join(RES, 'rows.json'), JSON.stringify(rows, null, 1));

  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
  const avg = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null);
  console.log('\nCalibration (reader on correct text):');
  for (const r of rows.filter((r) => r.part === 'C')) console.log(`  ${r.script} ${r.requested}: read "${r.read}" exact=${r.exact}`);
  console.log('\nWordmarks, exact match by script and model:');
  const W = rows.filter((r) => r.part === 'W');
  for (const s of ['en', 'ar']) {
    const g = W.filter((r) => r.script === s);
    console.log(`  ${s}: exact ${pct(g.filter((r) => r.exact).length, g.length)}, avg similarity ${avg(g.map((r) => r.best_similarity))}`);
    for (const m of [...new Set(W.map((r) => r.model))]) { const h = g.filter((r) => r.model === m); console.log(`     ${m.padEnd(12)} ${h.filter((r) => r.exact).length}/${h.length}  sim ${avg(h.map((r) => r.best_similarity))}`); }
  }
  console.log('\nLockups (Arabic + English):');
  for (const r of rows.filter((r) => r.part === 'L')) console.log(`  ${r.model.padEnd(12)} arabic ${r.native_similarity} english ${r.english_similarity}  read "${r.read}"`);
  console.log('\nMotifs:');
  for (const r of rows.filter((r) => r.part === 'M')) console.log(`  ${r.country.padEnd(15)} ${r.model.padEnd(12)} ${r.tropes}`);
})();
