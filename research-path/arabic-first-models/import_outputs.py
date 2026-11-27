"""Copy ALLaM / Fanar outputs into each experiment's out/ folder in the same format the other models use.
Then re-run the scoring:
    (cd ../copy-test && <camel python> analyze.py)
    (cd ../messages-test && node run.js --score-only)
    (cd ../campaign-test && node run.js --score-only)
"""
import json
import pathlib
import re
from datetime import datetime, timezone

here = pathlib.Path(__file__).parent
root = here.parent
jobs = {j["key"]: j for j in json.loads((here / "jobs.json").read_text(encoding="utf-8"))}
MODEL_IDS = {"allam": "humain-ai/ALLaM-7B-Instruct-preview", "fanar": "QCRI/Fanar-1-9B-Instruct"}


def extract_json(text):
    t = re.sub(r"^```(?:json)?\s*|```\s*$", "", text.strip(), flags=re.M)
    a, b = t.find("{"), t.rfind("}")
    try:
        return json.loads(t[a:b + 1])
    except Exception:
        return {"_parse_error": True}


n = 0
for f in sorted(here.glob("outputs_*.json")):
    model = f.stem.replace("outputs_", "")
    for r in json.loads(f.read_text(encoding="utf-8")):
        job = jobs[r["key"].replace(f"__{model}", "__{m}", 1)]
        meta, out = job["meta"], r["output"].strip()
        at = datetime.now(timezone.utc).isoformat()
        if job["exp"] == "copy":
            doc = {**meta, "prompt": job["prompt"], "model": model, "id": r["key"], "model_id": MODEL_IDS[model], "output": out, "at": at}
            path = root / "copy-test/out" / f"{r['key']}.json"
        elif job["exp"] == "messages":
            doc = {"scenario": meta["scenario"], "lang": meta["lang"], "model": model, "message": meta["message"], "raw": out, **extract_json(out)}
            path = root / "messages-test/out" / f"{r['key']}.json"
        else:
            doc = {"line": meta["line"], "market": meta["market"], "model": model, "source": meta["source"], "raw": out, **extract_json(out)}
            path = root / "campaign-test/out" / f"{r['key']}.json"
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        n += 1
print(f"imported {n} outputs")
