// Procedural sound effects with WebAudio (no audio assets -> nothing to license).
// Purely cosmetic: lives in src/web only, never touches the simulation.
let ctx = null;
let master = null;
let muted = false;

export function unlockAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

function tone(freq, { dur = 0.18, type = 'sine', gain = 0.4, delay = 0, slideTo = null } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// Pentatonic scale so every pickup sounds pleasant; pitch climbs with carried count.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

export const sfx = {
  pickup(carried) {
    tone(PENTA[Math.min(carried, PENTA.length) - 1] || 880, { dur: 0.16, type: 'triangle', gain: 0.25 });
  },
  deposit() {
    tone(392, { dur: 0.3, type: 'sine', gain: 0.3 });
    tone(587.33, { dur: 0.3, type: 'sine', gain: 0.2, delay: 0.06 });
  },
  lanternLit() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { dur: 0.6, type: 'triangle', gain: 0.25, delay: i * 0.09 }));
  },
  pulse() {
    tone(220, { dur: 0.45, type: 'sine', gain: 0.35, slideTo: 880 });
  },
  hit() {
    tone(160, { dur: 0.35, type: 'sawtooth', gain: 0.18, slideTo: 60 });
  },
  shadeSpawn() {
    tone(110, { dur: 0.7, type: 'sine', gain: 0.18, slideTo: 82 });
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, { dur: 0.9, type: 'triangle', gain: 0.22, delay: i * 0.14 }));
  },
  lose() {
    [392, 329.63, 261.63].forEach((f, i) => tone(f, { dur: 0.6, type: 'sine', gain: 0.22, delay: i * 0.22 }));
  },
};
