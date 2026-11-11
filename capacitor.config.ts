import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cafyz.app',
  appName: 'Cafyz',
  webDir: 'web-v2/dist',
  android: { path: 'cap-android' },
  // The page itself never scrolls (html/body are fixed; screens scroll inside), so the web
  // view's own scroll view stays off: no rubber-band bounce of the whole app.
  ios: { path: 'cap-ios', scrollEnabled: false },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    // Cafyz signs in with Google and Apple only. Leaving Facebook and X out keeps their SDKs
    // (and the Facebook SDK's advertising-ID permissions) out of the app.
    SocialLogin: {
      providers: { google: true, apple: true, facebook: false, twitter: false },
    },
    // The dark sign-in palette is the default; ThemeProvider switches the status bar at runtime for light.
    // Android: MainActivity pads the web view clear of the status and navigation bars itself,
    // so Capacitor's own inset handling (which leaves it to the page's CSS) stays off.
    SystemBars: { insetsHandling: 'disable' },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#070511',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070511',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for thermal printers…',
        cancel: 'Cancel',
        availableDevices: 'Available printers',
        noDeviceFound: 'No printer found. Put it in pairing mode.',
      },
    },
  },
};

export default config;
