import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

export interface GtfsRtVehicle {
  id: string;
  originalId: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  hasHeading: boolean;
  name: string;
  type: 'train' | 'bus' | 'tram' | 'subway';
  route: string;
  destination: string;
  operator: string;
  agency: string;
  agencyKey: 'oebb' | 'vor' | 'mav' | 'bkk' | 'hzpp';
  country: 'AT' | 'HU' | 'HR';
  feedSource: string;
  protocol: 'protobuf';
  timestamp: string | number;
  tripId?: string;
  delay?: number;
}

export interface GtfsFeedConfig {
  key: 'oebb' | 'vor' | 'mav' | 'bkk' | 'hzpp';
  name: string;
  agency: string;
  country: 'AT' | 'HU' | 'HR';
  url: string;
  prefix: string;
  defaultType: 'train' | 'bus' | 'tram' | 'subway';
}

export const GTFS_RT_FEEDS: GtfsFeedConfig[] = [
  {
    key: 'oebb',
    name: 'ÖBB Regional & InterCity (Austria)',
    agency: 'ÖBB-Personenverkehr',
    country: 'AT',
    url: '/api/gtfs-rt/oebb',
    prefix: 'at_oebb_',
    defaultType: 'train'
  },
  {
    key: 'vor',
    name: 'VOR Ost-Region & Regionalbus (Austria)',
    agency: 'VOR (Verkehrsverbund Ost-Region)',
    country: 'AT',
    url: '/api/gtfs-rt/vor',
    prefix: 'at_vor_',
    defaultType: 'train'
  },
  {
    key: 'hzpp',
    name: 'HŽPP Hrvatske željeznice (Croatia)',
    agency: 'HŽ Putnički prijevoz',
    country: 'HR',
    url: '/api/gtfs-rt/hzpp',
    prefix: 'hr_hzpp_',
    defaultType: 'train'
  },
  {
    key: 'mav',
    name: 'MÁV-START Vasúti közlekedés (Hungary)',
    agency: 'MÁV-START Zrt.',
    country: 'HU',
    url: '/api/gtfs-rt/mav',
    prefix: 'hu_mav_',
    defaultType: 'train'
  },
  {
    key: 'bkk',
    name: 'BKK Budapesti Közlekedési Központ (Hungary)',
    agency: 'BKK Budapest',
    country: 'HU',
    url: '/api/gtfs-rt/bkk',
    prefix: 'hu_bkk_',
    defaultType: 'tram'
  }
];

export class GtfsRealtimeIngestionService {
  private static instance: GtfsRealtimeIngestionService;
  private cachedVehicles: Map<string, GtfsRtVehicle> = new Map();
  private lastFetchTimestamp = 0;
  private isFetching = false;
  private feedStats: Record<string, { count: number; lastUpdated: string; status: 'ok' | 'error' }> = {};

  private constructor() {}

  public static getInstance(): GtfsRealtimeIngestionService {
    if (!GtfsRealtimeIngestionService.instance) {
      GtfsRealtimeIngestionService.instance = new GtfsRealtimeIngestionService();
    }
    return GtfsRealtimeIngestionService.instance;
  }

  /**
   * Periodically fetches and parses binary GTFS-Realtime protobuf streams
   */
  public async ingestFeeds(force = false): Promise<GtfsRtVehicle[]> {
    const now = Date.now();
    // Cache for at least 3 seconds between fetches unless forced
    if (!force && now - this.lastFetchTimestamp < 3000 && this.cachedVehicles.size > 0) {
      return Array.from(this.cachedVehicles.values());
    }

    if (this.isFetching && this.cachedVehicles.size > 0) {
      return Array.from(this.cachedVehicles.values());
    }

    this.isFetching = true;

    try {
      const feedPromises = GTFS_RT_FEEDS.map(async feed => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const response = await fetch(feed.url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/x-protobuf, application/octet-stream, */*'
            }
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} from ${feed.url}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            return [];
          }

          const decoded = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(arrayBuffer));
          const vehicles: GtfsRtVehicle[] = [];

          if (decoded.entity && Array.isArray(decoded.entity)) {
            for (const entity of decoded.entity) {
              const v = entity.vehicle;
              if (!v || !v.position) continue;

              const lat = v.position.latitude;
              const lon = v.position.longitude;

              if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) continue;

              const rawId = entity.id || v.vehicle?.id || v.trip?.tripId || `ent_${Math.random()}`;
              // Map to guaranteed unique namespace, strictly separate from SŽ-Infrastruktura
              const uniqueId = `${feed.prefix}${rawId}`;

              const speedMs = v.position.speed ?? 0;
              const speedKmH = Math.round(speedMs * 3.6);
              const bearing = Math.round(v.position.bearing ?? 0);

              let mode: 'train' | 'bus' | 'tram' | 'subway' = feed.defaultType;
              const routeName = v.trip?.routeId || v.vehicle?.label || '';
              const upperRoute = routeName.toUpperCase();

              if (feed.key === 'bkk') {
                if (upperRoute.startsWith('M') || upperRoute.includes('METRO')) mode = 'subway';
                else if (upperRoute.includes('VILLAMOS') || /^[1-6][0-9]?$/.test(routeName)) mode = 'tram';
                else mode = 'bus';
              } else if (feed.key === 'vor') {
                if (upperRoute.startsWith('CJX') || upperRoute.startsWith('S') || upperRoute.startsWith('R')) mode = 'train';
                else if (upperRoute.includes('BUS') || upperRoute.startsWith('B')) mode = 'bus';
              } else if (feed.key === 'mav' || feed.key === 'oebb' || feed.key === 'hzpp') {
                mode = 'train';
              }

              const vehicleObj: GtfsRtVehicle = {
                id: uniqueId,
                originalId: String(rawId),
                lat,
                lon,
                speed: speedKmH,
                heading: bearing,
                hasHeading: typeof v.position.bearing === 'number',
                name: v.vehicle?.label || v.trip?.routeId || `${feed.agency} #${rawId}`,
                type: mode,
                route: v.trip?.routeId || '',
                destination: (v as any).destination || (v.trip as any)?.directionId != null ? `Smer ${(v.trip as any).directionId}` : 'Regionalni promet',
                operator: feed.agency,
                agency: feed.name,
                agencyKey: feed.key,
                country: feed.country,
                feedSource: 'GTFS-Realtime Protobuf',
                protocol: 'protobuf',
                timestamp: v.timestamp ? (typeof v.timestamp === 'number' ? v.timestamp * 1000 : Number(v.timestamp) * 1000) : Date.now(),
                tripId: v.trip?.tripId || undefined
              };

              vehicles.push(vehicleObj);
            }
          }

          this.feedStats[feed.key] = {
            count: vehicles.length,
            lastUpdated: new Date().toISOString(),
            status: 'ok'
          };

          return vehicles;
        } catch (err) {
          this.feedStats[feed.key] = {
            count: 0,
            lastUpdated: new Date().toISOString(),
            status: 'error'
          };
          return [];
        }
      });

      const results = await Promise.all(feedPromises);
      const newMap = new Map<string, GtfsRtVehicle>();

      for (const list of results) {
        for (const item of list) {
          newMap.set(item.id, item);
        }
      }

      this.cachedVehicles = newMap;
      this.lastFetchTimestamp = Date.now();
      return Array.from(this.cachedVehicles.values());
    } finally {
      this.isFetching = false;
    }
  }

  public getCachedVehicles(): GtfsRtVehicle[] {
    return Array.from(this.cachedVehicles.values());
  }

  public getFeedStats() {
    return this.feedStats;
  }
}
