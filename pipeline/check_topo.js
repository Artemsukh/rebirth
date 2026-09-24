// Checks that src/topo.js decodes data/world.topo.json exactly like topojson-client 3.1.0
// (vendor/topojson-client.min.js, kept only for this check). Run: node pipeline/check_topo.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'vendor/topojson-client.min.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/topo.js'), 'utf8') + ';this.topoFeatures = topoFeatures;', ctx);
const topo = JSON.parse(fs.readFileSync(path.join(root, 'data/world.topo.json'), 'utf8'));
const a = JSON.stringify(ctx.topojson.feature(topo, topo.objects.countries));
const b = JSON.stringify(ctx.topoFeatures(topo, topo.objects.countries));
if (a !== b) { console.error('src/topo.js output differs from topojson-client'); process.exit(1); }
console.log('src/topo.js matches topojson-client for', topo.objects.countries.geometries.length, 'geometries');
