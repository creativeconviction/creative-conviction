"""Nearest Felt Type feeling for every word, in ConceptNet Numberbatch and in CLIP, side by side."""
import gzip, json, re, sys, pathlib
import numpy as np

S = pathlib.Path(sys.argv[1]); PAGE = pathlib.Path(sys.argv[2])
MODE = sys.argv[3] if len(sys.argv) > 3 else 'compare'
page = PAGE.read_text()
def block(name):
    i = page.index(f'const {name} = {{'); j = page.index('};', i)
    return re.findall(r"'([\w.]+)': '([^']*)'", page[i:j])
listed = {}
for name in ('LEXICON', 'LEXICON_MORE'):
    for k, ws in block(name):
        for w in ws.split(): listed.setdefault(w, k)
fam = lambda k: k.split('.')[0]
table = set(l.split(' ', 1)[0] for l in (S / 'axes.txt').read_text().splitlines()[1:])
STOPS = set(re.search(r"const STOP = new Set\('([^']*)'", page).group(1).split())
BLOCK = set(re.search(r"BLOCK = set\('([^']*)'", (S / 'nearest.py').read_text()).group(1).split())

def clean(M, k=2):
    mu = M.mean(0); U = np.linalg.svd(M - mu, full_matrices=False)[2][:k]
    M = M - mu; M = M - (M @ U.T) @ U
    return M / np.linalg.norm(M, axis=1, keepdims=True)

def space_clip():
    words = json.load(open(S / 'clip_words.json'))
    return words, clean(np.load(S / 'clip_vecs.npy'))

def space_nb():
    kv = {}
    with gzip.open(S / 'numberbatch-en.txt.gz', 'rt') as f:
        next(f)
        for line in f:
            w, rest = line.split(' ', 1)
            if w in table or w in listed: kv[w] = np.array(rest.split(), dtype=np.float32)
    words = list(kv)
    M = np.stack([kv[w] / np.linalg.norm(kv[w]) for w in words])
    return words, clean(M)

def zscores(words, M, leave_out=()):
    idx = {w: i for i, w in enumerate(words)}
    keys = sorted(set(fam(k) for k in listed.values()))
    P, kept = [], []
    for k in keys:
        members = [idx[w] for w, kk in listed.items() if fam(kk) == k and w in idx and w not in leave_out]
        if len(members) < 3: continue
        c = M[members].mean(0); P.append(c / np.linalg.norm(c)); kept.append(k)
    sims = M @ np.stack(P).T
    return idx, kept, (sims - sims.mean(0)) / sims.std(0)

def blend(w_clip=0.5, leave_out=()):
    nbw, nbM = space_nb(); cw, cM = space_clip()
    i1, k1, z1 = zscores(nbw, nbM, leave_out); i2, k2, z2 = zscores(cw, cM, leave_out)
    assert k1 == k2
    out = {}
    for w in set(i1) & set(i2):
        z = (1 - w_clip) * z1[i1[w]] + w_clip * z2[i2[w]]
        o = np.argsort(-z)
        out[w] = (k1[o[0]], z[o[0]], z[o[0]] - z[o[1]], k1[o[1]])
    return out

def classify(words, M, leave_out=()):
    idx = {w: i for i, w in enumerate(words)}
    keys = sorted(set(fam(k) for k in listed.values()))
    P, kept = [], []
    for k in keys:
        members = [idx[w] for w, kk in listed.items() if fam(kk) == k and w in idx and w not in leave_out]
        if len(members) < 3: continue
        c = M[members].mean(0); P.append(c / np.linalg.norm(c)); kept.append(k)
    P = np.stack(P)
    sims = M @ P.T
    zs = (sims - sims.mean(0)) / sims.std(0)
    order = np.argsort(-zs, 1)
    return {w: (kept[order[i, 0]], zs[i, order[i, 0]], zs[i, order[i, 0]] - zs[i, order[i, 1]], kept[order[i, 1]]) for i, w in enumerate(words)}

TEST = ('velvet stinky mildew fluffy marshmallow lullaby glitter tuesday spreadsheet volcano jellyfish cactus '
        'sloth avalanche toddler sneeze whisper thunder razor icicle feather anchor confetti spaghetti fog '
        'heartbreak rollercoaster bubblewrap honey skunk lava snowflake trampoline').split()

if MODE == 'compare':
    nbw, nbM = space_nb(); cw, cM = space_clip()
    # leave the test words out of the feeling centres, so neither space is told the answer
    nb = classify(nbw, nbM, TEST); cl = classify(cw, cM, TEST); bl = blend(0.5, TEST)
    print(f"{'word':14} {'listed as':12} {'numberbatch':20} {'clip':20} {'blend':20}")
    hits = [0, 0, 0]; n = 0
    for w in TEST:
        f = lambda r: f'{r[0]} ({r[1]:.1f})' if r else '-'
        print(f"{w:14} {fam(listed[w]) if w in listed else '':12} {f(nb.get(w)):20} {f(cl.get(w)):20} {f(bl.get(w)):20}")
        if w in listed:
            n += 1
            for j, r in enumerate((nb, cl, bl)): hits[j] += bool(r.get(w)) and r[w][0] == fam(listed[w])
    print('agree with hand-picked:', hits, 'of', n)
else:
    thr, margin = float(sys.argv[4]), float(sys.argv[5])
    res = blend(float(sys.argv[6]) if len(sys.argv) > 6 else 0.5)
    out = {w: r[0] for w, r in res.items()
           if w not in listed and w in table and w not in STOPS and w not in BLOCK and r[1] >= thr and r[2] >= margin}
    json.dump(out, open(S / 'nearest_clip.json', 'w'))
    print(len(out), 'words placed by the blend', file=sys.stderr)
    import random; random.seed(5)
    print(' '.join(f'{w}={k}' for w, k in random.sample(sorted(out.items()), 120)))
