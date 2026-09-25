"""Colaj foto in stil scrapbook (margini rupte, banda de film, rama rotunda, biletel, texte).

Utilizare:
    python3 make_collage.py <folder_poze> <folder_fonturi> <iesire.jpg>

Pozele NU se tin in repo - folderul de poze ramane local.
Fonturi necesare in <folder_fonturi> (Google Fonts): IMFeENit28P.ttf, IMFeENrm28P.ttf, AbrilFatface-Regular.ttf,\nUnifrakturMaguntia-Book.ttf, OldStandard-Bold.ttf, SpecialElite-Regular.ttf.
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
    ("lac_sarut", (2040, -30, 3030, 610), 1.5, (0.50, 0.45), None, 1.0),
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
    ("copac_rosu", (830, 560, 2170, 1430), 0.0, (0.52, 0.36), None, 1.0),
]

MIRROR = ("oglinda_drum", (570, 640, 555), (2730, 1705, 310))  # (sursa cx, cy, r), (dest cx, cy, r)
CARD = (1265, 1450, 1545, 1975, -3.0)

TEXTS = [  # (text, font, marime, (x, y), rotire)
    ("Together", "IMFeENit28P.ttf", 170, (1830, 640), -4.0),
    ("You", "IMFeENit28P.ttf", 140, (2170, 1120), -6.0),
    ("& Me", "IMFeENit28P.ttf", 120, (2230, 1250), -6.0),
]
HEARTS = [  # (cx, cy, marime, culoare, grosime)
    (2105, 575, 60, (255, 255, 255), 6),
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


def rounded_path(x0, y0, x1, y1, r, step):
    """Puncte (x, y, nx, ny) pe conturul unui dreptunghi cu colturi rotunjite; n = normala spre exterior."""
    r = max(0, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
    out = []

    def line(ax, ay, bx, by, nx, ny):
        n = max(1, int(math.hypot(bx - ax, by - ay) / step))
        out.extend((ax + (bx - ax) * j / n, ay + (by - ay) * j / n, nx, ny) for j in range(n))

    def arc(cx, cy, a0):
        n = max(2, int(r * math.pi / 2 / step))
        for j in range(n):
            a = math.radians(a0 + 90 * j / n)
            out.append((cx + r * math.cos(a), cy + r * math.sin(a), math.cos(a), math.sin(a)))

    line(x0 + r, y0, x1 - r, y0, 0, -1)
    arc(x1 - r, y0 + r, -90)
    line(x1, y0 + r, x1, y1 - r, 1, 0)
    arc(x1 - r, y1 - r, 0)
    line(x1 - r, y1, x0 + r, y1, 0, 1)
    arc(x0 + r, y1 - r, 90)
    line(x0, y1 - r, x0, y0 + r, -1, 0)
    arc(x0 + r, y0 + r, 180)
    return out


def torn_rect(x0, y0, x1, y1, amp, rng, radius=0, bites=0, step=4):
    """Poligon cu margini de hartie rupta (colturi rotunjite + rupturi mai adanci)."""
    path = rounded_path(x0, y0, x1, y1, radius, step)
    n = len(path)
    low = smooth_noise(n, rng, knots_every=9)
    mid = smooth_noise(n, rng, knots_every=3)
    offs = [low[i] * amp + mid[i] * amp * 0.45 + rng.uniform(-1, 1) * amp * 0.3 for i in range(n)]
    for _ in range(bites):  # rupturi mai adanci, spre interior
        c, width, depth = rng.randrange(n), rng.uniform(4, 14), amp * rng.uniform(1.2, 2.6)
        for i in range(n):
            d = min(abs(i - c), n - abs(i - c))
            offs[i] -= depth * math.exp(-(d / width) ** 2)
    return [(x + nx * o, y + ny * o) for (x, y, nx, ny), o in zip(path, offs)]


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
    if scale > 1.4:
        img = img.filter(ImageFilter.UnsharpMask(radius=2.5, percent=90, threshold=2))
    elif scale > 1.05:
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return img


def film_strip(h, width=62):
    s = Image.new("RGB", (width, h), (18, 17, 16))
    d = ImageDraw.Draw(s)
    hw, hh, gap = 24, 30, 54
    for y in range(12, h, gap):
        d.rounded_rectangle(((width - hw) // 2, y, (width + hw) // 2, y + hh), 4, fill=(226, 220, 208))
    return s


def enhance(photo, bright=1.0):
    """Putin mai mult contrast si culoare, ca pozele sa arate mai vii."""
    photo = ImageOps.autocontrast(photo, cutoff=0.6, preserve_tone=True)
    if bright != 1.0:
        photo = ImageEnhance.Brightness(photo).enhance(bright)
    photo = ImageEnhance.Contrast(photo).enhance(1.12)
    photo = ImageEnhance.Color(photo).enhance(1.12)
    return ImageEnhance.Sharpness(photo).enhance(1.15)


def make_piece(img, w, h, focus, film, name, bright=1.0):
    """Poza cu margine de hartie rupta (+ banda de film). Intoarce RGBA."""
    rng = rng_for(name)
    fw = 62 if film else 0
    photo = enhance(crop_cover(img, w - fw, h, focus), bright)
    content = Image.new("RGB", (w, h))
    if film == "left":
        content.paste(film_strip(h), (0, 0))
        content.paste(photo, (fw, 0))
    elif film == "right":
        content.paste(photo, (0, 0))
        content.paste(film_strip(h), (w - fw, 0))
    else:
        content.paste(photo, (0, 0))

    pad = 70
    cw, ch = w + 2 * pad, h + 2 * pad
    rim = torn_rect(pad - 20, pad - 20, pad + w + 20, pad + h + 20, 13, rng, radius=46, bites=5)
    fiber = torn_rect(pad - 6, pad - 6, pad + w + 6, pad + h + 6, 8, rng, radius=36, bites=4)
    inner = torn_rect(pad + 4, pad + 4, pad + w - 4, pad + h - 4, 8, rng, radius=30, bites=6)

    piece = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    piece.paste(paper(cw, ch, rng), (0, 0), poly_mask((cw, ch), rim))
    piece.paste(paper(cw, ch, rng, base=(250, 247, 240)), (0, 0), poly_mask((cw, ch), fiber))
    photo_mask = poly_mask((cw, ch), inner).crop((pad, pad, pad + w, pad + h))
    piece.paste(content, (pad, pad), photo_mask)
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


def distress(alpha, rng, amount=1.0):
    """Uzeaza cerneala: margini zgrunturoase si mici goluri, ca la tiparul vechi."""
    w, h = alpha.size
    g = np.random.default_rng(rng.randint(0, 10**6))
    a = np.asarray(alpha.filter(ImageFilter.GaussianBlur(1.2)), dtype=float) / 255
    grain = np.asarray(Image.fromarray((g.random((h, w)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)), dtype=float) / 255
    a = np.clip((a - 0.5 + (grain - 0.5) * 0.9 * amount) * 6 + 0.5, 0, 1)
    specks = Image.fromarray((g.random((h // 6 + 1, w // 6 + 1)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    holes = np.asarray(specks.filter(ImageFilter.GaussianBlur(1.5)), dtype=float) / 255
    a = a * np.clip((0.78 + 0.1 * (1 - amount) - holes) * 8, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), "L")


def draw_text(canvas, text, font_path, size, pos, rot, color=(255, 255, 255), shadow=True):
    font = ImageFont.truetype(font_path, size)
    l, t, r, b = font.getbbox(text)
    pad = 40
    mask = Image.new("L", (r - l + 2 * pad, b - t + 2 * pad), 0)
    ImageDraw.Draw(mask).text((pad - l, pad - t), text, font=font, fill=255)
    mask = distress(mask, rng_for(text))
    layer = Image.new("RGBA", mask.size, color + (0,))
    layer.putalpha(mask)
    if rot:
        layer = layer.rotate(rot, resample=Image.BICUBIC, expand=True)
    x, y = int(pos[0] - layer.width / 2), int(pos[1] - layer.height / 2)
    if shadow:
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        sh.putalpha(layer.getchannel("A").point(lambda a: int(a * 0.8)).filter(ImageFilter.GaussianBlur(6)))
        canvas.alpha_composite(sh, (x + 3, y + 5))
    canvas.alpha_composite(layer, (x, y))


NEWSPRINT = (224, 214, 190)


def newspaper_bg(w, h, rng, fonts):
    """Hartie de ziar ingalbenita, cu coloane de text marunt si sters."""
    img = paper(w, h, rng, base=NEWSPRINT)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(fonts + "/IMFeENrm28P.ttf", 17)
    letters = "abcdefghilmnoprstuvaeioe"
    cols = max(1, w // 150)
    cw = w / cols
    for c in range(cols):
        y = rng.randint(-10, 10)
        while y < h:
            line = " ".join("".join(rng.choice(letters) for _ in range(rng.randint(2, 8))) for _ in range(8))
            d.text((c * cw + 8, y), line, font=font, fill=(155, 145, 126))
            y += 20
        if c:
            d.line((c * cw - 3, 0, c * cw - 3, h), fill=(140, 130, 112), width=1)
    img = img.crop((0, 0, w, h))
    return img


def clipping(word, font_path, size, rng, fonts, invert=False):
    """Un cuvant decupat din ziar, cu margini rupte."""
    font = ImageFont.truetype(font_path, size)
    l, t, r, b = font.getbbox(word)
    tw, th = r - l, b - t
    px, py = 22, 16
    w, h = tw + 2 * px, th + 2 * py
    pad = 24
    cw, ch = w + 2 * pad, h + 2 * pad
    bg = Image.new("RGB", (cw, ch), (24, 22, 20)) if invert else newspaper_bg(cw, ch, rng, fonts)
    ink = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(ink).text((pad + px - l, pad + py - t), word, font=font, fill=255)
    ink = distress(ink, rng, amount=0.6)
    col = (246, 240, 226) if invert else (22, 20, 18)
    bg.paste(col, (0, 0), ink)
    piece = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    piece.paste(bg, (0, 0), poly_mask((cw, ch), torn_rect(pad, pad, pad + w, pad + h, 6, rng, radius=6, bites=3)))
    return piece


def make_card(fonts):
    """Biletel ca o bucata rupta din ziar, cu cuvinte decupate lipite peste."""
    x0, y0, x1, y1, rot = CARD
    w, h = x1 - x0, y1 - y0
    rng = rng_for("card")
    pad = 50
    cw, ch = w + 2 * pad, h + 2 * pad
    base = newspaper_bg(cw, ch, rng, fonts)
    stains = Image.new("L", (cw, ch), 0)
    sd = ImageDraw.Draw(stains)
    for _ in range(7):
        rx, ry, rr = rng.randint(0, cw), rng.randint(0, ch), rng.randint(40, 120)
        sd.ellipse((rx - rr, ry - rr, rx + rr, ry + rr), fill=rng.randint(25, 55))
    base.paste((170, 140, 95), (0, 0), stains.filter(ImageFilter.GaussianBlur(45)))
    piece = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    piece.paste(base, (0, 0), poly_mask((cw, ch), torn_rect(pad, pad, pad + w, pad + h, 15, rng, radius=20, bites=8)))

    words = [  # (cuvant, font, marime, inversat)
        ("Good", "AbrilFatface-Regular.ttf", 64, False),
        ("People", "UnifrakturMaguntia-Book.ttf", 60, True),
        ("Better", "OldStandard-Bold.ttf", 58, False),
        ("Moments", "SpecialElite-Regular.ttf", 50, True),
    ]
    step = (h - 120) / len(words)
    for i, (word, font, size, inv) in enumerate(words):
        c = clipping(word, f"{fonts}/{font}", size, rng, fonts, inv)
        scale = min(1.0, (w - 20) / c.width)
        if scale < 1:
            c = c.resize((int(c.width * scale), int(c.height * scale)), Image.LANCZOS)
        c = c.rotate(rng.uniform(-6, 6), resample=Image.BICUBIC, expand=True)
        cx = pad + w / 2 + (-14 if i % 2 else 14)
        cy = pad + 55 + i * step + step / 2 - 20
        x, y = int(cx - c.width / 2), int(cy - c.height / 2)
        sh = Image.new("RGBA", c.size, (0, 0, 0, 0))
        sh.putalpha(c.getchannel("A").point(lambda a: int(a * 0.45)).filter(ImageFilter.GaussianBlur(4)))
        piece.alpha_composite(sh, (x + 3, y + 4))
        piece.alpha_composite(c, (x, y))
    heart = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(heart).line(heart_points(pad + w - 60, pad + h - 45, 44), fill=(150, 25, 30, 255), width=5, joint="curve")
    piece.alpha_composite(heart)
    return piece, (x0 + x1) / 2, (y0 + y1) / 2, rot


def main(photos, fonts, out):
    canvas = paper(W, H, rng_for("fundal")).convert("RGBA")

    for name, (x0, y0, x1, y1), rot, focus, film, bright in LAYOUT:
        img = Image.open(f"{photos}/{name}.png").convert("RGB")
        img = ImageOps.exif_transpose(img)
        piece = make_piece(img, x1 - x0, y1 - y0, focus, film, name, bright)
        place(canvas, piece, (x0 + x1) / 2, (y0 + y1) / 2, rot, shadow=0.55 if name == "copac_rosu" else 0.45)

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
