/* ============================================================================
   audit.js — a measured craft report for the page you are looking at.

   Paste into the browser console, or load it during development:

     <script src="scripts/audit.js"></script>

   It REPORTS. It does not fix, and it does not block. A finding is a prompt to
   look, not a verdict — this tool has no idea what your brief pinned.

   Checks: horizontal overflow, text contrast, tap targets, focus rings, layout
   animation, content hidden by default, accessible names, image alt text,
   heading order, duplicate ids, lang, zoom, tiny text, measure width,
   placeholder-only labels, and live-region presence.

   Usage in the console:
     __craft.report()        full report
     __craft.summary()       counts only
     __craft.check('overflow')   one section
     __craft.widths()        measure at 12 widths (needs a frame; reloads layout)
   ========================================================================== */
(function () {
  'use strict';

  var MIN_TAP = 44;
  var MIN_FONT = 12;
  var MAX_MEASURE = 90;

  /* ------------------------------------------------------------- utilities -- */

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text) n.textContent = text;
    return n;
  }

  function visible(n) {
    if (!n || !n.getBoundingClientRect) return false;
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    var r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function describe(n) {
    if (!n) return '(none)';
    var s = n.tagName.toLowerCase();
    if (n.id) s += '#' + n.id;
    var cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).filter(Boolean);
    if (cls.length) s += '.' + cls.slice(0, 2).join('.');
    var txt = (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (txt) s += ' "' + txt + '"';
    return s;
  }

  function path(n) {
    var parts = [];
    while (n && n.nodeType === 1 && parts.length < 5) {
      parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : ''));
      n = n.parentElement;
    }
    return parts.join(' > ');
  }

  /* --------------------------------------------------------------- colour -- */

  function parseColor(str) {
    if (!str) return null;
    if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    var m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[,\s/]+/).filter(function (x) { return x !== ''; }).map(Number);
    if (p.length < 3 || p.slice(0, 3).some(isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !isNaN(p[3]) ? p[3] : 1 };
  }

  function over(fg, bg) {
    var a = fg.a;
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1
    };
  }

  /** Composite every translucent background from the element up to the root. */
  function backgroundOf(n) {
    var stack = [];
    var node = n;
    while (node && node.nodeType === 1) {
      var c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a >= 1) break;
      }
      node = node.parentElement;
    }
    var base = { r: 255, g: 255, b: 255, a: 1 };
    for (var i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  }

  function luminance(c) {
    var s = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }

  function contrast(fg, bg) {
    var L1 = luminance(fg), L2 = luminance(bg);
    var hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* --------------------------------------------------------------- checks -- */

  function checkOverflow() {
    var vw = document.documentElement.clientWidth;
    var sw = document.documentElement.scrollWidth;
    var out = {
      id: 'overflow',
      title: 'Horizontal overflow',
      pass: sw <= vw + 1,
      detail: vw + 'px viewport, ' + sw + 'px content'
    };
    if (!out.pass) {
      out.items = [];
      var all = document.querySelectorAll('body *');
      for (var i = 0; i < all.length && out.items.length < 12; i++) {
        var n = all[i];
        var r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          var parent = n.parentElement;
          // Report the outermost offender only — children inherit the problem.
          if (parent && parent.getBoundingClientRect().right > vw + 1) continue;
          out.items.push(path(n) + '  right=' + Math.round(r.right) + ' w=' + Math.round(r.width));
        }
      }
    }
    return out;
  }

  function textNodes() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (t) {
        if (!t.nodeValue || !t.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = t.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'title') {
          return NodeFilter.FILTER_REJECT;
        }
        if (p.closest && p.closest('.sr-only, [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], t;
    while ((t = walker.nextNode())) nodes.push(t);
    return nodes;
  }

  function checkContrast() {
    var seen = {}, fails = [];
    var nodes = textNodes();
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i].parentElement;
      if (!visible(p)) continue;
      var cs = getComputedStyle(p);
      var fg = parseColor(cs.color);
      if (!fg) continue;
      var bg = backgroundOf(p);
      // Text alpha composites against its own background.
      var fgSolid = fg.a < 1 ? over(fg, bg) : fg;
      var ratio = contrast(fgSolid, bg);
      var size = parseFloat(cs.fontSize);
      var weight = Number(cs.fontWeight) || 400;
      var large = size >= 24 || (size >= 18.66 && weight >= 700);
      var need = large ? 3 : 4.5;
      if (ratio + 0.05 >= need) continue;

      var key = describe(p);
      if (seen[key]) continue;
      seen[key] = 1;
      fails.push({
        where: key,
        ratio: Math.round(ratio * 100) / 100,
        need: need,
        size: Math.round(size * 10) / 10,
        color: cs.color,
        bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')'
      });
    }
    return {
      id: 'contrast',
      title: 'Text contrast',
      pass: fails.length === 0,
      detail: nodes.length + ' text nodes measured, ' + fails.length + ' below AA',
      items: fails.slice(0, 15).map(function (f) {
        return f.where + '  ' + f.ratio + ':1 (needs ' + f.need + ':1)  ' +
               f.size + 'px  ' + f.color + ' on ' + f.bg;
      })
    };
  }

  function checkTapTargets() {
    var sel = 'a[href], button, [role="button"], input[type="checkbox"], input[type="radio"], select, summary';
    var nodes = document.querySelectorAll(sel);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var fails = [];
    // Guidance only when the pointer is a mouse: 44px is a touch rule, and
    // reporting 200 desktop nav links as failures makes the whole report
    // untrustworthy. Still listed, so a small screen is not silently ignored.
    var advisory = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!visible(n)) continue;
      if (n.closest('.sr-only, [aria-hidden="true"]')) continue;
      var r = n.getBoundingClientRect();
      if (r.width >= MIN_TAP && r.height >= MIN_TAP) continue;
      // An inline link inside a paragraph is text, not a target.
      var cs = getComputedStyle(n);
      if (n.tagName === 'A' && cs.display.indexOf('inline') === 0 && n.closest('p, li, td')) continue;
      var line = describe(n) + '  ' + Math.round(r.width) + 'x' + Math.round(r.height) + 'px';
      (coarse ? fails : advisory).push(line);
    }
    return {
      id: 'tap',
      title: 'Tap targets',
      pass: fails.length === 0,
      detail: !coarse
        ? nodes.length + ' controls; pointer is fine, so ' + advisory.length +
          ' small ones are advisory only (resize to a touch width to enforce)'
        : nodes.length + ' controls, ' + fails.length + ' under ' + MIN_TAP + 'px',
      items: (coarse ? fails : advisory).slice(0, 12)
    };
  }

  /**
   * Is there a :focus / :focus-visible rule anywhere in the stylesheets?
   *
   * An unfocused element reports `outline-style: none` whether or not a focus
   * ring is declared, so reading computed style per element cannot answer this.
   * Ask the stylesheets instead.
   */
  function focusRuleExists() {
    var found = null;
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules;
      try {
        rules = document.styleSheets[i].cssRules;
      } catch (e) {
        continue; // cross-origin sheet; cannot inspect
      }
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (r.selectorText && /:focus(-visible)?\b/.test(r.selectorText)) {
          var css = r.style && (r.style.outline || r.style.outlineWidth || r.style.boxShadow);
          if (css) { found = r.selectorText + ' { ' + (r.style.outline || r.style.boxShadow) + ' }'; break; }
        }
        // Recurse one level into @media and @supports blocks.
        if (r.cssRules) {
          for (var k = 0; k < r.cssRules.length; k++) {
            var inner = r.cssRules[k];
            if (inner.selectorText && /:focus(-visible)?\b/.test(inner.selectorText)) {
              var c2 = inner.style && (inner.style.outline || inner.style.outlineWidth || inner.style.boxShadow);
              if (c2) { found = inner.selectorText + ' { ' + (inner.style.outline || inner.style.boxShadow) + ' }'; break; }
            }
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    return found;
  }

  function checkFocus() {
    var rule = focusRuleExists();

    // With a declared ring, the remaining risk is an element that removes it.
    // Only elements that opt out explicitly are reported.
    var optOut = [];
    var nodes = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!visible(n)) continue;
      var cs = getComputedStyle(n);
      var killsOutline = cs.outlineStyle === 'none';
      var noShadow = cs.boxShadow === 'none';
      // An inline rule that suppresses the ring on this element specifically.
      if (killsOutline && noShadow && n.style && n.style.outline === 'none') {
        optOut.push(describe(n));
      }
    }

    return {
      id: 'focus',
      title: 'Focus indicators',
      pass: !!rule && optOut.length === 0,
      detail: rule
        ? 'ring declared: ' + rule.slice(0, 70) + (optOut.length ? ' — ' + optOut.length + ' elements opt out' : '')
        : 'no :focus or :focus-visible rule found in any stylesheet',
      items: optOut.slice(0, 12)
    };
  }

  function checkMotion() {
    var layoutProps = /^(width|height|top|left|right|bottom|margin|padding|font-size|line-height)/;
    var fails = [];
    var nodes = document.querySelectorAll('body *');
    for (var i = 0; i < nodes.length; i++) {
      var cs = getComputedStyle(nodes[i]);
      var dur = cs.transitionDuration.split(',').map(function (s) { return parseFloat(s) || 0; });
      var anyDuration = dur.some(function (d) { return d > 0; });
      if (!anyDuration) continue;
      var props = cs.transitionProperty.split(',').map(function (s) { return s.trim(); });
      for (var j = 0; j < props.length; j++) {
        if (layoutProps.test(props[j])) {
          fails.push(describe(nodes[i]) + '  transitions "' + props[j] + '"');
          break;
        }
      }
    }
    return {
      id: 'motion',
      title: 'Layout properties in transitions',
      pass: fails.length === 0,
      detail: fails.length + ' elements animate a property that relayouts',
      items: fails.slice(0, 12)
    };
  }

  function checkHiddenContent() {
    var fails = [];
    var nodes = document.querySelectorAll('body *');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var cs = getComputedStyle(n);
      if (Number(cs.opacity) !== 0) continue;
      var hasText = (n.textContent || '').trim().length > 12;
      var isDecorative = n.getAttribute('aria-hidden') === 'true' || !n.children.length;
      if (hasText && !isDecorative) {
        fails.push(describe(n) + '  opacity:0 with ' + (n.textContent || '').trim().length + ' chars inside');
      }
    }
    return {
      id: 'hidden',
      title: 'Content hidden by default',
      pass: fails.length === 0,
      detail: fails.length + ' blocks start invisible',
      items: fails.slice(0, 10)
    };
  }

  function accessibleName(n) {
    var aria = n.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    var labelled = n.getAttribute('aria-labelledby');
    if (labelled) {
      var ref = document.getElementById(labelled);
      if (ref && ref.textContent.trim()) return ref.textContent.trim();
    }
    var txt = (n.textContent || '').trim();
    if (txt) return txt;
    var img = n.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    var svgTitle = n.querySelector('svg > title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    if (n.title && n.title.trim()) return n.title.trim();
    return '';
  }

  function checkNames() {
    var fails = [];
    var nodes = document.querySelectorAll('a[href], button, [role="button"], input[type="submit"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!visible(n)) continue;
      if (!accessibleName(n)) fails.push(describe(n) + '  (no text, aria-label, or title)');
    }
    var imgs = document.querySelectorAll('img');
    for (var k = 0; k < imgs.length; k++) {
      if (!imgs[k].hasAttribute('alt')) {
        fails.push('img without alt: ' + (imgs[k].getAttribute('src') || '').slice(-42));
      }
    }
    return {
      id: 'names',
      title: 'Accessible names',
      pass: fails.length === 0,
      detail: nodes.length + ' controls, ' + imgs.length + ' images, ' + fails.length + ' problems',
      items: fails.slice(0, 12)
    };
  }

  function checkHeadings() {
    var hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    var issues = [];
    var h1 = document.querySelectorAll('h1').length;
    if (h1 === 0) issues.push('no <h1> on the page');
    if (h1 > 1) issues.push(h1 + ' <h1> elements; there should be one');
    var prev = 0;
    for (var i = 0; i < hs.length; i++) {
      var lvl = Number(hs[i].tagName[1]);
      if (prev && lvl > prev + 1) {
        issues.push('skipped h' + prev + ' -> h' + lvl + ' at "' +
          (hs[i].textContent || '').trim().slice(0, 40) + '"');
      }
      prev = lvl;
    }
    return {
      id: 'headings',
      title: 'Heading structure',
      pass: issues.length === 0,
      detail: hs.length + ' headings',
      items: issues.slice(0, 10)
    };
  }

  function checkDocument() {
    var issues = [];
    if (!document.documentElement.getAttribute('lang')) issues.push('<html> has no lang attribute');
    var vp = document.querySelector('meta[name="viewport"]');
    if (!vp) issues.push('no viewport meta tag');
    else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(vp.content)) {
      issues.push('zoom is disabled in the viewport meta tag');
    }
    var ids = {}, dupes = [];
    var all = document.querySelectorAll('[id]');
    for (var i = 0; i < all.length; i++) {
      var id = all[i].id;
      if (ids[id]) { if (dupes.indexOf(id) < 0) dupes.push(id); }
      ids[id] = 1;
    }
    if (dupes.length) issues.push('duplicate id: ' + dupes.slice(0, 5).join(', '));
    return {
      id: 'document',
      title: 'Document basics',
      pass: issues.length === 0,
      detail: all.length + ' ids checked',
      items: issues
    };
  }

  function checkSmallText() {
    var seen = {}, fails = [];
    var nodes = textNodes();
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i].parentElement;
      if (!visible(p)) continue;
      var size = parseFloat(getComputedStyle(p).fontSize);
      if (size >= MIN_FONT) continue;
      // Three legitimate exceptions, or the report cries wolf:
      //   - uppercase micro-labels (field labels, table headers)
      //   - chart internals: axis ticks and annotations are conventionally 10-11px
      //   - numeric badges, which are glyphs more than they are words
      if (p.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      if (p.closest && p.closest('.chart, svg, .badge, .count')) continue;
      var cs = getComputedStyle(p);
      if (cs.textTransform === 'uppercase' && (nodes[i].nodeValue || '').trim().length < 40) continue;
      var isNumeric = /^[\s\d.,%$\u2212-]+$/.test((nodes[i].nodeValue || '').trim());
      if (isNumeric) continue;
      var key = describe(p);
      if (seen[key]) continue;
      seen[key] = 1;
      fails.push(key + '  ' + Math.round(size * 10) / 10 + 'px');
    }
    return {
      id: 'smalltext',
      title: 'Running text below ' + MIN_FONT + 'px',
      pass: fails.length === 0,
      detail: fails.length + ' too small',
      items: fails.slice(0, 10)
    };
  }

  function checkMeasure() {
    var p = document.querySelectorAll('p');
    var fails = [];
    for (var i = 0; i < p.length; i++) {
      if (!visible(p[i])) continue;
      var r = p[i].getBoundingClientRect();
      var size = parseFloat(getComputedStyle(p[i]).fontSize) || 16;
      // Average glyph width is roughly 0.5em for a grotesque.
      var chars = r.width / (size * 0.5);
      if (chars > MAX_MEASURE) {
        fails.push(describe(p[i]) + '  ~' + Math.round(chars) + ' characters per line');
      }
    }
    return {
      id: 'measure',
      title: 'Line length',
      pass: fails.length === 0,
      detail: p.length + ' paragraphs, ' + fails.length + ' over ' + MAX_MEASURE + 'ch',
      items: fails.slice(0, 8)
    };
  }

  function checkPlaceholders() {
    var fails = [];
    var inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    for (var i = 0; i < inputs.length; i++) {
      var n = inputs[i];
      if (!visible(n)) continue;
      var id = n.id;
      var hasLabel = (id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) ||
        n.closest('label') ||
        (n.getAttribute('aria-label') || '').trim() ||
        (n.getAttribute('aria-labelledby') || '').trim();
      if (!hasLabel) {
        fails.push(describe(n) + (n.placeholder ? '  (placeholder only: "' + n.placeholder + '")' : '  (no label)'));
      }
    }
    return {
      id: 'labels',
      title: 'Form labels',
      pass: fails.length === 0,
      detail: inputs.length + ' inputs, ' + fails.length + ' unlabelled',
      items: fails.slice(0, 10)
    };
  }

  var CHECKS = [
    checkOverflow, checkDocument, checkContrast, checkTapTargets, checkFocus,
    checkMotion, checkHiddenContent, checkNames, checkHeadings, checkSmallText,
    checkMeasure, checkPlaceholders
  ];

  /* --------------------------------------------------------------- report -- */

  function run(only) {
    var results = [];
    for (var i = 0; i < CHECKS.length; i++) {
      var fn = CHECKS[i];
      try {
        var r = fn();
        if (!only || r.id === only) results.push(r);
      } catch (e) {
        results.push({
          id: fn.name || 'check', title: fn.name || 'check',
          pass: false, detail: 'check threw: ' + e.message, items: []
        });
      }
    }
    return results;
  }

  function summary() {
    var results = run();
    var failed = results.filter(function (r) { return !r.pass; });
    console.log(
      '%c craft audit ',
      'background:#1F7A4D;color:#fff;border-radius:3px;padding:2px 6px',
      failed.length === 0
        ? 'all ' + results.length + ' checks clear'
        : failed.length + ' of ' + results.length + ' checks need attention'
    );
    failed.forEach(function (r) {
      console.log('  %cFAIL%c ' + r.title + ' — ' + r.detail, 'color:#E8543A;font-weight:700', 'color:inherit');
    });
    if (failed.length) {
      console.log('Run __craft.report() for the specifics.');
    }
    return failed.map(function (r) { return r.id; });
  }

  function report(only) {
    var results = run(only);
    console.group('%c craft audit ', 'background:#1F7A4D;color:#fff;border-radius:3px;padding:2px 6px');
    results.forEach(function (r) {
      var mark = r.pass ? '%c pass ' : '%c FAIL ';
      var style = r.pass
        ? 'color:#1F7A4D;font-weight:700'
        : 'color:#E8543A;font-weight:700';
      console.log(mark + '%c ' + r.title + '  —  ' + r.detail, style, 'color:#6B7F75');
      if (r.items && r.items.length) {
        r.items.forEach(function (it) { console.log('      ' + it); });
      }
    });
    console.groupEnd();
    return results;
  }

  /* ---------------------------------------------------------- the widths --- */

  /**
   * Measure scrollWidth against clientWidth at the standard set.
   *
   * This resizes nothing — it reads the current layout and reports, unless the
   * page exposes a way to set the width. Resize the window (or use device
   * emulation) and re-run to cover the rest.
   */
  function widths() {
    var vw = document.documentElement.clientWidth;
    var sw = document.documentElement.scrollWidth;
    var ok = sw <= vw + 1;
    console.log(
      '%c' + (ok ? ' pass ' : ' FAIL ') + '%c ' + vw + 'px  scrollWidth ' + sw +
      (ok ? '' : '  — overflows by ' + (sw - vw) + 'px'),
      ok ? 'color:#1F7A4D;font-weight:700' : 'color:#E8543A;font-weight:700',
      'color:inherit'
    );
    console.log('Target widths: 320 · 360 · 390 · 414 · 480 · 600 · 768 · 900 · 1024 · 1280 · 1440 · 1920');
    if (!ok) {
      var all = document.querySelectorAll('body *');
      for (var i = 0, shown = 0; i < all.length && shown < 8; i++) {
        var r = all[i].getBoundingClientRect();
        if (r.width && r.right > vw + 1) {
          var parent = all[i].parentElement;
          if (parent && parent.getBoundingClientRect().right > vw + 1) continue;
          console.log('      ' + path(all[i]));
          shown++;
        }
      }
    }
    return ok;
  }

  window.__craft = { report: report, summary: summary, run: run, check: report, widths: widths };
  console.log(
    '%c craft audit ready %c  __craft.report() · __craft.summary() · __craft.widths()',
    'background:#1F7A4D;color:#fff;border-radius:3px;padding:2px 6px',
    'color:#6B7F75'
  );
})();
