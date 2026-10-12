import {
  type Board,
  SIZE,
  canPlace,
  clearCells,
  cloneBoard,
  emptyBoard,
  findFullLines,
  fitsAnywhere,
  idx,
  isEmpty,
  placeCells,
} from './board';
import { type Piece, dealTray, pieceShape } from './generator';
import { type LevelDef, dailySeed, makeLevel } from './levels';
import { Rng } from './rng';
import type { Tuning } from './tuning';

export type Mode = 'classic' | 'adventure' | 'daily';
export type Status = 'playing' | 'over' | 'won';

export interface Goal {
  gem: number;
  need: number;
  have: number;
}

/** Plain JSON-serializable state: saved after every move so an app kill never loses a run. */
export interface GameState {
  v: 1;
  mode: Mode;
  seed: number;
  rng: number;
  level: number;
  dailyKey: string;
  board: Board;
  tray: Array<Piece | null>;
  score: number;
  combo: number;
  sinceClear: number;
  moves: number;
  lines: number;
  revives: number;
  status: Status;
  goals: Goal[];
  par: number;
  gemChance: number;
  baseDifficulty: number;
}

export interface ClearedCell {
  k: number;
  color: number;
  gem: number;
}

export type GameEvent =
  | { t: 'place'; slot: number; cells: number[]; color: number; points: number }
  | { t: 'clear'; rows: number[]; cols: number[]; cells: ClearedCell[]; lines: number; points: number; combo: number }
  | { t: 'allClear'; points: number }
  | { t: 'gems'; gems: number[] }
  | { t: 'deal'; tray: Piece[] }
  | { t: 'comboLost' }
  | { t: 'over' }
  | { t: 'won'; stars: number }
  | { t: 'revive'; cells: ClearedCell[] };

export interface NewGameOptions {
  mode: Mode;
  seed?: number;
  level?: number;
  dailyKey?: string;
}

export function newGame(opts: NewGameOptions, tuning: Tuning): GameState {
  let board = emptyBoard();
  let goals: Goal[] = [];
  let par = 0;
  let gemChance = 0;
  let baseDifficulty = 0;
  let seed = opts.seed ?? (Math.random() * 2 ** 32) >>> 0;
  const level = opts.level ?? 1;
  const dailyKey = opts.dailyKey ?? '';

  if (opts.mode === 'adventure') {
    const def: LevelDef = makeLevel(level);
    board = cloneBoard(def.board);
    goals = def.goals.map((g) => ({ ...g, have: 0 }));
    par = def.par;
    gemChance = def.gemChance;
    baseDifficulty = def.difficulty;
    seed = opts.seed ?? def.seed;
  } else if (opts.mode === 'daily') {
    seed = dailySeed(dailyKey);
  }

  const s: GameState = {
    v: 1,
    mode: opts.mode,
    seed,
    rng: seed,
    level,
    dailyKey,
    board,
    tray: [],
    score: 0,
    combo: 0,
    sinceClear: 0,
    moves: 0,
    lines: 0,
    revives: 0,
    status: 'playing',
    goals,
    par,
    gemChance,
    baseDifficulty,
  };
  s.tray = deal(s, tuning);
  return s;
}

export function difficulty(s: GameState, tuning: Tuning): number {
  if (s.mode === 'adventure') return s.baseDifficulty;
  return Math.min(1, s.score / tuning.rampScore);
}

function deal(s: GameState, tuning: Tuning): Piece[] {
  const rng = new Rng(s.rng);
  const neededGems = s.goals.filter((g) => g.have < g.need).map((g) => g.gem);
  const tray = dealTray(s.board, rng, {
    difficulty: difficulty(s, tuning),
    tuning,
    gemChance: s.gemChance,
    gemTypes: neededGems,
  });
  s.rng = rng.state;
  return tray;
}

export function lineScore(lines: number, combo: number, tuning: Tuning): number {
  if (lines <= 0) return 0;
  const base = (tuning.linePoints * lines * (lines + 1)) / 2;
  return Math.round(base * Math.max(1, combo));
}

export function canPlacePiece(s: GameState, slot: number, row: number, col: number): boolean {
  const p = s.tray[slot];
  return !!p && s.status === 'playing' && canPlace(s.board, pieceShape(p), row, col);
}

/** Returns null if the move is illegal (state untouched). */
export function place(s: GameState, slot: number, row: number, col: number, tuning: Tuning): GameEvent[] | null {
  if (!canPlacePiece(s, slot, row, col)) return null;
  const piece = s.tray[slot]!;
  const shape = pieceShape(piece);
  const events: GameEvent[] = [];

  const cells = placeCells(s.board, shape, row, col, piece.color, piece.gemCell, piece.gem);
  s.tray[slot] = null;
  s.moves++;
  s.score += cells.length;
  events.push({ t: 'place', slot, cells, color: piece.color, points: cells.length });

  const full = findFullLines(s.board);
  const lines = full.rows.length + full.cols.length;
  if (lines > 0) {
    s.combo++;
    s.sinceClear = 0;
    s.lines += lines;
    const cleared = full.cells.map((k) => ({ k, color: s.board.cells[k], gem: s.board.gems[k] }));
    clearCells(s.board, full.cells);
    const points = lineScore(lines, s.combo, tuning);
    s.score += points;
    events.push({ t: 'clear', rows: full.rows, cols: full.cols, cells: cleared, lines, points, combo: s.combo });
    collectGems(s, cleared, events);
    if (isEmpty(s.board)) {
      s.score += tuning.allClearBonus;
      events.push({ t: 'allClear', points: tuning.allClearBonus });
    }
  } else {
    s.sinceClear++;
    if (s.combo > 0 && s.sinceClear >= tuning.comboGrace) {
      s.combo = 0;
      events.push({ t: 'comboLost' });
    }
  }

  settle(s, events, tuning);
  return events;
}

function collectGems(s: GameState, cleared: ClearedCell[], events: GameEvent[]) {
  const gems = cleared.filter((c) => c.gem > 0).map((c) => c.gem);
  if (!gems.length) return;
  for (const g of gems) {
    const goal = s.goals.find((x) => x.gem === g);
    if (goal) goal.have = Math.min(goal.need, goal.have + 1);
  }
  events.push({ t: 'gems', gems });
}

/** After any board change: refill tray, check win / loss. */
function settle(s: GameState, events: GameEvent[], tuning: Tuning) {
  if (s.mode === 'adventure' && s.goals.length && s.goals.every((g) => g.have >= g.need)) {
    s.status = 'won';
    events.push({ t: 'won', stars: starsFor(s) });
    return;
  }
  if (s.tray.every((p) => p === null)) {
    s.tray = deal(s, tuning);
    events.push({ t: 'deal', tray: s.tray as Piece[] });
  }
  if (isStuck(s)) {
    s.status = 'over';
    events.push({ t: 'over' });
  }
}

export function starsFor(s: GameState): number {
  if (s.moves <= s.par) return 3;
  if (s.moves <= Math.ceil(s.par * 1.4)) return 2;
  return 1;
}

export function isStuck(s: GameState): boolean {
  return !s.tray.some((p) => p && fitsAnywhere(s.board, pieceShape(p)));
}

export function canRevive(s: GameState, tuning: Tuning): boolean {
  return s.status === 'over' && s.revives < tuning.maxRevives;
}

/** Second chance: wipe the most crowded 4x4 window and deal a fresh, helpful tray. */
export function revive(s: GameState, tuning: Tuning): GameEvent[] {
  if (s.status !== 'over') return [];
  let best = -1;
  let bestR = 0;
  let bestC = 0;
  for (let r = 0; r <= SIZE - 4; r++) {
    for (let c = 0; c <= SIZE - 4; c++) {
      let n = 0;
      for (let dr = 0; dr < 4; dr++) for (let dc = 0; dc < 4; dc++) if (s.board.cells[idx(r + dr, c + dc)]) n++;
      if (n > best) [best, bestR, bestC] = [n, r, c];
    }
  }
  const cells: ClearedCell[] = [];
  for (let dr = 0; dr < 4; dr++) {
    for (let dc = 0; dc < 4; dc++) {
      const k = idx(bestR + dr, bestC + dc);
      if (s.board.cells[k]) cells.push({ k, color: s.board.cells[k], gem: s.board.gems[k] });
    }
  }
  clearCells(
    s.board,
    cells.map((c) => c.k),
  );
  s.revives++;
  s.status = 'playing';
  const events: GameEvent[] = [{ t: 'revive', cells }];
  collectGems(s, cells, events);
  s.tray = deal(s, tuning);
  events.push({ t: 'deal', tray: s.tray as Piece[] });
  settle(s, events, tuning);
  return events;
}

/** Power-up: smash one filled cell. */
export function hammer(s: GameState, k: number, tuning: Tuning): GameEvent[] | null {
  if (s.status !== 'playing' || !s.board.cells[k]) return null;
  const cells = [{ k, color: s.board.cells[k], gem: s.board.gems[k] }];
  clearCells(s.board, [k]);
  const events: GameEvent[] = [{ t: 'revive', cells }];
  collectGems(s, cells, events);
  settle(s, events, tuning);
  return events;
}

/** Power-up: replace the remaining tray pieces. */
export function shuffle(s: GameState, tuning: Tuning): GameEvent[] | null {
  if (s.status === 'won') return null;
  s.tray = deal(s, tuning);
  s.status = 'playing';
  const events: GameEvent[] = [{ t: 'deal', tray: s.tray as Piece[] }];
  settle(s, events, tuning);
  return events;
}

export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
