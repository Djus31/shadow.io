(function (global) {
  const LOOKS = [
    { coat: 0x1a0c12, trim: 0x8a1424, eye: 0xff3355 },
    { coat: 0x0e141c, trim: 0x3d8cff, eye: 0x3d8cff },
    { coat: 0x120c18, trim: 0x7a4cff, eye: 0x7a4cff },
    { coat: 0x16120c, trim: 0xc48a28, eye: 0xe7c56a },
    { coat: 0x0c1612, trim: 0x2ecc7a, eye: 0x2ecc7a },
    { coat: 0x1a1014, trim: 0xe07090, eye: 0xe07090 },
    { coat: 0x121416, trim: 0x8ab4c8, eye: 0x8ab4c8 },
    { coat: 0x1c140c, trim: 0xd06020, eye: 0xff6a40 },
    { coat: 0x101018, trim: 0xc0b8e8, eye: 0xc0b8e8 },
    { coat: 0x14180c, trim: 0xa8c040, eye: 0xa8c040 },
    { coat: 0x180c18, trim: 0xe040c0, eye: 0xe040c0 },
    { coat: 0x0c1218, trim: 0x20c8d0, eye: 0x20c8d0 },
    { coat: 0x1c1010, trim: 0xe8d0a8, eye: 0xe8d0a8 },
    { coat: 0x10140c, trim: 0x68e0a0, eye: 0x68e0a0 },
    { coat: 0x180e0c, trim: 0xff6a40, eye: 0xff6a40 },
    { coat: 0x0e1014, trim: 0x6ee0ff, eye: 0x6ee0ff },
    { coat: 0x1a0e16, trim: 0xb04060, eye: 0xb04060 },
    { coat: 0x12100c, trim: 0xd4a020, eye: 0xd4a020 },
    { coat: 0x0c0e16, trim: 0x5060ff, eye: 0x5060ff },
    { coat: 0x16140e, trim: 0xc4c4b0, eye: 0xc4c4b0 },
    { coat: 0x14080c, trim: 0xff2048, eye: 0xff2048 },
    { coat: 0x081018, trim: 0x40f0c8, eye: 0x40f0c8 },
    { coat: 0x161008, trim: 0xffc040, eye: 0xffc040 },
    { coat: 0x100818, trim: 0xb080ff, eye: 0xb080ff },
  ];
  const SELF = { coat: 0x2a3544, trim: 0xc9b48a, eye: 0x5ad4ff };
  const ALLY = { coat: 0x101828, trim: 0x5ad4ff, eye: 0x5ad4ff };

  function lookOf(sk, role) {
    if (role === "self") return SELF;
    if (role === "ally") return ALLY;
    const i = ((sk == null ? 0 : sk) % LOOKS.length + LOOKS.length) % LOOKS.length;
    return LOOKS[i];
  }

  function hexColor(n) {
    const c = new THREE.Color(n);
    return "#" + c.getHexString();
  }

  class World3D {
    constructor(canvas, mini) {
      this.canvas = canvas;
      this.mini = mini;
      this.mctx = mini.getContext("2d");
      this.fx = [];
      this.t = 0;
      this.camFollow = { x: 11000, z: 11000 };
      this.nodes = new Map();
      this.labelCache = {};
      this.matCache = {};
      this.geo = {};

      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      this.renderer.setClearColor(0x05070a, 1);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = false;
      if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x07090e, 0.00022);
      this.scene.background = new THREE.Color(0x05070a);

      this.camera = new THREE.PerspectiveCamera(46, 1, 12, 9000);

      this.buildWorld();
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    resize() {
      const w = innerWidth;
      const h = innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    }

    mat(hex, opts) {
      const extra = opts || {};
      const key = hex + "|" + (extra.emissive || 0) + "|" + (extra.emInt || 0) + "|" + (extra.transp ? 1 : 0);
      if (this.matCache[key]) return this.matCache[key];
      const m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: extra.rough != null ? extra.rough : 0.72,
        metalness: extra.metal != null ? extra.metal : 0.18,
        emissive: extra.emissive || 0x000000,
        emissiveIntensity: extra.emInt || 0,
        transparent: !!extra.transp,
        opacity: extra.opacity != null ? extra.opacity : 1,
        side: extra.side || THREE.FrontSide,
      });
      this.matCache[key] = m;
      return m;
    }

    geoBox(w, h, d) {
      const k = "b" + w + "x" + h + "x" + d;
      if (!this.geo[k]) this.geo[k] = new THREE.BoxGeometry(w, h, d);
      return this.geo[k];
    }

    geoSphere(r, seg) {
      const k = "s" + r + ":" + (seg || 8);
      if (!this.geo[k]) this.geo[k] = new THREE.SphereGeometry(r, seg || 8, seg || 6);
      return this.geo[k];
    }

    geoCyl(rt, rb, h, seg) {
      const k = "c" + rt + ":" + rb + ":" + h + ":" + (seg || 8);
      if (!this.geo[k]) this.geo[k] = new THREE.CylinderGeometry(rt, rb, h, seg || 8);
      return this.geo[k];
    }

    buildWorld() {
      const map = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.MAP_SIZE) || 22000;
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(map + 800, map + 800, 1, 1),
        this.mat(0x0a0d12, { rough: 0.95, metal: 0.02 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(map / 2, 0, map / 2);
      this.scene.add(ground);

      const grid = new THREE.GridHelper(map, 80, 0x1a2430, 0x10161e);
      grid.position.set(map / 2, 0.4, map / 2);
      grid.material.transparent = true;
      grid.material.opacity = 0.22;
      this.scene.add(grid);

      this.hemi = new THREE.HemisphereLight(0x6a88b8, 0x1a1210, 1.15);
      this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xc8d8f0, 0.85);
      this.sun.position.set(400, 900, 200);
      this.scene.add(this.sun);
      this.amb = new THREE.AmbientLight(0x3a4458, 0.85);
      this.scene.add(this.amb);

      this.playerLight = new THREE.PointLight(0x5ad4ff, 3.4, 820, 1.35);
      this.playerLight.position.set(0, 90, 0);
      this.scene.add(this.playerLight);
      this.rimLight = new THREE.PointLight(0x9a70ff, 1.6, 900, 1.5);
      this.scene.add(this.rimLight);

      this.barrierRing = new THREE.Mesh(
        new THREE.TorusGeometry(400, 14, 8, 96),
        this.mat(0xff3355, { emissive: 0xff2040, emInt: 0.85, metal: 0.4 })
      );
      this.barrierRing.rotation.x = Math.PI / 2;
      this.barrierRing.position.y = 8;
      this.scene.add(this.barrierRing);

      this.fxRoot = new THREE.Group();
      this.scene.add(this.fxRoot);
    }

    addFx(f) {
      const life = f.kind === "chest" && f.extra && f.extra !== "roulette" ? 3.4 : f.kind === "flame" ? 0.9 : 1.35;
      this.fx.push({ ...f, life: life, born: this.t });
    }

    impact() {}

    spriteFromText(lines, color, size) {
      const key = lines.join("|") + color + size;
      if (this.labelCache[key]) return this.labelCache[key];
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 192;
      const g = c.getContext("2d");
      g.clearRect(0, 0, 512, 192);
      g.textAlign = "center";
      g.lineWidth = 8;
      g.strokeStyle = "rgba(4,6,10,0.9)";
      g.fillStyle = color || "#efe7d6";
      g.font = "800 " + (size || 42) + "px Rajdhani, sans-serif";
      lines.forEach((line, i) => {
        const y = 70 + i * 52;
        g.strokeText(line, 256, y);
        g.fillText(line, 256, y);
      });
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      this.labelCache[key] = mat;
      return mat;
    }

    makeLabel(group, y) {
      const spr = new THREE.Sprite(this.spriteFromText([" "], "#fff", 36));
      spr.position.y = y;
      spr.scale.set(70, 26, 1);
      spr.name = "label";
      group.add(spr);
      return spr;
    }

    setLabel(spr, lines, color, scale) {
      spr.material = this.spriteFromText(lines, color, 40);
      const w = scale || 78;
      spr.scale.set(w, w * 0.38, 1);
      spr.visible = true;
    }

    tintMesh(mesh, hex) {
      if (!mesh) return;
      mesh.material = this.mat(hex, { metal: 0.22, rough: 0.65 });
    }

    makeEyes(parent, y, spread, r, color) {
      const mat = this.mat(color, { emissive: color, emInt: 1.6, metal: 0.1 });
      const a = new THREE.Mesh(this.geoSphere(r, 8), mat);
      const b = new THREE.Mesh(this.geoSphere(r, 8), mat);
      a.position.set(-spread, y, r * 1.2);
      b.position.set(spread, y, r * 1.2);
      a.name = "eyeL";
      b.name = "eyeR";
      parent.add(a);
      parent.add(b);
      return [a, b];
    }

    colorEyes(group, color) {
      const mat = this.mat(color, { emissive: color, emInt: 1.8 });
      group.traverse((ch) => {
        if (ch.name === "eyeL" || ch.name === "eyeR") ch.material = mat;
      });
    }

    makeHunter() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geoCyl(9, 11, 28, 8), this.mat(SELF.coat));
      body.position.y = 22;
      body.name = "body";
      const hood = new THREE.Mesh(this.geoCyl(8, 9, 12, 8), this.mat(0x1a1e24));
      hood.position.y = 40;
      hood.name = "hood";
      const coat = new THREE.Mesh(this.geoBox(22, 18, 10), this.mat(SELF.coat));
      coat.position.set(0, 18, -2);
      coat.name = "coat";
      g.add(body);
      g.add(hood);
      g.add(coat);
      this.makeEyes(g, 40, 3.2, 1.15, SELF.eye);
      const wep = new THREE.Mesh(this.geoBox(2.2, 22, 2.2), this.mat(SELF.trim, { metal: 0.55 }));
      wep.position.set(12, 24, 6);
      wep.name = "wep";
      g.add(wep);
      this.makeLabel(g, 58);
      g.userData.kind = "hunter";
      return g;
    }

    makeBeast() {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(this.geoBox(22, 14, 34), this.mat(0x161018));
      torso.position.y = 12;
      torso.name = "body";
      const head = new THREE.Mesh(this.geoBox(14, 12, 16), this.mat(0x1c1418));
      head.position.set(0, 16, 18);
      head.name = "head";
      g.add(torso);
      g.add(head);
      this.makeEyes(g, 18, 3.4, 1.3, 0xe23b4a);
      this.makeLabel(g, 36);
      g.userData.kind = "beast";
      return g;
    }

    makeBoss() {
      const g = new THREE.Group();
      const core = new THREE.Mesh(this.geoCyl(28, 38, 90, 10), this.mat(0x0a0308, { metal: 0.35, rough: 0.45 }));
      core.position.y = 50;
      core.name = "body";
      const crown = new THREE.Mesh(this.geoBox(48, 18, 18), this.mat(0x3a0a18, { emissive: 0x4a1020, emInt: 0.35 }));
      crown.position.y = 102;
      const hornL = new THREE.Mesh(this.geoBox(6, 42, 6), this.mat(0xe7c56a, { metal: 0.6 }));
      const hornR = hornL.clone();
      hornL.position.set(-16, 128, 0);
      hornR.position.set(16, 128, 0);
      g.add(core);
      g.add(crown);
      g.add(hornL);
      g.add(hornR);
      this.makeEyes(g, 78, 10, 4.5, 0xff3355);
      this.makeLabel(g, 160);
      g.userData.kind = "boss";
      return g;
    }

    makeChest() {
      const g = new THREE.Group();
      const box = new THREE.Mesh(this.geoBox(110, 58, 72), this.mat(0x4a2a12, { rough: 0.85 }));
      box.position.y = 30;
      const lid = new THREE.Mesh(this.geoBox(114, 14, 76), this.mat(0x2a1608));
      lid.position.y = 62;
      const band = new THREE.Mesh(this.geoBox(116, 10, 18), this.mat(0xc9b48a, { metal: 0.7 }));
      band.position.y = 30;
      const gem = new THREE.Mesh(this.geoSphere(8, 10), this.mat(0x5ad4ff, { emissive: 0x5ad4ff, emInt: 1.4 }));
      gem.position.set(0, 40, 38);
      g.add(box);
      g.add(lid);
      g.add(band);
      g.add(gem);
      const glow = new THREE.PointLight(0x5ad4ff, 1.1, 180);
      glow.position.set(0, 50, 0);
      g.add(glow);
      return g;
    }

    makePortal() {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(28, 4.5, 8, 24),
        this.mat(0x5ad4ff, { emissive: 0x5ad4ff, emInt: 0.9, metal: 0.4 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 6;
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(22, 20),
        this.mat(0x0a0614, { transp: true, opacity: 0.72, emissive: 0x3a2080, emInt: 0.45, side: THREE.DoubleSide })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 2;
      const light = new THREE.PointLight(0x7a4cff, 1.4, 220);
      light.position.y = 18;
      g.add(ring);
      g.add(disc);
      g.add(light);
      this.makeLabel(g, 48);
      return g;
    }

    makeLoot() {
      const g = new THREE.Group();
      const core = new THREE.Mesh(this.geoSphere(8, 10), this.mat(0x5ad4ff, { emissive: 0x5ad4ff, emInt: 0.8 }));
      core.position.y = 10;
      core.name = "body";
      g.add(core);
      this.makeLabel(g, 28);
      return g;
    }

    makeRock() {
      const g = new THREE.Group();
      const m = new THREE.Mesh(this.geoBox(28, 22, 24), this.mat(0x1a1e24, { rough: 0.95 }));
      m.position.y = 11;
      g.add(m);
      return g;
    }

    factory(kind) {
      if (kind === "hunter") return this.makeHunter();
      if (kind === "beast") return this.makeBeast();
      if (kind === "boss") return this.makeBoss();
      if (kind === "chest") return this.makeChest();
      if (kind === "portal") return this.makePortal();
      if (kind === "loot") return this.makeLoot();
      if (kind === "rock") return this.makeRock();
      return this.makeBeast();
    }

    node(kind, id) {
      const key = kind + ":" + id;
      let n = this.nodes.get(key);
      if (!n) {
        n = this.factory(kind);
        n.userData.key = key;
        this.scene.add(n);
        this.nodes.set(key, n);
      }
      n.visible = true;
      n.userData.alive = true;
      return n;
    }

    beginFrame() {
      this.nodes.forEach((n) => {
        n.userData.alive = false;
      });
    }

    endFrame() {
      this.nodes.forEach((n) => {
        if (!n.userData.alive) n.visible = false;
      });
    }

    place(n, x, z, y, rot, scale) {
      n.position.set(x, y || 0, z);
      if (rot != null) n.rotation.y = -rot + Math.PI;
      if (scale) n.scale.setScalar(scale);
    }

    draw(state, meId) {
      if (typeof THREE === "undefined") return;
      this.t = state.t || this.t + 0.016;
      const me = (state.players || []).find((p) => p.i === meId);
      const follow = state.follow;
      const focus = follow && state.spectate ? follow : me;
      const fx = focus ? focus.x : state.bx || 11000;
      const fz = focus ? focus.y : state.by || 11000;
      this.camFollow.x += (fx - this.camFollow.x) * 0.14;
      this.camFollow.z += (fz - this.camFollow.z) * 0.14;
      const cx = this.camFollow.x;
      const cz = this.camFollow.z;
      this.camera.position.set(cx, 280, cz + 340);
      this.camera.lookAt(cx, 48, cz);
      this.sun.position.set(cx + 180, 520, cz - 220);
      this.playerLight.position.set(cx, 80, cz);
      this.rimLight.position.set(cx - 80, 140, cz - 60);

      if (this.barrierRing && state.br) {
        const r = Math.max(40, state.br);
        this.barrierRing.scale.set(r / 400, r / 400, 1);
        this.barrierRing.position.set(state.bx || 11000, 10, state.by || 11000);
      }

      this.beginFrame();

      for (const p of state.players || []) {
        if (!p.a) continue;
        const n = this.node("hunter", p.i);
        const role = p.i === meId ? "self" : "enemy";
        const look = lookOf(p.sk, role);
        this.tintMesh(n.getObjectByName("body"), look.coat);
        this.tintMesh(n.getObjectByName("coat"), look.coat);
        this.tintMesh(n.getObjectByName("hood"), look.coat);
        this.colorEyes(n, look.eye);
        this.place(n, p.x, p.y, 0, p.d, 1.85);
        const lab = n.getObjectByName("label");
        if (lab) this.setLabel(lab, ["Lv. " + (p.lv || 1), String(p.n || "").slice(0, 12)], role === "self" ? "#c9b48a" : hexColor(look.trim), 90);
      }

      for (const m of state.monsters || []) {
        const n = this.node("beast", m.i);
        const sc = Math.max(0.7, (m.r || 16) / 18);
        this.place(n, m.x, m.y, 0, 0, sc * 1.45);
        this.colorEyes(n, 0xe23b4a);
        const lab = n.getObjectByName("label");
        if (lab) this.setLabel(lab, ["Lv. " + (m.lv || 1)], "#efe7d6", 64);
      }

      for (const s of state.shadows || []) {
        const mine = s.o === meId;
        const look = lookOf(s.sk, mine ? "ally" : "enemy");
        if (s.knd === "hunter") {
          const n = this.node("hunter", "sh-" + s.i);
          this.tintMesh(n.getObjectByName("body"), look.coat);
          this.tintMesh(n.getObjectByName("coat"), look.coat);
          this.colorEyes(n, mine ? SELF.eye : look.eye);
          this.place(n, s.x, s.y, 0, s.d, 1.65);
          const lab = n.getObjectByName("label");
          if (lab) this.setLabel(lab, ["Lv. " + (s.lv || 1)], mine ? "#5ad4ff" : hexColor(look.trim), 70);
        } else if (s.knd === "boss") {
          const n = this.node("boss", "sh-" + s.i);
          const sc = Math.max(0.45, (s.r || 40) / 90);
          this.place(n, s.x, s.y, 0, 0, sc);
          this.colorEyes(n, mine ? SELF.eye : look.eye);
          const lab = n.getObjectByName("label");
          if (lab) this.setLabel(lab, ["Lv. " + (s.lv || 1)], mine ? "#5ad4ff" : hexColor(look.trim), 110);
        } else {
          const n = this.node("beast", "sh-" + s.i);
          const sc = Math.max(0.7, (s.r || 16) / 18);
          this.place(n, s.x, s.y, 0, 0, sc * 1.4);
          this.colorEyes(n, mine ? SELF.eye : look.eye);
          const lab = n.getObjectByName("label");
          if (lab) this.setLabel(lab, ["Lv. " + (s.lv || 1)], mine ? "#5ad4ff" : hexColor(look.trim), 64);
        }
      }

      const bosses = [];
      if (state.monarch && state.monarch.a) bosses.push(state.monarch);
      if (state.brBoss && state.brBoss.a) bosses.push(state.brBoss);
      for (const mini of state.minis || []) bosses.push(mini);
      bosses.forEach((b, idx) => {
        const id = b.i || b.k || ("boss-" + idx);
        const n = this.node("boss", id);
        const sc = Math.max(0.55, (b.r || 98) / 90);
        this.place(n, b.x, b.y, 0, 0, sc);
        this.colorEyes(n, 0xff3355);
        const lab = n.getObjectByName("label");
        if (lab) this.setLabel(lab, ["Lv. " + (b.lv || 12), String(b.n || "")], "#efe7d6", 140);
      });

      for (const l of state.loots || []) {
        if (l.k === "chest") {
          const n = this.node("chest", l.i);
          this.place(n, l.x, l.y, 0, this.t * 0.2, 1.35);
        } else {
          const n = this.node("loot", l.i);
          n.position.set(l.x, 10 + Math.sin(this.t * 3 + l.x) * 4, l.y);
          n.userData.alive = true;
          n.visible = true;
          const body = n.getObjectByName("body");
          const col = l.k === "tile" ? 0x6ee0ff : l.c === "vital" ? 0x5cff9a : l.c === "force" ? 0xe23b4a : 0x5ad4ff;
          if (body) body.material = this.mat(col, { emissive: col, emInt: 0.7 });
          const lab = n.getObjectByName("label");
          if (lab && l.k === "tile") {
            const t = l.c === "speed" ? "VITESSE" : l.c === "heal" ? "SOIN" : "FORCE";
            this.setLabel(lab, [t], "#efe7d6", 70);
          } else if (lab && l.k === "weapon") {
            this.setLabel(lab, [String(l.c || "").toUpperCase()], "#e7c56a", 70);
          } else if (lab) lab.visible = false;
        }
      }

      for (const g of state.portals || []) {
        const n = this.node("portal", g.x + ":" + g.y);
        this.place(n, g.x, g.y, 0, this.t, 1);
        const lab = n.getObjectByName("label");
        if (lab) this.setLabel(lab, [g.rnk ? "PORTAIL " + g.rnk : "PORTAIL"], g.col || "#5ad4ff", 90);
      }

      for (const o of state.obs || []) {
        const n = this.node("rock", o.x + ":" + o.y);
        this.place(n, o.x, o.y, 0, 0, (o.r || 24) / 18);
      }

      this.drawFx3();
      this.endFrame();
      this.renderer.render(this.scene, this.camera);
      this.drawMinimap(state, meId);
    }

    drawFx3() {
      const next = [];
      let slot = 0;
      for (const f of this.fx) {
        f.life -= 0.018;
        if (f.life <= 0) continue;
        const n = this.node("loot", "fx-" + slot);
        slot += 1;
        n.position.set(f.x, 24 + (1.2 - f.life) * 40, f.y);
        const lab = n.getObjectByName("label");
        let text = f.extra || f.kind;
        if (f.kind === "arise") text = "ARISE";
        else if (f.kind === "level") text = "NIVEAU " + f.extra;
        else if (f.kind === "tile") text = f.extra;
        else if (f.kind === "loot") text = f.extra;
        else if (f.kind === "chest" && f.extra === "roulette") text = "COFFRE";
        else if (f.kind === "chest") text = String(f.extra || "").toUpperCase();
        else if (f.kind === "flame") text = "";
        else if (f.kind === "recall") text = "RAPPEL";
        else if (f.kind === "hunt") text = "CHASSE";
        else if (f.kind === "weak") text = "FAIBLESSE";
        else if (f.kind === "pvp") text = "ARMÉE VOLÉE";
        else if (f.kind === "slash" || f.kind === "beam" || f.kind === "crit") text = f.kind === "crit" ? "CRIT" : "";
        if (lab) {
          if (text) this.setLabel(lab, [String(text).slice(0, 22)], f.kind === "flame" ? "#ff6a30" : "#efe7d6", 120);
          else lab.visible = false;
        }
        const body = n.getObjectByName("body");
        if (body) {
          const col = f.kind === "flame" ? 0xff4a18 : 0x5ad4ff;
          body.material = this.mat(col, { emissive: col, emInt: 1.2, transp: true, opacity: Math.max(0.2, f.life) });
        }
        next.push(f);
      }
      this.fx = next;
    }

    drawMinimap(state, meId) {
      const c = this.mctx;
      const s = this.mini.width;
      const map = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.MAP_SIZE) || 22000;
      const k = s / map;
      c.clearRect(0, 0, s, s);
      c.fillStyle = "#07090e";
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "rgba(90,212,255,0.45)";
      c.strokeRect(1, 1, s - 2, s - 2);
      c.beginPath();
      c.arc((state.bx || 0) * k, (state.by || 0) * k, (state.br || 0) * k, 0, Math.PI * 2);
      c.stroke();
      for (const g of state.portals || []) {
        c.fillStyle = g.col || "#6ee0ff";
        c.beginPath();
        c.arc(g.x * k, g.y * k, 2.2, 0, Math.PI * 2);
        c.fill();
      }
      if (state.monarch && state.monarch.a) {
        c.fillStyle = "#ff4d5a";
        c.fillRect(state.monarch.x * k - 3, state.monarch.y * k - 3, 6, 6);
      }
      if (state.brBoss && state.brBoss.a) {
        c.fillStyle = "#c56bff";
        c.fillRect(state.brBoss.x * k - 4, state.brBoss.y * k - 4, 8, 8);
      }
      for (const mini of state.minis || []) {
        c.fillStyle = "#ffb070";
        c.fillRect(mini.x * k - 2, mini.y * k - 2, 4, 4);
      }
      const dots = state.dots && state.dots.length ? state.dots : (state.players || []).filter((p) => p.a);
      let you = null;
      for (const p of dots) {
        if (p.i === meId) { you = p; continue; }
        c.fillStyle = "#ff5060";
        c.beginPath();
        c.arc(p.x * k, p.y * k, 2.2, 0, Math.PI * 2);
        c.fill();
      }
      const mark = you || (state.spectate && state.follow ? state.follow : null);
      if (mark) {
        c.fillStyle = "#5ad4ff";
        c.beginPath();
        c.arc(mark.x * k, mark.y * k, 3.4, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  global.World3D = World3D;
})(typeof window !== "undefined" ? window : this);
