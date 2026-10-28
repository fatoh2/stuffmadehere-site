"""Scratch: summarise frames-*.json / idle-*.json from measure.py."""
import json, sys, collections
rows = json.load(open(sys.argv[1]))
mode = sys.argv[2] if len(sys.argv) > 2 else 'frames'
base = lambda n: n.split('#')[0].split(':')[0]
MACH = {'hoop': 'hoop rig', 'putter': 'putter', 'pickplace': 'gantry', 'gimbal': 'gimbal', 'camshaft': 'camshaft+launcher', 'geneva': 'geneva printer',
        'egg': 'egg arm', 'peel': 'apple peel', 'cnc': 'cnc heading', 'odometer': 'odometers', 'drawers': 'drawers', 'painter': 'painter', 'mocap': 'mocap',
        'sorter': 'sorter', 'balance': 'balance table', 'pantograph': 'pantograph', 'trebuchet': 'trebuchet', 'escapement': 'escapement', 'ratchet': 'tally ratchets',
        'projector': 'projector', 'servo': 'servo scroll', 'loop': 'loop?', 'anon': 'anon'}
print('--- per stop')
for r in rows:
    top = sorted(r['tickers'], key=lambda t: -t['avgMs'])[:3]
    print(f"{r['page']:5s} x{r['rate']} y={r['y']:5d} {r['section']:10s} fps={r['fps']:6.1f} busy={r['busy']:.2f} script={r['script']:.2f} layout={r['layout']:.3f} style={r['style']:.3f} sum={r['sumMs']:5.2f}ms "
          + ' '.join(f"{base(t['name'])}={t['avgMs']}" for t in top))
if mode == 'frames':
    print('\n--- per ticker: max avgMs over stops, with where')
    best = {}
    for r in rows:
        for t in r['tickers']:
            k = (r['page'], t['name'], r['rate'])
            if k not in best or t['avgMs'] > best[k][0]:
                best[k] = (t['avgMs'], r['y'], r['section'], t['n'])
    names = sorted({(k[0], k[1]) for k in best})
    for page, name in names:
        a = best.get((page, name, 1), (None,)); b = best.get((page, name, 4), (None,))
        print(f"{page:5s} {name:16s} {MACH.get(base(name), '?'):18s} 1x max {a[0]} @y={a[1] if len(a)>1 else ''} {a[2] if len(a)>2 else ''} | 4x max {b[0]} @y={b[1] if len(b)>1 else ''} {b[2] if len(b)>2 else ''}")
    print('\n--- flags')
    for r in rows:
        if r['rate'] == 4:
            for t in r['tickers']:
                if t['avgMs'] > 4: print('TICKER>4ms@4x', r['page'], r['y'], r['section'], t)
        if r['fps'] < 50: print('FPS<50', r['page'], f"x{r['rate']}", r['y'], r['section'], r['fps'])
