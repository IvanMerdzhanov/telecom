/**
 * Orbiqa Main JavaScript — v2
 * Homepage-specific: globe init, scroll-sync, mouse parallax,
 * 3D card tilt, stat counters, plan toggles, testimonials,
 * coverage form, speed arcs, TV drag-scroll, business nodes.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Globe Init ──────────────────────────────────────────────────── */
  const heroGlobe = new OrbiqaGlobe('globeCanvas', {
    centerXRatio: 0.64,
    centerYRatio: 0.5,
    radiusRatio:  0.38,
    showRings:    true,
    maxConnections: 6,
  });

  const finalGlobe = new OrbiqaGlobe('finalGlobe', {
    centerXRatio: 0.5,
    centerYRatio: 0.5,
    radiusRatio:  0.28,
    showRings:    true,
    maxConnections: 4,
    startRotation: 1.2,
  });

  const networkGlobe = new OrbiqaGlobe('networkGlobe', {
    centerXRatio: 0.5,
    centerYRatio: 0.5,
    radiusRatio:  0.38,
    showRings:    true,
    maxConnections: 8,
  });

  const worldMap = new OrbiqaWorldMap('worldMapCanvas');

  /* ── Scroll-sync for network story ──────────────────────────────── */
  const networkStory = document.getElementById('network-story');
  if (networkStory && networkGlobe) {
    window.addEventListener('scroll', () => {
      const rect  = networkStory.getBoundingClientRect();
      const total = networkStory.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const scrolled = -rect.top;
      const raw      = Math.max(0, Math.min(1, scrolled / total));

      let phase;
      if (raw < 0.33)      phase = 0;
      else if (raw < 0.66) phase = (raw - 0.33) / 0.33 * 0.5;
      else                 phase = 0.5 + (raw - 0.66) / 0.34 * 0.5;

      networkGlobe.setPhase(phase);
    }, { passive: true });
  }

  /* ── Mouse parallax on hero ──────────────────────────────────────── */
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let rafId = null;

    document.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      targetX  = ((e.clientX - cx) / cx) * -15;
      targetY  = ((e.clientY - cy) / cy) * -15;
    });

    function lerpParallax() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      if (window.scrollY < window.innerHeight) {
        heroContent.style.transform = `translateX(${currentX.toFixed(2)}px) translateY(${currentY.toFixed(2)}px)`;
      }
      rafId = requestAnimationFrame(lerpParallax);
    }
    lerpParallax();
  }

  /* ── 3D card tilt ────────────────────────────────────────────────── */
  function addTilt(selector) {
    document.querySelectorAll(selector).forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect  = card.getBoundingClientRect();
        const relX  = (e.clientX - rect.left) / rect.width  - 0.5;
        const relY  = (e.clientY - rect.top)  / rect.height - 0.5;
        const rotX  = -(relY * 16).toFixed(2);  // max ±8°
        const rotY  =  (relX * 16).toFixed(2);
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-5px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
  addTilt('.pillar-card');
  addTilt('.tv-card');

  /* ── Plan card hover glow ────────────────────────────────────────── */
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 0 40px rgba(27,111,255,0.15), 0 24px 64px rgba(0,0,0,0.6)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
    });
  });

  /* ── Hero text entrance ──────────────────────────────────────────── */
  setTimeout(() => {
    document.querySelectorAll('.hero-headline .line').forEach((line) => {
      const delay = parseInt(line.dataset.delay || 0);
      setTimeout(() => line.classList.add('visible'), delay);
    });
    const sub    = document.querySelector('.hero-subheadline');
    const cta    = document.querySelector('.hero-cta');
    const eyebrow = document.querySelector('.hero .eyebrow');
    if (eyebrow) setTimeout(() => eyebrow.classList.add('visible'), 0);
    if (sub)     setTimeout(() => sub.classList.add('visible'), 480);
    if (cta)     setTimeout(() => cta.classList.add('visible'), 660);
  }, 200);

  /* ── Number counter ──────────────────────────────────────────────── */
  function animateCounter(el) {
    // Skip static elements
    if (el.dataset.static === 'true') return;
    const target   = parseFloat(el.dataset.target);
    const suffix   = el.dataset.suffix || '';
    const prefix   = el.dataset.prefix || '';
    const decimal  = parseInt(el.dataset.decimal || 0);
    const duration = 1400;
    const start    = performance.now();

    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = target * eased;
      el.textContent = prefix + (decimal > 0 ? current.toFixed(decimal) : Math.floor(current)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + (decimal > 0 ? target.toFixed(decimal) : target) + suffix;
    }
    requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-number[data-target]').forEach(el => {
    if (el.dataset.static === 'true') return; // skip #1
    counterObserver.observe(el);
  });

  /* ── Plan toggle ─────────────────────────────────────────────────── */
  let planType = 'personal';
  let billing  = 'monthly';

  function updatePrices() {
    document.querySelectorAll('.price-amount').forEach(el => {
      const key = planType + billing.charAt(0).toUpperCase() + billing.slice(1);
      const val = el.dataset[key];
      if (!val) return;
      animatePriceChange(el, parseInt(el.textContent), parseInt(val));
    });
    document.querySelectorAll('.price-period').forEach(el => {
      el.textContent = billing === 'annual' ? '/mo*' : '/mo';
    });
  }

  function animatePriceChange(el, from, to) {
    const duration = 400;
    const start    = performance.now();
    function tick(now) {
      const p     = Math.min((now - start) / duration, 1);
      const eased = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = to;
    }
    requestAnimationFrame(tick);
  }

  const typeToggle    = document.getElementById('planTypeToggle');
  const billingToggle = document.getElementById('billingToggle');

  typeToggle && typeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      typeToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      planType = btn.dataset.type;
      updatePrices();
    });
  });

  billingToggle && billingToggle.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      billingToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      billing = btn.dataset.billing;
      updatePrices();
    });
  });

  /* ── Testimonials carousel (grid overlap) ────────────────────────── */
  const carousel      = document.getElementById('testimonialsCarousel');
  const dotsContainer = document.getElementById('carouselDots');
  const prevBtn       = document.getElementById('testimonialPrev');
  const nextBtn       = document.getElementById('testimonialNext');

  if (carousel) {
    const cards = carousel.querySelectorAll('.testimonial-card');
    let current = 0;
    let autoTimer;

    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Testimonial ${i+1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsContainer && dotsContainer.appendChild(dot);
    });

    function goTo(index) {
      cards[current].classList.remove('active');
      dotsContainer && dotsContainer.querySelectorAll('.carousel-dot')[current]?.classList.remove('active');
      current = (index + cards.length) % cards.length;
      cards[current].classList.add('active');
      dotsContainer && dotsContainer.querySelectorAll('.carousel-dot')[current]?.classList.add('active');
      resetAuto();
    }

    function resetAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => goTo(current + 1), 5000);
    }

    cards[0].classList.add('active');
    prevBtn && prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn && nextBtn.addEventListener('click', () => goTo(current + 1));
    resetAuto();

    let touchStartX = 0;
    carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
    });
  }

  /* ── Coverage form ───────────────────────────────────────────────── */
  const coverageForm   = document.getElementById('coverageForm');
  const coverageResult = document.getElementById('coverageResult');
  const addressInput   = document.getElementById('addressInput');

  coverageForm && coverageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const addr = addressInput ? addressInput.value.trim() : '';
    if (!addr) return;
    coverageResult.style.display = 'flex';
    coverageResult.innerHTML = '<div class="coverage-loading"><span class="cov-dot"></span> Checking coverage...</div>';
    setTimeout(() => {
      coverageResult.innerHTML = `
        <div class="coverage-success">
          <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
            <circle cx="12" cy="12" r="10" stroke="#1B6FFF" stroke-width="1.5"/>
            <polyline points="7,12 10,15 17,9" stroke="#1B6FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div>
            <strong>Great news! 5G Ultra is available at your address.</strong>
            <span>Fiber + 5G coverage confirmed for "${addr}"</span>
          </div>
          <a href="internet.html" class="btn btn-primary btn-sm btn-signal">View Plans</a>
        </div>`;
    }, 1800);
  });

  /* ── Speed arc animation ─────────────────────────────────────────── */
  const arcObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('arc-animated');
        arcObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.arc-fill').forEach(el => arcObserver.observe(el));

  /* ── TV cards drag scroll ────────────────────────────────────────── */
  const tvTrack = document.querySelector('.tv-cards');
  if (tvTrack) {
    let isDown = false, startX, scrollLeft;
    tvTrack.addEventListener('mousedown', e => {
      isDown = true; tvTrack.classList.add('dragging');
      startX = e.pageX - tvTrack.offsetLeft;
      scrollLeft = tvTrack.scrollLeft;
    });
    tvTrack.addEventListener('mouseleave', () => { isDown = false; tvTrack.classList.remove('dragging'); });
    tvTrack.addEventListener('mouseup',    () => { isDown = false; tvTrack.classList.remove('dragging'); });
    tvTrack.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - tvTrack.offsetLeft;
      tvTrack.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
  }

  /* ── Business node animation ─────────────────────────────────────── */
  const nodeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('nodes-active');
        nodeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  const nodesEl = document.querySelector('.network-nodes');
  nodesEl && nodeObserver.observe(nodesEl);

  /* ── Network story scroll chapters ───────────────────────────────── */
  const chapters = document.querySelectorAll('.network-chapter');
  if (chapters.length) {
    const chapterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('chapter-active');
        else entry.target.classList.remove('chapter-active');
      });
    }, { threshold: 0.4 });
    chapters.forEach(ch => chapterObserver.observe(ch));
  }

  /* ── Phone app UI live data ──────────────────────────────────────── */
  function animatePhoneStats() {
    const speedDown = document.querySelector('.speed-row:nth-child(1) .speed-num');
    const speedUp   = document.querySelector('.speed-row:nth-child(2) .speed-num');
    if (!speedDown || !speedUp) return;
    setInterval(() => {
      speedDown.textContent = (700 + Math.random() * 300).toFixed(0) + ' Mbps';
      speedUp.textContent   = (300 + Math.random() * 200).toFixed(0) + ' Mbps';
    }, 3000);
  }
  animatePhoneStats();

  /* ── Prefers-reduced-motion ──────────────────────────────────────── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--transition-speed', '0ms');
  }

});
