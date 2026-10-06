"""Make Sky theme copies of the clay icons: terracotta to sky blue, sand to butter, cream tile to pale blue.

Shapes and shading stay identical; only warm hues are remapped. Other colours pass through.

    python scripts/recolor-sky-icons.py            # writes public/themes/sky/...
    python scripts/recolor-sky-icons.py --sheet    # also writes a before/after contact sheet
"""

import glob
import os
import sys

import numpy as np
from matplotlib.colors import hsv_to_rgb, rgb_to_hsv
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
SOURCES = ['habits/*.webp', 'habits/scenes/*.webp', 'reminders/*.webp', 'medicines/*.webp']
OUT = os.path.join(ROOT, 'themes', 'sky')

SKY_HUE = 200 / 360
BUTTER_HUE = 45 / 360


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def tile_colour(hsv: np.ndarray) -> tuple[float, float]:
    """Hue and saturation of the background tile, read from a band near the middle of each edge.

    Some icons have a thin white margin outside the tile, so pure white is ignored.
    """
    hgt, wid = hsv.shape[:2]
    near, far = wid // 16, wid // 7
    samples = np.concatenate([
        hsv[near:far, wid // 3: 2 * wid // 3].reshape(-1, 3),
        hsv[hgt - far:hgt - near, wid // 3: 2 * wid // 3].reshape(-1, 3),
        hsv[hgt // 3: 2 * hgt // 3, near:far].reshape(-1, 3),
        hsv[hgt // 3: 2 * hgt // 3, wid - far:wid - near].reshape(-1, 3),
    ])
    tinted = samples[samples[:, 1] > 0.03]
    if len(tinted) < len(samples) // 4:
        tinted = samples
    return float(np.median(tinted[:, 0])), float(np.median(tinted[:, 1]))


def recolor(rgb: np.ndarray) -> np.ndarray:
    hsv = rgb_to_hsv(rgb)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Warm hues only (reds, oranges, tans). Greens, blues and greys pass through.
    hue_deg = h * 360
    warm = np.maximum(1 - smoothstep(48, 62, hue_deg), smoothstep(340, 350, hue_deg))

    # One continuous mapping, no thresholds, so textured clay and soft shadows never speckle:
    # tile stays nearly white-blue, sand becomes light blue, terracotta becomes sky blue.
    _, tile_s = tile_colour(hsv)
    sat = np.clip((s - tile_s * 0.6) * 1.3, 0, 0.62)
    val = np.clip(v * 1.04, 0, 1)
    mapped = hsv_to_rgb(np.stack([np.full_like(h, SKY_HUE), sat, val], -1))
    return rgb * (1 - warm[..., None]) + mapped * warm[..., None]


def main():
    files = []
    for pattern in SOURCES:
        files.extend(sorted(glob.glob(os.path.join(ROOT, pattern))))
    pairs = []
    for path in files:
        rel = os.path.relpath(path, ROOT)
        image = Image.open(path).convert('RGB')
        rgb = np.asarray(image, dtype=np.float32) / 255.0
        out = Image.fromarray((recolor(rgb) * 255 + 0.5).clip(0, 255).astype(np.uint8))
        target = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        out.save(target, 'WEBP', quality=86, method=6)
        pairs.append((image, out))
    print(f'wrote {len(pairs)} icons to {os.path.relpath(OUT)}')

    if '--sheet' in sys.argv:
        cell = 160
        cols = 8
        rows = (len(pairs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell * 2, rows * cell), 'white')
        for i, (before, after) in enumerate(pairs):
            x, y = (i % cols) * cell * 2, (i // cols) * cell
            sheet.paste(before.resize((cell, cell)), (x, y))
            sheet.paste(after.resize((cell, cell)), (x + cell, y))
        sheet.save('/tmp/sky-icons-sheet.png')
        print('sheet: /tmp/sky-icons-sheet.png')


if __name__ == '__main__':
    main()
