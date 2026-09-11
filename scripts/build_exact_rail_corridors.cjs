// Script to extract all exact station-to-station polylines from the official SŽ/MOTIS rail feed
// and assemble complete, unbroken high-density rail corridors for freight & passenger trains.

const fs = require('fs');
const path = require('path');

function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [];
  let factor = Math.pow(10, precision);
  while (index < str.length) {
    let byte, shift = 0, result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat;
    shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng;
    coordinates.push([Number((lng / factor).toFixed(5)), Number((lat / factor).toFixed(5))]);
  }
  return coordinates;
}

function dist(p1, p2) {
  const dx = (p1[0] - p2[0]) * Math.cos((p1[1] + p2[1]) * 0.5 * Math.PI / 180) * 111.32;
  const dy = (p1[1] - p2[1]) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

async function main() {
  console.log('Fetching MOTIS rail network trips...');
  const url = "https://mapper-motis.ojpp-gateway.derp.si/api/v1/map/trips?min=45.2,13.2&max=47.1,16.8&startTime=2026-09-06T05:00:00Z&endTime=2026-09-06T20:00:00Z&zoom=12";
  const res = await fetch(url).then(r => r.json()).catch(err => {
    console.error('Fetch error:', err);
    return [];
  });

  const rail = res.filter(t => t.mode && t.mode.includes("RAIL") && t.polyline);
  console.log('Retrieved rail segments:', rail.length);

  // Index segments by normalized station pair
  const segments = new Map();

  function norm(name) {
    return (name || '').toLowerCase()
      .replace(/\s*(železniška postaja|postaja|žp|kolodvor)\s*/gi, '')
      .replace(/č/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z')
      .trim();
  }

  for (const r of rail) {
    const fn = norm(r.from.name);
    const tn = norm(r.to.name);
    const key = `${fn}|${tn}`;
    const rkey = `${tn}|${fn}`;

    const decoded = decodePolyline(r.polyline);
    if (decoded.length < 2) continue;

    if (!segments.has(key)) segments.set(key, decoded);
    if (!segments.has(rkey)) segments.set(rkey, decoded.slice().reverse());
  }

  console.log('Indexed bidirectional segments:', segments.size);

  function getTrackBetween(stA, stB) {
    const na = norm(stA);
    const nb = norm(stB);
    const key = `${na}|${nb}`;
    if (segments.has(key)) return segments.get(key);

    // Partial search
    for (const [k, coords] of segments.entries()) {
      const [fromPart, toPart] = k.split('|');
      if (fromPart.includes(na) && toPart.includes(nb)) return coords;
      if (fromPart.includes(nb) && toPart.includes(na)) return coords.slice().reverse();
    }
    return null;
  }

  function assembleRoute(stations, routeName) {
    let fullLine = [];
    console.log(`\nAssembling route: ${routeName} (${stations.length} stations)`);

    for (let i = 0; i < stations.length - 1; i++) {
      const st1 = stations[i];
      const st2 = stations[i + 1];
      const seg = getTrackBetween(st1, st2);

      if (seg && seg.length > 0) {
        if (fullLine.length === 0) {
          fullLine = fullLine.concat(seg);
        } else {
          // Check orientation
          const lastPoint = fullLine[fullLine.length - 1];
          const dStart = dist(lastPoint, seg[0]);
          const dEnd = dist(lastPoint, seg[seg.length - 1]);

          const oriented = (dEnd < dStart) ? seg.slice().reverse() : seg;
          // Avoid duplicate connecting point
          fullLine = fullLine.concat(oriented.slice(1));
        }
      } else {
        console.warn(`  [MISSING SEGMENT] Could not find rail track between "${st1}" and "${st2}"`);
      }
    }

    console.log(`  => Total points in ${routeName}: ${fullLine.length}`);
    return fullLine;
  }

  // Define corridor station sequences matching exact MOTIS segments
  const CORRIDORS = {
    // 1. Koper to Divača (Proga 60)
    KOPER_DIVACA: ['Koper', 'Hrpelje-Kozina', 'Divača'],

    // 2. Divača to Ljubljana Zalog (Proga 50)
    DIVACA_ZALOG: [
      'Divača', 'Gornje Ležeče', 'Pivka', 'Prestranek', 'Postojna',
      'Rakek', 'Logatec', 'Borovnica', 'Preserje', 'Notranje Gorice',
      'Brezovica', 'Ljubljana', 'Ljubljana Polje', 'Ljubljana Zalog'
    ],

    // 3. Ljubljana Zalog to Pragersko (Proga 10 / 30) - through Zbelovo, Mlače, Loče, Dolga Gora, Ostrožno!
    ZALOG_PRAGERSKO: [
      'Ljubljana Zalog', 'Laze', 'Jevnica', 'Kresnice', 'Litija',
      'Sava', 'Zagorje', 'Trbovlje', 'Hrastnik', 'Zidani Most',
      'Rimske Toplice', 'Laško', 'Celje', 'Štore', 'Šentjur',
      'Grobelno', 'Ponikva', 'Ostrožno', 'Dolga Gora', 'Poljčane', 'Slovenska Bistrica', 'Pragersko'
    ],

    // 4. Pragersko to Maribor
    PRAGERSKO_MARIBOR: ['Pragersko', 'Rače', 'Hoče', 'Maribor Tezno', 'Maribor'],

    // 5. Maribor to Šentilj (ÖBB Austrian border)
    MARIBOR_SPILJE: ['Maribor', 'Pesnica', 'Cirknica', 'Šentilj'],

    // 6. Zidani Most to Dobova (HŽ Croatian border)
    ZIDANI_MOST_DOBOVA: [
      'Zidani Most', 'Radeče', 'Loka', 'Breg', 'Sevnica',
      'Blanca', 'Brestanica', 'Krško', 'Libna', 'Brežice', 'Dobova'
    ],

    // 7. Ljubljana Zalog to Jesenice (ÖBB Austrian border)
    ZALOG_JESENICE: [
      'Ljubljana Zalog', 'Ljubljana', 'Medno', 'Medvode', 'Reteče',
      'Škofja Loka', 'Kranj', 'Podnart', 'Otoče', 'Globoko',
      'Radovljica', 'Lesce-Bled', 'Žirovnica', 'Slovenski Javornik', 'Jesenice'
    ],

    // 8. Pragersko to Ormož
    PRAGERSKO_ORMOZ: ['Pragersko', 'Kidričevo', 'Ptuj', 'Moškanjci', 'Ormož'],

    // 9. Divača to Sežana / Villa Opicina
    DIVACA_SEZANA: ['Divača', 'Povir', 'Sežana']
  };

  const compiled = {};
  for (const [cName, stList] of Object.entries(CORRIDORS)) {
    compiled[cName] = assembleRoute(stList, cName);
  }

  // Load PROGA41_EXACT for Ormož - Murska Sobota - Hodoš
  const proga41Path = path.join(__dirname, '../src/data/proga41_coords.json');
  if (fs.existsSync(proga41Path)) {
    compiled['ORMOZ_HODOS'] = JSON.parse(fs.readFileSync(proga41Path, 'utf-8'));
    console.log(`Loaded ORMOZ_HODOS with ${compiled['ORMOZ_HODOS'].length} points.`);
  }

  const outPath = path.join(__dirname, '../src/data/exact_rail_corridors.json');
  fs.writeFileSync(outPath, JSON.stringify(compiled, null, 2), 'utf-8');
  console.log(`\nSuccessfully written all exact rail corridors to ${outPath}!`);
}

main();
