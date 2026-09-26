#!/usr/bin/env python3
"""Assemble the single-file app: src/{style.css, body.html, i18n.js, app.js} + data + topology.

Flags under assets/flags/ are not inlined; the page loads the one it needs as a
same-origin static file (GitHub Pages serves it next to index.html)."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'index.html')

D3_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js'
FONTS = ('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700'
         '&family=IBM+Plex+Sans+KR:wght@400;500;600&family=Orbit&display=swap')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def min_css(s):
    """Drop comments and collapse whitespace. Spaces inside values (calc(100% - 16px),
    '0 30px 60px') survive as single spaces; only those next to { } ; , and after : go."""
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*([{};,])\s*', r'\1', s)
    s = re.sub(r'([{;][-a-zA-Z0-9]+):\s+', r'\1:', s)
    return s.replace(';}', '}').strip()


def min_js(s):
    """Line-level only: drop indentation, blank lines and comment-only lines. The source has
    no multi-line strings or template literals, so this cannot change behaviour."""
    out, in_block = [], False
    for line in s.split('\n'):
        t = line.strip()
        if in_block:
            in_block = '*/' not in t
            continue
        if t.startswith('/*'):
            in_block = '*/' not in t
            continue
        if not t or t.startswith('//'):
            continue
        out.append(t)
    return '\n'.join(out)


def json_script(obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    return s.replace('</', '<\\/')


css = min_css(read(os.path.join(SRC, 'style.css')))
body = '\n'.join(l.strip() for l in read(os.path.join(SRC, 'body.html')).split('\n') if l.strip())
# page text in five languages, read by app.js (it must come first in the same script)
i18n = min_js(read(os.path.join(SRC, 'i18n.js')))
app = min_js(read(os.path.join(SRC, 'app.js')))
data = json.load(open(os.path.join(HERE, 'data', 'appdata.json'), encoding='utf-8'))
topo = json.load(open(os.path.join(HERE, 'data', 'world.topo.json'), encoding='utf-8'))
# TopoJSON decoding: src/topo.js gives the same output as topojson-client 3.1.0 for this map
# (pipeline/check_topo.js compares them) in a seventh of the size
tj = min_js(read(os.path.join(SRC, 'topo.js')))

for name, s in (('i18n.js', i18n), ('app.js', app), ('topo.js', tj)):
    if '</script' in s.lower():
        sys.exit(name + ' contains </script')

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Birth Lottery</title>
<meta name="description" content="Be born again at random as one of the 132.5 million babies of 2026. Birth odds, GDP per head, development tier and life expectancy for 236 countries and territories, from UN World Population Prospects 2024 and IMF data.">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#050716">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="preload" as="script" href="{D3_CDN}" crossorigin="anonymous">
<style>
{css}
</style>
</head>
<body>
{body}
<script type="application/json" id="app-data">{json_script(data)}</script>
<script type="application/json" id="map-data">{json_script(topo)}</script>
<script>
{tj}
</script>
<script>
{i18n}
{app}
</script>
</body>
</html>
'''

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)
print('wrote', OUT, len(html.encode('utf-8')), 'bytes')
