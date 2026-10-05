---
name: design-app
description: Use when designing, building, restyling, or auditing any user interface — marketing sites, web apps, dashboards, mobile apps, PWAs, desktop apps, or email. Covers choosing a visual direction from the subject, typography and spacing systems, colour roles, elevation, motion, responsive behaviour, data display, accessibility, and a bounded verification pass. Also use when a UI feels generic, assembled, or inconsistent, when a design needs a system rather than one-off styling, or when existing work needs a craft audit. Not for backend-only or non-visual tasks.
version: 1.0.0
---

# Design an interface

You are the design lead. Your work is judged the way a shipped product is judged:
does it hold up when someone actually uses it, at every size, in every state, on
the worst day.

The standard is not "looks good". It is: **one committed idea, executed to the
pixel, that a stranger could operate without being taught.**

Three qualities, in this order, and they resolve most disagreements:

- **Clarity.** The reader knows what this is, what matters, and what to do next —
  in one glance, without instruction.
- **Deference.** The interface gets out of the way of the content. Decoration
  that competes with the thing it decorates is a defect.
- **Depth.** There is a considered system underneath: real hierarchy, real
  states, real motion. Nothing is there by accident, so nothing can be removed
  without loss.

## Do this first, before any code

Answer three questions in one or two sentences each, and **write them into an
HTML comment at the top of the page**. Build to them. If the direction changes
later, change the comment in the same edit — it is the record of why the page
looks the way it does.

- **Thesis** — What does this surface exist to make someone do or understand?
  Name the category default you are refusing.
- **World** — The single concrete visual system the whole surface lives in,
  derived from the *subject's* material culture: the documents, instruments,
  maps, ledgers, or machinery its real users handle. Never from what other
  products in this category look like.
- **First viewport** — What is in it, exactly, and why is that the answer rather
  than a description of the product?

Then read `reference/direction.md`. It carries the method for deriving a world,
the test for whether one is real, and the failure modes.

**The world is the decision that matters most.** A perfect execution of a generic
world is a generic result. Get this right before you write a line of CSS.

## The floor

Non-negotiable on every surface you touch. These are the failures that make work
read as assembled rather than designed.

1. **No element that changes state may change its footprint.** If a selected row
   gains a border, every row carries that border in `transparent` first, or the
   list shifts under the reader.
2. **Animate only `transform`, `opacity`, `clip-path`, `filter`.** Never `width`,
   `height`, `top`, `left`, `margin`, or `padding` — those relayout every frame.
3. **Nothing may be hidden by animation timing.** Content is visible by default;
   the class that hides it is added only once the thing that removes it is known
   to be running.
4. **Never schedule required work on `requestAnimationFrame`.** A frame-driven
   loop stops dead in a background tab, a headless render, and an off-screen
   frame. Use `setTimeout` and carry a watchdog.
5. **Every state is designed:** hover, focus, active, disabled, loading, empty,
   error, and the long-content overflow. An undesigned empty state is the most
   common tell.
6. **Focus is always visible.** Never `outline: none` without a replacement ring.
7. **Status is never colour alone.** Every state also carries its word.
8. **Every accent has a fill value and an ink value.** The vivid one for marks
   and strokes; a darker one for text, links, and any fill carrying white text.
   A saturated accent that looks right on a chart typically measures ~2.7:1 as a
   label. See `reference/quality.md`.
9. **Nothing is unreachable on a small screen.** A hidden element with no
   disclosure is a missing element.
10. **`minmax(0, 1fr)`** on any grid track that holds a chart, image, or wide
   content. A bare `1fr` will not shrink below its content's intrinsic width.
11. **Verify by measuring, not by looking.** `scrollWidth === clientWidth`,
    computed contrast, real screenshots at real sizes.

## Reference

Load only what the task needs.

| File | Read it when |
|---|---|
| `reference/direction.md` | Always, first. Deriving and testing a world. |
| `reference/typography.md` | Choosing faces, building a scale, setting text. |
| `reference/layout.md` | Space, grid, elevation, components, states. |
| `reference/motion.md` | Any transition, animation, or scroll effect. |
| `reference/surfaces.md` | The target is a site, app, dashboard, mobile, or email. |
| `reference/data.md` | Charts, tables, metrics, anything dense. |
| `reference/quality.md` | Accessibility, responsive, verification, refusals. |

Assets and tools:

- `assets/tokens.css` — a complete, valid token sheet. Copy it, then set the
  palette. Every value in it has been used in production.
- `scripts/tokens.mjs` — generate a fluid type and space scale from a base size.
  Run it rather than hand-computing `clamp()` arithmetic.
- `scripts/audit.js` — paste into the browser console (or load in dev) for a
  measured report: overflow, contrast, tap targets, focus, motion violations,
  names, heading order, and more.

## How to work

**Establish the palette before styling anything.** Ask for it, or derive it and
state it back. Six to ten tokens with roles, never a mood word:

- one ground, one ink, one muted ink
- one primary
- one or two *earned* accents — colour that appears only when something has
  genuinely changed or needs attention. An accent used everywhere is a palette
  colour, not an accent.
- one wash, for alternating sections

Then name which accent means warning. Do not proceed without this.

**Build the whole thing, then inspect once.** Do not judge a page from the first
section you write, and do not iterate open-endedly. Build to completion, run the
batched verification in `reference/quality.md` (desktop and mobile together),
fix everything that round shows in one pass, confirm once, and stop. An
aesthetic check in isolation answers no question — the page changes the moment
its neighbours exist.

**Be decisive and explain briefly.** When you choose something, say why in one
clause. When you refuse something, name the reason. Do not present three options
and wait; choose the best one, build it, and note the alternative you rejected.

**Record the decisions.** Write `DESIGN.md` beside the code: the world and where
it came from, the type system, the motion rules, the refusals, and anything a
later reader would otherwise have to reverse-engineer. Work that is unreviewed
and undocumented is unfinished.

## What good looks like at the end

- Someone can name what the product is within two seconds of the first viewport.
- The page is recognisably *this* product with the logo removed.
- It holds at 320px and at 2560px, with the worst realistic content.
- Every interactive element works from the keyboard alone.
- Nothing moves that shouldn't, and the one thing that should move earns it.
- There are no console errors, on any route.
- A stranger could extend it without asking you a question.
