(function () {
  function t(k, vars) {
    return window.I18n ? I18n.t(k, vars) : k;
  }
  const menu = document.getElementById("menu");
  const lobby = document.getElementById("lobby");
  const gameEl = document.getElementById("game");
  const endEl = document.getElementById("end");
  const nameInput = document.getElementById("hunter-name");
  const canvas = document.getElementById("view");
  const mini = document.getElementById("minimap");
  const renderer = new Renderer(canvas, mini);
  const joy = document.getElementById("joy");
  const stick = document.getElementById("stick");
  const recallBtn = document.getElementById("btn-recall");
  const mergeBtn = document.getElementById("btn-merge");
  const duelBtn = document.getElementById("btn-duel");
  const attackBtn = document.getElementById("btn-attack");
  const dodgeBtn = document.getElementById("btn-dodge");
  const deadUi = document.getElementById("dead-ui");
  const speedTest = document.getElementById("speed-test");
  if (speedTest) speedTest.classList.add("hidden");

  nameInput.value = (window.HunterProfile ? HunterProfile.get().name : localStorage.getItem("shadowio-name")) || "";
  if (window.HunterProfile) HunterProfile.render(document.getElementById("hunter-profile"));
  const codeInput = document.getElementById("hunter-code");
  if (nameInput && window.HunterProfile) {
    nameInput.addEventListener("input", () => {
      HunterProfile.setName(nameInput.value);
      if (codeInput) codeInput.dataset.dirty = "";
      showHunterCode();
    });
  }

  const codeMsg = document.getElementById("hunter-code-msg");
  const codeCopy = document.getElementById("btn-code-copy");
  const codeImport = document.getElementById("btn-code-import");
  function setCodeMsg(text, kind) {
    if (!codeMsg) return;
    codeMsg.textContent = text || "";
    codeMsg.classList.remove("ok", "err");
    if (kind) codeMsg.classList.add(kind);
  }
  function showHunterCode() {
    if (!codeInput || !window.HunterProfile || !HunterProfile.exportCode) return;
    if (codeInput.dataset.dirty === "1") return;
    codeInput.value = HunterProfile.exportCode();
  }
  function refreshHunterUi() {
    if (nameInput && window.HunterProfile) nameInput.value = HunterProfile.get().name || "";
    if (window.HunterProfile) HunterProfile.render(document.getElementById("hunter-profile"));
    if (window.StylePass && passRoot) StylePass.renderPanel(passRoot);
    if (codeInput) codeInput.dataset.dirty = "";
    showHunterCode();
  }
  if (codeInput) {
    showHunterCode();
    codeInput.addEventListener("input", function () {
      codeInput.dataset.dirty = "1";
    });
    codeInput.addEventListener("focus", function () {
      if (codeInput.dataset.dirty === "1") return;
      codeInput.select();
    });
  }
  if (codeCopy && window.HunterProfile) {
    codeCopy.addEventListener("click", function () {
      const code = HunterProfile.exportCode();
      if (codeInput) {
        codeInput.dataset.dirty = "";
        codeInput.value = code;
      }
      const done = function () { setCodeMsg(t("codeCopied"), "ok"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(function () {
          if (codeInput) {
            codeInput.focus();
            codeInput.select();
          }
          setCodeMsg(t("codeSelect"), "ok");
        });
      } else {
        if (codeInput) {
          codeInput.focus();
          codeInput.select();
        }
        setCodeMsg(t("codeSelect"), "ok");
      }
    });
  }
  if (codeImport && window.HunterProfile) {
    codeImport.addEventListener("click", function () {
      const raw = (codeInput && codeInput.value) || "";
      if (!raw.trim()) {
        setCodeMsg(t("codeEmpty"), "err");
        return;
      }
      if (!window.confirm(t("codeConfirm"))) return;
      const res = HunterProfile.importCode(raw);
      if (!res.ok) {
        setCodeMsg(res.err || "Code invalide.", "err");
        return;
      }
      refreshHunterUi();
      setCodeMsg(t("codeImported", { name: res.data.name || "Chasseur" }), "ok");
    });
  }

  const passRoot = document.getElementById("pass-panel");
  if (window.StylePass && passRoot) StylePass.renderPanel(passRoot);
  if (window.GuideBot) GuideBot.bind(document.getElementById("guide-bot"));

  let meId = null;
  let state = null;
  let input = { dx: 0, dy: 0 };

  function sfxCam() {
    if (!state) return null;
    if (state.follow && state.follow.x != null) return state.follow;
    const list = state.players || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].i === meId) return list[i];
    }
    return null;
  }

  function playSfx(f) {
    if (window.ShadowSfx) ShadowSfx.fromFx(f, sfxCam());
  }
  let keys = {};
  let recallPulse = 0;
  let mergePulse = 0;
  let dodgePulse = 0;
  let duelPulse = 0;
  let attackHold = 0;
  let playing = false;
  let inMatch = false;
  let lastMode = "br";
  let spectateId = null;
  let room = null;
  let net = null;
  let matchRewarded = false;
  let lastPass = null;

  function collectMyStats(win, alive) {
    const p = room && room.players.get(meId);
    if (p) {
      return {
        kills: p.kills || 0,
        shadows: room.armyOf(meId).length,
        alive: !!alive,
        win: !!win,
        time: room.time || 0,
      };
    }
    const list = (state && state.players) || [];
    let me = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].i === meId) me = list[i];
    }
    const fol = state && state.follow;
    const src = me || fol || {};
    return {
      kills: src.k || 0,
      shadows: src.sh || 0,
      alive: !!alive,
      win: !!win,
      time: (state && state.t) || 0,
    };
  }

  function showDeadPass(pass) {
    const el = document.getElementById("dead-pass");
    if (!el) return;
    if (pass && pass.gain) {
      el.textContent = "+" + pass.gain + " " + t("pts");
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function giveMatchRewards(win, alive) {
    if (matchRewarded) return lastPass;
    matchRewarded = true;
    const stats = collectMyStats(win, alive);
    const p = room && room.players.get(meId);
    if (window.HunterProfile) {
      if (p && !p.isBot) HunterProfile.unlockClasses([p.cls].concat(p.foundClasses || []));
      HunterProfile.recordMatch({ win: !!win });
      HunterProfile.render(document.getElementById("hunter-profile"));
    }
    lastPass = window.StylePass ? StylePass.awardMatch(stats) : null;
    showDeadPass(lastPass);
    return lastPass;
  }

  function showLobby() {
    menu.classList.add("hidden");
    lobby.classList.remove("hidden");
    endEl.classList.add("hidden");
  }

  function applyLobby(data) {
    document.getElementById("lobby-title").textContent =
      data.mode === "raid" ? t("lobbyTitleRaid") : data.mode === "rush" ? t("lobbyTitleRush") : t("lobbyTitleBr");
    document.getElementById("lobby-count").textContent = data.seconds;
    document.getElementById("lobby-list").innerHTML = data.players
      .map((p) => "<li>" + p.name + (p.isBot ? t("botTag") : "") + "</li>")
      .join("");
  }

  function applyStart(data) {
    if (data.you) meId = data.you;
    lobby.classList.add("hidden");
    menu.classList.add("hidden");
    endEl.classList.add("hidden");
    gameEl.classList.remove("hidden");
    playing = true;
    inMatch = true;
    lastMode = data.mode || lastMode;
    matchRewarded = false;
    lastPass = null;
    deadUi.classList.add("hidden");
    spectateId = null;
    showDeadPass(null);
    document.getElementById("boss-bar").classList.add("hidden");
    const malLeg = document.querySelector(".leg-malakor");
    if (malLeg) malLeg.classList.toggle("hidden", lastMode !== "raid");
    if (!shotMode() && renderer && renderer.setZoomMul && !localStorage.getItem("shadowio-zoom-v2")) {
      renderer.setZoomMul(1);
      if (typeof syncZoomButton === "function") syncZoomButton();
    }
    stagePromoShot();
    applyCaptureZoom();
  }

  function shotMode() {
    const q = String(location.search || "");
    if (/[?&]shot=armors(?:&|$)/.test(q)) return "armors";
    if (/[?&]shot=video(?:&|$)/.test(q)) return "video";
    if (/[?&]shot=promo(?:&|$)/.test(q)) return "promo";
    return "";
  }

  function stagePromoShot() {
    const mode = shotMode();
    if (!mode || !room) return;
    const p = room.players.get(meId);
    if (!p || p.__promoShot) return;
    p.__promoShot = 1;
    p.dir = 0.35;
    p.aim = 0.35;
    if (renderer && renderer.setZoomMul) renderer.setZoomMul(2, false);
    if (typeof syncZoomButton === "function") syncZoomButton();
    if (mode === "armors") {
      p.outfit = "abyss_eye";
      p.wep = "saber";
      p.name = p.name || "Julien";
      const lineup = [
        { id: "abyss_ash", name: "Cendre" },
        { id: "abyss_ember", name: "Braise" },
        { id: "abyss_blood", name: "Écarlate" },
        { id: "abyss_gold", name: "Or noir" },
        { id: "divine_dawn", name: "Aube" },
        { id: "divine_system", name: "Système" },
        { id: "divine_monarch", name: "Céleste" },
      ];
      const bots = [...room.players.values()].filter(function (h) { return h.isBot && h.alive && h !== p; });
      lineup.forEach(function (arm, i) {
        const h = bots[i];
        if (!h) return;
        h.x = p.x + (i - 3) * 108;
        h.y = p.y + (i % 2 ? 74 : -68);
        h.outfit = arm.id;
        h.name = arm.name;
        h.wep = "saber";
        h.dir = Math.atan2(p.y - h.y, p.x - h.x);
        h.aim = h.dir;
        h.isBot = false;
        h.bot = null;
        h.vx = 0;
        h.vy = 0;
        h.level = 8 + i;
      });
      bots.forEach(function (h, i) {
        if (i < lineup.length) return;
        h.x = p.x + 5000 + (i % 8) * 80;
        h.y = p.y + 5000;
      });
      return;
    }
    if (typeof room.arise !== "function") return;
    p.wep = "laser";
    p.armyStance = "guard";
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.5;
      const id = "promo-chest-" + i;
      room.loots.set(id, { id: id, kind: "chest", cls: "chest", x: p.x + Math.cos(a) * 155, y: p.y + Math.sin(a) * 125 });
    }
    const types = ["wolf", "knight", "goblin", "wraith", "beetle", "wolf"];
    types.forEach(function (typ, i) {
      const a = (i / types.length) * Math.PI * 2;
      room.arise(p, {
        x: p.x + Math.cos(a) * 86,
        y: p.y + Math.sin(a) * 86,
        typ: typ,
        maxHp: 90,
        hp: 90,
        atk: 8,
        r: typ === "knight" ? 20 : 16,
        name: typ,
        behavior: "chase",
        elite: 0,
        level: 5,
      });
    });
    room.possessHunter(p, {
      x: p.x + 52,
      y: p.y - 36,
      cls: "tank",
      maxHp: 180,
      atk: 12,
      range: 90,
      cd: 0.5,
      armor: 0,
      name: "Ombre",
      speed: 140,
      dir: 0.3,
      wep: "laser",
      look: p.look || 0,
      level: 8,
    });
    if (room.laserBeam) room.laserBeam(p, p, { id: "laser", projSpeed: 1100, range: 420 });
    if (mode === "video") {
      p.maxHp = 80000;
      p.hp = 80000;
      p.level = 18;
      p.atk = Math.max(p.atk || 0, 40);
      const boss = room.kind === "raid" ? room.monarch : room.brBoss;
      if (boss && boss.alive) {
        p.x = boss.x + 320;
        p.y = boss.y + 80;
        p.fightBossId = room.kind === "raid" ? "monarch" : (boss.id || "br");
        p.fightBossT = 40;
      }
      if (room.kind === "raid") room.bossAlerted = true;
      for (const l of room.loots.values()) {
        if (l.kind === "chest") {
          l.x = p.x + 120;
          l.y = p.y + 70;
          break;
        }
      }
    }
  }

  function applySys() {}

  function applyBossAlert(info) {
    if (lastMode !== "raid") return;
    const alert = document.getElementById("alert");
    alert.textContent = t("alertBoss", { name: info.name.toUpperCase(), title: (info.title || t("theBoss")).toUpperCase() });
    alert.classList.remove("hidden");
    if (window.ShadowSfx) ShadowSfx.cue("alert", 0.9);
    setTimeout(() => alert.classList.add("hidden"), 4500);
  }

  function applyEnd(payload) {
    playing = false;
    inMatch = false;
    deadUi.classList.add("hidden");
    endEl.classList.remove("hidden");
    const youWin = payload.winner && payload.winner.id === meId;
    if (youWin && window.ShadowSfx) ShadowSfx.cue("win", 1);
    const titles = {
      last: youWin ? t("winLast") : t("loseLast"),
      monarch: youWin ? t("winBoss") : t("loseBoss"),
      wipe: t("wipe"),
    };
    document.getElementById("end-title").textContent = titles[payload.reason] || t("endTitle");
    document.getElementById("end-sub").textContent = payload.winner ? t("winner", { name: payload.winner.name }) : t("noWinner");
    document.getElementById("end-board").innerHTML = (payload.board || [])
      .map((r) => "<li>" + t("boardLine", { name: r.name, lv: r.level, kills: r.kills, sh: r.shadows, dead: r.alive ? "" : " †" }) + "</li>")
      .join("");
    const passEl = document.getElementById("end-pass");
    if (passEl) {
      const pass = payload.pass;
      if (pass && (pass.gain || pass.xp != null)) {
        passEl.classList.remove("hidden");
        const gainEl = document.getElementById("end-pass-gain");
        const rankEl = document.getElementById("end-pass-rank");
        const nextEl = document.getElementById("end-pass-next");
        const bar = document.getElementById("end-pass-bar");
        const fill = document.getElementById("end-pass-fill");
        const unlocks = document.getElementById("end-pass-unlocks");
        if (gainEl) {
          gainEl.textContent = "+" + (pass.gain || 0) + " " + t("pts");
          gainEl.classList.remove("pop");
          void gainEl.offsetWidth;
          gainEl.classList.add("pop");
        }
        if (rankEl) rankEl.textContent = t("passRank", { lv: pass.level, xp: pass.xp });
        if (bar && fill) {
          fill.style.width = "0%";
          window.setTimeout(function () {
            if (window.StylePass && StylePass.playGoldBar) StylePass.playGoldBar(fill, bar, pass);
          }, 180);
        }
        if (nextEl) {
          if (pass.next && !pass.next.max) {
            nextEl.textContent = t("passNext", { name: pass.next.name, xp: pass.xp, need: pass.next.xp });
          } else {
            nextEl.textContent = t("allSkins");
          }
        }
        if (unlocks) {
          unlocks.innerHTML = (pass.fresh || []).map(function (item) {
            return "<li>" + t("passNew", { name: item.name || "skin" }) + "</li>";
          }).join("");
        }
      } else {
        passEl.classList.add("hidden");
      }
    }
  }

  function startLocal(name, mode) {
    room = new GameRoom(mode);
    meId = "local-" + Math.random().toString(36).slice(2, 8);
    room.on("lobby", applyLobby);
    room.on("sys", applySys);
    room.on("fx", (f) => {
      renderer.addFx(f);
      playSfx(f);
    });
    room.on("impact", (d) => { if (d && d.id === meId) renderer.impact(d); });
    room.on("start", (d) => applyStart({ ...d, you: meId }));
    room.on("bossAlert", applyBossAlert);
    room.on("end", (payload) => {
      const p = room.players.get(meId);
      if (p && !p.isBot) {
        if (window.HunterProfile) {
          HunterProfile.unlockClasses([p.cls].concat(p.foundClasses || []));
        }
        const win = !!(payload.winner && payload.winner.id === meId);
        payload.pass = giveMatchRewards(win, !!p.alive);
      }
      applyEnd(payload);
    });
    room.on("frame", () => {
      const viewer = room.players.get(meId);
      state = room.snapshotFor(viewer || { x: room.barrierCx, y: room.barrierCy, id: meId });
      updateHud(state);
    });
    if (shotMode()) room.lobbyLeft = 0.08;
    room.addPlayer(meId, name, false, (window.StylePass && StylePass.equipped()) || {}, (window.HunterProfile && HunterProfile.startClass()) || "novice");
  }

  function startOnline(name, mode, socket) {
    net = socket;
    socket.send(
      JSON.stringify({
        t: "join",
        name: name,
        mode: mode,
        cosmetics: (window.StylePass && StylePass.equipped()) || {},
        startClass: (window.HunterProfile && HunterProfile.startClass()) || "novice",
      })
    );
    socket.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      if (!msg || !msg.t) return;
      if (msg.t === "hello" && msg.you) meId = msg.you;
      if (msg.t === "lobby") applyLobby(msg);
      if (msg.t === "start") applyStart(msg);
      if (msg.t === "state") {
        state = msg.s;
        if (msg.s && msg.s.you) meId = msg.s.you;
        updateHud(msg.s);
      }
      if (msg.t === "fx") {
        renderer.addFx(msg.f);
        playSfx(msg.f);
      }
      if (msg.t === "impact" && msg.d && msg.d.id === meId) renderer.impact(msg.d);
      if (msg.t === "sys") applySys(msg.row);
      if (msg.t === "bossAlert") applyBossAlert(msg.info);
      if (msg.t === "end") {
        const payload = msg.payload || {};
        const stats = msg.youStats;
        const win = !!(stats && stats.win) || !!(payload.winner && payload.winner.id === meId);
        const alive = !!(stats && stats.alive);
        payload.pass = giveMatchRewards(win, alive);
        applyEnd(payload);
      }
      if (msg.t === "err") {
        document.getElementById("lobby-title").textContent = msg.m || t("lobbyFail");
      }
    };
    socket.onclose = () => {
      if (inMatch || room) return;
      if (endEl && !endEl.classList.contains("hidden")) return;
      net = null;
      startLocal(name, mode);
    };
  }

  function join(mode) {
    const name = (nameInput.value || (window.HunterProfile && HunterProfile.get().name) || "Chasseur").trim().slice(0, 16);
    if (window.HunterProfile) HunterProfile.setName(name);
    else localStorage.setItem("shadowio-name", name);
    lastMode = mode;
    showLobby();
    const qs = new URLSearchParams(location.search || "");
    function wsUrl() {
      let custom = (qs.get("ws") || "").trim();
      if (!custom && window.GAME_CONFIG && GAME_CONFIG.ONLINE_WS) custom = String(GAME_CONFIG.ONLINE_WS).trim();
      if (custom) {
        if (!/^wss?:\/\//i.test(custom)) custom = "wss://" + custom.replace(/^\/+/, "");
        if (!/\/ws$/i.test(custom)) custom = custom.replace(/\/$/, "") + "/ws";
        return custom;
      }
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      return proto + "//" + location.host + "/ws";
    }
    const offlineFile = location.protocol === "file:" || /android_asset/i.test(location.href);
    const forceLocal = qs.get("local") === "1";
    const tryOnline = !offlineFile && !forceLocal;
    if (!tryOnline) {
      startLocal(name, mode);
      return;
    }
    let socket;
    try {
      socket = new WebSocket(wsUrl());
    } catch (e) {
      startLocal(name, mode);
      return;
    }
    const fallback = setTimeout(() => {
      try {
        socket.close();
      } catch (e) {}
      if (!net) startLocal(name, mode);
    }, 1600);
    socket.onopen = () => {
      clearTimeout(fallback);
      startOnline(name, mode, socket);
    };
    socket.onerror = () => {
      clearTimeout(fallback);
      try {
        socket.close();
      } catch (e) {}
      if (!net) startLocal(name, mode);
    };
  }

  document.querySelectorAll(".mode-card").forEach((btn) => {
    btn.addEventListener("click", () => join(btn.dataset.mode));
  });

  document.getElementById("btn-menu").addEventListener("click", () => {
    giveMatchRewards(false, false);
    location.reload();
  });
  const deadMenu = document.getElementById("btn-dead-menu");
  if (deadMenu) deadMenu.addEventListener("click", () => {
    giveMatchRewards(false, false);
    location.reload();
  });
  function replaySameMode() {
    giveMatchRewards(false, false);
    localStorage.setItem("shadowio-autostart", lastMode);
    location.reload();
  }
  document.getElementById("btn-restart").addEventListener("click", replaySameMode);
  const endRestart = document.getElementById("btn-end-restart");
  if (endRestart) endRestart.addEventListener("click", replaySameMode);

  const auto = localStorage.getItem("shadowio-autostart");
  if (auto) {
    localStorage.removeItem("shadowio-autostart");
    setTimeout(() => join(auto), 80);
  } else {
    const bootMode = /[?&]mode=(br|raid|rush)/.exec(String(location.search || ""));
    if (bootMode && (shotMode() === "video" || /[?&]local=1(?:&|$)/.test(String(location.search || "")))) {
      setTimeout(function () { join(bootMode[1]); }, 100);
    }
  }

  function cycleSpec(dir) {
    const dots = (state && state.dots) || [];
    if (!dots.length) return;
    let idx = dots.findIndex((p) => p.i === spectateId);
    if (idx < 0) idx = 0;
    spectateId = dots[(idx + dir + dots.length) % dots.length].i;
    sendNow();
  }

  document.getElementById("btn-spec-prev").addEventListener("click", () => cycleSpec(-1));
  document.getElementById("btn-spec-next").addEventListener("click", () => cycleSpec(1));

  function updateHud(s) {
    const me = (s.players || []).find((p) => p.i === meId);
    const watching = !!(s.spectate && s.follow);
    const followId = watching ? s.follow.i : null;
    const target = watching
      ? ((s.players || []).find((p) => p.i === followId) || s.follow)
      : me;
    const titleEl = document.getElementById("sys-title");
    const nameEl = document.getElementById("hud-name");
    if (titleEl) titleEl.textContent = watching ? t("spectate") : t("sysWin");
    if (nameEl) {
      nameEl.classList.toggle("hidden", !watching);
      if (watching) nameEl.textContent = (s.follow.n || t("hunter"));
    }
    if (target) {
      const clsId = target.c || "novice";
      const wepId = target.w || clsId;
      const wep = (GAME_CONFIG.WEAPONS && GAME_CONFIG.WEAPONS[wepId]) || GAME_CONFIG.CLASS[clsId];
      const classLabel = (window.I18n && I18n.cls(clsId)) || clsId;
      const powerA = (window.I18n && I18n.wep(wepId)) || (wep && wep.label) || "";
      const wep2id = target.w2 || (s.follow && s.follow.w2) || "";
      const wep2 = wep2id && GAME_CONFIG.WEAPONS && GAME_CONFIG.WEAPONS[wep2id];
      document.getElementById("hud-class").textContent = t("class") + " : " + classLabel;
      const powerEl = document.getElementById("hud-power");
      if (powerEl) {
        const on = powerA || t("wepNovice");
        if (wep2 && wep2id) {
          powerEl.innerHTML = "<span class=\"wep-on\">" + on + "</span><span class=\"wep-off\">" + t("reserve") + " · " + ((window.I18n && I18n.wep(wep2id)) || wep2.label) + "</span>";
        } else {
          powerEl.innerHTML = "<span class=\"wep-on\">" + on + "</span>";
        }
      }
      document.getElementById("hud-lvl").textContent = t("lv") + " " + (target.lv || 1);
      document.getElementById("hud-army").textContent = t("army") + " : " + (target.sh || 0);
      const hp = Math.max(0, Math.round(target.h || 0));
      const maxHp = Math.max(0, Math.round(target.H || 0));
      document.getElementById("hp-fill").style.width = (maxHp ? (100 * hp) / maxHp : 0) + "%";
      const hpBar = document.getElementById("hp-bar");
      hpBar.style.width = Math.min(280, 110 + (target.bw || 40)) + "px";
      hpBar.style.height = "14px";
      const hpTxt = document.getElementById("hud-hp");
      if (hpTxt) hpTxt.textContent = t("hp") + " " + hp + " / " + maxHp;
      const need = Math.max(1, target.xn || ((target.lv || 1) * 40));
      const xp = Math.max(0, Math.round(target.xp || 0));
      const xpBar = document.getElementById("xp-bar");
      const xpFill = document.getElementById("xp-fill");
      const xpTxt = document.getElementById("hud-xp");
      if (xpBar) {
        xpBar.style.width = hpBar.style.width;
        xpBar.style.height = "8px";
      }
      if (xpFill) xpFill.style.width = Math.min(100, (100 * xp) / need) + "%";
      if (xpTxt) xpTxt.textContent = "XP " + xp + " / " + need;
      document.getElementById("sys-window").style.borderColor = clsId === "assassin" ? "#ff3355" : clsId === "tank" ? "#3da6ff" : clsId === "mage" ? "#c56bff" : "rgba(110, 224, 255, 0.4)";
    }
    const guard = watching ? !!(target && target.st) : !!s.stance;
    document.getElementById("hud-stance").textContent = t("army") + " : " + (guard ? t("guard") : t("hunt"));
    const duelHud = document.getElementById("hud-duel");
    const duelBanner = document.getElementById("duel-banner");
    if (duelHud) {
      if (s.din && s.foe) {
        duelHud.textContent = t("duelVs", { name: s.foe });
        duelHud.classList.remove("hidden");
      } else if (s.ask) {
        duelHud.textContent = t("duelAsk", { name: s.ask.n, t: s.ask.t });
        duelHud.classList.remove("hidden");
      } else if (s.chal) {
        duelHud.textContent = t("duelSent", { name: s.chal.n });
        duelHud.classList.remove("hidden");
      } else {
        duelHud.textContent = "";
        duelHud.classList.add("hidden");
      }
    }
    if (duelBanner) {
      if (s.ask) {
        duelBanner.textContent = t("duelBannerAsk", { name: s.ask.n });
        duelBanner.classList.remove("hidden");
      } else if (s.din && s.foe) {
        duelBanner.textContent = t("duelBanner", { name: s.foe });
        duelBanner.classList.remove("hidden");
      } else {
        duelBanner.classList.add("hidden");
      }
    }
    if (duelBtn) {
      duelBtn.classList.remove("absorb", "ready");
      duelBtn.classList.toggle("ask", !!s.ask);
      duelBtn.innerHTML = t("duel") + "<span>G</span>";
      duelBtn.style.opacity = s.spectate ? "0.25" : "1";
    }
    recallBtn.classList.toggle("guard", !!s.stance);
    recallBtn.innerHTML = s.stance ? t("hunt") + "<span>R</span>" : t("recall") + "<span>R</span>";
    if (mergeBtn) {
      const can = !!s.merge;
      mergeBtn.classList.toggle("ready", can);
      mergeBtn.disabled = !can || !!s.spectate;
    }
    document.getElementById("hud-alive").textContent = s.alive + " / " + s.total;
    const zst = s.zst;
    const zleft = Math.max(0, s.zleft || 0);
    document.getElementById("hud-time").textContent =
      zst === "frozen" || s.frozen
        ? t("zoneFrozen")
        : zst === "delay"
          ? t("zoneDelay", { t: zleft })
          : zst === "hold"
            ? t("zoneHold", { t: zleft })
            : zst === "close"
              ? t("zoneClose", { t: zleft })
              : zst === "final"
                ? t("zoneFinal")
                : t("zone");
    document.getElementById("dead-ui").classList.toggle("hidden", !s.spectate);
    if (inMatch && s.spectate) giveMatchRewards(false, false);
    document.getElementById("joy").style.opacity = s.spectate ? "0.25" : "1";
    recallBtn.style.opacity = s.spectate ? "0.25" : "1";
    if (mergeBtn) mergeBtn.style.opacity = s.spectate ? "0.25" : "1";
    attackBtn.style.opacity = s.spectate ? "0.25" : "1";
    if (dodgeBtn) {
      const inFight = !!s.cbt;
      const sprinting = (s.spt || 0) > 0;
      const sprintReady = !!s.spr;
      dodgeBtn.classList.toggle("sprint", !inFight);
      dodgeBtn.classList.toggle("ready", inFight ? !!s.dodge : (sprintReady || sprinting));
      dodgeBtn.disabled = !!s.spectate;
      dodgeBtn.style.opacity = s.spectate ? "0.25" : "1";
      const verb = dodgeBtn.querySelector("#dodge-verb");
      if (verb) verb.textContent = inFight ? t("dodge") : t("sprint");
      const circ = 289;
      if (!inFight) {
        const max = s.spm || 8;
        const fuel = Math.max(0, s.spf != null ? s.spf : (sprinting ? (s.spt || 0) : (sprintReady ? max : 0)));
        dodgeBtn.style.setProperty("--dodge-off", String(circ * (1 - Math.min(1, fuel / max))));
      } else {
        const max = s.dcm || (GAME_CONFIG && GAME_CONFIG.DODGE_CD) || 4.8;
        const cd = Math.max(0, s.dcd || 0);
        dodgeBtn.style.setProperty("--dodge-off", String(circ * (cd / max)));
      }
    }
    if (s.follow && s.spectate) {
      document.getElementById("spec-name").textContent = s.follow.n || "…";
    }
    const bar = document.getElementById("boss-bar");
    if (bar) {
      const hb = s.hudBoss;
      if (lastMode === "raid" && hb && hb.mal && hb.H) {
        bar.classList.remove("hidden");
        const fill = document.getElementById("boss-fill");
        if (fill) fill.style.width = Math.max(0, Math.min(100, (100 * hb.h) / hb.H)).toFixed(1) + "%";
        const lab = bar.querySelector("span");
        if (lab && hb.n) lab.textContent = String(hb.n).toUpperCase();
      } else {
        bar.classList.add("hidden");
      }
    }
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    const isSpace = e.key === " " || k === " " || k === "spacebar" || e.code === "Space";
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing && (playing || inMatch) && (isSpace || ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))) {
      e.preventDefault();
    }
    if (isSpace && document.activeElement && document.activeElement.blur) {
      const el = document.activeElement;
      if (el.closest && el.closest("#game")) el.blur();
    }
    if (e.repeat) return;
    keys[k] = true;
    if (k === "r") recallPulse = 1;
    if (k === "f") mergePulse = 1;
    if (k === "e" || k === "shift") dodgePulse = 1;
    if (k === "g") duelPulse = 1;
    if (isSpace) attackHold = 1;
    if (state && state.spectate) {
      if (e.key === "[" || k === "arrowleft") cycleSpec(-1);
      if (e.key === "]" || k === "tab" || k === "arrowright") { e.preventDefault(); cycleSpec(1); }
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    const isSpace = e.key === " " || k === " " || k === "spacebar" || e.code === "Space";
    keys[k] = false;
    if (isSpace) {
      e.preventDefault();
      attackHold = 0;
    }
  });

  function keyDir() {
    let dx = 0;
    let dy = 0;
    if (keys["z"] || keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["q"] || keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    return { dx, dy };
  }

  let joyPtr = null;
  let joyOx = 0;
  let joyOy = 0;
  function applyJoy(clientX, clientY) {
    const dx = clientX - joyOx;
    const dy = clientY - joyOy;
    const len = Math.hypot(dx, dy);
    if (len < 14) {
      input.dx = 0;
      input.dy = 0;
      stick.style.transform = "translate(0,0)";
      return;
    }
    input.dx = dx / len;
    input.dy = dy / len;
    const m = Math.min(42, len);
    const a = Math.atan2(dy, dx);
    stick.style.transform = "translate(" + Math.cos(a) * m + "px, " + Math.sin(a) * m + "px)";
  }
  function startJoy(ev) {
    if (joyPtr != null) return;
    joyPtr = ev.pointerId;
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (err) {}
    if (ev.currentTarget === joy) {
      const rect = joy.getBoundingClientRect();
      joyOx = rect.left + rect.width / 2;
      joyOy = rect.top + rect.height / 2;
    } else {
      joyOx = ev.clientX;
      joyOy = ev.clientY;
    }
    applyJoy(ev.clientX, ev.clientY);
    ev.preventDefault();
  }
  function moveJoy(ev) {
    if (joyPtr == null || ev.pointerId !== joyPtr) return;
    applyJoy(ev.clientX, ev.clientY);
    ev.preventDefault();
  }
  function endJoy(ev) {
    if (joyPtr == null || (ev && ev.pointerId !== joyPtr)) return;
    joyPtr = null;
    input.dx = 0;
    input.dy = 0;
    stick.style.transform = "translate(0,0)";
  }
  const touchMove = document.getElementById("touch-move");
  [joy, touchMove].forEach((el) => {
    if (!el) return;
    el.addEventListener("pointerdown", startJoy);
    el.addEventListener("pointermove", moveJoy);
    el.addEventListener("pointerup", endJoy);
    el.addEventListener("pointercancel", endJoy);
  });

  function bindHold(btn, press, release) {
    if (!btn) return;
    let pid = null;
    btn.addEventListener("pointerdown", (ev) => {
      if (btn.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      pid = ev.pointerId;
      try { btn.setPointerCapture(ev.pointerId); } catch (err) {}
      press();
    });
    const end = (ev) => {
      if (pid == null || (ev && ev.pointerId !== pid)) return;
      pid = null;
      if (release) release();
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
  }
  bindHold(attackBtn, () => { attackHold = 1; }, () => { attackHold = 0; });
  recallBtn.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    recallPulse = 1;
  });
  if (mergeBtn) {
    mergeBtn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      mergePulse = 1;
    });
  }
  if (duelBtn) {
    duelBtn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      duelPulse = 1;
    });
  }
  if (dodgeBtn) {
    dodgeBtn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dodgePulse = 1;
    });
  }

  function sendNow() {
    if (!inMatch) return;
    const k = keyDir();
    const send = Math.hypot(k.dx, k.dy) > 0.1 ? k : input;
    const dots = (state && state.dots) || [];
    if (state && state.spectate) {
      if (!spectateId && state.follow && state.follow.i) spectateId = state.follow.i;
    } else if (!state || !state.spectate) {
      spectateId = null;
    }
    const payload = {
      dx: send.dx, dy: send.dy,
      recall: recallPulse,
      merge: mergePulse,
      dodge: dodgePulse,
      duel: duelPulse,
      attack: attackHold,
      spectateId: spectateId,
    };
    recallPulse = 0;
    mergePulse = 0;
    dodgePulse = 0;
    duelPulse = 0;
    if (net && net.readyState === 1) net.send(JSON.stringify(Object.assign({ t: "input" }, payload)));
    else if (room) room.setInput(meId, payload);
  }

  setInterval(sendNow, 50);

  function fsEl() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isMobileUi() {
    return window.matchMedia && window.matchMedia("(pointer: coarse), (max-width: 900px)").matches;
  }

  function syncFsButtons() {
    const on = !!fsEl();
    const a = document.getElementById("btn-fs");
    const b = document.getElementById("btn-fs-menu");
    const mobile = isMobileUi();
    if (a) a.innerHTML = mobile
      ? (on ? t("fsQuit") : t("fs"))
      : (on ? t("fsQuit") + "<span>" + t("fsEsc") + "</span>" : t("fs") + "<span>" + t("fsEsc") + "</span>");
    if (b) b.textContent = mobile ? (on ? t("fsQuit") : t("fs")) : (on ? t("fsQuit") + " (" + t("fsEsc") + ")" : t("fs"));
    document.body.classList.toggle("is-fs", on);
    if (gameEl) gameEl.classList.toggle("is-fs", on);
  }

  async function toggleFullscreen() {
    const root = document.getElementById("game") && !document.getElementById("game").classList.contains("hidden")
      ? document.getElementById("game")
      : document.documentElement;
    try {
      if (fsEl()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (req) await req.call(root, { navigationUI: "hide" });
        else {
          const html = document.documentElement;
          const req2 = html.requestFullscreen || html.webkitRequestFullscreen;
          if (req2) await req2.call(html, { navigationUI: "hide" });
        }
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock("landscape"); } catch (err) {}
        }
      }
    } catch (err) {
      try {
        const html = document.documentElement;
        const req = html.requestFullscreen || html.webkitRequestFullscreen;
        if (req && !fsEl()) await req.call(html, { navigationUI: "hide" });
      } catch (e2) {}
    }
    syncFsButtons();
    if (renderer && renderer.resize) renderer.resize();
  }

  const fsMenu = document.getElementById("btn-fs-menu");
  const fsGame = document.getElementById("btn-fs");
  function onFsClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    toggleFullscreen();
  }
  if (fsMenu) {
    fsMenu.addEventListener("click", onFsClick);
    fsMenu.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  }
  if (fsGame) {
    fsGame.addEventListener("click", onFsClick);
    fsGame.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  }
  document.addEventListener("fullscreenchange", syncFsButtons);
  document.addEventListener("webkitfullscreenchange", syncFsButtons);

  const bgm = document.getElementById("bgm");
  const muteMenu = document.getElementById("btn-mute");
  const muteGame = document.getElementById("btn-mute-game");
  const sfxMenu = document.getElementById("btn-sfx");
  const sfxGame = document.getElementById("btn-sfx-game");
  const MUTE_KEY = "shadowio-mute";
  const SFX_KEY = "shadowio-sfx-mute";
  let musicOn = audioPrefOn(MUTE_KEY);
  let sfxOn = audioPrefOn(SFX_KEY);
  if (localStorage.getItem(MUTE_KEY) == null) localStorage.setItem(MUTE_KEY, "0");
  if (localStorage.getItem(SFX_KEY) == null) localStorage.setItem(SFX_KEY, "0");

  function audioPrefOn(key) {
    const v = localStorage.getItem(key);
    if (v == null || v === "" || v === "0") return true;
    if (v === "1") return false;
    return true;
  }

  function syncMuteButtons() {
    const label = musicOn ? t("musicOn") : t("musicOff");
    if (muteMenu) muteMenu.textContent = label;
    if (muteGame) muteGame.textContent = label;
    const sfxLabel = sfxOn ? t("sfxOn") : t("sfxOff");
    if (sfxMenu) sfxMenu.textContent = sfxLabel;
    if (sfxGame) sfxGame.textContent = sfxLabel;
  }

  function applySfx() {
    if (window.ShadowSfx) ShadowSfx.setEnabled(sfxOn);
    syncMuteButtons();
  }

  function applyMusic() {
    if (!bgm) return;
    bgm.loop = true;
    bgm.volume = 0.24;
    bgm.muted = !musicOn;
    if (musicOn) {
      const play = bgm.play();
      if (play && play.catch) play.catch(function () {});
    } else {
      bgm.pause();
    }
    syncMuteButtons();
  }

  function toggleMusic(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    musicOn = !musicOn;
    localStorage.setItem(MUTE_KEY, musicOn ? "0" : "1");
    applyMusic();
  }

  if (muteMenu) {
    muteMenu.addEventListener("click", toggleMusic);
    muteMenu.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }
  if (muteGame) {
    muteGame.addEventListener("click", toggleMusic);
    muteGame.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }

  function toggleSfx(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    sfxOn = !sfxOn;
    localStorage.setItem(SFX_KEY, sfxOn ? "0" : "1");
    if (window.ShadowSfx) ShadowSfx.unlock();
    applySfx();
  }
  if (sfxMenu) {
    sfxMenu.addEventListener("click", toggleSfx);
    sfxMenu.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }
  if (sfxGame) {
    sfxGame.addEventListener("click", toggleSfx);
    sfxGame.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }
  applySfx();
  applyMusic();
  syncMuteButtons();
  function unlockMusic() {
    applyMusic();
    if (window.ShadowSfx) ShadowSfx.unlock();
    document.removeEventListener("pointerdown", unlockMusic);
    document.removeEventListener("keydown", unlockMusic);
  }
  document.addEventListener("pointerdown", unlockMusic);
  document.addEventListener("keydown", unlockMusic);

  const themeMenu = document.getElementById("btn-theme");
  const themeGame = document.getElementById("btn-theme-game");
  const DECOR_KEY = "shadowio-decor";
  const THEME_KEY = "shadowio-theme";
  const decors = window.SHADOW_DECORS || [];
  function resolveDecorId() {
    const saved = localStorage.getItem(DECOR_KEY);
    const mapped = (window.SHADOW_DECOR_ALIAS && window.SHADOW_DECOR_ALIAS[saved]) || saved;
    if (mapped && window.SHADOW_DECOR_BY_ID && window.SHADOW_DECOR_BY_ID[mapped]) return mapped;
    if (localStorage.getItem(THEME_KEY) === "light") return "clair";
    return "clair";
  }
  let decorId = resolveDecorId();

  function currentDecor() {
    return (typeof shadowDecorOf === "function") ? shadowDecorOf(decorId) : { id: decorId, label: "GIVRE", meta: "#071820" };
  }

  function syncThemeButtons() {
    const d = currentDecor();
    const tag = t("theme") + " : " + d.label;
    if (themeMenu) themeMenu.textContent = tag;
    if (themeGame) themeGame.textContent = tag;
  }

  function applyTheme() {
    document.body.setAttribute("data-decor", decorId);
    document.body.classList.toggle("theme-light", decorId === "clair");
    const meta = document.querySelector('meta[name="theme-color"]');
    const d = currentDecor();
    if (meta) meta.setAttribute("content", d.meta || "#1a120c");
    localStorage.setItem(DECOR_KEY, decorId);
    syncThemeButtons();
  }

  function toggleTheme(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (!decors.length) return;
    const i = Math.max(0, decors.findIndex((x) => x.id === decorId));
    decorId = decors[(i + 1) % decors.length].id;
    localStorage.setItem(DECOR_KEY, decorId);
    applyTheme();
  }

  if (themeMenu) {
    themeMenu.addEventListener("click", toggleTheme);
    themeMenu.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }
  if (themeGame) {
    themeGame.addEventListener("click", toggleTheme);
    themeGame.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }
  applyTheme();

  const langMenu = document.getElementById("btn-lang");
  const langGame = document.getElementById("btn-lang-game");
  function syncLangButtons() {
    const tag = t("lang") + " : " + (window.I18n ? I18n.code() : "FR");
    if (langMenu) langMenu.textContent = tag;
    if (langGame) langGame.textContent = tag;
  }
  function toggleLang(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (window.I18n) I18n.cycle();
  }
  if (langMenu) {
    langMenu.addEventListener("click", toggleLang);
    langMenu.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
  }
  if (langGame) {
    langGame.addEventListener("click", toggleLang);
    langGame.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
  }
  syncLangButtons();
  if (window.I18n) {
    I18n.onChange(function () {
      I18n.applyDom();
      syncLangButtons();
      syncMuteButtons();
      syncFsButtons();
      syncThemeButtons();
      syncZoomButton();
      if (window.HunterProfile) HunterProfile.render(document.getElementById("hunter-profile"));
      if (window.StylePass && passRoot) StylePass.renderPanel(passRoot);
      if (state) updateHud(state);
      if (window.GuideBot && GuideBot.refresh) GuideBot.refresh();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.key === "Escape" && fsEl()) {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  const zoomBtn = document.getElementById("btn-zoom-game");
  const ZOOM_STEPS = (window.Renderer && Renderer.ZOOM_STEPS) || [1, 1.2, 1.4, 2];
  function applyCaptureZoom() {
    const m = /[?&]zoom=([0-9.]+)/.exec(String(location.search || ""));
    if (!m || !renderer || !renderer.setZoomMul) return;
    renderer.setZoomMul(m[1], false);
    syncZoomButton();
  }
  function zoomLabel(n) {
    const s = n === 1 ? "1" : String(n).replace(".", ",");
    return t("zoom", { n: s });
  }
  function syncZoomButton() {
    const n = (renderer && renderer.zoomMul) || 1;
    if (zoomBtn) zoomBtn.textContent = zoomLabel(n);
  }
  function cycleZoom(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.type === "click" && ev.detail === 0) return;
    }
    const cur = (renderer && renderer.zoomMul) || 1;
    const i = Math.max(0, ZOOM_STEPS.indexOf(cur));
    const next = ZOOM_STEPS[(i + 1) % ZOOM_STEPS.length];
    if (renderer && renderer.setZoomMul) renderer.setZoomMul(next);
    syncZoomButton();
    if (zoomBtn && zoomBtn.blur) zoomBtn.blur();
  }
  if (zoomBtn) {
    zoomBtn.addEventListener("click", cycleZoom);
    zoomBtn.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
    });
  }
  syncZoomButton();
  applyCaptureZoom();

  function loop() {
    if (state) renderer.draw(state, meId);
    requestAnimationFrame(loop);
  }
  loop();
})();
