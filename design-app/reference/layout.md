# Layout, space, and depth

## Space

One scale, used for everything. Two scales is how a page becomes inconsistent
without anyone noticing why.

```css
--s1: 4px;   --s2: 8px;   --s3: 12px;  --s4: 16px;  --s5: 20px;
--s6: 24px;  --s7: 32px;  --s8: 40px;  --s9: 56px;  --s10: 72px;
```

Three rules that do most of the work:

1. **More space above a heading than below it.** Always. A heading closer to what
   precedes it belongs to the wrong section. Read the computed values; this is
   the most common spacing error and the hardest to see.
2. **Space is the primary separator.** Reach for a rule or a card only when space
   has genuinely failed. Whitespace costs nothing and never fights the content.
3. **Generous, fluid section rhythm.** Tight rhythm is the fastest way to make a
   page feel cheap.

```css
--section-y: clamp(2.5rem, 1.6rem + 3.2vw, 4.5rem);          /* app surfaces */
--section-y: clamp(56px, 5vw + 24px, 144px);                 /* marketing */
```

## Grid

- **12 columns** for marketing and content pages; **4 or 8** for app chrome.
- Content max-width `1200–1400px` for marketing, `1600px`+ for dashboards, and
  `68ch` for prose.
- Gutters scale with the viewport: `clamp(16px, 3vw, 32px)`.
- **Asymmetry beats equality.** A 1.6fr / 1fr split reads as considered; three
  equal columns read as a template. If you must be equal, be equal on purpose.

**The `minmax(0, 1fr)` rule.** A bare `1fr` is `minmax(auto, 1fr)`, and its `auto`
minimum refuses to shrink below the content's intrinsic width. An inline SVG with
`width="100%"` and a 880-unit viewBox has an 880px intrinsic width, so a bare
`1fr` track forces the whole page to 880px wide on a 390px phone.

```css
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
```

Apply this to **every** track that holds a chart, image, `pre`, table, or long
unbroken string.

## Radii

Stay in a narrow band. Mixed radii read as unresolved.

```css
--r-xs: 4px;      /* tags, checkboxes */
--r-sm: 8px;      /* controls, inputs */
--r:    12px;     /* inner blocks, notes */
--r-lg: 16px;     /* cards, panels */
--r-pill: 999px;  /* small controls only */
```

Cards live in the **12–16px** band. Pills on anything larger than a button read as
a toy. A `0` radius is a legitimate choice — it just has to be consistent.

## Elevation

Layered, never a single flat blur. One tight contact shadow plus one wide,
negatively-spread ambient shadow. A single-blur shadow reads as a sticker.

```css
--e1: 0 2px 8px -2px rgba(10,40,26,.09), 0 1px 2px rgba(10,40,26,.04);
--e2: 0 14px 30px -14px rgba(10,40,26,.17), 0 2px 6px rgba(10,40,26,.05);
--e3: 0 30px 64px -30px rgba(10,40,26,.30), 0 4px 14px rgba(10,40,26,.06);
--e-glow: 0 24px 56px -28px rgba(<accent>, .45);   /* earned — use once */
```

`<shadow-ink>` is a desaturated, darkened version of the ground colour. Never
pure black: black shadows on a warm ground look like dirt.

**One elevation level per element.** Don't stack `--e2` on a card that already
sits in an `--e1` panel; the nesting reads as a mistake.

**Border or shadow, never both.** A 1px hairline under a wide soft shadow is a
ghost card — the two cues contradict each other.

## Cards

A card is a container that earns a boundary. Ask what the boundary is doing.

- Grouping things that are genuinely one object → yes.
- Separating things that a heading and space would separate → no, delete it.
- **Nested cards are always wrong.** A card inside a card means the outer one was
  the wrong container.
- Same-size cards repeated as the page structure is the canonical generic layout
  (see `quality.md`). Vary the weight, or don't use cards.

## States — design all of them

This is where most work stops early. Every interactive element needs:

| State | Requirement |
|---|---|
| Default | Reads as interactive without a hover |
| Hover | Visible change, `--dur-2`, no layout shift |
| Focus | Visible ring, 3px, offset. Never removed. |
| Active | Confirms the press |
| Disabled | Reduced contrast **and** `cursor: not-allowed`, not just faded |
| Loading | A skeleton that matches the final layout, or a spinner in place |
| Empty | Explains what would be here and how to make it exist |
| Error | Says what happened and what to do — never just "Error" |
| Overflow | Long text truncates with an ellipsis *and* has a title/aria-label |

**The empty state is the tell.** A blank panel with nothing in it says the
designer stopped at the happy path. Write real copy, offer the action, and keep
it visually quiet.

**The loading state must not jump.** Reserve the final height. A skeleton that is
a different size from the content it replaces is worse than no skeleton.

## The footprint rule

**No element that changes state may change its footprint.**

The classic bug: a selected row gains `border: 1px solid accent`, which adds 2px
of height, so every row below shifts by 2px. The reader's eye is dragged away
from the thing they just clicked.

The fix — give every element the border in `transparent` up front:

```css
.row { border: 1px solid transparent; border-bottom-color: var(--line); }
.row.selected { border-color: var(--accent); background: var(--accent-wash); }
```

Same rule for font-weight changes in a row, icons that appear on hover, and
badges that only render when active. Reserve the space, then reveal.

## Containers and scroll

- **Horizontal scroll belongs to the container, not the page.** A wide table gets
  an `overflow-x: auto` wrapper with `-webkit-overflow-scrolling: touch`. The page
  itself must never scroll sideways.
- **Sticky headers need a background.** A transparent sticky header is unreadable
  the moment content passes under it.
- **Sticky elements need a `z-index` plan.** Write the layers down: content `1`,
  sticky chrome `40`, drawer `60`, modal `80`, toast `100`.
- **`overflow: hidden` clips absolutely positioned descendants.** If a menu hangs
  below its bar, the bar cannot clip. This breaks mobile navigation reliably and
  silently — the JavaScript runs, `display: flex` computes, and nothing appears.

## Responsive

Breakpoints come from where the *content* breaks, not from device names. Start
here and adjust to what you see:

```
  320px   the floor. Must work.
  560px   two-up becomes one-up
  768px   tablet portrait
 1024px   sidebars collapse; rails become top bars
 1280px   full desktop layout
 1600px   wide — cap the measure, add margin, do not stretch
```

Rules:

- **A fixed side rail becomes a top bar below ~1024px**, with a disclosure for
  the navigation. Nothing may be unreachable on a small screen.
- **Tap targets ≥ 44×44px** on touch surfaces, with ≥ 8px between them.
- **Do not disable zoom.** `user-scalable=no` is an accessibility failure.
- **Test at 320px with the longest realistic string.** That is where layouts
  break.
- **Use `clamp()` for anything that should scale**, rather than a breakpoint per
  size.

## Print

If the page could plausibly be printed — an invoice, a report, a data request —
write a print stylesheet.

- Drop navigation, sidebars, floating actions, and toasts.
- Expand anything collapsed; print the content, not the interaction.
- `break-inside: avoid` on panels, table rows, and cards.
- Print the URL after external links, if it is a document meant to be filed.
- Force a light ground. A dark theme printed is a black rectangle.

```css
@media print {
  .sidebar, .masthead-actions, .toasts, .no-print { display: none !important; }
  .panel, tr, .card { break-inside: avoid; }
  body { background: #fff; color: #000; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: .85em; }
}
```
