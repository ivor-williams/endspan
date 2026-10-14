/* Better Dying Fund home page:
   - sections fade in (copy, watercolour shapes, labelled nodes) when they come into view
   - sweeping lines between nodes draw themselves as you scroll
   - the "Keep me updated" email form */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var system = document.getElementById('system');
  var svg = system && system.querySelector('.bdf-lines');
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- 1. Sections come into view ---------- */
  var secs = [].slice.call(document.querySelectorAll('[data-sec]'));
  if (reduce || !('IntersectionObserver' in window)) {
    secs.forEach(function (s) { s.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.22, rootMargin: '0px 0px -8% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ---------- 2. Lines between nodes ----------
     [from, to, bend, style]. bend pushes the curve sideways (as a share of the page width);
     'soft' lines are dotted and fade in rather than draw. */
  var EDGES = [
    // people and families at home
    ['L0', 'car', 0.10], ['car', 'fam', -0.14, 'soft'], ['R0', 'gp', -0.08], ['car', 'dn', 0.16], ['fam', 'dou', -0.20],
    ['gp', 'ch', 0.12], ['fam', 'n1', -0.16],
    // care homes, nursing, hospices
    ['dn', 'n1', 0.10], ['dn', 'cns', 0.18], ['ch', 'hosp', -0.14], ['ch', 'la', 0.20, 'soft'], ['ch', 'n2', 0.14],
    ['hos', 'n2', -0.12], ['hos', 'cn', 0.12], ['hos', 'cns', -0.18], ['dou', 'cn', -0.10, 'soft'], ['L1', 'dou', 0.12],
    // the system around them
    ['hos', 'icb', 0.20, 'soft'], ['cns', 'n3', 0.12], ['icb', 'hosp', 0.12], ['icb', 'la', -0.16], ['hosp', 'n3', -0.14, 'soft'],
    ['hos', 'fdn', -0.14], ['fdn', 'n4', 0.12], ['la', 'n4', -0.12], ['R1', 'hosp', -0.10, 'soft'],
    // funders and the fund
    ['fdn', 'phil', 0.18], ['phil', 'n5', -0.12], ['cn', 'vol', 0.16, 'soft'], ['vol', 'phil', -0.10],
    ['L2', 'n5', 0.10], ['n2', 'n4', 0.20, 'soft']
  ];
  var paths = [];

  function anchor(id) {
    var el = system.querySelector('[data-a="' + id + '"]');
    if (!el || !el.offsetParent) return null;           // hidden (e.g. on small screens)
    var dot = el.querySelector('i') || el;
    var r = dot.getBoundingClientRect(), base = system.getBoundingClientRect();
    return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
  }

  function build() {
    if (!svg) return;
    var W = system.clientWidth, H = system.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    paths = [];
    EDGES.forEach(function (e) {
      var a = anchor(e[0]), b = anchor(e[1]);
      if (!a || !b) return;
      if (a.y > b.y) { var t = a; a = b; b = t; }
      // always a gentle arc, never a straight line: both control points sit on the same side of
      // the straight path between the two nodes, so the curve bows smoothly with no hooks or kinks
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var bend = e[2] || 0.12, mag = Math.min(Math.max(Math.abs(bend), 0.1), 0.3) * (bend < 0 ? -1 : 1);
      var nx = -dy / len, ny = dx / len, h = mag * len * 0.9;
      var c1x = a.x + dx * 0.3 + nx * h, c1y = a.y + dy * 0.3 + ny * h;
      var c2x = a.x + dx * 0.7 + nx * h, c2y = a.y + dy * 0.7 + ny * h;
      var d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
        ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
        ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      if (e[3] === 'soft') p.setAttribute('class', 'soft');
      svg.appendChild(p);
      var len = e[3] === 'soft' ? 0 : p.getTotalLength();
      if (len) { p.style.strokeDasharray = len; p.style.strokeDashoffset = reduce ? 0 : len; }
      paths.push({ el: p, len: len, top: a.y, bottom: b.y, soft: e[3] === 'soft' });
    });
    update();
  }

  var ticking = false;
  function update() {
    ticking = false;
    if (!paths.length) return;
    var base = system.getBoundingClientRect().top;
    var line = window.innerHeight * 0.78 - base;   // how far down the system the "reveal line" sits
    paths.forEach(function (p) {
      var span = Math.max(p.bottom - p.top, 1);
      var t = Math.min(Math.max((line - p.top) / (span + window.innerHeight * 0.25), 0), 1);
      t = 1 - Math.pow(1 - t, 2.2);                    // ease out
      if (p.soft) { if (t > 0.35) p.el.classList.add('on'); }
      else if (!reduce) p.el.style.strokeDashoffset = (p.len * (1 - t)).toFixed(1);
    });
  }
  /* Watercolour shapes: three layers per section. Each drifts at its own speed (parallax)
     and grows as its section reaches the middle of the screen, then shrinks away again. */
  var layers = [].slice.call(document.querySelectorAll('.blob')).map(function (el) {
    var depth = el.classList.contains('l3') ? 1 : el.classList.contains('l2') ? 0.6 : 0.3;
    return { el: el, sec: el.closest('[data-sec]'), depth: depth, r: parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0 };
  });
  function shapes() {
    var vh = window.innerHeight;
    layers.forEach(function (o) {
      var r = o.sec.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;               // off screen: leave alone
      var p = ((r.top + r.height / 2) - vh / 2) / vh;             // -1 above … 0 centred … 1 below
      p = Math.max(-1.5, Math.min(1.5, p));
      var y = -p * o.depth * 140;
      var near = 1 - Math.min(Math.abs(p), 1);                    // 1 when centred, 0 when a screen away
      var scale = 0.78 + 0.32 * (near * near * (3 - 2 * near));    // smooth grow and shrink
      o.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ') rotate(' + (p * o.depth * 8).toFixed(2) + 'deg)';
    });
  }
  function frame() { update(); if (!reduce) shapes(); }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  if (system && svg) {
    var rebuild = function () { requestAnimationFrame(build); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild); else rebuild();
    window.addEventListener('load', rebuild);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (!reduce) shapes();
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(system);
    else window.addEventListener('resize', rebuild);
  }

  /* ---------- 3. Email sign-up ---------- */
  var form = document.getElementById('interest-form');
  if (form) {
    var input = form.querySelector('input[type=email]'), err = form.querySelector('.err'),
        status = form.querySelector('.status'), btn = form.querySelector('button[type=submit]'),
        body = form.querySelector('.body'), done = form.querySelector('.done');
    function finish() { body.hidden = true; done.hidden = false; done.focus(); }
    function bad(msg) { err.textContent = msg; form.classList.add('invalid'); input.setAttribute('aria-invalid', 'true'); input.focus(); }
    input.addEventListener('input', function () { if (form.classList.contains('invalid')) { err.textContent = ''; form.classList.remove('invalid'); input.removeAttribute('aria-invalid'); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      if (form.elements._gotcha.value) return;
      var email = input.value.trim();
      if (!email) return bad('Please add your email address.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Please check your email address.');
      var action = form.getAttribute('action');
      if (!action) {
        location.href = 'mailto:' + form.getAttribute('data-fallback-email') +
          '?subject=' + encodeURIComponent('Better Dying Fund: keep me updated') +
          '&body=' + encodeURIComponent('Please add ' + email + ' to the Better Dying Fund update list.');
        done.querySelector('p').innerHTML = '<strong>Nearly there.</strong> Your email app should open with a message ready to send.';
        finish(); return;
      }
      btn.disabled = true; status.textContent = 'Sending…';
      fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); status.textContent = ''; finish(); })
        .catch(function () { status.textContent = 'Sorry, that didn’t send. Please try again, or email ' + form.getAttribute('data-fallback-email') + '.'; })
        .then(function () { btn.disabled = false; });
    });
  }
})();
