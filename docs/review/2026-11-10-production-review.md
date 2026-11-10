# Production review, 10 November 2026

A review of the live site at https://stuffmadehere.vercel.app before it is called production. It
records what was measured, what was fixed on the day, and what still needs a decision. It is an
audit, not an implementation plan: the plan for the open items is made separately and approved by
the owner before any of it is built.

## How it was checked

- Headless Chrome against production, four pages and the 404, at 390×844 and 1440×900: head tags,
  headings, images, control names, small text, console, failed requests, transfer weight before and
  after a scroll-through, largest contentful paint and layout shift.
- Every link on the site (80): internal ones by status, the 42 video links through YouTube's oEmbed
  endpoint, which answers only for public, embeddable videos.
- Every section of every page, screenshotted as a visitor lands on it, phone and desktop, plus three
  views the usual sweep skips: scripts off, reduced motion, and 1920×1080.
- Response headers, crawler files, the production build, the two API endpoints, the repository.
- The one-screen audit (`node scripts/audit.mjs --channel chrome`) after the fixes: 24 of 24 pass.

## Verdict

Not ready to be called production yet. The machines, the performance and the accessibility basics
are in good shape. Three things stand in the way: the site states facts that are no longer true, the
setup a public site needs (crawler files, security headers, caching, privacy) was never done, and a
few fixed controls collide with content. None of it is deep; most of it is a day of work once the
decisions below are made.

## What is healthy

| Page | First view | After a full scroll | Largest paint | Layout shift |
| --- | --- | --- | --- | --- |
| Home | 867 kB, 23 requests | 1.8 MB, 74 requests | 1.06 s | 0 |
| About | 1.16 MB, 61 requests | 1.4 MB | 0.75 s | 0.001 |
| Ideas | 334 kB, 17 requests | 561 kB | 0.70 s | 0 |
| Build log | 293 kB, 16 requests | 969 kB | 0.72 s | 0 |
| 404 | 83 kB | 83 kB | 0.90 s | 0 |

Phone figures, production, on a fast line with no throttling. On desktop the layout shift is 0.039
on Home and 0.077 on About: inside the "good" band, cause not traced.

- All 80 links resolve; all 42 video links are public and embeddable.
- No console errors, no failed requests, no horizontal overflow on any page at either size.
- One `h1` per page, headings in order, every image has alt text and dimensions, every control has a
  name, the 404 is `noindex`.
- Reduced motion works: titles, portrait, sorting line and printed slip appear finished.
- The build type-checks; Home ships 22 kB of script and 9 kB of CSS, gzipped.
- The footer says the site is not affiliated with the channel and whose the titles and pictures are.

## Fixed on the day

- **The vote store was about to be shut down for inactivity.** Only the Ideas page calls
  `/api/vote`, and nobody had opened it. A Vercel cron now reads the totals once a day
  (`vercel.json`), which is one command against the store. Confirmed registered on the project.
- **Phones: a placard covered a number.** "Pull a drawer" sat over the first drawer's count; it now
  sits on the cabinet's top edge.
- **Phones: text ran under the fixed menu key.** The "All sixteen frames" heading on the build log
  and the wordmark's second line on Ideas now wrap clear of it.
- **Phones: the bow's readout ran off the canvas** and under the right camera. It now drops figures
  from the end until it fits.
- **Two places named the wrong video as the latest.** The footer link on every page now goes to the
  channel's videos tab, which is never out of date. The picture under the days-since counter now
  follows the same live upload the counter counts from.
- **A lock file was tracked in git** (`.claude/scheduled_tasks.lock`); untracked and ignored.

## Open, in order of weight

### 1. The site states facts that are no longer true

The channel published its 42nd video on 1 November. The nameplate and the days-since counter read
the live figures from `/api/channel` and say 42; everything else is frozen at the build: "All 41
videos" in headings, navigation, descriptions and share text, "Forty-one videos in six years" and
"41 since 2020-03-04" on the About page, the camshaft, drawers and sorting line (41 entries in
`src/data/videos.ts`), and the Home section that presents the apple peeler as "the latest video",
with its still, its play button and the Fire button's link. The page contradicts itself on one
screen, and it will go stale again at every upload. The counts of machines in the copy are stale in
the same way ("Six come from his videos. Six he has not built yet").

Recommendation: one source of truth. Generate the video list at build time from the YouTube API,
derive every count from it, let the "latest video" section take its title, still and link from the
data, and rebuild on a schedule so an upload reaches the site without anyone touching it.

### 2. Fixed side tabs sit on top of text on desktop

"Servo scroll" and "Sound off" are vertical tabs fixed to the right edge. At 1440 wide they overlap
body text in the About block on Home, the bow section and the drawing sheet on About. The sound
switch already lives in the menu door, which now opens on desktop too.

Recommendation: drop the side sound tab, move the servo panel's switch into the door, and leave the
right edge clear.

### 3. Nothing tells crawlers or share previews what this is

No canonical links, no `robots.txt`, no `sitemap.xml`, no structured data. The icon is an inline SVG
only: no PNG, no touch icon, no manifest. The build log shares the Home card. Before any of that:
the site carries a real person's name and portrait, so whether it should be indexed at all before
Shane has seen it is the owner's call.

### 4. No security headers

Vercel adds HSTS. There is no content security policy, no `X-Content-Type-Options`, no
`Referrer-Policy`, no `Permissions-Policy`, nothing against framing. The API returns raw error
strings, and the vote accepts a POST from anywhere.

### 5. Caching, fonts and weight

Every static file, including the hashed bundles and the part renders, is served
`max-age=0, must-revalidate`, so a returning visitor revalidates all of them. The two typefaces come
from Google Fonts: a render-blocking stylesheet and a third-party connection on every page. Home's
first view is 754 kB of images, most of it two milled textures (193 kB and 139 kB).

### 6. Privacy

The vote's daily limit stores the visitor's IP address in the key name for a day. Google Fonts and
YouTube thumbnails see every visitor's address. There is no privacy note. For a public site with
European visitors this wants a salted hash instead of the address, self-hosted fonts, and three
plain sentences about what is stored.

### 7. The "All videos" section is the weakest composition

On desktop a narrow list and a small preview float in a wide empty field under a small heading; at
1920 wide it is more so. On phones the preview is cut off by the list window, a placard sits on it,
and the landing slot reads as an empty grey box.

### 8. With scripts off the navigation breaks

The fallback list lands on top of the hero title on Home and About, and is dark on dark, so
invisible, on Ideas and the build log. Controls that need script (side tabs, placards, replay
buttons) still show.

### 9. Smaller things

- Internal links point at `.html`; production redirects each one (308) to the clean address.
- No skip link for keyboard users.
- Footer links are 24 px tall on phones; the sorter's bin labels are 11 px.
- While the gantry assembles the latest-video section, two paragraphs overlap for a few seconds on
  phones, and on a large desktop the button passes over the heading.
- The play triangle on the video still is dark on a dark picture.
- The repository is public and has no licence file.
- The one-screen audit runs only by hand.

## Decisions only the owner can make

1. **Indexing and Shane.** Public and indexed now, or `noindex` until he has seen it?
2. **Address.** Stay on `stuffmadehere.vercel.app` or move to a domain of its own?
3. **Freshness.** Automatic rebuild from the YouTube API (recommended), or a manual refresh after
   each upload?
4. **Licence.** All rights reserved, or an open licence for the code?

## Not checked

- Lighthouse scores: the public PageSpeed endpoint refused the requests (quota). The figures above
  are from a local headless run, not a throttled phone.
- Real phones, Safari and Firefox; a screen-reader pass; the sound cues by ear.
- The cron's first run, which falls at 05:00 UTC the day after it was added.
