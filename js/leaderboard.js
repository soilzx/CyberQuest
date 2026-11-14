/*
 * CyberQuest — local leaderboard
 *
 * Scores live in this browser's localStorage only. They are not shared
 * between devices. The store is wrapped in a small adapter interface
 * (load / save / clear) so a shared backend could replace it later
 * without touching the UI.
 */
(function (CQ) {
  'use strict';

  var KEY = 'cyberquest.leaderboard.v1';
  var LIMIT = 10;
  var KEEP = 50; // keep a few more than we show so ties and resets behave

  function localStorageAdapter(key) {
    function storage() {
      try { return window.localStorage; } catch (e) { return null; }
    }
    return {
      load: function () {
        var ls = storage();
        if (!ls) return [];
        try {
          var parsed = JSON.parse(ls.getItem(key) || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      },
      save: function (entries) {
        var ls = storage();
        if (!ls) return false;
        try { ls.setItem(key, JSON.stringify(entries)); return true; } catch (e) { return false; }
      },
      clear: function () {
        var ls = storage();
        if (!ls) return false;
        try { ls.removeItem(key); return true; } catch (e) { return false; }
      }
    };
  }

  function memoryAdapter() {
    var data = [];
    return {
      load: function () { return data.slice(); },
      save: function (entries) { data = entries.slice(); return true; },
      clear: function () { data = []; return true; }
    };
  }

  // Highest score first; on a tie, the faster run wins; then the earlier run.
  function compare(a, b) {
    return (b.score - a.score) || (a.timeMs - b.timeMs) || (a.timestamp - b.timestamp);
  }

  function isValidEntry(e) {
    return e && typeof e.nickname === 'string' && isFinite(e.score) && isFinite(e.timeMs) &&
      isFinite(e.timestamp) && typeof e.rank === 'string';
  }

  function createLeaderboard(adapter) {
    var store = adapter || localStorageAdapter(KEY);

    function all() {
      return store.load().filter(isValidEntry).sort(compare);
    }

    return {
      label: 'Local leaderboard: scores saved on this device only',
      top: function (n) { return all().slice(0, n || LIMIT); },
      /**
       * Add a finished run. Idempotent per runId, so double clicks or
       * repeated renders can never create duplicate rows.
       * @returns {{added:boolean, position:number}} 1-based position, 0 if outside the top list
       */
      submit: function (summary) {
        if (!summary || !summary.runId) return { added: false, position: 0 };
        var entries = all();
        var existing = entries.findIndex(function (e) { return e.runId === summary.runId; });
        if (existing === -1) {
          entries.push({
            runId: String(summary.runId),
            nickname: String(summary.nickname).slice(0, 24),
            // Anonymous runs keep their number so the name can be shown in either language.
            agent: summary.anonymous ? summary.agentNumber : undefined,
            rankId: String(summary.rank && summary.rank.id || ''),
            score: Math.round(summary.score),
            rank: String(summary.rank && summary.rank.name || ''),
            timeMs: Math.round(summary.timeMs),
            timestamp: Date.now()
          });
          entries.sort(compare);
          store.save(entries.slice(0, KEEP));
        }
        var sorted = all();
        var idx = sorted.findIndex(function (e) { return e.runId === summary.runId; });
        return { added: existing === -1, position: idx >= 0 && idx < LIMIT ? idx + 1 : 0 };
      },
      /**
       * Change the name on a saved run (players can add their name after
       * the game). Returns the run's 1-based position, 0 if not in the top list.
       */
      rename: function (runId, nickname) {
        var entries = all();
        var entry = entries.find(function (e) { return e.runId === runId; });
        if (!entry) return { renamed: false, position: 0 };
        entry.nickname = String(nickname).slice(0, 24);
        delete entry.agent;
        store.save(entries);
        var idx = entries.findIndex(function (e) { return e.runId === runId; });
        return { renamed: true, position: idx >= 0 && idx < LIMIT ? idx + 1 : 0 };
      },
      clear: function () { return store.clear(); },
      count: function () { return all().length; }
    };
  }

  CQ.leaderboard = {
    create: createLeaderboard,
    localStorageAdapter: localStorageAdapter,
    memoryAdapter: memoryAdapter,
    compare: compare,
    LIMIT: LIMIT
  };
})(typeof window !== 'undefined' ? (window.CQ = window.CQ || {}) : (globalThis.CQ = globalThis.CQ || {}));
