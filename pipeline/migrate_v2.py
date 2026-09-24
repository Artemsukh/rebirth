#!/usr/bin/env python3
"""Phase 1: rewrite data/appdata.json into the v2 layout.

- drops the population-mode data (AGE, EX_AGES) and the three mortality metrics
  (q0M q0F q5M q5F l65M l65F) from LOC and WORLD, plus WORLD.exM/exF
- turns the positional LOC rows into rows described by LOC_FIELDS
- adds empty iso2 / sov columns that build_iso.py and classify.py fill in

The UN source files are not in the repository, so build_final.py cannot be re-run;
this script edits the current appdata.json in place. Running it on a file that is
already v2 only re-checks it.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, '..', 'data', 'appdata.json')

V1_FIELDS = ('code ko en cont sub lat lng births pop srb e0M e0F tfr q0M q0F q5M q5F '
             'l65M l65F med gdp gdpNote e0B gdpN gdpNNote').split()
V2_FIELDS = ('code ko en cont sub lat lng births pop srb e0M e0F tfr med gdp gdpNote '
             'e0B gdpN gdpNNote iso2 sov').split()
WORLD_KEYS = 'births pop deaths srb e0M e0F e0B tfr med gdp gdpN gdpNcov'.split()

EXPECT_ROWS = 236
# sum of LOC births; WORLD.births (132,503,469) also counts the Holy See, which LOC leaves out
EXPECT_LOC_BIRTHS = 132503451
EXPECT_WORLD_BIRTHS = 132503469


def load():
    with open(PATH, encoding='utf-8') as f:
        return json.load(f)


def check(d, rows):
    fi = {k: i for i, k in enumerate(d['LOC_FIELDS'])}
    assert d['LOC_FIELDS'][:len(V2_FIELDS)] == V2_FIELDS, d['LOC_FIELDS']
    assert len(rows) == EXPECT_ROWS, len(rows)
    assert all(len(r) == len(d['LOC_FIELDS']) for r in rows)
    births = sum(r[fi['births']] for r in rows)
    assert births == EXPECT_LOC_BIRTHS, births
    assert d['WORLD']['births'] == EXPECT_WORLD_BIRTHS, d['WORLD']['births']
    assert len({r[fi['code']] for r in rows}) == EXPECT_ROWS
    for k in ('AGE', 'EX_AGES'):
        assert k not in d, k
    assert set(d['WORLD']) == set(WORLD_KEYS), sorted(set(d['WORLD']) ^ set(WORLD_KEYS))
    return births


def main():
    d = load()
    if 'LOC_FIELDS' in d:
        births = check(d, d['LOC'])
        print('already v2:', len(d['LOC']), 'rows, births', births)
        return
    before_rows = len(d['LOC'])
    before_births = sum(r[V1_FIELDS.index('births')] for r in d['LOC'])
    assert before_rows == EXPECT_ROWS, before_rows
    assert before_births == EXPECT_LOC_BIRTHS, before_births
    assert all(len(r) == len(V1_FIELDS) for r in d['LOC'])

    rows = []
    for r in d['LOC']:
        o = dict(zip(V1_FIELDS, r))
        o['iso2'] = None
        o['sov'] = None
        rows.append([o[k] for k in V2_FIELDS])

    out = {
        'CONT': d['CONT'],
        'SUB': d['SUB'],
        'WORLD': {k: d['WORLD'][k] for k in WORLD_KEYS},
        'LOC_FIELDS': V2_FIELDS,
        'LOC': rows,
    }
    # keep anything a later phase already added (CLASS, PASSPORT ...)
    for k, v in d.items():
        if k not in out and k not in ('AGE', 'EX_AGES', 'LOC'):
            out[k] = v
    births = check(out, rows)
    assert births == before_births
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('wrote', os.path.normpath(PATH), os.path.getsize(PATH), 'bytes;', len(rows), 'rows, births', births)


if __name__ == '__main__':
    sys.exit(main())
