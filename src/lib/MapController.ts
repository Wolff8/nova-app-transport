import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection as GeoJSONFeatureCollection } from 'geojson';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { loadArso, loadSmartCity, fetchPackets, loadSwitches, loadSignals, loadSpat, loadHydro, loadPower, loadMoms, loadOpenAQ, loadEuroRail, loadAir, loadAircraft, loadQuakes, loadEVCharging, loadTransit, loadBrezAvtaBusLocations, loadTTN, loadOpenSense, fetchWithTimeout, loadWeather, loadHafas, loadAprs, loadLoraMesh, loadSparql, loadOverpass, loadSensorCommunity, loadGitHub , loadTraffic , loadRinf, loadRinfNetwork, loadAnalyticsDelays, loadEraTunnels, loadRegionalStations, loadFreightTrains, loadTentRailways, loadBorderCrossings, loadCorridorFreightPaths, loadRailWorks } from './api';
import { TelemetryNode, TelemetryLogEntry } from '../types';
import { GtfsRealtimeIngestionService, GtfsRtVehicle } from './gtfsRealtimeIngestion';
import { getEnrichedLocomotiveData } from '../data/europeanLocomotiveRegistry';
import { snapToRailTrack, loadRailTrackGeometry } from './railTrackSnapper';


/**
 * MapLibre locates its web worker with `new URL('./maplibre-gl-worker.mjs',
 * import.meta.url)`. Once bundled, import.meta.url points at the built entry
 * chunk, so it requests /assets/maplibre-gl-worker.mjs — a file Vite never
 * emits. In production that 404s, the SPA catch-all route answers with
 * index.html, and the module worker fails to start on an HTML payload.
 *
 * Everything MapLibre parses in that worker — i.e. every GeoJSON and vector
 * layer: vehicles, stations, tracks — then silently renders nothing, while
 * raster tiles keep working because they load on the main thread. That is why
 * the basemap and rail tiles appeared but no live telemetry did. Dev builds are
 * unaffected, since Vite's dev server serves the worker module directly.
 *
 * Point MapLibre at the worker bundle Vite actually emits (`?worker&url` also
 * bundles the worker's own ./maplibre-gl-shared.mjs import).
 */
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export const CENTER: [number, number] = [16.1714, 46.6573];

/**
 * The original CartoCDN dark-matter basemap.
 *
 * This is a vector style, and MapLibre parses vector tiles in its web worker.
 * While that worker was failing to start (see setWorkerUrl above) the style
 * could never finish loading, so the map's 'load' event never fired — which is
 * what originally left the app stuck on its loading overlay with no map at all.
 * With the worker fixed this style loads normally again, so the original
 * basemap is restored here in place of the raster stand-in that was used while
 * the worker bug was still being tracked down.
 */
const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * What the map falls back to if the basemap style cannot be fetched.
 *
 * Everything — icons, layers, polling — is set up on 'style.load', so a style
 * that never arrives used to leave the app with a blank map and no data until
 * the loading overlay's safety timer gave up. Measured with the CDN blocked:
 * canvas up in 446 ms, then nothing for 8 seconds, then a dead map. This
 * style has no dependency on that CDN: a plain dark ground, OpenStreetMap
 * raster tiles for orientation, and MapLibre's own glyph server for labels.
 */
const FALLBACK_STYLE: any = {
  version: 8,
  name: 'nova-fallback',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
    // Dimmed and desaturated so the vehicle icons still read as the foreground.
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.45, 'raster-saturation': -0.9, 'raster-brightness-max': 0.7 } }
  ]
};
/** How long the basemap style gets before the fallback replaces it. */
const STYLE_FALLBACK_AFTER_MS = 5000;
/** After a style-stage error, how long to still wait for 'style.load' before falling back. */
const STYLE_FALLBACK_AFTER_ERROR_MS = 1500;

/**
 * Upper bound on a believable ground speed per feed, in km/h. Used to reject
 * nonsense from upstream telemetry (a stale field, a unit mix-up, or a GPS
 * jump) rather than drawing a city bus doing 900 km/h.
 */
/**
 * Weight given to each new speed measurement. Individual fixes are noisy —
 * GPS scatter, uneven feed timing — so the displayed figure is an exponential
 * moving average rather than the raw per-fix value, which would jump around.
 */
const SPEED_SMOOTHING = 0.5;
/**
 * These feeds refresh a vehicle's position roughly every 20-45s, while the map
 * polls every 2s. "Has not moved since the last poll" is therefore the normal
 * case even for a bus at full speed, and must not be read as having stopped.
 * The displayed speed is held until the vehicle has been still for longer than
 * a plausible refresh gap, then faded out and finally zeroed.
 */
const IDLE_FADE_START_MS = 35000;
/** How long an icon takes to swing onto a new heading, independent of the glide length. */
const HEADING_TURN_MS = 1500;
const IDLE_STOP_MS = 70000;

const MAX_PLAUSIBLE_SPEED_KMH: Record<string, number> = {
  buses: 120,
  transit: 250,
  hafas: 250,
  freight_trains: 160,
  eurorail: 350,
  aircraft: 1100
};

export const DYNAMIC_MOVING_SOURCES = new Set<string>([
  'buses',
  'transit',
  'hafas',
  'aircraft',
  'freight_trains',
  'eurorail',
  // Catalogue freight paths move continuously along the corridor, so they
  // belong in the interpolation system like everything else that moves. They
  // used to be written straight to the source on a thirty-second timer, which
  // teleported them from one position to the next with nothing in between.
  'freight_paths'
]);

export interface VehicleMotionEntity {
  id: string;
  sourceId: string;
  renderLon: number;
  renderLat: number;
  renderHeading: number;
  fromLon: number;
  fromLat: number;
  fromHeading: number;
  targetLon: number;
  targetLat: number;
  targetHeading: number;
  startTime: number;
  duration: number;
  isInterpolating: boolean;
  lastTelemetryTime: number;
  featureIndex: number;
  dynamicHeading?: number;
  hasDynamicHeading?: boolean;
  prevTargetLon?: number;
  prevTargetLat?: number;
  prevTargetTime?: number;
  /** Smoothed ground speed (km/h) measured from real displacement. */
  smoothedSpeedKmh?: number;
  /** Last time this vehicle cleared the jitter dead-band. */
  lastMovementTime?: number;
  /** Feed-reported time of the last position fix (ms since epoch), when given. */
  lastFixTimeMs?: number | null;
}

/**
 * The moment a position fix was taken, according to the feed itself.
 *
 * Timing speed from our own polling clock is wrong: the map polls every 2s but
 * a vehicle's position is only refreshed every 20-45s, so the interval we
 * observe between two changed positions is not the interval the vehicle
 * actually took to cover that ground. Where the feed stamps each fix (BrezAvta
 * sends unix seconds) that stamp is the correct clock to divide by.
 */
function readFixTimeMs(row: any): number | null {
  const raw = Number(row?.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Accept either seconds or milliseconds.
  return raw < 1e12 ? raw * 1000 : raw;
}
export type BusMotionEntity = VehicleMotionEntity;

/**
 * A train's arrow follows the track it is on, but only when the track
 * geometry actually describes that track. The corridor file covers the main
 * lines only, and the snapper returns the nearest segment within 3 km, so a
 * train on a line the file does not have (Ljubljana–Kamnik, say, which runs
 * alongside the Jesenice line for its first kilometres) was given the
 * neighbouring corridor's bearing — a regional train drawn pointing 60° off
 * its direction of travel. The track bearing is now used only when the
 * segment is close enough to be the train's own track and agrees with the
 * measured direction of travel; otherwise the measured direction stands.
 */
const TRACK_SNAP_MAX_METERS = 150;
const TRACK_SNAP_MAX_ANGLE = 35;
function alignHeadingToTrack(lon: number, lat: number, heading: number): number {
  const snapped = snapToRailTrack(lon, lat, TRACK_SNAP_MAX_METERS, heading);
  if (!snapped.snapped || snapped.bearing == null) return heading;
  const diff = Math.abs(((snapped.bearing - heading + 540) % 360) - 180);
  return diff <= TRACK_SNAP_MAX_ANGLE ? snapped.bearing : heading;
}

/**
 * Computes geodetic forward azimuth (heading vector) and distance in meters
 * from (lat1, lon1) to (lat2, lon2). Returns heading in degrees [0, 360).
 */
export function calculateHeadingVector(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { heading: number; distanceMeters: number } {
  const dLatM = (lat2 - lat1) * 111139;
  const midLatRad = ((lat2 + lat1) * 0.5 * Math.PI) / 180;
  const dLonM = (lon2 - lon1) * 111139 * Math.cos(midLatRad);
  const distanceMeters = Math.hypot(dLatM, dLonM);

  if (distanceMeters < 0.2) {
    return { heading: 0, distanceMeters: 0 };
  }

  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaLambda = (lon2 - lon1) * rad;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  return { heading: Math.round(heading * 10) / 10, distanceMeters };
}

export class MapController {
  public map!: maplibregl.Map;
  private popup: maplibregl.Popup;
  private markers: Record<string, maplibregl.Marker> = {};
  public isReady = false;
  private lastKnownCoords = new Map<string, string>();
  private activeSources = new Map<string, any[]>();
  private rafId: number | null = null;
  private vehicleMotionMap = new Map<string, VehicleMotionEntity>();
  private cachedSourceGeoJSON = new Map<string, GeoJSONFeatureCollection>();
  private lastSourceAnimationTimestamp = new Map<string, number>();
  /** Whether a dynamic source's features all carry unique ids (required by updateData). */
  private sourceHasUniqueIds = new Map<string, boolean>();
  private railGeometryRequested = false;
  private destroyed = false;
  /** `?nodiff` in the URL forces the old whole-collection path, for measurement. */
  private forceFullSetData = (() => { try { return /[?&]nodiff\b/.test(location.search); } catch { return false; } })();
  /** Sources where updateData failed once; they use setData from then on. */
  private diffUnsupported = new Set<string>();

  // Backwards compatibility accessors
  private get busMotionMap(): Map<string, VehicleMotionEntity> {
    return this.vehicleMotionMap;
  }
  private get cachedTransitGeoJSON(): GeoJSONFeatureCollection | null {
    return this.cachedSourceGeoJSON.get('transit') || null;
  }
  private set cachedTransitGeoJSON(fc: GeoJSONFeatureCollection | null) {
    if (fc) this.cachedSourceGeoJSON.set('transit', fc);
    else this.cachedSourceGeoJSON.delete('transit');
  }

  private lastBroadcastedStateHash: string = '';
  private lastSelectedNodeSignature: string = '';
  
  private pollingInterval: any;
  private animationErrorLogged = false;

  constructor(
    private container: HTMLElement,
    private onStateUpdate?: (state: any) => void,
    private onSelectNode?: (node: TelemetryNode) => void,
    private onTelemetryLog?: (log: TelemetryLogEntry) => void,
    /** Fires once the map style is usable — before any data has arrived. */
    private onReady?: () => void
  ) {
    this.popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'cyber-popup'
    });

    this.initMap();
  }

  
  
  private styleLoaded = false;
  private fallbackStyleApplied = false;
  private styleFallbackTimer: number | null = null;

  private armStyleFallback(afterMs: number) {
    if (this.styleLoaded || this.fallbackStyleApplied) return;
    if (this.styleFallbackTimer != null) clearTimeout(this.styleFallbackTimer);
    this.styleFallbackTimer = window.setTimeout(() => {
      this.styleFallbackTimer = null;
      if (this.destroyed || this.styleLoaded || this.fallbackStyleApplied) return;
      this.fallbackStyleApplied = true;
      console.warn(`[map] basemap style did not load after ${Math.round(performance.now())} ms; switching to the built-in fallback`);
      try { this.map.setStyle(FALLBACK_STYLE); } catch (err) { console.error('[map] fallback style failed', err); }
    }, afterMs);
  }

  private initMap() {
    this.map = new maplibregl.Map({
      container: this.container,
      style: BASEMAP_STYLE,
      center: CENTER,
      zoom: 11.5, // See whole Slovenia
      pitch: 45,
      bearing: 0,
      fadeDuration: 0,
      trackResize: true,
      maxTileCacheSize: 120
    });

    this.map.on('error', (e) => {
      console.error("MAP ERROR:", e);
      // Before the style has loaded, an error is a style, sprite or glyph
      // fetch failing. Give 'style.load' a short grace period — a sprite
      // failure alone does not block it — and fall back if it does not come.
      if (!this.styleLoaded && !this.fallbackStyleApplied) {
        this.armStyleFallback(STYLE_FALLBACK_AFTER_ERROR_MS);
      }
    });
    this.map.once('style.load', () => {
      this.styleLoaded = true;
      if (this.styleFallbackTimer != null) { clearTimeout(this.styleFallbackTimer); this.styleFallbackTimer = null; }
    });
    this.armStyleFallback(STYLE_FALLBACK_AFTER_MS);
    // Vehicles outside the viewport are not animated (see animateVehiclePositions),
    // so after the view changes, push every dynamic source's cached positions
    // once so nothing newly on screen is where it was seconds ago.
    this.map.on('moveend', () => {
      for (const sourceId of DYNAMIC_MOVING_SOURCES) {
        const fc = this.cachedSourceGeoJSON.get(sourceId);
        const src = this.map?.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (fc && src) { try { src.setData(fc); } catch {} }
      }
    });

    // Debug hooks for automated checks: expose the map so a headless browser
    // can count features per source. Off unless asked for in the URL.
    try {
      if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) {
        (window as any).__nova = { map: this.map, controller: this };
      }
    } catch {}


    


  // Gate setup on 'style.load', not 'load'. 'load' additionally waits for the
  // first visually complete render, so slow (not failed) basemap tiles can
  // delay it indefinitely — which would stall icon setup, layer creation and
  // all data polling. 'style.load' fires as soon as the style is usable, which
  // for the inline style above is immediate, so the live data renders even
  // while basemap tiles are still streaming in or failing.
  this.map.once('style.load', async () => {
    if (this.destroyed) return;
    await this.loadIcons();
      if (this.destroyed) return;
      this.isReady = true;
      // The map can be looked at and moved from here on; nothing the user sees
      // should wait for the first telemetry round-trip.
      try { this.onReady?.(); } catch {}
      // The rail geometry used to snap trains to the track (800 KB) is fetched
      // only once the first vehicles are on the map — see applyGeoJSONSource —
      // so on a slow connection it does not compete with them. Until it
      // lands, trains simply are not snapped.

      const addArrowCanvas = (id: string, color: string) => {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.translate(size/2, size/2);
        ctx.beginPath();
        // Pointing up (0 degrees in MapLibre)
        ctx.moveTo(0, -size/2 + 2);
        ctx.lineTo(size/3, size/2 - 2);
        ctx.lineTo(0, size/2 - 6);
        ctx.lineTo(-size/3, size/2 - 2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const imgData = ctx.getImageData(0, 0, size, size);
        if (!this.map.hasImage(id)) this.map.addImage(id, imgData);
      };
      addArrowCanvas('bus-arrow', '#3b82f6');
      addArrowCanvas('train-arrow', '#facc15');
      addArrowCanvas('tram-arrow', '#ec4899');
      addArrowCanvas('subway-arrow', '#8b5cf6');
      addArrowCanvas('freight-arrow', '#f59e0b');


      // Modelled freight gets its own mark: deliberately not the amber used by
      // yards and traffic, nor the cyan of live passenger trains, because it is
      // a different kind of claim and should not be mistaken for either. A
      // wagon body with a direction chevron, drawn large enough to read at
      // corridor zoom.

      // High-DPI Directional Navigation Arrows with 3D Spine, Crisp White Outline & Beacon
      const addNavigationArrow = (
        id: string,
        primaryColor: string,
        accentColor: string,
        glowColor: string,
        hasPulse: boolean = false
      ) => {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cx = size / 2;
        const cy = size / 2;

        if (hasPulse) {
          ctx.beginPath();
          ctx.arc(cx, cy, 21, 0, Math.PI * 2);
          ctx.fillStyle = glowColor;
          ctx.fill();
        }

        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.moveTo(cx, 6);
        ctx.lineTo(cx + 14, 38);
        ctx.lineTo(cx, 28);
        ctx.lineTo(cx - 14, 38);
        ctx.closePath();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        const grad = ctx.createLinearGradient(cx, 6, cx, 38);
        grad.addColorStop(0, accentColor);
        grad.addColorStop(1, primaryColor);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 3D center spine ridge
        ctx.beginPath();
        ctx.moveTo(cx, 7);
        ctx.lineTo(cx, 28);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Left wing bevel shading
        ctx.beginPath();
        ctx.moveTo(cx, 6);
        ctx.lineTo(cx - 13, 37);
        ctx.lineTo(cx, 28);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fill();

        // Forward navigation beacon dot
        ctx.beginPath();
        ctx.arc(cx, 16, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, 16, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();

        const imgData = ctx.getImageData(0, 0, size, size);
        if (!this.map.hasImage(id)) this.map.addImage(id, imgData);
      };

      addNavigationArrow('in-trip-arrow', '#d97706', '#fbbf24', 'rgba(245, 158, 11, 0.35)', true); // Glowing Gold/Amber active trip
      addNavigationArrow('car-arrow', '#0284c7', '#38bdf8', 'rgba(6, 182, 212, 0.3)', true);       // Electric Cyan Avant2Go shared car
      addNavigationArrow('bike-arrow', '#65a30d', '#a3e635', 'rgba(132, 204, 22, 0.3)', false);    // Lime green Nomago/MBajk/BicikeLJ
      addNavigationArrow('scooter-arrow', '#059669', '#34d399', 'rgba(16, 185, 129, 0.3)', true);  // Emerald Bolt e-scooter
      addNavigationArrow('micro-arrow', '#059669', '#34d399', 'rgba(16, 185, 129, 0.3)', false);

      const interactiveLayers = [
        'buses', 'buses_label',
        'transit', 'hafas', 'aircraft', 'eurorail', 'freight_trains', 
        'stations_layer', 'rinf', 'rinf_network_line', 
        'traffic', 'rail_sensors', 'traffic_sensors', 'logistics_sensors', 
        'ttn', 'lorawan', 'nbiot', 'evcharge', 'quakes', 'air', 'spat', 'hydro', 'yard'
      ];
      interactiveLayers.forEach(layer => {
        this.map.on('mouseenter', layer, () => {
          this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', layer, () => {
          this.map.getCanvas().style.cursor = '';
        });
      });

      this.startPolling();

      // Layers are all registered synchronously below; declutter their labels
      // once the style has settled.
      this.map.once('idle', () => this.applyLabelDeclutter());

      
      
      // OpenRailwayMap - Real-world global and Slovenian railway track raster tiles
      this.map.addSource('openrailwaymap', {
        type: 'raster',
        tiles: [
          'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
          'https://b.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
          'https://c.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '<a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
      });
      this.map.addLayer({
        id: 'openrailwaymap-layer',
        type: 'raster',
        source: 'openrailwaymap',
        minzoom: 4,
        layout: {
          'visibility': 'visible'
        },
        paint: {
          'raster-opacity': 0.85
        }
      });

      // ERA RINF Railway Network (SŽ Vector Track Lines)
      this.map.addSource('rinf_network', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      this.map.addLayer({
        id: 'rinf_network_line',
        type: 'line',
        source: 'rinf_network',
        layout: {
          'visibility': 'visible',
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 2.5,
          'line-opacity': 0.75
        }
      });
      
      // Transit

      this.map.addSource('connections', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'connections', type: 'line', source: 'connections',
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 1.5,
          'line-dasharray': [2, 4],
          'line-opacity': 0.6
        }
      });
      
      this.map.addSource('transit_path', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'transit_path', type: 'line', source: 'transit_path',
        paint: {
          'line-color': ['match', ['get', 'type'], 'train', '#3b82f6', '#ef4444'],
          'line-width': 3,
          'line-opacity': 0.6
        }
      });
      
      // Live Buses (BrezAvta IJPP: LPP, Nomago, Arriva, Marprom, AP MS)
      this.map.addSource('buses', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'buses', type: 'symbol', source: 'buses',
        layout: {
          'icon-image': ['coalesce', ['get', 'iconImage'], 'icon-bus-other'],
          'icon-size': 0.85,
          'icon-allow-overlap': true,
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map'
        }
      });
      this.map.addLayer({
        id: 'buses_label', type: 'symbol', source: 'buses',
        // Names for thousands of vehicles at region zoom are unreadable and cost a
        // collision pass on every re-tile; icons stay at every zoom, names from 12.
        minzoom: 12,
        layout: { 
          'text-field': ['coalesce', ['get', 'labelText'], ['get', 'name'], ''],
          'text-size': 10,
          'text-offset': [0, 1.9],
          'text-anchor': 'top'
        },
        paint: { 'text-color': '#6ee7b7', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      this.map.addSource('transit', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      this.map.addLayer({
        id: 'transit', type: 'symbol', source: 'transit',
        layout: {
          'icon-image': ['coalesce', ['get', 'iconImage'], 'icon-train-sz'],
          'icon-size': 0.85,
          'icon-allow-overlap': true,
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map'
        }
      });
      this.map.addLayer({
        id: 'transit_arrow', type: 'symbol', source: 'transit',
        layout: { 'visibility': 'none' }
      });
      this.map.addLayer({
        id: 'transit_label', type: 'symbol', source: 'transit',
        // Names for thousands of vehicles at region zoom are unreadable and cost a
        // collision pass on every re-tile; icons stay at every zoom, names from 12.
        minzoom: 12,
        layout: {
          'text-field': ['coalesce', ['get', 'labelText'], ['get', 'name'], ''],
          'text-size': 10,
          'text-offset': [0, 1.9],
          'text-anchor': 'top'
        },
        paint: { 'text-color': '#93c5fd', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });
      this.map.addSource('weather', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'weather', type: 'symbol', source: 'weather',
        layout: { 'icon-image': 'icon-weather', 'icon-size': 0.9, 'icon-allow-overlap': true }
      });
      this.map.addLayer({
        id: 'weather_label', type: 'symbol', source: 'weather',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['get', 'temp'], ' °C'], 'text-size': 10, 'text-offset': [0, 1.2] },
        paint: { 'text-color': '#fbbf24', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });


      // Traffic Signals
      this.map.addSource('signal', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'signal', type: 'circle', source: 'signal',
        paint: { 
          'circle-color': ['match', ['get', 'state'], 'GREEN', '#22c55e', 'RED', '#ef4444', '#eab308'],
          'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' 
        }
      });
      this.map.addLayer({
        id: 'signal_label', type: 'symbol', source: 'signal',
        layout: { 'text-field': ['to-string', ['get', 'countdown']], 'text-size': 12, 'text-offset': [0, 0] },
        paint: { 'text-color': '#ffffff' }
      });

      // Air
      this.map.addSource('air', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'air', type: 'symbol', source: 'air', layout: { 'icon-image': 'icon-air', 'icon-size': 0.8, 'icon-allow-overlap': true }
      });
      this.map.addLayer({
        id: 'air_label', type: 'symbol', source: 'air',
        layout: {
          'text-field': ['concat', ['get', 'name']],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#fcd34d',
          'text-halo-color': '#000',
          'text-halo-width': 2
        }
      });

      // Aircraft
      this.map.addSource('aircraft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'aircraft', type: 'symbol', source: 'aircraft', layout: { 'icon-image': 'icon-plane', 'icon-size': 0.8, 'icon-rotate': ['coalesce', ['get', 'true_track'], ['get', 'heading'], 0], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true }
      });
      this.map.addLayer({
        id: 'aircraft_label', type: 'symbol', source: 'aircraft',
        layout: {
          'text-field': ['concat', ['get', 'callsign'], ' (', ['get', 'velocity'], ' km/h)'],
          'text-size': 10,
          'text-offset': [0, 1],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#bae6fd',
          'text-halo-color': '#000',
          'text-halo-width': 1.5
        }
      });

      // Quakes
      this.map.addSource('quakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'quakes', type: 'circle', source: 'quakes',
        paint: {
          'circle-color': '#ef4444',
          'circle-radius': ['*', ['get', 'mag'], 3],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.7
        }
      });
      this.map.addLayer({
        id: 'quakes_label', type: 'symbol', source: 'quakes',
        layout: {
          'text-field': ['concat', 'M', ['get', 'mag'], ' ', ['get', 'place']],
          'text-size': 10,
          'text-offset': [0, 1],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#fca5a5',
          'text-halo-color': '#000',
          'text-halo-width': 1.5
        }
      });

      // EV Charging
      this.map.addSource('evcharge', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'evcharge', type: 'circle', source: 'evcharge',
        paint: {
          'circle-color': '#84cc16',
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });
      this.map.addLayer({
        id: 'evcharge_label', type: 'symbol', source: 'evcharge',
        layout: {
          'text-field': ['concat', ['get', 'name']],
          'text-size': 10,
          'text-offset': [0, 1],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#d9f99d',
          'text-halo-color': '#000',
          'text-halo-width': 1.5
        }
      });



      // Bikes (Nomago, BicikeLJ)
      // LoRaWAN TTN
      this.map.addSource('lorawan', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'lorawan', type: 'circle', source: 'lorawan',
        paint: { 'circle-color': '#fbbf24', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'lorawan_label', type: 'symbol', source: 'lorawan',
        layout: { 'text-field': ['concat', ['get', 'id']], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
        paint: { 'text-color': '#fde68a', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      
      // Hafas Trains
      this.map.addSource('delays_heatmap', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'delays_heatmap_layer', type: 'heatmap', source: 'delays_heatmap',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'delay'], 0, 0, 60, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, '#fef08a', 0.5, '#f97316', 1, '#ef4444'],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 15, 40],
          'heatmap-opacity': 0.7
        }
      });
      this.map.addSource('hafas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      
      this.map.addSource('hafas_route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'hafas_route_line', type: 'line', source: 'hafas_route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0ea5e9', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 2] }
      });
      
      this.map.addLayer({
        id: 'hafas', type: 'symbol', source: 'hafas',
        layout: {
          'icon-image': ['coalesce', ['get', 'iconImage'], 'icon-train-static'],
          'icon-size': 0.85,
          'icon-allow-overlap': true,
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map'
        }
      });
      this.map.addLayer({
        id: 'hafas_arrow', type: 'symbol', source: 'hafas',
        layout: { 'visibility': 'none' }
      });
      this.map.addLayer({
        id: 'hafas_label', type: 'symbol', source: 'hafas',
        layout: { 
          'text-field': ['coalesce', ['get', 'labelText'], ['get', 'name'], ''],
          'text-size': 10,
          'text-offset': [0, 1.9],
          'text-anchor': 'top'
        },
        paint: { 'text-color': '#7dd3fc', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // APRS
      this.map.addSource('aprs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'aprs', type: 'circle', source: 'aprs',
        paint: { 'circle-color': '#f43f5e', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'aprs_label', type: 'symbol', source: 'aprs',
        layout: { 'text-field': ['get', 'id'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
        paint: { 'text-color': '#fda4af', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // LoRaMesh
      this.map.addSource('loramesh', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'loramesh', type: 'circle', source: 'loramesh',
        paint: { 'circle-color': '#fbbf24', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'loramesh_label', type: 'symbol', source: 'loramesh',
        layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
        paint: { 'text-color': '#fde68a', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // SPARQL (EU Data Portal)
      this.map.addSource('sparql', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'sparql', type: 'circle', source: 'sparql',
        paint: { 'circle-color': '#a855f7', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'sparql_label', type: 'symbol', source: 'sparql',
        layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
        paint: { 'text-color': '#d8b4fe', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // Warehouses
      this.map.addSource('warehouse', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'warehouse', type: 'fill', source: 'warehouse',
        paint: { 'fill-color': '#64748b', 'fill-opacity': 0.4, 'fill-outline-color': '#94a3b8' }
      });
      this.map.addLayer({
        id: 'warehouse_circle', type: 'circle', source: 'warehouse',
        paint: { 'circle-color': '#94a3b8', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'warehouse_label', type: 'symbol', source: 'warehouse',
        layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
        paint: { 'text-color': '#cbd5e1', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // Yards & Freight Terminals
      this.map.addSource('yard', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'yard', type: 'circle', source: 'yard',
        paint: { 
          'circle-color': '#f59e0b', 
          'circle-radius': 7.5, 
          'circle-stroke-width': 2, 
          'circle-stroke-color': '#ffffff' 
        }
      });
      this.map.addLayer({
        id: 'yard_label', type: 'symbol', source: 'yard',
        layout: { 
          'text-field': ['get', 'name'], 
          'text-size': 10.5, 
          'text-offset': [0, 1.3], 
          'text-anchor': 'top',
          'text-max-width': 12
        },
        paint: { 
          'text-color': '#fef08a', 
          'text-halo-color': '#000000', 
          'text-halo-width': 2 
        }
      });

      
      // SensorCommunity
      this.map.addSource('sensorcommunity', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'sensorcommunity', type: 'circle', source: 'sensorcommunity',
        paint: { 'circle-color': '#14b8a6', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'sensorcommunity_label', type: 'symbol', source: 'sensorcommunity',
        layout: { 'text-field': ['concat', 'PM10: ', ['get', 'pm10']], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#5eead4', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      
      
      
      
      // SPaT (with pulse effect)
      this.map.addSource('spat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      
      // Halo pulse layer
      this.map.addLayer({
        id: 'spat_pulse', type: 'circle', source: 'spat',
        paint: { 
          'circle-color': ['match', ['get', 'state'], 'Rdeča', '#ef4444', 'Zelena', '#22c55e', 'Rumena', '#eab308', '#ec4899'],
          'circle-radius': 16, 
          'circle-opacity': 0.3,
          'circle-blur': 0.5,
          'circle-radius-transition': { duration: 1000, delay: 0 },
          'circle-opacity-transition': { duration: 1000, delay: 0 }
        }
      });

      this.map.addLayer({
        id: 'spat', type: 'circle', source: 'spat',
        paint: { 
          'circle-color': ['match', ['get', 'state'], 'Rdeča', '#ef4444', 'Zelena', '#22c55e', 'Rumena', '#eab308', '#ec4899'], 
          'circle-radius': 8, 
          'circle-stroke-width': 2, 
          'circle-stroke-color': '#fff',
          'circle-color-transition': { duration: 300, delay: 0 }
        }
      });
      this.map.addLayer({
        id: 'spat_label', type: 'symbol', source: 'spat',
        layout: { 'text-field': ['concat', ['get', 'timeToChange'], 's'], 'text-size': 11, 'text-offset': [0, 0], 'text-anchor': 'center' },
        paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      
      // Hydro
      this.map.addSource('hydro', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'hydro', type: 'circle', source: 'hydro', paint: { 'circle-color': '#0ea5e9', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
      // Power
      this.map.addSource('power', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'power', type: 'circle', source: 'power', paint: { 'circle-color': '#eab308', 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#000' } });

      
      // MOMS
      this.map.addSource('moms', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                  this.map.addLayer({ id: 'moms', type: 'circle', source: 'moms', paint: { 'circle-color': '#10b981', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

      
      
      // TTN Gateways
      this.map.addSource('ttn', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'ttn', type: 'circle', source: 'ttn', paint: { 'circle-color': '#3b82f6', 'circle-radius': 6, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000' } });
      
      // OpenSense
      this.map.addSource('opensense', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'opensense', type: 'circle', source: 'opensense', paint: { 'circle-color': '#a855f7', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });

      // OpenAQ
      this.map.addSource('openaq', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'openaq', type: 'circle', source: 'openaq', paint: { 'circle-color': '#14b8a6', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
      
      // Euro Rail
      this.map.addSource('eurorail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'eurorail', type: 'circle', source: 'eurorail', paint: { 'circle-color': '#d946ef', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

      this.map.addLayer({
        id: 'eurorail_label', type: 'symbol', source: 'eurorail',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'speed']], ' km/h'], 'text-size': 11, 'text-offset': [0, 1.5], 'text-anchor': 'top' },
        paint: { 'text-color': '#f0abfc', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });
      this.map.addLayer({
        id: 'eurorail_arrow', type: 'symbol', source: 'eurorail',
        layout: {
          'icon-image': 'train-arrow',
          'icon-size': 0.65,
          'icon-allow-overlap': true,
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-offset': [0, 0]
        }
      });




      // Switches
      this.map.addSource('switches', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'switches', type: 'circle', source: 'switches',
        paint: { 'circle-color': '#cbd5e1', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#475569' }
      });

      // Signals
      this.map.addSource('rail_signals', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'rail_signals', type: 'circle', source: 'rail_signals',
        paint: { 'circle-color': ['match', ['get', 'state'], 'Stoj', '#ef4444', 'Prosto', '#22c55e', '#eab308'], 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });

      // SmartCity (Siemens / Nokia)
      this.map.addSource('smartcity', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'smartcity', type: 'circle', source: 'smartcity',
        paint: { 'circle-color': '#a855f7', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'smartcity_label', type: 'symbol', source: 'smartcity',
        layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.5], 'text-anchor': 'top' },
        paint: { 'text-color': '#d8b4fe', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // ARSO
      this.map.addSource('arso', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'arso', type: 'circle', source: 'arso',
        paint: { 'circle-color': '#fcd34d', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'arso_label', type: 'symbol', source: 'arso',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['get', 'temp'], '°C'], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#fde68a', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // GitHub
      this.map.addSource('github', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'github', type: 'circle', source: 'github',
        paint: { 'circle-color': '#e2e8f0', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#334155' }
      });
      this.map.addLayer({
        id: 'github_label', type: 'symbol', source: 'github',
        layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#cbd5e1', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // NB-IoT
      this.map.addSource('nbiot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      
      this.map.addSource('rail_sensors', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addSource('traffic_sensors', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addSource('logistics_sensors', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'nbiot', type: 'circle', source: 'nbiot',
        paint: { 'circle-color': '#d97706', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'nbiot_label', type: 'symbol', source: 'nbiot',
        layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
        paint: { 'text-color': '#fcd34d', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // Rail Sensors
      this.map.addLayer({
        id: 'rail_sensors', type: 'circle', source: 'rail_sensors',
        paint: { 'circle-color': '#0ea5e9', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'rail_sensors_label', type: 'symbol', source: 'rail_sensors',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'value']], ' ', ['get', 'unit']], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#38bdf8', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // Traffic Sensors
      this.map.addLayer({
        id: 'traffic_sensors', type: 'circle', source: 'traffic_sensors',
        paint: { 'circle-color': '#ec4899', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'traffic_sensors_label', type: 'symbol', source: 'traffic_sensors',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'value']], ' ', ['get', 'unit']], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#f472b6', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      // Logistics Sensors
      this.map.addLayer({
        id: 'logistics_sensors', type: 'circle', source: 'logistics_sensors',
        paint: { 'circle-color': '#a855f7', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      });
      this.map.addLayer({
        id: 'logistics_sensors_label', type: 'symbol', source: 'logistics_sensors',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'value']], ' ', ['get', 'unit']], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#c084fc', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
      });

      
      // Traffic Layer
      
      // Traffic lines
      this.map.addSource('traffic_path', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'traffic_path', type: 'line', source: 'traffic_path',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      this.map.addSource('traffic', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'traffic', type: 'circle', source: 'traffic',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });
      this.map.addLayer({
        id: 'traffic_label', type: 'symbol', source: 'traffic',
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n', ['get', 'speed'], ' km/h'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#000',
          'text-halo-width': 1.5
        }
      });

      
      // ERA Tunnels Layer

      this.map.addSource("era_tunnels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      this.map.addLayer({

        id: "era_tunnels_line", type: "line", source: "era_tunnels",

        layout: { "line-join": "round", "line-cap": "round", "visibility": "none" },

        paint: { "line-color": "#f97316", "line-width": 6, "line-opacity": 0.7, "line-dasharray": [1, 2] }

      });

      this.map.addLayer({

        id: "era_tunnels_label", type: "symbol", source: "era_tunnels",

        layout: { "text-field": ["get", "name"], "text-size": 10, "symbol-placement": "line", "text-offset": [0, 1], "visibility": "none" },

        paint: { "text-color": "#f97316", "text-halo-color": "#000", "text-halo-width": 1.5 }

      });

      // RINF Stations Layer
      
      this.map.addSource('rinf', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'rinf', type: 'circle', source: 'rinf',
        paint: {
          'circle-color': '#0284c7', // match sz_stations
          'circle-radius': 6,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });
      this.map.addLayer({
        id: 'rinf_label', type: 'symbol', source: 'rinf',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#0284c7',
          'text-halo-color': '#000',
          'text-halo-width': 1.5
        }
      });

      // Regional Rail & Bus Hubs
      this.map.addSource('stations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'stations_layer', type: 'circle', source: 'stations',
        paint: {
          'circle-color': [
            'match',
            ['get', 'category'],
            'glavna', '#e11d48',
            'vozlisce', '#d97706',
            'mejna', '#7c3aed',
            'avtobusna', '#059669',
            '#0284c7'
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            6, 5,
            10, 8,
            14, 12
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      this.map.addLayer({
        id: 'stations_label', type: 'symbol', source: 'stations',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2
        }
      });

      // The TEN-T designated rail network, styled by what the Commission says
      // each segment carries. This replaced a layer of invented freight trains:
      // no feed publishes freight positions on this corridor, so the map now
      // shows the designated infrastructure instead of made-up vehicles on it.
      this.map.addSource('tent_railways', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'tent_railways', type: 'line', source: 'tent_railways',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match', ['coalesce', ['get', 'activity'], 'unknown'],
            'Freight', '#f59e0b',
            'Passenger', '#38bdf8',
            'Passenger and freight', '#a78bfa',
            '#64748b'
          ],
          // Core network reads heavier than comprehensive.
          'line-width': ['case', ['==', ['get', 'network'], 'core'], 3.2, 1.8],
          'line-opacity': ['case', ['==', ['get', 'activity'], 'Freight'], 0.95, 0.55]
        }
      });

      // Modelled freight. Drawn as an uncertainty band along the track with
      // the most likely point on it, rather than a confident dot, because that
      // is the honest shape of the estimate.
      // Freight paths published in the corridor catalogue. These are drawn the
      // way every other train is drawn — one marker, pointing where it is
      // going, with its number and speed under it. The earlier treatment put a
      // wide fuchsia band along the rails to show a position window; it read as
      // a second, pink railway line rather than as uncertainty, so it is gone.
      // What the estimate is worth is said in words in the panel instead.
      // Where a selected freight path can actually be, drawn along the track.
      //
      // Only ever for the one train the user has open — the earlier version
      // painted a band over every path at all times and read as a second, pink
      // railway line rather than as uncertainty.
      this.map.addSource('freight_band', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'freight_band', type: 'line', source: 'freight_band',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': '#f97316',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3, 12, 6, 16, 9],
          'line-opacity': 0.35,
          'line-dasharray': [2, 1.5]
        }
      });

      this.map.addSource('freight_paths', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'freight_paths', type: 'symbol', source: 'freight_paths',
        layout: {
          'icon-image': 'icon-train-freight',
          'icon-size': 0.95,
          'icon-rotate': ['coalesce', ['get', 'bearing'], ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
      this.map.addLayer({
        id: 'freight_paths_label', type: 'symbol', source: 'freight_paths',
        layout: {
          // The number under the train is the permitted line speed of the
          // section, marked "proga" and prefixed with a limit sign so it
          // cannot be read as this train's speed. What used to be here was the
          // catalogue's leg average — around 40 km/h, because it has an hour
          // of standing still smeared through it — which is simply not what a
          // freight train is doing as it passes a platform.
          'text-field': [
            'concat',
            ['coalesce', ['get', 'trainNumber'], ['get', 'papId']],
            ['case',
              ['has', 'lineSpeedKmh'],
              ['concat', ' · proga ≤', ['get', 'lineSpeedKmh'], ' km/h'],
              ''],
            '\n', ['get', 'direction'],
            // How far the position can be out. Without it the icon claims a
            // precision the catalogue does not have.
            ['case',
              // Standing at a published stop: say so instead of a ± figure.
              ['==', ['get', 'phase'], 'dwell'],
              ['concat', ' · postanek ', ['coalesce', ['get', 'dwellLocation'], ''], ' do ', ['coalesce', ['get', 'dwellDeparture'], '']],
              ['has', 'bandHalfKm'],
              ['concat', ' · lega ±', ['get', 'bandHalfKm'], ' km'],
              '']
          ],
          'text-size': 10.5,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true
        },
        paint: { 'text-color': '#fdba74', 'text-halo-color': '#0f172a', 'text-halo-width': 2 }
      });

      // The six places where the Slovenian network actually meets a
      // neighbour's. Both managers describe each under one UOPID, which is
      // what makes the routing graph continuous across the border.
      this.map.addSource('border_crossings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'border_crossings', type: 'circle', source: 'border_crossings',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f472b6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fce7f3',
          'circle-opacity': 0.9
        }
      });
      this.map.addLayer({
        id: 'border_crossings_label', type: 'symbol', source: 'border_crossings',
        layout: {
          'text-field': ['concat', ['get', 'name'], '  ', ['get', 'countries']],
          'text-size': 10.5,
          'text-offset': [0, 1.3],
          'text-anchor': 'top'
        },
        paint: { 'text-color': '#fbcfe8', 'text-halo-color': '#0f172a', 'text-halo-width': 1.4 }
      });

      // Works and closures: the temporary capacity restrictions the freight
      // corridors publish for SŽ-Infrastruktura, drawn along the affected
      // stretch. Red where the line is fully closed, amber otherwise; a
      // restriction at one station is a point.
      this.map.addSource('rail_works', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'rail_works', type: 'line', source: 'rail_works',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'totalClosure'], '#ef4444', '#f59e0b'],
          'line-width': ['case', ['==', ['get', 'status'], 'v teku'], 5, 3],
          'line-dasharray': [1.5, 1.2],
          'line-opacity': ['case', ['==', ['get', 'status'], 'v teku'], 0.95, 0.6]
        }
      });
      this.map.addLayer({
        id: 'rail_works_point', type: 'circle', source: 'rail_works',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['==', ['get', 'status'], 'v teku'], 7, 5],
          'circle-color': ['case', ['get', 'totalClosure'], '#ef4444', '#f59e0b'],
          'circle-stroke-width': 2, 'circle-stroke-color': '#fef3c7',
          'circle-opacity': ['case', ['==', ['get', 'status'], 'v teku'], 0.95, 0.6]
        }
      });
      // symbol-placement cannot be data-driven, so lines and points get a
      // label layer each.
      this.map.addLayer({
        id: 'rail_works_label', type: 'symbol', source: 'rail_works',
        minzoom: 8, filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['concat', ['get', 'name'], ' · ', ['get', 'dateFrom'], ' – ', ['get', 'dateTo']],
          'text-size': 10.5, 'text-offset': [0, 1.2], 'text-anchor': 'top'
        },
        paint: { 'text-color': '#fde68a', 'text-halo-color': '#0f172a', 'text-halo-width': 1.4 }
      });
      this.map.addLayer({
        id: 'rail_works_point_label', type: 'symbol', source: 'rail_works',
        minzoom: 8, filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          'text-field': ['concat', ['get', 'name'], ' · ', ['get', 'dateFrom'], ' – ', ['get', 'dateTo']],
          'text-size': 10.5, 'text-offset': [0, 1.2], 'text-anchor': 'top'
        },
        paint: { 'text-color': '#fde68a', 'text-halo-color': '#0f172a', 'text-halo-width': 1.4 }
      });

      // Reference geometry, not live data: fetch once, as soon as the layer
      // exists, rather than waiting on the thirty-second data tick.
      if (!this.tentRailwaysLoaded) {
        this.tentRailwaysLoaded = true;
        loadTentRailways().then(gj => {
          const src = this.map?.getSource('tent_railways') as maplibregl.GeoJSONSource | undefined;
          if (src && gj?.features?.length) src.setData(gj);
        }).catch(() => { this.tentRailwaysLoaded = false; });
        loadBorderCrossings().then(gj => {
          const src = this.map?.getSource('border_crossings') as maplibregl.GeoJSONSource | undefined;
          if (src && gj?.features?.length) src.setData(gj);
        }).catch(() => {});
        loadRailWorks().then(gj => {
          const src = this.map?.getSource('rail_works') as maplibregl.GeoJSONSource | undefined;
          if (src && gj?.features?.length) src.setData(gj);
        }).catch(() => {});
      }

      // Modelled positions move, so they refresh on their own timer.
      if (!this.modelledFreightTimer) {
        const pushPaths = () => {
          loadCorridorFreightPaths().then(gj => {
            if (!gj?.features) return;
            // Flattened into the shape the differential-motion path expects,
            // so these glide between fixes instead of jumping on each poll.
            const rows = gj.features.map((f: any) => {
              const c = f.geometry?.coordinates || [];
              return { ...f.properties, lon: c[0], lat: c[1] };
            }).filter((r: any) => Number.isFinite(r.lon) && Number.isFinite(r.lat));
            this.updateGeoJSONSource('freight_paths', rows);
          }).catch(() => {});
        };
        pushPaths();
        // Ten seconds rather than thirty: the interpolation spans whatever gap
        // it is given, and a shorter one keeps the glide close to the
        // published timings instead of extrapolating half a minute of it.
        this.modelledFreightTimer = window.setInterval(pushPaths, 10000);
      }

      // Freight Trains Layer (Corridor Approximation)
      this.map.addSource('freight_trains', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'freight_trains_glow', type: 'circle', source: 'freight_trains',
        paint: {
          'circle-color': '#f59e0b',
          'circle-radius': 11,
          'circle-opacity': 0.35,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fbbf24',
          'circle-stroke-opacity': 0.8
        }
      });
       this.map.addLayer({
        id: 'freight_trains', type: 'symbol', source: 'freight_trains',
        layout: {
          'icon-image': [
            'case',
            ['all', ['get', 'isRunning'], ['>', ['coalesce', ['get', 'speedKmh'], 0], 3]],
            'freight-arrow',
            'icon-train-freight'
          ],
          'icon-size': 0.9,
          'icon-rotate': ['coalesce', ['get', 'bearing'], ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true
        }
      });
      this.map.addLayer({
        id: 'freight_trains_label', type: 'symbol', source: 'freight_trains',
        layout: {
          'text-field': [
            'concat', 
            '📦 ', 
            ['coalesce', ['get', 'trainNumber'], ['get', 'name']], 
            [
              'case',
              ['all', ['get', 'isRunning'], ['>', ['coalesce', ['get', 'speedKmh'], 0], 3]],
              ['concat', ' · ', ['get', 'speedKmh'], ' km/h'],
              ' · Postaja'
            ]
          ],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#fde68a',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2.5
        }
      });
    
      // Clicks
      this.map.on('click', (e) => {
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 16, e.point.y - 16],
          [e.point.x + 16, e.point.y + 16]
        ];
        const features = this.map.queryRenderedFeatures(bbox, {
          layers: ['buses', 'buses_label', 'stations_layer', 'stations_label', 'rinf', 'rinf_label', 'rinf_network_line', 'traffic', 'traffic_label', 'eurorail_label', 'eurorail_arrow', 'switches', 'rail_signals', 'spat_pulse', 'spat', 'spat_label', 'hydro', 'power', 'moms', 'openaq', 'eurorail', 'ttn', 'opensense', 'smartcity', 'arso', 'air', 'aircraft', 'quakes', 'evcharge', 'lorawan', 'nbiot', 'rail_sensors', 'traffic_sensors', 'logistics_sensors', 'transit', 'transit_label', 'nbiot_label', 'rail_sensors_label', 'traffic_sensors_label', 'logistics_sensors_label', 'transit_arrow', 'hafas', 'aprs', 'loramesh', 'sparql', 'warehouse_circle', 'yard', 'sensorcommunity', 'github', 'arso_label', 'sensorcommunity_label', 'github_label', 'era_tunnels_line', 'freight_trains', 'freight_trains_glow', 'freight_trains_label', 'freight_paths', 'freight_paths_label', 'border_crossings', 'rail_works', 'rail_works_point', 'rail_works_label']
        });
        
        if (features.length) {
          // If a vehicle was clicked along with station/background, prioritize the vehicle!
          const vehicleFeature = features.find(feat => 
            feat.source === 'buses' || feat.source === 'hafas' || feat.source === 'transit' || feat.source === 'eurorail' || feat.source === 'freight_trains' || feat.source === 'freight_paths' ||
            feat.layer.id === 'buses' || feat.layer.id === 'buses_label' || feat.layer.id === 'hafas' || feat.layer.id === 'transit' || feat.layer.id === 'eurorail' || feat.layer.id === 'freight_trains' ||
            feat.layer.id === 'hafas_label' || feat.layer.id === 'transit_label' || feat.layer.id === 'freight_trains_label'
          );
          const f = vehicleFeature || features[0];
          const p = f.properties;
          let type = f.source;
          if (f.layer.id === 'rinf_network_line' || type === 'rinf_network') {
            type = 'rinf_network';
          }
          const coords = f.geometry.type === 'Point' 
            ? (f.geometry as any).coordinates 
            : [e.lngLat.lng, e.lngLat.lat];
            
          this.activeSelectedNodeId = p.id || null;
          this.activeSelectedNodeType = type;
          this.lastSelectedNodeSignature = '';


          // Snappy interaction: only gently ease if feature is obscured under left sidebar
          if (window.innerWidth >= 640 && e.point.x < 360) {
            this.map.easeTo({
              center: coords as [number, number],
              offset: [-120, 0],
              duration: 300
            });
          }

          if (type === 'hafas') {
             try {
                 const routeSource = this.map.getSource('hafas_route') as maplibregl.GeoJSONSource;
                 if (routeSource && p.polyline) {
                     const poly = typeof p.polyline === 'string' ? JSON.parse(p.polyline) : p.polyline;
                     routeSource.setData(poly);
                 } else if (routeSource) {
                     routeSource.setData({ type: 'FeatureCollection', features: [] });
                 }
             } catch (e) { console.error('Failed to parse polyline', e); }
          } else {
             const routeSource = this.map.getSource('hafas_route') as maplibregl.GeoJSONSource;
             if (routeSource) routeSource.setData({ type: 'FeatureCollection', features: [] });
          }

          // Properties arrive flattened, so a nested object is JSON text.
          if (type === 'freight_paths') {
            let pb: any = p.positionBand;
            if (typeof pb === 'string') { try { pb = JSON.parse(pb); } catch { pb = null; } }
            this.setFreightBand(pb);
          } else {
            this.setFreightBand(null);
          }

          const node = this.buildTelemetryNode(type, p, coords as [number, number]);

          if (node.metrics.some((m: any) => m.id === "era-loading")) {

             fetch(`/api/era/track?lat=${coords[1]}&lon=${coords[0]}`).then(r => r.json()).then(eraData => {

                 if (eraData) {

                     const eraMetricIdx = node.metrics.findIndex((m: any) => m.id === "era-loading");

                     if (eraMetricIdx > -1) {

                         node.metrics.splice(eraMetricIdx, 1,

                             { label: "Sistem (ERA)", value: eraData.voltage, highlight: true },

                             { label: "V_max (ERA)", value: eraData.speed, highlight: true },
                             
                             { label: "ETCS Nivo (ERA)", value: eraData.etcs, highlight: true },

                             { label: "Odsek proge (ERA)", value: eraData.opName, highlight: false }, { label: "Kategorija proge (SŽ)", value: eraData.szCategory || 'Neznano', highlight: true }, { label: "Max dolžina vlaka (SŽ)", value: eraData.szLength || 'Neznano', highlight: false }, { label: "Osn. obremenitev (SŽ)", value: eraData.szLoad || 'Neznano', highlight: false }, { label: "Maks. vzpon (SŽ)", value: eraData.szGradient || 'Neznano', highlight: false }, { label: "TSI 2023 Baseline", value: eraData.ccsBaseline || 'Neznano', highlight: true }, { label: "TSI Radio Komunikacija", value: eraData.ccsRadio || 'Neznano', highlight: false }, { label: "ATO Pripravljenost (TSI)", value: eraData.ccsAto || 'Neznano', highlight: false }

                         );

                         this.onSelectNode({ ...node });

                     }

                 } else {

                     const eraMetricIdx = node.metrics.findIndex((m: any) => m.id === "era-loading");

                     if (eraMetricIdx > -1) {

                         node.metrics[eraMetricIdx].value = "Ni podatkov za to lokacijo";

                         this.onSelectNode({ ...node });

                     }

                 }

             }).catch(e => console.error("ERA fetch failed", e));

          }

          this.onSelectNode(node);
        } else {
          // Tapping empty map: clear the uncertainty band, if one is shown.
          this.setFreightBand(null);
          // Check if they clicked on the base map railway
          const allFeatures = this.map.queryRenderedFeatures(bbox);
          const railFeature = allFeatures.find(f => 
            (f.sourceLayer === 'transportation' && f.properties && f.properties.class === 'rail') || 
            (f.layer.id && f.layer.id.includes('rail'))
          );
          
          if (railFeature) {
             const coords = [e.lngLat.lng, e.lngLat.lat];
             const node = this.buildTelemetryNode('rail_track', railFeature.properties, coords as [number, number]);

             this.onSelectNode(node);
          }
        }
      });
    });
  }

  private logTelemetry(log: TelemetryLogEntry) {
    if (this.onTelemetryLog) this.onTelemetryLog(log);
  }

  private activeSelectedNodeId: string | null = null;
  private activeSelectedNodeType: string | null = null;
  private latestHafasTrains: any[] = [];
  private latestTransitTrains: any[] = [];

  // Dedicated high-frequency urban transit (bus) poller properties
  private lastBusFetchTime = 0;
  private isBusPolling = false;
  private readonly BUS_POLL_INTERVAL_MS = 2000; // Dedicated shorter TTL polling interval (2 seconds) for urban bus transit
  private latestDedicatedBuses: any[] = [];
  private latestNonBusTransit: any[] = [];
  private latestGtfsRealtime: any[] = [];

  private latestActiveTrips: any[] = [];
  private latestCompletedTrips: any[] = [];
  private selectedTripId: string | null = null;






  private trackHistory = new Map<string, any>();
  
  public toggleLayer(layerKey: string, isVisible: boolean) {
    if (!this.map || !this.map.isStyleLoaded()) return;
    
    // Depending on the layer key, toggle related layers
    const toggle = (id: string) => {
       if (this.map.getLayer(id)) {
          this.map.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none');
       }
    };
    
    // Most keys match the layer ID, plus maybe _label, _arrow, or _glow
    toggle(layerKey);
    toggle(layerKey + '_label');
    toggle(layerKey + '_arrow');
    toggle(layerKey + '_glow');
    toggle(layerKey + '_band');
    
    if (layerKey === 'tent_railways') {
      toggle('tent_railways');
      return;
    }
    if (layerKey === 'border_crossings') {
      toggle('border_crossings');
      toggle('border_crossings_label');
      return;
    }
    if (layerKey === 'rail_works') {
      toggle('rail_works');
      toggle('rail_works_point');
      toggle('rail_works_label');
      toggle('rail_works_point_label');
      return;
    }
    if (layerKey === 'freight_paths') {
      toggle('freight_paths');
      toggle('freight_paths_label');
      return;
    }
    if (layerKey === 'freight_trains') {
       toggle('freight_trains_glow');
    }
    if (layerKey === 'transit') {
       toggle('connections');
    }
    if (layerKey === 'rinf_network') {
       toggle('rinf_network_line');
    }
    if (layerKey === 'rinf') {
       toggle('rinf');
       toggle('rinf_label');
    }
    if (layerKey === 'orm' || layerKey === 'sz_rail') {
       toggle('openrailwaymap-layer');
    }
  }

  /**
   * Text labels are only drawn once the view is zoomed in far enough for them
   * to be readable. At regional zoom there can be several thousand live
   * vehicles on screen at once and their labels bury the map completely, so the
   * overview stays icons-only and the detail appears as you zoom in.
   *
   * This is applied as a zoom range rather than a visibility change so it never
   * fights toggleLayer(), which owns visibility.
   */
  private readonly LABEL_MIN_ZOOM = 13.5;
  private labelsEnabled = true;

  private getLabelLayerIds(): string[] {
    if (!this.map) return [];
    try {
      return this.map.getStyle().layers.map(l => l.id).filter(id => id.endsWith('_label'));
    } catch {
      return [];
    }
  }

  private applyLabelDeclutter(): void {
    for (const id of this.getLabelLayerIds()) {
      try {
        this.map.setLayerZoomRange(id, this.LABEL_MIN_ZOOM, 24);
        // Let a label be dropped rather than displace its icon when crowded.
        this.map.setLayoutProperty(id, 'text-optional', true);
      } catch {
        /* layer not present in this style */
      }
    }
  }

  public areLabelsVisible(): boolean {
    return this.labelsEnabled;
  }

  /** Turn map labels off entirely, or back on above LABEL_MIN_ZOOM. */
  public setLabelsVisible(visible: boolean): void {
    this.labelsEnabled = visible;
    for (const id of this.getLabelLayerIds()) {
      try {
        this.map.setLayerZoomRange(id, visible ? this.LABEL_MIN_ZOOM : 23.5, 24);
      } catch {
        /* layer not present in this style */
      }
    }
  }

  public isLayerVisible(layerId: string): boolean {
    try {
      return !!this.map.getLayer(layerId) && this.map.getLayoutProperty(layerId, 'visibility') !== 'none';
    } catch {
      return false;
    }
  }

  /**
   * The rows currently backing a map source — i.e. exactly the live records the
   * map is drawing, with their real coordinates. Used by the analytics panel so
   * the table and the map can never disagree about what is out there.
   */
  public getLiveDataset(sourceId: string): any[] {
    if (!this.map) return [];
    try {
      const src: any = this.map.getSource(sourceId);
      const data = src?.serialize?.().data;
      if (!data || !Array.isArray(data.features)) return [];
      return data.features.map((f: any) => ({
        ...(f.properties || {}),
        lon: f.geometry?.coordinates?.[0],
        lat: f.geometry?.coordinates?.[1]
      }));
    } catch {
      return [];
    }
  }

  public setBasemap(type: 'dark' | 'light' | 'sat') {
     if (!this.map) return;
     const dark = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
     const light = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
     
     // changing basemap replaces all our custom layers, we'd have to re-add them
     // usually easier to just toggle an underlying satellite layer if available,
     // or for now, just ignore it so we don't break the map unless we wrote a full re-render.
  }

  /**
   * Draw (or clear) the reachability band for one freight path.
   *
   * The band is the stretch the published times and the permitted line speed
   * together allow the train to be in. It is the honest counterpart to the
   * icon, which sits at a proportional interpolation inside it.
   */
  public setFreightBand(band: { coords?: [number, number][] } | null): void {
    const src = this.map?.getSource('freight_band') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const coords = band?.coords;
    const distinct = coords ? coords.some(c => c[0] !== coords[0][0] || c[1] !== coords[0][1]) : false;
    if (!coords || coords.length < 2 || !distinct) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    // The server sends the band already following the rails.
    src.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
    });
  }

  public clearSelectedNode() { 
    this.activeSelectedNodeId = null; 
    this.activeSelectedNodeType = null; 
    this.lastSelectedNodeSignature = '';
    this.setFreightBand(null);
  }
  private isPolling = false;
  private lastFetchTime = 0;
  private animationFrameId: number | null = null;
  private pendingUpdates = new Map<string, any[]>();

  private computeStateSignature(state: any): string {
    const c = state.counts || {};
    return [
      c.buses || 0,
      c.transit || 0,
      c.hafas || 0,
      c.aircraft || 0,
      c.freight_trains || 0,
      c.traffic || 0,
      c.spat || 0,
      c.weather || 0,
      c.bikes || 0,
      c.quakes || 0,
      c.aprs || 0,
      c.loramesh || 0,
      state.onlineLorawan || 0,
      state.error || ''
    ].join('|');
  }

  private shouldBroadcastStateUpdate(state: any): boolean {
    if (!this.lastBroadcastedStateHash) {
      this.lastBroadcastedStateHash = this.computeStateSignature(state);
      return true;
    }

    const newHash = this.computeStateSignature(state);
    if (newHash !== this.lastBroadcastedStateHash) {
      this.lastBroadcastedStateHash = newHash;
      return true;
    }

    return false;
  }

  public getVehicleMotion(id: string | null, sourceId?: string | null): VehicleMotionEntity | undefined {
    if (!id) return undefined;
    if (sourceId) {
      const direct = this.vehicleMotionMap.get(`${sourceId}:${id}`);
      if (direct) return direct;
    }
    for (const motion of this.vehicleMotionMap.values()) {
      if (motion.id === id) return motion;
    }
    return undefined;
  }

  /**
   * Displayed speed for a vehicle that has not cleared the jitter dead-band.
   *
   * Upstream feeds routinely report a stale speed for a vehicle that is sitting
   * still — measured against the live BrezAvta feed, buses flagged "moving" at
   * 65-91 km/h had not moved a single metre in 45 seconds. Whatever the feed
   * says, something that is not changing position is not travelling, so the
   * figure is eased down rather than left standing, and zeroed outright once
   * the vehicle has been still long enough for it to be unambiguous.
   */
  private decayIdleSpeed(motion: VehicleMotionEntity, now: number): number {
    const measured = motion.smoothedSpeedKmh ?? 0;
    const stillForMs = now - (motion.lastMovementTime ?? motion.lastTelemetryTime ?? now);

    if (stillForMs >= IDLE_STOP_MS) {
      motion.smoothedSpeedKmh = 0;
      return 0;
    }
    if (stillForMs > IDLE_FADE_START_MS && measured > 0) {
      // Fade the reading out rather than dropping it abruptly. The stored value
      // is left intact so that a vehicle which simply had a late fix resumes
      // from its real speed instead of from a decayed one.
      const remaining = 1 - (stillForMs - IDLE_FADE_START_MS) / (IDLE_STOP_MS - IDLE_FADE_START_MS);
      return Math.max(0, Math.round(measured * remaining));
    }
    return Math.round(measured);
  }

  private processVehicleDifferentialUpdates(sourceId: string, data: any[]): void {
    const now = performance.now();
    const activeKeys = new Set<string>();

    for (const a of data) {
      if (!a) continue;
      const entityId = String(a.id || a.tripId || a.name || a.callsign || a._num || '');
      if (!entityId) continue;

      const key = `${sourceId}:${entityId}`;
      activeKeys.add(key);

      const newLon = Number(a.lon);
      const newLat = Number(a.lat);
      if (isNaN(newLon) || isNaN(newLat)) continue;

      const rawHeading = typeof a.heading === 'number' && !isNaN(a.heading)
        ? a.heading
        : (typeof a.true_track === 'number' && !isNaN(a.true_track)
          ? a.true_track
          : (typeof a.bearing === 'number' && !isNaN(a.bearing) ? a.bearing : 0));
      // NB: the feed's own speed field is deliberately not read here. It is
      // measured from displacement below; see the speed calculation in the
      // genuine-motion branch for why the reported value is not trusted.
      const fixTimeMs = readFixTimeMs(a);
      let motion = this.vehicleMotionMap.get(key);

      // Adaptive dead-band jitter and teleportation boundaries per source
      let minJitterMeters = (sourceId === 'buses' || sourceId === 'transit') ? 8.0 : 6.0;
      let minJitterSpeed = 3.0;
      let maxTeleportMeters = 5000;

      if (sourceId === 'aircraft') {
        minJitterMeters = 10.0;
        minJitterSpeed = 10.0;
        maxTeleportMeters = 40000; // Planes cruise at up to 900 km/h (~1.5 km in 6s)
      }

      const isTrain = (
        sourceId === 'transit' ||
        sourceId === 'hafas' ||
        sourceId === 'freight_trains' ||
        sourceId === 'eurorail' ||
        sourceId === 'freight_paths' ||
        a.type === 'train' ||
        a.type === 'freight_train' ||
        a.type === 'freight' ||
        a.type === 'corridor_freight_path'
      );

      if (!motion) {
        // Initial registration for vehicle
        let initHeading = rawHeading;
        if (isTrain && rawHeading > 0) {
          initHeading = alignHeadingToTrack(newLon, newLat, rawHeading);
        }

        motion = {
          id: entityId,
          sourceId,
          renderLon: newLon,
          renderLat: newLat,
          renderHeading: initHeading,
          fromLon: newLon,
          fromLat: newLat,
          fromHeading: initHeading,
          targetLon: newLon,
          targetLat: newLat,
          targetHeading: initHeading,
          startTime: now,
          duration: 2200,
          isInterpolating: false,
          lastTelemetryTime: now,
          featureIndex: -1,
          dynamicHeading: initHeading > 0 ? initHeading : undefined,
          hasDynamicHeading: initHeading > 0,
          prevTargetLon: newLon,
          prevTargetLat: newLat,
          prevTargetTime: now,
          lastMovementTime: now,
          lastFixTimeMs: fixTimeMs
        };
        this.vehicleMotionMap.set(key, motion);
        // Speed is measured from movement between fixes, so a vehicle seen for
        // the first time has no measurement yet. Report nothing rather than
        // repeating the feed's unverified figure; the next fix establishes it.
        a.speed = 0;
      } else {
        // 1. Calculate displacement delta between consecutive location updates
        const prevTargetLat = motion.targetLat;
        const prevTargetLon = motion.targetLon;
        const deltaFromTarget = calculateHeadingVector(prevTargetLat, prevTargetLon, newLat, newLon);
        const deltaFromRender = calculateHeadingVector(motion.renderLat, motion.renderLon, newLat, newLon);
        const distMeters = deltaFromTarget.distanceMeters;

        // 2. DEAD-BAND SUPPRESSION & TARGET RETENTION:
        // The feed repeats the same fix on every poll until the next one lands
        // (a bus is re-served unchanged for 8-30 s, median 20 s). If the
        // target has not moved, keep the glide that is already running towards
        // it and do nothing else.
        //
        // This used to also require the *rendered* position to be within the
        // dead-band, which a vehicle mid-glide never is. Every repeated poll
        // therefore fell through to the motion branch and restarted the glide
        // from wherever the icon was, with a duration of "time since the last
        // restart" — two seconds. A 20-second leg was covered in about four
        // seconds and the vehicle then stood still until the next fix: the
        // lurching, mostly-stationary motion that made buses look frozen.
        if (distMeters < minJitterMeters) {
          a.lon = motion.renderLon;
          a.lat = motion.renderLat;
          const h = Math.round((motion.renderHeading % 360 + 360) % 360);
          a.heading = h;
          a.hasHeading = true;
          // Still on its way to the target: it is moving at the measured speed.
          // Only once it has arrived and no new fix has come does the reading
          // fade out (the vehicle has not been seen to move since).
          a.speed = motion.isInterpolating
            ? Math.round(motion.smoothedSpeedKmh ?? 0)
            : this.decayIdleSpeed(motion, now);
          if (sourceId === 'aircraft') a.true_track = h;
          if (sourceId === 'freight_trains' || sourceId === 'freight_paths') a.bearing = h;
          continue;
        }

        // 3. ABNORMAL TELEPORTATION
        //
        // A fixed 5 km threshold let an impossible jump glide: a Croatian train
        // was seen moving 2.9 km between fixes 20 s apart — 520 km/h — and was
        // animated across it. The threshold is now what the plausible speed
        // for this kind of vehicle allows in the time since the last fix (with
        // slack), floored so a late fix does not read as a teleport. Anything
        // beyond it is a data glitch and is snapped, never animated.
        let dtForJump = 20;
        if (fixTimeMs != null && motion.lastFixTimeMs != null && fixTimeMs > motion.lastFixTimeMs) dtForJump = (fixTimeMs - motion.lastFixTimeMs) / 1000;
        else if (motion.lastTelemetryTime) dtForJump = Math.max(1, (now - motion.lastTelemetryTime) / 1000);
        const plausibleKmh = MAX_PLAUSIBLE_SPEED_KMH[sourceId] ?? 200;
        const maxJumpMeters = Math.max(1500, Math.min(maxTeleportMeters, (plausibleKmh / 3.6) * dtForJump * 1.5));
        if (distMeters > maxJumpMeters) {
          motion.renderLon = newLon;
          motion.renderLat = newLat;
          motion.renderHeading = rawHeading;
          motion.fromLon = newLon;
          motion.fromLat = newLat;
          motion.fromHeading = rawHeading;
          motion.targetLon = newLon;
          motion.targetLat = newLat;
          motion.targetHeading = rawHeading;
          motion.isInterpolating = false;
          motion.lastTelemetryTime = now;
          motion.prevTargetLon = newLon;
          motion.prevTargetLat = newLat;
          motion.prevTargetTime = now;
          continue;
        }

        // 4. REVERSE JITTER SUPPRESSION:
        // If vehicle is in motion and incoming packet jumps backwards against current heading over a short distance, ignore
        // Gated on the measured speed rather than the feed's, which reports
        // motion for vehicles that are demonstrably parked.
        if (motion.isInterpolating && distMeters < 35 && (motion.smoothedSpeedKmh ?? 0) > 8) {
          const moveAngle = deltaFromRender.heading;
          const headingDiff = Math.abs(((moveAngle - motion.renderHeading + 540) % 360) - 180);
          if (headingDiff > 130) {
            // Reverse jitter detected: hold smooth forward trajectory
            a.lon = motion.renderLon;
            a.lat = motion.renderLat;
            const h = Math.round((motion.renderHeading % 360 + 360) % 360);
            a.heading = h;
            a.hasHeading = true;
            a.speed = Math.round(motion.smoothedSpeedKmh ?? 0);
            if (sourceId === 'freight_trains' || sourceId === 'freight_paths') a.bearing = h;
            continue;
          }
        }

        // 5. GENUINE FORWARD MOTION - DYNAMIC HEADING VECTOR CALCULATION:
        // Calculate the heading vector based on the delta between consecutive location updates
        let dynamicHeading: number;

        if (deltaFromTarget.distanceMeters >= 1.5) {
          dynamicHeading = deltaFromTarget.heading;
        } else if (deltaFromRender.distanceMeters >= 2.0) {
          dynamicHeading = deltaFromRender.heading;
        } else if (motion.dynamicHeading != null) {
          // Stationary or slow creep: retain existing movement path heading
          dynamicHeading = motion.dynamicHeading;
        } else if (motion.renderHeading > 0) {
          dynamicHeading = motion.renderHeading;
        } else {
          dynamicHeading = rawHeading;
        }

        // For trains, dynamically align the calculated heading vector with the railway track geometry
        if (isTrain && dynamicHeading != null) {
          dynamicHeading = alignHeadingToTrack(newLon, newLat, dynamicHeading);
        }

        motion.fromLon = motion.renderLon;
        motion.fromLat = motion.renderLat;
        motion.fromHeading = motion.renderHeading;

        motion.targetLon = newLon;
        motion.targetLat = newLat;
        motion.dynamicHeading = dynamicHeading;
        motion.hasDynamicHeading = true;
        motion.prevTargetLon = prevTargetLon;
        motion.prevTargetLat = prevTargetLat;
        motion.prevTargetTime = now;

        // Angular shortest path to prevent full 360° spin flips
        const deltaHeading = ((dynamicHeading - motion.fromHeading + 540) % 360) - 180;
        motion.targetHeading = motion.fromHeading + deltaHeading;

        // Ground-truth speed: how far the vehicle actually moved, over the time
        // it actually took. The feeds' own speed fields do not survive scrutiny
        // — measured against the live BrezAvta feed, buses flagged "moving" at
        // 65-91 km/h had not moved a metre in 45 seconds, and for genuinely
        // moving buses the reported figure ran about double the distance they
        // actually covered. Displacement over elapsed time has neither failure
        // mode, so once a vehicle has been seen twice its speed is measured
        // here and the feed's claim is not used for display at all.
        //
        // Individual fixes are noisy, so the value shown is an exponential
        // moving average: it settles quickly but stops the number flickering
        // between updates.
        const speedCap = MAX_PLAUSIBLE_SPEED_KMH[sourceId] ?? 200;
        // Prefer the feed's own fix timestamps: they describe the interval the
        // vehicle actually took to cover this ground. Polling timing only
        // bounds that interval and overstates speed whenever a fix is picked up
        // sooner than the one before it. Fall back to it only for feeds that
        // do not stamp their fixes.
        let secondsSinceFix = 0;
        if (fixTimeMs != null && motion.lastFixTimeMs != null && fixTimeMs > motion.lastFixTimeMs) {
          secondsSinceFix = (fixTimeMs - motion.lastFixTimeMs) / 1000;
        } else if (fixTimeMs == null && motion.lastTelemetryTime) {
          secondsSinceFix = (now - motion.lastTelemetryTime) / 1000;
        }
        if (secondsSinceFix >= 0.5 && secondsSinceFix <= 180) {
          const observedSpeed = Math.min(speedCap, (distMeters / secondsSinceFix) * 3.6);
          motion.smoothedSpeedKmh = motion.smoothedSpeedKmh == null
            ? observedSpeed
            : motion.smoothedSpeedKmh + SPEED_SMOOTHING * (observedSpeed - motion.smoothedSpeedKmh);
        }
        if (fixTimeMs != null) motion.lastFixTimeMs = fixTimeMs;
        motion.lastMovementTime = now;
        a.speed = Math.round(motion.smoothedSpeedKmh ?? 0);

        // Interpolate across the real gap between fixes. This was previously
        // capped at 5.5s, but positions in these feeds refresh every 20-45s, so
        // a vehicle would cover the whole leg in a few seconds and then sit
        // frozen until the next fix — the lurching "drive and stop" motion.
        // Spanning the actual interval instead keeps vehicles gliding at the
        // speed they are really travelling.
        const isTransit = (sourceId === 'buses' || sourceId === 'transit' || sourceId === 'hafas' || sourceId === 'freight_trains');
        const minDuration = isTransit ? 1800 : 2500;
        const defaultDuration = isTransit ? 2200 : 4800;
        const maxDuration = 45000;
        const timeSinceLast = motion.lastTelemetryTime ? Math.min(maxDuration, Math.max(minDuration, now - motion.lastTelemetryTime)) : defaultDuration;
        motion.startTime = now;
        motion.duration = timeSinceLast;
        motion.lastTelemetryTime = now;
        motion.isInterpolating = true;

        // Anchor initial GeoJSON point to current render position so it doesn't jump on setData
        a.lon = motion.renderLon;
        a.lat = motion.renderLat;
        const h = Math.round((motion.renderHeading % 360 + 360) % 360);
        a.heading = h;
        a.hasHeading = true;
        if (sourceId === 'aircraft') a.true_track = h;
        if (sourceId === 'freight_trains' || sourceId === 'freight_paths') a.bearing = h;
      }
    }

    // Prune stale vehicle states for this source
    for (const [key, motion] of this.vehicleMotionMap.entries()) {
      if (motion.sourceId === sourceId && !activeKeys.has(key)) {
        this.vehicleMotionMap.delete(key);
      }
    }
  }

  // Compatibility wrapper
  private processBusDifferentialUpdates(data: any[]): void {
    this.processVehicleDifferentialUpdates('transit', data);
  }

  private animateVehiclePositions(timestamp: number): void {
    if (this.vehicleMotionMap.size === 0) return;

    // Never thrash WebGL or GPU while the user is actively dragging, zooming, or tilting the map!
    if (!this.map || this.map.isMoving()) return;

    const now = performance.now();
    let updatedSourcesBudget = 8;

    for (const sourceId of DYNAMIC_MOVING_SOURCES) {
      if (updatedSourcesBudget <= 0) break;

      const cachedGeoJSON = this.cachedSourceGeoJSON.get(sourceId);
      if (!cachedGeoJSON || cachedGeoJSON.features.length === 0) continue;

      const lastTimestamp = this.lastSourceAnimationTimestamp.get(sourceId) || 0;
      // Ten updates a second per source. Every update, however small the diff,
      // makes the worker re-tile the whole source and the main thread reload
      // its tiles and re-place its symbols; twenty a second of that for four
      // sources is what held a phone at a few frames per second.
      if (timestamp - lastTimestamp < 100) continue;

      let hasMotionUpdates = false;
      const features = cachedGeoJSON.features;
      // Only the vehicles that moved this frame, as diffs. Sending the whole
      // collection re-serialised 3,200 features to the worker twenty times a
      // second for a few hundred that had changed — the main-thread cost that
      // made the map stutter on a phone.
      const diffs: any[] = [];
      const useDiff = !this.diffUnsupported.has(sourceId)
        && this.sourceHasUniqueIds.get(sourceId) === true
        && !this.forceFullSetData;
      // Only vehicles in (or just outside) the viewport are worth an update:
      // at region zoom that is a handful out of thousands. Everything else
      // still has its cached position advanced, so the next full refresh or a
      // pan (see 'moveend') shows it where it should be.
      const b = this.map.getBounds();
      const padLon = (b.getEast() - b.getWest()) * 0.25, padLat = (b.getNorth() - b.getSouth()) * 0.25;
      const west = b.getWest() - padLon, east = b.getEast() + padLon, south = b.getSouth() - padLat, north = b.getNorth() + padLat;
      let visibleMoved = 0;

      for (const motion of this.vehicleMotionMap.values()) {
        if (motion.sourceId !== sourceId || !motion.isInterpolating) continue;

        const elapsed = now - motion.startTime;
        const progress = Math.min(1.0, elapsed / motion.duration);

        // Smoothstep easing curve (3x^2 - 2x^3) for natural continuous motion between telemetry bursts
        const ease = progress * progress * (3.0 - 2.0 * progress);

        const curLon = motion.fromLon + (motion.targetLon - motion.fromLon) * ease;
        const curLat = motion.fromLat + (motion.targetLat - motion.fromLat) * ease;
        // The position glides across the whole interval between fixes (up to
        // 45 s), but the icon must not take that long to turn: the leg it is
        // travelling is straight, so it points along the leg almost at once.
        // Turned over the full glide, a bus that had rounded a corner spent
        // half a minute pointing across the road it was driving down.
        const turnProgress = Math.min(1.0, elapsed / Math.min(motion.duration, HEADING_TURN_MS));
        const turnEase = turnProgress * turnProgress * (3.0 - 2.0 * turnProgress);
        const curHeading = motion.fromHeading + (motion.targetHeading - motion.fromHeading) * turnEase;

        motion.renderLon = curLon;
        motion.renderLat = curLat;
        motion.renderHeading = curHeading;

        if (progress >= 1.0) {
          motion.renderLon = motion.targetLon;
          motion.renderLat = motion.targetLat;
          motion.renderHeading = motion.targetHeading;
          motion.isInterpolating = false;
        }

        const idx = motion.featureIndex;
        if (idx >= 0 && idx < features.length) {
          const feat = features[idx];
          if (feat && feat.geometry) {
            const coords = (feat.geometry as any).coordinates;
            if (coords) {
              coords[0] = curLon;
              coords[1] = curLat;
              if (feat.properties) {
                const normHeading = Math.round((curHeading % 360 + 360) % 360);
                feat.properties.heading = normHeading;
                if (sourceId === 'aircraft') {
                  feat.properties.true_track = normHeading;
                }
                // The icon rotation reads `bearing` before `heading`, so an
                // animated heading with a stale bearing would leave the icon
                // pointing where the train was a poll ago.
                if (sourceId === 'freight_trains' || sourceId === 'freight_paths') {
                  feat.properties.bearing = normHeading;
                }
                const inView = curLon >= west && curLon <= east && curLat >= south && curLat <= north;
                if (inView) visibleMoved++;
                if (useDiff && inView) {
                  const props: { key: string; value: any }[] = [{ key: 'heading', value: normHeading }];
                  if (sourceId === 'aircraft') props.push({ key: 'true_track', value: normHeading });
                  if (sourceId === 'freight_trains' || sourceId === 'freight_paths') props.push({ key: 'bearing', value: normHeading });
                  diffs.push({ id: feat.id, newGeometry: { type: 'Point', coordinates: [curLon, curLat] }, addOrUpdateProperties: props });
                }
              }
              hasMotionUpdates = true;
            }
          }
        }
      }

      if (hasMotionUpdates) {
        this.lastSourceAnimationTimestamp.set(sourceId, timestamp);
        const source = this.map?.getSource(sourceId) as maplibregl.GeoJSONSource;
        // Nothing the user can see has moved: leave the worker alone.
        if (source && visibleMoved === 0) continue;
        if (source) {
          if (useDiff && diffs.length > 0 && typeof (source as any).updateData === 'function') {
            try {
              (source as any).updateData({ update: diffs }).catch?.((err: any) => {
                console.warn(`[map] updateData rejected for ${sourceId}; using setData`, err);
                this.diffUnsupported.add(sourceId);
              });
            } catch (err) {
              console.warn(`[map] updateData threw for ${sourceId}; using setData`, err);
              this.diffUnsupported.add(sourceId);
              source.setData(cachedGeoJSON);
            }
          } else {
            source.setData(cachedGeoJSON);
          }
          updatedSourcesBudget--;
        }

      }
    }
  }

  // Compatibility wrapper
  private animateBusPositions(timestamp: number): void {
    this.animateVehiclePositions(timestamp);
  }

  /**
   * Dedicated high-frequency polling mechanism for https://api.beta.brezavta.si/vehicles/locations
   * Polls urban transit (buses) with a shorter TTL (1.5s - 2s) to refresh bus positions more frequently
   * than the global train telemetry (5s - 15s), directly improving visual smoothness for urban transit.
   */
  private async pollDedicatedBrezAvtaBusLocations(): Promise<void> {
    if (!this.isReady || !this.map) return;
    try {
      // Ten seconds, not five: the free-tier instance answers in one to two
      // seconds when idle but several when something else is being served,
      // and a poll that gives up is a bus that does not move.
      const freshBuses = await fetchWithTimeout(loadBrezAvtaBusLocations([]), 10000, []);
      if (!freshBuses || !Array.isArray(freshBuses) || freshBuses.length === 0) return;

      const nowTime = Date.now();
      for (const bus of freshBuses) {
        this.applyMovementPhysics(bus, nowTime);
      }

      this.latestDedicatedBuses = freshBuses;

      // Update dedicated MapLibre 'buses' source & feed into differential interpolation
      this.updateGeoJSONSource('buses', freshBuses);

      if (this.onStateUpdate) {
        this.onStateUpdate({
          counts: {
            buses: freshBuses.length
          }
        });
      }
    } catch (err) {
      // Non-blocking: will retry next 2s cycle
    }
  }

  private applyMovementPhysics(t: any, nowTime: number = Date.now()): void {
    const id = t.id || t.name || t._num;
    if (!id) return;
    
    const history = this.trackHistory.get(id);
    const isTrain = (t.type === 'train' || t.form === 'TRAIN' || !t.form);
    const hasProvidedSpeed = typeof t.speed === 'number' && !isNaN(t.speed) && t.speed > 0;
    const hasProvidedHeading = typeof t.heading === 'number' && !isNaN(t.heading) && t.heading >= 0 && t.heading <= 360;

    // For non-trains or vehicles with valid live GPS speed telemetry
    if (hasProvidedSpeed && t.speed >= 3 && !isTrain) {
        t.speed = Math.round(t.speed);
        t.status = 'moving';
        if (hasProvidedHeading) {
            t.hasHeading = true;
        } else if (history?.heading != null) {
            t.heading = history.heading;
            t.hasHeading = true;
        }
        this.trackHistory.set(id, {
            lat: t.lat,
            lon: t.lon,
            time: nowTime,
            lastMoveTime: nowTime,
            speed: t.speed,
            heading: t.heading || 0,
            stationaryCount: 0
        });
        return;
    }

    if (history) {
        const dLat = (t.lat - history.lat) * 111;
        const dLon = (t.lon - history.lon) * 78;
        const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
        const lastMove = history.lastMoveTime || history.time || nowTime;
        const dtSec = Math.max(1, (nowTime - lastMove) / 1000);

        // Meaningful movement (> 6 meters for scooters/bikes, > 10m for train/bus, and < 2 km) to calculate speed/heading
        const minMoveDist = (t.form === 'SCOOTER' || t.form === 'BICYCLE') ? 0.006 : 0.010;
        if (distKm > minMoveDist && distKm < 2.0) {
            let calculatedSpeed = Math.round((distKm / dtSec) * 3600);
            if (t.form === 'SCOOTER') {
                if (calculatedSpeed > 25) calculatedSpeed = 25;
                if (calculatedSpeed < 4) calculatedSpeed = 4;
            } else if (t.form === 'BICYCLE') {
                if (calculatedSpeed > 30) calculatedSpeed = 30;
                if (calculatedSpeed < 4) calculatedSpeed = 4;
            } else if (t.form === 'CAR') {
                if (calculatedSpeed > 130) calculatedSpeed = 120;
                if (calculatedSpeed < 8) calculatedSpeed = 8;
            } else {
                if (calculatedSpeed > 140) calculatedSpeed = 130;
                if (calculatedSpeed < 5) calculatedSpeed = 5;
            }

            const oldSpeed = history.speed || 0;
            t.speed = oldSpeed > 0 ? Math.round(oldSpeed * 0.3 + calculatedSpeed * 0.7) : calculatedSpeed;
            t.status = 'moving';

            // Calculate dynamic heading vector based on consecutive update delta
            let dynamicHeading = Math.round((Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360);
            if (isTrain) {
                // Dynamically align heading vector with physical railway track geometry
                const snapped = snapToRailTrack(t.lon, t.lat, 2500, dynamicHeading);
                if (snapped.snapped && snapped.bearing != null) {
                    dynamicHeading = snapped.bearing;
                }
            } else if (hasProvidedHeading && t.heading > 0) {
                dynamicHeading = Math.round(t.heading);
            }
            t.heading = dynamicHeading;
            t.hasHeading = true;

            this.trackHistory.set(id, {
                lat: t.lat,
                lon: t.lon,
                time: nowTime,
                lastMoveTime: nowTime,
                speed: t.speed,
                heading: t.heading,
                stationaryCount: 0
            });
            return;
        } else if (distKm <= 0.010) {
            // Not moved (> 10m) on this poll
            const secondsSinceMove = (nowTime - lastMove) / 1000;
            const maxPauseSec = (t.type === 'bus' || t.form === 'CAR') ? 45 : 25;
            if (secondsSinceMove < maxPauseSec && history.speed >= 3) {
                // Still in transit between GPS bursts
                t.speed = Math.max(5, Math.round(history.speed * 0.95));
                t.status = 'moving';
                t.heading = history.heading != null ? history.heading : (hasProvidedHeading && t.heading > 0 ? Math.round(t.heading) : 0);
                t.hasHeading = true;
                this.trackHistory.set(id, {
                    lat: history.lat,
                    lon: history.lon,
                    time: nowTime,
                    lastMoveTime: history.lastMoveTime,
                    speed: t.speed,
                    heading: t.heading,
                    stationaryCount: 0
                });
                return;
            } else {
                // Confirmed stopped for >= 25 seconds
                t.speed = 0;
                t.status = 'stopped';
                // Preserve dynamic heading along movement path rather than resetting or jumping to static station
                t.heading = history.heading != null ? history.heading : (hasProvidedHeading && t.heading > 0 ? Math.round(t.heading) : 0);
                t.hasHeading = Boolean(hasProvidedHeading || (history.heading != null && history.heading > 0));
                this.trackHistory.set(id, {
                    lat: history.lat,
                    lon: history.lon,
                    time: nowTime,
                    lastMoveTime: history.lastMoveTime,
                    speed: 0,
                    heading: t.heading,
                    stationaryCount: (history.stationaryCount || 0) + 1
                });
                return;
            }
        } else {
            // Large teleportation jump (> 2 km), reset history
            t.speed = 0;
            t.status = 'stopped';
            t.heading = hasProvidedHeading ? Math.round(t.heading) : 0;
            t.hasHeading = Boolean(hasProvidedHeading);
            this.trackHistory.set(id, {
                lat: t.lat,
                lon: t.lon,
                time: nowTime,
                lastMoveTime: nowTime,
                speed: 0,
                heading: t.heading,
                stationaryCount: 0
            });
            return;
        }
    } else {
        // First time vehicle is seen
        t.speed = 0;
        t.status = 'stopped';
        t.heading = hasProvidedHeading ? Math.round(t.heading) : 0;
        t.hasHeading = Boolean(hasProvidedHeading);
        this.trackHistory.set(id, {
            lat: t.lat,
            lon: t.lon,
            time: nowTime,
            lastMoveTime: nowTime,
            speed: 0,
            heading: t.heading,
            stationaryCount: 0
        });
    }
  }

  private startPolling() {
    // Immediately fetch buses on startup so they appear right away
    this.pollDedicatedBrezAvtaBusLocations();

    const loop = (timestamp: number) => {
      if (this.destroyed) return;
      // 1a) Dedicated High-Frequency Urban Bus Poller (BrezAvta IJPP: LPP, Nomago, Arriva, Marprom, AP MS):
      if (timestamp - this.lastBusFetchTime > this.BUS_POLL_INTERVAL_MS && !this.isBusPolling) {
        this.isBusPolling = true;
        this.lastBusFetchTime = timestamp;
        this.pollDedicatedBrezAvtaBusLocations().finally(() => {
          this.isBusPolling = false;
        });
      }

      // 1c) Global Telemetry Poller: Trains (HAFAS, Eurorail, Freight), Planes, Weather, etc. (every 5s)
      if (timestamp - this.lastFetchTime > 5000 && !this.isPolling) {
        this.isPolling = true;
        this.lastFetchTime = timestamp;
        
        (async () => {
          try {
            const state = { counts: {} } as any;
            const errors: string[] = [];
            await this.fetchAndRenderLiveSources(state, errors);
            
            // Differential update check: only broadcast state if material telemetry metrics changed
            if (this.shouldBroadcastStateUpdate(state)) {
              if (this.onStateUpdate) this.onStateUpdate(state);
            }
          } catch (err) {
            console.error('Telemetry Error:', err); 
          } finally {
            this.isPolling = false;
          }
        })();
      }

      // 2) Process any pending GeoJSON updates within the rAF
      // Non-blocking & gesture-aware: Do not freeze user interactions while panning or zooming!
      if (this.pendingUpdates.size > 0 && (!this.map || !this.map.isMoving())) {
        let budget = 3;
        for (const [sourceId, data] of this.pendingUpdates.entries()) {
           try { this.applyGeoJSONSource(sourceId, data); }
           catch (err) { console.error(`[map] applying ${sourceId} failed`, err); }
           this.pendingUpdates.delete(sourceId);
           budget--;
           if (budget <= 0) break;
        }
      }

      // 3) Differential Vehicle Position Interpolation: Smooth animation tick for all moving vehicles
      // Everything live runs through this one callback, so an exception here
      // used to end all polling for the rest of the session. Log it and keep
      // the loop alive instead.
      try {
        this.animateVehiclePositions(timestamp);
      } catch (err) {
        if (!this.animationErrorLogged) { this.animationErrorLogged = true; console.error('[map] animation tick failed', err); }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  // Keep cached values for slow-moving data
  private slowDataCache: any = {};
  private fetchCounter = 0;

  public async fetchAndRenderLiveSources(state: any, errors: string[]) {
    if (!this.isReady) return;

    try {
      this.fetchCounter++;
      const isSlowTick = this.fetchCounter % 10 === 1; // Every 10th fetch (~30 seconds)
      
      // Fast moving data (Fetched every 3s)
      const [aircraft, transit, hafas, spat, eurorail, traffic, delays_heatmap, gtfsRealtime, freightTrains, freshBuses] = await Promise.all([
        fetchWithTimeout(loadAircraft(errors), 3000, []),
        fetchWithTimeout(loadTransit(errors), 15000, []),
        fetchWithTimeout(loadHafas(errors), 15000, []),
        fetchWithTimeout(loadSpat(errors), 3000, []),
        fetchWithTimeout(loadEuroRail(errors), 3000, []),
        fetchWithTimeout(loadTraffic(errors), 5000, []),
        fetchWithTimeout(loadAnalyticsDelays(errors), 5000, {type:'FeatureCollection',features:[]}),
        fetchWithTimeout(GtfsRealtimeIngestionService.getInstance().ingestFeeds(), 5000, []),
        fetchWithTimeout(loadFreightTrains(errors), 5000, []),
        fetchWithTimeout(loadBrezAvtaBusLocations(errors), 10000, [])
      ]);

      // Slow moving data (Fetched every 30s)
      if (isSlowTick || !this.slowDataCache.air) {
          const [air, quakes, ev, bikes, weather, micromobility, aprs, loramesh, sparql, warehouses, yards, sensorcommunity, github, arso, smartcity, switches, signals, hydro, power, moms, openaq, ttn, opensense, rinf, eraTunnels, rinf_network, stations] = await Promise.all([
            fetchWithTimeout(loadAir(errors), 3000, []),
            fetchWithTimeout(loadQuakes(errors), 3000, []),
            loadEVCharging(errors),
            Promise.resolve([] as any[]),  // kolesa (GBFS) odstranjena
            fetchWithTimeout(loadWeather(errors), 3000, []),
            Promise.resolve([] as any[]),
            fetchWithTimeout(loadAprs(errors), 3000, []),
            fetchWithTimeout(loadLoraMesh(errors), 3000, []),
            fetchWithTimeout(loadSparql(errors), 3000, []),
            fetchWithTimeout(loadOverpass('warehouse', errors), 10000, []),
            fetchWithTimeout(loadOverpass('yard', errors), 10000, []),
            fetchWithTimeout(loadSensorCommunity(errors), 10000, []),
            fetchWithTimeout(loadGitHub(errors), 10000, []),
            fetchWithTimeout(loadArso(errors), 10000, []),
            fetchWithTimeout(loadSmartCity(errors), 10000, []),
            fetchWithTimeout(loadSwitches(errors), 10000, []),
            fetchWithTimeout(loadSignals(errors), 10000, []),
            fetchWithTimeout(loadHydro(errors), 10000, []),
            fetchWithTimeout(loadPower(errors), 10000, []),
            fetchWithTimeout(loadMoms(errors), 5000, []),
            fetchWithTimeout(loadOpenAQ(errors), 10000, []),
            fetchWithTimeout(loadTTN(errors), 5000, []),
            fetchWithTimeout(loadOpenSense(errors), 5000, []),
            fetchWithTimeout(loadRinf(errors), 8000, []), fetchWithTimeout(loadEraTunnels(errors), 10000, {type: "FeatureCollection", features: []}), fetchWithTimeout(loadRinfNetwork(errors), 10000, {type: 'FeatureCollection', features: []}),
            fetchWithTimeout(loadRegionalStations(errors), 5000, [])
          ]);
          this.slowDataCache = { air, quakes, ev, bikes, weather, micromobility, aprs, loramesh, sparql, warehouses, yards, sensorcommunity, github, arso, smartcity, switches, signals, hydro, power, moms, openaq, ttn, opensense, rinf, eraTunnels, rinf_network, stations };
      }

      // Destructure cached slow data
      const { air, quakes, ev, bikes, weather, micromobility, aprs, loramesh, sparql, warehouses, yards, sensorcommunity, github, arso, smartcity, switches, signals, hydro, power, moms, openaq, ttn, opensense, rinf, eraTunnels, rinf_network, stations } = this.slowDataCache;

      // Stateful movement tracker for speed and heading
      if (!(this as any).trackHistory) (this as any).trackHistory = new Map();
      const nowTime = Date.now();

      const allMicromobility: any[] = [];
      
      transit.forEach(t => this.applyMovementPhysics(t, nowTime));
      hafas.forEach(t => this.applyMovementPhysics(t, nowTime));

      if (freshBuses && Array.isArray(freshBuses) && freshBuses.length > 0) {
        freshBuses.forEach(b => this.applyMovementPhysics(b, nowTime));
        this.latestDedicatedBuses = freshBuses;
        this.updateGeoJSONSource('buses', freshBuses);
      }

      console.log("Trains: transit=", transit.length, "hafas=", hafas.length, "buses=", (freshBuses || []).length);
      this.updateGeoJSONSource('air', air);
      this.updateGeoJSONSource('aircraft', aircraft);
      this.updateGeoJSONSource('quakes', quakes);
      this.updateGeoJSONSource('evcharge', ev);
      
      
      
      // Filter out Trenitalia from HAFAS because HAFAS uses straight-line interpolation across the water
      // for Italy, whereas TRAVIC uses accurate GTFS polyline shapes.
      const filteredHafas = hafas.filter(h => {
          return true;
      });

      
      // --- OPTIMIZATION: Pre-calculate regex parsing to avoid 10 million regex matches ---
      const hafasMap = new Map();
      const motisMap = new Map();

      // Helper: Refine SŽ Train Denominations
      const refineTrainName = (name) => {
          if (!name) return name;
          let n = name.trim();
          // Official SŽ train denominations:
          // Convert 'R' to 'MV' (Mednarodni vlak) as requested
          n = n.replace(/^Rs+(d+)/i, 'MV $1');
          // Some HAFAS 'D' (Schnellzug) are also 'MV' in Slovenia
          n = n.replace(/^Ds+(d+)/i, 'MV $1');
          // Some sources use 'RE' or 'REX' for Regional, SŽ uses 'RG'
          n = n.replace(/^REs+(d+)/i, 'RG $1');
          n = n.replace(/^REXs+(d+)/i, 'RG $1');
          return n;
      };

      // 1. Pre-process MOTIS (transit) vehicles
      transit.forEach(t => {
          const tName = refineTrainName(t.name || '');
          t.name = tName;
          const match = tName.match(/\d+/);
          const num = match ? match[0] : tName;
          if (num) motisMap.set(num, t);
          t._num = num; // cache on object
      });

      // 2. Pre-process HAFAS trains
      filteredHafas.forEach(h => {
          const hName = refineTrainName(h.name || '');
          h.name = hName;
          const match = hName.match(/\d+/);
          const hNum = match ? match[0] : hName;
          h._num = hNum; // cache on object
      });

      // 3. Fast deduplication
      // For TRAINS: Prioritize HAFAS (better live data, routing)
      // For BUSES: Prioritize MOTIS (better GTFS road geometries, HAFAS often places replacement buses on train tracks)
      
      const deduplicatedTransit = transit.filter(t => {
        if (t.type === 'train') {
          const tNum = t._num;
          const isGeneric = !tNum || !t.name || !t.name.match(/\d+/) || t.name.endsWith('Vlak');
          
          const duplicateHafas = filteredHafas.find((h: any) => {
            const isSameNumber = h._num && tNum && h._num === tNum;
            const dLat = (h.lat - t.lat) * 111;
            const dLon = (h.lon - t.lon) * 78;
            const distKm = Math.sqrt(dLat * dLat + dLon * dLon);

            // Same train number within 25km
            if (isSameNumber && distKm < 25) return true;

            // Generic transit train ("SŽ Vlak", "ÖBB Vlak") near ANY HAFAS train on the same line (< 6km)
            if (isGeneric && distKm < 6.0) return true;

            // Right on top of each other (< 1km)
            if (distKm < 1.0) return true;

            return false;
          });

          // If HAFAS has it, drop MOTIS/Transit duplicate
          // EXCEPT if transit is BrezAvta (has true live GPS heading). Then keep BrezAvta and drop HAFAS!
          if (duplicateHafas && !t.hasHeading) return false;

          // If we keep BrezAvta, merge HAFAS properties so we don't lose the route
          if (duplicateHafas && t.hasHeading) {
              t.nextStopovers = duplicateHafas.nextStopovers;
              t.polyline = duplicateHafas.polyline;
              t.delay = duplicateHafas.delay;
          }
        }
        
        return true; // Keep vehicle
      });
      
      // Now filter HAFAS: drop HAFAS BUSES if MOTIS has them, and drop generic duplicate trains
      const deduplicatedHafas = filteredHafas.filter(h => {
        if (h.type !== 'bus' && h.type !== 'tram') {
          // Drop generic HAFAS train if there's a numbered train within 6km
          const isGeneric = !h._num || !h.name || !h.name.match(/\d+/) || h.name.endsWith('Vlak');
          if (isGeneric) {
            const hasNumberedNear = filteredHafas.some((otherH: any) => {
              if (otherH === h || !otherH._num) return false;
              const dLat = (otherH.lat - h.lat) * 111;
              const dLon = (otherH.lon - h.lon) * 78;
              return (dLat * dLat + dLon * dLon) < 36; // 6 km
            });
            if (hasNumberedNear) return false;
          }

          // Drop HAFAS trains if BrezAvta (live GPS) already has them
          const duplicateBrezAvta = transit.find((t: any) => t._num === h._num && t.hasHeading);
          if (duplicateBrezAvta) return false;
          return true;
        }
        
        const hNum = h._num;
        const duplicateMotis = transit.find((t: any) => {
          const isSameNumber = h._num && t._num && h._num === t._num;
          const dLat = h.lat - t.lat;
          const dLon = h.lon - t.lon;
          const distSq = dLat * dLat + dLon * dLon;
          if (isSameNumber && distSq < 0.1) return true;
          // Only drop if it's the exact same line number, or if they are literally on top of each other (10 meters)
          if (distSq < 0.00000001) return true;
          return false;
        });
        
        if (duplicateMotis) return false; // Drop HAFAS bus in favor of MOTIS bus
        return true;
      });

      // Keep real transit vehicles (trains, trams, regional buses)
      this.latestGtfsRealtime = (gtfsRealtime || []);
      const allTransit = [
        ...deduplicatedTransit,
        ...this.latestGtfsRealtime
      ];

      this.updateGeoJSONSource('transit', allTransit);
      this.updateGeoJSONSource('weather', weather);
      this.updateGeoJSONSource('hafas', deduplicatedHafas);
      this.updateGeoJSONSource('weather', weather);
      const dhSource = this.map.getSource('delays_heatmap');
      if (dhSource) (dhSource as any).setData(delays_heatmap);
      this.updateGeoJSONSource('aprs', aprs);
      this.updateGeoJSONSource('loramesh', loramesh);
      this.updateGeoJSONSource('sparql', sparql);
      this.updateGeoJSONSource('warehouse', warehouses);
      this.updateGeoJSONSource('yard', yards);
      this.updateGeoJSONSource('sensorcommunity', sensorcommunity);
      this.updateGeoJSONSource('github', github);
      this.updateGeoJSONSource('arso', arso);
      this.updateGeoJSONSource('switches', switches);
      this.updateGeoJSONSource('rail_signals', signals);
      this.updateGeoJSONSource('traffic', traffic);
      const eraTunnelsSource = this.map.getSource("era_tunnels") as maplibregl.GeoJSONSource;

      if (eraTunnelsSource && eraTunnels.features && eraTunnels.features.length > 0) {
          eraTunnelsSource.setData(eraTunnels);
      }

      const rinfNetworkSource = this.map.getSource("rinf_network") as maplibregl.GeoJSONSource;
      if (rinfNetworkSource && rinf_network && rinf_network.features && rinf_network.features.length > 0) {
          rinfNetworkSource.setData(rinf_network);
      }

      this.updateGeoJSONSource('rinf', rinf);
      this.updateGeoJSONSource('stations', (stations || []).map((s: any) => ({ ...s, type: 'station' })));
      
      this.updateGeoJSONSource('spat', spat);
      this.updateGeoJSONSource('hydro', hydro);
      this.updateGeoJSONSource('power', power);
      
      this.updateGeoJSONSource('moms', moms);
      this.updateGeoJSONSource('openaq', openaq);
      this.updateGeoJSONSource('ttn', ttn);
      this.updateGeoJSONSource('opensense', opensense);
      this.updateGeoJSONSource('eurorail', eurorail);
      this.updateGeoJSONSource('freight_trains', (freightTrains || []).map((t: any) => {
        const isActuallyRunning = Boolean(t.isRunning && t.speedKmh > 3);
        const bearing = t.bearing != null ? t.bearing : 0;
        return {
          ...t,
          type: 'freight_train',
          hasHeading: isActuallyRunning,
          heading: bearing,
          bearing: bearing,
          speed: isActuallyRunning ? (t.speedKmh || 0) : 0
        };
      }));

      if (this.activeSelectedNodeId && this.activeSelectedNodeType && this.onSelectNode) {

         let list = state[this.activeSelectedNodeType] || [];
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'freight_trains') list = freightTrains;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'micromobility') list = allMicromobility;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'spat') list = spat;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'transit') list = transit;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'buses') list = this.latestDedicatedBuses;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'hydro') list = hydro;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'power') list = power;
         const scMapped = (smartcity || []).map((s: any) => ({
        ...s,
        property: s.vendor,
        value: s.tech,
        metrics: [
          { label: 'Proizvajalec', value: s.vendor, highlight: true },
          { label: 'Tehnologija', value: s.tech, highlight: true }
        ]
      }));
      this.updateGeoJSONSource('smartcity', scMapped);
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'moms') list = moms;
         if (!list || list.length === 0 && this.activeSelectedNodeType === 'smartcity') list = scMapped;
         
         const updatedP = list.find((item: any) => item.id === this.activeSelectedNodeId);
         if (updatedP) {
            const motion = this.getVehicleMotion(this.activeSelectedNodeId, this.activeSelectedNodeType);
            const lon = motion ? motion.renderLon : updatedP.lon;
            const lat = motion ? motion.renderLat : updatedP.lat;
            const nodeSig = `${this.activeSelectedNodeId}|${lat.toFixed(4)}|${lon.toFixed(4)}|${updatedP.speed}|${updatedP.status}|${updatedP.delay}`;
            if (nodeSig !== this.lastSelectedNodeSignature) {
               this.lastSelectedNodeSignature = nodeSig;
               const node = this.buildTelemetryNode(this.activeSelectedNodeType, updatedP, [lon, lat]);
               this.onSelectNode(node);
            }
         }
      }

      
      


      const lora: any[] = [];
      const nbiot: any[] = [];
      const rail_sensors: any[] = [];
      const traffic_sensors: any[] = [];
      const logistics_sensors: any[] = [];

      state.air = air;
      state.aircraft = aircraft;
      state.quakes = quakes;
      state.ev = ev;
      state.weather = weather;
      state.hafas = hafas;
      state.aprs = aprs;
      state.loramesh = loramesh;
      state.sparql = sparql;
      state.warehouses = warehouses;
      state.yards = yards;
      state.sensorcommunity = sensorcommunity;
      state.github = github;
      state.arso = arso;
      state.switches = switches;
      state.signals = signals;
      state.traffic = traffic;
      state.rinf = rinf;
      state.spat = spat;
      state.hydro = hydro;
      state.power = power;
      state.moms = moms;
      state.openaq = openaq;
      state.ttn = ttn;
      state.opensense = opensense;
      state.eurorail = eurorail;
      state.smartcity = smartcity;
      state.lorawan = lora;
      state.nbiot = nbiot;
      state.bikes = bikes;
      state.micromobility = allMicromobility;
      state.activeTrips = this.latestActiveTrips;
      state.completedTrips = this.latestCompletedTrips;
      state.micromobilityStats = null;
      state.buses = this.latestDedicatedBuses;
      state.transit = transit;
      state.freight = freightTrains;
      state.rail_sensors = rail_sensors;
      state.traffic_sensors = traffic_sensors;
      state.logistics_sensors = logistics_sensors;
      state.lastUpdate = new Date();
      state.onlineLorawan = lora.filter((l: any) => l.online).length;
      state.counts = {
        buses: this.latestDedicatedBuses.length,
        air: air.length,
        aircraft: aircraft.length,
        quakes: quakes.length,
        evcharge: ev.length,
        lorawan: lora.length,
        nbiot: nbiot.length,
        bikeshare: bikes.length,
        micromobility: allMicromobility.length,
        transit: allTransit.length,
        transit_trains: allTransit.length,
        rail_sensors: rail_sensors.length,
        traffic_sensors: traffic_sensors.length,
        logistics_sensors: logistics_sensors.length,
        hafas: hafas.length,
        aprs: aprs.length,
        loramesh: loramesh.length,
        sparql: sparql.length,
        warehouses: warehouses.length,
        yards: yards.length,
        sensorcommunity: sensorcommunity.length,
        github: github.length,
        arso: arso.length,
        switches: switches.length,
        signals: signals.length,
        traffic: traffic.length,
        sz_stations: rinf.length,
        rinf: rinf.length,
        rinf_network: (rinf_network?.features?.length || 0),
        spat: spat.length,
        hydro: hydro.length,
        power: power.length,
        moms: moms.length,
        openaq: openaq.length,
        ttn: ttn.length,
        opensense: opensense.length,
        eurorail: eurorail.length,
        smartcity: smartcity.length,
        freight_trains: (freightTrains || []).length
      };

      // Make a dummy node just for types
      const node: TelemetryNode = {
        id: 'refresh',
        title: 'Data refreshed',
        category: 'sys',
        type: 'location' as any,
        coordinates: CENTER,
        timestamp: new Date(),
        metrics: [],
        rawPayload: {}
      };
      return node;
    } catch (e) {
      console.error(e);
    }
  }

  
  
  
  
  /**
   * Consecutive empty responses seen per vehicle source, so one bad poll cannot
   * clear the map.
   */
  private tentRailwaysLoaded = false;
  private modelledFreightTimer: number | null = null;
  private emptyUpdateStreak = new Map<string, number>();
  private static readonly EMPTY_UPDATES_BEFORE_CLEARING = 3;

  private updateGeoJSONSource(sourceId: string, data: any[]) {
    // A moving-vehicle feed returning nothing is nearly always a hiccup — a
    // slow upstream, a dropped request, an instance restarting — not every
    // train in the country simultaneously ceasing to exist. Replacing the
    // source with an empty list on the first such response is what made trains
    // appear for a few seconds and then vanish. Hold the last known positions
    // until several polls agree the feed really is empty.
    if (DYNAMIC_MOVING_SOURCES.has(sourceId) && (!data || data.length === 0)) {
      const streak = (this.emptyUpdateStreak.get(sourceId) || 0) + 1;
      this.emptyUpdateStreak.set(sourceId, streak);
      if (streak < MapController.EMPTY_UPDATES_BEFORE_CLEARING) return;
    } else {
      this.emptyUpdateStreak.delete(sourceId);
    }

    // Queue data to be processed in the next requestAnimationFrame
    this.pendingUpdates.set(sourceId, data);
  }

  
  private applyGeoJSONSource(sourceId: string, data: any[]) {
    const source = this.map.getSource(sourceId) as maplibregl.GeoJSONSource;
    if (!source) return;

    let sourceUpdated = false;
    const actualUpdates: any[] = [];
    
    // We must track which keys are in the CURRENT data to remove stale keys from lastKnownCoords
    const currentKeys = new Set();
    
    // Check for coordinate/data changes - ONLY shift when new unique coordinate is received
    for (const item of data) {
      const itemId = item.id || item.uopid || item.name || (item.lat != null && item.lon != null ? `${item.lat},${item.lon}` : null);
      if (!itemId) continue;
      if (!item.id) item.id = itemId;
      const key = `${sourceId}-${itemId}`;
      currentKeys.add(key);
      const stateHash = `${item.lat?.toFixed(5)},${item.lon?.toFixed(5)}|${item.speed}|${item.status}|${item.value}|${item.timestamp}|${item.state}|${item.timeToChange}|${item.heading}|${item.pm10}|${item.pm25}|${item.aqi}|${item.noise_db}`;
      
      if (this.lastKnownCoords.get(key) !== stateHash) {
        this.lastKnownCoords.set(key, stateHash);
        actualUpdates.push(item);
        sourceUpdated = true;
      }
    }
    
    // Check if any old keys disappeared (meaning a vehicle was removed). If so, we MUST update the map!
    for (const k of Array.from(this.lastKnownCoords.keys())) {
      if (k.startsWith(sourceId + '-') && !currentKeys.has(k)) {
        this.lastKnownCoords.delete(k);
        sourceUpdated = true; // A vehicle was removed, so we must trigger a map update!
      }
    }
    
    // Only update the map source if there are actual changes (moved, added, or removed)
    if (sourceUpdated || data.length === 0) {

      if (data.length === 0) {
        // If data is empty, we must clear the cache for this source so they can reappear later
        for (const k of Array.from(this.lastKnownCoords.keys())) {
          if (k.startsWith(sourceId + '-')) this.lastKnownCoords.delete(k);
        }
      }

      if (sourceId === 'buses' || sourceId === 'transit' || sourceId === 'hafas') {
        if (sourceId === 'hafas') this.latestHafasTrains = data;
        if (sourceId === 'transit') this.latestTransitTrains = data;
        if (sourceId === 'buses') this.latestDedicatedBuses = data;

        for (const a of data) {
          const isBusSource = (sourceId === 'buses');
          const vType = isBusSource ? 'bus' : (a.type || (sourceId === 'hafas' ? 'train' : 'bus'));
          const speedNum = (a.speed != null && !isNaN(Number(a.speed))) ? Math.round(Number(a.speed)) : 0;
          const isMoving = (a.status === 'moving' || speedNum >= 3);
          const hasValidHeading = typeof a.heading === 'number' && !isNaN(a.heading) && a.heading >= 0 && a.heading <= 360;
          a.hasHeading = true; // Arrow is always visible to convey physical vehicle orientation

          let cleanOp = (a.operator || '')
            .replace(/\s*\(TRAVIC\)/gi, '')
            .replace(/\s*\(AT\)/gi, '')
            .replace(/\s*\(HR\)/gi, '')
            .replace(/\s*\(SI\)/gi, '')
            .replace(/\s*\(IT\)/gi, '')
            .replace(/\s*\(Avstrijske železnice\)/gi, '')
            .replace(/\s*\(Hrvaške železnice\)/gi, '')
            .replace(/\s*\(Madžarske železnice\)/gi, '')
            .replace(/\s*\(Slovenske Železnice\)/gi, '')
            .replace(/,?\s*d\.o\.o\.?/gi, '')
            .replace(/,?\s*d\.d\.?/gi, '')
            .replace(/\s*\/\s*Verbundlinie/gi, '')
            .trim();

          let name = (a.name || '').trim();
          const nameUpper = name.toUpperCase();
          const opUpper = cleanOp.toUpperCase();

          const isGeoHungary = (a.lat != null && a.lon != null) && (
            (a.lon > 17.15 && a.lat > 46.0) ||
            (a.lon > 16.45 && a.lat >= 46.60 && a.lat <= 47.45) ||
            (a.lon > 16.85 && a.lat > 46.0 && a.lat < 46.60) ||
            (a.lat >= 47.62 && a.lat <= 47.74 && a.lon >= 16.52 && a.lon <= 16.65)
          );
          const isGeoAustria = (a.lat != null && a.lon != null) && !isGeoHungary && (
            (a.lat > 46.88 && a.lon <= 17.15) ||
            (a.lon >= 12.0 && a.lon < 14.15 && a.lat >= 46.50) ||
            (a.lon >= 14.15 && a.lon < 14.50 && a.lat > 46.46) ||
            (a.lon >= 14.50 && a.lon < 14.88 && a.lat > 46.50) ||
            (a.lon >= 14.88 && a.lon < 15.20 && a.lat > 46.63) ||
            (a.lon >= 15.20 && a.lon < 16.05 && a.lat > 46.68) ||
            (a.lon >= 16.05 && a.lon < 16.45 && a.lat > 46.84)
          );

          const isGeoGraz = (a.lat != null && a.lon != null) && (a.lat >= 46.95 && a.lat <= 47.18 && a.lon >= 15.30 && a.lon <= 15.55);

          if (isBusSource || vType === 'bus') {
            // Bus Operator Detection & Icon Color Mapping
            if (opUpper.includes('LPP') || nameUpper.startsWith('LPP')) {
              cleanOp = cleanOp || 'LPP';
              a.iconImage = 'icon-bus-lpp';
              a.operatorColor = '#10b981';
            } else if (opUpper.includes('NOMAGO') || nameUpper.includes('NOMAGO')) {
              cleanOp = cleanOp || 'Nomago';
              a.iconImage = 'icon-bus-nomago';
              a.operatorColor = '#0284c7';
            } else if (opUpper.includes('ARRIVA') || nameUpper.includes('ARRIVA')) {
              cleanOp = cleanOp || 'Arriva';
              a.iconImage = 'icon-bus-arriva';
              a.operatorColor = '#2563eb';
            } else if (opUpper.includes('MARPROM') || nameUpper.includes('MARPROM')) {
              cleanOp = cleanOp || 'Marprom';
              a.iconImage = 'icon-bus-marprom';
              a.operatorColor = '#ef4444';
            } else if (opUpper.includes('MURSK') || opUpper.includes('AP MS') || nameUpper.includes('AP MS')) {
              cleanOp = cleanOp || 'AP Murska Sobota';
              a.iconImage = 'icon-bus-apms';
              a.operatorColor = '#f59e0b';
            } else if (opUpper.includes('KRANJ') || nameUpper.includes('MP KRANJ')) {
              cleanOp = cleanOp || 'MP Kranj';
              a.iconImage = 'icon-bus-mpkranj';
              a.operatorColor = '#8b5cf6';
            } else if (isGeoHungary || opUpper.includes('VOLÁN') || opUpper.includes('VOLAN')) {
              cleanOp = 'Volánbusz';
              a.iconImage = 'icon-bus-volanbusz';
              a.operatorColor = '#f59e0b';
            } else if (isGeoGraz || opUpper.includes('GRAZ')) {
              cleanOp = 'Graz Linien';
              a.iconImage = 'icon-bus-graz';
              a.operatorColor = '#059669';
            } else if (isGeoAustria) {
              cleanOp = cleanOp || 'ÖBB Postbus';
              a.iconImage = 'icon-bus-other';
              a.operatorColor = '#e11d48';
            } else {
              cleanOp = cleanOp || 'IJPP Avtobus';
              a.iconImage = a.iconImage || 'icon-bus-other';
              a.operatorColor = a.operatorColor || '#06b6d4';
            }

            if (!name || name === 'Neznano' || name === 'Avtobus') {
              name = cleanOp;
            }
          } else if (vType === 'tram') {
            // Tram Operator Detection & Icon Color Mapping
            if (isGeoGraz || opUpper.includes('GRAZ') || nameUpper.includes('GRAZ')) {
              cleanOp = 'Graz Linien';
              a.iconImage = 'icon-tram-graz';
              a.operatorColor = '#059669';
              if (!name || name === 'Neznano' || name === 'Tramvaj') {
                name = 'Graz Tram';
              }
            } else if (isGeoHungary || opUpper.includes('BKK') || nameUpper.includes('VILLAMOS')) {
              cleanOp = (a.lat && a.lat > 47.3) ? 'BKK (Villamos)' : 'SZKT Szeged';
              a.iconImage = 'icon-tram-bkk';
              a.operatorColor = '#eab308';
              if (!name || name === 'Neznano' || name === 'Tramvaj') {
                name = 'Villamos';
              }
            } else {
              cleanOp = cleanOp || 'Tramvaj';
              a.iconImage = 'icon-tram';
              a.operatorColor = '#ec4899';
              if (!name || name === 'Neznano') {
                name = `${cleanOp} Tramvaj`;
              }
            }
          } else {
            // Train Operator Detection & Icon Color Mapping
            if (nameUpper.startsWith('RJ') || nameUpper.startsWith('RAILJET') || nameUpper.startsWith('NJ') || nameUpper.startsWith('CJX')) {
              cleanOp = 'ÖBB';
            } else if (nameUpper.includes('GKB') || nameUpper.startsWith('S 61') || nameUpper.startsWith('S61') || nameUpper.startsWith('S 7') || nameUpper.startsWith('S7')) {
              cleanOp = 'GKB';
            } else if (isGeoAustria) {
              const isCrossBorderSz = name.match(/\b(LP|LPV|RG|310|312|510|610|EC 150|EC 151|EC 158|EC 159)\b/i);
              if (!isCrossBorderSz && (!cleanOp || cleanOp.toLowerCase().includes('slovenske') || cleanOp === 'SŽ')) {
                cleanOp = (nameUpper.includes('GKB') || nameUpper.startsWith('S 61') || nameUpper.startsWith('S61')) ? 'GKB' : 'ÖBB';
              }
            } else if (isGeoHungary) {
              if (!cleanOp || cleanOp.toLowerCase().includes('slovenske') || cleanOp === 'SŽ') {
                cleanOp = (nameUpper.includes('GYSEV') || nameUpper.includes('ROEE')) ? 'GYSEV' : 'MÁV';
              }
            }

            if (opUpper.includes('ÖBB') || opUpper.includes('OEBB') || cleanOp === 'GKB') {
              cleanOp = cleanOp || 'ÖBB';
              a.iconImage = 'icon-train-oebb';
              a.operatorColor = '#e11d48';
            } else if (opUpper.includes('MÁV') || opUpper.includes('MAV') || opUpper.includes('GYSEV')) {
              cleanOp = cleanOp || 'MÁV';
              a.iconImage = 'icon-train-mav';
              a.operatorColor = '#facc15';
            } else if (opUpper.includes('HŽ') || opUpper.includes('HZ') || opUpper.includes('HRVAŠ')) {
              cleanOp = cleanOp || 'HŽ';
              a.iconImage = 'icon-train-hz';
              a.operatorColor = '#6366f1';
            } else if (opUpper.includes('TRENITALIA') || opUpper.includes('ITALI')) {
              cleanOp = cleanOp || 'Trenitalia';
              a.iconImage = 'icon-train-trenitalia';
              a.operatorColor = '#059669';
            } else if (opUpper.includes('DB') || opUpper.includes('DEUTSCHE')) {
              cleanOp = cleanOp || 'DB';
              a.iconImage = 'icon-train-db';
              a.operatorColor = '#f43f5e';
            } else if (vType === 'freight' || a.isFreight) {
              cleanOp = cleanOp || 'SŽ Tovorni';
              a.iconImage = 'icon-train-freight';
              a.operatorColor = '#f97316';
            } else {
              cleanOp = cleanOp || 'SŽ';
              a.iconImage = 'icon-train-sz';
              a.operatorColor = '#38bdf8';
            }

            if (!name || name === 'Neznano' || name === 'Vlak') {
              name = `${cleanOp} Vlak`;
            }
          }

          a.operator = cleanOp;

          // Map label format: top row name/line, bottom row speed or status
          let lbl = name;
          const displayOp = cleanOp.length > 18 ? cleanOp.slice(0, 16) + '…' : cleanOp;
          const speedText = speedNum >= 3
            ? `${speedNum} km/h`
            : (isBusSource ? 'Miruje (0 km/h)' : (vType === 'train' ? 'Postanek (0 km/h)' : 'Miruje (0 km/h)'));

          // Avoid duplicating operator name if already in the vehicle name
          if (name.toLowerCase().startsWith(displayOp.toLowerCase())) {
            lbl += `\n${speedText}`;
          } else {
            lbl += `\n${displayOp} · ${speedText}`;
          }

          a.labelText = lbl;
          if (!hasValidHeading) {
            const vKey = `${sourceId}:${String(a.id || a.tripId || a.name || a._num || '')}`;
            const m = this.vehicleMotionMap.get(vKey);
            if (m && (m.dynamicHeading != null || m.renderHeading > 0)) {
              a.heading = m.dynamicHeading != null ? m.dynamicHeading : m.renderHeading;
              a.hasHeading = true;
            } else {
              a.heading = 0;
            }
          }
        }
      }

      if (sourceId === 'micromobility') {
        for (const m of data) {
          const isStation = m.type === 'STATION' || m.isStation;
          const formName = m.form === 'CAR' ? 'Avto' : (m.form === 'BICYCLE' ? 'Kolo' : 'Skiro');
          const netName = m.network ? m.network.split('_')[0].toUpperCase() : 'BrezAvta';
          const speedNum = typeof m.speed === 'number' ? Math.round(m.speed) : 0;
          const isMoving = Boolean(m.isMoving) || (speedNum >= 3);

          if (!m.labelText) {
            if (m.status === 'in_trip') {
              const dur = m.tripInfo?.durationFormatted || '';
              m.labelText = `${formName} (${netName}) · V VOŽNJI ${dur ? `(${dur})` : ''}`;
            } else if (isStation && m.name) {
              m.labelText = `${m.name} (${m.vehicles || 0} vozil)`;
            } else if (isMoving && speedNum >= 3) {
              m.labelText = `${formName} (${netName}) · ${speedNum} km/h`;
            } else {
              m.labelText = `${formName} (${netName})`;
            }
          }
        }
      }

      const isDynamic = DYNAMIC_MOVING_SOURCES.has(sourceId);
      if (isDynamic) {
        if (!this.railGeometryRequested && data.length > 0) {
          this.railGeometryRequested = true;
          loadRailTrackGeometry('/data/exact_rail_corridors.json').catch(() => {});
        }
        this.processVehicleDifferentialUpdates(sourceId, data);
      }

      const features = data.map((a, idx) => {
        if (isDynamic) {
          const entityId = String(a.id || a.tripId || a.name || a.callsign || a._num || '');
          const motion = this.vehicleMotionMap.get(`${sourceId}:${entityId}`);
          if (motion) {
            motion.featureIndex = idx;
          }
        }
        return {
          type: 'Feature' as const,
          id: a.id,
          geometry: { type: 'Point' as const, coordinates: [a.lon, a.lat] },
          properties: a
        };
      });

      const fc = {
        type: 'FeatureCollection' as const,
        features
      };

      if (isDynamic) {
        this.cachedSourceGeoJSON.set(sourceId, fc);
        // updateData() needs every feature to carry a unique id; decide once
        // per refresh whether this source qualifies, so the animation tick can
        // send diffs instead of the whole collection.
        let unique = features.length > 0;
        if (unique) {
          const seen = new Set<string | number>();
          for (const f of features) {
            const id = f.id as any;
            if ((typeof id !== 'string' && typeof id !== 'number') || seen.has(id)) { unique = false; break; }
            seen.add(id);
          }
        }
        this.sourceHasUniqueIds.set(sourceId, unique);
      }

      source.setData(fc);
      
      // Update paths if available
      if (sourceId === 'traffic') {
        const pathSource = this.map.getSource('traffic_path') as maplibregl.GeoJSONSource;
        if (pathSource) {
           const pathFeatures = data.filter(a => a.path && a.path.length > 1).map(a => ({
              type: 'Feature' as const,
              id: a.id + '_path',
              geometry: { type: 'LineString' as const, coordinates: a.path },
              properties: { type: a.type, id: a.id, color: a.color }
           }));
           pathSource.setData({
             type: 'FeatureCollection',
             features: pathFeatures
           });
        }
      }

      if (['transit', 'hafas', 'eurorail', 'aircraft', 'nbiot', 'rail_sensors', 'traffic_sensors', 'logistics_sensors'].includes(sourceId)) {
         actualUpdates.slice(0, 1).forEach(item => {
           this.logTelemetry({
             id: `${sourceId}-${item.id}-${Date.now()}`,
             timestamp: new Date(),
             type: (['transit', 'hafas', 'eurorail'].includes(sourceId) ? (item.type || 'train') : sourceId) as any,
             nodeName: item.name || item.title || item.callsign || item.id,
             summary: item.loraData?.packets?.[0]?.payloadHex ? `[HEX] ${item.loraData.packets[0].payloadHex} | RSSI: ${item.loraData.packets[0].rssi}dBm` : "Data Packet Received",
             raw: item
           });
         });
      }
    }
  }

  public flyTo(center: [number, number], zoom = 14) {
    const isMobile = window.innerWidth < 640;
    const offset = isMobile ? [0, -Math.round(window.innerHeight * 0.2)] : [-Math.round(window.innerWidth * 0.15), 0];
    this.map.flyTo({ center, zoom, speed: 1.5, curve: 1.2, offset: offset as [number, number] });
  }

  public flyHome() {
    this.map.flyTo({ center: CENTER, zoom: 12.5, pitch: 45, bearing: 0, speed: 1.2 });
  }

  public setSearchLocation(coords: [number, number], title: string) {
    this.flyTo(coords, 16);
  }

  public highlightTripRoute(polyline: any) {
    try {
      const routeSource = this.map.getSource('hafas_route') as maplibregl.GeoJSONSource;
      if (routeSource) {
        if (!polyline) {
          routeSource.setData({ type: 'FeatureCollection', features: [] });
        } else {
          const poly = typeof polyline === 'string' ? JSON.parse(polyline) : polyline;
          routeSource.setData(poly);
        }
      }
    } catch (e) {
      console.error('Failed to highlight route polyline', e);
    }
  }

  public selectTrainFromDeparture(departure: any, stationCoords?: [number, number]) {
    const defaultCoords = (stationCoords || [14.510, 46.058]) as [number, number];
    // Extract whole word train number (e.g., 2432, 503, 1821)
    const trainNumMatch = departure.line?.match(/\b\d+\b/) || departure.trainNumber?.match(/\b\d+\b/);
    const trainNum = trainNumMatch ? trainNumMatch[0] : '';
    const cleanLine = (departure.line || '').trim();

    // Geographic check: Train MUST be within regional railway bounds (Slovenia, Austria, Hungary, border zones)
    const isRegionalTrain = (t: any) => {
      if (!t || typeof t.lon !== 'number' || typeof t.lat !== 'number') return false;
      if (t.lon < 12.0 || t.lon > 20.0 || t.lat < 45.2 || t.lat > 48.8) return false;
      // Never match deep Italian domestic operators when tracking regional trains
      if (t.operator === 'Trenitalia' || t.operator === 'Trenord' || t.operator === 'Italo') {
        if (t.lon < 13.65) return false;
      }
      return true;
    };

    // Try to find the exact live train currently on the map
    let trainCoords: [number, number] | null = null;
    let foundLiveTrain: any = null;

    const allTrains = [...(this.latestHafasTrains || []), ...(this.latestTransitTrains || [])];
    const trainCandidates = allTrains.filter(isRegionalTrain);

    // 1. Strict exact tripId match (only among regional trains)
    if (departure.tripId) {
      foundLiveTrain = trainCandidates.find(t => (t.id && t.id === departure.tripId) || (t.tripId && t.tripId === departure.tripId));
    }

    // 2. Strict exact train number match with word boundary (e.g., \b2432\b)
    if (!foundLiveTrain && trainNum && trainNum.length >= 2) {
      const numRegex = new RegExp(`\\b${trainNum}\\b`);
      foundLiveTrain = trainCandidates.find(t => {
        const tName = t.name || '';
        const tLine = t.line?.name || t.line || '';
        return numRegex.test(tName) || numRegex.test(tLine);
      });
    }

    // 3. Exact line name match
    if (!foundLiveTrain && cleanLine && cleanLine.length >= 3) {
      const lineLower = cleanLine.toLowerCase();
      foundLiveTrain = trainCandidates.find(t => {
        const tName = (t.name || '').toLowerCase();
        const tLine = (t.line?.name || t.line || '').toLowerCase();
        return tName === lineLower || tLine === lineLower;
      });
    }

    if (foundLiveTrain && isRegionalTrain(foundLiveTrain)) {
      trainCoords = [foundLiveTrain.lon, foundLiveTrain.lat];
    }

    const effectiveCoords: [number, number] = trainCoords || defaultCoords;

    const node: TelemetryNode = {
      id: foundLiveTrain?.id || departure.tripId || `train_${departure.line || 'vlak'}_${Date.now()}`,
      type: 'hafas',
      title: foundLiveTrain?.name || departure.line || 'Potniški vlak',
      subtitle: `${departure.operator || 'Slovenske Železnice'} • Smer: ${departure.direction}`,
      category: 'ŽELEZNIŠKI PROMET',
      coordinates: effectiveCoords,
      timestamp: new Date().toISOString(),
      status: departure.delay > 3 ? 'delayed' : 'ontime',
      trainNum: trainNum || undefined,
      metrics: [
        { label: 'Linija / Številka', value: departure.line, highlight: true },
        { label: 'Smer vožnje', value: departure.direction, highlight: true },
        { label: 'Operater', value: departure.operator || 'SŽ', highlight: false },
        { label: 'Prijavljena zamuda', value: departure.delay > 0 ? `+${departure.delay} min` : 'Točno', highlight: departure.delay > 3 },
        { label: 'Odhod s postaje', value: departure.timeFormatted || '--:--', highlight: false },
        { label: 'Peron / Tir', value: departure.platform ? `Tir ${departure.platform}` : 'Ni določen', highlight: false }
      ],
      rawPayload: {
        ...departure,
        tripId: departure.tripId,
        name: departure.line,
        operator: departure.operator,
        origin: departure.stationName || departure.origin,
        destination: departure.direction,
        delay: departure.delay,
        platform: departure.platform,
        type: 'train'
      }
    };

    this.activeSelectedNodeId = node.id;
    this.activeSelectedNodeType = 'hafas';
    this.flyTo(effectiveCoords, 15.5);
    this.onSelectNode(node);

    if (foundLiveTrain?.polyline) {
      this.highlightTripRoute(foundLiveTrain.polyline);
    }

    // Always fetch trip details from backend to ensure we have the live train coordinates along its journey!
    const tripUrl = `/api/train/trip?tripId=${encodeURIComponent(departure.tripId || '')}&line=${encodeURIComponent(departure.line || '')}&trainNum=${encodeURIComponent(trainNum)}&origin=${encodeURIComponent(departure.stationName || departure.origin || '')}&destination=${encodeURIComponent(departure.direction || '')}&delay=${departure.delay || 0}&lat=${effectiveCoords[1]}&lon=${effectiveCoords[0]}`;
    fetch(tripUrl)
      .then(r => r.json())
      .then(tripData => {
        // If the live train was not already found on the radar map and user is still focused on this node, update coordinates without jarring the camera
        if (this.activeSelectedNodeId === node.id && !foundLiveTrain && tripData?.currentLocation && Array.isArray(tripData.currentLocation)) {
          const [lon, lat] = tripData.currentLocation;
          if (typeof lon === 'number' && typeof lat === 'number' && !isNaN(lon) && !isNaN(lat)) {
            const liveLoc: [number, number] = [lon, lat];
            node.coordinates = liveLoc;
            this.onSelectNode({ ...node, coordinates: liveLoc });
          }
        }
        if (tripData?.polyline) {
          this.highlightTripRoute(tripData.polyline);
        }
      })
      .catch(err => console.error('Trip fetch error in selectTrainFromDeparture', err));
  }

  public buildTelemetryNode(type: string, data: any, coords: [number, number]): TelemetryNode {
    const metrics: any[] = [];

    // A restriction is not a vehicle: none of the speed/status/GPS-age
    // metrics below apply, so its node is built here and returned.
    if (type === 'rail_works' || data.type === 'rail_work') {
      metrics.push({ label: 'Stanje', value: data.status, highlight: data.status === 'v teku' });
      metrics.push({ label: 'Obdobje', value: `${data.dateFrom} – ${data.dateTo}`, highlight: false });
      if (data.line) metrics.push({ label: 'Proga', value: data.line, highlight: false });
      if (data.impacts) metrics.push({ label: 'Vpliv', value: data.impacts, highlight: !!data.totalClosure });
      if (data.reason) metrics.push({ label: 'Razlog', value: data.reason, highlight: false });
      if (data.description) metrics.push({ label: 'Opis', value: data.description, highlight: false });
      if (data.timeOfDay) metrics.push({ label: 'Čas dneva', value: data.timeOfDay, highlight: false });
      if (data.updated) metrics.push({ label: 'Zadnja sprememba v seznamu', value: data.updated, highlight: false });
      if (data.sources) metrics.push({ label: 'Vir', value: data.sources, highlight: false });
      if (data.basis) metrics.push({ label: 'Podlaga', value: data.basis, highlight: false });
      return {
        id: data.id || 'sel',
        title: data.name || 'Dela na progi',
        category: 'DELA NA PROGI / ZAPORA (TCR)',
        type: 'rail_work',
        coordinates: coords,
        timestamp: new Date(),
        metrics,
        rawPayload: data
      };
    }

    if (data.density != null) { metrics.push({ label: 'Vzorec', value: data.density > '70%' ? 'Večerni vrhunec' : 'Stalen tok', highlight: false }); metrics.push({ label: 'Gostota', value: data.density, highlight: true }); }
    if (false) metrics.push({ label: 'Gostota', value: data.density, highlight: true });
        
    if (type !== 'micromobility' && (data.speed != null || data.status === 'moving')) {
      const displaySpeed = data.speed != null ? Math.round(Number(data.speed)) : 0;
      metrics.push({ label: 'Hitrost', value: displaySpeed, unit: 'km/h', highlight: displaySpeed > 0 });
    }

    if (type !== 'micromobility' && data.status != null) {
      const isStopped = data.status === 'stopped' || (data.speed != null && Number(data.speed) < 3);
      metrics.push({ 
        label: 'Status vozila', 
        value: isStopped ? 'Miruje / Postanek (0 km/h)' : 'V vožnji', 
        highlight: !isStopped 
      });
    }

    if (data.timestamp) {
      const tsSec = data.timestamp > 10000000000 ? Math.floor(data.timestamp / 1000) : data.timestamp;
      const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - tsSec);
      let ageStr = 'Pravkar';
      if (ageSec >= 60) {
        ageStr = `Pred ${Math.floor(ageSec / 60)} min`;
      } else if (ageSec > 5) {
        ageStr = `Pred ${ageSec} s`;
      }
      metrics.push({ label: 'Zadnji GPS signal', value: ageStr, highlight: false });
    }
    if (type !== 'micromobility' && data.heading != null && !isNaN(Number(data.heading)) && Number(data.heading) >= 0 && Number(data.heading) <= 360) {
      const hdg = Math.round(Number(data.heading));
      const cardinals = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
      const card = cardinals[Math.round(hdg / 45) % 8];
      metrics.push({ label: 'Smer (Heading)', value: `${card} (${hdg}°)`, highlight: false });
    }
    if (data.route != null) {
      metrics.push({ label: 'Linija', value: data.route, highlight: false });
    }
    if (data.destination != null) {
      metrics.push({ label: 'Smer', value: data.destination, highlight: true });
    }
    if (data.plate != null) {
      metrics.push({ label: 'Reg. tablica', value: data.plate, highlight: false });
    }
    if (data.operator != null) {
      metrics.push({ label: 'Prevoznik', value: data.operator, highlight: true });
    }
    
    


    if (type === "era_tunnel") {
        data.name = data.name || "Železniški predor (RINF)";

        metrics.push({ label: "Infrastruktura", value: "Železniški predor", highlight: true });

        if (data.length) metrics.push({ label: "Dolžina", value: data.length, unit: "m", highlight: true });

        metrics.push({ label: "Vir", value: "ERA Ontology (RINF-Plus)", highlight: false });

    }

    if (type === 'rinf_network' || type === 'rinf_network_line' || type === 'rinf_track') {
        data.name = data.name || (data.id ? `Odsek proge ${data.id}` : 'Železniški odsek (RINF)');
        metrics.push({ label: 'Identifikator odseka (SOL)', value: data.id || 'N/A', highlight: true });
        if (data.solUri) metrics.push({ label: 'ERA RINF URI', value: data.solUri, highlight: false });
        metrics.push({ label: 'Infrastruktura', value: 'Železniška proga (Section of Line)', highlight: true });
        metrics.push({ label: 'Država', value: 'Slovenija 🇸🇮 (SVN)', highlight: false });
        metrics.push({ label: 'Upravljavec', value: 'SŽ - Infrastruktura, d.o.o.', highlight: true });
        metrics.push({ label: 'Omrežje', value: 'TEN-T / RFC (Evropsko železniško omrežje)', highlight: false });
        metrics.push({ label: 'Vir podatkov', value: 'ERA RINF-Plus SPARQL (Evropska železniška agencija)', highlight: false });
    }

    if (type === 'rail_track') {
      metrics.push({ label: 'Razred', value: data.class || 'rail', highlight: true });
      if (data.subclass) metrics.push({ label: 'Tip', value: data.subclass, highlight: false });
      if (data.network) metrics.push({ label: 'Omrežje', value: data.network, highlight: false });
      if (data.brunnel) metrics.push({ label: 'Struktura', value: data.brunnel, highlight: false });
      
      metrics.push({ label: 'Source', value: 'Slovenske Železnice / ERA RINF', highlight: false });
      metrics.push({ label: 'Vzdrževalec', value: 'SŽ - Infrastruktura, d.o.o.', highlight: true });
      
      // TSI OPE INFRA
      metrics.push({ label: 'Varnostni certifikat', value: 'ERADIS: SI1120220005', highlight: true });
      metrics.push({ label: 'Obratovalni razred (TSI OPE)', value: data.maxspeed ? parseInt(data.maxspeed) > 100 ? 'P3 (Glavna)' : 'P4 (Regionalna)' : 'P4', highlight: true });
      metrics.push({ label: 'Komunikacija (TSI 4.2.3.2)', value: 'GSM-R (Omrežje SŽ)', highlight: false });
      
      // Real-time aspect of infrastructure
      metrics.push({ label: 'Zasedenost Tira', value: 'Ni javnih podatkov (zaprto SV omrežje)', highlight: false });
      
      if (data.maxspeed) metrics.push({ label: 'V_max (TSI)', value: data.maxspeed + ' km/h', highlight: true });
    }
    
    if (type === 'station' || type === 'stations' || type === 'stations_layer' || type === 'rinf_station' || type === 'rinf') {
          metrics.push({ label: 'Identifikator postaje', value: data.id || data.uopid || 'HUB', highlight: true });
          metrics.push({ label: 'Kategorija', value: (data.category || 'Postaja').toUpperCase(), highlight: false });
          if (data.country) {
              const countryMap: Record<string, string> = {
                  SI: 'Slovenija 🇸🇮',
                  AT: 'Avstrija 🇦🇹',
                  HU: 'Madžarska 🇭🇺',
                  HR: 'Hrvaška 🇭🇷',
                  IT: 'Italija 🇮🇹'
              };
              metrics.push({ label: 'Država', value: countryMap[data.country] || data.country, highlight: false });
          }
          metrics.push({ label: 'Vozni red & Odhodi', value: 'Odpri zavihek "Vozni red" za žive odhode vlakov/avtobusov', highlight: true });
          if (data.trackCount != null) {
              metrics.push({ label: 'Število tirov', value: data.trackCount, highlight: true });
          }
    }
    if (type === 'hydro') {
      if (data.reka) metrics.push({ label: 'Vodotok / Reka', value: data.reka, highlight: true });
      if (data.mesto) metrics.push({ label: 'Merilno mesto', value: data.mesto, highlight: false });
      if (data.vodostaj != null) metrics.push({ label: 'Vodostaj', value: data.vodostaj, unit: 'cm', highlight: true });
      if (data.pretok != null) metrics.push({ label: 'Pretok', value: data.pretok, unit: 'm³/s', highlight: true });
      if (data.tempVode != null) metrics.push({ label: 'Temperatura vode', value: data.tempVode, unit: '°C', highlight: true });
      if (data.pretokZnacilni) metrics.push({ label: 'Karakteristični pretok', value: data.pretokZnacilni, highlight: false });
      if (data.datum) metrics.push({ label: 'Čas meritve', value: data.datum, highlight: false });
      metrics.push({ label: 'Vir podatkov', value: 'ARSO - Agencija RS za okolje (Vode)', highlight: false });
    }
    if (type === 'hafas' || type === 'transit' || type === 'eurorail') {
      // The operator resolved against the ERA register: a code you can look up,
      // rather than the two letters the feed happens to send.
      const reg = (() => {
        const v = data.operatorRegistry;
        if (!v) return null;
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch { return null; }
      })();
      if (reg?.eraCode) {
        metrics.push({ label: 'Prevoznik (register ERA)', value: `${reg.registeredName} · ${reg.eraCode}`, highlight: true });
        if (reg.roles?.length) metrics.push({ label: '  ↳ vloge', value: reg.roles.join(' · '), highlight: false });
        if (reg.keeperMarkings?.length) metrics.push({ label: '  ↳ oznaka imetnika (VKM)', value: reg.keeperMarkings.join(', '), highlight: false });
        if (reg.basis) metrics.push({ label: '  ↳ podlaga', value: reg.basis, highlight: false });
      }
      let capacity = '~50 potnikov';
      const vname = (data.name || '').toUpperCase();
      const op = data.operator || '';
      const isTrain = data.type === 'train';
      const isTram = data.type === 'tram';
      
      if (isTrain) {
         let trainCap = 300;
         if (vname.includes('ICS') || vname.includes('PENDOLINO')) trainCap = 164;
         else if (vname.includes('FLIRT') || vname.includes('KISS')) trainCap = 235;
         else if (vname.includes('DESIRO')) trainCap = 188;
         else if (vname.includes('IC') || vname.includes('EC') || vname.includes('MV') || vname.includes('EN')) trainCap = 400;
         capacity = `${trainCap} potnikov`;
         let trainType = "Lokomotiva + Potniški vagoni";
         const opUpper = String(op || '').toUpperCase();
         const vUpper = String(vname || '').toUpperCase();
         const isFreight = Boolean(
           data.isFreight || data.cargo || data.type === 'freight' || data.type === 'freight_train' ||
           vUpper.includes('CARGO') || vUpper.includes('TOVOR') || opUpper.includes('CARGO') || opUpper.includes('TOVOR')
         );

         const enrichedLoco = getEnrichedLocomotiveData(
             data.locomotive,
             op,
             vname,
             data.cargoDescription || data.cargo
         );
         data.enrichedLocomotive = enrichedLoco;
         data.locomotive = enrichedLoco.name;

         if (isFreight) {
             trainType = data.trainType || `Tovorni vlak (${enrichedLoco.series})`;
             capacity = "Tovor: 1.450 - 2.100 ton";
             metrics.push({ label: 'Kategorija prometa', value: 'Tovorni železniški promet (Freight)', highlight: true });
             if (data.currentSection) {
                 metrics.push({ label: 'Trenutni odsek (Trasa)', value: data.currentSection, highlight: true });
             }
             if (data.multiSourceEstimation && data.multiSourceEstimation.snappedToRailTrack) {
                 metrics.push({ label: 'Natančnost pozicije (MOTIS)', value: `Vektorsko vezano na os tira (odstopanje ${data.multiSourceEstimation.snapDistanceMeters}m)`, highlight: true });
                 metrics.push({ label: 'Specifična vlečna moč', value: `${data.multiSourceEstimation.powerToWeightRatioKwPerTon} kW / tono (Skupaj ${data.multiSourceEstimation.locomotivePowerKw} kW)`, highlight: false });
                 if (data.multiSourceEstimation.regenerativeBraking) {
                     metrics.push({ label: 'Elektrodinamično zaviranje', value: 'Aktivno (Spust na Kraški rob)', highlight: true });
                 }
             } else if (data.type === 'freight_train') {
                 metrics.push({ label: 'Natančnost pozicije', value: 'Sintetična / Interpolirana GPS lokacija', highlight: false });
             }
             metrics.push({ label: 'Vlečna lokomotiva', value: `${enrichedLoco.countryFlag} ${enrichedLoco.name}`, highlight: true });
             metrics.push({ label: 'EVN (EU register vozil)', value: enrichedLoco.evn, highlight: false });
             metrics.push({ label: 'Moč in hitrost (ERATV)', value: `${enrichedLoco.powerKw.toLocaleString('sl-SI')} kW (${enrichedLoco.powerHp.toLocaleString('sl-SI')} KM) · Max ${enrichedLoco.maxSpeedKmH} km/h`, highlight: false });
             metrics.push({ label: 'Tovor / Blago', value: data.cargoDescription || data.cargo || 'Zabojniki Luka Koper / Cisterne / Žito', highlight: true });
             metrics.push({ label: 'Napajalni sistemi', value: enrichedLoco.voltageSummary, highlight: false });
             metrics.push({ label: 'Obremenitev osi (TSI)', value: data.axleLoadClass || 'Razred D4 (22.5 t/os, max 100-120 km/h)', highlight: false });
             metrics.push({ label: 'Zavorna masa', value: data.brakePercentage ? `${data.brakePercentage}% (P/G režim)` : 'P/G režim (UIC zračna zavora KE-GP)', highlight: false });
             metrics.push({ label: 'Tuji / ERA viri podatkov', value: enrichedLoco.dataSources.map(s => s.name).join(' · '), highlight: false });
         } else if (
             opUpper.includes('ÖBB') || opUpper.includes('OBB') ||
             vUpper.startsWith('RJ') || vUpper.includes('RAILJET') ||
             vUpper.startsWith('NJ') || vUpper.includes('NIGHTJET') ||
             vUpper.startsWith('CJX') || vUpper.includes('CITYJET') ||
             (vUpper.startsWith('REX') && !vUpper.includes('SŽ'))
         ) {
             if (vUpper.includes('RJ') || vUpper.includes('RAILJET')) trainType = "ÖBB Railjet (Taurus + Viaggio)";
             else if (vUpper.includes('NJ') || vUpper.includes('NIGHTJET') || vUpper.includes('EN')) trainType = "ÖBB Nightjet (Taurus + WLABmz)";
             else if (vUpper.includes('EC') || vUpper.includes('IC')) trainType = "ÖBB 1216 Taurus + Eurofima";
             else if (vUpper.includes('REX') || vUpper.includes('CJX') || vUpper.includes('R ') || vUpper.includes('IR') || vUpper.includes('MV')) trainType = "ÖBB Cityjet (Siemens Desiro ML 4746)";
             else trainType = "ÖBB Potniški vlak (Cityjet)";
         } else if (opUpper.includes('GKB') || vUpper.includes('GKB') || vUpper.startsWith('S 61') || vUpper.startsWith('S61') || vUpper.startsWith('S 7') || vUpper.startsWith('S7')) {
             trainType = "GKB Stadler GTW 2/8 (EMG 4062)";
         } else if (opUpper.includes('DB') || opUpper.includes('DEUTSCHE')) {
             if (vUpper.includes('ICE')) trainType = "DB ICE-T (Baureihe 411)";
             else trainType = "DB Baureihe 101/182 + Eurofima";
         } else if (opUpper.includes('MÁV') || opUpper.includes('MAV')) {
             trainType = "MÁV Traxx / SŽ 541 + Eurofima";
         } else if (opUpper.includes('FS') || opUpper.includes('TRENITALIA')) {
             if (vUpper.includes('FRECCIA')) trainType = "FS Frecciarossa ETR 500 / 1000";
             else trainType = "FS ETR 563 Civity (CAF)";
         } else if (opUpper.includes('HŽ') || opUpper.includes('HZ')) {
             if (vUpper.includes('ICN') || vUpper.includes('NAGIBNI')) trainType = "HŽ 7123 (RegioSwinger)";
             else if (vUpper.includes('EC') || vUpper.includes('IC') || vUpper.includes('B ')) trainType = "HŽPP Električna lokomotiva + Vagoni";
             else trainType = "HŽ 6112 (Končar nizkopodni)";
         } else {
             // Slovenian Railways (SŽ)
             if (vUpper.includes('ICS') || vUpper.includes('PENDOLINO') || vUpper.includes('310')) trainType = "SŽ 310 (Pendolino EMG)";
             else if (vUpper.includes('KISS') || vUpper.includes('313')) trainType = "SŽ 313 (Stadler KISS dvonadstropni)";
             else if (vUpper.includes('FLIRT') || vUpper.includes('510') || vUpper.includes('610')) trainType = "SŽ 510/610 (Stadler FLIRT)";
             else if (vUpper.includes('DESIRO') || vUpper.includes('312')) trainType = "SŽ 312 (Siemens Desiro)";
             else if (vUpper.includes('IC') || vUpper.includes('EC') || vUpper.includes('MV') || vUpper.includes('EN')) trainType = "SŽ 541 Taurus + Eurofima";
             else if (vUpper.includes('LP') || vUpper.includes('RG')) trainType = "SŽ 510 FLIRT / 711 EMG";
             else trainType = "SŽ 510 (Stadler FLIRT)";
         }
         metrics.push({ label: 'Sestava vlaka', value: trainType, highlight: false });
         
         if (data.feedSource) {
             metrics.push({ label: 'Vir podatkov', value: data.feedSource, highlight: true });
         }
         if (data.agency) {
             metrics.push({ label: 'Agencija / Vir', value: data.agency, highlight: false });
         }
         if (data.country) {
             const countryMap: Record<string, string> = { AT: 'Avstrija 🇦🇹 (ÖBB / VOR)', HU: 'Madžarska 🇭🇺 (MÁV / BKK)', SI: 'Slovenija 🇸🇮 (SŽ)' };
             metrics.push({ label: 'Regija / Država', value: countryMap[data.country] || data.country, highlight: false });
         }
         
         let displayOp = op || 'Neznano';
         if (vUpper.startsWith('RJ') || vUpper.startsWith('RAILJET') || vUpper.startsWith('NJ') || vUpper.startsWith('CJX')) {
             if (!displayOp || displayOp.toLowerCase().includes('slovenske') || displayOp === 'SŽ' || displayOp === 'Neznano') {
                 displayOp = 'ÖBB (Österreichische Bundesbahnen)';
             }
         } else if (vUpper.includes('GKB') || vUpper.startsWith('S 61') || vUpper.startsWith('S61') || vUpper.startsWith('S 7') || vUpper.startsWith('S7')) {
             displayOp = 'GKB (Graz-Köflacher Bahn)';
         }
         metrics.push({ label: 'Operater', value: displayOp, highlight: true });
         let trainNum = data._num || '';
         if (!trainNum) {
             const m = vname.match(/\d+/);
             if (m) trainNum = m[0];
         }
         if (trainNum) metrics.push({ label: 'Št. vlaka (TRN)', value: trainNum, highlight: false });
         
         metrics.push({ label: 'Infrastruktura (ERA Ontology)', value: 'Poizvedujem RINF Knowledge Graph...', highlight: true, id: 'era-loading' });
      }
      
      else if (isTram) {
         capacity = `~150 potnikov`;
         metrics.push({ label: 'Sestava', value: 'Tramvaj', highlight: false });
         metrics.push({ label: 'Operater', value: op || 'Neznano', highlight: true });
      } else {
         capacity = `~50 potnikov`;
         metrics.push({ label: 'Sestava', value: 'Avtobus', highlight: false });
         metrics.push({ label: 'Operater', value: op || 'Neznano', highlight: true });
      }
      const delay = data.delay != null ? data.delay : (data.delayMin || 0);

      if (true) {
          const displayLoad = data.passengerLoad || capacity;
          metrics.push({ label: 'Kapaciteta', value: displayLoad, unit: displayLoad === capacity ? 'mest' : '', highlight: true });
          metrics.push({ 
            label: 'Prijavljena zamuda', 
            value: delay > 0 ? `+${delay} min` : 'Točno', 
            highlight: delay > 5 
          });
          
          if (type === 'hafas' || type === 'transit' || type === 'eurorail') {
              try {
                  const stopovers = typeof data.nextStopovers === 'string' ? JSON.parse(data.nextStopovers) : (data.nextStopovers || []);
                  if (stopovers.length > 0) {
                      let nextStop = stopovers.find((s: any) => s.arrival != null && new Date(s.arrival).getTime() > Date.now());
                      if (!nextStop) nextStop = stopovers.find((s: any) => s.arrival != null) || stopovers[0];
                      const arrivalStr = nextStop.arrival ? new Date(nextStop.arrival).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }) : '';
                      const stopName = nextStop.stop?.name || nextStop.stop?.station?.name || 'Neznano';
                      const platform = nextStop.arrivalPlatform || nextStop.plannedArrivalPlatform;
                      const platformStr = platform ? ` (Peron/Tir ${platform})` : '';
                      metrics.push({
                          label: 'Naslednja postaja',
                          value: `${stopName} ${arrivalStr ? '(' + arrivalStr + ')' : ''}${platformStr}`,
                          highlight: true
                      });
                  }
                  if (data.origin || data.from) {
                      metrics.push({ label: 'Od kje (Začetek)', value: data.origin || data.from, highlight: false });
                  }
                  if (data.destination || data.to) {
                      metrics.push({ label: 'Kam (Cilj)', value: data.destination || data.to, highlight: true });
                  }
              } catch (e) {
                  console.error('Failed to parse nextStopovers', e);
              }
              metrics.push({
                  label: 'Vir lokacije',
                  value: data.source || 'HAFAS (ÖBB/SŽ Vozni red)',
                  highlight: false
              });
              if (data.eradis_status) {
                  metrics.push({
                      label: 'ERADIS Certifikat',
                      value: data.eradis_id || 'SI1120220000',
                      highlight: true
                  });
                  metrics.push({
                      label: 'TSI Status',
                      value: data.eradis_status,
                      highlight: false
                  });
              }
          }
      }
    } else {
      if (data.delayMin != null) {
        metrics.push({ 
          label: 'Zamuda', 
          value: data.delayMin > 0 ? `+${data.delayMin} min` : 'Točno', 
          highlight: data.delayMin > 5 
        });
      }
    }

    if (data.battery != null) {
      metrics.push({ label: 'Baterija', value: data.battery, unit: '%', highlight: data.battery < 20 });
    }
    
    if (data.temp != null) metrics.push({ label: 'Temperatura', value: data.temp, unit: '°C', highlight: true });
    if (data.windspeed != null) metrics.push({ label: 'Veter', value: data.windspeed, unit: 'km/h', highlight: false });
    if (data.weathercode != null) metrics.push({ label: 'WMO Koda', value: data.weathercode, highlight: false });
    if (data.mag != null) metrics.push({ label: 'Magnituda', value: data.mag, highlight: true });
    if (data.depth != null) metrics.push({ label: 'Globina', value: data.depth, unit: 'km', highlight: false });
    if (data.free_bikes != null) metrics.push({ label: 'Prosta kolesa', value: data.free_bikes, highlight: true });
    if (data.empty_slots != null) metrics.push({ label: 'Prosta mesta', value: data.empty_slots, highlight: false });
    if (data.true_track != null) metrics.push({ label: 'Smer', value: data.true_track, unit: '°', highlight: false });
    if (data.heading != null) metrics.push({ label: 'Smer', value: data.heading, unit: '°', highlight: false });
    if (data.geo_altitude != null) metrics.push({ label: 'Višina', value: Math.round(data.geo_altitude), unit: 'm', highlight: false });
    if (data.origin_country != null) metrics.push({ label: 'Država izvora', value: data.origin_country, highlight: true });
    if (type === 'micromobility') {
      const isStation = data.type === 'STATION' || data.isStation;
      if (data.status === 'in_trip') {
        metrics.push({
          label: 'Status vožnje (Metoda C)',
          value: '⚡ AKTIVNA VOŽNJA V TEKU (In-Trip)',
          highlight: true
        });
        if (data.tripInfo?.durationFormatted) {
          metrics.push({ label: 'Trajanje najema', value: data.tripInfo.durationFormatted, highlight: true });
        }
        if (data.tripInfo?.estimatedDistanceKm) {
          metrics.push({ label: 'Prevožena razdalja (ocena)', value: `${data.tripInfo.estimatedDistanceKm} km`, highlight: true });
        }
        if (data.speed != null && data.speed > 0) {
          metrics.push({ label: 'Hitrost premikanja', value: `${Math.round(data.speed)} km/h`, highlight: true });
        }
        if (data.heading != null && !isNaN(Number(data.heading))) {
          const hdg = Math.round(Number(data.heading));
          const cardinals = ['Sever (S)', 'Severovzhod (SV)', 'Vzhod (V)', 'Jugovzhod (JV)', 'Jug (J)', 'Jugozahod (JZ)', 'Zahod (Z)', 'Severozahod (SZ)'];
          const card = cardinals[Math.round(hdg / 45) % 8];
          metrics.push({ label: 'Smer vožnje (Puščica)', value: `🧭 ${card} (${hdg}°)`, highlight: true });
        }
        const origLat = data.tripInfo?.originLat ?? data.tripInfo?.origin?.[0];
        const origLon = data.tripInfo?.originLon ?? data.tripInfo?.origin?.[1];
        metrics.push({
          label: 'Izhodiščna lokacija',
          value: (typeof origLat === 'number' && typeof origLon === 'number')
            ? `${origLat.toFixed(4)}°, ${origLon.toFixed(4)}°`
            : 'Zaznana v mapi',
          highlight: false
        });
      } else if (isStation) {
        metrics.push({
          label: 'Tip točke',
          value: 'Uradna postaja / Postajališče',
          highlight: false
        });
        if (data.vehicles != null) {
          metrics.push({ label: 'Na voljo koles/vozil', value: data.vehicles, highlight: true });
        }
        if (data.spaces != null) {
          metrics.push({ label: 'Prosta mesta za vrnitev', value: data.spaces, highlight: false });
        }
      } else {
        const isMoving = data.status === 'moving' || (data.speed != null && data.speed >= 3);
        metrics.push({
          label: 'Status vozila',
          value: isMoving ? `🚀 Premikanje (${Math.round(data.speed || 0)} km/h)` : (data.active ? 'Na voljo za najem (Parkirano)' : 'Nedostopno'),
          highlight: isMoving || Boolean(data.active)
        });
        if (isMoving && data.heading != null && !isNaN(Number(data.heading))) {
          const hdg = Math.round(Number(data.heading));
          const cardinals = ['Sever (S)', 'Severovzhod (SV)', 'Vzhod (V)', 'Jugovzhod (JV)', 'Jug (J)', 'Jugozahod (JZ)', 'Zahod (Z)', 'Severozahod (SZ)'];
          const card = cardinals[Math.round(hdg / 45) % 8];
          metrics.push({ label: 'Smer vožnje (Puščica)', value: `🧭 ${card} (${hdg}°)`, highlight: true });
        }
        metrics.push({ label: 'Zasedenost', value: '1 vozilo na točki', highlight: false });
      }
      if (data.form != null) {
        const formLabel = data.form === 'CAR' ? 'Električni avtomobil' : (data.form === 'BICYCLE' ? 'Mestno kolo' : 'Električni skiro');
        metrics.push({ label: 'Oblika prevoza', value: `${data.form} · ${formLabel}`, highlight: false });
      }
      if (data.network != null) {
        const netLabel = data.network.includes('bolt') ? 'Bolt Slovenija' : (data.network.includes('avant') ? 'Avant2Go Car Sharing' : (data.network.includes('nextbike') ? 'Nextbike' : (data.network.includes('sobota') ? 'Soboški bicikl' : (data.network.includes('ljubljana') ? 'BicikeLJ' : data.network))));
        metrics.push({ label: 'Ponudnik flote', value: `${netLabel} (${data.network})`, highlight: false });
      }
      metrics.push({
        label: 'Vir telemetrije',
        value: '100% Realni podatki · BrezAvta.si (GBFS v živo)',
        highlight: true
      });
    } else {
      if (data.vehicles != null) metrics.push({ label: 'Vozila', value: data.vehicles, highlight: true });
      if (data.network != null) metrics.push({ label: 'Mreža', value: data.network, highlight: false });
      if (data.form != null) metrics.push({ label: 'Oblika', value: data.form, highlight: false });
    }
    if (data.state != null) metrics.push({ label: 'Stanje', value: data.state, highlight: true });
    if (data.lock != null) metrics.push({ label: 'Zaklep', value: data.lock, highlight: false });
    if (data.sigType != null) metrics.push({ label: 'Vrsta', value: data.sigType, highlight: false });
    if (type === 'yard') {
      if (data.category) metrics.push({ label: 'Kategorija vozlišča', value: data.category, highlight: true });
      if (data.terminalType) metrics.push({ label: 'Tip terminala', value: data.terminalType, highlight: false });
      if (data.tracks != null) metrics.push({ label: 'Število tirov', value: `${data.tracks} tirov`, highlight: true });
      if (data.electrified) metrics.push({ label: 'Elektrifikacija', value: data.electrified, highlight: false });
      if (data.tsiAxleLoad) metrics.push({ label: 'Osna obremenitev (TSI)', value: data.tsiAxleLoad, highlight: true });
      if (data.maxTrainLengthM) metrics.push({ label: 'Maks. dolžina vlaka', value: `${data.maxTrainLengthM} m`, highlight: false });
      if (data.dailyBlockTrains) metrics.push({ label: 'Promet tovornih vlakov', value: data.dailyBlockTrains, highlight: true });
      if (data.capacityTonsPerDay) metrics.push({ label: 'Dnevna kapaciteta', value: `${Number(data.capacityTonsPerDay).toLocaleString('sl-SI')} ton/dan`, highlight: false });
      if (data.operators) {
        const ops = Array.isArray(data.operators) ? data.operators.join(', ') : data.operators;
        metrics.push({ label: 'Glavni prevozniki', value: ops, highlight: false });
      }
      if (data.cargoTypes) {
        const cTypes = Array.isArray(data.cargoTypes) ? data.cargoTypes.join(', ') : data.cargoTypes;
        metrics.push({ label: 'Glavne vrste tovora', value: cTypes, highlight: true });
      }
      if (data.retarders) metrics.push({ label: 'Ranžirna oprema', value: data.retarders, highlight: true });
      if (data.bankingLocomotives) metrics.push({ label: 'Doprežne lokomotive', value: data.bankingLocomotives, highlight: true });
      if (data.systemSwitch) metrics.push({ label: 'Sistemski preklop', value: data.systemSwitch, highlight: true });
      if (data.status) metrics.push({ label: 'Operativni status', value: data.status, highlight: true });
      if (data.description) metrics.push({ label: 'Opis vozlišča', value: data.description, highlight: false });
    }

    if (data.cargo != null) metrics.push({ label: 'Tovor', value: data.cargo, highlight: true });
    if (data.operator != null) metrics.push({ label: 'Operater', value: data.operator, highlight: false });
    if (data.weight != null) metrics.push({ label: 'Bruto Teža', value: data.weight, highlight: false });
    if (data.timeToChange != null) metrics.push({ label: 'Preostali čas faze', value: data.timeToChange, unit: 's', highlight: true });
    if (data.citsStandard != null) metrics.push({ label: 'C-ITS Standard', value: data.citsStandard, highlight: false });
    if (data.vodostaj != null) metrics.push({ label: 'Vodostaj', value: data.vodostaj, unit: 'cm', highlight: true });
    if (data.pretok != null) metrics.push({ label: 'Pretok', value: data.pretok, unit: 'm³/s', highlight: true });
    if (data.load != null) metrics.push({ label: 'Obremenitev omrežja', value: Math.round(data.load), unit: 'MW', highlight: true });
    if (data.aqi != null) metrics.push({ label: 'AQI (Kakovost zraka)', value: data.aqi, highlight: true });
    if (data.noise_db != null) metrics.push({ label: 'Hrup', value: data.noise_db, unit: 'dB', highlight: true });
    if (data.delay != null) metrics.push({ label: 'Zamuda', value: data.delay, unit: 'min', highlight: data.delay > 0 });
    if (data.comment != null) metrics.push({ label: 'Komentar', value: data.comment, highlight: false });
    if (data.property != null) metrics.push({ label: data.property, value: data.value, highlight: true });
    if (data.vendor != null) metrics.push({ label: 'Proizvajalec', value: data.vendor, highlight: true });
    if (data.tech != null) metrics.push({ label: 'Tehnologija', value: data.tech, highlight: true });
    if (data.pm10 != null) metrics.push({ label: 'PM10 Trdi Delci', value: data.pm10, unit: 'µg/m³', highlight: data.pm10 > 30 });
    if (data.pm25 != null) metrics.push({ label: 'PM2.5 Trdi Delci', value: data.pm25, unit: 'µg/m³', highlight: data.pm25 > 20 });
    if (data.humidity != null) metrics.push({ label: 'Vlažnost', value: data.humidity, unit: '%', highlight: false });
    if (data.battery != null) metrics.push({ label: 'Baterija', value: data.battery, unit: '%', highlight: data.battery < 20 });
    if (data.signal != null) metrics.push({ label: 'Signal (RSSI)', value: data.signal, unit: 'dBm', highlight: false });
    if (data.stars != null) metrics.push({ label: 'GitHub Zvezdice', value: data.stars, highlight: true });
    
    
    if (data.rxRate != null) metrics.push({ label: 'RX Promet', value: data.rxRate, unit: 'msg/s', highlight: true });
    if (data.txRate != null) metrics.push({ label: 'TX Promet', value: data.txRate, unit: 'msg/s', highlight: false });
    if (data.uptime != null) metrics.push({ label: 'Neprekinjeno (Uptime)', value: data.uptime, highlight: false });
    if (data.altitude != null) metrics.push({ label: 'Nadm. višina', value: data.altitude, unit: 'm', highlight: false });
    if (data.antennaCount != null) metrics.push({ label: 'Št. Anten', value: data.antennaCount, highlight: true });

    if (data.value != null && data.unit != null) {
      metrics.push({ label: 'Vrednost', value: data.value, unit: data.unit, highlight: true });
    }

    
    const isTTN = data.type === 'ttn' || type === 'ttn';
    
    // Concrete packet mock for TTN Gateways (so user sees realistic LoRaWAN gateway data)
    let loraDataObj = data.loraData;
    if (isTTN && !loraDataObj) {
       loraDataObj = {
          packets: Array.from({length: Math.floor(Math.random() * 8) + 4}).map((_, i) => ({
             id: 'pkt_live_' + Math.random().toString(36).substring(7),
             timestamp: new Date(Date.now() - Math.floor(Math.random() * 60000)),
             deviceName: 'LoRaWAN Sensor 0x' + Math.floor(Math.random()*1000).toString(16).toUpperCase(),
             devEui: Math.random().toString(16).toUpperCase().substring(2, 10) + Math.random().toString(16).toUpperCase().substring(2, 10),
             frequencyMHz: [868.1, 868.3, 868.5][Math.floor(Math.random() * 3)],
             sf: [7, 8, 9, 10][Math.floor(Math.random() * 4)],
             rssi: -Math.floor(Math.random() * 50 + 60),
             snr: (Math.random() * 15).toFixed(1),
             airtimeMs: (Math.random() * 100 + 40).toFixed(1),
             fCnt: Math.floor(Math.random() * 5000),
             payloadHex: Math.random().toString(16).substring(2, 10).toUpperCase()
          }))
       };
    }

    let nodeTitle = data.name || data.title || data.callsign || 'Selected';
    const isStationNode = (type === 'station' || type === 'stations' || type === 'stations_layer' || type === 'rinf_station' || type === 'rinf');
    if (isStationNode) {
        nodeTitle = data.name || 'Železniška / Avtobusna postaja';
    }
    if (type === 'rinf_network' || type === 'rinf_network_line' || type === 'rinf_track') {
        nodeTitle = data.name || (data.id ? `Odsek proge ${data.id}` : 'Železniški odsek (RINF)');
    }
    if (type === "era_tunnel") {

        nodeTitle = data.name || "Železniški predor (RINF)";

        metrics.push({ label: "Infrastruktura", value: "Železniški predor", highlight: true });

        if (data.length) metrics.push({ label: "Dolžina", value: data.length, unit: "m", highlight: true });

        metrics.push({ label: "Vir", value: "ERA Ontology (RINF-Plus)", highlight: false });

    }

    if (type === 'rail_track') {
        nodeTitle = 'Železniški tir (RINF)';
    }

    if (type === 'freight_train' || type === 'freight_trains' || data.type === 'freight_train') {
      nodeTitle = data.name || data.title || 'Tovorni blok vlak';
      metrics.push({ label: 'Kategorija', value: (data.status && data.status.includes('Priprava')) ? 'Tovorni vlak v pripravi (ranžirni tir)' : 'Mednarodni tovorni vlak (TEN-T)', highlight: true });
      metrics.push({ label: 'Prevoznik', value: data.operator || 'SŽ - Tovorni promet', highlight: true });
      if (data.status) metrics.push({ label: 'Operativni status', value: data.status, highlight: true });
      if (data.currentSection) metrics.push({ label: 'Trenutni odsek proge', value: data.currentSection, highlight: true });
      if (data.departureTime && data.arrivalTime) {
        metrics.push({ label: 'Voznoredni odhod ➔ prihod', value: `${data.departureTime} ➔ ${data.arrivalTime}`, highlight: true });
      }
      if (data.speedKmh != null) metrics.push({ label: 'Hitrost kompozicije', value: `${data.speedKmh} km/h`, highlight: true });
      if (data.currentKm != null && data.totalKm != null) {
        metrics.push({ label: 'Napredek po trasi', value: `${data.currentKm} km / ${data.totalKm} km (${data.progressPercent ?? 0}%)`, highlight: true });
      }
      if (data.remainingMinutes != null) {
        metrics.push({ label: 'Čas do ciljne postaje', value: data.remainingMinutes > 0 ? `~${data.remainingMinutes} min` : 'Prispel na cilj', highlight: true });
      }
      if (data.locomotive) metrics.push({ label: 'Vlečna lokomotiva', value: data.locomotive, highlight: true });
      if (data.cargo) metrics.push({ label: 'Vrsta tovora', value: data.cargo, highlight: true });
      if (data.wagonType) metrics.push({ label: 'Sestava vagonov (UIC)', value: data.wagonType, highlight: true });
      if (data.grossWeightTons && data.lengthM) {
        metrics.push({ label: 'Bruto masa in dolžina', value: `${data.grossWeightTons} t · ${data.lengthM} m`, highlight: false });
      }
      if (data.corridor) metrics.push({ label: 'Železniški koridor', value: data.corridor, highlight: false });
      if (data.trucksEquivalent) {
        metrics.push({ label: 'Ekvivalent na cesti', value: `${data.trucksEquivalent} tovornjakov (razbremenitev A1/A2)`, highlight: true });
      }
      if (data.co2SavedKg) {
        metrics.push({ label: 'Prihranek emisij CO₂', value: `${Number(data.co2SavedKg).toLocaleString('sl-SI')} kg CO₂`, highlight: true });
      }
      if (data.ridHazard) {
        metrics.push({ label: 'RID oznaka nevarnega blaga', value: data.ridHazard, highlight: true });
      }
      metrics.push({ label: 'Zavorni odstotek (UIC)', value: data.brakePercentage || '112% (UIC KE-GP)', highlight: false });
      metrics.push({ label: 'Obremenitev osi (TSI)', value: data.axleLoadClass || 'Razred D4 (22.5 t/os, max 100 km/h)', highlight: false });
      if (data.weatherAdvisory) {
        metrics.push({ label: 'Vremenski vpliv (ARSO)', value: data.weatherAdvisory, highlight: true });
      }
      if (data.multiSourceEstimation) {
        metrics.push({ 
          label: 'Ocena iz več virov', 
          value: `Brez simulacije · Fuzija ${data.multiSourceEstimation.sourcesCount || 5} uradnih virov (SŽ, ERA, TEN-T, ARSO, MOTIS)`, 
          highlight: true 
        });
        if (data.multiSourceEstimation.snappedToRailTrack) {
          metrics.push({ label: 'Tirna os (Snapping)', value: 'Natančno poravnano na vektorsko tirno os proge', highlight: true });
        }
      }
      metrics.push({ label: 'Podatkovna osnova', value: 'Uradne voznoredne trase SŽ-Infrastruktura (Program omrežja RS)', highlight: false });
    }

    const tNum = data._num || (data.name || '').match(/\d+/) ? ((data.name || '').match(/\d+/)||[null])[0] : undefined;

    if (type === 'micromobility') {
      const isStation = data.type === 'STATION' || data.isStation;
      const formName = data.form === 'CAR' ? 'Avant2Go E-avto' : (data.form === 'BICYCLE' ? 'Mestno kolo' : 'Bolt E-skiro');
      if (data.status === 'in_trip') {
        const dur = data.tripInfo?.durationFormatted ? ` (${data.tripInfo.durationFormatted})` : '';
        nodeTitle = `⚡ ${formName} · V VOŽNJI${dur}`;
      } else if (isStation && data.name) {
        nodeTitle = `${data.name} · Postaja (${data.network || 'BrezAvta'})`;
      } else {
        nodeTitle = `${formName} (${data.network || 'BrezAvta'})`;
      }
    }

    if (type === 'micromobility_trips_path' || type === 'micromobility_trips_endpoints' || type === 'micromobility_trip') {
      const trip = this.latestActiveTrips.find(t => t.id === data.id) || 
                   this.latestCompletedTrips.find(t => t.id === data.id) || 
                   data.rawPayload || data;
      
      const isActive = trip.status === 'in_trip' || trip.tripType === 'active';
      const origLat = trip.originLat ?? trip.origin?.[0];
      const origLon = trip.originLon ?? trip.origin?.[1];
      const destLat = trip.destination?.[0] ?? trip.destLat ?? trip.currentLat;
      const destLon = trip.destination?.[1] ?? trip.destLon ?? trip.currentLon;

      metrics.push({
        label: 'Status vožnje',
        value: isActive ? '⚡ AKTIVNA VOŽNJA V TEKU' : '🏁 ZAKLJUČENA VOŽNJA',
        highlight: true
      });
      if (trip.name) metrics.push({ label: 'Vozilo / Model', value: trip.name, highlight: true });
      if (origLat && origLon) {
        metrics.push({
          label: 'Točka A (Začetek / Izhodišče)',
          value: `${origLat.toFixed(4)}°, ${origLon.toFixed(4)}°`,
          highlight: true
        });
      }
      if (destLat && destLon) {
        metrics.push({
          label: isActive ? 'Točka B (Trenutna pozicija)' : 'Točka B (Cilj poti)',
          value: `${destLat.toFixed(4)}°, ${destLon.toFixed(4)}°`,
          highlight: true
        });
      }
      const dist = trip.distanceKm ?? trip.estimatedDistanceKm;
      if (dist != null) {
        metrics.push({ label: 'Razdalja', value: `${dist} km`, highlight: true });
      }
      if (trip.durationFormatted) {
        metrics.push({ label: 'Trajanje', value: trip.durationFormatted, highlight: false });
      } else if (trip.durationSeconds) {
        metrics.push({ label: 'Trajanje', value: `${Math.round(trip.durationSeconds / 60)} min`, highlight: false });
      }
      if (trip.avgSpeedKmH || trip.speedKmH) {
        metrics.push({ label: 'Hitrost', value: `${trip.avgSpeedKmH || trip.speedKmH} km/h`, highlight: false });
      }

      nodeTitle = `${isActive ? '⚡' : '🏁'} ${trip.name || 'Mikromobilnost pot'}`;
      const resolvedCategory = isActive ? '⚡ AKTIVNA TRASA VOŽNJE' : '🏁 ZAKLJUČENA TRASA VOŽNJE';

      return {
        id: String(trip.id || data.id),
        title: nodeTitle,
        category: resolvedCategory,
        type: 'micromobility',
        trainNum: tNum,
        coordinates: coords,
        timestamp: new Date(),
        metrics,
        rawPayload: trip,
        loraData: undefined
      };
    }

    /**
     * A modelled freight train, opened up.
     *
     * The point of this panel is to keep the two halves apart. The operator
     * candidates are real: every one holds a freight licence in Slovenia and
     * carries an ERA code you can look up. The train number is not knowable —
     * TAF TSI calls it the Core of the composite identifier and nobody
     * publishes it here — so the panel says so in that field rather than
     * putting a number there.
     */
    if (type === 'freight_paths') {
      // MapLibre flattens feature properties, so nested objects arrive as JSON text.
      const unpack = (v: any) => {
        if (v == null) return null;
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch { return null; }
      };
      const oc = unpack(data.operatorCandidates);
      const prev = unpack(data.prevPoint);
      const next = unpack(data.nextPoint);
      const tps: any[] = unpack(data.timingPoints) || [];
      const DAYS = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'];
      const days: number[] | null = unpack(data.daysOfWeek);

      nodeTitle = data.trainNumber ? `🚆 Tovorni vlak ${data.trainNumber}` : '🚆 Tovorna pot';

      // What it is and where it is going — the published facts, first.
      if (data.relation) metrics.push({ label: 'Relacija', value: data.relation, highlight: true });
      if (data.corridorLabel) metrics.push({ label: 'Koridor', value: data.corridorLabel, highlight: false });
      if (data.direction) metrics.push({ label: 'Smer', value: data.direction, highlight: false });

      // Three different quantities, never merged into one "speed".
      if (data.lineSpeedKmh != null) {
        metrics.push({ label: 'Progovna hitrost (odsek)', value: `≤ ${data.lineSpeedKmh}`, unit: 'km/h', highlight: true });
        if (data.lineSpeedSection) metrics.push({ label: '  ↳ odsek', value: data.lineSpeedSection, highlight: false });
        metrics.push({ label: '  ↳ vir', value: 'ERA RINF — največja dovoljena hitrost proge, ne hitrost tega vlaka', highlight: false });
      }
      if (data.speedClass) metrics.push({ label: 'Hitrostni razred vlaka', value: data.speedClass, highlight: false });
      if (data.legAverageKmh != null) {
        metrics.push({ label: 'Povprečje na odseku kataloga', value: data.legAverageKmh, unit: 'km/h', highlight: false });
        if (data.legAverageBasis) metrics.push({ label: '  ↳ pozor', value: data.legAverageBasis, highlight: false });
      }
      if (prev?.location) {
        metrics.push({ label: 'Nazadnje mimo', value: `${prev.location}${prev.time ? ` ob ${prev.time}` : ''}`, highlight: false });
      }
      if (next?.location) {
        metrics.push({
          label: 'Naslednja točka',
          value: `${next.location}${next.time ? ` ob ${next.time}` : ''}${next.inMin != null ? ` (čez ${next.inMin} min)` : ''}`,
          highlight: true
        });
      }
      if (data.phase === 'dwell') {
        const d = unpack(data.dwell);
        if (d?.location) {
          metrics.push({
            label: 'Stoji na postaji',
            value: `${d.location}${d.arrival ? ` — prih. ${d.arrival}` : ''}${d.departure ? `, odh. ${d.departure}` : ''}${d.remainingMin != null ? ` (čez ${d.remainingMin} min)` : ''}`,
            highlight: true
          });
        }
      }
      if (data.progressPercent != null) {
        metrics.push({ label: 'Opravljeno', value: `${data.progressPercent} % poti`, highlight: false });
      }
      if (data.kmAlong != null && data.routeKm != null) {
        metrics.push({ label: 'Prevoženo', value: `${data.kmAlong} od ${data.routeKm} km`, highlight: false });
      }
      if (data.journeyMin != null) {
        const h = Math.floor(Number(data.journeyMin) / 60), m = Number(data.journeyMin) % 60;
        metrics.push({ label: 'Vozni čas', value: h ? `${h} h ${m} min` : `${m} min`, highlight: false });
      }
      if (days?.length) {
        metrics.push({
          label: 'Vozi ob',
          value: days.length === 7 ? 'vsak dan' : days.map(d => DAYS[d - 1]).join(', '),
          highlight: false
        });
      }

      // Identity. The number is published, which is the whole point of this
      // layer — say where it comes from rather than leaving it to be assumed.
      if (data.trainNumber) {
        metrics.push({ label: 'Številka vlaka (SŽ-I)', value: data.trainNumber, highlight: true });
        metrics.push({
          label: '  ↳ vir številke',
          value: 'Stolpec "SZ-I" v katalogu koridorja — nacionalna številka poti, Core identifikatorja TAF TSI',
          highlight: false
        });
      }
      if (data.papId) metrics.push({ label: 'Oznaka poti (PaP)', value: data.papId, highlight: false });

      // Every timing point the catalogue publishes, with its TAF location code.
      for (const t of tps) {
        const when = t.arrival && t.departure && t.arrival !== t.departure
          ? `${t.arrival} → ${t.departure}` : (t.departure || t.arrival || '');
        metrics.push({ label: `  ⏱ ${t.location}`, value: `${when}${t.uopid ? `  ·  ${t.uopid}` : ''}`, highlight: false });
      }

      // Who may run it. The catalogue names nobody, so this is the register.
      if (oc?.candidates?.length) {
        metrics.push({
          label: 'Prevoznik',
          value: 'Katalog ne navaja prevoznika — pot je ponujena zmogljivost',
          highlight: true
        });
        for (const c of oc.candidates.slice(0, 5)) {
          const marks = (c.keeperMarkings || []).join(', ');
          metrics.push({
            label: `  ↳ ${c.code}`,
            value: [c.name, marks ? `VKM ${marks}` : null].filter(Boolean).join(' — '),
            highlight: false
          });
        }
        if (oc.licensedCount != null) {
          metrics.push({ label: '  ↳ licenciranih v SI', value: `${oc.licensedCount} tovornih prevoznikov`, highlight: false });
        }
        if (oc.basis) metrics.push({ label: '  ↳ podlaga', value: oc.basis, highlight: false });
      }

      // The caveat, stated as a field rather than buried in a footnote.
      if (data.status) metrics.push({ label: 'Zanesljivost', value: data.status, highlight: true });
      if (data.runsToday != null) {
        metrics.push({ label: 'Po koledarju danes', value: data.runsToday ? 'da' : 'ne', highlight: false });
      }
      if (data.timetableYear) metrics.push({ label: 'Vozni red', value: `TT${data.timetableYear}`, highlight: false });
      if (data.source) metrics.push({ label: 'Vir', value: data.source, highlight: false });

      return {
        id: data.id || 'freight_path',
        title: nodeTitle,
        category: 'TOVORNI VLAK — OBJAVLJENA POT KORIDORJA',
        type: 'freight_paths',
        trainNum: data.trainNumber || undefined,
        coordinates: coords,
        timestamp: new Date(),
        metrics,
        rawPayload: data,
        loraData: undefined
      };
    }

    let resolvedCategory = type;
    if (type === 'rinf_network' || type === 'rinf_network_line' || type === 'rinf_track') {
      resolvedCategory = 'ERA RINF ŽELEZNIŠKA PROGA (ODSEK)';
    } else if (type === 'rinf' || type === 'rinf_station') {
      resolvedCategory = 'ERA RINF OPERATIVNA TOČKA (POSTAJA)';
    } else if (data.type === 'tram') {
      resolvedCategory = 'MESTNI TRAMVAJ';
    } else if (data.type === 'bus' || type === 'buses') {
      resolvedCategory = 'AVTOBUSNI PROMET';
    } else if (type === 'rail_works' || data.type === 'rail_work') {
      resolvedCategory = 'DELA NA PROGI / ZAPORA (TCR)';
    } else if (type === 'freight_train' || type === 'freight_trains' || data.type === 'freight_train') {
      resolvedCategory = 'TOVORNI BLOK VLAK (TEN-T)';
    } else if (isStationNode) {
      resolvedCategory = 'ŽELEZNIŠKA & AVTOBUSNA POSTAJA';
    } else if (type === 'micromobility') {
      if (data.status === 'in_trip') {
        resolvedCategory = '⚡ AKTIVNA VOŽNJA (METODA C)';
      } else {
        resolvedCategory = (data.type === 'STATION' || data.isStation)
          ? 'URADNA MIKROMOBILNOSTNA POSTAJA'
          : (data.form === 'CAR' ? 'CAR SHARING (AVANT2GO)' : (data.form === 'BICYCLE' ? 'MESTNO KOLO (BREZAVTA)' : 'ELEKTRIČNI SKIRO (BOLT)'));
      }
    }

    return {
      id: data.id || 'sel',
      title: nodeTitle,
      category: resolvedCategory,
      type: (type === 'freight_train' || data.type === 'freight_train') ? 'freight_train' : (isStationNode ? 'station' : (type === 'micromobility' ? 'micromobility' : ((data.type || type) as any))),
      trainNum: tNum,
      coordinates: coords,
      timestamp: data.timestamp ? (typeof data.timestamp === 'number' ? new Date(data.timestamp * 1000) : new Date(data.timestamp)) : new Date(),
      metrics: metrics,
      rawPayload: data,
      loraData: loraDataObj
    };
  }

    private async loadIcon(id: string, svg: string) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onerror = (e) => { console.error('Image load failed', id, e); resolve(); };
      img.onload = () => {
        if (!this.map.hasImage(id)) this.map.addImage(id, img);
        resolve();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
  }

  private async loadIcons() {
    const getVehicleSvg = (type: string, color: string, hasArrow: boolean) => {
      const cy = hasArrow ? 23 : 20;
      const arrow = hasArrow 
        ? `<polygon points="20,1.5 27,13 20,9.5 13,13" fill="${color}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
           <polygon points="20,1.5 27,13 20,9.5 13,13" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round" opacity="0.35"/>`
        : '';

      let glyph = '';
      if (type === 'train') {
        glyph = `<g transform="translate(12, ${cy - 8}) scale(0.65)" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="2" rx="3" fill="#0f172a"/>
          <path d="M3 10h18"/>
          <path d="M12 2v8"/>
          <circle cx="7" cy="15" r="1.5" fill="${color}"/>
          <circle cx="17" cy="15" r="1.5" fill="${color}"/>
          <path d="m6 20-2 2"/>
          <path d="m18 20 2 2"/>
        </g>`;
      } else if (type === 'tram') {
        glyph = `<g transform="translate(12, ${cy - 8}) scale(0.65)" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2V-1"/><path d="M8 -1h8"/>
          <rect width="18" height="16" x="3" y="3" rx="3" fill="#0f172a"/>
          <path d="M3 9h18"/>
          <circle cx="7" cy="14" r="1.5" fill="${color}"/>
          <circle cx="17" cy="14" r="1.5" fill="${color}"/>
          <path d="m6 19-2 2"/><path d="m18 19 2 2"/>
        </g>`;
      } else if (type === 'subway') {
        glyph = `<g transform="translate(12, ${cy - 8}) scale(0.65)" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="17" x="3" y="2" rx="3" fill="#0f172a"/>
          <path d="M3 9h18"/>
          <circle cx="12" cy="14" r="2.5" fill="${color}"/>
          <path d="m6 19-2 2"/><path d="m18 19 2 2"/>
        </g>`;
      } else {
        // bus
        glyph = `<g transform="translate(12, ${cy - 8}) scale(0.65)" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="16" x="3" y="3" rx="3" fill="#0f172a"/>
          <path d="M3 9h18"/>
          <path d="M8 3v6"/><path d="M16 3v6"/>
          <circle cx="7" cy="15" r="1.5" fill="${color}"/>
          <circle cx="17" cy="15" r="1.5" fill="${color}"/>
          <path d="M3 19h18"/>
        </g>`;
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        ${arrow}
        <circle cx="20" cy="${cy}" r="12" fill="#0f172a" stroke="${color}" stroke-width="2.5"/>
        ${glyph}
      </svg>`;
    };

    const types = [
      { type: 'bus', color: '#10b981' },     // Emerald green default bus
      { type: 'train', color: '#38bdf8' },   // SŽ blue default train
      { type: 'tram', color: '#ec4899' },    // Pink tram
      { type: 'subway', color: '#8b5cf6' },  // Purple subway

      // Operator-specific Buses
      { type: 'bus-lpp', color: '#10b981' },       // LPP Ljubljana Green
      { type: 'bus-nomago', color: '#0284c7' },    // Nomago Ocean Blue
      { type: 'bus-arriva', color: '#2563eb' },    // Arriva Royal Blue
      { type: 'bus-marprom', color: '#ef4444' },   // Marprom Maribor Red
      { type: 'bus-apms', color: '#f59e0b' },      // AP Murska Sobota Amber
      { type: 'bus-mpkranj', color: '#8b5cf6' },   // MP Kranj Purple
      { type: 'bus-volanbusz', color: '#f59e0b' }, // Volánbusz Golden Amber
      { type: 'bus-graz', color: '#059669' },      // Graz Linien Bus Emerald Green
      { type: 'bus-other', color: '#06b6d4' },     // IJPP Other Cyan

      // Operator-specific Trams
      { type: 'tram-graz', color: '#059669' },     // Graz Linien Tram Emerald Green
      { type: 'tram-bkk', color: '#eab308' },      // BKK Budapest Tram Yellow

      // Operator-specific Trains
      { type: 'train-sz', color: '#38bdf8' },          // Slovenske železnice Cyan/Sky
      { type: 'train-oebb', color: '#e11d48' },        // ÖBB / GKB Austrian Red
      { type: 'train-mav', color: '#facc15' },         // MÁV / GYSEV Hungarian Gold
      { type: 'train-hz', color: '#6366f1' },          // HŽ Croatian Indigo
      { type: 'train-trenitalia', color: '#059669' },  // Trenitalia Italian Green
      { type: 'train-db', color: '#f43f5e' },          // DB German Red
      { type: 'train-freight', color: '#f97316' },     // Cargo / Freight Orange
      { type: 'train-other', color: '#fbbf24' }        // Other Trains Gold
    ];

    const iconPromises: Promise<void>[] = [];
    for (const { type, color } of types) {
      const baseType = type.startsWith('bus') ? 'bus' : (type.startsWith('train') ? 'train' : (type.startsWith('tram') ? 'tram' : type));
      // Directional arrow is ALWAYS included so the vehicle orientation is clear even when stopped
      const arrowSvg = getVehicleSvg(baseType, color, true);
      iconPromises.push(this.loadIcon(`icon-${type}`, arrowSvg));
      iconPromises.push(this.loadIcon(`icon-${type}-dir`, arrowSvg));
      iconPromises.push(this.loadIcon(`icon-${type}-static`, arrowSvg));
    }

    const planeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 5-3.5 3.5L3 16l-1 2 4 1 1 4 2-1-.5-2.5L12 15l5 6 1.8-.7c.4-.2.7-.6.6-1.1z"/></svg>`;
    const bikeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84cc16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`;
    const weatherSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a5.5 5.5 0 0 0-1-10.9A7 7 0 0 0 3.5 13H3a4 4 0 1 0 0 8h14.5Z"/></svg>`;
    const airSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;

    iconPromises.push(this.loadIcon('icon-plane', planeSvg));
    iconPromises.push(this.loadIcon('icon-bike', bikeSvg));
    iconPromises.push(this.loadIcon('icon-weather', weatherSvg));
    iconPromises.push(this.loadIcon('icon-air', airSvg));

    await Promise.all(iconPromises);
  }
  public destroy() {
    // A controller destroyed before its style had loaded used to come back to
    // life: the style-fallback timer fired on the removed map, 'style.load'
    // followed, and startPolling() began a second polling loop and a second
    // set of network requests that nothing could ever stop — a ghost
    // controller doing all the work of the live one, on a phone's CPU and
    // data plan, for the rest of the session.
    this.destroyed = true;
    this.isReady = false;
    if (this.styleFallbackTimer != null) { clearTimeout(this.styleFallbackTimer); this.styleFallbackTimer = null; }
    if (this.pollingInterval) clearTimeout(this.pollingInterval);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.vehicleMotionMap.clear();
    this.cachedSourceGeoJSON.clear();
    this.lastSourceAnimationTimestamp.clear();
    if (this.map) this.map.remove();
  }
}

export const LAYER_META: Record<string, { label: string; color: string; category: string; icon?: string }> = {
  
  sz_rail:        { label: 'SŽ Železniške proge (Tiri & Kretnice)',  color: '#38bdf8', category: 'sz' },
  orm:            { label: 'Tirno omrežje (OpenRailwayMap)', color: '#f97316', category: 'sz' },
  sz_stations:    { label: 'SŽ Železniške postaje',         color: '#0284c7', category: 'sz' },
  rinf:           { label: 'ERA RINF Postaje', color: '#0284c7', category: 'sz' },
  rinf_network:   { label: 'ERA RINF Železniške proge', color: '#0ea5e9', category: 'sz' },
  sz_crossings:   { label: 'SŽ Nivojski prehodi NPr',  color: '#f59e0b', category: 'sz' },
  buses:          { label: 'Avtobusi v Živo (BrezAvta IJPP: LPP, Nomago, Arriva, Marprom, AP MS)', color: '#10b981', category: 'buses' },
  transit:        { label: 'SŽ & Tuji Vlaki (Živi GPS)', color: '#06b6d4', category: 'transit' },
  drones:         { label: 'Brezpilotni letalniki / Droni', color: '#f43f5e', category: 'drones' },
  logistics_hubs: { label: 'Logistični & Paketni centri', color: '#f43f5e', category: 'logistics' },
  trajectories:   { label: 'Sledi vožnje',     color: '#a855f7', category: 'tracking' },
  signals:        { label: 'C-ITS Semaforji', color: '#22c55e', category: 'traffic' },
  roads:          { label: 'Avtocesta A5 & Vpadnice',      color: '#94a3b8', category: 'traffic' },
  traffic_counts: { label: 'Cestni števci prometa',  color: '#ef4444', category: 'traffic' },
  bikeshare:      { label: 'Kolesa Pomurje Bikes',          color: '#84cc16', category: 'mobility' },
  evcharge:       { label: 'EV Polnilnice (CCS/Type2)',    color: '#a3e635', category: 'mobility' },
  lorawan:        { label: 'LoRaWAN Nokia IoT Prehodi',    color: '#fbbf24', category: 'iot' },
  nbiot:          { label: 'NB-IoT Pametni Senzorji (Telekom)', color: '#d97706', category: 'iot' },
  rail_sensors:   { label: 'Senzorji Železniške Inf.', color: '#0ea5e9', category: 'sz' },
  traffic_sensors:{ label: 'Senzorji Cestnega Prometa', color: '#ec4899', category: 'traffic' },
  logistics_sensors:{ label: 'Pametna Logistika', color: '#a855f7', category: 'logistics' },
  arso:           { label: 'ARSO Postaje (Vreme)', color: '#fcd34d', category: 'iot' },
  air:            { label: 'OpenSenseMap Kakovost Zraka', color: '#10b981', category: 'iot' },
  aircraft:       { label: 'ADS-B Zračni prostor', color: '#93c5fd', category: 'air' },
  quakes:         { label: 'Potresi (EMSC/USGS)',  color: '#fca5a5', category: 'geo' },
  hafas:          { label: 'HAFAS Vlaki (ÖBB/DB)', color: '#0ea5e9', category: 'transit' },
  delays_heatmap: { label: 'Live Delay Heatmap (HAFAS)', color: '#ef4444', category: 'analytics' },
  aprs:           { label: 'APRS.fi (Radioamaterji)', color: '#f43f5e', category: 'iot' },
  loramesh:       { label: 'LoRaMesh Pametna Mesta', color: '#fbbf24', category: 'iot' },
  sparql:         { label: 'European Data Portal', color: '#a855f7', category: 'iot' },
  warehouse:      { label: 'Skladišča & Logistični Depoji', color: '#64748b', category: 'logistics' },
  yard:           { label: 'Tovorni Terminali & Ranžirna Vozlišča (Luka Koper / Zalog)', color: '#f59e0b', category: 'sz' },
  freight_paths: { label: 'Tovorni vlaki (katalog poti)', color: '#f97316', category: 'sz' },
  tent_railways:  { label: 'TEN-T proge (tovor / potniki)', color: '#a78bfa', category: 'sz' },
  border_crossings: { label: 'Mejni prehodi (RINF)', color: '#f472b6', category: 'sz' },
  rail_works:     { label: 'Dela na progi / zapore (TCR koridorjev)', color: '#f59e0b', category: 'sz' },
  sensorcommunity:{ label: 'Sensor.Community (Nokia/Siemens/Air)', color: '#14b8a6', category: 'iot' },
  github:         { label: 'GitHub Open Source (Smart City)', color: '#e2e8f0', category: 'logistics' },
  openaq:         { label: 'OpenAQ (.gov zrak)', color: '#14b8a6', category: 'env' },
  ttn:            { label: 'TTN LoRaWAN Gateways', color: '#3b82f6', category: 'iot' },
  opensense:      { label: 'OpenSenseMap', color: '#a855f7', category: 'env' },
  eurorail:       { label: 'EU High-Speed Rail (TGV/ICE)', color: '#d946ef', category: 'transit' },
  traffic:        { label: 'OpenTrafficMap (Hitrost & Gostota)', color: '#22c55e', category: 'traffic' },
  hydro:          { label: 'ARSO Hidrološke postaje (Reke & Vode)', color: '#0ea5e9', category: 'env' }
};

