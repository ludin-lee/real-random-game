import { track } from './analytics';

/**
 * Ad facade. Ships with a mock provider (a visible test overlay) so every placement can
 * be QA'd in the browser. Production wires AdMob/AppLovin MAX via a Capacitor plugin
 * behind the same interface — see docs/04-live-ops.md#monetization.
 */
export type RewardedPlacement = 'revive' | 'double_coins' | 'free_coins' | 'free_powerup';
export type InterstitialPlacement = 'run_end';

export interface AdProvider {
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
  showInterstitial(placement: InterstitialPlacement): Promise<void>;
}

class MockAds implements AdProvider {
  private overlay(label: string, seconds: number, rewarded: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ad-mock';
      el.innerHTML = `<div class="ad-card"><div class="ad-tag">TEST AD</div><div class="ad-label">${label}</div><div class="ad-count"></div><button class="btn small ghost ad-skip" hidden>✕</button></div>`;
      document.body.appendChild(el);
      const count = el.querySelector('.ad-count') as HTMLElement;
      const skip = el.querySelector('.ad-skip') as HTMLButtonElement;
      let left = seconds;
      const tick = () => {
        count.textContent = left > 0 ? `${left}` : '✓';
        if (left <= 0) {
          skip.hidden = false;
          clearInterval(timer);
        }
        left--;
      };
      const timer = setInterval(tick, 1000);
      tick();
      skip.onclick = () => {
        el.remove();
        resolve(rewarded);
      };
    });
  }
  showRewarded(placement: RewardedPlacement) {
    return this.overlay(placement.replace('_', ' '), 2, true);
  }
  async showInterstitial(placement: InterstitialPlacement) {
    await this.overlay(placement.replace('_', ' '), 1, false);
  }
}

let provider: AdProvider = new MockAds();
export function setAdProvider(p: AdProvider) {
  provider = p;
}

export async function showRewarded(placement: RewardedPlacement): Promise<boolean> {
  track('ad_request', { type: 'rewarded', placement });
  const ok = await provider.showRewarded(placement);
  track('ad_show', { type: 'rewarded', placement });
  if (ok) track('ad_reward', { placement });
  return ok;
}

export async function showInterstitial(placement: InterstitialPlacement): Promise<void> {
  track('ad_request', { type: 'interstitial', placement });
  await provider.showInterstitial(placement);
  track('ad_show', { type: 'interstitial', placement });
}
