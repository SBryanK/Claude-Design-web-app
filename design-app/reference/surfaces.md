# Surfaces

The same principles apply everywhere; the emphasis does not. Identify the surface
first, because most design mistakes are a good pattern applied to the wrong one.

A landing page and a dashboard want opposite things: one is read once and must
persuade, the other is read daily and must disappear. Copying the landing page's
generosity into the dashboard produces a tool nobody can scan; copying the
dashboard's density onto a landing page produces a wall nobody reads.

## Choosing

| Surface | Optimise for | Density | Motion budget |
|---|---|---|---|
| Marketing site | Persuasion in one pass | Generous | High — one authored moment |
| Web application | Repeated daily use | Measured | Low — state changes only |
| Dashboard / data tool | Scanning many values fast | Dense | Minimal |
| Mobile web / PWA | One task, one hand | Measured | Low–medium |
| Native app | Platform fluency | Platform-native | Platform-native |
| Documentation | Finding the answer | Dense, navigable | Very low |
| Email | Rendering everywhere | Constrained | None |

---

## Marketing site / landing page

**Job:** a stranger understands what this is and why it matters, in one scroll,
without being taught. Then acts.

**Structure that works**

1. **Hero** — the thesis as a statement, one lede, one primary action, one quiet
   secondary. The first viewport answers "what is this", not "what does it have".
2. **Proof** — two to four figures or facts that make the claim concrete.
3. **Mechanism** — how it actually works. This is where the one authored moment
   lives, because this is the part that must be *shown*.
4. **Principles** — what it refuses, and why. Short declarative sentences.
5. **Detail** — the feature set, once the reader already cares.
6. **Evidence** — limitations published, not buried. This is the most persuasive
   section on any page and almost nobody includes it.
7. **Close** — one clear ask, plus a link to the deeper document.

**Rules**

- **The hero is a statement, not a product name and a screenshot.** Display type
  at scale. The product's own visual world, not stock imagery.
- **One idea per section.** If a section needs two headings, it is two sections.
- **Left-aligned beats centred** for anything longer than one line. Centred body
  text is hard to read and reads as a template.
- **The full-bleed moment earns full bleed.** Used once, it is a climax; three
  times, it is a pattern.
- **Vary the section ground** (plain / wash / dark) so the scroll has rhythm and
  the reader knows where they are.
- **Write real copy while designing.** Lorem ipsum hides every layout problem
  that will actually occur.

**The failure:** a metric-tile row, three feature cards of equal weight, a
testimonial, and a CTA — the page every product has. If your structure could
belong to another product unchanged, it does.

---

## Web application

**Job:** someone uses it daily and forgets it is software.

**Shell**

- **Left rail** for primary navigation, 200–260px, fixed, with the current
  section marked by a filled ground rather than a colour change alone.
- **Top bar** for context: page title, as-of state, and the actions for *this*
  page. Not global actions.
- **Content** is the only thing that scrolls.

**Rules**

- **Density is a feature.** A tool used daily should show more per screen than a
  page read once. 14px body, 13px table text, 24px panel padding.
- **The quiet screen should be quiet.** A settings page has no hero. Do not give
  every route the same weight.
- **Persistent state must be visible.** If there is a filter, a date range, or an
  as-of date, it is on screen at all times — never hidden in a menu.
- **Destructive actions are confirmed; everything else is not.** A tool that
  confirms every action trains people to click through confirmations.
- **Optimistic UI for anything instant**, with a real error path for when it
  fails.
- **Keyboard is a first-class input.** `⌘K`, `Esc`, arrow keys, and visible focus
  everywhere.

**The failure:** the dashboard aesthetic applied to a settings page — cards of
equal weight, huge type, and vast padding where a dense form belongs.

---

## Dashboard / data tool

**Job:** one glance must answer the question the user came with. The screen is a
summary, not a report.

**Rules**

- **Answer the question in the first screen region**, before any scrolling. The
  top of the page is the conclusion; the rest is the support.
- **One primary view, then detail.** A field, a chart, or a table that owns the
  space; everything else is smaller and beside it.
- **A field key beats a stat row.** Four numbers in a row tell you nothing about
  their relationship. Four numbers *inside the thing they describe* tell you
  everything.
- **Every figure has a comparison.** A number alone is decoration; a number
  against its limit, its last period, or its own normal is information.
- **Never more than four or five primary figures.** Rank them. If everything is
  important, nothing is.
- **Rows over cards for repeated items.** A table scans; a stack of cards does
  not. Use cards only when the items are genuinely objects with internal layout.
- **Colour is a fourth channel**, after position, size, and order. Use it last,
  and always with a word.
- **The as-of date is always visible.** A dashboard with no timestamp is a
  dashboard nobody can trust.

**The failure:** eight equal-weight chart cards in a grid, each with its own
legend, none related. The reader must do the synthesis the product should have
done.

See `data.md` for charts and tables specifically.

---

## Mobile web / PWA

**Job:** one task, one hand, interrupted constantly.

**Rules**

- **Design at 390px first**, then expand. Desktop-first produces mobile layouts
  that technically work and are miserable.
- **Thumb zone.** Primary actions in the lower third. Destructive and rare
  actions at the top, away from the thumb.
- **Tap targets ≥ 44×44px**, ≥ 8px apart. A 24px icon needs 10px of padding to
  become a 44px target.
- **A fixed rail becomes a top bar with a disclosure.** A rail on a 390px screen
  leaves 150px of content — one word per line.
- **Respect the safe area:** `padding: env(safe-area-inset-bottom)`.
- **Input types matter:** `type="email"`, `inputmode="numeric"`, `autocomplete`.
  The right keyboard halves the effort of every form.
- **Never disable zoom.** Never use `position: fixed` for anything taller than
  the viewport.
- **Test with the keyboard open.** Half the viewport disappears; whatever was
  centred is now hidden.

**The disclosure pattern**

```css
@media (max-width: 1024px) {
  .rail { position: fixed; inset: 0 0 auto 0; flex-direction: row; overflow: visible; }
  .nav  { position: absolute; top: 100%; left: 0; right: 0; display: none; background: #fff; }
  .rail.open .nav { display: flex; flex-direction: column; }
  .main { margin-left: 0; }
}
```

Two traps in that snippet, both of which break it silently:

- **`overflow: visible` on the rail.** A rail that clips a decorative element
  will clip the menu that hangs below it. The JavaScript runs, `display: flex`
  computes correctly, and nothing appears.
- **An opaque background on the open panel.** Over hero imagery, a translucent
  panel lets the headline ghost through the links.

**The failure:** the desktop layout, narrower. Text wraps to one word per line,
the rail eats the screen, and horizontal scroll appears.

---

## Native app

**Job:** feel like it belongs on the device.

- **Follow the platform.** iOS and Android have different navigation, back
  behaviour, and motion expectations. A cross-platform skin that ignores both
  feels wrong on both.
- **Platform type first.** The system face is correct here; a custom display face
  belongs in the brand moments only.
- **Respect the safe areas, the home indicator, and the status bar.**
- **Motion is the platform's.** Transitions, sheets, and haptics should feel like
  the OS, not like a website in a wrapper.
- **Offline is a state, not an error.** Say what is available, don't just fail.

If you are building a web app that will be wrapped for mobile, treat it as mobile
web with platform polish — do not attempt to fake native navigation.

---

## Documentation / content site

**Job:** the reader arrives with a question and leaves with the answer.

- **Three columns**: navigation, content at a 68ch measure, on-this-page.
- **Search is the primary navigation.** Put it in the header, not in a menu.
- **Code samples need real contrast, a copy button, and horizontal scroll inside
  the block** — never page-level overflow.
- **Anchor links on every heading**, visible on hover and on focus.
- **Density is correct here.** Generous padding wastes the reader's scroll.

---

## Email

**Job:** render correctly in a dozen clients you cannot test.

- **Tables for layout.** Not nostalgia — it is what Outlook understands.
- **Inline styles.** Most clients strip `<style>`.
- **600px max width.** Wider gets clipped in the preview pane.
- **No web fonts.** Use the system stack; a missing face falls back badly.
- **Images need alt text and explicit dimensions**, and the layout must survive
  images being blocked — which is the default for many recipients.
- **Dark mode is real.** Test it; do not assume your colours survive inversion.
- **One action.** Multiple competing CTAs halve the response to each.

---

## When the surface is unclear

Ask. "Is this read once or daily?" changes every decision that follows, and
guessing wrong costs the whole build. If you cannot ask, infer from the audience
and **state your assumption in the direction contract** so it can be corrected.

If a project spans several surfaces — a marketing site and the app behind it —
they share one world and one token sheet, with different density and motion
budgets. The landing page is the loudest expression of the world; the app is its
quietest. Both must be recognisably the same product.
