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
OUTPUT = DESKTOP / "재직자_교육_기업모집_텍스트효과_20초_960x640.mp4"

TOP = "경북 포항시 지역산업위기대응 맞춤형 지원사업"
MAIN = "재직자 교육 기업 모집"
CONTACT = "주관 : 포항소재산업진흥원, 교육문의 : 054) 279 - 9426"

RED = (205, 18, 38, 255)
DEEP_RED = (155, 0, 18, 255)
WHITE = (255, 255, 255, 255)
BLACK = (4, 4, 5, 255)
GRAY = (110, 110, 110, 70)


def font(size, bold=True):
    names = [
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/NanumGothicBold.ttf" if bold else "C:/Windows/Fonts/NanumGothic.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for name in names:
        p = Path(name)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


F28 = font(28)
F34 = font(34)
F44 = font(44)
F56 = font(56)
F66 = font(66)
F78 = font(78)
F88 = font(88)
F112 = font(112)


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def overshoot(x):
    x = max(0.0, min(1.0, x))
    return 1 + 0.16 * math.sin(math.pi * min(1, x * 1.2)) * (1 - x)


def layer_text(text, fnt, fill=WHITE, stroke=None, sw=0):
    tmp = Image.new("RGBA", (20, 20))
    d = ImageDraw.Draw(tmp)
    box = d.textbbox((0, 0), text, font=fnt, stroke_width=sw)
    img = Image.new("RGBA", (box[2] - box[0] + 16, box[3] - box[1] + 16), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((8 - box[0], 8 - box[1]), text, font=fnt, fill=fill, stroke_fill=stroke, stroke_width=sw)
    return img


def alpha(img, amount):
    out = img.convert("RGBA")
    out.putalpha(out.getchannel("A").point(lambda p: int(p * amount)))
    return out


def paste(base, img, xy, amount=1.0):
    base.alpha_composite(alpha(img, amount), (int(xy[0]), int(xy[1])))


def center(base, img, xy, amount=1.0):
    paste(base, img, (xy[0] - img.width / 2, xy[1] - img.height / 2), amount)


def fit(img, size):
    sw, sh = img.size
    tw, th = size
    r = min(tw / sw, th / sh)
    return img.resize((int(sw * r), int(sh * r)), Image.Resampling.LANCZOS)


def crop_white(img):
    arr = np.asarray(img.convert("RGB"))
    mask = np.any(arr < 245, axis=2)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return img.convert("RGBA")
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).convert("RGBA")


def red_bg(t):
    img = Image.new("RGBA", (W, H), RED)
    d = ImageDraw.Draw(img)
    d.ellipse((-220 + int(28 * math.sin(t)), -130, 320, 410), fill=(230, 88, 102, 120))
    d.ellipse((620 + int(24 * math.cos(t * .9)), 180, 1130, 720), fill=(120, 0, 14, 70))
    return img


def black_bg():
    return Image.new("RGBA", (W, H), BLACK)


def repeat_bg(text, fnt, bg=RED):
    img = Image.new("RGBA", (W, H), bg)
    d = ImageDraw.Draw(img)
    for y in range(-40, H + 60, 86):
        for x in range(-120, W + 180, 360):
            d.text((x, y), text, font=fnt, fill=(255, 255, 255, 34))
    return img


def white_panel(size):
    img = Image.new("RGBA", size, (255, 255, 255, 246))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=8, outline=(225, 225, 225, 255), width=2)
    return img


edu = Image.open(DESKTOP / "1.png").convert("RGBA")
ministry = crop_white(Image.open(DESKTOP / "2.jpg"))
pohang = crop_white(Image.open(DESKTOP / "3.jpg"))
pomia = Image.open(DESKTOP / "4.png").convert("RGBA")


def final_card():
    card = white_panel((850, 500))
    d = ImageDraw.Draw(card)
    d.text((40, 35), TOP, font=F34, fill=(0, 0, 0, 255))
    d.text((83, 88), MAIN, font=F78, fill=(205, 0, 0, 255))
    d.text((54, 212), "교육비 전액 지원!", font=F44, fill=(0, 0, 0, 255))
    d.text((54, 268), "기업이 원하는 교육!", font=F44, fill=(0, 0, 0, 255))
    d.text((54, 324), "기업이 원하는 일정〮장소", font=F44, fill=(0, 0, 0, 255))
    icon = fit(edu, (250, 230))
    card.alpha_composite(icon, (560, 190))
    d.text((44, 396), CONTACT, font=font(20), fill=(0, 0, 0, 255))
    for logo, x, box in [(ministry, 118, (210, 62)), (pohang, 410, (210, 72)), (pomia, 690, (185, 70))]:
        lg = fit(logo, box)
        card.alpha_composite(lg, (int(x - lg.width / 2), 424 + int((72 - lg.height) / 2)))
    return card


FINAL = final_card()


def frame_at(i):
    t = i / FPS
    sec = t

    if sec < 2.0:
        p = 0.45 + 0.55 * ease(sec / 1.6)
        bg = red_bg(t)
        top = layer_text("롯데하이마트 스타일 텍스트 효과", F28, (255, 255, 255, 170))
        title = layer_text(TOP, F34, WHITE)
        main = layer_text(MAIN, F78, WHITE)
        paste(bg, top, (52, 70), .40)
        paste(bg, title, (70 - 150 * (1 - p), 205), p)
        paste(bg, main, (70 + 180 * (1 - p), 282), p)
        return bg.convert("RGB")

    if sec < 4.4:
        p = ease((sec - 2.0) / 1.25)
        bg = black_bg()
        big = layer_text("재직자", F112, RED)
        rest = layer_text("교육 기업 모집", F88, WHITE)
        scale = overshoot(p)
        big = big.resize((int(big.width * scale), int(big.height * scale)), Image.Resampling.LANCZOS)
        rest = rest.resize((int(rest.width * scale), int(rest.height * scale)), Image.Resampling.LANCZOS)
        paste(bg, big, (86 - 170 * (1 - p), 236), 1)
        paste(bg, rest, (390 + 170 * (1 - p), 248), 1)
        return bg.convert("RGB")

    if sec < 7.0:
        p = 0.38 + 0.62 * ease((sec - 4.4) / 1.35)
        bg = black_bg()
        line1 = layer_text("교육비 전액", F78, WHITE)
        red = layer_text("지원!", F88, RED)
        sub = layer_text("기업 부담 없이 시작하세요.", F44, WHITE)
        paste(bg, line1, (70, 182 - 50 * (1 - p)), p)
        paste(bg, red, (570, 170), p)
        paste(bg, sub, (190, 334 + 60 * (1 - p)), p)
        d = ImageDraw.Draw(bg)
        d.ellipse((805, 356, 825, 376), fill=RED)
        return bg.convert("RGB")

    if sec < 9.8:
        p = 0.35 + 0.65 * ease((sec - 7.0) / 1.5)
        bg = repeat_bg("기업이 원하는 교육!", F56, RED)
        black_circle = Image.new("RGBA", (520, 520), (0, 0, 0, 255))
        mask = Image.new("L", (520, 520), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 519, 519), fill=255)
        black_circle.putalpha(mask)
        center(bg, black_circle, (W * (1.05 - .55 * p), 295), 1)
        white = layer_text("기업이 원하는", F66, WHITE)
        redtxt = layer_text("교육!", F88, RED, WHITE, 2)
        paste(bg, white, (85, 210), p)
        paste(bg, redtxt, (500, 200), p)
        return bg.convert("RGB")

    if sec < 12.5:
        p = 0.40 + 0.60 * ease((sec - 9.8) / 1.35)
        bg = black_bg()
        a = layer_text("기업이 원하는", F66, WHITE)
        b = layer_text("일정〮장소", F88, RED)
        paste(bg, a, (72, 214), p)
        paste(bg, b, (386, 202), p)
        icon = fit(edu, (205, 180))
        center(bg, icon, (780, 330), .16 + .84 * p)
        return bg.convert("RGB")

    if sec < 15.2:
        p = 0.40 + 0.60 * ease((sec - 12.5) / 1.4)
        bg = red_bg(t)
        repeated = repeat_bg("포항소재산업진흥원", F44, DEEP_RED)
        bg = Image.blend(bg, repeated, .16).convert("RGBA")
        title = layer_text("주관", F66, WHITE)
        org = layer_text("포항소재산업진흥원", F66, WHITE)
        phone = layer_text("054) 279 - 9426", F56, WHITE)
        paste(bg, title, (80, 168), p)
        paste(bg, org, (260, 168), p)
        paste(bg, phone, (270, 305 + 40 * (1 - p)), p)
        return bg.convert("RGB")

    if sec < 17.2:
        p = 0.45 + 0.55 * ease((sec - 15.2) / 1.0)
        bg = black_bg()
        start = layer_text("지금", F88, WHITE)
        now = layer_text("시작합니다.", F88, WHITE)
        paste(bg, start, (220, 238), p)
        paste(bg, now, (420, 238), p)
        ImageDraw.Draw(bg).ellipse((830, 358, 852, 380), fill=RED)
        return bg.convert("RGB")

    p = ease((sec - 17.2) / 2.8)
    bg = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    scale = .90 + .05 * p
    card = FINAL.resize((int(FINAL.width * scale), int(FINAL.height * scale)), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
    shadow.putalpha(card.getchannel("A").filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * .20)))
    center(bg, shadow, (W / 2 + 8, H / 2 + 10), 1)
    center(bg, card, (W / 2, H / 2), 1)
    if sec > 19.55:
        fade = max(0, 1 - (sec - 19.55) / .45)
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
    for idx in range(TOTAL):
        writer.append_data(np.asarray(frame_at(idx)))

print(OUTPUT)
