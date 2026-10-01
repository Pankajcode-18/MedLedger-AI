"""Renders the synthetic reports as page images at three quality levels.

  clean     300 dpi scan
  degraded  a poor phone photo:   ±2° tilt, 2/3 scale, blur, strong uneven light, heavy noise, JPEG 35
  moderate  a careful phone photo: ±1° tilt, 85% scale, light blur, mild uneven light, light noise, JPEG 60

Degraded is drawn before moderate so earlier sets (clean + degraded only) render identically.
Environment: REPORTS (json, default results/ocr_reports.json), OUT (folder, default results/scans),
LEVELS (comma list, default clean,degraded,moderate), LIMIT (first N reports), RENDER_SEED.
"""
import json, os, random, io
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.environ.get('REPORTS', os.path.join(HERE, 'results', 'ocr_reports.json'))))
R = R[: int(os.environ['LIMIT'])] if os.environ.get('LIMIT') else R
OUT = os.environ.get('OUT', os.path.join(HERE, 'results', 'scans')); os.makedirs(OUT, exist_ok=True)
LEVELS = os.environ.get('LEVELS', 'clean,degraded,moderate').split(',')
FONT = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf', 34)
SEED = int(os.environ.get('RENDER_SEED', 6))
random.seed(SEED); np.random.seed(SEED)

PHOTO = {
    'degraded': dict(tilt=2.0, scale=2 / 3, blur=1.1, light=0.82, noise=14, quality=35),
    'moderate': dict(tilt=1.0, scale=0.85, blur=0.7, light=0.90, noise=7, quality=60),
}


def photo(img, p):
    W, H = img.size
    g = img.rotate(random.uniform(-p['tilt'], p['tilt']), fillcolor=255, resample=Image.BICUBIC)
    g = g.resize((int(W * p['scale']), int(H * p['scale'])), Image.BILINEAR).filter(ImageFilter.GaussianBlur(p['blur']))
    a = np.asarray(g).astype(np.float32)
    grad = np.linspace(p['light'], 1.0, a.shape[1])[None, :]
    a = a * grad + np.random.normal(0, p['noise'], a.shape)
    g = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    buf = io.BytesIO(); g.save(buf, 'JPEG', quality=p['quality'])
    return Image.open(io.BytesIO(buf.getvalue()))


for r in R:
    W, H = 2480, 3508  # A4 at 300 dpi
    img = Image.new('L', (W, H), 255); d = ImageDraw.Draw(img)
    y = 200
    for line in r['text'].split('\n'):
        # wrap long narrative lines
        while len(line) > 100:
            cut = line.rfind(' ', 0, 100); d.text((180, y), line[:cut], font=FONT, fill=0); y += 52; line = line[cut + 1:]
        d.text((180, y), line, font=FONT, fill=0); y += 52
    if 'clean' in LEVELS:
        img.save(os.path.join(OUT, f"{r['id']}_clean.png"))
    for level in ('degraded', 'moderate'):
        # always draw the photo so the random stream (and so every image) is the same whichever levels are saved
        g = photo(img, PHOTO[level])
        if level in LEVELS:
            g.save(os.path.join(OUT, f"{r['id']}_{level}.jpg"))
print(len(R), 'reports rendered:', ','.join(LEVELS))
