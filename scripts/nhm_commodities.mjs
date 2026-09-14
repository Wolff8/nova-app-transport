// Turns UIC's NHM into src/data/nhmCommodities.json.
//
// NHM (Nomenclature Harmonisée Marchandises / harmonizirana nomenklatura
// blaga) is the code a rail consignment note carries to say what is in the
// wagon. It follows the WCO Harmonised System, with chapters 98 and 99 added
// for what only railways move: a complete industrial plant, groupage freight,
// removal goods, and wagons and locomotives running as a means of transport
// rather than as cargo — which is what an empty wagon's code says.
//
// The UIC publishes the list free, in every EU language:
//   https://uic.org/IMG/xlsx/nhm2026_multilingual.xlsx
//
// Two things about the source are worth knowing, and both are recorded rather
// than papered over:
//
//   * A name is written the way a tariff schedule writes one — each level only
//     says how it differs from the level above, so "-- drugi" means nothing on
//     its own. Every code therefore keeps its parent, and the full reading is
//     the chain from the chapter down.
//   * 524 of the Slovene cells repeat the Croatian text. Those are marked, so
//     nothing Croatian is presented here as Slovene.
//
// Usage:
//   node scripts/nhm_commodities.mjs <nhm2026_multilingual.xlsx> [out.json]
//
// Needs the xlsx reader, which is not an app dependency — this is a
// build-time script, so install it ad hoc:
//   npm i --no-save xlsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'nhmCommodities.json');
if (!SRC) { console.error('usage: node scripts/nhm_commodities.mjs <nhm2026_multilingual.xlsx> [out.json]'); process.exit(1); }

let XLSX;
try { XLSX = (await import('xlsx')).default ?? await import('xlsx'); }
catch { console.error('xlsx is missing. Run: npm i --no-save xlsx'); process.exit(1); }

const wb = XLSX.readFile(SRC);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
const head = rows[0].map((h) => String(h).trim());
const col = (name) => head.findIndex((h) => h === name);
const COL = {
  key: col('CNKEY'), level: col('LEVEL'), code: col('CN_CODE'),
  en: col('SelfText_EN'), de: col('SelfText_DE'), fr: col('SelfText_FR'),
  sl: col('NAME_SL'), hr: col('NAME_HR'),
  renvoi: col('RENVOI'), renvoiEn: col('RENVOI_TXT_EN'),
  customs: head.findIndex((h) => /custom declaration/i.test(h))
};
for (const [k, v] of Object.entries(COL)) if (v < 0) { console.error(`column for ${k} not found in ${JSON.stringify(head)}`); process.exit(1); }

const text = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
/** A tariff line's own words, without the dashes that only show its depth. */
const bare = (v) => text(v).replace(/^[-–—\s]+/, '').trim();

// Every row is kept, code-bearing or not: about a sixth of the list are
// intermediate headings that carry no code of their own ("- Konji" under
// 0101), and dropping them would make the line below read as a division of
// the chapter rather than of the heading it actually sits under. A row is
// identified by its position, so a parent costs one number.
const codes = [];
/** The open chain of ancestors, one slot per level. */
const openAt = new Map();
let slFromCroatian = 0;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const display = text(r[COL.code]);
  const code = display.replace(/\s+/g, '') || null;
  const sl = bare(r[COL.sl]);
  if (!code && !sl) continue;
  const level = Number(r[COL.level]) || 1;

  // The parent is the nearest row still open at a shallower level.
  let parent = null;
  for (let l = level - 1; l >= 1; l--) {
    if (openAt.has(l)) { parent = openAt.get(l); break; }
  }
  for (const l of [...openAt.keys()]) if (l >= level) openAt.delete(l);
  openAt.set(level, codes.length);

  const isCroatian = !!sl && sl === bare(r[COL.hr]);
  if (isCroatian) slFromCroatian++;

  codes.push({
    code, level, parent, sl,
    ...(code && display !== code ? { display } : {}),
    ...(text(r[COL.en]) ? { en: text(r[COL.en]) } : {}),
    // The section and chapter headings are the only place the other official
    // languages of the consignment note are worth carrying.
    ...(level <= 2 ? { de: text(r[COL.de]), fr: text(r[COL.fr]) } : {}),
    ...(isCroatian ? { slIsCroatian: true } : {}),
    ...(text(r[COL.customs]) ? { consignmentNote: text(r[COL.customs]) } : {}),
    ...(text(r[COL.renvoiEn]) ? { footnote: text(r[COL.renvoiEn]) } : {})
  });
}

// The file nests by indentation, and in one place that disagrees with the
// codes themselves: every 99xx line is filed under the chapter 98 heading,
// there being no chapter 99 heading in the file at all. A code that does not
// continue its parent's code is not below it, so that link is cut rather than
// reproduced — the row keeps its own reading and gains no wrong ancestor.
// (Sections are numbered in Roman, so the test applies only where both sides
// are numeric codes and the parent's is the shorter.)
const numeric = (v) => !!v && /^\d+$/.test(v);
let cutParents = 0;
for (const c of codes) {
  if (c.parent == null || !numeric(c.code)) continue;
  const p = codes[c.parent];
  if (numeric(p.code) && p.code.length <= c.code.length && !c.code.startsWith(p.code)) { c.parent = null; cutParents++; }
}

const chapters = codes.filter((c) => c.code && c.code.length <= 2 && c.level <= 2);
const chapterIndex = Object.fromEntries(chapters.map((c) => [c.code, { sl: c.sl, en: c.en || null, de: c.de || null, fr: c.fr || null }]));
/** Chapters the codes use but the file never names. */
const unnamedChapters = [...new Set(codes.filter((c) => c.code && c.code.length > 2).map((c) => c.code.slice(0, 2)))]
  .filter((ch) => !chapterIndex[ch]).sort();
const out = {
  source: 'UIC – NHM 2026: harmonizirana nomenklatura blaga za železniški prevoz (NHM, večjezična izdaja)',
  url: 'https://uic.org/IMG/xlsx/nhm2026_multilingual.xlsx',
  publisher: 'International Union of Railways (UIC), Pariz',
  effective: '2026-01-01',
  retrieved: new Date().toISOString(),
  sourceFile: path.basename(SRC),
  note: 'Šifra blaga, ki jo nosi tovorni list CIM. Zgrajena je po harmoniziranem sistemu Svetovne carinske organizacije, poglavji 98 in 99 pa sta železniški: celovit industrijski obrat, zbirno blago, selitveno pohištvo ter vagoni in lokomotive, ki vozijo kot prevozno sredstvo in ne kot tovor — tako je šifrirán prazen vagon. Imena so zapisana kot v tarifi: vsaka raven pove le, v čem se razlikuje od nadrejene, zato ima vsaka šifra navedeno nadrejeno in se prebere po celotni verigi. Prepisano iz objave UIC, nič ni dodano.',
  slNote: `V ${slFromCroatian} vrsticah je v slovenskem stolpcu vira dobesedno hrvaško besedilo; te šifre so označene (slIsCroatian) in se ne prikazujejo kot slovenski prevod. Ugotovljene so tam, kjer je slovenska celica enaka hrvaški — v poglavju 99 je hrvaški stolpec prazen, zato tam takega preverjanja ni in je poleg slovenskega vedno naveden angleški zapis.`,
  structureNote: `Datoteka nima naslova za poglavje ${unnamedChapters.join(', ') || '—'}; železniške šifre 99xx so v njej uvrščene pod naslov poglavja 98. Šifra, ki ne nadaljuje šifre nadrejene vrstice, zato nima navedene nadrejene (${cutParents} takih vrstic) — namesto napačnega prednika nima nobenega.`,
  chapterIndex,
  counts: {
    rows: codes.length,
    unnamedChapters,
    cutParents,
    withCode: codes.filter((c) => c.code).length,
    chapters: chapters.length,
    nhmLevel: codes.filter((c) => c.code && c.code.length === 6).length,
    cnSubdivisions: codes.filter((c) => c.code && c.code.length === 8).length,
    railChapters: codes.filter((c) => c.code && /^(98|99)/.test(c.code)).length,
    withConsignmentNote: codes.filter((c) => c.consignmentNote).length,
    slFromCroatian
  },
  codes
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, JSON.stringify(out.counts), 'bytes', fs.statSync(OUT).size);

const byCode = new Map();
for (const c of codes) if (c.code && !byCode.has(c.code)) byCode.set(c.code, c);
const chain = (c) => { const p = []; let n = c; while (n) { p.unshift(n); n = n.parent != null ? codes[n.parent] : null; } return p; };
/** A consignment note carries six digits; the list also holds CN's eight. */
const lookup = (q) => byCode.get(q) || codes.find((c) => c.code && c.code.startsWith(q)) || null;
for (const probe of ['010129', '27011210', '992110', '990200', '992200']) {
  const c = lookup(probe);
  if (!c) { console.log(probe, '— not in the list'); continue; }
  console.log(`${probe} (${c.code}): ${chain(c).map((x) => x.sl).join(' › ')}`);
  if (c.en) console.log(`${' '.repeat(probe.length)}  EN: ${c.en}`);
  if (c.consignmentNote) console.log(`${' '.repeat(probe.length)}  CIM: ${c.consignmentNote}`);
  if (c.slIsCroatian) console.log(`${' '.repeat(probe.length)}  (vir ima v slovenskem stolpcu hrvaško besedilo)`);
}
