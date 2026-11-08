#!/usr/bin/env node
// Runs the text tasks for every model × market × brief language × sample:
//   landing (HTML page), concept (campaign JSON incl. copy), persona (6-turn support chat).
// Skips anything already generated, so it is safe to re-run after a failure.
// Usage: node scripts/generate.js [--mock] [--task landing,concept,persona]   (ONLY=claude,gpt to limit models)
const fs = require('fs');
const { config, markets, prompt, marketVars, out, enabled, chat, extractJson, extractHtml } = require('./lib');

const taskArg = process.argv.indexOf('--task');
const tasks = taskArg > 0 ? process.argv[taskArg + 1].split(',') : ['landing', 'concept', 'persona'];

// Every generated item is logged with model ID and timestamp for the write-up.
const log = (task, tag, spec) => fs.appendFileSync(out('runs.jsonl'), JSON.stringify({ task, tag, provider: spec.provider, model: spec.model, at: new Date().toISOString() }) + '\n');

async function runCell(spec, market, lang, s) {
  const v = marketVars(market, lang);
  const tag = `${spec.id}__${market}__${lang}__s${s}`;

  if (tasks.includes('landing')) {
    const f = out('landing', tag + '.html');
    if (!fs.existsSync(f)) {
      const t = await chat(spec, { messages: [{ role: 'user', content: prompt(lang, 'landing', v) }], maxTokens: 12000 });
      fs.writeFileSync(f, extractHtml(t));
      log('landing', tag, spec);
      console.log('  ✓ landing', tag);
    }
  }

  if (tasks.includes('concept')) {
    const f = out('concept', tag + '.json');
    if (!fs.existsSync(f)) {
      const t = await chat(spec, { messages: [{ role: 'user', content: prompt(lang, 'concept', v) }], maxTokens: 4000 });
      let data;
      try { data = extractJson(t); } catch (e) { data = { _parse_error: true, raw: t }; }
      fs.writeFileSync(f, JSON.stringify(data, null, 2));
      log('concept', tag, spec);
      console.log('  ✓ concept', tag);
    }
  }

  if (tasks.includes('persona')) {
    const f = out('persona', tag + '.json');
    if (!fs.existsSync(f)) {
      const system = prompt(lang, 'persona', v);
      const messages = [];
      for (const u of markets[market].user_turns) {
        messages.push({ role: 'user', content: u });
        const reply = await chat(spec, { system, messages, maxTokens: 800 });
        messages.push({ role: 'assistant', content: reply.trim() });
      }
      fs.writeFileSync(f, JSON.stringify({ model: spec.model, market, lang, system, messages }, null, 2));
      log('persona', tag, spec);
      console.log('  ✓ persona', tag);
    }
  }
}

(async () => {
  const models = enabled(config.text_models);
  const jobs = [];
  for (const spec of models)
    for (const market of config.markets)
      for (const lang of config.brief_languages)
        for (let s = 1; s <= config.samples_per_cell; s++) jobs.push([spec, market, lang, s]);

  console.log(`${jobs.length} cells × [${tasks}] on ${models.map((m) => m.id)}`);
  // Run each model's cells in sequence, models in parallel (respects per-provider rate limits).
  const failures = [];
  await Promise.all(models.map(async (spec) => {
    for (const j of jobs.filter((j) => j[0] === spec)) {
      try { await runCell(...j); } catch (e) { failures.push(`${spec.id} ${j[1]} ${j[2]}: ${e.message}`); console.error('  ✗', spec.id, j[1], j[2], e.message); }
    }
  }));
  if (failures.length) { console.error(`\n${failures.length} failures; re-run to retry.`); process.exitCode = 1; }
})();
