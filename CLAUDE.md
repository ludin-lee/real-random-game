# CLAUDE.md — agent working rules for Bloom Blocks

Mobile block puzzle (TypeScript + Vite + Canvas, wrapped with Capacitor for iOS/Android).
Design docs live in `docs/` (Korean). Read `docs/03-harness-engineering.md` before larger changes.

## Verify before you claim done
```bash
npm run verify        # typecheck → vitest → balance gate → build → playwright e2e
```
Faster loops: `npm test`, `npm run sim -- --gate`, `npm run e2e` (needs `npm run build` first).
After UI changes, look at the screenshots in `e2e/.results/*.png`.

## Architecture rules (enforced by tests/architecture.test.ts)
- `src/core/**` is pure: no DOM, no `window`/`localStorage`, no imports from render/ui/services/meta,
  no `Math.random` (only `newGame` may use it to pick a seed). All randomness via `Rng` stored in state.
- Core functions mutate `GameState` and return `GameEvent[]`; the shell (`src/app.ts`) turns events into
  effects, sounds, haptics, HUD updates and saves. Add new feedback by adding/handling events, not by
  reaching into the renderer from core.
- `GameState` must stay JSON-serializable (it is saved after every move).

## Balance changes
- All knobs: `src/core/tuning.ts` (classic/daily) and `src/core/levels.ts` (adventure).
- Any change must pass `npm run sim -- --gate`. If you intentionally move a target band, update the
  gate in `sim/balance.ts` AND the table in `docs/03-harness-engineering.md` in the same change.
- Never change level generation for existing level numbers casually: players' progress/stars refer to them.

## Monetization / services
- Ads, IAP, analytics are facades with mock providers (`src/services/*`). Real SDKs plug in via
  `setAdProvider` / `setIapProvider` / `setAnalyticsProvider`. New analytics events must be added to
  the `EventName` union and to the taxonomy table in `docs/04-live-ops.md`.
- Save schema: add fields with defaults in `src/meta/save.ts#defaults` — `hydrate()` merges old saves.

## Strings
User-facing text goes through `src/meta/i18n.ts` (ko + en, keep both in sync).
