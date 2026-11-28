#!/usr/bin/env node
// Customer-message triage across 9 language variants (English as the control).
// Each model classifies all 108 messages; then scored against the gold labels.
// Usage: node run.js [--score-only]
const fs = require('fs');
const path = require('path');
const { config, chat, extractJson, enabled } = require('../../arabic-launch-test/scripts/lib');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'messages.json'), 'utf8'));
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const RES = path.join(__dirname, 'results'); fs.mkdirSync(RES, { recursive: true });
const models = enabled(config.text_models);
const langs = Object.keys(D.languages);
const FIELDS = ['intent', 'sentiment', 'urgency', 'sarcasm', 'churn_risk'];

async function generate() {
  const jobs = [];
  for (const m of models) for (const [sid, v] of Object.entries(D.messages)) for (const l of langs)
    jobs.push({ m, sid, l, file: path.join(OUT, `${sid}__${l}__${m.id}.json`), text: v[l] });
  const todo = jobs.filter((j) => !fs.existsSync(j.file));
  console.log(`${todo.length} classifications to run`);
  await Promise.all(models.map(async (m) => {
    for (const j of todo.filter((x) => x.m === m)) {
      try {
        const raw = await chat(m, { messages: [{ role: 'user', content: D.instruction.replace('{message}', j.text) }], maxTokens: 400, temperature: 0 });
        let parsed; try { parsed = extractJson(raw); } catch { parsed = { _parse_error: true }; }
        fs.writeFileSync(j.file, JSON.stringify({ scenario: j.sid, lang: j.l, model: m.id, message: j.text, raw, ...parsed }, null, 2));
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n  ✗ ${path.basename(j.file)} ${e.message.slice(0, 120)}`);
        if (/locked|TOP_UP|balance/i.test(e.message)) process.exit(1);
      }
    }
  }));
}

function score() {
  const rows = fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
  const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v);
  for (const r of rows) {
    const g = D.gold[r.scenario];
    r.correct = {};
    for (const k of FIELDS) r.correct[k] = !r._parse_error && g[k].map(norm).includes(norm(r[k]));
    r.all_correct = FIELDS.every((k) => r.correct[k]);
  }
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
  const table = {};
  for (const l of langs) {
    table[l] = {};
    for (const m of [...new Set([...models.map((x) => x.id), ...rows.map((r) => r.model)]), 'big4']) {
      const g = rows.filter((r) => r.lang === l && (m === 'big4' ? ['claude', 'gpt', 'gemini', 'deepseek'].includes(r.model) : r.model === m));
      table[l][m] = { n: g.length, all: pct(g.filter((r) => r.all_correct).length, g.length) };
      for (const k of FIELDS) table[l][m][k] = pct(g.filter((r) => r.correct[k]).length, g.length);
    }
  }
  // Critical traps: safety urgency (M7), sarcasm (M3), polite-formula complaint read as non-negative (M4)
  const traps = {};
  for (const l of langs) {
    const g = (sid) => rows.filter((r) => r.lang === l && r.scenario === sid && ['claude', 'gpt', 'gemini', 'deepseek'].includes(r.model));
    traps[l] = {
      safety_not_high: `${g('M7').filter((r) => norm(r.urgency) !== 'high').length}/${g('M7').length}`,
      sarcasm_missed: `${g('M3').filter((r) => r.sarcasm !== true).length}/${g('M3').length}`,
      sarcasm_read_positive: `${g('M3').filter((r) => norm(r.sentiment) === 'positive').length}/${g('M3').length}`,
      polite_complaint_not_negative: `${g('M4').filter((r) => norm(r.sentiment) !== 'negative').length}/${g('M4').length}`,
      churn_missed: `${g('M11').filter((r) => r.churn_risk !== true).length}/${g('M11').length}`,
    };
  }
  fs.writeFileSync(path.join(RES, 'scores.json'), JSON.stringify({ table, traps }, null, 2));
  fs.writeFileSync(path.join(RES, 'rows.json'), JSON.stringify(rows, null, 1));
  console.log('all-fields-correct % (big four) and per model:');
  for (const l of langs) console.log(`  ${l.padEnd(9)} big4 ${String(table[l].big4.all).padStart(3)}%  ` + Object.keys(table[l]).filter((k) => k !== 'big4').map((m) => `${m} ${table[l][m].all}%`).join('  '));
  console.log('\nper field, big four:');
  for (const l of langs) console.log(`  ${l.padEnd(9)} ` + FIELDS.map((k) => `${k} ${table[l].big4[k]}%`).join('  '));
  console.log('\ntraps (big four):'); for (const l of langs) console.log(`  ${l.padEnd(9)}`, JSON.stringify(traps[l]));
}

(async () => {
  if (!process.argv.includes('--score-only')) await generate();
  score();
})();
