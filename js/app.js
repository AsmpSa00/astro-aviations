/* ══ ASTRO AVIATIONS — app.js ══ */
gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────
   AURORA CANVAS  (vivid multi-orb gradient)
───────────────────────────────────────── */
function initAurora() {
  const cv = document.getElementById('auroraCanvas');
  if (!cv) return;
  const cx = cv.getContext('2d');
  let t = 0;

  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
  addEventListener('resize', resize);
  resize();

  const orbs = [
    { xf: t => .12 + .10*Math.sin(t*.50), yf: t => .38 + .12*Math.cos(t*.40), r: .55, h: 38, s: 75, l: 52, a: .18 },
    { xf: t => .80 + .08*Math.cos(t*.45), yf: t => .55 + .10*Math.sin(t*.60), r: .45, h: 45, s: 65, l: 62, a: .12 },
    { xf: t => .48 + .07*Math.sin(t*.70), yf: t => .18 + .09*Math.cos(t*.35), r: .40, h: 28, s: 80, l: 45, a: .10 },
    { xf: t => .90 + .04*Math.cos(t*.85), yf: t => .25 + .07*Math.sin(t*.50), r: .30, h: 42, s: 70, l: 58, a: .08 },
    { xf: t => .30 + .09*Math.sin(t*.32), yf: t => .78 + .08*Math.cos(t*.65), r: .38, h: 33, s: 78, l: 48, a: .07 },
    { xf: t => .60 + .06*Math.cos(t*.55), yf: t => .45 + .05*Math.sin(t*.75), r: .25, h: 50, s: 60, l: 68, a: .06 },
  ];

  (function draw() {
    t += .0038;
    const w = cv.width, h = cv.height;
    cx.clearRect(0, 0, w, h);
    orbs.forEach(o => {
      const x = o.xf(t)*w, y = o.yf(t)*h, r = o.r * Math.max(w,h);
      const g = cx.createRadialGradient(x,y,0, x,y,r);
      g.addColorStop(0,   `hsla(${o.h},${o.s}%,${o.l}%,${o.a})`);
      g.addColorStop(.4,  `hsla(${o.h},${o.s}%,${o.l}%,${o.a*.3})`);
      g.addColorStop(1,   `hsla(${o.h},${o.s}%,${o.l}%,0)`);
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
    });
    requestAnimationFrame(draw);
  })();
}

/* ─────────────────────────────────────────
   PLANE ANIMATION  (GSAP-driven)
───────────────────────────────────────── */
function initPlane() {
  const wrap = document.getElementById('planeWrap');
  if (!wrap) return;

  if (document.hidden) {
    gsap.set(wrap, { x: 0, y: 0, rotationZ: 0, rotationY: 0, scale: 1, opacity: 1 });
  } else {
    gsap.set(wrap, { x: '40vw', y: 60, rotationZ: -8, rotationY: 25, scale: .75, opacity: 0, transformPerspective: 900 });
    gsap.timeline({ delay: .4 })
      .to(wrap, { x: 0, y: 0, rotationZ: 0, rotationY: 0, scale: 1, opacity: 1,
        duration: 2.2, ease: 'power3.out' })
      .to(wrap, { y: -14, rotationZ: 1.2, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, '+=.5');
  }

  const entrance = null; // kept for scroll trigger below

  // Subtle bank when mouse moves on hero
  const hero = document.getElementById('hero');
  if (hero) {
    hero.addEventListener('mousemove', e => {
      const rx = hero.getBoundingClientRect();
      const nx = (e.clientX - rx.left) / rx.width  - .5;
      const ny = (e.clientY - rx.top)  / rx.height - .5;
      gsap.to(wrap, { rotationY: nx * 12, rotationX: -ny * 6, duration: 1.4, ease: 'power2.out', overwrite: 'auto' });
    });
    hero.addEventListener('mouseleave', () => {
      gsap.to(wrap, { rotationY: 0, rotationX: 0, duration: 1.8, ease: 'elastic.out(1,.5)', overwrite: 'auto' });
    });
  }

  // Fly off on scroll
  ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: '40% top', scrub: 1.2,
    onUpdate: self => {
      gsap.set(wrap, {
        y:        self.progress * -160,
        x:        self.progress * 120,
        rotationZ: self.progress * -12,
        opacity:  1 - self.progress * 2,
        scale:    1 + self.progress * .15,
      });
    }
  });
}

/* ─────────────────────────────────────────
   CONTRAIL CANVAS
───────────────────────────────────────── */
function initContrail() {
  const cv = document.getElementById('contrailCanvas');
  if (!cv) return;
  const cx = cv.getContext('2d');
  const wrap = document.getElementById('planeWrap');
  let points = [];
  let raf;

  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
  addEventListener('resize', resize);
  resize();

  function getPlanePos() {
    if (!wrap) return { x: innerWidth*.5, y: innerHeight*.5 };
    const r = wrap.getBoundingClientRect();
    // Tail of the plane (left side of the wrap)
    return { x: r.left + r.width * .12, y: r.top + r.height * .5 };
  }

  let frame = 0;
  (function draw() {
    raf = requestAnimationFrame(draw);
    frame++;
    if (frame % 2 !== 0) return; // 30fps for contrail

    const pos = getPlanePos();
    points.push({ x: pos.x, y: pos.y, a: .55 });

    // Fade & trim
    points = points.filter(p => { p.a -= .012; return p.a > 0; });
    if (points.length > 80) points.shift();

    cx.clearRect(0, 0, cv.width, cv.height);
    if (points.length < 2) return;

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i-1], p1 = points[i];
      const prog = i / points.length;
      cx.beginPath();
      cx.moveTo(p0.x, p0.y);
      cx.lineTo(p1.x, p1.y);
      cx.strokeStyle = `rgba(30, 127, 232, ${p1.a * .6})`;
      cx.lineWidth = prog * 3.5;
      cx.lineCap = 'round';
      cx.stroke();
    }
  })();
}

/* ─────────────────────────────────────────
   CUSTOM CURSOR
───────────────────────────────────────── */
function initCursor() {
  const dot  = document.getElementById('cur-dot');
  const ring = document.getElementById('cur-ring');
  if (!dot || !ring) return;

  let rx = 0, ry = 0, mx = 0, my = 0;

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    gsap.set(dot, { x: mx, y: my });
  });
  (function lerp() {
    rx += (mx - rx) * .10; ry += (my - ry) * .10;
    gsap.set(ring, { x: rx, y: ry });
    requestAnimationFrame(lerp);
  })();

  document.querySelectorAll('a,button,.svc-card,.fleet-card,.av-card,.why-card,.proc-step').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
  addEventListener('mousedown', () => ring.classList.add('click'));
  addEventListener('mouseup',   () => ring.classList.remove('click'));
}

/* ─────────────────────────────────────────
   LOADER
───────────────────────────────────────── */
function initLoader(cb) {
  const el   = document.getElementById('loader');
  const num  = document.getElementById('loaderNum');
  const fill = document.getElementById('loaderFill');

  let done = false;
  const exit = () => {
    if (done) return; done = true;
    if (el) { el.style.display = 'none'; }
    cb();
  };

  if (!el || document.hidden) { exit(); return; }

  // Force-exit if tab is backgrounded during load
  document.addEventListener('visibilitychange', () => { if (document.hidden) exit(); });

  const obj = { v: 0 };
  gsap.to(obj, {
    v: 100, duration: 1.6, ease: 'power2.inOut',
    onUpdate() {
      const pct = Math.floor(obj.v);
      if (num)  num.textContent  = pct;
      if (fill) fill.style.width = pct + '%';
    },
    onComplete() {
      if (num)  num.textContent  = '100';
      if (fill) fill.style.width = '100%';
      gsap.to(el, { autoAlpha: 0, y: -40, duration: .7, ease: 'power3.inOut', delay: .28, onComplete: exit });
      setTimeout(exit, 2500);
    }
  });
}

/* ─────────────────────────────────────────
   COUNTER
───────────────────────────────────────── */
function runCounter(el) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const target = parseFloat(el.dataset.target) || 0;
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const fmt = v => prefix + (Number.isInteger(target) ? Math.floor(v) : v.toFixed(1)) + suffix;
  if (document.hidden) { el.textContent = fmt(target); return; }
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target, duration: 2.2, ease: 'power3.out',
    onUpdate() { el.textContent = fmt(obj.v); },
    onComplete() { el.textContent = fmt(target); }
  });
}

/* ─────────────────────────────────────────
   HERO ENTRANCE ANIMATIONS
───────────────────────────────────────── */
function heroIn() {
  const showHero = () => {
    gsap.set('#auroraCanvas', { opacity: 1 });
    gsap.set(['.hero-chip', '.hero-p', '.hero-btns', '.hero-stats', '.scroll-cue'], { opacity: 1, y: 0 });
    gsap.set('.hero-h1 .li', { yPercent: 0, y: 0 });
    document.querySelectorAll('.hero-h1 .li').forEach(el => el.style.transform = 'none');
    document.querySelectorAll('.hs-n').forEach(runCounter);
  };

  if (document.hidden) { showHero(); return; }

  gsap.to('#auroraCanvas', { opacity: 1, duration: 1.8 });

  // Set GSAP as the transform authority before animating
  gsap.set('.hero-h1 .li', { yPercent: 105, y: 0 });

  const tl = gsap.timeline({ delay: .12 });
  tl.to('.hero-chip',   { opacity: 1, y: 0, duration: .7, ease: 'power3.out' }, 0)
    .to('.hero-h1 .li', { yPercent: 0, y: 0, duration: 1.1, stagger: .12, ease: 'power4.out' }, .2)
    .to('.hero-p',      { opacity: 1, y: 0, duration: .9, ease: 'power3.out' }, .72)
    .to('.hero-btns',   { opacity: 1, y: 0, duration: .9, ease: 'power3.out' }, .88)
    .to('.hero-stats',  { opacity: 1, y: 0, duration: .9, ease: 'power3.out' }, 1.0)
    .to('.scroll-cue',  { opacity: 1, duration: .7 }, 1.3);

  gsap.delayedCall(1.4, () => {
    document.querySelectorAll('.hs-n').forEach(runCounter);
  });
}

/* ─────────────────────────────────────────
   SCROLL ANIMATIONS
───────────────────────────────────────── */
function initScroll() {
  // If tab is hidden, skip scroll animations and show everything immediately
  if (document.hidden) {
    gsap.set('.reveal-u, .reveal-r, .reveal-card, .reveal-step, .reveal-q', { opacity: 1, y: 0, x: 0, scale: 1 });
    document.querySelectorAll('.cnt').forEach(runCounter);
    return;
  }

  // Up reveals
  gsap.utils.toArray('.reveal-u').forEach(el => {
    gsap.fromTo(el, { opacity: 0, y: 36 }, {
      opacity: 1, y: 0, duration: .85, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 84%' }
    });
  });

  // Right reveals
  gsap.utils.toArray('.reveal-r').forEach(el => {
    gsap.fromTo(el, { opacity: 0, x: 48 }, {
      opacity: 1, x: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 80%' }
    });
  });

  // Cards stagger
  document.querySelectorAll('.svc-grid, .fleet-grid, .why-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.reveal-card');
    gsap.fromTo(cards, { opacity: 0, y: 44, scale: .96 }, {
      opacity: 1, y: 0, scale: 1,
      duration: .75, stagger: .09, ease: 'power3.out',
      scrollTrigger: { trigger: grid, start: 'top 78%', once: true }
    });
  });

  // About cards
  gsap.utils.toArray('.av-card').forEach((c, i) => {
    gsap.fromTo(c, { opacity: 0, y: 32 }, {
      opacity: 1, y: 0, duration: .7, delay: i * .08, ease: 'power3.out',
      scrollTrigger: { trigger: '.av-grid', start: 'top 80%', once: true }
    });
  });

  // Process steps
  gsap.utils.toArray('.reveal-step').forEach((el, i) => {
    gsap.fromTo(el, { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, duration: .8, delay: i * .12, ease: 'power3.out',
      scrollTrigger: { trigger: '.proc-grid', start: 'top 78%', once: true }
    });
  });

  // Testimonial
  gsap.utils.toArray('.reveal-q').forEach(el => {
    gsap.fromTo(el, { opacity: 0, scale: .96 }, {
      opacity: 1, scale: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 80%' }
    });
  });

  // Section headings (sec-h)
  gsap.utils.toArray('.sec-h').forEach(el => {
    if (!el.closest('.reveal-u')) {
      gsap.fromTo(el, { opacity: 0, y: 28 }, {
        opacity: 1, y: 0, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%' }
      });
    }
  });

  // Stat counters in about + stats band
  ScrollTrigger.create({
    trigger: '.av-grid', start: 'top 78%', once: true,
    onEnter: () => document.querySelectorAll('.cnt').forEach(runCounter)
  });

  // Stats band counters (separate trigger for sb-grid)
  ScrollTrigger.create({
    trigger: '.stats-band', start: 'top 80%', once: true,
    onEnter: () => document.querySelectorAll('.sb-n.cnt').forEach(runCounter)
  });

  // Parallax on hero text
  gsap.to('.hero-content', {
    yPercent: 18, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  // Nav scroll state
  ScrollTrigger.create({
    start: 1,
    onUpdate: s => document.getElementById('nav').classList.toggle('scrolled', s.scroll() > 60)
  });
}

/* ─────────────────────────────────────────
   MAGNETIC BUTTONS
───────────────────────────────────────── */
function initMagnetic() {
  document.querySelectorAll('.mag-btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r  = btn.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width/2)  * .38;
      const dy = (e.clientY - r.top  - r.height/2) * .38;
      gsap.to(btn, { x: dx, y: dy, duration: .35, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.4)' });
    });
  });
}

/* ─────────────────────────────────────────
   NAV HAMBURGER
───────────────────────────────────────── */
function initNav() {
  const ham  = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (!ham || !menu) return;
  let open = false;
  ham.addEventListener('click', () => {
    open = !open;
    menu.classList.toggle('open', open);
    const [s1, s2] = ham.querySelectorAll('span');
    open
      ? (gsap.to(s1, { rotate: 45,  y:  6.5, duration: .28 }), gsap.to(s2, { rotate: -45, y: -6.5, duration: .28 }))
      : (gsap.to(s1, { rotate: 0,   y:  0,   duration: .28 }), gsap.to(s2, { rotate: 0,   y:  0,   duration: .28 }));
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    open = false; menu.classList.remove('open');
    const [s1,s2] = ham.querySelectorAll('span');
    gsap.to(s1, { rotate: 0, y: 0, duration: .28 });
    gsap.to(s2, { rotate: 0, y: 0, duration: .28 });
  }));
}

/* ─────────────────────────────────────────
   3D CARD TILT
───────────────────────────────────────── */
function initTilt() {
  document.querySelectorAll('.svc-card, .fleet-card, .why-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  - .5;
      const ny = (e.clientY - r.top)  / r.height - .5;
      gsap.to(card, {
        rotationY:  nx * 10, rotationX: -ny * 8,
        transformPerspective: 800, scale: 1.02,
        duration: .4, ease: 'power2.out'
      });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotationY: 0, rotationX: 0, scale: 1, duration: .7, ease: 'elastic.out(1,.5)' });
    });
  });
}

/* ─────────────────────────────────────────
   FORM
───────────────────────────────────────── */
function initForm() {
  const form = document.getElementById('cForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    btn.classList.add('success');
    btn.querySelector('span').textContent = "Request received — we'll be in touch within 24 hours";
    btn.querySelector('svg').style.display = 'none';
  });
}

/* ─────────────────────────────────────────
   SMOOTH SCROLL
───────────────────────────────────────── */
function initSmoothLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      gsap.to(window, { scrollTo: { y: t, offsetY: 80 }, duration: 1.1, ease: 'power3.inOut' });
    });
  });
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAurora();
  initCursor();
  initNav();
  initForm();
  initContrail();

  initLoader(() => {
    heroIn();
    initPlane();
    initScroll();
    initMagnetic();
    initTilt();

    // Load GSAP ScrollTo
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollToPlugin.min.js';
    s.onload = initSmoothLinks;
    document.head.appendChild(s);
  });
});
