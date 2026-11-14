/*
 * CyberQuest — application controller
 *
 * Screen flow: start → (mission card → challenges → mission complete) × 4
 * → results. Also handles language switching (without losing progress),
 * restart, sound, hints, keyboard shortcuts, partner logos and the booth
 * idle reset. Game rules live in game.js and missions.js.
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var $ = ui.$;
  var S = CQ.scenarios;
  var i18n = CQ.i18n;
  function T(k, v) { return i18n.t(k, v); }
  function L(x, v) { return i18n.pick(x, v); }

  var IDLE_PROMPT_MS = 120000;   // during a game: ask "Still playing?"
  var IDLE_RESET_MS = 20000;     // then return to the start screen
  var RESULTS_IDLE_MS = 90000;   // results screen returns to start on its own
  var HINT_AFTER_MS = 20000;

  var game = new CQ.game.Game();
  var clock = CQ.game.createClock();
  var board = CQ.leaderboard.create();
  var introScene = null;
  var mission = null;
  var missionIndex = -1;
  var card = null;               // { type: 'start' | 'complete', index, info, result } while a card is shown
  var results = null;            // { summary, position, savedName } on the results screen
  var hintTimer = null;
  var lastActivity = Date.now();
  var idleDialogOpen = false;
  var screen = 'intro';

  /* ------------------------------------------------------------------ */
  /* Screens                                                              */
  /* ------------------------------------------------------------------ */
  function showScreen(name) {
    screen = name;
    ['intro', 'play', 'results'].forEach(function (s) {
      var el = $('#screen-' + s);
      if (el) el.hidden = s !== name;
    });
    document.body.dataset.screen = name;
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Game flow                                                            */
  /* ------------------------------------------------------------------ */
  function startGame() {
    teardown();
    CQ.audio.unlock();
    game.start('');
    results = null;
    showScreen('play');
    ui.header.setScore(0);
    missionCard(0);
  }

  function setProgress(fraction) {
    ui.header.setProgress((Math.max(0, missionIndex) + Math.max(0, Math.min(1, fraction))) / S.missions.length);
  }

  function centerCard(children) {
    var stage = $('#stage');
    ui.clear(stage);
    stage.appendChild(h('div', { class: 'stage-center' }, h('div', { class: 'center-card' }, children)));
  }

  function renderCard() {
    if (!card) return;
    var m = S.missions[card.index];
    ui.header.setMission(card.index, L(m.title));
    if (card.type === 'start') {
      centerCard([
        h('div', { class: 'mission-badge', 'aria-hidden': 'true' }, String(card.index + 1)),
        h('p', { class: 'step-label' }, T('card.mission', { n: card.index + 1 })),
        h('h2', { class: 'center-title', tabindex: '-1' }, L(m.title)),
        h('p', { class: 'center-text' }, L(m.intro)),
        h('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: function () { beginMission(card.index); } } }, T('card.start'))
      ]);
      return;
    }
    var isLast = card.index === S.missions.length - 1;
    var reason = card.result.reason;
    var heading = !isLast ? T('card.complete', { n: card.index + 1 })
      : reason === 'breach' ? T('card.breach') : reason === 'timeout' ? T('card.timeout') : T('card.saved');
    var points = h('p', { class: 'center-points' }, T('pointsSigned', { n: 0 }));
    centerCard([
      h('div', { class: 'mission-badge is-done', 'aria-hidden': 'true' }, ui.svgIcon(ui.ICON.check)),
      h('p', { class: 'step-label' }, isLast ? T('card.final') : T('card.mission', { n: card.index + 1 })),
      h('h2', { class: 'center-title', tabindex: '-1' }, heading),
      points,
      h('div', { class: 'lesson' },
        h('p', { class: 'lesson-label' }, T('card.learned')),
        h('p', { class: 'lesson-text' }, L(m.takeaway))),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-big',
        on: { click: function () { if (isLast) finishGame(); else missionCard(card.index + 1); } }
      }, isLast ? T('card.results') : T('card.next', { title: L(S.missions[card.index + 1].title) }))
    ]);
    countUp(points, card.info.missionScore, card.animated);
    card.animated = true;
  }

  // The mission score counts up once, the first time the card appears.
  function countUp(node, target, skip) {
    if (skip || ui.reducedMotion() || !target) { node.textContent = T('pointsSigned', { n: target }); return; }
    var start = performance.now(), dur = 900;
    (function frame(now) {
      if (!node.isConnected) return;
      var p = Math.min(1, (now - start) / dur);
      node.textContent = T('pointsSigned', { n: Math.round(target * (1 - Math.pow(1 - p, 3))) });
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  function missionCard(index) {
    missionIndex = index;
    card = { type: 'start', index: index };
    document.body.dataset.mission = String(index);
    setProgress(0);
    renderCard();
    ui.nexus.say('nx.mission.' + index, null, 'happy');
    CQ.audio.play('select');
    ui.focus($('#stage'), '.btn-big');
  }

  function beginMission(index) {
    if (mission) return;   // ignore double clicks
    card = null;
    game.beginMission(index);
    mission = CQ.missions.factories[index](missionContext(index));
    mission.start();
  }

  function missionContext(index) {
    var finished = false;
    return {
      game: game,
      audio: CQ.audio,
      clock: clock,
      stage: $('#stage'),
      nexus: ui.nexus,
      progress: setProgress,
      armHint: armHint,
      disarmHint: disarmHint,
      complete: function (result) {
        if (finished) return;
        finished = true;
        completeMission(index, result || {});
      }
    };
  }

  function completeMission(index, result) {
    disarmHint();
    var m = S.missions[index];
    var info = game.completeMission(index, m.par, { efficiency: index !== 3 });
    if (mission) { mission.destroy(); mission = null; }
    CQ.audio.play(result.reason === 'breach' || result.reason === 'timeout' ? 'failure' : 'complete');
    setProgress(1);
    card = { type: 'complete', index: index, info: info, result: result };
    renderCard();
    var isLast = index === S.missions.length - 1;
    ui.nexus.say(isLast ? (result.reason === 'cleared' ? 'nx.finalGood' : 'nx.finalBad') : 'nx.next', null, 'happy');
    ui.focus($('#stage'), '.btn-big');
  }

  function finishGame() {
    var summary = game.finish();
    clock.clearAll();
    card = null;
    var saved = { position: 0 };
    if (!game.state.saved) {
      saved = board.submit(summary);
      game.state.saved = true;
    }
    results = { summary: summary, position: saved.position, savedName: '' };
    renderResults();
    showScreen('results');
    ui.focus(document, '#results-title');
    ui.announce(T('res.title', { rank: T('rank.' + summary.rank.id) }));
  }

  function renderResults() {
    if (!results) return;
    CQ.results.render($('#screen-results'), results.summary, {
      position: results.position,
      savedName: results.savedName,
      onSaveName: function (name) {
        var clean = CQ.game.sanitizeNickname(name);
        if (!clean) return { ok: false, message: T('res.nameError') };
        var r = board.rename(results.summary.runId, clean);
        results.summary.nickname = clean;
        results.summary.anonymous = false;
        results.savedName = clean;
        return { ok: true, position: r.position };
      },
      onReplay: startGame,
      onLeaderboard: function () { openLeaderboard(results.summary.runId); },
      onLearned: function () { openLearned(results.summary); }
    });
  }

  function teardown() {
    disarmHint();
    if (mission) { mission.destroy(); mission = null; }
    clock.clearAll();
    ui.closeDialog(true);
    idleDialogOpen = false;
    missionIndex = -1;
    card = null;
    ui.nexus.clear();
    delete document.body.dataset.mission;
  }

  function toIntro() {
    teardown();
    game.reset();
    results = null;
    showScreen('intro');
    ui.focus(document, '#btn-start');
  }

  function confirmRestart() {
    ui.openDialog({
      title: T('dlg.restartTitle'),
      body: h('p', null, T('dlg.restartBody')),
      actions: [
        { label: T('dlg.keepPlaying'), primary: true },
        { label: T('dlg.startOver'), danger: true, onClick: toIntro }
      ]
    });
  }

  /* ------------------------------------------------------------------ */
  /* Language                                                             */
  /* ------------------------------------------------------------------ */
  function renderLangSwitches() {
    document.querySelectorAll('.lang-switch').forEach(function (group) {
      group.setAttribute('aria-label', T('lang.label'));
      group.querySelectorAll('button[data-lang]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.lang === i18n.lang ? 'true' : 'false');
      });
    });
  }

  // Redraw everything that is on screen in the new language. Game state is untouched.
  function onLanguageChange() {
    renderLangSwitches();
    renderMute();
    if (introScene) introScene.update(introModel());
    if (screen === 'play') {
      if (card) renderCard();
      else if (mission) {
        ui.header.setMission(missionIndex, L(S.missions[missionIndex].title));
        mission.render();
      }
      ui.nexus.refresh(false);
    }
    if (screen === 'results') renderResults();
    if (ui.dialogOpen()) ui.closeDialog(true);
  }

  /* ------------------------------------------------------------------ */
  /* Hints: NEXUS speaks up if the player seems stuck                     */
  /* ------------------------------------------------------------------ */
  function armHint() {
    disarmHint();
    hintTimer = clock.after(HINT_AFTER_MS, function () {
      hintTimer = null;
      if (mission && !ui.dialogOpen()) ui.nexus.say(mission.hint(), null, 'hint');
    });
  }

  function disarmHint() {
    if (hintTimer) clock.cancel(hintTimer);
    hintTimer = null;
  }

  /* ------------------------------------------------------------------ */
  /* Dialogs                                                              */
  /* ------------------------------------------------------------------ */
  function openLeaderboard(highlight) {
    ui.openDialog({
      title: T('dlg.boardTitle'),
      className: 'dialog--wide',
      body: CQ.results.leaderboardBody(board, highlight),
      actions: [
        { label: T('dlg.close'), primary: true },
        board.count() ? { label: T('dlg.boardReset'), danger: true, onClick: function () { confirmReset(highlight); } } : null
      ].filter(Boolean)
    });
  }

  function confirmReset(highlight) {
    ui.openDialog({
      title: T('dlg.resetTitle'),
      body: h('p', null, T('dlg.resetBody', { n: board.count() })),
      actions: [
        { label: T('dlg.cancel'), onClick: function () { openLeaderboard(highlight); } },
        { label: T('dlg.deleteAll'), danger: true, onClick: function () { board.clear(); ui.toast(T('dlg.cleared')); openLeaderboard(highlight); } }
      ]
    });
  }

  function openLearned(summary) {
    ui.openDialog({
      title: T('dlg.learnedTitle'),
      className: 'dialog--wide',
      body: CQ.results.learnedBody(summary),
      actions: [{ label: T('dlg.close'), primary: true }]
    });
  }

  /* ------------------------------------------------------------------ */
  /* Idle reset (booth mode)                                              */
  /* ------------------------------------------------------------------ */
  function noteActivity() { lastActivity = Date.now(); }

  function idleCheck() {
    var idle = Date.now() - lastActivity;
    if (screen === 'results' && idle > RESULTS_IDLE_MS && !ui.dialogOpen()) { toIntro(); return; }
    if (screen !== 'play' || idleDialogOpen) return;
    if (ui.dialogOpen()) { if (idle > IDLE_PROMPT_MS + IDLE_RESET_MS) toIntro(); return; }
    if (idle > IDLE_PROMPT_MS) promptIdle();
  }

  function promptIdle() {
    idleDialogOpen = true;
    var left = Math.round(IDLE_RESET_MS / 1000);
    var body = h('p', null, T('dlg.idleBody', { n: left }));
    var countdown = null;
    var stop = function () { if (countdown) clearInterval(countdown); countdown = null; idleDialogOpen = false; };
    ui.openDialog({
      title: T('dlg.idleTitle'),
      body: body,
      dismissible: false,
      actions: [
        { label: T('dlg.keepPlaying'), primary: true, onClick: function () { stop(); noteActivity(); } },
        { label: T('dlg.startOver'), onClick: function () { stop(); toIntro(); } }
      ]
    });
    countdown = setInterval(function () {
      left--;
      body.textContent = T('dlg.idleBody', { n: Math.max(0, left) });
      if (left <= 0) { stop(); toIntro(); }
    }, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard: 1, 2, 3 pick a choice; C reveals a clue                    */
  /* ------------------------------------------------------------------ */
  function onKey(e) {
    noteActivity();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (ui.dialogOpen() || screen !== 'play' || !mission || !mission.onKey) return;
    var key = (e.key || '').toLowerCase();
    if (key === 'ؤ') key = 'c'; // the C key on an Arabic keyboard layout
    if (key.length === 1) mission.onKey(key);
  }

  /* ------------------------------------------------------------------ */
  /* Sound toggle                                                         */
  /* ------------------------------------------------------------------ */
  function renderMute() {
    var btn = $('#btn-mute');
    if (!btn) return;
    var muted = CQ.audio.isMuted();
    ui.clear(btn);
    btn.appendChild(ui.svgIcon(muted ? ui.ICON.soundOff : ui.ICON.soundOn));
    btn.appendChild(h('span', { class: 'btn-text' }, T(muted ? 'header.soundOff' : 'header.soundOn')));
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', T(muted ? 'header.soundOffAria' : 'header.soundOnAria'));
  }

  /* ------------------------------------------------------------------ */
  /* Partner logos: shown only once the image files really load          */
  /* ------------------------------------------------------------------ */
  function initLogos() {
    var section = $('#partners');
    if (!section) return;
    var tiles = Array.prototype.slice.call(section.querySelectorAll('.partner'));
    var pending = tiles.length;
    function settle() {
      pending--;
      if (pending > 0) return;
      var shown = section.querySelectorAll('.partner:not([hidden])').length;
      section.hidden = shown === 0;
      section.dataset.count = String(shown);
      // No logo could be loaded: show CyberQuest's own logo in that spot instead.
      var fallback = $('#intro-brand-fallback');
      if (fallback) fallback.hidden = shown > 0;
    }
    tiles.forEach(function (tile) {
      var img = tile.querySelector('img');
      // e.g. data-fallback="assets/logos/club-1.svg": tried if the PNG is missing.
      var fallbacks = (img.dataset.fallback || '').split(',').filter(Boolean);
      var finished = false;
      function ok() { if (finished) return; finished = true; tile.hidden = false; settle(); }
      function fail() {
        if (finished) return;
        var nextSrc = fallbacks.shift();
        if (nextSrc) { img.src = nextSrc; return; }
        finished = true;
        tile.remove();   // never leave a broken image on screen
        settle();
      }
      img.addEventListener('load', ok);
      img.addEventListener('error', fail);
      if (img.complete) { if (img.naturalWidth) ok(); else fail(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                                */
  /* ------------------------------------------------------------------ */
  function introModel() {
    return {
      devices: { server: { state: 'alert', tag: T('intro.tag') } },
      flow: { from: 'internet', to: 'server', tone: 'warn' }
    };
  }

  function init() {
    i18n.apply();
    introScene = CQ.network.create($('#intro-scene'));
    introScene.update(introModel());

    $('#btn-start').addEventListener('click', startGame);
    $('#btn-intro-board').addEventListener('click', function () { openLeaderboard(null); });
    $('#btn-restart').addEventListener('click', confirmRestart);
    $('#btn-mute').addEventListener('click', function () { CQ.audio.toggle(); renderMute(); CQ.audio.play('select'); });
    document.querySelectorAll('.lang-switch button[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { i18n.set(b.dataset.lang); CQ.audio.play('select'); });
    });
    i18n.onChange(onLanguageChange);
    renderLangSwitches();
    renderMute();
    initLogos();

    game.on('score', function (entry) { ui.header.setScore(game.state.score, entry.points); });

    document.addEventListener('keydown', onKey);
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, noteActivity, { passive: true });
    });
    setInterval(idleCheck, 5000);
    window.addEventListener('pagehide', function () { clock.clearAll(); });

    showScreen('intro');
  }

  CQ.app = {
    elapsed: function () { return game.elapsedMs(); },
    // Exposed for automated browser tests.
    _game: game,
    _board: board,
    _start: startGame
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.CQ = window.CQ || {});
