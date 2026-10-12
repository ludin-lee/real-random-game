/** Piece catalogue. Cells are [row, col] offsets from the top-left of the bounding box. */
export type Cell = readonly [number, number];

export type Tier = 'small' | 'medium' | 'large';

export interface Shape {
  id: string;
  cells: readonly Cell[];
  rows: number;
  cols: number;
  tier: Tier;
}

function shape(id: string, art: string, tier: Tier): Shape {
  const lines = art.trim().split('/');
  const cells: Cell[] = [];
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') cells.push([r, c]);
    });
  });
  return {
    id,
    cells,
    rows: lines.length,
    cols: Math.max(...lines.map((l) => l.length)),
    tier,
  };
}

/** ASCII art: '/' separates rows, '#' is a filled cell. */
export const SHAPES: readonly Shape[] = [
  shape('dot', '#', 'small'),
  shape('h2', '##', 'small'),
  shape('v2', '#/#', 'small'),
  shape('h3', '###', 'small'),
  shape('v3', '#/#/#', 'small'),
  shape('c3a', '##/#.', 'small'),
  shape('c3b', '##/.#', 'small'),
  shape('c3c', '#./##', 'small'),
  shape('c3d', '.#/##', 'small'),
  shape('d2a', '#./.#', 'small'),
  shape('d2b', '.#/#.', 'small'),

  shape('h4', '####', 'medium'),
  shape('v4', '#/#/#/#', 'medium'),
  shape('o2', '##/##', 'medium'),
  shape('t1', '###/.#.', 'medium'),
  shape('t2', '.#./###', 'medium'),
  shape('t3', '#./##/#.', 'medium'),
  shape('t4', '.#/##/.#', 'medium'),
  shape('s1', '.##/##.', 'medium'),
  shape('s2', '##./.##', 'medium'),
  shape('s3', '#./##/.#', 'medium'),
  shape('s4', '.#/##/#.', 'medium'),
  shape('l1', '#./#./##', 'medium'),
  shape('l2', '.#/.#/##', 'medium'),
  shape('l3', '##/#./#.', 'medium'),
  shape('l4', '##/.#/.#', 'medium'),
  shape('l5', '###/#..', 'medium'),
  shape('l6', '###/..#', 'medium'),
  shape('l7', '#../###', 'medium'),
  shape('l8', '..#/###', 'medium'),

  shape('h5', '#####', 'large'),
  shape('v5', '#/#/#/#/#', 'large'),
  shape('r23', '###/###', 'large'),
  shape('r32', '##/##/##', 'large'),
  shape('o3', '###/###/###', 'large'),
  shape('L1', '#../#../###', 'large'),
  shape('L2', '..#/..#/###', 'large'),
  shape('L3', '###/#../#..', 'large'),
  shape('L4', '###/..#/..#', 'large'),
];

export const SHAPE_BY_ID: ReadonlyMap<string, Shape> = new Map(SHAPES.map((s) => [s.id, s]));

export function getShape(id: string): Shape {
  const s = SHAPE_BY_ID.get(id);
  if (!s) throw new Error(`Unknown shape ${id}`);
  return s;
}
