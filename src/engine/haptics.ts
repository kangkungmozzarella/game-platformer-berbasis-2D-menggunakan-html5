import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export type Buzz = 'light' | 'medium' | 'heavy';

const STYLE: Record<Buzz, ImpactStyle> = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
const WEB_MS: Record<Buzz, number> = { light: 10, medium: 25, heavy: 60 };

/** Short vibrations: native haptics in the Android app, the Vibration API in mobile browsers. */
export class Haptic {
  enabled = true;
  private native = Capacitor.isNativePlatform();

  buzz(kind: Buzz): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.impact({ style: STYLE[kind] }).catch(() => {});
    else navigator.vibrate?.(WEB_MS[kind]);
  }
}
