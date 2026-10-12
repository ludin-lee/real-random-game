import {
  type Board,
  type GameState,
  SIZE,
  type Tuning,
  canPlace,
  clearCells,
  cloneBoard,
  findFullLines,
  fitsAnywhere,
  getShape,
  idx,
  pieceShape,
  placeCells,
} from './index';

/**
 * Greedy heuristic player used by the balance harness.
 * It is intentionally "good casual player" strength, not optimal: balance targets
 * are calibrated against it, and it doubles as the hint engine in-game.
 */
export interface Move {
  slot: number;
  row: number;
  col: number;
  score: number;
}

const O3 = getShape('o3');
const H5 = getShape('h5');
const V5 = getShape('v5');

export function evaluateBoard(b: Board): number {
  let score = 0;
  let empties = 0;
  let holes = 0;
  let transitions = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const filled = b.cells[idx(r, c)] !== 0;
      if (!filled) {
        empties++;
        const blocked = (rr: number, cc: number) =>
          rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE || b.cells[idx(rr, cc)] !== 0;
        if (blocked(r - 1, c) && blocked(r + 1, c) && blocked(r, c - 1) && blocked(r, c + 1)) holes++;
      }
      if (c > 0 && filled !== (b.cells[idx(r, c - 1)] !== 0)) transitions++;
      if (r > 0 && filled !== (b.cells[idx(r - 1, c)] !== 0)) transitions++;
    }
  }
  score += empties * 2 - holes * 18 - transitions * 2.5;
  if (fitsAnywhere(b, O3)) score += 25;
  if (fitsAnywhere(b, H5)) score += 10;
  if (fitsAnywhere(b, V5)) score += 10;
  return score;
}

export function bestMove(s: GameState, _tuning?: Tuning): Move | null {
  let best: Move | null = null;
  const neededGems = new Set(s.goals.filter((g) => g.have < g.need).map((g) => g.gem));
  s.tray.forEach((p, slot) => {
    if (!p) return;
    const shape = pieceShape(p);
    for (let r = 0; r <= SIZE - shape.rows; r++) {
      for (let c = 0; c <= SIZE - shape.cols; c++) {
        if (!canPlace(s.board, shape, r, c)) continue;
        const b = cloneBoard(s.board);
        placeCells(b, shape, r, c, p.color, p.gemCell, p.gem);
        const full = findFullLines(b);
        const lines = full.rows.length + full.cols.length;
        let gems = 0;
        for (const k of full.cells) if (neededGems.has(b.gems[k])) gems++;
        clearCells(b, full.cells);
        const score = evaluateBoard(b) + lines * 60 + lines * lines * 20 + gems * 40;
        if (!best || score > best.score) best = { slot, row: r, col: c, score };
      }
    }
  });
  return best;
}
