"""Share cards: render each page's first screen at 1200x630 after its machine has settled, into public/og/.
Run with the dev server up:  python -I scripts/og.py http://localhost:5173
Needs Playwright (python) and an installed Chrome."""
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'og')
os.makedirs(OUT, exist_ok=True)
PAGES = [
    ('home', '/', "() => window.__cnc && window.__cnc.heroMark && window.__cnc.heroMark().polished", 14),
    ('about', '/about.html', "() => (document.querySelector('#paintCount') || {}).textContent?.startsWith('2,449')", 16),
    ('ideas', '/ideas.html', "() => document.querySelectorAll('.flap.is-set').length === document.querySelectorAll('.flap').length", 8),
]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    for name, path, ready, limit in PAGES:
        page = browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        page.goto(BASE + path)
        page.wait_for_load_state('networkidle')
        t0 = time.time()
        while time.time() - t0 < limit:
            try:
                if page.evaluate(ready):
                    break
            except Exception:
                pass
            page.wait_for_timeout(200)
        page.wait_for_timeout(600)
        # the fixed chrome (lock, servo panel) does not belong on a card
        page.add_style_tag(content='.lock, .servo-panel, .replay { visibility: hidden !important; }')
        page.wait_for_timeout(100)
        out = os.path.join(OUT, f'{name}.jpg')
        page.screenshot(path=out, type='jpeg', quality=82, clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
        print('wrote', out, os.path.getsize(out) // 1024, 'KB')
        page.close()
    browser.close()
