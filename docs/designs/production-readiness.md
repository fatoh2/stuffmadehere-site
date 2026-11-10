# Production readiness for the Stuff Made Here fan site

* **Author:** fatoh2
* **Date:** 2026-11-10

## Overview

This brief records a six-lens brainstorm of one concept: close every open item in `docs/review/2026-11-10-production-review.md` (the audit) without launching the site. Five owner decisions are fixed: no launch now, `noindex` until Shane Wighton has seen the site, the address stays `stuffmadehere.vercel.app`, video facts refresh themselves once a day under a stated rule, and the repository gets an MIT licence for the code only.

All six reviewers completed: design, codebase details, zoom-out, comprehension, implementation readiness and structural. None argued against the five decisions. All six concluded that the concept cannot be planned as written, for three reasons:

1. "Done" has no test. The audit is a hand review, `scripts/audit.mjs` checks none of the nine items, and the nine-item summary leaves out bullets the audit lists as open.
2. Item 1 with decision 4 is several times larger than the summary says, and the refresh rule leaves open choices that change the mechanism.
3. Decision 2 is not in force. The four content pages can be indexed today.

The reviewers agree on the direction: plan against the audit's own bullets, treat the work as four packages, build item 1 in stages whose first stage needs no network, and put the content security policy last. The owner questions in the last section have to be answered before a plan is drafted.

## Analysis

File facts below were read in the repository by at least two reviewers unless one lens is named. The synthesizer re-read a sample of the cited lines for findings 1 to 7 and 10, and they matched. Every statement about Vercel, the YouTube API, GitHub or browser behaviour is an assumption: no reviewer could open a URL or run anything.

**1. "Done" cannot be tested. Blocker, all six lenses.**

- The audit is a manual session: headless Chrome at two sizes, 80 links, screenshots, headers (audit lines 10-18). No script in the repository reproduces it; `scripts/` holds only `audit.mjs` and `og.py`.
- `scripts/audit.mjs` checks section height, sideways scroll and console errors on four pages at six sizes. It never clicks, scrolls or turns scripts off, it skips the 404, and it has no 1920×1080 size, where item 7 was judged. It serves `dist/` through Vite preview, which does not apply `vercel.json` headers.
- A deferred item is still open when the audit is run again, so "deferred with a stated reason" and "comes back clean" conflict. Nothing says where a deferral is written or who accepts it.
- A hand review run twice finds new things, which "nothing outside that list is in scope" forbids.
- Item 7 is a ranking ("the weakest composition"). Some section is always weakest.

Reviewers already found things a second review would raise that are outside the nine. These come from one or two lenses each and were not re-checked:

- `404.html` lines 24-26 offer three pages; there are four.
- The share card `public/og/home.jpg` says "six of them from his videos"; `index.html` line 83 says eight.
- `about.html` lines 204-207 hold static figures that Home's nameplate shows live.
- With scripts off, the ledger stays a clipped window and the drawer bins stay hidden (codebase details; read from CSS, rendered effect assumed).
- `src/missing.ts` line 4 can throw on a malformed address (codebase details).

**2. The nine-item summary is not the audit. Blocker (comprehension), Major (structural, zoom-out).**

The audit ranks its items "in order of weight", and its verdict names three obstacles: stale facts, the missing public-site setup, and fixed controls over content. Items 7, 8 and 9 are not in the verdict; the summary makes all nine equal exit conditions. The audit also says "most of it is a day of work", which decision 4 no longer allows for item 1. The summary drops these bullets:

| Item | Dropped from the summary | Note |
| --- | --- | --- |
| 1 | "The counts of machines in the copy are stale in the same way" | Hand facts, and they disagree: `index.html` line 83 says eight and six, line 139 six and six, line 441 six, six and six. No YouTube refresh fixes them. |
| 3 | No manifest; "the build log shares the Home card" | `log.html` line 13 points at the Home card. |
| 4 | "The API returns raw error strings, and the vote accepts a POST from anywhere" | Code, not configuration: `api/vote.ts` line 75, `api/channel.ts` line 74. |
| 5 | The two milled textures (193 kB and 139 kB) as the weight to cut | No target figure is given. |
| 6 | "Google Fonts and YouTube thumbnails see every visitor's address" | The thumbnail half can only be disclosed; loading from YouTube is a design choice. |
| 7 | Three named phone defects: preview cut off, a placard on it, an empty grey landing slot | The summary's "at every size" is not the audit's wording. |
| 8 | "Controls that need script still show" | |
| 9 | 11 px sorter bin labels; the dark play triangle | The design document (line 363) already defends the labels as a limit. |
| Not checked | The cron's first run, Lighthouse, real phones, Safari, Firefox, a screen reader | The refresh would stand on that cron. |

**3. Decision 2 is not in force. Blocker (zoom-out, comprehension), Major (implementation readiness, codebase details), Minor (design).**

Only `404.html` line 7 carries `noindex`. `vercel.json` has no `headers` block and the repository has no `robots.txt`. The four pages, with a real person's name and portrait, can be indexed now, and the README links the live address. "Stay off" is therefore work, and audit item 3 does not ask for it, so the scope sentence excludes the fix. Assumed: a `robots.txt` that disallows everything would stop crawlers from seeing the `noindex`, so item 3 and decision 2 collide if both are done naively.

**4. The video list has no single source. Blocker (codebase details, structural), Major (design, zoom-out, comprehension).**

- The list is written by hand four times: `src/data/videos.ts`, the ledger rows (`index.html` 175-263), the drawers with typed counts (`index.html` 293-363) and the sorter cards (`about.html` 127-174).
- The three machines read the DOM. `videos.ts` is imported only for `latest` and `watchUrl` (`src/main.ts` line 16, `src/ideas.ts` line 12).
- No generator exists. `README.md` line 125 says "re-run the generator in your tooling".
- The copies have drifted: curly and straight apostrophes, and the same family is "Shop" in the ledger, "Everything else" in the drawers and "the rest" in the sorter. An unassigned video would be labelled "Shop", which is a judgement.
- The number 41 is typed in 20 to 25 places, depending on whether non-rendered ones are counted. They include two `aria-label` strings in TypeScript, meta descriptions, and "Forty-one videos in six years" in words (`about.html` line 123). `log.html` lines 102-111 say 41 as dated history and should stay.

Consequence: item 1 is mostly a generation problem, and a manual refresh would need the same generator.

**5. The refresh rule has gaps that change the mechanism. Blocker (design, comprehension, structural, implementation readiness, codebase details), Major (zoom-out).**

- "Nothing new" against "view figures". Views change daily. If "new" means a new video, the sentence "About 3.7 million people have watched it" freezes hours after an upload and stays for months. If it means any changed fact, the site rebuilds every day and the clause never applies.
- "Fewer than before" has no "before". A build starts from the git checkout and nothing persists between builds.
- A removal has already happened. The design document (line 170) records an upload that "is no longer on the channel". After the next one, every build fails, including unrelated pushes, and the concept gives no way to accept it.
- A count check passes a swap, and at video 51 a one-page fetch of 50 would drop the oldest without tripping the guard (page size assumed).
- "A video" is undefined. The 41 came from the Videos tab; the API's uploads playlist and `videoCount` may include Shorts, streams and premieres (assumed). One Short would become "the latest video".
- No answer is not a bad answer. A timeout, a quota error and a missing key are not covered. Local builds, the audit and forks have no key.
- Titles are third-party input and enter HTML text and attributes, so the generator must escape them.
- "The host emails the owner" is not configured anywhere in the repository. The one case that needs the owner, a new video with no entry, is a successful build and sends nothing.

**6. Two writers of the same facts. Blocker (design), Major (comprehension, structural, implementation readiness, codebase details).**

The nameplate and the Ideas page overwrite their figures from `/api/channel` at run time, cached for an hour (`src/main.ts` 139-146, `src/ideas.ts` 57-75). The rest would come from a daily build. For up to a day after each upload the nameplate says N+1 beside headings that say N, which is the audit's "contradicts itself on one screen". The endpoint also bypasses the "bad answer changes nothing" guard. Decision 4's list omits subscribers and total views, which the machine already changes.

**7. The latest-video heading is not the title, and a long title fails without notice. Blocker (comprehension, implementation readiness), Major (design, codebase details, structural, zoom-out).**

- The heading is a hand-written headline in two hand-split lines, "An apple / peels itself" (`index.html` 134-135). The title is "I made an apple peel itself". The hand-kept file as specified has no field for it.
- It is set `white-space: nowrap` in capitals at `min(7.4vw, 11svh)`, 13.6vw on phones, inside a section with `overflow: hidden` (`src/styles/page.css` 197, 201, 227). An existing 67-character title would be cut off while the section stays one viewport tall and the audit passes.
- Only one per-video sentence exists on the site (`index.html` line 138). The hand-kept file needs a family for every video and a sentence only for whichever is latest.
- Unattended daily deploys are exactly the ones nobody audits. The one-viewport rule is unenforced there.
- Row count is not a risk: the ledger is a fixed-height window, row and drawer titles are already clamped, and the cams divide a full turn by the row count.

**8. Security headers can break the site where the local audit cannot see it. Major, five lenses.**

A content security policy must allow all of these, read from the code:

- one identical inline script on every page (`index.html` line 19), which adds the `js` class. Without its hash the pages take their scripts-off styles while the modules still run, with no thrown error;
- 41 inline `style` attributes; `about.html` 108-113 position the shop labels with them;
- `i.ytimg.com` images, the `data:` icon, and the `www.youtube-nocookie.com` frame (`src/mechanisms/gimbal.ts` line 136);
- Google Fonts origins until the fonts are self-hosted.

Assumed browser behaviour: a boilerplate `Permissions-Policy` would stop tilt, muted autoplay and fullscreen; `Referrer-Policy: no-referrer` or `same-origin` may make the YouTube player refuse to play; `Cross-Origin-Embedder-Policy` would block thumbnails and the embed. Headers can only be verified with `audit.mjs --url` against a deployed preview plus a hand sweep that presses play, because the audit presses nothing.

**9. Caching and fonts. Major (design, implementation readiness, codebase details).**

- Only Vite's `/assets/` is hashed. `/parts`, `/og` and `/log` are requested by fixed names, and renders have been replaced in place before. `immutable` suits `/assets/` only. HTML must keep revalidating or the daily refresh never reaches a returning visitor.
- Font family names are load-bearing: canvas code names "Chivo" literally, and three machines wait on `document.fonts.ready`. Keep the names. Font metrics feed the audit's 1 px tolerance, so re-run it after the font change alone.
- Shrinking a texture's pixel size changes the machined look, because the pattern scale is tied to image pixels (implementation readiness). Re-encode at the same size only.
- Item 5 has no weight target, and the audit rates the same page healthy at 1.06 s.

**10. Privacy. Major (design, implementation readiness, codebase details).**

`api/vote.ts` line 66 increments `rl:{ip}:{day}` and line 67 sets the expiry in a second call, only when the count is 1. If that call fails, the address is stored with no expiry. The address is stored today for any voter, so "not launched" is no reason to defer. The fix is small: a keyed hash of address and day, an expiry set in the same step, a same-origin check on POST, and a fixed error string. The note also has to name browser storage (`sound.ts`, `hoop.ts`, `ratchet.ts`) and the thumbnails.

**11. The licence boundary is not a directory. Major (comprehension), Minor (others).**

`src/data/portrait.ts` is his portrait stored as code. `videos.ts` is a code file made of his titles. `public/og` and `public/log` hold screenshots with his thumbnails. Self-hosted fonts bring their own licence (assumed OFL). The README and the design document disagree on whether the textures are photographs or generated. The exclusion has to be a path list.

**12. Constraints that may be open questions. Major (structural, comprehension).**

- "GitHub Actions minutes are scarce": the repository is public, and standard runners are free for public repositories (assumed; four lenses raised it). `.github/workflows/audit.yml` line 7 says the account is short. One look at the billing page settles it.
- The house rule conflicts with a skip link, a scripts-off fallback and a privacy note, none of which can be a machine. The phrases "gradients" and "small-caps" appear in no repository document (comprehension).
- "No budget for new image renders" does not say whether re-encoding, a PNG icon from the inline SVG, or a share-card screenshot count as renders.

**Assumptions nobody could verify.** That a failed build leaves the previous deployment live; that a failed build started by a deploy hook emails the owner; that `YOUTUBE_API_KEY` is available to builds; that a second daily cron is allowed on Hobby; that the existing 05:00 cron has ever fired (the audit lists it as not checked); that the uploads playlist equals the Videos tab for this channel. The 42nd video's id and title are not in the repository.

## Goals vs. Non-Goals

These are proposals from the reviewers. Each deferral needs the owner's acceptance.

* **In-Scope Goals:**
  * Every bullet under the audit's "Open" heading, not the nine-line summary, has either a named closing check that passes or an entry in a written deferral list kept in the audit file.
  * Scope is "the audit's open bullets plus what decisions 1 to 5 require". That adds the `noindex` on four pages, the hand-kept file, the any-length heading and the failure guard, none of which the audit asks for.
  * `noindex` is applied now, as one `X-Robots-Tag` rule in `vercel.json`.
  * One source for the video list: three HTML blocks, every count and the latest-video block are generated at build from a facts file plus a hand-kept file keyed by video id.
  * A daily refresh that satisfies decision 4, with the build as the only writer of the video count and the latest video.
  * One latest-video heading layout that holds one viewport at the six sizes for a worst-case title, proven by a committed fixture and a new audit assertion that the heading is not clipped.
  * Items 2 and 8, clean links, skip link, footer tap targets, the gantry overlap and the play triangle.
  * Item 7 restated as its three phone defects. The desktop composition needs an owner-approved sketch or a deferral.
  * The vote key hashed, the API hardened, self-hosted fonts, a privacy note in the footer, PNG and touch icons, a share card for the build log.
  * Simple security headers, an `immutable` rule for `/assets/` only, then a content security policy in report-only mode before it is enforced.
  * A licence file with exclusions listed by path.
  * One deliberate failed build to prove that the last good version stays live and the email arrives.
* **Out-of-Scope Non-Goals:**
  * Sitemap, structured data and canonical links: deferred to launch, reason decision 2. Design alone would add canonical links now.
  * A `robots.txt` that disallows everything, and the web manifest: dropped.
  * A runtime endpoint that the pages render the list from.
  * Hashing the files in `public/`, a nonce-based policy, Trusted Types, `Cross-Origin-Embedder-Policy`.
  * Image weight beyond two free changes (a lazy attribute on the still at `index.html` line 149, same-size re-encoding of the two textures): deferred, no target and the audit rates the page healthy.
  * Re-hosting YouTube thumbnails: closed by disclosure in the privacy note.
  * The 11 px sorter labels: deferred, the design document records them as a limit.
  * The audit on every push: deferred until the Actions billing question is answered.
  * A fifth page for the privacy note, and new link, header or Lighthouse tooling.
  * Rewriting `log.html`'s historical captions and screenshots that say 41.
  * Findings from the second audit run that are not in the first: they open a new list.

## Alternatives Weighed

**Refresh mechanism.** All six lenses picked the first column. The audit's own "manual refresh" option is not a rival: its generator is stage A of every route.

| Sub-rule of decision 4 | Vercel cron calls a deploy hook; fetch and generation at build | Runtime endpoint the pages render from | Scheduled GitHub workflow commits a data file |
| --- | --- | --- | --- |
| Nothing new, nothing happens | A deployment every day unless a compare step runs first | Holds | Holds: no diff, no commit |
| Facts only; the hand file decides the rest | Holds | Holds, but the merge moves to run time | Holds |
| Bad answer: build fails, last good stays, host emails | Holds once "before" has a home; the email for hook builds is assumed | Does not hold: no build to fail, no last good version, no alert | Guard and "before" live in git; the email comes from GitHub, not the host |
| Scripts off | List is in the HTML | List is absent, against the design document (line 46) | List is in the HTML |
| Other failure modes | A YouTube outage fails an unrelated push. A removed video blocks every deploy until the hand file is edited. The cron path is a public URL and needs a secret. The hook URL is a new secret. No layout check on unattended builds. What is live is not reproducible from a commit | Layout depends on run-time data, so the one-viewport rule is at risk. The audit stubs `/api` and would only test the fallback. Meta descriptions cannot update | Against the stated constraint. The key lives in a second place. Idle schedules are disabled after 60 days while uploads are about 90 days apart (assumed). Bot commits may not deploy on Hobby (assumed) |
| Verdict | Picked by all six | Rejected by all six | Second choice; comprehension would switch to it if Actions minutes prove free |

**Where "before" lives.**

- The hand-kept file is the floor: every id in it must come back with a non-empty title, and deleting an entry is how the owner accepts a removal. No state between builds, and the first build needs none. Picked by zoom-out, implementation readiness, codebase details and structural. Gap: a video with no entry can vanish without tripping the guard.
- Each build publishes a facts file that the next build reads from production. Picked by design. It closes the gap above and catches a shrink back to the committed snapshot, at the cost of a network read of the live site in every build and a `retired` list for removals.

**What "new" means.**

- An unconditional daily rebuild, with identical output accepted as "nothing happens". No compare step and no stored state, and view figures stay current. Picked by zoom-out and codebase details. Cost: about 360 builds a year that change nothing, each a chance for a failure email.
- A gate in the cron function that compares rounded facts with the published facts file and calls the hook only when they differ. Picked by design. Rebuilds cluster after an upload and stop. Cost: the compare code and the published file.

**Latest-video heading.** One wrapping layout for every video, with a size class chosen at build from the title's length and the sentence optional, against two layouts (curated and fallback). Design, structural and zoom-out picked one layout: two double the audited surface, and the fallback would be the least tested state on upload day. Whether an optional hand-written headline field survives is an owner question.

**Where the generator runs.** A Vite plugin using `transformIndexHtml`, against an npm pre-build script. All who addressed it picked the plugin: `scripts/audit.mjs` line 75 calls Vite's `build()` directly, so a pre-build script would be skipped by the audit. With no key the build reads the committed snapshot, which keeps local builds and the audit offline and repeatable.

**`/api/channel`.** Delete it and bake channel totals at build (design, codebase details), or keep it for subscribers and total views only (structural, implementation readiness). Either way the video count and latest video come from the build.

**Rate-limit key.** A keyed hash using the existing store token, so no new secret (design, zoom-out, codebase details); a new secret variable (implementation readiness); or a global daily cap that stores nothing (implementation readiness). The key must not be in the public repository in any case.

**Video 42.** Add it by hand in stage A (structural), or leave the site at 41 so the first automated run is a real end-to-end test (implementation readiness).

## Key Decisions & Staging for Next Steps

**Owner questions, with the default the reviewers lean to.** A plan cannot be drafted until these are answered. Accepting the defaults is one answer.

| # | Question | Proposed default |
| --- | --- | --- |
| 1 | Is "done" the rule in the first in-scope goal, with deferrals written in the audit file and new findings on a new list? | Yes |
| 2 | Does "nothing new, nothing happens" allow a daily rebuild whose output is identical? | Yes; no compare step |
| 3 | Is "before" the hand-kept file, with deleting an entry as the way to accept a removal? | Yes |
| 4 | With the key present and no usable answer from YouTube, does an ordinary push fail? With no key, does the build use the committed snapshot? | Fail; snapshot |
| 5 | Do Shorts, streams and premieres count as videos? | No; one mechanical rule plus a hand-kept ignore list, after one real API call shows what the playlist holds |
| 6 | Is the latest-video heading the YouTube title for every video, or is a hand-written headline kept as a third hand field? Does "title alone" still show date, length and views? | One layout; headline optional; facts stay |
| 7 | Are subscribers and total views machine-changeable, and does `/api/channel` stay? | Yes; build is the only writer of count and latest video |
| 8 | What are the true machine counts (six or eight from his videos), and are the build-log captions exempt? | Owner states the counts; captions exempt |
| 9 | Do the PID sliders move into the door or go? | Owner's call |
| 10 | Who signs off item 7, on which screenshots, and is 1920×1080 an acceptance size? | Owner, six sizes plus 1920×1080, phone defects first |
| 11 | Which rate-limit key option? | Keyed hash with the existing store token |
| 12 | Are the skip link, the scripts-off fallback and a plain-text privacy note in the footer exempt from the house rule? | Yes |
| 13 | Is the licence exclusion a path list, and what is the origin of the three textures? | Path list; owner states origin |
| 14 | Is Actions usage metered for this public repository? | Check the billing page |
| 15 | Is video 42 added by hand or left for the first automated run? | Owner's call |

**Checks in the Vercel and Google dashboards before the plan relies on them.**

- The 05:00 UTC cron has fired at least once.
- `YOUTUBE_API_KEY` is exposed to builds, and its restrictions do not block build machines.
- A second daily cron is allowed on Hobby, or the refresh function also does the store's keep-alive read.
- Failed-deployment emails are on, and a deploy-hook build that fails sends one.

**Work packages.** Four packages under one milestone (structural):

1. Facts: item 1, decision 4, and item 9's gantry overlap and play triangle, in stages A (generation from a committed snapshot, no network), B (the any-length heading, with fixtures), C (the fetch, the guard and the trigger).
2. Chrome: items 2 and 8, clean links, skip link, footer targets.
3. Setup and policy: items 3 to 6 and the licence.
4. The "All videos" composition: item 7.

**Order.** The six lenses gave six different orders. Most of them share these points: `noindex` first, item 2 before item 8, stage A before item 7, stage B before stage C, fonts before the content security policy, and that policy last. The order below keeps those points; where a step follows one lens, it says so.

1. Fixes for what is exposed today: the `noindex` header, and the hashed vote key with the API hardening. Placing the vote fix first follows comprehension; the others place it with the setup work.
2. Self-hosted fonts, then an audit run, so later layout work is measured against final font metrics. Placing fonts this early follows implementation readiness; the others place them later, before the policy.
3. Item 2, then item 8 (removing the tabs shrinks the scripts-off work), with the links, skip link and footer targets.
4. Stage A, as one deploy whose output matches today's pages apart from the corrected counts and reworded copy.
5. Stage B with its fixtures and the new audit assertion, then the gantry overlap and the play triangle on the new markup.
6. Item 7's phone defects on the generated rows. It must keep the camshaft's DOM contract (`.row`, `data-id`, `data-views`, `.row__inline`).
7. Stage C: the build-time fetch and guard, then the secret-guarded cron and deploy hook, then the forced failure.
8. Simple headers and the `/assets/` cache rule; the content security policy in report-only mode on a preview, a hand sweep (scroll each page, press play, open a drawer, fire the launcher, load Ideas, download the plate), then enforcement.
9. Icons, share cards regenerated, the privacy note, the licence path list, README corrections.
10. The audit's written method run again against production. New findings go on a new list.

**Next step.** The owner answers the table and runs the four dashboard checks. The plan is then drafted against the audit's bullets and this brief.

**Since the review (10 November, checked by the session that ran it).**

- Decision 2 is now in force. One `X-Robots-Tag: noindex` header in `vercel.json` covers every response (commit `51e7d1d`), confirmed on the four pages and a part image in production. There is no `robots.txt`.
- The Actions constraint was stated too strongly. Standard GitHub-hosted runners are free for public repositories, and this repository is public. A scheduled workflow is still a poor fit: GitHub disables schedules after 60 days without repository activity, and uploads are further apart than that.
- `YOUTUBE_API_KEY` is scoped to Production in the Vercel project, so production builds can read it and preview builds cannot.
- The API reports 42 videos; the site lists 41 and one upload is missing. That fits an uploads list with no Shorts today. One real playlist call is still needed before the rule for question 5 is fixed.
- The 05:00 UTC cron has not had its first run yet.

**Owner answers (10 November).**

- The fifteen questions are answered with the proposed defaults. Two were set by the owner: the speed and acceleration sliders move into the menu door (question 9), and video 42 is added by hand now (question 15).
- Video 42 is in, in the same commit as this note: all four copies of the list, every sentence that states the total, the built fallback in `api/channel.ts`, and the latest-video section. The headline is the machine's name from the video's own still, "The dog blaster". A first attempt with a longer first line ran under the fixed menu key on phones while the layout audit still passed. That is analysis point 7 happening for real: the heading needs a fit check, and the check has to include the key.
- Consequence for stage C: the first automated run will find nothing new. The end-to-end test therefore needs a fixture, a made-up newer video on a preview build, as well as the forced failure.
- Still to be stated before the draft relies on them: the machine counts for question 8 (the hero says eight from his videos and six not built, the README lists fourteen on Home, the latest-video paragraph and the footer still say six and six), and the origin of the three textures for question 13.
- Question 14 is settled by fact: Actions minutes are not metered for a public repository.
- Dashboard checks: the API key's scope is confirmed. The cron's first run and the failed-deployment email are still to be seen.

