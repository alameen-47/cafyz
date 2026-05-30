// Shared thermal-receipt logo rasterization.
// Thermal printers are 1-bit (dot or no dot). Light / pastel logo colours are preserved
// using ink-density mapping + contrast stretch + Floyd–Steinberg dithering — not a hard
// luminance threshold (which drops anything lighter than mid-grey).

export const THERMAL_LOGO_MAX_WIDTH = 384;
export const THERMAL_LOGO_MAX_HEIGHT = 240;

/** Build a white-backed canvas with the logo scaled for receipt width. */
export function drawLogoToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxWidth = THERMAL_LOGO_MAX_WIDTH,
  maxHeight = THERMAL_LOGO_MAX_HEIGHT,
): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare logo canvas.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas;
}

/**
 * Per-pixel "ink" on paper: 0 = leave white, 255 = solid black dot.
 * Uses luminance + chroma so light yellows / pastels still produce printable dots.
 */
function extractInkDensity(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const inks = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3] / 255;
      const r = rgba[i] * a + 255 * (1 - a);
      const g = rgba[i + 1] * a + 255 * (1 - a);
      const b = rgba[i + 2] * a + 255 * (1 - a);

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);

      // Dark areas + colourful (non-grey) areas become ink, even when luminance is high.
      let ink = (255 - lum) * 1.2 + chroma * 0.65;
      ink = Math.min(255, Math.max(0, ink));

      // Slight gamma — lifts mid-tones / light brand colours toward printable range.
      ink = 255 * Math.pow(ink / 255, 0.82);

      inks[y * width + x] = ink;
    }
  }

  return stretchInkContrast(inks);
}

/** Spread ink values across full range so the lightest logo tone still dithers visibly. */
function stretchInkContrast(inks: Float32Array): Float32Array {
  let min = 255;
  let max = 0;
  for (let i = 0; i < inks.length; i++) {
    const v = inks[i];
    if (v < 4) continue; // skip near-paper white
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max <= min) return inks;

  const span = max - min;
  const out = new Float32Array(inks.length);
  for (let i = 0; i < inks.length; i++) {
    if (inks[i] < 4) {
      out[i] = 0;
      continue;
    }
    out[i] = Math.min(255, Math.max(0, ((inks[i] - min) / span) * 255));
  }
  return out;
}

/** Floyd–Steinberg error diffusion → 0 (print black dot) or 255 (paper white). */
function floydSteinbergDither(inks: Float32Array, width: number, height: number): Uint8ClampedArray {
  const work = new Float32Array(inks);
  const mono = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = work[idx];
      // High ink → black dot on receipt (0). Low ink → white paper (255).
      const bit = old >= 128 ? 0 : 255;
      mono[idx] = bit;
      const err = old - (bit === 0 ? 255 : 0);

      if (x + 1 < width) work[idx + 1] += err * (7 / 16);
      if (y + 1 < height) {
        if (x > 0) work[idx + width - 1] += err * (3 / 16);
        work[idx + width] += err * (5 / 16);
        if (x + 1 < width) work[idx + width + 1] += err * (1 / 16);
      }
    }
  }

  return mono;
}

function monoToEscPosBitmap(mono: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // mono[x] === 0 → black dot
      if (mono[y * width + x] === 0) {
        bitmap[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const result = new Uint8Array(header.length + bitmap.length);
  result.set(header);
  result.set(bitmap, header.length);
  return result;
}

function monoToPreviewCanvas(mono: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not build logo preview.');

  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < mono.length; i++) {
    const v = mono[i];
    const o = i * 4;
    imgData.data[o] = v;
    imgData.data[o + 1] = v;
    imgData.data[o + 2] = v;
    imgData.data[o + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Full pipeline: colour canvas → dithered 1-bit preview PNG (what the receipt will look like). */
export function canvasToPrintableLogoDataUrl(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read logo pixels.');

  const { width, height, data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const inks = extractInkDensity(data, width, height);
  const mono = floydSteinbergDither(inks, width, height);
  const preview = monoToPreviewCanvas(mono, width, height);

  const out = preview.toDataURL('image/png');
  if (!out.startsWith('data:image/')) throw new Error('Logo dithering failed.');
  return out;
}

/** Full pipeline: colour canvas → GS v 0 ESC/POS raster bytes. */
export function canvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read logo pixels.');

  const { width, height, data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (width < 1 || height < 1) throw new Error('Logo rendered with zero size.');

  const inks = extractInkDensity(data, width, height);
  const mono = floydSteinbergDither(inks, width, height);
  return monoToEscPosBitmap(mono, width, height);
}

async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 1 || img.naturalHeight < 1) {
        reject(new Error('Image has no usable dimensions.'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Could not load logo image.'));
    img.src = dataUrl;
  });
}

/** Colour data URL → dithered B&W PNG stored on device (matches receipt output). */
export async function colorLogoToPrintableDataUrl(sourceDataUrl: string): Promise<string> {
  const img = await loadImageFromDataUrl(sourceDataUrl);
  const canvas = drawLogoToCanvas(img, img.naturalWidth, img.naturalHeight);
  return canvasToPrintableLogoDataUrl(canvas);
}

/** Stored dithered B&W logo → ESC/POS (1:1 dot mapping, no second pass). */
export function canvasToEscPosFromStoredLogo(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read logo pixels.');

  const { width, height, data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (width < 1 || height < 1) throw new Error('Logo rendered with zero size.');

  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Any dot in the dithered preview (not near-paper-white) prints on receipt.
      if (lum < 235) {
        bitmap[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const result = new Uint8Array(header.length + bitmap.length);
  result.set(header);
  result.set(bitmap, header.length);
  return result;
}

/** Stored logo data URL → ESC/POS raster (logo is already dithered on save). */
export async function logoDataUrlToEscPos(logoUrl: string): Promise<Uint8Array> {
  const img = await loadImageFromDataUrl(logoUrl);
  const canvas = drawLogoToCanvas(img, img.naturalWidth, img.naturalHeight);
  return canvasToEscPosFromStoredLogo(canvas);
}
