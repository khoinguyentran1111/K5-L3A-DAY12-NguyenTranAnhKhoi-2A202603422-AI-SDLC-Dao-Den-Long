// Player settings (volume, mouse sensitivity) persisted in localStorage between sessions.
// Storage can be unavailable (private mode, blocked site data): every access is guarded.
const KEY = 'dao-den-long.settings.v1';
export const DEFAULTS = Object.freeze({ volume: 0.7, sensitivity: 1.0 });

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      volume: clamp(Number(raw.volume ?? DEFAULTS.volume), 0, 1),
      sensitivity: clamp(Number(raw.sensitivity ?? DEFAULTS.sensitivity), 0.2, 3),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ volume: s.volume, sensitivity: s.sensitivity }));
    return true;
  } catch {
    return false;
  }
}

function clamp(v, a, b) {
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a;
}
