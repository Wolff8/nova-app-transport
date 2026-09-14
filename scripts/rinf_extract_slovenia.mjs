// Pulls the Slovenian part of ERA's RINF knowledge graph (rinf-plus) into
// app/src/data/rinfSlovenia.json: operational points with TAF TSI primary
// location codes, line/km, border partners; sections of line with the
// per-track parameters that matter for a freight train (speed, gauging,
// load category, electrification, ETCS, corridors); tunnels with length and
// position. Nothing is inferred: every value is a triple from the graph.
import fs from 'node:fs';

const EP = 'https://graph.data.era.europa.eu/repositories/rinf-plus';
const PRE = `PREFIX era: <http://data.europa.eu/949/> PREFIX country: <http://publications.europa.eu/resource/authority/country/> PREFIX geo: <http://www.opengis.net/ont/geosparql#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX wgs: <http://www.w3.org/2003/01/geo/wgs84_pos#> PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> `;
const OUT = process.argv[2] || new URL('../src/data/rinfSlovenia.json', import.meta.url).pathname;

async function sparql(q) {
  const r = await fetch(EP, { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(PRE + q) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for query: ${q.slice(0, 120)}`);
  const j = await r.json();
  return j.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}
const num = v => (v == null || v === '' ? null : Number(v));
const lbl = 'FILTER(LANG(?l) IN ("en",""))';

// ---- operational points -------------------------------------------------
const ops = await sparql(`SELECT ?uopid ?name ?type ?lat ?lon ?lrs ?plc ?bp WHERE {
  ?op a era:OperationalPoint ; era:inCountry country:SVN ; era:uopid ?uopid ; era:opName ?name ; era:opType ?t .
  ?t skos:prefLabel ?type FILTER(LANG(?type) IN ("en",""))
  OPTIONAL { ?op era:netReference ?nr . ?nr wgs:lat ?lat ; wgs:long ?lon . OPTIONAL { ?nr era:hasLrsCoordinate ?c . ?c rdfs:label ?lrs } }
  OPTIONAL { ?op era:primaryLocation ?pl . ?pl era:primaryLocationCode ?plc }
  OPTIONAL { ?op era:referenceBorderPoint ?b . BIND(REPLACE(STR(?b), ".*/", "") AS ?bp) }
}`);
const partCounts = await sparql(`SELECT ?uopid (COUNT(DISTINCT ?tr) AS ?tracks) (COUNT(DISTINCT ?sd) AS ?sidings) WHERE {
  ?op a era:OperationalPoint ; era:inCountry country:SVN ; era:uopid ?uopid .
  OPTIONAL { ?op era:hasPart ?tr . ?tr a era:RunningTrack }
  OPTIONAL { ?op era:hasPart ?sd . ?sd a era:Siding }
} GROUP BY ?uopid`);
const partners = await sparql(`SELECT ?bp ?name ?uopid ?country ?lat ?lon WHERE {
  ?op a era:OperationalPoint ; era:referenceBorderPoint ?b ; era:opName ?name ; era:uopid ?uopid ; era:inCountry ?c .
  FILTER(?c != country:SVN) BIND(REPLACE(STR(?b), ".*/", "") AS ?bp) BIND(REPLACE(STR(?c), ".*/", "") AS ?country)
  { SELECT ?b WHERE { ?x a era:OperationalPoint ; era:inCountry country:SVN ; era:referenceBorderPoint ?b } }
  OPTIONAL { ?op era:netReference ?nr . ?nr wgs:lat ?lat ; wgs:long ?lon }
}`);
const counts = new Map(partCounts.map(r => [r.uopid, r]));
const partnerBy = new Map(partners.map(r => [r.bp, r]));
const opMap = new Map();
for (const r of ops) {
  if (opMap.has(r.uopid)) continue;
  const m = String(r.lrs || '').match(/^(\S+)\s*\|\s*(\d+)\+(\d+)/);
  const c = counts.get(r.uopid) || {};
  const partner = r.bp ? partnerBy.get(r.bp) : null;
  opMap.set(r.uopid, {
    uopid: r.uopid, name: r.name, type: r.type,
    lat: num(r.lat), lon: num(r.lon),
    line: m ? m[1] : null, km: m ? Number((Number(m[2]) + Number(m[3]) / 1000).toFixed(3)) : null,
    plc: r.plc || null,
    border: r.bp ? { code: r.bp, partner: partner ? { name: partner.name, uopid: partner.uopid, country: partner.country, lat: num(partner.lat), lon: num(partner.lon) } : null } : null,
    tracks: num(c.tracks) ?? 0, sidings: num(c.sidings) ?? 0
  });
}

// ---- sections of line ---------------------------------------------------
const sols = await sparql(`SELECT ?sol ?id ?line ?from ?to ?len ?nature WHERE {
  ?sol a era:SectionOfLine ; era:inCountry country:SVN ; era:canonicalURI ?cu ; era:opStart ?a ; era:opEnd ?b ; era:lengthOfSectionOfLine ?len ; era:solNature ?n ; era:nationalLine ?nl .
  ?a era:uopid ?from . ?b era:uopid ?to . ?nl era:lineId ?line . ?n skos:prefLabel ?nature FILTER(LANG(?nature) IN ("en",""))
  BIND(REPLACE(STR(?cu), ".*/", "") AS ?id)
}`);
// scalar track parameters
const tracks = await sparql(`SELECT ?sol ?tr ?trackId ?dir ?speed ?gauge ?radius ?alt ?habd ?lx ?gsmr ?cant WHERE {
  ?sol a era:SectionOfLine ; era:inCountry country:SVN ; era:hasPart ?tr . ?tr a era:RunningTrack .
  OPTIONAL { ?tr era:trackId ?trackId }
  OPTIONAL { ?tr era:trackDirection ?d . ?d skos:prefLabel ?dir FILTER(LANG(?dir) IN ("en","")) }
  OPTIONAL { ?tr era:maximumPermittedSpeed ?speed }
  OPTIONAL { ?tr era:wheelSetGauge ?g . ?g skos:prefLabel ?gauge FILTER(LANG(?gauge) IN ("en","")) }
  OPTIONAL { ?tr era:minimumHorizontalRadius ?radius }
  OPTIONAL { ?tr era:maximumAltitude ?alt }
  OPTIONAL { ?tr era:hasHotAxleBoxDetector ?habd }
  OPTIONAL { ?tr era:hasLevelCrossings ?lx }
  OPTIONAL { ?tr era:gsmRVersion ?gv . ?gv skos:prefLabel ?gsmr FILTER(LANG(?gsmr) IN ("en","")) }
  OPTIONAL { ?tr era:cantDeficiency ?cant }
}`);
// multi-valued concept properties, one query each
async function multi(prop, path = '') {
  const rows = await sparql(`SELECT ?tr (GROUP_CONCAT(DISTINCT ?l; separator="|") AS ?v) WHERE {
    ?sol a era:SectionOfLine ; era:inCountry country:SVN ; era:hasPart ?tr . ?tr a era:RunningTrack ; ${prop} ?x . ${path} ?y skos:prefLabel ?l ${lbl} } GROUP BY ?tr`);
  return new Map(rows.map(r => [r.tr, r.v.split('|').filter(Boolean)]));
}
const gauging = await multi('era:gaugingProfile', 'BIND(?x AS ?y)');
const loadCat = await multi('era:trackLoadCapability', '?x era:loadCapabilityLineCategory ?y .');
const corridors = await multi('era:freightCorridor', 'BIND(?x AS ?y)');
const legacyProt = await multi('era:protectionLegacySystem', 'BIND(?x AS ?y)');
const energy = await multi('era:contactLineSystem', '?x era:energySupplySystem ?y .');
const clType = await multi('era:contactLineSystem', '?x era:contactLineSystemType ?y .');
const etcsLevel = await multi('era:etcs', '?x era:etcsLevelType ?y .');
const etcsBase = await multi('era:etcs', '?x era:etcsBaseline ?y .');
const otherProt = await multi('era:otherTrainProtection', 'BIND(?x AS ?y)');

const solMap = new Map();
for (const s of sols) {
  if (solMap.has(s.sol)) continue;
  solMap.set(s.sol, { id: s.id, line: s.line, from: s.from, to: s.to, lengthKm: num(s.len), nature: s.nature, tracks: [] });
}
const seenTr = new Set();
for (const t of tracks) {
  const s = solMap.get(t.sol); if (!s || seenTr.has(t.tr)) continue; seenTr.add(t.tr);
  s.tracks.push({
    trackId: t.trackId || null, direction: t.dir || null, maxSpeedKmh: num(t.speed),
    gauging: gauging.get(t.tr) || [], loadCategories: loadCat.get(t.tr) || [], wheelSetGauge: t.gauge || null,
    minHorizontalRadiusM: num(t.radius), maxAltitudeM: num(t.alt), cantDeficiencyMm: num(t.cant),
    hotAxleBoxDetector: t.habd == null ? null : t.habd === 'true', levelCrossings: t.lx == null ? null : t.lx === 'true',
    gsmrVersion: t.gsmr || null, legacyProtection: legacyProt.get(t.tr) || [], otherProtection: otherProt.get(t.tr) || [],
    energySupply: energy.get(t.tr) || [], contactLineType: clType.get(t.tr) || [],
    etcsLevels: etcsLevel.get(t.tr) || [], etcsBaselines: etcsBase.get(t.tr) || [],
    freightCorridors: corridors.get(t.tr) || []
  });
}

// ---- tunnels ------------------------------------------------------------
const tunnels = await sparql(`SELECT ?t ?name ?len ?trackId ?solId ?startLrs ?wkt WHERE {
  ?t a era:Tunnel ; era:inCountry country:SVN ; era:tunnelIdentification ?name ; era:lengthOfTunnel ?len ; era:isPartOf ?tr .
  OPTIONAL { ?tr era:trackId ?trackId } OPTIONAL { ?tr era:isPartOf ?sol . ?sol era:canonicalURI ?cu . BIND(REPLACE(STR(?cu), ".*/", "") AS ?solId) }
  OPTIONAL { ?t era:netReference ?nr . OPTIONAL { ?nr geo:hasGeometry ?g . ?g geo:asWKT ?wkt } OPTIONAL { ?nr era:startsAt ?st . ?st era:hasLrsCoordinate ?c . ?c rdfs:label ?startLrs } }
}`);
// The graph holds one Tunnel entity per track it lies on (Semič appears
// four times); the physical tunnel is one record with all its tracks.
const tunMap = new Map();
for (const r of tunnels) {
  const w = String(r.wkt || '').match(/LINESTRING\s*\(([^)]*)\)/);
  const pts = w ? w[1].split(',').map(p => p.trim().split(/\s+/).map(Number)) : [];
  const m = String(r.startLrs || '').match(/^(\S+)\s*\|\s*(\d+)\+(\d+)/);
  const line = m ? m[1] : null, kmStart = m ? Number((Number(m[2]) + Number(m[3]) / 1000).toFixed(3)) : null;
  const key = `${r.name}|${line}|${kmStart}`;
  const cur = tunMap.get(key);
  if (cur) {
    if (r.solId && !cur.sectionIds.includes(r.solId)) cur.sectionIds.push(r.solId);
    if (r.trackId && !cur.trackIds.includes(r.trackId)) cur.trackIds.push(r.trackId);
    continue;
  }
  tunMap.set(key, {
    name: r.name, lengthM: num(r.len), sectionIds: r.solId ? [r.solId] : [], trackIds: r.trackId ? [r.trackId] : [],
    line, kmStart,
    start: pts[0] && pts[0].length === 2 ? [pts[0][0], pts[0][1]] : null,
    end: pts[pts.length - 1] && pts.length > 1 ? [pts[pts.length - 1][0], pts[pts.length - 1][1]] : null
  });
}

const validity = await sparql(`SELECT DISTINCT ?l WHERE { ?op a era:OperationalPoint ; era:inCountry country:SVN ; era:validity ?v . ?v rdfs:label ?l } LIMIT 3`);
const out = {
  source: 'ERA RINF (Register of Infrastructure), graf znanja rinf-plus, imenovani graf upravljavca 0079 (SŽ-Infrastruktura)',
  endpoint: EP,
  license: 'Sklep Komisije (EU) 2017/863 o ponovni uporabi dokumentov Komisije (dcterms:license v grafu)',
  retrieved: new Date().toISOString(),
  validity: validity.map(v => v.l),
  note: 'Vsaka vrednost je trojček iz grafa. Koordinate točk so iz era:netReference (wgs84), kilometraža iz LRS koordinate (proga | km+m). Parametri tirov so podatki upravljavca infrastrukture in ne govorijo o posameznem vlaku. TAF TSI koda lokacije (plc) je era:primaryLocationCode.',
  counts: { operationalPoints: opMap.size, sections: solMap.size, tracks: seenTr.size, tunnels: tunMap.size },
  operationalPoints: [...opMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'sl')),
  sections: [...solMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
  tunnels: [...tunMap.values()].sort((a, b) => (b.lengthM || 0) - (a.lengthM || 0))
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, JSON.stringify(out.counts), 'bytes', fs.statSync(OUT).size, 'validity', out.validity);
const noCoord = out.operationalPoints.filter(o => o.lat == null).length;
const noPlc = out.operationalPoints.filter(o => !o.plc).length;
const noTracks = out.sections.filter(s => !s.tracks.length).length;
console.log('ops without coords', noCoord, 'without plc', noPlc, 'sections without tracks', noTracks, 'tunnels without geometry', out.tunnels.filter(t => !t.start).length);
