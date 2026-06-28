from pathlib import Path
import math

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance


W, H = 960, 640
FPS = 30
DURATION = 20
TOTAL = FPS * DURATION

DESKTOP = Path.home() / "Desktop"
SOURCE = DESKTOP / "20260624_180605.png"
OUTPUT = DESKTOP / "재직자_교육_기업모집_20초_960x640.mp4"


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def fit_cover(img, size, scale=1.0, center=(0.5, 0.5)):
    sw, sh = img.size
    tw, th = size
    base = max(tw / sw, th / sh) * scale
    nw, nh = int(sw * base), int(sh * base)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    cx = int(nw * center[0])
    cy = int(nh * center[1])
    left = max(0, min(nw - tw, cx - tw // 2))
    top = max(0, min(nh - th, cy - th // 2))
    return resized.crop((left, top, left + tw, top + th))


def fit_contain(img, size, scale=1.0):
    sw, sh = img.size
    tw, th = size
    base = min(tw / sw, th / sh) * scale
    nw, nh = int(sw * base), int(sh * base)
    canvas = Image.new("RGB", size, "white")
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def blue_spotlight(t):
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    bg = np.zeros((H, W, 3), dtype=np.float32)
    bg[..., 0] = 3
    bg[..., 1] = 12
    bg[..., 2] = 33
    for i, (cx, cy, strength) in enumerate(
        [
            (0.22 + 0.08 * math.sin(t * 0.8), 0.12 + 0.09 * math.cos(t * 0.7), 170),
            (0.72 + 0.12 * math.cos(t * 0.55), 0.22 + 0.12 * math.sin(t * 0.9), 140),
            (0.50 + 0.10 * math.sin(t * 0.45), 0.70 + 0.08 * math.cos(t * 0.6), 90),
        ]
    ):
        d = ((x - cx) ** 2 / 0.075) + ((y - cy) ** 2 / 0.045)
        glow = np.exp(-d) * strength
        bg[..., 1] += glow * 0.38
        bg[..., 2] += glow
    return Image.fromarray(np.uint8(np.clip(bg, 0, 255)), "RGB")


def add_vignette(img, opacity=0.35):
    y = np.linspace(-1, 1, H)[:, None]
    x = np.linspace(-1, 1, W)[None, :]
    mask = np.clip((x * x + y * y - 0.35) / 1.15, 0, 1) * opacity
    arr = np.asarray(img).astype(np.float32)
    arr *= 1 - mask[..., None]
    return Image.fromarray(np.uint8(np.clip(arr, 0, 255)), "RGB")


def paste_shadow(base, overlay, pos, alpha=255, shadow=True):
    layer = overlay.convert("RGBA")
    if alpha < 255:
        a = layer.getchannel("A").point(lambda p: int(p * alpha / 255))
        layer.putalpha(a)
    x, y = pos
    if shadow:
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        sh.putalpha(layer.getchannel("A").filter(ImageFilter.GaussianBlur(18)).point(lambda p: int(p * 0.26)))
        base.alpha_composite(sh, (x + 8, y + 10))
    base.alpha_composite(layer, (x, y))


def crop_region(src, box, out_size):
    return src.crop(box).resize(out_size, Image.Resampling.LANCZOS)


poster = Image.open(SOURCE).convert("RGB")
full = fit_contain(poster, (W, H), 0.985)
soft_full = ImageEnhance.Contrast(full.filter(ImageFilter.GaussianBlur(2))).enhance(0.85)
title_crop = crop_region(poster, (20, 70, 1390, 295), (880, 230))
body_crop = crop_region(poster, (55, 360, 805, 650), (560, 218))
icon_crop = crop_region(poster, (820, 300, 1265, 735), (420, 410))
contact_crop = crop_region(poster, (70, 720, 1345, 1000), (850, 190))


def frame_at(i):
    t = i / FPS
    sec = t
    if sec < 3.0:
        p = ease(sec / 3.0)
        canvas = blue_spotlight(t).convert("RGBA")
        crop = title_crop.resize((int(760 + 70 * p), int(198 + 18 * p)), Image.Resampling.LANCZOS)
        white = Image.new("RGBA", crop.size, (255, 255, 255, int(245 * p)))
        white.alpha_composite(crop.convert("RGBA"), (0, 0))
        paste_shadow(canvas, white, ((W - white.width) // 2, 185), int(255 * p))
        bar = Image.new("RGBA", (W, 82), (255, 255, 255, int(255 * p)))
        strip = contact_crop.resize((720, 160), Image.Resampling.LANCZOS).crop((0, 0, 720, 82)).convert("RGBA")
        strip.putalpha(int(245 * p))
        bar.alpha_composite(strip, (52, 0))
        canvas.alpha_composite(bar, (0, H - 82))
        return add_vignette(canvas.convert("RGB"), 0.25)

    if sec < 7.0:
        p = ease((sec - 3.0) / 4.0)
        bg = blue_spotlight(t).convert("RGBA")
        poster_frame = fit_contain(poster, (W, H), 0.88 + 0.08 * p).convert("RGBA")
        poster_frame.putalpha(245)
        bg.alpha_composite(poster_frame, (0, 0))
        return bg.convert("RGB")

    if sec < 11.0:
        p = ease((sec - 7.0) / 4.0)
        bg = soft_full.copy().convert("RGBA")
        wash = Image.new("RGBA", (W, H), (255, 255, 255, 168))
        bg.alpha_composite(wash, (0, 0))
        crop = title_crop.resize((int(810 + 55 * math.sin(p * math.pi)), 212), Image.Resampling.LANCZOS)
        paste_shadow(bg, crop, ((W - crop.width) // 2, 76), 255)
        flash = max(0, 1 - abs((sec - 9.0) * 3))
        if flash:
            red = Image.new("RGBA", (780, 10), (255, 0, 0, int(155 * flash)))
            bg.alpha_composite(red, (90, 285))
        return bg.convert("RGB")

    if sec < 15.0:
        p = ease((sec - 11.0) / 4.0)
        bg = blue_spotlight(t).convert("RGBA")
        body = body_crop.resize((int(500 + 16 * p), int(195 + 6 * p)), Image.Resampling.LANCZOS)
        icon = icon_crop.resize((330, 322), Image.Resampling.LANCZOS)
        panel = Image.new("RGBA", (900, 450), (255, 255, 255, 242))
        paste_shadow(panel, body, (42, 118), 255, False)
        paste_shadow(panel, icon, (548, 66), 255, False)
        paste_shadow(bg, panel, (30, 95), 255)
        return add_vignette(bg.convert("RGB"), 0.20)

    if sec < 18.0:
        p = ease((sec - 15.0) / 3.0)
        bg = Image.new("RGBA", (W, H), (255, 255, 255, 255))
        crop = contact_crop.resize((int(805 + 40 * p), int(180 + 8 * p)), Image.Resampling.LANCZOS)
        paste_shadow(bg, crop, ((W - crop.width) // 2, 210), 255)
        top = title_crop.resize((760, 198), Image.Resampling.LANCZOS).convert("RGBA")
        top.putalpha(70)
        bg.alpha_composite(top, ((W - top.width) // 2, 35))
        return bg.convert("RGB")

    p = ease((sec - 18.0) / 2.0)
    img = fit_contain(poster, (W, H), 0.91 + 0.06 * p)
    fade = 1.0 if sec < 19.35 else max(0.0, 1 - (sec - 19.35) / 0.65)
    arr = np.asarray(img).astype(np.float32) * fade + 255 * (1 - fade)
    return Image.fromarray(np.uint8(np.clip(arr, 0, 255)), "RGB")


with imageio.get_writer(
    OUTPUT,
    fps=FPS,
    codec="libx264",
    pixelformat="yuv420p",
    output_params=["-movflags", "+faststart", "-crf", "18"],
) as writer:
    for idx in range(TOTAL):
        writer.append_data(np.asarray(frame_at(idx)))

print(OUTPUT)
