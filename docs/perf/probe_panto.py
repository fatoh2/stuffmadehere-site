"""Scratch: which draw call makes the ideas 'sign' stop cost ~90% of the main thread? Each variant
disables one call in the page (init script only) and re-reads main-thread busy over 6 s."""
from playwright.sync_api import sync_playwright
BASE = 'http://127.0.0.1:5173/ideas.html'
VARIANTS = {
  'as shipped': '',
  'createPattern -> null (flat plate)': "CanvasRenderingContext2D.prototype.createPattern = function () { return null; };",
  'skip drawImage(canvas source)': "(() => { const o = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (s, ...a) { if (s instanceof HTMLCanvasElement) return; return o.call(this, s, ...a); }; })();",
  'skip drawImage(image source)': "(() => { const o = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (s, ...a) { if (s instanceof HTMLImageElement) return; return o.call(this, s, ...a); }; })();",
}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    for name, js in VARIANTS.items():
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        if js: ctx.add_init_script(js)
        pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg); cdp.send('Performance.enable')
        pg.goto(BASE, wait_until='load'); pg.wait_for_timeout(3000)
        pg.evaluate("window.scrollTo({top: 1688, behavior: 'instant'})"); pg.wait_for_timeout(2500)
        m = lambda: {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        a = m(); t0 = pg.evaluate('performance.now()'); pg.wait_for_timeout(6000); z = m(); t1 = pg.evaluate('performance.now()')
        el = (t1 - t0) / 1000
        print(f"{name:40s} busy={(z['TaskDuration']-a['TaskDuration'])/el:.2f}", flush=True)
        ctx.close()
    b.close()
