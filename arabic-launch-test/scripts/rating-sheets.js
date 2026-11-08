#!/usr/bin/env node
// Builds blinded rating sheets (CSV, opens in Excel/Google Sheets) for native-speaker raters,
// one per dialect. Model and brief language are hidden behind random IDs; the key is saved separately.
// Usage: node scripts/rating-sheets.js [--mock]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { out, resultsDir } = require('./lib');

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const RUBRIC = 'Rate 1–5. fluency: reads like a native wrote it. dialect_fidelity: sounds like people from this city (1 = formal MSA or another country\'s dialect). translationese: 1 = obviously translated, 5 = not at all. persuasion: would this make you act (copy only). persona_consistency: stays in character as a local (chat only).';

const items = { riyadh: [], cairo: [], casablanca: [] };
const cdir = path.dirname(out('concept', 'x'));
for (const f of fs.readdirSync(cdir).filter((f) => f.endsWith('.json'))) {
  const [model, market, lang, sample] = f.replace('.json', '').split('__');
  const c = JSON.parse(fs.readFileSync(path.join(cdir, f), 'utf8'));
  const text = ['headline', 'subhead', 'cta', 'ad_lines', 'app_store_blurb'].filter((k) => c[k]).map((k) => `[${k}] ${[].concat(c[k]).join(' / ')}`).join('\n');
  items[market].push({ type: 'copy', model, lang, sample, text });
}
const pdir = path.dirname(out('persona', 'x'));
for (const f of fs.readdirSync(pdir).filter((f) => f.endsWith('.json'))) {
  const [model, market, lang, sample] = f.replace('.json', '').split('__');
  const d = JSON.parse(fs.readFileSync(path.join(pdir, f), 'utf8'));
  const text = d.messages.map((m) => (m.role === 'user' ? 'العميل: ' : 'الموظفة: ') + m.content).join('\n');
  items[market].push({ type: 'chat', model, lang, sample, text });
}

const dir = resultsDir('ratings');
const key = [];
for (const [market, list] of Object.entries(items)) {
  const rows = shuffle(list).map((it) => { const id = crypto.randomBytes(3).toString('hex'); key.push({ id, market, ...it, text: undefined }); return { id, ...it }; });
  const header = ['id', 'type', 'text', 'fluency', 'dialect_fidelity', 'translationese', 'persuasion', 'persona_consistency', 'comments'];
  const csv = [`"${RUBRIC}"`, header.join(','), ...rows.map((r) => [r.id, r.type, JSON.stringify(r.text), '', '', '', '', '', ''].join(','))].join('\n');
  fs.writeFileSync(path.join(dir, `sheet-${market}.csv`), '﻿' + csv);
}
fs.writeFileSync(path.join(dir, 'KEY-do-not-share.json'), JSON.stringify(key, null, 2));
console.log(`sheets → ${dir} (${key.length} items)`);
