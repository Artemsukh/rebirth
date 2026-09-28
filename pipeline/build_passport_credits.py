#!/usr/bin/env python3
"""Build the attribution page from the reviewed passport source manifest."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sources = json.loads((ROOT / 'data/passport-sources.json').read_text())
missing = json.loads((ROOT / 'data/passports-missing.json').read_text())
covers = json.loads((ROOT / 'data/passports.json').read_text())
data = json.loads((ROOT / 'data/appdata.json').read_text())
en = {r[data['LOC_FIELDS'].index('code')]: r[data['LOC_FIELDS'].index('en')] for r in data['LOC']}
# Territories that show their sovereign state's cover (pipeline/apply_passport_reuse.js). Passports
# issued in these five carry the island's or territory's name on the cover as well, so the sovereign
# state's cover only approximates theirs: Aruba, Curaçao, Sint Maarten, British Virgin Islands and
# Falkland Islands.
reused = sorted(((int(c), a) for c, a in covers.items() if a.get('reuse') is not None), key=lambda x: en[x[0]])
APPROXIMATE = {533, 531, 534, 92, 238}
esc = html.escape
items = []
for a in sorted(sources, key=lambda a: a['country']):
    items.append(f'''<article id="p{a['code']}">
<img src="{esc(a['file'])}" width="100" height="142" loading="lazy" alt="{esc(a['country'])} passport cover">
<div><h2>{esc(a['country'])}</h2><p>{esc(a['title'])}</p>
<p>Creator: {esc(a['author'])}</p>
<p><a href="{esc(a['source'])}">Original description and attribution</a> · <a href="{esc(a['licenseUrl'])}">{esc(a['license'])}</a></p>
<p>{esc(a['changes'])} Retrieved {esc(a['retrieved'])}.</p></div></article>''')
for code, a in reused:
    home = en[a['reuse']]
    approx = ('\n<p>Passports issued here carry additional territory wording on the cover; '
              "the sovereign state's cover is shown as an approximation.</p>") if code in APPROXIMATE else ''
    items.append(f'''<article id="p{code}">
<img src="{esc(a['file'])}" width="100" height="142" loading="lazy" alt="{esc(home)} passport cover">
<div><h2>{esc(en[code])}</h2><p>Uses the ordinary passport cover of <a href="#p{a['reuse']}">{esc(home)}</a>.</p>{approx}</div></article>''')
for a in missing:
    items.append(f'<article id="p{a["code"]}"><div><h2>{esc(a["country"])}</h2><p>No passport cover is bundled. The result card uses the flag.</p></div></article>')
page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Image credits | Birth Lottery</title><style>
body{max-width:960px;margin:40px auto;padding:0 20px;background:#050716;color:#eaf2ff;font:16px/1.6 system-ui,sans-serif}a{color:#72a4f9}h1{font-size:32px}h2{font-size:20px;margin:0}article{display:flex;gap:24px;border-top:1px solid #34445c;padding:24px 0;scroll-margin-top:20px}article img{object-fit:contain;flex:none}p{margin:6px 0;overflow-wrap:anywhere}article:target{background:#12213a}@media(max-width:480px){article{gap:14px}article img{width:70px;height:100px}}
</style><a href="./">← Birth Lottery</a><h1>Image credits</h1>
<p>여권 이미지 출처 · Passport image sources · パスポート画像の出典 · Fuentes de las imágenes · Источники изображений</p>
<p>These are representative ordinary passport covers, not a guarantee of the latest edition or of citizenship. ''' + str(len(reused)) + ''' territories share the ordinary passport cover of their sovereign state, as listed explicitly in <code>data/passport-reuse.json</code>; no passport is inferred from the birthplace alone. Unavailable covers fall back to flags.</p>
<p>Source pages supply the authorship and licensing statements below. Cover images were proportionally resized and converted to WebP, without changing the artwork. Please retain the individual credits and license links when reusing them.</p>
<p>Birth Lottery card layout and original artwork: <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Individual passport images retain their stated licenses. The attribution link printed on each saved card points to its entry below.</p>
<p>Flags: <a href="https://github.com/lipis/flag-icons">flag-icons</a>, by lipis and contributors, <a href="vendor/flag-icons.LICENSE">MIT license</a>. Statistical data: UN WPP 2024 (2026 projections), IMF WEO and indicated World Bank/UN fallbacks; see the <a href="./#method">methodology</a>.</p>
''' + '\n'.join(items) + '</html>\n'
(ROOT / 'passport-credits.html').write_text(page, encoding='utf-8')
print(f'Wrote credits for {len(sources)} covers, {len(reused)} shared covers and {len(missing)} fallbacks')
