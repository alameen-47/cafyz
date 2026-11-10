import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cafyz.app',
  appName: 'Cafyz',
  webDir: 'web-v2/dist',
  android: { path: 'cap-android' },
  ios: { path: 'cap-ios' },
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
    // Light theme is the default; ThemeProvider switches the status bar at runtime for dark.
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#e8edf4',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#e8edf4',
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
