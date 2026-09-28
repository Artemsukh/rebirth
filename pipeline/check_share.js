// Offline canvas check using the production renderer and production result formatting.
// npm install --no-save @napi-rs/canvas
// CARD_TEST_FONT=/path/to/CJK-font.otf node pipeline/check_share.js [preview-directory]
// This does not replace testing downloads and Web Share on a real browser/device.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const { createCanvas, Image, GlobalFonts } = require('@napi-rs/canvas');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const D = JSON.parse(read('data/appdata.json'));
const covers = JSON.parse(read('data/passports.json'));
const sources = JSON.parse(read('data/passport-sources.json'));
const missing = JSON.parse(read('data/passports-missing.json'));
const locs = D.LOC.map(r => Object.fromEntries(D.LOC_FIELDS.map((k, i) => [k, r[i]])));
const credits = read('passport-credits.html');
assert.equal(sources.length, Object.keys(covers).length);
assert.equal(new Set([...sources, ...missing].map(a => a.code)).size, locs.length);
assert.equal(sources.length + missing.length, locs.length);
for (const a of sources) {
  assert(locs.some(l => l.code === a.code));
  assert.equal(covers[a.code].file, a.file);
  assert(fs.existsSync(path.join(root, a.file)), a.file);
  assert(a.author && a.license && a.licenseUrl && a.source, a.country + ' attribution');
  assert(credits.includes('id="p' + a.code + '"'), a.country + ' credit anchor');
}
for (const a of missing) assert(!covers[a.code], a.country + ' fallback');
if (process.env.CARD_TEST_FONT) assert(GlobalFonts.registerFromPath(process.env.CARD_TEST_FONT, 'CardTest'), 'font registration');
const testFont = process.env.CARD_TEST_FONT ? 'CardTest' : 'sans-serif';
class LocalImage extends Image {
  get naturalWidth() { return this.width; }
  get naturalHeight() { return this.height; }
  set src(url) {
    const file = path.join(root, new URL(url).pathname.replace(/^\/rebirth\//, ''));
    if (!fs.existsSync(file)) { queueMicrotask(() => this.onerror && this.onerror(new Error('Missing image'))); return; }
    super.src = fs.readFileSync(file);
  }
}
const drawn = [];
const document = {
  fonts: { ready: Promise.resolve() },
  querySelector: s => ({ textContent: s === '#app-data' ? JSON.stringify(D) : JSON.stringify(covers) }),
  createElement: tag => {
    assert.equal(tag, 'canvas');
    const canvas = createCanvas(1080, 1350), ctx = canvas.getContext('2d');
    const fill = ctx.fillText.bind(ctx);
    ctx.fillText = (str, x, y) => { drawn.push({ str, x, y, width: ctx.measureText(str).width }); fill(str, x, y); };
    canvas.toBlob = cb => cb(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }));
    return canvas;
  }
};
const css = read('src/style.css');
const context = vm.createContext({
  document, window: {}, URL, Blob, Image: LocalImage, setTimeout, clearTimeout,
  location: { href: 'https://example.test/rebirth/', origin: 'https://example.test' },
  getComputedStyle: () => ({ getPropertyValue: k => k === '--sans' ? testFont : css.match(new RegExp(k + ': (#[A-Fa-f0-9]+)'))[1] })
});
vm.runInContext(read('src/i18n.js') + '\n' + read('src/share.js'), context);
const app = read('src/app.js');
// Stop before DOM initialization; use the real data, formatting, ranking and payload functions.
const prefix = app.slice(app.indexOf("'use strict';"), app.indexOf('/* ================= space backdrop'));
const payloadFn = app.slice(app.indexOf('function cardPayload('), app.indexOf('async function onSaveImage('));
vm.runInContext(prefix + '\nconst stage = {};\n' + payloadFn + '\n' +
  'globalThis.makePayload = (code, lang, type = "draw") => { LANG = lang; S = I18N[lang]; return cardPayload({type,loc:BY.get(code),sex:"F",serial:42}); };' +
  '\nglobalThis.card = BirthCard; globalThis.translations = I18N;', context);
const keys = ['saveImage', 'cardBusy', 'cardTitle', 'cardDownload', 'cardShare', 'cardClose', 'cardHint', 'cardError', 'cardShareError', 'passportLabel', 'passportAlt', 'imageSource', 'passportNote', 'passportMissing', 'passportFailed', 'cardNote', 'cardFlag', 'cardCta', 'cardAlt', 'cardGdpYear'];
const langs = ['ko', 'en', 'ja', 'es', 'ru'];
const outDir = process.argv[2];
if (outDir) fs.mkdirSync(outDir, { recursive: true });
async function render(p, name, expectedCover) {
  drawn.length = 0;
  const result = await context.card.render(p);
  assert.equal(result.passportUsed, expectedCover, name + ' passport');
  const png = Buffer.from(await result.blob.arrayBuffer());
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1350);
  for (const t of drawn) {
    assert(!/undefined|NaN/.test(t.str), name + ': ' + t.str);
    assert(t.x + t.width <= 1009 && t.y <= 1303, name + ' overflow: ' + t.str);
    if (t.x === 72 && t.y > 300 && t.y < 673) assert(t.x + t.width <= 658, name + ' identity overlaps cover');
    if (t.x === 96 || t.x === 576) assert(t.x + t.width <= t.x + 409, name + ' metric overflow');
  }
  if (outDir) fs.writeFileSync(path.join(outDir, name + '.png'), png);
}
(async () => {
  for (const lang of langs) {
    for (const key of keys) assert(context.translations[lang][key], lang + ':' + key);
    for (const l of locs) {
      const p = context.makePayload(l.code, lang);
      assert(p.name && p.accent && p.metrics.length === 4);
      assert(!JSON.stringify(p).includes('undefined'), lang + ':' + l.code);
    }
    const code = { ko: 410, en: 356, ja: 392, es: 180, ru: 140 }[lang];
    await render(context.makePayload(code, lang), 'result-' + lang, !!covers[code]);
    const longest = [...locs].sort((a, b) => (b[lang] || b.en).length - (a[lang] || a.en).length)[0];
    await render(context.makePayload(longest.code, lang, 'lookup'), 'long-name-' + lang, !!covers[longest.code]);
  }
  const p = context.makePayload(410, 'ko');
  await render({ ...p, passport: 'assets/passports/missing.webp' }, 'missing-passport', false);
  await render({ ...p, passport: 'https://remote.example/cover.webp', flag: 'assets/flags/missing.svg' }, 'missing-images', false);
  assert.equal(await context.card.loadImage(null), null);
  assert.equal(await context.card.loadImage('https://remote.example/cover.webp'), null);
  console.log('PASS: ' + sources.length + ' covers, ' + missing.length + ' fallbacks; ' + (locs.length * langs.length) + ' payloads; 12 PNGs (5 languages, long names, image failures).');
})().catch(e => { console.error(e); process.exitCode = 1; });
