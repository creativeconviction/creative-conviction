#!/usr/bin/env node
// Campaign adaptation: 14 English lines × 7 markets × 5 models.
// Measures: how literal each adaptation is (character overlap with the model's own literal translation),
// the approach chosen, and culture checks (alcohol/pork in Saudi copy, Black Friday handling, etc.).
// Usage: node run.js [--score-only]
const fs = require('fs');
const path = require('path');
const { config, chat, extractJson, enabled } = require('../../arabic-launch-test/scripts/lib');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'campaigns.json'), 'utf8'));
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const RES = path.join(__dirname, 'results'); fs.mkdirSync(RES, { recursive: true });
const models = enabled(config.text_models);

async function generate() {
  const jobs = [];
  for (const m of models) for (const [lid, line] of Object.entries(D.lines)) for (const [mk, mname] of Object.entries(D.markets))
    jobs.push({ m, lid, mk, file: path.join(OUT, `${lid}__${mk}__${m.id}.json`),
      prompt: D.instruction.replace('{market}', mname).replace('{brand}', line.brand).replace('{text}', line.text) });
  const todo = jobs.filter((j) => !fs.existsSync(j.file));
  console.log(`${todo.length} adaptations to run`);
  await Promise.all(models.map(async (m) => {
    for (const j of todo.filter((x) => x.m === m)) {
      try {
        const raw = await chat(m, { messages: [{ role: 'user', content: j.prompt }], maxTokens: 600, temperature: 1 });
        let parsed; try { parsed = extractJson(raw); } catch { parsed = { _parse_error: true }; }
        fs.writeFileSync(j.file, JSON.stringify({ line: j.lid, market: j.mk, model: m.id, source: D.lines[j.lid].text, raw, ...parsed }, null, 2));
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n  ✗ ${path.basename(j.file)} ${e.message.slice(0, 120)}`);
        if (/locked|TOP_UP|balance/i.test(e.message)) process.exit(1);
      }
    }
  }));
}

// character n-gram F-score (chrF-style), script-agnostic
function chrf(a, b, n = 3) {
  const grams = (s) => { s = s.replace(/\s+/g, ' ').toLowerCase(); const c = {}; for (let k = 1; k <= n; k++) for (let i = 0; i + k <= s.length; i++) { const g = s.slice(i, i + k); c[g] = (c[g] || 0) + 1; } return c; };
  const A = grams(a || ''), B = grams(b || '');
  let inter = 0, ta = 0, tb = 0;
  for (const g in A) { ta += A[g]; if (B[g]) inter += Math.min(A[g], B[g]); }
  for (const g in B) tb += B[g];
  if (!ta || !tb) return null;
  const p = inter / ta, r = inter / tb;
  return p + r ? +((2 * p * r) / (p + r)).toFixed(3) : 0;
}

const ALCOHOL_PORK = /خمر|بيرة|نبيذ|كحول|مشروبات كحولية|خنزير|بيكون|لحم مقدد|كوكتيل|cocktail|beer|wine|bacon|pork/i;
const LATIN = /[A-Za-z]{3,}/;

function score() {
  const rows = fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
  for (const r of rows) {
    r.literalness = chrf(r.adaptation, r.literal);
    r.has_latin = LATIN.test(r.adaptation || '');
    r.alcohol_or_pork = ALCOHOL_PORK.test(r.adaptation || '');
    r.mentions_white_friday = /بيضاء|white friday|الجمعة البيضاء|بيضا/i.test(r.adaptation || '');
    r.still_black_friday = /black friday|بلاك فرايدي|الجمعة السوداء|黑色星期五|ब्लैक फ्राइडे|ブラックフライデー|viernes negro|vendredi noir/i.test(r.adaptation || '');
  }
  const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
  const big = rows.filter((r) => r.model !== 'saba');
  const out = { literalness_by_market: {}, approach_by_market: {}, by_type: {}, saudi_alcohol_pork: {}, black_friday: {} };
  for (const mk of Object.keys(D.markets)) {
    const g = big.filter((r) => r.market === mk);
    out.literalness_by_market[mk] = avg(g.map((r) => r.literalness));
    const c = {}; g.forEach((r) => { c[r.approach] = (c[r.approach] || 0) + 1; }); out.approach_by_market[mk] = c;
    const bf = g.filter((r) => r.line === 'C1');
    out.black_friday[mk] = { kept_black_friday: bf.filter((r) => r.still_black_friday).length, white_friday: bf.filter((r) => r.mentions_white_friday).length, n: bf.length, examples: bf.map((r) => `${r.model}: ${r.adaptation}`) };
  }
  for (const t of ['famous tagline', 'idiom / pun', 'culturally loaded']) {
    out.by_type[t] = {};
    for (const mk of Object.keys(D.markets)) out.by_type[t][mk] = avg(big.filter((r) => r.market === mk && D.lines[r.line].type === t).map((r) => r.literalness));
  }
  for (const lid of ['I3', 'C2']) {
    const g = big.filter((r) => r.line === lid && r.market === 'ar_sa');
    out.saudi_alcohol_pork[lid] = { n: g.length, contains: g.filter((r) => r.alcohol_or_pork).length, examples: g.map((r) => `${r.model}: ${r.adaptation}`) };
  }
  fs.writeFileSync(path.join(RES, 'scores.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(RES, 'rows.json'), JSON.stringify(rows, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

(async () => {
  if (!process.argv.includes('--score-only')) await generate();
  score();
})();
