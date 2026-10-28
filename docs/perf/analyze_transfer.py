"""Scratch: summarise a transfer-*.json from measure.py."""
import json, sys, os, collections
from urllib.parse import urlparse
d = json.load(open(sys.argv[1]))
PARTS = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'parts')
all_parts = sorted(os.listdir(PARTS))
print('part files on disk:', len(all_parts))
for page, r in d.items():
    reqs = r['requests']
    tot = lambda rs: sum((x.get('body') or 0) + (x.get('head') or 0) for x in rs)
    ok = [x for x in reqs if 'body' in x]
    ext = [x for x in ok if 'stuffmadehere' not in x['url'] and '127.0.0.1' not in x['url']]
    local = [x for x in ok if x not in ext]
    print(f"\n== {page}: {len(reqs)} requests, {len(ok)} sized, total {tot(ok)/1024:.0f} kB (local {tot(local)/1024:.0f} kB, external {tot(ext)/1024:.0f} kB in {len(ext)})")
    byt = collections.defaultdict(lambda: [0, 0])
    for x in ok:
        t = x['type']; byt[t][0] += 1; byt[t][1] += (x['body'] + x['head'])
    print('   by type:', {k: f"{v[0]}x {v[1]/1024:.0f}kB" for k, v in byt.items()})
    print('   failed:', [(x['url'], x.get('failed')) for x in reqs if x.get('failed')])
    print('   non-200:', [(urlparse(x['url']).path, x.get('status')) for x in ok if x.get('status') not in (200, 304)])
    print('   top 10:')
    for x in sorted(ok, key=lambda x: -(x['body'] + x['head']))[:10]:
        print(f"     {(x['body']+x['head'])/1024:8.1f} kB  {x['phase']:9s} {urlparse(x['url']).netloc.replace('127.0.0.1:','')}{urlparse(x['url']).path}")
    parts = [x for x in ok if '/parts/' in x['url']]
    print(f"   parts fetched: {len(parts)} of {len(all_parts)} files, {tot(parts)/1024:.0f} kB")
    byphase = collections.defaultdict(list)
    for x in parts: byphase[x['phase']].append(x)
    for ph, xs in byphase.items():
        print(f"     {ph:9s} {len(xs):2d} files {tot(xs)/1024:6.0f} kB: " + ', '.join(os.path.basename(urlparse(x['url']).path) for x in xs))
    logimgs = [x for x in ok if '/log/' in x['url']]
    if logimgs:
        bp = collections.defaultdict(list)
        for x in logimgs: bp[x['phase']].append(x)
        print(f"   /log images: {len(logimgs)} {tot(logimgs)/1024:.0f} kB; by phase: " + ', '.join(f"{k}:{len(v)}" for k, v in bp.items()))
    ogs = [x for x in ok if '/og/' in x['url']]
    print('   og:', len(ogs))
    byph = collections.defaultdict(lambda: [0, 0])
    for x in ok:
        byph[x['phase']][0] += 1; byph[x['phase']][1] += x['body'] + x['head']
    print('   all requests by phase:', {k: f"{v[0]}x {v[1]/1024:.0f}kB" for k, v in byph.items()})
    print('   steps:', [(s['y'], s['section']) for s in r['steps']])
    for key in ('canvas_load', 'canvas_end'):
        rows = r[key]
        att = sum(c['bytes'] for c in rows if c['attached']); det = sum(c['bytes'] for c in rows if not c['attached'])
        print(f"   {key}: {len(rows)} canvases, attached {att/2**20:.2f} MiB, detached {det/2**20:.2f} MiB, total {(att+det)/2**20:.2f} MiB; heap {r['heap_'+key.split('_')[1]]/2**20 if r.get('heap_'+key.split('_')[1]) else 0:.1f} MiB")
