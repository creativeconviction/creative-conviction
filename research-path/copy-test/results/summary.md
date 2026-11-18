# Marketing copy: dialect experiment

470 outputs. Dialect by CAMeL Lab DID-26, scored at region level.


## A. Mirror test: prompt in a dialect, no location

Share of outputs whose detected region matches the prompt's dialect. For English, the detected region distribution.

| prompt | claude | deepseek | gemini | gpt | saba | all |
|---|---|---|---|---|---|---|
| en | MSA 3 | Levant 2, Gulf 1 | Gulf 2, Egypt 1 | Gulf 2, MSA 1 | Gulf 1, MSA 1, Sudan 1 | Gulf 6, MSA 5, Levant 2 |
| msa | 67% | 0% | 33% | 67% | 100% | 53% |
| saudi | 100% | 0% | 100% | 33% | 33% | 53% |
| egypt | 100% | 0% | 67% | 100% | 67% | 67% |
| levant | 100% | 67% | 100% | 67% | 0% | 67% |
| darija | 100% | 100% | 100% | 100% | 0% | 80% |


## B. Prompt dialect vs launch city (no dialect named)

Each cell: % following the city / % following the prompt's dialect / % MSA.

| prompt \ city | Riyadh | Cairo | Beirut | Casablanca |
|---|---|---|---|---|
| en | 50% / 0% / 40% | 80% / 0% / 0% | 90% / 0% / 0% | 70% / 0% / 10% |
| msa | 50% / 50% / 50% | 80% / 20% / 20% | 80% / 10% / 10% | 60% / 40% / 40% |
| saudi | 60% / 0% / 30% | 90% / 0% / 10% | 80% / 0% / 20% | 70% / 10% / 20% |
| egypt | 80% / 10% / 10% | 90% / 0% / 0% | 90% / 10% / 0% | 80% / 20% / 0% |
| levant | 90% / 0% / 0% | 90% / 0% / 0% | 80% / 0% / 0% | 80% / 0% / 10% |
| darija | 60% / 0% / 20% | 80% / 0% / 0% | 70% / 10% / 10% | 80% / 0% / 10% |


## C. Explicit dialect request: region match by city and model

| city (dialect) | claude | deepseek | gemini | gpt | saba | all | most common miss |
|---|---|---|---|---|---|---|---|
| Riyadh (Gulf) | 100% | 100% | 100% | 100% | 0% | 80% | Levant 1 |
| Doha (Gulf) | 100% | 100% | 100% | 100% | 0% | 80% | Egypt 2 |
| Muscat (Gulf) | 100% | 100% | 50% | 100% | 0% | 70% | Tunisia 1 |
| Sanaa (Yemen) | 100% | 0% | 50% | 50% | 0% | 40% | Gulf 5 |
| Baghdad (Iraq) | 100% | 50% | 100% | 100% | 50% | 80% | Gulf 1 |
| Cairo (Egypt) | 100% | 100% | 100% | 100% | 100% | 100% |  |
| Khartoum (Sudan) | 100% | 50% | 50% | 50% | 0% | 50% | Egypt 4 |
| Beirut (Levant) | 100% | 100% | 100% | 100% | 100% | 100% |  |
| Damascus (Levant) | 100% | 100% | 100% | 100% | 100% | 100% |  |
| Amman (Levant) | 100% | 100% | 100% | 100% | 50% | 90% | Egypt 1 |
| Tripoli (Libya) | 0% | 50% | 50% | 100% | 0% | 40% | Tunisia 3 |
| Tunis (Tunisia) | 100% | 50% | 100% | 100% | 0% | 70% | Libya 2 |
| Algiers (Algeria) | 100% | 50% | 100% | 50% | 0% | 60% | Libya 2 |
| Rabat (Morocco) | 100% | 100% | 100% | 100% | 0% | 80% | Algeria 1 |


## Breakage signals (all parts)

| model | outputs | with foreign-script characters | with English words | named a place unprompted (part A) |
|---|---|---|---|---|
| claude | 94 | 0% | 0% | 0% |
| deepseek | 94 | 0% | 4% | 0% |
| gemini | 94 | 0% | 3% | 0% |
| gpt | 94 | 0% | 0% | 0% |
| saba | 94 | 63% | 86% | 6% |
