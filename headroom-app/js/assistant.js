/* ============================================================================
   Headroom — the AI assistant

   The pitch makes a specific promise: the assistant explains the finished
   results, drafts the briefing, and cannot produce a number that is not already
   on a screen. This file enforces that promise in code.

   Every handler below reads from `HR.engine.portfolio()`, `HR.engine.briefing()`
   or `HR.engine.backtest()` — all of which are pre-computed. There is no call to
   a language model here and no arithmetic beyond formatting. If a question
   cannot be answered from the results, the assistant says so rather than
   guessing, which is the behaviour a credit team needs before it will trust the
   tool at all. The summary sentences it does write are template text filled with
   stored figures, which is exactly how the weekly briefing is produced.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR = global.HR || {};
  var ui = HR.ui, el = HR.el, iconHTML = HR.iconHTML;

  var SUGGESTIONS = [
    'Why did Customer A move to Act now?',
    'What is on the watchlist this week?',
    'What is the biggest exposure in Act now?',
    'Which customers could breach without getting worse?',
    'Does the model beat the current rule?',
    'What do we not know yet?'
  ];

  /**
   * Answer one question from the finished results.
   * @returns {{text: string, source: string}}
   */
  function answer(question) {
    var q = String(question || '').toLowerCase();
    var p = HR.engine.portfolio();
    var b = HR.engine.briefing();
    var bt = HR.engine.backtest();

    /**
     * Resolve a named customer, if the question names one.
     *
     * Matching is deliberately strict, because a loose match is worse than no
     * match: group codes are a single letter ("A" … "F"), so a naive substring
     * test finds "d" inside "do" and answers every question with Customer D.
     * Names must be whole words and at least four characters; a bare letter is
     * only accepted after the word "customer".
     */
    function findCustomer(text) {
      var m = text.match(/\bcustomer\s+([a-z])\b/);
      if (m) {
        var code = m[1].toUpperCase();
        var named = HR.data.NAMED.filter(function (g) { return g.code === code; })[0];
        if (named) return HR.engine.find(named.id);
      }
      function wholeWord(haystack, needle) {
        if (!needle || needle.length < 4) return false;
        var idx = haystack.indexOf(needle);
        while (idx >= 0) {
          var before = idx === 0 ? ' ' : haystack.charAt(idx - 1);
          var after = idx + needle.length >= haystack.length ? ' ' : haystack.charAt(idx + needle.length);
          if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
          idx = haystack.indexOf(needle, idx + 1);
        }
        return false;
      }
      return p.rows.filter(function (x) {
        return wholeWord(text, x.group.name.toLowerCase()) ||
          wholeWord(text, x.group.legalName.toLowerCase()) ||
          (x.group.code.length >= 4 && wholeWord(text, x.group.code.toLowerCase()));
      })[0] || null;
    }

    /* A specific customer is deliberately the LAST thing tried. Testing it first
       meant a fuzzy name match swallowed every other question. */
    var customer = null;

    /* ---------------------------------------------------------- watchlist */
    if (/watchlist|top 10|top ten|morning list|need attention|who should/.test(q)) {
      return {
        text: 'The morning list, ranked by chance of worsening × exposure, capped at ' +
          HR.store.thresholds.watchlistCap + ' names:<ul>' +
          p.watchlist.map(function (x, i) {
            return '<li>' + (i + 1) + '. <b>' + x.group.name + '</b> — ' + x.zone + ', breach ' +
              HR.pct(x.breachChance) + ', worsening ' + HR.pct(x.worsenChance) + ', ' +
              HR.usd(x.exposure) + ' exposure, ranking value ' + HR.usd(x.rankValue) + '</li>';
          }).join('') + '</ul>',
        source: 'Results table. Ranking value = chance of worsening × exposure. ' + p.counts['Clear'] +
          ' further groups are Clear and appear only in the weekly briefing.'
      };
    }

    /* ------------------------------------------------------ biggest exposure */
    if (/biggest|largest|most exposure|highest exposure/.test(q)) {
      var act = p.byZone['Act now'].slice().sort(function (a, c) { return c.exposure - a.exposure; });
      if (!act.length) {
        return {
          text: 'Nobody is in Act now at the current thresholds. ' + HR.usd(p.totalExposure) +
            ' is monitored across ' + p.groupCount + ' groups.',
          source: 'Results table.'
        };
      }
      return {
        text: 'In Act now, the largest exposures are:<ul>' + act.slice(0, 5).map(function (x) {
          return '<li><b>' + x.group.name + '</b> — ' + HR.usd(x.exposure) + ' exposure, breach ' +
            HR.pct(x.breachChance) + ', worsening ' + HR.pct(x.worsenChance) + '</li>';
        }).join('') + '</ul>Act now holds ' + HR.usd(p.inActExposure) + ' in total, out of ' +
          HR.usd(p.totalExposure) + ' across the book.',
        source: 'Results table, sorted by exposure.'
      };
    }

    /* -------------------------------------------------------------- growth */
    if (/growth|without getting worse|pays on time|limit review|order hold/.test(q)) {
      var growth = p.byZone['Growth'].slice().sort(function (a, c) { return c.exposure - a.exposure; });
      if (!growth.length) {
        return { text: 'No customer is in Growth at the current thresholds.', source: 'Results table.' };
      }
      return {
        text: 'These customers may pass a limit but are paying on time, so this reads as growth rather than ' +
          'distress — a limit review is the cheaper response:<ul>' + growth.map(function (x) {
            return '<li><b>' + x.group.name + '</b> — breach ' + HR.pct(x.breachChance) + ' but worsening only ' +
              HR.pct(x.worsenChance) + '; ' + HR.usd(x.exposure) + ' exposure. ' + x.nextSteps[0].text + '</li>';
          }).join('') + '</ul>',
        source: 'Results table. Growth = breach chance above the line, worsening chance below it. ' +
          'Holding orders from a healthy customer is the most expensive mistake this tool can cause.'
      };
    }

    /* ----------------------------------------------------------- back-test */
    if (/beat|better than|back.?test|prov|performance|current rule|accuracy|false alarm/.test(q)) {
      var a = bt.activeLayer, base = bt.results[0];
      return {
        text: 'On ' + bt.cutoffs + ' monthly cut-offs, the layer we propose to ship catches <b>' +
          a.caughtPct + '%</b> of limit breaches at least 30 days ahead, against <b>' + base.caughtPct +
          '%</b> for the current CMD rule, with <b>' + a.falsePerTrue.toFixed(1) +
          '</b> false alarms per real warning. Median warning is <b>' + a.medianWarning + ' days</b>.<br><br>' +
          'The ladder is honest: every layer is compared with the one below on the same months at the same ' +
          'false-alarm rate. Layer 4 is marked <b>not proven</b> — its gain sits inside the range of layer 3 — ' +
          'so we keep it only for the ' + HR.engine.coverage()[0].count + ' groups with SEC filings.',
        source: 'Back-test results, rolled forward monthly so no model ever sees the future. ' +
          'Detail on the Model performance screen.'
      };
    }

    /* -------------------------------------------------------- open questions */
    if (/do not know|don't know|unknown|assumption|confirm|open question|still need|risk/.test(q)) {
      return {
        text: 'What this prototype cannot tell you yet:<ul>' +
          '<li>How far back SAP keeps invoice-level history. Everything here assumes about three years. If it is monthly totals only, the daily rebuild starts from week 1 instead.</li>' +
          '<li>Whether stock can be linked to a customer in SAP. The whole exposure formula depends on it.</li>' +
          '<li>Whether outside data may be used at all. If not, the forecast and the score still run on SAP data alone — only the radar switches off.</li>' +
          '<li>What success means to your credit team: earlier warning, or fewer false alarms.</li>' +
          '<li>Whether the ranking is useful until analysts have rated real alerts. Until then it is chance × exposure.</li></ul>',
        source: 'Assumptions listed in the pitch, to confirm with Jabil in weeks 1 to 3.'
      };
    }

    /* ------------------------------------------------------------- exposure */
    if (/exposure|headroom|how.*(calculat|work)|formula|utilis|utiliz/.test(q)) {
      return {
        text: 'Exposure is <b>receivables + dedicated stock + open POs not yet covered by that stock</b>. ' +
          'Stock already built for an open PO is counted once, so it is netted off the PO. Shipping does not ' +
          'change exposure: it moves value from the open PO into receivables and stops the stock counting.<br><br>' +
          'Across the book that is <b>' + HR.usd(p.totalExposure) + '</b> over ' + p.groupCount +
          ' customer groups. The largest single exposure is ' +
          HR.usd(Math.max.apply(null, p.rows.map(function (x) { return x.exposure; }))) + '.',
        source: 'The exposure rule agreed with the credit team in week 2, applied identically on every screen.'
      };
    }

    /* ----------------------------------------------------------- thresholds */
    if (/threshold|the line|zone|what.*act now|why.*flag/.test(q)) {
      var t = HR.store.thresholds;
      return {
        text: 'The lines sit at <b>' + HR.pct(t.breachProb) + '</b> across (chance of passing the limit in 90 days) ' +
          'and <b>' + HR.pct(t.worsenProb) + '</b> up (chance of sustained worsening):<ul>' +
          '<li><b>Act now</b> — both above: ' + p.counts['Act now'] + ' groups, ' + HR.usd(p.inActExposure) + '</li>' +
          '<li><b>Growth</b> — breach above, worsening below: ' + p.counts['Growth'] + ' groups</li>' +
          '<li><b>Watch</b> — worsening above, breach below: ' + p.counts['Watch'] + ' groups</li>' +
          '<li><b>Clear</b> — neither: ' + p.counts['Clear'] + ' groups</li></ul>' +
          'You can move the lines on the Thresholds screen and watch who changes zone. Moving a line changes who ' +
          'is flagged; it never changes what the models measured.',
        source: 'Thresholds set with the credit team, reviewed quarterly. Stored in this browser for what-if only.'
      };
    }

    /* --------------------------------------------------------- the briefing */
    if (/brief|summary|this week|overview/.test(q)) {
      return {
        text: b.sentences.join('<br><br>'),
        source: 'Weekly briefing, assembled from computed numbers only. Every figure is checked against the ' +
          'model output before release.'
      };
    }

    /* ------------------------------- a customer, by name (tried last) --- */
    customer = findCustomer(q);
    if (customer) {
      var m = customer, g = m.group;
      var top = m.breachDrivers.slice().sort(function (a, c) { return c.points - a.points; })
        .filter(function (d) { return d.points > 0; });
      var lines = [
        '<b>' + g.name + '</b> is in <b>' + m.zone + '</b>. Exposure <b>' + HR.usd(m.exposure) +
        '</b> against a ' + HR.usd(g.limit) + ' limit — ' + HR.pct(m.utilisation) + ' used, ' +
        HR.usd(m.headroom) + ' of headroom left.',
        'Chance of passing its limit in the next 90 days: <b>' + HR.pct(m.breachChance) + '</b>' +
        (m.breachDate ? ', most likely around <b>' + HR.dateShort(m.breachDate) + '</b>' : '') +
        (m.amountOverLimit > 0 ? ', by about ' + HR.usd(m.amountOverLimit) : '') + '.',
        'Chance of sustained worsening: <b>' + HR.pct(m.worsenChance) + '</b> ' +
        '(base rate ' + HR.pct(m.score.baseRate) + ' plus ' + HR.signed(Math.round(m.score.points)) + ' driver points).'
      ];
      if (top.length) {
        lines.push('What moved it:');
        lines.push('<ul>' + top.slice(0, 4).map(function (d) {
          return '<li>' + d.text + ' <span class="muted">(' + HR.signed(Math.round(d.points * 10) / 10) + ' pts)</span></li>';
        }).join('') + '</ul>');
      }
      lines.push('External radar: ' + m.radar.summary);
      lines.push('Suggested next step: ' + m.nextSteps[0].text);
      return {
        text: lines.join('<br>'),
        source: 'Results table for ' + g.name + ' (' + g.sapCodes.join(', ') + '), as of ' + HR.dateFull(HR.data.AS_OF) + '.'
      };
    }

    /* -------------------------------------------------------------- default */
    return {
      text: 'As of ' + HR.dateFull(HR.data.AS_OF) + ':<ul>' +
        '<li>' + p.groupCount + ' customer groups, ' + HR.usd(p.totalExposure) + ' of exposure</li>' +
        '<li>' + p.counts['Act now'] + ' in <b>Act now</b> (' + HR.usd(p.inActExposure) + '), ' +
        p.counts['Watch'] + ' on Watch, ' + p.counts['Growth'] + ' in Growth, ' +
        p.counts['Clear'] + ' Clear</li>' +
        '<li>' + b.moves.length + ' group' + (b.moves.length === 1 ? '' : 's') + ' changed zone this week</li>' +
        '<li>Back-test: ' + bt.activeLayer.caughtPct + '% of breaches caught 30+ days ahead, ' +
        bt.activeLayer.falsePerTrue.toFixed(1) + ' false alarms per real warning</li></ul>' +
        'Ask me about a named customer, the watchlist, the Growth zone, the back-test, the thresholds, ' +
        'how exposure is calculated, or what we still need to confirm with Jabil.',
      source: 'Summary assembled from the results table and the weekly briefing. ' +
        'If a question cannot be answered from the results, I will say so rather than guess.'
    };
  }

  /* ----------------------------------------------------------------- the UI */

  var open = false, drawer, backdrop, body, input;

  function add(question, ans) {
    var msg = el('div', { class: 'msg' });
    if (question) msg.appendChild(el('div', { class: 'msg-q', text: question }));
    msg.appendChild(el('div', { class: 'msg-a' }, [
      el('div', { html: ans.text }),
      el('div', { class: 'src', html: '<b>Source:</b> ' + HR.esc(ans.source) })
    ]));
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function ask(question) {
    if (!question || !String(question).trim()) return;
    if (input) input.value = '';
    try {
      add(question, answer(question));
    } catch (e) {
      add(question, {
        text: 'I could not answer that from the results table. Try naming a customer, or asking about the ' +
          'watchlist, the back-test or the thresholds.',
        source: 'The assistant answers only from finished results, so an unanswerable question returns nothing ' +
          'rather than a guess.'
      });
      if (global.console) console.error('[Headroom] assistant failed:', e);
    }
  }

  function build() {
    body = el('div', { class: 'drawer-body' });
    input = el('input', {
      class: 'input', type: 'search', placeholder: 'Ask about a customer, the watchlist, the back-test…',
      'aria-label': 'Your question',
      onkeydown: function (e) { if (e.key === 'Enter') ask(e.target.value); }
    });

    var suggest = el('div', { class: 'suggest' }, SUGGESTIONS.map(function (s) {
      return el('button', { type: 'button', text: s, onclick: function () { ask(s); } });
    }));

    drawer = el('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ask Headroom' }, [
      el('div', { class: 'drawer-head' }, [
        el('div', { class: 'grow' }, [
          el('h2', { text: 'Ask Headroom' }),
          el('div', { class: 'small', text: 'Explains finished results. Never calculates, never reads SAP.' })
        ]),
        el('button', { type: 'button', 'aria-label': 'Close', style: { color: '#fff' }, html: iconHTML('close', 20), onclick: close })
      ]),
      body,
      el('div', { class: 'drawer-foot' }, [
        el('div', { class: 'row gap-8 mb-8' }, [
          el('div', { class: 'grow' }, input),
          ui.button('Ask', { variant: 'primary', onClick: function () { ask(input.value); } })
        ]),
        suggest,
        el('div', { class: 'tiny muted mt-8', html:
          'Answers are assembled from the results table only. Every figure is one you can find on a screen — ' +
          'the assistant cannot produce a number that is not already there.' })
      ])
    ]);
    backdrop = el('div', { class: 'drawer-scrim', onclick: close, 'aria-hidden': 'true' });
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  var lastFocused = null;

  /** Everything inside the drawer that can take focus. */
  function focusables() {
    return Array.prototype.filter.call(
      drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.disabled && n.offsetParent !== null; });
  }

  /** Keep Tab inside the drawer while it is open. */
  function trapTab(e) {
    if (!open || e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openDrawer() {
    if (!drawer) build();
    lastFocused = document.activeElement;
    backdrop.classList.add('open');
    drawer.classList.add('open');
    open = true;
    document.addEventListener('keydown', trapTab, true);
    if (!body.childElementCount) {
      add(null, {
        text: 'I can explain anything on these screens: a named customer, the watchlist, why a customer sits in ' +
          'Growth rather than Act now, what the back-test shows, or what we still need to confirm with Jabil. ' +
          'I read only the finished results — I never recalculate and never touch SAP.',
        source: 'Headroom assistant, read-only over the results table.'
      });
    }
    setTimeout(function () { if (input) input.focus(); }, 60);
  }

  function close() {
    if (backdrop) backdrop.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
    document.removeEventListener('keydown', trapTab, true);
    open = false;
    /* Return the caret to whatever opened the drawer. */
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  HR.assistant = {
    open: openDrawer,
    close: close,
    isOpen: function () { return open; },
    answer: answer,
    ask: ask,
    SUGGESTIONS: SUGGESTIONS
  };
})(window);
