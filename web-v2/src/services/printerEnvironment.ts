import { isNativeApp } from './platformEnv';

export type PrinterPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface PrinterEnvironment {
  platform: PrinterPlatform;
  /** Added to home screen / installed PWA (standalone display mode). */
  isStandalone: boolean;
  isSecureContext: boolean;
  bluetoothAvailable: boolean;
  usbAvailable: boolean;
  /** True when Web Bluetooth can realistically be used from this context. */
  canUseBluetooth: boolean;
  /** Human-readable fix steps for the current device. */
  guidance: string[];
}

function detectPlatform(): PrinterPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari home-screen bookmark
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
  // PWA / Android TWA
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  return false;
}

export function getPrinterEnvironment(): PrinterEnvironment {
  const platform = detectPlatform();
  const isStandalone = detectStandalone();
  const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
  const bluetoothAvailable = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const usbAvailable = typeof navigator !== 'undefined' && 'usb' in navigator;

  const guidance: string[] = [];

  if (platform === 'ios') {
    if (isNativeApp()) {
      guidance.push(
        'Use a BLE ESC/POS thermal printer (not classic Bluetooth-only models).',
        'Turn on the printer and put it in pairing mode before tapping Pick Bluetooth printer.',
        'If the list is empty, pair once in system Bluetooth settings, then try again.',
      );
    } else {
      guidance.push(
        'Apple does not allow Bluetooth thermal printers from any iPhone browser — Safari, Chrome, and home-screen apps all use the same engine without Web Bluetooth.',
        'This is an Apple platform rule, not a Cafyz bug. No website can connect to BT ESC/POS printers on iPhone.',
        'Options: (1) Install the Cafyz iOS app from the App Store build for BLE printing. (2) Tap “Print receipt” for AirPrint. (3) Use Android or desktop for classic BT/USB.',
      );
    }
  } else if (platform === 'android') {
    if (isNativeApp()) {
      guidance.push(
        'Pair your thermal printer in Android Settings → Bluetooth first.',
        'Return here and tap your printer under Paired printers.',
        'If your printer is BLE-only, use Scan for BLE printer instead.',
      );
    } else if (isStandalone) {
      guidance.push(
        'If Bluetooth fails from the home-screen icon, open cafyz in Chrome from the address bar (not the bookmark icon) and connect there.',
      );
    }
    guidance.push(
      'Use Chrome or Edge on Android — not Samsung Internet or Firefox.',
      'Turn on Bluetooth and Location for Chrome (Android 12+ needs Location to scan for printers).',
      'Put the thermal printer in pairing mode; pair it once in Android Settings → Bluetooth if the picker shows nothing.',
    );
    if (!bluetoothAvailable) {
      guidance.push('This browser build has no Web Bluetooth — install Chrome from the Play Store.');
    }
  } else {
    guidance.push(
      'Use Chrome or Edge on desktop for Bluetooth/USB thermal printers.',
      'The site must be served over HTTPS (cafyz.ametronyx.com).',
    );
  }

  if (!isSecureContext) {
    guidance.unshift('Open the site via HTTPS — Bluetooth/USB printing does not work on insecure http:// pages.');
  }

  const canUseBluetooth = isNativeApp()
    ? true
    : isSecureContext && platform !== 'ios' && bluetoothAvailable;

  if (isNativeApp()) {
    return {
      platform,
      isStandalone: true,
      isSecureContext: true,
      bluetoothAvailable: true,
      usbAvailable: false,
      canUseBluetooth: true,
      guidance,
    };
  }

  return {
    platform,
    isStandalone,
    isSecureContext,
    bluetoothAvailable,
    usbAvailable,
    canUseBluetooth,
    guidance,
  };
}

export function formatPrinterConnectError(err: unknown, env = getPrinterEnvironment()): string {
  const e = err as Error & { name?: string };
  const name = e?.name ?? '';
  const msg = e?.message ?? String(err);

  if (env.platform === 'ios' && !isNativeApp()) {
    return 'Bluetooth thermal printers are not supported in iPhone Safari. Install the Cafyz iOS app or use “Print via Browser”.';
  }

  if (name === 'NotFoundError' || msg.includes('User cancelled')) {
    if (isNativeApp() && env.platform === 'android') {
      return 'No BLE printer found. Pair your printer in Android Settings → Bluetooth, then tap it under Paired printers (most thermal printers use classic Bluetooth, not BLE).';
    }
    return 'No printer selected. Put the printer in pairing mode and try again.';
  }

  if (msg.includes('No paired printers') || msg.includes('Multiple paired Bluetooth')) {
    return msg;
  }

  if (msg.includes('Permission denied') || msg.includes('permission denied')) {
    return 'Bluetooth permission denied. Open Android Settings → Apps → Cafyz → Permissions and allow Nearby devices / Bluetooth.';
  }

  if (name === 'SecurityError' || msg.includes('secure context')) {
    return 'Bluetooth blocked — open https://cafyz.ametronyx.com in Chrome (not an embedded browser).';
  }

  if (name === 'NetworkError' || msg.includes('GATT') || msg.includes('not connected')) {
    return 'Could not reach the printer. Turn it on, move closer, pair in system settings, then reconnect.';
  }

  if (msg.includes('writable characteristic')) {
    return 'Printer found but not writable. Use a BLE ESC/POS thermal printer, not a classic Bluetooth-only model.';
  }

  if (!env.bluetoothAvailable) {
    return 'Web Bluetooth is not available in this browser. Use Chrome on Android or Chrome/Edge on desktop.';
  }

  if (env.isStandalone && env.platform === 'android') {
    return `${msg} Try opening the site in Chrome (address bar) instead of the home-screen shortcut.`;
  }

  return msg;
}

export function isIosDevice(): boolean {
  return getPrinterEnvironment().platform === 'ios';
}
