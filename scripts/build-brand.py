#!/usr/bin/env python3
"""Builds every Cafyz logo and icon file from one piece of artwork.

    python3 scripts/build-brand.py

Source: brand/cafyz-logo-source.png (transparent). It has two parts:
  - the emblem: cloche, cup, fork and spoon inside two arcs;
  - the wordmark below it ("cafyz", a chef's hat on the c, an underline).

Everything is centred on the emblem's ring, measured from the artwork: the two arcs' outermost
points give the ring's centre. The cloche's knob rises above the ring, so centring on the
bounding box instead would push the emblem down.

Outputs:
  brand/cafyz-emblem.png, brand/cafyz-logo.png, brand/cafyz-logo-light.png, brand/app-icon-1024.png
  logo.png (repo root), store-release/assets/app-icon-1024.png
  web-v2/public: cafyz-logo.png, cafyz-logo-light.png, cafyz-mark.png, icon-192/512, apple-touch-icon
  iOS: AppIcon set and the three splash images
  Android: launcher icons, adaptive foreground, splash images

Needs Pillow and numpy.
"""
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "brand/cafyz-logo-source.png"

GROUND = (8, 6, 25)        # #080619, the app's ground
SPLASH = (7, 5, 17)        # #070511, the launch colour set in capacitor.config.ts
INK = (27, 19, 64)         # wordmark colour on light surfaces

# How much of the icon's width the emblem's ring takes.
ICON_FILL = 0.70           # iOS, web and legacy Android icons
ADAPTIVE_FILL = 0.52       # Android adaptive foreground: inside the 66% safe zone with the knob


def load():
    im = Image.open(SRC).convert("RGBA")
    a = np.array(im)
    alpha = a[..., 3] > 40
    rgb = a[..., :3].astype(float)
    mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return im, a, alpha, sat


def ring(alpha):
    """Centre and radius of the emblem's ring, from the arcs' outermost points."""
    band = alpha[100:440]                      # rows that hold the arcs but not the hat
    rows, cols = np.where(band)
    left, right = cols.argmin(), cols.argmax()
    cx = (cols[left] + cols[right]) / 2
    cy = (rows[left] + rows[right]) / 2 + 100
    return cx, cy, (cols[right] - cols[left]) / 2


def emblem_only(a, alpha, sat, cx, cy, r):
    """The emblem with the wordmark removed: the hat, and the top of the f under the swoosh."""
    out = a.copy()
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    # The hat sits outside the ring, low on the left.
    hat = (xx < cx) & (yy > 440) & (np.hypot(xx - cx, yy - cy) > r + 4)
    f_top = (yy >= 510) & (xx > 690) & (xx < 900) & (sat < 0.25)
    below = yy > 551
    out[hat | f_top | below, 3] = 0
    return Image.fromarray(out)


def square_about(im, cx, cy, half):
    """A square crop of `im` centred on (cx, cy), padded with transparency where it runs off."""
    side = int(round(half * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, (int(round(half - cx)), int(round(half - cy))))
    return canvas


def ground(size, base=GROUND):
    """The dark ground behind icons: the app's navy with violet light from above and blue below."""
    y, x = np.mgrid[0:size, 0:size] / size
    img = np.zeros((size, size, 3), float) + np.array(base)
    top = np.clip(1 - np.hypot(x - 0.32, y - 0.12) / 0.85, 0, 1) ** 2
    low = np.clip(1 - np.hypot(x - 0.85, y - 0.95) / 0.8, 0, 1) ** 2
    img += top[..., None] * np.array([70, 28, 150]) * 0.9
    img += low[..., None] * np.array([10, 60, 150]) * 0.55
    return Image.fromarray(np.clip(img, 0, 255).astype("uint8")).convert("RGBA")


def icon(emblem, size, fill, base=GROUND):
    """The emblem on the ground, its ring exactly centred and `fill` of the width across."""
    master = 1024
    bg = ground(master, base)
    # `emblem` is a square whose side is the ring's diameter / EMBLEM_RING
    art = int(round(master * fill / EMBLEM_RING))
    scaled = emblem.resize((art, art), Image.LANCZOS)
    glow = scaled.filter(ImageFilter.GaussianBlur(master * 0.03))
    off = (master - art) // 2
    faint = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    faint.alpha_composite(glow, (off, off))
    faint.putalpha(faint.getchannel("A").point(lambda v: int(v * 0.35)))
    bg.alpha_composite(faint)
    bg.alpha_composite(scaled, (off, off))
    return bg.convert("RGB").resize((size, size), Image.LANCZOS)


def save(im, path, **kw):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, **kw)


EMBLEM_RING = 0.86  # the ring's diameter as a share of the emblem file's side


def main():
    src, a, alpha, sat = load()
    cx, cy, r = ring(alpha)

    # Emblem: square, the ring centred, the ring EMBLEM_RING of the side.
    emblem = square_about(emblem_only(a, alpha, sat, cx, cy, r), cx, cy, r / EMBLEM_RING).resize((1024, 1024), Image.LANCZOS)
    save(emblem, "brand/cafyz-emblem.png")

    # Full logo: square, centred left to right on the ring, top to bottom on the artwork.
    rows = np.where(alpha.any(1))[0]
    cols = np.where(alpha.any(0))[0]
    mid_y = (rows.min() + rows.max()) / 2
    half = max(cx - cols.min(), cols.max() - cx, (rows.max() - rows.min()) / 2) / 0.94
    logo = square_about(src, cx, mid_y, half).resize((1200, 1200), Image.LANCZOS)
    save(logo, "brand/cafyz-logo.png")
    save(logo, "logo.png")
    save(logo.resize((800, 800), Image.LANCZOS), "web-v2/public/cafyz-logo.png", optimize=True)

    # Light surfaces: the white letters and hat of the wordmark become ink; the emblem is unchanged.
    b = a.copy()
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    wordmark_white = (sat < 0.22) & (((yy > 551)) | ((xx < 470) & (yy > 450)) | ((yy >= 510) & (xx > 690) & (xx < 900)))
    b[wordmark_white, :3] = INK
    light = square_about(Image.fromarray(b), cx, mid_y, half).resize((1200, 1200), Image.LANCZOS)
    save(light, "brand/cafyz-logo-light.png")
    save(light.resize((800, 800), Image.LANCZOS), "web-v2/public/cafyz-logo-light.png", optimize=True)

    save(emblem.resize((320, 320), Image.LANCZOS), "web-v2/public/cafyz-mark.png", optimize=True)

    # App icon master and the web icons.
    master = icon(emblem, 1024, ICON_FILL)
    save(master, "brand/app-icon-1024.png")
    save(master, "store-release/assets/app-icon-1024.png")
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        save(master.resize((size, size), Image.LANCZOS), f"web-v2/public/{name}", optimize=True)

    # iOS icons: every file already in the set, at its own size. No transparency (App Store rule).
    for f in sorted((ROOT / "cap-ios/App/App/Assets.xcassets/AppIcon.appiconset").glob("*.png")):
        size = Image.open(f).size[0]
        master.resize((size, size), Image.LANCZOS).save(f)

    # Android launcher icons.
    adaptive = icon(emblem, 1024, ADAPTIVE_FILL)
    res = ROOT / "cap-android/app/src/main/res"
    for name, scale in (("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)):
        d = res / f"mipmap-{name}"
        px = lambda dp: int(dp * scale + 0.5)
        legacy = master.resize((px(48), px(48)), Image.LANCZOS)
        legacy.save(d / "ic_launcher.png")
        mask = Image.new("L", (px(48) * 4, px(48) * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, px(48) * 4 - 1, px(48) * 4 - 1), fill=255)
        rnd = legacy.convert("RGBA")
        rnd.putalpha(mask.resize((px(48), px(48)), Image.LANCZOS))
        rnd.save(d / "ic_launcher_round.png")
        adaptive.resize((px(108), px(108)), Image.LANCZOS).save(d / "ic_launcher_foreground.png")

    # Splash screens: the full logo, centred, on the launch colour.
    def splash(size, share):
        bg = ground(size, SPLASH) if size <= 1024 else ground(1024, SPLASH).resize((size, size), Image.BICUBIC)
        art = int(size * share)
        bg.alpha_composite(logo.resize((art, art), Image.LANCZOS), ((size - art) // 2, (size - art) // 2))
        return bg.convert("RGB")

    ios_splash = splash(2732, 0.30)
    for f in sorted((ROOT / "cap-ios/App/App/Assets.xcassets/Splash.imageset").glob("*.png")):
        ios_splash.save(f, optimize=True)
    android_splash = splash(480, 0.5)
    for f in sorted(res.glob("drawable*/splash.webp")):
        android_splash.save(f, "WEBP", quality=88)

    print(f"ring centre ({cx:.1f}, {cy:.1f}), radius {r:.1f}; brand files rebuilt")


if __name__ == "__main__":
    main()
