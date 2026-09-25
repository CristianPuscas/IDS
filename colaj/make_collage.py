"""Colaj foto in stil scrapbook (margini rupte, banda de film, rama rotunda, biletel, texte).

Utilizare:
    python3 make_collage.py <folder_poze> <folder_fonturi> <iesire.jpg>

Pozele NU se tin in repo - folderul de poze ramane local.
Fonturi necesare in <folder_fonturi>: Sacramento-Regular.ttf, PinyonScript-Regular.ttf (Google Fonts, OFL).
"""
import math
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

W, H = 4800, 3200
CREAM = (238, 229, 212)
SS = 2  # supersampling pentru masti

ROWS = [  # (y0, y1, x0, x1, [(fisier, latime_relativa, focus, banda_film, editare) sau "CARD"])
    (-30, 640, -30, 4830, [
        ('cetate_imbratisare', 1.5, (0.55, 0.3), None, (1.02, 1.08, 1.05, 0.04, 0.2, 1)),
        ('rau_noaptea', 1.5, (0.62, 0.4), 'left', (1.08, 1.05, 1.0, 0.03, 0.15, 1)),
        ('lac_sarut', 1.5, (0.47, 0.45), None, (1.0, 1.05, 1.0, 0.02, 0.2, 1)),
        ('schi', 1.0, (0.45, 0.42), None, (1.04, 1.06, 1.0, 0.0, 0.1, 1)),
        ('soare_selfie', 1.5, (0.45, 0.4), None, (1.0, 1.04, 0.97, 0.0, 0.05, 0)),
        ('ea_cal', 1.0, (0.55, 0.45), None, (1.0, 1.06, 1.0, 0.03, 0.2, 1)),
        ('usa_pupic', 1.5, (0.58, 0.42), None, (1.02, 1.05, 1.0, 0.03, 0.12, 0)),
        ('retrovizoare', 1.0, (0.55, 0.42), None, (1.0, 1.12, 1.0, 0.0, 0.2, 1)),
    ]),
    (610, 1250, -30, 1630, [
        ('seara_apa', 1.0, (0.52, 0.42), None, (1.0, 1.05, 1.02, 0.0, 0.15, 0)),
        "CARD",
        ('munte_brazi', 1.0, (0.5, 0.48), None, (0.98, 1.04, 0.97, 0.0, 0.1, 1)),
        ('hol_valiza', 1.0, (0.6, 0.42), None, (1.0, 1.05, 1.0, 0.0, 0.1, 0)),
    ]),
    (1220, 1860, -30, 1630, [
        ('el_vale', 1.0, (0.55, 0.45), None, (1.0, 1.08, 1.0, 0.02, 0.2, 1)),
        ('vara_butoaie', 1.0, (0.4, 0.35), None, (1.0, 1.05, 1.0, 0.02, 0.15, 1)),
        ('oglinda_hol', 1.0, (0.46, 0.45), None, (1.04, 1.05, 1.0, 0.0, 0.1, 0)),
        ('patura_rosie', 1.0, (0.52, 0.38), None, (0.97, 1.06, 1.0, 0.02, 0.1, 0)),
    ]),
    (610, 1250, 3170, 4830, [
        ('casuta_stanca', 1.0, (0.6, 0.5), None, (1.0, 1.08, 1.0, 0.0, 0.2, 1)),
        ('atv', 1.0, (0.55, 0.45), None, (1.0, 1.08, 1.05, 0.03, 0.2, 1)),
        ('pod_ceata', 1.0, (0.47, 0.5), None, (1.03, 1.08, 1.0, 0.0, 0.25, 1)),
        ('lexus_profil', 1.0, (0.5, 0.62), None, (1.03, 1.08, 1.0, 0.0, 0.12, 1)),
    ]),
    (1220, 1860, 3170, 4830, [
        ('cal', 1.0, (0.62, 0.4), None, (1.0, 1.04, 0.98, 0.02, 0.05, 1)),
        ('atv_alb', 1.0, (0.5, 0.55), None, (1.0, 1.06, 1.0, 0.03, 0.15, 1)),
        ('lexus_alb', 1.0, (0.45, 0.62), None, (1.02, 1.1, 1.0, -0.02, 0.1, 1)),
    ]),
    (1830, 2480, -30, 4830, [
        ('cetate_selfie', 1.5, (0.45, 0.4), 'right', (1.02, 1.08, 1.05, 0.04, 0.2, 1)),
        ('craciun', 1.0, (0.5, 0.4), None, (1.03, 1.04, 0.98, 0.0, 0.05, 0)),
        ('noapte_pat', 1.0, (0.54, 0.6), None, (1.65, 1.18, 0.75, 0.02, 0.0, 1)),
        ('cascada', 1.5, (0.55, 0.4), None, (1.03, 1.08, 1.0, 0.04, 0.25, 1)),
        ('lexus_fata', 1.0, (0.48, 0.55), None, (1.05, 1.06, 1.0, 0.0, 0.05, 1)),
        ('apus_fata', 1.5, (0.48, 0.35), None, (1.02, 1.06, 1.0, 0.02, 0.2, 0)),
        ('lac_apus', 1.0, (0.48, 0.55), None, (1.0, 1.04, 0.98, 0.0, 0.05, 0)),
        ('oglinda_trafic', 1.0, (0.5, 0.5), None, (1.0, 1.02, 1.0, 0.0, 0.0, 0)),
        ('acasa_selfie', 1.5, (0.72, 0.4), None, (1.0, 1.03, 0.97, 0.0, 0.05, 0)),
        ('casute', 1.0, (0.62, 0.42), None, (1.05, 1.04, 1.0, 0.0, 0.1, 0)),
    ]),
    (2450, 3230, -30, 4830, [
        ('masina_pupic', 1.0, (0.55, 0.35), None, (1.0, 1.05, 1.0, 0.02, 0.1, 0)),
        ('lac_munti', 1.0, (0.5, 0.5), None, (1.0, 1.06, 0.95, 0.0, 0.08, 1)),
        ('lac_selfie', 1.5, (0.5, 0.5), None, (1.0, 1.05, 1.0, 0.03, 0.2, 1)),
        ('lexus_chei', 1.0, (0.5, 0.6), None, (1.0, 1.08, 1.0, 0.0, 0.15, 1)),
        ('certificat', 1.5, (0.55, 0.45), None, (1.0, 1.05, 1.0, 0.02, 0.1, 0)),
        ('ea_lac_aurie', 1.0, (0.48, 0.5), None, (1.0, 1.05, 1.0, 0.03, 0.2, 1)),
        ('motan_prosop', 1.5, (0.62, 0.5), None, (1.03, 1.06, 1.0, 0.02, 0.1, 1)),
    ]),
]
HERO = ("copac_rosu", (1600, 590, 3200, 1855), (0.58, 0.40), None, (1.03, 1.06, 0.97, 0.0, 0.05, 1))
OVERLAP = 35


def build_layout():
    """Imparte fiecare rand intre poze dupa latimea relativa; intoarce LAYOUT si locul biletelului."""
    layout, card = [], None
    for y0, y1, x0, x1, items in ROWS:
        weights = [1.0 if it == "CARD" else it[1] for it in items]
        unit = (x1 - x0 + OVERLAP * (len(items) - 1)) / sum(weights)
        x = x0
        for k, (it, wt) in enumerate(zip(items, weights)):
            w = int(round(unit * wt))
            rot = (1.0 + (k * 7 + y0 // 10) % 9 * 0.12) * (-1 if (k + y0 // 100) % 2 else 1)
            if it == "CARD":
                card = (x + 25, y0 + 30, x + w - 25, y1 - 30, 2.0)
            else:
                name, _, focus, film, edit = it
                layout.append((name, (x, y0, x + w, y1), rot, focus, film, edit))
            x += w - OVERLAP
    name, box, focus, film, edit = HERO
    layout.append((name, box, 0.0, focus, film, edit))  # principala, desenata ultima
    return layout, card


LAYOUT, CARD = build_layout()

MIRROR = ("oglinda_drum", (570, 640, 555), (4060, 2560, 215), (1.02, 1.06, 1.04, 0.02, 0.20, 1))  # sursa (cx, cy, r), destinatie (cx, cy, r), editare

TEXTS = [  # (text, font, marime, (x, y), rotire, ingrosare, umbra_inchisa)
    ("Together", "Sacramento-Regular.ttf", 190, (2720, 730), -5.0, 1, 0.35),
    ("You", "Sacramento-Regular.ttf", 150, (3300, 900), -4.0, 3, 0.7),
    ("& Me", "Sacramento-Regular.ttf", 150, (3350, 1025), -4.0, 3, 0.7),
]
STICKERS = [  # (fisier_png_transparent, (cx, cy), latime, rotire)
    ("pisoi_sticker", (2220, 2555), 400, -6.0),
    ("motan_sapca_sticker", (4540, 1340), 400, 5.0),
    ("motan_sticker", (1760, 1560), 280, -4.0),
    ("motan_doarme_sticker", (800, 2590), 360, 6.0),
]
HEARTS = [  # (cx, cy, marime, culoare, grosime)
    (2960, 850, 70, (255, 255, 255), 4),
    (3160, 975, 44, (255, 255, 255), 6),
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


def enhance(photo, edit=(1.0, 1.0, 1.0, 0.0, 0.0, 0)):
    """Editare pe poza: luminozitate, contrast, saturatie, caldura (+cald/-rece),
    vibranta (intareste doar culorile sterse) si claritate (relief local)."""
    bright, contrast, color, warm, vib, clarity = edit
    photo = ImageEnhance.Brightness(photo).enhance(bright)
    photo = ImageEnhance.Contrast(photo).enhance(contrast)
    photo = ImageEnhance.Color(photo).enhance(color)
    if warm or vib:
        hsv = np.asarray(photo.convert("HSV"), dtype=float)
        s_ = hsv[..., 1] / 255
        hsv[..., 1] = np.clip(s_ + vib * s_ * (1 - s_) * 1.6, 0, 1) * 255
        photo = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")
        if warm:
            a = np.asarray(photo, dtype=float)
            a[..., 0] *= 1 + warm
            a[..., 2] *= 1 - warm
            photo = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if clarity:
        photo = photo.filter(ImageFilter.UnsharpMask(radius=25, percent=22, threshold=3))
    return ImageEnhance.Sharpness(photo).enhance(1.1)


def make_piece(img, w, h, focus, film, name, edit=(1.0, 1.0, 1.0, 0.0, 0.0, 0)):
    """Poza cu margine de hartie rupta (+ banda de film). Intoarce RGBA."""
    rng = rng_for(name)
    fw = 62 if film else 0
    photo = enhance(crop_cover(img, w - fw, h, focus), edit)
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


def make_sticker(img, width, rot, border=16):
    """Decupaj transparent cu contur alb, ca un autocolant."""
    img = img.resize((width, int(img.height * width / img.width)), Image.LANCZOS)
    pad = border + 30
    a = Image.new("L", (img.width + 2 * pad, img.height + 2 * pad), 0)
    a.paste(img.getchannel("A"), (pad, pad))
    # conturul se calculeaza din forma netezita, ca mustatile sa nu faca zimti
    body = a.filter(ImageFilter.GaussianBlur(border)).point(lambda v: 255 if v > 128 else 0)
    outline = body.filter(ImageFilter.MaxFilter(2 * border + 1)).filter(ImageFilter.GaussianBlur(border / 3))
    outline = outline.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(1.5))
    piece = Image.new("RGBA", a.size, (255, 255, 255, 0))
    piece.putalpha(outline)
    inner = Image.new("RGBA", a.size, (0, 0, 0, 0))
    inner.paste(img, (pad, pad))
    # ce iese in afara conturului (varfuri de mustati pe fundal inchis) se taie
    inner.putalpha(Image.fromarray(np.minimum(np.asarray(inner.getchannel("A")), np.asarray(outline))))
    piece.alpha_composite(inner)
    return piece


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


def draw_text(canvas, text, font_path, size, pos, rot, stroke=0, glow=0.0, color=(255, 255, 255), shadow=True):
    """stroke = ingrosare litere (px); glow = umbra inchisa difuza in spate, pentru fundal luminos (0..1)."""
    font = ImageFont.truetype(font_path, size)
    l, t, r, b = font.getbbox(text, stroke_width=stroke)
    pad = 60
    layer = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((pad - l, pad - t), text, font=font, fill=color + (255,),
                               stroke_width=stroke, stroke_fill=color + (255,))
    if rot:
        layer = layer.rotate(rot, resample=Image.BICUBIC, expand=True)
    x, y = int(pos[0] - layer.width / 2), int(pos[1] - layer.height / 2)
    if shadow:
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        sh.putalpha(layer.getchannel("A").point(lambda a: int(a * 0.75)).filter(ImageFilter.GaussianBlur(6)))
        canvas.alpha_composite(sh, (x + 3, y + 5))
    if glow:
        gl = Image.new("RGBA", layer.size, (15, 12, 10, 0))
        gl.putalpha(layer.getchannel("A").filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(14)).point(lambda a: int(min(255, a * glow * 1.6))))
        canvas.alpha_composite(gl, (x, y))
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
    piece.paste(base, (0, 0), poly_mask((cw, ch), torn_rect(pad, pad, pad + w, pad + h, 10, rng, radius=24, bites=4)))
    ink = (48, 36, 28)
    words = ["Good", "People", "Better", "Moments"]
    size = 96
    font = ImageFont.truetype(fonts + "/PinyonScript-Regular.ttf", size)
    while max(font.getlength(wd) for wd in words) > w - 70:
        size -= 2
        font = ImageFont.truetype(fonts + "/PinyonScript-Regular.ttf", size)
    d = ImageDraw.Draw(piece)
    for i, word in enumerate(words):
        d.text((pad + 22 + (i % 2) * 16, pad + 45 + i * (h - 170) // 4), word, font=font, fill=ink)
    heart = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(heart).line(heart_points(pad + w - 75, pad + h - 70, 50), fill=ink + (255,), width=4, joint="curve")
    piece.alpha_composite(heart)
    return piece, (x0 + x1) / 2, (y0 + y1) / 2, rot


def main(photos, fonts, out):
    canvas = paper(W, H, rng_for("fundal")).convert("RGBA")

    for name, (x0, y0, x1, y1), rot, focus, film, edit in LAYOUT:
        img = Image.open(f"{photos}/{name}.png").convert("RGB")
        img = ImageOps.exif_transpose(img)
        piece = make_piece(img, x1 - x0, y1 - y0, focus, film, name, edit)
        place(canvas, piece, (x0 + x1) / 2, (y0 + y1) / 2, rot, shadow=0.55 if name == LAYOUT[-1][0] else 0.45)

    card, cx, cy, rot = make_card(fonts)
    place(canvas, card, cx, cy, rot, shadow=0.5)

    name, src, dst, edit = MIRROR
    piece, dx, dy = mirror_circle(enhance(Image.open(f"{photos}/{name}.png").convert("RGB"), edit), src, dst)
    place(canvas, piece, dx, dy, 0, shadow=0.55)

    for name, (cx, cy), width, rot in STICKERS:
        piece = make_sticker(Image.open(f"{photos}/{name}.png").convert("RGBA"), width, rot)
        place(canvas, piece, cx, cy, rot, shadow=0.5)

    for text, font, size, pos, rot, stroke, glow in TEXTS:
        draw_text(canvas, text, f"{fonts}/{font}", size, pos, rot, stroke, glow)
    for cx, cy, s, col, wdt in HEARTS:
        draw_heart(canvas, cx, cy, s, col, wdt)

    final = canvas.convert("RGB")
    final.save(out, quality=93, subsampling=0)
    print("salvat:", out, final.size)


if __name__ == "__main__":
    main(*sys.argv[1:4])
