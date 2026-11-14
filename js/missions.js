/*
 * CyberQuest — missions
 *
 * Every mission keeps its progress in plain state and draws the screen
 * from that state in render(). Switching language simply calls render()
 * again, so nothing is lost mid-mission.
 *
 * Each factory returns { start, render, destroy, onKey, hint } and calls
 * ctx.complete(result) when the mission is finished. hint() returns a
 * translation key.
 *
 * ctx = { game, audio, clock, stage, nexus, progress(fraction), complete(result), armHint, disarmHint }
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var S = CQ.scenarios;
  function T(k, v) { return CQ.i18n.t(k, v); }
  function L(x, v) { return CQ.i18n.pick(x, v); }

  /* ------------------------------------------------------------------ */
  /* Shared building blocks                                               */
  /* ------------------------------------------------------------------ */
  function layout(ctx, visual, panel) {
    ui.clear(ctx.stage);
    var v = h('div', { class: 'stage-visual' }, visual);
    var p = h('div', { class: 'stage-panel' }, panel);
    ctx.stage.appendChild(h('div', { class: 'stage-split' }, v, p));
    return { visual: v, panel: p };
  }

  function stepLabel(text) { return h('p', { class: 'step-label' }, text); }
  function title(text) { return h('h2', { class: 'challenge-title', tabindex: '-1' }, text); }
  function story(text) { return h('p', { class: 'challenge-text' }, text); }
  function question(text) { return h('p', { class: 'question' }, text); }

  function choice(label, opts) {
    var o = opts || {};
    return h('button', {
      type: 'button',
      class: 'choice' + (o.tone ? ' choice--' + o.tone : ''),
      data: o.key ? { key: o.key } : null,
      on: { click: o.onClick }
    },
      o.key ? h('span', { class: 'choice-key', 'aria-hidden': 'true' }, o.key) : null,
      o.icon ? h('span', { class: 'choice-icon' }, ui.svgIcon(o.icon)) : null,
      h('span', { class: 'choice-text' },
        h('span', { class: 'choice-label' }, label),
        o.sub ? h('span', { class: 'choice-sub' }, o.sub) : null),
      o.tag ? h('span', { class: 'choice-tag' }, o.tag) : null);
  }

  function continueButton(label, onClick) {
    return h('button', { type: 'button', class: 'btn btn-primary btn-continue', on: { click: onClick } }, label);
  }

  /**
   * The evidence box under the picture: lists the clues found so far and
   * offers a button for players who prefer not to click the picture.
   */
  function clueBox(items, found, opts) {
    var n = found.filter(Boolean).length;
    var total = items.length;
    var list = h('ul', { class: 'clue-list' });
    items.forEach(function (c, i) {
      if (found[i]) list.appendChild(h('li', { class: 'clue-item' }, L(c.text)));
    });
    return h('div', { class: 'cluebox' + (n === total ? ' is-complete' : ''), tabindex: '-1' },
      h('p', { class: 'cluebox-title' },
        h('span', { class: 'cluebox-icon' }, ui.svgIcon(ui.ICON.clue)),
        T(opts.titleKey || 'clues.title', { n: n, total: total })),
      n ? list : null,
      n < total && !opts.locked ? h('div', { class: 'cluebox-more' },
        h('p', { class: 'cluebox-hint' }, T(opts.hintKey || 'clues.hintDevices')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-clue', on: { click: opts.onMore } }, T('clues.more'))) : null);
  }

  function emailCard(v, clues, found, onFind, verdict) {
    function spot(where, content, cls) {
      var idx = clues.findIndex(function (c) { return c.at === where; });
      if (idx < 0) return h('span', { class: cls }, content);
      var pending = !found[idx] && !verdict;
      return h(pending ? 'button' : 'span', {
        type: pending ? 'button' : null,
        class: cls + ' hotspot ' + (found[idx] ? 'is-found' : pending ? 'is-pending' : ''),
        'aria-label': pending ? T('clues.more') + ': ' + content.textContent : null,
        on: pending ? { click: function () { onFind(idx); } } : null
      }, content, h('span', { class: 'hotspot-mark', 'aria-hidden': 'true' }, found[idx] ? '✓' : '?'));
    }
    var address = h('bdi', { class: 'email-address', dir: 'ltr' }, v.address);
    var sender = h('span', { class: 'email-sender' }, L(v.sender) + ' ', '<', address, '>');
    return h('div', { class: 'email' + (verdict ? ' is-' + verdict : '') },
      h('div', { class: 'email-bar' },
        h('span', { class: 'email-dot' }), h('span', { class: 'email-dot' }), h('span', { class: 'email-dot' })),
      h('div', { class: 'email-body' },
        h('p', { class: 'email-from' }, spot('sender', sender, 'email-from-text')),
        h('p', { class: 'email-subject' }, L(v.subject)),
        h('p', { class: 'email-text' }, L(v.body)),
        h('p', { class: 'email-action' }, spot('button', h('span', { class: 'email-button-text' }, L(v.button)), 'email-button'))),
      verdict ? h('span', { class: 'email-stamp' }, T(verdict === 'blocked' ? 'email.blocked' : 'email.delivered')) : null);
  }

  function confidenceWords(c) { return T('m3.sure.' + (c || 'low')); }

  /* ------------------------------------------------------------------ */
  /* Mission 1: Spot the Threat                                           */
  /* ------------------------------------------------------------------ */
  function mission1(ctx) {
    var items = S.mission1;
    var st = { index: 0, found: [], answer: null };
    var scene = null;
    var correctCount = 0;

    function item() { return items[st.index]; }
    function chosen() { var it = item(); return it.choices.filter(function (c) { return c.id === st.answer; })[0] || null; }

    function sceneModel() {
      var it = item(), v = it.visual, ch = chosen();
      var devices = {};
      devices[v.focus] = { state: ch ? (ch.node || 'normal') : 'alert', tag: ch ? null : L(v.tag) };
      it.clues.forEach(function (c, i) {
        if (!CQ.network.positions[c.at]) return;
        var d = devices[c.at] || (devices[c.at] = {});
        d.clue = st.found[i] ? 'found' : 'pending';
        d.clickable = !st.found[i] && !ch;
      });
      return { devices: devices, flow: ch ? null : { from: v.from, to: v.to, tone: 'warn' } };
    }

    function render() {
      var it = item(), ch = chosen();
      if (scene) { scene.destroy(); scene = null; }
      var isEmail = it.visual.type === 'email';
      var verdict = ch ? (ch.grade === 'best' ? 'blocked' : 'delivered') : null;
      var visual = isEmail ? emailCard(it.visual, it.clues, st.found, findClue, verdict) : h('div', { class: 'scene-host' });
      var box = clueBox(it.clues, st.found, { hintKey: isEmail ? 'clues.hintEmail' : 'clues.hintDevices', onMore: nextClue, locked: !!ch });
      var panel = [stepLabel(T('q.situation', { n: st.index + 1, total: items.length })), title(L(it.title))];
      if (!ch) {
        panel.push(story(L(it.situation)), question(L(it.question)),
          h('div', { class: 'choices choices--stack' }, it.choices.map(function (c, i) {
            return choice(L(c.label), { key: String(i + 1), onClick: function () { decide(c.id); } });
          })));
      } else {
        var tone = ui.toneForGrade(ch.grade);
        panel.push(ui.feedback(tone, L(ch.feedback), ch.points),
          continueButton(T(st.index === items.length - 1 ? 'btn.finish' : 'btn.nextSituation'), next));
      }
      layout(ctx, [visual, box], panel);
      if (!isEmail) {
        var host = ctx.stage.querySelector('.scene-host');
        scene = CQ.network.create(host);
        scene.onClick(function (id) {
          var idx = it.clues.findIndex(function (c, i) { return c.at === id && !st.found[i]; });
          if (idx >= 0) findClue(idx);
        });
        scene.update(sceneModel());
      }
    }

    function findClue(i) {
      if (st.answer || st.found[i]) return;
      st.found[i] = true;
      ctx.audio.play('clue');
      var all = item().clues.every(function (c, k) { return st.found[k]; });
      ctx.nexus.say(all ? 'nx.allClues' : 'nx.clue', null, 'happy');
      render();
      ui.focus(ctx.stage, '.cluebox');
      ctx.armHint();
    }

    function nextClue() {
      var idx = item().clues.findIndex(function (c, i) { return !st.found[i]; });
      if (idx >= 0) findClue(idx);
    }

    function show(i) {
      st = { index: i, found: [], answer: null };
      render();
      ctx.nexus.say(item().nexus);
      ctx.audio.play('alert');
      ctx.progress(i / items.length);
      ctx.armHint();
      ui.focus(ctx.stage, '.challenge-title');
    }

    function decide(choiceId) {
      if (st.answer) return;
      var it = item();
      var c = it.choices.filter(function (x) { return x.id === choiceId; })[0];
      if (!c) return;
      st.answer = choiceId;
      st.found = it.clues.map(function () { return true; }); // reveal everything after deciding
      if (c.grade === 'best') correctCount++;
      ctx.game.award(c.points, { k: 'ledger.m1', v: { title: it.title, grade: { t: 'grade.' + c.grade } } });
      ctx.game.applyEffects(c.effects);
      ctx.game.recordDecision({ mission: 0, id: it.id, grade: c.grade, malicious: it.truth === 'malicious', contained: !!c.contained });
      var tone = ui.toneForGrade(c.grade);
      ctx.audio.play(tone === 'good' ? (c.contained ? 'stop' : 'success') : tone === 'bad' ? 'error' : 'process');
      ctx.nexus.say((tone === 'good' ? 'nx.praise.' : 'nx.comfort.') + (st.index % 3), null, tone === 'good' ? 'happy' : 'calm');
      render();
      if (scene && c.contained) scene.burst(it.visual.focus);
      ui.announce(L(c.feedback));
      ctx.progress((st.index + 1) / items.length);
      ctx.disarmHint();
      ui.focus(ctx.stage, '.btn-continue');
    }

    function next() {
      if (!st.answer) return;
      if (st.index < items.length - 1) show(st.index + 1);
      else ctx.complete({ correct: correctCount, total: items.length });
    }

    return {
      start: function () { show(0); },
      render: render,
      destroy: function () { if (scene) scene.destroy(); },
      onKey: function (key) {
        if (st.answer) return;
        var n = Number(key);
        if (n >= 1 && n <= item().choices.length) decide(item().choices[n - 1].id);
        else if (key === 'c') nextClue();
      },
      hint: function () {
        if (st.answer) return 'hint.continue';
        return st.found.filter(Boolean).length ? 'hint.m1.clues' : 'hint.m1.noClues';
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Mission 2: Teach the AI                                              */
  /* ------------------------------------------------------------------ */
  var K = 3;
  var LABEL_POINTS = 15;
  var TEST_POINTS = 25;

  function mission2(ctx) {
    var examples = S.training;
    var st = {
      phase: 'label',     // label | ready | training | testing | done
      labels: {},
      order: [],          // labelled ids, for undo
      lastBin: null,      // bin that just received a card (for a small bump)
      learned: 0,         // training animation progress (0..8)
      shown: 0,           // testing animation progress (0..6)
      result: null,
      labelCorrect: 0
    };
    var drag = null;

    function current() { return examples[st.order.length]; }
    function count(label) { return st.order.filter(function (id) { return st.labels[id] === label; }).length; }
    function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

    function card(ex, extra) {
      return h('div', { class: 'example' + (extra || '') },
        h('span', { class: 'example-icon' }, ui.svgIcon(ex.icon === 'upload' ? ui.ICON.upload : ui.ICON.login)),
        h('p', { class: 'example-kind' }, T(ex.icon === 'upload' ? 'm2.kindUpload' : 'm2.kindLogin')),
        h('h3', { class: 'example-title' }, L(ex.title)),
        h('ul', { class: 'example-clues' }, ex.clues.map(function (c) { return h('li', null, L(c)); })));
    }

    function bins(contents) {
      return h('div', { class: 'bins' }, ['benign', 'malicious'].map(function (label) {
        return h('div', {
          class: 'bin bin--' + label + (st.lastBin === label ? ' is-bumped' : ''),
          data: { bin: label }
        },
          h('p', { class: 'bin-title' }, h('span', { class: 'bin-icon' }, ui.svgIcon(label === 'benign' ? ui.ICON.check : ui.ICON.shield)),
            T(label === 'benign' ? 'm2.safe' : 'm2.suspicious')),
          contents ? contents(label) : h('p', { class: 'bin-count' }, T('m2.binCount', { n: count(label) })));
      }));
    }

    function dots() {
      return h('ol', { class: 'label-dots', 'aria-hidden': 'true' }, examples.map(function (ex, i) {
        var l = st.labels[ex.id];
        return h('li', { class: 'label-dot' + (l ? ' is-' + l : '') + (i === st.order.length && st.phase === 'label' ? ' is-current' : '') });
      }));
    }

    function render() {
      if (st.phase === 'label') return renderLabel();
      if (st.phase === 'ready') return renderReady();
      if (st.phase === 'training') return renderTraining();
      if (st.phase === 'testing') return renderTesting();
      return renderDone();
    }

    function renderLabel() {
      var ex = current();
      var i = st.order.length;
      var dragCard = card(ex, ' is-draggable');
      dragCard.setAttribute('aria-label', T('m2.cardAria', { title: L(ex.title) }));
      dragCard.setAttribute('role', 'group');
      layout(ctx, [h('div', { class: 'deck' }, dragCard), bins()], [
        stepLabel(T('q.example', { n: i + 1, total: examples.length })),
        title(T('m2.question')),
        story(T('m2.instructions')),
        h('div', { class: 'choices choices--two' },
          choice(T('m2.putSafe'), { key: '1', icon: ui.ICON.check, onClick: function () { label('benign'); } }),
          choice(T('m2.putSuspicious'), { key: '2', icon: ui.ICON.shield, tone: 'alert', onClick: function () { label('malicious'); } })),
        dots(),
        i > 0 ? h('button', { type: 'button', class: 'btn btn-link', on: { click: undo } }, T('m2.undo')) : null
      ]);
      enableDrag(dragCard);
      st.lastBin = null;
    }

    /* Drag and drop with pointer events (mouse, pen and touch). */
    function enableDrag(node) {
      node.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        var rect = node.getBoundingClientRect();
        drag = { node: node, startX: e.clientX, startY: e.clientY, moved: false, rect: rect, over: null };
        node.setPointerCapture(e.pointerId);
      });
      node.addEventListener('pointermove', function (e) {
        if (!drag || drag.node !== node) return;
        var dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        drag.moved = true;
        node.classList.add('is-dragging');
        node.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + Math.max(-6, Math.min(6, dx / 30)) + 'deg)';
        var over = binAt(e.clientX, e.clientY);
        if (over !== drag.over) {
          ctx.stage.querySelectorAll('.bin').forEach(function (b) { b.classList.toggle('is-over', b.dataset.bin === over); });
          drag.over = over;
        }
      });
      function end(e) {
        if (!drag || drag.node !== node) return;
        var over = drag.moved ? binAt(e.clientX, e.clientY) : null;
        var moved = drag.moved;
        drag = null;
        ctx.stage.querySelectorAll('.bin').forEach(function (b) { b.classList.remove('is-over'); });
        if (over) { label(over); return; }
        node.classList.remove('is-dragging');
        node.style.transform = '';
        if (moved) ctx.audio.play('select');
      }
      node.addEventListener('pointerup', end);
      node.addEventListener('pointercancel', end);
    }

    function binAt(x, y) {
      var hit = null;
      ctx.stage.querySelectorAll('.bin').forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = b.dataset.bin;
      });
      return hit;
    }

    function label(value) {
      if (st.phase !== 'label') return;
      var ex = current();
      if (!ex) return;
      st.labels[ex.id] = value;
      st.order.push(ex.id);
      ctx.audio.play('drop');
      if (st.order.length === 1) ctx.nexus.say('nx.m2.drop', null, 'happy');
      if (st.order.length === examples.length) {
        st.phase = 'ready';
        ctx.nexus.say('nx.m2.ready', null, 'happy');
      }
      render();
      st.lastBin = value;
      var bin = ctx.stage.querySelector('.bin--' + value);
      if (bin) { bin.classList.add('is-bumped'); }
      ctx.progress(st.order.length / (examples.length + 3));
      ctx.armHint();
      ui.focus(ctx.stage, st.phase === 'ready' ? '.btn-big' : '.choice');
    }

    function undo() {
      if (st.phase !== 'label' && st.phase !== 'ready') return;
      var id = st.order.pop();
      if (!id) return;
      delete st.labels[id];
      st.phase = 'label';
      ctx.audio.play('select');
      render();
      ui.focus(ctx.stage, '.choice');
    }

    function chipBins() {
      return bins(function (label) {
        return h('ul', { class: 'chips' }, st.order.filter(function (id) { return st.labels[id] === label; }).map(function (id) {
          var idx = examples.findIndex(function (e) { return e.id === id; });
          return h('li', { class: 'chip' + (st.phase === 'training' && st.learned > st.order.indexOf(id) ? ' is-learned' : '') }, L(examples[idx].title));
        }));
      });
    }

    function renderReady() {
      layout(ctx, [chipBins()], [
        stepLabel(T('m2.readyStep')),
        title(T('m2.readyTitle')),
        story(T('m2.readyText', { safe: count('benign'), sus: count('malicious') })),
        h('div', { class: 'choices' }, h('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: train } }, T('m2.train'))),
        h('button', { type: 'button', class: 'btn btn-link', on: { click: undo } }, T('m2.undo'))
      ]);
    }

    function brain() {
      var pct = Math.round((st.learned / examples.length) * 100);
      return h('div', { class: 'brain' + (st.phase === 'training' ? ' is-learning' : '') },
        h('div', { class: 'brain-ring', style: '--p:' + pct },
          h('div', { class: 'brain-core', 'aria-hidden': 'true' }, robotFace())),
        h('p', { class: 'brain-caption' }, T('m2.brainCaption')));
    }

    function renderTraining() {
      var b = brain();
      var pct = st.learned / examples.length;
      layout(ctx, [b, chipBins()], [
        stepLabel(T('m2.trainingStep')),
        title(T('m2.trainingTitle')),
        story(T('m2.trainingText')),
        h('div', { class: 'train-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct * 100)) },
          h('span', { class: 'train-fill', style: 'transform:scaleX(' + pct + ')' }))
      ]);
    }

    function testTile(row, fresh) {
      var q = byId(S.testSet, row.id);
      return h('li', { class: 'test-chip ' + (row.correct ? 'is-right' : 'is-wrong') + (fresh ? ' is-new' : '') },
        h('span', { class: 'test-mark', 'aria-hidden': 'true' }, ui.svgIcon(row.correct ? ui.ICON.check : ui.ICON.cross)),
        h('span', null, L(q.title)));
    }

    function renderTesting() {
      var rows = st.result.rows.slice(0, st.shown);
      var nextQ = st.shown < st.result.rows.length ? byId(S.testSet, st.result.rows[st.shown].id) : null;
      layout(ctx, [
        h('div', { class: 'deck deck--test' }, nextQ ? h('div', { class: 'test-card' }, L(nextQ.title)) : null),
        bins(function (label) {
          return h('ul', { class: 'chips' }, rows.filter(function (r) { return r.prediction.label === label; }).map(function (r) {
            return testTile(r, r === rows[rows.length - 1]);
          }));
        })
      ], [
        stepLabel(T('m2.trainingStep')),
        title(T('m2.testingTitle')),
        story(T('m2.testingText'))
      ]);
    }

    function train() {
      if (st.phase !== 'ready') return;
      st.phase = 'training';
      st.learned = 0;
      ctx.disarmHint();
      var model = CQ.ai.trainKNN(examples.map(function (t) { return { id: t.id, x: t.x, label: st.labels[t.id] }; }), K);
      st.result = model.evaluate(S.testSet.map(function (q) { return { id: q.id, x: q.x, truth: q.truth }; }));
      st.labelCorrect = examples.filter(function (t) { return st.labels[t.id] === t.truth; }).length;
      ctx.nexus.say('nx.m2.learning', null, 'busy');
      ctx.audio.play('process');
      var fast = ui.reducedMotion();
      render();
      var id = ctx.clock.every(fast ? 1 : 190, function () {
        st.learned++;
        if (st.learned % 2 === 0) ctx.audio.play('tick');
        render();
        if (st.learned >= examples.length) {
          ctx.clock.cancel(id);
          ctx.clock.after(fast ? 1 : 350, startTesting);
        }
      });
    }

    function startTesting() {
      st.phase = 'testing';
      st.shown = 0;
      ctx.nexus.say('nx.m2.testing', null, 'busy');
      render();
      var fast = ui.reducedMotion();
      var id = ctx.clock.every(fast ? 1 : 650, function () {
        st.shown++;
        var row = st.result.rows[st.shown - 1];
        ctx.audio.play(row && row.correct ? 'drop' : 'error');
        render();
        if (st.shown >= st.result.rows.length) {
          ctx.clock.cancel(id);
          ctx.clock.after(fast ? 1 : 700, finish);
        }
      });
      ctx.progress((examples.length + 1) / (examples.length + 3));
    }

    function finish() {
      st.phase = 'done';
      var r = st.result;
      ctx.game.award(st.labelCorrect * LABEL_POINTS, { k: 'ledger.labels', v: { n: st.labelCorrect } });
      ctx.game.award(r.correct * TEST_POINTS, { k: 'ledger.aiTest', v: { n: r.correct, total: r.total } });
      examples.forEach(function (t) {
        ctx.game.recordDecision({ mission: 1, id: 'label-' + t.id, grade: st.labels[t.id] === t.truth ? 'best' : 'wrong', malicious: false });
      });
      ctx.game.recordModel({ correct: r.correct, total: r.total, accuracy: r.accuracy, labelCorrect: st.labelCorrect, labelTotal: 8,
        falsePositives: r.falsePositives, falseNegatives: r.falseNegatives });
      ctx.audio.play(r.correct >= 5 ? 'success' : 'process');
      ctx.nexus.say(r.correct >= 5 ? 'nx.m2.doneGood' : 'nx.m2.doneMixed', null, 'happy');
      ctx.progress(1);
      render();
      ui.announce(T('m2.outOf', { n: r.correct, total: r.total }) + ' ' + T('m2.outOfText'));
      ui.focus(ctx.stage, '.challenge-title');
    }

    function explainMiss(row) {
      var q = byId(S.testSet, row.id);
      var wrong = row.prediction.neighbors.map(function (n) { return byId(examples, n.id); })
        .filter(function (e) { return st.labels[e.id] !== e.truth; })[0];
      if (wrong) {
        return T('m2.missBecause', { test: L(q.title), train: L(wrong.title), bin: T(st.labels[wrong.id] === 'benign' ? 'm2.safe' : 'm2.suspicious') });
      }
      return T('m2.missGuess', { test: L(q.title) });
    }

    function renderDone() {
      var r = st.result;
      var misses = r.rows.filter(function (x) { return !x.correct; });
      var explanation = r.correct === r.total ? T('m2.perfect')
        : misses.length === 1 ? explainMiss(misses[0]) : T('m2.wrongLessons') + ' ' + explainMiss(misses[0]);
      var tiles = r.rows.map(function (row) {
        var q = byId(S.testSet, row.id);
        return h('li', { class: 'test-tile ' + (row.correct ? 'is-right' : 'is-wrong') },
          h('span', { class: 'test-mark' }, ui.svgIcon(row.correct ? ui.ICON.check : ui.ICON.cross)),
          h('span', { class: 'test-title' }, L(q.title)),
          h('span', { class: 'test-said' }, T('m2.aiSaid') + ' ', h('strong', null, T(row.prediction.label === 'malicious' ? 'm2.suspicious' : 'm2.safe'))),
          h('span', { class: 'test-sure' }, T(row.prediction.unanimous ? 'm2.verySure' : 'm2.notSure')));
      });
      layout(ctx, h('div', { class: 'test-board' },
        h('p', { class: 'test-board-title' }, T('m2.boardTitle')),
        h('ul', { class: 'test-grid' }, tiles)), [
        stepLabel(T('m2.resultsStep')),
        title(T('m2.resultsTitle')),
        h('p', { class: 'big-stat' }, h('span', { class: 'big-stat-num' }, T('m2.outOf', { n: r.correct, total: r.total })),
          h('span', { class: 'big-stat-text' }, T('m2.outOfText'))),
        story(explanation),
        h('p', { class: 'small-note' }, T('m2.labeled', { n: st.labelCorrect })),
        ui.feedback(r.correct >= 5 ? 'good' : 'okay', T('m2.showsText'), st.labelCorrect * LABEL_POINTS + r.correct * TEST_POINTS, T('m2.shows')),
        continueButton(T('btn.finish'), function () { ctx.complete({ correct: r.correct, total: r.total }); })
      ]);
    }

    return {
      start: function () { render(); ctx.armHint(); ui.focus(ctx.stage, '.choice'); },
      render: render,
      destroy: function () { drag = null; },
      onKey: function (key) {
        if (st.phase === 'label') { if (key === '1') label('benign'); else if (key === '2') label('malicious'); }
      },
      hint: function () {
        if (st.phase === 'label') return 'hint.m2.label';
        if (st.phase === 'ready') return 'hint.m2.ready';
        return 'hint.continue';
      }
    };
  }

  function robotFace() {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 48 48');
    s.setAttribute('aria-hidden', 'true');
    [['rect', { x: 8, y: 12, width: 32, height: 26, rx: 10 }], ['circle', { cx: 18.5, cy: 25, r: 3 }],
      ['circle', { cx: 29.5, cy: 25, r: 3 }], ['path', { d: 'M24 12V6M20 6h8' }]].forEach(function (d) {
      var n = document.createElementNS(ns, d[0]);
      Object.keys(d[1]).forEach(function (k) { n.setAttribute(k, d[1][k]); });
      s.appendChild(n);
    });
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Mission 3: Can You Trust the AI?                                     */
  /* ------------------------------------------------------------------ */
  function mission3(ctx) {
    var items = S.mission3.map(function (it) { return Object.assign({}, it, { analysis: CQ.ai.analyze(it.telemetry) }); });
    var st = { index: 0, found: [], follow: null };
    var scene = null;

    function current() { return items[st.index]; }
    function aiBand(it) { return it.analysis.band === 'contain' ? 'contain' : 'allow'; }
    function otherBand(b) { return b === 'contain' ? 'allow' : 'contain'; }
    function answered() { return st.follow !== null; }

    function sceneModel() {
      var it = current(), v = it.visual;
      var devices = {};
      var outcome = answered() ? it.outcomes[st.follow ? aiBand(it) : otherBand(aiBand(it))] : null;
      devices[v.focus] = { state: outcome ? outcome.node : 'alert', tag: outcome ? null : L(v.tag) };
      it.clues.forEach(function (c, i) {
        var d = devices[c.at] || (devices[c.at] = {});
        d.clue = st.found[i] ? 'found' : 'pending';
        d.clickable = !st.found[i] && !answered();
      });
      return { devices: devices, flow: outcome ? null : { from: v.from, to: v.to, tone: 'warn' } };
    }

    function render() {
      var it = current();
      if (scene) { scene.destroy(); scene = null; }
      var band = aiBand(it);
      var aiSays = h('div', { class: 'ai-says' },
        h('div', { class: 'ai-says-head' },
          h('span', { class: 'ai-says-label' }, T('m3.suggests')),
          h('span', { class: 'ai-says-sure' }, T('m3.howSure', { x: confidenceWords(it.analysis.confidence) }))),
        h('p', { class: 'ai-says-action' }, L(it.actions[band])));
      var box = clueBox(it.clues, st.found, { titleKey: 'clues.aiCantSee', onMore: nextClue, locked: answered() });
      var panel = [stepLabel(T('q.case', { n: st.index + 1, total: items.length })), title(L(it.title))];
      if (!answered()) {
        panel.push(story(L(it.situation)), aiSays, question(T('m3.question')),
          h('div', { class: 'choices choices--two' },
            choice(T('m3.yes'), { key: '1', sub: L(it.actions[band]), onClick: function () { decide(true); } }),
            choice(T('m3.no'), { key: '2', sub: L(it.actions[otherBand(band)]), onClick: function () { decide(false); } })));
      } else {
        var chosenBand = st.follow ? band : otherBand(band);
        var outcome = it.outcomes[chosenBand];
        var correct = chosenBand === it.correctBand, aiRight = band === it.correctBand;
        var heading = correct ? (aiRight ? T('fb.good') : T('m3.caught')) : (aiRight ? T('m3.aiRightWrongChoice') : T('m3.bothWrong'));
        panel.push(aiSays, ui.feedback(correct ? 'good' : 'bad', L(outcome.text), outcome.points, heading),
          continueButton(T(st.index === items.length - 1 ? 'btn.finish' : 'btn.nextCase'), next));
      }
      layout(ctx, [h('div', { class: 'scene-host' }), box], panel);
      scene = CQ.network.create(ctx.stage.querySelector('.scene-host'));
      scene.onClick(function (id) {
        var idx = it.clues.findIndex(function (c, i) { return c.at === id && !st.found[i]; });
        if (idx >= 0) findClue(idx);
      });
      scene.update(sceneModel());
    }

    function findClue(i) {
      if (answered() || st.found[i]) return;
      st.found[i] = true;
      ctx.audio.play('clue');
      ctx.nexus.say(current().clues.every(function (c, k) { return st.found[k]; }) ? 'nx.allClues' : 'nx.clue', null, 'happy');
      render();
      ui.focus(ctx.stage, '.cluebox');
      ctx.armHint();
    }

    function nextClue() {
      var idx = current().clues.findIndex(function (c, i) { return !st.found[i]; });
      if (idx >= 0) findClue(idx);
    }

    function show(i) {
      st = { index: i, found: [], follow: null };
      render();
      ctx.nexus.say(i === 0 ? 'nx.m3.first' : 'nx.m3.next');
      ctx.audio.play('alert');
      ctx.progress(i / items.length);
      ctx.armHint();
      ui.focus(ctx.stage, '.challenge-title');
    }

    function decide(follow) {
      var it = current();
      if (answered()) return;
      st.follow = follow;
      st.found = it.clues.map(function () { return true; });
      var recommended = aiBand(it);
      var chosenBand = follow ? recommended : otherBand(recommended);
      var outcome = it.outcomes[chosenBand];
      var correct = chosenBand === it.correctBand;
      var aiRight = recommended === it.correctBand;
      var reason = correct ? (aiRight ? 'ledger.m3.trusted' : 'ledger.m3.caught') : (aiRight ? 'ledger.m3.ignored' : 'ledger.m3.followedWrong');
      ctx.game.award(outcome.points, { k: reason, v: { title: it.title } });
      ctx.game.applyEffects(outcome.effects);
      ctx.game.recordDecision({
        mission: 2, id: it.id, grade: correct ? 'best' : 'wrong',
        malicious: it.truth === 'malicious', contained: it.truth === 'malicious' && chosenBand === 'contain',
        ai: { recommendedBest: aiRight, followed: follow, chosenWrong: !correct }
      });
      ctx.audio.play(correct ? (outcome.contained ? 'stop' : 'success') : 'error');
      ctx.nexus.say(correct ? (aiRight ? 'nx.m3.team' : 'nx.m3.caught') : (aiRight ? 'nx.m3.ignored' : 'nx.m3.missed'), null, correct ? 'happy' : 'calm');
      render();
      if (scene && correct && outcome.contained) scene.burst(it.visual.focus);
      ui.announce(L(outcome.text));
      ctx.progress((st.index + 1) / items.length);
      ctx.disarmHint();
      ui.focus(ctx.stage, '.btn-continue');
    }

    function next() {
      if (!answered()) return;
      if (st.index < items.length - 1) show(st.index + 1);
      else ctx.complete({});
    }

    return {
      start: function () { show(0); },
      render: render,
      destroy: function () { if (scene) scene.destroy(); },
      onKey: function (key) {
        if (answered()) return;
        if (key === '1') decide(true);
        else if (key === '2') decide(false);
        else if (key === 'c') nextClue();
      },
      hint: function () { return answered() ? 'hint.continue' : 'hint.m3'; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Mission 4: Save the Network                                          */
  /* ------------------------------------------------------------------ */
  var TIME_BONUS_PER_SECOND = 2;
  var HEALTH_BONUS_FACTOR = 2;
  var MISSED_PENALTY = -60;

  function mission4(ctx) {
    var conf = S.mission4;
    var items = conf.incidents.map(function (it, i) {
      var analysis = CQ.ai.analyze(it.telemetry);
      var pick = it.options.filter(function (o) { return o.band === analysis.band; })[0] || null;
      return Object.assign({}, it, { order: i, analysis: analysis, nexusPick: pick ? pick.id : null });
    });
    var st = {
      timeLeft: conf.duration,
      queue: items.map(function (i) { return i.id; }),
      open: [],              // problem ids currently on the network
      resolved: {},          // id -> { option, contained }
      phase: 'board',        // board | problem | feedback
      selected: null,
      lastResult: null       // { id, option }
    };
    var ended = false;
    var loopId = null;
    var lastTick = 0;
    var lastShown = '';
    var scene = null;
    var offBreach = null;

    function item(id) { return items.filter(function (x) { return x.id === id; })[0]; }
    function running() { return !ended && st.phase !== 'feedback'; }

    function fillOpen(announce) {
      var added = false;
      while (st.open.length < conf.maxOpen && st.queue.length) {
        var busy = st.open.map(function (id) { return item(id).at; });
        var nextIdx = st.queue.findIndex(function (id) { return busy.indexOf(item(id).at) < 0; });
        if (nextIdx < 0) break;
        st.open.push(st.queue.splice(nextIdx, 1)[0]);
        added = true;
      }
      if (added && announce) { ctx.audio.play('alert'); ctx.nexus.say('nx.m4.newProblem', null, 'alert'); }
    }

    function activeThreats() {
      return items.filter(function (it) {
        if (it.truth !== 'malicious') return false;
        if (st.open.indexOf(it.id) >= 0) return true;
        var r = st.resolved[it.id];
        return r && !r.contained;
      });
    }

    function sceneModel() {
      var devices = {};
      // Settled devices first, then open problems on top.
      Object.keys(st.resolved).forEach(function (id) {
        var it = item(id), r = st.resolved[id];
        devices[it.at] = { state: r.option.node || 'normal', tag: r.contained ? T('state.stopped') : null };
      });
      st.open.forEach(function (id) {
        var it = item(id);
        devices[it.at] = {
          state: it.truth === 'malicious' ? 'danger' : 'alert',
          tag: L(it.tag), flash: st.selected !== id, clickable: st.phase !== 'feedback', action: 'open'
        };
      });
      var sel = st.selected ? item(st.selected) : null;
      return { devices: devices, flow: sel && st.phase === 'problem' ? { from: sel.at, to: sel.at === 'database' ? 'internet' : 'server', tone: 'danger' } : null };
    }

    function hud() {
      var health = Math.round(ctx.game.state.integrity);
      return h('div', { class: 'hud' + (st.timeLeft <= 10 ? ' is-urgent' : '') + (activeThreats().length && running() ? ' is-draining' : '') },
        h('div', { class: 'hud-item' },
          h('span', { class: 'hud-label' }, ui.svgIcon(ui.ICON.clock), T('m4.time')),
          h('span', { class: 'hud-value hud-time', role: 'timer' }, ui.formatTime(st.timeLeft * 1000 + 999))),
        h('div', { class: 'hud-item hud-item--grow' },
          h('span', { class: 'hud-label' }, ui.svgIcon(ui.ICON.shield), T('m4.health')),
          h('div', { class: 'health' + (health < 40 ? ' is-low' : health < 70 ? ' is-mid' : '') },
            h('span', { class: 'health-fill', style: 'transform:scaleX(' + (health / 100) + ')' })),
          h('span', { class: 'hud-value hud-health' }, health + '%')));
    }

    function panelBoard() {
      var list = st.open.map(function (id) {
        var it = item(id);
        return choice(T('m4.openProblem', { device: T('device.' + it.at), title: L(it.title) }), {
          tone: it.truth === 'malicious' ? 'danger' : 'alert', icon: ui.ICON.shield,
          onClick: function () { open(id); }
        });
      });
      return [
        stepLabel(T('q.problem', { n: Object.keys(st.resolved).length + 1, total: items.length })),
        title(st.open.length ? T('m4.boardTitle', { n: st.open.length }) : T('m4.done')),
        story(st.open.length ? T('m4.boardText') : T('m4.waiting')),
        h('div', { class: 'choices choices--stack' }, list)
      ];
    }

    function panelProblem() {
      var it = item(st.selected);
      return [
        h('div', { class: 'panel-top' },
          stepLabel(T('q.problem', { n: Object.keys(st.resolved).length + 1, total: items.length })),
          st.open.length > 1 ? h('button', { type: 'button', class: 'btn btn-link btn-back', on: { click: backToBoard } }, T('btn.backToNetwork')) : null),
        title(L(it.title)),
        story(L(it.situation)),
        h('div', { class: 'clue is-open' },
          h('span', { class: 'clue-icon' }, ui.svgIcon(ui.ICON.clue)),
          h('p', null, h('strong', null, T('clue') + ': '), L(it.clue))),
        question(T('m4.question')),
        h('div', { class: 'choices choices--stack' }, it.options.map(function (o, k) {
          return choice(L(o.label), { key: String(k + 1), tag: o.id === it.nexusPick ? T('m4.nexusPick') : null, onClick: function () { decide(k); } });
        }))
      ];
    }

    function panelFeedback() {
      var res = st.lastResult, it = item(res.id), o = res.option;
      var tone = ui.toneForGrade(o.grade);
      var done = Object.keys(st.resolved).length === items.length;
      return [
        stepLabel(T('q.problem', { n: Object.keys(st.resolved).length, total: items.length })),
        title(L(it.title)),
        ui.feedback(tone, L(o.text), o.points, o.contained && tone !== 'bad' ? T('m4.stopped') : null),
        continueButton(T(done ? 'btn.seeHow' : 'btn.backToNetwork'), afterFeedback)
      ];
    }

    function render() {
      if (ended) return;
      if (scene) { scene.destroy(); scene = null; }
      var panel = st.phase === 'problem' ? panelProblem() : st.phase === 'feedback' ? panelFeedback() : panelBoard();
      layout(ctx, [hud(), h('div', { class: 'scene-host' })], panel);
      scene = CQ.network.create(ctx.stage.querySelector('.scene-host'));
      scene.onClick(function (device) {
        var id = st.open.filter(function (x) { return item(x).at === device; })[0];
        if (id) open(id);
      });
      scene.update(sceneModel());
    }

    function updateHud() {
      var old = ctx.stage.querySelector('.hud');
      if (old) old.replaceWith(hud());
    }

    function open(id) {
      if (st.phase === 'feedback' || st.open.indexOf(id) < 0) return;
      st.selected = id;
      st.phase = 'problem';
      ctx.audio.play('select');
      var it = item(id);
      var pick = it.options.filter(function (o) { return o.id === it.nexusPick; })[0];
      ctx.nexus.say(pick && pick.grade !== 'best' ? 'nx.m4.lastWrongPick' : 'nx.m4.open');
      render();
      ctx.armHint();
      ui.focus(ctx.stage, '.challenge-title');
    }

    function backToBoard() {
      if (st.phase !== 'problem') return;
      st.phase = 'board';
      st.selected = null;
      render();
      ui.focus(ctx.stage, '.choice');
    }

    function decide(k) {
      if (st.phase !== 'problem' || ended) return;
      var it = item(st.selected);
      var option = it.options[k];
      if (!option) return;
      st.resolved[it.id] = { option: option, contained: !!option.contained };
      st.open = st.open.filter(function (x) { return x !== it.id; });
      st.lastResult = { id: it.id, option: option };
      st.phase = 'feedback';

      ctx.game.award(option.points, { k: 'ledger.m4', v: { title: it.title, grade: { t: 'grade.' + option.grade } } });
      ctx.game.applyEffects(option.effects);
      var pick = it.options.filter(function (o) { return o.id === it.nexusPick; })[0];
      ctx.game.recordDecision({
        mission: 3, id: it.id, grade: option.grade,
        malicious: it.truth === 'malicious', contained: !!option.contained,
        ai: pick ? { recommendedBest: pick.grade === 'best', followed: option.id === pick.id, chosenWrong: option.grade === 'wrong' } : null
      });
      if (ended) return; // a big enough hit can end the game
      var tone = ui.toneForGrade(option.grade);
      ctx.audio.play(tone === 'bad' ? 'error' : option.contained ? 'stop' : tone === 'good' ? 'success' : 'process');
      if (pick && pick.grade !== 'best' && option.grade === 'best') ctx.nexus.say('nx.m4.caught', null, 'happy');
      else ctx.nexus.say(tone === 'good' ? (it.truth === 'malicious' ? 'nx.m4.good' : 'nx.m4.goodSafe') : tone === 'okay' ? 'nx.m4.okay' : 'nx.m4.bad', null, tone === 'good' ? 'happy' : 'calm');
      st.selected = null;
      render();
      if (scene && option.contained && tone !== 'bad') scene.burst(it.at);
      ui.announce(L(option.text));
      ctx.progress(Object.keys(st.resolved).length / items.length);
      ctx.disarmHint();
      ui.focus(ctx.stage, '.btn-continue');
    }

    function afterFeedback() {
      if (st.phase !== 'feedback' || ended) return;
      if (Object.keys(st.resolved).length === items.length) { end('cleared'); return; }
      st.phase = 'board';
      lastTick = CQ.game.now();
      fillOpen(true);
      render();
      ctx.armHint();
      ui.focus(ctx.stage, '.choice');
    }

    function tick() {
      if (ended) return;
      var now = CQ.game.now();
      var dt = (now - lastTick) / 1000;
      lastTick = now;
      if (!running()) return;
      var rate = activeThreats().reduce(function (s, it) { return s + it.drain; }, 0);
      if (rate > 0) ctx.game.drainIntegrity(rate * dt);
      if (ended) return;
      st.timeLeft = Math.max(0, st.timeLeft - dt);
      var shown = Math.ceil(st.timeLeft) + ':' + Math.round(ctx.game.state.integrity);
      if (shown !== lastShown) {
        lastShown = shown;
        updateHud();
        if (st.timeLeft <= 10 && st.timeLeft > 0 && Math.ceil(st.timeLeft) !== Math.ceil(st.timeLeft + dt)) ctx.audio.play('tick');
      }
      if (st.timeLeft <= 0) end('timeout');
    }

    function end(reason) {
      if (ended) return;
      ended = true;
      ctx.clock.cancel(loopId);
      ctx.disarmHint();
      var g = ctx.game;
      items.forEach(function (it) {
        if (st.resolved[it.id]) return;
        if (it.truth === 'malicious') {
          g.award(MISSED_PENALTY, { k: 'ledger.missed', v: { title: it.title } });
          g.recordMissedThreat(it.id);
        }
      });
      if (reason === 'cleared' && st.timeLeft > 0) {
        g.award(Math.round(st.timeLeft * TIME_BONUS_PER_SECOND), { k: 'ledger.timeLeft', v: { s: Math.round(st.timeLeft) } }, 'bonus');
      }
      if (!g.state.breached) {
        g.award(Math.round(g.state.integrity * HEALTH_BONUS_FACTOR), { k: 'ledger.health', v: { n: Math.round(g.state.integrity) } }, 'bonus');
      }
      var active = activeThreats().length;
      g.setThreat(active ? 55 + active * 15 : Math.min(g.state.threat, 15));
      ctx.complete({ reason: reason, timeLeft: st.timeLeft });
    }

    return {
      start: function () {
        offBreach = ctx.game.on('breach', function () { end('breach'); });
        fillOpen(false);
        lastTick = CQ.game.now();
        render();
        ctx.nexus.say('nx.m4.start', null, 'alert');
        ctx.audio.play('alert');
        ctx.armHint();
        ui.focus(ctx.stage, '.choice');
        loopId = ctx.clock.every(200, tick);
      },
      render: render,
      destroy: function () {
        ended = true;
        ctx.clock.cancel(loopId);
        if (scene) scene.destroy();
        if (offBreach) offBreach();
      },
      onKey: function (key) {
        if (st.phase === 'problem' && (key === '1' || key === '2' || key === '3')) decide(Number(key) - 1);
        else if (st.phase === 'board' && (key === '1' || key === '2') && st.open[Number(key) - 1]) open(st.open[Number(key) - 1]);
      },
      hint: function () {
        if (st.phase === 'feedback') return 'hint.continue';
        return st.phase === 'problem' ? 'hint.m4.open' : 'hint.m4.board';
      }
    };
  }

  CQ.missions = {
    factories: [mission1, mission2, mission3, mission4],
    LABEL_POINTS: LABEL_POINTS,
    TEST_POINTS: TEST_POINTS
  };
})(window.CQ = window.CQ || {});
