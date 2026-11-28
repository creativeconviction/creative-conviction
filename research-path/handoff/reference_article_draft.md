# The Models Speak Arabic. They Don't Decide for It.

Nov 28, 2026 · @rayouf alhumedhi

AI is not bad at Arabic. It is bad at making decisions for Arabic, and it rarely tells you it made one.

One of the logos in our study was meant to say قريب, “nearby”, the name of the grocery app we invented for the test. It came back as قرين, a real word meaning “companion”, also the name for a spirit-double in Islamic belief. Another came back as خلية, “beehive”. Both are clean, confident, well-drawn Arabic. A designer who doesn’t read the script would approve them.

In a support chat built by another model, a customer’s phone number, +966 55 123 4567, showed up on screen as 4567 123 55 966+. The page around it looked polished. Nothing flagged the error.

These are the failures that matter, and they are not the ones people expect. Across more than 2,000 outputs we found the leading models understand Arabic customers about as well as English ones, adapt campaigns with real cultural judgement, and write convincing Saudi and Egyptian Arabic. What they don’t do is decide anything on their own: which dialect, which digits, which font, which country stands in for “Arab”. Left unspecified, those choices get made silently, usually by copying whatever the model was handed.

## What we did

We built one imaginary product, Qareeb (قريب), a grocery delivery app, and used AI at each step a real team would: research, copy, visuals, interface code, customer support and campaigns. The markets were Riyadh, Cairo and Casablanca, with Beirut and eleven other cities added for dialect tests.

We tested five text models: Claude, GPT, Gemini and DeepSeek, plus Mistral Saba, a model built for Middle Eastern languages. Later we added two Arabic-first open models, ALLaM 7B from Saudi Arabia and Fanar 9B from Qatar. Seven image models covered the big labs, two Chinese labs and two design tools that market themselves on typography.

| Test | Size | What it measured |
| --- | --- | --- |
| Marketing copy | 658 outputs | Which dialect comes back, depending on prompt language, named city or explicit request |
| Interface code | 160 screens | Right-to-left quality, checked in a real browser at phone and desktop width |
| Imagery | 376 images | Default depictions of people and places, and Arabic text inside images |
| Logos | 77 images | Arabic vs English spelling, and logos made for countries |
| Customer messages | 504 triages | Understanding of the same 12 messages in English and five kinds of Arabic |
| Campaign adaptation | 294 adaptations | American ad lines adapted for Saudi Arabia and Egypt, with UK English as a control |

We tried to keep AI from grading AI. Dialect was identified by an open-source tool from NYU Abu Dhabi’s CAMeL Lab, not a chatbot. Interfaces were measured in a browser. Where a model did judge, it was never one from the same lab as the model being judged. A native Gulf reviewer who works in design checked the logos, the country logos and the Saudi test messages, and their verdicts matched ours on spelling and changed our reading of the logos.

## Where it holds up

The common assumption is that AI handles Arabic poorly across the board. For the leading models, that is mostly wrong.

**Understanding customers.** We wrote 12 support messages and rendered each in English, formal Arabic, Saudi, Egyptian, Moroccan Darija and Arabizi, Arabic typed in Latin letters. The four leading models got every label right 88% of the time in English and 83–90% in every form of Arabic. They caught a child’s nut-allergy emergency, sarcastic praise about a two-hour delay (ما شاء الله عليكم) and a complaint wrapped in a blessing (الله يسامحكم, “may God forgive you”) in every language.

**Adapting, not just translating, when asked.** Given “Black Friday: up to 70% off” for Saudi Arabia and Egypt, all four renamed it الجمعة البيضاء, White Friday, eight times out of eight. That is the same choice Souq.com made in 2014, out of respect for Friday as a day of worship. Happy-hour drinks became juice and iced coffee, and no Saudi version contained alcohol or pork. Two models turned “beach-body ready” into فورمة الساحل, the “North Coast shape” Egyptians aim for before summer, and moved a “Friday night date” to Thursday night, when Egyptians actually go out.

**Big dialects, when named.** Told the launch city, the leading models switched to its dialect 90% of the time. Cairo got Egyptian 48 times out of 48, Beirut got Levantine 47 out of 48. Their Saudi support chats used phrases a real agent would: أبشر, حقك علينا, لا هنت.

**Interface foundations.** 157 of 160 AI-built screens declared Arabic and right-to-left (the three misses were all Saba), none was cut off, 94% of rows flowed the right way and every table started from the right.

## Where it breaks

The failures cluster in places nobody checks closely, and many of them look fine.

**Arabic inside images.** Seven image models drew the same two brand names as logos. English came out correctly 21 times out of 21. Arabic came out correctly 15 times out of 21, a count our native reviewer confirmed independently. The mistakes were rarely gibberish. They were real but wrong words, or a single misplaced dot that changes a letter.

**The details of right-to-left interfaces.** Phone, email and password fields typed in the wrong direction on 78% of the pages that had them. On 22 of the 51 pages that showed an order number, #QR-10482 displayed as QR-10482#. Half the pages set Arabic lines too tight for its dots and vowel marks, and on half of them more than a quarter of the Arabic text was below 13 pixels. None of this stops a page from looking finished in a screenshot.

**Localizing an English product.** This is how most products reach Arabic, and it was the weakest way to ask. Handed an English page, models translated the words and kept the English decisions: fonts with no Arabic letters, English line heights, even the placeholder customers. A Saudi store dashboard localized by one model listed Maya Thompson and Ethan Clark, written in Arabic letters.

**Smaller dialects.** Asked explicitly, the leading models produced Cairo, Beirut and Rabat dialects almost perfectly. Yemeni came back as Gulf Arabic half the time, and Sudanese was sometimes Egyptian. Some “Sudanese” copy was a costume: generic Gulf Arabic with one famous Sudanese word, يا زول, added on top. These dialect findings rest on the automatic identifier and our reading, not on native reviewers.

**A Gulf-shaped default.** Ask for “Arabic” without naming a place and you get Gulf or formal Arabic, almost never Egyptian, though Egypt is the largest Arabic-speaking country. Image models dressed “an Arab family” in Gulf clothing six times out of eight.

**Logos made for a country.** Asked for a fintech logo “from” Egypt, image models drew pyramids five times out of seven. Our reviewer didn’t object to the national symbols. Their objection was quality: nine of 21 logos were random, badly made or had nothing to do with fintech. One, for Morocco, used a six-pointed star the reviewer read as the Star of David, a real cultural mistake for a Moroccan brand.

## Why it breaks: defaults, not ability

The models know what to do. They do it when told, and otherwise fall back on whatever they were handed.

The clearest evidence is what one extra sentence changes. When the prompt for an interface added “follow right-to-left best practices”, the same models fixed most of what they had got wrong:

| Problem | Prompt didn’t mention RTL | Prompt asked for RTL best practices |
| --- | --- | --- |
| Layout hard-coded to left and right | 75% of pages | 13% of pages |
| Order numbers flipped | 8 of 14 pages | 1 of 12 pages |
| Phone and email fields typed the wrong way | 5 of 7 pages | 1 of 4 pages |

The same pattern runs through everything else. With no city named, the copy came back in whatever dialect the prompt was written in: a prompt in Moroccan Darija got Darija 12 times out of 12. Name a different city and the city wins: in 96 such cases, the prompt’s dialect never did. For three of the models, even the digits followed the prompt: an Arabic brief produced ٢٠ and an English brief produced 20, for the same city. That is a real design decision, made by accident. Moroccans write 20.

Localization works the same way. The English page is the strongest signal in the prompt, so its fonts, spacing and characters survive the translation.

Images are a different problem. Image models draw letter shapes rather than spell words, so Arabic, whose letters change form as they join, comes out plausible but wrong. No prompt fixed that in our tests.

Tokenization is real but is not the cause. The same interface text costs 24–58% more tokens in Arabic with most tokenizers; Jais, built for Arabic, reaches parity. But code is written in English, so a whole page costs only about 2% more, and no page was cut off. The interface failures are habits learned from English interfaces, not limits of the model.

One caution. Real Saudi brand copy is itself fairly formal. The models’ tendency to drift formal for Riyadh may partly reflect how Saudi brands write, not a failure to write like Saudis.

## The specialist paradox

The models built for Arabic did worst, and mostly for reasons that have little to do with Arabic.

Mistral Saba, marketed for Middle Eastern languages, put Russian, Korean or Chinese characters into 63% of its copy and English words into 86%. In Arabizi it read “peanut butter”, literally “Sudanese fava-bean butter”, as black fava beans, and turned the allergy emergency into a quality complaint.

The Arabic-first open models, ALLaM 7B and Fanar 9B, trailed the leading models on every test. They got every label right on 17–42% of customer messages, against 83–90%. They wrote mostly formal Arabic even when given a city, kept “Black Friday”, and left placeholders such as \[اسم التطبيق\], “app name”, in finished ads. ALLaM rendered “Thanksgiving dinner, sorted” as وجبة عيد الشكر مغسولة, literally “Thanksgiving dinner, washed”.

The tell is that they fail in English too. ALLaM rated the allergy emergency as medium urgency in all six languages, English included, and both missed the sarcasm in every language. This is the gap between 7–9 billion-parameter models and frontier models many times larger, not a lack of Arabic. The fair conclusion is narrow: the regional open models we could run trail the large general ones. ALLaM’s 34B flagship has no public API yet and was not tested.

## What it means for people building for Arab users

The risk is not that AI can’t do Arabic. It is that every Arabic decision you leave out of the brief gets made for you, quietly, and that the result passes review by anyone who can’t read it.

Three consequences follow.

- **The errors are invisible to most reviewers.** A misspelled logo that forms a real word, or a polished page with a scrambled order number, looks finished to a non-Arabic-reading designer, founder or investor. The people who would catch it are often not in the review loop.
- **Some of the damage is deferred.** A layout hard-coded to left and right looks correct today and breaks the first time someone adds an English version or reuses a component. That cost lands later, on someone else.
- **Brand decisions get made by accident.** Which dialect the brand speaks, which digits it uses, which country it imagines its customer lives in: in our tests, these came from whoever wrote the prompt and in what language, not from any decision.

The fixes are mostly cheap.

1. Write a short localization brief and put it in every prompt: the market and city, the dialect or register, Western or Arabic digits, the Arabic font, and “follow right-to-left best practices”.
2. Don’t hand the model an English page and ask it to localize. Either spell out the decisions above, or generate the Arabic version from the brief.
3. Have an Arabic reader check anything visual: logos, images with text, screenshots of the finished interface. Text the AI writes is usually fine; text an image model draws often isn’t.
4. Use the frontier models for Arabic work, and don’t assume a regional label means better quality until you have tested it.

## What we don’t know yet

This is a field study, not a benchmark, and several of its limits matter.

- **Small samples.** Most comparisons rest on one or two outputs per model per condition. The patterns repeat across tests, but individual numbers would move with more runs.
- **One native reviewer.** Logo spelling and the reading of country logos are native-checked by one Gulf reviewer. The dialect findings, especially for Yemen, Sudan and Libya, rest on an automatic identifier and our own reading. The identifier mislabelled two of six outputs we spot-checked.
- **Correct is not the same as good.** We measured whether the copy is in the right dialect and whether interfaces behave, not whether an ad persuades. We have no preference data yet, and no comparison with copy written by people.
- **No business data.** We measured failures, not what they cost in trust, conversion or support load. The impact section is an argument from the failures, not a measurement.
- **Flagships and tools not tested.** ALLaM’s 34B model, Midjourney and the AI design tools founders actually use, such as v0, Lovable and Canva, were out of reach. We tested single prompts, not the back-and-forth of real work.
- **Models change.** These results describe the models as of November 2026.

## The point beyond Arabic

Arabic makes the pattern easy to see because it is written right to left, splits into dialects and has a script image models struggle to draw. But the mechanism is general. A model asked to build for a market it was not designed in will fill every gap with its defaults, and its defaults come from English, from the most visible version of a culture, or from whatever the prompt happened to contain.

That changes what “AI is good at language X” should mean. The useful question is not whether a model can write the language, which the leading models now largely can. It is whether anyone on the team has written down the decisions the model will otherwise make on their behalf, and whether anyone who can read the result is looking at it.

## Sources

- [Souq.com renames Black Friday “White Friday” (Gulf News)](https://gulfnews.com/business/retail/black-friday-is-new-white-friday-for-souq-1.1622991)
- [CAMeL Tools dialect identification (NYU Abu Dhabi CAMeL Lab)](https://github.com/CAMeL-Lab/camel_tools)
- [ALLaM 7B Instruct (Hugging Face)](https://huggingface.co/humain-ai/ALLaM-7B-Instruct-preview)
- [Fanar 1 9B Instruct (Hugging Face)](https://huggingface.co/QCRI/Fanar-1-9B-Instruct)
- [HUMAIN: ALLaM 34B developer API listed as coming soon](https://www.humain.ai/en/humain-iq)
