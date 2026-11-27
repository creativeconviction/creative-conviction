"""Run the Arabic-first models (ALLaM 7B, Fanar 9B) on a Modal GPU through the same prompts as the main study.

Run this on your own computer (Modal can't connect from the cloud session):

    pip install modal
    modal setup                      # once, to log in
    modal run run_modal.py           # both models, ~20-30 min, a few dollars

It reads jobs.json (208 prompts: copy, customer messages, campaign) and writes
outputs_allam.json and outputs_fanar.json next to this file. Commit those two files
(or send them back) and the analysis picks them up with import_outputs.py.
"""
import json
import pathlib

import modal

MODELS = {
    "allam": "humain-ai/ALLaM-7B-Instruct-preview",  # Saudi (SDAIA / HUMAIN), Llama architecture
    "fanar": "QCRI/Fanar-1-9B-Instruct",             # Qatar (QCRI), Gemma-2 architecture
}

app = modal.App("arabic-first-models")
image = modal.Image.debian_slim(python_version="3.11").pip_install("vllm==0.8.5")
hf_cache = modal.Volume.from_name("hf-cache-arabic-models", create_if_missing=True)


@app.function(image=image, gpu="L40S", timeout=3600, volumes={"/root/.cache/huggingface": hf_cache})
def run(model_key: str, jobs: list) -> list:
    from vllm import LLM, SamplingParams

    llm = LLM(model=MODELS[model_key], dtype="bfloat16", max_model_len=4096, gpu_memory_utilization=0.90)
    groups = {}
    for j in jobs:
        groups.setdefault((j["temperature"], j["max_tokens"]), []).append(j)
    results = []
    for (temperature, max_tokens), group in groups.items():
        params = SamplingParams(temperature=temperature, top_p=0.95 if temperature > 0 else 1.0, max_tokens=max_tokens, seed=7)
        conversations = [[{"role": "user", "content": j["prompt"]}] for j in group]
        outputs = llm.chat(conversations, params, use_tqdm=False)
        for j, o in zip(group, outputs):
            results.append({"key": j["key"].replace("{m}", model_key), "exp": j["exp"], "output": o.outputs[0].text,
                            "finish_reason": o.outputs[0].finish_reason})
    return results


@app.local_entrypoint()
def main(models: str = "allam,fanar"):
    here = pathlib.Path(__file__).parent
    jobs = json.loads((here / "jobs.json").read_text(encoding="utf-8"))
    keys = [m.strip() for m in models.split(",") if m.strip()]
    for key, res in zip(keys, run.starmap([(k, jobs) for k in keys])):
        (here / f"outputs_{key}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{key}: {len(res)} outputs -> outputs_{key}.json")
