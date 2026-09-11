export async function getLiveAircraft() {
  try {
    // Slovenia bounding box approximately
    const response = await fetch('https://opensky-network.org/api/states/all?lamin=45.4&lomin=13.3&lamax=46.9&lomax=16.6');
    const data = await response.json();
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
    console.error('OpenSky Error', err);
    return [];
  }
}
