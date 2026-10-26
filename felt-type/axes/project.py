"""Project common English words onto feeling axes defined by opposite word groups (semantic projection)."""
import json, re, sys, pathlib
import numpy as np
import pycountry
from gensim.models import KeyedVectors
from wordfreq import zipf_frequency as Z

S = pathlib.Path(sys.argv[1])
import gzip
class KV(dict):
    pass
kv = KV()
order = []
with gzip.open(S / 'numberbatch-en.txt.gz', 'rt') as f:
    next(f)
    for line in f:
        w, rest = line.split(' ', 1)
        if not re.fullmatch(r'[a-z]{2,}', w) or Z(w, 'en') < 2.6: continue
        kv[w] = np.array(rest.split(), dtype=np.float32)
        order.append(w)
order.sort(key=lambda w: -Z(w, 'en'))

AXES = {
    # name: (positive pole, negative pole)
    'valence':     ('good happy joy love wonderful pleasant beautiful nice delight glad cheerful lovely',
                    'bad sad misery hate terrible unpleasant ugly nasty horrible awful gloomy disgusting'),
    'arousal':     ('excited frantic wild furious thrilled intense panic energetic explosive frenzy hectic',
                    'calm relaxed sleepy quiet peaceful still tranquil serene gentle lazy drowsy'),
    'weight':      ('heavy massive dense solid thick iron stone bulky weighty lead',
                    'light airy feather weightless thin delicate flimsy fluffy floating paper'),
    'softness':    ('soft gentle smooth round fluffy tender velvet mellow cushion silky cuddly',
                    'sharp hard rough jagged harsh spiky rigid brittle abrasive pointed blade'),
    'speed':       ('fast quick rapid swift rush hurry speedy racing sprint instant zoom',
                    'slow sluggish gradual leisurely crawl idle unhurried lingering plodding stagnant'),
    'size':        ('big huge giant enormous vast large massive immense tremendous colossal',
                    'small tiny little minute miniature petite microscopic minuscule teeny compact'),
    'temperature': ('hot warm fire burning heat sunny scorching boiling summer blazing',
                    'cold cool ice frozen chilly freezing frost winter icy snow'),
}

STOP = set('''a an the and or but if of to in on at by for with from into onto as is are was were be been being am it its
this that these those there their they them then than what when where which while who whom whose why how i me my mine we us
our ours you your yours he him his she her hers not no yes so do does did done have has had could would should will shall can
may might must about after before over under again further once here all any both each few more most other some such only own
same too very just also s t don now one two three four five six seven eight nine ten first second said says get got go went
make made like well back even still way because through during out up down off around per via upon'''.split())

# Words never styled from vectors: names, places and peoples, beliefs, identities. Vectors learn stereotypes about them.
IDENTITY = set('''man men woman women boy boys girl girls male female males females gay lesbian bisexual transgender trans queer
straight lgbt lgbtq homosexual heterosexual nonbinary black blacks white whites asian asians african africans hispanic hispanics latino
latina latinos latinas arab arabs jew jews jewish muslim muslims islam islamic christian christians christianity catholic catholics
protestant hindu hindus hinduism buddhist buddhists buddhism sikh sikhs atheist atheists mormon mormons immigrant immigrants refugee
refugees native natives indigenous aboriginal tribal ethnic ethnicity race racial disabled disability blind deaf autistic autism
elderly old young teen teens teenager teenagers child children kid kids baby babies mother father mom dad sister brother wife husband
daughter son aunt uncle grandmother grandfather girlfriend boyfriend gender sex sexual sexuality caucasian negro colored oriental
gypsy gypsies roma slave slaves poor rich fat thin obese skinny short tall'''.split())
page = pathlib.Path('/home/user/creative-conviction/felt-type/page.html').read_text()
KEEP = set(re.findall(r"[a-z]+", ' '.join(re.findall(r"'[\w.]+': '([^']*)'", page))))
IDENTITY.update('''american americans british brits english french german germans italian italians spanish portuguese dutch irish scottish scots welsh
russian russians chinese japanese korean koreans indian indians pakistani pakistanis bangladeshi afghan afghans iranian iranians iraqi iraqis
syrian syrians turkish turks greek greeks egyptian egyptians israeli israelis palestinian palestinians lebanese saudi saudis yemeni emirati
qatari kuwaiti jordanian moroccan moroccans algerian tunisian libyan sudanese ethiopian ethiopians somali somalis kenyan kenyans nigerian
nigerians ghanaian senegalese congolese ugandan rwandan tanzanian zimbabwean zambian angolan mozambican malagasy mexican mexicans cuban
cubans haitian haitians jamaican jamaicans dominican colombian colombians venezuelan peruvian chilean argentine argentinian bolivian
ecuadorian paraguayan uruguayan brazilian brazilians canadian canadians australian australians aussie kiwi kiwis filipino filipinos filipina
vietnamese thai cambodian laotian burmese malaysian indonesian singaporean nepalese tibetan mongolian kazakh uzbek ukrainian ukrainians
polish poles czech czechs slovak hungarian romanian romanians bulgarian serbian serbs croatian croats bosnian albanian slovenian macedonian
swedish swedes norwegian norwegians danish danes finnish finns icelandic icelanders scandinavian scandinavians swiss austrian belgian
european europeans latin balkan balkans slavic slavs nordic celtic celts anglo saxon saxons yankee yankees asiatic persian persians kurdish
kurds armenian armenians georgian chechen tatar tatars inuit eskimo eskimos bedouin berber zulu maori cherokee navajo apache sioux
westerner westerners easterner easterners northerner southerner africa asia europe america americas oceania'''.split())
for c in pycountry.countries:
    for name in [c.name] + [getattr(c, 'common_name', '')]:
        for w in re.findall(r'[a-z]+', name.lower()):
            IDENTITY.add(w)
for line in (S / 'first-names.txt').read_text().split() + (S / 'last-names.txt').read_text().split():
    w = line.strip().lower()
    if w and Z(w, 'en') < 5.0 and w not in KEEP:           # keep names that are mostly everyday words (hope, joy, grace, rose)
        IDENTITY.add(w)
DEMONYM_ENDINGS = ('ian', 'ese', 'ish', 'ean', 'ans', 'ians')
for w in []:
    if w.endswith(DEMONYM_ENDINGS) and any(w.startswith(c[:max(4, len(c) - 2)]) for c in list(IDENTITY)[:0]):
        IDENTITY.add(w)

def unit(v): return v / np.linalg.norm(v)
def pole(words):
    vs = [unit(kv[w]) for w in words.split() if w in kv]
    return np.mean(vs, axis=0)

vocab = []
for w in order:
    if not re.fullmatch(r'[a-z]{2,}', w) or w in STOP or w in IDENTITY: continue
    if Z(w, 'en') < 2.6: continue
    vocab.append(w)
M = np.stack([unit(kv[w]) for w in vocab])
mu = M.mean(axis=0)
U = np.linalg.svd(M - mu, full_matrices=False)[2][:2]
def clean(x): x = x - mu; return x - (x @ U.T) @ U
M = M - mu; M = M - (M @ U.T) @ U
M = M / np.linalg.norm(M, axis=1, keepdims=True)

out = {}
scores = {}
for name, (pos, neg) in AXES.items():
    axis = unit(clean(pole(pos)) - clean(pole(neg)))
    raw = M @ axis
    z = (raw - raw.mean()) / raw.std()
    scores[name] = np.clip(z / 2.6, -1, 1)

names = list(AXES)
lines = []
for i, w in enumerate(vocab):
    vals = [int(round(scores[n][i] * 99)) for n in names]
    lines.append(w + ' ' + ' '.join(str(v) for v in vals))
(S / 'axes.txt').write_text('# ' + ' '.join(names) + '\n' + '\n'.join(lines) + '\n')
print(len(vocab), 'words', (S / 'axes.txt').stat().st_size // 1024, 'KB', file=sys.stderr)

def show(w):
    if w not in vocab: return f'{w}: (not in table)'
    i = vocab.index(w)
    return w + ': ' + ' '.join(f'{n[:4]}={scores[n][i]:+.2f}' for n in names)
for w in 'stinky annoying happy furious sleepy sister whisper thunder feather anchor hurricane snail velvet razor ice sunshine grief tuesday glacier giggle'.split():
    print(show(w))
for n in names:
    order = np.argsort(scores[n])
    print(f'\n{n} top: ', ' '.join(vocab[i] for i in order[-14:][::-1]))
    print(f'{n} bottom:', ' '.join(vocab[i] for i in order[:14]))
