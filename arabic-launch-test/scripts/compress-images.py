#!/usr/bin/env python3
"""Convert generated PNGs to JPEG (q90) so outputs fit in git. Safe to re-run."""
import sys, pathlib
from PIL import Image
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'outputs/images')
n = 0
for p in root.rglob('*.png'):
    Image.open(p).convert('RGB').save(p.with_suffix('.jpg'), quality=90)
    p.unlink(); n += 1
print(f'compressed {n} images')
