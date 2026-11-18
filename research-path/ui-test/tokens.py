#!/usr/bin/env python3
"""Tokenization analysis for the Arabic UI test.

1. Token tax: the same screen in English (reference/) vs Arabic (out/*__localize__*), counted with
   six real tokenizers. Whole page and visible text only.
2. Fragmentation: tokens per word for Arabic UI words vs English UI words.
3. Word check: Arabic UI words that no morphological analyzer (MSA, Gulf, Egyptian, Levantine)
   recognizes: candidate misspellings or invented words, for a native speaker to review.
   Compared against how many tokens each word is split into.
4. Cut-off pages: share of generated pages that end before </html>, by condition and model.

Run with the CAMeL environment (tiktoken, tokenizers, beautifulsoup4, camel-tools installed):
  camelenv/bin/python tokens.py
"""
import json, re, statistics, collections, pathlib, warnings
warnings.filterwarnings("ignore")
import tiktoken
from tokenizers import Tokenizer
from bs4 import BeautifulSoup
from camel_tools.morphology.database import MorphologyDB
from camel_tools.morphology.analyzer import Analyzer

here = pathlib.Path(__file__).parent
res = here / "results"; res.mkdir(exist_ok=True)

TOK = {"GPT (o200k)": tiktoken.get_encoding("o200k_base")}
for name, rid in [("DeepSeek V3", "deepseek-ai/DeepSeek-V3"), ("Qwen 2.5", "Qwen/Qwen2.5-7B-Instruct"),
                  ("Mistral Small", "mistralai/Mistral-Small-24B-Instruct-2501"), ("Jais (Arabic-first)", "inceptionai/jais-family-13b-chat"),
                  ("Fanar (Arabic-first)", "QCRI/Fanar-1-9B-Instruct")]:
    try: TOK[name] = Tokenizer.from_pretrained(rid)
    except Exception as e: print("skip", name, e)
def ntok(name, text):
    t = TOK[name]
    return len(t.encode(text)) if name.startswith("GPT") else len(t.encode(text, add_special_tokens=False).ids)

AR_WORD = re.compile(r"[ء-ي٠-٩ٱ-ۓ]+")
EN_WORD = re.compile(r"\b[A-Za-z]{2,}\b")
def visible(html):
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style"]): t.decompose()
    return " ".join(soup.get_text(" ").split())

out = {}
# 1. token tax: reference (English) vs localized (Arabic), same screen, same structure
pairs = []
for ref in sorted((here / "reference").glob("S*.html")):
    en_html = ref.read_text(encoding="utf-8"); en_vis = visible(en_html)
    for loc in sorted((here / "out").glob(f"{ref.stem}__localize__*.html")):
        ar_html = loc.read_text(encoding="utf-8"); ar_vis = visible(ar_html)
        if len(AR_WORD.findall(ar_vis)) < 10: continue
        row = {"screen": ref.stem, "model": loc.stem.split("__")[2]}
        for name in TOK:
            row[name] = {"page_en": ntok(name, en_html), "page_ar": ntok(name, ar_html), "text_en": ntok(name, en_vis), "text_ar": ntok(name, ar_vis)}
        pairs.append(row)
tax = {}
for name in TOK:
    tr = [p[name]["text_ar"] / p[name]["text_en"] for p in pairs if p[name]["text_en"]]
    pr = [p[name]["page_ar"] / p[name]["page_en"] for p in pairs if p[name]["page_en"]]
    tax[name] = {"visible_text_ratio": round(statistics.median(tr), 2) if tr else None, "whole_page_ratio": round(statistics.median(pr), 2) if pr else None, "pairs": len(tr)}
out["token_tax"] = tax

# 2 + 3. fragmentation and word check over every Arabic page
analyzers = {n: Analyzer(MorphologyDB.builtin_db(n)) for n in ["calima-msa-r13", "calima-glf-01", "calima-egy-r13", "calima-lev-01"]}
def known(w):
    return any(a.analyze(w) for a in analyzers.values())
ar_words = collections.Counter(); en_words = collections.Counter(); where = collections.defaultdict(set)
for f in sorted((here / "out").glob("*.html")):
    v = visible(f.read_text(encoding="utf-8"))
    for w in AR_WORD.findall(v):
        if len(w) > 1 and not re.match(r"^[٠-٩]+$", w): ar_words[w] += 1; where[w].add(f.stem)
for f in sorted((here / "reference").glob("*.html")):
    for w in EN_WORD.findall(visible(f.read_text(encoding="utf-8"))): en_words[w.lower()] += 1
frag = {}
for name in TOK:
    ar_t = [ntok(name, w) for w in ar_words]; en_t = [ntok(name, " " + w) for w in en_words]
    frag[name] = {"arabic_tokens_per_word": round(statistics.mean(ar_t), 2), "english_tokens_per_word": round(statistics.mean(en_t), 2),
                  "arabic_words_split_3plus": round(sum(t >= 3 for t in ar_t) / len(ar_t), 2)}
out["fragmentation"] = frag
unknown = [w for w in ar_words if w != "قريب" and not known(w)]
gpt = "GPT (o200k)"
kt = [ntok(gpt, w) for w in ar_words if w not in unknown]; ut = [ntok(gpt, w) for w in unknown]
out["word_check"] = {
    "distinct_arabic_words": len(ar_words), "unrecognized": len(unknown), "unrecognized_share": round(len(unknown) / max(1, len(ar_words)), 3),
    "gpt_tokens_per_word_recognized": round(statistics.mean(kt), 2) if kt else None, "gpt_tokens_per_word_unrecognized": round(statistics.mean(ut), 2) if ut else None,
    "examples": [{"word": w, "count": ar_words[w], "pages": sorted(where[w])[:3]} for w in sorted(unknown, key=lambda w: -ar_words[w])[:60]],
}

# 4. cut-off pages
cut = collections.defaultdict(lambda: [0, 0])
for m in (here / "out").glob("*.meta.json"):
    j = json.loads(m.read_text(encoding="utf-8"))
    for key in (f"cond:{j['cond']}", f"model:{j['model']}"):
        cut[key][1] += 1; cut[key][0] += (not j.get("complete", True))
out["cut_off"] = {k: f"{a}/{b}" for k, (a, b) in sorted(cut.items())}

json.dump(out, open(res / "tokens.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "word_check"}, ensure_ascii=False, indent=1))
print("word check:", {k: v for k, v in out["word_check"].items() if k != "examples"})
print("unrecognized examples:", ", ".join(e["word"] for e in out["word_check"]["examples"][:30]))
