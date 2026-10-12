import type { Shape } from './shapes';

export const SIZE = 8;

/** Color index 0 = empty. 1..7 = piece colors, 8 = moss stone (adventure pre-placed). */
export const STONE = 8;

export interface Board {
  /** SIZE*SIZE color indices. */
  cells: number[];
  /** SIZE*SIZE gem type (0 = none). Gems sit on filled cells and are collected when cleared. */
  gems: number[];
}

export interface LineClear {
  rows: number[];
  cols: number[];
  /** Indices of every cell removed (deduplicated). */
  cells: number[];
}

export const idx = (r: number, c: number) => r * SIZE + c;

export function emptyBoard(): Board {
  return { cells: new Array(SIZE * SIZE).fill(0), gems: new Array(SIZE * SIZE).fill(0) };
}

export function cloneBoard(b: Board): Board {
  return { cells: b.cells.slice(), gems: b.gems.slice() };
}

export function canPlace(b: Board, s: Shape, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row + s.rows > SIZE || col + s.cols > SIZE) return false;
  for (const [dr, dc] of s.cells) {
    if (b.cells[idx(row + dr, col + dc)] !== 0) return false;
  }
  return true;
}

export function placeCells(b: Board, s: Shape, row: number, col: number, color: number, gemCell = -1, gem = 0): number[] {
  const placed: number[] = [];
  s.cells.forEach(([dr, dc], i) => {
    const k = idx(row + dr, col + dc);
    b.cells[k] = color;
    if (i === gemCell) b.gems[k] = gem;
    placed.push(k);
  });
  return placed;
}

/** Rows/cols that are completely full. */
export function findFullLines(b: Board): LineClear {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < SIZE; r++) {
    let full = true;
    for (let c = 0; c < SIZE && full; c++) if (b.cells[idx(r, c)] === 0) full = false;
    if (full) rows.push(r);
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE && full; r++) if (b.cells[idx(r, c)] === 0) full = false;
    if (full) cols.push(c);
  }
  const set = new Set<number>();
  for (const r of rows) for (let c = 0; c < SIZE; c++) set.add(idx(r, c));
  for (const c of cols) for (let r = 0; r < SIZE; r++) set.add(idx(r, c));
  return { rows, cols, cells: [...set] };
}

export function clearCells(b: Board, cells: number[]): void {
  for (const k of cells) {
    b.cells[k] = 0;
    b.gems[k] = 0;
  }
}

/** Lines that WOULD clear if `s` were placed at (row, col). Does not mutate. */
export function previewClear(b: Board, s: Shape, row: number, col: number): LineClear {
  const tmp = cloneBoard(b);
  placeCells(tmp, s, row, col, 1);
  return findFullLines(tmp);
}

export function fitsAnywhere(b: Board, s: Shape): boolean {
  for (let r = 0; r <= SIZE - s.rows; r++) {
    for (let c = 0; c <= SIZE - s.cols; c++) if (canPlace(b, s, r, c)) return true;
  }
  return false;
}

export function placements(b: Board, s: Shape): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r <= SIZE - s.rows; r++) {
    for (let c = 0; c <= SIZE - s.cols; c++) if (canPlace(b, s, r, c)) out.push([r, c]);
  }
  return out;
}

export function filledCount(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (v !== 0) n++;
  return n;
}

export function isEmpty(b: Board): boolean {
  return b.cells.every((v) => v === 0);
}
