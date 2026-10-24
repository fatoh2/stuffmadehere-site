# Stuff Made Here, a fan’s site

A fan-made concept site for [Stuff Made Here](https://www.youtube.com/@stuffmadehere), Shane Wighton’s channel of machines that won’t let you miss. Every section is driven by a mechanism with simulated physics rather than decorated with one. Six mechanisms come from his videos, six are new.

Not affiliated with Stuff Made Here. Video titles and thumbnails belong to Shane Wighton; thumbnails load from YouTube’s own image URLs. A public launch should have his OK for that use.

Live: https://stuffmadehere.vercel.app (the About page is at /about). Source: https://github.com/fatoh2/stuffmadehere-site.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + static build into dist/
npm run preview    # serve dist/
```

No framework, no animation library. Vite + TypeScript, Canvas 2D and plain DOM. The whole site is static: deploy `dist/` anywhere. It is on Vercel (`vercel.json` turns on clean URLs); `vercel deploy --prod` from this folder publishes the current files. To deploy on every push instead, connect the GitHub repository to the Vercel project once in the Vercel dashboard (Project › Settings › Git); the CLI could not make that link.

## Look

Colour by chapter, taken from his own marks: the black-on-pale-grey Stuff Made Here wordmark, and the blue, red and basketball orange of his thumbnails. The hero is a blue anodised plate with the name machined on it: two solid bars of milled aluminium (a photograph) are roughed and finished down to the stencil letters, then polished into crisp type (Saira Stencil One); the machines sit on light shop grey; the video chapter is near black; the method field and the WATCH band are red; the footer returns to blue. Tokens are in `src/styles/tokens.css`.

The machine parts are photoreal renders (`public/parts/*.png`, generated with Higgsfield's GPT Image 2 and background-removed) animated by the same physics as before: the hoop assembly, rail carriage and pitching machine; the gimbal frame; the pick-and-place head; the Geneva wheel and driver; the camshaft lobe; the plotter arm link and pen; the peeler head; the launcher. Every mechanism still draws a shaded fallback if a sprite fails to load.

## Where things are

```
index.html                 the home page, readable with script off
about.html                 the About page: Shane, the shop, what he builds, how he works
src/main.ts                mounts the home page's mechanisms
src/about.ts               mounts the About page's
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
| Top right | Pin-tumbler navigation: one pin stack per section, set at the shear line as you scroll | The unpickable locks |
| Everywhere | Servo scroll with detents: the wheel sets a target, a PID loop drives the page, and the top of every section is a notch the page indexes into; a flick carries you one section, leaving takes a push, and the page strains against the stop before it gives. Touch screens get a snap stop per section instead | New |
| Building now | Pick-and-place: a gantry picks the section’s parts off a conveyor and places them | Puzzle machine (2022) |
| Building now | Gimbal-stabilised player: the frame stays level against scroll, cursor shoves, drags and tilt | New |
| All 41 | Camshaft drum: one cam per video on a shaft beside a fixed-height window; turning it sweeps the list and the window follows | New |
| All 41 | Auto-aim launcher: solves a ballistic shot for a random video and throws its card into the preview | Bow, pool cue, guided launcher |
| How a build goes | Geneva drive feeds the slip one stage per index, with the real dwell | New |
| How a build goes | Pen plotter writes each stage’s note in single-stroke lettering with pen lifts | Handwriting forgeries (2023) |
| About | Apple-peel reveal: a blade peels the skin off the text in one continuous strip | Self-peeling apple (2026) |
| Headings | The same cut, from a solid bar of ink, on the hoop and method headings when they first come into view | Pumpkin carver, chainsaw robot, the Tormach |

## The About page's three machines

| Where | Mechanism | From |
| --- | --- | --- |
| Portrait | The painting robot: a carriage on a rail sweeps row by row and sprays his portrait as a halftone, one colour per pass (blue, red, black), 2,449 dots | Wall-painting robot (2021), pumpkin halftones |
| The shop | Eight motion-capture pan heads on the walls follow your pointer, or tour the tools when nobody moves; each head is on its own speed- and acceleration-limited motor, and when all eight agree the point locks and the nearest tool lights up | The eight OptiTrack cameras that aimed the bow |
| What he builds | The sorting line: the 41 videos ride a belt in upload order and diverter gates drop each into its bin (can't miss, toolpaths, explosive, locks, assembly, the rest); every card stays a link | New |

Every mechanism pauses off screen, has a reduced-motion state, and never hides content when script is off. Each one can be run again from its section: Cut it again, Assemble it again, Feed it again, Peel it again.

Every section is one screen tall on a laptop and a phone (the archive window and the tile wall are sized to the viewport). Note for reviewing: the Claude desktop app's browser pane runs no animation frames while it is hidden, so open the site in a normal browser to see the machines move.

## Updating the videos

`src/data/videos.ts` was generated from the channel’s Videos tab on 2026-10-24. The ledger rows in `index.html` are generated from that file; when it changes, regenerate the rows (the block between the `ledger__year` markers) or re-run the generator in your tooling.
