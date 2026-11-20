// Standard palette of Ticket-02 (Phần 3) + the colour-blind alternatives of Ticket-03 §6.
// Single source for every listed element; tests/palette.test.mjs checks them against the tickets.
export const PALETTE = Object.freeze({
  sky: '#0E1430',
  fog: '#1B2350',
  grass: '#2F5D50',
  sand: '#C9B48A',
  wood: '#6B4A2F',
  cloudSea: '#12384A',
  lanternLit: '#FFB347',
  lanternCore: '#FFE9B0',
  lanternOff: '#5B5F6E',
  moteCore: '#FFF6C2',
  moteHalo: '#FFE58A',
  shadeBody: '#120A1A',
  shadeRim: '#7A3CFF',
  shadeStunned: '#3A3450',
  mayRobe: '#E8E2D0',
  mayScarf: '#C8102E', // also the Wind Charm
  charm: '#C8102E',
  gold: '#F2C14E', // charm rim, score
  drifter: '#8FA3B8',
  uiDanger: '#FF5A5F',
  uiText: '#F5F1E6',
  // Ticket-03 §6 "Bảng màu dễ phân biệt": shade rim/eyes and UI warnings
  shadeRimCB: '#00B3FF',
  uiDangerCB: '#FFFFFF',
  fuelBar: '#FFB347', // = lanternLit
});
