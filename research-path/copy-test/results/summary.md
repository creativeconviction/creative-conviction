# Marketing copy: dialect experiment

658 outputs. Dialect by CAMeL Lab DID-26, scored at region level.


## A. Mirror test: prompt in a dialect, no location

Share of outputs whose detected region matches the prompt's dialect. For English, the detected region distribution.

| prompt | allam | claude | deepseek | fanar | gemini | gpt | saba | all |
|---|---|---|---|---|---|---|---|---|
| en | MSA 3 | MSA 3 | Levant 2, Gulf 1 | MSA 3 | Gulf 2, Egypt 1 | Gulf 2, MSA 1 | Gulf 1, MSA 1, Sudan 1 | MSA 11, Gulf 6, Levant 2 |
| msa | 100% | 67% | 0% | 100% | 33% | 67% | 100% | 67% |
| saudi | 100% | 100% | 0% | 0% | 100% | 33% | 33% | 52% |
| egypt | 100% | 100% | 0% | 0% | 67% | 100% | 67% | 62% |
| levant | 0% | 100% | 67% | 0% | 100% | 67% | 0% | 48% |
| darija | 0% | 100% | 100% | 0% | 100% | 100% | 0% | 57% |


## B. Prompt dialect vs launch city (no dialect named)

Each cell: % following the city / % following the prompt's dialect / % MSA.

| prompt \ city | Riyadh | Cairo | Beirut | Casablanca |
|---|---|---|---|---|
| en | 36% / 0% / 57% | 57% / 0% / 29% | 64% / 0% / 29% | 50% / 0% / 36% |
| msa | 36% / 64% / 64% | 57% / 43% / 43% | 57% / 36% / 36% | 43% / 57% / 57% |
| saudi | 43% / 0% / 50% | 64% / 14% / 21% | 57% / 0% / 43% | 50% / 21% / 29% |
| egypt | 57% / 21% / 21% | 79% / 0% / 14% | 64% / 21% / 14% | 57% / 29% / 14% |
| levant | 64% / 14% / 14% | 79% / 0% / 14% | 57% / 0% / 29% | 57% / 0% / 36% |
| darija | 57% / 0% / 29% | 57% / 0% / 14% | 50% / 7% / 36% | 57% / 0% / 21% |


## C. Explicit dialect request: region match by city and model

| city (dialect) | allam | claude | deepseek | fanar | gemini | gpt | saba | all | most common miss |
|---|---|---|---|---|---|---|---|---|---|
| Riyadh (Gulf) | 100% | 100% | 100% | 0% | 100% | 100% | 0% | 71% | Egypt 2 |
| Doha (Gulf) | 100% | 100% | 100% | 0% | 100% | 100% | 0% | 71% | Levant 2 |
| Muscat (Gulf) | 0% | 100% | 100% | 100% | 50% | 100% | 0% | 64% | MSA 2 |
| Sanaa (Yemen) | 0% | 100% | 0% | 0% | 50% | 50% | 0% | 29% | Gulf 7 |
| Baghdad (Iraq) | 0% | 100% | 50% | 0% | 100% | 100% | 50% | 57% | Gulf 3 |
| Cairo (Egypt) | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 86% | MSA 2 |
| Khartoum (Sudan) | 0% | 100% | 50% | 0% | 50% | 50% | 0% | 36% | Egypt 6 |
| Beirut (Levant) | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |  |
| Damascus (Levant) | 0% | 100% | 100% | 0% | 100% | 100% | 100% | 71% | Gulf 2 |
| Amman (Levant) | 0% | 100% | 100% | 0% | 100% | 100% | 50% | 64% | Egypt 3 |
| Tripoli (Libya) | 0% | 0% | 50% | 0% | 50% | 100% | 0% | 29% | Levant 4 |
| Tunis (Tunisia) | 100% | 100% | 50% | 100% | 100% | 100% | 0% | 79% | Libya 2 |
| Algiers (Algeria) | 0% | 100% | 50% | 100% | 100% | 50% | 0% | 57% | Tunisia 3 |
| Rabat (Morocco) | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 86% | Algeria 1 |


## Breakage signals (all parts)

| model | outputs | with foreign-script characters | with English words | named a place unprompted (part A) |
|---|---|---|---|---|
| allam | 94 | 0% | 20% | 50% |
| claude | 94 | 0% | 0% | 0% |
| deepseek | 94 | 0% | 4% | 0% |
| fanar | 94 | 2% | 41% | 0% |
| gemini | 94 | 0% | 3% | 0% |
| gpt | 94 | 0% | 0% | 0% |
| saba | 94 | 63% | 86% | 6% |
