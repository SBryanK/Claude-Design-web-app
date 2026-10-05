# Direction

The world is the decision everything else hangs from. A flawless execution of a
generic world is a generic product; a rough execution of a real one is
unmistakable. Spend your thinking here.

## Derive the world from the subject, not the category

Ask: *what do the real users of this thing actually handle?*

- Credit analysts handle **ledgers, statements, exposure schedules**. A credit
  tool's world is a survey sheet — contour lines, bands, a measured field.
- Climbers handle **topographic maps** — bearings, contour intervals, a compass
  rose.
- Archivists handle **catalogues** — index cards, call numbers, marginalia.
- Lab technicians handle **specimen labels** — lot numbers, ruled grids,
  handwritten date stamps.
- Broadcasters handle **rundowns** — time columns, cue marks, running order.

The category default is what every competitor looks like: cards of equal weight,
a KPI row, a hero, a gradient. Name it explicitly in the thesis and refuse it.

## The three questions

Write the answers into an HTML comment at the top of the page. Keep them short.

```html
<!--
  THESIS    A credit portfolio drawn as terrain, at editorial scale. It refuses
            the dashboard default: a metric-tile row above a grid of
            equal-weight chart cards.
  WORLD     Pale map sheet to deep forest, five greens rising with density,
            contour isolines as the only ornament, honey and coral earned only
            where risk is. Instrument Serif for statements, a grotesque for
            interface and every figure.
  FIRST     A full-bleed field of the product's own terrain under one scanning
            light. One statement at display scale, one lede, one solid action
            beside one quiet link, and a rule of three plain promises.
-->
```

The comment is not documentation theatre. It is the tiebreaker: when two
solutions are both fine, the one that serves the thesis wins, and a later
reader can see which one that was.

## A world is real only if it survives four tests

1. **Dense content.** Does it still work when a screen holds forty rows and three
   hundred words? A world that only works on a hero is a costume.
2. **Interaction states.** Hover, focus, selected, disabled, error. If the world
   cannot express "this changed", it is a skin.
3. **A different screen.** Build the second screen before you commit. If the
   world collapses when the layout changes, it was a layout.
4. **Removal.** Take away everything that is not the world. If the page still
   reads, the world is doing work. If it becomes a blank sheet, the world was
   the decoration.

## Ornament must be data

The single sharpest test:

- A contour line on a map **is** information. On a checkout page it is costume.
- A rule that separates table rows **is** structure. Under a heading it is a
  kicker.
- A grid that aligns content **is** structure. Behind body text it is noise.

If a visual element could be replaced by nothing with no loss, it has no job.
Delete it, or give it one. The best ornament in a well-designed page is a
computed shape that changes when the data changes.

**Corollary:** the strongest version of this is to *compute* the decoration from
real content. Derive the shape from the data — density, isolines, a distribution
field — and the ornament becomes both beautiful and true.

## Where the world comes from: eight axes

Pick one position on each. The combination is your world.

| Axis | Options |
|---|---|
| Ground | sheet / canvas / terminal / paper / sky |
| Register | editorial / instrument / document / signal |
| Density | generous / measured / dense |
| Line | hairline rules / filled bands / plotted marks |
| Depth | flat sheet / layered card / real dimming |
| Mark | geometric / diagrammatic / typographic |
| Voice | declarative sentences / terse labels / numbers only |
| Accent | earned (appears on change) / structural (separates) / absent |

Two adjacent axes chosen lazily is how you get a template. Push at least two of
them somewhere the category would not.

## Light or dark is chosen from the scene, not the category

Ask: **who uses this, where, under what ambient light?**

- A control room at 2am → dark ground.
- A credit analyst at a desk in daylight → light ground.
- A field tool in sun → high contrast, light ground, large type.
- A consumer app at night in bed → dark, low chroma.

"Dashboards are dark" is not a reason. "Financial products are blue" is not a
reason. State the scene, and the answer follows.

## Failure modes

Each of these feels like a decision and is not.

- **Two worlds.** A topographic sheet for the hero and a generic card grid below.
  Commit to one; if the second screen needs a different world, the first is wrong.
- **The world as texture.** Stripes, grain, gradients standing in for a system.
  Texture is what you add when there is no world.
- **Reference cosplay.** Copying a known site's surface without its reasoning.
  Take the *method* — the display scale, the section rhythm, the one authored
  moment — never the pixels.
- **The résumé world.** A style that exists to demonstrate the maker's taste at
  the reader's expense: illegible display type, motion that must be waited
  through, a layout that must be learned.
- **Abstraction collapse.** "Modern, clean, minimal" is not a world. It describes
  the absence of one.

## Write it down

Before styling anything, state the world in two or three sentences back to the
user and name the palette roles you intend to use. If they correct you, you have
spent a paragraph instead of a day.

Then keep the contract comment at the top of the page current for the life of the
project. It is the cheapest coordination tool you have.
