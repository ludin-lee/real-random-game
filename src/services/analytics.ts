/**
 * Analytics facade. Gameplay code calls `track()` with events from the taxonomy in
 * docs/04-live-ops.md. A provider (Firebase / GameAnalytics / Amplitude) plugs in via
 * `setAnalyticsProvider` at boot; until then events are buffered (and logged in debug).
 */
export type EventName =
  | 'app_open'
  | 'session_start'
  | 'tutorial_begin'
  | 'tutorial_complete'
  | 'game_start'
  | 'game_end'
  | 'level_start'
  | 'level_complete'
  | 'level_fail'
  | 'daily_complete'
  | 'revive'
  | 'powerup_use'
  | 'ad_request'
  | 'ad_show'
  | 'ad_reward'
  | 'iap_attempt'
  | 'iap_purchase'
  | 'coins_earn'
  | 'coins_spend';

export type Params = Record<string, string | number | boolean>;

export interface AnalyticsProvider {
  log(name: EventName, params: Params): void;
}

const buffer: Array<{ name: EventName; params: Params; at: number }> = [];
let provider: AnalyticsProvider | null = null;
const debug = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);

export function setAnalyticsProvider(p: AnalyticsProvider) {
  provider = p;
  for (const e of buffer.splice(0)) p.log(e.name, e.params);
}

export function track(name: EventName, params: Params = {}) {
  if (debug) console.info('[analytics]', name, params);
  if (provider) provider.log(name, params);
  else if (buffer.length < 500) buffer.push({ name, params, at: Date.now() });
}

/** Test hook: lets e2e assert on the event stream. */
export function bufferedEvents() {
  return buffer.slice();
}
