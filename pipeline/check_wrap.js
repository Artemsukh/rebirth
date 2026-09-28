// Line breaking on the result card (wrap() in src/share.js), without a canvas: measureText is faked
// from a table of character widths. The texts are the real card lines, made by the page's own code
// for every place in all five languages (the note, the life expectancy line, the tier sentence and the
// other metric lines), wrapped at the card's two widths, 408 and 936 px, and at a sweep of widths so
// that breaks fall in many more places. Checks:
//   1. Korean lines break only at spaces (a word wider than the whole line may be cut, nothing else);
//   2. no line starts with a character that may not start a line, or ends with one that may not end it;
//   3. English, Spanish and Russian words are never split;
//   and every line is a piece of the text in order, nothing lost or added.
// node pipeline/check_wrap.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// the rules as the work order gives them, kept apart from the ones in share.js on purpose
const NO_START = '、。，．・：；？！）」』】〕〉》ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ)]},.!?:;%';
const NO_END = '（「『【〔〈《([{';

// character widths in em, close to IBM Plex Sans / Noto Sans
function em(ch) {
  if (/[가-힯ᄀ-ᇿ㄰-㆏]/.test(ch)) return .92;
  if (/[⺀-鿿豈-﫿＀-｠]/.test(ch)) return 1;
  if (ch === ' ') return .23;
  if (/[0-9]/.test(ch)) return .55;
  if (/[A-Z]/.test(ch)) return .62;
  if (/[a-z]/.test(ch)) return .5;
  if (/[А-ЯЁ]/.test(ch)) return .64;
  if (/[а-яё]/.test(ch)) return .52;
  if (/[À-ÿ]/.test(ch)) return .52;
  if (/[.,:;·()'’\-]/.test(ch)) return .28;
  if (ch === '%') return .8;
  return .6;
}
const ctx = {
  font: '400 19px sans-serif',
  measureText(s) { const px = +/(\d+(?:\.\d+)?)px/.exec(this.font)[1]; return { width: [...s].reduce((w, c) => w + em(c) * px, 0) }; }
};

const D = JSON.parse(read('data/appdata.json'));
const covers = JSON.parse(read('data/passports.json'));
const context = vm.createContext({
  window: {}, URL, location: { href: 'https://example.test/', origin: 'https://example.test' },
  document: { querySelector: s => ({ textContent: s === '#app-data' ? JSON.stringify(D) : JSON.stringify(covers) }) },
  getComputedStyle: () => ({ getPropertyValue: () => '' })
});
vm.runInContext(read('src/i18n.js') + '\n' + read('src/share.js'), context);
const app = read('src/app.js');
const prefix = app.slice(app.indexOf("'use strict';"), app.indexOf('/* ================= space backdrop'));
const payloadFn = app.slice(app.indexOf('function cardPayload('), app.indexOf('async function onSaveImage('));
vm.runInContext(prefix + '\nconst stage = {};\n' + payloadFn + '\n' +
  'globalThis.makePayload = (code, lang, type, sex) => { LANG = lang; S = I18N[lang]; return cardPayload({ type, loc: BY.get(code), sex, serial: 42 }); };' +
  '\nglobalThis.codes = LOCS.map(l => l.code); globalThis.wrap = BirthCard.wrap;', context);

// the card lines per language, each text once
const texts = {};
for (const lang of ['ko', 'en', 'ja', 'es', 'ru']) {
  const set = new Set();
  for (const code of context.codes) {
    for (const [type, sex] of [['draw', 'M'], ['draw', 'F'], ['lookup', null]]) {
      const p = context.makePayload(code, lang, type, sex);
      set.add(p.note);
      p.metrics.forEach(m => m.detail && set.add(m.detail));
    }
  }
  texts[lang] = [...set];
}

const widths = [408, 936];
for (let w = 140; w <= 936; w += 12) widths.push(w);
let lineCount = 0, cases = 0;
for (const [lang, list] of Object.entries(texts)) {
  for (const text of list) {
    const norm = text.trim().replace(/\s+/g, ' ');
    for (const width of widths) {
      const lines = context.wrap(ctx, text, width);
      cases++; lineCount += lines.length;
      const where = lang + ' @' + width + ' ' + JSON.stringify(lines);
      // every line is the next piece of the text; a break is either at a space or inside a word
      let pos = 0;
      lines.forEach((line, i) => {
        let atSpace = false;
        if (i && norm[pos] === ' ') { pos++; atSpace = true; }
        assert(norm.startsWith(line, pos), 'lost or changed text: ' + where);
        if (i && !atSpace) {
          // a break inside a word: Japanese may break between characters, Korean only when the word is
          // wider than the line, other languages never
          const start = norm.lastIndexOf(' ', pos) + 1, end = norm.indexOf(' ', pos), word = norm.slice(start, end < 0 ? undefined : end);
          if (lang === 'ko') assert(ctx.measureText(word).width > width, 'Korean word cut though it fits a line (' + word + '): ' + where);
          else assert.equal(lang, 'ja', 'word split (' + word + '): ' + where);
        }
        pos += line.length;
        assert(!NO_START.includes([...line][0]), 'line starts with ' + [...line][0] + ': ' + where);
        assert(!NO_END.includes([...line].pop()), 'line ends with ' + [...line].pop() + ': ' + where);
        assert(!/^[·—–]/.test(line), 'line starts with a separator: ' + where);
      });
      assert.equal(pos, norm.length, 'text left over: ' + where);
    }
  }
}

// small cases with the break forced right where the old wrap went wrong
const at = (text, width) => Array.from(context.wrap(ctx, text, width));
assert.deepEqual(at('뜻하지 않습니다.', 6 * 19), ['뜻하지', '않습니다.']);
assert.deepEqual(at('이 나라에서 태어납니다.', 6 * 19), ['이 나라에서', '태어납니다.']);
assert.deepEqual(at('출생아(남녀 전체) 가운데', 5 * 19), ['출생아(남녀', '전체)', '가운데']);
assert.deepEqual(at('ありません。', 5 * 19), ['ありませ', 'ん。']);
assert.deepEqual(at('「日本」', 2 * 19), ['「日', '本」']);
assert.deepEqual(at('Top 1% · Ranked among', 120), ['Top 1% ·', 'Ranked among']);
console.log('PASS: ' + Object.values(texts).reduce((n, l) => n + l.length, 0) + ' card texts in 5 languages, ' + cases + ' wraps, ' + lineCount + ' lines.');
