import { DEFAULT_TUNING, type Tuning, mergeTuning } from '../core/tuning';

/**
 * Live-ops knobs. Defaults ship in the binary; a JSON document fetched from
 * `VITE_REMOTE_CONFIG_URL` (e.g. Firebase Remote Config REST / a CDN file) can override
 * any field without an app update. Fetch never blocks boot: cached value is used next launch.
 */
export interface RemoteConfig {
  tuning: Partial<Tuning>;
  /** Show an interstitial every N finished runs… */
  interstitialEvery: number;
  /** …but never more often than this. */
  interstitialCooldownSec: number;
  /** No interstitials until the player has finished this many runs (protects D1 retention). */
  interstitialGraceRuns: number;
  costs: { hammer: number; shuffle: number; revive: number };
  rewards: { adventureWin: number; perStar: number; classicPer100: number; dailyMedals: [number, number, number]; adCoins: number };
  /** Live event: multiplies coin rewards (e.g. weekend 2x). */
  coinMultiplier: number;
  eventBanner: string;
}

export const DEFAULT_CONFIG: RemoteConfig = {
  tuning: {},
  interstitialEvery: 3,
  interstitialCooldownSec: 120,
  interstitialGraceRuns: 4,
  costs: { hammer: 120, shuffle: 90, revive: 250 },
  rewards: { adventureWin: 20, perStar: 10, classicPer100: 1, dailyMedals: [30, 60, 120], adCoins: 50 },
  coinMultiplier: 1,
  eventBanner: '',
};

const CACHE_KEY = 'bloom.rc.v1';
let current: RemoteConfig = DEFAULT_CONFIG;

function merge(patch: Partial<RemoteConfig>): RemoteConfig {
  return {
    ...DEFAULT_CONFIG,
    ...patch,
    costs: { ...DEFAULT_CONFIG.costs, ...(patch.costs ?? {}) },
    rewards: { ...DEFAULT_CONFIG.rewards, ...(patch.rewards ?? {}) },
  };
}

export function loadRemoteConfig(): RemoteConfig {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) current = merge(JSON.parse(cached));
  } catch {
    current = DEFAULT_CONFIG;
  }
  const url = import.meta.env.VITE_REMOTE_CONFIG_URL as string | undefined;
  if (url) {
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) localStorage.setItem(CACHE_KEY, JSON.stringify(json));
      })
      .catch(() => {});
  }
  return current;
}

export function config(): RemoteConfig {
  return current;
}

export function tuning(): Tuning {
  return mergeTuning(DEFAULT_TUNING, current.tuning);
}
