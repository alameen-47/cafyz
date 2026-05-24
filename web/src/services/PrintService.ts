// ─── Cafyz PrintService ───────────────────────────────────────────────────────
// Thermal printer support via Web Bluetooth, Web USB, or browser print dialog.
// ESC/POS command builder is self-contained — no dependencies.

// ── Printer localStorage persistence ─────────────────────────────────────────

const PRINTER_LS_KEY = 'cafyz_printer';

export function savePrinterPrefs(type: 'none' | 'bluetooth' | 'usb', name: string): void {
  if (type === 'none') {
    localStorage.removeItem(PRINTER_LS_KEY);
  } else {
    localStorage.setItem(PRINTER_LS_KEY, JSON.stringify({ type, name }));
  }
}

export function loadPrinterPrefs(): { type: 'none' | 'bluetooth' | 'usb'; name: string } {
  try {
    const raw = localStorage.getItem(PRINTER_LS_KEY);
    if (!raw) return { type: 'none', name: '' };
    const parsed = JSON.parse(raw);
    if (parsed?.type && parsed.name !== undefined) return parsed as { type: 'none' | 'bluetooth' | 'usb'; name: string };
  } catch { /* ignore */ }
  return { type: 'none', name: '' };
}

/**
 * Silently attempts to reconnect to the previously used printer using
 * navigator.bluetooth.getDevices() / navigator.usb.getDevices() (Chrome 85+).
 * No user gesture required for already-authorised devices.
 * Returns { type: 'none' } if no saved prefs or reconnect fails.
 */
export async function tryAutoReconnect(): Promise<{ type: 'none' | 'bluetooth' | 'usb'; name: string }> {
  const prefs = loadPrinterPrefs();
  if (prefs.type === 'none') return { type: 'none', name: '' };

  try {
    if (prefs.type === 'bluetooth' && 'bluetooth' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (typeof nav.bluetooth?.getDevices === 'function') {
        const devices: any[] = await nav.bluetooth.getDevices();
        const target = devices.find(d => d.name === prefs.name) ?? devices[0];
        if (target) {
          const server = await target.gatt!.connect();
          const services = await server.getPrimaryServices();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let writable: any = null;
          for (const svc of services) {
            if (writable) break;
            try {
              const chars = await svc.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  writable = c; break;
                }
              }
            } catch { /* skip unreadable services */ }
          }
          if (writable) {
            btChar = writable;
            btDevice = target;
            target.addEventListener('gattserverdisconnected', () => { btChar = null; btDevice = null; });
            return { type: 'bluetooth', name: target.name || prefs.name };
          }
        }
      }
    } else if (prefs.type === 'usb' && 'usb' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (typeof nav.usb?.getDevices === 'function') {
        const devices: any[] = await nav.usb.getDevices();
        const target = devices.find(d => d.productName === prefs.name) ?? devices[0];
        if (target) {
          await target.open();
          if (target.configuration === null) await target.selectConfiguration(1);
          const iface = target.configuration.interfaces[0];
          await target.claimInterface(iface.interfaceNumber);
          usbDevice = target;
          return { type: 'usb', name: target.productName || prefs.name };
        }
      }
    }
  } catch { /* auto-reconnect failed silently */ }

  return { type: 'none', name: '' };
}

// ── ESC/POS Builder ───────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS  = 0x1d;

class EscPosBuilder {
  private buf: number[] = [];

  push(...bytes: number[]) { this.buf.push(...bytes); return this; }

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
  restaurantName:    string;
  restaurantLogo?:   string | null; // base64 data URL from profile
  restaurantAddress?: string;       // formatted single-line address
  restaurantPhone?:  string;
  restaurantWebsite?: string;
  tableName:         string;
  serverName?:       string;
  covers?:           number;
  items:             { name: string; qty: number; price: number }[];
  subtotal:          number;
  service:           number;
  tax:               number;
  total:             number;
  payMethod?:        string;
  note?:             string;
  dateStr?:          string;
}

// Build ESC/POS bytes for a receipt (32-char width for 58mm, 48-char for 80mm)
export function buildReceipt(data: ReceiptData, width = 32): Uint8Array {
  const b = new EscPosBuilder();
  const W = width;
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const date = data.dateStr ?? new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  b.init();

  // Header
  b.alignCenter()
   .boldOn().bigOn().text(data.restaurantName).bigOff().boldOff().nl(2);

  if (data.restaurantAddress) b.text(data.restaurantAddress).nl();
  if (data.restaurantPhone)   b.text(data.restaurantPhone).nl();
  if (data.restaurantAddress || data.restaurantPhone) b.nl();

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
   .text(data.restaurantWebsite || 'cafyz.com').nl(2);

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
<div class="center">
  ${data.restaurantLogo ? `<img src="${data.restaurantLogo}" alt="${data.restaurantName}" style="max-width:80px;max-height:80px;object-fit:contain;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto">` : ''}
  <h1>${data.restaurantName}</h1>
  ${data.restaurantAddress ? `<p style="font-size:10px;margin:1px 0">${data.restaurantAddress}</p>` : ''}
  ${data.restaurantPhone ? `<p style="font-size:10px;margin:1px 0">Tel: ${data.restaurantPhone}</p>` : ''}
  ${data.restaurantWebsite ? `<p style="font-size:10px;margin:1px 0">${data.restaurantWebsite}</p>` : ''}
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
  <p>${data.restaurantWebsite || 'cafyz.com'}</p>
</div>
</body>
</html>`;
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
  chunkSize = 100,
  delayMs = 40,
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
  await usbDevice.transferOut(endpoint.endpointNumber, data);
}

function printDialog(receiptData: ReceiptData): void {
  const html = buildReceiptHTML(receiptData);
  const win  = window.open('', '_blank', 'width=340,height=600');
  if (!win) throw new Error('Pop-up blocked — please allow pop-ups for this site.');
  win.document.write(html);
  win.document.close();
  win.focus();
  // Wait for resources to load then trigger print
  win.onload = () => {
    win.print();
    setTimeout(() => win.close(), 800);
  };
  // Fallback if onload already fired
  setTimeout(() => {
    if (!win.closed) { win.print(); setTimeout(() => win.close(), 800); }
  }, 400);
}

/**
 * Smart print: BT → USB → browser dialog.
 * Pass `receiptData` for the dialog fallback; `escposData` for BT/USB.
 */
export async function print(
  receiptData: ReceiptData,
  escposData?: Uint8Array,
  width = 32,
): Promise<'bluetooth' | 'usb' | 'dialog'> {
  const bytes = escposData ?? buildReceipt(receiptData, width);

  if (btChar) {
    await printBluetooth(bytes);
    return 'bluetooth';
  }
  if (usbDevice) {
    await printUSB(bytes);
    return 'usb';
  }
  printDialog(receiptData);
  return 'dialog';
}
