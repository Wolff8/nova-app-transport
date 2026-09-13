export interface LoRaPacket {
  id: string;
  timestamp: Date | string;
  gatewayId: string;
  gatewayName: string;
  devEui: string;
  appEui?: string;
  deviceName: string;
  deviceType: 'vreme' | 'voda' | 'tla' | 'parkirisce' | 'smetnjak' | 'zeleznica' | 'okolje';
  frequencyMHz: number;
  sf: number; // 7 - 12
  bandwidthKHz: number; // 125 or 250
  cr: string; // 4/5
  rssi: number; // dBm
  snr: number; // dB
  airtimeMs: number;
  fCnt: number;
  payloadHex: string;
  decoded: Record<string, any>;
  analysis: {
    signalQuality: 'Odlična' | 'Dobra' | 'Zmerna' | 'Mejna' | 'Šibka';
    qualityColor: string;
    sfMeaning: string;
    airtimeCompliance: string;
    linkBudgetDb: number;
    noiseFloorMargin: string;
  };
}

export interface LoRaGatewayInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  online: boolean;
  frequencyPlan: string;
  antennaCount: number;
  antennaGainDbi: number;
  txPowerDbm: number;
  rssi: number;
  snr: number;
  noiseFloorDbm: number;
  activeNodes: number;
  rxPackets: number;
  txPackets: number;
  dutyCyclePercent: number;
  channelUtilization: Record<string, number>; // e.g. "868.1": 18%, "868.3": 22%
  recentPackets: LoRaPacket[];
  raw?: Record<string, any>;
}

export interface TrafficSignalInfo {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lon: number;
  state: 'RED' | 'GREEN' | 'YELLOW';
  countdownSeconds: number;
  totalPhaseSeconds: number;
  phaseName: string;
  glosaRecommendedSpeedKmh: number;
  glosaDistanceMeters: number;
  v2xPriorityActive: boolean;
  v2xPriorityVehicle?: string;
  pedestrianWaiting: boolean;
  cycleLengthSeconds: number;
  controllerModel: string;
  citsStandard: string;
  spatMessage: {
    intersectionId: number;
    moy: number;
    dSecond: number;
    phaseState: string;
    minEndTimeSeconds: number;
    maxEndTimeSeconds: number;
  };
  approachLanes: {
    laneId: number;
    direction: string;
    status: 'RED' | 'GREEN' | 'YELLOW';
    queueLengthVehicles: number;
  }[];
  raw?: Record<string, any>;
}

export interface DroneInfo {
  id: string;
  uasId: string;
  model: string;
  operator: string;
  operatorEasaId: string;
  purpose: string;
  lat: number;
  lon: number;
  pilotLat: number;
  pilotLon: number;
  altitudeAglMeters: number;
  altitudeMslMeters: number;
  speedKmh: number;
  bearing: number;
  remoteIdStandard: string;
  batteryPercent: number;
  signalRssi: number;
  status: 'V letu' | 'Lebdenje' | 'Vračanje (RTH)' | 'Avtonomna misija';
  lastSeen: string;
  breadcrumbs?: BreadcrumbPoint[];
  raw?: Record<string, any>;
}

export interface BreadcrumbPoint {
  coordinates: [number, number];
  timestamp: number;
  speedKmh?: number;
}

export interface AppState {
  counts: Record<string, number>;
  onlineLorawan: number;
  errors: string[];
  lastUpdate: Date | null;
  osmIsLive: boolean;
  transit?: any[];
  drones?: DroneInfo[];
  gateways?: LoRaGatewayInfo[];
  loraPackets?: LoRaPacket[];
  signals?: TrafficSignalInfo[];
  air?: any[];
  flights?: any[];
  bikes?: any[];
  cars?: any[];
  trafficCounters?: any[];
  quakes?: any[];
  ev?: any[];
  weather?: any[];
  nbiot?: any[];
  rail_sensors?: any[];
  traffic_sensors?: any[];
  logistics_sensors?: any[];
  micromobility?: any[];
  activeTrips?: any[];
  completedTrips?: any[];
  micromobilityStats?: any;
  hafas?: any[];
  aprs?: any[];
  loramesh?: any[];
  sparql?: any[];
  warehouses?: any[];
  yards?: any[];
  sensorcommunity?: any[];
  arso?: any[];
  smartcity?: any[];
  switches?: any[];
  rail_signals?: any[];
  freight?: any[];
  spat?: any[];
  hydro?: any[];
  power?: any[];
  moms?: any[];
  openaq?: any[];
  ttn?: any[];
  opensense?: any[];
  eurorail?: any[];
  github?: any[];
  rinf?: any[];
  rinf_network?: any;
}

export interface TelemetryNode {
  id: string;
  type: 'weather' | 'train' | 'freight_train' | 'freight_paths' | 'foreign_train' | 'bus' | 'tram' | 'station' | 'rinf_station' | 'rinf' | 'rinf_network' | 'rinf_track' | 'drone' | 'lorawan' | 'nbiot' | 'rail_sensors' | 'traffic_sensors' | 'logistics_sensors' | 'air' | 'aircraft' | 'bike' | 'micromobility' | 'micromobility_trip' | 'car' | 'ev' | 'traffic_counter' | 'signal' | 'rail_station' | 'quake' | 'location' | 'hafas' | 'aprs' | 'loramesh' | 'sparql' | 'warehouse' | 'yard' | 'sensorcommunity' | 'arso' | 'smartcity' | 'switch' | 'rail_signal' | 'freight' | 'spat' | 'hydro' | 'power' | 'moms' | 'openaq' | 'ttn' | 'opensense' | 'eurorail' | 'github' | 'rail_work';
  title: string;
  subtitle?: string;
  category: string;
  coordinates: [number, number];
  timestamp: string | Date;
  status?: 'online' | 'offline' | 'warning' | 'moving' | 'delayed' | 'ontime';
  bearing?: number;
  speed?: number;
  vendor?: string;
  tech?: string;
  packets?: any;
  metrics: {
    label: string;
    value: string | number;
    unit?: string;
    highlight?: boolean;
    trend?: 'up' | 'down' | 'neutral';
  }[];
  rawPayload: Record<string, any>;
  loraData?: {
    gateway: LoRaGatewayInfo;
    packets: LoRaPacket[];
  };
  signalData?: TrafficSignalInfo;
  breadcrumbs?: BreadcrumbPoint[];
  trainNum?: string;
  networkInfo?: {
    protocol: string;
    source: string;
    frequency?: string;
    rssi?: number;
    snr?: number;
    delaySeconds?: number;
  };
}

export interface TelemetryLogEntry {
  id: string;
  timestamp: Date;
  type: TelemetryNode['type'];
  nodeName: string;
  summary: string;
  category?: string;
  coordinates?: [number, number];
  details?: Record<string, any>;
  raw: Record<string, any>;
}

export interface LayerMeta {
  id: string;
  label: string;
  color: string;
  icon?: string;
  description?: string;
}

export interface TrainStopover {
  stopName: string;
  stationId?: string;
  lat?: number;
  lon?: number;
  plannedDeparture?: string | null;
  actualDeparture?: string | null;
  plannedArrival?: string | null;
  actualArrival?: string | null;
  delayMinutes: number;
  platform?: string | null;
  passed: boolean;
  current: boolean;
}

export interface TrainTripData {
  tripId: string;
  line: string;
  trainNumber?: string;
  operator: string;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  delayMinutes: number;
  status: 'ontime' | 'delayed' | 'cancelled';
  rollingStock?: string;
  amenities?: string[];
  stopovers: TrainStopover[];
  currentLocation?: [number, number];
  polyline?: any;
  remarks?: string[];
}
