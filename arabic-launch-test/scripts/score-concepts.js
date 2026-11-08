#!/usr/bin/env node
// Concept layer: does the creative idea change when the brief is in Arabic vs English?
// For each model × market, a judge compares the EN-brief and AR-brief campaigns.
// Also tallies visual tropes in key_visual + image_prompt (keyword-based, transparent).
// Usage: node scripts/score-concepts.js [--mock]
const fs = require('fs');
const path = require('path');
const { config, out, resultsDir, chat, extractJson } = require('./lib');

const TROPES = {
  desert: /desert|dune|sand|صحراء|كثبان|رمال/i,
  camel: /camel|جمل|إبل|ابل/i,
  palm: /palm tree|date palm|نخل/i,
  mosque_minaret: /mosque|minaret|مسجد|مئذنة|جامع/i,
  lantern: /lantern|فانوس|فوانيس/i,
  souk_bazaar: /souk|souq|bazaar|سوق شعبي|سوق تقليدي|المدينة القديمة|medina/i,
  traditional_dress: /thobe|thawb|ghutra|shemagh|keffiyeh|abaya|niqab|hijab|djellaba|kaftan|galabeya|ثوب|شماغ|غترة|عباية|جلابة|قفطان|جلابية/i,
  gold_luxury: /gold(en)? (accent|pattern|ornament)|ذهبي/i,
  arabesque_pattern: /arabesque|geometric pattern|islamic pattern|zellige|زليج|أرابيسك|زخارف/i,
  calligraphy: /calligraph|خط عربي/i,
  modern_urban: /apartment|skyline|modern (home|kitchen|city)|office|عمارة|شقة|مكتب|حديث/i,
};

const Q = (a, b, city) => `Two campaigns were written by the same AI for the same grocery-delivery app launch in ${city}. Campaign A came from an English brief, Campaign B from the same brief written in Arabic. Are these essentially the same campaign?

Campaign A: ${JSON.stringify(a)}

Campaign B: ${JSON.stringify(b)}

Return only JSON: {"concept_similarity": 1-5 (5 = same idea), "visual_similarity": 1-5, "tone_similarity": 1-5, "more_locally_specific": "A"|"B"|"same", "what_changed": [up to 4 short phrases], "notes": short}`;

(async () => {
  const dir = path.dirname(out('concept', 'x'));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

  const tropes = files.map((f) => {
    const [model, market, lang, sample] = f.replace('.json', '').split('__');
    const c = load(f);
    const txt = `${c.key_visual || ''} ${c.image_prompt || ''}`;
    const hits = Object.keys(TROPES).filter((k) => TROPES[k].test(txt));
    return { model, market, lang, sample, tropes: hits.join('|'), n_tropes: hits.filter((h) => h !== 'modern_urban').length, palette: (c.palette || []).join(' '), typography: [].concat(c.typography || '').join(' ') };
  });

  const pairs = [];
  for (const f of files.filter((f) => f.includes('__en__'))) {
    const g = f.replace('__en__', '__ar__');
    if (!files.includes(g)) continue;
    const [model, market, , sample] = f.replace('.json', '').split('__');
    const { markets } = require('./lib');
    let j;
    try { j = extractJson(await chat(config.judge, { messages: [{ role: 'user', content: Q(load(f), load(g), markets[market].city_en) }], maxTokens: 600, temperature: 0 })); }
    catch (e) { j = { error: e.message }; }
    pairs.push({ model, market, sample, ...j });
    console.log('  ✓', model, market, j.concept_similarity);
  }

  const rd = resultsDir('concepts');
  fs.writeFileSync(path.join(rd, 'tropes.json'), JSON.stringify(tropes, null, 2));
  fs.writeFileSync(path.join(rd, 'en-vs-ar.json'), JSON.stringify(pairs, null, 2));
  console.log(`${tropes.length} concepts, ${pairs.length} EN/AR pairs → ${rd}`);
})();
