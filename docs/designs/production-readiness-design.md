# Production readiness for the Stuff Made Here fan site

*   **Author:** fatoh2
*   **Status:** Proposed
*   **Date:** 2026-11-11

--------------------------------------------------------------------------------

## Overview

The site is a fan-made concept about the YouTube channel Stuff Made Here. It has
four pages and a 404, and every section is a working simulated machine. It is
live at `stuffmadehere.vercel.app`, it has close to no visitors, and it has not
been launched. Its first real reader is meant to be the channel's owner, Shane
Wighton.

A review on 10 November 2026
(`docs/review/2026-11-10-production-review.md`) found that the site is not ready
to be called production. Six reviewers then tested a plan to close that gap
(`docs/designs/production-readiness.md`) and found the plan could not be built
as written. This document is the plan that answers both.

It covers four packages of work in one document:

1.  **Facts.** The site's video facts come from one source and refresh
    themselves once a day.
2.  **Chrome.** The fixed controls stay clear of the content, and the pages
    still work with scripts off.
3.  **Setup and policy.** The site gets what any public site needs: safe
    handling of visitor data, security headers, caching, its own fonts, a
    privacy note, icons and a licence.
4.  **The "All videos" section.** Its phone defects are closed, and its desktop
    composition is either redesigned from a sketch the owner approves or
    deferred in writing.

Nothing here launches the site. Search engines stay off until Shane has seen it,
and the address does not change.

## The Problem

**The site says things that stop being true.** The channel published its 42nd
video on 1 November. For nine days the nameplate said 42 while the headings,
lists and descriptions said 41, and a Home section presented an older video as
"the latest". Nobody noticed. On 10 November the new video was added by hand. It
took edits in four hand-typed copies of the video list and in about twenty
sentences that state the total, and the first headline written for it ran under
the fixed menu key on phones while the layout check still passed. The same work,
with the same risks, comes back at every upload, roughly every two months. For a
site whose first reader is the person who made the videos, a wrong "latest video"
is the worst mistake it can make.

**"Ready" has no test.** The review was a hand session. The one script in the
repository, `scripts/audit.mjs`, checks section height, sideways scroll and
console errors, and decides none of the review's open items. So nobody can say
when the work is finished, and a fault that arrives through an unattended deploy
would not be seen.

**The setup a public site needs was never done.** There are no security headers
beyond the one the host adds. Every static file is revalidated on every visit.
The typefaces load from Google on every page. The vote's daily limit stores each
voter's IP address in a key name, and can leave it there with no expiry. There
is no privacy note, no icon beyond an inline drawing, and no licence on a public
repository that holds a real person's portrait and titles.

**Fixed controls collide with content, and the pages lean on scripts.** Two
vertical tabs on the right edge overlap body text on desktop. With scripts off
the fallback navigation lands on the hero title on two pages and is invisible on
the other two. There is no skip link, internal links pay a redirect each, and the
footer links are small on phones.

**One section is weaker than the rest.** In "All videos" the phone preview is cut
off by the list window with a placard on top of it, and the landing slot reads as
an empty grey box. On desktop a narrow list and a small preview float in an empty
field.

**The proposed answer, in one paragraph.** Keep the video facts in two files: one
that a machine may rewrite, and a small one kept by hand. Generate every list,
count and the latest-video section from them when the site is built, and rebuild
once a day. Give "ready" a checkable meaning: each open item is closed by a named
check or deferred in a written list. Then do the chrome, setup and composition
work in an order that puts the riskiest change, the content security policy,
last.

## Goals

Each goal names how it is checked. A goal with no passing check is not met.

1.  **"Done" can be checked.** Every bullet under the review's "Open" heading has
    either a named closing check that passes or an entry in a deferral list kept
    in the review file, with a reason. Findings from a second run of the review
    go on a new list and do not reopen this one.
2.  **One source for the video list.** The ledger rows, the six drawers and their
    counts, the sorter cards, every sentence that states the total, and the
    latest-video section are produced at build time from the two facts files. No
    hand-typed copy of the list or of the total remains, apart from the build
    log's dated history. *Check:* a build with one made-up newer video in the
    facts file changes all of them with no other edit.
3.  **The facts refresh once a day under the owner's rule.** The machine may
    change facts: the list, counts, view figures, and the latest video's title,
    still, link, date and length. It may not write or judge: a video's
    description, its drawer and an optional hand-written headline come from the
    hand-kept file. A new video with no entry goes into "Everything else" and
    shows its title with no description. *Check:* the fixture build above, plus
    one real scheduled run observed in the host's log.
4.  **A bad answer changes nothing.** With the API key present, an unusable
    answer from YouTube fails the build, the last good version stays live, and
    the owner is told. With no key, the build uses the committed facts.
    *Check:* one deliberate failed build, with the live site and the owner's
    inbox looked at afterwards.
5.  **The page cannot contradict itself.** The build is the only writer of the
    video count and the latest video. The live endpoint supplies subscribers and
    total views only. *Check:* no code path sets the count or the latest video at
    run time.
6.  **The latest-video heading holds for any title.** One layout fits the longest
    title the channel has used, at the six audited sizes, without being cut off
    and without running under the menu key. *Check:* a committed worst-case
    fixture and a new assertion in the layout audit.
7.  **The right edge is clear and the pages work with scripts off.** The sound
    tab is removed, the servo sliders move into the menu door, the fallback
    navigation is readable and usable on all four pages, controls that need
    scripts are hidden when there are none, a skip link exists, internal links
    do not redirect, and footer links are at least 44 px tall on phones.
    *Check:* the layout audit at its six sizes, a scripts-off screenshot of each
    page, and a link check that finds no redirect.
8.  **Visitor data is handled properly.** The vote stores no IP address, its
    limit always expires, it accepts posts from this site only, and no endpoint
    returns an internal error string. A short privacy note in the footer says
    what is stored in the browser and which other companies see a visitor's
    address. *Check:* a read of the stored key names after a test vote, and a
    post from another origin that is refused.
9.  **The site carries the standard protections without breaking a machine.**
    The typefaces are served from the site. Hashed bundles are cached for a
    year and nothing else is. Simple security headers are on, and a content
    security policy is enforced only after a report-only period and a hand sweep
    that scrolls each page, presses play, opens a drawer, fires the launcher,
    loads Ideas and downloads the plate. *Check:* that sweep on a preview
    deployment, with no policy violation reported.
10. **The repository says what may be reused.** An MIT licence covers the code,
    and a path list names what it does not cover. PNG and touch icons exist, the
    build log has its own share card, and the README matches the site.
    *Check:* each file exists and the README's counts match the pages.
11. **The "All videos" section is right at every size.** On phones and the
    tablet the preview is not cut off, no placard covers it, and the landing
    slot does not read as an empty box. On desktop the built section matches
    sketch A. *Check:* owner sign-off on screenshots of the built section at
    seven sizes: the three phones, 768 by 1024, and 1366, 1440 and 1920 wide.
12. **Search stays off.** Every response carries `noindex` until the owner
    lifts it. Already in force; the goal is that nothing in this work removes
    it. *Check:* the response header on all four pages after the last deploy.

## Non-Goals

*   Launching the site, lifting `noindex`, or moving to another address.
*   A sitemap, structured data and canonical links. They do nothing while search
    is off; they wait for launch.
*   A `robots.txt` that disallows everything. It would stop crawlers from
    seeing the `noindex`.
*   A web manifest.
*   Rendering the video list in the browser from a live endpoint.
*   Hashing the files in `public/`, a nonce-based policy, Trusted Types, and
    `Cross-Origin-Embedder-Policy`.
*   Cutting image weight beyond two free changes: lazy loading for the
    latest-video still and re-encoding the two milled textures at the same pixel
    size. The review rates the pages healthy and gives no target.
*   Hosting YouTube's thumbnails on the site. The privacy note discloses them
    instead.
*   The 11 px labels on the sorter's bins. The design document records them as a
    limit of that layout.
*   New machines, new image renders, a fifth page, and new tooling for links,
    headers or Lighthouse.
*   Rewriting the build log's captions and screenshots that say 41. They are
    dated history.
*   Anything a second run of the review finds that the first did not.

## Open Questions

*   **The first version of the machine list.** The list decides the numbers the
    site states. It is written from the README's rows during the build and needs
    the owner's review before any sentence reads from it.
*   **Drawer names in the list on phones.** The owner removed them on desktop.
    On phones each title still carries its drawer's name beneath it.
*   **What the uploads list holds.** Whether Shorts, streams or premieres appear
    in it for this channel is unknown until one real call is made. The count
    matches today.
*   **Whether a failed build started by a deploy hook emails the owner.**
    Assumed; proven or disproven by the deliberate failure in goal 4.
*   **The first run of the existing scheduled job.** It falls on 11 November and
    has not been seen.

Settled while drafting, and removed from this list:

*   The three textures are generated images, not photographs. The design
    document records "twelve renders and two textures were generated"; the
    README's word "photograph" is wrong and is corrected in package 3.
*   Whether the host's free plan allows a second daily job no longer matters.
    The plan uses one job for both the refresh and the keep-alive read.
*   The desktop composition of "All videos": the owner chose sketch A without
    the drawer names, from three sketches made on the live section.
*   What counts as a machine: one hand-kept list, counted at build.
*   When the layout audit runs: on every push to `main`.

## Critical User Journeys (CUJs)

### CUJ 1: The channel uploads a video

*   **Given**: The site is live, the API key is set, and the hand-kept file has
    no entry for the new video.
*   **When**: The daily job runs at 05:00 UTC.
*   **Then**: The site is rebuilt. The video appears as the last ledger row, in
    the "Everything else" drawer and on the sorting line. Every count is one
    higher. The latest-video section shows its title, still, link, date, length
    and view figure, with no description, and the heading fits at every audited
    size. Nobody edited anything.

### CUJ 2: The owner files the new video

*   **Given**: CUJ 1 has happened.
*   **When**: The owner adds one entry to the hand-kept file, with a drawer, a
    one-sentence description and, if wanted, a headline, and pushes it.
*   **Then**: The next build moves the video to its drawer, shows the sentence,
    and uses the headline in place of the title.

### CUJ 3: YouTube gives an unusable answer

*   **Given**: The API key is set.
*   **When**: A build gets a timeout, a quota error, an empty title, or a list
    that is missing a video the hand-kept file names.
*   **Then**: The build fails with a message that names the cause. The previous
    version stays live. The owner is told by the host.

### CUJ 4: A video is removed from the channel

*   **Given**: The hand-kept file names a video that YouTube no longer returns.
*   **When**: Any build runs, scheduled or pushed.
*   **Then**: The build fails and names the video. The owner deletes its entry,
    and the next build passes without it. Until then nothing on the live site
    changes.

### CUJ 5: A build with no key

*   **Given**: A local machine, the layout audit, or a fork, with no API key.
*   **When**: The site is built.
*   **Then**: The build uses the committed facts file, makes no network call,
    and produces the same pages every time.

### CUJ 6: A visitor with scripts off

*   **Given**: A browser that runs no scripts.
*   **When**: The visitor opens any of the four pages.
*   **Then**: The navigation is readable, sits clear of the title, and reaches
    every page. No control that needs scripts is shown. The video list is in the
    page.

### CUJ 7: A visitor votes

*   **Given**: The Ideas page.
*   **When**: The visitor taps a counter, and separately another website posts
    to the vote endpoint.
*   **Then**: The tap is counted and no IP address is stored anywhere. The post
    from the other website is refused. Neither response contains an internal
    error string.

### CUJ 8: A desktop visitor reads and tunes

*   **Given**: A 1440 px wide window.
*   **When**: The visitor reads any section, then opens the menu door.
*   **Then**: Nothing fixed overlaps the text. The door holds the pages, this
    page's sections, the sound switch and the three servo sliders.

### CUJ 9: A keyboard visitor

*   **Given**: Any page, focus at the top.
*   **When**: The visitor presses Tab once and then Enter.
*   **Then**: A skip link appears and moves focus to the page's main content.

## Technical Plan (Architecture)

Three choices in this section were the owner's and were asked one at a time:
the desktop composition of "All videos" (part 4), what counts as a machine, and
when the layout audit runs (both under "Decisions that cross packages"). Each
is written where it falls, with what was chosen.

### 1. Facts: two files, one generator, one daily job

**The two files.**

*   `src/data/facts.json` is the machine's file. It holds what YouTube says: for
    each video its id, title, publish date, length in seconds and view count,
    oldest first, plus the channel's subscriber and view totals and the date it
    was fetched. A person never edits it. A small script refreshes the committed
    copy on request.
*   `src/data/videos.hand.json` is the owner's file. For each video id it holds
    the drawer, and optionally a one-sentence description and a headline. It
    also holds a list of upload ids that are not videos and must be ignored.
    It is the only place a person writes about a video.

The hand-kept file is also the floor. Every id in it must come back from
YouTube with a title. That replaces "fewer videos than before", which needed a
stored "before" that a build does not have. Deleting an entry is how the owner
accepts a removal.

**What counts as a video.** An upload is a video unless it is on the ignore
list, is shorter than three minutes, or is a live stream or a premiere that has
not gone out yet. The three-minute line is checked against the 42 known videos
with one real call before it is relied on.

**The generator.** A Vite plugin, loaded from `vite.config.ts`. It is a plugin
and not a script that runs before the build because the layout audit calls
Vite's build directly, and a separate script would be skipped there.

*   *Loading the facts.* With `YOUTUBE_API_KEY` set, the plugin fetches the whole
    uploads list page by page, then lengths, views and channel totals, applies
    the rule above and runs the guard. With no key it reads `facts.json`. An
    environment variable can point it at a fixture file instead; the audit uses
    that.
*   *The guard.* The build stops with a named cause when the request fails or
    times out, when the pages of the list do not add up to the total YouTube
    reports, when any title is empty, or when an id in the hand-kept file is
    missing.
*   *Filling the pages.* The HTML sources keep named, empty marker blocks where
    the hand-typed copies are today. The plugin fills them: the ledger rows, the
    six drawers, the sorter cards and the latest-video block. Short named
    tokens stand where a sentence states a fact: the total as a figure and in
    words, the number of can't-miss videos, the first video's date, the span in
    years, and each drawer's count. Titles are escaped for HTML text and for
    attributes, because they are someone else's input.
*   *Feeding the scripts.* The plugin provides a small virtual module with the
    latest video and the total. `src/data/videos.ts` shrinks to that plus its
    two URL helpers. The two labels typed in TypeScript read the total from it.

The generated markup keeps the contract the machines read today: `.row` with
`data-id` and `data-views`, `.drawer__part`, and `.sort__card` with
`data-family`. Rows gain `data-still`, the size of still to ask for. One part
of today's contract is dropped: the in-list preview, `.row__inline`, goes at
step 6 together with the camshaft code that used it, because the phone fix
moves the preview into the landing slot. The brief listed it as part of the
contract to keep; the owner chose to drop it when the two were compared.

**One name per drawer.** The same drawer is "Shop" in the ledger, "Everything
else" in the drawers and "the rest" on the sorter. The generator takes each
drawer's names from one table, a long name and a short one, so the three places
cannot drift again.

**The latest-video block.** One layout for every video.

*   The heading is the hand-written headline when there is one, and the title
    when there is not. It wraps. A size step is chosen at build time from the
    length of the text: the present large size up to 18 characters, a middle
    size up to 40, a small size beyond. On phones the heading's width stops
    short of the menu key. Because one long word cannot wrap, the generator also
    writes the length of the longest word into the block, and the type size is
    the smaller of the size step and the size at which that word fits the
    heading's width.
*   The sentence under it is assembled from facts: "The latest video", the
    date, the length in minutes, the description if there is one, and the view
    figure rounded to one decimal of a million.
*   The still, the link, the play label and the Fire button's link come from
    the same video.

**One writer.** `/api/channel` keeps subscribers and total views and loses the
video count and the latest video. The nameplate's video drum, the days-since
counter and its caption take their values from the build. The scripts that
overwrite them at run time are removed.

**The daily job.** One function, `/api/refresh`, called by the existing 05:00
UTC schedule in place of `/api/vote`.

```text
05:00 UTC schedule
      │  (bearer secret checked)
      ▼
/api/refresh ──1──▶ read the vote totals          keeps the store active
      │
      └────2──▶ POST the deploy hook ──▶ build on the host
                                             │
              ┌──────────────────────────────┘
              ▼
   facts plugin: is the API key set?
      ├─ yes ─▶ YouTube Data API ─▶ rule ─▶ guard ──fail──▶ build fails,
      │                                      │               last good stays live,
      │                                      ok              host tells the owner
      └─ no ──▶ src/data/facts.json          │
                                             ▼
        facts + src/data/videos.hand.json ─▶ ledger, drawers, sorter,
                                             counts, latest block,
                                             virtual module for the scripts

browser ─▶ /api/channel ─▶ subscribers and total views only
```

The store is read before the hook is called, so the keep-alive holds even when
the hook fails. The function needs two new secrets in the host's settings: the
schedule's bearer secret and the deploy hook's address. The owner creates the
hook in the host's dashboard; it cannot be made from the repository.

A rebuild runs every day whether or not anything changed. Identical output is
what "nothing new, nothing happens" means here, as the owner accepted. The cost
is about 360 builds a year that change nothing, and an ordinary push fails
while YouTube is unreachable.

**What a build cannot do.** It cannot commit. The live site can therefore be
ahead of `facts.json` in the repository. The refresh script closes that gap
when the owner runs it, which CUJ 2 is the natural moment for.

### 2. Chrome

*   **The right edge.** The two vertical tabs are removed. The sound switch
    already lives in the menu door. The three servo sliders move into the door
    as a third group under their own placard, shown where they are shown today:
    on devices with a pointer, and not under reduced motion.
*   **Scripts off.** Styling only, under the rule that already detects it. The
    fallback navigation becomes an ordinary block in the page's flow above the
    title, on a paper ground in ink on every page, so it is readable whatever
    colour the hero below it is. The key, the pin cylinder, placards, replay
    buttons and the tilt button are hidden.
*   **Skip link.** The first focusable element on each page, visible on focus,
    pointing at the page's main content.
*   **Clean links.** Internal links point at `/about`, `/ideas` and `/log`. The
    development and preview servers learn the same mapping through the plugin,
    so links work the same in all three places.
*   **Footer links.** At least 44 px tall on phones.
*   **The gantry.** A part in the air is solid. While the gantry carries a
    part it takes the section's ground colour behind its text and sits above
    the placed parts, so it hides what it passes over. Today a carried
    paragraph is see-through and prints across the ones already placed.
*   **The play triangle.** A paper-coloured triangle on an ink disc, in place
    of a dark triangle on the picture.

### 3. Setup and policy

*   **The vote.** The daily limit's key is a keyed one-way code made from the
    address and the day, using the store's existing token as the key, so no new
    secret is needed and the address cannot be read back. The key is created
    with its one-day expiry in the same step, before it is counted. A post is
    accepted only when its origin is this site. Both endpoints return fixed
    error strings.
*   **Typefaces.** The two families are served from the site under their
    present names, "Chivo" and "Saira Stencil One", because canvas code names
    them and three machines wait for them to load. The files sit with the
    hashed assets, so they are cached for a year. The layout audit is run after
    this change alone, since font metrics feed its one-pixel tolerance.
*   **Caching.** Only `/assets/`, whose file names carry a hash, is marked
    cacheable for a year and immutable. Pages and the files in `public/` keep
    revalidating, or the daily refresh would never reach a returning visitor.
*   **Simple headers.** No sniffing of content types, a referrer limited to the
    origin on cross-site requests, no framing of the site by others, and a
    permissions policy that turns off only camera, microphone, geolocation,
    payment and USB. Motion sensors, autoplay and fullscreen are left alone:
    the tilt control and the video player use them.
*   **Content security policy.** Report-only first, on a preview deployment.
    It allows the site's own scripts plus the one inline script by its hash,
    inline style attributes, images from the site, `data:` and
    `i.ytimg.com`, fonts from the site, frames from
    `www.youtube-nocookie.com`, and connections to the site. The plugin checks
    at build time that the inline script on every page still matches the hash
    in the policy, and fails the build if it does not: a mismatch would
    silently drop the pages into their scripts-off styling. The policy is
    enforced only after the hand sweep in goal 9 reports no violation.
*   **Privacy note.** Three plain sentences in each page's footer: what is kept
    in the browser, how the vote's daily limit works, and that YouTube sees a
    visitor's address when thumbnails or the player load.
*   **Icons and cards.** A 32 px PNG and a 180 px touch icon drawn from the
    same shapes as the inline icon. The share-card script gains the build log,
    and all four cards are made again.
*   **Licence.** An MIT licence file for the code, and a second file listing by
    path what it does not cover: the portrait data, the two facts files' titles,
    the share cards and build-log screenshots, and the generated renders and
    textures. The typefaces carry their own licence beside them.
*   **The review file.** It gains the deferral list from goal 1, and a second
    list for findings that fall outside this plan.

### 4. The "All videos" section

*   **Phones.** The lifted video's preview moves out of the scrolling list and
    into the landing slot above the launcher. That one change answers all three
    defects: nothing is cut off by the list window, no placard sits on a
    picture, and the slot is never an empty box. The same arrangement serves
    the tablet. The owner signs off screenshots of the built section at seven
    sizes, as the brief said: the three phones, 768 by 1024, and the desktop at
    1366, 1440 and 1920 wide.
*   **Desktop.** The owner chose sketch A from three, with the drawer names
    removed from the list. The sketch is the live section rearranged by styles
    only, so it is a record of the real machines in the new arrangement:
    `docs/designs/assets/all-videos-sketch-a.jpg`, at 1024, 1366, 1440 and 1920
    wide. It applies from 64em up, where the present desktop layout applies.
    *   Two columns in the proportion 7 to 5, bottoms aligned.
    *   Left: the heading in the house size on two lines, the note under it,
        then the list with the camshaft in a 110 px gutter on its left.
    *   The list is wider and its rows are taller: 3rem rows, titles at
        1.125rem, a window of `min(44svh, 470px)`. Each row shows the title and
        the year. The drawer's name is no longer shown in the list on desktop.
    *   Right: the lifted video's still at the full column width, its title
        under it in bold at 1.0625rem, then the launcher. The launcher's canvas
        scales with the window between 150 and 230 px wide.
    *   The still uses YouTube's 1280 px image where one exists and falls back
        to the 320 px one.
    *   The "Scroll or swipe the list" placard moves out of the scrolling window
        to the line between the note and the list, at the right. In the sketch it
        still sits on the first row.
    *   Checked in the sketch at the five sizes from 1024 by 768 to 1920 by
        1080: one viewport tall, no sideways scroll, a two-line heading, nothing
        under the fixed lock.

    The sketch's styles, as the starting point for the build:

    ```css
    #all { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
           column-gap: clamp(2rem, 4vw, 4rem); align-items: end; }
    #all .all__inner { margin-left: 110px; max-width: none; }
    #all .all__head { font-family: var(--font-display); font-weight: 900;
           text-transform: uppercase; letter-spacing: -0.04em; line-height: 0.92;
           font-size: var(--step-head); margin: 0 0 1rem -110px; max-width: 13ch; }
    #all .all__note { margin: 0 0 2rem -110px; font-size: 1rem; max-width: 44ch; }
    #all .ledger { height: min(44svh, 470px); }
    #all .row { grid-template-columns: 1fr 56px; height: 3rem; }
    #all .row__kind { display: none; }
    #all .ledger__year { height: 3rem; }
    #all .row__title { font-size: 1.125rem; }
    #all .all__side { min-width: 0; grid-template-columns: minmax(0, 1fr);
           gap: 1.5rem; justify-items: stretch; align-content: end; }
    #all .all__preview { width: 100%; height: auto; }
    #all .all__preview img { height: auto; aspect-ratio: 16 / 9; display: block; }
    #all .all__preview figcaption { font-size: 1.0625rem; font-weight: 700;
           color: var(--ink); }
    #all .launcher { grid-template-columns: clamp(150px, 15vw, 230px) 1fr; }
    #all .launcher canvas { width: clamp(150px, 15vw, 230px); height: auto;
           aspect-ratio: 200 / 190; }
    ```

    The flying card is 300 px wide today and lands in a preview that is now up
    to 750 px wide. Its width has to follow the preview's, which is a change in
    the launcher's script, not in the styles.

### Decisions that cross packages

*   **What counts as a machine.** The owner chose one list, counted at build.
    `src/data/machines.json` is a third hand-kept file. Each entry names a
    machine, the page it is on, where it came from (one of his videos, with the
    video named, or new), and whether it counts toward the numbers the site
    states. That last field is where the question "is the lock a machine, are
    the placards" gets answered, once, in one place. The generator fills the
    counts into the sentences through tokens, the same way it fills the video
    total: the hero's line, the latest-video paragraph, the footer on each page,
    the link on Ideas and the Ideas page's own "six". A check compares the
    README's headings and table rows with the list and fails when they differ.
    The first version of the list is written from the README's rows and
    reviewed by the owner before any sentence reads from it.
*   **When the layout audit runs.** The owner chose every push. The existing
    workflow gains a trigger on pushes to `main` and keeps its manual one. It
    runs the audit twice: once on the committed facts and once on the
    worst-case title fixture. It reports after the host has deployed, so it
    tells the owner about a break and does not prevent one. The daily rebuilds
    are not pushes and are not audited; what stands between them and a broken
    layout is the build's guard and the heading's size steps, both proven
    against the fixtures.
*   **Order.** Vote fix first, since it is the one item exposed today. Then
    typefaces and an audit run. Then the right edge, scripts-off, links, skip
    link and footer. Then the generator from the committed facts, with no
    network. Then the latest-video layout and its fixtures. Then the "All
    videos" phone change on the generated rows. Then the fetch, the guard and
    the daily job, ending with the deliberate failed build. Then headers,
    caching and the policy. Then icons, cards, the privacy note, the licence
    and the README. Last, the review's method run again against production.

## Alternatives Considered

The first eight come from the six-lens review of the brief
(`docs/designs/production-readiness.md`, "Alternatives Weighed"). The rest were
put to the owner while this document was drafted.

### Alternative A: Render the video list in the browser from a live endpoint

*   **Pros**: No rebuild is needed; a new video shows within the endpoint's
    cache time. "Nothing new, nothing happens" holds with no extra work.
*   **Cons**: There is no build to fail, so a bad answer has no last good
    version to fall back to and nobody is told. With scripts off the list is
    absent. The layout would depend on data that arrives after the page, which
    puts the one-viewport rule at risk, and the audit stubs the endpoint so it
    would only ever test the fallback. Descriptions in the page head could not
    update.
*   **Reason for Rejection**: It cannot satisfy "a bad answer changes nothing",
    and it removes the list from the page for a visitor without scripts. All
    six reviewers rejected it.

### Alternative B: A scheduled GitHub workflow that commits a data file

*   **Pros**: The facts live in git, so what is live can be rebuilt from a
    commit and "before" is simply the previous commit. No daily deployment when
    nothing changed. The main objection the review recorded, scarce Actions
    minutes, turned out not to apply: a public repository is not metered.
*   **Cons**: GitHub switches a schedule off after 60 days without activity in
    the repository, and uploads are about that far apart, so the refresh could
    stop without notice. The API key would live in a second place. A failure is
    reported by GitHub, not by the host. Whether a commit made by a workflow
    triggers a deployment on the host's free plan is unverified.
*   **Reason for Rejection**: The owner accepted the reviewers' first choice.
    The silent switch-off is the deciding flaw for a job whose purpose is to run
    unattended. One reviewer would have switched to this route once minutes
    proved free; that view is recorded here and not adopted.

### Alternative C: Refresh by hand after each upload

*   **Pros**: Nothing scheduled, no secrets, no dependence on YouTube at build
    time. An upload happens about every two months and the edit is small once a
    generator exists.
*   **Cons**: It depends on someone noticing. The site was wrong for nine days
    in November before anyone did.
*   **Reason for Rejection**: The owner chose the automatic refresh. The
    generator this route would need is the first stage of the chosen route
    anyway, so nothing is lost if the automation is ever dropped.

### Alternative D: Keep "before" in a facts file published by each build

*   **Pros**: Each build compares against what the last one published, so a
    video with no hand-kept entry cannot vanish unnoticed, and a fall back to
    the committed facts is caught.
*   **Cons**: Every build reads the live site over the network. Removals need
    their own list. The first build has nothing to compare with.
*   **Reason for Rejection**: The hand-kept file as the floor needs no state
    between builds. Its known gap stays open: a new video that has no entry yet
    could disappear without the guard tripping.

### Alternative E: Rebuild only when a fact has changed

*   **Pros**: Rebuilds cluster after an upload and then stop. Far fewer builds,
    and fewer chances for a failure notice.
*   **Cons**: It needs compare code in the scheduled function and a published
    facts file to compare against, which is the state Alternative D adds.
*   **Reason for Rejection**: The owner accepted a daily rebuild whose output
    may be identical. It keeps view figures current and adds no state.

### Alternative F: Two layouts for the latest video, one curated and one fallback

*   **Pros**: A video the owner has written a headline for keeps the present
    hand-set look exactly.
*   **Cons**: Two layouts double what the audit has to cover. The fallback would
    be seen only on the day of an upload, which makes it the least tested state
    at the moment it matters most.
*   **Reason for Rejection**: One wrapping layout with size steps serves both
    cases, and the optional headline keeps the owner's hand in it.

### Alternative G: A script that runs before the build, in place of a plugin

*   **Pros**: Simpler to write and to read than a build plugin.
*   **Cons**: The layout audit calls the build tool directly and would skip the
    script, so the audit would test pages the generator never touched.
*   **Reason for Rejection**: The generator has to run wherever the build runs.

### Alternative H: Other ways to limit votes

*   **A new secret as the key for the one-way code.** *Pros*: independent of the
    store's token. *Cons*: one more secret to create and keep. *Rejected*
    because the store's token already exists and is never public.
*   **A single daily cap for everyone, storing nothing about a visitor.**
    *Pros*: no per-visitor data at all. *Cons*: one visitor can use up the
    day's votes for all. *Rejected* for that reason.
*   **Removing `/api/channel` and fixing the channel totals at build.** *Pros*:
    one fewer endpoint. *Cons*: subscribers and total views would be up to a day
    old. *Rejected*: the owner accepted keeping it for those two figures, which
    no other part of the page states.

### Alternative I: Split this design into several documents

*   **Pros**: Each review would be smaller, and a blocker in one package would
    not hold the others.
*   **Cons**: Rules that cross packages, such as typefaces before layout work
    and the security policy last, would be spread over documents. Shared files
    would be planned more than once.
*   **Reason for Rejection**: The owner chose one document for all four
    packages.

### Alternative J: Other treatments of the "All videos" desktop composition

*   **Defer it, or sketch it during the build.** *Rejected*: the owner asked for
    sketches before approving the plan, so the review can test a layout that
    exists.
*   **Sketch B, the picture leads.** The lifted video's still as the largest
    element with its title in display type, and the list as a narrow index.
    *Cons*: it depends on a large still existing for every video, and the
    heading drops below the house size.
*   **Sketch C, a one-line banner title.** *Cons*: it needs the heading moved out
    of the list's container, which the flying card measures from, and the title
    stops fitting one line at 1366 wide if the wording or the count grows.
*   **Reason for Rejection**: The owner chose sketch A, with the drawer names
    removed from the list.

### Alternative K: Other ways to handle the machine counts

*   **No counts in the copy.** *Pros*: nothing to keep true. *Cons*: the site
    loses the line that tells a visitor how much is his and how much is
    invented, and the Ideas page's "six" would still be kept by hand.
*   **Numbers stated once in a small file.** *Pros*: one place to edit.
    *Cons*: no list behind the numbers, so nothing can show they are wrong.
*   **Reason for Rejection**: The owner chose one list, counted at build.

### Alternative L: Other times to run the layout audit

*   **Manual only.** *Cons*: nothing unattended is ever checked.
*   **Daily, against the live site.** *Pros*: the only option that looks at
    what a scheduled rebuild produced. *Cons*: the same 60-day switch-off as
    Alternative B.
*   **Reason for Rejection**: The owner chose every push. The daily rebuilds
    stay unaudited, which the Technical Plan states.

### Alternative M: Smaller choices settled without a gate

*   **A `robots.txt` that disallows everything**, in place of the `noindex`
    header. Rejected: a crawler that may not fetch a page never sees its
    `noindex`.
*   **Two scheduled jobs**, one for the store and one for the refresh. Rejected:
    one job avoids relying on the host's limit, and reading the store first
    keeps that part working when the hook fails.
*   **A stricter content security policy** with per-request nonces and no
    inline style attributes. Rejected for now: the pages are static files with
    41 inline style attributes, and removing those is a rewrite this plan does
    not need. The policy allows style attributes and nothing else inline but
    one hashed script.

--------------------------------------------------------------------------------

## Non-Functional Requirements

**Security and privacy.**

*   Three secrets, all in the host's settings and none in the repository:
    `YOUTUBE_API_KEY` (exists, read by production builds), the schedule's
    bearer secret `CRON_SECRET` and the deploy hook's address
    `DEPLOY_HOOK_URL` (both new). No code logs or returns any of them.
*   `/api/refresh` answers only a request that carries the bearer secret. Without
    it the endpoint returns 401 and does nothing, so its public address cannot
    be used to start builds.
*   Video titles are third-party input. The generator escapes them for HTML text
    and for attribute values, and a unit test feeds it a title containing
    markup.
*   The vote stores a one-way code in place of an address, always with a
    one-day expiry.

**Performance and cost.**

*   A build with the key makes about four requests to YouTube and uses about
    four units of a daily quota of 10,000.
*   One extra build a day on the host, about 360 a year.
*   The pages lose a render-blocking request to another origin and two
    connections when the typefaces move to the site. Nothing else in this plan
    is meant to change page weight.

**Rollout and rollback.**

*   Each of the ten steps below is its own commit and its own deployment, so a
    fault is traced to one step and undone by reverting one commit.
*   The daily job is switched off by removing the schedule entry, or at once by
    clearing `DEPLOY_HOOK_URL`: the function then reads the store and returns
    without starting a build.
*   The content security policy ships report-only first. Turning it into an
    enforced policy is a one-word change in one header's name, and so is turning
    it back.
*   A build with the key that cannot reach YouTube fails. If that blocks an
    urgent push, removing the key from the host's settings makes builds use the
    committed facts until it is put back.

### Additional Resources

*   The review: `docs/review/2026-11-10-production-review.md`
*   The six-lens brief and the owner's answers:
    `docs/designs/production-readiness.md`
*   The chosen "All videos" sketch: `docs/designs/assets/all-videos-sketch-a.jpg`
*   The site's design document:
    `docs/superpowers/specs/2026-10-24-stuffmadehere-site-design.md`

### Future Improvements

*   **At launch**: canonical links, a sitemap and structured data, and lifting
    `noindex`.
*   **Auditing the daily rebuilds**: a scheduled audit of the live site, if the
    60-day switch-off can be lived with.
*   **A stricter policy**: moving the 41 inline style attributes into
    stylesheets would let the policy forbid inline styles altogether.
*   **Drawer names on phones**: removing them there too, if the owner wants the
    list the same at every size.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

The work is ten steps, done in order. Each file below is listed once, with what
changes in it and at which step.

| Step | What it does |
| --- | --- |
| 1 | The vote stops storing addresses; both endpoints return fixed error strings |
| 2 | Typefaces served from the site, then a layout audit run |
| 3 | Right edge cleared, sliders in the door, scripts-off styling, skip link, clean links, footer links, solid carried parts, play button |
| 4 | The generator, from committed facts only: lists, counts, machine counts, one writer |
| 5 | The latest-video block in its one layout, with the fixture and the new audit checks; a second look at step 3's gantry and play-button fixes on the rebuilt block |
| 6 | "All videos": the phone change and desktop sketch A |
| 7 | The fetch, the guard, the daily job, and one deliberate failed build |
| 8 | Simple headers, the cache rule, the policy report-only, the hand sweep, then enforcement |
| 9 | Icons, share cards, privacy note, licence, README, the audit on every push |
| 10 | The review's method run again on production; deferral list and second list written |

### Target Files to Create/Modify

#### 1. `build/facts.mjs` (Create)

*   **Type / Scope**: Build plugin and shared facts logic, plain JavaScript
    module. It is not TypeScript so that it needs no new type package and can
    be imported by `vite.config.ts`, by `scripts/facts.mjs` and by its tests.
*   **Proposed Changes**:
    *   Step 4. `loadFacts()` returns the facts from the file named by the
        `FACTS_FILE` environment variable when set, else from
        `src/data/facts.json`. `mergeHand()` joins them with
        `src/data/videos.hand.json` and `src/data/machines.json` and produces
        one model: videos oldest first with their drawer, per-drawer lists and
        counts, the total as a figure and in words, the count of can't-miss
        videos, the first date, the span in years in words, the latest video,
        and machine counts per page and origin. An id with no hand entry gets
        the drawer `other` and no description.
    *   Step 4. `factsPlugin()` is the Vite plugin. In `transformIndexHtml` it
        fills the named marker blocks (`ledger`, `drawer:<family>`, `sorter`,
        `latest`, `since`) and replaces the named tokens. A marker or token it
        does not recognise, or one left unfilled, fails the build. It serves
        the virtual module `virtual:facts` with `latest` (id, title, date) and
        `total`. In the development and preview servers it maps `/about`,
        `/ideas` and `/log` to their `.html` files.
    *   Step 4. Formatting helpers: number in words up to ninety-nine, a date as
        "1 November 2026", minutes rounded from seconds, views as "about 2
        million" or "about 3.7 million", HTML and attribute escaping.
    *   Step 5. `headingSteps(text)` returns the size step (large up to 18
        characters, middle up to 40, small beyond) and the length of the
        longest word. The `latest` block is written with both.
    *   Step 7. `fetchFacts(key)` reads the channel's totals and uploads list
        page by page, then lengths, view counts and which still sizes exist, in
        batches of fifty. `isVideo()` applies the rule: not on the ignore list,
        at least 180 seconds long, not a live or upcoming broadcast. `guard()`
        throws with a named cause when a request fails or times out after 20
        seconds, when the collected count differs from the total YouTube
        reports for the list, when a title is empty, or when an id in the
        hand-kept file is absent. With `YOUTUBE_API_KEY` set and `FACTS_FILE`
        unset, `loadFacts()` uses `fetchFacts()`.
    *   Step 8. After the pages are built, the plugin hashes the inline script
        of each page and compares it with the hash in the policy header in
        `vercel.json`. A difference fails the build.
    *   **Why**: one place for every rule in goals 2 to 6, runnable by the
        build, the audit and the tests alike.

#### 2. `build/facts.test.mjs` (Create)

*   **Type / Scope**: Unit tests on Node's built-in test runner. No new
    dependency.
*   **Proposed Changes**: Step 4 onward. Cases: the rule (a 170-second upload,
    an ignored id, an upcoming premiere, an ordinary video); the guard (missing
    hand-file id, empty title, short page count, timeout); a video with no hand
    entry lands in `other`; numbers in words; date, length and view wording;
    escaping of a title that contains a tag and a quote; size steps at 18, 19,
    40 and 41 characters and the longest-word length; an unknown token fails;
    the inline-script hash check passes and fails.
*   **Why**: the generator is the new logic that every page now depends on.

#### 3. `src/data/facts.json` (Create)

*   **Type / Scope**: Machine-written data, committed.
*   **Proposed Changes**: Step 4. The 42 videos and the channel totals as of the
    day it is written, in this shape:

    ```json
    {
      "fetchedAt": "2026-11-10",
      "channel": { "subscribers": 4760000, "views": 354586064 },
      "videos": [
        { "id": "…", "title": "…", "date": "2020-03-04",
          "seconds": 1310, "views": 2039199, "still": "maxres" }
      ]
    }
    ```

    `still` is the largest still YouTube has for the video: `maxres`, `sd` or
    `mq`. The first version is written by hand from `src/data/videos.ts` and
    the watch pages; from step 7 the refresh script rewrites it.
*   **Why**: the facts a machine may change, kept apart from what a person
    writes.

#### 4. `src/data/videos.hand.json` (Create)

*   **Type / Scope**: Hand-kept data, committed.
*   **Proposed Changes**: Step 4. One entry per video with its drawer, moved
    from `src/data/videos.ts`; the latest video also gets its description and
    headline, moved from `index.html`.

    ```json
    {
      "ignore": [],
      "videos": {
        "BuRyQYf03xA": {
          "family": "other",
          "description": "A machine for washing a muddy dog without getting mud shaken on you.",
          "headline": "The dog blaster"
        }
      }
    }
    ```

    `family` is one of `cant-miss`, `toolpath`, `explosive`, `lock`,
    `assembly`, `other`. `description` and `headline` are optional.
*   **Why**: the only place a person writes about a video, and the floor the
    guard checks against.

#### 5. `src/data/machines.json` (Create)

*   **Type / Scope**: Hand-kept data, committed.
*   **Proposed Changes**: Step 4. One entry per machine, written first from the
    README's rows and reviewed by the owner before the sentences read from it.

    ```json
    [
      { "name": "Camshaft drum", "page": "home", "from": "new", "counts": true },
      { "name": "Moving hoop", "page": "home", "from": "video",
        "video": "…", "counts": true }
    ]
    ```

    `page` is `home`, `about`, `ideas`, `log` or `everywhere`. `from` is
    `video` or `new`. `counts` says whether the entry is included in the
    numbers the site states.
*   **Why**: the owner's choice of one list, counted at build.

#### 6. `src/facts.d.ts` (Create)

*   **Type / Scope**: TypeScript declaration.
*   **Proposed Changes**: Step 4. Declares the module `virtual:facts` and the
    types of `latest` and `total`.
*   **Why**: the type check covers `src`, and the scripts import that module.

#### 7. `fixtures/facts.new-video.json` (Create)

*   **Type / Scope**: Test data.
*   **Proposed Changes**: Step 5. The committed facts plus one made-up newer
    video that has no hand entry and carries the longest title the channel has
    used, 67 characters, with one long word.
*   **Why**: it is both the check for goal 2 (everything follows one new
    video) and the worst case for goal 6.

#### 8. `scripts/facts.mjs` (Create)

*   **Type / Scope**: Command-line script, `npm run facts`.
*   **Proposed Changes**: Step 7. With `YOUTUBE_API_KEY` in the environment it
    runs `fetchFacts()` and the guard from `build/facts.mjs` and rewrites
    `src/data/facts.json`. It prints what changed: videos added, removed,
    retitled. With no key it stops with a message.
*   **Why**: a build cannot commit, so this is how the repository catches up
    with the live site.

#### 9. `api/refresh.ts` (Create)

*   **Type / Scope**: Serverless function.
*   **Proposed Changes**: Step 7. Accepts GET with the bearer secret; anything
    else gets 401. Reads the vote totals by requesting the site's own
    `/api/vote`, so the store's access code stays in one file, then sends a POST
    to `DEPLOY_HOOK_URL` when it is set. Returns whether the store was read and
    whether the hook accepted the request, and nothing else.
*   **Why**: one scheduled job for the refresh and for keeping the store
    active.

#### 10. `src/assets/fonts/chivo-latin.woff2`, `src/assets/fonts/saira-stencil-one-latin.woff2`, `src/assets/fonts/OFL.txt` (Create)

*   **Type / Scope**: Font files and their licence text.
*   **Proposed Changes**: Step 2. The same two files the pages load from Google
    today: the variable Chivo, covering weights 400 to 900, and Saira Stencil
    One. Both are under the SIL Open Font License, whose text sits beside them.
*   **Why**: goal 9. Under `src/assets` the build gives them hashed names, so
    the one-year cache rule covers them.

#### 11. `public/icon-32.png`, `public/apple-touch-icon.png` (Create) and `scripts/icons.py` (Create)

*   **Type / Scope**: Two images and the script that draws them.
*   **Proposed Changes**: Step 9. The script draws the inline icon's three
    shapes, a blue square, an orange disc and a white bar, at 32 and 180 px
    with Pillow.
*   **Why**: goal 10. Drawn, not rendered, so no credits are spent.

#### 12. `LICENSE` and `LICENSE-EXCLUSIONS.md` (Create)

*   **Type / Scope**: Licence files.
*   **Proposed Changes**: Step 9. `LICENSE` is the MIT text. Its copyright line
    carries the name on the repository's commits unless the owner gives
    another. `LICENSE-EXCLUSIONS.md` lists what it does not cover:
    `src/data/portrait.ts`; the titles in `src/data/facts.json`;
    `public/og/` and `public/log/`; `public/parts/`, which holds generated
    renders and textures; and `src/assets/fonts/`, which has its own licence.
    It states that Shane Wighton's name, titles and pictures are his.
*   **Why**: the owner's fifth decision, with the boundary drawn by path.

#### 13. `public/og/log.jpg` (Create), `public/og/home.jpg`, `public/og/about.jpg`, `public/og/ideas.jpg` (Modify)

*   **Type / Scope**: Share cards, made by `scripts/og.py`.
*   **Proposed Changes**: Step 9. All four are made again from the finished
    pages. The Home card today carries an old sentence.
*   **Why**: goal 10.

#### 14. `vite.config.ts` (Modify)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: Step 4. Registers `factsPlugin()`.
*   **Why**: the generator has to run wherever the build runs, including the
    audit.

#### 15. `package.json` (Modify)

*   **Type / Scope**: Scripts. No dependency is added.
*   **Proposed Changes**: Step 4. `test` runs the unit tests, and `build` runs
    them between the type check and the build. Step 7. `facts` runs
    `scripts/facts.mjs`.
*   **Why**: a failing rule should stop a deployment the same way a type error
    does.

#### 16. `index.html` (Modify)

*   **Type / Scope**: Home page.
*   **Proposed Changes**:
    *   Step 2. The three Google font lines are removed.
    *   Step 3. The servo panel and its two tabs are removed. The door gains a
        third group, "Servo scroll", holding the three sliders, their
        read-outs and the reset button with their present ids. A skip link
        becomes the first element in the body and points at `#top`. Links to
        `/about.html`, `/ideas.html` and `/log.html` in the door and the footer
        become `/about`, `/ideas` and `/log`.
    *   Step 4. The 42 ledger rows, the six drawers' parts and the typed counts
        are replaced by marker blocks and tokens. So are the total in the two
        descriptions in the head, the door's "All 42", the section heading,
        "The same 42", the slip's "42 so far", the nameplate's video drum, its
        "as of October 2026" line and the watch note. The machine counts in the
        hero, the latest-video paragraph and the footer become tokens.
    *   Step 5. The latest-video heading, sentence, link, still and play label
        become one `latest` marker block. The still gains lazy loading. The
        Fire button's link becomes a token.
    *   Step 6. In "All videos" the placard moves out of the list to the line
        between the note and the list, and the generated rows drop their
        in-list preview.
    *   Step 9. Links for the two PNG icons. Three sentences of privacy note in
        the footer.
*   **Why**: the page holds two of the four hand-typed copies and most of the
    stated totals.

#### 17. `about.html` (Modify)

*   **Type / Scope**: About page.
*   **Proposed Changes**: Step 2, fonts. Step 3, servo panel out, door group in,
    skip link, clean links. Step 4. The 42 sorter cards and the six bin totals
    become a marker block and tokens; so do "Forty-two videos in six years",
    "Ten are machines", "42 since 2020-03-04", the sheet's views and
    subscribers, and the watch note. Step 9, icon links and privacy note.
*   **Why**: it holds the third copy of the list and four stated figures.

#### 18. `ideas.html` (Modify)

*   **Type / Scope**: Ideas page.
*   **Proposed Changes**: Step 2, fonts. Step 3, servo panel out, door group in,
    skip link, clean links. Step 4. The picture and caption under the
    days-since counter become a `since` marker block filled from the latest
    video; "Six machines" and "The twelve on the home page" become machine-count
    tokens; the watch note's total becomes a token. Step 9, icon links and
    privacy note.
*   **Why**: its counter and its link both state facts that drifted.

#### 19. `log.html` (Modify)

*   **Type / Scope**: Build log page.
*   **Proposed Changes**: Step 2, fonts. Step 3, servo panel out, door group in,
    skip link, clean links. Step 4, the watch note's total. Step 9, icon links,
    privacy note, and its share image pointing at its own card. The dated
    captions that say 41 are not touched.
*   **Why**: shared chrome, one stated total, and the card it lacks.

#### 20. `404.html` (Modify)

*   **Type / Scope**: Not-found page.
*   **Proposed Changes**: Step 2, the three font lines. Step 9, icon links.
    Nothing else: its list of three pages is outside the review and goes on the
    second list.
*   **Why**: it loads the same typefaces and icon.

#### 21. `src/data/videos.ts` (Modify)

*   **Type / Scope**: TypeScript module.
*   **Proposed Changes**: Step 4. The list, the drawer names and the `Video`
    type are removed. It re-exports `latest` and `total` from `virtual:facts`
    and keeps `watchUrl`, `thumb` and `channelUrl`.
*   **Why**: it stops being a copy of the list.

#### 22. `src/main.ts` (Modify)

*   **Type / Scope**: Home page entry.
*   **Proposed Changes**: Step 3. Passes the door's servo group to
    `mountServo`. Step 4. The lock's label for the "All videos" pin reads the
    total; the live block stops setting the video drum and keeps views and
    subscribers.
*   **Why**: goal 5, one writer.

#### 23. `src/ideas.ts` (Modify)

*   **Type / Scope**: Ideas page entry.
*   **Proposed Changes**: Step 3, the servo group. Step 4. The live request and
    everything it overwrote are removed: the counter's start date, its link and
    the picture under it now come from the build.
*   **Why**: goal 5.

#### 24. `src/about.ts`, `src/log.ts` (Modify)

*   **Type / Scope**: Page entries.
*   **Proposed Changes**: Step 3. Each passes the door's servo group to
    `mountServo`.
*   **Why**: the panel they pass today is removed.

#### 25. `src/lib/live.ts` (Modify)

*   **Type / Scope**: Client for `/api/channel`.
*   **Proposed Changes**: Step 4. The reply's type keeps `live`, `asOf`,
    `subscribers` and `views`.
*   **Why**: the endpoint stops sending the rest.

#### 26. `api/channel.ts` (Modify)

*   **Type / Scope**: Serverless function.
*   **Proposed Changes**: Step 1. A failure returns the built figures with a
    fixed error word, never the caught error's text. Step 4. The reply and the
    built fallback lose `videos` and `latest`; the uploads request is removed.
*   **Why**: review item 4, and goal 5.

#### 27. `api/vote.ts` (Modify)

*   **Type / Scope**: Serverless function.
*   **Proposed Changes**: Step 1. The limit's key becomes `rl:` followed by the
    first 32 hex characters of an HMAC-SHA256 over the address and the day,
    keyed with the store's token. The key is created with a one-day expiry only
    if absent, then incremented, so it can never exist without an expiry. A
    POST whose `Origin` host differs from the request's host gets 403. Every
    failure returns a fixed reason.
*   **Why**: goal 8.

#### 28. `vercel.json` (Modify)

*   **Type / Scope**: Host configuration.
*   **Proposed Changes**: Step 7. The schedule's path changes from `/api/vote`
    to `/api/refresh`. Step 8. Headers on every response, beside the existing
    `X-Robots-Tag: noindex`: `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `X-Frame-Options: DENY`, and
    `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`.
    On `/assets/(.*)`: `Cache-Control: public, max-age=31536000, immutable`.
    The policy, first as `Content-Security-Policy-Report-Only` and after the
    sweep as `Content-Security-Policy`:
    `default-src 'self'; script-src 'self' 'sha256-<hash>'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; font-src 'self'; frame-src https://www.youtube-nocookie.com; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`.
*   **Why**: goals 3, 9 and 12.

#### 29. `src/mechanisms/servo.ts` (Modify)

*   **Type / Scope**: Servo scroll.
*   **Proposed Changes**: Step 3. `mountServo` takes the door's group in place
    of the panel. The toggle, the open state and the hide-over-the-hero
    observer are removed. Where it removed the panel on touch devices and under
    reduced motion, it removes the group.
*   **Why**: the sliders moved; the tabs are gone.

#### 30. `src/mechanisms/pickplace.ts` (Modify)

*   **Type / Scope**: The gantry.
*   **Proposed Changes**: Step 3. A part carries a class from pick to drop.
*   **Why**: the style for that class makes a carried part solid.

#### 31. `src/mechanisms/camshaft.ts` (Modify)

*   **Type / Scope**: Camshaft, ledger and launcher.
*   **Proposed Changes**: Step 4. The list's label reads the total. Step 6. On
    phones the lifted row sets the landing slot's picture, link and caption;
    the code for the in-list preview is removed. On desktop the preview asks
    for the still size named on the row and the flying card takes the
    preview's width.
*   **Why**: review item 7, and sketch A's larger picture.

#### 32. `src/styles/tokens.css` (Modify)

*   **Type / Scope**: Design tokens.
*   **Proposed Changes**: Step 2. Two `@font-face` rules for "Chivo" (weights
    400 to 900) and "Saira Stencil One", both with `font-display: swap`.
*   **Why**: the family names stay the same, so no other rule or canvas code
    changes.

#### 33. `src/styles/page.css` (Modify)

*   **Type / Scope**: Shared stylesheet.
*   **Proposed Changes**:
    *   Step 3. The servo panel's rules are removed; the door's third group is
        styled. Under the scripts-off rule the navigation becomes a block in
        the page's flow on a paper ground in ink, and placards, replay buttons,
        the tilt button, the key and the pin cylinder are hidden. A skip link
        that shows on focus. Footer links at least 44 px tall below 48em. A
        carried part gets the section's ground colour and sits above placed
        parts. The play button becomes a paper triangle on an ink disc.
    *   Step 5. The latest-video heading wraps; three size steps; on phones its
        width stops short of the key; the size is capped so the longest word
        fits.
    *   Step 6. From 64em up, the "All videos" section takes sketch A's
        arrangement. Below 64em the in-list preview's rules are removed and the
        landing slot shows the lifted video.
    *   Step 9. The privacy note in the footer.
*   **Why**: most of packages 2 and 4 is styling.

#### 34. `scripts/audit.mjs` (Modify)

*   **Type / Scope**: The layout audit.
*   **Proposed Changes**: Step 5. A `--facts <file>` option sets `FACTS_FILE`
    for the build it runs. A `--size <width>x<height>` option audits one extra
    size. Two new checks on every audited section: no heading's text is
    clipped by its box, and no heading or wordmark text sits under the fixed
    lock or menu key.
*   **Why**: goal 6, and the fault that has now happened three times.

#### 35. `.github/workflows/audit.yml` (Modify)

*   **Type / Scope**: Continuous integration.
*   **Proposed Changes**: Step 9. A trigger on pushes to `main` beside the
    manual one. A second audit run with the fixture. The comment about scarce
    minutes is replaced.
*   **Why**: the owner's choice of every push.

#### 36. `scripts/og.py` (Modify)

*   **Type / Scope**: Share-card script.
*   **Proposed Changes**: Step 9. A fourth entry for the build log.
*   **Why**: the log shares the Home card today.

#### 37. `public/parts/milled.jpg`, `public/parts/plate-blue.jpg` (Modify)

*   **Type / Scope**: Textures.
*   **Proposed Changes**: Step 9. Encoded again at the same pixel size. Kept
    only if no difference shows at full size on the hero and the nameplate.
*   **Why**: the one free weight saving the review names.

#### 38. `README.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Step 9. "Updating the videos" is rewritten for the
    two facts files, the generator and the daily job. "Live parts" drops the
    video count and adds `/api/refresh` and the two secrets. The mechanism
    headings and tables are made to agree with `src/data/machines.json`.
    "Photograph" becomes "generated texture". The file list gains `build/`,
    `fixtures/` and the new data files. A licence section points at the two
    licence files.
*   **Why**: it is the file the machine-count check reads.

#### 39. `docs/review/2026-11-10-production-review.md` (Modify)

*   **Type / Scope**: The review.
*   **Proposed Changes**: Step 10. For each open bullet, the check that closed
    it and its result, or an entry in a deferral list with the reason. A second
    list for what falls outside this plan, starting with the not-found page's
    three links and the list and drawers with scripts off.
*   **Why**: goal 1.

#### 40. `docs/superpowers/specs/2026-10-24-stuffmadehere-site-design.md` (Modify)

*   **Type / Scope**: The site's design document.
*   **Proposed Changes**: Step 10. A new numbered section that records this
    round and points at this design.
*   **Why**: every earlier round is recorded there.

### What the owner does outside the repository

*   Before step 4 goes live: reviews `src/data/machines.json`.
*   During step 5: signs off screenshots of the latest-video block with the
    fixture at the three phone sizes.
*   During step 6: signs off screenshots of the built "All videos" section at
    seven sizes: the three phones, 768 by 1024, and 1366, 1440 and 1920 wide.
*   Before step 7: creates a deploy hook for `main` in the host's dashboard and
    adds `DEPLOY_HOOK_URL` and `CRON_SECRET` to the production settings.
*   After step 7's deliberate failure: confirms the host's notice arrived.

### Verification Plan

*   **Compilation/Build**: `npm run build`, which type-checks, runs the unit
    tests and builds. Run once with no key and once with
    `FACTS_FILE=fixtures/facts.new-video.json`.
*   **Unit Tests**: `npm test`, the cases listed under file 2.
*   **Static Analysis & Linting**: the type check in the build. No linter is
    added.
*   **Test Coverage Requirement**: every exported function of
    `build/facts.mjs` has at least one passing and one failing case.
*   **E2E/Integration**:
    *   `node scripts/audit.mjs` and
        `node scripts/audit.mjs --facts fixtures/facts.new-video.json`: 24 of 24
        page and size pairs, with the two new heading checks. After step 2 it
        is run on the font change alone.
    *   `node scripts/audit.mjs --size 1920x1080` after step 6, for the "All
        videos" section.
    *   After step 5: the gantry is watched assembling the rebuilt latest-video
        block at 390 by 844 and at 1920 by 1080, and the play button is looked
        at on the new still. The brief placed these two fixes after the rebuild;
        the owner kept them in step 3, so this second look is what covers the
        new markup.
    *   Goal 2: in the fixture build the made-up video is the last ledger row,
        in "Everything else", on the sorting line, in the latest block, and
        every total is 43.
    *   Goal 4: a build with the key and one hand-file id changed to a
        non-existent one fails and names it; the live site is unchanged.
    *   Goal 5: a search of `src` finds no code that sets the video count or the
        latest video at run time.
    *   Goal 7: a screenshot of each page with scripts off; each internal link
        requested by hand returns 200 with no redirect.
    *   Goal 8: after one test vote, the store's keys are listed and none
        contains an address; a POST with another origin returns 403.
    *   Goal 9: on a preview deployment, the hand sweep with the browser's
        console open: scroll each page, press play, open a drawer, fire the
        launcher, load Ideas, download the plate. No policy report.
    *   Goal 12: the response header on the four pages after the last deploy.

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
