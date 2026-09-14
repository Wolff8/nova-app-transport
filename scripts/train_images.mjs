// Photographs of vehicle classes, from Wikimedia Commons with author and
// licence, via the public MediaWiki API. Every class listed has a reason to
// be here that a source gives: a type authorised for Slovenia in ERATV, a
// catalogue's reference locomotive, or the app's locomotive register. Each
// entry records that basis. A photo shows the class, never a train in the app.
// Run: NODE_USE_ENV_PROXY=1 node scripts/train_images.mjs
import fs from 'node:fs';
import path from 'node:path';

const UA = 'nova-app-transport/1.0 (open-data transport map; contact via repository)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// file: a hand-picked Commons title; or query + tokens: a search whose first
// JPEG result naming one of the tokens in its title is taken.
const WANTED = [
  // — locomotives —
  { key: 'SZ-363', group: 'lokomotiva', label: 'SŽ 363 (Alsthom, 3 kV DC)', file: 'File:SZ 363-009 at Ljubljana train station.jpg', basis: 'Referenčna lokomotiva v katalogu RFC11 (LOCO13 = 79-363); vozni park SŽ.' },
  { key: 'SZ-541', group: 'lokomotiva', label: 'SŽ 541 (Siemens ES64U4 »Taurus«)', file: 'File:SŽ 541-014.jpg', basis: 'Referenčna lokomotiva v katalogu RFC11 (LOCO12 = 79-541); ERATV SI: ES64U4.' },
  { key: 'SZ-664', group: 'lokomotiva', label: 'SŽ 664 (EMD GT26CW-2, dizelska)', query: 'SŽ 664 locomotive Slovenia', tokens: ['664'], basis: 'Register lokomotiv v aplikaciji (SŽ serija 664).' },
  { key: 'SZ-644', group: 'lokomotiva', label: 'SŽ 644 (dizelska)', query: 'SŽ 644 diesel locomotive', tokens: ['644'], basis: 'Vozni park SŽ (dizelske lokomotive).' },
  { key: 'SZ-643', group: 'lokomotiva', label: 'SŽ 643 (dizelska, premik)', query: 'SŽ 643 diesel locomotive', tokens: ['643'], basis: 'Vozni park SŽ (premikalne dizelske lokomotive).' },
  { key: 'SZ-342', group: 'lokomotiva', label: 'SŽ 342 (Ansaldo, 3 kV DC)', file: 'File:SZ 342 at Dobova train station.jpg', basis: 'Vozni park SŽ (električne lokomotive).' },
  { key: 'OBB-1216', group: 'lokomotiva', label: 'ÖBB 1216 »Taurus« (Siemens ES64U4)', query: 'ÖBB 1216 Taurus', tokens: ['1216'], basis: 'ERATV SI: ES64U4 Var. B; register lokomotiv (ÖBB 1216, RCG).' },
  { key: 'ADRIA-1216', group: 'lokomotiva', label: 'Adria Transport 1216 »Taurus«', file: 'File:Adria Transport 1216 922 20080801.JPG', basis: 'Register lokomotiv (Adria Transport 1216-920); ERATV SI: ES64U4.' },
  { key: 'OBB-1293', group: 'lokomotiva', label: 'ÖBB 1293 »Vectron MS«', file: 'File:ÖBB Vectron 1293-001 Knittelfeld 2 2018-10-20.jpg', basis: 'ERATV SI: Siemens X4-E-Loco-AB (Vectron MS) s SI v koridorju; register lokomotiv.' },
  { key: 'CDC-383', group: 'lokomotiva', label: 'ČD Cargo 383 »Vectron MS«', file: 'File:Vectron ČD Cargo.jpg', basis: 'ERATV SI: Siemens X4-E-Loco-AB; register lokomotiv (ČD Cargo 383).' },
  { key: 'GYSEV-471', group: 'lokomotiva', label: 'GySEV 471 »Vectron«', file: 'File:GySEV 471 004 Vectron Lővér IC Sopron 2019.jpg', basis: 'Register lokomotiv (GySEV 471); ERATV SI: Siemens X4 (Vectron).' },
  { key: 'MAV-480', group: 'lokomotiva', label: 'MÁV 480 »TRAXX AC2«', query: 'MÁV 480 TRAXX locomotive', tokens: ['480'], basis: 'Register lokomotiv (MÁV 480).' },
  { key: 'ES64F4', group: 'lokomotiva', label: 'Siemens ES64F4 (razred 189 / 1216 ES64F4)', query: 'Siemens ES64F4 189 locomotive', tokens: ['189', 'ES64F4', 'ES 64 F4'], basis: 'ERATV SI: ES64F4 Variant D/E/L/M.' },
  { key: 'EURODUAL', group: 'lokomotiva', label: 'Stadler EURODUAL (dvonačinska)', query: 'Stadler Eurodual locomotive', tokens: ['Eurodual', 'EuroDual', 'EURODUAL', '159'], basis: 'ERATV SI: EURODUAL E25/15 D28 D-A-SI-HR-RS.' },
  // — multiple units —
  { key: 'SZ-310', group: 'garnitura', label: 'SŽ 310 (Pendolino ETR 310, ICS)', file: 'File:Slovenian Pendolino at Zidani Most.jpg', basis: 'Garnitura vlakov ICS.' },
  { key: 'SZ-312', group: 'garnitura', label: 'SŽ 312 (Siemens Desiro)', file: 'File:SŽ 312 317.jpg', basis: 'Vozni park SŽ-PP (elektromotorne garniture).' },
  { key: 'SZ-510', group: 'garnitura', label: 'SŽ 510 / 515 (Stadler FLIRT 3, električna)', file: 'File:20240504 Slowenien Stadler FLIRT 200 510-037 Front Maribor.jpg', basis: 'ERATV SI: FLIRT3 EMU SLO (L-4431).' },
  { key: 'SZ-610', group: 'garnitura', label: 'SŽ 610 / 615 (Stadler FLIRT 3, dizelska)', query: 'SŽ 610 FLIRT diesel Slovenia', tokens: ['610', '615'], basis: 'ERATV SI: FLIRT3 DMU SLO (L-4433, L-4587).' },
  { key: 'SZ-313', group: 'garnitura', label: 'SŽ 313 (Stadler KISS, dvonadstropna)', file: 'File:Stadler KISS Slovenske železnice Slovenian railways.jpg', basis: 'ERATV SI: KISS EMU SLO (L-4432).' },
  { key: 'SZ-713', group: 'garnitura', label: 'SŽ 713 / 715 (dizelska garnitura)', file: 'File:SŽ 713 715.jpg', basis: 'Vozni park SŽ-PP (dizelske garniture).' },
  { key: 'SZ-813', group: 'garnitura', label: 'SŽ 813 / 814 (dizelska garnitura)', file: 'File:SŽ 813 814.jpg', basis: 'Vozni park SŽ-PP (dizelske garniture).' },
  // — freight wagons (ERATV types authorised for Slovenia) —
  { key: 'W-SGGRSS', group: 'tovorni vagon', label: 'Sggrss 80′ (členkasti kontejnerski vagon)', file: 'File:Sggrss kloub.JPG', basis: "ERATV SI: Sggrss 80', Sggrs 80'." },
  { key: 'W-SGGMRSS', group: 'tovorni vagon', label: 'Sggmrss 90′ / 92′ (členkasti kontejnerski vagon)', query: 'Sggmrss container wagon', tokens: ['Sggmrss', 'Sggmrs'], basis: 'ERATV SI: Sggmrss 92´.' },
  { key: 'W-SGNSS', group: 'tovorni vagon', label: 'Sgnss 60′ (kontejnerski vagon)', query: 'Sgnss container wagon', tokens: ['Sgnss'], basis: 'ERATV SI: Sgnss 60´.' },
  { key: 'W-ZACNS', group: 'tovorni vagon', label: 'Zacns (cisterna za naftne derivate)', file: 'File:Wasco Class Zacns tank wagon at Oldenburg.jpg', basis: 'ERATV SI: Zacns 88/91/93/98 m³, Zacens, Zagns.' },
  { key: 'W-FALNS', group: 'tovorni vagon', label: 'Falns / Talns (samorazkladalni za razsuti tovor)', query: 'Falns wagon', tokens: ['Falns', 'Talns'], basis: 'ERATV SI: Falns BA 271B, Talns BA 170.' },
  { key: 'W-LAAERS', group: 'tovorni vagon', label: 'Laaers (vagon za prevoz avtomobilov)', file: 'File:L04 920 Innotrans 2024, Autotransportwagen Laaers.jpg', basis: 'ERATV SI: Laaers 560.3, L07A Laaers.' },
  { key: 'W-SHIMMNS', group: 'tovorni vagon', label: 'Shimmns (vagon za kolobarje pločevine)', query: 'Shimmns wagon', tokens: ['Shimmns', 'Shimms'], basis: 'ERATV SI: Shimmns.' },
];
// Not in the gallery for want of a usable Commons photo: TRAXX 3 MS (ERATV
// SI), Smmnps slab wagons (ERATV SI), Tagnpps (only a bogie detail),
// ÖBB Railjet Viaggio coaches (ERATV SI).

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
async function apiJson(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const t = await r.text();
    try { return JSON.parse(t); } catch { console.warn('[img] non-JSON answer', r.status, '— retrying'); await sleep(3000 * (i + 1)); }
  }
  return null;
}
const infoUrl = (titles) => `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=800&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|ImageDescription|DateTimeOriginal`;
const searchUrl = (q) => `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=800&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|ImageDescription|DateTimeOriginal`;

function entryFrom(w, page) {
  const ii = page.imageinfo?.[0]; if (!ii) return null;
  const em = ii.extmetadata || {};
  return {
    key: w.key, group: w.group, label: w.label, basis: w.basis, fileTitle: page.title,
    thumbUrl: ii.thumburl, fullUrl: ii.url, pageUrl: ii.descriptionurl, width: ii.thumbwidth, height: ii.thumbheight,
    author: strip(em.Artist?.value), license: em.LicenseShortName?.value || null, licenseUrl: em.LicenseUrl?.value || null,
    description: strip(em.ImageDescription?.value).slice(0, 200), taken: em.DateTimeOriginal?.value || null
  };
}

const outPath = path.join(process.cwd(), 'src', 'data', 'trainImages.json');
let previous = {};
try { previous = JSON.parse(fs.readFileSync(outPath, 'utf-8')).images || {}; } catch {}
const out = { source: 'Wikimedia Commons (MediaWiki API)', licenceNote: 'Vsaka fotografija ima navedenega avtorja in licenco; prikazana je kot fotografija vozila te serije oziroma tipa, ne katerega koli vlaka v aplikaciji.', basisNote: 'Vsak tip je v galeriji, ker ga imenuje vir: ERATV (tipi z dovoljenjem za Slovenijo), katalog vnaprej pripravljenih poti ali register lokomotiv v aplikaciji.', retrieved: new Date().toISOString(), images: {}, missing: [] };
for (const w of WANTED) {
  await sleep(3000);
  let page = null;
  if (w.file) {
    const j = await apiJson(infoUrl(w.file));
    page = j ? Object.values(j.query.pages)[0] : null;
    if (page && page.missing !== undefined) page = null;
  } else {
    const j = await apiJson(searchUrl(w.query));
    const pages = j ? Object.values(j.query?.pages || {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99)) : [];
    page = pages.find(p => (p.imageinfo?.[0]?.mime || '').startsWith('image/jpeg') && w.tokens.some(t => p.title.includes(t))) || null;
  }
  if (!page) {
    // Commons rate-limits bursts (429); keep what an earlier run found.
    if (previous[w.key]) { out.images[w.key] = previous[w.key]; console.log('[img]', w.key.padEnd(12), '← kept from previous run'); continue; }
    console.warn('[img] no photo for', w.key); out.missing.push(w.key); continue;
  }
  const e = entryFrom(w, page);
  if (!e) { out.missing.push(w.key); continue; }
  out.images[w.key] = e;
  console.log('[img]', w.key.padEnd(12), '→', page.title.slice(0, 70), '|', e.license, '|', e.author.slice(0, 25));
}
const p = path.join(process.cwd(), 'src', 'data', 'trainImages.json');
fs.writeFileSync(p, JSON.stringify(out, null, 1));
console.log('[img] wrote', p, Object.keys(out.images).length, 'images, missing:', out.missing.join(', ') || 'none');
