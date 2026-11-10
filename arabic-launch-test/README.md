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

Keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` (or injected by the environment's network proxy). Optional Arabic-first model: enable `fanar` in `config.json` (any OpenAI-compatible API works the same way).

## Before the real run (≈1 h)

1. **Native check of `markets.json`** — the scripted customer messages, billboard headlines and dialect marker lists are drafts. One native speaker per dialect should fix anything unnatural.
2. Update model IDs in `config.json`.

## Scale & cost (default config)

3 models × 3 markets × 2 brief languages = 18 cells → 18 landing pages, 18 campaigns, 18 chats (108 replies), 24 billboard + 18 campaign images per image model. Roughly $15–40 in API costs depending on models; set `samples_per_cell: 2` for more robust numbers at double the cost.

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
