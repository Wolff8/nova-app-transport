// Pulls the list of vehicle types authorised for Slovenia out of ERA's
// public ERATV register into src/data/eratvSlovenia.json.
//
// ERATV has no API. Its public search page exports the result list as XML
// (POST /Eratv/Home/Export?exportTo=2), which is one request and reliable.
// A single type's full record is a second export keyed to a session that has
// just viewed that type, and the register serves those only occasionally, so
// they are fetched on demand by the server rather than crawled here.
//
// No account is used: these are the register's public pages. Every value is
// an attribute of the register's own export; nothing is derived or filled in.
//
// Run: NODE_USE_ENV_PROXY=1 node scripts/eratv_extract_slovenia.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const BASE = 'https://eratv.era.europa.eu/Eratv';
const MEMBER_STATE = { id: '25', name: 'Slovenia' };
const OUT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'eratvSlovenia.json');
// The register's localisation code throws a 500 on a request with no
// Accept-Language, so every request carries one.
const HEADERS = {
  'User-Agent': 'nova-app-transport (+https://nova-app-transport.onrender.com)',
  'Accept-Language': 'en-US,en;q=0.9'
};

/** One cookie jar for the whole run; the export depends on the session. */
const jar = new Map();
function storeCookies(res) {
  for (const raw of (res.headers.getSetCookie?.() ?? [])) {
    const [pair] = raw.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
/** An empty Cookie header makes the register answer 500, so it is omitted. */
const withCookies = extra => {
  const c = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  return { ...HEADERS, ...extra, ...(c ? { Cookie: c } : {}) };
};

async function get(url) {
  const r = await fetch(url, { headers: withCookies(), signal: AbortSignal.timeout(90000) });
  storeCookies(r);
  if (!r.ok) throw new Error(`GET ${url} -> HTTP ${r.status}`);
  return r.text();
}
async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: withCookies({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body, signal: AbortSignal.timeout(120000)
  });
  storeCookies(r);
  if (!r.ok) throw new Error(`POST ${url} -> HTTP ${r.status}`);
  return r.text();
}

/**
 * Runs the member-state search in the current session and returns the page.
 * A type's own page and its XML are served only to a session that has just
 * searched for it, so this runs again for every type.
 */
async function search(action) {
  const listPage = await get(`${BASE}/Home/List`);
  const token = cheerio.load(listPage)('input[name="__RequestVerificationToken"]').first().attr('value');
  if (!token) throw new Error('no __RequestVerificationToken on the list page');
  const body = new URLSearchParams();
  body.set('__RequestVerificationToken', token);
  body.set('returnUrl', '/Eratv/Home/List');
  body.append('SelectedMemberStates', MEMBER_STATE.id);
  body.append('RegistrationRegimeModeViewModel.Is2016Directive', 'true');
  body.append('RegistrationRegimeModeViewModel.Is2016Directive', 'false');
  body.set('GetDeactivatedVehicleTypes', 'false');
  body.set('PagedGrid.PageIndex', '1');
  body.set('PagedGrid.PageSize', '100');
  return post(`${BASE}${action}`, body.toString());
}

// ---- 1. the result list for Slovenia ------------------------------------
const listXml = await search('/Home/Export?exportTo=2');
const $list = cheerio.load(listXml, { xmlMode: true });
const results = $list('Result').map((_, el) => {
  const a = $list(el).attr();
  return {
    id: a.Type_ID,
    name: a.Type_Name || null,
    status: a.Authorisation_Status || null,
    // The attribute name is XML-escaped in the export: "…__x0028_EIN_x0029_".
    authDocRef: a[Object.keys(a).find(k => k.startsWith('Authorisation_document_reference'))] || null,
    lastUpdate: a.Last_Update || null
  };
}).get().filter(r => r.id);
console.log('types authorised for', MEMBER_STATE.name + ':', results.length);

// ---- 2. write the list --------------------------------------------------
const out = {
  source: 'ERA ERATV – Evropski register dovoljenih tipov vozil, javno iskanje (tipi z dovoljenjem za Slovenijo)',
  sourceUrl: `${BASE}/Home/List`,
  legalBasis: 'Izvedbeni sklep Komisije (EU) 2018/1614; parametri so oštevilčeni po Prilogi II',
  note: 'Seznam je izvoz iskanja po državi članici iz registra ERATV. Tip vozila ni posamezno vozilo: register opisuje odobren tip, ne konkretne lokomotive. Podroben zapis tipa se prebere iz registra na zahtevo.',
  memberState: MEMBER_STATE.name,
  retrieved: new Date().toISOString(),
  counts: { types: results.length },
  types: results.sort((a, b) => String(a.name).localeCompare(String(b.name), 'sl'))
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, out.counts.types, 'types, bytes', fs.statSync(OUT).size);
