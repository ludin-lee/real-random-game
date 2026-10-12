import { type Board, SIZE, STONE, emptyBoard, findFullLines, idx } from './board';
import { Rng, hashString } from './rng';

export const GEM_TYPES = 3;

export interface LevelDef {
  level: number;
  seed: number;
  board: Board;
  goals: Array<{ gem: number; need: number }>;
  /** Moves for 3 stars. */
  par: number;
  difficulty: number;
  /** Chance that a dealt piece carries a bud. */
  gemChance: number;
}

/**
 * Procedural, infinite, deterministic adventure levels.
 * Same level number => same layout on every device (fair + support-friendly).
 */
export function makeLevel(level: number): LevelDef {
  const n = Math.max(1, Math.floor(level));
  const seed = hashString(`bloom-level-${n}`);
  const rng = new Rng(seed);
  const board = emptyBoard();

  const types = n <= 3 ? 1 : n <= 10 ? 2 : 3;
  const gemPool = shuffled([1, 2, 3], rng).slice(0, types);

  // Mirror-symmetric stone layout reads as "designed" rather than noise.
  const stonePairs = Math.min(3 + Math.floor(n * 0.2), 10);
  for (let i = 0; i < stonePairs; i++) {
    const r = rng.int(SIZE);
    const c = rng.int(SIZE / 2);
    const gem = rng.chance(0.55) ? rng.pick(gemPool) : 0;
    for (const cc of [c, SIZE - 1 - c]) {
      board.cells[idx(r, cc)] = STONE;
      board.gems[idx(r, cc)] = gem;
    }
  }
  // Never start with a full line.
  for (let guard = 0; guard < 20; guard++) {
    const full = findFullLines(board);
    if (!full.cells.length) break;
    const k = rng.pick(full.cells);
    board.cells[k] = 0;
    board.gems[k] = 0;
  }

  const total = Math.min(5 + Math.floor(n * 0.3), 20);
  const goals = gemPool.map((gem, i) => ({
    gem,
    need: Math.max(2, Math.round(total / types) + (i === 0 ? total % types : 0)),
  }));

  return {
    level: n,
    seed,
    board,
    goals,
    par: Math.ceil(2 + total * 1.4),
    difficulty: Math.min(1, n / 80),
    gemChance: Math.max(0.45, 0.6 - n * 0.0015),
  };
}

function shuffled<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Local-date key, e.g. 2026-10-12. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dailySeed(key: string): number {
  return hashString(`bloom-daily-${key}`);
}

/** Score thresholds for bronze/silver/gold daily medals. Calibrated with `npm run sim`. */
export const DAILY_MEDALS = [1500, 4000, 8000] as const;
