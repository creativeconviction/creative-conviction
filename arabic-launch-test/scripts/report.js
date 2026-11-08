#!/usr/bin/env node
// Aggregates every layer into results/report.md — one table per layer, by model and market.
// Usage: node scripts/report.js [--mock]
const fs = require('fs');
const path = require('path');
const { resultsDir, MOCK } = require('./lib');

const R = resultsDir();
const read = (p) => { try { return JSON.parse(fs.readFileSync(path.join(R, p), 'utf8')); } catch { return []; } };
const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '–'; };
const pct = (xs) => xs.length ? Math.round((100 * xs.filter(Boolean).length) / xs.length) + '%' : '–';
const group = (rows, keys) => { const g = {}; for (const r of rows) (g[keys.map((k) => r[k]).join(' · ')] ||= []).push(r); return g; };
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

let md = `# Arabic Launch Test — results${MOCK ? ' (MOCK DATA)' : ''}\n\nGenerated ${new Date().toISOString().slice(0, 16)}.\n`;

// 1. Software design (RTL audit)
const rtl = read('rtl/summary.json').map((r) => {
  const [model, market, lang] = path.basename(r.file, '.html').split('__');
  return { ...r, model, market, lang };
});
if (rtl.length) {
  md += `\n## 1. Software design — RTL audit of generated landing pages\n\n`;
  md += table(['model', 'brief', 'avg score /100', 'pages', 'most common failures'], Object.entries(group(rtl, ['model', 'lang'])).map(([k, rs]) => {
    const fails = {}; rs.flatMap((r) => r.failed).forEach((f) => (fails[f] = (fails[f] || 0) + 1));
    return [...k.split(' · '), avg(rs.map((r) => r.score)), rs.length, Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, n]) => `${f} (${n})`).join(', ')];
  }));
  md += `\n\nFonts actually rendered: ${[...new Set(rtl.map((r) => r.font))].join(', ')}\n`;
}

// 2. Rendering (images)
const img = read('images/images.json');
if (img.length) {
  md += `\n## 2. Rendering — Arabic text inside generated images\n\n`;
  md += table(['image model', 'kind', 'n', 'exact match', 'avg char similarity', 'letters joined', 'direction ok', 'invented glyphs', 'avg legibility'],
    Object.entries(group(img, ['model', 'kind'])).map(([k, rs]) => [...k.split(' · '), rs.length, pct(rs.map((r) => r.exact_match)), avg(rs.map((r) => r.char_similarity)),
      pct(rs.map((r) => r.joined_letters === 'yes')), pct(rs.map((r) => r.direction_correct)), pct(rs.map((r) => r.invented_glyphs)), avg(rs.map((r) => r.legible))]));
  md += `\n\nBy market (render test):\n\n` + table(['market', 'avg char similarity', 'exact match'],
    Object.entries(group(img.filter((r) => r.kind === 'render'), ['market'])).map(([k, rs]) => [k, avg(rs.map((r) => r.char_similarity)), pct(rs.map((r) => r.exact_match))]));
  md += '\n';
}

// 3. Voice (dialect)
const dia = read('dialect/dialect.json');
if (dia.length) {
  md += `\n## 3. Copy & voice — dialect fidelity\n\nDialectality = target-dialect markers ÷ (target + MSA markers). Bleed = markers from another country's dialect.\n\n`;
  md += table(['model', 'market', 'brief', 'copy dialectality', 'chat dialectality', 'items with bleed', 'judge: matches target'],
    Object.entries(group(dia, ['model', 'market', 'lang'])).map(([k, rs]) => [...k.split(' · '),
      avg(rs.filter((r) => r.layer === 'copy').map((r) => r.dialectality)), avg(rs.filter((r) => r.layer === 'persona').map((r) => r.dialectality)),
      pct(rs.map((r) => r.bleed_markers > 0)), rs[0].matches_target === undefined ? '–' : pct(rs.map((r) => r.matches_target))]));

  // 4. Persona drift by turn
  const chats = dia.filter((r) => r.layer === 'persona');
  const turns = [...new Set(chats.map((r) => r.item))].sort();
  md += `\n\n## 4. Persona — dialect by chat turn (drift)\n\n`;
  md += table(['model', 'market', ...turns], Object.entries(group(chats, ['model', 'market'])).map(([k, rs]) =>
    [...k.split(' · '), ...turns.map((t) => avg(rs.filter((r) => r.item === t).map((r) => r.dialectality)))]));
  const bleedSrc = {}; dia.filter((r) => r.bleed_from).forEach((r) => { const key = `${r.market} ← ${r.bleed_from}`; bleedSrc[key] = (bleedSrc[key] || 0) + 1; });
  if (Object.keys(bleedSrc).length) md += `\n\nDialect bleed (target ← intruding dialect): ${Object.entries(bleedSrc).map(([k, v]) => `${k}: ${v}`).join('; ')}\n`;
}

// 5. Concept
const pairs = read('concepts/en-vs-ar.json');
const tropes = read('concepts/tropes.json');
if (pairs.length || tropes.length) {
  md += `\n## 5. Concept — does an Arabic brief change the idea, or only the language?\n\n`;
  if (pairs.length) md += table(['model', 'market', 'concept sim', 'visual sim', 'tone sim', 'more local', 'what changed'],
    pairs.map((p) => [p.model, p.market, p.concept_similarity, p.visual_similarity, p.tone_similarity, p.more_locally_specific, (p.what_changed || []).join('; ')])) + '\n\n';
  if (tropes.length) md += 'Visual tropes in key visuals (count of campaigns):\n\n' + table(['brief', 'market', 'campaigns', 'avg tropes', 'tropes seen'],
    Object.entries(group(tropes, ['lang', 'market'])).map(([k, rs]) => { const t = {}; rs.flatMap((r) => r.tropes.split('|').filter(Boolean)).forEach((x) => (t[x] = (t[x] || 0) + 1));
      return [...k.split(' · '), rs.length, avg(rs.map((r) => r.n_tropes)), Object.entries(t).map(([a, b]) => `${a} ${b}`).join(', ')]; })) + '\n';
}

md += `\n## 6. Native-speaker ratings\n\nFill in \`results/ratings/sheet-*.csv\`, save as \`rated-*.csv\` in the same folder, then re-run this report.\n`;
const rdir = path.join(R, 'ratings');
const keyFile = path.join(rdir, 'KEY-do-not-share.json');
if (fs.existsSync(keyFile)) {
  const key = Object.fromEntries(JSON.parse(fs.readFileSync(keyFile, 'utf8')).map((k) => [k.id, k]));
  const rated = [];
  for (const f of fs.readdirSync(rdir).filter((f) => /^rated-.*\.csv$/.test(f))) {
    const lines = fs.readFileSync(path.join(rdir, f), 'utf8').replace(/^﻿/, '').split('\n').slice(2);
    for (const l of lines) {
      const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')) || [];
      if (key[cells[0]]) rated.push({ ...key[cells[0]], fluency: +cells[3], dialect_fidelity: +cells[4], translationese: +cells[5], persuasion: +cells[6], persona_consistency: +cells[7] });
    }
  }
  if (rated.length) md += '\n' + table(['model', 'market', 'brief', 'n', 'fluency', 'dialect fidelity', 'translationese', 'persuasion', 'persona'],
    Object.entries(group(rated, ['model', 'market', 'lang'])).map(([k, rs]) => [...k.split(' · '), rs.length, ...['fluency', 'dialect_fidelity', 'translationese', 'persuasion', 'persona_consistency'].map((m) => avg(rs.map((r) => r[m]).filter((x) => x > 0)))])) + '\n';
}

fs.writeFileSync(path.join(R, 'report.md'), md);
console.log('report →', path.join(R, 'report.md'));
