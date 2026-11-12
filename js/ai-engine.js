/*
 * CyberQuest — AI engine
 *
 * Two deliberately separate systems live here:
 *
 * 1. NEXUS (rule-based copilot)
 *    A transparent, weighted rule engine. It reads only the *telemetry* of an
 *    incident (counts, ratios, flags) and never the business *context*
 *    (change tickets, schedules, HR records). That limitation is intentional:
 *    it is the realistic reason NEXUS sometimes gets things wrong, and the
 *    reason a human analyst stays in the loop. Its risk score is a sum of rule
 *    weights clamped to 0–100. It is NOT a calibrated probability.
 *
 * 2. Defender model (Mission 2)
 *    A real k-nearest-neighbours classifier. It is trained only on the labels
 *    the player provides and evaluated on a separate held-out test set.
 */
(function (CQ) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* NEXUS rule engine                                                    */
  /* ------------------------------------------------------------------ */

  // Thresholds for the three recommendation bands.
  var CONTAIN_AT = 70;
  var INVESTIGATE_AT = 40;

  function times(n) { return (Math.round(n * 10) / 10) + '×'; }

  // Each rule: id, test(telemetry) -> boolean, weight, describe(telemetry).
  // Negative weights are mitigating signals.
  var RULES = [
    { id: 'failed-burst', weight: 35,
      test: function (t) { return t.failedLogins >= 100; },
      describe: function (t) { return t.failedLogins + ' failed logins in a few minutes'; } },
    { id: 'failed-some', weight: 15,
      test: function (t) { return t.failedLogins >= 10 && t.failedLogins < 100; },
      describe: function (t) { return t.failedLogins + ' failed logins before this session'; } },
    { id: 'spray', weight: 20,
      test: function (t) { return t.distinctAccounts >= 10; },
      describe: function (t) { return 'Failures spread across ' + t.distinctAccounts + ' different accounts'; } },
    { id: 'volume-extreme', weight: 35,
      test: function (t) { return t.volumeRatio >= 10; },
      describe: function (t) { return 'Data volume ' + times(t.volumeRatio) + ' above this host’s baseline'; } },
    { id: 'volume-high', weight: 25,
      test: function (t) { return t.volumeRatio >= 3 && t.volumeRatio < 10; },
      describe: function (t) { return 'Data volume ' + times(t.volumeRatio) + ' above this host’s baseline'; } },
    { id: 'volume-raised', weight: 10,
      test: function (t) { return t.volumeRatio >= 1.5 && t.volumeRatio < 3; },
      describe: function (t) { return 'Data volume ' + times(t.volumeRatio) + ' above baseline'; } },
    { id: 'off-hours', weight: 10,
      test: function (t) { return !!t.offHours; },
      describe: function () { return 'Activity outside business hours'; } },
    { id: 'bulk-off-hours', weight: 15,
      test: function (t) { return !!t.offHours && t.volumeRatio >= 3; },
      describe: function () { return 'Bulk transfer while the office is closed'; } },
    { id: 'dest-new', weight: 20,
      test: function (t) { return t.destination === 'new'; },
      describe: function () { return 'Destination never seen on this network before'; } },
    { id: 'dest-flagged', weight: 40,
      test: function (t) { return t.destination === 'flagged'; },
      describe: function () { return 'Destination is on a threat-intelligence blocklist'; } },
    { id: 'dest-known', weight: -10,
      test: function (t) { return t.destination === 'known'; },
      describe: function () { return 'Destination is a known, previously trusted address'; } },
    { id: 'unsigned', weight: 15,
      test: function (t) { return t.processSigned === false; },
      describe: function () { return 'The program sending the data is unsigned'; } },
    { id: 'signed', weight: -10,
      test: function (t) { return t.processSigned === true; },
      describe: function () { return 'The program is digitally signed by its vendor'; } },
    { id: 'new-device', weight: 10,
      test: function (t) { return !!t.newDevice; },
      describe: function () { return 'Device has not been seen before'; } },
    { id: 'sweep', weight: 35,
      test: function (t) { return t.connections >= 500; },
      describe: function (t) { return t.connections.toLocaleString('en-US') + ' connection attempts across many ports'; } },
    { id: 'lateral', weight: 30,
      test: function (t) { return t.lateral >= 5; },
      describe: function (t) { return 'Reaching out to ' + t.lateral + ' other internal machines'; } },
    { id: 'file-churn', weight: 25,
      test: function (t) { return t.fileChanges >= 200; },
      describe: function (t) { return t.fileChanges.toLocaleString('en-US') + ' files rewritten per minute'; } },
    { id: 'privileged', weight: 10,
      test: function (t) { return !!t.privileged; },
      describe: function () { return 'A privileged (administrator or service) account is involved'; } },
    { id: 'geo', weight: 15,
      test: function (t) { return !!t.geoAnomaly; },
      describe: function () { return 'Source location is unusual for this account'; } },
    { id: 'beacon', weight: 20,
      test: function (t) { return !!t.periodic; },
      describe: function (t) { return 'Connections repeat on a fixed ' + (t.periodSeconds || 60) + '-second timer'; } },
    { id: 'mfa-passed', weight: -25,
      test: function (t) { return !!t.mfaPassed; },
      describe: function () { return 'Multi-factor authentication was approved'; } }
  ];

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /**
   * Analyse an incident's telemetry.
   * @param {object} telemetry
   * @returns {{risk:number, band:string, confidence:string, findings:Array, margin:number}}
   */
  function analyze(telemetry) {
    var t = telemetry || {};
    var findings = [];
    var raw = 0;
    RULES.forEach(function (rule) {
      if (rule.test(t)) {
        raw += rule.weight;
        findings.push({ id: rule.id, weight: rule.weight, text: rule.describe(t) });
      }
    });
    var risk = clamp(raw, 0, 100);
    var band = risk >= CONTAIN_AT ? 'contain' : risk >= INVESTIGATE_AT ? 'investigate' : 'allow';
    // Confidence is a statement about the *rules*, not a probability:
    // a score sitting right next to a threshold could easily flip bands.
    var margin = Math.min(Math.abs(risk - CONTAIN_AT), Math.abs(risk - INVESTIGATE_AT));
    var confidence = margin >= 20 ? 'high' : margin >= 10 ? 'medium' : 'low';
    findings.sort(function (a, b) { return b.weight - a.weight; });
    return { risk: risk, band: band, confidence: confidence, findings: findings, margin: margin };
  }

  /* ------------------------------------------------------------------ */
  /* k-nearest-neighbours classifier                                      */
  /* ------------------------------------------------------------------ */

  function distance(a, b) {
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
      var d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  /**
   * "Train" a k-NN model. k-NN is a lazy learner: training stores the
   * labelled examples; all the work happens at prediction time.
   * @param {Array<{id:string, x:number[], label:string}>} examples
   * @param {number} k
   */
  function trainKNN(examples, k) {
    var data = (examples || []).filter(function (e) {
      return e && Array.isArray(e.x) && (e.label === 'benign' || e.label === 'malicious');
    }).map(function (e) { return { id: e.id, x: e.x.slice(), label: e.label }; });
    if (!data.length) throw new Error('Cannot train on an empty dataset');
    var kk = clamp(k || 3, 1, data.length);

    function predict(x) {
      var ranked = data.map(function (e) {
        return { id: e.id, label: e.label, distance: distance(x, e.x) };
      }).sort(function (a, b) { return a.distance - b.distance || (a.id < b.id ? -1 : 1); });
      var neighbors = ranked.slice(0, kk);
      var votes = { benign: 0, malicious: 0 };
      neighbors.forEach(function (n) { votes[n.label]++; });
      var label = votes.malicious > votes.benign ? 'malicious' : 'benign';
      var agreement = Math.max(votes.malicious, votes.benign) / kk;
      return { label: label, votes: votes, neighbors: neighbors, agreement: agreement, unanimous: agreement === 1 };
    }

    function evaluate(testSet) {
      var rows = testSet.map(function (item) {
        var p = predict(item.x);
        return { id: item.id, truth: item.truth, prediction: p, correct: p.label === item.truth };
      });
      var correct = rows.filter(function (r) { return r.correct; }).length;
      var tp = rows.filter(function (r) { return r.truth === 'malicious' && r.prediction.label === 'malicious'; }).length;
      var fp = rows.filter(function (r) { return r.truth === 'benign' && r.prediction.label === 'malicious'; }).length;
      var fn = rows.filter(function (r) { return r.truth === 'malicious' && r.prediction.label === 'benign'; }).length;
      return { rows: rows, correct: correct, total: rows.length, accuracy: rows.length ? correct / rows.length : 0,
        truePositives: tp, falsePositives: fp, falseNegatives: fn };
    }

    return { k: kk, size: data.length, predict: predict, evaluate: evaluate };
  }

  CQ.ai = {
    analyze: analyze,
    rules: RULES,
    thresholds: { contain: CONTAIN_AT, investigate: INVESTIGATE_AT },
    trainKNN: trainKNN,
    distance: distance
  };
})(typeof window !== 'undefined' ? (window.CQ = window.CQ || {}) : (globalThis.CQ = globalThis.CQ || {}));
