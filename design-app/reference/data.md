# Data display

Charts, tables, and dense UI. The test for all of it: **can the reader answer
their question without doing arithmetic?**

## Charts

### Draw them by hand, as inline SVG

No chart library, no CDN, no runtime fetch. Reasons: a library ships its own
aesthetic that you then fight; SVG is styleable from your tokens; and a page that
depends on a network request to show a chart is a page that shows nothing in a
meeting room.

Hand-drawn SVG also lets you do the thing libraries cannot: draw the *derived*
geometry that makes the chart mean something.

### Prefer computed to decorative

If a shape can be calculated from the real data, calculate it. Then the ornament
is information, and it moves when the data moves.

- A density field computed with a kernel estimator, contoured with marching
  squares, gives you isolines that are *the distribution*, not a background.
- A fan chart's band is the simulated percentiles, not a shaded rectangle.
- A survival curve's steps are the actual event times.

This is the difference between a chart that could illustrate any dataset and one
that could only illustrate this one.

### Anatomy

Every chart needs, at minimum:

- **A title** that states the finding, not the variables. "Exposure rises past
  the limit by 23 Oct" beats "Exposure vs limit".
- **Axis titles with units.** An axis of bare numbers is unanswerable.
- **A legend**, only when more than one series is present, and placed so it does
  not need colour alone to be read.
- **`role="img"` and a `<title>`** on the SVG, restating the finding for screen
  readers.

```html
<svg viewBox="0 0 880 470" role="img" aria-labelledby="c1-title">
  <title id="c1-title">Exposure rises from USD 582m to USD 612m over 90 days,
    crossing the USD 600m limit on 23 October.</title>
  …
</svg>
```

### Choosing the form

| Question | Form |
|---|---|
| How did it change over time? | Line, with a band if there is uncertainty |
| How do two measures relate across many items? | Scatter, with size as a third |
| Where did a total come from? | Stacked bar, or a waterfall |
| How do items rank? | Horizontal bar — never a pie |
| What is the distribution? | Histogram, or a density field |
| What will happen, with what confidence? | Fan chart: median line plus percentile band |
| How does one item's profile compare? | Radar, only for 5–8 axes, only against itself |

### Colour in charts

- **Colour is the fourth channel.** Position, then size, then order, then colour.
- **One series, one colour.** A rainbow across an ordered series is noise.
- **A sequential ramp must be monotonic in lightness**, not just hue. It has to
  survive greyscale, because it will be printed.
- **Diverging only when there is a real midpoint.**
- **Cap the palette at five or six.** Beyond that, legend lookup exceeds the
  value of the encoding.
- **Never red/green as the only distinction.** Roughly 8% of men cannot separate
  them. Always pair with a shape, a position, or a word.

### Honesty

- **Start the y-axis at zero for bars.** Always. Bars encode magnitude by length.
- **Lines may be truncated**, but mark it — a broken axis without a mark is a
  lie.
- **Label the interval, not just the endpoint.** "24 monthly cut-offs" is
  information; "24" is not.
- **A confidence band must be labelled as confidence.** An unlabelled band reads
  as a set of options to choose from.
- **Show the baseline.** A model is only impressive next to the rule it replaces.
- **Publish the failures.** The section where the thing does not work is the most
  persuasive part of any evidence page, and almost nobody includes it.

### Interaction

- Interactive marks carry `aria-label` with their values.
- Keyboard-reachable, `tabindex="0"`, opening on `Enter` as well as click.
- `cursor: pointer` on anything clickable, and a visible focus ring on the mark
  itself — not on a container.
- Tooltips must not be the only place a value exists. If the number matters, it
  is also in the table or the label.

---

## Tables

Tables are underused because they are unfashionable and overused because they are
easy. Both are mistakes; a table is the correct form for repeated items with
shared attributes, and nothing else scans as fast.

**Rules**

- **Right-align numbers, left-align text.** Always. Numbers right-align so their
  digits line up; text left-aligns so its first letter does.
- **`font-variant-numeric: tabular-nums`** on every numeric cell.
- **Align the header with its column.** A right-aligned column needs a
  right-aligned header.
- **Units in the header**, not repeated in every cell.
- **Zebra striping or hairlines, not both.** And hairlines only on the horizontal.
- **Sortable columns** show their current state with an arrow, and the arrow is
  not the only indicator.
- **Sticky the header** when the table scrolls, with an opaque background.
- **Horizontal scroll belongs to the table wrapper**, never the page.
- **Empty and loading states are part of the table.** Three skeleton rows in the
  final column widths beat a centred spinner.
- **Do not paginate under ~50 rows.** Content-aware scroll is better than a
  pager.

**The wrapper:**

```css
.table-scroll { overflow-x: auto; max-width: 100%; }
.table-scroll table { min-width: 640px; }   /* forces the scroll rather than squashing */
```

---

## Dense UI: fields, keys, readouts

The pattern that replaces the stat row.

**A field key** is a horizontal rule of labelled figures sitting at the foot of
the thing they describe:

```
GROUPS        EXPOSURE       ACT NOW      WATCH        MOVED
120           USD 8.6bn      6            26           12
monitored     across the     USD 829m     risk rising  changed zone
              book                        , room left   this week
```

- The figure is display type at `--fs-2xl`, tabular.
- The unit is small and set beside it, not inside it.
- The label is uppercase, `--fs-2xs`, tracked.
- A caption line says what it means in words.

**Why it beats the stat row:** the figures sit under the thing they summarise, so
the relationship is positional rather than stated. A row of tiles at the top of a
page has no relationship to anything on it.

**A readout** is a single value with its context:

```html
<div class="readout">
  <div class="label">Remaining budget</div>
  <div class="value">$18,400</div>
  <div class="note">2.6 days at the current burn rate</div>
</div>
```

The `note` is what makes it information. A number with no comparison is
decoration.

---

## Metric tiles — and what to do instead

The tile row is the single most common generic pattern in software:

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  $8.6bn  │ │   120    │ │    6     │ │   26     │
│ Exposure │ │ Groups   │ │ Act now  │ │ Watch    │
│  ↑ 12%   │ │  ↑ 3     │ │  ↑ 1     │ │  ↓ 2     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Four equal boxes, each a number, a label, and a delta. It is not *wrong* — it is
just what everything looks like, and it tells the reader nothing about how the
four relate.

**Replacements, in order of preference:**

1. **Put the figures inside the thing they describe.** Exposure belongs on the
   field, not above it.
2. **A field key** — one rule, several labelled figures, a caption.
3. **Give one figure the display treatment** and let the rest be a plain list.
   Hierarchy beats equality.
4. If you must have a row, **make the tiles unequal**, and give each one a real
   comparison rather than a percentage delta.

---

## Colour and status

- **Status is never colour alone.** Pair every state with its word. A red dot
  means nothing; "Act now" means something.
- **Earn the accents.** Risk colours appear only when something is genuinely at
  risk. If half the screen is amber, amber means nothing.
- **One accent for interaction**, separate from the status colours, so "clickable"
  and "urgent" never look the same.
- **Check contrast on every status colour against its actual background**, not
  against white.
