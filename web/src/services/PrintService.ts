// ─── Cafyz PrintService ───────────────────────────────────────────────────────
// Thermal printer support via Web Bluetooth, Web USB, or browser print dialog.
// ESC/POS command builder is self-contained — no dependencies.

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
  // Thermal image raster support is device-specific; use text fallback here.
  if (data.logoUrl) b.text('[LOGO]').nl();
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
<div class="center">
  ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Restaurant logo" style="max-width:150px;max-height:72px;object-fit:contain;margin:0 auto 6px;display:block" />` : ''}
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

export function buildKitchenTicket(data: KitchenTicketData, width = 32): Uint8Array {
  const b = new EscPosBuilder();
  const W = width;
  const ts = data.createdAt ? new Date(data.createdAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
  b.init().alignCenter().boldOn().bigOn().text(data.restaurantName).bigOff().boldOff().nl();
  if (data.logoUrl) b.text('[LOGO]').nl();
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
  <div class="center">
    ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Restaurant logo" style="max-width:150px;max-height:72px;object-fit:contain;margin:0 auto 6px;display:block" />` : ''}
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

  const triggerPrint = () => {
    if (win.closed) return;
    win.print();
    setTimeout(() => win.close(), 900);
  };

  // Ensure logo images are fully loaded before printing.
  const waitForImagesThenPrint = () => {
    try {
      const images = Array.from(win.document.images);
      if (!images.length) { triggerPrint(); return; }

      let pending = images.filter(img => !img.complete).length;
      if (pending === 0) { triggerPrint(); return; }

      const done = () => {
        pending -= 1;
        if (pending <= 0) triggerPrint();
      };
      images.forEach(img => {
        if (img.complete) return;
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });

      // Hard timeout: never hang print forever if image host is slow.
      setTimeout(() => { if (!win.closed) triggerPrint(); }, 5000);
    } catch {
      triggerPrint();
    }
  };

  // Wait for popup document load, then images.
  win.onload = waitForImagesThenPrint;
  // Fallback if onload fired before handler attached.
  setTimeout(waitForImagesThenPrint, 450);
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
 * Pass `receiptData` for the dialog fallback; `escposData` for BT/USB.
 */
export async function print(
  receiptData: ReceiptData,
  escposData?: Uint8Array,
  width = 32,
): Promise<'bluetooth' | 'usb' | 'dialog'> {
  // Always use browser print when logo is present to guarantee logo output.
  if (receiptData.logoUrl) {
    printDialog(receiptData);
    return 'dialog';
  }
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

export async function printKitchenTicket(
  data: KitchenTicketData,
): Promise<'bluetooth' | 'usb' | 'dialog'> {
  const bytes = buildKitchenTicket(data, 32);
  if (!data.logoUrl && btChar) {
    await printBluetooth(bytes);
    return 'bluetooth';
  }
  if (!data.logoUrl && usbDevice) {
    await printUSB(bytes);
    return 'usb';
  }
  printDialogHtml(buildKitchenTicketHTML(data));
  return 'dialog';
}
