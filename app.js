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

/* ── Rotating homepage headline ───────────────────────────────── */
(function initHeroRotator() {
  const phrase = $('#heroRotatingPhrase');
  if (!phrase) return;

  const phrases = ['ventures', 'sapno se startup', 'ideas se impact', 'soch se shuruaat'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer;

  function stop() {
    window.clearInterval(timer);
    timer = undefined;
  }

  function start() {
    stop();
    if (reducedMotion.matches || document.hidden) return;
    timer = window.setInterval(() => {
      phrase.classList.add('is-changing');
      window.setTimeout(() => {
        current = (current + 1) % phrases.length;
        phrase.textContent = phrases[current];
        phrase.classList.remove('is-changing');
      }, 220);
    }, 2600);
  }

  document.addEventListener('visibilitychange', start);
  reducedMotion.addEventListener('change', start);
  start();
})();

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
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139,197,61,${this.a})`;
      ctx.fill();
    }
  }

  let lastW = 0, lastH = 0;
  function resize() {
    if (window.innerWidth === lastW && window.innerHeight === lastH) return;
    lastW = W = canvas.width  = window.innerWidth;
    lastH = H = canvas.height = window.innerHeight;
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
          ctx.strokeStyle = `rgba(139,197,61,${(1 - d / DIST) * 0.08})`;
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
  resize();
  pts = Array.from({ length: COUNT }, () => new P());
  animate();
})();

/* ══════════════════════════════════════════════════════════════
  3. NAVIGATION
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
    ham.setAttribute('aria-label', 'Close navigation menu');
    menu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menu.classList.remove('open');
    ham.classList.remove('open');
    ham.setAttribute('aria-expanded', 'false');
    ham.setAttribute('aria-label', 'Open navigation menu');
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
   6. BACK TO TOP
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

(function initTeamDirectory() {
  const grid = $('#teamGrid');
  const sessionSelect = $('#teamSession');
  if (!grid || !sessionSelect) return;

  const techCard = $('#tp-tech', grid);
  const creativityCard = $('#tp-creativity', grid);
  if (techCard && creativityCard) grid.insertBefore(techCard, creativityCard);

  const stats = $('.team-stats-banner');
  const joinStrip = $('.team-join-strip');
  const emptyState = $('#teamSessionEmpty');
  const sessionStatus = $('#teamSessionStatus');
  const sessionStatusLabel = $('.session-status-label', sessionStatus);

  function showSession() {
    const hasRoster = sessionSelect.value === '2024-2025';
    grid.hidden = !hasRoster;
    if (stats) stats.hidden = !hasRoster;
    if (joinStrip) joinStrip.hidden = !hasRoster;
    if (emptyState) emptyState.hidden = hasRoster;
    if (sessionStatus) sessionStatus.classList.toggle('is-unavailable', !hasRoster);
    if (sessionStatusLabel) sessionStatusLabel.textContent = hasRoster ? 'Directory available' : 'Directory not available';
  }

  sessionSelect.addEventListener('change', showSession);
  showSession();
})();

/* ══════════════════════════════════════════════════════════════
   9. TOUCH RIPPLE on initiative cards
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
        background: 'rgba(139,197,61,0.1)',
        transform: 'translate(-50%,-50%) scale(0)',
        animation: 'ripple-out 0.48s ease-out forwards',
        pointerEvents: 'none', zIndex: '0',
      });
      card.appendChild(ripple);
      setTimeout(() => ripple.remove(), 520);
    }, { passive: true });
  });
})();
