# Claude Design — web app

A design skill for Claude, three worked samples that show what it produces, and a
full application built with it.

The skill is called **`design-app`**. It is a portable directive: paste it into a
project, or install it as a skill, and it changes how an interface gets designed —
not just how it gets styled.

---

## Why it exists

Most AI-generated interfaces look the same, and the reason is not laziness. Ask
for "a dashboard" and you get the category default: a row of metric tiles, a grid
of equal-weight chart cards, a gradient hero. That is a *competent* answer to the
literal request, and it is why the result is forgettable.

This skill attacks the problem one step earlier. Before any CSS, it makes the
agent answer three questions:

- **Thesis** — what does this surface exist to make someone do or understand, and
  which category default is it refusing?
- **World** — the single visual system the whole surface lives in, derived from
  the *subject's own material culture*: the documents, instruments, maps, ledgers
  or machinery its real users actually handle.
- **First viewport** — what is in it, exactly, and why is that the answer rather
  than a description of the product?

Those three go into a comment at the top of the page and stay there. They are the
tiebreaker when two solutions are both fine, and they are the reason a later
reader can see *why* the page looks the way it does.

A credit dashboard becomes a topographic survey sheet. A coffee roaster's lot page
becomes a cupping sheet. A survey app becomes a naturalist's field form. The
decoration stops being decoration and becomes information.

---

## What is here

```
design-app/
├── SKILL.md              The directive. Loaded always.
├── reference/            Loaded only when the task needs them.
│   ├── direction.md      Deriving and testing a world.
│   ├── typography.md     Faces, fluid scale, setting text.
│   ├── layout.md         Space, grid, elevation, components, states.
│   ├── motion.md         Easing, durations, and the performance traps.
│   ├── surfaces.md       Site · web app · dashboard · mobile · native · email.
│   ├── data.md           Charts, tables, dense UI.
│   └── quality.md        Accessibility, responsive, verification, refusals.
├── assets/
│   └── tokens.css        A complete, valid token sheet. Set the palette, keep the rest.
└── scripts/
    ├── tokens.mjs        Generate a fluid type and space scale.
    └── audit.js          A measured craft report for a live page.

design-app-samples/       Three worlds, three surfaces, three palettes.
headroom-app/             A full application built with the skill.
DESIGN-PROMPT.md          The same directive as a single copy-paste block.
```

---

## Install

As a Claude skill:

```bash
mkdir -p ~/.agents/skills
cp -R design-app ~/.agents/skills/
```

As a prompt: paste `DESIGN-PROMPT.md` into the brief, then supply the two things
it deliberately leaves open — a palette (6–10 tokens with *roles*, not a mood
word) and the world, if you already know it.

---

## The samples

Open `design-app-samples/index.html`. No build step, no dependencies, no network —
every file opens by double-click.

| Sample | Surface | Ground | The argument it makes |
|---|---|---|---|
| **Meridian Coffee** | Marketing, light | Warm paper | A computed roast curve instead of a farm photograph |
| **Tally** | Mobile app, light | Cool field paper | A ruled count sheet, 44px targets, one hand |
| **Bus 8** | Dashboard, dark | Near-black room | Sixteen channel strips readable across a dark control room |

They share no palette, no type pairing and no structure. That is the point: the
skill is a method, not a house style.

Each sample carries its own **direction contract** in an HTML comment at the top —
its thesis, its world, and where the world came from. Read that first.

---

## The application

`headroom-app/` is a working prototype built to the same directive: an advanced
credit-management dashboard for **Jabil** (project IND2620-0011), a real brief
from a real company. It is included because a skill is only credible if it
survives contact with a constrained, unglamorous, data-dense problem.

Open `headroom-app/index.html`. No build step, no dependencies, no network — the
fonts ship inside the folder.

| File | What it is |
|---|---|
| `index.html` | The landing page: a cinematic dark opening, three proof figures, and a scroll-linked demonstration of the mechanism on one customer |
| `app.html` | The dashboard. Seven screens: portfolio, customers, customer detail, external radar, model performance, thresholds, methodology |
| `data-requirements.html` | The data request to Jabil — every SAP field, every external source, and a readiness checklist |
| `selftest.html` | 128 checks. Run it and read the result at the top. |

Every customer and every figure in the prototype is invented. Nothing is fetched
at runtime, and no data leaves the browser.

**Note on fonts.** Instrument Serif and Hanken Grotesk are bundled under the SIL
Open Font License. Proxima Nova is *not* bundled — it is commercial — and is
referenced only as the first entry in a font stack, so it renders on a Mac where
it is already installed and falls back cleanly everywhere else.

---

## Verify your own work

`design-app/scripts/audit.js` measures a live page and reports. Paste it into the
browser console, or load it during development:

```html
<script src="design-app/scripts/audit.js"></script>
```

```
__craft.report()      full report
__craft.summary()     counts only
__craft.widths()      overflow check
```

It checks horizontal overflow, text contrast, tap targets, focus indicators,
layout animation, content hidden by default, accessible names, image alt text,
heading order, duplicate ids, `lang`, zoom, tiny text, line length and form
labels.

**It reports; it does not fix.** A finding is a prompt to look, not a verdict —
the tool has no idea what your brief pinned.

`design-app/scripts/tokens.mjs` generates the fluid type and space scale:

```bash
node design-app/scripts/tokens.mjs --base 16 --ratio 1.25 --steps 6 --space
node design-app/scripts/tokens.mjs --vmin 360 --vmax 1600 --json
```

---

## Two things it learned the hard way

**Every accent needs two values.** A vivid accent is chosen to look right as a
*mark* — a dot, a bar, a chart stroke. Used as *text*, or as a fill behind white
text, the same value usually fails. It is not close: a saturated amber that looks
exactly right on a chart measures 2.7:1 as a label. Contrast is symmetric, so one
darker value per accent fixes both cases. Applying that rule to a real build
surfaced sixteen failures.

**Never schedule required work on `requestAnimationFrame`.** A frame-driven loop
stops dead in a background tab, a headless render, or an off-screen frame. An app
whose boot depends on it sits on its loading screen forever.

Both are in `reference/motion.md` and `reference/quality.md`.

---

## Licence

MIT — see [`LICENSE`](LICENSE). Use it, change it, ship it.

The bundled typefaces are separately licensed under the SIL Open Font License and
keep their own terms.
