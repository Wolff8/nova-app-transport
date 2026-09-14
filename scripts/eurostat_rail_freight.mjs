// Pulls Slovenia's rail-freight statistics from Eurostat into
// src/data/eurostatRailFreightSI.json.
//
// Eurostat publishes the rail_go_* cubes (Regulation (EU) 2018/643 on rail
// transport statistics) through its dissemination API as JSON-stat, free and
// without a key. This complements scripts/surs_rail_freight.mjs (SURS, the
// national office): Eurostat has the long time series, quarterly data, the
// NST 2007 commodity split in English and the intermodal-unit breakdown.
//
// Nothing here is a live train position. It is official tonnage, exactly as
// Eurostat serves it: real, sourced, and only as recent as the last published
// period. Every number in the output is copied from the API response; the only
// thing added by this script are Slovene labels for the NST 2007 groups and
// units, and those are flagged as app translations.
//
// Cubes (Eurostat dataset codes):
//   rail_go_grpgood  goods by NST 2007 group, annual (2008-), tonnes + tkm
//   rail_go_quartal  goods transported, quarterly (2004-Q1-), tonnes + tkm
//   rail_go_contwgt  goods in intermodal transport units, by coverage × cargo
//   rail_go_typeall  goods by type of transport (nat/intl/transit), 2003-2016
//   rail_go_intcmgn  international, by country of loading (into SI)
//   rail_go_intgong  international, by country of unloading (out of SI)
//
// Usage (outbound HTTPS goes through a proxy, so let fetch honour the env):
//   NODE_USE_ENV_PROXY=1 node scripts/eurostat_rail_freight.mjs [out.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'eurostatRailFreightSI.json');
const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/';
const UA = { 'User-Agent': 'nova-app-transport', Accept: 'application/json' };
const GEO = 'SI';

const cubeUrl = (code) => `${BASE}${code}?geo=${GEO}&format=JSON&lang=EN`;

/** GET JSON, retrying up to 3 times with backoff on network/5xx errors. */
async function getJson(url) {
  const RETRIES = 3;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
      const body = (await r.text()).slice(0, 200);
      if (r.status < 500 && r.status !== 429) throw Object.assign(new Error(`HTTP ${r.status}: ${body}`), { fatal: true });
      throw new Error(`HTTP ${r.status}: ${body}`);
    } catch (e) {
      if (e.fatal || attempt >= RETRIES) throw e;
      console.warn(`retry ${attempt + 1}/${RETRIES} for ${url}: ${e.message}`);
      await new Promise(res => setTimeout(res, (attempt + 1) * 2000));
    }
  }
}

/** Fetch one cube; returns null (and logs) if Eurostat has no SI data for it. */
async function cube(code) {
  const url = cubeUrl(code);
  try {
    const data = await getJson(url);
    const n = Array.isArray(data.value) ? data.value.filter(v => v != null).length : Object.keys(data.value || {}).length;
    if (!n) { console.warn(`${code}: no values for ${GEO}, skipping`); return null; }
    return { code, url, data };
  } catch (e) {
    console.warn(`${code}: ${e.message} — skipping`);
    return null;
  }
}

/**
 * Walk a JSON-stat cube (Eurostat's sparse `value` object or a dense array),
 * yielding { coord: {dim: code}, value } per non-empty cell. Labels are looked
 * up separately with labelOf() so rows can carry codes and labels as needed.
 */
function* cells(data) {
  const dims = data.id, sizes = data.size;
  const codeByPos = dims.map(d => {
    const idx = data.dimension[d].category.index;
    const arr = [];
    if (Array.isArray(idx)) idx.forEach((k, i) => { arr[i] = k; });
    else for (const key of Object.keys(idx)) arr[idx[key]] = key;
    return arr;
  });
  const entries = Array.isArray(data.value)
    ? data.value.map((v, i) => [i, v])
    : Object.entries(data.value).map(([i, v]) => [Number(i), v]);
  for (const [i, v] of entries) {
    if (v == null) continue;
    let rem = i; const coord = {};
    for (let k = sizes.length - 1; k >= 0; k--) {
      coord[dims[k]] = codeByPos[k][rem % sizes[k]];
      rem = Math.floor(rem / sizes[k]);
    }
    yield { coord, value: v };
  }
}

const labelOf = (data, dim, code) => data.dimension[dim].category.label?.[code] ?? code;
/** {code: label} for one dimension, in cube order. */
function labelMap(data, dim) {
  const cat = data.dimension[dim].category;
  const out = {};
  for (const code of Object.keys(cat.index).sort((a, b) => cat.index[a] - cat.index[b])) out[code] = cat.label?.[code] ?? code;
  return out;
}
const byTime = (a, b) => (a.year ?? a.quarter).localeCompare(b.year ?? b.quarter);
const latestKey = (rows, key) => rows.reduce((m, r) => (r[key] > m ? r[key] : m), '');

// Slovene labels, translated for the app (Eurostat serves EN only per request;
// these are not copied from a Eurostat/SURS Slovene table).
const UNIT_SL = { THS_T: 'tisoč ton', MIO_TKM: 'milijon tonskih kilometrov (tkm)' };
const NST07_SL = {
  TOTAL: 'Skupaj prepeljano blago',
  GT01: 'Kmetijski, lovski in gozdarski proizvodi; ribe in drugi ribiški proizvodi',
  GT02: 'Premog in lignit; surova nafta in zemeljski plin',
  GT03: 'Kovinske rude in drugi proizvodi rudarjenja in kamnolomov; šota; uran in torij',
  GT04: 'Živila, pijače in tobačni izdelki',
  GT05: 'Tekstil in tekstilni izdelki; usnje in usnjeni izdelki',
  GT06: 'Les ter izdelki iz lesa in plute (razen pohištva); izdelki iz slame in pletarski izdelki; vlaknine, papir in papirni izdelki; tiskovine in posneti nosilci zapisa',
  GT07: 'Koks in naftni derivati',
  GT08: 'Kemikalije, kemični izdelki in umetna vlakna; izdelki iz gume in plastičnih mas; jedrsko gorivo',
  GT09: 'Drugi nekovinski mineralni izdelki',
  GT10: 'Kovine; kovinski izdelki, razen strojev in naprav',
  GT11: 'Stroji in naprave, d. n.; pisarniški stroji in računalniki; električni stroji in aparati, d. n.; radijske, televizijske in komunikacijske naprave; medicinski, precizni in optični instrumenti; ure',
  GT12: 'Transportna oprema (vozila in plovila)',
  GT13: 'Pohištvo; drugi izdelki predelovalnih dejavnosti, d. n.',
  GT14: 'Sekundarne surovine; komunalni in drugi odpadki',
  GT15: 'Pošta, paketi',
  GT16: 'Oprema in material za prevoz blaga',
  GT17: 'Blago, premeščeno ob selitvah gospodinjstev in pisarn; prtljaga in predmeti, ki spremljajo potnike; motorna vozila, premeščena zaradi popravila; drugo netržno blago, d. n.',
  GT18: 'Združeno blago: mešanica različnih vrst blaga, ki se prevaža skupaj',
  GT19: 'Neopredeljivo blago: blago, ki ga iz kakršnega koli razloga ni mogoče opredeliti in zato uvrstiti v skupine 01–16',
  GT20: 'Drugo blago, d. n.'
};

/** Common header for a cube's output block. */
function head(c, extra = {}) {
  return {
    code: c.code,
    title: c.data.label,
    sourceUrl: c.url,
    updated: c.data.updated ?? null,
    units: labelMap(c.data, 'unit'),
    unitsSl: UNIT_SL,
    unitsSlTranslatedByApp: true,
    ...extra
  };
}

// --- rail_go_grpgood: NST 2007 commodity groups, annual --------------------
function grpgood(c) {
  const d = c.data;
  const rows = [];
  for (const { coord, value } of cells(d)) {
    rows.push({
      year: coord.time, nst07: coord.nst07,
      label: labelOf(d, 'nst07', coord.nst07),
      labelSl: NST07_SL[coord.nst07] ?? null,
      unit: coord.unit, value
    });
  }
  rows.sort(byTime);
  return head(c, {
    filter: { geo: GEO, freq: 'A' },
    note: 'nst07=TOTAL is the Eurostat total row; GT01–GT20 are the 20 NST 2007 groups.',
    labelSlTranslatedByApp: true,
    nst07LabelsSl: NST07_SL,
    years: Object.keys(labelMap(d, 'time')),
    latestYear: latestKey(rows, 'year'),
    rows
  });
}

// --- rail_go_quartal: quarterly goods transported --------------------------
function quarterly(c) {
  const d = c.data;
  const rows = [];
  for (const { coord, value } of cells(d)) {
    const [year, q] = coord.time.split('-');
    rows.push({ quarter: coord.time, year, q, unit: coord.unit, value });
  }
  rows.sort(byTime);
  return head(c, {
    // The SI slice of this cube has only freq/unit/geo/time (no tra_cov
    // dimension), so the total tonnes series is simply unit=THS_T.
    filter: { geo: GEO, freq: 'Q', dimensions: d.id.join(','), tonnesSeries: 'unit=THS_T', tkmSeries: 'unit=MIO_TKM' },
    latestQuarter: latestKey(rows, 'quarter'),
    rows
  });
}

// --- rail_go_contwgt: intermodal transport units ---------------------------
function intermodal(c) {
  const d = c.data;
  const rows = [];
  for (const { coord, value } of cells(d)) {
    rows.push({ year: coord.time, tra_cov: coord.tra_cov, cargo: coord.cargo, unit: coord.unit, value });
  }
  rows.sort(byTime);
  return head(c, {
    filter: { geo: GEO, freq: 'A' },
    note: 'Weight only: this cube carries thousand tonnes and million tkm per transport coverage × type of cargo. Eurostat does not publish TEU counts for SI in this cube. Row codes resolve via transportCoverage / cargoTypes / units.',
    transportCoverage: labelMap(d, 'tra_cov'),
    cargoTypes: labelMap(d, 'cargo'),
    latestYear: latestKey(rows, 'year'),
    rows
  });
}

// --- rail_go_typeall: national / international / transit, 2003-2016 --------
function typeall(c) {
  const d = c.data;
  const rows = [];
  for (const { coord, value } of cells(d)) {
    rows.push({ year: coord.time, tra_cov: coord.tra_cov, unit: coord.unit, value });
  }
  rows.sort(byTime);
  return head(c, {
    filter: { geo: GEO, freq: 'A' },
    note: 'Eurostat stopped this cube after 2016. Row codes resolve via transportCoverage / units.',
    transportCoverage: labelMap(d, 'tra_cov'),
    latestYear: latestKey(rows, 'year'),
    rows
  });
}

// --- rail_go_intcmgn / rail_go_intgong: international by partner country ---
function byCountry(c, dim, direction) {
  const d = c.data;
  const rows = [];
  for (const { coord, value } of cells(d)) {
    rows.push({ year: coord.time, country: coord[dim], unit: coord.unit, value });
  }
  rows.sort(byTime);
  return head(c, {
    filter: { geo: GEO, freq: 'A' },
    direction,
    countryDimension: dim,
    note: 'Aggregates (EU27_2020, EU28, EU27_2007, WORLD, UNK) are kept as Eurostat serves them; filter on the country code when summing. Row codes resolve via countries / units.',
    countries: labelMap(d, dim),
    latestYear: latestKey(rows, 'year'),
    rows
  });
}

const CUBES = [
  ['grpgood', 'rail_go_grpgood', grpgood],
  ['quarterly', 'rail_go_quartal', quarterly],
  ['intermodal', 'rail_go_contwgt', intermodal],
  ['byType', 'rail_go_typeall', typeall],
  ['intlByLoadingCountry', 'rail_go_intcmgn', c => byCountry(c, 'c_load', 'goods unloaded in Slovenia, by country of loading')],
  ['intlByUnloadingCountry', 'rail_go_intgong', c => byCountry(c, 'c_unload', 'goods loaded in Slovenia, by country of unloading')]
];

const fetched = await Promise.all(CUBES.map(([, code]) => cube(code)));
const cubes = {}, sourceUrls = {}, skipped = [];
CUBES.forEach(([key, code, build], i) => {
  const c = fetched[i];
  if (!c) { skipped.push(code); return; }
  sourceUrls[code] = c.url;
  cubes[key] = build(c);
});
if (!cubes.grpgood || !cubes.quarterly || !cubes.intermodal) {
  throw new Error(`required cube missing; skipped: ${skipped.join(', ')}`);
}

const out = {
  source: 'Eurostat – Railway transport statistics (rail_go_*), reporting country Slovenia',
  api: 'Eurostat dissemination API, JSON-stat: ' + BASE,
  sourceUrls,
  skippedCubes: skipped,
  licence: 'Eurostat – free re-use, CC BY 4.0',
  licenceUrl: 'https://ec.europa.eu/eurostat/about-us/policies/copyright',
  retrieved: new Date().toISOString(),
  geo: GEO,
  note: 'Uradna statistika Eurostata o železniškem blagovnem prevozu za Slovenijo. Vrednosti so prepisane iz API-ja brez sprememb; enote so tisoč ton (THS_T) in milijon tonskih kilometrov (MIO_TKM). Slovenski nazivi skupin NST 2007 in enot so prevod aplikacije, ne Eurostata.',
  cubes
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, 'bytes', fs.statSync(OUT).size, '| retrieved', out.retrieved);
if (skipped.length) console.log('skipped cubes:', skipped.join(', '));
for (const [key, block] of Object.entries(cubes)) {
  console.log(`\n${key} (${block.code}): ${block.rows.length} rows | latest ${block.latestYear ?? block.latestQuarter} | updated ${block.updated}`);
  for (const r of block.rows.slice(-3)) console.log('  ', JSON.stringify(r));
}
