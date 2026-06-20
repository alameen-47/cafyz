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
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#06091a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#06091a',
      overlaysWebView: true,
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
