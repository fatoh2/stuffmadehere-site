"""Scratch: for each part render, what the phone and a 1440x900@2x desktop draw at, and what re-encoding
or resizing would save. Encodes in memory only; writes nothing."""
import io, json, os, sys
from PIL import Image
PARTS = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'parts')
def load(p):
    d = json.load(open(p)); agg = {}
    for page, r in d.items():
        for k, v in r['draws'].items():
            a = agg.setdefault(k, {'devW': 0, 'devH': 0, 'cssW': 0, 'cssH': 0})
            a['devW'] = max(a['devW'], v['devW']); a['devH'] = max(a['devH'], v['devH'])
            a['cssW'] = max(a['cssW'], v['cssW']); a['cssH'] = max(a['cssH'], v['cssH'])
    return agg
phone, desk = load(sys.argv[1]), load(sys.argv[2])
def enc(im, fmt='WEBP', **kw):
    b = io.BytesIO(); im.save(b, fmt, **kw); return b.tell()
rows = []
for f in sorted(os.listdir(PARTS), key=lambda f: -os.path.getsize(os.path.join(PARTS, f))):
    if not f.endswith('.png'): continue
    path = os.path.join(PARTS, f); im = Image.open(path).convert('RGBA'); W, H = im.size
    size = os.path.getsize(path)
    p, d = phone.get(f), desk.get(f)
    if not p or not d: rows.append((f, size, W, H, None)); continue
    def need(a):  # scale the render must keep to cover the largest draw (device px) with 10% headroom
        return min(1.0, 1.1 * max(a['devW'] / W, a['devH'] / H))
    sd, sp = need(d), need(p)
    def resized(s):
        return im if s >= 0.999 else im.resize((max(1, round(W * s)), max(1, round(H * s))), Image.LANCZOS)
    rows.append((f, size, W, H, dict(webp_same=enc(im, quality=85, method=6), webp_desk=enc(resized(sd), quality=85, method=6), webp_phone=enc(resized(sp), quality=85, method=6),
                                     desk=(round(d['devW']), round(d['devH'])), phone=(round(p['devW']), round(p['devH'])), sd=sd, sp=sp)))
tot = {'orig': 0, 'webp_same': 0, 'webp_desk': 0, 'webp_phone': 0}
print(f"{'file':13s}{'orig kB':>8s}{'src':>10s}{'phone max dev px':>18s}{'desktop max dev px':>20s}{'webp same':>10s}{'webp @desk':>11s}{'webp @phone':>12s}")
for f, size, W, H, e in rows:
    if e is None:
        print(f"{f:13s}{size/1024:8.0f}{W:>6d}x{H:<4d}  (not drawn on a canvas)"); continue
    print(f"{f:13s}{size/1024:8.0f}{W:>6d}x{H:<4d}{str(e['phone']):>18s}{str(e['desk']):>20s}{e['webp_same']/1024:10.0f}{e['webp_desk']/1024:11.0f}{e['webp_phone']/1024:12.0f}")
    tot['orig'] += size; tot['webp_same'] += e['webp_same']; tot['webp_desk'] += e['webp_desk']; tot['webp_phone'] += e['webp_phone']
print({k: f"{v/1024:.0f} kB" for k, v in tot.items()})
big = [r for r in rows if r[1] > 150 * 1024 and r[4]]
print('over 150 kB:', {k: f"{sum(r[4][k] if k != 'orig' else r[1] for r in big)/1024:.0f} kB" for k in ('orig', 'webp_same', 'webp_desk', 'webp_phone')}, len(big), 'files')
for f in ('milled.jpg', 'plate-blue.jpg'):
    im = Image.open(os.path.join(PARTS, f)); print(f, im.size, os.path.getsize(os.path.join(PARTS, f)) // 1024, 'kB')
