/*
 * CyberQuest — application controller
 *
 * Screen flow: start → (mission card → challenges → mission complete) × 4
 * → results. Also handles restart, sound, hints, keyboard shortcuts and the
 * booth idle reset. Game rules live in game.js and missions.js.
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var $ = ui.$;
  var S = CQ.scenarios;

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

  function missionCard(index) {
    missionIndex = index;
    var m = S.missions[index];
    document.body.dataset.mission = String(index);
    ui.header.setMission(index, m.title);
    setProgress(0);
    centerCard([
      h('div', { class: 'mission-badge', 'aria-hidden': 'true' }, String(index + 1)),
      h('p', { class: 'step-label' }, 'Mission ' + (index + 1) + ' of 4'),
      h('h2', { class: 'center-title', tabindex: '-1' }, m.title),
      h('p', { class: 'center-text' }, m.intro),
      h('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: function () { beginMission(index); } } }, 'Start mission')
    ]);
    ui.nexus.say(['Ready? Let’s find out what is happening on the network.', 'Now you get to teach me. I learn from your answers!',
      'I’ll give you my advice. You decide if I’m right.', 'This is the big one. I’ll help, but you’re in charge!'][index], 'happy');
    CQ.audio.play('select');
    ui.focus($('#stage'), '.btn-big');
  }

  function beginMission(index) {
    if (mission) return;   // ignore double clicks
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

    var isLast = index === S.missions.length - 1;
    var heading = !isLast ? 'Mission ' + (index + 1) + ' complete!'
      : result.reason === 'breach' ? 'The network went down' : result.reason === 'timeout' ? 'Time’s up!' : 'You saved the network!';

    centerCard([
      h('p', { class: 'step-label' }, isLast ? 'Final mission' : 'Mission ' + (index + 1) + ' of 4'),
      h('h2', { class: 'center-title', tabindex: '-1' }, heading),
      h('p', { class: 'center-points' }, ui.signed(info.missionScore) + ' points'),
      h('div', { class: 'lesson' },
        h('p', { class: 'lesson-label' }, 'What you learned'),
        h('p', { class: 'lesson-text' }, m.takeaway)),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-big',
        on: { click: function () { if (isLast) finishGame(); else missionCard(index + 1); } }
      }, isLast ? 'See your results' : 'Next: ' + S.missions[index + 1].title)
    ]);
    ui.nexus.say(isLast ? (result.reason === 'cleared' ? 'We did it! The network is safe.' : 'That was tough. Let’s see how you did.') : 'Great work! On to the next mission.', 'happy');
    ui.focus($('#stage'), '.btn-big');
  }

  function finishGame() {
    var summary = game.finish();
    clock.clearAll();
    var saved = { position: 0 };
    if (!game.state.saved) {
      saved = board.submit(summary);
      game.state.saved = true;
    }
    CQ.results.render($('#screen-results'), summary, {
      position: saved.position,
      onSaveName: function (name) {
        var clean = CQ.game.sanitizeNickname(name);
        if (!clean) return { ok: false, message: 'Use letters or numbers, up to 16 characters.' };
        var r = board.rename(summary.runId, clean);
        summary.nickname = clean;
        return { ok: true, position: r.position };
      },
      onReplay: startGame,
      onLeaderboard: function () { openLeaderboard(summary.runId); },
      onLearned: function () { openLearned(summary); }
    });
    showScreen('results');
    ui.focus(document, '#results-title');
    ui.announce('Your results: ' + summary.rank.name + ', ' + summary.score + ' points.');
  }

  function teardown() {
    disarmHint();
    if (mission) { mission.destroy(); mission = null; }
    clock.clearAll();
    ui.closeDialog(true);
    idleDialogOpen = false;
    missionIndex = -1;
    delete document.body.dataset.mission;
  }

  function toIntro() {
    teardown();
    game.reset();
    showScreen('intro');
    ui.focus(document, '#btn-start');
  }

  function confirmRestart() {
    ui.openDialog({
      title: 'Start over?',
      body: h('p', null, 'This game will end and its score will not be saved.'),
      actions: [
        { label: 'Keep playing', primary: true },
        { label: 'Start over', danger: true, onClick: toIntro }
      ]
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hints: NEXUS speaks up if the player seems stuck                     */
  /* ------------------------------------------------------------------ */
  function armHint() {
    disarmHint();
    hintTimer = clock.after(HINT_AFTER_MS, function () {
      hintTimer = null;
      if (mission && !ui.dialogOpen()) ui.nexus.say(mission.hint(), 'hint');
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
      title: 'Leaderboard',
      className: 'dialog--wide',
      body: CQ.results.leaderboardBody(board, highlight),
      actions: [
        { label: 'Close', primary: true },
        board.count() ? { label: 'Reset leaderboard', danger: true, onClick: function () { confirmReset(highlight); } } : null
      ].filter(Boolean)
    });
  }

  function confirmReset(highlight) {
    ui.openDialog({
      title: 'Delete all scores?',
      body: h('p', null, 'All ' + board.count() + ' scores saved on this computer will be deleted. This cannot be undone.'),
      actions: [
        { label: 'Cancel', onClick: function () { openLeaderboard(highlight); } },
        { label: 'Delete all scores', danger: true, onClick: function () { board.clear(); ui.toast('Leaderboard cleared.'); openLeaderboard(highlight); } }
      ]
    });
  }

  function openLearned(summary) {
    ui.openDialog({
      title: 'What you learned today',
      className: 'dialog--wide',
      body: CQ.results.learnedBody(summary),
      actions: [{ label: 'Close', primary: true }]
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
    var counter = h('strong', null, String(left));
    var countdown = null;
    var stop = function () { if (countdown) clearInterval(countdown); countdown = null; idleDialogOpen = false; };
    ui.openDialog({
      title: 'Still playing?',
      body: h('p', null, 'The game will go back to the start in ', counter, ' seconds.'),
      dismissible: false,
      actions: [
        { label: 'Keep playing', primary: true, onClick: function () { stop(); noteActivity(); } },
        { label: 'Start over', onClick: function () { stop(); toIntro(); } }
      ]
    });
    countdown = setInterval(function () {
      left--;
      counter.textContent = String(Math.max(0, left));
      if (left <= 0) { stop(); toIntro(); }
    }, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard: 1, 2, 3 pick a choice; C shows a clue                      */
  /* ------------------------------------------------------------------ */
  function onKey(e) {
    noteActivity();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (ui.dialogOpen() || screen !== 'play' || !mission || !mission.onKey) return;
    var key = (e.key || '').toLowerCase();
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
    btn.appendChild(h('span', { class: 'btn-text' }, muted ? 'Sound off' : 'Sound on'));
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off');
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                                */
  /* ------------------------------------------------------------------ */
  function init() {
    introScene = CQ.network.create($('#intro-scene'));
    introScene.show({ from: 'internet', to: 'server', focus: 'server', tag: 'Something unusual', state: 'alert' });

    $('#btn-start').addEventListener('click', startGame);
    $('#btn-intro-board').addEventListener('click', function () { openLeaderboard(null); });
    $('#btn-restart').addEventListener('click', confirmRestart);
    $('#btn-mute').addEventListener('click', function () { CQ.audio.toggle(); renderMute(); CQ.audio.play('select'); });
    renderMute();

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
