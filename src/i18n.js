/* Page text in four languages: I18N.en, .ja, .es, .ko all have the same keys. LANGS is the
   order of the switcher (body.html lists its buttons in the same order); English is the default.
   Plain strings are set with textContent; keys ending in Html are markup written here and are set
   with innerHTML. In body.html, data-t names the key for an element's text, data-th for its markup
   and data-tp for its placeholder. Functions get numbers and dates already formatted for the
   language by app.js, so they only place words around them. Country, continent and subregion
   names live in appdata.json. */
const I18N = (() => {
'use strict';

/* Korean particles: 은/는 and 과/와 depend on whether the last syllable has a final consonant */
const hasJong = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const topic = w => w + (hasJong(w) ? '은' : '는');
const withWa = w => w + (hasJong(w) ? '과' : '와');
/* 'A, B and C' */
const joinAnd = (xs, and, sep = ', ') => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(sep) + and + xs[xs.length - 1];

const ko = {
  locale: 'ko-KR',
  units: { cjk: ['억', '만'], sep: ' ' },
  nameFit: [5, 8],
  ref: 410,
  metaDesc: '2026년에 태어날 아기 1억 3,250만 명 가운데 한 명으로 무작위로 다시 태어나 봅니다. UN 세계인구전망 2024와 IMF 자료로 236개 국가·지역의 출생 확률, 1인당 GDP, 발전 단계, 기대수명을 보여 줍니다.',
  langLabel: '언어',
  comma: ', ', period: '.', sp: ' ',
  paren: s => '(' + s + ')',
  kv: (k, v) => k + ' ' + v,

  skip: '판독값으로 건너뛰기',
  draw1: '다시 태어나기', draw10: '10번 연속', draw100: '100번 연속',
  copy: '결과 복사', copied: '복사했습니다', copyFail: '복사하지 못했습니다',
  lbProb: '이 나라에 태어날 확률', lbGdp: '1인당 GDP', lbTier: '발전 단계', lbLife: '기대수명',
  atlasTitle: '세계 지도', resetMap: '세계 전체 보기',
  hTitle: '세계 출생아를 100명으로 줄이면', hByTier: '발전 단계로 나누면', hByCont: '대륙으로 나누면', hByCountry: '나라별로 보면',
  mTitle: '나의 기록', mByCont: '대륙별로 나온 비율', mByTier: '발전 단계별로 나온 비율',
  mNote: '막대는 실제로 나온 비율, 세로선은 출생아 자료로 기대하는 비율입니다. 많이 뽑을수록 둘이 가까워집니다.',
  mRecent: '최근 기록', clear: '기록 지우기',
  tSub: '이름을 누르면 그 나라의 정보를 위 화면에 띄웁니다. 1인당 GDP는 2025년 값으로, 앞 열은 시장 환율로 바꾼 미국 달러, 뒤 열은 물가 차이를 걷어 낸 구매력 기준 국제달러입니다. *표는 IMF 대신 세계은행이나 UN 값을 쓴 곳입니다.',
  qLabel: '나라 이름 검색', qPh: '나라 이름 검색 (한글 또는 영어)', contLabel: '대륙 선택', tierLabel: '발전 단계 선택',
  tCaption: '나라별 2026년 출생아, 인구, 태어날 확률, 발전 단계, 기대수명, 1인당 GDP(환율 기준, 구매력 기준)',
  dTitle: '자료와 계산 방법',
  mhSrc: '어디서 온 숫자인가',
  mpSrc1Html: '<b>출생아, 인구, 성비, 기대수명, 합계출산율</b>은 국제연합(UN)의 『세계인구전망 2024(World Population Prospects 2024)』 중위 추계에서 2026년 값을 가져왔습니다. 인구는 한 해의 가운데인 7월 1일 기준이며, 세계 합계는 83억 67만 8,396명으로 UN 공식 값과 같습니다. 출생아는 2026년 한 해 동안 태어날 1억 3,250만 3,469명입니다. 중위연령은 UN과 같은 방식으로 한 살 단위 누적 분포를 보간해 구했습니다.',
  mpSrc2Html: '<b>1인당 GDP</b>는 국제통화기금(IMF) 세계경제전망(2026년 4월)의 2025년 추정치를 두 가지로 적었습니다. 큰 숫자는 시장 환율로 바꾼 미국 달러(명목)이고, 순위도 이 값으로 매깁니다. 작은 숫자는 나라 사이 물가 차이를 걷어 낸 구매력평가(PPP) 기준 국제달러입니다. 두 값은 같은 경제를 다른 자로 잰 것이라 차이가 큽니다. 한국은 환율 기준 36,227달러, 구매력 기준 65,405국제달러이고, 인도는 2,675달러와 11,789국제달러입니다. Worldometers가 정리한 IMF 표에서 옮겼고, IMF 값이 없는 곳은 세계은행이나 UN의 다른 해 값을 쓰고 화면과 표에 그 사실을 적었습니다. 환율 기준으로 레위니옹, 코소보, 저지섬처럼 값이 없는 18곳은 비워 두었습니다.',
  mpSrc3Html: '<b>지도</b>는 Natural Earth의 1:5천만 경계를 단순화한 것입니다. UN 통계 단위와 맞추려고 프랑스령 기아나, 과들루프, 마르티니크, 레위니옹, 마요트와 카리브 네덜란드를 본국 윤곽에서 떼어 냈습니다. 지브롤터, 토켈라우, 투발루처럼 윤곽이 남지 않을 만큼 작은 곳은 점으로 표시합니다.',
  mhTier: '발전 단계는 어떻게 나누는가',
  mhDraw: '어떻게 뽑는가',
  mpDraw: '난수는 브라우저의 암호학적 난수 생성기(crypto.getRandomValues)에서 53비트를 꺼내 씁니다. 나라를 2026년 출생아 수에 비례해 고른 뒤, 성별을 그 나라의 출생 성비로 정합니다. 성비가 1.06이면 남자아이가 나올 확률은 1.06 ÷ 2.06, 약 51.5%입니다.',
  mhRank: '순위를 읽는 법',
  mpRank: '순위는 나라 수가 아니라 아기 수로 셉니다. 기록의 ‘상위 3%’는 2026년에 태어나는 같은 성별 아기 가운데 이 나라보다 지표가 좋은 나라에서 태어나는 아기가 약 3%라는 뜻입니다. 같은 나라에서 태어나는 아기는 절반만 셉니다. 지도나 표에서 나라를 골라 조회할 때는 남녀를 합친 2026년 출생아 전체와 비교합니다.',
  mhLimits: '숫자가 말해 주지 않는 것',
  mpLimits: '나라 평균은 나라 안의 격차를 가립니다. 같은 나라라도 지역과 소득, 도시와 농촌에 따라 출발선은 크게 다릅니다. 2026년 값은 모두 추계라서 추계 뒤에 벌어진 전쟁이나 재난은 반영되지 않았을 수 있습니다. 1인당 GDP는 환율 기준이든 구매력 기준이든 평균 생산량을 거칠게 보여 줄 뿐 분배는 말해 주지 않습니다. 발전 단계는 국제기구의 행정 분류일 뿐, 그 나라에서 태어난 한 사람의 삶을 말해 주지 않습니다.',
  mhFlags: '국기',
  mpFlagsHtml: '국기는 <a href="https://github.com/lipis/flag-icons">flag-icons</a>(MIT 라이선스)의 4:3 SVG를 그대로 씁니다. 색과 비율은 바꾸지 않았습니다.',
  colophon: '자료 기준일: UN WPP 2024 중위 추계(2026년), IMF 세계경제전망 2026년 4월판, UN 최저개발국 목록(2024년 12월 19일). 일본어·스페인어 나라 이름: Unicode CLDR.',

  tier: { ADV: '선진국', DEV: '개발도상국', LDC: '최저개발국' },
  sex: { M: '남자', F: '여자' }, both: '남녀 전체',
  note: (src, yr) => ({ WB: '세계은행', UN: 'UN', IMF: 'IMF' }[src] || src) + (yr ? ' ' + yr + '년' : '') + ' 값',
  flagOf: n => n + ' 국기',
  tdMonaco: 'IMF 비회원, 프랑스와 같은 단계로 분류',
  tdAssoc: n => withWa(n) + ' 자유연합 관계, 본국의 단계를 따릅니다',
  tdTerr: n => n + '의 속령, 본국의 단계를 따릅니다',
  tdAdv: n => 'IMF 선진경제 ' + n + '곳 가운데 한 곳',
  tdLdc: n => 'UN 최저개발국 ' + n + '곳 가운데 한 곳',
  tdDev: n => '선진국도 최저개발국도 아닌 ' + n + '곳 가운데 한 곳',
  tdSoon: d => ' (' + d + ' 졸업 예정)',
  tdDone: d => ' (' + d + ' 최저개발국 졸업)',

  kindDraw: '2026년 출생 기록', kindLookup: '국가 정보 조회',
  serial: n => '제 ' + n + '호', serialEmpty: '제 — 호',
  emptyName: '다시 태어나기를 누르면 태어날 나라가 정해집니다.',
  fSex: '성별', fPop: '인구', fMed: '중위연령', fTfr: '합계출산율',
  srb: n => '여아 100명당 남아 ' + n + '명',
  ofWorld: p => '세계의 ' + p,
  world: x => '세계 ' + x,
  years: x => x + '세',
  kids: x => x + '명',
  lifeUnit: '세',
  noData: '자료 없음',
  gdpNa: (n, ppp) => 'IMF 세계경제전망에 환율 기준 값이 없는 ' + n + '곳 가운데 한 곳입니다.' + (ppp ? ' 구매력 기준 ' + ppp + '.' : ''),
  gdpLabel: note => (note || '2025년') + ', 환율 기준',
  noPpp: '구매력 기준 값 없음',
  ppp: ['구매력 기준 ', ' 국제달러'], pppShort: '구매력 기준',
  intl: n => n + ' 국제달러',
  tierSayHtml: p => '2026년 아기 100명 중 <b>' + p + '명</b>이 이 단계의 나라에서 태어납니다.',
  rankScope: s => '순위는 2026년 세계 ' + (s === 'M' ? '남아 출생아' : s === 'F' ? '여아 출생아' : '출생아(남녀 전체)') + ' 가운데',
  top: p => '상위 ' + p, bottom: p => '하위 ' + p,
  oneIn: (c, ppl) => '약 ' + ppl + ' 중 1명',
  people: s => /[만억]$/.test(s) ? s + ' 명' : s + '명',
  lessThanOne: '1명이 채 안 됩니다',

  births2026: '2026년 출생아',
  tipBatch: n => '이번 연속 추첨에서 ' + n + '번',
  mapFail: '지도를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로 고침하세요. 추첨과 표는 지도 없이도 쓸 수 있습니다.',
  ledeHtml: s => '2026년에 태어날 아기 <b>' + s + '</b> 명 가운데 한 명이 됩니다',
  atlasLede: '나라는 2026년 출생아 수에 비례해, 성별은 그 나라의 출생 성비에 따라 정해집니다. 원이 클수록 그 나라에 태어날 확률이 큽니다.',
  legend: '원의 크기는 2026년 출생아 수, 색은 발전 단계입니다. 깜박이는 점은 지금 이 순간 태어나는 아기를 실제 속도로 보여 줍니다. 나라를 누르면 위 화면에 그 나라의 정보를 띄웁니다.',
  mapAria: '세계 지도. 원의 크기는 나라별 2026년 출생아 수, 색은 발전 단계를 나타냅니다.',
  liveB: '초당 탄생', liveD: '초당 사망', liveSince: '화면을 연 뒤 ', liveAfter: '명 탄생',

  tierRules: d => '발전 단계는 두 국제기구의 공식 분류를 그대로 따르고, 오늘 날짜(' + d + ')를 기준으로 계산합니다.',
  gradItem: (n, d) => n + ' ' + d,
  gradSoon: l => '졸업 예정: ' + l + '.',
  gradDone: l => '졸업함: ' + l + '.',
  tierListHtml: o =>
    '<li class="t-ADV"><b>선진국</b>: IMF WEO 2026년 4월 통계 부록 Table B의 선진경제 ' + o.advN + '곳과 그 속령. 지금 ' + o.count.ADV + '곳, 2026년 출생아의 ' + o.pct.ADV + '입니다.</li>' +
    '<li class="t-LDC"><b>최저개발국</b>: UN 최저개발국 목록, 2024년 12월 19일 기준의 ' + o.ldcN + '곳. 졸업일이 지나면 개발도상국으로 바뀝니다. ' + (o.grad ? o.grad + ' ' : '') + '지금 ' + o.count.LDC + '곳, ' + o.pct.LDC + '입니다.</li>' +
    '<li class="t-DEV"><b>개발도상국</b>: 나머지 전부. 지금 ' + o.count.DEV + '곳, ' + o.pct.DEV + '입니다.</li>' +
    '<li>속령과 자유연합국(쿡 제도, 니우에)은 본국의 단계를 따릅니다. 모나코는 IMF 비회원 주권국이라 어느 규칙에도 걸리지 않아 프랑스와 같은 단계로 둡니다. 서사하라, 팔레스타인, 코소보는 선진국의 속령이 아니므로 개발도상국입니다.</li>' +
    '<li>세 비중은 합이 100%가 되도록 반올림했습니다.</li>',

  /* o: first/second [name, count], rest [[name, count]...], zero [name...], tiers {ADV, DEV, LDC} */
  hundredLede: o => '2026년에 태어나는 아기 100명 가운데 ' + o.first[1] + '명은 ' + o.first[0] + ', ' + o.second[1] + '명은 ' + o.second[0] + '에서 태어납니다. ' +
    o.rest.map(([n, c]) => topic(n) + ' ' + c + '명').join(', ') + '입니다.' +
    o.zero.map(n => ' ' + topic(n) + ' 1명이 채 안 됩니다.').join('') +
    ' 발전 단계로 나누면 선진국에서 ' + o.tiers.ADV + '명, 개발도상국에서 ' + o.tiers.DEV + '명, 최저개발국에서 ' + o.tiers.LDC + '명이 태어납니다.',
  hTierAria: l => '발전 단계별 아기 수: ' + l,
  nb: x => x + '명',
  cells: n => n + '칸',

  mineEmpty: '아직 뽑은 기록이 없습니다. 위에서 ‘다시 태어나기’를 눌러 첫 기록을 받아 보세요.',
  mineCount: s => '지금까지 2026년 출생아로 ' + s + '번 다시 태어났습니다.',
  exp: x => '기대 ' + x,
  topItem: (n, c, x) => n + ' ' + c + '번(기대 ' + x + '번)',
  mostFrequent: '가장 많이 나온 곳: ',
  emptyHint: '발급된 기록이 여기에 쌓입니다.',
  lastOf: n => n + '번 연속의 끝',

  cols: { name: '나라', births: '2026년 출생아', pop: '인구', prob: '태어날 확률', tier: '발전 단계', e0B: '기대수명', gdpN: '1인당 GDP($)', gdp: '구매력 기준' },
  tblEmpty: '조건에 맞는 나라가 없습니다. 다른 이름이나 영어 이름으로 찾아 보세요.',
  count: (all, n) => n === all ? all + '곳' : all + '곳 중 ' + n + '곳',
  tTitle: n => n + '개 국가·지역 전체',
  allCont: '모든 대륙', allTier: '모든 발전 단계',

  batchTitle: n => '이번 ' + n + '번',
  batchNote: s => '지도의 점이 이번에 나온 곳입니다(색은 발전 단계). 위 화면에는 마지막 ' + s + '를 띄웠습니다.',
  batchAria: l => '대륙별로 이번에 나온 횟수와 기대 횟수. ' + l,
  batchItem: (n, c, x) => n + ' ' + c + '번, 기대 ' + x + '번',
  rowNow: '이번', rowExp: '기대',
  batchLineHtml: (n, items, x) => '이번 ' + n + '번: ' + items + ' (기대 ' + x + ')',
  toMap: '지도에서 보기',

  drawnOne: (s, n, sex, p, t) => s + '. ' + n + ', ' + sex + '로 태어났습니다. 이 나라에 태어날 확률은 ' + p + ', 발전 단계는 ' + t + '입니다.',
  drawnMany: (k, a, b, c, n) => k + '번을 뽑았습니다. 선진국 ' + a + '번, 개발도상국 ' + b + '번, 최저개발국 ' + c + '번입니다. 마지막은 ' + n + '입니다.',
  reopened: (s, n, t) => s + ' 기록을 다시 펼쳤습니다. ' + n + ', 발전 단계는 ' + t + '입니다.',
  looked: (n, t) => n + ' 정보를 띄웠습니다. 발전 단계는 ' + t + '입니다.',
  clearArm: '한 번 더 누르면 지웁니다', clearArmSay: '기록을 지우려면 한 번 더 누르세요.', cleared: '기록을 지웠습니다.'
};

/* English: "the" before the few sovereign states that take it */
const theEn = (n, code) => ({ 826: 'the United Kingdom', 528: 'the Netherlands', 840: 'the United States' }[code] || n);
const en = {
  locale: 'en-US',
  units: { words: [['billion', 'billion'], ['million', 'million']] },
  nameFit: [8, 12],
  ref: 840,
  metaDesc: 'Be born again at random as one of the 132.5 million babies of 2026. Birth odds, GDP per head, development tier and life expectancy for 236 countries and territories, from UN World Population Prospects 2024 and IMF data.',
  langLabel: 'Language',
  comma: ', ', period: '.', sp: ' ',
  paren: s => ' (' + s + ')',
  kv: (k, v) => k + ': ' + v,

  skip: 'Skip to the read-outs',
  draw1: 'Be born again', draw10: '10 in a row', draw100: '100 in a row',
  copy: 'Copy result', copied: 'Copied', copyFail: 'Could not copy',
  lbProb: 'Chance of being born here', lbGdp: 'GDP per head', lbTier: 'Development tier', lbLife: 'Life expectancy',
  atlasTitle: 'World map', resetMap: 'Show the whole world',
  hTitle: 'If the world’s newborns were 100 babies', hByTier: 'By development tier', hByCont: 'By continent', hByCountry: 'By country',
  mTitle: 'My records', mByCont: 'Share by continent', mByTier: 'Share by development tier',
  mNote: 'Bars show what you actually drew; the vertical line is what the birth data leads you to expect. The more you draw, the closer they get.',
  mRecent: 'Recent records', clear: 'Clear records',
  tSub: 'Click a name to show that country on the screen above. GDP per head is for 2025: the first column is US dollars at market exchange rates, the second is international dollars at purchasing power parity, which removes price differences. * marks places that use a World Bank or UN figure instead of the IMF’s.',
  qLabel: 'Search by country name', qPh: 'Search by country name', contLabel: 'Choose a continent', tierLabel: 'Choose a development tier',
  tCaption: 'By country: 2026 births, population, chance of being born there, development tier, life expectancy and GDP per head (market rates and PPP)',
  dTitle: 'Data and method',
  mhSrc: 'Where the numbers come from',
  mpSrc1Html: '<b>Births, population, sex ratio at birth, life expectancy and total fertility</b> are the 2026 values from the medium scenario of the United Nations <i>World Population Prospects 2024</i>. Population is as of July 1, the middle of the year; the world total of 8,300,678,396 matches the official UN figure. Births are the 132,503,469 babies to be born during 2026. Median age is interpolated from the cumulative distribution by single year of age, the way the UN does it.',
  mpSrc2Html: '<b>GDP per head</b> is the 2025 estimate from the International Monetary Fund (IMF) World Economic Outlook of April 2026, shown two ways. The large number is in US dollars at market exchange rates (nominal), and ranks use this value. The small number is in international dollars at purchasing power parity (PPP), which removes price differences between countries. The two measure the same economy with different rulers, so they can be far apart: South Korea has $36,227 at market rates and Int$65,405 at PPP, India $2,675 and Int$11,789. The figures come from the IMF table compiled by Worldometers; where the IMF has no value, a World Bank or UN value for another year is used and noted on screen and in the table. The 18 places with no market-rate value, such as Réunion, Kosovo and Jersey, are left blank.',
  mpSrc3Html: 'The <b>map</b> simplifies the Natural Earth 1:50m boundaries. To match UN statistical units, French Guiana, Guadeloupe, Martinique, Réunion, Mayotte and the Caribbean Netherlands are cut out of their home countries’ outlines. Places too small to keep an outline, such as Gibraltar, Tokelau and Tuvalu, are shown as dots.',
  mhTier: 'How development tiers are set',
  mhDraw: 'How the draw works',
  mpDraw: 'Random numbers are 53 bits from the browser’s cryptographic random number generator (crypto.getRandomValues). A country is picked in proportion to its 2026 births, then the sex is set by that country’s sex ratio at birth. With a ratio of 1.06, the chance of a boy is 1.06 ÷ 2.06, about 51.5%.',
  mhRank: 'How to read the ranks',
  mpRank: 'Ranks count babies, not countries. “Top 3%” on a record means that of the babies of the same sex born in 2026, about 3% are born in a country that does better on that measure. Babies born in the same country count as half. When you pick a country on the map or in the table, it is compared with all babies born in 2026, boys and girls together.',
  mhLimits: 'What the numbers don’t tell you',
  mpLimits: 'A national average hides the gaps inside a country. Even within one country, the starting line differs widely by region and income, and between city and countryside. All 2026 values are projections, so wars or disasters since the projection was made may not be reflected. GDP per head, at market rates or at PPP, gives only a rough picture of average output and says nothing about how it is shared. A development tier is an administrative label from international organizations; it says nothing about the life of any one person born in that country.',
  mhFlags: 'Flags',
  mpFlagsHtml: 'Flags are the 4:3 SVGs from <a href="https://github.com/lipis/flag-icons">flag-icons</a> (MIT license), used as they are, with colors and proportions unchanged.',
  colophon: 'Data as of: UN WPP 2024 medium scenario (2026), IMF World Economic Outlook April 2026, UN list of least developed countries (December 19, 2024). Japanese and Spanish country names: Unicode CLDR.',

  tier: { ADV: 'Advanced', DEV: 'Developing', LDC: 'Least developed' },
  sex: { M: 'Boy', F: 'Girl' }, both: 'Both sexes',
  note: (src, yr) => ({ WB: 'World Bank', UN: 'UN', IMF: 'IMF' }[src] || src) + (yr ? ' ' + yr : '') + ' figure',
  flagOf: n => 'Flag of ' + n,
  tdMonaco: 'Not an IMF member; grouped with France',
  tdAssoc: (n, c) => 'In free association with ' + theEn(n, c) + '; follows its tier',
  tdTerr: (n, c) => 'Territory of ' + theEn(n, c) + '; follows its tier',
  tdAdv: n => 'One of the ' + n + ' IMF advanced economies',
  tdLdc: n => 'One of the ' + n + ' UN least developed countries',
  tdDev: n => 'One of ' + n + ' places neither advanced nor least developed',
  tdSoon: d => ' (due to graduate on ' + d + ')',
  tdDone: d => ' (left the least developed list on ' + d + ')',

  kindDraw: '2026 birth record', kindLookup: 'Country lookup',
  serial: n => 'No. ' + n, serialEmpty: 'No. —',
  emptyName: 'Press “Be born again” to find out which country you are born in.',
  fSex: 'Sex', fPop: 'Population', fMed: 'Median age', fTfr: 'Fertility rate',
  srb: n => n + ' boys per 100 girls',
  ofWorld: p => p + ' of the world',
  world: x => 'World ' + x,
  years: x => x + ' years',
  kids: x => x + ' per woman',
  lifeUnit: 'years',
  noData: 'No data',
  gdpNa: (n, ppp) => 'One of ' + n + ' places with no market-rate figure in the IMF World Economic Outlook.' + (ppp ? ' At PPP: ' + ppp + '.' : ''),
  gdpLabel: note => (note || '2025') + ', market rates',
  noPpp: 'No PPP figure',
  ppp: ['PPP Int$', ''], pppShort: 'PPP',
  intl: n => 'Int$' + n,
  tierSayHtml: p => '<b>' + p + '</b> of every 100 babies born in 2026 are born in a country at this tier.',
  rankScope: s => 'Ranked among all ' + (s === 'M' ? 'boys' : s === 'F' ? 'girls' : 'babies (both sexes)') + ' born worldwide in 2026',
  top: p => 'Top ' + p, bottom: p => 'Bottom ' + p,
  oneIn: c => 'about 1 in ' + c,
  people: (s, n) => Math.round(n) === 1 ? '1 person' : s + ' people',
  lessThanOne: 'fewer than one person',

  births2026: '2026 births',
  tipBatch: n => 'Drawn ' + n + (n === '1' ? ' time' : ' times') + ' in this run',
  mapFail: 'The map could not be loaded. Check your internet connection and reload. The draw and the table work without the map.',
  ledeHtml: s => 'You become one of the <b>' + s + '</b> babies born in 2026',
  atlasLede: 'The country is chosen in proportion to its 2026 births, and the sex by that country’s sex ratio at birth. The bigger the circle, the bigger the chance of being born there.',
  legend: 'Circle size is 2026 births; color is the development tier. The flashing dots are babies being born right now, at the real rate. Click a country to show it on the screen above.',
  mapAria: 'World map. Circle size shows each country’s 2026 births; color shows the development tier.',
  liveB: 'Births/sec', liveD: 'Deaths/sec', liveSince: 'Since you arrived: ', liveAfter: ' born',

  tierRules: d => 'Development tiers follow the official classifications of two international organizations, as they stand on today’s date (' + d + ').',
  gradItem: (n, d) => n + ' (' + d + ')',
  gradSoon: l => 'Due to graduate: ' + l + '.',
  gradDone: l => 'Graduated: ' + l + '.',
  tierListHtml: o =>
    '<li class="t-ADV"><b>Advanced</b>: the ' + o.advN + ' advanced economies in the IMF World Economic Outlook, April 2026, Statistical Appendix Table B, and their territories. Currently ' + o.count.ADV + ' places, ' + o.pct.ADV + ' of 2026 births.</li>' +
    '<li class="t-LDC"><b>Least developed</b>: the ' + o.ldcN + ' countries on the UN list of least developed countries as of December 19, 2024. A country counts as developing once its graduation date has passed. ' + (o.grad ? o.grad + ' ' : '') + 'Currently ' + o.count.LDC + ' places, ' + o.pct.LDC + '.</li>' +
    '<li class="t-DEV"><b>Developing</b>: everything else. Currently ' + o.count.DEV + ' places, ' + o.pct.DEV + '.</li>' +
    '<li>Territories and freely associated states (Cook Islands, Niue) follow the tier of their sovereign state. Monaco, a sovereign state outside the IMF, fits neither rule and is grouped with France. Western Sahara, Palestine and Kosovo are not territories of an advanced economy, so they are developing.</li>' +
    '<li>The three shares are rounded so that they add up to 100%.</li>',

  hundredLede: o => 'Of every 100 babies born in 2026, ' + o.first[1] + ' are born in ' + o.first[0] + ' and ' + o.second[1] + ' in ' + o.second[0] + '. ' +
    (o.rest.length ? 'Then come ' + joinAnd(o.rest.map(([n, c]) => n + ' with ' + c), ' and ') + '.' : '') +
    (o.zero.length ? ' ' + joinAnd(o.zero, ' and ') + (o.zero.length > 1 ? ' each get' : ' gets') + ' fewer than one.' : '') +
    ' By development tier, ' + o.tiers.ADV + ' are born in advanced economies, ' + o.tiers.DEV + ' in developing countries and ' + o.tiers.LDC + ' in least developed countries.',
  hTierAria: l => 'Babies by development tier: ' + l,
  nb: x => x,
  cells: n => n + (n === 1 ? ' square' : ' squares'),

  mineEmpty: 'No records yet. Press “Be born again” above to get your first one.',
  mineCount: (s, n) => 'So far you have been born again ' + (n === 1 ? 'once' : s + ' times') + ' as a 2026 baby.',
  exp: x => 'exp. ' + x,
  topItem: (n, c, x) => n + ' ' + c + ' (exp. ' + x + ')',
  mostFrequent: 'Most frequent: ',
  emptyHint: 'Your records will pile up here.',
  lastOf: n => 'last of ' + n,

  cols: { name: 'Country', births: '2026 births', pop: 'Population', prob: 'Chance', tier: 'Tier', e0B: 'Life exp.', gdpN: 'GDP/head ($)', gdp: 'PPP (Int$)' },
  tblEmpty: 'No country matches. Try another name.',
  count: (all, n) => n === all ? all + ' places' : n + ' of ' + all + ' places',
  tTitle: n => 'All ' + n + ' countries and territories',
  allCont: 'All continents', allTier: 'All development tiers',

  batchTitle: n => 'This run of ' + n,
  batchNote: s => 'Dots on the map mark where this run landed (color = development tier). The screen above shows the last one, ' + s + '.',
  batchAria: l => 'Draws per continent in this run, with the expected number. ' + l,
  batchItem: (n, c, x) => n + ' ' + c + ', expected ' + x,
  rowNow: 'Now', rowExp: 'Exp.',
  batchLineHtml: (n, items, x) => 'This run of ' + n + ': ' + items + ' (exp. ' + x + ')',
  toMap: 'See on the map',

  drawnOne: (s, n, sex, p, t) => s + '. Born in ' + n + ' as a ' + sex.toLowerCase() + '. Chance of being born here: ' + p + '. Development tier: ' + t + '.',
  drawnMany: (k, a, b, c, n) => 'Drew ' + k + ' times: advanced ' + a + ', developing ' + b + ', least developed ' + c + '. The last one is ' + n + '.',
  reopened: (s, n, t) => 'Reopened record ' + s + '. ' + n + ', development tier: ' + t + '.',
  looked: (n, t) => 'Showing ' + n + '. Development tier: ' + t + '.',
  clearArm: 'Press again to clear', clearArmSay: 'Press again to clear your records.', cleared: 'Records cleared.'
};

const ja = {
  locale: 'ja-JP',
  units: { cjk: ['億', '万'], sep: '' },
  nameFit: [5, 8],
  ref: 392,
  metaDesc: '2026年に生まれる1億3,250万人の赤ちゃんの1人として、ランダムに生まれ変わってみましょう。国連の世界人口推計2024年版とIMFのデータから、236の国・地域の出生確率、1人当たりGDP、発展段階、平均寿命を示します。',
  langLabel: '言語',
  comma: '、', period: '。', sp: '',
  paren: s => '（' + s + '）',
  kv: (k, v) => k + '：' + v,

  skip: '読み取り値へ移動',
  draw1: '生まれ変わる', draw10: '10回連続', draw100: '100回連続',
  copy: '結果をコピー', copied: 'コピーしました', copyFail: 'コピーできませんでした',
  lbProb: 'この国に生まれる確率', lbGdp: '1人当たりGDP', lbTier: '発展段階', lbLife: '平均寿命',
  atlasTitle: '世界地図', resetMap: '世界全体を表示',
  hTitle: '世界の出生児を100人に縮めると', hByTier: '発展段階別に見ると', hByCont: '大陸別に見ると', hByCountry: '国別に見ると',
  mTitle: 'わたしの記録', mByCont: '大陸別の出現率', mByTier: '発展段階別の出現率',
  mNote: '棒は実際に出た割合、縦線は出生データから期待される割合です。回数を重ねるほど、両者は近づきます。',
  mRecent: '最近の記録', clear: '記録を消去',
  tSub: '名前を押すと、その国の情報を上の画面に表示します。1人当たりGDPは2025年の値で、左の列は市場為替レートで換算した米ドル、右の列は物価の差を取り除いた購買力平価ベースの国際ドルです。*印はIMFの代わりに世界銀行または国連の値を使った国・地域です。',
  qLabel: '国名で検索', qPh: '国名で検索（日本語・英語）', contLabel: '大陸を選択', tierLabel: '発展段階を選択',
  tCaption: '国別の2026年出生数、人口、生まれる確率、発展段階、平均寿命、1人当たりGDP（為替レート基準、購買力平価基準）',
  dTitle: 'データと計算方法',
  mhSrc: '数字の出どころ',
  mpSrc1Html: '<b>出生数、人口、出生性比、平均寿命、合計特殊出生率</b>は、国際連合（UN）の『世界人口推計2024年版（World Population Prospects 2024）』中位推計から2026年の値を取りました。人口は年の中間にあたる7月1日時点で、世界の合計は83億67万8,396人と国連の公式値に一致します。出生数は2026年の1年間に生まれる1億3,250万3,469人です。年齢中央値は国連と同じ方法で、1歳刻みの累積分布を補間して求めました。',
  mpSrc2Html: '<b>1人当たりGDP</b>は、国際通貨基金（IMF）の世界経済見通し（2026年4月）による2025年の推計値を2通りで示しています。大きな数字は市場為替レートで換算した米ドル（名目）で、順位もこの値で決めます。小さな数字は国ごとの物価の差を取り除いた購買力平価（PPP）ベースの国際ドルです。2つの値は同じ経済を別の物差しで測ったものなので、差が大きくなります。日本は為替レート基準で35,973ドル、購買力平価で56,854国際ドル、インドは2,675ドルと11,789国際ドルです。数値はWorldometersがまとめたIMFの表から取り、IMFの値がない国・地域は世界銀行や国連の別の年の値を使って、画面と表にその旨を記しました。為替レート基準の値がないレユニオン、コソボ、ジャージーなど18か所は空欄にしています。',
  mpSrc3Html: '<b>地図</b>はNatural Earthの5,000万分の1の境界線を簡略化したものです。国連の統計単位に合わせるため、仏領ギアナ、グアドループ、マルティニーク、レユニオン、マヨット、オランダ領カリブを本国の輪郭から切り離しました。ジブラルタル、トケラウ、ツバルのように輪郭が残らないほど小さい場所は点で示します。',
  mhTier: '発展段階の分け方',
  mhDraw: '抽選の方法',
  mpDraw: '乱数は、ブラウザの暗号論的乱数生成器（crypto.getRandomValues）から53ビットを取り出して使います。国を2026年の出生数に比例して選んだあと、性別をその国の出生性比で決めます。性比が1.06なら、男の子が出る確率は1.06 ÷ 2.06で約51.5%です。',
  mhRank: '順位の読み方',
  mpRank: '順位は国の数ではなく、赤ちゃんの数で数えます。記録の「上位3%」は、2026年に生まれる同じ性別の赤ちゃんのうち、この国より指標のよい国で生まれる赤ちゃんが約3%という意味です。同じ国で生まれる赤ちゃんは半分だけ数えます。地図や表から国を選んで表示するときは、男女を合わせた2026年の出生児全体と比べます。',
  mhLimits: '数字が語らないこと',
  mpLimits: '国の平均は、国内の格差を覆い隠します。同じ国でも、地域や所得、都市か農村かによって出発点は大きく異なります。2026年の値はすべて推計なので、推計のあとに起きた戦争や災害は反映されていないことがあります。1人当たりGDPは、為替レート基準でも購買力平価でも平均的な生産量を大まかに示すだけで、分配については何も語りません。発展段階は国際機関による行政上の分類にすぎず、その国に生まれた一人ひとりの人生を語るものではありません。',
  mhFlags: '国旗',
  mpFlagsHtml: '国旗は<a href="https://github.com/lipis/flag-icons">flag-icons</a>（MITライセンス）の4:3 SVGをそのまま使っています。色と縦横比は変えていません。',
  colophon: 'データの基準：国連 世界人口推計2024年版 中位推計（2026年）、IMF世界経済見通し2026年4月版、国連 後発開発途上国リスト（2024年12月19日）。日本語とスペイン語の国名：Unicode CLDR。',

  tier: { ADV: '先進国', DEV: '開発途上国', LDC: '後発開発途上国' },
  sex: { M: '男の子', F: '女の子' }, both: '男女計',
  note: (src, yr) => ({ WB: '世界銀行', UN: '国連', IMF: 'IMF' }[src] || src) + (yr ? ' ' + yr + '年' : '') + 'の値',
  flagOf: n => n + 'の国旗',
  tdMonaco: 'IMF非加盟、フランスと同じ段階に分類',
  tdAssoc: n => n + 'と自由連合関係にあり、本国の段階に従います',
  tdTerr: n => n + 'の属領で、本国の段階に従います',
  tdAdv: n => 'IMFの先進経済' + n + 'か国・地域のひとつ',
  tdLdc: n => '国連の後発開発途上国' + n + 'か国のひとつ',
  tdDev: n => '先進国でも後発開発途上国でもない' + n + 'か所のひとつ',
  tdSoon: d => '（' + d + 'に卒業予定）',
  tdDone: d => '（' + d + 'に後発開発途上国を卒業）',

  kindDraw: '2026年の出生記録', kindLookup: '国の情報',
  serial: n => '第' + n + '号', serialEmpty: '第—号',
  emptyName: '「生まれ変わる」を押すと、生まれる国が決まります。',
  fSex: '性別', fPop: '人口', fMed: '年齢中央値', fTfr: '合計特殊出生率',
  srb: n => '女児100人に男児' + n + '人',
  ofWorld: p => '世界の' + p,
  world: x => '世界 ' + x,
  years: x => x + '歳',
  kids: x => x + '人',
  lifeUnit: '歳',
  noData: 'データなし',
  gdpNa: (n, ppp) => 'IMFの世界経済見通しに為替レート基準の値がない' + n + 'か所のひとつです。' + (ppp ? '購買力平価では' + ppp + 'です。' : ''),
  gdpLabel: note => (note || '2025年') + '・為替レート基準',
  noPpp: '購買力平価の値なし',
  ppp: ['購買力平価 ', ' 国際ドル'], pppShort: '購買力平価',
  intl: n => n + '国際ドル',
  tierSayHtml: p => '2026年に生まれる赤ちゃん100人のうち<b>' + p + '人</b>が、この段階の国で生まれます。',
  rankScope: s => '順位は2026年に世界で生まれる' + (s === 'M' ? '男児' : s === 'F' ? '女児' : '赤ちゃん（男女計）') + 'の中での位置',
  top: p => '上位' + p, bottom: p => '下位' + p,
  oneIn: c => '約' + c + '人に1人',
  people: s => s + '人',
  lessThanOne: '1人未満',

  births2026: '2026年の出生数',
  tipBatch: n => '今回の連続抽選で' + n + '回',
  mapFail: '地図を読み込めませんでした。インターネット接続を確認してから再読み込みしてください。抽選と表は地図なしでも使えます。',
  ledeHtml: s => '2026年に生まれる赤ちゃん<b>' + s + '</b>人のうちの1人になります',
  atlasLede: '国は2026年の出生数に比例して、性別はその国の出生性比に従って決まります。円が大きいほど、その国に生まれる確率が高くなります。',
  legend: '円の大きさは2026年の出生数、色は発展段階を表します。点滅する点は、いまこの瞬間に生まれている赤ちゃんを実際の速さで示しています。国を押すと、その国の情報を上の画面に表示します。',
  mapAria: '世界地図。円の大きさは国別の2026年出生数、色は発展段階を表します。',
  liveB: '出生/秒', liveD: '死亡/秒', liveSince: 'ページを開いてから', liveAfter: '人誕生',

  tierRules: d => '発展段階は2つの国際機関の公式分類にそのまま従い、今日の日付（' + d + '）を基準に計算します。',
  gradItem: (n, d) => n + '（' + d + '）',
  gradSoon: l => '卒業予定：' + l + '。',
  gradDone: l => '卒業済み：' + l + '。',
  tierListHtml: o =>
    '<li class="t-ADV"><b>先進国</b>：IMF世界経済見通し2026年4月版 統計付録 Table Bの先進経済' + o.advN + 'か国・地域と、その属領。現在' + o.count.ADV + 'か所で、2026年の出生数の' + o.pct.ADV + 'です。</li>' +
    '<li class="t-LDC"><b>後発開発途上国</b>：国連の後発開発途上国リスト（2024年12月19日時点）の' + o.ldcN + 'か国。卒業日を過ぎると開発途上国に変わります。' + o.grad + '現在' + o.count.LDC + 'か所、' + o.pct.LDC + 'です。</li>' +
    '<li class="t-DEV"><b>開発途上国</b>：残りのすべて。現在' + o.count.DEV + 'か所、' + o.pct.DEV + 'です。</li>' +
    '<li>属領と自由連合国（クック諸島、ニウエ）は、本国の段階に従います。モナコはIMFに加盟していない主権国家で、どの規則にも当てはまらないため、フランスと同じ段階とします。西サハラ、パレスチナ、コソボは先進国の属領ではないため、開発途上国です。</li>' +
    '<li>3つの割合は、合計が100%になるように丸めています。</li>',

  hundredLede: o => '2026年に生まれる赤ちゃん100人のうち、' + o.first[1] + '人は' + o.first[0] + '、' + o.second[1] + '人は' + o.second[0] + 'で生まれます。' +
    (o.rest.length ? o.rest.map(([n, c]) => n + 'は' + c + '人').join('、') + 'です。' : '') +
    o.zero.map(n => n + 'は1人未満です。').join('') +
    '発展段階で分けると、先進国で' + o.tiers.ADV + '人、開発途上国で' + o.tiers.DEV + '人、後発開発途上国で' + o.tiers.LDC + '人が生まれます。',
  hTierAria: l => '発展段階別の赤ちゃんの数：' + l,
  nb: x => x + '人',
  cells: n => n + 'マス',

  mineEmpty: 'まだ記録がありません。上の「生まれ変わる」を押して、最初の記録を受け取ってみてください。',
  mineCount: s => 'これまでに2026年生まれとして' + s + '回生まれ変わりました。',
  exp: x => '期待 ' + x,
  topItem: (n, c, x) => n + ' ' + c + '回（期待 ' + x + '回）',
  mostFrequent: '最も多く出た国・地域：',
  emptyHint: '発行された記録がここにたまります。',
  lastOf: n => n + '回連続の最後',

  cols: { name: '国・地域', births: '2026年出生数', pop: '人口', prob: '生まれる確率', tier: '発展段階', e0B: '平均寿命', gdpN: '1人当たりGDP（$）', gdp: '購買力平価' },
  tblEmpty: '条件に合う国がありません。別の名前や英語名で探してみてください。',
  count: (all, n) => n === all ? all + 'か所' : all + 'か所中' + n + 'か所',
  tTitle: n => '全' + n + 'の国・地域',
  allCont: 'すべての大陸', allTier: 'すべての発展段階',

  batchTitle: n => '今回の' + n + '回',
  batchNote: s => '地図上の点が今回出た場所です（色は発展段階）。上の画面には最後の' + s + 'を表示しています。',
  batchAria: l => '大陸別の今回の回数と期待回数。' + l,
  batchItem: (n, c, x) => n + ' ' + c + '回、期待 ' + x + '回',
  rowNow: '今回', rowExp: '期待',
  batchLineHtml: (n, items, x) => '今回の' + n + '回：' + items + '（期待 ' + x + '）',
  toMap: '地図で見る',

  drawnOne: (s, n, sex, p, t) => s + '。' + n + 'で' + sex + 'として生まれました。この国に生まれる確率は' + p + '、発展段階は' + t + 'です。',
  drawnMany: (k, a, b, c, n) => k + '回抽選しました。先進国' + a + '回、開発途上国' + b + '回、後発開発途上国' + c + '回です。最後は' + n + 'です。',
  reopened: (s, n, t) => s + 'の記録をもう一度開きました。' + n + '、発展段階は' + t + 'です。',
  looked: (n, t) => n + 'の情報を表示しました。発展段階は' + t + 'です。',
  clearArm: 'もう一度押すと消去します', clearArmSay: '記録を消去するには、もう一度押してください。', cleared: '記録を消去しました。'
};

/* Spanish: "de" + article for the sovereign states that take one */
const deEs = (n, code) => ({ 826: 'del Reino Unido', 528: 'de los Países Bajos' }[code] || 'de ' + n);
const es = {
  locale: 'es-ES',
  units: { words: [['mil millones', 'mil millones'], ['millón', 'millones']] },
  nameFit: [8, 12],
  ref: 484,
  metaDesc: 'Vuelve a nacer al azar como uno de los 132,5 millones de bebés de 2026. Probabilidad de nacer, PIB per cápita, etapa de desarrollo y esperanza de vida de 236 países y territorios, con datos de la ONU (World Population Prospects 2024) y del FMI.',
  langLabel: 'Idioma',
  comma: ', ', period: '.', sp: ' ',
  paren: s => ' (' + s + ')',
  kv: (k, v) => k + ': ' + v,

  skip: 'Saltar a los resultados',
  draw1: 'Volver a nacer', draw10: '10 veces', draw100: '100 veces',
  copy: 'Copiar resultado', copied: 'Copiado', copyFail: 'No se pudo copiar',
  lbProb: 'Probabilidad de nacer aquí', lbGdp: 'PIB per cápita', lbTier: 'Etapa de desarrollo', lbLife: 'Esperanza de vida',
  atlasTitle: 'Mapa del mundo', resetMap: 'Ver el mundo entero',
  hTitle: 'Si los recién nacidos del mundo fueran 100', hByTier: 'Por etapa de desarrollo', hByCont: 'Por continente', hByCountry: 'Por país',
  mTitle: 'Mis registros', mByCont: 'Proporción por continente', mByTier: 'Proporción por etapa de desarrollo',
  mNote: 'La barra es la proporción que te ha salido; la línea vertical, la que cabe esperar según los datos de nacimientos. Cuantas más veces juegues, más se acercan.',
  mRecent: 'Registros recientes', clear: 'Borrar registros',
  tSub: 'Pulsa un nombre para ver ese país en la pantalla de arriba. El PIB per cápita es de 2025: la primera columna está en dólares estadounidenses a tipo de cambio de mercado y la segunda en dólares internacionales por paridad de poder adquisitivo (PPA), que elimina las diferencias de precios. El asterisco (*) indica que se usa un dato del Banco Mundial o de la ONU en lugar del FMI.',
  qLabel: 'Buscar país', qPh: 'Buscar país (español o inglés)', contLabel: 'Elegir continente', tierLabel: 'Elegir etapa de desarrollo',
  tCaption: 'Por país: nacimientos en 2026, población, probabilidad de nacer, etapa de desarrollo, esperanza de vida y PIB per cápita (a tipo de cambio y por PPA)',
  dTitle: 'Datos y método',
  mhSrc: 'De dónde salen los números',
  mpSrc1Html: '<b>Nacimientos, población, proporción de sexos al nacer, esperanza de vida y tasa global de fecundidad</b> son los valores de 2026 de la variante media de las <i>World Population Prospects 2024</i> (Perspectivas de la Población Mundial) de las Naciones Unidas. La población corresponde al 1 de julio, la mitad del año, y el total mundial, 8.300.678.396 personas, coincide con la cifra oficial de la ONU. Los nacimientos son los 132.503.469 bebés que nacerán a lo largo de 2026. La edad mediana se obtiene interpolando la distribución acumulada por años de edad, igual que hace la ONU.',
  mpSrc2Html: 'El <b>PIB per cápita</b> es la estimación para 2025 de las Perspectivas de la Economía Mundial del Fondo Monetario Internacional (FMI) de abril de 2026, expresada de dos maneras. La cifra grande está en dólares estadounidenses a tipo de cambio de mercado (nominal), y las posiciones se calculan con ella. La cifra pequeña está en dólares internacionales por paridad de poder adquisitivo (PPA), que elimina las diferencias de precios entre países. Son dos reglas distintas para medir la misma economía, así que pueden diferir mucho: México tiene 13.741 dólares a tipo de cambio y 25.682 dólares internacionales por PPA; India, 2675 y 11.789. Los datos proceden de la tabla del FMI recopilada por Worldometers; donde el FMI no tiene dato se usa uno del Banco Mundial o de la ONU de otro año, y así se indica en pantalla y en la tabla. Los 18 lugares sin dato a tipo de cambio, como Reunión, Kosovo o Jersey, quedan en blanco.',
  mpSrc3Html: 'El <b>mapa</b> simplifica los límites a escala 1:50 millones de Natural Earth. Para que coincida con las unidades estadísticas de la ONU, la Guayana Francesa, Guadalupe, Martinica, Reunión, Mayotte y el Caribe neerlandés se han separado del contorno de su país. Los lugares demasiado pequeños para conservar un contorno, como Gibraltar, Tokelau o Tuvalu, se muestran como puntos.',
  mhTier: 'Cómo se asignan las etapas de desarrollo',
  mhDraw: 'Cómo es el sorteo',
  mpDraw: 'Los números aleatorios son 53 bits del generador criptográfico de números aleatorios del navegador (crypto.getRandomValues). Primero se elige el país en proporción a sus nacimientos de 2026 y después el sexo según la proporción de sexos al nacer de ese país. Con una proporción de 1,06, la probabilidad de niño es 1,06 ÷ 2,06, aproximadamente el 51,5 %.',
  mhRank: 'Cómo leer las posiciones',
  mpRank: 'Las posiciones cuentan bebés, no países. «3 % superior» en un registro significa que, de los bebés del mismo sexo nacidos en 2026, alrededor del 3 % nace en un país con mejor valor en ese indicador. Los bebés que nacen en el mismo país cuentan la mitad. Cuando eliges un país en el mapa o en la tabla, se compara con todos los bebés nacidos en 2026, niños y niñas juntos.',
  mhLimits: 'Lo que los números no dicen',
  mpLimits: 'La media nacional oculta las diferencias dentro de cada país. Incluso en un mismo país, el punto de partida cambia mucho según la región, los ingresos o si se nace en la ciudad o en el campo. Todos los valores de 2026 son proyecciones, así que puede que no reflejen guerras o catástrofes posteriores. El PIB per cápita, a tipo de cambio o por PPA, solo da una idea aproximada de la producción media y no dice nada de cómo se reparte. La etapa de desarrollo es una clasificación administrativa de organismos internacionales; no dice nada de la vida de ninguna persona nacida en ese país.',
  mhFlags: 'Banderas',
  mpFlagsHtml: 'Las banderas son los SVG 4:3 de <a href="https://github.com/lipis/flag-icons">flag-icons</a> (licencia MIT), tal cual, sin cambiar colores ni proporciones.',
  colophon: 'Fecha de los datos: variante media de las WPP 2024 de la ONU (2026), Perspectivas de la Economía Mundial del FMI de abril de 2026, lista de países menos adelantados de la ONU (19 de diciembre de 2024). Nombres de países en japonés y español: Unicode CLDR.',

  tier: { ADV: 'Avanzado', DEV: 'En desarrollo', LDC: 'Menos adelantado' },
  sex: { M: 'Niño', F: 'Niña' }, both: 'Ambos sexos',
  note: (src, yr) => 'dato ' + ({ WB: 'del Banco Mundial', UN: 'de la ONU', IMF: 'del FMI' }[src] || 'de ' + src) + (yr ? ' de ' + yr : ''),
  flagOf: n => 'Bandera de ' + n,
  tdMonaco: 'No es miembro del FMI; se agrupa con Francia',
  tdAssoc: n => 'En libre asociación con ' + n + '; sigue la etapa de ese país',
  tdTerr: (n, c) => 'Territorio ' + deEs(n, c) + '; sigue la etapa de ese país',
  tdAdv: n => 'Una de las ' + n + ' economías avanzadas del FMI',
  tdLdc: n => 'Uno de los ' + n + ' países menos adelantados de la ONU',
  tdDev: n => 'Uno de los ' + n + ' lugares que no son ni avanzados ni menos adelantados',
  tdSoon: d => ' (se gradúa el ' + d + ')',
  tdDone: d => ' (dejó de ser país menos adelantado el ' + d + ')',

  kindDraw: 'Registro de nacimiento 2026', kindLookup: 'Consulta de país',
  serial: n => 'N.º ' + n, serialEmpty: 'N.º —',
  emptyName: 'Pulsa «Volver a nacer» para saber en qué país naces.',
  fSex: 'Sexo', fPop: 'Población', fMed: 'Edad mediana', fTfr: 'Fecundidad',
  srb: n => n + ' niños por cada 100 niñas',
  ofWorld: p => p + ' del mundo',
  world: x => 'Mundo: ' + x,
  years: x => x + ' años',
  kids: x => x + ' hijos',
  lifeUnit: 'años',
  noData: 'Sin datos',
  gdpNa: (n, ppp) => 'Es uno de los ' + n + ' lugares sin dato a tipo de cambio en las Perspectivas de la Economía Mundial del FMI.' + (ppp ? ' Por PPA: ' + ppp + '.' : ''),
  gdpLabel: note => (note || '2025') + ', a tipo de cambio',
  noPpp: 'Sin dato por PPA',
  ppp: ['PPA: ', ' dólares internacionales'], pppShort: 'PPA',
  intl: n => n + ' dólares internacionales',
  tierSayHtml: p => 'De cada 100 bebés nacidos en 2026, <b>' + p + '</b> nacen en un país de esta etapa.',
  rankScope: s => 'Posición entre ' + (s === 'M' ? 'los niños' : s === 'F' ? 'las niñas' : 'todos los bebés (ambos sexos)') + ' que nacen en el mundo en 2026',
  top: p => p + ' superior', bottom: p => p + ' inferior',
  oneIn: c => 'aprox. 1 de cada ' + c,
  people: (s, n) => /mill(ón|ones)$/.test(s) ? s + ' de personas' : Math.round(n) === 1 ? '1 persona' : s + ' personas',
  lessThanOne: 'menos de una persona',

  births2026: 'Nacimientos en 2026',
  tipBatch: n => n + (n === '1' ? ' vez' : ' veces') + ' en esta tanda',
  mapFail: 'No se pudo cargar el mapa. Comprueba la conexión a internet y recarga la página. El sorteo y la tabla funcionan sin el mapa.',
  ledeHtml: s => 'Serás uno de los <b>' + s + '</b> de bebés que nacerán en 2026',
  atlasLede: 'El país se elige en proporción a sus nacimientos de 2026 y el sexo, según la proporción de sexos al nacer de ese país. Cuanto mayor es el círculo, mayor es la probabilidad de nacer allí.',
  legend: 'El tamaño del círculo indica los nacimientos de 2026 y el color, la etapa de desarrollo. Los puntos que parpadean son bebés que nacen ahora mismo, al ritmo real. Pulsa un país para ver sus datos en la pantalla de arriba.',
  mapAria: 'Mapa del mundo. El tamaño del círculo indica los nacimientos de 2026 de cada país y el color, la etapa de desarrollo.',
  liveB: 'Nacimientos/s', liveD: 'Muertes/s', liveSince: 'Desde que llegaste: ', liveAfter: ' nacidos',

  tierRules: d => 'Las etapas de desarrollo siguen tal cual las clasificaciones oficiales de dos organismos internacionales y se calculan con la fecha de hoy (' + d + ').',
  gradItem: (n, d) => n + ' (' + d + ')',
  gradSoon: l => 'Graduación prevista: ' + l + '.',
  gradDone: l => 'Ya graduados: ' + l + '.',
  tierListHtml: o =>
    '<li class="t-ADV"><b>Avanzado</b>: las ' + o.advN + ' economías avanzadas del apéndice estadístico (cuadro B) de las Perspectivas de la Economía Mundial del FMI de abril de 2026, y sus territorios. Ahora son ' + o.count.ADV + ' lugares, el ' + o.pct.ADV + ' de los nacimientos de 2026.</li>' +
    '<li class="t-LDC"><b>Menos adelantado</b>: los ' + o.ldcN + ' países de la lista de países menos adelantados de la ONU a 19 de diciembre de 2024. Pasan a estar en desarrollo cuando llega su fecha de graduación. ' + (o.grad ? o.grad + ' ' : '') + 'Ahora son ' + o.count.LDC + ' lugares, el ' + o.pct.LDC + '.</li>' +
    '<li class="t-DEV"><b>En desarrollo</b>: todos los demás. Ahora son ' + o.count.DEV + ' lugares, el ' + o.pct.DEV + '.</li>' +
    '<li>Los territorios dependientes y los Estados en libre asociación (Islas Cook, Niue) siguen la etapa de su Estado soberano. Mónaco, Estado soberano que no es miembro del FMI, no encaja en ninguna regla y se agrupa con Francia. Sáhara Occidental, Palestina y Kosovo no son territorios de una economía avanzada, así que están en desarrollo.</li>' +
    '<li>Las tres proporciones se redondean para que sumen 100 %.</li>',

  hundredLede: o => 'De cada 100 bebés que nacen en 2026, ' + o.first[1] + ' nacen en ' + o.first[0] + ' y ' + o.second[1] + ' en ' + o.second[0] + '. ' +
    (o.rest.length ? 'Les siguen ' + joinAnd(o.rest.map(([n, c]) => n + ' con ' + c), ' y ') + '.' : '') +
    (o.zero.length ? ' ' + joinAnd(o.zero, ' y ') + ', menos de uno.' : '') +
    ' Por etapa de desarrollo, ' + o.tiers.ADV + ' nacen en países avanzados, ' + o.tiers.DEV + ' en países en desarrollo y ' + o.tiers.LDC + ' en países menos adelantados.',
  hTierAria: l => 'Bebés por etapa de desarrollo: ' + l,
  nb: x => x,
  cells: n => n + (n === 1 ? ' casilla' : ' casillas'),

  mineEmpty: 'Todavía no hay registros. Pulsa «Volver a nacer» arriba para conseguir el primero.',
  mineCount: (s, n) => 'Hasta ahora has vuelto a nacer ' + (n === 1 ? 'una vez' : s + ' veces') + ' como bebé de 2026.',
  exp: x => 'esp. ' + x,
  topItem: (n, c, x) => n + ' ' + c + ' (esp. ' + x + ')',
  mostFrequent: 'Lo que más ha salido: ',
  emptyHint: 'Aquí se irán acumulando tus registros.',
  lastOf: n => 'última de ' + n,

  cols: { name: 'País', births: 'Nacimientos 2026', pop: 'Población', prob: 'Probabilidad', tier: 'Etapa', e0B: 'Esp. de vida', gdpN: 'PIB per cápita ($)', gdp: 'PPA' },
  tblEmpty: 'Ningún país cumple las condiciones. Prueba con otro nombre o con el nombre en inglés.',
  count: (all, n) => n === all ? all + ' lugares' : n + ' de ' + all + ' lugares',
  tTitle: n => 'Los ' + n + ' países y territorios',
  allCont: 'Todos los continentes', allTier: 'Todas las etapas',

  batchTitle: n => 'Esta tanda de ' + n,
  batchNote: s => 'Los puntos del mapa son los lugares que han salido en esta tanda (el color indica la etapa de desarrollo). La pantalla de arriba muestra el último, ' + s + '.',
  batchAria: l => 'Veces por continente en esta tanda y veces esperadas. ' + l,
  batchItem: (n, c, x) => n + ' ' + c + ', esperado ' + x,
  rowNow: 'Ahora', rowExp: 'Esp.',
  batchLineHtml: (n, items, x) => 'Esta tanda de ' + n + ': ' + items + ' (esp. ' + x + ')',
  toMap: 'Ver en el mapa',

  drawnOne: (s, n, sex, p, t) => s + '. Has nacido en ' + n + ' como ' + sex.toLowerCase() + '. Probabilidad de nacer en este país: ' + p + '. Etapa de desarrollo: ' + t + '.',
  drawnMany: (k, a, b, c, n) => 'Has sacado ' + k + ' veces: avanzado ' + a + ', en desarrollo ' + b + ', menos adelantado ' + c + '. La última es ' + n + '.',
  reopened: (s, n, t) => 'Se ha vuelto a abrir el registro ' + s + '. ' + n + ', etapa de desarrollo: ' + t + '.',
  looked: (n, t) => 'Mostrando ' + n + '. Etapa de desarrollo: ' + t + '.',
  clearArm: 'Pulsa otra vez para borrar', clearArmSay: 'Para borrar los registros, pulsa otra vez.', cleared: 'Registros borrados.'
};

return { LANGS: ['en', 'ja', 'es', 'ko'], en, ja, es, ko };
})();
