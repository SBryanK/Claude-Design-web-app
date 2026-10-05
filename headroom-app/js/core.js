/* ============================================================================
   Headroom — core toolkit
   Formatting, deterministic randomness, DOM helpers, state, event bus.
   No dependencies. Loaded first.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR = global.HR || {};

  /* --------------------------------------------------------------- numbers */

  /** Format a USD amount given in millions, compactly: 582 -> "USD 582m". */
  HR.usd = function (millions, opts) {
    opts = opts || {};
    var v = millions;
    var sign = v < 0 ? '-' : '';
    v = Math.abs(v);
    var body;
    if (v >= 1000) {
      body = (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'bn';
    } else if (v >= 100) {
      body = Math.round(v) + 'm';
    } else if (v >= 10) {
      body = (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + 'm';
    } else {
      body = (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + 'm';
    }
    return (opts.bare ? '' : 'USD ') + sign + body;
  };

  /** Number with thousands separators. */
  HR.n = function (v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('en-US', {
      minimumFractionDigits: dp || 0, maximumFractionDigits: dp === undefined ? 0 : dp
    });
  };

  /** Percentage from a 0..1 fraction. */
  HR.pct = function (fraction, dp) {
    if (fraction === null || fraction === undefined || isNaN(fraction)) return '—';
    return (fraction * 100).toFixed(dp === undefined ? 0 : dp) + '%';
  };

  /** Percentage from an already-scaled 0..100 value. */
  HR.pctRaw = function (v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toFixed(dp === undefined ? 0 : dp) + '%';
  };

  /** Signed number, e.g. "+17" / "-1". */
  HR.signed = function (v) {
    return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
  };

  /** "30 Sep" / "30 Sep 2027" from an ISO date string or Date. */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  HR.d = function (iso) { return iso instanceof Date ? iso : new Date(iso + 'T00:00:00'); };
  HR.dateShort = function (iso) {
    var d = HR.d(iso);
    return d.getDate() + ' ' + MON[d.getMonth()];
  };
  HR.dateFull = function (iso) {
    var d = HR.d(iso);
    return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  };
  HR.dateISO = function (d) {
    d = d instanceof Date ? d : HR.d(d);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };
  HR.addDays = function (iso, n) {
    var d = HR.d(iso); d.setDate(d.getDate() + n); return HR.dateISO(d);
  };
  HR.daysBetween = function (a, b) {
    return Math.round((HR.d(b) - HR.d(a)) / 86400000);
  };

  /** Compact date+time for the freshness stamp. */
  HR.stamp = function (date) {
    date = date || new Date();
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    return HR.dateShort(HR.dateISO(date)) + ' ' + hh + ':' + mm;
  };

  /* ------------------------------------------------- deterministic random -- */

  /** mulberry32 — small, fast, seedable PRNG. Same seed gives the same series. */
  HR.rng = function (seed) {
    var a = seed >>> 0;
    var fn = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    fn.int = function (lo, hi) { return lo + Math.floor(fn() * (hi - lo + 1)); };
    fn.pick = function (arr) { return arr[Math.floor(fn() * arr.length)]; };
    fn.bool = function (p) { return fn() < p; };
    /** Normal via Box–Muller. */
    fn.norm = function (mean, sd) {
      var u = 1 - fn(), v = fn();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    /** Lognormal, for exposure sizes. */
    fn.lognorm = function (median, sigma) { return median * Math.exp(fn.norm(0, sigma)); };
    /** Draw one value from a weighted list of {v, w}. Highest weight first. */
    fn.weighted = function (list) {
      var total = list.reduce(function (s, x) { return s + x.w; }, 0);
      var r = fn() * total, best = list[0], bestW = -Infinity;
      for (var i = 0; i < list.length; i++) {
        r -= list[i].w;
        if (list[i].w > bestW) { bestW = list[i].w; best = list[i]; }
        if (r <= 0) return list[i].v;
      }
      return best.v;
    };
    /** Clamp helper scoped to the generator for convenience. */
    fn.clamp = HR.clamp;
    return fn;
  };

  HR.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  HR.lerp = function (a, b, t) { return a + (b - a) * t; };
  HR.sum = function (arr, f) { return arr.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); };
  HR.median = function (arr) {
    if (!arr.length) return NaN;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  HR.quantile = function (arr, q) {
    if (!arr.length) return NaN;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var pos = (s.length - 1) * q, base = Math.floor(pos), rest = pos - base;
    return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
  };
  HR.mean = function (arr) { return arr.length ? HR.sum(arr) / arr.length : NaN; };
  HR.sd = function (arr) {
    if (arr.length < 2) return 0;
    var m = HR.mean(arr);
    return Math.sqrt(HR.sum(arr, function (x) { return (x - m) * (x - m); }) / (arr.length - 1));
  };
  HR.round = function (v, dp) { var f = Math.pow(10, dp || 0); return Math.round(v * f) / f; };

  /* --------------------------------------------------------------- the DOM */

  HR.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (children !== null && children !== undefined) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  };

  /** Build an SVG element with attributes (namespace-aware). */
  HR.svg = function (tag, attrs, children) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    if (children !== null && children !== undefined) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  };

  HR.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  HR.clear = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ----------------------------------------------------------------- icons */
  /* Inline stroke icons (24x24 grid) so nothing is fetched at runtime. */
  var ICONS = {
    portfolio: '<path d="M3 17l5-6 4 3 5-7 4 4"/><circle cx="8" cy="11" r="1.4"/><circle cx="12" cy="14" r="1.4"/>',
    customers: '<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    radar:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.6"/><path d="M12 12l6-4"/>',
    model:    '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-5 3 3 5-7"/>',
    sliders:  '<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="2.1"/><circle cx="15" cy="12" r="2.1"/><circle cx="8" cy="17" r="2.1"/>',
    file:     '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    link:     '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    bell:     '<path d="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16z"/><path d="M10 21h4"/>',
    news:     '<path d="M4 5h11v14H5a1 1 0 0 1-1-1z"/><path d="M15 9h4v9a1 1 0 0 1-1 1h-3"/><path d="M7 9h5M7 13h5"/>',
    globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>',
    trend:    '<path d="M3 17l6-6 4 4 7-8"/><path d="M20 7v5h-5"/>',
    flag:     '<path d="M5 21V4"/><path d="M5 5h12l-2 4 2 4H5"/>',
    check:    '<path d="M20 6L9 17l-5-5"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    close:    '<path d="M6 6l12 12M18 6L6 18"/>',
    refresh:  '<path d="M20 11a8 8 0 1 0-2 6"/><path d="M20 5v6h-6"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".8" fill="currentColor"/>',
    warn:     '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".8" fill="currentColor"/>',
    download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    filter:   '<path d="M4 6h16l-6 7v6l-4-2v-4z"/>',
    user:     '<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/><path d="M3 12h18"/>',
    cpu:      '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    pulse:    '<path d="M3 12h4l2-6 3 12 2.5-6H21"/>',
    layers:   '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    scale:    '<path d="M12 4v16"/><path d="M6 20h12"/><path d="M4 8h6l-3 6z"/><path d="M14 8h6l-3 6z"/>',
    shield:   '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    mail:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
  };

  /** Return an <svg> element for a named icon. */
  HR.icon = function (name, size) {
    var d = ICONS[name] || ICONS.info;
    var s = size || 18;
    return HR.svg('svg', {
      viewBox: '0 0 24 24', width: s, height: s, fill: 'none',
      stroke: 'currentColor', 'stroke-width': 1.7,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
    }, [HR.svg('g', { html: d })].map(function (g) { g.innerHTML = d; return g; }));
  };

  HR.iconHTML = function (name, size) {
    var d = ICONS[name] || ICONS.info;
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };

  HR.ICON_NAMES = Object.keys(ICONS);

  /* ----------------------------------------------------------------- state */

  var LS_KEY = 'headroom.state.v1';

  HR.store = (function () {
    var state = {
      /** Thresholds — set with the credit team, editable on the Thresholds screen. */
      thresholds: {
        breachProb: 0.50,   // across: chance of passing the limit in 90 days
        worsenProb: 0.35,   // up: chance of a lasting decline in 90 days
        watchlistCap: 10,
        alertOverduePct: 0.25,
        materialEventDays: 7
      },
      /** Analyst decisions and notes, keyed by group id. */
      decisions: {},
      /** Decisions in reverse-chronological order. */
      log: [],
      /** Optional name masking for demos with real names. */
      maskNames: false,
      /** The demo "as of" date — kept fixed so the numbers are reproducible. */
      asOf: '2027-09-06'
    };

    function load() {
      try {
        var raw = global.localStorage && global.localStorage.getItem(LS_KEY);
        if (!raw) return;
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (saved.thresholds) Object.assign(state.thresholds, saved.thresholds);
          if (saved.decisions) state.decisions = saved.decisions;
          if (saved.log) state.log = saved.log;
          if (typeof saved.maskNames === 'boolean') state.maskNames = saved.maskNames;
        }
      } catch (e) { /* storage unavailable (file://) — run in memory */ }
    }

    function save() {
      try {
        global.localStorage && global.localStorage.setItem(LS_KEY, JSON.stringify({
          thresholds: state.thresholds, decisions: state.decisions,
          log: state.log, maskNames: state.maskNames
        }));
      } catch (e) { /* ignore */ }
    }

    load();

    var listeners = {};
    return {
      get state() { return state; },
      get thresholds() { return state.thresholds; },
      get decisions() { return state.decisions; },
      get log() { return state.log; },

      on: function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return this; },
      emit: function (evt, payload) {
        (listeners[evt] || []).forEach(function (fn) { fn(payload); });
        (listeners['*'] || []).forEach(function (fn) { fn(evt, payload); });
      },

      setThreshold: function (key, value) {
        state.thresholds[key] = value; save(); this.emit('thresholds', state.thresholds);
      },
      resetThresholds: function () {
        state.thresholds = { breachProb: 0.50, worsenProb: 0.35, watchlistCap: 10, alertOverduePct: 0.25, materialEventDays: 7 };
        save(); this.emit('thresholds', state.thresholds);
      },
      /** Record a decision against a group. */
      decide: function (groupId, action, note) {
        var entry = {
          id: 'd' + Date.now() + Math.random().toString(36).slice(2, 7),
          groupId: groupId, action: action, note: note || '',
          at: new Date().toISOString()
        };
        state.decisions[groupId] = entry;
        state.log.unshift(entry);
        if (state.log.length > 200) state.log.length = 200;
        save(); this.emit('decision', entry);
        return entry;
      },
      decisionFor: function (groupId) { return state.decisions[groupId] || null; },
      setMaskNames: function (v) { state.maskNames = !!v; save(); this.emit('mask', v); },
      /** Clear everything the analyst produced (used by the demo reset). */
      resetAll: function () {
        state.decisions = {}; state.log = []; state.maskNames = false;
        this.resetThresholds();
        this.emit('reset');
      }
    };
  })();

  /* -------------------------------------------------------------- tooltip  */

  HR.tip = (function () {
    var node = null;
    function ensure() {
      if (!node) { node = HR.el('div', { class: 'tip hidden' }); document.body.appendChild(node); }
      return node;
    }
    return {
      show: function (html, x, y) {
        var t = ensure();
        t.innerHTML = html;
        t.classList.remove('hidden');
        var r = t.getBoundingClientRect();
        var left = HR.clamp(x + 14, 8, global.innerWidth - r.width - 8);
        var top = HR.clamp(y - r.height - 12, 8, global.innerHeight - r.height - 8);
        t.style.left = left + 'px';
        t.style.top = top + 'px';
      },
      hide: function () { if (node) node.classList.add('hidden'); }
    };
  })();

  /* ---------------------------------------------------------------- toast  */

  HR.toast = function (message, kind) {
    var host = document.querySelector('.toasts');
    if (!host) { host = HR.el('div', { class: 'toasts' }); document.body.appendChild(host); }
    /* Icon markup goes in as `html`; as a child it would print the tags. */
    var el = HR.el('div', { class: 'toast' + (kind === 'honey' ? ' honey' : '') }, [
      HR.el('span', { html: HR.iconHTML(kind === 'honey' ? 'info' : 'check', 16), style: { display: 'flex' } }),
      HR.el('span', { text: message })
    ]);
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  };

  /* ------------------------------------------------------------ misc utils */

  /** Debounce a function. */
  HR.debounce = function (fn, ms) {
    var t; return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 180);
    };
  };

  /** Group an array by a key function. */
  HR.groupBy = function (arr, keyFn) {
    return arr.reduce(function (acc, item) {
      var k = keyFn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  };

  /** Build a DOM node from an HTML string (single root expected). */
  HR.fromHTML = function (html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  /** Escape-aware markup helper for template literals. */
  HR.h = function (strings) {
    var values = Array.prototype.slice.call(arguments, 1);
    return strings.reduce(function (out, s, i) {
      return out + s + (i < values.length ? values[i] : '');
    }, '');
  };
})(window);
