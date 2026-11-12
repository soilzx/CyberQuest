/*
 * CyberQuest — missions
 *
 * Each mission shows one situation at a time: a picture on the left, and
 * on the right a title, a short explanation and two or three big buttons.
 * After a choice, the buttons are replaced by feedback and a Continue button.
 *
 * Each factory returns { start, destroy, onKey, hint } and calls
 * ctx.complete(result) when the mission is finished.
 *
 * ctx = { game, audio, clock, stage, nexus, progress(fraction), complete(result) }
 */
(function (CQ) {
  'use strict';

  var ui = CQ.ui;
  var h = ui.h;
  var S = CQ.scenarios;

  /* ------------------------------------------------------------------ */
  /* Shared building blocks                                               */
  /* ------------------------------------------------------------------ */

  // The two-part stage: picture on the left, decision on the right.
  function layout(ctx, visual, panel) {
    ui.clear(ctx.stage);
    var v = h('div', { class: 'stage-visual' }, visual);
    var p = h('div', { class: 'stage-panel' }, panel);
    ctx.stage.appendChild(h('div', { class: 'stage-split' }, v, p));
    return { visual: v, panel: p };
  }

  function replacePanel(slots, content) {
    ui.clear(slots.panel);
    [].concat(content).forEach(function (c) { if (c) slots.panel.appendChild(c); });
  }

  function sceneBox() { return h('div', { class: 'scene-host' }); }

  function stepLabel(text) { return h('p', { class: 'step-label' }, text); }

  function title(text) { return h('h2', { class: 'challenge-title', tabindex: '-1' }, text); }

  function story(text) { return h('p', { class: 'challenge-text' }, text); }

  function choice(label, sub, opts) {
    var o = opts || {};
    return h('button', {
      type: 'button',
      class: 'choice' + (o.tone ? ' choice--' + o.tone : '') + (o.extra ? ' ' + o.extra : ''),
      data: o.key ? { key: o.key } : null,
      on: { click: o.onClick }
    },
      o.icon ? h('span', { class: 'choice-icon' }, ui.svgIcon(o.icon)) : null,
      h('span', { class: 'choice-text' },
        h('span', { class: 'choice-label' }, label),
        sub ? h('span', { class: 'choice-sub' }, sub) : null),
      o.tag ? h('span', { class: 'choice-tag' }, o.tag) : null);
  }

  function continueButton(label, onClick) {
    return h('button', { type: 'button', class: 'btn btn-primary btn-continue', on: { click: onClick } }, label || 'Continue');
  }

  function confidenceWords(c) {
    return { high: 'Very sure', medium: 'Fairly sure', low: 'Not very sure' }[c] || 'Not sure';
  }

  var PRAISE = ['Nice work!', 'Good thinking!', 'You’re getting good at this!', 'Great job!'];
  var COMFORT = ['Tricky one! Let’s keep going.', 'That one fooled me too once.', 'Now you know the warning sign.'];
  function pick(list, i) { return list[i % list.length]; }

  function emailCard(v, verdict) {
    return h('div', { class: 'email' + (verdict ? ' is-' + verdict : '') },
      h('div', { class: 'email-bar' },
        h('span', { class: 'email-dot' }), h('span', { class: 'email-dot' }), h('span', { class: 'email-dot' }),
        h('span', { class: 'email-app' }, 'Inbox')),
      h('div', { class: 'email-body' },
        h('p', { class: 'email-from' }, h('span', { class: 'email-key' }, 'From'), v.from),
        h('p', { class: 'email-subject' }, v.subject),
        h('p', { class: 'email-text' }, v.body),
        h('span', { class: 'email-button', 'aria-hidden': 'true' }, v.button)),
      verdict ? h('span', { class: 'email-stamp' }, verdict === 'blocked' ? 'Phishing blocked' : 'Phishing reached the user') : null);
  }

  /* ------------------------------------------------------------------ */
  /* Mission 1: Spot the Threat                                           */
  /* ------------------------------------------------------------------ */
  function mission1(ctx) {
    var items = S.mission1;
    var index = 0;
    var answered = false;
    var clueShown = false;
    var slots = null;
    var scene = null;
    var correctCount = 0;

    function item() { return items[index]; }

    function show(i) {
      index = i;
      answered = false;
      clueShown = false;
      var it = item();
      var visual;
      if (it.visual.type === 'email') {
        visual = emailCard(it.visual);
        scene = null;
      } else {
        visual = sceneBox();
      }
      slots = layout(ctx, visual, panelContent());
      if (it.visual.type !== 'email') {
        scene = CQ.network.create(visual);
        scene.show({ from: it.visual.from, to: it.visual.to, focus: it.visual.focus, tag: it.visual.tag, state: 'alert' });
      }
      ctx.nexus.say(i === 0 ? 'Something looks unusual. Want to check it? Tap “Show a clue” if you need help.' : it.nexus);
      ctx.audio.play('alert');
      ctx.progress(i / items.length);
      ctx.armHint();
      ui.focus(ctx.stage, '.challenge-title');
    }

    function clueBlock() {
      var it = item();
      if (clueShown) {
        return h('div', { class: 'clue is-open' },
          h('span', { class: 'clue-icon' }, ui.svgIcon(ui.ICON.clue)),
          h('p', null, h('strong', null, 'Clue: '), it.clue));
      }
      return h('button', { type: 'button', class: 'btn btn-secondary btn-clue', on: { click: showClue } },
        ui.svgIcon(ui.ICON.clue), 'Show a clue');
    }

    function panelContent() {
      var it = item();
      return [
        stepLabel('Situation ' + (index + 1) + ' of ' + items.length),
        title(it.title),
        story(it.story),
        clueBlock(),
        h('p', { class: 'question' }, 'Does this look safe or suspicious?'),
        h('div', { class: 'choices choices--two' },
          choice('Looks safe', null, { icon: ui.ICON.check, key: '1', onClick: function () { decide('safe'); } }),
          choice('Looks suspicious', null, { icon: ui.ICON.shield, key: '2', tone: 'alert', onClick: function () { decide('suspicious'); } }))
      ];
    }

    function showClue() {
      if (clueShown || answered) return;
      clueShown = true;
      ctx.audio.play('select');
      var old = slots.panel.querySelector('.btn-clue');
      if (old) old.replaceWith(clueBlock());
      ui.focus(slots.panel, '.choice');
    }

    function decide(answer) {
      if (answered) return;
      answered = true;
      var it = item();
      var outcome = it.outcomes[answer];
      var correct = answer === it.answer;
      if (correct) correctCount++;
      ctx.game.award(outcome.points, it.title + (correct ? ': spotted correctly' : ': missed'));
      ctx.game.applyEffects(outcome.effects);
      ctx.game.recordDecision({ mission: 0, id: it.id, grade: correct ? 'best' : 'wrong', malicious: it.truth === 'malicious', contained: !!outcome.contained });
      ctx.audio.play(correct ? 'success' : 'error');
      ctx.nexus.say(correct ? pick(PRAISE, index) : pick(COMFORT, index), correct ? 'happy' : 'calm');
      ui.announce((correct ? 'Correct. ' : 'Not quite. ') + outcome.text);

      if (scene) scene.resolve(it.visual.focus, outcome.node);
      if (it.visual.type === 'email') {
        ui.clear(slots.visual);
        slots.visual.appendChild(emailCard(it.visual, answer === 'suspicious' ? 'blocked' : 'delivered'));
      }
      var last = index === items.length - 1;
      replacePanel(slots, [
        stepLabel('Situation ' + (index + 1) + ' of ' + items.length),
        title(it.title),
        ui.feedback(correct ? 'good' : 'bad', outcome.text, outcome.points),
        continueButton(last ? 'Finish mission' : 'Next situation', next)
      ]);
      ctx.progress((index + 1) / items.length);
      ctx.disarmHint();
      ui.focus(ctx.stage, '.btn-continue');
    }

    function next() {
      if (!answered) return;
      if (scene) { scene.destroy(); scene = null; }
      if (index < items.length - 1) show(index + 1);
      else ctx.complete({ correct: correctCount, total: items.length });
    }

    return {
      start: function () { show(0); },
      destroy: function () { if (scene) scene.destroy(); },
      onKey: function (key) {
        if (answered) return;
        if (key === '1') decide('safe');
        else if (key === '2') decide('suspicious');
        else if (key === 'c') showClue();
      },
      hint: function () {
        if (answered) return 'Press Continue when you are ready.';
        return clueShown ? 'Ask yourself: is there a good reason for this? If not, it is probably suspicious.' : 'Not sure? Tap “Show a clue”. It might explain everything.';
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
    var labels = {};
    var index = 0;
    var phase = 'label';      // label | ready | training | done
    var busy = false;
    var lastLabelAt = 0;

    function exampleCard(ex) {
      return h('div', { class: 'example' },
        h('span', { class: 'example-icon' }, ui.svgIcon(ex.icon === 'upload' ? ui.ICON.upload : ui.ICON.login)),
        h('p', { class: 'example-kind' }, ex.icon === 'upload' ? 'Data being sent' : 'Someone logging in'),
        h('h3', { class: 'example-title' }, ex.title),
        h('ul', { class: 'example-clues' }, ex.clues.map(function (c) { return h('li', null, c); })));
    }

    function dots() {
      return h('ol', { class: 'label-dots', 'aria-label': 'Your labels so far' }, examples.map(function (ex, i) {
        var l = labels[ex.id];
        return h('li', {
          class: 'label-dot' + (l ? ' is-' + l : '') + (i === index && phase === 'label' ? ' is-current' : ''),
          'aria-label': 'Example ' + (i + 1) + ': ' + (l === 'benign' ? 'safe' : l === 'malicious' ? 'suspicious' : 'not labeled yet')
        });
      }));
    }

    function showExample(i) {
      index = i;
      phase = 'label';
      var ex = examples[i];
      layout(ctx, exampleCard(ex), [
        stepLabel('Example ' + (i + 1) + ' of ' + examples.length),
        title('Is this safe or suspicious?'),
        story('Your answer teaches the AI. There is no score yet, so go with your best judgment.'),
        h('div', { class: 'choices choices--two' },
          choice('Safe', null, { icon: ui.ICON.check, key: '1', onClick: function () { label('benign'); } }),
          choice('Suspicious', null, { icon: ui.ICON.shield, key: '2', tone: 'alert', onClick: function () { label('malicious'); } })),
        dots(),
        i > 0 ? h('button', { type: 'button', class: 'btn btn-link', on: { click: back } }, 'Go back') : null
      ]);
      ctx.progress(i / (examples.length + 2));
      ctx.armHint();
      ui.focus(ctx.stage, '.choice');
    }

    function label(value) {
      if (phase !== 'label' || busy) return;
      // Ignore accidental double clicks on the same spot.
      var now = Date.now();
      if (now - lastLabelAt < 250) return;
      lastLabelAt = now;
      labels[examples[index].id] = value;
      ctx.audio.play('select');
      if (index < examples.length - 1) showExample(index + 1);
      else showReady();
    }

    function back() {
      if (phase === 'label' && index > 0) showExample(index - 1);
      else if (phase === 'ready') showExample(examples.length - 1);
    }

    function showReady() {
      phase = 'ready';
      var safe = examples.filter(function (e) { return labels[e.id] === 'benign'; }).length;
      layout(ctx, h('div', { class: 'ai-brain' },
        h('div', { class: 'brain-grid' }, examples.map(function (ex) {
          return h('span', { class: 'brain-chip is-' + labels[ex.id] }, labels[ex.id] === 'benign' ? 'Safe' : 'Suspicious');
        })),
        h('p', { class: 'brain-caption' }, 'Your 8 examples')), [
        stepLabel('Ready to train'),
        title('Time to teach the AI!'),
        story('You labeled ' + safe + ' examples as safe and ' + (examples.length - safe) + ' as suspicious. The AI will learn only from your answers.'),
        h('div', { class: 'choices' },
          h('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: train } }, 'Train the AI')),
        h('button', { type: 'button', class: 'btn btn-link', on: { click: back } }, 'Change my last answer')
      ]);
      ctx.nexus.say('I’m ready to learn. Teach me!', 'happy');
      ctx.progress((examples.length) / (examples.length + 2));
      ui.focus(ctx.stage, '.btn-big');
    }

    function train() {
      if (phase !== 'ready' || busy) return;
      busy = true;
      phase = 'training';
      ctx.disarmHint();
      var model = CQ.ai.trainKNN(examples.map(function (t) { return { id: t.id, x: t.x, label: labels[t.id] }; }), K);
      var result = model.evaluate(S.testSet.map(function (q) { return { id: q.id, x: q.x, truth: q.truth }; }));
      var labelCorrect = examples.filter(function (t) { return labels[t.id] === t.truth; }).length;

      var fill = h('span', { class: 'train-fill' });
      layout(ctx, h('div', { class: 'ai-brain is-learning' },
        h('div', { class: 'brain-grid' }, examples.map(function (ex) {
          return h('span', { class: 'brain-chip is-' + labels[ex.id] }, labels[ex.id] === 'benign' ? 'Safe' : 'Suspicious');
        })),
        h('p', { class: 'brain-caption' }, 'Comparing patterns…')), [
        stepLabel('Training'),
        title('The AI is learning…'),
        story('It is studying your 8 examples so it can recognize similar ones later.'),
        h('div', { class: 'train-track', role: 'progressbar', 'aria-label': 'Training progress' }, fill)
      ]);
      ctx.nexus.say('Learning from your examples…', 'busy');
      ctx.audio.play('process');
      var steps = 20, i = 0;
      var duration = ui.reducedMotion() ? 0 : 1600;
      function finish() {
        busy = false;
        score(result, labelCorrect);
        showResults(result, labelCorrect, model);
      }
      if (!duration) { finish(); return; }
      var id = ctx.clock.every(duration / steps, function () {
        i++;
        fill.style.transform = 'scaleX(' + (i / steps) + ')';
        if (i % 5 === 0) ctx.audio.play('tick');
        if (i >= steps) { ctx.clock.cancel(id); ctx.clock.after(200, finish); }
      });
    }

    function score(result, labelCorrect) {
      ctx.game.award(labelCorrect * LABEL_POINTS, 'Teaching: ' + labelCorrect + ' of 8 examples labeled like an expert');
      ctx.game.award(result.correct * TEST_POINTS, 'AI test: ' + result.correct + ' of ' + result.total + ' new examples right');
      examples.forEach(function (t) {
        ctx.game.recordDecision({ mission: 1, id: 'label-' + t.id, grade: labels[t.id] === t.truth ? 'best' : 'wrong', malicious: false });
      });
      ctx.game.recordModel({ correct: result.correct, total: result.total, accuracy: result.accuracy, labelCorrect: labelCorrect, labelTotal: 8,
        falsePositives: result.falsePositives, falseNegatives: result.falseNegatives });
      ctx.audio.play(result.correct >= 5 ? 'success' : 'process');
    }

    function explainMiss(row) {
      var q = S.testSet.filter(function (x) { return x.id === row.id; })[0];
      var wrongNeighbor = row.prediction.neighbors.map(function (n) {
        return examples.filter(function (e) { return e.id === n.id; })[0];
      }).filter(function (e) { return labels[e.id] !== e.truth; })[0];
      if (wrongNeighbor) {
        return 'It got “' + q.title + '” wrong because you labeled a similar example, “' + wrongNeighbor.title + '”, as ' +
          (labels[wrongNeighbor.id] === 'benign' ? 'safe' : 'suspicious') + '.';
      }
      return 'It got “' + q.title + '” wrong. It looked like examples from both groups, so the AI had to guess.';
    }

    function showResults(result, labelCorrect) {
      phase = 'done';
      var tiles = result.rows.map(function (row) {
        var q = S.testSet.filter(function (x) { return x.id === row.id; })[0];
        var said = row.prediction.label === 'malicious' ? 'Suspicious' : 'Safe';
        return h('li', { class: 'test-tile ' + (row.correct ? 'is-right' : 'is-wrong') },
          h('span', { class: 'test-mark' }, ui.svgIcon(row.correct ? ui.ICON.check : ui.ICON.cross)),
          h('span', { class: 'test-title' }, q.title),
          h('span', { class: 'test-said' }, 'AI said: ', h('strong', null, said)),
          h('span', { class: 'test-sure' }, row.prediction.unanimous ? 'Very sure' : 'Not sure'));
      });
      var misses = result.rows.filter(function (r) { return !r.correct; });
      var headline = result.correct === result.total
        ? 'Perfect! Your examples taught it well.'
        : misses.length === 1 ? explainMiss(misses[0]) : 'Wrong examples teach the AI wrong lessons. ' + explainMiss(misses[0]);

      layout(ctx, h('div', { class: 'test-board' },
        h('p', { class: 'test-board-title' }, 'The AI’s answers on new examples'),
        h('ul', { class: 'test-grid' }, tiles)), [
        stepLabel('Results'),
        title('You helped train the AI!'),
        h('p', { class: 'big-stat' }, h('span', { class: 'big-stat-num' }, result.correct + ' out of ' + result.total),
          h('span', { class: 'big-stat-text' }, 'new examples right. The AI had never seen these before.')),
        story(headline),
        h('p', { class: 'small-note' }, 'You labeled ' + labelCorrect + ' of 8 examples the way security experts would.'),
        ui.feedback(result.correct >= 5 ? 'good' : 'okay', 'An AI is only as good as the examples it learns from. That is why people who understand security are needed to train it.', labelCorrect * LABEL_POINTS + result.correct * TEST_POINTS, 'What this shows'),
        continueButton('Finish mission', function () { ctx.complete({ correct: result.correct, total: result.total }); })
      ]);
      ctx.nexus.say(result.correct >= 5 ? 'Thanks, teacher! I learned a lot from you.' : 'I learned what you taught me, even the mistakes!', 'happy');
      ctx.progress(1);
      ui.focus(ctx.stage, '.challenge-title');
    }

    return {
      start: function () { showExample(0); },
      destroy: function () {},
      onKey: function (key) {
        if (phase === 'label') { if (key === '1') label('benign'); else if (key === '2') label('malicious'); }
      },
      hint: function () {
        if (phase === 'label') return 'Look at the clues together. A big upload to a trusted partner is normal. A blocked website is not.';
        if (phase === 'ready') return 'Press “Train the AI” to see what it learned.';
        return 'Press Finish mission when you are ready.';
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Mission 3: Can You Trust the AI?                                     */
  /* ------------------------------------------------------------------ */
  function mission3(ctx) {
    var items = S.mission3.map(function (it) { return Object.assign({}, it, { analysis: CQ.ai.analyze(it.telemetry) }); });
    var index = 0;
    var answered = false;
    var slots = null;
    var scene = null;

    function current() { return items[index]; }
    function aiBand(it) { return it.analysis.band === 'contain' ? 'contain' : 'allow'; }
    function otherBand(b) { return b === 'contain' ? 'allow' : 'contain'; }

    function show(i) {
      index = i;
      answered = false;
      var it = current();
      var rec = it.actions[aiBand(it)];
      var box = sceneBox();
      var aiSays = h('div', { class: 'ai-says' },
        h('div', { class: 'ai-says-head' },
          h('span', { class: 'ai-says-label' }, 'NEXUS suggests'),
          h('span', { class: 'ai-says-sure' }, 'How sure? ' + confidenceWords(it.analysis.confidence))),
        h('p', { class: 'ai-says-action' }, rec));
      slots = layout(ctx, [box, aiSays], [
        stepLabel('Case ' + (i + 1) + ' of ' + items.length),
        title(it.title),
        story(it.story),
        h('div', { class: 'clue is-open' },
          h('span', { class: 'clue-icon' }, ui.svgIcon(ui.ICON.clue)),
          h('div', null, h('strong', null, 'Clues the AI can’t see'),
            h('ul', { class: 'clue-list' }, it.clues.map(function (c) { return h('li', null, c); })))),
        h('p', { class: 'question' }, 'Do you agree with the AI?'),
        h('div', { class: 'choices choices--two' },
          choice('Yes, follow the AI', rec, { key: '1', onClick: function () { decide(true); } }),
          choice('No, choose differently', it.actions[otherBand(aiBand(it))], { key: '2', onClick: function () { decide(false); } }))
      ]);
      scene = CQ.network.create(box);
      scene.show({ from: it.visual.from, to: it.visual.to, focus: it.visual.focus, tag: it.visual.tag, state: 'alert' });
      ctx.nexus.say(i === 0 ? 'I’m not always right. Check the clues before deciding!' : 'Here’s my suggestion. Do you agree?');
      ctx.audio.play('alert');
      ctx.progress(i / items.length);
      ctx.armHint();
      ui.focus(ctx.stage, '.challenge-title');
    }

    function decide(follow) {
      var it = current();
      if (!it || answered) return;
      answered = true;
      var recommended = aiBand(it);
      var chosen = follow ? recommended : otherBand(recommended);
      var outcome = it.outcomes[chosen];
      var correct = chosen === it.correctBand;
      var aiRight = recommended === it.correctBand;

      ctx.game.award(outcome.points, it.title + ': ' + (correct ? (aiRight ? 'trusted the AI when it was right' : 'caught the AI’s mistake') : (aiRight ? 'ignored the AI when it was right' : 'followed the AI when it was wrong')));
      ctx.game.applyEffects(outcome.effects);
      ctx.game.recordDecision({
        mission: 2, id: it.id, grade: correct ? 'best' : 'wrong',
        malicious: it.truth === 'malicious', contained: it.truth === 'malicious' && chosen === 'contain',
        ai: { recommendedBest: aiRight, followed: follow, chosenWrong: !correct }
      });
      scene.resolve(it.visual.focus, outcome.node);
      ctx.audio.play(correct ? 'success' : 'error');

      var heading = correct ? (aiRight ? 'Correct!' : 'You caught the AI’s mistake!') : (aiRight ? 'The AI was right this time' : 'The AI was wrong, and so was this choice');
      if (correct && !aiRight) ctx.nexus.say('You were right and I was wrong. That’s why people check my work!', 'happy');
      else if (correct) ctx.nexus.say('Teamwork! The clues agreed with me this time.', 'happy');
      else if (aiRight) ctx.nexus.say('Disagree with me only when the clues give you a reason.', 'calm');
      else ctx.nexus.say('I missed that one. The clues had the answer.', 'calm');
      ui.announce(heading + ' ' + outcome.text);

      var last = index === items.length - 1;
      replacePanel(slots, [
        stepLabel('Case ' + (index + 1) + ' of ' + items.length),
        title(it.title),
        ui.feedback(correct ? 'good' : 'bad', outcome.text, outcome.points, heading),
        continueButton(last ? 'Finish mission' : 'Next case', next)
      ]);
      ctx.progress((index + 1) / items.length);
      ctx.disarmHint();
      ui.focus(ctx.stage, '.btn-continue');
    }

    function next() {
      if (!answered) return;
      if (scene) { scene.destroy(); scene = null; }
      if (index < items.length - 1) show(index + 1);
      else ctx.complete({});
    }

    return {
      start: function () { show(0); },
      destroy: function () { if (scene) scene.destroy(); },
      onKey: function (key) {
        if (answered) return;
        if (key === '1') decide(true);
        else if (key === '2') decide(false);
      },
      hint: function () {
        if (answered) return 'Press Continue when you are ready.';
        return 'Do the clues explain what I saw? If they show something I missed, choose differently.';
      }
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
    var items = conf.incidents.map(function (it) {
      var analysis = CQ.ai.analyze(it.telemetry);
      var nexusPick = it.options.filter(function (o) { return o.band === analysis.band; })[0] || null;
      return Object.assign({}, it, { analysis: analysis, nexusPick: nexusPick ? nexusPick.id : null });
    });
    var index = 0;
    var resolved = {};
    var timeLeft = conf.duration;
    var running = false;      // the clock runs only while a problem is waiting for a decision
    var ended = false;
    var answered = false;
    var loopId = null;
    var lastTick = 0;
    var lastWhole = -1;
    var slots = null;
    var scene = null;
    var offBreach = null;

    function current() { return items[index]; }

    function isActiveThreat(it, i) {
      if (it.truth !== 'malicious' || i > index) return false;
      var r = resolved[it.id];
      return !r || !r.contained;
    }

    function drainRate() {
      return items.reduce(function (sum, it, i) { return sum + (isActiveThreat(it, i) ? it.drain : 0); }, 0);
    }

    function hud() {
      var health = Math.round(ctx.game.state.integrity);
      var urgent = timeLeft <= 10;
      return h('div', { class: 'hud' + (urgent ? ' is-urgent' : '') },
        h('div', { class: 'hud-item' },
          h('span', { class: 'hud-label' }, ui.svgIcon(ui.ICON.clock), 'Time left'),
          h('span', { class: 'hud-value hud-time', role: 'timer' }, ui.formatTime(timeLeft * 1000 + 999))),
        h('div', { class: 'hud-item hud-item--grow' },
          h('span', { class: 'hud-label' }, ui.svgIcon(ui.ICON.shield), 'Network health'),
          h('div', { class: 'health' + (health < 40 ? ' is-low' : health < 70 ? ' is-mid' : '') },
            h('span', { class: 'health-fill', style: 'transform:scaleX(' + (health / 100) + ')' })),
          h('span', { class: 'hud-value hud-health' }, health + '%')));
    }

    function updateHud() {
      var old = ctx.stage.querySelector('.hud');
      if (old) old.replaceWith(hud());
    }

    function show(i) {
      index = i;
      answered = false;
      var it = current();
      var box = sceneBox();
      slots = layout(ctx, [hud(), box], [
        stepLabel('Problem ' + (i + 1) + ' of ' + items.length),
        title(it.title),
        story(it.story),
        h('div', { class: 'clue is-open' },
          h('span', { class: 'clue-icon' }, ui.svgIcon(ui.ICON.clue)),
          h('p', null, h('strong', null, 'Clue: '), it.clue)),
        h('p', { class: 'question' }, 'What should you do?'),
        h('div', { class: 'choices choices--stack' }, it.options.map(function (o, k) {
          return choice(o.label, null, {
            key: String(k + 1),
            tag: o.id === it.nexusPick ? 'NEXUS suggests' : null,
            onClick: function () { decide(k); }
          });
        }))
      ]);
      scene = CQ.network.create(box);
      scene.show({ from: it.visual.from, to: it.visual.to, focus: it.visual.focus, tag: it.visual.tag,
        state: it.truth === 'malicious' ? 'danger' : 'alert', tone: it.truth === 'malicious' ? 'danger' : 'warn' });
      ctx.nexus.say(i === 0 ? 'The network is under attack! Health drops every second. Act fast!' : i === items.length - 1 ? 'Last one! Check the clue. I might be wrong here.' : 'Next problem. Quick, but careful!', 'alert');
      ctx.audio.play('alert');
      ctx.progress(i / items.length);
      running = true;
      lastTick = CQ.game.now();
      ctx.armHint();
      ui.focus(ctx.stage, '.challenge-title');
    }

    function decide(k) {
      var it = current();
      if (!it || answered || ended) return;
      var option = it.options[k];
      if (!option) return;
      answered = true;
      running = false;
      resolved[it.id] = { option: option, contained: !!option.contained };

      ctx.game.award(option.points, it.title + ': ' + (option.grade === 'best' ? 'best choice' : option.grade === 'acceptable' ? 'okay choice' : 'wrong choice'));
      ctx.game.applyEffects(option.effects);
      var pick = it.options.filter(function (o) { return o.id === it.nexusPick; })[0];
      ctx.game.recordDecision({
        mission: 3, id: it.id, grade: option.grade,
        malicious: it.truth === 'malicious', contained: !!option.contained,
        ai: pick ? { recommendedBest: pick.grade === 'best', followed: option.id === pick.id, chosenWrong: option.grade === 'wrong' } : null
      });
      if (ended) return; // a big enough hit can end the game (breach)
      scene.resolve(it.visual.focus, option.node);
      var tone = ui.toneForGrade(option.grade);
      ctx.audio.play(tone === 'good' ? 'success' : tone === 'bad' ? 'error' : 'process');
      if (pick && pick.grade !== 'best' && option.grade === 'best') ctx.nexus.say('You spotted my mistake. Great teamwork!', 'happy');
      else ctx.nexus.say(tone === 'good' ? pick === option ? 'We agreed, and we were right!' : 'Great decision!' : tone === 'okay' ? 'That works, but it caused some trouble.' : 'Ouch. That problem is still hurting the network.', tone === 'good' ? 'happy' : 'calm');
      ui.announce(option.text);

      var last = index === items.length - 1;
      replacePanel(slots, [
        stepLabel('Problem ' + (index + 1) + ' of ' + items.length),
        title(it.title),
        ui.feedback(tone, option.text, option.points),
        continueButton(last ? 'See how you did' : 'Next problem', next)
      ]);
      ctx.progress((index + 1) / items.length);
      ctx.disarmHint();
      ui.focus(ctx.stage, '.btn-continue');
    }

    function next() {
      if (!answered || ended) return;
      if (scene) { scene.destroy(); scene = null; }
      if (index < items.length - 1) show(index + 1);
      else end('cleared');
    }

    function tick() {
      if (ended) return;
      var t = CQ.game.now();
      var dt = (t - lastTick) / 1000;
      lastTick = t;
      // Active threats (including ones answered wrongly) drain health while the clock runs.
      // The clock and the drain pause while feedback is on screen.
      var rate = drainRate();
      if (rate > 0 && running) ctx.game.drainIntegrity(rate * dt);
      if (ended) return;
      if (running) timeLeft = Math.max(0, timeLeft - dt);
      var whole = Math.ceil(timeLeft) + Math.round(ctx.game.state.integrity) * 1000;
      if (whole !== lastWhole) { lastWhole = whole; updateHud(); if (running && timeLeft <= 10 && timeLeft > 0) ctx.audio.play('tick'); }
      if (timeLeft <= 0) end('timeout');
    }

    function end(reason) {
      if (ended) return;
      ended = true;
      running = false;
      ctx.clock.cancel(loopId);
      ctx.disarmHint();
      var g = ctx.game;

      items.forEach(function (it) {
        if (resolved[it.id]) return;
        if (it.truth === 'malicious') {
          g.award(MISSED_PENALTY, 'Ran out of time: ' + it.title.toLowerCase());
          g.recordMissedThreat(it.id);
        }
      });
      var allDone = Object.keys(resolved).length === items.length;
      if (reason === 'cleared' && allDone && timeLeft > 0) {
        g.award(Math.round(timeLeft * TIME_BONUS_PER_SECOND), 'Time left: ' + Math.round(timeLeft) + ' seconds', 'bonus');
      }
      if (!g.state.breached) {
        g.award(Math.round(g.state.integrity * HEALTH_BONUS_FACTOR), 'Network health: ' + Math.round(g.state.integrity) + '%', 'bonus');
      }
      var active = items.filter(function (it, i) { return isActiveThreat(it, i); }).length;
      g.setThreat(active ? 55 + active * 15 : Math.min(g.state.threat, 15));
      ctx.audio.play(reason === 'cleared' && !active ? 'complete' : 'failure');
      ctx.complete({ reason: reason, timeLeft: timeLeft });
    }

    return {
      start: function () {
        offBreach = ctx.game.on('breach', function () { end('breach'); });
        lastTick = CQ.game.now();
        show(0);
        loopId = ctx.clock.every(200, tick);
      },
      destroy: function () {
        ended = true;
        ctx.clock.cancel(loopId);
        if (scene) scene.destroy();
        if (offBreach) offBreach();
      },
      onKey: function (key) {
        if (answered) return;
        if (key === '1' || key === '2' || key === '3') decide(Number(key) - 1);
      },
      hint: function () {
        if (answered) return 'Press Continue for the next problem.';
        return 'Pick the choice that fixes the problem without breaking everything else.';
      }
    };
  }

  CQ.missions = {
    factories: [mission1, mission2, mission3, mission4],
    LABEL_POINTS: LABEL_POINTS,
    TEST_POINTS: TEST_POINTS
  };
})(window.CQ = window.CQ || {});
