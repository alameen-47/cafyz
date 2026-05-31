/**
 * Native Bluetooth ESC/POS bridge for Capacitor (Android + iOS).
 * Uses @capacitor-community/bluetooth-le — iOS WebKit blocks Web Bluetooth,
 * but the native BLE plugin works on iPhone/iPad for BLE thermal printers.
 */

import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { isNativeApp } from './platformEnv';

const BT_SERVICES = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '00001101-0000-1000-8000-00805f9b34fb',
];

let initialized = false;
let deviceId: string | null = null;
let deviceName = '';
let serviceUuid = '';
let charUuid = '';

export function canUseNativeBle(): boolean {
  return isNativeApp();
}

async function ensureBleReady(): Promise<void> {
  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true });
    initialized = true;
  }
}

export async function nativeConnectBluetooth(): Promise<string> {
  await ensureBleReady();

  const device = await BleClient.requestDevice({
    optionalServices: BT_SERVICES,
  });

  await BleClient.connect(device.deviceId);

  const services = await BleClient.getServices(device.deviceId);
  let writable: { service: string; characteristic: string } | null = null;

  for (const svc of services) {
    if (writable) break;
    for (const c of svc.characteristics) {
      const props = c.properties ?? {};
      if (props.write || props.writeWithoutResponse) {
        writable = { service: svc.uuid, characteristic: c.uuid };
        break;
      }
    }
  }

  if (!writable) {
    await BleClient.disconnect(device.deviceId);
    throw new Error('No writable characteristic found. Put the printer in pairing mode.');
  }

  deviceId = device.deviceId;
  deviceName = device.name || 'Bluetooth Printer';
  serviceUuid = writable.service;
  charUuid = writable.characteristic;

  return deviceName;
}

export async function nativePrintBluetooth(data: Uint8Array, chunkSize = 512, delayMs = 25): Promise<void> {
  if (!deviceId || !serviceUuid || !charUuid) {
    throw new Error('Bluetooth printer not connected.');
  }

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await BleClient.write(
      deviceId,
      serviceUuid,
      charUuid,
      numbersToDataView(Array.from(chunk)),
    );
    if (i + chunkSize < data.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

export function nativeDisconnectPrinter(): void {
  if (deviceId) {
    BleClient.disconnect(deviceId).catch(() => {});
  }
  deviceId = null;
  deviceName = '';
  serviceUuid = '';
  charUuid = '';
}

export function nativePrinterStatus(): { type: 'none' | 'bluetooth'; name: string } {
  if (deviceId) return { type: 'bluetooth', name: deviceName };
  return { type: 'none', name: '' };
}
