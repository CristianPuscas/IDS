/**
 * Sinteza sunetului de motor B48 (4 cilindri în linie, ordine de aprindere 1-3-4-2) — Web Audio, fără fișiere.
 * Fundamentala de aprindere = rpm/60*2 Hz. Bufferele sunt generate procedural și redate în buclă.
 *
 * Profil (din faults.json / finalCheck().sound): { misfireCylinder, roughness, chainRattle, turboWhistle, knock, hiss, noStart }
 */

const FIRING_ORDER = [1, 3, 4, 2];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeProfile(p = {}) {
  const n = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  return {
    misfireCylinder: Number.isInteger(Number(p.misfireCylinder)) ? Number(p.misfireCylinder) : 0,
    roughness: n(p.roughness), chainRattle: n(p.chainRattle), turboWhistle: n(p.turboWhistle),
    knock: n(p.knock), hiss: n(p.hiss), noStart: !!p.noStart
  };
}

function normalize(data, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]));
  if (m > 0) { const k = peak / m; for (let i = 0; i < data.length; i++) data[i] *= k; }
}

/** Buffer de ralanti (buclă perfectă: număr întreg de cicluri). */
export function renderIdleBuffer(ctx, profile, rpm = 800, seed = 7) {
  const p = normalizeProfile(profile);
  const sr = ctx.sampleRate;
  const cycleSec = 120 / rpm;                      // un ciclu în 4 timpi = 2 rotații
  const nCycles = Math.max(4, Math.round(2.0 / cycleSec));
  const len = Math.round(nCycles * cycleSec * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const r = rng(seed);
  const firingHz = rpm / 30;
  const pulseLen = Math.round(0.05 * sr);

  // zumzet continuu al evacuării: armonici ale frecvenței de aprindere (+ jumătate de ordin dacă rateu/asperitate)
  const half = (p.misfireCylinder ? 0.22 : 0) + p.roughness * 0.12;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    d[i] = 0.16 * Math.sin(2 * Math.PI * firingHz * t)
      + 0.08 * Math.sin(2 * Math.PI * 2 * firingHz * t + 0.6)
      + 0.04 * Math.sin(2 * Math.PI * 3 * firingHz * t + 1.1)
      + half * Math.sin(2 * Math.PI * (firingHz / 4) * t)
      + 0.02 * (r() * 2 - 1);
  }
  // impulsuri de ardere
  for (let c = 0; c < nCycles; c++) {
    for (let k = 0; k < 4; k++) {
      const cyl = FIRING_ORDER[k];
      const miss = p.misfireCylinder === cyl;
      const amp = miss ? 0.06 : 1 + (r() - 0.5) * p.roughness * 1.4;
      const jitter = (r() - 0.5) * p.roughness * 0.008;
      const start = Math.round(((c + k / 4) * cycleSec + Math.max(0, jitter + 0.004)) * sr);
      const knockHere = !miss && p.knock > 0 && r() < p.knock * 0.7;
      for (let j = 0; j < pulseLen; j++) {
        const idx = (start + j) % len;
        const t = j / sr;
        const env = Math.exp(-t / 0.011);
        let s = amp * env * (Math.sin(2 * Math.PI * 68 * t) + 0.55 * Math.sin(2 * Math.PI * 136 * t + 0.5) + 0.25 * Math.sin(2 * Math.PI * 220 * t))
          + amp * 0.4 * (r() * 2 - 1) * Math.exp(-t / 0.0035);
        if (knockHere && t > 0.003) s += p.knock * 0.75 * Math.exp(-(t - 0.003) / 0.012) * Math.sin(2 * Math.PI * 5400 * t);
        d[idx] += s;
      }
    }
  }
  // tichete de distribuție (supape) — fine, de înaltă frecvență
  const tickEvery = cycleSec / 8;
  for (let c = 0; c < nCycles * 8; c++) {
    const start = Math.round((c * tickEvery + 0.01) * sr);
    for (let j = 0; j < Math.round(0.004 * sr); j++) {
      const t = j / sr;
      d[(start + j) % len] += 0.05 * Math.exp(-t / 0.0008) * Math.sin(2 * Math.PI * 4200 * t);
    }
  }
  // zornăit de lanț persistent (lanț foarte uzat)
  if (p.chainRattle > 0.4) addRattle(d, sr, 0, len, (p.chainRattle - 0.4) * 0.5, r, len);
  normalize(d, 0.85);
  return buf;
}

function addRattle(d, sr, from, to, amp, r, wrapLen = d.length, decaySec = null) {
  const total = to - from;
  let i = from;
  while (i < to) {
    i += Math.round((0.004 + r() * 0.012) * sr);
    const rel = (i - from) / total;
    const a = amp * (decaySec ? Math.exp(-((i - from) / sr) / decaySec) : 1) * (0.5 + r() * 0.8);
    const f = 2600 + r() * 2400;
    for (let j = 0; j < Math.round(0.006 * sr); j++) {
      const t = j / sr;
      const idx = (i + j) % wrapLen;
      d[idx] += a * Math.exp(-t / 0.0012) * Math.sin(2 * Math.PI * f * t) * (1 - rel * 0.2);
    }
  }
}

/** Demaror: zumzet modulat de compresii; durata în secunde. */
export function renderStarterBuffer(ctx, seconds = 1.2, seed = 3) {
  const sr = ctx.sampleRate;
  const len = Math.round(seconds * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const r = rng(seed);
  const crankRpm = 230;
  const compHz = crankRpm / 30;
  let phase = 0; let phase2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const spin = Math.min(1, t / 0.15);
    const f = 85 * spin + 10;
    phase += f / sr; phase2 += (f * 13.5) / sr;
    const saw = 2 * (phase % 1) - 1;
    const comp = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * compHz * t));
    const fadeOut = Math.min(1, (seconds - t) / 0.08);
    d[i] = fadeOut * spin * (0.45 * saw * comp + 0.12 * Math.sin(2 * Math.PI * phase2) * comp + 0.08 * (r() * 2 - 1));
  }
  // clic de cuplare a pinionului
  for (let j = 0; j < Math.round(0.03 * sr); j++) d[j] += 0.8 * Math.exp(-j / sr / 0.005) * (r() * 2 - 1);
  normalize(d, 0.8);
  return buf;
}

/** Zornăit la pornirea la rece (lanț distribuție / întinzător) — o singură redare, cu stingere. */
export function renderColdRattleBuffer(ctx, amount, seconds = 3.2, seed = 11) {
  const sr = ctx.sampleRate;
  const len = Math.round(seconds * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  addRattle(d, sr, 0, len, 0.6 * amount, rng(seed), len, 1.2);
  return buf;
}

export function renderNoiseBuffer(ctx, seconds = 2) {
  const len = Math.round(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return buf;
}

/**
 * Pornește o „sesiune” de motor: demaror → (dacă pornește) ralanti în buclă cu straturi suplimentare.
 * @returns {{ stop(fade?): void, started: Promise<boolean>, running: boolean }}
 */
export function startEngine(ctx, destination, profile, { rpm = 800, startable = true, duration = null, noise = null } = {}) {
  const p = normalizeProfile(profile);
  const willStart = startable && !p.noStart;
  const now = ctx.currentTime + 0.03;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(destination);
  const nodes = [];
  const handle = { running: true, started: null, stop: () => {} };

  const crankSec = willStart ? 1.15 : 2.8;
  const starter = ctx.createBufferSource();
  starter.buffer = renderStarterBuffer(ctx, crankSec);
  const starterGain = ctx.createGain(); starterGain.gain.value = 0.55;
  starter.connect(starterGain).connect(out);
  starter.start(now);
  nodes.push(starter);

  let resolveStarted;
  handle.started = new Promise((res) => { resolveStarted = res; });

  if (!willStart) {
    starter.onended = () => { resolveStarted(false); handle.running = false; try { out.disconnect(); } catch { /* deja */ } };
    handle.stop = () => { try { starter.stop(); } catch { /* deja oprit */ } };
    return handle;
  }

  const t0 = now + crankSec - 0.12;
  // ralanti
  const idle = ctx.createBufferSource();
  idle.buffer = renderIdleBuffer(ctx, p, rpm);
  idle.loop = true;
  idle.playbackRate.setValueAtTime(1.45, t0);           // turație ridicată la pornire, apoi se stabilizează
  idle.playbackRate.linearRampToValueAtTime(1.15, t0 + 1.2);
  idle.playbackRate.linearRampToValueAtTime(1.0, t0 + 3.0);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.7;
  const idleGain = ctx.createGain();
  idleGain.gain.setValueAtTime(0.0001, t0);
  idleGain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.25);
  idle.connect(lp).connect(idleGain).connect(out);
  idle.start(t0);
  nodes.push(idle);

  if (p.chainRattle > 0) {
    const rattle = ctx.createBufferSource();
    rattle.buffer = renderColdRattleBuffer(ctx, p.chainRattle);
    const g = ctx.createGain(); g.gain.value = 0.9;
    rattle.connect(g).connect(out);
    rattle.start(t0);
    nodes.push(rattle);
  }
  if (p.hiss > 0 && noise) {
    const hs = ctx.createBufferSource(); hs.buffer = noise; hs.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.35 * p.hiss, t0 + 0.6);
    hs.connect(bp).connect(g).connect(out);
    hs.start(t0);
    nodes.push(hs);
  }
  if (p.turboWhistle > 0) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 6900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.8;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 70;
    lfo.connect(lfoGain).connect(osc.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.06 * p.turboWhistle, t0 + 1.5);
    osc.connect(g).connect(out);
    osc.start(t0); lfo.start(t0);
    nodes.push(osc, lfo);
  }
  setTimeout(() => resolveStarted(true), Math.max(0, (t0 - ctx.currentTime) * 1000));

  let stopped = false;
  handle.stop = (fade = 0.35) => {
    if (stopped) return;
    stopped = true;
    handle.running = false;
    const t = ctx.currentTime;
    try {
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value || 1, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      idle.playbackRate.cancelScheduledValues(t);
      idle.playbackRate.setValueAtTime(idle.playbackRate.value, t);
      idle.playbackRate.linearRampToValueAtTime(0.5, t + fade);
    } catch { /* noduri deja oprite */ }
    setTimeout(() => {
      for (const n of nodes) { try { n.stop(); } catch { /* deja */ } }
      try { out.disconnect(); } catch { /* deja */ }
    }, fade * 1000 + 50);
  };
  if (duration) setTimeout(() => handle.stop(0.5), duration * 1000);
  return handle;
}
