// Checks the GDP bands that colour the page: BAND_EDGES and bandOf() are read from src/app.js (so the
// check follows the code), applied to data/appdata.json, and compared with the counts and birth
// shares below. Every edge must belong to the band above it. Run: node pipeline/check_bands.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const src = ['const BAND_EDGES = [^\\n]*', 'const NBANDS = [^\\n]*', 'function bandOf\\(v\\) \\{[\\s\\S]*?\\n\\}']
  .map(re => { const m = app.match(new RegExp(re)); if (!m) throw new Error('not found in app.js: ' + re); return m[0]; }).join('\n');
const { BAND_EDGES, bandOf } = new Function(src + '\nreturn { BAND_EDGES, bandOf };')();

const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'appdata.json'), 'utf8'));
const LOCS = D.LOC.map(r => Object.fromEntries(D.LOC_FIELDS.map((k, j) => [k, r[j]])));
const BY = new Map(LOCS.map(l => [l.code, l]));

// places and share of 2026 births (percent, two decimals) per band; index 0 is no data
const EXPECT = {
  count: [18, 19, 33, 39, 36, 35, 25, 18, 6, 7],
  share: [0.05, 15.99, 42.93, 17.19, 13.32, 2.76, 2.57, 2.18, 2.90, 0.11]
};
// dollar value: band, at the lowest and highest edge
const SPOTS = { 999: 1, 1000: 2, 99999: 8, 100000: 9 };
// M49 code: band
const SAMPLES = { 408: 1, 356: 2, 360: 3, 156: 4, 616: 5, 392: 6, 410: 6, 276: 7, 840: 8, 756: 9, 412: 0,
  20: 7, 784: 7, 446: 7, 208: 8, 702: 8, 136: 9 };

let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.log('FAIL', msg); } };

check(BAND_EDGES.length === 8, 'eight edges, nine bands');
check(BAND_EDGES.every((e, i) => !i || e > BAND_EDGES[i - 1]), 'edges ascending');
check(bandOf(null) === 0 && bandOf(undefined) === 0, 'no figure is band 0');
check(bandOf(0) === 1 && bandOf(1e9) === 9, 'ends');
for (const [v, b] of Object.entries(SPOTS)) check(bandOf(+v) === b, `$${v} in band ${b}, got ${bandOf(+v)}`);
BAND_EDGES.forEach((e, i) => {
  check(bandOf(e - 1) === i + 1, `$${e - 1} in band ${i + 1}, got ${bandOf(e - 1)}`);
  check(bandOf(e - 0.01) === i + 1, `$${e - 0.01} in band ${i + 1}, got ${bandOf(e - 0.01)}`);
  check(bandOf(e) === i + 2, `$${e} in band ${i + 2}, got ${bandOf(e)}`);
});

const tot = LOCS.reduce((s, l) => s + l.births, 0);
const count = Array(10).fill(0), births = Array(10).fill(0), names = Array.from({ length: 10 }, () => []);
LOCS.slice().sort((a, b) => b.births - a.births).forEach(l => { const b = bandOf(l.gdpN); count[b]++; births[b] += l.births; names[b].push(l.en); });
const lo = [null, null].concat(BAND_EDGES), hi = [null].concat(BAND_EDGES, [null]);
const label = b => !b ? 'no data' : b === 1 ? '< $' + hi[b].toLocaleString('en-US') : b === 9 ? '>= $' + lo[b].toLocaleString('en-US')
  : '$' + lo[b].toLocaleString('en-US') + '-' + hi[b].toLocaleString('en-US');
console.log('band  range               places  births');
for (const b of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
  const share = births[b] / tot * 100;
  console.log(String(b).padEnd(6) + label(b).padEnd(20) + String(count[b]).padStart(7) + (share.toFixed(2) + '%').padStart(8) + '  ' + names[b].slice(0, 4).join(', '));
  check(count[b] === EXPECT.count[b], `band ${b}: ${count[b]} places, expected ${EXPECT.count[b]}`);
  check(share.toFixed(2) === EXPECT.share[b].toFixed(2), `band ${b}: ${share.toFixed(2)}%, expected ${EXPECT.share[b].toFixed(2)}%`);
}
check(count.reduce((a, b) => a + b, 0) === LOCS.length, 'every place in one band');
for (const [code, b] of Object.entries(SAMPLES)) {
  const l = BY.get(+code);
  check(l && bandOf(l.gdpN) === b, `${l ? l.en : code} ($${l && l.gdpN}) in band ${b}, got ${l && bandOf(l.gdpN)}`);
}
console.log(fail ? fail + ' check(s) failed' : 'all checks passed (' + LOCS.length + ' places, ' + Object.keys(SAMPLES).length + ' samples, ' + BAND_EDGES.length + ' edges, ' + Object.keys(SPOTS).length + ' spot values)');
process.exit(fail ? 1 : 0);
