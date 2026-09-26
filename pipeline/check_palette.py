#!/usr/bin/env python3
"""Checks the page colours in src/style.css against the rules in the README ("색").

- the GDP band colours (--band-1..9) and no data (--band-0): contrast of at least 4.5:1 on --space
- under simulated colour-vision deficiency (Machado 2009 at 100% severity: protan, deutan, tritan)
  and with normal vision, every two of the ten at least 10 apart in CAM02-UCS delta E
- the tier greys (--lvl-3, -2, -1): lightest to darkest, the darkest at least 3:1 on --space

CIEDE2000 distances are printed as well, for reference; the rule uses CAM02-UCS.
Needs: pip install colorspacious (numpy comes with it). Run: python3 pipeline/check_palette.py
"""
import itertools, math, os, re, sys

import numpy as np
from colorspacious import cspace_convert, deltaE

HERE = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(HERE, '..', 'src', 'style.css'), encoding='utf-8').read()
root = css[css.index(':root {'):css.index('}', css.index(':root {'))]
tok = dict(re.findall(r'--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})', root))
SPACE = tok['space']
BANDS = [('band-%d' % b, tok['band-%d' % b]) for b in (1, 2, 3, 4, 5, 6, 7, 8, 9, 0)]
LVLS = [('lvl-%d' % i, tok['lvl-%d' % i]) for i in (3, 2, 1)]
MIN_CONTRAST, MIN_DE, MIN_LVL = 4.5, 10.0, 3.0


def rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def lum(h):
    c = rgb(h)
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(c @ [0.2126, 0.7152, 0.0722])


def contrast(a, b):
    x, y = sorted([lum(a), lum(b)], reverse=True)
    return (x + 0.05) / (y + 0.05)


def de2000(p, q):
    (L1, a1, b1), (L2, a2, b2) = p, q
    Cb = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1, a2 = (1 + G) * a1, (1 + G) * a2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    h1, h2 = math.degrees(math.atan2(b1, a1)) % 360, math.degrees(math.atan2(b2, a2)) % 360
    dh = 0 if C1 * C2 == 0 else (h2 - h1 + 180) % 360 - 180
    dL, dC, dH = L2 - L1, C2 - C1, 2 * math.sqrt(C1 * C2) * math.sin(math.radians(dh / 2))
    Lm, Cm = (L1 + L2) / 2, (C1 + C2) / 2
    hm = h1 + h2 if C1 * C2 == 0 else (h1 + h2) / 2 + (180 if abs(h1 - h2) > 180 and h1 + h2 < 360 else -180 if abs(h1 - h2) > 180 else 0)
    T = (1 - 0.17 * math.cos(math.radians(hm - 30)) + 0.24 * math.cos(math.radians(2 * hm))
         + 0.32 * math.cos(math.radians(3 * hm + 6)) - 0.20 * math.cos(math.radians(4 * hm - 63)))
    Sl = 1 + 0.015 * (Lm - 50) ** 2 / math.sqrt(20 + (Lm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cm, 1 + 0.015 * Cm * T
    Rt = -math.sin(math.radians(60 * math.exp(-((hm - 275) / 25) ** 2))) * 2 * math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7))
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


fail = 0
print('contrast on %s:' % SPACE)
for n, h in BANDS:
    c = contrast(h, SPACE)
    fail += c < MIN_CONTRAST
    print('  %-7s %s %5.2f:1%s' % (n, h, c, '' if c >= MIN_CONTRAST else '  < %.1f' % MIN_CONTRAST))

print('closest pair (CAM02-UCS delta E, rule >= %g; CIEDE2000 for reference):' % MIN_DE)
for name, cvd in (('normal', None), ('deutan', 'deuteranomaly'), ('protan', 'protanomaly'), ('tritan', 'tritanomaly')):
    col = {}
    for n, h in BANDS:
        c = rgb(h)
        if cvd:
            c = np.clip(cspace_convert(c, {'name': 'sRGB1+CVD', 'cvd_type': cvd, 'severity': 100}, 'sRGB1'), 0, 1)
        col[n] = c
    pairs = list(itertools.combinations(col, 2))
    cam = min((float(deltaE(col[a], col[b], input_space='sRGB1')), a, b) for a, b in pairs)
    lab = {n: cspace_convert(c, 'sRGB1', 'CIELab') for n, c in col.items()}
    d00 = min((de2000(lab[a], lab[b]), a, b) for a, b in pairs)
    fail += cam[0] < MIN_DE
    print('  %-7s %5.1f (%s, %s)%s    CIEDE2000 %5.1f (%s, %s)' % (name, cam[0], cam[1], cam[2], '' if cam[0] >= MIN_DE else '  < %g' % MIN_DE, d00[0], d00[1], d00[2]))

print('tier greys on %s:' % SPACE)
prev = None
for n, h in LVLS:
    c = contrast(h, SPACE)
    bad = c < MIN_LVL or (prev is not None and lum(h) >= prev)
    fail += bad
    prev = lum(h)
    print('  %-7s %s %5.2f:1%s' % (n, h, c, '  (too dark, or not darker than the one above)' if bad else ''))

print('%d rule(s) broken' % fail if fail else 'all rules hold')
sys.exit(1 if fail else 0)
