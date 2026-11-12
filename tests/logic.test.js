/*
 * CyberQuest — logic tests (no dependencies)
 * Run with:  node tests/logic.test.js
 *
 * Covers the parts of the game that must be deterministic and honest:
 * the NEXUS rule engine, the k-NN classifier, scoring, nickname
 * sanitisation and the leaderboard.
 */
'use strict';
const path = require('path');
const assert = require('assert');

['scenarios.js', 'ai-engine.js', 'game.js', 'leaderboard.js'].forEach(f => require(path.join(__dirname, '..', 'js', f)));
const { scenarios: S, ai, game: G, leaderboard: LB } = globalThis.CQ;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('NEXUS rule engine');
test('scores are clamped to 0..100', () => {
  assert.strictEqual(ai.analyze({ failedLogins: 1000, distinctAccounts: 50, volumeRatio: 50, offHours: true, destination: 'flagged', lateral: 50 }).risk, 100);
  assert.strictEqual(ai.analyze({ mfaPassed: true, destination: 'known', processSigned: true }).risk, 0);
});
test('every finding explains a fired rule and the weights add up', () => {
  const a = ai.analyze({ volumeRatio: 40, offHours: true, destination: 'new', processSigned: false });
  assert.strictEqual(a.findings.reduce((s, f) => s + f.weight, 0), 95);
  assert.ok(a.findings.every(f => typeof f.text === 'string' && f.text.length > 5));
});
test('bands follow the documented thresholds', () => {
  assert.strictEqual(ai.analyze({ privileged: true }).band, 'allow');
  assert.strictEqual(ai.analyze({ volumeRatio: 12, destination: 'new', privileged: true }).band, 'investigate');
  assert.strictEqual(ai.analyze({ volumeRatio: 40, offHours: true, destination: 'new' }).band, 'contain');
});
test('mission 3 contains both AI false positives and false negatives', () => {
  const wrong = S.mission3.filter(it => {
    const band = ai.analyze(it.telemetry).band === 'contain' ? 'contain' : 'allow';
    return band !== it.correctBand;
  }).map(it => it.truth);
  assert.ok(wrong.includes('benign'), 'expected a false positive');
  assert.ok(wrong.includes('malicious'), 'expected a false negative');
});
test('mission 3 recommendations are never "investigate" (the choice is binary)', () => {
  S.mission3.forEach(it => assert.notStrictEqual(ai.analyze(it.telemetry).band, 'investigate', it.id));
});
test('mission 1 mixes safe and suspicious situations', () => {
  const answers = S.mission1.map(m => m.answer);
  assert.ok(answers.includes('safe') && answers.includes('suspicious'));
  S.mission1.forEach(m => assert.ok(m.outcomes.safe && m.outcomes.suspicious && m.clue, m.id));
});
test('NEXUS is wrong about the cloud leak in mission 4 and right about the rest', () => {
  S.mission4.incidents.forEach(it => {
    const band = ai.analyze(it.telemetry).band;
    const pick = it.options.find(o => o.band === band);
    assert.ok(pick, it.id + ' has an option NEXUS can suggest');
    if (it.id === 'm4-leak') assert.strictEqual(pick.grade, 'wrong');
    else assert.strictEqual(pick.grade, 'best', it.id);
  });
});
test('every mission 4 incident has a best option and at least one wrong option', () => {
  S.mission4.incidents.forEach(it => {
    assert.ok(it.options.some(o => o.grade === 'best'), it.id);
    assert.ok(it.options.some(o => o.grade === 'wrong'), it.id);
  });
});

console.log('k-nearest neighbours');
const truthLabels = () => S.training.map(t => ({ id: t.id, x: t.x, label: t.truth }));
const test6 = S.testSet.map(q => ({ id: q.id, x: q.x, truth: q.truth }));
test('correct labels classify the held-out set perfectly', () => {
  assert.strictEqual(ai.trainKNN(truthLabels(), 3).evaluate(test6).correct, 6);
});
test('predictions depend on the player labels (no hidden answers)', () => {
  const allBenign = S.training.map(t => ({ id: t.id, x: t.x, label: 'benign' }));
  const r = ai.trainKNN(allBenign, 3).evaluate(test6);
  assert.strictEqual(r.correct, 3);
  assert.strictEqual(r.falseNegatives, 3);
});
test('a single wrong label can flip a test prediction', () => {
  const flipped = truthLabels().map(e => e.id === 'T6' ? Object.assign({}, e, { label: 'malicious' }) : e);
  const row = ai.trainKNN(flipped, 3).evaluate(test6).rows.find(r => r.id === 'Q4');
  assert.strictEqual(row.prediction.label, 'malicious');
});
test('the test set never overlaps the training set', () => {
  const key = x => x.join(',');
  const train = new Set(S.training.map(t => key(t.x)));
  S.testSet.forEach(q => assert.ok(!train.has(key(q.x)), q.id));
});
test('neighbours and votes are reported for every prediction', () => {
  const p = ai.trainKNN(truthLabels(), 3).predict(S.testSet[0].x);
  assert.strictEqual(p.neighbors.length, 3);
  assert.strictEqual(p.votes.benign + p.votes.malicious, 3);
});
test('training on an empty set is rejected', () => {
  assert.throws(() => ai.trainKNN([], 3));
});

console.log('Game state and scoring');
test('nicknames are sanitised and capped', () => {
  assert.strictEqual(G.sanitizeNickname('  <script>alert(1)</script> '), 'scriptalert1scri');
  assert.strictEqual(G.sanitizeNickname('Noura   Al-Harbi'), 'Noura Al-Harbi');
  assert.strictEqual(G.sanitizeNickname('عبدالله'), 'عبدالله');
  assert.strictEqual(G.sanitizeNickname(42), '');
  assert.ok(G.sanitizeNickname('x'.repeat(40)).length <= G.NICK_MAX);
});
test('blank nicknames become an anonymous agent', () => {
  const g = new G.Game();
  g.start('   ');
  assert.ok(/^Agent \d{4}$/.test(g.state.nickname));
  assert.ok(g.state.anonymous);
});
test('awards are recorded in the ledger and per mission', () => {
  const g = new G.Game();
  g.start('A');
  g.beginMission(0);
  g.award(100, 'x');
  g.award(-40, 'y');
  assert.strictEqual(g.state.score, 60);
  assert.strictEqual(g.state.missionScores[0], 60);
  assert.strictEqual(g.state.ledger.length, 2);
});
test('metrics are clamped and breach fires once at zero integrity', () => {
  const g = new G.Game();
  g.start('A');
  let breaches = 0;
  g.on('breach', () => breaches++);
  g.applyEffects({ integrity: -150, stability: 30 });
  g.applyEffects({ integrity: -10 });
  assert.strictEqual(g.state.integrity, 0);
  assert.strictEqual(g.state.stability, 100);
  assert.strictEqual(breaches, 1);
});
test('AI collaboration counts following correct AI and overriding wrong AI', () => {
  const g = new G.Game();
  g.start('A');
  g.recordDecision({ id: 'a', grade: 'best', ai: { recommendedBest: true, followed: true, chosenWrong: false } });
  g.recordDecision({ id: 'b', grade: 'best', ai: { recommendedBest: false, followed: false, chosenWrong: false } });
  g.recordDecision({ id: 'c', grade: 'wrong', ai: { recommendedBest: false, followed: true, chosenWrong: true } });
  g.recordDecision({ id: 'd', grade: 'wrong', ai: { recommendedBest: true, followed: false, chosenWrong: true } });
  assert.deepStrictEqual([g.state.ai.calls, g.state.ai.good], [4, 2]);
});
test('efficiency bonus is full at par and zero at twice par', () => {
  assert.strictEqual(G.efficiencyBonus(30, 60), 50);
  assert.strictEqual(G.efficiencyBonus(90, 60), 25);
  assert.strictEqual(G.efficiencyBonus(120, 60), 0);
});
test('ranks are deterministic and ordered', () => {
  assert.strictEqual(G.rankFor(0).name, 'Cyber Recruit');
  assert.strictEqual(G.rankFor(700).name, 'Threat Hunter');
  assert.strictEqual(G.rankFor(1699).name, 'Security Analyst');
  assert.strictEqual(G.rankFor(1700).name, 'Cyber Defender');
  assert.strictEqual(G.rankFor(2149).name, 'Cyber Defender');
  assert.strictEqual(G.rankFor(5000).name, 'Elite AI Guardian');
});
test('finish is idempotent', () => {
  const g = new G.Game();
  g.start('A');
  const a = g.finish();
  const b = g.finish();
  assert.strictEqual(a.timeMs, b.timeMs);
});
test('the managed clock cancels everything it scheduled', () => {
  const c = G.createClock();
  c.after(10000, () => { throw new Error('should not run'); });
  c.every(10000, () => { throw new Error('should not run'); });
  assert.strictEqual(c.pending, 2);
  c.clearAll();
  assert.strictEqual(c.pending, 0);
});

console.log('Leaderboard');
const run = (id, score, timeMs) => ({ runId: id, nickname: 'P' + id, score, timeMs, rank: { name: 'Threat Hunter' } });
test('submitting the same run twice stores one entry', () => {
  const b = LB.create(LB.memoryAdapter());
  b.submit(run('r1', 900, 200000));
  const second = b.submit(run('r1', 900, 200000));
  assert.strictEqual(b.count(), 1);
  assert.strictEqual(second.added, false);
});
test('sorted by score, then by faster time', () => {
  const b = LB.create(LB.memoryAdapter());
  b.submit(run('a', 1000, 300000));
  b.submit(run('b', 1200, 280000));
  b.submit(run('c', 1000, 200000));
  assert.deepStrictEqual(b.top().map(e => e.runId), ['b', 'c', 'a']);
});
test('top list is capped at ten', () => {
  const b = LB.create(LB.memoryAdapter());
  for (let i = 0; i < 14; i++) b.submit(run('r' + i, i * 10, 1000));
  assert.strictEqual(b.top().length, 10);
  assert.strictEqual(b.submit(run('r0', 0, 1000)).position, 0);
});
test('a saved run can be renamed after the game', () => {
  const b = LB.create(LB.memoryAdapter());
  b.submit(run('r1', 900, 200000));
  const r = b.rename('r1', 'Noura');
  assert.ok(r.renamed);
  assert.strictEqual(b.top()[0].nickname, 'Noura');
  assert.strictEqual(b.count(), 1);
  assert.strictEqual(b.rename('missing', 'X').renamed, false);
});
test('corrupt stored data is ignored, not fatal', () => {
  const bad = { load: () => [{ nickname: 1 }, null, { nickname: 'ok', score: 5, timeMs: 1, timestamp: 1, rank: 'x', runId: 'z' }], save: () => true, clear: () => true };
  assert.strictEqual(LB.create(bad).top().length, 1);
});

console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
process.exit(failures.length ? 1 : 0);
