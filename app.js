/* ================================================================
   E-CELL NPGC — app.js
   Anti-Flicker + Mobile-Optimised Interactions
   ================================================================ */
'use strict';

// ── IMMEDIATELY mark JS as loaded — prevents FOUC on [data-reveal] ──
// This must be the VERY FIRST thing that runs.
document.documentElement.classList.add('js-loaded');

// ── Hide site immediately (CSS fallback in case class not applied)   ──
const siteEl = document.getElementById('site');
if (siteEl) siteEl.style.opacity = '0';

// ── Utilities ─────────────────────────────────────────────────────
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const isMobile = () => window.innerWidth <= 768;
const isTouch  = () => window.matchMedia('(pointer: coarse)').matches;

/* ══════════════════════════════════════════════════════════════
   1. LOADER
   ══════════════════════════════════════════════════════════════ */
(function initLoader() {
  const loader = $('#loader');
  const fill   = $('#loaderProgress');
  const pc     = $('#loaderParticles');

  if (!loader) return;

  // Lock scroll during load
  document.body.style.overflow = 'hidden';

  // Spawn particles
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'loader-particle';
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `top:${40 + Math.random() * 60}%`,
      `animation-duration:${2 + Math.random() * 3}s`,
      `animation-delay:${Math.random() * 3}s`,
      `width:${2 + Math.random() * 2.5}px`,
      `height:${2 + Math.random() * 2.5}px`,
    ].join(';');
    frag.appendChild(p);
  }
  pc.appendChild(frag);

  // Progress animation — lerped, no DOM thrash
  let progress = 0, target = 0;
  const ticker = setInterval(() => {
    target = Math.min(100, target + Math.random() * 12 + 4);
  }, 175);

  let rafId;
  (function tick() {
    progress = lerp(progress, target, 0.09);
    fill.style.width = progress + '%';
    fill.parentElement.setAttribute('aria-valuenow', Math.round(progress));
    if (progress < 99.4) {
      rafId = requestAnimationFrame(tick);
    } else {
      clearInterval(ticker);
      cancelAnimationFrame(rafId);
      setTimeout(finish, 300);
    }
  })();

  function finish() {
    fill.style.width = '100%';
    setTimeout(() => {
      loader.classList.add('loader-exit');

      // Show site with class (CSS handles transition)
      if (siteEl) siteEl.classList.add('visible');

      // Show sticky bar on mobile if already scrolled
      if (isMobile() && window.scrollY > 100) {
        const sticky = $('#mobileStickyBar');
        if (sticky) sticky.classList.add('visible');
      }

      // Remove loader from DOM after fade
      setTimeout(() => {
        loader.style.display = 'none';
        document.body.style.overflow = '';
        // Trigger reveal after site is visible
        triggerReveal();
      }, 700);
    }, 260);
  }
})();

/* ══════════════════════════════════════════════════════════════
   2. BACKGROUND CANVAS
   ══════════════════════════════════════════════════════════════ */
(function initCanvas() {
  const canvas = $('#bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];
  let mouse = { x: null, y: null };

  // Fewer particles on mobile to avoid jank
  const COUNT = isMobile() ? 36 : 65;
  const DIST  = isMobile() ? 80  : 110;

  class P {
    constructor() { this.reset(true); }
    reset(init = false) {
      this.x   = Math.random() * W;
      this.y   = init ? Math.random() * H : H + 6;
      this.vx  = (Math.random() - 0.5) * 0.22;
      this.vy  = -(Math.random() * 0.2 + 0.04);
      this.r   = Math.random() * 1.2 + 0.3;
      this.a   = Math.random() * 0.38 + 0.07;
      this.life = 0; this.max = Math.random() * 260 + 160;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.life++;
      if (this.y < -6 || this.life > this.max) this.reset();
      // Only repel on non-touch devices
      if (mouse.x !== null) {
        const dx = this.x - mouse.x, dy = this.y - mouse.y;
        const d  = Math.hypot(dx, dy);
        if (d < 80) { const f = (80 - d) / 80; this.x += dx * f * 0.011; this.y += dy * f * 0.011; }
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(76,172,0,${this.a})`;
      ctx.fill();
    }
  }

  let lastW = window.innerWidth;
  function resize() {
    if (window.innerWidth === lastW && canvas.width > 0) return;
    lastW = W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  let animId;
  let lastTime = 0;
  const fpsInterval = isMobile() ? 1000 / 30 : 1000 / 60;

  let isScrolling = false;
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (!isMobile()) return;
    isScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 150);
  }, { passive: true });

  function animate(time = performance.now()) {
    animId = requestAnimationFrame(animate);
    
    // Pause canvas drawing during mobile scrolling for pure performance
    if (isMobile() && isScrolling) return;

    const elapsed = time - lastTime;
    if (elapsed < fpsInterval) return;
    lastTime = time - (elapsed % fpsInterval);

    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      pts[i].update();
      pts[i].draw();
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.hypot(dx, dy);
        if (d < DIST) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(76,172,0,${(1 - d / DIST) * 0.08})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  // Pause when tab hidden — critical for mobile battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(animId); }
    else { animate(); }
  });

  window.addEventListener('resize', resize, { passive: true });
  if (!isTouch()) {
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('mouseleave', () => { mouse.x = mouse.y = null; });
  }

  resize();
  pts = Array.from({ length: COUNT }, () => new P());
  animate();
})();

/* ══════════════════════════════════════════════════════════════
   3. CURSOR GLOW (desktop only)
   ══════════════════════════════════════════════════════════════ */
(function initGlow() {
  const glow = $('#cursorGlow');
  if (!glow || isTouch()) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  (function tick() {
    cx = lerp(cx, tx, 0.07);
    cy = lerp(cy, ty, 0.07);
    // Use translate3d — GPU-composited, zero layout
    glow.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
    requestAnimationFrame(tick);
  })();
})();

/* ══════════════════════════════════════════════════════════════
   4. NAVIGATION
   ══════════════════════════════════════════════════════════════ */
(function initNav() {
  const header = $('#siteHeader');
  const ham    = $('#navHamburger');
  const menu   = $('#mobileMenu');
  if (!header || !ham || !menu) return;

  // Scroll glass — throttled via passive listener
  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('scrolled', window.scrollY > 36);
      scrollTicking = false;
    });
  }, { passive: true });
  // Set initial state
  header.classList.toggle('scrolled', window.scrollY > 36);

  // Hamburger toggle
  function openMenu() {
    menu.classList.add('open');
    ham.classList.add('open');
    ham.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menu.classList.remove('open');
    ham.classList.remove('open');
    ham.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  ham.addEventListener('click', () => menu.classList.contains('open') ? closeMenu() : openMenu());

  // Close on any link inside drawer
  $$('.mobile-link, .mobile-cta-btn', menu).forEach(el => el.addEventListener('click', closeMenu));

  // Close when clicking outside drawer
  document.addEventListener('click', e => {
    if (menu.classList.contains('open') && !header.contains(e.target)) closeMenu();
  });

  // Active section highlighting
  const navLinks = $$('.nav-link');
  const sections = navLinks
    .map(l => {
      const href = l.getAttribute('href');
      if (href && href.startsWith('#') && href !== '#') {
        try {
          return document.querySelector(href);
        } catch (e) {
          return null;
        }
      }
      return null;
    })
    .filter(Boolean);

  let navTicking = false;
  window.addEventListener('scroll', () => {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(() => {
      let cur = '';
      sections.forEach(s => {
        if (s.getBoundingClientRect().top <= 95) cur = '#' + s.id;
      });
      navLinks.forEach(l => {
        const href = l.getAttribute('href');
        const isActive = href && href.startsWith('#')
          ? href === cur
          : href && window.location.pathname.toLowerCase().includes(href.toLowerCase());
        l.classList.toggle('active', isActive);
      });
      navTicking = false;
    });
  }, { passive: true });
})();

/* ══════════════════════════════════════════════════════════════
   5. SCROLL REVEAL
   ══════════════════════════════════════════════════════════════ */
function triggerReveal() {
  // Only elements visible in viewport get revealed immediately
  const els = $$('[data-reveal]');
  if (!els.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  els.forEach(el => obs.observe(el));
}
// Also trigger on DOMContentLoaded as fallback
document.addEventListener('DOMContentLoaded', () => {
  // Short delay so #site opacity transition has started
  setTimeout(triggerReveal, 80);
});

/* ══════════════════════════════════════════════════════════════
   6. ANIMATED COUNTERS
   ══════════════════════════════════════════════════════════════ */
(function initCounters() {
  const items = $$('.stat-item[data-counter]');
  if (!items.length) return;
  let fired = false;
  const easeOut = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

  function runCounter(el) {
    const end = parseInt(el.dataset.counter, 10);
    const sfx = el.dataset.suffix || '';
    const num = el.querySelector('.stat-number');
    if (!num) return;
    const dur = 1500, start = performance.now();
    (function step(now) {
      const p = clamp((now - start) / dur, 0, 1);
      // tabular-nums prevents layout shift on number change
      num.textContent = Math.round(easeOut(p) * end) + sfx;
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !fired) {
      fired = true;
      items.forEach(runCounter);
      obs.disconnect();
    }
  }, { threshold: 0.25 });

  const bar = $('#stats');
  if (bar) obs.observe(bar);
})();

/* ══════════════════════════════════════════════════════════════
   7. BACK TO TOP
   ══════════════════════════════════════════════════════════════ */
(function initBTT() {
  const btn = $('#backToTop');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      btn.classList.toggle('visible', window.scrollY > 380);
      ticking = false;
    });
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ══════════════════════════════════════════════════════════════
   8. MOBILE STICKY BAR
   ══════════════════════════════════════════════════════════════ */
(function initStickyBar() {
  const bar = $('#mobileStickyBar');
  if (!bar) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!isMobile() || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      bar.classList.toggle('visible', window.scrollY > 100);
      ticking = false;
    });
  }, { passive: true });

  // Handle resize (phone rotated to desktop)
  window.addEventListener('resize', () => {
    if (!isMobile()) bar.classList.remove('visible');
  }, { passive: true });
})();

/* ══════════════════════════════════════════════════════════════
   10. CARD TILT (desktop / non-touch only)
   ══════════════════════════════════════════════════════════════ */
(function initTilt() {
  if (isTouch()) return;
  const MAX = 5;
  $$('.initiative-card, .team-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
      const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
      // Use translate3d to keep on GPU layer
      card.style.transform = `translateY(-4px) perspective(700px) rotateX(${clamp(-dy*MAX,-MAX,MAX)}deg) rotateY(${clamp(dx*MAX,-MAX,MAX)}deg) translateZ(0)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

/* ══════════════════════════════════════════════════════════════
   11. SMOOTH ANCHOR SCROLL
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href === '#') {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const target = document.querySelector(href);
  if (target) {
    e.preventDefault();
    const offset = target.getBoundingClientRect().top + window.scrollY - 68;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  }
});

/* ══════════════════════════════════════════════════════════════
   12. HERO CHIP ENTRANCE
   ══════════════════════════════════════════════════════════════ */
$$('.hero-chip, .mobile-strip-chip').forEach((chip, i) => {
  // Set initial hidden state via style (not CSS class — avoids FOUC)
  chip.style.cssText += 'opacity:0;transform:scale(0.84) translateY(8px);transition:none;';
  setTimeout(() => {
    chip.style.transition = 'opacity 0.42s cubic-bezier(0.34,1.56,0.64,1), transform 0.42s cubic-bezier(0.34,1.56,0.64,1)';
    chip.style.opacity    = '1';
    chip.style.transform  = '';
  }, 1050 + i * 170);
});

/* ══════════════════════════════════════════════════════════════
   13. TYPEWRITER
   ══════════════════════════════════════════════════════════════ */
(function initTypewriter() {
  let phrases = ['Startups.', 'Innovation.', 'Founders.', 'Lucknow.'];
  const path = window.location.pathname.toLowerCase();
  if (path.includes('blog') || path.includes('aktu-visit') || path.includes('cm-yuva') || path.includes('saarang_25') || path.includes('anual_rport_25') || path.includes('hunar_launchpad_expo')) {
    phrases = ['Insights.', 'Stories.', 'Updates.', 'Articles.'];
  } else if (path.includes('gallery')) {
    phrases = ['Moments.', 'Events.', 'Memories.', 'Exhibits.'];
  } else if (path.includes('contact')) {
    phrases = ['Contact.', 'Apply.', 'Connect.', 'Partner.'];
  }
  const el = $('#typewriterTarget');
  if (!el) return;
  let pi = 0, ci = 0, del = false;

  function type() {
    const phrase = phrases[pi];
    if (!del) {
      el.textContent = phrase.slice(0, ++ci);
      if (ci === phrase.length) { del = true; setTimeout(type, 1900); return; }
    } else {
      el.textContent = phrase.slice(0, --ci);
      if (ci === 0) { del = false; pi = (pi + 1) % phrases.length; setTimeout(type, 350); return; }
    }
    setTimeout(type, del ? 40 : 75);
  }

  setTimeout(type, 1300);
})();

/* ══════════════════════════════════════════════════════════════
   14. TOUCH RIPPLE on initiative cards
   ══════════════════════════════════════════════════════════════ */
(function initRipple() {
  if (!isTouch()) return;

  // Inject keyframe once
  const style = document.createElement('style');
  style.textContent = '@keyframes ripple-out{to{width:180px;height:180px;opacity:0;transform:translate(-50%,-50%) scale(1)}}';
  document.head.appendChild(style);

  $$('.initiative-card').forEach(card => {
    card.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      const r = card.getBoundingClientRect();
      const ripple = document.createElement('span');
      Object.assign(ripple.style, {
        position: 'absolute',
        left: (touch.clientX - r.left) + 'px',
        top:  (touch.clientY - r.top)  + 'px',
        width: '0', height: '0',
        borderRadius: '50%',
        background: 'rgba(76,172,0,0.1)',
        transform: 'translate(-50%,-50%) scale(0)',
        animation: 'ripple-out 0.48s ease-out forwards',
        pointerEvents: 'none', zIndex: '0',
      });
      card.appendChild(ripple);
      setTimeout(() => ripple.remove(), 520);
    }, { passive: true });
  });
})();
