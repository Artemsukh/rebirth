(() => {
'use strict';

/* ================= data ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = JSON.parse($('#app-data').textContent);
const CONT = D.CONT, SUB = D.SUB, WR = D.WORLD, EXA = D.EX_AGES;
const LOCS = D.LOC.map((r, i) => {
  const pm = r[9] / (1 + r[9]);
  return {
    i, code: r[0], ko: r[1], en: r[2], cont: r[3], sub: r[4], lat: r[5], lng: r[6],
    births: r[7], pop: r[8], srb: r[9], e0M: r[10], e0F: r[11], tfr: r[12],
    q0M: r[13], q0F: r[14], q5M: r[15], q5F: r[16], l65M: r[17], l65F: r[18], med: r[19],
    gdp: r[20], gdpNote: r[21], e0B: r[22], gdpN: r[23], gdpNNote: r[24], pm,
    q0B: r[13] * pm + r[14] * (1 - pm), q5B: r[15] * pm + r[16] * (1 - pm), l65B: r[17] * pm + r[18] * (1 - pm)
  };
});
const BY = new Map(LOCS.map(l => [l.code, l]));
const TOT = { births: 0, pop: 0 };
LOCS.forEach(l => { TOT.births += l.births; TOT.pop += l.pop; });
{
  const pm = WR.srb / (1 + WR.srb);
  WR.q0B = WR.q0M * pm + WR.q0F * (1 - pm);
  WR.q5B = WR.q5M * pm + WR.q5F * (1 - pm);
  WR.l65B = WR.l65M * pm + WR.l65F * (1 - pm);
}
const RATE_B = WR.births / (365 * 86400);
const RATE_D = WR.deaths / (365 * 86400);
/* source notes such as 'WB 2024', 'UN 2023', 'WB' (World Bank, same year) */
function noteKo(n) {
  if (!n) return '';
  const [src, yr] = n.split(' ');
  return ({ WB: '세계은행', UN: 'UN', IMF: 'IMF' }[src] || src) + (yr ? ' ' + yr + '년' : '') + ' 값';
}
const REDUCED = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

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
const CUM = { births: makeCum(LOCS.map(l => l.births)), pop: makeCum(LOCS.map(l => l.pop)) };

/* ages: population by sex and single year (0..100+), remaining life expectancy */
function dec36(s, w, scale) {
  const n = s.length / w, out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = parseInt(s.substr(i * w, w), 36) * scale;
  return out;
}
const AGE = new Map();
function ageData(code) {
  let a = AGE.get(code);
  if (a) return a;
  const r = D.AGE[code], sc = r[0] / 46655;
  const pM = dec36(r[3], 3, sc), pF = dec36(r[4], 3, sc);
  const cells = new Float64Array(202); cells.set(pM, 0); cells.set(pF, 101);
  let sM = 0, sF = 0;
  for (let i = 0; i < 101; i++) { sM += pM[i]; sF += pF[i]; }
  a = { pM, pF, exM: dec36(r[1], 2, 0.1), exF: dec36(r[2], 2, 0.1), cum: makeCum(cells), sM, sF };
  AGE.set(code, a);
  return a;
}
function interpEx(arr, age) {
  if (age >= 100) return arr[arr.length - 1];
  for (let j = 0; j < EXA.length - 1; j++) {
    if (age < EXA[j + 1]) return arr[j] + (age - EXA[j]) / (EXA[j + 1] - EXA[j]) * (arr[j + 1] - arr[j]);
  }
  return arr[arr.length - 1];
}

function drawOne(mode) {
  if (mode === 'births') {
    const L = LOCS[pickCum(CUM.births)];
    return { type: 'draw', mode, loc: L, sex: rand() < L.pm ? 'M' : 'F' };
  }
  const L = LOCS[pickCum(CUM.pop)], A = ageData(L.code), j = pickCum(A.cum);
  const sex = j < 101 ? 'M' : 'F', age = j % 101;
  return { type: 'draw', mode, loc: L, sex, age, cell: (sex === 'M' ? A.pM : A.pF)[age] };
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
const per = v => (v < 10 ? v.toFixed(1) : fmtInt(v));
const usd = v => '$' + fmtInt(v);
const ageLabel = a => (a >= 100 ? '100세 이상' : a + '세');
const sexKo = s => (s === 'M' ? '남자' : '여자');
const hasJong = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const topic = w => w + (hasJong(w) ? '은' : '는');
function todayKo(t) { const d = t ? new Date(t) : new Date(); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }

/* ================= storage ================= */
const KEY = 'dasi-taeeonandamyeon-v1';
const freshStats = () => ({ n: 0, cont: [0, 0, 0, 0, 0, 0], top: {} });
let store = { serial: 0, mode: 'births', stats: { births: freshStats(), pop: freshStats() }, recent: [] };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const o = JSON.parse(raw);
    if (o && typeof o.serial === 'number') {
      store.serial = o.serial;
      store.mode = o.mode === 'pop' ? 'pop' : 'births';
      for (const m of ['births', 'pop']) {
        const s = o.stats && o.stats[m];
        if (s && typeof s.n === 'number' && Array.isArray(s.cont) && s.cont.length === 6) store.stats[m] = { n: s.n, cont: s.cont, top: s.top || {} };
      }
      if (Array.isArray(o.recent)) store.recent = o.recent.filter(r => r && BY.has(r.c) && typeof r.no === 'number' && (r.m === 'b' || r.m === 'p') && (r.s === 'M' || r.s === 'F') && (r.m === 'b' || (r.a >= 0 && r.a <= 100))).slice(0, 12);
    }
  }
} catch (e) { /* storage unavailable: keep in memory */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }

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
function metric(label, v, w, fmt, fmtW, higher, vals, ws, opt = {}) {
  const m = { label, note: opt.note || '', sub: opt.sub || '', world: w == null ? '' : '세계 ' + fmtW(w) };
  if (v == null) { m.value = '자료 없음'; m.r = null; return m; }
  m.value = fmt(v);
  m.r = rankPos(vals, ws, v, higher);
  return m;
}
/* headline: nominal US$ at market exchange rates; second line: PPP in international dollars */
const intl = v => fmtInt(v) + ' 국제달러';
function gdpMetric(L, ws) {
  const ppp = L.gdp == null ? '' : '구매력 기준 ' + intl(L.gdp) + (L.gdpNote && L.gdpNote !== L.gdpNNote ? '(' + noteKo(L.gdpNote) + ')' : '');
  return metric('1인당 GDP', L.gdpN, WR.gdpN, usd, usd, true, LOCS.map(l => l.gdpN), ws, {
    note: L.gdpN == null ? '비교할 수 있는 값이 없습니다' : (L.gdpNNote ? noteKo(L.gdpNNote) + ', 환율 기준' : '2025년, 환율 기준'),
    sub: ppp
  });
}
function buildMetrics(st) {
  const L = st.loc, list = [];
  const e0f = v => v.toFixed(1) + '세';
  const qf = v => '1,000명 중 ' + per(v) + '명', qw = v => per(v) + '명';
  const lf = v => (v * 100).toFixed(1) + '%';
  if (st.type === 'draw' && st.mode === 'births') {
    const s = st.sex, ws = LOCS.map(l => l.births * (s === 'M' ? l.pm : 1 - l.pm));
    const col = k => LOCS.map(l => l[k + s]);
    list.push(metric('기대수명', L['e0' + s], WR['e0' + s], e0f, e0f, true, col('e0'), ws));
    list.push(metric('돌 전에 숨질 확률', L['q0' + s], WR['q0' + s], qf, qw, false, col('q0'), ws));
    list.push(metric('다섯 살 전에 숨질 확률', L['q5' + s], WR['q5' + s], qf, qw, false, col('q5'), ws));
    list.push(metric('65세까지 살 확률', L['l65' + s], WR['l65' + s], lf, lf, true, col('l65'), ws));
    list.push(gdpMetric(L, ws));
    return { title: '이 아이의 출발선', note: '순위는 2026년 세계 ' + sexKo(s) + ' 출생아 가운데', list };
  }
  if (st.type === 'draw' && st.mode === 'pop') {
    const s = st.sex, a = st.age;
    const exOf = l => interpEx(ageData(l.code)['ex' + s], a);
    const v = exOf(L);
    const wsCell = LOCS.map(l => ageData(l.code)['p' + s][a]);
    const wsPop = LOCS.map(l => l.pop);
    const yf = x => x.toFixed(1) + '년';
    list.push(metric('남은 기대여명', v, interpEx(WR['ex' + s], a), yf, yf, true, LOCS.map(exOf), wsCell,
      { sub: '약 ' + Math.round(a + v) + '세까지', note: '같은 나이, 같은 성별과 비교' }));
    list.push(metric('이 나라의 기대수명', L['e0' + s], WR['e0' + s], e0f, e0f, true, LOCS.map(l => l['e0' + s]), wsPop, { note: sexKo(s) + ', 2026년 출생아 기준' }));
    list.push(metric('이 나라의 영아사망률', L.q0B, WR.q0B, qf, qw, false, LOCS.map(l => l.q0B), wsPop, { note: '남녀 전체' }));
    list.push(gdpMetric(L, wsPop));
    return { title: '이 사람의 오늘', note: '순위는 세계 인구 가운데', list };
  }
  const wsL = LOCS.map(l => l[st.mode]);
  list.push(metric('기대수명', L.e0B, WR.e0B, e0f, e0f, true, LOCS.map(l => l.e0B), wsL));
  list.push(metric('돌 전에 숨질 확률', L.q0B, WR.q0B, qf, qw, false, LOCS.map(l => l.q0B), wsL));
  list.push(metric('다섯 살 전에 숨질 확률', L.q5B, WR.q5B, qf, qw, false, LOCS.map(l => l.q5B), wsL));
  list.push(metric('65세까지 살 확률', L.l65B, WR.l65B, lf, lf, true, LOCS.map(l => l.l65B), wsL));
  list.push(gdpMetric(L, wsL));
  return { title: '이 나라의 평균', note: '남녀 전체, 순위는 세계 ' + (st.mode === 'births' ? '출생아' : '인구') + ' 가운데', list };
}

/* ================= record ================= */
function guillocheSVG() {
  const w = 480, h = 26, paths = [];
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < 5; i++) {
      const ph = i * 2 * Math.PI / 5 + f * Math.PI / 5, lam = f ? 34 : 41;
      let d = '';
      for (let x = 0; x <= w; x += 2) {
        const amp = h * 0.36 * (0.62 + 0.38 * Math.cos(2 * Math.PI * x / 160 + i * 0.9 + f));
        const y = h / 2 + amp * Math.sin(2 * Math.PI * x / lam + ph);
        d += (x ? 'L' : 'M') + x + ',' + y.toFixed(2);
      }
      paths.push('<path d="' + d + '"/>');
    }
  }
  return '<svg class="guil" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".7" vector-effect="non-scaling-stroke">' + paths.join('') + '</g></svg>';
}
const GUIL = guillocheSVG();

function sealSVG(no, mode, serial, stamp) {
  const ring = mode === 'births' ? 'Rebirth Simulator ★ 2026 출생 등록 ★ ' : 'Rebirth Simulator ★ 2026 인구 등록 ★ ';
  const seed = serial % 97 + 1, rot = -7 - (serial * 37 % 9);
  const fs = no.length > 7 ? 8.5 : 10;
  return '<svg class="seal' + (stamp ? ' stamp' : '') + '" style="--rot:' + rot + 'deg" viewBox="0 0 120 120" aria-hidden="true">' +
    '<defs><path id="sealArc" d="M60,60 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/>' +
    '<filter id="sealInk" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="' + seed + '" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>' +
    '<g filter="url(#sealInk)" fill="currentColor">' +
    '<circle cx="60" cy="60" r="55.5" fill="none" stroke="currentColor" stroke-width="4"/>' +
    '<circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<text font-size="10.5" font-weight="700"><textPath href="#sealArc" textLength="264" lengthAdjust="spacing">' + ring + '</textPath></text>' +
    '<text x="60" y="62" text-anchor="middle" font-size="19" font-weight="700">등록</text>' +
    '<text x="60" y="80" text-anchor="middle" font-size="' + fs + '">' + esc(no) + '</text>' +
    '</g></svg>';
}

let current = { type: 'empty' };
const rec = $('#record');

function emblemHTML(L) {
  const d = MAP.emblemPath ? MAP.emblemPath(L.code) : null;
  if (d) return '<svg viewBox="0 0 96 96" aria-hidden="true"><path class="shape" d="' + d + '"/></svg>';
  return '<svg viewBox="0 0 96 96" aria-hidden="true"><circle class="ring" cx="48" cy="48" r="17"/><circle class="shape" cx="48" cy="48" r="5.5"/></svg>';
}

function metricsHTML(M) {
  return '<div class="metrics"><div class="metrics-h"><h3>' + M.title + '</h3><span>' + M.note + '</span></div>' +
    M.list.map(m => {
      const p = m.r == null ? null : (m.r * 100).toFixed(1);
      return '<div class="metric"><div class="m-label">' + m.label + (m.note ? '<small>' + m.note + '</small>' : '') + '</div>' +
        '<div class="m-val">' + m.value + (m.sub ? '<small>' + m.sub + '</small>' : '') + '</div>' +
        '<div class="m-cmp"><span>' + m.world + '</span>' +
        (p == null ? '<span></span><span></span>' :
          '<span class="strip" style="--p:' + p + '%" aria-hidden="true"><b></b><i></i></span><span class="m-rank">' + rankText(m.r) + '</span>') +
        '</div></div>';
    }).join('') + '</div>';
}

function renderRecord(st, animate) {
  current = st;
  if (st.type === 'empty') {
    const births = store.mode === 'births';
    rec.innerHTML = GUIL + '<div class="rec-body">' +
      '<header class="rec-head"><span>' + (births ? '2026년 출생 기록' : '2026년 인구 기록') + '</span><span class="rec-no">제 &nbsp;&nbsp;&nbsp;&nbsp;호</span></header>' +
      '<div class="rec-id"><div class="photo empty">윤곽</div><div><p class="rec-name blank">빈 기록</p>' +
      '<p class="rec-sub">‘다시 태어나기’를 누르면 이 칸이 채워집니다.</p></div></div>' +
      '<dl class="facts"><div class="fact"><dt>' + (births ? '성별' : '나이와 성별') + '</dt><dd class="blank-line"></dd></div>' +
      '<div class="fact"><dt>이 나라가 나올 확률</dt><dd class="blank-line"></dd></div></dl>' +
      '<p class="empty-note">' + (births
        ? '나라와 성별이 정해지면 그 아이가 받게 될 출발선을 세계와 나란히 적습니다. 기대수명, 돌과 다섯 살 전에 숨질 확률, 65세까지 살 확률, 1인당 GDP입니다.'
        : '나라와 성별, 나이가 정해지면 남은 기대여명과 그 나라의 형편을 세계와 나란히 적습니다.') + '</p>' +
      '<div class="rec-foot"><p class="attest">위와 같이 등록합니다.<span class="date">' + todayKo() + '</span></p><div class="seal-slot">직인</div></div>' +
      '</div>';
    updateStick();
    return;
  }
  const L = st.loc, isDraw = st.type === 'draw';
  const share = L[st.mode] / TOT[st.mode];
  const kind = isDraw ? (st.mode === 'births' ? '2026년 출생 기록' : '2026년 인구 기록') : '국가 정보 조회';
  const no = isDraw ? '제 ' + fmtInt(st.serial) + '호' : '';
  let facts = '';
  if (isDraw && st.mode === 'births') {
    facts = '<div class="fact"><dt>성별</dt><dd>' + sexKo(st.sex) + '<small>여아 100명당 남아 ' + Math.round(L.srb * 100) + '명</small></dd></div>' +
      '<div class="fact"><dt>이 나라가 나올 확률</dt><dd>' + fmtPct(share) + '<small>' + oneIn(share) + '</small></dd></div>';
  } else if (isDraw) {
    facts = '<div class="fact"><dt>나이와 성별</dt><dd>' + ageLabel(st.age) + ' ' + sexKo(st.sex) + '<small>이 나라 중위연령 ' + L.med.toFixed(1) + '세</small></dd></div>' +
      '<div class="fact"><dt>이 나라가 나올 확률</dt><dd>' + fmtPct(share) + '<small>' + oneIn(share) + '</small></dd></div>' +
      '<div class="fact wide">' + esc(L.ko) + '의 ' + ageLabel(st.age) + ' ' + sexKo(st.sex) + (st.cell < 1 ? '는 추계상 <b>1명이 채 안 됩니다.</b>' : '는 약 <b>' + people(st.cell, 2) + '</b>입니다.') + '</div>';
  } else {
    facts = '<div class="fact"><dt>인구</dt><dd>' + people(L.pop) + '<small>세계의 ' + fmtPct(L.pop / TOT.pop) + '</small></dd></div>' +
      '<div class="fact"><dt>2026년 출생아</dt><dd>' + people(L.births) + '<small>세계의 ' + fmtPct(L.births / TOT.births) + '</small></dd></div>';
  }
  const demo = '중위연령 ' + L.med.toFixed(1) + '세(세계 ' + WR.med.toFixed(1) + '세), 합계출산율 ' + L.tfr.toFixed(2) + '명(세계 ' + WR.tfr.toFixed(2) + '명)';
  const ctx = isDraw
    ? (st.mode === 'births'
      ? '인구 ' + people(L.pop) + '(세계의 ' + fmtPct(L.pop / TOT.pop) + '), 2026년 출생아 ' + people(L.births) + '. ' + demo + '.'
      : '인구 ' + people(L.pop) + ', 2026년 출생아 ' + people(L.births) + '(세계의 ' + fmtPct(L.births / TOT.births) + '). ' + demo + '.')
    : demo + '. 출생 성비는 여아 100명당 남아 ' + Math.round(L.srb * 100) + '명이고, ' + (st.mode === 'births' ? '출생아' : '인구') + ' 기준으로 이 나라가 나올 확률은 ' + fmtPct(share) + '(' + oneIn(share) + ')입니다.';
  const foot = isDraw
    ? '<div class="rec-foot"><div><p class="attest">위와 같이 등록합니다.<span class="date">' + todayKo(st.t) + '</span></p>' +
      '<div class="rec-tools"><button type="button" class="btn btn-sm" id="copyBtn">결과 복사</button></div></div>' + sealSVG(no, st.mode, st.serial, animate && st.fresh && !REDUCED.matches) + '</div>'
    : '<div class="rec-foot"><div><p class="attest muted">조회한 나라는 나의 기록에 남지 않습니다.</p>' +
      '<div class="rec-tools"><button type="button" class="btn btn-sm" id="copyBtn">결과 복사</button></div></div></div>';
  rec.innerHTML = GUIL + '<div class="rec-body">' +
    '<header class="rec-head"><span>' + kind + '</span><span class="rec-no">' + no + '</span></header>' +
    '<div class="rec-id"><div class="photo" title="' + esc(L.ko) + ' 윤곽">' + emblemHTML(L) + '</div><div>' +
    '<h2 class="rec-name">' + esc(L.ko) + '</h2><p class="rec-sub">' + esc(L.en) + ', ' + SUB[L.sub] + '</p></div></div>' +
    '<dl class="facts">' + facts + '</dl>' + metricsHTML(buildMetrics(st)) +
    '<p class="ctx">' + ctx + '</p>' + foot + '</div>';
  if (animate && !REDUCED.matches) { rec.classList.remove('swap'); void rec.offsetWidth; rec.classList.add('swap'); }
  $('#copyBtn').addEventListener('click', onCopy);
  updateStick();
}

function recordText(st) {
  const L = st.loc, isDraw = st.type === 'draw';
  const share = L[st.mode] / TOT[st.mode];
  const lines = [];
  if (isDraw) {
    lines.push('Rebirth Simulator: ' + (st.mode === 'births' ? '2026년 출생 기록' : '2026년 인구 기록') + ' 제 ' + fmtInt(st.serial) + '호, ' + todayKo(st.t));
    lines.push(L.ko + '(' + SUB[L.sub] + '), ' + (st.mode === 'births' ? sexKo(st.sex) : ageLabel(st.age) + ' ' + sexKo(st.sex)));
  } else {
    lines.push('Rebirth Simulator: 국가 정보 조회');
    lines.push(L.ko + '(' + SUB[L.sub] + ')');
  }
  lines.push('이 나라가 나올 확률 ' + fmtPct(share) + ', ' + oneIn(share));
  const M = buildMetrics(st);
  M.list.forEach(m => lines.push(m.label + ' ' + m.value + (m.sub ? '(' + m.sub + ')' : '') + (m.world ? ', ' + m.world : '') + (m.r != null ? ', ' + rankText(m.r) : '')));
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
  const ok = await copyText(recordText(current));
  btn.textContent = ok ? '복사했습니다' : '복사하지 못했습니다';
  setTimeout(() => { if (btn.isConnected) btn.textContent = '결과 복사'; }, 1800);
}

/* ================= map (needs d3) ================= */
const MAP = { ready: false };
let batchCounts = null;

function initMap() {
  if (MAP.ready) return;
  const d3 = window.d3, tj = window.topojson;
  if (!d3 || !tj) { mapFail(); return; }
  let topo;
  try { topo = JSON.parse($('#map-data').textContent); } catch (e) { mapFail(); return; }
  const fc = tj.feature(topo, topo.objects.countries);
  const feats = fc.features;
  feats.forEach(f => { f.code = f.properties && f.properties.id ? +f.properties.id : 0; });
  const FEAT = new Map(feats.filter(f => f.code).map(f => [f.code, f]));

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
  const maxV = { births: d3.max(LOCS, l => l.births), pop: d3.max(LOCS, l => l.pop) };
  const rBase = {
    births: LOCS.map(l => Math.max(1.1, 25 * Math.sqrt(l.births / maxV.births))),
    pop: LOCS.map(l => Math.max(1.1, 25 * Math.sqrt(l.pop / maxV.pop)))
  };
  const order = LOCS.map(l => l.i).sort((a, b) => LOCS[b].births - LOCS[a].births);
  const bub = zl.append('g').selectAll('circle').data(order).join('circle')
    .attr('class', i => 'bubble k' + LOCS[i].cont)
    .attr('cx', i => pos[i][0]).attr('cy', i => pos[i][1])
    .attr('r', i => rBase[store.mode][i])
    .attr('data-code', i => LOCS[i].code);
  const pulseG = zl.append('g');
  const batchG = zl.append('g');
  const pinG = zl.append('g').attr('display', 'none');
  const pinRing = pinG.append('circle').attr('class', 'pin-ring').attr('r', 8);
  const pinDot = pinG.append('circle').attr('class', 'pin-dot').attr('r', 2.8);

  let K = 1;
  const resetBtn = $('#resetMap');
  function rescale() {
    const m = store.mode;
    bub.attr('r', i => rBase[m][i] / K);
    pinRing.attr('r', 8 / K); pinDot.attr('r', 2.8 / K);
    batchG.selectAll('circle').attr('r', d => d.r / K);
  }
  const zoom = d3.zoom().on('zoom', ev => {
    const t = ev.transform;
    zl.attr('transform', t);
    K = t.k;
    rescale();
    resetBtn.hidden = t.k < 1.001 && Math.abs(t.x) < 0.5 && Math.abs(t.y) < 0.5;
  });

  function emblemGeom(f) {
    if (f._em) return f._em;
    const g = f.geometry;
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
  const emCache = new Map();
  MAP.emblemPath = code => {
    if (emCache.has(code)) return emCache.get(code);
    const f = FEAT.get(code);
    let d = null;
    const em = f ? emblemGeom(f) : null;
    const b = em ? path.bounds(em.main) : null;
    /* islands only a few pixels wide on the world map, or drawn with a handful of points, get the dot icon */
    if (em && Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) >= 4 && em.main.coordinates[0].length >= 10) {
      const pr = d3.geoAzimuthalEqualArea().rotate([-em.c[0], -em.c[1]]).fitExtent([[6, 6], [90, 90]], em.geo);
      d = d3.geoPath(pr)(em.geo);
    }
    emCache.set(code, d);
    return d;
  };

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
    const ring = pinRing.node();
    ring.classList.remove('ping'); void ring.getBoundingClientRect(); ring.classList.add('ping');
    if (fly) MAP.fly(code);
  };
  MAP.showBatch = counts => {
    batchCounts = counts;
    const data = [...counts].map(([code, n]) => {
      const L = BY.get(code), p = proj([L.lng, L.lat]);
      return { code, n, x: p[0], y: p[1], r: 2 + 2.1 * Math.sqrt(n) };
    }).sort((a, b) => b.n - a.n);
    batchG.selectAll('circle').data(data).join('circle').attr('class', 'bdot')
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r / K).attr('data-code', d => d.code);
  };
  MAP.clearBatch = () => { batchCounts = null; batchG.selectAll('*').remove(); };
  MAP.setMode = m => {
    if (REDUCED.matches) bub.attr('r', i => rBase[m][i] / K);
    else bub.transition().duration(700).attr('r', i => rBase[m][i] / K);
  };

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
    const m = store.mode, share = L[m] / TOT[m];
    let h = '<b>' + esc(L.ko) + '</b><br>' + (m === 'births' ? '2026년 출생아 ' + people(L.births) : '인구 ' + people(L.pop)) +
      '<br>이 나라가 나올 확률 ' + fmtPct(share);
    if (batchCounts && batchCounts.has(code)) h += '<br>이번 연속 추첨에서 ' + batchCounts.get(code) + '번';
    tip.innerHTML = h;
    tip.hidden = false;
    const x = ev.clientX - r.left, half = tip.offsetWidth / 2 + 4;
    tip.style.left = Math.min(Math.max(x, half), r.width - half) + 'px';
    tip.style.top = (ev.clientY - r.top) + 'px';
  }).on('pointerleave', () => { tip.hidden = true; })
    .on('click', ev => { const code = codeAt(ev); if (BY.has(code)) { tip.hidden = true; lookup(code, true); } });

  /* ambient births at the real rate */
  let pulseT = 0, visible = true;
  function allowed() { return visible && !document.hidden && !REDUCED.matches; }
  function spawn() {
    const g = pulseG.node();
    if (g.childElementCount > 48) return;
    const i = pickCum(CUM.births, Math.random());
    const rr = rBase.births[i] * 0.72 / K * Math.sqrt(Math.random()), th = Math.random() * 2 * Math.PI;
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
  if (current.type !== 'empty') {
    MAP.pick(current.loc.code, false);
    renderRecord(current, false);
  }
}

function mapFail() {
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
function renderMode() {
  const m = store.mode;
  $('#m-births').checked = m === 'births';
  $('#m-pop').checked = m === 'pop';
  $('#lede').textContent = m === 'births'
    ? '2026년에 태어날 아기 약 ' + koUnit(WR.births, 4) + ' 명 가운데 한 명으로 다시 태어납니다. 나라는 출생아 수에 비례해, 성별은 그 나라의 출생 성비에 따라 정해집니다.'
    : '2026년 세계 인구 약 ' + koUnit(WR.pop, 2) + ' 명 가운데 한 사람이 됩니다. 나라와 성별, 나이가 모두 실제 인구 구성에 비례해 정해집니다.';
  $('#legend').textContent = (m === 'births' ? '원의 크기는 2026년 출생아 수입니다. ' : '원의 크기는 2026년 인구입니다. ') +
    '깜박이는 점은 지금 이 순간 태어나는 아기를 실제 속도로 보여 줍니다. 나라를 누르면 정보를 볼 수 있습니다.';
  $('#map').setAttribute('aria-label', '세계 지도. 원의 크기는 나라별 ' + (m === 'births' ? '2026년 출생아 수' : '2026년 인구') + '를 나타냅니다.');
}

const T0 = performance.now();
function tickLive() {
  const n = Math.floor((performance.now() - T0) / 1000 * RATE_B);
  $('#live').innerHTML = '지금도 1초에 약 ' + RATE_B.toFixed(1) + '명이 태어나고 ' + RATE_D.toFixed(1) + '명이 세상을 떠납니다. ' +
    '이 페이지를 연 뒤로 약 <b>' + fmtInt(n) + '명</b>이 태어났습니다.';
}

/* ================= 100 people ================= */
function largestRemainder(exact, total) {
  const fl = exact.map(Math.floor);
  let left = total - fl.reduce((a, b) => a + b, 0);
  exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
  return fl;
}
function renderHundred() {
  const m = store.mode, tot = TOT[m];
  const shares = CONT.map(() => 0);
  LOCS.forEach(l => { shares[l.cont] += l[m] / tot; });
  const exact = shares.map(s => s * 100), cells = largestRemainder(exact, 100);
  const order = CONT.map((_, i) => i).sort((a, b) => exact[b] - exact[a]);
  $('#hTitle').textContent = m === 'births' ? '세계 출생아를 100명으로 줄이면' : '세계 인구를 100명으로 줄이면';
  const named = order.filter(ci => cells[ci] > 0);
  const [a, b] = named, rest = named.slice(2);
  $('#hLede').textContent = (m === 'births'
    ? '2026년에 태어나는 아기 100명 가운데 ' + cells[a] + '명은 ' + CONT[a] + ', ' + cells[b] + '명은 ' + CONT[b] + '에서 태어납니다. '
    : '세계 인구 100명 가운데 ' + cells[a] + '명은 ' + CONT[a] + ', ' + cells[b] + '명은 ' + CONT[b] + '에 삽니다. ') +
    rest.map(ci => topic(CONT[ci]) + ' ' + cells[ci] + '명').join(', ') + '입니다.' +
    order.filter(ci => cells[ci] === 0).map(ci => ' ' + topic(CONT[ci]) + ' 1명이 채 안 됩니다.').join('');
  const waffle = $('#waffle');
  waffle.innerHTML = order.map(ci => ('<span class="k' + ci + '"></span>').repeat(cells[ci])).join('');
  waffle.setAttribute('aria-label', order.map(ci => CONT[ci] + ' ' + cells[ci] + '칸').join(', '));
  $('#hLegend').innerHTML = order.map(ci => '<li class="k' + ci + '"><i></i><span>' + CONT[ci] + '</span><b>' + fmtSmall(exact[ci]) + '명</b></li>').join('');
  const top = LOCS.slice().sort((x, y) => y[m] - x[m]).slice(0, 12);
  const max = top[0][m];
  const row = (l, cls) => '<li class="k' + l.cont + (cls ? ' ' + cls : '') + '"><span class="nm">' + esc(l.ko) + '</span>' +
    '<span class="bar"><b style="--w:' + (l[m] / max * 100).toFixed(2) + '%"></b></span><span class="v">' + fmtSmall(l[m] / tot * 100) + '명</span></li>';
  const refL = current.type !== 'empty' ? current.loc : BY.get(410);
  $('#hBars').innerHTML = top.map(l => row(l, l === refL ? 'ref' : '')).join('') + (top.includes(refL) ? '' : row(refL, 'ref'));
}

/* ================= my records ================= */
let clearArmed = 0;
function renderMine() {
  const m = store.mode, st = store.stats[m];
  const lede = $('#mLede'), wrap = $('#mCmpWrap');
  if (!st.n) {
    lede.textContent = (m === 'births' ? '2026년 출생아 기준으로 ' : '2026년 세계 인구 기준으로 ') + '아직 뽑은 기록이 없습니다. 위에서 ‘다시 태어나기’를 눌러 첫 기록을 받아 보세요.';
    wrap.hidden = true;
  } else {
    lede.textContent = '지금까지 ' + (m === 'births' ? '2026년 출생아로 ' : '2026년 세계 인구 가운데 한 사람으로 ') + fmtInt(st.n) + '번 다시 태어났습니다.';
    wrap.hidden = false;
    const tot = TOT[m], exp = CONT.map(() => 0);
    LOCS.forEach(l => { exp[l.cont] += l[m] / tot; });
    const order = CONT.map((_, i) => i).sort((a, b) => exp[b] - exp[a]);
    $('#mCmp').innerHTML = order.map(ci => {
      const obs = st.cont[ci] / st.n;
      return '<li class="k' + ci + '"><span>' + CONT[ci] + '</span><span class="bar"><b style="--w:' + (obs * 100).toFixed(2) + '%"></b><i style="--x:' + (exp[ci] * 100).toFixed(2) + '%"></i></span>' +
        '<span class="v">' + (obs * 100).toFixed(1) + '% <small>기대 ' + (exp[ci] * 100).toFixed(1) + '%</small></span></li>';
    }).join('');
    const tops = Object.entries(st.top).map(([c, n]) => [BY.get(+c), n]).filter(x => x[0])
      .sort((x, y) => y[1] - x[1] || y[0][m] - x[0][m]).slice(0, 5);
    $('#mTop').textContent = '가장 많이 나온 곳: ' + tops.map(([l, n]) => l.ko + ' ' + fmtInt(n) + '번(기대 ' + fmtSmall(st.n * l[m] / tot) + '번)').join(', ') + '.';
  }
  const list = $('#mRecent');
  if (!store.recent.length) {
    list.innerHTML = '<li><p class="empty-hint">발급된 기록이 여기에 쌓입니다.</p></li>';
  } else {
    list.innerHTML = store.recent.map(r => {
      const l = BY.get(r.c);
      const who = r.m === 'b' ? sexKo(r.s) : ageLabel(r.a) + ' ' + sexKo(r.s);
      return '<li><button type="button" data-no="' + r.no + '"' + (current.type === 'draw' && current.serial === r.no ? ' aria-current="true"' : '') + '><span class="r-name">' + esc(l.ko) + ', ' + who + '</span><span class="r-no">' + (r.b ? '<small>' + r.b + '번 연속의 끝</small>' : '') + '제 ' + fmtInt(r.no) + '호</span></button></li>';
    }).join('');
  }
  $('#clearBtn').hidden = !store.recent.length && !store.stats.births.n && !store.stats.pop.n;
}

/* ================= table ================= */
const COLS = [
  { key: 'name', label: '나라' },
  { key: 'births', label: '2026년 출생아' },
  { key: 'pop', label: '인구' },
  { key: 'prob', label: '나올 확률' },
  { key: 'e0B', label: '기대수명' },
  { key: 'q0B', label: '영아사망률(‰)' },
  { key: 'gdpN', label: '1인당 GDP($)' },
  { key: 'gdp', label: '구매력 기준' }
];
const TBL = { key: 'prob', dir: -1, q: '', cont: -1 };
const norm = s => s.toLowerCase().replace(/[\s·,.'’()\-]/g, '');
/* other names people type: 한국, 남한, 터키, 버마, 스와질란드, USA ... */
const ALIAS = { 410: '한국 남한 korea', 408: '조선 dprk', 840: 'usa us 미합중국', 826: 'uk 잉글랜드 britain', 180: '민주콩고 drc', 178: '콩고',
  792: '터키 turkey', 104: '버마 burma', 748: '스와질란드 swaziland', 384: '아이보리코스트 ivorycoast', 132: '케이프베르데 capeverde',
  807: '마케도니아', 626: '티모르', 784: 'uae 에미리트', 203: 'czechrepublic', 643: 'russianfederation', 158: '타이완', 344: '홍콩', 275: 'palestine' };
LOCS.forEach(l => { l.key = norm(l.ko) + '|' + norm(l.en) + '|' + norm(ALIAS[l.code] || ''); });
function colVal(l, k) { return k === 'prob' ? l[store.mode] : k === 'name' ? l.ko : l[k]; }
function renderTableHead() {
  $('#tHead').innerHTML = COLS.map(c => {
    const s = TBL.key === c.key ? ' aria-sort="' + (TBL.dir > 0 ? 'ascending' : 'descending') + '"' : '';
    return '<th scope="col"' + s + '><button type="button" data-key="' + c.key + '">' + c.label + '</button></th>';
  }).join('');
}
function gdpCell(v, note, f) {
  if (v == null) return '<td class="na" title="자료 없음">—</td>';
  return '<td' + (note ? ' title="' + noteKo(note) + '"' : '') + '>' + f(v) + (note ? '*' : '') + '</td>';
}
function renderTable() {
  const q = norm(TBL.q), m = store.mode;
  let rows = LOCS.filter(l => (TBL.cont < 0 || l.cont === TBL.cont) && (!q || l.key.includes(q)));
  const k = TBL.key, dir = TBL.dir;
  rows.sort((a, b) => {
    const x = colVal(a, k), y = colVal(b, k);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (k === 'name') return dir * x.localeCompare(y, 'ko');
    return dir * (x - y);
  });
  const cur = current.type !== 'empty' ? current.loc.code : 0;
  $('#tBody').innerHTML = rows.length ? rows.map(l =>
    '<tr' + (l.code === cur ? ' class="cur"' : '') + '><th scope="row"><button type="button" class="nm-btn" data-code="' + l.code + '">' + esc(l.ko) + '</button><span class="en">' + esc(l.en) + '</span></th>' +
    '<td>' + koCompact(l.births) + '</td><td>' + koCompact(l.pop) + '</td><td>' + fmtPct(l[m] / TOT[m]) + '</td>' +
    '<td>' + l.e0B.toFixed(1) + '</td><td>' + l.q0B.toFixed(1) + '</td>' +
    gdpCell(l.gdpN, l.gdpNNote, usd) + gdpCell(l.gdp, l.gdpNote, v => fmtInt(v)) +
    '</tr>').join('') : '<tr><td colspan="8" class="tbl-empty">‘' + esc(TBL.q) + '’에 맞는 나라가 없습니다. 다른 이름이나 영어 이름으로 찾아 보세요.</td></tr>';
  $('#tCount').textContent = rows.length === LOCS.length ? LOCS.length + '곳' : LOCS.length + '곳 중 ' + rows.length + '곳';
}

/* ================= actions ================= */
function announce(t) { const s = $('#sr'); s.textContent = ''; setTimeout(() => { s.textContent = t; }, 30); }
const NARROW = () => window.innerWidth <= 940;
function smoothTo(el) { el.scrollIntoView({ behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'start' }); }
/* After a draw or lookup: on one-column screens bring the map (fly-to) and the record head into view;
   on two columns the record sits beside the map, so only scroll when it is out of sight. */
function reveal(fromMap) {
  if (NARROW()) {
    const a = $('.atlas').getBoundingClientRect();
    if (!fromMap && (a.top < -4 || a.top > 90)) smoothTo($('.atlas'));
    return;
  }
  const r = rec.getBoundingClientRect();
  if (r.top < -4 || r.top > window.innerHeight * 0.6) smoothTo($('.side'));
}
let stickRO = null;
function updateStick() {
  const side = $('.side');
  if (!side) return;
  const fits = !NARROW() && side.offsetHeight + 40 <= window.innerHeight;
  side.classList.toggle('stick', fits);
}

function fromRecent(r) {
  const loc = BY.get(r.c), mode = r.m === 'b' ? 'births' : 'pop';
  const st = { type: 'draw', mode, loc, sex: r.s, serial: r.no, t: r.t };
  if (mode === 'pop') { st.age = r.a; st.cell = ageData(loc.code)['p' + r.s][r.a]; }
  return st;
}

function renderBatch(n, batch, last) {
  const box = $('#batch'), m = last.mode, tot = TOT[m];
  const cc = CONT.map(() => 0), exp = CONT.map(() => 0);
  batch.forEach((c, code) => { cc[BY.get(code).cont] += c; });
  LOCS.forEach(l => { exp[l.cont] += l[m] / tot * n; });
  const order = CONT.map((_, i) => i).sort((a, b) => exp[b] - exp[a]);
  const seg = vals => order.map(ci => vals[ci] > 0 ? '<b class="k' + ci + '" style="--w:' + (vals[ci] / n * 100).toFixed(3) + '%"></b>' : '').join('');
  const tops = [...batch].sort((x, y) => y[1] - x[1] || BY.get(y[0])[m] - BY.get(x[0])[m]).slice(0, 5);
  box.innerHTML =
    '<div class="batch-h"><h3>이번 ' + n + '번</h3><p>지도의 빨간 점이 이번에 나온 곳입니다. 기록지에는 마지막 제 ' + fmtInt(last.serial) + '호를 적었습니다.</p></div>' +
    '<div class="stack" role="img" aria-label="' + esc('대륙별로 이번에 나온 횟수와 기대 횟수. ' + order.map(ci => CONT[ci] + ' ' + cc[ci] + '번, 기대 ' + fmtSmall(exp[ci]) + '번').join('; ')) + '">' +
      '<div class="stack-row"><span>이번</span><span class="stack-bar">' + seg(cc) + '</span></div>' +
      '<div class="stack-row"><span>기대</span><span class="stack-bar exp">' + seg(exp) + '</span></div>' +
    '</div>' +
    '<ul class="stack-keys">' + order.map(ci => '<li class="k' + ci + '"><i></i>' + CONT[ci] + ' <b>' + cc[ci] + '</b><small>기대 ' + fmtSmall(exp[ci]) + '</small></li>').join('') + '</ul>' +
    '<p class="batch-top">가장 많이 나온 곳: ' + tops.map(([c, k]) => esc(BY.get(c).ko) + ' ' + k + '번(기대 ' + fmtSmall(BY.get(c)[m] / tot * n) + '번)').join(', ') + '.</p>';
  box.hidden = false;
}
function hideBatch() {
  $('#batch').hidden = true;
  if (MAP.ready) MAP.clearBatch();
}

function doDraws(n) {
  const m = store.mode, st = store.stats[m], batch = new Map();
  let last = null;
  for (let k = 0; k < n; k++) {
    const r = drawOne(m);
    r.serial = ++store.serial;
    st.n++; st.cont[r.loc.cont]++;
    st.top[r.loc.code] = (st.top[r.loc.code] || 0) + 1;
    batch.set(r.loc.code, (batch.get(r.loc.code) || 0) + 1);
    last = r;
  }
  const now = Date.now();
  last.t = now; last.fresh = true;
  store.recent.unshift({ no: last.serial, m: m === 'births' ? 'b' : 'p', c: last.loc.code, s: last.sex, a: last.age == null ? null : last.age, t: now, b: n > 1 ? n : 0 });
  store.recent = store.recent.slice(0, 12);
  save();
  renderRecord(last, true);
  if (n === 1) {
    hideBatch();
    if (MAP.ready) MAP.pick(last.loc.code, true);
  } else {
    renderBatch(n, batch, last);
    if (MAP.ready) { MAP.showBatch(batch); MAP.pick(last.loc.code, false); MAP.reset(); }
  }
  renderMine();
  renderHundred();
  renderTable();
  const L = last.loc;
  announce(n === 1
    ? '제 ' + fmtInt(last.serial) + '호. ' + L.ko + ', ' + (m === 'births' ? sexKo(last.sex) : ageLabel(last.age) + ' ' + sexKo(last.sex)) + '로 태어났습니다. 이 나라가 나올 확률은 ' + fmtPct(L[m] / TOT[m]) + '입니다.'
    : n + '번을 뽑았습니다. 마지막은 ' + L.ko + '입니다.');
  reveal(false);
}

function reopen(no) {
  const r = store.recent.find(x => x.no === no);
  if (!r) return;
  const st = fromRecent(r);
  renderRecord(st, true);
  hideBatch();
  if (MAP.ready) MAP.pick(st.loc.code, true);
  renderHundred();
  renderMine();
  renderTable();
  announce('제 ' + fmtInt(no) + '호 기록을 다시 펼쳤습니다. ' + st.loc.ko + '.');
  reveal(false);
}

function lookup(code, fromMap) {
  const L = BY.get(code);
  if (!L) return;
  renderRecord({ type: 'lookup', mode: store.mode, loc: L }, true);
  hideBatch();
  if (MAP.ready) MAP.pick(code, true);
  renderHundred();
  renderMine();
  renderTable();
  announce(L.ko + ' 정보를 기록지에 띄웠습니다.');
  reveal(fromMap);
}

function setMode(m) {
  if (m !== 'births' && m !== 'pop') return;
  store.mode = m;
  save();
  renderMode();
  if (MAP.ready) MAP.setMode(m);
  hideBatch();
  if (current.type === 'empty') renderRecord({ type: 'empty' }, false);
  else if (current.type === 'lookup') renderRecord({ type: 'lookup', mode: m, loc: current.loc }, false);
  renderHundred();
  renderMine();
  renderTable();
}

/* ================= wiring ================= */
$('#draw1').addEventListener('click', () => doDraws(1));
$('#draw10').addEventListener('click', () => doDraws(10));
$('#draw100').addEventListener('click', () => doDraws(100));
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', e => { if (e.target.checked) setMode(e.target.value); }));
$('#mRecent').addEventListener('click', e => { const b = e.target.closest('button[data-no]'); if (b) reopen(+b.dataset.no); });
$('#tBody').addEventListener('click', e => { const b = e.target.closest('button[data-code]'); if (b) lookup(+b.dataset.code, false); });
$('#tHead').addEventListener('click', e => {
  const b = e.target.closest('button[data-key]');
  if (!b) return;
  const k = b.dataset.key;
  if (TBL.key === k) TBL.dir = -TBL.dir;
  else { TBL.key = k; TBL.dir = k === 'name' ? 1 : -1; }
  renderTableHead(); renderTable();
  const nb = $('#tHead button[data-key="' + k + '"]'); if (nb) nb.focus();
});
$('#q').addEventListener('input', e => { TBL.q = e.target.value.trim(); renderTable(); });
$('#contSel').innerHTML = '<option value="-1">모든 대륙</option>' + CONT.map((c, i) => '<option value="' + i + '">' + c + '</option>').join('');
$('#contSel').addEventListener('change', e => { TBL.cont = +e.target.value; renderTable(); });
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
  store.serial = 0; store.recent = []; store.stats = { births: freshStats(), pop: freshStats() };
  save();
  if (current.type === 'draw') renderRecord({ type: 'empty' }, false);
  hideBatch();
  renderMine(); renderHundred(); renderTable();
  announce('기록을 지웠습니다.');
});
$('#keys').innerHTML = CONT.map((c, i) => '<li class="k' + i + '"><i></i>' + c + '</li>').join('');
$('#tTitle').textContent = LOCS.length + '개 국가·지역 전체';

renderMode();
renderRecord(store.recent.length ? fromRecent(store.recent[0]) : { type: 'empty' }, false);
renderHundred();
renderMine();
renderTableHead();
renderTable();
tickLive();
setInterval(tickLive, 1000);
window.addEventListener('resize', updateStick);
if ('ResizeObserver' in window) { stickRO = new ResizeObserver(updateStick); stickRO.observe($('.side')); }

if (window.d3) initMap();
else loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js')
  .catch(() => loadScript('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'))
  .then(initMap, mapFail);
})();
