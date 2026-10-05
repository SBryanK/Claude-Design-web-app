# Quality

Accessibility, responsive behaviour, the refusal list, and how to verify. This is
the file that decides whether the work is finished.

## Accessibility

Not a checklist bolted on at the end. Most of it is also what makes an interface
usable for everyone.

### Contrast

| Content | Minimum |
|---|---|
| Body text, placeholder, labels | 4.5:1 |
| Large text (≥ 24px, or ≥ 19px bold) | 3:1 |
| Icons and meaningful graphics | 3:1 |
| Borders and dividers | 3:1 against the adjacent ground |
| Disabled text | exempt — but still must be legible |

Three rules that catch most failures:

- **Secondary text on a coloured surface is tinted from that hue**, never grey.
  Grey on green looks like dirt and usually fails contrast.
- **Test against the real background.** Text over an image, a gradient, or a
  translucent panel has no fixed contrast until you measure it.
- **Split every accent into a fill and an ink.** This is the failure that hides
  longest, because the palette looks correct.

### Every accent needs two values

A vivid accent is chosen to look right as a *mark* — a dot, a bar, a rule, a
chart stroke. Used as **text**, or as a **fill behind white text**, the same
value usually fails. It is not close, either: a saturated amber that looks
exactly right on a chart measures 2.7:1 as a label.

Contrast is symmetric, so **one darker value per accent fixes both cases** —
"amber text on white" and "white text on amber" score identically.

```css
/* marks, strokes, chart series — exactly right, leave alone */
--honey: #E08A00;   /* 2.69:1 on white — FAILS as text */

/* text, links, and any fill carrying white text */
--honey-ink: #9C5C00;   /* 5.32:1 on white — passes as text AND as a fill */
--coral-ink: #C93A25;   /* 5.10:1 */
--teal-ink:  #0B7F76;   /* 4.87:1 */
```

Then audit every use: `color:`, `background:` on anything with light text on it,
and links. Expect to find five to fifteen places. In one build this single rule
surfaced sixteen failures across a status pill, an accent rail, a link colour,
two tag badges, and a 40px display figure.

**Icons are not exempt.** A graphic needs 3:1 against its ground. A pale brand
tint that looks lovely on a chart is invisible as a navigation icon — check it
with the same measurement, because a text-only contrast pass will not see it.

### Keyboard

- Everything interactive is reachable by `Tab`, in a logical order.
- **Visible focus ring on every focusable element.** Never `outline: none`
  without a replacement.
- **Skip link** to the main content, first in the DOM.
- `Esc` closes overlays. `Enter` and `Space` activate. Arrow keys move within
  composite widgets.
- **Focus is never lost.** Opening a dialog moves focus in and traps it; closing
  returns it to the trigger.

```css
:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
```

`focus-visible` rather than `focus`: it shows the ring for keyboard users without
ringing every mouse click. Never remove the ring entirely.

### Semantics

- Real elements: `<button>`, `<a>`, `<nav>`, `<main>`, `<table>`. A `<div>` with
  an `onclick` is invisible to assistive technology and unreachable by keyboard.
- **One `<h1>` per page**, then a heading order with no skipped levels.
- `alt` on every image. `alt=""` for decorative ones — not omitted.
- `aria-label` on every icon-only control.
- `lang` on `<html>`.
- `aria-current="page"` on the active navigation item.
- Form inputs have real `<label>` elements. A placeholder is not a label — it
  disappears the moment someone types.

### Touch

- Targets ≥ 44×44px, ≥ 8px apart.
- Nothing important within 16px of a screen edge.
- No interaction that requires hover alone.

### Zoom and motion

- **Never** `<meta name="viewport" content="user-scalable=no">`.
- Layout must survive 200% browser zoom without horizontal scroll.
- Full `prefers-reduced-motion: reduce` support (see `motion.md`).

### The browser surfaces

The parts you did not draw still carry the design. Theme them from the palette —
this is the cheapest signal that a page was built rather than assembled, and the
one most reliably skipped.

```css
::selection { background: var(--accent); color: var(--on-accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
html { caret-color: var(--accent); scrollbar-color: var(--line-2) transparent; }
a { text-underline-offset: 3px; text-decoration-thickness: 1px; }
input[type="range"] { /* fully redraw — appearance: none, then build it */ }
input[type="checkbox"] { /* same */ }
::placeholder { color: var(--ink-3); opacity: 1; }   /* Firefox dims by default */
```

---

## Responsive

- **Breakpoints come from where content breaks**, not from device names.
- **Test the floor first:** 320px, with the longest realistic string. That is
  where layouts fail.
- **`minmax(0, 1fr)`** on every track holding a chart, image, `pre`, or table.
- **Verify by measuring**, never by looking:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Run it at 320, 360, 390, 414, 480, 600, 768, 900, 1024, 1280, 1440, 1920. One
failing width is a bug, and it will be the width a reviewer happens to use.

- **Cap the measure on wide screens.** Text that stretches to 2560px is
  unreadable; add margin rather than growing the line.
- **Test the long tail**: the longest name, the biggest number, the empty state,
  the error state. Layouts break on content, not on viewport.

---

## Refuse — the category defaults

These are not absolute bans. A brief can earn any of them back, and a pinned
reference outranks this list entirely. But reaching for one when the axis is free
means you were not deciding.

- **Same-size cards of icon + heading + text as the page structure.** The
  defining generic layout.
- **The hero-metric template** — big number, small label, supporting stats,
  accent. Put figures inside the thing they describe.
- **A kicker or eyebrow label above a heading.** A ban, not a default — this one
  is practically never information. The heading carries its own weight; delete
  the label.
- **Section numbers (01 / 02 / 03)** unless the sequence itself carries meaning.
- **A modal** for something that needs neither interruption nor protected focus.
- **Gradient text.** Emphasis comes from weight, size, or position.
- **Glass and blur as decoration.** Legitimate as a functional layer; not as a
  style.
- **A coloured `border-left` or `border-right` above 1px** on cards or list
  items. The "accent stripe" is a tell.
- **Hard offset shadows** (`4px 4px 0`) outside a genuinely neubrutalist world.
- **Sparklines and progress rings standing in for content.**
- **Monospace as a costume** for "technical", rather than for code, data, or
  measurement.
- **A system display face** (Impact, Arial Black, the platform sans) as the
  display voice. Source a face whose character matches the world.
- **Unicode glyphs or emoji as an icon system.** Draw icons: one library or
  authored SVG, one stroke weight (1.5–1.75px).
- **Illustrations imitating pictures.** `feTurbulence` grain, sketch-style SVG,
  and doodle class names read as amateur. Crisp vector *geometry* stays
  first-class.
- **Background texture with no canvas, map, or measuring tool under it.**
  `repeating-linear-gradient` stripes need a reason.
- **Light or dark chosen by category.** Choose from the use scene.
- **Lorem ipsum left in a shipped design.** It hides every real layout problem.
- **Placeholder-only form labels.**

---

## Verification

Build to completion first. Then inspect **once**, in a batched round, and fix
everything that round shows in one pass.

Do not iterate open-endedly. Aesthetic judgement applied to a half-built page
answers no question — the page changes the moment its neighbours exist. Open-ended
self-QA burns time doing worse what one disciplined pass does better.

### The batch

| # | Check | How |
|---|---|---|
| 1 | No horizontal overflow | `scrollWidth <= clientWidth` at 12 widths |
| 2 | Contrast | Measured, not eyeballed. `scripts/audit.js` |
| 3 | Tap targets | ≥ 44px on touch surfaces |
| 4 | Focus visible | Tab through every interactive element |
| 5 | Keyboard complete | Every action reachable without a mouse |
| 6 | No layout animation | `transition` never lists a layout property |
| 7 | No rAF-scheduled required work | Grep the boot path |
| 8 | Content visible by default | Disable JS; the page must still read |
| 9 | Screenshots | Desktop **and** 390px, looked at, not just captured |
| 10 | Every state | hover, focus, disabled, loading, empty, error |
| 11 | Print | To PDF, then read the page count |
| 12 | Console | Zero errors, on every route |
| 13 | Long content | The longest name, the biggest number |
| 14 | Offline | Block the network; nothing should break |

`scripts/audit.js` automates 1, 2, 3, 4, 6, 8, 11 partially, plus heading order,
accessible names, duplicate ids, and `lang`. It reports; it does not fix.

**Calibrate the tool or it will be ignored.** A checker that flags 200 desktop
navigation links for being under 44px, or every chart axis label for being under
12px, teaches the reader to skip the report — and then the real finding is
skipped too. Enforce the touch rule only where the pointer is coarse; exempt
uppercase micro-labels, chart internals, and numeric badges from the text floor.
A tool worth running reports three things you must act on, not thirty you must
argue with.

### Look at the screenshots

Capture at desktop width and at 390px, then actually open the images. A capture
you did not look at is not a check.

Things only the eye catches: a heading too close to what precedes it, a component
that is 2px out of alignment, an accent used three times so it stops meaning
anything, a section whose rhythm is identical to the one above it.

### Then stop

Fix what the pass found, confirm with at most one more round, and finish. State
what you checked and what you did not. A known limitation, written down, is worth
more than an unverified claim of completeness.

---

## Write it down

Beside the code, record:

- **The world** and where it came from — the material culture, the derivation.
- **The type system** — the faces, why those, and the scale.
- **The motion rules** — the easing family, the durations, the one authored
  moment.
- **The refusals** — what you decided not to do, and why.
- **The trade-offs** — anything you accepted rather than solved, so a later
  reader does not mistake it for an oversight.
- **What is not done** — the honest list.

Keep the direction contract comment at the top of the page current for the life
of the project. It is the cheapest coordination tool available, and it is what
lets someone else extend the work without asking you a question.

Work that is unreviewed and undocumented is unfinished.
