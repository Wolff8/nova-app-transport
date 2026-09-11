/**
 * High-Precision Railway Track Snapper
 * Snaps train coordinates directly onto physical railway track centerlines
 * using the sub-meter MOTIS & OpenRailwayMap vector geometries.
 */


interface RailSegment {
  p1: [number, number]; // [lon, lat]
  p2: [number, number]; // [lon, lat]
  dx: number;
  dy: number;
  segLenSq: number;
  bearing: number;
}

const CELL_SIZE = 0.05; // ~3.5km x 5.5km spatial grid cells
const spatialGrid: Map<string, RailSegment[]> = new Map();
let isInitialized = false;

function getCellKey(gridX: number, gridY: number): string {
  return `${gridX}:${gridY}`;
}

function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaLambda = (lon2 - lon1) * rad;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function initRailTrackSnapper(corridors: Record<string, [number, number][]>): void {
  if (isInitialized) return;

  for (const corridorName of Object.keys(corridors)) {
    const points = corridors[corridorName];
    if (!points || points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const cosLat = Math.cos(((p1[1] + p2[1]) * 0.5 * Math.PI) / 180);
      const dx = (p2[0] - p1[0]) * cosLat;
      const dy = p2[1] - p1[1];
      const segLenSq = dx * dx + dy * dy;
      if (segLenSq === 0) continue;

      const bearing = calcBearing(p1[1], p1[0], p2[1], p2[0]);

      const seg: RailSegment = {
        p1,
        p2,
        dx,
        dy,
        segLenSq,
        bearing
      };

      // Register segment in bounding-box cells
      const minLon = Math.min(p1[0], p2[0]);
      const maxLon = Math.max(p1[0], p2[0]);
      const minLat = Math.min(p1[1], p2[1]);
      const maxLat = Math.max(p1[1], p2[1]);

      const minX = Math.floor(minLon / CELL_SIZE);
      const maxX = Math.floor(maxLon / CELL_SIZE);
      const minY = Math.floor(minLat / CELL_SIZE);
      const maxY = Math.floor(maxLat / CELL_SIZE);

      for (let gx = minX; gx <= maxX; gx++) {
        for (let gy = minY; gy <= maxY; gy++) {
          const key = getCellKey(gx, gy);
          let list = spatialGrid.get(key);
          if (!list) {
            list = [];
            spatialGrid.set(key, list);
          }
          list.push(seg);
        }
      }
    }
  }

  isInitialized = true;
}

let loadPromise: Promise<void> | null = null;

/**
 * Fetch the track geometry and build the spatial grid from it.
 *
 * The 800 KB corridor file used to be compiled into the JavaScript bundle,
 * so every visitor downloaded and parsed it before the app could start. It is
 * now served as its own cacheable file and fetched after the map is up;
 * `snapToRailTrack` returns the input unchanged until it has arrived.
 */
export function loadRailTrackGeometry(url: string): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = fetch(url, { cache: 'force-cache' })
      .then(r => { if (!r.ok) throw new Error(`rail geometry HTTP ${r.status}`); return r.json(); })
      .then((data: Record<string, [number, number][]>) => { initRailTrackSnapper(data); })
      .catch(err => { loadPromise = null; throw err; });
  }
  return loadPromise;
}

export function isRailTrackGeometryReady(): boolean { return isInitialized; }

/**
 * Snaps a [lon, lat] coordinate to the nearest physical railway track segment.
 * @param lon Longitude
 * @param lat Latitude
 * @param maxDistanceMeters Maximum snap distance tolerance (default 2,500m)
 * @param routeBearing Optional expected heading/bearing along the train's route
 */
export function snapToRailTrack(
  lon: number,
  lat: number,
  maxDistanceMeters: number = 2500,
  routeBearing?: number
): {
  lon: number;
  lat: number;
  bearing?: number;
  snapped: boolean;
  distanceMeters: number;
} {
  if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) {
    return { lon, lat, snapped: false, distanceMeters: Infinity };
  }

  // Cross-Border Safety Guard: Slovenia rail envelope roughly bounds [13.35, 45.42] to [16.60, 46.88]
  // Outside Slovenia, do NOT snap to Slovenian tracks — preserve true European corridor geometry!
  if (lon < 13.35 || lon > 16.60 || lat < 45.42 || lat > 46.88) {
    return {
      lon,
      lat,
      bearing: routeBearing != null && !isNaN(routeBearing) ? Math.round(routeBearing) : undefined,
      snapped: false,
      distanceMeters: Infinity
    };
  }

  // Geometry not here yet: report honestly that nothing was snapped rather
  // than block on a synchronous parse of an 800 KB file.
  if (!isInitialized) {
    return {
      lon,
      lat,
      bearing: routeBearing != null && !isNaN(routeBearing) ? Math.round(routeBearing) : undefined,
      snapped: false,
      distanceMeters: Infinity
    };
  }

  const gx = Math.floor(lon / CELL_SIZE);
  const gy = Math.floor(lat / CELL_SIZE);

  // Search current cell and immediate neighboring cells (3x3 grid)
  let bestDistMeters = Infinity;
  let bestLon = lon;
  let bestLat = lat;
  let bestBearing: number | undefined;

  const cosLat = Math.cos((lat * Math.PI) / 180);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = getCellKey(gx + dx, gy + dy);
      const segments = spatialGrid.get(key);
      if (!segments) continue;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const p1 = seg.p1;
        const p2 = seg.p2;

        const qx = (lon - p1[0]) * cosLat;
        const qy = lat - p1[1];

        // Scalar projection parameter t in [0, 1]
        const t = Math.max(0, Math.min(1, (qx * seg.dx + qy * seg.dy) / seg.segLenSq));

        const projLon = p1[0] + t * (p2[0] - p1[0]);
        const projLat = p1[1] + t * (p2[1] - p1[1]);

        const dLonM = (lon - projLon) * 111000 * cosLat;
        const dLatM = (lat - projLat) * 111000;
        const distM = Math.hypot(dLonM, dLatM);

        if (distM < bestDistMeters) {
          bestDistMeters = distM;
          bestLon = projLon;
          bestLat = projLat;
          bestBearing = seg.bearing;
        }
      }
    }
  }

  if (bestDistMeters <= maxDistanceMeters) {
    let finalBearing = bestBearing;
    // Align track tangent with the forward direction of travel
    if (finalBearing != null && routeBearing != null && !isNaN(routeBearing)) {
      const angleDiff = Math.abs(((finalBearing - routeBearing + 540) % 360) - 180);
      if (angleDiff > 90) {
        finalBearing = (finalBearing + 180) % 360;
      }
    }

    return {
      lon: Number(bestLon.toFixed(5)),
      lat: Number(bestLat.toFixed(5)),
      bearing: finalBearing != null ? Math.round(finalBearing) : (routeBearing != null ? Math.round(routeBearing) : undefined),
      snapped: true,
      distanceMeters: Math.round(bestDistMeters)
    };
  }

  return {
    lon,
    lat,
    bearing: routeBearing != null && !isNaN(routeBearing) ? Math.round(routeBearing) : undefined,
    snapped: false,
    distanceMeters: Math.round(bestDistMeters)
  };
}
