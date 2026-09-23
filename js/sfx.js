(function (global) {
  let ctx = null;
  let noise = null;
  let sysWave = null;
  let master = null;
  let enabled = true;
  const MASTER_GAIN = 1.05;
  const nextAt = {};

  function ac() {
    if (ctx) return ctx;
    const C = global.AudioContext || global.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
    const d = n.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      prev = prev * 0.86 + white * 0.14;
      d[i] = prev * 0.72 + white * 0.18;
    }
    noise = n;
    try {
      sysWave = ctx.createPeriodicWave(
        new Float32Array([0, 0.15, 0.55, 0.08, 0.22, 0.04, 0.12, 0.03, 0.06]),
        new Float32Array([0, 0, 0.08, 0.02, 0.18, 0, 0.1, 0, 0.05])
      );
    } catch (e) {
      sysWave = null;
    }
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 1.8;
    comp.attack.value = 0.004;
    comp.release.value = 0.14;
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.168;
    const fb = ctx.createGain();
    fb.gain.value = 0.26;
    const wet = ctx.createGain();
    wet.gain.value = 0.12;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5200;
    lp.Q.value = 0.5;
    master.connect(lp);
    lp.connect(comp);
    comp.connect(ctx.destination);
    comp.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const c = ac();
    if (c && c.state === "suspended") c.resume().catch(function () {});
  }

  function setEnabled(on) {
    enabled = !!on;
    if (master) master.gain.value = enabled ? MASTER_GAIN : 0;
  }

  function isEnabled() {
    return enabled;
  }

  function gate(id, ms) {
    const t = performance.now();
    if (nextAt[id] && t < nextAt[id]) return false;
    nextAt[id] = t + ms;
    return true;
  }

  function env(g, t0, peak, a, hold, rel) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, peak), t0 + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + (hold || 0) + rel);
  }

  function pitch(f) {
    const n = +f;
    if (!n || n < 18) return 18;
    if (n < 90) return Math.max(22, n * 0.9);
    if (n < 400) return n * 0.78;
    return n * 0.62;
  }

  function osc(c, t0, freq, dur, type, peak, slide, dest) {
    const o = c.createOscillator();
    const g = c.createGain();
    if (type === "sys" && sysWave) o.setPeriodicWave(sysWave);
    else o.type = type === "sys" ? "sine" : type || "sine";
    o.frequency.setValueAtTime(pitch(freq), t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(18, pitch(slide)), t0 + dur);
    env(g, t0, peak, 0.01, dur * 0.18, dur);
    o.connect(g);
    g.connect(dest || master);
    o.start(t0);
    o.stop(t0 + dur + 0.08);
    return o;
  }

  function noiseBurst(c, t0, dur, peak, type, freq, q, dest) {
    if (!noise) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = type || "bandpass";
    f.frequency.setValueAtTime(pitch(freq || 1400), t0);
    f.Q.value = q == null ? 1.4 : q;
    const g = c.createGain();
    env(g, t0, peak, 0.006, 0.01, dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || master);
    src.start(t0);
    src.stop(t0 + dur + 0.06);
    return f;
  }

  function sweepNoise(c, t0, dur, peak, type, f0, f1, q, dest) {
    const f = noiseBurst(c, t0, dur, peak, type, f0, q, dest);
    if (f) f.frequency.exponentialRampToValueAtTime(Math.max(40, pitch(f1)), t0 + dur);
    return f;
  }

  function chirp(c, t0, f0, f1, dur, type, peak, dest) {
    osc(c, t0, f0, dur, type, peak, f1, dest);
  }

  function oscBend(c, t0, f0, f1, f2, dur, type, peak, dest) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type === "sys" ? "sine" : type || "sine";
    if (type === "sys" && sysWave) o.setPeriodicWave(sysWave);
    o.frequency.setValueAtTime(Math.max(18, pitch(f0)), t0);
    o.frequency.linearRampToValueAtTime(Math.max(18, pitch(f1)), t0 + dur * 0.42);
    o.frequency.linearRampToValueAtTime(Math.max(18, pitch(f2)), t0 + dur);
    env(g, t0, peak, 0.012, dur * 0.22, dur * 0.85);
    o.connect(g);
    g.connect(dest || master);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }

  function fmOsc(c, t0, car, modHz, depth, dur, type, peak, slide, dest) {
    const carO = c.createOscillator();
    const modO = c.createOscillator();
    const modG = c.createGain();
    const g = c.createGain();
    carO.type = type || "sawtooth";
    modO.type = "sine";
    carO.frequency.setValueAtTime(pitch(car), t0);
    if (slide) carO.frequency.exponentialRampToValueAtTime(Math.max(18, pitch(slide)), t0 + dur);
    modO.frequency.setValueAtTime(pitch(modHz), t0);
    modG.gain.setValueAtTime(Math.max(1, depth), t0);
    modG.gain.exponentialRampToValueAtTime(8, t0 + dur);
    modO.connect(modG);
    modG.connect(carO.frequency);
    env(g, t0, peak, 0.004, dur * 0.1, dur);
    carO.connect(g);
    g.connect(dest || master);
    carO.start(t0);
    modO.start(t0);
    carO.stop(t0 + dur + 0.08);
    modO.stop(t0 + dur + 0.08);
  }

  function distVol(cam, f) {
    if (!cam || cam.x == null || !f || f.x == null) return 0.82;
    const d = Math.hypot((f.x || 0) - cam.x, (f.y || 0) - cam.y);
    if (d > 1650) return 0;
    return Math.max(0, 1 - d / 1650);
  }

  const WEP = {
    novice: 1, katana: 1, scythe: 1, daggers: 1, spear: 1, mace: 1, hammer: 1,
    bow: 1, crossbow: 1, bazooka: 1, saber: 1, laser: 1,
  };

  function parseWep(extra) {
    const s = String(extra || "");
    const parts = s.split("|");
    for (let i = parts.length - 1; i >= 0; i--) {
      const id = parts[i].trim();
      if (WEP[id]) return id;
    }
    if (WEP[s]) return s;
    return "";
  }

  function meleeVar() {
    return Math.random() < 0.5;
  }

  function resBus(c, t0, dur, peak, freq, q, dest) {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(Math.max(40, pitch(freq)), t0);
    bp.Q.value = q == null ? 5.2 : q;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.max(160, pitch(freq) * 2.8), t0);
    lp.Q.value = 1.8;
    const g = c.createGain();
    env(g, t0, peak, 0.012, dur * 0.28, dur);
    bp.connect(lp);
    lp.connect(g);
    g.connect(dest || master);
    return bp;
  }

  function playWeapon(c, t0, v, id) {
    if (id === "laser") {
      v *= 8 / 27;
      noiseBurst(c, t0, 0.012, v * 0.16, "highpass", 2200, 0.45);
      noiseBurst(c, t0, 0.04, v * 0.12, "bandpass", 900, 1.8);
      fmOsc(c, t0, 980, 62, 420, 0.13, "sawtooth", v * 0.2, 160);
      chirp(c, t0, 1180, 210, 0.13, "square", v * 0.22);
      chirp(c, t0 + 0.008, 760, 140, 0.11, "triangle", v * 0.12);
      oscBend(c, t0, 540, 420, 160, 0.14, "sine", v * 0.1);
      osc(c, t0, 90, 0.07, "sine", v * 0.1, 42);
      sweepNoise(c, t0 + 0.015, 0.08, v * 0.08, "bandpass", 1600, 400, 1.1);
    } else if (id === "saber") {
      v *= 2 / 3;
      const a = meleeVar();
      const body = resBus(c, t0, 0.36, 1, a ? 110 : 140, a ? 6.4 : 5.6);
      osc(c, t0, a ? 24 : 30, 0.36, "sine", v * 0.24, a ? 32 : 40);
      osc(c, t0, a ? 48 : 58, 0.32, "sine", v * 0.14, a ? 58 : 70);
      sweepNoise(c, t0, 0.3, v * 0.2, "bandpass", a ? 70 : 95, a ? 520 : 680, 1.2, body);
      sweepNoise(c, t0, 0.28, v * 0.2, "lowpass", a ? 180 : 230, a ? 70 : 90, 0.75);
      oscBend(c, t0, a ? 36 : 44, a ? 58 : 70, a ? 38 : 48, 0.32, "sawtooth", v * 0.2, body);
      oscBend(c, t0, a ? 72 : 88, a ? 108 : 128, a ? 76 : 92, 0.28, "sawtooth", v * 0.1, body);
      oscBend(c, t0, a ? 380 : 460, a ? 560 : 680, a ? 200 : 240, 0.2, "sine", v * 0.04);
      noiseBurst(c, t0 + 0.02, 0.14, v * 0.08, "bandpass", a ? 160 : 200, 5);
    } else if (id === "katana") {
      const a = meleeVar();
      const body = resBus(c, t0, 0.22, 1, a ? 190 : 240, a ? 5.8 : 4.8);
      osc(c, t0, a ? 32 : 40, 0.14, "sine", v * 0.22, a ? 18 : 22);
      osc(c, t0, a ? 64 : 78, 0.12, "sine", v * 0.1, a ? 36 : 44);
      sweepNoise(c, t0, 0.16, v * 0.28, "bandpass", a ? 180 : 240, a ? 1400 : 1800, 1.35, body);
      sweepNoise(c, t0, 0.12, v * 0.2, "lowpass", a ? 420 : 520, a ? 140 : 170, 0.8);
      sweepNoise(c, t0 + 0.02, 0.1, v * 0.14, "highpass", a ? 900 : 1200, a ? 2800 : 3600, 0.55);
      chirp(c, t0 + 0.03, a ? 1680 : 1980, a ? 720 : 880, 0.12, "sine", v * 0.07);
      osc(c, t0 + 0.035, a ? 2100 : 2480, 0.07, "triangle", v * 0.04);
      noiseBurst(c, t0, 0.08, v * 0.1, "bandpass", a ? 210 : 260, 5.2);
    } else if (id === "scythe") {
      if (meleeVar()) {
        sweepNoise(c, t0, 0.24, v * 0.28, "bandpass", 160, 1200, 0.65);
        osc(c, t0, 82, 0.22, "sine", v * 0.24, 32);
        chirp(c, t0 + 0.06, 540, 150, 0.16, "triangle", v * 0.07);
      } else {
        sweepNoise(c, t0, 0.22, v * 0.3, "bandpass", 240, 1800, 0.7);
        osc(c, t0, 110, 0.2, "sine", v * 0.22, 46);
        chirp(c, t0 + 0.05, 820, 220, 0.15, "triangle", v * 0.08);
      }
    } else if (id === "daggers") {
      if (meleeVar()) {
        sweepNoise(c, t0, 0.04, v * 0.24, "highpass", 2200, 7400, 0.45);
        osc(c, t0, 2550, 0.035, "sine", v * 0.055, 1200);
        sweepNoise(c, t0 + 0.048, 0.04, v * 0.22, "highpass", 1800, 6200, 0.45);
        osc(c, t0 + 0.048, 2050, 0.035, "sine", v * 0.05, 980);
      } else {
        sweepNoise(c, t0, 0.045, v * 0.26, "highpass", 1600, 5200, 0.5);
        osc(c, t0, 1680, 0.04, "sine", v * 0.06, 780);
        sweepNoise(c, t0 + 0.052, 0.045, v * 0.23, "highpass", 1400, 4600, 0.5);
        osc(c, t0 + 0.052, 1320, 0.04, "triangle", v * 0.055, 620);
      }
    } else if (id === "spear") {
      if (meleeVar()) {
        sweepNoise(c, t0, 0.13, v * 0.26, "bandpass", 240, 3200, 0.85);
        osc(c, t0, 150, 0.12, "sine", v * 0.17, 60);
        chirp(c, t0 + 0.02, 2100, 520, 0.09, "triangle", v * 0.045);
      } else {
        sweepNoise(c, t0, 0.15, v * 0.28, "bandpass", 180, 2400, 0.95);
        osc(c, t0, 108, 0.14, "sine", v * 0.19, 42);
        chirp(c, t0 + 0.018, 1480, 360, 0.11, "triangle", v * 0.05);
      }
    } else if (id === "mace") {
      if (meleeVar()) {
        osc(c, t0, 42, 0.2, "sine", v * 0.38, 20);
        noiseBurst(c, t0, 0.17, v * 0.32, "lowpass", 340, 0.55);
        noiseBurst(c, t0 + 0.018, 0.07, v * 0.14, "bandpass", 1250, 1.15);
      } else {
        osc(c, t0, 58, 0.18, "sine", v * 0.36, 28);
        noiseBurst(c, t0, 0.15, v * 0.3, "lowpass", 520, 0.6);
        noiseBurst(c, t0 + 0.02, 0.08, v * 0.16, "bandpass", 1680, 1.05);
      }
    } else if (id === "hammer") {
      if (meleeVar()) {
        osc(c, t0, 28, 0.28, "sine", v * 0.44, 16);
        noiseBurst(c, t0, 0.24, v * 0.34, "lowpass", 190, 0.45);
        osc(c, t0 + 0.05, 62, 0.16, "sine", v * 0.2, 28);
        noiseBurst(c, t0 + 0.03, 0.1, v * 0.12, "bandpass", 820, 0.75);
      } else {
        osc(c, t0, 38, 0.26, "sine", v * 0.4, 22);
        noiseBurst(c, t0, 0.22, v * 0.32, "lowpass", 280, 0.5);
        osc(c, t0 + 0.045, 86, 0.14, "sine", v * 0.18, 40);
        noiseBurst(c, t0 + 0.028, 0.11, v * 0.14, "bandpass", 1140, 0.8);
      }
    } else if (id === "bow") {
      chirp(c, t0, 260, 70, 0.09, "triangle", v * 0.18);
      osc(c, t0, 390, 0.045, "sine", v * 0.09, 120);
      sweepNoise(c, t0 + 0.018, 0.15, v * 0.2, "bandpass", 1000, 3600, 0.75);
    } else if (id === "crossbow") {
      noiseBurst(c, t0, 0.025, v * 0.3, "highpass", 2800, 0.65);
      osc(c, t0, 100, 0.06, "square", v * 0.09, 55);
      sweepNoise(c, t0 + 0.02, 0.11, v * 0.17, "bandpass", 800, 2600, 0.95);
      osc(c, t0 + 0.03, 72, 0.1, "sine", v * 0.13, 36);
    } else if (id === "bazooka") {
      osc(c, t0, 34, 0.3, "sine", v * 0.44, 18);
      sweepNoise(c, t0, 0.34, v * 0.3, "lowpass", 260, 55, 0.45);
      sweepNoise(c, t0 + 0.04, 0.28, v * 0.15, "bandpass", 1100, 220, 0.65);
    } else if (meleeVar()) {
      osc(c, t0, 58, 0.09, "sine", v * 0.3, 28);
      noiseBurst(c, t0, 0.07, v * 0.24, "lowpass", 430, 0.6);
      noiseBurst(c, t0, 0.045, v * 0.12, "bandpass", 1050, 1.05);
    } else {
      osc(c, t0, 78, 0.08, "sine", v * 0.28, 38);
      noiseBurst(c, t0, 0.065, v * 0.22, "lowpass", 620, 0.7);
      noiseBurst(c, t0, 0.04, v * 0.13, "bandpass", 1480, 1.1);
    }
  }

  function playHit(c, t0, v, crit) {
    osc(c, t0, crit ? 48 : 58, 0.11, "sine", v * (crit ? 0.4 : 0.28), 28);
    noiseBurst(c, t0, crit ? 0.13 : 0.08, v * (crit ? 0.34 : 0.22), "bandpass", crit ? 1900 : 1200, crit ? 0.8 : 1.3);
    noiseBurst(c, t0, 0.05, v * 0.12, "highpass", 2800, 0.5);
    if (crit) {
      chirp(c, t0, 880, 220, 0.16, "sawtooth", v * 0.08);
      noiseBurst(c, t0 + 0.02, 0.14, v * 0.1, "highpass", 3600, 0.6);
    }
  }

  function playChest(c, t0, v) {
    sweepNoise(c, t0, 1.28, v * 0.09, "bandpass", 220, 680, 0.75);
    osc(c, t0, 62, 1.26, "sine", v * 0.045, 78);
    chirp(c, t0, 140, 310, 1.18, "triangle", v * 0.03);
    const notes = [196, 220, 247, 262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 784];
    let t = 0;
    let i = 0;
    while (t < 1.22) {
      const click = t0 + t;
      const n = notes[(i * 5 + 2) % notes.length];
      const n2 = notes[(i * 3 + 7) % notes.length];
      const p = t / 1.22;
      const tick = v * (0.055 + p * 0.02);
      noiseBurst(c, click, 0.022, tick * 0.85, "highpass", 2100 + (i % 6) * 280, 0.55);
      osc(c, click, 1480 + (i % 4) * 260, 0.028, "square", tick * 0.7);
      osc(c, click, n * 2, 0.05, "triangle", tick);
      osc(c, click, n2, 0.042, "sine", tick * 0.55);
      t += 0.034 + p * p * 0.078;
      i += 1;
    }
    osc(c, t0 + 1.18, 880, 0.09, "sine", v * 0.04, 520);
  }

  function playChestOpen(c, t0, v) {
    noiseBurst(c, t0, 0.08, v * 0.12, "lowpass", 420, 0.65);
    osc(c, t0, 132, 0.14, "triangle", v * 0.09, 70);
    osc(c, t0 + 0.02, 523, 0.2, "sine", v * 0.1);
    osc(c, t0 + 0.1, 784, 0.32, "sine", v * 0.09);
    osc(c, t0 + 0.2, 1046, 0.42, "triangle", v * 0.07);
    osc(c, t0 + 0.28, 1318, 0.5, "sine", v * 0.045);
  }

  function playLoot(c, t0, v) {
    osc(c, t0, 659, 0.1, "sine", v * 0.055);
    osc(c, t0 + 0.05, 880, 0.22, "sine", v * 0.06);
    osc(c, t0 + 0.08, 1318, 0.28, "triangle", v * 0.035);
  }

  function playMega(c, t0, v) {
    osc(c, t0, 65, 1.05, "sine", v * 0.1, 82);
    osc(c, t0, 130, 0.95, "sine", v * 0.07, 164);
    osc(c, t0 + 0.02, 261, 0.85, "sine", v * 0.06);
    osc(c, t0 + 0.08, 523, 0.78, "sine", v * 0.12);
    osc(c, t0 + 0.08, 528, 0.78, "sine", v * 0.05);
    osc(c, t0 + 0.16, 659, 0.88, "sine", v * 0.1);
    osc(c, t0 + 0.24, 784, 0.95, "triangle", v * 0.09);
    osc(c, t0 + 0.32, 1046, 1.02, "sine", v * 0.075);
    osc(c, t0 + 0.4, 1318, 0.95, "sine", v * 0.05);
    osc(c, t0 + 0.5, 1568, 0.85, "triangle", v * 0.035);
    chirp(c, t0, 196, 784, 0.7, "sine", v * 0.07);
    sweepNoise(c, t0, 0.95, v * 0.07, "bandpass", 2200, 6400, 0.55);
    sweepNoise(c, t0 + 0.12, 0.7, v * 0.045, "highpass", 4800, 8200, 0.4);
  }

  function playDeath(c, t0, v) {
    osc(c, t0, 64, 0.4, "sine", v * 0.24, 22);
    noiseBurst(c, t0, 0.24, v * 0.18, "lowpass", 280, 0.6);
    chirp(c, t0 + 0.08, 220, 70, 0.32, "triangle", v * 0.06);
  }

  function playDuel(c, t0, v) {
    chirp(c, t0, 98, 196, 0.2, "sawtooth", v * 0.1);
    osc(c, t0 + 0.12, 147, 0.28, "sine", v * 0.1);
    osc(c, t0 + 0.28, 220, 0.4, "sine", v * 0.08);
    sweepNoise(c, t0, 0.2, v * 0.1, "bandpass", 400, 1600, 1);
  }

  function playDodge(c, t0, v) {
    sweepNoise(c, t0, 0.13, v * 0.18, "bandpass", 700, 3200, 0.7);
    chirp(c, t0, 200, 80, 0.1, "sine", v * 0.04);
  }

  function playSprint(c, t0, v) {
    sweepNoise(c, t0, 0.2, v * 0.16, "bandpass", 280, 1800, 0.65);
    osc(c, t0, 78, 0.14, "sine", v * 0.08, 130);
  }

  function playAlert(c, t0, v) {
    chirp(c, t0, 420, 280, 0.14, "square", v * 0.09);
    chirp(c, t0 + 0.16, 280, 180, 0.18, "square", v * 0.1);
    osc(c, t0 + 0.34, 140, 0.36, "sine", v * 0.12, 80);
  }

  function playRecall(c, t0, v) {
    sweepNoise(c, t0, 0.22, v * 0.16, "bandpass", 2400, 220, 0.85);
    chirp(c, t0, 480, 90, 0.2, "sine", v * 0.08);
  }

  function playFusion(c, t0, v) {
    osc(c, t0, 55, 0.3, "sine", v * 0.2, 100);
    chirp(c, t0 + 0.06, 110, 240, 0.28, "sawtooth", v * 0.1);
    noiseBurst(c, t0, 0.22, v * 0.14, "lowpass", 500, 0.7);
  }

  function playLevel(c, t0, v) {
    osc(c, t0, 392, 0.1, "sine", v * 0.08);
    osc(c, t0 + 0.07, 523, 0.16, "triangle", v * 0.09);
    osc(c, t0 + 0.14, 784, 0.22, "sine", v * 0.07);
  }

  function playGate(c, t0, v) {
    osc(c, t0, 48, 0.26, "sine", v * 0.16, 80);
    sweepNoise(c, t0, 0.28, v * 0.16, "bandpass", 220, 2600, 0.9);
  }

  function playOrb(c, t0, v) {
    osc(c, t0, 740, 0.09, "sine", v * 0.07);
    osc(c, t0 + 0.05, 980, 0.14, "sine", v * 0.06);
    noiseBurst(c, t0, 0.08, v * 0.05, "bandpass", 1800, 2);
  }

  function playTile(c, t0, v, extra) {
    if (/soin|heal/i.test(extra)) {
      osc(c, t0, 523, 0.12, "sine", v * 0.08);
      osc(c, t0 + 0.07, 784, 0.18, "sine", v * 0.07);
      osc(c, t0 + 0.12, 1046, 0.2, "triangle", v * 0.04);
    } else if (/vitesse|speed/i.test(extra)) {
      sweepNoise(c, t0, 0.14, v * 0.14, "bandpass", 900, 3000, 0.75);
      chirp(c, t0, 300, 900, 0.12, "sine", v * 0.05);
    } else {
      osc(c, t0, 98, 0.16, "sine", v * 0.14, 55);
      noiseBurst(c, t0, 0.1, v * 0.1, "lowpass", 360, 0.7);
    }
  }

  function playHunt(c, t0, v) {
    chirp(c, t0, 160, 240, 0.12, "triangle", v * 0.07);
    osc(c, t0 + 0.08, 260, 0.14, "sine", v * 0.05);
  }

  function playWin(c, t0, v) {
    osc(c, t0, 49, 0.65, "sine", v * 0.2, 70);
    osc(c, t0, 196, 0.24, "triangle", v * 0.12);
    osc(c, t0 + 0.14, 247, 0.28, "sine", v * 0.1);
    osc(c, t0 + 0.3, 330, 0.4, "sine", v * 0.11);
    osc(c, t0 + 0.48, 392, 0.55, "triangle", v * 0.09);
    sweepNoise(c, t0 + 0.06, 0.4, v * 0.08, "bandpass", 350, 1600, 0.9);
  }

  function cue(name, vol, extra) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(function () {});
    const t0 = c.currentTime + 0.002;
    const v = Math.max(0, vol == null ? 1 : vol);
    if (v < 0.05) return;
    if (name === "wep") playWeapon(c, t0, Math.min(1.45, v * 1.4), extra);
    else if (name === "hit") playHit(c, t0, Math.min(1.35, v * 1.25), false);
    else if (name === "crit") playHit(c, t0, Math.min(1.4, v * 1.3), true);
    else if (name === "chest") playChest(c, t0, Math.min(1, v * 0.42));
    else if (name === "chestOpen") playChestOpen(c, t0, Math.min(1, v * 0.62));
    else if (name === "loot") playLoot(c, t0, v);
    else if (name === "mega") playMega(c, t0, v);
    else if (name === "death") playDeath(c, t0, v);
    else if (name === "duel") playDuel(c, t0, v);
    else if (name === "dodge") playDodge(c, t0, v);
    else if (name === "sprint") playSprint(c, t0, v);
    else if (name === "alert") playAlert(c, t0, v);
    else if (name === "recall") playRecall(c, t0, v);
    else if (name === "fusion") playFusion(c, t0, v);
    else if (name === "level") playLevel(c, t0, v);
    else if (name === "gate") playGate(c, t0, v);
    else if (name === "orb") playOrb(c, t0, v);
    else if (name === "tile") playTile(c, t0, v, extra || "");
    else if (name === "hunt") playHunt(c, t0, v);
    else if (name === "win") playWin(c, t0, v);
  }

  function fromFx(f, cam) {
    if (!enabled || !f || !f.kind) return;
    const extra = String(f.extra || "");
    const v = distVol(cam, f);
    if (v < 0.06) return;
    const k = f.kind;
    const wep = parseWep(extra);
    if ((k === "slash" || k === "flash") && /duel|defi|défi/i.test(extra)) {
      if (gate("duel", 420)) cue("duel", v);
      return;
    }
    if (k === "swing" || k === "shot" || (k === "flash" && /pulse/i.test(extra))) {
      const id = wep || (k === "flash" ? "laser" : "novice");
      if (gate("wep:" + id, id === "daggers" ? 55 : id === "laser" ? 90 : 95)) cue("wep", v, id);
      return;
    }
    if (k === "slam") {
      if (gate("slam", 160)) cue("wep", v * 0.9, wep || "hammer");
      return;
    }
    if (k === "slash" || k === "orbhit") {
      if (wep) {
        if (gate("wep:" + wep, 95)) cue("wep", v * 0.75, wep);
      } else if (gate("hit", 110)) cue("hit", Math.min(1, v * 1.15));
      return;
    }
    if (k === "crit") {
      if (gate("crit", 150)) cue("crit", v);
      return;
    }
    if (k === "chest") {
      if (extra === "roulette") {
        if (gate("chest", 1280)) cue("chest", v);
      } else if (gate("chestOpen", 320)) cue("chestOpen", v);
      return;
    }
    if (k === "loot") {
      if (gate("loot", 200)) cue("loot", v);
      return;
    }
    if (k === "mega") {
      if (gate("mega", 1100)) cue("mega", v);
      return;
    }
    if (k === "pvp" || k === "monarchDown") {
      if (gate("death", 280)) cue("death", v);
      return;
    }
    if (k === "dodge") {
      if (/sprint/i.test(extra)) {
        if (gate("sprint", 280)) cue("sprint", v * 0.8);
      } else if (gate("dodge", 200)) cue("dodge", v * 0.7);
      return;
    }
    if (k === "recall") {
      if (gate("recall", 220)) cue("recall", v);
      return;
    }
    if (k === "arise") {
      if (/fusion/i.test(extra) && gate("fusion", 400)) cue("fusion", v);
      return;
    }
    if (k === "level") {
      if (gate("level", 350)) cue("level", v);
      return;
    }
    if (k === "gate") {
      if (gate("gate", 450)) cue("gate", v);
      return;
    }
    if (k === "orb") {
      if (gate("orb", 160)) cue("orb", v);
      return;
    }
    if (k === "tile") {
      if (gate("tile", 280)) cue("tile", v, extra);
      return;
    }
    if (k === "hunt") {
      if (gate("hunt", 300)) cue("hunt", v);
    }
  }

  global.ShadowSfx = {
    unlock: unlock,
    cue: cue,
    fromFx: fromFx,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
  };
})(window);
