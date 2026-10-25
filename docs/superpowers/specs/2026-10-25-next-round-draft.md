# Next round: draft proposals

Date: 2026-10-25. Status: built overnight on 2026-10-25, twelve of thirteen; see the status line under each item and section 14 of the design document.

The site has three pages and twenty-one mechanisms. Everything below is new, carries real content, and
keeps the rule that a component is a machine with simulated physics, never decoration. Effort is for
one session: S under an hour, M a few hours, L a day. "Needs" lists anything outside the code.

## Tier 1: makes the concept a real site

### 1. Live numbers from YouTube
**Status.** Built and live: `api/channel.ts` reads the channel with the owner's YouTube API key; the drums and the escapement follow it. The subscriber drum shows two decimals.
The nameplate's drums and the "days since the last video" escapement currently run on figures scraped on
2026-10-24. A small Vercel serverless function (`api/channel.ts`) would call the YouTube Data API once an
hour, cache the result, and serve subscribers, total views, video count and the latest upload's id, title
and date. The drums would roll to the live figures; the escapement would count from the real last upload;
the video list would gain new rows without a rebuild (titles, ids and dates come straight from the API;
families would be tagged by hand in `videos.ts` and default to "other" for new ones).
- Mechanism: none new; the existing drums and escapement get a live source.
- Needs: a YouTube Data API key in the Vercel project's environment variables (free quota is plenty).
- Effort: M. Risk: low; the static figures stay as the fallback when the API is down.

### 2. A 404 page that is a machine
**Status.** Built: `404.html`, the pick-and-place lays out the three pages; Vercel serves it for any missing path.
Vercel serves `404.html`. Proposed: "No such part": the pick-and-place gantry hunts the empty conveyor for
the part named in the URL, fails to find it, and places a link back to the three pages instead. Honest,
short, and the first thing a mistyped link shows Shane.
- Mechanism: the existing pick-and-place with an "empty feed" mode.
- Effort: S.

### 3. Share cards
**Status.** Built: `scripts/og.py` renders `public/og/*.jpg`; every page carries the tags.
Links pasted into chat or YouTube comments show a preview card. Proposed: one Open Graph image per page,
rendered from the site itself (the machined wordmark on the blue plate, the painted portrait, the split-flap
board) by a script that opens the page in headless Chrome and saves a 1200×630 crop into `public/og/`.
- Mechanism: none; a build script and three `<meta property="og:image">` tags.
- Effort: S.

### 4. Sound, off by default
**Status.** Built: `src/lib/sound.ts`, six synthesised cues, the switch in the lock menu and beside the servo panel. Still needs a human listening pass.
The design document left the sound question open. Proposed: a toggle in the servo panel. Every sound is
synthesised with the Web Audio API, no files: the Geneva's index click, the ratchet's pawl drop, the
cartridge's bang (a filtered noise burst), the CNC spindle (a low whine that follows the cutter's
engagement), the split-flap clatter. Off until switched on, remembered per browser.
- Mechanism: one `sound.ts` module with named cues the existing mechanisms call.
- Effort: M. Risk: taste; every cue needs listening to, which only a person can judge.

### 5. Keyboard and screen-reader pass
**Status.** Built: arrows, space and enter on every machine, a typed word for the pantograph, counts announced, focus rings.
Every machine should work without a pointer: Enter fires the cartridge (it does), arrows turn the drum and
move the trebuchet's bucket, Space shoves the ball, the pantograph takes a typed word and signs it, the
tally counters announce their count. Also a visible focus style on the canvases.
- Effort: M.

## Tier 2: new machines and pages

### 6. "Build log": the site as one of his builds
**Status.** Built: `log.html`, sixteen frames on a hand-cranked projector with a Geneva intermittent, plus an index of the frames.
A fourth page that tells the making of this site the way his videos tell a build: idea, first version,
the parts that failed (the hero that didn't fit, the ball that hid behind the title, the card that landed
to the right of the bin), the fixes, the result. The content already exists in the design document's
rounds 1 to 7. The mechanism: a hand-cranked film projector; the visitor cranks (drag or scroll) and the
reel advances frame by frame through the chapters, each frame a screenshot from that round, with the
sprocket holes, the shutter flicker and the frame counter.
- Mechanism: new, a crank with a flywheel and a Geneva-driven intermittent (the real projector mechanism).
- Needs: the round screenshots, which exist in the session's test folders; they would be copied into the repo.
- Effort: L.

### 7. Tilt the table yourself
**Status.** Built: "Tilt your phone" on the prototypes page, opt-in, with the iOS permission prompt.
On a phone, the balancing table could use the device's orientation: the visitor tilts the phone to upset
the ball and the controller fights back. Opt-in button (iOS asks permission), falls back to flicking.
- Mechanism: the existing table with a second input.
- Effort: S.

### 8. Keep the plate
**Status.** Built: "Keep the plate" downloads the engraving as a PNG with a small mark.
After signing on the pantograph, "Keep the plate" saves the engraved plate as a PNG, with a small
"engraved on stuffmadehere.vercel.app" mark in the corner. Shareable, and the first thing a visitor would
want to do after writing their name.
- Effort: S.

### 9. Homing on first load
**Status.** Built: the hoop rig homes to both limit switches once per browser, about a second, and a throw interrupts it.
Real machines home their axes when powered on: each axis runs to its limit switch, clicks, and backs off.
Proposed for the first load only: the hoop rig, the gantry and the camshaft each home (visible for about
a second) before their sections run. Remembered per browser so it happens once.
- Mechanism: a `home()` on the motor axis and a short choreography.
- Effort: M. Risk: it delays the first interaction; must stay under 1.5 s.

### 10. Parts drawers for the archive
**Status.** Built: a new home-page section, six drawers on their slides, one open at a time, kept to one screen.
The 41 videos on the drum are read in order. A second way in: six drawers, one per family, in a steel
cabinet; pull a drawer (drag or click) and it slides out on its runners with the real inertia of a loaded
drawer, showing that family's thumbnails as parts in bins. The drawer handle shows the count.
- Mechanism: new; a drawer on linear runners with a soft-close damper.
- Effort: M.

## Tier 3: bigger changes

### 11. Page changes as part changes
**Status.** Built: cross-document view transitions along the rail, 300 ms, none under reduced motion.
Moving between the three pages is a browser navigation. With the View Transitions API, the lock's key
could turn, the page slide out along its rail and the next slide in, so the site stays one machine. Falls
back to a plain load where unsupported.
- Effort: M. Risk: easy to overdo; keep it under 400 ms.

### 12. The real vote
**Status.** Built and live: `api/vote.ts` counts on an Upstash Redis store (`stuffmadehere-votes`) attached to the project; the panel shows everyone's totals and no longer offers a reset.
The ratchet counters live in each browser. A Vercel KV store (or a Vercel Postgres table) would make them
real: one write per tap, rate-limited by IP, totals shown on the panel. The page already says the real
site would collect them.
- Needs: a Vercel KV store on the project.
- Effort: M. Risk: abuse; a daily cap per address is enough for a fan site.

### 13. His own words
**Status.** Not built: needs Shane, not code.
The site has no quotations because none were gathered. With his permission, a short pull from one video
per family (his line on failing, on his wife testing, on the Tormach) would give the About page and the
drawing sheet a voice that is his. Needs him, not code.

## Not proposed

- A cursor that becomes a tool, custom scrollbars, parallax, particle backgrounds: decoration.
- A blog, a shop, comments: not this site's job.
- More hero animation: the cut is the hero and it is finished.

## Suggested order

1, 2, 3 and 5 first (they make the concept presentable as a real link), then 6 as the next page, then
7 and 8 as quick wins on the prototypes page. 4 only after listening.
