/* ============================================================================
   Headroom — landing page behaviour

   One authored moment, one reveal system, and nothing else. Every effect here is
   scroll-LINKED rather than scroll-jacked: the reader keeps the scrollbar, and
   the page keeps up. Nothing is hidden by default — if this script never runs,
   the whole page still reads.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR;
  var charts = HR.charts;

  /* Static mode settles every entrance state at once. It is set by `?static`,
     by a print stylesheet, and by the reader's own reduced-motion preference. */
  var STATIC = /(^|[?&])static\b/.test(global.location.search) ||
    (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var reduceMotion = STATIC;

  if (STATIC) document.documentElement.classList.add('lp-static');

  /* ------------------------------------------------------------- the hero --
     The product's own terrain, after dark. It is the same computed field the
     dashboard draws, so the opening image is the mechanism rather than a
     picture of one. */
  function heroField() {
    var host = document.getElementById('heroField');
    if (!host) return;
    var p = HR.engine.portfolio();
    var rng = HR.rng(4711);

    host.appendChild(HR.terrain.field({
      width: 1500, height: 900, dark: true, bare: true, fill: true,
      bandwidth: 0.05,
      points: p.rows.map(function (m) {
        return {
          id: m.group.id, code: m.group.code, name: m.group.name,
          x: m.breachChance, y: m.worsenChance, size: m.exposure, zone: m.zone,
          breach: m.breachChance, worsen: m.worsenChance
        };
      }),
      thresholds: HR.store.thresholds,
      onSelect: function () {}
    }));
    /* The hero is an image, not a control surface: strip the interaction so a
       stray click never navigates away from the page. */
    Array.prototype.forEach.call(host.querySelectorAll('g.hit'), function (g) {
      g.removeAttribute('tabindex');
      g.removeAttribute('role');
      g.style.pointerEvents = 'none';
    });
  }

  /* --------------------------------------------------------- the headline --
     A slow count to the figure, run once when the row enters view. It is the
     only number animation on the page and it earns its place: these three
     figures are the argument. */
  function countUp(el, to, ms) {
    if (reduceMotion) { el.textContent = String(to); return; }
    var t0 = null;
    function frame(t) {
      if (t0 === null) t0 = t;
      var p = HR.clamp((t - t0) / ms, 0, 1);
      /* Ease-out cubic: fast to begin, gentle to land, so the final figure is
         readable rather than snatched away. */
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1) global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------- the moment --
     The chart is the product's real runway for Customer A. Scrolling across the
     section reveals it left to right and wakes each step in turn. */
  function moment() {
    var section = document.getElementById('moment');
    var chartHost = document.getElementById('momentChart');
    var steps = Array.prototype.slice.call(document.querySelectorAll('.lp-moment-step'));
    var caption = document.getElementById('momentCaption');
    if (!section || !chartHost) return;

    var m = HR.engine.find('grp-A');
    if (!m) return;
    var f = m.forecast;

    chartHost.appendChild(charts.fanChart({
      width: 880, height: 470,
      start: HR.data.AS_OF,
      end: HR.addDays(HR.data.AS_OF, HR.engine.HORIZON),
      limit: m.limit,
      median: f.median,
      band: f.band,
      straightLine: f.straight,
      breachDate: m.breachDate,
      breachValue: m.breachDate ? m.limit : null,
      peakDate: f.peakMedianDate,
      peakValue: f.peakMedian,
      today: HR.data.AS_OF
    }));

    var CAPTIONS = [
      'Today \u2014 exposure ' + HR.usd(m.exposure) + ' against a ' + HR.usd(m.limit) + ' limit',
      'Day 90 \u2014 the median path at ' + HR.usd(f.fitted.endExposure) + ', before the crossing',
      HR.pct(m.breachChance) + ' of futures cross the limit \u2014 most likely ' + HR.dateShort(m.breachDate),
      'The four drivers behind ' + HR.pct(m.breachChance) + ' \u2014 base rate ' + HR.pct(m.score.baseRate) + ' plus ' +
        HR.signed(Math.round(m.score.points)) + ' points'
    ];

    var lastStep = -1, lastP = -1;

    function update() {
      var rect = section.getBoundingClientRect();
      var vh = global.innerHeight || 800;

      /* On a viewport taller than the section there is no sticky travel, so
         there is no scroll to link to. Showing the finished state is the only
         honest option: the alternative is a chart that can never be revealed. */
      if (rect.height <= vh * 1.05 || reduceMotion) {
        if (lastP !== 1) {
          lastP = 1;
          chartHost.style.clipPath = 'none';
          steps.forEach(function (s) { s.classList.add('on'); });
          if (caption) caption.textContent = CAPTIONS[CAPTIONS.length - 1];
        }
        return;
      }

      /* Progress runs from the moment the section's top reaches the viewport top
         to the moment its bottom leaves — the whole sticky travel. */
      var travel = Math.max(1, rect.height - vh);
      var p = HR.clamp(-rect.top / travel, 0, 1);

      /* Only touch the DOM when something actually changed; this runs on every
         scroll frame. */
      if (Math.abs(p - lastP) > 0.004) {
        lastP = p;
        if (!reduceMotion) {
          chartHost.style.clipPath = 'inset(0 ' + ((1 - p) * 100).toFixed(2) + '% 0 0)';
        }
      }

      var active = 0;
      for (var i = 0; i < steps.length; i++) {
        if (p >= parseFloat(steps[i].getAttribute('data-at'))) active = i;
      }
      if (active !== lastStep) {
        lastStep = active;
        steps.forEach(function (s, i) { s.classList.toggle('on', i <= active); });
        if (caption) caption.textContent = CAPTIONS[Math.min(active, CAPTIONS.length - 1)];
      }
    }

    /* One passive listener, read-only, so scrolling is never blocked. */
    global.addEventListener('scroll', update, { passive: true });
    global.addEventListener('resize', update);
    update();
    /* A first pass after layout settles, so the reveal starts at zero rather
       than wherever the browser guessed before fonts and charts landed. */
    global.requestAnimationFrame(update);
  }

  /* ------------------------------------------------------------- evidence --
     The real back-test ladder. Same numbers as the dashboard, so the landing
     page cannot drift away from the product it is describing. */
  function ladder() {
    var host = document.getElementById('ladderChart');
    if (!host) return;
    var bt = HR.engine.backtest();
    host.appendChild(charts.barLadder({
      width: 640, height: 380, xMax: 100,
      rows: bt.results.map(function (r) {
        return {
          label: r.name,
          sub: r.sub + ' \u00b7 ' + r.medianWarning + ' days median warning',
          pct: r.caughtPct, lo: r.range[0], hi: r.range[1],
          tag: r.verdict,
          tagColor: r.isBaseline ? '#8AA294' : (r.verdict === 'Not proven' ? '#E08A00' : '#1F7A4D'),
          baseLine: 50, isBaseline: r.isBaseline
        };
      })
    }));
  }

  /* -------------------------------------------------------------- reveals -- */

  function reveals() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!nodes.length) return;

    if (reduceMotion || !('IntersectionObserver' in global)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    /* The class that hides them is only added once we know the observer can
       take it away again. */
    document.documentElement.classList.add('js-reveal');

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    nodes.forEach(function (n) { io.observe(n); });
  }

  function stats() {
    var figs = document.querySelectorAll('.lp-stat-fig [data-count]');
    if (!figs.length) return;

    function run(el) {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      var to = parseFloat(el.getAttribute('data-count'));
      if (STATIC) { el.textContent = String(to); return; }
      countUp(el, to, 1100);
    }
    /* In static mode every figure lands at once: an observer that never fires
       because the element sits below the fold would otherwise leave a zero. */
    if (STATIC || !('IntersectionObserver' in global)) {
      Array.prototype.forEach.call(figs, run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(figs, function (f) { io.observe(f); });
  }

  function nav() {
    var bar = document.getElementById('lpNav');
    if (!bar) return;

    function update() {
      bar.classList.toggle('solid', (global.scrollY || 0) > 40);
    }
    global.addEventListener('scroll', update, { passive: true });
    update();

    /* The narrow-viewport disclosure. It closes on Escape, on choosing a
       section, and on a click outside — the three ways a reader expects a menu
       to get out of the way. */
    var toggle = document.getElementById('lpNavToggle');
    if (!toggle) return;
    function setOpen(v) {
      bar.classList.toggle('open', v);
      toggle.setAttribute('aria-expanded', String(v));
      toggle.setAttribute('aria-label', v ? 'Hide sections' : 'Show sections');
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!bar.classList.contains('open'));
    });
    bar.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.lp-nav-links a')) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!bar.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------------------------------------------------------------- boot --- */

  function boot() {
    heroField();
    moment();
    ladder();
    reveals();
    stats();
    nav();
  }

  /* The portfolio has to be measured before any chart can draw, and the landing
     page draws four of them. The dashboard does this in slices with a progress
     screen; here it is cheaper to do it once, synchronously, behind the hero
     image that is already painted. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      HR.engine.portfolio();
      boot();
    });
  } else {
    HR.engine.portfolio();
    boot();
  }
})(window);
