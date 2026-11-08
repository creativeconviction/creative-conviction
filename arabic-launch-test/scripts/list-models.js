#!/usr/bin/env node
// Lists model IDs available to your keys, so config.json can use current names.
const k = (n) => process.env[n] || 'injected-by-proxy';
const get = async (name, url, headers, pick) => {
  try { const r = await fetch(url, { headers }); const j = await r.json(); console.log(`\n${name}:`, r.ok ? pick(j).join(', ') : JSON.stringify(j).slice(0, 200)); }
  catch (e) { console.log(`\n${name}: ${e.message}`); }
};
(async () => {
  await get('anthropic', 'https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': k('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, (j) => j.data.map((m) => m.id));
  await get('openai', 'https://api.openai.com/v1/models', { authorization: `Bearer ${k('OPENAI_API_KEY')}` }, (j) => j.data.map((m) => m.id).filter((id) => /gpt|image|^o\d/.test(id)).sort());
  await get('google', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': k('GEMINI_API_KEY') }, (j) => j.models.map((m) => m.name.replace('models/', '')).filter((id) => /gemini|imagen/.test(id)));
})();
