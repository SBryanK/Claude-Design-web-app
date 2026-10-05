# Motion

Motion is how an interface explains itself. It shows where something came from,
confirms that a press registered, and directs attention to what changed. It is
not decoration, and it is not a demonstration of the maker's ability.

**If the reader has to wait for an animation, it is too long. If removing it
loses no information, it should not exist.**

## The system: one easing family, four durations

```css
--ease-out:    cubic-bezier(.22, .68, .35, 1);   /* the workhorse */
--ease-inout:  cubic-bezier(.77, 0, .175, 1);    /* authored moments */
--ease-drawer: cubic-bezier(.32, .72, 0, 1);     /* panels and drawers */
--dur-1: 120ms;   /* micro: colour, opacity, hover */
--dur-2: 220ms;   /* default: state changes, small movement */
--dur-3: 360ms;   /* larger movement, panels */
--dur-4: 600ms;   /* entrance, the one authored moment */
--dur-slow: 900ms; /* reveals, scroll-linked */
```

Restraint is the point. One family and four durations is enough for a whole
product, and it is what makes the motion feel like it belongs to one thing.

## Rules

**Animate only compositor-friendly properties:**

```
transform · opacity · clip-path · filter
```

Never `width`, `height`, `top`, `left`, `margin`, or `padding` — each one
relayouts on every frame. A progress bar animates `transform: scaleX()`, not
`width`:

```css
/* wrong — relayouts every frame */
.bar { width: 0; transition: width 300ms; }

/* right — compositor only */
.bar { transform: scaleX(0); transform-origin: left; transition: transform 300ms var(--ease-out); }
```

**Reveal with `clip-path`, not with height.** A height animation relayouts the
page and pushes content down while it plays.

```css
.reveal { clip-path: inset(0 100% 0 0); transition: clip-path 900ms var(--ease-inout); }
.reveal.in { clip-path: inset(0 0 0 0); }
```

**One authored moment per surface.** Not scattered effects, and not the same
entrance on every section. Pick the one place where motion teaches something —
the mechanism, the central chart, the moment of change — give it the `--dur-4` /
`--dur-slow` treatment, and let everything else be a plain `--dur-2` state
change.

**Reach past transform where the world earns it.** `clip-path`, `mask`,
`backdrop-filter`, and `filter` are all legitimate when they serve the world.
They are not legitimate as a style.

**Nothing may be hidden by animation timing.** This is the most damaging motion
bug: content that is invisible because a script did not run, an observer did not
fire, or a transition was interrupted.

```css
/* content is visible by default */
.reveal { opacity: 1; }

/* the hidden state exists only once we know we can remove it */
.js-reveal .reveal { opacity: 0; transform: translateY(12px); }
.js-reveal .reveal.in { opacity: 1; transform: none; }
```
```js
// add .js-reveal only when the observer is actually available
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('js-reveal');
  // ...observe
}
```

**Always provide an escape hatch.** Honour reduced motion, and offer a static
mode for screenshots, print, and anyone who would rather read than watch.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```js
var STATIC = /(^|[?&])static\b/.test(location.search) ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;
```

In static mode: reveals shown, counters at their final value, scroll reveals
fully revealed, sticky sections released to natural height.

## Scroll

**Scroll-linked, never scroll-jacked.** The reader keeps their scrollbar and the
page keeps up. Hijacking the scroll to play an animation is a hostile act — it
takes control away and breaks every expectation the browser set.

```js
function update() {
  var rect = section.getBoundingClientRect();
  var travel = Math.max(1, rect.height - innerHeight);
  var p = Math.min(1, Math.max(0, -rect.top / travel));

  // touch the DOM only when the value actually changed
  if (Math.abs(p - last) > 0.004) {
    last = p;
    chart.style.clipPath = 'inset(0 ' + ((1 - p) * 100).toFixed(2) + '% 0 0)';
  }
}
addEventListener('scroll', update, { passive: true });
addEventListener('resize', update);
update();
```

Three requirements in that snippet, all load-bearing:

1. `{ passive: true }` — so the listener never blocks scrolling.
2. **Only write to the DOM when the value changed.** A scroll listener fires
   dozens of times per second; writing every time is a jank source.
3. **Guard the degenerate case.** On a viewport taller than the section there is
   no travel, so there is no scroll to link to. Show the finished state:

```js
if (rect.height <= innerHeight * 1.05 || STATIC) { showFinalState(); return; }
```

Skip that guard and a tall monitor sees a permanently hidden chart.

## Never schedule required work on `requestAnimationFrame`

A frame-scheduled loop stops dead whenever frames stop being produced:

- a background tab
- a headless render or screenshot
- an off-screen iframe
- a throttled compositor

If the boot, the data load, or the layout depends on it, the app sits on its
loading screen forever. Use a timer, and carry a watchdog:

```js
function step() {
  // ...work in slices
  if (more) { setTimeout(step, 0); return; }   // NOT requestAnimationFrame
  finish();
}
setTimeout(step, 0);
setTimeout(forceFinish, 12000);                // the watchdog
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) setTimeout(function () { if (!done) forceFinish(); }, 60);
});
```

`setTimeout` still yields to the browser between slices, so the progress bar
paints exactly as it did with frames — and it keeps running when frames do not.

Use `requestAnimationFrame` for *cosmetic* work only: a counter that can finish
instantly anyway, a cursor follower, a parallax offset. Never for anything the
page needs in order to be usable.

## Dialog and drawer motion

- Open: `--dur-3` with `--ease-drawer`. Close: `--dur-2`, faster. Leaving should
  feel quicker than arriving.
- **Manage focus.** Trap Tab inside while open; return focus to the trigger on
  close. A dialog that drops focus into the page behind it is broken for anyone
  using a keyboard.

```js
function trapTab(e) {
  if (e.key !== 'Tab') return;
  var f = focusables();
  if (!f.length) return;
  var first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
```

- Bind document-level listeners **once**. If the component is rebuilt on every
  navigation and re-binds them, they accumulate: after ten navigations there are
  ten listeners, all firing.

## Counters and numbers

A count-up earns its place only when the number is the argument. Otherwise show
it settled.

```js
function countUp(el, to, ms) {
  if (STATIC) { el.textContent = String(to); return; }   // always honour static
  var t0 = null;
  function frame(t) {
    if (t0 === null) t0 = t;
    var p = Math.min(1, (t - t0) / ms);
    var e = 1 - Math.pow(1 - p, 3);                      // ease-out cubic
    el.textContent = String(Math.round(to * e));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

Ease-out, 900–1200ms, and land on the exact figure. A counter that overshoots the
final value and settles back is showing off.

## Quick audit

- [ ] One easing family and four durations, declared as tokens.
- [ ] No layout property is animated anywhere.
- [ ] Content is visible by default; hiding requires a script that is known to run.
- [ ] Reduced motion and a static mode both settle everything at once.
- [ ] Scroll effects are linked, passive, and change-guarded.
- [ ] No required work on `requestAnimationFrame`.
- [ ] Dialogs trap and return focus.
- [ ] Document listeners are bound once.
- [ ] The one authored moment is identifiable, and there is only one.
