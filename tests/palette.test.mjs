// F8: the standard palette of Ticket-02 is used for the listed elements (≤ 10 % per RGB channel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PALETTE } from '../src/web/palette.js';

// Copied from docs/requirements/phase2-Ticket-02.md ("Bảng màu chuẩn").
const TICKET = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', cloudSea: '#12384A',
  lanternLit: '#FFB347', lanternCore: '#FFE9B0', lanternOff: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shadeBody: '#120A1A', shadeRim: '#7A3CFF', shadeStunned: '#3A3450', mayRobe: '#E8E2D0', mayScarf: '#C8102E',
  charm: '#C8102E', gold: '#F2C14E', drifter: '#8FA3B8', uiDanger: '#FF5A5F', uiText: '#F5F1E6',
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('every palette entry is within 10 % per RGB channel of the ticket value', () => {
  for (const [k, hex] of Object.entries(TICKET)) {
    assert.ok(PALETTE[k], `missing ${k}`);
    rgb(PALETTE[k]).forEach((c, i) => assert.ok(Math.abs(c - rgb(hex)[i]) <= 25.5, `${k} channel ${i}: ${PALETTE[k]} vs ${hex}`));
  }
});

test('the 3D renderer actually uses every palette entry (no hard-coded substitutes)', () => {
  const code = ['src/web/main.js', 'src/web/world.js'].map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const css = fs.readFileSync(new URL('../src/web/style.css', import.meta.url), 'utf8');
  const usedInCss = { sky: '--sky', lanternLit: '--lit', lanternCore: '--core', moteCore: '--mote', moteHalo: '--halo', gold: '--gold', uiDanger: '--danger', uiText: '--text', charm: '--charm' };
  for (const k of Object.keys(TICKET)) {
    const inJs = code.includes(`PALETTE.${k}`);
    const cssVar = usedInCss[k];
    const inCss = cssVar && new RegExp(`${cssVar}:\\s*${PALETTE[k]}`, 'i').test(css);
    assert.ok(inJs || inCss, `${k} is not used by the renderer or the HUD`);
  }
});
