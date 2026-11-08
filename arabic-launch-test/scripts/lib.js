// Shared helpers: config, prompt filling, provider calls, caching.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOCK = process.env.MOCK === '1' || process.argv.includes('--mock');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const markets = JSON.parse(fs.readFileSync(path.join(ROOT, 'markets.json'), 'utf8'));

function prompt(lang, name, vars) {
  let t = fs.readFileSync(path.join(ROOT, 'prompts', lang, name + '.md'), 'utf8').trim();
  for (const [k, v] of Object.entries(vars)) t = t.split('{' + k + '}').join(v);
  return t;
}

function marketVars(market, lang) {
  const m = markets[market];
  const city = lang === 'ar' ? m.city_ar : m.city_en;
  const agent_name = lang === 'ar' ? m.agent_name_ar : m.agent_name;
  const brief = prompt(lang, 'brief', { city });
  return { city, agent_name, brief };
}

// Mock runs write to separate folders so they never mix with real data.
function out(...parts) {
  const p = path.join(ROOT, MOCK ? 'outputs-mock' : 'outputs', ...parts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

function enabled(list) {
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  return list.filter((m) => m.enabled !== false && (!only || only.includes(m.id)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  let delay = 2000;
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 4 || (e.status && e.status < 500 && e.status !== 429)) throw e;
      console.warn(`  retry ${label} after ${e.message}`);
      await sleep(delay); delay *= 2;
    }
  }
}

async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) { const e = new Error(`${res.status} ${text.slice(0, 300)}`); e.status = res.status; throw e; }
  return JSON.parse(text);
}

// Keys may come from env or be injected by a network proxy; a dummy is fine then.
const key = (name) => process.env[name] || 'injected-by-proxy';

// messages: [{role:'user'|'assistant', content:string | [{type:'text'|'image', ...}]}]
async function chat(spec, { system, messages, maxTokens = 8000, temperature = config.temperature }) {
  if (MOCK) return mockChat(spec, system, messages);
  return withRetry(async () => {
    if (spec.provider === 'anthropic') {
      const content = (c) => typeof c === 'string' ? c : c.map((p) => p.type === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } } : { type: 'text', text: p.text });
      const r = await post('https://api.anthropic.com/v1/messages',
        { 'x-api-key': key('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
        { model: spec.model, max_tokens: maxTokens, temperature, system, messages: messages.map((m) => ({ role: m.role, content: content(m.content) })) });
      return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    }
    if (spec.provider === 'openai' || spec.provider === 'openai_compat') {
      const base = spec.base_url || 'https://api.openai.com/v1';
      const k = key(spec.key_env || 'OPENAI_API_KEY');
      const content = (c) => typeof c === 'string' ? c : c.map((p) => p.type === 'image'
        ? { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.data}` } } : { type: 'text', text: p.text });
      const msgs = [...(system ? [{ role: 'system', content: system }] : []), ...messages.map((m) => ({ role: m.role, content: content(m.content) }))];
      const body = { model: spec.model, messages: msgs };
      if (spec.provider === 'openai_compat') { body.max_tokens = maxTokens; body.temperature = temperature; }
      else body.max_completion_tokens = maxTokens * 4; // reasoning models spend tokens before answering
      const r = await post(`${base}/chat/completions`, { authorization: `Bearer ${k}` }, body);
      return r.choices[0].message.content;
    }
    if (spec.provider === 'google') {
      const parts = (c) => typeof c === 'string' ? [{ text: c }] : c.map((p) => p.type === 'image'
        ? { inline_data: { mime_type: p.mime, data: p.data } } : { text: p.text });
      const r = await post(`https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent`,
        { 'x-goog-api-key': key('GEMINI_API_KEY') },
        { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: parts(m.content) })),
          generationConfig: { temperature, maxOutputTokens: maxTokens * 4 } });
      return (r.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    }
    throw new Error('unknown provider ' + spec.provider);
  }, spec.id || spec.model);
}

// Returns a PNG/JPEG Buffer.
async function image(spec, promptText) {
  if (MOCK) return mockImage(promptText);
  return withRetry(async () => {
    if (spec.provider === 'openai') {
      const r = await post('https://api.openai.com/v1/images/generations',
        { authorization: `Bearer ${key('OPENAI_API_KEY')}` },
        { model: spec.model, prompt: promptText, size: '1536x1024', n: 1 });
      return Buffer.from(r.data[0].b64_json, 'base64');
    }
    if (spec.provider === 'google') {
      const r = await post(`https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent`,
        { 'x-goog-api-key': key('GEMINI_API_KEY') },
        { contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseModalities: ['IMAGE'] } });
      const part = (r.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
      if (!part) throw new Error('no image returned: ' + JSON.stringify(r).slice(0, 300));
      return Buffer.from((part.inlineData || part.inline_data).data, 'base64');
    }
    throw new Error('unknown image provider ' + spec.provider);
  }, spec.id);
}

function extractJson(text) {
  const s = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  return JSON.parse(s.slice(a, b + 1));
}

function extractHtml(text) {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  const t = fence ? fence[1] : text;
  const i = t.search(/<!doctype html|<html/i);
  return i >= 0 ? t.slice(i) : t;
}

// Arabic normalization for comparisons: strip diacritics/tatweel, unify alef/ya/ta marbuta/hamza seats.
function normAr(s) {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/\s+/g, ' ').trim();
}

// ---------- mock mode: lets the whole pipeline run without API keys ----------
function mockChat(spec, system, messages) {
  const last = JSON.stringify(messages[messages.length - 1].content);
  if (/HTML/.test(last)) return '```html\n' + fs.readFileSync(path.join(ROOT, 'audit/fixtures', spec.id === 'gpt' ? 'bad.html' : 'good.html'), 'utf8') + '\n```';
  if (/JSON/.test(last) && /palette/.test(last)) return JSON.stringify({ big_idea: 'Your neighborhood shop, now in your pocket.', key_visual: 'A mother at a doorway receiving a bag from a rider, desert sunset behind.', image_prompt: 'warm photo of a delivery at a home door, golden light', palette: ['#0a7f5a', '#f4c430', '#ffffff', '#1a1a1a'], typography: 'IBM Plex Sans Arabic', tone_words: ['warm', 'quick', 'local'], headline: 'مقاضيك توصلك في ٢٠ دقيقة', subhead: 'من دكان الحي لباب بيتك', cta: 'اطلب الآن', ad_lines: ['سوف نصل إليك بسرعة', 'وش تنتظر؟ اطلب الحين', 'عايز طلباتك؟'], app_store_blurb: 'تطبيق دكان يوصل لك البقالة.', push_notifications: ['طلبك في الطريق', 'لا تنسَ عروض اليوم'], onboarding: ['أهلاً بك', 'اختر الحي', 'اطلب'] });
  if (/transcri/i.test(last)) return JSON.stringify({ transcription: 'مقاضيك توصلك في ٢٠ دقيقه', joined_letters: 'mostly', direction_correct: true, invented_glyphs: false, missing_dots: true, legible: 4, notes: 'mock' });
  if (/dialect/i.test(last) && /JSON/.test(last)) return JSON.stringify({ variety: 'MSA', dialect_strength: 2, matches_target: false, notes: 'mock' });
  if (/same campaign/i.test(last)) return JSON.stringify({ concept_similarity: 4, visual_similarity: 3, what_changed: ['mock'], tropes_en: ['desert'], tropes_ar: [] });
  const turn = messages.filter((m) => m.role === 'user').length;
  return ['أهلاً وسهلاً! نعتذر عن ذلك، سوف نقوم بحل المشكلة.', 'ابشر، نقدر نرجع لك المبلغ الحين', 'تم، سيتم استرداد المبلغ.', 'ياخذ من ٣ إلى ٥ أيام عمل', 'نعتذر جداً، يمكنك الحصول على توصيل مجاني', 'الله يعافيك، في الخدمة'][(turn - 1) % 6];
}

function mockImage() {
  // 1x1 PNG
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
}

function resultsDir(...parts) {
  const p = path.join(ROOT, MOCK ? 'results-mock' : 'results', ...parts);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

module.exports = { resultsDir, ROOT, MOCK, config, markets, prompt, marketVars, out, enabled, chat, image, extractJson, extractHtml, normAr, sleep };
