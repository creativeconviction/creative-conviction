# Arabic Launch Test

**Question:** When AI builds a product for an Arab market, does it actually design *for* that market — or does it design in English and translate the surface? ("Arabic as a skin.")

Each model gets the same brief: launch **Qareeb**, a neighborhood grocery-delivery app, in **Riyadh**, **Cairo** and **Casablanca**. The brief is given once in English and once in Arabic. Every model produces the full launch, and each layer is scored:

| Layer | What the model makes | How it's scored | Script |
|---|---|---|---|
| Software design | Landing page (HTML) | Automated RTL audit in a real browser: direction, alignment, rendered font, mirroring, inputs, numerals, mobile overflow + screenshots | `audit/rtl-audit.js` |
| Rendering | Billboards with fixed Arabic headlines; each campaign's own hero image | Vision model reads the text back → exact match, character similarity, joined letters, direction, invented glyphs | `scripts/images.js`, `scripts/score-images.js` |
| Copy & voice | Headline, ads, app-store text, push notifications, onboarding | Dialect markers (transparent word lists) + LLM judge + blinded native-speaker ratings | `scripts/score-dialect.js`, `scripts/rating-sheets.js` |
| Persona | 6-turn WhatsApp support chat with a scripted customer writing in local dialect | Dialect score **per turn** → drift curve; bleed from other dialects | `scripts/score-dialect.js` |
| Concept | Big idea, key visual, palette, type, tone | EN-brief vs AR-brief campaign compared by a judge; visual-trope tally (desert, camel, lantern…) | `scripts/score-concepts.js` |

The persona prompt names the **city only**, never the dialect — the test is whether the model infers how people there talk.

## Running it

```bash
./run-all.sh --mock      # test the whole pipeline with fake model outputs (no keys needed)
node scripts/list-models.js   # check current model IDs, then edit config.json
./run-all.sh             # real run → results/report.md
```

Re-running is safe: anything already generated is skipped. Limit models with `ONLY=claude,gpt`.

Everything runs through **fal.ai** with one key (`FAL_KEY`): text models via fal's OpenRouter router, image models via fal endpoints. Model lineup and IDs live in `config.json`. See `ITEMS.md` for the full inventory of study items and what people need to supply.

**Judging:** no model grades its own lab's work. Dialect and concept judgments use every judge from a *different* lab; image text is read back by Claude (Anthropic has no image model in the test). People have the final word via blind voting.

## Before the real run (≈1 h)

1. **Native check of `markets.json`** — the scripted customer messages, billboard headlines and dialect marker lists are drafts. One native speaker per dialect should fix anything unnatural.
2. Update model IDs in `config.json`.

## Scale & cost

5 text models × 3 cities × 2 brief languages = 30 cells → 30 landing pages, 30 campaigns, 30 chats (180 replies). 7 image models × 12 billboards (84 images) + 30 campaign images × 3 image models (90). About $35 total. Raise `render_samples` / `samples_per_cell` to 2 for sturdier numbers; re-runs only generate what's missing.

## Time plan (≈11 h)

| Hours | Step |
|---|---|
| 1 | Native check of drafts, model IDs, spot-test one cell |
| 1–2 | `./run-all.sh` (mostly waiting) |
| 2 | Native raters fill `results/ratings/sheet-*.csv` (≈45 min each, in parallel) → save as `rated-*.csv` |
| 1 | Human spot-check ~20% of image read-backs and RTL screenshots; note judge errors |
| 2 | Read `results/report.md`, pick 6–8 visuals (screenshots, image grid, drift chart) |
| 2–3 | Write |

**If short on time:** drop Casablanca, then the campaign images (`--concepts`).

## Limits to state in the write-up

- One brief, one product category, 1–2 samples per cell: findings are directional, not benchmark-grade.
- Marker-based dialect scores undercount (a reply can be dialectal without any listed word); treat them alongside the judge and human ratings.
- The vision judge that reads image text can itself misread Arabic — that's why the 20% human spot-check matters.
- Every generated item's model ID and timestamp is logged in `outputs/runs.jsonl`.
