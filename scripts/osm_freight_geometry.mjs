// OpenStreetMap freight geometry for Slovenia, via Overpass:
//   - stations / halts / yards with their UIC reference, matched to the DIUM
//     freight-station directory (src/data/diumSlovenia.json)
//   - yard, siding, spur and industrial tracks as LineStrings
//   - railway yards / landuse=railway areas as centroids
// Writes src/data/osmFreightGeometrySI.json.
//
// Run:  NODE_USE_ENV_PROXY=1 node scripts/osm_freight_geometry.mjs
// Data © OpenStreetMap contributors, ODbL 1.0. Nothing here is edited or
// inferred beyond the DIUM match, which records how it was made.
import fs from 'node:fs';
import path from 'node:path';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OUT = path.join(process.cwd(), 'src', 'data', 'osmFreightGeometrySI.json');
const DIUM = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'diumSlovenia.json'), 'utf-8'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function overpass(query, label) {
  const data = `[out:json][timeout:90];area["ISO3166-1"="SI"]->.a;${query}`;
  // A response fetched separately (curl) can be dropped in as
  // $OSM_CACHE_DIR/osm_<label>.json; it is used as-is.
  if (process.env.OSM_CACHE_DIR) {
    const f = path.join(process.env.OSM_CACHE_DIR, `osm_${label}.json`);
    if (fs.existsSync(f)) {
      const j = JSON.parse(fs.readFileSync(f, 'utf-8'));
      console.log(`[osm] ${label}: ${j.elements.length} elements (cached ${f})`);
      return j.elements;
    }
  }
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(data), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'nova-app-transport (OSM freight geometry build script)' }, signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      // Slovenia has hundreds of each; an empty answer is a mirror without
      // area support or a truncated response, not the real count.
      if (!Array.isArray(j.elements) || j.elements.length === 0) throw new Error('empty response');
      console.log(`[osm] ${label}: ${j.elements.length} elements (${url.split('/')[2]})`);
      return j.elements;
    } catch (e) {
      lastErr = e;
      console.warn(`[osm] ${label} attempt ${attempt + 1} failed on ${url.split('/')[2]}: ${e.message}`);
      await sleep(8000 * (attempt + 1));
    }
  }
  throw lastErr;
}

const r5 = (n) => Math.round(n * 1e5) / 1e5;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// (a) named rail nodes with a reference
const stationNodes = await overpass(`(node["railway"~"^(station|halt|yard|service_station|junction)$"](area.a););out body;`, 'stations');
// (b) yard / siding / spur / industrial tracks, with geometry
const trackWays = await overpass(`(way["railway"="rail"]["service"~"^(yard|siding|spur)$"](area.a);way["railway"="rail"]["usage"="industrial"](area.a););out geom;`, 'sidings');
// (c) yard areas
const yardAreas = await overpass(`(way["railway"="yard"](area.a);way["landuse"="railway"](area.a);relation["landuse"="railway"](area.a););out center tags;`, 'yards');

// DIUM index: by national 5-digit code and by normalised name.
const diumByCode = new Map();
const diumByName = new Map();
for (const s of DIUM.stations) {
  diumByCode.set(String(s.code), s);
  diumByName.set(norm(s.name), s);
}

const stations = [];
let byUic = 0, byName = 0;
for (const n of stationNodes) {
  const t = n.tags || {};
  if (!t.name) continue;
  const uic = t.uic_ref ? String(t.uic_ref).trim() : null;
  let dium = null, matchedBy = null;
  if (uic) {
    // OSM carries 7-digit codes (79 + national 5 digits) or the bare 5.
    const nat = uic.length === 7 && uic.startsWith('79') ? uic.slice(2) : (uic.length === 5 ? uic : null);
    if (nat && diumByCode.has(nat)) { dium = diumByCode.get(nat); matchedBy = 'uic_ref'; byUic++; }
  }
  if (!dium && diumByName.has(norm(t.name))) { dium = diumByName.get(norm(t.name)); matchedBy = 'name'; byName++; }
  stations.push({
    osmId: n.id, name: t.name, railway: t.railway, lat: r5(n.lat), lon: r5(n.lon),
    uicRef: uic, railwayRef: t['railway:ref'] || null, operator: t.operator || null,
    diumCode: dium ? dium.code : null, diumName: dium ? dium.name : null, matchedBy
  });
}

const sidings = {
  type: 'FeatureCollection',
  features: trackWays.filter(w => Array.isArray(w.geometry) && w.geometry.length > 1).map(w => ({
    type: 'Feature',
    properties: { osmId: w.id, name: w.tags?.name || null, service: w.tags?.service || null, usage: w.tags?.usage || null, operator: w.tags?.operator || null, electrified: w.tags?.electrified || null },
    geometry: { type: 'LineString', coordinates: w.geometry.map(p => [r5(p.lon), r5(p.lat)]) }
  }))
};

const yards = yardAreas.filter(y => y.center || (y.lat != null)).map(y => ({
  osmId: y.id, osmType: y.type, name: y.tags?.name || null, kind: y.tags?.railway === 'yard' ? 'yard' : 'landuse=railway',
  lat: r5(y.center ? y.center.lat : y.lat), lon: r5(y.center ? y.center.lon : y.lon), operator: y.tags?.operator || null
}));

const out = {
  source: 'OpenStreetMap via Overpass API',
  licence: 'ODbL 1.0',
  attribution: '© OpenStreetMap contributors',
  licenceUrl: 'https://www.openstreetmap.org/copyright',
  retrieved: new Date().toISOString(),
  queries: { stations: 'node[railway~station|halt|yard|service_station|junction] in SI', sidings: 'way[railway=rail][service~yard|siding|spur] or [usage=industrial] in SI', yards: 'way/relation[railway=yard] or [landuse=railway] in SI' },
  diumMatching: 'uic_ref (79 + 5-digit national code, or bare 5 digits) against DIUM SI station codes; otherwise exact normalised name. matchedBy says which.',
  counts: { stations: stations.length, stationsMatchedByUic: byUic, stationsMatchedByName: byName, stationsUnmatched: stations.filter(s => !s.diumCode).length, sidings: sidings.features.length, yards: yards.length, diumStations: DIUM.stations.length },
  stations, sidings, yards
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('[osm] wrote', OUT, Math.round(fs.statSync(OUT).size / 1024), 'KB');
console.log('[osm] counts', JSON.stringify(out.counts));
console.log('[osm] samples', JSON.stringify(stations.filter(s => s.diumCode).slice(0, 3)), JSON.stringify(sidings.features.slice(0, 2).map(f => f.properties)), JSON.stringify(yards.slice(0, 3)));
