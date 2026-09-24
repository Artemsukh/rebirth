#!/usr/bin/env python3
"""Assemble the single-file app: src/{style.css, body.html, app.js} + data + topology."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'index.html')

D3_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js'
FONTS = ('https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;600;700'
         '&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def json_script(obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    return s.replace('</', '<\\/')


css = read(os.path.join(SRC, 'style.css'))
body = read(os.path.join(SRC, 'body.html'))
app = read(os.path.join(SRC, 'app.js'))
data = json.load(open(os.path.join(HERE, 'data', 'appdata.json'), encoding='utf-8'))
topo = json.load(open(os.path.join(HERE, 'data', 'world.topo.json'), encoding='utf-8'))
tj = read(os.path.join(HERE, 'vendor', 'topojson-client.min.js'))

for name, s in (('app.js', app), ('topojson', tj)):
    if '</script' in s.lower():
        sys.exit(name + ' contains </script')

html = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>다시 태어난다면</title>
<meta name="description" content="2026년에 태어날 아기, 또는 지금 살아 있는 83억 명 가운데 한 명으로 무작위로 다시 태어나 봅니다. UN 세계인구전망 2024와 IMF 자료로 236개 국가·지역을 빠짐없이 담았습니다.">
<meta name="color-scheme" content="light dark">
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
{app}
</script>
</body>
</html>
'''

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)
print('wrote', OUT, len(html.encode('utf-8')), 'bytes')
