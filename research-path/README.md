# Research path: where AI breaks for Arab users

**Question:** Where does AI break when we design and write products for Arab users, why does it break, and what should designers and writers do differently?

## Files

| File | What it is |
|---|---|
| `research-log.xlsx` | The workbook you work in: **Log**, **Phase 1 prompts**, **Image prompts**, **Image tags**, auto **Summary**, **Causes** |
| `data.py` | Source of every prompt and tag. Edit here, then `python3 export_prompts.py && python3 build_workbook.py` (rebuilding overwrites the workbook, so copy your log out first) |
| `images/run-images.js` | Runs the imagery tests on 7 image models via fal.ai |
| `images/contact-sheets.py` | One comparison grid per prompt (rows = city / prompt language, columns = model) |

## The path

| Phase | Time | What you do |
|---|---|---|
| 0. Set up | 30 min | Read "Start here" in the workbook |
| 1. Build it with AI | 3 h | Run the 22 prompts in **Phase 1 prompts** in ChatGPT, Claude and Gemini, per city; log every break |
| 1b. Imagery | 1–2 h | Generate the image tests (below), tag each image in **Image tags**, log notable breaks |
| 2. Compare with real products | 2 h | Screenshot 4–6 real regional apps per country at the same stages; read 20–30 real Arabic reviews |
| 3. Ask natives | 2 h | 3–5 short blind conversations: AI vs real; what feels off and why |
| Decision point | 30 min | Pick the 3–4 strongest breaks |
| 4. Test them properly | 2 h | Repeat 5–10×, across tools, cities, Arabic vs English; try to fix with better prompts |
| 5. Make sense of it | 1.5 h | Group breaks by cause (the **Summary** tab helps); write guidelines |
| 6. Write it up | 2 h | Example → method → findings → why → what to do → bigger point |

## Imagery tests

20 prompts in 5 groups:
- **Text in images:** brand word, headline, mixed Arabic/Latin/digits, vowel marks, app screen.
- **Defaults:** shopping, family dinner, professional woman, street, "an Arab family", teenager. Run for Riyadh, Cairo, Casablanca, with London as a control, and in Arabic as well as English.
- **Ad imagery:** delivery at the door, breakfast spread (checks for pork or alcohol), Ramadan campaign, savings illustration.
- **Roles:** delivery rider, startup CEO, woman driving.
- **Design artifacts:** app icon, Instagram post.

```bash
cd images
node run-images.js --dry-run        # what would run, ~cost (292 images ≈ $38)
node run-images.js --only T,D       # a subset first
node run-images.js                  # everything; re-running skips existing images
```

Needs `FAL_KEY` with balance. Or paste the prompts from the **Image prompts** tab into ChatGPT, Gemini or any image tool by hand, and save files as `images/out/<Image ID>.jpg` so they match the **Image tags** rows.

Earlier billboard results (73 images, 7 models, 3 cities) are in `../arabic-launch-test/outputs/images/render/`.
