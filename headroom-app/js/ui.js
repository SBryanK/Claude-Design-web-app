/* ============================================================================
   Headroom — shared interface pieces

   The vocabulary is the survey sheet's: panels, a masthead, a field key, banded
   rules, and entries. There is deliberately no "metric tile" component, because
   a row of equal-weight big-number cards is the dashboard default this world
   exists to refuse — figures live inside the thing they describe.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR = global.HR || {};
  var el = HR.el, iconHTML = HR.iconHTML;

  var ui = HR.ui = {};

  /* ------------------------------------------------------------- fragments */

  ui.ico = function (name, size) { return iconHTML(name, size); };

  /** A panel. `body` may be a node, a string, or an array. */
  ui.panel = function (opts, body) {
    opts = opts || {};
    var head = null;
    if (opts.title || opts.right) {
      head = el('div', { class: 'panel-head' + (opts.right ? ' panel-head-row' : '') }, [
        el('div', {}, [
          opts.title ? el('h2', { class: 'panel-title', text: opts.title }) : null,
          opts.sub ? el('p', { class: 'panel-sub', text: opts.sub }) : null
        ]),
        opts.right || null
      ]);
    }
    return el('div', {
      class: 'panel' + (opts.tone ? ' ' + opts.tone : '') + (opts.class ? ' ' + opts.class : '')
    }, [head, body]);
  };

  /**
   * The map sheet's title block. Carries the subject, a one-line description,
   * and the survey parameters the surface is drawn under — no eyebrow label
   * above the heading, because the heading is doing that work.
   */
  ui.masthead = function (opts) {
    var meta = el('div', { class: 'masthead-meta' });
    (opts.data || []).forEach(function (d) {
      meta.appendChild(el('span', { class: 'datum' }, [
        el('span', { text: d[0] }), el('b', { text: d[1] })
      ]));
    });
    if (opts.actions) meta.appendChild(el('div', { class: 'masthead-actions' }, opts.actions));
    return el('header', { class: 'masthead' }, [
      el('h1', { class: 'masthead-title', text: opts.title }),
      opts.sub ? el('p', { class: 'masthead-sub', text: opts.sub }) : null,
      meta.childNodes.length ? meta : null
    ]);
  };

  /** The "as of" data every screen declares. */
  ui.asOf = function (extra) {
    var p = HR.engine.portfolio();
    var t = HR.store.thresholds;
    var out = [
      ['As of', HR.dateFull(p.asOf)],
      ['Horizon', 'next 90 days'],
      ['Zones at', HR.pct(t.breachProb) + ' breach / ' + HR.pct(t.worsenProb) + ' worsening']
    ];
    (extra || []).forEach(function (x) { out.push(x); });
    return out;
  };

  ui.stamp = function (text) {
    /* ui.ico() returns markup; it has to go in as `html`, not as a child, or it
       lands on the page as literal "<svg …>" text. */
    return el('span', { class: 'sheet-stamp' }, [
      el('span', { html: ui.ico('info', 12), style: { display: 'flex' } }),
      el('span', { text: text })
    ]);
  };

  /**
   * The map's own furniture: a scale bar and key. This is where portfolio
   * totals live — read as survey annotation rather than as metric tiles.
   * `cells` is [[label, value, note?, colour?], …].
   */
  ui.fieldKey = function (cells) {
    return el('div', { class: 'field-key' }, cells.map(function (c) {
      return el('div', { class: 'key-cell' }, [
        el('div', { class: 'key-label', text: c[0] }),
        el('div', { class: 'key-value', style: c[3] ? { color: c[3] } : null, text: c[1] }),
        c[2] ? el('div', { class: 'key-note', text: c[2] }) : null
      ]);
    }));
  };

  /** A figure sitting inline inside the thing it describes. Not a tile. */
  ui.readout = function (value, caption, tone) {
    return el('div', { class: 'readout' }, [
      el('span', { class: 'readout-v', style: tone ? { color: tone } : null, text: value }),
      caption ? el('span', { class: 'readout-d', text: caption }) : null
    ]);
  };

  /* --------------------------------------------------------------- badges -- */

  ui.zonePill = function (zone) {
    var key = String(zone).toLowerCase().replace(/\s+/g, '');
    var map = { actnow: 'pill-act', watch: 'pill-watch', growth: 'pill-growth', clear: 'pill-clear' };
    return el('span', { class: 'pill ' + (map[key] || 'pill-plain'), text: zone });
  };

  ui.statusPill = function (status) {
    var map = {
      Alert: 'pill-alert', Watch: 'pill-watch', Normal: 'pill-normal',
      Pass: 'pill-pass', Partly: 'pill-partly', Fail: 'pill-fail'
    };
    return el('span', { class: 'pill ' + (map[status] || 'pill-plain'), text: status });
  };

  ui.tierPill = function (tier) {
    var map = { A: 'pill-tiera', B: 'pill-tierb', C: 'pill-tierc' };
    return el('span', { class: 'pill ' + (map[tier] || 'pill-plain'), text: 'Tier ' + tier });
  };

  HR.TAG_LEGEND = {
    B: { label: "named in Jabil's project description" },
    C: { label: 'to confirm with Jabil' },
    P: { label: 'public source' },
    N: { label: 'new data the tool creates' }
  };

  ui.tag = function (key) {
    return el('span', { class: 'tag tag-' + key, title: (HR.TAG_LEGEND[key] || {}).label || '', text: key });
  };

  ui.tagLegend = function (keys) {
    return el('div', { class: 'tag-legend' }, (keys || ['B', 'C', 'P', 'N']).map(function (k) {
      return el('span', {}, [ui.tag(k), el('span', { text: HR.TAG_LEGEND[k].label })]);
    }));
  };

  /** The zone legend, doubling the terrain's own colours. */
  ui.zoneKey = function () {
    return el('div', { class: 'zone-key' }, [
      ['act', 'Act now'], ['watch', 'Watch'], ['growth', 'Growth'], ['clear', 'Clear']
    ].map(function (z) {
      return el('span', { class: 'zone-key-item' }, [
        el('span', { class: 'zone-swatch ' + z[0] }), el('span', { text: z[1] })
      ]);
    }));
  };

  /* ---------------------------------------------------------------- bands -- */

  /** A measured rule, drawn like a survey band rather than a progress bar. */
  ui.band = function (fraction, zone) {
    var f = HR.clamp(fraction, 0, 1);
    var tone = zone === 'Act now' ? 'act' : zone === 'Watch' ? 'watch' : zone === 'Growth' ? 'growth' : '';
    return el('div', { class: 'band' + (tone ? ' ' + tone : ''), role: 'img', 'aria-label': HR.pct(f) },
      [el('i', { style: { width: (f * 100).toFixed(1) + '%' } })]);
  };

  /* -------------------------------------------------- definition / values -- */

  ui.defs = function (items) {
    return el('dl', { class: 'defs' }, items.map(function (pair) {
      return el('div', { class: 'def' }, [
        el('dt', { text: pair[0] }),
        el('dd', { html: pair[1] })
      ]);
    }));
  };

  ui.kv = function (label, value, opts) {
    opts = opts || {};
    return el('div', { class: 'kv' }, [
      el('dt', { html: label }),
      el('dd', { class: opts.big ? 'big' : '', html: value })
    ]);
  };

  ui.note = function (tone, html) {
    return el('div', { class: 'note note-' + (tone || 'wash'), html: html });
  };

  ui.empty = function (title, body, ico) {
    return el('div', { class: 'empty' }, [
      el('div', { html: iconHTML(ico || 'search', 32) }),
      el('div', { class: 'empty-title', text: title }),
      body ? el('div', { class: 'small', text: body }) : null
    ]);
  };

  /* --------------------------------------------------------------- tables -- */

  ui.table = function (cols, rows, opts) {
    opts = opts || {};
    var sortKey = opts.sortKey || null, sortDir = opts.sortDir || -1;

    var thead = el('thead', {}, el('tr', {}, cols.map(function (c) {
      var sortable = !!(c.sortValue && opts.onSort);
      var attrs = {
        class: (c.align === 'right' ? 'r ' : c.align === 'center' ? 'c ' : '') + (sortable ? 'sortable' : '')
      };
      if (c.width) attrs.style = { width: c.width };
      if (sortKey === c.key) attrs['aria-sort'] = sortDir === -1 ? 'descending' : 'ascending';
      if (sortable) {
        attrs.onclick = function () {
          if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = -1; }
          opts.onSort(sortKey, sortDir);
        };
      }
      return el('th', attrs, [
        el('span', { text: c.label }),
        sortable ? el('span', { class: 'arrow', text: sortKey === c.key ? (sortDir === -1 ? '▼' : '▲') : '▼' }) : null
      ]);
    })));

    var data = rows.slice();
    if (sortKey && !opts.onSort) {
      var col = cols.filter(function (c) { return c.key === sortKey; })[0];
      if (col && col.sortValue) {
        data.sort(function (a, b) {
          var x = col.sortValue(a), y = col.sortValue(b);
          if (typeof x === 'string') return sortDir * x.localeCompare(y);
          return sortDir * ((x || 0) - (y || 0));
        });
      }
    }

    var tbody = el('tbody', {}, data.map(function (r) {
      var tr = el('tr', { class: opts.onRowClick ? 'click' : '' }, cols.map(function (c) {
        var raw = c.render ? c.render(r) : r[c.key];
        /* A cell may hold a DOM node — from the column's render function or
           stored directly on the row. Both append; neither stringifies. The
           test is duck-typed because `instanceof Node` is not reliable across
           realms, and when it fails the cell renders "[object HTMLSpanElement]". */
        var isNode = raw && typeof raw === 'object' && typeof raw.nodeType === 'number';
        return el('td', { class: c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : '' },
          isNode ? raw : String(raw === null || raw === undefined ? '' : raw));
      }));
      if (opts.onRowClick) {
        tr.tabIndex = 0;
        tr.addEventListener('click', function () { opts.onRowClick(r); });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onRowClick(r); }
        });
      }
      return tr;
    }));

    return el('div', { class: 'table-scroll' + (opts.inset ? ' inset' : '') },
      el('table', { class: 'tbl' + (opts.compact ? ' tight' : '') }, [thead, tbody]));
  };

  /* ------------------------------------------------------------- controls -- */

  ui.button = function (label, opts) {
    opts = opts || {};
    return el('button', {
      class: 'btn' + (opts.variant ? ' ' + opts.variant : '') + (opts.small ? ' sm' : ''),
      type: 'button', onclick: opts.onClick, disabled: opts.disabled, title: opts.title
    }, [
      opts.ico ? el('span', { html: iconHTML(opts.ico, 15), style: { display: 'flex' } }) : null,
      el('span', { text: label })
    ]);
  };

  ui.segmented = function (options, active, onChange) {
    return el('div', { class: 'seg', role: 'group' }, options.map(function (o) {
      return el('button', {
        type: 'button', 'aria-pressed': String(o.value === active),
        onclick: function () { onChange(o.value); }, text: o.label
      });
    }));
  };

  /* ------------------------------------------------------------- routing --- */

  ui.currentHash = function () {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { route: parts[0] || 'portfolio', arg: parts[1] || null };
  };

  ui.go = function (route, arg) {
    location.hash = '#/' + route + (arg ? '/' + arg : '');
  };

  /* -------------------------------------------------------------- outputs -- */

  ui.copy = function (text, label) {
    var done = function () { HR.toast((label || 'Copied') + ' to the clipboard'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { HR.toast('Could not copy', 'honey'); });
    } else {
      var ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { HR.toast('Could not copy', 'honey'); }
      ta.remove();
    }
  };

  ui.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
  };

  ui.toCSV = function (headers, rows) {
    var esc = function (v) {
      var s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [headers.map(esc).join(',')]
      .concat(rows.map(function (r) { return r.map(esc).join(','); })).join('\n');
  };

  /* ------------------------------------------------ the shared row shape -- */

  /**
   * One watchlist entry. `moved` lights the row until it is acknowledged — the
   * gate-board idea, which is the one thing a moving list must do: a row that
   * changes place has to announce that it changed.
   */
  ui.entry = function (opts) {
    var node = el('li', {
      class: 'entry' + (opts.moved ? ' moved' : ''),
      tabindex: '0', role: 'button',
      'aria-label': opts.name + ', ' + opts.zone + ', ' + opts.figs
    }, [
      el('div', { class: 'entry-rank', text: opts.rank }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'row gap-8 wrap' }, [
          el('span', { class: 'entry-title', text: opts.name }),
          ui.zonePill(opts.zone),
          opts.tag || null
        ]),
        el('p', { class: 'entry-why', text: opts.why }),
        el('div', { class: 'entry-figs', html: opts.figs }),
        opts.band !== undefined
          ? el('div', { class: 'mt-8', style: { maxWidth: '230px' } }, ui.band(opts.band, opts.zone))
          : null
      ])
    ]);
    if (opts.onClick) {
      node.addEventListener('click', opts.onClick);
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(); }
      });
    }
    return node;
  };

  /** The reason rows behind a score, each carrying its own contribution. */
  ui.reasonRows = function (drivers) {
    var max = Math.max.apply(null, drivers.map(function (d) { return Math.abs(d.points); }).concat([1]));
    return el('div', {}, drivers.map(function (d) {
      var pos = d.points >= 0;
      return el('div', {
        class: 'kv',
        style: { gridTemplateColumns: 'minmax(0,1fr) minmax(50px,110px) 60px', alignItems: 'center', gap: '12px' }
      }, [
        el('dt', {}, [
          el('div', { style: { color: 'var(--ink)' }, text: d.text }),
          el('div', { class: 'tiny faint', text: d.label + (d.display ? ' · ' + d.display : '') })
        ]),
        el('div', { class: 'band', style: { background: 'transparent' } }, [
          el('i', {
            style: {
              width: (Math.abs(d.points) / max * 100).toFixed(1) + '%',
              background: pos ? 'var(--honey-mid)' : 'var(--ridge)'
            }
          })
        ]),
        el('span', {
          class: 'strong num',
          style: { textAlign: 'right', color: pos ? 'var(--honey)' : 'var(--forest)' },
          text: HR.signed(Math.round(d.points * 10) / 10)
        })
      ]);
    }));
  };

  ui.miniTrend = function (series, opts) {
    opts = opts || {};
    return HR.charts.sparkline({
      width: opts.width || 116, height: opts.height || 30,
      values: series,
      color: opts.color || '#1F7A4D',
      fill: true,
      band: opts.band
    });
  };
})(window);
