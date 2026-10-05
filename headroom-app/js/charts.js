/* ============================================================================
   Headroom — charts
   Dependency-free SVG builders. Every function takes a plain spec object and
   returns a fresh <svg> element; the caller appends it. No imports, no build
   step, no fetches, no images.

   House rules that this file obeys everywhere:
     - every coordinate goes through safe()/r2(), because one NaN in a path
       attribute makes the whole chart disappear;
     - colours that a stylesheet could override are written into an inline
       `style` (a class rule such as `.chart text { fill: ... }` beats a
       presentation attribute, but never beats an inline style);
     - no non-finite number, "undefined" or "NaN" ever reaches an attribute.

   Shared internals (namespace IIFE at the top of the closure):
     safe, r2, S, fillOf, toTime, shortFromTime, fullFromTime, usd, pct1,
     scaleLinear, niceStep, niceTicks, niceDomain, linePath, areaPath,
     roundRect, chip, txt, hitRect, dotCircle, withTip, tipHTML, tint,
     wrapLabel, svgRoot, emptySvg.
   ========================================================================== */
(function (global) {
  'use strict';

  var HR = global.HR = global.HR || {};
  var charts = HR.charts = HR.charts || {};

  var NS = 'http://www.w3.org/2000/svg';
  var DAY = 86400000;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------------------------------------------------------------- tokens */

  /* The topographic palette. Names are kept from the previous world so every
     existing chart keeps working; only the values move. */
  var COL = {
    pine: '#0E4A2F', pine2: '#1F7A4D', pine3: '#4FA877',
    ink: '#10261C', muted: '#5A6E62', grey: '#8AA294',
    line: '#C7DECD', lineSoft: '#DCEBE0', white: '#FFFFFF',
    sage: '#C8EAD3', sage2: '#F2FAF4', mint: '#B5E0BE',
    amber: '#E08A00', amber2: '#F0A82A', amber3: '#FDF0D6', amberD: '#8A5300',
    tan: '#0E9E93', sand: '#D4F1EE', neg: '#C4432B',
    zAct: '#E8543A', zWatchBg: '#FDF0D6', zGrowth: '#35C0B4', zClear: '#6FBF8B'
  };

  /** Per-zone paint for the weather map: fill, stroke, on-dot label colour. */
  var ZONE = {
    /* Every zone needs a dot that reads as SOLID against its own quadrant tint.
       Watch was sand-on-amber3, which looked like a hollow ring rather than a
       filled marker, so it now carries the amber it is named for. */
    'Act now': { fill: '#E8543A', stroke: '#C4432B', label: COL.white, accent: '#E8543A' },
    'Watch':   { fill: '#F0A82A', stroke: '#C87F00', label: '#6E4200', accent: '#F0A82A' },
    'Growth':  { fill: '#35C0B4', stroke: '#0E9E93', label: COL.white, accent: '#35C0B4' },
    'Clear':   { fill: '#8CC0A0', stroke: '#6FBF8B', label: COL.pine, accent: '#6FBF8B' }
  };
  function zoneOf(name) { return ZONE[name] || ZONE.Clear; }

  /* ------------------------------------------------------- numeric helpers */

  /** Any value -> a finite number, or the fallback. The single NaN guard. */
  function safe(v, fallback) {
    var fb = (fallback === undefined ? 0 : fallback);
    if (typeof v === 'number') return isFinite(v) ? v : fb;
    if (v === null || v === undefined || v === '') return fb;
    var n = parseFloat(v);
    return isFinite(n) ? n : fb;
  }

  /** Rounded to 2dp — keeps path strings short and always finite. */
  function r2(v) { return Math.round(safe(v, 0) * 100) / 100; }

  function clamp01(v) { return Math.max(0, Math.min(1, safe(v, 0))); }
  function clampi(v, lo, hi) { return Math.max(lo, Math.min(hi, safe(v, lo))); }

  /** Join truthy CSS declarations: S('fill:#fff', 'stroke-width:2'). */
  function S() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(';');
  }
  /** Inline fill declaration (always beats the stylesheet). */
  function fillOf(color, extra) { return S('fill:' + color, extra); }

  /** Mix a hex colour toward white; amount 0 keeps it, 1 is white. */
  function tint(hex, amount) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return COL.sage2;
    var a = clamp01(amount === undefined ? 0.85 : amount);
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var mix = function (c) { return Math.round(c + (255 - c) * a); };
    var hx = function (c) { var s = mix(c).toString(16); return s.length < 2 ? '0' + s : s; };
    return '#' + hx(r) + hx(g) + hx(b);
  }

  /* ---------------------------------------------------------- date helpers */

  /** ISO string, Date or epoch ms -> UTC ms at midnight. NaN when unusable. */
  function toTime(v) {
    if (v instanceof Date) { var t = v.getTime(); return isFinite(t) ? t : NaN; }
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string' || !v) return NaN;
    var m = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var parsed = Date.parse(v);
    return isFinite(parsed) ? parsed : NaN;
  }

  /** '30 Sep' from an epoch ms (UTC). */
  function shortFromTime(t) {
    if (!isFinite(t)) return '\u2014';
    var d = new Date(t);
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  }

  /** '30 Sep 2027' from an epoch ms (UTC). */
  function fullFromTime(t) {
    if (!isFinite(t)) return '\u2014';
    var d = new Date(t);
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  /** Money in millions, tolerant of the missing formatter. */
  function usd(v, bare) {
    var n = safe(v, NaN);
    if (!isFinite(n)) return '\u2014';
    if (HR.usd) { try { return HR.usd(n, { bare: !!bare }); } catch (e) { /* fall through */ } }
    return (bare ? '' : 'USD ') + HR.round(n, 0) + 'm';
  }

  /** Percentage from a 0..1 fraction. */
  function pct1(v, dp) {
    var n = safe(v, NaN);
    if (!isFinite(n)) return '\u2014';
    if (HR.pct) { try { return HR.pct(n, dp); } catch (e) { /* fall through */ } }
    return (n * 100).toFixed(dp === undefined ? 0 : dp) + '%';
  }

  /** Percentage from an already scaled 0..100 value. */
  function pct100(v, dp) {
    var n = safe(v, NaN);
    if (!isFinite(n)) return '\u2014';
    if (HR.pctRaw) { try { return HR.pctRaw(n, dp); } catch (e) { /* fall through */ } }
    return n.toFixed(dp === undefined ? 0 : dp) + '%';
  }

  function truncate(str, maxChars) {
    var s = String(str === undefined || str === null ? '' : str);
    var max = Math.max(2, Math.floor(safe(maxChars, 12)));
    return s.length <= max ? s : s.slice(0, max - 1) + '\u2026';
  }

  /** Split a long label into at most two lines on the middle space. */
  function wrapLabel(str, maxChars) {
    var s = String(str === undefined || str === null ? '' : str).trim();
    var max = Math.max(4, Math.floor(safe(maxChars, 14)));
    if (s.length <= max || s.indexOf(' ') < 0) return [s];
    var words = s.split(/\s+/);
    if (words.length < 2) return [s];
    var best = 1, bestDiff = Infinity;
    for (var i = 1; i < words.length; i++) {
      var left = words.slice(0, i).join(' ').length;
      var right = words.slice(i).join(' ').length;
      var diff = Math.abs(left - right);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  /* --------------------------------------------------------- scale helpers */

  /** Linear scale with a safe span; .invert() for hit testing. */
  function scaleLinear(d0, d1, r0, r1) {
    var a = safe(d0, 0), b = safe(d1, 1), c = safe(r0, 0), d = safe(r1, 1);
    var span = b - a;
    if (!isFinite(span) || Math.abs(span) < 1e-9) span = 1;
    var f = function (v) { return c + (safe(v, a) - a) / span * (d - c); };
    f.invert = function (px) { return a + (safe(px, c) - c) / ((d - c) || 1) * span; };
    f.domain = [a, b];
    f.range = [c, d];
    return f;
  }

  /** A 1/2/2.5/5/10 step that covers span in about `count` slices. */
  function niceStep(span, count) {
    var s = Math.abs(safe(span, 1)), n = Math.max(1, safe(count, 5));
    if (!isFinite(s) || s <= 0) return 1;
    var raw = s / n;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    if (!isFinite(mag) || mag <= 0) mag = 1;
    var norm = raw / mag;
    var mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return mult * mag;
  }

  /** Tick values inside [lo, hi], at most 14 of them. */
  function niceTicks(lo, hi, count) {
    var a = safe(lo, 0), b = safe(hi, 1);
    if (b < a) { var t = a; a = b; b = t; }
    if (Math.abs(b - a) < 1e-12) return [a];
    var step = niceStep(b - a, count || 5);
    var start = Math.ceil(a / step - 1e-9) * step;
    var out = [];
    for (var v = start; v <= b + step * 1e-6 && out.length < 14; v += step) {
      out.push(HR.round ? HR.round(v, 6) : Math.round(v * 1e6) / 1e6);
    }
    return out;
  }

  /** Pad a value range and round it out to nice multiples. */
  function niceDomain(lo, hi, padFrac, count) {
    var a = safe(lo, 0), b = safe(hi, 1);
    if (b < a) { var t = a; a = b; b = t; }
    if (Math.abs(b - a) < 1e-9) {
      var grow = Math.abs(b) > 1e-9 ? Math.abs(b) * 0.15 : 1;
      a -= grow; b += grow;
    }
    var pad = (b - a) * safe(padFrac, 0.06);
    a -= pad; b += pad;
    var step = niceStep(b - a, count || 5);
    var na = Math.floor(a / step + 1e-9) * step;
    var nb = Math.ceil(b / step - 1e-9) * step;
    if (nb - na < step * 2) nb = na + step * 2;
    return { lo: na, hi: nb, step: step, ticks: niceTicks(na, nb, count || 5) };
  }

  /* --------------------------------------------------------- path builders */

  /** 'M x y L x y ...' through finite points; a gap restarts the path. */
  function linePath(pts) {
    var d = '', pen = false;
    for (var i = 0; i < (pts || []).length; i++) {
      var p = pts[i];
      if (!p) { pen = false; continue; }
      var x = safe(p.x, NaN), y = safe(p.y, NaN);
      if (!isFinite(x) || !isFinite(y)) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + r2(x) + ' ' + r2(y) + ' ';
      pen = true;
    }
    return d.replace(/\s+$/, '');
  }

  /** Closed band: top edge left-to-right, bottom edge right-to-left. */
  function areaPath(top, bottom) {
    var up = [], down = [];
    var n = Math.min((top || []).length, (bottom || []).length);
    for (var i = 0; i < n; i++) {
      var tx = safe(top[i] && top[i].x, NaN), ty = safe(top[i] && top[i].y, NaN);
      var bx = safe(bottom[i] && bottom[i].x, NaN), by = safe(bottom[i] && bottom[i].y, NaN);
      if (!isFinite(tx) || !isFinite(ty) || !isFinite(bx) || !isFinite(by)) continue;
      up.push({ x: tx, y: ty });
      down.push({ x: bx, y: by });
    }
    if (up.length < 2) return '';
    down.reverse();
    return linePath(up) + ' ' + linePath(down).replace(/^M/, 'L') + ' Z';
  }

  function roundRectPath(x, y, w, h, r) {
    var X = safe(x, 0), Y = safe(y, 0);
    var W = Math.max(0, safe(w, 0)), H = Math.max(0, safe(h, 0));
    var R = Math.max(0, Math.min(safe(r, 0), Math.min(W, H) / 2));
    if (W <= 0 || H <= 0) return '';
    return 'M' + r2(X + R) + ' ' + r2(Y) +
      'H' + r2(X + W - R) + 'A' + r2(R) + ' ' + r2(R) + ' 0 0 1 ' + r2(X + W) + ' ' + r2(Y + R) +
      'V' + r2(Y + H - R) + 'A' + r2(R) + ' ' + r2(R) + ' 0 0 1 ' + r2(X + W - R) + ' ' + r2(Y + H) +
      'H' + r2(X + R) + 'A' + r2(R) + ' ' + r2(R) + ' 0 0 1 ' + r2(X) + ' ' + r2(Y + H - R) +
      'V' + r2(Y + R) + 'A' + r2(R) + ' ' + r2(R) + ' 0 0 1 ' + r2(X + R) + ' ' + r2(Y) + 'Z';
  }

  function roundRect(x, y, w, h, r, attrs) {
    var a = { d: roundRectPath(x, y, w, h, r) };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return HR.svg('path', a);
  }

  /* ------------------------------------------------------- element helpers */

  /**
   * Text node. `fill` goes into the inline style on purpose: the stylesheet
   * rule `.chart text { fill: var(--muted) }` outranks a presentation
   * attribute, so an attribute colour would silently lose.
   */
  function txt(x, y, str, cls, fill, anchor, extra) {
    var a = {
      x: r2(x), y: r2(y),
      class: cls || 'ax-label',
      style: fill ? fillOf(fill) : null
    };
    if (anchor) a['text-anchor'] = anchor;
    if (extra) Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined && extra[k] !== null) a[k] = extra[k]; });
    return HR.svg('text', a, String(str === undefined || str === null ? '' : str));
  }

  /** Pill with centred text; `align` 'end' pins the right edge to x. */
  function chip(x, cy, label, opts) {
    opts = opts || {};
    var text = String(label === undefined || label === null ? '' : label);
    var fs = safe(opts.fontSize, 10.5);
    var w = Math.max(safe(opts.minWidth, 26), text.length * fs * 0.58 + safe(opts.padX, 16));
    var h = safe(opts.height, 16);
    var left = opts.align === 'end' ? safe(x, 0) - w : safe(x, 0);
    var top = safe(cy, 0) - h / 2;
    if (w <= 0 || h <= 0) return HR.svg('g', null, null);
    return HR.svg('g', { class: opts.class || 'chip' }, [
      roundRect(left, top, w, h, h / 2, {
        style: fillOf(opts.fill || COL.pine, opts.stroke ? 'stroke:' + opts.stroke : 'stroke:none')
      }),
      txt(left + w / 2, cy, text, opts.textClass || 'pt-label', opts.color || COL.white, 'middle', { dy: '0.34em' })
    ]);
  }

  /** Invisible, generously sized hover target. */
  function hitRect(x, y, w, h, html, extra) {
    var a = {
      x: r2(x), y: r2(y), width: r2(Math.max(0, w)), height: r2(Math.max(0, h)),
      class: 'hit', 'pointer-events': 'all', style: 'fill:transparent;stroke:none'
    };
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    return withTip(HR.svg('rect', a), html);
  }

  /**
   * A dot that survives `.chart .hit:hover circle.dot { r: 8 }`: for radii
   * above that we pin the radius with an inline style so hovering a large
   * weather-map dot cannot shrink it.
   */
  function dotCircle(cx, cy, r, attrs) {
    var a = { cx: r2(cx), cy: r2(cy), r: r2(r), class: (attrs && attrs.class) || 'dot' };
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k !== 'class') a[k] = attrs[k]; });
    if (safe(r, 0) > 8) a.style = S(a.style, 'r:' + r2(r) + 'px');
    return HR.svg('circle', a);
  }

  /* --------------------------------------------------------------- tooltip */

  function tipShow(html, x, y) {
    try {
      if (HR.tip && HR.tip.show) HR.tip.show(html, safe(x, 0), safe(y, 0));
    } catch (e) { /* tooltip is decoration — never break the chart */ }
  }
  function tipHide() {
    try { if (HR.tip && HR.tip.hide) HR.tip.hide(); } catch (e) { /* ignore */ }
  }

  /** Title plus aligned rows: tipHTML('30 Sep', [['Median', 'USD 664m']]). */
  function tipHTML(title, rows) {
    var esc = HR.esc || function (s) { return String(s); };
    var out = '<b>' + esc(title) + '</b>';
    for (var i = 0; i < (rows || []).length; i++) {
      var row = rows[i];
      if (!row || row[0] === undefined) continue;
      out += '<div class="r"><span>' + esc(row[0]) + '</span><span>' + esc(row[1]) + '</span></div>';
    }
    return out;
  }

  /** Attach a tooltip; html may be a string or a function of the event. */
  function withTip(node, html) {
    if (!node || !node.addEventListener) return node;
    var render = function (ev) {
      var out = (typeof html === 'function') ? html(ev) : html;
      tipShow(out, ev && ev.clientX, ev && ev.clientY);
    };
    node.addEventListener('mousemove', render);
    node.addEventListener('mouseleave', tipHide);
    return node;
  }

  /** Tooltip for keyboard focus, positioned from the element box. */
  function focusTip(node, html) {
    try {
      var box = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      var out = (typeof html === 'function') ? html(null) : html;
      if (box) tipShow(out, (safe(box.left, 0) + safe(box.right, 0)) / 2, safe(box.top, 0));
      else tipShow(out, 0, 0);
    } catch (e) { /* ignore */ }
  }

  /* ----------------------------------------------------------- svg scratch */

  /** Root element with the house attributes and an accessible title. */
  function svgRoot(w, h, title, extraClass) {
    var W = Math.max(1, r2(safe(w, 600)));
    var H = Math.max(1, r2(safe(h, 200)));
    var root = HR.svg('svg', {
      class: 'chart' + (extraClass ? ' ' + extraClass : ''),
      viewBox: '0 0 ' + W + ' ' + H,
      width: '100%',
      height: H,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      /* height:auto lets the viewBox drive the box so it stays responsive. */
      style: 'height:auto'
    });
    root.appendChild(HR.svg('title', null, String(title || 'Chart')));
    return root;
  }

  function emptySvg(w, h, title, extraClass) { return svgRoot(w, h, title, extraClass); }

  /** Array guard. */
  function arr(a) { return Array.isArray(a) ? a : []; }

  /**
   * Normalise a dated series. `pairs` maps source keys to output keys, e.g.
   * [['value','v']] or [['lo','lo'], ['hi','hi']]. Rows with an unusable date
   * are dropped; a row is dropped too when a key listed in `required` is not
   * finite. This is the one place where raw spec data is allowed in — after
   * this every record is NaN-free.
   */
  function normSeries(list, pairs, required) {
    var out = [];
    arr(list).forEach(function (row) {
      if (!row) return;
      var t = toTime(row.date);
      if (!isFinite(t)) return;
      var rec = { t: t }, ok = true;
      (pairs || []).forEach(function (pair) {
        var v = safe(row[pair[0]], NaN);
        rec[pair[1]] = v;
        if (required && required.indexOf(pair[1]) >= 0 && !isFinite(v)) ok = false;
      });
      if (ok) out.push(rec);
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  /** Nearest entry (by .t) to a timestamp, from an ascending list. */
  function nearest(list, t) {
    if (!list || !list.length) return null;
    var best = list[0], bestD = Math.abs(safe(list[0].t, 0) - safe(t, 0));
    for (var i = 1; i < list.length; i++) {
      var d = Math.abs(safe(list[i].t, 0) - safe(t, 0));
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  }

  /** Pick a day step whose tick labels cannot collide at this width. */
  function dayStep(t0, t1, pxW, wanted, minGapPx) {
    var span = safe(t1, 0) - safe(t0, 0);
    if (!isFinite(span) || span <= 0) return Math.max(1, safe(wanted, 14));
    var step = Math.max(1, safe(wanted, 14));
    for (var guard = 0; guard < 10; guard++) {
      var n = Math.floor(span / (step * DAY));
      var gap = n > 0 ? (safe(pxW, 100) / n) : safe(pxW, 100);
      if (gap >= safe(minGapPx, 46) || step > 4096) break;
      step = Math.round(step * 2);
    }
    return step;
  }

  /* ==========================================================================
     fanChart — exposure runway
     Geometry: a padded linear x axis from `start` to `end` (left gutter for
     USD ticks, bottom gutter for dated ticks). The 10th–90th percentile band
     is drawn as one closed path (top edge left-to-right, bottom edge back),
     filled only. The median rides on top as a stroked path. The credit limit
     is a horizontal dashed rule with a pine chip; the breach date is a dotted
     vertical with a marker dot; `today` anchors the "as of" line; an amber
     wash from eight weeks out to the right edge marks the wider range. One
     invisible rect per median point carries the hover tooltip.
     ========================================================================== */
  function fanChart(spec) {
    spec = spec || {};
    var W = Math.max(220, safe(spec.width, 640));
    var H = Math.max(140, safe(spec.height, 280));
    var TITLE = 'Exposure runway: median projection, 10th to 90th percentile range, and the credit limit';

    var medianRaw = arr(spec.median);
    if (!medianRaw.length) return emptySvg(W, H, TITLE, 'fan-chart');

    var pts = normSeries(medianRaw, [['value', 'v']], ['v']);
    if (!pts.length) return emptySvg(W, H, TITLE, 'fan-chart');

    var bandPts = normSeries(spec.band, [['lo', 'lo'], ['hi', 'hi']]);
    var straightPts = normSeries(spec.straightLine, [['value', 'v']], ['v']);

    /* ---- domain ---------------------------------------------------------- */
    var t0 = toTime(spec.start), t1 = toTime(spec.end);
    if (!isFinite(t0)) t0 = pts[0].t;
    if (!isFinite(t1)) t1 = pts[pts.length - 1].t;
    if (!(t1 > t0)) t1 = t0 + 90 * DAY;

    var limit = safe(spec.limit, NaN);
    var peakValue = safe(spec.peakValue, NaN);
    var breachValue = safe(spec.breachValue, NaN);

    var lo = Infinity, hi = -Infinity;
    var consider = function (v) { if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } };
    pts.forEach(function (d) { consider(d.v); });
    bandPts.forEach(function (d) { consider(d.lo); consider(d.hi); });
    straightPts.forEach(function (d) { consider(d.v); });
    consider(limit); consider(peakValue); consider(breachValue);
    if (!isFinite(lo) || !isFinite(hi)) return emptySvg(W, H, TITLE, 'fan-chart');
    var dom = niceDomain(lo, hi, 0.08, 5);

    /* ---- layout ---------------------------------------------------------- */
    var padL = 58, padR = 20, padT = 30, padB = 34;
    var x1 = Math.max(padL + 20, W - padR), y0 = padT, y1 = Math.max(padT + 20, H - padB);
    var plotW = x1 - padL, plotH = y1 - y0;
    var X = scaleLinear(t0, t1, padL, x1);
    var Y = scaleLinear(dom.lo, dom.hi, y1, y0);

    var root = svgRoot(W, H, TITLE, 'fan-chart');
    var layers = [];

    /* ---- wider-range wash (rare tail of the distribution) ---------------- */
    var todayT = toTime(spec.today);
    var wideFrom = isFinite(todayT) ? todayT + 56 * DAY : t0 + (t1 - t0) * 0.62;
    var wx0 = clampi(X(wideFrom), padL, x1);
    if (x1 - wx0 > 2) {
      layers.push(HR.svg('rect', {
        x: r2(wx0), y: r2(y0), width: r2(x1 - wx0), height: r2(plotH),
        class: 'shade-region', style: S(fillOf('#EAF2EC'), 'fill-opacity:0.85')
      }));
      if (x1 - wx0 > 54) {
        layers.push(txt((wx0 + x1) / 2, y1 - 8, 'wider range', 'annotation', COL.grey, 'middle'));
      }
    }

    /* ---- y gridlines and ticks ------------------------------------------ */
    var ticks = dom.ticks;
    for (var yi = 0; yi < ticks.length; yi++) {
      var ty = Y(ticks[yi]);
      if (!isFinite(ty)) continue;
      layers.push(HR.svg('line', {
        x1: r2(padL), y1: r2(ty), x2: r2(x1), y2: r2(ty), class: 'grid-line'
      }));
      layers.push(txt(padL - 8, ty, usd(ticks[yi], true), 'ax-label', COL.muted, 'end', { dy: '0.34em' }));
    }
    var yTitle = (spec.yLabel && spec.yLabel.y) ? String(spec.yLabel.y) : 'USD m';
    layers.push(txt(4, y0 - 12, yTitle, 'annotation-strong', COL.pine2, 'start'));

    /* ---- x axis ---------------------------------------------------------- */
    layers.push(HR.svg('line', { x1: r2(padL), y1: r2(y1), x2: r2(x1), y2: r2(y1), class: 'ax-line' }));
    var step = dayStep(t0, t1, plotW, safe(spec.xTickEvery, 14), 48);
    var totalDays = Math.max(1, Math.round((t1 - t0) / DAY));
    for (var d = 0; d <= totalDays; d += step) {
      var tt = t0 + d * DAY;
      var tx = X(tt);
      if (!isFinite(tx) || tx < padL - 0.5 || tx > x1 + 0.5) continue;
      layers.push(HR.svg('line', { x1: r2(tx), y1: r2(y1), x2: r2(tx), y2: r2(y1 + 4), class: 'ax-line' }));
      layers.push(txt(tx, y1 + 15, shortFromTime(tt), 'ax-label', COL.muted, 'middle'));
    }

    /* ---- fan band (fill only, never stroked) ----------------------------- */
    /* Top and bottom always advance together, so areaPath pairs them 1:1. */
    var bandTop = [], bandBottom = [];
    for (var bi = 0; bi < bandPts.length; bi++) {
      var bd = bandPts[bi];
      var bx = X(bd.t);
      if (!isFinite(bx) || !isFinite(bd.lo) || !isFinite(bd.hi)) continue;
      bandTop.push({ x: bx, y: Y(bd.hi) });
      bandBottom.push({ x: bx, y: Y(bd.lo) });
    }
    var bandD = areaPath(bandTop, bandBottom);
    if (bandD) {
      layers.push(HR.svg('path', {
        d: bandD, class: 'fan-band',
        style: S(fillOf('#D3EDD8'), 'fill-opacity:0.95')
      }));
      /* A thin median-of-band edge makes the range readable without stroking. */
      layers.push(HR.svg('path', {
        d: linePath(bandTop), class: 'fan-band',
        style: S('fill:none', 'stroke:' + COL.ridge, 'stroke-width:1', 'stroke-opacity:0.45')
      }));
    }

    /* ---- straight-line comparison --------------------------------------- */
    if (straightPts.length > 1) {
      var sd = linePath(straightPts.map(function (p2) { return { x: X(p2.t), y: Y(p2.v) }; }));
      if (sd) {
        layers.push(HR.svg('path', {
          d: sd, class: 'series-line',
          style: S('stroke:' + COL.grey, 'stroke-width:1.5', 'stroke-dasharray:5 4'),
          'stroke-linejoin': 'round'
        }));
      }
    }

    /* ---- "as of" line ---------------------------------------------------- */
    if (isFinite(todayT)) {
      var ttx = clampi(X(todayT), padL, x1);
      layers.push(HR.svg('line', {
        x1: r2(ttx), y1: r2(y0), x2: r2(ttx), y2: r2(y1),
        style: S('stroke:' + COL.grey, 'stroke-width:1')
      }));
      layers.push(txt(clampi(ttx + 5, padL, x1 - 2), y0 - 12, 'as of ' + shortFromTime(todayT),
        'annotation', COL.muted, 'start'));
    }

    /* ---- breach marker --------------------------------------------------- */
    var breachT = toTime(spec.breachDate);
    if (isFinite(breachT)) {
      var brx = clampi(X(breachT), padL, x1);
      layers.push(HR.svg('line', {
        x1: r2(brx), y1: r2(y0), x2: r2(brx), y2: r2(y1),
        style: S('stroke:' + COL.amber, 'stroke-width:1.6', 'stroke-dasharray:1.5 3.5', 'stroke-linecap:round')
      }));
      var blabel = 'Likely first breach ' + shortFromTime(breachT);
      var banchor = brx > (padL + x1) / 2 ? 'end' : 'start';
      layers.push(txt(brx + (banchor === 'end' ? -6 : 6), y0 + 11, blabel,
        'annotation-strong', COL.amberD, banchor));
      if (isFinite(breachValue)) {
        layers.push(dotCircle(brx, Y(breachValue), 4.2, {
          style: S(fillOf(COL.amber), 'stroke:' + COL.white, 'stroke-width:1.6')
        }));
      }
    }

    /* ---- credit-limit rule with its chip --------------------------------- */
    if (isFinite(limit)) {
      var ly = Y(limit);
      layers.push(HR.svg('line', {
        x1: r2(padL), y1: r2(ly), x2: r2(x1), y2: r2(ly), class: 'series-line',
        style: S('stroke:' + COL.pine2, 'stroke-width:1.4', 'stroke-dasharray:6 4')
      }));
      layers.push(chip(x1 - 4, ly, 'Limit ' + usd(limit), {
        align: 'end', fill: COL.pine, color: COL.white, fontSize: 10.5, height: 17
      }));
    }

    /* ---- median line ----------------------------------------------------- */
    var md = linePath(pts.map(function (p3) { return { x: X(p3.t), y: Y(p3.v) }; }));
    if (md) {
      layers.push(HR.svg('path', {
        d: md, class: 'series-line',
        style: S('stroke:' + COL.pine, 'stroke-width:2.4'),
        'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
    }

    /* ---- peak marker ----------------------------------------------------- */
    var peakT = toTime(spec.peakDate);
    if (isFinite(peakT)) {
      var px = clampi(X(peakT), padL, x1);
      var py = isFinite(peakValue) ? Y(peakValue) : Y(hi);
      layers.push(dotCircle(px, py, 4, {
        style: S(fillOf(COL.pine), 'stroke:' + COL.white, 'stroke-width:1.6')
      }));
      var plabel = isFinite(peakValue) ? 'Peak ' + usd(peakValue) : 'Peak';
      var panchor = px > (padL + x1) / 2 ? 'end' : 'start';
      layers.push(txt(clampi(px + (panchor === 'end' ? -8 : 8), padL + 2, x1 - 2),
        Math.max(y0 + 12, py - 9), plabel, 'annotation-strong', COL.pine, panchor));
    }

    /* ---- hover bands ----------------------------------------------------- */
    for (var hi2 = 0; hi2 < pts.length; hi2++) {
      var here = pts[hi2];
      var prevT = hi2 > 0 ? (pts[hi2 - 1].t + here.t) / 2 : here.t - (pts.length > 1 ? (pts[1].t - here.t) / 2 : DAY / 2);
      var nextT = hi2 < pts.length - 1 ? (here.t + pts[hi2 + 1].t) / 2 : here.t + (pts.length > 1 ? (here.t - pts[hi2 - 1].t) / 2 : DAY / 2);
      var hx0 = clampi(X(prevT), padL, x1), hx1 = clampi(X(nextT), padL, x1);
      if (hx1 - hx0 <= 0.5) continue;
      var band = (bandPts.length === pts.length) ? bandPts[hi2] : nearest(bandPts, here.t);
      var rows = [['Median', usd(here.v)]];
      if (band && isFinite(safe(band.lo, NaN)) && isFinite(safe(band.hi, NaN))) {
        rows.push(['10th\u201390th', usd(band.lo) + ' \u2013 ' + usd(band.hi)]);
      }
      if (isFinite(limit)) rows.push(['Limit', usd(limit)]);
      var html = tipHTML(fullFromTime(here.t), rows);
      layers.push(hitRect(hx0, y0, hx1 - hx0, plotH, html));
    }

    layers.forEach(function (n) { if (n) root.appendChild(n); });
    return root;
  }

  /* ==========================================================================
     radar — spider with 0 at the centre and 1 at the outer ring.
     Geometry: n axes evenly spaced from straight up, clockwise. Five
     concentric polygons at 1/5..5/5 of the radius. The 90-day-ago shape is
     mint, today's is amber with filled vertices; each axis gets a status dot
     just inside its label. Labels wrap to two lines and are anchored by the
     sign of cos(angle) so they never sit on top of the rings.
     ========================================================================== */
  function radar(spec) {
    spec = spec || {};
    var W = Math.max(240, safe(spec.width, 440));
    var H = Math.max(200, safe(spec.height, 340));
    var TITLE = 'Risk shape: today against 90 days ago, measured from the centre outwards';
    var axes = arr(spec.axes).filter(function (a) { return a && (a.label || a.key); });
    if (!axes.length) return emptySvg(W, H, TITLE, 'radar-chart');

    var n = axes.length;
    var padT = 34, padB = 46, padSide = 84;
    var R = Math.max(30, Math.min((W - padSide * 2) / 2, (H - padT - padB) / 2));
    var cx = W / 2, cy = padT + (H - padT - padB) / 2;

    var pos = function (i, frac) {
      var ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var rr = R * clamp01(frac);
      return { x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr, cos: Math.cos(ang), sin: Math.sin(ang) };
    };

    var root = svgRoot(W, H, TITLE, 'radar-chart');
    var g = [];

    /* ---- rings ----------------------------------------------------------- */
    var ringPts = function (frac) {
      var out = [];
      for (var i = 0; i < n; i++) { var p = pos(i, frac); out.push(r2(p.x) + ',' + r2(p.y)); }
      return out.join(' ');
    };
    g.push(HR.svg('polygon', {
      points: ringPts(1), class: 'grid-line',
      style: S(fillOf(COL.sage2), 'fill-opacity:0.55')
    }));
    for (var ring = 1; ring <= 5; ring++) {
      g.push(HR.svg('polygon', {
        points: ringPts(ring / 5), class: 'grid-line', style: 'fill:none'
      }));
    }

    /* ---- spokes ---------------------------------------------------------- */
    for (var i2 = 0; i2 < n; i2++) {
      var sp = pos(i2, 1);
      g.push(HR.svg('line', {
        x1: r2(cx), y1: r2(cy), x2: r2(sp.x), y2: r2(sp.y), class: 'ax-line'
      }));
    }

    /* ---- previous shape, then today's ------------------------------------ */
    var ringFrom = function (key) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var p = pos(i, clamp01(safe(axes[i][key], 0)));
        out.push(r2(p.x) + ',' + r2(p.y));
      }
      return out.join(' ');
    };
    if (axes.some(function (a) { return a.previous !== undefined && a.previous !== null; })) {
      g.push(HR.svg('polygon', {
        points: ringFrom('previous'), class: 'series-line',
        style: S(fillOf(COL.mint), 'fill-opacity:0.3', 'stroke:' + COL.mint, 'stroke-width:1.2')
      }));
    }
    g.push(HR.svg('polygon', {
      points: ringFrom('value'), class: 'series-line',
      style: S(fillOf(COL.amber), 'fill-opacity:0.16', 'stroke:' + COL.amber, 'stroke-width:2')
    }));
    for (var v = 0; v < n; v++) {
      var vp = pos(v, clamp01(safe(axes[v].value, 0)));
      g.push(dotCircle(vp.x, vp.y, 3.6, {
        style: S(fillOf(COL.amber), 'stroke:' + COL.white, 'stroke-width:1.5')
      }));
    }

    /* ---- axis labels and status dots ------------------------------------- */
    var statusColor = function (st) {
      var s = String(st || 'Normal');
      if (s === 'Alert') return COL.amber;
      if (s === 'Watch') return '#E8B44A';
      return COL.zClear;
    };
    for (var a2 = 0; a2 < n; a2++) {
      var ax = axes[a2];
      var dir = pos(a2, 1);
      var lx = cx + dir.cos * (R + 18);
      var ly = cy + dir.sin * (R + 18);
      var anchor = Math.abs(dir.cos) < 0.25 ? 'middle' : (dir.cos > 0 ? 'start' : 'end');
      var lines = wrapLabel(ax.label || ax.key, 15);
      /* a second line grows away from the rings, so it cannot land on the
         status dot that sits just outside the outer ring */
      var grow = lines.length > 1 ? (dir.sin < 0 ? -12 : 0) : 0;
      var lineY = ly + grow + 3;
      for (var li = 0; li < lines.length; li++) {
        g.push(txt(clampi(lx, 4, W - 4), lineY + li * 12, lines[li],
          'ax-label', COL.ink, anchor, { dy: '0.34em' }));
      }
      var dotPos = pos(a2, 1);
      var sdot = HR.svg('circle', {
        cx: r2(cx + dotPos.cos * (R + 7)),
        cy: r2(cy + dotPos.sin * (R + 7)),
        r: 3.2, class: 'status-dot',
        style: S(fillOf(statusColor(ax.status)), 'stroke:' + COL.white, 'stroke-width:1')
      }, HR.svg('title', null, (ax.label || ax.key) + ': ' + pct1(ax.value) + ' (' + (ax.status || 'Normal') + ')'));
      g.push(sdot);
    }

    /* ---- centre label and caption ---------------------------------------- */
    var centreLabel = spec.centreLabel ? String(spec.centreLabel) : '';
    if (centreLabel) {
      g.push(txt(cx, cy, truncate(centreLabel, 22), 'annotation-strong', COL.pine2, 'middle', { dy: '0.34em' }));
    }
    g.push(txt(W / 2, H - 8,
      'Amber = today \u00b7 Mint = 90 days ago \u00b7 closer to the centre is more normal',
      'annotation', COL.muted, 'middle'));

    g.forEach(function (node) { if (node) root.appendChild(node); });
    return root;
  }

  /* ==========================================================================
     calibration — predicted against observed, square plot.
     Geometry: both axes run 0..axisMax on a square side (the axis rounds up
     to the next 20% above the largest band). The identity line is the 45°
     diagonal; dot area scales with the customer-month weight.
     ========================================================================== */
  function calibration(spec) {
    spec = spec || {};
    var W = Math.max(240, safe(spec.width, 420));
    var H = Math.max(220, safe(spec.height, 380));
    var TITLE = 'Calibration: predicted chance of worsening against the observed share';
    var bands = arr(spec.bands).filter(function (b) { return b && isFinite(safe(b.predicted, NaN)); });
    if (!bands.length) return emptySvg(W, H, TITLE, 'calibration-chart');

    var maxV = 0.2;
    bands.forEach(function (b) {
      maxV = Math.max(maxV, safe(b.predicted, 0), safe(b.observed, 0));
    });
    var axisMax = Math.max(0.2, Math.ceil(maxV / 0.2 - 1e-9) * 0.2);

    var padL = 54, padR = 18, padT = 20, padB = 48;
    var side = Math.min(W - padL - padR, H - padT - padB);
    if (!(side > 40)) return emptySvg(W, H, TITLE, 'calibration-chart');

    /* keep the square plot centred in a wide card */
    var x0 = padL + Math.max(0, (W - padL - padR - side) / 2), y1 = padT + side;
    var X = scaleLinear(0, axisMax, x0, x0 + side);
    var Y = scaleLinear(0, axisMax, y1, padT);

    var root = svgRoot(W, H, TITLE, 'calibration-chart');
    var g = [];

    /* ---- grid and ticks -------------------------------------------------- */
    var steps = Math.round(axisMax / 0.2);
    for (var i = 0; i <= steps; i++) {
      var f = i * 0.2;
      var gx = X(f), gy = Y(f);
      g.push(HR.svg('line', { x1: r2(x0), y1: r2(gy), x2: r2(x0 + side), y2: r2(gy), class: 'grid-line' }));
      g.push(HR.svg('line', { x1: r2(gx), y1: r2(padT), x2: r2(gx), y2: r2(y1), class: 'grid-line' }));
      g.push(txt(gx, y1 + 14, pct1(f), 'ax-label', COL.muted, 'middle'));
      g.push(txt(x0 - 8, gy, pct1(f), 'ax-label', COL.muted, 'end', { dy: '0.34em' }));
    }
    g.push(HR.svg('line', { x1: r2(x0), y1: r2(padT), x2: r2(x0), y2: r2(y1), class: 'ax-line' }));
    g.push(HR.svg('line', { x1: r2(x0), y1: r2(y1), x2: r2(x0 + side), y2: r2(y1), class: 'ax-line' }));

    /* ---- identity line --------------------------------------------------- */
    g.push(HR.svg('line', {
      x1: r2(X(0)), y1: r2(Y(0)), x2: r2(X(axisMax)), y2: r2(Y(axisMax)), class: 'series-line',
      style: S('stroke:' + COL.pine3, 'stroke-width:1.4', 'stroke-dasharray:5 4')
    }));
    var midX = (X(0) + X(axisMax)) / 2, midY = (Y(0) + Y(axisMax)) / 2;
    var idLabel = spec.identityLabel ? String(spec.identityLabel) : 'Dashed line: perfect honesty';
    /* lifted clear of the diagonal (dy shifts along the rotated y axis) so it
       cannot be mistaken for a data mark */
    g.push(txt(midX - 12, midY - 12, idLabel, 'annotation', COL.pine3, 'middle',
      { dy: '-0.5em', transform: 'rotate(-45 ' + r2(midX - 12) + ' ' + r2(midY - 12) + ')' }));

    /* ---- dots ------------------------------------------------------------ */
    bands.forEach(function (b) {
      var px = X(clamp01(safe(b.predicted, 0)));
      var py = Y(clamp01(safe(b.observed, 0)));
      var weight = safe(b.weight, 0);
      var radius = clampi(Math.sqrt(Math.max(1, weight)) * 0.55, 3.5, 16);
      var html = tipHTML('Band ' + pct1(b.predicted) + ' predicted', [
        ['Predicted', pct1(b.predicted)],
        ['Observed', pct1(b.observed)],
        ['Customer-months', HR.n ? HR.n(weight) : String(weight)]
      ]);
      g.push(withTip(dotCircle(px, py, radius, {
        style: S(fillOf(COL.amber), 'fill-opacity:0.5', 'stroke:' + COL.amberD, 'stroke-width:0.9')
      }), html));
    });

    /* ---- axis titles ----------------------------------------------------- */
    g.push(txt((x0 + x0 + side) / 2, H - 10, 'Predicted chance of worsening',
      'ax-label', COL.muted, 'middle'));
    g.push(txt(12, padT + side / 2, 'Observed share that worsened',
      'ax-label', COL.muted, 'middle', { transform: 'rotate(-90 12 ' + r2(padT + side / 2) + ')' }));

    g.forEach(function (node) { if (node) root.appendChild(node); });
    return root;
  }

  /* ==========================================================================
     barLadder — one horizontal bar per candidate rule.
     Geometry: fixed label column on the left, a 0..xMax plot in the middle,
     a value column and a verdict pill on the right. The whisker (lo..hi with
     end caps) sits behind the bar; a dashed vertical marks the row's
     baseLine; a faint bottom scale gives the percentages context.
     ========================================================================== */
  function barLadder(spec) {
    spec = spec || {};
    var W = Math.max(280, safe(spec.width, 620));
    var H = Math.max(120, safe(spec.height, 260));
    var TITLE = 'Model ladder: each rule against the baseline, with its uncertainty range';
    var rows = arr(spec.rows).filter(function (r) { return r && (r.label !== undefined || isFinite(safe(r.pct, NaN))); });
    if (!rows.length) return emptySvg(W, H, TITLE, 'bar-ladder');

    var xMax = safe(spec.xMax, 100);
    if (!(xMax > 0)) xMax = 100;

    var showScale = H >= rows.length * 30 + 26;
    var padT = 10, padB = showScale ? 26 : 8;
    /* Reserve the widest verdict pill plus a value column, so a full-length
       bar can never run underneath either of them. */
    var maxPillW = 0;
    rows.forEach(function (r) { if (r.tag) maxPillW = Math.max(maxPillW, String(r.tag).length * 5.9 + 16); });
    var rightW = 46 + (maxPillW ? maxPillW + 10 : 0);
    var labelW = clampi(W * 0.30, 96, 240);
    var plotX0 = 8 + labelW;
    var plotX1 = W - rightW;
    if (plotX1 - plotX0 < 70) {
      labelW = clampi(W * 0.18, 60, 240);
      plotX0 = 8 + labelW;
      plotX1 = W - rightW;
    }
    var pw = Math.max(20, plotX1 - plotX0);
    var X = scaleLinear(0, xMax, plotX0, plotX0 + pw);

    var rowH = (H - padT - padB) / rows.length;
    var barH = clampi(rowH * 0.42, 8, 18);

    var root = svgRoot(W, H, TITLE, 'bar-ladder');
    var g = [];

    /* ---- bottom scale ---------------------------------------------------- */
    if (showScale) {
      var sy = H - padB + 12;
      g.push(HR.svg('line', { x1: r2(plotX0), y1: r2(H - padB + 2), x2: r2(plotX0 + pw), y2: r2(H - padB + 2), class: 'ax-line' }));
      niceTicks(0, xMax, 5).forEach(function (t) {
        var txp = X(t);
        if (txp < plotX0 - 0.5 || txp > plotX0 + pw + 0.5) return;
        g.push(txt(txp, sy, pct100(t), 'ax-label', COL.muted, 'middle', { dy: '0.34em' }));
      });
    }

    rows.forEach(function (row, i) {
      var cy = padT + rowH * i + rowH / 2;
      var pct = clampi(safe(row.pct, 0), 0, xMax);
      var loV = isFinite(safe(row.lo, NaN)) ? clampi(safe(row.lo, 0), 0, xMax) : null;
      var hiV = isFinite(safe(row.hi, NaN)) ? clampi(safe(row.hi, 0), 0, xMax) : null;

      /* label and caption */
      var maxLabelChars = Math.max(6, Math.floor((labelW - 6) / 6.2));
      g.push(txt(8, cy - 1, truncate(row.label, maxLabelChars), 'pt-label', COL.ink, 'start', { dy: '0.34em' }));
      if (row.sub) {
        g.push(txt(8, cy + 12, truncate(row.sub, maxLabelChars + 2), 'annotation', COL.muted, 'start', { dy: '0.34em' }));
      }

      /* whisker behind the bar */
      var barTop = cy - barH / 2;
      if (loV !== null && hiV !== null && hiV > loV) {
        var lox = X(loV), hix = X(hiV);
        g.push(HR.svg('line', {
          x1: r2(lox), y1: r2(cy), x2: r2(hix), y2: r2(cy),
          style: S('stroke:' + COL.pine3, 'stroke-width:1.4')
        }));
        [lox, hix].forEach(function (cxp) {
          g.push(HR.svg('line', {
            x1: r2(cxp), y1: r2(cy - barH / 2 - 3), x2: r2(cxp), y2: r2(cy + barH / 2 + 3),
            style: S('stroke:' + COL.pine3, 'stroke-width:1.4')
          }));
        });
      }

      /* per-row reference line */
      if (isFinite(safe(row.baseLine, NaN))) {
        var blx = X(clampi(safe(row.baseLine, 0), 0, xMax));
        g.push(HR.svg('line', {
          x1: r2(blx), y1: r2(barTop - 5), x2: r2(blx), y2: r2(barTop + barH + 5),
          style: S('stroke:' + COL.muted, 'stroke-width:1.2', 'stroke-dasharray:3 3')
        }));
      }

      /* the bar itself */
      var fill = row.color ? String(row.color) : (row.isBaseline ? COL.pine3 : COL.amber);
      var bw = Math.max(2, X(pct) - plotX0);
      g.push(roundRect(plotX0, barTop, bw, barH, Math.min(barH / 2, 7), {
        class: 'bar', style: S(fillOf(fill), row.isBaseline ? 'fill-opacity:0.9' : '')
      }));

      /* value column */
      var pill = row.tag ? String(row.tag) : '';
      var pillW = pill ? Math.max(30, pill.length * 5.9 + 16) : 0;
      var valueRight = pill ? Math.max(plotX0 + 30, W - pillW - 16) : W - 8;
      g.push(txt(valueRight, cy, pct100(pct), 'pt-label', COL.pine, 'end', { dy: '0.34em' }));

      /* verdict pill */
      if (pill) {
        var tagColor = row.tagColor ? String(row.tagColor) : COL.pine3;
        g.push(chip(W - 6, cy, pill, {
          align: 'end', fill: tint(tagColor, 0.84), color: tagColor,
          fontSize: 10, height: 16, minWidth: 30, padX: 14
        }));
      }

      /* row separator */
      if (i < rows.length - 1) {
        g.push(HR.svg('line', {
          x1: 8, y1: r2(padT + rowH * (i + 1)), x2: r2(W - 8), y2: r2(padT + rowH * (i + 1)),
          class: 'grid-line'
        }));
      }

      /* hover target over the whole row */
      var rowsTip = [
        ['Value', pct100(pct)],
        ['Range', (loV === null ? '\u2014' : pct100(loV)) + ' \u2013 ' + (hiV === null ? '\u2014' : pct100(hiV))]
      ];
      if (row.tag) rowsTip.push(['Verdict', pill]);
      var html = tipHTML(row.label, rowsTip);
      g.push(hitRect(0, cy - rowH / 2, W, rowH, html));
    });

    g.forEach(function (node) { if (node) root.appendChild(node); });
    return root;
  }

  /* ==========================================================================
     sparkline — tiny trend line.
     Geometry: the full box is the plot (1.5px breathing room so a 1.6px
     stroke is not clipped); the optional `band` shades the customer's own
     normal range behind the line. Null values break the line rather than
     plotting a bogus zero.
     ========================================================================== */
  function sparkline(spec) {
    spec = spec || {};
    var W = Math.max(24, safe(spec.width, 96));
    var H = Math.max(12, safe(spec.height, 26));
    var TITLE = 'Trend over the recent period';
    var values = arr(spec.values);
    if (!values.length) return emptySvg(W, H, TITLE, 'sparkline');

    var nums = [];
    values.forEach(function (v) { if (v !== null && v !== undefined && isFinite(safe(v, NaN))) nums.push(safe(v, 0)); });
    if (!nums.length) return emptySvg(W, H, TITLE, 'sparkline');

    var band = arr(spec.band);
    var lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
    if (band.length >= 2) { lo = Math.min(lo, safe(band[0], lo)); hi = Math.max(hi, safe(band[1], hi)); }
    if (hi - lo < 1e-9) { hi = lo + Math.max(1, Math.abs(lo) * 0.1); }

    var pad = 1.5;
    var X = scaleLinear(0, Math.max(1, values.length - 1), pad, W - pad);
    var Y = scaleLinear(lo, hi, H - pad, pad);
    var color = spec.color ? String(spec.color) : COL.amber;

    var root = svgRoot(W, H, TITLE, 'sparkline');
    var g = [];

    if (band.length >= 2) {
      var bLo = safe(band[0], lo), bHi = safe(band[1], hi);
      if (bHi < bLo) { var t = bLo; bLo = bHi; bHi = t; }
      var by = Y(bHi), bh = Math.max(0, Y(bLo) - Y(bHi));
      g.push(HR.svg('rect', {
        x: r2(pad), y: r2(by), width: r2(Math.max(0, W - pad * 2)), height: r2(bh),
        class: 'spark-band', style: fillOf(COL.sage, 'fill-opacity:0.75')
      }));
    }

    var pts = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v === null || v === undefined || !isFinite(safe(v, NaN))) { pts.push(null); continue; }
      pts.push({ x: X(i), y: Y(safe(v, lo)) });
    }
    var d = linePath(pts);
    if (d) {
      if (spec.fill) {
        var area = (function () {
          var clean = pts.filter(Boolean);
          if (clean.length < 2) return '';
          return linePath(clean) + ' L' + r2(clean[clean.length - 1].x) + ' ' + r2(H - pad) +
            ' L' + r2(clean[0].x) + ' ' + r2(H - pad) + ' Z';
        })();
        if (area) {
          g.push(HR.svg('path', { d: area, class: 'spark-fill', style: S(fillOf(color), 'fill-opacity:0.16') }));
        }
      }
      g.push(HR.svg('path', {
        d: d, class: 'series-line',
        style: S('stroke:' + color, 'stroke-width:1.6'),
        'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
    }

    g.forEach(function (node) { if (node) root.appendChild(node); });
    return root;
  }

  /* ==========================================================================
     stackedBar — single 100% bar.
     Geometry: one full-height bar; each segment is inset by 1px on every
     internal edge, which produces the 2px white separators. Labels only go
     inside segments wider than 90px (and only if the bar is tall enough to
     hold a line of text).
     ========================================================================== */
  function stackedBar(spec) {
    spec = spec || {};
    var W = Math.max(60, safe(spec.width, 280));
    var H = Math.max(8, safe(spec.height, 18));
    var TITLE = 'Composition of the total';
    var segs = arr(spec.segments).filter(function (s) { return s && safe(s.value, 0) > 0; });
    if (!segs.length) return emptySvg(W, H, TITLE, 'stacked-bar');

    var total = 0;
    segs.forEach(function (s) { total += safe(s.value, 0); });
    if (!(total > 0)) return emptySvg(W, H, TITLE, 'stacked-bar');

    var pad = 1;
    var bx = pad, bw = Math.max(1, W - pad * 2);
    var by = pad, bh = Math.max(1, H - pad * 2);
    var X = scaleLinear(0, total, bx, bx + bw);
    var showLabels = !!spec.showLabels && bh >= 15;

    var root = svgRoot(W, H, TITLE, 'stacked-bar');
    var acc = 0;
    segs.forEach(function (s, i) {
      var v = safe(s.value, 0);
      var sx = X(acc), ex = X(acc + v);
      acc += v;
      var left = sx + (i > 0 ? 1 : 0);
      var right = ex - (i < segs.length - 1 ? 1 : 0);
      var w = right - left;
      if (w <= 0.2) return;
      var color = s.color ? String(s.color) : COL.pine3;
      var html = tipHTML(s.label || 'Segment', [
        ['Value', usd(v)],
        ['Share', pct1(v / total, 1)]
      ]);
      var rect = HR.svg('rect', {
        x: r2(left), y: r2(by), width: r2(w), height: r2(bh), rx: r2(Math.min(4, bh / 2)),
        class: 'seg', style: fillOf(color)
      });
      root.appendChild(withTip(rect, html));
      /* a label only goes inside when the segment can actually hold it */
      var label = String(s.label || '');
      var need = label.length * 5.8 + 14;
      if (showLabels && w > 90 && w > need) {
        root.appendChild(txt(left + w / 2, by + bh / 2, label, 'pt-label', COL.white, 'middle', { dy: '0.34em' }));
      }
    });
    return root;
  }

  /* ==========================================================================
     timeline — external signals against payment behaviour.
     Geometry: one lane per row. A fixed label column on the left, then dates
     mapped linearly from `from` to `to` across the remaining width. 'dot'
     points draw a filled marker with its caption below the lane; 'line'
     points draw a vertical stem with the caption above, so the two kinds can
     share a lane without colliding.
     ========================================================================== */
  function timeline(spec) {
    spec = spec || {};
    var W = Math.max(240, safe(spec.width, 640));
    var H = Math.max(90, safe(spec.height, 220));
    var TITLE = 'Timeline of external signals against payment behaviour';
    var rows = arr(spec.rows).filter(function (r) { return r && arr(r.points).length; });
    if (!rows.length) return emptySvg(W, H, TITLE, 'timeline');

    var t0 = toTime(spec.from), t1 = toTime(spec.to);
    if (!isFinite(t0) || !isFinite(t1) || !(t1 > t0)) return emptySvg(W, H, TITLE, 'timeline');

    var padT = 16, padB = 22;
    var labelW = clampi(W * 0.26, 84, 200);
    var x0 = labelW + 8, x1 = W - 12;
    if (x1 - x0 < 60) { labelW = 40; x0 = labelW + 8; x1 = Math.max(x0 + 40, W - 8); }
    var X = scaleLinear(t0, t1, x0, x1);
    var laneH = (H - padT - padB) / rows.length;

    var root = svgRoot(W, H, TITLE, 'timeline');
    var g = [];

    rows.forEach(function (row, i) {
      var cy = padT + laneH * i + laneH / 2;
      g.push(txt(x0 - 10, cy, truncate(row.label, Math.floor((labelW - 4) / 6.2)), 'ax-label', COL.ink, 'end', { dy: '0.34em' }));
      g.push(HR.svg('line', {
        x1: r2(x0), y1: r2(cy), x2: r2(x1), y2: r2(cy), class: 'grid-line'
      }));

      /* Points are laid out in date order, and labels are pushed onto
         alternate lines when two events sit close together. Without this the
         captions overlap into an unreadable smear on a busy lane. */
      var sorted = arr(row.points).filter(Boolean).slice().sort(function (a, b) {
        return toTime(a.date) - toTime(b.date);
      });
      var lastLabelX = -Infinity, labelFlip = 0;
      sorted.forEach(function (p) {
        var t = toTime(p.date);
        if (!isFinite(t)) return;
        var px = clampi(X(t), x0, x1);
        var color = p.color ? String(p.color) : COL.pine3;
        var kind = p.kind === 'line' ? 'line' : 'dot';
        if (kind === 'line') {
          g.push(HR.svg('line', {
            x1: r2(px), y1: r2(cy - 8), x2: r2(px), y2: r2(cy + 8),
            style: S('stroke:' + color, 'stroke-width:2', 'stroke-linecap:round')
          }));
        } else {
          g.push(dotCircle(px, cy, 4, {
            style: S(fillOf(color), 'stroke:' + COL.white, 'stroke-width:1.2')
          }));
        }
        if (p.label) {
          /* A label needs roughly 6px per character. If it would collide with
             the previous one, drop it to the next line. */
          var need = Math.min(22, String(p.label).length) * 6.2;
          var collides = px - lastLabelX < need * 0.55;
          if (collides) labelFlip = (labelFlip + 1) % 2; else labelFlip = 0;
          var ly = kind === 'line' ? cy - 12 - labelFlip * 13 : cy + 14 + labelFlip * 13;
          var anchor = px > x1 - 44 ? 'end' : (px < x0 + 44 ? 'start' : 'middle');
          var lx = clampi(px, x0 + 2 + (anchor === 'middle' ? need / 2 : 0), x1 - 2 - (anchor === 'middle' ? need / 2 : 0));
          g.push(txt(lx, ly, truncate(p.label, 22), 'annotation', COL.muted, anchor));
          lastLabelX = px;
        }
      });
    });

    /* ---- lane caption dates --------------------------------------------- */
    g.push(txt(x0, H - 6, fullFromTime(t0), 'ax-label', COL.muted, 'start'));
    g.push(txt(x1, H - 6, fullFromTime(t1), 'ax-label', COL.muted, 'end'));

    g.forEach(function (node) { if (node) root.appendChild(node); });
    return root;
  }

  /* ---------------------------------------------------------------- export */

  charts.fanChart = fanChart;
  charts.radar = radar;
  charts.calibration = calibration;
  charts.barLadder = barLadder;
  charts.sparkline = sparkline;
  charts.stackedBar = stackedBar;
  charts.timeline = timeline;

})(window);
