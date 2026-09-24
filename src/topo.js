/* TopoJSON -> GeoJSON FeatureCollection for one object of Polygon / MultiPolygon geometries,
   point for point what topojson-client's feature() returns for world.topo.json */
function topoFeatures(topo, obj) {
  const t = topo.transform;
  const arcs = topo.arcs.map(a => {
    if (!t) return a;
    let x = 0, y = 0;
    return a.map(p => [(x += p[0]) * t.scale[0] + t.translate[0], (y += p[1]) * t.scale[1] + t.translate[1]]);
  });
  const ring = ids => {
    const pts = [];
    for (const i of ids) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      if (pts.length) pts.pop();
      for (const p of a) pts.push(p.slice());
    }
    while (pts.length < 4) pts.push(pts[0]);
    return pts;
  };
  const poly = rs => rs.map(ring);
  const geom = g => g.type === 'Polygon' ? { type: 'Polygon', coordinates: poly(g.arcs) }
    : g.type === 'MultiPolygon' ? { type: 'MultiPolygon', coordinates: g.arcs.map(poly) } : null;
  return { type: 'FeatureCollection', features: obj.geometries.map(g => {
    const f = { type: 'Feature', properties: g.properties || {}, geometry: geom(g) };
    if (g.id != null) f.id = g.id;
    return f;
  }) };
}
