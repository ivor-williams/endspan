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
    ['L0', 'h-com', 0.10], ['R0', 'h-fam', -0.08, 'soft'], ['h-com', 'h-care', 0.14], ['h-fam', 'h-care', -0.06, 'soft'],
    ['h-care', 'n1', -0.22], ['h-fam', 's1a', 0.06], ['h-com', 's2a', -0.18, 'soft'],
    ['n1', 's1a', 0.10], ['s1a', 's1b', -0.08, 'soft'], ['s1b', 'n2', 0.16], ['n1', 's2b', 0.24], ['n1', 'n3', -0.16, 'soft'],
    ['s2a', 'n3', -0.20], ['n2', 's3a', -0.12], ['s2b', 'n4', 0.10, 'soft'], ['L1', 's2b', 0.08],
    ['n3', 's3b', 0.12], ['s3a', 's3b', 0.06, 'soft'], ['s3b', 'n4', 0.18], ['n3', 's4b', 0.20], ['n2', 'n4', 0.30, 'soft'],
    ['s4a', 'n5', -0.18], ['n4', 's5a', -0.14], ['s4b', 's5b', 0.10], ['R1', 's4a', -0.10, 'soft'],
    ['n3', 'n5', -0.26, 'soft'], ['s5a', 's5b', 0.08, 'soft'], ['s5b', 'n5', -0.10], ['L2', 'n5', 0.12]
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
      var dy = b.y - a.y, k = e[2] * W;
      var d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
        ' C' + (a.x + k).toFixed(1) + ' ' + (a.y + dy * 0.55).toFixed(1) +
        ' ' + (b.x - k).toFixed(1) + ' ' + (b.y - dy * 0.55).toFixed(1) +
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
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  if (system && svg) {
    var rebuild = function () { requestAnimationFrame(build); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild); else rebuild();
    window.addEventListener('load', rebuild);
    window.addEventListener('scroll', onScroll, { passive: true });
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
