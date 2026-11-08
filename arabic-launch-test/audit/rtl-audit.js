#!/usr/bin/env node
// RTL audit: opens an HTML page in headless Chromium and grades how well it
// handles Arabic / right-to-left layout. Writes JSON + screenshots per page.
//
// Usage: node audit/rtl-audit.js <file-or-dir> [more...] [--out results/rtl]

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const FALLBACK_FONTS = ['DejaVu Sans', 'DejaVu Serif', 'FreeSerif', 'FreeSans', 'Unifont', 'Times New Roman', 'Arial'];

function argList() {
  const args = process.argv.slice(2);
  let out = 'results/rtl';
  const inputs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i];
    else inputs.push(args[i]);
  }
  const files = [];
  for (const p of inputs) {
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p, { recursive: true })) {
        if (String(f).endsWith('.html')) files.push(path.join(p, String(f)));
      }
    } else files.push(p);
  }
  return { files: files.sort(), out };
}

// Runs inside the page. Returns raw measurements; grading happens in Node.
function measure() {
  const AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  const LATIN_OR_DIGIT = /[A-Za-z0-9]/;
  const html = document.documentElement;
  const vw = window.innerWidth;

  // Elements whose own text (not children's) contains Arabic.
  const arabicEls = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (!AR.test(t.textContent)) continue;
    const el = t.parentElement;
    if (!el || seen.has(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    seen.add(el);
    arabicEls.push(el);
  }

  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    return s + ' "' + el.textContent.trim().slice(0, 30) + '"';
  };

  const leftAligned = [], letterSpaced = [], italic = [], tightLines = [];
  let westernDigits = 0, easternDigits = 0, mixedUnisolated = 0;
  for (const el of arabicEls) {
    const cs = getComputedStyle(el);
    const block = cs.display !== 'inline';
    const contentH = el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const multiline = contentH > parseFloat(cs.fontSize) * 2.2;
    if (block && cs.textAlign === 'left') leftAligned.push(label(el));
    else if (cs.direction !== 'rtl' && block) leftAligned.push(label(el) + ' [direction:ltr]');
    if (cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) !== 0) letterSpaced.push(label(el) + ' ' + cs.letterSpacing);
    if (cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique')) italic.push(label(el));
    if (multiline) {
      const lh = cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
      if (lh < 1.4) tightLines.push(label(el) + ' lh=' + lh.toFixed(2));
    }
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
    westernDigits += (own.match(/[0-9]/g) || []).length;
    easternDigits += (own.match(/[٠-٩۰-۹]/g) || []).length;
    if (AR.test(own) && LATIN_OR_DIGIT.test(own) && !el.closest('bdi,[dir="auto"],[dir="ltr"]')) mixedUnisolated++;
  }

  // Directional glyphs in interactive elements: in RTL, "forward" points left.
  const wrongArrows = [];
  for (const el of document.querySelectorAll('a,button,[role=button]')) {
    const t = el.textContent;
    if (/[→›»⟶➔➜]/.test(t) && AR.test(t)) wrongArrows.push(label(el));
  }
  // SVG/icon elements named like arrows/chevrons that are not mirrored.
  const unmirroredIcons = [];
  for (const el of document.querySelectorAll('[class*="arrow"],[class*="chevron"],[class*="next"],[data-icon*="arrow"]')) {
    const tf = getComputedStyle(el).transform;
    const mirrored = tf && tf !== 'none' && tf.startsWith('matrix(-1');
    if (!mirrored) unmirroredIcons.push(label(el));
  }

  // Layout mirroring: logo/brand should sit on the right in an RTL header.
  const header = document.querySelector('header, nav, [class*="header"], [class*="navbar"]');
  let logoSide = null;
  if (header) {
    const logo = header.querySelector('[class*="logo"],[id*="logo"],[class*="brand"],img,svg') || header.firstElementChild;
    if (logo) {
      const r = logo.getBoundingClientRect();
      logoSide = r.left + r.width / 2 > vw / 2 ? 'right' : 'left';
    }
  }

  // Inputs that hold LTR data (phone, email, url) should be dir=ltr.
  const ltrInputs = [...document.querySelectorAll('input[type=tel],input[type=email],input[type=url]')];
  const ltrInputsWrong = ltrInputs.filter((i) => getComputedStyle(i).direction !== 'ltr').map(label);

  // CSS physical vs logical property usage (inline + same-origin sheets + <style>).
  let cssText = '';
  for (const s of document.styleSheets) {
    try { for (const r of s.cssRules) cssText += r.cssText + '\n'; } catch (e) { /* cross-origin */ }
  }
  for (const el of document.querySelectorAll('[style]')) cssText += el.getAttribute('style') + ';\n';
  const physical = (cssText.match(/(margin|padding|border)-(left|right)\b|(^|[\s;{])(left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)/g) || []).length;
  const logical = (cssText.match(/(margin|padding|border)-inline|inset-inline|text-align:\s*(start|end)|float:\s*inline-/g) || []).length;

  return {
    htmlDir: html.getAttribute('dir'),
    htmlLang: html.getAttribute('lang'),
    bodyDirection: getComputedStyle(document.body).direction,
    arabicElementCount: arabicEls.length,
    leftAligned, letterSpaced, italic, tightLines,
    westernDigits, easternDigits, mixedUnisolated,
    wrongArrows, unmirroredIcons, logoSide,
    ltrInputsTotal: ltrInputs.length, ltrInputsWrong,
    physicalCss: physical, logicalCss: logical,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
  };
}

async function renderedFonts(page) {
  // Ask Chromium which font files actually drew the Arabic glyphs.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const fonts = {};
  const visit = async (node) => {
    if (node.nodeType === 1 && node.children) {
      const hasArabicText = node.children.some((c) => c.nodeType === 3 && ARABIC.test(c.nodeValue || ''));
      if (hasArabicText) {
        try {
          const { fonts: f } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId });
          for (const x of f) fonts[x.familyName] = (fonts[x.familyName] || 0) + x.glyphCount;
        } catch (e) { /* node gone */ }
      }
    }
    for (const c of node.children || []) await visit(c);
  };
  await visit(root);
  return fonts;
}

function grade(m, fonts) {
  const checks = [];
  const add = (id, label, pass, detail, weight = 1) => checks.push({ id, label, pass, detail, weight });
  const top = Object.entries(fonts).sort((a, b) => b[1] - a[1]);
  const mainFont = top[0] ? top[0][0] : null;

  add('dir', 'Page declares RTL (<html dir="rtl"> or body direction rtl)', m.htmlDir === 'rtl' || m.bodyDirection === 'rtl', `html dir=${m.htmlDir}, body=${m.bodyDirection}`, 2);
  add('lang', 'Page declares Arabic language (lang="ar…")', /^ar/i.test(m.htmlLang || ''), `lang=${m.htmlLang}`);
  add('align', 'Arabic text is right/start aligned', m.leftAligned.length === 0, m.leftAligned.slice(0, 5), 2);
  add('font', 'Arabic glyphs render in an intended font, not a system fallback', !!mainFont && !FALLBACK_FONTS.includes(mainFont), fonts, 2);
  add('letterspacing', 'No letter-spacing on Arabic (can break letter joins; engine-dependent)', m.letterSpaced.length === 0, m.letterSpaced.slice(0, 5), 1);
  add('italic', 'No fake italic on Arabic', m.italic.length === 0, m.italic.slice(0, 5));
  add('lineheight', 'Arabic paragraphs have line-height ≥ 1.4 (room for marks)', m.tightLines.length === 0, m.tightLines.slice(0, 5));
  add('arrows', 'Arrow glyphs in CTAs point the RTL way', m.wrongArrows.length === 0, m.wrongArrows.slice(0, 5));
  add('icons', 'Arrow/chevron icons are mirrored', m.unmirroredIcons.length === 0, m.unmirroredIcons.slice(0, 5));
  add('logo', 'Header is mirrored (logo/brand on the right)', m.logoSide === null || m.logoSide === 'right', `logo side=${m.logoSide}`, 2);
  add('inputs', 'Phone/email/URL inputs are LTR', m.ltrInputsWrong.length === 0, `${m.ltrInputsWrong.length}/${m.ltrInputsTotal} wrong`);
  add('logicalcss', 'CSS uses logical properties more than physical left/right', m.physicalCss <= m.logicalCss, `physical=${m.physicalCss}, logical=${m.logicalCss}`);
  add('numerals', 'Numerals are consistent (not mixing ٠١٢ and 012)', !(m.westernDigits > 0 && m.easternDigits > 0), `western=${m.westernDigits}, eastern=${m.easternDigits}`);
  add('overflowMobile', 'No horizontal scroll at phone width (390px)', !m.mobileOverflowX, `scrollWidth=${m.mobileScrollWidth}`, 2);

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  return { score: Math.round((got / total) * 100), checks, mainFont };
}

async function auditFile(browser, file, outDir) {
  const name = path.relative(process.cwd(), file).replace(/[\\/]/g, '__').replace(/\.html$/, '');
  const url = 'file://' + path.resolve(file);

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await desktop.evaluate(() => document.fonts.ready);
  const m = await desktop.evaluate(measure);
  const fonts = await renderedFonts(desktop);
  await desktop.screenshot({ path: path.join(outDir, name + '.desktop.png'), fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mobile.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await mobile.evaluate(() => document.fonts.ready);
  const mm = await mobile.evaluate(measure);
  await mobile.screenshot({ path: path.join(outDir, name + '.mobile.png'), fullPage: true });
  await mobile.close();

  m.mobileOverflowX = mm.overflowX;
  m.mobileScrollWidth = mm.scrollWidth;
  const g = grade(m, fonts);
  const result = { file, ...g, raw: m };
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(result, null, 2));
  return result;
}

(async () => {
  const { files, out } = argList();
  if (!files.length) {
    console.error('Usage: node audit/rtl-audit.js <file-or-dir> [--out results/rtl]');
    process.exit(1);
  }
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const summary = [];
  for (const f of files) {
    const r = await auditFile(browser, f, out);
    summary.push({ file: f, score: r.score, font: r.mainFont, failed: r.checks.filter((c) => !c.pass).map((c) => c.id) });
    console.log(`\n${f}  →  ${r.score}/100  (font: ${r.mainFont})`);
    for (const c of r.checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.label}${c.pass ? '' : '  — ' + JSON.stringify(c.detail)}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
})();
