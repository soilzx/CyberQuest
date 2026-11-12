/*
 * CyberQuest — application controller
 *
 * Owns the screen flow (intro → missions → results), the run timer,
 * keyboard routing, the idle watchdog used at the exhibition booth, and
 * restart/replay. Gameplay rules live in game.js and missions.js.
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var $ = ui.$;
  var S = CQ.scenarios;

  var IDLE_PROMPT_MS = 120000;     // during a run: ask "still there?"
  var IDLE_RESET_MS = 20000;       // ...then reset after this much more
  var RESULTS_IDLE_MS = 90000;     // results screen returns to the intro
  var HINT_AFTER_MS = 25000;

  var game = new CQ.game.Game();
  var clock = CQ.game.createClock();       // cleared on every restart
  var board = CQ.leaderboard.create();
  var introMap = null;
  var gameMap = null;
  var mission = null;
  var missionIndex = -1;
  var hintTimer = null;
  var lastActivity = Date.now();
  var idleDialogOpen = false;
  var screen = 'intro';
  var lastSummary = null;
  var lastPosition = 0;

  /* ------------------------------------------------------------------ */
  /* Screens                                                              */
  /* ------------------------------------------------------------------ */
  function showScreen(name) {
    screen = name;
    ['intro', 'game', 'results'].forEach(function (s) {
      var el = $('#screen-' + s);
      if (el) el.hidden = s !== name;
    });
    document.body.dataset.screen = name;
    if (introMap) introMap.setAmbient(name === 'intro');
    if (gameMap) gameMap.setAmbient(name === 'game');
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Run lifecycle                                                        */
  /* ------------------------------------------------------------------ */
  function startRun(nickname) {
    teardown();
    CQ.audio.unlock();
    game.start(nickname);
    lastSummary = null;
    ui.clearLog();
    ui.nexus.clear();
    ui.nexus.status('Monitoring', false);
    showScreen('game');
    ui.statusbar.setScore(0);
    ui.statusbar.setMetrics(game.state);
    $('#agent-name').textContent = game.state.nickname;
    ui.log('Session started for ' + game.state.nickname, 'neutral', '00:00');
    clock.every(250, function () { ui.statusbar.setTime(game.elapsedMs()); });
    briefMission(0);
  }

  function briefMission(index) {
    missionIndex = index;
    document.body.dataset.mission = String(index);
    var m = S.missions[index];
    ui.statusbar.setMission(index, '');
    ui.renderQueue([], { emptyText: 'Waiting for mission briefing.' });
    ui.clear($('#workspace'));
    $('#workspace').appendChild(h('div', { class: 'ws-empty' },
      h('h2', { class: 'ws-empty-title' }, 'Mission ' + (index + 1) + ': ' + m.title),
      h('p', null, m.briefing)));
    CQ.audio.play('alert');
    ui.openDialog({
      kicker: 'Mission ' + (index + 1) + ' of 4',
      title: m.title,
      className: 'dialog--briefing',
      dismissible: false,
      body: h('div', null,
        h('p', { class: 'brief-text' }, m.briefing),
        h('p', { class: 'brief-goal' }, h('span', { class: 'brief-goal-label' }, 'Goal'), m.goal)),
      actions: [{ label: index === 0 ? 'Begin mission' : 'Begin mission ' + (index + 1), primary: true, onClick: function () { beginMission(index); } }]
    });
  }

  function beginMission(index) {
    var factory = CQ.missions.factories[index];
    game.beginMission(index);
    ui.log('Mission ' + (index + 1) + ' started: ' + S.missions[index].title, 'neutral');
    mission = factory(missionContext(index));
    mission.start();
  }

  function missionContext(index) {
    var finished = false;
    return {
      game: game,
      map: gameMap,
      audio: CQ.audio,
      clock: clock,
      workspace: $('#workspace'),
      nexus: ui.nexus,
      log: ui.log,
      progress: function (text) { ui.statusbar.setProgress(text); },
      armHint: armHint,
      disarmHint: disarmHint,
      complete: function (result) {
        if (finished) return;      // guard against double completion
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
    CQ.audio.play(result.reason === 'breach' ? 'failure' : 'complete');
    ui.statusbar.setMission(index + 1, '');
    ui.log('Mission ' + (index + 1) + ' complete: ' + ui.signed(info.missionScore) + ' points', 'good');

    var isLast = index === S.missions.length - 1;
    var title = isLast
      ? (result.reason === 'breach' ? 'The network was breached' : result.reason === 'timeout' ? 'Time is up' : 'Attack contained')
      : 'Mission ' + (index + 1) + ' complete';

    ui.openDialog({
      kicker: 'Mission ' + (index + 1) + ' debrief',
      title: title,
      className: 'dialog--debrief',
      dismissible: false,
      body: h('div', null,
        h('div', { class: 'debrief-score' },
          h('span', { class: 'debrief-points mono' }, ui.signed(info.missionScore)),
          h('span', { class: 'debrief-label' }, 'points this mission, in ' + Math.round(info.seconds) + ' seconds')),
        h('p', { class: 'debrief-takeaway' }, m.takeaway),
        info.bonuses.length ? h('ul', { class: 'debrief-bonuses' }, info.bonuses.map(function (b) {
          return h('li', null, h('span', null, b.reason), h('span', { class: 'mono' }, ui.signed(b.points)));
        })) : null),
      actions: [{
        label: isLast ? 'See mission report' : 'Next: ' + S.missions[index + 1].title,
        primary: true,
        onClick: function () { if (isLast) finishRun(); else briefMission(index + 1); }
      }]
    });
  }

  function finishRun() {
    var summary = game.finish();
    lastSummary = summary;
    clock.clearAll();
    var res = { position: 0 };
    if (!game.state.saved) {
      res = board.submit(summary);
      game.state.saved = true;
    }
    lastPosition = res.position;
    CQ.results.render($('#screen-results'), summary, {
      position: res.position,
      onReplay: replay,
      onLeaderboard: function () { openLeaderboard(summary.runId); },
      onLearned: function () { openLearned(summary); }
    });
    showScreen('results');
    var t = $('#results-title');
    if (t) t.focus();
    ui.announce('Mission report. ' + summary.rank.name + ', ' + summary.score + ' points.');
  }

  function teardown() {
    disarmHint();
    if (mission) { mission.destroy(); mission = null; }
    clock.clearAll();
    ui.closeDialog(true);
    idleDialogOpen = false;
    missionIndex = -1;
    delete document.body.dataset.mission;
    if (gameMap) gameMap.reset();
  }

  function replay() {
    var nick = game.state.anonymous ? '' : game.state.nickname;
    startRun(nick);
  }

  function toIntro() {
    teardown();
    game.reset();
    showScreen('intro');
    var input = $('#nickname');
    if (input) input.value = '';
    var btn = $('#btn-start');
    if (btn) btn.focus();
  }

  function confirmRestart() {
    ui.openDialog({
      title: 'Restart the game?',
      body: h('p', null, 'This run will end and its score will not be saved.'),
      actions: [
        { label: 'Keep playing', onClick: function () {} },
        { label: 'Restart', danger: true, autofocus: false, onClick: toIntro }
      ]
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hints                                                                */
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

  function askHint() {
    if (!mission) { ui.nexus.say('Start the mission first, then ask me again.', 'hint'); return; }
    CQ.audio.play('select');
    ui.nexus.say(mission.hint(), 'hint');
    armHint();
  }

  /* ------------------------------------------------------------------ */
  /* Dialog views                                                         */
  /* ------------------------------------------------------------------ */
  function openLeaderboard(highlight) {
    ui.openDialog({
      title: 'Leaderboard',
      className: 'dialog--wide',
      body: CQ.results.leaderboardBody(board, highlight),
      actions: [
        { label: 'Close', primary: true, onClick: function () {} },
        board.count() ? { label: 'Reset leaderboard', danger: true, onClick: function () { confirmReset(highlight); } } : null
      ].filter(Boolean)
    });
  }

  function confirmReset(highlight) {
    ui.openDialog({
      title: 'Reset the leaderboard?',
      body: h('p', null, 'All ' + board.count() + ' saved scores on this device will be deleted. This cannot be undone.'),
      actions: [
        { label: 'Cancel', onClick: function () { openLeaderboard(highlight); } },
        { label: 'Delete all scores', danger: true, onClick: function () { board.clear(); ui.toast('Leaderboard reset.', 'neutral'); openLeaderboard(highlight); } }
      ]
    });
  }

  function openLearned(summary) {
    ui.openDialog({
      title: 'What you learned',
      className: 'dialog--wide',
      body: CQ.results.learnedBody(summary),
      actions: [{ label: 'Close', primary: true, onClick: function () {} }]
    });
  }

  function openHowTo() {
    var steps = [
      ['Pick an alert', 'Alerts wait in the queue on the left. Marked devices on the map have open alerts. Click either.'],
      ['Check the evidence', 'NEXUS, your AI copilot, scores the telemetry. Context records, like tickets and schedules, are yours to read.'],
      ['Make the call', 'Isolate threats, allow legitimate work. Every choice moves integrity, stability and your score.']
    ];
    ui.openDialog({
      title: 'How to play',
      className: 'dialog--wide',
      body: h('div', { class: 'howto' },
        h('ol', { class: 'howto-steps' }, steps.map(function (s, i) {
          return h('li', null, h('span', { class: 'howto-n mono' }, String(i + 1)), h('div', null, h('h3', null, s[0]), h('p', null, s[1])));
        })),
        h('div', { class: 'howto-legend' },
          h('h3', { class: 'block-title' }, 'Device states on the map'),
          legendList()),
        h('p', { class: 'lab-note' }, 'Keyboard: shortcut keys are shown on each button. Tab moves between controls.')),
      actions: [
        { label: 'Close', onClick: function () {} },
        { label: 'INITIALIZE DEFENSE', primary: true, onClick: function () { startRun($('#nickname').value); } }
      ]
    });
  }

  function legendList() {
    var items = [['normal', 'Normal'], ['alert', 'Suspicious'], ['compromised', 'Compromised'], ['isolated', 'Isolated'], ['secure', 'Secured']];
    return h('ul', { class: 'legend' }, items.map(function (i) {
      return h('li', { class: 'legend-item is-' + i[0] }, h('span', { class: 'legend-swatch', 'aria-hidden': 'true' }), i[1]);
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Idle watchdog (exhibition mode)                                      */
  /* ------------------------------------------------------------------ */
  function noteActivity() { lastActivity = Date.now(); }

  function idleCheck() {
    var idle = Date.now() - lastActivity;
    if (screen === 'results' && idle > RESULTS_IDLE_MS && !ui.dialogOpen()) { toIntro(); return; }
    if (screen !== 'game' || idleDialogOpen) return;
    // A briefing or debrief is already waiting: don't stack dialogs, just reset later.
    if (ui.dialogOpen()) { if (idle > IDLE_PROMPT_MS + IDLE_RESET_MS) toIntro(); return; }
    if (idle > IDLE_PROMPT_MS) promptIdle();
  }

  function promptIdle() {
    idleDialogOpen = true;
    var left = Math.round(IDLE_RESET_MS / 1000);
    var counter = h('span', { class: 'mono' }, String(left));
    var countdown = null;
    var stop = function () { if (countdown) clearInterval(countdown); countdown = null; idleDialogOpen = false; };
    ui.openDialog({
      title: 'Still defending?',
      body: h('p', null, 'No activity for two minutes. The game returns to the start screen in ', counter, ' seconds.'),
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
  /* Keyboard                                                             */
  /* ------------------------------------------------------------------ */
  function onKey(e) {
    noteActivity();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (ui.dialogOpen()) return;
    if (screen !== 'game' || !mission || !mission.onKey) return;
    var key = (e.key || '').toLowerCase();
    if (key.length !== 1) return;
    mission.onKey(key);
  }

  /* ------------------------------------------------------------------ */
  /* Mute                                                                 */
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
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  function init() {
    introMap = CQ.network.create($('#intro-map'), { interactive: false, ambient: true, label: 'Simulated network overview' });
    introMap.setExternal('ext1', '203.0.113.47');
    introMap.setExternal('ext3', '192.0.2.66');
    // The intro's single orchestrated moment: suspicious activity lights up.
    setTimeout(function () {
      introMap.setNodeState('ws114', 'alert');
      introMap.setNodeState('auth', 'alert');
      introMap.setMarked(['ws114', 'auth']);
      introMap.highlightRoute(['ext1', 'gateway', 'core', 'auth'], 'amber');
      introMap.send(['ext1', 'gateway', 'core', 'auth'], { tone: 'amber', count: 4, gap: 240 });
    }, ui.reducedMotion() ? 0 : 900);

    gameMap = CQ.network.create($('#game-map'), { interactive: true, ambient: false, label: 'Network map. Select a device to inspect it.' });

    var legendHost = $('#map-legend');
    if (legendHost) legendHost.appendChild(legendList());

    $('#intro-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#nickname');
      var raw = input.value;
      var clean = CQ.game.sanitizeNickname(raw);
      var hint = $('#nick-hint');
      if (raw.trim() && !clean) {
        input.setAttribute('aria-invalid', 'true');
        hint.textContent = 'That name has no usable characters. Use letters, numbers, spaces, dots or dashes, or leave it blank.';
        hint.classList.add('is-error');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      hint.classList.remove('is-error');
      startRun(clean);
    });
    $('#nickname').addEventListener('input', function () {
      var hint = $('#nick-hint');
      if (hint.classList.contains('is-error')) {
        hint.classList.remove('is-error');
        hint.textContent = hint.dataset.default;
        this.removeAttribute('aria-invalid');
      }
    });
    $('#nick-hint').dataset.default = $('#nick-hint').textContent;

    $('#btn-howto').addEventListener('click', openHowTo);
    $('#btn-intro-board').addEventListener('click', function () { openLeaderboard(null); });
    $('#btn-restart').addEventListener('click', confirmRestart);
    $('#btn-hint').addEventListener('click', askHint);
    $('#btn-mute').addEventListener('click', function () { CQ.audio.toggle(); renderMute(); CQ.audio.play('select'); });
    renderMute();

    game.on('metrics', function (s) { ui.statusbar.setMetrics(s); });
    game.on('score', function (entry) { ui.statusbar.setScore(game.state.score, entry.points); });

    document.addEventListener('keydown', onKey);
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, noteActivity, { passive: true });
    });
    setInterval(idleCheck, 5000);

    // A refresh mid-run lands on the intro; there's no half-finished state to recover.
    window.addEventListener('pagehide', function () { clock.clearAll(); });

    showScreen('intro');
  }

  CQ.app = {
    elapsed: function () { return game.elapsedMs(); },
    // Exposed for automated testing in the browser console.
    _game: game,
    _board: board,
    _start: startRun
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.CQ = window.CQ || {});
