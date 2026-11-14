/*
 * CyberQuest — results, leaderboard and "What you learned"
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var S = CQ.scenarios;
  var i18n = CQ.i18n;
  function T(k, v) { return i18n.t(k, v); }
  function L(x) { return i18n.pick(x); }

  // Situations where NEXUS's own suggestion was wrong.
  var AI_MISTAKES = ['m3-backup', 'm3-mfa', 'm4-leak'];

  // Older saved scores only stored the English rank name.
  var RANK_BY_NAME = { 'Cyber Recruit': 'recruit', 'Threat Hunter': 'hunter', 'Security Analyst': 'analyst', 'Cyber Defender': 'defender', 'Elite AI Guardian': 'guardian' };

  // Some hosts (sandboxed embeds) block page-started downloads.
  // Set window.CQ = { config: { noDownloads: true } } before the scripts load to hide the button.
  function downloadsAllowed() { return !(CQ.config && CQ.config.noDownloads); }

  function displayName(summaryOrEntry) {
    var n = summaryOrEntry.agent || (summaryOrEntry.anonymous ? summaryOrEntry.agentNumber : null);
    return n ? T('agent', { n: n }) : summaryOrEntry.nickname;
  }

  /**
   * Ledger reasons are { k, v }. Values may be scenario text ({ en, ar }),
   * a translation key ({ t }) or plain values.
   */
  function reasonText(reason) {
    if (!reason) return '';
    if (typeof reason === 'string') return reason;
    var vars = {};
    Object.keys(reason.v || {}).forEach(function (key) {
      var val = reason.v[key];
      if (val && typeof val === 'object') vars[key] = val.t ? T(val.t) : L(val);
      else vars[key] = val;
    });
    return T(reason.k, vars);
  }

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
      p.style.setProperty('--i', i);
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
    var rankName = T('rank.' + rank.id);
    var score = i18n.number(summary.score);
    var time = ui.formatTime(summary.timeMs);

    var nameMsg = h('p', { class: 'name-msg', id: 'name-msg', 'aria-live': 'polite' },
      handlers.savedName ? T('res.nameSavedNoPos') : handlers.position ? T('res.position', { n: handlers.position }) : T('res.savedHere'));
    var nameInput = h('input', {
      class: 'name-input', id: 'player-name', type: 'text', maxlength: '16', autocomplete: 'off',
      placeholder: T('res.namePlaceholder'), 'aria-describedby': 'name-msg', dir: 'auto'
    });
    if (handlers.savedName) nameInput.value = handlers.savedName;
    var saveBtn = h('button', { type: 'submit', class: 'btn btn-secondary' }, T(handlers.savedName ? 'res.update' : 'res.save'));
    var cardName = h('p', { class: 'rc-name' }, h('bdi', null, displayName(summary)));
    var form = h('form', { class: 'name-form', novalidate: true, on: { submit: function (e) {
      e.preventDefault();
      var r = handlers.onSaveName(nameInput.value);
      if (!r.ok) { nameMsg.textContent = r.message; nameMsg.classList.add('is-error'); nameInput.focus(); return; }
      nameMsg.classList.remove('is-error');
      nameMsg.textContent = r.position ? T('res.nameSaved', { n: r.position }) : T('res.nameSavedNoPos');
      cardName.firstChild.textContent = summary.nickname;
      saveBtn.textContent = T('res.update');
      CQ.audio.play('success');
    } } },
      h('label', { class: 'name-label', for: 'player-name' }, T('res.nameLabel')),
      h('div', { class: 'name-row' }, nameInput, saveBtn),
      nameMsg);

    var card = h('div', { class: 'rank-card' },
      emblem(rank.level),
      h('p', { class: 'rc-level' }, T('res.rankOf', { n: rank.level })),
      h('p', { class: 'rc-rank' }, rankName),
      h('p', { class: 'rc-score' }, T('res.points', { score: score })),
      cardName);

    var breakdown = h('details', { class: 'breakdown' },
      h('summary', null, T('res.breakdown')),
      h('ol', { class: 'breakdown-list' }, S.missions.map(function (m, i) {
        var entries = summary.ledger.filter(function (e) { return e.mission === i; });
        return h('li', null,
          h('p', { class: 'bd-head' }, h('span', null, T('res.missionLine', { n: i + 1, title: L(m.title) })), h('bdi', null, ui.signed(summary.missionScores[i]))),
          h('ul', { class: 'bd-lines' }, entries.map(function (e) {
            return h('li', { class: 'tone-' + e.tone }, h('span', null, reasonText(e.reason)), h('bdi', null, ui.signed(e.points)));
          })));
      })));

    var next = rank.next
      ? T('res.next', { points: i18n.number(rank.next.min), rank: T('rank.' + rank.next.id) })
      : T('res.top');

    root.appendChild(h('div', { class: 'results-wrap' },
      h('header', { class: 'results-head' },
        h('p', { class: 'step-label' }, T('res.step')),
        h('h1', { class: 'results-title', id: 'results-title', tabindex: '-1' }, T('res.title', { rank: rankName })),
        h('p', { class: 'results-sub' }, T(summary.breached ? 'res.subBreach' : 'res.sub', { score: score, time: time }))),
      h('div', { class: 'results-grid' },
        h('div', { class: 'results-left' }, card, form),
        h('div', { class: 'results-right' },
          h('div', { class: 'stats' },
            stat(T('res.of', { a: summary.threatsContained, b: summary.threatsTotal }), T('res.threats')),
            stat(summary.model ? T('res.of', { a: summary.model.correct, b: summary.model.total }) : '–', T('res.ai')),
            stat(T('res.of', { a: summary.ai.good, b: summary.ai.calls }), T('res.team')),
            stat(summary.integrity + '%', T('res.health'))),
          h('p', { class: 'next-rank' }, next),
          breakdown)),
      h('div', { class: 'results-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: handlers.onReplay } }, T('res.again')),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: handlers.onLearned } }, T('res.learned')),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: handlers.onLeaderboard } }, T('res.board')),
        downloadsAllowed() ? h('button', { type: 'button', class: 'btn btn-secondary', on: { click: function () { downloadCard(summary); } } }, T('res.picture')) : null)));
  }

  /* ------------------------------------------------------------------ */
  /* What you learned                                                     */
  /* ------------------------------------------------------------------ */
  function learnedBody(summary) {
    var dec = {};
    (summary ? summary.decisions : []).forEach(function (d) { dec[d.id] = d; });
    var right = function (ids) { return ids.filter(function (id) { return dec[id] && dec[id].grade === 'best'; }).length; };

    var personal = summary ? {
      protect: T('learn.protect', { a: summary.threatsContained, b: summary.threatsTotal }),
      detect: T('learn.detect', { n: right(S.mission1.map(function (m) { return m.id; })) }),
      learn: summary.model ? T('learn.learn', { a: summary.model.correct, b: summary.model.total }) : '',
      mistakes: T('learn.mistakes', { n: right(AI_MISTAKES) }),
      together: T('learn.together', { a: summary.ai.good, b: summary.ai.calls })
    } : {};

    return h('div', { class: 'learned' },
      h('ol', { class: 'lessons' }, S.lessons.map(function (l) {
        return h('li', { class: 'lesson-item' },
          h('h3', null, L(l.title)),
          h('p', null, L(l.text)),
          personal[l.id] ? h('p', { class: 'lesson-you' }, personal[l.id]) : null);
      })),
      h('p', { class: 'learned-note' }, T('dlg.learnedNote')));
  }

  /* ------------------------------------------------------------------ */
  /* Leaderboard                                                          */
  /* ------------------------------------------------------------------ */
  function leaderboardBody(board, highlightRunId) {
    var rows = board.top(CQ.leaderboard.LIMIT);
    var note = h('p', { class: 'board-note' }, T('dlg.boardNote'));
    if (!rows.length) {
      return h('div', { class: 'board' }, note, h('p', { class: 'board-empty' }, T('dlg.boardEmpty')));
    }
    return h('div', { class: 'board' }, note,
      h('ol', { class: 'board-list' }, rows.map(function (r, i) {
        var rankId = r.rankId || RANK_BY_NAME[r.rank] || 'recruit';
        return h('li', { class: 'board-row' + (r.runId === highlightRunId ? ' is-you' : '') },
          h('span', { class: 'board-pos' }, String(i + 1)),
          h('span', { class: 'board-name' }, h('bdi', null, displayName(r)), h('span', { class: 'board-rank' }, T('rank.' + rankId))),
          h('span', { class: 'board-score' }, i18n.number(r.score)),
          h('span', { class: 'board-time' }, ui.formatTime(r.timeMs)));
      })));
  }

  /* ------------------------------------------------------------------ */
  /* Result picture (canvas → PNG)                                        */
  /* ------------------------------------------------------------------ */
  function drawCard(summary) {
    var W = 1200, H = 630;
    var rtl = i18n.isRTL();
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var css = getComputedStyle(document.documentElement);
    var col = function (name, fallback) { return css.getPropertyValue(name).trim() || fallback; };
    var bg = col('--bg', '#0C1424'), surface = col('--surface', '#15203A'), line = col('--line', '#2A3A58');
    var text = col('--text', '#F4F7FB'), muted = col('--text-2', '#B8C4D6'), accent = col('--accent', '#2ED3C6');
    var font = col('--font', 'Arial, sans-serif');
    g.direction = rtl ? 'rtl' : 'ltr';

    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = surface; g.fillRect(40, 40, W - 80, H - 80);
    g.strokeStyle = line; g.lineWidth = 2; g.strokeRect(40, 40, W - 80, H - 80);

    var near = rtl ? W - 90 : 90, far = rtl ? 90 : W - 90;
    var textX = rtl ? W - 430 : 430;
    g.textAlign = 'start';
    g.fillStyle = muted; g.font = 'bold 26px ' + font; g.fillText(T('brand'), near, 110);
    g.textAlign = 'end'; g.font = '22px ' + font; g.fillText(i18n.date(Date.now()), far, 110);
    g.textAlign = 'start';

    var cx = rtl ? W - 240 : 240, cy = 330;
    g.lineWidth = 16;
    for (var i = 0; i < 5; i++) {
      var s = (-90 + i * 72 + 5) * Math.PI / 180;
      g.strokeStyle = i < summary.rank.level ? accent : line;
      g.beginPath(); g.arc(cx, cy, 120, s, s + 62 * Math.PI / 180); g.stroke();
    }
    g.fillStyle = text; g.textAlign = 'center'; g.font = 'bold 84px Arial, sans-serif';
    g.fillText(String(summary.rank.level), cx, cy + 30); g.textAlign = 'start';

    g.fillStyle = muted; g.font = '26px ' + font; g.fillText(T('res.rankOf', { n: summary.rank.level }), textX, 250);
    g.fillStyle = text; g.font = 'bold 56px ' + font; g.fillText(T('rank.' + summary.rank.id), textX, 320);
    g.fillStyle = accent; g.font = 'bold 40px ' + font; g.fillText(T('res.points', { score: i18n.number(summary.score) }), textX, 380);
    g.fillStyle = muted; g.font = '30px ' + font; g.fillText(displayName(summary), textX, 430);
    g.font = '22px ' + font;
    g.fillText(T('res.cardStats', { a: summary.threatsContained, b: summary.threatsTotal, time: ui.formatTime(summary.timeMs) }), textX, 490);
    g.fillText(T('res.cardFoot'), near, H - 80);
    return c;
  }

  function downloadCard(summary) {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      var canvas = drawCard(summary);
      var slug = String(summary.nickname).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      var name = 'cyberquest-' + (slug || 'result') + '.png';
      var finish = function (url, revoke) {
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        ui.toast(T('res.pictureSaved', { file: name }), 'good');
      };
      if (canvas.toBlob) canvas.toBlob(function (blob) { if (blob) finish(URL.createObjectURL(blob), true); else finish(canvas.toDataURL('image/png'), false); }, 'image/png');
      else finish(canvas.toDataURL('image/png'), false);
    });
  }

  CQ.results = {
    render: renderResults,
    learnedBody: learnedBody,
    leaderboardBody: leaderboardBody,
    reasonText: reasonText,
    emblem: emblem,
    drawCard: drawCard
  };
})(window.CQ = window.CQ || {});
