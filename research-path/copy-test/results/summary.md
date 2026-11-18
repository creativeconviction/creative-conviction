# Marketing copy: dialect experiment

29 outputs. Dialect by CAMeL Lab DID-26, scored at region level.


## A. Mirror test: prompt in a dialect, no location

Share of outputs whose detected region matches the prompt's dialect. For English, the detected region distribution.

| prompt | claude | deepseek | gemini | gpt | saba | all |
|---|---|---|---|---|---|---|
| en | MSA 3 | Levant 2, MSA 1 | Egypt 1, Gulf 1 | Sudan 1, MSA 1, Gulf 1 | Gulf 1, MSA 1, Sudan 1 | MSA 6, Gulf 3, Levant 2 |
| msa | 100% | 0% | – | 67% | 100% | 67% |
| saudi | – | – | – | 33% | 50% | 40% |
| egypt | – | – | – | 100% | – | 100% |
| levant | – | – | – | – | – | – |
| darija | – | – | – | – | – | – |


## Breakage signals (all parts)

| model | outputs | with foreign-script characters | with English words | named a place unprompted (part A) |
|---|---|---|---|---|
| claude | 4 | 0% | 0% | 0% |
| deepseek | 5 | 0% | 20% | 0% |
| gemini | 2 | 0% | 100% | 0% |
| gpt | 10 | 0% | 0% | 0% |
| saba | 8 | 75% | 100% | 0% |
