#!/usr/bin/env python3
"""Phase 4: front covers of ordinary passports, from Wikidata and Wikimedia Commons only.

  python3 pipeline/fetch_passports.py collect   check the Wikidata identifiers, find candidates,
                                                 check licences, download the ones that pass and
                                                 write the contact sheet pipeline/.cache/review.html
  (a person)                                     records verdicts in pipeline/passports_review.json
  python3 pipeline/fetch_passports.py apply     adopts approved verdicts only:
                                                 assets/passports/<m49>.webp + PASSPORT in data/appdata.json
  python3 pipeline/fetch_passports.py report    rewrites pipeline/passports_report.md

Verdicts, keyed by M49 code (a value may also be a list of verdicts when several files were looked at):
  {"250": {"title": "File:...", "ok": true, "crop": [x, y, w, h] or null, "sha1": "...",
           "qid": "Q...", "item": "French passport", "note": "..."},
   "999": {"title": "File:...", "ok": false, "reason": "data page"}}
  ok = a person checked that it is the front cover of an ORDINARY passport, shows no personal data
  (face, name, number, MRZ) and that the cover fills most of the frame. crop is in pixels of the
  original file on Commons and may only cut away background. sha1 (copied from the contact sheet)
  pins the reviewed version; apply refuses the file when Commons now serves a different one.
  qid/item (also from the contact sheet, Wikidata candidates only) keep the chosen item on record.

Candidates: Wikidata items that are instances or subclasses of passport with country and image,
joined to places by the ISO alpha-2 or M49 code of their jurisdiction/country; diplomatic, official,
service ... items dropped; of the rest one item per place, the current (newest, not ended) design,
gives its image. Places still without a licence-passing candidate get files from Commons categories
such as "Passports of <name>" for the remaining slots. At most 3 candidates per place in all.
Licence: Public domain, CC0, CC BY >= 2.0, CC BY-SA >= 2.0 (ported and IGO variants by version).
Territories (sov) without an approved image of their own use the sovereign's.

Etiquette: fixed User-Agent, at most one request per second, responses cached for a week under
pipeline/.cache/passports/ (--refresh ignores the cache).
"""
import argparse, datetime as dt, hashlib, html, io, json, os, re, sys, time, traceback
from urllib.parse import unquote, urlencode, urlsplit

import requests
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))

UA = 'RebirthSimulator/2.0 (https://github.com/Artemsukh/rebirth)'
WD_API = 'https://www.wikidata.org/w/api.php'
SPARQL = 'https://query.wikidata.org/sparql'
COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
HOSTS = ('www.wikidata.org', 'query.wikidata.org', 'commons.wikimedia.org', 'upload.wikimedia.org')

MIN_INTERVAL = 1.0      # seconds between two requests to Wikimedia (any host)
CACHE_DAYS = 7          # API and SPARQL answers; images are cached by file sha1 for good
PER_PLACE = 3           # candidates looked at per place
THUMB_WIDTH = 1280      # rendition downloaded for review and processing
MAX_HEIGHT = 720
TARGET_BYTES = 60000
QUALITY, MIN_QUALITY = 80, 55
REFRESH = False

# Checked against Wikidata (English labels) before anything else.
# str = the label, tuple = the label contains one of these.
IDS = {
    'Q41438': 'passport',
    'P17': 'country',
    'P18': 'image',
    'P31': 'instance of',
    'P279': 'subclass of',
    'P297': ('iso 3166-1 alpha-2',),
    'P2082': ('m49', 'm.49'),
    'P571': 'inception',
    'P580': 'start time',
    'P582': 'end time',
    'P1001': ('jurisdiction',),         # applies to jurisdiction: Faroese, Hong Kong ... editions
    'P373': 'commons category',
}

Q_COUNTRIES = '''SELECT ?country ?iso2 ?m49 ?label ?commonscat WHERE {
  { ?country wdt:P297 ?iso2 } UNION { ?country wdt:P2082 ?m49 }
  OPTIONAL { ?country rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?country wdt:P373 ?commonscat }
}'''

Q_PASSPORTS = '''SELECT ?item ?itemLabel ?country ?juris ?image ?inception ?start ?end ?classLabel WHERE {
  ?item (wdt:P31|wdt:P279)/wdt:P279* wd:Q41438 ;
        wdt:P17 ?country ;
        wdt:P18 ?image .
  OPTIONAL { ?item wdt:P1001 ?juris }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P580 ?start }
  OPTIONAL { ?item wdt:P582 ?end }
  OPTIONAL { ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en") }
  OPTIONAL { ?item (wdt:P31|wdt:P279) ?class . ?class rdfs:label ?classLabel . FILTER(LANG(?classLabel) = "en") }
}'''

# not ordinary passports (item label, or a class label that mentions passport)
EXCLUDE = ('diplomatic', 'official', 'service', 'emergency', 'temporary', 'provisional', 'refugee',
           'alien', 'stateless', 'seafarer', 'seaman', 'collective', 'laissez', 'card', 'certificate')
# file names that are never a front cover
DROP = EXCLUDE + ('data page', 'datapage', 'data-page', 'biodata', 'personal', 'visa', 'stamp', 'mrz',
                  'signature', 'back cover', 'rear cover')
MINUS = ('page', 'inside', 'interior', 'open', 'back', 'rear', 'specimen', 'old', 'former', 'historic',
         'soviet', 'ussr')
IMAGE_EXT = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.svg')

# own editions issued under a parent's passport item: code -> (parent, words in the item label)
EDITIONS = {
    234: (208, ('faroe', 'faroese')),
    831: (826, ('guernsey',)),
    832: (826, ('jersey',)),
    833: (826, ('isle of man', 'manx')),
    344: (156, ('hong kong',)),
    446: (156, ('macau', 'macao')),
}
# extra Commons category names "<word> passports"
DEMONYMS = {234: ('Faroese',), 831: ('Guernsey',), 832: ('Jersey',), 833: ('Manx', 'Isle of Man'),
            344: ('Hong Kong',), 446: ('Macau',)}
# our English names where Commons usually says something else (Wikidata P373 comes first anyway)
ALIASES = {"Côte d'Ivoire": 'Ivory Coast', 'Türkiye': 'Turkey', 'Viet Nam': 'Vietnam',
           'Czechia': 'Czech Republic', 'Cabo Verde': 'Cape Verde', 'Timor-Leste': 'East Timor',
           'Macao': 'Macau', 'Congo': 'Republic of the Congo', 'DR Congo': 'Democratic Republic of the Congo',
           'Micronesia': 'Federated States of Micronesia', 'Saint Martin (French part)': 'Saint Martin',
           'Sint Maarten (Dutch part)': 'Sint Maarten', 'Palestine': 'State of Palestine'}


def configure(root):
    """Point every path at a checkout rooted at root (the tests use a temp dir)."""
    global ROOT, DATA, ASSETS, REVIEW, REPORT, GITIGNORE, CACHE, WORK, SHEET, STATE
    ROOT = os.path.abspath(root)
    DATA = os.path.join(ROOT, 'data', 'appdata.json')
    ASSETS = os.path.join(ROOT, 'assets', 'passports')
    REVIEW = os.path.join(ROOT, 'pipeline', 'passports_review.json')
    REPORT = os.path.join(ROOT, 'pipeline', 'passports_report.md')
    GITIGNORE = os.path.join(ROOT, '.gitignore')
    CACHE = os.path.join(ROOT, 'pipeline', '.cache')
    WORK = os.path.join(CACHE, 'passports')      # http answers, images, state.json
    SHEET = os.path.join(CACHE, 'review.html')
    STATE = os.path.join(WORK, 'state.json')


configure(os.path.join(HERE, '..'))


class NetworkError(Exception):
    """A Wikimedia host could not be reached at all (DNS, refused, blocked by a proxy)."""
    def __init__(self, host, detail):
        super().__init__('%s: %s' % (host, detail))
        self.host, self.detail = host, detail


class FetchError(Exception):
    """The host answered, but not with what we asked for."""


class IdentifierError(Exception):
    pass


class ReviewError(Exception):
    pass


# ---------------------------------------------------------------- http

def short_error(e):
    s = str(e)
    m = re.search(r'Tunnel connection failed: ([^\'")]+)', s)
    if m:
        return 'proxy refused CONNECT (%s)' % m.group(1).strip()
    return '%s: %s' % (type(e).__name__, s[:200])


def fetch_raw(url, params=None, headers=None, timeout=60):
    """One GET -> (status, headers, body). The only function that touches the network."""
    host = urlsplit(url).hostname
    last = None
    for attempt in range(3):
        if attempt:
            time.sleep(5 * attempt)
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            return r.status_code, r.headers, r.content
        except requests.exceptions.ProxyError as e:          # blocked: retrying will not help
            raise NetworkError(host, short_error(e))
        except requests.exceptions.RequestException as e:    # timeouts, resets: try again
            last = e
    raise NetworkError(host, short_error(last))


_last = 0.0


def throttle():
    global _last
    wait = MIN_INTERVAL - (time.monotonic() - _last)
    if wait > 0:
        time.sleep(wait)
    _last = time.monotonic()


def usable(body, check):
    if check is None:
        return True
    try:
        check(body)
        return True
    except (ValueError, KeyError, TypeError, AttributeError):
        return False


def get(url, params=None, accept='application/json', path=None, keep=False, check=None):
    """Throttled, cached GET with the project User-Agent -> bytes.
    path: where to cache (default: by url+params); keep: cached copy never expires;
    check(body) raises ValueError/KeyError on a cut-off or foreign answer, which is then never cached."""
    if path is None:
        key = hashlib.sha1((url + '?' + urlencode(sorted((params or {}).items()))).encode()).hexdigest()
        path = os.path.join(WORK, 'http', key[:2], key)
    if os.path.exists(path) and (keep or (not REFRESH and time.time() - os.path.getmtime(path) < CACHE_DAYS * 86400)):
        with open(path, 'rb') as f:
            body = f.read()
        if usable(body, check):
            return body
    for attempt in range(5):
        throttle()
        status, headers, body = fetch_raw(url, params, {'User-Agent': UA, 'Accept': accept})
        retry = status in (429, 500, 502, 503, 504)
        if status == 200 and url.endswith('api.php'):
            try:
                err = json.loads(body).get('error') or {}
            except (ValueError, AttributeError):
                raise FetchError('not JSON from %s' % url)
            if err.get('code') == 'maxlag':
                retry = True
            elif err:
                raise FetchError('%s: %s %s' % (url, err.get('code'), err.get('info', '')))
        if status == 200 and not retry and not usable(body, check):
            raise FetchError('unusable answer from %s (%d bytes, cut off or not the expected format)'
                             % (url, len(body)))
        if status == 200 and not retry:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(body)
            return body
        if not retry:
            raise FetchError('HTTP %d from %s' % (status, url))
        try:
            wait = int((headers or {}).get('Retry-After') or 0)
        except ValueError:
            wait = 0
        time.sleep(min(60, wait or 5 * 2 ** attempt))
    raise FetchError('gave up after retries: %s' % url)


def api(url, **params):
    params.update(format='json', formatversion='2', maxlag='5')
    return json.loads(get(url, params))


def bindings(body):
    rows = json.loads(body)['results']['bindings']
    if not isinstance(rows, list):
        raise TypeError('bindings is not a list')
    return rows


def sparql(query):
    # WDQS can cut an answer off mid-stream on timeout, and a proxy can answer 200 with HTML
    body = get(SPARQL, {'query': query, 'format': 'json'}, accept='application/sparql-results+json', check=bindings)
    return bindings(body)


def probe_hosts(first):
    """Hosts that cannot be reached at all; any HTTP answer counts as reachable."""
    out = []
    for h in HOSTS:
        if h == first.host:
            out.append({'host': h, 'detail': first.detail})
            continue
        throttle()
        try:
            fetch_raw('https://%s/' % h, headers={'User-Agent': UA}, timeout=15)
        except NetworkError as e:
            out.append({'host': h, 'detail': e.detail})
    return out


# ---------------------------------------------------------------- local files

def today():
    return dt.date.today().isoformat()


def load_data():
    with open(DATA, encoding='utf-8') as f:
        return json.load(f)


def load_places(d=None):
    """code -> {code, ko, en, iso2, sov} in LOC order."""
    d = d or load_data()
    fi = {k: i for i, k in enumerate(d['LOC_FIELDS'])}
    out = {}
    for r in d['LOC']:
        g = lambda k: r[fi[k]] if k in fi else None
        out[g('code')] = {'code': g('code'), 'ko': g('ko'), 'en': g('en'),
                          'iso2': (g('iso2') or '').upper() or None, 'sov': g('sov')}
    return out


def norm_title(t):
    t = ' '.join(str(t).replace('_', ' ').split())
    if t.lower().startswith(('file:', 'image:')):
        t = t.split(':', 1)[1].strip()
    return 'File:' + t[:1].upper() + t[1:] if t else ''


def load_review(places):
    """code -> [verdict, ...] from pipeline/passports_review.json; ReviewError when malformed."""
    if not os.path.exists(REVIEW):
        return {}
    try:
        with open(REVIEW, encoding='utf-8') as f:
            raw = json.load(f)
    except ValueError as e:
        raise ReviewError('passports_review.json is not valid JSON: %s' % e)
    if not isinstance(raw, dict):
        raise ReviewError('passports_review.json must be an object keyed by M49 code')
    out = {}
    for k, v in raw.items():
        where = 'passports_review.json["%s"]' % k
        if not k.isdigit() or int(k) not in places:
            raise ReviewError(where + ': not the M49 code of one of the places')
        vs = v if isinstance(v, list) else [v]
        for x in vs:
            if not isinstance(x, dict) or not isinstance(x.get('title'), str) or not norm_title(x['title']):
                raise ReviewError(where + ': every verdict needs "title": "File:..."')
            if not isinstance(x.get('ok'), bool):
                raise ReviewError(where + ': "ok" must be true or false')
            crop = x.get('crop')
            if crop is not None and not (isinstance(crop, list) and len(crop) == 4
                                         and all(type(n) is int and n >= 0 for n in crop)
                                         and crop[2] > 0 and crop[3] > 0):
                raise ReviewError(where + ': "crop" must be null or [x, y, w, h] in whole pixels')
            if x.get('qid') is not None and not re.fullmatch(r'Q\d+', str(x['qid'])):
                raise ReviewError(where + ': "qid" must be null or a Wikidata item id like "Q123"')
        if sum(x['ok'] for x in vs) > 1:
            raise ReviewError(where + ': more than one approved file')
        out[int(k)] = [dict(x, title=norm_title(x['title'])) for x in vs]
    return out


def split_verdicts(decisions):
    approved = {c: next(x for x in vs if x['ok']) for c, vs in decisions.items() if any(x['ok'] for x in vs)}
    rejected = {c: {x['title']: x.get('reason') or x.get('note') or '' for x in vs if not x['ok']}
                for c, vs in decisions.items()}
    return approved, rejected


def ensure_files():
    if not os.path.exists(REVIEW):
        os.makedirs(os.path.dirname(REVIEW), exist_ok=True)
        with open(REVIEW, 'w', encoding='utf-8') as f:
            f.write('{}\n')
    lines = []
    if os.path.exists(GITIGNORE):
        with open(GITIGNORE, encoding='utf-8') as f:
            lines = f.read().splitlines()
    if 'pipeline/.cache/' not in (l.strip() for l in lines):
        with open(GITIGNORE, 'a', encoding='utf-8') as f:
            if lines and lines[-1] != '':
                f.write('\n')
            f.write('pipeline/.cache/\n')


def load_state():
    try:
        with open(STATE, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(st):
    os.makedirs(WORK, exist_ok=True)
    with open(STATE, 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- Wikidata

def check_identifiers():
    r = api(WD_API, action='wbgetentities', ids='|'.join(IDS), props='labels', languages='en')
    bad = []
    for i, want in IDS.items():
        e = r.get('entities', {}).get(i) or {}
        label = ((e.get('labels') or {}).get('en') or {}).get('value', '')
        s = label.strip().lower()
        ok = s == want if isinstance(want, str) else any(w in s for w in want)
        if not ok or 'missing' in e:
            bad.append('%s is labelled "%s", expected %s' % (
                i, label, '"%s"' % want if isinstance(want, str) else 'a label containing ' + ' or '.join(want)))
    if bad:
        raise IdentifierError('; '.join(bad))


def qid(uri):
    return uri.rsplit('/', 1)[-1]


def val(b, k):
    return b[k]['value'] if k in b else None


def countries(places):
    """Wikidata country item -> place code (ISO alpha-2 first, then M49), and names per place."""
    info = {}
    for b in sparql(Q_COUNTRIES):
        e = info.setdefault(qid(val(b, 'country')), {'iso': set(), 'm49': set(), 'names': []})
        if val(b, 'iso2'):
            e['iso'].add(val(b, 'iso2').strip().upper())
        m = (val(b, 'm49') or '').strip()
        if m.isdigit():
            e['m49'].add(int(m))
        for n in (val(b, 'commonscat'), val(b, 'label')):   # Commons category first
            if n and n not in e['names']:
                e['names'].append(n)
    by_iso = {p['iso2']: c for c, p in places.items() if p['iso2']}
    cmap, names = {}, {}
    for q in sorted(info):
        e = info[q]
        code = next((by_iso[i] for i in sorted(e['iso']) if i in by_iso), None)
        if code is None:
            code = next((m for m in sorted(e['m49']) if m in places), None)
        if code is None:
            continue
        cmap[q] = code
        for n in e['names']:
            if n not in names.setdefault(code, []):
                names[code].append(n)
    return cmap, names


def file_of(uri):
    # http://commons.wikimedia.org/wiki/Special:FilePath/Foo%20bar.jpg -> File:Foo bar.jpg
    return norm_title(unquote(uri.rsplit('/', 1)[-1]))


def excluded(it):
    texts = [it['label']] + [c for c in it['classes'] if 'passport' in c.lower()]
    for t in texts:
        m = re.search(r'\b(%s)' % '|'.join(map(re.escape, EXCLUDE)), t.lower())
        if m:
            return m.group(1)
    return None


def place_of(it, cmap, sovs):
    """Place of a passport item. A single jurisdiction other than the country is an own edition
    (Faroese passport: P17 Denmark, P1001 Faroe Islands); several jurisdictions mean the parent's
    passport that also covers its territories. sovs: code -> sovereign code or None."""
    home = next((cmap[q] for q in sorted(it['countries']) if q in cmap), None)
    js = sorted({cmap[q] for q in it['juris'] if q in cmap})
    if len(js) == 1 and js[0] != home:
        return js[0]
    if len(js) > 1 and home is None:
        top = [c for c in js if not sovs.get(c)]
        home = top[0] if len(top) == 1 else None
    label = it['label'].lower()
    for code, (parent, words) in EDITIONS.items():
        if home == parent and any(w in label for w in words):
            return code
    return home


UNKNOWN = '0000-00-00'      # "unknown value" end time: the design has ended, date not known


def item_rank(it):
    # current designs first (the newest ended one only when all have ended); then newest
    # start/inception, undated items counting as current; then labels: ordinary/biometric first
    ended = any(e <= today() for e in it['end'])
    newest = max(it['dates'] | (it['end'] if ended else set()), default='9999-99-99')
    date = tuple(-int(x) for x in newest.split('-'))
    label = it['label'].lower()
    score = sum(w in label for w in ('ordinary', 'biometric', 'e-passport', 'electronic'))
    score -= sum(w in label for w in ('old', 'former', 'historic', 'first'))
    return (ended, date, -score, len(label), it['qid'])


def day(v):
    # WDQS dates look like 2021-01-01T00:00:00Z; "unknown value" comes as a .well-known/genid IRI
    m = re.match(r'\+?(\d{4}-\d\d-\d\d)', v or '')
    return m.group(1) if m else None


def passport_items(cmap, sovs):
    """code -> ranked ordinary passport items; code -> [(qid, label, why)] dropped as not ordinary."""
    items = {}
    for b in sparql(Q_PASSPORTS):
        q = qid(val(b, 'item'))
        it = items.setdefault(q, {'qid': q, 'label': '', 'countries': set(), 'juris': set(), 'images': [],
                                  'dates': set(), 'end': set(), 'classes': set()})
        it['label'] = val(b, 'itemLabel') or it['label'] or q
        it['countries'].add(qid(val(b, 'country')))
        if val(b, 'juris'):
            it['juris'].add(qid(val(b, 'juris')))
        t = file_of(val(b, 'image'))
        if t not in it['images']:
            it['images'].append(t)
        for k in ('inception', 'start'):
            if day(val(b, k)):                  # an unknown start says nothing about the order
                it['dates'].add(day(val(b, k)))
        if val(b, 'end'):
            it['end'].add(day(val(b, 'end')) or UNKNOWN)
        if val(b, 'classLabel'):
            it['classes'].add(val(b, 'classLabel'))
    ranked, dropped = {}, {}
    for it in items.values():
        code = place_of(it, cmap, sovs)
        if code is None:
            continue
        why = excluded(it)
        if why:
            dropped.setdefault(code, []).append([it['qid'], it['label'], why])
            continue
        ranked.setdefault(code, []).append(it)
    for its in ranked.values():
        its.sort(key=item_rank)
    return ranked, dropped


def item_record(it):
    """What the contact sheet, state and review file keep about the chosen item."""
    end = max(it['end'], default='')
    return {'qid': it['qid'], 'item': it['label'], 'since': max(it['dates'], default=''),
            'until': '?' if end == UNKNOWN else end, 'ended': any(e <= today() for e in it['end'])}


def wikidata_candidates(it, skip):
    """Images (P18) of the one chosen item: the current ordinary passport."""
    out = []
    for t in (it['images'] if it else []):
        if t not in skip and len(out) < PER_PLACE:
            out.append(dict(item_record(it), title=t, source='wikidata'))
    return out


# ---------------------------------------------------------------- Commons

def strip_html(s):
    s = re.sub(r'<br\s*/?>|</?(?:p|div|li|tr|td)\b[^>]*>', ' ', str(s or ''), flags=re.I)
    s = ' '.join(html.unescape(re.sub(r'<[^>]*>', '', s)).split())
    return re.sub(r' ([,;.])', r'\1', s)


def page_url(title):
    return 'https://commons.wikimedia.org/wiki/' + title.replace(' ', '_')


FACTS = ('title', 'page', 'url', 'thumb', 'width', 'height', 'mime', 'sha1', 'license', 'license_url',
         'artist', 'restrictions', 'nonfree')


def facts(p):
    ii = p['imageinfo'][0]
    em = ii.get('extmetadata') or {}
    v = lambda k: str((em.get(k) or {}).get('value') or '')
    return {'title': p['title'], 'page': ii.get('descriptionurl') or page_url(p['title']),
            'url': ii.get('url'), 'thumb': ii.get('thumburl') or ii.get('url'),
            'width': ii.get('width'), 'height': ii.get('height'), 'mime': ii.get('mime'), 'sha1': ii.get('sha1'),
            'license': strip_html(v('LicenseShortName')), 'license_url': v('LicenseUrl'),
            # Artist only: Credit is the source field ("Own work", a URL), never the author
            'artist': strip_html(v('Artist')),
            'restrictions': strip_html(v('Restrictions')), 'nonfree': v('NonFree')}


def imageinfo(titles):
    """title -> file facts, or None when Commons has no such file. Follows redirects."""
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        q = api(COMMONS_API, action='query', titles='|'.join(chunk), prop='imageinfo', redirects='1',
                iiprop='url|size|mime|sha1|extmetadata', iiurlwidth=str(THUMB_WIDTH), iiextmetadatalanguage='en',
                iiextmetadatafilter='LicenseShortName|LicenseUrl|Artist|Credit|Restrictions|NonFree'
                ).get('query', {})
        alias = {m['from']: m['to'] for m in q.get('normalized', []) + q.get('redirects', [])}
        pages = {p['title']: p for p in q.get('pages', [])}
        for t in chunk:
            f = t
            for _ in range(3):
                f = alias.get(f, f)
            p = pages.get(f)
            out[t] = facts(p) if p and p.get('imageinfo') else None
    return out


def licence_ok(short, nonfree=''):
    """(passes, reason). Public domain, CC0, CC BY / CC BY-SA 2.0 or later (ported and IGO variants
    count by their version). Everything else fails, including a missing licence."""
    s = ' '.join((short or '').replace('_', ' ').split()).lower()
    if not s:
        return False, '라이선스 표기 없음'
    if str(nonfree).strip().lower() in ('true', '1'):
        return False, '비자유 파일 (%s)' % short
    if s in ('public domain', 'cc0', 'cc0 1.0', 'cc zero'):
        return True, ''
    if re.search(r'\bn[cd]\b|non-?commercial|no-?deriv', s):
        return False, '허용하지 않는 라이선스 (%s)' % short
    m = LICENCE_RE.fullmatch(s)
    if not m:
        return False, '허용하지 않는 라이선스 (%s)' % short
    if m.group(1) < '2.0':
        return False, '2.0 미만 버전 (%s)' % short
    return True, ''


# CC BY / CC BY-SA, a real version (several, as in "2.5,2.0,1.0", when the file offers them all),
# then at most one known suffix: IGO, unported, migrated, scotland or a two-letter jurisdiction port
LICENCE_RE = re.compile(r'cc[ -]by(?:-sa)?[ -](1\.0|2\.0|2\.1|2\.5|3\.0|4\.0)(?:,[1-4]\.[0-5])*'
                        r'(?:[ -](?:igo|unported|scotland|migrated(?:-with-disclaimers)?|[a-z]{2}))?')


def check_licences(cands, errors):
    """Fill file facts and ok/why/reason into each candidate dict, in place."""
    if not cands:
        return
    try:
        info = imageinfo([x['title'] for x in cands])
    except FetchError as e:
        errors.append({'step': 'imageinfo', 'detail': str(e)})
        for x in cands:
            x.update(ok=False, why='fetch', reason='파일 정보를 받지 못함')
        return
    for x in cands:
        f = info.get(x['title'])
        if f is None:
            x.update(ok=False, why='missing', reason='Commons에 파일 없음')
            continue
        if f['title'] != x['title']:            # redirect: keep the title we asked for as well
            x['asked'] = x['title']
        x.update({k: f[k] for k in FACTS})
        ok, reason = licence_ok(f['license'], f['nonfree'])
        x.update(ok=ok, why='' if ok else 'licence', reason=reason)


def names_of(x):
    return {x['title'], x.get('asked')} - {None}


def settle(xs, rejected):
    """After the licence check: drop files a person already rejected (also when reached through a
    redirect) and files that turned out to be the same file under another name."""
    out, seen = [], set()
    for x in xs:
        if names_of(x) & set(rejected) or x['title'] in seen:
            continue
        seen.add(x['title'])
        out.append(x)
    return out


def category_titles(place, names):
    base = []
    for n in names.get(place['code'], []) + [ALIASES.get(place['en']), place['en']]:
        if n and n not in base:
            base.append(n)
    out = []
    for n in base[:4]:
        n = n[4:] if n.lower().startswith('the ') else n
        out += ['Category:Passports of ' + n, 'Category:Passports of the ' + n]
    out += ['Category:%s passports' % w for w in DEMONYMS.get(place['code'], ())]
    return list(dict.fromkeys(out))


def category_sizes(titles):
    """Category title -> files + subcategories (0 when it does not exist)."""
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        q = api(COMMONS_API, action='query', prop='categoryinfo', titles='|'.join(chunk)).get('query', {})
        alias = {m['from']: m['to'] for m in q.get('normalized', [])}
        pages = {p['title']: p for p in q.get('pages', [])}
        for t in chunk:
            ci = pages.get(alias.get(t, t), {}).get('categoryinfo') or {}
            out[t] = ci.get('files', 0) + ci.get('subcats', 0)
    return out


def members(cat):
    r = api(COMMONS_API, action='query', list='categorymembers', cmtitle=cat, cmtype='file|subcat', cmlimit='500')
    ms = r.get('query', {}).get('categorymembers', [])
    return [m['title'] for m in ms if m.get('ns') == 6], [m['title'] for m in ms if m.get('ns') == 14]


def words(s):
    return re.compile(r'\b(%s)' % '|'.join(map(re.escape, s)))


RE_DROP, RE_MINUS = words(DROP), words(MINUS)


def file_score(title):
    """Higher = more likely a front cover; None = never a cover."""
    n = title[5:].lower().replace('_', ' ')
    if not n.endswith(IMAGE_EXT) or RE_DROP.search(n):
        return None
    s = 3 * ('cover' in n) + 2 * ('front' in n) - 2 * len(RE_MINUS.findall(n))
    years = [int(y) for y in re.findall(r'(?<!\d)(?:19|20)\d\d(?!\d)', n)]
    if years:
        s += 1 if max(years) >= 2015 else -1
    return s


def subcat_score(title):
    n = title.lower()
    if RE_DROP.search(n) or RE_MINUS.search(n):
        return None
    return 3 * ('cover' in n) + 2 * ('ordinary' in n) + ('biometric' in n)


def pick_files(cats, skip, errors, limit=PER_PLACE):
    """Up to limit best-named files from the categories (one level of subcategories if short)."""
    found, subs = {}, []

    def add(cat):
        try:
            files, sc = members(cat)
        except FetchError as e:
            errors.append({'step': 'categorymembers', 'detail': str(e)})
            return []
        for t in files:
            found.setdefault(norm_title(t), cat)
        return sc

    def ranked():
        ok = [t for t in found if t not in skip and file_score(t) is not None]
        return sorted(ok, key=lambda t: (-file_score(t), t))

    if limit <= 0:
        return []
    for cat in cats:
        subs += add(cat)
    if len(ranked()) < limit:
        good = [s for s in dict.fromkeys(subs) if subcat_score(s) is not None]
        for s in sorted(good, key=lambda s: (-subcat_score(s), s))[:2]:
            add(s)
    return [{'title': t, 'source': 'commons', 'category': found[t]} for t in ranked()[:limit]]


def download(f):
    """Review/processing rendition, cached by the file's sha1: a new upload is a new cache file."""
    ext = os.path.splitext(urlsplit(f['thumb']).path)[1].lower() or '.img'
    key = f.get('sha1') or hashlib.sha1(f['thumb'].encode()).hexdigest()
    path = os.path.join(WORK, 'img', '%s-%d%s' % (key, THUMB_WIDTH, ext))
    body = get(f['thumb'], accept='image/*', path=path, keep=True)
    try:
        Image.open(io.BytesIO(body)).verify()
    except Exception as e:
        os.remove(path)
        raise FetchError('not an image: %s (%s)' % (f['thumb'], e))
    return path


# ---------------------------------------------------------------- collect

def collect():
    ensure_files()
    st = load_state()
    c = st['collect'] = {'date': today(), 'status': 'running', 'step': '', 'message': '', 'blocked': [],
                         'errors': [], 'candidates': {}, 'items': {}, 'dropped': {}, 'categories': {}}
    rc = 0
    try:
        places = load_places()
        decisions = load_review(places)
        print('checking Wikidata identifiers ...')
        c['step'] = 'identifiers'
        check_identifiers()
        run_collect(places, decisions, c)
        c['status'] = 'ok'
    except NetworkError as e:
        print('network: cannot reach %s (%s)' % (e.host, e.detail))
        print('checking which Wikimedia hosts are reachable ...')
        c['status'], c['message'], c['host'], c['blocked'] = 'network', str(e), e.host, probe_hosts(e)
        rc = 2
    except IdentifierError as e:
        c['status'], c['message'], rc = 'identifier', str(e), 3
    except ReviewError as e:
        c['status'], c['message'], rc = 'review', str(e), 4
    except FetchError as e:
        c['status'], c['message'], rc = 'error', str(e), 1
    except Exception as e:                  # anything unexpected: still leave a state and a report
        traceback.print_exc()
        c['status'], c['message'], rc = 'error', '%s: %s' % (type(e).__name__, e), 1
    save_state(st)
    write_report(st)
    if rc:
        print('collect stopped: %s' % (c['message'] or c['status']))
        for b in c['blocked']:
            print('  unreachable: %s (%s)' % (b['host'], b['detail']))
        print('nothing adopted; data/appdata.json untouched. report: %s' % os.path.relpath(REPORT, ROOT))
    return rc


def run_collect(places, decisions, c):
    approved, rejected = split_verdicts(decisions)
    errors = c['errors']
    print('Wikidata: countries and passport items ...')
    c['step'] = 'sparql'
    try:
        cmap, names = countries(places)
        ranked, dropped = passport_items(cmap, {k: p['sov'] for k, p in places.items()})
    except FetchError as e:
        errors.append({'step': 'sparql', 'detail': str(e)})
        cmap, names, ranked, dropped = {}, {}, {}, {}
    c['dropped'] = {str(k): v for k, v in dropped.items()}

    cands = {}
    for code in places:
        if code in approved:     # already decided: only the approved file, for the contact sheet
            v = approved[code]
            x = {'title': v['title'], 'source': 'review'}
            if v.get('qid'):
                x.update(qid=v['qid'], item=v.get('item') or '')
                c['items'][str(code)] = {'qid': v['qid'], 'item': v.get('item') or ''}
            cands[code] = [x]
        else:                    # one item: the current ordinary passport, newest design
            it = (ranked.get(code) or [None])[0]
            if it:
                c['items'][str(code)] = item_record(it)
            cands[code] = wikidata_candidates(it, rejected.get(code, {}))
    c['candidates'] = {str(k): v for k, v in cands.items()}   # same lists, so a crash keeps what we have
    c['step'] = 'imageinfo'
    check_licences([x for xs in cands.values() for x in xs], errors)
    for code in places:
        cands[code] = settle(cands[code], rejected.get(code, {}))
    c['candidates'] = {str(k): v for k, v in cands.items()}

    need = [code for code in places if code not in approved and not any(x['ok'] for x in cands[code])]
    print('Commons categories for %d places ...' % len(need))
    c['step'] = 'categories'
    titles = {code: category_titles(places[code], names) for code in need}
    try:
        sizes = category_sizes([t for ts in titles.values() for t in ts])
    except FetchError as e:
        errors.append({'step': 'categoryinfo', 'detail': str(e)})
        sizes = {}
    new = []
    for code in need:
        cats = [t for t in titles[code] if sizes.get(t)]
        c['categories'][str(code)] = cats
        if not cats:
            continue
        skip = set(rejected.get(code, {})) | {n for x in cands[code] for n in names_of(x)}
        got = pick_files(cats, skip, errors, PER_PLACE - len(cands[code]))   # at most 3 per place in all
        cands[code] += got
        new += got
    c['step'] = 'imageinfo'
    check_licences(new, errors)
    for code in need:
        cands[code] = settle(cands[code], rejected.get(code, {}))
    c['candidates'] = {str(k): v for k, v in cands.items()}

    passing = [x for xs in cands.values() for x in xs if x['ok']]
    print('downloading %d licence-passing candidates ...' % len(passing))
    c['step'] = 'download'
    for x in passing:
        try:
            x['local'] = os.path.relpath(download(x), CACHE).replace(os.sep, '/')
        except FetchError as e:
            x.update(ok=False, why='download', reason='내려받기 실패')
            errors.append({'step': 'download', 'detail': str(e)})

    for code, xs in cands.items():
        for x in xs:
            x['verdict'] = 'approved' if code in approved and approved[code]['title'] in names_of(x) else 'unreviewed'
    c['step'] = 'done'
    write_sheet(places, c)
    waiting = sum(1 for xs in cands.values() if any(x['ok'] and x['verdict'] == 'unreviewed' for x in xs))
    print('places with candidates awaiting review: %d, approved: %d, without a usable candidate: %d'
          % (waiting, len(approved), sum(1 for xs in cands.values() if not any(x['ok'] for x in xs))))
    print('contact sheet: %s' % os.path.relpath(SHEET, ROOT))


def write_sheet(places, c):
    e = html.escape
    groups = []
    for key, xs in c['candidates'].items():
        shown = [x for x in xs if x.get('local')]
        if shown:
            groups.append((places[int(key)], shown))
    groups.sort(key=lambda g: (not any(x['verdict'] == 'unreviewed' for x in g[1]), g[0]['en']))
    badge = {'approved': '승인', 'unreviewed': '미검수'}     # rejected files never come back as candidates
    out = ['<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>여권 표지 검수</title><style>',
           'body{font:14px/1.5 system-ui,sans-serif;margin:16px;background:#f6f6f6;color:#222}',
           'section{margin:28px 0;border-top:1px solid #ccc;padding-top:8px}.cards{display:flex;flex-wrap:wrap;gap:16px}',
           'figure{margin:0;width:340px;background:#fff;border:3px solid #aaa;padding:8px}',
           'figure.approved{border-color:#2a7d2a}',
           'img{display:block;max-width:100%;max-height:440px;margin:0 auto 8px;'
           'background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}',
           'figcaption div{word-break:break-all}textarea{width:100%;height:7em;font:12px monospace}',
           '.warn{color:#a40;font-weight:600}',
           '</style></head><body><h1>여권 표지 후보 검수</h1>',
           '<p>수집 %s · 후보가 있는 곳 %d · 판정은 <code>pipeline/passports_review.json</code>에 적습니다.</p>'
           % (e(c['date']), len(groups)),
           '<ol><li>일반 여권의 <b>현행 디자인</b> <b>앞표지</b>인가? 옛 디자인, 외교관·관용 여권, 신원 정보면, '
           '사증면, 견본 정보면은 거부. Wikidata 항목의 시작·종료 날짜를 함께 봅니다.</li>',
           '<li>얼굴, 이름, 여권 번호, MRZ 같은 개인 정보가 <b>전혀</b> 보이지 않는가?</li>',
           '<li>표지가 화면 대부분을 차지하는가? 배경만 <code>crop</code> [x, y, w, h]로 잘라 낼 수 있습니다 '
           '(Commons 원본 픽셀 기준). 표지 그림 자체는 고치지 않습니다.</li>',
           '<li>승인하려면 아래 칸의 JSON을 복사해 넣고, 거부는 <code>"ok": false, "reason": "..."</code>로 적습니다.</li></ol>']
    for p, xs in groups:
        sov = ' · 주권국 %s' % p['sov'] if p['sov'] else ''
        out.append('<section><h2>%s · %s · %s%s</h2><div class="cards">' % (e(p['ko']), e(p['en']), p['code'], sov))
        for x in xs:
            if x.get('qid'):
                span = ' · %s ~ %s' % (x.get('since') or '?', x.get('until') or '') if x.get('since') or x.get('until') else ''
                src = 'Wikidata <a href="https://www.wikidata.org/wiki/%s">%s</a> (%s%s)' % (
                    e(x['qid']), e(x['qid']), e(x.get('item') or ''), e(span))
            elif x.get('category'):
                src = 'Commons <a href="%s">%s</a>' % (e(page_url(x['category'])), e(x['category']))
            else:
                src = '검수 파일에 적힌 파일'
            verdict = {'title': x['title'], 'ok': True, 'crop': None, 'sha1': x.get('sha1')}
            if x.get('qid'):                      # the chosen Wikidata item goes on record with the verdict
                verdict.update(qid=x['qid'], item=x.get('item') or '')
            snippet = '"%s": %s' % (p['code'], json.dumps(dict(verdict, note=''), ensure_ascii=False))
            out.append('<figure class="%s"><img loading="lazy" src="%s" alt=""><figcaption>' % (x['verdict'], e(x['local'])))
            out.append('<div><b><a href="%s">%s</a></b></div>' % (e(x['page']), e(x['title'])))
            out.append('<div>%s · <a href="%s">%s</a> · 원본 %s×%s px</div>' % (
                e(badge[x['verdict']]), e(x.get('license_url') or x['page']), e(x['license']), x['width'], x['height']))
            out.append('<div>작가: %s</div><div>출처: %s</div>' % (e(x.get('artist') or '-'), src))
            if x.get('ended'):
                out.append('<div class="warn">종료된 디자인의 항목입니다 (현행 항목이 없음). 현행 표지인지 확인하세요.</div>')
            if not x.get('artist'):
                out.append('<div class="warn">작가(Artist) 표기가 없습니다. 파일 페이지에서 저작자 표시를 확인하세요.</div>')
            if x.get('restrictions'):
                out.append('<div>제한: %s</div>' % e(x['restrictions']))
            out.append('<textarea readonly>%s</textarea></figcaption></figure>' % e(snippet))
        out.append('</div></section>')
    out.append('</body></html>')
    os.makedirs(CACHE, exist_ok=True)
    with open(SHEET, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')


# ---------------------------------------------------------------- apply

def srgb(im):
    """RGB or RGBA in sRGB; an embedded colour profile is converted, not just dropped."""
    alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
    mode = 'RGBA' if alpha else 'RGB'
    icc = im.info.get('icc_profile')
    if icc:
        try:
            from PIL import ImageCms
            if im.mode not in ('RGB', 'RGBA', 'CMYK'):
                im = im.convert(mode)
            return ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(icc)),
                                             ImageCms.createProfile('sRGB'), outputMode=mode)
        except Exception:
            pass     # unreadable profile: keep the pixel values
    return im.convert(mode)


def process(raw, width, height, crop):
    """Crop (in original-file pixels), shrink to MAX_HEIGHT, WebP without any metadata.
    -> (webp bytes, changes, quality)"""
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
    changes = []
    if crop:
        x, y, w, h = crop
        if x + w > width or y + h > height:
            raise ValueError('crop %s lies outside the %dx%d file' % (crop, width, height))
        sx, sy = im.width / width, im.height / height
        im = im.crop((round(x * sx), round(y * sy), round((x + w) * sx), round((y + h) * sy)))
        changes.append('잘라 냄')
    im = srgb(im)
    if im.height > MAX_HEIGHT:
        im = im.resize((max(1, round(im.width * MAX_HEIGHT / im.height)), MAX_HEIGHT), Image.LANCZOS)
    changes.append('크기 조정')
    clean = Image.new(im.mode, im.size)      # fresh image: no EXIF, XMP or ICC can ride along
    clean.paste(im)
    q = QUALITY
    while True:
        buf = io.BytesIO()
        clean.save(buf, 'WEBP', quality=q, method=6)
        if buf.tell() <= TARGET_BYTES * 1.25 or q <= MIN_QUALITY:
            return buf.getvalue(), ', '.join(changes), q
        q = max(MIN_QUALITY, q - 5)


def write_passport(passport):
    """Replace only PASSPORT in appdata.json; read just before writing, since other scripts edit it too."""
    d = load_data()
    new = {str(k): passport[k] for k in sorted(passport)}
    if d.get('PASSPORT') == new and 'PASSPORT' in d:
        return False
    d['PASSPORT'] = new
    tmp = DATA + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, DATA)
    return True


def apply():
    ensure_files()
    st = load_state()
    a = st['apply'] = {'date': today(), 'status': 'running', 'message': '', 'problems': [], 'warnings': [],
                       'adopted': {}}
    try:
        places = load_places()
        approved, _ = split_verdicts(load_review(places))
        # network first: nothing is written unless every lookup and download succeeded, so a server
        # hiccup never removes an image that shipped before. Only a file that is gone, fails the
        # licence rule or changed since review loses its place.
        info = imageinfo([v['title'] for v in approved.values()]) if approved else {}
        todo, failed = [], []
        for code, v in sorted(approved.items()):
            f = info.get(v['title'])
            why = None
            if f is None:
                why = 'Commons에 파일 없음'
            else:
                ok, reason = licence_ok(f['license'], f['nonfree'])
                if not ok:
                    why = '라이선스 불통과: ' + reason
                elif v.get('sha1') and v['sha1'] != f['sha1']:
                    why = '검수 뒤 Commons 파일이 바뀜 (sha1 불일치)'
            if why:
                a['problems'].append([code, v['title'], why])
                continue
            try:
                todo.append((code, v, f, download(f)))
            except FetchError as e:
                failed.append('%s %s: %s' % (code, v['title'], e))
        if failed:
            raise FetchError('download failed, try again later: ' + '; '.join(failed))
    except NetworkError as e:
        a['status'], a['message'] = 'network', str(e)
        save_state(st)
        write_report(st)
        print('apply stopped, nothing written: cannot reach %s (%s)' % (e.host, e.detail))
        return 2
    except (ReviewError, FetchError) as e:
        a['status'], a['message'] = 'error', str(e)
        save_state(st)
        write_report(st)
        print('apply stopped, nothing written: %s' % e)
        return 1
    except Exception as e:
        traceback.print_exc()
        a['status'], a['message'] = 'error', '%s: %s' % (type(e).__name__, e)
        save_state(st)
        write_report(st)
        print('apply stopped, nothing written: %s' % a['message'])
        return 1

    own = {}
    os.makedirs(ASSETS, exist_ok=True)
    for code, v, f, path in todo:
        try:
            with open(path, 'rb') as fh:
                data, changes, q = process(fh.read(), f['width'], f['height'], v.get('crop'))
        except (ValueError, OSError) as e:
            a['problems'].append([code, v['title'], '처리 실패: %s' % e])
            continue
        with open(os.path.join(ASSETS, '%d.webp' % code), 'wb') as fh:
            fh.write(data)
        a['adopted'][str(code)] = {'bytes': len(data), 'quality': q, 'sha1': f['sha1'],
                                   'checked_sha1': bool(v.get('sha1')), 'qid': v.get('qid')}
        if not f['artist']:
            a['warnings'].append([code, f['title'], '작가 표기 없음, 수동 확인 필요 (%s)' % f['license']])
        own[code] = {'via': 'own', 'file': 'passports/%d.webp' % code, 'title': f['title'], 'page': f['page'],
                     'artist': f['artist'], 'license': f['license'], 'license_url': f['license_url'],
                     'changes': changes, 'restrictions': f['restrictions']}
    passport = dict(own)
    for code, p in places.items():
        if code not in own and p['sov'] in own:
            passport[code] = dict(own[p['sov']], via='sov:%d' % p['sov'])
    keep = {'%d.webp' % code for code in own}
    stale = [n for n in os.listdir(ASSETS) if n.endswith('.webp') and n not in keep]
    for n in stale:
        os.remove(os.path.join(ASSETS, n))
    changed = write_passport(passport)
    a['status'] = 'ok'
    save_state(st)
    write_report(st)
    print('adopted: own %d, sovereign fallback %d, none %d; removed %d stale images; appdata.json %s'
          % (len(own), len(passport) - len(own), len(places) - len(passport), len(stale),
             'updated' if changed else 'unchanged'))
    for p in a['problems']:
        print('  not adopted %s %s: %s' % tuple(p))
    for p in a['warnings']:
        print('  check %s %s: %s' % tuple(p))
    return 0


# ---------------------------------------------------------------- report

# step of collect -> (what it was doing, the host it needed)
STEPS = {'identifiers': ('식별자 확인(wbgetentities)', 'www.wikidata.org'),
         'sparql': ('Wikidata SPARQL 조회', 'query.wikidata.org'),
         'imageinfo': ('Commons 파일·라이선스 정보 조회', 'commons.wikimedia.org'),
         'categories': ('Commons 분류 조회', 'commons.wikimedia.org'),
         'download': ('후보 이미지 내려받기', 'upload.wikimedia.org')}


def cell(s):
    # one Markdown table cell: Commons joins Restrictions with '|'
    return str(s or '-').replace('|', ', ').replace('\n', ' ')


STATUS = {'ok': '완료', 'network': '네트워크 차단으로 중단', 'identifier': 'Wikidata 식별자 확인 실패로 중단',
          'review': '검수 파일 오류로 중단', 'error': '오류로 중단', 'running': '도중에 멈춤'}

LICENCE_RULE = [
    '- 통과: 퍼블릭 도메인(Public domain), CC0, CC BY 2.0 이상, CC BY-SA 2.0 이상. '
    '나라별 포팅판(예: CC BY-SA 3.0 de)과 IGO판도 버전 숫자로 판단합니다.',
    '- 불통과: 그 밖의 모든 라이선스, GFDL 단독, 공정 이용, 라이선스 표기 없음, CC BY 1.0 같은 2.0 미만 버전.',
    '- 판단 근거는 Commons API `extmetadata`의 `LicenseShortName`입니다.',
    '- 휘장(insignia) 같은 저작권 밖 제한은 불통과 사유가 아닙니다. `Restrictions` 값을 PASSPORT의 `restrictions`에 그대로 적습니다.',
    '- 출처는 Wikidata와 Wikimedia Commons뿐입니다. 상업 사이트, 검색 엔진 이미지, PRADO 같은 진위 확인 DB, '
    '라이선스 표기가 없는 자료는 쓰지 않습니다.',
]

HOWTO = [
    '1. `pip install requests Pillow` (Python 3.11 이상)',
    '2. `python3 pipeline/fetch_passports.py collect`: 식별자 확인, 후보 찾기, 라이선스 확인, 후보 내려받기. '
    '결과는 `pipeline/.cache/review.html`입니다.',
    '3. `pipeline/.cache/review.html`을 브라우저로 열어 후보를 사람이 하나씩 보고, 판정을 '
    '`pipeline/passports_review.json`에 적습니다. 사람이 승인하지 않은 후보는 절대 쓰지 않습니다.',
    '4. `python3 pipeline/fetch_passports.py apply`: 승인한 것만 처리해 `assets/passports/<M49>.webp`와 '
    '`data/appdata.json`의 PASSPORT에 반영합니다.',
    '5. 거부한 곳이 있으면 collect를 다시 돌리면 다음 후보를 가져옵니다. 끝나면 `python3 build.py`.',
]


def write_report(st=None):
    st = st if st is not None else load_state()
    d = load_data()
    places = load_places(d)
    pp = d.get('PASSPORT') or {}
    c, a = st.get('collect') or {}, st.get('apply') or {}
    try:
        decisions, review_error = load_review(places), None
    except ReviewError as e:
        decisions, review_error = {}, str(e)
    name = lambda code: '%s (%s, %s)' % (places[code]['ko'], places[code]['en'], code) if code in places else str(code)
    own = [k for k, v in pp.items() if v.get('via') == 'own']
    sov = [k for k, v in pp.items() if str(v.get('via', '')).startswith('sov:')]
    none = [code for code in places if str(code) not in pp]

    L = ['# 여권 표지 이미지 보고서', '',
         '- 작성일: %s' % today(),
         '- 마지막 수집(collect): %s' % ('%s, %s' % (c['date'], STATUS.get(c.get('status'), c.get('status')))
                                     if c else '실행 기록 없음'),
         '- 마지막 적용(apply): %s' % ('%s, %s' % (a['date'], STATUS.get(a.get('status'), a.get('status')))
                                   if a else '실행 기록 없음'),
         '- 스크립트: `pipeline/fetch_passports.py`, 검수 기록: `pipeline/passports_review.json`', '']

    if c.get('status') == 'network':
        got = sum(len(xs) for xs in (c.get('candidates') or {}).values())
        what, host = STEPS.get(c.get('step'), ('알 수 없는 단계', ''))
        host = c.get('host') or host
        if c.get('step') == 'identifiers':
            said = ('이번 collect는 첫 요청인 식별자 확인에서 `%s`에 접속하지 못해 멈췄습니다. '
                    '후보를 하나도 모으지 못했고, 이미지를 내려받지 않았습니다. ' % host)
        else:
            said = ('이번 collect는 식별자 확인은 통과했지만 %s 단계에서 `%s`에 접속하지 못해 멈췄습니다 '
                    '(그때까지 본 후보 %d개). 이 결과로는 아무것도 채택하지 않습니다. ' % (what, host, got))
        L += ['## 수집하지 못함: 네트워크 차단', '',
              said + '`data/appdata.json`과 `assets/passports/`는 건드리지 않았습니다.', '',
              '접속하지 못한 호스트:', '']
        L += ['- `%s`: %s' % (b['host'], b['detail']) for b in c.get('blocked') or []] or ['- (확인 못 함) %s' % c.get('message')]
        reach = [h for h in HOSTS if h not in {b['host'] for b in c.get('blocked') or []}]
        if reach:
            L += ['', '응답한 호스트: ' + ', '.join('`%s`' % h for h in reach)]
        L += ['', '이 스크립트는 Wikidata와 Wikimedia Commons만 출처로 쓰며, 미러나 다른 사이트로 우회하지 않습니다. '
              '아래 네 호스트에 HTTPS로 접속할 수 있는 환경에서 "실행 방법"대로 다시 돌리면 됩니다: '
              + ', '.join('`%s`' % h for h in HOSTS) + '.', '']
    elif c.get('status') in ('identifier', 'review', 'error', 'running'):
        L += ['## 수집 중단: %s' % STATUS[c['status']], '', '```', c.get('message') or '', '```', '',
              '후보를 채택하지 않았고 `data/appdata.json`은 건드리지 않았습니다.', '']
    if a.get('status') in ('network', 'error'):
        L += ['## 적용 중단: %s' % STATUS[a['status']], '', '```', a.get('message') or '', '```', '',
              '아무것도 쓰지 않았습니다.', '']
    if review_error:
        L += ['## 검수 파일 오류', '', '```', review_error, '```', '']

    L += ['## 집계', '', '| 구분 | 곳 |', '|---|---:|',
          '| 채택 (자체 이미지) | %d |' % len(own),
          '| 채택 (주권국 이미지로 대체) | %d |' % len(sov),
          '| 없음 | %d |' % len(none),
          '| 합계 | %d |' % len(places), '']
    if not pp:
        L += ['`data/appdata.json`에 PASSPORT가 아직 없거나 비어 있습니다.', '']
    if sov:
        L += ['주권국 이미지로 대체한 곳: ' + ', '.join('%s → %s' % (name(int(k)), pp[k]['via'][4:])
                                             for k in sorted(sov, key=int)), '']

    L += ['## 이미지가 없는 곳 (%d)' % len(none), '', '| M49 | 이름 | English |', '|---:|---|---|']
    L += ['| %s | %s | %s |' % (code, places[code]['ko'], places[code]['en']) for code in none]
    L += ['']

    cands = c.get('candidates') or {}
    lic = [(k, x) for k, xs in cands.items() for x in xs if x.get('why') == 'licence']
    other = [(k, x) for k, xs in cands.items() for x in xs if x.get('why') in ('missing', 'download', 'fetch')]
    rej = [(code, x) for code, vs in decisions.items() for x in vs if not x['ok']]
    approved, _ = split_verdicts(decisions)
    waiting = sorted(int(k) for k, xs in cands.items()
                     if int(k) not in approved and any(x.get('ok') and x.get('verdict') == 'unreviewed' for x in xs))
    nocand = [code for code in places if c.get('status') == 'ok' and not cands.get(str(code))]
    dropped = sum(len(v) for v in (c.get('dropped') or {}).values())

    L += ['## 제외 사유', '']
    if c.get('status') != 'ok':
        L += ['collect가 끝까지 돌지 않아 후보 단계의 사유(라이선스, 후보 없음)는 집계할 수 없습니다.', '']
    L += ['- 라이선스 불통과: %d건' % len(lic)]
    L += ['  - %s: `%s`, %s' % (name(int(k)), x['title'], x['reason']) for k, x in lic]
    L += ['- 사람 검수 거부: %d건' % len(rej)]
    L += ['  - %s: `%s`, %s' % (name(code), x['title'], x.get('reason') or x.get('note') or '사유 없음') for code, x in rej]
    L += ['- 후보 없음: %s' % ('%d곳' % len(nocand) if c.get('status') == 'ok' else '알 수 없음 (수집 못 함)')]
    if nocand:
        L += ['  - ' + ', '.join(name(code) + (' → 주권국 이미지' if str(code) in sov else '') for code in nocand)]
    L += ['- 검수 대기 (라이선스는 통과했지만 아직 판정이 없는 후보가 있는 곳): %d곳' % len(waiting)]
    if waiting:
        L += ['  - ' + ', '.join(name(code) for code in waiting)]
    L += ['- Wikidata에서 일반 여권이 아니라서 뺀 항목 (외교관·관용·공무 여권 등): %d개' % dropped]
    L += ['- 기타 후보 오류 (파일 없음, 내려받기 실패): %d건' % len(other)]
    L += ['  - %s: `%s`, %s' % (name(int(k)), x['title'], x['reason']) for k, x in other]
    net = []
    if c.get('status') == 'network':
        net.append('collect 전체 중단: ' + ', '.join('`%s`' % b['host'] for b in c.get('blocked') or []))
    if a.get('status') == 'network':
        net.append('apply 중단: %s' % a.get('message'))
    net += ['%s: %s' % (x['step'], x['detail']) for x in c.get('errors') or []]
    L += ['- 네트워크·서버 실패: %s' % ('%d건' % len(net) if net else '없음')]
    L += ['  - ' + n for n in net]
    if a.get('problems'):
        L += ['- 적용(apply) 단계에서 뺀 승인 건: %d건' % len(a['problems'])]
        L += ['  - %s: `%s`, %s' % (name(code), t, why) for code, t, why in a['problems']]
    if a.get('warnings'):
        L += ['- 주의: 채택했지만 사람이 확인해야 할 곳 %d곳' % len(a['warnings'])]
        L += ['  - %s: `%s`, %s' % (name(code), t, why) for code, t, why in a['warnings']]
    nosha = [int(k) for k, v in (a.get('adopted') or {}).items() if not v.get('checked_sha1')]
    if nosha:
        L += ['- 주의: sha1 없이 승인해 검수 뒤 Commons 파일이 바뀌어도 알 수 없는 곳 %d곳 '
              '(review.html의 JSON을 그대로 옮기면 sha1이 들어갑니다)' % len(nosha)]
        L += ['  - ' + ', '.join(name(code) for code in sorted(nosha))]
    L += ['']

    if own:
        # the Wikidata item comes from the committed verdict (the snippet carries it), else from the last apply
        adopted = a.get('adopted') or {}
        L += ['## 채택한 이미지', '', '| M49 | 이름 | 파일 | 라이선스 | 작가 | 제한 | Wikidata |',
              '|---:|---|---|---|---|---|---|']
        for k in sorted(own, key=int):
            v = pp[k]
            q = (approved.get(int(k)) or {}).get('qid') or (adopted.get(k) or {}).get('qid')
            L += ['| %s | %s | [%s](%s) | %s | %s | %s | %s |' % (
                k, cell(places[int(k)]['ko'] if int(k) in places else ''), cell(v['title']), v['page'],
                cell(v['license']), cell(v['artist']), cell(v['restrictions']),
                '[%s](https://www.wikidata.org/wiki/%s)' % (q, q) if q else '-')]
        L += ['']

    L += ['## 라이선스 규칙', ''] + LICENCE_RULE + ['',
          '## 가공', '',
          '- 높이 720px 이하로 줄이고 WebP(품질 80, 60KB를 넘게 크면 55까지 낮춤)로 바꿉니다. EXIF를 비롯한 메타데이터는 모두 지웁니다.',
          '- 자르기는 검수 기록의 `crop`에 적힌 배경만 잘라 냅니다. 표지 그림은 고치지 않습니다.',
          '- `changes`에는 "크기 조정" 또는 "잘라 냄, 크기 조정"을 적습니다.', '',
          '## 실행 방법', ''] + HOWTO + ['']
    with open(REPORT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    return REPORT


def report():
    print('wrote', os.path.relpath(write_report(), ROOT))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('step', choices=('collect', 'apply', 'report'))
    ap.add_argument('--refresh', action='store_true', help='ignore cached API and SPARQL answers')
    args = ap.parse_args(argv)
    global REFRESH
    REFRESH = args.refresh
    return {'collect': collect, 'apply': apply, 'report': report}[args.step]()


if __name__ == '__main__':
    sys.exit(main())
