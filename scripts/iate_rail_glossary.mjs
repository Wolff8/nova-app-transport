// Builds src/data/iateRailGlossary.json: the EU's own Slovene terms for the
// railway concepts this app puts on screen.
//
// The labels beside the register data were translated by hand. IATE, the EU's
// terminology database, publishes the agreed Slovene term for each of these
// concepts together with the act it comes from, so the app can show the
// official term and cite it instead of relying on a translation of its own.
//
// Source: IATE public API, https://iate.europa.eu/em-api/entries/_search.
// Nothing is invented: a concept with no Slovene term in IATE is written out
// with the term missing and says so.
//
// Run: NODE_USE_ENV_PROXY=1 node scripts/iate_rail_glossary.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://iate.europa.eu/em-api';
const OUT = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'iateRailGlossary.json');
const HEADERS = {
  'User-Agent': 'nova-app-transport (+https://nova-app-transport.onrender.com)',
  'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-Language': 'en-US,en;q=0.9'
};

/**
 * The concepts the app shows, each with the English term to look up and where
 * it appears. `hint` narrows the pick when IATE has several senses.
 */
const TERMS = [
  { q: 'locomotive', where: 'register vozil' },
  { q: 'railway station', where: 'operativne točke RINF' },
  { q: 'section of line', alt: ['line section', 'railway line'], where: 'odsek proge RINF', hint: /odsek|proga/i },
  { q: 'operational point', alt: ['operating point'], where: 'operativne točke RINF', hint: /^(operativna|obratovalna) točka|službeno mesto/i },
  { q: 'infrastructure manager', where: 'upravljavec proge' },
  { q: 'railway undertaking', where: 'prevoznik' },
  { q: 'keeper', where: 'register VKM', hint: /imetnik/i },
  { q: 'track gauge', where: 'parametri tira' },
  { q: 'loading gauge', where: 'nakladalni profil' },
  { q: 'axle load', where: 'osna obremenitev' },
  { q: 'line category', where: 'kategorija proge' },
  { q: 'maximum permitted speed', alt: ['line speed', 'maximum speed'], where: 'progovna hitrost', hint: /hitrost/i },
  { q: 'overhead contact line', where: 'elektrifikacija' },
  { q: 'pantograph', where: 'elektrifikacija' },
  { q: 'European Train Control System', where: 'ETCS' },
  { q: 'train protection system', alt: ['automatic train protection', 'train protection'], where: 'zaščita vlaka', hint: /zaščit|varov/i },
  { q: 'train detection system', where: 'zaznavanje vlaka' },
  { q: 'level crossing', where: 'parametri odseka' },
  { q: 'hot axle box detector', where: 'parametri odseka' },
  { q: 'freight train', alt: ['goods train'], where: 'tovorni promet', hint: /vlak/i },
  { q: 'rail freight corridor', where: 'koridorji RFC' },
  { q: 'train path', where: 'trase' },
  { q: 'marshalling yard', alt: ['shunting yard', 'shunting'], where: 'ranžirna postaja', hint: /ranžirn|postaja|kolodvor/i },
  { q: 'siding', where: 'stranski tir' },
  { q: 'tunnel', where: 'predori', hint: /^predor$|železnišk\w* predor/i },
  { q: 'combined transport', where: 'intermodalni promet', hint: /^kombinirani (prevoz|promet)$/i },
  { q: 'wagon', where: 'sestava vlaka' },
  { q: 'multiple unit', where: 'garniture' },
  { q: 'rolling stock', where: 'vozni park', hint: /^(tirna vozila|vozna sredstva|železniška vozna sredstva)$/i },
  { q: 'wheelset', where: 'parametri vozila' },
  { q: 'cant deficiency', where: 'parametri tira' },
  { q: 'interoperability', where: 'TSI' },
  { q: 'technical specification for interoperability', where: 'TSI' },
  { q: 'authorisation for placing on the market', alt: ['vehicle authorisation', 'placing on the market'], where: 'ERATV', hint: /dovoljenj/i },
  { q: 'vehicle type', where: 'ERATV', hint: /^tip vozila$/i },
  { q: 'braking distance', alt: ['stopping distance'], where: 'parametri vozila', hint: /zavor|ustav/i },
  { q: 'timetable', where: 'vozni red', hint: /^vozni red$|^operativni vozni red$/i },
  { q: 'train delay', alt: ['delay'], where: 'zamude', hint: /^zamuda\b/i },
  { q: 'border crossing point', alt: ['border point'], where: 'mejne točke', hint: /^mejn/i },
  { q: 'gradient', alt: ['slope'], where: 'parametri proge', hint: /^(nagib|naklon|vzpon)\b/i }
];

const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * IATE keeps several senses of the same word apart by domain, so "delay"
 * without one returns an aviation term. This maps a domain code to its path
 * in the domain tree, and an entry is preferred when that path is transport.
 */
const domainName = new Map();
const domainPath = new Map();
{
  const r = await fetch(`${API}/domains/_tree?limit=100`, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  const tree = await r.json();
  const walk = (nodes, trail) => {
    for (const n of nodes || []) {
      const path = [...trail, n.name];
      domainName.set(n.code, n.name);
      domainPath.set(n.code, path.join(' > '));
      walk(n.subdomains, path);
    }
  };
  walk(tree.items, []);
  console.log('domain tree:', domainName.size, 'domains');
}
const domainsOf = (e) => (e.domains || []).map(d => domainPath.get(d.code)).filter(Boolean);
/**
 * How well an entry's domains fit a railway glossary: 2 for a rail domain,
 * 1 for land transport, 0 for anything else. Scoring beats a yes/no test
 * because IATE's air and maritime senses also sit under TRANSPORT — that is
 * how "delay" arrived as an aircraft's taxi-out delay.
 */
function railScore(e) {
  const paths = domainsOf(e);
  if (paths.some(p => /rail/i.test(p))) return 2;
  if (paths.some(p => /land transport/i.test(p))) return 1;
  return 0;
}
const linkOf = (html) => (String(html || '').match(/href="([^"]+)"/) || [])[1] || null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(query) {
  const r = await fetch(`${API}/entries/_search?offset=0&limit=8&expand=true`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ query, source: 'en', targets: ['sl'] }),
    signal: AbortSignal.timeout(45000)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/**
 * IATE holds many senses of the same word, and a loose pick produced nonsense:
 * "delay" came back as an aircraft's taxi-out delay and "operational point" as
 * an air-conditioning coefficient. An entry is therefore accepted only when
 * its English side carries the phrase that was searched for AND the entry sits
 * in a transport domain. Anything else is reported as not found rather than
 * published under a railway label.
 */
const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
function pick(items, q, hint) {
  const wanted = norm(q);
  const matching = (items || []).filter(e => {
    if (!(e.language?.sl?.term_entries || []).length) return false;
    const en = (e.language?.en?.term_entries || []).map(t => norm(t.term_value));
    return en.some(t => t === wanted || t.includes(wanted) || wanted.includes(t));
  });
  const best = Math.max(0, ...matching.map(railScore));
  if (best === 0) return null;
  const candidates = matching.filter(e => railScore(e) === best);
  const hinted = hint ? candidates.find(e => (e.language.sl.term_entries || []).some(t => hint.test(t.term_value))) : null;
  if (hint && !hinted) return null;
  const exact = candidates.find(e => (e.language.en.term_entries || []).some(t => norm(t.term_value) === wanted));
  return hinted ?? exact ?? candidates[0];
}

const entries = [];
for (const t of TERMS) {
  try {
    let e = null, used = null;
    for (const q of [t.q, ...(t.alt || [])]) {
      const res = await search(q);
      e = pick(res.items, q, t.hint);
      used = q;
      if (e) break;
      await sleep(300);
    }
    if (!e) {
      entries.push({ query: t.q, where: t.where, slTerms: [], note: 'V IATE ni zadetka s tem angleškim izrazom na prometnem področju.' });
      console.log('  no SL term:', t.q);
      await sleep(300);
      continue;
    }
    const en = e.language.en || {}, sl = e.language.sl || {};
    const terms = (x) => (x.term_entries || []).map(te => ({
      term: te.term_value,
      references: (te.term_references || []).map(r => ({ text: strip(r.text), url: linkOf(r.text) })).filter(r => r.text)
    }));
    entries.push({
      query: t.q, searched: used, where: t.where,
      domains: domainsOf(e), domainFit: railScore(e) === 2 ? 'železniško področje' : 'kopenski promet',
      id: e.id, iateUrl: `https://iate.europa.eu/entry/result/${e.id}/sl-en`,
      enTerms: terms(en).map(x => x.term),
      slTerms: terms(sl),
      definition: strip(en.definition) || null,
      definitionReferences: (en.definition_references || []).map(r => ({ text: strip(r.text), url: linkOf(r.text) })).filter(r => r.text)
    });
    console.log('  ', t.q.padEnd(42), '->', terms(sl).map(x => x.term).join(', ').slice(0, 60), railScore(e) === 2 ? '' : '[kopenski promet]');
    await sleep(300);
  } catch (err) {
    console.warn('  failed', t.q, err?.message || err);
    entries.push({ query: t.q, where: t.where, slTerms: [], note: `Poizvedba ni uspela: ${err?.message || err}` });
  }
}

const out = {
  source: 'IATE – terminološka zbirka Evropske unije (javni API)',
  sourceUrl: 'https://iate.europa.eu',
  note: 'Slovenski izraz in njegov vir sta iz zbirke IATE. Definicija je angleška, kot jo objavlja IATE, z navedbo akta, iz katerega izhaja. Pojmi brez slovenskega izraza so označeni.',
  retrieved: new Date().toISOString(),
  counts: { concepts: entries.length, withSlovene: entries.filter(e => e.slTerms.length).length },
  entries: entries.sort((a, b) => a.query.localeCompare(b.query))
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, JSON.stringify(out.counts), 'bytes', fs.statSync(OUT).size);
