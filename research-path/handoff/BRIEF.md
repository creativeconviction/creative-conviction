# Writing brief: how AI models handle Arabic, and where they break

You are writing an article from a finished research study. This file has everything you need: the question, the method, every finding with its exact number, what was checked by a native speaker, what you must not claim, and an index of the raw data and generations in this folder.

A draft already exists (`reference_article_draft.md`). Use it as a reference for facts and the thesis, not as the shape you have to keep. Where this brief and the draft disagree, this brief wins.

---

## 1. The question and why it matters

**Question:** Where do today's AI models break when used for Arabic and Arab markets? Why do they break, and what does that mean for the people who design products, write software and do marketing for Arab users?

**Audience:** product designers, software teams, marketers, brand people and founders. Some build for the Arab world; many don't. The article should draw a lesson that applies to any language or market, not only Arabic.

**Point of view:** a startup team that uses AI at every step of a launch: research, copy, visuals, interface code, customer support and campaigns.

**One-line thesis (from the study):** AI is not bad at Arabic. It is bad at making Arabic decisions on its own. Every choice you leave out of the brief (dialect, digits, font, layout direction, which country stands for "Arab") gets made quietly, usually by copying whatever the prompt happened to contain. And the output passes review by anyone who can't read it.

---

## 2. The setup

- **The product.** An imaginary grocery-delivery app called **Qareeb (قريب, "nearby")**. The test markets were Riyadh, Cairo and Casablanca, with Beirut and ten more cities added for the dialect tests. Earlier we tried the name "Dukkan" and dropped it because it sounded too Saudi; Qareeb is meant to read as pan-Arab.
- **Text models (all called through fal.ai's OpenRouter router, November 2026):**
  - Claude Opus 5.5 (Anthropic)
  - GPT-5.6 (OpenAI)
  - Gemini 3.1 Pro (Google)
  - DeepSeek V4 Pro
  - Mistral Saba, which Mistral markets as built for Middle Eastern and South Asian languages
  - "The leading four" or "frontier models" in this brief means Claude, GPT, Gemini and DeepSeek.
- **Arabic-first open models**, run on a rented Modal GPU (vLLM, L40S):
  - **ALLaM 7B Instruct**, from Saudi Arabia (SDAIA/HUMAIN)
  - **Fanar 1 9B Instruct**, from Qatar (QCRI)
  - Both got the same 208 prompts as the copy, messages and campaign tests.
  - ALLaM's 34B flagship has no public API and was **not** tested.
- **Image models (7):** GPT-Image 2.6, Google Nano Banana 2.1, Ideogram v4.5, Recraft v4.1 Pro, ByteDance Seedream v5 Pro, Alibaba Qwen-Image 3 and Flux 2 Max. They cover the big labs, two Chinese labs and two design tools that market themselves on typography.
- **Why these models:** they are what a real team would reach for: the top general models, the ones sold for the region, and the Arabic-native open models a team might pick for cost, data residency or national-AI reasons.

### Keeping AI from grading AI

- **Dialect:** identified by **CAMeL Tools DID-26**, an open-source identifier from NYU Abu Dhabi's CAMeL Lab, not by a chatbot. It was scored at region level: Gulf, Egypt, Levant, Maghreb, Iraq, Yemen, Sudan, Libya and MSA.
- **Interfaces:** rendered and measured in a real browser (Playwright, Chromium) at phone width (390px) and desktop width (1280px), with 21 checks per page.
- **Model judges:** where a model judged, it never came from the same lab as the model being judged. Claude read the text inside images because Anthropic makes none of the image models.
- **Native review:** one native Gulf (Saudi) reviewer who works in design. They reviewed the logo spelling, the country logos, the Saudi customer messages and the dialect samples through a review page. Their verdicts matched the automatic spelling scores and changed how we read the country logos.
- **Human baseline:** real Saudi and Egyptian grocery and delivery ads (Jahez, HungerStation, Breadfast, Rabbit), rebranded to Qareeb. They are set up for blind comparison against AI copy, but that comparison has **not** been run yet (see section 5).

### The tests

| Test | Size | What it measured |
|---|---|---|
| Pilot (landing pages, concepts, personas, billboards) | 16 landing pages, 13 concepts, 12 persona chats, 84 billboard images | First pass across the full launch workflow |
| Imagery | 292 images (376 with the billboards) | Default pictures of "Arab" people and places, and Arabic text drawn inside images |
| Marketing copy, dialect | 658 outputs (7 models) | Which dialect comes back, depending on the prompt's language, a named city, or an explicit request |
| Interface code (RTL) | 160 screens (8 screens × 4 prompt styles × 5 models) | Right-to-left quality, checked in a browser |
| Tokenization | 6 tokenizers | Extra cost of Arabic compared with English |
| Logos / brand | 77 images | Arabic vs English spelling in logos; logos made "for" a country |
| Customer messages | 504 triages (12 messages × 6 language variants × 7 models) | Intent, sentiment, urgency, sarcasm and churn risk, English vs Arabic |
| Campaign adaptation | 294 adaptations (14 English ad lines × 3 markets × main models) | Adapting American ads for Saudi Arabia and Egypt, with UK English as the control |

**Total:** more than 2,000 generated outputs.

**Interface prompt styles:**
- **plain:** an Arabic brief that says nothing about direction
- **arabic:** the brief written in Arabic
- **explicit:** adds "follow right-to-left best practices"
- **localize:** hands the model an English page (S1–S8 English reference pages) and asks it to localize it

**The 8 screens:** S1–S8, including checkout, sign-up, order tracking, a support chat, a store dashboard and others (see `methods/ui_screens.json`).

---

## 3. Findings

### A. Where it holds up (and that surprises people)

**1. Understanding customers: no Arabic penalty for the leading models.**
- The test used 12 support messages, each written in six forms: English, formal Arabic (MSA), Saudi, Egyptian, Moroccan Darija and Arabizi (Arabic typed in Latin letters).
- Share of messages where the leading four got **every** label right:

  | English | MSA | Saudi | Egyptian | Darija | Arabizi |
  |---|---|---|---|---|---|
  | 88% | 90% | 88% | 90% | 83% | 88% |

- Per model, English → Arabic range:
  - Claude: 100% → 92–100%
  - GPT: 100% in every form
  - Gemini: 83% → 75–83%
  - DeepSeek: 67% → 58–83%
- **All the traps were caught in every language by all four models (0 misses):**
  - a child's nut-allergy emergency, which should be high urgency;
  - sarcastic praise for a two-hour delay (ما شاء الله عليكم);
  - a complaint wrapped in a blessing (الله يسامحكم, "may God forgive you"), which should be negative;
  - a churn threat.
- Source: `data/messages_scores.json`, `data/messages_rows.csv`.

**2. Adapting campaigns, when asked to adapt.**
- **"Black Friday: up to 70% off":** all four renamed it الجمعة البيضاء ("White Friday") for Saudi Arabia and for Egypt, 8 times out of 8. For the UK they kept Black Friday 4 of 4. That matches a real precedent: Souq.com rebranded Black Friday as White Friday in 2014 out of respect for Friday as a day of worship (Gulf News, linked below).
- **Alcohol and pork:** no Saudi version contained any. Happy-hour drinks became juice or iced coffee, and bacon was replaced.
- **Literalness** (character overlap with the model's own literal translation; lower means more adapted):
  - Saudi 0.55, Egypt 0.49, UK English 0.90.
  - Approaches for Saudi: 46 adapted, 6 replaced, 4 literal.
  - Approaches for Egypt: 49 adapted, 5 replaced, 1 literal.
- **Good local touches:**
  - Two models turned "beach-body ready" into فورمة الساحل, the "North Coast shape" Egyptians aim for before summer.
  - A "Friday night date" moved to Thursday night, when Egyptians go out.
- **One miss:** in Egypt the Thanksgiving turkey survived in 3 of 4 adaptations.
- Source: `data/campaign_scores.json`, `data/campaign_rows.csv`.

**3. Big dialects, when the city is named.**
- With the launch city named, the leading models switched to its dialect about 90% of the time.
- Cairo got Egyptian 48 of 48; Beirut got Levantine 47 of 48.
- **When asked explicitly for a city's dialect,** Claude, GPT and Gemini were near-perfect for Riyadh, Doha, Cairo, Beirut, Damascus, Amman, Tunis and Rabat.
- **Native check:** the Saudi support replies read as natural to the native reviewer, 11 of 12. They use phrases a real agent would: أبشر, حقك علينا, لا هنت. The one flagged phrase was «شي يفشل».
- Source: `data/copy_summary.md` part C, `data/native_review_responses.json`.

**4. Interface foundations.**
- 157 of 160 screens declared Arabic and right-to-left. The three that didn't were all Saba.
- No page was cut off.
- 94% of rows flowed the right way, and every table started from the right.
- **Scores by model** (share of the 21 checks passed, averaged):

  | Claude | Gemini | GPT | DeepSeek | Saba |
  |---|---|---|---|---|
  | 88 | 85 | 81 | 81 | 78 |

- Source: `data/ui_audit_summary.json`.

### B. Where it breaks

**5. Arabic text inside images.**
- Seven image models drew the same two brand names as logos:
  - English correct 21 of 21.
  - Arabic correct 15 of 21. The native reviewer confirmed the 15/21 count independently.
- The errors are rarely gibberish. They are **real but wrong words**, or one misplaced dot that changes a letter:
  - **قرين** instead of قريب: a real word for "companion", also the spirit-double in Islamic belief.
  - **خلية:** "beehive".
  - Flux invented words that don't exist; the reviewer marked them "made up an Arabic word".
- A designer who can't read Arabic would approve these. No prompt fixed it in our tests.
- Images: `images/wordmarks.jpg`, `images/brand/`.

**6. The details of right-to-left interfaces.**
- Phone, email and password fields typed in the wrong direction on **78%** of the pages that had them.
- Order numbers flipped: `#QR-10482` showed as `QR-10482#` on **22 of 51** pages that showed one.
- A phone number in a support chat, `+966 55 123 4567`, rendered as `4567 123 55 966+`.
- About half the pages set Arabic line height too tight for the dots and vowel marks.
- On about half of them, more than a quarter of the Arabic text was below 13px.
- None of this shows in a screenshot. The pages look finished.
- Images: `images/worst/`, `images/phone-claude.png`, `images/phone-deepseek.png`. Data: `data/ui_hash_flip.json`.

**7. Localizing an English product is the weakest way to ask.**
- This is how most real products reach Arabic. It scored worst of the four prompt styles: **76** against **88** for the best style.
- Models translated the words but kept the English decisions: fonts with no Arabic letters, English line heights, even the placeholder customers.
- One model's localized Saudi store dashboard listed **Maya Thompson and Ethan Clark**, written in Arabic letters.

**8. Smaller dialects.**
- Asked explicitly, the leading models did Cairo, Beirut and Rabat almost perfectly.
- Sanaa (Yemen) came back right 29% of the time across all models; the most common miss was Gulf Arabic.
- Khartoum (Sudan) came back right 36%; the most common miss was Egyptian.
- Tripoli (Libya) came back right 29%.
- Some "Sudanese" copy was a costume: generic Gulf Arabic with one famous Sudanese word, يا زول, sprinkled on top.
- **Not native-checked.** These results rest on the identifier plus our own reading, and the identifier mislabelled 2 of 6 outputs we spot-checked.

**9. A Gulf-shaped default.**
- Ask for "Arabic" without naming a place and you get Gulf or formal Arabic, almost never Egyptian, even though Egypt is the largest Arabic-speaking country.
- With an English prompt and no city, outputs came back MSA 11, Gulf 6, Levant 2, Egypt 1.
- Image models dressed "an Arab family" in Gulf clothing **6 of 8** times.
- Images: `images/sheet-D1.jpg`, `images/sheet-D5.jpg`, `images/imagery-sheets/`.

**10. Logos made "for" a country.**
- Asked for a fintech logo "from" Egypt, image models drew pyramids 5 of 7 times.
- **The native reviewer did not object to the national symbols.** Their objection was quality: 9 of 21 country logos were random, badly made, or had nothing to do with fintech.
- One logo for Morocco used a six-pointed star the reviewer read as the Star of David, a real cultural mistake for a Moroccan brand. (Morocco's flag has a five-pointed star.)
- Image: `images/motifs.jpg`.

### C. Why it breaks: defaults, not ability

**11. One sentence fixes most interface errors.**
Adding "follow right-to-left best practices" to the prompt changed the same models' output like this:

| Problem | Prompt didn't mention RTL | Prompt asked for RTL best practices |
|---|---|---|
| Layout hard-coded to left/right (CSS `left`/`right`/`margin-left` instead of logical properties) | 75% of pages | 13% of pages |
| Order numbers flipped | 8 of 14 pages | 1 of 12 pages |
| Phone/email fields typed the wrong way | 5 of 7 pages | 1 of 4 pages |

- "Best practice" here means the W3C internationalization guidance, Material Design's bidirectionality guidelines and Apple's right-to-left guidelines: use CSS logical properties, mirror the layout, keep phone numbers, emails and IDs left-to-right inside RTL text, and use line heights that leave room for Arabic marks.
- "Start" in logical CSS means the reading start of the line. In Arabic that is the right side, so a layout written with `start`/`end` mirrors automatically.

**12. The output mirrors the prompt.**
- **Dialect:** with no city named, the copy came back in the dialect the prompt was written in. A prompt in Moroccan Darija got Darija 12 of 12 from the leading four.
- **When the city conflicts with the prompt's dialect, the city wins.** In 96 such cases (a prompt in one dialect, a different city named, no dialect requested), the leading models never followed the prompt's dialect (0 of 96). They went to the city's dialect or to formal Arabic.
- **Digits:** for three models, the digit style followed the prompt language. An Arabic brief produced Eastern Arabic digits (٢٠); an English brief produced Western digits (20), for the same city. That is a real design decision made by accident. Moroccans write 20.
- **Localization:** the English page is the strongest signal in the prompt, so its fonts, spacing and characters survive the translation.

**13. Images are a different problem.**
Image models draw letter shapes rather than spell words. Arabic letters change form as they join, so the output comes out plausible but wrong. No prompt fixed this.

**14. Tokenization is real but is not the cause.**
- The same visible interface text costs **24–58% more tokens** in Arabic with most tokenizers. Measured with o200k (OpenAI), DeepSeek-V3, Qwen2.5, Mistral-Small, Jais and Fanar.
- **Jais**, built for Arabic, reaches parity.
- But code is written in English, so a whole Arabic page costs only about **2% more**, and no page was cut off.
- The interface failures are habits learned from English interfaces, not limits of the model.
- Source: `data/ui_tokens.json`.

**15. A caution on formality.**
Real Saudi brand copy (see `data/human_baseline_real_ads.json`) is itself fairly formal. The models' drift toward formal Arabic for Riyadh may partly reflect how Saudi brands actually write, not a failure.

### D. The specialist paradox

**16. Models built for Arabic did worst, mostly for reasons unrelated to Arabic.**

**Mistral Saba:**
- Put Russian, Korean or Chinese characters into **63%** of its copy and English words into **86%**.
- In Arabizi it read "peanut butter" (literally "Sudanese fava-bean butter") as black fava beans.
- It turned the allergy emergency into a quality complaint.

**ALLaM 7B and Fanar 9B:**
- Every label right on only **17–42%** of customer messages, against 83–90% for the leading four.
- Mostly formal Arabic even when given a city:
  - ALLaM followed the named city 6 of 48 times; Fanar 0 of 48.
  - Formal Arabic in 44 of 94 (ALLaM) and 66 of 94 (Fanar) copy outputs.
- Explicit dialect match: 10 of 28 (ALLaM) and 12 of 28 (Fanar).
- Both kept "Black Friday".
- Both left placeholders such as [اسم التطبيق] and "app name" in finished ads.
- ALLaM rendered "Thanksgiving dinner, sorted" as وجبة عيد الشكر مغسولة, literally "Thanksgiving dinner, washed".
- Fanar wrote «أنا مِحبّشها»; this needs a native check before you quote it.

**The tell: they fail in English too.**
- ALLaM rated the allergy emergency as medium urgency in all six languages, English included.
- Both missed the sarcasm in every language.
- In English, ALLaM got every label right 33% of the time and Fanar 17%.
- So this is the gap between 7–9 billion-parameter models and frontier models many times larger. It is not a lack of Arabic.
- **Fair conclusion (keep it narrow):** the regional open models we could run trail the large general ones. It is not a verdict on ALLaM 34B or on Arabic-first AI in general.

---

## 4. Implications (an argument from the findings, not a measurement)

**Three consequences:**
1. **The errors are invisible to most reviewers.** A misspelled logo that forms a real word, or a polished page with a scrambled order number, looks finished to a designer, founder or investor who can't read Arabic. The people who would catch it are often not in the review loop.
2. **Some damage is deferred.** A layout hard-coded to left/right looks correct today. It breaks the first time someone adds an English version or reuses a component.
3. **Brand decisions get made by accident.** Which dialect the brand speaks, which digits it uses, which country it imagines its customer in: in our tests these came from who wrote the prompt and in what language.

**Cheap fixes:**
1. Write a short localization brief and put it in every prompt: market and city, dialect or register, Western or Eastern digits, the Arabic font, and "follow right-to-left best practices".
2. Don't hand the model an English page and ask it to localize. Spell out the decisions, or generate the Arabic version from the brief.
3. Have an Arabic reader check anything visual: logos, images with text, screenshots of the finished interface. Text the AI writes is usually fine; text an image model draws often isn't.
4. Use frontier models for Arabic work. Don't assume a regional label means better quality until you've tested it.

**The point beyond Arabic:** Arabic makes the pattern easy to see. It is right-to-left, splits into dialects, and has a joined script that image models struggle to draw. But the mechanism is general. A model asked to build for a market it wasn't designed in fills every gap with defaults. Those defaults come from English, from the most visible version of a culture, or from whatever the prompt happened to contain. So the useful question is not "can the model write language X?" (the leading models largely can). It is "has anyone written down the decisions the model will otherwise make for us, and is anyone who can read the result looking at it?"

---

## 5. Limits: what you must NOT claim

- **No preference or persuasion data.** We measured whether copy is in the right dialect and whether interfaces behave, not whether an ad persuades or whether people prefer AI or human copy. The blind human-vs-AI vote is set up but not run. **Do not say AI copy is as good as or worse than human copy.**
- **One native reviewer** (Gulf/Saudi). Logo spelling, country logos and the Saudi messages are native-checked. Egyptian, Levantine and Maghrebi output is not, and the Yemen, Sudan and Libya dialect findings are not.
- **The dialect identifier makes mistakes:** it mislabelled 2 of 6 outputs we spot-checked. Treat the dialect percentages as directional.
- **Small samples:** mostly 1–2 outputs per model per condition. The patterns repeat across tests, but individual numbers would move with more runs. Avoid false precision; say "8 of 8", not "100% of the time".
- **No business data:** we didn't measure the cost of these failures in trust, conversion or support load.
- **Not tested:**
  - ALLaM 34B (no public API);
  - Midjourney;
  - the AI design tools founders actually use (v0, Lovable, Canva);
  - multi-turn back-and-forth. Each test was a single prompt.
- **Models change.** These results describe the models as of November 2026.
- **Wording to avoid:** don't call this a benchmark. It is a field study.
- **The "+2% whole page" token figure** is for HTML pages, where the code is English. Don't generalize it to chat.

---

## 6. Suggested angle and structure (optional)

The draft runs: hook (the قرين logo and the flipped phone number) → what we did → where it holds up → where it breaks → why (defaults) → the specialist paradox → what it means for builders → limits → the point beyond Arabic.

Other angles that the data supports:
- **"The one-sentence fix":** lead with the RTL before/after table.
- **"Mirror, not mind":** the model copies the prompt's language, dialect and digits.
- **"The reviewer problem":** errors you can only see if you read the script.

**Style:** plain, concrete, numbers in the text, no hype. Short sentences. Quote real Arabic examples with a translation. Write for designers and marketers, not ML researchers. Describe Arab markets as specific places (Riyadh, Cairo, Casablanca), not as one thing.

### Sources to cite

- Souq.com renames Black Friday "White Friday" (Gulf News): https://gulfnews.com/business/retail/black-friday-is-new-white-friday-for-souq-1.1622991
- CAMeL Tools (NYU Abu Dhabi CAMeL Lab): https://github.com/CAMeL-Lab/camel_tools
- ALLaM 7B Instruct: https://huggingface.co/humain-ai/ALLaM-7B-Instruct-preview
- Fanar 1 9B Instruct: https://huggingface.co/QCRI/Fanar-1-9B-Instruct
- HUMAIN, ALLaM 34B API listed as coming soon: https://www.humain.ai/en/humain-iq

---

## 7. File index

### `reference_article_draft.md`
The existing draft. Two small corrections are already made: a stray pasted fragment was removed, and the RTL claim was corrected to 157/160.

### `data/` (analysis)

| File | What it is |
|---|---|
| `copy_summary.md` | Dialect tables: mirror test (A), prompt vs city (B), explicit request by city (C), breakage signals |
| `copy_rows.csv` | All 658 copy outputs, with detected dialect, digits and so on |
| `messages_scores.json`, `messages_rows.csv` | Customer-message triage: scores, traps and every output |
| `campaign_scores.json`, `campaign_rows.csv` | Campaign adaptation: literalness, approach, White Friday, alcohol/pork checks, every output with back-translation |
| `ui_audit_summary.json` | 160 screens × 21 browser checks: pass/fail and score per page |
| `ui_hash_flip.json` | Order-number flip measurement |
| `ui_tokens.json` | Token cost by tokenizer, Arabic vs English |
| `brand_logo_rows.csv`, `brand_logo_readback.json` | What each logo was asked to say vs what it actually reads |
| `native_review_items.json`, `native_review_responses.json` | The native review page's items and the Gulf reviewer's answers and notes |
| `human_baseline_real_ads.json` | Real Saudi and Egyptian ads, rebranded to Qareeb, with sources |
| `research-log.xlsx` | Research log workbook |

### `methods/` (exact prompts and inputs)

| File | What it is |
|---|---|
| `models_config.json` | Model IDs and endpoints |
| `copy_prompts.json` | Copy-test prompts |
| `ui_screens.json` | The 8 screens and 4 prompt styles |
| `messages_and_gold_labels.json` | The 12 messages in 6 forms, with the correct labels |
| `campaigns.json` | The 14 English ad lines and the markets |
| `brand_names.json` | Logo prompts |
| `arabic_first_jobs.json` | The 208 prompts given to ALLaM and Fanar |

### `generations/` (raw model outputs)

| Folder | What it holds |
|---|---|
| `ui-pages/` | All 160 AI-built HTML screens (open them in a browser), named `S{screen}__{style}__{model}.html`. `english-reference/` has the English pages used for the localize test. |
| `copy/out/` | Every copy generation |
| `messages/out/` | Every message triage |
| `campaign/out/` | Every campaign adaptation |
| `arabic-first-models/` | ALLaM and Fanar raw outputs |
| `pilot/` | Pilot landing pages, concepts and persona chats |

### `images/` (visual evidence)

| File or folder | What it shows |
|---|---|
| `wordmarks.jpg` | Arabic vs English logo spelling, all 7 models |
| `motifs.jpg` | Country logos |
| `brand/` | Individual logos |
| `worst/`, `ui/` | Screenshots of the worst RTL pages and the interface gallery |
| `phone-claude.png`, `phone-deepseek.png` | Phone-width screenshots |
| `billboards-*.jpg` | Pilot billboards for Riyadh, Cairo and Casablanca |
| `sheet-D1.jpg`, `sheet-D5.jpg` | Default "Arab family / people" depictions |
| `sheet-A2.jpg`, `sheet-A3.jpg` | Arabic text inside images |
| `sheet-G1.jpg` | Additional imagery grid |
| `spot-cairo.jpg` | Cairo spot image |
| `imagery-sheets/` | All 20 imagery contact sheets |

The full set of 292 individual imagery images is in a separate zip, `handoff-images-full.zip`, if you need it.
