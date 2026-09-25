"""Colaj foto in stil scrapbook (margini rupte, banda de film, rama rotunda, biletel, texte).

Utilizare:
    python3 make_collage.py <folder_poze> <folder_fonturi> <iesire.jpg>

Pozele NU se tin in repo - folderul de poze ramane local.
Fonturi necesare in <folder_fonturi>: GreatVibes-Regular.ttf, Allura-Regular.ttf (Google Fonts, OFL).
"""
import math
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

W, H = 3000, 2000
CREAM = (238, 229, 212)
SS = 2  # supersampling pentru masti

# (fisier, (x0, y0, x1, y1), rotire, (focus_x, focus_y), banda_film, luminozitate)
LAYOUT = [
    # rand sus
    ("cetate_imbratisare", (-30, -30, 790, 590), -1.5, (0.55, 0.40), None, 1.0),
    ("rau_noaptea", (750, -30, 1560, 620), 1.2, (0.62, 0.40), "left", 1.08),
    ("schi", (1520, -40, 2080, 640), -2.0, (0.45, 0.42), None, 1.0),
    ("copac_rosu", (2040, -30, 3030, 610), 1.5, (0.52, 0.38), None, 1.0),
    # coloana stanga
    ("seara_apa", (-30, 540, 460, 1420), 1.2, (0.52, 0.42), None, 1.18),
    ("munte_brazi", (420, 570, 900, 1400), -1.8, (0.50, 0.48), None, 1.0),
    # coloana dreapta
    ("oglinda_hol", (2110, 560, 2590, 1450), 1.6, (0.46, 0.45), None, 1.02),
    ("atv", (2550, 560, 3030, 1500), -1.2, (0.55, 0.45), None, 1.0),
    # rand jos
    ("cetate_selfie", (-30, 1350, 770, 2030), 1.0, (0.45, 0.40), "right", 1.0),
    ("craciun", (740, 1390, 1280, 2040), -1.5, (0.50, 0.40), None, 1.0),
    ("casute", (1520, 1400, 1960, 2040), 1.8, (0.68, 0.42), None, 1.05),
    ("acasa_selfie", (1930, 1445, 2480, 2095), -1.2, (0.72, 0.40), None, 1.0),
    # poza principala (desenata ultima, peste vecini)
    ("lac_sarut", (830, 560, 2170, 1430), 0.0, (0.47, 0.45), None, 1.0),
]

MIRROR = ("oglinda_drum", (570, 640, 555), (2730, 1705, 310))  # (sursa cx, cy, r), (dest cx, cy, r)
CARD = (1265, 1450, 1545, 1975, -3.0)

TEXTS = [  # (text, font, marime, (x, y), rotire)
    ("Together", "GreatVibes-Regular.ttf", 190, (1530, 575), -4.0),
    ("You", "GreatVibes-Regular.ttf", 150, (2170, 1120), -6.0),
    ("& Me", "GreatVibes-Regular.ttf", 130, (2230, 1250), -6.0),
]
HEARTS = [  # (cx, cy, marime, culoare, grosime)
    (2045, 690, 70, (255, 255, 255), 6),
    (2060, 1310, 44, (255, 255, 255), 5),
    (2890, 70, 45, (255, 255, 255), 5),
]


def rng_for(name):
    return random.Random(sum(map(ord, name)) * 7919)


def paper(w, h, rng, base=CREAM):
    noise = np.random.default_rng(rng.randint(0, 10**6)).normal(0, 7, (h, w, 1))
    arr = np.clip(np.array(base, dtype=float) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB").filter(ImageFilter.GaussianBlur(0.8))


def smooth_noise(n, rng, knots_every=10):
    k = max(3, n // knots_every + 2)
    knots = [rng.uniform(-1, 1) for _ in range(k)]
    out = []
    for i in range(n):
        t = i / max(1, n - 1) * (k - 1)
        a = int(t)
        b = min(a + 1, k - 1)
        f = t - a
        f = f * f * (3 - 2 * f)
        out.append(knots[a] * (1 - f) + knots[b] * f)
    return out


def torn_rect(x0, y0, x1, y1, amp, rng, step=5):
    """Poligon cu margini neregulate (hartie rupta) in jurul unui dreptunghi."""
    pts = []
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    for i in range(4):
        (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
        length = math.hypot(bx - ax, by - ay)
        n = max(4, int(length / step))
        nx, ny = (by - ay) / length, -(bx - ax) / length  # normala spre exterior
        low = smooth_noise(n, rng)
        for j in range(n):
            t = j / n
            off = low[j] * amp + rng.uniform(-1, 1) * amp * 0.45
            pts.append((ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off))
    return pts


def poly_mask(size, pts):
    w, h = size
    m = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(m).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return m.resize(size, Image.LANCZOS)


def crop_cover(img, w, h, focus):
    scale = max(w / img.width, h / img.height)
    rw, rh = math.ceil(img.width * scale), math.ceil(img.height * scale)
    img = img.resize((rw, rh), Image.LANCZOS)
    left = min(max(0, int(focus[0] * rw - w / 2)), rw - w)
    top = min(max(0, int(focus[1] * rh - h / 2)), rh - h)
    img = img.crop((left, top, left + w, top + h))
    if scale > 1.05:
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return img


def film_strip(h, width=62):
    s = Image.new("RGB", (width, h), (18, 17, 16))
    d = ImageDraw.Draw(s)
    hw, hh, gap = 24, 30, 54
    for y in range(12, h, gap):
        d.rounded_rectangle(((width - hw) // 2, y, (width + hw) // 2, y + hh), 4, fill=(226, 220, 208))
    return s


def make_piece(img, w, h, focus, film, name, bright=1.0):
    """Poza cu margine de hartie rupta (+ banda de film). Intoarce RGBA."""
    rng = rng_for(name)
    fw = 62 if film else 0
    photo = crop_cover(img, w - fw, h, focus)
    if bright != 1.0:
        photo = ImageEnhance.Brightness(photo).enhance(bright)
        photo = ImageEnhance.Contrast(photo).enhance(1.03)
    content = Image.new("RGB", (w, h))
    if film == "left":
        content.paste(film_strip(h), (0, 0))
        content.paste(photo, (fw, 0))
    elif film == "right":
        content.paste(photo, (0, 0))
        content.paste(film_strip(h), (w - fw, 0))
    else:
        content.paste(photo, (0, 0))

    pad = 40
    cw, ch = w + 2 * pad, h + 2 * pad
    rim_mask = poly_mask((cw, ch), torn_rect(pad - 14, pad - 14, pad + w + 14, pad + h + 14, 9, rng))
    photo_mask = poly_mask((cw, ch), torn_rect(pad + 2, pad + 2, pad + w - 2, pad + h - 2, 5, rng))

    piece = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    piece.paste(paper(cw, ch, rng), (0, 0), rim_mask)
    piece.paste(content, (pad, pad), photo_mask.crop((pad, pad, pad + w, pad + h)))
    return piece


def place(canvas, piece, cx, cy, rot, shadow=0.45):
    if rot:
        piece = piece.rotate(rot, resample=Image.BICUBIC, expand=True)
    x, y = int(cx - piece.width / 2), int(cy - piece.height / 2)
    alpha = piece.getchannel("A")
    sh = Image.new("RGBA", piece.size, (30, 20, 10, 0))
    sh.putalpha(alpha.point(lambda a: int(a * shadow)).filter(ImageFilter.GaussianBlur(12)))
    canvas.alpha_composite(sh, (x + 7, y + 10))
    canvas.alpha_composite(piece, (x, y))


def mirror_circle(img, src, dst):
    (sx, sy, sr), (dx, dy, dr) = src, dst
    crop = img.crop((sx - sr, sy - sr, sx + sr, sy + sr)).resize((2 * dr, 2 * dr), Image.LANCZOS)
    ring = int(dr * 0.12)
    size = 2 * dr + 2 * ring + 20
    c = size // 2
    piece = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(piece)
    R = (dr + ring) * SS
    d.ellipse((c * SS - R - 6, c * SS - R - 6, c * SS + R + 6, c * SS + R + 6), fill=(120, 120, 118, 255))
    segs = 28
    for i in range(segs):
        a0, a1 = 360 / segs * i, 360 / segs * (i + 1)
        col = (170, 28, 38, 255) if i % 2 == 0 else (240, 236, 228, 255)
        d.pieslice((c * SS - R, c * SS - R, c * SS + R, c * SS + R), a0, a1, fill=col)
    piece = piece.resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size * SS, size * SS), 0)
    r_in = dr - int(ring * 0.1)
    ImageDraw.Draw(m).ellipse(((c - r_in) * SS, (c - r_in) * SS, (c + r_in) * SS, (c + r_in) * SS), fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    inner = Image.new("RGB", (size, size))
    inner.paste(crop, (c - dr, c - dr))
    piece.paste(inner, (0, 0), m)
    # reflex usor pe sticla
    gl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse((c - r_in * 0.8, c - r_in * 0.95, c + r_in * 0.2, c - r_in * 0.25), fill=(255, 255, 255, 28))
    piece.alpha_composite(gl.filter(ImageFilter.GaussianBlur(25)))
    return piece, dx, dy


def heart_points(cx, cy, s, n=120):
    pts = []
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 32, cy - y * s / 32))
    return pts


def draw_heart(canvas, cx, cy, s, color, width, shadow=True):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    pts = heart_points(cx, cy, s)
    if shadow:
        sl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(sl).line([(x + 3, y + 4) for x, y in pts], fill=(0, 0, 0, 150), width=width + 2, joint="curve")
        canvas.alpha_composite(sl.filter(ImageFilter.GaussianBlur(4)))
    d.line(pts, fill=color + (255,), width=width, joint="curve")
    canvas.alpha_composite(layer)


def draw_text(canvas, text, font_path, size, pos, rot, color=(255, 255, 255), shadow=True):
    font = ImageFont.truetype(font_path, size)
    l, t, r, b = font.getbbox(text)
    pad = 40
    layer = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((pad - l, pad - t), text, font=font, fill=color + (255,))
    if rot:
        layer = layer.rotate(rot, resample=Image.BICUBIC, expand=True)
    x, y = int(pos[0] - layer.width / 2), int(pos[1] - layer.height / 2)
    if shadow:
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        sh.putalpha(layer.getchannel("A").point(lambda a: int(a * 0.75)).filter(ImageFilter.GaussianBlur(6)))
        canvas.alpha_composite(sh, (x + 3, y + 5))
    canvas.alpha_composite(layer, (x, y))


def make_card(fonts):
    x0, y0, x1, y1, rot = CARD
    w, h = x1 - x0, y1 - y0
    rng = rng_for("card")
    pad = 30
    cw, ch = w + 2 * pad, h + 2 * pad
    base = paper(cw, ch, rng, base=(236, 226, 206))
    # pete usoare de hartie veche
    stains = Image.new("L", (cw, ch), 0)
    sd = ImageDraw.Draw(stains)
    for _ in range(6):
        rx, ry, rr = rng.randint(0, cw), rng.randint(0, ch), rng.randint(40, 110)
        sd.ellipse((rx - rr, ry - rr, rx + rr, ry + rr), fill=rng.randint(15, 35))
    base.paste((200, 180, 150), (0, 0), stains.filter(ImageFilter.GaussianBlur(40)))
    piece = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    piece.paste(base, (0, 0), poly_mask((cw, ch), torn_rect(pad, pad, pad + w, pad + h, 8, rng)))
    ink = (48, 36, 28)
    words = ["Good", "People", "Better", "Moments"]
    size = 96
    font = ImageFont.truetype(fonts + "/Allura-Regular.ttf", size)
    while max(font.getlength(wd) for wd in words) > w - 70:
        size -= 2
        font = ImageFont.truetype(fonts + "/Allura-Regular.ttf", size)
    d = ImageDraw.Draw(piece)
    for i, word in enumerate(words):
        d.text((pad + 22 + (i % 2) * 16, pad + 45 + i * (h - 170) // 4), word, font=font, fill=ink)
    heart = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(heart).line(heart_points(pad + w - 75, pad + h - 70, 50), fill=ink + (255,), width=4, joint="curve")
    piece.alpha_composite(heart)
    return piece, (x0 + x1) / 2, (y0 + y1) / 2, rot


def main(photos, fonts, out):
    canvas = paper(W, H, rng_for("fundal")).convert("RGBA")

    for name, (x0, y0, x1, y1), rot, focus, film, bright in LAYOUT:
        img = Image.open(f"{photos}/{name}.png").convert("RGB")
        img = ImageOps.exif_transpose(img)
        piece = make_piece(img, x1 - x0, y1 - y0, focus, film, name, bright)
        place(canvas, piece, (x0 + x1) / 2, (y0 + y1) / 2, rot, shadow=0.55 if name == "lac_sarut" else 0.45)

    card, cx, cy, rot = make_card(fonts)
    place(canvas, card, cx, cy, rot, shadow=0.5)

    name, src, dst = MIRROR
    piece, dx, dy = mirror_circle(Image.open(f"{photos}/{name}.png").convert("RGB"), src, dst)
    place(canvas, piece, dx, dy, 0, shadow=0.55)

    for text, font, size, pos, rot in TEXTS:
        draw_text(canvas, text, f"{fonts}/{font}", size, pos, rot)
    for cx, cy, s, col, wdt in HEARTS:
        draw_heart(canvas, cx, cy, s, col, wdt)

    final = canvas.convert("RGB")
    final.save(out, quality=93, subsampling=0)
    print("salvat:", out, final.size)


if __name__ == "__main__":
    main(*sys.argv[1:4])
