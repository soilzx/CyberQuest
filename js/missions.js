/*
 * CyberQuest — mission controllers
 *
 * Each mission is created with a shared context and returns:
 *   start()    – render and begin
 *   destroy()  – stop timers and listeners
 *   onKey(key) – keyboard shortcuts (optional)
 *   hint()     – contextual hint text for NEXUS
 *
 * ctx = { game, map, audio, clock, workspace, complete(result), armHint(), log }
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var S = CQ.scenarios;

  /* ------------------------------------------------------------------ */
  /* Shared case-file builders                                            */
  /* ------------------------------------------------------------------ */
  function caseHeader(item) {
    return h('header', { class: 'case-head' },
      h('p', { class: 'case-time mono' }, item.time),
      h('h2', { class: 'case-name', tabindex: '-1' }, item.title));
  }

  // Evidence on the left, the decision rail on the right.
  function caseLayout(cls, main, decide) {
    return h('article', { class: 'case ' + cls },
      h('div', { class: 'case-main' }, main),
      h('div', { class: 'case-decide' }, decide));
  }

  function caseMeta(item) {
    function row(label, main, sub) {
      return h('div', { class: 'meta-row' },
        h('dt', null, label),
        h('dd', null, h('span', { class: 'meta-main' }, main), sub ? h('span', { class: 'meta-sub mono' }, sub) : null));
    }
    return h('dl', { class: 'case-meta' },
      row('Source', item.source.label, item.source.ip),
      row('Destination', item.destination.label, item.destination.ip),
      row('Protocol', item.protocol));
  }

  function telemetryBlock(item) {
    return h('section', { class: 'case-signals', 'aria-label': 'Telemetry' },
      h('h3', { class: 'block-title' }, 'What the sensors saw'),
      h('ul', { class: 'fact-list' }, item.facts.map(function (f) { return h('li', null, f); })));
  }

  function contextBlock(item, revealed, onInspect) {
    if (!revealed) {
      return h('section', { class: 'case-context is-locked' },
        h('div', null,
          h('h3', { class: 'block-title' }, 'Context records'),
          h('p', { class: 'context-note' }, 'Tickets, schedules and staff records. NEXUS cannot see these.')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-inspect', on: { click: onInspect } },
          'Inspect evidence', ui.kbd('E')));
    }
    return h('section', { class: 'case-context is-open' },
      h('h3', { class: 'block-title' }, 'Context records'),
      h('ul', { class: 'evidence-list' }, item.evidence.map(function (e) { return h('li', null, e); })));
  }

  function findingsList(analysis, limit) {
    var items = analysis.findings.slice(0, limit || 6);
    if (!items.length) return h('p', { class: 'nx-findings-empty' }, 'No detection rules fired.');
    return h('ul', { class: 'nx-findings' }, items.map(function (f) {
      return h('li', { class: f.weight < 0 ? 'is-mitigating' : '' },
        h('span', { class: 'nx-weight mono' }, (f.weight > 0 ? '+' : '−') + Math.abs(f.weight)),
        h('span', null, f.text));
    }));
  }

  function bandWord(band) {
    return { contain: 'contain', investigate: 'investigate', allow: 'allow' }[band];
  }

  function confidenceText(c) {
    return { high: 'High', medium: 'Medium', low: 'Low' }[c];
  }

  function focusFirst(root, sel) {
    var n = root.querySelector(sel);
    if (n && n.focus) n.focus({ preventScroll: false });
  }

  function emptyState(title, text) {
    return h('div', { class: 'ws-empty' },
      h('h2', { class: 'ws-empty-title' }, title),
      h('p', null, text));
  }

  function nodeName(id) {
    var n = S.network.nodes.filter(function (x) { return x.id === id; })[0];
    return n ? n.name : id;
  }

  function placeExternals(map, items) {
    items.forEach(function (it) { if (it.external) map.setExternal(it.external.slot, it.external.label); });
  }

  /* ------------------------------------------------------------------ */
  /* Mission 1 — Identify the intrusion                                   */
  /* ------------------------------------------------------------------ */
  var M1_ACTIONS = [
    { id: 'investigate', label: 'Investigate', key: 'I', past: 'Case opened' },
    { id: 'isolate', label: 'Isolate', key: 'X', past: 'Isolated' },
    { id: 'allow', label: 'Allow', key: 'A', past: 'Allowed' },
    { id: 'dismiss', label: 'Dismiss', key: 'D', past: 'Dismissed' }
  ];

  function mission1(ctx) {
    var items = S.mission1.map(function (it) { return Object.assign({}, it, { analysis: CQ.ai.analyze(it.telemetry) }); });
    var resolved = {};
    var inspected = {};
    var analysed = {};
    var selectedId = null;
    var busy = false;
    var inspectExplained = false;
    var offSelect = null;

    function item(id) { return items.filter(function (i) { return i.id === id; })[0]; }
    function openItems() { return items.filter(function (i) { return !resolved[i.id]; }); }

    function refreshQueue() {
      ui.renderQueue(items.map(function (it) {
        var r = resolved[it.id];
        return {
          id: it.id, time: it.time, title: it.title,
          meta: it.source.ip + ' → ' + it.destination.ip,
          risk: it.analysis.risk,
          status: r ? ui.gradeLabel(r.outcome.grade) + ': ' + r.action.label : 'Open',
          tone: r ? 'done-' + ui.gradeTone(r.outcome.grade) : (selectedId === it.id ? 'active' : 'open')
        };
      }), { selectedId: selectedId, onSelect: select });
      ctx.progress((items.length - openItems().length) + ' of ' + items.length);
      ctx.map.setMarked(openItems().map(function (i) { return i.focus; }));
    }

    function select(id) {
      var it = item(id);
      if (!it) return;
      selectedId = id;
      ctx.audio.play('select');
      ctx.map.select(it.focus);
      ctx.map.highlightRoute(it.route, resolved[id] ? 'muted' : 'amber');
      if (!resolved[id]) ctx.map.send(it.route, { tone: 'amber', count: 3, gap: 260 });
      refreshQueue();
      render();
      if (!analysed[id]) {
        analysed[id] = true;
        var a = it.analysis;
        ctx.nexus.say('Anomaly score ' + a.risk + '/100 for “' + it.title + '”. This measures how unusual the activity is, not whether it is malicious.', 'analysis',
          findingsList(a, 4));
      }
      ctx.armHint();
      focusFirst(ctx.workspace, '.case-name');
    }

    function inspect() {
      var it = item(selectedId);
      if (!it || inspected[it.id]) return;
      inspected[it.id] = true;
      ctx.audio.play('process');
      ctx.log('Context records opened: ' + it.title, 'neutral');
      if (!inspectExplained) {
        inspectExplained = true;
        ctx.nexus.say('These records come from ticketing, calendars and HR. They are outside my telemetry, so weigh them yourself.', 'info');
      }
      render();
      focusFirst(ctx.workspace, '.evidence-list li');
    }

    function decide(actionId) {
      var it = item(selectedId);
      if (!it || resolved[it.id] || busy) return;
      var action = M1_ACTIONS.filter(function (a) { return a.id === actionId; })[0];
      var outcome = it.outcomes[actionId];
      if (!action || !outcome) return;
      busy = true;
      resolved[it.id] = { action: action, outcome: outcome };

      ctx.game.award(outcome.points, it.title + ': ' + ui.gradeLabel(outcome.grade).toLowerCase());
      ctx.game.applyEffects(outcome.effects);
      ctx.game.recordDecision({ mission: 0, id: it.id, grade: outcome.grade, malicious: it.truth === 'malicious', contained: !!outcome.contained });

      ctx.map.setNodeState(it.focus, outcome.node);
      if (actionId === 'isolate' && it.external) ctx.map.setNodeState(it.external.slot, 'isolated');
      ctx.map.highlightRoute(it.route, 'muted');

      var tone = ui.gradeTone(outcome.grade);
      ctx.audio.play(tone === 'good' ? 'success' : tone === 'bad' ? 'error' : 'process');
      ctx.log(action.past + ': ' + it.title, tone);
      ui.announce(ui.gradeLabel(outcome.grade) + '. ' + ui.signed(outcome.points) + ' points.');

      var falsePositive = it.truth === 'benign' && it.analysis.risk >= CQ.ai.thresholds.contain;
      if (falsePositive && tone === 'good') {
        ctx.nexus.say('Agreed. I scored it high because it was unusual; the context shows it was approved. That alert was a false positive.', 'verdict');
      } else if (it.truth === 'malicious' && outcome.contained) {
        ctx.nexus.say('Containment confirmed. Traffic on that path has stopped.', 'verdict');
      } else if (tone === 'bad') {
        ctx.nexus.say(consequenceLine(outcome.effects), 'warn');
      }

      refreshQueue();
      render();
      busy = false;
      ctx.disarmHint();
      focusFirst(ctx.workspace, '.btn-next');
    }

    function next() {
      var open = openItems();
      if (open.length) select(open[0].id);
      else ctx.complete();
    }

    function render() {
      var ws = ctx.workspace;
      ui.clear(ws);
      var it = item(selectedId);
      if (!it) {
        ws.appendChild(emptyState('Pick an alert', 'Select an alert from the queue, or a marked device on the map.'));
        return;
      }
      var r = resolved[it.id];
      var actionRow = h('div', { class: 'case-actions', role: 'group', 'aria-label': 'Choose a response' },
        M1_ACTIONS.map(function (a) {
          var chosen = r && r.action.id === a.id;
          return h('button', {
            type: 'button',
            class: 'action-btn action-' + a.id + (chosen ? ' is-chosen' : ''),
            disabled: r ? true : null,
            aria: { pressed: chosen ? 'true' : null },
            on: { click: function () { decide(a.id); } }
          },
            h('span', { class: 'action-label' }, a.label, ui.kbd(a.key)),
            h('span', { class: 'action-desc' }, it.actionText[a.id]));
        }));

      var after = null;
      if (r) {
        var remaining = openItems().length;
        after = h('div', { class: 'case-after' },
          ui.outcomeBlock(r.outcome.grade, r.outcome.points, r.outcome.text, r.outcome.effects),
          h('button', { type: 'button', class: 'btn btn-primary btn-next', on: { click: next } },
            remaining ? 'Next alert' : 'Complete mission', ui.kbd('N')));
      }

      ws.appendChild(caseLayout('case--intrusion' + (r ? ' is-resolved' : ''),
        [caseHeader(it),
          h('div', { class: 'case-grid' }, caseMeta(it), telemetryBlock(it)),
          contextBlock(it, inspected[it.id], inspect)],
        [ui.riskGauge(it.analysis, { label: 'Anomaly score' }),
          r ? null : h('p', { class: 'case-prompt' }, 'How do you respond?'),
          actionRow,
          after]));
    }

    function onMapSelect(nodeId) {
      var match = openItems().filter(function (i) { return i.focus === nodeId || i.source.node === nodeId || i.destination.node === nodeId; })[0] ||
        items.filter(function (i) { return i.focus === nodeId; })[0];
      if (match) select(match.id);
      else {
        ctx.audio.play('select');
        ctx.nexus.say(nodeName(nodeId) + ' has no open alert. Its traffic is within normal ranges.', 'info');
      }
    }

    return {
      start: function () {
        ctx.map.reset();
        placeExternals(ctx.map, items);
        offSelect = ctx.map.onSelect(onMapSelect);
        ctx.nexus.say('Four alerts are waiting from the overnight shift. I have scored each one with my detection rules. High scores mean unusual, so check the context before you act.', 'info');
        refreshQueue();
        select(items[0].id);
      },
      destroy: function () { if (offSelect) offSelect(); },
      onKey: function (key) {
        if (key === 'e') inspect();
        else if (key === 'n') { if (selectedId && resolved[selectedId]) next(); }
        else {
          var a = M1_ACTIONS.filter(function (x) { return x.key.toLowerCase() === key; })[0];
          if (a) decide(a.id);
        }
      },
      hint: function () {
        var it = item(selectedId);
        if (!it || resolved[it.id]) return 'Pick an open alert from the queue. The progress counter in the top bar shows how many remain.';
        if (!inspected[it.id]) return 'Open the context records before deciding. A ticket or schedule can explain activity that looks alarming.';
        return it.truth === 'benign'
          ? 'The context records explain this activity. Ask yourself whether anything here is actually unauthorised.'
          : 'Nothing in the context records explains this. When activity is both unusual and unexplained, containment is usually right.';
      }
    };
  }

  function consequenceLine(effects) {
    var parts = [];
    if (effects.integrity) parts.push('integrity ' + ui.signed(effects.integrity));
    if (effects.stability) parts.push('stability ' + ui.signed(effects.stability));
    if (effects.threat) parts.push('threat ' + ui.signed(effects.threat));
    return parts.length ? 'Consequence recorded: ' + parts.join(', ') + '.' : 'Decision recorded.';
  }

  /* ------------------------------------------------------------------ */
  /* Mission 2 — Train the AI defender                                    */
  /* ------------------------------------------------------------------ */
  var K = 3;
  var LABEL_POINTS = 15;
  var TEST_POINTS = 25;

  function featureList(sample, compact) {
    return h('dl', { class: 'features' + (compact ? ' is-compact' : '') }, S.features.map(function (f, i) {
      var v = sample.x[i];
      return h('div', { class: 'feat' },
        h('dt', null, f.name),
        h('dd', null,
          h('span', { class: 'feat-bar', 'aria-hidden': 'true' }, h('span', { class: 'feat-fill', style: 'transform:scaleX(' + v + ')' })),
          h('span', { class: 'feat-val mono' }, sample.display[i])));
    }));
  }

  function mission2(ctx) {
    var labels = {};
    var phase = 'label';
    var firstRun = null;
    var lastRun = null;
    var runs = 0;
    var training = false;
    S.training.forEach(function (t) { labels[t.id] = null; });

    function labelledCount() { return S.training.filter(function (t) { return labels[t.id]; }).length; }

    function refreshQueue() {
      ui.renderQueue([], { emptyText: phase === 'label' ? 'Alerts are paused while you train the Defender model.' : 'Defender model trained. Ready for deployment.' });
      ctx.progress(phase === 'label' ? labelledCount() + ' of 8 labelled' : 'Trained');
    }

    function setLabel(id, value) {
      if (training) return;
      labels[id] = value;
      ctx.audio.play('select');
      if (phase === 'label') {
        refreshQueue();
        updateLabelCard(id);
        updateTrainButton();
        ctx.armHint();
      } else {
        render();
      }
    }

    function updateLabelCard(id) {
      var card = ctx.workspace.querySelector('[data-sample="' + id + '"]');
      if (!card) { render(); return; }
      card.classList.toggle('is-benign', labels[id] === 'benign');
      card.classList.toggle('is-malicious', labels[id] === 'malicious');
      Array.prototype.forEach.call(card.querySelectorAll('.label-btn'), function (b) {
        b.setAttribute('aria-pressed', b.dataset.value === labels[id] ? 'true' : 'false');
      });
    }

    function updateTrainButton() {
      var btn = ctx.workspace.querySelector('.btn-train');
      var count = ctx.workspace.querySelector('.lab-count');
      var n = labelledCount();
      if (count) count.textContent = n + ' of 8 labelled';
      if (btn) {
        btn.disabled = n < S.training.length;
        btn.setAttribute('aria-describedby', 'train-note');
      }
    }

    function labelToggle(sample, compact) {
      return h('div', { class: 'label-toggle' + (compact ? ' is-compact' : ''), role: 'group', 'aria-label': 'Label for ' + sample.id + ': ' + sample.title },
        ['benign', 'malicious'].map(function (v) {
          return h('button', {
            type: 'button',
            class: 'label-btn label-' + v,
            data: { value: v },
            disabled: training ? true : null,
            aria: { pressed: labels[sample.id] === v ? 'true' : 'false' },
            on: { click: function () { setLabel(sample.id, v); } }
          }, compact ? (v === 'benign' ? 'B' : 'M') : (v === 'benign' ? 'BENIGN' : 'MALICIOUS'));
        }));
    }

    function train() {
      if (training || labelledCount() < S.training.length) return;
      training = true;
      runs++;
      var model = CQ.ai.trainKNN(S.training.map(function (t) { return { id: t.id, x: t.x, label: labels[t.id] }; }), K);
      var result = model.evaluate(S.testSet.map(function (q) { return { id: q.id, x: q.x, truth: q.truth }; }));
      var labelCorrect = S.training.filter(function (t) { return labels[t.id] === t.truth; }).length;
      var run = { result: result, labels: Object.assign({}, labels), labelCorrect: labelCorrect, n: runs };

      ctx.nexus.status('Training', true);
      ctx.map.send(['core', 'ai'], { tone: 'signal', count: 4, gap: 180 });
      showTraining(function () {
        training = false;
        ctx.nexus.status('Monitoring', false);
        lastRun = run;
        if (!firstRun) {
          firstRun = run;
          score(run);
          phase = 'results';
          refreshQueue();
        } else {
          ctx.log('Experiment run ' + run.n + ': ' + result.correct + ' of 6 correct (score unchanged)', 'neutral');
          ctx.nexus.say('Experiment run ' + run.n + ': ' + result.correct + ' of 6 correct. Your score stays locked to the first run.', 'model');
        }
        render();
        focusFirst(ctx.workspace, '.acc-value');
      });
    }

    function score(run) {
      var r = run.result;
      ctx.game.award(run.labelCorrect * LABEL_POINTS, 'Training labels: ' + run.labelCorrect + ' of 8 correct');
      ctx.game.award(r.correct * TEST_POINTS, 'Defender accuracy on unseen events: ' + r.correct + ' of 6');
      S.training.forEach(function (t) {
        ctx.game.recordDecision({ mission: 1, id: 'label-' + t.id, grade: run.labels[t.id] === t.truth ? 'best' : 'wrong', malicious: false });
      });
      ctx.game.recordModel({ correct: r.correct, total: r.total, accuracy: r.accuracy, labelCorrect: run.labelCorrect, labelTotal: 8,
        falsePositives: r.falsePositives, falseNegatives: r.falseNegatives });
      ctx.audio.play(r.correct >= 5 ? 'success' : r.correct >= 3 ? 'process' : 'error');
      ctx.log('Defender trained: ' + r.correct + ' of 6 correct on unseen events', r.correct >= 5 ? 'good' : r.correct >= 3 ? 'warn' : 'bad');
      ctx.nexus.say('The Defender is separate from me. I am hand-written rules; it learned only from your eight labels. On six events it had never seen, it got ' + r.correct + ' right.', 'model');
      if (r.falseNegatives) ctx.nexus.say('It missed ' + r.falseNegatives + ' real threat' + (r.falseNegatives > 1 ? 's' : '') + '. In security, a missed attack (false negative) is usually the costlier error.', 'warn');
      ui.announce('Training complete. ' + r.correct + ' of 6 test events classified correctly.');
    }

    function showTraining(done) {
      var ws = ctx.workspace;
      ui.clear(ws);
      var total = S.testSet.length * S.training.length;
      var fill = h('span', { class: 'train-fill' });
      var counter = h('span', { class: 'mono train-count' }, '0 / ' + total);
      ws.appendChild(h('div', { class: 'lab lab--training', role: 'status' },
        h('h2', { class: 'lab-title' }, 'Training the Defender'),
        h('p', { class: 'lab-sub' }, 'k-nearest neighbours, k = ' + K + '. For each unseen event, the model measures its distance to all 8 labelled examples and takes a vote among the 3 closest.'),
        h('div', { class: 'train-track', 'aria-hidden': 'true' }, fill),
        h('p', { class: 'train-caption' }, 'Distances measured ', counter)));
      var steps = 24;
      var i = 0;
      var duration = ui.reducedMotion() ? 0 : 1500;
      ctx.audio.play('process');
      if (!duration) { done(); return; }
      var id = ctx.clock.every(duration / steps, function () {
        i++;
        var f = i / steps;
        fill.style.transform = 'scaleX(' + f + ')';
        counter.textContent = Math.round(f * total) + ' / ' + total;
        if (i % 6 === 0) ctx.audio.play('tick');
        if (i >= steps) { ctx.clock.cancel(id); ctx.clock.after(250, done); }
      });
    }

    function explainMiss(row, run) {
      var bad = row.prediction.neighbors.filter(function (n) {
        var t = S.training.filter(function (x) { return x.id === n.id; })[0];
        return run.labels[n.id] !== t.truth;
      });
      if (bad.length) {
        return 'Predicted ' + row.prediction.label + ' because ' + bad.map(function (n) { return n.id; }).join(' and ') +
          (bad.length > 1 ? ' were' : ' was') + ' labelled ' + bad[0].label + ' in training. Wrong labels in, wrong predictions out.';
      }
      return 'Its neighbours were labelled correctly, but this event sits close to examples from both classes.';
    }

    function render() {
      var ws = ctx.workspace;
      ui.clear(ws);
      if (phase === 'label') {
        ws.appendChild(h('div', { class: 'lab' },
          h('header', { class: 'lab-head' },
            h('div', null,
              h('h2', { class: 'lab-title', tabindex: '-1' }, 'Label the training data'),
              h('p', { class: 'lab-sub' }, 'Is each event benign or malicious? The Defender model will learn only from your answers.')),
            h('p', { class: 'lab-count mono', 'aria-live': 'polite' }, labelledCount() + ' of 8 labelled')),
          h('ol', { class: 'sample-grid' }, S.training.map(function (t) {
            return h('li', {
              class: 'sample' + (labels[t.id] ? ' is-' + labels[t.id] : ''),
              data: { sample: t.id }
            },
              h('header', { class: 'sample-head' },
                h('span', { class: 'sample-id mono' }, t.id),
                h('h3', { class: 'sample-title' }, t.title)),
              featureList(t),
              labelToggle(t));
          })),
          h('div', { class: 'lab-actions' },
            h('button', { type: 'button', class: 'btn btn-primary btn-train', disabled: labelledCount() < 8 ? true : null, on: { click: train } }, 'TRAIN DEFENDER'),
            h('p', { class: 'lab-note', id: 'train-note' }, 'Label all eight to train. Six more events are held back to test the model.'))));
        return;
      }

      var run = lastRun;
      var r = run.result;
      var first = firstRun.result;
      var isExperiment = run !== firstRun;

      var rows = r.rows.map(function (row) {
        var q = S.testSet.filter(function (x) { return x.id === row.id; })[0];
        var p = row.prediction;
        return h('li', { class: 'pred' + (row.correct ? ' is-right' : ' is-wrong') },
          h('div', { class: 'pred-main' },
            h('span', { class: 'pred-id mono' }, q.id),
            h('span', { class: 'pred-title' }, q.title)),
          h('div', { class: 'pred-call' },
            h('span', { class: 'pred-label label-' + p.label }, p.label === 'malicious' ? 'Malicious' : 'Benign'),
            h('span', { class: 'pred-votes' + (p.unanimous ? '' : ' is-split') },
              p.unanimous ? '3 of 3 neighbours agree' : '2 of 3 agree: uncertain')),
          h('div', { class: 'pred-neighbors mono', 'aria-label': 'Nearest training examples' },
            p.neighbors.map(function (n) {
              return h('span', { class: 'nb label-' + n.label, title: n.id + ' labelled ' + n.label + ', distance ' + n.distance.toFixed(2) },
                n.id + ' ' + (n.label === 'malicious' ? 'M' : 'B'));
            })),
          h('div', { class: 'pred-truth' },
            ui.svgIcon(row.correct ? ui.ICON.check : ui.ICON.cross, 'pred-mark'),
            h('span', null, 'Actual: ' + (row.truth === 'malicious' ? 'malicious' : 'benign'))),
          row.correct ? null : h('p', { class: 'pred-why' }, explainMiss(row, run)));
      });

      var mislabels = S.training.filter(function (t) { return run.labels[t.id] !== t.truth; });

      ws.appendChild(h('div', { class: 'lab lab--results' },
        h('header', { class: 'lab-head' },
          h('div', { class: 'acc' },
            h('p', { class: 'acc-value mono', tabindex: '-1' }, r.correct + '/' + r.total),
            h('p', { class: 'acc-text' }, isExperiment
              ? 'Experiment run ' + run.n + '. Scored result stays at ' + first.correct + '/' + first.total + '.'
              : 'correct on events the model never saw during training')),
          h('dl', { class: 'acc-split' },
            h('div', null, h('dt', null, 'False positives'), h('dd', { class: 'mono' }, String(r.falsePositives))),
            h('div', null, h('dt', null, 'False negatives'), h('dd', { class: 'mono' }, String(r.falseNegatives))),
            h('div', null, h('dt', null, 'Labels matching truth'), h('dd', { class: 'mono' }, run.labelCorrect + '/8')))),
        h('ol', { class: 'pred-list' }, rows),
        mislabels.length ? h('section', { class: 'label-review' },
          h('h3', { class: 'block-title' }, 'Labels that taught the model something wrong'),
          h('ul', null, mislabels.map(function (t) {
            return h('li', null, h('span', { class: 'mono' }, t.id), ' ' + t.title + ': you said ' + run.labels[t.id] + ', it was ' + t.truth + '.');
          }))) : h('p', { class: 'label-review is-clean' }, 'Every training label matched the ground truth.'),
        h('section', { class: 'experiment' },
          h('div', null,
            h('h3', { class: 'block-title' }, 'Experiment: change labels and retrain'),
            h('p', { class: 'lab-note' }, 'Your score is locked from the first run. Tuning labels until the test set looks good would be data leakage: the test would stop being a fair exam.')),
          h('div', { class: 'experiment-row' },
            h('ul', { class: 'chip-row' }, S.training.map(function (t) {
              return h('li', { class: 'chip-item' }, h('span', { class: 'mono chip-id', title: t.title }, t.id), labelToggle(t, true));
            })),
            h('button', { type: 'button', class: 'btn btn-secondary', on: { click: train } }, 'Retrain'))),
        h('div', { class: 'lab-actions' },
          h('button', { type: 'button', class: 'btn btn-primary btn-next', on: { click: function () { ctx.complete(); } } }, 'Complete mission', ui.kbd('N')))));
    }

    return {
      start: function () {
        ctx.map.reset();
        ctx.map.setMarked(['ai']);
        ctx.map.select('ai');
        ctx.map.highlightRoute(['core', 'ai'], 'signal');
        ctx.nexus.say('Mission 2 uses a real machine-learning model, the Defender, running on the AI monitor node. It starts empty. Its quality depends entirely on your labels.', 'info');
        refreshQueue();
        render();
        ctx.armHint();
        focusFirst(ctx.workspace, '.lab-title');
      },
      destroy: function () {},
      onKey: function (key) { if (key === 'n' && phase === 'results' && !training) ctx.complete(); },
      hint: function () {
        if (phase === 'label') {
          return 'Look at combinations, not single signals. A big transfer to a trusted partner is normal. A new device that IT enrolled is normal. A blocklisted destination is not.';
        }
        return 'Click a B or M chip to flip a label, then retrain. Watch which test events change. That shows how much each label matters.';
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Mission 3 — Human vs. AI                                             */
  /* ------------------------------------------------------------------ */
  var INSPECT_BONUS = 20;

  function mission3(ctx) {
    var items = S.mission3.map(function (it) { return Object.assign({}, it, { analysis: CQ.ai.analyze(it.telemetry) }); });
    var index = 0;
    var resolved = {};
    var inspected = {};
    var busy = false;
    var offSelect = null;

    function current() { return items[index]; }

    function aiBand(it) { return it.analysis.band === 'contain' ? 'contain' : 'allow'; }

    function refreshQueue() {
      ui.renderQueue(items.map(function (it, i) {
        var r = resolved[it.id];
        return {
          id: it.id, time: it.time, title: it.title,
          meta: it.source.ip + ' → ' + it.destination.ip,
          risk: i <= index ? it.analysis.risk : null,
          status: r ? (r.correct ? 'Correct: ' : 'Wrong: ') + (r.followed ? 'followed NEXUS' : 'overrode NEXUS') : i === index ? 'Active' : 'Waiting',
          tone: r ? 'done-' + (r.correct ? 'good' : 'bad') : i === index ? 'active' : 'waiting',
          disabled: i > index
        };
      }), { selectedId: current() ? current().id : null, onSelect: function (id) {
        var i = items.findIndex(function (x) { return x.id === id; });
        if (i === index) focusFirst(ctx.workspace, '.case-name');
      } });
      ctx.progress(Object.keys(resolved).length + ' of ' + items.length);
      ctx.map.setMarked(current() && !resolved[current().id] ? [current().focus] : []);
    }

    function show(i) {
      index = i;
      var it = current();
      ctx.map.reset();
      if (it.external) ctx.map.setExternal(it.external.slot, it.external.label);
      ctx.map.select(it.focus);
      ctx.map.setNodeState(it.focus, 'alert');
      ctx.map.highlightRoute(it.route, 'amber');
      ctx.map.send(it.route, { tone: 'amber', count: 3, gap: 260 });
      ctx.audio.play('alert');
      var a = it.analysis;
      var rec = it.actions[aiBand(it)];
      ctx.nexus.say('“' + it.title + '”: risk ' + a.risk + '/100. I recommend: ' + rec.charAt(0).toLowerCase() + rec.slice(1) + '. Confidence: ' + confidenceText(a.confidence).toLowerCase() + '.', 'analysis');
      ctx.log('New incident: ' + it.title, 'warn');
      refreshQueue();
      render();
      ctx.armHint();
      focusFirst(ctx.workspace, '.case-name');
    }

    function inspect() {
      var it = current();
      if (!it || inspected[it.id] || resolved[it.id]) return;
      inspected[it.id] = true;
      ctx.audio.play('process');
      ctx.log('Evidence inspected: ' + it.title, 'neutral');
      render();
      focusFirst(ctx.workspace, '.evidence-list li');
    }

    function decide(follow) {
      var it = current();
      if (!it || resolved[it.id] || busy) return;
      busy = true;
      var recommended = aiBand(it);
      var chosen = follow ? recommended : (recommended === 'contain' ? 'allow' : 'contain');
      var outcome = it.outcomes[chosen];
      var correct = chosen === it.correctBand;
      var aiRight = recommended === it.correctBand;
      resolved[it.id] = { followed: follow, chosen: chosen, correct: correct, outcome: outcome };

      ctx.game.award(outcome.points, it.title + ': ' + (correct ? (aiRight ? 'trusted a correct AI call' : 'overrode an incorrect AI call') : (aiRight ? 'overrode a correct AI call' : 'followed an incorrect AI call')));
      if (correct && inspected[it.id]) ctx.game.award(INSPECT_BONUS, 'Checked the evidence before deciding', 'bonus');
      ctx.game.applyEffects(outcome.effects);
      ctx.game.recordDecision({
        mission: 2, id: it.id, grade: correct ? 'best' : 'wrong',
        malicious: it.truth === 'malicious', contained: it.truth === 'malicious' && chosen === 'contain',
        ai: { recommendedBest: aiRight, followed: follow, chosenWrong: !correct }
      });

      ctx.map.setNodeState(it.focus, outcome.node);
      if (it.external && chosen === 'contain') ctx.map.setNodeState(it.external.slot, 'isolated');
      ctx.map.highlightRoute(it.route, 'muted');
      ctx.map.setMarked([]);

      ctx.audio.play(correct ? 'success' : 'error');
      ctx.log((follow ? 'Followed NEXUS: ' : 'Overrode NEXUS: ') + it.actions[chosen], correct ? 'good' : 'bad');
      ui.announce((correct ? 'Correct. ' : 'Incorrect. ') + ui.signed(outcome.points) + ' points.');

      if (!aiRight && !follow) ctx.nexus.say('You were right to override me. My rules saw the signals but not the ' + (it.truth === 'benign' ? 'schedule and change ticket' : 'MFA push flood or the HR record') + '.', 'verdict');
      else if (aiRight && follow) ctx.nexus.say('Agreed. The evidence supported the recommendation.', 'verdict');
      else if (!aiRight && follow) ctx.nexus.say('We both got this one wrong. My recommendation was based on incomplete information, and the context records showed it.', 'warn');
      else ctx.nexus.say('My call was right this time. Overriding AI is valuable only when the evidence disagrees with it.', 'warn');

      refreshQueue();
      render();
      busy = false;
      ctx.disarmHint();
      focusFirst(ctx.workspace, '.btn-next');
    }

    function next() {
      if (!resolved[current().id]) return;
      if (index < items.length - 1) show(index + 1);
      else ctx.complete();
    }

    function render() {
      var ws = ctx.workspace;
      ui.clear(ws);
      var it = current();
      var a = it.analysis;
      var r = resolved[it.id];
      var band = aiBand(it);
      var other = band === 'contain' ? 'allow' : 'contain';

      var call = h('section', { class: 'nexus-call tone-' + (band === 'contain' ? 'contain' : 'allow') },
        h('div', { class: 'nc-head' },
          h('span', { class: 'nc-label' }, 'NEXUS recommends'),
          h('strong', { class: 'nc-action' }, it.actions[band]),
          h('span', { class: 'nc-conf conf-' + a.confidence }, 'Confidence: ' + confidenceText(a.confidence))),
        h('p', { class: 'nc-why' }, 'Rules that fired:'),
        findingsList(a));

      var actions = h('div', { class: 'case-actions case-actions--versus', role: 'group', 'aria-label': 'Follow or override NEXUS' },
        h('button', {
          type: 'button', class: 'action-btn action-follow' + (r && r.followed ? ' is-chosen' : ''),
          disabled: r ? true : null, on: { click: function () { decide(true); } }
        },
          h('span', { class: 'action-label' }, 'FOLLOW AI', ui.kbd('F')),
          h('span', { class: 'action-desc' }, it.actions[band])),
        h('button', {
          type: 'button', class: 'action-btn action-override' + (r && !r.followed ? ' is-chosen' : ''),
          disabled: r ? true : null, on: { click: function () { decide(false); } }
        },
          h('span', { class: 'action-label' }, 'OVERRIDE AI', ui.kbd('O')),
          h('span', { class: 'action-desc' }, it.actions[other])));

      var after = null;
      if (r) {
        after = h('div', { class: 'case-after' },
          ui.outcomeBlock(r.correct ? 'best' : 'wrong', r.outcome.points + (r.correct && inspected[it.id] ? INSPECT_BONUS : 0), r.outcome.text, r.outcome.effects),
          h('button', { type: 'button', class: 'btn btn-primary btn-next', on: { click: next } },
            index < items.length - 1 ? 'Next incident' : 'Complete mission', ui.kbd('N')));
      }

      ws.appendChild(caseLayout('case--versus' + (r ? ' is-resolved' : ''),
        [caseHeader(it),
          call,
          h('div', { class: 'case-grid' }, caseMeta(it), telemetryBlock(it)),
          contextBlock(it, inspected[it.id] || !!r, inspect)],
        [ui.riskGauge(a, { label: 'NEXUS risk score' }),
          r ? null : h('p', { class: 'case-prompt' }, 'Trust the recommendation?'),
          actions,
          after]));
    }

    return {
      start: function () {
        offSelect = ctx.map.onSelect(function (id) {
          var it = current();
          if (it && (id === it.focus || id === it.source.node || id === it.destination.node)) focusFirst(ctx.workspace, '.case-name');
          else ctx.nexus.say(nodeName(id) + ' has no open incident.', 'info');
        });
        ctx.nexus.say('For this mission I will make the recommendations. I score telemetry: volumes, timings, destinations. I cannot read tickets, schedules or HR records. You can.', 'info');
        show(0);
      },
      destroy: function () { if (offSelect) offSelect(); },
      onKey: function (key) {
        if (key === 'e') inspect();
        else if (key === 'f') decide(true);
        else if (key === 'o') decide(false);
        else if (key === 'n') next();
      },
      hint: function () {
        var it = current();
        if (!it || resolved[it.id]) return 'Move on to the next incident when you are ready.';
        if (!inspected[it.id]) return 'Inspect the evidence first. You earn a bonus for checking before you decide, and it is the only way to catch my mistakes.';
        return 'Do the context records explain my signals, or reveal something I could not see? If they contradict me, override.';
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Mission 4 — Final defense                                            */
  /* ------------------------------------------------------------------ */
  var TIME_BONUS_PER_SECOND = 2;
  var INTEGRITY_BONUS_FACTOR = 2;
  var MISSED_PENALTY = -60;
  var ARRIVAL_THREAT = 12;

  function mission4(ctx) {
    var conf = S.mission4;
    var items = conf.incidents.map(function (it) {
      var analysis = CQ.ai.analyze(it.telemetry);
      var pick = it.options.filter(function (o) { return o.band === analysis.band; })[0] || null;
      return Object.assign({}, it, { analysis: analysis, nexusPick: pick ? pick.id : null });
    });
    var arrived = {};
    var resolved = {};
    var inspected = {};
    var selectedId = null;
    var firstDecision = null;
    var startedAt = 0;
    var ended = false;
    var busy = false;
    var loopId = null;
    var lastTick = 0;
    var lastWholeSecond = -1;
    var offSelect = null;
    var offBreach = null;

    function item(id) { return items.filter(function (i) { return i.id === id; })[0]; }
    function elapsed() { return (CQ.game.now() - startedAt) / 1000; }
    function remaining() { return Math.max(0, conf.duration - elapsed()); }
    function arrivedItems() { return items.filter(function (i) { return arrived[i.id]; }); }
    function openItems() { return arrivedItems().filter(function (i) { return !resolved[i.id]; }); }

    function isActiveThreat(it) {
      if (!arrived[it.id] || it.truth !== 'malicious') return false;
      var r = resolved[it.id];
      return !r || !r.option.contained;
    }

    function drainRate() {
      return items.reduce(function (sum, it) { return sum + (isActiveThreat(it) ? it.drain : 0); }, 0);
    }

    function refreshQueue() {
      var list = arrivedItems().map(function (it) {
        var r = resolved[it.id];
        return {
          id: it.id, time: it.time, title: it.title,
          meta: it.source.label + ' → ' + it.destination.label,
          risk: it.analysis.risk,
          status: r ? ui.gradeLabel(r.option.grade) + ': ' + r.option.label : 'Open',
          tone: r ? 'done-' + ui.gradeTone(r.option.grade) : (selectedId === it.id ? 'active' : 'open')
        };
      });
      ui.renderQueue(list, { selectedId: selectedId, onSelect: select, emptyText: 'Waiting for alerts…' });
      ctx.progress(Object.keys(resolved).length + ' of ' + items.length);
      ctx.map.setMarked(openItems().map(function (i) { return i.focus; }));
    }

    function arrive(it) {
      if (arrived[it.id] || ended) return;
      arrived[it.id] = true;
      if (it.external) ctx.map.setExternal(it.external.slot, it.external.label);
      ctx.map.setNodeState(it.focus, 'alert');
      ctx.map.send(it.route, { tone: it.truth === 'malicious' ? 'critical' : 'amber', count: 3, gap: 200 });
      if (it.truth === 'malicious') ctx.game.applyEffects({ threat: ARRIVAL_THREAT });
      ctx.audio.play('alert');
      ctx.log('Alert: ' + it.title, 'warn');
      ui.announce('New alert: ' + it.title);
      refreshQueue();
      if (!selectedId) renderBoardOnly();
      else updateHud();
    }

    function select(id) {
      var it = item(id);
      if (!it || !arrived[id] || ended) return;
      selectedId = id;
      ctx.audio.play('select');
      ctx.map.select(it.focus);
      ctx.map.highlightRoute(it.route, resolved[id] ? 'muted' : 'amber');
      refreshQueue();
      render();
      ctx.armHint();
      focusFirst(ctx.workspace, '.case-name');
    }

    function inspect() {
      var it = item(selectedId);
      if (!it || inspected[it.id] || resolved[it.id] || ended) return;
      inspected[it.id] = true;
      ctx.audio.play('process');
      render();
      focusFirst(ctx.workspace, '.evidence-list li');
    }

    function decide(optionIndex) {
      var it = item(selectedId);
      if (!it || resolved[it.id] || busy || ended) return;
      var option = it.options[optionIndex];
      if (!option) return;
      busy = true;
      resolved[it.id] = { option: option };

      if (!firstDecision) {
        firstDecision = it.id;
        var pb = conf.priorityBonus[it.id] || 0;
        if (pb) ctx.game.award(pb, pb > 0 ? 'Priority: handled ' + it.title.toLowerCase() + ' first' : 'Priority: started with the least urgent alert', pb > 0 ? 'bonus' : 'loss');
      }
      ctx.game.award(option.points, it.title + ': ' + ui.gradeLabel(option.grade).toLowerCase());
      ctx.game.applyEffects(option.effects);
      var pick = it.options.filter(function (o) { return o.id === it.nexusPick; })[0];
      ctx.game.recordDecision({
        mission: 3, id: it.id, grade: option.grade,
        malicious: it.truth === 'malicious', contained: !!option.contained,
        ai: pick ? { recommendedBest: pick.grade === 'best', followed: option.id === pick.id, chosenWrong: option.grade === 'wrong' } : null
      });

      ctx.map.setNodeState(it.focus, option.node);
      if (it.external && option.band === 'contain' && option.node !== 'isolated') ctx.map.setNodeState(it.external.slot, 'isolated');
      ctx.map.highlightRoute(it.route, 'muted');

      var tone = ui.gradeTone(option.grade);
      ctx.audio.play(tone === 'good' ? 'success' : tone === 'bad' ? 'error' : 'process');
      ctx.log(option.label + ' (' + ui.gradeLabel(option.grade).toLowerCase() + ')', tone);
      ui.announce(ui.gradeLabel(option.grade) + '. ' + ui.signed(option.points) + ' points.');
      if (pick && pick.grade !== 'best' && option.id !== pick.id && option.grade === 'best') {
        ctx.nexus.say('Good override. My pick for “' + it.title + '” was based on telemetry alone.', 'verdict');
      } else if (tone === 'bad') {
        ctx.nexus.say(it.truth === 'malicious' ? 'That threat is still active and still costing integrity.' : consequenceLine(option.effects), 'warn');
      }

      busy = false;
      ctx.disarmHint();
      refreshQueue();
      render();
      if (Object.keys(resolved).length === items.length) {
        ctx.clock.after(1400, function () { end('cleared'); });
      } else {
        focusFirst(ctx.workspace, '.btn-next');
      }
    }

    function next() {
      var open = openItems();
      if (open.length) select(open[0].id);
    }

    function hudNode() {
      var rate = drainRate();
      var rem = remaining();
      var threats = items.filter(isActiveThreat).length;
      return h('div', { class: 'hud' + (rem <= 15 ? ' is-urgent' : '') },
        h('div', { class: 'hud-clock' },
          h('span', { class: 'hud-label' }, 'Time left'),
          h('span', { class: 'hud-time mono', role: 'timer', 'aria-label': Math.ceil(rem) + ' seconds left' }, ui.formatTime(rem * 1000 + 999))),
        h('div', { class: 'hud-track', 'aria-hidden': 'true' }, h('span', { class: 'hud-fill', style: 'transform:scaleX(' + (rem / conf.duration) + ')' })),
        h('p', { class: 'hud-drain' + (rate > 0 ? ' is-draining' : '') },
          rate > 0
            ? threats + ' active threat' + (threats > 1 ? 's' : '') + ': integrity falling ' + rate.toFixed(1) + ' per second'
            : (arrivedItems().length ? 'No active threats are draining integrity' : 'Watching for alerts…')));
    }

    function updateHud() {
      var old = ctx.workspace.querySelector('.hud');
      if (old) old.replaceWith(hudNode());
    }

    function renderBoardOnly() {
      var ws = ctx.workspace;
      ui.clear(ws);
      ws.appendChild(hudNode());
      ws.appendChild(emptyState(arrivedItems().length ? 'Choose what to handle first' : 'Stand by',
        arrivedItems().length
          ? 'Alerts are arriving in the queue. Active threats cost integrity every second, so pick the most urgent one.'
          : 'A coordinated attack is starting. Alerts will appear in the queue.'));
    }

    function render() {
      if (ended) return;
      var ws = ctx.workspace;
      var it = item(selectedId);
      if (!it) { renderBoardOnly(); return; }
      ui.clear(ws);
      ws.appendChild(hudNode());
      var r = resolved[it.id];
      var pick = it.options.filter(function (o) { return o.id === it.nexusPick; })[0];

      var call = h('section', { class: 'nexus-call is-compact' },
        h('div', { class: 'nc-head' },
          h('span', { class: 'nc-label' }, 'NEXUS pick'),
          h('strong', { class: 'nc-action' }, pick ? pick.label : 'No recommendation'),
          h('span', { class: 'nc-conf conf-' + it.analysis.confidence }, 'Confidence: ' + confidenceText(it.analysis.confidence))),
        findingsList(it.analysis, 3));

      var options = h('div', { class: 'case-actions case-actions--options', role: 'group', 'aria-label': 'Containment options' },
        it.options.map(function (o, i) {
          var chosen = r && r.option.id === o.id;
          return h('button', {
            type: 'button', class: 'action-btn action-option' + (chosen ? ' is-chosen' : ''),
            disabled: r ? true : null,
            on: { click: function () { decide(i); } }
          },
            h('span', { class: 'action-label' }, o.label, ui.kbd(String(i + 1))),
            o.id === it.nexusPick ? h('span', { class: 'action-tag' }, 'NEXUS pick') : null);
        }));

      var after = null;
      if (r) {
        var more = openItems().length;
        after = h('div', { class: 'case-after' },
          ui.outcomeBlock(r.option.grade, r.option.points, r.option.text, r.option.effects),
          more ? h('button', { type: 'button', class: 'btn btn-primary btn-next', on: { click: next } }, 'Next open alert', ui.kbd('N')) : null);
      }

      ws.appendChild(caseLayout('case--defense' + (r ? ' is-resolved' : ''),
        [caseHeader(it),
          h('div', { class: 'case-grid' }, caseMeta(it), telemetryBlock(it)),
          call,
          contextBlock(it, inspected[it.id] || !!r, inspect)],
        [ui.riskGauge(it.analysis, { label: 'NEXUS risk score', compact: true }),
          r ? null : h('p', { class: 'case-prompt' }, 'Choose a response'),
          options,
          after]));
    }

    function tick() {
      if (ended) return;
      var t = CQ.game.now();
      var dt = (t - lastTick) / 1000;
      lastTick = t;
      var el = elapsed();
      items.forEach(function (it) { if (!arrived[it.id] && el >= it.arrival) arrive(it); });
      var rate = drainRate();
      if (rate > 0) ctx.game.drainIntegrity(rate * dt);
      if (ended) return;
      var whole = Math.floor(remaining());
      if (whole !== lastWholeSecond) {
        lastWholeSecond = whole;
        updateHud();
        if (whole <= 10 && whole > 0) ctx.audio.play('tick');
      }
      if (remaining() <= 0) end('timeout');
    }

    function end(reason) {
      if (ended) return;
      ended = true;
      ctx.clock.cancel(loopId);
      ctx.disarmHint();
      var g = ctx.game;
      var rem = remaining();

      // Anything never decided carries a consequence.
      items.forEach(function (it) {
        if (resolved[it.id]) return;
        if (it.truth === 'malicious') {
          g.award(MISSED_PENALTY, 'Unhandled threat: ' + it.title.toLowerCase());
          g.recordMissedThreat(it.id);
          ctx.map.setNodeState(it.focus, 'compromised');
        } else if (it.unresolvedEffects) {
          g.award(-30, 'Left on hold: ' + it.title.toLowerCase());
          g.applyEffects(it.unresolvedEffects);
          ctx.log(it.unresolvedText, 'bad');
        }
      });

      var allResolved = Object.keys(resolved).length === items.length;
      if (reason !== 'breach' && allResolved && rem > 0) {
        g.award(Math.round(rem * TIME_BONUS_PER_SECOND), 'Time remaining: ' + Math.round(rem) + ' s', 'bonus');
      }
      if (!g.state.breached) {
        g.award(Math.round(g.state.integrity * INTEGRITY_BONUS_FACTOR), 'Systems protected: integrity ' + Math.round(g.state.integrity) + '%', 'bonus');
      }
      // Remaining threat level reflects what is still active.
      var active = items.filter(isActiveThreat).length;
      g.setThreat(active ? 55 + active * 15 : Math.min(g.state.threat, 15));

      ctx.map.setMarked([]);
      ctx.map.highlightRoute(null);
      if (reason === 'breach') {
        ctx.audio.play('failure');
        ctx.nexus.say('Integrity has reached zero. The attacker now controls critical systems. In a real incident, recovery would start from backups.', 'warn');
        ctx.log('Network breached', 'bad');
      } else if (reason === 'timeout') {
        ctx.audio.play(active ? 'failure' : 'complete');
        ctx.nexus.say(active ? 'Time is up with threats still active.' : 'Time is up. The attack has been contained.', active ? 'warn' : 'verdict');
      } else {
        ctx.nexus.say('Every alert has been handled. Threat level is falling.', 'verdict');
      }
      ctx.complete({ reason: reason, remaining: rem });
    }

    return {
      start: function () {
        ctx.map.reset();
        offSelect = ctx.map.onSelect(function (nodeId) {
          var match = openItems().filter(function (i) { return i.focus === nodeId || i.source.node === nodeId || i.destination.node === nodeId; })[0];
          if (match) select(match.id);
          else ctx.nexus.say(nodeName(nodeId) + ' has no open alert.', 'info');
        });
        offBreach = ctx.game.on('breach', function () { end('breach'); });
        ctx.nexus.say('Multiple alerts incoming. My risk scores will help you sort them, but I have been wrong today. Prioritise by what spreads and what leaks.', 'warn');
        startedAt = CQ.game.now();
        lastTick = startedAt;
        renderBoardOnly();
        refreshQueue();
        tick();
        loopId = ctx.clock.every(200, tick);
      },
      destroy: function () {
        ended = true;
        ctx.clock.cancel(loopId);
        if (offSelect) offSelect();
        if (offBreach) offBreach();
      },
      onKey: function (key) {
        if (key === 'e') inspect();
        else if (key === 'n') next();
        else if (key === '1' || key === '2' || key === '3') decide(Number(key) - 1);
      },
      hint: function () {
        var open = openItems();
        if (!selectedId && open.length) return 'Open the alert that is doing the most damage right now. Spreading malware beats everything else.';
        var it = item(selectedId);
        if (it && !resolved[it.id]) {
          if (!inspected[it.id]) return 'Under pressure, a quick look at the context records still pays off. Two of my picks here are wrong.';
          return 'Choose the option that stops the threat without taking down more of the business than necessary. If it is legitimate, let it through.';
        }
        return open.length ? 'Next open alert: press N.' : 'Wait for the next alert to arrive.';
      },
      // test hooks
      _debug: { items: items, resolved: resolved }
    };
  }

  CQ.missions = {
    factories: [mission1, mission2, mission3, mission4],
    INSPECT_BONUS: INSPECT_BONUS,
    LABEL_POINTS: LABEL_POINTS,
    TEST_POINTS: TEST_POINTS
  };
})(window.CQ = window.CQ || {});
