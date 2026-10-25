# Stuff Made Here, a fan’s site

A fan-made concept site for [Stuff Made Here](https://www.youtube.com/@stuffmadehere), Shane Wighton’s channel of machines that won’t let you miss. Every section is driven by a mechanism with simulated physics rather than decorated with one. Six mechanisms come from his videos, six are new.

Not affiliated with Stuff Made Here. Video titles and thumbnails belong to Shane Wighton; thumbnails load from YouTube’s own image URLs. A public launch should have his OK for that use.

Live: https://stuffmadehere.vercel.app (the About page at /about, the prototypes at /ideas, the build log at /log). Source: https://github.com/fatoh2/stuffmadehere-site.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + static build into dist/
npm run preview    # serve dist/
```

No framework, no animation library. Vite + TypeScript, Canvas 2D and plain DOM. The whole site is static: deploy `dist/` anywhere. It is on Vercel (`vercel.json` turns on clean URLs); The GitHub repository is connected to the Vercel project, so every push to `main` deploys to production; `vercel deploy --prod` from this folder publishes the working copy directly when needed.

## Look

Colour by chapter, taken from his own marks: the black-on-pale-grey Stuff Made Here wordmark, and the blue, red and basketball orange of his thumbnails. The hero is a blue anodised plate with the name machined on it: two solid bars of milled aluminium (a photograph) are roughed and finished down to the stencil letters, then polished into crisp type (Saira Stencil One); the machines sit on light shop grey; the video chapter is near black; the method field and the WATCH band are red; the footer returns to blue. Tokens are in `src/styles/tokens.css`.

The machine parts are photoreal renders (`public/parts/*.png`, generated with Higgsfield's GPT Image 2 and background-removed) animated by the same physics as before: the hoop assembly, rail carriage and pitching machine; the gimbal frame; the pick-and-place head; the Geneva wheel and driver; the camshaft lobe; the plotter arm link and pen; the peeler head; the launcher; the buffing wheel; and, for the later machines, a servo, a socket-head pivot, a cast counterweight, a steel bucket, a brass escape wheel, an anchor and a pendulum bob, a ratchet wheel and pawl, a spray head, a motion-capture camera, a diverter paddle and a crank. The arm link is nine-sliced wherever a bar of any length is needed (the pantograph, the trebuchet's beam and legs), and the milled-aluminium photograph fills the balancing plate and the engraving plate. Every mechanism still draws a shaded fallback if a sprite fails to load.

## Where things are

```
index.html                 the home page, readable with script off
about.html                 the About page: Shane, the shop, what he builds, how he works
ideas.html                 Not built yet: six prototypes of machines he has not made, and a vote
log.html                   Build log: the making of this site on a hand-cranked projector
404.html                   No such part: the pick-and-place lays out the pages it does have
api/                       serverless functions: live channel figures, the counted vote
scripts/og.py              renders the share cards into public/og/
src/main.ts                mounts the home page's mechanisms
src/about.ts               mounts the About page's
src/ideas.ts               mounts the prototypes page's
src/log.ts                 mounts the projector
src/lib/sound.ts           the synthesised sound cues and the switch
src/data/portrait.ts       the halftone dots the painting robot sprays (from a thumbnail of his)
src/data/videos.ts         the 41 videos (id, title, date, views, family); regenerate when he uploads
src/mechanisms/            one module per mechanism, each `mount(...)`
src/lib/                   motor axis, PID, spring, pointer velocity, canvas and visibility helpers
src/styles/tokens.css      palette and type roles
src/styles/page.css        layout per section
docs/superpowers/specs/    the approved design document
.taste-skill/direction.json  the art-direction sheet the layout follows
```

## The twelve mechanisms

| Where | Mechanism | From |
| --- | --- | --- |
| Hero | CNC: the name starts as a solid bar of milled aluminium; a roughing pass and a finishing pass leave the letters standing, chips fly, then a buffing pad sweeps each bar and polishes the scalloped part into crisp type | Pumpkin carver, chainsaw robot, the Tormach |
| Won’t let you miss | The hoop: a two-axis rig predicts where your throw lands and drives there under motor limits | Moving hoop (2020), ball-seeking hoop (2022) |
| Won’t let you miss | Blank-cartridge button: hold to chamber, release to fire a ball the hoop catches, which opens the latest video | Explosive bat, axe, nut cracker |
| Top right | Pin-tumbler navigation: one pin stack per section, set at the shear line as you scroll. On phones the same lock in its door form: a deadbolt escutcheon; tap it and the key bow turns, the bolt draws back with a click, and the menu swings in from the edge like a door, the section you are in marked by its set pin | The unpickable locks |
| Everywhere | Servo scroll with detents: the wheel sets a target, a PID loop drives the page, and the top of every section is a notch the page indexes into; a flick carries you one section, leaving takes a push, and the page strains against the stop before it gives. Touch screens get a snap stop per section instead | New |
| Building now | Pick-and-place: a gantry picks the section’s parts off a conveyor and places them | Puzzle machine (2022) |
| Building now | Gimbal-stabilised player: the frame stays level against scroll, cursor shoves, drags and tilt | New |
| All 41 | Camshaft drum: one cam per video on a shaft beside a fixed-height window; turning it sweeps the list and the window follows | New |
| All 41 | Auto-aim launcher: solves a ballistic shot for a random video and throws its card into the preview | Bow, pool cue, guided launcher |
| How a build goes | Geneva drive feeds the slip one stage per index, with the real dwell | New |
| How a build goes | Pen plotter writes each stage’s note in single-stroke lettering with pen lifts | Handwriting forgeries (2023) |
| About | Apple-peel reveal: a blade peels the skin off the text in one continuous strip | Self-peeling apple (2026) |
| Headings | The same cut, from a solid bar of ink, on the hoop and method headings when they first come into view | Pumpkin carver, chainsaw robot, the Tormach |
| The numbers | A riveted machine nameplate; every figure is a set of odometer drums that roll up from zero when the plate comes into view | Every machine in his shop has one |
| Parts drawers | Six drawers in a steel cabinet, one per family of machine, that run out on their slides with a soft close, one at a time, the thumbnails inside as parts in bins | New |
| First visit | The hoop rig homes: each axis runs to its limit switch, clicks, and comes home, once per browser | Every machine powers up this way |

Nothing on the site is a stock block. The numbers are a nameplate with odometer drums, not a tile grid; "How he works" on the About page is an engineering drawing sheet with numbered notes, detail views and a title block, not three columns; the vote on the prototypes page is a control panel with push buttons and counter windows, not a card grid; entrances index into place in four stepper-motor steps rather than fading up; and the trebuchet's log is a printed tape. Type sizes are set in rem throughout, so the whole site scales with the device's font setting.

## The About page's three machines

| Where | Mechanism | From |
| --- | --- | --- |
| Portrait | The painting robot: a carriage on a rail sweeps row by row and sprays his portrait as a halftone, one colour per pass (blue, red, black), 2,449 dots | Wall-painting robot (2021), pumpkin halftones |
| The shop | Eight motion-capture pan heads on the walls follow your pointer, or tour the tools when nobody moves; each head is on its own speed- and acceleration-limited motor, and when all eight agree the point locks and the nearest tool lights up | The eight OptiTrack cameras that aimed the bow |
| What he builds | The sorting line: the 41 videos ride a belt in upload order and diverter gates drop each into its bin (can't miss, toolpaths, explosive, locks, assembly, the rest); every card stays a link | New |

## The prototypes page's six machines ("Not built yet")

| Where | Mechanism | From |
| --- | --- | --- |
| Title | A split-flap board: each letter is a wheel of flaps on its own stepper, stepping through the alphabet until the right flap drops | New |
| Won't let it fall | A table on two speed- and acceleration-limited servos that reads the ball's position and speed and tilts to roll it back; flick the ball or let it shove the ball itself | New, the hoop's promise the other way round |
| Sign small, engrave big | A pantograph (four bars in a parallelogram, one pivot fixed) that engraves whatever you draw on the pad three times larger on the plate; it signs the channel's name first in single-stroke letters | New, after the handwriting plotter |
| A trebuchet that learns | Fires, measures the landing, moves its own counterweight by the secant through its last two shots, and fires again until the ball drops into the bucket you can drag; the release scatters, so it keeps a log | New |
| Days since the last video | An anchor escapement over a thirty-tooth wheel, driven by the pendulum, that lets one tooth past per second; the count is true to the second from the latest upload | New |
| Vote | Ratchet-and-pawl tally counters, one per prototype; a tap turns the wheel a tooth and the pawl drops behind it; counts live in the browser, or on the server when a store is attached | New |

## The build log's machine

| Where | Mechanism | From |
| --- | --- | --- |
| Build log | A hand-cranked film projector: the crank turns a Geneva driver, the four-slot wheel pulls the film one frame per turn with the real dwell, the shutter covers the gate while the film moves; sixteen frames tell the site's own build, cranked by the handle, the film, the wheel, the keys or the buttons | The Geneva from the method section |

Every machine also works from the keyboard: arrows turn the drum and move the trebuchet's bucket, space shoves the ball or has the pitching machine throw, the pantograph signs a typed word, the counters announce their count.

Every mechanism pauses off screen, has a reduced-motion state, and never hides content when script is off. Each one can be run again from its section: Cut it again, Assemble it again, Feed it again, Peel it again.

Every section is one screen tall on a laptop and a phone (the archive window and the tile wall are sized to the viewport). Note for reviewing: the Claude desktop app's browser pane runs no animation frames while it is hidden, so open the site in a normal browser to see the machines move.

## Live parts

Two serverless functions in `api/` make the site live. Both are set up on the production deployment (a YouTube API key and an Upstash Redis store from Vercel's marketplace, named `stuffmadehere-votes`); without them they fall back and the site is unchanged:

- `api/channel.ts` reads the channel's statistics and latest upload from the YouTube Data API when `YOUTUBE_API_KEY` is set in the Vercel project's environment variables (cached an hour at the edge). The nameplate drums and the "days since the last video" escapement follow it.
- `api/vote.ts` keeps the prototypes vote on a Vercel KV store (the Upstash REST variables `KV_REST_API_URL` and `KV_REST_API_TOKEN`), fifty taps a day per address. The panel shows the totals and stops offering a reset.

Sound is off until the visitor switches it on (the lock menu on phones, the panel on the right on desktops); every cue is synthesised, there are no audio files. The share cards in `public/og/` are rendered from the site by `scripts/og.py`; rerun it when the first screens change.

## Updating the videos

`src/data/videos.ts` was generated from the channel’s Videos tab on 2026-10-24. The ledger rows in `index.html` are generated from that file; when it changes, regenerate the rows (the block between the `ledger__year` markers) or re-run the generator in your tooling.
