/* ============================================================================
   Headroom — seeded data set
   ----------------------------------------------------------------------------
   Every number in this app is INVENTED, but nothing here is random noise. Each
   customer is described by behaviour the credit team could actually observe in
   SAP, plus public signals. The risk engine (js/engine.js) derives every score,
   chance and zone from those observed values, so the screens can always explain
   themselves: "22 days late against its own normal of 4" -> "+17 points".

   The six named customers reproduce the approved pitch mock-ups exactly
   (Customer A .. Customer F). The remaining 114 groups are generated once, from
   a fixed seed, at boot. Re-running the app always gives the same portfolio.
   ========================================================================== */
(function (global) {
  'use strict';
  var HR = global.HR = global.HR || {};

  /** The demo reporting date. Fixed so every figure is reproducible. */
  var AS_OF = '2027-09-06';

  /* --------------------------------------------------------------------------
     SAP master data — one row per customer CODE, as Jabil's CMD holds it.
     A customer group rolls several codes up into one credit decision.
     ------------------------------------------------------------------------ */
  var CODES = {
    'A-1001': { code: 'A-1001', group: 'A', name: 'Northwind Devices Inc',  site: 'Guadalajara, MX',  currency: 'USD' },
    'A-1002': { code: 'A-1002', group: 'A', name: 'Northwind Devices Inc',  site: 'Penang, MY',       currency: 'USD' },
    'A-2040': { code: 'A-2040', group: 'A', name: 'Northwind Devices SA',   site: 'Juárez, MX',       currency: 'USD' },
    'B-1100': { code: 'B-1100', group: 'B', name: 'Cascade Networks Corp',  site: 'San José, US',     currency: 'USD' },
    'B-1101': { code: 'B-1101', group: 'B', name: 'Cascade Networks Corp',  site: 'Austin, US',       currency: 'USD' },
    'C-3310': { code: 'C-3310', group: 'C', name: 'Meridian Health Systems',site: 'Boston, US',       currency: 'USD' },
    'C-3311': { code: 'C-3311', group: 'C', name: 'Meridian Health GmbH',   site: 'Stuttgart, DE',    currency: 'EUR' },
    'D-4500': { code: 'D-4500', group: 'D', name: 'Voltaic Energy Systems', site: 'Seoul, KR',        currency: 'USD' },
    'E-5200': { code: 'E-5200', group: 'E', name: 'Helix Instruments Ltd',  site: 'Zurich, CH',       currency: 'USD' },
    'F-6100': { code: 'F-6100', group: 'F', name: 'Pinnacle Robotics Inc',  site: 'Detroit, US',      currency: 'USD' },
    'F-6101': { code: 'F-6101', group: 'F', name: 'Pinnacle Robotics Inc',  site: 'Monterrey, MX',    currency: 'USD' },
    'F-6102': { code: 'F-6102', group: 'F', name: 'Pinnacle Automation KK', site: 'Nagoya, JP',       currency: 'USD' }
  };

  /* --------------------------------------------------------------------------
     The six customers shown in the pitch. Fields are the raw observables.
     ------------------------------------------------------------------------ */
  var NAMED = [
    {
      id: 'grp-A', code: 'A', name: 'Customer A', legalName: 'Northwind Devices Inc',
      sector: 'Consumer devices', region: 'North America',
      sapCodes: ['A-1001', 'A-1002', 'A-2040'],
      limit: 600,
      /* Chance of a breach the approved pitch states for this customer,
         used to fit the simulation so the screen and the story agree. */
      targetBreach: 0.78,
      /* Exposure build-up, USD m */
      receivables: 314, dedicatedStock: 96, openPOs: 268, stockBuiltForPOs: 96,
      /* Payment behaviour, last 12 weeks */
      behaviour: {
        daysLateNow: 22, daysLateNormal: 4, daysLateSd: 1.5,
        overduePct: 0.42, overduePctNormal: 0.19,
        overdue90PlusPct: 0.11, overdueMigration: 0.062,
        shortPays6w: 3, disputesNow: 3, disputesNormal: 1,
        avgInvoice: 34, invoiceCount12w: 41,
        paymentDelayHistory: [0, 2, 3, 3, 5, 8, 15, 20, 22, 30, 1, 4, 6, 3, 18, 22, 25, 12, 22, 22],
        daysLateSeries: [4, 4, 5, 5, 6, 7, 9, 12, 14, 17, 19, 22]
      },
      /* Order book and inventory */
      orders: {
        openPOValue: 268, orderValue4wChange: 0.4, poPushedOutValue: 35, poPushedOutWeeks: 4,
        stockForDelayedOrders: 24, stockWaitingWeeks: 9
      },
      /* External, public signals */
      external: {
        tier: 'A', lei: '5493001NWD7A2QXK4B18', cik: '0001432105', ticker: 'NWDX',
        matchConfidence: 0.96, matchConfirmedBy: 'analyst on 18 Aug',
        altmanZNow: 1.4, altmanZ90dAgo: 2.1, currentRatioNow: 1.1, currentRatio90dAgo: 1.3,
        distanceToDefaultNow: 2.1, distanceToDefault90dAgo: 3.2, shareVolNow: 0.60, shareVol90dAgo: 0.38,
        newsTone30d: -0.42, newsToneNormal: -0.05, newsArticles30d: 37,
        newsThemes: ['restructuring', 'late supplier payments'],
        sectorOrderChange3m: -0.06,
        events: [
          { date: '2027-08-23', type: 'Officer departure', detail: 'Chief Financial Officer resigned, effective immediately', source: 'SEC 8-K' },
          { date: '2027-07-06', type: 'Restructuring costs', detail: 'USD 48m restructuring charge announced for FY27', source: 'SEC 8-K' },
          { date: '2027-06-14', type: 'Quarterly report', detail: 'Q2 10-Q filed; Altman Z\'\' fell to 1.4', source: 'SEC 10-Q' }
        ],
        limitRequest: { date: '2027-08-16', amount: 150, status: 'pending' }
      },
      decisionsSeed: 'third week in a row on Act now'
    },
    {
      id: 'grp-B', code: 'B', name: 'Customer B', legalName: 'Cascade Networks Corp',
      sector: 'Networking equipment', region: 'North America',
      sapCodes: ['B-1100', 'B-1101'],
      limit: 450,
      /* Chance of a breach the approved pitch states for this customer,
         used to fit the simulation so the screen and the story agree. */
      targetBreach: 0.71,
      receivables: 213, dedicatedStock: 35, openPOs: 202, stockBuiltForPOs: 35,
      behaviour: {
        daysLateNow: 2, daysLateNormal: 2, daysLateSd: 0.9,
        overduePct: 0.12, overduePctNormal: 0.10,
        overdue90PlusPct: 0.01, overdueMigration: 0.005,
        shortPays6w: 0, disputesNow: 0, disputesNormal: 0.5,
        avgInvoice: 28, invoiceCount12w: 33,
        paymentDelayHistory: [0, 0, 1, 0, 2, 1, 0, 3, 1, 2, 0, 1, 2, 0, 1, 1, 3, 0, 2, 1],
        daysLateSeries: [3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2]
      },
      orders: {
        openPOValue: 202, orderValue4wChange: 0.34, poPushedOutValue: 3, poPushedOutWeeks: 1,
        stockForDelayedOrders: 4, stockWaitingWeeks: 1
      },
      external: {
        tier: 'A', lei: '5493008CNW1K7P2M9D44', cik: '0000858470', ticker: 'CSNW',
        matchConfidence: 0.98, matchConfirmedBy: 'analyst on 4 Aug',
        altmanZNow: 2.9, altmanZ90dAgo: 2.8, currentRatioNow: 1.7, currentRatio90dAgo: 1.7,
        distanceToDefaultNow: 4.6, distanceToDefault90dAgo: 4.4, shareVolNow: 0.22, shareVol90dAgo: 0.24,
        newsTone30d: 0.14, newsToneNormal: 0.08, newsArticles30d: 22,
        newsThemes: ['new product launch', 'capacity expansion'],
        sectorOrderChange3m: 0.05,
        events: [
          { date: '2027-07-29', type: 'Quarterly report', detail: 'Q2 10-Q filed; revenue up 14% year on year', source: 'SEC 10-Q' }
        ],
        limitRequest: { date: '2027-09-01', amount: 120, status: 'pending' }
      },
      decisionsSeed: 'limit review suggested, not an order hold'
    },
    {
      id: 'grp-C', code: 'C', name: 'Customer C', legalName: 'Meridian Health Systems',
      sector: 'Medical devices', region: 'Europe',
      sapCodes: ['C-3310', 'C-3311'],
      limit: 300,
      /* Chance of a breach the approved pitch states for this customer,
         used to fit the simulation so the screen and the story agree. */
      targetBreach: 0.22,
      receivables: 108, dedicatedStock: 54, openPOs: 62, stockBuiltForPOs: 35,
      behaviour: {
        daysLateNow: 8, daysLateNormal: 3, daysLateSd: 1.4,
        overduePct: 0.31, overduePctNormal: 0.15,
        overdue90PlusPct: 0.04, overdueMigration: 0.021,
        shortPays6w: 1, disputesNow: 1, disputesNormal: 0.5,
        avgInvoice: 12, invoiceCount12w: 29,
        paymentDelayHistory: [0, 1, 2, 3, 2, 4, 5, 3, 6, 4, 3, 2, 5, 3, 7, 4, 3, 2, 6, 3],
        daysLateSeries: [3, 3, 4, 3, 4, 5, 5, 6, 6, 7, 7, 8]
      },
      orders: {
        openPOValue: 62, orderValue4wChange: -0.27, poPushedOutValue: 41, poPushedOutWeeks: 11,
        stockForDelayedOrders: 54, stockWaitingWeeks: 11
      },
      external: {
        tier: 'A', lei: '529900HH4T2LQK0V8N17', cik: '0001130312', ticker: 'MRDH',
        matchConfidence: 0.93, matchConfirmedBy: 'analyst on 12 Aug',
        altmanZNow: 2.4, altmanZ90dAgo: 2.6, currentRatioNow: 1.5, currentRatio90dAgo: 1.6,
        distanceToDefaultNow: 3.4, distanceToDefault90dAgo: 3.7, shareVolNow: 0.31, shareVol90dAgo: 0.27,
        newsTone30d: -0.12, newsToneNormal: -0.04, newsArticles30d: 18,
        newsThemes: ['regulatory delay', 'hospital budget pressure'],
        sectorOrderChange3m: -0.03,
        events: [
          { date: '2027-08-11', type: 'Quarterly report', detail: 'Q2 10-Q filed; margins steady', source: 'SEC 10-Q' }
        ],
        limitRequest: null
      },
      decisionsSeed: 'stock waiting for delayed orders'
    },
    {
      id: 'grp-D', code: 'D', name: 'Customer D', legalName: 'Voltaic Energy Systems',
      sector: 'Energy storage', region: 'Asia Pacific',
      sapCodes: ['D-4500'],
      limit: 350,
      /* Chance of a breach the approved pitch states for this customer,
         used to fit the simulation so the screen and the story agree. */
      targetBreach: 0.38,
      receivables: 212, dedicatedStock: 26, openPOs: 48, stockBuiltForPOs: 26,
      behaviour: {
        daysLateNow: 9, daysLateNormal: 3, daysLateSd: 2.1,
        overduePct: 0.36, overduePctNormal: 0.16,
        overdue90PlusPct: 0.06, overdueMigration: 0.018,
        shortPays6w: 1, disputesNow: 4, disputesNormal: 2,
        avgInvoice: 41, invoiceCount12w: 24,
        paymentDelayHistory: [0, 1, 3, 2, 4, 6, 2, 8, 3, 5, 4, 2, 7, 3, 9, 4, 2, 6, 3, 5],
        daysLateSeries: [3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 8, 9]
      },
      orders: {
        openPOValue: 48, orderValue4wChange: 0.03, poPushedOutValue: 12, poPushedOutWeeks: 3,
        stockForDelayedOrders: 9, stockWaitingWeeks: 4
      },
      external: {
        tier: 'A', lei: '988400VOLT4E1KQ7X2', cik: '0001706946', ticker: 'VLTK',
        matchConfidence: 0.95, matchConfirmedBy: 'analyst on 9 Aug',
        altmanZNow: 2.2, altmanZ90dAgo: 2.4, currentRatioNow: 1.3, currentRatio90dAgo: 1.4,
        distanceToDefaultNow: 2.6, distanceToDefault90dAgo: 2.9, shareVolNow: 0.44, shareVol90dAgo: 0.36,
        newsTone30d: -0.18, newsToneNormal: -0.06, newsArticles30d: 26,
        newsThemes: ['customer dispute', 'contract delay'],
        sectorOrderChange3m: -0.02,
        events: [
          { date: '2027-07-22', type: 'Quarterly report', detail: 'Q2 10-Q filed; gross margin down 2.1 pts', source: 'SEC 10-Q' }
        ],
        limitRequest: null
      },
      decisionsSeed: 'disputes doubled since July'
    },
    {
      id: 'grp-E', code: 'E', name: 'Customer E', legalName: 'Helix Instruments Ltd',
      sector: 'Industrial equipment', region: 'Europe',
      sapCodes: ['E-5200'],
      limit: 500,
      /* Chance of a breach the approved pitch states for this customer,
         used to fit the simulation so the screen and the story agree. */
      targetBreach: 0.06,
      receivables: 188, dedicatedStock: 12, openPOs: 84, stockBuiltForPOs: 12,
      behaviour: {
        daysLateNow: 2, daysLateNormal: 3, daysLateSd: 1.2,
        overduePct: 0.08, overduePctNormal: 0.14,
        overdue90PlusPct: 0.00, overdueMigration: -0.004,
        shortPays6w: 0, disputesNow: 0, disputesNormal: 1,
        avgInvoice: 22, invoiceCount12w: 38,
        paymentDelayHistory: [0, 0, 1, 0, 0, 2, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 1, 0, 0],
        daysLateSeries: [4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2]
      },
      orders: {
        openPOValue: 84, orderValue4wChange: -0.17, poPushedOutValue: 2, poPushedOutWeeks: 1,
        stockForDelayedOrders: 3, stockWaitingWeeks: 2
      },
      external: {
        tier: 'A', lei: '506700HLX1N8V2Q4T6', cik: '0000051143', ticker: 'HLXI',
        matchConfidence: 0.99, matchConfirmedBy: 'analyst on 2 Aug',
        altmanZNow: 4.1, altmanZ90dAgo: 4.0, currentRatioNow: 2.2, currentRatio90dAgo: 2.1,
        distanceToDefaultNow: 6.2, distanceToDefault90dAgo: 6.0, shareVolNow: 0.18, shareVol90dAgo: 0.19,
        newsTone30d: 0.06, newsToneNormal: 0.05, newsArticles30d: 14,
        newsThemes: ['order intake soft'],
        sectorOrderChange3m: -0.04,
        events: [
          { date: '2027-07-15', type: 'Quarterly report', detail: 'Q2 10-Q filed; net cash positive', source: 'SEC 10-Q' }
        ],
        limitRequest: null
      },
      decisionsSeed: 'no action this week'
    },
    {
      id: 'grp-F', code: 'F', name: 'Customer F', legalName: 'Pinnacle Robotics Inc',
      sector: 'Factory automation', region: 'North America',
      sapCodes: ['F-6100', 'F-6101', 'F-6102'],
      limit: 100,
      /* Chance of a breach the approved pitch states for this customer,
         used to fit the simulation so the screen and the story agree. */
      targetBreach: 0.58,
      receivables: 34, dedicatedStock: 18, openPOs: 64, stockBuiltForPOs: 18,
      behaviour: {
        daysLateNow: 12, daysLateNormal: 4, daysLateSd: 1.6,
        overduePct: 0.28, overduePctNormal: 0.17,
        overdue90PlusPct: 0.03, overdueMigration: 0.011,
        shortPays6w: 0, disputesNow: 0, disputesNormal: 0.5,
        avgInvoice: 9, invoiceCount12w: 26,
        paymentDelayHistory: [0, 1, 2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 5, 3, 2, 4, 2, 3, 6, 4],
        daysLateSeries: [4, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 12]
      },
      orders: {
        openPOValue: 64, orderValue4wChange: 0.22, poPushedOutValue: 5, poPushedOutWeeks: 2,
        stockForDelayedOrders: 6, stockWaitingWeeks: 3
      },
      external: {
        tier: 'A', lei: '549300PNN4C1R0B7T3K9', cik: '0001628280', ticker: 'PNRB',
        matchConfidence: 0.91, matchConfirmedBy: 'analyst on 20 Aug',
        altmanZNow: 2.7, altmanZ90dAgo: 2.9, currentRatioNow: 1.6, currentRatio90dAgo: 1.7,
        distanceToDefaultNow: 3.1, distanceToDefault90dAgo: 3.4, shareVolNow: 0.52, shareVol90dAgo: 0.41,
        newsTone30d: -0.21, newsToneNormal: -0.06, newsArticles30d: 19,
        newsThemes: ['order acceleration', 'supply constraint'],
        sectorOrderChange3m: 0.03,
        events: [
          { date: '2027-08-04', type: 'Quarterly report', detail: 'Q2 10-Q filed; backlog at record high', source: 'SEC 10-Q' }
        ],
        limitRequest: null
      },
      decisionsSeed: 'moved up from Watch'
    }
  ];

  /* --------------------------------------------------------------------------
     The rest of the portfolio: 114 further groups, generated once from a fixed
     seed. Each is assigned an archetype; the archetype drives behaviour, and
     the risk engine then derives the scores from that behaviour — so a group
     that pays late also scores as deteriorating, and can be explained.
     ------------------------------------------------------------------------ */

  var ARCHETYPES = [
    /* Healthy, large, stable — the backbone of the portfolio. */
    { key: 'healthy-large', w: 26, daysLate: [1, 4], lateProb: [0.02, 0.10], shortPays: [0, 0.3],
      orderChange: [-0.08, 0.10], stockWait: [0, 3], altmanZ: [2.6, 5.2], news: [0.02, 0.22],
      sizeMedian: 46, disputesMult: 1 },
    /* Healthy but smaller. */
    { key: 'healthy-small', w: 30, daysLate: [1, 5], lateProb: [0.03, 0.14], shortPays: [0, 0.5],
      orderChange: [-0.15, 0.15], stockWait: [0, 4], altmanZ: [2.0, 4.6], news: [-0.05, 0.18],
      sizeMedian: 11, disputesMult: 1 },
    /* Ramping up: orders climbing, still paying on time. */
    { key: 'growing', w: 16, daysLate: [1, 8], lateProb: [0.05, 0.22], shortPays: [0, 0.6],
      orderChange: [0.14, 0.48], stockWait: [1, 6], altmanZ: [1.9, 4.0], news: [-0.08, 0.25],
      sizeMedian: 26, disputesMult: 1.1 },
    /* Slow drift: a little later every month, no single dramatic signal. */
    { key: 'drifting', w: 16, daysLate: [8, 22], lateProb: [0.20, 0.42], shortPays: [0, 1.4],
      orderChange: [-0.20, 0.08], stockWait: [4, 12], altmanZ: [1.4, 3.0], news: [-0.45, -0.05],
      sizeMedian: 30, disputesMult: 2.2 },
    /* Under real cash pressure. */
    { key: 'stressed', w: 8, daysLate: [18, 42], lateProb: [0.35, 0.62], shortPays: [1, 3.5],
      orderChange: [-0.32, 0.04], stockWait: [8, 20], altmanZ: [0.6, 1.8], news: [-0.75, -0.25],
      sizeMedian: 22, disputesMult: 3.4 },
    /* Order book heavy, cash tied up in stock built for one customer. */
    { key: 'watch-inventory', w: 8, daysLate: [5, 18], lateProb: [0.16, 0.38], shortPays: [0, 1.2],
      orderChange: [-0.25, 0.12], stockWait: [9, 24], altmanZ: [1.5, 3.2], news: [-0.40, 0.02],
      sizeMedian: 34, disputesMult: 1.8 }
  ];

  var SECTOR_POOL = [
    'Consumer devices', 'Networking equipment', 'Automotive electronics', 'Medical devices',
    'Industrial equipment', 'Cloud infrastructure', 'Aerospace and defence', 'Energy storage',
    'Semiconductor equipment', 'Factory automation', 'Telecom infrastructure', 'Retail technology'
  ];
  var REGION_POOL = ['North America', 'Europe', 'Asia Pacific', 'Greater China', 'Latin America', 'Japan'];

  /* Plausible invented corporate names: [prefix, core, suffix] by region flavour. */
  var NAME_PARTS = {
    'North America': [['North', 'Cascade', 'Pinnacle', 'Ironwood', 'Blue Ridge', 'Summit', 'Fairline', 'Copper Creek', 'Stonebridge', 'Halcyon'],
      ['Systems', 'Technologies', 'Industries', 'Dynamics', 'Instruments', 'Networks', 'Solutions', 'Labs', 'Group', 'Works'],
      ['Inc', 'Corp', 'LLC', 'Holdings Inc', 'Technologies Inc']],
    'Europe': [['Rhein', 'Nord', 'Alpen', 'Valdis', 'Lindholm', 'Brenner', 'Castellan', 'Aurelia', 'Vantage', 'Kirch'],
      ['Werke', 'Systems', 'Technik', 'Industries', 'Instruments', 'Group', 'Solutions', 'Manufacturing', 'AG', 'Holdings'],
      ['GmbH', 'AG', 'SA', 'Ltd', 'SpA', 'BV']],
    'Asia Pacific': [['Hanwha', 'Sunwoo', 'Kirana', 'Siam', 'Pacific', 'Meridian', 'Oriental', 'Tanjung', 'Seojin', 'Ananda'],
      ['Precision', 'Electronics', 'Industries', 'Manufacturing', 'Technologies', 'Systems', 'Components', 'Global', 'Holdings', 'Works'],
      ['Pte Ltd', 'Co Ltd', 'Bhd', 'Corp', 'Ltd']],
    'Greater China': [['Jinhe', 'Yuanda', 'Tai Sheng', 'Hengli', 'Kunlun', 'Xinrui', 'Baolong', 'Wanhua', 'Zhongke', 'Lianchuang'],
      ['Precision', 'Electronics', 'Technology', 'Manufacturing', 'Components', 'Industrial', 'Optics', 'Smart', 'Advanced', 'Micro'],
      ['Co Ltd', 'Technology Co', 'Group Ltd', 'Holdings Ltd', 'Electronics Co']],
    'Latin America': [['Grupo Andino', 'Cordillera', 'Monterrey', 'Bandeirante', 'Atlas', 'Panamericana', 'Rio Verde', 'Azteca', 'Sur', 'Istmo'],
      ['Industrial', 'Electrónica', 'Manufactura', 'Componentes', 'Tecnología', 'Aparatos', 'Sistemas', 'Metales', 'Energía', 'Plásticos'],
      ['SA de CV', 'SA', 'Ltda', 'SAPI de CV', 'Group']],
    'Japan': [['Kyowa', 'Shinwa', 'Nakamura', 'Takara', 'Hokuto', 'Sanyu', 'Meiwa', 'Fujikawa', 'Asahi', 'Kobayashi'],
      ['Precision', 'Electric', 'Industries', 'Seisakusho', 'Technos', 'Kogyo', 'Denki', 'Manufacturing', 'Systems', 'Works'],
      ['Co Ltd', 'KK', 'Corporation', 'Holdings KK', 'Ltd']]
  };

  /** Assemble 114 generated groups. Deterministic for a fixed seed. */
  function generatePortfolio() {
    var rng = HR.rng(20270111); /* week 1 of the project period, as a nod to the plan */
    var out = [];
    var weighted = ARCHETYPES.map(function (a) { return { v: a, w: a.w }; });

    /* Sizes: a long tail. Log-normal, then scaled so the whole book lands near
       the USD 8.6bn total used in the pitch. */
    for (var i = 0; i < 114; i++) {
      var arch = rng.weighted(weighted);
      var region = rng.pick(REGION_POOL);
      var parts = NAME_PARTS[region] || NAME_PARTS['North America'];
      var name = rng.pick(parts[0]) + ' ' + rng.pick(parts[1]) + ' ' + rng.pick(parts[2]);
      var sector = rng.pick(SECTOR_POOL);

      /* Tier by how much public data exists for the group. */
      var tier = rng.weighted([{ v: 'A', w: 36 }, { v: 'B', w: 28 }, { v: 'C', w: 36 }]);

      /* Behaviour from the archetype. */
      var daysLateNow = Math.round(HR.lerp(arch.daysLate[0], arch.daysLate[1], rng()));
      var daysLateNormal = Math.max(1, Math.round(rng.norm(daysLateNow * 0.28 + 1.6, 1.0)));
      var lateProb = HR.round(HR.lerp(arch.lateProb[0], arch.lateProb[1], rng()), 2);
      /* A percentage change in the customer's weekly order INTAKE — the unit the
         risk model expects. Kept below 60% so the wording stays plausible. */
      var orderChange = HR.round(HR.clamp(HR.lerp(arch.orderChange[0], arch.orderChange[1], rng()), -0.45, 0.60), 2);
      var stockWait = Math.round(HR.lerp(arch.stockWait[0], arch.stockWait[1], rng()));
      var altmanZ = HR.round(HR.lerp(arch.altmanZ[0], arch.altmanZ[1], rng()), 1);
      var news = HR.round(HR.lerp(arch.news[0], arch.news[1], rng()), 2);
      var shortPays = Math.round(HR.lerp(arch.shortPays[0], arch.shortPays[1], rng()) * 2) / 2;
      var disputesNow = Math.max(0, Math.round(rng.norm(1.2 * arch.disputesMult, 0.9)));

      var size = Math.max(3, Math.round(rng.lognorm(arch.sizeMedian, 1.05) * 10) / 10);

      /* Exposure splits vary by archetype: stock-heavy groups hold more
         dedicated inventory, stressed groups hold more overdue receivables. */
      var stockShare = arch.key === 'watch-inventory' ? HR.lerp(0.20, 0.34, rng())
        : arch.key === 'stressed' ? HR.lerp(0.06, 0.14, rng())
          : HR.lerp(0.08, 0.22, rng());
      var receivShare = arch.key === 'stressed' ? HR.lerp(0.42, 0.60, rng()) : HR.lerp(0.28, 0.48, rng());

      var dedicatedStock = HR.round(size * stockShare, 1);
      var receivables = HR.round(size * receivShare, 1);
      var openPOValue = HR.round(size * HR.lerp(0.30, 0.62, rng()), 1);
      var stockBuiltForPOs = HR.round(Math.min(dedicatedStock, openPOValue * HR.lerp(0.20, 0.55, rng())), 1);

      /* The limit is set around current exposure. Headroom drives the breach
         chance, so a group sitting at 95% of its limit is genuinely close. */
      var utilisation = HR.clamp(rng.norm(0.62, 0.20), 0.22, 0.97);
      var exposure = receivables + dedicatedStock + (openPOValue - stockBuiltForPOs);
      var limit = Math.max(4, Math.round(exposure / utilisation));

      /* Share price signals only for listed groups. */
      var listed = tier === 'A' || (tier === 'B' && rng.bool(0.7));
      var dtD = listed ? HR.round(HR.clamp(altmanZ * 1.15 + rng.norm(0, 0.7), 0.4, 8), 1) : null;
      var shareVol = listed ? HR.round(HR.clamp(0.20 + (5 - altmanZ) * 0.07 + rng.norm(0, 0.09), 0.10, 1.1), 2) : null;

      /* Payment-delay history, used by the exposure simulation. Spread around
         the customer's own average, so bootstrap sampling has real shape. */
      var hist = [];
      for (var h = 0; h < 24; h++) {
        var draw = rng.norm(daysLateNow * 0.45, Math.max(1, daysLateNow * 0.30));
        hist.push(Math.max(0, Math.round(Math.abs(draw))));
      }
      if (daysLateNow >= 12) { hist.push(daysLateNow, daysLateNow + 6, daysLateNow - 4); }

      /* A short series for the "against its own normal" sparklines. */
      var series = [];
      for (var w = 0; w < 12; w++) {
        var t = w / 11;
        series.push(Math.round(HR.lerp(daysLateNormal, daysLateNow, arch.key === 'healthy-large' || arch.key === 'healthy-small' ? 1 - t * 0.15 : t) * 10) / 10);
      }

      var code = String.fromCharCode(65 + (i % 26)) + '-' + String(1000 + i * 7);
      var groupLetter = 'G' + (i + 1);

      out.push({
        id: 'gen-' + (i + 1),
        code: groupLetter,
        name: name,
        legalName: name,
        sector: sector,
        region: region,
        sapCodes: [code],
        limit: limit,
        archetype: arch.key,
        receivables: receivables,
        dedicatedStock: dedicatedStock,
        openPOs: openPOValue,
        stockBuiltForPOs: stockBuiltForPOs,
        behaviour: {
          daysLateNow: daysLateNow,
          daysLateNormal: daysLateNormal,
          daysLateSd: HR.round(HR.clamp(daysLateNormal * 0.35, 0.6, 8), 1),
          overduePct: lateProb,
          overduePctNormal: HR.round(HR.clamp(lateProb * HR.lerp(0.42, 0.78, rng()), 0.02, 0.55), 2),
          overdue90PlusPct: HR.round(HR.clamp(lateProb * HR.lerp(0.02, 0.20, rng()), 0, 0.30), 2),
          /* Share of overdue debt moving into the 61-90 day band each month.
             Realistically single digits: a tenth of the overdue book migrating
             that fast would be an acute crisis, not a drift. */
          overdueMigration: HR.round(HR.clamp((lateProb - 0.12) * HR.lerp(0.04, 0.16, rng()), -0.01, 0.07), 3),
          shortPays6w: shortPays,
          disputesNow: disputesNow,
          disputesNormal: Math.max(0.5, HR.round(1.2 * arch.disputesMult, 1)),
          avgInvoice: HR.round(Math.max(1, size * HR.lerp(0.04, 0.12, rng())), 1),
          invoiceCount12w: rng.int(12, 48),
          paymentDelayHistory: hist,
          daysLateSeries: series
        },
        orders: {
          openPOValue: openPOValue,
          orderValue4wChange: orderChange,
          poPushedOutValue: HR.round(openPOValue * HR.clamp(HR.lerp(0.01, 0.24, rng()) + (lateProb > 0.3 ? 0.08 : 0), 0, 0.45), 1),
          poPushedOutWeeks: Math.round(HR.lerp(1, stockWait, rng())),
          stockForDelayedOrders: HR.round(dedicatedStock * HR.lerp(0.25, 0.85, rng()), 1),
          stockWaitingWeeks: stockWait
        },
        external: {
          tier: tier,
          lei: tier === 'C' ? null : '549300' + groupLetter + i + 'KQ7X2M9',
          cik: tier === 'A' ? '000' + (1000000 + i * 137) : null,
          ticker: tier === 'A' ? name.split(' ')[0].slice(0, 4).toUpperCase() : null,
          matchConfidence: tier === 'C' ? HR.round(HR.clamp(rng.norm(0.74, 0.10), 0.5, 0.92), 2)
            : HR.round(HR.clamp(rng.norm(0.94, 0.05), 0.78, 0.99), 2),
          matchConfirmedBy: tier === 'C' ? null : 'analyst on ' + rng.int(1, 31) + ' Aug',
          altmanZNow: tier === 'C' ? null : altmanZ,
          altmanZ90dAgo: tier === 'C' ? null : HR.round(HR.clamp(altmanZ + rng.norm(0.15, 0.25), 0.4, 6), 1),
          currentRatioNow: tier === 'C' ? null : HR.round(HR.clamp(altmanZ * 0.55 + rng.norm(0, 0.25), 0.6, 3.4), 1),
          currentRatio90dAgo: tier === 'C' ? null : HR.round(HR.clamp(altmanZ * 0.55 + rng.norm(0.1, 0.25), 0.6, 3.4), 1),
          distanceToDefaultNow: dtD,
          distanceToDefault90dAgo: listed ? HR.round(HR.clamp(dtD + rng.norm(0.25, 0.3), 0.4, 8), 1) : null,
          shareVolNow: shareVol,
          shareVol90dAgo: listed ? HR.round(HR.clamp(shareVol - rng.norm(0.03, 0.06), 0.08, 1.2), 2) : null,
          newsTone30d: news,
          newsToneNormal: HR.round(HR.clamp(rng.norm(0.03, 0.07), -0.25, 0.3), 2),
          newsArticles30d: rng.int(4, 48),
          newsThemes: news < -0.2
            ? [rng.pick(['layoffs', 'late supplier payments', 'credit facility drawn', 'guidance cut', 'auditor change'])]
            : [rng.pick(['order intake', 'capacity expansion', 'product launch', 'management change'])],
          sectorOrderChange3m: HR.round(rng.norm(0.005, 0.05), 2),
          events: buildEvents(rng, tier, altmanZ, news),
          limitRequest: rng.bool(0.12)
            ? { date: HR.addDays(AS_OF, -rng.int(3, 40)), amount: Math.round(limit * HR.lerp(0.2, 0.6, rng())), status: 'pending' }
            : null
        }
      });
    }
    return out;
  }

  /** Plausible 8-K and 10-Q events for a generated group. */
  function buildEvents(rng, tier, altmanZ, news) {
    if (tier === 'C') return [];
    var ev = [];
    var count = tier === 'A' ? rng.int(0, 3) : rng.int(0, 1);
    var POOL = altmanZ < 1.8
      ? [['Officer departure', 'Chief Financial Officer resigned'],
         ['Restructuring costs', 'Restructuring charge announced'],
         ['Acceleration of debt', 'Lender accelerated repayment of a term loan'],
         ['Impairment', 'Goodwill impairment recognised'],
         ['Going concern', 'Substantial doubt about going concern disclosed']]
      : news < -0.15
        ? [['Restructuring costs', 'Site consolidation announced'],
           ['Impairment', 'Inventory write-down recognised'],
           ['Guidance', 'Full-year guidance lowered']]
        : [['Quarterly report', 'Quarterly report filed'],
           ['New contract', 'Material customer contract announced'],
           ['Debt repayment', 'Term loan repaid ahead of schedule']];
    for (var i = 0; i < count; i++) {
      var pick = POOL[rng.int(0, POOL.length - 1)];
      ev.push({
        date: HR.addDays(AS_OF, -rng.int(2, 85)),
        type: pick[0], detail: pick[1], source: tier === 'A' ? 'SEC 8-K' : 'Company release'
      });
    }
    return ev.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  /* ------------------------------------------------------------ assemble --- */

  /** The full portfolio: 120 groups. */
  var GROUPS = NAMED.concat(generatePortfolio());

  /* Sanity: a group can never hold more stock for open POs than it has
     dedicated stock, nor more than the open PO value itself. Done before
     calibration so the aggregate totals are exact. */
  GROUPS.forEach(function (g) {
    g.stockBuiltForPOs = HR.round(Math.min(g.stockBuiltForPOs, g.dedicatedStock, g.openPOs), 1);
  });

  /* Rescale the generated groups so total exposure matches the pitch figure
     (USD 8.6bn) while keeping the named six exactly as approved. */
  (function calibrate() {
    var TARGET_TOTAL = 8600;
    var named = HR.sum(NAMED, function (g) { return exposureOf(g); });
    var genTotal = HR.sum(GROUPS.slice(NAMED.length), function (g) { return exposureOf(g); });
    var factor = (TARGET_TOTAL - named) / genTotal;
    GROUPS.slice(NAMED.length).forEach(function (g) {
      g.receivables = HR.round(g.receivables * factor, 1);
      g.dedicatedStock = HR.round(g.dedicatedStock * factor, 1);
      g.openPOs = HR.round(g.openPOs * factor, 1);
      g.stockBuiltForPOs = HR.round(g.stockBuiltForPOs * factor, 1);
      g.limit = Math.max(4, Math.round(g.limit * factor));
      g.orders.openPOValue = g.openPOs;
      g.orders.poPushedOutValue = HR.round(g.orders.poPushedOutValue * factor, 1);
      g.orders.stockForDelayedOrders = HR.round(g.orders.stockForDelayedOrders * factor, 1);
      g.behaviour.avgInvoice = HR.round(g.behaviour.avgInvoice * factor, 1);
    });
  })();

  function exposureOf(g) {
    return g.receivables + g.dedicatedStock + (g.openPOs - g.stockBuiltForPOs);
  }

  HR.data = {
    AS_OF: AS_OF,
    GROUPS: GROUPS,
    NAMED: NAMED,
    CODES: CODES,
    ARCHETYPES: ARCHETYPES,
    /** Exposure rule used everywhere: receivables + dedicated stock + open POs
        not yet covered by that stock. Agreed with the credit team in week 2. */
    exposureOf: exposureOf,
    byId: function (id) {
      for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
      return null;
    }
  };
})(window);
