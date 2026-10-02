# TVS Animal Hospital — Webflow custom code

Agent instructions for this repository. Codex, Cursor and similar tools read
this file directly; Claude Code reads it through `CLAUDE.md`. It is the single
source of agent rules — edit this file, never a copy of it.

## Project facts

- Client / site: TVS Animal Hospital
- GitHub: `hamounbv/tvs`, default branch `main`
- Webflow site ID: unknown — fill in
- Staging site: unknown — fill in (`*.webflow.io`)
- Production domain: `tvshospitals.com`
- CDN: `https://cdn.jsdelivr.net/gh/hamounbv/tvs@<VER>/`
  (`css/tvs.min.css`, `js/tvs.min.js`)
- Production release: `v1.0.0` (pinned as `@1.0.0` in all three snippets)

## Who owns what

Webflow owns markup, layout, classes, components, CMS content, interactions
**and styling by default**. This repo owns JavaScript behaviour and only the
CSS the Designer cannot express.

That split is deliberate. Repo CSS loads after `webflow.css`, so it wins
every specificity tie against the Designer. Any rule written here that the
Designer could have expressed becomes a hidden override: the next person
changes that style in the Designer, nothing happens, and the only fix is
edit `css/tvs.css` → tag → bump the snippets → paste into Webflow → publish.
Every project has lost time to that loop.

## CSS policy — Designer first

Before writing any CSS, decide where it belongs.

1. **Can the Designer do it?** A class or combo class style, a variable, a
   breakpoint style, a state (hover/focus/current), an interaction. If yes:
   - With the Webflow MCP connected, apply it in Webflow (styles and
     variables tools), then tell the user what was changed.
   - Without the MCP, give the user exact Designer steps: class, breakpoint,
     property, value.
   - Do **not** add it to `css/tvs.css`.
2. **Repo CSS needs a reason.** Every rule — or the section header comment
   covering a group of rules — carries one tag from this list:

   ```css
   /* repo-css: <tag> — <short why> */
   ```

   | Tag | Use for |
   | --- | --- |
   | `js-state` | Classes/attributes a module toggles (`.is-open`, `.is-loading`, `[data-state]`) |
   | `designer-cant` | Name the feature: `:has()`, complex combinators, `@keyframes`, `@supports`, container queries, `::marker`, `color-mix()`, masks |
   | `third-party` | Swiper, Lenis, Finsweet or other library markup |
   | `canvas-preview` | `.w-editor`, `.wf-design-mode`, `html:not([data-wf-domain])` helpers |
   | `approved-base` | A site-wide base the user explicitly asked to keep in code |
   | `override-webflow` | Overriding a `.w-*` default or a Designer style |

3. **`override-webflow` needs the user's explicit approval** and a
   `GOTCHAS.md` entry explaining why. Ask before writing it.
4. **Never, without that approval:** set `font-size` on `:root`/`html`,
   neutralize `.w-*` defaults, or reference Webflow variable names
   (`--_layout---…`, `--_typography---…`). A renamed variable in Webflow
   silently breaks every rule that reads it — Webflow rewrites its own
   references, never this repo's.
5. **Ambiguous request?** Say which parts go in the Designer and which go in
   code before editing anything. "Make the heading bigger on mobile" is a
   Designer breakpoint style, not a media query here.

Existing rules predate this policy and are untagged; add a `repo-css` tag to
any rule you touch, and question rules the Designer could own.

## How this repo works

No build, no package manager, no CI, no staging bundles. Plain readable
source is committed; jsDelivr serves it from a pinned git tag and
auto-minifies on request (`*.min.css` / `*.min.js` — never commit minified
files). `README.md` holds the cutover notes, QA checklist and the list of
deliberate differences from the old inline code; read it before changing
behaviour.

```
css/tvs.css              all site CSS (§09 = flatpickr theme, `--datepicker-*` tokens)
js/tvs.js                all site JS (SmartSwiper, flatpickr, Lenis, gcl_aw, video loop)
webflow/_header.html     Site Settings → Head (GTM, flatpickr CSS, CSS link)
webflow/_footer.html     Site Settings → Footer
webflow/_embed.html      the `G | Embed Code` global component (GTM noscript + CSS link)
```

- **Where CSS loads:** **twice, on purpose** — a `<link>` in the head
  (production) and the same pinned URL in the `G | Embed Code` component
  (`webflow/_embed.html`). The canvas renders Embeds but not head code, so
  the Embed copy is what makes repo CSS **visible on the Designer canvas**.
  It shows the last *released* tag, not unreleased edits. Do not "fix" the
  duplicate. The head's inline `<style>` (Lenis, dev-support hiding) is repo
  CSS too and follows the same policy.
- **Script order:** the footer uses static `<script defer>` tags, which run
  in document order — libraries first, site JS last. Keep it that way.
  GSAP/jQuery/the Webflow runtime are emitted by Webflow itself; never add a
  second copy.
- **The Designer canvas never runs scripts.** Anything shown only after JS
  runs is invisible there; use a `canvas-preview` rule if the Designer needs
  to see it.

## Snippets are not versioned

The `webflow/*.html` files are copies of what is pasted into Webflow. A
change to them does nothing until it is re-pasted and the site published —
say so in the commit message, and keep the files identical to what is
installed.

## Release

1. Edit `css/tvs.css` or `js/tvs.js`, commit, push to `main`.
2. Tag the next version: `git tag vX.Y.Z && git push --tags`
   (`v1.0.1` is served as `@1.0.1`).
3. Bump `@X.Y.Z` in **all three** `webflow/` files (the Embed is the one people forget), commit.
4. The user pastes the updated snippet(s) into Webflow and publishes; verify
   the new files load (DevTools → Network).

Tagged jsDelivr URLs are immutable: never move a pushed tag, cut the next
patch. Never use `@main`, `@latest` or a branch URL in production (`@main`
is cached up to ~12 h and ignores query-string cache-busters). Rollback =
point the snippets at the previous tag. Emergency purge:
`https://purge.jsdelivr.net/gh/hamounbv/tvs@X.Y.Z/<path>`. The repo must
stay public — jsDelivr's `/gh/` endpoint cannot serve private repos.

There are no tests or linters. Before tagging, sanity-check the `@main`
jsDelivr URL or a local copy on the Webflow staging domain, and run the
README's QA checklist.

## Project notes

- The `gcl_aw` capture (`js/tvs.js` §5) is conversion-critical: it stays
  on `document`, in capture phase, not behind `DOMContentLoaded`. Test a
  real form submission after any change to that file.
- Every third-party CDN URL gets a pinned version (flatpickr is pinned to
  4.6.13; Swiper is loaded on demand by SmartSwiper).
- `window.onyxSwiper` is kept as an alias of `window.tvsSwiper`.

## Webflow MCP limits

Worked around, not fixed — do not rediscover these.

- `custom_value` is rejected for Color and Size variables (`color-mix()`,
  `oklch()`, `calc()`). Create those through the variables JSON import with
  `valueType: "custom"`.
- No variable rename or reorder within a collection. Rename in the Designer
  (preserves ids and aliases; recreating does not).
- The WHTML importer drops `class` attributes. Create the style, then apply
  it.
- `get_all_elements` does not descend into component definitions — pass the
  component scope. An element "missing" from a page is usually inside one.
- Concurrent Designer edits change element ids. Re-query on "Element not
  found" instead of assuming deletion.
- Responsive styles are only returned when breakpoints are requested
  explicitly (`include_breakpoints`).

## Session protocol

1. **Start:** read `GOTCHAS.md`. Do not repeat a mistake already logged.
2. **During:** when something surprising costs time — a Webflow quirk, an
   MCP limitation, a fix that had to be reverted — add an entry to
   `GOTCHAS.md` in the same commit as the fix, using the format at the top
   of that file.
3. **Scope:** tag an entry `template-candidate` when it would recur on other
   Webflow custom-code projects; those entries are collected later to
   improve `brandvm/wf-template`. Otherwise tag it `project`.
4. Never delete entries. Update `Status` when something is fixed or
   upstreamed.
