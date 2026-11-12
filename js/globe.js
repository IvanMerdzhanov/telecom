/**
 * Orbiqa Globe Engine — v2
 * Canvas-based globe with IntersectionObserver pause/resume,
 * setPhase() for scroll-sync, destination flash bursts,
 * continent outlines on world map, mobile performance reduction.
 */

/* ─── Continent polygon data [lng, lat] ─────────────────────────── */
const CONTINENTS = {
  'North America': [[-140,70],[-125,50],[-124,40],[-117,32],[-97,26],[-90,20],[-85,10],[-77,8],[-83,8],[-87,15],[-90,18],[-97,22],[-105,23],[-115,30],[-120,38],[-125,48],[-140,70]],
  'South America': [[-73,12],[-63,10],[-60,5],[-50,0],[-35,-5],[-39,-15],[-43,-23],[-50,-33],[-58,-35],[-65,-42],[-68,-55],[-72,-55],[-75,-45],[-72,-30],[-70,-20],[-80,-5],[-77,8],[-73,12]],
  'Europe':        [[10,60],[15,70],[25,71],[28,65],[25,60],[20,55],[15,57],[5,58],[0,51],[5,43],[10,44],[15,38],[25,38],[28,42],[40,45],[40,55],[28,65],[25,71]],
  'Africa':        [[-5,35],[10,37],[20,37],[32,32],[42,12],[45,12],[40,0],[40,-10],[32,-25],[28,-33],[18,-35],[15,-30],[12,-18],[10,-5],[10,5],[0,5],[-15,10],[-15,15],[-17,20],[-15,28],[-5,35]],
  'Asia':          [[28,42],[35,42],[50,30],[60,22],[70,22],[80,8],[90,8],[100,5],[110,3],[120,5],[130,32],[140,40],[145,45],[142,55],[135,55],[130,42],[120,40],[100,45],[90,50],[80,55],[70,55],[60,55],[50,50],[40,55],[30,55],[28,50],[28,42]],
  'Australia':     [[114,-22],[115,-35],[120,-35],[130,-32],[135,-35],[140,-38],[145,-38],[150,-35],[153,-28],[148,-20],[140,-15],[136,-12],[130,-15],[125,-18],[114,-22]],
};

/* ─── OrbiqaGlobe ────────────────────────────────────────────────── */
class OrbiqaGlobe {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.rotation = options.startRotation || 0;
    this.rotationSpeed = (2 * Math.PI) / (90 * 60);
    this.centerXRatio = options.centerXRatio || 0.62;
    this.centerYRatio = options.centerYRatio || 0.50;
    this.radiusRatio  = options.radiusRatio  || 0.36;
    this.showRings    = options.showRings !== false;
    this.connections  = [];
    this.maxConnections = options.maxConnections || 5;
    this.lastConnectionTime = 0;
    this.connectionInterval = 2200;
    this.animFrame    = null;
    this._running     = false;
    this._phase       = 0;   // 0-1, controlled by scroll
    this._flashes     = [];  // destination flash bursts

    this.cities = [
      { name: 'London',       lat: 51.5,  lng: -0.1   },
      { name: 'New York',     lat: 40.7,  lng: -74.0  },
      { name: 'Tokyo',        lat: 35.7,  lng: 139.7  },
      { name: 'Sydney',       lat: -33.9, lng: 151.2  },
      { name: 'Dubai',        lat: 25.2,  lng: 55.3   },
      { name: 'Mumbai',       lat: 19.1,  lng: 72.9   },
      { name: 'São Paulo',    lat: -23.5, lng: -46.6  },
      { name: 'Cairo',        lat: 30.1,  lng: 31.2   },
      { name: 'Lagos',        lat: 6.5,   lng: 3.4    },
      { name: 'Mexico City',  lat: 19.4,  lng: -99.1  },
      { name: 'Beijing',      lat: 39.9,  lng: 116.4  },
      { name: 'Singapore',    lat: 1.4,   lng: 103.8  },
      { name: 'Paris',        lat: 48.9,  lng: 2.3    },
      { name: 'Los Angeles',  lat: 34.1,  lng: -118.2 },
      { name: 'Johannesburg', lat: -26.2, lng: 28.0   },
      { name: 'Moscow',       lat: 55.8,  lng: 37.6   },
      { name: 'Jakarta',      lat: -6.2,  lng: 106.8  },
      { name: 'Buenos Aires', lat: -34.6, lng: -58.4  },
      { name: 'Seoul',        lat: 37.6,  lng: 127.0  },
      { name: 'Chicago',      lat: 41.9,  lng: -87.6  },
      { name: 'Toronto',      lat: 43.7,  lng: -79.4  },
      { name: 'Amsterdam',    lat: 52.4,  lng: 4.9    },
      { name: 'Nairobi',      lat: -1.3,  lng: 36.8   },
      { name: 'Bangkok',      lat: 13.8,  lng: 100.5  },
    ];

    this.globeDots = this.generateGlobeDots();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // IntersectionObserver — pause when off-screen
    this._io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) this.resume();
        else this.pause();
      });
    }, { threshold: 0 });
    this._io.observe(this.canvas);

    this.resume();
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  pause() {
    if (!this._running) return;
    this._running = false;
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
  }

  resume() {
    if (this._running) return;
    this._running = true;
    this.animFrame = requestAnimationFrame(ts => this._tick(ts));
  }

  /** setPhase: 0 = minimal connections/dim rings, 1 = full density/bright rings */
  setPhase(p) {
    this._phase = Math.max(0, Math.min(1, p));
    // Adjust maxConnections dynamically
    this._effectiveMax = Math.round(2 + this._phase * (this.maxConnections - 2));
  }

  destroy() {
    this.pause();
    this._io.disconnect();
  }

  /* ── Geometry ───────────────────────────────────────────────────── */
  resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
    this.W  = w; this.H = h;
    this.cx = w * this.centerXRatio;
    this.cy = h * this.centerYRatio;
    this.R  = Math.min(w, h) * this.radiusRatio;
  }

  generateGlobeDots() {
    const dots = [];
    for (let lat = -80; lat <= 80; lat += 9) {
      const c = Math.cos(lat * Math.PI / 180);
      const count = Math.max(4, Math.round(c * 36));
      for (let i = 0; i < count; i++) {
        dots.push({ lat, lng: -180 + (360 / count) * i });
      }
    }
    return dots;
  }

  toCartesian(lat, lng, r) {
    const phi   = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return {
      x: -r * Math.sin(phi) * Math.cos(theta),
      y:  r * Math.cos(phi),
      z:  r * Math.sin(phi) * Math.sin(theta),
    };
  }

  project(p, rot) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const rx = p.x * cos + p.z * sin;
    const ry = p.y;
    const rz = -p.x * sin + p.z * cos;
    const visible = rz <= this.R * 0.05;
    const s = 1.6 / (1.6 + rz / this.R * 0.4);
    return { x: this.cx + rx * s, y: this.cy - ry * s, visible, depth: rz };
  }

  slerpPoints(a, b, t) {
    const la = Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
    const lb = Math.sqrt(b.x*b.x + b.y*b.y + b.z*b.z);
    const na = { x:a.x/la, y:a.y/la, z:a.z/la };
    const nb = { x:b.x/lb, y:b.y/lb, z:b.z/lb };
    const dot = Math.max(-1, Math.min(1, na.x*nb.x + na.y*nb.y + na.z*nb.z));
    const omega = Math.acos(dot);
    if (Math.abs(omega) < 0.001) return { x:na.x*this.R, y:na.y*this.R, z:na.z*this.R };
    const sinO = Math.sin(omega);
    const s1 = Math.sin((1-t)*omega) / sinO;
    const s2 = Math.sin(t*omega)     / sinO;
    return { x:(s1*na.x + s2*nb.x)*this.R, y:(s1*na.y + s2*nb.y)*this.R, z:(s1*na.z + s2*nb.z)*this.R };
  }

  /* ── Connection Management ─────────────────────────────────────── */
  spawnConnection() {
    const maxEff = this._effectiveMax !== undefined ? this._effectiveMax : this.maxConnections;
    const alive = this.connections.filter(c => !(c.progress >= 1 && c.fade >= 1));
    if (alive.length >= maxEff) return;
    this.connections = alive;
    const i = Math.floor(Math.random() * this.cities.length);
    let j = Math.floor(Math.random() * this.cities.length);
    while (j === i) j = Math.floor(Math.random() * this.cities.length);
    const colors = ['#1B6FFF','#7B3FFF','#D42AFF'];
    this.connections.push({
      from: this.cities[i],
      to:   this.cities[j],
      progress: 0, fade: 0,
      speed: 0.003 + Math.random() * 0.003,
      color: colors[Math.floor(Math.random() * colors.length)],
      flashed: false,
    });
  }

  /* ── Draw ───────────────────────────────────────────────────────── */
  drawAtmosphere() {
    const g = this.ctx.createRadialGradient(this.cx, this.cy, this.R*0.82, this.cx, this.cy, this.R*1.22);
    g.addColorStop(0, 'rgba(27,111,255,0.18)');
    g.addColorStop(0.5,'rgba(27,111,255,0.06)');
    g.addColorStop(1, 'rgba(27,111,255,0)');
    this.ctx.beginPath();
    this.ctx.arc(this.cx, this.cy, this.R*1.22, 0, Math.PI*2);
    this.ctx.fillStyle = g;
    this.ctx.fill();
  }

  drawSphere() {
    const g = this.ctx.createRadialGradient(this.cx - this.R*0.28, this.cy - this.R*0.28, 0, this.cx, this.cy, this.R);
    g.addColorStop(0,  '#1C2860');
    g.addColorStop(0.45,'#0B0F2E');
    g.addColorStop(1,  '#05081A');
    this.ctx.beginPath();
    this.ctx.arc(this.cx, this.cy, this.R, 0, Math.PI*2);
    this.ctx.fillStyle = g;
    this.ctx.fill();

    const h = this.ctx.createRadialGradient(this.cx - this.R*0.38, this.cy - this.R*0.38, 0, this.cx - this.R*0.2, this.cy - this.R*0.2, this.R*0.7);
    h.addColorStop(0, 'rgba(27,111,255,0.18)');
    h.addColorStop(1, 'rgba(27,111,255,0)');
    this.ctx.beginPath();
    this.ctx.arc(this.cx, this.cy, this.R, 0, Math.PI*2);
    this.ctx.fillStyle = h;
    this.ctx.fill();
  }

  drawDots() {
    const ctx = this.ctx;
    for (const d of this.globeDots) {
      const p3 = this.toCartesian(d.lat, d.lng, this.R);
      const p2 = this.project(p3, this.rotation);
      if (!p2.visible) continue;
      const dx = p2.x - this.cx, dy = p2.y - this.cy;
      const dist  = Math.sqrt(dx*dx + dy*dy) / this.R;
      const alpha = Math.max(0, (0.55 - dist * 0.45)) * (1 - p2.depth / (this.R * 1.2));
      if (alpha <= 0) continue;
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 1, 0, Math.PI*2);
      ctx.fillStyle = `rgba(100,160,255,${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  drawCities() {
    const ctx = this.ctx;
    for (const city of this.cities) {
      const p3 = this.toCartesian(city.lat, city.lng, this.R);
      const p2 = this.project(p3, this.rotation);
      if (!p2.visible) continue;
      const glow = ctx.createRadialGradient(p2.x, p2.y, 0, p2.x, p2.y, 9);
      glow.addColorStop(0, 'rgba(91,175,255,0.7)');
      glow.addColorStop(1, 'rgba(27,111,255,0)');
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 9, 0, Math.PI*2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI*2);
      ctx.fillStyle = '#8FCCFF';
      ctx.fill();
    }
  }

  drawConnections() {
    const ctx = this.ctx;
    const toRemove = [];
    for (let ci = 0; ci < this.connections.length; ci++) {
      const conn = this.connections[ci];
      const p1 = this.toCartesian(conn.from.lat, conn.from.lng, this.R);
      const p2 = this.toCartesian(conn.to.lat, conn.to.lng, this.R);
      const steps  = 80;
      const drawTo = Math.floor(conn.progress * steps);
      const alpha  = conn.progress < 1 ? 0.9 : Math.max(0, 0.9 * (1 - conn.fade));

      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i <= drawTo; i++) {
        const pt   = this.slerpPoints(p1, p2, i / steps);
        const proj = this.project(pt, this.rotation);
        if (!proj.visible) { penDown = false; continue; }
        if (!penDown) { ctx.moveTo(proj.x, proj.y); penDown = true; }
        else ctx.lineTo(proj.x, proj.y);
      }
      ctx.globalAlpha  = alpha;
      ctx.strokeStyle  = conn.color;
      ctx.lineWidth    = 1.5;
      ctx.shadowColor  = conn.color;
      ctx.shadowBlur   = 6;
      ctx.stroke();
      ctx.shadowBlur   = 0;
      ctx.globalAlpha  = 1;

      // Leading dot
      if (conn.progress < 1 && conn.progress > 0) {
        const tip  = this.slerpPoints(p1, p2, conn.progress);
        const tp   = this.project(tip, this.rotation);
        if (tp.visible) {
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 4, 0, Math.PI*2);
          ctx.fillStyle = conn.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Advance
      if (conn.progress < 1) {
        conn.progress = Math.min(1, conn.progress + conn.speed);
        // Destination flash when arc completes
        if (conn.progress >= 1 && !conn.flashed) {
          conn.flashed = true;
          const destP3 = this.toCartesian(conn.to.lat, conn.to.lng, this.R);
          const destP2 = this.project(destP3, this.rotation);
          if (destP2.visible) {
            this._flashes.push({ x: destP2.x, y: destP2.y, frame: 0, color: conn.color });
          }
        }
      } else {
        conn.fade = Math.min(1, conn.fade + 0.004);
      }
    }
    // Remove fully faded
    this.connections = this.connections.filter(c => !(c.progress >= 1 && c.fade >= 1));
  }

  drawFlashes() {
    const ctx = this.ctx;
    for (let i = this._flashes.length - 1; i >= 0; i--) {
      const f = this._flashes[i];
      const a = Math.max(0, 1 - f.frame / 3);
      const r = 4 + f.frame * 8;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(2)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI*2);
      ctx.fillStyle = g;
      ctx.fill();
      f.frame++;
      if (f.frame > 3) this._flashes.splice(i, 1);
    }
  }

  drawOrbitalRings(time) {
    const ctx = this.ctx;
    const R   = this.R;
    const phaseAlpha = 0.3 + this._phase * 0.7; // 0.3 dim → 1.0 bright

    // Ring 1 — blue
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(0.28);
    ctx.scale(1, 0.28);
    const g1 = ctx.createLinearGradient(-R*1.28, 0, R*1.28, 0);
    g1.addColorStop(0,    `rgba(27,111,255,0)`);
    g1.addColorStop(0.25, `rgba(27,111,255,${(0.7*phaseAlpha).toFixed(2)})`);
    g1.addColorStop(0.75, `rgba(123,63,255,${(0.7*phaseAlpha).toFixed(2)})`);
    g1.addColorStop(1,    `rgba(123,63,255,0)`);
    ctx.beginPath();
    ctx.ellipse(0, 0, R*1.28, R*1.28, 0, 0, Math.PI*2);
    ctx.strokeStyle = g1; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    // Ring 2 — violet/magenta
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(-0.48 + Math.sin(time * 0.07) * 0.04);
    ctx.scale(1, 0.2);
    const g2 = ctx.createLinearGradient(-R*1.52, 0, R*1.52, 0);
    g2.addColorStop(0,   `rgba(212,42,255,0)`);
    g2.addColorStop(0.3, `rgba(212,42,255,${(0.6*phaseAlpha).toFixed(2)})`);
    g2.addColorStop(0.7, `rgba(123,63,255,${(0.6*phaseAlpha).toFixed(2)})`);
    g2.addColorStop(1,   `rgba(123,63,255,0)`);
    ctx.beginPath();
    ctx.ellipse(0, 0, R*1.52, R*1.52, 0, 0, Math.PI*2);
    ctx.strokeStyle = g2; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();

    // Ring 3 — amber
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(0.78 + Math.sin(time * 0.05) * 0.03);
    ctx.scale(1, 0.15);
    const g3 = ctx.createLinearGradient(-R*1.72, 0, R*1.72, 0);
    g3.addColorStop(0,    `rgba(255,140,42,0)`);
    g3.addColorStop(0.45, `rgba(255,140,42,${(0.5*phaseAlpha).toFixed(2)})`);
    g3.addColorStop(0.55, `rgba(255,140,42,${(0.5*phaseAlpha).toFixed(2)})`);
    g3.addColorStop(1,    `rgba(255,140,42,0)`);
    ctx.beginPath();
    ctx.ellipse(0, 0, R*1.72, R*1.72, 0, 0, Math.PI*2);
    ctx.strokeStyle = g3; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  /* ── Animation loop ─────────────────────────────────────────────── */
  _tick(timestamp) {
    if (!this._running) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.rotation += this.rotationSpeed;
    const time = timestamp / 1000;

    if (timestamp - this.lastConnectionTime > this.connectionInterval) {
      this.spawnConnection();
      this.lastConnectionTime = timestamp;
    }

    this.drawAtmosphere();
    this.drawSphere();
    this.drawDots();
    this.drawConnections();
    this.drawFlashes();
    this.drawCities();
    if (this.showRings) this.drawOrbitalRings(time);

    this.animFrame = requestAnimationFrame(ts => this._tick(ts));
  }
}

/* ─── OrbiqaWorldMap ─────────────────────────────────────────────── */
class OrbiqaWorldMap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this._running = false;
    this._animFrame = null;

    this.cities = [
      { name: 'London',       lat: 51.5,  lng: -0.1,   size: 4 },
      { name: 'New York',     lat: 40.7,  lng: -74.0,  size: 4 },
      { name: 'Tokyo',        lat: 35.7,  lng: 139.7,  size: 4 },
      { name: 'Sydney',       lat: -33.9, lng: 151.2,  size: 3 },
      { name: 'Dubai',        lat: 25.2,  lng: 55.3,   size: 3 },
      { name: 'Mumbai',       lat: 19.1,  lng: 72.9,   size: 3 },
      { name: 'São Paulo',    lat: -23.5, lng: -46.6,  size: 3 },
      { name: 'Cairo',        lat: 30.1,  lng: 31.2,   size: 3 },
      { name: 'Lagos',        lat: 6.5,   lng: 3.4,    size: 3 },
      { name: 'Mexico City',  lat: 19.4,  lng: -99.1,  size: 3 },
      { name: 'Beijing',      lat: 39.9,  lng: 116.4,  size: 4 },
      { name: 'Singapore',    lat: 1.4,   lng: 103.8,  size: 3 },
      { name: 'Paris',        lat: 48.9,  lng: 2.3,    size: 3 },
      { name: 'Johannesburg', lat: -26.2, lng: 28.0,   size: 3 },
      { name: 'Moscow',       lat: 55.8,  lng: 37.6,   size: 3 },
      { name: 'Los Angeles',  lat: 34.1,  lng: -118.2, size: 3 },
      { name: 'Seoul',        lat: 37.6,  lng: 127.0,  size: 3 },
      { name: 'Buenos Aires', lat: -34.6, lng: -58.4,  size: 3 },
      { name: 'Nairobi',      lat: -1.3,  lng: 36.8,   size: 2 },
      { name: 'Jakarta',      lat: -6.2,  lng: 106.8,  size: 3 },
      { name: 'Toronto',      lat: 43.7,  lng: -79.4,  size: 3 },
      { name: 'Amsterdam',    lat: 52.4,  lng: 4.9,    size: 2 },
      { name: 'Bangkok',      lat: 13.8,  lng: 100.5,  size: 3 },
      { name: 'Istanbul',     lat: 41.0,  lng: 28.9,   size: 3 },
      { name: 'Casablanca',   lat: 33.6,  lng: -7.6,   size: 2 },
    ];

    // Mobile: reduce city count for performance
    if (window.innerWidth < 768) {
      this.cities = this.cities.filter((_, i) => i % 2 === 0);
    }

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // IntersectionObserver
    this._io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) this._startAnim();
        else this._stopAnim();
      });
    }, { threshold: 0 });
    this._io.observe(this.canvas);

    this._startAnim();
  }

  _startAnim() {
    if (this._running) return;
    this._running = true;
    this._animFrame = requestAnimationFrame(ts => this._tick(ts));
  }

  _stopAnim() {
    this._running = false;
    if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w   = this.canvas.parentElement.clientWidth;
    const h   = this.canvas.parentElement.clientHeight;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
    this.W = w; this.H = h;
  }

  mercator(lat, lng) {
    const x      = (lng + 180) / 360 * this.W;
    const latRad = lat * Math.PI / 180;
    const mercN  = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y      = this.H / 2 - (mercN * this.H / (2 * Math.PI)) * 0.85;
    return { x, y };
  }

  drawDotGrid() {
    const ctx  = this.ctx;
    const step = window.innerWidth < 768 ? 18 : 12;
    for (let x = 0; x < this.W; x += step) {
      for (let y = 0; y < this.H; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(30,50,120,0.35)';
        ctx.fill();
      }
    }
  }

  drawContinents() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(27,111,255,0.15)';
    ctx.lineWidth   = 1.2;
    ctx.lineJoin    = 'round';

    for (const [name, coords] of Object.entries(CONTINENTS)) {
      if (coords.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < coords.length; i++) {
        const [lng, lat] = coords[i];
        const p = this.mercator(lat, lng);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  _tick(timestamp) {
    if (!this._running) return;
    const ctx = this.ctx;
    const t   = timestamp / 1000;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawDotGrid();
    this.drawContinents();

    // City pulses (on top)
    for (let i = 0; i < this.cities.length; i++) {
      const city  = this.cities[i];
      const pos   = this.mercator(city.lat, city.lng);
      const phase = (t + i * 0.7) % 3;

      if (phase < 2) {
        const pr      = phase / 2;
        const pulseR  = city.size * 2 + pr * 20;
        const pAlpha  = (1 - pr) * 0.4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(27,111,255,${pAlpha})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }

      const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, city.size * 3.5);
      g.addColorStop(0, 'rgba(91,175,255,0.9)');
      g.addColorStop(1, 'rgba(27,111,255,0)');
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, city.size * 3.5, 0, Math.PI*2);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, city.size * 0.8, 0, Math.PI*2);
      ctx.fillStyle = '#8FCCFF';
      ctx.fill();
    }

    this._animFrame = requestAnimationFrame(ts => this._tick(ts));
  }
}
