const toHex = (str: string) => Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
import { EV_STATIONS_POMURJE } from '../data/infrastructure';

async function getJSON(url: string, opts?: RequestInit) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000); // 6s timeout
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) {
      clearTimeout(id);
      throw new Error('Fetch failed');
    }
    const data = await res.json();
    clearTimeout(id);
    return data;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

export async function loadAir(errors: string[]) {
  const sensors: any[] = [];
  try {
    const osemBoxes = await getJSON('https://api.opensensemap.org/boxes?bbox=13.3,45.4,16.6,46.9&grouphypervisor=true');
    if (Array.isArray(osemBoxes)) {
      for (const b of osemBoxes) {
        if (!b.sensors) continue;
        const temp = b.sensors.find((s:any) => s.title === 'Temperature' || s.title === 'Temperatur');
        const pm10 = b.sensors.find((s:any) => s.title === 'PM10');
        
        sensors.push({
          id: b._id,
          lat: b.currentLocation?.coordinates[1],
          lon: b.currentLocation?.coordinates[0],
          name: b.name,
          temp: temp?.lastMeasurement?.value ? parseFloat(temp.lastMeasurement.value) : null,
          pm10: pm10?.lastMeasurement?.value ? parseFloat(pm10.lastMeasurement.value) : null,
          status: 'Živo merjenje (OpenSenseMap)'
        });
      }
    }
  } catch (e: any) {
    errors.push('OpenSenseMap API error');
  }
  return sensors;
}

export async function loadQuakes(errors: string[]) {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 45 * 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 19);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${iso(start)}&endtime=${iso(end)}&minlatitude=45.0&maxlatitude=47.5&minlongitude=13.5&maxlongitude=17.5&orderby=time&limit=30`;
    const d = await getJSON(url);
    return (d.features || [])
      .filter((f: any) => f.properties && f.properties.mag != null && f.geometry)
      .map((f: any) => ({
        id: f.id,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        mag: f.properties.mag,
        place: f.properties.place || 'Srednja Evropa',
        depth: f.geometry.coordinates[2] || 10,
        time: new Date(f.properties.time).toLocaleString('sl-SI'),
      }));
  } catch (e: any) { 
    return []; 
  }
}

export async function loadEVCharging(errors: string[]) {
  return EV_STATIONS_POMURJE.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    connectors: f.properties.connectors || ['CCS2', 'Type 2'],
    operator: f.properties.operator || 'Petrol',
  }));
}

export async function loadAircraft(errors: string[]) {
  try {
    const data = await getJSON('https://opensky-network.org/api/states/all?lamin=45.4&lomin=13.3&lamax=46.9&lomax=16.6');
    if (!data || !data.states) return [];
    
    return data.states.map((s: any) => ({
      id: s[0],
      callsign: s[1]?.trim() || 'UNKNOWN',
      origin_country: s[2],
      lon: s[5],
      lat: s[6],
      alt: s[7], // baro altitude
      velocity: s[9] ? Math.round(s[9] * 3.6) : 0, // m/s to km/h
      heading: s[10],
      category: s[17] || 0
    })).filter((a: any) => a.lat && a.lon);
  } catch (err) {
    errors.push('OpenSky API error');
    return [];
  }
}

export async function searchGeocode(query: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=si&limit=5`);
    const data = await res.json();
    return data.map((item: any) => ({
      name: item.display_name.split(',')[0],
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch (e) {
    return [];
  }
}

// Simulated NB-IoT Smart Sensors (Telekom Slovenije / Telemach NB-IoT Networks)








// REAL TTN LoRaWAN Gateways in Slovenia (Murska Sobota region)


// REAL Nomago & BicikeLJ (CityBikes API)
export async function loadBikes(errors: string[]) {
  try {
    const networksRes = await getJSON('https://api.citybik.es/v2/networks');
    const siNetworks = (networksRes.networks || []).filter((n: any) => n.location?.country === 'SI');
    
    let allStations: any[] = [];
    for (const net of siNetworks) {
      try {
        const netData = await getJSON(`https://api.citybik.es${net.href}`);
        if (netData.network?.stations) {
          const stations = netData.network.stations.map((s: any) => ({
            id: s.id,
            name: `${net.name} - ${s.name}`,
            network: net.name,
            lat: s.latitude,
            lon: s.longitude,
            free_bikes: s.free_bikes,
            empty_slots: s.empty_slots,
            timestamp: s.timestamp
          }));
          allStations = allStations.concat(stations);
        }
      } catch (e) {
        // ignore individual network failure
      }
    }
    return allStations;
  } catch (e) {
    errors.push('CityBikes API error');
    return [];
  }
}




// Real-time proxy for public transit (BrezAvta API)
const clientBrezavtaHistory = new Map<string, { lat: number; lon: number; ts: number; lastMoveTs: number; speed: number; heading: number }>();

export function parseBrezAvtaVehicleData(data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  const now = Math.floor(Date.now() / 1000);
  const vehMap = new Map();
  for (const v of data) {
    if (!v.lat || !v.lon) continue;
    let ts = v.timestamp;
    if (ts > 10000000000) ts = Math.floor(ts / 1000);

    // Discard stale and inactive vehicles (parked overnight or finished shifts)
    if (ts) {
      const ageSec = Math.max(0, now - ts);
      if (ageSec > 900) continue;
      const rawSpd = v.speed != null ? Number(v.speed) : 0;
      if (rawSpd < 0.3 && ageSec > 600) continue;
    }

    const vId = v.vehicle?.id || v.vehicle?.plate || v.trip_id;
    if (!vId) continue;
    if (!vehMap.has(vId) || (vehMap.get(vId).ts || 0) < (ts || 0)) {
      vehMap.set(vId, { raw: v, ts });
    }
  }

  const vehicles: any[] = [];
  for (const [vId, { raw: v, ts }] of vehMap.entries()) {
    const rawOp = v.vehicle?.operator_name || '';
    // Strict Separation: Exclude rail/trains from BrezAvta bus feed
    const rawOpLower = rawOp.toLowerCase();
    const isTrain = (v.stop && v.stop.type === 'RAIL') || 
      rawOpLower.includes('železnic') || 
      rawOpLower.includes('sž') || 
      rawOpLower.includes('öbb') || 
      rawOpLower.includes('oebb') ||
      rawOpLower.includes('máv');
    if (isTrain) continue;

    let operator = 'IJPP Avtobus';
    let operatorColor = '#06b6d4';
    let iconImage = 'icon-bus-other';

    if (rawOp.includes('Ljubljanski') || rawOp.includes('LPP') || rawOpLower.includes('potniški promet')) {
      operator = 'LPP';
      operatorColor = '#10b981';
      iconImage = 'icon-bus-lpp';
    } else if (rawOp.includes('Arriva')) {
      operator = 'Arriva';
      operatorColor = '#2563eb';
      iconImage = 'icon-bus-arriva';
    } else if (rawOp.includes('Nomago')) {
      operator = 'Nomago';
      operatorColor = '#0284c7';
      iconImage = 'icon-bus-nomago';
    } else if (rawOp.includes('Marprom')) {
      operator = 'Marprom';
      operatorColor = '#ef4444';
      iconImage = 'icon-bus-marprom';
    } else if (rawOp.includes('Murska Sobota') || rawOp.includes('AP MS') || rawOpLower.includes('pomur')) {
      operator = 'AP Murska Sobota';
      operatorColor = '#f59e0b';
      iconImage = 'icon-bus-apms';
    } else if (rawOp.includes('Kranj') || rawOpLower.includes('mestni promet kranj')) {
      operator = 'MP Kranj';
      operatorColor = '#8b5cf6';
      iconImage = 'icon-bus-mpkranj';
    } else if (rawOp) {
      operator = rawOp.replace(/,?\s*d\.o\.o\.?/gi, '').replace(/,?\s*d\.d\.?/gi, '').trim();
      operatorColor = '#06b6d4';
      iconImage = 'icon-bus-other';
    }

    const route = v.route_short_name || '';
    const plate = v.vehicle?.plate || '';
    const headsign = v.trip_headsign || '';

    let name = '';
    if (operator === 'LPP') {
      name = route ? `LPP ${route}` : 'LPP Avtobus';
    } else {
      if (route) name = `${operator} ${route}`;
      else if (plate) name = `${operator} ${plate}`;
      else name = operator;
    }

    const rawSpeed = v.speed != null ? Number(v.speed) : null;
    let speedKmh = (rawSpeed != null && rawSpeed > 0.3) ? Math.round(rawSpeed * 3.6) : 0;
    const nowMs = Date.now();
    const prevHist = clientBrezavtaHistory.get(vId);

    const hasValidHeading = typeof v.heading === 'number' && !isNaN(v.heading) && v.heading >= 0 && v.heading <= 360;
    let heading = hasValidHeading ? Math.round(v.heading) : (prevHist?.heading || 0);

    if (prevHist) {
      if (ts && prevHist.ts && ts < prevHist.ts) {
        speedKmh = prevHist.speed;
        heading = prevHist.heading;
      } else {
        const dLat = (v.lat - prevHist.lat) * 111;
        const dLon = (v.lon - prevHist.lon) * 78;
        const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
        const dtSec = (ts && prevHist.ts && ts > prevHist.ts)
          ? (ts - prevHist.ts)
          : Math.max(1, (nowMs - prevHist.lastMoveTs) / 1000);

        if (distKm > 0.012 && distKm < 1.5) {
          let calcSpeed = Math.round((distKm / Math.max(1, dtSec)) * 3600);
          if (calcSpeed > 120) calcSpeed = 110;
          if (calcSpeed < 4) calcSpeed = 4;

          if (speedKmh <= 0) {
            speedKmh = prevHist.speed > 0 ? Math.round(prevHist.speed * 0.3 + calcSpeed * 0.7) : calcSpeed;
          }
          if (!hasValidHeading) {
            heading = Math.round((Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360);
          }
          clientBrezavtaHistory.set(vId, {
            lat: v.lat,
            lon: v.lon,
            ts: ts || Math.floor(nowMs / 1000),
            lastMoveTs: nowMs,
            speed: speedKmh,
            heading
          });
        } else if (distKm <= 0.008) {
          // Stationary
          speedKmh = 0;
          clientBrezavtaHistory.set(vId, {
            lat: prevHist.lat,
            lon: prevHist.lon,
            ts: ts || Math.floor(nowMs / 1000),
            lastMoveTs: prevHist.lastMoveTs,
            speed: 0,
            heading: prevHist.heading || heading
          });
        } else {
          clientBrezavtaHistory.set(vId, {
            lat: v.lat,
            lon: v.lon,
            ts: ts || Math.floor(nowMs / 1000),
            lastMoveTs: nowMs,
            speed: speedKmh,
            heading
          });
        }
      }
    } else {
      clientBrezavtaHistory.set(vId, {
        lat: v.lat,
        lon: v.lon,
        ts: ts || Math.floor(nowMs / 1000),
        lastMoveTs: nowMs,
        speed: speedKmh,
        heading
      });
    }

    const isMoving = speedKmh >= 3;
    const finalHeading = heading;
    const finalHasHeading = true; // Arrow always displayed in heading direction

    vehicles.push({
      id: 'brezavta_' + vId,
      lat: v.lat,
      lon: v.lon,
      name,
      type: 'bus',
      operator,
      operatorColor,
      iconImage,
      route,
      plate,
      destination: headsign,
      status: isMoving ? 'moving' : 'stopped',
      speed: speedKmh,
      heading: finalHeading,
      hasHeading: finalHasHeading,
      timestamp: ts
    });
  }
  return vehicles;
}

/**
 * Dedicated high-frequency loader for BrezAvta urban bus locations.
 * Uses a shorter TTL (1.5s) to guarantee fast refresh and smoother visual motion.
 */
export async function loadBrezAvtaBusLocations(errors: string[] = []): Promise<any[]> {
  try {
    const res = await fetch('/api/brezavta?_=' + Date.now());
    if (res.ok) {
      const bData = await res.json();
      if (Array.isArray(bData) && bData.length > 0) {
        return bData;
      }
    }
  } catch (e) {
    // Fall back to direct upstream
  }

  try {
    const directRes = await fetch('https://api.beta.brezavta.si/vehicles/locations?_=' + Date.now());
    if (directRes.ok) {
      const data = await directRes.json();
      return parseBrezAvtaVehicleData(data);
    }
  } catch (fallbackErr) {
    errors.push('BrezAvta direct fetch error');
  }

  return [];
}

export async function loadTransit(errors: string[]) {
  const allVehicles: any[] = [];
  
  try {
    const resTransit = await fetch('/api/transit');
    if (resTransit.ok) {
      const transitData = await resTransit.json();
      if (Array.isArray(transitData)) {
        allVehicles.push(...transitData);
      }
    } else {
      errors.push('Transit API timeout');
    }
  } catch (e) {
    errors.push('Transit API error');
  }

  const finalVehicles: any[] = [];
  const seenTrains = new Set<string>();
  const numberedTrainPositions: { lat: number; lon: number }[] = [];
  const genericCandidates: any[] = [];

  for (let i = 0; i < allVehicles.length; i++) {
    const v = allVehicles[i];
    if (v.type === 'tram' || v.type === 'bus') {
      finalVehicles.push(v);
      continue;
    }
    if (v.type === 'train' || !v.type) {
      const rawName = v.name || '';
      const match = rawName.match(/\d+/);
      const tNum = match ? match[0] : null;
      if (tNum) {
        if (seenTrains.has(tNum)) continue;
        seenTrains.add(tNum);
        numberedTrainPositions.push({ lat: v.lat, lon: v.lon });
        finalVehicles.push(v);
      } else {
        genericCandidates.push(v);
      }
    }
  }

  // Filter generic train duplicates against numbered trains and each other
  const keptGenericPositions: { lat: number; lon: number }[] = [];
  for (const v of genericCandidates) {
    // 1. If within 6 km of a numbered train, it's a ghost duplicate of that train
    const nearNumbered = numberedTrainPositions.some(p => {
      const dLat = (p.lat - v.lat) * 111;
      const dLon = (p.lon - v.lon) * 78;
      return (dLat * dLat + dLon * dLon) < 36; // 6 km
    });
    if (nearNumbered) continue;

    // 2. If within 4 km of another generic train, deduplicate
    const nearOtherGeneric = keptGenericPositions.some(p => {
      const dLat = (p.lat - v.lat) * 111;
      const dLon = (p.lon - v.lon) * 78;
      return (dLat * dLat + dLon * dLon) < 16; // 4 km
    });
    if (nearOtherGeneric) continue;

    keptGenericPositions.push({ lat: v.lat, lon: v.lon });
    finalVehicles.push(v);
  }

  return finalVehicles;
}

export async function loadAprs(errors: string[]) {
  try {
    const res = await fetch('/api/aprs');
    if (!res.ok) throw new Error('APRS error');
    return await res.json();
  } catch (e) {
    errors.push('APRS.fi Network timeout');
    return [];
  }
}

export async function loadLoraMesh(errors: string[]) {
  try {
    const res = await fetch('/api/loramesh');
    if (!res.ok) throw new Error('LoRaMesh error');
    return await res.json();
  } catch (e) {
    errors.push('LoRaMesh Network timeout');
    return [];
  }
}

export async function loadSparql(errors: string[]) {
  try {
    const res = await fetch('/api/sparql');
    if (!res.ok) throw new Error('SPARQL error');
    return await res.json();
  } catch (e) {
    errors.push('EU Data Portal SPARQL timeout');
    return [];
  }
}

export async function loadOverpass(type: string, errors: string[]) {
  try {
    const res = await fetch(`/api/overpass?type=${type}`);
    if (!res.ok) throw new Error('Overpass error');
    return await res.json();
  } catch (e) {
    errors.push(`OSM/Overpass (${type}) timeout`);
    return [];
  }
}

export async function loadMicromobility(errors: string[]) {
  try {
    const res = await fetch(`/api/micromobility?_=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
    // Fallback to direct BrezAvta endpoint if server route returned empty or error
    const fallback = await fetch(`https://api.beta.brezavta.si/micromobility/?_=${Date.now()}`);
    if (!fallback.ok) throw new Error('Failed to fetch micromobility data');
    return await fallback.json();
  } catch (e: any) {
    errors.push('Micromobility API napaka: ' + e.message);
    return [];
  }
}


export async function loadSensorCommunity(errors: string[]) {
  try {
    const res = await fetch('/api/sensorcommunity');
    if (!res.ok) throw new Error('SensorCommunity error');
    return await res.json();
  } catch (e) {
    errors.push('Sensor.Community timeout');
    return [];
  }
}

export async function loadGitHub(errors: string[]) {
  try {
    const res = await fetch('/api/github');
    if (!res.ok) throw new Error('GitHub error');
    return await res.json();
  } catch (e) {
    errors.push('GitHub API timeout');
    return [];
  }
}

export async function loadArso(errors: string[]) {
  try {
    const res = await fetch('/api/arso');
    if (!res.ok) throw new Error('ARSO error');
    return await res.json();
  } catch (e) {
    errors.push('ARSO timeout');
    return [];
  }
}

export async function loadSmartCity(errors: string[]) { try { const res = await fetch('/api/smartcity'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }

export async function fetchPackets(id: string) {
  try {
    const res = await fetch('/api/smartcity/packets/' + id);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

export async function loadSwitches(errors: string[]) { try { const res = await fetch('/api/switches'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadSignals(errors: string[]) { try { const res = await fetch('/api/signals'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }

export async function loadSpat(errors: string[]) { try { const res = await fetch('/api/spat'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }

export async function loadHydro(errors: string[]) { try { const res = await fetch('/api/hydro'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadPower(errors: string[]) { try { const res = await fetch('/api/power'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadMoms(errors: string[]) { try { const res = await fetch('/api/moms'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadOpenAQ(errors: string[]) { try { const res = await fetch('/api/openaq'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadEuroRail(errors: string[]) { try { const res = await fetch('/api/eurorail'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadTTN(errors: string[]) { try { const res = await fetch('/api/ttn'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }
export async function loadOpenSense(errors: string[]) { try { const res = await fetch('/api/opensense'); if(!res.ok) throw new Error(); return await res.json(); } catch(e) { return []; } }export async function loadWeather(errors: string[]) { return []; }


export async function loadHafas(errors: string[]) {
  try {
    const res = await fetch('/api/hafas');
    if (res.ok) {
      return await res.json();
    } else {
      throw new Error('HAFAS server error');
    }
  } catch (e) {
    errors.push('HAFAS (SŽ / ÖBB) API timeout');
    return [];
  }
}

export async function loadTraffic(errors: string[]) { 
    try { 
        const res = await fetch('/api/traffic'); 
        if(!res.ok) throw new Error(); 
        return await res.json(); 
    } catch(e) { 
        errors.push('OpenTrafficMap timeout');
        return []; 
    } 
}

export async function loadLiveTrains(errors: string[], bounds?: { north: number, south: number, west: number, east: number }) {
  try {
    let url = '/api/trains/radar';
    if (bounds) {
      url += `?north=${bounds.north}&south=${bounds.south}&west=${bounds.west}&east=${bounds.east}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Live Trains API failed: ${response.status}`);
    const data = await response.json();
    const movements = data.movements || data || [];
    return movements.filter((t: any) => t.location?.latitude && t.location?.longitude).map((t: any) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [t.location.longitude, t.location.latitude]
      },
      properties: {
        id: t.tripId || Math.random().toString(),
        name: t.line?.name || t.line?.id || 'Train',
        direction: t.direction,
        line: t.line?.name,
        product: t.line?.productName || 'Train',
        type: 'live_train'
      }
    }));
  } catch (err: any) {
    errors.push(`Live Trains fetch error: ${err.message}`);
    return [];
  }
}

export async function loadEraTunnels(errors: string[]) {

    try {

        const res = await fetch("/api/era/tunnels");

        if (!res.ok) throw new Error();

        return await res.json();

    } catch(e) {
        return { type: "FeatureCollection", features: [] };
    }
}

export async function loadRinf(errors: string[]) {
    try {
        const res = await fetch('/api/rinf/stations');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch(e: any) {
        return [];
    }
}



export async function fetchRinfNetwork() {
    try {
        const res = await fetch('/api/rinf/network');
        if (res.ok) return await res.json();
    } catch (e) {
        // quiet fallback
    }
    return { type: 'FeatureCollection', features: [] };
}

export async function fetchArsoSensors() {
    try {
        const res = await fetch('/api/sensors/arso');
        if (res.ok) return await res.json();
    } catch (e) {
        console.error("Failed to fetch ARSO", e);
    }
    return [];
}

export async function loadRinfNetwork(errors: string[]) {
    try {
        const res = await fetch('/api/rinf/network');
        if (res.ok) return await res.json();
    } catch (e: any) {
        // quiet fallback
    }
    return { type: 'FeatureCollection', features: [] };
}

export async function loadAnalyticsDelays(errors: string[]) {
    try {
        const res = await fetch('/api/analytics/delays');
        if (res.ok) return await res.json();
    } catch (e: any) {
        errors.push('Delay Analytics failed: ' + e.message);
    }
    return { type: 'FeatureCollection', features: [] };
}

export async function loadRegionalStations(errors?: string[]) {
    try {
        const res = await fetch('/api/stations');
        if (res.ok) return await res.json();
    } catch (e: any) {
        if (errors) errors.push('Stations load failed: ' + e.message);
    }
    return [];
}

export async function loadStationDepartures(params: { stationId?: string; name?: string; lat?: number; lon?: number }) {
    try {
        const q = new URLSearchParams();
        if (params.stationId) q.set('stationId', params.stationId);
        if (params.name) q.set('name', params.name);
        if (params.lat != null) q.set('lat', String(params.lat));
        if (params.lon != null) q.set('lon', String(params.lon));
        const res = await fetch(`/api/station/departures?${q.toString()}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.error('Failed to load station departures', e);
    }
    return { station: null, departures: [], error: 'Napaka pri pridobivanju odhodov' };
}

export async function loadTrainTrip(params: { 
    tripId?: string; 
    line?: string; 
    trainNum?: string; 
    origin?: string; 
    destination?: string; 
    operator?: string;
    delay?: number;
    lat?: number;
    lon?: number;
}) {
    try {
        const q = new URLSearchParams();
        if (params.tripId) q.set('tripId', params.tripId);
        if (params.line) q.set('line', params.line);
        if (params.trainNum) q.set('trainNum', params.trainNum);
        if (params.origin) q.set('origin', params.origin);
        if (params.destination) q.set('destination', params.destination);
        if (params.operator) q.set('operator', params.operator);
        if (params.delay != null) q.set('delay', String(params.delay));
        if (params.lat != null) q.set('lat', String(params.lat));
        if (params.lon != null) q.set('lon', String(params.lon));
        
        const res = await fetch(`/api/train/trip?${q.toString()}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.error('Failed to load train trip', e);
    }
    return null;
}

/**
 * The freight layer used to plot the app's own invented workings as if they
 * were vehicles on the map — train numbers, positions and speeds that no feed
 * publishes, because none does for freight on this corridor. Those are gone.
 *
 * What the map draws now is the TEN-T designated rail network, coloured by
 * what the Commission says each segment carries. The freight that is real —
 * the tonnage sitting in Koper and the movement it implies — is quantified in
 * the corridor-load panel rather than dressed up as train markers.
 */
export async function loadTentRailways(errors?: string[]): Promise<any> {
    try {
        const res = await fetch('/api/tent/railways');
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.features)) return data;
        }
    } catch (e) {
        if (errors) errors.push('TEN-T railway geometry error');
    }
    return { type: 'FeatureCollection', features: [] };
}

export async function loadBorderCrossings(errors?: string[]): Promise<any> {
    try {
        const res = await fetch('/api/rinf/border-crossings');
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.features)) return data;
        }
    } catch (e) {
        if (errors) errors.push('Border crossings error');
    }
    return { type: 'FeatureCollection', features: [] };
}

export async function loadFreightTrains(_errors?: string[]): Promise<any[]> {
    // Deliberately empty: see loadTentRailways above.
    return [];
}

