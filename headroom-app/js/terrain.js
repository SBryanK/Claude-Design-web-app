/* ============================================================================
   Headroom — the terrain
   ----------------------------------------------------------------------------
   The portfolio, drawn as a survey sheet.

   The contour lines here are NOT decoration. They are computed: a Gaussian
   kernel-density estimate over the 120 customer groups, contoured by marching
   squares and stitched into closed loops, then stacked from the lowest level to
   the highest so the fills band themselves. Which means the shape you see is a
   real property of where the book actually sits — the mass in Clear, the thin
   ridge running up into Act now — and it moves when the data moves.

   That is the whole reason this surface can be a map instead of a scatter plot.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR = global.HR || {};
  var el = HR.el, svg = HR.svg;

  /* --------------------------------------------------------------- palette -- */

  /* Hypsometric tint, green rising with density. Deliberately neutral rather
     than a heat ramp: the densest ground is the Clear corner, so colouring
     density "hot" would say the opposite of the truth. The danger in this map
     is carried by the threshold ridge lines and by the customers themselves. */
  var LAND = [
    '#F2FAF4',   /* 0 — the outer skirt, almost the page  */
    '#E0F3E6',
    '#C8EAD3',
    '#ABDEBB',
    '#88CFA0',
    '#61BF85'    /* 5 — the summit                        */
  ];

  /* The same field after dark, for the landing page's hero. Elevation still
     rises with density; only the ground and the light source change. */
  var LAND_DARK = [
    '#0B2A1D', '#0E3625', '#13452F', '#19563A', '#226A47', '#2E8459'
  ];

  var ZONE_FILL = {
    'Act now': '#E8543A',
    'Watch':   '#F0A82A',
    'Growth':  '#35C0B4',
    'Clear':   '#8CC0A0'
  };
  var ZONE_STROKE = {
    'Act now': '#C4432B',
    'Watch':   '#C87F00',
    'Growth':  '#0E9E93',
    'Clear':   '#6FBF8B'
  };

  /* ------------------------------------------------------------------ math -- */

  function r2(v) { return Math.round(v * 100) / 100; }

  /**
   * Gaussian kernel-density estimate on a regular grid.
   * `pts` are {x, y, w} in 0..1 space; `w` weights a point (we use exposure, so
   * the terrain shows where the MONEY sits, not merely where the accounts are —
   * a book of 120 small customers should not out-shout three large ones).
   */
  function kde(pts, gw, gh, bandwidth) {
    var grid = new Float64Array(gw * gh);
    var inv2h2 = 1 / (2 * bandwidth * bandwidth);
    var norm = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
    var maxW = 0;
    for (var i = 0; i < pts.length; i++) if (pts[i].w > maxW) maxW = pts[i].w;
    if (maxW <= 0) maxW = 1;

    for (var p = 0; p < pts.length; p++) {
      var pt = pts[p];
      var w = (pt.w / maxW);
      /* Weight is compressed with a square root so one enormous customer does
         not flatten everyone else into a single dot. */
      w = Math.sqrt(w);
      var gx = pt.x * (gw - 1), gy = pt.y * (gh - 1);
      var reach = Math.ceil(bandwidth * 3 * gw);
      var x0 = Math.max(0, Math.floor(gx - reach)), x1 = Math.min(gw - 1, Math.ceil(gx + reach));
      var y0 = Math.max(0, Math.floor(gy - reach)), y1 = Math.min(gh - 1, Math.ceil(gy + reach));
      for (var yy = y0; yy <= y1; yy++) {
        var dy = (yy - gy) / (gw - 1);
        for (var xx = x0; xx <= x1; xx++) {
          var dx = (xx - gx) / (gw - 1);
          var d2 = dx * dx + dy * dy;
          if (d2 * inv2h2 > 12) continue;
          grid[yy * gw + xx] += w * norm * Math.exp(-d2 * inv2h2);
        }
      }
    }
    /* Normalise to 0..1 so contour levels are dataset-independent. */
    var max = 0;
    for (var k = 0; k < grid.length; k++) if (grid[k] > max) max = grid[k];
    if (max > 0) for (var m = 0; m < grid.length; m++) grid[m] /= max;
    return grid;
  }

  /**
   * Marching squares. Returns the line segments where the field crosses `level`.
   * Linear interpolation along each edge keeps the lines smooth rather than
   * stair-stepped.
   */
  function marchingSquares(grid, gw, gh, level) {
    var segs = [];
    function at(x, y) { return grid[y * gw + x]; }
    function ip(a, b, va, vb) { var t = (level - va) / (vb - va); return a + t * (b - a); }

    for (var y = 0; y < gh - 1; y++) {
      for (var x = 0; x < gw - 1; x++) {
        var tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
        var idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;

        /* Edge crossing points, in the same normalised space as the grid. */
        var top = { x: ip(x, x + 1, tl, tr), y: y };
        var right = { x: x + 1, y: ip(y, y + 1, tr, br) };
        var bottom = { x: ip(x, x + 1, bl, br), y: y + 1 };
        var left = { x: x, y: ip(y, y + 1, tl, bl) };

        switch (idx) {
          case 1: case 14: segs.push([left, bottom]); break;
          case 2: case 13: segs.push([bottom, right]); break;
          case 3: case 12: segs.push([left, right]); break;
          case 4: case 11: segs.push([top, right]); break;
          case 6: case 9:  segs.push([top, bottom]); break;
          case 7: case 8:  segs.push([left, top]); break;
          case 5:  segs.push([left, top]); segs.push([bottom, right]); break;
          case 10: segs.push([left, bottom]); segs.push([top, right]); break;
        }
      }
    }
    return segs;
  }

  /**
   * Stitch loose segments into closed loops by matching endpoints. Coordinates
   * are quantised for the lookup, because floating-point equality would never
   * find the join.
   */
  function stitch(segs) {
    var key = function (p) { return Math.round(p.x * 2048) + ':' + Math.round(p.y * 2048); };
    var open = {}, loops = [], used = new Array(segs.length);

    for (var i = 0; i < segs.length; i++) {
      [0, 1].forEach(function (end) {
        var k = key(segs[i][end]);
        (open[k] = open[k] || []).push({ seg: i, end: end });
      });
    }

    function other(segIdx, end) { return segs[segIdx][1 - end]; }

    for (var s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      used[s] = true;
      var loop = [segs[s][0], segs[s][1]];
      var at = segs[s][1], guard = 0;

      while (guard++ < 4000) {
        var k2 = key(at);
        var cands = open[k2] || [];
        var next = null;
        for (var c = 0; c < cands.length; c++) {
          if (!used[cands[c].seg]) { next = cands[c]; break; }
        }
        if (!next) break;
        used[next.seg] = true;
        at = other(next.seg, next.end);
        loop.push(at);
        if (key(at) === key(loop[0])) break;
      }
      if (loop.length > 3) loops.push(loop);
    }
    return loops;
  }

  /** Loops → one SVG path. Even-odd fills holes inside a level correctly. */
  function loopsToPath(loops, sx, sy) {
    if (!loops.length) return '';
    var d = '';
    for (var i = 0; i < loops.length; i++) {
      var lp = loops[i];
      d += 'M' + r2(sx(lp[0].x)) + ' ' + r2(sy(lp[0].y));
      for (var j = 1; j < lp.length; j++) d += 'L' + r2(sx(lp[j].x)) + ' ' + r2(sy(lp[j].y));
      d += 'Z';
    }
    return d;
  }

  /* ------------------------------------------------------------- the chart -- */

  /**
   * Draw the terrain.
   *
   * spec = {
   *   width, height,
   *   points:  [{ id, code, name, x, y, size, zone, exposure, breach, worsen, moved }]
   *            x and y are 0..1 (breach chance, worsening chance)
   *   thresholds: { breachProb, worsenProb },
   *   selectedId, onSelect(id)
   * }
   */
  function field(spec) {
    var W = spec.width || 820, H = spec.height || 560;
    var M = { t: 26, r: 22, b: 52, l: 62 };
    var iw = W - M.l - M.r, ih = H - M.t - M.b;

    /* The view extends a little past 0..1 so contours close off rather than
       being sliced by the frame — a map has margins. */
    var D0 = -0.07, D1 = 1.07;
    var X = function (v) { return M.l + ((v - D0) / (D1 - D0)) * iw; };
    var Y = function (v) { return M.t + (1 - (v - D0) / (D1 - D0)) * ih; };

    var dark = !!spec.dark;
    var RAMP = dark ? LAND_DARK : LAND;
    var GRID = dark ? 'rgba(140,192,160,.13)' : null;   /* null = use the token */
    var LABEL = dark ? 'rgba(214,238,224,.55)' : '#0E4A2F';
    var AXIS = dark ? 'rgba(214,238,224,.5)' : '#5A6E62';

    /* `bare` drops the chart furniture (axes, ticks, quadrant names, graticule)
       for uses where the field is an image rather than a readable chart.
       `fill` lets it cover its box instead of letterboxing inside it. */
    var bare = !!spec.bare;
    var root = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      width: '100%', preserveAspectRatio: spec.fill ? 'xMidYMid slice' : 'xMidYMid meet',
      role: 'img', class: 'chart terrain-chart' + (dark ? ' terrain-dark' : '') + (bare ? ' terrain-bare' : '')
    });
    root.appendChild(svg('title', {}, 'Credit weather map: every customer group placed by how soon a breach may come ' +
      '(across) against how fast its risk is rising (up). Contour lines show where exposure concentrates.'));

    var defs = svg('defs');
    var clipId = 'terrain-clip-' + Math.random().toString(36).slice(2, 8);
    var clip = svg('clipPath', { id: clipId }, svg('rect', {
      x: M.l, y: M.t, width: iw, height: ih, rx: 14
    }));
    defs.appendChild(clip);
    root.appendChild(defs);

    var field = svg('g', { 'clip-path': 'url(#' + clipId + ')' });

    /* ---- 1. the land: computed density bands ---------------------------- */

    var gw = 168, gh = Math.round(168 * ih / iw);
    if (gh < 48) gh = 48;
    var pts = (spec.points || []).map(function (p) {
      return { x: (HR.clamp(p.x, 0, 1) - D0) / (D1 - D0), y: (HR.clamp(p.y, 0, 1) - D0) / (D1 - D0), w: p.size || 1 };
    });
    /* Bandwidth decides whether the map shows one smooth mass or the real
       sub-clusters the book actually forms. Left to itself it is Silverman's
       rule of thumb, scaled to the number of groups; a spec may override it. */
    var bw = spec.bandwidth ||
      HR.clamp(0.055 * Math.pow(120 / Math.max(12, pts.length), 0.2), 0.028, 0.11);
    var dens = kde(pts, gw, gh, bw);

    var gx = function (i) { return D0 + (i / (gw - 1)) * (D1 - D0); };
    var gy = function (j) { return D0 + (j / (gh - 1)) * (D1 - D0); };
    var sx = function (i) { return X(gx(i)); };
    var sy = function (j) { return Y(gy(j)); };

    var LEVELS = [0.08, 0.18, 0.32, 0.48, 0.66, 0.84];
    LEVELS.forEach(function (lv, li) {
      var loops = stitch(marchingSquares(dens, gw, gh, lv));
      var d = loopsToPath(loops, sx, sy);
      if (!d) return;
      /* Stacked low → high: each band paints over the one beneath it, so the
         fills band themselves without any boolean geometry. */
      field.appendChild(svg('path', {
        d: d, fill: RAMP[li], 'fill-rule': 'evenodd',
        stroke: 'none'
      }));
    });
    root.appendChild(field);

    /* ---- 2. contour strokes --------------------------------------------- */

    var contours = svg('g', { 'clip-path': 'url(#' + clipId + ')' });
    LEVELS.forEach(function (lv, li) {
      var loops = stitch(marchingSquares(dens, gw, gh, lv + 0.001));
      var d = loopsToPath(loops, sx, sy);
      if (!d) return;
      /* Every third line is an index contour, drawn heavier — the convention
         that lets a reader count elevation without reading every line. */
      var index = (li % 3 === 0);
      contours.appendChild(svg('path', {
        d: d, class: 'contour' + (index ? ' major' : ''),
        style: 'stroke:' + (dark ? (index ? '#5FCF94' : '#3E9E6C') : (index ? '#4FA877' : '#8CC0A0')) +
               ';stroke-width:' + (index ? 1.4 : 0.8) + ';fill:none;opacity:' + (index ? 0.85 : 0.6)
      }));
    });
    root.appendChild(contours);

    /* ---- 3. the graticule ------------------------------------------------
       The measurement grid stays visible, the way it does on a working survey
       sheet: you can read a customer's position off it without a tooltip. */
    var grat = svg('g', { 'clip-path': 'url(#' + clipId + ')' });
    if (!bare) [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var gl = { class: 'grid-line' };
      if (GRID) gl.style = 'stroke:' + GRID;
      grat.appendChild(svg('line', Object.assign({ x1: r2(X(v)), y1: M.t, x2: r2(X(v)), y2: M.t + ih }, gl)));
      grat.appendChild(svg('line', Object.assign({ x1: M.l, y1: r2(Y(v)), x2: M.l + iw, y2: r2(Y(v)) }, gl)));
    });
    root.appendChild(grat);

    /* ---- 4. the ridge lines: thresholds -------------------------------- */

    var t = spec.thresholds || { breachProb: 0.5, worsenProb: 0.35 };
    var bx = X(t.breachProb), wy = Y(t.worsenProb);
    var ridge = svg('g');
    [
      { x1: bx, y1: M.t, x2: bx, y2: M.t + ih },
      { x1: M.l, y1: wy, x2: M.l + iw, y2: wy }
    ].forEach(function (l) {
      ridge.appendChild(svg('line', Object.assign({}, l, {
        style: 'stroke:' + (dark ? 'rgba(214,238,224,.42)' : '#0E4A2F') +
               ';stroke-width:1.4;stroke-dasharray:6 4;opacity:' + (dark ? 1 : .5)
      })));
    });
    root.appendChild(ridge);

    /* Zone names, set quietly in the corners of their own quadrant. */
    var zoneLabels = [
      { z: 'Watch',   x: M.l + 16,            y: M.t + 22, anchor: 'start' },
      { z: 'Act now', x: M.l + iw - 16,       y: M.t + 22, anchor: 'end' },
      { z: 'Clear',   x: M.l + 16,            y: M.t + ih - 14, anchor: 'start' },
      { z: 'Growth',  x: M.l + iw - 16,       y: M.t + ih - 14, anchor: 'end' }
    ];
    if (!bare) zoneLabels.forEach(function (zl) {
      root.appendChild(svg('text', {
        x: r2(zl.x), y: r2(zl.y), 'text-anchor': zl.anchor, class: 'annotation-strong',
        style: 'fill:' + LABEL + ';opacity:.9;font-size:11.5px;letter-spacing:.04em'
      }, zl.z));
    });

    /* ---- 5. the customers ---------------------------------------------- */

    var maxSize = 0;
    (spec.points || []).forEach(function (p) { if (p.size > maxSize) maxSize = p.size; });
    if (maxSize <= 0) maxSize = 1;

    var dots = svg('g', { 'clip-path': 'url(#' + clipId + ')' });

    (spec.points || []).slice().sort(function (a, b) { return (a.size || 0) - (b.size || 0); })
      .forEach(function (p) {
        var cx = X(HR.clamp(p.x, 0, 1)), cy = Y(HR.clamp(p.y, 0, 1));
        /* Area tracks exposure but the radius is compressed: at 120 groups a
           literal square-root scale buries the small ones and lets the largest
           swallow their neighbours. */
        var radius = HR.clamp(Math.sqrt((p.size || 1) / maxSize) * 13, 4, 14);
        var isSel = spec.selectedId && String(spec.selectedId) === String(p.id);

        var g = svg('g', {
          class: 'hit', tabindex: '0', role: 'button',
          'aria-label': (p.name || p.code) + ': ' + p.zone + ', ' + HR.pct(p.breach) +
            ' chance of breach, ' + HR.pct(p.worsen) + ' chance of worsening, exposure ' + HR.usd(p.size)
        });

        if (isSel) {
          g.appendChild(svg('circle', {
            cx: r2(cx), cy: r2(cy), r: r2(radius + 6),
            style: 'fill:none;stroke:#0E4A2F;stroke-width:2;stroke-dasharray:3 3'
          }));
        }
        g.appendChild(svg('circle', {
          cx: r2(cx), cy: r2(cy), r: r2(radius), class: 'dot',
          style: 'fill:' + ZONE_FILL[p.zone] + ';stroke:' + ZONE_STROKE[p.zone] + ';stroke-width:1.3' +
                 (p.zone === 'Clear' ? ';fill-opacity:' + (dark ? '.55' : '.72') : '')
        }));

        var tip = function (ev) {
          HR.tip.show(
            '<b>' + HR.esc(p.name || p.code) + '</b><br>' +
            '<span style="opacity:.8">' + HR.esc(p.zone) + '</span><br>' +
            '<div class="r"><span>Breach 90d</span><b>' + HR.pct(p.breach) + '</b></div>' +
            '<div class="r"><span>Worsening</span><b>' + HR.pct(p.worsen) + '</b></div>' +
            '<div class="r"><span>Exposure</span><b>' + HR.usd(p.size) + '</b></div>' +
            (p.why ? '<div style="margin-top:5px;opacity:.85;max-width:240px">' + HR.esc(p.why) + '</div>' : ''),
            ev.clientX, ev.clientY);
        };
        g.addEventListener('mousemove', tip);
        g.addEventListener('focus', function () {
          var b = g.getBoundingClientRect();
          HR.tip.show('<b>' + HR.esc(p.name || p.code) + '</b><br>' + HR.esc(p.zone) +
            ' · breach ' + HR.pct(p.breach) + ' · ' + HR.usd(p.size), b.left + b.width / 2, b.top);
        });
        g.addEventListener('mouseleave', HR.tip.hide);
        g.addEventListener('blur', HR.tip.hide);
        var go = function () { if (spec.onSelect) spec.onSelect(p.id); };
        g.addEventListener('click', go);
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
        dots.appendChild(g);
      });
    root.appendChild(dots);

    /* ---- 6. axes -------------------------------------------------------- */

    var axes = svg('g');
    if (!bare) {
    axes.appendChild(svg('line', { x1: M.l, y1: M.t + ih, x2: M.l + iw, y2: M.t + ih, class: 'ax-line' }));
    axes.appendChild(svg('line', { x1: M.l, y1: M.t, x2: M.l, y2: M.t + ih, class: 'ax-line' }));
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      axes.appendChild(svg('text', {
        x: r2(X(v)), y: M.t + ih + 18, 'text-anchor': 'middle', class: 'ax-label', style: 'fill:' + AXIS
      }, HR.pct(v)));
      axes.appendChild(svg('text', {
        x: M.l - 10, y: r2(Y(v) + 3.5), 'text-anchor': 'end', class: 'ax-label', style: 'fill:' + AXIS
      }, HR.pct(v)));
    });
    axes.appendChild(svg('text', {
      x: M.l + iw / 2, y: H - 14, 'text-anchor': 'middle', class: 'axis-title'
    }, 'How soon: chance of passing the credit limit in the next 90 days'));
    axes.appendChild(svg('text', {
      x: 0, y: 0, 'text-anchor': 'middle', class: 'axis-title',
      transform: 'translate(16,' + (M.t + ih / 2) + ') rotate(-90)'
    }, 'How fast: chance of sustained worsening in the next 90 days'));
    }
    root.appendChild(axes);

    return root;
  }

  HR.terrain = { field: field, kde: kde, marchingSquares: marchingSquares, stitch: stitch };
})(window);
