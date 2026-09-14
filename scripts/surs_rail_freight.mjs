// Pulls Slovenia's official rail-freight statistics into
// src/data/sursRailFreight.json.
//
// SURS (Statistični urad Republike Slovenije) publishes rail freight as
// PX-Web cubes, free and machine-readable, reachable over the JSON-stat2 API
// with no key. The app already had a commodity split from Eurostat; this adds
// the national source plus what Eurostat's SI rows do not break out — where
// the freight is actually loaded and unloaded, by partner country.
//
// Nothing here is a live train position. It is annual tonnage from the
// national statistical office: real, sourced, and only as recent as the last
// published year. It refines the freight picture; it does not locate a train.
//
// Cubes (SiStat matrix ids):
//   2221803S  by commodity type (NST 2007), internal/international/transit
//   2221804S  loaded in SI, by country of unloading
//   2221805S  unloaded in SI, by country of loading
//   2221806S  transit, by country of loading and unloading
//
// Usage:
//   node scripts/surs_rail_freight.mjs [out.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'sursRailFreight.json');
const BASE = 'https://pxweb.stat.si/SiStatData/api/v1/sl/Data/';
const UA = { 'User-Agent': 'nova-app-transport' };
const KEEP_YEARS = 6; // the most recent years, so the file stays small

async function getJson(url, init) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, init);
      if (r.ok) return await r.json();
      if (r.status < 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) { if (attempt === 3) throw e; }
    await new Promise(res => setTimeout(res, (attempt + 1) * 1500));
  }
}

/** Fetch a whole cube as a coordinate → value map, latest KEEP_YEARS only. */
async function cube(id) {
  const meta = await getJson(BASE + id, { headers: UA });
  const yearVar = meta.variables.find(v => v.time || /LETO/i.test(v.code));
  const years = yearVar.values.slice(-KEEP_YEARS);
  const query = meta.variables.map(v => ({
    code: v.code,
    selection: { filter: 'item', values: v === yearVar ? years : v.values }
  }));
  const data = await getJson(BASE + id, {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, response: { format: 'json-stat2' } })
  });
  return { meta, data, years };
}

/** Walk a json-stat2 cube, yielding { dims: {code: label}, value } per cell. */
function* cells(data) {
  const dims = data.id, sizes = data.size;
  const labelByPos = dims.map(d => {
    const cat = data.dimension[d].category;
    const arr = [];
    for (const key of Object.keys(cat.index)) arr[cat.index[key]] = cat.label[key] ?? key;
    return arr;
  });
  for (let i = 0; i < data.value.length; i++) {
    const v = data.value[i];
    if (v == null) continue;
    let rem = i; const coord = {};
    for (let k = sizes.length - 1; k >= 0; k--) {
      coord[dims[k]] = labelByPos[k][rem % sizes[k]];
      rem = Math.floor(rem / sizes[k]);
    }
    yield { coord, value: v };
  }
}

const isTotal = (s) => /SKUPAJ/i.test(String(s));
const TONNES = 'Tone (1000)';
const latestOf = (years) => years[years.length - 1];

// --- 2221803S: by commodity, by internal/international/transit -------------
async function commodity() {
  const { data, years } = await cube('2221803S');
  const latest = latestOf(years);
  const rows = {}; // flow -> commodity -> tonnes(1000)
  const series = {}; // commodity(total flow) -> {year: tonnes}
  for (const { coord, value } of cells(data)) {
    if (coord.MERITVE !== TONNES) continue;
    const flow = coord['NOTRANJI / MEDNARODNI PREVOZ'];
    const good = coord['VRSTA BLAGA'];
    if (coord.LETO === latest && !isTotal(good)) {
      (rows[flow] ||= {})[good] = value;
    }
    if (isTotal(flow) && !isTotal(good)) {
      (series[good] ||= {})[coord.LETO] = value;
    }
  }
  return { latest, years, byFlow: rows, commodityTrend: series };
}

// --- country-flow cubes ----------------------------------------------------
/** One cube of the shape LETO × <country var> × MERITVE, totals dropped. */
async function byCountry(id, countryVar) {
  const { data, years } = await cube(id);
  const latest = latestOf(years);
  const latestRow = {}; // country -> tonnes(1000)
  const trend = {};      // country -> {year: tonnes}
  let totalLatest = null;
  for (const { coord, value } of cells(data)) {
    if (coord.MERITVE !== TONNES) continue;
    const c = coord[countryVar];
    if (isTotal(c)) { if (coord.LETO === latest) totalLatest = value; continue; }
    if (coord.LETO === latest && value > 0) latestRow[c] = value;
    if (value > 0) (trend[c] ||= {})[coord.LETO] = value;
  }
  const ranked = Object.entries(latestRow).sort((a, b) => b[1] - a[1])
    .map(([country, tonnes]) => ({ country, tonnesThousand: tonnes }));
  return { latest, years, totalThousand: totalLatest, countries: ranked, trend };
}

// --- 2221806S: transit, loading country × unloading country ---------------
async function transit() {
  const { data, years } = await cube('2221806S');
  const latest = latestOf(years);
  const pairs = [];
  let totalLatest = null;
  for (const { coord, value } of cells(data)) {
    if (coord.MERITVE !== TONNES || coord.LETO !== latest) continue;
    const from = coord['DRŽAVA NALAGANJA'], to = coord['DRŽAVA RAZLAGANJA'];
    if (isTotal(from) && isTotal(to)) { totalLatest = value; continue; }
    if (isTotal(from) || isTotal(to)) continue;
    if (value > 0) pairs.push({ from, to, tonnesThousand: value });
  }
  pairs.sort((a, b) => b.tonnesThousand - a.tonnesThousand);
  return { latest, years, totalThousand: totalLatest, pairs: pairs.slice(0, 40) };
}

const [comm, loaded, unloaded, tr] = await Promise.all([
  commodity(),
  byCountry('2221804S', 'DRŽAVA RAZLAGANJA'),
  byCountry('2221805S', 'DRŽAVA NALAGANJA'),
  transit()
]);

const out = {
  source: 'SURS – Statistični urad Republike Slovenije, SiStat (železniški blagovni prevoz)',
  sourceUrl: 'https://pxweb.stat.si/SiStatData/',
  api: 'PX-Web JSON-stat2, https://pxweb.stat.si/SiStatData/api/v1/sl/Data/',
  license: 'Uporaba dovoljena z navedbo vira (SURS).',
  retrieved: new Date().toISOString(),
  note: 'Uradna letna statistika železniškega blagovnega prevoza. Realne tone (v 1000), ne ocene in ne položaji vlakov. Najnovejše leto je toliko sveže, kot ga objavi SURS. Prepisano iz SiStat prek API-ja, nič ni dodano.',
  matrices: {
    commodity: '2221803S', loadedInSlovenia: '2221804S',
    unloadedInSlovenia: '2221805S', transit: '2221806S'
  },
  latestYear: comm.latest,
  unit: 'tisoč ton (1000 t)',
  commodity: comm,
  loadedInSlovenia: loaded,   // freight loaded in SI, ranked by destination country
  unloadedInSlovenia: unloaded, // freight unloaded in SI, ranked by origin country
  transit: tr
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, 'bytes', fs.statSync(OUT).size, '| latest', comm.latest);
console.log('commodity flows:', Object.keys(comm.byFlow).join(', '));
console.log('loaded→ top:', loaded.countries.slice(0, 5).map(c => `${c.country} ${c.tonnesThousand}`).join(', '));
console.log('unloaded← top:', unloaded.countries.slice(0, 5).map(c => `${c.country} ${c.tonnesThousand}`).join(', '));
console.log('transit pairs top:', tr.pairs.slice(0, 5).map(p => `${p.from}→${p.to} ${p.tonnesThousand}`).join(', '));
