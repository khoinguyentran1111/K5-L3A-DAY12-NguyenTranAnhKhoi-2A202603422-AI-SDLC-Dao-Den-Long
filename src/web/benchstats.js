// Benchmark statistics exactly as defined in Ticket-04 §1 (pure; used by the page and the tests).
//   frames N; avg_fps = 1000·N / Σ dt_i; p1_low_fps = 1000 / mean of the k = max(1, ceil(0.01·N))
//   largest dt; frame_ms_p95 = 95th percentile of dt (nearest-rank, assumption E5).
export function benchStats(dts) {
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const meanWorst = worst.reduce((a, b) => a + b, 0) / k;
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
  const r1 = (v) => Math.round(v * 10) / 10;
  return { frames: N, avg_fps: r1((1000 * N) / sum), p1_low_fps: r1(1000 / meanWorst), frame_ms_p95: Math.round(p95 * 100) / 100 };
}

// Camera of the bench scene (Ticket-04 §1): circle of radius 30 m around (0,0,0) at Y = 15,
// starting at angle 0° = (30, 15, 0), counter-clockwise seen from above (+Y looking down),
// one lap per 15 s. Counter-clockwise from above = positive rotation about +Y (right-hand rule),
// which takes +X towards −Z: position = (30·cos a, 15, −30·sin a), a = 2π·t/15 (assumption E4).
export function benchCamera(tSeconds) {
  const a = (2 * Math.PI * tSeconds) / 15;
  return [30 * Math.cos(a), 15, -30 * Math.sin(a)];
}
