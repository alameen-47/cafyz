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
