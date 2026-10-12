/**
 * Balance harness: plays thousands of deterministic games with the bot and reports
 * difficulty curves. `--gate` turns the report into a pass/fail check used by CI,
 * so a tuning change that makes the game too easy/hard can't ship silently.
 *
 *   npm run sim                 # report
 *   npm run sim -- --gate       # report + fail on out-of-band metrics
 *   npm run sim -- --games 2000
 */
import { DEFAULT_TUNING, DAILY_MEDALS, type GameState, type Tuning, newGame, place, starsFor } from '../src/core';
import { bestMove } from '../src/core/bot';

const args = process.argv.slice(2);
const gate = args.includes('--gate');
const gamesArg = args.indexOf('--games');
const GAMES = gamesArg >= 0 ? Number(args[gamesArg + 1]) : 300;
const MAX_MOVES = 3000;

function play(s: GameState, tuning: Tuning): GameState {
  while (s.status === 'playing' && s.moves < MAX_MOVES) {
    const m = bestMove(s, tuning);
    if (!m) break;
    place(s, m.slot, m.row, m.col, tuning);
  }
  return s;
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function summary(values: number[]) {
  const s = values.slice().sort((a, b) => a - b);
  return { p10: pct(s, 0.1), p50: pct(s, 0.5), p90: pct(s, 0.9), mean: Math.round(s.reduce((a, b) => a + b, 0) / s.length) };
}

const t0 = Date.now();
const tuning = DEFAULT_TUNING;

// Classic
const classic = Array.from({ length: GAMES }, (_, i) => play(newGame({ mode: 'classic', seed: 1000 + i }, tuning), tuning));
const cScore = summary(classic.map((g) => g.score));
const cMoves = summary(classic.map((g) => g.moves));
const linesSummary = summary(classic.map((g) => g.lines));

// Daily (7 consecutive days, as players would see them)
const days = Array.from({ length: 14 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
const daily = days.map((k) => play(newGame({ mode: 'daily', dailyKey: k }, tuning), tuning));
const medalRate = DAILY_MEDALS.map((m) => daily.filter((g) => g.score >= m).length / daily.length);

// Adventure: win rate & stars by level band, with a few retries per level (seeds vary pieces, not layout)
const bands = [
  [1, 10],
  [11, 25],
  [26, 50],
  [51, 100],
] as const;
const adv = bands.map(([a, z]) => {
  let wins = 0;
  let tries = 0;
  let stars = 0;
  let moves = 0;
  for (let lv = a; lv <= z; lv++) {
    for (let t = 0; t < 3; t++) {
      const g = play(newGame({ mode: 'adventure', level: lv, seed: lv * 7919 + t }, tuning), tuning);
      tries++;
      if (g.status === 'won') {
        wins++;
        stars += starsFor(g);
        moves += g.moves;
      }
    }
  }
  return { band: `${a}-${z}`, winRate: wins / tries, avgStars: wins ? stars / wins : 0, avgMoves: wins ? Math.round(moves / wins) : 0 };
});

const report = {
  games: GAMES,
  ms: Date.now() - t0,
  classic: { score: cScore, moves: cMoves, lines: linesSummary },
  daily: { medals: DAILY_MEDALS, medalRate: medalRate.map((r) => +r.toFixed(2)) },
  adventure: adv.map((x) => ({ ...x, winRate: +x.winRate.toFixed(2), avgStars: +x.avgStars.toFixed(2) })),
};
console.log(JSON.stringify(report, null, 2));

if (gate) {
  // Target bands: see docs/03-harness-engineering.md#balance-gates
  const failures: string[] = [];
  const check = (name: string, v: number, lo: number, hi: number) => {
    if (v < lo || v > hi) failures.push(`${name}=${v} outside [${lo}, ${hi}]`);
  };
  check('classic.moves.p10', cMoves.p10, 25, 400);
  check('classic.moves.p50', cMoves.p50, 60, 1500);
  check('adventure[1-10].winRate', adv[0].winRate, 0.85, 1);
  check('adventure[11-25].winRate', adv[1].winRate, 0.65, 1);
  check('adventure[26-50].winRate', adv[2].winRate, 0.45, 0.98);
  check('adventure[51-100].winRate', adv[3].winRate, 0.2, 0.95);
  check('daily.bronzeRate', medalRate[0], 0.5, 1);
  check('daily.goldRate', medalRate[2], 0.02, 0.8);
  if (failures.length) {
    console.error('\nBALANCE GATE FAILED:\n  ' + failures.join('\n  '));
    process.exit(1);
  }
  console.log('\nbalance gate: OK');
}
