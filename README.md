# tvs

Version-controlled custom code for **tvshospitals.com** (Webflow), served through **jsDelivr**.

```
css/tvs.css            → all site custom CSS (single source of truth)
js/tvs.js              → all site custom JS (SmartSwiper + flatpickr + Lenis + gcl_aw + video loop)
webflow/_header.html   → the Site Settings → Head block (paste into Webflow)
webflow/_footer.html   → the Site Settings → Footer block (paste into Webflow)
webflow/_embed.html    → the `G | Embed Code` global component (paste into Webflow)
```

`css/tvs.css` consolidates the sandbox-hosted stylesheet plus the "staging only" `<style>` block that lived in the global embed — the global-component pointer-events rules, the button-circle hover, the gallery item borders, and the whole flatpickr theme (now section 09, with its colours lifted into tokens). `js/tvs.js` consolidates the sandbox-hosted SmartSwiper file plus the four inline footer scripts: the flatpickr init, the Lenis init, the gcl_aw ad-click capture, and the dynamic video loop.

## Why there are three Webflow files, not two

The other repos in this account ship `_header.html` and `_footer.html`. This one adds `_embed.html` because TVS has a genuine third injection point: the global embed component carries the GTM `noscript` iframe **and** a second copy of the stylesheet link.

**The stylesheet is linked twice on purpose.** The Webflow Designer canvas does not execute head custom code, but it does render embed elements — so the embed copy is what makes the site styles visible while designing. Same URL both times, so the browser makes one request and serves the second from cache; the only cost is one extra `<link>` element in the body. Anyone auditing the site will flag it as a duplicate. It isn't a mistake.

The practical consequence: **when you bump the version, bump it in all three files.** The embed is the one people forget.

## jsDelivr rules (the important ones)

- **The repo must be public.** jsDelivr's `/gh/` endpoint doesn't serve private repos. (Fine — this code ships to every visitor's browser anyway.)
- URL shape: `https://cdn.jsdelivr.net/gh/hamounbv/tvs@VERSION/path/file`
- **Auto-minify:** request `tvs.min.css` / `tvs.min.js` and jsDelivr generates the minified file for you — commit only the readable source.
- **Pin a tag for production** (`@1.0.0`). Tagged URLs are cached permanently on the CDN — deploys are immutable and instant to roll back (just point the snippets at the previous tag).
- `@main` works for testing but is cached up to ~12 h — never use it in production.
- Emergency cache purge: `https://purge.jsdelivr.net/gh/hamounbv/tvs@1.0.0/css/tvs.min.css`

## Release workflow

1. Edit `css/tvs.css` or `js/tvs.js`, commit.
2. Tag: `git tag v1.0.1 && git push --tags` (tag names with `v` work as `@1.0.1` on jsDelivr).
3. Bump the version in **all three** `webflow/` files, commit.
4. Paste the updated blocks into Webflow, publish.
5. Verify the new files load (DevTools → Network), spot-check pages.

Rollback = step 3–4 with the previous tag.

## One-time Webflow cutover

**Replace** the head custom code with `webflow/_header.html`, the footer custom code with `webflow/_footer.html`, and the contents of the `G | Embed Code` component with `webflow/_embed.html`.

**Then confirm nothing references the sandbox any more:** search Site Settings, page settings and every embed for `8n3dq9.csb.app`. There were two references — the stylesheet in the embed and `tvs-main.js` in the footer — and both are now replaced.

**QA before publishing:** the review slider on the homepage (autoplay, loop, prev/next, and the edge-fade on the arrows), the four date fields on /contact opening a white-themed flatpickr, smooth scrolling, the tab-click slider repair on /contact, and — most important — **submit a real test form and confirm the `gcl_aw` hidden field arrives** in the Webflow form submission.

**Known trade-off:** the head stylesheet doesn't render on the Designer canvas, which is exactly what the embed copy is for. That copy is pinned to a tag, so while you're iterating on CSS you'll be designing against the last released version — bump the tag, or point the embed at `@main` temporarily, when the styles themselves are what you're changing.

## What changed vs the live code — review these

v1.0.0 is not byte-for-byte identical. Every difference is deliberate and listed here so you can veto any of it:

| Change | Why |
|---|---|
| `window.onyxSwiper` → **`window.tvsSwiper`, with `onyxSwiper` kept as an alias** | Both names point at the same frozen object. The global is live on the site today, so something may call it; the alias means nothing breaks while new code can use the clean name. |
| **flatpickr pinned to 4.6.13** (CSS and JS) | Both URLs were unversioned, so the site was silently tracking npm's latest and a breaking release would have landed unannounced. I checked what the unpinned URL resolves to right now — 4.6.13 — so this pin freezes exactly what's live rather than changing it. |
| flatpickr and Lenis now load with `defer` | They were parser-blocking. Deferred scripts still run in document order, so init order is unchanged. |
| Each script section wrapped in its own IIFE with library guards | The old footer ran everything as top-level code. A missing library threw a `ReferenceError` and killed whatever followed it in the same block. Now flatpickr failing can't take out Lenis, and Lenis failing can't take out the gcl_aw capture. |
| Lenis: `ScrollTrigger` and `gsap` guarded, with a plain rAF fallback; instance exposed as `window.lenis` | GSAP 3.15.0 and ScrollTrigger are confirmed live on the site, so the guards are belt-and-braces rather than a fix. Exposing the instance means future code can scroll through Lenis instead of fighting it. |
| Dynamic video loop is now idempotent (`data-loop-bound`) and DOM-ready-safe | It queried the DOM at parse time; under `defer` that had to move. The flag stops a second run from stacking duplicate `timeupdate` listeners. |
| Empty rule `.filter-radio-button.w--redirected-checked ~ .label-filter-menu {}` removed | It had no declarations, so removing it changes nothing. |
| Flatpickr theme colours lifted into `--datepicker-*` tokens | Same rendered output; the four hex values are now in one place at the top of the file instead of scattered through eleven rules. |
| Mojibake in two comments repaired (a UTF-8 em-dash that had been saved as Latin-1) | Cosmetic, comments only — but it makes the file grep-clean. |
| Duplicate `<meta name="viewport" … maximum-scale=1>` removed from the head | It disabled pinch-zoom, which Lighthouse flags as an accessibility failure. Webflow already emits a correct viewport tag. Keep form inputs at ≥16px to stop iOS zooming on focus. |
| The legacy helpers (`readStrAttr`, `readBoolAttr`, `prefersReducedMotion`) kept as **globals** | Nothing in this bundle uses them and the old file's own comment invited deleting them — but they were globals before, and page-level code might call them. Wrapping the file in an IIFE would have removed them silently. Section 1 keeps them; delete it once a search of the Webflow custom code confirms nothing calls them. |

## Observations — not changed, worth a decision

- **`video.dynamic-loop` matched nothing.** I checked the homepage, /contact and /about and found zero elements with that class. The loop script is either for a page I didn't check or it's dead code. It costs almost nothing to keep, but worth confirming.
- **The loop starts at 0, not at `start`.** On a `#t=start,end` fragment the video plays from the beginning on first pass and only honours `start` after the first loop. That's how it behaved before, so I left it. If the intent was to start inside the clip, set `video.currentTime = startTime` on `loadedmetadata` too.
- **SplitText is loaded site-wide** (`gsap/3.15.0/SplitText.min.js`) alongside GSAP and ScrollTrigger. If no interaction actually uses it, that's a free payload saving on every page.

## House rules

- Never edit CSS/JS inline in Webflow again — if it's style or behavior, it goes in this repo.
- Every third-party CDN URL gets a pinned version. An unversioned URL is a breaking change waiting for a quiet afternoon.
- The `gcl_aw` capture in `js/tvs.js` section 5 is conversion-critical: it must stay on `document`, in **capture** phase, and must not be moved behind `DOMContentLoaded`. Test a real form submission after any change to that file.
