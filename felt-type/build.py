"""Build the public site from page.html (the Claude artifact source).

    python3 build.py            # writes ./site, ready to push to the GitHub Pages repo

The artifact host adds the document skeleton itself; a plain web host needs it written out.
For the public site the page also:
  - serves its own fonts, so visitors' browsers never contact a third party;
  - carries a Content-Security-Policy that only runs the page's own script (pinned by hash),
    loads nothing from elsewhere, and sends no network requests;
  - sends no referrer.
"""
import base64
import hashlib
import pathlib
import re
import shutil

here = pathlib.Path(__file__).parent
site = here / 'site'
page = (here / 'page.html').read_text()

# Everything before the first <svg> is head material: title, metas, font links, styles.
cut = page.index('<svg')
head, body = page[:cut].strip(), page[cut:].strip()

# Swap Google Fonts for the copies in ./fonts.
head = re.sub(r'<link rel="preconnect"[^>]*>\n?', '', head)
head = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>', '<link rel="stylesheet" href="fonts/fonts.css">', head)
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
assert 'googleapis' not in head and 'gstatic' not in page.split('<script>')[1]

scripts = re.findall(r'<script>(.*?)</script>', body, re.S)
assert len(scripts) == 1, 'expected exactly one inline script'
digest = base64.b64encode(hashlib.sha256(scripts[0].encode()).digest()).decode()

csp = '; '.join([
    "default-src 'none'",
    f"script-src 'sha256-{digest}'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
])

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="referrer" content="no-referrer">
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

if site.exists():
    shutil.rmtree(site)
(site / 'fonts').mkdir(parents=True)
(site / 'index.html').write_text(doc)
for f in (here / 'fonts').iterdir():
    shutil.copy(f, site / 'fonts' / f.name)
shutil.copy(here / 'README.md', site / 'README.md')
(site / '.nojekyll').write_text('')
print(f'wrote {site}')
