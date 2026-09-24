(() => {
'use strict';

/* ================= data ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = JSON.parse($('#app-data').textContent);
const CONT = D.CONT, SUB = D.SUB, WR = D.WORLD, FIELDS = D.LOC_FIELDS;
const PASSPORT = D.PASSPORT || {};
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
/* source notes such as 'WB 2024', 'UN 2023', 'WB' (World Bank, same year) */
function noteKo(n) {
  if (!n) return '';
  const [src, yr] = n.split(' ');
  return ({ WB: '세계은행', UN: 'UN', IMF: 'IMF' }[src] || src) + (yr ? ' ' + yr + '년' : '') + ' 값';
}
const REDUCED = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/* ================= development tiers ================= */
/* computed for today: IMF advanced economies (and their territories), UN least developed
   countries until their graduation date, everything else developing */
const TIERS = ['ADV', 'DEV', 'LDC'];
const TIER_KO = { ADV: '선진국', DEV: '개발도상국', LDC: '최저개발국' };
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
/* counts and birth shares per tier; shares are rounded so the three add up to 100 */
let tierCache = null;
function tierStats() {
  const day = new Date().toISOString().slice(0, 10);
  if (tierCache && tierCache.day === day) return tierCache;
  const count = { ADV: 0, DEV: 0, LDC: 0 }, births = { ADV: 0, DEV: 0, LDC: 0 };
  LOCS.forEach(l => { const t = tierOf(l); l.tier = t; count[t]++; births[t] += l.births; });
  const share = {}, p2 = {}, p1 = {};
  const h = largestRemainder(TIERS.map(t => births[t] / TOT.births * 10000), 10000);
  const d = largestRemainder(TIERS.map(t => births[t] / TOT.births * 1000), 1000);
  TIERS.forEach((t, i) => { share[t] = births[t] / TOT.births; p2[t] = (h[i] / 100).toFixed(2); p1[t] = (d[i] / 10).toFixed(1); });
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
const NF = new Intl.NumberFormat('ko-KR');
const fmtInt = n => NF.format(Math.round(n));
function roundSig(n, sig) {
  if (n < 100) return Math.round(n);
  const p = Math.pow(10, Math.floor(Math.log10(n)) - sig + 1);
  return Math.round(n / p) * p;
}
function koUnit(n, sig = 3) {
  const r = roundSig(n, sig);
  if (r < 1e4) return fmtInt(r);
  const eok = Math.floor(r / 1e8), man = Math.round((r - eok * 1e8) / 1e4);
  return (eok ? fmtInt(eok) + '억' : '') + (eok && man ? ' ' : '') + (man ? fmtInt(man) + '만' : '');
}
function people(n, sig = 3) {
  if (n < 1) return '1명이 채 안 됩니다';
  const s = koUnit(n, sig);
  return /[만억]$/.test(s) ? s + ' 명' : s + '명';
}
function koCompact(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e6) return fmtInt(n / 1e4) + '만';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
  return fmtInt(n);
}
function fmtPct(p) {
  const v = p * 100;
  if (v >= 10) return v.toFixed(1) + '%';
  if (v >= 0.1) return v.toFixed(2) + '%';
  if (v >= 0.01) return v.toFixed(3) + '%';
  return String(Number(v.toPrecision(2))) + '%';
}
function oneIn(p) {
  const n = 1 / p;
  if (n < 10) return '약 ' + (Math.round(n * 10) / 10).toFixed(1) + '명 중 1명';
  return '약 ' + people(n, 2) + ' 중 1명';
}
function fmtSmall(v) {
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(2);
  return String(Number(v.toPrecision(1)));
}
const usd = v => '$' + fmtInt(v);
const intl = v => fmtInt(v) + ' 국제달러';
const sexKo = s => (s === 'M' ? '남자' : '여자');
const hasJong = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const topic = w => w + (hasJong(w) ? '은' : '는');
const withWa = w => w + (hasJong(w) ? '과' : '와');
function todayKo(t) { const d = t ? new Date(t) : new Date(); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
function dateKo(iso) { const [y, m, d] = iso.split('-').map(Number); return y + '년 ' + m + '월 ' + d + '일'; }
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
  const top = 1 - r;
  if (top <= 0.5) return '상위 ' + Math.max(1, Math.ceil(top * 100 - 1e-9)) + '%';
  return '하위 ' + Math.max(1, Math.ceil(r * 100 - 1e-9)) + '%';
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
function paintSpace() {
  const rnd = mulberry32(20260924), cols = ['#FFFFFF', '#CFE4FF', '#FFE9D6', '#DDEBFF'];
  const neb = [[720, 430, 620, '#1B2A5E', .55], [1180, 120, 520, '#3B1F5E', .45], [180, 820, 480, '#0F3B4A', .4]];
  let defs = '', body = '';
  neb.forEach(([x, y, r, c, o], i) => {
    defs += '<radialGradient id="nb' + i + '" gradientUnits="userSpaceOnUse" cx="' + x + '" cy="' + y + '" r="' + r + '">' +
      '<stop offset="0" stop-color="' + c + '" stop-opacity="' + o + '"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
    body += '<rect width="1440" height="900" fill="url(#nb' + i + ')"/>';
  });
  for (let i = 0; i < 230; i++) {
    const x = rnd() * 1440, y = rnd() * 900, r = 0.5 + rnd() * 0.9, o = 0.25 + rnd() * 0.65, c = cols[Math.floor(rnd() * 4)];
    body += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(2) + '" fill="' + c + '" fill-opacity="' + o.toFixed(2) + '"/>';
  }
  $('#space').innerHTML = '<svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs>' + defs + '</defs>' + body + '</svg>';
}

/* ================= rolling digits ================= */
/* each digit is a 1.1em window over a strip 0-9 x3; the strip stops on the target digit
   after two turns, left digits first. The final value is also given as text for screen readers. */
const STRIP = Array.from({ length: 30 }, (_, i) => i % 10).join(' ');
(function rollKeyframes() {
  const css = Array.from({ length: 10 }, (_, d) => '@keyframes r' + d + ' { 0% { transform: translateY(0); filter: blur(0); } 18% { filter: blur(1.3px); } ' +
    '80% { filter: blur(0); } 100% { transform: translateY(-' + ((20 + d) * 1.1).toFixed(1) + 'em); } }').join('\n');
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
function roll(el, text, base = 0, speed = 1, animate = true) {
  el.textContent = '';
  if (!animate || REDUCED.matches) { el.textContent = text; return; }
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.className = 'roller';
  vis.setAttribute('aria-hidden', 'true');
  let k = 0;
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
    const strip = document.createElement('span');
    strip.className = 'rstrip';
    strip.textContent = STRIP;
    strip.style.animation = 'r' + ch + ' ' + Math.round((850 + 150 * i) * speed) + 'ms ' +
      'cubic-bezier(0.12, 0.72, 0.16, 1) ' + Math.round((base + 45 * i) * speed) + 'ms both';
    win.appendChild(strip);
    vis.appendChild(win);
  }
  el.append(sr, vis);
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
  img.alt = L.ko + ' 국기';
  img.decoding = 'async';
  img.onerror = () => {
    const s = document.createElement('span');
    s.className = 'chip-code';
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', L.ko + ' 국기');
    s.textContent = L.iso2;
    img.replaceWith(s);
  };
  el.appendChild(img);
}

/* font size by name length, then shrink if the name still overflows its box */
function nameClass(ko) { const n = [...ko].length; return n <= 5 ? '' : n <= 8 ? 'n2' : 'n3'; }
function fitName() {
  const el = $('#idName');
  el.style.fontSize = '';
  if (el.classList.contains('empty') || !el.clientWidth) return;
  const probe = el.cloneNode(true);
  probe.removeAttribute('id');
  probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;animation:none;letter-spacing:normal;width:' + el.clientWidth + 'px';
  el.parentNode.appendChild(probe);
  const f0 = parseFloat(getComputedStyle(el).fontSize);
  let f = f0;
  const wrap = el.classList.contains('n3');
  const over = () => wrap ? probe.scrollHeight > f * 1.12 * 2 + 2 : probe.scrollWidth > probe.clientWidth + 1;
  while (f > 18 && over()) { f -= 2; probe.style.fontSize = f + 'px'; }
  probe.remove();
  if (f !== f0) el.style.fontSize = f + 'px';
}

function tierDesc(L) {
  const T = tierStats(), t = tierOf(L), sov = L.sov ? BY.get(L.sov) : null;
  let s;
  if (L.code === 492) s = 'IMF 비회원, 프랑스와 같은 단계로 분류';
  else if (sov && (L.code === 184 || L.code === 570)) s = withWa(sov.ko) + ' 자유연합 관계, 본국의 단계를 따릅니다';
  else if (sov) s = sov.ko + '의 속령, 본국의 단계를 따릅니다';
  else if (t === 'ADV') s = 'IMF 선진경제 ' + D.CLASS.adv.length + '곳 가운데 한 곳';
  else if (t === 'LDC') s = 'UN 최저개발국 ' + T.count.LDC + '곳 가운데 한 곳';
  else s = '선진국도 최저개발국도 아닌 ' + T.count.DEV + '곳 가운데 한 곳';
  const g = D.CLASS.ldc[L.sov || L.code];
  if (g && t === 'LDC') s += ' (' + dateKo(g) + ' 졸업 예정)';
  else if (g && t === 'DEV') s += ' (' + dateKo(g) + ' 최저개발국 졸업)';
  return s;
}

const PP_EMPTY = '태어날 나라가 정해지면 여권이 여기에 놓입니다';
const PP_NONE = '공개 자료에서 이 나라의 여권 표지를 찾지 못했습니다';
function passportHTML(L) {
  const frame = msg => '<div class="pp-frame none"><p class="pp-msg"><span><b>PASSPORT</b>' + msg + '</span></p></div>';
  if (!L) return frame(PP_EMPTY);
  const p = PASSPORT[L.code];
  if (!p) return frame(PP_NONE);
  const sov = p.via && p.via.indexOf('sov:') === 0 ? BY.get(+p.via.slice(4)) : null;
  const who = sov || L;
  const lic = p.license_url ? '<a href="' + esc(p.license_url) + '">' + esc(p.license) + '</a>' : esc(p.license);
  const cc = /^CC BY/i.test(p.license || '');
  return '<div class="pp-frame"><img src="assets/' + esc(p.file) + '" alt="' + esc(who.ko) + ' 일반 여권 앞표지" decoding="async"></div>' +
    '<figcaption class="pp-cap fx-sm">' + (sov ? '본국 ' + esc(sov.ko) + '의 여권. ' : '') +
    '사진: <a href="' + esc(p.page) + '">' + esc(p.artist || '저작자 미상') + '</a>, ' + lic + (cc && p.changes ? ', ' + esc(p.changes) : '') + '</figcaption>';
}
function mountPassport(L) {
  const fig = $('#passport');
  fig.innerHTML = passportHTML(L);
  const img = fig.querySelector('img');
  if (img) img.onerror = () => { fig.innerHTML = passportHTML(null).replace(PP_EMPTY, PP_NONE); };
}

function setRank(id, r) {
  const el = $('#' + id);
  el.classList.toggle('off', r == null);
  el.querySelector('.bar').style.setProperty('--p', r == null ? '0%' : (r * 100).toFixed(2) + '%');
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
  $('#kindL').textContent = st.type === 'lookup' ? '국가 정보 조회' : '2026년 출생 기록';
  const no = $('#kindNo');
  if (draw) roll(no, '제 ' + fmtInt(st.serial) + '호', 0, spd, animate);
  else no.textContent = empty ? '제 — 호' : '';
  const nm = $('#idName');
  nm.className = 'id-name' + (empty ? ' empty' : ' ' + nameClass(L.ko));
  nm.textContent = empty ? '다시 태어나기를 누르면 태어날 나라가 정해집니다.' : L.ko;
  $('#idSex').textContent = empty ? '' : draw ? sexKo(st.sex) : '남녀 전체';
  $('#idEn').textContent = empty ? '' : L.en;
  $('#idEn').className = 'id-en fx-sm';
  $('#idGeo').innerHTML = empty ? '' : esc(SUB[L.sub]) + '<span class="coord">' + coordText(L.lat, L.lng) + '</span>';
  $('#idGeo').className = 'id-geo fx-sm';
  $('#copyBtn').hidden = empty;
  const dash = '—';
  const fact = (dt, dd, sm) => '<div class="fact"><dt>' + dt + '</dt><dd>' + dd + (sm ? '<small class="fx-sm">' + sm + '</small>' : '') + '</dd></div>';
  $('#facts').innerHTML = empty
    ? fact('성별', dash) + fact('인구', dash) + fact('중위연령', dash) + fact('합계출산율', dash)
    : fact('성별', draw ? sexKo(st.sex) : '남녀 전체', '여아 100명당 남아 ' + Math.round(L.srb * 100) + '명') +
      fact('인구', people(L.pop), '세계의 ' + fmtPct(L.pop / TOT.pop)) +
      fact('중위연령', L.med.toFixed(1) + '세', '세계 ' + WR.med.toFixed(1) + '세') +
      fact('합계출산율', L.tfr.toFixed(2) + '명', '세계 ' + WR.tfr.toFixed(2) + '명');
  mountPassport(L);

  /* read-outs */
  const bl = $('#tierBarL');
  if (empty) {
    ['vProb', 'vGdp', 'vLife', 'vTier'].forEach(id => { $('#' + id).textContent = dash; $('#' + id).classList.remove('na'); });
    ['sProb', 'sGdp', 'nGdp', 'wGdp', 'kGdp', 'wLife', 'kLife', 'dTier', 'sTier', 'fLife'].forEach(id => { $('#' + id).textContent = ''; });
    setRank('rGdp', 0); setRank('rLife', 0);
    $('#pips').querySelectorAll('i').forEach(i => i.classList.remove('on'));
    $('#tierBar').innerHTML = '';
    bl.innerHTML = '';
  } else {
    const M = metrics(st);
    roll($('#vProb'), fmtPct(M.share), 80, spd, animate);
    $('#sProb').textContent = oneIn(M.share);
    $('#sProb').className = 'p-sub fx-sm';

    const vg = $('#vGdp'), sg = $('#sGdp');
    $('#wGdp').textContent = '세계 ' + usd(WR.gdpN);
    if (M.gdp.v == null) {
      vg.classList.add('na');
      vg.textContent = '자료 없음';
      $('#nGdp').textContent = '';
      sg.className = 'p-sub memo fx-sm';
      const nNa = LOCS.filter(l => l.gdpN == null).length;
      sg.textContent = 'IMF 세계경제전망에 환율 기준 값이 없는 ' + nNa + '곳 가운데 한 곳입니다.' +
        (L.gdp == null ? '' : ' 구매력 기준 ' + intl(L.gdp) + (L.gdpNote ? '(' + noteKo(L.gdpNote) + ')' : '') + '.');
      setRank('rGdp', null);
      $('#kGdp').textContent = '';
    } else {
      vg.classList.remove('na');
      roll(vg, usd(M.gdp.v), 150, spd, animate);
      $('#nGdp').textContent = L.gdpNNote ? noteKo(L.gdpNNote) + ', 환율 기준' : '2025년, 환율 기준';
      sg.className = 'p-sub fx-sm';
      sg.textContent = '';
      if (M.gdp.ppp == null) sg.textContent = '구매력 기준 값 없음';
      else {
        const n = document.createElement('span');
        roll(n, fmtInt(M.gdp.ppp), 220, spd, animate);
        sg.append('구매력 기준 ', n, ' 국제달러' + (L.gdpNote && L.gdpNote !== L.gdpNNote ? '(' + noteKo(L.gdpNote) + ')' : ''));
      }
      setRank('rGdp', M.gdp.r);
      $('#kGdp').textContent = rankText(M.gdp.r);
    }

    $('#pips').querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k < TIER_PIPS[tier]));
    $('#vTier').textContent = TIER_KO[tier];
    $('#dTier').textContent = tierDesc(L);
    $('#dTier').className = 'tier-desc fx-sm';
    $('#tierBar').innerHTML = TIERS.map(t => '<span class="t-' + t + (t === tier ? ' on' : '') + '" style="width:' + (T.share[t] * 100).toFixed(3) + '%"></span>').join('');
    bl.innerHTML = TIERS.map(t => '<span class="t-' + t + (t === tier ? ' on' : '') + '">' + TIER_KO[t] + ' ' + T.p2[t] + '%</span>').join('');
    $('#sTier').innerHTML = '2026년 아기 100명 중 <b>' + T.p1[tier] + '명</b>이 이 단계의 나라에서 태어납니다.';
    $('#sTier').className = 'tier-say fx-sm';

    const vl = $('#vLife');
    vl.textContent = '';
    const num = document.createElement('span');
    roll(num, M.life.v.toFixed(1), 260, spd, animate);
    const unit = document.createElement('span');
    unit.className = 'unit';
    unit.textContent = '세';
    vl.append(num, unit);
    setRank('rLife', M.life.r);
    $('#wLife').textContent = '세계 ' + M.life.world.toFixed(1) + '세';
    $('#kLife').textContent = rankText(M.life.r);
    $('#fLife').textContent = draw ? '순위는 2026년 세계 ' + (st.sex === 'M' ? '남아' : '여아') + ' 출생아 가운데' : '순위는 2026년 세계 출생아(남녀 전체) 가운데';
  }

  fitName();
  if (animate) { void stage.offsetWidth; stage.classList.add('fx'); }
  PLANET.show(st, { animate, speed: spd });
}

function recordText(st) {
  const L = st.loc, draw = st.type === 'draw', M = metrics(st), lines = [];
  if (draw) {
    lines.push('Rebirth Simulator: 2026년 출생 기록 제 ' + fmtInt(st.serial) + '호, ' + todayKo(st.t));
    lines.push(L.ko + '(' + SUB[L.sub] + '), ' + sexKo(st.sex));
  } else {
    lines.push('Rebirth Simulator: 국가 정보 조회, ' + todayKo());
    lines.push(L.ko + '(' + SUB[L.sub] + '), 남녀 전체');
  }
  lines.push('이 나라에 태어날 확률 ' + fmtPct(M.share) + ', ' + oneIn(M.share));
  const ppp = L.gdp == null ? '' : '(구매력 기준 ' + intl(L.gdp) + ')';
  lines.push(M.gdp.v == null
    ? '1인당 GDP 자료 없음' + ppp + ', 세계 ' + usd(WR.gdpN)
    : '1인당 GDP ' + usd(M.gdp.v) + ppp + ', 세계 ' + usd(WR.gdpN) + ', ' + rankText(M.gdp.r));
  lines.push('발전 단계 ' + TIER_KO[tierOf(L)]);
  lines.push('기대수명 ' + M.life.v.toFixed(1) + '세, 세계 ' + M.life.world.toFixed(1) + '세, ' + rankText(M.life.r));
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
  btn.textContent = ok ? '복사했습니다' : '복사하지 못했습니다';
  setTimeout(() => { if (btn.isConnected) btn.textContent = '결과 복사'; }, 1800);
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
  function stopIdle() { cancelAnimationFrame(idleRaf); idleRaf = 0; }
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
    if (REDUCED.matches) return;
    let last = performance.now();
    const spin = now => {
      if (visible && !document.hidden) {
        if (now - last > 33) {
          view.lon = (view.lon + (now - last) * 0.006) % 360;
          last = now;
          frame(view, false);
        }
      } else last = now;
      idleRaf = requestAnimationFrame(spin);
    };
    idleRaf = requestAnimationFrame(spin);
  }

  function show(st, opt = {}) {
    body.classList.toggle('enter', !!opt.animate && !view);
    if (st.type === 'empty') {
      if (!setup()) { clear(); status(GEO.failed ? 'NO MAP DATA' : 'STANDBY'); hud.code.textContent = 'AWAITING DRAW'; return; }
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

  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }).observe(svg);
  return { show };
})();

/* ================= world map (needs d3) ================= */
const MAP = { ready: false };
let batchCounts = null;

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
    let h = '<b>' + esc(L.ko) + '</b> <span class="t t-' + L.tier + '">' + TIER_KO[L.tier] + '</span><br>2026년 출생아 ' + people(L.births) +
      '<br>이 나라에 태어날 확률 ' + fmtPct(L.births / TOT.births);
    if (batchCounts && batchCounts.has(code)) h += '<br>이번 연속 추첨에서 ' + batchCounts.get(code) + '번';
    tip.innerHTML = h;
    tip.hidden = false;
    const x = ev.clientX - r.left, half = tip.offsetWidth / 2 + 4;
    tip.style.left = Math.min(Math.max(x, half), r.width - half) + 'px';
    tip.style.top = (ev.clientY - r.top) + 'px';
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
}

function mapFail() {
  GEO.failed = true;
  PLANET.show(current, {});
  const msg = $('#mapMsg');
  msg.textContent = '지도를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로 고침하세요. 추첨과 표는 지도 없이도 쓸 수 있습니다.';
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
  $('#lede').innerHTML = '2026년에 태어날 아기 <b>' + koUnit(WR.births, 4) + '</b> 명 가운데 한 명이 됩니다';
  $('#atlasLede').textContent = '나라는 2026년 출생아 수에 비례해, 성별은 그 나라의 출생 성비에 따라 정해집니다. 원이 클수록 그 나라에 태어날 확률이 큽니다.';
  $('#legend').textContent = '원의 크기는 2026년 출생아 수, 색은 발전 단계입니다. 깜박이는 점은 지금 이 순간 태어나는 아기를 실제 속도로 보여 줍니다. 나라를 누르면 위 화면에 그 나라의 정보를 띄웁니다.';
  $('#map').setAttribute('aria-label', '세계 지도. 원의 크기는 나라별 2026년 출생아 수, 색은 발전 단계를 나타냅니다.');
  $('#keys').innerHTML = TIERS.map(t => '<li class="t-' + t + '">' + pipsHTML(t) + TIER_KO[t] + '</li>').join('');
  $('#live').innerHTML = '<span class="rate">초당 탄생<b>' + RATE_B.toFixed(1) + '</b></span><span class="rate">초당 사망<b>' + RATE_D.toFixed(1) + '</b></span>' +
    '<span><span class="dot" aria-hidden="true"></span><span class="since">화면을 연 뒤 </span><b id="liveN">0</b>명 탄생</span>';
}
const T0 = performance.now();
function tickLive() {
  $('#liveN').textContent = fmtInt(Math.floor((performance.now() - T0) / 1000 * RATE_B));
}

function renderMethod() {
  const T = tierStats(), C = D.CLASS;
  const g = Object.entries(C.ldc).filter(([, d]) => d).map(([c, d]) => BY.get(+c).ko + ' ' + dateKo(d)).join(', ');
  $('#tierRules').textContent = '발전 단계는 두 국제기구의 공식 분류를 그대로 따르고, 오늘 날짜(' + todayKo() + ')를 기준으로 계산합니다.';
  $('#tierList').innerHTML =
    '<li class="t-ADV"><b>선진국</b>: ' + esc(C.sources.imf) + '의 선진경제 ' + C.adv.length + '곳과 그 속령. 지금 ' + T.count.ADV + '곳, 2026년 출생아의 ' + T.p2.ADV + '%입니다.</li>' +
    '<li class="t-LDC"><b>최저개발국</b>: ' + esc(C.sources.ldc) + '의 ' + Object.keys(C.ldc).length + '곳. 졸업일이 지나면 개발도상국으로 바뀝니다. 졸업 예정: ' + esc(g) + '. 지금 ' + T.count.LDC + '곳, ' + T.p2.LDC + '%입니다.</li>' +
    '<li class="t-DEV"><b>개발도상국</b>: 나머지 전부. 지금 ' + T.count.DEV + '곳, ' + T.p2.DEV + '%입니다.</li>' +
    '<li>속령과 자유연합국(쿡 제도, 니우에)은 본국의 단계를 따릅니다. 모나코는 IMF 비회원 주권국이라 어느 규칙에도 걸리지 않아 프랑스와 같은 단계로 둡니다. 서사하라, 팔레스타인, 코소보는 선진국의 속령이 아니므로 개발도상국입니다.</li>' +
    '<li>세 비중은 합이 100%가 되도록 반올림했습니다.</li>';
  const pp = Object.entries(PASSPORT).map(([c, p]) => [BY.get(+c), p]).filter(x => x[0]).sort((a, b) => a[0].ko.localeCompare(b[0].ko, 'ko'));
  const own = pp.filter(([, p]) => p.via === 'own').length;
  $('#ppIntro').textContent = pp.length
    ? '여권 표지 이미지는 위키데이터와 위키미디어 공용에서 퍼블릭 도메인, CC0, CC BY, CC BY-SA(2.0 이상)로 공개된 것만 골라 크기를 줄여 실었습니다. ' + own + '곳은 자기 여권, ' + (pp.length - own) + '곳은 본국의 여권이고, 나머지 ' + (LOCS.length - pp.length) + '곳은 쓸 수 있는 이미지를 찾지 못해 빈 틀로 둡니다.'
    : '여권 표지 이미지는 위키데이터와 위키미디어 공용에서 라이선스를 확인할 수 있는 것만 싣습니다. 지금은 수록된 이미지가 없어 모든 나라에 빈 틀을 보여 줍니다.';
  $('#ppList').innerHTML = pp.length
    ? pp.map(([L, p]) => {
      const sov = p.via && p.via.indexOf('sov:') === 0 ? BY.get(+p.via.slice(4)) : null;
      return '<li>' + esc(L.ko) + (sov ? ' (본국 ' + esc(sov.ko) + ')' : '') + ': <a href="' + esc(p.page) + '">' + esc(p.title) + '</a>, ' + esc(p.artist || '저작자 미상') + ', ' + esc(p.license) + (p.changes ? ', ' + esc(p.changes) : '') + (p.restrictions ? ' (' + esc(p.restrictions) + ')' : '') + '</li>';
    }).join('')
    : '<li>수록된 이미지가 없습니다.</li>';
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
  $('#hLede').textContent = '2026년에 태어나는 아기 100명 가운데 ' + cells[a] + '명은 ' + CONT[a] + ', ' + cells[b] + '명은 ' + CONT[b] + '에서 태어납니다. ' +
    rest.map(ci => topic(CONT[ci]) + ' ' + cells[ci] + '명').join(', ') + '입니다.' +
    order.filter(ci => cells[ci] === 0).map(ci => ' ' + topic(CONT[ci]) + ' 1명이 채 안 됩니다.').join('') +
    ' 발전 단계로 나누면 선진국에서 ' + T.p1.ADV + '명, 개발도상국에서 ' + T.p1.DEV + '명, 최저개발국에서 ' + T.p1.LDC + '명이 태어납니다.';
  $('#hTier').innerHTML = TIERS.map(t => '<span class="t-' + t + '" style="flex:' + T.p1[t] + ' 1 0">' + T.p1[t] + '</span>').join('');
  $('#hTier').setAttribute('aria-label', '발전 단계별 아기 수: ' + TIERS.map(t => TIER_KO[t] + ' ' + T.p1[t] + '명').join(', '));
  $('#hTierKeys').innerHTML = TIERS.map(t => '<li class="t-' + t + '"><i></i>' + TIER_KO[t] + ' <b>' + T.p1[t] + '명</b></li>').join('');
  const waffle = $('#waffle');
  waffle.innerHTML = order.map(ci => ('<span class="k' + ci + '"></span>').repeat(cells[ci])).join('');
  waffle.setAttribute('aria-label', order.map(ci => CONT[ci] + ' ' + cells[ci] + '칸').join(', '));
  $('#hLegend').innerHTML = order.map(ci => '<li class="k' + ci + '"><i></i><span>' + CONT[ci] + '</span><b>' + fmtSmall(exact[ci]) + '명</b></li>').join('');
  const top = LOCS.slice().sort((x, y) => y.births - x.births).slice(0, 12);
  const max = top[0].births;
  const row = (l, cls) => '<li class="k' + l.cont + (cls ? ' ' + cls : '') + '"><span class="nm">' + esc(l.ko) + '</span>' +
    '<span class="bar"><b style="--w:' + (l.births / max * 100).toFixed(2) + '%"></b></span><span class="v">' + fmtSmall(l.births / tot * 100) + '명</span></li>';
  const refL = current.type !== 'empty' ? current.loc : BY.get(410);
  $('#hBars').innerHTML = top.map(l => row(l, l === refL ? 'ref' : '')).join('') + (top.includes(refL) ? '' : row(refL, 'ref extra'));
}

/* ================= my records ================= */
let clearArmed = 0;
function renderMine() {
  const st = store.stats, T = tierStats();
  const lede = $('#mLede'), wrap = $('#mCmpWrap');
  if (!st.n) {
    lede.textContent = '아직 뽑은 기록이 없습니다. 위에서 ‘다시 태어나기’를 눌러 첫 기록을 받아 보세요.';
    wrap.hidden = true;
  } else {
    lede.textContent = '지금까지 2026년 출생아로 ' + fmtInt(st.n) + '번 다시 태어났습니다.';
    wrap.hidden = false;
    const tot = TOT.births, exp = CONT.map(() => 0);
    LOCS.forEach(l => { exp[l.cont] += l.births / tot; });
    const order = CONT.map((_, i) => i).sort((a, b) => exp[b] - exp[a]);
    const li = (cls, name, obs, ex) => '<li class="' + cls + '"><span>' + name + '</span><span class="bar"><b style="--w:' + (obs * 100).toFixed(2) + '%"></b><i style="--x:' + (ex * 100).toFixed(2) + '%"></i></span>' +
      '<span class="v">' + (obs * 100).toFixed(1) + '% <small>기대 ' + (ex * 100).toFixed(1) + '%</small></span></li>';
    $('#mCmp').innerHTML = order.map(ci => li('k' + ci, CONT[ci], st.cont[ci] / st.n, exp[ci])).join('');
    $('#mTier').innerHTML = TIERS.map((t, i) => li('t-' + t, TIER_KO[t], st.tier[i] / st.n, T.share[t])).join('');
    const tops = Object.entries(st.top).map(([c, n]) => [BY.get(+c), n]).filter(x => x[0])
      .sort((x, y) => y[1] - x[1] || y[0].births - x[0].births).slice(0, 5);
    $('#mTop').textContent = '가장 많이 나온 곳: ' + tops.map(([l, n]) => l.ko + ' ' + fmtInt(n) + '번(기대 ' + fmtSmall(st.n * l.births / tot) + '번)').join(', ') + '.';
  }
  const list = $('#mRecent');
  if (!store.recent.length) {
    list.innerHTML = '<li><p class="empty-hint">발급된 기록이 여기에 쌓입니다.</p></li>';
  } else {
    list.innerHTML = store.recent.map(r => {
      const l = BY.get(r.c), t = tierOf(l);
      return '<li><button type="button" data-no="' + r.no + '"' + (current.type === 'draw' && current.serial === r.no ? ' aria-current="true"' : '') + '>' +
        '<span class="r-name t-' + t + '"><span class="sr-only">' + TIER_KO[t] + ', </span><span class="r-txt">' + esc(l.ko) + ', ' + sexKo(r.s) + '</span></span>' +
        '<span class="r-no">' + (r.b ? '<small>' + r.b + '번 연속의 끝</small>' : '') + '제 ' + fmtInt(r.no) + '호</span></button></li>';
    }).join('');
  }
  $('#clearBtn').hidden = !store.recent.length && !st.n;
}

/* ================= table ================= */
const COLS = [
  { key: 'name', label: '나라' },
  { key: 'births', label: '2026년 출생아' },
  { key: 'pop', label: '인구' },
  { key: 'prob', label: '태어날 확률' },
  { key: 'tier', label: '발전 단계', cls: 'tl' },
  { key: 'e0B', label: '기대수명' },
  { key: 'gdpN', label: '1인당 GDP($)' },
  { key: 'gdp', label: '구매력 기준' }
];
const TBL = { key: 'prob', dir: -1, q: '', cont: -1, tier: '' };
const norm = s => s.toLowerCase().replace(/[\s·,.'’()\-]/g, '');
/* other names people type: 한국, 남한, 터키, 버마, 스와질란드, USA ... */
const ALIAS = { 410: '한국 남한 korea', 408: '조선 dprk', 840: 'usa us 미합중국', 826: 'uk 잉글랜드 britain', 180: '민주콩고 drc', 178: '콩고',
  792: '터키 turkey', 104: '버마 burma', 748: '스와질란드 swaziland', 384: '아이보리코스트 ivorycoast', 132: '케이프베르데 capeverde',
  807: '마케도니아', 626: '티모르', 784: 'uae 에미리트', 203: 'czechrepublic', 643: 'russianfederation', 158: '타이완', 344: '홍콩', 275: 'palestine' };
LOCS.forEach(l => { l.key = norm(l.ko) + '|' + norm(l.en) + '|' + norm(ALIAS[l.code] || ''); });
function colVal(l, k) { return k === 'prob' ? l.births : k === 'name' ? l.ko : k === 'tier' ? tierIdx(l.tier) : l[k]; }
function renderTableHead() {
  $('#tHead').innerHTML = COLS.map(c => {
    const s = TBL.key === c.key ? ' aria-sort="' + (TBL.dir > 0 ? 'ascending' : 'descending') + '"' : '';
    return '<th scope="col"' + (c.cls ? ' class="' + c.cls + '"' : '') + s + '><button type="button" data-key="' + c.key + '">' + c.label + '</button></th>';
  }).join('');
}
function gdpCell(v, note, f) {
  if (v == null) return '<td class="na" title="자료 없음">—</td>';
  return '<td' + (note ? ' title="' + noteKo(note) + '"' : '') + '>' + f(v) + (note ? '*' : '') + '</td>';
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
    if (k === 'name') return dir * x.localeCompare(y, 'ko');
    return dir * (x - y) || b.births - a.births;
  });
  const cur = current.type !== 'empty' ? current.loc.code : 0;
  $('#tBody').innerHTML = rows.length ? rows.map(l =>
    '<tr' + (l.code === cur ? ' class="cur"' : '') + '><th scope="row"><div class="nm-cell"><span class="chip xs"><img src="assets/flags/' + l.iso2.toLowerCase() + '.svg" alt="" width="22" height="16" loading="lazy" decoding="async"></span>' +
    '<button type="button" class="nm-btn" data-code="' + l.code + '">' + esc(l.ko) + '</button><span class="en">' + esc(l.en) + '</span></div></th>' +
    '<td>' + koCompact(l.births) + '</td><td>' + koCompact(l.pop) + '</td><td>' + fmtPct(l.births / TOT.births) + '</td>' +
    '<td class="tier-c t-' + l.tier + '">' + pipsHTML(l.tier) + TIER_KO[l.tier] + '</td>' +
    '<td>' + l.e0B.toFixed(1) + '</td>' +
    gdpCell(l.gdpN, l.gdpNNote, usd) + gdpCell(l.gdp, l.gdpNote, v => fmtInt(v)) +
    '</tr>').join('') : '<tr><td colspan="8" class="tbl-empty">조건에 맞는 나라가 없습니다. 다른 이름이나 영어 이름으로 찾아 보세요.</td></tr>';
  $('#tCount').textContent = rows.length === LOCS.length ? LOCS.length + '곳' : LOCS.length + '곳 중 ' + rows.length + '곳';
}
/* after a draw only the highlighted row changes, so the 236 rows are not rebuilt */
function markTableRow() {
  const cur = current.type !== 'empty' ? current.loc.code : 0, old = $('#tBody tr.cur');
  if (old) old.classList.remove('cur');
  const b = cur && $('#tBody button[data-code="' + cur + '"]');
  if (b) b.closest('tr').classList.add('cur');
}
/* a missing flag file leaves an empty chip frame instead of a broken image */
$('#tBody').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

/* ================= actions ================= */
function announce(t) { const s = $('#sr'); s.textContent = ''; setTimeout(() => { s.textContent = t; }, 30); }
function smoothTo(el) { el.scrollIntoView({ behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'start' }); }
/* after a lookup or reopening a record from further down the page, bring the result screen back */
function reveal() {
  const r = stage.getBoundingClientRect();
  if (r.top < -window.innerHeight * 0.35 || r.top > window.innerHeight * 0.5) smoothTo(document.body);
}

function fromRecent(r) {
  return { type: 'draw', loc: BY.get(r.c), sex: r.s, serial: r.no, t: r.t };
}

function renderBatch(n, batch, last, tierN) {
  const box = $('#batch'), tot = TOT.births, T = tierStats();
  const cc = CONT.map(() => 0), exp = CONT.map(() => 0);
  batch.forEach((c, code) => { cc[BY.get(code).cont] += c; });
  LOCS.forEach(l => { exp[l.cont] += l.births / tot * n; });
  const order = CONT.map((_, i) => i).sort((a, b) => exp[b] - exp[a]);
  const seg = vals => order.map(ci => vals[ci] > 0 ? '<b class="k' + ci + '" style="--w:' + (vals[ci] / n * 100).toFixed(3) + '%"></b>' : '').join('');
  const tops = [...batch].sort((x, y) => y[1] - x[1] || BY.get(y[0]).births - BY.get(x[0]).births).slice(0, 5);
  box.innerHTML =
    '<div class="batch-h"><h3>이번 ' + n + '번</h3><p>지도의 점이 이번에 나온 곳입니다(색은 발전 단계). 위 화면에는 마지막 제 ' + fmtInt(last.serial) + '호를 띄웠습니다.</p></div>' +
    '<div class="stack" role="img" aria-label="' + esc('대륙별로 이번에 나온 횟수와 기대 횟수. ' + order.map(ci => CONT[ci] + ' ' + cc[ci] + '번, 기대 ' + fmtSmall(exp[ci]) + '번').join('; ')) + '">' +
      '<div class="stack-row"><span>이번</span><span class="stack-bar">' + seg(cc) + '</span></div>' +
      '<div class="stack-row"><span>기대</span><span class="stack-bar exp">' + seg(exp) + '</span></div>' +
    '</div>' +
    '<ul class="stack-keys">' + order.map(ci => '<li class="k' + ci + '"><i></i>' + CONT[ci] + ' <b>' + cc[ci] + '</b><small>기대 ' + fmtSmall(exp[ci]) + '</small></li>').join('') + '</ul>' +
    '<p class="batch-top">가장 많이 나온 곳: ' + tops.map(([c, k]) => esc(BY.get(c).ko) + ' ' + k + '번(기대 ' + fmtSmall(BY.get(c).births / tot * n) + '번)').join(', ') + '.</p>';
  box.hidden = false;
  const line = $('#batchLine');
  line.innerHTML = '이번 ' + n + '번: ' + TIERS.map((t, i) => '<span class="t-' + t + '">' + TIER_KO[t] + ' <b>' + tierN[i] + '</b></span>').join(', ') +
    ' (기대 ' + TIERS.map(t => (T.share[t] * n).toFixed(1)).join(' / ') + ')' +
    '<a href="#atlas" id="toMap">지도에서 보기</a>';
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
    renderBatch(n, batch, last, tierN);
    if (MAP.ready) { MAP.showBatch(batch); MAP.pick(last.loc.code, false); MAP.reset(); }
  }
  renderMine();
  renderHundred();
  markTableRow();
  const L = last.loc;
  announce(n === 1
    ? '제 ' + fmtInt(last.serial) + '호. ' + L.ko + ', ' + sexKo(last.sex) + '로 태어났습니다. 이 나라에 태어날 확률은 ' + fmtPct(L.births / TOT.births) + ', 발전 단계는 ' + TIER_KO[tierOf(L)] + '입니다.'
    : n + '번을 뽑았습니다. 선진국 ' + tierN[0] + '번, 개발도상국 ' + tierN[1] + '번, 최저개발국 ' + tierN[2] + '번입니다. 마지막은 ' + L.ko + '입니다.');
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
  announce('제 ' + fmtInt(no) + '호 기록을 다시 펼쳤습니다. ' + st.loc.ko + ', 발전 단계는 ' + TIER_KO[tierOf(st.loc)] + '입니다.');
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
  announce(L.ko + ' 정보를 띄웠습니다. 발전 단계는 ' + TIER_KO[tierOf(L)] + '입니다.');
  reveal();
}

/* ================= wiring ================= */
$('#draw1').addEventListener('click', () => doDraws(1));
$('#draw10').addEventListener('click', () => doDraws(10));
$('#draw100').addEventListener('click', () => doDraws(100));
$('#draw10').setAttribute('aria-label', '10번 연속');
$('#draw100').setAttribute('aria-label', '100번 연속');
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
$('#contSel').innerHTML = '<option value="-1">모든 대륙</option>' + CONT.map((c, i) => '<option value="' + i + '">' + c + '</option>').join('');
$('#contSel').addEventListener('change', e => { TBL.cont = +e.target.value; renderTable(); });
$('#tierSel').innerHTML = '<option value="">모든 발전 단계</option>' + TIERS.map(t => '<option value="' + t + '">' + TIER_KO[t] + '</option>').join('');
$('#tierSel').addEventListener('change', e => { TBL.tier = e.target.value; renderTable(); });
$('#clearBtn').addEventListener('click', e => {
  const btn = e.currentTarget;
  if (Date.now() - clearArmed > 3500) {
    clearArmed = Date.now();
    btn.textContent = '한 번 더 누르면 지웁니다';
    setTimeout(() => { if (Date.now() - clearArmed >= 3400) btn.textContent = '기록 지우기'; }, 3500);
    return;
  }
  clearArmed = 0;
  btn.textContent = '기록 지우기';
  store.serial = 0; store.recent = []; store.stats = freshStats();
  save();
  if (current.type === 'draw') {
    renderStage({ type: 'empty' }, {});
    if (MAP.ready) MAP.unpick();
  }
  hideBatch();
  renderMine(); renderHundred(); markTableRow();
  announce('기록을 지웠습니다.');
});
$('#tTitle').textContent = LOCS.length + '개 국가·지역 전체';

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
