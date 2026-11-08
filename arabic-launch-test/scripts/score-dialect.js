#!/usr/bin/env node
// Dialect layer. For every persona turn and every Arabic copy field:
//  - marker score (transparent, no LLM): counts of each dialect's markers vs MSA markers
//    → dialectality = target / (target + msa), and "bleed" = markers from a *different* dialect
//  - optional LLM judge (--judge): variety label + dialect strength 1–5
// Usage: node scripts/score-dialect.js [--mock] [--judge]
const fs = require('fs');
const path = require('path');
const { config, markets, out, resultsDir, chat, extractJson, normAr } = require('./lib');

const DIALECTS = ['riyadh', 'cairo', 'casablanca'];
const markerSets = Object.fromEntries([...DIALECTS, 'msa'].map((k) => [k, markets.markers[k].map(normAr)]));

function markerCounts(text) {
  const words = ' ' + normAr(text).replace(/[^؀-ۿ\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const c = {};
  for (const [k, list] of Object.entries(markerSets)) {
    c[k] = 0;
    for (const m of list) {
      // allow common clitics (و، ف، ب، ل، ال) before the marker
      const re = new RegExp(`\\s(?:و|ف|ب|ل|ال|وال)?${m}(?=\\s)`, 'g');
      c[k] += (words.match(re) || []).length;
    }
  }
  return c;
}

function summarize(text, target) {
  const c = markerCounts(text);
  const others = DIALECTS.filter((d) => d !== target);
  const bleed = others.reduce((s, d) => s + c[d], 0);
  const tot = c[target] + c.msa;
  return {
    target_markers: c[target], msa_markers: c.msa,
    bleed_markers: bleed, bleed_from: others.filter((d) => c[d] > 0).join('+') || '',
    dialectality: tot ? +(c[target] / tot).toFixed(2) : null,
  };
}

async function judge(text, target) {
  const q = `Here is an Arabic text that was supposed to sound like a local from ${markets[target].city_en} (${markets[target].dialect}).\n\n«${text}»\n\nReturn only JSON: {"variety": one of "MSA","Saudi/Gulf","Egyptian","Levantine","Moroccan","Mixed","Other", "dialect_strength": 1-5 (1 = pure MSA, 5 = fully natural local dialect), "matches_target": true/false, "notes": short reason}. Classify the dialect.`;
  return extractJson(await chat(config.judge, { messages: [{ role: 'user', content: q }], maxTokens: 300, temperature: 0 }));
}

(async () => {
  const useJudge = process.argv.includes('--judge');
  const rows = [];

  const pdir = path.dirname(out('persona', 'x'));
  for (const f of fs.existsSync(pdir) ? fs.readdirSync(pdir).filter((f) => f.endsWith('.json')) : []) {
    const [model, market, lang, sample] = f.replace('.json', '').split('__');
    const d = JSON.parse(fs.readFileSync(path.join(pdir, f), 'utf8'));
    let turn = 0;
    for (const m of d.messages) {
      if (m.role !== 'assistant') continue;
      turn++;
      const row = { layer: 'persona', model, market, lang, sample, item: `turn${turn}`, text: m.content, ...summarize(m.content, market) };
      if (useJudge) Object.assign(row, await judge(m.content, market));
      rows.push(row);
    }
  }

  const cdir = path.dirname(out('concept', 'x'));
  const fields = ['headline', 'subhead', 'cta', 'ad_lines', 'app_store_blurb', 'push_notifications', 'onboarding'];
  for (const f of fs.existsSync(cdir) ? fs.readdirSync(cdir).filter((f) => f.endsWith('.json')) : []) {
    const [model, market, lang, sample] = f.replace('.json', '').split('__');
    const c = JSON.parse(fs.readFileSync(path.join(cdir, f), 'utf8'));
    for (const k of fields) {
      if (!c[k]) continue;
      const text = [].concat(c[k]).join(' / ');
      const row = { layer: 'copy', model, market, lang, sample, item: k, text, ...summarize(text, market) };
      if (useJudge) Object.assign(row, await judge(text, market));
      rows.push(row);
    }
  }

  const dir = resultsDir('dialect');
  fs.writeFileSync(path.join(dir, 'dialect.json'), JSON.stringify(rows, null, 2));
  const cols = Object.keys(rows.reduce((a, r) => Object.assign(a, r), {}));
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  fs.writeFileSync(path.join(dir, 'dialect.csv'), '﻿' + csv);
  console.log(`${rows.length} rows → ${dir}/dialect.csv`);
})();
