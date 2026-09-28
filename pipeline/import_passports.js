/* Import previously reviewed Commons files. No remote hotlinks at runtime.
   Usage: node pipeline/import_passports.js /path/to/passport-audit.json /path/to/images
   Images are named by UN M49 code, e.g. 410.bin. Requires sharp. */
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const root = path.join(__dirname, '..');
const [auditPath, inputDir] = process.argv.slice(2);
if (!auditPath || !inputDir) throw new Error('Provide audit JSON and local image directory');
const audit = new Map(JSON.parse(fs.readFileSync(auditPath)).map(a => [a.code, a]));
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/appdata.json')));
const locs = data.LOC.map(r => Object.fromEntries(data.LOC_FIELDS.map((k, i) => [k, r[i]])));
const cleanAuthor = s => s.split(/\n(?:SVG|Notes|Camera location|\s*This |\s*File:|\s*According to)/)[0].replace(/\s+/g, ' ').trim();
const shortLicense = a => {
  const m = (a.licenseUrl || '').match(/licenses\/(by(?:-sa)?)\/([\d.]+)/);
  return m ? 'CC ' + m[1].toUpperCase() + ' ' + m[2] : a.license;
};
(async () => {
  const manifest = {}, sources = [];
  fs.mkdirSync(path.join(root, 'assets/passports'), { recursive: true });
  for (const l of locs) {
    const a = audit.get(l.code), src = path.join(inputDir, l.code + '.bin');
    if (!a || !a.license || !fs.existsSync(src)) continue;
    const meta = await sharp(src).metadata();
    // Reject landscapes, spreads and obvious non-cover images for manual review.
    if ((meta.width / meta.height > .95 && l.code !== 659) || meta.width / meta.height < .4) {
      console.log('REVIEW aspect', l.en, meta.width, meta.height); continue;
    }
    const file = 'assets/passports/' + l.iso2.toLowerCase() + '.webp';
    await sharp(src).rotate().resize({ width: 400, height: 568, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(root, file));
    const author = cleanAuthor(a.author || 'See source page');
    const license = shortLicense(a);
    const credit = author + ' · ' + license;
    manifest[l.code] = { file, credit };
    sources.push({ code: l.code, country: l.en, file, title: a.title, source: a.page, original: a.original || null, author, license, licenseUrl: a.licenseUrl, retrieved: '2026-09-28', changes: 'Resized proportionally and converted to WebP; cover artwork unchanged.' });
  }
  fs.writeFileSync(path.join(root, 'data/passports.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'data/passport-sources.json'), JSON.stringify(sources, null, 2) + '\n');
  const missing = locs.filter(l => !manifest[l.code]).map(l => ({ code: l.code, country: l.en, iso2: l.iso2 }));
  fs.writeFileSync(path.join(root, 'data/passports-missing.json'), JSON.stringify(missing, null, 2) + '\n');
  console.log(sources.length + ' covers; ' + missing.length + ' flag fallbacks; ' + (sources.reduce((s,a)=>s+locs.find(l=>l.code===a.code).births,0)/locs.reduce((s,l)=>s+l.births,0)*100).toFixed(2) + '% of births covered');
})();
