// Procedural audio with WebAudio: night background music + sound effects (no audio files,
// nothing to license). Cosmetic only: lives in src/web and never touches the simulation.
let ctx = null;
let master = null;
let musicBus = null;
let volume = 0.7;
let musicTimer = null;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.32;
  musicBus.connect(master);
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

function tone(freq, { dur = 0.18, type = 'sine', gain = 0.4, delay = 0, slideTo = null, bus = null } = {}) {
  if (!ctx || volume <= 0) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus || master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur, { gain = 0.2, freq = 800, q = 0.7, delay = 0 } = {}) {
  if (!ctx || volume <= 0) return;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// Night music: slow pad chords + sparse pentatonic bells, scheduled in 8-second bars.
const CHORDS = [[220, 261.63, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 329.63]];
const BELLS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
export function startMusic() {
  if (!ctx || musicTimer) return;
  let bar = 0;
  const playBar = () => {
    const chord = CHORDS[bar % CHORDS.length];
    for (const f of chord) tone(f, { dur: 7.5, type: 'sine', gain: 0.12, bus: musicBus });
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.6) tone(BELLS[Math.floor(Math.random() * BELLS.length)], { dur: 1.6, type: 'triangle', gain: 0.06, delay: i * 2 + Math.random() * 0.5, bus: musicBus });
    }
    bar++;
  };
  playBar();
  musicTimer = setInterval(playBar, 8000);
}
export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
export const sfx = {
  pickup: (carried) => tone(PENTA[Math.max(0, Math.min(carried, PENTA.length) - 1)], { dur: 0.16, type: 'triangle', gain: 0.25 }),
  deposit: () => {
    tone(392, { dur: 0.3, gain: 0.3 });
    tone(587.33, { dur: 0.3, gain: 0.2, delay: 0.06 });
  },
  lanternLit: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { dur: 0.7, type: 'triangle', gain: 0.25, delay: i * 0.09 })),
  pulse: () => tone(220, { dur: 0.45, gain: 0.35, slideTo: 880 }),
  hit: () => tone(160, { dur: 0.35, type: 'sawtooth', gain: 0.18, slideTo: 60 }),
  jump: () => tone(330, { dur: 0.14, type: 'triangle', gain: 0.18, slideTo: 520 }),
  dash: () => noise(0.22, { gain: 0.25, freq: 1800, q: 0.9 }),
  shadeSpawn: () => tone(110, { dur: 0.8, gain: 0.2, slideTo: 82 }),
  steal: () => tone(700, { dur: 0.3, type: 'square', gain: 0.08, slideTo: 300 }),
  charm: () => [880, 1174.66, 1567.98].forEach((f, i) => tone(f, { dur: 0.3, type: 'triangle', gain: 0.2, delay: i * 0.05 })),
  countdown: (last) => tone(last ? 1320 : 990, { dur: 0.12, type: 'square', gain: 0.1 }),
  windWarn: () => noise(1.6, { gain: 0.18, freq: 500, q: 0.4 }),
  win: () => [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, { dur: 1.0, type: 'triangle', gain: 0.22, delay: i * 0.14 })),
  lose: () => [392, 329.63, 261.63].forEach((f, i) => tone(f, { dur: 0.7, gain: 0.22, delay: i * 0.22 })),
  ui: () => tone(660, { dur: 0.08, type: 'triangle', gain: 0.12 }),
  refuel: () => [440, 554.37].forEach((f, i) => tone(f, { dur: 0.25, type: 'triangle', gain: 0.2, delay: i * 0.07 })),
  lanternOut: () => tone(392, { dur: 0.9, gain: 0.22, slideTo: 130 }),
  lowFuel: () => [880, 660].forEach((f, i) => tone(f, { dur: 0.16, type: 'square', gain: 0.07, delay: i * 0.18 })),
};
