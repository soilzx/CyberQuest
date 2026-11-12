/*
 * CyberQuest — results, leaderboard and debrief views
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var S = CQ.scenarios;

  var FALSE_POSITIVES = ['m1-scan', 'm1-admin', 'm3-backup', 'm4-payroll'];
  var AI_MISSES = ['m3-mfa', 'm4-exfil'];

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  /* ------------------------------------------------------------------ */
  /* Rank emblem: five segments, one per rank level                       */
  /* ------------------------------------------------------------------ */
  function emblem(level, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'emblem');
    svg.setAttribute('aria-hidden', 'true');
    if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
    var cx = 60, cy = 60, r = 50;
    for (var i = 0; i < 5; i++) {
      var start = -90 + i * 72 + 4;
      var end = start + 64;
      var a0 = start * Math.PI / 180, a1 = end * Math.PI / 180;
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M' + (cx + r * Math.cos(a0)).toFixed(2) + ' ' + (cy + r * Math.sin(a0)).toFixed(2) +
        ' A' + r + ' ' + r + ' 0 0 1 ' + (cx + r * Math.cos(a1)).toFixed(2) + ' ' + (cy + r * Math.sin(a1)).toFixed(2));
      p.setAttribute('class', 'emblem-seg' + (i < level ? ' is-on' : ''));
      svg.appendChild(p);
    }
    var t = document.createElementNS(ns, 'text');
    t.setAttribute('x', '60'); t.setAttribute('y', '70');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('class', 'emblem-level');
    t.textContent = String(level);
    svg.appendChild(t);
    return svg;
  }

  /* ------------------------------------------------------------------ */
  /* Results screen                                                       */
  /* ------------------------------------------------------------------ */
  function renderResults(root, summary, handlers) {
    ui.clear(root);
    var rank = summary.rank;
    var outcomeTitle = summary.breached ? 'Network breached' :
      summary.threatsContained === summary.threatsTotal ? 'Network defended' : 'Network held, with damage';
    var outcomeText = summary.breached
      ? 'Integrity reached zero before the attack was contained. The run still counts. Every decision is in the report below.'
      : summary.threatsContained + ' of ' + summary.threatsTotal + ' real threats contained, with integrity at ' + summary.integrity + '% and stability at ' + summary.stability + '%.';

    var stats = [
      ['Score', String(summary.score)],
      ['Completion time', ui.formatTime(summary.timeMs)],
      ['Correct decisions', String(summary.correct)],
      ['Incorrect decisions', String(summary.incorrect)],
      ['Threats contained', summary.threatsContained + ' / ' + summary.threatsTotal],
      ['Final integrity', summary.integrity + '%'],
      ['Operational stability', summary.stability + '%'],
      ['AI collaboration', summary.ai.good + ' / ' + summary.ai.calls + ' calls'],
      ['Defender model accuracy', summary.model ? summary.model.correct + ' / ' + summary.model.total : 'Not trained']
    ];

    var missionNames = S.missions.map(function (m) { return m.title; });
    var breakdown = h('ol', { class: 'breakdown' }, missionNames.map(function (name, i) {
      var entries = summary.ledger.filter(function (e) { return e.mission === i; });
      return h('li', { class: 'bd-mission' },
        h('details', null,
          h('summary', null,
            h('span', { class: 'bd-index mono' }, String(i + 1)),
            h('span', { class: 'bd-name' }, name),
            h('span', { class: 'bd-time mono' }, summary.missionTimes[i] ? Math.round(summary.missionTimes[i]) + ' s' : ''),
            h('span', { class: 'bd-points mono' }, ui.signed(summary.missionScores[i]))),
          h('ul', { class: 'bd-ledger' }, entries.map(function (e) {
            return h('li', { class: 'tone-' + e.tone },
              h('span', null, e.reason),
              h('span', { class: 'mono' }, ui.signed(e.points)));
          }))));
    }));

    var next = rank.next ? 'Next rank: ' + rank.next.name + ' at ' + rank.next.min.toLocaleString('en-US') + ' points.' : 'Highest rank reached.';

    var card = h('figure', { class: 'rank-card rank-' + rank.id, id: 'rank-card' },
      h('div', { class: 'rc-top' },
        h('span', { class: 'rc-brand' }, 'CyberQuest'),
        h('span', { class: 'rc-date mono' }, formatDate(Date.now()))),
      h('div', { class: 'rc-body' },
        emblem(rank.level),
        h('div', { class: 'rc-text' },
          h('p', { class: 'rc-label' }, 'Rank ' + rank.level + ' of 5'),
          h('p', { class: 'rc-rank' }, rank.name),
          h('p', { class: 'rc-name' }, summary.nickname))),
      h('dl', { class: 'rc-stats' },
        h('div', null, h('dt', null, 'Score'), h('dd', { class: 'mono' }, String(summary.score))),
        h('div', null, h('dt', null, 'Time'), h('dd', { class: 'mono' }, ui.formatTime(summary.timeMs))),
        h('div', null, h('dt', null, 'Threats'), h('dd', { class: 'mono' }, summary.threatsContained + '/' + summary.threatsTotal)),
        h('div', null, h('dt', null, 'Integrity'), h('dd', { class: 'mono' }, summary.integrity + '%'))),
      h('figcaption', { class: 'rc-foot' }, 'The AI Defense Protocol'));

    root.appendChild(h('div', { class: 'results-wrap' },
      h('header', { class: 'results-head' },
        h('p', { class: 'results-kicker' },
          h('span', null, 'Mission report'),
          handlers.position ? h('span', { class: 'results-position mono' }, 'Position ' + handlers.position + ' on this device') : null),
        h('h1', { class: 'results-title', tabindex: '-1', id: 'results-title' }, outcomeTitle),
        h('p', { class: 'results-sub' }, outcomeText)),
      h('div', { class: 'results-grid' },
        h('div', { class: 'results-card-col' },
          card,
          h('p', { class: 'results-next' }, next)),
        h('div', { class: 'results-data' },
          h('dl', { class: 'stat-grid' }, stats.map(function (s) {
            return h('div', { class: 'stat' }, h('dt', null, s[0]), h('dd', { class: 'mono' }, s[1]));
          })),
          h('section', { class: 'results-breakdown' },
            h('h2', { class: 'block-title' }, 'Score breakdown'),
            h('p', { class: 'lab-note' }, 'Every point comes from a decision you made. Open a mission to see each line.'),
            breakdown))),
      h('div', { class: 'results-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-xl', on: { click: handlers.onReplay } }, 'Play again'),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: handlers.onLeaderboard } }, 'View leaderboard'),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: handlers.onLearned } }, 'What you learned'),
        h('button', { type: 'button', class: 'btn btn-secondary', on: { click: function () { downloadCard(summary); } } }, 'Download result card'))));
  }

  /* ------------------------------------------------------------------ */
  /* What you learned                                                     */
  /* ------------------------------------------------------------------ */
  function learnedBody(summary) {
    var dec = {};
    (summary ? summary.decisions : []).forEach(function (d) { dec[d.id] = d; });
    function handled(ids) { return ids.filter(function (id) { return dec[id] && dec[id].correct; }).length; }

    var personal = summary ? {
      anomaly: 'In Mission 1, a scheduled security scan scored 75 and an approved admin session raised an alert. You handled ' + handled(['m1-scan', 'm1-admin']) + ' of these 2 legitimate activities correctly.',
      ml: summary.model ? 'Your Defender learned from ' + summary.model.labelTotal + ' labels (' + summary.model.labelCorrect + ' correct) and scored ' + summary.model.correct + ' of ' + summary.model.total + ' on unseen events.' : '',
      fp: 'You handled ' + handled(FALSE_POSITIVES) + ' of ' + FALSE_POSITIVES.length + ' legitimate activities that triggered alerts without blocking them.',
      fn: 'NEXUS missed 2 real attacks. You caught ' + handled(AI_MISSES) + ' of them.',
      hai: 'You trusted NEXUS when it was right, and overrode it when it was wrong, in ' + summary.ai.good + ' of ' + summary.ai.calls + ' calls.',
      ir: 'You contained ' + summary.threatsContained + ' of ' + summary.threatsTotal + ' threats and finished with ' + summary.integrity + '% integrity.'
    } : {};

    return h('div', { class: 'learned' },
      h('ul', { class: 'concepts' }, S.concepts.map(function (c) {
        return h('li', { class: 'concept' },
          h('h3', { class: 'concept-title' }, c.title),
          h('p', null, c.text),
          personal[c.id] ? h('p', { class: 'concept-you' }, personal[c.id]) : null);
      })),
      h('p', { class: 'learned-major' }, 'Building detection models, defending networks and judging when to trust automation: this overlap is what the Artificial Intelligence & Cybersecurity major explores.'),
      h('p', { class: 'learned-honesty' }, 'About the AI in this game: NEXUS is a hand-written, rule-based simulation. The Mission 2 Defender is a real k-nearest-neighbours classifier trained in your browser on your labels. All network events are fictional.'));
  }

  /* ------------------------------------------------------------------ */
  /* Leaderboard                                                          */
  /* ------------------------------------------------------------------ */
  function leaderboardBody(board, highlightRunId) {
    var rows = board.top(CQ.leaderboard.LIMIT);
    if (!rows.length) {
      return h('div', { class: 'board' },
        h('p', { class: 'board-label' }, board.label),
        h('p', { class: 'board-empty' }, 'No scores yet. Finish a run to post the first one.'));
    }
    return h('div', { class: 'board' },
      h('p', { class: 'board-label' }, board.label),
      h('div', { class: 'board-scroll' },
        h('table', { class: 'board-table' },
          h('caption', { class: 'sr-only' }, 'Top ' + rows.length + ' scores on this device'),
          h('thead', null, h('tr', null,
            h('th', { scope: 'col' }, '#'),
            h('th', { scope: 'col' }, 'Agent'),
            h('th', { scope: 'col', class: 'num' }, 'Score'),
            h('th', { scope: 'col' }, 'Rank'),
            h('th', { scope: 'col', class: 'num' }, 'Time'),
            h('th', { scope: 'col', class: 'col-date' }, 'Date'))),
          h('tbody', null, rows.map(function (r, i) {
            return h('tr', { class: r.runId === highlightRunId ? 'is-you' : '' },
              h('td', { class: 'mono' }, String(i + 1)),
              h('td', { class: 'board-name' }, r.nickname),
              h('td', { class: 'mono num' }, String(r.score)),
              h('td', null, r.rank),
              h('td', { class: 'mono num' }, ui.formatTime(r.timeMs)),
              h('td', { class: 'mono col-date' }, formatDate(r.timestamp)));
          })))));
  }

  /* ------------------------------------------------------------------ */
  /* Result card download (canvas → PNG)                                  */
  /* ------------------------------------------------------------------ */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function drawCard(summary) {
    var W = 1200, H = 630;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var col = {
      bg: cssVar('--c-void', '#0B1016'), panel: cssVar('--c-panel', '#151D26'), raised: cssVar('--c-raised', '#202B36'),
      ink: cssVar('--c-ink', '#EAF1F5'), ink2: cssVar('--c-ink-2', '#A3B4C2'), line: cssVar('--c-line', '#2A3744'),
      signal: cssVar('--c-signal', '#36D6D0')
    };
    g.fillStyle = col.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = col.panel; g.fillRect(48, 48, W - 96, H - 96);
    g.strokeStyle = col.line; g.lineWidth = 2; g.strokeRect(48, 48, W - 96, H - 96);
    g.fillStyle = col.signal; g.fillRect(48, 48, 6, H - 96);

    g.fillStyle = col.ink2;
    g.font = '500 22px "Space Grotesk", sans-serif';
    g.fillText('CyberQuest', 96, 104);
    g.font = '400 18px "IBM Plex Mono", monospace';
    g.textAlign = 'right';
    g.fillText(formatDate(Date.now()), W - 96, 104);
    g.textAlign = 'left';

    // Emblem
    var cx = 230, cy = 300, r = 110;
    g.lineWidth = 14; g.lineCap = 'butt';
    for (var i = 0; i < 5; i++) {
      var s = (-90 + i * 72 + 4) * Math.PI / 180;
      var e = s + 64 * Math.PI / 180;
      g.strokeStyle = i < summary.rank.level ? col.signal : col.raised;
      g.beginPath(); g.arc(cx, cy, r, s, e); g.stroke();
    }
    g.fillStyle = col.ink;
    g.font = '600 92px "Space Grotesk", sans-serif';
    g.textAlign = 'center';
    g.fillText(String(summary.rank.level), cx, cy + 32);
    g.textAlign = 'left';

    g.fillStyle = col.ink2;
    g.font = '400 22px "IBM Plex Sans", sans-serif';
    g.fillText('Rank ' + summary.rank.level + ' of 5', 400, 232);
    g.fillStyle = col.ink;
    g.font = '600 64px "Space Grotesk", sans-serif';
    g.fillText(summary.rank.name, 400, 300);
    g.font = '500 30px "IBM Plex Sans", sans-serif';
    g.fillStyle = col.ink2;
    g.fillText(summary.nickname, 400, 350);

    var stats = [['Score', String(summary.score)], ['Time', ui.formatTime(summary.timeMs)],
      ['Threats', summary.threatsContained + '/' + summary.threatsTotal], ['Integrity', summary.integrity + '%']];
    stats.forEach(function (st, idx) {
      var x = 400 + idx * 170;
      g.fillStyle = col.ink2; g.font = '400 18px "IBM Plex Sans", sans-serif';
      g.fillText(st[0], x, 440);
      g.fillStyle = col.ink; g.font = '500 34px "IBM Plex Mono", monospace';
      g.fillText(st[1], x, 482);
    });

    g.fillStyle = col.ink2; g.font = '400 18px "IBM Plex Sans", sans-serif';
    g.fillText('The AI Defense Protocol. An educational simulation; all events are fictional.', 96, H - 80);
    return c;
  }

  function downloadCard(summary) {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      var canvas = drawCard(summary);
      var name = 'cyberquest-' + summary.nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
      var finish = function (url, revoke) {
        var a = document.createElement('a');
        a.href = url; a.download = name || 'cyberquest-result.png';
        document.body.appendChild(a); a.click(); a.remove();
        if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        ui.toast('Result card saved as ' + a.download, 'good');
      };
      if (canvas.toBlob) canvas.toBlob(function (blob) {
        if (blob) finish(URL.createObjectURL(blob), true);
        else finish(canvas.toDataURL('image/png'), false);
      }, 'image/png');
      else finish(canvas.toDataURL('image/png'), false);
    }).catch(function () { ui.toast('The result card could not be created in this browser.', 'bad'); });
  }

  CQ.results = {
    render: renderResults,
    learnedBody: learnedBody,
    leaderboardBody: leaderboardBody,
    emblem: emblem,
    drawCard: drawCard
  };
})(window.CQ = window.CQ || {});
