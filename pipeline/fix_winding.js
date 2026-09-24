const d3 = require('/tmp/d3.cjs');
const tj = require('/tmp/tj.cjs');
const fs = require('fs');
const topo = JSON.parse(fs.readFileSync('/home/claude/mapwork/world_35.json', 'utf8'));
let fixed = 0;
for (const g of topo.objects.countries.geometries) {
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  polys.forEach((poly, pi) => {
    const one = {type:'Topology', transform: topo.transform, arcs: topo.arcs, objects:{x:{type:'Polygon', arcs: poly}}};
    const a = d3.geoArea(tj.feature(one, one.objects.x));
    if (a > 2 * Math.PI) {
      const rev = poly.map(ring => ring.slice().reverse().map(i => ~i));
      if (g.type === 'Polygon') g.arcs = rev; else g.arcs[pi] = rev;
      fixed++;
    }
  });
}
fs.writeFileSync('/home/claude/mapwork/world_35_fixed.json', JSON.stringify(topo));
const fc = tj.feature(topo, topo.objects.countries);
const bad = fc.features.filter(f => d3.geoArea(f) > 2*Math.PI).map(f=>f.properties.id);
console.log('fixed parts', fixed, 'remaining bad', bad, 'size', fs.statSync('/home/claude/mapwork/world_35_fixed.json').size);
