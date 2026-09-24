import json, re, math
import pandas as pd, numpy as np, pyreadr

W = 'wpp/'
countries = pyreadr.read_r(W+'countries.rda')['countries'].sort_values('country_order')
misc = pyreadr.read_r(W+'miscproj1dt.rda')['miscproj1dt']
popp = pyreadr.read_r(W+'popproj1dt.rda')['popproj1dt']
e0 = pyreadr.read_r(W+'e0proj1dt.rda')['e0proj1dt']
srb = pyreadr.read_r(W+'sexRatio1dt.rda')['sexRatio1dt']
tfr = pyreadr.read_r(W+'tfrproj1dt.rda')['tfrproj1dt']
mx = pd.read_csv(W+'mx2026.csv')
pa = pd.read_csv(W+'popage2026.csv')
for df in (misc, popp, e0, srb, tfr):
    df['year'] = df['year'].astype(int)
Y = 2026
misc = misc[misc.year==Y].set_index('country_code')
popp = popp[popp.year==Y].set_index('country_code')
e0 = e0[e0.year==Y].set_index('country_code')
srb = srb[srb.year==Y].set_index('country_code')
tfr = tfr[tfr.year==Y].set_index('country_code')

CONT = {903:'아프리카', 935:'아시아', 908:'유럽', 904:'중남미', 905:'북미', 909:'오세아니아'}
SUB = {910:'동아프리카',911:'중앙아프리카',912:'북아프리카',913:'남부 아프리카',914:'서아프리카',
       5500:'중앙아시아',906:'동아시아',5501:'남아시아',920:'동남아시아',922:'서아시아',
       923:'동유럽',924:'북유럽',925:'남유럽',926:'서유럽',
       915:'카리브',916:'중앙아메리카',931:'남아메리카',905:'북아메리카',
       927:'오스트레일리아·뉴질랜드',928:'멜라네시아',954:'미크로네시아',957:'폴리네시아'}
cont_order = list(CONT.keys())
sub_order = list(SUB.keys())

# walk hierarchy (rows from Africa onward)
locs = []
cur_c = cur_s = None
started = False
for r in countries.itertuples():
    code = int(r.country_code)
    if code == 903: started = True
    if not started: continue
    if code in CONT: cur_c = code
    if code in SUB: cur_s = code
    if code < 900 and code not in (5500, 5501):
        locs.append((code, r.name, cur_c, cur_s))
print('locations', len(locs))

def life_table(m, sex):
    m = np.asarray(m, dtype=float)
    m0 = m[0]
    if sex == 'M':
        a0 = 0.14929 - 1.99545*m0 if m0 < 0.0230 else (0.02832 + 3.26201*m0 if m0 < 0.08307 else 0.29915)
    else:
        a0 = 0.14903 - 2.05527*m0 if m0 < 0.01724 else (0.04667 + 3.88089*m0 if m0 < 0.06891 else 0.31411)
    ax = np.full(100, 0.5); ax[0] = a0
    lx = np.zeros(101); lx[0] = 1.0
    Lx = np.zeros(101)
    for x in range(100):
        q = min(1.0, m[x] / (1 + (1 - ax[x]) * m[x]))
        d = lx[x] * q
        lx[x+1] = lx[x] - d
        Lx[x] = lx[x+1] + ax[x] * d
    Lx[100] = lx[100] / m[100] if m[100] > 0 else 0.0
    Tx = np.cumsum(Lx[::-1])[::-1]
    ex = np.where(lx > 0, Tx / np.maximum(lx, 1e-300), 0)
    return lx, ex

EX_AGES = [0, 1] + list(range(5, 101, 5))
mxg = {k: g.sort_values('age') for k, g in mx.groupby('country_code')}
pag = {k: g.sort_values('age') for k, g in pa.groupby('country_code')}

def median_age(tot):
    tot = np.asarray(tot); half = tot.sum() / 2; cum = 0.0
    for a, v in enumerate(tot):
        if cum + v >= half:
            return a + (half - cum) / v if v > 0 else a
        cum += v
    return 100.0

def b36(n, w):
    s = np.base_repr(int(n), 36).lower()
    assert len(s) <= w, (n, w)
    return s.rjust(w, '0')

def build(code):
    g = mxg[code]
    lxM, exM = life_table(g['mxM'].values, 'M')
    lxF, exF = life_table(g['mxF'].values, 'F')
    p = pag[code]
    pM = p['popM'].values; pF = p['popF'].values
    rec = dict(
        births = misc.loc[code, 'births'] * 1000,
        deaths = misc.loc[code, 'deaths'] * 1000,
        growth = misc.loc[code, 'growthrate'],
        pop = (popp.loc[code, 'popM'] + popp.loc[code, 'popF']) * 1000,
        srb = srb.loc[code, 'srb'],
        e0M = e0.loc[code, 'e0M'], e0F = e0.loc[code, 'e0F'], e0B = e0.loc[code, 'e0B'],
        tfr = tfr.loc[code, 'tfr'],
        q0M = 1 - lxM[1], q0F = 1 - lxF[1], q5M = 1 - lxM[5], q5F = 1 - lxF[5],
        l65M = lxM[65], l65F = lxF[65],
        e0M_lt = exM[0], e0F_lt = exF[0],
        exM = [exM[a] for a in EX_AGES], exF = [exF[a] for a in EX_AGES],
        med = median_age(pM + pF),
        pM = pM, pF = pF,
        pop_age_sum = (pM.sum() + pF.sum()) * 1000,
    )
    return rec

world = build(900)
print('WORLD births %.0f pop %.0f e0 %.2f/%.2f (lt %.2f/%.2f) tfr %.3f q0 %.4f/%.4f q5 %.4f/%.4f l65 %.3f/%.3f med %.2f srb %.3f' % (
    world['births'], world['pop'], world['e0M'], world['e0F'], world['e0M_lt'], world['e0F_lt'], world['tfr'],
    world['q0M'], world['q0F'], world['q5M'], world['q5F'], world['l65M'], world['l65F'], world['med'], world['srb']))

recs = {}
maxdiff = []
skipped = []
for code, name, c, s in locs:
    if code not in mxg or code not in pag:
        skipped.append((code, name)); continue
    r = build(code)
    r.update(code=code, name_en=name, cont=c, sub=s)
    recs[code] = r
    maxdiff.append((abs(r['e0M_lt'] - r['e0M']) + abs(r['e0F_lt'] - r['e0F']), code, name, r['e0M'], r['e0M_lt'], r['e0F'], r['e0F_lt']))
maxdiff.sort(reverse=True)
print('e0 life-table check (largest abs diffs):')
for d in maxdiff[:6]: print('   %.3f %s %s WPP M %.2f LT %.2f | WPP F %.2f LT %.2f' % d)
import statistics
print('median abs diff sum', statistics.median([d[0] for d in maxdiff]))

print('skipped (no data):', skipped)
sb = sum(r['births'] for r in recs.values()); sp = sum(r['pop'] for r in recs.values())
print('sum births %.0f vs world %.0f (%.5f%%)' % (sb, world['births'], 100*sb/world['births']))
print('sum pop %.0f vs world %.0f (%.5f%%)' % (sp, world['pop'], 100*sp/world['pop']))
pickle_out = {'world': world, 'recs': recs, 'EX_AGES': EX_AGES}
import pickle; pickle.dump(pickle_out, open('wpp_2026.pkl', 'wb'))
