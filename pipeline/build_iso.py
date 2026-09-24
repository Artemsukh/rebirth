#!/usr/bin/env python3
"""Phase 3: ISO 3166-1 alpha-2 codes and flags.

- fills the iso2 column of data/appdata.json from pycountry (its numeric codes are the
  UN M49 codes); Kosovo (412) has no ISO code and gets the user-assigned XK
- copies flag-icons (MIT) flags/4x3/<iso2>.svg for the 236 places into assets/flags/,
  shrinks them with svgo when it is available, and removes flags no longer needed
- copies the flag-icons licence to vendor/flag-icons.LICENSE

Needs: pip install pycountry; npm (flag-icons and svgo are fetched at pinned versions).
"""
import json, os, shutil, subprocess, sys, tarfile

import pycountry

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
PATH = os.path.join(ROOT, 'data', 'appdata.json')
FLAGS = os.path.join(ROOT, 'assets', 'flags')
CACHE = os.path.join(HERE, '.cache')

FLAG_ICONS = 'flag-icons@7.5.0'
SVGO = 'svgo@4.1.0'
MANUAL = {412: 'XK'}   # Kosovo


def iso2_of(code):
    if code in MANUAL:
        return MANUAL[code]
    c = pycountry.countries.get(numeric='%03d' % code)
    return c.alpha_2 if c else None


def flag_icons_dir():
    """Unpack the pinned flag-icons tarball from the npm registry into pipeline/.cache/."""
    dest = os.path.join(CACHE, FLAG_ICONS.replace('@', '-'))
    if not os.path.isdir(os.path.join(dest, 'package', 'flags', '4x3')):
        os.makedirs(dest, exist_ok=True)
        name = subprocess.check_output(['npm', 'pack', FLAG_ICONS, '--silent', '--pack-destination', dest],
                                       text=True).strip().splitlines()[-1]
        with tarfile.open(os.path.join(dest, name)) as t:
            t.extractall(dest, filter='data')
    return os.path.join(dest, 'package')


def svgo(folder):
    """Minify in place. The preset keeps the viewBox and does not change colours or geometry
    beyond rounding coordinates to 3 decimals, which is far below a pixel at chip sizes."""
    cfg = os.path.join(CACHE, 'svgo.config.mjs')
    with open(cfg, 'w') as f:
        f.write("export default { multipass: true, floatPrecision: 3, plugins: ['preset-default'] };\n")
    try:
        subprocess.run(['npx', '--yes', SVGO, '--quiet', '--config', cfg, '-f', folder], check=True)
        return True
    except (OSError, subprocess.CalledProcessError) as e:
        print('svgo skipped:', e)
        return False


def main():
    with open(PATH, encoding='utf-8') as f:
        d = json.load(f)
    fi = {k: i for i, k in enumerate(d['LOC_FIELDS'])}
    missing = []
    for r in d['LOC']:
        r[fi['iso2']] = iso2_of(r[fi['code']])
        if not r[fi['iso2']]:
            missing.append((r[fi['code']], r[fi['en']]))
    if missing:
        sys.exit('no ISO code for %s' % missing)
    isos = [r[fi['iso2']] for r in d['LOC']]
    assert len(set(isos)) == len(isos) == 236, len(set(isos))

    src = flag_icons_dir()
    os.makedirs(FLAGS, exist_ok=True)
    want = {i.lower() + '.svg' for i in isos}
    for name in sorted(want):
        p = os.path.join(src, 'flags', '4x3', name)
        if not os.path.exists(p):
            sys.exit('flag-icons has no ' + name)
        shutil.copyfile(p, os.path.join(FLAGS, name))
    for name in os.listdir(FLAGS):
        if name not in want:
            os.remove(os.path.join(FLAGS, name))
    shutil.copyfile(os.path.join(src, 'LICENSE'), os.path.join(ROOT, 'vendor', 'flag-icons.LICENSE'))
    before = sum(os.path.getsize(os.path.join(FLAGS, n)) for n in want)
    svgo(FLAGS)
    after = sum(os.path.getsize(os.path.join(FLAGS, n)) for n in want)

    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print('iso2 for %d places; %d flags, %d -> %d bytes' % (len(isos), len(want), before, after))


if __name__ == '__main__':
    main()
