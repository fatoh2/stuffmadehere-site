"""Scratch harness for docs/perf/2026-10-26-phone-budget.md. Changes nothing in the repo.

  python -I measure.py transfer <base> <out.json>      bytes per request + canvas pixels, one fresh phone per page
  python -I measure.py frames   <base> <out.json> [rate] 2 s settle, then 10 s window of window.__loop() per stop
  python -I measure.py idle     <base> <out.json> [rate] one section in view, every other ticker's cost

Phone = 390x844 CSS px, devicePixelRatio 3, mobile + touch emulation, system Chrome headless.
frames/idle serve a copy of src/lib/loop.ts (route interception, nothing on disk) that names each
ticker after the file that registered it; the timing code is untouched.
"""
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright

PAGES = {'index': '/', 'about': '/about.html', 'ideas': '/ideas.html', 'log': '/log.html'}
VW, VH, DPR = 390, 844, 3
UA = ('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/130.0.0.0 Mobile Safari/537.36')

CANVAS_HOOK = """
(() => {
  const made = [];
  const orig = document.createElement.bind(document);
  document.createElement = function (tag, ...rest) {
    const el = orig(tag, ...rest);
    if (String(tag).toLowerCase() === 'canvas') made.push(new WeakRef(el));
    return el;
  };
  window.__made = made;
  const madeOff = [];
  if (window.OffscreenCanvas) {
    const O = window.OffscreenCanvas;
    window.OffscreenCanvas = class extends O { constructor(...a) { super(...a); madeOff.push(new WeakRef(this)); } };
  }
  window.__madeOff = madeOff;
})();
"""

CANVAS_REPORT = """
() => {
  const rows = [];
  const seen = new Set();
  const label = (cv) => {
    if (cv.id) return '#' + cv.id;
    const own = (cv.className && cv.className.toString().trim().split(/\\s+/)[0]) || '';
    let p = cv.parentElement, anc = '';
    while (p && !anc) { if (p.id) anc = '#' + p.id; else if (p.className && typeof p.className === 'string') anc = '.' + p.className.trim().split(/\\s+/)[0]; p = p.parentElement; }
    return (own ? '.' + own : 'canvas') + ' in ' + (anc || 'body');
  };
  const add = (cv, attached) => {
    if (seen.has(cv)) return;
    seen.add(cv);
    rows.push({ label: label(cv), attached, w: cv.width, h: cv.height, cssW: cv.clientWidth || 0, cssH: cv.clientHeight || 0, bytes: cv.width * cv.height * 4 });
  };
  document.querySelectorAll('canvas').forEach((c) => add(c, true));
  for (const r of window.__made || []) { const c = r.deref(); if (c) add(c, c.isConnected); }
  for (const r of window.__madeOff || []) { const c = r.deref(); if (c) add({ id: '', className: 'OffscreenCanvas', width: c.width, height: c.height, parentElement: null, clientWidth: 0, clientHeight: 0, isConnected: false }, false); }
  return rows;
}
"""

SHIM = ("{ const l = (new Error().stack || '').split('\\n')[2] || '';"
        " const m = l.match(/([\\w.-]+)\\.ts[^:\\s)]*:(\\d+):\\d+\\)?\\s*$/);"
        " if (m) Object.defineProperty(t, 'name', { value: m[1] + ':' + m[2], configurable: true }); }\n  ")


def phone(browser, shim_base=None):
    if os.environ.get('DESKTOP'):  # sizes only: what the largest realistic screen draws, 1440x900 at DPR 2
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    else:
        ctx = browser.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=DPR,
                                  is_mobile=True, has_touch=True, user_agent=UA)
    if shim_base:
        def handler(route):
            resp = route.fetch()
            body = resp.text()
            assert 'tickers.add(t);' in body, 'loop.ts shape changed'
            body = body.replace('tickers.add(t);', SHIM + 'tickers.add(t);')
            headers = {k: v for k, v in resp.headers.items() if k.lower() not in ('content-length', 'content-encoding')}
            route.fulfill(response=resp, body=body, headers=headers)
        ctx.route(re.compile(r'/src/lib/loop\.ts'), handler)
    return ctx


def stops_for(pg):
    """One stop per screen: the sections are all one phone screen tall."""
    max_y = pg.evaluate("Math.max(0, document.documentElement.scrollHeight - innerHeight)")
    ys = list(range(0, max_y, VH if not os.environ.get('DESKTOP') else 900))
    if not ys or ys[-1] != max_y:
        ys.append(max_y)
    return ys


def where(pg, y):
    """Section ids covering the middle of the viewport and the canvases overlapping it."""
    return pg.evaluate("""(y) => {
      const mid = y + innerHeight / 2;
      const secs = [...document.querySelectorAll('header[id], section[id], footer[id], a#watch')];
      const hit = secs.filter(e => { const r = e.getBoundingClientRect(); return r.top + scrollY <= mid && r.bottom + scrollY > mid; }).map(e => e.id);
      const cvs = [...document.querySelectorAll('canvas')].filter(c => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
        .map(c => c.id ? '#' + c.id : '.' + ((c.className||'canvas').toString().split(' ')[0] || 'canvas'));
      return { section: hit.join('+') || '-', canvases: cvs };
    }""", y)


def scroll(pg, y):
    pg.evaluate("(y) => window.scrollTo({ top: y, behavior: 'instant' })", y)


def gc(cdp):
    cdp.send('HeapProfiler.enable')
    cdp.send('HeapProfiler.collectGarbage')


def metrics(cdp):
    return {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}


def transfer(base, out):
    res = {}
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, channel='chrome')
        for name, path in PAGES.items():
            ctx = phone(b)
            ctx.add_init_script(CANVAS_HOOK)
            pg = ctx.new_page()
            cdp = ctx.new_cdp_session(pg)
            cdp.send('Performance.enable')
            phase = {'v': 'load'}
            reqs = {}
            order = []

            def on_req(r):
                if r.url.startswith('data:'):
                    return
                reqs[id(r)] = {'url': r.url, 'type': r.resource_type, 'phase': phase['v']}
                order.append(id(r))

            def on_done(r):
                rec = reqs.get(id(r))
                if rec is None:
                    return
                try:
                    s = r.sizes()
                    resp = r.response()
                    rec.update(body=s['responseBodySize'], head=s['responseHeadersSize'], status=resp.status if resp else None,
                               ctype=(resp.headers.get('content-type', '') if resp else ''), enc=(resp.headers.get('content-encoding', '') if resp else ''))
                except Exception as e:  # noqa: BLE001
                    rec['err'] = str(e)

            def on_fail(r):
                rec = reqs.get(id(r))
                if rec is not None:
                    rec['failed'] = r.failure

            pg.on('request', on_req)
            pg.on('requestfinished', on_done)
            pg.on('requestfailed', on_fail)
            pg.goto(base + path, wait_until='load')
            pg.wait_for_timeout(3500)
            gc(cdp)
            load_canvas = pg.evaluate(CANVAS_REPORT)
            load_heap = metrics(cdp).get('JSHeapUsedSize')
            steps = []
            for y in stops_for(pg):
                phase['v'] = f'y={y}'
                scroll(pg, y)
                pg.wait_for_timeout(2200)
                steps.append({'y': y, **where(pg, y)})
            gc(cdp)
            end_canvas = pg.evaluate(CANVAS_REPORT)
            end_heap = metrics(cdp).get('JSHeapUsedSize')
            res[name] = {'requests': [reqs[i] for i in order], 'steps': steps, 'canvas_load': load_canvas, 'canvas_end': end_canvas,
                         'heap_load': load_heap, 'heap_end': end_heap}
            print(name, len(order), 'requests', flush=True)
            ctx.close()
        b.close()
    json.dump(res, open(out, 'w'), indent=1)


def sweep_page(b, base, name, path, rate, only_y=None, label_prefix=''):
    ctx = phone(b, shim_base=base)
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Performance.enable')
    if rate != 1:
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
    pg.goto(base + path, wait_until='load')
    pg.wait_for_timeout(3000)
    rows = []
    ys = stops_for(pg) if only_y is None else only_y
    for y in ys:
        scroll(pg, y)
        pg.wait_for_timeout(2000)
        loc = where(pg, y)
        m0 = metrics(cdp)
        l0 = pg.evaluate("() => ({ t: performance.now(), sy: scrollY, loop: window.__loop() })")
        pg.wait_for_timeout(10000)
        m1 = metrics(cdp)
        l1 = pg.evaluate("() => ({ t: performance.now(), sy: scrollY, loop: window.__loop() })")
        el = (l1['t'] - l0['t']) / 1000
        loop = l1['loop']
        seen = {}
        tickers = []
        for t in loop['tickers']:
            k = seen.get(t['name'], 0)
            seen[t['name']] = k + 1
            tickers.append({'name': t['name'] + (f'#{k + 1}' if k else ''), 'avgMs': t['avgMs'], 'n': t['n']})
        d = lambda k: (m1[k] - m0[k]) / el  # noqa: E731
        row = {'page': name, 'rate': rate, 'y': y, 'scrollY': l1['sy'], **loc, 'elapsed': round(el, 2), 'frames': loop['frames'],
               'fps': round(loop['frames'] / el, 1), 'lastDt': loop['lastDt'], 'busy': round(d('TaskDuration'), 3),
               'script': round(d('ScriptDuration'), 3), 'layout': round(d('LayoutDuration'), 3), 'style': round(d('RecalcStyleDuration'), 3),
               'tickers': tickers, 'sumMs': round(sum(t['avgMs'] for t in tickers), 2)}
        rows.append(row)
        top = sorted(tickers, key=lambda t: -t['avgMs'])[:3]
        print(f"{name} x{rate} y={y} [{loc['section']}] fps={row['fps']} busy={row['busy']} sum={row['sumMs']}ms top={[(t['name'], t['avgMs']) for t in top]}", flush=True)
    ctx.close()
    return rows


def frames(base, out, rate_arg):
    rates = [1, 4] if rate_arg is None else [int(rate_arg)]
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, channel='chrome')
        for rate in rates:
            for name, path in PAGES.items():
                rows += sweep_page(b, base, name, path, rate)
                json.dump(rows, open(out, 'w'), indent=1)
        b.close()


IDLE_STOP = {'index': 'drawers', 'about': 'work', 'ideas': 'vote', 'log': 'frames'}


def idle(base, out, rate_arg):
    rates = [1, 4] if rate_arg is None else [int(rate_arg)]
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, channel='chrome')
        for rate in rates:
            for name, path in PAGES.items():
                ctx0 = phone(b)
                pg0 = ctx0.new_page()
                pg0.goto(base + path, wait_until='load')
                y = pg0.evaluate("(id) => Math.round(document.getElementById(id).getBoundingClientRect().top + scrollY)", IDLE_STOP[name])
                ctx0.close()
                rows += sweep_page(b, base, name, path, rate, only_y=[y])
                json.dump(rows, open(out, 'w'), indent=1)
        b.close()


DRAW_HOOK = """
(() => {
  const o = CanvasRenderingContext2D.prototype.drawImage;
  const rec = (window.__draws = {});
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    try {
      if (img instanceof HTMLImageElement && img.src.includes('/parts/')) {
        let dw, dh;
        if (a.length === 2) { dw = img.naturalWidth; dh = img.naturalHeight; }
        else if (a.length === 4) { dw = a[2]; dh = a[3]; }
        else { dw = a[6]; dh = a[7]; }
        const m = this.getTransform();
        const cv = this.canvas;
        const k = cv.clientWidth ? cv.width / cv.clientWidth : 1; // backing px per css px
        const devW = Math.abs(dw) * Math.hypot(m.a, m.b), devH = Math.abs(dh) * Math.hypot(m.c, m.d);
        const key = img.src.split('/').pop();
        const r = (rec[key] ||= { srcW: img.naturalWidth, srcH: img.naturalHeight, devW: 0, devH: 0, k, cssW: 0, cssH: 0, n: 0, canvases: [], partial: a.length > 4 });
        r.n++;
        if (devW > r.devW) { r.devW = devW; r.cssW = devW / k; }
        if (devH > r.devH) { r.devH = devH; r.cssH = devH / k; }
        r.k = k;
        const id = cv.id ? '#' + cv.id : '.' + ((cv.className || 'canvas').toString().split(' ')[0] || 'canvas');
        if (!r.canvases.includes(id)) r.canvases.push(id);
      }
    } catch (e) {}
    return o.call(this, img, ...a);
  };
})();
"""

DOM_SIZES = """
() => {
  const out = {};
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  out['gimbal.png'] = box('.gimbal__ring');
  out['head.png'] = box('.gantry__head');
  out['plate-blue.jpg'] = box('.hero');
  out['milled.jpg'] = box('.plate');
  return out;
}
"""


def sizes(base, out):
    res = {}
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, channel='chrome')
        for name, path in PAGES.items():
            ctx = phone(b)
            ctx.add_init_script(DRAW_HOOK)
            pg = ctx.new_page()
            pg.goto(base + path, wait_until='load')
            pg.wait_for_timeout(3000)
            for y in stops_for(pg):
                scroll(pg, y)
                pg.wait_for_timeout(3500)
            res[name] = {'draws': pg.evaluate("() => window.__draws"), 'dom': pg.evaluate(DOM_SIZES)}
            print(name, len(res[name]['draws']), 'sprites drawn', flush=True)
            ctx.close()
        b.close()
    json.dump(res, open(out, 'w'), indent=1)


if __name__ == '__main__':
    mode, base, out = sys.argv[1], sys.argv[2], sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else None
    {'transfer': lambda: transfer(base, out), 'frames': lambda: frames(base, out, rate), 'idle': lambda: idle(base, out, rate), 'sizes': lambda: sizes(base, out)}[mode]()
