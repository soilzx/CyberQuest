/*
 * CyberQuest — UI helpers
 *
 * DOM construction and the persistent parts of the console: status bar,
 * alert queue, event log, NEXUS feed, dialogs and toasts.
 * All text goes through textContent; nothing user- or scenario-supplied is
 * ever written with innerHTML.
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

  function svgIcon(path, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 20 20');
    s.setAttribute('class', 'icon ' + (cls || ''));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    s.appendChild(p);
    return s;
  }

  var ICON = {
    soundOn: 'M3 7.5h3L10 4v12l-4-3.5H3zM13 7a4 4 0 0 1 0 6M15.5 4.5a7.5 7.5 0 0 1 0 11',
    soundOff: 'M3 7.5h3L10 4v12l-4-3.5H3zM13 7.5l5 5M18 7.5l-5 5',
    restart: 'M4 10a6 6 0 1 0 1.8-4.3M4 3.5v3h3',
    check: 'M4 10.5l4 4 8-9',
    cross: 'M5 5l10 10M15 5L5 15',
    half: 'M4 10h12'
  };

  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------------------ */
  /* Announcer & toasts                                                   */
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
  /* Status bar                                                           */
  /* ------------------------------------------------------------------ */
  var statusbar = {
    setMetrics: function (s) {
      setMeter('#m-integrity', s.integrity, s.integrity < 30 ? 'critical' : s.integrity < 60 ? 'warn' : 'ok');
      setMeter('#m-stability', s.stability, s.stability < 30 ? 'critical' : s.stability < 60 ? 'warn' : 'ok');
      var lvl = Math.round(s.threat);
      var label = CQ.game.threatLabel(lvl);
      var wrap = $('#m-threat');
      if (wrap) {
        $('.metric-value', wrap).textContent = label;
        var steps = Math.min(5, Math.floor(lvl / 20) + 1);
        Array.prototype.forEach.call(wrap.querySelectorAll('.threat-seg'), function (seg, i) {
          seg.classList.toggle('is-on', i < steps);
        });
        wrap.dataset.level = label.toLowerCase();
        wrap.setAttribute('aria-label', 'Threat level ' + label + ', ' + lvl + ' out of 100');
      }
    },
    setScore: function (score, delta) {
      var el = $('#c-score');
      if (!el) return;
      el.textContent = String(score);
      if (delta) {
        var host = el.parentNode;
        var d = h('span', { class: 'score-delta ' + (delta > 0 ? 'is-gain' : 'is-loss'), 'aria-hidden': 'true' }, (delta > 0 ? '+' : '') + delta);
        host.appendChild(d);
        setTimeout(function () { d.remove(); }, 1300);
      }
    },
    setTime: function (ms) {
      var el = $('#c-time');
      if (el) el.textContent = formatTime(ms);
    },
    setMission: function (index, progress) {
      var items = document.querySelectorAll('#mission-rail .mr-item');
      Array.prototype.forEach.call(items, function (li, i) {
        li.classList.toggle('is-active', i === index);
        li.classList.toggle('is-done', i < index);
        if (i === index) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        var p = li.querySelector('.mr-progress');
        if (p) p.textContent = i === index ? (progress || '') : i < index ? 'Done' : '';
      });
    },
    setProgress: function (text) {
      var p = document.querySelector('#mission-rail .mr-item.is-active .mr-progress');
      if (p) p.textContent = text;
    }
  };

  function setMeter(sel, value, tone) {
    var wrap = $(sel);
    if (!wrap) return;
    var v = Math.round(value);
    $('.metric-value', wrap).textContent = String(v);
    $('.metric-fill', wrap).style.transform = 'scaleX(' + (v / 100) + ')';
    wrap.dataset.tone = tone;
    var bar = $('.metric-bar', wrap);
    if (bar) bar.setAttribute('aria-valuenow', String(v));
  }

  /* ------------------------------------------------------------------ */
  /* Queue and event log                                                  */
  /* ------------------------------------------------------------------ */
  /**
   * items: [{ id, time, title, meta, status, tone, disabled, risk }]
   */
  function renderQueue(items, opts) {
    var list = $('#queue-list');
    var o = opts || {};
    clear(list);
    if (!items.length) {
      list.appendChild(h('li', { class: 'queue-empty' }, o.emptyText || 'No open alerts.'));
    }
    items.forEach(function (item) {
      var selected = o.selectedId === item.id;
      var btn = h('button', {
        type: 'button',
        class: 'queue-item tone-' + (item.tone || 'open') + (selected ? ' is-selected' : ''),
        disabled: item.disabled ? true : null,
        aria: { pressed: selected ? 'true' : 'false' },
        data: { id: item.id },
        on: { click: function () { if (o.onSelect) o.onSelect(item.id); } }
      },
        h('span', { class: 'qi-top' },
          h('span', { class: 'qi-time mono' }, item.time || ''),
          item.risk != null ? h('span', { class: 'qi-risk mono', title: 'NEXUS risk score' }, 'Risk ' + item.risk) : null
        ),
        h('span', { class: 'qi-title' }, item.title),
        item.meta ? h('span', { class: 'qi-meta mono' }, item.meta) : null,
        h('span', { class: 'qi-status' }, item.status || 'Open')
      );
      list.appendChild(h('li', null, btn));
    });
    var count = $('#queue-count');
    if (count) {
      var open = items.filter(function (i) { return i.tone === 'open' || i.tone === 'active'; }).length;
      count.textContent = items.length ? open + ' open' : '';
    }
  }

  function log(text, tone, stamp) {
    var list = $('#event-log');
    if (!list) return;
    var li = h('li', { class: 'log-item tone-' + (tone || 'neutral') },
      h('span', { class: 'log-time mono' }, stamp || formatTime(CQ.app ? CQ.app.elapsed() : 0)),
      h('span', { class: 'log-text' }, text));
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 40) list.removeChild(list.lastChild);
  }

  function clearLog() { clear($('#event-log')); }

  /* ------------------------------------------------------------------ */
  /* NEXUS feed                                                           */
  /* ------------------------------------------------------------------ */
  var nexus = {
    say: function (text, kind, extra) {
      var feed = $('#nexus-feed');
      if (!feed) return null;
      var li = h('li', { class: 'nx-msg kind-' + (kind || 'info') },
        h('span', { class: 'nx-meta mono' }, nexusKindLabel(kind) + '  ' + formatTime(CQ.app ? CQ.app.elapsed() : 0)),
        h('p', { class: 'nx-text' }, text),
        extra || null);
      feed.appendChild(li);
      while (feed.children.length > 30) feed.removeChild(feed.firstChild);
      feed.scrollTop = feed.scrollHeight;
      var latest = $('#nexus-latest');
      if (latest) latest.textContent = text;
      return li;
    },
    status: function (text, busy) {
      var s = $('#nexus-status');
      if (!s) return;
      s.textContent = text;
      s.classList.toggle('is-busy', !!busy);
    },
    clear: function () { clear($('#nexus-feed')); }
  };

  function nexusKindLabel(kind) {
    return { analysis: 'Analysis', hint: 'Hint', verdict: 'Review', warn: 'Warning', model: 'Defender model' }[kind] || 'NEXUS';
  }

  /* ------------------------------------------------------------------ */
  /* Risk gauge                                                           */
  /* ------------------------------------------------------------------ */
  function riskGauge(analysis, opts) {
    var o = opts || {};
    var t = CQ.ai.thresholds;
    var tone = analysis.risk >= t.contain ? 'high' : analysis.risk >= t.investigate ? 'mid' : 'low';
    var marker = h('span', { class: 'gauge-marker', style: 'left:' + analysis.risk + '%' });
    var gauge = h('div', { class: 'gauge tone-' + tone + (o.compact ? ' is-compact' : '') },
      h('div', { class: 'gauge-head' },
        h('span', { class: 'gauge-label' }, o.label || 'NEXUS risk score'),
        h('span', { class: 'gauge-value mono' }, String(analysis.risk), h('span', { class: 'gauge-max' }, '/100'))),
      h('div', {
        class: 'gauge-track', role: 'img',
        'aria-label': 'Risk score ' + analysis.risk + ' out of 100. Investigate from ' + t.investigate + ', contain from ' + t.contain + '.'
      },
        h('span', { class: 'gauge-band band-low', style: 'width:' + t.investigate + '%' }),
        h('span', { class: 'gauge-band band-mid', style: 'width:' + (t.contain - t.investigate) + '%' }),
        h('span', { class: 'gauge-band band-high', style: 'width:' + (100 - t.contain) + '%' }),
        marker),
      o.compact ? null : h('div', { class: 'gauge-scale mono', 'aria-hidden': 'true' },
        h('span', null, 'Allow'), h('span', null, 'Investigate'), h('span', null, 'Contain')),
      o.compact ? null : h('p', { class: 'gauge-note' }, 'Sum of rule weights. Not a probability.'));
    return gauge;
  }

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
   * openDialog({ title, kicker, body, actions:[{label, primary, onClick, keep}], dismissible, className })
   * An action closes the dialog unless keep is true.
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
    var titleId = 'dialog-title';
    if (conf.kicker) dlg.appendChild(h('p', { class: 'dialog-kicker mono' }, conf.kicker));
    dlg.appendChild(h('h2', { id: titleId, class: 'dialog-title' }, conf.title));
    if (conf.body) dlg.appendChild(h('div', { class: 'dialog-body' }, conf.body));
    if (conf.actions && conf.actions.length) {
      var row = h('div', { class: 'dialog-actions' });
      conf.actions.forEach(function (a) {
        row.appendChild(h('button', {
          type: 'button',
          class: 'btn ' + (a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-secondary'),
          'data-autofocus': a.autofocus ? 'true' : null,
          on: { click: function () { if (!a.keep) closeDialog(true); if (a.onClick) a.onClick(); } }
        }, a.label));
      });
      dlg.appendChild(row);
    }
    if (dialogState.dismissible) {
      dlg.appendChild(h('button', {
        type: 'button', class: 'dialog-close', aria: { label: 'Close' },
        on: { click: function () { closeDialog(); } }
      }, svgIcon(ICON.cross)));
    }
    dlg.setAttribute('aria-labelledby', titleId);
    overlay.hidden = false;
    document.addEventListener('keydown', onDialogKey, true);
    var target = dlg.querySelector('[data-autofocus="true"]') || dlg.querySelector('.btn-primary') || focusables(dlg)[0];
    setTimeout(function () { if (target) target.focus(); }, 30);
    return closeDialog;
  }

  // silent = true: closed by an action, so don't fire onClose.
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

  /* ------------------------------------------------------------------ */
  /* Small builders reused by missions                                    */
  /* ------------------------------------------------------------------ */
  function kbd(key) { return h('kbd', { class: 'kbd', 'aria-hidden': 'true' }, key); }

  function gradeLabel(grade) {
    return { best: 'Correct call', acceptable: 'Acceptable', partial: 'Partly right', wrong: 'Wrong call', missed: 'Missed' }[grade] || grade;
  }

  function gradeTone(grade) {
    return { best: 'good', acceptable: 'good', partial: 'warn', wrong: 'bad', missed: 'bad' }[grade] || 'neutral';
  }

  function outcomeBlock(grade, points, text, effects) {
    var fx = [];
    if (effects) {
      if (effects.integrity) fx.push('Integrity ' + signed(effects.integrity));
      if (effects.stability) fx.push('Stability ' + signed(effects.stability));
      if (effects.threat) fx.push('Threat ' + signed(effects.threat));
    }
    var tone = gradeTone(grade);
    return h('div', { class: 'outcome tone-' + tone, role: 'status' },
      h('div', { class: 'outcome-head' },
        svgIcon(tone === 'good' ? ICON.check : tone === 'bad' ? ICON.cross : ICON.half, 'outcome-icon'),
        h('span', { class: 'outcome-grade' }, gradeLabel(grade)),
        h('span', { class: 'outcome-points mono' }, signed(points) + ' pts')),
      h('p', { class: 'outcome-text' }, text),
      fx.length ? h('p', { class: 'outcome-fx mono' }, fx.join('   ')) : null);
  }

  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)); }

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
    statusbar: statusbar,
    renderQueue: renderQueue,
    log: log,
    clearLog: clearLog,
    nexus: nexus,
    riskGauge: riskGauge,
    openDialog: openDialog,
    closeDialog: closeDialog,
    dialogOpen: dialogOpen,
    kbd: kbd,
    gradeLabel: gradeLabel,
    gradeTone: gradeTone,
    outcomeBlock: outcomeBlock,
    signed: signed
  };
})(window.CQ = window.CQ || {});
