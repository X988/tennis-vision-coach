import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { dispatchBack, notifyBackground } from './events';

export const isNative = () => Capacitor.isNativePlatform();
export const platformName = () => Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

/** Status / navigation bar icons that stay readable on the app background. */
export function setSystemBarsTheme(theme: 'dark' | 'light') {
  if (!isNative()) return;
  // "Dark" style = light icons for a dark background, and vice versa.
  SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => undefined);
}

/**
 * Native glue, loaded only inside the Android / iOS app: system bars,
 * splash screen, the Android back button and app pause/resume.
 */
export async function initNative() {
  if (!isNative()) return;
  const [{ App }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/splash-screen')]);


  App.addListener('backButton', ({ canGoBack }) => {
    if (dispatchBack()) return;
    const atHome = window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#';
    if (!atHome && canGoBack) window.history.back();
    else if (!atHome) window.location.hash = '#/';
    else App.minimizeApp().catch(() => App.exitApp());
  });

  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) notifyBackground();
  });

  // The first screen is rendered: replace the native splash with the app.
  requestAnimationFrame(() => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined));
}
