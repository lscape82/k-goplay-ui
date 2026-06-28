from pathlib import Path
import math

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


W, H = 960, 640
FPS = 30
DURATION = 20
TOTAL = FPS * DURATION

DESKTOP = Path.home() / "Desktop"
OUTPUT = DESKTOP / "재직자_교육_기업모집_원본소스_20초_960x640.mp4"

TITLE_TOP = "경북 포항시 지역산업위기대응 맞춤형 지원사업"
TITLE_MAIN = "재직자 교육 기업 모집"
BENEFITS = ["교육비 전액 지원!", "기업이 원하는 교육!", "기업이 원하는 일정〮장소"]
CONTACT = "주관 : 포항소재산업진흥원, 교육문의 : 054) 279 - 9426"


def font(size, bold=False):
    candidates = [
        Path("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf"),
        Path("C:/Windows/Fonts/NanumGothicBold.ttf" if bold else "C:/Windows/Fonts/NanumGothic.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for p in candidates:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


F_TOP = font(38, True)
F_MAIN = font(78, True)
F_BENEFIT = font(45, True)
F_CONTACT = font(31, True)
F_SMALL = font(24, True)
F_FOOT = font(20, True)


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def fit(img, size, contain=True, scale=1.0):
    sw, sh = img.size
    tw, th = size
    ratio = (min if contain else max)(tw / sw, th / sh) * scale
    nw, nh = max(1, int(sw * ratio)), max(1, int(sh * ratio))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def center_paste(base, overlay, center, alpha=255, shadow=False):
    ov = overlay.convert("RGBA")
    if alpha < 255:
        ov.putalpha(ov.getchannel("A").point(lambda p: int(p * alpha / 255)))
    x = int(center[0] - ov.width / 2)
    y = int(center[1] - ov.height / 2)
    if shadow:
        sh = Image.new("RGBA", ov.size, (0, 0, 0, 0))
        sh.putalpha(ov.getchannel("A").filter(ImageFilter.GaussianBlur(16)).point(lambda p: int(p * 0.28)))
        base.alpha_composite(sh, (x + 8, y + 10))
    base.alpha_composite(ov, (x, y))


def spotlight(t):
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    bg = np.zeros((H, W, 3), dtype=np.float32)
    bg[..., 0] = 4
    bg[..., 1] = 14
    bg[..., 2] = 38
    for cx, cy, s in [
        (0.20 + 0.08 * math.sin(t * 0.7), 0.16 + 0.08 * math.cos(t * 0.8), 150),
        (0.76 + 0.10 * math.cos(t * 0.55), 0.24 + 0.10 * math.sin(t * 0.9), 135),
        (0.50 + 0.08 * math.sin(t * 0.45), 0.72, 80),
    ]:
        d = ((x - cx) ** 2 / 0.075) + ((y - cy) ** 2 / 0.050)
        glow = np.exp(-d) * s
        bg[..., 1] += glow * 0.35
        bg[..., 2] += glow
    return Image.fromarray(np.uint8(np.clip(bg, 0, 255))).convert("RGBA")


def text_layer(text, fnt, fill, stroke=None, stroke_width=0):
    dummy = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(dummy)
    box = d.textbbox((0, 0), text, font=fnt, stroke_width=stroke_width)
    img = Image.new("RGBA", (box[2] - box[0] + 10, box[3] - box[1] + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((5 - box[0], 5 - box[1]), text, font=fnt, fill=fill, stroke_fill=stroke, stroke_width=stroke_width)
    return img


def rounded_rect(size, fill, radius=8):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill)
    return img


def crop_white_border(img):
    arr = np.asarray(img.convert("RGB"))
    mask = np.any(arr < 245, axis=2)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return img.convert("RGBA")
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).convert("RGBA")


edu = Image.open(DESKTOP / "1.png").convert("RGBA")
ministry = crop_white_border(Image.open(DESKTOP / "2.jpg"))
pohang = crop_white_border(Image.open(DESKTOP / "3.jpg"))
pomia = Image.open(DESKTOP / "4.png").convert("RGBA")


def make_final_card():
    card = rounded_rect((870, 550), (255, 255, 255, 246), 8)
    d = ImageDraw.Draw(card)
    d.text((35, 32), TITLE_TOP, font=F_TOP, fill=(0, 0, 0))
    d.text((102, 82), TITLE_MAIN, font=F_MAIN, fill=(235, 0, 0))
    for i, line in enumerate(BENEFITS):
        d.text((56, 205 + i * 58), line, font=F_BENEFIT, fill=(0, 0, 0))
    icon = fit(edu, (310, 300), True)
    card.alpha_composite(icon, (520, 180))
    d.text((42, 402), CONTACT, font=F_FOOT, fill=(0, 0, 0))
    logos = Image.new("RGBA", (805, 80), (255, 255, 255, 0))
    center_paste(logos, fit(ministry, (250, 72), True), (120, 40))
    center_paste(logos, fit(pohang, (220, 72), True), (405, 40))
    center_paste(logos, fit(pomia, (210, 72), True), (675, 40))
    card.alpha_composite(logos, (32, 452))
    return card


FINAL_CARD = make_final_card()


def frame_at(idx):
    t = idx / FPS
    sec = t
    canvas = spotlight(t)

    if sec < 3.0:
        p = 0.20 + 0.80 * ease(sec / 3.0)
        top = text_layer(TITLE_TOP, F_TOP, (255, 255, 255, 255))
        main = text_layer(TITLE_MAIN, F_MAIN, (255, 24, 24, 255), (255, 255, 255, 255), 2)
        center_paste(canvas, top, (W / 2, 208 - 14 * (1 - p)), int(255 * p), True)
        center_paste(canvas, main, (W / 2, 302), int(255 * p), True)
        icon = fit(edu, (190, 170), True, 0.95 + 0.04 * math.sin(t * 2.4))
        center_paste(canvas, icon, (W / 2, 445), int(235 * p), False)
        return canvas.convert("RGB")

    if sec < 7.0:
        p = ease((sec - 3.0) / 4.0)
        card = rounded_rect((820, 420), (255, 255, 255, 244), 8)
        d = ImageDraw.Draw(card)
        d.text((44, 40), "교육비 전액 지원!", font=F_BENEFIT, fill=(0, 0, 0))
        d.text((44, 112), "기업 부담은 낮추고", font=font(38, True), fill=(0, 0, 0))
        d.text((44, 168), "필요한 교육은 정확하게", font=font(38, True), fill=(225, 0, 0))
        icon = fit(edu, (330, 310), True, 1.0 + 0.035 * math.sin(t * 2))
        card.alpha_composite(icon, (460, 70))
        center_paste(canvas, card, (W / 2, H / 2), 255, True)
        shine = Image.new("RGBA", (int(600 * p), 6), (235, 0, 0, 185))
        canvas.alpha_composite(shine, (78, 437))
        return canvas.convert("RGB")

    if sec < 11.5:
        p = ease((sec - 7.0) / 4.5)
        bg = Image.new("RGBA", (W, H), (255, 255, 255, 255))
        center_paste(bg, fit(edu, (430, 390), True, 0.92 + 0.05 * math.sin(t * 1.5)), (690, 338), 245, False)
        d = ImageDraw.Draw(bg)
        d.text((62, 124), "기업이 원하는 교육!", font=font(52, True), fill=(0, 0, 0))
        d.text((62, 205), "기업이 원하는", font=font(50, True), fill=(0, 0, 0))
        d.text((62, 278), "일정〮장소", font=font(66, True), fill=(235, 0, 0))
        underline = Image.new("RGBA", (int(380 * p), 8), (235, 0, 0, 210))
        bg.alpha_composite(underline, (64, 358))
        return bg.convert("RGB")

    if sec < 15.5:
        p = ease((sec - 11.5) / 4.0)
        canvas = spotlight(t)
        band = rounded_rect((850, 430), (255, 255, 255, 246), 8)
        d = ImageDraw.Draw(band)
        d.text((42, 48), TITLE_MAIN, font=font(64, True), fill=(235, 0, 0))
        d.text((46, 148), CONTACT, font=F_CONTACT, fill=(0, 0, 0))
        center_paste(band, fit(ministry, (250, 74), True), (170, 292))
        center_paste(band, fit(pohang, (230, 82), True), (430, 292))
        center_paste(band, fit(pomia, (220, 84), True), (675, 292))
        center_paste(canvas, band, (W / 2, H / 2 + 8 * math.sin(p * math.pi)), 255, True)
        return canvas.convert("RGB")

    p = ease((sec - 15.5) / 4.5)
    bg = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    scale = 0.94 + 0.04 * p
    card = FINAL_CARD.resize((int(FINAL_CARD.width * scale), int(FINAL_CARD.height * scale)), Image.Resampling.LANCZOS)
    center_paste(bg, card, (W / 2, H / 2), 255, True)
    if sec > 19.35:
        fade = max(0, 1 - (sec - 19.35) / 0.65)
        arr = np.asarray(bg.convert("RGB")).astype(np.float32) * fade + 255 * (1 - fade)
        return Image.fromarray(np.uint8(np.clip(arr, 0, 255))).convert("RGB")
    return bg.convert("RGB")


with imageio.get_writer(
    OUTPUT,
    fps=FPS,
    codec="libx264",
    pixelformat="yuv420p",
    output_params=["-movflags", "+faststart", "-crf", "18"],
) as writer:
    for i in range(TOTAL):
        writer.append_data(np.asarray(frame_at(i)))

print(OUTPUT)
