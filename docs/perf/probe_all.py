"""Scratch: the home page 'all' stop at 4x CPU throttle, repeated, and with the peel ticker not registered
(route-intercepted copy of loop.ts; nothing on disk). Shows whether peel's per-frame work is part of the 26 fps."""
import re, sys
from playwright.sync_api import sync_playwright
import measure as M
BASE = 'http://127.0.0.1:5173/'
def run(b, drop=None, label=''):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=M.UA)
    shim = M.SHIM
    if drop:
        shim = shim + f"if (t.name.startsWith('{drop}')) return () => {{}};\n  "
    def handler(route):
        resp = route.fetch(); body = resp.text()
        body = body.replace('tickers.add(t);', shim + 'tickers.add(t);')
        route.fulfill(response=resp, body=body, headers={k: v for k, v in resp.headers.items() if k.lower() not in ('content-length', 'content-encoding')})
    ctx.route(re.compile(r'/src/lib/loop\.ts'), handler)
    pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg); cdp.send('Performance.enable'); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    pg.goto(BASE, wait_until='load'); pg.wait_for_timeout(3000)
    pg.evaluate("window.scrollTo({top: 3376, behavior: 'instant'})"); pg.wait_for_timeout(2000)
    m = lambda: {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
    a = m(); l0 = pg.evaluate("() => ({t: performance.now(), l: __loop()})"); pg.wait_for_timeout(10000); z = m(); l1 = pg.evaluate("() => ({t: performance.now(), l: __loop()})")
    el = (l1['t'] - l0['t']) / 1000
    top = sorted(l1['l']['tickers'], key=lambda t: -t['avgMs'])[:3]
    print(f"{label:28s} fps={l1['l']['frames']/el:5.1f} busy={(z['TaskDuration']-a['TaskDuration'])/el:.2f} style={(z['RecalcStyleDuration']-a['RecalcStyleDuration'])/el:.3f} layout={(z['LayoutDuration']-a['LayoutDuration'])/el:.3f} top={[(t['name'], t['avgMs']) for t in top]}", flush=True)
    ctx.close()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    for i in (1, 2): run(b, None, f'as shipped #{i}')
    for i in (1, 2): run(b, 'peel', f'peel ticker not registered #{i}')
    b.close()
