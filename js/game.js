/*
 * CyberQuest — game state and scoring
 *
 * Pure logic: no DOM access. The UI subscribes to events emitted here.
 * Every point awarded is written to a ledger with a reason, so the final
 * score can be explained line by line.
 */
(function (CQ) {
  'use strict';

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ------------------------------------------------------------------ */
  /* Managed timers: everything scheduled through a clock can be         */
  /* cancelled at once, so restarts never leave stray callbacks.         */
  /* ------------------------------------------------------------------ */
  function createClock() {
    var timeouts = new Set();
    var intervals = new Set();
    return {
      after: function (ms, fn) {
        var id = setTimeout(function () { timeouts.delete(id); fn(); }, ms);
        timeouts.add(id);
        return id;
      },
      every: function (ms, fn) {
        var id = setInterval(fn, ms);
        intervals.add(id);
        return id;
      },
      cancel: function (id) {
        if (id == null) return;
        clearTimeout(id); clearInterval(id);
        timeouts.delete(id); intervals.delete(id);
      },
      clearAll: function () {
        timeouts.forEach(clearTimeout); intervals.forEach(clearInterval);
        timeouts.clear(); intervals.clear();
      },
      get pending() { return timeouts.size + intervals.size; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Nicknames                                                            */
  /* ------------------------------------------------------------------ */
  var NICK_MAX = 16;

  function sanitizeNickname(raw) {
    if (typeof raw !== 'string') return '';
    // Keep letters (any script), digits, space, dot, dash, underscore.
    var cleaned = raw.normalize('NFKC')
      .replace(/[^\p{L}\p{N} ._-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, NICK_MAX).trim();
  }

  function anonymousName(seed) {
    var n = typeof seed === 'number' ? seed : Math.floor(Math.random() * 9000) + 1000;
    return 'Agent ' + String(n % 10000).padStart(4, '0');
  }

  /* ------------------------------------------------------------------ */
  /* Ranks: deterministic thresholds on total score                       */
  /* ------------------------------------------------------------------ */
  var RANKS = [
    { id: 'recruit', name: 'Cyber Recruit', min: -Infinity },
    { id: 'hunter', name: 'Threat Hunter', min: 800 },
    { id: 'analyst', name: 'Security Analyst', min: 1300 },
    { id: 'defender', name: 'Cyber Defender', min: 1800 },
    { id: 'guardian', name: 'Elite AI Guardian', min: 2200 }
  ];

  function rankFor(score) {
    var r = RANKS[0];
    RANKS.forEach(function (rank) { if (score >= rank.min) r = rank; });
    return { id: r.id, name: r.name, level: RANKS.indexOf(r) + 1, next: RANKS[RANKS.indexOf(r) + 1] || null };
  }

  function threatLabel(level) {
    if (level >= 80) return 'Critical';
    if (level >= 60) return 'High';
    if (level >= 40) return 'Elevated';
    if (level >= 20) return 'Guarded';
    return 'Low';
  }

  /* ------------------------------------------------------------------ */
  /* Bonuses                                                              */
  /* ------------------------------------------------------------------ */
  var COMPLETION_BONUS = 50;
  var EFFICIENCY_MAX = 50;

  // Full bonus at or under par, falling linearly to zero at twice par.
  function efficiencyBonus(seconds, par) {
    if (!(seconds >= 0) || !(par > 0)) return 0;
    if (seconds <= par) return EFFICIENCY_MAX;
    if (seconds >= par * 2) return 0;
    return Math.round(EFFICIENCY_MAX * (1 - (seconds - par) / par));
  }

  /* ------------------------------------------------------------------ */
  /* Game                                                                 */
  /* ------------------------------------------------------------------ */
  function Game() {
    this._listeners = {};
    this.reset();
  }

  Game.prototype.on = function (type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
    var list = this._listeners[type];
    return function off() { var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); };
  };

  Game.prototype.emit = function (type, payload) {
    (this._listeners[type] || []).slice().forEach(function (fn) { fn(payload); });
  };

  Game.prototype.reset = function () {
    this.state = {
      phase: 'intro',            // intro | playing | results
      runId: null,
      nickname: '',
      anonymous: true,
      missionIndex: -1,
      missionStartedAt: 0,
      startedAt: 0,
      endedAt: 0,
      score: 0,
      integrity: 100,
      stability: 100,
      threat: 35,
      breached: false,
      ledger: [],
      decisions: [],              // { mission, id, grade, correct, ... }
      missionScores: [0, 0, 0, 0],
      missionTimes: [0, 0, 0, 0],
      threatsTotal: 0,
      threatsContained: 0,
      ai: { calls: 0, good: 0, overridesCorrect: 0, followedCorrect: 0 },
      model: null,                // { accuracy, correct, total, labelCorrect, labelTotal }
      saved: false
    };
    this.emit('reset', this.state);
    this.emit('metrics', this.state);
  };

  Game.prototype.start = function (nickname) {
    var name = sanitizeNickname(nickname);
    this.reset();
    var s = this.state;
    s.anonymous = !name;
    s.nickname = name || anonymousName();
    s.runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    s.phase = 'playing';
    s.startedAt = now();
    this.emit('start', s);
    return s;
  };

  Game.prototype.elapsedMs = function () {
    var s = this.state;
    if (!s.startedAt) return 0;
    return (s.endedAt || now()) - s.startedAt;
  };

  Game.prototype.beginMission = function (index) {
    this.state.missionIndex = index;
    this.state.missionStartedAt = now();
    this.emit('mission', index);
  };

  Game.prototype.missionElapsed = function () {
    return this.state.missionStartedAt ? (now() - this.state.missionStartedAt) / 1000 : 0;
  };

  Game.prototype.award = function (points, reason, tone) {
    var s = this.state;
    var p = Math.round(points) || 0;
    s.score += p;
    if (s.missionIndex >= 0) s.missionScores[s.missionIndex] += p;
    var entry = { mission: s.missionIndex, points: p, reason: reason, tone: tone || (p >= 0 ? 'gain' : 'loss') };
    s.ledger.push(entry);
    this.emit('score', entry);
    return entry;
  };

  Game.prototype.applyEffects = function (effects) {
    var s = this.state;
    if (!effects) return;
    if (effects.integrity) s.integrity = clamp(s.integrity + effects.integrity, 0, 100);
    if (effects.stability) s.stability = clamp(s.stability + effects.stability, 0, 100);
    if (effects.threat) s.threat = clamp(s.threat + effects.threat, 0, 100);
    this.emit('metrics', s);
    if (s.integrity <= 0 && !s.breached) {
      s.breached = true;
      this.emit('breach', s);
    }
  };

  // Continuous damage (mission 4). Fractional values accumulate.
  Game.prototype.drainIntegrity = function (amount) {
    if (!(amount > 0)) return;
    this.applyEffects({ integrity: -amount });
  };

  Game.prototype.setThreat = function (level) {
    this.state.threat = clamp(Math.round(level), 0, 100);
    this.emit('metrics', this.state);
  };

  /**
   * Record a decision.
   * @param {object} d { mission, id, grade, malicious, contained, ai? }
   *   grade: best | acceptable | partial | wrong
   *   ai: { recommendedBest:boolean, followed:boolean, chosenWrong:boolean }
   */
  Game.prototype.recordDecision = function (d) {
    var s = this.state;
    var correct = d.grade === 'best' || d.grade === 'acceptable';
    var rec = Object.assign({}, d, { correct: correct });
    s.decisions.push(rec);
    if (d.malicious) {
      s.threatsTotal++;
      if (d.contained) s.threatsContained++;
    }
    if (d.ai) {
      s.ai.calls++;
      // Good collaboration: follow NEXUS when it is right,
      // depart from it (to a non-wrong choice) when it is not.
      var good = d.ai.recommendedBest ? d.ai.followed : (!d.ai.followed && !d.ai.chosenWrong);
      if (good) {
        s.ai.good++;
        if (d.ai.followed) s.ai.followedCorrect++; else s.ai.overridesCorrect++;
      }
      rec.aiGood = good;
    }
    this.emit('decision', rec);
    return rec;
  };

  // Threats that were never decided on (e.g. the clock ran out).
  Game.prototype.recordMissedThreat = function (id) {
    this.state.threatsTotal++;
    this.state.decisions.push({ mission: this.state.missionIndex, id: id, grade: 'missed', correct: false, malicious: true });
  };

  Game.prototype.recordModel = function (model) {
    this.state.model = model;
  };

  Game.prototype.completeMission = function (index, par, opts) {
    var s = this.state;
    var seconds = this.missionElapsed();
    s.missionTimes[index] = seconds;
    var bonuses = [];
    bonuses.push(this.award(COMPLETION_BONUS, 'Mission ' + (index + 1) + ' complete', 'bonus'));
    if (!opts || opts.efficiency !== false) {
      var eff = efficiencyBonus(seconds, par);
      if (eff > 0) bonuses.push(this.award(eff, 'Decisive response (' + Math.round(seconds) + ' s)', 'bonus'));
    }
    this.emit('missionComplete', { index: index, seconds: seconds, bonuses: bonuses });
    return { seconds: seconds, bonuses: bonuses, missionScore: s.missionScores[index] };
  };

  Game.prototype.finish = function () {
    var s = this.state;
    if (s.phase === 'results') return this.summary();
    s.endedAt = now();
    s.phase = 'results';
    var summary = this.summary();
    this.emit('finish', summary);
    return summary;
  };

  Game.prototype.summary = function () {
    var s = this.state;
    var correct = s.decisions.filter(function (d) { return d.correct; }).length;
    var partial = s.decisions.filter(function (d) { return d.grade === 'partial'; }).length;
    var incorrect = s.decisions.filter(function (d) { return d.grade === 'wrong' || d.grade === 'missed'; }).length;
    return {
      runId: s.runId,
      nickname: s.nickname,
      anonymous: s.anonymous,
      score: s.score,
      rank: rankFor(s.score),
      timeMs: Math.round(this.elapsedMs()),
      correct: correct,
      partial: partial,
      incorrect: incorrect,
      threatsContained: s.threatsContained,
      threatsTotal: s.threatsTotal,
      integrity: Math.round(s.integrity),
      stability: Math.round(s.stability),
      threat: Math.round(s.threat),
      breached: s.breached,
      ai: Object.assign({}, s.ai),
      model: s.model,
      missionScores: s.missionScores.slice(),
      missionTimes: s.missionTimes.slice(),
      ledger: s.ledger.slice(),
      decisions: s.decisions.slice()
    };
  };

  CQ.game = {
    Game: Game,
    createClock: createClock,
    sanitizeNickname: sanitizeNickname,
    anonymousName: anonymousName,
    NICK_MAX: NICK_MAX,
    RANKS: RANKS,
    rankFor: rankFor,
    threatLabel: threatLabel,
    efficiencyBonus: efficiencyBonus,
    COMPLETION_BONUS: COMPLETION_BONUS,
    now: now
  };
})(typeof window !== 'undefined' ? (window.CQ = window.CQ || {}) : (globalThis.CQ = globalThis.CQ || {}));
