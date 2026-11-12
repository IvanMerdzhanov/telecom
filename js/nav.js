/**
 * Orbiqa nav.js — Shared navigation JS for all pages.
 * Handles: scroll nav, hamburger, mobile overlay,
 * touch dropdowns, smooth scroll, reveal observer,
 * theme toggle, FAQ accordions, tier tabs, forms.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Scroll nav ──────────────────────────────────────────────────── */
  const nav = document.getElementById('mainNav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 60) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Hamburger / overlay ─────────────────────────────────────────── */
  const hamburger = document.getElementById('navHamburger');
  const overlay   = document.getElementById('navOverlay');
  const closeBtn  = document.getElementById('navClose');

  function openNav() {
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    hamburger && hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeNav() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    hamburger && hamburger.setAttribute('aria-expanded', 'false');
  }

  hamburger && hamburger.addEventListener('click', openNav);
  closeBtn  && closeBtn.addEventListener('click', closeNav);
  overlay   && overlay.addEventListener('click', (e) => { if (e.target === overlay) closeNav(); });

  document.querySelectorAll('.nav-overlay-links a').forEach(a => a.addEventListener('click', closeNav));

  /* ── Dropdowns (touch devices) ───────────────────────────────────── */
  document.querySelectorAll('.nav-item.has-dropdown').forEach(item => {
    item.addEventListener('click', (e) => {
      if (window.innerWidth < 1024) {
        const link = item.querySelector('.nav-link');
        if (e.target === link || link.contains(e.target)) {
          e.preventDefault();
          const wasOpen = item.classList.contains('open');
          document.querySelectorAll('.nav-item.has-dropdown').forEach(i => i.classList.remove('open'));
          if (!wasOpen) item.classList.add('open');
        }
      }
    });
  });

  /* ── Smooth scroll for anchor links ─────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ── Reveal observer ─────────────────────────────────────────────── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el    = entry.target;
        const delay = parseInt(el.dataset.delay || 0);
        setTimeout(() => el.classList.add('in-view'), delay);
        revealObserver.unobserve(el);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ── Theme toggle ────────────────────────────────────────────────── */
  const themeBtn = document.getElementById('themeToggle');
  const HTML     = document.documentElement;

  function applyTheme(mode) {
    if (mode === 'light') {
      HTML.classList.add('light-mode');
      if (themeBtn) themeBtn.textContent = '☀️';
    } else {
      HTML.classList.remove('light-mode');
      if (themeBtn) themeBtn.textContent = '🌙';
    }
  }

  const savedTheme = localStorage.getItem('orbiqa-theme') || 'dark';
  applyTheme(savedTheme);

  themeBtn && themeBtn.addEventListener('click', () => {
    const current = HTML.classList.contains('light-mode') ? 'light' : 'dark';
    const next    = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('orbiqa-theme', next);
  });

  /* ── FAQ accordions ──────────────────────────────────────────────── */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const answer = item.querySelector('.faq-answer');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        const a = openItem.querySelector('.faq-answer');
        if (a) a.style.maxHeight = '0';
      });

      if (!isOpen) {
        item.classList.add('open');
        if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ── Tier tabs (business page) ───────────────────────────────────── */
  document.querySelectorAll('.tier-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tier;
      document.querySelectorAll('.tier-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tier-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('tier-' + target);
      if (panel) panel.classList.add('active');
    });
  });

  /* ── Contact / business form: show success ───────────────────────── */
  document.querySelectorAll('.contact-form-el').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = form.querySelector('.form-success-msg');
      if (msg) {
        msg.style.display = 'flex';
        form.reset();
        setTimeout(() => { msg.style.display = 'none'; }, 5000);
      }
    });
  });

  /* ── Coverage form on inner pages ────────────────────────────────── */
  document.querySelectorAll('.coverage-form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input  = form.querySelector('.coverage-input');
      const result = form.parentElement.querySelector('.coverage-result') ||
                     document.getElementById('coverageResult');
      if (!input || !result) return;
      const addr = input.value.trim();
      if (!addr) return;

      result.style.display = 'flex';
      result.innerHTML = '<div class="coverage-loading"><span class="cov-dot"></span> Checking coverage...</div>';

      setTimeout(() => {
        result.innerHTML = `
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
  });

  /* ── Support search (support page) ──────────────────────────────── */
  const supportSearch = document.getElementById('supportSearch');
  if (supportSearch) {
    supportSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = supportSearch.value.trim();
        if (q) {
          alert(`Searching for: "${q}"\n(Search results would appear here in a production system.)`);
        }
      }
    });
  }

  /* ── Leaflet map for coverage page ──────────────────────────────── */
  if (typeof L !== 'undefined') {
    const mapEl = document.getElementById('leaflet-map');
    if (mapEl) {
      const map = L.map('leaflet-map', {
        center: [20, 10],
        zoom: 2,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(map);

      const cities5G = [
        { name: 'London',    lat: 51.5,  lng: -0.1   },
        { name: 'New York',  lat: 40.7,  lng: -74.0  },
        { name: 'Tokyo',     lat: 35.7,  lng: 139.7  },
        { name: 'Dubai',     lat: 25.2,  lng: 55.3   },
        { name: 'Sydney',    lat: -33.9, lng: 151.2  },
        { name: 'Singapore', lat: 1.4,   lng: 103.8  },
        { name: 'Paris',     lat: 48.9,  lng: 2.3    },
        { name: 'Toronto',   lat: 43.7,  lng: -79.4  },
        { name: 'Seoul',     lat: 37.6,  lng: 127.0  },
        { name: 'São Paulo', lat: -23.5, lng: -46.6  },
      ];

      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:#1B6FFF;
          box-shadow:0 0 0 4px rgba(27,111,255,0.25), 0 0 12px rgba(27,111,255,0.5);
          border:2px solid #fff;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      cities5G.forEach(c => {
        L.marker([c.lat, c.lng], { icon: pulseIcon })
         .bindPopup(`<strong>${c.name}</strong><br><span style="color:#1B6FFF">5G Ultra Available</span>`)
         .addTo(map);
      });
    }

    /* Store locator map */
    const storeMapEl = document.getElementById('store-map');
    if (storeMapEl) {
      const storeMap = L.map('store-map', {
        center: [30, 5],
        zoom: 2,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(storeMap);

      const stores = [
        { name: 'Orbiqa NYC — Fifth Avenue',   addr: '500 Fifth Ave, New York, NY', hours: 'Mon–Sat 9am–8pm · Sun 10am–6pm', lat: 40.754, lng: -73.985 },
        { name: 'Orbiqa London — Regent St',   addr: '210 Regent St, London W1B', hours: 'Mon–Sat 9am–9pm · Sun 11am–6pm',  lat: 51.514, lng: -0.143  },
        { name: 'Orbiqa Dubai — Mall of Emirates', addr: 'Mall of Emirates, Dubai',  hours: 'Daily 10am–10pm',               lat: 25.119, lng: 55.200  },
        { name: 'Orbiqa Singapore — Orchard',  addr: '313 Orchard Rd, Singapore',   hours: 'Daily 10am–9pm',                lat: 1.300,  lng: 103.840 },
        { name: 'Orbiqa Sydney — Pitt St',     addr: '188 Pitt St, Sydney NSW',     hours: 'Mon–Sat 9am–7pm · Sun 10am–5pm',lat: -33.869, lng: 151.207 },
      ];

      const storeIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:#7B3FFF;
          box-shadow:0 0 0 5px rgba(123,63,255,0.25);
          border:2px solid #fff;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      stores.forEach(s => {
        L.marker([s.lat, s.lng], { icon: storeIcon })
         .bindPopup(`<strong>${s.name}</strong><br>${s.addr}<br><em>${s.hours}</em>`)
         .addTo(storeMap);
      });
    }
  }

  /* ── Scroll indicator fade (home) ────────────────────────────────── */
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (scrollIndicator) {
    window.addEventListener('scroll', () => {
      scrollIndicator.style.opacity = window.scrollY > 80 ? '0' : '1';
    }, { passive: true });
  }

  /* ── Signal pulse on CTA clicks ──────────────────────────────────── */
  document.querySelectorAll('.btn-signal').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const pulse = document.createElement('span');
      pulse.className = 'signal-pulse';
      const rect = this.getBoundingClientRect();
      pulse.style.left = (e.clientX - rect.left) + 'px';
      pulse.style.top  = (e.clientY - rect.top)  + 'px';
      this.appendChild(pulse);
      setTimeout(() => pulse.remove(), 600);
    });
  });

});
