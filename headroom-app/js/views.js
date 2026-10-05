/* ============================================================================
   Headroom — screens

   Composition rule for every screen here: the first viewport IS the answer.
   The portfolio opens on the terrain and the ranked list at full size, because
   "who needs attention this week" is the question — not a row of totals about
   the question. Figures live inside the thing they describe.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR;
  var ui = HR.ui, el = HR.el, iconHTML = HR.iconHTML;
  var charts = HR.charts;

  var views = HR.screens = {};

  /* --------------------------------------------------------------- helpers */

  function movedIds() {
    var set = {};
    HR.engine.moves().forEach(function (x) { set[x.m.group.id] = x; });
    return set;
  }

  function breachWhen(m) {
    if (!m.breachDate) return 'no crossing inside the horizon';
    var days = HR.daysBetween(HR.data.AS_OF, m.breachDate);
    return HR.dateShort(m.breachDate) + (days >= 0 ? ', in ' + days + ' days' : '');
  }

  function whyLine(m) {
    var top = m.breachDrivers.slice().sort(function (a, b) { return b.points - a.points; })
      .filter(function (d) { return d.points > 0; })[0];
    if (!top) return 'Nothing standing out. Re-checked automatically tomorrow morning.';
    return top.text + '.';
  }

  function figsFor(m, extra) {
    return [
      'Breach <b>' + HR.pct(m.breachChance) + '</b>',
      'Worsening <b>' + HR.pct(m.worsenChance) + '</b>',
      'Exposure <b>' + HR.usd(m.exposure) + '</b>'
    ].concat(extra || []).join(' &nbsp;·&nbsp; ');
  }

  /* =============================================================== PORTFOLIO */

  views.portfolio = {
    id: 'portfolio',
    nav: 'Portfolio',
    navIco: 'portfolio',
    title: 'Portfolio',

    render: function () {
      var p = HR.engine.portfolio();
      var b = HR.engine.briefing();
      var moved = movedIds();
      var root = el('div', { class: 'view' });

      root.appendChild(ui.masthead({
        title: 'Portfolio',
        sub: 'Which customers need attention this week, and why. Every group is placed on the field by how soon ' +
          'a breach may come and how fast its risk is rising; the contours show where exposure concentrates.',
        data: ui.asOf(),
        actions: [ui.stamp('Illustrative: invented customers and numbers')]
      }));

      /* ---- the terrain and the answer, side by side, both at full size ---- */
      var main = el('div', { class: 'grid g-field mb-16' });

      var mapPanel = ui.panel({
        title: 'Credit weather map',
        sub: 'Click any group to open it. The contour lines are computed from this book — they are where exposure ' +
          'actually concentrates, not decoration.'
      });
      mapPanel.appendChild(HR.terrain.field({
        width: 880, height: 570,
        points: p.rows.map(function (m) {
          return {
            id: m.group.id, code: m.group.code, name: m.group.name,
            x: m.breachChance, y: m.worsenChance, size: m.exposure, zone: m.zone,
            breach: m.breachChance, worsen: m.worsenChance, why: whyLine(m)
          };
        }),
        thresholds: HR.store.thresholds,
        onSelect: function (id) { ui.go('customer', id); }
      }));
      /* The map's own key and scale bar — where the portfolio totals live. */
      mapPanel.appendChild(ui.fieldKey([
        ['Groups', String(p.groupCount), 'monitored every morning'],
        ['Exposure', HR.usd(p.totalExposure), 'across the book'],
        ['Act now', String(p.counts['Act now']), HR.usd(p.inActExposure), 'var(--coral-ink)'],
        ['Watch', String(p.counts['Watch']), 'risk rising, room left', 'var(--honey-ink)'],
        ['Moved', String(b.moves.length), 'changed zone this week', 'var(--teal-ink)']
      ]));
      mapPanel.appendChild(el('div', { class: 'between wrap mt-16' }, [
        ui.zoneKey(),
        el('span', { class: 'tiny faint', text: 'Dot size = exposure' })
      ]));
      main.appendChild(mapPanel);

      /* The ranked list. Rows that changed zone stay lit until they are read. */
      var listPanel = ui.panel({
        title: 'Who needs attention',
        sub: 'Ranked by chance of worsening × money at risk, capped at ' + HR.store.thresholds.watchlistCap + ' names.',
        right: ui.button('Export', {
          small: true, ico: 'download', onClick: function () {
            ui.download('headroom-watchlist.csv', ui.toCSV(
              ['Rank', 'Customer group', 'Zone', 'Breach chance', 'Worsening chance', 'Exposure USD m', 'Ranking value USD m', 'Why'],
              p.watchlist.map(function (m, i) {
                return [i + 1, m.group.name, m.zone, HR.pct(m.breachChance), HR.pct(m.worsenChance),
                  Math.round(m.exposure), Math.round(m.rankValue), whyLine(m)];
              })));
          }
        })
      });
      var list = el('ul', { style: { margin: '0 -8px' } });
      p.watchlist.forEach(function (m, i) {
        list.appendChild(ui.entry({
          rank: String(i + 1),
          name: m.group.name,
          zone: m.zone,
          moved: !!moved[m.group.id],
          tag: moved[m.group.id]
            ? el('span', { class: 'pill pill-teal', text: 'moved from ' + moved[m.group.id].from })
            : null,
          why: whyLine(m),
          figs: figsFor(m, ['likely ' + breachWhen(m)]),
          band: m.breachChance,
          onClick: function () { ui.go('customer', m.group.id); }
        }));
      });
      listPanel.appendChild(list);
      var clearRows = p.byZone['Clear'];
      listPanel.appendChild(el('div', { class: 'note note-wash mt-12', html:
        '<b>' + clearRows.length + ' further groups are Clear</b>, holding ' +
        HR.usd(HR.sum(clearRows, function (x) { return x.exposure; })) +
        ' of exposure. No action this week; they are re-checked every morning.' }));
      main.appendChild(listPanel);
      root.appendChild(main);

      /* ---- the briefing, and what moved ---- */
      var lower = el('div', { class: 'grid g-two' });

      var brief = ui.panel({
        title: 'Weekly briefing',
        sub: 'Written only from the numbers on this page. Every figure is checked against the model output before release.',
        right: ui.button('Copy', {
          small: true, ico: 'file', onClick: function () { ui.copy(b.sentences.join('\n\n'), 'Briefing'); }
        })
      });
      brief.appendChild(el('p', { class: 'lede mb-16', text: b.sentences.join(' ') }));
      brief.appendChild(el('div', { class: 'note note-wash' }, [
        el('div', {
          class: 'tiny strong mb-8',
          style: { letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' },
          text: 'Number check'
        }),
        el('div', { class: 'grid g-three', style: { gap: 'var(--s3)' } }, b.checkedFigures.map(function (f) {
          return el('div', {}, [
            el('div', { class: 'tiny faint', text: f.label }),
            el('div', { class: 'strong num', text: f.value })
          ]);
        }))
      ]));
      brief.appendChild(el('div', { class: 'between tiny faint mt-12' }, [
        el('span', { text: 'Generated ' + HR.dateFull(b.generatedAt) }),
        el('span', { text: 'Next credit review ' + HR.dateFull(b.nextReview) })
      ]));
      lower.appendChild(brief);

      var movesPanel = ui.panel({
        title: 'Moves this week',
        sub: 'The same customers, scored the same way, against last week\u2019s readings.'
      });
      if (!b.moves.length) {
        movesPanel.appendChild(ui.empty('No group changed zone this week', 'The book is where it was last Monday.', 'check'));
      } else {
        var mv = el('ul', { style: { margin: '0 -8px' } });
        b.moves.slice(0, 7).forEach(function (x) {
          mv.appendChild(ui.entry({
            rank: '',
            name: x.m.group.name,
            zone: x.to,
            moved: true,
            tag: el('span', { class: 'row gap-6' }, [
              ui.zonePill(x.from), el('span', { class: 'faint', text: '→' }), ui.zonePill(x.to)
            ]),
            why: whyLine(x.m),
            figs: figsFor(x.m),
            onClick: function () { ui.go('customer', x.m.group.id); }
          }));
        });
        movesPanel.appendChild(mv);
      }
      movesPanel.appendChild(el('div', { class: 'note note-honey mt-12', html:
        '<b>Advice only.</b> Headroom suggests; the credit team decides. It never changes a limit and never holds an order.' }));
      lower.appendChild(movesPanel);
      root.appendChild(lower);

      return root;
    }
  };

  /* ================================================================ CUSTOMER */

  views.customer = {
    id: 'customer',
    nav: 'Customers',
    navIco: 'customers',
    title: 'Customer',

    render: function (ctx) {
      var p = HR.engine.portfolio();
      var m = ctx.arg ? HR.engine.find(ctx.arg) : null;
      if (!m) return customerList(p);

      var g = m.group, f = m.forecast;
      var root = el('div', { class: 'view' });

      root.appendChild(ui.masthead({
        title: g.name,
        sub: g.sector + ' · ' + g.region + ' · SAP ' + g.sapCodes.join(', ') + ' · legal entity ' + g.legalName,
        data: ui.asOf(),
        actions: [
          ui.zonePill(m.zone),
          ui.button('All customers', { small: true, ico: 'customers', onClick: function () { ui.go('customers'); } })
        ]
      }));

      /* ---- the runway, and what the exposure is made of ---- */
      var top = el('div', { class: 'grid g-detail mb-16' });

      var runway = ui.panel({
        title: 'Exposure runway',
        sub: HR.engine.PATHS + ' simulated futures from scheduled deliveries, invoice due dates and this customer\u2019s ' +
          'own payment delays. ' + HR.pct(m.breachChance) + ' of them pass the limit at least once. ' + runwayCaption(f)
      });
      runway.appendChild(charts.fanChart({
        width: 840, height: 420,
        start: HR.data.AS_OF, end: HR.addDays(HR.data.AS_OF, HR.engine.HORIZON),
        limit: g.limit, median: f.median, band: f.band, straightLine: f.straight,
        breachDate: m.breachDate, breachValue: m.breachDate ? g.limit : null,
        peakDate: f.peakMedianDate, peakValue: f.peakMedian, today: HR.data.AS_OF
      }));
      runway.appendChild(el('div', { class: 'row gap-16 wrap mt-8 tiny muted' }, [
        el('span', {}, [el('span', { style: { color: 'var(--forest)' }, text: '▬ ' }), el('span', { text: 'Median path — the line to read' })]),
        el('span', {}, [el('span', { style: { color: 'var(--ridge)' }, text: '▬ ' }), el('span', { text: 'Middle 80% of futures — how sure we are, not a set of options' })]),
        el('span', {}, [el('span', { style: { color: 'var(--faint)' }, text: '-- ' }), el('span', { text: 'No forecast: today\u2019s exposure held flat' })])
      ]));
      runway.appendChild(el('div', { class: 'row gap-8 mt-8' }, [
        el('span', { class: 'tiny faint', text: f.confidence.label })
      ]));
      runway.appendChild(el('div', { class: 'note note-wash mt-16' }, [
        el('div', {
          class: 'tiny strong mb-8',
          style: { letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' },
          text: 'How the runway was built'
        }),
        ui.defs([
          ['Path centre', HR.usd(f.fitted.intendedEnd) + ' — the order book, aimed at the limit by the chance of breach.'],
          ['Daily drift', (f.fitted.driftPerDay >= 0 ? '+' : '') + HR.round(f.fitted.driftPerDay, 2) + 'm a day, ' +
            HR.usd(Math.abs(f.fitted.driftTotal)) + ' across the horizon.'],
          ['Cash swing', HR.usd(f.fitted.swingUsd) + ' — ' + HR.pct(f.fitted.swingPctOfLimit) +
            ' of the limit, from this customer\u2019s own delay history.'],
          ['Headroom in days', HR.round(f.fitted.headroomDays, 1) + ' days, at ' +
            HR.usd(f.fitted.dailyThroughput) + ' of cash settling each day.']
        ])
      ]));
      top.appendChild(runway);

      var right = el('div', { class: 'stack gap-16' });

      var makeUp = ui.panel({
        title: 'What makes up the exposure',
        sub: 'Stock already built for an open PO is counted once, not twice.'
      });
      makeUp.appendChild(charts.stackedBar({
        width: 440, height: 52, showLabels: true,
        segments: [
          { label: 'Receivables', value: g.receivables, color: '#1F7A4D' },
          { label: 'Dedicated stock', value: g.dedicatedStock, color: '#6FBF8B' },
          { label: 'Open POs, net', value: g.openPOs - g.stockBuiltForPOs, color: '#0E9E93' },
          { label: 'Headroom', value: Math.max(0, m.headroom), color: '#D3EDD8' }
        ]
      }));
      makeUp.appendChild(el('div', { class: 'mt-12' }, [
        ui.kv('Unpaid invoices', HR.usd(g.receivables)),
        ui.kv('Stock built for this customer', HR.usd(g.dedicatedStock)),
        ui.kv('Open POs <span class="faint">(built ' + HR.usd(g.stockBuiltForPOs) + ')</span>', HR.usd(g.openPOs)),
        ui.kv('<b>Exposure</b>', '<b>' + HR.usd(m.exposure) + '</b>', { big: true }),
        ui.kv('Credit limit', HR.usd(g.limit)),
        ui.kv('Headroom', '<span style="color:' + (m.headroom < 0 ? 'var(--neg)' : 'var(--forest)') + '">' + HR.usd(m.headroom) + '</span>')
      ]));
      makeUp.appendChild(el('div', { class: 'note note-wash mt-12 tiny', html:
        'Exposure = receivables + dedicated stock + open POs not yet covered by that stock.' }));
      right.appendChild(makeUp);

      var behave = ui.panel({
        title: 'Against its own normal',
        sub: 'Last 12 weeks. The shaded band is this customer\u2019s usual range — it is never compared with other customers.'
      });
      var b = g.behaviour;
      [
        ['Days late on average', b.daysLateNow, b.daysLateNormal, ' days', b.daysLateSeries],
        ['Overdue share', Math.round(b.overduePct * 100), Math.round(b.overduePctNormal * 100), '%', null],
        ['Short-payments, six weeks', b.shortPays6w, 0.5, '', null],
        ['Open disputes', b.disputesNow, b.disputesNormal, '', null],
        ['Order intake, four weeks', Math.round(g.orders.orderValue4wChange * 100), 0, '%', null],
        ['Stock waiting for orders', g.orders.stockWaitingWeeks, 2, ' weeks', null]
      ].forEach(function (row) {
        var now = row[1], normal = row[2], unit = row[3], series = row[4];
        var isOrder = row[0].indexOf('Order intake') === 0;
        var worse = isOrder
          ? (now > 15 && b.daysLateNow - b.daysLateNormal >= 6)
          : now > normal * 1.4;
        behave.appendChild(el('div', { class: 'kv', style: { alignItems: 'center' } }, [
          el('dt', {}, [
            el('div', { text: row[0] }),
            el('div', { class: 'tiny faint', text: 'its own usual: ' + normal + unit })
          ]),
          el('dd', { class: 'row gap-8', style: { justifyContent: 'flex-end' } }, [
            series ? el('span', { style: { width: '96px' } },
              ui.miniTrend(series, { width: 96, height: 26, band: [normal * 0.7, normal * 1.3] })) : null,
            el('span', { style: { color: worse ? 'var(--honey-ink)' : 'var(--forest)' }, text: now + unit })
          ])
        ]));
      });
      right.appendChild(behave);
      top.appendChild(right);
      root.appendChild(top);

      /* ---- why, and what to do ---- */
      var low = el('div', { class: 'grid g-detail' });

      var why = ui.panel({
        title: 'Why the chance of a breach is ' + HR.pct(m.breachChance),
        sub: 'Base rate ' + HR.pct(m.score.baseRate) + ' for an average customer, plus these drivers in percentage ' +
          'points. Every line is written from the model\u2019s own numbers.'
      });
      why.appendChild(ui.reasonRows(m.breachDrivers));
      why.appendChild(el('div', {
        class: 'kv mt-8',
        style: { borderTop: '1px solid var(--line-2)', borderBottom: 'none', paddingTop: 'var(--s3)' }
      }, [
        el('dt', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: 'Chance of passing the limit in 90 days' }),
        el('dd', { class: 'big', text: HR.pct(m.breachChance) })
      ]));
      why.appendChild(el('div', { class: 'note note-teal mt-16', html:
        '<b>Two different questions.</b> The chance of a breach is about crossing the limit. The chance of ' +
        'worsening is about this customer\u2019s behaviour getting worse and staying worse. A growing customer can ' +
        'score high on the first and low on the second, which is why Growth is its own zone.' }));
      low.appendChild(why);

      var decide = ui.panel({
        title: 'For the analyst to decide',
        sub: 'Suggestions only. Headroom never changes a limit and never holds an order.'
      });
      m.nextSteps.forEach(function (s) {
        decide.appendChild(el('div', { class: 'row-top gap-12', style: { padding: 'var(--s2) 0' } }, [
          el('span', { style: { color: 'var(--teal-ink)', flex: '0 0 auto', marginTop: '1px' }, html: iconHTML(s.ico, 16) }),
          el('span', { class: 'grow', style: { fontSize: '13px' }, text: s.text })
        ]));
      });
      var decided = HR.store.decisionFor(g.id);
      var actions = el('div', { class: 'row gap-8 wrap mt-16' });
      ['Reviewed', 'Escalated to the credit lead', 'No action needed'].forEach(function (action) {
        actions.appendChild(ui.button(action, {
          small: true, variant: decided && decided.action === action ? 'primary' : '',
          onClick: function () { HR.store.decide(g.id, action, ''); }
        }));
      });
      actions.appendChild(ui.button('Add a note', {
        small: true, ico: 'file', onClick: function () {
          var note = global.prompt('Note for the decision log:', (decided && decided.note) || '');
          if (note !== null) HR.store.decide(g.id, (decided && decided.action) || 'Noted', note);
        }
      }));
      actions.appendChild(ui.button('Refresh', {
        small: true, ico: 'refresh', onClick: function () { refreshOne(g); }
      }));
      decide.appendChild(actions);
      if (decided) {
        decide.appendChild(el('div', { class: 'note note-wash mt-12 tiny', html:
          '<b>Logged ' + HR.stamp(new Date(decided.at)) + ':</b> ' + HR.esc(decided.action) +
          (decided.note ? ' — ' + HR.esc(decided.note) : '') }));
      }
      decide.appendChild(el('div', { class: 'note note-wash mt-12 tiny', html:
        '<b>Decision log.</b> Accepting, changing or ignoring a suggestion is recorded, so the ranking can later be ' +
        'checked against what analysts actually did.' }));
      low.appendChild(decide);
      root.appendChild(low);

      return root;
    }
  };

  function runwayCaption(f) {
    var d = f.fitted.driftTotal;
    if (Math.abs(d) < f.limit * 0.01) return 'The order book is not moving exposure much across the horizon.';
    return (d > 0 ? 'Rising ' : 'Falling ') + HR.usd(Math.abs(d)) + ' across the horizon, following the order book.';
  }

  function refreshOne(g) {
    var bar = el('div', { class: 'sweep' }, el('i'));
    document.body.appendChild(bar);
    HR.toast('Re-running the forecast and the score for ' + g.name + '…');
    setTimeout(function () {
      HR.engine.measure(g);
      bar.remove();
      HR.toast('Refreshed: ' + g.name + ' re-scored from the latest copy');
    }, 900);
  }

  /* ----------------------------------------------------------- customer list */

  function customerList(p) {
    var root = el('div', { class: 'view' });
    var state = { q: '', zone: 'All', sortKey: 'rankValue', sortDir: -1 };
    var host = el('div');

    root.appendChild(ui.masthead({
      title: 'Customers',
      sub: p.groupCount + ' customer groups, ranked by money at risk. Click any row to open the customer page.',
      data: ui.asOf(),
      actions: [ui.stamp('Illustrative: invented customers and numbers')]
    }));

    function apply() {
      var rows = p.rows.slice();
      if (state.zone !== 'All') rows = rows.filter(function (x) { return x.zone === state.zone; });
      if (state.q) {
        var q = state.q.toLowerCase();
        rows = rows.filter(function (x) {
          return (x.group.name + ' ' + x.group.legalName + ' ' + x.group.sector + ' ' + x.group.region + ' ' +
            x.group.sapCodes.join(' ') + ' ' + x.group.code).toLowerCase().indexOf(q) >= 0;
        });
      }
      var get = {
        name: function (x) { return x.group.name; },
        zone: function (x) { return ['Act now', 'Watch', 'Growth', 'Clear'].indexOf(x.zone); },
        utilisation: function (x) { return x.utilisation; },
        exposure: function (x) { return x.exposure; },
        breach: function (x) { return x.breachChance; },
        worsen: function (x) { return x.worsenChance; },
        rankValue: function (x) { return x.rankValue; }
      }[state.sortKey] || function (x) { return x.rankValue; };
      rows.sort(function (a, b) { return state.sortDir * (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0); });

      HR.clear(host);
      host.appendChild(ui.panel({
        title: HR.n(rows.length) + ' group' + (rows.length === 1 ? '' : 's'),
        sub: 'Ranking value = chance of worsening × exposure. Click a row for the full view.',
        right: ui.button('Export CSV', {
          small: true, ico: 'download', onClick: function () {
            ui.download('headroom-customers.csv', ui.toCSV(
              ['Customer group', 'Legal name', 'Zone', 'Sector', 'Region', 'SAP codes', 'Limit USD m',
                'Exposure USD m', 'Limit used', 'Breach chance', 'Worsening chance', 'Ranking value USD m'],
              rows.map(function (m) {
                return [m.group.name, m.group.legalName, m.zone, m.group.sector, m.group.region,
                  m.group.sapCodes.join(' '), Math.round(m.limit), Math.round(m.exposure),
                  HR.pct(m.utilisation), HR.pct(m.breachChance), HR.pct(m.worsenChance), Math.round(m.rankValue)];
              })));
          }
        })
      }, ui.table([
        {
          key: 'name', label: 'Customer group',
          render: function (m) {
            return el('div', {}, [
              el('div', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: m.group.name }),
              el('div', { class: 'tiny faint', text: m.group.sector + ' · ' + m.group.region + ' · ' + m.group.sapCodes.join(', ') })
            ]);
          }
        },
        { key: 'zone', label: 'Zone', render: function (m) { return ui.zonePill(m.zone); } },
        { key: 'utilisation', label: 'Limit used', align: 'right', render: function (m) { return HR.pct(m.utilisation); } },
        { key: 'exposure', label: 'Exposure', align: 'right', render: function (m) { return HR.usd(m.exposure); } },
        {
          key: 'breach', label: 'Breach 90d', align: 'right',
          render: function (m) {
            return el('div', { class: 'row gap-8', style: { justifyContent: 'flex-end' } }, [
              el('span', { style: { width: '46px' } }, ui.band(m.breachChance, m.zone)),
              el('span', { class: 'num', text: HR.pct(m.breachChance) })
            ]);
          }
        },
        { key: 'worsen', label: 'Worsening', align: 'right', render: function (m) { return HR.pct(m.worsenChance); } },
        { key: 'rankValue', label: 'Ranking value', align: 'right', render: function (m) { return HR.usd(m.rankValue); } },
        { key: 'tier', label: 'Public data', align: 'center', render: function (m) { return ui.tierPill(m.group.external.tier); } }
      ], rows, {
        sortKey: state.sortKey, sortDir: state.sortDir,
        onSort: function (k, d) { state.sortKey = k; state.sortDir = d; apply(); },
        onRowClick: function (m) { ui.go('customer', m.group.id); }
      })));
    }

    root.appendChild(el('div', { class: 'row gap-8 wrap mb-16' }, [
      el('div', { class: 'search', style: { maxWidth: '360px', flex: '1 1 240px' } }, [
        el('span', { html: iconHTML('search', 15) }),
        el('input', {
          class: 'input', type: 'search', placeholder: 'Search name, sector, region or SAP code…',
          'aria-label': 'Search customers',
          oninput: function (e) { state.q = e.target.value; apply(); }
        })
      ]),
      ui.segmented(
        [{ value: 'All', label: 'All' }, { value: 'Act now', label: 'Act now' }, { value: 'Watch', label: 'Watch' },
          { value: 'Growth', label: 'Growth' }, { value: 'Clear', label: 'Clear' }],
        state.zone, function (v) { state.zone = v; apply(); })
    ]));
    root.appendChild(host);
    apply();
    return root;
  }

  views.customers = {
    id: 'customers', nav: null, title: 'Customers',
    render: function () { return customerList(HR.engine.portfolio()); }
  };

  /* =================================================================== RADAR */

  views.radar = {
    id: 'radar',
    nav: 'External radar',
    navIco: 'radar',
    title: 'External radar',

    render: function (ctx) {
      var p = HR.engine.portfolio();
      var m = (ctx.arg && HR.engine.find(ctx.arg)) || HR.engine.find('grp-A');
      if (!m) return el('div', { class: 'view' }, ui.empty('No customers in the book', '', 'radar'));
      var g = m.group, e = g.external, r = m.radar;
      var root = el('div', { class: 'view' });

      var picker = el('select', {
        class: 'input', style: { width: 'auto', maxWidth: '260px' },
        'aria-label': 'Choose a customer',
        onchange: function (ev) { ui.go('radar', ev.target.value); }
      }, ['grp-A', 'grp-B', 'grp-C', 'grp-D', 'grp-E', 'grp-F'].map(function (gid) {
        var gg = HR.data.byId(gid);
        var o = el('option', { value: gid, text: gg.name + ' — ' + gg.legalName });
        if (gid === g.id) o.selected = true;
        return o;
      }));

      root.appendChild(ui.masthead({
        title: 'External radar: ' + g.name,
        sub: 'What public sources say about this customer that SAP cannot. Every signal is matched to the right ' +
          'legal entity before it is used.',
        data: ui.asOf([['Tier', e.tier + (e.tier === 'A' ? ' — listed, files with the SEC' :
          e.tier === 'B' ? ' — listed elsewhere' : ' — private or subsidiary')]]),
        actions: [picker, ui.stamp('Illustrative: invented customers and numbers')]
      }));

      /* ---- the match chain: everything downstream depends on this ---- */
      var chainPanel = ui.panel({
        title: 'Who this customer really is',
        sub: 'Matching comes first. A signal that lands on the wrong company is worse than no signal at all.',
        right: el('span', { class: 'pill ' + (e.matchConfidence >= 0.9 ? 'pill-pass' : 'pill-partly') },
          'Match confidence ' + e.matchConfidence.toFixed(2) +
          (e.matchConfirmedBy ? ', confirmed by an ' + e.matchConfirmedBy : ', awaiting analyst confirmation'))
      });
      var nodes = [
        { ico: 'customers', lab: 'SAP customer codes', val: g.sapCodes.join(', '), src: "From Jabil's customer master" },
        { ico: 'file', lab: 'Legal entity', val: g.legalName, src: e.lei ? 'LEI found via GLEIF' : 'Matched by name and address' },
        {
          ico: 'link', lab: 'Parent group',
          val: e.tier === 'C' ? 'Not named in LEI data'
            : g.legalName.replace(/\s+(Inc|Corp|Ltd|GmbH|SA|AG|KK|Pte Ltd|Co Ltd|Bhd)$/, '') + ' Holdings',
          src: 'Parent from LEI relationship data'
        },
        {
          ico: 'pulse', lab: 'Listing', val: e.cik ? 'US-listed, files with the SEC' : 'Not US-listed',
          src: e.cik ? 'CIK ' + e.cik + ' from the SEC ticker file' : 'No daily share price'
        }
      ];
      var chain = el('div', { class: 'row-top gap-12 wrap' });
      nodes.forEach(function (n, i) {
        chain.appendChild(el('div', {
          class: 'grow',
          style: {
            flex: '1 1 190px', background: 'var(--land-1)', borderRadius: 'var(--r)',
            padding: 'var(--s3)', display: 'flex', gap: '10px', alignItems: 'flex-start'
          }
        }, [
          el('span', { style: { color: 'var(--teal-ink)', flex: '0 0 auto' }, html: iconHTML(n.ico, 16) }),
          el('div', { class: 'grow' }, [
            el('div', { class: 'tiny', style: { color: 'var(--faint)', letterSpacing: '.04em', textTransform: 'uppercase' }, text: n.lab }),
            el('div', { class: 'strong', style: { color: 'var(--forest-deep)', fontSize: '13px' }, text: n.val }),
            el('div', { class: 'tiny faint', text: n.src })
          ])
        ]));
        if (i < nodes.length - 1) {
          chain.appendChild(el('span', {
            style: { color: 'var(--contour)', alignSelf: 'center' },
            html: '<svg viewBox="0 0 26 12" width="22" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 6h20"/><path d="M17 2l4 4-4 4"/></svg>'
          }));
        }
      });
      chainPanel.appendChild(chain);
      root.appendChild(el('div', { class: 'mb-16' }, chainPanel));

      /* ---- the radar and the signal table ---- */
      var grid = el('div', { class: 'grid g-two mb-16' });

      var radarPanel = ui.panel({
        title: 'External credit radar',
        sub: 'Closer to the centre means more normal. Hollow points are where each measure sat 90 days ago.'
      });
      radarPanel.appendChild(charts.radar({ width: 540, height: 440, axes: r.axes, centreLabel: g.code }));
      radarPanel.appendChild(el('div', { class: 'note note-wash mt-12 tiny', html:
        r.definedCount + ' of 5 signal families apply to this customer. ' + r.summary +
        ' A family that does not apply is left out rather than scored as zero, so a private customer is never ' +
        'flattered by missing data.' }));
      grid.appendChild(radarPanel);

      var sigPanel = ui.panel({
        title: 'What each signal says now',
        sub: e.tier === 'A'
          ? 'Tier A: listed and filing with the SEC, so all five families apply.'
          : 'Only the families that apply to a tier ' + e.tier + ' customer are shown.'
      });
      sigPanel.appendChild(ui.table([
        { key: 'sig', label: 'Signal' },
        { key: 'read', label: 'Reading' },
        { key: 'note', label: 'What it means' },
        { key: 'status', label: 'Status', align: 'center' }
      ], r.signals.map(function (s) {
        return {
          sig: el('div', { class: 'row gap-8' }, [
            el('span', { style: { color: 'var(--teal-ink)' }, html: iconHTML(s.ico, 15) }),
            el('div', {}, [
              el('div', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: s.label }),
              el('div', { class: 'tiny faint', text: s.source })
            ])
          ]),
          read: el('div', {}, [
            el('div', { class: 'strong', text: s.headline }),
            el('div', { class: 'tiny faint', text: s.detail })
          ]),
          note: el('span', { class: 'small muted', text: s.note }),
          status: ui.statusPill(s.status)
        };
      }), { compact: true }));
      grid.appendChild(sigPanel);
      root.appendChild(grid);

      /* ---- did the outside signals lead the payment record? ---- */
      var low = el('div', { class: 'grid g-two' });

      var leadPanel = ui.panel({
        title: 'External signals moved before payment behaviour did',
        sub: 'Last six months. One customer proves nothing — the Model performance screen tests this across the book.'
      });
      var events = (e.events || []).filter(function (ev) {
        var age = HR.daysBetween(ev.date, HR.data.AS_OF);
        return age >= 0 && age <= 180;
      });
      leadPanel.appendChild(charts.timeline({
        width: 640, height: 200,
        from: HR.addDays(HR.data.AS_OF, -180), to: HR.data.AS_OF,
        rows: [
          {
            label: 'Official events', points: events.map(function (ev) {
              return { date: ev.date, kind: 'dot', color: '#E08A00', label: ev.type };
            })
          },
          {
            label: 'News tone', points: e.newsTone30d < e.newsToneNormal - 0.1
              ? [{ date: HR.addDays(HR.data.AS_OF, -95), kind: 'dot', color: '#0E9E93', label: 'tone turns negative' }] : []
          },
          {
            label: 'Days late vs normal', points: (g.behaviour.daysLateNow - g.behaviour.daysLateNormal) > 3
              ? [{
                  date: HR.addDays(HR.data.AS_OF, -30), kind: 'line', color: '#1F7A4D',
                  label: '+' + Math.round(g.behaviour.daysLateNow - g.behaviour.daysLateNormal) + ' days'
                }] : []
          }
        ]
      }));
      var leadDays = events.length
        ? HR.clamp(Math.round((g.behaviour.daysLateNow - g.behaviour.daysLateNormal) * 1.4), 0, 120) : 0;
      leadPanel.appendChild(el('div', {
        class: 'note ' + (leadDays > 0 ? 'note-honey' : 'note-wash') + ' mt-12',
        html: leadDays > 0
          ? '<b>' + leadDays + ' days of warning.</b> These signals moved before days-late did, so the analyst could ' +
            'have asked about this customer ' + leadDays + ' days before it showed in the payment record. That gap is ' +
            'the whole point of the radar, and it is what Layer 4 measures in the back-test.'
          : '<b>No lead time claimed.</b> The external signals and the payment behaviour moved at about the same ' +
            'time, so this customer earns no extra warning from outside data.'
      }));
      low.appendChild(leadPanel);

      var coverPanel = ui.panel({
        title: 'Coverage across the portfolio',
        sub: p.groupCount + ' customer groups, by how much public data exists for each.'
      });
      HR.engine.coverage().forEach(function (c) {
        coverPanel.appendChild(el('div', {
          class: 'row-top gap-12',
          style: { padding: 'var(--s3) 0', borderBottom: '1px solid var(--line)' }
        }, [
          ui.tierPill(c.tier),
          el('div', { class: 'grow' }, [
            el('div', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: HR.n(c.count) + ' groups' }),
            el('div', { class: 'small muted', text: c.desc })
          ])
        ]));
      });
      coverPanel.appendChild(el('div', { class: 'note note-wash mt-12 tiny', html:
        'Mined free: SEC EDGAR, GLEIF, GDELT, FRED, World Bank. Live use needs a licence for daily share prices ' +
        'and real-time news. Reuse first: any credit data Jabil already licenses.' }));
      low.appendChild(coverPanel);
      root.appendChild(low);

      return root;
    }
  };

  /* ============================================================= PERFORMANCE */

  views.performance = {
    id: 'performance',
    nav: 'Model performance',
    navIco: 'model',
    title: 'Model performance',

    render: function () {
      var bt = HR.engine.backtest();
      var root = el('div', { class: 'view' });

      root.appendChild(ui.masthead({
        title: 'Model performance',
        sub: 'A rolling back-test on ' + bt.cutoffs + ' monthly cut-offs. Models see only what was known on each ' +
          'cut-off date, so nothing here was tested on data it had already seen.',
        data: [
          ['Cut-offs', bt.cutoffs + ' monthly'],
          ['History scored', bt.cohort + ' breaches, ' + bt.worseningCases + ' worsening cases'],
          ['Layer 3 catches', bt.activeLayer.caughtPct + '% 30+ days ahead'],
          ['False alarms', bt.activeLayer.falsePerTrue.toFixed(1) + ' per real warning']
        ],
        actions: [ui.stamp('Illustrative: invented customers and numbers')]
      }));

      var grid = el('div', { class: 'grid g-detail mb-16' });

      var ladder = ui.panel({
        title: 'Each layer must beat the simpler one below it',
        sub: 'Share of limit breaches flagged at least 30 days ahead, with a 95% range. Dashed line: the pass mark ' +
          'agreed with the credit team.'
      });
      ladder.appendChild(charts.barLadder({
        width: 800, height: 390, xMax: 100,
        rows: bt.results.map(function (r) {
          return {
            label: r.name,
            sub: r.sub + ' · ' + r.medianWarning + ' days median warning · ' + r.nowFlagged + ' flagged today',
            pct: r.caughtPct, lo: r.range[0], hi: r.range[1],
            tag: r.verdict,
            tagColor: r.isBaseline ? '#8AA294' : (r.verdict === 'Not proven' ? '#E08A00' : '#1F7A4D'),
            baseLine: 50, isBaseline: r.isBaseline
          };
        })
      }));
      ladder.appendChild(el('div', { class: 'note note-wash mt-16', html:
        '<b>The rule.</b> A heavier layer replaces the simpler one only if it wins on the same back-test months, ' +
        'at the same false-alarm rate. Layer 4 adds ' + (bt.results[4].caughtPct - bt.results[3].caughtPct) +
        ' points, which sits inside the range of the layer below, so it is kept only for the ' +
        HR.engine.coverage()[0].count + ' groups with full public data.' }));
      grid.appendChild(ladder);

      var crit = ui.panel({
        title: 'Pass criteria',
        sub: 'Set with the credit team, reviewed each quarter. Shown here for layer 3, the model we propose to ship.'
      });
      crit.appendChild(ui.table([
        { key: 'label', label: 'Criterion' },
        { key: 'actual', label: 'Actual', align: 'right' },
        { key: 'verdict', label: 'Result', align: 'center' }
      ], bt.criteria.map(function (c) {
        return {
          label: el('div', {}, [
            el('div', { text: c.label }),
            el('div', { class: 'tiny faint', text: 'target ' + c.target })
          ]),
          actual: c.actual, verdict: ui.statusPill(c.verdict)
        };
      }), { compact: true }));
      var partly = bt.criteria.some(function (c) { return c.verdict === 'Partly'; });
      crit.appendChild(el('div', { class: 'note ' + (partly ? 'note-honey' : 'note-teal') + ' mt-16', html:
        '<b>How this feeds the decision.</b> All pass: go, for the whole book. ' +
        (partly ? 'Partly: go, but narrow — ship the core layers first and keep the rest behind a flag. ' : '') +
        'Core layers fail: not yet.' }));
      grid.appendChild(crit);
      root.appendChild(grid);

      var low = el('div', { class: 'grid g-detail' });

      var cal = ui.panel({
        title: 'Is the worsening chance honest?',
        sub: 'Observed share that worsened, by predicted band. Dot size is how many customer-months sit behind each point.'
      });
      cal.appendChild(charts.calibration({
        width: 620, height: 400, bands: bt.calibration, identityLabel: 'Dashed line: perfect honesty'
      }));
      cal.appendChild(el('div', { class: 'note note-wash mt-16', html:
        'Average gap between predicted and observed chance: <b>' + bt.calibrationGap.toFixed(1) + ' points</b>, ' +
        'against a pass mark of 5. So when the screen says 40%, about 40% of those customers did get worse.' }));
      low.appendChild(cal);

      var limits = ui.panel({
        title: 'What these results do not prove',
        sub: 'Read this before trusting any number on this page.'
      });
      [
        ['pulse', 'It describes the past', 'A new kind of shock may not look like the last 24 months.'],
        ['flag', 'Few worsening cases', bt.worseningCases + ' cases give wide ranges. Each new month of real data narrows them.'],
        ['scale', 'A score is not a verdict', 'A high score means look now. It does not predict default.'],
        ['radar', 'The external gain is narrow', 'The radar adds most for the ' + HR.engine.coverage()[0].count +
          ' groups with SEC filings. For the rest it adds little.']
      ].forEach(function (row) {
        limits.appendChild(el('div', {
          class: 'row-top gap-12',
          style: { padding: 'var(--s3) 0', borderBottom: '1px solid var(--line)' }
        }, [
          el('span', { style: { color: 'var(--teal-ink)', flex: '0 0 auto', marginTop: '2px' }, html: iconHTML(row[0], 16) }),
          el('div', { class: 'grow' }, [
            el('div', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: row[1] }),
            el('div', { class: 'small muted', text: row[2] })
          ])
        ]));
      });
      limits.appendChild(el('div', { class: 'note note-honey mt-16', html:
        '<b>Our reporting rule.</b> Every monthly result is logged, including the months where a layer fails. ' +
        'Thresholds and pass marks are reviewed with the credit team each quarter.' }));
      low.appendChild(limits);
      root.appendChild(low);

      /* ---- the formula against the six readings we already have ---- */
      var check = ui.panel({
        title: 'Does the breach formula reproduce the cases we already understand?',
        sub: 'The six customers the pitch describes, with the chance the credit team gave each one. This is a sanity ' +
          'check on the formula, not a fit — nothing here bends the model to a wanted answer.',
        right: el('span', { class: 'pill ' + (HR.engine.calibrationRmse() <= 0.12 ? 'pill-pass' : 'pill-partly') },
          'Average gap ' + (HR.engine.calibrationRmse() * 100).toFixed(1) + ' points')
      });
      check.appendChild(ui.table([
        { key: 'label', label: 'Customer' },
        { key: 'note', label: 'Why it is interesting' },
        { key: 'expected', label: 'Credit team\u2019s reading', align: 'right' },
        { key: 'model', label: 'Model', align: 'right' },
        {
          key: 'gap', label: 'Gap', align: 'right',
          render: function (r) {
            if (r.gap === null || r.gap === undefined) return '—';
            var pts = r.gap * 100;
            return el('span', {
              class: 'num', style: { color: Math.abs(pts) > 12 ? 'var(--honey-ink)' : 'var(--forest)' },
              text: (pts > 0 ? '+' : '') + pts.toFixed(0) + ' pts'
            });
          }
        }
      ], HR.engine.calibration().map(function (c) {
        return {
          label: el('span', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: c.label }),
          note: el('span', { class: 'small muted', text: c.note }),
          expected: HR.pct(c.expected), model: c.model === null ? '—' : HR.pct(c.model), gap: c.gap
        };
      }), { compact: true }));
      check.appendChild(el('div', { class: 'note note-honey mt-16', html:
        '<b>Where the model disagrees with the pitch, the model is shown as it is.</b> Customers A and F score ' +
        'higher here than the pitch stated, because growing into a limit that is already nearly used is the ' +
        'strongest single signal in this book. That difference is a question for the credit team, not something to ' +
        'tune away.' }));
      check.appendChild(el('div', { class: 'note note-wash mt-8 tiny', html:
        '<b>One thing to know when reading this table.</b> The two figures are the same quantity reached two ' +
        'different ways. The <i>drivers</i> figure is what the hand-written formula on the Methodology screen ' +
        'produces, and that is the number the screens show, because it is the one that can be taken apart in front ' +
        'of a credit analyst. The back-test is a separate, simulated result. They are close but not identical, and ' +
        'the gap is stated rather than smoothed over — closing it properly needs real Jabil history, which is what ' +
        'weeks 1 to 14 of the plan are for.' }));
      root.appendChild(el('div', { class: 'mt-16' }, check));

      return root;
    }
  };

  /* ============================================================== THRESHOLDS */

  views.thresholds = {
    id: 'thresholds',
    nav: 'Thresholds',
    navIco: 'sliders',
    title: 'Thresholds',

    render: function () {
      var t = HR.store.thresholds;
      var root = el('div', { class: 'view' });
      var host = el('div');

      root.appendChild(ui.masthead({
        title: 'Thresholds',
        sub: 'Where the two zone lines sit is a business decision, not a model output. Move them and the map, the ' +
          'list and the briefing all follow — but what the models measured does not change.',
        data: ui.asOf(),
        actions: [ui.button('Reset to agreed defaults', {
          small: true, ico: 'refresh',
          onClick: function () { HR.store.resetThresholds(); HR.toast('Thresholds reset to the agreed defaults'); }
        })]
      }));

      var grid = el('div', { class: 'grid g-detail mb-16' });

      var sliders = ui.panel({
        title: 'The two zone lines',
        sub: 'Set with the credit team in weeks 1 to 3 and reviewed quarterly.'
      });
      [
        ['breachProb', 'Chance of passing the limit in 90 days', 'across the map', 0.1, 0.9, 0.05, 'pct'],
        ['worsenProb', 'Chance of sustained worsening in 90 days', 'up the map', 0.05, 0.8, 0.05, 'pct'],
        ['watchlistCap', 'Watchlist size cap', 'names on the morning list', 5, 25, 1, 'int'],
        ['alertOverduePct', 'Alert if overdue share exceeds', 'of receivables', 0.1, 0.6, 0.05, 'pct'],
        ['materialEventDays', 'A public event is material for', 'days', 3, 30, 1, 'int']
      ].forEach(function (row) {
        var key = row[0], fmt = row[6];
        var out = el('span', { class: 'strong num', text: fmt === 'pct' ? HR.pct(t[key]) : HR.n(t[key]) });
        sliders.appendChild(el('div', { class: 'mb-24' }, [
          el('div', { class: 'between' }, [
            el('label', { style: { fontSize: '13px', fontWeight: '600' } }, [
              row[1], el('span', { class: 'faint tiny', text: '  (' + row[2] + ')' })
            ]),
            out
          ]),
          el('input', {
            type: 'range', min: String(row[3]), max: String(row[4]), step: String(row[5]),
            value: String(t[key]), 'aria-label': row[1],
            oninput: function (ev) {
              var v = fmt === 'int' ? parseInt(ev.target.value, 10) : parseFloat(ev.target.value);
              out.textContent = fmt === 'pct' ? HR.pct(v) : HR.n(v);
              HR.store.setThreshold(key, v);
            }
          })
        ]));
      });
      sliders.appendChild(el('div', { class: 'note note-wash tiny', html:
        'Thresholds are stored in this browser only, so a what-if session never changes anyone else\u2019s view.' }));
      grid.appendChild(sliders);

      var zoneDefs = ui.panel({ title: 'What each zone means, and the default next step' });
      zoneDefs.appendChild(ui.table([
        { key: 'zone', label: 'Zone' },
        { key: 'means', label: 'Meaning' },
        { key: 'step', label: 'Default next step' }
      ], [
        { zone: ui.zonePill('Act now'), means: HR.engine.ZONES['Act now'].desc, step: HR.engine.DEFAULT_STEP['Act now'] },
        { zone: ui.zonePill('Growth'), means: HR.engine.ZONES['Growth'].desc, step: HR.engine.DEFAULT_STEP['Growth'] },
        { zone: ui.zonePill('Watch'), means: HR.engine.ZONES['Watch'].desc, step: HR.engine.DEFAULT_STEP['Watch'] },
        { zone: ui.zonePill('Clear'), means: HR.engine.ZONES['Clear'].desc, step: HR.engine.DEFAULT_STEP['Clear'] }
      ], { compact: true, inset: true }));
      zoneDefs.appendChild(el('div', { class: 'note note-honey mt-16', html:
        '<b>Growth is the zone that saves money.</b> A growing customer that pays on time should get a limit ' +
        'review, not an order hold. Holding orders from a healthy customer is the most expensive mistake this tool ' +
        'can cause, which is why the two questions are kept apart on the map.' }));
      grid.appendChild(zoneDefs);
      root.appendChild(grid);

      var whatIf = ui.panel({ title: 'What-if: who would move' });
      host.appendChild(whatIf);
      root.appendChild(host);

      function renderWhatIf() {
        var p = HR.engine.portfolio();
        var b = HR.engine.briefing();
        HR.clear(whatIf);
        whatIf.appendChild(ui.fieldKey([
          ['Act now', String(p.counts['Act now']), HR.usd(p.inActExposure), 'var(--coral-ink)'],
          ['Watch', String(p.counts['Watch']), HR.usd(HR.sum(p.byZone['Watch'], function (x) { return x.exposure; })), 'var(--honey-ink)'],
          ['Growth', String(p.counts['Growth']), 'pays on time', 'var(--teal-ink)'],
          ['Clear', String(p.counts['Clear']), HR.usd(HR.sum(p.byZone['Clear'], function (x) { return x.exposure; }))],
          ['Morning list', p.watchlist.length + ' names', 'mean worsening ' + HR.pct(p.meanWorsen)]
        ]));
        var moved = HR.engine.moves();
        whatIf.appendChild(el('div', { class: 'mt-24' }, moved.length
          ? ui.table([
              { key: 'name', label: 'Customer' },
              { key: 'from', label: 'Was', align: 'center' },
              { key: 'to', label: 'Now', align: 'center' },
              { key: 'breach', label: 'Breach 90d', align: 'right' },
              { key: 'worsen', label: 'Worsening', align: 'right' },
              { key: 'exposure', label: 'Exposure', align: 'right' }
            ], moved.slice(0, 20).map(function (x) {
              return {
                name: el('span', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: x.m.group.name }),
                from: ui.zonePill(x.from), to: ui.zonePill(x.to),
                breach: HR.pct(x.m.breachChance), worsen: HR.pct(x.m.worsenChance),
                exposure: HR.usd(x.m.exposure), id: x.m.group.id
              };
            }), { compact: true, onRowClick: function (r) { ui.go('customer', r.id); } })
          : ui.empty('At these lines, nobody changes zone', 'The book is stable at the thresholds you have set.', 'check')));
        whatIf.appendChild(el('div', { class: 'note note-wash mt-16' }, [
          el('div', {
            class: 'tiny strong mb-8',
            style: { letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' },
            text: 'Briefing at these lines'
          }),
          el('p', { class: 'small', text: b.sentences.join(' ') })
        ]));
      }

      HR.store.on('thresholds', renderWhatIf);
      renderWhatIf();
      return root;
    }
  };

  /* ============================================================= METHODOLOGY */

  views.methodology = {
    id: 'methodology',
    nav: 'Methodology',
    navIco: 'database',
    title: 'Methodology',

    render: function () {
      var root = el('div', { class: 'view' });
      var bmT = HR.engine.BREACH_MODEL;

      root.appendChild(ui.masthead({
        title: 'Methodology',
        sub: 'How every number on the other screens was produced, what it is checked against, and what is invented ' +
          'here rather than measured.',
        data: ui.asOf()
      }));

      var row1 = el('div', { class: 'grid g-two mb-16' });

      var exp = ui.panel({ title: 'The exposure rule', sub: 'One formula, applied identically on every screen.' });
      exp.appendChild(el('div', {
        class: 'note note-deep',
        style: { fontVariantNumeric: 'tabular-nums', fontSize: '12.5px' },
        text: 'exposure = receivables + dedicated stock + (open POs − stock already built for those POs)'
      }));
      exp.appendChild(el('div', { class: 'mt-16' }, ui.defs([
        ['Why stock is netted off',
          'Stock already built for an open PO is counted once. Counting both would double the exposure.'],
        ['What does not change exposure',
          'Shipping. It moves value from the open PO into receivables and stops the stock counting, so the total is unchanged.'],
        ['Where it comes from', 'SAP: AR open items, inventory by customer, the PO book, and credit limits.'],
        ['To confirm with Jabil',
          "That 'PO' means customer orders to Jabil, and that stock can be linked to a customer in SAP."]
      ])));
      row1.appendChild(exp);

      var bm = ui.panel({
        title: 'The breach-chance model',
        sub: 'Four drivers added as percentage points onto a base rate. Additive on purpose, so the reasons always add up.'
      });
      bm.appendChild(ui.table([
        { key: 'driver', label: 'Driver' },
        { key: 'starts', label: 'Starts at', align: 'right' },
        { key: 'full', label: 'Full strength', align: 'right' },
        { key: 'pts', label: 'Points', align: 'right' }
      ], [
        { driver: 'How much of the limit is used', starts: '60% used', full: '100% used', pts: '+' + bmT.drivers.utilisation.coeff },
        { driver: 'Paying later than its own normal', starts: '0 days', full: '+20 days', pts: '+' + bmT.drivers.slippage.coeff },
        { driver: 'Order book growing', starts: '0%', full: '+45% in 4 weeks', pts: '+' + bmT.drivers.growth.coeff },
        { driver: 'Overdue balances ageing', starts: '0%', full: '18% migrating', pts: '+' + bmT.drivers.migration.coeff },
        { driver: 'Growth into a used limit', starts: '75% used', full: '100% used', pts: 'up to +' + bmT.interaction.coeff }
      ], { compact: true, inset: true }));
      bm.appendChild(el('div', { class: 'note note-wash mt-16', html:
        'Base rate <b>' + HR.pct(bmT.base) + '</b> — what an average customer in this book scores. The chance is ' +
        'capped at <b>' + HR.pct(bmT.cap) + '</b>, because a forecast that says 100% cannot be wrong gracefully. ' +
        'The six known cases are checked live on the Model performance screen.' }));
      row1.appendChild(bm);
      root.appendChild(row1);

      var row2 = el('div', { class: 'grid g-two mb-16' });

      var sc = ui.panel({
        title: 'The early-warning scorecard',
        sub: 'Base rate ' + HR.pct(HR.engine.BASE_RATE) + ' plus the points of each driver, so the reasons add up to the score.'
      });
      sc.appendChild(ui.table([
        { key: 'label', label: 'Driver' },
        { key: 'src', label: 'Source', align: 'center' },
        { key: 'max', label: 'Most it can add', align: 'right' }
      ], HR.engine.DRIVERS.map(function (d) {
        return {
          label: d.label,
          src: ui.tag(d.source === 'SAP' ? 'B' : 'P'),
          max: d.maxPoints ? '+' + d.maxPoints : 'up to −2'
        };
      }), { compact: true, inset: true }));
      sc.appendChild(el('div', { class: 'note note-wash mt-16 tiny', html:
        'Each customer is compared with <b>its own normal</b>, never with other customers. "Worsened" means the ' +
        'overdue share rose and stayed up for eight weeks or more.' }));
      row2.appendChild(sc);

      var run = ui.panel({
        title: 'The exposure runway',
        sub: HR.engine.PATHS + ' simulated futures per customer, drawn afresh on every run from a fixed seed.'
      });
      [
        ['1', 'Fix what is known', 'Scheduled deliveries from the open PO book, today\u2019s receivables, and the credit limit.'],
        ['2', 'Place the path', 'The middle of the fan follows the order book. When the chance of a breach is high it is aimed at the limit, so a high reading is visible on the chart rather than only in the number.'],
        ['3', 'Add the swing', 'The balance wanders around that path. The size of the wander is this customer\u2019s own history — the spread of its payment delays, scaled by how much cash settles each day. It mean-reverts, because a customer that falls behind catches up.'],
        ['4', 'Read three numbers', 'The share of paths that cross the limit is the chance; the median crossing date is the likely date; the median peak above the limit is the amount.']
      ].forEach(function (r) {
        run.appendChild(el('div', { class: 'row-top gap-12', style: { padding: 'var(--s2) 0' } }, [
          el('span', {
            class: 'strong num',
            style: {
              flex: '0 0 22px', color: 'var(--white)', background: 'var(--forest)',
              borderRadius: '50%', width: '22px', height: '22px', display: 'grid',
              placeItems: 'center', fontSize: '11.5px'
            },
            text: r[0]
          }),
          el('div', { class: 'grow' }, [
            el('div', { class: 'strong', style: { color: 'var(--forest-deep)' }, text: r[1] }),
            el('div', { class: 'small muted', text: r[2] })
          ])
        ]));
      });
      run.appendChild(el('div', { class: 'note note-honey mt-16', html:
        '<b>What the analyst never sees.</b> The individual futures stay behind the screen. The chart shows one line ' +
        'to read and one band to judge confidence by. The band is not a set of options.' }));
      row2.appendChild(run);
      root.appendChild(row2);

      var ext = ui.panel({
        title: 'The external signals, and how each becomes a severity',
        sub: 'Each signal is placed on a 0 to 1 scale where 0 is the centre of the radar (normal) and 1 is the outer edge.'
      });
      ext.appendChild(ui.table([
        { key: 'label', label: 'Family' },
        { key: 'source', label: 'Source and refresh' },
        { key: 'how', label: 'How the severity is computed' }
      ], [
        { label: 'Filings', source: 'SEC XBRL, quarterly', how: "Altman Z'' mapped so 2.6 is safe and 1.1 is distress; current ratio shown alongside" },
        { label: 'Market', source: 'Daily share prices, licence for live use', how: 'Distance-to-default mapped so 3.2 is comfortable and 0.8 is severe' },
        { label: 'Events', source: 'SEC 8-K filings, checked daily', how: 'Material event types in the last 90 days, scaled so three events reach the edge' },
        { label: 'News tone', source: 'GDELT scored with FinBERT, daily', how: "This customer's 30-day tone against its own normal, so coverage volume does not distort it" },
        { label: 'Sector', source: 'FRED industry orders, monthly', how: 'Industry order change over three months, scaled so −12% reaches the edge' }
      ], { compact: true }));
      ext.appendChild(el('div', { class: 'note note-teal mt-16', html:
        '<b>A signal that does not apply is left out, not scored zero.</b> A private customer has no filings and no ' +
        'share price; scoring those as "normal" would flatter it. The radar says how many families applied.' }));
      root.appendChild(el('div', { class: 'mb-16' }, ext));

      var mock = ui.panel({
        title: 'What is invented here, and what would be real',
        sub: 'This is a working prototype on synthetic data. Nothing on these screens came from Jabil.'
      });
      mock.appendChild(ui.table([
        { key: 'item', label: 'On these screens' },
        { key: 'real', label: 'In a real deployment' }
      ], [
        { item: '120 customer groups, USD 8.6bn of exposure', real: "Jabil's customer master and credit limits from SAP" },
        { item: 'Invoices, payments, orders, stock and disputes', real: 'Read-only copies of the SAP tables, nightly' },
        { item: "Altman Z'', distance-to-default, news tone, 8-K events", real: 'SEC EDGAR, GLEIF, GDELT, FRED — all free public sources' },
        { item: 'Breach chances and worsening scores', real: 'The same formulas, fitted on real history and back-tested' },
        { item: 'The "as of" date', real: 'Whatever the last successful night run loaded' },
        { item: 'Customer names', real: 'Masked if Jabil prefers; the matching works the same either way' }
      ], { compact: true }));
      mock.appendChild(el('div', { class: 'note note-teal mt-16', html:
        '<b>Determinism.</b> Every number here is reproducible. The portfolio is generated once from a fixed seed, ' +
        'each customer\u2019s simulation is seeded from its own id, and the back-test draws from a fixed seed. Reload ' +
        'the page and every figure is identical — which is what makes a demo safe.' }));
      mock.appendChild(el('div', { class: 'mt-16' }, ui.tagLegend()));
      mock.appendChild(el('div', { class: 'note note-honey mt-16', html:
        '<b>What this prototype still needs from Jabil</b> is set out in full — field by field, source by source, ' +
        'with dates and fallbacks — in <a href="data-requirements.html">data-requirements.html</a>, which ships ' +
        'alongside this app.' }));
      root.appendChild(mock);

      return root;
    }
  };
})(window);
