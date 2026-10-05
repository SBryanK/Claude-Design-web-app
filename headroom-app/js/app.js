/* ============================================================================
   Headroom — application shell
   Builds the sidebar, runs the router, and hosts the assistant.

   The sidebar is light ground, not a dark rail: the scene this product lives in
   is a daylit office, and a heavy black column would make a morning reading
   task feel like an operations console.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR;
  var ui = HR.ui, el = HR.el, iconHTML = HR.iconHTML;

  /* Whether the boot loop yields on a timer or on an animation frame. It must be
     a timer: a frame-scheduled loop stops dead in a background tab, in a headless
     render and in an off-screen frame, and the app would never leave its loading
     screen. Declared as a value so the self-test can assert it. */
  var BOOT_SCHEDULER = 'timeout';
  var navListenerCount = 0;

  var NAV = [
    { id: 'portfolio', label: 'Portfolio', ico: 'portfolio' },
    { id: 'customers', label: 'Customers', ico: 'customers', count: function (p) { return p.groupCount; } },
    { id: 'radar', label: 'External radar', ico: 'radar' },
    { id: 'performance', label: 'Model performance', ico: 'model' },
    { id: 'thresholds', label: 'Thresholds', ico: 'sliders' },
    { id: 'methodology', label: 'Methodology', ico: 'database' }
  ];

  /* ------------------------------------------------------------ brand mark --
     A rise traced across contour rings: the product's one idea, drawn once. */
  function brandMark(size) {
    var s = size || 36;
    return el('div', {
      class: 'brand-mark', style: { width: s + 'px', height: s + 'px', flex: '0 0 ' + s + 'px' },
      html:
        '<svg viewBox="0 0 44 44" fill="none" aria-hidden="true" width="' + s + '" height="' + s + '">' +
        '<circle cx="22" cy="22" r="20" stroke="#1F7A4D" stroke-width="1.5" opacity=".26"/>' +
        '<circle cx="22" cy="22" r="14.5" stroke="#1F7A4D" stroke-width="1.2" opacity=".42"/>' +
        '<circle cx="22" cy="22" r="9" stroke="#1F7A4D" stroke-width="1.2" opacity=".62"/>' +
        '<path d="M6 30.5c4.5-1.6 7.4-5 9.6-9.6C17.8 16.4 21 12.6 26 11" stroke="#1F7A4D" ' +
        'stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
        '<circle cx="26" cy="11" r="3.2" fill="#E8543A"/>' +
        '</svg>'
    });
  }

  /* --------------------------------------------------------------- sidebar -- */

  function buildSidebar() {
    var p = HR.engine.portfolio();
    var here = ui.currentHash().route;

    var nav = el('nav', { class: 'nav', 'aria-label': 'Sections' }, NAV.map(function (item) {
      var count = item.count ? item.count(p) : null;
      var active = here === item.id || (here === 'customer' && item.id === 'customers');
      return el('a', {
        class: 'nav-item', href: '#/' + item.id,
        'aria-current': active ? 'page' : null
      }, [
        el('span', { class: 'nav-ico', html: iconHTML(item.ico, 18) }),
        el('span', { class: 'nav-label', text: item.label }),
        count ? el('span', { class: 'nav-count', text: String(count) }) : null
      ]);
    }));

    var sidebar = el('aside', { class: 'sidebar', id: 'sidebar' }, [
      el('div', { class: 'brand' }, [
        brandMark(36),
        el('div', {}, [
          el('div', { class: 'brand-name', text: 'Headroom' }),
          el('div', { class: 'brand-sub', text: 'Jabil credit early warning' })
        ])
      ]),
      /* Only shown below 1024px, where the rail becomes a top bar. */
      el('button', {
        class: 'nav-toggle', type: 'button', id: 'navToggle',
        'aria-expanded': 'false', 'aria-controls': 'sidebarNav', 'aria-label': 'Show sections',
        html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
              'stroke-width="1.9" stroke-linecap="round" aria-hidden="true">' +
              '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>'
      }),
      nav,
      el('div', { class: 'nav-sep' }),
      el('button', {
        class: 'ask-btn', type: 'button',
        onClick: function () { HR.assistant.open(); }
      }, [
        el('span', { class: 'nav-ico', style: { color: 'var(--teal)' }, html: iconHTML('sparkles', 18) }),
        el('span', { class: 'nav-label', text: 'Ask Headroom' })
      ]),
      el('div', { class: 'sidebar-foot' }, [
        el('div', { class: 'sheet-note', html:
          '<b>Advisory only.</b> Headroom suggests; people decide. It never changes a limit and never holds an order.' }),
        el('div', { class: 'sheet-note', style: { marginTop: 'var(--s3)', borderTop: 'none', paddingTop: '0' }, html:
          '<b>Prototype.</b> Every customer and number on every screen is invented.' }),
        el('div', { class: 'freshness' }, [
          el('span', { class: 'dot' }),
          el('span', { id: 'freshness-text', text: 'SAP loaded nightly, ' + HR.dateFull(HR.data.AS_OF) })
        ])
      ])
    ]);

    /* Only element-scoped listeners here. Anything bound to `document` would be
       added again on every navigation — this function runs on every route change
       — and the listeners would pile up for the life of the page. The two global
       ones live in boot(), bound once. */
    var toggle = sidebar.querySelector('#navToggle');
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setSidebarNav(!sidebar.classList.contains('nav-open'));
    });
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.nav-item')) setSidebarNav(false);
    });

    return sidebar;
  }

  /** Open or close the narrow-viewport navigation on the current sidebar. */
  function setSidebarNav(open) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    var toggle = sidebar.querySelector('#navToggle');
    sidebar.classList.toggle('nav-open', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Hide sections' : 'Show sections');
    }
  }

  /* Exposed for the self-test. These are declarations the test can read and
     assert on, rather than the test having to reach into private scope. */
  HR.__buildSidebar = buildSidebar;
  HR.__mount = function () { mount(); };
  HR.__resetNavListeners = function () { navListenerCount = 0; };
  /* How many listeners the shell has bound to `document`. Bound once, in boot. */
  HR.__navListenerCount = function () { return navListenerCount; };
  HR.__bootScheduler = BOOT_SCHEDULER;

  /* ---------------------------------------------------------------- router -- */

  function mount() {
    var h = ui.currentHash();
    var view = HR.screens[h.route] || HR.screens.portfolio;
    document.title = (view.title || 'Headroom') + ' · Headroom — Jabil credit early warning';

    var main = document.querySelector('.main');
    if (!main) return;

    HR.tip.hide();
    var old = document.querySelector('.sidebar');
    old.parentNode.replaceChild(buildSidebar(), old);

    var node;
    try {
      node = view.render({ arg: h.arg, route: h.route });
    } catch (err) {
      node = el('div', { class: 'view' }, [
        ui.masthead({ title: 'This screen could not be drawn', sub: String((err && err.message) || err) }),
        ui.panel({ title: 'Recover' }, el('div', {}, [
          el('p', { class: 'small muted mb-16', text: 'The rest of the application still works. This is a prototype, so please note which screen you were on.' }),
          ui.button('Back to the portfolio', { variant: 'primary', ico: 'portfolio', onClick: function () { ui.go('portfolio'); } })
        ]))
      ]);
      if (global.console) console.error('[Headroom] view failed:', err);
    }

    var oldView = main.querySelector('.view');
    if (oldView) main.replaceChild(node, oldView); else main.appendChild(node);
    main.scrollTop = 0;
  }

  /* ------------------------------------------------------------------ boot -- */

  function bootScreen() {
    var bar = el('div', { class: 'boot-bar' });
    var msg = el('div', { class: 'boot-msg', text: 'Generating the illustrative portfolio…' });
    var node = el('div', { class: 'boot' }, el('div', { class: 'boot-inner' }, [
      el('div', { class: 'boot-mark', html: brandMark(60).innerHTML }),
      el('div', { class: 'boot-name', text: 'Headroom' }),
      el('div', { class: 'boot-sub', text: 'Jabil credit early warning' }),
      el('div', { class: 'boot-track' }, bar),
      msg
    ]));
    return {
      node: node,
      set: function (f, text) {
        /* Transform, not width: this runs while every customer is being fitted,
           and a layout-triggering property here competes with the work itself. */
        bar.style.transform = 'scaleX(' + HR.clamp(f, 0, 1).toFixed(3) + ')';
        if (text) msg.textContent = text;
      },
      done: function () { node.remove(); }
    };
  }

  /**
   * The first read of the book runs a simulation for every customer, which takes
   * about a second. It is sliced so the progress bar paints and a slow machine
   * shows movement instead of appearing to hang.
   *
   * The slices are scheduled with setTimeout, NOT requestAnimationFrame. A
   * frame-scheduled loop stops dead whenever frames stop being produced — a
   * background tab, a headless render, an off-screen iframe, a throttled
   * compositor — and the app would sit on its loading screen forever. A timer
   * keeps running in all of those, and the browser still repaints between
   * macrotasks, so the progress bar animates exactly as before.
   */
  function boot() {
    if (!document.querySelector('.toasts')) document.body.appendChild(el('div', { class: 'toasts' }));

    var root = document.getElementById('app');
    var boot = bootScreen();
    document.body.appendChild(boot.node);

    var groups = HR.data.GROUPS;
    var index = 0;
    var t0 = (global.performance && performance.now()) || Date.now();

    function step() {
      var sliceStart = (global.performance && performance.now()) || Date.now();
      while (index < groups.length) {
        HR.engine.measure(groups[index]);
        index++;
        if (((global.performance && performance.now()) || Date.now()) - sliceStart > 12) break;
      }
      var fraction = index / groups.length;
      boot.set(0.12 + fraction * 0.82, index < groups.length
        ? 'Fitting the exposure runway — ' + index + ' of ' + groups.length + ' customer groups…'
        : 'Scoring the book against the current CMD rule…');

      if (index < groups.length) { global.setTimeout(step, 0); return; }

      root.appendChild(buildSidebar());
      root.appendChild(el('main', { class: 'main', id: 'main' }));
      global.setTimeout(function () {
        mount();
        boot.set(1, 'Ready');
        boot.done();
        finished = true;
        var ms = ((global.performance && performance.now()) || Date.now()) - t0;
        if (global.console && console.info) {
          console.info('[Headroom] measured ' + HR.data.GROUPS.length + ' groups × ' +
            HR.engine.PATHS + ' futures in ' + Math.round(ms) + ' ms');
        }
      }, 0);
    }

    /* A last-resort watchdog. If anything at all stops the slices — an exotic
       timer clamp, a suspended page resumed without callbacks — the app still
       reaches a usable state rather than staying on the loading screen. */
    var finished = false;
    function forceFinish() {
      if (finished) return;
      if (index < groups.length) { while (index < groups.length) { HR.engine.measure(groups[index]); index++; } }
      if (!document.querySelector('.sidebar')) {
        root.appendChild(buildSidebar());
        root.appendChild(el('main', { class: 'main', id: 'main' }));
        mount();
      }
      boot.done();
      finished = true;
      if (global.console && console.warn) console.warn('[Headroom] boot finished via the watchdog');
    }
    global.setTimeout(forceFinish, 12000);
    document.addEventListener('visibilitychange', function () {
      /* Coming back to a tab that was throttled: finish immediately. */
      if (!document.hidden) global.setTimeout(function () { if (!finished) forceFinish(); }, 60);
    });

    global.setTimeout(step, 0);

    /* ---- global wiring ---- */
    global.addEventListener('hashchange', mount);

    document.addEventListener('keydown', function (e) {
      var typing = /input|textarea|select/i.test((e.target.tagName || ''));
      if (e.key === 'Escape' && HR.assistant.isOpen()) HR.assistant.close();
      if (e.key === '/' && !typing) {
        var s = document.querySelector('input[type="search"]');
        if (s) { e.preventDefault(); s.focus(); }
      }
      if (/^[1-6]$/.test(e.key) && !typing && !e.metaKey && !e.ctrlKey) {
        var target = NAV[parseInt(e.key, 10) - 1];
        if (target) { e.preventDefault(); ui.go(target.id); }
      }
    });

    HR.store.on('decision', mount);
    HR.store.on('reset', mount);

    /* Bound once for the life of the page, reading whichever sidebar is current. */
    document.addEventListener('click', function (e) {
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('nav-open') && !sidebar.contains(e.target)) {
        setSidebarNav(false);
      }
    });
    navListenerCount++;
    document.addEventListener('keydown', function (e) {
      var sidebar = document.getElementById('sidebar');
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('nav-open')) {
        setSidebarNav(false);
        var t = sidebar.querySelector('#navToggle');
        if (t) t.focus();
      }
    });
    navListenerCount++;

    setInterval(function () {
      var n = document.getElementById('freshness-text');
      if (n) n.textContent = 'SAP loaded nightly, ' + HR.dateFull(HR.data.AS_OF);
    }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
