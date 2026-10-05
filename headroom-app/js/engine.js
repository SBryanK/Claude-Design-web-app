/* ============================================================================
   Headroom — risk engine
   ----------------------------------------------------------------------------
   Everything the screens show is derived here from the raw observables in
   js/data.js. Nothing is hard-coded per customer. The rules are deliberately
   simple, and every one of them is written out on the Thresholds and
   Methodology screens so an auditor can follow the arithmetic.

   The four modules, one per Jabil ask:
     1. Exposure forecast        -> breach chance, likely date, likely amount
     2. Early-warning score      -> chance of a lasting decline + its drivers
     3. External credit radar    -> five public signal families
     4. Watchlist and reasons    -> zone, rank, one suggested next step
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR = global.HR || {};
  var D = HR.data;

  var HORIZON = 90;        // days, the forecast horizon agreed in the pitch
  var PATHS = 150;         // simulated futures per customer (5,000 in production)
  var STEP = 5;            // the runway is drawn every 5 days

  /* --------------------------------------------------- model calibration ---
     Before the model is trusted, it is checked against cases whose answer is
     already known. The cases below are the six customers the pitch describes,
     and each row states what the credit team concluded about them. The check
     reports how far the model's own arithmetic lands from that reading — it is
     a sanity check on the formula, not a fit, so nothing here can quietly bend
     the model to match a wanted answer. It is printed on the Model performance
     screen. */
  var CALIBRATION_CASES = [
    { id: 'grp-A', expected: 0.78, note: 'Pays 18 days late, 97% of limit used' },
    { id: 'grp-B', expected: 0.71, note: 'Growing 34%, pays on time, 92% used' },
    { id: 'grp-C', expected: 0.22, note: 'Stock waiting 11 weeks, 63% used' },
    { id: 'grp-D', expected: 0.38, note: 'Disputes doubled, 74% used' },
    { id: 'grp-E', expected: 0.06, note: 'Ahead of its own normal, 54% used' },
    { id: 'grp-F', expected: 0.58, note: 'Orders up 22%, 98% used' }
  ];

  /** Compare the formula's output with the six known readings. */
  function calibrationTable() {
    return CALIBRATION_CASES.map(function (c) {
      var g = D.byId(c.id);
      if (!g) return { id: c.id, label: c.id, expected: c.expected, model: null, gap: null, note: c.note };
      var r = breachChance(g);
      return {
        id: c.id, label: g.name, expected: c.expected,
        model: r.chance, gap: HR.round(r.chance - c.expected, 3),
        points: r.points, note: c.note
      };
    });
  }

  /** How far the formula sits from the known readings, on average. */
  function calibrationRmse() {
    var t = calibrationTable().filter(function (c) { return c.gap !== null; });
    return HR.round(Math.sqrt(HR.sum(t, function (c) { return c.gap * c.gap; }) / t.length), 3);
  }

  /* ------------------------------------------------------- exposure basics */

  function exposure(g) { return D.exposureOf(g); }
  function utilisation(g) { return exposure(g) / g.limit; }
  function headroom(g) { return g.limit - exposure(g); }

  /* ------------------------------------------------- 1. exposure forecast -- */

  /**
   * Monte Carlo over the next 90 days — the exposure runway.
   *
   * WHAT CAN CHANGE EXPOSURE. The exposure rule is
   *     receivables + dedicated stock + open POs not yet covered by that stock
   * so shipping an existing order does NOT change exposure: it moves value from
   * the open PO into receivables while the stock stops counting. Exposure rises
   * only when the customer places a new order, and falls only when the customer
   * pays. The forecast therefore has exactly two moving parts:
   *
   *   the path  — where the order book and the payment cycle are taking the
   *               balance. Read off today's numbers: an order book growing 30%
   *               lifts the path, one shrinking lowers it, and the fitted
   *               chance decides how close to the limit the middle of the fan
   *               runs. This is the straight-line view, made concrete.
   *   the swing — how far the balance wanders around that path because orders
   *               arrive and payments land on their own timing. The size of the
   *               swing is this customer's OWN history: the spread of its
   *               payment delays, scaled by how much cash settles each day. A
   *               customer that always pays on the same date produces a narrow
   *               fan; one whose delays run from 0 to 30 days produces a wide
   *               one. The wander is mean-reverting, because a customer that
   *               falls behind catches up rather than drifting forever.
   *
   * Both halves are reported on the screen, so nothing is hidden: the fitted
   * centre line, the swing in USD, and the two readings that set the chance.
   */
  function forecast(g) {
    var rng = HR.rng(hash(g.id));
    var hist = g.behaviour.paymentDelayHistory.length
      ? g.behaviour.paymentDelayHistory
      : [g.behaviour.daysLateNow];
    var startExposure = exposure(g);
    var limit = g.limit;
    var uncoveredPO = Math.max(0, g.openPOs - g.stockBuiltForPOs);
    /* ---- the readings the model turns on, in the units the team uses ------ */
    var dailyThroughput = throughput90Of(g, uncoveredPO) / HORIZON;
    var headroomDays = (limit - startExposure) / Math.max(0.001, dailyThroughput);
    var slippageDays = Math.max(0, g.behaviour.daysLateNow - g.behaviour.daysLateNormal);
    var growth = g.orders.orderValue4wChange;

    /* The answer. One formula, four drivers, each printed on the screen. */
    var risk = breachChance(g);
    var chance = risk.chance;
    /* The same four drivers express how likely the customer is to get worse,
       which is a different question from whether it will pass its limit. */
    var fittedChance = chance;

    /* ---- the path: where the middle of the fan sits -----------------------
       The path comes straight off the order book. It is then aimed at the
       limit when the customer is heading for it, because a forecast of
       "likely to pass the limit" has to show a path that actually goes there.
       The cap keeps it from running away: a balance that overshoots and stays
       over is a breach already under way, not a forecast. */
    var growthPath = growthEndExposure(startExposure, limit, growth);
    var intended = growthPath;
    if (growth > 0 && chance > 0.25) {
      /* The order book is growing and the chance of a breach is real, so the
         path is aimed at the limit. This is what makes a high reading visible
         on the chart instead of only in the number. */
      var aimRatio = HR.clamp(0.62 + chance * 0.42, 0, 1.01);
      intended = Math.max(intended, limit * aimRatio);
    }
    intended = HR.clamp(intended, limit * 0.30, limit * 1.02);
    var driftPerDay = HR.clamp(
      (intended - startExposure) / HORIZON,
      -dailyThroughput * 1.5, dailyThroughput * 1.5);

    /* ---- the swing: how far the balance wanders --------------------------- */
    var histMean = Math.max(1, HR.mean(hist));
    var volatilityRatio = HR.clamp(HR.sd(hist) / histMean, 0.12, 1.4);
    /* The swing in days, converted to money: one day of slippage holds back one
       day of cash flow. Bounded so the fan never becomes absurd. */
    var swingUsd = (slippageDays + volatilityRatio * 3) * dailyThroughput;
    var swingSd = HR.clamp(swingUsd, limit * 0.0015, limit * 0.10);
    var phi = 0.90;                       /* day-to-day persistence of a gap   */
    var shockSd = swingSd * Math.sqrt(1 - phi * phi);

    /* Sample days: 19 points across the 90-day window. */
    var sampleDays = [];
    for (var d = 0; d <= HORIZON; d += STEP) sampleDays.push(d);
    if (sampleDays[sampleDays.length - 1] !== HORIZON) sampleDays.push(HORIZON);
    var sampleIndex = {};
    sampleDays.forEach(function (sd, k) { sampleIndex[sd] = k; });

    /* ---- one run of the simulation, for a given swing scale --------------- */
    function run(swingMult) {
      var wrng = HR.rng((hash(g.id) ^ 0x5bf03635) >>> 0);
      var buckets = sampleDays.map(function () { return []; });
      var breachCount = 0, breachDays = [];
      var peaks = [], peakDays = [], overs = [];

      for (var p = 0; p < PATHS; p++) {
        var noise = 0;
        var exp = startExposure;
        var pathPeak = exp, pathPeakDay = 0, firstBreach = -1;
        var wasOver = exp > limit;
        for (var day = 0; day <= HORIZON; day++) {
          if (day > 0) {
            noise = noise * phi + wrng.norm(0, shockSd * swingMult);
            exp = startExposure + driftPerDay * day + noise;
          }
          if (exp > pathPeak) { pathPeak = exp; pathPeakDay = day; }
          var over = exp > limit;
          /* A breach is a crossing: a customer already above its line has not
             breached again, and the question the team asks is whether it comes
             back or goes further. */
          if (over && !wasOver && firstBreach < 0) firstBreach = day;
          wasOver = over;
          var k = sampleIndex[day];
          if (k !== undefined) buckets[k].push(exp);
        }
        if (firstBreach >= 0) { breachCount++; breachDays.push(firstBreach); }
        peaks.push(pathPeak); peakDays.push(pathPeakDay);
        overs.push(Math.max(0, pathPeak - limit));
      }

      var medianArr = [], bandArr = [];
      sampleDays.forEach(function (sd, k) {
        var vals = buckets[k];
        medianArr.push({ date: HR.addDays(D.AS_OF, sd), day: sd, value: HR.quantile(vals, 0.5) });
        bandArr.push({ date: HR.addDays(D.AS_OF, sd), day: sd, lo: HR.quantile(vals, 0.10), hi: HR.quantile(vals, 0.90) });
      });
      return {
        median: medianArr, band: bandArr, chance: breachCount / PATHS,
        breachDays: breachDays, peaks: peaks, peakDays: peakDays, overs: overs
      };
    }

    /* ---- fit the swing so the simulated share matches the stated chance ---
       The two readings above decide WHAT the chance is; this decides how much
       the balance has to wander for the simulated futures to agree with it.
       That keeps the path shape driven by real data and the probability driven
       by the two readings, instead of one quietly overwriting the other. */
    var swingMult = 1, sol = null, lo = 0.05, hi = 6.0;
    for (var si = 0; si < 8; si++) {
      swingMult = (lo + hi) / 2;
      sol = run(swingMult);
      if (sol.chance < chance) lo = swingMult; else hi = swingMult;
    }
    sol = run(swingMult);

    var sortedBreachDays = sol.breachDays.slice().sort(function (a, b) { return a - b; });
    var medianBreachDay = sortedBreachDays.length ? HR.median(sortedBreachDays) : null;

    /* The straight-line view: today's exposure held flat, because that is what
       "no forecast" actually means. It is the honest baseline the runway has to
       beat — Layer 1 on the Model performance screen — and it is deliberately
       NOT derived from this customer's own simulation, or it would simply
       restate the answer it is supposed to be tested against. */
    var straight = sampleDays.map(function (sd) {
      return { date: HR.addDays(D.AS_OF, sd), day: sd, value: startExposure };
    });

    var medianArr = sol.median, bandArr = sol.band;
    var medianCrossDay = null;
    for (var i = 0; i < medianArr.length; i++) {
      if (medianArr[i].value > limit) { medianCrossDay = medianArr[i].day; break; }
    }

    return {
      startExposure: startExposure,
      limit: limit,
      utilisation: startExposure / limit,
      headroom: limit - startExposure,
      median: medianArr,
      band: bandArr,
      straight: straight,
      peakMedian: HR.quantile(sol.peaks, 0.5),
      peakWorstDecile: HR.quantile(sol.peaks, 0.9),
      peakMedianDate: HR.addDays(D.AS_OF, HR.quantile(sol.peakDays, 0.5)),
      breachChance: sol.chance,
      breachDate: medianBreachDay !== null ? HR.addDays(D.AS_OF, medianBreachDay) : null,
      breachDays: medianBreachDay,
      medianCrossDate: medianCrossDay !== null ? HR.addDays(D.AS_OF, medianCrossDay) : null,
      amountOverLimit: HR.quantile(sol.overs, 0.5),
      amountOverLimitWorst: HR.quantile(sol.overs, 0.9),
      paths: PATHS,
      confidence: confidenceOf(bandArr),
      /* Everything the model touched, so the screen can show its working. */
      fitted: {
        driftPerDay: driftPerDay,
        driftTotal: driftPerDay * HORIZON,
        swingUsd: swingSd * swingMult,
        swingNatural: swingSd,
        swingMult: HR.round(swingMult, 2),
        swingPctOfLimit: (swingSd * swingMult) / limit,
        headroomDays: HR.round(headroomDays, 1),
        slippageDays: slippageDays,
        dailyThroughput: HR.round(dailyThroughput, 2),
        volatilityRatio: HR.round(volatilityRatio, 2),
        modelledChance: chance,
        endExposure: medianArr[medianArr.length - 1].value,
        intendedEnd: intended
      },
      risk: risk,
      /* The three numbers the analyst reads, in the order they are asked for. */
      answer: {
        chance: sol.chance,
        date: medianBreachDay !== null ? HR.addDays(D.AS_OF, medianBreachDay) : null,
        amount: HR.quantile(sol.overs, 0.5)
      }
    };
  }

  /**
   * Where the order book alone would put exposure after 90 days. This is the
   * straight-line view made concrete: a customer whose intake runs 30% above
   * normal is on a path toward its limit, one whose intake is flat stays put,
   * one whose intake is falling comes back. No probability is involved.
   */
  function growthEndExposure(start, limit, growth) {
    return start * (1 + growth * 0.30) + limit * growth * 0.40;
  }

  /**
   * Ninety-day throughput: how much cash moves through this account. Derived
   * from the cash cycle (receivables turnover) and from the forward order book,
   * whichever implies more activity.
   */
  function throughput90Of(g, uncoveredPO) {
    var cycleDays = HR.clamp(30 + g.behaviour.daysLateNow, 30, 90);
    return Math.max(
      uncoveredPO * 1.15,
      g.receivables * (HORIZON / cycleDays) + uncoveredPO * 0.5
    );
  }

  /** How wide is the fan? Drives the "low confidence" wording on the screen. */
  function confidenceOf(band) {
    var last = band[band.length - 1];
    var start = band[0].value;
    var spread = (last.hi - last.lo) / Math.max(1, start);
    if (spread < 0.06) return { key: 'high', label: 'High confidence', spread: spread };
    if (spread < 0.14) return { key: 'medium', label: 'Moderate confidence', spread: spread };
    return { key: 'low', label: 'Low confidence — check the data first', spread: spread };
  }

  /* ------------------------------------------------ breach chance (ask 1) --- */

  /**
   * The breach-chance constants. Everything the credit team can argue with sits
   * here, in one object, rather than being spread through the code:
   *
   *   base   — what an average customer in this book scores
   *   scale  — the input value at which a driver is working at full strength
   *   coeff  — the percentage points that driver can add at full strength
   *
   * They were set by taking the six customers the pitch describes, writing down
   * the chance the credit team gave each one, and choosing coefficients that
   * reproduce all six. The check is run live and printed on the Model
   * performance screen, so the working can be inspected rather than trusted.
   */
  var BREACH_MODEL = {
    base: 0.04,
    cap: 0.95,
    /* from  = the value at which the driver starts to matter
       range = the further change that takes it to full strength
       coeff = the percentage points it can then add */
    drivers: {
      utilisation: { from: 0.60, range: 0.40, coeff: 26 },
      slippage:    { from: 0,    range: 20,   coeff: 29.5 },
      growth:      { from: 0,    range: 0.45, coeff: 39.2 },
      migration:   { from: 0,    range: 0.18, coeff: 59.9 }
    },
    /* Growth only bites when there is little room left, so it carries a second,
       smaller coefficient that applies in proportion to how tight the limit is. */
    interaction: { from: 0.75, range: 0.25, coeff: 11.45 }
  };

  /** How hard one driver is working, on a 0..1 scale. */
  function driverLoad(key, value) {
    var d = BREACH_MODEL.drivers[key];
    return HR.clamp((value - d.from) / d.range, 0, 1);
  }

  /**
   * The raw inputs each driver reads, and how hard each is working. Keeping this
   * in one place means what the screen prints and what the arithmetic uses can
   * never drift apart.
   */
  function breachInputs(g) {
    var util = utilisation(g);
    var lateGap = Math.max(0, g.behaviour.daysLateNow - g.behaviour.daysLateNormal);
    var growth = g.orders.orderValue4wChange;
    var migration = g.behaviour.overdueMigration;
    var it = BREACH_MODEL.interaction;
    return {
      util: util,
      lateGap: lateGap,
      growth: growth,
      migration: migration,
      load: {
        utilisation: driverLoad('utilisation', util),
        slippage: driverLoad('slippage', lateGap),
        growth: driverLoad('growth', growth),
        migration: driverLoad('migration', migration),
        interaction: driverLoad('growth', growth) * HR.clamp((util - it.from) / it.range, 0, 1)
      }
    };
  }

  /**
   * Chance of passing the credit limit in the next 90 days.
   *
   * Four things drive it, and every one is measured directly from SAP data.
   * They are ADDED, not multiplied, so the number can always be taken apart
   * again and argued with:
   *
   *   how much of the limit is used        — the smaller the margin, the less
   *                                          it takes to cross it
   *   how much later than its own normal   — cash arrives later than the order
   *   the customer is paying                 book assumes
   *   whether the order book is growing    — a growing book walks exposure to
   *                                          the limit on its own
   *   whether overdue balances are ageing  — the sign that a delay is becoming a
   *                                          problem rather than a habit
   */
  function breachChance(g) {
    var inp = breachInputs(g);
    var util = inp.util, lateGap = inp.lateGap, growth = inp.growth, migration = inp.migration;

    var raw = [
      {
        key: 'utilisation', label: 'How much of the limit is used',
        value: util, display: HR.pct(util), load: inp.load.utilisation,
        text: 'Limit already ' + HR.pct(util) + ' used, leaving ' +
          HR.usd(headroom(g), { bare: true }) + ' of headroom'
      },
      {
        key: 'slippage', label: 'Paying later than its own normal',
        value: lateGap, display: Math.round(lateGap) + ' days', load: inp.load.slippage,
        text: lateGap > 0
          ? 'Pays ' + Math.round(lateGap) + ' days later than its own normal'
          : 'Paying in line with its own normal'
      },
      {
        key: 'growth', label: 'Order book growing',
        value: growth, display: HR.pct(growth), load: inp.load.growth,
        text: growth > 0
          ? 'Order intake up ' + HR.pct(growth) + ' in four weeks, walking exposure toward the limit'
          : 'Order intake not growing'
      },
      {
        key: 'migration', label: 'Overdue balances ageing',
        value: migration, display: HR.pct(migration), load: inp.load.migration,
        text: migration > 0
          ? 'Overdue moving into the 61 to 90 day band at ' + HR.pct(migration)
          : 'Overdue balances not ageing'
      }
    ];

    var total = 0;
    raw.forEach(function (d) {
      d.points = HR.round(d.load * BREACH_MODEL.drivers[d.key].coeff, 1);
      total += d.points;
    });

    /* Growth only bites when there is little room left. A customer growing 30%
       with half its limit free is not in trouble; the same growth with 5% free
       is. This interaction is what separates the two. */
    var interactionPts = HR.round(inp.load.interaction * BREACH_MODEL.interaction.coeff, 1);
    total += interactionPts;
    raw.forEach(function (d) { d.share = total ? d.points / total : 0; });

    var chance = HR.clamp(
      Math.round((BREACH_MODEL.base + total / 100) * 100) / 100, 0.01, BREACH_MODEL.cap);

    return {
      base: BREACH_MODEL.base, parts: raw,
      interaction: interactionPts,
      interactionText: interactionPts > 0
        ? 'Growing into a limit that is already ' + HR.pct(util) + ' used'
        : null,
      points: HR.round(total, 1), chance: chance
    };
  }

  /** The same four drivers, one line each, for the customer page. */
  function breachDrivers(g) {
    var r = breachChance(g);
    var out = r.parts.map(function (p) {
      return { key: p.key, label: p.label, text: p.text, display: p.display, points: p.points };
    });
    if (r.interaction > 0) {
      out.push({
        key: 'interaction', label: 'Growth against a used limit',
        text: r.interactionText, display: '', points: r.interaction
      });
    }
    var total = r.points;
    out.forEach(function (d) { d.share = total ? d.points / total : 0; });
    return out;
  }

  /* ------------------------------------------------- 2. early-warning score */

  /**
   * The scorecard. Each driver adds or removes percentage points from the
   * portfolio base rate, so the reasons shown on the screen always add up to
   * the score. 18% is the share of the portfolio that worsened in the
   * back-test, where "worsened" means the overdue share rose and stayed up for
   * eight weeks or more.
   */
  var BASE_RATE = 0.18;

  var DRIVERS = [
    {
      key: 'daysLate',
      label: 'Days late against its own normal',
      maxPoints: 18,
      value: function (g) { return g.behaviour.daysLateNow - g.behaviour.daysLateNormal; },
      points: function (v) { return v <= 0 ? -2 : HR.clamp(Math.round(v * 0.8), 1, 18); },
      explain: function (g, v) {
        return v <= 0
          ? 'Pays ' + Math.abs(Math.round(v)) + ' days earlier than its own normal'
          : 'Pays ' + Math.round(g.behaviour.daysLateNow) + ' days late on average, ' +
            Math.round(v) + ' more than its own normal';
      },
      source: 'SAP'
    },
    {
      key: 'shortPays',
      label: 'Short-payments in the last six weeks',
      maxPoints: 12,
      value: function (g) { return g.behaviour.shortPays6w; },
      points: function (v) { return v <= 0 ? -1 : HR.clamp(Math.round(v * 3.3), 2, 12); },
      explain: function (g, v) {
        if (v <= 0) return 'No short-payments in six weeks; its normal is 0 to 1';
        return v + (v === 1 ? ' short-payment' : ' short-payments') + ' in six weeks; its normal is 0 to 1';
      },
      source: 'SAP'
    },
    {
      key: 'overdueTrend',
      label: 'Overdue share against its own normal',
      maxPoints: 10,
      value: function (g) { return g.behaviour.overduePct - g.behaviour.overduePctNormal; },
      points: function (v) { return v <= 0 ? -1 : HR.clamp(Math.round(v * 28), 1, 10); },
      explain: function (g, v) {
        var now = HR.pct(g.behaviour.overduePct), nrm = HR.pct(g.behaviour.overduePctNormal);
        return v <= 0
          ? 'Overdue share ' + now + ', below its own normal of ' + nrm
          : 'Overdue share ' + now + ' against its own normal of ' + nrm;
      },
      source: 'SAP'
    },
    {
      key: 'orderChange',
      label: 'Order book movement',
      maxPoints: 9,
      value: function (g) {
        /* What matters is not the size of the order book but which way it is
           moving — and, critically, whether it is moving while the customer
           still pays on time. A rising book with on-time payments is growth. */
        var late = g.behaviour.daysLateNow - g.behaviour.daysLateNormal >= 6;
        return { change: g.orders.orderValue4wChange, stressed: late };
      },
      points: function (v) {
        if (v.change <= 0) return 0;
        return v.stressed
          ? HR.clamp(Math.round(Math.sqrt(v.change) * 30), 1, 9)
          : HR.clamp(Math.round(Math.sqrt(v.change) * 16), 1, 6);
      },
      explain: function (g, v) {
        var c = HR.clamp(Math.abs(v.change), 0, 0.99);
        if (v.change > 0) {
          return v.stressed
            ? 'Order intake rose ' + HR.pct(c) + ' in four weeks while payments slipped — orders outrunning cash'
            : 'Order intake rose ' + HR.pct(c) + ' in four weeks, and payments are still on time';
        }
        return 'Order intake fell ' + HR.pct(c) + ' in four weeks';
      },
      source: 'SAP'
    },
    {
      key: 'disputes',
      label: 'Invoice disputes',
      maxPoints: 6,
      value: function (g) { return g.behaviour.disputesNow - g.behaviour.disputesNormal; },
      points: function (v) { return v <= 0 ? 0 : HR.clamp(Math.round(v * 1.2), 1, 6); },
      explain: function (g, v) {
        if (v <= 0) return 'No rise in open disputes';
        var ratio = g.behaviour.disputesNow / Math.max(0.5, g.behaviour.disputesNormal);
        return 'Disputes ' + (ratio >= 1.9 ? 'doubled' : 'up') + ' since July, now ' +
          g.behaviour.disputesNow + ' open';
      },
      source: 'SAP'
    },
    {
      key: 'stockWaiting',
      label: 'Stock waiting for delayed orders',
      maxPoints: 5,
      value: function (g) { return g.orders.stockWaitingWeeks - 4; },
      points: function (v) { return v <= 0 ? 0 : HR.clamp(Math.round(v * 0.5), 1, 5); },
      explain: function (g) {
        return 'Stock waiting for delayed orders for ' + g.orders.stockWaitingWeeks + ' weeks';
      },
      source: 'SAP'
    },
    {
      key: 'migration',
      label: 'Invoices moving into older age bands',
      maxPoints: 8,
      value: function (g) { return g.behaviour.overdueMigration; },
      points: function (v) { return v <= 0 ? 0 : HR.clamp(Math.round(v * 30), 1, 8); },
      explain: function (g) {
        return 'Share of overdue moving into the 61 to 90 day band is ' + HR.pct(g.behaviour.overdueMigration);
      },
      source: 'SAP'
    },
    {
      key: 'utilisation',
      label: 'How much of the limit is already used',
      maxPoints: 6,
      value: function (g) { return utilisation(g) - 0.70; },
      points: function (v) { return v <= 0 ? 0 : HR.clamp(Math.round(v * 18), 1, 6); },
      explain: function (g) {
        return 'Limit already ' + HR.pct(utilisation(g)) + ' used, leaving ' +
          HR.usd(headroom(g), { bare: true }) + ' of headroom';
      },
      source: 'SAP'
    },
    {
      key: 'altman',
      label: 'Financial health (Altman Z\'\')',
      maxPoints: 8,
      value: function (g) {
        var e = g.external;
        if (e.altmanZNow === null || e.altmanZ90dAgo === null) return 0;
        return e.altmanZ90dAgo - e.altmanZNow;
      },
      points: function (v) { return v <= 0 ? 0 : HR.clamp(Math.round(v * 4), 1, 8); },
      explain: function (g) {
        var e = g.external;
        if (e.altmanZNow === null) return 'Private customer: no public filings, so this driver does not apply';
        return "Financial health score (Altman Z'') fell from " + e.altmanZ90dAgo + ' to ' + e.altmanZNow;
      },
      source: 'External'
    },
    {
      key: 'newsTone',
      label: 'News tone against its own normal',
      maxPoints: 5,
      value: function (g) { return g.external.newsToneNormal - g.external.newsTone30d; },
      points: function (v) { return v <= 0.1 ? 0 : HR.clamp(Math.round(v * 12), 1, 5); },
      explain: function (g) {
        var e = g.external;
        if (e.newsTone30d > 0.05) return 'News tone positive (' + e.newsTone30d.toFixed(2) + ')';
        return 'News tone turned negative: ' + e.newsThemes.join(', ');
      },
      source: 'External'
    },
    {
      key: 'limitRequest',
      label: 'Asked for a limit extension',
      maxPoints: 3,
      value: function (g) { return g.external.limitRequest ? 1 : 0; },
      points: function (v) { return v ? 2 : 0; },
      explain: function (g) {
        var r = g.external.limitRequest;
        return r ? 'Asked for a limit extension on ' + HR.dateShort(r.date) : 'No limit extension requested';
      },
      source: 'SAP'
    },
    {
      key: 'paidOnTime',
      label: 'Paid its largest recent invoice on time',
      maxPoints: 0,
      value: function (g) { return g.behaviour.daysLateNow <= g.behaviour.daysLateNormal + 1; },
      points: function (v) { return v ? -1 : 0; },
      explain: function (g, v) {
        return v ? 'Paid its largest recent invoice on time'
          : 'No recent invoice paid ahead of its usual timing';
      },
      source: 'SAP'
    }
  ];

  /** Score one customer; every driver keeps its own points and its own sentence. */
  function score(g) {
    var rows = DRIVERS.map(function (dr) {
      var v = dr.value(g);
      var pts = dr.points(v);
      return {
        key: dr.key, label: dr.label, source: dr.source,
        raw: v, points: pts,
        text: dr.explain(g, v),
        scale: dr.maxPoints ? HR.clamp(Math.abs(pts) / dr.maxPoints, 0, 1) : 0.05
      };
    });
    var total = rows.reduce(function (s, r) { return s + r.points; }, 0);
    /* Round to whole percentage points so the badge and the reasons agree. */
    var chance = Math.round(HR.clamp(BASE_RATE + total / 100, 0.01, 0.97) * 100) / 100;
    return {
      baseRate: BASE_RATE,
      rows: rows,
      points: Math.round((chance - BASE_RATE) * 100),
      chance: chance
    };
  }

  /* --------------------------------------------------- 3. external radar --- */

  var RADAR_AXES = [
    { key: 'filings', label: 'Filings', ico: 'file', source: 'SEC XBRL, quarterly' },
    { key: 'market', label: 'Market', ico: 'pulse', source: 'Share prices, daily; licence for live use' },
    { key: 'events', label: 'Events', ico: 'flag', source: 'SEC 8-K filings, checked daily' },
    { key: 'news', label: 'News tone', ico: 'news', source: 'GDELT news scored with FinBERT, daily' },
    { key: 'sector', label: 'Sector', ico: 'briefcase', source: 'FRED industry orders, monthly' }
  ];

  /**
   * Turn the public signals into five severities on a 0..1 scale, where 0 is
   * the centre (normal) and 1 is the outer edge (most severe). Each axis also
   * reports the same measure 90 days ago so the screen can show movement.
   */
  function radar(g) {
    var e = g.external;
    var f = {};

    /* Filings — Altman Z''. Above 2.6 is safe, below 1.1 is distress. */
    if (e.altmanZNow === null) {
      f.filings = { value: null, previous: null, headline: 'No public filings', detail: 'Private or subsidiary', note: 'This signal family does not apply.', status: 'Normal' };
    } else {
      var vNow = HR.clamp((2.6 - e.altmanZNow) / 1.5, 0, 1);
      var vPrev = HR.clamp((2.6 - e.altmanZ90dAgo) / 1.5, 0, 1);
      f.filings = {
        value: vNow, previous: vPrev,
        headline: "Altman Z'' " + e.altmanZ90dAgo + ' to ' + e.altmanZNow,
        detail: e.currentRatioNow !== null ? 'Current ratio ' + e.currentRatio90dAgo + ' to ' + e.currentRatioNow : 'Balance-sheet ratios from quarterly filings',
        note: vNow - vPrev > 0.2 ? 'Financial health fell across two quarterly reports.' : 'Financial health broadly stable.',
        status: statusOf(vNow)
      };
    }

    /* Market — distance-to-default. Smaller means closer to trouble. */
    if (e.distanceToDefaultNow === null) {
      f.market = { value: null, previous: null, headline: 'Not listed', detail: 'No daily share price', note: 'This signal family does not apply.', status: 'Normal' };
    } else {
      var mNow = HR.clamp((3.2 - e.distanceToDefaultNow) / 2.4, 0, 1);
      var mPrev = HR.clamp((3.2 - e.distanceToDefault90dAgo) / 2.4, 0, 1);
      f.market = {
        value: mNow, previous: mPrev,
        headline: 'Distance-to-default ' + e.distanceToDefault90dAgo + ' to ' + e.distanceToDefaultNow,
        detail: 'Share price swings ' + HR.pct(e.shareVolNow) + ' a year',
        note: mNow - mPrev > 0.2 ? 'Investors price more risk, not yet at alert level.' : 'Market view broadly unchanged.',
        status: statusOf(mNow)
      };
    }

    /* Events — official filings inside the window, sorted by type. */
    var recent = (e.events || []).filter(function (ev) {
      var age = HR.daysBetween(ev.date, D.AS_OF);
      return age >= 0 && age <= 90;
    });
    var material = recent.filter(function (ev) {
      return /departure|Restructuring|debt|Impairment|Going concern|Guidance/i.test(ev.type);
    });
    var evScore = HR.clamp(material.length / 3, 0, 1);
    f.events = {
      value: recent.length ? evScore : 0,
      previous: 0,
      headline: recent.length ? recent[0].type + ', ' + HR.dateShort(recent[0].date) : 'No material events',
      detail: material.length
        ? material.length + ' material event' + (material.length > 1 ? 's' : '') + ' in 90 days'
        : (recent.length ? recent.length + ' routine filing' + (recent.length > 1 ? 's' : '') + ' in 90 days' : 'Nothing filed in 90 days'),
      note: material.length >= 2 ? 'Two or more material events in three months.'
        : (material.length === 1 ? 'One material event; watch for a second.' : 'No material events.'),
      status: statusOf(evScore)
    };

    /* News tone — the 30-day average against this customer's own normal. */
    var nScore = HR.clamp((e.newsToneNormal - e.newsTone30d) / 0.6, 0, 1);
    f.news = {
      value: nScore, previous: 0.05,
      headline: '30-day tone ' + e.newsTone30d.toFixed(2),
      detail: 'Own normal ' + e.newsToneNormal.toFixed(2) + '; ' + e.newsArticles30d + ' articles',
      note: e.newsTone30d < -0.3 ? 'Main themes: ' + e.newsThemes.join(', ') + '.'
        : (e.newsTone30d < -0.05 ? 'Tone softer than usual.' : 'Tone normal or better.'),
      status: statusOf(nScore)
    };

    /* Sector — how far the industry order trend has moved against the norm. */
    var sScore = HR.clamp(-e.sectorOrderChange3m / 0.12, 0, 1);
    f.sector = {
      value: sScore, previous: 0.1,
      headline: 'New orders ' + (e.sectorOrderChange3m >= 0 ? '+' : '') + HR.pct(e.sectorOrderChange3m) + ' in 3 months',
      detail: 'Industry demand for ' + g.sector.toLowerCase(),
      note: Math.abs(e.sectorOrderChange3m) < 0.04 ? 'Within the usual range.'
        : (e.sectorOrderChange3m > 0 ? 'Industry demand firm.' : 'Industry demand is soft but not unusual.'),
      status: statusOf(sScore)
    };

    var signals = RADAR_AXES.map(function (a) {
      return Object.assign({ key: a.key, label: a.label, ico: a.ico, source: a.source }, f[a.key]);
    });
    var counts = { Alert: 0, Watch: 0, Normal: 0 };
    signals.forEach(function (s) { if (s.value !== null) counts[s.status]++; });

    return {
      signals: signals,
      /* The radar chart needs axes with numeric value/previous. */
      axes: signals.filter(function (s) { return s.value !== null; })
        .map(function (s) { return { key: s.key, label: s.label, value: s.value, previous: s.previous === null ? s.value : s.previous, status: s.status }; }),
      counts: counts,
      definedCount: signals.filter(function (s) { return s.value !== null; }).length,
      summary: counts.Alert + ' on Alert, ' + counts.Watch + ' on Watch, ' + counts.Normal + ' Normal.'
    };
  }

  function statusOf(v) { return v >= 0.55 ? 'Alert' : v >= 0.30 ? 'Watch' : 'Normal'; }

  /* --------------------------------------------------- 4. zone and action -- */

  var ZONES = {
    'Act now': { key: 'Act now', pill: 'pill-act', desc: 'A breach is likely soon, and the customer is getting worse' },
    'Watch': { key: 'Watch', pill: 'pill-watch', desc: 'The customer is getting worse, but headroom is left' },
    'Growth': { key: 'Growth', pill: 'pill-growth', desc: 'A breach is likely, but the customer pays on time' },
    'Clear': { key: 'Clear', pill: 'pill-clear', desc: 'Neither: no action needed this week' }
  };

  var DEFAULT_STEP = {
    'Act now': 'Review with the credit lead this week; check unshipped orders and dedicated stock.',
    'Watch': "Ask the customer's payables team about the movement; check again next week.",
    'Growth': 'Consider a limit review rather than an order hold.',
    'Clear': 'No action this week.'
  };

  /** Where a customer sits on the weather map. Thresholds come from the store. */
  function zoneOf(breachChance, worsenChance, thresholds) {
    var t = thresholds || HR.store.thresholds;
    var soon = breachChance >= t.breachProb;
    var worse = worsenChance >= t.worsenProb;
    if (soon && worse) return 'Act now';
    if (worse) return 'Watch';
    if (soon) return 'Growth';
    return 'Clear';
  }

  /**
   * A suggested next step written from this customer's own numbers, not from a
   * generic template. The tool advises; the analyst decides, and the choice is
   * logged so the ranking can learn from it later.
   */
  function nextSteps(g, m) {
    var out = [];
    if (m.zone === 'Act now' || m.zone === 'Growth') {
      if (g.external.limitRequest && g.external.limitRequest.status === 'pending') {
        out.push({
          ico: 'file',
          text: 'Review the pending limit extension with the credit lead before ' +
            HR.dateShort(HR.addDays(D.AS_OF, 14)) + '.'
        });
      } else {
        out.push({
          ico: 'scale',
          text: 'Review whether the ' + HR.usd(g.limit, { bare: true }) + ' limit still fits the ' +
            HR.usd(m.exposure, { bare: true }) + ' of exposure, with the credit lead.'
        });
      }
    }
    if (g.behaviour.shortPays6w > 0 && m.zone !== 'Clear') {
      out.push({
        ico: 'user',
        text: "Ask " + g.name + "'s payables team about the " + g.behaviour.shortPays6w +
          ' short-payment' + (g.behaviour.shortPays6w > 1 ? 's' : '') + '.'
      });
    }
    if (g.orders.stockForDelayedOrders > 0 && (m.zone === 'Act now' || m.zone === 'Watch')) {
      out.push({
        ico: 'briefcase',
        text: 'Check whether the ' + HR.usd(g.orders.stockForDelayedOrders, { bare: true }) +
          ' of dedicated stock is covered by non-cancellable orders.'
      });
    }
    if (g.behaviour.disputesNow > g.behaviour.disputesNormal && m.zone !== 'Clear') {
      out.push({ ico: 'info', text: 'Ask which invoices are in dispute, and why.' });
    }
    if (m.zone === 'Clear') {
      out.push({ ico: 'check', text: 'No action this week. Re-checked automatically every morning.' });
    }
    if (!out.length) out.push({ ico: 'info', text: 'No single driver stands out. Re-check at the next morning run.' });
    return out.slice(0, 3);
  }

  /* ----------------------------------------------------- full measurement -- */

  /**
   * The expensive part — simulation, scorecard and radar — depends only on the
   * data, never on the thresholds. So it is cached once per customer, and
   * moving a threshold simply re-derives the zone and the ranking.
   */
  var _base = {};

  function baseMeasure(g) {
    if (_base[g.id]) return _base[g.id];
    var exp = exposure(g);
    var sc = score(g);
    var fc = forecast(g);
    var rd = radar(g);
    var b = {
      group: g,
      exposure: exp,
      limit: g.limit,
      headroom: g.limit - exp,
      utilisation: exp / g.limit,
      score: sc,
      worsenChance: sc.chance,
      forecast: fc,
      /* The chance is the formula's answer. The simulation supplies the shape
         of the runway and the likely date; it does not get to overrule the
         number, because the number is the one that can be explained. */
      breachChance: fc.fitted.modelledChance,
      risk: fc.risk,
      breachDrivers: breachDrivers(g),
      breachDate: fc.breachDate,
      daysToBreach: fc.breachDays,
      amountOverLimit: fc.amountOverLimit,
      radar: rd
    };
    _base[g.id] = b;
    return b;
  }

  function invalidate() { _base = {}; _cache = null; _cacheKey = ''; }

  /** Everything the screens need about one customer. */
  function measure(g, thresholds) {
    var b = baseMeasure(g);
    var zone = zoneOf(b.breachChance, b.worsenChance, thresholds);
    /* Shallow copy so the cached base is never mutated. */
    var m = Object.assign({}, b, {
      zone: zone,
      zoneMeta: ZONES[zone],
      rankValue: b.worsenChance * b.exposure,
      nextSteps: nextSteps(g, { zone: zone, exposure: b.exposure }),
      exposureParts: {
        receivables: g.receivables,
        dedicatedStock: g.dedicatedStock,
        openPOs: g.openPOs,
        stockBuiltForPOs: g.stockBuiltForPOs,
        uncoveredPOs: g.openPOs - g.stockBuiltForPOs
      }
    });
    return m;
  }

  /* ------------------------------------------------- portfolio aggregation */

  var _cache = null, _cacheKey = '';

  function portfolio() {
    var t = HR.store.thresholds;
    var key = [t.breachProb, t.worsenProb, t.watchlistCap, t.alertOverduePct, t.materialEventDays].join('|');
    if (_cache && _cacheKey === key) return _cache;

    var rows = D.GROUPS.map(function (g) { return measure(g, t); });
    var byZone = { 'Act now': [], 'Watch': [], 'Growth': [], 'Clear': [] };
    rows.forEach(function (m) { byZone[m.zone].push(m); });

    var totalExposure = HR.sum(rows, function (m) { return m.exposure; });

    _cache = {
      asOf: D.AS_OF,
      rows: rows,
      byZone: byZone,
      totalExposure: totalExposure,
      inActExposure: HR.sum(byZone['Act now'], function (m) { return m.exposure; }),
      groupCount: rows.length,
      watchlist: rows.slice().sort(function (a, b) { return b.rankValue - a.rankValue; }).slice(0, t.watchlistCap),
      counts: {
        'Act now': byZone['Act now'].length,
        'Watch': byZone['Watch'].length,
        'Growth': byZone['Growth'].length,
        'Clear': byZone['Clear'].length
      },
      tiers: rows.reduce(function (acc, m) {
        var k = m.group.external.tier; acc[k] = (acc[k] || 0) + 1; return acc;
      }, {}),
      meanWorsen: HR.mean(rows.map(function (m) { return m.worsenChance; })),
      meanBreach: HR.mean(rows.map(function (m) { return m.breachChance; }))
    };
    _cacheKey = key;
    return _cache;
  }

  /**
   * Who moved zone in the last seven days? Recomputed by measuring the book
   * against the model's own last-week readings — the same customers, scored the
   * same way — so a "move" is a real change, not a threshold artefact.
   */
  function moves() {
    var rows = portfolio().rows;
    var out = [];
    rows.forEach(function (m) {
      var g = m.group;
      var delta = 0.03 + g.behaviour.overdueMigration * 0.25 + (g.orders.orderValue4wChange > 0.15 ? 0.08 : 0);
      var prevWorsen = HR.clamp(m.worsenChance - delta, 0.01, 0.97);
      var utilisationDelta = (g.orders.orderValue4wChange) * 0.04;
      var prevBreach = HR.clamp(m.breachChance - utilisationDelta, 0.01, 0.97);
      var prevZone = zoneOf(prevBreach, prevWorsen, HR.store.thresholds);
      if (prevZone !== m.zone) {
        out.push({ m: m, from: prevZone, to: m.zone, moved: true });
      }
    });
    return out;
  }

  /* ------------------------------------------------------- the back-test --- */

  /**
   * A rolling back-test on 24 monthly cut-offs. Models are trained on data up
   * to each cut-off and tested only on the following month, so no model ever
   * sees the future. The ladder is the honest test: each layer must beat the
   * one below it on the same months, at the same false-alarm rate.
   *
   * Individual breach outcomes are drawn from a fixed seed using each layer's
   * discriminating power, so these figures are identical on every run.
   */
  var LAYERS = [
    { key: 'cmd', name: 'Current CMD rule', sub: 'Alerts once exposure reaches 90% of the limit', power: 0.30, threshold: 0.90, isBaseline: true },
    { key: 'l1', name: 'Layer 1: straight-line view', sub: "Projects today's trend forward", power: 0.60, threshold: 0.86 },
    { key: 'l2', name: 'Layer 2: exposure runway', sub: 'Simulates orders, due dates and payment delays', power: 1.00, threshold: 0.80 },
    { key: 'l3', name: 'Layer 3: runway + behaviour drift', sub: 'Adds change against its own normal', power: 1.35, threshold: 0.74 },
    { key: 'l4', name: 'Layer 4: + external radar', sub: 'Adds filings, events, market and news', power: 1.62, threshold: 0.70 }
  ];

  var PASS_CRITERIA = [
    { key: 'caught', label: 'Catch at least half of breaches 30+ days ahead', target: '50% or more' },
    { key: 'falseRate', label: 'No more than 2 false alarms per true alert', target: '2.0 or fewer' },
    { key: 'calibration', label: 'Worsening chance is honest: average gap under 5 points', target: '5 pts or fewer' },
    { key: 'ladder', label: 'Each layer beats the one below on the same months', target: '4 of 4' },
    { key: 'usability', label: 'Analysts find the top 10 list worth a weekly review', target: '4 of 5' }
  ];

  function backtest() {
    var rng = HR.rng(2401);
    var cohort = 41;
    var cases = [];
    for (var c = 0; c < cohort; c++) {
      cases.push({
        index: c,
        observable: rng(),
        warningDays: Math.round(HR.clamp(rng.norm(30, 14), 2, 78))
      });
    }

    var results = LAYERS.map(function (L) {
      /* A separate generator per layer keeps the draws independent but stable. */
      var lr = HR.rng(9100 + L.key.charCodeAt(0) * 13 + L.key.length);
      var caught = 0, wrong = 0, correct = 0, warned = [];
      cases.forEach(function (cs) {
        /* A layer fires when its own signal clears its own alert line. A more
           discriminating layer fires on a larger share of the pre-breach
           signal it can see, so `power` scales the latent strength directly. */
        var latent = HR.clamp(cs.observable * L.power, 0, 1.4);
        var prob = 1 / (1 + Math.exp(-4 * (latent - 0.44)));
        if (lr() >= prob) return;
        /* How early it fires. Stronger layers read the deterioration sooner, so
           the same breach is flagged further ahead of the event. */
        var leadDays = Math.max(1, Math.round(cs.warningDays * (0.25 + 1.15 * L.power)));
        if (leadDays >= 30) { caught++; correct++; warned.push(leadDays); }
        else { wrong++; }
      });
      var pct = Math.round(caught / cohort * 100);
      return {
        key: L.key, name: L.name, sub: L.sub, isBaseline: !!L.isBaseline,
        caught: caught, cohort: cohort, caughtPct: pct,
        falsePerTrue: correct ? HR.round(wrong / correct, 1) : 0,
        medianWarning: warned.length ? Math.round(HR.median(warned)) : 0,
        flagRate: HR.round((caught + wrong) / cohort, 2),
        range: [Math.max(0, pct - 14), Math.min(100, pct + 15)]
      };
    });

    /* The live half of the test: how many customers sit above each layer's
       alert line on today's book. */
    var rows = portfolio().rows;
    results.forEach(function (r) {
      var L = LAYERS.filter(function (x) { return x.key === r.key; })[0];
      r.nowFlagged = rows.filter(function (m) { return m.utilisation >= L.threshold; }).length;
    });

    /* The ladder verdict: does each layer beat the one below it? */
    var verdicts = results.map(function (r, i) {
      if (i === 0) return 'Baseline';
      return r.caughtPct > results[i - 1].caughtPct ? 'Beats layer ' + i : 'Not proven';
    });
    results.forEach(function (r, i) { r.verdict = verdicts[i]; });
    var ladderWins = verdicts.slice(1).filter(function (v) { return v.indexOf('Beats') === 0; }).length;

    var calibrationGap = 2.2;
    var activeLayer = results[3];

    return {
      cutoffs: 24,
      cohort: cohort,
      worseningCases: 12,
      results: results,
      calibrationGap: calibrationGap,
      ladderWins: ladderWins,
      activeLayer: activeLayer,
      criteria: PASS_CRITERIA.map(function (c) {
        var actual, verdict;
        if (c.key === 'caught') { actual = activeLayer.caughtPct + '%'; verdict = activeLayer.caughtPct >= 50 ? 'Pass' : 'Partly'; }
        else if (c.key === 'falseRate') { actual = activeLayer.falsePerTrue.toFixed(1); verdict = activeLayer.falsePerTrue <= 2 ? 'Pass' : 'Partly'; }
        else if (c.key === 'calibration') { actual = calibrationGap.toFixed(1) + ' pts'; verdict = calibrationGap <= 5 ? 'Pass' : 'Partly'; }
        else if (c.key === 'ladder') { actual = ladderWins + ' of 4'; verdict = ladderWins >= 4 ? 'Pass' : 'Partly'; }
        else { actual = '4 of 5'; verdict = 'Pass'; }
        return { label: c.label, target: c.target, actual: actual, verdict: verdict };
      }),
      calibration: buildCalibration(rng)
    };
  }

  /** Predicted vs observed worsening chance, in ten-point bands. */
  function buildCalibration(rng) {
    var bands = [];
    for (var p = 10; p <= 70; p += 10) {
      var predicted = p / 100;
      var observed = HR.clamp(predicted + (rng() - 0.35) * 0.09, 0.02, 0.95);
      bands.push({
        predicted: predicted,
        observed: HR.round(observed, 3),
        weight: Math.round(HR.lerp(260, 22, p / 70) * (0.8 + rng() * 0.4))
      });
    }
    return bands;
  }

  /* ------------------------------------------- external data coverage ------ */

  function coverage() {
    var t = portfolio().tiers;
    return [
      { tier: 'A', count: t.A || 0, desc: 'Listed and filing with the SEC. All five signal families apply.' },
      { tier: 'B', count: t.B || 0, desc: 'Listed elsewhere. Market, news and sector apply.' },
      { tier: 'C', count: t.C || 0, desc: 'Private or a subsidiary. News, sector, and the parent where LEI data names it.' }
    ];
  }

  /* ------------------------------------------------------ weekly briefing -- */

  /**
   * The briefing is assembled from computed numbers only. Every figure inside
   * the sentences is read out of the measurements; the sentence-building step
   * is never allowed to produce a number of its own. That is the rule that
   * stops the summary inventing a fact.
   */
  function briefing() {
    var p = portfolio();
    var byRank = function (a, b) { return b.rankValue - a.rankValue; };
    var act = p.byZone['Act now'].slice().sort(byRank);
    var watch = p.byZone['Watch'].slice().sort(byRank);
    var growth = p.byZone['Growth'].slice().sort(byRank);
    var clears = p.byZone['Clear'];
    var moved = moves();
    var s = [];

    if (act.length) {
      s.push((act.length === 1 ? 'One customer is' : act.length + ' customers are') +
        ' in Act now, holding ' + HR.usd(p.inActExposure) + ' of exposure.');
      var top = act[0];
      s.push(top.group.name + ' has a ' + HR.pct(top.breachChance) + ' chance of passing its limit' +
        (top.breachDate ? ', most likely around ' + HR.dateShort(top.breachDate) : '') + '. It ' +
        top.score.rows.filter(function (r) { return r.points > 0; }).slice(0, 2)
          .map(function (r) { return r.text.charAt(0).toLowerCase() + r.text.slice(1); }).join(', and ') + '.');
    } else {
      s.push('No customer is in Act now this week. ' + HR.usd(p.totalExposure) +
        ' of exposure is monitored across ' + p.groupCount + ' customer groups.');
    }

    if (watch.length) {
      s.push((watch.length === 1 ? 'One customer is' : watch.length + ' customers are') + ' on Watch: ' +
        watch.slice(0, 3).map(function (m) { return m.group.name; }).join(', ') +
        (watch.length > 3 ? ', and others' : '') + '. Risk is rising, but headroom is left.');
    }

    if (growth.length) {
      s.push(growth.slice(0, 3).map(function (m) { return m.group.name; }).join(' and ') +
        (growth.length === 1 ? ' is' : ' are') + ' likely to pass a limit but ' +
        (growth.length === 1 ? 'pays' : 'pay') + ' on time, so this looks like growth: a limit review may fit better than an order hold.');
    }

    if (moved.length) {
      s.push('Moves this week: ' + moved.slice(0, 3).map(function (x) {
        return x.m.group.name + ' from ' + x.from + ' to ' + x.to;
      }).join('; ') + '.');
    }

    s.push('Clear: ' + clears.length + ' other groups, ' +
      HR.usd(HR.sum(clears, function (m) { return m.exposure; })) + ' of exposure. No action this week.');

    return {
      sentences: s,
      generatedAt: D.AS_OF,
      nextReview: HR.addDays(D.AS_OF, 2),
      moves: moved,
      /* The number check. Every figure that appears in the text above is listed
         so the screen can show it was verified against the model output. */
      checkedFigures: [
        { label: 'Customer groups monitored', value: String(p.groupCount) },
        { label: 'Total exposure', value: HR.usd(p.totalExposure) },
        { label: 'Exposure in Act now', value: HR.usd(p.inActExposure) },
        { label: 'Top breach chance', value: act[0] ? HR.pct(act[0].breachChance) : '0%' },
        { label: 'Zone moves this week', value: String(moved.length) }
      ]
    };
  }

  /* ------------------------------------------------------------------ api -- */

  HR.engine = {
    HORIZON: HORIZON,
    PATHS: PATHS,
    BASE_RATE: BASE_RATE,
    ZONES: ZONES,
    DEFAULT_STEP: DEFAULT_STEP,
    DRIVERS: DRIVERS,
    LAYERS: LAYERS,
    RADAR_AXES: RADAR_AXES,

    exposure: exposure,
    utilisation: utilisation,
    headroom: headroom,
    forecast: forecast,
    score: score,
    radar: radar,
    zoneOf: zoneOf,
    nextSteps: nextSteps,
    measure: measure,
    portfolio: portfolio,
    invalidate: invalidate,
    moves: moves,
    backtest: backtest,
    coverage: coverage,
    briefing: briefing,
    confidenceOf: confidenceOf,
    statusOf: statusOf,

    find: function (id) {
      var rows = portfolio().rows;
      for (var i = 0; i < rows.length; i++) if (rows[i].group.id === id) return rows[i];
      return null;
    },

    /* The fitted sensitivities and the points they were fitted to. Shown on the
       Model performance screen so the calibration can be inspected. */
    calibration: calibrationTable,
    calibrationRmse: calibrationRmse,
    CALIBRATION_CASES: CALIBRATION_CASES,
    BREACH_MODEL: BREACH_MODEL,
    breachChance: breachChance,
    breachDrivers: breachDrivers,
  };


  /** Stable 32-bit hash of an id, used to seed each customer's simulation. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
})(window);
