#!/usr/bin/env python3
"""Scores every output in out/ with the CAMeL Lab dialect identifier (DID-26: 25 city dialects + MSA)
and simple breakage checks, then writes results/rows.csv and results/summary.md.

Run with the CAMeL Tools environment:
  python -m venv camelenv && camelenv/bin/pip install camel-tools && camelenv/bin/camel_data -i dialectid-model26
  camelenv/bin/python analyze.py
"""
import csv, json, re, warnings, collections, pathlib
warnings.filterwarnings("ignore")
from camel_tools.dialectid import DIDModel26

here = pathlib.Path(__file__).parent
P = json.load(open(here / "prompts.json", encoding="utf-8"))
REGION = {c: r for r, cs in P["detector_regions"].items() for c in cs}
did = DIDModel26.pretrained()

AR = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿ]+")
FOREIGN = re.compile(r"[Ѐ-ӿ԰-֏Ͱ-Ͽऀ-ॿ぀-ヿ㐀-鿿가-힯฀-๿]")
LATIN_WORD = re.compile(r"\b[A-Za-z]{2,}\b")
PLACES = {  # Arabic place names a model might drop in unprompted
    "Saudi": ["السعودية", "الرياض", "جدة", "المملكة"], "Gulf other": ["الإمارات", "دبي", "قطر", "الدوحة", "الكويت", "عمان", "مسقط", "البحرين"],
    "Egypt": ["مصر", "القاهرة", "اسكندرية", "الإسكندرية"], "Levant": ["لبنان", "بيروت", "الشام", "سوريا", "دمشق", "الأردن", "عمّان", "فلسطين"],
    "Iraq": ["العراق", "بغداد"], "Maghreb": ["المغرب", "الدار البيضاء", "كازا", "الرباط", "تونس", "الجزائر", "ليبيا"], "Sudan": ["السودان", "الخرطوم"],
}
HEADINGS = {"qareeb", "instagram", "tagline", "ad", "ads", "lines", "line", "push", "notification", "notifications", "slogan", "copy"}
BRAND = re.compile(r"«?قريب»?")


def detect(text):
    ar = " ".join(AR.findall(BRAND.sub(" ", text)))
    if len(ar.split()) < 3:
        return None, None, 0.0, None
    p = did.predict([ar])[0]
    ranked = sorted(p.scores.items(), key=lambda x: -x[1])
    # strongest non-MSA region, to tell "formal with a dialect lean" from pure MSA
    reg_scores = collections.Counter()
    for c, s in p.scores.items():
        reg_scores[REGION[c]] += s
    dialect_regions = [(r, s) for r, s in reg_scores.most_common() if r != "MSA"]
    best_region, best_score = reg_scores.most_common(1)[0]  # region with the highest summed score
    return p.top, best_region, round(best_score, 3), dialect_regions[0][0] if dialect_regions else None


rows = []
for f in sorted((here / "out").glob("*.json")):
    j = json.load(open(f, encoding="utf-8"))
    out = j["output"]
    city, region, conf, lean = detect(out)
    places = sorted({k for k, names in PLACES.items() for n in names if n in out})
    rows.append({
        "id": j["id"], "part": j["part"], "model": j["model"], "prompt_lang": j["prompt_lang"],
        "city": j.get("city", ""), "target_region": j.get("target_region") or P["prompt_dialect_region"].get(j["prompt_lang"]) or "",
        "prompt_region": P["prompt_dialect_region"].get(j["prompt_lang"]) or "",
        "detected_city": city or "", "detected_region": region or "", "confidence": conf, "dialect_lean": lean or "",
        "foreign_script_chars": len(FOREIGN.findall(out)), "latin_words": len([w for w in LATIN_WORD.findall(out) if w.lower() not in HEADINGS]),
        "eastern_digits": len(re.findall(r"[٠-٩]", out)), "western_digits": len(re.findall(r"[0-9]", out)),
        "places_named": "|".join(places), "chars": len(out), "output": out,
    })

res = here / "results"
res.mkdir(exist_ok=True)
with open(res / "rows.csv", "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
json.dump(rows, open(res / "rows.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---------------- summary ----------------
pct = lambda a, b: f"{round(100 * a / b)}%" if b else "–"
models = sorted({r["model"] for r in rows})
md = ["# Marketing copy: dialect experiment\n", f"{len(rows)} outputs. Dialect by CAMeL Lab DID-26, scored at region level.\n"]

A = [r for r in rows if r["part"] == "A"]
if A:
    md.append("\n## A. Mirror test: prompt in a dialect, no location\n\nShare of outputs whose detected region matches the prompt's dialect. For English, the detected region distribution.\n")
    md.append("| prompt | " + " | ".join(models) + " | all |\n|" + "---|" * (len(models) + 2))
    for l in P["task"]:
        cells = []
        for m in models + ["all"]:
            g = [r for r in A if r["prompt_lang"] == l and (m == "all" or r["model"] == m)]
            if l == "en":
                c = collections.Counter(r["detected_region"] for r in g)
                cells.append(", ".join(f"{k} {v}" for k, v in c.most_common(3)))
            else:
                cells.append(pct(sum(r["detected_region"] == r["prompt_region"] for r in g), len(g)))
        md.append(f"| {l} | " + " | ".join(cells) + " |")

B = [r for r in rows if r["part"] == "B"]
if B:
    md.append("\n\n## B. Prompt dialect vs launch city (no dialect named)\n\nEach cell: % following the city / % following the prompt's dialect / % MSA.\n")
    cities = list(P["launch_cities"])
    md.append("| prompt \\ city | " + " | ".join(cities) + " |\n|" + "---|" * (len(cities) + 1))
    for l in P["task"]:
        cells = []
        for c in cities:
            g = [r for r in B if r["prompt_lang"] == l and r["city"] == c]
            fc = sum(r["detected_region"] == r["target_region"] for r in g)
            fp = sum(bool(r["prompt_region"]) and r["detected_region"] == r["prompt_region"] and r["prompt_region"] != r["target_region"] for r in g)
            ms = sum(r["detected_region"] == "MSA" for r in g)
            cells.append(f"{pct(fc, len(g))} / {pct(fp, len(g))} / {pct(ms, len(g))}")
        md.append(f"| {l} | " + " | ".join(cells) + " |")

C = [r for r in rows if r["part"] == "C"]
if C:
    md.append("\n\n## C. Explicit dialect request: region match by city and model\n")
    md.append("| city (dialect) | " + " | ".join(models) + " | all | most common miss |\n|" + "---|" * (len(models) + 3))
    for c, t in P["dialect_targets"].items():
        if c.startswith("_"): continue
        g = [r for r in C if r["city"] == c]
        cells = [pct(sum(r["detected_region"] == t["region"] for r in g if r["model"] == m), len([r for r in g if r["model"] == m])) for m in models]
        miss = collections.Counter(r["detected_region"] for r in g if r["detected_region"] != t["region"]).most_common(1)
        md.append(f"| {c} ({t['region']}) | " + " | ".join(cells) + f" | {pct(sum(r['detected_region'] == t['region'] for r in g), len(g))} | {miss[0][0] + ' ' + str(miss[0][1]) if miss else ''} |")

md.append("\n\n## Breakage signals (all parts)\n\n| model | outputs | with foreign-script characters | with English words | named a place unprompted (part A) |\n|---|---|---|---|---|")
for m in models:
    g = [r for r in rows if r["model"] == m]
    ga = [r for r in A if r["model"] == m]
    md.append(f"| {m} | {len(g)} | {pct(sum(r['foreign_script_chars'] > 0 for r in g), len(g))} | {pct(sum(r['latin_words'] > 0 for r in g), len(g))} | {pct(sum(bool(r['places_named']) for r in ga), len(ga))} |")

(res / "summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")
print("\n".join(md))
