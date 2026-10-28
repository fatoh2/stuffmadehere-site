"""Scratch: attribute main-thread time at one stop with a Chrome trace (1x, phone emulation).
usage: python -I trace.py <base> <page-path> <y>"""
import json, sys, collections, os, tempfile
from playwright.sync_api import sync_playwright
base, path, y = sys.argv[1], sys.argv[2], int(sys.argv[3])
rate = int(sys.argv[4]) if len(sys.argv) > 4 else 1
tmp = os.path.join(os.environ.get('TEMP', '.'), 'perf-trace.json')
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    if rate != 1: cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
    pg.goto(base + path, wait_until='load'); pg.wait_for_timeout(3000)
    pg.evaluate("(y) => window.scrollTo({top: y, behavior: 'instant'})", y); pg.wait_for_timeout(2500)
    b.start_tracing(page=pg, path=tmp, categories=['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'gpu', 'blink'])
    pg.wait_for_timeout(4000)
    b.stop_tracing()
    b.close()
ev = json.load(open(tmp))
ev = ev['traceEvents'] if isinstance(ev, dict) else ev
names = {}
for e in ev:
    if e.get('ph') == 'M' and e.get('name') == 'thread_name': names[(e['pid'], e['tid'])] = e['args']['name']
agg = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0.0]))
for e in ev:
    if e.get('ph') == 'X' and 'dur' in e:
        t = names.get((e['pid'], e['tid']), '?')
        a = agg[t][e['name']]; a[0] += 1; a[1] += e['dur'] / 1000
tot = {t: sum(v[1] for n, v in d.items() if n in ('RunTask', 'ThreadControllerImpl::RunTask')) for t, d in agg.items()}
print('threads by RunTask ms over ~4 s:', {t: round(v) for t, v in sorted(tot.items(), key=lambda kv: -kv[1])[:8]})
for t in ('CrRendererMain', 'Compositor', 'CompositorTileWorker1', 'CrGpuMain', 'VizCompositorThread'):
    if t in agg:
        print('==', t)
        for n, (c, ms) in sorted(agg[t].items(), key=lambda kv: -kv[1][1])[:14]:
            print(f'   {ms:9.1f} ms {c:6d}x {n}')
