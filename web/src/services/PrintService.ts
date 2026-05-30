// ─── Cafyz PrintService ───────────────────────────────────────────────────────
// Thermal printer support via Web Bluetooth, Web USB, or browser print dialog.
// ESC/POS command builder is self-contained — no dependencies.

import { getRestaurantLogo } from './restaurantLogoStorage';
import { logoDataUrlToEscPos } from './logoThermalRaster';

// ── ESC/POS Builder ───────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS  = 0x1d;

class EscPosBuilder {
  private buf: number[] = [];

  push(...bytes: number[]) { this.buf.push(...bytes); return this; }

  pushBytes(arr: Uint8Array) {
    for (let i = 0; i < arr.length; i++) this.buf.push(arr[i]);
    return this;
  }

  init()         { return this.push(ESC, 0x40); }           // ESC @
  alignLeft()    { return this.push(ESC, 0x61, 0x00); }     // ESC a 0
  alignCenter()  { return this.push(ESC, 0x61, 0x01); }     // ESC a 1
  alignRight()   { return this.push(ESC, 0x61, 0x02); }     // ESC a 2
  boldOn()       { return this.push(ESC, 0x45, 0x01); }     // ESC E 1
  boldOff()      { return this.push(ESC, 0x45, 0x00); }     // ESC E 0
  bigOn()        { return this.push(GS,  0x21, 0x11); }     // GS ! double width+height
  bigOff()       { return this.push(GS,  0x21, 0x00); }     // GS ! normal
  underlineOn()  { return this.push(ESC, 0x2d, 0x01); }     // ESC - 1
  underlineOff() { return this.push(ESC, 0x2d, 0x00); }     // ESC - 0

  text(str: string) {
    const enc = new TextEncoder();
    const bytes = enc.encode(str);
    this.buf.push(...bytes);
    return this;
  }

  nl(n = 1) {
    for (let i = 0; i < n; i++) this.buf.push(0x0a);
    return this;
  }

  divider(width = 32, char = '-') {
    return this.text(char.repeat(width)).nl();
  }

  // Right-aligned row: left text + right text padded to `width` chars
  row(left: string, right: string, width = 32) {
    const gap = width - left.length - right.length;
    const pad = gap > 0 ? ' '.repeat(gap) : ' ';
    return this.text(left + pad + right).nl();
  }

  feed(n = 4) { return this.push(ESC, 0x64, n); }           // ESC d n
  cut()       { return this.push(GS,  0x56, 0x42, 0x00); }  // GS V 42 0 (partial cut)

  build(): Uint8Array { return new Uint8Array(this.buf); }
}

// ── Receipt Data ──────────────────────────────────────────────────────────────

export interface ReceiptData {
  restaurantName: string;
  logoUrl?:       string;
  addressLine?:   string;
  phone?:         string;
  taxId?:         string;
  tableName:      string;
  serverName?:    string;
  covers?:        number;
  items:          { name: string; qty: number; price: number }[];
  subtotal:       number;
  service:        number;
  tax:            number;
  total:          number;
  payMethod?:     string;
  note?:          string;
  dateStr?:       string;
}

export interface KitchenTicketData {
  restaurantName: string;
  logoUrl?: string;
  ticketId: string;
  tableName: string;
  serverName?: string;
  covers?: number;
  station?: string;
  items: { name: string; qty: number; mods?: string[]; alert?: boolean }[];
  note?: string;
  createdAt?: string;
}

// Build ESC/POS bytes for a receipt (32-char width for 58mm, 48-char for 80mm)
// logoBytes: pre-rendered GS-v-0 raster image bytes from prepareLogoEscPos()
export function buildReceipt(data: ReceiptData, width = 32, logoBytes?: Uint8Array): Uint8Array {
  const b = new EscPosBuilder();
  const W = width;
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const date = data.dateStr ?? new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  b.init();

  // Header
  b.alignCenter();
  if (logoBytes) {
    b.pushBytes(logoBytes).nl(2);
    b.alignCenter();
  }
  b.boldOn().bigOn().text(data.restaurantName).bigOff().boldOff().nl(2);
  if (data.addressLine) b.text(data.addressLine).nl();
  if (data.phone) b.text(`Tel: ${data.phone}`).nl();
  if (data.taxId) b.text(`Tax ID: ${data.taxId}`).nl();

  if (data.tableName) b.text(`Table: ${data.tableName}`).nl();
  if (data.serverName) b.text(`Server: ${data.serverName}`).nl();
  if (data.covers) b.text(`Covers: ${data.covers}`).nl();
  b.text(date).nl();

  b.divider(W);

  // Items
  b.alignLeft();
  for (const item of data.items) {
    const name  = item.name.length > W - 10 ? item.name.slice(0, W - 11) + '…' : item.name;
    const price = fmt(item.price * item.qty);
    b.row(`${item.qty}x ${name}`, price, W);
  }

  // Special instructions
  if (data.note) {
    b.nl().text(`Note: ${data.note}`).nl();
  }

  // Totals
  b.divider(W);
  b.row('Subtotal', fmt(data.subtotal), W);
  b.row('Service 18%', fmt(data.service), W);
  b.row('Tax 8.75%', fmt(data.tax), W);
  b.divider(W);
  b.boldOn().row('TOTAL DUE', fmt(data.total), W).boldOff();

  if (data.payMethod) {
    b.divider(W);
    b.alignCenter().text(`Paid by ${data.payMethod}`).nl();
  }

  // Footer
  b.nl().alignCenter()
   .text('Thank you for your visit!').nl()
   .text('cafyz.com').nl(2);

  b.feed(4).cut();

  return b.build();
}

// Build styled HTML receipt for the browser print dialog
export function buildReceiptHTML(data: ReceiptData): string {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const date = data.dateStr ?? new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const rows = data.items.map(it => `
    <tr>
      <td style="padding:1px 0">${it.qty}× ${it.name}</td>
      <td style="text-align:right;padding:1px 0">${fmt(it.price * it.qty)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt — ${data.restaurantName}</title>
<style>
  @page { size: 72mm auto; margin: 6mm; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 60mm; margin: 0 auto; }
  .center { text-align: center; }
  .right  { text-align: right; }
  h1 { font-size: 15px; margin: 4px 0; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .total-row td { font-weight: bold; font-size: 14px; padding-top: 4px; }
  @media print { body { width: 60mm; } }
</style>
</head>
<body>
<div class="center receipt-header">
  <h1>${data.restaurantName}</h1>
  ${data.addressLine ? `<p>${data.addressLine}</p>` : ''}
  ${data.phone ? `<p>Tel: ${data.phone}</p>` : ''}
  ${data.taxId ? `<p>Tax ID: ${data.taxId}</p>` : ''}
  ${data.tableName ? `<p>Table: ${data.tableName}</p>` : ''}
  ${data.serverName ? `<p>Server: ${data.serverName}</p>` : ''}
  ${data.covers ? `<p>Covers: ${data.covers}</p>` : ''}
  <p>${date}</p>
</div>
<hr>
<table>
  <tbody>${rows}</tbody>
</table>
${data.note ? `<p style="font-size:11px;margin:4px 0">Note: ${data.note}</p>` : ''}
<hr>
<table>
  <tr><td>Subtotal</td><td class="right">${fmt(data.subtotal)}</td></tr>
  <tr><td>Service 18%</td><td class="right">${fmt(data.service)}</td></tr>
  <tr><td>Tax 8.75%</td><td class="right">${fmt(data.tax)}</td></tr>
</table>
<hr>
<table>
  <tr class="total-row"><td>TOTAL DUE</td><td class="right">${fmt(data.total)}</td></tr>
</table>
${data.payMethod ? `<hr><p class="center">Paid by ${data.payMethod}</p>` : ''}
<hr>
<div class="center">
  <p>Thank you for your visit!</p>
  <p>cafyz.com</p>
</div>
</body>
</html>`;
}

export function buildKitchenTicket(data: KitchenTicketData, width = 32, logoBytes?: Uint8Array): Uint8Array {
  const b = new EscPosBuilder();
  const W = width;
  const ts = data.createdAt ? new Date(data.createdAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
  b.init().alignCenter();
  if (logoBytes) {
    b.pushBytes(logoBytes).nl(2);
    b.alignCenter();
  }
  b.boldOn().bigOn().text(data.restaurantName).bigOff().boldOff().nl();
  b.boldOn().text('KITCHEN TICKET').boldOff().nl();
  b.divider(W);
  b.alignLeft();
  b.text(`Ticket: #${data.ticketId.slice(0, 8).toUpperCase()}`).nl();
  b.text(`Table: ${data.tableName}`).nl();
  if (data.serverName) b.text(`Server: ${data.serverName}`).nl();
  if (data.covers) b.text(`Covers: ${data.covers}`).nl();
  if (data.station) b.text(`Station: ${data.station}`).nl();
  b.text(ts).nl();
  b.divider(W);
  for (const it of data.items) {
    const name = `${it.alert ? '⚠ ' : ''}${it.qty}x ${it.name}`;
    b.text(name).nl();
    for (const m of (it.mods ?? [])) b.text(` · ${m}`).nl();
  }
  if (data.note) {
    b.divider(W);
    b.text(`Note: ${data.note}`).nl();
  }
  b.feed(4).cut();
  return b.build();
}

export function buildKitchenTicketHTML(data: KitchenTicketData): string {
  const ts = data.createdAt ? new Date(data.createdAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
  const rows = data.items.map(it => `
    <tr>
      <td style="padding:2px 0;font-weight:700">${it.alert ? '⚠ ' : ''}${it.qty}× ${it.name}</td>
    </tr>
    ${(it.mods ?? []).map(m => `<tr><td style="padding:1px 0 1px 14px;font-size:11px">· ${m}</td></tr>`).join('')}
  `).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kitchen Ticket</title>
  <style>
    @page { size: 72mm auto; margin: 6mm; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 60mm; margin: 0 auto; }
    .center { text-align: center; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    h1 { font-size: 14px; margin: 4px 0; }
  </style></head><body>
  <div class="center ticket-header">
    <h1>${data.restaurantName}</h1>
    <p><b>KITCHEN TICKET</b></p>
  </div>
  <hr>
  <p><b>Ticket:</b> #${data.ticketId.slice(0, 8).toUpperCase()}</p>
  <p><b>Table:</b> ${data.tableName}</p>
  ${data.serverName ? `<p><b>Server:</b> ${data.serverName}</p>` : ''}
  ${data.covers ? `<p><b>Covers:</b> ${data.covers}</p>` : ''}
  ${data.station ? `<p><b>Station:</b> ${data.station}</p>` : ''}
  <p>${ts}</p>
  <hr><table><tbody>${rows}</tbody></table>
  ${data.note ? `<hr><p><b>Note:</b> ${data.note}</p>` : ''}
  </body></html>`;
}

// ── Bluetooth ─────────────────────────────────────────────────────────────────
// Known service UUIDs for common thermal printers
const BT_SERVICES = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Xprinter / Munbyn / many Chinese 58mm
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic Serial Port Profile (SPP)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // BlueMunsell / BM series
  '00001101-0000-1000-8000-00805f9b34fb', // Classic SPP (some BLE bridges)
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let btChar:   any = null;  // BluetoothRemoteGATTCharacteristic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let btDevice: any = null;  // BluetoothDevice
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let usbDevice: any = null; // USBDevice

async function writeChunked(
  char: { writeValue: (data: Uint8Array) => Promise<void> },
  data: Uint8Array,
  chunkSize = 512,
  delayMs = 25,
): Promise<void> {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await char.writeValue(chunk);
    if (i + chunkSize < data.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

export async function connectBluetooth(): Promise<string> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
  }
  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BT_SERVICES,
  });

  const server = await device.gatt!.connect();

  // Iterate all services to find a writable characteristic
  const services = await server.getPrimaryServices();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let writable: any = null; // BluetoothRemoteGATTCharacteristic

  for (const svc of services) {
    if (writable) break;
    try {
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writable = c;
          break;
        }
      }
    } catch {
      // Some services may not be readable — skip
    }
  }

  if (!writable) {
    throw new Error('No writable characteristic found. Make sure the printer is in BT pairing mode.');
  }

  btChar   = writable;
  btDevice = device;

  // Cleanup on disconnect
  device.addEventListener('gattserverdisconnected', () => {
    btChar   = null;
    btDevice = null;
  });

  return device.name || 'Bluetooth Printer';
}

export async function connectUSB(): Promise<string> {
  if (!('usb' in navigator)) {
    throw new Error('Web USB is not supported in this browser. Use Chrome or Edge.');
  }
  // Class code 7 = Printer
  const device = await (navigator as any).usb.requestDevice({ filters: [{ classCode: 7 }] });
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  // Claim first interface
  const iface = device.configuration.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);

  usbDevice = device;
  return device.productName || 'USB Printer';
}

export function disconnectPrinter() {
  if (btDevice?.gatt?.connected) btDevice.gatt.disconnect();
  btChar = null; btDevice = null;
  if (usbDevice) { usbDevice.close().catch(() => {}); usbDevice = null; }
}

export function printerStatus(): { type: 'none' | 'bluetooth' | 'usb'; name: string } {
  if (btDevice) return { type: 'bluetooth', name: btDevice.name || 'BT Printer' };
  if (usbDevice) return { type: 'usb', name: usbDevice.productName || 'USB Printer' };
  return { type: 'none', name: '' };
}

// ── ESC/POS raster logo (via shared dithered thermal pipeline) ─────────────────

async function requireLogoEscPos(logoUrl: string): Promise<Uint8Array> {
  try {
    const bytes = await logoDataUrlToEscPos(logoUrl);
    if (bytes.length < 12) throw new Error('Raster data empty.');
    return bytes;
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown error';
    throw new Error(
      `Logo could not be sent to the printer (${detail}). ` +
      'Re-upload the logo in Manager → Restaurant Profile (PNG or JPG, up to 2 MB).',
    );
  }
}

function resolveLogoUrl(logoUrl?: string, restaurantId?: string): string | undefined {
  return logoUrl ?? getRestaurantLogo(restaurantId);
}

async function buildHardwareReceiptBytes(
  data: ReceiptData,
  width: number,
  escposData?: Uint8Array,
): Promise<Uint8Array> {
  if (escposData) return escposData;
  const logoBytes = data.logoUrl ? await requireLogoEscPos(data.logoUrl) : undefined;
  return buildReceipt(data, width, logoBytes);
}

async function buildHardwareKitchenBytes(data: KitchenTicketData): Promise<Uint8Array> {
  const logoBytes = data.logoUrl ? await requireLogoEscPos(data.logoUrl) : undefined;
  return buildKitchenTicket(data, 32, logoBytes);
}

// ── Print dispatcher ──────────────────────────────────────────────────────────

async function printBluetooth(data: Uint8Array): Promise<void> {
  if (!btChar) throw new Error('Bluetooth printer not connected.');
  await writeChunked(btChar, data);
}

async function printUSB(data: Uint8Array): Promise<void> {
  if (!usbDevice) throw new Error('USB printer not connected.');
  const iface    = usbDevice.configuration!.interfaces[0];
  const altIface = iface.alternates[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endpoint = altIface.endpoints.find((e: any) => e.direction === 'out');
  if (!endpoint) throw new Error('No OUT endpoint on USB printer.');
  const chunkSize = 4096;
  for (let i = 0; i < data.length; i += chunkSize) {
    await usbDevice.transferOut(endpoint.endpointNumber, data.slice(i, i + chunkSize));
  }
}

function waitForWindowImages(win: Window, onReady: () => void, onLogoError?: () => void): void {
  const triggerPrint = () => {
    if (win.closed) return;
    onReady();
    setTimeout(() => { if (!win.closed) win.close(); }, 900);
  };

  const waitForImagesThenPrint = () => {
    try {
      const images = Array.from(win.document.images);
      if (!images.length) { triggerPrint(); return; }

      let pending = images.filter(img => !img.complete).length;
      if (pending === 0) { triggerPrint(); return; }

      let logoFailed = false;
      const done = () => {
        pending -= 1;
        if (pending <= 0) {
          if (logoFailed && onLogoError) onLogoError();
          else triggerPrint();
        }
      };
      images.forEach(img => {
        if (img.complete) return;
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', () => {
          if (img.alt === 'Restaurant logo') logoFailed = true;
          done();
        }, { once: true });
      });

      setTimeout(() => {
        if (!win.closed) {
          if (images.some(img => img.alt === 'Restaurant logo' && !img.complete)) logoFailed = true;
          if (logoFailed && onLogoError) onLogoError();
          else triggerPrint();
        }
      }, 8000);
    } catch {
      triggerPrint();
    }
  };

  win.onload = waitForImagesThenPrint;
  setTimeout(waitForImagesThenPrint, 450);
}

function printDialog(receiptData: ReceiptData): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window.open('', '_blank', 'width=340,height=600');
    if (!win) {
      reject(new Error('Pop-up blocked — please allow pop-ups for this site.'));
      return;
    }

    const doc = win.document;
    doc.open();
    doc.write(buildReceiptHTML({ ...receiptData, logoUrl: undefined }));
    doc.close();

    if (receiptData.logoUrl) {
      const header = doc.querySelector('.receipt-header');
      if (!header) {
        reject(new Error('Receipt layout error — could not place logo.'));
        return;
      }
      const img = doc.createElement('img');
      img.alt = 'Restaurant logo';
      img.src = receiptData.logoUrl;
      img.style.cssText = 'max-width:150px;max-height:72px;object-fit:contain;margin:0 auto 6px;display:block';
      header.insertBefore(img, header.firstChild);
    }

    win.focus();
    waitForWindowImages(
      win,
      () => { win.print(); resolve(); },
      () => reject(new Error('Logo failed to load for print preview. Re-upload in Restaurant Profile.')),
    );
  });
}

function printDialogHtml(html: string): void {
  const win  = window.open('', '_blank', 'width=340,height=600');
  if (!win) throw new Error('Pop-up blocked — please allow pop-ups for this site.');
  win.document.write(html);
  win.document.close();
  win.focus();
  const triggerPrint = () => {
    if (win.closed) return;
    win.print();
    setTimeout(() => win.close(), 900);
  };
  const waitForImagesThenPrint = () => {
    try {
      const images = Array.from(win.document.images);
      if (!images.length) { triggerPrint(); return; }
      let pending = images.filter(img => !img.complete).length;
      if (pending === 0) { triggerPrint(); return; }
      const done = () => { pending -= 1; if (pending <= 0) triggerPrint(); };
      images.forEach(img => {
        if (img.complete) return;
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
      setTimeout(() => { if (!win.closed) triggerPrint(); }, 5000);
    } catch { triggerPrint(); }
  };
  win.onload = waitForImagesThenPrint;
  setTimeout(waitForImagesThenPrint, 450);
}

/**
 * Smart print: BT → USB → browser dialog.
 * When a logo URL is present and a hardware printer is connected, the logo is
 * rendered via the Canvas API into a GS-v-0 raster image and embedded in the
 * ESC/POS stream.  The browser print dialog is used only when no hardware
 * printer is connected; the HTML receipt already renders the logo as an <img>.
 */
export async function print(
  receiptData: ReceiptData,
  escposData?: Uint8Array,
  width = 32,
  restaurantId?: string,
): Promise<'bluetooth' | 'usb' | 'dialog'> {
  const logoUrl = resolveLogoUrl(receiptData.logoUrl, restaurantId);
  const data: ReceiptData = logoUrl ? { ...receiptData, logoUrl } : receiptData;

  if (btChar || usbDevice) {
    const bytes = await buildHardwareReceiptBytes(data, width, escposData);
    if (btChar) {
      await printBluetooth(bytes);
      return 'bluetooth';
    }
    await printUSB(bytes);
    return 'usb';
  }

  await printDialog(data);
  return 'dialog';
}

/**
 * Test print — verifies the connected printer works and that the logo renders.
 * Builds a sample receipt from the restaurant's own name + logo and sends it via
 * the same BT → USB → dialog path used for real receipts. Returns the channel
 * used so the UI can confirm where the test went.
 */
export async function printTest(opts: {
  restaurantName: string;
  restaurantId?: string;
  logoUrl?: string;
  addressLine?: string;
  phone?: string;
}): Promise<'bluetooth' | 'usb' | 'dialog'> {
  const logoUrl = resolveLogoUrl(opts.logoUrl, opts.restaurantId);
  const sample: ReceiptData = {
    restaurantName: opts.restaurantName || 'Cafyz',
    logoUrl,
    addressLine: opts.addressLine,
    phone: opts.phone,
    tableName: 'TEST',
    serverName: 'Cafyz',
    covers: 2,
    items: [
      { name: 'Test Print — Margherita', qty: 1, price: 12.0 },
      { name: 'Espresso', qty: 2, price: 3.5 },
    ],
    subtotal: 19.0,
    service: 3.42,
    tax: 1.66,
    total: 24.08,
    payMethod: 'TEST',
    note: 'This is a printer test — connection and logo OK.',
  };
  return print(sample, undefined, 32, opts.restaurantId);
}

export async function printKitchenTicket(
  data: KitchenTicketData,
  restaurantId?: string,
): Promise<'bluetooth' | 'usb' | 'dialog'> {
  const logoUrl = resolveLogoUrl(data.logoUrl, restaurantId);
  const ticket: KitchenTicketData = logoUrl ? { ...data, logoUrl } : data;

  if (btChar || usbDevice) {
    const bytes = await buildHardwareKitchenBytes(ticket);
    if (btChar) { await printBluetooth(bytes); return 'bluetooth'; }
    await printUSB(bytes); return 'usb';
  }
  await printKitchenDialog(ticket);
  return 'dialog';
}

function printKitchenDialog(data: KitchenTicketData): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window.open('', '_blank', 'width=340,height=600');
    if (!win) {
      reject(new Error('Pop-up blocked — please allow pop-ups for this site.'));
      return;
    }
    const doc = win.document;
    doc.open();
    doc.write(buildKitchenTicketHTML({ ...data, logoUrl: undefined }));
    doc.close();
    if (data.logoUrl) {
      const header = doc.querySelector('.ticket-header');
      if (!header) {
        reject(new Error('Ticket layout error — could not place logo.'));
        return;
      }
      const img = doc.createElement('img');
      img.alt = 'Restaurant logo';
      img.src = data.logoUrl;
      img.style.cssText = 'max-width:150px;max-height:72px;object-fit:contain;margin:0 auto 6px;display:block';
      header.insertBefore(img, header.firstChild);
    }
    win.focus();
    waitForWindowImages(
      win,
      () => { win.print(); resolve(); },
      () => reject(new Error('Logo failed to load for kitchen ticket print.')),
    );
  });
}

// ── Sales & monthly reports (browser print — logo rendered via <img>) ─────────

export interface RestaurantPrintMeta {
  restaurantName: string;
  logoUrl?:       string;
  addressLine?:   string;
  phone?:         string;
  taxId?:         string;
  email?:         string;
}

export interface SalesReportData extends RestaurantPrintMeta {
  title:        string;
  periodLabel:  string;
  generatedAt?: string;
  metrics:      { label: string; value: string }[];
  rows:         { label: string; orders?: number; revenue: number }[];
  totalRevenue: number;
  totalOrders:  number;
  demo?:        boolean;
}

export interface MonthlyReportData extends RestaurantPrintMeta {
  monthLabel:   string;
  generatedAt?: string;
  days:         { day: string; orders: number; revenue: number }[];
  totalRevenue: number;
  totalOrders:  number;
  avgPerDay:    number;
  demo?:        boolean;
}

function reportStyles(): string {
  return `
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: Inter, Arial, sans-serif; font-size: 13px; color: #111; margin: 0; }
  .header { text-align: center; margin-bottom: 18px; }
  .header img { max-width: 180px; max-height: 90px; object-fit: contain; margin: 0 auto 10px; display: block; }
  h1 { font-size: 22px; margin: 6px 0 4px; }
  h2 { font-size: 15px; margin: 0 0 6px; color: #444; font-weight: 600; }
  .meta { font-size: 12px; color: #555; line-height: 1.5; }
  .demo { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; padding: 2px 8px; border-radius: 999px; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
  td.num, th.num { text-align: right; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
  .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
  .metric-label { font-size: 11px; color: #666; text-transform: uppercase; }
  .metric-val { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .total { margin-top: 16px; font-size: 16px; font-weight: 700; text-align: right; }
  .footer { margin-top: 24px; font-size: 11px; color: #888; text-align: center; }
  @media print { .no-print { display: none; } }`;
}

function reportHeader(meta: RestaurantPrintMeta, title: string, periodLabel: string, demo?: boolean): string {
  const gen = new Date().toLocaleString('en-GB');
  return `<div class="header">
    ${meta.logoUrl ? `<img src="${meta.logoUrl}" alt="Logo" />` : ''}
    <h1>${meta.restaurantName}</h1>
    <h2>${title}</h2>
    <div class="meta">
      ${periodLabel}<br/>
      ${meta.addressLine ? `${meta.addressLine}<br/>` : ''}
      ${meta.phone ? `Tel: ${meta.phone}<br/>` : ''}
      ${meta.taxId ? `Tax ID: ${meta.taxId}<br/>` : ''}
      Generated: ${gen}
    </div>
    ${demo ? '<div class="demo">DEMO SAMPLE DATA</div>' : ''}
  </div>`;
}

export function buildSalesReportHTML(data: SalesReportData): string {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const metrics = data.metrics.map(m => `
    <div class="metric"><div class="metric-label">${m.label}</div><div class="metric-val">${m.value}</div></div>`).join('');
  const rows = data.rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td class="num">${r.orders ?? '—'}</td>
      <td class="num">${fmt(r.revenue)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.title}</title>
  <style>${reportStyles()}</style></head><body>
  ${reportHeader(data, data.title, data.periodLabel, data.demo)}
  <div class="metrics">${metrics}</div>
  <table>
    <thead><tr><th>Item / Category</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total orders: ${data.totalOrders} · Gross revenue: ${fmt(data.totalRevenue)}</div>
  <div class="footer">Cafyz Hospitality OS · ${data.restaurantName}</div>
  </body></html>`;
}

export function buildMonthlyReportHTML(data: MonthlyReportData): string {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const rows = data.days.map(d => `
    <tr><td>${d.day}</td><td class="num">${d.orders}</td><td class="num">${fmt(d.revenue)}</td></tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monthly Report</title>
  <style>${reportStyles()}</style></head><body>
  ${reportHeader(data, 'Monthly Sales Report', data.monthLabel, data.demo)}
  <div class="metrics">
    <div class="metric"><div class="metric-label">Total Revenue</div><div class="metric-val">${fmt(data.totalRevenue)}</div></div>
    <div class="metric"><div class="metric-label">Total Orders</div><div class="metric-val">${data.totalOrders}</div></div>
    <div class="metric"><div class="metric-label">Avg / Day</div><div class="metric-val">${fmt(data.avgPerDay)}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Month total: ${fmt(data.totalRevenue)}</div>
  <div class="footer">Cafyz Hospitality OS · ${data.restaurantName}</div>
  </body></html>`;
}

export function buildDemoSalesReport(meta: RestaurantPrintMeta): SalesReportData {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return {
    ...meta,
    title: 'Daily Sales Report',
    periodLabel: today,
    demo: true,
    metrics: [
      { label: 'Covers served', value: '86' },
      { label: 'Avg check', value: '$33.03' },
      { label: 'Tables turned', value: '24' },
    ],
    rows: [
      { label: 'Mains — Grill', orders: 28, revenue: 812.0 },
      { label: 'Mains — Pasta', orders: 19, revenue: 456.5 },
      { label: 'Starters', orders: 34, revenue: 408.0 },
      { label: 'Desserts', orders: 22, revenue: 264.0 },
      { label: 'Beverages', orders: 61, revenue: 488.0 },
      { label: 'Wine & Bar', orders: 38, revenue: 912.0 },
    ],
    totalOrders: 47,
    totalRevenue: 2840.5,
  };
}

export function buildDemoMonthlyReport(meta: RestaurantPrintMeta): MonthlyReportData {
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const days = Array.from({ length: 7 }, (_, i) => ({
    day: (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    })(),
    orders: 30 + i * 4,
    revenue: 1200 + i * 180,
  }));
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = days.reduce((s, d) => s + d.orders, 0);
  return {
    ...meta,
    monthLabel,
    demo: true,
    days,
    totalRevenue,
    totalOrders,
    avgPerDay: totalRevenue / days.length,
  };
}

export async function printSalesReport(data: SalesReportData): Promise<void> {
  printDialogHtml(buildSalesReportHTML(data));
}

export async function printMonthlyReport(data: MonthlyReportData): Promise<void> {
  printDialogHtml(buildMonthlyReportHTML(data));
}
