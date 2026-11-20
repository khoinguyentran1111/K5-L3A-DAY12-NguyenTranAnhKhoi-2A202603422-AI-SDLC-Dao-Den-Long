// Standard maps of Ticket-02 (Phase 2). Pure data + terrain queries, shared by sim and renderer.
// Angles: measured from +X; a point at angle a and radius r is (r·cos a, y, r·sin a)
// (assumption B1: the only reading where tier 1 "z > 0" contains the 20°..160° points).
const rad = (d) => (d * Math.PI) / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;
export const polar = (cx, cz, r, a, y = 0) => [r3(cx + r * Math.cos(rad(a))), y, r3(cz + r * Math.sin(rad(a)))];
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const lanterns = (list) => list.map(([x, y, z], i) => ({ id: `L${i + 1}`, pos: [x, y, z] }));

// Night 3 ramps: straight, 3 m wide, along the radius at 30° and 150°, from r=30 (Y=0) up to r=24 (Y=3).
const RAMPS = [30, 150].map((a) => ({ ux: Math.cos(rad(a)), uz: Math.sin(rad(a)) }));

function ground3(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 8) return 6;
  if (z > 0 && r >= 12 && r <= 24) return 3;
  for (const { ux, uz } of RAMPS) {
    const s = x * ux + z * uz; // along the ramp
    const w = -x * uz + z * ux; // across the ramp
    if (s >= 24 && s <= 30 && Math.abs(w) <= 1.5) return (3 * (30 - s)) / 6;
  }
  return 0;
}

export const NIGHTS = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    durationKey: 'night1_duration_s',
    start: [0, 0, 0],
    lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    motePoints: [...range(8, (i) => polar(0, 0, 12, i * 45)), ...range(16, (i) => polar(0, 0, 33, i * 22.5))],
    shadePoints: range(12, (i) => polar(0, 0, 37, 15 + i * 30)),
    shadeInterval: 480,
    shadeMax: 6,
    shadeSpeed: null, // = tuning.shade_speed
    pads: [],
    charms: [],
    drifters: false,
    wind: false,
    obstacles: [],
    islands: [{ x: 0, z: 0, r: 40 }],
    ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  },
  2: {
    night: 2,
    name: 'Đảo Cau',
    durationKey: 'night2_duration_s',
    start: [0, 0, 0],
    lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    motePoints: [0, 70].flatMap((cx) => [...range(4, (i) => polar(cx, 0, 10, i * 90)), ...range(8, (i) => polar(cx, 0, 22, i * 45))]),
    shadePoints: [0, 70].flatMap((cx) => range(8, (i) => polar(cx, 0, 26, 22.5 + i * 45))),
    shadeInterval: 420,
    shadeMax: 8,
    shadeSpeed: null,
    pads: [
      { pos: [20, 0, 18], target: [70, 0, 0], vy: 14, vh: 24 },
      { pos: [50, 0, -18], target: [0, 0, 0], vy: 14, vh: 24 },
    ],
    charms: [[35, 0, 0]],
    drifters: true,
    wind: false,
    obstacles: [],
    islands: [{ x: 0, z: 0, r: 28 }, { x: 70, z: 0, r: 28 }],
    bridge: { x0: 26, x1: 44, z0: -2, z1: 2 },
    ground: (x, z) =>
      Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && z >= -2 && z <= 2) ? 0 : null,
  },
  3: {
    night: 3,
    name: 'Đảo Chuông',
    durationKey: 'night3_duration_s',
    start: [0, 0, -30], // assumption B2: (0,0,0) is inside the bell tower
    lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    motePoints: [
      ...range(18, (i) => polar(0, 0, 34, i * 20, 0)),
      ...range(8, (i) => polar(0, 0, 18, 20 + i * 20, 3)),
      ...range(4, (i) => polar(0, 0, 5, 45 + i * 90, 6)),
    ],
    shadePoints: range(16, (i) => polar(0, 0, 43, i * 22.5)),
    shadeInterval: 360,
    shadeMax: 10,
    shadeSpeed: 4.5,
    pads: [{ pos: [0, 3, 13], dir: [0, -1], vy: 12, vh: 8 }],
    charms: [[30, 0, 25], [-30, 0, 25]],
    drifters: true,
    wind: true,
    obstacles: [{ x: 0, z: 0, r: 2, top: 14 }], // bell tower: 8 m tall on tier 2 (Y=6)
    islands: [{ x: 0, z: 0, r: 45 }],
    ramps: [30, 150],
    ground: ground3,
  },
};

export function getNight(n) {
  const m = NIGHTS[n];
  if (!m) throw new Error(`unknown night ${n}`);
  return m;
}

/** Horizontal obstacle test (bell tower). */
export function blockedByObstacle(map, x, z, y) {
  return map.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r && y < o.top);
}
