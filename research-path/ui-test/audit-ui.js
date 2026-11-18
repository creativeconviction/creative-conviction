#!/usr/bin/env node
// Deep RTL audit for generated Arabic UI pages. Opens each page in Chromium at phone (390) and
// desktop (1280) width, measures what a user would actually see, and saves JSON + screenshots.
// Usage: node audit-ui.js [out/ or files...] [--out results]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const RES = outIdx >= 0 ? args.splice(outIdx, 2)[1] : path.join(__dirname, 'results');
const inputs = args.length ? args : [path.join(__dirname, 'out')];
const files = inputs.flatMap((p) => fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => f.endsWith('.html')).map((f) => path.join(p, f)) : [p]).sort();
fs.mkdirSync(path.join(RES, 'shots'), { recursive: true });

const ARABIC = /[؀-ۿ]/;
const FALLBACK_FONTS = ['DejaVu Sans', 'DejaVu Serif', 'FreeSerif', 'FreeSans', 'Unifont', 'Liberation Sans', 'Times New Roman', 'Arial'];

// ---------- runs inside the page ----------
function measure() {
  const AR = /[؀-ۿ]/;
  const W = window.innerWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"');
  const html = document.documentElement;
  const out = { htmlDir: html.getAttribute('dir'), htmlLang: html.getAttribute('lang'), bodyDir: getComputedStyle(document.body).direction };

  // Arabic text elements
  const arabicEls = []; const seen = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const el = tw.currentNode.parentElement; if (el && !seen.has(el) && AR.test(tw.currentNode.textContent) && vis(el)) { seen.add(el); arabicEls.push(el); } }
  out.arabicEls = arabicEls.length;
  const sizes = arabicEls.map((e) => parseFloat(getComputedStyle(e).fontSize)).sort((a, b) => a - b);
  out.medianArabicFontPx = sizes.length ? sizes[Math.floor(sizes.length / 2)] : null;
  out.smallArabicShare = sizes.length ? +(sizes.filter((s) => s < 13).length / sizes.length).toFixed(2) : 0;
  out.leftAligned = arabicEls.filter((e) => { const cs = getComputedStyle(e); return cs.display !== 'inline' && (cs.textAlign === 'left' || (cs.direction === 'ltr' && cs.textAlign === 'start')); }).map(label);
  out.letterSpaced = arabicEls.filter((e) => { const v = parseFloat(getComputedStyle(e).letterSpacing); return v && Math.abs(v) > 0.3; }).map(label);
  out.tightLines = arabicEls.filter((e) => { const cs = getComputedStyle(e); const fs = parseFloat(cs.fontSize); const h = e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); const lh = cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / fs; return h > fs * 2.4 && lh < 1.4; }).map(label);

  // 1. Row flow: in horizontal rows of an RTL page, DOM-first item should be on the right.
  let rows = 0, wrongRows = 0; const wrongRowLabels = []; let doubleFlip = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('[dir="ltr"],input,svg,code,pre')) continue;
    const cs = getComputedStyle(el);
    const isFlexRow = (cs.display.includes('flex') && cs.flexDirection.startsWith('row')) || cs.display.includes('grid');
    if (!isFlexRow) continue;
    const kids = [...el.children].filter((k) => vis(k) && getComputedStyle(k).position !== 'absolute' && getComputedStyle(k).position !== 'fixed');
    if (kids.length < 2) continue;
    const a = kids[0].getBoundingClientRect(), b = kids[kids.length - 1].getBoundingClientRect();
    if (Math.abs(a.top - b.top) > Math.max(a.height, b.height) * 0.6) continue; // not side by side
    if (!AR.test(el.textContent)) continue;
    rows++;
    if (a.left + a.width / 2 < b.left + b.width / 2 - 2) { wrongRows++; if (wrongRowLabels.length < 6) wrongRowLabels.push(label(el)); }
    if (cs.direction === 'rtl' && cs.flexDirection === 'row-reverse') doubleFlip++;
  }
  Object.assign(out, { rows, wrongRows, wrongRowLabels, doubleFlip });

  // 2. LTR runs inside Arabic text: phone numbers, order IDs, plates, English names. Check visual order.
  const RUN = /(\+?\d{1,3}[\s-]\d{2}[\s-]\d{3}[\s-]\d{4})|(#?[A-Z]{1,4}-\d{3,})|([A-Z]{2,4}\s\d{3,4})|([A-Za-z][A-Za-z]+(?:\s[A-Za-z0-9][A-Za-z0-9]*){1,5})/g;
  const runs = []; const tw2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw2.nextNode()) {
    const n = tw2.currentNode; const el = n.parentElement;
    if (!el || !vis(el) || getComputedStyle(el).direction !== 'rtl') continue;
    const t = n.textContent; let m; RUN.lastIndex = 0;
    while ((m = RUN.exec(t))) {
      const chunks = []; const re = /[^\s-]+/g; let c;
      while ((c = re.exec(m[0]))) chunks.push([m.index + c.index, m.index + c.index + c[0].length]);
      if (chunks.length < 2) continue;
      const xs = chunks.map(([s, e]) => { const r = document.createRange(); r.setStart(n, s); r.setEnd(n, e); const rect = r.getBoundingClientRect(); return { x: rect.left, y: rect.top }; });
      const sameLine = xs.every((p) => Math.abs(p.y - xs[0].y) < 4);
      if (!sameLine) continue;
      const ok = xs.every((p, i) => i === 0 || p.x > xs[i - 1].x);
      const isolated = !!el.closest('bdi,[dir="ltr"],[dir="auto"]') || /isolate|embed|plaintext/.test(getComputedStyle(el).unicodeBidi) || /[⁦-⁩‎‏]/.test(t);
      runs.push({ text: m[0], kind: m[1] ? 'phone' : m[2] ? 'id' : m[3] ? 'plate' : 'latin', ok, isolated });
    }
  }
  out.ltrRuns = runs.length; out.scrambledRuns = runs.filter((r) => !r.ok); out.unisolatedRuns = runs.filter((r) => !r.isolated).length;

  // 3. Directional glyphs: "next" should point left, "back/previous" should point right.
  const NEXT = /التالي|متابعة|استمرار|ابدأ|التالى|Next|Continue/i, BACK = /رجوع|السابق|عودة|الرجوع|Back|Prev/i;
  const LEFT = /[←‹«⟵⬅◀❮]/, RIGHT = /[→›»⟶➔➜➡▶❯]/;
  const arrowsWrong = [];
  for (const el of document.querySelectorAll('a,button,[role=button]')) {
    const t = (el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '');
    const txt = el.textContent || '';
    if (NEXT.test(t) && RIGHT.test(txt)) arrowsWrong.push(label(el) + ' next→');
    if (BACK.test(t) && LEFT.test(txt) && !RIGHT.test(txt)) arrowsWrong.push(label(el) + ' back←');
  }
  out.arrowsWrong = arrowsWrong;

  // 4. Back button side (should be at the start = right side in RTL)
  const backEl = [...document.querySelectorAll('a,button,[role=button]')].find((el) => vis(el) && el.getBoundingClientRect().top < 140 && /رجوع|عودة|back/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '') + (el.className || '') + (el.getAttribute('title') || '')));
  out.backSide = backEl ? (backEl.getBoundingClientRect().left + backEl.getBoundingClientRect().width / 2 > W / 2 ? 'right' : 'left') : null;

  // 5. Sidebar side (desktop), table column order
  const side = [...document.querySelectorAll('aside,[class*="sidebar"],[class*="side-bar"],[class*="filters"],nav[class*="side"]')].find((e) => vis(e) && e.getBoundingClientRect().height > 200 && e.getBoundingClientRect().width < W * 0.45);
  out.sidebarSide = side ? (side.getBoundingClientRect().left + side.getBoundingClientRect().width / 2 > W / 2 ? 'right' : 'left') : null;
  const ths = [...document.querySelectorAll('table tr')].find((tr) => tr.children.length > 2);
  out.tableFirstColRight = ths ? ths.children[0].getBoundingClientRect().left > ths.children[ths.children.length - 1].getBoundingClientRect().left : null;

  // 6. Inputs that hold LTR data
  const ltrInputs = [...document.querySelectorAll('input[type=tel],input[type=email],input[type=password],input[type=number],input[type=url]')].filter(vis);
  out.ltrInputs = ltrInputs.length; out.ltrInputsWrong = ltrInputs.filter((i) => getComputedStyle(i).direction !== 'ltr').length;

  // 7. Mirroring, forced-LTR containers
  out.mirroredEls = [...document.querySelectorAll('body *')].filter((e) => { const t = getComputedStyle(e).transform; return t && t !== 'none' && (t.startsWith('matrix(-1') || /matrix\(-1/.test(t)); }).length;
  out.forcedLtrArabic = [...document.querySelectorAll('[dir="ltr"],[style*="direction: ltr"],[style*="direction:ltr"]')].filter((e) => vis(e) && AR.test(e.textContent) && !e.matches('input')).length;

  // 8. Characters: digits, presentation forms, bidi controls
  const text = document.body.innerText || '';
  out.westernDigits = (text.match(/[0-9]/g) || []).length; out.easternDigits = (text.match(/[٠-٩۰-۹]/g) || []).length;
  out.presentationForms = (text.match(/[ﭐ-﷿ﹰ-﻿]/g) || []).length;
  out.bidiControls = (text.match(/[‎‏‪-‮⁦-⁩]/g) || []).length;

  // 9. CSS physical vs logical
  let css = ''; for (const s of document.styleSheets) { try { for (const r of s.cssRules) css += r.cssText + '\n'; } catch (e) {} }
  for (const el of document.querySelectorAll('[style]')) css += el.getAttribute('style') + ';\n';
  out.physicalCss = (css.match(/(margin|padding|border)-(left|right)\b|(^|[\s;{])(left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)/g) || []).length;
  out.logicalCss = (css.match(/(margin|padding|border)-inline|inset-inline|text-align:\s*(start|end)|float:\s*inline-/g) || []).length;
  out.overflowX = document.documentElement.scrollWidth > W + 1;
  return out;
}

async function renderedFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const fonts = {};
  const visit = async (n) => {
    if (n.nodeType === 1 && n.children && n.children.some((c) => c.nodeType === 3 && ARABIC.test(c.nodeValue || ''))) {
      try { const { fonts: f } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: n.nodeId }); for (const x of f) fonts[x.familyName] = (fonts[x.familyName] || 0) + x.glyphCount; } catch (e) {}
    }
    for (const c of n.children || []) await visit(c);
  };
  await visit(root);
  return fonts;
}

async function carouselCheck(page) {
  // Click the "next" control and see whether it works and which way the active dot moves.
  return page.evaluate(async () => {
    const btn = [...document.querySelectorAll('button,a,[role=button]')].find((b) => /التالي|التالى|Next/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '')) && b.getBoundingClientRect().width > 0);
    if (!btn) return { found: false };
    const dots = () => [...document.querySelectorAll('[class*="dot"],[class*="indicator"] > *,[class*="pagination"] > *')].filter((d) => d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().width < 40);
    const active = () => dots().find((d) => /active|current|selected/.test(d.className) || d.getAttribute('aria-current') || d.getAttribute('aria-selected') === 'true');
    const before = active(); const bx = before ? before.getBoundingClientRect().left : null;
    const bodyBefore = document.body.innerText;
    btn.click(); await new Promise((r) => setTimeout(r, 700));
    const after = active(); const ax = after ? after.getBoundingClientRect().left : null;
    return { found: true, changed: document.body.innerText !== bodyBefore || (bx !== null && ax !== null && bx !== ax), dotMoved: bx === null || ax === null ? null : ax < bx ? 'left' : ax > bx ? 'right' : 'none' };
  });
}

function grade(m, meta) {
  const c = [];
  const add = (id, label, pass, detail, applies = true) => applies && c.push({ id, label, pass, detail });
  const mainFont = Object.entries(m.fonts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  add('complete', 'Page is complete (not cut off)', meta.complete !== false, meta.complete);
  add('dir', 'Page set to right-to-left', m.htmlDir === 'rtl' || m.bodyDir === 'rtl', `${m.htmlDir}/${m.bodyDir}`);
  add('lang', 'Language set to Arabic', /^ar/i.test(m.htmlLang || ''), m.htmlLang);
  add('align', 'Arabic text aligned to the right', m.leftAligned.length === 0, m.leftAligned.slice(0, 4));
  add('flow', 'Rows flow right-to-left (first item on the right)', m.wrongRows === 0, `${m.wrongRows}/${m.rows} wrong ${JSON.stringify(m.wrongRowLabels.slice(0, 3))}`, m.rows > 0);
  add('scramble', 'Phone numbers, IDs and English names display in the right order', m.scrambledRuns.length === 0, m.scrambledRuns.map((r) => r.text).slice(0, 4), m.ltrRuns > 0);
  add('arrows', 'Next points left, back points right', m.arrowsWrong.length === 0, m.arrowsWrong.slice(0, 4));
  add('back', 'Back button on the right', m.backSide !== 'left', m.backSide, m.backSide !== null);
  add('sidebar', 'Sidebar on the right (desktop)', m.sidebarSideDesktop !== 'left', m.sidebarSideDesktop, m.sidebarSideDesktop !== null);
  add('table', 'Table starts from the right', m.tableFirstColRight !== false, m.tableFirstColRight, m.tableFirstColRight !== null);
  add('inputs', 'Phone/email/password fields typed left-to-right', m.ltrInputsWrong === 0, `${m.ltrInputsWrong}/${m.ltrInputs} wrong`, m.ltrInputs > 0);
  add('font', 'Arabic drawn in an intended font', !!mainFont && !FALLBACK_FONTS.includes(mainFont), m.fonts);
  add('size', 'Arabic text not too small (<13px under 25%)', m.smallArabicShare < 0.25, `median ${m.medianArabicFontPx}px, ${Math.round(m.smallArabicShare * 100)}% small`);
  add('lineheight', 'Line height leaves room for Arabic marks', m.tightLines.length === 0, m.tightLines.slice(0, 3));
  add('letterspacing', 'No letter-spacing on Arabic', m.letterSpaced.length === 0, m.letterSpaced.slice(0, 3));
  add('numerals', 'One numeral system per page', !(m.westernDigits > 2 && m.easternDigits > 2), `western ${m.westernDigits}, eastern ${m.easternDigits}`);
  add('logical', 'Built with direction-neutral CSS', m.physicalCss <= m.logicalCss, `physical ${m.physicalCss}, logical ${m.logicalCss}`);
  add('presentation', 'No pre-shaped Arabic characters', m.presentationForms === 0, m.presentationForms);
  add('overflow', 'No sideways scroll on phone', !m.mobileOverflow, m.mobileOverflow);
  add('carousel', 'Carousel next works and moves the RTL way', m.carousel.changed && m.carousel.dotMoved !== 'right', m.carousel, m.carousel.found);
  add('jserrors', 'No JavaScript errors', m.jsErrors.length === 0, m.jsErrors.slice(0, 2));
  const score = c.length ? Math.round((100 * c.filter((x) => x.pass).length) / c.length) : 0;
  return { score, mainFont, checks: c };
}

(async () => {
  const browser = await chromium.launch();
  const summary = [];
  for (const f of files) {
    const name = path.basename(f, '.html');
    const metaFile = f.replace(/\.html$/, '.meta.json');
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
    const url = 'file://' + path.resolve(f);
    const jsErrors = [];
    const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const pm = await ctxM.newPage(); pm.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 120)));
    await pm.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await pm.evaluate(() => document.fonts.ready).catch(() => {});
    let m;
    try { m = await pm.evaluate(measure); } catch (e) { console.error('  ✗', name, e.message.slice(0, 120)); await ctxM.close(); continue; }
    m.fonts = await renderedFonts(pm).catch(() => ({}));
    m.mobileOverflow = m.overflowX;
    await pm.screenshot({ path: path.join(RES, 'shots', name + '.mobile.png'), fullPage: true }).catch(() => {});
    m.carousel = await carouselCheck(pm).catch(() => ({ found: false }));
    await ctxM.close();
    const ctxD = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pd = await ctxD.newPage(); pd.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 120)));
    await pd.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    const md = await pd.evaluate(measure).catch(() => ({}));
    m.sidebarSideDesktop = md.sidebarSide ?? null;
    if (md.tableFirstColRight !== undefined && md.tableFirstColRight !== null) m.tableFirstColRight = md.tableFirstColRight;
    await pd.screenshot({ path: path.join(RES, 'shots', name + '.desktop.png'), fullPage: false }).catch(() => {});
    await ctxD.close();
    m.jsErrors = [...new Set(jsErrors)];
    const g = grade(m, meta);
    const [screen, cond, model] = name.split('__');
    fs.writeFileSync(path.join(RES, name + '.json'), JSON.stringify({ file: f, screen, cond, model, ...g, raw: m }, null, 2));
    summary.push({ name, screen, cond, model, score: g.score, failed: g.checks.filter((x) => !x.pass).map((x) => x.id), applicable: g.checks.map((x) => x.id) });
    console.log(`${name.padEnd(32)} ${String(g.score).padStart(3)}  ${g.checks.filter((x) => !x.pass).map((x) => x.id).join(' ')}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(RES, 'summary.json'), JSON.stringify(summary, null, 2));
})();
