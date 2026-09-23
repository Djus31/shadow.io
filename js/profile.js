(function (global) {
  const KEY = "shadowio-hunter-profile";
  const LEGACY_NAME = "shadowio-name";
  const LEGACY_PASS = "shadowio-pass-s1";
  const CLASS_IDS = ["novice", "assassin", "tank", "mage"];

  function newId() {
    const a = Math.random().toString(36).slice(2, 6).toUpperCase();
    const b = Math.random().toString(36).slice(2, 6).toUpperCase();
    return "H-" + a + b;
  }

  function blankPass() {
    return {
      xp: 0,
      unlocked: [],
      eq: { trail: "", outfit: "", weapon: "", spawn: "", shot: "" },
      lastGain: 0,
      lastMatch: null,
    };
  }

  function blank() {
    const id = newId();
    return {
      v: 1,
      id: id,
      name: "Chasseur-" + id.slice(-4),
      createdAt: Date.now(),
      lastSeen: Date.now(),
      matches: 0,
      wins: 0,
      classes: ["novice"],
      startClass: "novice",
      pass: blankPass(),
    };
  }

  function uniq(list) {
    const seen = {};
    const out = [];
    (list || []).forEach((id) => {
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(id);
    });
    return out;
  }

  function normalize(raw) {
    const b = blank();
    if (!raw || typeof raw !== "object") return b;
    b.id = typeof raw.id === "string" && raw.id.length >= 4 ? raw.id : b.id;
    b.name = typeof raw.name === "string" ? raw.name.trim().slice(0, 16) : b.name;
    if (!b.name) b.name = "Chasseur-" + b.id.slice(-4);
    b.createdAt = raw.createdAt || b.createdAt;
    b.lastSeen = Date.now();
    b.matches = Math.max(0, raw.matches | 0);
    b.wins = Math.max(0, raw.wins | 0);
    const classes = uniq(["novice"].concat(raw.classes || []));
    b.classes = classes.filter((id) => CLASS_IDS.indexOf(id) >= 0);
    const start = raw.startClass || "novice";
    b.startClass = b.classes.indexOf(start) >= 0 ? start : "novice";
    const p = raw.pass && typeof raw.pass === "object" ? raw.pass : blankPass();
    b.pass.xp = Math.max(0, p.xp | 0);
    b.pass.unlocked = Array.isArray(p.unlocked) ? p.unlocked.slice() : [];
    if (p.eq && typeof p.eq === "object") {
      b.pass.eq.trail = p.eq.trail || "";
      b.pass.eq.outfit = p.eq.outfit || "";
      b.pass.eq.weapon = p.eq.weapon || "";
      b.pass.eq.spawn = p.eq.spawn || "";
      b.pass.eq.shot = p.eq.shot || "";
    }
    b.pass.lastGain = p.lastGain | 0;
    b.pass.lastMatch = p.lastMatch && typeof p.lastMatch === "object" ? p.lastMatch : null;
    return b;
  }

  function migrateLegacy() {
    const d = blank();
    try {
      const name = localStorage.getItem(LEGACY_NAME);
      if (name) d.name = name.trim().slice(0, 16) || d.name;
    } catch (e) {}
    try {
      const raw = localStorage.getItem(LEGACY_PASS);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === "object") {
          d.pass.xp = Math.max(0, p.xp | 0);
          d.pass.unlocked = Array.isArray(p.unlocked) ? p.unlocked.slice() : [];
          if (p.eq && typeof p.eq === "object") {
            d.pass.eq.trail = p.eq.trail || "";
            d.pass.eq.outfit = p.eq.outfit || "";
            d.pass.eq.weapon = p.eq.weapon || "";
            d.pass.eq.spawn = p.eq.spawn || "";
            d.pass.eq.shot = p.eq.shot || "";
          }
          d.pass.lastGain = p.lastGain | 0;
          d.pass.lastMatch = p.lastMatch && typeof p.lastMatch === "object" ? p.lastMatch : null;
        }
      }
    } catch (e) {}
    return d;
  }

  let cache = null;

  function persist(data) {
    cache = data;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      if (data.name) localStorage.setItem(LEGACY_NAME, data.name);
    } catch (e) {}
    return data;
  }

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        cache = normalize(JSON.parse(raw));
        persist(cache);
        return cache;
      }
    } catch (e) {}
    cache = migrateLegacy();
    persist(cache);
    return cache;
  }

  function get() {
    return load();
  }

  function setName(name) {
    const d = load();
    d.name = (name || "").trim().slice(0, 16) || d.name;
    return persist(d);
  }

  function setStartClass(id) {
    const d = load();
    if (CLASS_IDS.indexOf(id) < 0) return d;
    if (d.classes.indexOf(id) < 0) return d;
    d.startClass = id;
    return persist(d);
  }

  function startClass() {
    const d = load();
    return d.classes.indexOf(d.startClass) >= 0 ? d.startClass : "novice";
  }

  function unlockClasses(ids) {
    const d = load();
    let changed = false;
    (ids || []).forEach((id) => {
      if (CLASS_IDS.indexOf(id) < 0) return;
      if (d.classes.indexOf(id) < 0) {
        d.classes.push(id);
        changed = true;
      }
    });
    if (changed) persist(d);
    return d;
  }

  function recordMatch(info) {
    const d = load();
    d.matches += 1;
    if (info && info.win) d.wins += 1;
    d.lastSeen = Date.now();
    return persist(d);
  }

  function pass() {
    return load().pass;
  }

  function setPass(data) {
    const d = load();
    d.pass = data && typeof data === "object" ? data : blankPass();
    return persist(d);
  }

  function toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function fromB64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  function exportPayload() {
    const d = load();
    return {
      v: 1,
      id: d.id,
      name: d.name,
      matches: d.matches | 0,
      wins: d.wins | 0,
      classes: (d.classes || []).slice(),
      startClass: d.startClass || "novice",
      pass: {
        xp: d.pass.xp | 0,
        unlocked: (d.pass.unlocked || []).slice(),
        eq: {
          trail: d.pass.eq.trail || "",
          outfit: d.pass.eq.outfit || "",
          weapon: d.pass.eq.weapon || "",
          spawn: d.pass.eq.spawn || "",
          shot: d.pass.eq.shot || "",
        },
      },
    };
  }

  function exportCode() {
    const json = JSON.stringify(exportPayload());
    return "SIO1." + toB64(json) + "." + hash32(json);
  }

  function importCode(raw) {
    const s = String(raw || "").trim().replace(/\s+/g, "");
    const m = /^SIO1\.([A-Za-z0-9+/=]+)\.([0-9a-f]{8})$/i.exec(s);
    if (!m) return { ok: false, err: "Code invalide." };
    let json;
    try {
      json = fromB64(m[1]);
    } catch (e) {
      return { ok: false, err: "Code illisible." };
    }
    if (hash32(json) !== m[2].toLowerCase()) return { ok: false, err: "Code corrompu." };
    let obj;
    try {
      obj = JSON.parse(json);
    } catch (e) {
      return { ok: false, err: "Code illisible." };
    }
    if (!obj || obj.v !== 1 || typeof obj !== "object") return { ok: false, err: "Code trop ancien." };
    const next = normalize(obj);
    persist(next);
    return { ok: true, data: next };
  }

  function classLabel(id) {
    const cfg = (global.GAME_CONFIG && global.GAME_CONFIG.CLASS) || {};
    return (cfg[id] && cfg[id].label) || id;
  }

  function render(root) {
    if (!root) return;
    const d = load();
    let html = "";
    const matches = Math.max(0, d.matches || 0);
    const wins = Math.max(0, d.wins || 0);
    html += "<ul class=\"profile-stats\"><li><b>" + matches + "</b> " + (window.I18n ? I18n.t("matches") : "parties") + "</li><li><b>" + wins + "</b> " + (window.I18n ? I18n.t("wins") : "Top 1") + "</li></ul>";
    root.innerHTML = html;
  }

  global.HunterProfile = {
    get: get,
    load: load,
    setName: setName,
    setStartClass: setStartClass,
    startClass: startClass,
    unlockClasses: unlockClasses,
    recordMatch: recordMatch,
    pass: pass,
    setPass: setPass,
    exportCode: exportCode,
    importCode: importCode,
    render: render,
  };
})(window);
