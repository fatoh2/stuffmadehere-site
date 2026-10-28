# What the site costs a phone — 2026-10-26

**Setup.** Chrome 155 headless, 390×844, DPR 3, mobile + touch (the servo scroll does not mount, as on a phone), 144 Hz desktop. Transfer: dev server and a brotli production build (dev adds 10–23 requests, 0.4–0.8 MB). Frames: dev server, 2 s settle, 10 s `__loop()` window per screen, 1× and 4× CPU. Scripts in `docs/perf/`.
**Caveats.** `__loop()` ms is JS time inside the ticker; canvas raster is deferred, so I add main-thread busy (CDP `TaskDuration` / wall time). The machine is shared: the first 4× sweep was disturbed on three home screens (59 / 70 / 26.5 fps; repeat 143 / 143 / 135), so 4× figures come from a second full sweep. `public/parts` has 30 files (28 PNG, 2 JPG), not 29.

## 1. Transfer (cold load, then scroll every screen)

| Page | Requests dev / prod | kB dev / prod | Parts at load | Parts fetched on scroll | Third party (kB) |
|---|---|---|---|---|---|
| index | 96 / 73 | 4888 / 4045 | 9 files, 2050 kB | 9 files, 1055: hoop+pitcher+carriage 665 on reaching screen 1, head 83 (3), cam+launcher 136 (4), geneva+driver+pen 170 (6) | 892: 42 YouTube thumbs (40 at screens 4–5) |
| about | 75 / 62 | 2327 / 1752 | 6 files, 671 | none | 1047: 45 thumbs, **42 at load** |
| ideas | 44 / 26 | 1994 / 1425 | **12 files, 1345** | none | 47 (fonts) |
| log | 40 / 30 | 1657 / 1279 | 4 files, 393, plus 16 frames, 830 (`new Image()` ×16, `projector.ts`) | none | 34 (font) |

Prod code is 23–48 kB; parts are 77% / 38% / 94% of index / about / ideas. Ten largest (kB):
**index** gimbal 456, armlink 298, hoop 286, egg 275, putter 260, pitcher 212, milled.jpg 188, YT maxres 181, buff 180, peeler 176 · **about** YT maxres 234, milled.jpg 188, buff 180, carriage 167, mocam 63, spray 55, YT 36/35/31, font 33 · **ideas** armlink 298, escape 212, milled.jpg 188, ratchet 99, weight 99, anchor 82, servo 81, bob 77, bucket 76, pivot 71 · **log** milled.jpg 188, driver 83, six frames 66–78, geneva 63, crank 59. Dev also lists `@vite/client` 179.

## 2. Frame cost (largest ticker average, ms per call)

| Machine (page, screen) | 1× | 4× | Machine (page, screen) | 1× | 4× |
|---|---|---|---|---|---|
| hoop (home, 1) | 0.19 | 0.66 | balance (ideas, 1) | 0.19 | 1.02 |
| putter (home, 2) | 0.11 | 0.48 | **pantograph** (ideas, 2) | 0.16 | 1.09 |
| gimbal, gantry (home, 3) | 0.03, 0.01 | 0.09, 0.04 | trebuchet (ideas, 3) | 0.23 | 1.35 |
| camshaft (home, 4) | 0.29 | 0.82 | escapement (ideas, 4) | 0.12 | 0.67 |
| geneva, egg (home, 6) | 0.24, 0.03 | 1.07, 0.11 | ratchets (ideas, 5) | 0.20 | 1.57 |
| odometers (home, 7) | 0.02 | 0.07 | painter, mocap, sorter (about) | 0.14, 0.14, 0.18 | 0.75, 0.99, 1.25 |
| peel (home, 8) | 0.34 | 0.82 | projector (log, 1) | 0.25 | 1.58 |

- **No ticker is over 4 ms at 4× repeatably.** Run 1 read camshaft 4.9 and peel 6.2 ms at 26.5 fps; run 2 read 0.82 / 0.82 at 135 fps, re-checks 106 and 134 fps. The camshaft screen is home's most fragile (busy 0.81–0.99 at 4×), not a confirmed failure.
- **One screen is under 50 fps: ideas screen 2 (pantograph), 4×: 46.3 and 45.7 fps in both sweeps, main thread 0.99 busy.** At 1× it is 130.6 fps, 0.90 busy; every other screen is 0.02–0.30 busy at 1× and 0.12–0.82 at 4×, ≥127 fps. Its ticker is only 1.1 ms; the rest is paint plus two GPU pixel read-backs per frame (1× trace: 1.2 s of 4 s). Disabling single calls isolates it: the per-frame `createPattern(milled.jpg)` plate fill. With a flat colour, busy goes 0.80 → 0.15.

## 3. Idle cost

`n` is never 0: tickers stay registered and run every frame (n = frame count, ~1440 per 10 s); what stops is their cost. Not early-returning, on screens that are not theirs:

| Ticker | Avg ms, 1× / 4× | Why |
|---|---|---|
| peel (home) | 0.07–0.34 / 0.22–0.80 | `if (!visible && finished) return`: until the peel is done it runs `getBoundingClientRect`, `clearRect` and a full-skin `drawImage` every frame |
| ratchets (ideas) | 0.10–0.20 / 0.64–1.38 | no gate; 5 canvases redrawn per frame, even at page top |
| drawers (home) | 0.03–0.05 / 0.08–0.30 | no gate |

cnc headings run until their cut ends, then remove themselves. The other 16 tickers read 0.00–0.01 ms off screen.

## 4. Canvas memory (DPR 3; `DPR()` caps canvases at 2)

| Page | Canvases | Attached / detached MiB | Total MiB (load → after scroll) | Largest |
|---|---|---|---|---|
| index | 22 → 25 | 17.4 / 14.0 | **31.4 → 32.0** | peel skin 1170×2532 = **11.3** (uncapped `devicePixelRatio`), `#rig` 5.0, `#peel` 5.0, slip notes 2.3 |
| about | 7 → 10 | 5.2 / 4.0 | 9.1 → 9.7 | painter buffer 2.9, mocap 2.0, sorter 1.9 |
| ideas | 10 | 6.1 / 0.4 | 6.5 | balance 1.75, pantograph 1.66, trebuchet 1.47 |
| log | 1 | 2.1 / 0 | 2.1 | projector 2.1 |

Decoded images, if resident: parts 17.9 / 5.2 / 8.1 / 4.7 MiB; log frames **31.6 MiB**, as much as all of home's canvases.

## Recommendations

**1. Fetch parts only when their section is near** (within 1.5 screens; `onVisible` already takes a `rootMargin`). The hoop trio is the reverse case: 665 kB starts downloading as the user reaches screen 1.

| Page | Parts at first paint, now → with rule | Fetched too early (kB @ screens down) |
|---|---|---|
| index | 2050 → 1169 kB (−881; hoop trio moves in) | gimbal 456 @3, armlink 298 @6, egg 275 @6, putter 260 @2, peeler 176 @8, servo 81 @6 = 1546 |
| ideas | 1345 → 269 kB (−1076) | armlink 298, escape 212, ratchet 99, weight 99, anchor 82, bob 77, bucket 76, pivot 71, pawl 37, pen 25 |
| log | frames 830 → 153 kB (−677; load frames 0–2) | frames 3–15 |
| about | 671 → 653 kB | fine, but 41 sorter thumbs (665 kB, 320×180 shown at 48×27 css px) load at once: the cards are stacked at one point, so `loading="lazy"` sees them as near |

At 1.6 Mbit/s the index parts take 10.5 s now and 6.0 s with the rule (byte arithmetic). On about, ideas and log, `milled.jpg` (188 kB) is fetched only for the `.tag` hint pills; a 680 px copy is about 27–36 kB.

**2. Yes, PNGs should be smaller.** Drawn = largest draw seen in backing px, phone / desktop 1440@2×. WebP q85 sizes are in-memory estimates; check them by eye.

| File | kB | Source | Drawn | WebP same size | WebP at desktop size |
|---|---|---|---|---|---|
| gimbal | 456 | 954×700 | `<img>` 386×279 css | 91 | 66 (at 80%) |
| armlink | 298 | 1110×200 | 473×44 / 953×44 | 37 | 32 |
| hoop | 286 | 547×520 | 219×208 / 295×280 | 65 | 30 |
| egg | 275 | 370×520 | 97×136 / 186×261 | 27 | 9 |
| putter | 260 | 640×311 | 97×47 / 140×68 | 25 | 2 |
| escape | 212 | 520² | 166² / 359² | 57 | 42 |
| pitcher | 212 | 398×480 | 199×240 / 282×340 | 36 | 27 |
| buff | 179 | 360² | 200² / 513² | 19 | 19 |
| peeler | 175 | 828×200 | 330×80 / 261×63 | 23 | 5 |
| carriage | 167 | 472×240 | 173×88 / 228×116 | 15 | 6 |

The nine canvas-drawn ones go 2064 → 304 kB as WebP, → 173 kB resized; their sources are 1.8–6.6× the pixels a phone draws. All 26 canvas-drawn PNGs: 3184 → 487 → 251 kB. Wider desktops need more than the 1440@2× sizes.

**3. Optimise first**
1. **Pantograph**: the only sub-50 fps result. Render the textured plate once, not `createPattern` every frame (0.80 → 0.15 busy, measured).
2. **Peel**: always gate on `visible`; cap the skin canvas at DPR 2 (11.3 → 5.0 MiB, 6.3 of home's 32).
3. **Ratchets and drawers**: gate with `onVisible`; −0.6 to −1.4 ms per frame at 4× on every other ideas screen, −0.3 on home.
4. **Camshaft**: most fragile home screen at 4×; 33 thumbnails also land when it arrives.
5. Then the log projector's 16 eager frames and the about thumbnails.

## After (2026-10-28)

Fixes 1 to 4 were applied (plate painted once; peel, ratchets and drawers gated and the skin capped at
DPR 2; parts fetched through `near()`; WebP renders and a 680 px milled texture for CSS). Same setup,
dev server, parts and textures only:

| Page | At first paint | On scroll |
|---|---|---|
| index | 8 files, 556 kB (was 2050) | 11 files, 300 kB |
| about | 6 files, 110 kB (was 671) | none |
| ideas | 3 files, 239 kB (was 1345) | 10 files, 225 kB |
| log | 3 frames + 3 parts, 231 kB (was 1223) | 13 frames, 673 kB |

Pantograph screen at 4x CPU: 144 fps, heaviest ticker 1.2 ms (was 46 fps). All 28 PNGs: 3722 kB, now
701 kB of WebP at the same pixel sizes.

