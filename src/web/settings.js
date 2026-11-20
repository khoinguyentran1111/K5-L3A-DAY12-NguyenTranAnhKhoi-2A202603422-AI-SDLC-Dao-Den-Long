// Player settings persisted in localStorage between sessions: volume, mouse sensitivity,
// colour-blind palette (Ticket-03 §6), key bindings, captions, reduced motion, large text
// (Ticket-04 §4). Storage can be unavailable (private mode, blocked site data): every access is
// guarded and the defaults are used.
const KEY = 'dao-den-long.settings.v1';

// Every action of Ticket-04 §4, one key each (KeyboardEvent.code).
export const ACTIONS = Object.freeze([
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác (thắp / châm dầu)'], ['pulse', 'Tỏa Sáng'], ['pause', 'Tạm dừng'],
]);
export const DEFAULT_KEYS = Object.freeze({
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape',
});
// Keys the game already uses for something that cannot be rebound (assumption E9).
export const RESERVED = Object.freeze({ Enter: 'chọn trên các màn hình', ArrowLeft: 'xoay camera', ArrowRight: 'xoay camera' });

export const DEFAULTS = Object.freeze({
  volume: 0.7, sensitivity: 1.0, colorblind: false,
  keys: DEFAULT_KEYS, captions: true, reducedMotion: false, largeText: false,
});

/** Validates a key map; returns a complete map (unknown/duplicate entries fall back to defaults). */
export function cleanKeys(raw) {
  const out = { ...DEFAULT_KEYS };
  if (raw && typeof raw === 'object') {
    for (const [action] of ACTIONS) if (typeof raw[action] === 'string' && raw[action] && !RESERVED[raw[action]]) out[action] = raw[action];
  }
  const seen = new Set();
  for (const [action] of ACTIONS) {
    if (seen.has(out[action])) return { ...DEFAULT_KEYS }; // a corrupted map with duplicates: reset
    seen.add(out[action]);
  }
  return out;
}

/** Who already uses `code`? Returns null (free), {action} (another action) or {reserved: text}. */
export function keyConflict(keys, action, code) {
  if (RESERVED[code]) return { reserved: RESERVED[code] };
  const other = ACTIONS.find(([a]) => a !== action && keys[a] === code);
  return other ? { action: other[0], label: other[1] } : null;
}

/** Human label for a KeyboardEvent.code. */
export function keyLabel(code) {
  if (!code) return '?';
  const named = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
    AltLeft: 'Alt trái', AltRight: 'Alt phải', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', Tab: 'Tab', Backspace: '⌫', CapsLock: 'Caps' };
  if (named[code]) return named[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      volume: clamp(Number(raw.volume ?? DEFAULTS.volume), 0, 1),
      sensitivity: clamp(Number(raw.sensitivity ?? DEFAULTS.sensitivity), 0.2, 3),
      colorblind: raw.colorblind === true,
      keys: cleanKeys(raw.keys),
      captions: raw.captions !== false,
      reducedMotion: raw.reducedMotion === true,
      largeText: raw.largeText === true,
    };
  } catch {
    return { ...DEFAULTS, keys: { ...DEFAULT_KEYS } };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      volume: s.volume, sensitivity: s.sensitivity, colorblind: !!s.colorblind,
      keys: s.keys, captions: !!s.captions, reducedMotion: !!s.reducedMotion, largeText: !!s.largeText,
    }));
    return true;
  } catch {
    return false;
  }
}

function clamp(v, a, b) {
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a;
}
