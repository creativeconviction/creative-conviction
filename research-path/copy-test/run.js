#!/usr/bin/env node
// Marketing-copy dialect experiment. Three parts, all asking for the same copy
// (tagline, 3 Instagram ad lines, 1 push notification) for the Qareeb grocery app:
//   A  mirror:   prompt in English / formal Arabic / Saudi / Egyptian / Levantine / Darija, no location
//   B  city:     same prompts + "launching in <city>" (Riyadh, Cairo, Beirut, Casablanca), no dialect named
//   C  explicit: English prompt naming the target dialect, 14 cities from Rabat to Muscat
// Usage: node run.js [--part A,B,C] [--dry-run]     (ONLY=claude,gpt to limit models)
const fs = require('fs');
const path = require('path');
const { config, chat, enabled } = require('../../arabic-launch-test/scripts/lib');

const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const parts = (arg('--part') || 'A,B,C').split(',');
const SAMPLES = { A: 3, B: 2, C: 2 };
const langs = Object.keys(P.task);

const jobs = [];
const add = (part, cond, prompt, meta) => {
  for (let s = 1; s <= SAMPLES[part]; s++) jobs.push({ part, cond, prompt, s, ...meta });
};
if (parts.includes('A')) for (const l of langs) add('A', l, P.task[l], { prompt_lang: l });
if (parts.includes('B')) for (const l of langs) for (const [city, c] of Object.entries(P.launch_cities)) {
  const name = l === 'en' ? city : c.ar;
  add('B', `${l}-${city}`, `${P.task[l]} ${P.launch_city[l].replace('{city}', name)}`, { prompt_lang: l, city, target_region: c.region });
}
if (parts.includes('C')) for (const [city, t] of Object.entries(P.dialect_targets)) {
  if (city.startsWith('_')) continue;
  add('C', city, P.explicit_template.split('{city}').join(city).replace('{dialect}', t.dialect), { prompt_lang: 'en', city, target_region: t.region, target_city_code: t.city_code });
}

const models = enabled(config.text_models);
const all = [];
for (const m of models) for (const j of jobs) all.push({ ...j, model: m.id, spec: m, id: `${j.part}__${j.cond}__${m.id}__s${j.s}` });
const todo = all.filter((j) => !fs.existsSync(path.join(OUT, j.id + '.json')));
console.log(`${all.length} generations planned (${parts}), ${todo.length} to run, models: ${models.map((m) => m.id)}`);
if (process.argv.includes('--dry-run')) { todo.slice(0, 8).forEach((j) => console.log('  ', j.id, '→', j.prompt.slice(0, 90))); process.exit(0); }

(async () => {
  let fails = 0;
  await Promise.all(models.map(async (m) => {
    for (const j of todo.filter((x) => x.model === m.id)) {
      try {
        const text = await chat(m, { messages: [{ role: 'user', content: j.prompt }], maxTokens: 1200 });
        const { spec, ...rest } = j;
        fs.writeFileSync(path.join(OUT, j.id + '.json'), JSON.stringify({ ...rest, model_id: m.model, output: text.trim(), at: new Date().toISOString() }, null, 2));
        process.stdout.write('.');
      } catch (e) {
        fails++; console.error(`\n  ✗ ${j.id} ${e.message.slice(0, 150)}`);
        if (/locked|TOP_UP|balance/i.test(e.message)) { console.error('fal.ai balance is empty.'); process.exit(1); }
      }
    }
  }));
  console.log(`\ndone, ${fails} failed`);
  if (fails) process.exitCode = 1;
})();
