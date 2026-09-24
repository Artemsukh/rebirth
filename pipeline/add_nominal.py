import json, pickle
ppp = pickle.load(open('/home/claude/gdp.pkl','rb'))
lines=[l.rstrip('\n').split('|') for l in open('/home/claude/gdp_imf_2025.txt',encoding='utf-8') if l.strip()]
name2code={}
for n,v,note in lines:
    cs=[c for c,(vv,nn) in ppp.items() if vv==int(v) and nn==note]
    assert len(cs)==1; name2code[n]=cs[0]
name2code.update({'Monaco':492,'Isle of Man':833,'Guam':316,'British Virgin Islands':92,'New Caledonia':540,'Anguilla':660,
  'Cook Islands':184,'Northern Mariana Islands':580,'French Polynesia':258,'Cuba':192,'Montserrat':500,'American Samoa':16,
  'North Korea':408,'Saint Martin':663})
nom={}
for n,v,note in [l.rstrip('\n').split('|') for l in open('/home/claude/gdp_nominal_2025.txt',encoding='utf-8') if l.strip()]:
    c=name2code[n]; assert c not in nom; nom[c]=(int(v), note)
d=json.load(open('/home/claude/appdata_ppp_only.json',encoding='utf-8'))
codes={r[0] for r in d['LOC']}
assert set(nom) <= codes, set(nom)-codes
assert set(ppp) <= set(nom), set(ppp)-set(nom)
num=den=0
for r in d['LOC']:
    assert len(r)==23
    v=nom.get(r[0]); r.append(v[0] if v else None); r.append(v[1] if v else '')
    if v: num+=v[0]*r[8]; den+=r[8]
d['WORLD']['gdpN']=int(round(num/den))
d['WORLD']['gdpNcov']=round(den/sum(r[8] for r in d['LOC']),5)
json.dump(d, open('/home/claude/appdata.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
kor=[r for r in d['LOC'] if r[0]==410][0]
print('nominal covered', len(nom), 'missing', [ (r[0], r[2]) for r in d['LOC'] if r[23] is None])
print('world nominal', d['WORLD']['gdpN'], 'cov', d['WORLD']['gdpNcov'], 'world ppp', d['WORLD']['gdp'])
print('korea', kor[20], kor[21], kor[23], kor[24])
