import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// Android wrapper for the Roleplay Playground web app.
// Same React UI (dist/) runs inside a native WebView, so all features
// and Supabase cloud sync stay identical to the web version.
const config: CapacitorConfig = {
  appId: 'com.roleplay.playground',
  appName: 'Roleplay Playground',
  webDir: 'dist',
  server: {
    // HTTPS scheme is required so Supabase Auth + Realtime treat
    // the WebView as a secure origin (same as the web app).
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
  },
  android: {
    // Keep the WebView background matching the app theme to avoid
    // a white flash on launch.
    backgroundColor: '#09090b',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#09090b',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#09090b',
    },
  },
};

export default config;
