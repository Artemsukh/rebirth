/* Territories that carry their sovereign state's ordinary passport show that state's cover.
   Usage: node pipeline/apply_passport_reuse.js
   The list is explicit: data/passport-reuse.json maps a territory's M49 code to its sovereign state's
   code. It is never inferred from the `sov` field. Each run drops every earlier reuse entry from
   data/passports.json and copies the sovereign state's entry again, so a re-imported cover carries its
   new credit to its territories, and a territory taken off the list loses its entry. A territory whose
   sovereign state has no cover of its own is skipped and stays on the flag fallback list, so it never
   points to a missing file; one that has its own cover keeps it. The image files are not copied, and
   data/passport-sources.json keeps the one record of the sovereign state's cover. Writes
   data/passports.json and data/passports-missing.json; running it again changes nothing.
   import_passports.js calls this after every import. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

function applyPassportReuse(root = ROOT) {
  const read = f => JSON.parse(fs.readFileSync(path.join(root, f)));
  const write = (f, v) => fs.writeFileSync(path.join(root, f), JSON.stringify(v, null, 2) + '\n');
  const data = read('data/appdata.json');
  const locs = data.LOC.map(r => Object.fromEntries(data.LOC_FIELDS.map((k, i) => [k, r[i]])));
  const reuse = read('data/passport-reuse.json');
  const manifest = read('data/passports.json');
  for (const code of Object.keys(manifest)) if (manifest[code].reuse != null) delete manifest[code];
  const reused = [], skipped = [], own = [];
  for (const [code, home] of Object.entries(reuse)) {
    if (manifest[code]) { own.push(code); continue; }
    const cover = manifest[home];
    if (!cover || cover.reuse != null) { skipped.push(code); continue; }
    manifest[code] = { file: cover.file, credit: cover.credit, reuse: home };
    reused.push(code);
  }
  write('data/passports.json', manifest);
  const missing = locs.filter(l => !manifest[l.code]).map(l => ({ code: l.code, country: l.en, iso2: l.iso2 }));
  write('data/passports-missing.json', missing);
  return { manifest, missing, reused, skipped, own, locs };
}

/* the summary line both scripts print: own covers, reused covers, flag fallbacks, share of births */
function reuseReport({ manifest, missing, reused, skipped, own, locs }) {
  const births = locs.filter(l => manifest[l.code]).reduce((s, l) => s + l.births, 0) / locs.reduce((s, l) => s + l.births, 0);
  return [(Object.keys(manifest).length - reused.length) + ' covers; ' + reused.length + ' reused from the sovereign state; ' +
    missing.length + ' flag fallbacks; ' + (births * 100).toFixed(2) + '% of births covered']
    .concat(skipped.length ? ['No sovereign cover, left on the flag: ' + skipped.join(', ')] : [])
    .concat(own.length ? ['Own cover kept, not reused: ' + own.join(', ')] : []).join('\n');
}

module.exports = { applyPassportReuse, reuseReport };

if (require.main === module) console.log(reuseReport(applyPassportReuse()));
