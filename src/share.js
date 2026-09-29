/* A dedicated, resolution-independent result card. Only same-origin assets are painted so
   a failed remote image cannot taint the canvas. No DOM screenshots or animation state. */
const BirthCard = (() => {
'use strict';
const WIDTH = 1080, HEIGHT = 1350;
const FLAG_CREDIT = 'Flag: flag-icons (MIT). Card: CC BY-SA 4.0.';
function loadImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const url = new URL(src, location.href);
    if (url.origin !== location.origin) { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => done(null), 7000);
    let settled = false;
    function done(value) {
      if (settled) return;
      settled = true; clearTimeout(timer); img.onload = img.onerror = null; resolve(value);
    }
    img.onload = () => done(img.naturalWidth ? img : null);
    img.onerror = () => done(null);
    img.src = url.href;
  });
}
/* Line breaking. Korean, Latin and Cyrillic break at spaces only, as the page does (keep-all); a
   Korean word wider than the whole line starts a line of its own and is then cut between syllables,
   while a Latin or Cyrillic word stays whole and the caller shrinks the text. Japanese and Chinese
   may break between characters, but never before closing punctuation, small kana or the long-vowel
   mark and never after an opening bracket: the character before such a break goes down with it.
   Punctuation standing alone between spaces (' · ', ' — ') stays at the end of the line before it. */
const NO_START = '、。，．・：；？！）」』】〕〉》ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ)]},.!?:;%';
const NO_END = '（「『【〔〈《([{';
const CJK = /[\u2e80-\u303f\u3040-\u30ff\u3100-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
const WORDLIKE = /[\p{L}\p{N}]/u;
/* a word in the pieces a line may end after; may(a, b) says whether a break can fall between a and b */
function pieces(word, may) {
  const ch = [...word], out = [];
  let cur = ch[0] || '';
  for (let i = 1; i < ch.length; i++) {
    if (may(ch[i - 1], ch[i]) && !NO_START.includes(ch[i]) && !NO_END.includes(ch[i - 1])) { out.push(cur); cur = ''; }
    cur += ch[i];
  }
  if (cur) out.push(cur);
  return out;
}
const cjkBreak = (a, b) => CJK.test(a) || CJK.test(b);
function wrap(ctx, text, width) {
  const fits = s => ctx.measureText(s).width <= width;
  // each word as its pieces; lone punctuation is added to the last piece of the word before it
  const words = [];
  for (const w of String(text).split(/\s+/)) {
    if (!w) continue;
    const prev = words[words.length - 1];
    if (prev && !WORDLIKE.test(w)) { prev[prev.length - 1] += ' ' + w; continue; }
    const long = HANGUL.test(w) && !fits(w), parts = pieces(w, long ? () => true : cjkBreak);
    parts.long = long;
    words.push(parts);
  }
  const lines = [];
  let line = '';
  const put = (piece, sep) => {
    const next = line ? line + sep + piece : piece;
    if (!line || fits(next)) line = next;
    else { lines.push(line); line = piece; }
  };
  for (const parts of words) {
    if (parts.long && line) { lines.push(line); line = ''; }
    parts.forEach((p, i) => put(p, i ? '' : ' '));
  }
  if (line) lines.push(line);
  return lines;
}
async function render(p) {
  const [flag, passport] = await Promise.all([loadImage(p.flag), loadImage(p.passport)]);
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]);
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas unavailable');
  const ink = '#F4F9FF', muted = '#AFC0DA', acc = p.accent;
  const font = p.font || 'sans-serif';
  const text = (str, x, y, size, color = ink, weight = 400, max = 936) => {
    c.fillStyle = color; c.font = weight + ' ' + size + 'px ' + font;
    while (c.measureText(str).width > max && size > 13) { size--; c.font = weight + ' ' + size + 'px ' + font; }
    c.fillText(str, x, y);
  };
  // bottom: the lowest baseline allowed; a block that would run past it starts higher instead
  const lines = (str, x, y, width, size, maxLines, color = ink, weight = 400, bottom = Infinity) => {
    let out;
    do { c.font = weight + ' ' + size + 'px ' + font; out = wrap(c, str, width); if ((out.length <= maxLines && out.every(s => c.measureText(s).width <= width)) || size <= 16) break; size--; } while (true);
    y = Math.min(y, bottom - Math.max(0, out.length - 1) * size * 1.3);
    c.fillStyle = color;
    out.forEach((line, i) => c.fillText(line, x, y + i * size * 1.3));
    return { size, last: y + Math.max(0, out.length - 1) * size * 1.3 };
  };
  const rule = (x, y, w) => { c.fillStyle = '#26354D'; c.fillRect(x, y, w, 1); };
  // Never more than 1.5x the source: a small sharp picture reads better than a large blurred one.
  const contain = (img, x, y, w, h) => {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight, 1.5);
    const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
    c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  };
  c.fillStyle = '#050716'; c.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = c.createRadialGradient(880, 290, 20, 750, 300, 620);
  glow.addColorStop(0, '#172741'); glow.addColorStop(1, '#050716');
  c.fillStyle = glow; c.fillRect(28, 28, WIDTH - 56, 620);
  c.globalAlpha = .25; c.fillStyle = acc;
  for (let i = 0; i < 96; i++) c.fillRect(36 + (i * 137 % 1000), 110 + (i * 71 % 480), 2, 2);
  c.globalAlpha = 1;
  c.strokeStyle = '#26354D'; c.lineWidth = 2; c.strokeRect(28, 28, WIDTH - 56, HEIGHT - 56);
  c.fillStyle = acc; c.fillRect(28, 28, 180, 5); c.fillRect(WIDTH - 208, HEIGHT - 33, 180, 5);
  text(p.header, 72, 91, 26, ink, 500);
  rule(72, 122, 936);
  if (flag) contain(flag, 72, 170, 96, 64);
  else text(p.iso2, 72, 219, 34, acc, 600);
  // Baselines: the line under the name sits one step below the name's last baseline (the step grows
  // with the name's size), then sex; an empty subtitle (the English card) is skipped.
  const name = lines(p.name, 72, 318, 585, 76, 2, ink, 600);
  let y = name.last + Math.round(name.size * .3) + 33;
  if (p.subtitle) { text(p.subtitle, 72, y, 26, muted, 400, 585); y += 46; }
  text(p.sex, 72, y, 28, acc, 500, 585);
  c.strokeStyle = '#34445C'; c.lineWidth = 1; c.strokeRect(702, 170, 290, 394);
  if (passport) contain(passport, 722, 186, 250, 352);
  else if (flag) contain(flag, 737, 270, 220, 156);
  else text(p.iso2, 780, 375, 64, acc, 600, 200);
  text(p.hero.value, 72, 740, 120, acc, 600);
  text(p.hero.label, 72, 795, 26, muted);
  rule(72, 860, 936);
  p.facts.forEach((f, i) => {
    text(f.value, 72 + i * 480, 950, 52, f.na ? muted : ink, 600, 456);
    text(f.label, 72 + i * 480, 995, 22, muted, 400, 456);
  });
  rule(72, 1140, 936);
  text('artemsukh.github.io/rebirth', 72, 1208, 28, ink, 500);
  // Attribution travels with the exported image; the linked local page contains full credits.
  // A cover that did not load leaves the flag in its box, so the flag is credited instead.
  const credit = passport || !p.passport ? p.credit : FLAG_CREDIT + p.credit.slice(p.credit.lastIndexOf(' · '));
  lines(credit, 72, 1262, 936, 16, 2, muted, 400, 1303);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG unavailable')), 'image/png'));
  return { blob, passportUsed: !!passport };
}
return { render, loadImage, wrap, WIDTH, HEIGHT, FLAG_CREDIT };
})();
