# Typography

Type is the design. Everything else supports it. Get the faces and the scale
right and a plain layout will read as considered; get them wrong and no amount of
polish will save it.

## Two faces, one job each

Never more than two. A third is always a mistake in disguise.

**Display face** — page titles, section statements, large standalone figures.
Choose a face with visible editorial character. Strongly prefer one that ships a
**single weight (400)**.

That constraint is the point: with no bold available, you must use size, space,
and position to build hierarchy. The result reads as editorial rather than as a
dashboard, and it is very hard to make ugly by accident.

Good candidates: Instrument Serif, Fraunces, Newsreader, Source Serif, Playfair
Display, Spectral. Choose from the world, not from a list — an archival world
wants a bookish serif, an instrument world wants a technical one.

**UI face** — every interface surface, label, paragraph, and table. A neutral
grotesque that disappears. Good candidates: Inter, Hanken Grotesk, Public Sans,
IBM Plex Sans, or the platform system stack.

```css
--font-display: "Instrument Serif", Cambria, "Iowan Old Style", Georgia, serif;
--font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
```

**Self-host every face** as WOFF2. Fetch nothing at runtime — no CDN, no
`@import` from a font service. A page that cannot render offline is a page that
renders wrong in a meeting room.

> **On overused faces.** Instrument Serif, Inter, and Fraunces are common enough
> that an audit tool will flag them, and the flag is fair. A pinned brief or a
> named reference outranks that warning — a client who says "like this site" has
> chosen the face. Record the trade-off where a later reader will find it. Do not
> silently substitute, and do not let a linter overrule the brief.

## The scale: fluid, with real steps

Every step is a `clamp()` spanning a wide viewport range, so a heading is a
different *size of thing*, never a bigger paragraph.

```css
--fs-2xs:     0.6875rem;                                  /* 11px, labels only */
--fs-xs:      0.75rem;                                    /* 12px */
--fs-sm:      0.8125rem;                                  /* 13px */
--fs-base:    0.875rem;                                   /* 14px, body in dense UI */
--fs-md:      1rem;                                       /* 16px, body in prose */
--fs-lg:      clamp(1.0625rem, .98rem + .35vw, 1.25rem);   /* lede */
--fs-xl:      clamp(1.375rem, 1.15rem + 1vw, 1.75rem);     /* panel heading */
--fs-2xl:     clamp(1.75rem, 1.32rem + 1.5vw, 2.5rem);     /* big figure */
--fs-3xl:     clamp(2.125rem, 1.55rem + 2.4vw, 3.25rem);
--fs-4xl:     clamp(2.5rem, 1.7rem + 3.6vw, 4.25rem);      /* page title */
--fs-display: clamp(2.75rem, 1.85rem + 4.4vw, 5.5rem);     /* hero statement */
```

Use `scripts/tokens.mjs` to generate these from a base size rather than doing the
arithmetic by hand:

```bash
node scripts/tokens.mjs --base 16 --ratio 1.25 --vmin 390 --vmax 1500
```

**Body size by surface.** Dense application UI: 14px is comfortable and 16px
wastes vertical space. Prose and marketing: 16–18px. Never below 13px for
running text; anything under 12px is for uppercase labels and nothing else.

## Rules that separate typeset from styled

**Weight.** Display headings are 400. Never bold a display heading — increase its
size. UI headings may be 500–600, and rarely more.

**Tracking.** Floor is `-0.04em`. Use `-0.02em` to `-0.03em` on display sizes,
`-0.01em` on UI headings, `0` on body. Anything tighter than the floor is an
error, not a style.

**Leading.** Display `1.0`–`1.05`. Subheads `1.15`–`1.3`. Body `1.5`–`1.6`.
Long-form prose `1.6`–`1.75`.

**Measure.** Body 65–75 characters. Ledes 55–68ch. Dense UI text 40–60ch. Never
a full-width paragraph — if it spans the viewport, it is unreadable and the
layout is wrong.

```css
--measure: 68ch;
--measure-tight: 52ch;
```

**Only two or three sizes per screen region.** A panel with five type sizes is a
panel with no hierarchy. Pick the level, then use *space* to separate, not
another size.

**Numbers.** Every figure in a table, stat, value column, or aligned list gets:

```css
font-variant-numeric: tabular-nums;
```

Apply it globally to numeric classes, table cells, and definition values. Without
it, columns of numbers jitter as the digits change and the whole table looks
wrong without anyone being able to say why.

**Uppercase labels.** If you use them, they need positive tracking or they read
as cramped:

```css
.label {
  font-size: var(--fs-2xs);
  text-transform: uppercase;
  letter-spacing: .09em;
  font-weight: 600;
  color: var(--ink-muted);
}
```

Use them sparingly — for field labels and units, not for section headings. A
kicker above a heading is banned outright (see `quality.md`).

**Casing.** Sentence case for headings and buttons. Title Case Everywhere is a
tell. Reserve it for proper nouns.

## Setting a display headline

- One or two clauses. If it needs a comma, it is probably two lines.
- If it should break at a specific point, force it with `<br>` — and accept that
  a forced break is a desktop device. Suppress it below ~720px **and make sure a
  real space survives it**, or the clauses collide:

```html
<h1>Every detail is a decision. <br>Most of them are <em>invisible</em>.</h1>
```
```css
@media (max-width: 720px) { h1 br { display: none; } }
```

- Emphasis comes from *italic* or a colour already in the palette — never from
  gradient text.
- Count characters. At `--fs-display`, roughly 22 characters fit per line at
  1440px. A 60-character headline is three lines, not two; either shorten it or
  lower the size.

## Fallbacks and loading

- Always supply a real fallback chain with a matching generic family last.
- `font-display: swap` for UI faces, `optional` or `swap` for display faces.
- Preload the display face if it is above the fold:
  ```html
  <link rel="preload" href="fonts/display.woff2" as="font" type="font/woff2" crossorigin>
  ```
- Test with the font blocked. If the layout collapses, the metrics are wrong.

## Quick audit

- [ ] At most two families, self-hosted, no runtime fetch.
- [ ] Body ≥ 13px; nothing under 12px except uppercase labels.
- [ ] No display heading is bold.
- [ ] Tracking within the floor on every size.
- [ ] Measure set; no paragraph spans the viewport.
- [ ] `tabular-nums` on every numeric context.
- [ ] Two or three sizes per region, not five.
- [ ] Text over imagery or colour still clears 4.5:1.
