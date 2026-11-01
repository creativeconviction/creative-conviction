"""Encode everyday words with CLIP's text encoder, so words sit by what they look like rather than what they are."""
import json, re, sys, pathlib, time
import numpy as np
import torch
from transformers import CLIPTokenizer, CLIPTextModelWithProjection

S = pathlib.Path(sys.argv[1]); PAGE = pathlib.Path(sys.argv[2])
page = PAGE.read_text()
words = set(l.split(' ', 1)[0] for l in (S / 'axes.txt').read_text().splitlines()[1:])
for name in ('LEXICON', 'LEXICON_MORE'):
    i = page.index(f'const {name} = {{'); j = page.index('};', i)
    for _, ws in re.findall(r"'([\w.]+)': '([^']*)'", page[i:j]):
        words.update(ws.split())
words = sorted(w for w in words if re.fullmatch(r'[a-z]{2,}', w))
print(len(words), 'words', file=sys.stderr)

name = 'openai/clip-vit-large-patch14'
tok = CLIPTokenizer.from_pretrained(name)
model = CLIPTextModelWithProjection.from_pretrained(name).eval()
torch.set_num_threads(max(1, torch.get_num_threads()))

TEMPLATES = ['{}', 'a photo of {}']
out = np.zeros((len(words), model.config.projection_dim), dtype=np.float32)
t0 = time.time()
with torch.no_grad():
    for b in range(0, len(words), 256):
        batch = words[b:b + 256]
        acc = 0
        for t in TEMPLATES:
            enc = tok([t.format(w) for w in batch], padding=True, return_tensors='pt')
            e = model(**enc).text_embeds
            acc = acc + torch.nn.functional.normalize(e, dim=-1)
        out[b:b + len(batch)] = torch.nn.functional.normalize(acc, dim=-1).numpy()
        if b % 5120 == 0:
            print(f'{b}/{len(words)} {time.time() - t0:.0f}s', file=sys.stderr)
np.save(S / 'clip_vecs.npy', out)
json.dump(words, open(S / 'clip_words.json', 'w'))
print('done', f'{time.time() - t0:.0f}s', file=sys.stderr)
