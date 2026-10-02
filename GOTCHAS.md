# Gotchas

A running log of things that cost time on this project. Agents read it at
the start of every session and add to it when they hit something new (see
the Session protocol in `AGENTS.md`). Never delete an entry — update its
`Status` instead.

Entries tagged `Scope: template-candidate` are harvested across all client
repos to improve `brandvm/wf-template`.

## Entry format

```md
### YYYY-MM-DD · Short title
- Area: designer | css | loader | release | mcp | ci | js | perf
- Scope: project | template-candidate
- Symptom: what was observed
- Cause: why it happened
- Fix: what was done, or the workaround
- Status: open | fixed <sha> | upstreamed wf-template <sha>
- Found by: claude | codex | human
```

## This project

<!-- Add new entries here, newest first. -->

### 2026-08-24 · Version must be bumped in three snippets, not two
- Area: release
- Scope: template-candidate
- Symptom: Designer canvas and production show different CSS versions.
- Cause: The CSS link lives in the head **and** in `webflow/_embed.html`
  (canvas preview). The Embed is the one people forget.
- Fix: bump `@X.Y.Z` in all three `webflow/` files on every release
  (README "Why there are three Webflow files").
- Status: documented
- Found by: human

### 2026-08-24 · Unversioned flatpickr URLs tracked npm latest
- Area: js
- Scope: template-candidate
- Symptom: Any breaking flatpickr release would have shipped unannounced.
- Cause: CSS and JS URLs had no version.
- Fix: pinned to 4.6.13 (what the unpinned URL resolved to at the time) in
  `webflow/_header.html` and `webflow/_footer.html`.
- Status: fixed 048a617
- Found by: human

### 2026-08-24 · Top-level footer scripts failed together
- Area: js
- Scope: project
- Symptom: A missing library threw a `ReferenceError` and killed the rest
  of the block.
- Cause: The old footer ran everything as top-level code.
- Fix: each section of `js/tvs.js` is its own IIFE with library guards.
  Wrapping the whole file would have silently removed the legacy global
  helpers (`readStrAttr`, `readBoolAttr`, `prefersReducedMotion`), so §1
  keeps them global until nothing is confirmed to call them.
- Status: fixed 048a617
- Found by: human

### 2026-08-24 · `gcl_aw` capture is conversion-critical
- Area: js
- Scope: project
- Symptom: Ad-click IDs can silently stop reaching form submissions.
- Cause: The capture must run on `document`, in capture phase, before
  `DOMContentLoaded`.
- Fix: keep `js/tvs.js` §5 as is; submit a real test form after any change
  and confirm the hidden field arrives (README "House rules").
- Status: documented
- Found by: human

### 2026-08-24 · `video.dynamic-loop` matched nothing on checked pages
- Area: js
- Scope: project
- Symptom: Zero matching elements on home, /contact and /about.
- Cause: Either used on an unchecked page or dead code. The loop also starts
  at 0, not at the `#t=start` fragment, on first pass.
- Fix: none yet — confirm usage before changing or deleting it.
- Status: open
- Found by: human

## Known from previous projects

Inherited from `wf-template`. Found across earlier client repos; listed so
they are not rediscovered. Status refers to the template. Only the entries
that apply to this repo's setup are copied.

### 2026-10-02 · Neutralizers in §03 override Designer styles
- Area: css
- Scope: template-candidate
- Symptom: A style changed in the Designer has no effect on the page.
- Cause: `src/styles.css` loads after `webflow.css`, so the §03 `.w-*` rules
  win same-specificity ties by source order. `.w-layout-blockcontainer
  { max-width }` silently overrode Designer container caps (threestars
  b5f122c); the `.w-dropdown-toggle` reset broke Webflow's chevron spacing
  (reformdd 8c65a5c).
- Fix: reformdd removed ten neutralizers so "Webflow's own defaults now stand
  unopposed" (c2e5f4b). Delete a neutralizer the moment it fights the
  Designer.
- Status: open
- Found by: human

### 2026-10-02 · Root font-size scale drifts from Designer tokens
- Area: css
- Scope: template-candidate
- Symptom: Designer variables named for px values ("Max Width - 1280px")
  render at different sizes; the scale is retuned again and again.
- Cause: The §01 fluid scale sets `:root` font-size, so every rem/em value
  coming out of the Designer scales with it. reformdd retuned it seven times
  (1680 → 1440 → 1680 → clamp → revert → 1920 → 1440); threestars found em
  layout tokens rendering 6.25% short.
- Fix: none general. Agree the scale with the designer before building, or
  drop it and let Webflow variables own sizing.
- Status: open
- Found by: human

### 2026-10-02 · Renaming a Webflow variable silently breaks repo CSS
- Area: css
- Scope: template-candidate
- Symptom: A container cap or token-driven value quietly stops applying.
- Cause: Container/Max Width was renamed to Section/Max Width in Webflow.
  Webflow rewrites its own references but cannot reach this bundle, so
  `var(--_layout---container--max-width, none)` fell back to `none`
  (reformdd 1ca59f6).
- Fix: avoid referencing Webflow variable names in repo CSS; if one is
  needed, log it here so renames get checked.
- Status: open
- Found by: human
