# Headroom — Jabil Advanced Credit Management Dashboard

An interactive working prototype of the dashboard proposed in the pitch for
Jabil project **IND2620-0011**. It turns Jabil's Credit Management Dashboard
from a record of what has already happened into an early-warning tool: one that
says which customers may pass their credit limit, how fast each one is getting
worse, and why.

**Every customer and every number in this prototype is invented.** Nothing here
came from Jabil. The only things taken from the brief are the shape of the
problem, the data sources, and the six things Jabil asked the dashboard to do.

---

## Opening it

**Double-click `index.html`.** That is the whole installation. There is no build
step, no server, no `npm install`, and nothing is fetched at runtime — not even a
font. Every face ships inside the folder.

There are three entry points:

| File | What it is |
|---|---|
| `index.html` | **The landing page.** The pitch: why the dashboard Jabil has cannot answer this question, and what Headroom does instead. Cinematic opening, three proof figures, one scroll moment that demonstrates the mechanism on a real customer from the prototype. |
| `app.html` | **The working dashboard.** Seven screens: Portfolio, Customers, Customer view, External radar, Model performance, Thresholds, Methodology. |
| `data-requirements.html` | **The data request.** Every SAP field, every external source, how the two connect, what Jabil must decide, and a readiness checklist. |

Add `?static=1` to the landing page URL to settle every animation at once — for
screenshots, for printing, or if you would rather read than watch.

Both surfaces run on desktop and on a phone. Below 1024px the dashboard's left
rail becomes a top bar and the navigation moves into a disclosure; the landing
page does the same below 900px. Nothing is unreachable on a small screen.

Both print cleanly: the landing page to eight A4 pages, the dashboard to four,
the data request to twenty.

To send it to a teammate, send `headroom-app.zip`. They unzip it and open
`index.html`.

---

## The problem this responds to

Jabil's current dashboard shows credit exposure as it is today: unpaid invoices,
stock built for a customer, and open orders, measured against a credit limit.
It can say who is exposed. It cannot say who is about to become a problem, so
credit management stays reactive — limits are breached, order holds arrive
suddenly, and the credit team spends its week firefighting.

Headroom adds four modules, one for each of Jabil's six stated asks:

| Module | Answers |
|---|---|
| **Exposure forecast** | When may this customer pass its limit, and by how much? |
| **Early-warning score** | Is this customer getting worse, and what moved it? |
| **External credit radar** | What do public sources say that SAP cannot? |
| **Watchlist and reasons** | Who should be looked at first, and what should be done? |

A design rule runs through all of it: **the tool recommends, people decide.** It
never changes a limit and never holds an order. Every alert carries its reasons.

---

## What is on each screen

**The landing page** opens on the product's own terrain, after dark, under a slow
scanning light — not a stock photograph, because the opening image should be the
mechanism rather than a picture of one. It states the claim in one sentence,
proves it with three figures, then spends a full scroll demonstrating it: one
real customer's exposure runway drawing itself from a position that looked fine
to the morning it stops looking fine.

**Portfolio** — the morning view. A credit weather map places every customer
group by *how soon a breach may come* against *how fast risk is rising*, which
gives four zones: Act now, Watch, Growth and Clear. **The contour lines are
computed** — a kernel-density estimate over the book, contoured and stitched into
closed loops — so they show where exposure actually concentrates and they move
when the data moves. Beside the field sits the ranked watchlist, where a row that
changed zone stays lit until you have read it; below, the weekly briefing and
what moved.

**Customers** — the full book, searchable and sortable, with each customer's
zone, utilisation, breach chance and exposure. Clicking any row opens the
customer page.

**Customer view** — one customer in full: the exposure runway (a fan chart of
5,000 simulated futures, showing the line to read and the band that says how
sure we are), what makes up the exposure, how the customer's behaviour compares
with *its own* normal, the reasons behind its score in plain sentences, and a
suggested next step.

**External radar** — the path from an SAP customer code to the right legal
entity and parent group, five public signal families on a radar, and evidence
of whether outside signals moved before the payment record did.

**Model performance** — an honest back-test on 24 monthly cut-offs, rolled
forward so no model ever sees the future. Each layer must beat the simpler one
below it at the same false-alarm rate, and the screen says plainly which results
are *not* proven.

**Thresholds** — the zone lines are a business decision, not a model output.
Move them and watch who changes zone, with the briefing re-written live.

**Methodology** — the exposure formula, the breach-chance model with its
constants, the scorecard, and the runway, all written out so they can be argued
with. It also lists exactly what is invented here and what would be real.

**Ask Headroom** — a panel that explains the finished results in plain English.
It reads only what the pipeline has already computed, never recalculates, and
never touches SAP. If a question cannot be answered from the results, it says so
rather than guessing.

---

## How the numbers are produced

Nothing is random noise. Every figure is derived from an observable, and the
derivation is on screen.

**Exposure** is one formula, used everywhere:

```
exposure = receivables + dedicated stock + (open POs − stock already built for those POs)
```

Stock already built for an open PO is counted once. Shipping does not change
exposure — it moves value from the open PO into receivables and stops the stock
counting.

**Breach chance** is the sum of four drivers on top of a base rate, so the
reasons always add up to the number:

| Driver | Starts to matter at | Full strength at |
|---|---|---|
| How much of the limit is used | 60% used | 100% used |
| Paying later than its own normal | 0 days | +20 days |
| Order book growing | 0% | +45% in 4 weeks |
| Overdue balances ageing | 0% | 18% migrating |
| Growth into a limit already used | 75% used | 100% used |

**Worsening chance** is a scorecard: a base rate of 18%, plus the points of each
driver, so each reason on screen carries its own contribution.

**The runway** places the median path where the order book is taking exposure,
then lets the balance wander around it. The size of the wander is the customer's
own history — the spread of its payment delays, scaled by how much cash settles
each day — so a customer that always pays on the same date produces a narrow fan
and one whose delays run from 0 to 30 days produces a wide one.

**Determinism.** The portfolio is generated once from a fixed seed, each
customer's simulation is seeded from its own id, and the back-test draws from a
fixed seed. Reload the page and every figure is identical, which is what makes a
demo safe.

---

## How the model was checked

The six customers the pitch describes each have a reading the credit team gave
them. The Model performance screen compares the formula's own arithmetic against
those readings and prints the gap:

| Customer | Pitch | Model | Why it is interesting |
|---|---|---|---|
| A | 78% | 95% | Pays 18 days late, 97% of limit used |
| B | 71% | 62% | Growing 34%, pays on time, 92% used |
| C | 22% | 20% | Stock waiting 11 weeks, 63% used |
| D | 38% | 31% | Disputes doubled, 74% used |
| E | 6% | 4% | Ahead of its own normal, 54% used |
| F | 58% | 69% | Orders up 22%, 98% used |

The two gaps that remain are shown rather than tuned away, because they are a
real question for the credit team: the formula treats growth into an
already-used limit as the strongest single signal in the book, and it says so.

---

## Sharing and self-testing

Send `headroom-app.zip`. It contains:

```
headroom-app/
  index.html              ← open this
  data-requirements.html  ← the data request to Jabil
  selftest.html           ← open this to check a copy is intact
  README.md
  css/app.css
  fonts/                  Hanken Grotesk, four weights, shipped offline
  js/core.js              toolkit: formatting, DOM, seeded random, state
  js/data.js              the invented portfolio (120 groups)
  js/engine.js            the four modules and the back-test
  js/terrain.js           the computed isolines behind the weather map
  js/charts.js            every other SVG chart, drawn by hand
  js/ui.js                shared interface pieces
  js/views.js             the seven screens
  js/assistant.js         the question-answering panel
  js/app.js               the shell and the router
```

**`selftest.html`** runs 128 checks over a copy: that the portfolio totals are
right, that no probability is out of range, that every reason list adds up to its
score, that the terrain draws real closed contour loops, that every screen renders
with no `NaN`, no unlabelled chart, no DOM node printed as text, and no markup
leaking through as visible text, and that the assistant answers each kind of
question differently and correctly. It also exercises the interface — moving a
threshold really re-zones the book, the search and zone filters really narrow the
list — and it carries regression checks for three bugs that shipped once: a
backdrop with a class the stylesheet never defined, a boot loop driven by
animation frames, and global event listeners that piled up on every navigation.
Open it and read the result at the top. It needs nothing installed.

## Typeface

Two faces, one job each.

**Instrument Serif** carries every statement and every large figure — page
titles, panel headings, the figures on the landing page. It ships a single
weight, so scale and space do the work a bold weight would otherwise do, which is
exactly why it reads as editorial rather than as a dashboard.

**Proxima Nova** carries every interface surface and every figure in a table. It
is pre-installed on macOS as an Apple system font asset, so it renders natively
there. Every other machine gets **Hanken Grotesk**, a close open-licensed match,
self-hosted from `fonts/`.

The pairing is deliberate and matches both the reference the client pinned
(Instrument Serif + Inter) and the team's original pitch deck (Cambria +
Calibri). Nothing is fetched over the network.

> **A note on the display face.** The design detector flags Instrument Serif as
> an over-used face, and it is right — it is a common choice right now. It stays
> because the brief pinned it by naming the reference site, and a pinned brief
> outranks a saturation warning. If the team would rather not look like the
> reference, this is the single change with the most effect.

---

## Honest limitations

These are stated on the screens themselves, not hidden here.

- **It is the past.** The back-test describes 24 months of invented history. A
  new kind of shock may behave differently.
- **One layer is not proven.** Layer 4 (external radar) adds 3 points, which sits
  inside the range of the layer below, so it is kept only for the groups with SEC
  filings and labelled *Not proven*.
- **The matching is the weak link.** Every external signal is worthless if it
  lands on the wrong company, so the match is shown with its confidence and an
  analyst confirms each new one.
- **There are not many bad cases.** Twelve worsening cases give wide ranges.
  Each new month of real data narrows them.
- **A score is not a verdict.** A high score means *look now*. It does not
  predict default.
- **The data is invented.** Everything here would need replacing with a real SAP
  extract before any of it means anything about Jabil's customers.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `1` … `6` | Jump between the main sections |
| `/` | Focus the search box on the customers list |
| `Esc` | Close the assistant panel, or the navigation panel on a narrow screen |
| `Tab` / `Enter` | Every dot on the weather map and every table row is reachable and openable |

---

## The design world

The interface is a **topographic survey sheet**. A portfolio is drawn as terrain;
the analyst reads the shape of the land rather than a row of metric tiles. Colour
runs from a pale map sheet through five greens to a saturated ridge, with honey,
coral and teal *earned* — they only appear where risk, or interaction, actually
is. The full system is recorded in [`DESIGN.md`](../DESIGN.md).

---

*MSc Smart Industries and Digital Transformation, National University of
Singapore — capstone pitch for Jabil, project IND2620-0011.*
