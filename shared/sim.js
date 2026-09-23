(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./config"));
  else root.GameRoom = factory(root.GAME_CONFIG);
})(typeof window !== "undefined" ? window : globalThis, function (CFG) {
  const BOT_NAMES = [
    "Nyx", "Kael", "Ashen", "Vex", "Dusk", "Sable", "Thorn", "Riven",
    "Noctis", "Lira", "Grimm", "Eira", "Kage", "Solace", "Hex",
  ];
  let nid = 1;
  const uid = () => (nid++).toString(36);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const lerp = (a, b, t) => a + (b - a) * t;
  const TYPES = Object.keys(CFG.MONSTER);
  const wepOf = (p) => {
    const id = (p && p.wep) || "novice";
    const w = (CFG.WEAPONS && CFG.WEAPONS[id]) || CFG.WEAPONS.novice || {};
    let style = "novice";
    if (w.proj) style = "mage";
    else if (w.aoe || w.swing === "crush") style = "tank";
    else if (w.swing === "slash") style = "assassin";
    return Object.assign({ atk: 9, range: 88, cd: 0.58, swing: "punch" }, w, { id: id, kit: style });
  };
  const CHEST_WEAPONS = CFG.CHEST_WEAPONS || ["katana", "scythe", "daggers", "spear", "mace", "hammer", "bow", "crossbow", "bazooka", "saber", "laser"];
  const rollChestWeapon = () => pick(CHEST_WEAPONS);
  const shotOf = (src) => (src && (src.shotSkin || src.wepSkin)) || "";
  const parseKind = (mode) => {
    if (mode === "raid") return "raid";
    if (mode === "rush") return "rush";
    return "br";
  };

  class GameRoom {
    constructor(mode) {
      this.id = uid() + Date.now().toString(36);
      this.kind = parseKind(mode);
      this.mode = this.kind === "raid" ? "raid" : "br";
      this.timeScale = this.kind === "rush" ? 2 : 1;
      this.state = "waiting";
      this.players = new Map();
      this.monsters = new Map();
      this.shadows = new Map();
      this.loots = new Map();
      this.projectiles = [];
      this.monarch = null;
      this.brBoss = null;
      this.minis = new Map();
      this.obstacles = [];
      this.portals = [];
      this.time = 0;
      this.zoneState = "delay";
      this.zoneLeft = CFG.SHRINK_DELAY;
      this.zonePhase = 0;
      this.lookCursor = 0;
      this.lobbyLeft = CFG.LOBBY_SECONDS;
      this.barrierR = CFG.BARRIER_START;
      this.barrierCx = CFG.MAP_SIZE / 2;
      this.barrierCy = CFG.MAP_SIZE / 2;
      this.bossAlerted = false;
      this.winner = null;
      this.winReason = "";
      this.duel = null;
      this.duelAsk = null;
      this.logs = [];
      this.tickTimer = null;
      this._ev = {};
    }

    on(ev, fn) {
      (this._ev[ev] || (this._ev[ev] = [])).push(fn);
    }

    emit(ev, data) {
      const list = this._ev[ev] || [];
      for (let i = 0; i < list.length; i++) list[i](data);
    }

    log(text) {
      const row = { t: this.time, text };
      this.logs.push(row);
      if (this.logs.length > 12) this.logs.shift();
      this.emit("sys", row);
    }

    addPlayer(id, name, isBot, cosmetics, startCls) {
      if (this.state !== "waiting") return false;
      if (this.players.size >= CFG.MAX_PLAYERS) return false;
      const p = this.spawnHunter(id, (name || "Chasseur").slice(0, 16), !!isBot, cosmetics, startCls);
      this.players.set(p.id, p);
      this.emit("lobby", this.lobbyPayload());
      if (!this.tickTimer) this.tickTimer = setInterval(() => this.tick(), CFG.TICK_MS);
      return true;
    }

    spawnHunter(id, name, isBot, cosmetics, startCls) {
      const cls = !isBot && CFG.CLASS[startCls] ? startCls : "novice";
      const stats = CFG.CLASS[cls] || CFG.CLASS.novice;
      const style = cosmetics && typeof cosmetics === "object" ? cosmetics : {};
      const p = {
        id, name, isBot, alive: true,
        trail: style.trail || "",
        outfit: style.outfit || "",
        wepSkin: style.weapon || "",
        shotSkin: style.shot || "",
        spawnStyle: style.spawn || "",
        spawnT: 0,
        x: 0, y: 0, vx: 0, vy: 0, gait: 0, moving: 0,
        dir: 0, cls: cls, wep: "novice", wep2: "", swing: 0, chestT: 0, chests: 0,
        hp: stats.hp, maxHp: stats.hp, atk: 9, speed: stats.speed,
        range: 88, cd: 0.58, armor: stats.armor || 0,
        lastAtk: 0, level: 1, xp: 0, slowT: 0,
        kills: 0, shadowsStolen: 0, armyStance: "hunt", recallPull: 0,
        orbBars: 0, barW: stats.bar || 40,
        orbForce: 0, orbVital: 0, orbHaste: 0, orbShadow: 0,
        tileSpeed: 0, tileHeal: 0, tileMight: 0,
        hasteT: 0, mightT: 0, megaT: 0, gateT: 0, gateCd: 0,
        dodgeCd: 0, dodgeT: 0, fightBossId: null, fightBossT: 0,
        combatT: 0, sprintT: 0, sprintCd: 0, sprintFuel: (CFG.BUFF_TIME || 16) * 0.5, atkHoldT: 0, swappedHold: 0,
        wantAtk: 0, atkHeld: 0, atkTap: 0, spectateId: null, killedBy: null, look: this.lookCursor++,
        mergeCd: 0,
        foundClasses: cls !== "novice" ? [cls] : [],
        input: { dx: 0, dy: 0 }, aim: 0,
        bot: isBot ? { wander: 0, tx: 0, ty: 0, recallCd: 4, mergeCd: 7 } : null,
      };
      if (cls !== "novice") this.applyLoadout(p);
      this.placeHunter(p);
      return p;
    }

    placeHunter(p) {
      const pad = 900;
      p.x = rand(pad, CFG.MAP_SIZE - pad);
      p.y = rand(pad, CFG.MAP_SIZE - pad);
      p.dir = Math.random() * Math.PI * 2;
      p.vx = 0;
      p.vy = 0;
    }

    removePlayer(id, reason) {
      const p = this.players.get(id);
      if (!p) return;
      if (this.state === "playing" && p.alive) this.killHunter(p, null, reason || "disconnect");
      this.players.delete(id);
      if (this.state === "waiting") this.emit("lobby", this.lobbyPayload());
      const humans = [...this.players.values()].filter((x) => !x.isBot);
      if (humans.length === 0) this.destroy();
    }

    lobbyPayload() {
      return {
        mode: this.kind || this.mode,
        seconds: Math.ceil(this.lobbyLeft),
        players: [...this.players.values()].map((p) => ({ name: p.name, isBot: p.isBot })),
      };
    }

    startMatch() {
      this.state = "playing";
      this.time = 0;
      this.bossAlerted = false;
      const humans = [...this.players.values()].filter((p) => !p.isBot).length;
      const fill = Math.max(0, CFG.BOT_FILL - this.players.size);
      for (let i = 0; i < fill; i++) {
        const id = "bot-" + uid();
        this.players.set(id, this.spawnHunter(id, pick(BOT_NAMES) + "-" + (i + 1), true));
      }
      this.spawnWorld();
      this.spawnGateBosses(humans);
      this.linkPortalsToBosses();
      for (const p of this.players.values()) {
        if (!p.isBot) this.placeHunter(p);
      }
      this.log("Drop : vous apparaissez au hasard sur la carte.");
      for (const p of this.players.values()) {
        p.spawnT = p.spawnStyle ? 2.2 : 0;
        if (p.spawnStyle) this.emitFx(p.x, p.y, "spawn", p.spawnStyle);
      }
      this.emit("start", { mode: this.kind || this.mode, map: CFG.MAP_SIZE });
    }

    scatterNearGate(rankBias) {
      const gates = CFG.GATES || [];
      let pool = gates;
      if (rankBias && gates.length) {
        const filtered = gates.filter((g) => rankBias.indexOf(g.rank) >= 0);
        if (filtered.length) pool = filtered;
      }
      if (!pool.length) pool = gates;
      if (Math.random() < 0.62 && pool.length) {
        const g = pick(pool);
        const spread = g.rank === "S" ? 520 : g.rank === "A" ? 400 : 320;
        return {
          x: clamp(g.x + rand(-spread, spread), 160, CFG.MAP_SIZE - 160),
          y: clamp(g.y + rand(-spread, spread), 160, CFG.MAP_SIZE - 160),
          rank: g.rank,
        };
      }
      return { x: rand(200, CFG.MAP_SIZE - 200), y: rand(200, CFG.MAP_SIZE - 200), rank: "E" };
    }

    scatterAnywhere() {
      return {
        x: rand(220, CFG.MAP_SIZE - 220),
        y: rand(220, CFG.MAP_SIZE - 220),
      };
    }

    spreadPositions(n) {
      const count = Math.max(1, n | 0);
      const pad = 260;
      const usable = CFG.MAP_SIZE - pad * 2;
      const cols = Math.max(8, Math.ceil(Math.sqrt(count)));
      const rows = Math.max(8, Math.ceil(count / cols));
      const cellW = usable / cols;
      const cellH = usable / rows;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) cells.push((r << 16) | c);
      }
      for (let i = cells.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = cells[i];
        cells[i] = cells[j];
        cells[j] = tmp;
      }
      const jx = cellW * 0.22;
      const jy = cellH * 0.22;
      const out = [];
      for (let i = 0; i < count; i++) {
        const packed = cells[i % cells.length];
        const c = packed & 0xffff;
        const r = packed >>> 16;
        const layer = Math.floor(i / cells.length);
        const ox = (layer % 2) * (cellW * 0.18);
        const oy = (layer % 3) * (cellH * 0.18);
        out.push({
          x: clamp(pad + (c + 0.5) * cellW + rand(-jx, jx) + ox, pad, CFG.MAP_SIZE - pad),
          y: clamp(pad + (r + 0.5) * cellH + rand(-jy, jy) + oy, pad, CFG.MAP_SIZE - pad),
        });
      }
      return out;
    }

    scatterEvenly(index, total) {
      const n = Math.max(1, total || 1);
      const cols = Math.max(4, Math.ceil(Math.sqrt(n)));
      const rows = Math.max(4, Math.ceil(n / cols));
      const col = index % cols;
      const row = Math.min(rows - 1, Math.floor(index / cols));
      const pad = 380;
      const cellW = (CFG.MAP_SIZE - pad * 2) / cols;
      const cellH = (CFG.MAP_SIZE - pad * 2) / rows;
      const x = pad + (col + 0.5) * cellW + rand(-cellW * 0.38, cellW * 0.38);
      const y = pad + (row + 0.5) * cellH + rand(-cellH * 0.38, cellH * 0.38);
      return {
        x: clamp(x, pad, CFG.MAP_SIZE - pad),
        y: clamp(y, pad, CFG.MAP_SIZE - pad),
      };
    }

    spawnGateBosses(humans) {
      const cx = CFG.MAP_SIZE / 2;
      const cy = CFG.MAP_SIZE / 2;
      if (this.mode === "raid") {
        const pow = CFG.MONARCH_POWER || 5;
        const hp = (CFG.MONARCH_HP_BASE + CFG.MONARCH_HP_PER * Math.max(1, humans)) * pow;
        this.monarch = {
          id: "monarch", x: cx, y: cy, r: CFG.MONARCH_R || CFG.BR_BOSS_R || 196,
          hp, maxHp: hp, atk: (CFG.MONARCH_ATK || 34) * pow, lastAtk: 0, alive: true,
          kind: "raid", sty: "sovereign", name: (CFG.CENTRAL_BOSS && CFG.CENTRAL_BOSS.name) || "Malakor, Souverain de l'Abîme", rank: "S", level: 50,
        };
      } else {
        this.brBoss = {
          id: "br-boss", x: cx, y: cy, r: CFG.BR_BOSS_R,
          hp: CFG.BR_BOSS_HP, maxHp: CFG.BR_BOSS_HP, atk: CFG.BR_BOSS_ATK,
          lastAtk: 0, alive: true, kind: "br", sty: "sovereign",
          name: (CFG.CENTRAL_BOSS && CFG.CENTRAL_BOSS.name) || "Malakor, Souverain de l'Abîme", rank: "S", level: 50,
        };
      }
      const placed = [{ x: cx, y: cy }];
      for (const g of CFG.GATES || []) {
        if (g.rank === "S") continue;
        const off = this.bossSpotAwayFrom(g.x, g.y, placed);
        placed.push(off);
        this.spawnMiniBoss({
          x: off.x, y: off.y, r: CFG.MINI_R || 98, hp: g.hp, atk: g.atk,
          name: g.name, sty: g.sty, rank: g.rank, color: g.color, gateX: g.x, gateY: g.y,
        });
      }
      const gap = CFG.BOSS_PORTAL_GAP || 1800;
      for (const m of CFG.MINIS || []) {
        let px = m.x;
        let py = m.y;
        let near = null;
        let nd = gap;
        for (const p of this.portals || []) {
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d < nd) { nd = d; near = p; }
        }
        if (near) {
          const off = this.bossSpotAwayFrom(near.x, near.y, placed);
          px = off.x;
          py = off.y;
        } else if (Math.hypot(m.x - cx, m.y - cy) < 1400) {
          const off = this.bossSpotAwayFrom(cx, cy, placed);
          px = off.x;
          py = off.y;
        }
        placed.push({ x: px, y: py });
        this.spawnMiniBoss({
          x: px, y: py, r: CFG.MINI_R || 98, hp: m.hp, atk: m.atk,
          name: m.name, sty: m.sty, rank: m.rank, color: m.color,
        });
      }
    }

    bossSpotAwayFrom(px, py, placed) {
      const gap = CFG.BOSS_PORTAL_GAP || 1800;
      const pad = 520;
      const cx = CFG.MAP_SIZE / 2;
      const cy = CFG.MAP_SIZE / 2;
      const ang0 = Math.atan2(cy - py, cx - px);
      const tryAng = (a) => {
        const x = clamp(px + Math.cos(a) * gap, pad, CFG.MAP_SIZE - pad);
        const y = clamp(py + Math.sin(a) * gap, pad, CFG.MAP_SIZE - pad);
        if (Math.hypot(x - px, y - py) < gap * 0.72) return null;
        if (Math.hypot(x - cx, y - cy) < 1200) return null;
        for (let i = 0; i < (placed || []).length; i++) {
          const u = placed[i];
          if (Math.hypot(u.x - x, u.y - y) < 720) return null;
        }
        return { x, y };
      };
      let hit = tryAng(ang0);
      if (hit) return hit;
      for (let k = 1; k <= 12; k++) {
        hit = tryAng(ang0 + k * 0.48) || tryAng(ang0 - k * 0.48);
        if (hit) return hit;
      }
      return {
        x: clamp(px + Math.cos(ang0) * gap, pad, CFG.MAP_SIZE - pad),
        y: clamp(py + Math.sin(ang0) * gap, pad, CFG.MAP_SIZE - pad),
      };
    }

    spawnMiniBoss(def) {
      const id = "mini-" + (def.rank || "E") + "-" + uid();
      this.minis.set(id, {
        id, x: def.x, y: def.y, r: def.r, hp: def.hp, maxHp: def.hp, atk: def.atk,
        lastAtk: 0, alive: true, name: def.name, kind: "mini",
        sty: def.sty, rank: def.rank, color: def.color, gateX: def.gateX, gateY: def.gateY,
        level: ({ E: 10, D: 14, C: 18, B: 22, A: 30, S: 50 })[def.rank] || 12,
      });
    }

    linkPortalsToBosses() {
      const central = this.monarch || this.brBoss;
      for (const p of this.portals || []) {
        if (p.bossKey === "central") {
          this.bindPortalToBoss(p, central);
          continue;
        }
        let linked = null;
        if (p.rank) {
          for (const mini of this.minis.values()) {
            if (mini.gateX == null) continue;
            if (Math.hypot(p.x - mini.gateX, p.y - mini.gateY) < 48) {
              linked = mini;
              break;
            }
          }
        }
        if (!linked) linked = this.portalTargetBoss(p);
        this.bindPortalToBoss(p, linked);
      }
    }

    collapsePortalsForBoss(boss) {
      if (!boss || !this.portals) return;
      const central = boss.id === "monarch" || boss.id === "br-boss" || boss.kind === "raid" || boss.kind === "br";
      for (const p of this.portals) {
        if (p.phase === "shadow") continue;
        const match = (p.bossId && p.bossId === boss.id) || (central && p.bossKey === "central");
        if (!match) continue;
        p.phase = "shadow";
        p.shadowT = 1.35;
        this.emitFx(p.x, p.y, "arise", "Ombre");
      }
    }

    updatePortals(dt) {
      if (!this.portals || !this.portals.length) return;
      this.portals = this.portals.filter((p) => {
        if (p.phase !== "shadow") return true;
        p.shadowT -= dt;
        if (p.shadowT > 0) return true;
        this.emitFx(p.x, p.y, "recall", "Disparition");
        return false;
      });
    }

    bossById(id) {
      if (!id) return null;
      if (id === "monarch") return this.monarch && this.monarch.alive ? this.monarch : null;
      if (id === "br-boss") return this.brBoss && this.brBoss.alive ? this.brBoss : null;
      const mini = this.minis.get(id);
      return mini && mini.alive ? mini : null;
    }

    markBossFight(attacker, boss) {
      if (!boss || !attacker) return;
      let hunter = this.players.get(attacker.id);
      if (!hunter && attacker.ownerId) hunter = this.players.get(attacker.ownerId);
      if (!hunter || !hunter.alive) return;
      hunter.fightBossId = boss.id;
      hunter.fightBossT = 5.5;
    }

    spawnObstacles() {
      this.obstacles = [];
      const gates = CFG.GATES || [];
      const minis = CFG.MINIS || [];
      const cx = CFG.MAP_SIZE / 2;
      const cy = CFG.MAP_SIZE / 2;
      const blockedAt = (x, y, r) => {
        if (Math.hypot(x - cx, y - cy) < 280 + r) return true;
        for (const g of gates) {
          if (Math.hypot(x - g.x, y - g.y) < 160 + r * 0.4) return true;
        }
        for (const m of minis) {
          if (Math.hypot(x - m.x, y - m.y) < 180 + r * 0.35) return true;
        }
        for (const o of this.obstacles) {
          if (Math.hypot(x - o.x, y - o.y) < o.r + r + 36) return true;
        }
        return false;
      };
      const add = (r, k) => {
        for (let t = 0; t < 22; t++) {
          const x = rand(220, CFG.MAP_SIZE - 220);
          const y = rand(220, CFG.MAP_SIZE - 220);
          if (blockedAt(x, y, r)) continue;
          this.obstacles.push({ x, y, r, k });
          return true;
        }
        return false;
      };
      for (let i = 0; i < CFG.OBSTACLE_COUNT; i++) {
        const huge = i % 11 === 0;
        const big = !huge && i % 4 === 0;
        const r = huge ? rand(110, 168) : big ? rand(64, 96) : rand(28, 50);
        add(r, i % 4 === 0 ? "ruin" : "rock");
      }
      const extraBig = CFG.BIG_ROCK_COUNT || 28;
      for (let i = 0; i < extraBig; i++) {
        add(rand(120, 190), "rock");
      }
    }

    spawnPortals() {
      this.portals = [];
      const tooClose = (x, y, min) => {
        for (const p of this.portals) {
          if (Math.hypot(p.x - x, p.y - y) < min) return true;
        }
        return false;
      };
      for (const g of CFG.GATES || []) {
        if (g.rank === "S") continue;
        this.portals.push({
          x: g.x, y: g.y, rank: g.rank, color: g.color, name: g.name,
          phase: "", shadowT: 0, bossId: null, bossKey: "",
          bossName: g.name, bossLv: ({ E: 10, D: 14, C: 18, B: 22, A: 30, S: 50 })[g.rank] || 12,
        });
      }
      const extra = CFG.PORTAL_COUNT || 18;
      for (let i = 0; i < extra; i++) {
        let x = 0;
        let y = 0;
        let ok = false;
        for (let t = 0; t < 28; t++) {
          x = rand(380, CFG.MAP_SIZE - 380);
          y = rand(380, CFG.MAP_SIZE - 380);
          if (tooClose(x, y, 1100)) continue;
          if (Math.hypot(x - CFG.MAP_SIZE / 2, y - CFG.MAP_SIZE / 2) < (CFG.BOSS_PORTAL_GAP || 1800)) continue;
          let nearBoss = false;
          const gap = CFG.BOSS_PORTAL_GAP || 1800;
          for (const m of CFG.MINIS || []) {
            if (Math.hypot(x - m.x, y - m.y) < gap) { nearBoss = true; break; }
          }
          if (!nearBoss) {
            for (const g of CFG.GATES || []) {
              if (Math.hypot(x - g.x, y - g.y) < 900) { nearBoss = true; break; }
            }
          }
          if (nearBoss) continue;
          ok = true;
          break;
        }
        if (!ok) continue;
        this.portals.push({
          x, y, rank: "", color: "#5ad4ff", name: "Faille",
          phase: "", shadowT: 0, bossId: null, bossKey: "",
          bossName: "Faille", bossLv: 1,
        });
      }
    }

    bossLandings() {
      const pts = [];
      if (this.monarch && this.monarch.alive) pts.push(this.monarch);
      if (this.brBoss && this.brBoss.alive) pts.push(this.brBoss);
      for (const mini of this.minis.values()) {
        if (mini.alive) pts.push(mini);
      }
      if (!pts.length) pts.push({ x: CFG.MAP_SIZE / 2, y: CFG.MAP_SIZE / 2, name: "Centre", r: 120 });
      return pts;
    }

    portalTargetBoss(portal) {
      const cx = CFG.MAP_SIZE / 2;
      const cy = CFG.MAP_SIZE / 2;
      const ox = cx * 2 - portal.x;
      const oy = cy * 2 - portal.y;
      const bosses = this.bossLandings().filter((b) => {
        const pad = (b.r || 80) + 50;
        return Math.hypot(b.x - this.barrierCx, b.y - this.barrierCy) + pad < this.barrierR;
      });
      if (!bosses.length) return null;
      let best = bosses[0];
      let bestD = Infinity;
      for (const b of bosses) {
        const d = Math.hypot(b.x - ox, b.y - oy);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      return best;
    }

    bindPortalToBoss(p, boss) {
      if (!p || !boss) return;
      const rankCol = (CFG.RANK_COLOR && CFG.RANK_COLOR[boss.rank]) || (CFG.RANK_COLOR && CFG.RANK_COLOR[p.rank]);
      const lvMap = { E: 10, D: 14, C: 18, B: 22, A: 30, S: 50 };
      p.bossName = (boss.kind === "raid" || boss.kind === "br")
        ? ((CFG.CENTRAL_BOSS && CFG.CENTRAL_BOSS.short) || "Malakor")
        : (boss.name || p.name || "Boss");
      p.bossLv = boss.level || lvMap[boss.rank] || lvMap[p.rank] || 12;
      if (boss.rank) p.rank = boss.rank;
      p.color = boss.color || rankCol || p.color || "#5ad4ff";
      if (boss.id === "monarch" || boss.id === "br-boss" || boss.kind === "raid" || boss.kind === "br") {
        p.bossKey = "central";
        p.rank = p.rank || "S";
        p.color = p.color || (CFG.RANK_COLOR && CFG.RANK_COLOR.S) || "#efe7d6";
        p.bossLv = boss.level || 50;
      } else if (boss.id) {
        p.bossId = boss.id;
      }
    }

    portalDestination(portal) {
      const best = this.portalTargetBoss(portal);
      if (!best) {
        const cx = CFG.MAP_SIZE / 2;
        const cy = CFG.MAP_SIZE / 2;
        const dest = this.clampInsideZone(cx * 2 - portal.x, cy * 2 - portal.y, 140);
        dest.name = "Zone";
        return dest;
      }
      const ang = Math.atan2(best.y - this.barrierCy, best.x - this.barrierCx);
      const pad = (best.r || 98) + 90;
      const raw = {
        x: best.x + Math.cos(ang + Math.PI / 2) * pad,
        y: best.y + Math.sin(ang + Math.PI / 2) * pad,
      };
      const dest = this.clampInsideZone(raw.x, raw.y, 110);
      dest.name = best.name || "Boss";
      return dest;
    }

    resolveSolid(e, rad) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = rad + o.r;
        if (d < min && d > 0.001) {
          const k = (min - d) / d;
          e.x += dx * k;
          e.y += dy * k;
        }
      }
    }

    blockedBySolid(x, y, rad) {
      const r = rad || 16;
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        if (Math.hypot(x - o.x, y - o.y) < o.r + r + 10) return true;
      }
      return false;
    }

    clearLootPos(x, y, rad) {
      const r = rad || 18;
      if (!this.blockedBySolid(x, y, r)) return { x: x, y: y };
      for (let t = 0; t < 48; t++) {
        const a = (t * 0.7) % (Math.PI * 2);
        const d = 36 + Math.floor(t / 6) * 28;
        const nx = clamp(x + Math.cos(a) * d, 80, CFG.MAP_SIZE - 80);
        const ny = clamp(y + Math.sin(a) * d, 80, CFG.MAP_SIZE - 80);
        if (!this.blockedBySolid(nx, ny, r)) return { x: nx, y: ny };
      }
      for (let t = 0; t < 28; t++) {
        const nx = rand(220, CFG.MAP_SIZE - 220);
        const ny = rand(220, CFG.MAP_SIZE - 220);
        if (!this.blockedBySolid(nx, ny, r)) return { x: nx, y: ny };
      }
      return { x: x, y: y };
    }

    spawnWorld() {
      this.spawnObstacles();
      this.spawnPortals();
      const classN = 48;
      const orbN = CFG.ORB_COUNT || 0;
      const tileN = CFG.TILE_COUNT || 0;
      const chestN = CFG.CHEST_COUNT || 0;
      const spots = this.spreadPositions(classN + orbN + tileN + chestN);
      let si = 0;
      const lootR = (kind, sz) => {
        if (kind === "chest") return 42;
        if (kind === "mega") return 36;
        if (kind === "tile") return 22;
        if (kind === "class") return 24;
        return 14 + (sz || 1) * 4;
      };
      for (let i = 0; i < classN; i++) {
        const id = uid();
        const pos = this.clearLootPos(spots[si].x, spots[si].y, lootR("class"));
        si++;
        this.loots.set(id, { id, kind: "class", cls: pick(["assassin", "tank", "mage"]), x: pos.x, y: pos.y });
      }
      const orbs = ["force", "vital", "haste", "shadow"];
      for (let i = 0; i < orbN; i++) {
        const id = uid();
        const roll = Math.random();
        const sz = roll > 0.88 ? 3 : roll > 0.55 ? 2 : 1;
        const pos = this.clearLootPos(spots[si].x, spots[si].y, lootR("orb", sz));
        si++;
        this.loots.set(id, { id, kind: "orb", cls: pick(orbs), sz, x: pos.x, y: pos.y });
      }
      const tiles = ["speed", "heal", "might"];
      for (let i = 0; i < tileN; i++) {
        const id = uid();
        const pos = this.clearLootPos(spots[si].x, spots[si].y, lootR("tile"));
        si++;
        this.loots.set(id, { id, kind: "tile", cls: pick(tiles), x: pos.x, y: pos.y });
      }
      for (let i = 0; i < chestN; i++) {
        const id = uid();
        const pos = this.clearLootPos(spots[si].x, spots[si].y, lootR("chest"));
        si++;
        this.loots.set(id, { id, kind: "chest", cls: "chest", x: pos.x, y: pos.y });
      }
      this.ensureMegaCubes();
      let monsterI = 0;
      let monsterN = 0;
      for (const typ of TYPES) monsterN += (CFG.MONSTER[typ] && CFG.MONSTER[typ].count) || 0;
      for (const typ of TYPES) {
        const def = CFG.MONSTER[typ];
        for (let i = 0; i < def.count; i++) this.spawnMonster(typ, monsterI++, monsterN);
      }
    }

    spawnMonster(typ, index, total, level) {
      if (!CFG.MONSTER[typ]) typ = pick(TYPES);
      const def = CFG.MONSTER[typ];
      const id = uid();
      const m = {
        id, typ, elite: def.elite,
        name: def.name,
        x: 0, y: 0,
        hp: def.hp, maxHp: def.hp, atk: def.atk, r: def.r,
        speed: def.speed, aggro: def.aggro, behavior: def.behavior,
        lastAtk: 0, wander: 0, tx: 0, ty: 0,
        wind: 0, chargeT: 0, cvx: 0, cvy: 0, gait: 0,
        level: level != null ? Math.max(1, level | 0) : (def.lv || 2) + ((Math.random() * 3) | 0),
      };
      const pos = this.scatterEvenly(index == null ? ((Math.random() * 400) | 0) : index, total || 400);
      m.x = pos.x;
      m.y = pos.y;
      this.monsters.set(id, m);
      return m;
    }

    setInput(id, input) {
      const p = this.players.get(id);
      if (!p) return;
      if (!p.alive) {
        if (input.spectateId) p.spectateId = String(input.spectateId);
        return;
      }
      const len = Math.hypot(input.dx || 0, input.dy || 0) || 1;
      p.input.dx = clamp((input.dx || 0) / len, -1, 1);
      p.input.dy = clamp((input.dy || 0) / len, -1, 1);
      if (Math.abs(input.dx) + Math.abs(input.dy) > 0.05) p.aim = Math.atan2(p.input.dy, p.input.dx);
      p.wantAtk = input.attack ? 1 : 0;
      if (p.isBot) {
        p.atkHeld = p.wantAtk;
      } else if (p.wantAtk && !p.atkHeld) {
        p.atkHeld = 1;
        p.atkHoldT = 0;
        p.swappedHold = 0;
      } else if (!p.wantAtk && p.atkHeld) {
        if (!p.swappedHold && (p.atkHoldT || 0) < 0.5) p.atkTap = 1;
        p.atkHeld = 0;
      }
      if (input.recall) this.toggleRecall(p);
      if (input.merge) this.mergeArmy(p);
      if (input.dodge) {
        if ((p.sprintT || 0) > 0) this.stopSprint(p);
        else if (this.inCombat(p)) this.tryDodge(p);
        else this.trySprint(p);
      }
      if (input.duel) this.tryDuel(p);
    }

    bodyR(p) {
      return CFG.PLAYER_R || 30;
    }

    duelSide(id) {
      if (!this.duel || !id) return null;
      if (id === this.duel.a) return "a";
      if (id === this.duel.b) return "b";
      return null;
    }

    isDuelInside(ent) {
      if (!this.duel || !ent) return false;
      return ent.id === this.duel.a || ent.id === this.duel.b;
    }

    duelAllowsHit(attacker, victim) {
      if (!this.duel) return true;
      const aId = attacker && attacker.id;
      const vId = victim && victim.id;
      const aSide = this.duelSide(aId);
      const vSide = this.duelSide(vId);
      if (aSide || vSide) return !!(aSide && vSide && aSide !== vSide);
      return true;
    }

    tryDuel(p) {
      if (!p || !p.alive || this.state !== "playing") return;
      if (this.duelAsk && this.duelAsk.to === p.id) {
        const from = this.players.get(this.duelAsk.from);
        if (from && from.alive) this.beginDuel(from, p);
        return;
      }
      if (this.duel) return;
      if (this.duelAsk && this.duelAsk.from === p.id) return;
      const range = CFG.DUEL_RANGE || 340;
      let best = null;
      let bestD = range;
      for (const o of this.players.values()) {
        if (!o.alive || o.id === p.id) continue;
        const d = dist(p, o);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (!best) {
        if (!p.isBot) this.log("Aucun chasseur assez proche pour un duel.");
        return;
      }
      this.duelAsk = {
        from: p.id,
        to: best.id,
        left: 8,
        botAt: this.time + (best.isBot ? 0.35 : 99),
      };
      this.log(p.name + " défie " + best.name + " en duel.");
      this.emitFx(p.x, p.y, "slash", "DUEL");
      this.emitFx(best.x, best.y, "slash", "DÉFI");
    }

    beginDuel(a, b) {
      this.duelAsk = null;
      if (!a || !b || !a.alive || !b.alive || a.id === b.id) return;
      const gap = dist(a, b);
      const r = clamp((CFG.DUEL_PAD || 160) + gap / 2, CFG.DUEL_R_MIN || 250, CFG.DUEL_R_MAX || 420);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      this.duel = { a: a.id, b: b.id, x: x, y: y, r: r };
      this.parkDuelArmies();
      this.enforceDuelBounds();
      this.log("Duel : " + a.name + " contre " + b.name + " — l'arène se referme.");
      this.emitFx(x, y, "flash", "DUEL");
    }

    parkDuelArmies() {
      if (!this.duel) return;
      const sides = [this.duel.a, this.duel.b];
      for (let s = 0; s < sides.length; s++) {
        const army = this.armyOf(sides[s]);
        const n = Math.max(1, army.length);
        for (let i = 0; i < army.length; i++) {
          const sh = army[i];
          const ang = (i / n) * Math.PI * 2 + (s === 0 ? 0.2 : Math.PI + 0.2);
          const rad = this.duel.r + (sh.r || CFG.SHADOW_R || 18) + 40;
          sh.x = this.duel.x + Math.cos(ang) * rad;
          sh.y = this.duel.y + Math.sin(ang) * rad;
          if (sh.vx != null) { sh.vx = 0; sh.vy = 0; }
        }
      }
    }

    endDuel(winner, loser) {
      if (!this.duel) return;
      this.duel = null;
      this.duelAsk = null;
      if (winner && winner.alive) {
        this.log(winner.name + " remporte le duel" + (loser ? " contre " + loser.name : "") + ".");
        this.emitFx(winner.x, winner.y, "level", "VICTOIRE");
      } else {
        this.log("Le duel s'achève.");
      }
    }

    updateDuel(dt) {
      if (this.duelAsk) {
        this.duelAsk.left -= dt;
        const from = this.players.get(this.duelAsk.from);
        const to = this.players.get(this.duelAsk.to);
        if (!from || !to || !from.alive || !to.alive || this.duelAsk.left <= 0) {
          if (this.duelAsk.left <= 0 && from && from.alive && to && to.alive && !from.isBot) {
            this.log(to.name + " n'accepte pas le duel.");
          }
          this.duelAsk = null;
        } else if (to.isBot && this.time >= this.duelAsk.botAt) {
          this.beginDuel(from, to);
        }
      }
      if (this.duel) {
        const a = this.players.get(this.duel.a);
        const b = this.players.get(this.duel.b);
        if (!a || !b || !a.alive || !b.alive) {
          const live = a && a.alive ? a : b && b.alive ? b : null;
          const dead = a && !a.alive ? a : b && !b.alive ? b : null;
          this.endDuel(live, dead);
        }
      }
      this.enforceDuelBounds();
    }

    constrainDuel(ent, rad) {
      if (!this.duel || !ent) return;
      const dx = ent.x - this.duel.x;
      const dy = ent.y - this.duel.y;
      let d = Math.hypot(dx, dy);
      const inside = this.isDuelInside(ent);
      if (inside) {
        const maxR = Math.max(24, this.duel.r - (rad || 16) - 6);
        if (d > maxR) {
          if (d < 0.001) d = 0.001;
          ent.x = this.duel.x + (dx / d) * maxR;
          ent.y = this.duel.y + (dy / d) * maxR;
          if (ent.vx != null) { ent.vx *= 0.35; ent.vy *= 0.35; }
        }
      } else {
        const minR = this.duel.r + (rad || 16) + 8;
        if (d < 0.001) {
          const a = Math.random() * Math.PI * 2;
          ent.x = this.duel.x + Math.cos(a) * minR;
          ent.y = this.duel.y + Math.sin(a) * minR;
        } else if (d < minR) {
          ent.x = this.duel.x + (dx / d) * minR;
          ent.y = this.duel.y + (dy / d) * minR;
          if (ent.vx != null) { ent.vx *= 0.35; ent.vy *= 0.35; }
        }
      }
    }

    enforceDuelBounds() {
      if (!this.duel) return;
      for (const p of this.players.values()) {
        if (p.alive) this.constrainDuel(p, this.bodyR(p));
      }
      for (const s of this.shadows.values()) this.constrainDuel(s, s.r || CFG.SHADOW_R || 16);
      for (const m of this.monsters.values()) this.constrainDuel(m, m.r || 20);
      if (this.monarch && this.monarch.alive) this.constrainDuel(this.monarch, this.monarch.r || 80);
      if (this.brBoss && this.brBoss.alive) this.constrainDuel(this.brBoss, this.brBoss.r || 80);
      for (const b of this.minis.values()) {
        if (b.alive) this.constrainDuel(b, b.r || 40);
      }
    }

    duelBlocksProj(pr) {
      if (!this.duel || !pr) return false;
      const d = Math.hypot(pr.x - this.duel.x, pr.y - this.duel.y);
      if (this.duelSide(pr.ownerId)) return d > this.duel.r - 8;
      return d < this.duel.r + 8;
    }

    tryDodge(p) {
      if (!p || !p.alive) return;
      if ((p.dodgeCd || 0) > 0 || (p.dodgeT || 0) > 0) return;
      let dx = p.input.dx || 0;
      let dy = p.input.dy || 0;
      if (Math.hypot(dx, dy) < 0.08) {
        dx = Math.cos(p.dir || 0);
        dy = Math.sin(p.dir || 0);
      }
      const len = Math.hypot(dx, dy) || 1;
      const distDash = CFG.DODGE_DIST || 210;
      p.x += (dx / len) * distDash;
      p.y += (dy / len) * distDash;
      p.x = clamp(p.x, 30, CFG.MAP_SIZE - 30);
      p.y = clamp(p.y, 30, CFG.MAP_SIZE - 30);
      const stay = this.clampInsideZone(p.x, p.y, 70);
      p.x = stay.x;
      p.y = stay.y;
      this.resolveSolid(p, this.bodyR(p));
      this.constrainDuel(p, this.bodyR(p));
      p.dodgeT = CFG.DODGE_TIME || 0.22;
      p.dodgeCd = CFG.DODGE_CD || 4.8;
      p.vx += (dx / len) * 220;
      p.vy += (dy / len) * 220;
      this.emitFx(p.x, p.y, "dodge", "Esquive");
    }

    sprintDur() {
      return (CFG.BUFF_TIME || 16) * 0.5;
    }

    inCombat(p) {
      if (!p || !p.alive) return false;
      if ((p.combatT || 0) > 0) return true;
      if (this.duel && this.duelSide(p.id)) return true;
      const r = 260;
      for (const o of this.players.values()) {
        if (!o.alive || o.id === p.id) continue;
        if (dist(p, o) < r) return true;
      }
      for (const m of this.monsters.values()) {
        if (dist(p, m) < r + (m.r || 20)) return true;
      }
      const bosses = [this.monarch, this.brBoss].concat([...this.minis.values()]);
      for (let i = 0; i < bosses.length; i++) {
        const b = bosses[i];
        if (!b || !b.alive) continue;
        if (dist(p, b) < r + (b.r || 80)) return true;
      }
      return false;
    }

    trySprint(p) {
      if (!p || !p.alive) return;
      if (this.inCombat(p)) return;
      if ((p.sprintT || 0) > 0) return;
      if ((p.dodgeT || 0) > 0) return;
      const max = this.sprintDur();
      if (p.sprintFuel == null) p.sprintFuel = max;
      if (p.sprintFuel < 0.2) return;
      p.sprintT = 1;
      this.emitFx(p.x, p.y, "dodge", "Sprint");
      if (!p.isBot) this.log("Sprint — Shift à nouveau pour arrêter.");
    }

    stopSprint(p) {
      if (!p || (p.sprintT || 0) <= 0) return;
      p.sprintT = 0;
      if (!p.isBot) this.log("Sprint interrompu.");
    }

    swapWeapons(p) {
      if (!p || !p.wep2) return false;
      const a = p.wep || "novice";
      p.wep = p.wep2;
      p.wep2 = a;
      this.applyLoadout(p);
      const now = (wepOf(p).label || p.wep).toUpperCase();
      this.emitFx(p.x, p.y, "loot", now);
      if (!p.isBot) this.log("Arme active : " + now);
      return true;
    }

    toggleRecall(p) {
      if (p.armyStance === "guard") {
        p.armyStance = "hunt";
        this.emitFx(p.x, p.y, "hunt", "CHASSE");
      } else {
        p.armyStance = "guard";
        p.recallPull = 1.6;
        this.emitFx(p.x, p.y, "recall", "RAPPEL");
        this.log(p.name + " rappelle ses ombres — elles défendent le rayon.");
      }
    }

    shadowMergeKey(s) {
      if (s.kind === "hunter") return "hunter:" + (s.cls || s.wep || "novice");
      if (s.kind === "boss") return "boss:" + (s.sty || s.typ || "boss");
      return "beast:" + (s.typ || "wolf");
    }

    scaleMergedShadow(s) {
      const base = s.baseR || s.r || CFG.SHADOW_R || 18;
      s.baseR = base;
      const lv = Math.max(1, s.level || 1);
      s.r = Math.round(Math.min(base * (1 + (lv - 1) * 0.038), base * 2.35));
    }

    canMergeArmy(p) {
      const groups = {};
      for (const s of this.armyOf(p.id)) {
        const k = this.shadowMergeKey(s);
        groups[k] = (groups[k] || 0) + 1;
        if (groups[k] >= 2) return true;
      }
      return false;
    }

    mergeArmy(p) {
      if (!p || !p.alive) return;
      if ((p.mergeCd || 0) > 0) return;
      const army = this.armyOf(p.id);
      const groups = {};
      for (const s of army) {
        const k = this.shadowMergeKey(s);
        (groups[k] || (groups[k] = [])).push(s);
      }
      let fused = 0;
      let bestLv = 0;
      for (const k of Object.keys(groups)) {
        const list = groups[k];
        if (list.length < 2) continue;
        list.sort((a, b) => (b.level || 1) - (a.level || 1) || (b.maxHp || 0) - (a.maxHp || 0));
        const host = list[0];
        for (let i = 1; i < list.length; i++) {
          const donor = list[i];
          host.level = (host.level || 1) + (donor.level || 1);
          host.maxHp = (host.maxHp || 0) + (donor.maxHp || 0);
          host.hp = Math.min(host.maxHp, (host.hp || 0) + (donor.hp || 0));
          host.atk = (host.atk || 0) + (donor.atk || 0);
          host.armor = Math.max(host.armor || 0, donor.armor || 0);
          if (donor.elite) host.elite = 1;
          this.shadows.delete(donor.id);
        }
        this.scaleMergedShadow(host);
        fused += list.length - 1;
        if (host.level > bestLv) bestLv = host.level;
        this.emitFx(host.x, host.y, "arise", "FUSION Nv. " + host.level);
      }
      if (!fused) {
        if (!p.isBot) this.log("Fusion impossible — il faut au moins deux ombres du même type.");
        return;
      }
      p.mergeCd = CFG.MERGE_CD || 1.1;
      if (!p.isBot) this.log(p.name + " fusionne son armée — " + fused + " ombre(s) absorbée(s).");
    }

    tick() {
      const rawDt = CFG.TICK_MS / 1000;
      const dt = rawDt * (this.timeScale || 1);
      if (this.state === "waiting") {
        this.lobbyLeft -= rawDt;
        if (this.lobbyLeft <= 0) this.startMatch();
        else this.emit("lobby", this.lobbyPayload());
        return;
      }
      if (this.state === "ended") return;
      this.time += dt;
      this.updateBarrier();
      this.purgeOutside();
      this.updateBots(dt);
      this.updatePlayers(dt);
      this.updateShadows(dt);
      this.updateMonsters(dt);
      this.updateMonarch(dt);
      this.updateWorldBoss(dt, this.brBoss);
      this.updateMinis(dt);
      this.updatePortals(dt);
      this.purgeOutside();
      this.updateProjectiles(dt);
      this.pickup();
      this.combat(dt);
      this.updateDuel(dt);
      this.checkWin();
      this.emit("frame");
    }

    updateBarrier() {
      const steps = this.mode === "raid" ? CFG.ZONE.STEPS_RAID : CFG.ZONE.STEPS_BR;
      const wait0 = CFG.ZONE.WAIT;
      const move0 = CFG.ZONE.MOVE;
      const maxIdx = steps.length - 1;
      const phaseOf = (i) => {
        const slow = i >= maxIdx - 2;
        const mul = slow ? 2 : 1;
        return { wait: wait0 * mul, move: move0 * mul };
      };
      if (this.time < CFG.SHRINK_DELAY) {
        this.barrierR = steps[0];
        this.zoneState = "delay";
        this.zoneLeft = CFG.SHRINK_DELAY - this.time;
        this.zonePhase = 0;
        return;
      }
      const t = this.time - CFG.SHRINK_DELAY;
      let acc = 0;
      for (let i = 0; i < maxIdx; i++) {
        const d = phaseOf(i);
        const cycle = d.wait + d.move;
        if (t < acc + cycle) {
          const local = t - acc;
          this.zonePhase = i + 1;
          if (local < d.wait) {
            this.barrierR = steps[i];
            this.zoneState = "hold";
            this.zoneLeft = d.wait - local;
          } else {
            const u = clamp((local - d.wait) / d.move, 0, 1);
            this.barrierR = lerp(steps[i], steps[i + 1], u);
            this.zoneState = "close";
            this.zoneLeft = d.move - (local - d.wait);
          }
          return;
        }
        acc += cycle;
      }
      this.barrierR = steps[maxIdx];
      this.zoneState = this.mode === "raid" ? "frozen" : "final";
      this.zoneLeft = 0;
      this.zonePhase = maxIdx;
    }

    outsideBarrier(x, y) {
      return Math.hypot(x - this.barrierCx, y - this.barrierCy) > this.barrierR;
    }

    clampInsideZone(x, y, pad) {
      const margin = pad == null ? 96 : pad;
      const dx = x - this.barrierCx;
      const dy = y - this.barrierCy;
      const d = Math.hypot(dx, dy) || 0.001;
      const maxR = Math.max(48, this.barrierR - margin);
      if (d <= maxR) return { x: x, y: y };
      return {
        x: this.barrierCx + (dx / d) * maxR,
        y: this.barrierCy + (dy / d) * maxR,
      };
    }

    burnAt(x, y) {
      if (this.flameN >= 16) return;
      this.flameN += 1;
      this.emitFx(x, y, "flame");
    }

    purgeOutside() {
      this.flameN = 0;
      for (const [id, l] of [...this.loots]) {
        if (!this.outsideBarrier(l.x, l.y)) continue;
        this.loots.delete(id);
        this.burnAt(l.x, l.y);
      }
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const o = this.obstacles[i];
        if (!this.outsideBarrier(o.x, o.y)) continue;
        this.burnAt(o.x, o.y);
        this.obstacles.splice(i, 1);
      }
      if (this.portals && this.portals.length) {
        this.portals = this.portals.filter((g) => {
          if (g.phase === "shadow") return true;
          if (!this.outsideBarrier(g.x, g.y)) return true;
          this.burnAt(g.x, g.y);
          return false;
        });
      }
      for (const [id, m] of [...this.monsters]) {
        if (!this.outsideBarrier(m.x, m.y)) continue;
        this.monsters.delete(id);
        this.burnAt(m.x, m.y);
      }
      for (const [id, s] of [...this.shadows]) {
        if (!this.outsideBarrier(s.x, s.y)) continue;
        this.shadows.delete(id);
        this.burnAt(s.x, s.y);
      }
      for (const mini of this.minis.values()) {
        if (!mini.alive || !this.outsideBarrier(mini.x, mini.y)) continue;
        mini.alive = false;
        this.burnAt(mini.x, mini.y);
      }
    }

    updateBots(dt) {
      for (const p of this.players.values()) {
        if (!p.isBot || !p.alive) continue;
        p.bot.wander -= dt;
        p.bot.recallCd -= dt;
        if (p.bot.recallCd <= 0 && this.armyOf(p.id).length > 3) {
          p.bot.recallCd = rand(8, 16);
          if (Math.random() < 0.35) this.toggleRecall(p);
        }
        if (p.bot.mergeCd > 0) p.bot.mergeCd -= dt;
        if (p.bot.mergeCd <= 0 && this.canMergeArmy(p)) {
          p.bot.mergeCd = rand(6, 14);
          if (Math.random() < 0.55) this.mergeArmy(p);
        }
        if (p.bot.dodgeCd == null) p.bot.dodgeCd = rand(2, 6);
        p.bot.dodgeCd -= dt;
        const nearHurt = this.nearestEnemy(p, p, 70);
        if (p.bot.dodgeCd <= 0 && nearHurt) {
          p.bot.dodgeCd = rand(3, 7);
          this.tryDodge(p);
        }
        const inward = Math.hypot(p.x - this.barrierCx, p.y - this.barrierCy) > this.barrierR * 0.72;
        let tx = p.bot.tx;
        let ty = p.bot.ty;
        const readyMal = this.mode === "raid" && this.botReadyForMalakor(p);
        let fleeMal = false;
        if (this.mode === "raid" && this.monarch && this.monarch.alive && !readyMal) {
          const md = Math.hypot(p.x - this.monarch.x, p.y - this.monarch.y);
          const keep = (this.monarch.r || 196) + 560;
          if (md < keep) {
            const a = Math.atan2(p.y - this.monarch.y, p.x - this.monarch.x) || 0;
            tx = clamp(this.monarch.x + Math.cos(a) * (keep + 220), 80, CFG.MAP_SIZE - 80);
            ty = clamp(this.monarch.y + Math.sin(a) * (keep + 220), 80, CFG.MAP_SIZE - 80);
            fleeMal = true;
          }
        }
        if (fleeMal) {
          /* trop faible : rester loin */
        } else if (this.mode === "raid" && this.monarch && this.monarch.alive && !readyMal && inward) {
          const keep = (this.monarch.r || 196) + 640;
          const a = Math.atan2(p.y - this.monarch.y, p.x - this.monarch.x) || 0;
          tx = clamp(this.monarch.x + Math.cos(a) * keep, 80, CFG.MAP_SIZE - 80);
          ty = clamp(this.monarch.y + Math.sin(a) * keep, 80, CFG.MAP_SIZE - 80);
        } else if (inward) {
          tx = this.barrierCx;
          ty = this.barrierCy;
        } else {
          let best = null;
          let bestD = 480;
          for (const l of this.loots.values()) {
            const d = Math.hypot(l.x - p.x, l.y - p.y);
            if (d < bestD) { bestD = d; best = l; }
          }
          let foe = null;
          let foeD = 420;
          for (const m of this.monsters.values()) {
            const d = Math.hypot(m.x - p.x, m.y - p.y);
            if (d < foeD) { foeD = d; foe = m; }
          }
          for (const o of this.players.values()) {
            if (o === p || !o.alive) continue;
            const d = Math.hypot(o.x - p.x, o.y - p.y);
            if (d < 340 && d < foeD) { foeD = d; foe = o; }
          }
          const urgent = (best && bestD < 88) || (foe && foeD < 72);
          if (readyMal && this.monarch && this.monarch.alive && !urgent) {
            tx = this.monarch.x;
            ty = this.monarch.y;
          } else if (best && (!foe || bestD < 160)) {
            tx = best.x;
            ty = best.y;
          } else if (foe) {
            tx = foe.x;
            ty = foe.y;
          } else if (p.bot.wander <= 0) {
            p.bot.wander = rand(1.4, 3.8);
            const a = Math.random() * Math.PI * 2;
            tx = clamp(p.x + Math.cos(a) * 420, 80, CFG.MAP_SIZE - 80);
            ty = clamp(p.y + Math.sin(a) * 420, 80, CFG.MAP_SIZE - 80);
          }
        }
        p.bot.tx = tx;
        p.bot.ty = ty;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        p.input.dx = dx / len;
        p.input.dy = dy / len;
        p.aim = Math.atan2(dy, dx);
        const near = this.nearestEnemy(p, p, p.range + 24);
        p.wantAtk = near ? 1 : 0;
      }
    }

    updatePlayers(dt) {
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (p.recallPull > 0) p.recallPull -= dt;
        if (p.slowT > 0) p.slowT -= dt;
        if (p.hasteT > 0) p.hasteT -= dt;
        if (p.mightT > 0) p.mightT -= dt;
        if (p.megaT > 0) p.megaT -= dt;
        if (p.combatT > 0) p.combatT -= dt;
        if (p.sprintCd > 0) p.sprintCd -= dt;
        {
          const max = this.sprintDur();
          if (p.sprintFuel == null) p.sprintFuel = max;
          if ((p.sprintT || 0) > 0) {
            p.sprintFuel = Math.max(0, p.sprintFuel - dt);
            if (p.sprintFuel <= 0) {
              p.sprintT = 0;
              p.sprintFuel = 0;
            }
          } else {
            p.sprintFuel = Math.min(max, p.sprintFuel + dt);
          }
        }
        if (!p.isBot && p.wantAtk) {
          p.atkHoldT = (p.atkHoldT || 0) + dt;
          if (!p.swappedHold && p.atkHoldT >= 0.5) {
            if (this.swapWeapons(p)) p.swappedHold = 1;
          }
        } else if (!p.isBot) {
          p.atkHoldT = 0;
          p.swappedHold = 0;
        }
        if (p.spawnT > 0) p.spawnT -= dt;
        if (p.swing > 0) p.swing = Math.max(0, p.swing - dt * 3.15);
        if (p.chestT > 0) {
          p.chestT -= dt;
          if (p.chestT <= 0) this.finishChest(p);
        }
        if (p.gateCd > 0) p.gateCd -= dt;
        if (p.mergeCd > 0) p.mergeCd -= dt;
        if (p.dodgeCd > 0) p.dodgeCd -= dt;
        if (p.dodgeT > 0) p.dodgeT -= dt;
        if (p.fightBossT > 0) p.fightBossT -= dt;
        if ((p.fightBossT || 0) <= 0) p.fightBossId = null;
        else {
          const boss = this.bossById(p.fightBossId);
          if (!boss || !boss.alive || dist(p, boss) > 780) {
            p.fightBossId = null;
            p.fightBossT = 0;
          }
        }
        const want = Math.hypot(p.input.dx, p.input.dy) > 0.08;
        const slowMul = p.slowT > 0 ? 0.55 : 1;
        const hasteMul = (p.hasteT > 0 ? 1.48 : 1) * (p.megaT > 0 ? (CFG.MEGA_SPEED || 1.55) : 1) * (p.sprintT > 0 ? 1.58 : 1);
        const acc = 420;
        const max = p.speed * slowMul * hasteMul;
        if (want) {
          p.vx += p.input.dx * acc * dt;
          p.vy += p.input.dy * acc * dt;
          p.dir = p.aim;
        } else {
          p.vx *= Math.max(0, 1 - 7 * dt);
          p.vy *= Math.max(0, 1 - 7 * dt);
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > max) {
          p.vx = (p.vx / sp) * max;
          p.vy = (p.vy / sp) * max;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const moving = Math.hypot(p.vx, p.vy) > 12;
        p.moving = moving ? 1 : 0;
        if (moving) p.gait += (Math.hypot(p.vx, p.vy) / 28) * dt * 9;
        p.x = clamp(p.x, 30, CFG.MAP_SIZE - 30);
        p.y = clamp(p.y, 30, CFG.MAP_SIZE - 30);
        this.resolveSolid(p, this.bodyR(p));
        this.constrainDuel(p, this.bodyR(p));
        this.tryGate(p);
        if (this.outsideBarrier(p.x, p.y)) this.killHunter(p, null, "barrier");
      }
    }

    armyOf(ownerId) {
      const out = [];
      for (const s of this.shadows.values()) if (s.ownerId === ownerId) out.push(s);
      return out;
    }

    updateShadows(dt) {
      const t = this.time;
      for (const s of this.shadows.values()) {
        const owner = this.players.get(s.ownerId);
        if (!owner || !owner.alive) { this.shadows.delete(s.id); continue; }
        const rad = s.r || CFG.SHADOW_R || 12;
        if (this.duel && this.duelSide(owner.id)) {
          this.constrainDuel(s, rad);
          s.guard = 1;
          s.gait = (s.gait || 0) + 4 * dt;
          continue;
        }
        const army = this.armyOf(s.ownerId);
        const i = army.indexOf(s);
        const n = Math.max(1, army.length);
        const ang = (i / n) * Math.PI * 2 + t * 0.55;
        const guard = owner.armyStance === "guard";
        const leash = CFG.GUARD_RADIUS || 160;
        const orbit = rad + (guard ? 36 : 52) + (i % 3) * 14;
        let tx = owner.x + Math.cos(ang) * orbit;
        let ty = owner.y + Math.sin(ang) * orbit;
        let chasing = false;
        const target = this.nearestEnemy(s, owner, guard ? leash : (CFG.SHADOW_AGGRO || 340), guard ? leash : null);
        const ranged = this.shadowIsRanged(s);
        if (target) {
          chasing = true;
          if (ranged && !guard) {
            const hold = this.shadowHoldRange(s);
            const dT = dist(s, target) || 1;
            const away = Math.atan2(s.y - target.y, s.x - target.x);
            const minR = hold * 0.62;
            const maxR = hold * 1.38;
            if (dT < minR || dT > maxR) {
              tx = target.x + Math.cos(away) * hold;
              ty = target.y + Math.sin(away) * hold;
            } else {
              tx = s.x;
              ty = s.y;
            }
          } else {
            tx = target.x;
            ty = target.y;
          }
        }
        const dx = tx - s.x;
        const dy = ty - s.y;
        const len = Math.hypot(dx, dy);
        const backing = ranged && target && dist(s, target) < this.shadowHoldRange(s) * 0.62;
        const base = chasing ? (ranged ? (backing ? 130 : 95) : 150) : guard || owner.recallPull > 0 ? 240 : 165;
        if (len > 1) {
          const spd = base * dt;
          s.x += (dx / len) * Math.min(spd, len);
          s.y += (dy / len) * Math.min(spd, len);
        }
        if (guard) {
          const dO = dist(s, owner);
          if (dO > leash) {
            const k = (leash - 6) / dO;
            s.x = owner.x + (s.x - owner.x) * k;
            s.y = owner.y + (s.y - owner.y) * k;
          }
        }
        this.resolveSolid(s, rad);
        s.gait = (s.gait || 0) + (chasing || guard ? 8 : 6) * dt;
        if (!this.hasThrow(s.id)) {
          if (chasing && target) s.dir = Math.atan2(target.y - s.y, target.x - s.x);
          else if (chasing) s.dir = Math.atan2(dy, dx);
          else s.dir = owner.dir;
        }
        s.guard = guard ? 1 : 0;
      }
    }

    botReadyForMalakor(p) {
      if (!p || !p.bot || !this.monarch || !this.monarch.alive) return false;
      if ((p.hp / (p.maxHp || 1)) < 0.4) return false;
      if (p.bot.needLv == null) {
        let h = 2166136261;
        const sid = String(p.id);
        for (let i = 0; i < sid.length; i++) h = Math.imul(h ^ sid.charCodeAt(i), 16777619);
        p.bot.needLv = 6 + ((h >>> 0) % 4);
      }
      const army = this.armyOf(p.id).length;
      const power = (p.level || 1) + Math.min(6, Math.floor(army / 2)) + ((p.megaT || 0) > 0 ? 3 : 0);
      return power >= p.bot.needLv;
    }

    nearestEnemy(unit, owner, range, leashR) {
      let best = null;
      let bestD = range;
      const inLeash = (e) => leashR == null || dist(owner, e) <= leashR;
      const ok = (e) => this.duelAllowsHit(owner, e);
      for (const m of this.monsters.values()) {
        if (!inLeash(m) || !ok(m)) continue;
        const d = dist(unit, m);
        if (d < bestD) { bestD = d; best = m; }
      }
      for (const o of this.players.values()) {
        if (!o.alive || o.id === owner.id) continue;
        if (!inLeash(o) || !ok(o)) continue;
        const d = dist(unit, o);
        if (d < bestD) { bestD = d; best = o; }
      }
      for (const sh of this.shadows.values()) {
        if (sh.ownerId === owner.id || sh.id === unit.id) continue;
        if (!inLeash(sh) || !ok(sh)) continue;
        const d = dist(unit, sh);
        if (d < bestD) { bestD = d; best = sh; }
      }
      if (this.monarch && this.monarch.alive && inLeash(this.monarch) && ok(this.monarch)) {
        const d = dist(unit, this.monarch);
        if (d < bestD) { bestD = d; best = this.monarch; }
      }
      if (this.brBoss && this.brBoss.alive && inLeash(this.brBoss) && ok(this.brBoss)) {
        const d = dist(unit, this.brBoss);
        if (d < bestD) { bestD = d; best = this.brBoss; }
      }
      for (const mini of this.minis.values()) {
        if (!mini.alive || !inLeash(mini) || !ok(mini)) continue;
        const d = dist(unit, mini);
        if (d < bestD) { bestD = d; best = mini; }
      }
      return best;
    }

    updateMonsters(dt) {
      for (const m of this.monsters.values()) {
        m.wander -= dt;
        m.lastAtk -= dt;
        let prey = null;
        let preyD = m.aggro;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (this.duel && this.duelSide(p.id)) continue;
          const d = dist(m, p);
          if (d < preyD) { preyD = d; prey = p; }
        }
        if (m.chargeT > 0) {
          m.chargeT -= dt;
          m.x += m.cvx * dt;
          m.y += m.cvy * dt;
          m.gait += 14 * dt;
        } else {
          this.steerMonster(m, prey, preyD, dt);
        }
        m.x = clamp(m.x, 40, CFG.MAP_SIZE - 40);
        m.y = clamp(m.y, 40, CFG.MAP_SIZE - 40);
        this.resolveSolid(m, m.r * 0.7);
      }
    }

    steerMonster(m, prey, preyD, dt) {
      let tx = m.tx;
      let ty = m.ty;
      const t = this.time;
      if (m.behavior === "kite" && prey) {
        const ideal = 210;
        const ang = Math.atan2(m.y - prey.y, m.x - prey.x);
        if (preyD < 150) {
          tx = m.x + Math.cos(ang) * 120;
          ty = m.y + Math.sin(ang) * 120;
        } else if (preyD > 250) {
          tx = prey.x;
          ty = prey.y;
        } else {
          tx = prey.x + Math.cos(ang + t) * ideal;
          ty = prey.y + Math.sin(ang + t) * ideal;
          if (m.lastAtk <= 0) {
            const a = Math.atan2(prey.y - m.y, prey.x - m.x);
            this.projectiles.push({
              x: m.x, y: m.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
              dmg: m.atk, ownerId: null, hostile: 1, k: "spit", life: 0.9,
            });
            m.lastAtk = 1.35;
          }
        }
      } else if (m.behavior === "skirmish" && prey) {
        if (preyD < 88) {
          const a = t * 2.2 + m.x * 0.01;
          tx = prey.x + Math.cos(a) * 110;
          ty = prey.y + Math.sin(a) * 110;
        } else { tx = prey.x; ty = prey.y; }
      } else if (m.behavior === "charge" && prey) {
        if (preyD < 300 && preyD > 70) {
          m.wind += dt;
          if (m.wind > 0.6) {
            const a = Math.atan2(prey.y - m.y, prey.x - m.x);
            m.chargeT = 0.42;
            m.cvx = Math.cos(a) * 340;
            m.cvy = Math.sin(a) * 340;
            m.wind = 0;
          }
          tx = m.x;
          ty = m.y;
        } else {
          m.wind = 0;
          tx = prey.x;
          ty = prey.y;
        }
      } else if (prey) {
        tx = prey.x;
        ty = prey.y;
      } else if (m.wander <= 0) {
        m.wander = rand(2.2, 5.5);
        tx = clamp(m.x + rand(-240, 240), 80, CFG.MAP_SIZE - 80);
        ty = clamp(m.y + rand(-240, 240), 80, CFG.MAP_SIZE - 80);
      }
      m.tx = tx;
      m.ty = ty;
      const dx = tx - m.x;
      const dy = ty - m.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = m.speed * dt;
      if (len > 2) {
        m.x += (dx / len) * Math.min(spd, len);
        m.y += (dy / len) * Math.min(spd, len);
        m.gait += (m.speed / 22) * dt * 8;
      }
    }

    updateMonarch(dt) {
      this.updateWorldBoss(dt, this.monarch);
    }

    updateMinis(dt) {
      for (const b of this.minis.values()) {
        if (!b.alive) continue;
        b.wander = (b.wander || 0) - dt;
        let tx = b.tx != null ? b.tx : b.x;
        let ty = b.ty != null ? b.ty : b.y;
        let prey = null;
        let best = 780;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const d = dist(b, p);
          if (d < best) { best = d; prey = p; }
        }
        if (prey) { tx = prey.x; ty = prey.y; }
        else if (b.wander <= 0) {
          b.wander = rand(1.6, 4.2);
          tx = clamp(b.x + rand(-420, 420), 180, CFG.MAP_SIZE - 180);
          ty = clamp(b.y + rand(-420, 420), 180, CFG.MAP_SIZE - 180);
        }
        b.tx = tx;
        b.ty = ty;
        const dx = tx - b.x;
        const dy = ty - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 62 * dt;
        if (len > 8) {
          b.x += (dx / len) * Math.min(spd, len);
          b.y += (dy / len) * Math.min(spd, len);
        }
        this.resolveSolid(b, b.r * 0.45);
        this.updateWorldBoss(dt, b);
      }
    }

    updateWorldBoss(dt, b) {
      if (!b || !b.alive) return;
      b.lastAtk -= dt;
      if (b.lastAtk > 0) return;
      let hit = false;
      const extra = b.kind === "mini" ? 36 : 70;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (dist(b, p) < b.r + this.bodyR(p) + extra) { this.hurtHunter(p, b.atk, null); hit = true; }
      }
      for (const s of [...this.shadows.values()]) {
        if (dist(b, s) < b.r + 42) {
          this.hurtShadow(s, b.atk * 0.7, null);
          hit = true;
        }
      }
      if (hit) b.lastAtk = b.kind === "mini" ? 1.15 : 1.35;
    }

    updateProjectiles(dt) {
      const next = [];
      for (const pr of this.projectiles) {
        if (pr.k === "throw") {
          this.updateThrow(pr, dt, next);
          continue;
        }
        pr.life -= dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.life <= 0 || this.outsideBarrier(pr.x, pr.y) || this.duelBlocksProj(pr)) continue;
        let hit = false;
        const owner = pr.ownerId ? this.players.get(pr.ownerId) : null;
        if (pr.hostile) {
          for (const o of this.players.values()) {
            if (!o.alive) continue;
            if (this.duel && this.duelSide(o.id)) continue;
            if (Math.hypot(o.x - pr.x, o.y - pr.y) < this.bodyR(o) + 8) {
              this.hurtHunter(o, pr.dmg, null);
              hit = true;
              break;
            }
          }
        } else {
          hit = this.projHitOnce(pr, owner);
        }
        if (hit) {
          const wepHint = pr.w || (pr.k === "pulse" ? "laser" : pr.k === "rocket" ? "bazooka" : pr.k === "arrow" ? "bow" : "");
          if (pr.k === "pulse") this.emitFx(pr.x, pr.y, "orbhit", wepHint);
          else this.emitFx(pr.x, pr.y, "slash", wepHint);
          if (owner && owner.id) this.emit("impact", { x: pr.x, y: pr.y, id: owner.id, crit: 0 });
        } else next.push(pr);
      }
      this.projectiles = next;
    }

    projHitOnce(pr, owner) {
      const pad = pr.k === "pulse" ? 14 : 10;
      for (const m of this.monsters.values()) {
        if (Math.hypot(m.x - pr.x, m.y - pr.y) < m.r + pad) {
          this.hurtMonster(m, pr.dmg, owner);
          this.applySplash(pr, m, owner);
          return true;
        }
      }
      for (const o of this.players.values()) {
        if (!o.alive || o.id === pr.ownerId) continue;
        if (Math.hypot(o.x - pr.x, o.y - pr.y) < this.bodyR(o) + 8) {
          this.hurtHunter(o, pr.dmg, owner);
          if (pr.slow) o.slowT = Math.max(o.slowT, 1.6);
          this.applySplash(pr, o, owner);
          return true;
        }
      }
      if (this.monarch && this.monarch.alive && Math.hypot(this.monarch.x - pr.x, this.monarch.y - pr.y) < this.monarch.r) {
        this.hurtMonarch(pr.dmg, owner);
        return true;
      }
      if (this.brBoss && this.brBoss.alive && Math.hypot(this.brBoss.x - pr.x, this.brBoss.y - pr.y) < this.brBoss.r) {
        this.hurtBrBoss(pr.dmg, owner);
        return true;
      }
      for (const mini of this.minis.values()) {
        if (!mini.alive) continue;
        if (Math.hypot(mini.x - pr.x, mini.y - pr.y) < mini.r) {
          this.hurtMini(mini, pr.dmg, owner);
          return true;
        }
      }
      for (const sh of this.shadows.values()) {
        if (owner && sh.ownerId === owner.id) continue;
        if (Math.hypot(sh.x - pr.x, sh.y - pr.y) < 14) {
          this.hurtShadow(sh, pr.dmg, owner);
          return true;
        }
      }
      return false;
    }

    throwStrike(pr, owner) {
      pr.hitSet = pr.hitSet || {};
      const mark = (id) => {
        if (pr.hitSet[id]) return false;
        if (Object.keys(pr.hitSet).length >= 3) return false;
        pr.hitSet[id] = 1;
        return true;
      };
      const sparkHit = () => {
        this.emitFx(pr.x, pr.y, "slash", pr.w || "novice");
        if (owner && owner.id) this.emit("impact", { x: pr.x, y: pr.y, id: owner.id, crit: 0 });
      };
      const dmgOf = () => {
        const n = Object.keys(pr.hitSet).length;
        return n <= 1 ? pr.dmg : pr.dmg * 0.55;
      };
      let hit = false;
      for (const m of this.monsters.values()) {
        if (Math.hypot(m.x - pr.x, m.y - pr.y) < m.r + 16) {
          if (mark("m:" + m.id)) {
            this.hurtMonster(m, dmgOf(), owner);
            sparkHit();
            hit = true;
          }
        }
      }
      for (const o of this.players.values()) {
        if (!o.alive || o.id === pr.ownerId) continue;
        if (Math.hypot(o.x - pr.x, o.y - pr.y) < this.bodyR(o) + 12) {
          if (mark("p:" + o.id)) {
            this.hurtHunter(o, dmgOf(), owner);
            sparkHit();
            hit = true;
          }
        }
      }
      if (this.monarch && this.monarch.alive && Math.hypot(this.monarch.x - pr.x, this.monarch.y - pr.y) < this.monarch.r + 6) {
        if (mark("monarch")) {
          this.hurtMonarch(dmgOf(), owner);
          sparkHit();
          hit = true;
        }
      }
      if (this.brBoss && this.brBoss.alive && Math.hypot(this.brBoss.x - pr.x, this.brBoss.y - pr.y) < this.brBoss.r + 6) {
        if (mark("br-boss")) {
          this.hurtBrBoss(dmgOf(), owner);
          sparkHit();
          hit = true;
        }
      }
      for (const mini of this.minis.values()) {
        if (!mini.alive) continue;
        if (Math.hypot(mini.x - pr.x, mini.y - pr.y) < mini.r + 6) {
          if (mark("mini:" + mini.id)) {
            this.hurtMini(mini, dmgOf(), owner);
            sparkHit();
            hit = true;
          }
        }
      }
      for (const sh of this.shadows.values()) {
        if (owner && sh.ownerId === owner.id) continue;
        if (Math.hypot(sh.x - pr.x, sh.y - pr.y) < 15) {
          if (mark("s:" + sh.id)) {
            this.hurtShadow(sh, dmgOf(), owner);
            sparkHit();
            hit = true;
          }
        }
      }
      return hit;
    }

    facingOf(p) {
      if (!p) return 0;
      if (Number.isFinite(p.aim)) return p.aim;
      if (Number.isFinite(p.dir)) return p.dir;
      return 0;
    }

    shadowIsRanged(s) {
      if (!s) return false;
      if (s.behavior === "kite") return true;
      if (s.proj) return true;
      if (s.kind === "hunter") {
        const w = wepOf(s);
        if (w && w.proj) return true;
        if (s.cls === "mage") return true;
      }
      return false;
    }

    shadowHoldRange(s) {
      if (!s) return 180;
      if (s.behavior === "kite" && s.kind !== "hunter") return 205;
      const w = wepOf(s);
      if (w && w.proj) return Math.max(150, Math.min(230, (s.range || w.range || 220) * 0.7));
      if (s.cls === "mage") return 155;
      return 180;
    }

    throwHome(pr) {
      if (pr.fromShadow) {
        if (pr.homeId && this.shadows.has(pr.homeId)) return this.shadows.get(pr.homeId);
        return null;
      }
      if (pr.homeId && this.shadows.has(pr.homeId)) return this.shadows.get(pr.homeId);
      if (pr.homeId && this.players.has(pr.homeId)) {
        const p = this.players.get(pr.homeId);
        if (p && p.alive) return p;
      }
      const owner = pr.ownerId ? this.players.get(pr.ownerId) : null;
      if (owner && owner.alive) return owner;
      return null;
    }

    updateThrow(pr, dt, next) {
      pr.spin = (pr.spin || 0) + dt * 16;
      const owner = pr.ownerId ? this.players.get(pr.ownerId) : null;
      const spd = pr.spd || 380;
      const ang = Number.isFinite(pr.ang) ? pr.ang : Math.atan2(pr.vy || 0, pr.vx || 1);
      if (!pr.back) {
        pr.x += Math.cos(ang) * spd * dt;
        pr.y += Math.sin(ang) * spd * dt;
        pr.flown = (pr.flown || 0) + spd * dt;
        this.throwStrike(pr, owner);
        if (pr.flown >= (pr.reach || 200) || this.outsideBarrier(pr.x, pr.y) || this.duelBlocksProj(pr)) {
          pr.back = 1;
          pr.flownBack = 0;
        }
      } else if (pr.fromShadow) {
        const hx = pr.homeX;
        const hy = pr.homeY;
        const dx = hx - pr.x;
        const dy = hy - pr.y;
        const d = Math.hypot(dx, dy) || 1;
        const ret = spd * 1.15;
        pr.x += (dx / d) * ret * dt;
        pr.y += (dy / d) * ret * dt;
        pr.flownBack = (pr.flownBack || 0) + ret * dt;
        this.throwStrike(pr, owner);
        if (d < 22) return;
        if (pr.flownBack >= (pr.flown || pr.reach || 200) + 80) return;
      } else {
        pr.x -= Math.cos(ang) * spd * 1.15 * dt;
        pr.y -= Math.sin(ang) * spd * 1.15 * dt;
        pr.flownBack = (pr.flownBack || 0) + spd * 1.15 * dt;
        this.throwStrike(pr, owner);
        const home = this.throwHome(pr);
        if (home) {
          const catchR = (home.r != null ? home.r : this.bodyR(home)) + 14;
          if (Math.hypot(home.x - pr.x, home.y - pr.y) < catchR) return;
        }
        if (pr.flownBack >= (pr.flown || pr.reach || 200) + 40) return;
      }
      next.push(pr);
    }

    hasThrow(id) {
      if (!id) return false;
      for (let i = 0; i < this.projectiles.length; i++) {
        const pr = this.projectiles[i];
        if (pr.k !== "throw") continue;
        const hid = pr.homeId || pr.ownerId;
        if (hid === id) return true;
      }
      return false;
    }

    applySplash(pr, center, owner) {
      if (!pr.splash) return;
      for (const m of this.monsters.values()) {
        if (m === center) continue;
        if (dist(m, center) < pr.splash) this.hurtMonster(m, pr.dmg * 0.55, owner);
      }
      for (const o of this.players.values()) {
        if (!o.alive || o === center || (owner && o.id === owner.id)) continue;
        if (dist(o, center) < pr.splash) {
          this.hurtHunter(o, pr.dmg * 0.45, owner);
          o.slowT = Math.max(o.slowT, 1.1);
        }
      }
    }

    pickup() {
      for (const p of this.players.values()) {
        if (!p.alive || p.chestT > 0) continue;
        for (const [id, l] of this.loots) {
          if (Math.hypot(l.x - p.x, l.y - p.y) > (l.kind === "chest" ? 57 : l.kind === "mega" ? 52 : 48)) continue;
          this.loots.delete(id);
          if (l.kind === "weapon") this.equipWeapon(p, l.cls);
          else if (l.kind === "class") this.equipClass(p, l.cls);
          else if (l.kind === "chest") this.openChest(p);
          else if (l.kind === "tile") this.useTile(p, l.cls);
          else if (l.kind === "mega") this.useMega(p);
          else this.absorbOrb(p, l.cls, l.sz || 1);
        }
      }
    }

    openChest(p) {
      p.chestT = 1.35;
      this.emitFx(p.x, p.y, "chest", "roulette");
    }

    finishChest(p) {
      const wep = rollChestWeapon();
      const label = (wepOf({ wep: wep }).label || wep).toUpperCase();
      const first = !p.chests;
      p.chests = (p.chests || 0) + 1;
      if (first || p.isBot) {
        p.wep = wep;
        this.applyLoadout(p);
        this.emitFx(p.x, p.y, "chest", wep);
        if (!p.isBot) this.log(p.name + " équipe " + label + ".");
        return;
      }
      p.wep2 = wep;
      this.emitFx(p.x, p.y, "chest", wep);
      if (!p.isBot) {
        this.log(p.name + " range en réserve : " + label + " — maintiens Attaque pour équiper.");
      }
    }

    applyLoadout(p) {
      const kitSt = CFG.CLASS[p.cls] || CFG.CLASS.novice;
      const st = wepOf(p);
      const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
      p.maxHp = (kitSt.hp || 480) + (p.level - 1) * 10 + p.orbBars * 16;
      p.hp = Math.max(1, p.maxHp * ratio);
      p.atk = (st.atk || 9) + (p.level - 1) * 1.4;
      p.speed = kitSt.speed || 112;
      p.range = (st.range || 88) + (kitSt.rangeBonus || 0);
      p.cd = st.cd || 0.58;
      p.armor = kitSt.armor || 0;
      p.barW = (kitSt.bar || 40) + p.orbBars * 7;
    }

    equipWeapon(p, id) {
      if (!CFG.WEAPONS[id]) return;
      p.wep = id;
      this.applyLoadout(p);
      this.emitFx(p.x, p.y, "loot", (CFG.WEAPONS[id] && CFG.WEAPONS[id].label) || id);
    }

    equipClass(p, id) {
      if (!CFG.CLASS[id] || id === "novice") return;
      p.cls = id;
      if (!p.foundClasses) p.foundClasses = [];
      if (p.foundClasses.indexOf(id) < 0) p.foundClasses.push(id);
      this.applyLoadout(p);
      this.emitFx(p.x, p.y, "loot", (CFG.CLASS[id] && CFG.CLASS[id].label) || id);
    }

    absorbOrb(p, cls, sz) {
      const n = sz || 1;
      if (cls === "force") {
        p.atk += 1.6 * n;
        p.orbForce = (p.orbForce || 0) + n;
      }
      if (cls === "vital") {
        p.orbBars += n;
        p.orbVital = (p.orbVital || 0) + n;
        p.maxHp += 12 * n;
        p.hp = Math.min(p.maxHp, p.hp + 18 * n);
        p.barW = ((CFG.CLASS[p.cls] || CFG.CLASS.novice).bar || 40) + p.orbBars * 7;
      }
      if (cls === "haste") {
        p.orbHaste = (p.orbHaste || 0) + n;
        const cap = (CFG.CLASS[p.cls] || CFG.CLASS.novice).speed + 22;
        p.speed = Math.min(p.speed + 4 * n, cap);
      }
      if (cls === "shadow") {
        p.orbShadow = (p.orbShadow || 0) + n;
        for (const s of this.armyOf(p.id)) s.atk += 1.1 * n;
      }
      this.emitFx(p.x, p.y, "orb", cls);
    }

    countMegaCubes() {
      let n = 0;
      for (const l of this.loots.values()) {
        if (l.kind === "mega") n++;
      }
      return n;
    }

    spawnMegaCube() {
      const want = CFG.MEGA_CUBE_COUNT || 10;
      if (this.countMegaCubes() >= want) return;
      for (let t = 0; t < 90; t++) {
        const x = rand(320, CFG.MAP_SIZE - 320);
        const y = rand(320, CFG.MAP_SIZE - 320);
        if (Math.hypot(x - CFG.MAP_SIZE / 2, y - CFG.MAP_SIZE / 2) < 360) continue;
        let near = false;
        for (const l of this.loots.values()) {
          if (l.kind === "mega" && Math.hypot(l.x - x, l.y - y) < 1100) { near = true; break; }
        }
        if (near) continue;
        if (this.outsideBarrier(x, y)) continue;
        if (this.blockedBySolid(x, y, 36)) continue;
        const id = uid();
        this.loots.set(id, { id, kind: "mega", cls: "mega", x, y });
        return;
      }
      const fallback = this.clearLootPos(
        this.clampInsideZone(rand(400, CFG.MAP_SIZE - 400), rand(400, CFG.MAP_SIZE - 400), 80).x,
        this.clampInsideZone(rand(400, CFG.MAP_SIZE - 400), rand(400, CFG.MAP_SIZE - 400), 80).y,
        36
      );
      const id = uid();
      this.loots.set(id, { id, kind: "mega", cls: "mega", x: fallback.x, y: fallback.y });
    }

    ensureMegaCubes() {
      const want = CFG.MEGA_CUBE_COUNT || 10;
      while (this.countMegaCubes() < want) this.spawnMegaCube();
    }

    useMega(p) {
      p.megaT = CFG.MEGA_CUBE_TIME || 32;
      const heal = (p.maxHp || 0) * (CFG.MEGA_HEAL || 0.28);
      p.hp = Math.min(p.maxHp, (p.hp || 0) + heal);
      this.emitFx(p.x, p.y, "mega", "ÉVEIL");
      if (!p.isBot) this.log(p.name + " s'empare d'un cube d'Éveil.");
    }

    useTile(p, cls) {
      if (cls === "speed") {
        p.hasteT = CFG.BUFF_TIME || 16;
        p.tileSpeed = (p.tileSpeed || 0) + 1;
        this.emitFx(p.x, p.y, "tile", "VITESSE");
      } else if (cls === "heal") {
        p.hp = p.maxHp;
        p.tileHeal = (p.tileHeal || 0) + 1;
        for (const s of this.armyOf(p.id)) s.hp = s.maxHp;
        this.emitFx(p.x, p.y, "tile", "SOIN TOTAL");
      } else if (cls === "might") {
        p.mightT = CFG.BUFF_TIME || 16;
        p.tileMight = (p.tileMight || 0) + 1;
        this.emitFx(p.x, p.y, "tile", "FORCE");
      }
    }

    tryGate(p) {
      if (this.duel && this.duelSide(p.id)) return;
      if (p.gateCd > 0) return;
      const gates = this.portals && this.portals.length ? this.portals : (CFG.GATES || []);
      let inside = null;
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i];
        if (g.phase === "shadow") continue;
        if (Math.hypot(p.x - g.x, p.y - g.y) < 54) { inside = g; break; }
      }
      if (!inside) { p.gateT = 0; return; }
      p.gateT += (CFG.TICK_MS / 1000) * (this.timeScale || 1);
      if (p.gateT < 1.05) return;
      p.gateT = 0;
      p.gateCd = 6;
      const dest = this.portalDestination(inside);
      const safe = this.clampInsideZone(dest.x, dest.y, 110);
      p.x = safe.x;
      p.y = safe.y;
      p.vx = 0;
      p.vy = 0;
      this.resolveSolid(p, this.bodyR(p));
      const stay = this.clampInsideZone(p.x, p.y, 80);
      p.x = stay.x;
      p.y = stay.y;
      for (const s of this.armyOf(p.id)) {
        const spot = this.clampInsideZone(p.x + rand(-36, 36), p.y + rand(-36, 36), 80);
        s.x = spot.x;
        s.y = spot.y;
      }
      this.emitFx(p.x, p.y, "gate", dest.name);
      if (!p.isBot) this.log(p.name + " traverse une faille → " + dest.name);
    }

    emitFx(x, y, kind, extra) {
      this.emit("fx", { x, y, kind, extra, t: this.time });
    }

    combat(dt) {
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        p.lastAtk -= dt;
        const fire = p.isBot ? p.wantAtk : p.atkTap;
        if (p.atkTap) p.atkTap = 0;
        if (!fire || p.lastAtk > 0) continue;
        const tgt = this.nearestEnemy(p, p, p.range + 12);
        p.lastAtk = p.cd;
        if (tgt) {
          p.aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          p.dir = p.aim;
        } else {
          p.aim = (p.dir != null ? p.dir : p.aim) || 0;
        }
        this.classAttack(p, tgt);
        p.combatT = Math.max(p.combatT || 0, 1.35);
      }
      for (const s of this.shadows.values()) {
        const owner = this.players.get(s.ownerId);
        if (!owner) continue;
        if (this.duel && this.duelSide(owner.id)) continue;
        s.lastAtk -= dt;
        if (s.lastAtk > 0) continue;
        let reach = s.range || CFG.SHADOW_RANGE || 118;
        if (this.shadowIsRanged(s)) reach = Math.max(reach, this.shadowHoldRange(s) + 48);
        const leash = owner.armyStance === "guard" ? (CFG.GUARD_RADIUS || 160) : null;
        const tgt = this.nearestEnemy(s, owner, reach, leash);
        if (!tgt) continue;
        s.lastAtk = s.cd || 0.48;
        this.shadowAttack(s, tgt, owner);
      }
      for (const m of this.monsters.values()) {
        if (m.lastAtk > 0 && m.behavior !== "kite") continue;
        if (m.behavior === "kite") continue;
        let struck = false;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const reach = m.behavior === "brute" ? 22 : 8;
          if (dist(m, p) < m.r + this.bodyR(p) + reach) {
            m.lastAtk = m.behavior === "brute" ? 1.15 : m.behavior === "charge" ? 0.95 : 1.0;
            let dmg = m.atk;
            if (m.chargeT > 0) dmg *= 1.7;
            this.hurtHunter(p, dmg, null);
            if (m.behavior === "brute") {
              const a = Math.atan2(p.y - m.y, p.x - m.x);
              p.vx += Math.cos(a) * 90;
              p.vy += Math.sin(a) * 90;
            }
            struck = true;
            break;
          }
        }
        if (struck) continue;
        for (const s of this.shadows.values()) {
          if (dist(m, s) < m.r + 16) {
            m.lastAtk = 1.0;
            this.hurtShadow(s, m.atk, null);
            break;
          }
        }
      }
    }

    classAttack(p, tgt, credit) {
      const st = wepOf(p);
      const src = credit || p;
      const megaMul = (src.megaT && src.megaT > 0) ? (CFG.MEGA_DMG || 1.75) : 1;
      if (p.swing !== undefined) p.swing = 1;
      if (p.cls === "mage") {
        const throwList = CFG.MAGE_THROW || ["novice", "spear", "saber", "katana", "scythe", "daggers", "mace", "hammer"];
        const canThrow = throwList.indexOf(st.id || p.wep || "novice") >= 0;
        if (canThrow) {
          const fromShadow = !!p.throwerId;
          const homeId = fromShadow ? p.throwerId : src.id;
          if (this.hasThrow(homeId)) {
            if (p.lastAtk !== undefined) p.lastAtk = 0.08;
            return;
          }
          const a = tgt
            ? Math.atan2(tgt.y - p.y, tgt.x - p.x)
            : this.facingOf(p);
          p.aim = a;
          p.dir = a;
          const powered = !!(src.mightT && src.mightT > 0);
          const dmg = p.atk * (powered ? 1.35 : 1) * megaMul;
          const spd = powered ? 520 : 440;
          let reach = powered ? 260 : 210;
          if (fromShadow && tgt) {
            const toTgt = Math.hypot(tgt.x - p.x, tgt.y - p.y);
            reach = Math.min(reach, Math.max(70, toTgt + 24));
          }
          const ox = p.x + Math.cos(a) * 36;
          const oy = p.y + Math.sin(a) * 36;
          this.emitFx(p.x, p.y, "swing", String(a) + "|" + (st.swing || "punch") + "|" + (st.id || "novice"));
          this.emitFx(ox, oy, "slash", (st.id || "novice"));
          this.emit("impact", { x: ox, y: oy, id: src.id, crit: 0 });
          if (p.lastAtk !== undefined) p.lastAtk = Math.max(0.32, p.cd || 0.4);
          this.projectiles.push({
            x: ox,
            y: oy,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            ang: a,
            dmg: dmg, ownerId: src.id,
            homeId: homeId,
            homeX: p.x,
            homeY: p.y,
            fromShadow: fromShadow ? 1 : 0,
            spd: spd,
            reach: reach,
            splash: 0,
            k: "throw",
            w: st.id || p.wep || "novice",
            sk: shotOf(src),
            spin: 0,
            back: 0,
            flown: 0,
            flownBack: 0,
            hitSet: {},
          });
          return;
        }
      }
      if (st.proj === "beam" || st.proj === "pulse") {
        const a = p.aim || 0;
        const spd = st.projSpeed || 1100;
        const reach = p.range || st.range || 420;
        const ox = p.x + Math.cos(a) * 30;
        const oy = p.y + Math.sin(a) * 30;
        this.emitFx(ox, oy, "flash", "pulse|" + (st.id || "laser"));
        this.projectiles.push({
          x: ox, y: oy,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          dmg: p.atk * megaMul, ownerId: src.id,
          life: Math.max(0.18, reach / spd),
          splash: 0, k: "pulse", sk: shotOf(src),
        });
        return;
      }
      if (st.proj) {
        const kind = st.proj;
        const a = p.aim || 0;
        const spd = st.projSpeed || (kind === "bolt" ? 480 : 430);
        const life = st.proj === "rocket" ? 1.1 : Math.max(0.45, (p.range || st.range || 210) / spd);
        this.emitFx(p.x, p.y, "shot", st.id || kind);
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          dmg: p.atk * megaMul, ownerId: src.id, life: life,
          splash: st.splash || 0, slow: st.slow ? 1 : 0, k: kind, sk: shotOf(src),
        });
        return;
      }
      this.emitFx(p.x, p.y, "swing", String(p.aim || 0) + "|" + (st.swing || "punch") + "|" + (st.id || "novice"));
      let dmg = p.atk * ((src.mightT && src.mightT > 0) ? 1.42 : 1) * megaMul;
      if (tgt && st.crit && Math.random() < st.crit) {
        dmg *= st.critMul || 2;
        this.emitFx(tgt.x, tgt.y, "crit", "CRITIQUE");
      }
      if (st.lunge) {
        const a = p.aim || 0;
        p.x += Math.cos(a) * st.lunge;
        p.y += Math.sin(a) * st.lunge;
        p.x = clamp(p.x, 30, CFG.MAP_SIZE - 30);
        p.y = clamp(p.y, 30, CFG.MAP_SIZE - 30);
      }
      if (tgt) {
        this.strike(p, tgt, dmg, src);
        this.emitFx(tgt.x, tgt.y, "slash", st.id || "novice");
        this.emit("impact", { x: tgt.x, y: tgt.y, id: src.id, crit: dmg > p.atk * 1.5 ? 1 : 0 });
      } else {
        const a = p.aim || 0;
        this.emitFx(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, "slash", st.id || "novice");
      }
      if (st.aoe) {
        for (const m of this.monsters.values()) {
          if (m === tgt) continue;
          if (dist(p, m) < st.aoe) this.hurtMonster(m, p.atk * 0.7, src);
        }
        for (const o of this.players.values()) {
          if (!o.alive || o.id === p.id) continue;
          if (dist(p, o) < st.aoe) {
            this.hurtHunter(o, p.atk * 0.55, src);
            const a = Math.atan2(o.y - p.y, o.x - p.x);
            o.vx += Math.cos(a) * (st.knock || 40);
            o.vy += Math.sin(a) * (st.knock || 40);
          }
        }
        this.emitFx(p.x, p.y, "slam", st.id || "mace");
      }
    }

    laserBeam(p, src, st) {
      const a = p.aim || 0;
      const spd = st.projSpeed || 1100;
      const reach = st.range || 400;
      const ox = p.x + Math.cos(a) * 30;
      const oy = p.y + Math.sin(a) * 30;
      this.emitFx(ox, oy, "flash", "pulse|" + (st.id || "laser"));
      this.projectiles.push({
        x: ox, y: oy,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        dmg: p.atk, ownerId: src.id,
        life: Math.max(0.18, reach / spd),
        splash: 0, k: "pulse", sk: shotOf(src),
      });
    }

    shadowAttack(s, tgt, owner) {
      const aim = Math.atan2(tgt.y - s.y, tgt.x - s.x);
      s.dir = aim;
      s.aim = aim;
      if (s.kind === "hunter" && s.cls) {
        const puppet = {
          x: s.x, y: s.y, cls: s.cls, wep: s.wep || "novice", atk: s.atk, aim: aim, dir: aim,
          id: owner.id, throwerId: s.id, alive: true, level: 1, range: s.range,
        };
        this.classAttack(puppet, tgt, owner);
        s.x = puppet.x;
        s.y = puppet.y;
        s.dir = puppet.dir != null ? puppet.dir : aim;
        return;
      }
      if (s.behavior === "kite" || s.proj === "spit") {
        this.projectiles.push({
          x: s.x + Math.cos(aim) * 16,
          y: s.y + Math.sin(aim) * 16,
          vx: Math.cos(aim) * 260,
          vy: Math.sin(aim) * 260,
          dmg: s.atk, ownerId: owner.id, k: "spit", life: 1.05,
        });
        this.emitFx(s.x, s.y, "shot", "spit");
        return;
      }
      this.strike(s, tgt, s.atk, owner);
      this.emitFx(tgt.x, tgt.y, "slash", String(aim));
      this.emit("impact", { x: tgt.x, y: tgt.y, id: owner.id, crit: 0 });
    }

    strike(attacker, tgt, dmg, owner) {
      const src = owner || attacker;
      if (!tgt) return;
      if (this.shadows.has(tgt.id)) this.hurtShadow(tgt, dmg, src);
      else if (this.monsters.has(tgt.id)) this.hurtMonster(tgt, dmg, src);
      else if (tgt.cls !== undefined && this.players.has(tgt.id)) this.hurtHunter(tgt, dmg, src);
      else if (this.monarch && tgt.id === "monarch") this.hurtMonarch(dmg, src);
      else if (this.brBoss && tgt.id === "br-boss") this.hurtBrBoss(dmg, src);
      else if (this.minis.has(tgt.id)) this.hurtMini(tgt, dmg, src);
    }

    hurtMonster(m, dmg, killer) {
      if (!this.monsters.has(m.id)) return;
      if (killer && !this.duelAllowsHit(killer, m)) return;
      if (killer) {
        const kit = wepOf(killer).kit || killer.cls || "novice";
        const table = (CFG.WEAKNESS && CFG.WEAKNESS[m.typ]) || {};
        const mul = table[kit] || 1;
        dmg *= mul;
        if (mul >= 1.35) this.emitFx(m.x, m.y, "weak", "FAIBLESSE");
      }
      m.hp -= dmg;
      if (m.hp > 0) return;
      const lv = Math.max(1, m.level || 1);
      const half = Math.max(1, Math.floor(lv / 2));
      const typ = m.typ;
      this.monsters.delete(m.id);
      if (killer && killer.alive) {
        this.arise(killer, m);
        const def = CFG.MONSTER[typ];
        this.gainLevels(killer, half);
        this.gainXp(killer, def ? def.xp : 12);
      }
      this.spawnMonster(typ, null, 400, Math.max(1, lv - half));
    }

    arise(owner, m) {
      const id = uid();
      const def = CFG.MONSTER[m.typ] || {};
      this.shadows.set(id, {
        id, ownerId: owner.id, x: m.x, y: m.y,
        kind: "beast", typ: m.typ || "wolf", cls: null,
        hp: m.maxHp, maxHp: m.maxHp, atk: m.atk,
        range: m.behavior === "kite" ? 240 : (CFG.SHADOW_RANGE || 118), cd: m.behavior === "kite" ? 1.2 : 0.48,
        armor: 0, behavior: m.behavior, elite: !!m.elite,
        lastAtk: 0, name: m.name, gait: 0, guard: 0,
        speed: def.speed || 90, r: m.r, dir: 0, look: owner.look || 0,
        level: m.level || def.lv || 2, baseR: m.r,
      });
      this.emitFx(m.x, m.y, "arise", m.name);
      if (!owner.isBot) this.log(owner.name + " possède " + m.name + ".");
    }

    possessHunter(owner, victim) {
      const id = uid();
      const st = CFG.CLASS[victim.cls] || CFG.CLASS.novice;
      const kit = wepOf(victim);
      const ranged = !!(kit && kit.proj) || victim.cls === "mage";
      this.shadows.set(id, {
        id, ownerId: owner.id, x: victim.x, y: victim.y,
        kind: "hunter", typ: null, cls: victim.cls,
        hp: victim.maxHp, maxHp: victim.maxHp, atk: victim.atk,
        range: Math.max(victim.range || kit.range || 0, ranged ? 200 : (CFG.SHADOW_RANGE || 118)),
        cd: victim.cd || kit.cd || 0.48, armor: victim.armor || 0,
        lastAtk: 0, name: victim.name, gait: 0, guard: 0, elite: 1,
        speed: victim.speed, dir: victim.dir, r: CFG.PLAYER_R,
        crit: kit.crit || st.crit, critMul: kit.critMul || st.critMul, lunge: kit.lunge,
        aoe: kit.aoe, knock: kit.knock, splash: kit.splash, proj: kit.proj || null,
        behavior: ranged ? "kite" : "chase",
        look: owner.look || 0, wep: victim.wep || "novice",
        level: victim.level || 1, baseR: CFG.PLAYER_R,
      });
      this.emitFx(victim.x, victim.y, "arise", "POSSESSION " + victim.name);
      if (!owner.isBot) this.log(owner.name + " possède " + victim.name + " — attaques, PV et dons copiés.");
    }

    possessBoss(owner, boss) {
      const id = uid();
      const central = boss.kind === "br" || boss.kind === "raid" || boss.id === "br-boss" || boss.id === "monarch";
      this.shadows.set(id, {
        id, ownerId: owner.id, x: boss.x, y: boss.y,
        kind: "boss", typ: boss.sty || "knight", cls: null, speed: 70,
        hp: Math.round(boss.maxHp * 0.35), maxHp: Math.round(boss.maxHp * 0.35),
        atk: boss.atk, range: (CFG.SHADOW_RANGE || 118) + 24, cd: 0.9, armor: 0.2,
        lastAtk: 0, name: central ? "" : boss.name, gait: 0, guard: 0, elite: 1,
        sty: boss.sty || "knight", r: boss.r || CFG.MINI_R || 98,
        color: boss.color, rank: boss.rank, look: owner.look || 0,
        level: boss.level || 20, baseR: boss.r || CFG.MINI_R || 98,
      });
      this.emitFx(boss.x, boss.y, "arise", central ? "ÉVEIL" : boss.name);
    }

    hurtShadow(s, dmg, killer) {
      if (!this.shadows.has(s.id)) return;
      s.hp -= dmg * (1 - (s.armor || 0));
      if (s.hp > 0) return;
      const thief = killer && killer.alive && this.players.has(killer.id) ? killer : null;
      if (thief && thief.id !== s.ownerId) {
        s.ownerId = thief.id;
        s.look = thief.look || 0;
        s.hp = Math.max(1, (s.maxHp || 40) * 0.4);
        this.gainXp(thief, 8);
        this.emitFx(s.x, s.y, "arise", s.name || "Ombre");
        if (!thief.isBot) this.log(thief.name + " a pris une ombre.");
        return;
      }
      this.shadows.delete(s.id);
      if (thief) this.gainXp(thief, 8);
    }

    hurtHunter(p, dmg, killer) {
      if (!p.alive) return;
      if ((p.dodgeT || 0) > 0) return;
      if (this.duel && this.duelSide(p.id) && (!killer || !this.duelAllowsHit(killer, p))) return;
      let reduced = dmg * (1 - (p.armor || 0));
      if (p.megaT > 0) reduced *= CFG.MEGA_DR || 0.82;
      p.hp -= reduced;
      p.combatT = Math.max(p.combatT || 0, 1.6);
      if (killer && killer.id && this.players.has(killer.id) && killer.id !== p.id) {
        p.lastKillerId = killer.id;
      }
      if (p.hp <= 0) {
        const kid = (killer && killer.id && this.players.has(killer.id) && killer.id !== p.id)
          ? killer.id
          : p.lastKillerId;
        this.killHunter(p, kid ? this.players.get(kid) : null, "combat");
      }
    }

    hurtBrBoss(dmg, attacker) {
      const b = this.brBoss;
      if (!b || !b.alive) return;
      b.hp -= dmg;
      this.markBossFight(attacker, b);
      if (b.hp > 0) return;
      b.alive = false;
      b.hp = 0;
      this.collapsePortalsForBoss(b);
      this.emitFx(b.x, b.y, "monarchDown", b.name);
      if (attacker && attacker.alive) {
        this.possessBoss(attacker, b);
        this.gainXp(attacker, 180);
        this.log(attacker.name + " a terrassé Malakor — l'ombre du Souverain marche désormais à ses côtés.");
      }
    }

    hurtMini(mini, dmg, attacker) {
      if (!mini || !mini.alive) return;
      mini.hp -= dmg;
      this.markBossFight(attacker, mini);
      if (mini.hp > 0) return;
      mini.alive = false;
      mini.hp = 0;
      this.collapsePortalsForBoss(mini);
      this.minis.delete(mini.id);
      this.emitFx(mini.x, mini.y, "arise", mini.name);
      if (attacker && attacker.alive) {
        this.possessBoss(attacker, mini);
        this.gainXp(attacker, 90);
        this.log(attacker.name + " a vaincu " + mini.name + ".");
      }
    }

    hurtMonarch(dmg, attacker) {
      const b = this.monarch;
      if (!b || !b.alive) return;
      if (!this.bossAlerted) {
        this.bossAlerted = true;
        const name = attacker ? attacker.name : "Un chasseur";
        this.log("ALERTE : " + name + " affronte Malakor, Souverain de l'Abîme !");
        this.emit("bossAlert", { name, hp: b.hp, maxHp: b.maxHp, title: b.name });
      }
      b.hp -= dmg;
      this.markBossFight(attacker, b);
      if (b.hp > 0) return;
      b.alive = false;
      b.hp = 0;
      this.collapsePortalsForBoss(b);
      this.emitFx(b.x, b.y, "monarchDown", b.name);
      if (this.mode === "raid") {
        if (attacker && attacker.alive) this.gainXp(attacker, 180);
        const killerName = attacker && attacker.name ? attacker.name : "Un chasseur";
        this.log(killerName + " a terrassé Malakor.");
        const champ = (attacker && attacker.alive) ? attacker : (this.aliveHunters()[0] || attacker || null);
        this.endMatch(champ, "monarch");
        return;
      }
      if (attacker && attacker.alive) {
        this.possessBoss(attacker, b);
        this.gainXp(attacker, 180);
        this.log(attacker.name + " a terrassé Malakor — l'ombre du Souverain marche désormais à ses côtés.");
      }
    }

    killHunter(p, killer, reason) {
      if (!p.alive) return;
      const duelOther = this.duel && (p.id === this.duel.a || p.id === this.duel.b)
        ? (p.id === this.duel.a ? this.duel.b : this.duel.a)
        : null;
      p.alive = false;
      p.hp = 0;
      const who = (killer && killer.id) ? killer : (p.lastKillerId ? this.players.get(p.lastKillerId) : null);
      if (who && who.id) {
        p.killedBy = who.id;
        p.spectateId = who.id;
      }
      const army = this.armyOf(p.id);
      const lootTo = (killer && killer.alive) ? killer : (who && who.alive ? who : null);
      if (lootTo && reason === "combat") {
        for (const s of army) {
          s.ownerId = lootTo.id;
          s.look = lootTo.look || 0;
        }
        lootTo.kills += 1;
        lootTo.shadowsStolen += army.length;
        this.gainXp(lootTo, 55 + army.length * 4);
        this.possessHunter(lootTo, p);
        this.log(lootTo.name + " a abattu " + p.name + " et volé " + army.length + " ombre(s).");
        this.emitFx(p.x, p.y, "pvp", p.name);
      } else {
        for (const s of army) this.shadows.delete(s.id);
        if (reason === "barrier") {
          this.emitFx(p.x, p.y, "flame");
          this.log(p.name + " a été consumé par les flammes de la barrière.");
        }
      }
      this.emit("dead", { id: p.id, reason, killer: (who && who.name) || (killer && killer.name) || null });
      if (duelOther) {
        const other = this.players.get(duelOther);
        this.endDuel(other && other.alive ? other : null, p);
      }
    }

    gainLevels(p, n) {
      const add = Math.max(0, n | 0);
      if (!p || !add) return;
      for (let i = 0; i < add; i++) {
        p.level += 1;
        p.maxHp += 32;
        p.hp = Math.min(p.maxHp, p.hp + 55);
        p.atk += 1.4;
      }
      this.emitFx(p.x, p.y, "level", String(p.level));
    }

    gainXp(p, amount) {
      p.xp += amount;
      while (p.xp >= p.level * 40) {
        p.xp -= p.level * 40;
        p.level += 1;
        p.maxHp += 32;
        p.hp = Math.min(p.maxHp, p.hp + 55);
        p.atk += 1.4;
        this.emitFx(p.x, p.y, "level", String(p.level));
      }
    }

    aliveHunters() {
      return [...this.players.values()].filter((p) => p.alive);
    }

    checkWin() {
      if (this.state !== "playing") return;
      const alive = this.aliveHunters();
      if (alive.length <= 1) this.endMatch(alive[0] || null, "last");
    }

    endMatch(winner, reason) {
      if (this.state === "ended") return;
      this.state = "ended";
      this.winner = winner ? { id: winner.id, name: winner.name } : null;
      this.winReason = reason;
      this.emit("end", { winner: this.winner, reason, mode: this.kind || this.mode, board: this.board() });
    }

    board() {
      return [...this.players.values()]
        .map((p) => ({ name: p.name, kills: p.kills, shadows: this.armyOf(p.id).length, level: p.level, alive: p.alive, isBot: p.isBot }))
        .sort((a, b) => b.kills - a.kills || b.shadows - a.shadows);
    }

    packEntity(e, extra) {
      return Object.assign({ i: e.id, x: Math.round(e.x), y: Math.round(e.y), h: Math.round(e.h || e.hp), H: Math.round(e.H || e.maxHp) }, extra);
    }

    packFollow(t) {
      if (!t) return null;
      return {
        i: t.id, n: t.name, x: t.x, y: t.y,
        c: t.cls, w: t.wep || t.cls, w2: t.wep2 || "", d: +(t.dir || 0).toFixed(2),
        h: Math.round(t.hp), H: Math.round(t.maxHp),
        lv: t.level, xp: Math.round(t.xp || 0), xn: (t.level || 1) * 40,
        sh: this.armyOf(t.id).length,
        bw: Math.round(t.barW || 40),
        st: t.armyStance === "guard" ? 1 : 0,
        a: t.alive ? 1 : 0,
        of: t.orbForce || 0, ov: t.orbVital || 0, oh: t.orbHaste || 0, os: t.orbShadow || 0,
        ts: t.tileSpeed || 0, th: t.tileHeal || 0, tm: t.tileMight || 0,
        hst: +(t.hasteT || 0).toFixed(2), mtt: +(t.mightT || 0).toFixed(2),
        mg: +(t.megaT || 0).toFixed(2),
      };
    }

    resolveSpectate(viewer) {
      if (!viewer || viewer.alive) return null;
      const prefer = viewer.spectateId || viewer.killedBy;
      let t = prefer ? this.players.get(prefer) : null;
      if (t && t.alive && t.id !== viewer.id) return t;
      if (t && !t.alive && t.killedBy && t.killedBy !== viewer.id) {
        const next = this.players.get(t.killedBy);
        if (next && next.alive) {
          viewer.spectateId = next.id;
          return next;
        }
      }
      const others = this.aliveHunters().filter((p) => p.id !== viewer.id);
      t = others[0] || null;
      if (t) viewer.spectateId = t.id;
      return t;
    }

    snapshotFor(viewer) {
      let ax = viewer ? viewer.x : this.barrierCx;
      let ay = viewer ? viewer.y : this.barrierCy;
      let follow = viewer ? this.packFollow(viewer) : null;
      if (viewer && !viewer.alive) {
        const t = this.resolveSpectate(viewer);
        if (t) {
          ax = t.x;
          ay = t.y;
          follow = this.packFollow(t);
        }
      }
      const R = CFG.AOI;
      const players = [];
      for (const p of this.players.values()) {
        if (Math.hypot(p.x - ax, p.y - ay) > R && p !== viewer && !(follow && p.id === follow.i)) continue;
        players.push(this.packEntity(p, {
          n: p.name, c: p.cls, a: p.alive, d: +p.dir.toFixed(2),
          lv: p.level, xp: Math.round(p.xp || 0), xn: (p.level || 1) * 40, k: p.kills, bot: p.isBot ? 1 : 0,
          sh: this.armyOf(p.id).length, g: +p.gait.toFixed(2),
          mv: p.moving, st: p.armyStance === "guard" ? 1 : 0,
          bw: Math.round(p.barW || 40), ob: p.orbBars || 0,
          of: p.orbForce || 0, ov: p.orbVital || 0, oh: p.orbHaste || 0, os: p.orbShadow || 0,
          ts: p.tileSpeed || 0, th: p.tileHeal || 0, tm: p.tileMight || 0,
          hs: p.hasteT > 0 ? 1 : 0, mt: p.mightT > 0 ? 1 : 0, sk: p.look || 0,
          hst: +(p.hasteT || 0).toFixed(2), mtt: +(p.mightT || 0).toFixed(2),
          mg: +(p.megaT || 0).toFixed(2),
          sw: +(p.swing || 0).toFixed(2), w: p.wep || p.cls,
          w2: p.wep2 || "",
          dg: (p.dodgeT || 0) > 0 ? 1 : 0,
          spn: (p.sprintT || 0) > 0 ? 1 : 0,
          bo: this.hasThrow(p.id) ? 1 : 0,
          tr: p.trail || "",
          ou: p.outfit || "",
          ws: p.wepSkin || "",
          bs: p.shotSkin || "",
          sp: p.spawnStyle || "",
          stt: +(p.spawnT || 0).toFixed(2),
        }));
      }
      const monsters = [];
      for (const m of this.monsters.values()) {
        if (Math.hypot(m.x - ax, m.y - ay) > R) continue;
        monsters.push(this.packEntity(m, {
          e: m.elite ? 1 : 0, n: m.name, r: m.r, ty: m.typ,
          g: +(m.gait || 0).toFixed(2), ch: m.chargeT > 0 ? 1 : 0,
          lv: m.level || 1,
        }));
      }
      const shadows = [];
      for (const s of this.shadows.values()) {
        if (Math.hypot(s.x - ax, s.y - ay) > R) continue;
        shadows.push(this.packEntity(s, {
          o: s.ownerId, e: s.elite ? 1 : 0, ty: s.typ || "", g: +(s.gait || 0).toFixed(2),
          gd: s.guard || 0, knd: s.kind || "beast", c: s.cls || "",
          d: +(s.dir || 0).toFixed(2), sty: s.sty || "",
          r: Math.round(s.r || 14), bw: Math.round(Math.max(14, Math.min(48, (s.r || 14) * 1.2))),
          sk: s.look || 0, w: s.wep || s.cls || "",
          lv: s.level || 1,
          bo: this.hasThrow(s.id) ? 1 : 0,
        }));
      }
      const loots = [];
      for (const l of this.loots.values()) {
        if (Math.hypot(l.x - ax, l.y - ay) > R) continue;
        loots.push({ i: l.id, x: Math.round(l.x), y: Math.round(l.y), k: l.kind, c: l.cls, sz: l.sz || 1 });
      }
      const projectiles = this.projectiles
        .filter((pr) => Math.hypot(pr.x - ax, pr.y - ay) < R)
        .map((pr) => {
          const row = { x: Math.round(pr.x), y: Math.round(pr.y), k: pr.k || "bolt", a: +(Math.atan2(pr.vy, pr.vx).toFixed(3)) };
          if (pr.sk) row.sk = pr.sk;
          if (pr.k === "throw") {
            row.w = pr.w || "novice";
            row.s = +(pr.spin || 0).toFixed(2);
          }
          return row;
        });
      const obs = [];
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        if (Math.hypot(o.x - ax, o.y - ay) > R) continue;
        obs.push({ x: Math.round(o.x), y: Math.round(o.y), r: Math.round(o.r), k: o.k });
      }
      let monarch = null;
      if (this.monarch) monarch = { i: "monarch", x: this.monarch.x, y: this.monarch.y, h: Math.round(this.monarch.hp), H: this.monarch.maxHp, a: this.monarch.alive ? 1 : 0, r: this.monarch.r || CFG.MONARCH_R || 196, n: this.monarch.name, k: "raid", sty: this.monarch.sty || "sovereign", lv: this.monarch.level || 50 };
      let brBoss = null;
      if (this.brBoss) brBoss = { i: "br-boss", x: this.brBoss.x, y: this.brBoss.y, h: Math.round(this.brBoss.hp), H: this.brBoss.maxHp, a: this.brBoss.alive ? 1 : 0, r: this.brBoss.r, n: this.brBoss.name, k: "br", sty: this.brBoss.sty || "sovereign", lv: this.brBoss.level || 50 };
      const minis = [];
      for (const mini of this.minis.values()) {
        if (!mini.alive || Math.hypot(mini.x - ax, mini.y - ay) > R) continue;
        minis.push({ i: mini.id, x: mini.x, y: mini.y, h: Math.round(mini.hp), H: mini.maxHp, a: 1, r: mini.r, n: mini.name, k: "mini", sty: mini.sty, col: mini.color, lv: mini.level || 12 });
      }
      const portals = (this.portals || []).map((g) => ({
        x: Math.round(g.x), y: Math.round(g.y), rnk: g.rank || "", col: g.color,
        n: g.bossName || g.name || "", lv: g.bossLv || 1,
        ph: g.phase || "", sh: +(g.shadowT || 0).toFixed(2),
      }));
      const dots = [...this.players.values()].filter((p) => p.alive).map((p) => ({ i: p.id, n: p.name, x: p.x, y: p.y, sk: p.look || 0 }));
      const me = viewer && this.players.get(viewer.id);
      let hudBoss = null;
      if (this.mode === "raid" && this.bossAlerted && this.monarch && this.monarch.alive) {
        hudBoss = { n: this.monarch.name, h: Math.round(this.monarch.hp), H: Math.round(this.monarch.maxHp), mal: 1 };
      }
      return {
        t: this.time, mode: this.mode, br: Math.round(this.barrierR), bx: this.barrierCx, by: this.barrierCy,
        frozen: this.zoneState === "frozen" ? 1 : 0,
        zst: this.zoneState, zleft: Math.ceil(this.zoneLeft), zph: this.zonePhase,
        alert: this.bossAlerted ? 1 : 0, you: viewer ? viewer.id : null,
        players, monsters, shadows, loots, projectiles, monarch, brBoss, minis, dots, follow, obs, portals,
        alive: this.aliveHunters().length, total: this.players.size,
        spectate: viewer && !viewer.alive ? 1 : 0,
        stance: me && me.armyStance === "guard" ? 1 : 0,
        merge: me && this.canMergeArmy(me) ? 1 : 0,
        dodge: me && (me.dodgeCd || 0) <= 0 ? 1 : 0,
        dcd: me ? +(me.dodgeCd || 0).toFixed(2) : 0,
        dcm: CFG.DODGE_CD || 4.8,
        cbt: me && this.inCombat(me) ? 1 : 0,
        spt: me && (me.sprintT || 0) > 0 ? +(me.sprintFuel || 0).toFixed(2) : 0,
        spf: me ? +(me.sprintFuel != null ? me.sprintFuel : this.sprintDur()).toFixed(2) : 0,
        spm: this.sprintDur(),
        spr: me && !this.inCombat(me) && (me.sprintT || 0) <= 0 && (me.sprintFuel || 0) >= 0.2 ? 1 : 0,
        hudBoss,
        duel: this.duel ? { x: Math.round(this.duel.x), y: Math.round(this.duel.y), r: Math.round(this.duel.r), a: this.duel.a, b: this.duel.b } : null,
        ask: this.duelAsk && viewer && this.duelAsk.to === viewer.id ? {
          n: (this.players.get(this.duelAsk.from) || {}).name || "Chasseur",
          t: Math.ceil(this.duelAsk.left),
        } : null,
        chal: this.duelAsk && viewer && this.duelAsk.from === viewer.id ? {
          n: (this.players.get(this.duelAsk.to) || {}).name || "Chasseur",
        } : null,
        din: this.duel && viewer && this.duelSide(viewer.id) ? 1 : 0,
        foe: this.duel && viewer && this.duelSide(viewer.id)
          ? ((this.players.get(viewer.id === this.duel.a ? this.duel.b : this.duel.a) || {}).name || "")
          : "",
      };
    }

    destroy() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.state = "dead";
      this.emit("destroy", this.id);
    }
  }

  return GameRoom;
});
