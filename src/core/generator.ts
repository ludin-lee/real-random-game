import { type Board, SIZE, canPlace, filledCount, fitsAnywhere, previewClear } from './board';
import type { Rng } from './rng';
import { SHAPES, type Shape, type Tier, getShape } from './shapes';
import type { Tuning } from './tuning';

export interface Piece {
  shapeId: string;
  /** 1..7 */
  color: number;
  /** Index into shape.cells that carries a gem, or -1. */
  gemCell: number;
  gem: number;
}

export const PIECE_COLORS = 7;

export interface GenOptions {
  /** 0..1 */
  difficulty: number;
  tuning: Tuning;
  /** Adventure: chance that a piece carries a gem, and which gem types are still needed. */
  gemChance?: number;
  gemTypes?: number[];
}

function tierWeight(t: Tier, d: number, tuning: Tuning): number {
  return tuning.easyWeights[t] * (1 - d) + tuning.hardWeights[t] * d;
}

function sampleShape(rng: Rng, opts: GenOptions): Shape {
  // Weight per tier is split evenly among the tier's shapes so adding variants doesn't skew odds.
  const tierCount: Record<Tier, number> = { small: 0, medium: 0, large: 0 };
  for (const s of SHAPES) tierCount[s.tier]++;
  return rng.weighted(SHAPES, (s) => tierWeight(s.tier, opts.difficulty, opts.tuning) / tierCount[s.tier]);
}

/** Best number of lines `s` can complete anywhere on `b` (0 if none / doesn't fit). */
export function bestClearFor(b: Board, s: Shape): number {
  let best = 0;
  for (let r = 0; r <= SIZE - s.rows; r++) {
    for (let c = 0; c <= SIZE - s.cols; c++) {
      if (!canPlace(b, s, r, c)) continue;
      const lc = previewClear(b, s, r, c);
      const n = lc.rows.length + lc.cols.length;
      if (n > best) best = n;
    }
  }
  return best;
}

function helpfulShape(b: Board, rng: Rng): Shape | null {
  const scored: Array<{ s: Shape; n: number }> = [];
  for (const s of SHAPES) {
    const n = bestClearFor(b, s);
    if (n > 0) scored.push({ s, n });
  }
  if (!scored.length) return null;
  // Prefer bigger payoffs but keep variety.
  return rng.weighted(scored, (x) => x.n * x.n + x.s.cells.length * 0.25).s;
}

function makePiece(s: Shape, rng: Rng, opts: GenOptions): Piece {
  let gemCell = -1;
  let gem = 0;
  if (opts.gemTypes?.length && opts.gemChance && rng.chance(opts.gemChance)) {
    gemCell = rng.int(s.cells.length);
    gem = rng.pick(opts.gemTypes);
  }
  return { shapeId: s.id, color: 1 + rng.int(PIECE_COLORS), gemCell, gem };
}

/**
 * Deal a fresh tray of 3 pieces.
 * Guarantees: at least one piece fits; with `helpChance` (higher when crowded) one piece can complete a line.
 */
export function dealTray(b: Board, rng: Rng, opts: GenOptions): Piece[] {
  const fill = filledCount(b) / (SIZE * SIZE);
  const help = rng.chance(fill >= opts.tuning.crowdedFill ? opts.tuning.helpChanceCrowded : opts.tuning.helpChance);

  let shapes: Shape[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    shapes = [sampleShape(rng, opts), sampleShape(rng, opts), sampleShape(rng, opts)];
    if (shapes.some((s) => fitsAnywhere(b, s))) break;
  }

  const helpSlot = rng.int(3);
  if (help) {
    const h = helpfulShape(b, rng);
    if (h) shapes[helpSlot] = h;
  }

  if (!shapes.some((s) => fitsAnywhere(b, s))) {
    // Last resort: smallest shape that fits, so a deal is never dead on arrival.
    const fitting = SHAPES.filter((s) => fitsAnywhere(b, s)).sort((a, z) => a.cells.length - z.cells.length);
    if (fitting.length) shapes[helpSlot] = fitting[Math.min(fitting.length - 1, rng.int(3))];
  }

  return shapes.map((s) => makePiece(s, rng, opts));
}

export function pieceShape(p: Piece): Shape {
  return getShape(p.shapeId);
}
