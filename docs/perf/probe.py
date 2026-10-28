# Scratch: section offsets/heights at 390x844 so the sweep knows where to stop.
import json
from playwright.sync_api import sync_playwright
BASE = 'http://127.0.0.1:5173'
PAGES = {'index': '/', 'about': '/about.html', 'ideas': '/ideas.html', 'log': '/log.html'}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    for name, path in PAGES.items():
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.goto(BASE + path, wait_until='load')
        pg.wait_for_timeout(2500)
        r = pg.evaluate("""() => {
          const out = {vh: innerHeight, docH: document.documentElement.scrollHeight, secs: []};
          document.querySelectorAll('header[id], section[id], footer[id], a#watch').forEach(el => {
            const r = el.getBoundingClientRect();
            out.secs.push({id: el.id, tag: el.tagName, top: Math.round(r.top + scrollY), h: Math.round(r.height)});
          });
          out.canvases = [...document.querySelectorAll('canvas')].map(c => ({id: c.id, cls: c.className, w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, top: Math.round(c.getBoundingClientRect().top + scrollY)}));
          return out;
        }""")
        print(name, json.dumps(r, indent=None))
        ctx.close()
    b.close()
