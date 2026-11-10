#!/usr/bin/env node
// Image layer.
//  1. Controlled rendering test: each market's fixed headlines → every image model.
//  2. (--concepts) Each campaign's own image_prompt + headline → every image model, for stereotype coding.
// Usage: node scripts/images.js [--mock] [--concepts] [--samples 2]
const fs = require('fs');
const path = require('path');
const { config, markets, out, enabled, image } = require('./lib');

const samplesArg = process.argv.indexOf('--samples');
const samples = samplesArg > 0 ? +process.argv[samplesArg + 1] : 2;

const billboard = (city, text) =>
  `A clean, modern street billboard in ${city} advertising a grocery delivery app called Qareeb. ` +
  `The billboard shows only this Arabic text, written exactly as given, right-to-left, with correctly joined letters: «${text}». Photorealistic, daytime.`;

(async () => {
  const jobs = [];
  for (const market of config.markets) {
    markets[market].headlines.forEach((h, i) => {
      for (let s = 1; s <= samples; s++) jobs.push({ kind: 'render', tag: `${market}__h${i + 1}__s${s}`, text: h, prompt: billboard(markets[market].city_en, h) });
    });
  }
  if (process.argv.includes('--concepts')) {
    const dir = out('concept', 'x').replace(/x$/, '');
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!c.image_prompt) continue;
      const p = `${c.image_prompt}\n\nInclude this Arabic headline in the image, written exactly as given: «${c.headline}».`;
      jobs.push({ kind: 'concept', tag: f.replace('.json', ''), text: c.headline, prompt: p });
    }
  }

  const models = enabled(config.image_models);
  console.log(`${jobs.length} prompts × ${models.map((m) => m.id)}`);
  await Promise.all(models.map(async (spec) => {
    for (const j of jobs) {
      const base = out('images', j.kind, `${spec.id}__${j.tag}`);
      if (fs.existsSync(base + '.png')) continue;
      try {
        fs.writeFileSync(base + '.png', await image(spec, j.prompt));
        fs.writeFileSync(base + '.json', JSON.stringify({ model: spec.model, ...j }, null, 2));
        console.log('  ✓', spec.id, j.kind, j.tag);
      } catch (e) { console.error('  ✗', spec.id, j.tag, e.message); process.exitCode = 1; }
    }
  }));
})();
