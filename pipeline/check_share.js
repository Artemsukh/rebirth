// Offline canvas check using the production renderer and production result formatting.
// npm install --no-save @napi-rs/canvas
// CARD_TEST_FONT=/path/to/CJK-font.otf[:/path/to/CJK-font-bold.otf...] node pipeline/check_share.js [preview-directory]
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
const reuseList = JSON.parse(read('data/passport-reuse.json'));
const credits = read('passport-credits.html');
// A reused cover has no source record of its own: it is checked against its sovereign state's.
const reused = Object.keys(covers).filter(c => covers[c].reuse != null).map(Number);
assert.equal(sources.length + reused.length, Object.keys(covers).length);
assert.equal(new Set([...sources.map(a => a.code), ...reused, ...missing.map(a => a.code)]).size, locs.length);
assert.equal(sources.length + reused.length + missing.length, locs.length);
for (const a of sources) {
  assert(locs.some(l => l.code === a.code));
  assert.equal(covers[a.code].file, a.file);
  assert.equal(covers[a.code].reuse, undefined, a.country + ' has its own source');
  assert(fs.existsSync(path.join(root, a.file)), a.file);
  assert(a.author && a.license && a.licenseUrl && a.source, a.country + ' attribution');
  assert(credits.includes('id="p' + a.code + '"'), a.country + ' credit anchor');
}
for (const code of reused) {
  const cover = covers[code], home = sources.find(a => a.code === cover.reuse);
  assert.equal(reuseList[code], cover.reuse, code + ' is on the reuse list');
  assert(home, code + ': the sovereign state has a sourced cover');
  assert.equal(cover.file, home.file, code + ' file');
  assert.equal(cover.credit, covers[cover.reuse].credit, code + ' credit');
  const entry = credits.match(new RegExp('<article id="p' + code + '">([^]*?)</article>'));
  assert(entry && entry[1].includes('href="#p' + cover.reuse + '"'), code + ' credit entry links to its sovereign state');
}
for (const a of missing) assert(!covers[a.code], a.country + ' fallback');
// One font file, or several separated by ':'. Files named alike but for a weight (NotoSansKR-400.ttf,
// NotoSansKR-600.ttf) form one family; the families are listed in the order given, so a glyph missing
// from the first (kanji from a Korean face) falls back to the next.
const fontFiles = (process.env.CARD_TEST_FONT || '').split(path.delimiter).filter(Boolean);
const families = [];
for (const f of fontFiles) {
  const fam = 'CardTest-' + path.basename(f).replace(/[-_ ]?(\d{3}|Regular|Medium|SemiBold|Bold)?\.\w+$/i, '');
  assert(GlobalFonts.registerFromPath(f, fam), 'font registration: ' + f);
  if (!families.includes(fam)) families.push(fam);
}
const testFont = families.length ? families.join(', ') : 'sans-serif';
// @napi-rs/canvas may call onload inside the src setter (SVG decodes at once), and a handler that reads
// naturalWidth there borrows the native image twice ("cannot be borrowed mutably while another borrow
// is active"); other formats finish decoding later. The handlers set before src are wrapped so they
// run on a later task after the native load or error, as in a browser.
class LocalImage extends Image {
  get naturalWidth() { return this.width; }
  get naturalHeight() { return this.height; }
  set src(url) {
    const load = this.onload, error = this.onerror;
    this.onload = () => setTimeout(() => load && load.call(this), 0);
    this.onerror = e => setTimeout(() => error && error.call(this, e), 0);
    const file = path.join(root, new URL(url).pathname.replace(/^\/rebirth\//, ''));
    if (!fs.existsSync(file)) { this.onerror(new Error('Missing image')); return; }
    super.src = fs.readFileSync(file);
  }
}
const drawn = [], pictures = [];
const document = {
  fonts: { ready: Promise.resolve() },
  querySelector: s => ({ textContent: s === '#app-data' ? JSON.stringify(D) : JSON.stringify(covers) }),
  createElement: tag => {
    assert.equal(tag, 'canvas');
    const canvas = createCanvas(1080, 1350), ctx = canvas.getContext('2d');
    const fill = ctx.fillText.bind(ctx), paint = ctx.drawImage.bind(ctx);
    ctx.fillText = (str, x, y) => { drawn.push({ str, x, y, width: ctx.measureText(str).width }); fill(str, x, y); };
    // an image counts as drawn only if the pixels under its middle changed (a not yet decoded one draws nothing)
    ctx.drawImage = (img, x, y, w, h) => {
      const at = [Math.round(x + w / 2) - 8, Math.round(y + h / 2) - 8, 16, 16], before = ctx.getImageData(...at).data;
      paint(img, x, y, w, h);
      const after = ctx.getImageData(...at).data;
      pictures.push({ scale: Math.max(w / img.naturalWidth, h / img.naturalHeight), changed: after.some((v, i) => v !== before[i]) });
    };
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
const keys = ['saveImage', 'cardBusy', 'cardTitle', 'cardDownload', 'cardShare', 'cardClose', 'cardHint', 'cardError', 'cardShareError', 'passportAlt', 'creditsLink', 'cardNote', 'cardAlt', 'cardGdpYear'];
const langs = ['ko', 'en', 'ja', 'es', 'ru'];
const outDir = process.argv[2];
if (outDir) fs.mkdirSync(outDir, { recursive: true });
async function render(p, name, expectedCover) {
  drawn.length = 0; pictures.length = 0;
  const result = await context.card.render(p);
  assert.equal(result.passportUsed, expectedCover, name + ' passport');
  for (const pic of pictures) {
    assert(pic.changed, name + ': an image was drawn before it had decoded');
    assert(pic.scale <= 1.5 + 1e-9, name + ': an image is enlarged ' + pic.scale.toFixed(2) + 'x');
  }
  const png = Buffer.from(await result.blob.arrayBuffer());
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1350);
  for (const t of drawn) {
    assert(!/undefined|NaN/.test(t.str), name + ': ' + t.str);
    assert(t.x + t.width <= 1009 && t.y <= 1303, name + ' overflow: ' + t.str);
    if (t.x === 72 && t.y > 300 && t.y < 673) assert(t.x + t.width <= 658, name + ' identity overlaps cover');
    assert(!(t.x === 72 && t.y > 640 && t.y < 1000), name + ' identity runs into the metrics: ' + t.str);
    if (t.x === 96 || t.x === 576) {
      assert(t.x + t.width <= t.x + 409, name + ' metric overflow');
      assert(t.y <= (t.y < 863 ? 673 : 863) + 162, name + ' metric text below its box: ' + t.str);
    }
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
      // a reused cover: the sovereign state's picture and credit, this place's name and credit link
      const cover = covers[l.code];
      if (cover && cover.reuse != null) {
        const home = covers[cover.reuse];
        assert.equal(p.passport, home.file);
        assert.equal(p.credit, 'Passport: ' + home.credit + (/CC BY-SA/.test(home.credit) ? ' · Card: CC BY-SA 4.0' : ''), lang + ':' + l.code + ' credit');
        assert(p.creditLink.endsWith('passport-credits.html#p' + l.code), lang + ':' + l.code + ' credit link');
        assert.equal(p.name, l[lang] || l.en);
      }
    }
    const code = { ko: 410, en: 356, ja: 392, es: 180, ru: 140 }[lang];
    await render(context.makePayload(code, lang), 'result-' + lang, !!covers[code]);
    const longest = [...locs].sort((a, b) => (b[lang] || b.en).length - (a[lang] || a.en).length)[0];
    await render(context.makePayload(longest.code, lang, 'lookup'), 'long-name-' + lang, !!covers[longest.code]);
  }
  // the review set: with and without a cover, band 9 (Monaco), no GDP band (Kosovo), a small cover
  // (Chad), a two-line name (Bosnia and Herzegovina) and a territory showing its sovereign state's
  // cover (Puerto Rico), in every language
  const review = { KR: 410, KP: 408, MC: 492, XK: 412, ML: 466, TD: 148, BA: 70, PR: 630 };
  let reviewed = 0;
  for (const lang of langs) for (const [iso, code] of Object.entries(review)) {
    await render(context.makePayload(code, lang), 'card-' + lang + '-' + iso.toLowerCase(), !!covers[code]);
    reviewed++;
  }
  const p = context.makePayload(410, 'ko');
  await render({ ...p, passport: 'assets/passports/missing.webp' }, 'missing-passport', false);
  await render({ ...p, passport: 'https://remote.example/cover.webp', flag: 'assets/flags/missing.svg' }, 'missing-images', false);
  assert.equal(await context.card.loadImage(null), null);
  assert.equal(await context.card.loadImage('https://remote.example/cover.webp'), null);
  console.log('PASS: ' + sources.length + ' covers, ' + reused.length + ' reused, ' + missing.length + ' fallbacks; ' + (locs.length * langs.length) + ' payloads; ' + (12 + reviewed) + ' PNGs (5 languages, long names, review set, image failures).');
})().catch(e => { console.error(e); process.exitCode = 1; });
