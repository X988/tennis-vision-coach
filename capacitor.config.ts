import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tennisvisioncoach.app',
  appName: 'Tennis Vision Coach',
  webDir: 'dist',
  backgroundColor: '#0d1420',
  android: {
    backgroundColor: '#0d1420',
  },
  ios: {
    backgroundColor: '#0d1420',
    contentInset: 'never',
  },
  plugins: {
    // Android 15+ draws apps edge-to-edge; the safe areas reach the page as
    // --safe-area-inset-* CSS variables (see index.css).
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0d1420',
      showSpinner: false,
    },
  },
};

export default config;
