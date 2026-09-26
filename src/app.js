(() => {
'use strict';

/* ================= data ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = JSON.parse($('#app-data').textContent);
const CONT = D.CONT, SUB = D.SUB, WR = D.WORLD, FIELDS = D.LOC_FIELDS;
/* Colour means one thing on this page: GDP per head in US$ at market rates (gdpN, the figure shown,
   fallback years included), in nine bands. An edge belongs to the band above it; a place with no
   figure is band 0. Bands are worked out here at start, never stored. */
const BAND_EDGES = [1000, 3000, 7000, 15000, 30000, 50000, 75000, 100000]; // 9 bands
const NBANDS = BAND_EDGES.length + 1;
/* the order bands are listed in: 1 to 9, then no data */
const BAND_LIST = Array.from({ length: NBANDS + 1 }, (_, i) => (i + 1) % (NBANDS + 1));
function bandOf(v) {
  if (v == null) return 0;
  let b = 1;
  while (b < NBANDS && v >= BAND_EDGES[b - 1]) b++;
  return b;
}
/* rows are plain arrays; LOC_FIELDS names each column so removing one cannot shift the rest */
const LOCS = D.LOC.map((r, i) => {
  const o = { i };
  FIELDS.forEach((k, j) => { o[k] = r[j]; });
  o.pm = o.srb / (1 + o.srb);
  o.band = bandOf(o.gdpN);
  return o;
});
const BY = new Map(LOCS.map(l => [l.code, l]));
const TOT = { births: 0, pop: 0 };
LOCS.forEach(l => { TOT.births += l.births; TOT.pop += l.pop; });
const RATE_B = WR.births / (365 * 86400);
const RATE_D = WR.deaths / (365 * 86400);

/* ================= language ================= */
/* S is the text table for the page language (src/i18n.js); names come from the data columns */
const LANG_KEY = 'rebirth-simulator-lang';
let LANG = 'en', S = I18N.en;
const nm = L => L[LANG] || L.en;
/* the line under the big name: the English name, except on the English page */
const nmSub = L => (LANG === 'en' ? '' : L.en);
const contName = i => (LANG === 'ko' ? CONT[i] : D.NAMES[LANG].CONT[i]);
const subName = i => (LANG === 'ko' ? SUB[i] : D.NAMES[LANG].SUB[i]);
/* source notes such as 'WB 2024', 'UN 2023', 'WB' (World Bank, same year) */
function note(n) {
  if (!n) return '';
  const [src, yr] = n.split(' ');
  return S.note(src, yr);
}
const REDUCED = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/* ================= development tiers ================= */
/* computed for today: IMF advanced economies (and their territories), UN least developed
   countries until their graduation date, everything else developing */
const TIERS = ['ADV', 'DEV', 'LDC'];
const TIER_PIPS = { ADV: 3, DEV: 2, LDC: 1 };
const ADV = new Set(D.CLASS.adv);
function tierOf(L, now = new Date()) {
  const c = L.sov || L.code;
  if (ADV.has(c)) return 'ADV';
  const g = D.CLASS.ldc[c];
  if (g !== undefined && (g === null || now < new Date(g + 'T00:00:00Z'))) return 'LDC';
  return 'DEV';
}
function largestRemainder(exact, total) {
  const fl = exact.map(Math.floor);
  let left = total - fl.reduce((a, b) => a + b, 0);
  exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
  return fl;
}
/* counts and birth shares per tier; shares are rounded so the three add up to 100
   (p2: fraction with two decimals of a percent, p1: babies out of 100 with one decimal) */
let tierCache = null;
function tierStats() {
  const day = new Date().toISOString().slice(0, 10);
  if (tierCache && tierCache.day === day) return tierCache;
  const count = { ADV: 0, DEV: 0, LDC: 0 }, births = { ADV: 0, DEV: 0, LDC: 0 };
  LOCS.forEach(l => { const t = tierOf(l); l.tier = t; count[t]++; births[t] += l.births; });
  const share = {}, p2 = {}, p1 = {};
  const h = largestRemainder(TIERS.map(t => births[t] / TOT.births * 10000), 10000);
  const d = largestRemainder(TIERS.map(t => births[t] / TOT.births * 1000), 1000);
  TIERS.forEach((t, i) => { share[t] = births[t] / TOT.births; p2[t] = h[i] / 10000; p1[t] = d[i] / 10; });
  tierCache = { day, count, births, share, p2, p1 };
  return tierCache;
}
const tierIdx = t => TIERS.indexOf(t);
/* tiers have no hue: side by side they are three greys, lv3 (advanced) to lv1, as many as their pips */
const lvCls = t => 'lv' + TIER_PIPS[t];
const pipsHTML = t => '<span class="pips" aria-hidden="true">' + [0, 1, 2].map(i => '<i' + (i < TIER_PIPS[t] ? ' class="on"' : '') + '></i>').join('') + '</span>';

/* ================= random ================= */
const U32 = new Uint32Array(2);
const HAS_CRYPTO = !!(window.crypto && crypto.getRandomValues);
function rand() {
  if (HAS_CRYPTO) {
    crypto.getRandomValues(U32);
    return (U32[0] * 2097152 + (U32[1] >>> 11)) / 9007199254740992; // 53 bits
  }
  return Math.random();
}
function makeCum(ws) {
  const c = new Float64Array(ws.length);
  let s = 0;
  for (let i = 0; i < ws.length; i++) { s += ws[i]; c[i] = s; }
  return c;
}
function pickCum(cum, u) {
  const x = (u === undefined ? rand() : u) * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] > x) hi = m; else lo = m + 1; }
  return lo;
}
const CUM = { births: makeCum(LOCS.map(l => l.births)) };

function drawOne() {
  const L = LOCS[pickCum(CUM.births)];
  return { type: 'draw', loc: L, sex: rand() < L.pm ? 'M' : 'F' };
}

/* ================= formatting ================= */
/* numbers and dates follow the page language (S.locale); formatters are kept per locale */
const NFS = new Map();
function nf(o) {
  const k = S.locale + JSON.stringify(o);
  if (!NFS.has(k)) NFS.set(k, new Intl.NumberFormat(S.locale, o));
  return NFS.get(k);
}
const fmtInt = n => nf({ maximumFractionDigits: 0 }).format(Math.round(n));
const fx = (v, d) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const pctF = (p, d) => nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(p);
function roundSig(n, sig) {
  if (n < 100) return Math.round(n);
  const p = Math.pow(10, Math.floor(Math.log10(n)) - sig + 1);
  return Math.round(n / p) * p;
}
/* a head count in words: 1억 3,250만, 1億3,250万, 132.5 million, 132,5 millones */
function big(n, sig = 3) {
  const r = roundSig(n, sig), U = S.units;
  if (U.cjk) {
    if (r < 1e4) return fmtInt(r);
    const eok = Math.floor(r / 1e8), man = Math.round((r - eok * 1e8) / 1e4);
    return (eok ? fmtInt(eok) + U.cjk[0] : '') + (eok && man ? U.sep : '') + (man ? fmtInt(man) + U.cjk[1] : '');
  }
  if (r < 1e6) return fmtInt(r);
  const [w, d] = r >= 1e9 ? [U.words[0], 1e9] : [U.words[1], 1e6];
  const v = r / d;
  return nf({ maximumFractionDigits: 3 }).format(v) + ' ' + w[v === 1 ? 0 : 1];
}
function people(n, sig = 3) {
  return n < 1 ? S.lessThanOne : S.people(big(n, sig), n);
}
/* table cells: 1.3억 and 5,280만 (억/万 in Japanese), 132.5M and 132,5 M elsewhere */
function compact(n) {
  const U = S.units;
  if (!U.cjk) return n < 1e4 ? fmtInt(n) : nf({ notation: 'compact', maximumFractionDigits: 1 }).format(n);
  if (n >= 1e8) return fx(n / 1e8, 1) + U.cjk[0];
  if (n >= 1e6) return fmtInt(n / 1e4) + U.cjk[1];
  if (n >= 1e4) return fx(n / 1e4, 1) + U.cjk[1];
  return fmtInt(n);
}
function fmtPct(p) {
  const v = p * 100;
  if (v >= 10) return pctF(p, 1);
  if (v >= 0.1) return pctF(p, 2);
  if (v >= 0.01) return pctF(p, 3);
  return nf({ style: 'percent', maximumSignificantDigits: 2 }).format(p);
}
function oneIn(p) {
  const n = 1 / p, c = n < 10 ? fx(Math.round(n * 10) / 10, 1) : big(n, 2);
  return S.oneIn(c, S.people(c, n));
}
function fmtSmall(v) {
  if (v >= 1) return fx(v, 1);
  if (v >= 0.01) return fx(v, 2);
  return nf({ maximumSignificantDigits: 1 }).format(v);
}
const usd = v => '$' + fmtInt(v);
const intl = v => S.intl(fmtInt(v));
/* a band in words: under $1,000, $1,000–3,000, $100,000 and over; no data for band 0 */
function bandName(b) {
  if (!b) return S.noData;
  const lo = BAND_EDGES[b - 2], hi = BAND_EDGES[b - 1];
  return lo === undefined ? S.bandUnder(usd(hi)) : hi === undefined ? S.bandOver(usd(lo)) : S.bandRange(usd(lo), fmtInt(hi));
}
/* the sentence screen readers hear after a draw or lookup */
const bandSay = L => S.bandSay(L.band ? bandName(L.band) : null);
const sexName = s => S.sex[s];
const DATE_OPT = { year: 'numeric', month: 'long', day: 'numeric' };
function today(t) { return new Intl.DateTimeFormat(S.locale, DATE_OPT).format(t ? new Date(t) : new Date()); }
function dateOf(iso) { return new Intl.DateTimeFormat(S.locale, Object.assign({ timeZone: 'UTC' }, DATE_OPT)).format(new Date(iso + 'T00:00:00Z')); }
function coordText(lat, lng) {
  return Math.abs(lat).toFixed(1) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(lng).toFixed(1) + '°' + (lng >= 0 ? 'E' : 'W');
}

/* ================= storage ================= */
/* v2 lives under its own key; a v1 record (births and population modes) is migrated once:
   births stats and births draws are kept, population-mode draws are dropped, the serial continues */
const KEY = 'rebirth-simulator-v2', OLD_KEY = 'dasi-taeeonandamyeon-v1';
const freshStats = () => ({ n: 0, cont: [0, 0, 0, 0, 0, 0], top: {}, tier: [0, 0, 0] });
let store = { v: 2, serial: 0, stats: freshStats(), recent: [] };
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } }
function cleanStats(s) {
  if (!s || !(s.n >= 0) || !Array.isArray(s.cont) || s.cont.length !== 6) return freshStats();
  const top = {};
  if (s.top && typeof s.top === 'object') {
    for (const [c, n] of Object.entries(s.top)) if (BY.has(+c) && n > 0) top[+c] = Math.floor(n);
  }
  return { n: Math.floor(s.n), cont: s.cont.map(v => Math.max(0, Math.floor(+v || 0))), top, tier: [0, 0, 0] };
}
/* tier counts follow today's classification, so they are rebuilt from the per-place counts */
function recountTiers() {
  const t = [0, 0, 0];
  for (const [c, n] of Object.entries(store.stats.top)) t[tierIdx(tierOf(BY.get(+c)))] += n;
  store.stats.tier = t;
}
(function loadStore() {
  let raw = null, v1 = false;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) { raw = localStorage.getItem(OLD_KEY); v1 = !!raw; }
  } catch (e) { return; }
  if (!raw) return;
  let o;
  try { o = JSON.parse(raw); } catch (e) { return; }
  if (!o || typeof o.serial !== 'number' || !(o.serial >= 0)) return;
  store.serial = Math.floor(o.serial);
  store.stats = cleanStats(v1 ? o.stats && o.stats.births : o.stats);
  if (Array.isArray(o.recent)) {
    store.recent = o.recent
      .filter(r => r && BY.has(r.c) && typeof r.no === 'number' && (r.s === 'M' || r.s === 'F') && (!v1 || r.m === 'b'))
      .map(r => ({ no: r.no, c: r.c, s: r.s, t: typeof r.t === 'number' ? r.t : null, b: r.b > 1 ? r.b : 0 }))
      .slice(0, 12);
  }
  recountTiers();
  if (v1 && save()) { try { localStorage.removeItem(OLD_KEY); } catch (e) { /* keep it */ } }
})();

/* ================= ranks ================= */
function rankPos(vals, ws, v, higher) {
  let worse = 0, eq = 0, tot = 0;
  for (let i = 0; i < vals.length; i++) {
    const x = vals[i], w = ws[i];
    if (x == null || !(w > 0)) continue;
    tot += w;
    if (Math.abs(x - v) < 1e-9) eq += w;
    else if (higher ? x < v : x > v) worse += w;
  }
  return tot ? (worse + eq / 2) / tot : 0.5;
}
function rankText(r) {
  const top = 1 - r, pc = x => pctF(Math.max(1, Math.ceil(x * 100 - 1e-9)) / 100, 0);
  return top <= 0.5 ? S.top(pc(top)) : S.bottom(pc(r));
}
/* the two headline metrics: life expectancy and GDP per head (nominal US$, PPP below).
   Draws compare with same-sex births, lookups with all births. */
function metrics(st) {
  const L = st.loc, draw = st.type === 'draw', s = st.sex;
  const ws = draw ? LOCS.map(l => l.births * (s === 'M' ? l.pm : 1 - l.pm)) : LOCS.map(l => l.births);
  const ek = draw ? 'e0' + s : 'e0B';
  const life = { v: L[ek], world: WR[ek], r: rankPos(LOCS.map(l => l[ek]), ws, L[ek], true) };
  const gdp = { v: L.gdpN, ppp: L.gdp, world: WR.gdpN, r: L.gdpN == null ? null : rankPos(LOCS.map(l => l.gdpN), ws, L.gdpN, true) };
  return { life, gdp, share: L.births / TOT.births };
}

/* ================= space backdrop ================= */
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* the stars are painted once into a 1440x900 image that the fixed backdrop shows (see .space::before,
   which also draws the three nebulae), so scrolling never repaints them */
function paintSpace() {
  const rnd = mulberry32(20260924), cols = ['#FFFFFF', '#CFE4FF', '#FFE9D6', '#DDEBFF'];
  const cv = document.createElement('canvas');
  cv.width = 1440; cv.height = 900;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  for (let i = 0; i < 230; i++) {
    const x = rnd() * 1440, y = rnd() * 900, r = 0.5 + rnd() * 0.9, o = 0.25 + rnd() * 0.65, c = cols[Math.floor(rnd() * 4)];
    const w = r < 0.8 ? 1 : 2;
    ctx.globalAlpha = o;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w);
  }
  try { $('#space').style.setProperty('--stars', 'url("' + cv.toDataURL('image/png') + '")'); } catch (e) { /* nebulae only */ }
}

/* ================= rolling digits ================= */
/* each digit is a 1.1em window over a strip 0-9 x2; the strip stops on the target digit
   after one turn, left digits first. The final value is also given as text for screen readers.
   When the last strip stops the number becomes plain text, so no moving layer is left behind. */
const STRIP = Array.from({ length: 20 }, (_, i) => i % 10).join(' ');
/* digit advance widths in em for the element's font, so a stopped number is spaced like plain text.
   Kept per font; forgotten whenever web fonts finish loading, since a fallback font may have been measured. */
const DIGW = new Map();
let digCtx = null;
if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => DIGW.clear());
function digitWidths(el) {
  const cs = getComputedStyle(el);
  if (!el.isConnected || !cs.fontFamily) return Array(10).fill(0.6);
  const font = cs.fontStyle + ' ' + cs.fontWeight + ' 100px ' + cs.fontFamily;
  if (DIGW.has(font)) return DIGW.get(font);
  digCtx = digCtx || document.createElement('canvas').getContext('2d');
  digCtx.font = font;
  const w = Array.from({ length: 10 }, (_, d) => digCtx.measureText(String(d)).width / 100);
  DIGW.set(font, w);
  return w;
}
/* the stop is a share of the strip's own height (20 lines), not (10 + d) x 1.1em: WebKit truncates
   the line height to whole pixels (30.8px -> 30px), and over 10-19 lines the em distance overshot
   by a large part of a line, so iPhones showed the next digit, or a blank after a 9 */
(function rollKeyframes() {
  const css = Array.from({ length: 10 }, (_, d) => '@keyframes r' + d + ' { 0% { transform: translateY(0); } ' +
    '100% { transform: translateY(-' + ((10 + d) / 20 * 100).toFixed(4) + '%); } }').join('\n');
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
function roll(el, text, base = 0, speed = 1, animate = true) {
  el.textContent = '';
  const token = el._roll = {};
  if (!animate || REDUCED.matches || !/[0-9]/.test(text)) { el.textContent = text; return; }
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.className = 'roller';
  vis.setAttribute('aria-hidden', 'true');
  const dw = digitWidths(el);
  let k = 0, lastStrip = null;
  for (const ch of text) {
    if (ch < '0' || ch > '9') {
      const s = document.createElement('span');
      s.className = 'rch';
      s.textContent = ch;
      vis.appendChild(s);
      continue;
    }
    const i = k++;
    const win = document.createElement('span');
    win.className = 'rwin';
    win.style.width = dw[+ch].toFixed(3) + 'em';
    const strip = document.createElement('span');
    strip.className = 'rstrip';
    strip.textContent = STRIP;
    strip.style.animation = 'r' + ch + ' ' + Math.round((850 + 150 * i) * speed) + 'ms ' +
      'cubic-bezier(0.12, 0.72, 0.16, 1) ' + Math.round((base + 45 * i) * speed) + 'ms both';
    win.appendChild(strip);
    vis.appendChild(win);
    lastStrip = strip;
  }
  el.append(sr, vis);
  /* the rightmost digit starts last and runs longest, so it stops last */
  const done = () => { if (el._roll === token) el.textContent = text; };
  lastStrip.addEventListener('animationend', done);
  lastStrip.addEventListener('animationcancel', done);
}

/* ================= result screen ================= */
let current = { type: 'empty' };
const stage = $('#stage');
/* the parts that take the shown country's band colour as --acc (see style.css) */
const ACC_HOSTS = ['.lang-bar', '.hud-head', '#stage', '#atlas', '#hundred'].map(s => $(s));

function flagChip(el, L) {
  el.className = 'chip' + (L ? '' : ' empty');
  el.textContent = '';
  if (!L) return;
  const img = new Image();
  img.src = 'assets/flags/' + L.iso2.toLowerCase() + '.svg';
  img.alt = S.flagOf(nm(L));
  img.decoding = 'async';
  img.onerror = () => {
    const s = document.createElement('span');
    s.className = 'chip-code';
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', img.alt);
    s.textContent = L.iso2;
    img.replaceWith(s);
  };
  el.appendChild(img);
}

/* font size by name length (Latin letters are narrower than Hangul or kana, so the limits are
   per language), then shrink if the name still overflows its box */
function nameClass(name) { const n = [...name].length, [a, b] = S.nameFit; return n <= a ? '' : n <= b ? 'n2' : 'n3'; }
function fitName() {
  fitTier();
  const el = $('#idName');
  el.style.fontSize = '';
  if (el.classList.contains('empty') || !el.clientWidth) return;
  let f = parseFloat(getComputedStyle(el).fontSize);
  const f0 = f, wrap = el.classList.contains('n3');
  const over = () => wrap ? el.scrollHeight > f * 1.12 * 2 + 2 : el.scrollWidth > el.clientWidth + 1;
  while (f > 18 && over()) { f -= 2; el.style.fontSize = f + 'px'; }
  if (f === f0) el.style.fontSize = '';
}
/* the tier name stays on one line: Least developed and Menos adelantado are shrunk to fit */
function fitTier() {
  const el = $('#vTier');
  el.style.fontSize = '';
  if (!el.clientWidth) return;
  let f = parseFloat(getComputedStyle(el).fontSize);
  while (f > 18 && el.scrollWidth > el.clientWidth + 1) { f -= 2; el.style.fontSize = f + 'px'; }
}

function tierDesc(L) {
  const T = tierStats(), t = tierOf(L), sov = L.sov ? BY.get(L.sov) : null;
  let s;
  if (L.code === 492) s = S.tdMonaco;
  else if (sov && (L.code === 184 || L.code === 570)) s = S.tdAssoc(nm(sov), sov.code);
  else if (sov) s = S.tdTerr(nm(sov), sov.code);
  else if (t === 'ADV') s = S.tdAdv(D.CLASS.adv.length);
  else if (t === 'LDC') s = S.tdLdc(T.count.LDC);
  else s = S.tdDev(T.count.DEV);
  const g = D.CLASS.ldc[L.sov || L.code];
  if (g && t === 'LDC') s += S.tdSoon(dateOf(g));
  else if (g && t === 'DEV') s += S.tdDone(dateOf(g));
  return s;
}

function setRank(id, r) {
  const el = $('#' + id);
  el.classList.toggle('off', r == null);
  el.querySelector('.bar').style.setProperty('--p', r == null ? '0' : r.toFixed(4));
}

function renderStage(st, opt = {}) {
  current = st;
  const animate = !!opt.animate && !REDUCED.matches, spd = opt.speed || 1;
  stage.style.setProperty('--spd', spd);
  stage.classList.remove('fx');
  const empty = st.type === 'empty', L = empty ? null : st.loc, draw = st.type === 'draw';
  const tier = empty ? 'NONE' : tierOf(L), band = empty ? 0 : L.band;
  const T = tierStats();
  ACC_HOSTS.forEach(el => { el.dataset.band = band; });

  /* identity */
  flagChip($('#chip'), L);
  $('#kindL').textContent = st.type === 'lookup' ? S.kindLookup : S.kindDraw;
  const no = $('#kindNo');
  if (draw) roll(no, S.serial(fmtInt(st.serial)), 0, spd, animate);
  else no.textContent = empty ? S.serialEmpty : '';
  const name = $('#idName');
  name.className = 'id-name' + (empty ? ' empty' : ' ' + nameClass(nm(L)));
  name.textContent = empty ? S.emptyName : nm(L);
  const sex = empty ? '' : draw ? sexName(st.sex) : S.both;
  $('#idSex').textContent = sex;
  $('#idEn').textContent = empty ? '' : nmSub(L);
  $('#idEn').className = 'id-en fx-sm';
  $('#idGeo').innerHTML = empty ? '' : esc(subName(L.sub)) + '<span class="coord">' + coordText(L.lat, L.lng) + '</span>';
  $('#idGeo').className = 'id-geo fx-sm';
  $('#copyBtn').hidden = empty;
  const dash = '—';
  const fact = (dt, dd, sm) => '<div class="fact"><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + (sm ? '<small class="fx-sm">' + esc(sm) + '</small>' : '') + '</dd></div>';
  $('#facts').innerHTML = empty
    ? fact(S.fSex, dash) + fact(S.fPop, dash) + fact(S.fMed, dash) + fact(S.fTfr, dash)
    : fact(S.fSex, sex, S.srb(fmtInt(L.srb * 100))) +
      fact(S.fPop, people(L.pop), S.ofWorld(fmtPct(L.pop / TOT.pop))) +
      fact(S.fMed, S.years(fx(L.med, 1)), S.world(S.years(fx(WR.med, 1)))) +
      fact(S.fTfr, S.kids(fx(L.tfr, 2)), S.world(S.kids(fx(WR.tfr, 2))));

  /* read-outs */
  const bl = $('#tierBarL'), ll = $('#ladderL');
  $('#rungs').querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k === band - 1));
  ll.className = 'ladder-l fx-sm';
  ll.innerHTML = empty ? '' : band ? '<b>' + esc(S.bandNo(band, NBANDS)) + '</b> · ' + esc(bandName(band)) : esc(S.noData);
  if (empty) {
    ['vProb', 'vGdp', 'vLife', 'vTier'].forEach(id => { $('#' + id).textContent = dash; $('#' + id).classList.remove('na'); });
    ['sProb', 'sGdp', 'nGdp', 'wGdp', 'kGdp', 'wLife', 'kLife', 'dTier', 'sTier', 'fLife'].forEach(id => { $('#' + id).textContent = ''; });
    setRank('rGdp', null); setRank('rLife', null);
    $('#pips').querySelectorAll('i').forEach(i => i.classList.remove('on'));
    $('#tierBar').innerHTML = '';
    bl.innerHTML = '';
  } else {
    const M = metrics(st);
    roll($('#vProb'), fmtPct(M.share), 80, spd, animate);
    $('#sProb').textContent = oneIn(M.share);
    $('#sProb').className = 'p-sub fx-sm';

    const vg = $('#vGdp'), sg = $('#sGdp');
    $('#wGdp').textContent = S.world(usd(WR.gdpN));
    if (M.gdp.v == null) {
      vg.classList.add('na');
      vg.textContent = S.noData;
      $('#nGdp').textContent = '';
      sg.className = 'p-sub memo fx-sm';
      const nNa = LOCS.filter(l => l.gdpN == null).length;
      sg.textContent = S.gdpNa(nNa, L.gdp == null ? '' : intl(L.gdp) + (L.gdpNote ? S.paren(note(L.gdpNote)) : ''));
      setRank('rGdp', null);
      $('#kGdp').textContent = '';
    } else {
      vg.classList.remove('na');
      roll(vg, usd(M.gdp.v), 150, spd, animate);
      $('#nGdp').textContent = S.gdpLabel(note(L.gdpNNote));
      sg.className = 'p-sub fx-sm';
      sg.textContent = '';
      if (M.gdp.ppp == null) sg.textContent = S.noPpp;
      else {
        const n = document.createElement('span');
        n.className = 'num';
        sg.append(S.ppp[0], n, S.ppp[1] + (L.gdpNote && L.gdpNote !== L.gdpNNote ? S.paren(note(L.gdpNote)) : ''));
        roll(n, fmtInt(M.gdp.ppp), 220, spd, animate);
      }
      setRank('rGdp', M.gdp.r);
      $('#kGdp').textContent = rankText(M.gdp.r);
    }

    $('#pips').querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k < TIER_PIPS[tier]));
    $('#vTier').textContent = S.tier[tier];
    $('#dTier').textContent = tierDesc(L);
    $('#dTier').className = 'tier-desc fx-sm';
    $('#tierBar').innerHTML = TIERS.map(t => '<span class="' + lvCls(t) + (t === tier ? ' on' : '') + '" style="width:' + (T.share[t] * 100).toFixed(3) + '%"></span>').join('');
    bl.innerHTML = TIERS.map(t => '<span class="' + lvCls(t) + (t === tier ? ' on' : '') + '">' + S.tier[t] + ' ' + pctF(T.p2[t], 2) + '</span>').join('');
    $('#sTier').innerHTML = S.tierSayHtml(fx(T.p1[tier], 1));
    $('#sTier').className = 'tier-say fx-sm';

    const vl = $('#vLife');
    vl.textContent = '';
    const num = document.createElement('span');
    const unit = document.createElement('span');
    unit.className = 'unit';
    unit.textContent = S.lifeUnit;
    vl.append(num, unit);
    roll(num, fx(M.life.v, 1), 260, spd, animate);
    setRank('rLife', M.life.r);
    $('#wLife').textContent = S.world(S.years(fx(M.life.world, 1)));
    $('#kLife').textContent = rankText(M.life.r);
    $('#fLife').textContent = S.rankScope(draw ? st.sex : null);
  }

  fitName();
  if (animate) { void stage.offsetWidth; stage.classList.add('fx'); }
  PLANET.show(st, { animate, speed: spd });
}

function recordText(st) {
  const L = st.loc, draw = st.type === 'draw', M = metrics(st), c = S.comma, lines = [];
  lines.push('Birth Lottery: ' + (draw ? S.kindDraw + ' ' + S.serial(fmtInt(st.serial)) + c + today(st.t) : S.kindLookup + c + today()));
  lines.push(nm(L) + S.paren(subName(L.sub)) + c + (draw ? sexName(st.sex) : S.both));
  lines.push(S.kv(S.lbProb, fmtPct(M.share) + c + oneIn(M.share)));
  const ppp = L.gdp == null ? '' : S.paren(S.pppShort + ' ' + intl(L.gdp));
  lines.push(M.gdp.v == null
    ? S.kv(S.lbGdp, S.noData) + ppp + c + S.world(usd(WR.gdpN))
    : S.kv(S.lbGdp, usd(M.gdp.v)) + ppp + c + S.world(usd(WR.gdpN)) + c + rankText(M.gdp.r));
  lines.push(S.kv(S.lbTier, S.tier[tierOf(L)]));
  lines.push(S.kv(S.lbLife, S.years(fx(M.life.v, 1))) + c + S.world(S.years(fx(M.life.world, 1))) + c + rankText(M.life.r));
  return lines.join('\n');
}

async function copyText(t) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove();
    return ok;
  } catch (e) { return false; }
}
async function onCopy(ev) {
  const btn = ev.currentTarget;
  if (current.type === 'empty') return;
  const ok = await copyText(recordText(current));
  btn.textContent = ok ? S.copied : S.copyFail;
  announce(btn.textContent);
  setTimeout(() => { if (btn.isConnected) btn.textContent = S.copy; }, 1800);
}

/* ================= shared geography ================= */
/* The topology is decoded at start without d3: the planet draws from it straight away and the map
   waits for d3. Every piece is also kept with continuous longitudes (Russia and Fiji cross the date
   line, so a jump of more than 180 degrees is taken as a crossing), its bounding box, and its area
   and centre on an equal-area plane (longitude in radians, sine of latitude). */
const RAD = Math.PI / 180;
const GEO = { ready: false };
/* great-circle distance in radians between two [lon, lat] points */
function gdist(a, b) {
  const s1 = Math.sin((b[1] - a[1]) * RAD / 2), s2 = Math.sin((b[0] - a[0]) * RAD / 2);
  return 2 * Math.asin(Math.min(1, Math.sqrt(s1 * s1 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * s2 * s2)));
}
const vec3 = p => { const c = Math.cos(p[1] * RAD); return [c * Math.cos(p[0] * RAD), c * Math.sin(p[0] * RAD), Math.sin(p[1] * RAD)]; };
const lonLat = (x, y, z) => [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
function unwrap(ring) {
  let off = 0, prev = ring[0][0];
  return ring.map(p => {
    let x = p[0] + off;
    if (x - prev > 180) { off -= 360; x -= 360; } else if (x - prev < -180) { off += 360; x += 360; }
    prev = x;
    return [x, p[1]];
  });
}
const meanLon = r => r.reduce((s, p) => s + p[0], 0) / r.length;
function planePoly(coords) {
  const rings = coords.map(unwrap), m0 = meanLon(rings[0]);
  /* a hole goes with its outer ring */
  for (let i = 1; i < rings.length; i++) {
    const d = meanLon(rings[i]) - m0, o = d > 180 ? -360 : d < -180 ? 360 : 0;
    if (o) rings[i] = rings[i].map(p => [p[0] + o, p[1]]);
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of rings[0]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  let A = 0, Mx = 0, My = 0;
  rings.forEach((r, ri) => {
    let a = 0, mx = 0, my = 0;
    for (let i = 0, n = r.length; i < n; i++) {
      const p = r[i], q = r[(i + 1) % n], px = p[0] * RAD, py = Math.sin(p[1] * RAD), qx = q[0] * RAD, qy = Math.sin(q[1] * RAD);
      const c = px * qy - qx * py;
      a += c; mx += (px + qx) * c; my += (py + qy) * c;
    }
    /* whatever the winding, the outer ring counts positive and holes negative */
    const s = (a >= 0) === (ri === 0) ? 1 : -1;
    A += s * a / 2; Mx += s * mx / 6; My += s * my / 6;
  });
  let cen;
  if (A > 1e-12) cen = [Mx / A / RAD, Math.asin(Math.max(-1, Math.min(1, My / A))) / RAD];
  else {
    let x = 0, y = 0, z = 0;
    for (const p of rings[0]) { const v = vec3(p); x += v[0]; y += v[1]; z += v[2]; }
    cen = lonLat(x, y, z);
  }
  cen[0] = ((cen[0] + 540) % 360) - 180;
  return { rings, x0, x1, y0, y1, area: Math.max(0, A), cen, c: coords };
}
function initGeo() {
  if (GEO.ready || GEO.failed) return GEO.ready;
  try {
    const topo = JSON.parse($('#map-data').textContent);
    const fc = topoFeatures(topo, topo.objects.countries);
    fc.features.forEach(f => {
      f.code = f.properties && f.properties.id ? +f.properties.id : 0;
      const g = f.geometry;
      f._p = !g ? [] : (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(planePoly);
    });
    GEO.fc = fc;
    GEO.feats = fc.features;
    GEO.FEAT = new Map(GEO.feats.filter(f => f.code).map(f => [f.code, f]));
    GEO.ready = true;
  } catch (e) { GEO.failed = true; }
  return GEO.ready;
}
/* the main piece of a country plus the islands near it (drops far-flung territories); the centre is
   the area-weighted mean of the pieces' centres as 3-D vectors */
function emblemGeom(f) {
  if (f._em !== undefined) return f._em;
  if (!f._p.length) return (f._em = null);
  const items = f._p.slice().sort((a, b) => b.area - a.area), main = items[0];
  let R = 0;
  for (const pt of main.c[0]) R = Math.max(R, gdist(main.cen, pt));
  const thr = Math.max(10, 1.2 * R / RAD);
  const inc = items.filter(it => {
    const dd = gdist(main.cen, it.cen) / RAD;
    return dd <= thr || (it.area >= 0.2 * main.area && dd <= 30);
  });
  let x = 0, y = 0, z = 0;
  for (const it of inc) { const v = vec3(it.cen), w = it.area || 1e-12; x += v[0] * w; y += v[1] * w; z += v[2] * w; }
  f._em = { inc, c: lonLat(x, y, z), main: { type: 'Polygon', coordinates: main.c } };
  return f._em;
}
initGeo();

/* ================= planet ================= */
/* A dot-matrix globe on one canvas. The globe is a grid of cells, R across its radius. For a frame
   every cell is projected back to a longitude and latitude and looked up in a land raster (a world
   mask made once, and a finer window around the drawn country made per draw); the small cell image
   is then scaled up and cut into square dots. To make small countries visible the angle c from the
   centre is stretched to m*c before the orthographic wrap, so the visible cap shrinks to 90/m
   degrees. A draw flies the camera: pull back to the whole globe, turn, then zoom in.
   Frames are drawn only while something moves: 8 a second while the empty globe turns (and only
   while it is on screen), at most about 30 a second in flight, and none once the target is locked.
   Everything else (sphere, rings, brackets, read-outs) is static HTML and SVG; the two HUD rings
   turn as separate layers, so turning them never repaints the globe. */
const PLANET = (() => {
  const box = $('#planet');
  const CX = 360, CY = 300, RS = 196; // design box 720 x 600, globe radius in it
  const DOT_PITCH = 3.6; // CSS px from one dot to the next
  const STEPS = [0.5, 1, 2, 5, 10, 15, 20, 30];
  const halfRing = (k, front) => {
    const rx = 1.62 * RS * k, ry = 0.30 * RS * k;
    return 'M' + (CX - rx).toFixed(2) + ' ' + CY + 'A' + rx.toFixed(2) + ' ' + ry.toFixed(2) + ' 0 0 ' + (front ? 0 : 1) + ' ' + (CX + rx).toFixed(2) + ' ' + CY;
  };
  const ring = front => '<g transform="rotate(-16 ' + CX + ' ' + CY + ')"><path class="solid" d="' + halfRing(1, front) + '"/><path class="dash" d="' + halfRing(.9, front) + '"/></g>';
  const stops = list => list.map(([o, a]) => '<stop offset="' + o + '" class="stop-t" stop-opacity="' + a + '"/>').join('');
  const arc = (a0, a1, r) => {
    const p = a => [CX + r * Math.cos(a * RAD), CY + r * Math.sin(a * RAD)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  };
  /* each HUD ring is its own square SVG around its circle, the smallest layer that holds it */
  const square = (h, cls, inner) => '<svg class="p-spin ' + cls + '" viewBox="' + (CX - h) + ' ' + (CY - h) + ' ' + 2 * h + ' ' + 2 * h + '">' + inner + '</svg>';
  const txt = (x, y, s, cls, id) => '<span' + (cls ? ' class="' + cls + '"' : '') + (id ? ' id="' + id + '"' : '') + ' style="--x:' + x + ';--y:' + y + '">' + s + '</span>';
  box.innerHTML =
    '<svg class="p-ring back" viewBox="0 0 720 600"><defs><linearGradient id="pRingGrad" gradientUnits="userSpaceOnUse" x1="' + (CX - 1.62 * RS) + '" y1="' + CY + '" x2="' + (CX + 1.62 * RS) + '" y2="' + CY + '">' +
      stops([[0, 0], [.3, .55], [.7, .55], [1, 0]]) + '</linearGradient></defs>' + ring(false) + '</svg>' +
    '<div class="sphere"></div>' +
    '<canvas class="globe-dots"></canvas>' +
    '<svg class="p-ring front" viewBox="0 0 720 600">' + ring(true) + '</svg>' +
    square(224, 'p-hud-ring', '<circle cx="' + CX + '" cy="' + CY + '" r="' + (RS + 26) + '"/>') +
    square(238, 'p-hud-arcs', '<path d="' + [45, 135, 225, 315].map(a => arc(a - 11, a + 11, RS + 40)).join('') + '"/>') +
    '<i class="brk"></i><i class="brk tr"></i><i class="brk br"></i><i class="brk bl"></i>' +
    '<svg class="p-cross" viewBox="0 0 720 600"><circle cx="' + CX + '" cy="' + CY + '" r="7"/><path d="M' + CX + ' ' + (CY - 19) + 'v8M' + CX + ' ' + (CY + 11) + 'v8M' + (CX - 19) + ' ' + CY + 'h8M' + (CX + 11) + ' ' + CY + 'h8"/></svg>' +
    '<div class="p-hud">' + txt(112, 62, 'TARGET') + txt(112, 84, 'LAT --.--', 'hl', 'hudLat') + txt(112, 104, 'LNG --.--', 'hl', 'hudLng') +
      txt(112, 124, 'ZOOM ×1.0', '', 'hudZoom') + txt(608, 540, 'STANDBY', 'end p-status', 'hudStatus') + txt(608, 560, 'NO SIGNAL', 'end', 'hudCode') + '</div>';
  const cv = $('canvas', box), ctx = cv.getContext('2d'), sphere = $('.sphere', box), cross = $('.p-cross', box);
  const brks = Array.from(box.querySelectorAll('.brk'));
  const hud = { lat: $('#hudLat'), lng: $('#hudLng'), zoom: $('#hudZoom'), status: $('#hudStatus'), code: $('#hudCode') };
  /* the cell image is drawn at one pixel per cell here, then scaled up onto the page canvas */
  const cellCv = document.createElement('canvas'), cellCtx = cellCv.getContext('2d');

  /* ---- colours: one hue, the drawn country's GDP band; brightness is carried by alpha alone ---- */
  const hexRGB = s => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim()); const n = m ? parseInt(m[1], 16) : 0x76829C; return [n >> 16, (n >> 8) & 255, n & 255]; };
  const BAND_RGB = (() => {
    const cs = getComputedStyle(document.documentElement);
    return Array.from({ length: NBANDS + 1 }, (_, b) => hexRGB(cs.getPropertyValue('--band-' + b)));
  })();
  const toWhite = (c, t) => c.map(v => Math.round(v + (255 - v) * t));
  /* a cell is written as one 32-bit RGBA word: colour bits here, alpha added per cell */
  const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const word = c => LE ? (c[2] << 16 | c[1] << 8 | c[0]) : (c[0] << 24 | c[1] << 16 | c[2] << 8) >>> 0;
  const ASH = LE ? 24 : 0;
  let COL = null, WORD = null; // [land, drawn country, its border] as RGB and as words
  /* the top band's platinum is already near white, so the whitened country hardly stands out from the
     land by colour; there the rest of the land is dimmed instead (LK scales its alpha) */
  const LAND_DIM = 0.55;
  let LK = 1;
  function setBand(b) {
    const c = BAND_RGB[b] || BAND_RGB[0];
    COL = [c, toWhite(c, .10), toWhite(c, .50)];
    WORD = COL.map(word);
    LK = b === NBANDS ? LAND_DIM : 1;
  }
  setBand(0);

  /* ---- land rasters ---- */
  /* an equirectangular grid of lon0 +- hw by lat0 +- hh: 0 sea, 1 land, 2 the drawn country (painted
     last, so it wins along shared borders). Each country is one even-odd fill, so lakes and enclaves
     stay open; a piece is drawn again 360 degrees over when its box reaches across the edge. */
  function rasterize(W, H, lon0, lat0, hw, hh, code) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const sx = W / (2 * hw), sy = H / (2 * hh), X0 = lon0 - hw, X1 = lon0 + hw, Y0 = lat0 - hh, Y1 = lat0 + hh;
    const fill = (f, col) => {
      let any = false;
      g.beginPath();
      for (const p of f._p) {
        if (p.y1 < Y0 || p.y0 > Y1) continue;
        for (const o of [-360, 0, 360]) {
          if (p.x1 + o < X0 || p.x0 + o > X1) continue;
          any = true;
          for (const r of p.rings) {
            for (let i = 0; i < r.length; i++) {
              const x = (r[i][0] + o - X0) * sx, y = (Y1 - r[i][1]) * sy;
              if (i) g.lineTo(x, y); else g.moveTo(x, y);
            }
            g.closePath();
          }
        }
      }
      if (any) { g.fillStyle = col; g.fill('evenodd'); }
    };
    for (const f of GEO.feats) if (f.code !== code) fill(f, '#F00');
    const tf = GEO.FEAT.get(code);
    if (tf) fill(tf, '#0F0');
    const d = g.getImageData(0, 0, W, H).data, v = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < v.length; i++, j += 4) v[i] = d[j + 1] > 110 ? 2 : d[j] > 110 ? 1 : 0;
    return { W, H, lon0, lat0, hw, hh, sx, sy, v, code };
  }
  let world = null, win = null;
  function localRaster(t) {
    const hh = Math.min(90, 1.3 * (90 / t.m) + 0.5), hw = Math.min(180, hh / Math.max(0.15, Math.cos(t.lat * RAD)));
    const S = Math.max(256, Math.min(720, 8 * R));
    if (!win || win.code !== t.code || win.W !== S) win = rasterize(S, S, t.lon, t.lat, hw, hh, t.code);
  }

  /* where to look and how much to magnify for a place */
  const tcache = new Map();
  function targetFor(code) {
    if (tcache.has(code)) return tcache.get(code);
    const L = BY.get(code), f = GEO.FEAT.get(code), em = f ? emblemGeom(f) : null;
    let t;
    if (!em || em.main.coordinates[0].length < 10) {
      /* no outline, or one drawn with a handful of points: a marker at the listed position */
      t = { code, lon: L.lng, lat: L.lat, m: 22, dot: true };
    } else {
      let cmax = 0;
      for (const it of em.inc) for (const pt of it.c[0]) cmax = Math.max(cmax, gdist(em.c, pt));
      t = { code, lon: em.c[0], lat: em.c[1], m: Math.min(22, Math.max(1, 52 / (cmax / RAD))), dot: false };
    }
    tcache.set(code, t);
    return t;
  }

  /* ---- the cell grid ---- */
  let R = 0, K = 0, N = 0, dpr = 1, u = 1;
  let G = null, img = null, pattern = null;
  /* per cell, once: asin(rho), bearing (north up), row, and the land and country alpha under the light
     (the alphas are kept by grid position, the rest by cell number) */
  function buildGrid() {
    N = 2 * R + 4;
    const h = N / 2, NN = N * N, idx = [], asr = [], sb = [], cb = [], row = [], aL = new Uint8Array(NN), aC = new Uint8Array(NN);
    const ln = Math.hypot(-0.55, 0.6, 0.58), lx = -0.55 / ln, ly = 0.6 / ln, lz = 0.58 / ln;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5 - h) / R, y = (h - j - 0.5) / R, r = Math.hypot(x, y);
      if (r > 1) continue;
      const z = Math.sqrt(1 - r * r), lit = Math.max(0, x * lx + y * ly + z * lz) * 0.8 + 0.2 * z, p = j * N + i;
      idx.push(p); asr.push(Math.asin(r)); sb.push(r ? x / r : 0); cb.push(r ? y / r : 1); row.push(j);
      aL[p] = Math.round(255 * (0.10 + 0.38 * lit)); aC[p] = Math.round(255 * (0.82 + 0.18 * lit));
    }
    const n = idx.length;
    G = {
      n, idx: Int32Array.from(idx), asr: Float64Array.from(asr), sb: Float64Array.from(sb), cb: Float64Array.from(cb),
      row: Int16Array.from(row), aL, aC, pm: 0, pl: NaN, step: 30,
      lat: new Float64Array(n), rl: new Float64Array(n), wy: new Int32Array(n),
      val: new Uint8Array(NN), near: new Uint8Array(NN), kla: new Int16Array(NN).fill(-1), klo: new Int16Array(NN).fill(-1)
    };
    cellCv.width = cellCv.height = N;
    img = cellCtx.createImageData(N, N);
    G.px = new Uint32Array(img.data.buffer);
    cv.width = cv.height = N * K;
    pattern = dotPattern(K);
  }
  /* latitude, longitude east of the centre, world-mask row and graticule band of every cell for one
     tilt and zoom. While the empty globe turns these stay put, so a frame only adds the centre longitude. */
  function project(v) {
    if (G.pm === v.m && G.pl === v.lat) return;
    G.pm = v.m; G.pl = v.lat;
    const { n, idx, asr, sb, cb, lat, rl, wy, kla } = G, m = v.m, s0 = Math.sin(v.lat * RAD), c0 = Math.cos(v.lat * RAD);
    const vis = Math.min(90, 90 / m), step = G.step = STEPS.find(s => vis / s <= 6) || 30;
    for (let q = 0; q < n; q++) {
      const c = asr[q] / m, sc = Math.sin(c), cc = Math.cos(c);
      const sl = s0 * cc + c0 * sc * cb[q], la = Math.asin(sl) / RAD;
      lat[q] = la;
      rl[q] = Math.atan2(sb[q] * sc * c0, cc - s0 * sl) / RAD;
      wy[q] = Math.min(511, Math.floor((90 - la) * 512 / 180)) * 1024;
      kla[idx[q]] = Math.floor((la + 90) / step);
    }
  }
  /* a k x k tile holding one square dot, 0.62k wide, with its edge pixels partly covered */
  function dotPattern(k) {
    const t = document.createElement('canvas');
    t.width = t.height = k;
    const tc = t.getContext('2d'), id = tc.createImageData(k, k), a = k * 0.19, b = k * 0.81;
    const cov = i => Math.max(0, Math.min(i + 1, b) - Math.max(i, a));
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
      const o = (y * k + x) * 4;
      id.data[o] = id.data[o + 1] = id.data[o + 2] = 255;
      id.data[o + 3] = Math.round(255 * cov(x) * cov(y));
    }
    tc.putImageData(id, 0, 0);
    return ctx.createPattern(t, 'repeat');
  }

  /* screen cell of a place for view v, or null when it is on the far side */
  function cellOf(lon, lat, v) {
    const c = gdist([v.lon, v.lat], [lon, lat]);
    if (c * v.m >= Math.PI / 2) return null;
    const f0 = v.lat * RAD, f = lat * RAD, dl = (lon - v.lon) * RAD;
    const b = Math.atan2(Math.sin(dl) * Math.cos(f), Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(dl));
    const r = Math.sin(v.m * c);
    return [Math.floor(N / 2 + r * Math.sin(b) * R), Math.floor(N / 2 - r * Math.cos(b) * R)];
  }

  /* one frame into img; returns the number of cells of the drawn country. One pass looks every cell up
     and colours it as if nothing were near the drawn country; a second pass over that country alone
     then brightens its rim and the cells one and two steps from it (diagonals count). */
  let locked = false, blip = false;
  const inCountry = [], ring1 = [], ring2 = [];
  function compute(v, scan) {
    project(v);
    const { n, idx, lat, rl, wy, aL, aC, row, val, near, kla, klo, step, px } = G;
    const Wm = world.v, w = win;
    /* longitudes are handled as lon + 180 in 0..360 */
    let lon0 = v.lon + 180, wl0 = 0;
    lon0 -= 360 * Math.floor(lon0 / 360);
    if (w) { wl0 = w.lon0 + 180; wl0 -= 360 * Math.floor(wl0 / 360); }
    const wv = w ? w.v : null, wW = w ? w.W : 0, wH = w ? w.H : 0, whw = w ? w.hw : 0, wh2 = w ? 2 * w.hh : 0;
    const wtop = w ? w.lat0 + w.hh : 0, wsx = w ? w.sx : 0, wsy = w ? w.sy : 0;
    const inv = 1 / step, XW = 1024 / 360, wL = WORD[0], wT = WORD[1], wB = WORD[2], lk = LK;
    /* the scan line: rows within 2.5 cells of it */
    const sr = scan >= 0 ? (scan % 1100) / 1100 * N : -99, r0 = sr - 3, r1 = sr + 2;
    const put = (p, c, a) => { px[p] = (c | (a > 255 ? 255 : a) << ASH) >>> 0; };
    px.fill(0);
    inCountry.length = 0;
    for (let q = 0; q < n; q++) {
      const p = idx[q];
      let lw = rl[q] + lon0;
      if (lw >= 360) lw -= 360; else if (lw < 0) lw += 360;
      const ko = (lw * inv) | 0;
      klo[p] = ko;
      let x = -1;
      if (wv) {
        let dl = lw - wl0;
        if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
        const dy = wtop - lat[q];
        if (dl > -whw && dl < whw && dy >= 0 && dy < wh2) x = wv[Math.min(wH - 1, (dy * wsy) | 0) * wW + Math.min(wW - 1, ((dl + whw) * wsx) | 0)];
      }
      if (x < 0) x = Wm[wy[q] + ((lw * XW) | 0)];
      val[p] = x;
      let a = 0, c = wL;
      if (x === 1) a = aL[p] * lk | 0;
      else if (x === 2) { a = aC[p]; c = wT; inCountry.push(p); }
      else {
        /* graticule, sea only: a cell is on a line when the cell to its left or above lies in another
           band of latitude (or longitude), so every line is one dot wide however it crosses the grid;
           no meridians beyond 84 degrees, where they crowd together */
        const k = kla[p], kl = kla[p - 1], ku = kla[p - N];
        if ((kl >= 0 && kl !== k) || (ku >= 0 && ku !== k)) a = 24;
        else if (lat[q] < 84 && lat[q] > -84) {
          const ol = klo[p - 1], ou = klo[p - N];
          if ((ol >= 0 && ol !== ko) || (ou >= 0 && ou !== ko)) a = 24;
        }
      }
      if (row[q] > r0 && row[q] < r1) a += 60;
      put(p, c, a);
    }
    const count = inCountry.length;
    if (count) {
      /* near: 1 the country, 2 next to it, 3 two away; cleared again below. Outside the disc kla is -1. */
      ring1.length = ring2.length = 0;
      for (const p of inCountry) near[p] = 1;
      const spread = (from, to, mark) => {
        for (const p of from) for (let dj = -N; dj <= N; dj += N) for (let di = -1; di <= 1; di++) {
          const r = p + dj + di;
          if (!near[r] && kla[r] >= 0) { near[r] = mark; to.push(r); }
        }
      };
      spread(inCountry, ring1, 2);
      spread(ring1, ring2, 3);
      const lit = (p, a) => { const j = (p / N) | 0; return j > r0 && j < r1 ? a + 60 : a; };
      for (const p of inCountry) if (val[p - 1] !== 2 || val[p + 1] !== 2 || val[p - N] !== 2 || val[p + N] !== 2) put(p, wB, 255);
      for (const p of ring1) put(p, wL, lit(p, val[p] === 1 ? (aL[p] * lk | 0) + 40 : 92));
      for (const p of ring2) put(p, wL, lit(p, val[p] === 1 ? (aL[p] * lk | 0) + 18 : 46));
      for (const p of inCountry) near[p] = 0;
      for (const p of ring1) near[p] = 0;
      for (const p of ring2) near[p] = 0;
    }
    return count;
  }
  /* a place too small to show its outline: a five-cell cross, white in the middle, with a dot four
     cells out on each side */
  function marker(v) {
    const at = cellOf(target.lon, target.lat, v);
    if (!at) return;
    const d = img.data, cB = COL[2];
    const put = (i, j, c) => {
      if (i < 0 || j < 0 || i >= N || j >= N) return;
      const o = (j * N + i) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    };
    const [i, j] = at;
    for (let k = -2; k <= 2; k++) { put(i + k, j, cB); put(i, j + k, cB); }
    put(i - 4, j, cB); put(i + 4, j, cB); put(i, j - 4, cB); put(i, j + 4, cB);
    put(i, j, [255, 255, 255]);
  }
  function output(data) {
    cellCtx.putImageData(data, 0, 0);
    const s = N * K;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(cellCv, 0, 0, s, s);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'source-over';
  }
  function render(v, scan = -1) {
    if (!N || !GEO.ready) return;
    if (!world) world = rasterize(1024, 512, 0, 0, 180, 90, -1);
    const count = compute(v, scan);
    if (locked) blip = count < 6;
    if (target && (target.dot || (locked && blip))) marker(v);
    output(img);
    const lon = ((v.lon % 360) + 540) % 360 - 180;
    hud.lat.textContent = 'LAT ' + Math.abs(v.lat).toFixed(2) + '°' + (v.lat >= 0 ? 'N' : 'S');
    hud.lng.textContent = 'LNG ' + Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');
    hud.zoom.textContent = 'ZOOM ×' + v.m.toFixed(1);
  }
  /* the lock-on flicker: four bands of 1-3 rows pushed 1-3 cells sideways, for one frame */
  function glitch() {
    const src = img.data, g = new ImageData(new Uint8ClampedArray(src), N, N), d = g.data;
    for (let b = 0; b < 4; b++) {
      const h = 1 + Math.floor(Math.random() * 3), y0 = Math.floor(Math.random() * (N - h));
      const s = (1 + Math.floor(Math.random() * 3)) * (Math.random() < 0.5 ? -1 : 1);
      for (let y = y0; y < y0 + h; y++) for (let x = 0; x < N; x++) {
        const sx = x - s, o = (y * N + x) * 4;
        if (sx < 0 || sx >= N) { d[o + 3] = 0; continue; }
        const so = (y * N + sx) * 4;
        d[o] = src[so]; d[o + 1] = src[so + 1]; d[o + 2] = src[so + 2]; d[o + 3] = src[so + 3];
      }
    }
    output(g);
  }

  /* ---- size and place: whole device pixels per dot, the canvas on the device pixel grid ---- */
  let bk = 1.6;
  function brackets(k) {
    bk = k;
    const dd = 100 * k * u, s = 26 * u, at = [[-dd, -dd], [dd - s, -dd], [dd - s, dd - s], [-dd, dd - s]];
    brks.forEach((b, i) => { b.style.transform = 'translate(' + at[i][0].toFixed(2) + 'px,' + at[i][1].toFixed(2) + 'px)'; });
    box.classList.toggle('wide', k > 1.2);
  }
  function layout() {
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return false;
    dpr = window.devicePixelRatio || 1;
    u = W / 720;
    box.style.setProperty('--u', u + 'px');
    const k = Math.max(3, Math.round(DOT_PITCH * dpr)), r = Math.max(8, Math.round(W * (2 * RS / 720) * dpr / (2 * k)));
    const rebuilt = k !== K || r !== R;
    if (rebuilt) { K = k; R = r; buildGrid(); }
    const rc = box.getBoundingClientRect(), ox = rc.left + window.scrollX, oy = rc.top + window.scrollY, side = N * K;
    const left = Math.round((ox + W / 2) * dpr - side / 2) / dpr - ox, top = Math.round((oy + H / 2) * dpr - side / 2) / dpr - oy;
    const px = x => x.toFixed(3) + 'px';
    Object.assign(cv.style, { left: px(left), top: px(top), width: px(side / dpr), height: px(side / dpr) });
    Object.assign(sphere.style, { left: px(left + 2 * K / dpr), top: px(top + 2 * K / dpr), width: px(2 * R * K / dpr), height: px(2 * R * K / dpr) });
    brackets(bk);
    return rebuilt;
  }

  /* ---- states ---- */
  let view = null, target = null, raf = 0, idleT = 0, glitchT = 0, idling = false, visible = true;
  /* kept as a flag: reading the media query right after the read-outs change would force a style pass */
  let reduced = REDUCED.matches;
  const status = (s, hl) => { hud.status.textContent = s; hud.status.classList.toggle('hl', !!hl); };
  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    clearTimeout(idleT); idleT = 0;
    clearTimeout(glitchT); glitchT = 0;
    idling = false;
  }
  function lock(animate) {
    locked = true;
    status('TARGET LOCKED', true);
    brackets(0.42);
    cross.style.opacity = '';
    render(view);
    if (animate && !reduced) {
      glitch();
      glitchT = setTimeout(() => { glitchT = 0; output(img); }, 110);
    }
  }

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  /* great-circle path between two [lon, lat] points, as d3.geoInterpolate */
  function interp(a, b) {
    const d = gdist(a, b), k = Math.sin(d);
    if (d < 1e-9 || k < 1e-9) return () => [b[0], b[1]];
    const A0 = vec3(a), B0 = vec3(b);
    return t => {
      const p = Math.sin(d - t * d) / k, q = Math.sin(t * d) / k;
      return lonLat(p * A0[0] + q * B0[0], p * A0[1] + q * B0[1], p * A0[2] + q * B0[2]);
    };
  }
  function fly(t, dur) {
    const from = view || { lon: t.lon + 75, lat: 14, m: 1 };
    const far = gdist([from.lon, from.lat], [t.lon, t.lat]) > 0.03;
    const rot = interp([from.lon, from.lat], [t.lon, t.lat]);
    const zOut = far && from.m > 1.05 ? 0.3 : 0;
    const lf = Math.log(from.m), lt = Math.log(t.m);
    status('SCANNING');
    brackets(1.6);
    cross.style.opacity = '.35';
    const t0 = performance.now();
    let drawn = -1e9;
    const step = now => {
      raf = 0;
      const p = clamp01((now - t0) / dur);
      if (p >= 1) { view = { lon: t.lon, lat: t.lat, m: t.m }; lock(true); return; }
      raf = requestAnimationFrame(step);
      /* about 30 frames a second, whatever the display rate */
      if (now - drawn < 31) return;
      drawn = now;
      let m, r;
      if (!far) { m = Math.exp(lf + (lt - lf) * ease(p)); r = ease(p); }
      else {
        if (p < zOut) m = Math.exp(lf * (1 - ease(p / zOut)));
        else if (p < 0.55) m = 1;
        else m = Math.exp(lt * ease((p - 0.55) / 0.45));
        r = ease(clamp01((p - zOut * 0.6) / (0.75 - zOut * 0.6)));
      }
      const c = rot(r);
      view = { lon: c[0], lat: c[1], m };
      if (p > 0.55) brackets(1.6 - 0.6 * ease((p - 0.55) / 0.45));
      render(view, now - t0);
    };
    raf = requestAnimationFrame(step);
  }

  /* the empty state: the world turning 0.75 degrees eight times a second, on screen only */
  const canSpin = () => idling && visible && !document.hidden && !reduced;
  function spin() {
    if (idleT || raf || !canSpin()) return;
    idleT = setTimeout(() => {
      idleT = 0;
      if (!canSpin()) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!canSpin()) return;
        view.lon = (view.lon + 0.75) % 360;
        render(view);
        spin();
      });
    }, 125);
  }
  function idle() {
    target = null;
    win = null;
    locked = false;
    view = view && view.m === 1 ? view : { lon: 20, lat: 14, m: 1 };
    status(GEO.ready ? 'STANDBY' : 'NO MAP DATA');
    hud.code.textContent = 'AWAITING DRAW';
    brackets(1.6);
    cross.style.opacity = '.35';
    render(view);
    idling = true;
    spin();
  }
  /* the HUD rings stop turning while the planet is off screen or the tab is hidden */
  function onScreen() {
    box.classList.toggle('still', !visible || document.hidden);
    spin();
  }
  document.addEventListener('visibilitychange', onScreen);
  if (REDUCED.addEventListener) REDUCED.addEventListener('change', () => { reduced = REDUCED.matches; onScreen(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; onScreen(); }).observe(box);

  function show(st, opt = {}) {
    stop();
    const empty = st.type === 'empty';
    setBand(empty ? 0 : st.loc.band);
    if (empty) { idle(); return; }
    const L = st.loc;
    hud.code.textContent = 'M49 ' + String(L.code).padStart(3, '0') + ' · ' + L.iso2;
    if (!GEO.ready) {
      target = null;
      locked = true;
      status('NO MAP DATA');
      brackets(0.42);
      cross.style.opacity = '';
      return;
    }
    target = targetFor(L.code);
    localRaster(target);
    locked = false;
    if (!opt.animate || reduced) {
      view = { lon: target.lon, lat: target.lat, m: target.m };
      lock(false);
      return;
    }
    /* fresh: come in from the whole globe, as if nothing had been on screen before */
    if (opt.fresh) view = null;
    fly(target, Math.round(2000 * (opt.speed || 1)));
  }

  /* after a resize the grid is rebuilt only if the dot size or the globe radius changed */
  let fitT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(fitT);
    fitT = setTimeout(() => {
      if (!layout() || !view) return;
      if (target) localRaster(target);
      if (!raf || idling) render(view);
    }, 150);
  });
  layout();
  return { show };
})();

/* ================= world map (needs d3) ================= */
const MAP = { ready: false };
let batchCounts = null, lastBatch = null;

function initMap() {
  if (MAP.ready) return;
  if (!GEO.ready || !window.d3) { mapFail(); return; }
  const d3 = window.d3, fc = GEO.fc, feats = GEO.feats, FEAT = GEO.FEAT;
  tierStats();

  const Wv = 1000;
  const proj = d3.geoEqualEarth().fitWidth(Wv - 24, fc);
  const path = d3.geoPath(proj);
  const b0 = path.bounds(fc), h0 = b0[1][1] - b0[0][1];
  proj.fitExtent([[12, 12], [Wv - 12, 12 + h0]], fc);
  const Hv = Math.ceil(h0 + 24);
  const svg = d3.select('#map').attr('viewBox', '0 0 ' + Wv + ' ' + Hv).style('aspect-ratio', Wv + ' / ' + Hv);
  svg.selectAll('*').remove();
  const zl = svg.append('g');
  zl.append('path').attr('class', 'grat').attr('d', path(d3.geoGraticule().step([30, 30])()));
  const lands = zl.append('g').selectAll('path').data(feats).join('path')
    .attr('class', f => 'land' + (BY.has(f.code) ? '' : ' nodata'))
    .attr('d', path)
    .attr('data-code', f => (BY.has(f.code) ? f.code : null));

  const pos = LOCS.map(l => proj([l.lng, l.lat]));
  const maxB = d3.max(LOCS, l => l.births);
  const rBase = LOCS.map(l => Math.max(1.1, 25 * Math.sqrt(l.births / maxB)));
  const order = LOCS.map(l => l.i).sort((a, b) => LOCS[b].births - LOCS[a].births);
  const bub = zl.append('g').selectAll('circle').data(order).join('circle')
    .attr('class', i => 'bubble b-' + LOCS[i].band)
    .attr('cx', i => pos[i][0]).attr('cy', i => pos[i][1])
    .attr('r', i => rBase[i])
    .attr('data-code', i => LOCS[i].code);
  const batchG = zl.append('g');
  const pinG = zl.append('g').attr('display', 'none');
  const pinCross = pinG.append('path').attr('class', 'pin-cross');
  const pinRing = pinG.append('circle').attr('class', 'pin-ring').attr('r', 8);
  const pinDot = pinG.append('circle').attr('class', 'pin-dot').attr('r', 2.8);
  const crossD = k => 'M' + (-16 / k) + ' 0h' + (6 / k) + 'M' + (10 / k) + ' 0h' + (6 / k) + 'M0 ' + (-16 / k) + 'v' + (6 / k) + 'M0 ' + (10 / k) + 'v' + (6 / k);

  let K = 1, zt = d3.zoomIdentity, visible = true;
  const resetBtn = $('#resetMap');
  function rescale() {
    bub.attr('r', i => rBase[i] / K);
    pinRing.attr('r', 8 / K); pinDot.attr('r', 2.8 / K); pinCross.attr('d', crossD(K));
    batchG.selectAll('circle').attr('r', d => d.r / K);
  }
  const zoom = d3.zoom().on('zoom', ev => {
    const t = ev.transform;
    zl.attr('transform', t);
    K = t.k;
    zt = t;
    rescale();
    resetBtn.hidden = t.k < 1.001 && Math.abs(t.x) < 0.5 && Math.abs(t.y) < 0.5;
  });

  function targetFor(code) {
    const L = BY.get(code), p = proj([L.lng, L.lat]), f = FEAT.get(code), em = f ? emblemGeom(f) : null;
    let k = 6;
    if (em) {
      const b = path.bounds(em.main);
      const bw = Math.max(1, b[1][0] - b[0][0]), bh = Math.max(1, b[1][1] - b[0][1]);
      k = Math.max(1.6, Math.min(8, 0.42 / Math.max(bw / Wv, bh / Hv)));
    }
    let tx = Wv / 2 - k * p[0], ty = Hv / 2 - k * p[1];
    tx = Math.min(0, Math.max(Wv - Wv * k, tx));
    ty = Math.min(0, Math.max(Hv - Hv * k, ty));
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  }
  /* off screen there is nothing to watch, so the view jumps instead of easing for 1.1 s */
  function go(t) {
    svg.interrupt();
    if (REDUCED.matches || !visible) svg.call(zoom.transform, t);
    else svg.transition().duration(1100).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }
  MAP.fly = code => go(targetFor(code));
  MAP.reset = () => go(d3.zoomIdentity);
  resetBtn.addEventListener('click', () => MAP.reset());

  let pickedEl = null;
  MAP.pick = (code, fly) => {
    if (pickedEl) pickedEl.classList.remove('picked');
    pickedEl = lands.filter(f => f.code === code).node();
    if (pickedEl) pickedEl.classList.add('picked');
    const L = BY.get(code), p = proj([L.lng, L.lat]);
    pinG.attr('display', null).attr('transform', 'translate(' + p[0] + ',' + p[1] + ')');
    pinCross.attr('d', crossD(K));
    const ring = pinRing.node();
    ring.classList.remove('ping'); void ring.getBoundingClientRect(); ring.classList.add('ping');
    if (fly) MAP.fly(code);
  };
  MAP.unpick = () => {
    if (pickedEl) pickedEl.classList.remove('picked');
    pickedEl = null;
    pinG.attr('display', 'none');
  };
  MAP.showBatch = counts => {
    batchCounts = counts;
    const data = [...counts].map(([code, n]) => {
      const L = BY.get(code), p = proj([L.lng, L.lat]);
      return { code, n, x: p[0], y: p[1], r: 2 + 2.1 * Math.sqrt(n), b: L.band };
    }).sort((a, b) => b.n - a.n);
    batchG.selectAll('circle').data(data).join('circle').attr('class', d => 'bdot b-' + d.b)
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r / K).attr('data-code', d => d.code);
  };
  MAP.clearBatch = () => { batchCounts = null; batchG.selectAll('*').remove(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') tip.hidden = true; });

  /* tooltip + click */
  const tip = $('#tip'), wrap = $('#mapWrap');
  function codeAt(ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-code]') : null;
    return el ? +el.getAttribute('data-code') : 0;
  }
  svg.on('pointermove', ev => {
    if (ev.pointerType === 'touch') return;
    const code = codeAt(ev), L = BY.get(code);
    if (!L) { tip.hidden = true; return; }
    const r = wrap.getBoundingClientRect();
    let h = '<b>' + esc(nm(L)) + '</b> <span class="tt">' + S.tier[L.tier] + '</span><br>' +
      S.kv(esc(S.lbGdp), '<span class="t b-' + L.band + '">' + esc(bandName(L.band)) + '</span>') + '<br>' + esc(S.kv(S.births2026, people(L.births))) +
      '<br>' + esc(S.kv(S.lbProb, fmtPct(L.births / TOT.births)));
    if (batchCounts && batchCounts.has(code)) h += '<br>' + esc(S.tipBatch(fmtInt(batchCounts.get(code))));
    tip.innerHTML = h;
    tip.hidden = false;
    const x = ev.clientX - r.left, half = tip.offsetWidth / 2 + 4;
    tip.style.left = Math.min(Math.max(x, half), r.width - half) + 'px';
    tip.style.top = (ev.clientY - r.top) + 'px';
    tip.classList.toggle('below', ev.clientY - r.top < tip.offsetHeight + 24);
  }).on('pointerleave', () => { tip.hidden = true; })
    .on('click', ev => { const code = codeAt(ev); if (BY.has(code)) { tip.hidden = true; lookup(code); } });

  /* ambient births at the real rate, drawn on a canvas laid over the map (at most about 30 frames a
     second, and only while the map is on screen), so they never make the map SVG repaint */
  const pcv = document.createElement('canvas'), pctx = pcv.getContext('2d');
  pcv.className = 'pulses';
  pcv.setAttribute('aria-hidden', 'true');
  wrap.appendChild(pcv);
  const LIFE = 1700;
  let pulses = [], pulseT = 0, pulseRaf = 0, drawn = 0, ps = 1, pdpr = 1;
  function sizePulses() {
    const r = svg.node().getBoundingClientRect(), rw = wrap.getBoundingClientRect();
    pdpr = Math.min(window.devicePixelRatio || 1, 2);
    ps = r.width / Wv;
    pcv.width = Math.max(1, Math.round(r.width * pdpr));
    pcv.height = Math.max(1, Math.round(r.height * pdpr));
    Object.assign(pcv.style, { left: (r.left - rw.left) + 'px', top: (r.top - rw.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  function allowed() { return visible && !document.hidden && !REDUCED.matches; }
  function clearPulses() {
    pulses = [];
    cancelAnimationFrame(pulseRaf); pulseRaf = 0;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, pcv.width, pcv.height);
  }
  function drawPulses(now) {
    pulseRaf = 0;
    if (!allowed()) { clearPulses(); return; }
    pulseRaf = requestAnimationFrame(drawPulses);
    if (now - drawn < 31) return;
    drawn = now;
    pulses = pulses.filter(p => now - p.t0 < LIFE);
    const s = ps * pdpr, k = s * zt.k;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, pcv.width, pcv.height);
    if (!pulses.length) { cancelAnimationFrame(pulseRaf); pulseRaf = 0; return; }
    pctx.setTransform(k, 0, 0, k, s * zt.x, s * zt.y);
    pctx.fillStyle = '#EAF2FF';
    for (const p of pulses) {
      const t = Math.max(0, (now - p.t0) / LIFE), e = 1 - (1 - t) * (1 - t);
      pctx.globalAlpha = 0.9 * (1 - e);
      pctx.beginPath();
      pctx.arc(p.x, p.y, 2.3 / K * (0.35 + 1.55 * e), 0, 2 * Math.PI);
      pctx.fill();
    }
    pctx.globalAlpha = 1;
  }
  function spawn() {
    if (pulses.length >= 48) return;
    const i = pickCum(CUM.births, Math.random());
    const rr = rBase[i] * 0.72 / K * Math.sqrt(Math.random()), th = Math.random() * 2 * Math.PI;
    pulses.push({ x: pos[i][0] + rr * Math.cos(th), y: pos[i][1] + rr * Math.sin(th), t0: performance.now() });
    if (!pulseRaf) pulseRaf = requestAnimationFrame(drawPulses);
  }
  function schedule() {
    clearTimeout(pulseT);
    if (!allowed()) { clearPulses(); return; }
    pulseT = setTimeout(() => { spawn(); schedule(); }, -Math.log(1 - Math.random()) / RATE_B * 1000);
  }
  document.addEventListener('visibilitychange', schedule);
  if (REDUCED.addEventListener) REDUCED.addEventListener('change', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; schedule(); }).observe(svg.node());
  }
  let sizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(sizeT); sizeT = setTimeout(sizePulses, 150); });
  sizePulses();
  schedule();

  MAP.ready = true;
  if (current.type !== 'empty') MAP.pick(current.loc.code, false);
  if (lastBatch && !$('#batch').hidden) MAP.showBatch(lastBatch);
}

function mapFail() {
  const msg = $('#mapMsg');
  msg.textContent = S.mapFail;
  msg.hidden = false;
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ================= page text ================= */
function renderIntro() {
  $('#lede').innerHTML = S.ledeHtml(big(WR.births, 4));
  $('#atlasLede').textContent = S.atlasLede;
  $('#legend').textContent = S.legend;
  $('#map').setAttribute('aria-label', S.mapAria);
  /* the nine bands then no data; a range may break after its dash */
  const keys = $('#keys');
  keys.innerHTML = BAND_LIST.map(b => '<li class="b-' + b + '"><i aria-hidden="true"></i><span>' + esc(bandName(b)).replace('–', '–<wbr>') + '</span></li>').join('');
  keys.setAttribute('aria-label', S.keysAria);
  $('#live').innerHTML = '<span class="rate">' + S.liveB + '<b>' + fx(RATE_B, 1) + '</b></span><span class="rate">' + S.liveD + '<b>' + fx(RATE_D, 1) + '</b></span>' +
    '<span><span class="dot" aria-hidden="true"></span><span class="since">' + S.liveSince + '</span><b id="liveN">0</b>' + S.liveAfter + '</span>';
}
const T0 = performance.now();
function tickLive() {
  $('#liveN').textContent = fmtInt(Math.floor((performance.now() - T0) / 1000 * RATE_B));
}

function renderMethod() {
  const T = tierStats(), C = D.CLASS;
  const now = new Date();
  const dated = Object.entries(C.ldc).filter(([, d]) => d).sort((a, b) => a[1].localeCompare(b[1]) || nm(BY.get(+a[0])).localeCompare(nm(BY.get(+b[0])), S.locale));
  const past = dated.filter(([, d]) => now >= new Date(d + 'T00:00:00Z')), next = dated.filter(([, d]) => now < new Date(d + 'T00:00:00Z'));
  const list = xs => xs.map(([c, d]) => S.gradItem(nm(BY.get(+c)), dateOf(d))).join(S.comma);
  const g = [next.length ? S.gradSoon(list(next)) : '', past.length ? S.gradDone(list(past)) : ''].filter(Boolean).join(S.sp);
  $('#tierRules').textContent = S.tierRules(today());
  $('#tierList').innerHTML = S.tierListHtml({
    advN: C.adv.length, ldcN: Object.keys(C.ldc).length, count: T.count, grad: esc(g),
    pct: { ADV: pctF(T.p2.ADV, 2), DEV: pctF(T.p2.DEV, 2), LDC: pctF(T.p2.LDC, 2) }
  });
}

/* ================= 100 people ================= */
function renderHundred() {
  const tot = TOT.births, T = tierStats();
  const shares = CONT.map(() => 0);
  LOCS.forEach(l => { shares[l.cont] += l.births / tot; });
  const exact = shares.map(s => s * 100), cells = largestRemainder(exact, 100);
  const order = CONT.map((_, i) => i).sort((a, b) => exact[b] - exact[a]);
  const named = order.filter(ci => cells[ci] > 0);
  const [a, b] = named, rest = named.slice(2);
  $('#hLede').textContent = S.hundredLede({
    first: [contName(a), cells[a], a], second: [contName(b), cells[b], b],
    rest: rest.map(ci => [contName(ci), cells[ci], ci]),
    zero: order.filter(ci => cells[ci] === 0).map(contName),
    tiers: { ADV: fx(T.p1.ADV, 1), DEV: fx(T.p1.DEV, 1), LDC: fx(T.p1.LDC, 1) }
  });
  $('#hTier').innerHTML = TIERS.map(t => '<span class="' + lvCls(t) + '" style="flex:' + T.p1[t] + ' 1 0">' + fx(T.p1[t], 1) + '</span>').join('');
  $('#hTier').setAttribute('aria-label', S.hTierAria(TIERS.map(t => S.tier[t] + ' ' + S.nb(fx(T.p1[t], 1))).join(S.comma)));
  $('#hTierKeys').innerHTML = TIERS.map(t => '<li class="' + lvCls(t) + '"><i></i>' + S.tier[t] + ' <b>' + S.nb(fx(T.p1[t], 1)) + '</b></li>').join('');
  /* by GDP band, bands 1-9 then no data, in babies out of 100 to one decimal; a part that rounds to 0.0
     is left out of the strip and kept in the keys, and only parts wide enough carry their number */
  const bands = BAND_LIST, bb = bands.map(() => 0);
  LOCS.forEach(l => { bb[bands.indexOf(l.band)] += l.births; });
  const b1 = largestRemainder(bb.map(v => v / tot * 1000), 1000).map(v => v / 10);
  $('#hBand').innerHTML = bands.map((b, i) => b1[i] > 0 ? '<span class="b-' + b + '" style="flex:' + b1[i] + ' 1 0" title="' + esc(S.kv(bandName(b), S.nb(fx(b1[i], 1)))) + '">' + (b1[i] >= 6 ? fx(b1[i], 1) : '') + '</span>' : '').join('');
  $('#hBand').setAttribute('aria-label', S.hBandAria(bands.map((b, i) => bandName(b) + ' ' + S.nb(fx(b1[i], 1))).join(S.comma)));
  $('#hBandKeys').innerHTML = bands.map((b, i) => '<li class="b-' + b + '"><i></i>' + esc(bandName(b)) + ' <b>' + S.nb(fx(b1[i], 1)) + '</b></li>').join('');
  const waffle = $('#waffle');
  waffle.innerHTML = order.map(ci => ('<span class="k' + ci + '"></span>').repeat(cells[ci])).join('');
  waffle.setAttribute('aria-label', order.map(ci => contName(ci) + ' ' + S.cells(cells[ci])).join(S.comma));
  $('#hLegend').innerHTML = order.map(ci => '<li class="k' + ci + '"><i></i><span>' + esc(contName(ci)) + '</span><b>' + S.nb(fmtSmall(exact[ci])) + '</b></li>').join('');
  const top = LOCS.slice().sort((x, y) => y.births - x.births).slice(0, 12);
  const max = top[0].births;
  const row = (l, cls) => '<li class="k' + l.cont + (cls ? ' ' + cls : '') + '"><span class="nm" title="' + esc(nm(l)) + '">' + esc(nm(l)) + '</span>' +
    '<span class="bar"><b style="--w:' + (l.births / max * 100).toFixed(2) + '%"></b></span><span class="v">' + S.nb(fmtSmall(l.births / tot * 100)) + '</span></li>';
  const refL = current.type !== 'empty' ? current.loc : BY.get(S.ref);
  $('#hBars').innerHTML = top.map(l => row(l, l === refL ? 'ref' : '')).join('') + (top.includes(refL) ? '' : row(refL, 'ref extra'));
}

/* ================= my records ================= */
let clearArmed = 0;
function renderMine() {
  const st = store.stats, T = tierStats();
  const lede = $('#mLede'), wrap = $('#mCmpWrap');
  if (!st.n) {
    lede.textContent = S.mineEmpty;
    wrap.hidden = true;
  } else {
    lede.textContent = S.mineCount(fmtInt(st.n), st.n);
    wrap.hidden = false;
    const tot = TOT.births, exp = CONT.map(() => 0);
    LOCS.forEach(l => { exp[l.cont] += l.births / tot; });
    const order = CONT.map((_, i) => i).sort((a, b) => exp[b] - exp[a]);
    const li = (cls, name, obs, ex) => '<li class="' + cls + '"><span>' + esc(name) + '</span><span class="bar"><b style="--w:' + (obs * 100).toFixed(2) + '%"></b><i style="--x:' + (ex * 100).toFixed(2) + '%"></i></span>' +
      '<span class="v">' + pctF(obs, 1) + ' <small>' + esc(S.exp(pctF(ex, 1))) + '</small></span></li>';
    $('#mCmp').innerHTML = order.map(ci => li('k' + ci, contName(ci), st.cont[ci] / st.n, exp[ci])).join('');
    $('#mTier').innerHTML = TIERS.map((t, i) => li(lvCls(t), S.tier[t], st.tier[i] / st.n, T.share[t])).join('');
    const tops = Object.entries(st.top).map(([c, n]) => [BY.get(+c), n]).filter(x => x[0])
      .sort((x, y) => y[1] - x[1] || y[0].births - x[0].births).slice(0, 5);
    $('#mTop').textContent = S.mostFrequent + tops.map(([l, n]) => S.topItem(nm(l), fmtInt(n), fmtSmall(st.n * l.births / tot))).join(S.comma) + S.period;
  }
  const list = $('#mRecent');
  if (!store.recent.length) {
    list.innerHTML = '<li><p class="empty-hint">' + esc(S.emptyHint) + '</p></li>';
  } else {
    list.innerHTML = store.recent.map(r => {
      const l = BY.get(r.c), t = tierOf(l);
      return '<li><button type="button" data-no="' + r.no + '"' + (current.type === 'draw' && current.serial === r.no ? ' aria-current="true"' : '') + '>' +
        '<span class="r-name b-' + l.band + '"><span class="sr-only">' + S.tier[t] + S.comma + esc(S.kv(S.lbGdp, bandName(l.band))) + S.comma + '</span><span class="r-txt">' + esc(nm(l)) + S.comma + sexName(r.s) + '</span></span>' +
        '<span class="r-no">' + (r.b ? '<small>' + esc(S.lastOf(fmtInt(r.b))) + '</small>' : '') + esc(S.serial(fmtInt(r.no))) + '</span></button></li>';
    }).join('');
  }
  $('#clearBtn').hidden = !store.recent.length && !st.n;
}

/* ================= table ================= */
const COLS = [
  { key: 'name' }, { key: 'births' }, { key: 'pop' }, { key: 'prob' },
  { key: 'tier', cls: 'tl' }, { key: 'e0B' }, { key: 'gdpN' }, { key: 'gdp' }
];
const TBL = { key: 'prob', dir: -1, q: '', cont: -1, tier: '' };
/* case, accents (Perú, México), spaces and punctuation do not matter; NFC puts Hangul back together */
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase().replace(/[\s·・,.'’()\-]/g, '');
/* other names people type: 한국, 남한, 터키, 버마, 스와질란드, USA, 米国, EE. UU., КНДР ... */
const ALIAS = { 410: '한국 남한 korea республика корея', 408: '조선 dprk кндр', 840: 'usa us 미합중국 米国 アメリカ eeuu соединенные штаты америка', 826: 'uk 잉글랜드 britain 英国 англия британия соединенное королевство',
  180: '민주콩고 drc rdc дрк демократическая республика конго', 178: '콩고', 792: '터키 turkey', 104: '버마 burma ビルマ birmania бирма', 748: '스와질란드 swaziland スワジランド suazilandia свазиленд',
  384: '아이보리코스트 ivorycoast', 132: '케이프베르데 capeverde', 807: '마케도니아 македония', 626: '티모르', 784: 'uae 에미리트 оаэ эмираты', 203: 'czechrepublic チェコ共和国 republicacheca чешская республика',
  643: 'russianfederation ロシア連邦 рф российская федерация', 158: '타이완', 344: '홍콩', 275: 'palestine', 528: 'holanda голландия', 710: 'южно-африканская республика южная африка' };
LOCS.forEach(l => { l.key = [l.ko, l.en, l.ja, l.es, l.ru, ALIAS[l.code] || ''].map(norm).join('|'); });
function colVal(l, k) { return k === 'prob' ? l.births : k === 'name' ? nm(l) : k === 'tier' ? tierIdx(l.tier) : l[k]; }
function renderTableHead() {
  $('#tHead').innerHTML = COLS.map(c => {
    const s = TBL.key === c.key ? ' aria-sort="' + (TBL.dir > 0 ? 'ascending' : 'descending') + '"' : '';
    return '<th scope="col"' + (c.cls ? ' class="' + c.cls + '"' : '') + s + '><button type="button" data-key="' + c.key + '">' + esc(S.cols[c.key]) + '</button></th>';
  }).join('');
}
/* with chip set (the market-rate column) the cell starts with a chip in its GDP band's colour */
function gdpCell(v, n, f, chip) {
  const c = chip ? '<i class="gchip b-' + bandOf(v) + '" aria-hidden="true"></i>' : '';
  if (v == null) return '<td class="na" title="' + esc(S.noData) + '">' + c + '—</td>';
  return '<td' + (n ? ' title="' + esc(note(n)) + '"' : '') + '>' + c + f(v) + (n ? '*' : '') + '</td>';
}
function renderTable() {
  tierStats();
  const q = norm(TBL.q);
  const rows = LOCS.filter(l => (TBL.cont < 0 || l.cont === TBL.cont) && (!TBL.tier || l.tier === TBL.tier) && (!q || l.key.includes(q)));
  const k = TBL.key, dir = TBL.dir;
  rows.sort((a, b) => {
    const x = colVal(a, k), y = colVal(b, k);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (k === 'name') return dir * x.localeCompare(y, S.locale);
    return dir * (x - y) || b.births - a.births;
  });
  const cur = current.type !== 'empty' ? current.loc.code : 0;
  $('#tBody').innerHTML = rows.length ? rows.map(l =>
    '<tr' + (l.code === cur ? ' class="cur"' : '') + '><th scope="row"><div class="nm-cell"><span class="chip xs"><img src="assets/flags/' + l.iso2.toLowerCase() + '.svg" alt="" width="22" height="16" loading="lazy" decoding="async"></span>' +
    '<button type="button" class="nm-btn" data-code="' + l.code + '">' + esc(nm(l)) + '</button><span class="en">' + esc(nmSub(l)) + '</span></div></th>' +
    '<td>' + compact(l.births) + '</td><td>' + compact(l.pop) + '</td><td>' + fmtPct(l.births / TOT.births) + '</td>' +
    '<td class="tier-c ' + lvCls(l.tier) + '">' + pipsHTML(l.tier) + S.tier[l.tier] + '</td>' +
    '<td>' + fx(l.e0B, 1) + '</td>' +
    gdpCell(l.gdpN, l.gdpNNote, usd, true) + gdpCell(l.gdp, l.gdpNote, v => fmtInt(v)) +
    '</tr>').join('') : '<tr><td colspan="8" class="tbl-empty">' + esc(S.tblEmpty) + '</td></tr>';
  $('#tCount').textContent = S.count(LOCS.length, rows.length);
}
/* after a draw only the highlighted row changes, so the 236 rows are not rebuilt */
function markTableRow() {
  const cur = current.type !== 'empty' ? current.loc.code : 0, old = $('#tBody tr.cur');
  if (old) old.classList.remove('cur');
  const b = cur && $('#tBody button[data-code="' + cur + '"]');
  if (b) b.closest('tr').classList.add('cur');
}
/* a missing flag file leaves an empty chip frame instead of a broken image */
$('#tBody').addEventListener('error', e => {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  const code = img.getAttribute('src').replace(/^.*\/|\.svg$/g, '').toUpperCase(), s = document.createElement('span');
  s.className = 'chip-code';
  s.textContent = code;
  img.replaceWith(s);
}, true);

/* ================= actions ================= */
function announce(t) { const s = $('#sr'); s.textContent = ''; setTimeout(() => { s.textContent = t; }, 30); }
function smoothTo(el) { el.scrollIntoView({ behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'start' }); }
/* after a lookup or reopening a record from further down the page, bring the result screen back */
function reveal() {
  const r = stage.getBoundingClientRect();
  $('#idName').focus({ preventScroll: true });
  if (r.top < -window.innerHeight * 0.35 || r.top > window.innerHeight * 0.5) smoothTo(document.body);
}

function fromRecent(r) {
  return { type: 'draw', loc: BY.get(r.c), sex: r.s, serial: r.no, t: r.t };
}

let lastBatchArgs = null;
function renderBatch(n, batch, last, tierN) {
  lastBatchArgs = [n, batch, last, tierN];
  const box = $('#batch'), tot = TOT.births, T = tierStats();
  const cc = CONT.map(() => 0), exp = CONT.map(() => 0);
  batch.forEach((c, code) => { cc[BY.get(code).cont] += c; });
  LOCS.forEach(l => { exp[l.cont] += l.births / tot * n; });
  const order = CONT.map((_, i) => i).sort((a, b) => exp[b] - exp[a]);
  const seg = vals => order.map(ci => vals[ci] > 0 ? '<b class="k' + ci + '" style="--w:' + (vals[ci] / n * 100).toFixed(3) + '%"></b>' : '').join('');
  const tops = [...batch].sort((x, y) => y[1] - x[1] || BY.get(y[0]).births - BY.get(x[0]).births).slice(0, 5);
  box.innerHTML =
    '<div class="batch-h"><h3>' + esc(S.batchTitle(n)) + '</h3><p>' + esc(S.batchNote(S.serial(fmtInt(last.serial)))) + '</p></div>' +
    '<div class="stack" role="img" aria-label="' + esc(S.batchAria(order.map(ci => S.batchItem(contName(ci), cc[ci], fmtSmall(exp[ci]))).join('; '))) + '">' +
      '<div class="stack-row"><span>' + esc(S.rowNow) + '</span><span class="stack-bar">' + seg(cc) + '</span></div>' +
      '<div class="stack-row"><span>' + esc(S.rowExp) + '</span><span class="stack-bar exp">' + seg(exp) + '</span></div>' +
    '</div>' +
    '<ul class="stack-keys">' + order.map(ci => '<li class="k' + ci + '"><i></i>' + esc(contName(ci)) + ' <b>' + cc[ci] + '</b><small>' + esc(S.exp(fmtSmall(exp[ci]))) + '</small></li>').join('') + '</ul>' +
    '<p class="batch-top">' + esc(S.mostFrequent + tops.map(([c, k]) => S.topItem(nm(BY.get(c)), fmtInt(k), fmtSmall(BY.get(c).births / tot * n))).join(S.comma) + S.period) + '</p>';
  box.hidden = false;
  const line = $('#batchLine');
  line.innerHTML = S.batchLineHtml(n, TIERS.map((t, i) => '<span>' + S.tier[t] + ' <b>' + tierN[i] + '</b></span>').join(S.comma),
    TIERS.map(t => fx(T.share[t] * n, 1)).join(' / ')) +
    '<a href="#atlas" id="toMap">' + esc(S.toMap) + '</a>';
  line.hidden = false;
}
function hideBatch() {
  $('#batch').hidden = true;
  $('#batchLine').hidden = true;
  if (MAP.ready) MAP.clearBatch();
}

const SPEED = { 1: 1, 10: 1.35, 100: 1.7 };
function doDraws(n) {
  const st = store.stats, batch = new Map(), tierN = [0, 0, 0];
  let last = null;
  for (let k = 0; k < n; k++) {
    const r = drawOne();
    r.serial = ++store.serial;
    const ti = tierIdx(tierOf(r.loc));
    st.n++; st.cont[r.loc.cont]++; st.tier[ti]++; tierN[ti]++;
    st.top[r.loc.code] = (st.top[r.loc.code] || 0) + 1;
    batch.set(r.loc.code, (batch.get(r.loc.code) || 0) + 1);
    last = r;
  }
  const now = Date.now();
  last.t = now;
  store.recent.unshift({ no: last.serial, c: last.loc.code, s: last.sex, t: now, b: n > 1 ? n : 0 });
  store.recent = store.recent.slice(0, 12);
  save();
  renderStage(last, { animate: true, speed: SPEED[n] || 1 });
  if (n === 1) {
    hideBatch();
    if (MAP.ready) MAP.pick(last.loc.code, true);
  } else {
    lastBatch = batch;
    renderBatch(n, batch, last, tierN);
    if (MAP.ready) { MAP.showBatch(batch); MAP.pick(last.loc.code, false); MAP.reset(); }
  }
  renderMine();
  renderHundred();
  markTableRow();
  const L = last.loc;
  announce((n === 1
    ? S.drawnOne(S.serial(fmtInt(last.serial)), nm(L), sexName(last.sex), fmtPct(L.births / TOT.births), S.tier[tierOf(L)])
    : S.drawnMany(n, tierN[0], tierN[1], tierN[2], nm(L))) + S.sp + bandSay(L));
}

function reopen(no) {
  const r = store.recent.find(x => x.no === no);
  if (!r) return;
  const st = fromRecent(r);
  renderStage(st, { animate: true });
  hideBatch();
  if (MAP.ready) MAP.pick(st.loc.code, true);
  renderHundred();
  renderMine();
  markTableRow();
  announce(S.reopened(S.serial(fmtInt(no)), nm(st.loc), S.tier[tierOf(st.loc)]) + S.sp + bandSay(st.loc));
  reveal();
}

function lookup(code) {
  const L = BY.get(code);
  if (!L) return;
  renderStage({ type: 'lookup', loc: L }, { animate: true });
  hideBatch();
  if (MAP.ready) MAP.pick(code, true);
  renderHundred();
  renderMine();
  markTableRow();
  announce(S.looked(nm(L), S.tier[tierOf(L)]) + S.sp + bandSay(L));
  reveal();
}

/* ================= language switch ================= */
/* ?lang= in the address, then the visitor's last choice; English otherwise (the browser's
   language is not consulted, so a first visit always opens in English) */
function pickLang() {
  const ok = l => (l && I18N.LANGS.indexOf(l) >= 0 ? l : null);
  let l = null;
  try { l = ok(new URLSearchParams(location.search).get('lang')); } catch (e) { /* no URLSearchParams */ }
  if (!l) { try { l = ok(localStorage.getItem(LANG_KEY)); } catch (e) { /* storage blocked */ } }
  return l || 'en';
}
/* stylesheets fetched only once their language is chosen: the Japanese font is large, and Russian
   needs Cyrillic faces (Orbit and Chakra Petch have none): IBM Plex Sans for text, Jura for headings */
const LANG_FONTS = {
  ja: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&display=swap',
  ru: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Jura:wght@400;500;600&display=swap'
};
const fontsAdded = {};
/* switch the text table and every piece of static text; the rendered sections follow in setLang */
function applyLang(l) {
  LANG = l; S = I18N[l];
  document.documentElement.lang = l;
  if (LANG_FONTS[l] && !fontsAdded[l]) {
    fontsAdded[l] = true;
    const k = document.createElement('link');
    k.rel = 'stylesheet'; k.href = LANG_FONTS[l];
    document.head.appendChild(k);
  }
  const md = $('meta[name="description"]');
  if (md) md.setAttribute('content', S.metaDesc);
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = S[el.dataset.t]; });
  document.querySelectorAll('[data-th]').forEach(el => { el.innerHTML = S[el.dataset.th]; });
  document.querySelectorAll('[data-tp]').forEach(el => { el.setAttribute('placeholder', S[el.dataset.tp]); });
  const track = $('#langTrack');
  track.style.setProperty('--n', I18N.LANGS.length);
  track.style.setProperty('--i', I18N.LANGS.indexOf(l));
  track.querySelectorAll('input').forEach(r => { r.checked = r.value === l; });
  $('#tTitle').textContent = S.tTitle(LOCS.length);
  $('#draw10').setAttribute('aria-label', S.draw10);
  $('#draw100').setAttribute('aria-label', S.draw100);
  $('#contSel').innerHTML = '<option value="-1">' + esc(S.allCont) + '</option>' + CONT.map((c, i) => '<option value="' + i + '">' + esc(contName(i)) + '</option>').join('');
  $('#contSel').value = String(TBL.cont);
  $('#tierSel').innerHTML = '<option value="">' + esc(S.allTier) + '</option>' + TIERS.map(t => '<option value="' + t + '">' + S.tier[t] + '</option>').join('');
  $('#tierSel').value = TBL.tier;
  const msg = $('#mapMsg');
  if (!msg.hidden) msg.textContent = S.mapFail;
  clearArmed = 0;
}
function setLang(l) {
  if (l === LANG || !I18N[l]) return;
  applyLang(l);
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* choice not kept */ }
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', l); history.replaceState(history.state, '', u.href); }
  } catch (e) { /* address left as it is */ }
  renderIntro(); tickLive(); renderMethod();
  renderStage(current, {});
  renderHundred(); renderMine();
  renderTableHead(); renderTable();
  if (lastBatchArgs && !$('#batch').hidden) renderBatch(...lastBatchArgs);
  $('#tip').hidden = true;
  $('#sr').textContent = '';
  /* names are measured again once the new language's fonts have arrived */
  requestAnimationFrame(() => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName); });
}

/* ================= wiring ================= */
$('#langTrack').addEventListener('change', e => { if (e.target.name === 'lang') setLang(e.target.value); });
$('#draw1').addEventListener('click', () => doDraws(1));
$('#draw10').addEventListener('click', () => doDraws(10));
$('#draw100').addEventListener('click', () => doDraws(100));
$('#copyBtn').addEventListener('click', onCopy);
$('#batchLine').addEventListener('click', e => { if (e.target.closest('#toMap')) { e.preventDefault(); smoothTo($('#atlas')); } });
$('#mRecent').addEventListener('click', e => { const b = e.target.closest('button[data-no]'); if (b) reopen(+b.dataset.no); });
$('#tBody').addEventListener('click', e => { const b = e.target.closest('button[data-code]'); if (b) lookup(+b.dataset.code); });
$('#tHead').addEventListener('click', e => {
  const b = e.target.closest('button[data-key]');
  if (!b) return;
  const k = b.dataset.key;
  if (TBL.key === k) TBL.dir = -TBL.dir;
  else { TBL.key = k; TBL.dir = k === 'name' || k === 'tier' ? 1 : -1; }
  renderTableHead(); renderTable();
  const nb = $('#tHead button[data-key="' + k + '"]'); if (nb) nb.focus();
});
$('#q').addEventListener('input', e => { TBL.q = e.target.value.trim(); renderTable(); });
$('#contSel').addEventListener('change', e => { TBL.cont = +e.target.value; renderTable(); });
$('#tierSel').addEventListener('change', e => { TBL.tier = e.target.value; renderTable(); });
$('#clearBtn').addEventListener('click', e => {
  const btn = e.currentTarget;
  if (Date.now() - clearArmed > 3500) {
    clearArmed = Date.now();
    btn.textContent = S.clearArm;
    announce(S.clearArmSay);
    setTimeout(() => { if (Date.now() - clearArmed >= 3400) btn.textContent = S.clear; }, 3500);
    return;
  }
  clearArmed = 0;
  btn.textContent = S.clear;
  store.serial = 0; store.recent = []; store.stats = freshStats();
  save();
  if (current.type === 'draw') {
    renderStage({ type: 'empty' }, {});
    if (MAP.ready) MAP.unpick();
  }
  hideBatch();
  renderMine(); renderHundred(); markTableRow();
  announce(S.cleared);
});
$('#idName').setAttribute('tabindex', '-1');

applyLang(pickLang());
tierStats();
paintSpace();
renderIntro();
renderMethod();
renderStage(store.recent.length ? fromRecent(store.recent[0]) : { type: 'empty' }, {});
/* first sight of the planet: from the whole globe down to the last record */
if (current.type !== 'empty') PLANET.show(current, { animate: true, fresh: true });
renderHundred();
renderMine();
renderTableHead();
renderTable();
tickLive();
setInterval(tickLive, 1000);
let fitT = 0;
window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitName, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

/* only the map needs d3; the planet draws from the topology decoded at start */
if (window.d3) initMap();
else loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js')
  .catch(() => loadScript('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'))
  .then(initMap, mapFail);
})();
