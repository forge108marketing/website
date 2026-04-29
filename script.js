/* ============================================
   FORGE108 — Premium Animation Engine v2
   ============================================ */
(function () {
  'use strict';

  /* ==========================================
     UTILITIES
     ========================================== */
  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const isTouch = () => window.matchMedia('(hover: none)').matches;

  /* ==========================================
     STATE
     ========================================== */
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Cursor positions (lerp targets)
  const dot  = { x: mouse.x, y: mouse.y };
  const ring = { x: mouse.x, y: mouse.y };

  // Aura positions (three independent lerp speeds)
  const auraOuter = { x: mouse.x, y: mouse.y };
  const auraMid   = { x: mouse.x, y: mouse.y };
  const auraInner = { x: mouse.x, y: mouse.y };

  let mouseInHero = false;
  let tick = 0;
  let rafId = null;

  /* ==========================================
     MOUSE TRACKING
     ========================================== */
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (window._clickHeld) {
      window._clickX = e.clientX;
      window._clickY = e.clientY;
    }

    const hero = $('#home');
    if (hero) {
      const r = hero.getBoundingClientRect();
      mouseInHero = e.clientY >= r.top && e.clientY <= r.bottom &&
                    e.clientX >= r.left && e.clientX <= r.right;
    }
  }, { passive: true });

  // Click flash — brightens while held, decays on release
  document.addEventListener('mousedown', (e) => {
    const hero = $('#home');
    if (!hero || !mouseInHero) return;
    window._clickHeld = true;
    window._clickFlash = 1.0;
    window._clickX = e.clientX;
    window._clickY = e.clientY;
  });

  document.addEventListener('mouseup', () => {
    window._clickHeld = false;
  });

  // No touch-driven canvas effects on mobile

  /* ==========================================
     CUSTOM CURSOR
     ========================================== */
  function initCursor() {
    if (isTouch()) return;

    const cursorEl = $('#cursor');
    const dotEl    = $('#cursorDot');
    const ringEl   = $('#cursorRing');
    if (!cursorEl || !dotEl || !ringEl) return;

    cursorEl.style.display = 'block';

    // Cursor state on interactive elements
    const linkEls    = $$('a, button, [role="button"]');
    const magneticEls = $$('.btn-magnetic');

    linkEls.forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-link'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-link'));
    });

    document.addEventListener('mouseleave', (e) => {
      if (e.clientX <= 0 || e.clientY <= 0 ||
          e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        document.body.classList.add('cursor-hidden');
      }
    });
    document.addEventListener('mouseenter', () => document.body.classList.remove('cursor-hidden'));

    // Update function called in RAF loop
    window._updateCursor = function () {
      dot.x  = lerp(dot.x,  mouse.x, 0.85);
      dot.y  = lerp(dot.y,  mouse.y, 0.85);
      ring.x = lerp(ring.x, mouse.x, 0.12);
      ring.y = lerp(ring.y, mouse.y, 0.12);

      dotEl.style.transform  = `translate(${dot.x}px, ${dot.y}px) translate(-50%, -50%)`;
      ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;
    };
  }

  /* ==========================================
     MAGNETIC BUTTONS
     ========================================== */
  function initMagnetic() {
    if (isTouch()) return;

    $$('.btn-magnetic').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r  = btn.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const dx = (e.clientX - cx) * 0.28;
        const dy = (e.clientY - cy) * 0.28;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
        btn.style.transition = 'transform 0.15s ease';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.transition = 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)';
      });
    });
  }

  /* ==========================================
     HERO CANVAS — PARTICLES + CURSOR AURA
     ========================================== */
  function initCanvas() {
    const canvas = $('#heroCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
      const hero = $('#home');
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      W = canvas.width  = r.width;
      H = canvas.height = r.height;
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* --- Visibility: skip canvas when hero not on screen --- */
    let heroVisible = true;
    const visObs = new IntersectionObserver(
      ([e]) => { heroVisible = e.isIntersecting; },
      { threshold: 0 }
    );
    visObs.observe(canvas);

    /* --- Particle System --- */
    const PARTICLE_COUNT = isTouch() ? 22 : 38;
    const particles = [];

    class Particle {
      constructor() { this.init(true); }

      init(randomY = false) {
        this.x  = Math.random() * (W || window.innerWidth);
        this.y  = randomY
          ? Math.random() * (H || window.innerHeight)
          : (H || window.innerHeight) + 10;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = -(Math.random() * 0.2 + 0.05);
        this.size    = Math.random() * 1.4 + 0.4;
        this.opacity = Math.random() * 0.35 + 0.06;
        this.isGold  = Math.random() > 0.65;
        this.twinkle = Math.random() * Math.PI * 2;
        this.twinkleSpeed = 0.008 + Math.random() * 0.006;
      }

      update() {
        this.twinkle += this.twinkleSpeed;

        // Drift
        this.x += this.vx;
        this.y += this.vy;

        // Cursor attraction (soft pull toward aura center)
        if (!isTouch()) {
          const hero = canvas.getBoundingClientRect();
          const lx = auraInner.x - hero.left;
          const ly = auraInner.y - hero.top;
          const dx = lx - this.x;
          const dy = ly - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 220 && dist > 0) {
            const force = ((220 - dist) / 220) * 0.0006;
            this.vx += dx * force;
            this.vy += dy * force;
          }
        }

        // Speed cap
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > 0.7) { this.vx = (this.vx / spd) * 0.7; this.vy = (this.vy / spd) * 0.7; }

        // Gentle ambient sway
        this.vx += (Math.random() - 0.5) * 0.002;
        this.vy += (Math.random() - 0.5) * 0.001;

        // Wrap / recycle
        if (this.y < -10 || this.x < -20 || this.x > W + 20) this.init(false);
      }

      draw(ctx) {
        const pulse = Math.sin(this.twinkle) * 0.25 + 0.75;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.isGold
          ? `rgba(212, 180, 100, ${this.opacity * pulse})`
          : `rgba(255, 255, 255, ${this.opacity * 0.55 * pulse})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    /* --- Shared: draw a radial gradient clipped to its own radius (fast) --- */
    function radialFill(ctx, cx, cy, r, stops) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      for (const [pos, color] of stops) g.addColorStop(pos, color);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    /* --- Aura Rendering --- */
    let _heroRect = null;
    let _heroRectFrame = -1;
    function drawAura(ctx) {
      // Refresh every frame so scroll position is always accurate
      if (tick !== _heroRectFrame) { _heroRect = canvas.getBoundingClientRect(); _heroRectFrame = tick; }
      const lp = window._logoProximity || 0;
      const cf = window._clickFlash    || 0;  // click flash [0–1]

      // Click flash amplifies the entire aura briefly
      const boost      = (1 + lp * 2.5) * (1 + cf * 1.8);
      const lxO = auraOuter.x - _heroRect.left, lyO = auraOuter.y - _heroRect.top;
      const lxM = auraMid.x   - _heroRect.left, lyM = auraMid.y   - _heroRect.top;
      const lxI = auraInner.x - _heroRect.left, lyI = auraInner.y - _heroRect.top;

      // Layer 1 — vast slow bloom
      radialFill(ctx, lxO, lyO, 460 + lp * 180 + cf * 35, [
        [0,    `rgba(190,155,80,${0.10 * boost})`],
        [0.55, `rgba(170,135,65,${0.03 * boost})`],
        [1,    'rgba(0,0,0,0)'],
      ]);

      // Layer 2 — mid glow
      radialFill(ctx, lxM, lyM, 230 + lp * 70 + cf * 25, [
        [0,   `rgba(215,178,98,${0.16 * boost})`],
        [0.5, `rgba(195,160,80,${0.05 * boost})`],
        [1,   'rgba(0,0,0,0)'],
      ]);

      // Layer 3 — cursor hot-point
      if (mouseInHero || cf > 0.05) {
        const fx = (window._clickX || 0) - _heroRect.left;
        const fy = (window._clickY || 0) - _heroRect.top;
        const ix = mouseInHero ? lxI : fx;
        const iy = mouseInHero ? lyI : fy;

        radialFill(ctx, ix, iy, 105 + lp * 38 + cf * 22, [
          [0,    `rgba(240,205,118,${0.20 * boost})`],
          [0.5,  `rgba(218,183,98,${0.07 * boost})`],
          [1,    'rgba(0,0,0,0)'],
        ]);

        // Click burst — tighter radius, stays focused
        if (cf > 0.05) {
          radialFill(ctx, fx, fy, 32 + cf * 72, [
            [0,    `rgba(255,235,160,${0.40 * cf})`],
            [0.35, `rgba(240,205,120,${0.14 * cf})`],
            [1,    'rgba(0,0,0,0)'],
          ]);
        }

        // Layer 4 — tight logo hot-spot when near mark
        if (mouseInHero && lp > 0.08) {
          const lx = mouse.x - _heroRect.left;
          const ly = mouse.y - _heroRect.top;
          radialFill(ctx, lx, ly, 85 + lp * 55, [
            [0,   `rgba(255,230,155,${0.25 * lp})`],
            [0.55,`rgba(230,195,110,${0.08 * lp})`],
            [1,   'rgba(0,0,0,0)'],
          ]);
        }
      }
    }

    /* --- Ambient blooms (slow, always-moving background glow) --- */
    let _ambientFrame = 0;
    function drawAmbient(ctx, t) {
      // Fade ambient out while clicking so they don't read as a separate "left behind" light
      const cf = window._clickFlash || 0;
      const ambientScale = Math.max(0, 1 - cf * 2);
      if (ambientScale <= 0) return;

      // Only recalculate ambient every 2 frames — halves cost, imperceptible at slow speeds
      _ambientFrame++;
      const a1x = W * 0.5 + Math.sin(t * 0.00045) * W * 0.18;
      const a1y = H * 0.4 + Math.cos(t * 0.00035) * H * 0.12;
      radialFill(ctx, a1x, a1y, W * 0.4, [
        [0, `rgba(255,255,255,${0.020 * ambientScale})`],
        [1, 'rgba(0,0,0,0)'],
      ]);
      if (_ambientFrame % 2 === 0) {
        const a2x = W * 0.3 + Math.cos(t * 0.0006) * W * 0.12;
        const a2y = H * 0.6 + Math.sin(t * 0.0005) * H * 0.10;
        radialFill(ctx, a2x, a2y, W * 0.28, [
          [0, `rgba(180,150,80,${0.048 * ambientScale})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
      }
    }

    /* --- Hidden dot grid — revealed only under the cursor/click light --- */
    function drawRevealPattern(ctx, t) {
      const cf = window._clickFlash    || 0;
      const lp = window._logoProximity || 0;
      if (!mouseInHero && cf < 0.02) return;
      if (!_heroRect) return;

      // Reveal centre tracks the inner aura (responsive to cursor)
      const cx = mouseInHero ? auraInner.x - _heroRect.left : W * 0.5;
      const cy = mouseInHero ? auraInner.y - _heroRect.top  : H * 0.45;
      const revealR = 170 + cf * 50 + lp * 45;

      const SPACING = 30;
      // Grid drifts slowly so the pattern feels alive
      const drift = t * 0.0028;
      const offX  = drift % SPACING;
      const offY  = (drift * 0.62) % SPACING;

      const x0 = Math.floor((cx - revealR - SPACING * 2) / SPACING) * SPACING;
      const y0 = Math.floor((cy - revealR - SPACING * 2) / SPACING) * SPACING;

      for (let gx = x0; gx <= cx + revealR + SPACING; gx += SPACING) {
        for (let gy = y0; gy <= cy + revealR + SPACING; gy += SPACING) {
          const px  = gx + offX;
          const py  = gy + offY;
          const dx  = px - cx;
          const dy  = py - cy;
          const d2  = dx * dx + dy * dy;
          if (d2 > revealR * revealR) continue;

          const falloff = 1 - Math.sqrt(d2) / revealR;
          const alpha   = (0.07 + cf * 0.12 + lp * 0.05) * falloff * falloff;
          if (alpha < 0.005) continue;

          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210,175,90,${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
    }

    const touch = isTouch();

    /* --- Canvas tick (called from main RAF loop) --- */
    window._updateCanvas = function (t) {
      if (!heroVisible) return;
      _heroRect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, W, H);

      if (touch) {
        // Mobile: no canvas effects
        return;
      }

      drawAmbient(ctx, t);
      drawRevealPattern(ctx, t);
      drawAura(ctx);
      for (const p of particles) { p.update(); p.draw(ctx); }
    };
  }

  /* ==========================================
     LOADING SCREEN
     ========================================== */
  function initLoader(onDone) {
    const loader = document.getElementById('loader');
    if (!loader) { onDone && onDone(); return; }

    // Logo entrance via CSS keyframe
    requestAnimationFrame(() => loader.classList.add('logo-in'));

    if (isTouch()) {
      // ── Mobile: skip SVG filter entirely (feTurbulence is very expensive on iOS)
      // Use a clean CSS fade instead
      const svgEl = document.getElementById('loaderFilterSVG');
      loader.style.filter = 'none';

      // Hold for logo to appear, then cross-fade with hero entrance
      setTimeout(() => {
        // Fire hero entrance while loader is still fading — creates overlap
        onDone && onDone();
        loader.style.transition = 'opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1)';
        loader.style.opacity = '0';
        setTimeout(() => {
          loader.remove();
          if (svgEl) svgEl.remove();
          const backdrop = document.getElementById('loader-backdrop');
          if (backdrop) backdrop.remove();
        }, 680);
      }, 950);
      return;
    }

    // Desktop: full cinematic melt
    setTimeout(() => meltOut(loader, onDone), 800);
  }

  function meltOut(loader, onDone) {
    const turbEl    = document.getElementById('loaderTurbulence');
    const dispEl    = document.getElementById('loaderDisplace');
    const blurEl    = document.getElementById('loaderBlur');
    const logoEl    = loader.querySelector('.loader-logo');
    const svgEl     = document.getElementById('loaderFilterSVG');

    const DURATION = 2000;
    const start = performance.now();
    let frame = 0;
    let doneFired = false;

    const eOut2  = t => 1 - (1 - t) * (1 - t);
    const eOut3  = t => 1 - Math.pow(1 - t, 3);
    const eInOut = t => t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;

    function tick(now) {
      frame++;
      const t = Math.min((now - start) / DURATION, 1);

      // Fire hero entrance early — when overlay is ~20% opacity — so text fades
      // in through the disappearing loader rather than after a blank gap
      if (!doneFired && t >= 0.65) {
        doneFired = true;
        onDone && onDone();
      }

      // Very gentle turbulence — just enough to give it life, not chaos
      if (frame % 6 === 0 && turbEl) {
        turbEl.setAttribute('seed', ((Math.floor(frame / 6)) % 10) + 1);
      }
      const freq = 0.004 + eInOut(Math.min(t / 0.9, 1)) * 0.006;
      if (turbEl) turbEl.setAttribute('baseFrequency', `${freq.toFixed(5)} ${(freq * 0.6).toFixed(5)}`);

      // Minimal displacement — a whisper of distortion, not a shout
      if (dispEl) dispEl.setAttribute('scale', (eOut2(Math.min(t / 0.7, 1)) * 22).toFixed(1));

      // Soft edge blur follows the fade
      if (blurEl) blurEl.setAttribute('stdDeviation', (eOut2(Math.max(0, (t - 0.3) / 0.7)) * 4).toFixed(2));

      // ── Logo: dims to grey then dissolves ──
      if (logoEl) {
        const dimT       = eOut2(Math.min(t / 0.80, 1));
        const brightness = 1.1 - dimT * 1.02;
        const opT        = eOut3(Math.max(0, (t - 0.50) / 0.50));
        const opacity    = 1 - opT;
        const blurPx     = eOut2(Math.max(0, (t - 0.65) / 0.35)) * 4;

        logoEl.style.transform = '';
        logoEl.style.filter    = `invert(1) brightness(${Math.max(0.04, brightness).toFixed(3)}) blur(${blurPx.toFixed(2)}px)`;
        logoEl.style.opacity   = opacity.toFixed(4);
      }

      // ── Overlay: holds dark, then lifts away ──
      const bgOpT = eOut3(Math.max(0, (t - 0.40) / 0.60));
      loader.style.opacity = (1 - bgOpT).toFixed(4);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        loader.remove();
        if (svgEl) svgEl.remove();
        const backdrop = document.getElementById('loader-backdrop');
        if (backdrop) backdrop.remove();
      }
    }

    requestAnimationFrame(tick);
  }

  /* ==========================================
     PAGE TRANSITION WIPE
     ========================================== */
  function spawnTransitionLoader(onDone) {
    const wipe = document.createElement('div');
    wipe.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #F9F7F4;
      opacity: 0;
      pointer-events: all;
      display: flex; align-items: center; justify-content: center;
      will-change: opacity;
      transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const logo = document.createElement('img');
    logo.src = 'logo-mark.png';
    logo.draggable = false;
    logo.style.cssText = `
      width: clamp(48px, 7vw, 80px);
      opacity: 0;
      transform: scale(0.88);
      transition: opacity 0.18s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      will-change: opacity, transform;
    `;
    wipe.appendChild(logo);
    document.body.appendChild(wipe);

    // Fade wipe in
    void wipe.offsetWidth;
    wipe.style.opacity = '1';

    // Logo pops in shortly after wipe starts
    setTimeout(() => {
      logo.style.opacity = '1';
      logo.style.transform = 'scale(1)';
    }, 80);

    // At peak, switch page then fade out
    setTimeout(() => {
      onDone && onDone();
      wipe.style.transition = 'opacity 0.32s cubic-bezier(0.0, 0.0, 0.2, 1)';
      wipe.style.opacity = '0';
      setTimeout(() => wipe.remove(), 340);
    }, 260);
  }

  /* ==========================================
     HERO ENTRANCE SEQUENCE
     ========================================== */
  function initHeroEntrance() {
    // Ghost logo — brief cinematic afterglow that hands off to cursor-reveal
    const ghostEl = document.getElementById('heroLogoGhost');
    if (ghostEl) ghostEl.classList.add('in');

    const els = $$('.hero-enter');
    if (!els.length) return;

    // Mobile gets tighter delays so text is already fading in before loader is gone
    const mobile = isTouch();
    const delays = mobile
      ? [0, 160, 310, 470, 630, 780]
      : [40, 220, 400, 600, 800, 970];
    els.forEach((el, i) => {
      const delay = delays[i] ?? (900 + i * 150);
      if (delay === 0) {
        requestAnimationFrame(() => el.classList.add('in'));
      } else {
        setTimeout(() => el.classList.add('in'), delay);
      }
    });
  }

  /* ==========================================
     SCROLL REVEAL
     ========================================== */
  function initReveal() {
    // Only observe reveals NOT inside page overlays (those are handled by the page router)
    const reveals = $$('.reveal').filter(el => !el.closest('.page-overlay'));
    if (!reveals.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -48px 0px' }
    );

    reveals.forEach(el => obs.observe(el));
  }

  /* ==========================================
     PAGE CONTENT REVEAL (for page overlays)
     ========================================== */
  const _pageObservers = new Map();
  function revealPageContent(pageEl) {
    const revealEls = pageEl.querySelectorAll('.reveal');
    revealEls.forEach(el => el.classList.remove('visible'));

    // Disconnect any previous observer for this page
    if (_pageObservers.has(pageEl)) {
      _pageObservers.get(pageEl).disconnect();
    }

    setTimeout(() => {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -32px 0px', root: pageEl });

      revealEls.forEach(el => obs.observe(el));
      _pageObservers.set(pageEl, obs);
    }, 120);
  }

  /* ==========================================
     NAVIGATION
     ========================================== */
  function initNav() {
    const nav        = $('#nav');
    const navMenu    = $('#navMenu');
    const navLinks   = $('#navLinks');

    if (!nav) return;

    // Dark-mode class while hero is in view
    nav.classList.add('nav--dark');

    // Scroll handling — skipped when a page overlay is open
    function onScroll() {
      if (window._pageActive) return;
      const scrolled = window.scrollY > 20;
      nav.classList.toggle('scrolled', scrolled);

      const hero = $('#home');
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        nav.classList.toggle('nav--dark', heroBottom > 68);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Expose for page router
    window._navOnScroll = onScroll;

    // Mobile menu toggle
    if (navMenu && navLinks) {
      navMenu.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        navMenu.classList.toggle('open', open);
        navMenu.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
      });

      // Close mobile menu when any link is clicked
      navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          navLinks.classList.remove('open');
          navMenu.classList.remove('open');
          navMenu.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        });
      });

      document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && navLinks.classList.contains('open')) {
          navLinks.classList.remove('open');
          navMenu.classList.remove('open');
          document.body.style.overflow = '';
        }
      });
    }
  }

  /* ==========================================
     PAGE ROUTER
     ========================================== */
  function initPageRouter() {
    const nav        = $('#nav');
    const navLinkEls = $$('[data-page]');

    if (!nav) return;

    // Build overlay map
    const overlays = {};
    $$('.page-overlay[data-page]').forEach(el => {
      overlays[el.dataset.page] = el;
    });

    let activePage = null;
    let transitioning = false;

    function closeMobileMenu() {
      const navLinks = $('#navLinks');
      const navMenu  = $('#navMenu');
      if (navLinks) navLinks.classList.remove('open');
      if (navMenu)  { navMenu.classList.remove('open'); navMenu.setAttribute('aria-expanded', 'false'); }
      document.body.style.overflow = '';
    }

    function setNavActive(pageId) {
      $$('[data-page]').forEach(el => {
        el.classList.toggle('active', el.dataset.page === pageId && el.classList.contains('nav-link'));
      });
      // Highlight Book a Call CTA if contact page
      const cta = document.querySelector('.nav-cta[data-page]');
      if (cta) cta.classList.toggle('active', cta.dataset.page === pageId);
    }

    function clearNavActive() {
      $$('.nav-link, .nav-cta').forEach(el => el.classList.remove('active'));
    }

    function showPage(pageId) {
      if (transitioning) return;
      const target = overlays[pageId];
      if (!target) return;

      // Same page — do nothing
      if (activePage === pageId) { closeMobileMenu(); return; }

      transitioning = true;
      closeMobileMenu();
      triggerLogoAnimation();
      // Clear any stale cursor hover state from previous page
      document.body.classList.remove('cursor-link', 'cursor-hover');

      // Exit current page immediately
      const prevPage = activePage ? overlays[activePage] : null;
      if (prevPage) {
        prevPage.classList.add('is-exit');
        setTimeout(() => prevPage.classList.remove('is-active', 'is-exit'), 300);
      }

      // On touch: skip the wipe loader entirely — the CSS overlay transition handles it
      const switchPage = () => {
        window._pageActive = true;
        nav.classList.add('page-open');
        document.body.classList.add('page-open');
        nav.classList.remove('nav--dark', 'scrolled');
        setNavActive(pageId);
        target.scrollTop = 0;
        target.classList.add('is-active');
        activePage = pageId;
        revealPageContent(target);
        transitioning = false;
      };

      if (isTouch()) {
        switchPage();
      } else {
        spawnTransitionLoader(switchPage);
      }
    }

    function goHome() {
      if (transitioning || !activePage) return;
      transitioning = true;
      document.body.classList.remove('cursor-link', 'cursor-hover');

      const current = overlays[activePage];
      current.classList.add('is-exit');

      setTimeout(() => {
        current.classList.remove('is-active', 'is-exit');
        activePage = null;

        // Restore nav
        window._pageActive = false;
        nav.classList.remove('page-open');
        document.body.classList.remove('page-open');
        clearNavActive();
        if (window._navOnScroll) window._navOnScroll();

        transitioning = false;
      }, 300);
    }

    // Delegate all [data-page] clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-page]');
      if (!link) return;
      // Skip if the matched element is the page overlay container — only navigate for links/buttons
      if (!link.matches('a, button, [role="button"]')) return;
      const pageId = link.dataset.page;
      if (!pageId) return;
      e.preventDefault();
      showPage(pageId);
    }, true);

    // Logo click → go home
    const logoEl = document.querySelector('.nav-logo');
    if (logoEl) {
      logoEl.addEventListener('click', (e) => {
        if (activePage) {
          e.preventDefault();
          triggerLogoAnimation();
          goHome();
        }
      });
    }
  }

  function triggerLogoAnimation() {
    // No animation on logo
  }

  /* ==========================================
     WHY ITEMS — HOVER NUMBER COLOR
     ========================================== */
  function initWhyItems() {
    $$('.why-item').forEach(item => {
      const num = item.querySelector('.why-number');
      if (!num) return;
      item.addEventListener('mouseenter', () => { num.style.color = 'var(--gold)'; });
      item.addEventListener('mouseleave', () => { num.style.color = ''; });
    });
  }

  /* ==========================================
     WORK CARDS — 3D TILT
     ========================================== */
  function initWorkTilt() {
    if (isTouch()) return;
    $$('.work-card').forEach(card => {
      let resetTimer;
      card.addEventListener('mousemove', (e) => {
        clearTimeout(resetTimer);
        const r  = card.getBoundingClientRect();
        const x  = (e.clientX - r.left) / r.width  - 0.5;
        const y  = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transition = 'transform 0.1s ease, box-shadow 0.45s';
        card.style.transform  = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 5}deg) scale(1.012)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.65s';
        card.style.transform  = '';
        resetTimer = setTimeout(() => { card.style.transition = ''; }, 700);
      });
    });
  }

  /* ==========================================
     MAIN ANIMATION LOOP
     ========================================== */
  function loop(t) {
    tick = t;

    // Skip heavy hero work when a page overlay is covering it
    if (window._pageActive) {
      // Still update cursor so it tracks correctly on page overlays
      if (typeof window._updateCursor === 'function') window._updateCursor();
      rafId = requestAnimationFrame(loop);
      return;
    }

    // Aura lerp (three independent speeds)
    const heroRect = ($('#heroCanvas') || {}).getBoundingClientRect?.() || { left: 0, top: 0 };

    const targetX = mouseInHero ? mouse.x : (window.innerWidth  / 2);
    const targetY = mouseInHero ? mouse.y : (window.innerHeight * 0.45);

    // Snap all aura layers to cursor while click is held so no light is left behind
    const held = window._clickHeld;

    // Outer: very slow (ambient feel)
    if (held) {
      auraOuter.x = targetX;
      auraOuter.y = targetY;
    } else {
      auraOuter.x = lerp(auraOuter.x, targetX + Math.sin(t * 0.0004) * 40, 0.018);
      auraOuter.y = lerp(auraOuter.y, targetY + Math.cos(t * 0.0003) * 25, 0.018);
    }

    // Mid: medium
    if (held) {
      auraMid.x = targetX;
      auraMid.y = targetY;
    } else {
      auraMid.x = lerp(auraMid.x, targetX, 0.055);
      auraMid.y = lerp(auraMid.y, targetY, 0.055);
    }

    // Inner: responsive
    auraInner.x = lerp(auraInner.x, mouse.x, held ? 0.50 : 0.10);
    auraInner.y = lerp(auraInner.y, mouse.y, held ? 0.50 : 0.10);

    // Click flash — sustain while held, decay on release
    if (window._clickHeld) {
      window._clickFlash = lerp(window._clickFlash || 0, 1.0, 0.12);
    } else if (window._clickFlash > 0.001) {
      window._clickFlash = lerp(window._clickFlash, 0, 0.072);
    } else {
      window._clickFlash = 0;
    }

    // ---- Logo: reveal mask + float lift + directional shadow (desktop only) ----
    if (isTouch()) {
      if (typeof window._updateCanvas === 'function') window._updateCanvas(t);
      if (typeof window._updateCursor === 'function') window._updateCursor();
      rafId = requestAnimationFrame(loop);
      return;
    }
    const logoEl   = document.getElementById('heroLogoReveal');
    const shadowEl = document.getElementById('heroLogoShadow');
    if (logoEl) {
      const logoRect = logoEl.getBoundingClientRect();
      const logoCX   = logoRect.left + logoRect.width  / 2;
      const logoCY   = logoRect.top  + logoRect.height / 2;
      const dx       = mouse.x - logoCX;
      const dy       = mouse.y - logoCY;
      const dist     = Math.sqrt(dx * dx + dy * dy);
      const detectR  = Math.max(logoRect.width, logoRect.height) * 0.72;
      const rawProx  = mouseInHero ? Math.max(0, Math.min(1, 1 - dist / detectR)) : 0;
      window._logoProximity = lerp(window._logoProximity || 0, rawProx, 0.06);
      const lp = window._logoProximity;

      // --- Mask (throttled) ---
      const relX  = mouse.x - logoRect.left;
      const relY  = mouse.y - logoRect.top;
      const maskR = mouseInHero ? 195 + lp * 125 : 0;
      const px = window._maskPrev || {};
      if (Math.abs(maskR - (px.r || 0)) > 1.5 ||
          Math.abs(relX  - (px.x || 0)) > 1   ||
          Math.abs(relY  - (px.y || 0)) > 1) {
        logoEl.style.setProperty('--cx',     relX  + 'px');
        logoEl.style.setProperty('--cy',     relY  + 'px');
        logoEl.style.setProperty('--mask-r', maskR + 'px');
        window._maskPrev = { r: maskR, x: relX, y: relY };
      }

      // --- Float lift: logo rises as cursor approaches ---
      const lift = lp * 16;  // max 16px upward
      logoEl.style.transform = `translate(-50%, calc(-50% - ${lift}px))`;

      // --- Directional shadow below logo ---
      if (shadowEl) {
        // Light from cursor direction → shadow casts opposite & downward
        const shadowOffsetX = -dx * 0.08 * lp;            // shifts away from cursor
        const shadowOffsetY = logoRect.height * 0.5        // start at logo bottom edge
                              + 18                          // base gap
                              + lp * 32                    // drops further when higher
                              - lift * 0.4;                // shadow drops as logo lifts
        const shadowW     = logoRect.width * (0.5 + lp * 0.18);  // spreads wider when higher
        const shadowBlur  = 18 + lp * 14;                 // softer/larger when higher
        const shadowAlpha = lp * 0.55;

        shadowEl.style.width   = shadowW + 'px';
        shadowEl.style.opacity = shadowAlpha;
        shadowEl.style.filter  = `blur(${shadowBlur}px)`;
        shadowEl.style.transform =
          `translate(calc(-50% + ${shadowOffsetX}px), ${shadowOffsetY}px)`;
      }
    }

    // Canvas tick
    if (typeof window._updateCanvas === 'function') {
      window._updateCanvas(t);
    }

    // Cursor tick
    if (typeof window._updateCursor === 'function') {
      window._updateCursor();
    }

    rafId = requestAnimationFrame(loop);
  }

  /* ==========================================
     GLITCH DECODE
     ========================================== */
  function initGlitchDecode() {
    const POOL    = '!<>-_\\/[]{}—=+*^?#';
    const TICK_MS = 30;
    const ADVANCE = 0.4;

    function randomChar() {
      return POOL[Math.floor(Math.random() * POOL.length)];
    }

    // Build innerHTML: locked chars full opacity, scrambled chars dim + slightly
    // smaller so their varying widths don't shove the layout around as much
    function buildFrame(text, cursorPos) {
      return text.split('').map((ch, i) => {
        if (ch === ' ') return ' ';
        if (i < cursorPos) {
          return `<span class="gd-locked">${ch}</span>`;
        }
        return `<span class="gd-scrambled">${randomChar()}</span>`;
      }).join('');
    }

    function runGlitch(el) {
      const originalHTML = el.innerHTML;
      const plainText    = originalHTML
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '');

      let cursor = 0;

      // Fade element in from near-zero while scramble starts
      el.style.opacity  = '0.05';
      el.style.transition = 'opacity 0.22s ease';
      el.innerHTML = buildFrame(plainText, 0);

      // Kick off the fade-in on the next paint so the transition fires
      requestAnimationFrame(() => {
        el.style.opacity = '1';
      });

      const timer = setInterval(() => {
        cursor += ADVANCE;
        if (cursor >= plainText.length) {
          clearInterval(timer);
          // Brief pause, then snap back to original styled markup
          setTimeout(() => {
            el.style.transition = '';
            el.style.opacity    = '';
            el.innerHTML = originalHTML;
          }, 40);
          return;
        }
        el.innerHTML = buildFrame(plainText, Math.floor(cursor));
      }, TICK_MS);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        runGlitch(entry.target);
      });
    }, { threshold: 0.2 });

    $$('[data-glitch]').forEach(el => observer.observe(el));
  }

  /* ==========================================
     INIT
     ========================================== */
  function init() {
    initNav();
    initPageRouter();
    initCanvas();
    initReveal();
    initWhyItems();
    initWorkTilt();
    initGlitchDecode();

    if (!isTouch()) {
      initCursor();
      initMagnetic();
      requestAnimationFrame(loop); // RAF only needed on desktop (canvas, cursor, aura)
    }

    // Run loader first, then trigger hero entrance
    initLoader(() => {
      initHeroEntrance();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  window.addEventListener('unload', () => {
    if (rafId) cancelAnimationFrame(rafId);
  });

})();
