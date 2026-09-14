// Turns ERA's "Cross Reference Table between List of parameters and TSIs"
// into src/data/eraParameterTsiXref.json.
//
// ERATV records a vehicle's authorisation against national rules as a list of
// bare parameter numbers ("2.1.2.2 Axle load and wheel load", "8.2.2.2
// Pantograph head geometry"). This table is the register's own key to those
// numbers: for each of the 319 parameters it says whether the parameter is
// used for network (route) compatibility, and which clause of which TSI
// covers it.
//
// The report is an ERA Reporting Services export and is not fetchable without
// a session, so it is read from a file the user supplies:
//   node scripts/era_parameter_tsi_xref.mjs <Cross_Reference_Table...xml>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'eraParameterTsiXref.json');
if (!SRC) { console.error('usage: node scripts/era_parameter_tsi_xref.mjs <xml> [out.json]'); process.exit(1); }

/** Column name in the report to the act it stands for. */
const TSI_TITLES = {
  CR_WAG_TSI_321_2013: 'WAG TSI – Uredba (EU) 321/2013 (tovorni vagoni)',
  CR_WAG_TSI_1236_2013: 'WAG TSI – Uredba (EU) 1236/2013 (tovorni vagoni)',
  LOC___PAS_TSI_1302_2014: 'LOC&PAS TSI – Uredba (EU) 1302/2014 (lokomotive in potniška vozila)',
  CR_LOC_PAS_TSI_2011_291_EU: 'CR LOC&PAS TSI – Sklep 2011/291/EU',
  HS_RST_TSI_2008_232_CE: 'HS RST TSI – Odločba 2008/232/ES (vozila za visoke hitrosti)',
  INF_TSI_1299_2014: 'INF TSI – Uredba (EU) 1299/2014 (infrastruktura)',
  CR_INF_TSI_2011_275_EU: 'CR INF TSI – Sklep 2011/275/EU (infrastruktura)',
  HS_INF_TSI_2008_217_EC: 'HS INF TSI – Odločba 2008/217/ES (infrastruktura za visoke hitrosti)',
  CCS_TSI_2012_88_EU__amended_by_2012_696_EU: 'CCS TSI – Sklep 2012/88/EU (vodenje in signalizacija)',
  CCS_TSI_2015_14: 'CCS TSI – Sklep (EU) 2015/14 (vodenje in signalizacija)',
  ERA_ERTMS_033281_version_2_0: 'ERA/ERTMS/033281 v2.0 (vmesniki med vozilom in progo)',
  SRT_TSI_2008_163_EC: 'SRT TSI – Odločba 2008/163/ES (varnost v predorih)',
  SRT_TSI_1303_2014: 'SRT TSI – Uredba (EU) 1303/2014 (varnost v predorih)',
  OPE_TSI_2012_757_EU: 'OPE TSI – Sklep 2012/757/EU (vodenje in upravljanje prometa)',
  PRM_TSI_1300_2014: 'PRM TSI – Uredba (EU) 1300/2014 (dostopnost)',
  PRM_TSI_2008_164_CE: 'PRM TSI – Odločba 2008/164/ES (dostopnost)',
  ENE_TSI_1301_2014: 'ENE TSI – Uredba (EU) 1301/2014 (energija)',
  CR_ENE_2011_274_EU: 'CR ENE TSI – Sklep 2011/274/EU (energija)',
  HS_ENE_2008_284_CE: 'HS ENE TSI – Odločba 2008/284/ES (energija)',
  NOI_TSI_1304_2014: 'NOI TSI – Uredba (EU) 1304/2014 (hrup)',
  CR_NOI_TSI_2011_229_EU__repealed_by_1304_2014_: 'CR NOI TSI – Sklep 2011/229/EU (hrup, razveljavljen)',
  CR_TAF_TSI_62_2006: 'TAF TSI – Uredba (ES) 62/2006 (telematika za tovorni promet)',
  TAP_TSI_454_2011: 'TAP TSI – Uredba (EU) 454/2011 (telematika za potniški promet)'
};

const $ = cheerio.load(fs.readFileSync(SRC, 'utf-8').replace(/^﻿/, ''), { xmlMode: true });
const clean = (v) => String(v || '').replace(/\r\n?/g, '\n').split('\n').map(x => x.trim()).filter(Boolean);

const parameters = [];
$('Details').each((_, el) => {
  const a = $(el).attr() || {};
  const raw = a.BPL1param;
  if (!raw) return;
  const m = String(raw).match(/^([\d.]+)\s*-\s*(.+)$/);
  const tsis = [];
  for (const [col, title] of Object.entries(TSI_TITLES)) {
    const v = a[col];
    if (!v) continue;
    tsis.push({ tsi: title, column: col, clauses: clean(v) });
  }
  parameters.push({
    number: m ? m[1] : String(raw).trim(),
    name: m ? m[2].trim() : String(raw).trim(),
    networkCompatibility: a.Network_Compatability === 'Yes',
    tsis
  });
});

const out = {
  source: 'ERA – Cross Reference Table between List of parameters and TSIs (poročilo iz zbirke ERA RDD)',
  note: 'Seznam parametrov, po katerih se ugotavlja skladnost z nacionalnimi predpisi; ERATV jih pri vozilu navaja le po številki. Za vsak parameter je navedeno, ali se uporablja za združljivost s progo, in katere klavzule TSI ga pokrivajo. Vrednosti so prepisane iz poročila, nič ni dodano.',
  retrieved: new Date().toISOString(),
  sourceFile: path.basename(SRC),
  counts: {
    parameters: parameters.length,
    networkCompatibility: parameters.filter(p => p.networkCompatibility).length,
    withTsi: parameters.filter(p => p.tsis.length).length
  },
  parameters
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, JSON.stringify(out.counts), 'bytes', fs.statSync(OUT).size);
console.log('sample:', JSON.stringify(parameters.find(p => p.networkCompatibility && p.tsis.length)).slice(0, 320));
