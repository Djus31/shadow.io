(function (global) {
  const STOP = {
    le: 1, la: 1, les: 1, un: 1, une: 1, des: 1, du: 1, de: 1, et: 1, ou: 1, a: 1, au: 1, aux: 1,
    est: 1, sont: 1, que: 1, qui: 1, quoi: 1, quel: 1, quelle: 1, quels: 1, quelles: 1,
    comment: 1, pourquoi: 1, pour: 1, faire: 1, je: 1, tu: 1, il: 1, on: 1, me: 1, te: 1,
    ce: 1, cet: 1, cette: 1, ca: 1, avec: 1, dans: 1, sur: 1, plus: 1, moins: 1, tres: 1,
    bien: 1, pas: 1, ne: 1, y: 1, en: 1, mon: 1, ma: 1, mes: 1, ton: 1, ta: 1, tes: 1,
    son: 1, sa: 1, ses: 1, moi: 1, toi: 1, il: 1, elle: 1, nous: 1, vous: 1, ils: 1,
    dun: 1, dune: 1, c: 1, d: 1, l: 1, n: 1, s: 1, si: 1, oui: 1, non: 1, donc: 1,
    alors: 1, aussi: 1, comme: 1, tout: 1, toute: 1, tous: 1, toutes: 1, peu: 1,
    beaucoup: 1, encore: 1, deja: 1, toujours: 1, jamais: 1, ici: 1, la: 1,
    stp: 1, svp: 1, peus: 1, peux: 1, peut: 1, veux: 1, voudrais: 1, dire: 1,
    donne: 1, dis: 1, explique: 1, expliques: 1, parle: 1, parles: 1,
  };

  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(s) {
    return fold(s).split(" ").filter((w) => w.length > 1 && !STOP[w]);
  }

  function cfg() {
    return global.GAME_CONFIG || {};
  }

  function t(k) {
    return window.I18n ? I18n.t(k) : k;
  }

  function progressLine() {
    if (global.StylePass) {
      const d = StylePass.load();
      return "Tes pts Style : " + d.xp + ".";
    }
    return "";
  }

  function hit(q, list) {
    const f = fold(q);
    for (let i = 0; i < list.length; i++) {
      if (f.indexOf(list[i]) >= 0) return true;
    }
    return false;
  }

  function weaponAdvice() {
    return t("gWeapon");
  }

  function listWeapons() {
    return t("gWeps");
  }

  function classAdvice() {
    return t("gClass");
  }

  function FACTS() {
    return [
      {
        tags: ["arme", "armes", "weapon", "sabre", "laser", "pistolet", "bazooka", "katana", "dague", "dagues", "lance", "faux", "masse", "marteau", "arc", "arbalete", "poing", "poings", "coffre", "degat", "dps", "meilleur", "meilleure", "meilleures", "op", "fort", "forte"],
        answer: function (q) {
          if (hit(q, ["liste", "toutes", "quels", "quelles"])) return listWeapons();
          return weaponAdvice();
        },
      },
      {
        tags: ["classe", "classes", "assassin", "tank", "mage", "novice"],
        answer: classAdvice,
      },
      {
        tags: ["commande", "commandes", "clavier", "zqsd", "wasd", "bouger", "deplacer", "attaque", "attaquer", "espace", "esquive", "esquiver", "shift", "touche", "touches", "jouer", "manette", "mobile", "telephone", "stick"],
        answer: function () {
          return t("gKeys");
        },
      },
      {
        tags: ["rappel", "rappeler", "fusion", "fusionner", "armee"],
        answer: function () {
          return t("gArmy");
        },
      },
      {
        tags: ["mode", "modes", "bataille", "royale", "br", "raid", "gagner", "victoire", "vainqueur", "win", "objectif"],
        answer: function () {
          return t("gModes");
        },
      },
      {
        tags: ["malakor", "boss", "monarque", "souverain", "abime"],
        answer: function () {
          return t("gMalakor");
        },
      },
      {
        tags: ["skin", "skins", "pass", "point", "points", "xp", "debloque", "debloquer", "legend", "style", "armure", "armures", "lame", "lames", "tir", "tirs", "catalogue", "equiper", "cosmetic"],
        answer: function () {
          return t("gSkins");
        },
      },
      {
        tags: ["code", "codes", "copier", "coller", "import", "importer", "export", "exporter", "transfert", "trouve", "trouver", "ou"],
        answer: function () {
          return t("gCode");
        },
      },
      {
        tags: ["ombre", "ombres", "arise", "invoque", "invoquer", "monstre", "monstres"],
        answer: function () {
          return t("gShadow");
        },
      },
      {
        tags: ["duel", "1v1", "versus", "affronter"],
        answer: function () {
          return t("gDuel");
        },
      },
      {
        tags: ["zone", "barriere", "cercle", "tempete", "timer", "safe"],
        answer: function () {
          return t("gZone");
        },
      },
      {
        tags: ["theme", "themes", "fond", "fonds", "decor", "marron", "givre", "clair", "couleur"],
        answer: function () {
          return t("gTheme");
        },
      },
      {
        tags: ["emilio", "rudoy", "compositeur", "composer", "insta", "instagram", "credit"],
        answer: function () {
          return t("gMusicBy");
        },
      },
      {
        tags: ["musique", "son", "audio", "mute", "bruit"],
        answer: function () {
          return t("gAudio");
        },
      },
      {
        tags: ["plein", "ecran", "fullscreen"],
        answer: function () {
          return t("gFs");
        },
      },
      {
        tags: ["online", "multi", "multijoueur", "pote", "ami", "amis", "serveur", "lien", "distant", "cloudflare", "netlify"],
        answer: function () {
          return t("gOnline");
        },
      },
      {
        tags: ["mort", "morts", "dead", "spectate", "menu", "recommencer", "retour"],
        answer: function () {
          return t("gDead");
        },
      },
      {
        tags: ["ratio", "profil", "stats", "stat", "compte", "sauvegarde", "victoires"],
        answer: function () {
          const p = progressLine();
          return t("gProfile") + (p ? " " + p : "");
        },
      },
      {
        tags: ["zoom", "zoomer", "camera", "vision", "vue", "x2", "x4", "agrandir"],
        answer: function () {
          return t("gZoom");
        },
      },
      {
        tags: ["orbe", "orbes", "buff", "force", "vitesse", "vie"],
        answer: function () {
          return t("gOrb");
        },
      },
      {
        tags: ["eveil", "cube", "cubes", "mega"],
        answer: function () {
          return t("gMega");
        },
      },
      {
        tags: ["portail", "portails", "gate", "rang"],
        answer: function () {
          return t("gGate");
        },
      },
    ];
  }

  function bluff(q) {
    const words = tokens(q);
    let mot = "le sujet";
    let extra = "Malakor";
    for (let i = 0; i < words.length; i++) {
      if (words[i].length >= mot.length) mot = words[i];
    }
    if (words.length > 1) {
      extra = words[0] === mot ? words[1] : words[0];
    }
    const lines = [t("gMiss")];
    let h = 2166136261;
    const s = fold(q);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return lines[Math.abs(h) % lines.length];
  }

  function overlap(qTokens, tags) {
    let s = 0;
    for (let i = 0; i < qTokens.length; i++) {
      const w = qTokens[i];
      for (let k = 0; k < tags.length; k++) {
        const tag = tags[k];
        if (w === tag) s += 6;
        else if (w.length >= 4 && tag.length >= 4 && (tag.indexOf(w) === 0 || w.indexOf(tag) === 0)) s += 4;
      }
    }
    return s;
  }

  function reply(q) {
    const text = String(q || "").trim();
    if (!text) return "Pose une question.";
    const f = fold(text);
    const qTokens = tokens(text);

    if (/emilio|rudoy|instagram|insta/.test(f) || ((/musique|music|morceau|bgm|compositeur/.test(f)) && /qui|cree|creer|fait|compose|auteur|credit|created|who/.test(f))) {
      return t("gMusicBy");
    }

    if (/meilleur\w*\s+arme|arme\s+meilleur|quelle\s+arme|armes?\s+op/.test(f) || (qTokens.indexOf("arme") >= 0 || qTokens.indexOf("armes") >= 0)) {
      if (hit(text, ["liste", "toutes"])) return listWeapons();
      return weaponAdvice();
    }
    if (/comment\s+jouer|comment\s+on\s+joue|touches?|commandes?/.test(f) && qTokens.indexOf("skin") < 0) {
      return t("gKeys");
    }
    if (/comment\s+gagner|comment\s+win/.test(f)) {
      return t("gModes");
    }

    const facts = FACTS();
    let best = null;
    let bestS = 0;
    for (let i = 0; i < facts.length; i++) {
      const sc = overlap(qTokens, facts[i].tags);
      if (sc > bestS) {
        bestS = sc;
        best = facts[i];
      }
    }
    if (best && bestS >= 4) {
      const out = best.answer(text);
      return typeof out === "function" ? out() : out;
    }
    if (/salut|bonjour|hello|coucou|aide|help/.test(f)) {
      return t("gHi");
    }
    return bluff(text);
  }

  function addLine(log, who, text) {
    const p = document.createElement("p");
    p.className = "guide-line " + who;
    p.textContent = (who === "bot" ? t("guideBot") : t("guideMe")) + text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function bind(root) {
    if (!root) return;
    const log = root.querySelector("#guide-log");
    const input = root.querySelector("#guide-q");
    const send = root.querySelector("#guide-send");
    if (!log || !input || !send) return;

    function ask(raw) {
      const q = String(raw || input.value || "").trim();
      if (!q) return;
      addLine(log, "me", q);
      input.value = "";
      addLine(log, "bot", reply(q));
    }

    send.addEventListener("click", function (ev) {
      ev.preventDefault();
      ask();
    });
    input.addEventListener("keydown", function (ev) {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        ask();
      }
    });
    root.querySelectorAll("[data-guide]").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ask(btn.getAttribute("data-guide"));
      });
    });
    addLine(log, "bot", t("guideHello"));
  }

  function refresh() {
    if (window.I18n) I18n.applyDom();
  }

  global.GuideBot = { reply: reply, bind: bind, refresh: refresh };
})(window);
