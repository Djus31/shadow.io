(function (global) {
  const KEY = "shadowio-pass-s1";

  function cfg() {
    return (global.GAME_CONFIG && global.GAME_CONFIG.BATTLE_PASS) || { levels: [], outfits: {}, weapons: {}, trails: {} };
  }

  function blank() {
    return {
      xp: 0,
      unlocked: [],
      eq: { trail: "", outfit: "", weapon: "", spawn: "", shot: "" },
      lastGain: 0,
      lastMatch: null,
    };
  }

  function copyLastMatch(raw) {
    if (!raw || typeof raw !== "object") return null;
    const gain = raw.gain | 0;
    if (!gain) return null;
    return {
      gain: gain,
      before: raw.before | 0,
      xp: raw.xp | 0,
      level: raw.level | 0,
      next: raw.next || null,
      prevNext: raw.prevNext || null,
      fresh: Array.isArray(raw.fresh) ? raw.fresh.slice() : [],
    };
  }

  const OLD_OUTFIT = {
    sauron_ash: "abyss_ash",
    sauron_ember: "abyss_ember",
    sauron_blood: "abyss_blood",
    sauron_gold: "abyss_gold",
    sauron_night: "abyss_night",
    sauron_eye: "abyss_eye",
  };

  function mapOutfitId(id) {
    return OLD_OUTFIT[id] || id;
  }

  function migratePassIds(b) {
    if (!b) return b;
    if (Array.isArray(b.unlocked)) {
      b.unlocked = b.unlocked.map(function (key) {
        const parts = String(key).split(":");
        if (parts.length === 2 && parts[0] === "outfit") return "outfit:" + mapOutfitId(parts[1]);
        return key;
      });
    }
    if (b.eq && b.eq.outfit) b.eq.outfit = mapOutfitId(b.eq.outfit);
    return b;
  }

  function load() {
    if (global.HunterProfile) {
      const p = global.HunterProfile.pass();
      const b = blank();
      b.xp = Math.max(0, p.xp | 0);
      b.unlocked = Array.isArray(p.unlocked) ? p.unlocked.slice() : [];
      if (p.eq && typeof p.eq === "object") {
        b.eq.trail = p.eq.trail || "";
        b.eq.outfit = p.eq.outfit || "";
        b.eq.weapon = p.eq.weapon || "";
        b.eq.spawn = p.eq.spawn || "";
        b.eq.shot = p.eq.shot || "";
      }
      b.lastGain = p.lastGain | 0;
      b.lastMatch = copyLastMatch(p.lastMatch);
      return migratePassIds(b);
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      const b = blank();
      b.xp = Math.max(0, d.xp | 0);
      b.unlocked = Array.isArray(d.unlocked) ? d.unlocked.slice() : [];
      if (d.eq && typeof d.eq === "object") {
        b.eq.trail = d.eq.trail || "";
        b.eq.outfit = d.eq.outfit || "";
        b.eq.weapon = d.eq.weapon || "";
        b.eq.spawn = d.eq.spawn || "";
        b.eq.shot = d.eq.shot || "";
      }
      b.lastGain = d.lastGain | 0;
      b.lastMatch = copyLastMatch(d.lastMatch);
      return migratePassIds(b);
    } catch (e) {
      return blank();
    }
  }

  function save(data) {
    if (global.HunterProfile) {
      global.HunterProfile.setPass(data);
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function levelOf(xp) {
    const levels = cfg().levels || [];
    let lv = 0;
    for (let i = 0; i < levels.length; i++) {
      if (xp >= levels[i].xp) lv = levels[i].lv;
    }
    return lv;
  }

  function nextNeed(xp) {
    const levels = cfg().levels || [];
    for (let i = 0; i < levels.length; i++) {
      if (xp < levels[i].xp) return { lv: levels[i].lv, xp: levels[i].xp, have: xp };
    }
    const last = levels[levels.length - 1];
    return last ? { lv: last.lv, xp: last.xp, have: xp, max: true } : { lv: 0, xp: 0, have: xp, max: true };
  }

  function syncUnlocks(data) {
    const levels = cfg().levels || [];
    const have = {};
    data.unlocked.forEach((id) => { have[id] = true; });
    const fresh = [];
    for (let i = 0; i < levels.length; i++) {
      const t = levels[i];
      const key = t.kind + ":" + t.id;
      if (data.xp >= t.xp && !have[key]) {
        data.unlocked.push(key);
        have[key] = true;
        fresh.push(t);
        if (!data.eq[t.kind]) data.eq[t.kind] = t.id;
      }
    }
    return fresh;
  }

  function isUnlocked(kind, id) {
    const data = load();
    return data.unlocked.indexOf(kind + ":" + id) >= 0;
  }

  function equipped() {
    const data = load();
    return {
      trail: data.eq.trail || "",
      outfit: data.eq.outfit || "",
      weapon: data.eq.weapon || "",
      spawn: "",
      shot: data.eq.shot || "",
    };
  }

  function equip(kind, id) {
    const data = load();
    if (id && !isUnlocked(kind, id)) return data;
    data.eq[kind] = id || "";
    save(data);
    return data;
  }

  function nextGoal(xp) {
    const levels = cfg().levels || [];
    for (let i = 0; i < levels.length; i++) {
      const t = levels[i];
      if (xp < t.xp) {
        return { name: t.name, xp: t.xp, kind: kindLabel(t.kind), lv: t.lv };
      }
    }
    return { name: "", xp: 0, max: true };
  }

  function awardMatch(stats) {
    const data = load();
    const before = Math.max(0, data.xp | 0);
    const prevNext = nextGoal(before);
    const kills = stats.kills || 0;
    const shadows = stats.shadows || 0;
    const minutes = Math.max(0, (stats.time || 0) / 60);
    let gain = 30;
    gain += kills * 12;
    gain += Math.floor(shadows / 2) * 3;
    gain += Math.floor(minutes * 7);
    if (stats.alive) gain += 16;
    if (stats.win) gain += 50;
    gain = Math.max(8, Math.round(gain));
    data.xp += gain;
    data.lastGain = gain;
    const fresh = syncUnlocks(data);
    const next = nextGoal(data.xp);
    data.lastMatch = {
      gain: gain,
      before: before,
      xp: data.xp,
      level: levelOf(data.xp),
      fresh: fresh,
      next: next,
      prevNext: prevNext,
    };
    save(data);
    stashAnim({
      gain: gain,
      before: before,
      xp: data.xp,
      level: levelOf(data.xp),
      fresh: fresh,
      next: next,
      prevNext: prevNext,
    });
    return {
      gain: gain,
      xp: data.xp,
      before: before,
      level: levelOf(data.xp),
      fresh: fresh,
      next: next,
      prevNext: prevNext,
    };
  }

  function wepHex(id) {
    const w = (cfg().weapons && cfg().weapons[id]) || "#5ad4ff";
    return typeof w === "string" ? w : (w.blade || w.core || "#5ad4ff");
  }

  function swatchOf(t) {
    const bp = cfg();
    if (t.kind === "outfit") {
      const o = (bp.outfits && bp.outfits[t.id]) || {};
      return { a: o.coat || "#0c1824", b: o.trim || "#5ad4ff" };
    }
    if (t.kind === "trail") {
      const raw = bp.trails && bp.trails[t.id];
      const c = typeof raw === "string" ? raw : (raw && raw.hex) || "#5ad4ff";
      return { a: "#05070a", b: c };
    }
    if (t.kind === "weapon") {
      return { a: "#141820", b: wepHex(t.id) };
    }
    if (t.kind === "shot") {
      const s = (bp.shots && bp.shots[t.id]) || {};
      return { a: "#08060c", b: s.hex || s.core || "#ff4dff" };
    }
    if (t.id === "rift") return { a: "#081018", b: "#5ad4ff" };
    if (t.id === "arise") return { a: "#180c22", b: "#c56bff" };
    if (t.id === "legend") return { a: "#1c160c", b: "#e7c56a" };
    return { a: "#081018", b: "#5ad4ff" };
  }

  function kindLabel(kind) {
    const t = window.I18n && I18n.t;
    if (kind === "outfit") return t ? t("kindOutfit") : "Armure";
    if (kind === "trail") return t ? t("kindTrail") : "Ombre";
    if (kind === "weapon") return t ? t("kindWeapon") : "Arme";
    if (kind === "shot") return t ? t("kindShot") : "Tir";
    return kind;
  }

  function skinName(kind, id) {
    if (!id) return "";
    const t = (cfg().levels || []).find((x) => x.kind === kind && x.id === id);
    return t ? t.name : id;
  }

  function passLevels() {
    return (cfg().levels || []).filter((t) => t.kind === "outfit" || t.kind === "trail" || t.kind === "weapon" || t.kind === "shot");
  }

  function dummySolo(kind, id) {
    return {
      ou: kind === "outfit" ? id : "",
      ws: kind === "weapon" || kind === "shot" ? id : "",
      tr: kind === "trail" ? id : "",
      sp: "",
      bs: kind === "shot" ? id : "",
      w: "saber",
      n: hunterName(),
      lv: 12,
    };
  }

  let thumbRaf = 0;
  function stopThumbs() {
    if (thumbRaf) cancelAnimationFrame(thumbRaf);
    thumbRaf = 0;
  }
  function paintThumbs() {
    stopThumbs();
    const drawOnce = () => {
      const root = document.getElementById("pass-panel");
      if (!root) return;
      const drawer = peekDrawerOf();
      if (!drawer || !drawer.drawSkinPreview) return;
      const pose = 1.35;
      root.querySelectorAll("canvas.skin-preview").forEach((cv) => {
        const kind = cv.getAttribute("data-kind");
        const id = cv.getAttribute("data-id");
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = Math.max(120, cv.clientWidth || cv.width || 160);
        const cssH = Math.max(140, cv.clientHeight || cv.height || 152);
        cv.width = Math.floor(cssW * dpr);
        cv.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cos = dummySolo(kind, id);
        cos.d = 0.82;
        cos.sw = 0.08;
        cos.mv = 0;
        drawer.drawSkinPreview(ctx, cssW, cssH, pose, cos, { scale: 0.5, cy: 0.64, ox: -8 });
      });
    };
    thumbRaf = requestAnimationFrame(() => {
      thumbRaf = 0;
      drawOnce();
    });
  }

  const KIND_TABS = [
    { id: "outfit", key: "tabOutfit" },
    { id: "trail", key: "tabTrail" },
    { id: "weapon", key: "tabWeapon" },
    { id: "shot", key: "tabShot" },
  ];
  const PAGE_SIZE = 4;
  let catalogKind = "outfit";
  let catalogPage = 0;

  const ANIM_KEY = "shadowio-pass-anim";

  function stashAnim(pass) {
    try {
      sessionStorage.setItem(ANIM_KEY, JSON.stringify(pass));
    } catch (e) {}
  }

  function takeStash() {
    try {
      const raw = sessionStorage.getItem(ANIM_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(ANIM_KEY);
      return copyLastMatch(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function playGoldBar(fill, bar, pass) {
    if (!fill || !pass) return;
    const goal = (pass.next && !pass.next.max && pass.next.xp)
      || (pass.prevNext && !pass.prevNext.max && pass.prevNext.xp)
      || pass.xp
      || 1;
    let from = Math.max(0, Math.min(1, (pass.before || 0) / goal));
    let to = Math.max(0, Math.min(1, (pass.xp || 0) / goal));
    if (to < from) from = 0;
    const old = bar && bar.querySelector(".pass-bar-old");
    if (bar) bar.classList.remove("gold");
    if (old) {
      old.style.left = "0";
      old.style.width = (from * 100).toFixed(2) + "%";
    }
    fill.style.transition = "none";
    fill.style.left = (from * 100).toFixed(2) + "%";
    fill.style.width = "0%";
    const span = Math.max(0, to - from);
    const dur = 1600;
    let t0 = 0;
    function step(now) {
      if (!t0) t0 = now;
      const u = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - u, 3);
      fill.style.width = (span * e * 100).toFixed(2) + "%";
      if (u < 1) requestAnimationFrame(step);
    }
    window.setTimeout(function () {
      requestAnimationFrame(step);
    }, 80);
  }

  function renderPanel(root) {
    if (!root) return;
    const data = load();
    const lv = levelOf(data.xp);
    const nxt = nextNeed(data.xp);
    const frac = nxt.max ? 1 : Math.max(0, Math.min(1, data.xp / nxt.xp));
    const levels = passLevels();
    const nextSkin = levels.find((t) => data.unlocked.indexOf(t.kind + ":" + t.id) < 0);
    if (!KIND_TABS.some((tab) => tab.id === catalogKind)) catalogKind = "outfit";
    const pageItems = levels.filter((t) => t.kind === catalogKind);
    const pages = Math.max(1, Math.ceil(pageItems.length / PAGE_SIZE));
    if (catalogPage >= pages) catalogPage = pages - 1;
    if (catalogPage < 0) catalogPage = 0;
    const slice = pageItems.slice(catalogPage * PAGE_SIZE, catalogPage * PAGE_SIZE + PAGE_SIZE);
    const last = copyLastMatch(data.lastMatch) || takeStash();
    let html = "";
    html += "<p class=\"sys-title\">" + (window.I18n ? I18n.t("skinsUnlock") : "Skins à débloquer") + "</p>";
    if (last) {
      html += "<p class=\"pass-gain-flash\">+" + last.gain + " " + (window.I18n ? I18n.t("pts") : "pts") + "</p>";
    }
    html += "<p class=\"pass-lv\">" + (window.I18n ? I18n.t("rank") : "Rang") + " <strong>" + lv + "</strong> · " + data.xp + " " + (window.I18n ? I18n.t("pts") : "pts") + "</p>";
    html += "<div class=\"pass-bar\"><i class=\"pass-bar-old\" id=\"pass-bar-old\"></i><i class=\"pass-bar-gain\" id=\"pass-bar-fill\"></i></div>";
    html += nextSkin
      ? "<p class=\"pass-next\">" + (window.I18n ? I18n.t("nextSkin") : "Prochain") + " : <em>" + nextSkin.name + "</em> — " + data.xp + " / " + nextSkin.xp + "</p>"
      : "<p class=\"pass-next\">" + (window.I18n ? I18n.t("allSkins") : "Tous les skins sont débloqués.") + "</p>";
    html += "<div class=\"pass-tabs\">";
    KIND_TABS.forEach((tab) => {
      html += "<button type=\"button\" class=\"pass-tab" + (tab.id === catalogKind ? " on" : "") + "\" data-tab=\"" + tab.id + "\">" + ((window.I18n && I18n.t(tab.key)) || tab.id) + "</button>";
    });
    html += "</div>";
    html += "<div class=\"pass-track\">";
    slice.forEach((t) => {
      const key = t.kind + ":" + t.id;
      const on = data.unlocked.indexOf(key) >= 0;
      const eq = data.eq[t.kind] === t.id;
      const isNext = nextSkin && nextSkin.kind === t.kind && nextSkin.id === t.id;
      const status = eq ? (window.I18n ? I18n.t("equipped") : "Équipé") : on ? (window.I18n ? I18n.t("unlocked") : "Débloqué") : (window.I18n ? I18n.t("locked") : "Verrouillé") + " · " + t.xp + " pts";
      html += "<button type=\"button\" class=\"pass-item" + (on ? " on" : " locked") + (eq ? " eq" : "") + (isNext ? " next" : "") + "\" data-kind=\"" + t.kind + "\" data-id=\"" + t.id + "\" data-name=\"" + t.name.replace(/"/g, "") + "\" data-xp=\"" + t.xp + "\" data-on=\"" + (on ? "1" : "0") + "\">";
      html += "<canvas class=\"skin-preview\" data-kind=\"" + t.kind + "\" data-id=\"" + t.id + "\" width=\"200\" height=\"152\"></canvas>";
      html += "<span class=\"pk\">" + kindLabel(t.kind) + " · Lv." + t.lv + "</span>";
      html += "<strong>" + t.name + "</strong>";
      html += "<span class=\"ps\">" + status + "</span>";
      html += "<span class=\"pv\">" + (window.I18n ? I18n.t("preview") : "Aperçu") + "</span>";
      html += "</button>";
    });
    html += "</div>";
    html += "<div class=\"pass-pages\">";
    html += "<button type=\"button\" class=\"pass-page\" id=\"pass-page-prev\"" + (catalogPage <= 0 ? " disabled" : "") + ">◀</button>";
    html += "<span>" + (window.I18n ? I18n.t("page") : "Page") + " " + (catalogPage + 1) + " / " + pages + "</span>";
    html += "<button type=\"button\" class=\"pass-page\" id=\"pass-page-next\"" + (catalogPage >= pages - 1 ? " disabled" : "") + ">▶</button>";
    html += "</div>";
    root.innerHTML = html;
    const fill = root.querySelector("#pass-bar-fill");
    const old = root.querySelector("#pass-bar-old");
    const bar = root.querySelector(".pass-bar");
    let played = false;
    if (last && fill) {
      playGoldBar(fill, bar, last);
      data.lastMatch = null;
      save(data);
      try { sessionStorage.removeItem(ANIM_KEY); } catch (e) {}
      played = true;
    } else if (fill) {
      fill.style.width = "0%";
      if (old) old.style.width = Math.round(frac * 100) + "%";
      else fill.style.width = Math.round(frac * 100) + "%";
    }
    root.querySelectorAll(".pass-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        catalogKind = btn.getAttribute("data-tab") || "outfit";
        catalogPage = 0;
        renderPanel(root);
      });
    });
    const prev = root.querySelector("#pass-page-prev");
    const next = root.querySelector("#pass-page-next");
    if (prev) prev.addEventListener("click", () => { catalogPage -= 1; renderPanel(root); });
    if (next) next.addEventListener("click", () => { catalogPage += 1; renderPanel(root); });
    root.querySelectorAll(".pass-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        openPeek({
          kind: btn.getAttribute("data-kind"),
          id: btn.getAttribute("data-id"),
          name: btn.getAttribute("data-name"),
          xp: +(btn.getAttribute("data-xp") || 0),
          on: btn.getAttribute("data-on") === "1",
        });
      });
    });
    paintThumbs();
    return played;
  }

  let peekRaf = 0;
  let peekKind = "";
  let peekId = "";
  let peekDrawer = null;

  function peekDrawerOf() {
    if (peekDrawer) return peekDrawer;
    if (!global.Renderer) return null;
    peekDrawer = Object.create(global.Renderer.prototype);
    peekDrawer.t = 0;
    peekDrawer.hpAnim = {};
    return peekDrawer;
  }

  function hunterName() {
    if (global.HunterProfile) return (HunterProfile.get().name || "Toi").slice(0, 14);
    return "Toi";
  }

  function dummyCosmetics(kind, id) {
    const eq = equipped();
    const ou = kind === "outfit" ? id : eq.outfit;
    const ws = kind === "weapon" ? id : (kind === "shot" ? (eq.weapon || id) : eq.weapon);
    const tr = kind === "trail" ? id : eq.trail;
    const bs = kind === "shot" ? id : eq.shot;
    return { ou: ou, ws: ws, tr: tr, sp: "", bs: bs, w: "saber", n: hunterName(), lv: 12 };
  }

  function bindPeekOnce() {
    const box = document.getElementById("skin-peek");
    if (!box || box.dataset.bound) return;
    box.dataset.bound = "1";
    const close = () => closePeek();
    const closeBtn = document.getElementById("skin-peek-close");
    const eqBtn = document.getElementById("skin-peek-eq");
    const prevBtn = document.getElementById("skin-peek-prev");
    const nextBtn = document.getElementById("skin-peek-next");
    if (closeBtn) closeBtn.addEventListener("click", close);
    box.addEventListener("click", (e) => {
      if (e.target === box) close();
    });
    if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); cyclePeek(-1); });
    if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); cyclePeek(1); });
    if (eqBtn) {
      eqBtn.addEventListener("click", () => {
        if (!peekKind || !peekId) return;
        if (!isUnlocked(peekKind, peekId)) return;
        const cur = load();
        equip(peekKind, cur.eq[peekKind] === peekId ? "" : peekId);
        const root = document.getElementById("pass-panel");
        renderPanel(root);
        openPeek({
          kind: peekKind,
          id: peekId,
          name: (document.getElementById("skin-peek-title") || {}).textContent || peekId,
          xp: 0,
          on: true,
        });
      });
    }
  }

  function cyclePeek(dir) {
    const levels = passLevels();
    if (!levels.length) return;
    let i = levels.findIndex((t) => t.kind === peekKind && t.id === peekId);
    if (i < 0) i = 0;
    i = (i + dir + levels.length) % levels.length;
    const t = levels[i];
    openPeek({
      kind: t.kind,
      id: t.id,
      name: t.name,
      xp: t.xp,
      on: isUnlocked(t.kind, t.id),
    });
  }

  function closePeek() {
    const box = document.getElementById("skin-peek");
    if (box) box.classList.add("hidden");
    if (peekRaf) cancelAnimationFrame(peekRaf);
    peekRaf = 0;
  }

  function openPeek(info) {
    bindPeekOnce();
    const box = document.getElementById("skin-peek");
    const canvas = document.getElementById("skin-peek-view");
    const title = document.getElementById("skin-peek-title");
    const status = document.getElementById("skin-peek-status");
    const eqBtn = document.getElementById("skin-peek-eq");
    if (!box || !canvas) return;
    peekKind = info.kind;
    peekId = info.id;
    const on = isUnlocked(info.kind, info.id);
    const eqNow = equipped();
    const eq = eqNow[info.kind] === info.id;
    if (title) title.textContent = info.name || info.id;
    const extras = [];
    if (info.kind !== "outfit" && eqNow.outfit) extras.push(skinName("outfit", eqNow.outfit));
    if (info.kind !== "trail" && eqNow.trail) extras.push(skinName("trail", eqNow.trail));
    if (info.kind !== "weapon" && eqNow.weapon) extras.push(skinName("weapon", eqNow.weapon));
    if (info.kind !== "shot" && eqNow.shot) extras.push(skinName("shot", eqNow.shot));
    const extraTxt = extras.length ? (window.I18n ? I18n.t("peekAlso") : " · aussi : ") + extras.join(" + ") : (window.I18n ? I18n.t("peekTogether") : "");
    if (status) {
      status.textContent = on
        ? (eq ? (window.I18n ? I18n.t("peekEq") : "Équipé") : (window.I18n ? I18n.t("peekPrev") : "Aperçu")) + extraTxt
        : (window.I18n ? I18n.t("locked") : "Verrouillé") + " · " + info.xp + " pts" + extraTxt;
    }
    if (eqBtn) {
      eqBtn.disabled = !on;
      eqBtn.textContent = !on
        ? (window.I18n ? I18n.t("locked") : "Verrouillé")
        : eq
          ? (window.I18n ? I18n.t("peekUnequip") : "Retirer seulement ça")
          : (window.I18n ? I18n.t("peekKeep") : "Équiper (garde le reste)");
    }
    box.classList.remove("hidden");
    if (peekRaf) cancelAnimationFrame(peekRaf);
    const ctx = canvas.getContext("2d");
    const loop = () => {
      if (box.classList.contains("hidden")) return;
      const drawer = peekDrawerOf();
      if (drawer && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth || 420;
        const cssH = canvas.clientHeight || 300;
        if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
          canvas.width = Math.floor(cssW * dpr);
          canvas.height = Math.floor(cssH * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = performance.now() / 1000;
        const cos = dummyCosmetics(peekKind, peekId);
        cos.stt = 0;
        drawer.drawSkinPreview(ctx, cssW, cssH, t, cos);
      }
      peekRaf = requestAnimationFrame(loop);
    };
    peekRaf = requestAnimationFrame(loop);
  }

  global.StylePass = {
    load: load,
    equipped: equipped,
    awardMatch: awardMatch,
    renderPanel: renderPanel,
    playGoldBar: playGoldBar,
    levelOf: levelOf,
  };
})(window);
