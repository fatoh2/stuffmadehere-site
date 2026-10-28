"""Scratch: repeat the sequential index sweep at 4x up to the camshaft, to see how stable the 'all' stop is."""
from playwright.sync_api import sync_playwright
import measure as M
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    for i in (1, 2):
        print('--- run', i)
        M.sweep_page(b, 'http://127.0.0.1:5173', 'index', '/', 4, only_y=[0, 844, 1688, 2532, 3376])
    b.close()
