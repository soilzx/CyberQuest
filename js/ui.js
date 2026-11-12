/*
 * CyberQuest — UI helpers
 *
 * Safe DOM building (text only, never innerHTML with data), the header,
 * the NEXUS guide bubble, feedback blocks, dialogs and toasts.
 */
(function (CQ) {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  /**
   * h('button', { class: 'btn', on: { click: fn }, aria: { pressed: 'false' } }, 'Label')
   */
  function h(tag, attrs) {
    var node = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (key) {
      var v = a[key];
      if (v == null || v === false) return;
      if (key === 'class') node.className = v;
      else if (key === 'text') node.textContent = v;
      else if (key === 'on') Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
      else if (key === 'aria') Object.keys(v).forEach(function (k) { if (v[k] != null) node.setAttribute('aria-' + k, v[k]); });
      else if (key === 'data') Object.keys(v).forEach(function (k) { node.dataset[k] = v[k]; });
      else if (key === 'style') node.setAttribute('style', v);
      else if (v === true) node.setAttribute(key, '');
      else node.setAttribute(key, v);
    });
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function svgIcon(path, cls, viewBox) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', viewBox || '0 0 24 24');
    s.setAttribute('class', 'icon ' + (cls || ''));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    s.appendChild(p);
    return s;
  }

  var ICON = {
    soundOn: 'M4 9h3.5L12 5v14l-4.5-4H4zM15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12',
    soundOff: 'M4 9h3.5L12 5v14l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    half: 'M6 12h12',
    clue: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
    login: 'M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5zM12 14v2.5',
    upload: 'M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14',
    shield: 'M12 3 4.5 6v5.5c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5V6z',
    clock: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 8v4.5l3 2'
  };

  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------------------ */
  /* Announcer and toasts                                                 */
  /* ------------------------------------------------------------------ */
  function announce(text) {
    var a = $('#announcer');
    if (!a) return;
    a.textContent = '';
    setTimeout(function () { a.textContent = text; }, 40);
  }

  function toast(text, tone) {
    var zone = $('#toasts');
    if (!zone) return;
    var t = h('div', { class: 'toast tone-' + (tone || 'neutral'), role: 'status' }, text);
    zone.appendChild(t);
    setTimeout(function () { t.classList.add('is-leaving'); }, 2600);
    setTimeout(function () { t.remove(); }, 3000);
  }

  /* ------------------------------------------------------------------ */
  /* Header                                                               */
  /* ------------------------------------------------------------------ */
  var header = {
    setMission: function (index, title) {
      var label = $('#mission-label');
      if (label) label.textContent = 'Mission ' + (index + 1) + ' of 4: ' + title;
    },
    // fraction of the whole game, 0..1
    setProgress: function (fraction) {
      var f = Math.max(0, Math.min(1, fraction));
      var fill = $('#progress-fill');
      if (fill) fill.style.transform = 'scaleX(' + f + ')';
      var bar = $('#progress');
      if (bar) bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    },
    setScore: function (score, delta) {
      var el = $('#score-value');
      if (!el) return;
      el.textContent = String(score);
      if (delta) {
        var prev = el.parentNode.querySelector('.score-delta');
        if (prev) prev.remove();
        var d = h('span', { class: 'score-delta ' + (delta > 0 ? 'is-gain' : 'is-loss'), 'aria-hidden': 'true' }, (delta > 0 ? '+' : '') + delta);
        el.parentNode.appendChild(d);
        setTimeout(function () { d.remove(); }, 1300);
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* NEXUS guide: one short message at a time                             */
  /* ------------------------------------------------------------------ */
  var nexus = {
    say: function (text, mood) {
      var t = $('#guide-text');
      var guide = $('#guide');
      if (!t || !guide) return;
      t.textContent = text;
      guide.dataset.mood = mood || 'calm';
      guide.classList.remove('is-new');
      void guide.offsetWidth; // restart the small "new message" cue
      guide.classList.add('is-new');
    }
  };

  /* ------------------------------------------------------------------ */
  /* Feedback after a decision                                            */
  /* ------------------------------------------------------------------ */
  var FEEDBACK = {
    good: { title: 'Correct!', icon: ICON.check },
    okay: { title: 'Good, but not the best choice', icon: ICON.half },
    bad: { title: 'Not quite', icon: ICON.cross }
  };

  function toneForGrade(grade) {
    return grade === 'best' ? 'good' : grade === 'acceptable' || grade === 'partial' ? 'okay' : 'bad';
  }

  function feedback(tone, text, points, title) {
    var f = FEEDBACK[tone] || FEEDBACK.okay;
    return h('div', { class: 'feedback tone-' + tone, role: 'status' },
      h('div', { class: 'feedback-head' },
        h('span', { class: 'feedback-icon' }, svgIcon(f.icon)),
        h('h3', { class: 'feedback-title' }, title || f.title),
        points != null ? h('span', { class: 'feedback-points' }, signed(points) + ' points') : null),
      h('p', { class: 'feedback-text' }, text));
  }

  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)); }

  /* ------------------------------------------------------------------ */
  /* Dialog                                                               */
  /* ------------------------------------------------------------------ */
  var dialogState = { onClose: null, lastFocus: null, dismissible: true };

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.disabled && n.offsetParent !== null; });
  }

  function onDialogKey(e) {
    var dlg = $('#dialog');
    if (e.key === 'Escape' && dialogState.dismissible) { e.preventDefault(); closeDialog(); return; }
    if (e.key === 'Tab') {
      var f = focusables(dlg);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /**
   * openDialog({ title, body, actions:[{label, primary, danger, onClick, keep}], dismissible, className })
   */
  function openDialog(conf) {
    var overlay = $('#overlay');
    var dlg = $('#dialog');
    if (!overlay || !dlg) return function () {};
    if (!overlay.hidden) closeDialog(true);
    dialogState.lastFocus = document.activeElement;
    dialogState.onClose = conf.onClose || null;
    dialogState.dismissible = conf.dismissible !== false;
    clear(dlg);
    dlg.className = 'dialog ' + (conf.className || '');
    dlg.appendChild(h('h2', { id: 'dialog-title', class: 'dialog-title' }, conf.title));
    if (conf.body) dlg.appendChild(h('div', { class: 'dialog-body' }, conf.body));
    if (conf.actions && conf.actions.length) {
      dlg.appendChild(h('div', { class: 'dialog-actions' }, conf.actions.map(function (a) {
        return h('button', {
          type: 'button',
          class: 'btn ' + (a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-secondary'),
          on: { click: function () { if (!a.keep) closeDialog(true); if (a.onClick) a.onClick(); } }
        }, a.label);
      })));
    }
    if (dialogState.dismissible) {
      dlg.appendChild(h('button', {
        type: 'button', class: 'dialog-close', aria: { label: 'Close' },
        on: { click: function () { closeDialog(); } }
      }, svgIcon(ICON.cross)));
    }
    dlg.setAttribute('aria-labelledby', 'dialog-title');
    overlay.hidden = false;
    document.addEventListener('keydown', onDialogKey, true);
    var target = dlg.querySelector('.btn-primary') || focusables(dlg)[0];
    setTimeout(function () { if (target) target.focus(); }, 30);
    return closeDialog;
  }

  function closeDialog(silent) {
    var overlay = $('#overlay');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.removeEventListener('keydown', onDialogKey, true);
    var cb = dialogState.onClose;
    dialogState.onClose = null;
    var lf = dialogState.lastFocus;
    if (lf && lf.focus && document.contains(lf)) lf.focus();
    if (!silent && cb) cb();
  }

  function dialogOpen() {
    var overlay = $('#overlay');
    return !!overlay && !overlay.hidden;
  }

  function focus(root, sel) {
    var n = (root || document).querySelector(sel);
    if (n && n.focus) n.focus({ preventScroll: true });
  }

  CQ.ui = {
    $: $,
    h: h,
    clear: clear,
    svgIcon: svgIcon,
    ICON: ICON,
    formatTime: formatTime,
    reducedMotion: reducedMotion,
    announce: announce,
    toast: toast,
    header: header,
    nexus: nexus,
    feedback: feedback,
    toneForGrade: toneForGrade,
    signed: signed,
    openDialog: openDialog,
    closeDialog: closeDialog,
    dialogOpen: dialogOpen,
    focus: focus
  };
})(window.CQ = window.CQ || {});
