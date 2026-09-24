(() => {
'use strict';

/* ================= data ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = JSON.parse($('#app-data').textContent);
const CONT = D.CONT, SUB = D.SUB, WR = D.WORLD, FIELDS = D.LOC_FIELDS;
/* rows are plain arrays; LOC_FIELDS names each column so removing one cannot shift the rest */
const LOCS = D.LOC.map((r, i) => {
  const o = { i };
  FIELDS.forEach((k, j) => { o[k] = r[j]; });
  o.pm = o.srb / (1 + o.srb);
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
/* digit advance widths in em for the element's font, so a stopped number is spaced like plain text */
const DIGW = new Map();
function digitWidths(el) {
  const cs = getComputedStyle(el);
  if (!el.isConnected || !cs.fontFamily) return Array(10).fill(0.6);
  const font = cs.fontStyle + ' ' + cs.fontWeight + ' 100px ' + cs.fontFamily;
  if (DIGW.has(font)) return DIGW.get(font);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  const w = Array.from({ length: 10 }, (_, d) => ctx.measureText(String(d)).width / 100);
  let loaded = true;
  try { loaded = !document.fonts || document.fonts.check(font); } catch (e) { loaded = false; }
  if (loaded) DIGW.set(font, w);
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
  const tier = empty ? 'NONE' : tierOf(L);
  const T = tierStats();
  stage.dataset.tier = tier;
  document.documentElement.dataset.tier = tier;

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
  const bl = $('#tierBarL');
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
    $('#tierBar').innerHTML = TIERS.map(t => '<span class="t-' + t + (t === tier ? ' on' : '') + '" style="width:' + (T.share[t] * 100).toFixed(3) + '%"></span>').join('');
    bl.innerHTML = TIERS.map(t => '<span class="t-' + t + (t === tier ? ' on' : '') + '">' + S.tier[t] + ' ' + pctF(T.p2[t], 2) + '</span>').join('');
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
  lines.push('Rebirth Simulator: ' + (draw ? S.kindDraw + ' ' + S.serial(fmtInt(st.serial)) + c + today(st.t) : S.kindLookup + c + today()));
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

/* ================= shared geography (needs d3) ================= */
const GEO = { ready: false };
function initGeo() {
  if (GEO.ready) return true;
  if (!window.d3 || typeof topoFeatures !== 'function') return false;
  let topo;
  try { topo = JSON.parse($('#map-data').textContent); } catch (e) { return false; }
  const fc = topoFeatures(topo, topo.objects.countries);
  fc.features.forEach(f => { f.code = f.properties && f.properties.id ? +f.properties.id : 0; });
  GEO.fc = fc;
  GEO.feats = fc.features;
  GEO.FEAT = new Map(GEO.feats.filter(f => f.code).map(f => [f.code, f]));
  GEO.ready = true;
  return true;
}
/* the main piece of a country plus the islands near it (drops far-flung territories) */
function emblemGeom(f) {
  if (f._em) return f._em;
  const d3 = window.d3, g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const items = polys.map(c => {
    const p = { type: 'Polygon', coordinates: c };
    return { c, area: d3.geoArea(p), cen: d3.geoCentroid(p) };
  }).sort((a, b) => b.area - a.area);
  const main = items[0];
  let R = 0;
  for (const pt of main.c[0]) R = Math.max(R, d3.geoDistance(main.cen, pt));
  const thr = Math.max(10, 1.2 * R * 180 / Math.PI);
  const inc = items.filter(it => {
    const dd = d3.geoDistance(main.cen, it.cen) * 180 / Math.PI;
    return dd <= thr || (it.area >= 0.2 * main.area && dd <= 30);
  });
  const geo = { type: 'MultiPolygon', coordinates: inc.map(it => it.c) };
  f._em = { geo, c: d3.geoCentroid(geo), main: { type: 'Polygon', coordinates: main.c } };
  return f._em;
}

/* ================= planet ================= */
/* The drawn country sits at the centre of a globe. To make small countries visible the angle c
   from the centre is stretched to m*c before the orthographic wrap, so the visible cap shrinks to
   90/m degrees. A draw flies the camera: pull back to the whole globe, turn, then zoom in. */
const PLANET = (() => {
  const R = 196, CX = 360, CY = 300, RAD = Math.PI / 180;
  const svg = $('#planet');
  const STEPS = [0.5, 1, 2, 5, 10, 15, 20, 30];
  const halfRing = (k, front) => {
    const rx = 1.62 * R * k, ry = 0.30 * R * k;
    return 'M' + (CX - rx).toFixed(2) + ' ' + CY + 'A' + rx.toFixed(2) + ' ' + ry.toFixed(2) + ' 0 0 ' + (front ? 0 : 1) + ' ' + (CX + rx).toFixed(2) + ' ' + CY;
  };
  const stops = list => list.map(([o, a]) => '<stop offset="' + o + '" class="stop-t" stop-opacity="' + a + '"/>').join('');
  const arc = (a0, a1, r) => {
    const p = a => [CX + r * Math.cos(a * RAD), CY + r * Math.sin(a * RAD)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  };
  const B = 100, A = 26; // bracket half-size and arm length at scale 1
  const brk = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    'M' + (CX + sx * B) + ' ' + (CY + sy * (B - A)) + 'V' + (CY + sy * B) + 'H' + (CX + sx * (B - A))).join('');
  svg.innerHTML =
    '<defs>' +
      '<radialGradient id="pHalo" gradientUnits="userSpaceOnUse" cx="' + CX + '" cy="' + CY + '" r="' + 1.34 * R + '">' + stops([[0, .34], [.7, .34], [.76, .14], [1, 0]]) + '</radialGradient>' +
      '<linearGradient id="pRingGrad" gradientUnits="userSpaceOnUse" x1="' + (CX - 1.62 * R) + '" y1="' + CY + '" x2="' + (CX + 1.62 * R) + '" y2="' + CY + '">' + stops([[0, 0], [.3, .55], [.7, .55], [1, 0]]) + '</linearGradient>' +
      '<radialGradient id="pSea" gradientUnits="userSpaceOnUse" cx="' + (CX - .38 * R) + '" cy="' + (CY - .42 * R) + '" r="' + 1.5 * R + '"><stop offset="0" stop-color="#1A3552"/><stop offset=".55" stop-color="#0A1830"/><stop offset="1" stop-color="#03060F"/></radialGradient>' +
      '<radialGradient id="pShade" gradientUnits="userSpaceOnUse" cx="' + (CX - .45 * R) + '" cy="' + (CY - .5 * R) + '" r="' + 1.75 * R + '"><stop offset="0" stop-color="#01030A" stop-opacity="0"/><stop offset=".35" stop-color="#01030A" stop-opacity="0"/><stop offset=".72" stop-color="#01030A" stop-opacity=".55"/><stop offset="1" stop-color="#01030A" stop-opacity=".92"/></radialGradient>' +
      '<radialGradient id="pRim" gradientUnits="userSpaceOnUse" cx="' + CX + '" cy="' + CY + '" r="' + R + '">' + stops([[0, 0], [.86, 0], [1, .42]]) + '</radialGradient>' +
      '<linearGradient id="pSweepGrad" x1="0" y1="0" x2="0" y2="1">' + stops([[0, 0], [.5, .22], [1, 0]]) + '</linearGradient>' +
      '<clipPath id="pClip"><circle cx="' + CX + '" cy="' + CY + '" r="' + R + '"/></clipPath>' +
      '<filter id="pBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '<pattern id="pScan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#B8E6FF" fill-opacity=".05"/></pattern>' +
    '</defs>' +
    '<g class="p-body">' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="' + 1.34 * R + '" fill="url(#pHalo)"/>' +
      '<g class="p-ring back" transform="rotate(-16 ' + CX + ' ' + CY + ')"><path class="solid" d="' + halfRing(1, false) + '"/><path class="dash" d="' + halfRing(.9, false) + '"/></g>' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="url(#pSea)"/>' +
      '<g clip-path="url(#pClip)">' +
        '<path class="p-grat"/><path class="p-land"/>' +
        '<path class="p-glow" filter="url(#pBlur)"/><path class="p-country"/>' +
        '<g class="p-dotg" display="none"><circle class="p-dot" r="9" filter="url(#pBlur)"/><circle class="p-dot" r="6"/><circle class="p-dot-ring" r="12"/></g>' +
        '<rect class="p-sweep" x="' + (CX - R) + '" y="' + (CY - 60) + '" width="' + 2 * R + '" height="120"/>' +
        '<rect x="' + (CX - R) + '" y="' + (CY - R) + '" width="' + 2 * R + '" height="' + 2 * R + '" fill="url(#pScan)"/>' +
        '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="url(#pShade)"/>' +
      '</g>' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="url(#pRim)"/>' +
      '<circle class="p-rimline" cx="' + CX + '" cy="' + CY + '" r="' + R + '"/>' +
      '<g class="p-ring front" transform="rotate(-16 ' + CX + ' ' + CY + ')"><path class="solid" d="' + halfRing(1, true) + '"/><path class="dash" d="' + halfRing(.9, true) + '"/></g>' +
      '<g class="p-hud">' +
        '<circle class="p-hud-ring" cx="' + CX + '" cy="' + CY + '" r="' + (R + 26) + '"/>' +
        '<path class="p-hud-arcs" d="' + [45, 135, 225, 315].map(a => arc(a - 11, a + 11, R + 40)).join('') + '"/>' +
        '<path class="p-brk" d="' + brk + '" vector-effect="non-scaling-stroke"/>' +
        '<text x="112" y="62">TARGET</text>' +
        '<text x="112" y="84" class="hl" id="hudLat">LAT  --.--</text>' +
        '<text x="112" y="104" class="hl" id="hudLng">LNG  --.--</text>' +
        '<text x="112" y="124" id="hudZoom">ZOOM ×1.0</text>' +
        '<text x="608" y="540" text-anchor="end" class="p-status" id="hudStatus">STANDBY</text>' +
        '<text x="608" y="560" text-anchor="end" id="hudCode">NO SIGNAL</text>' +
      '</g>' +
      '<g class="p-cross"><circle cx="' + CX + '" cy="' + CY + '" r="7"/><path d="M' + CX + ' ' + (CY - 19) + 'v8M' + CX + ' ' + (CY + 11) + 'v8M' + (CX - 19) + ' ' + CY + 'h8M' + (CX + 11) + ' ' + CY + 'h8"/></g>' +
    '</g>';
  const body = $('.p-body', svg), grat = $('.p-grat', svg), land = $('.p-land', svg), glow = $('.p-glow', svg), country = $('.p-country', svg);
  const dotg = $('.p-dotg', svg), brkEl = $('.p-brk', svg), cross = $('.p-cross', svg);
  const hud = { lat: $('#hudLat'), lng: $('#hudLng'), zoom: $('#hudZoom'), status: $('#hudStatus'), code: $('#hudCode') };

  let mutate = null, proj = null, path = null, lo = null;
  let view = null, target = null, raf = 0, idleRaf = 0, visible = true;
  const tcache = new Map();

  function setup() {
    if (mutate) return true;
    if (!GEO.ready) return false;
    const d3 = window.d3;
    const exRaw = m => {
      const az = d3.geoAzimuthalEquidistantRaw;
      return (lambda, phi) => {
        const [x, y] = az(lambda, phi);
        const c = Math.hypot(x, y);
        if (c < 1e-12) return [0, 0];
        const k = Math.sin(Math.min(m * c, Math.PI / 2)) / c;
        return [x * k, y * k];
      };
    };
    mutate = d3.geoProjectionMutator(exRaw);
    proj = mutate(1).scale(R).translate([CX, CY]);
    path = d3.geoPath(proj).digits(1);
    /* a lighter copy of the land for whole-globe frames, and a bounding cap per country for culling */
    const thin = ring => ring.length < 16 ? ring : ring.filter((p, i) => i % 3 === 0 || i === ring.length - 1);
    lo = GEO.feats.map(f => {
      const g = f.geometry;
      const geometry = !g ? g : g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.coordinates.map(thin) }
        : { type: 'MultiPolygon', coordinates: g.coordinates.map(p => p.map(thin)) };
      return { type: 'Feature', code: f.code, geometry };
    });
    GEO.feats.forEach(f => {
      f._bc = d3.geoCentroid(f);
      let r = 0;
      d3.geoStream(f, { point(x, y) { r = Math.max(r, d3.geoDistance(f._bc, [x, y])); }, lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {} });
      f._br = r;
    });
    return true;
  }

  /* where to look and how much to magnify for a place */
  function targetFor(code) {
    if (tcache.has(code)) return tcache.get(code);
    const d3 = window.d3, L = BY.get(code), f = GEO.FEAT.get(code);
    let t;
    const em = f ? emblemGeom(f) : null;
    if (!em || em.main.coordinates[0].length < 10) {
      /* no outline, or one drawn with a handful of points: a glowing dot at the listed position */
      t = { code, lon: L.lng, lat: L.lat, m: 22, dot: true, feat: null };
    } else {
      let cmax = 0;
      for (const poly of em.geo.coordinates) for (const pt of poly[0]) cmax = Math.max(cmax, d3.geoDistance(em.c, pt));
      t = { code, lon: em.c[0], lat: em.c[1], m: Math.min(22, Math.max(1, 52 / (cmax / RAD))), dot: false, feat: f };
    }
    tcache.set(code, t);
    return t;
  }

  function graticule(v, vis) {
    const d3 = window.d3;
    const step = STEPS.find(s => vis / s <= 6) || 30;
    const g = d3.geoGraticule().step([step, step]).precision(step / 4);
    if (vis < 60) {
      const pad = vis + 2 * step, lat0 = Math.max(-90, v.lat - pad), lat1 = Math.min(90, v.lat + pad);
      const polar = Math.max(Math.abs(lat0), Math.abs(lat1));
      const dl = polar > 80 ? 180 : Math.min(180, pad / Math.cos(polar * RAD));
      const snap = x => Math.floor(x / step) * step;
      g.extent([[snap(v.lon - dl), snap(lat0)], [snap(v.lon + dl) + step, Math.min(90, snap(lat1) + step)]]);
    }
    return path(g());
  }

  function frame(v, fine) {
    const d3 = window.d3;
    mutate(v.m);
    const vis = Math.min(90, 90 / v.m);
    proj.rotate([-v.lon, -v.lat]).clipAngle(vis).precision(fine ? 0.3 : 0.9);
    grat.setAttribute('d', graticule(v, vis) || '');
    const cap = vis * RAD + 0.03, ctr = [v.lon, v.lat];
    const skip = target && !target.dot ? target.code : -1;
    const src = v.m < 2.2 && !fine ? lo : GEO.feats;
    const list = [];
    for (let i = 0; i < src.length; i++) {
      const f = GEO.feats[i];
      if (f.code === skip || !src[i].geometry) continue;
      if (vis < 80 && d3.geoDistance(f._bc, ctr) - f._br > cap) continue;
      list.push(src[i]);
    }
    land.setAttribute('d', path({ type: 'FeatureCollection', features: list }) || '');
    const cd = target && target.feat ? path(target.feat) || '' : '';
    country.setAttribute('d', cd);
    glow.setAttribute('d', cd);
    if (target && target.dot && d3.geoDistance([target.lon, target.lat], ctr) < vis * RAD) {
      const p = proj([target.lon, target.lat]);
      dotg.setAttribute('display', 'inline');
      dotg.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')');
    } else dotg.setAttribute('display', 'none');
    const lon = ((v.lon + 540) % 360) - 180;
    hud.lat.textContent = 'LAT  ' + Math.abs(v.lat).toFixed(2) + '°' + (v.lat >= 0 ? 'N' : 'S');
    hud.lng.textContent = 'LNG  ' + Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');
    hud.zoom.textContent = 'ZOOM ×' + v.m.toFixed(1);
  }

  function clear() {
    [grat, land, glow, country].forEach(e => e.setAttribute('d', ''));
    dotg.setAttribute('display', 'none');
  }
  const status = (s, hl) => { hud.status.textContent = s; hud.status.classList.toggle('hl', !!hl); };
  function brackets(k) { brkEl.style.transform = 'scale(' + k + ')'; brkEl.style.opacity = k > 1.2 ? '.5' : '1'; }

  function lock(animate) {
    svg.classList.remove('flying');
    svg.classList.add('locked');
    status('TARGET LOCKED', true);
    brackets(0.42);
    cross.style.opacity = '';
    if (animate) { body.classList.remove('glitch'); void body.getBoundingClientRect(); body.classList.add('glitch'); }
  }

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  function fly(t, dur) {
    const d3 = window.d3;
    stopIdle();
    cancelAnimationFrame(raf);
    const from = view || { lon: t.lon + 75, lat: 14, m: 1 };
    const dist = d3.geoDistance([from.lon, from.lat], [t.lon, t.lat]);
    const rot = d3.geoInterpolate([from.lon, from.lat], [t.lon, t.lat]);
    const far = dist > 0.03;
    const zOut = far && from.m > 1.05 ? 0.3 : 0;
    const lf = Math.log(from.m), lt = Math.log(t.m);
    svg.classList.add('flying');
    svg.classList.remove('locked');
    status('SCANNING');
    brackets(1.6);
    cross.style.opacity = '.35';
    const t0 = performance.now();
    const step = now => {
      const p = clamp01((now - t0) / dur);
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
      frame(view, p >= 1);
      if (p < 1) raf = requestAnimationFrame(step);
      else { raf = 0; view = { lon: t.lon, lat: t.lat, m: t.m }; lock(true); }
    };
    raf = requestAnimationFrame(step);
  }

  /* the empty state: a grey world slowly turning */
  let idling = false, last = 0;
  function stopIdle() { cancelAnimationFrame(idleRaf); idleRaf = 0; idling = false; }
  const canSpin = () => idling && visible && !document.hidden && !REDUCED.matches;
  function spin(now) {
    idleRaf = 0;
    if (!canSpin()) return;
    if (now - last > 33) {
      view.lon = (view.lon + Math.min(now - last, 100) * 0.006) % 360;
      last = now;
      frame(view, false);
    }
    idleRaf = requestAnimationFrame(spin);
  }
  function resume() { if (canSpin() && !idleRaf) { last = performance.now(); idleRaf = requestAnimationFrame(spin); } }
  function idle() {
    stopIdle();
    cancelAnimationFrame(raf);
    target = null;
    view = view && view.m === 1 ? view : { lon: 20, lat: 14, m: 1 };
    svg.classList.remove('flying', 'locked');
    status('STANDBY');
    hud.code.textContent = 'AWAITING DRAW';
    brackets(1.6);
    cross.style.opacity = '.35';
    frame(view, true);
    idling = true;
    resume();
  }
  document.addEventListener('visibilitychange', resume);
  if (REDUCED.addEventListener) REDUCED.addEventListener('change', resume);

  function show(st, opt = {}) {
    body.classList.toggle('enter', !!opt.animate && !view);
    if (st.type === 'empty') {
      if (!setup()) {
        clear();
        svg.classList.remove('flying', 'locked');
        brackets(1.6);
        cross.style.opacity = '.35';
        status(GEO.failed ? 'NO MAP DATA' : 'STANDBY');
        hud.code.textContent = 'AWAITING DRAW';
        return;
      }
      idle();
      return;
    }
    const L = st.loc;
    hud.code.textContent = 'M49 ' + String(L.code).padStart(3, '0') + ' · ' + L.iso2;
    if (!setup()) {
      /* no d3 (yet): sea, halo, rim and ring only, in the tier colour */
      clear();
      lock(false);
      status(GEO.failed ? 'NO MAP DATA' : 'LINKING', GEO.failed);
      return;
    }
    target = targetFor(L.code);
    if (!opt.animate || REDUCED.matches) {
      stopIdle();
      cancelAnimationFrame(raf);
      view = { lon: target.lon, lat: target.lat, m: target.m };
      frame(view, true);
      lock(false);
      return;
    }
    fly(target, Math.round(2000 * (opt.speed || 1)));
  }

  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; resume(); }).observe(svg);
  return { show };
})();

/* ================= world map (needs d3) ================= */
const MAP = { ready: false };
let batchCounts = null, lastBatch = null;

function initMap() {
  if (MAP.ready) return;
  if (!initGeo()) { mapFail(); return; }
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
    .attr('class', i => 'bubble t-' + LOCS[i].tier)
    .attr('cx', i => pos[i][0]).attr('cy', i => pos[i][1])
    .attr('r', i => rBase[i])
    .attr('data-code', i => LOCS[i].code);
  const pulseG = zl.append('g');
  const batchG = zl.append('g');
  const pinG = zl.append('g').attr('display', 'none');
  const pinCross = pinG.append('path').attr('class', 'pin-cross');
  const pinRing = pinG.append('circle').attr('class', 'pin-ring').attr('r', 8);
  const pinDot = pinG.append('circle').attr('class', 'pin-dot').attr('r', 2.8);
  const crossD = k => 'M' + (-16 / k) + ' 0h' + (6 / k) + 'M' + (10 / k) + ' 0h' + (6 / k) + 'M0 ' + (-16 / k) + 'v' + (6 / k) + 'M0 ' + (10 / k) + 'v' + (6 / k);

  let K = 1;
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
    rescale();
    resetBtn.hidden = t.k < 1.001 && Math.abs(t.x) < 0.5 && Math.abs(t.y) < 0.5;
  });

  function targetFor(code) {
    const L = BY.get(code), p = proj([L.lng, L.lat]), f = FEAT.get(code);
    let k = 6;
    if (f) {
      const b = path.bounds(emblemGeom(f).main);
      const bw = Math.max(1, b[1][0] - b[0][0]), bh = Math.max(1, b[1][1] - b[0][1]);
      k = Math.max(1.6, Math.min(8, 0.42 / Math.max(bw / Wv, bh / Hv)));
    }
    let tx = Wv / 2 - k * p[0], ty = Hv / 2 - k * p[1];
    tx = Math.min(0, Math.max(Wv - Wv * k, tx));
    ty = Math.min(0, Math.max(Hv - Hv * k, ty));
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  }
  function go(t) {
    svg.interrupt();
    if (REDUCED.matches) svg.call(zoom.transform, t);
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
      return { code, n, x: p[0], y: p[1], r: 2 + 2.1 * Math.sqrt(n), t: L.tier };
    }).sort((a, b) => b.n - a.n);
    batchG.selectAll('circle').data(data).join('circle').attr('class', d => 'bdot t-' + d.t)
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
    let h = '<b>' + esc(nm(L)) + '</b> <span class="t t-' + L.tier + '">' + S.tier[L.tier] + '</span><br>' + esc(S.kv(S.births2026, people(L.births))) +
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

  /* ambient births at the real rate */
  let pulseT = 0, visible = true;
  function allowed() { return visible && !document.hidden && !REDUCED.matches; }
  function spawn() {
    const g = pulseG.node();
    if (g.childElementCount > 48) return;
    const i = pickCum(CUM.births, Math.random());
    const rr = rBase[i] * 0.72 / K * Math.sqrt(Math.random()), th = Math.random() * 2 * Math.PI;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'pulse');
    c.setAttribute('cx', pos[i][0] + rr * Math.cos(th));
    c.setAttribute('cy', pos[i][1] + rr * Math.sin(th));
    c.setAttribute('r', 2.3 / K);
    c.addEventListener('animationend', () => c.remove());
    g.appendChild(c);
  }
  function schedule() {
    clearTimeout(pulseT);
    if (!allowed()) return;
    pulseT = setTimeout(() => { spawn(); schedule(); }, -Math.log(1 - Math.random()) / RATE_B * 1000);
  }
  document.addEventListener('visibilitychange', schedule);
  if (REDUCED.addEventListener) REDUCED.addEventListener('change', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; schedule(); }).observe(svg.node());
  }
  schedule();

  MAP.ready = true;
  if (current.type !== 'empty') MAP.pick(current.loc.code, false);
  if (lastBatch && !$('#batch').hidden) MAP.showBatch(lastBatch);
}

function mapFail() {
  GEO.failed = true;
  PLANET.show(current, {});
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
  $('#keys').innerHTML = TIERS.map(t => '<li class="t-' + t + '">' + pipsHTML(t) + S.tier[t] + '</li>').join('');
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
    first: [contName(a), cells[a]], second: [contName(b), cells[b]],
    rest: rest.map(ci => [contName(ci), cells[ci]]),
    zero: order.filter(ci => cells[ci] === 0).map(contName),
    tiers: { ADV: fx(T.p1.ADV, 1), DEV: fx(T.p1.DEV, 1), LDC: fx(T.p1.LDC, 1) }
  });
  $('#hTier').innerHTML = TIERS.map(t => '<span class="t-' + t + '" style="flex:' + T.p1[t] + ' 1 0">' + fx(T.p1[t], 1) + '</span>').join('');
  $('#hTier').setAttribute('aria-label', S.hTierAria(TIERS.map(t => S.tier[t] + ' ' + S.nb(fx(T.p1[t], 1))).join(S.comma)));
  $('#hTierKeys').innerHTML = TIERS.map(t => '<li class="t-' + t + '"><i></i>' + S.tier[t] + ' <b>' + S.nb(fx(T.p1[t], 1)) + '</b></li>').join('');
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
    $('#mTier').innerHTML = TIERS.map((t, i) => li('t-' + t, S.tier[t], st.tier[i] / st.n, T.share[t])).join('');
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
        '<span class="r-name t-' + t + '"><span class="sr-only">' + S.tier[t] + S.comma + '</span><span class="r-txt">' + esc(nm(l)) + S.comma + sexName(r.s) + '</span></span>' +
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
/* other names people type: 한국, 남한, 터키, 버마, 스와질란드, USA, 米国, EE. UU. ... */
const ALIAS = { 410: '한국 남한 korea', 408: '조선 dprk', 840: 'usa us 미합중국 米国 アメリカ eeuu', 826: 'uk 잉글랜드 britain 英国', 180: '민주콩고 drc rdc', 178: '콩고',
  792: '터키 turkey', 104: '버마 burma ビルマ birmania', 748: '스와질란드 swaziland スワジランド suazilandia', 384: '아이보리코스트 ivorycoast', 132: '케이프베르데 capeverde',
  807: '마케도니아', 626: '티모르', 784: 'uae 에미리트', 203: 'czechrepublic チェコ共和国 republicacheca', 643: 'russianfederation ロシア連邦', 158: '타이완', 344: '홍콩', 275: 'palestine',
  528: 'holanda' };
LOCS.forEach(l => { l.key = [l.ko, l.en, l.ja, l.es, ALIAS[l.code] || ''].map(norm).join('|'); });
function colVal(l, k) { return k === 'prob' ? l.births : k === 'name' ? nm(l) : k === 'tier' ? tierIdx(l.tier) : l[k]; }
function renderTableHead() {
  $('#tHead').innerHTML = COLS.map(c => {
    const s = TBL.key === c.key ? ' aria-sort="' + (TBL.dir > 0 ? 'ascending' : 'descending') + '"' : '';
    return '<th scope="col"' + (c.cls ? ' class="' + c.cls + '"' : '') + s + '><button type="button" data-key="' + c.key + '">' + esc(S.cols[c.key]) + '</button></th>';
  }).join('');
}
function gdpCell(v, n, f) {
  if (v == null) return '<td class="na" title="' + esc(S.noData) + '">—</td>';
  return '<td' + (n ? ' title="' + esc(note(n)) + '"' : '') + '>' + f(v) + (n ? '*' : '') + '</td>';
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
    '<td class="tier-c t-' + l.tier + '">' + pipsHTML(l.tier) + S.tier[l.tier] + '</td>' +
    '<td>' + fx(l.e0B, 1) + '</td>' +
    gdpCell(l.gdpN, l.gdpNNote, usd) + gdpCell(l.gdp, l.gdpNote, v => fmtInt(v)) +
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
  line.innerHTML = S.batchLineHtml(n, TIERS.map((t, i) => '<span class="t-' + t + '">' + S.tier[t] + ' <b>' + tierN[i] + '</b></span>').join(S.comma),
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
  announce(n === 1
    ? S.drawnOne(S.serial(fmtInt(last.serial)), nm(L), sexName(last.sex), fmtPct(L.births / TOT.births), S.tier[tierOf(L)])
    : S.drawnMany(n, tierN[0], tierN[1], tierN[2], nm(L)));
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
  announce(S.reopened(S.serial(fmtInt(no)), nm(st.loc), S.tier[tierOf(st.loc)]));
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
  announce(S.looked(nm(L), S.tier[tierOf(L)]));
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
/* the Japanese web font is large, so its stylesheet is only fetched once Japanese is chosen */
const JP_FONT = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&display=swap';
let jpFont = false;
/* switch the text table and every piece of static text; the rendered sections follow in setLang */
function applyLang(l) {
  LANG = l; S = I18N[l];
  document.documentElement.lang = l;
  if (l === 'ja' && !jpFont) {
    jpFont = true;
    const k = document.createElement('link');
    k.rel = 'stylesheet'; k.href = JP_FONT;
    document.head.appendChild(k);
  }
  const md = $('meta[name="description"]');
  if (md) md.setAttribute('content', S.metaDesc);
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = S[el.dataset.t]; });
  document.querySelectorAll('[data-th]').forEach(el => { el.innerHTML = S[el.dataset.th]; });
  document.querySelectorAll('[data-tp]').forEach(el => { el.setAttribute('placeholder', S[el.dataset.tp]); });
  const track = $('#langTrack');
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
renderHundred();
renderMine();
renderTableHead();
renderTable();
tickLive();
setInterval(tickLive, 1000);
let fitT = 0;
window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitName, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

function geoReady() {
  if (!initGeo()) { mapFail(); return; }
  initMap();
  /* first sight of the planet: from the whole globe down to the last record */
  if (current.type === 'empty') PLANET.show(current, {});
  else PLANET.show(current, { animate: true });
}
if (window.d3) geoReady();
else loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js')
  .catch(() => loadScript('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'))
  .then(geoReady, mapFail);
})();
