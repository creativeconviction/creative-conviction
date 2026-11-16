#!/usr/bin/env python3
"""Convert generated PNGs to JPEG, then build one comparison grid per prompt
(rows = city / prompt language, columns = model) in sheets/."""
import json
import pathlib
from PIL import Image, ImageDraw, ImageFont

here = pathlib.Path(__file__).parent
out, sheets = here / "out", here / "sheets"
sheets.mkdir(exist_ok=True)

for png in out.glob("*.png"):
    jpg = png.with_suffix(".jpg")
    Image.open(png).convert("RGB").save(jpg, quality=90)
    png.unlink()  # the JPEG replaces it

P = json.load(open(here / "prompts.json", encoding="utf-8"))
order = [*P["cities"], P["control_city"], "none"]
try:
    font = ImageFont.truetype("DejaVuSans.ttf", 22)
except OSError:
    font = ImageFont.load_default()

W, H, LBL = 480, 300, 34
for pr in P["imagery"]:
    files = sorted(out.glob(f"{pr['id']}__*.jpg"))
    if not files:
        continue
    models = [m for m in P["model_groups"][pr["models"]] if any(f.stem.endswith("__" + m) for f in files)]
    rows = sorted({"__".join(f.stem.split("__")[1:3]) for f in files},
                  key=lambda r: (order.index(r.split("__")[0]) if r.split("__")[0] in order else 9, r))
    sheet = Image.new("RGB", (180 + W * len(models), LBL + (H + LBL) * len(rows)), "white")
    d = ImageDraw.Draw(sheet)
    d.text((8, 6), f"{pr['id']} · {pr['en'][:110]}", fill="black", font=font)
    for c, m in enumerate(models):
        d.text((180 + c * W + 8, LBL + 6), m, fill="black", font=font)
    for r, row in enumerate(rows):
        y = LBL + r * (H + LBL) + LBL
        d.text((8, y + H // 2), row.replace("__", "\n"), fill="black", font=font)
        for c, m in enumerate(models):
            f = out / f"{pr['id']}__{row}__{m}.jpg"
            if f.exists():
                im = Image.open(f).convert("RGB")
                im.thumbnail((W - 8, H))
                sheet.paste(im, (180 + c * W, y))
    sheet.save(sheets / f"{pr['id']}.jpg", quality=85)
print(f"contact sheets → {sheets}")
