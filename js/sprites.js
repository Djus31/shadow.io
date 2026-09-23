(function (global) {
  const FILES = {
    hunter: "img/spr-hunter.png",
    wolf: "img/spr-wolf.png",
    goblin: "img/spr-goblin.png",
    beetle: "img/spr-beetle.png",
    wraith: "img/spr-wraith.png",
    knight: "img/spr-knight.png",
    sovereign: "img/spr-sovereign.png",
    texLeather: "img/tex-leather.png",
    texMetal: "img/tex-metal.png",
    texHide: "img/tex-hide.png",
    texChitin: "img/tex-chitin.png",
  };

  const bank = { ready: false, img: {} };
  const keys = Object.keys(FILES);
  let left = keys.length;

  function done() {
    if (left <= 0) bank.ready = true;
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const im = new Image();
    im.decoding = "async";
    im.onload = function () {
      bank.img[key] = im;
      left--;
      done();
    };
    im.onerror = function () {
      left--;
      done();
    };
    im.src = FILES[key];
  }

  global.SpriteBank = bank;
})(window);
