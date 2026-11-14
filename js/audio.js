/*
 * CyberQuest — sound
 *
 * Short synthesised cues built with the Web Audio API. No audio files.
 * The AudioContext is created lazily on the first user gesture, as
 * browsers require, and every cue is quiet and brief.
 */
(function (CQ) {
  'use strict';

  var MUTE_KEY = 'cyberquest.muted';
  var ctx = null;
  var master = null;
  var muted = false;
  var lastPlayed = {};

  try { muted = window.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  // One enveloped oscillator note.
  function tone(freq, start, dur, opts) {
    var o = opts || {};
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    filter.type = 'lowpass';
    filter.frequency.value = o.cutoff || 2400;
    var peak = o.gain || 0.08;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(filter); filter.connect(gain); gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  var CUES = {
    select: function (t) { tone(1320, t, 0.05, { gain: 0.035, type: 'triangle' }); },
    alert: function (t) {
      tone(740, t, 0.11, { type: 'triangle', gain: 0.06 });
      tone(554, t + 0.13, 0.16, { type: 'triangle', gain: 0.06 });
    },
    success: function (t) {
      tone(523, t, 0.09, { type: 'sine', gain: 0.07 });
      tone(784, t + 0.08, 0.16, { type: 'sine', gain: 0.07 });
    },
    error: function (t) { tone(220, t, 0.24, { type: 'sawtooth', gain: 0.045, cutoff: 700, to: 160 }); },
    process: function (t) {
      for (var i = 0; i < 4; i++) tone(980 + i * 60, t + i * 0.07, 0.03, { type: 'square', gain: 0.018, cutoff: 1800 });
    },
    complete: function (t) {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.09, 0.22, { type: 'triangle', gain: 0.06 }); });
    },
    failure: function (t) {
      [392, 330, 262].forEach(function (f, i) { tone(f, t + i * 0.16, 0.3, { type: 'sawtooth', gain: 0.04, cutoff: 900 }); });
    },
    tick: function (t) { tone(1760, t, 0.025, { type: 'square', gain: 0.014, cutoff: 3000 }); },
    // Discovering a clue: a small bright two-note chime.
    clue: function (t) {
      tone(1046, t, 0.08, { type: 'sine', gain: 0.05 });
      tone(1568, t + 0.07, 0.14, { type: 'sine', gain: 0.045 });
    },
    // A card landing in a box.
    drop: function (t) { tone(330, t, 0.09, { type: 'triangle', gain: 0.07, to: 220 }); },
    // A threat stopped: a rising, satisfying sweep.
    stop: function (t) {
      tone(392, t, 0.1, { type: 'triangle', gain: 0.06 });
      tone(587, t + 0.08, 0.1, { type: 'triangle', gain: 0.06 });
      tone(880, t + 0.16, 0.22, { type: 'sine', gain: 0.06 });
    }
  };

  function play(name) {
    if (muted || !CUES[name]) return;
    var c = ensure();
    if (!c || c.state !== 'running') {
      if (c) c.resume().catch(function () {});
      if (!c || c.state !== 'running') return;
    }
    // Avoid stacking the same cue when events fire in a burst.
    var t = c.currentTime;
    if (lastPlayed[name] && t - lastPlayed[name] < 0.08) return;
    lastPlayed[name] = t;
    try { CUES[name](t + 0.005); } catch (e) { /* audio is optional */ }
  }

  function setMuted(value) {
    muted = !!value;
    try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!muted) ensure();
    return muted;
  }

  CQ.audio = {
    unlock: ensure,
    play: play,
    setMuted: setMuted,
    toggle: function () { return setMuted(!muted); },
    isMuted: function () { return muted; }
  };
})(window.CQ = window.CQ || {});
