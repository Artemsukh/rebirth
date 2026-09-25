#!/usr/bin/env python3
"""Phase 9: place names for the language switcher (English, 日本語, Español, 한국어, Русский).

- fills the ja, es and ru columns of data/appdata.json LOC with CLDR region names (the ICU data
  bundled with Node, looked up by the iso2 column), plus the overrides below where CLDR gives
  a long official form, an abbreviation (Russian "о-ва") or a name that differs from the one the
  UN data uses
- writes NAMES: continent (CONT) and subregion (SUB) names in en, ja, es and ru, in the same
  order as the Korean CONT and SUB lists

Korean and English country names stay in the ko and en columns. Needs: node (18+).
Run again after adding a place; it prints any place CLDR has no name for.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, '..', 'data', 'appdata.json')

# CLDR names that are replaced: special administrative regions without the long form, the two
# Congos told apart the way the ko column does, Myanmar and Palestine as the UN data names them,
# the name Spanish speakers use for Côte d'Ivoire, and in Russian the islands written out in full
# ("о-ва" is CLDR's abbreviation) and the everyday names США, ЮАР and the two Koreas
OVERRIDE = {
    'ja': {344: '香港', 446: 'マカオ', 178: 'コンゴ共和国', 180: 'コンゴ民主共和国', 104: 'ミャンマー', 275: 'パレスチナ'},
    'es': {344: 'Hong Kong', 446: 'Macao', 178: 'República del Congo', 104: 'Myanmar', 275: 'Palestina',
           384: 'Costa de Marfil'},
    'ru': {344: 'Гонконг', 446: 'Макао', 178: 'Республика Конго', 180: 'ДР Конго', 104: 'Мьянма', 275: 'Палестина',
           840: 'США', 710: 'ЮАР', 410: 'Южная Корея', 408: 'Северная Корея', 535: 'Карибские Нидерланды',
           690: 'Сейшельские Острова', 654: 'Остров Святой Елены', 234: 'Фарерские острова', 833: 'Остров Мэн',
           92: 'Британские Виргинские острова', 136: 'Каймановы острова', 850: 'Американские Виргинские острова',
           238: 'Фолклендские острова', 60: 'Бермудские острова', 90: 'Соломоновы Острова',
           584: 'Маршалловы Острова', 580: 'Северные Марианские острова', 184: 'Острова Кука'},
}

# same order as CONT: 아프리카, 아시아, 유럽, 중남미, 북미, 오세아니아
CONT = {
    'en': ['Africa', 'Asia', 'Europe', 'Latin America', 'North America', 'Oceania'],
    'ja': ['アフリカ', 'アジア', 'ヨーロッパ', '中南米', '北米', 'オセアニア'],
    'es': ['África', 'Asia', 'Europa', 'América Latina', 'América del Norte', 'Oceanía'],
    'ru': ['Африка', 'Азия', 'Европа', 'Латинская Америка', 'Северная Америка', 'Океания'],
}
# same order as SUB (UN M49 subregions)
SUB = {
    'en': ['Eastern Africa', 'Middle Africa', 'Northern Africa', 'Southern Africa', 'Western Africa',
           'Central Asia', 'Eastern Asia', 'Southern Asia', 'South-eastern Asia', 'Western Asia',
           'Eastern Europe', 'Northern Europe', 'Southern Europe', 'Western Europe',
           'Caribbean', 'Central America', 'South America', 'Northern America',
           'Australia and New Zealand', 'Melanesia', 'Micronesia', 'Polynesia'],
    'ja': ['東アフリカ', '中部アフリカ', '北アフリカ', '南部アフリカ', '西アフリカ',
           '中央アジア', '東アジア', '南アジア', '東南アジア', '西アジア',
           '東ヨーロッパ', '北ヨーロッパ', '南ヨーロッパ', '西ヨーロッパ',
           'カリブ', '中央アメリカ', '南アメリカ', '北アメリカ',
           'オーストラリア・ニュージーランド', 'メラネシア', 'ミクロネシア', 'ポリネシア'],
    'es': ['África Oriental', 'África Central', 'África del Norte', 'África Austral', 'África Occidental',
           'Asia Central', 'Asia Oriental', 'Asia Meridional', 'Sudeste Asiático', 'Asia Occidental',
           'Europa Oriental', 'Europa del Norte', 'Europa Meridional', 'Europa Occidental',
           'Caribe', 'Centroamérica', 'Sudamérica', 'América del Norte',
           'Australia y Nueva Zelanda', 'Melanesia', 'Micronesia', 'Polinesia'],
    'ru': ['Восточная Африка', 'Центральная Африка', 'Северная Африка', 'Южная Африка', 'Западная Африка',
           'Центральная Азия', 'Восточная Азия', 'Южная Азия', 'Юго-Восточная Азия', 'Западная Азия',
           'Восточная Европа', 'Северная Европа', 'Южная Европа', 'Западная Европа',
           'Карибский бассейн', 'Центральная Америка', 'Южная Америка', 'Северная Америка',
           'Австралия и Новая Зеландия', 'Меланезия', 'Микронезия', 'Полинезия'],
}

JS = '''
const codes = JSON.parse(process.argv[1]), out = {};
for (const l of ['ja', 'es', 'ru']) {
  const dn = new Intl.DisplayNames([l], { type: 'region', fallback: 'none' });
  out[l] = codes.map(c => dn.of(c) || null);
}
out.cldr = process.versions.cldr;
console.log(JSON.stringify(out));
'''


def main():
    with open(PATH, encoding='utf-8') as f:
        d = json.load(f)
    fields = d['LOC_FIELDS']
    for k in ('ja', 'es', 'ru'):
        if k not in fields:
            fields.append(k)
            for r in d['LOC']:
                r.append(None)
    ix = {k: fields.index(k) for k in fields}
    iso = [r[ix['iso2']] for r in d['LOC']]
    res = subprocess.run(['node', '-e', JS, json.dumps(iso)], capture_output=True, text=True, check=True)
    cldr = json.loads(res.stdout)
    missing = []
    for lang in ('ja', 'es', 'ru'):
        for r, name in zip(d['LOC'], cldr[lang]):
            name = OVERRIDE[lang].get(r[ix['code']], name)
            if not name or name == r[ix['iso2']]:
                missing.append((lang, r[ix['code']], r[ix['en']]))
            r[ix[lang]] = name
    if missing:
        sys.exit('no CLDR name for: ' + ', '.join('%s %d %s' % m for m in missing))

    for lang in CONT:
        assert len(CONT[lang]) == len(d['CONT']) and len(SUB[lang]) == len(d['SUB']), lang
    d['NAMES'] = {lang: {'CONT': CONT[lang], 'SUB': SUB[lang]} for lang in ('en', 'ja', 'es', 'ru')}

    for lang in ('ja', 'es', 'ru'):
        seen = {}
        for r in d['LOC']:
            seen.setdefault(r[ix[lang]], []).append(r[ix['code']])
        dup = {n: c for n, c in seen.items() if len(c) > 1}
        if dup:
            sys.exit('duplicate %s names: %s' % (lang, dup))

    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print('names for %d places in ja, es and ru (CLDR %s), %d overrides' %
          (len(d['LOC']), cldr['cldr'], sum(len(v) for v in OVERRIDE.values())))


if __name__ == '__main__':
    main()
