# Stuff Made Here, concept site: design

Date: 2026-10-24. Status: draft for approval.

## 1. What this is, and why

A fan-made concept website for Stuff Made Here, the YouTube channel of engineer Shane Wighton (41 videos since March 2020, about 4.8 million subscribers). The first audience is Shane himself. If he likes it, the same code grows into a real site with real visitors.

His videos are about automatic machines that do the hard part for you: a hoop that moves so you can't miss, a bow that aims itself, a golf club that corrects your swing, a robot barber, a bat powered by blank cartridges. Ten of the 41 videos are about not being able to miss. That is the channel's signature and it is the idea of this site:

> On this page, Shane's machines that won't let you miss become the interface. Every control aims itself. The visitor supplies the intent; the machine lands it.

The site must behave like one of his builds, not look like one. Its components are mechanisms with simulated physics (motor profiles, a control loop, cam geometry, projectile prediction, a toolpath), driven by the visitor and running on their own when nobody is touching them. Half come from specific videos; half are new mechanisms he has not built, there to tempt him.

## 2. Goals, non-goals, anti-goals

Goals

- Twelve mechanisms, each carrying real content, each believable to someone who builds real machines.
- Works with a thumb on a phone, with a wheel on a desktop, and with a keyboard.
- Built so it can become the real site: content in one data file, every mechanism a self-contained module.

Non-goals (for this version)

- No backend, accounts, comments, shop, newsletter or CMS.
- No video hosting; videos are YouTube embeds and links.
- Not a copy of the YouTube channel page, and not a portfolio template with gears drawn on it.

Anti-goals (a failure even if it works)

- It looks like a template, or like anything either of us has seen before.
- Decorative mechanics: a gear that spins for no reason, physics that is faked with keyframes.
- A playground: a mechanism that does not carry content, or that blocks reading.
- Anything that could be mistaken for an official site. It says "made by a fan" plainly.

## 3. Constraints and decisions already made

Stack (decided with you): Vite + vanilla TypeScript. Canvas 2D and plain DOM. No UI framework, no animation library; springs, motors and the control loop are written by hand (they are small). Deploys as static files anywhere.

Content: his real videos only. For each of the 41: title, upload date, YouTube video ID, an approximate view count (used for lobe heights and tile sizes, shown as "about 28M"), and a family tag (can't miss, explosive, toolpath, lock, assembly, other). Facts about Shane come from public sources already gathered (former Formlabs engineering lead, mechanical engineering and computer science degrees, five patents, 17,342 lb of tools, channel start 2020-03-04). No invented quotes, reviews or numbers.

Pictures: the video thumbnails are the only pictures of his work and they are loaded from YouTube's own image URLs. They are used large and few. A public launch needs Shane's OK for that use; the concept does not. Public-domain engravings of mechanisms (Henry T. Brown, "507 Mechanical Movements", 1868) may appear beside the method section, credited.

Look: the art direction was dealt by the design skill and is stored in `.taste-skill/direction.json`. Direction "Type and nothing else": one dark field for the whole page, one ink, one accent, Chivo in heavy capitals for display and two sizes doing the work. Two adjustments, both mine: the dealt navy and pink palette is replaced by colours from the subject (near-black anodised ground, bare-aluminium off-white ink, basketball orange accent, since orange is the rim and the ball in the videos that define him), and the showcase section is redrawn to a composition that can hold a video.

Performance: every mechanism pauses when off screen; 60 fps on a mid-range phone; total script under 150 KB compressed. Accessibility: all content is in the HTML and readable with script off; every mechanism has a reduced-motion version (final state, opacity only); every control works with a keyboard; no mechanism ever covers text that is being read.

## 4. The page, top to bottom

One long page. Sections in the order of the argument: who he is and what he does, what he is building now, everything he has built, how he works, the numbers, the person, the one action, the sign-off. Each section has a different composition from its neighbours. The visual sheet in `.taste-skill/direction.json` gives the exact geometry of each; this document gives the content and the mechanism.

### Navigation: the pin-tumbler lock (new use of the two unpickable-lock videos)

No navigation bar. Top-left, the wordmark at small size. Top-right, a small lock cylinder drawn in ink with one pin stack per section. As the visitor scrolls, the key slides in and each pin stack rises; a stack sits at the shear line when its section is on screen. Clicking or tapping a pin drives the page to that section (through the servo scroll below). On a phone the cylinder is the one menu control; tapping it opens the list of sections as plain text. Keyboard: the pins are buttons in a list.

### Hero: "Won't let you miss"

The statement in two lines, display size, spanning the full width, in ink on the dark field, as the direction sets it. Line one flush left, line two flush right, so on a phone the lines are "WON'T LET" and "YOU MISS". Bottom-left, one supporting sentence: "Shane Wighton builds machines that do the hard part for you. This is a fan's site for all 41 of them. Throw something." Bottom-right, the single action.

Mechanism 1, the hoop (from "Moving hoop won't let you miss", 2020, and "I made a ball seeking hoop", 2022). A rail runs along the top of the first screen. A carriage on it carries a vertical slide with the hoop. Press anywhere on the first screen, flick, release: a ball flies with your flick's real velocity, over the headline. The rig predicts where the ball will come down and drives there under motor limits (a speed limit and an acceleration limit per axis, no overshoot), and catches it. The predicted intercept is drawn as a small crosshair. Every made basket counts on a small scoreboard. When nobody has thrown for a few seconds, a pitching machine in a bottom corner throws. Prototype verified: catches every ball in the reachable envelope; a ball thrown at the floor is not caught, and the scoreboard says so.

Mechanism 6, the blank-cartridge button (from the explosive bat, axe and nut cracker). The hero's action is "Watch the latest video". Hold it to chamber a round (a cartridge slides in, a gauge fills), release to fire: the button face is driven forward by a piston with a flash and a short shake, and the ball it fires goes into the hoop, which opens the latest video. A plain tap, with no hold, fires at a default charge, so the action is never slower than a click. Keyboard: Enter fires.

Signature move on load (dealt): each headline line rises from behind its own baseline, then the sentence and the button fade up. The rig starts after that.

### Latest project: assembled by a pick-and-place machine

Composition: "object in front of type". The latest video's short title in three or four display lines flush left; the video frame in front of them on the right; the paragraph and the button below.

Mechanism 4, pick-and-place (from "Worlds hardest jigsaw vs. puzzle machine", 2022). The first time the section scrolls into view, its parts (the title lines, the frame, the paragraph, the button) are picked one at a time from a feeder at the bottom edge by a gantry head and placed, with trapezoidal motion profiles on the x axis and the z arm. Prototype verified at about six seconds for five parts; the real section uses the same speed. With script off, the section is simply laid out.

Mechanism B, the gimbal-stabilised player (new). The video frame sits on a two-axis gimbal drawn in ink. On a phone, tilt the device and the gimbal corrects to keep the frame level, with visible servo lag; on a desktop, fast cursor movement near it perturbs the base and the gimbal corrects. The video itself is a YouTube embed, loaded only after the thumbnail is pressed.

### The archive: all 41 on one camshaft

Composition: the dealt "quiet ledger with side preview": one column of rows, each row a video (title in ink, family in soft ink, year right-aligned with tabular figures), grouped by year, with the preview picture appearing to the right of the column.

Mechanism 3, the camshaft (new), turned vertical. The shaft runs down the left edge of the ledger column with one cam per row; lobe height is the view count, phase runs in upload order. Turning the shaft (drag it, or scroll with the pointer over it, or hover a row) sweeps a wave of lobes down the list: each follower pushes its row sideways as its lobe comes round, and the row at full lift shows its thumbnail in the preview slot. Left alone, the shaft idles slowly. Prototype verified (horizontal version); the vertical layout is the same geometry rotated.

Mechanism F, the auto-aim launcher (from the bow, the pool cue and the precision-guided launcher). Under the ledger, a flywheel launcher with one control, "Fire". Press it and the launcher picks a video at random, visibly solves its aim (the barrel turns, the flywheels spin up), and throws the card into the preview slot, where it lands and can be opened. The visitor chooses when; the machine does the aiming.

### The method: a slip fed by a Geneva drive, written by a plotter

Composition: the dealt "itinerary on a slip": a heading and a short paragraph on the left; on the right, a paper-coloured slip with the stages of a Stuff Made Here project as rows with dot leaders and a value on the right, and an inverted final row with the result.

Content (from the videos themselves): decide on a problem nobody has solved; the skeptic test (his wife, whose verdict is in several titles); CAD; machining and printing; the first test, which fails; the iteration loop (real figures from his titles: "100+ parts and 45 hours of practice", "413 eggs"); the video. Final row: "Result: one video. 41 so far."

Mechanism E, the Geneva drive (new). The slip comes out of a printer at the top of the section. A Geneva mechanism (a driver with one pin, a wheel with slots) indexes the paper one stage at a time with the real dwell between steps. Scrolling into the section, or dragging the driver, turns it; each index feeds one row out.

Mechanism D, the pen plotter (from "I sent robot forgeries to a handwriting expert", 2023). After each row is fed, a plotter arm writes that row's short note on the slip in a single-stroke font, with real pen lifts between letters. Notes are short (three to six words). With reduced motion the slip is shown complete.

### The numbers: a wall of word tiles

Composition: the dealt "wall of word tiles": a grid of square flat tiles, each holding one large figure with its unit and a caption, with every third tile a thumbnail. Content: 41 videos; about 352M views; about 4.8M subscribers; 28M for the most-watched; 17,342 lb of tools; 0.6 s for the moving hoop to reposition; 8 motion-capture cameras for the bow; 5 patents; 2020, the first video. Captions name the source video. Nothing moves here except the entrance.

### About Shane: under an apple peel

Composition: the dealt "two columns, highlighted words": the story set large across two columns, no heading, six or seven facts highlighted in flat colour, the last sentence highlighted entire and linking to the channel.

Mechanism A, the apple-peel reveal (from "I made an apple peel itself", 2026). The text block is covered by a skin in the ink colour. As the section scrolls in, a blade peels the skin off in one continuous strip that runs back and forth across the block (one strip, never cut, like the apple), and the text appears behind it. On a phone the strip is wider so the peel takes the same time. Reduced motion: no skin.

### The one action: "Watch"

The dealt band: a full-bleed field in the accent colour, about 60% of the screen tall, one word "WATCH" at a size that spans the width, the whole band a link to the channel. Top-left one sentence: "Opens the channel on YouTube." On hover or focus, field and word swap colours instantly.

### Footer: the name, machined

The dealt footer: inverted colours, four small columns of links at the top (YouTube, the subreddit, his social accounts, "made by a fan"), empty middle, and the wordmark across the full width at the bottom.

Mechanism 5, CNC pocketing (from the pumpkin carver, the chainsaw robot and his Tormach mill). The footer wordmark is machined out of the plate the first time it is seen: a roughing pass with a wide cutter that lifts over the letters, then a finishing pass with a narrow cutter, with chips. The same mechanism cuts every section heading at a fast feed on first view. Prototype verified, about five seconds for the full wordmark at the default feed. With script off, the headings are plain type.

### Everywhere: servo scroll

Mechanism 2, servo scroll with a tunable PID loop (new). The scroll wheel, the trackpad and the pin-tumbler navigation set a target. The page is a mass driven toward it by a PID controller tuned so it feels like an excellent native scroll (near critically damped, settled within about half a second). In a bottom corner, a tiny control panel with P, I and D knobs and a "Tuned" button, for the visitors who will find it; detuned, the page rings like a badly tuned servo. On touch screens the page scrolls natively (the controller is not applied to touch), so a thumb never fights it. Reduced motion: native scrolling.

## 5. Content

The copy deck is written before markup, following the design skill's rules: every headline two lines or fewer at every width, one supporting sentence, one action, full content in every section. Draft lines fixed by this document:

- Wordmark: Stuff Made Here (with "a fan's site" in small type beside it).
- Hero statement: "Won't let you miss."
- Hero sentence: "Shane Wighton builds machines that do the hard part for you. This is a fan's site for all 41 of them. Throw something."
- Hero action: "Watch the latest video".
- Section headings (machined): "Building now", "All 41", "How a build goes", "The numbers", "Watch".
- Band verb: "WATCH".
- Footer line: "Made by a fan. Not affiliated with Stuff Made Here. Video titles and thumbnails belong to Shane Wighton."

The 41 titles, YouTube IDs and view counts were pulled from the channel's Videos tab on 2026-10-24 (several titles have changed since upload; the current titles are used). Upload dates come from the research notes.

## 6. Structure of the build

```
index.html                 all content, readable without script
src/main.ts                mounts mechanisms, pauses them off screen
src/data/videos.ts         the 41 videos
src/data/facts.ts          the numbers with their sources
src/mechanisms/*.ts        one module per mechanism: mount(el, opts) -> { pause, resume, destroy }
src/lib/motor.ts           axis with speed and acceleration limits
src/lib/pid.ts             the controller
src/lib/spring.ts          critically damped spring, velocity carried through
src/lib/pointer.ts         pointer tracking with velocity history
src/lib/visible.ts         IntersectionObserver helper
src/styles/tokens.css      colour and type roles from the direction sheet
src/styles/page.css        layout per section
```

Verification before it is called done: the design skill's lint and browser inspector at 1440, 768 and 390 px with every FAIL fixed; a browser run through every mechanism (webapp-testing); the web-design-guidelines accessibility pass; a reduced-motion run; a script-off run.

## 7. Left to the builder

Exact motor speeds and PID gains (start from the prototype values), the cam profile and Geneva geometry, the single-stroke plotter font, which engravings if any, the final wording of every section, how the thumbnails are treated (one treatment for all), the behaviour on very wide screens, and the sound question: no sound by default; a small sound toggle for the bang and the Geneva click is allowed if it is off until switched on.

## 8. Calls I made (check these while reading)

1. Palette from the subject (black, aluminium, basketball orange) instead of the dealt navy and pink.
2. Showcase composition redrawn to "object in front of type" so it can hold the video.
3. The hoop lives on the type-only first screen, drawn in ink as part of the typography, not as a picture.
4. The cartridge button fires on a plain tap too, so it is never slower than a normal button.
5. The camshaft is vertical and merged with the ledger of 41, instead of a separate horizontal strip.
6. Geneva drive and plotter share one section (the slip), instead of two sections.
7. The apple peel runs back and forth as one strip over a text block.
8. Servo scroll is not applied on touch screens.
9. The twelve mechanisms are split six from videos, six new, exactly as prototyped and voted.

Settled after the builder review (a reviewer read the document as a builder and asked what was still unclear):

10. On a phone, the hero ball is a visible object you pick up and flick (a ball waits in a rack at the bottom-left); touching anywhere else scrolls. On a desktop you can press anywhere. So a thumb never has to choose between throwing and scrolling.
11. When the ball goes into the hoop, the page scrolls to the "Building now" section and loads the player there with autoplay muted; the visitor unmutes. It does not leave the site, and nothing opens in a new tab (browsers block that half a second after a gesture).
12. The headings are engraved, not left standing: the cutter pockets the letter shapes out of the dark anodised plate and exposes bright metal, so a heading reads as ink on the dark field exactly as the direction wants. The inverted footer pockets the dark out of bright plate. Same mechanism, letters-in polarity.
13. The channel has 41 public videos; the scrape of the Videos tab on 2026-10-24 confirmed it (an early explosive-axe upload in the research notes is no longer on the channel). View counts for lobe heights come from that scrape, shown as "about".
14. On a phone the camshaft stays, in a narrow left gutter; the lifted row expands to show its thumbnail inline, and the launcher fires into an inline slot at the top of the list.
15. The gimbal does not ask for motion permission. Its base is perturbed by scroll velocity and by dragging it; on devices that need no prompt (Android, desktop with sensors) tilt also works. iPhone tilt is a small opt-in control on the gimbal, off by default.


## 9. Second round, after the first review (same day)

Changes asked for after seeing the first build, and how they were settled:

- **Hero.** The machined "STUFF MADE HERE" wordmark is now the hero (two lines, the second flush right), cut on first load out of a blue anodised plate; the cut exposes a photographed milled-aluminium surface. The hoop moved to its own full-screen section right after the hero, with the cartridge button and the pitching machine.
- **The archive.** The 41 rows live on a roll inside a fixed-height window. The camshaft runs beside the window and, as it turns, the window follows the lifted row, so the whole archive is read by turning one shaft instead of scrolling 2,000 px.
- **The machines' look.** The user chose "both": photoreal AI renders of the parts (Higgsfield, GPT Image 2, backgrounds removed) animated by the same physics, plus redrawn shaded parts in code wherever a render would not fit. Twelve renders and two textures were generated, 26 credits in all.
- **Colour.** The user rejected the dark-with-orange palette as the generic AI-product look. Pinterest sits behind a login wall and shows no pins, so the palette is taken from his own marks: the black-on-pale-grey wordmark, and the thumbnail blue, red and basketball orange. Chapters change field: blue hero, grey shop paper for the machines, a near-black video chapter, a red method field and WATCH band, a blue footer. Orange is reserved for basketballs and the rim.

## 10. Third round, after the second review (same day)

- **Launcher.** The canvas beside "Fire a random one" was too small for the render; it is wider and taller and the pivot sits lower, so the whole launcher shows.
- **Machined titles.** The cut now works from a solid bar: the title appears as a plain bar of material (milled aluminium in the hero, ink elsewhere), sits for 0.6 s, a roughing pass rasters down and the letters emerge, a finishing pass cleans the edges, and a half-second deburring fade settles the scalloped part into the crisp letter in the same material. Nothing snaps to type. The machined titles use Saira Stencil One, a stencil face whose bridges read as a real cut part; Chivo stays for everything else. Replaces call 12.
- **Why blue.** Asked to explain the hero's blue: it is the blue of his own thumbnails, the painted wall behind him in the shop that frames nearly every title card, and the only strong colour in his marks besides the red he uses for the "$100 if you can miss" type. The alternative on the table is the pale grey of his logo badge for the whole page, with blue only in the tiles.
- **One screen per section.** The apple section and the archive were taller than a laptop screen. Every section now measures one viewport at 1440×900 and 1366×768: the archive window is 46 svh, the tile wall runs six across, the apple section's type is capped by viewport height.
- **Footer.** The footer no longer carries a second wordmark (the hero is the wordmark now): four short columns and the legal line, about 230 px.
- **Seeing the machines.** Each mechanism has a control to run it again (Cut it again, Assemble it again, Feed it again, Peel it again). The desktop app's browser pane runs no animation frames while hidden, which is why the machines looked still there; a normal browser tab shows them.
- **Phone launcher.** Firing used to scroll the page up to a slot at the top of the list, so the launcher left the screen before it moved. The slot now opens right above the launcher, the page keeps the slot and launcher together in view, the card flies up into the slot, and the landed card links to the video. Replaces the inline-slot part of call 14.

Fourth round, same day:

- **Detents.** Each section should hold for a moment so nobody scrolls past it by mistake. The servo scroll now runs its target through detents: the top of every section is a notch. A wheel flick carries the page to the next notch and no further; the flick's inertia tail is ignored for a quarter second after catching; leaving takes a deliberate push (two mouse notches, or a fresh trackpad swipe of 150 px), during which the page strains up to 30 px against the stop and relaxes back if the push stops short. Where sections are one screen tall the page indexes notch to notch; where a section is taller than the screen (phone layout in a narrow window) it scrolls freely inside and catches at the next notch. The scrollbar, keyboard and anchors stay native; after one of those lands within a third of a screen of a notch, the page seats itself in it. Touch screens get CSS scroll snap in proximity mode with a forced stop per section. The ledger keeps its own wheel: over it, the wheel turns the drum, not the page.
- **Polishing pass.** The deburring fade felt too fast and sudden. After the finishing pass a buffing pad now sweeps each bar left to right (about 2.5 s for the hero); behind it the scalloped cut is the crisp letter in the same material, a sheen trails the pad on the metal only, and bright specks fly off it. The finished part stays.

## 11. Fifth round: the buffing wheel, the ball, and the About page (same day)

- **Buffing wheel.** The polishing pad was a drawn disc with spokes that spun too fast to read. It is now a photoreal cotton buffing wheel (Higgsfield render, background removed, `public/parts/buff.png`) on an arbor from above, and it rolls along the bar without slipping: its rotation is the distance travelled over its radius, so the stitching turns at a readable rate.
- **The ball stays in.** A mouse throw is capped at 2,400 px/s and the ball now reflects off the ceiling and the side walls (the predictor knows the ceiling too, so the rig still catches a ball that came off it). Off the floor it takes a dead bounce, rolls out, lies there for a moment and fades; a ball that never crossed the rim counts as a miss when it stops.
- **About page** (`about.html`, about Shane and the channel, not the site's maker). All twelve prototyped mechanisms were already in use, so three new ones were built for it, each carrying content: the painting robot (his portrait as a 2,449-dot halftone from the bow video's thumbnail, three colour passes), eight motion-capture pan heads watching the shop (they follow the pointer or tour the six listed tools), and a sorting line that drops the 41 videos into their six bins. Facts on the page come from the research inventory: ran the R&D lab at Formlabs; mechanical engineering degree and a master's in computer science; five patents, thirteen pending; channel since 2020-03-04; 17,342 lb of tools; Tormach 24R; eight OptiTrack cameras; the wife as tester. The university is left out as unverified. The portrait uses his thumbnail and is credited; a public launch needs his OK for that too.
- **Servo.** The detent list is now a parameter, so each page names its own notches.

## 12. Sixth round: the prototypes page (2026-10-25)

A third page, `ideas.html` ("Not built yet"), carries six more machines, all new, each a working prototype of something he has not built and each carrying its own pitch, the thumbnail of the video it grew out of, and a vote:

- **Split-flap board** for the title: every letter on its own flap wheel, stepping until the right flap drops.
- **The table that won't let it fall**: a plate on two servos with speed and acceleration limits; a position-and-velocity controller tilts it against the ball. Flick the ball or press "Shove it"; it catches, counts catches and drops, and shoves the ball itself when left alone. The hoop's promise with a feedback loop instead of a prediction.
- **The signature pantograph**: a parallelogram linkage with the fixed pivot on the extension of one bar and the pen on the extension of the other (ratio 3 on desktop, 2 on phones, where O, tracer and pen stay colinear). The visitor draws on the pad and the pen engraves it on the plate; the machine signs the channel's name first.
- **The trebuchet that learns**: fires, measures, corrects the counterweight by the ratio and then by the secant through the last two shots, and fires again until it is in; the release has a few percent of scatter; the bucket can be dragged; the shot log is printed.
- **The escapement clock**: a pendulum-driven anchor over a thirty-tooth escape wheel, one tooth per second; the count of days, hours, minutes and seconds since the latest video is true to the second.
- **Ratchet tally counters** for the vote: a tooth per tap, the pawl drops behind it; counts persist in localStorage only, stated plainly on the page.

Every section is one screen on phones, laptops and desktops; the servo detents and the lock run on this page too. Related-video thumbnails sit beside each pitch on wide screens and are hidden on phones to keep the one-screen rule.

