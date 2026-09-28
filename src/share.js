/* A dedicated, resolution-independent result card. Only same-origin assets are painted so
   a failed remote image cannot taint the canvas. No DOM screenshots or animation state. */
const BirthCard = (() => {
'use strict';
const WIDTH = 1080, HEIGHT = 1350;
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
function wrap(ctx, text, width) {
  const lines = [];
  let line = '';
  // CJK can wrap between characters; Latin/Cyrillic words stay whole and shrink to fit.
  const tokens = String(text).match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]|[^\s\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+|\s+/g) || [];
  for (const word of tokens) {
    if (ctx.measureText(line + word).width <= width) { line += word; continue; }
    if (line.trim()) { lines.push(line.trim()); line = ''; }
    line = word.trimStart();
  }
  if (line.trim()) lines.push(line.trim());
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
  const lines = (str, x, y, width, size, maxLines, color = ink, weight = 400) => {
    let out;
    do { c.font = weight + ' ' + size + 'px ' + font; out = wrap(c, str, width); if ((out.length <= maxLines && out.every(s => c.measureText(s).width <= width)) || size <= 16) break; size--; } while (true);
    c.fillStyle = color;
    out.forEach((line, i) => c.fillText(line, x, y + i * size * 1.3));
    return out.length * size * 1.3;
  };
  const rule = (x, y, w) => { c.fillStyle = '#26354D'; c.fillRect(x, y, w, 1); };
  const contain = (img, x, y, w, h) => {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
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
  text('BIRTH LOTTERY', 72, 91, 32, ink, 600);
  text('2026', 894, 91, 26, acc, 500);
  rule(72, 122, 936);
  text(p.kicker, 72, 174, 23, muted, 400, 570);
  if (flag) contain(flag, 72, 212, 96, 64);
  else text(p.iso2, 72, 261, 34, acc, 600);
  const nameHeight = lines(p.name, 72, 359, 585, 76, 2, ink, 600);
  let identityY = Math.max(414, 359 + nameHeight + 12);
  text(p.subtitle, 72, identityY, 26, muted, 400, 585);
  text(p.sex, 72, identityY + 46, 28, acc, 500, 585);
  text(p.region, 72, identityY + 86, 22, muted, 400, 585);
  c.strokeStyle = '#34445C'; c.lineWidth = 1; c.strokeRect(702, 202, 290, 394);
  if (passport) contain(passport, 722, 218, 250, 352);
  else if (flag) contain(flag, 737, 302, 220, 156);
  else text(p.iso2, 780, 407, 64, acc, 600, 200);
  text(passport ? p.passportLabel : p.flagLabel, 708, 624, 17, muted, 400, 292);
  const metrics = p.metrics;
  metrics.forEach((m, i) => {
    const x = 72 + (i % 2) * 480, y = 673 + Math.floor(i / 2) * 190;
    c.fillStyle = '#0D172A'; c.fillRect(x, y, 456, 168);
    c.fillStyle = acc; c.fillRect(x, y, 3, 168);
    text(m.label, x + 24, y + 37, 22, muted, 400, 408);
    text(m.value, x + 24, y + 94, 45, i === 0 ? acc : ink, 600, 408);
    lines(m.detail, x + 24, y + 127, 408, 19, 2, muted);
  });
  lines(p.note, 72, 1089, 936, 19, 2, muted);
  rule(72, 1140, 936);
  text('artemsukh.github.io/rebirth', 72, 1190, 28, ink, 500);
  text(p.callToAction, 72, 1226, 21, acc);
  // Attribution travels with the exported image; the linked local page contains full credits.
  const credit = passport ? p.credit : p.flagCredit;
  text(credit, 72, 1274, 16, muted, 400, 936);
  text(p.creditLink, 72, 1302, 16, muted, 400, 936);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG unavailable')), 'image/png'));
  return { blob, passportUsed: !!passport };
}
return { render, loadImage, wrap, WIDTH, HEIGHT };
})();
