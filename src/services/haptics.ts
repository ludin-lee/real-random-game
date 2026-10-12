import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;
export function setHaptics(on: boolean) {
  enabled = on;
}

const native = Capacitor.isNativePlatform();

export function tap(kind: 'light' | 'medium' | 'heavy' = 'light') {
  if (!enabled) return;
  if (native) {
    const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
    Haptics.impact({ style }).catch(() => {});
  } else if ('vibrate' in navigator) {
    navigator.vibrate(kind === 'heavy' ? 35 : kind === 'medium' ? 18 : 8);
  }
}

export function notify(kind: 'success' | 'error') {
  if (!enabled) return;
  if (native) Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error }).catch(() => {});
  else if ('vibrate' in navigator) navigator.vibrate(kind === 'success' ? [10, 40, 20] : [40, 60, 40]);
}
