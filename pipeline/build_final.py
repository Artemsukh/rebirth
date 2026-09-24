import json, re, pickle, math
import numpy as np, pandas as pd, pyreadr

W = 'wpp/'
countries = pyreadr.read_r(W+'countries.rda')['countries'].sort_values('country_order')
def load(f):
    d = list(pyreadr.read_r(W+f+'.rda').values())[0]
    d['year'] = d['year'].astype(int); return d
misc, popp, e0, srb, tfr = load('miscproj1dt'), load('popproj1dt'), load('e0proj1dt'), load('sexRatio1dt'), load('tfrproj1dt')
mx = pd.read_csv(W+'mx2026.csv')
pa_all = list(pyreadr.read_r(W+'popprojAge1dt.rda').values())[0]
pa_all['year'] = pa_all['year'].astype(int)
pa25 = pa_all[pa_all.year==2025]; pa26 = pa_all[pa_all.year==2026]

Y = 2026
misc26 = misc[misc.year==Y].set_index('country_code')
pop25 = popp[popp.year==2025].set_index('country_code'); pop26 = popp[popp.year==2026].set_index('country_code')
e026 = e0[e0.year==Y].set_index('country_code'); srb26 = srb[srb.year==Y].set_index('country_code'); tfr26 = tfr[tfr.year==Y].set_index('country_code')

CONT = {903:'아프리카', 935:'아시아', 908:'유럽', 904:'중남미', 905:'북미', 909:'오세아니아'}
SUB = {910:'동아프리카',911:'중앙아프리카',912:'북아프리카',913:'남부 아프리카',914:'서아프리카',
       5500:'중앙아시아',906:'동아시아',5501:'남아시아',920:'동남아시아',922:'서아시아',
       923:'동유럽',924:'북유럽',925:'남유럽',926:'서유럽',
       915:'카리브',916:'중앙아메리카',931:'남아메리카',905:'북아메리카',
       927:'오스트레일리아·뉴질랜드',928:'멜라네시아',954:'미크로네시아',957:'폴리네시아'}
cont_keys = list(CONT.keys()); sub_keys = list(SUB.keys())

locs = []; cur_c = cur_s = None; started = False
for r in countries.itertuples():
    code = int(r.country_code)
    if code == 903: started = True
    if not started: continue
    if code in CONT: cur_c = code
    if code in SUB: cur_s = code
    if code < 900: locs.append((code, r.name, cur_c, cur_s))

def life_table(m, sex):
    m = np.asarray(m, float); m0 = m[0]
    if sex == 'M': a0 = 0.14929-1.99545*m0 if m0 < 0.0230 else (0.02832+3.26201*m0 if m0 < 0.08307 else 0.29915)
    else:          a0 = 0.14903-2.05527*m0 if m0 < 0.01724 else (0.04667+3.88089*m0 if m0 < 0.06891 else 0.31411)
    ax = np.full(100, 0.5); ax[0] = a0
    lx = np.zeros(101); lx[0] = 1; Lx = np.zeros(101)
    for x in range(100):
        q = min(1.0, m[x]/(1+(1-ax[x])*m[x])); d = lx[x]*q
        lx[x+1] = lx[x]-d; Lx[x] = lx[x+1]+ax[x]*d
    Lx[100] = lx[100]/m[100] if m[100] > 0 else 0
    Tx = np.cumsum(Lx[::-1])[::-1]; ex = Tx/np.maximum(lx, 1e-300)
    return lx, ex

EX_AGES = [0, 1] + list(range(5, 101, 5))
mxg = {k: g.sort_values('age') for k, g in mx.groupby('country_code')}
p25g = {k: g.sort_values('age') for k, g in pa25.groupby('country_code')}
p26g = {k: g.sort_values('age') for k, g in pa26.groupby('country_code')}

def un_median(tot):
    # UN WPP convention: interpolate the cumulative share against single-age labels
    tot = np.asarray(tot, float); cum = np.cumsum(tot)/tot.sum()
    return float(np.interp(0.5, cum, np.arange(len(tot))))

def build(code):
    g = mxg[code]
    lxM, exM = life_table(g['mxM'].values, 'M'); lxF, exF = life_table(g['mxF'].values, 'F')
    pM = (p25g[code]['popM'].values + p26g[code]['popM'].values)/2
    pF = (p25g[code]['popF'].values + p26g[code]['popF'].values)/2
    popmid = ((pop25.loc[code,'popM']+pop25.loc[code,'popF']) + (pop26.loc[code,'popM']+pop26.loc[code,'popF']))/2*1000
    return dict(births=misc26.loc[code,'births']*1000, pop=popmid, srb=srb26.loc[code,'srb'],
        e0M=e026.loc[code,'e0M'], e0F=e026.loc[code,'e0F'], e0B=e026.loc[code,'e0B'], tfr=tfr26.loc[code,'tfr'],
        q0M=(1-lxM[1])*1000, q0F=(1-lxF[1])*1000, q5M=(1-lxM[5])*1000, q5F=(1-lxF[5])*1000,
        l65M=lxM[65], l65F=lxF[65], exM=[exM[a] for a in EX_AGES], exF=[exF[a] for a in EX_AGES],
        med=un_median(pM+pF), pM=pM, pF=pF, growth=misc26.loc[code,'growthrate'],
        deaths=misc26.loc[code,'deaths']*1000, agesum=(pM.sum()+pF.sum())*1000)

world = build(900)
print('WORLD mid-2026 pop %.0f births %.0f deaths %.0f median %.2f e0 %.2f/%.2f/%.2f tfr %.3f IMR %.1f/%.1f U5 %.1f/%.1f l65 %.3f/%.3f' % (
    world['pop'], world['births'], world['deaths'], world['med'], world['e0M'], world['e0F'], world['e0B'], world['tfr'],
    world['q0M'], world['q0F'], world['q5M'], world['q5F'], world['l65M'], world['l65F']))

# names
html = open('orig/index_main.html', encoding='utf-8').read()
arr = re.search(r'const data = \[(.*?)\]\.map', html, re.S).group(1)
ko = {int(m[0]): m[1] for m in re.findall(r'\["(\d+)","([^"]+)",([\d.]+),([\d.]+)\]', arr)}
ko[412] = ko.pop(383)          # UN code for Kosovo is 412
ko[583] = '미크로네시아 연방'
ko.update({175:'마요트',638:'레위니옹',132:'카보베르데',654:'세인트헬레나',344:'홍콩',446:'마카오',51:'아르메니아',
    234:'페로 제도',831:'건지',833:'맨섬',832:'저지',292:'지브롤터',336:'바티칸',660:'앵귈라',533:'아루바',
    535:'카리브 네덜란드',92:'영국령 버진아일랜드',136:'케이맨 제도',531:'퀴라소',312:'과들루프',474:'마르티니크',
    500:'몬트세랫',630:'푸에르토리코',652:'생바르텔레미',663:'생마르탱',534:'신트마르턴',796:'터크스 케이커스 제도',
    850:'미국령 버진아일랜드',238:'포클랜드 제도',254:'프랑스령 기아나',60:'버뮤다',304:'그린란드',666:'생피에르 미클롱',
    540:'뉴칼레도니아',316:'괌',580:'북마리아나 제도',16:'아메리칸사모아',184:'쿡 제도',258:'프랑스령 폴리네시아',
    570:'니우에',772:'토켈라우',876:'왈리스 퓌튀나'})
EN_SHORT = {344:'Hong Kong',446:'Macao',158:'Taiwan',408:'North Korea',410:'South Korea',364:'Iran',68:'Bolivia',862:'Venezuela',
    418:'Laos',643:'Russia',704:'Viet Nam',760:'Syria',834:'Tanzania',498:'Moldova',412:'Kosovo',840:'United States',
    583:'Micronesia',238:'Falkland Islands',876:'Wallis and Futuna',535:'Bonaire, Sint Eustatius and Saba',
    663:'Saint Martin (French part)',534:'Sint Maarten (Dutch part)',96:'Brunei',180:'DR Congo',178:'Congo',
    275:'Palestine',792:'Türkiye',384:"Côte d'Ivoire",531:'Curaçao',652:'Saint Barthélemy',638:'Réunion'}
wc = json.load(open('npmdata/world-countries-5.1.0/package/countries.json'))
latlng = {int(x['ccn3']): x['latlng'] for x in wc if x['ccn3']}
latlng[412] = [42.6, 20.9]

gdp = pickle.load(open('gdp.pkl','rb'))

out = []; ages = {}
skipped = []
for code, name, c, s in locs:
    if code not in mxg:
        skipped.append((code, name)); continue
    r = build(code)
    ll = latlng[code]
    g = gdp.get(code)
    out.append([code, ko[code], EN_SHORT.get(code, name), cont_keys.index(c), sub_keys.index(s),
        round(ll[0], 2), round(ll[1], 2), int(round(r['births'])), int(round(r['pop'])),
        round(float(r['srb']), 3), round(float(r['e0M']), 2), round(float(r['e0F']), 2), round(float(r['tfr']), 3),
        round(r['q0M'], 2), round(r['q0F'], 2), round(r['q5M'], 2), round(r['q5F'], 2),
        round(float(r['l65M']), 4), round(float(r['l65F']), 4), round(r['med'], 1),
        g[0] if g else None, g[1] if g else '', round(float(r['e0B']), 2)])
    # remaining life expectancy table (x10, base36, 2 chars)
    def enc_ex(arr): return ''.join(np.base_repr(int(round(v*10)), 36).lower().rjust(2, '0') for v in arr)
    mxv = max(r['pM'].max(), r['pF'].max())
    def enc_age(arr): return ''.join(np.base_repr(int(round(v/mxv*46655)), 36).lower().rjust(3, '0') for v in arr)
    ages[code] = [round(mxv*1000, 1), enc_ex(r['exM']), enc_ex(r['exF']), enc_age(r['pM']), enc_age(r['pF'])]

print('skipped', skipped, 'count', len(out))
tb = sum(o[7] for o in out); tp = sum(o[8] for o in out)
print('total births', tb, 'total pop', tp, 'coverage births %.6f pop %.6f' % (tb/world['births'], tp/world['pop']))

# world reference (pop-weighted GDP avg over covered)
gw = [(o[20], o[8]) for o in out if o[20]]
world_gdp = sum(a*b for a, b in gw)/sum(b for a, b in gw)
W_REF = dict(births=int(round(world['births'])), pop=int(round(world['pop'])), deaths=int(round(world['deaths'])),
    srb=round(float(world['srb']),3), e0M=round(float(world['e0M']),2), e0F=round(float(world['e0F']),2), e0B=round(float(world['e0B']),2),
    tfr=round(float(world['tfr']),3), q0M=round(world['q0M'],2), q0F=round(world['q0F'],2), q5M=round(world['q5M'],2), q5F=round(world['q5F'],2),
    l65M=round(float(world['l65M']),4), l65F=round(float(world['l65F']),4), med=round(world['med'],1), gdp=int(round(world_gdp)),
    exM=[round(float(v),2) for v in world['exM']], exF=[round(float(v),2) for v in world['exF']])
print('world ref', W_REF)
json.dump({'CONT': list(CONT.values()), 'SUB': list(SUB.values()), 'EX_AGES': EX_AGES, 'WORLD': W_REF, 'LOC': out, 'AGE': ages},
          open('appdata.json','w'), ensure_ascii=False, separators=(',', ':'))
import os; print('appdata.json bytes', os.path.getsize('appdata.json'))
