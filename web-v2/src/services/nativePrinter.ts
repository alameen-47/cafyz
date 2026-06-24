/**
 * Native Bluetooth ESC/POS bridge for Capacitor (Android + iOS).
 * Android: Classic SPP (most thermal printers) with BLE fallback.
 * iOS: BLE only (WebKit blocks Web Bluetooth; classic needs MFi).
 */

import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { BluetoothPrinter } from '@kduma-autoid/capacitor-bluetooth-printer';
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './platformEnv';

/** Common BLE thermal-printer service UUIDs */
const BT_SERVICES = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '00001101-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
];

/** Known write characteristics (priority order) */
const PREFERRED_CHARS = [
  '49535343-8841-43f4-a8d4-c417ced0aeb0',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ffc1-0000-1000-8000-00805f9b34fb',
];

const STORAGE_KEY = 'cafyz_native_bt_v1';

type BtMode = 'ble' | 'classic';

interface SavedBtDevice {
  mode: BtMode;
  deviceId?: string;
  address?: string;
  deviceName: string;
  serviceUuid?: string;
  charUuid?: string;
  writeWithoutResponse?: boolean;
}

export interface PairedPrinterDevice {
  name: string;
  address: string;
  type: 'unknown' | 'classic' | 'le' | 'dual';
}

let initialized = false;
let connectionMode: BtMode | null = null;
let deviceId: string | null = null;
let classicAddress = '';
let deviceName = '';
let serviceUuid = '';
let charUuid = '';
let useWriteWithoutResponse = false;

export function canUseNativeBle(): boolean {
  return isNativeApp();
}

export function canUseClassicBluetooth(): boolean {
  return isNativeApp() && Capacitor.getPlatform() === 'android';
}

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase().replace(/-/g, '');
}

function bytesToLatin1(data: Uint8Array): string {
  const CHUNK = 8192;
  let out = '';
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.subarray(i, Math.min(i + CHUNK, data.length));
    out += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return out;
}

function loadSaved(): SavedBtDevice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBtDevice;
    if (!parsed?.deviceName) return null;
    if (parsed.mode === 'classic') {
      if (!parsed.address) return null;
      return parsed;
    }
    if (!parsed.deviceId || !parsed.serviceUuid || !parsed.charUuid) return null;
    return { ...parsed, mode: 'ble' };
  } catch {
    return null;
  }
}

function saveConnection(): void {
  if (!deviceName) return;
  try {
    if (connectionMode === 'classic' && classicAddress) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: 'classic',
        address: classicAddress,
        deviceName,
      } satisfies SavedBtDevice));
      return;
    }
    if (connectionMode === 'ble' && deviceId && serviceUuid && charUuid) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: 'ble',
        deviceId,
        deviceName,
        serviceUuid,
        charUuid,
        writeWithoutResponse: useWriteWithoutResponse,
      } satisfies SavedBtDevice));
    }
  } catch { /* ignore */ }
}

function clearSaved(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function clearSession(): void {
  connectionMode = null;
  deviceId = null;
  classicAddress = '';
  deviceName = '';
  serviceUuid = '';
  charUuid = '';
  useWriteWithoutResponse = false;
}

async function ensureBleReady(): Promise<void> {
  if (!canUseNativeBle()) {
    throw new Error('Bluetooth printing requires the Cafyz native app.');
  }
  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true });
    initialized = true;
  }
  const enabled = await BleClient.isEnabled();
  if (!enabled) {
    try {
      await BleClient.requestEnable();
    } catch {
      await BleClient.enable().catch(() => {});
    }
  }
}

async function disconnectActive(): Promise<void> {
  if (connectionMode === 'classic' && classicAddress) {
    try { await BluetoothPrinter.disconnect(); } catch { /* ignore */ }
  }
  if (deviceId) {
    try { await BleClient.disconnect(deviceId); } catch { /* ignore */ }
  }
  clearSession();
}

async function discoverAndBindBle(id: string, name: string): Promise<string> {
  try {
    await BleClient.discoverServices(id);
  } catch {
    // Some stacks discover automatically on connect.
  }

  const services = await BleClient.getServices(id);
  let fallback: { service: string; characteristic: string; writeWithoutResponse: boolean } | null = null;

  for (const pref of PREFERRED_CHARS) {
    const prefNorm = normalizeUuid(pref);
    for (const svc of services) {
      for (const c of svc.characteristics) {
        if (normalizeUuid(c.uuid) !== prefNorm) continue;
        const props = c.properties ?? {};
        if (props.writeWithoutResponse || props.write) {
          connectionMode = 'ble';
          deviceId = id;
          deviceName = name || 'Bluetooth Printer';
          serviceUuid = svc.uuid;
          charUuid = c.uuid;
          useWriteWithoutResponse = Boolean(props.writeWithoutResponse);
          saveConnection();
          return deviceName;
        }
      }
    }
  }

  for (const svc of services) {
    for (const c of svc.characteristics) {
      const props = c.properties ?? {};
      if (props.writeWithoutResponse) {
        connectionMode = 'ble';
        deviceId = id;
        deviceName = name || 'Bluetooth Printer';
        serviceUuid = svc.uuid;
        charUuid = c.uuid;
        useWriteWithoutResponse = true;
        saveConnection();
        return deviceName;
      }
      if (props.write && !fallback) {
        fallback = { service: svc.uuid, characteristic: c.uuid, writeWithoutResponse: false };
      }
    }
  }

  if (fallback) {
    connectionMode = 'ble';
    deviceId = id;
    deviceName = name || 'Bluetooth Printer';
    serviceUuid = fallback.service;
    charUuid = fallback.characteristic;
    useWriteWithoutResponse = fallback.writeWithoutResponse;
    saveConnection();
    return deviceName;
  }

  await BleClient.disconnect(id);
  throw new Error('Printer found but has no writable channel. Try a paired classic printer instead.');
}

async function connectBleDeviceId(id: string, name: string): Promise<string> {
  await BleClient.connect(id);
  if (Capacitor.getPlatform() === 'android') {
    try { await BleClient.createBond(id); } catch { /* optional */ }
  }
  return discoverAndBindBle(id, name);
}

function namesMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

async function tryBondedBleByName(targetName?: string): Promise<string | null> {
  if (!targetName || Capacitor.getPlatform() !== 'android') return null;
  try {
    const devices = await BleClient.getBondedDevices();
    const match = devices.find(d => d.name && namesMatch(d.name, targetName));
    if (!match) return null;
    return await connectBleDeviceId(match.deviceId, match.name || targetName);
  } catch {
    return null;
  }
}

async function connectClassic(address: string, name: string): Promise<string> {
  if (!canUseClassicBluetooth()) {
    throw new Error('Classic Bluetooth printers are supported on the Android app.');
  }
  await ensureBleReady();
  await disconnectActive();
  await BluetoothPrinter.connect({ address });
  connectionMode = 'classic';
  classicAddress = address;
  deviceName = name || 'Bluetooth Printer';
  saveConnection();
  return deviceName;
}

function isLikelyPrinterName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return /printer|print|pos|rpp|xp-|mtp|inner|thermal|tsp|tm-|esc|58mm|80mm|rongta|goojprt|munbyn|xprinter|bluetooth printer|bt[- ]?/i.test(n);
}

async function listPairedDevices(): Promise<PairedPrinterDevice[]> {
  const seen = new Map<string, PairedPrinterDevice>();

  if (canUseClassicBluetooth()) {
    try {
      const { devices } = await BluetoothPrinter.list();
      for (const d of devices) {
        seen.set(d.address, {
          name: d.name || 'Unknown device',
          address: d.address,
          type: d.type as PairedPrinterDevice['type'],
        });
      }
    } catch {
      // Fall back to BLE bonded list below.
    }
  }

  if (Capacitor.getPlatform() === 'android') {
    try {
      const bonded = await BleClient.getBondedDevices();
      for (const d of bonded) {
        if (!d.deviceId || seen.has(d.deviceId)) continue;
        seen.set(d.deviceId, {
          name: d.name || 'Unknown device',
          address: d.deviceId,
          type: 'unknown',
        });
      }
    } catch {
      // Ignore — classic list may be enough.
    }
  }

  return Array.from(seen.values());
}

export async function nativeListPairedPrinters(): Promise<PairedPrinterDevice[]> {
  if (!canUseClassicBluetooth()) return [];
  try {
    await ensureBleReady();
    return await listPairedDevices();
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    if (msg.includes('Permission denied')) {
      throw new Error('Bluetooth permission denied. Allow Nearby devices / Bluetooth in Android app settings.');
    }
    throw err;
  }
}

export async function nativeConnectClassic(address: string, name: string): Promise<string> {
  return connectClassic(address, name);
}

export async function nativeAutoReconnect(targetName?: string): Promise<{ connected: boolean; name?: string }> {
  if (!canUseNativeBle()) return { connected: false };
  if (connectionMode) return { connected: true, name: deviceName || 'Bluetooth Printer' };

  try {
    await ensureBleReady();
  } catch {
    return { connected: false };
  }

  const saved = loadSaved();
  if (saved?.mode === 'classic' && saved.address) {
    try {
      return { connected: true, name: await connectClassic(saved.address, saved.deviceName) };
    } catch {
      clearSaved();
      clearSession();
    }
  }

  if (canUseClassicBluetooth() && targetName) {
    try {
      const devices = await listPairedDevices();
      const match = devices.find(d => d.name && namesMatch(d.name, targetName));
      if (match) {
        return { connected: true, name: await connectClassic(match.address, match.name || targetName) };
      }
    } catch { /* fall through */ }
  }

  const bondedBle = await tryBondedBleByName(targetName);
  if (bondedBle) return { connected: true, name: bondedBle };

  if (saved?.mode === 'ble' && saved.deviceId && saved.serviceUuid && saved.charUuid) {
    try {
      return { connected: true, name: await connectBleDeviceId(saved.deviceId, saved.deviceName) };
    } catch {
      clearSaved();
      clearSession();
    }
  }

  return { connected: false };
}

/** Connect to a paired classic (SPP) printer — preferred on Android. */
export async function nativeConnectClassicBluetooth(hintName?: string): Promise<string> {
  if (!canUseClassicBluetooth()) {
    throw new Error('Classic Bluetooth is only available in the Android app.');
  }
  await ensureBleReady();
  if (connectionMode) await disconnectActive();

  const devices = await listPairedDevices();
  if (devices.length === 0) {
    throw new Error('No paired printers found. Open Android Settings → Bluetooth, pair your thermal printer, then return here.');
  }

  if (hintName) {
    const match = devices.find(d => namesMatch(d.name, hintName));
    if (match) return connectClassic(match.address, match.name || hintName);
  }

  const printerLike = devices.filter(d => isLikelyPrinterName(d.name));
  const pool = printerLike.length > 0 ? printerLike : devices;

  if (pool.length === 1) {
    const only = pool[0];
    return connectClassic(only.address, only.name || hintName || 'Bluetooth Printer');
  }

  throw new Error('Multiple paired Bluetooth devices — tap your printer in the Paired printers list above.');
}

/** Scan and connect a BLE-only printer (fallback). */
export async function nativeScanBleBluetooth(hintName?: string): Promise<string> {
  await ensureBleReady();
  if (connectionMode) await disconnectActive();

  const bondedBle = await tryBondedBleByName(hintName);
  if (bondedBle) return bondedBle;

  const device = await BleClient.requestDevice({
    optionalServices: BT_SERVICES,
  });

  return connectBleDeviceId(device.deviceId, device.name || hintName || 'Bluetooth Printer');
}

export async function nativeConnectBluetooth(hintName?: string): Promise<string> {
  if (canUseClassicBluetooth()) {
    return nativeConnectClassicBluetooth(hintName);
  }
  return nativeScanBleBluetooth(hintName);
}

export async function nativePrintBluetooth(data: Uint8Array): Promise<void> {
  if (!connectionMode) {
    throw new Error('Bluetooth printer not connected. Open Printer setup and connect first.');
  }

  if (connectionMode === 'classic') {
    if (!classicAddress) {
      throw new Error('Classic Bluetooth printer not connected.');
    }
    const CHUNK = 4096;
    const payload = bytesToLatin1(data);
    for (let i = 0; i < payload.length; i += CHUNK) {
      await BluetoothPrinter.print({ data: payload.slice(i, i + CHUNK) });
      if (i + CHUNK < payload.length) {
        await new Promise(r => setTimeout(r, 20));
      }
    }
    return;
  }

  if (!deviceId || !serviceUuid || !charUuid) {
    throw new Error('Bluetooth printer not connected. Open Printer setup and connect first.');
  }

  let mtu = 180;
  try {
    const value = await BleClient.getMtu(deviceId);
    if (value > 23) mtu = Math.min(512, value - 3);
  } catch { /* default chunk */ }

  const delayMs = mtu <= 23 ? 50 : 25;
  const view = (chunk: Uint8Array) => numbersToDataView(Array.from(chunk));

  for (let i = 0; i < data.length; i += mtu) {
    const chunk = data.slice(i, i + mtu);
    if (useWriteWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, serviceUuid, charUuid, view(chunk));
    } else {
      await BleClient.write(deviceId, serviceUuid, charUuid, view(chunk));
    }
    if (i + mtu < data.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

export function nativeDisconnectPrinter(): void {
  void disconnectActive();
  clearSaved();
}

export function nativePrinterStatus(): { type: 'none' | 'bluetooth'; name: string } {
  if (connectionMode) return { type: 'bluetooth', name: deviceName };
  return { type: 'none', name: '' };
}
