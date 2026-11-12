/*
 * CyberQuest — results, leaderboard and "What you learned"
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var S = CQ.scenarios;

  // Situations where NEXUS's own suggestion was wrong.
  var AI_MISTAKES = ['m3-backup', 'm3-mfa', 'm4-leak'];

  function formatDate(ts) {
    try { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function article(word) { return /^[AEIOU]/i.test(word) ? 'an' : 'a'; }

  // Some hosts (sandboxed embeds) block page-started downloads.
  // Set window.CQ = { config: { noDownloads: true } } before the scripts load to hide the button.
  function downloadsAllowed() { return !(CQ.config && CQ.config.noDownloads); }

  /* ------------------------------------------------------------------ */
  /* Rank emblem: five segments, one per rank                             */
  /* ------------------------------------------------------------------ */
  function emblem(level) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'emblem');
    svg.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 5; i++) {
      var a0 = (-90 + i * 72 + 5) * Math.PI / 180, a1 = (-90 + i * 72 + 67) * Math.PI / 180;
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M' + (60 + 50 * Math.cos(a0)).toFixed(2) + ' ' + (60 + 50 * Math.sin(a0)).toFixed(2) +
        ' A50 50 0 0 1 ' + (60 + 50 * Math.cos(a1)).toFixed(2) + ' ' + (60 + 50 * Math.sin(a1)).toFixed(2));
      p.setAttribute('class', 'emblem-seg' + (i < level ? ' is-on' : ''));
      svg.appendChild(p);
    }
    var shield = document.createElementNS(ns, 'path');
    shield.setAttribute('d', 'M60 34 41 41.5v13c0 11.5 8 20 19 23.5 11-3.5 19-12 19-23.5v-13z');
    shield.setAttribute('class', 'emblem-shield');
    svg.appendChild(shield);
    return svg;
  }

  /* ------------------------------------------------------------------ */
  /* Results screen                                                       */
  /* ------------------------------------------------------------------ */
  function stat(value, label) {
    return h('div', { class: 'stat' }, h('p', { class: 'stat-value' }, value), h('p', { class: 'stat-label' }, label));
  }

  function renderResults(root, summary, handlers) {
    ui.clear(root);
    var rank = summary.rank;
    var sub = summary.breached
      ? 'The network went down this time, but you scored ' + summary.score + ' points in ' + ui.formatTime(summary.timeMs) + '.'
      : 'You scored ' + summary.score.toLocaleString('en-US') + ' points in ' + ui.formatTime(summary.timeMs) + '.';

    var nameMsg = h('p', { class: 'name-msg', id: 'name-msg', 'aria-live': 'polite' },
      handlers.position ? 'Your score is #' + handlers.position + ' on this computer.' : 'Your score is saved on this computer.');
    var nameInput = h('input', {
      class: 'name-input', id: 'player-name', type: 'text', maxlength: '16', autocomplete: 'off',
      placeholder: 'Your first name or nickname', 'aria-describedby': 'name-msg'
    });
    var form = h('form', { class: 'name-form', novalidate: true, on: { submit: function (e) {
      e.preventDefault();
      var r = handlers.onSaveName(nameInput.value);
      if (!r.ok) { nameMsg.textContent = r.message; nameMsg.classList.add('is-error'); nameInput.focus(); return; }
      nameMsg.classList.remove('is-error');
      nameMsg.textContent = 'Saved! ' + (r.position ? 'You are #' + r.position + ' on the leaderboard.' : 'Your name is on the leaderboard.');
      card.querySelector('.rc-name').textContent = CQ.game.sanitizeNickname(nameInput.value);
      form.querySelector('button').textContent = 'Update name';
    } } },
      h('label', { class: 'name-label', for: 'player-name' }, 'Add your name to the leaderboard'),
      h('div', { class: 'name-row' }, nameInput, h('button', { type: 'submit', class: 'btn btn-secondary' }, 'Save')),
      nameMsg);

    var card = h('div', { class: 'rank-card' },
      emblem(rank.level),
      h('p', { class: 'rc-level' }, 'Rank ' + rank.level + ' of 5'),
      h('p', { class: 'rc-rank' }, rank.name),
      h('p', { class: 'rc-score' }, summary.score.toLocaleString('en-US') + ' points'),
      h('p', { class: 'rc-name' }, summary.nickname));

    var missionNames = S.missions.map(function (m) { return m.title; });
    var breakdown = h('details', { class: 'breakdown' },
      h('summary', null, 'See how your score was calculated'),
      h('ol', { class: 'breakdown-list' }, missionNames.map(function (name, i) {
        var entries = summary.ledger.filter(function (e) { return e.mission === i; });
        return h('li', null,
          h('p', { class: 'bd-head' }, h('span', null, 'Mission ' + (i + 1) + ': ' + name), h('span', null, ui.signed(summary.missionScores[i]))),
          h('ul', { class: 'bd-lines' }, entries.map(function (e) {
            return h('li', { class: 'tone-' + e.tone }, h('span', null, e.reason), h('span', null, ui.signed(e.points)));
          })));
      })));

    root.appendChild(h('div', { class: 'results-wrap' },
      h('header', { class: 'results-head' },
        h('p', { class: 'step-label' }, 'Game complete'),
        h('h1', { class: 'results-title', id: 'results-title', tabindex: '-1' }, 'You’re ' + article(rank.name) + ' ' + rank.name + '!'),
        h('p', { class: 'results-sub' }, sub)),
      h('div', { class: 'results-grid' },
        h('div', { class: 'results-left' }, card, form),
        h('div', { class: 'results-right' },
          h('div', { class: 'stats' },
            stat(summary.threatsContained + ' of ' + summary.threatsTotal, 'Real threats you stopped'),
            stat(summary.model ? summary.model.correct + ' of ' + summary.model.total : '–', 'New examples your AI got right'),
            stat(summary.ai.good + ' of ' + summary.ai.calls, 'Times you and NEXUS made the right call'),
            stat(summary.integrity + '%', 'Network health at the end')),
          rank.next ? h('p', { class: 'next-rank' }, 'Reach ' + rank.next.min.toLocaleString('en-US') + ' points to become ' + article(rank.next.name) + ' ' + rank.next.name + '.') : h('p', { class: 'next-rank' }, 'That is the highest rank. Amazing work!'),
          breakdown)),
      h('div', { class: 'results-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: handlers.onReplay } }, 'Play again'),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: handlers.onLearned } }, 'What you learned'),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: handlers.onLeaderboard } }, 'Leaderboard'),
        downloadsAllowed() ? h('button', { type: 'button', class: 'btn btn-secondary', on: { click: function () { downloadCard(summary); } } }, 'Save result picture') : null)));
  }

  /* ------------------------------------------------------------------ */
  /* What you learned                                                     */
  /* ------------------------------------------------------------------ */
  function learnedBody(summary) {
    var dec = {};
    (summary ? summary.decisions : []).forEach(function (d) { dec[d.id] = d; });
    var right = function (ids) { return ids.filter(function (id) { return dec[id] && dec[id].correct; }).length; };
    var spotted = right(S.mission1.map(function (m) { return m.id; }));

    var personal = summary ? {
      protect: 'You stopped ' + summary.threatsContained + ' of ' + summary.threatsTotal + ' real threats today.',
      detect: 'In Mission 1 you judged ' + spotted + ' of 4 situations correctly.',
      learn: summary.model ? 'After learning from you, your AI got ' + summary.model.correct + ' of ' + summary.model.total + ' new examples right.' : '',
      mistakes: 'NEXUS was wrong 3 times today. You caught ' + right(AI_MISTAKES) + ' of them.',
      together: 'You and NEXUS made the right call ' + summary.ai.good + ' of ' + summary.ai.calls + ' times.'
    } : {};

    return h('div', { class: 'learned' },
      h('ol', { class: 'lessons' }, S.lessons.map(function (l) {
        return h('li', { class: 'lesson-item' },
          h('h3', null, l.title),
          h('p', null, l.text),
          personal[l.id] ? h('p', { class: 'lesson-you' }, personal[l.id]) : null);
      })),
      h('p', { class: 'learned-note' }, 'About the AI in this game: NEXUS follows rules that we wrote by hand. The AI you trained in Mission 2 is real machine learning that runs in your browser.'));
  }

  /* ------------------------------------------------------------------ */
  /* Leaderboard                                                          */
  /* ------------------------------------------------------------------ */
  function leaderboardBody(board, highlightRunId) {
    var rows = board.top(CQ.leaderboard.LIMIT);
    var note = h('p', { class: 'board-note' }, 'Top 10 scores saved on this computer.');
    if (!rows.length) {
      return h('div', { class: 'board' }, note, h('p', { class: 'board-empty' }, 'No scores yet. Finish a game to be the first!'));
    }
    return h('div', { class: 'board' }, note,
      h('ol', { class: 'board-list' }, rows.map(function (r, i) {
        return h('li', { class: 'board-row' + (r.runId === highlightRunId ? ' is-you' : '') },
          h('span', { class: 'board-pos' }, String(i + 1)),
          h('span', { class: 'board-name' }, r.nickname, h('span', { class: 'board-rank' }, r.rank)),
          h('span', { class: 'board-score' }, r.score.toLocaleString('en-US')),
          h('span', { class: 'board-time' }, ui.formatTime(r.timeMs)));
      })));
  }

  /* ------------------------------------------------------------------ */
  /* Result picture (canvas → PNG)                                        */
  /* ------------------------------------------------------------------ */
  function drawCard(summary) {
    var W = 1200, H = 630;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var css = getComputedStyle(document.documentElement);
    var col = function (name, fallback) { return css.getPropertyValue(name).trim() || fallback; };
    var bg = col('--bg', '#0C1424'), surface = col('--surface', '#15203A'), line = col('--line', '#2A3A58');
    var text = col('--text', '#F4F7FB'), muted = col('--text-2', '#B8C4D6'), accent = col('--accent', '#2ED3C6');
    var font = 'Arial, Helvetica, sans-serif';

    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = surface; g.fillRect(40, 40, W - 80, H - 80);
    g.strokeStyle = line; g.lineWidth = 2; g.strokeRect(40, 40, W - 80, H - 80);

    g.fillStyle = muted; g.font = 'bold 26px ' + font; g.fillText('CyberQuest', 90, 110);
    g.textAlign = 'right'; g.font = '22px ' + font; g.fillText(formatDate(Date.now()), W - 90, 110); g.textAlign = 'left';

    var cx = 240, cy = 330;
    g.lineWidth = 16;
    for (var i = 0; i < 5; i++) {
      var s = (-90 + i * 72 + 5) * Math.PI / 180;
      g.strokeStyle = i < summary.rank.level ? accent : line;
      g.beginPath(); g.arc(cx, cy, 120, s, s + 62 * Math.PI / 180); g.stroke();
    }
    g.fillStyle = text; g.textAlign = 'center'; g.font = 'bold 84px ' + font;
    g.fillText(String(summary.rank.level), cx, cy + 30); g.textAlign = 'left';

    g.fillStyle = muted; g.font = '26px ' + font; g.fillText('Rank ' + summary.rank.level + ' of 5', 430, 250);
    g.fillStyle = text; g.font = 'bold 60px ' + font; g.fillText(summary.rank.name, 430, 320);
    g.fillStyle = accent; g.font = 'bold 40px ' + font; g.fillText(summary.score.toLocaleString('en-US') + ' points', 430, 380);
    g.fillStyle = muted; g.font = '30px ' + font; g.fillText(summary.nickname, 430, 430);
    g.font = '22px ' + font;
    g.fillText('Threats stopped: ' + summary.threatsContained + ' of ' + summary.threatsTotal + '    Time: ' + ui.formatTime(summary.timeMs), 430, 490);
    g.fillText('A learning game about AI and cybersecurity. All events are made up.', 90, H - 80);
    return c;
  }

  function downloadCard(summary) {
    var canvas = drawCard(summary);
    var name = 'cyberquest-' + (summary.nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'result') + '.png';
    var finish = function (url, revoke) {
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      ui.toast('Saved ' + name, 'good');
    };
    if (canvas.toBlob) canvas.toBlob(function (blob) { blob ? finish(URL.createObjectURL(blob), true) : finish(canvas.toDataURL('image/png'), false); }, 'image/png');
    else finish(canvas.toDataURL('image/png'), false);
  }

  CQ.results = {
    render: renderResults,
    learnedBody: learnedBody,
    leaderboardBody: leaderboardBody,
    emblem: emblem,
    drawCard: drawCard
  };
})(window.CQ = window.CQ || {});
