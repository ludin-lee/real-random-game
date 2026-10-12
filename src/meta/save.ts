import type { GameState, Mode } from '../core/game';

export type Lang = 'ko' | 'en';

export interface SaveData {
  v: 1;
  createdAt: number;
  coins: number;
  best: number;
  adventureLevel: number;
  stars: Record<number, number>;
  inventory: { hammer: number; shuffle: number };
  settings: { sound: boolean; music: boolean; haptics: boolean; lang: Lang };
  removeAds: boolean;
  starterBought: boolean;
  tutorialDone: boolean;
  daily: { lastKey: string; streak: number; best: Record<string, number>; medalsClaimed: Record<string, number> };
  stats: { runs: number; lines: number; sessions: number; lastAdAt: number; runsSinceAd: number };
  runs: Partial<Record<Mode, GameState>>;
}

const KEY = 'bloom.save.v1';

function defaults(): SaveData {
  const lang: Lang = typeof navigator !== 'undefined' && navigator.language?.startsWith('ko') ? 'ko' : 'en';
  return {
    v: 1,
    createdAt: Date.now(),
    coins: 150,
    best: 0,
    adventureLevel: 1,
    stars: {},
    inventory: { hammer: 2, shuffle: 2 },
    settings: { sound: true, music: true, haptics: true, lang },
    removeAds: false,
    starterBought: false,
    tutorialDone: false,
    daily: { lastKey: '', streak: 0, best: {}, medalsClaimed: {} },
    stats: { runs: 0, lines: 0, sessions: 0, lastAdAt: 0, runsSinceAd: 0 },
    runs: {},
  };
}

let data: SaveData = defaults();

/** Deep-merge loaded data over defaults so new fields added in updates get sane values. */
function hydrate(raw: Partial<SaveData>): SaveData {
  const d = defaults();
  return {
    ...d,
    ...raw,
    inventory: { ...d.inventory, ...raw.inventory },
    settings: { ...d.settings, ...raw.settings },
    daily: { ...d.daily, ...raw.daily },
    stats: { ...d.stats, ...raw.stats },
    runs: raw.runs ?? {},
    stars: raw.stars ?? {},
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? hydrate(JSON.parse(raw)) : defaults();
  } catch {
    data = defaults();
  }
  return data;
}

export function save(): SaveData {
  return data;
}

let pending = 0;
/** Debounced write — called after every move, flushed on pause. */
export function persist(immediate = false) {
  if (immediate) {
    clearTimeout(pending);
    write();
    return;
  }
  clearTimeout(pending);
  pending = window.setTimeout(write, 250);
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full / private mode: game still playable */
  }
}

export function resetSave() {
  data = defaults();
  persist(true);
}
