(function (global) {
  const COLORS = {
    assassin: "#ff3355",
    tank: "#3da6ff",
    mage: "#c56bff",
    novice: "#c4b8a4",
    force: "#e23b4a",
    vital: "#5cff9a",
    haste: "#6ee0ff",
    shadow: "#9b8cff",
  };

  const LOOKS = [
    { coat: "#1a0c12", head: "#241018", trim: "#8a1424", aura: "rgba(138, 20, 40, 0.45)" },
    { coat: "#0e141c", head: "#161e2a", trim: "#3d8cff", aura: "rgba(40, 90, 180, 0.45)" },
    { coat: "#120c18", head: "#1c1424", trim: "#7a4cff", aura: "rgba(90, 40, 160, 0.45)" },
    { coat: "#16120c", head: "#221a12", trim: "#c48a28", aura: "rgba(160, 100, 20, 0.4)" },
    { coat: "#0c1612", head: "#14201a", trim: "#2ecc7a", aura: "rgba(20, 120, 70, 0.4)" },
    { coat: "#1a1014", head: "#26141c", trim: "#e07090", aura: "rgba(160, 50, 80, 0.4)" },
    { coat: "#121416", head: "#1c1e22", trim: "#8ab4c8", aura: "rgba(80, 130, 150, 0.4)" },
    { coat: "#1c140c", head: "#2a1c10", trim: "#d06020", aura: "rgba(160, 60, 10, 0.4)" },
    { coat: "#101018", head: "#181428", trim: "#c0b8e8", aura: "rgba(140, 120, 200, 0.4)" },
    { coat: "#14180c", head: "#1c2210", trim: "#a8c040", aura: "rgba(100, 130, 20, 0.4)" },
    { coat: "#180c18", head: "#221022", trim: "#e040c0", aura: "rgba(160, 20, 120, 0.4)" },
    { coat: "#0c1218", head: "#141c24", trim: "#20c8d0", aura: "rgba(20, 140, 150, 0.4)" },
    { coat: "#1c1010", head: "#281818", trim: "#e8d0a8", aura: "rgba(180, 140, 90, 0.35)" },
    { coat: "#10140c", head: "#182010", trim: "#68e0a0", aura: "rgba(40, 160, 90, 0.4)" },
    { coat: "#180e0c", head: "#241612", trim: "#ff6a40", aura: "rgba(180, 50, 20, 0.4)" },
    { coat: "#0e1014", head: "#161820", trim: "#6ee0ff", aura: "rgba(50, 170, 200, 0.4)" },
    { coat: "#1a0e16", head: "#26141e", trim: "#b04060", aura: "rgba(140, 30, 60, 0.4)" },
    { coat: "#12100c", head: "#1c1810", trim: "#d4a020", aura: "rgba(150, 110, 20, 0.4)" },
    { coat: "#0c0e16", head: "#141428", trim: "#5060ff", aura: "rgba(50, 60, 200, 0.4)" },
    { coat: "#16140e", head: "#201c14", trim: "#c4c4b0", aura: "rgba(160, 160, 140, 0.35)" },
    { coat: "#14080c", head: "#220c12", trim: "#ff2048", aura: "rgba(200, 20, 50, 0.42)" },
    { coat: "#081018", head: "#0c1824", trim: "#40f0c8", aura: "rgba(20, 180, 150, 0.4)" },
    { coat: "#161008", head: "#24180c", trim: "#ffc040", aura: "rgba(200, 140, 20, 0.4)" },
    { coat: "#100818", head: "#180c22", trim: "#b080ff", aura: "rgba(120, 70, 220, 0.42)" },
  ];

  const SELF_LOOK = { coat: "#12151a", head: "#1a1e24", trim: "#c9b48a", aura: "rgba(90, 212, 255, 0.18)" };
  const ALLY_LOOK = { coat: "#070910", head: "#0c1018", trim: "#5ad4ff", aura: "rgba(90, 212, 255, 0.22)" };
  const HIGH_TIER = { laser: 1, saber: 1, bazooka: 1, scythe: 1, mage: 1, katana: 1 };

  function hunterLook(p, role) {
    if (role === "self") {
      const trim = COLORS[p.c] || "#c4b8a4";
      return { coat: SELF_LOOK.coat, head: SELF_LOOK.head, trim: trim, aura: SELF_LOOK.aura };
    }
    if (role === "ally") {
      const trim = COLORS[p.c] || ALLY_LOOK.trim;
      return { coat: ALLY_LOOK.coat, head: ALLY_LOOK.head, trim: trim, aura: ALLY_LOOK.aura };
    }
    const i = ((p.sk == null ? 0 : p.sk) % LOOKS.length + LOOKS.length) % LOOKS.length;
    return LOOKS[i];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hash(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function rgbaHex(hex, a) {
    const n = parseInt(String(hex || "#5ad4ff").replace("#", "").slice(0, 6), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function passCfg() {
    return (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.BATTLE_PASS) || {};
  }

  function wepColorOf(id) {
    const w = passCfg().weapons && passCfg().weapons[id];
    if (!w) return "";
    return typeof w === "string" ? w : (w.blade || w.core || "");
  }

  function shotStyleOf(id) {
    const bp = passCfg();
    if (!id) return null;
    if (bp.shots && bp.shots[id]) return bp.shots[id];
    const w = bp.weapons && bp.weapons[id];
    if (w && typeof w === "object" && w.shot && bp.shots && bp.shots[w.shot]) return bp.shots[w.shot];
    if (typeof w === "string") return { fx: "bolt", core: w, glow: rgbaHex(w, 0.7), hex: w };
    if (w && typeof w === "object") {
      const c = w.blade || w.core || "#5ad4ff";
      return { fx: "bolt", core: c, glow: rgbaHex(c, 0.7), hex: c };
    }
    return null;
  }

  class Renderer {
    constructor(canvas, mini) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.mini = mini;
      this.mctx = mini.getContext("2d");
      this.cam = { x: 11000, y: 11000, z: 0.52 };
      this.baseZ = 0.52;
      this.zoomMul = 1;
      this._intelR = 1600;
      try {
        const saved = localStorage.getItem("shadowio-zoom-v2");
        if (saved != null && saved !== "") this.zoomMul = Renderer.snapZoom(saved);
        else this.zoomMul = 1;
      } catch (e) {}
      this.fx = [];
      this.dust = [];
      this.parts = [];
      this.lights = [];
      this.hpAnim = {};
      this.swingSeen = {};
      this.tintCache = {};
      this.t = 0;
      this.shake = 0;
      this.hitstop = 0;
      this.sx = 0;
      this.sy = 0;
      this.resize();
      window.addEventListener("resize", () => this.resize());
      document.addEventListener("fullscreenchange", () => this.resize());
      document.addEventListener("webkitfullscreenchange", () => this.resize());
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = (window.visualViewport && window.visualViewport.width) || innerWidth;
      const vh = (window.visualViewport && window.visualViewport.height) || innerHeight;
      this.canvas.width = Math.floor(vw * dpr);
      this.canvas.height = Math.floor(vh * dpr);
      this.dpr = dpr;
    }

    addFx(f) {
      const life = f.kind === "chest" && f.extra && f.extra !== "roulette" ? 3.4 : f.kind === "flame" ? 0.9 : (f.kind === "beam" || f.kind === "flash" ? 0.09 : f.kind === "orbhit" ? 0.2 : f.kind === "swing" ? 0.26 : f.kind === "absorb" ? 1.15 : 1.35);
      this.fx.push({ ...f, life });
      if (f.kind === "slash") this.spawnBurst(f.x, f.y, "spark", 14);
      else if (f.kind === "swing") this.spawnBurst(f.x, f.y, "spark", 10);
      else if (f.kind === "crit") this.spawnBurst(f.x, f.y, "crit", 18);
      else if (f.kind === "flash") this.spawnBurst(f.x, f.y, "energy", 6);
      else if (f.kind === "arise" || f.kind === "recall") this.spawnBurst(f.x, f.y, "energy", 16);
      else if (f.kind === "absorb") this.spawnSuck(f.x, f.y, 28);
      else if (f.kind === "dodge") this.spawnBurst(f.x, f.y, "dash", 14);
      else if (f.kind === "flame") this.spawnBurst(f.x, f.y, "flame", 18);
      else if (f.kind === "mega") this.spawnBurst(f.x, f.y, "crit", 22);
      else if (f.kind === "spawn") this.spawnBurst(f.x, f.y, "energy", 26);
    }

    impact(d) {
      this.shake = 0;
      this.hitstop = 0;
      if (d && d.x != null) this.spawnBurst(d.x, d.y, d.crit ? "crit" : "hit", d.crit ? 20 : 12);
    }

    pushLight(x, y, r, color) {
      if (this.lights.length > 72) return;
      this.lights.push({ x, y, r, color });
    }

    spawnBurst(x, y, type, n) {
      const count = n || 10;
      if (this.parts.length > 320) this.parts.splice(0, count);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = type === "dash" ? 1.2 + Math.random() * 2.2 : 1.6 + Math.random() * 4.4;
        const col =
          type === "flame"
            ? (Math.random() < 0.4 ? "rgba(255, 90, 30, 0.95)" : Math.random() < 0.5 ? "rgba(255, 180, 40, 0.95)" : "rgba(226, 40, 55, 0.9)")
            : type === "hit" || type === "crit"
            ? (Math.random() < 0.45 ? "rgba(226, 40, 55, 0.95)" : "rgba(255, 170, 70, 0.9)")
            : type === "energy"
              ? "rgba(90, 212, 255, 0.95)"
              : type === "dash"
                ? "rgba(180, 210, 255, 0.7)"
                : "rgba(255, 220, 140, 0.95)";
        this.parts.push({
          x, y,
          vx: Math.cos(a) * (type === "flame" ? sp * 0.45 : sp),
          vy: Math.sin(a) * (type === "flame" ? sp * 0.2 : sp) - (type === "flame" ? 2.4 : type === "hit" ? 1.2 : 0.4),
          life: 0.7 + Math.random() * 0.45,
          r: type === "dash" ? 1.2 + Math.random() : 1.4 + Math.random() * 2.4,
          type, color: col,
        });
      }
    }

    spawnSuck(x, y, n) {
      const count = n || 22;
      if (this.parts.length > 320) this.parts.splice(0, count);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rad = 36 + Math.random() * 78;
        const sp = 2.4 + Math.random() * 3.4;
        const col = i % 3 === 0
          ? "rgba(255, 230, 160, 0.95)"
          : i % 2 === 0
            ? "rgba(197, 107, 255, 0.95)"
            : "rgba(90, 212, 255, 0.95)";
        this.parts.push({
          x: x + Math.cos(a) * rad,
          y: y + Math.sin(a) * rad,
          vx: -Math.cos(a) * sp,
          vy: -Math.sin(a) * sp,
          life: 0.55 + Math.random() * 0.4,
          r: 2 + Math.random() * 3.2,
          type: "absorb",
          color: col,
        });
      }
    }

    collectLights(state) {
      this.lights = [];
      for (const g of GAME_CONFIG.GATES || []) this.pushLight(g.x, g.y + 8, 90, "rgba(90, 180, 255, 0.16)");
      for (const l of state.loots || []) {
        if (l.k === "orb") {
          const col = l.c === "force" ? "rgba(226, 59, 74, 0.28)" : l.c === "vital" ? "rgba(90, 212, 160, 0.18)" : l.c === "haste" ? "rgba(110, 224, 255, 0.2)" : "rgba(155, 140, 255, 0.2)";
          this.pushLight(l.x, l.y, 40 + (l.sz || 1) * 10, col);
        }
        else if (l.k === "chest") this.pushLight(l.x, l.y, 150, "rgba(90, 212, 255, 0.5)");
        else if (l.k === "mega") this.pushLight(l.x, l.y, 180, "rgba(255, 210, 90, 0.55)");
      }
      for (const p of state.projectiles || []) {
        const style = p.sk ? shotStyleOf(p.sk) : null;
        if (style) this.pushLight(p.x, p.y, 56, style.glow || "rgba(255, 180, 80, 0.3)");
        else {
          const c = p.k === "rocket" ? "rgba(255, 120, 40, 0.28)" : p.k === "pulse" ? "rgba(255, 50, 180, 0.32)" : p.k === "throw" ? "rgba(200, 210, 230, 0.22)" : p.k === "arrow" ? "rgba(220,230,255,0.12)" : "rgba(160, 120, 255, 0.22)";
          this.pushLight(p.x, p.y, p.k === "rocket" ? 70 : p.k === "pulse" ? 56 : p.k === "throw" ? 48 : 34, c);
        }
      }
      for (const p of state.players || []) {
        if (!p.a) continue;
        this.pushLight(p.x, p.y, 48, "rgba(90, 212, 255, 0.12)");
        if (p.mg > 0) this.pushLight(p.x, p.y, 72, "rgba(255, 196, 70, 0.12)");
        if (HIGH_TIER[p.w]) this.pushLight(p.x, p.y, 70, "rgba(90, 212, 255, 0.16)");
        const prev = this.swingSeen[p.i] || 0;
        if ((p.sw || 0) > 0.35 && prev < 0.35) this.spawnBurst(p.x, p.y, "spark", 8);
        this.swingSeen[p.i] = p.sw || 0;
      }
      for (const f of this.fx) {
        if (f.kind === "slash") this.pushLight(f.x, f.y, 70, "rgba(90, 212, 255, 0.18)");
        else if (f.kind === "flash" || f.kind === "orbhit") this.pushLight(f.x, f.y, f.kind === "orbhit" ? 52 : 36, "rgba(255, 70, 190, 0.28)");
        if (f.kind === "crit") this.pushLight(f.x, f.y, 80, "rgba(255, 50, 70, 0.22)");
        if (f.kind === "absorb") this.pushLight(f.x, f.y, 110, "rgba(197, 107, 255, 0.35)");
      }
    }

    drawFloorLights(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const L of this.lights) this.bloom(ctx, L.x, L.y + 10, L.r, L.color);
      ctx.restore();
    }

    drawParts(ctx) {
      const next = [];
      for (const p of this.parts) {
        p.life -= 0.028;
        if (p.life <= 0) continue;
        p.x += p.vx;
        p.y += p.vy;
        if (p.type !== "absorb") p.vy += 0.08;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.type === "hit" || p.type === "crit") {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.4, p.y + p.vy * 1.4);
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = p.color;
          ctx.stroke();
        } else if (p.type === "absorb") {
          ctx.ellipse(p.x, p.y, p.r * p.life * 1.4, p.r * p.life * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        next.push(p);
      }
      this.parts = next;
    }

    draw(state, meId) {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      this.t = state.t || this.t;
      const map = GAME_CONFIG.MAP_SIZE;
      const me = (state.players || []).find((p) => p.i === meId);
      const follow = state.follow;
      const focus = (follow && state.spectate) ? follow : me;
        if (focus) {
        this.cam.z = this.baseZ * (this.zoomMul || 1);
        this.cam.x = focus.x;
        this.cam.y = focus.y + 10;
      } else if (state.monarch || state.brBoss) {
        this.cam.x = lerp(this.cam.x, state.bx, 0.08);
        this.cam.y = lerp(this.cam.y, state.by, 0.08);
      }
      this.sx = 0;
      this.sy = 0;
      this.shake = 0;
      this.hitstop = 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = this.decor().canvas;
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const vw = w / this.dpr;
      const vh = h / this.dpr;
      this._vw = vw;
      this._vh = vh;
      this._intelR = Math.hypot(vw / (2 * this.baseZ), vh / (2 * this.baseZ)) + 80;

      ctx.save();
      ctx.translate(vw / 2 + this.sx, vh / 2 + this.sy);
      ctx.scale(this.cam.z, this.cam.z);
      ctx.translate(-this.cam.x, -this.cam.y);

      this.collectLights(state);
      this.drawGround(ctx, map, vw, vh);
      this.drawFloorLights(ctx);
      this.drawObstacles(ctx, state.obs || []);
      this.drawGates(ctx, state.portals);
      this.drawBarrierFill(ctx, state);
      this.drawDuelArena(ctx, state.duel, false);
      this.drawLoots(ctx, state.loots || []);
      this.drawMonsters(ctx, state.monsters || []);
      this.drawShadows(ctx, state.shadows || [], meId);
      for (const mini of state.minis || []) this.drawBoss(ctx, mini, true);
      if (state.brBoss) this.drawBoss(ctx, state.brBoss, true);
      if (state.monarch) this.drawBoss(ctx, state.monarch, true);
      this.drawProjectiles(ctx, state.projectiles || []);
      this.drawPlayers(ctx, state.players || [], meId);
      this.drawDuelArena(ctx, state.duel, true);
      this.drawBarrierRing(ctx, state);
      this.drawFx(ctx);
      this.drawParts(ctx);

      ctx.restore();
      this.drawLight(ctx, vw, vh, me);
      ctx.save();
      ctx.translate(vw / 2 + this.sx, vh / 2 + this.sy);
      ctx.scale(this.cam.z, this.cam.z);
      ctx.translate(-this.cam.x, -this.cam.y);
      this.drawChests(ctx, state.loots || []);
      this.drawMegaCubes(ctx, state.loots || []);
      ctx.restore();
      this.drawIntelMarks(ctx, vw, vh, state, meId);
      this.drawMinimap(state, meId, map);
    }

    viewBounds(vw, vh) {
      const z = this.cam.z;
      const hw = vw / (2 * z) + 80;
      const hh = vh / (2 * z) + 80;
      return {
        x0: this.cam.x - hw,
        y0: this.cam.y - hh,
        x1: this.cam.x + hw,
        y1: this.cam.y + hh,
      };
    }

    setZoomMul(n, persist) {
      const z = Renderer.snapZoom(n);
      this.zoomMul = z;
      this.cam.z = this.baseZ * z;
      if (persist !== false) {
        try { localStorage.setItem("shadowio-zoom-v2", String(z)); } catch (e) {}
      }
      return z;
    }

    inFairView(x, y, vw, vh) {
      const hw = vw / (2 * this.baseZ);
      const hh = vh / (2 * this.baseZ);
      return Math.abs(x - this.cam.x) <= hw && Math.abs(y - this.cam.y) <= hh;
    }

    drawIntelMarks(ctx, vw, vh, state, meId) {
      if ((this.zoomMul || 1) <= 1) return;
      const z = this.cam.z;
      const pad = 34;
      const add = (x, y, col) => {
        if (x == null || y == null) return;
        if (!this.inFairView(x, y, vw, vh)) return;
        const sx = (x - this.cam.x) * z + vw / 2;
        const sy = (y - this.cam.y) * z + vh / 2;
        if (sx >= pad && sx <= vw - pad && sy >= pad && sy <= vh - pad) return;
        marks.push({ sx, sy, col });
      };
      const marks = [];
      for (const p of state.players || []) {
        if (!p.a || p.i === meId) continue;
        add(p.x, p.y, "#ff6b73");
      }
      for (const m of state.monsters || []) add(m.x, m.y, "#c9b48a");
      for (const s of state.shadows || []) {
        if (s.o === meId) continue;
        add(s.x, s.y, "#9aa8c4");
      }
      for (const g of state.portals || []) add(g.x, g.y, g.col || "#e7c56a");
      for (const l of state.loots || []) {
        if (l.k === "chest") add(l.x, l.y, "#5ad4ff");
        else if (l.k === "mega") add(l.x, l.y, "#ffd24a");
      }
      if (state.monarch && state.monarch.a) add(state.monarch.x, state.monarch.y, "#ff4d5a");
      if (state.brBoss && state.brBoss.a) add(state.brBoss.x, state.brBoss.y, "#c56bff");
      for (const mini of state.minis || []) add(mini.x, mini.y, "#c56bff");
      const cx = vw / 2;
      const cy = vh / 2;
      const hw = vw / 2 - 22;
      const hh = vh / 2 - 22;
      ctx.save();
      for (let i = 0; i < marks.length && i < 28; i++) {
        const mk = marks[i];
        const dx = mk.sx - cx;
        const dy = mk.sy - cy;
        const ang = Math.atan2(dy, dx);
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const t = Math.min(hw / Math.max(0.001, Math.abs(c)), hh / Math.max(0.001, Math.abs(s)));
        ctx.save();
        ctx.translate(cx + c * t, cy + s * t);
        ctx.rotate(ang);
        ctx.fillStyle = mk.col;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-8, 7);
        ctx.lineTo(-8, -7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    bloom(ctx, x, y, r, color) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    cropAlpha(src) {
      const w = src.naturalWidth || src.width;
      const h = src.naturalHeight || src.height;
      if (!w || !h) return src;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.drawImage(src, 0, 0);
      const data = g.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] < 24) continue;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
      if (x1 <= x0 || y1 <= y0) return src;
      const pad = 4;
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(w - 1, x1 + pad);
      y1 = Math.min(h - 1, y1 + pad);
      const out = document.createElement("canvas");
      out.width = x1 - x0 + 1;
      out.height = y1 - y0 + 1;
      out.getContext("2d").drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return out;
    }

    getSprite(name, tint) {
      const bank = global.SpriteBank;
      const src = bank && bank.img && bank.img[name];
      if (!src) return null;
      const key = name + "|" + (tint || "");
      if (this.tintCache[key]) return this.tintCache[key];
      const c = document.createElement("canvas");
      c.width = src.naturalWidth || src.width;
      c.height = src.naturalHeight || src.height;
      if (!c.width || !c.height) return src;
      const g = c.getContext("2d");
      g.drawImage(src, 0, 0);
      if (tint) {
        g.globalCompositeOperation = "overlay";
        g.fillStyle = tint;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = "destination-in";
        g.drawImage(src, 0, 0);
      }
      const cropped = this.cropAlpha(c);
      this.tintCache[key] = cropped;
      return cropped;
    }

    drawModel(ctx, name, size, tint, facing) {
      const img = this.getSprite(name, tint);
      if (!img) return false;
      ctx.save();
      const flip = facing != null && Math.cos(facing) < 0 ? -1 : 1;
      ctx.scale(flip, 1);
      const w = size;
      const h = size * 1.28;
      ctx.drawImage(img, -w / 2, -h + 10, w, h);
      ctx.restore();
      return true;
    }

    hardStroke(ctx, color) {
      ctx.strokeStyle = color || "#05070a";
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "miter";
      ctx.stroke();
    }

    isLight() {
      return this.decor().id === "clair";
    }

    decor() {
      const id = document.body.getAttribute("data-decor") || "archive-marron";
      return (typeof shadowDecorOf === "function") ? shadowDecorOf(id) : { id: "archive-marron", canvas: "#1a1410", ground: "#2a2218", patchA: "#32281c", patchB: "#241c14", patchC: "#3a3024", grid: "rgba(201, 180, 138, 0.16)", mini: "#1c1610", miniDusk0: "rgba(90, 70, 40, 0.4)", miniDusk1: "rgba(18, 12, 8, 0.4)", miniGrid: "rgba(201, 180, 138, 0.16)", vignette: { a: "transparent", b: "rgba(0, 0, 0, 0.06)", c: "rgba(0, 0, 0, 0.22)", d: "rgba(0, 0, 0, 0.42)" }, sky: ["#3a2a1c", "#22180e", "#140e08"], spot: "rgba(201, 160, 90, 0.22)", mist: "rgba(12, 8, 4, 0.72)", shadow: "rgba(0, 0, 0, 0.45)", ring: "rgba(201, 180, 138, 0.35)" };
    }

    drawGround(ctx, map, vw, vh) {
      const d = this.decor();
      const b = this.viewBounds(vw, vh);
      ctx.fillStyle = d.ground;
      ctx.fillRect(0, 0, map, map);

      const step = 120;
      const x0 = Math.max(0, Math.floor(b.x0 / step) * step);
      const y0 = Math.max(0, Math.floor(b.y0 / step) * step);
      const x1 = Math.min(map, Math.ceil(b.x1 / step) * step);
      const y1 = Math.min(map, Math.ceil(b.y1 / step) * step);

      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const n = hash(x * 0.013 + y * 0.021);
          if (n < 0.22) ctx.fillStyle = d.patchA;
          else if (n < 0.4) ctx.fillStyle = d.patchB;
          else if (n < 0.55) ctx.fillStyle = d.patchC;
          else continue;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 18);
          ctx.lineTo(x + step * 0.62, y + 10);
          ctx.lineTo(x + step * 0.88, y + step * 0.55);
          ctx.lineTo(x + 18, y + step * 0.72);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      ctx.strokeStyle = d.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += step) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += step) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();

      for (let i = 0; i < 90; i++) {
        const x = hash(i * 3.1) * map;
        const y = hash(i * 7.7) * map;
        if (x < b.x0 - 80 || x > b.x1 + 80 || y < b.y0 - 80 || y > b.y1 + 80) continue;
        const kind = (i + (hash(i) * 8) | 0) % 5;
        if (kind === 2) this.crack(ctx, x, y);
        else if (kind === 3 || kind === 4) this.bush(ctx, x, y, 8 + hash(i) * 12);
      }
    }

    drawObstacles(ctx, list) {
      for (const o of list) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.ellipse(0, 8, o.r * 0.95, o.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        if (o.k === "ruin") {
          ctx.fillStyle = "#1a1218";
          ctx.fillRect(-o.r * 0.7, -o.r * 0.85, o.r * 1.4, o.r * 1.5);
          ctx.strokeStyle = "#3a3430";
          ctx.lineWidth = 2;
          ctx.strokeRect(-o.r * 0.7, -o.r * 0.85, o.r * 1.4, o.r * 1.5);
          ctx.fillStyle = "#08060a";
          ctx.fillRect(-o.r * 0.28, -o.r * 0.2, o.r * 0.55, o.r * 0.7);
        } else {
          const r = o.r;
          ctx.fillStyle = "#16181c";
          ctx.beginPath();
          ctx.moveTo(-r, 4);
          ctx.lineTo(-r * 0.55, -r * 0.55);
          ctx.lineTo(-r * 0.15, -r * 0.95);
          ctx.lineTo(r * 0.28, -r * 0.78);
          ctx.lineTo(r * 0.85, -r * 0.22);
          ctx.lineTo(r, 6);
          ctx.lineTo(r * 0.35, r * 0.48);
          ctx.lineTo(-r * 0.25, r * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#24282c";
          ctx.beginPath();
          ctx.moveTo(-r * 0.15, -r * 0.95);
          ctx.lineTo(r * 0.28, -r * 0.78);
          ctx.lineTo(r * 0.12, -r * 0.18);
          ctx.lineTo(-r * 0.38, -r * 0.12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#2a2e24";
          ctx.lineWidth = Math.max(1.5, r * 0.03);
          ctx.beginPath();
          ctx.moveTo(-r, 4);
          ctx.lineTo(-r * 0.55, -r * 0.55);
          ctx.lineTo(-r * 0.15, -r * 0.95);
          ctx.lineTo(r * 0.28, -r * 0.78);
          ctx.lineTo(r * 0.85, -r * 0.22);
          ctx.lineTo(r, 6);
          ctx.lineTo(r * 0.35, r * 0.48);
          ctx.closePath();
          ctx.stroke();
          if (r > 72) {
            ctx.fillStyle = "#121416";
            ctx.beginPath();
            ctx.moveTo(r * 0.18, r * 0.08);
            ctx.lineTo(r * 0.72, -r * 0.18);
            ctx.lineTo(r * 0.95, r * 0.22);
            ctx.lineTo(r * 0.42, r * 0.38);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    ruin(ctx, x, y, s) {
      ctx.fillStyle = "rgba(48, 38, 52, 0.85)";
      ctx.fillRect(x - s * 0.4, y - s * 0.5, s * 0.8, s);
      ctx.strokeStyle = "rgba(180, 140, 80, 0.25)";
      ctx.strokeRect(x - s * 0.4, y - s * 0.5, s * 0.8, s);
    }

    rock(ctx, x, y, r) {
      ctx.fillStyle = "#2a2620";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.62, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    crack(ctx, x, y) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - 30, y);
      ctx.lineTo(x - 8, y + 6);
      ctx.lineTo(x + 12, y - 4);
      ctx.lineTo(x + 34, y + 8);
      ctx.stroke();
    }

    bush(ctx, x, y, r) {
      ctx.fillStyle = "rgba(10, 14, 12, 0.95)";
      ctx.beginPath();
      ctx.moveTo(x - r, y + 4);
      ctx.lineTo(x - r * 0.3, y - r * 0.8);
      ctx.lineTo(x + 2, y - r * 0.2);
      ctx.lineTo(x + r * 0.7, y - r * 0.6);
      ctx.lineTo(x + r, y + 4);
      ctx.closePath();
      ctx.fill();
    }

    drawGates(ctx, list) {
      const gates = list || [];
      for (const g of gates) {
        if (Math.hypot(g.x - this.cam.x, g.y - this.cam.y) > (this._intelR || 1600)) continue;
        const col = g.col || g.color || "#5ad4ff";
        const pulse = 10 + Math.sin(this.t * 2.4 + g.x * 0.01) * 6;
        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.ph === "shadow") {
          const fade = Math.max(0.18, g.sh == null ? 0.7 : Math.min(1, g.sh / 1.35));
          ctx.globalAlpha = fade;
          ctx.fillStyle = "rgba(8, 10, 16, 0.92)";
          ctx.beginPath();
          ctx.ellipse(0, 12, 28, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(18, 24, 38, 0.96)";
          ctx.beginPath();
          ctx.ellipse(0, -8, 16, 30, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#5ad4ff";
          ctx.beginPath();
          ctx.arc(-6, -20, 3.2, 0, Math.PI * 2);
          ctx.arc(6, -20, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8ab4ff";
          ctx.font = "800 19px Cinzel, serif";
          ctx.textAlign = "center";
          ctx.fillText("Ombre", 0, -72);
          ctx.restore();
          continue;
        }
        const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 78 + pulse);
        glow.addColorStop(0, col);
        glow.addColorStop(0.25, rgbaHex(col, 0.55));
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 4, 78 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, 8, 46, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(6, 4, 12, 0.72)";
        ctx.beginPath();
        ctx.ellipse(0, 8, 38, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#efe7d6";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 8, 22, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.font = "800 17px Cinzel, serif";
        ctx.textAlign = "center";
        if (g.rnk || g.rank) ctx.fillText("Rang " + (g.rnk || g.rank), 0, -42);
        ctx.fillStyle = "#efe7d6";
        ctx.font = "800 20px Rajdhani, sans-serif";
        const bossName = (g.n || g.name || "Boss").slice(0, 28);
        ctx.strokeStyle = "rgba(4, 6, 10, 0.85)";
        ctx.lineWidth = 4;
        ctx.strokeText(bossName, 0, 48);
        ctx.fillText(bossName, 0, 48);
        ctx.fillStyle = col;
        ctx.font = "700 17px Rajdhani, sans-serif";
        ctx.strokeStyle = "rgba(4, 6, 10, 0.85)";
        ctx.strokeText("Nv. " + (g.lv || 1), 0, 68);
        ctx.fillText("Nv. " + (g.lv || 1), 0, 68);
        ctx.restore();
      }
    }

    drawBarrierFill(ctx, state) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-240, -240, GAME_CONFIG.MAP_SIZE + 480, GAME_CONFIG.MAP_SIZE + 480);
      ctx.arc(state.bx, state.by, state.br, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(2, 2, 4, 0.86)";
      ctx.fill("evenodd");
      ctx.restore();
    }

    drawDuelArena(ctx, d, ringOnly) {
      if (!d || !d.r) return;
      const t = this.t;
      ctx.save();
      ctx.translate(d.x, d.y);
      if (!ringOnly) {
        ctx.fillStyle = "rgba(90, 212, 255, 0.07)";
        ctx.beginPath();
        ctx.arc(0, 0, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(90, 212, 255, 0.95)";
      ctx.lineWidth = 5 + Math.sin(t * 8) * 1.4;
      ctx.shadowColor = "#5ad4ff";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 236, 160, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, d.r - 9 + Math.sin(t * 6) * 3, 0, Math.PI * 2);
      ctx.stroke();
      const n = 28;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * 1.1;
        const px = Math.cos(ang) * d.r;
        const py = Math.sin(ang) * d.r;
        ctx.fillStyle = i % 2 ? "rgba(90, 212, 255, 0.85)" : "rgba(255, 230, 140, 0.8)";
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBarrierRing(ctx, state) {
      const pulse = 5 + Math.sin(this.t * 5.5) * 3;
      ctx.beginPath();
      ctx.arc(state.bx, state.by, state.br, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(150, 30, 255, 0.9)";
      ctx.lineWidth = 10 + pulse;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(state.bx, state.by, state.br, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 60, 80, 0.7)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const n = 56;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + this.t * 0.7;
        const px = state.bx + Math.cos(ang) * state.br;
        const py = state.by + Math.sin(ang) * state.br;
        if (Math.hypot(px - this.cam.x, py - this.cam.y) > (this._intelR || 1700)) continue;
        const h = 18 + Math.sin(this.t * 9 + i * 1.7) * 10;
        const flicker = 0.45 + Math.sin(this.t * 14 + i) * 0.25;
        ctx.fillStyle = i % 2 ? "rgba(255, 120, 30, " + (0.35 * flicker) + ")" : "rgba(255, 50, 20, " + (0.4 * flicker) + ")";
        ctx.beginPath();
        ctx.moveTo(px - 7, py);
        ctx.lineTo(px + 7, py);
        ctx.lineTo(px + Math.cos(ang) * h, py + Math.sin(ang) * h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    spawnDust(x, y, gait) {
      if (Math.abs(Math.sin(gait * 2)) < 0.92) return;
      if (this.dust.length > 48) this.dust.shift();
      this.dust.push({ x: x + (Math.random() - 0.5) * 10, y: y + 10, life: 0.45, r: 3 + Math.random() * 3 });
    }

    drawDust(ctx) {
      const next = [];
      for (const d of this.dust) {
        d.life -= 0.03;
        if (d.life <= 0) continue;
        ctx.globalAlpha = d.life * 0.45;
        ctx.fillStyle = "#2a3238";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r * (1.4 - d.life), d.r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        next.push(d);
      }
      this.dust = next;
    }

    drawLoots(ctx, loots) {
      for (const l of loots) {
        if (l.k === "chest") continue;
        if (l.k === "mega") continue;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(0, 10, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (l.k === "weapon") {
          const weps = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.WEAPONS) || {};
          const label = (weps[l.c] && weps[l.c].label) || l.c;
          ctx.fillStyle = "#c9b48a";
          ctx.strokeStyle = "#efe7d6";
          ctx.lineWidth = 1.5;
          ctx.save();
          ctx.rotate(-0.45);
          ctx.fillRect(-2, -18, 4, 28);
          ctx.fillRect(-7, -2, 14, 3);
          ctx.restore();
          ctx.fillStyle = "#efe7d6";
          ctx.font = "800 28px Rajdhani, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(label).toUpperCase(), 0, 40);
        } else if (l.k === "class") {
          ctx.fillStyle = COLORS[l.c] || "#fff";
          ctx.strokeStyle = "#efe7d6";
          ctx.lineWidth = 1.5;
          if (l.c === "assassin") {
            ctx.save();
            ctx.rotate(-0.5);
            ctx.fillRect(-2, -16, 4, 22);
            ctx.fillRect(-8, -4, 16, 3);
            ctx.restore();
          } else if (l.c === "tank") {
            ctx.beginPath();
            ctx.moveTo(0, -16);
            ctx.lineTo(12, -4);
            ctx.lineTo(10, 12);
            ctx.lineTo(-10, 12);
            ctx.lineTo(-12, -4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(-2, -20, 4, 32);
            ctx.beginPath();
            ctx.arc(0, -20, 9, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = COLORS[l.c] || "#fff";
          ctx.font = "800 14px Rajdhani, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(l.c).toUpperCase(), 0, 26);
        } else if (l.k === "tile") {
          const col = l.c === "speed" ? "#6ee0ff" : l.c === "heal" ? "#5cff9a" : "#e7c56a";
          ctx.save();
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(-16, -16, 32, 32);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-16, -16, 32, 32);
          ctx.restore();
          ctx.fillStyle = col;
          ctx.font = "800 16px Rajdhani, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(l.c === "speed" ? "VITESSE" : l.c === "heal" ? "SOIN" : "FORCE", 0, 32);
        } else {
          const sz = l.sz || 1;
          const rad = 8 + sz * 5;
          const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, rad * 2);
          glow.addColorStop(0, COLORS[l.c] || "#e23b4a");
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS[l.c] || "#e23b4a";
          ctx.beginPath();
          ctx.arc(0, -1, rad * 0.55 + Math.sin(this.t * 5 + l.x) * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, -1, rad * 0.55, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawChests(ctx, loots) {
      for (const l of loots) {
        if (l.k !== "chest") continue;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.scale(0.75, 0.75);
        const pulse = 0.92 + Math.sin(this.t * 4.2) * 0.08;
        const beam = ctx.createLinearGradient(0, -150, 0, 24);
        beam.addColorStop(0, "rgba(90, 212, 255, 0)");
        beam.addColorStop(0.45, "rgba(90, 212, 255, " + (0.22 * pulse) + ")");
        beam.addColorStop(1, "rgba(232, 238, 246, 0.55)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(-18, 16);
        ctx.lineTo(-8, -150);
        ctx.lineTo(8, -150);
        ctx.lineTo(18, 16);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        this.bloom(ctx, 0, -8, 70 * pulse, "rgba(90, 212, 255, 0.55)");
        this.bloom(ctx, 0, 10, 48, "rgba(201, 180, 138, 0.35)");
        ctx.restore();
        ctx.strokeStyle = "rgba(90, 212, 255, " + (0.8 + pulse * 0.2) + ")";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(0, 22, 52 + Math.sin(this.t * 5) * 5, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.ellipse(0, 26, 62, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        const leather = this.getSprite && this.getSprite("texLeather");
        const metal = this.getSprite && this.getSprite("texMetal");
        ctx.save();
        ctx.scale(1.32, 1.32);
        if (leather) {
          const p = ctx.createPattern(leather, "repeat");
          ctx.fillStyle = p || "#4a2a12";
        } else ctx.fillStyle = "#4a2a12";
        ctx.fillRect(-42, -22, 84, 52);
        ctx.fillStyle = "#2a1608";
        ctx.fillRect(-42, -22, 84, 12);
        if (metal) {
          const p2 = ctx.createPattern(metal, "repeat");
          ctx.fillStyle = p2 || "#c9b48a";
        } else ctx.fillStyle = "#c9b48a";
        ctx.fillRect(-42, 2, 84, 10);
        ctx.fillRect(-7, -2, 14, 18);
        ctx.strokeStyle = "#efe7d6";
        ctx.lineWidth = 2;
        ctx.strokeRect(-42, -22, 84, 52);
        ctx.fillStyle = "#5ad4ff";
        ctx.beginPath();
        ctx.arc(0, 6, 8 + Math.sin(this.t * 7) * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(0, -86);
        ctx.fillStyle = "rgba(8, 16, 24, 0.82)";
        ctx.beginPath();
        ctx.moveTo(-36, -10);
        ctx.lineTo(36, -10);
        ctx.lineTo(32, 16);
        ctx.lineTo(-32, 16);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#5ad4ff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#5ad4ff";
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(10, -12);
        ctx.lineTo(0, 2);
        ctx.lineTo(-10, -12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(4, 8, 10, 0.9)";
        ctx.lineWidth = 5;
        ctx.font = "800 22px Rajdhani, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText("COFFRE", 0, 12);
        ctx.fillStyle = "#e8eef6";
        ctx.fillText("COFFRE", 0, 12);
        ctx.restore();
        ctx.strokeStyle = "rgba(4, 8, 10, 0.9)";
        ctx.lineWidth = 5;
        ctx.font = "800 22px Rajdhani, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText("COFFRE", 0, 72);
        ctx.fillStyle = "#e8eef6";
        ctx.fillText("COFFRE", 0, 72);
        ctx.restore();
      }
    }

    drawMegaCubes(ctx, loots) {
      for (const l of loots) {
        if (l.k !== "mega") continue;
        ctx.save();
        ctx.translate(l.x, l.y);
        const t = this.t;
        const hover = Math.sin(t * 2.6 + l.x * 0.01) * 10;
        const pulse = 0.88 + Math.sin(t * 5.2) * 0.12;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.ellipse(0, 18, 28 * pulse, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        const beam = ctx.createLinearGradient(0, -170, 0, 20);
        beam.addColorStop(0, "rgba(255, 230, 120, 0)");
        beam.addColorStop(0.4, "rgba(255, 200, 70, " + (0.28 * pulse) + ")");
        beam.addColorStop(1, "rgba(255, 255, 230, 0.7)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(-16, 14);
        ctx.lineTo(-5, -170);
        ctx.lineTo(5, -170);
        ctx.lineTo(16, 14);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        this.bloom(ctx, 0, hover - 8, 90 * pulse, "rgba(255, 196, 60, 0.55)");
        this.bloom(ctx, 0, hover, 42, "rgba(255, 255, 220, 0.85)");
        ctx.restore();
        ctx.translate(0, hover - 8);
        ctx.rotate(t * 0.9);
        const s = 16;
        ctx.fillStyle = "rgba(255, 214, 90, 0.95)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.15);
        ctx.lineTo(s, 0);
        ctx.lineTo(0, s * 1.15);
        ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255, 245, 200, 0.95)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.15);
        ctx.lineTo(s * 0.55, -s * 0.2);
        ctx.lineTo(0, s * 0.15);
        ctx.lineTo(-s * 0.25, -s * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.strokeStyle = "rgba(4, 8, 10, 0.9)";
        ctx.lineWidth = 3;
        ctx.font = "800 27px Cinzel, serif";
        ctx.textAlign = "center";
        ctx.strokeText("ÉVEIL", 0, 52);
        ctx.fillStyle = "#ffe9a0";
        ctx.fillText("ÉVEIL", 0, 52);
        ctx.restore();
      }
    }

    drawStyleTrail(ctx, p) {
      const pass = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.BATTLE_PASS) || {};
      let def = pass.trails && pass.trails[p.tr];
      if (!def) return;
      if (typeof def === "string") def = { hex: def, shape: "mist" };
      const hex = def.hex || "#5ad4ff";
      const shape = def.shape || "mist";
      const form = p.ou && pass.outfits && pass.outfits[p.ou] && pass.outfits[p.ou].form;
      const armored = form === "abyss" || form === "divine";
      const ang = (p.d || 0) + Math.PI;
      const dist = (armored ? 52 : 26) + Math.sin(this.t * 3.1) * 5;
      ctx.save();
      ctx.translate(Math.cos(ang) * dist, Math.sin(ang) * dist + Math.sin(this.t * 2.4) * 2);
      ctx.globalCompositeOperation = "lighter";
      this.drawFollowerWisp(ctx, shape, hex);
      ctx.restore();
    }

    drawFollowerWisp(ctx, shape, hex) {
      const t = this.t;
      const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 28);
      glow.addColorStop(0, hex);
      glow.addColorStop(1, "transparent");
      if (shape === "twin") {
        for (const sx of [-8, 8]) {
          ctx.save();
          ctx.translate(sx, Math.sin(t * 4 + sx) * 3);
          this.bloom(ctx, 0, -4, 16, rgbaHex(hex, 0.35));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hex;
          ctx.beginPath();
          ctx.arc(-2, -6, 1.3, 0, Math.PI * 2);
          ctx.arc(2, -6, 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        return;
      }
      if (shape === "ribbon") {
        this.bloom(ctx, 0, -4, 22, rgbaHex(hex, 0.3));
        ctx.strokeStyle = hex;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const u = i / 10;
          const x = Math.sin(t * 5 + u * 4) * (6 + u * 4);
          const y = -16 + u * 34;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(0, -14, 2.2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (shape === "wraith") {
        this.bloom(ctx, 0, -6, 26, rgbaHex(hex, 0.4));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.quadraticCurveTo(12, -2, 7, 16);
        ctx.quadraticCurveTo(0, 8, -7, 16);
        ctx.quadraticCurveTo(-12, -2, 0, -16);
        ctx.fill();
        ctx.fillStyle = "#f4fbff";
        ctx.beginPath();
        ctx.arc(-3.2, -6, 1.7, 0, Math.PI * 2);
        ctx.arc(3.2, -6, 1.7, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (shape === "swarm") {
        this.bloom(ctx, 0, -4, 30, rgbaHex(hex, 0.28));
        for (let i = 0; i < 7; i++) {
          const a = t * 2.4 + i * 0.9;
          const r = 8 + (i % 3) * 5;
          ctx.fillStyle = hex;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.35;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * r, Math.sin(a * 1.3) * r * 0.7 - 4, 5, 8, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
      }
      if (shape === "goldveil") {
        this.bloom(ctx, 0, -8, 32, rgbaHex(hex, 0.45));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 2, 14, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hex;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, 8);
        ctx.quadraticCurveTo(0, -24, 7, 8);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = "#fff6c8";
          ctx.beginPath();
          ctx.arc(Math.cos(t * 3 + i) * 10, -10 + Math.sin(t * 4 + i) * 8, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      if (shape === "monarch") {
        this.bloom(ctx, 0, -8, 36, rgbaHex(hex, 0.5));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hex;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-8, -10);
        ctx.lineTo(-4, -22);
        ctx.lineTo(0, -12);
        ctx.lineTo(4, -22);
        ctx.lineTo(8, -10);
        ctx.stroke();
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath();
        ctx.arc(-3.5, -5, 2, 0, Math.PI * 2);
        ctx.arc(3.5, -5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.ellipse(0, 8, 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (shape === "halo") {
        this.bloom(ctx, 0, -6, 34, rgbaHex(hex, 0.5));
        ctx.strokeStyle = hex;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(0, -2, 14 + Math.sin(t * 4) * 2, 18, t * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, -2, 8, 11, -t * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff8e0";
        ctx.beginPath();
        ctx.arc(0, -8, 3.2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      this.bloom(ctx, 0, -6, 34, "rgba(180, 210, 255, 0.28)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = hex;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.quadraticCurveTo(0, -22, 8, 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(-3, -8, 1.6, 0, Math.PI * 2);
      ctx.arc(3, -8, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    drawSpawnStyle(ctx, p) {
      const t = Math.max(0, Math.min(1, (p.stt || 0) / 2.2));
      const kind = p.sp || "rift";
      const col =
        kind === "legend" ? "#e7c56a"
        : kind === "arise" ? "#c56bff"
        : kind === "carnage" ? "#ff3355"
        : kind === "bastion" ? "#3da6ff"
        : kind === "rift" ? "#5ad4ff"
        : "#c4b8a4";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const r = (1 - t) * 90 + 18;
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.25 + t * 0.55;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      if (kind === "arise" || kind === "legend" || kind === "carnage" || kind === "bastion") {
        for (let i = 0; i < 6; i++) {
          const a = this.t * 1.4 + i * (Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.stroke();
        }
      }
      ctx.fillStyle = col;
      ctx.font = "800 22px Cinzel, serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = t;
      ctx.fillText(
        kind === "arise" ? "INVOCATION"
          : kind === "legend" ? "LÉGENDE"
          : kind === "carnage" ? "CARNAGE"
          : kind === "bastion" ? "BASTION"
          : kind === "rift" ? "SYSTÈME"
          : "RECRUE",
        0, -r - 8
      );
      ctx.restore();
    }

    groundShadow(ctx, w, h) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(2, 14, w * 1.15, h * 1.15, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(0, 13, w * 1.35, h * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    walkLegs(ctx, gait, moving, color) {
      const swing = moving ? Math.sin(gait) * 7 : 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.lineTo(-5 + swing * 0.2, 12 + Math.abs(swing) * 0.15);
      ctx.moveTo(5, 4);
      ctx.lineTo(5 - swing * 0.2, 12 + Math.abs(-swing) * 0.15);
      ctx.stroke();
    }

    drawPlayers(ctx, list, meId) {
      for (const p of list) {
        if (!p.a) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        const mine = p.i === meId;
        if (mine) this.drawSelfPing(ctx);
        this.drawHunterBody(ctx, p, false, mine ? "self" : "enemy");
        if (p.tr) this.drawStyleTrail(ctx, p);
        if (p.stt > 0) this.drawSpawnStyle(ctx, p);
        if (!mine) {
          const look = hunterLook(p, "enemy");
          ctx.fillStyle = look.aura;
          ctx.beginPath();
          ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = look.trim;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 22, -0.4, Math.PI * 1.1);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (p.hst > 0) this.drawBuffRing(ctx, 34, Math.min(1, p.hst / (GAME_CONFIG.BUFF_TIME || 16)), "#6ee0ff");
        if (p.mtt > 0) this.drawBuffRing(ctx, 42, Math.min(1, p.mtt / (GAME_CONFIG.BUFF_TIME || 16)), "#e7c56a");
        if (p.mg > 0) this.drawBuffRing(ctx, 78, Math.min(1, p.mg / (GAME_CONFIG.MEGA_CUBE_TIME || 25)), "#ffd24a");
        this.drawHunterPlate(ctx, p, meId);
        if (p.mg > 0) {
          ctx.fillStyle = "#ffe08a";
          ctx.font = "800 28px Cinzel, serif";
          ctx.textAlign = "center";
          ctx.strokeStyle = "rgba(4, 8, 10, 0.85)";
          ctx.lineWidth = 5;
          ctx.strokeText("ÉVEIL", 0, -214);
          ctx.fillText("ÉVEIL", 0, -214);
        }
        if (p.dg) {
          const dodgeY = this.hunterPlateY(p) - 32;
          ctx.fillStyle = "#8fe8c0";
          ctx.font = "800 26px Cinzel, serif";
          ctx.textAlign = "center";
          ctx.strokeStyle = "rgba(4, 8, 10, 0.85)";
          ctx.lineWidth = 5;
          ctx.strokeText("Esquive", 0, dodgeY);
          ctx.fillText("Esquive", 0, dodgeY);
        }
        ctx.restore();
      }
    }

    outfitForm(p) {
      if (!p || !p.ou || p.mg > 0) return "";
      const pass = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.BATTLE_PASS) || {};
      const look = pass.outfits && pass.outfits[p.ou];
      return (look && look.form) || "";
    }

    hunterPlateY(p) {
      if (p && p.mg > 0) return -182;
      const form = this.outfitForm(p);
      if (form === "abyss") return -128;
      if (form === "divine") return -112;
      return -58;
    }

    drawHunterPlate(ctx, p, meId) {
      const mine = p.i === meId;
      const look = hunterLook(p, mine ? "self" : "enemy");
      const w = 112;
      const x = -w / 2;
      const y = this.hunterPlateY(p);
      ctx.fillStyle = "rgba(4, 8, 12, 0.82)";
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - 8, y + 29);
      ctx.lineTo(x, y + 29);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = mine ? "rgba(201, 180, 138, 0.85)" : look.trim;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = mine ? "#c9b48a" : look.trim;
      ctx.fillRect(x, y, 5, 29);
      ctx.fillStyle = mine ? "#e8eef6" : "#efe7d6";
      ctx.font = "700 16px Rajdhani, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(p.n || "").slice(0, 14), x + 12, y + 14);
      this.hpBar(ctx, x + 10, y + 18, w - 20, p.h / p.H, "player", p.i);
      this.drawLevelTag(ctx, p.lv, y - 14, mine ? "#e7c56a" : look.trim);
      ctx.textAlign = "center";
    }

    drawLevelTag(ctx, lv, y, color) {
      if (lv == null || lv === "") return;
      const t = "Nv. " + lv;
      ctx.save();
      ctx.font = "800 18px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = "rgba(4, 6, 10, 0.88)";
      ctx.strokeText(t, 0, y);
      ctx.fillStyle = color || "#efe7d6";
      ctx.fillText(t, 0, y);
      ctx.restore();
    }

    drawBuffRing(ctx, r, frac, color) {
      ctx.strokeStyle = "rgba(20, 16, 24, 0.55)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }

    glowEyes(ctx, x1, y1, x2, y2, r, intense, color) {
      const hex = color || "#5ad4ff";
      const core = rgbaHex(hex, 0.98);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, (x1 + x2) / 2, y1, r * 9, rgbaHex(hex, 0.35));
      this.bloom(ctx, x1, y1, r * 6.5, rgbaHex(hex, 0.7));
      this.bloom(ctx, x2, y2, r * 6.5, rgbaHex(hex, 0.55));
      const t = this.t;
      for (let i = 0; i < 5; i++) {
        const a = t * 3.2 + i * 1.25;
        const px = (x1 + x2) / 2 + Math.cos(a) * (6 + i);
        const py = y1 + Math.sin(a * 1.4) * 3 - 2;
        ctx.fillStyle = rgbaHex(hex, 0.7);
        ctx.beginPath();
        ctx.arc(px, py, 0.7 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const h = r * 3.6;
      const w = Math.max(1.5, r * 0.58);
      ctx.fillStyle = core;
      ctx.fillRect(x1 - w / 2, y1 - h / 2, w, h);
      ctx.fillRect(x2 - w / 2, y2 - h / 2, w, h);
      ctx.fillStyle = "#f7ffff";
      ctx.fillRect(x1 - w * 0.15, y1 - h / 2, w * 0.35, h * 0.45);
      ctx.fillRect(x2 - w * 0.15, y2 - h / 2, w * 0.35, h * 0.45);
    }

    shade(hex, amt) {
      const n = parseInt((hex || "#111").slice(1), 16);
      const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
      const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
      const b = Math.max(0, Math.min(255, (n & 255) + amt));
      return "rgb(" + r + "," + g + "," + b + ")";
    }

    drawHunterBody(ctx, p, shadow, role) {
      let look = hunterLook(p, role || "enemy");
      const pass = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.BATTLE_PASS) || {};
      if (p.ou && pass.outfits && pass.outfits[p.ou] && !(p.mg > 0)) {
        look = pass.outfits[p.ou];
      }
      if (p.mg > 0) {
        look = { coat: "#1a140c", head: "#241c10", trim: "#c9a050", aura: "rgba(200, 160, 50, 0.22)" };
      }
      let col = p.mg > 0 ? "#c4a040" : (COLORS[p.c] || COLORS.novice);
      if (!(p.mg > 0)) {
        const tint = wepColorOf(p.ws);
        if (tint) col = tint;
        else if (p.bs && (p.w === "saber" || p.w === "laser" || p.w === "bazooka")) {
          const st = shotStyleOf(p.bs);
          if (st && (st.hex || st.core)) col = st.hex || st.core;
        }
      }
      const gait = p.g || 0;
      const moving = p.mv;
      const atk = Math.max(0, Math.min(1, p.sw || 0));
      const jab = Math.sin(atk * Math.PI);
      const bob = moving ? Math.abs(Math.sin(gait)) * 3.2 : Math.sin(this.t * 2.2) * 0.6;
      this.groundShadow(ctx, p.mg > 0 ? 68 : 24, p.mg > 0 ? 28 : 10);
      ctx.save();
      ctx.translate(Math.cos(p.d || 0) * jab * 8, Math.sin(p.d || 0) * jab * 8 - bob);
      if (p.mg > 0) ctx.scale(2.84, 2.84);
      const enemy = role === "enemy";
      const stride = moving ? Math.sin(gait) * 9 : 0;
      const flow = moving ? Math.sin(gait) * 5 : Math.sin(this.t * 1.6) * 2;

      if (look.form === "abyss" || look.form === "divine") {
        if (look.form === "divine") this.drawDivine(ctx, look, shadow, stride, flow);
        else this.drawDarkLord(ctx, look, shadow, stride, flow);
        if (!(p.mg > 0)) this.drawOutfitFx(ctx, look);
        ctx.save();
        ctx.rotate(p.d || 0);
        if (!p.bo) this.drawGear(ctx, p.w || p.c, p.sw || 0, col, look);
        ctx.restore();
        if (p.mg > 0) this.drawEveilAura(ctx);
        ctx.restore();
        return;
      }

      ctx.fillStyle = shadow ? "#060814" : this.shade(look.coat, -18);
      ctx.beginPath();
      ctx.moveTo(-16, 4);
      ctx.quadraticCurveTo(-28 - flow, 8, -22, 22 + flow * 0.4);
      ctx.lineTo(-8, 16);
      ctx.lineTo(8, 16);
      ctx.lineTo(22, 22 - flow * 0.4);
      ctx.quadraticCurveTo(28 + flow, 8, 16, 4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = shadow ? "#04060c" : "#0a0c10";
      ctx.lineWidth = 5.2;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.lineTo(-9, 22 + Math.max(0, stride));
      ctx.moveTo(6, 12);
      ctx.lineTo(9, 22 + Math.max(0, -stride));
      ctx.stroke();
      ctx.fillStyle = "#14161c";
      ctx.fillRect(-11, 20 + Math.max(0, stride), 7, 4);
      ctx.fillRect(4, 20 + Math.max(0, -stride), 7, 4);

      ctx.fillStyle = look.coat;
      ctx.beginPath();
      ctx.moveTo(-18, 5);
      ctx.lineTo(-16, -10);
      ctx.lineTo(-7, -16);
      ctx.lineTo(7, -16);
      ctx.lineTo(16, -10);
      ctx.lineTo(18, 7);
      ctx.lineTo(10, 18);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shadow ? "rgba(90, 212, 255, 0.85)" : look.trim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = this.shade(look.coat, 22);
      ctx.beginPath();
      ctx.moveTo(-11, -6);
      ctx.lineTo(11, -6);
      ctx.lineTo(8, 10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = this.shade(look.head, -10);
      ctx.fillRect(-12, 8, 24, 3);
      ctx.fillStyle = look.trim;
      ctx.fillRect(-3, -6, 2.2, 16);

      ctx.fillStyle = this.shade(look.head, 8);
      ctx.beginPath();
      ctx.moveTo(-18, -8);
      ctx.lineTo(-12, -14);
      ctx.lineTo(-8, -4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(18, -8);
      ctx.lineTo(12, -14);
      ctx.lineTo(8, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-18, -8);
      ctx.lineTo(-8, -4);
      ctx.moveTo(18, -8);
      ctx.lineTo(8, -4);
      ctx.stroke();

      if (enemy) {
        ctx.fillStyle = look.trim;
        ctx.beginPath();
        ctx.moveTo(12, -8);
        ctx.lineTo(22, 18);
        ctx.lineTo(14, 18);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = look.head;
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(-10, -24);
      ctx.lineTo(0, -30);
      ctx.lineTo(10, -24);
      ctx.lineTo(12, -10);
      ctx.lineTo(6, -8);
      ctx.lineTo(-6, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#03050a";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(-11, -18);
      ctx.lineTo(0, -32);
      ctx.lineTo(11, -18);
      ctx.lineTo(6, -16);
      ctx.lineTo(0, -26);
      ctx.lineTo(-11, -18);
      ctx.fill();
      ctx.fillStyle = "#05070a";
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(-7, -12);
      ctx.lineTo(7, -12);
      ctx.lineTo(9, -18);
      ctx.closePath();
      ctx.fill();
      this.glowEyes(ctx, -4, -16.4, 4, -16.4, shadow ? 2.7 : (p.mg > 0 ? 2.2 : 2.3), true, p.mg > 0 ? "#e7c56a" : (enemy ? look.trim : (look.visor || "#5ad4ff")));
      if (!(p.mg > 0)) this.drawOutfitFx(ctx, look);

      ctx.save();
      ctx.rotate(p.d || 0);
      if (!p.bo) this.drawGear(ctx, p.w || p.c, p.sw || 0, col, look);
      ctx.restore();
      if (p.mg > 0) this.drawEveilAura(ctx);
      ctx.restore();
    }

    drawDarkLord(ctx, look, shadow, stride, flow) {
      const plate = look.coat;
      const trim = look.trim;
      const visor = look.visor || "#ff4a18";
      const nSpike = Math.max(4, look.spikes || 6);
      ctx.fillStyle = shadow ? "rgba(6, 4, 8, 0.85)" : this.shade(plate, -30);
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.quadraticCurveTo(-40 - flow, 4, -28, 30);
      ctx.quadraticCurveTo(0, 20, 28, 30);
      ctx.quadraticCurveTo(40 + flow, 4, 8, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.shade(plate, -8);
      ctx.lineWidth = 7.2;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(-6, 10);
      ctx.lineTo(-9, 24 + Math.max(0, stride));
      ctx.moveTo(6, 10);
      ctx.lineTo(9, 24 + Math.max(0, -stride));
      ctx.stroke();
      ctx.fillStyle = this.shade(trim, -20);
      ctx.fillRect(-13, 22 + Math.max(0, stride), 9, 5);
      ctx.fillRect(4, 22 + Math.max(0, -stride), 9, 5);
      ctx.fillStyle = plate;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-17, -10);
      ctx.lineTo(-15, 16);
      ctx.lineTo(0, 22);
      ctx.lineTo(15, 16);
      ctx.lineTo(17, -10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(0, 13);
      ctx.lineTo(9, -8);
      ctx.stroke();
      ctx.fillStyle = this.shade(plate, 16);
      ctx.beginPath();
      ctx.moveTo(-4, -12);
      ctx.lineTo(4, -12);
      ctx.lineTo(2, 6);
      ctx.lineTo(-2, 6);
      ctx.closePath();
      ctx.fill();
      const pauldron = (side) => {
        ctx.fillStyle = this.shade(plate, -6);
        ctx.beginPath();
        ctx.moveTo(side * 7, -14);
        ctx.lineTo(side * 28, -20);
        ctx.lineTo(side * 26, 6);
        ctx.lineTo(side * 10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = trim;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.fillStyle = trim;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(side * (16 + i * 4), -18 - i);
          ctx.lineTo(side * (19 + i * 3.5), -34 - i * 3);
          ctx.lineTo(side * (12 + i * 3), -16);
          ctx.closePath();
          ctx.fill();
        }
      };
      pauldron(-1);
      pauldron(1);
      ctx.fillStyle = look.head;
      ctx.beginPath();
      ctx.moveTo(-12, -14);
      ctx.lineTo(-14, -30);
      ctx.lineTo(0, -46);
      ctx.lineTo(14, -30);
      ctx.lineTo(12, -14);
      ctx.lineTo(6, -12);
      ctx.lineTo(-6, -12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#030204";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = this.shade(plate, 8);
      ctx.beginPath();
      ctx.moveTo(-12, -18);
      ctx.lineTo(-24, -6);
      ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(12, -18);
      ctx.lineTo(24, -6);
      ctx.lineTo(10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = trim;
      for (let i = 0; i < nSpike; i++) {
        const u = nSpike === 1 ? 0 : (i / (nSpike - 1)) * 2 - 1;
        const x = u * 13;
        const h = 9 + (1 - Math.abs(u)) * 18;
        ctx.beginPath();
        ctx.moveTo(x - 2.3, -34);
        ctx.lineTo(x, -34 - h);
        ctx.lineTo(x + 2.3, -34);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#050204";
      ctx.fillRect(-8.5, -26, 17, 7);
      this.bloom(ctx, 0, -22.5, 16, rgbaHex(visor, 0.55));
      ctx.fillStyle = visor;
      ctx.fillRect(-7.5, -24.2, 15, 3.6);
      ctx.fillStyle = "#fff4d0";
      ctx.fillRect(-3, -23.6, 6, 1.5);
    }

    drawDivine(ctx, look, shadow, stride, flow) {
      const plate = look.coat;
      const trim = look.trim;
      const visor = look.visor || "#fff4c8";
      const wings = look.wings || 1;
      this.bloom(ctx, 0, -8, 42, look.aura || "rgba(255, 230, 160, 0.45)");
      ctx.fillStyle = rgbaHex(trim, 0.22);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(-36 - flow, 0, -22, 26);
      ctx.quadraticCurveTo(0, 14, 22, 26);
      ctx.quadraticCurveTo(36 + flow, 0, 0, -6);
      ctx.fill();
      for (let w = 1; w <= wings; w++) {
        const spread = 18 + w * 10;
        ctx.strokeStyle = trim;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.quadraticCurveTo(-spread, -18 - w * 6, -spread - 6, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.quadraticCurveTo(spread, -18 - w * 6, spread + 6, 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = this.shade(plate, -18);
      ctx.lineWidth = 6.4;
      ctx.beginPath();
      ctx.moveTo(-5, 10);
      ctx.lineTo(-8, 22 + Math.max(0, stride));
      ctx.moveTo(5, 10);
      ctx.lineTo(8, 22 + Math.max(0, -stride));
      ctx.stroke();
      ctx.fillStyle = trim;
      ctx.fillRect(-12, 21 + Math.max(0, stride), 8, 4);
      ctx.fillRect(4, 21 + Math.max(0, -stride), 8, 4);
      ctx.fillStyle = plate;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-15, -8);
      ctx.lineTo(-13, 15);
      ctx.lineTo(0, 20);
      ctx.lineTo(13, 15);
      ctx.lineTo(15, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.fillStyle = this.shade(plate, 18);
      ctx.beginPath();
      ctx.moveTo(-5, -10);
      ctx.lineTo(5, -10);
      ctx.lineTo(3, 8);
      ctx.lineTo(-3, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = look.head;
      ctx.beginPath();
      ctx.ellipse(0, -22, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#1a2430";
      ctx.fillRect(-7, -24, 14, 5);
      this.bloom(ctx, 0, -21.5, 12, rgbaHex(visor, 0.7));
      ctx.fillStyle = visor;
      ctx.fillRect(-6, -23.2, 12, 3.2);
      ctx.strokeStyle = trim;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, -40, 11 + Math.sin(this.t * 4) * 1.2, 4.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = trim;
      ctx.beginPath();
      ctx.arc(0, -40, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    drawOutfitFx(ctx, look) {
      const fx = look && look.fx;
      if (!fx) return;
      const t = this.t;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (look.visor && look.form !== "abyss" && look.form !== "divine") {
        ctx.fillStyle = look.visor;
        ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.12;
        ctx.fillRect(-7, -18, 14, 4.5);
        ctx.globalAlpha = 1;
      }
      if (fx === "scan") {
        const y = -10 + Math.sin(t * 5) * 9;
        ctx.strokeStyle = look.trim;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-12, y);
        ctx.lineTo(12, y);
        ctx.stroke();
      } else if (fx === "embers") {
        for (let i = 0; i < 8; i++) {
          const a = t * 2.2 + i * 0.8;
          ctx.fillStyle = i % 2 ? "#ffb070" : "#ff6a2a";
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 15, -8 + Math.sin(a * 1.4) * 11, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx === "arcs") {
        ctx.strokeStyle = look.trim;
        ctx.lineWidth = 1.15;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(-16, -4);
        ctx.quadraticCurveTo(-2, -22, 8, -8);
        ctx.quadraticCurveTo(12, -4, 16, -16);
        ctx.stroke();
      } else if (fx === "void") {
        this.bloom(ctx, 0, -8, 26, look.aura || "rgba(160,120,255,0.35)");
        ctx.strokeStyle = look.trim;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(0, -6, 19 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx === "crown") {
        if (look.form === "abyss") {
          ctx.fillStyle = look.trim;
          ctx.globalAlpha = 0.55;
          for (let i = 0; i < 6; i++) {
            const a = t * 1.8 + i;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 10, -40 + Math.sin(a * 1.3) * 6, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = look.trim;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(-8, -28);
          ctx.lineTo(-4, -36);
          ctx.lineTo(0, -29);
          ctx.lineTo(4, -36);
          ctx.lineTo(8, -28);
          ctx.fill();
        }
      } else if (fx === "eye" || fx === "gaze") {
        const y = fx === "gaze" ? -52 : -22;
        const pulse = 0.72 + Math.sin(t * 5.2) * 0.28;
        this.bloom(ctx, 0, y, (fx === "gaze" ? 20 : 13) * pulse, look.aura || "rgba(90,212,255,0.4)");
        const slitH = fx === "gaze" ? 7.5 : 5.5;
        const slitW = fx === "gaze" ? 2.1 : 2.4;
        const gap = fx === "gaze" ? 5.2 : 0;
        ctx.fillStyle = look.visor || "#5ad4ff";
        if (fx === "gaze") {
          ctx.beginPath();
          ctx.ellipse(-gap, y, slitW, slitH, 0, 0, Math.PI * 2);
          ctx.ellipse(gap, y, slitW, slitH, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e8fbff";
          ctx.beginPath();
          ctx.ellipse(-gap, y, 0.8, 2.4, 0, 0, Math.PI * 2);
          ctx.ellipse(gap, y, 0.8, 2.4, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(0, y, 5.5, 2.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff6c8";
          ctx.beginPath();
          ctx.ellipse(0, y, 2.4, 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx === "halo" || fx === "seraph") {
        this.bloom(ctx, 0, -20, fx === "seraph" ? 46 : 26, look.aura || "rgba(255, 230, 160, 0.4)");
        const n = fx === "seraph" ? 8 : 4;
        ctx.fillStyle = look.trim;
        for (let i = 0; i < n; i++) {
          const a = t * 2.2 + i * (Math.PI * 2 / n);
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 18, -30 + Math.sin(a * 1.4) * 6, fx === "seraph" ? 2 : 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawEveilAura(ctx) {
      const t = this.t;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, 0, -8, 42, "rgba(255, 200, 70, 0.16)");
      this.bloom(ctx, 0, -16, 18, "rgba(255, 230, 160, 0.22)");
      ctx.strokeStyle = "rgba(231, 197, 106, 0.4)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 10, 24 + Math.sin(t * 4) * 2, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.rotate(t * 0.5);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        const g = ctx.createLinearGradient(0, -42, 0, -12);
        g.addColorStop(0, "rgba(255, 230, 160, 0)");
        g.addColorStop(1, "rgba(231, 197, 106, 0.18)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-1.4, -14);
        ctx.lineTo(0, -40);
        ctx.lineTo(1.4, -14);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();
    }

    drawGear(ctx, wep, swing, col, look) {
      const t = Math.max(0, Math.min(1, swing || 0));
      const jab = Math.sin(t * Math.PI);
      const w = wep || "novice";
      const ranged = w === "bow" || w === "crossbow" || w === "bazooka" || w === "laser" || w === "mage";
      let ang;
      if (w === "novice") ang = -0.45 + jab * 0.95;
      else if (ranged) ang = -0.38 * jab;
      else ang = (0.52 - t) * 2.55;
      ctx.save();
      ctx.rotate(ang);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (t > 0.06 && !ranged) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = w === "novice" ? "rgba(255, 210, 160, 0.45)" : "rgba(220, 235, 255, 0.42)";
        ctx.lineWidth = w === "novice" ? 9 : 7;
        ctx.beginPath();
        ctx.arc(0, 0, w === "novice" ? 26 : 38, -1.35, -1.35 + jab * 2.5);
        ctx.stroke();
        ctx.restore();
      }
      if (w === "novice") {
        const reach = 16 + jab * 22;
        ctx.strokeStyle = look.head;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.lineTo(reach - 4, -7 + jab * 2);
        ctx.moveTo(6, 6);
        ctx.lineTo(12 + jab * 6, 10);
        ctx.stroke();
        ctx.fillStyle = this.shade(look.head, 12);
        ctx.beginPath();
        ctx.arc(reach, -6 + jab * 2, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(14 + jab * 5, 10, 5.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = look.trim;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(reach, -6 + jab * 2, 6.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(14 + jab * 5, 10, 5.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(reach + 1.5, -8, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (w === "saber") {
        const blade = col || "#5cff9a";
        ctx.fillStyle = "#2a3038";
        ctx.fillRect(8, -3.4, 8, 6.8);
        ctx.fillStyle = this.shade(blade, -30);
        ctx.fillRect(10, -2.2, 5, 4.4);
        ctx.strokeStyle = rgbaHex(blade, 0.55);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(52, 0);
        ctx.stroke();
        ctx.strokeStyle = blade;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(54, 0);
        ctx.stroke();
        ctx.strokeStyle = "#fff";
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(48, 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (w === "katana" || w === "scythe" || w === "assassin" || w === "daggers" || w === "spear") {
        ctx.fillStyle = col;
        ctx.strokeStyle = "#efe7d6";
        ctx.lineWidth = 1.2;
        if (w === "daggers" || w === "assassin") {
          ctx.fillRect(10, -8, 26, 3.2);
          ctx.fillRect(11, 5, 22, 3.2);
          ctx.fillStyle = "#2a1810";
          ctx.fillRect(8, -9, 5, 5);
          ctx.fillRect(8, 4, 5, 5);
        } else if (w === "scythe") {
          ctx.fillStyle = "#2a1810";
          ctx.fillRect(10, -3, 28, 3.5);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(34, -4);
          ctx.quadraticCurveTo(52, -18, 44, 8);
          ctx.lineTo(34, 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (w === "spear") {
          ctx.fillStyle = "#3a2418";
          ctx.fillRect(8, -2.2, 36, 3.2);
          ctx.fillStyle = "#d8d0c0";
          ctx.beginPath();
          ctx.moveTo(48, 0);
          ctx.lineTo(38, -7);
          ctx.lineTo(38, 7);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = "#2a1810";
          ctx.fillRect(9, -3.5, 6, 7);
          ctx.fillStyle = "#c8c4bc";
          ctx.beginPath();
          ctx.moveTo(14, -3);
          ctx.lineTo(42, -1);
          ctx.lineTo(48, 0);
          ctx.lineTo(14, 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      } else if (w === "mace" || w === "hammer" || w === "tank") {
        ctx.fillStyle = look.head;
        ctx.fillRect(-22, -14, 12, 26);
        ctx.strokeStyle = look.trim;
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -14, 12, 26);
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(10, -3, 18, 5);
        ctx.fillStyle = col;
        if (w === "hammer") {
          ctx.fillRect(26, -12, 14, 20);
          ctx.fillStyle = "#efe7d6";
          ctx.fillRect(28, -10, 10, 3);
        } else {
          ctx.beginPath();
          ctx.arc(32, 0, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a1010";
          ctx.beginPath();
          ctx.arc(32, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (w === "bow" || w === "crossbow") {
        ctx.strokeStyle = "#5a3820";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(18, 0, 16, -1.35, 1.2);
        ctx.stroke();
        ctx.strokeStyle = "#efe7d6";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(10, -14);
        ctx.lineTo(10, 14);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(10, -1.8, 22, 2.6);
        if (w === "crossbow") {
          ctx.fillStyle = "#3a2418";
          ctx.fillRect(8, -4, 8, 8);
        }
      } else if (w === "bazooka") {
        ctx.fillStyle = "#2a2418";
        ctx.fillRect(8, -8, 32, 12);
        ctx.fillStyle = "#4a2010";
        ctx.fillRect(36, -7, 8, 10);
        ctx.fillStyle = col || "#e7c56a";
        ctx.fillRect(10, -6, 6, 3);
        ctx.fillRect(34, -5, 4, 6);
      } else if (w === "laser") {
        const beam = col || "#ff4ec8";
        ctx.fillStyle = "#1a1420";
        ctx.fillRect(10, -4, 26, 6);
        ctx.fillStyle = beam;
        ctx.fillRect(32, -3, 10, 4);
        ctx.beginPath();
        ctx.arc(44, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff6ff";
        ctx.beginPath();
        ctx.arc(44, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (w === "mage") {
        ctx.fillStyle = "#2a1428";
        ctx.fillRect(12, -30, 4, 36);
        ctx.fillStyle = look.trim;
        ctx.beginPath();
        ctx.arc(14, -32, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(90, 212, 255, 0.5)";
        ctx.beginPath();
        ctx.arc(14, -32, 13 + Math.sin(this.t * 6) * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = look.trim;
        ctx.fillRect(10, -3, 14, 4);
      }
      if (HIGH_TIER[w]) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const glow = rgbaHex(col || "#5ad4ff", 0.7);
        this.bloom(ctx, 28, 0, 22, glow);
        ctx.restore();
      }
      ctx.restore();
    }

    drawMonsters(ctx, list) {
      for (const m of list) {
        ctx.save();
        ctx.translate(m.x, m.y);
        const r = m.r || 16;
        const gait = m.g || 0;
        const bob = Math.abs(Math.sin(gait)) * 1.2;
        this.groundShadow(ctx, r * 0.85, r * 0.35);
        ctx.translate(0, -bob);
        const ty = m.ty || (m.e ? "knight" : "wolf");
        if (ty === "wolf") this.drawWolf(ctx, r);
        else if (ty === "goblin") this.drawGoblin(ctx, r);
        else if (ty === "beetle") this.drawBeetle(ctx, r, m.ch);
        else if (ty === "wraith") this.drawWraith(ctx, r, null, false);
        else this.drawKnight(ctx, r);
        this.hpBar(ctx, -(m.r || 16) * 0.7, -(m.r || 16) - 10, (m.r || 16) * 1.4, m.h / m.H, "mob", m.i);
        this.drawLevelTag(ctx, m.lv, -(m.r || 16) - 22);
        ctx.restore();
      }
    }

    drawWolf(ctx, r, asShadow, look) {
      ctx.fillStyle = "#121014";
      ctx.beginPath();
      ctx.ellipse(r * 0.55, 6, r * 0.28, r * 0.16, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1218";
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, 2);
      ctx.lineTo(-r * 0.4, -r * 0.55);
      ctx.lineTo(r * 0.95, 0);
      ctx.lineTo(r * 1.2, 8);
      ctx.lineTo(r * 0.2, r * 0.55);
      ctx.lineTo(-r * 0.7, r * 0.4);
      ctx.closePath();
      ctx.fill();
      this.hardStroke(ctx);
      ctx.fillStyle = "#0c0a0e";
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -6);
      ctx.lineTo(-r * 1.0, -r * 0.95);
      ctx.lineTo(-r * 0.4, -8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -8);
      ctx.lineTo(-r * 0.05, -r);
      ctx.lineTo(r * 0.05, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2a1a20";
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, 0);
      ctx.lineTo(-r * 1.05, 6);
      ctx.lineTo(-r * 0.7, 2);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, -r * 0.78, -4, r * 0.45, asShadow ? rgbaHex((look && look.trim) || "#5ad4ff", 0.5) : "rgba(226, 59, 74, 0.45)");
      ctx.restore();
      if (asShadow) this.glowEyes(ctx, -r * 0.78, -4, -r * 0.42, -5, Math.max(2.2, r * 0.12), true, look && look.trim);
      else {
        ctx.fillStyle = "#e23b4a";
        ctx.fillRect(-r * 0.86, -7, 2.2, r * 0.28);
        ctx.fillRect(-r * 0.5, -8, 2.2, r * 0.28);
      }
    }

    drawGoblin(ctx, r, asShadow, look) {
      ctx.fillStyle = "#101810";
      ctx.beginPath();
      ctx.moveTo(-8, 14);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-2, 14);
      ctx.moveTo(8, 14);
      ctx.lineTo(6, 6);
      ctx.lineTo(2, 14);
      ctx.fill();
      ctx.fillStyle = "#1a2a18";
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, 8);
      ctx.lineTo(-r * 0.5, -4);
      ctx.lineTo(r * 0.5, -4);
      ctx.lineTo(r * 0.85, 8);
      ctx.lineTo(0, r * 0.7);
      ctx.closePath();
      ctx.fill();
      this.hardStroke(ctx);
      ctx.fillStyle = "#243a20";
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -4);
      ctx.lineTo(-r * 0.2, -r * 0.85);
      ctx.lineTo(r * 0.2, -r * 0.85);
      ctx.lineTo(r * 0.55, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0c140c";
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-r * 0.15, -r - 8);
      ctx.lineTo(0, -8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.lineTo(r * 0.15, -r - 8);
      ctx.lineTo(0, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a7a58";
      ctx.fillRect(8, -2, 14, 2.4);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, -4, -8, 10, asShadow ? rgbaHex((look && look.trim) || "#5ad4ff", 0.4) : "rgba(160, 220, 60, 0.35)");
      ctx.restore();
      if (asShadow) this.glowEyes(ctx, -4, -8, 4, -8, 2.2, true, look && look.trim);
      else {
        ctx.fillStyle = "#c8ff6a";
        ctx.fillRect(-5.2, -11, 2, 6);
        ctx.fillRect(2.2, -11, 2, 6);
      }
    }

    drawBeetle(ctx, r, charging, asShadow, look) {
      ctx.fillStyle = charging ? "#3a2210" : "#141210";
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, 6);
      ctx.lineTo(-r * 0.6, -r * 0.55);
      ctx.lineTo(r * 0.7, -r * 0.4);
      ctx.lineTo(r * 1.15, 8);
      ctx.lineTo(0, r * 0.65);
      ctx.closePath();
      ctx.fill();
      this.hardStroke(ctx);
      ctx.strokeStyle = "#3a3420";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.45);
      ctx.lineTo(0, r * 0.5);
      ctx.stroke();
      ctx.fillStyle = "#0a0c0c";
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -2);
      ctx.lineTo(-r * 0.35, -r * 0.35);
      ctx.lineTo(-r * 0.15, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#4a3a20";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.35);
      ctx.lineTo(-r * 1.2, -r * 0.75);
      ctx.moveTo(-r * 0.65, -r * 0.5);
      ctx.lineTo(-r * 0.95, -r * 0.9);
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, -r * 0.5, -r * 0.15, 12, asShadow ? rgbaHex((look && look.trim) || "#5ad4ff", 0.45) : charging ? "rgba(255, 140, 40, 0.5)" : "rgba(226, 80, 40, 0.4)");
      ctx.restore();
      if (asShadow) this.glowEyes(ctx, -r * 0.62, -r * 0.18, -r * 0.38, -r * 0.12, 2.2, true, look && look.trim);
      else {
        ctx.fillStyle = "#e23b4a";
        ctx.fillRect(-r * 0.66, -r * 0.28, 2.4, 6);
        ctx.fillRect(-r * 0.42, -r * 0.22, 2.4, 6);
      }
    }

    drawWraith(ctx, r, look, asShadow) {
      const summoned = !!(asShadow && look);
      const eye = summoned ? (look.trim || "#5ad4ff") : "#ff8a28";
      const mist = summoned ? rgbaHex(look.coat || "#1a2438", 0.55) : "rgba(52, 16, 8, 0.7)";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, 0, -4, r * 1.8, summoned ? rgbaHex(eye, 0.22) : "rgba(255, 90, 28, 0.28)");
      ctx.restore();
      const g = ctx.createRadialGradient(0, -4, 2, 0, 0, r * 1.55);
      g.addColorStop(0, summoned ? rgbaHex(eye, 0.55) : "rgba(255, 110, 40, 0.5)");
      g.addColorStop(0.4, mist);
      g.addColorStop(1, "rgba(4, 6, 12, 0.02)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, 10);
      ctx.lineTo(-r * 0.45, -r * 0.7);
      ctx.lineTo(0, -r * 1.15);
      ctx.lineTo(r * 0.45, -r * 0.7);
      ctx.lineTo(r * 0.7, 12);
      ctx.lineTo(0, r * 0.9);
      ctx.closePath();
      ctx.fill();
      this.hardStroke(ctx, summoned ? rgbaHex(eye, 0.35) : "rgba(180, 50, 20, 0.55)");
      ctx.fillStyle = "rgba(6, 8, 16, 0.7)";
      ctx.beginPath();
      ctx.ellipse(0, 8, r * 0.45, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      this.glowEyes(ctx, -5, -8, 5, -8, Math.max(2.2, r * 0.12), true, eye);
    }

    drawKnight(ctx, r, asShadow, look) {
      ctx.fillStyle = "#08090c";
      ctx.beginPath();
      ctx.ellipse(0, 8, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0c080e";
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 4);
      ctx.quadraticCurveTo(-r * 1.15, 18, -r * 0.2, 16);
      ctx.lineTo(r * 0.2, 16);
      ctx.quadraticCurveTo(r * 1.15, 18, r * 0.9, 4);
      ctx.fill();
      ctx.fillStyle = "#1a1014";
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, r * 0.55);
      ctx.lineTo(-r * 0.7, -r * 0.55);
      ctx.lineTo(-r * 0.2, -r * 0.85);
      ctx.lineTo(r * 0.2, -r * 0.85);
      ctx.lineTo(r * 0.7, -r * 0.55);
      ctx.lineTo(r * 0.75, r * 0.55);
      ctx.closePath();
      ctx.fill();
      this.hardStroke(ctx);
      ctx.fillStyle = "#0a0608";
      ctx.fillRect(-r * 0.22, -r * 0.2, r * 0.44, r * 0.7);
      ctx.fillStyle = "#141018";
      ctx.beginPath();
      ctx.moveTo(-14, -r * 0.55);
      ctx.lineTo(0, -r - 16);
      ctx.lineTo(14, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#4a4030";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-r * 0.62, -r * 0.65, r * 1.24, r * 1.2);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.bloom(ctx, -6, -6, 12, asShadow ? rgbaHex((look && look.trim) || "#5ad4ff", 0.5) : "rgba(226, 59, 74, 0.45)");
      ctx.restore();
      if (asShadow) this.glowEyes(ctx, -6, -6, 6, -6, 2.4, true, look && look.trim);
      else {
        ctx.fillStyle = "#e23b4a";
        ctx.fillRect(-7.2, -10, 2.4, 7);
        ctx.fillRect(4.8, -10, 2.4, 7);
      }
      ctx.strokeStyle = "#6a3a20";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -12);
      ctx.lineTo(r * 0.7, r * 0.55);
      ctx.stroke();
      ctx.fillStyle = "#8a2010";
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -16);
      ctx.lineTo(r * 0.95, -8);
      ctx.lineTo(r * 0.7, -6);
      ctx.fill();
    }

    shadeForm(ctx, r, look) {
      ctx.fillStyle = look ? look.aura : "rgba(6, 10, 22, 0.55)";
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, 6);
      ctx.lineTo(-r * 0.7, -r * 0.55);
      ctx.lineTo(r * 0.7, -r * 0.55);
      ctx.lineTo(r * 1.15, 8);
      ctx.lineTo(0, r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = look ? look.trim : "rgba(90, 212, 255, 0.95)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      this.glowEyes(ctx, -r * 0.28, -r * 0.18, r * 0.28, -r * 0.18, Math.max(1.8, r * 0.12), true, look && look.trim);
    }

    drawShadows(ctx, list, meId) {
      for (const s of list) {
        ctx.save();
        ctx.translate(s.x, s.y);
        const mine = s.o === meId;
        const col = mine ? "#6ee0ff" : "#ff4d5a";
        const aura = mine ? "rgba(90, 220, 255, 0.5)" : "rgba(255, 70, 80, 0.5)";
        const look = mine
          ? { coat: "#04141c", head: "#0a1c28", trim: "#6ee0ff", aura: aura }
          : { coat: "#1c0608", head: "#28080c", trim: "#ff4d5a", aura: aura };
        const rr = s.r || (s.knd === "hunter" ? 22 : 16);
        this.bloom(ctx, 0, 6, rr * 2.4, aura);
        if (s.knd === "hunter") {
          this.drawHunterBody(ctx, { c: s.c, d: s.d, g: s.g, mv: 1, sk: s.sk, w: s.w, bo: s.bo }, false, mine ? "ally" : "enemy");
        } else {
          const gait = s.g || 0;
          const bob = Math.abs(Math.sin(gait)) * 1.1;
          ctx.translate(0, -bob);
          if (s.knd === "boss") {
            this.drawBossSilhouette(ctx, s.sty || s.ty || "knight", s.r || 28, true, look);
          } else {
            const r = s.r || 14;
            const ty = s.ty || "wolf";
            this.groundShadow(ctx, r * 0.85, r * 0.35);
            if (ty === "wolf") this.drawWolf(ctx, r, true, look);
            else if (ty === "goblin") this.drawGoblin(ctx, r, true, look);
            else if (ty === "beetle") this.drawBeetle(ctx, r, 0, true, look);
            else if (ty === "wraith") this.drawWraith(ctx, r, look, true);
            else this.drawKnight(ctx, r, true, look);
          }
        }
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 8, rr * 1.12, rr * 0.44, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(0, 8, rr * 1.28, rr * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const rad = s.r || (s.knd === "hunter" ? 22 : 14);
        const barW = Math.max(16, Math.min(s.knd === "boss" ? 70 : 44, rad * 1.22));
        const barY = -rad - (s.knd === "boss" ? 12 : 8);
        this.hpBar(ctx, -barW / 2, barY, barW, s.h / s.H, mine ? "shadow-ally" : "shadow-foe", s.i);
        this.drawLevelTag(ctx, s.lv, barY - 11, col);
        ctx.restore();
      }
    }

    drawBossSilhouette(ctx, sty, r, shade, look) {
      this.groundShadow(ctx, r * 0.9, r * 0.3);
      if (sty === "beast") this.drawWolf(ctx, r, shade, look);
      else if (sty === "wraith") this.drawWraith(ctx, r, look, shade);
      else if (sty === "spectre") {
        this.drawWraith(ctx, r, look, shade);
        ctx.fillStyle = look ? look.trim : (shade ? "#4a2080" : "#6b30a8");
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.6);
        ctx.lineTo(0, -r * 1.15);
        ctx.lineTo(r * 0.4, -r * 0.6);
        ctx.fill();
      } else if (sty === "colossus") this.drawBeetle(ctx, r, 1, shade, look);
      else if (sty === "tyrant") this.drawKnight(ctx, r, shade, look);
      else this.drawSovereign(ctx, r, shade, look);
    }

    drawSovereign(ctx, r, shade, look) {
      const t = this.t;
      ctx.fillStyle = "rgba(90, 20, 160, 0.45)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0308";
      ctx.beginPath();
      ctx.ellipse(0, 12, r * 0.95, r * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a0a18";
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -10);
      ctx.quadraticCurveTo(0, -r - 28, r * 0.55, -10);
      ctx.lineTo(r * 0.3, 20);
      ctx.lineTo(-r * 0.3, 20);
      ctx.fill();
      ctx.fillStyle = "#e7c56a";
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.15);
      ctx.lineTo(-r * 0.12, -r - 18);
      ctx.lineTo(-r * 0.04, -r * 0.1);
      ctx.moveTo(r * 0.22, -r * 0.15);
      ctx.lineTo(r * 0.12, -r - 18);
      ctx.lineTo(r * 0.04, -r * 0.1);
      ctx.fill();
      if (shade) {
        this.glowEyes(ctx, -r * 0.18, -6, r * 0.18, -6, Math.max(5, r * 0.07), true, look && look.trim);
      } else {
        ctx.fillStyle = "#ff3355";
        ctx.beginPath();
        ctx.arc(-r * 0.18, -6, Math.max(5, r * 0.07), 0, Math.PI * 2);
        ctx.arc(r * 0.18, -6, Math.max(5, r * 0.07), 0, Math.PI * 2);
        ctx.arc(0, r * 0.12, Math.max(4, r * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = shade ? ((look && look.trim) || "#6ee0ff") : "#e7c56a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72 + Math.sin(t * 2) * 4, t * 0.5, t * 0.5 + Math.PI * 1.3);
      ctx.stroke();
    }

    drawBoss(ctx, b, showHp) {
      if (!b.a) return;
      const rad = b.r || 196;
      ctx.save();
      ctx.translate(b.x, b.y);
      const sty = b.sty || (b.k === "br" || b.k === "raid" ? "sovereign" : "tyrant");
      const col = b.col || "#e7c56a";
      ctx.fillStyle = col + "33";
      ctx.beginPath();
      ctx.arc(0, 0, rad * 1.55, 0, Math.PI * 2);
      ctx.fill();
      this.drawBossSilhouette(ctx, sty, rad, false);
      ctx.fillStyle = "#efe7d6";
      ctx.font = "800 " + (rad > 140 ? 36 : 28) + "px Cinzel, serif";
      ctx.textAlign = "center";
      ctx.fillText(b.n, 0, -rad - 42);
      this.drawLevelTag(ctx, b.lv, -rad - 72);
      if (showHp !== false) {
        this.hpBar(ctx, -Math.min(140, rad * 1.1), -rad - 18, Math.min(280, rad * 2.2), b.h / b.H, "boss", b.i || (b.k + ":" + b.n));
      }
      ctx.restore();
    }

    drawMini(ctx, b) { this.drawBoss(ctx, b); }
    drawBrBoss(ctx, b) { this.drawBoss(ctx, b); }
    drawMonarch(ctx, b) { this.drawBoss(ctx, b); }

    drawProjectiles(ctx, list) {
      for (const p of list) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.k === "throw") {
          ctx.rotate(this.t * 16);
          this.drawThrownWeapon(ctx, p.w || "novice", p.sk);
          ctx.restore();
          continue;
        }
        ctx.rotate(p.a || 0);
        ctx.globalCompositeOperation = "lighter";
        const style = p.sk ? shotStyleOf(p.sk) : null;
        if (style) {
          this.drawShotSkin(ctx, p, style);
        } else if (p.k === "pulse") {
          this.drawPulseOrb(ctx, this.t);
        } else {
          if (p.k === "rocket") this.bloom(ctx, 0, 0, 22, "rgba(255, 120, 40, 0.7)");
          else if (p.k === "spit") this.bloom(ctx, 0, 0, 14, "rgba(80, 255, 160, 0.55)");
          else if (p.k === "arrow") this.bloom(ctx, 0, 0, 10, "rgba(220, 230, 255, 0.4)");
          else this.bloom(ctx, 0, 0, 18, "rgba(180, 120, 255, 0.65)");
          ctx.fillStyle = p.k === "spit" ? "#7dffb0" : p.k === "rocket" ? "#ff8844" : p.k === "arrow" ? "#efe7d6" : "#e2b8ff";
          ctx.beginPath();
          ctx.arc(0, 0, p.k === "rocket" ? 6 : p.k === "spit" ? 3 : 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawShotSkin(ctx, p, st) {
      const t = this.t;
      const core = st.core || "#fff";
      const glow = st.glow || rgbaHex(st.hex || core, 0.7);
      const fx = st.fx || "bolt";
      if (p && p.k === "rocket") {
        this.bloom(ctx, 0, 0, 22, glow);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(8, -5);
        ctx.lineTo(8, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(6, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(8, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (fx === "plasma") {
        this.bloom(ctx, 0, 0, 22, glow);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 9 + Math.sin(t * 18) * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff8ff";
        ctx.beginPath();
        ctx.arc(-1, -1.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (fx === "comet") {
        this.bloom(ctx, 0, 0, 20, glow);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(8, -5);
        ctx.lineTo(8, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(5, 0, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff8e0";
        ctx.beginPath();
        ctx.arc(7, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (fx === "rune") {
        this.bloom(ctx, 0, 0, 16, glow);
        ctx.save();
        ctx.rotate(t * 8);
        ctx.fillStyle = "rgba(200,255,160,0.88)";
        ctx.strokeStyle = core;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        return;
      }
      this.bloom(ctx, 0, 0, 16, glow);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawThrownWeapon(ctx, wep, sk) {
      const style = sk ? shotStyleOf(sk) : null;
      if (style) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        this.bloom(ctx, 0, 0, 28, style.glow || rgbaHex(style.core || "#fff", 0.55));
        ctx.restore();
      }
      const w = wep || "novice";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (w === "saber") {
        const blade = (style && (style.hex || style.core)) || "#5cff9a";
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = rgbaHex(blade, 0.45);
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(-42, 0);
        ctx.lineTo(42, 0);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = blade;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
        ctx.strokeStyle = "#f3fff8";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-38, 0);
        ctx.lineTo(38, 0);
        ctx.stroke();
        ctx.fillStyle = "#2a3038";
        ctx.fillRect(-7, -5.5, 14, 11);
        ctx.fillStyle = "#c9b48a";
        ctx.fillRect(-4, -3.2, 8, 6.4);
        return;
      }
      if (w === "daggers" || w === "assassin") {
        const blade = (ox, oy, rot) => {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate(rot);
          ctx.fillStyle = "#c8c4bc";
          ctx.beginPath();
          ctx.moveTo(-18, -2.2);
          ctx.lineTo(20, 0);
          ctx.lineTo(-18, 2.2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#2a1810";
          ctx.fillRect(-8, -3.4, 8, 6.8);
          ctx.strokeStyle = "#efe7d6";
          ctx.lineWidth = 1;
          ctx.strokeRect(-8, -3.4, 8, 6.8);
          ctx.restore();
        };
        blade(-6, -5, -0.45);
        blade(6, 5, 0.85);
        return;
      }
      const look = { coat: "#12151a", head: "#1a1e24", trim: "#c9b48a" };
      ctx.translate(-22, 0);
      ctx.scale(1.25, 1.25);
      this.drawGear(ctx, w, 0, COLORS.novice, look);
    }

    drawPulseOrb(ctx, t) {
      const throb = 1 + Math.sin((t || 0) * 32) * 0.1;
      this.bloom(ctx, 0, 0, 30 * throb, "rgba(255, 30, 150, 0.38)");
      this.bloom(ctx, 0, 0, 18 * throb, "rgba(255, 70, 200, 0.75)");
      this.bloom(ctx, 0, 0, 10, "rgba(255, 210, 255, 0.95)");
      ctx.fillStyle = "rgba(255, 90, 210, 0.95)";
      ctx.beginPath();
      ctx.arc(0, 0, 6.4 * throb, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8ff";
      ctx.beginPath();
      ctx.arc(0, 0, 3.6 * throb, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 210, 0.95)";
      ctx.beginPath();
      ctx.arc(-1.4, -1.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    hpBar(ctx, x, y, w, ratio, cls, key) {
      const target = Math.max(0, Math.min(1, ratio || 0));
      const k = String(key || x + ":" + y);
      const prev = this.hpAnim[k];
      const t = prev == null ? target : prev + (target - prev) * 0.22;
      this.hpAnim[k] = t;
      const player = cls === "player";
      const mob = cls === "mob";
      const h = player ? 8 : cls === "boss" ? 9 : 3;
      if (mob) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = t > 0.3 ? "#8a3038" : "#e23b4a";
        ctx.fillRect(x, y, w * t, h);
        return;
      }
      ctx.fillStyle = "#05070a";
      ctx.fillRect(x - 3, y - 2, w + 6, h + 4);
      ctx.strokeStyle = player ? "rgba(90, 212, 255, 0.65)" : "rgba(180, 200, 220, 0.55)";
      ctx.lineWidth = player ? 1.4 : 1;
      ctx.strokeRect(x - 3, y - 2, w + 6, h + 4);
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(x, y, w, h);
      const fill = cls === "boss" ? "#e23b4a" : cls === "shadow-foe" ? "#ff3355" : (cls === "shadow" || cls === "shadow-ally") ? "#5ad4ff" : player ? (t > 0.32 ? "#5ad48a" : "#e23b4a") : "#3dcc7a";
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w * t, h);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x, y, w * t, 1.5);
      if (player) {
        ctx.fillStyle = "rgba(90, 212, 255, 0.55)";
        ctx.fillRect(x + w * t - 2, y - 1, 2.5, h + 2);
      }
    }

    drawFx(ctx) {
      const next = [];
      for (const f of this.fx) {
        f.life -= 0.016;
        if (f.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.translate(f.x, f.y);
        if (f.kind === "swing") {
          const bits = String(f.extra || "").split("|");
          const ang = parseFloat(bits[0]) || 0;
          const punch = bits[1] === "punch";
          const u = 1 - Math.max(0, f.life / 0.26);
          ctx.rotate(ang);
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = punch ? "rgba(255, 190, 120, 0.7)" : "rgba(210, 230, 255, 0.7)";
          ctx.lineWidth = punch ? 11 : 8;
          ctx.beginPath();
          ctx.arc(10, 0, (punch ? 22 : 34) + u * 18, -1.1 + u * 0.2, 1.0 + u * 0.35);
          ctx.stroke();
          ctx.strokeStyle = punch ? "rgba(255, 255, 240, 0.85)" : "rgba(255, 255, 255, 0.8)";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(10, 0, (punch ? 22 : 34) + u * 18, -0.7, 0.55 + u * 0.4);
          ctx.stroke();
          ctx.restore();
          next.push(f);
          continue;
        }
        if (f.kind === "slash") {
          const ang = parseFloat(f.extra) || 0;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "rgba(90, 212, 255, 0.45)";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(0, 0, 18 + (1 - f.life) * 22, ang - 0.9, ang + 0.9);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = "#d8e4f0";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(0, 0, 18 + (1 - f.life) * 22, ang - 0.9, ang + 0.9);
          ctx.stroke();
          ctx.strokeStyle = "rgba(226, 59, 74, 0.8)";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, 10 + (1 - f.life) * 10, ang - 0.5, ang + 0.5);
          ctx.stroke();
          ctx.restore();
          next.push(f);
          continue;
        }
        if (f.kind === "flash" || f.kind === "beam" || f.kind === "orbhit") {
          const maxL = f.kind === "orbhit" ? 0.2 : 0.09;
          const fade = Math.max(0, f.life / maxL);
          const grow = f.kind === "orbhit" ? 1 + (1 - fade) * 1.6 : 1;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = fade;
          this.bloom(ctx, 0, 0, 22 * grow, "rgba(255, 40, 170, 0.7)");
          this.bloom(ctx, 0, 0, 12 * grow, "rgba(255, 180, 240, 0.9)");
          ctx.fillStyle = "#fff8ff";
          ctx.beginPath();
          ctx.arc(0, 0, 4.5 * grow, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.restore();
          next.push(f);
          continue;
        }
        if (f.kind === "flame") {
          const rise = (1 - f.life) * 28;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          this.bloom(ctx, 0, -rise * 0.4, 36 + (1 - f.life) * 22, "rgba(255, 80, 20, 0.55)");
          ctx.fillStyle = "rgba(255, 70, 20, 0.85)";
          ctx.beginPath();
          ctx.moveTo(-14, 8);
          ctx.quadraticCurveTo(-4, -10 - rise, 0, -28 - rise);
          ctx.quadraticCurveTo(6, -8 - rise, 14, 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(255, 210, 70, 0.9)";
          ctx.beginPath();
          ctx.moveTo(-7, 6);
          ctx.quadraticCurveTo(0, -8 - rise, 0, -18 - rise);
          ctx.quadraticCurveTo(3, -4 - rise, 7, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.restore();
          next.push(f);
          continue;
        }
        if (f.kind === "absorb") {
          const maxL = 1.15;
          const u = 1 - Math.max(0, Math.min(1, f.life / maxL));
          const fade = Math.max(0, f.life / maxL);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          this.bloom(ctx, 0, 0, 34 + u * 70, "rgba(197, 107, 255, " + (0.28 * fade) + ")");
          this.bloom(ctx, 0, -8, 18 + (1 - u) * 16, "rgba(90, 212, 255, " + (0.4 * fade) + ")");
          for (let i = 0; i < 3; i++) {
            const rr = 18 + i * 16 + u * (52 - i * 8);
            ctx.strokeStyle = i % 2 ? "rgba(90, 212, 255, " + (0.55 * fade) + ")" : "rgba(197, 107, 255, " + (0.7 * fade) + ")";
            ctx.lineWidth = 3 - i * 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, rr, this.t * 8 + i, this.t * 8 + i + Math.PI * 1.35);
            ctx.stroke();
          }
          ctx.rotate(this.t * 10);
          ctx.strokeStyle = "rgba(255, 236, 170, " + (0.65 * fade) + ")";
          ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            const a = i * (Math.PI / 3);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (48 - u * 30), Math.sin(a) * (48 - u * 30));
            ctx.lineTo(Math.cos(a) * (8 + u * 6), Math.sin(a) * (8 + u * 6));
            ctx.stroke();
          }
          ctx.restore();
          ctx.fillStyle = "#e8d0ff";
          ctx.font = "800 36px Cinzel, serif";
          ctx.textAlign = "center";
          ctx.strokeStyle = "rgba(4, 6, 10, 0.85)";
          ctx.lineWidth = 6;
          const lift = -32 - u * 36;
          ctx.strokeText("ABSORPTION", 0, lift);
          ctx.fillText("ABSORPTION", 0, lift);
          ctx.restore();
          next.push(f);
          continue;
        }
        if (f.kind === "chest") {
          const id = String(f.extra || "");
          const isSpin = id === "roulette";
          const label = isSpin
            ? (["KATANA", "FAUX", "DAGUES", "LANCE", "MASSE", "MARTEAU", "ARC", "ARBALÈTE", "BAZOOKA", "SABRE LASER", "PISTOLET LASER"][Math.floor(this.t * 16) % 11])
            : (((typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.WEAPONS && GAME_CONFIG.WEAPONS[id] && GAME_CONFIG.WEAPONS[id].label) || id).toUpperCase());
          ctx.textAlign = "center";
          if (isSpin) {
            ctx.fillStyle = "#c9b48a";
            ctx.font = "800 36px Cinzel, serif";
            ctx.fillText(label, 0, -28);
          } else {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            this.bloom(ctx, 0, -36, 90, (id === "laser" || id === "saber") ? "rgba(90, 212, 255, 0.55)" : "rgba(231, 197, 106, 0.45)");
            ctx.restore();
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(-Math.max(120, label.length * 18), -88, Math.max(240, label.length * 36), 92);
            ctx.fillStyle = "#9ad8ff";
            ctx.font = "800 26px Rajdhani, sans-serif";
            ctx.fillText("COFFRE — OBTENU", 0, -56);
            ctx.strokeStyle = "#05070a";
            ctx.lineWidth = 8;
            ctx.font = "800 56px Cinzel, serif";
            ctx.strokeText(label, 0, -8);
            ctx.fillStyle = (id === "laser" || id === "saber") ? "#5ad4ff" : "#e7c56a";
            ctx.fillText(label, 0, -8);
          }
          ctx.restore();
          next.push(f);
          continue;
        }
        ctx.fillStyle = f.kind === "arise" || f.kind === "recall" || f.kind === "dodge" ? "#8ab4ff" : f.kind === "crit" ? "#ff4d5a" : "#c9b48a";
        ctx.font = "800 32px Cinzel, serif";
        ctx.textAlign = "center";
        if (f.kind === "crit") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          this.bloom(ctx, 0, -10, 18, "rgba(255, 60, 80, 0.7)");
          ctx.restore();
        }
        if (f.kind === "arise" || f.kind === "recall") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          this.bloom(ctx, 0, 0, 24, "rgba(90, 120, 255, 0.45)");
          ctx.restore();
        }
        const label =
          f.kind === "arise"
            ? "ÉVEIL"
            : f.kind === "level"
              ? "NIVEAU " + f.extra
              : f.kind === "pvp"
                ? "ARMÉE VOLÉE"
                : f.kind === "recall"
                  ? "RAPPEL"
                  : f.kind === "hunt"
                    ? "CHASSE"
                    : f.kind === "dodge"
                      ? (f.extra || "Esquive")
                      : f.extra || "";
        ctx.strokeStyle = "rgba(4, 6, 10, 0.85)";
        ctx.lineWidth = 5;
        ctx.strokeText(label, 0, -28 * (1.15 - f.life));
        ctx.fillText(label, 0, -28 * (1.15 - f.life));
        ctx.beginPath();
        ctx.strokeStyle = f.kind === "slam" ? "#3da6ff" : "#8a5cff";
        ctx.lineWidth = 1.2;
        ctx.arc(0, 0, 8 + (1 - f.life) * 23, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        next.push(f);
      }
      this.fx = next;
    }

    drawLight(ctx, w, h, me) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.9);
      const v = this.decor().vignette;
      g.addColorStop(0, v.a);
      g.addColorStop(0.55, v.b);
      g.addColorStop(0.82, v.c);
      g.addColorStop(1, v.d);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (me && me.c === "mage") {
        ctx.fillStyle = "rgba(70, 90, 180, 0.04)";
        ctx.fillRect(0, 0, w, h);
      }
    }

    drawMinimap(state, meId, map) {
      const c = this.mctx;
      const s = this.mini.width;
      const cx = s / 2;
      const cy = s / 2;
      const dots = state.dots && state.dots.length ? state.dots : (state.players || []).filter((p) => p.a);
      let you = (state.players || []).find((p) => p.i === meId);
      if (!you) {
        for (const p of dots) if (p.i === meId) you = p;
      }
      const mark = (state.spectate && state.follow) ? state.follow : (you || state.follow || null);
      const ox = mark ? mark.x : (state.bx || map / 2);
      const oy = mark ? mark.y : (state.by || map / 2);
      const span = 2400;
      const k = s / span;
      const wx = (x) => (x - ox) * k + cx;
      const wy = (y) => (y - oy) * k + cy;
      const near = (x, y, pad) => {
        const p = pad == null ? span * 0.7 : pad;
        return Math.abs(x - ox) < p && Math.abs(y - oy) < p;
      };

      const d = this.decor();
      c.fillStyle = d.mini;
      c.fillRect(0, 0, s, s);
      c.save();
      c.beginPath();
      const rr = 16;
      c.moveTo(rr, 0);
      c.arcTo(s, 0, s, s, rr);
      c.arcTo(s, s, 0, s, rr);
      c.arcTo(0, s, 0, 0, rr);
      c.arcTo(0, 0, s, 0, rr);
      c.closePath();
      c.clip();

      const dusk = c.createRadialGradient(cx, cy, 8, cx, cy, s * 0.72);
      dusk.addColorStop(0, d.miniDusk0);
      dusk.addColorStop(1, d.miniDusk1);
      c.fillStyle = dusk;
      c.fillRect(0, 0, s, s);

      const step = 280;
      const gx0 = Math.floor((ox - span) / step) * step;
      const gy0 = Math.floor((oy - span) / step) * step;
      c.strokeStyle = d.miniGrid;
      c.lineWidth = 1;
      c.beginPath();
      for (let x = gx0; x <= ox + span; x += step) {
        c.moveTo(wx(x), 0);
        c.lineTo(wx(x), s);
      }
      for (let y = gy0; y <= oy + span; y += step) {
        c.moveTo(0, wy(y));
        c.lineTo(s, wy(y));
      }
      c.stroke();

      c.strokeStyle = "rgba(90, 212, 255, 0.16)";
      c.beginPath();
      c.moveTo(cx, 0); c.lineTo(cx, s);
      c.moveTo(0, cy); c.lineTo(s, cy);
      c.stroke();

      if (state.br > 0) this.strokeMinimapZone(c, s, ox, oy, k, wx, wy, state, span);

      for (const g of state.portals || []) {
        if (!near(g.x, g.y)) continue;
        const px = wx(g.x);
        const py = wy(g.y);
        const col = g.ph === "shadow" ? "rgba(180, 190, 210, 0.28)" : (g.col || "#e7c56a");
        c.save();
        c.translate(px, py);
        c.fillStyle = col;
        c.globalAlpha = 0.28;
        c.beginPath();
        c.ellipse(0, 1, 6.2, 3.4, 0, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = col;
        c.lineWidth = 1.6;
        c.beginPath();
        c.ellipse(0, 0, 5.2, 2.8, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      const markBoss = (x, y, col) => {
        if (!near(x, y, span)) return;
        const px = wx(x);
        const py = wy(y);
        c.fillStyle = col;
        c.fillRect(px - 4, py - 4, 8, 8);
        c.strokeStyle = "#120816";
        c.lineWidth = 1.2;
        c.strokeRect(px - 4, py - 4, 8, 8);
      };
      const markMalakor = (x, y) => {
        const m = 16;
        let px = wx(x);
        let py = wy(y);
        px = Math.max(m, Math.min(s - m, px));
        py = Math.max(m, Math.min(s - m, py));
        c.save();
        c.translate(px, py);
        c.rotate(Math.PI / 4);
        c.fillStyle = "#ff4d5a";
        c.strokeStyle = "#fff2c8";
        c.lineWidth = 1.6;
        c.fillRect(-6, -6, 12, 12);
        c.strokeRect(-6, -6, 12, 12);
        c.restore();
        c.strokeStyle = "rgba(255, 77, 90, 0.85)";
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(px, py, 11, 0, Math.PI * 2);
        c.stroke();
      };
      if (state.mode === "raid" && state.monarch && state.monarch.a) {
        markMalakor(state.monarch.x, state.monarch.y);
      } else if (state.monarch && state.monarch.a) {
        markBoss(state.monarch.x, state.monarch.y, "#ff4d5a");
      }
      if (state.brBoss && state.brBoss.a) markBoss(state.brBoss.x, state.brBoss.y, "#c56bff");
      for (const mini of state.minis || []) markBoss(mini.x, mini.y, "#c56bff");

      for (const p of dots) {
        if (mark && p.i === mark.i) continue;
        if (!near(p.x, p.y)) continue;
        const px = wx(p.x);
        const py = wy(p.y);
        c.fillStyle = "#ff6b73";
        c.beginPath();
        c.arc(px, py, 3.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(255, 240, 242, 0.95)";
        c.lineWidth = 1.3;
        c.beginPath();
        c.arc(px, py, 3.4, 0, Math.PI * 2);
        c.stroke();
      }
      this.drawMinimapHunter(c, cx, cy);
      if (mark && mark.d != null) {
        c.strokeStyle = "rgba(184, 251, 255, 0.95)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(mark.d) * 16, cy + Math.sin(mark.d) * 16);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = "rgba(90, 212, 255, 0.4)";
      c.lineWidth = 2;
      c.strokeRect(1, 1, s - 2, s - 2);
    }

    strokeMinimapZone(c, s, ox, oy, k, wx, wy, state, span) {
      const zr = state.br;
      if (!(zr > 0)) return;
      const bx = state.bx || 0;
      const by = state.by || 0;
      const zd = Math.hypot(bx - ox, by - oy);
      const view = span * 0.85;
      if (zd + view < zr) return;
      if (zd - view > zr) {
        c.fillStyle = "rgba(8, 22, 32, 0.42)";
        c.fillRect(0, 0, s, s);
        return;
      }
      c.strokeStyle = "rgba(90, 212, 255, 0.55)";
      c.lineWidth = 1.6;
      const rpx = zr * k;
      const zx = wx(bx);
      const zy = wy(by);
      const safe = rpx < 900 && zx > -1200 && zx < s + 1200 && zy > -1200 && zy < s + 1200;
      if (safe) {
        c.beginPath();
        c.arc(zx, zy, rpx, 0, Math.PI * 2);
        c.stroke();
        return;
      }
      const aMid = Math.atan2(oy - by, ox - bx);
      const half = Math.min(Math.PI * 0.85, view / Math.max(zr, 1) + 0.2);
      c.beginPath();
      const n = 56;
      for (let i = 0; i <= n; i++) {
        const a = aMid - half + (2 * half * i) / n;
        const px = wx(bx + Math.cos(a) * zr);
        const py = wy(by + Math.sin(a) * zr);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
    }

    drawSelfPing(ctx) {
      const t = this.t || 0;
      const blink = 0.5 + 0.5 * Math.sin(t * 8);
      const on = blink > 0.18;
      ctx.save();
      ctx.globalAlpha = 0.35 + blink * 0.65;
      ctx.strokeStyle = "#7af0ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 10, 22 + blink * 10, 9 + blink * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      const wave = (t * 1.35) % 1;
      ctx.globalAlpha = (1 - wave) * 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 10, 18 + wave * 42, 7 + wave * 16, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (on) {
        ctx.save();
        ctx.fillStyle = "rgba(180, 250, 255, 0.22)";
        ctx.beginPath();
        ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    drawMinimapHunter(c, x, y) {
      const t = this.t || 0;
      const blink = 0.5 + 0.5 * Math.sin(t * 9);
      const on = blink > 0.12;
      for (let i = 0; i < 2; i++) {
        const wave = (t * 1.4 + i * 0.5) % 1;
        c.strokeStyle = "rgba(122, 240, 255," + ((1 - wave) * 0.7).toFixed(3) + ")";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, 5 + wave * 16, 0, Math.PI * 2);
        c.stroke();
      }
      c.strokeStyle = "rgba(90, 212, 255, 0.35)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(x, y, 10 + blink * 3, 0, Math.PI * 2);
      c.stroke();
      if (on) {
        c.fillStyle = "#b8fbff";
        c.beginPath();
        c.arc(x, y, 4.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#ffffff";
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(x, y, 4.4, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.fillStyle = "rgba(90, 212, 255, 0.35)";
        c.beginPath();
        c.arc(x, y, 3.2, 0, Math.PI * 2);
        c.fill();
      }
    }

    drawSkinPreview(ctx, w, h, t, p, opt) {
      this.t = t;
      if (!this.hpAnim) this.hpAnim = {};
      const d = this.decor();
      const sc = (opt && opt.scale) || 2.35;
      const cy = (opt && opt.cy) || 0.62;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, d.sky[0]);
      sky.addColorStop(0.45, d.sky[1]);
      sky.addColorStop(1, d.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const spot = ctx.createRadialGradient(w * 0.5, h * 0.22, 8, w * 0.5, h * 0.55, Math.max(w, h) * 0.62);
      spot.addColorStop(0, d.spot);
      spot.addColorStop(0.45, "rgba(90, 160, 200, 0.06)");
      spot.addColorStop(1, "transparent");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);
      const mist = ctx.createLinearGradient(0, h * 0.55, 0, h);
      mist.addColorStop(0, "transparent");
      mist.addColorStop(1, d.mist);
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + ((opt && opt.ox) || 0), h * cy);
      ctx.scale(sc, sc);
      ctx.fillStyle = d.shadow;
      ctx.beginPath();
      ctx.ellipse(0, 18, 46, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = d.ring;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 16, 38, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(231, 197, 106, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 16, 28, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      const dummy = {
        i: "preview",
        n: p.n || "Toi",
        a: 1,
        c: "novice",
        w: p.w || "saber",
        h: 92,
        H: 100,
        lv: p.lv || 12,
        d: p.d != null ? p.d : 0.35 + Math.sin(t * 0.7) * 0.15,
        g: t * 7,
        mv: p.mv != null ? p.mv : 1,
        sw: p.sw != null ? p.sw : (Math.sin(t * 2.6) * 0.5 + 0.5) * 0.85,
        ou: p.ou || "",
        ws: p.ws || "",
        tr: p.tr || "",
        sp: p.sp || "",
        stt: p.stt || 0,
        bs: p.bs || "",
        mg: 0,
      };
      if (dummy.stt > 0) this.drawSpawnStyle(ctx, dummy);
      this.drawHunterBody(ctx, dummy, false, "self");
      if (dummy.tr) this.drawStyleTrail(ctx, dummy);
      if (dummy.bs) {
        const st = shotStyleOf(dummy.bs);
        if (st) {
          ctx.save();
          ctx.translate(42 + Math.sin(t * 5) * 6, -10);
          ctx.rotate(0.12);
          this.drawShotSkin(ctx, { k: "bolt" }, st);
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  Renderer.ZOOM_STEPS = [1, 1.2, 1.4, 2];
  Renderer.snapZoom = function (n) {
    const steps = Renderer.ZOOM_STEPS;
    let x = parseFloat(n);
    if (!isFinite(x) || x <= 0) return 1;
    let best = steps[0];
    let dist = Math.abs(x - best);
    for (let i = 1; i < steps.length; i++) {
      const d = Math.abs(x - steps[i]);
      if (d < dist) {
        dist = d;
        best = steps[i];
      }
    }
    return best;
  };

  global.Renderer = Renderer;
})(window);
