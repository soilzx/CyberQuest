/*
 * CyberQuest — network map
 *
 * Renders the organisation's network as an SVG schematic and exposes a
 * small API for missions: node states, selection, route highlighting and
 * animated packets. Two layouts exist: a wide one for desktops and a tall
 * one for narrow screens. The map switches between them when its
 * container is resized, and keeps its state when it does.
 */
(function (CQ) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var NARROW_BELOW = 620;

  /* ------------------------------------------------------------------ */
  /* Layouts                                                              */
  /* ------------------------------------------------------------------ */
  var LAYOUTS = {
    wide: {
      w: 1040, h: 500,
      zones: {
        internet: [0, 0, 150, 500],
        perimeter: [160, 0, 130, 500],
        internal: [300, 0, 440, 500],
        data: [750, 0, 290, 500]
      },
      nodes: {
        ext1: [75, 85], ext2: [75, 195], ext3: [75, 315], ext4: [75, 425],
        gateway: [225, 255], core: [345, 255],
        web: [420, 120], auth: [555, 120], itops: [690, 120],
        ws114: [420, 390], ws207: [555, 390], ws311: [690, 390],
        db: [830, 120], vault: [965, 120], ai: [830, 390]
      },
      bus: [[345, 255], [990, 255]],
      route: { ext: 'hvh', trunk: 'hvh', drop: 'hv', peer: 'hvh' }
    },
    tall: {
      w: 400, h: 820,
      zones: {
        internet: [0, 0, 400, 112],
        perimeter: [0, 122, 400, 90],
        internal: [0, 222, 400, 370],
        data: [0, 602, 400, 218]
      },
      nodes: {
        ext1: [50, 58], ext2: [150, 58], ext3: [250, 58], ext4: [350, 58],
        gateway: [200, 170], core: [200, 262],
        web: [100, 340], auth: [300, 340],
        itops: [100, 440], ws114: [300, 440],
        ws207: [100, 540], ws311: [300, 540],
        db: [100, 670], ai: [300, 670], vault: [100, 770]
      },
      bus: [[200, 262], [200, 740]],
      route: { ext: 'vhv', trunk: 'vhv', drop: 'vh', peer: 'vhv' }
    }
  };

  var PLATE = { w: 126, h: 54 };
  var CORE_PLATE = { w: 88, h: 34 };

  var STATE_TAGS = {
    alert: 'Suspicious',
    compromised: 'Compromised',
    isolated: 'Isolated',
    secure: 'Secured'
  };

  /* ------------------------------------------------------------------ */
  /* Icons: drawn on a 20 × 20 grid, stroked with currentColor           */
  /* ------------------------------------------------------------------ */
  var ICONS = {
    server: 'M3 3h14v6H3zM3 11h14v6H3zM6 6h.01M6 14h.01M10 6h4M10 14h4',
    auth: 'M7 10a3.5 3.5 0 1 1 0 .01M10.5 10H18M15 10v3M17.5 10v2',
    database: 'M3 5c0-1.7 3.1-2.5 7-2.5s7 .8 7 2.5-3.1 2.5-7 2.5S3 6.7 3 5zM3 5v10c0 1.7 3.1 2.5 7 2.5s7-.8 7-2.5V5M3 10c0 1.7 3.1 2.5 7 2.5s7-.8 7-2.5',
    workstation: 'M2.5 3.5h15v10h-15zM7 17.5h6M10 13.5v4',
    gateway: 'M2.5 3.5h15v13h-15zM2.5 8h15M2.5 12.5h15M8 3.5V8M13 8v4.5M7 12.5v4',
    switch: 'M2.5 6h15v8h-15zM5.5 10h.01M8.5 10h.01M11.5 10h.01M14.5 10h.01',
    vault: 'M3 3h14v14H3zM10 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M10 7v1.2M10 11.8V13M5 17v1.5M15 17v1.5',
    ops: 'M2.5 4h15v12h-15zM5.5 8l2.5 2-2.5 2M10 12.5h4',
    ai: 'M5.5 5.5h9v9h-9zM8 8h4v4H8zM8 2.5v3M12 2.5v3M8 14.5v3M12 14.5v3M2.5 8h3M2.5 12h3M14.5 8h3M14.5 12h3'
  };

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVG_NS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  /* ------------------------------------------------------------------ */
  /* Orthogonal routing                                                   */
  /* ------------------------------------------------------------------ */
  function elbow(a, b, mode) {
    var ax = a[0], ay = a[1], bx = b[0], by = b[1];
    if (ax === bx || ay === by) return [a, b];
    switch (mode) {
      case 'hv': return [a, [bx, ay], b];
      case 'vh': return [a, [ax, by], b];
      case 'vhv': { var my = (ay + by) / 2; return [a, [ax, my], [bx, my], b]; }
      default: { var mx = (ax + bx) / 2; return [a, [mx, ay], [mx, by], b]; }
    }
  }

  function pointsToPath(pts) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
  }

  function polylineLength(pts) {
    var segs = [];
    var total = 0;
    for (var i = 1; i < pts.length; i++) {
      var len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      segs.push(len);
      total += len;
    }
    return { segs: segs, total: total };
  }

  function pointAt(pts, info, t) {
    var target = info.total * t;
    for (var i = 0; i < info.segs.length; i++) {
      if (target <= info.segs[i] || i === info.segs.length - 1) {
        var f = info.segs[i] ? Math.min(1, target / info.segs[i]) : 0;
        var a = pts[i], b = pts[i + 1];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      target -= info.segs[i];
    }
    return pts[pts.length - 1];
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------------------ */
  /* Map factory                                                          */
  /* ------------------------------------------------------------------ */
  function createMap(container, options) {
    var opts = Object.assign({ interactive: true, ambient: true, label: 'Network map' }, options || {});
    var topo = CQ.scenarios.network;
    var nodeIndex = {};
    topo.nodes.forEach(function (n) { nodeIndex[n.id] = n; });

    var state = {
      layout: null,
      nodeStates: {},       // id -> state
      externals: {},        // slot -> label
      selected: null,
      marked: {},           // id -> true (involved in an open incident)
      route: null,
      routeTone: 'amber',
      ambient: !!opts.ambient,
      selectHandlers: []
    };

    var svg, layers = {}, nodeEls = {}, linkEls = {}, linkPts = {};
    var packets = [];
    var rafId = null;
    var ambientTimer = null;
    var resizeObserver = null;
    var destroyed = false;

    function nodePos(id) { return LAYOUTS[state.layout].nodes[id]; }

    function linkMode(link) {
      var r = LAYOUTS[state.layout].route;
      if (/^ext/.test(link.from)) return r.ext;
      if (link.from === 'gateway') return r.trunk;
      if (link.from === 'core') return r.drop;
      return r.peer;
    }

    function computeLinkPoints(link) {
      return elbow(nodePos(link.from), nodePos(link.to), linkMode(link));
    }

    function findLink(a, b) {
      for (var i = 0; i < topo.links.length; i++) {
        var l = topo.links[i];
        if (l.from === a && l.to === b) return { link: l, reverse: false };
        if (l.from === b && l.to === a) return { link: l, reverse: true };
      }
      return null;
    }

    function routePoints(route) {
      var pts = [];
      for (var i = 1; i < route.length; i++) {
        var found = findLink(route[i - 1], route[i]);
        if (!found) continue;
        var seg = linkPts[found.link.id].slice();
        if (found.reverse) seg.reverse();
        if (pts.length) seg.shift();
        pts = pts.concat(seg);
      }
      return pts;
    }

    function routeLinkIds(route) {
      var ids = [];
      for (var i = 1; i < (route || []).length; i++) {
        var found = findLink(route[i - 1], route[i]);
        if (found) ids.push(found.link.id);
      }
      return ids;
    }

    /* ---------------- render ---------------- */
    function render() {
      var L = LAYOUTS[state.layout];
      container.textContent = '';
      packets = [];
      svg = el('svg', {
        viewBox: '0 0 ' + L.w + ' ' + L.h,
        class: 'netmap netmap--' + state.layout,
        role: 'group',
        'aria-label': opts.label,
        preserveAspectRatio: 'xMidYMid meet'
      });
      container.appendChild(svg);

      layers.zones = el('g', { class: 'netmap-zones', 'aria-hidden': 'true' }, svg);
      layers.links = el('g', { class: 'netmap-links', 'aria-hidden': 'true' }, svg);
      layers.packets = el('g', { class: 'netmap-packets', 'aria-hidden': 'true' }, svg);
      layers.nodes = el('g', { class: 'netmap-nodes' }, svg);

      // Zones
      topo.zones.forEach(function (z) {
        var r = L.zones[z.id];
        if (!r) return;
        var g = el('g', { class: 'zone zone--' + z.id }, layers.zones);
        el('rect', { x: r[0] + 0.5, y: r[1] + 0.5, width: r[2] - 1, height: r[3] - 1, rx: 2 }, g);
        var label = el('text', { x: r[0] + 12, y: r[1] + 20, class: 'zone-label' }, g);
        label.textContent = z.label;
      });

      // Backbone bus
      var bus = L.bus;
      el('path', { d: pointsToPath(bus), class: 'bus' }, layers.links);

      // Links
      linkEls = {}; linkPts = {};
      topo.links.forEach(function (link) {
        var pts = computeLinkPoints(link);
        linkPts[link.id] = pts;
        var p = el('path', { d: pointsToPath(pts), class: 'link' + (link.kind === 'telemetry' ? ' link--telemetry' : '') }, layers.links);
        p.dataset.id = link.id;
        linkEls[link.id] = p;
      });

      // Nodes
      nodeEls = {};
      topo.externals.forEach(function (slot) { renderExternal(slot); });
      topo.nodes.forEach(function (n) { renderNode(n); });

      applyAll();
    }

    function renderNode(n) {
      var pos = nodePos(n.id);
      var isCore = n.type === 'switch';
      var size = isCore ? CORE_PLATE : PLATE;
      var g = el('g', {
        class: 'node node--' + n.type,
        transform: 'translate(' + pos[0] + ' ' + pos[1] + ')'
      }, layers.nodes);
      g.dataset.id = n.id;
      if (opts.interactive && !isCore) {
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
      }
      var hx = size.w / 2, hy = size.h / 2;
      el('rect', { class: 'node-ring', x: -hx - 5, y: -hy - 5, width: size.w + 10, height: size.h + 10, rx: 7 }, g);
      el('rect', { class: 'node-plate', x: -hx, y: -hy, width: size.w, height: size.h, rx: 4 }, g);
      el('rect', { class: 'node-strip', x: -hx, y: -hy, width: 3, height: size.h, rx: 1 }, g);

      if (isCore) {
        var icon = el('path', { class: 'node-icon', d: ICONS.switch, transform: 'translate(' + (-hx + 10) + ' -10)' }, g);
        icon.setAttribute('aria-hidden', 'true');
        var t = el('text', { class: 'node-name', x: -hx + 36, y: 4 }, g);
        t.textContent = 'Core';
      } else {
        el('path', { class: 'node-icon', d: ICONS[n.type] || ICONS.server, transform: 'translate(' + (-hx + 10) + ' -10)' }, g);
        var name = el('text', { class: 'node-name', x: -hx + 38, y: -3 }, g);
        name.textContent = n.name;
        var ip = el('text', { class: 'node-ip', x: -hx + 38, y: 14 }, g);
        ip.textContent = n.ip;
      }
      var tag = el('text', { class: 'node-tag', x: hx, y: -hy - 9, 'text-anchor': 'end' }, g);
      tag.textContent = '';
      var mark = el('circle', { class: 'node-mark', cx: hx - 1, cy: -hy + 1, r: 5 }, g);
      mark.setAttribute('aria-hidden', 'true');

      if (opts.interactive && !isCore) {
        g.addEventListener('click', function () { fireSelect(n.id); });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireSelect(n.id); }
        });
      }
      nodeEls[n.id] = g;
    }

    function renderExternal(slot) {
      var pos = nodePos(slot);
      var g = el('g', { class: 'node node--external', transform: 'translate(' + pos[0] + ' ' + pos[1] + ')' }, layers.nodes);
      g.dataset.id = slot;
      el('rect', { class: 'node-ring', x: -40, y: -22, width: 80, height: 50, rx: 6 }, g);
      el('path', { class: 'ext-diamond', d: 'M0 -9 L9 0 L0 9 L-9 0 Z' }, g);
      el('rect', { class: 'node-strip', x: -2, y: -2, width: 0, height: 0 }, g);
      var label = el('text', { class: 'node-ip ext-label', x: 0, y: 24, 'text-anchor': 'middle' }, g);
      label.textContent = '';
      var tag = el('text', { class: 'node-tag', x: 0, y: -16, 'text-anchor': 'middle' }, g);
      tag.textContent = '';
      if (opts.interactive) {
        g.addEventListener('click', function () { if (state.externals[slot]) fireSelect(slot); });
        g.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && state.externals[slot]) { e.preventDefault(); fireSelect(slot); }
        });
      }
      nodeEls[slot] = g;
    }

    function fireSelect(id) {
      state.selectHandlers.forEach(function (fn) { fn(id); });
    }

    /* ---------------- state application ---------------- */
    function nodeLabel(id) {
      var n = nodeIndex[id];
      var st = state.nodeStates[id] || 'normal';
      var status = STATE_TAGS[st] || 'Normal';
      if (n) return n.name + ', ' + n.ip + ', ' + n.role + '. Status: ' + status + (state.marked[id] ? '. Has an open alert' : '');
      return 'External address ' + (state.externals[id] || '') + '. Status: ' + status;
    }

    function applyNode(id) {
      var g = nodeEls[id];
      if (!g) return;
      var st = state.nodeStates[id] || 'normal';
      var isExt = /^ext/.test(id);
      var cls = 'node node--' + (nodeIndex[id] ? nodeIndex[id].type : 'external') + ' is-' + st;
      if (state.selected === id) cls += ' is-selected';
      if (state.marked[id]) cls += ' is-marked';
      if (isExt && !state.externals[id]) cls += ' is-hidden';
      g.setAttribute('class', cls);
      var tag = g.querySelector('.node-tag');
      if (tag) tag.textContent = STATE_TAGS[st] || '';
      if (isExt) {
        g.querySelector('.ext-label').textContent = state.externals[id] || '';
        if (state.externals[id] && opts.interactive) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); }
        else { g.removeAttribute('tabindex'); g.removeAttribute('role'); }
      }
      if (g.hasAttribute('role')) {
        g.setAttribute('aria-label', nodeLabel(id));
        g.setAttribute('aria-pressed', state.selected === id ? 'true' : 'false');
      }
    }

    function applyLinks() {
      var active = {};
      routeLinkIds(state.route).forEach(function (id) { active[id] = true; });
      topo.links.forEach(function (link) {
        var p = linkEls[link.id];
        if (!p) return;
        var cut = state.nodeStates[link.from] === 'isolated' || state.nodeStates[link.to] === 'isolated';
        var hidden = (/^ext/.test(link.from) && !state.externals[link.from]);
        var cls = 'link';
        if (link.kind === 'telemetry') cls += ' link--telemetry';
        if (cut) cls += ' is-cut';
        if (hidden) cls += ' is-hidden';
        if (active[link.id]) cls += ' is-active tone-' + state.routeTone;
        p.setAttribute('class', cls);
      });
    }

    function applyAll() {
      Object.keys(nodeEls).forEach(applyNode);
      applyLinks();
    }

    /* ---------------- packets ---------------- */
    function spawnPacket(route, tone, duration) {
      if (!svg || reducedMotion()) return;
      var pts = routePoints(route);
      if (pts.length < 2) return;
      var info = polylineLength(pts);
      var dot = el('rect', { class: 'packet tone-' + (tone || 'ambient'), width: 7, height: 3, rx: 1, x: -3.5, y: -1.5 }, layers.packets);
      packets.push({ pts: pts, info: info, el: dot, start: performance.now(), dur: duration || Math.max(700, info.total * 2.2) });
      if (!rafId) rafId = requestAnimationFrame(step);
    }

    function step(ts) {
      rafId = null;
      if (destroyed) return;
      packets = packets.filter(function (p) {
        var t = (ts - p.start) / p.dur;
        if (t >= 1) { p.el.remove(); return false; }
        var pt = pointAt(p.pts, p.info, Math.max(0, t));
        // Orient the dash along its current segment.
        var ahead = pointAt(p.pts, p.info, Math.min(1, t + 0.01));
        var vertical = Math.abs(ahead[1] - pt[1]) > Math.abs(ahead[0] - pt[0]);
        p.el.setAttribute('transform', 'translate(' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1) + ')' + (vertical ? ' rotate(90)' : ''));
        return true;
      });
      if (packets.length) rafId = requestAnimationFrame(step);
    }

    function routeIsOpen(route) {
      return route.every(function (id) {
        if (state.nodeStates[id] === 'isolated') return false;
        if (/^ext/.test(id) && !state.externals[id]) return false;
        return true;
      });
    }

    function ambientTick() {
      if (!state.ambient || document.hidden || packets.length > 6) return;
      var routes = topo.ambientRoutes.filter(routeIsOpen);
      if (!routes.length) return;
      var r = routes[Math.floor(Math.random() * routes.length)];
      if (Math.random() < 0.5) r = r.slice().reverse();
      spawnPacket(r, 'ambient');
    }

    function startAmbient() {
      stopAmbient();
      if (reducedMotion()) return;
      ambientTimer = setInterval(ambientTick, 850);
    }

    function stopAmbient() {
      if (ambientTimer) clearInterval(ambientTimer);
      ambientTimer = null;
    }

    /* ---------------- layout ---------------- */
    function chooseLayout() {
      var w = container.clientWidth || 1000;
      var next = w < NARROW_BELOW ? 'tall' : 'wide';
      if (next !== state.layout) {
        state.layout = next;
        render();
      }
    }

    state.layout = (container.clientWidth || 1000) < NARROW_BELOW ? 'tall' : 'wide';
    render();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(function () { chooseLayout(); });
      resizeObserver.observe(container);
    }
    if (state.ambient) startAmbient();

    /* ---------------- public API ---------------- */
    return {
      onSelect: function (fn) {
        state.selectHandlers.push(fn);
        return function () {
          var i = state.selectHandlers.indexOf(fn);
          if (i >= 0) state.selectHandlers.splice(i, 1);
        };
      },
      setNodeState: function (id, st) {
        if (!id) return;
        state.nodeStates[id] = st || 'normal';
        applyNode(id);
        applyLinks();
      },
      getNodeState: function (id) { return state.nodeStates[id] || 'normal'; },
      setExternal: function (slot, label) {
        if (!slot) return;
        if (label) state.externals[slot] = label; else delete state.externals[slot];
        applyNode(slot);
        applyLinks();
      },
      setMarked: function (ids) {
        state.marked = {};
        (ids || []).forEach(function (id) { state.marked[id] = true; });
        Object.keys(nodeEls).forEach(applyNode);
      },
      select: function (id) {
        state.selected = id || null;
        Object.keys(nodeEls).forEach(applyNode);
      },
      highlightRoute: function (route, tone) {
        state.route = route || null;
        state.routeTone = tone || 'amber';
        applyLinks();
      },
      send: function (route, o) {
        var conf = Object.assign({ tone: 'amber', count: 1, gap: 220, duration: 0 }, o || {});
        for (var i = 0; i < conf.count; i++) {
          (function (delay) {
            setTimeout(function () { if (!destroyed) spawnPacket(route, conf.tone, conf.duration); }, delay);
          })(i * conf.gap);
        }
      },
      setAmbient: function (on) {
        state.ambient = !!on;
        if (state.ambient) startAmbient(); else stopAmbient();
      },
      reset: function () {
        packets.forEach(function (p) { p.el.remove(); });
        packets = [];
        state.nodeStates = {};
        state.externals = {};
        state.selected = null;
        state.marked = {};
        state.route = null;
        applyAll();
      },
      focusNode: function (id) {
        var g = nodeEls[id];
        if (g && g.focus) g.focus();
      },
      destroy: function () {
        destroyed = true;
        stopAmbient();
        if (rafId) cancelAnimationFrame(rafId);
        if (resizeObserver) resizeObserver.disconnect();
        container.textContent = '';
      }
    };
  }

  CQ.network = { create: createMap, layouts: LAYOUTS, elbow: elbow };
})(window.CQ = window.CQ || {});
