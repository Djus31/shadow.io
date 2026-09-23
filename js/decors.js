/** Thèmes UI + couleurs de sol. Map = sol classique uniquement. */
(function (global) {
  const MARRON = {
    id: "marron",
    label: "MARRON",
    meta: "#1a120c",
    canvas: "#1a1410",
    ground: "#2a2218",
    patchA: "#32281c",
    patchB: "#241c14",
    patchC: "#3a3024",
    grid: "rgba(201, 180, 138, 0.16)",
    mini: "#1c1610",
    miniDusk0: "rgba(90, 70, 40, 0.4)",
    miniDusk1: "rgba(18, 12, 8, 0.4)",
    miniGrid: "rgba(201, 180, 138, 0.16)",
    vignette: { a: "transparent", b: "rgba(0, 0, 0, 0.06)", c: "rgba(0, 0, 0, 0.22)", d: "rgba(0, 0, 0, 0.42)" },
    sky: ["#3a2a1c", "#22180e", "#140e08"],
    spot: "rgba(201, 160, 90, 0.22)",
    mist: "rgba(12, 8, 4, 0.72)",
    shadow: "rgba(0, 0, 0, 0.45)",
    ring: "rgba(201, 180, 138, 0.35)",
  };

  const CLAIR = {
    id: "clair",
    label: "CLAIR",
    meta: "#4a5260",
    canvas: "#4a5360",
    ground: "#4e5866",
    patchA: "#5a6472",
    patchB: "#454e5a",
    patchC: "#677280",
    grid: "rgba(90, 212, 255, 0.1)",
    mini: "#3e4754",
    miniDusk0: "rgba(90, 130, 160, 0.35)",
    miniDusk1: "rgba(30, 38, 48, 0.3)",
    miniGrid: "rgba(90, 212, 255, 0.16)",
    vignette: { a: "transparent", b: "rgba(12, 18, 26, 0.08)", c: "rgba(12, 18, 26, 0.18)", d: "rgba(12, 18, 26, 0.32)" },
    sky: ["#6a7584", "#545e6c", "#3e4754"],
    spot: "rgba(180, 210, 230, 0.28)",
    mist: "rgba(40, 48, 58, 0.45)",
    shadow: "rgba(20, 28, 36, 0.35)",
    ring: "rgba(90, 212, 255, 0.28)",
  };

  const GIVRE = {
    id: "givre",
    label: "GIVRE",
    meta: "#071820",
    canvas: "#061018",
    ground: "#163044",
    patchA: "#1c3c54",
    patchB: "#0e2436",
    patchC: "#2a5470",
    grid: "rgba(140, 220, 255, 0.18)",
    mini: "#0c1c26",
    miniDusk0: "rgba(60, 140, 180, 0.4)",
    miniDusk1: "rgba(6, 16, 24, 0.4)",
    miniGrid: "rgba(140, 220, 255, 0.18)",
    vignette: { a: "transparent", b: "rgba(4, 20, 32, 0.1)", c: "rgba(2, 10, 18, 0.28)", d: "rgba(0, 4, 10, 0.5)" },
    sky: ["#1a3e54", "#0c2434", "#061018"],
    spot: "rgba(120, 210, 255, 0.24)",
    mist: "rgba(4, 16, 24, 0.7)",
    shadow: "rgba(0, 8, 16, 0.5)",
    ring: "rgba(140, 220, 255, 0.4)",
  };

  global.SHADOW_DECORS = [GIVRE, MARRON, CLAIR];
  global.SHADOW_DECOR_BY_ID = { givre: GIVRE, marron: MARRON, clair: CLAIR };
  global.SHADOW_DECOR_ALIAS = {
    "archive-marron": "marron",
    "archive-clair": "clair",
    amethyste: "givre",
    braise: "givre",
    mousse: "givre",
  };

  global.shadowDecorOf = function (id) {
    const mapped = global.SHADOW_DECOR_ALIAS[id] || id;
    return global.SHADOW_DECOR_BY_ID[mapped] || MARRON;
  };
})(window);
