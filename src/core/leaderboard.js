// Local leaderboard rules (Ticket-04 §3), pure and shared by the server (disk file), the
// browser (localStorage fallback) and the tests. No I/O here.
export const LEADERBOARD_SIZE = 10;

// 3–12 characters. Required set: [A-Za-z0-9_]. Bonus (accepted): Vietnamese letters with
// diacritics, i.e. any Unicode letter after NFC normalisation (assumption E7). No spaces.
const NAME_RE = /^[\p{L}\p{N}_]+$/u;

export function normalizeName(raw) {
  return String(raw ?? '').normalize('NFC').trim();
}

/** Returns null when the name is valid, otherwise a Vietnamese error message for the UI. */
export function nameError(raw) {
  const name = normalizeName(raw);
  const len = [...name].length;
  if (len < 3) return 'Tên cần ít nhất 3 ký tự.';
  if (len > 12) return 'Tên tối đa 12 ký tự.';
  if (!NAME_RE.test(name)) return 'Tên chỉ gồm chữ, số và dấu gạch dưới (_), không có khoảng trắng.';
  return null;
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T20:15:03+07:00 (Ticket-04: "có múi giờ"). */
export function isoWithOffset(date = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/** Validates and builds one entry; throws Error with a message when the input is invalid. */
export function makeEntry({ name, score, nights_won, seed, achieved_at }) {
  const err = nameError(name);
  if (err) throw new Error(err);
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be an integer ≥ 0');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0..3');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  const at = achieved_at ?? isoWithOffset();
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(at)) throw new Error('achieved_at must be ISO 8601 with a time zone');
  return { name: normalizeName(name), score, nights_won, achieved_at: at, seed };
}

const instant = (e) => Date.parse(e.achieved_at);

/**
 * Inserts an entry and returns the new top 10: score descending; equal scores -> whoever
 * reached it first (earlier achieved_at) ranks higher; same instant -> the older entry stays
 * above (stable). The input list is not modified.
 */
export function insertEntry(entries, entry) {
  const list = [...entries, entry];
  const order = new Map(list.map((e, i) => [e, i]));
  list.sort((a, b) => b.score - a.score || instant(a) - instant(b) || order.get(a) - order.get(b));
  return list.slice(0, LEADERBOARD_SIZE);
}

/** Re-sorts a list read from storage (defensive: a hand-edited file may be out of order). */
export function sanitize(entries) {
  if (!Array.isArray(entries)) return [];
  let out = [];
  for (const e of entries) {
    try {
      out = insertEntry(out, makeEntry(e));
    } catch {
      /* drop malformed rows */
    }
  }
  return out;
}
