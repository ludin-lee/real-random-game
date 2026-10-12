import { track } from './analytics';

/**
 * In-app purchase facade. Mock provider grants instantly (with a confirm) so the economy
 * can be tested end to end. Production: RevenueCat (`@revenuecat/purchases-capacitor`)
 * behind the same interface; product ids must match App Store Connect / Play Console.
 */
export type ProductId = 'starter_pack' | 'remove_ads' | 'coins_500' | 'coins_3000';

export interface Product {
  id: ProductId;
  price: string;
  consumable: boolean;
}

export const PRODUCTS: Record<ProductId, Product> = {
  starter_pack: { id: 'starter_pack', price: '₩4,900', consumable: false },
  remove_ads: { id: 'remove_ads', price: '₩3,900', consumable: false },
  coins_500: { id: 'coins_500', price: '₩1,200', consumable: true },
  coins_3000: { id: 'coins_3000', price: '₩5,900', consumable: true },
};

export interface IapProvider {
  purchase(id: ProductId): Promise<boolean>;
  restore(): Promise<ProductId[]>;
}

class MockIap implements IapProvider {
  async purchase(id: ProductId) {
    return window.confirm(`[TEST STORE]\n${id} — ${PRODUCTS[id].price}\nPurchase?`);
  }
  async restore() {
    return [];
  }
}

let provider: IapProvider = new MockIap();
export function setIapProvider(p: IapProvider) {
  provider = p;
}

export async function purchase(id: ProductId): Promise<boolean> {
  track('iap_attempt', { product: id });
  const ok = await provider.purchase(id);
  if (ok) track('iap_purchase', { product: id, price: PRODUCTS[id].price });
  return ok;
}

export function restorePurchases() {
  return provider.restore();
}
