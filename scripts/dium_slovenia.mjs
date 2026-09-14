// Turns UIC's DIUM SI into src/data/diumSlovenia.json.
//
// DIUM (Distancier International Uniforme Marchandises / Enotni daljinar za
// mednarodni blagovni promet) is the official directory of the stations a
// country's network is open to freight on. The Slovenian edition is prepared
// by SŽ – Tovorni promet and published by the UIC as a free PDF:
//
//   https://uic.org/IMG/pdf/dium_si_01.07_2024.pdf
//
// It carries, per station: the UIC code, the name, what the station may
// handle (ramps, dangerous goods, tank wagons, containers), the private
// sidings and loading places that hang off it with the company each belongs
// to, and the tariff distance to all eleven border crossings. The app
// previously knew six freight points, all from RINF; this is the register
// that says which of the 319 operational points freight may actually be
// handed over at.
//
// The station codes are the same five digits RINF uses in its UOPID, so the
// two join exactly, with no name matching.
//
// Usage:
//   node scripts/dium_slovenia.mjs <dium_si.pdf> [out.json]
//
// Needs pdfjs-dist, which is not an app dependency — this is a build-time
// script, so install it ad hoc:
//   npm i --no-save pdfjs-dist
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'diumSlovenia.json');
if (!SRC) { console.error('usage: node scripts/dium_slovenia.mjs <dium_si.pdf> [out.json]'); process.exit(1); }

let pdfjs;
try { pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); }
catch { console.error('pdfjs-dist is missing. Run: npm i --no-save pdfjs-dist'); process.exit(1); }

/** The document's own legend, pages 12 (Slovene) — reproduced verbatim. */
const GENERAL_MARKERS = {
  '1': 'Mejni prehod, služi samo za računanje prevoznine v mednarodnem prometu. V tovornem listu CIM / vagonskem listu CUV ne more biti naveden kot namembna postaja.',
  '2': 'Mejni prehod z omejitvami.',
  '3': 'Postaje v notranjosti z možnostjo opravljanja carinskih postopkov.',
  '4': 'Postaja z drugimi omejitvami glede odprtosti.',
  '5': 'Odprto samo za kompletne vlake.',
  '6': 'Promet je do nadaljnjega zaprt, razen v bilateralnem prometu.',
  '7': 'Postaja, za katere se računajo dodatne prevoznine ali pristojbine.',
  '8': 'Postaja, na katerih je možen promet v odpravi in prispetju iz ali za privatne industrijske tire.',
  '9': 'Nakladalno mesto = vsako nakladalno mesto je dodeljeno eni tovorni postaji. Kraj nakladanja ne more biti v tovornem listu CIM / vagonskem listu CUV imenovano kot odpravna postaja / namembna postaja, lahko pa je v polju »kraj prevzema/kraj izročitve« imenovano kot mesto, kjer se da pošiljko na razpolago. Za določanje oddaljenosti pri nakladalnih mestih se za osnovo vzamejo oddaljenosti pristojne tovorne postaje.',
  '10': 'Postaja na kateri se opravljajo reekspedicije za CIM/SMGS promet.'
};
const SPECIAL_MARKERS = {
  a: 'Postaja odprta samo za pošiljke uporabnikov, ki imajo s SŽ – Tovorni promet, d.o.o. sklenjeno posebno pogodbo.',
  b: 'Postaja ima čelno klančino.',
  c: 'Postaja ima bočno klančino.',
  d: 'Odprto samo za: vagonske pošiljke minimalno 6 vagonov ali kompletne vlake; izredne pošiljke, ki se prevažajo s posebnim varnostnim pogojem št. 45 (kot poseben vlak); pošiljke lokomotiv vlečenih na lastnih kolesih in tirno gradbeno mehanizacijo za potrebe vzdrževanja ali izgradnje železniške infrastrukture; vojaške prevoze.',
  f: 'Terminalska postaja, odprta samo za promet z velikimi kontejnerji, zamenljivimi kamionskimi zaboji in za oprtni promet. Odprta tudi za pošiljke praznih zasebnih vagonov in cestnih vozil.',
  g: 'Postaja ni odprta za prevoz nevarnih snovi in predmetov razreda 1 RID (dodatek C h konvenciji COTIF).',
  h: 'Postaja ni odprta za vagone-cisterne.',
  i: 'Postaja ni odprta za vagone-cisterne s surovimi olji (nafte), bencinom, mazutom, dizel olji, plinskim oljem, kurilnim oljem, petrolejem – ali pa samo pod posebnimi pogoji lastnikov industrijskih tirov.',
  j: 'Postaja ni odprta za vagone-cisterne z vnetljivimi tekočinami – ali pa samo pod posebnimi pogoji lastnikov industrijskih tirov.',
  k: 'Razdalja vsebuje celotno relacijo SŽ. Razdalja za tranzitno relacijo preko HŽ (Mursko Središće gr. – Čakovec gr.) se določa posebej.',
  l: 'Postaja je odprta samo za uporabnike in souporabnike industrijskih tirov.',
  m: 'Luška postaja.',
  r: 'Posebna pogodba ne velja za "kraj izročitve/prevzema" Koper tovorna-Petrol d.d.',
  s: 'Trenutno je tir zaprt.'
};

/** The suffix the document prints after a neighbouring station's name. */
const NEIGHBOUR_SUFFIX_COUNTRY = [
  [/\bConf\.?$/, 'IT'],
  [/\bGr\.$/, 'AT'],
  [/\bgr\.$/, 'HR'],
  [/hatar$|határ$/i, 'HU']
];

/**
 * Two names the daljinar itself misspells. Corrected only where the register
 * (RINF) and the daljinar clearly mean the same point, and only by exact
 * substitution — nothing is guessed.
 */
const DIUM_MISSPELLINGS = { 'Nova Gorca meja': 'Nova Gorica meja' };

const data = new Uint8Array(fs.readFileSync(SRC));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

/** One page as rows of {x, s} items, top line first. */
async function pageRows(n) {
  const c = await (await doc.getPage(n)).getTextContent();
  const byY = new Map();
  for (const it of c.items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    const key = [...byY.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key).push({ x: Math.round(it.transform[4]), y, w: Math.round(it.width || 0), s: it.str.trim() });
  }
  return [...byY.entries()].sort((a, b) => b[0] - a[0]).map(([y, items]) => ({ y, items: items.sort((a, b) => a.x - b.x) }));
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const CODE = /^(\d{5})\s+(\d)$/;

/**
 * A distance page: the column anchors come from the page's own row of border
 * point codes, so the parse follows the layout instead of assuming it.
 */
function columnsOf(rows) {
  for (const r of rows) {
    const codes = r.items.filter(i => /^\d{3}$/.test(i.s) && i.x > 330);
    if (codes.length >= 5) return codes.map(i => ({ code: i.s, x: i.x }));
  }
  return null;
}

/** The rotated header above the code row, one Slovene name + one neighbour per column. */
function headerNames(rows, cols) {
  const row = rows.find(r => r.items.some(i => /meja$/.test(i.s)) && r.items.filter(i => /meja$|Conf\.?$|Gr\.$|gr\.$|hatar$/.test(i.s)).length >= 4);
  if (!row) return new Map();
  const out = new Map();
  for (const col of cols) {
    const near = row.items.filter(i => i.x >= col.x - 2 && i.x <= col.x + 26).sort((a, b) => a.x - b.x);
    const si = near.find(i => /meja$/.test(i.s));
    const other = near.filter(i => i !== si);
    const name = si ? si.s : (near[0] ? near[0].s : null);
    out.set(col.code, {
      name: DIUM_MISSPELLINGS[name] || name,
      neighbour: other.length ? other.map(i => i.s).join(' ') : null
    });
  }
  return out;
}

const DIST_VALUE = /^(\d{1,4}|[-–])$/;
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Distance cells are right-aligned under their column head, so a one-digit
 * value sits further right than a three-digit one — far enough that matching
 * on the left edge puts it under the next column. Three-digit values are
 * unambiguous, so their right edges fix where a page's column right margin
 * falls, and every value is then placed by its own right edge.
 */
function rightMargin(rows, cols) {
  const offs = [];
  for (const r of rows) {
    if (!r.items.some(i => i.s === '2179')) continue;
    for (const it of r.items) {
      if (!/^\d{3}$/.test(it.s) || it.x < cols[0].x - 12 || !it.w) continue;
      let best = null;
      for (const col of cols) {
        const d = Math.abs(it.x - col.x);
        if (!best || d < best.d) best = { col, d };
      }
      if (best && best.d <= 12) offs.push(it.x + it.w - best.col.x);
    }
  }
  return offs.length ? median(offs) : 19;
}

/** Splits one table line into code, name, markers, parent station and distances. */
function parseLine(items, cols, margin) {
  const first = cols[0].x - 12;
  const dist = items.filter(i => i.x >= first);
  const head = items.filter(i => i.x < first && i.s !== '2179');
  if (!head.length) return null;

  const codeItem = head.find(i => CODE.test(i.s) || /^\d{3}$/.test(i.s));
  if (!codeItem) return null;
  const rest = head.filter(i => i !== codeItem && i.x > codeItem.x);

  let parent = null;
  const general = [];
  const special = [];
  const nameParts = [];
  const markerZone = first - 130;
  for (const it of rest) {
    if (CODE.test(it.s) && it.x > markerZone) { parent = it.s.replace(/\s+/g, '').slice(0, 5); continue; }
    if (it.x > markerZone && /^(?:10|[1-9])(?:,\s?(?:10|[1-9]))*$/.test(it.s)) { general.push(...it.s.split(',').map(v => v.trim())); continue; }
    if (it.x > markerZone && /^[a-z](?:,\s?[a-z])*$/.test(it.s)) { special.push(...it.s.split(',').map(v => v.trim())); continue; }
    nameParts.push(it.s);
  }
  // The document splits a marker run across the two columns, e.g. "1,2" then "d".
  for (let k = general.length - 1; k >= 0; k--) {
    if (/^[a-z]$/.test(general[k])) special.unshift(general.splice(k, 1)[0]);
  }

  // A station with no tariff to a given border simply has a blank cell, so
  // each value goes to the column its right edge falls under; two values
  // landing on one column means the row was read wrong, and it is dropped.
  const distances = {};
  let clash = false;
  for (const it of dist) {
    if (!DIST_VALUE.test(it.s)) continue;
    const right = it.x + (it.w || 0);
    let best = null;
    for (const col of cols) {
      const d = Math.abs(right - (col.x + margin));
      if (d <= 14 && (!best || d < best.d)) best = { col, d };
    }
    if (!best) continue;
    if (best.col.code in distances) clash = true;
    distances[best.col.code] = it.s === '-' || it.s === '–' ? null : Number(it.s);
  }
  if (clash) return null;

  const name = nameParts.join(' ').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
  return {
    code: codeItem.s.replace(/\s+/g, '').slice(0, 5),
    checkDigit: CODE.test(codeItem.s) ? codeItem.s.match(CODE)[2] : null,
    name,
    general: [...new Set(general)],
    special: [...new Set(special)],
    parent,
    distances
  };
}

const borderMeta = new Map();
const points = new Map();   // code -> merged record
const transit = new Map();
const intermodal = [];

for (let p = 1; p <= doc.numPages; p++) {
  const rows = await pageRows(p);
  const flat = rows.map(r => r.items.map(i => i.s).join(' ')).join('\n');

  if (/Največja dolžina/.test(flat)) {
    for (const r of rows) {
      const parsed = r.items.filter(i => i.s !== '2179');
      const code = parsed.find(i => /^\d{5}$/.test(i.s) || CODE.test(i.s));
      if (!code) continue;
      const nums = parsed.filter(i => /^\d{1,3}$/.test(i.s) && i.x > 300).map(i => Number(i.s));
      if (nums.length < 3) continue;
      const body = parsed.filter(i => i.x > code.x && i.x <= 300 && !/^\d$/.test(i.s));
      intermodal.push({
        code: code.s.replace(/\s+/g, '').slice(0, 5),
        name: body.filter(i => i.s !== 'A').map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(),
        privateTerminal: body.some(i => i.s === 'A'),
        maxContainerLengthFt: nums[0],
        maxGrossTonnesContainer: nums[1],
        maxGrossTonnesGrabberSemiTrailer: nums[2]
      });
    }
    continue;
  }

  const cols = columnsOf(rows);
  if (!cols) continue;
  // Some pages print the column head without the " meja" suffix; keep the
  // fullest spelling the document gives.
  for (const [code, meta] of headerNames(rows, cols)) {
    if (!meta.name) continue;
    const prev = borderMeta.get(code);
    if (!prev || (!/ meja$/.test(prev.name) && / meja$/.test(meta.name))) borderMeta.set(code, meta);
  }

  const isTransit = /Distances de transit|Tranzitne razdalije/.test(flat);
  const margin = rightMargin(rows, cols);
  for (const r of rows) {
    if (!r.items.some(i => i.s === '2179')) continue;
    const rec = parseLine(r.items, cols, margin);
    if (!rec || !rec.name || !Object.keys(rec.distances).length) continue;
    const into = isTransit ? transit : points;
    const prev = into.get(rec.code);
    if (prev) {
      Object.assign(prev.distances, rec.distances);
      if (!prev.parent && rec.parent) prev.parent = rec.parent;
      prev.general = [...new Set([...prev.general, ...rec.general])];
      prev.special = [...new Set([...prev.special, ...rec.special])];
    } else into.set(rec.code, rec);
  }
}

// Join to RINF by the five digits both registers use.
const rinf = JSON.parse(fs.readFileSync(path.join(path.dirname(OUT), 'rinfSlovenia.json'), 'utf-8'));
const rinfByCode = new Map(rinf.operationalPoints.map(o => [String(o.uopid).replace(/^SI/, ''), o]));
const rinfByName = new Map();
for (const o of rinf.operationalPoints) if (!rinfByName.has(norm(o.name))) rinfByName.set(norm(o.name), o);

/**
 * The two registers share the five-digit code, so that is the join. Where the
 * daljinar uses a code RINF does not carry, fall back to an exact name match
 * (after stripping diacritics and punctuation) and say which join was used.
 */
const shape = (o, joinedBy) => ({ uopid: o.uopid, name: o.name, type: o.type, lat: o.lat, lon: o.lon, joinedBy });
const linkRinf = (code, name) => {
  const byCode = rinfByCode.get(code);
  if (byCode) return shape(byCode, 'code');
  const byName = name ? rinfByName.get(norm(name)) : null;
  // Only where no tariff point has already claimed that register entry by
  // code — the daljinar carries two tariff points for Ljubljana Zalog and
  // they must not both land on the one operational point.
  if (byName && !points.has(String(byName.uopid).replace(/^SI/, ''))) return shape(byName, 'name');
  return null;
};

const stations = [];
const loadingPlaces = [];
const borderRows = new Map();
for (const rec of points.values()) {
  const row = {
    code: rec.code,
    uic: `2179${rec.code}${rec.checkDigit ?? ''}`.trim(),
    name: rec.name,
    generalMarkers: rec.general,
    specialMarkers: rec.special,
    distancesKm: rec.distances
  };
  if (rec.code.length < 5) { borderRows.set(rec.code, row); continue; }
  // Marker 9 says "loading place", but the daljinar also prints it on a
  // handful of stations; the parent station column is what actually makes a
  // row a loading place, so that is what decides.
  if (rec.parent) {
    loadingPlaces.push({ ...row, station: rec.parent, rinf: rec.parent ? linkRinf(rec.parent) : null });
  } else {
    stations.push({ ...row, rinf: linkRinf(rec.code, rec.name) });
  }
}
stations.sort((a, b) => a.name.localeCompare(b.name, 'sl'));
loadingPlaces.sort((a, b) => a.name.localeCompare(b.name, 'sl'));

const borderPoints = [...borderMeta.entries()].map(([code, meta]) => {
  const t = transit.get(code) || borderRows.get(code);
  const bare = String(meta.name || '').replace(/\s*meja$/, '').trim();
  const dm = rinfByName.get(norm(`${bare} d.m.`));
  const partner = dm?.border?.partner ?? null;
  // The country comes from the register where it names the point on the other
  // side, otherwise from the suffix the daljinar itself prints after the
  // neighbouring station (Conf. / Gr. / gr. / határ).
  const ISO3 = { HUN: 'HU', ITA: 'IT', AUT: 'AT', HRV: 'HR' };
  let country = partner?.country ? ISO3[partner.country] ?? null : null;
  if (!country) for (const [re, c] of NEIGHBOUR_SUFFIX_COUNTRY) if (meta.neighbour && re.test(meta.neighbour)) { country = c; break; }
  const st = rinfByName.get(norm(bare));
  return {
    code,
    name: meta.name,
    tariffPoint: bare,
    neighbour: meta.neighbour,
    neighbourCountry: country,
    generalMarkers: t ? t.generalMarkers || t.general || [] : [],
    specialMarkers: t ? t.specialMarkers || t.special || [] : [],
    transitDistancesKm: t ? t.distancesKm || t.distances || {} : {},
    rinfBorderPoint: dm ? { uopid: dm.uopid, name: dm.name, lat: dm.lat, lon: dm.lon, partner } : null,
    rinfStation: st ? shape(st, 'name') : null
  };
}).sort((a, b) => a.name.localeCompare(b.name, 'sl'));

for (const t of intermodal) t.rinf = linkRinf(t.code, t.name);

const out = {
  source: 'UIC – DIUM SI: Enotni daljinar za mednarodni blagovni promet (Seznam postaj odprtih za tovorni promet, Seznam krajev prevzema/izročitve)',
  url: 'https://uic.org/IMG/pdf/dium_si_01.07_2024.pdf',
  publisher: 'SŽ – Tovorni promet, d.o.o.',
  copyright: '© 2024 SŽ – Tovorni promet, d.o.o., Ljubljana, Slovenija; pravice za distribucijo po elektronskih medijih ima UIC, Pariz.',
  edition: '2024-07-01',
  retrieved: new Date().toISOString(),
  sourceFile: path.basename(SRC),
  note: 'Uradni seznam službenih mest, odprtih za tovorni promet v Sloveniji. Postajne šifre so istih pet števk, ki jih uporablja register RINF, zato sta registra povezana natančno, brez ujemanja po imenih. Razdalje so tarifne razdalje do mejnih prehodov, kot jih navaja daljinar — niso izmerjene in niso ocene. Prepisano iz daljinarja, nič ni dodano.',
  legend: { generalMarkers: GENERAL_MARKERS, specialMarkers: SPECIAL_MARKERS },
  counts: {
    stations: stations.length,
    stationsWithRinf: stations.filter(s => s.rinf).length,
    loadingPlaces: loadingPlaces.length,
    borderPoints: borderPoints.length,
    intermodalTerminals: intermodal.length
  },
  borderPoints,
  stations,
  loadingPlaces,
  intermodalTerminals: intermodal
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, JSON.stringify(out.counts), 'bytes', fs.statSync(OUT).size);
console.log('no RINF match:', stations.filter(s => !s.rinf).map(s => `${s.code} ${s.name}`).join(', ') || '(none)');
console.log('border points:', borderPoints.map(b => `${b.code} ${b.name}→${b.neighbour} [${b.neighbourCountry}]${b.rinfBorderPoint ? ' ✓rinf' : ''}`).join('\n  '));
console.log('sample station:', JSON.stringify(stations.find(s => s.specialMarkers.length && s.rinf)));
console.log('sample loading place:', JSON.stringify(loadingPlaces[0]));
