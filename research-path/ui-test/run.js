#!/usr/bin/env node
// Arabic RTL UI-generation test.
// 8 screens × 4 conditions × 5 models. Step 1 builds frozen English reference pages (one model, once),
// used by every model in the "localize" condition so they all start from identical code.
// Usage: node run.js [--cond plain,localize,arabic,explicit] [--dry-run]   (ONLY=claude,gpt limits models)
const fs = require('fs');
const path = require('path');
const { config, chat, enabled, extractHtml } = require('../../arabic-launch-test/scripts/lib');

const S = JSON.parse(fs.readFileSync(path.join(__dirname, 'screens.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
const REF = path.join(__dirname, 'reference');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(REF, { recursive: true });
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const conds = (arg('--cond') || 'plain,localize,arabic,explicit').split(',');
const dry = process.argv.includes('--dry-run');
const models = enabled(config.text_models);

function promptFor(cond, sid) {
  const s = S.screens[sid];
  if (cond === 'plain') return `${s.en}\n\n${S.suffix.en}`;
  if (cond === 'arabic') return `${s.ar}\n\n${S.suffix.ar}`;
  if (cond === 'explicit') return `${s.en}\n\n${S.suffix.en} ${S.suffix.rtl_explicit}`;
  if (cond === 'localize') return S.localize.replace('{ref}', fs.readFileSync(path.join(REF, sid + '.html'), 'utf8'));
}

async function save(spec, file, prompt, meta) {
  const raw = await chat(spec, { messages: [{ role: 'user', content: prompt }], maxTokens: 16000, temperature: 1 });
  const html = extractHtml(raw);
  fs.writeFileSync(file, html);
  fs.writeFileSync(file.replace(/\.html$/, '.meta.json'), JSON.stringify({ ...meta, model_id: spec.model, raw_chars: raw.length, complete: /<\/html>\s*$/i.test(html.trim()), at: new Date().toISOString() }, null, 2));
}

(async () => {
  // 1. English references for the localize condition
  if (conds.includes('localize')) {
    const refSpec = config.text_models.find((m) => m.id === S.reference_model);
    const missing = Object.keys(S.screens).filter((sid) => !fs.existsSync(path.join(REF, sid + '.html')));
    console.log(`references: ${missing.length} to build with ${refSpec.id}`);
    if (!dry) await Promise.all(missing.map((sid) => save(refSpec, path.join(REF, sid + '.html'), `${S.screens[sid].en}\n\n${S.suffix.en_reference}`, { screen: sid, cond: 'reference' })
      .then(() => process.stdout.write('r')).catch((e) => console.error('\n  ✗ ref', sid, e.message.slice(0, 150)))));
  }
  // 2. Arabic pages
  const jobs = [];
  for (const cond of conds) for (const sid of Object.keys(S.screens)) for (const m of models)
    jobs.push({ cond, sid, m, file: path.join(OUT, `${sid}__${cond}__${m.id}.html`) });
  const todo = jobs.filter((j) => !fs.existsSync(j.file));
  console.log(`\npages: ${jobs.length} planned, ${todo.length} to build (${conds}) on ${models.map((m) => m.id)}`);
  if (dry) { todo.slice(0, 6).forEach((j) => console.log('  ', path.basename(j.file))); return; }
  let fails = 0;
  await Promise.all(models.map(async (m) => {
    for (const j of todo.filter((x) => x.m === m)) {
      if (j.cond === 'localize' && !fs.existsSync(path.join(REF, j.sid + '.html'))) continue;
      try { await save(m, j.file, promptFor(j.cond, j.sid), { screen: j.sid, cond: j.cond, model: m.id }); process.stdout.write('.'); }
      catch (e) {
        fails++; console.error(`\n  ✗ ${path.basename(j.file)} ${e.message.slice(0, 150)}`);
        if (/locked|TOP_UP|balance/i.test(e.message)) { console.error('fal.ai balance is empty.'); process.exit(1); }
      }
    }
  }));
  console.log(`\ndone, ${fails} failed`);
  if (fails) process.exitCode = 1;
})();
