// Photographs of the vehicle classes the app can name from a source (the
// catalogues' reference locomotives, SŽ's ICS Pendolino), taken from Wikimedia
// Commons with author and licence, via the public MediaWiki API.
// Run: NODE_USE_ENV_PROXY=1 node scripts/train_images.mjs
import fs from 'node:fs';
import path from 'node:path';

// Chosen by hand from Commons search results; each is a photo of the class,
// never of a particular train in the app.
const WANTED = [
  { key: 'SZ-363', label: 'SŽ 363 (Alsthom)', file: 'File:SZ 363-009 at Ljubljana train station.jpg', role: 'električna lokomotiva SŽ-Tovorni promet / SŽ-PP' },
  { key: 'SZ-541', label: 'SŽ 541 (Siemens ES64U4 »Taurus«)', file: 'File:SŽ 541-014.jpg', role: 'električna lokomotiva SŽ' },
  { key: 'SZ-310', label: 'SŽ 310 (Pendolino ETR 310)', file: 'File:Slovenian Pendolino at Zidani Most.jpg', role: 'elektromotorna garnitura vlakov ICS' },
  { key: 'SZ-312', label: 'SŽ 312 (Siemens Desiro)', file: 'File:SŽ 312 317.jpg', role: 'elektromotorna garnitura regionalnih vlakov' },
  { key: 'SZ-510', label: 'SŽ 510 (Stadler FLIRT)', file: 'File:20240504 Slowenien Stadler FLIRT 200 510-037 Front Maribor.jpg', role: 'elektromotorna garnitura regionalnih vlakov' }
];
const UA = 'nova-app-transport/1.0 (open-data transport map; contact via repository)';
const api = (titles) => `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=800&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|ImageDescription|Credit|DateTimeOriginal`;
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const out = { source: 'Wikimedia Commons (MediaWiki API)', licenceNote: 'Vsaka fotografija ima navedenega avtorja in licenco; prikazana je kot fotografija vozila te serije, ne tega vlaka.', retrieved: new Date().toISOString(), images: {} };
for (const w of WANTED) {
  const r = await fetch(api(w.file), { headers: { 'User-Agent': UA } });
  const j = await r.json();
  const page = Object.values(j.query.pages)[0];
  const ii = page.imageinfo?.[0];
  if (!ii) { console.warn('[img] missing', w.file); continue; }
  const em = ii.extmetadata || {};
  out.images[w.key] = {
    key: w.key, label: w.label, role: w.role, fileTitle: page.title,
    thumbUrl: ii.thumburl, fullUrl: ii.url, pageUrl: ii.descriptionurl, width: ii.thumbwidth, height: ii.thumbheight,
    author: strip(em.Artist?.value), license: em.LicenseShortName?.value || null, licenseUrl: em.LicenseUrl?.value || null,
    description: strip(em.ImageDescription?.value).slice(0, 200), taken: em.DateTimeOriginal?.value || null
  };
  console.log('[img]', w.key, '→', page.title, '|', out.images[w.key].license, '|', out.images[w.key].author);
}
const p = path.join(process.cwd(), 'src', 'data', 'trainImages.json');
fs.writeFileSync(p, JSON.stringify(out, null, 1));
console.log('[img] wrote', p, Object.keys(out.images).length, 'images');
