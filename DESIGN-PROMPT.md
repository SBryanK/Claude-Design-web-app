# Design directive (portable)

Copy this whole block into any project brief or coding agent. It carries the
method and the craft floor, not a colour scheme — supply your own palette where
marked. Everything else is meant to be followed literally.

---

```
# DESIGN DIRECTIVE

You are the design lead on this project. Follow this directive. Where it
conflicts with your defaults, this wins. Where the brief pins something, the
brief wins over this.

## 0. Start by choosing a world, not a layout

Before writing any code, answer these three, in one or two sentences each, and
state them back to me:

- THESIS      What does this surface exist to make the reader do or understand?
              Name the category default it is refusing.
- OWN-WORLD   The one concrete visual system the whole surface lives in. Derive
              it from the SUBJECT'S material culture — the documents, instruments,
              maps, ledgers, specimens, or machinery the real users actually
              handle. Not from what other products in this category look like.
- FIRST       What exactly is in the first viewport, and why is that the answer
  VIEWPORT    rather than a description of the product?

Then write those three into an HTML comment at the top of the page, and build to
them. If I ask for changes later, revise that comment with the change.

Rules for the world:
- One world, committed. Do not blend two.
- It must survive: navigation, quiet and dense content, interaction states, empty
  states, and a substantially different screen later.
- If the world is `X`, every ornament must be doing work `X` would do. A contour
  line on a map is data. A contour line on a checkout page is costume.

## 1. Typography

Two faces, one job each. Never more.

- DISPLAY face: a high-contrast serif, or a face with obvious editorial
  character. It takes page titles, section statements, and large standalone
  figures. Choose one that ships a SINGLE weight (400) — scale and space then do
  the work a bold weight would otherwise do, and the result reads as editorial
  rather than as a dashboard.
- UI face: a neutral grotesque for every interface surface, label, table, and
  paragraph.

Stack:
  --font-display: "<display face>", <serif fallbacks>;
  --font:         "<ui face>", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;

Self-host every face as woff2 (OFL or licensed). Fetch nothing at runtime.

### Scale — fluid, with real steps

Every step is a `clamp()` spanning a wide viewport range, so a heading is a
different size of thing, never a bigger paragraph.

  --fs-2xs:     0.6875rem;
  --fs-xs:      0.75rem;
  --fs-sm:      0.8125rem;
  --fs-base:    0.875rem;     /* body */
  --fs-md:      1rem;
  --fs-lg:      clamp(1.0625rem, .98rem + .35vw, 1.25rem);   /* lede */
  --fs-xl:      clamp(1.375rem, 1.15rem + 1vw, 1.75rem);     /* panel heading */
  --fs-2xl:     clamp(1.75rem, 1.32rem + 1.5vw, 2.5rem);     /* big figure */
  --fs-3xl:     clamp(2.125rem, 1.55rem + 2.4vw, 3.25rem);
  --fs-4xl:     clamp(2.5rem, 1.7rem + 3.6vw, 4.25rem);      /* page title */
  --fs-display: clamp(2.75rem, 1.85rem + 4.4vw, 5.5rem);     /* hero statement */

### Typographic rules

- Display weight is always 400. Never bold a display heading; increase its size
  instead.
- Letter-spacing floor is -0.04em. Use -0.02em to -0.03em; anything tighter is
  amateur.
- Display line-height 1.0 to 1.05. Body line-height 1.5 to 1.6.
- Body measure 65–75 characters. Ledes 55–68ch. Never a full-width paragraph.
- Font sizes below 0.75rem are for uppercase labels only, never prose.
- EVERY figure in a table, stat, or value column gets
  `font-variant-numeric: tabular-nums`. Apply it globally to numeric classes,
  table cells, and definition values.
- Placeholder text and body text must clear 4.5:1 contrast. Secondary text on a
  coloured surface is tinted FROM that hue, never grey.
- A display headline of one or two clauses reads best forced onto its own line
  with `<br>`. Suppress that break below ~720px and ensure a space survives it.

## 2. Layout and rhythm

- Spacing scale, used for everything: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72px.
- Radii: 4px (tags, checkboxes), 8px (controls), 12px (inner blocks, notes),
  16px (cards/panels), pill for small controls only. Cards stay in the 12–16px
  band.
- Section rhythm is fluid and generous:
  `padding: clamp(2.5rem, 1.6rem + 3.2vw, 4.5rem) 0;` for app surfaces,
  up to `clamp(56px, 5vw + 24px, 144px)` for marketing surfaces.
- More space ABOVE a heading than below it. Always. Read the computed values.
- Border or shadow on an element. Never both. A 1px hairline under a wide soft
  shadow is a ghost card.
- Nested cards are always wrong. If you need a card inside a card, you needed a
  different container.
- No element that changes state may change its footprint. If a "selected" row
  gains a border, give every row that border in transparent first, or the whole
  list shifts under the reader.

## 3. Elevation

Layered, never a single flat blur: one tight contact shadow plus one wide,
negatively-spread ambient shadow. A single-blur shadow reads as a sticker.

  --e1: 0 2px 8px -2px rgba(<shadow-ink>, .09), 0 1px 2px rgba(<shadow-ink>, .04);
  --e2: 0 14px 30px -14px rgba(<shadow-ink>, .17), 0 2px 6px rgba(<shadow-ink>, .05);
  --e3: 0 30px 64px -30px rgba(<shadow-ink>, .30), 0 4px 14px rgba(<shadow-ink>, .06);
  --e-glow: 0 24px 56px -28px rgba(<accent>, .45);   /* earned, once. */

`<shadow-ink>` is a desaturated, darkened version of the ground colour — never
pure black.

## 4. Motion

One easing family, four durations, and no more.

  --ease-out:   cubic-bezier(.22, .68, .35, 1);   /* workhorse: state changes */
  --ease-inout: cubic-bezier(.77, 0, .175, 1);    /* authored moments */
  --ease-drawer: cubic-bezier(.32, .72, 0, 1);    /* panels, drawers */
  --dur-1: 120ms;  --dur-2: 220ms;  --dur-3: 360ms;  --dur-4: 600ms;
  --dur-slow: 900ms;

Rules:
- ONE authored moment per surface. Not scattered effects, and not the same
  entrance on every section. Everything else is a state change at --dur-2.
- Animate `transform`, `opacity`, `clip-path`, `filter`. NEVER `width`, `height`,
  `top`, `left`, `margin`, or `padding` — those relayout on every frame.
  A progress bar animates `transform: scaleX()`, not `width`.
- Reveal on scroll with `clip-path`, not with height.
- Reach past transform and opacity where the world earns it: blur,
  backdrop-filter, clip-path, mask.
- Scroll-LINKED, never scroll-JACKED. The reader keeps the scrollbar and the page
  keeps up. Bind the listener `{ passive: true }` and touch the DOM only when the
  value actually changed.
- Content is visible by default. Add the class that hides it ONLY once the
  observer that removes it is known to be running. An element hidden by animation
  timing reads as a missing element.
- Provide an escape hatch: `?static=1` on the URL, and honour
  `prefers-reduced-motion: reduce`, both settling every entrance state at once.
- Never schedule required work on `requestAnimationFrame`. A frame-driven loop
  stops dead in a background tab, a headless render, and an off-screen frame.
  Use `setTimeout` and keep a watchdog.
- Dialog focus: trap Tab inside while open, return focus to the trigger on close.

## 5. Data and charts

- Draw charts as inline SVG by hand. No chart library, no CDN, no runtime fetch.
- Prefer a COMPUTED visual to a decorative one. If a contour, density field,
  isoline, or derived geometry can be calculated from the real data, calculate
  it — then the shape is information and it moves when the data moves.
- Every chart carries `role="img"` and a `<title>` that states what it shows.
- Interactive marks (points, bars, rows) are keyboard-reachable, carry an
  `aria-label` with their values, and open on Enter as well as click.
- Axes get titles, not just numbers. Units appear on the axis or in the label.
- A "band" or "range" must be labelled as confidence, so it is never mistaken for
  a set of options.
- Status is never colour alone. Every state also carries its word.
- Inline SVG in a grid needs `minmax(0, 1fr)` tracks. A bare `1fr` is
  `minmax(auto, 1fr)`, and its `auto` minimum refuses to shrink below the SVG's
  intrinsic width — which is how an 880px chart silently forces a phone viewport
  to 880px.

## 6. Refuse — these are the category defaults

Not absolute bans: the brief's own words can earn any of them back. Reaching for
one when the axis is free means you were not deciding.

- Same-size cards of icon + heading + text as the page structure.
- The hero-metric template: big number, small label, supporting stats, accent.
  Put figures inside the thing they describe instead.
- A kicker or eyebrow label above a heading. This one is a ban, not a default.
  The heading carries its own weight; delete the label.
- Section numbers (01 / 02 / 03) unless the sequence itself carries information.
- A modal for a task that needs neither interruption nor protected focus.
- Gradient text. Emphasis comes from weight or size.
- Glass and blur as decoration.
- A coloured `border-left` or `border-right` above 1px on cards or list items.
- Hard offset shadows (`4px 4px 0`) outside a genuinely neobrutalist world.
- Sparklines and progress rings standing in for content.
- Monospace as a costume for "technical" rather than for code, data, or
  measurement.
- A system display face (Impact, Arial Black, the platform sans) as the display
  voice. Source and self-host a face whose character matches the world.
- Unicode glyphs or emoji standing in for an icon system. Draw icons — one
  library or authored SVG, one consistent stroke weight (1.5–1.75px).
- Illustrations imitating pictures. `feTurbulence` grain, sketch-style SVG, and
  doodle class names read as amateur. Crisp vector GEOMETRY stays first-class.
- Background textures with no canvas, map, blueprint, or measuring tool under
  them. `repeating-linear-gradient` stripes need a reason.
- Light or dark picked by category. Pick it from the use scene: who, where, under
  what ambient light.

## 7. Browser surfaces

The parts you did not draw still carry the design. Theme them from the palette:

- `::selection` background and colour.
- `:focus-visible` ring — 3px, offset, from the accent. Never remove focus rings.
- Custom scrollbars (width, thumb colour, track).
- Fully redraw `input[type=range]` and `input[type=checkbox]`.
- `text-underline-offset` on links.
- `caret-color`.
- `font-variant-numeric: tabular-nums` on numeric contexts.

This is the cheapest signal that a page was built rather than assembled, and the
one that gets skipped most reliably.

## 8. Accessibility floor

- Body and placeholder text 4.5:1 minimum. Large text 3:1.
- Every interactive control keyboard-reachable with a visible focus ring.
- ARIA on anything custom: `role`, `aria-expanded`, `aria-controls`,
  `aria-current`, `aria-label` on icons.
- Dialogs: `aria-modal`, focus trapped, focus returned.
- Full `prefers-reduced-motion: reduce` support.
- A print stylesheet: drop the chrome, expand the collapsed, keep panels from
  breaking across pages.

## 9. Responsive

- Grid tracks that hold charts or wide content use `minmax(0, 1fr)`.
- A fixed side rail becomes a top bar with a disclosure below ~1024px. Nothing
  may be unreachable on a small screen.
- A navigation panel that hangs BELOW its bar needs the bar's `overflow: visible`.
  A rail that clips an ornament will clip the menu out of existence too — the
  JavaScript runs, `display: flex` computes correctly, and nothing appears.
- An open menu over hero imagery needs an opaque ground, or the headline ghosts
  through the links.
- Verify no horizontal overflow at 320, 360, 390, 414, 480, 600, 768, 900, 1024,
  1280 and 1440px by measuring `documentElement.scrollWidth` against
  `clientWidth` — not by looking.

## 10. Verification — bounded, not open-ended

Build fully. Then inspect ONCE in a batched round (desktop and mobile together),
fix everything that round shows in one pass, confirm with at most one more round,
and stop. Open-ended self-QA burns time doing worse what a single disciplined
inspection does better.

The batch checks:
- Contrast, spacing rhythm, and type at every breakpoint, with real copy.
- Hover, focus, disabled, loading, error and empty states.
- Keyboard-only traversal of every interactive element.
- A screenshot at desktop and at 390px, looked at, not just captured.
- `scrollWidth === clientWidth` at every width listed above.
- Print to PDF, and read the page count.
- Zero console errors on every route.

Then write the decisions down — the world, the type, the motion, the refusals —
in a DESIGN.md beside the code, so the next person inherits reasoning rather than
guessing. A design that is unreviewed and undocumented is unfinished.
```

---

## How to use it

Paste the fenced block into the brief or the agent's first message, then supply
the two things it deliberately leaves open:

1. **The palette.** Give 6–10 tokens with roles, not a mood word: one ground, one
   ink, one primary, one or two earned accents, and a wash. Name which accent is
   reserved for warnings. Everything else in the directive is palette-agnostic.
2. **The world, if you already know it.** Otherwise let the agent propose one
   from the subject's material culture and approve it before it writes code — that
   single step is what separates a designed surface from an assembled one.
