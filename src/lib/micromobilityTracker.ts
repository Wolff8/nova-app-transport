/**
 * Micromobility Tracker & In-Trip Inference Engine (Metoda C)
 *
 * Implements Differential In-Trip Inference for public micromobility (GBFS) in Slovenia
 * (Bolt scooters, Kvik scooters, Avant2Go electric cars, BicikeLJ, Mbajk, Nextbike, etc.):
 *
 * 1. Tracks all floating vehicles (SCOOTER, BICYCLE, CAR) and docking stations across GBFS polls.
 * 2. When a floating vehicle disappears from the available feed, it detects the rental start event (IN_TRIP)
 *    and records origin coordinates and departure timestamp.
 * 3. Projects and renders in-trip vehicles directly on the map with active telemetry and duration timers.
 * 4. When the vehicle reappears at a new destination, it calculates real trip trajectory, distance (km),
 *    duration (min), and average speed (km/h), recording it in the completed trips registry.
 * 5. Provides smooth differential motion updates compatible with MapController's animation loop.
 */

export interface InferredActiveTrip {
  id: string;
  vehicleId: string;
  form: 'SCOOTER' | 'BICYCLE' | 'CAR';
  network: string;
  name: string;
  originLat: number;
  originLon: number;
  currentLat: number;
  currentLon: number;
  heading: number;
  speedKmH: number;
  startTime: number;
  lastActiveTime: number;
  durationSeconds: number;
  durationFormatted?: string;
  estimatedDistanceKm: number;
  status: 'in_trip';
  waypoints?: [number, number][];
  destinationLat?: number;
  destinationLon?: number;
}

export interface CompletedTripRecord {
  id: string;
  vehicleId: string;
  form: 'SCOOTER' | 'BICYCLE' | 'CAR';
  network: string;
  name: string;
  origin: [number, number]; // [lat, lon]
  destination: [number, number]; // [lat, lon]
  startTime: number;
  endTime: number;
  durationSeconds: number;
  distanceKm: number;
  avgSpeedKmH: number;
  completedAt: Date;
}

export interface StationDelta {
  stationId: string;
  name: string;
  network: string;
  vehicles: number;
  spaces: number;
  deltaVehicles: number; // positive = returns, negative = rentals
  timestamp: number;
}

export interface MicromobilityTrackerStats {
  totalFloating: number;
  totalStations: number;
  totalAvailableScooters: number;
  totalAvailableBikes: number;
  totalAvailableCars: number;
  activeInTripCount: number;
  completedTripsCount: number;
  recentTrips: CompletedTripRecord[];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function interpolateAlongWaypoints(
  waypoints: [number, number][],
  targetDistanceKm: number
): {
  lat: number;
  lon: number;
  heading: number;
  progressRatio: number;
} {
  if (!waypoints || waypoints.length === 0) {
    return { lat: 0, lon: 0, heading: 0, progressRatio: 0 };
  }
  if (waypoints.length === 1) {
    return { lat: waypoints[0][0], lon: waypoints[0][1], heading: 0, progressRatio: 1 };
  }

  const segDistances: number[] = [];
  let totalPathDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = haversineKm(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1]);
    segDistances.push(d);
    totalPathDistance += d;
  }

  if (totalPathDistance <= 0.001) {
    return { lat: waypoints[0][0], lon: waypoints[0][1], heading: 0, progressRatio: 1 };
  }

  // Smooth continuous bidirectional looping so vehicles continuously move realistically along roads
  const cycleDistance = totalPathDistance * 2;
  const modDist = targetDistanceKm % cycleDistance;
  const isReverse = modDist > totalPathDistance;
  const effectiveDistance = isReverse ? (cycleDistance - modDist) : modDist;
  const progressRatio = effectiveDistance / totalPathDistance;

  let cumDist = 0;
  for (let i = 0; i < segDistances.length; i++) {
    const segDist = segDistances[i];
    if (effectiveDistance <= cumDist + segDist || i === segDistances.length - 1) {
      const segT = segDist > 0 ? Math.max(0, Math.min(1, (effectiveDistance - cumDist) / segDist)) : 0;
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      const fromP = isReverse ? p2 : p1;
      const toP = isReverse ? p1 : p2;
      const ratio = isReverse ? (1 - segT) : segT;

      const lat = p1[0] + (p2[0] - p1[0]) * segT;
      const lon = p1[1] + (p2[1] - p1[1]) * segT;

      const dLatM = (toP[0] - fromP[0]) * 111139;
      const dLonM = (toP[1] - fromP[1]) * 111139 * Math.cos((fromP[0] * Math.PI) / 180);
      const heading = Math.round((Math.atan2(dLonM, dLatM) * 180 / Math.PI + 360) % 360);

      return {
        lat,
        lon,
        heading,
        progressRatio
      };
    }
    cumDist += segDist;
  }

  const lastP = waypoints[waypoints.length - 1];
  return { lat: lastP[0], lon: lastP[1], heading: 0, progressRatio: 1 };
}

export class MicromobilityTracker {
  private static instance: MicromobilityTracker | null = null;

  // Known floating vehicles last state
  private knownVehicles = new Map<string, {
    id: string;
    form: 'SCOOTER' | 'BICYCLE' | 'CAR';
    network: string;
    name: string;
    lat: number;
    lon: number;
    heading: number;
    speed: number;
    lastSeenTime: number;
    seenCount: number;
  }>();

  // Active trips detected by Method C (vehicle disappeared from public available feed)
  private activeTrips = new Map<string, InferredActiveTrip>();

  // Completed trips archive
  private completedTrips: CompletedTripRecord[] = [];

  // Station state tracking for docking systems (BicikeLJ, Nextbike, Mbajk)
  private knownStations = new Map<string, {
    vehicles: number;
    spaces: number;
    lastSeenTime: number;
  }>();

  private recentStationDeltas: StationDelta[] = [];
  private lastProcessTime = 0;

  constructor() {
    this.initCompletedTrips();
    this.initActiveTrips();
  }

  private initActiveTrips() {
    // Deliberately empty. This used to seed the tracker with hard-coded trips —
    // named vehicles with fixed routes and distances (0.98 km, 3.1 km, 0.88 km)
    // that were presented in the UI as live rentals, directly beneath a "100%
    // Realni podatki · Brez simulacije" banner. Active rentals are now only ever
    // inferred from the real GBFS feed.
  }

  private initCompletedTrips() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('micromobility_completed_trips');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.completedTrips = parsed;
            return;
          }
        }
      }
    } catch (e) {
      // ignore localStorage errors
    }

    // No seeded fallback: a trip is only recorded once a vehicle has actually
    // been observed leaving one place and reappearing at another, which is
    // where distance and average speed come from. Until that happens the list
    // is genuinely empty.
    this.completedTrips = [];
  }
  private persistCompletedTrips() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('micromobility_completed_trips', JSON.stringify(this.completedTrips.slice(0, 50)));
      }
    } catch (e) {
      // ignore
    }
  }

  public static getInstance(): MicromobilityTracker {
    if (!MicromobilityTracker.instance) {
      MicromobilityTracker.instance = new MicromobilityTracker();
    }
    return MicromobilityTracker.instance;
  }

  /**
   * Processes a raw snapshot from the BrezAvta GBFS feed.
   * Discovers new trips, updates active in-trip entities, and logs completed journeys.
   */
  public processFeed(rawItems: any[]): {
    renderedItems: any[];
    activeTrips: InferredActiveTrip[];
    completedTrips: CompletedTripRecord[];
    stats: MicromobilityTrackerStats;
  } {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return {
        renderedItems: [],
        activeTrips: Array.from(this.activeTrips.values()),
        completedTrips: this.completedTrips,
        stats: this.getStats()
      };
    }

    const now = Date.now();
    this.lastProcessTime = now;

    const currentFloatingIds = new Set<string>();
    const renderedItems: any[] = [];

    let totalAvailableScooters = 0;
    let totalAvailableBikes = 0;
    let totalAvailableCars = 0;
    let totalStations = 0;

    // 1. Process current feed items (Stations and Floating vehicles)
    for (const item of rawItems) {
      if (!item || !item.id || item.lat == null || item.lon == null) continue;

      const isStation = item.type === 'STATION';
      const form: 'SCOOTER' | 'BICYCLE' | 'CAR' =
        item.form === 'CAR' ? 'CAR' : (item.form === 'BICYCLE' ? 'BICYCLE' : 'SCOOTER');

      if (isStation) {
        totalStations++;
        // Track station delta (dock / undock events)
        const prevStation = this.knownStations.get(item.id);
        if (prevStation && prevStation.vehicles !== item.vehicles) {
          const delta = (item.vehicles || 0) - prevStation.vehicles;
          this.recentStationDeltas.unshift({
            stationId: item.id,
            name: item.name || 'Postaja',
            network: item.network || 'BrezAvta',
            vehicles: item.vehicles || 0,
            spaces: item.spaces || 0,
            deltaVehicles: delta,
            timestamp: now
          });
          if (this.recentStationDeltas.length > 50) this.recentStationDeltas.pop();
        }

        this.knownStations.set(item.id, {
          vehicles: item.vehicles || 0,
          spaces: item.spaces || 0,
          lastSeenTime: now
        });

        const totalCapacity = (item.vehicles || 0) + (item.spaces || 0);
        const occupancyPct = totalCapacity > 0 ? Math.round(((item.vehicles || 0) / totalCapacity) * 100) : 50;

        let stationLabel = `${item.name || 'Postaja'} (${item.vehicles || 0}/${totalCapacity || '–'})`;
        if (item.network === 'avant2go_si') {
          const availCars = item.reservableCars ?? item.vehicles ?? 0;
          const chargerText = item.chargers ? ` · ${item.chargers}⚡` : '';
          stationLabel = `Avant2Go · ${availCars} avto${availCars === 1 ? '' : (availCars === 2 ? 'a' : 'ov')}${chargerText}`;
        } else if (item.network === 'scbikes_ptuj') {
          stationLabel = `Ptuj · ${item.name} (${item.vehicles || 0}/${totalCapacity || '–'})`;
        }

        renderedItems.push({
          ...item,
          isStation: true,
          status: 'station',
          occupancyPct,
          labelText: stationLabel,
          speed: 0,
          heading: 0,
          isMoving: false
        });
      } else {
        // Floating vehicle (SCOOTER, CAR, BICYCLE)
        currentFloatingIds.add(item.id);

        if (form === 'SCOOTER') totalAvailableScooters++;
        else if (form === 'BICYCLE') totalAvailableBikes++;
        else if (form === 'CAR') totalAvailableCars++;

        const prev = this.knownVehicles.get(item.id);
        const activeTrip = this.activeTrips.get(item.id);

        let liveSpeed = 0;
        let liveHeading = 0;
        let hasHeading = false;
        let isMoving = false;

        // Check if vehicle was previously flagged as IN_TRIP and has now reappeared!
        if (activeTrip) {
          const tripDistanceKm = haversineKm(activeTrip.originLat, activeTrip.originLon, item.lat, item.lon);
          const tripDurationSec = Math.max(15, (now - activeTrip.startTime) / 1000);

          // If it traveled at least 40 meters, this is a real completed rental trip!
          if (tripDistanceKm >= 0.040 && tripDurationSec >= 30) {
            let avgSpeed = (tripDistanceKm / (tripDurationSec / 3600));
            // Realistic speed clamps
            if (form === 'SCOOTER' && avgSpeed > 28) avgSpeed = 22;
            if (form === 'BICYCLE' && avgSpeed > 32) avgSpeed = 20;
            if (form === 'CAR' && avgSpeed > 130) avgSpeed = 65;

            const completed: CompletedTripRecord = {
              id: `trip_${activeTrip.id}`,
              vehicleId: item.id,
              form,
              network: item.network || 'BrezAvta',
              name: item.name || form,
              origin: [activeTrip.originLat, activeTrip.originLon],
              destination: [item.lat, item.lon],
              startTime: activeTrip.startTime,
              endTime: now,
              durationSeconds: Math.round(tripDurationSec),
              distanceKm: parseFloat(tripDistanceKm.toFixed(2)),
              avgSpeedKmH: parseFloat(avgSpeed.toFixed(1)),
              completedAt: new Date(now)
            };

            this.completedTrips.unshift(completed);
            if (this.completedTrips.length > 80) this.completedTrips.pop();
            this.persistCompletedTrips();
          }

          // Conclude and remove active trip
          this.activeTrips.delete(item.id);
        }

        // Check if vehicle coordinates shifted while reported
        if (prev) {
          const distKm = haversineKm(prev.lat, prev.lon, item.lat, item.lon);
          const dtSec = Math.max(1, (now - prev.lastSeenTime) / 1000);

          // If moved > 8m and < 1.5km
          if (distKm > 0.008 && distKm < 1.5) {
            let calcSpeed = (distKm / dtSec) * 3600;
            if (form === 'SCOOTER') calcSpeed = Math.min(25, Math.max(4, calcSpeed));
            else if (form === 'BICYCLE') calcSpeed = Math.min(30, Math.max(4, calcSpeed));
            else if (form === 'CAR') calcSpeed = Math.min(120, Math.max(8, calcSpeed));

            liveSpeed = Math.round(calcSpeed);
            const dLatM = (item.lat - prev.lat) * 111139;
            const dLonM = (item.lon - prev.lon) * 111139 * Math.cos((item.lat * Math.PI) / 180);
            liveHeading = Math.round((Math.atan2(dLonM, dLatM) * 180 / Math.PI + 360) % 360);
            hasHeading = true;
            isMoving = true;
          } else if (distKm <= 0.008 && prev.speed > 0 && (now - prev.lastSeenTime) < 20000) {
            // Decelerating smoothly
            liveSpeed = Math.max(0, Math.round(prev.speed * 0.7));
            liveHeading = prev.heading;
            hasHeading = true;
            isMoving = liveSpeed >= 3;
          }
        }

        this.knownVehicles.set(item.id, {
          id: item.id,
          form,
          network: item.network || 'BrezAvta',
          name: item.name || form,
          lat: item.lat,
          lon: item.lon,
          heading: liveHeading,
          speed: liveSpeed,
          lastSeenTime: now,
          seenCount: (prev?.seenCount || 0) + 1
        });

        const isEbike = !!item.isEbike || item.propulsion === 'electric_assist';
        const formLabel = form === 'CAR' ? 'Avto' : (form === 'BICYCLE' ? (isEbike ? 'E-kolo' : 'Kolo') : 'Skiro');
        let netLabel = item.network ? item.network.split('_')[0].toUpperCase() : 'BREZAVTA';
        if (item.id?.startsWith('nomago_') || item.network?.startsWith('nextbike')) netLabel = 'NOMAGO';
        else if (item.network?.startsWith('bolt')) netLabel = 'BOLT';
        else if (item.network?.startsWith('kvik')) netLabel = 'KVIK';

        const batteryText = (isEbike && item.fuelPercent != null) ? ` 🔋${item.fuelPercent}%` : '';
        const labelText = isMoving
          ? `${formLabel} (${netLabel})${batteryText} · ${liveSpeed} km/h`
          : `${formLabel} (${netLabel})${batteryText}`;

        renderedItems.push({
          ...item,
          isStation: false,
          status: isMoving ? 'moving' : 'available',
          speed: liveSpeed,
          heading: liveHeading,
          hasHeading,
          isMoving,
          labelText
        });
      }
    }

    // 2. Detect NEW trips via Method C:
    // Floating vehicles that were known, seen at least once, but are MISSING from this feed!
    for (const [id, prev] of this.knownVehicles.entries()) {
      if (!currentFloatingIds.has(id)) {
        const timeSinceMissing = now - prev.lastSeenTime;

        // A vehicle that has only been seen once or twice is as likely to be
        // flickering in and out of the feed as to have been unlocked, and
        // counting those produced hundreds of phantom rentals — 584 of them at
        // one point, from a fleet of 1,739. Require a vehicle to have been
        // steadily present before its disappearance is read as a rental.
        if ((prev.seenCount || 0) < 3) {
          this.knownVehicles.delete(id);
          continue;
        }

        // If it went missing recently (< 45 minutes) and is not already tracked as an active trip
        // 25 minutes rather than 45: most shared-mobility rentals are short, and
        // the longer the window the more of the list is vehicles that were
        // simply collected for charging or rebalancing.
        if (timeSinceMissing < 25 * 60 * 1000) {
          let trip = this.activeTrips.get(id);

          if (!trip) {
            // A vehicle vanishing from the availability feed only means it is
            // no longer rentable. Usually someone unlocked it, but it may just
            // as well be a battery swap, a rebalancing pickup, or feed churn.
            // Either way its position while it is away is genuinely unknown, so
            // record only what was actually observed: the last real position
            // and the moment it disappeared. No heading, speed or route is
            // invented here — the real metrics are computed on reappearance
            // (step 1), where there is an actual origin, destination and
            // elapsed time to measure.
            const tripStartTime = prev.lastSeenTime || now;

            trip = {
              id: `act_${id}_${tripStartTime}`,
              vehicleId: id,
              form: prev.form,
              network: prev.network,
              name: prev.name,
              originLat: prev.lat,
              originLon: prev.lon,
              currentLat: prev.lat,
              currentLon: prev.lon,
              heading: prev.heading ?? 0,
              speedKmH: 0,
              startTime: tripStartTime,
              lastActiveTime: now,
              durationSeconds: Math.round((now - tripStartTime) / 1000),
              estimatedDistanceKm: 0,
              status: 'in_trip'
            };
            this.activeTrips.set(id, trip);
          }
        } else {
          // Trip expired (> 45 minutes missing)
          this.activeTrips.delete(id);
          this.knownVehicles.delete(id);
        }
      }
    }

    // 3. Keep the elapsed time of each active rental current. The vehicle's
    // position is not advanced: while it is absent from the feed nothing is
    // known about where it went, so it stays pinned to its last observed
    // location rather than being walked along an assumed route at an assumed
    // speed.
    for (const trip of this.activeTrips.values()) {
      trip.durationSeconds = Math.round((now - trip.startTime) / 1000);
      trip.lastActiveTime = now;
      const durM = Math.floor(trip.durationSeconds / 60);
      const durS = trip.durationSeconds % 60;
      trip.durationFormatted = `${durM}m ${durS.toString().padStart(2, '0')}s`;
    }

    // 4. Active rentals are deliberately NOT drawn on the map. Their position
    // is unknown while they are away from the feed, so plotting them would mean
    // showing an invented location and an invented speed as if it were live
    // telemetry. They remain available to the UI through `activeTrips` (for the
    // in-use count and the trip list), and each one turns into a real, measured
    // record in `completedTrips` when the vehicle reappears.

    return {
      renderedItems,
      activeTrips: Array.from(this.activeTrips.values()),
      completedTrips: this.completedTrips,
      stats: {
        totalFloating: currentFloatingIds.size,
        totalStations,
        totalAvailableScooters,
        totalAvailableBikes,
        totalAvailableCars,
        activeInTripCount: this.activeTrips.size,
        completedTripsCount: this.completedTrips.length,
        recentTrips: this.completedTrips.slice(0, 15)
      }
    };
  }

  public getStats(): MicromobilityTrackerStats {
    let scooters = 0, bikes = 0, cars = 0;
    for (const v of this.knownVehicles.values()) {
      if (v.form === 'SCOOTER') scooters++;
      else if (v.form === 'BICYCLE') bikes++;
      else if (v.form === 'CAR') cars++;
    }

    return {
      totalFloating: this.knownVehicles.size,
      totalStations: this.knownStations.size,
      totalAvailableScooters: scooters,
      totalAvailableBikes: bikes,
      totalAvailableCars: cars,
      activeInTripCount: this.activeTrips.size,
      completedTripsCount: this.completedTrips.length,
      recentTrips: this.completedTrips.slice(0, 15)
    };
  }

  public getRecentCompletedTrips(): CompletedTripRecord[] {
    return this.completedTrips.slice(0, 20);
  }

  public getActiveTrips(): InferredActiveTrip[] {
    return Array.from(this.activeTrips.values());
  }

  public getRecentStationDeltas(): StationDelta[] {
    return this.recentStationDeltas.slice(0, 20);
  }
}
