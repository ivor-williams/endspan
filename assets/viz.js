/* Better Dying Fund report: interactive figures.
   - .bdf-zoom          : pan and zoom around a large image (the causal loop map)
   - .bdf-viz[data-viz] : charts drawn in SVG (grant-sizes, donor-map, horizons)
   Colours come from the brand palette (Figma "Primitives"). Every chart has direct labels,
   hover detail, a Replay button and a table view, so colour is never the only cue. */
(function () {
  'use strict';
  var C = { ink: '#0F2B26', ink2: '#4B605C', muted: '#5C6F6B', line: '#E6E9EC', fog: '#C7CDD1', mist: '#F4F6F7',
    indigo: '#4A6FA8', pine: '#2E6F5E', ochre: '#D4A24C', plum: '#7B6AA8', terracotta: '#C45A3C', blush: '#FDE3E0', sky: '#DCE7F4' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(parent, x, y, s, attrs) { var t = el('text', Object.assign({ x: x, y: y, fill: C.ink, 'font-size': 13 }, attrs || {}), parent); t.textContent = s; return t; }
  function h(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }

  /* ---------- shared tooltip ---------- */
  var tip = null;
  function showTip(evt, html) {
    if (!tip) { tip = h('div', 'bdf-tip', document.body); }
    tip.innerHTML = html; tip.style.display = 'block';
    var x = evt.clientX + 14, y = evt.clientY + 14, r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  /* ---------- frame with title, tools, table view ---------- */
  function frame(host, o) {
    var f = h('div', 'bdf-viz-frame', host);
    var head = h('div', 'bdf-viz-head', f);
    var tw = h('div', '', head); h('div', 'bdf-viz-title', tw, o.title); if (o.note) h('div', 'bdf-viz-note', tw, o.note);
    var tools = h('div', 'bdf-viz-tools', head);
    var replay = h('button', '', tools, 'Replay'); replay.type = 'button';
    var tbtn = h('button', '', tools, 'Table'); tbtn.type = 'button'; tbtn.setAttribute('aria-pressed', 'false');
    var body = h('div', 'bdf-viz-body', f);
    var table = h('div', 'bdf-viz-table', f); table.hidden = true; table.innerHTML = o.table;
    if (o.legend) h('div', 'bdf-viz-legend', f, o.legend);
    if (o.source) h('p', 'bdf-viz-source', f, o.source);
    tbtn.addEventListener('click', function () { var on = table.hidden; table.hidden = !on; body.hidden = on; tbtn.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    return { body: body, replay: replay };
  }
  function tableHTML(cols, rows) {
    return '<table class="bdf-chart-table"><thead><tr>' + cols.map(function (c, i) { return '<th' + (i ? ' class="r"' : '') + '>' + c + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="r"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function onView(node, fn) {
    if (reduce || !('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { fn(); io.disconnect(); } }); }, { threshold: 0.35 });
    io.observe(node);
  }

  /* ---------- 1. Grant sizes (360Giving) ---------- */
  function grantSizes(host) {
    var data = [
      ['Under £5k', 62, 5], ['£5k–25k', 23, 10], ['£25k–100k', 9, 20],
      ['£100k–500k', 5, 49], ['£500k–1m', 0.5, 8], ['Over £1m', 0.5, 7]];
    var F = frame(host, {
      title: 'Adult end-of-life care grants by size, 2015–2025: share of grants and share of money',
      legend: '<span><i style="background:' + C.indigo + '"></i>Share of grants (3,494)</span><span><i style="background:' + C.ochre + '"></i>Share of value (£92m)</span>',
      source: 'Source: 360Giving GrantNav. Adult end-of-life care grants, 2015–2025 (3,494 grants, £92m total). Grants over £500k are each under 1% of the count.',
      table: tableHTML(['Grant size', 'Share of grants', 'Share of value'], data.map(function (d) { return [d[0], (d[1] < 1 ? '<1' : d[1]) + '%', d[2] + '%']; }))
    });
    var W = 680, rowH = 46, top = 6, lab = 108, max = 70, H = top + data.length * rowH + 26;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Most grants are under £5k but carry 5% of the money; grants of £100k to £500k are 5% of grants and 49% of the money.' }, F.body);
    var sx = function (v) { return (W - lab - 60) * v / max; };
    [0, 20, 40, 60].forEach(function (g) { var x = lab + sx(g); el('line', { x1: x, x2: x, y1: top, y2: H - 22, stroke: C.line }, svg); txt(svg, x, H - 6, g + '%', { 'font-size': 11, fill: C.muted, 'text-anchor': 'middle' }); });
    var bars = [];
    data.forEach(function (d, i) {
      var y = top + i * rowH;
      txt(svg, lab - 10, y + 22, d[0], { 'text-anchor': 'end', fill: C.ink2 });
      [[d[1], C.indigo, 'of grants'], [d[2], C.ochre, 'of value']].forEach(function (b, j) {
        var by = y + 6 + j * 17, w = Math.max(sx(b[0]), 2);
        var r = el('rect', { x: lab, y: by, height: 14, width: 0, rx: 3, fill: b[1] }, svg);
        var t = txt(svg, lab + 6, by + 11.5, (b[0] < 1 ? '<1' : b[0]) + '%', { 'font-size': 12, fill: C.ink, opacity: 0 });
        var hit = el('rect', { x: 0, y: by - 2, width: W, height: 18, fill: 'transparent' }, svg);
        hit.addEventListener('mousemove', function (e) { showTip(e, '<b>' + d[0] + '</b>' + d[1] + (d[1] < 1 ? '' : '') + '% of grants · ' + d[2] + '% of value'); });
        hit.addEventListener('mouseleave', hideTip);
        bars.push({ r: r, t: t, w: w });
      });
    });
    function play() {
      bars.forEach(function (b, k) {
        b.r.style.transition = 'none'; b.r.setAttribute('width', 0); b.t.setAttribute('opacity', 0); b.t.setAttribute('x', lab + 6);
        setTimeout(function () {
          b.r.style.transition = reduce ? 'none' : 'width .7s cubic-bezier(.2,.7,.2,1)'; b.r.setAttribute('width', b.w);
          b.t.setAttribute('x', lab + b.w + 6); b.t.setAttribute('opacity', 1);
        }, reduce ? 0 : 60 + k * 70);
      });
    }
    F.replay.addEventListener('click', play); onView(host, play);
  }

  /* ---------- 2. Donor map ---------- */
  function donorMap(host) {
    // x: 0 = sustain the system, 1 = shift the system (scored); total and average grant in £
    var d = [
      { n: 'Masonic', a: 5e3, t: 4.7e6, x: .54, s: 'grant' },
      { n: 'Garfield Weston', a: 39e3, t: 4.0e6, x: .21, s: 'grant' },
      { n: 'National Lottery', a: 67e3, t: 20.4e6, x: .575, s: 'grant' },
      { n: 'True Colours', a: 78e3, t: 8.2e6, x: .36, s: 'self' },
      { n: 'Wolfson', a: 93e3, t: 11.6e6, x: .235, s: 'grant' },
      { n: 'City Bridge', a: 125e3, t: 1.5e6, x: .54, s: 'grant' },
      { n: 'Wellcome', a: 148e3, t: 4.0e6, x: .63, s: 'self' },
      { n: 'Pears', a: 176e3, t: 3.0e6, x: .45, s: 'self' },
      { n: 'Julia Rausing', a: 268e3, t: 11.8e6, x: .125, s: 'grant' },
      { n: 'Postcode Care', a: 400e3, t: 1.6e6, x: .27, s: 'self' }];
    var money = function (v) { return v >= 1e6 ? '£' + (v / 1e6).toFixed(1) + 'm' : '£' + Math.round(v / 1e3) + 'k'; };
    var F = frame(host, {
      title: 'Donor map: the 10 largest funders of adult palliative and end-of-life care, 2015–2025',
      note: 'Each funder is placed by whether its grants sustain the existing system or shift it (across) and how much capital it deployed (up). Hover over a dot to see its average grant and total.',
      legend: '<span><i style="background:' + C.indigo + '"></i>Scored from grant-level detail</span><span><i style="background:' + C.ochre + ';opacity:.55;outline:1.5px dashed ' + C.ochre + ';outline-offset:-1.5px"></i>Scored from the funder’s own description (provisional)</span><span>Dot area = average grant size · dots appear smallest to largest</span>',
      source: 'Source: 360Giving GrantNav and funder reports; Better Dying Fund analysis.',
      table: tableHTML(['Funder', 'Average grant', 'Total, 2015–2025', 'Scored from'], d.slice().sort(function (a, b) { return b.t - a.t; }).map(function (r) { return [r.n, money(r.a), money(r.t), r.s === 'grant' ? 'Grant detail' : 'Self-description']; }))
    });
    var W = 700, H = 470, L = 64, R = 24, T = 18, B = 58, pw = W - L - R, ph = H - T - B, ymax = 22e6;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Most of the largest funders sit on the sustaining side; the National Lottery is the largest by total capital.' }, F.body);
    var X = function (v) { return L + v * pw; }, Y = function (v) { return T + ph - ph * v / ymax; };
    [0, 5e6, 10e6, 15e6, 20e6].forEach(function (g) { el('line', { x1: L, x2: W - R, y1: Y(g), y2: Y(g), stroke: C.line }, svg); txt(svg, L - 8, Y(g) + 4, money(g).replace('.0', ''), { 'font-size': 11, fill: C.muted, 'text-anchor': 'end' }); });
    el('line', { x1: X(.45), x2: X(.45), y1: T, y2: T + ph, stroke: C.fog, 'stroke-dasharray': '4 4' }, svg);
    el('line', { x1: L, x2: W - R, y1: Y(7.1e6), y2: Y(7.1e6), stroke: C.fog, 'stroke-dasharray': '4 4' }, svg);
    txt(svg, W - R, Y(7.1e6) - 6, 'mean £7.1m', { 'font-size': 11, fill: C.muted, 'text-anchor': 'end' });
    txt(svg, L, H - 30, '← sustain the system', { 'font-size': 12, fill: C.ink2 });
    txt(svg, W - R, H - 30, 'shift the system →', { 'font-size': 12, fill: C.ink2, 'text-anchor': 'end' });
    txt(svg, L + pw / 2, H - 8, 'What they fund', { 'font-size': 12.5, 'font-weight': 500, 'text-anchor': 'middle' });
    var yl = txt(svg, 0, 0, 'Total capital, 2015–2025', { 'font-size': 12.5, 'font-weight': 500, 'text-anchor': 'middle', transform: 'translate(14 ' + (T + ph / 2) + ') rotate(-90)' });
    var rad = function (a) { return Math.max(4, Math.sqrt(a / 400e3) * 30); };
    var order = d.slice().sort(function (a, b) { return a.a - b.a; });
    var labelSide = { 'Julia Rausing': 'up', 'Postcode Care': 'left', 'Garfield Weston': 'left', 'Pears': 'down', 'Masonic': 'up' };
    var items = order.map(function (r) {
      var g = el('g', { opacity: 0 }, svg), cx = X(r.x), cy = Y(r.t), rr = rad(r.a);
      var c = el('circle', { cx: cx, cy: cy, r: rr, fill: r.s === 'grant' ? C.indigo : C.ochre, 'fill-opacity': r.s === 'grant' ? .8 : .45, stroke: r.s === 'grant' ? '#fff' : C.ochre, 'stroke-width': 1.5 }, g);
      if (r.s !== 'grant') c.setAttribute('stroke-dasharray', '4 3');
      var side = labelSide[r.n] || 'right', lx = cx + rr + 6, ly = cy + 4, anchor = 'start';
      if (side === 'left') { lx = cx - rr - 6; anchor = 'end'; }
      if (side === 'up') { lx = cx; ly = cy - rr - 8; anchor = 'middle'; }
      if (side === 'down') { lx = cx; ly = cy + rr + 16; anchor = 'middle'; }
      txt(g, lx, ly, r.n, { 'font-size': 12.5, 'text-anchor': anchor, 'font-weight': 500, fill: C.ink });
      var hit = el('circle', { cx: cx, cy: cy, r: Math.max(rr, 12), fill: 'transparent' }, g);
      hit.addEventListener('mousemove', function (e) { showTip(e, '<b>' + r.n + '</b>Average grant ' + money(r.a) + '<br>Total ' + money(r.t) + ', 2015–2025<span class="d">' + (r.s === 'grant' ? 'Scored from grant-level detail' : 'Provisional: scored from the funder’s own description') + '</span>'); });
      hit.addEventListener('mouseleave', hideTip);
      return { g: g, c: c, rr: rr };
    });
    function play() {
      items.forEach(function (it, k) {
        it.g.style.transition = 'none'; it.g.setAttribute('opacity', 0); it.c.setAttribute('r', reduce ? it.rr : 0);
        setTimeout(function () {
          it.g.style.transition = 'opacity .4s ease'; it.g.setAttribute('opacity', 1);
          it.c.style.transition = reduce ? 'none' : 'r .6s cubic-bezier(.2,.7,.2,1)'; it.c.setAttribute('r', it.rr);
        }, reduce ? 0 : 120 + k * 260);
      });
    }
    F.replay.addEventListener('click', play); onView(host, play);
  }

  /* ---------- 3. Three horizons ---------- */
  function horizons(host) {
    var F = frame(host, {
      title: 'Where capital sits across the three horizons of change',
      legend: '<span><i style="background:' + C.indigo + '"></i>Horizon 1: business as usual</span><span><i style="background:' + C.ochre + '"></i>Horizon 2: disruptive innovation</span><span><i style="background:' + C.pine + '"></i>Horizon 3: emerging future</span><span>Dot position = time horizon of investment · dot size = size of capital</span>',
      source: 'After Bill Sharpe, Three Horizons. Illustrative, not to scale.',
      table: tableHTML(['Capital', 'Horizon', 'Relative size'], [['Household', '1', 'Medium'], ['Public funding', '1', 'Very large'], ['Philanthropy', '1', 'Small'], ['Social finance', '1–2', 'Very small'], ['Venture', '2', 'Small'], ['Philanthropy', '3', 'Very small']])
    });
    var W = 700, H = 400, L = 12, R = 24, T = 20, B = 40;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Most capital sits on the first horizon. Very little reaches the second horizon, the missing middle where philanthropy could shift the system.' }, F.body);
    var band = el('rect', { x: 290, y: T, width: 230, height: H - T - B, fill: C.blush, rx: 6, opacity: 0 }, svg);
    var bandT = txt(svg, 302, T + 22, 'Missing middle', { fill: C.terracotta, 'font-weight': 700, 'font-size': 13, opacity: 0 });
    el('line', { x1: L, x2: L, y1: T, y2: H - B, stroke: C.ink2 }, svg);
    el('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, stroke: C.ink2 }, svg);
    txt(svg, L, H - B + 20, 'Today', { 'font-size': 12, fill: C.ink2 });
    txt(svg, W - R, H - B + 20, 'Time', { 'font-size': 12, fill: C.ink2, 'text-anchor': 'end' });
    var curves = {
      h1: { d: 'M12 92 C 140 110, 250 130, 350 200 S 520 330, 676 340', c: C.indigo, label: ['Horizon 1', 'Business as usual'], ly: 92 },
      h3: { d: 'M12 330 C 190 325, 300 300, 410 240 S 560 110, 676 100', c: C.pine, label: ['Horizon 3', 'Emerging future'], ly: 330 },
      h2: { d: 'M12 245 C 150 245, 210 200, 270 140 C 320 90, 360 75, 400 80 C 460 90, 495 180, 540 230 C 580 265, 620 270, 676 272', c: C.ochre, label: ['Horizon 2', 'Disruptive innovation'], ly: 245 } };
    var dots = { h1: [[0.06, 'Household', 14, 'up'], [0.18, 'Public funding', 30, 'up'], [0.33, 'Philanthropy', 9, 'down'], [0.45, 'Social finance', 5, 'right']], h3: [[0.37, 'Philanthropy', 5, 'down']], h2: [[0.36, 'Venture', 9, 'right']] };
    var parts = {};
    ['h1', 'h3', 'h2'].forEach(function (k) {
      var cv = curves[k], g = el('g', { opacity: 0 }, svg);
      var p = el('path', { d: cv.d, fill: 'none', stroke: cv.c, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
      var len = p.getTotalLength ? p.getTotalLength() : 800;
      var ds = (dots[k] || []).map(function (dd) {
        var pt = p.getPointAtLength(len * dd[0]), dg = el('g', { opacity: 0 }, g);
        var c = el('circle', { cx: pt.x, cy: pt.y, r: dd[2], fill: cv.c, stroke: '#fff', 'stroke-width': 2 }, dg);
        var lx = pt.x, ly = pt.y - dd[2] - 7, an = 'middle';
        if (dd[3] === 'right') { lx = pt.x + dd[2] + 7; ly = pt.y + 4; an = 'start'; }
        if (dd[3] === 'down') { ly = pt.y + dd[2] + 17; }
        txt(dg, lx, ly, dd[1], { 'font-size': 12.5, 'text-anchor': an, 'font-weight': 500 });
        var hit = el('circle', { cx: pt.x, cy: pt.y, r: Math.max(dd[2], 12), fill: 'transparent' }, dg);
        hit.addEventListener('mousemove', function (e) { showTip(e, '<b>' + dd[1] + '</b>' + cv.label[0] + ': ' + cv.label[1]); });
        hit.addEventListener('mouseleave', hideTip);
        return dg;
      });
      parts[k] = { g: g, p: p, len: len, dots: ds };
    });
    var timers = [];
    function play() {
      timers.forEach(clearTimeout); timers = [];
      band.setAttribute('opacity', 0); bandT.setAttribute('opacity', 0); band.style.transition = bandT.style.transition = 'none';
      ['h1', 'h3', 'h2'].forEach(function (k, i) {
        var P = parts[k]; P.g.setAttribute('opacity', 0);
        P.p.style.transition = 'none'; P.p.style.strokeDasharray = P.len; P.p.style.strokeDashoffset = reduce ? 0 : P.len;
        P.dots.forEach(function (dg) { dg.style.transition = 'none'; dg.setAttribute('opacity', 0); });
        timers.push(setTimeout(function () {
          P.g.setAttribute('opacity', 1);
          P.p.style.transition = reduce ? 'none' : 'stroke-dashoffset 2.2s ease'; P.p.style.strokeDashoffset = 0;
          P.dots.forEach(function (dg, j) { timers.push(setTimeout(function () { dg.style.transition = 'opacity .8s'; dg.setAttribute('opacity', 1); }, reduce ? 0 : 1400 + j * 440)); });
        }, reduce ? 0 : i * 3000));
      });
      timers.push(setTimeout(function () { band.style.transition = bandT.style.transition = 'opacity 1.6s'; band.setAttribute('opacity', .85); bandT.setAttribute('opacity', 1); }, reduce ? 0 : 9400));
    }
    svg.insertBefore(band, svg.firstChild);
    F.replay.addEventListener('click', play); onView(host, play);
  }

  /* ---------- zoomable image ---------- */
  function zoomer(fig) {
    var img = fig.querySelector('img'); if (!img) return;
    var box = document.createElement('div'); box.className = 'bdf-zoomer';
    img.parentNode.insertBefore(box, img); box.appendChild(img);
    var tools = h('div', 'bdf-zoom-tools', box);
    var bIn = h('button', '', tools, '+'), bOut = h('button', '', tools, '−'), bFit = h('button', 'wide', tools, 'Reset');
    bIn.setAttribute('aria-label', 'Zoom in'); bOut.setAttribute('aria-label', 'Zoom out');
    var s = 1, tx = 0, ty = 0, fit = 1;
    function apply() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'; }
    function clamp() {
      var bw = box.clientWidth, bh = box.clientHeight, iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      tx = iw < bw ? (bw - iw) / 2 : Math.min(0, Math.max(bw - iw, tx));
      ty = ih < bh ? (bh - ih) / 2 : Math.min(0, Math.max(bh - ih, ty));
    }
    function reset() { fit = Math.min(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight); s = fit; tx = ty = 0; clamp(); apply(); }
    function zoomAt(f, cx, cy) { var ns = Math.min(Math.max(s * f, fit), fit * 8); tx = cx - (cx - tx) * ns / s; ty = cy - (cy - ty) * ns / s; s = ns; clamp(); apply(); }
    box.addEventListener('wheel', function (e) { e.preventDefault(); var r = box.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    var pts = new Map(), last = null, pinch = 0;
    box.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; box.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); box.classList.add('dragging'); last = [e.clientX, e.clientY]; pinch = 0; });
    box.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { var p = Array.from(pts.values()), dist = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), r = box.getBoundingClientRect();
        if (pinch) zoomAt(dist / pinch, (p[0][0] + p[1][0]) / 2 - r.left, (p[0][1] + p[1][1]) / 2 - r.top); pinch = dist; return; }
      tx += e.clientX - last[0]; ty += e.clientY - last[1]; last = [e.clientX, e.clientY]; clamp(); apply();
    });
    function up(e) { pts.delete(e.pointerId); if (!pts.size) box.classList.remove('dragging'); pinch = 0; if (pts.size === 1) last = Array.from(pts.values())[0]; }
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('dblclick', function (e) { var r = box.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top); });
    bIn.addEventListener('click', function () { zoomAt(1.5, box.clientWidth / 2, box.clientHeight / 2); });
    bOut.addEventListener('click', function () { zoomAt(1 / 1.5, box.clientWidth / 2, box.clientHeight / 2); });
    bFit.addEventListener('click', reset);
    if (img.complete) reset(); else img.addEventListener('load', reset);
    window.addEventListener('resize', reset);
  }

  function init() {
    var map = { 'grant-sizes': grantSizes, 'donor-map': donorMap, 'horizons': horizons };
    document.querySelectorAll('.bdf-viz[data-viz]').forEach(function (n) { var f = map[n.getAttribute('data-viz')]; if (f && !n.children.length) f(n); });
    document.querySelectorAll('.bdf-zoom').forEach(zoomer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
