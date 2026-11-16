"""Builds research-log.xlsx from data.py. Re-run after editing prompts (overwrites the file: copy your log out first)."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import data

F = "Arial"
H_FILL = PatternFill("solid", start_color="1F3A5F")
IN_FILL = PatternFill("solid", start_color="FFF7CC")   # cells you fill in
EX_FILL = PatternFill("solid", start_color="EAF2E3")   # example row
thin = Side(style="thin", color="D0D0D0")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical="top")
rtl = Alignment(wrap_text=True, vertical="top", horizontal="right", readingOrder=2)

def header(ws, cols, widths, row=1):
    for i, (c, w) in enumerate(zip(cols, widths), 1):
        cell = ws.cell(row=row, column=i, value=c)
        cell.font = Font(name=F, bold=True, color="FFFFFF"); cell.fill = H_FILL; cell.alignment = wrap; cell.border = BORDER
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=row + 1, column=1)
    ws.row_dimensions[row].height = 32

def body(cell, fill=None, align=wrap):
    cell.font = Font(name=F, size=10); cell.alignment = align; cell.border = BORDER
    if fill: cell.fill = fill

wb = Workbook()

# ---------------- Start here ----------------
ws = wb.active; ws.title = "Start here"
ws.column_dimensions["A"].width = 26; ws.column_dimensions["B"].width = 100
lines = [
    ("Research question", "Where does AI break when we design and write products for Arab users, why does it break, and what should designers and writers do differently?"),
    ("Product you're 'building'", "Qareeb (قريب): a grocery delivery app. Swap [APP] in prompts for another product if you prefer."),
    ("Cities", "Riyadh, Cairo, Casablanca (+ London as a control for imagery). Swap [CITY] in each prompt."),
    ("", ""),
    ("How to use this workbook", ""),
    ("1. Phase 1 prompts", "Run each prompt in ChatGPT, Claude and Gemini (their normal apps), for each city. Try the Arabic version too. Tick the run columns."),
    ("2. Log", "Every time something looks wrong, add a row. One break per row. Screenshot it and paste the link/filename."),
    ("3. Image prompts", "The imagery tests. Run them by hand, or with images/run-images.js (all 7 image models via fal.ai)."),
    ("4. Image tags", "One row per generated image. Fill Y/N for each tag. The Summary tab counts them per city."),
    ("5. Summary", "Updates automatically: breaks by cause and stage, image tags by city."),
    ("6. Causes", "The starting list of 'why it breaks' categories. Edit as you learn; the Log dropdown uses this list."),
    ("", ""),
    ("Cell colours", "Yellow = you fill in · Green = example row (delete or overwrite it) · Blue header = fixed"),
    ("Looking tip", "Don't hunt for errors. Ask: would a real team in this city ship this? What would they change?"),
]
for r, (a, b) in enumerate(lines, 1):
    ws.cell(row=r, column=1, value=a).font = Font(name=F, bold=True, size=11)
    c = ws.cell(row=r, column=2, value=b); c.font = Font(name=F, size=11); c.alignment = wrap
ws["A1"].font = Font(name=F, bold=True, size=13)

# ---------------- Causes ----------------
cs = wb.create_sheet("Causes")
header(cs, ["Cause", "What it means"], [30, 100])
for r, (c, d) in enumerate(data.CAUSES, 2):
    body(cs.cell(row=r, column=1, value=c)); body(cs.cell(row=r, column=2, value=d))
n_causes = len(data.CAUSES)

# ---------------- Log ----------------
lg = wb.create_sheet("Log", 1)
cols = ["ID", "Date", "Phase", "Stage", "City", "Tool / model", "Prompt language", "Prompt ID", "What it produced (short)",
        "What's wrong", "Severity (1–3)", "Cause", "What it would cost a real product", "Fix tried (prompt change)", "Fixed?",
        "Screenshot / file", "Native speaker note"]
header(lg, cols, [6, 11, 7, 11, 12, 14, 10, 9, 40, 40, 9, 24, 34, 30, 9, 22, 30])
example = ["B001", "2026-11-17", "1", "Copy", "Cairo", "ChatGPT", "Arabic", "C2",
           "Onboarding: «سجّل الآن واطلب مقاضيك»",
           "Every verb addresses a man (masculine imperative). No feminine or neutral form.",
           2, "English defaults underneath",
           "About half of users addressed in the wrong gender in the first screen they see.",
           "Asked for a version for any gender", "Partly", "shots/B001.png", "Sara (Cairo): 'Apps always do this, I don't even notice anymore.'"]
for i, v in enumerate(example, 1):
    body(lg.cell(row=2, column=i, value=v), EX_FILL)
LOG_ROWS = 400
for r in range(3, LOG_ROWS + 2):
    lg.cell(row=r, column=1, value=f"B{r-1:03d}").font = Font(name=F, size=10)
    for c in range(2, len(cols) + 1):
        body(lg.cell(row=r, column=c), IN_FILL)
def dv(formula, col):
    v = DataValidation(type="list", formula1=formula, allow_blank=True); lg.add_data_validation(v)
    v.add(f"{col}2:{col}{LOG_ROWS+1}")
dv('"1,2,3,4,5,6"', "C")
dv('"' + ",".join(data.STAGES) + '"', "D")
dv('"' + ",".join(data.CITIES + ["London", "All / none"]) + '"', "E")
dv('"English,Arabic,Both"', "G")
dv('"1,2,3"', "K")
dv(f"=Causes!$A$2:$A${n_causes+1}", "L")
dv('"Yes,Partly,No,Not tried"', "O")
lg.cell(row=1, column=11).comment = None

# ---------------- Phase 1 prompts ----------------
p1 = wb.create_sheet("Phase 1 prompts", 2)
cols = ["ID", "Stage", "Prompt (English)", "Prompt (Arabic)", "What to look for"] + [f"Run: {c}" for c in data.CITIES] + ["Ran in Arabic too", "Logged breaks (IDs)"]
header(p1, cols, [6, 11, 55, 55, 50, 11, 11, 11, 11, 18])
for r, (pid, stage, en, ar, look) in enumerate(data.PHASE1, 2):
    for c, v in enumerate([pid, stage, en, ar, look], 1):
        body(p1.cell(row=r, column=c, value=v), align=rtl if c == 4 else wrap)
    for c in range(6, len(cols) + 1):
        body(p1.cell(row=r, column=c), IN_FILL)
v = DataValidation(type="list", formula1='"✓"', allow_blank=True); p1.add_data_validation(v)
v.add(f"F2:I{len(data.PHASE1)+1}")

# ---------------- Image prompts ----------------
ip = wb.create_sheet("Image prompts", 3)
cols = ["ID", "Test", "Prompt (English)", "Prompt (Arabic)", "Cities", "Models", "What to look for"]
header(ip, cols, [6, 15, 60, 40, 22, 30, 55])
city_label = {"each": "Riyadh, Cairo, Casablanca + London control", "one": "Cairo", "none": "–"}
for r, (iid, test, en, ar, city, models, look) in enumerate(data.IMAGERY, 2):
    vals = [iid, test, en, ar, city_label[city], ", ".join(data.MODEL_GROUPS[models]), look]
    for c, v in enumerate(vals, 1):
        body(ip.cell(row=r, column=c, value=v), align=rtl if c == 4 else wrap)

# ---------------- Image tags (one row per planned image) ----------------
it = wb.create_sheet("Image tags", 4)
fixed = ["Image ID", "Prompt ID", "Test", "City", "Prompt language", "Model", "File"]
cols = fixed + data.IMAGE_TAGS + ["Notes"]
header(it, cols, [30, 8, 14, 11, 9, 12, 34] + [9] * len(data.IMAGE_TAGS) + [40])
rows = []
for iid, test, en, ar, city, models, look in data.IMAGERY:
    cities = data.CITIES + [data.CONTROL_CITY] if city == "each" else (["Cairo"] if city == "one" else ["–"])
    langs = ["en", "ar"] if ar else ["en"]
    for cty in cities:
        for lang in langs:
            if lang == "ar" and cty == data.CONTROL_CITY: continue
            for m in data.MODEL_GROUPS[models]:
                img_id = f"{iid}__{cty if cty != '–' else 'none'}__{lang}__{m}"
                rows.append([img_id, iid, test, cty, lang, m, f"images/out/{img_id}.jpg"])
for r, vals in enumerate(rows, 2):
    for c, v in enumerate(vals, 1):
        body(it.cell(row=r, column=c, value=v))
    for c in range(len(fixed) + 1, len(cols) + 1):
        body(it.cell(row=r, column=c), IN_FILL)
last_img = len(rows) + 1
tag_dv = DataValidation(type="list", formula1='"Y,N,NA"', allow_blank=True); it.add_data_validation(tag_dv)
tag_dv.add(f"{get_column_letter(len(fixed)+1)}2:{get_column_letter(len(fixed)+len(data.IMAGE_TAGS))}{last_img}")
it.auto_filter.ref = f"A1:{get_column_letter(len(cols))}{last_img}"

# ---------------- Summary ----------------
sm = wb.create_sheet("Summary", 1)
sm.column_dimensions["A"].width = 30
for col in "BCDEFGH": sm.column_dimensions[col].width = 13
def title(r, t):
    c = sm.cell(row=r, column=1, value=t); c.font = Font(name=F, bold=True, size=12)
title(1, "Breaks by cause and stage (from Log)")
L = f"$2:${LOG_ROWS+1}"
for i, h in enumerate(["Cause"] + data.STAGES + ["Total"], 1):
    c = sm.cell(row=2, column=i, value=h); c.font = Font(name=F, bold=True, color="FFFFFF"); c.fill = H_FILL; c.border = BORDER
for k in range(n_causes):
    r = 3 + k
    body(sm.cell(row=r, column=1, value=f"=Causes!A{k+2}"))
    for j, stage in enumerate(data.STAGES, 2):
        body(sm.cell(row=r, column=j, value=f'=COUNTIFS(Log!$L$2:$L${LOG_ROWS+1},$A{r},Log!$D$2:$D${LOG_ROWS+1},{get_column_letter(j)}$2)'))
    body(sm.cell(row=r, column=len(data.STAGES) + 2, value=f"=SUM(B{r}:{get_column_letter(len(data.STAGES)+1)}{r})"))
tot = 3 + n_causes
body(sm.cell(row=tot, column=1, value="Total")); sm.cell(row=tot, column=1).font = Font(name=F, bold=True)
for j in range(2, len(data.STAGES) + 3):
    col = get_column_letter(j)
    body(sm.cell(row=tot, column=j, value=f"=SUM({col}3:{col}{tot-1})"))
sm.cell(row=tot + 1, column=1, value="The green example row in Log is counted; delete it once you have real rows.").font = Font(name=F, size=9, italic=True)

start = tot + 3
title(start, "Image tags: share of tagged images marked Y, by city")
hdr = ["Tag"] + data.CITIES + [data.CONTROL_CITY, "No city"]
for i, h in enumerate(hdr, 1):
    c = sm.cell(row=start + 1, column=i, value=h); c.font = Font(name=F, bold=True, color="FFFFFF"); c.fill = H_FILL; c.border = BORDER
city_col = f"'Image tags'!$D$2:$D${last_img}"
for k, tag in enumerate(data.IMAGE_TAGS):
    r = start + 2 + k
    tcol = get_column_letter(len(fixed) + 1 + k)
    rng = f"'Image tags'!${tcol}$2:${tcol}${last_img}"
    body(sm.cell(row=r, column=1, value=tag))
    for j, cty in enumerate(data.CITIES + [data.CONTROL_CITY, "–"], 2):
        f = f'=IFERROR(COUNTIFS({city_col},"{cty}",{rng},"Y")/(COUNTIFS({city_col},"{cty}",{rng},"Y")+COUNTIFS({city_col},"{cty}",{rng},"N")),"")'
        c = sm.cell(row=r, column=j, value=f); body(c); c.number_format = "0%"
sm.cell(row=start + 2 + len(data.IMAGE_TAGS), column=1,
        value="Blank = nothing tagged yet. NA is excluded from the share.").font = Font(name=F, size=9, italic=True)

wb.save("research-log.xlsx")
print(f"saved: {len(data.PHASE1)} phase-1 prompts, {len(data.IMAGERY)} image prompts, {len(rows)} planned images")
