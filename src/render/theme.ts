/** Art direction: "twilight garden" — deep indigo night, candy-bright blocks, glowing flowers. */
export const BLOCK_COLORS: Record<number, { base: string; light: string; dark: string }> = {
  1: { base: '#ff5d8f', light: '#ff9cbc', dark: '#c9346a' }, // rose
  2: { base: '#ff9f43', light: '#ffc58a', dark: '#d0701b' }, // tangerine
  3: { base: '#ffd23f', light: '#ffe78f', dark: '#d1a40d' }, // sunflower
  4: { base: '#5fd068', light: '#9be8a1', dark: '#33a03d' }, // leaf
  5: { base: '#4cc9f0', light: '#93e1f8', dark: '#1d97bf' }, // sky
  6: { base: '#9b7bff', light: '#c3b0ff', dark: '#6d4ee0' }, // lavender
  7: { base: '#2ec4b6', light: '#7ae0d6', dark: '#16948a' }, // lagoon
  8: { base: '#6f7f86', light: '#9aa8ad', dark: '#4b585e' }, // moss stone
};

export const BUD_COLORS: Record<number, { petal: string; center: string }> = {
  1: { petal: '#ff7eb6', center: '#ffe066' }, // tulip
  2: { petal: '#6ec3ff', center: '#ffffff' }, // bluebell
  3: { petal: '#fff6e0', center: '#ffb703' }, // daisy
};

export const UI = {
  bgTop: '#3a2a78',
  bgBottom: '#140f33',
  panel: '#1b1540',
  slot: '#2b2460',
  slotEdge: '#352d72',
  ghostOk: 'rgba(255,255,255,0.35)',
  text: '#ffffff',
};
