#!/usr/bin/env python3
"""Phase 2: development tiers.

Writes CLASS (IMF advanced economies, UN least developed countries with graduation
dates, sources) into data/appdata.json and fills the sov column (M49 code of the
sovereign state) for dependent territories, freely associated states and Monaco.

The tier itself is computed in the browser from today's date (app.js tierOf):
  ADV  sov-or-self in CLASS.adv
  LDC  sov-or-self in CLASS.ldc and (no graduation date or today < that date)
  DEV  everything else
"""
import datetime as dt
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, '..', 'data', 'appdata.json')

# IMF World Economic Outlook, April 2026, Statistical Appendix Table B: 43 advanced economies
# (Bulgaria joined with the euro on 1 January 2026; Liechtenstein, an IMF member since 2024, is listed
# under other advanced economies)
ADV = [300, 528, 578, 554, 158, 410, 208, 276, 428, 442, 440, 438, 446, 470, 840, 56, 100, 674, 752,
       756, 724, 703, 705, 702, 352, 372, 20, 233, 826, 40, 376, 380, 392, 203, 124, 191, 196, 620,
       630, 250, 246, 36, 344]

# UN list of least developed countries as of 19 December 2024 (44), with scheduled graduation dates.
# null = no graduation scheduled. From the graduation date the country counts as developing.
LDC = {270: None, 324: None, 624: None, 728: None, 524: '2026-11-24', 562: None, 626: None,
       418: '2026-11-24', 430: None, 426: None, 646: None, 450: None, 454: None, 466: None, 478: None,
       508: None, 104: None, 50: '2026-11-24', 204: None, 108: None, 854: None, 686: '2029-12-19',
       706: None, 90: '2027-12-13', 729: None, 694: None, 332: None, 4: None, 24: None, 232: None,
       231: None, 887: None, 800: None, 894: None, 140: None, 262: None, 148: None, 116: '2029-12-19',
       174: None, 180: None, 296: None, 834: None, 768: None, 798: None}

# sovereign state -> dependent territories and freely associated states (Cook Islands, Niue)
# Monaco is sovereign but not an IMF member, so it is grouped with France (see app.js tierNote)
SOV = {
    826: [60, 92, 136, 238, 292, 500, 654, 660, 796, 831, 832, 833],
    250: [175, 254, 258, 312, 474, 540, 638, 652, 663, 666, 876, 492],
    528: [531, 533, 534, 535],
    840: [16, 316, 580, 850],
    208: [234, 304],
    554: [184, 570, 772],
}

SOURCES = {
    'imf': 'IMF WEO 2026년 4월 통계 부록 Table B',
    'imf_url': 'https://www.imf.org/-/media/files/publications/weo/2026/april/english/statsappendix.pdf',
    'ldc': 'UN 최저개발국 목록, 2024년 12월 19일 기준',
    'ldc_url': 'https://www.un.org/development/desa/dpad/wp-content/uploads/sites/45/publication/ldc_list.pdf',
}

# expected (places, share of 2026 births in %, largest-remainder rounding) before and after the
# 2026-11-24 graduations; the unrounded LDC share before that date is 28.3349%
EXPECT = {
    '2026-09-24': {'ADV': (80, 7.37), 'DEV': (112, 64.29), 'LDC': (44, 28.34)},
    '2026-11-24': {'LDC': (41, 25.23)},
}


def tier_of(code, sov, day):
    c = sov or code
    if c in ADV:
        return 'ADV'
    if c in LDC and (LDC[c] is None or day < dt.date.fromisoformat(LDC[c])):
        return 'LDC'
    return 'DEV'


def largest_remainder(exact, total):
    # same rounding as app.js largestRemainder: the parts add up to the total
    fl = [int(v) for v in exact]
    left = total - sum(fl)
    for _, i in sorted(((v - int(v), i) for i, v in enumerate(exact)), reverse=True)[:left]:
        fl[i] += 1
    return fl


def summary(rows, fi, day):
    tot = sum(r[fi['births']] for r in rows)
    tiers = ('ADV', 'DEV', 'LDC')
    sel = {t: [r for r in rows if tier_of(r[fi['code']], r[fi['sov']], day) == t] for t in tiers}
    # shares in hundredths of a percent, rounded so the three add up to exactly 100.00
    exact = [sum(r[fi['births']] for r in sel[t]) / tot * 10000 for t in tiers]
    hund = largest_remainder(exact, 10000)
    return {t: (len(sel[t]), hund[i] / 100) for i, t in enumerate(tiers)}


def main():
    assert len(ADV) == 43 and len(set(ADV)) == 43
    assert len(LDC) == 44
    assert not set(ADV) & set(LDC)
    with open(PATH, encoding='utf-8') as f:
        d = json.load(f)
    fi = {k: i for i, k in enumerate(d['LOC_FIELDS'])}
    rows = d['LOC']
    codes = {r[fi['code']] for r in rows}
    terr = {t: s for s, ts in SOV.items() for t in ts}
    missing = (set(ADV) | set(LDC) | set(terr) | set(SOV)) - codes
    assert not missing, missing
    for r in rows:
        r[fi['sov']] = terr.get(r[fi['code']])
    d['CLASS'] = {
        'adv': sorted(ADV),
        'ldc': {str(k): v for k, v in sorted(LDC.items())},
        'sources': SOURCES,
    }
    for day, exp in EXPECT.items():
        got = summary(rows, fi, dt.date.fromisoformat(day))
        print(day, got)
        for t, v in exp.items():
            assert got[t] == v, (day, t, got[t], v)
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print('wrote CLASS and sov for', sum(1 for r in rows if r[fi['sov']]), 'places')


if __name__ == '__main__':
    sys.exit(main())
