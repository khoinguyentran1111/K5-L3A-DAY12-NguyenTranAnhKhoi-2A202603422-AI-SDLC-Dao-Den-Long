// Static 3D scenery of one night, built from the same map data the simulation uses
// (src/core/maps.js), so what you see is exactly where the rules put the ground.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

export function buildWorld(map, tuning) {
  const group = new THREE.Group();
  const grass = mat(PALETTE.grass);
  const sand = mat(PALETTE.sand);
  const wood = mat(PALETTE.wood);

  // cloud sea
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat(PALETTE.cloudSea));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -9;
  group.add(sea);
  const puffMat = mat(PALETTE.cloudSea, { transparent: true, opacity: 0.85, emissive: '#0b2533' });
  let seed = 11 * map.night;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cx = map.night === 2 ? 35 : 0;
  for (let i = 0; i < 36; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 60 + rnd() * 80;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + rnd() * 6, 10, 8), puffMat);
    puff.position.set(cx + r * Math.cos(a), -8 + rnd() * 3, r * Math.sin(a));
    puff.scale.y = 0.4;
    group.add(puff);
  }

  // islands: grass top + sand rim + rocky underside
  for (const isl of map.islands) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(isl.r - 1.2, isl.r - 1.2, 0.2, 72), grass);
    top.position.set(isl.x, -0.1, isl.z);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r, 0.18, 72), sand);
    rim.position.set(isl.x, -0.12, isl.z);
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r * 0.55, 8, 40), mat('#2a2f3f'));
    rock.position.set(isl.x, -4.2, isl.z);
    group.add(top, rim, rock);
  }

  // Night 2: bamboo bridge (no railing)
  if (map.bridge) {
    const b = map.bridge;
    for (let x = b.x0; x < b.x1; x += 0.6) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, b.z1 - b.z0), wood);
      plank.position.set(x + 0.3, -0.06, 0);
      group.add(plank);
    }
    for (const z of [b.z0 + 0.15, b.z1 - 0.15]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, b.x1 - b.x0, 8), mat('#8a7a3a'));
      pole.rotation.z = Math.PI / 2;
      pole.position.set((b.x0 + b.x1) / 2, -0.12, z);
      group.add(pole);
    }
  }

  // Night 3: tiers, ramps, bell tower
  if (map.night === 3) {
    const t1shape = new THREE.Shape();
    t1shape.absarc(0, 0, 24, 0, Math.PI, false);
    t1shape.lineTo(-12, 0);
    t1shape.absarc(0, 0, 12, Math.PI, 0, true);
    t1shape.lineTo(24, 0);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(t1shape, { depth: 3, bevelEnabled: false, curveSegments: 48 }), grass);
    t1.rotation.x = Math.PI / 2; // shape y -> world z, extrusion goes down
    t1.position.y = 3;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), grass);
    t2.position.y = 3;
    group.add(t1, t2);
    for (const a of map.ramps) {
      const rad = (a * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 3), sand);
      ramp.position.set(27 * Math.cos(rad), 1.5 - 0.12, 27 * Math.sin(rad));
      // Euler XYZ = tilt about local Z first, then yaw about Y. Local +X points outwards
      // (r = 30, low end) after the yaw, so a negative tilt lowers the outer end.
      ramp.rotation.set(0, -rad, -Math.atan2(3, 6));
      group.add(ramp);
    }
    for (const o of map.obstacles) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.9, o.r, 8, 24), mat('#8c6d4f'));
      tower.position.set(o.x, 6 + 4, o.z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(o.r * 1.4, 2.2, 24), mat(PALETTE.wood));
      roof.position.set(o.x, 14 + 1.1, o.z);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), mat(PALETTE.gold, { emissive: '#5a4210', side: THREE.DoubleSide }));
      bell.position.set(o.x, 13.2, o.z);
      group.add(tower, roof, bell);
    }
  }

  // jump pads
  for (const pad of map.pads) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 32), mat(PALETTE.gold, { emissive: '#7a5a10' }));
    ring.position.set(pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 24), mat(PALETTE.lanternCore, { emissive: '#7a6a30' }));
    core.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
    group.add(ring, core);
  }

  // decoration (cosmetic): bushes and rocks only on flat open ground, away from gameplay spots
  const bushMat = mat('#24493f');
  const rockMat = mat('#474a5c');
  const avoid = [...map.lanterns.map((l) => l.pos), ...map.pads.map((p) => p.pos), ...map.motePoints, ...map.charms, map.start];
  for (let i = 0; i < 70; i++) {
    const isl = map.islands[i % map.islands.length];
    const a = rnd() * Math.PI * 2;
    const r = 4 + rnd() * (isl.r - 6);
    const x = isl.x + r * Math.cos(a);
    const z = isl.z + r * Math.sin(a);
    if (map.ground(x, z) !== 0 || avoid.some((p) => Math.hypot(p[0] - x, p[2] - z) < 2.5)) continue;
    if (map.night === 3 && map.ground(x + 1.5, z) !== 0) continue;
    const isRock = rnd() < 0.35;
    const m = isRock
      ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.5), rockMat)
      : new THREE.Mesh(new THREE.ConeGeometry(0.5 + rnd() * 0.4, 1.2 + rnd() * 1.2, 7), bushMat);
    m.position.set(x, isRock ? 0.15 : 0.6, z);
    group.add(m);
  }

  // lanterns
  const lanternViews = new Map();
  for (const L of map.lanterns) {
    const v = buildLantern(tuning);
    v.position.set(...L.pos);
    group.add(v);
    lanternViews.set(L.id, v);
  }
  return { group, lanternViews };
}

function buildLantern(tuning) {
  const g = new THREE.Group();
  const wood = mat(PALETTE.wood);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 10), wood);
  post.position.y = 1.5;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 12), wood);
  cap.position.y = 4.35;
  const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.lanternOff, emissive: PALETTE.lanternLit, emissiveIntensity: 0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), bodyMat);
  body.scale.y = 1.25;
  body.position.y = 3.6;
  const coreMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), coreMat);
  core.position.y = 3.6;
  const light = new THREE.PointLight(PALETTE.lanternLit, 0, 22, 1.4);
  light.position.y = 3.6;
  const safe = new THREE.Mesh(
    new THREE.RingGeometry(tuning.safe_radius - 0.12, tuning.safe_radius, 72),
    new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  safe.rotation.x = -Math.PI / 2;
  safe.position.y = 0.04;
  safe.visible = false;
  const pips = [];
  const pipGeo = new THREE.SphereGeometry(0.09, 8, 6);
  for (let i = 0; i < tuning.lantern_cost; i++) {
    const a = (i / tuning.lantern_cost) * Math.PI * 2;
    const pip = new THREE.Mesh(pipGeo, new THREE.MeshBasicMaterial({ color: PALETTE.lanternOff }));
    pip.position.set(Math.sin(a) * 0.95, 0.15, Math.cos(a) * 0.95);
    pips.push(pip);
    g.add(pip);
  }
  g.add(post, cap, body, core, light, safe);
  g.userData = { bodyMat, coreMat, light, safe, pips, glow: 0 };
  return g;
}
