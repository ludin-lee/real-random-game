import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  Rng,
  SHAPES,
  SIZE,
  canPlace,
  cloneState,
  dealTray,
  emptyBoard,
  findFullLines,
  fitsAnywhere,
  getShape,
  hammer,
  idx,
  isStuck,
  lineScore,
  makeLevel,
  newGame,
  pieceShape,
  place,
  revive,
} from '../src/core';
import { bestMove } from '../src/core/bot';

const T = DEFAULT_TUNING;

describe('rng', () => {
  it('is deterministic and resumable from its state', () => {
    const a = new Rng(42);
    const seq = [a.next(), a.next()];
    const mid = new Rng(a.state);
    const b = new Rng(42);
    expect([b.next(), b.next()]).toEqual(seq);
    expect(b.next()).toEqual(mid.next());
  });
});

describe('shapes', () => {
  it('have unique ids and fit on the board', () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
    for (const s of SHAPES) {
      expect(s.rows).toBeLessThanOrEqual(SIZE);
      expect(s.cols).toBeLessThanOrEqual(SIZE);
      expect(s.cells.length).toBeGreaterThan(0);
    }
  });
});

describe('board', () => {
  it('detects and dedupes row+column clears', () => {
    const b = emptyBoard();
    for (let i = 0; i < SIZE; i++) {
      b.cells[idx(3, i)] = 1;
      b.cells[idx(i, 5)] = 1;
    }
    const lc = findFullLines(b);
    expect(lc.rows).toEqual([3]);
    expect(lc.cols).toEqual([5]);
    expect(lc.cells.length).toBe(SIZE * 2 - 1);
  });

  it('rejects out-of-bounds and overlapping placements', () => {
    const b = emptyBoard();
    const o3 = getShape('o3');
    expect(canPlace(b, o3, 5, 5)).toBe(true);
    expect(canPlace(b, o3, 6, 0)).toBe(false);
    b.cells[idx(6, 6)] = 2;
    expect(canPlace(b, o3, 5, 5)).toBe(false);
  });
});

describe('scoring', () => {
  it('rewards multi-line clears and combos super-linearly', () => {
    expect(lineScore(1, 1, T)).toBe(20);
    expect(lineScore(2, 1, T)).toBe(60);
    expect(lineScore(2, 3, T)).toBe(180);
    expect(lineScore(0, 5, T)).toBe(0);
  });
});

describe('generator', () => {
  it('never deals a dead tray when any shape can fit', () => {
    const rng = new Rng(7);
    for (let n = 0; n < 300; n++) {
      const b = emptyBoard();
      // Random crowded boards.
      for (let k = 0; k < SIZE * SIZE; k++) if (rng.chance(0.72)) b.cells[k] = 1;
      const anyFits = SHAPES.some((s) => fitsAnywhere(b, s));
      const tray = dealTray(b, rng, { difficulty: 1, tuning: T });
      expect(tray).toHaveLength(3);
      if (anyFits) expect(tray.some((p) => fitsAnywhere(b, pieceShape(p)))).toBe(true);
    }
  });
});

describe('game', () => {
  it('same seed => identical game (replayable)', () => {
    const run = () => {
      const s = newGame({ mode: 'classic', seed: 99 }, T);
      for (let i = 0; i < 60 && s.status === 'playing'; i++) {
        const m = bestMove(s)!;
        place(s, m.slot, m.row, m.col, T);
      }
      return s;
    };
    expect(run()).toEqual(run());
  });

  it('illegal moves are rejected without mutating state', () => {
    const s = newGame({ mode: 'classic', seed: 1 }, T);
    const before = cloneState(s);
    expect(place(s, 0, 99, 99, T)).toBeNull();
    expect(s).toEqual(before);
  });

  it('clears a line, scores it, and refills the tray after 3 placements', () => {
    const s = newGame({ mode: 'classic', seed: 5 }, T);
    for (let c = 0; c < SIZE - 1; c++) s.board.cells[idx(0, c)] = 3;
    s.tray = [
      { shapeId: 'dot', color: 1, gemCell: -1, gem: 0 },
      { shapeId: 'dot', color: 1, gemCell: -1, gem: 0 },
      { shapeId: 'dot', color: 1, gemCell: -1, gem: 0 },
    ];
    const ev = place(s, 0, 0, SIZE - 1, T)!;
    expect(ev.find((e) => e.t === 'clear')).toBeTruthy();
    expect(s.score).toBe(1 + 20 + T.allClearBonus);
    place(s, 1, 4, 4, T);
    const ev3 = place(s, 2, 5, 5, T)!;
    expect(ev3.find((e) => e.t === 'deal')).toBeTruthy();
    expect(s.tray.every((p) => p !== null)).toBe(true);
  });

  it('combo survives within the grace window and resets after it', () => {
    const s = newGame({ mode: 'classic', seed: 5 }, T);
    s.combo = 2;
    s.tray = [0, 1, 2].map(() => ({ shapeId: 'dot', color: 1, gemCell: -1, gem: 0 }));
    place(s, 0, 7, 0, T);
    place(s, 1, 7, 2, T);
    expect(s.combo).toBe(2);
    const ev = place(s, 2, 7, 4, T)!;
    expect(s.combo).toBe(0);
    expect(ev.find((e) => e.t === 'comboLost')).toBeTruthy();
  });

  it('detects game over and revive gives a playable board once', () => {
    const s = newGame({ mode: 'classic', seed: 3 }, T);
    for (let k = 0; k < SIZE * SIZE; k++) s.board.cells[k] = (k % 3) + 1;
    s.board.cells[0] = 0;
    s.tray = [{ shapeId: 'o3', color: 1, gemCell: -1, gem: 0 }, null, null];
    expect(isStuck(s)).toBe(true);
    s.status = 'over';
    revive(s, T);
    expect(s.status).toBe('playing');
    expect(s.revives).toBe(1);
    expect(isStuck(s)).toBe(false);
  });

  it('adventure: clearing buds advances goals and wins', () => {
    const s = newGame({ mode: 'adventure', level: 1 }, T);
    const goal = s.goals[0];
    goal.have = goal.need - 1;
    const k = s.board.cells.findIndex((v) => v === 0);
    s.board.cells[k] = 2;
    s.board.gems[k] = goal.gem;
    const ev = hammer(s, k, T)!;
    expect(ev.find((e) => e.t === 'gems')).toBeTruthy();
    expect(s.status).toBe('won');
  });

  it('levels are deterministic and never start with a full line', () => {
    for (let lv = 1; lv <= 200; lv++) {
      const a = makeLevel(lv);
      expect(a).toEqual(makeLevel(lv));
      expect(findFullLines(a.board).cells).toHaveLength(0);
      expect(a.goals.every((g) => g.need > 0)).toBe(true);
    }
  });

  it('state survives a JSON round-trip (save/restore mid-run)', () => {
    const s = newGame({ mode: 'daily', dailyKey: '2026-10-12' }, T);
    const m = bestMove(s)!;
    place(s, m.slot, m.row, m.col, T);
    const restored = JSON.parse(JSON.stringify(s));
    const m2 = bestMove(s)!;
    place(s, m2.slot, m2.row, m2.col, T);
    place(restored, m2.slot, m2.row, m2.col, T);
    expect(restored).toEqual(s);
  });
});
