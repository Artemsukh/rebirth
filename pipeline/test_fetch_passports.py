#!/usr/bin/env python3
"""Offline test for fetch_passports.py: python3 pipeline/test_fetch_passports.py

Runs against a temp checkout with a small appdata.json; the HTTP layer (fetch_passports.fetch_raw)
is replaced by fixtures for wbgetentities, SPARQL, Commons categoryinfo / categorymembers /
imageinfo and image downloads. Writing the real data/appdata.json makes the test fail.
"""
import builtins, hashlib, html, io, json, os, re, shutil, sys, tempfile, time, unittest
from urllib.parse import quote, urlsplit

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fetch_passports as fp                                   # noqa: E402
from PIL import Image, ImageCms, ImageDraw                     # noqa: E402

REAL_DATA = os.path.realpath(os.path.join(HERE, '..', 'data', 'appdata.json'))
FIELDS = ('code ko en cont sub lat lng births pop srb e0M e0F tfr med gdp gdpNote '
          'e0B gdpN gdpNNote iso2 sov').split()


# ---------------------------------------------------------------- guard the real appdata.json

_open, _replace = builtins.open, os.replace


def _is_real(p):
    return isinstance(p, (str, os.PathLike)) and os.path.realpath(p).startswith(REAL_DATA)


def guarded_open(file, mode='r', *a, **k):
    if _is_real(file) and any(m in mode for m in 'wax+'):
        raise AssertionError('test tried to write the real %s' % file)
    return _open(file, mode, *a, **k)


def guarded_replace(src, dst, *a, **k):
    if _is_real(dst):
        raise AssertionError('test tried to replace the real %s' % dst)
    return _replace(src, dst, *a, **k)


# ---------------------------------------------------------------- fixtures

def row(code, ko, en, iso2, sov=None):
    o = dict.fromkeys(FIELDS, 0)
    o.update(code=code, ko=ko, en=en, gdpNote='', gdpNNote='', iso2=iso2, sov=sov)
    return [o[k] for k in FIELDS]


APPDATA = {
    'CONT': ['유럽'], 'SUB': ['서유럽'], 'WORLD': {'births': 1, 'e0B': 73.5},
    'LOC_FIELDS': FIELDS,
    'LOC': [row(250, '프랑스', 'France', 'FR'), row(638, '레위니옹', 'Réunion', 'RE', 250),
            row(208, '덴마크', 'Denmark', 'DK'), row(234, '페로 제도', 'Faroe Islands', 'FO', 208),
            row(304, '그린란드', 'Greenland', 'GL', 208), row(826, '영국', 'United Kingdom', 'GB'),
            row(832, '저지섬', 'Jersey', 'JE', 826), row(276, '독일', 'Germany', 'DE'),
            row(410, '대한민국', 'South Korea', 'KR'), row(124, '캐나다', 'Canada', 'CA'),
            row(4, '아프가니스탄', 'Afghanistan', None),          # iso2 not filled yet: joins by M49 '004'
            row(554, '뉴질랜드', 'New Zealand', 'NZ'), row(184, '쿡 제도', 'Cook Islands', 'CK', 554),
            row(412, '코소보', 'Kosovo', None), row(840, '미국', 'United States', 'US')],
    'CLASS': {'adv': [250, 208], 'ldc': {'4': None}},
}

LABELS = {'Q43812': 'passport', 'P17': 'country', 'P18': 'image', 'P31': 'instance of',
          'P279': 'subclass of', 'P297': 'ISO 3166-1 alpha-2 code', 'P2082': 'United Nations M49 code',
          'P571': 'inception', 'P580': 'start time', 'P582': 'end time',
          'P1001': 'applies to jurisdiction', 'P373': 'Commons category'}

# (qid, iso2, m49, label, Commons category)
COUNTRIES = [('Q142', 'FR', '250', 'France', 'France'), ('Q17070', 'RE', '638', 'Réunion', 'Réunion'),
             ('Q35', 'DK', '208', 'Denmark', 'Denmark'), ('Q4628', 'FO', '234', 'Faroe Islands', 'Faroe Islands'),
             ('Q223', 'GL', '304', 'Greenland', 'Greenland'), ('Q145', 'GB', '826', 'United Kingdom', 'United Kingdom'),
             ('Q785', 'JE', '832', 'Jersey', 'Jersey'), ('Q183', 'DE', '276', 'Germany', 'Germany'),
             ('Q884', 'KR', '410', 'South Korea', 'South Korea'), ('Q16', 'CA', '124', 'Canada', 'Canada'),
             ('Q889', 'AF', '004', 'Afghanistan', 'Afghanistan'), ('Q664', 'NZ', '554', 'New Zealand', 'New Zealand'),
             ('Q26988', 'CK', '184', 'Cook Islands', 'Cook Islands'), ('Q30', 'US', '840', 'United States', 'United States'),
             ('Q15180', None, None, 'Soviet Union', None)]

GENID = 'http://www.wikidata.org/.well-known/genid/0123456789abcdef'     # WDQS "unknown value"

# passport items: qid, label, country, image, classes, extras
ITEMS = [
    ('Q9001', 'French passport', 'Q142', 'French passport cover.jpg', ['passport', 'biometric passport'], {}),
    ('Q9002', 'French passport (1995 design)', 'Q142', 'French passport 1995.jpg', ['passport'],
     {'inception': '1995-01-01T00:00:00Z', 'end': '2006-04-12T00:00:00Z'}),
    ('Q9003', 'French diplomatic passport', 'Q142', 'French diplomatic passport.jpg', ['diplomatic passport'],
     {'inception': '2023-01-01T00:00:00Z'}),
    ('Q9004', 'Passeport de service', 'Q142', 'French service passport.jpg', ['service passport'], {}),
    ('Q9005', 'French passport', 'Q142', 'French passport unknown.jpg', ['passport'],     # unknown start and end
     {'inception': GENID, 'end': GENID}),
    # several P1001: the parent's passport that covers its territories, stays with Denmark
    ('Q9011', 'Danish passport', 'Q35', 'Danish passport.jpg', ['passport'], {'juris': ['Q35', 'Q223', 'Q4628']}),
    ('Q9012', 'Faroese passport', 'Q35', 'Faroese passport.jpg', ['passport'], {'juris': 'Q4628'}),
    ('Q9021', 'British passport', 'Q145', 'British passport.jpg', ['passport'], {}),
    ('Q9022', 'Jersey passport', 'Q145', 'Jersey passport.jpg', ['passport'], {}),   # no P1001: label hint
    ('Q9031', 'Canadian passport', 'Q16', 'Canadian passport.jpg', ['passport'], {}),
    ('Q9041', 'United States passport', 'Q30', 'US passport.jpg', ['passport'], {}),      # P18 is a redirect
    ('Q9051', 'New Zealand passport', 'Q664', 'New Zealand passport.jpg', ['passport'], {}),
    ('Q9061', 'Soviet passport', 'Q15180', 'Soviet passport.jpg', ['passport'], {}),
]

CATS = {
    'Category:Passports of Germany': (
        ['File:German passport data page.jpg', 'File:German passport cover 2017.jpg', 'File:German passport front.png',
         'File:Reisepass Deutschland.jpg', 'File:German passport back.jpg', 'File:German passport inside.jpg',
         'File:German passport visa page.jpg', 'File:German passport.pdf'],
        ['Category:Diplomatic passports of Germany']),
    'Category:Diplomatic passports of Germany': (['File:German diplomatic passport cover.jpg'], []),
    'Category:Passports of South Korea': (['File:South Korean passport cover.jpg'], []),
    'Category:Passports of the United Kingdom': (['File:UK passport cover.jpg'], []),
    'Category:Passports of Kosovo': (['File:Kosovo passport cover.jpg'], []),
    'Category:Passports of Canada': (['File:Canada passport cover old.jpg', 'File:Canada passport front.jpg',
                                      'File:Canada passport cover 2019.jpg'], []),
    'Category:Passports of the United States': (['File:US passport cover.jpg'], []),
}

REDIRECTS = {'File:US passport.jpg': 'File:US passport data page.jpg'}


def encode(im, fmt, **kw):
    b = io.BytesIO()
    im.save(b, fmt, **kw)
    return b.getvalue()


_n = [0]


def plain(w, h, fmt='JPEG'):
    _n[0] += 1                          # every file different, so every sha1 differs
    im = Image.new('RGB', (w, h), (40, 90, (_n[0] * 7) % 256))
    ImageDraw.Draw(im).rectangle((w // 4, h // 4, w // 2, h // 2), fill=(200, 180, 40))
    return encode(im, fmt)


def exif_bytes():
    ex = Image.Exif()
    ex[0x010F] = 'TestCam Inc'          # Make
    ex[0x0110] = 'Model X'              # Model
    ex[0x0131] = 'secret-software'      # Software
    ex[0x0112] = 1                      # Orientation
    return ex.tobytes()


def french_cover():
    # the thumb is half the size of the original on Commons (2000x3000); crop [100,150,800,1200] in
    # original pixels is (50,75)-(450,675) here and holds the red cover; outside is blue background
    im = Image.new('RGB', (1000, 1500), (20, 40, 200))
    ImageDraw.Draw(im).rectangle((50, 75, 449, 674), fill=(210, 20, 30))
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    return encode(im, 'JPEG', exif=exif_bytes(), icc_profile=icc, quality=95)


def files():
    rgba = Image.new('RGBA', (500, 700), (10, 20, 120, 255))
    ImageDraw.Draw(rgba).rectangle((0, 0, 60, 60), fill=(0, 0, 0, 0))
    noise = Image.frombytes('RGB', (900, 1600), os.urandom(900 * 1600 * 3))
    faroe = encode(Image.new('RGB', (600, 850), (90, 30, 30)), 'JPEG', exif=exif_bytes())
    f = lambda lic, w, h, img, **k: dict(lic=lic, w=w, h=h, img=img, **k)
    return {
        'File:French passport cover.jpg': f('CC BY-SA 4.0', 2000, 3000, french_cover(), restr='trademarked|insignia',
                                            lic_url='https://creativecommons.org/licenses/by-sa/4.0',
                                            artist='<a href="//commons.wikimedia.org/wiki/User:JD" '
                                                   'title="User:JD">Jean&nbsp;Dupont</a>'),
        'File:French passport 1995.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:French passport unknown.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:French diplomatic passport.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:French service passport.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:Danish passport.jpg': f('Public domain', 900, 1600, encode(noise, 'PNG')),
        'File:Faroese passport.jpg': f('CC BY 2.0', 600, 850, faroe, artist='Óli Hansen'),
        'File:Jersey passport.jpg': f('CC BY-SA 3.0', 300, 400, plain(300, 400)),
        'File:British passport.jpg': f(None, 300, 400, plain(300, 400)),
        'File:UK passport cover.jpg': f('Public domain', 500, 700, encode(rgba, 'PNG'), artist=''),   # Credit only
        'File:Canadian passport.jpg': f('Fair use', 300, 400, plain(300, 400), nonfree='true'),
        'File:New Zealand passport.jpg': f('CC BY-SA 4.0', 400, 600, plain(400, 600)),
        'File:South Korean passport cover.jpg': f('CC BY 1.0', 300, 400, plain(300, 400)),
        'File:German passport cover 2017.jpg': f('CC BY-SA 3.0 de', 300, 400, plain(300, 400)),
        'File:German passport front.png': f('CC0', 300, 400, plain(300, 400, 'PNG')),
        'File:Reisepass Deutschland.jpg': f('GFDL', 300, 400, plain(300, 400)),
        'File:German passport back.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:German passport inside.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:German passport data page.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:German passport visa page.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:Kosovo passport cover.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:Canada passport cover 2019.jpg': f('CC0', 300, 400, plain(300, 400)),
        'File:Canada passport front.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:Canada passport cover old.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:US passport data page.jpg': f('Public domain', 300, 400, plain(300, 400)),
        'File:US passport cover.jpg': f('CC0', 300, 400, plain(300, 400)),
    }


def thumb_of(title):
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/%s/1280px-%s' % (
        hashlib.md5(title.encode()).hexdigest()[:6], quote(title[5:].replace(' ', '_')))


class FakeWikimedia:
    """Stands in for fetch_raw: answers like the real APIs, records every request."""

    def __init__(self, labels=None, blocked=False):
        self.labels = dict(LABELS, **(labels or {}))
        self.blocked = blocked              # True: every host; or a set of hosts
        self.cut_sparql = False             # answer SPARQL with half a JSON body
        self.fail = set()                   # URLs answered with 503
        self.files = files()
        self.thumbs = {thumb_of(t): t for t in self.files}
        self.calls = []

    def __call__(self, url, params=None, headers=None, timeout=60):
        params = dict(params or {})
        self.calls.append((url, params, dict(headers or {})))
        host = urlsplit(url).hostname
        if self.blocked is True or (self.blocked and host in self.blocked):
            raise fp.NetworkError(host, 'proxy refused CONNECT (403 Forbidden)')
        if url in self.fail:
            return 503, {'Retry-After': '1'}, b'busy'
        if url == fp.WD_API and params.get('action') == 'wbgetentities':
            ents = {i: {'id': i, 'labels': {'en': {'language': 'en', 'value': self.labels[i]}}}
                    for i in params['ids'].split('|')}
            return self.ok({'entities': ents})
        if url == fp.SPARQL:
            q = params['query']
            status, h, body = self.ok({'results': {'bindings': self.countries() if 'P297' in q else self.passports()}})
            return status, h, body[:len(body) // 2] if self.cut_sparql else body
        if url == fp.COMMONS_API:
            titles = params.get('titles', '').split('|')
            if params.get('prop') == 'categoryinfo':
                return self.ok({'query': {'pages': [
                    {'ns': 14, 'title': t, 'categoryinfo': {'files': len(CATS[t][0]), 'subcats': len(CATS[t][1])}}
                    if t in CATS else {'ns': 14, 'title': t, 'missing': True} for t in titles]}})
            if params.get('list') == 'categorymembers':
                fs, subs = CATS.get(params['cmtitle'], ([], []))
                return self.ok({'query': {'categorymembers': [{'ns': 6, 'title': t} for t in fs] +
                                                             [{'ns': 14, 'title': t} for t in subs]}})
            if params.get('prop') == 'imageinfo':
                reds = [{'from': t, 'to': REDIRECTS[t]} for t in titles if t in REDIRECTS]
                pages = {REDIRECTS.get(t, t): self.imageinfo(REDIRECTS.get(t, t)) for t in titles}
                return self.ok({'query': {'redirects': reds, 'pages': list(pages.values())}})
        if host == 'upload.wikimedia.org' and url in self.thumbs:
            return 200, {}, self.files[self.thumbs[url]]['img']
        return 404, {}, b'not found'

    @staticmethod
    def ok(obj):
        return 200, {}, json.dumps(obj).encode()

    def countries(self):
        uri = lambda q: {'type': 'uri', 'value': 'http://www.wikidata.org/entity/' + q}
        lit = lambda v: {'type': 'literal', 'value': v}
        out = []
        for q, iso, m49, label, cat in COUNTRIES:
            base = {'country': uri(q), 'label': lit(label)}
            if cat:
                base['commonscat'] = lit(cat)
            if iso:
                out.append(dict(base, iso2=lit(iso)))
            if m49:
                out.append(dict(base, m49=lit(m49)))
        return out

    def passports(self):
        uri = lambda q: {'type': 'uri', 'value': 'http://www.wikidata.org/entity/' + q}
        lit = lambda v: {'type': 'literal', 'value': v}
        out = []
        for q, label, country, image, classes, extra in ITEMS:
            base = {'item': uri(q), 'itemLabel': lit(label), 'country': uri(country),
                    'image': {'type': 'uri', 'value': 'http://commons.wikimedia.org/wiki/Special:FilePath/'
                              + quote(image)}}
            for k in ('inception', 'end'):
                if k in extra:
                    base[k] = {'type': 'uri' if extra[k].startswith('http') else 'literal', 'value': extra[k]}
            juris = extra.get('juris', [])
            for j in ([juris] if isinstance(juris, str) else juris) or [None]:   # one row per value, like WDQS
                row = dict(base, juris=uri(j)) if j else base
                out += [dict(row, classLabel=lit(c)) for c in classes]
        return out

    def imageinfo(self, title):
        f = self.files.get(title)
        if not f:
            return {'ns': 6, 'title': title, 'missing': True}
        em = {'Artist': {'value': f.get('artist', 'Someone')}, 'Restrictions': {'value': f.get('restr', '')},
              'Credit': {'value': '<span class="int-own-work" lang="en">Own work</span>'}}
        if f['lic']:
            em['LicenseShortName'] = {'value': f['lic']}
            em['LicenseUrl'] = {'value': f.get('lic_url', '')}
        if f.get('nonfree'):
            em['NonFree'] = {'value': f['nonfree']}
        return {'ns': 6, 'title': title, 'imageinfo': [{
            'url': 'https://upload.wikimedia.org/wikipedia/commons/x/' + quote(title[5:]),
            'descriptionurl': 'https://commons.wikimedia.org/wiki/' + quote(title.replace(' ', '_'), safe=':'),
            'thumburl': thumb_of(title), 'width': f['w'], 'height': f['h'], 'mime': 'image/jpeg',
            'sha1': hashlib.sha1(f['img']).hexdigest(), 'extmetadata': em}]}

    def requested(self, kind):
        """Titles asked for in imageinfo requests, or URLs downloaded."""
        if kind == 'download':
            return [u for u, _, _ in self.calls if 'upload.wikimedia.org' in u]
        return [t for u, p, _ in self.calls if p.get('prop') == kind for t in p['titles'].split('|')]


def webp_chunks(b):
    assert b[:4] == b'RIFF' and b[8:12] == b'WEBP', b[:16]
    i, out = 12, []
    while i + 8 <= len(b):
        size = int.from_bytes(b[i + 4:i + 8], 'little')
        out.append(b[i:i + 4])
        i += 8 + size + (size & 1)
    return out


# ---------------------------------------------------------------- tests

class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='passports-test-')
        for d in ('data', 'pipeline', 'assets/passports'):
            os.makedirs(os.path.join(self.tmp, d))
        with open(os.path.join(self.tmp, 'data', 'appdata.json'), 'w', encoding='utf-8') as f:
            json.dump(APPDATA, f, ensure_ascii=False, separators=(',', ':'))
        for stale in ('999.webp', '276.webp'):
            with open(os.path.join(self.tmp, 'assets', 'passports', stale), 'wb') as f:
                f.write(b'old')
        fp.configure(self.tmp)
        self.assertTrue(fp.DATA.startswith(self.tmp) and os.path.realpath(fp.DATA) != REAL_DATA)
        fp.MIN_INTERVAL = 0
        fp.REFRESH = False
        self.fake = FakeWikimedia()
        self._fetch = fp.fetch_raw
        fp.fetch_raw = self.fake
        self._stdout = sys.stdout
        sys.stdout = io.StringIO()             # keep the script's progress lines out of the test output

    def tearDown(self):
        sys.stdout = self._stdout
        fp.fetch_raw = self._fetch
        fp.configure(os.path.join(HERE, '..'))
        shutil.rmtree(self.tmp)

    def data_bytes(self):
        with open(fp.DATA, 'rb') as f:
            return f.read()

    def state(self):
        with open(fp.STATE, encoding='utf-8') as f:
            return json.load(f)

    def report_text(self):
        with open(fp.REPORT, encoding='utf-8') as f:
            return f.read()


class LicenceRule(unittest.TestCase):
    def test_pass(self):
        for s in ('Public domain', 'CC0', 'CC BY 2.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0 de', 'CC BY-SA 3.0 IGO',
                  'CC BY 2.5', 'CC BY-SA 2.5,2.0,1.0', 'cc-by-sa-4.0', 'CC-BY-SA-3.0-de', 'CC BY 2.1 jp',
                  'CC BY-SA 3.0 migrated', 'CC BY-SA 3.0 unported', 'CC BY-SA 2.5 scotland'):
            self.assertTrue(fp.licence_ok(s)[0], s)

    def test_fail(self):
        for s in ('CC BY 1.0', 'CC BY-SA 1.0', 'GFDL', 'Fair use', '', None, 'CC BY-NC-SA 4.0', 'CC BY-ND 4.0',
                  'Copyrighted free use', 'Attribution', 'CC BY 2.0 non-commercial', 'CC BY-SA 4.0 no derivatives',
                  'CC BY 4.0 NC-ND', 'CC BY 2.0 nd', 'CC BY 3.0 but only for noncommercial use', 'CC BY 10.0',
                  'CC BY 3.5', 'CC BY-SA 3.0 de extra', 'CC BY-SA 4.0 or later', 'CC BY-NC 2.0 de'):
            self.assertFalse(fp.licence_ok(s)[0], s)
        self.assertFalse(fp.licence_ok('CC BY-SA 4.0', 'true')[0])     # NonFree flag wins

    def test_scores(self):
        self.assertIsNone(fp.file_score('File:Italien passport data page.jpg'))
        self.assertIsNotNone(fp.file_score('File:Italien passport cover.jpg'))   # 'alien' is a word, not a substring
        self.assertIsNone(fp.file_score('File:Passport.pdf'))
        self.assertGreater(fp.file_score('File:X passport front cover.jpg'), fp.file_score('File:X passport.jpg'))


class Items(unittest.TestCase):
    def test_place_of(self):
        cmap = {'Q35': 208, 'Q223': 304, 'Q4628': 234, 'Q55': 528, 'Q21203': 533, 'Q25279': 531, 'Q145': 826}
        sovs = {208: None, 304: 208, 234: 208, 528: None, 533: 528, 531: 528, 826: None, 832: 826}
        it = lambda label, countries, juris: {'label': label, 'countries': set(countries), 'juris': set(juris)}
        self.assertEqual(fp.place_of(it('Danish passport', ['Q35'], ['Q35', 'Q223', 'Q4628']), cmap, sovs), 208)
        self.assertEqual(fp.place_of(it('Dutch passport', ['Q55'], ['Q55', 'Q21203', 'Q25279']), cmap, sovs), 528)
        self.assertEqual(fp.place_of(it('Dutch passport', ['Q55'], ['Q21203', 'Q25279']), cmap, sovs), 528)
        self.assertEqual(fp.place_of(it('Faroese passport', ['Q35'], ['Q4628']), cmap, sovs), 234)
        self.assertEqual(fp.place_of(it('Danish passport', [], ['Q35', 'Q4628']), cmap, sovs), 208)
        self.assertEqual(fp.place_of(it('Jersey passport', ['Q145'], []), cmap, sovs), 832)

    def test_rank(self):
        it = lambda q, dates=(), end=(): {'qid': q, 'label': 'X passport', 'dates': set(dates), 'end': set(end)}
        rank = lambda *its: [x['qid'] for x in sorted(its, key=fp.item_rank)]
        self.assertEqual(rank(it('Qold', ['1995-01-01'], ['2006-04-12']), it('Qnow'), it('Qnew', ['2021-01-01'])),
                         ['Qnow', 'Qnew', 'Qold'])
        # all ended: the newest ended design, one with an unknown end date last
        self.assertEqual(rank(it('Qa', ['1995-01-01'], ['2006-04-12']), it('Qb', ['2006-04-12'], ['2020-01-01']),
                              it('Qc', [], [fp.UNKNOWN])), ['Qb', 'Qa', 'Qc'])
        self.assertIsNone(fp.day(GENID))
        self.assertEqual(fp.day('2021-03-01T00:00:00Z'), '2021-03-01')


class Blocked(Base):
    def test_identifier_check_failure_aborts(self):
        self.fake.labels['Q43812'] = 'visa'
        before = self.data_bytes()
        self.assertEqual(fp.collect(), 3)
        self.assertEqual([u for u, _, _ in self.fake.calls], [fp.WD_API])       # nothing after the check
        self.assertEqual(self.state()['collect']['status'], 'identifier')
        text = self.report_text()
        self.assertIn('식별자', text)
        self.assertIn('Q43812', text)
        self.assertEqual(self.data_bytes(), before)

    def test_m49_label_variants(self):
        self.fake.labels['P2082'] = 'M.49 code'
        fp.check_identifiers()
        self.fake.labels['P2082'] = 'UN area code'
        fp.REFRESH = True
        with self.assertRaises(fp.IdentifierError):
            fp.check_identifiers()

    def test_network_failure_writes_report(self):
        self.fake.blocked = True
        before = self.data_bytes()
        self.assertEqual(fp.collect(), 2)
        st = self.state()['collect']
        self.assertEqual(st['status'], 'network')
        self.assertEqual({b['host'] for b in st['blocked']}, set(fp.HOSTS))
        text = self.report_text()
        self.assertIn('네트워크 차단', text)
        self.assertIn('첫 요청인 식별자 확인에서 `www.wikidata.org`', text)
        for h in fp.HOSTS:
            self.assertIn('`%s`' % h, text)
        self.assertIn('403 Forbidden', text)
        self.assertIn('| 없음 | %d |' % len(APPDATA['LOC']), text)
        self.assertIn('python3 pipeline/fetch_passports.py collect', text)
        self.assertEqual(self.data_bytes(), before)
        with open(fp.REVIEW, encoding='utf-8') as f:
            self.assertEqual(json.load(f), {})
        with open(fp.GITIGNORE, encoding='utf-8') as f:
            self.assertIn('pipeline/.cache/', f.read().splitlines())
        self.assertEqual(sorted(os.listdir(fp.ASSETS)), ['276.webp', '999.webp'])   # collect never touches assets

    def test_only_sparql_blocked(self):
        self.fake.blocked = {'query.wikidata.org'}
        before = self.data_bytes()
        self.assertEqual(fp.collect(), 2)
        c = self.state()['collect']
        self.assertEqual((c['status'], c['step']), ('network', 'sparql'))
        self.assertEqual([b['host'] for b in c['blocked']], ['query.wikidata.org'])
        text = self.report_text()
        self.assertIn('식별자 확인은 통과했지만 Wikidata SPARQL 조회 단계에서 `query.wikidata.org`', text)
        self.assertNotIn('첫 요청', text)
        self.assertEqual(self.data_bytes(), before)

    def test_cut_off_sparql_answer(self):
        self.fake.cut_sparql = True
        before = self.data_bytes()
        self.assertEqual(fp.collect(), 0)        # SPARQL failure is recorded; Commons categories still tried
        c = self.state()['collect']
        self.assertEqual([e['step'] for e in c['errors']], ['sparql'])
        self.assertIn('unusable answer', c['errors'][0]['detail'])
        self.assertIn('sparql: unusable answer', self.report_text())
        self.assertEqual(c['candidates']['250'], [])
        n = sum(1 for u, _, _ in self.fake.calls if u == fp.SPARQL)
        self.fake.cut_sparql = False              # the broken answer was not cached
        self.assertEqual(fp.collect(), 0)
        self.assertGreater(sum(1 for u, _, _ in self.fake.calls if u == fp.SPARQL), n)
        self.assertEqual([x['title'] for x in self.state()['collect']['candidates']['250']],
                         ['File:French passport cover.jpg'])
        self.assertEqual(self.data_bytes(), before)

    def test_unexpected_error_still_writes_report(self):
        def boom(*a):
            raise RuntimeError('surprise')
        real, fp.countries = fp.countries, boom
        err, sys.stderr = sys.stderr, io.StringIO()
        try:
            self.assertEqual(fp.collect(), 1)
        finally:
            fp.countries, sys.stderr = real, err
        self.assertEqual(self.state()['collect']['status'], 'error')
        self.assertIn('RuntimeError: surprise', self.report_text())

    def test_bad_review_file(self):
        with open(fp.REVIEW, 'w', encoding='utf-8') as f:
            json.dump({'250': [{'title': 'File:A.jpg', 'ok': True}, {'title': 'File:B.jpg', 'ok': True}]}, f)
        self.assertEqual(fp.collect(), 4)
        self.assertIn('more than one approved', self.report_text())
        with open(fp.REVIEW, 'w', encoding='utf-8') as f:
            json.dump({'250': {'title': 'File:A.jpg', 'ok': True, 'crop': [0, 0, -5, 10]}}, f)
        with self.assertRaises(fp.ReviewError):
            fp.load_review(fp.load_places())

    def test_throttle_and_cache(self):
        fp.MIN_INTERVAL = 0.05
        t = time.monotonic()
        for i in range(3):
            fp.api(fp.COMMONS_API, action='query', list='categorymembers', cmtitle='Category:X%d' % i)
        self.assertGreaterEqual(time.monotonic() - t, 0.1)
        n = len(self.fake.calls)
        fp.api(fp.COMMONS_API, action='query', list='categorymembers', cmtitle='Category:X0')
        self.assertEqual(len(self.fake.calls), n)                                   # served from cache
        self.assertTrue(all(h['User-Agent'] == fp.UA for _, _, h in self.fake.calls))


class Flow(Base):
    def test_collect_review_apply(self):
        before_bytes = self.data_bytes()
        self.assertEqual(fp.collect(), 0)
        self.assertEqual(self.data_bytes(), before_bytes, 'collect must not write appdata.json')
        c = self.state()['collect']
        titles = lambda k: [x['title'] for x in c['candidates'].get(k, [])]

        # Wikidata: one item, the current ordinary passport; diplomatic/service items dropped; the ended
        # 1995 design and the one with unknown dates are never candidates while a current item exists
        self.assertEqual(titles('250'), ['File:French passport cover.jpg'])
        self.assertEqual(c['items']['250']['qid'], 'Q9001')
        self.assertEqual(sorted(q for q, _, _ in c['dropped']['250']), ['Q9003', 'Q9004'])
        for t in ('File:French diplomatic passport.jpg', 'File:French passport 1995.jpg',
                  'File:French passport unknown.jpg'):
            self.assertNotIn(t, self.fake.requested('imageinfo'))
        self.assertTrue(all(len(xs) <= fp.PER_PLACE for xs in c['candidates'].values()))
        # own editions: Faroe by P1001, Jersey by the label; neither lands on the sovereign
        self.assertEqual(titles('234'), ['File:Faroese passport.jpg'])
        self.assertEqual(titles('208'), ['File:Danish passport.jpg'])        # several P1001: still Denmark
        self.assertEqual(titles('304'), [])
        self.assertEqual(titles('832'), ['File:Jersey passport.jpg'])
        self.assertIn('Category:Faroese passports', fp.category_titles(fp.load_places()[234], {}))
        self.assertIn('Category:Passports of the Faroe Islands', fp.category_titles(fp.load_places()[234], {}))
        # Wikidata image without licence -> Commons category fallback
        uk = {x['title']: x for x in c['candidates']['826']}
        self.assertFalse(uk['File:British passport.jpg']['ok'])
        self.assertEqual(uk['File:British passport.jpg']['reason'], '라이선스 표기 없음')
        self.assertTrue(uk['File:UK passport cover.jpg']['ok'])
        # Commons: at most 3, covers first, data/visa pages never looked at
        de = {x['title']: x for x in c['candidates']['276']}
        self.assertEqual(set(de), {'File:German passport cover 2017.jpg', 'File:German passport front.png',
                                   'File:Reisepass Deutschland.jpg'})
        asked = [t for t in self.fake.requested('imageinfo') if 'German' in t or 'Reisepass' in t]
        self.assertEqual(sorted(asked), sorted(de))
        self.assertTrue(de['File:German passport cover 2017.jpg']['ok'])     # CC BY-SA 3.0 de
        self.assertTrue(de['File:German passport front.png']['ok'])          # CC0
        self.assertFalse(de['File:Reisepass Deutschland.jpg']['ok'])         # GFDL
        self.assertEqual([x['ok'] for x in c['candidates']['410']], [False])  # CC BY 1.0
        # fair use from Wikidata; Commons only fills the 2 slots left, best names first
        self.assertEqual([(x['title'], x['ok']) for x in c['candidates']['124']],
                         [('File:Canadian passport.jpg', False), ('File:Canada passport cover 2019.jpg', True),
                          ('File:Canada passport front.jpg', True)])
        self.assertNotIn('File:Canada passport cover old.jpg', self.fake.requested('imageinfo'))
        # a P18 that redirects: the file behind it is the candidate, the asked title is kept
        self.assertEqual([(x['title'], x.get('asked'), x['ok']) for x in c['candidates']['840']],
                         [('File:US passport data page.jpg', 'File:US passport.jpg', True)])
        self.assertEqual(c['candidates']['4'], [])                            # nothing anywhere
        self.assertEqual(titles('412'), ['File:Kosovo passport cover.jpg'])   # iso2 null did not crash
        # only licence-passing candidates were downloaded, all with the User-Agent
        passing = {thumb_of(x['title']) for xs in c['candidates'].values() for x in xs if x['ok']}
        self.assertEqual(set(self.fake.requested('download')), passing)
        self.assertTrue(all(h['User-Agent'] == fp.UA for _, _, h in self.fake.calls))
        with open(fp.SHEET, encoding='utf-8') as f:
            sheet = f.read()
        self.assertIn('File:French passport cover.jpg', sheet)
        self.assertNotIn('diplomatic passport.jpg', sheet)
        self.assertNotIn('Reisepass', sheet)                                  # failed licence: not shown
        self.assertIn('현행 디자인', sheet)
        self.assertIn('작가(Artist) 표기가 없습니다', sheet)                   # UK cover: Credit is not the author
        snip = {k: json.loads(html.unescape(v)) for k, v in
                re.findall(r'<textarea readonly>&quot;(\d+)&quot;: (\{.*?\})</textarea>', sheet)}
        self.assertEqual({k: snip['250'][k] for k in ('title', 'qid', 'item')},
                         {'title': 'File:French passport cover.jpg', 'qid': 'Q9001', 'item': 'French passport'})
        self.assertNotIn('qid', snip['276'])                                  # Commons file: no item
        # nothing is adopted before a person has decided
        self.assertEqual(fp.apply(), 0)
        self.assertEqual(json.loads(self.data_bytes())['PASSPORT'], {})
        self.assertEqual(os.listdir(fp.ASSETS), [])

        sha = lambda t: hashlib.sha1(self.fake.files[t]['img']).hexdigest()
        self.assertEqual(snip['250']['sha1'], sha('File:French passport cover.jpg'))
        review = {
            '250': dict(snip['250'], crop=[100, 150, 800, 1200], note='파란 배경을 잘라 냄'),   # as pasted from the sheet
            '208': {'title': 'File:Danish_passport.jpg', 'ok': True, 'crop': None},
            '234': {'title': 'File:Faroese passport.jpg', 'ok': True, 'crop': None},
            '826': {'title': 'File:UK passport cover.jpg', 'ok': True, 'crop': None},
            '832': {'title': 'File:Jersey passport.jpg', 'ok': False, 'reason': '신원 정보면'},
            '554': {'title': 'File:New Zealand passport.jpg', 'ok': True, 'crop': None, 'sha1': '0' * 40},
            '410': {'title': 'File:South Korean passport cover.jpg', 'ok': True, 'crop': None},
            '840': {'title': 'File:US passport data page.jpg', 'ok': False, 'reason': '신원 정보면'},
        }
        with open(fp.REVIEW, 'w', encoding='utf-8') as f:
            json.dump(review, f, ensure_ascii=False)
        with open(fp.ASSETS + '/999.webp', 'wb') as f:
            f.write(b'stale')
        self.assertEqual(fp.apply(), 0)

        after = json.loads(self.data_bytes())
        pp = after.pop('PASSPORT')
        self.assertEqual(after, APPDATA)                                      # everything else as it was
        self.assertEqual(list(json.loads(self.data_bytes())), list(APPDATA) + ['PASSPORT'])
        self.assertEqual(self.data_bytes().decode('utf-8'),
                         json.dumps(dict(APPDATA, PASSPORT=pp), ensure_ascii=False, separators=(',', ':')))
        self.assertEqual({k: v['via'] for k, v in pp.items()},
                         {'250': 'own', '638': 'sov:250', '208': 'own', '234': 'own', '304': 'sov:208',
                          '826': 'own', '832': 'sov:826'})
        fr = pp['250']
        self.assertEqual(list(fr), ['via', 'file', 'title', 'page', 'artist', 'license', 'license_url',
                                    'changes', 'restrictions'])
        self.assertEqual(fr['file'], 'passports/250.webp')
        self.assertEqual(fr['title'], 'File:French passport cover.jpg')
        self.assertEqual(fr['page'], 'https://commons.wikimedia.org/wiki/File:French_passport_cover.jpg')
        self.assertEqual(fr['artist'], 'Jean Dupont')                        # HTML and entities stripped
        self.assertEqual(fr['license'], 'CC BY-SA 4.0')
        self.assertEqual(fr['license_url'], 'https://creativecommons.org/licenses/by-sa/4.0')
        self.assertEqual(fr['changes'], '잘라 냄, 크기 조정')
        self.assertEqual(fr['restrictions'], 'trademarked|insignia')          # as Commons gives it
        self.assertEqual(pp['826']['artist'], '')                             # never 'Own work' from Credit
        self.assertEqual(pp['208']['changes'], '크기 조정')
        self.assertEqual(pp['638'], dict(fr, via='sov:250'))                  # Réunion shows France's cover
        self.assertEqual(pp['234']['file'], 'passports/234.webp')             # Faroe: own, not Denmark's
        self.assertEqual(pp['234']['license'], 'CC BY 2.0')
        self.assertEqual(pp['304']['file'], 'passports/208.webp')
        self.assertEqual(pp['832']['file'], 'passports/826.webp')             # rejected -> sovereign
        for k in ('276', '412', '554', '184', '410', '124', '4', '840'):      # unreviewed / refused / none
            self.assertNotIn(k, pp)

        self.assertEqual(sorted(os.listdir(fp.ASSETS)), ['208.webp', '234.webp', '250.webp', '826.webp'])
        for name in os.listdir(fp.ASSETS):
            with open(os.path.join(fp.ASSETS, name), 'rb') as f:
                b = f.read()
            self.assertFalse({b'EXIF', b'XMP ', b'ICCP'} & set(webp_chunks(b)), name)
            im = Image.open(io.BytesIO(b))
            self.assertEqual(im.format, 'WEBP')
            self.assertLessEqual(im.height, 720)
            self.assertEqual(len(im.getexif()), 0)
            self.assertFalse({'exif', 'icc_profile', 'xmp'} & set(im.info), name)
        with Image.open(os.path.join(fp.ASSETS, '250.webp')) as im:
            fr_im = im.convert('RGB')
        self.assertEqual(fr_im.size, (400, 600))                              # crop applied, no resize needed
        for xy in ((5, 5), (200, 300), (394, 594)):
            r, g, b = fr_im.getpixel(xy)
            self.assertTrue(r > 150 and b < 90, (xy, (r, g, b)))              # only the red cover is left
        for name, size in (('208.webp', (405, 720)), ('234.webp', (508, 720))):
            with Image.open(os.path.join(fp.ASSETS, name)) as im:
                self.assertEqual(im.size, size)
        adopted = self.state()['apply']['adopted']
        self.assertTrue(fp.MIN_QUALITY <= adopted['208']['quality'] <= fp.QUALITY)
        self.assertEqual((adopted['250']['qid'], adopted['208']['qid']), ('Q9001', None))

        text = self.report_text()
        self.assertIn('| 채택 (자체 이미지) | 4 |', text)
        self.assertIn('| 채택 (주권국 이미지로 대체) | 3 |', text)
        self.assertIn('| 없음 | 8 |', text)
        self.assertIn('신원 정보면', text)
        self.assertIn('sha1 불일치', text)
        self.assertIn('2.0 미만 버전 (CC BY 1.0)', text)
        self.assertIn('| trademarked, insignia | [Q9001](https://www.wikidata.org/wiki/Q9001) |', text)
        self.assertIn('작가 표기 없음, 수동 확인 필요', text)
        self.assertIn('sha1 없이 승인', text)                                # 208, 234, 826 carry no sha1

        # the next collect skips the rejected Jersey file and tries its Commons categories instead
        sparql_calls = sum(1 for u, _, _ in self.fake.calls if u == fp.SPARQL)
        self.assertEqual(fp.collect(), 0)
        self.assertEqual(sum(1 for u, _, _ in self.fake.calls if u == fp.SPARQL), sparql_calls)   # cached
        c = self.state()['collect']
        self.assertEqual(titles('832'), [])
        self.assertIn('Category:Jersey passports', self.fake.requested('categoryinfo'))
        self.assertEqual([(x['title'], x['verdict']) for x in c['candidates']['250']],
                         [('File:French passport cover.jpg', 'approved')])
        self.assertEqual(c['items']['250']['qid'], 'Q9001')                    # kept from the verdict
        self.assertEqual([x['verdict'] for x in c['candidates']['276']], ['unreviewed'] * 3)
        # the rejected data page does not come back through its redirect; Commons is tried instead
        self.assertEqual([(x['title'], x['ok'], x['verdict']) for x in c['candidates']['840']],
                         [('File:US passport cover.jpg', True, 'unreviewed')])
        self.assertIn('Category:Passports of the United States', self.fake.requested('categoryinfo'))

    def test_failed_download_keeps_shipped_image(self):
        self.assertEqual(fp.collect(), 0)
        with open(fp.REVIEW, 'w', encoding='utf-8') as f:
            json.dump({'250': {'title': 'File:French passport cover.jpg', 'ok': True, 'crop': None},
                       '208': {'title': 'File:Danish passport.jpg', 'ok': True, 'crop': None}}, f)
        self.assertEqual(fp.apply(), 0)
        with open(os.path.join(fp.ASSETS, '250.webp'), 'rb') as f:
            shipped = f.read()
        before = self.data_bytes()
        self.assertEqual(set(json.loads(before)['PASSPORT']), {'250', '638', '208', '234', '304'})
        shutil.rmtree(os.path.join(fp.WORK, 'img'))                          # a fresh machine: no image cache
        self.fake.fail.add(thumb_of('File:French passport cover.jpg'))       # upload.wikimedia.org answers 503
        sleep, fp.time.sleep = fp.time.sleep, lambda s: None
        try:
            self.assertEqual(fp.apply(), 1)
        finally:
            fp.time.sleep = sleep
        self.assertEqual(self.data_bytes(), before)                           # PASSPORT, Réunion included, kept
        with open(os.path.join(fp.ASSETS, '250.webp'), 'rb') as f:
            self.assertEqual(f.read(), shipped)
        self.assertEqual(sorted(os.listdir(fp.ASSETS)), ['208.webp', '250.webp'])
        self.assertEqual(self.state()['apply']['status'], 'error')
        self.assertIn('적용 중단', self.report_text())


if __name__ == '__main__':
    builtins.open, os.replace = guarded_open, guarded_replace
    try:
        unittest.main(verbosity=2)
    finally:
        builtins.open, os.replace = _open, _replace
