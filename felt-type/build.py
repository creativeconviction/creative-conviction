"""Wrap page.html (the Claude artifact source) into a stand-alone index.html for GitHub Pages.

    python3 build.py [out_dir]

The artifact host adds the document skeleton itself; a plain web host needs it written out.
"""
import pathlib
import sys

here = pathlib.Path(__file__).parent
out_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here
page = (here / 'page.html').read_text()

# Everything before the first <svg> is head material: title, metas, font links, styles.
cut = page.index('<svg')
head, body = page[:cut].strip(), page[cut:].strip()

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Type something perfectly ordinary and the letters will overreact on your behalf.">
<style>
:root {{ padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }}
body {{ margin: 0; }}
img {{ max-width: 100%; }}
</style>
{head}
</head>
<body>
{body}
</body>
</html>
"""
out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / 'index.html').write_text(doc)
print(f'wrote {out_dir / "index.html"}')
