/*
 * CyberQuest — the simple network picture
 *
 * Four recognisable devices (Internet, Server, Computer, Database) joined
 * by plain lines. A mission highlights the device involved, labels what it
 * is doing, and sends a moving dot along the connection. The picture
 * supports the story; it is never a puzzle to decode.
 */
(function (CQ) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 600, H = 330;

  var POS = {
    internet: [100, 165],
    server: [300, 72],
    computer: [300, 258],
    database: [500, 165]
  };

  var LINKS = [
    ['internet', 'server'], ['internet', 'computer'],
    ['server', 'database'], ['computer', 'database'], ['server', 'computer']
  ];

  // Icons drawn on a 24 × 24 grid.
  var ICONS = {
    internet: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9',
    server: 'M4 4h16v6H4zM4 14h16v6H4zM7.5 7h.01M7.5 17h.01M11 7h6M11 17h6',
    computer: 'M5 5h14v10H5zM2.5 19h19M9 19l.8-2h4.4l.8 2',
    database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'
  };

  var STATE_WORDS = { alert: 'Unusual', danger: 'In danger', blocked: 'Disconnected', safe: 'Safe' };

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function create(container, options) {
    var opts = options || {};
    var names = {};
    CQ.scenarios.devices.forEach(function (d) { names[d.id] = d.name; });

    var states = {};
    var tags = {};
    var active = null;       // [from, to]
    var flowTimer = null;
    var dots = [];
    var raf = null;
    var destroyed = false;

    container.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'scene', role: 'img' });
    container.appendChild(svg);
    var gLinks = el('g', { class: 'scene-links' }, svg);
    var gDots = el('g', { class: 'scene-dots' }, svg);
    var gNodes = el('g', { class: 'scene-nodes' }, svg);

    var linkEls = {};
    LINKS.forEach(function (l) {
      var a = POS[l[0]], b = POS[l[1]];
      linkEls[l.join('-')] = el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'scene-link' }, gLinks);
    });

    var nodeEls = {};
    Object.keys(POS).forEach(function (id) {
      var p = POS[id];
      var g = el('g', { class: 'scene-node', transform: 'translate(' + p[0] + ' ' + p[1] + ')' }, gNodes);
      el('circle', { class: 'scene-halo', r: 52 }, g);
      el('circle', { class: 'scene-disc', r: 40 }, g);
      el('path', { class: 'scene-icon', d: ICONS[id], transform: 'translate(-18 -18) scale(1.5)' }, g);
      var name = el('text', { class: 'scene-name', y: 66, 'text-anchor': 'middle' }, g);
      name.textContent = names[id];
      var tagG = el('g', { class: 'scene-tag', transform: 'translate(0 -62)' }, g);
      el('rect', { class: 'scene-tag-bg', x: -60, y: -15, width: 120, height: 28, rx: 14 }, tagG);
      el('text', { class: 'scene-tag-text', y: 5, 'text-anchor': 'middle' }, tagG);
      nodeEls[id] = g;
    });

    function linkKey(a, b) {
      if (linkEls[a + '-' + b]) return a + '-' + b;
      if (linkEls[b + '-' + a]) return b + '-' + a;
      return null;
    }

    function describe() {
      var parts = Object.keys(POS).map(function (id) {
        var s = states[id];
        return names[id] + (s && s !== 'normal' ? ' (' + (tags[id] || STATE_WORDS[s]) + ')' : '');
      });
      svg.setAttribute('aria-label', 'Network picture: ' + parts.join(', ') + '.');
    }

    function apply() {
      Object.keys(nodeEls).forEach(function (id) {
        var g = nodeEls[id];
        var s = states[id] || 'normal';
        g.setAttribute('class', 'scene-node is-' + s);
        var label = tags[id] || STATE_WORDS[s] || '';
        var tagG = g.querySelector('.scene-tag');
        var text = tagG.querySelector('.scene-tag-text');
        text.textContent = label;
        // Size the pill to its text (Arial ~0.55em per character at 16px).
        var w = Math.max(70, Math.round(label.length * 8.6) + 28);
        var rect = tagG.querySelector('.scene-tag-bg');
        rect.setAttribute('x', -w / 2);
        rect.setAttribute('width', w);
        tagG.style.display = label ? '' : 'none';
      });
      Object.keys(linkEls).forEach(function (k) {
        var ends = k.split('-');
        var on = active && linkKey(active[0], active[1]) === k;
        var cut = states[ends[0]] === 'blocked' || states[ends[1]] === 'blocked';
        linkEls[k].setAttribute('class', 'scene-link' + (on ? ' is-active' : '') + (cut ? ' is-cut' : ''));
      });
      describe();
    }

    function spawnDot(from, to, tone) {
      if (reducedMotion() || destroyed) return;
      var a = POS[from], b = POS[to];
      var c = el('circle', { class: 'scene-dot tone-' + (tone || 'warn'), r: 6, cx: a[0], cy: a[1] }, gDots);
      dots.push({ el: c, a: a, b: b, start: performance.now(), dur: 1100 });
      if (!raf) raf = requestAnimationFrame(step);
    }

    function step(ts) {
      raf = null;
      dots = dots.filter(function (d) {
        var t = (ts - d.start) / d.dur;
        if (t >= 1) { d.el.remove(); return false; }
        var e = t < 0 ? 0 : t;
        d.el.setAttribute('cx', (d.a[0] + (d.b[0] - d.a[0]) * e).toFixed(1));
        d.el.setAttribute('cy', (d.a[1] + (d.b[1] - d.a[1]) * e).toFixed(1));
        return true;
      });
      if (dots.length && !destroyed) raf = requestAnimationFrame(step);
    }

    function stopFlow() {
      if (flowTimer) clearInterval(flowTimer);
      flowTimer = null;
    }

    var api = {
      /**
       * show({ from, to, focus, tag, state, tone })
       * Highlights one situation: the focus device gets a state and a label,
       * and dots travel from `from` to `to` while the situation is open.
       */
      show: function (s) {
        api.reset();
        if (!s) return;
        if (s.focus) {
          states[s.focus] = s.state || 'alert';
          if (s.tag) tags[s.focus] = s.tag;
        }
        if (s.from && s.to && linkKey(s.from, s.to)) {
          active = [s.from, s.to];
          spawnDot(s.from, s.to, s.tone);
          flowTimer = setInterval(function () { spawnDot(s.from, s.to, s.tone); }, 700);
        }
        apply();
      },
      // Settle the situation after a decision.
      resolve: function (focus, state, tag) {
        stopFlow();
        active = null;
        if (focus) {
          states[focus] = state || 'normal';
          tags[focus] = tag || STATE_WORDS[state] || '';
        }
        apply();
      },
      reset: function () {
        stopFlow();
        dots.forEach(function (d) { d.el.remove(); });
        dots = [];
        states = {};
        tags = {};
        active = null;
        apply();
      },
      destroy: function () {
        destroyed = true;
        stopFlow();
        if (raf) cancelAnimationFrame(raf);
        container.textContent = '';
      }
    };
    if (opts.initial) api.show(opts.initial); else apply();
    return api;
  }

  CQ.network = { create: create, positions: POS };
})(window.CQ = window.CQ || {});
