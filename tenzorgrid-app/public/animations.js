// Shared GSAP-based motion utilities. Loaded after the GSAP CDN script on
// pages that want real animation instead of the plain CSS fades used
// elsewhere on the site. Falls back to a no-op if GSAP failed to load
// (e.g. blocked network) so pages never break because of this file.
window.TG = window.TG || {};

(function () {
  const hasGsap = typeof window.gsap !== 'undefined';
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  TG.fadeInUp = function (selector, opts) {
    const els = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
    if (!els || !els.length) return;
    if (!hasGsap || prefersReducedMotion) {
      els.forEach((el) => { el.style.opacity = 1; });
      return;
    }
    gsap.fromTo(els,
      { opacity: 0, y: (opts && opts.y) || 14 },
      { opacity: 1, y: 0, duration: (opts && opts.duration) || 0.5, ease: 'power2.out', stagger: (opts && opts.stagger) || 0 });
  };

  TG.staggerIn = function (selector, opts) {
    TG.fadeInUp(selector, Object.assign({ stagger: 0.08 }, opts));
  };

  // Animates an element's textContent from 0 up to `target` (an integer).
  // `format` optionally wraps each frame's value, e.g. (n) => n + ' jobs'.
  TG.countUp = function (el, target, opts) {
    if (!el || typeof target !== 'number' || Number.isNaN(target)) return;
    const format = (opts && opts.format) || ((n) => String(n));
    if (!hasGsap || prefersReducedMotion) {
      el.textContent = format(target);
      return;
    }
    const state = { val: 0 };
    gsap.to(state, {
      val: target,
      duration: (opts && opts.duration) || 0.9,
      ease: 'power1.out',
      onUpdate: () => { el.textContent = format(Math.round(state.val)); },
    });
  };

  // Adds a subtle lift + shadow on hover/focus for cards — replaces the
  // static CSS-only hover state with a slightly springier, tactile one.
  TG.hoverLift = function (selector) {
    const els = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
    if (!els || !els.length || !hasGsap || prefersReducedMotion) return;
    els.forEach((el) => {
      const up = () => gsap.to(el, { y: -4, duration: 0.2, ease: 'power2.out' });
      const down = () => gsap.to(el, { y: 0, duration: 0.2, ease: 'power2.out' });
      el.addEventListener('mouseenter', up);
      el.addEventListener('mouseleave', down);
      el.addEventListener('focus', up);
      el.addEventListener('blur', down);
    });
  };

  // Small celebratory burst of dots from the center of `originEl` — used for
  // one-off milestones (e.g. profile reaching 100%). No-op under reduced
  // motion or if GSAP isn't available; still fires visually once either way.
  TG.confetti = function (originEl) {
    if (!originEl) return;
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#6d28d9'];
    if (!hasGsap || prefersReducedMotion) return;
    for (let i = 0; i < 18; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:7px;height:7px;border-radius:50%;` +
        `background:${colors[i % colors.length]};pointer-events:none;z-index:500;`;
      document.body.appendChild(dot);
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 70;
      gsap.to(dot, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 20,
        opacity: 0,
        scale: 0.3,
        duration: 0.8 + Math.random() * 0.4,
        ease: 'power2.out',
        onComplete: () => dot.remove(),
      });
    }
  };

  // Crossfades between two elements that occupy the same spot (e.g. a
  // monthly/yearly price swap) instead of an instant display:none toggle.
  TG.crossfade = function (hideEl, showEl) {
    if (!hideEl || !showEl) return;
    if (!hasGsap || prefersReducedMotion) {
      hideEl.style.display = 'none';
      showEl.style.display = '';
      return;
    }
    gsap.to(hideEl, {
      opacity: 0, y: -6, duration: 0.15, ease: 'power1.in',
      onComplete: () => {
        hideEl.style.display = 'none';
        showEl.style.display = '';
        gsap.fromTo(showEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' });
      },
    });
  };
})();
