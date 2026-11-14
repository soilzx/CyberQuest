/*
 * CyberQuest — the network picture
 *
 * Four recognisable devices (Internet, Server, Computer, Database) joined by
 * plain lines. The picture is drawn from a small model, so a mission can
 * redraw it at any time (for example after a language switch) without losing
 * anything:
 *
 *   scene.update({
 *     devices: { computer: { state: 'alert', tag: 'Sending files', clue: 'pending', clickable: true, flash: false } },
 *     flow: { from: 'computer', to: 'internet', tone: 'warn' }
 *   })
 *
 * state: normal | alert | danger | blocked | safe
 * clue:  'pending' shows a pulsing "?" (a clue to discover), 'found' a tick.
 * Clickable devices are real buttons for keyboard and screen-reader users.
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

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function t(key, vars) { return CQ.i18n.t(key, vars); }

  function create(container) {
    var model = { devices: {}, flow: null };
    var clickHandlers = [];
    var flowTimer = null;
    var dots = [];
    var raf = null;
    var destroyed = false;

    container.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'scene', role: 'group' });
    container.appendChild(svg);
    var gLinks = el('g', { class: 'scene-links', 'aria-hidden': 'true' }, svg);
    var gDots = el('g', { class: 'scene-dots', 'aria-hidden': 'true' }, svg);
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
      el('circle', { class: 'scene-burst', r: 40 }, g);
      el('circle', { class: 'scene-halo', r: 52 }, g);
      el('circle', { class: 'scene-disc', r: 40 }, g);
      el('path', { class: 'scene-icon', d: ICONS[id], transform: 'translate(-18 -18) scale(1.5)' }, g);
      el('text', { class: 'scene-name', y: 66, 'text-anchor': 'middle' }, g);
      var tagG = el('g', { class: 'scene-tag', transform: 'translate(0 -62)' }, g);
      el('rect', { class: 'scene-tag-bg', x: -60, y: -15, width: 120, height: 28, rx: 14 }, tagG);
      el('text', { class: 'scene-tag-text', y: 5, 'text-anchor': 'middle' }, tagG);
      var mark = el('g', { class: 'scene-mark', transform: 'translate(32 -30)' }, g);
      el('circle', { class: 'scene-mark-bg', r: 13 }, mark);
      el('text', { class: 'scene-mark-q', y: 6, 'text-anchor': 'middle' }, mark).textContent = '?';
      el('path', { class: 'scene-mark-tick', d: 'M-5.5 0.5l3.5 3.5 7-7.5' }, mark);

      g.addEventListener('click', function () { fire(id); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(id); }
      });
      nodeEls[id] = g;
    });

    function fire(id) {
      var d = model.devices[id];
      if (!d || !d.clickable) return;
      clickHandlers.forEach(function (fn) { fn(id); });
    }

    function linkKey(a, b) {
      if (linkEls[a + '-' + b]) return a + '-' + b;
      if (linkEls[b + '-' + a]) return b + '-' + a;
      return null;
    }

    function sizeTag(tagG, label) {
      var text = tagG.querySelector('.scene-tag-text');
      text.textContent = label;
      var w = 0;
      try { w = text.getComputedTextLength(); } catch (e) { w = 0; }
      if (!w) w = label.length * 8.6;
      var width = Math.max(64, Math.round(w) + 26);
      var rect = tagG.querySelector('.scene-tag-bg');
      rect.setAttribute('x', -width / 2);
      rect.setAttribute('width', width);
      tagG.style.display = label ? '' : 'none';
    }

    function render() {
      var names = [];
      Object.keys(nodeEls).forEach(function (id) {
        var g = nodeEls[id];
        var d = model.devices[id] || {};
        var state = d.state || 'normal';
        var cls = 'scene-node is-' + state;
        if (d.clickable) cls += ' is-clickable' + (d.action === 'open' ? ' is-problem' : '');
        if (d.flash) cls += ' is-flashing';
        if (d.clue) cls += ' has-clue clue-' + d.clue;
        g.setAttribute('class', cls);
        var name = t('device.' + id);
        g.querySelector('.scene-name').textContent = name;
        var label = d.tag || (state !== 'normal' ? t('state.' + state) : '');
        sizeTag(g.querySelector('.scene-tag'), label);
        if (d.clickable) {
          g.setAttribute('role', 'button');
          g.setAttribute('tabindex', '0');
          g.setAttribute('aria-label', t(d.action === 'open' ? 'scene.open' : 'scene.investigate', { device: name }) + (label ? ' (' + label + ')' : ''));
        } else {
          g.removeAttribute('role');
          g.removeAttribute('tabindex');
          g.removeAttribute('aria-label');
        }
        names.push(name + (label ? ' (' + label + ')' : ''));
      });
      var flow = model.flow;
      Object.keys(linkEls).forEach(function (k) {
        var ends = k.split('-');
        var on = flow && linkKey(flow.from, flow.to) === k;
        var da = model.devices[ends[0]] || {}, db = model.devices[ends[1]] || {};
        var cut = da.state === 'blocked' || db.state === 'blocked';
        linkEls[k].setAttribute('class', 'scene-link' + (on ? ' is-active tone-' + (flow.tone || 'warn') : '') + (cut ? ' is-cut' : ''));
      });
      svg.setAttribute('aria-label', t('scene.aria', { list: names.join(', ') }));
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
        var p = (ts - d.start) / d.dur;
        if (p >= 1) { d.el.remove(); return false; }
        var e = p < 0 ? 0 : p;
        d.el.setAttribute('cx', (d.a[0] + (d.b[0] - d.a[0]) * e).toFixed(1));
        d.el.setAttribute('cy', (d.a[1] + (d.b[1] - d.a[1]) * e).toFixed(1));
        return true;
      });
      if (dots.length && !destroyed) raf = requestAnimationFrame(step);
    }

    function restartFlow() {
      if (flowTimer) clearInterval(flowTimer);
      flowTimer = null;
      var f = model.flow;
      if (!f || !linkKey(f.from, f.to)) return;
      spawnDot(f.from, f.to, f.tone);
      flowTimer = setInterval(function () { spawnDot(f.from, f.to, f.tone); }, 700);
    }

    var api = {
      update: function (next) {
        var prevFlow = JSON.stringify(model.flow);
        model = { devices: (next && next.devices) || {}, flow: (next && next.flow) || null };
        render();
        if (JSON.stringify(model.flow) !== prevFlow) restartFlow();
      },
      // Redraw labels (used after a language switch).
      refresh: render,
      onClick: function (fn) { clickHandlers.push(fn); },
      // A short green ring when a threat is stopped.
      burst: function (id) {
        var g = nodeEls[id];
        if (!g || reducedMotion()) return;
        g.classList.remove('is-bursting');
        void g.getBoundingClientRect();
        g.classList.add('is-bursting');
        setTimeout(function () { g.classList.remove('is-bursting'); }, 900);
      },
      focusDevice: function (id) { var g = nodeEls[id]; if (g && g.focus) g.focus(); },
      destroy: function () {
        destroyed = true;
        if (flowTimer) clearInterval(flowTimer);
        if (raf) cancelAnimationFrame(raf);
        container.textContent = '';
      }
    };
    render();
    return api;
  }

  CQ.network = { create: create, positions: POS };
})(window.CQ = window.CQ || {});
