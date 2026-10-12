import type { Tier } from './shapes';

/**
 * Every balance knob lives here so it can be overridden by remote config
 * (see src/meta/remoteConfig.ts) and swept by the balance harness (sim/balance.ts).
 */
export interface Tuning {
  /** Shape tier weights at difficulty 0 (fresh run). */
  easyWeights: Record<Tier, number>;
  /** Shape tier weights at difficulty 1 (late game). */
  hardWeights: Record<Tier, number>;
  /** Classic: score at which difficulty reaches 1. */
  rampScore: number;
  /** Probability that one tray slot is a guaranteed line-completer. */
  helpChance: number;
  /** Help probability when the board is crowded (mercy). */
  helpChanceCrowded: number;
  /** Fill ratio (0..1) above which the board counts as crowded. */
  crowdedFill: number;
  /** Placements without a clear before the combo resets. */
  comboGrace: number;
  /** Points per line, before the multi-line triangle bonus and combo multiplier. */
  linePoints: number;
  allClearBonus: number;
  /** Max revives per run (rewarded ad / coins). */
  maxRevives: number;
}

export const DEFAULT_TUNING: Tuning = {
  easyWeights: { small: 3, medium: 5, large: 1.2 },
  hardWeights: { small: 2, medium: 5, large: 3 },
  rampScore: 6000,
  helpChance: 0.3,
  helpChanceCrowded: 0.75,
  crowdedFill: 0.55,
  comboGrace: 3,
  linePoints: 20,
  allClearBonus: 500,
  maxRevives: 1,
};

export function mergeTuning(base: Tuning, patch: Partial<Tuning> | undefined): Tuning {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    easyWeights: { ...base.easyWeights, ...(patch.easyWeights ?? {}) },
    hardWeights: { ...base.hardWeights, ...(patch.hardWeights ?? {}) },
  };
}
