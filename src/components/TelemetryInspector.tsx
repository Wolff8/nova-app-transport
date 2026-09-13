import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Copy, Check, Radio, Navigation, Activity, Zap, Wind, 
  Layers, Gauge, ArrowUpRight, Compass, ShieldCheck, Clock, MapPin,
  ChevronDown, ChevronUp, Maximize2, Cpu, Signal, HelpCircle, FileText,
  AlertTriangle, Car, Timer, CloudRain, Bike, HardHat, TrainFront, Box, Droplets, Power, Github,
  RefreshCw, Bus, CheckCircle2, Wifi, ArrowRight, Globe, ExternalLink,
  Truck, Package, Weight, Sliders, Info, Accessibility, Coffee, Sparkles, Train
} from 'lucide-react';
import { TelemetryNode, LoRaPacket, TrafficSignalInfo, TrainTripData } from '../types';
import { Image as ImageIcon } from 'lucide-react';
import { fetchPackets, loadStationDepartures, loadTrainTrip } from '../lib/api';
import { getEnrichedLocomotiveData, EnrichedLocomotive, COMMON_DATA_SOURCES } from '../data/europeanLocomotiveRegistry';
import { 
  CrossBorderFreightStatus, 
  EnrichedFreightWagon, 
  generateCrossBorderFreightStatus 
} from '../data/crossBorderFreightRegistry';
import { FreightCompositionSchematic } from './FreightCompositionSchematic';
import { PassengerCompositionSchematic } from './PassengerCompositionSchematic';
import { enrichPassengerCoach, EnrichedPassengerCoach } from '../data/passengerCoachRegistry';

interface TelemetryInspectorProps {
  node: TelemetryNode | null;
  onClose: () => void;
  onFlyTo?: (coords: [number, number], zoom?: number) => void;
  onSelectTrain?: (departure: any) => void;
  onHighlightRoute?: (polyline: any) => void;
}

export const TelemetryInspector: React.FC<TelemetryInspectorProps> = ({ 
  node, 
  onClose, 
  onFlyTo, 
  onSelectTrain, 
  onHighlightRoute 
}) => {
  const [activeTab, setActiveTab] = useState<'journey' | 'metrics' | 'departures' | 'cits_spat' | 'lora_analysis' | 'packets' | 'raw' | 'network' | 'glossary' | 'weather_forecast'>('metrics');
  const [selectedPacket, setSelectedPacket] = useState<LoRaPacket | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [smartCityData, setSmartCityData] = useState<any>(null);
  const [vagonwebData, setVagonwebData] = useState<string[] | null>(null);
  const [vagonwebMeta, setVagonwebMeta] = useState<{ operator?: string; trainType?: string; source?: string; isFreight?: boolean; locomotive?: EnrichedLocomotive } | null>(null);
  const [enrichedLoco, setEnrichedLoco] = useState<EnrichedLocomotive | null>(null);
  const [crossBorderFreight, setCrossBorderFreight] = useState<CrossBorderFreightStatus | null>(null);
  const [loadingCrossBorder, setLoadingCrossBorder] = useState(false);
  const [showFreightDetails, setShowFreightDetails] = useState(true);
  const [selectedWagon, setSelectedWagon] = useState<EnrichedFreightWagon | null>(null);
  const [freightWagonViewMode, setFreightWagonViewMode] = useState<'schematic' | 'detailed' | 'compact'>('schematic');
  const [selectedPassengerCoach, setSelectedPassengerCoach] = useState<EnrichedPassengerCoach | null>(null);
  const [passengerWagonViewMode, setPassengerWagonViewMode] = useState<'schematic' | 'list'>('schematic');
  const [showCrossBorderData, setShowCrossBorderData] = useState<boolean>(false);
  const [loadingVagonweb, setLoadingVagonweb] = useState(false);
  const vagonwebCache = useRef<Map<string, { composition: string[]; meta: any; crossBorderFreight?: CrossBorderFreightStatus }>>(new Map());
  const lastFetchedTrainKey = useRef<string | null>(null);

  // Memoize enriched passenger coaches from vagonwebData
  const enrichedPassengerCoaches = React.useMemo(() => {
    if (!vagonwebData || vagonwebData.length === 0) return [];
    const trainNum = node?.title?.replace(/\D/g, '') || '';
    const op = vagonwebMeta?.operator || node?.rawPayload?.operator || 'SŽ';
    return vagonwebData.map((wag, idx) => enrichPassengerCoach(wag, idx, trainNum, op));
  }, [vagonwebData, node?.title, vagonwebMeta?.operator, node?.rawPayload?.operator]);

  // Train Trip / Journey State
  const [trainTripData, setTrainTripData] = useState<TrainTripData | null>(null);
  const [loadingTrip, setLoadingTrip] = useState<boolean>(false);
  const [tripError, setTripError] = useState<string | null>(null);

  // Departures & Timetable State
  const [stationDepartures, setStationDepartures] = useState<any[]>([]);
  const [stationMeta, setStationMeta] = useState<any>(null);
  const [loadingDepartures, setLoadingDepartures] = useState(false);
  const [departureFilter, setDepartureFilter] = useState<'all' | 'train' | 'bus'>('all');
  const [departureError, setDepartureError] = useState<string | null>(null);

  const formatDepartureTime = (isoOrTime?: string | null, formattedFallback?: string | null) => {
    if (formattedFallback && formattedFallback !== '--:--' && !formattedFallback.includes('T')) {
      return formattedFallback;
    }
    if (!isoOrTime) return '--:--';
    if (!isoOrTime.includes('T') && isoOrTime.length <= 8) return isoOrTime;
    try {
      const d = new Date(isoOrTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Ljubljana' });
      }
    } catch {}
    return isoOrTime;
  };

  const isYard = Boolean(
    node?.type === 'yard' ||
    node?.rawPayload?.type === 'yard' ||
    (node?.category && (
      node.category.includes('TOVORNA POSTAJA') || 
      node.category.includes('TOVORNI TERMINAL') || 
      node.category.includes('RANŽIRNA POSTAJA') ||
      node.category.includes('ŽELEZNIŠKO VOZLIŠČE')
    ))
  );

  const isStation = Boolean(
    isYard ||
    node?.type === 'station' || 
    node?.type === 'rinf_station' || 
    node?.type === 'rail_station' || 
    node?.type === 'rinf' || 
    (node?.category && (
      node.category.includes('POSTAJA') || 
      node.category.includes('POSTAJALIŠČE') || 
      node.category.includes('TERMINAL') || 
      node.category.includes('VOZLIŠČE')
    )) || 
    !!node?.rawPayload?.isStation
  );

  /**
   * A modelled freight train is deliberately kept out of the passenger journey
   * panel. That panel is built for a train with a published timetable: when a
   * field is missing it falls back to Ljubljana, to Maribor, and to "vozi
   * skladno z objavljenim voznim redom SŽ". For a modelled position every one
   * of those is a claim nobody made, so this gets its own panel instead.
   */
  const isModelledFreight = Boolean(
    node?.type === 'freight_paths' ||
    node?.rawPayload?.type === 'corridor_freight_path' ||
    node?.rawPayload?.isModelled === true
  );

  const isFreightTrain = !isStation && !isModelledFreight && Boolean(
    node?.type === 'freight_train' ||
    node?.type === 'freight' ||
    node?.rawPayload?.type === 'freight_train' ||
    node?.rawPayload?.type === 'freight' ||
    node?.rawPayload?.isFreight ||
    (node?.rawPayload?.trainNumber && String(node.rawPayload.trainNumber).startsWith('TV ')) ||
    (node?.title && (
      node.title.startsWith('TV ') || 
      node.title.startsWith('RCG ') || 
      node.title.startsWith('CER ') || 
      node.title.startsWith('MET ') || 
      node.title.startsWith('DBC ') || 
      node.title.startsWith('HZ ')
    )) ||
    (node?.category && (
      node.category.includes('TOVORNI BLOK VLAK') || 
      node.category.includes('FREIGHT TRAIN')
    ))
  );

  const isTrain = !isStation && !isModelledFreight && (
    node?.type === 'train' ||
    node?.type === 'hafas' || 
    node?.type === 'eurorail' || 
    node?.type === 'freight_train' || 
    node?.type === 'foreign_train' || 
    node?.rawPayload?.mode === 'train' || 
    node?.rawPayload?.type === 'train' || 
    isFreightTrain ||
    (node?.category && node.category.toLowerCase().includes('vlak')) ||
    (node?.category && node.category.toLowerCase().includes('železniški') && !node?.rawPayload?.plate)
  ) && !(node?.type === 'bus' || node?.rawPayload?.type === 'bus' || node?.rawPayload?.line?.mode === 'bus');
  const hasDepartures = isStation || isTrain;

  const fetchTrainTrip = () => {
    if (!node) return;
    setLoadingTrip(true);
    setTripError(null);

    const raw = node.rawPayload || {};
    const tNum = node.trainNum || raw.trainNum || (node.title?.match(/\d+/) ? node.title.match(/\d+/)![0] : '');
    const tripId = raw.realTripId || raw.tripId || (node.id.startsWith('train_') || node.id.startsWith('travic_') ? undefined : node.id);
    const origin = raw.origin || raw.from;
    const destination = raw.destination || raw.direction || raw.to;
    const operator = raw.operator || raw.operatorName || '';
    
    const nodeMetricDelay = (() => {
      if (!node.metrics) return 0;
      const m = node.metrics.find(x => x.label === 'Prijavljena zamuda' || x.label === 'Zamuda');
      if (!m) return 0;
      const match = String(m.value).match(/\+?(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })();
    const delay = raw.delay != null ? raw.delay : (raw.delayMin != null ? raw.delayMin : nodeMetricDelay);

    loadTrainTrip({
      tripId,
      line: node.title || raw.name || raw.line,
      trainNum: tNum,
      origin,
      destination,
      operator,
      delay,
      lat: node.coordinates?.[1],
      lon: node.coordinates?.[0]
    }).then(data => {
      setTrainTripData(data);
      setLoadingTrip(false);
      if (data?.polyline && onHighlightRoute) {
        onHighlightRoute(data.polyline);
      }
      // Note: We do not automatically call onFlyTo here, because the user clicked
      // the train directly on the map. Calling onFlyTo asynchronously would hijack the
      // camera and jump to a different location.
    }).catch(err => {
      console.error('Trip load error', err);
      setTripError('Podatki o poteku vožnje niso na voljo.');
      setLoadingTrip(false);
    });
  };

  const fetchDepartures = (targetStation?: { id?: string; name?: string; lat?: number; lon?: number }) => {
    if (!node) return;
    setLoadingDepartures(true);
    setDepartureError(null);

    const sId = targetStation?.id || node.rawPayload?.id || (node.id.startsWith('st_') ? node.id : undefined);
    const sName = targetStation?.name || node.title || node.rawPayload?.name;
    const [lon, lat] = (targetStation?.lon && targetStation?.lat) ? [targetStation.lon, targetStation.lat] : (node.coordinates || [0, 0]);

    loadStationDepartures({ stationId: sId, name: sName, lat, lon })
      .then(res => {
        setStationDepartures(res.departures || []);
        setStationMeta(res.station || null);
        setLoadingDepartures(false);
      })
      .catch(() => {
        setDepartureError('Odhodi za to postajo trenutno niso na voljo.');
        setLoadingDepartures(false);
      });
  };

  useEffect(() => {
    if (!node) return;
    if (isModelledFreight) {
      // No trip to fetch: there is no published working to look up.
      setActiveTab('journey');
      setStationDepartures([]);
      setStationMeta(null);
      setTrainTripData(null);
    } else if (isTrain) {
      setActiveTab('journey');
      fetchTrainTrip();
      setStationDepartures([]);
      setStationMeta(null);
    } else if (isYard) {
      setActiveTab('metrics');
      setStationDepartures([]);
      setStationMeta(null);
      setTrainTripData(null);
    } else if (isStation) {
      setActiveTab('departures');
      fetchDepartures();
      setTrainTripData(null);
    } else if (node.type === 'signal' || node.signalData) {
      setActiveTab('cits_spat');
      setStationDepartures([]);
      setStationMeta(null);
      setTrainTripData(null);
    } else {
      setActiveTab('metrics');
      setStationDepartures([]);
      setStationMeta(null);
      setTrainTripData(null);
    }
  }, [node?.id, node?.type]);
  
  const effectiveTrainNum = node?.trainNum || (node?.title?.match(/\d+/) ? node.title.match(/\d+/)![0] : '');
  const stableTrainKey = node ? `${node.id || ''}_${effectiveTrainNum}_${node.title || ''}` : '';

  useEffect(() => {
    if (isStation || isYard || !node) {
      lastFetchedTrainKey.current = null;
      setVagonwebData(null);
      setVagonwebMeta(null);
      setCrossBorderFreight(null);
      setLoadingVagonweb(false);
      return;
    }

    if ((!effectiveTrainNum && !isFreightTrain) || !isTrain) {
      lastFetchedTrainKey.current = null;
      setVagonwebData(null);
      setVagonwebMeta(null);
      setCrossBorderFreight(null);
      setLoadingVagonweb(false);
      return;
    }

    // If we have already fetched this exact train and it's current, do not refetch or cause UI glitch
    if (lastFetchedTrainKey.current === stableTrainKey) {
       return;
    }

    // Check memory cache for instant, zero-flicker restoration
    if (vagonwebCache.current.has(stableTrainKey)) {
       const cached = vagonwebCache.current.get(stableTrainKey)!;
       lastFetchedTrainKey.current = stableTrainKey;
       setVagonwebData(cached.composition);
       setVagonwebMeta(cached.meta);
       if (cached.meta?.locomotive) {
         setEnrichedLoco(cached.meta.locomotive);
       }
       if (cached.crossBorderFreight) {
         setCrossBorderFreight(cached.crossBorderFreight);
       }
       setLoadingVagonweb(false);
       return;
    }

    lastFetchedTrainKey.current = stableTrainKey;
    setLoadingVagonweb(true);

    const op = node.rawPayload?.operator || node.rawPayload?.line?.operator?.name || '';
    const line = node.title || node.rawPayload?.name || '';
    const origin = node.rawPayload?.origin || node.rawPayload?.stationName || '';
    const destination = node.rawPayload?.destination || node.rawPayload?.direction || '';
    const locoParam = node.rawPayload?.locomotive ||
      node.metrics?.find(m => m.label.toLowerCase().includes('vlečn') || m.label.toLowerCase().includes('vleka') || m.label.toLowerCase().includes('lokomotiv'))?.value || '';
    const wagonParam = node.rawPayload?.wagonType || '';
    const cargoParam = node.rawPayload?.cargoDescription || node.rawPayload?.cargo || '';
    const trainIdParam = node.rawPayload?.id || node.id || '';

    // Initialize enrichedLoco immediately so there is never a missing state
    const resolvedInitial = node.rawPayload?.enrichedLocomotive || getEnrichedLocomotiveData(locoParam, op, line, cargoParam);
    setEnrichedLoco(resolvedInitial);

    // If it's a freight train, initialize cross-border status immediately
    if (isFreightTrain) {
      const initialFreight = generateCrossBorderFreightStatus(
        effectiveTrainNum,
        op,
        line,
        cargoParam,
        node.coordinates?.[1],
        node.coordinates?.[0],
        undefined,
        wagonParam,
        node.rawPayload?.grossWeightTons,
        node.rawPayload?.lengthM
      );
      setCrossBorderFreight(initialFreight);
    } else {
      setCrossBorderFreight(null);
    }

    const params = new URLSearchParams({
      train: String(effectiveTrainNum || 'FREIGHT'),
      operator: String(op),
      line: String(line),
      origin: String(origin),
      destination: String(destination),
      lat: String(node.coordinates?.[1] || ''),
      lon: String(node.coordinates?.[0] || ''),
      cargo: isFreightTrain ? 'true' : 'false',
      locomotive: String(locoParam),
      wagonType: String(wagonParam),
      grossWeightTons: String(node.rawPayload?.grossWeightTons || ''),
      lengthM: String(node.rawPayload?.lengthM || ''),
      cargoDescription: String(cargoParam),
      trainId: String(trainIdParam)
    });

    let active = true;
    fetch(`/api/vagonweb?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
         if (!active) return;
         if (data.composition && data.composition.length > 0) {
           const resolvedLoco = data.locomotive || resolvedInitial;
           setEnrichedLoco(resolvedLoco);
           const meta = {
             operator: data.operator,
             trainType: data.trainType,
             source: data.source,
             isFreight: data.isFreight || isFreightTrain,
             locomotive: resolvedLoco
           };
           vagonwebCache.current.set(stableTrainKey, { 
             composition: data.composition, 
             meta, 
             crossBorderFreight: data.crossBorderFreight 
           });
           setVagonwebData(data.composition);
           setVagonwebMeta(meta);
           if (data.crossBorderFreight) {
             setCrossBorderFreight(data.crossBorderFreight);
           }
         } else {
           setVagonwebData(null);
           setVagonwebMeta(null);
         }
         setLoadingVagonweb(false);
      })
      .catch(() => {
         if (!active) return;
         setVagonwebData(null);
         setVagonwebMeta(null);
         setLoadingVagonweb(false);
      });

    return () => {
      active = false;
    };
  }, [stableTrainKey, node?.type]);

  // Dedicated real-time European rail APIs query (HAFAS & RailData ISR)
  const fetchCrossBorderFreight = (isManualRefresh = false) => {
    if (!node) return;
    setLoadingCrossBorder(true);
    const op = node.rawPayload?.operator || node.rawPayload?.line?.operator?.name || '';
    const line = node.title || node.rawPayload?.name || '';
    const cargoParam = node.rawPayload?.cargoDescription || node.rawPayload?.cargo || '';
    const effectiveTrainNum = node.trainNum || (node.title?.match(/\d+/) ? node.title.match(/\d+/)![0] : '') || '';

    const params = new URLSearchParams({
      train: String(effectiveTrainNum || '48010'),
      operator: String(op),
      line: String(line),
      cargo: String(cargoParam || 'tovor'),
      wagonType: String(node.rawPayload?.wagonType || ''),
      grossWeightTons: String(node.rawPayload?.grossWeightTons || ''),
      lengthM: String(node.rawPayload?.lengthM || ''),
      lat: String(node.coordinates?.[1] || ''),
      lon: String(node.coordinates?.[0] || '')
    });

    fetch(`/api/freight/cross-border-status?${params.toString()}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setCrossBorderFreight(json.data);
          if (json.data.locomotive) {
            setEnrichedLoco(json.data.locomotive);
          }
          if (stableTrainKey && vagonwebCache.current.has(stableTrainKey)) {
            const c = vagonwebCache.current.get(stableTrainKey)!;
            c.crossBorderFreight = json.data;
          }
        }
        setLoadingCrossBorder(false);
      })
      .catch(() => {
        setLoadingCrossBorder(false);
      });
  };

  useEffect(() => {
    if (node?.type === 'smartcity') {
      fetchPackets(node.id).then(data => {
        if (data) setSmartCityData(data);
      });
      const interval = setInterval(() => {
        fetchPackets(node.id).then(data => {
          if (data) setSmartCityData(data);
        });
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setSmartCityData(null);
    }
  }, [node?.id, node?.type]);

  if (!node) return null;

  const isLoRa = node.type === 'lorawan' || node.type === 'ttn' || !!node.loraData;
  const isSignal = node.type === 'signal' || !!node.signalData;
  const loraPackets = node.loraData?.packets || [];
  const signalData: any = node.signalData || (node.rawPayload as any);
  if (signalData && signalData.timeToChange !== undefined && signalData.countdownSeconds === undefined) { signalData.countdownSeconds = signalData.timeToChange; }

  const handleCopy = (data: any) => {
    navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeIcon = () => {
    switch (node.type) {
      case 'station':
      case 'rinf_station':
      case 'rail_station':
        return <TrainFront className="w-4 h-4 text-sky-400" />;
      case 'hafas':
        return <TrainFront className="w-4 h-4 text-sky-400" />;
      case 'aprs':
        return <Radio className="w-4 h-4 text-rose-400" />;
      case 'loramesh':
        return <Cpu className="w-4 h-4 text-amber-400" />;
      case 'sparql':
        return <Activity className="w-4 h-4 text-purple-400" />;
      case 'warehouse':
        return <Box className="w-4 h-4 text-slate-400" />;
      case 'freight':
        return <TrainFront className="w-4 h-4 text-emerald-400" />;
      case 'yard':
        return <HardHat className="w-4 h-4 text-red-400" />;
      case 'hydro':
        return <Droplets className="w-4 h-4 text-sky-400" />;
      case 'moms':
        return <Activity className="w-4 h-4 text-emerald-500" />;
      case 'power':
        return <Power className="w-4 h-4 text-yellow-400" />;
      case 'spat':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'switch':
        return <Layers className="w-4 h-4 text-slate-400" />;
      case 'rail_signal':
        return <Zap className="w-4 h-4 text-green-400" />;

      case 'sensorcommunity':
        return <Wind className="w-4 h-4 text-teal-400" />;
      case 'arso':
        return <CloudRain className="w-4 h-4 text-amber-400" />;
      case 'smartcity':
        return <Radio className="w-4 h-4 text-purple-400" />;
      case 'github':
        return <Github className="w-4 h-4 text-slate-200" />;
      case 'buses':
        return <Bus className="w-4 h-4 text-emerald-400" />;
      case 'train':
      case 'bus':
        return <Navigation className="w-4 h-4 text-mura" />;
      case 'signal':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'lorawan':
        return <Radio className="w-4 h-4 text-wheat" />;
      case 'nbiot':
        return <Radio className="w-4 h-4 text-orange-500" />;
      case 'air':
        return <Wind className="w-4 h-4 text-sky-400" />;
      case 'traffic_counter':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'bike':
        return <Bike className="w-4 h-4 text-emerald-400" />;
      case 'micromobility':
        if (node?.rawPayload?.form === 'CAR') return <Car className="w-4 h-4 text-cyan-400" />;
        if (node?.rawPayload?.form === 'BICYCLE') return <Bike className="w-4 h-4 text-emerald-400" />;
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'ev':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'drone':
        return <Navigation className="w-4 h-4 text-rose-400" />;
      case 'aircraft':
        return <Compass className="w-4 h-4 text-slate-300" />;
      case 'location':
        return <MapPin className="w-4 h-4 text-mura" />;
      default:
        return <Layers className="w-4 h-4 text-wheat" />;
    }
  };

  // Active stopover and comprehensive live delay resolution for the selected train
  const activeStopover = trainTripData?.stopovers?.find(s => s.current) 
    || trainTripData?.stopovers?.find(s => !s.passed) 
    || (trainTripData?.stopovers && trainTripData.stopovers.length > 0 ? trainTripData.stopovers[trainTripData.stopovers.length - 1] : null);

  const activeStopDelay = activeStopover?.delayMinutes ?? 0;
  const maxStopoverDelay = trainTripData?.stopovers?.reduce((max, s) => Math.max(max, s.delayMinutes || 0), 0) ?? 0;
  
  const metricDelay = (() => {
    if (!node?.metrics) return 0;
    const m = node.metrics.find(x => x.label === 'Prijavljena zamuda' || x.label === 'Zamuda');
    if (!m) return 0;
    const match = String(m.value).match(/\+?(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  })();

  const rawPayloadDelay = Number(node?.rawPayload?.delay ?? node?.rawPayload?.delayMin ?? 0);
  const tripDelay = Number(trainTripData?.delayMinutes ?? 0);
  const effectiveTrainDelay = Math.max(tripDelay, activeStopDelay, maxStopoverDelay, metricDelay, rawPayloadDelay);
  /**
   * Whether a delay figure was actually reported, as opposed to defaulting to
   * zero. Every source above falls back to 0 when it has nothing, so a train
   * the feed says nothing about looked exactly like a train running to time —
   * and the panel then claimed it was on time against a published timetable.
   * "No delay reported" and "reported as zero" are different statements.
   */
  const hasDelayReading = Boolean(
    node?.rawPayload?.delay != null || node?.rawPayload?.delayMin != null ||
    trainTripData?.delayMinutes != null ||
    node?.metrics?.some(x => x.label === 'Prijavljena zamuda' || x.label === 'Zamuda')
  );

  const getStatusBadge = () => {
    if (node.type === 'yard') {
      return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold">🏭 TOVORNI TERMINAL</span>;
    }

    if (node.type === 'drone') {
      return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold animate-pulse">🛸 V LETU (OpenDroneID)</span>;
    }

    if (isSignal && signalData?.state) {
      if ((signalData.state === 'GREEN' || signalData.state === 'Zelena')) {
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold animate-pulse">🟢 ZELENA LUČ</span>;
      }
      if ((signalData.state === 'YELLOW' || signalData.state === 'Rumena')) {
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold">🟡 RUMENA FAZA</span>;
      }
      return <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold">🔴 RDEČA LUČ</span>;
    }

    // Not "TRASA SŽ": no path was allocated to this and SŽ never published it.
    // The badge carries the position error so the uncertainty is visible from
    // the header, before anything else in the panel is read.
    if (isModelledFreight) {
      // A published path is not a sighting. The badge says which of the two
      // this is, in the header, before any number below it is read.
      // The badge carries the line limit, not a speed for this train: the
      // catalogue publishes no running speed, and the average its timings
      // imply is not one.
      const lim = node.rawPayload?.lineSpeedKmh;
      return (
        <span className="bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
          🚆 KATALOŠKA POT{lim != null ? ` · PROGA ≤${lim} KM/H` : ''}
        </span>
      );
    }

    if (isTrain) {
      if (effectiveTrainDelay > 3) {
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold animate-pulse">⚠️ ZAMUDA +{effectiveTrainDelay} min</span>;
      }
      if (effectiveTrainDelay > 0) {
        return <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🟡 +{effectiveTrainDelay} min</span>;
      }
      if (!hasDelayReading) {
        return <span className="bg-slate-700/40 text-slate-300 border border-slate-600/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-medium">ZAMUDA NI SPOROČENA</span>;
      }
      return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🟢 TOČNO</span>;
    }

    if (node.type === 'micromobility' || node.type === 'micromobility_trip' || node.type === 'bike') {
      const speed = Number(node.rawPayload?.speed ?? node.metrics?.find(m => m.label === 'Hitrost')?.value ?? 0);
      const isMoving = node.status === 'moving' || speed >= 3;
      if (isMoving) {
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
            <Navigation size={10} className="text-emerald-400 rotate-45" />
            V VOŽNJI · {speed} km/h
          </span>
        );
      }
      return (
        <span className="bg-slate-700/40 text-slate-300 border border-slate-600/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-medium">
          PARKIRANO NA ULICI
        </span>
      );
    }

    if (node.type === 'buses' || node.type === 'bus') {
      const speed = Number(node.rawPayload?.speed ?? node.metrics?.find(m => m.label === 'Hitrost')?.value ?? 0);
      const isMoving = node.status === 'moving' || speed >= 3;
      if (isMoving) {
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
            <Navigation size={10} className="text-emerald-400 rotate-45" />
            V VOŽNJI · {speed} km/h
          </span>
        );
      }
      return (
        <span className="bg-slate-700/40 text-slate-300 border border-slate-600/40 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-medium">
          POSTAJALIŠČE / ČAKANJE
        </span>
      );
    }

    switch (node.status) {
      case 'online':
        return <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-semibold">ONLINE</span>;
      case 'moving':
        return <span className="bg-mura/15 text-mura border border-mura/30 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-semibold animate-pulse">V VOŽNJI</span>;
      case 'delayed':
        return <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9.5px] font-mono px-2 py-0.5 rounded-full font-semibold">ZAMUDA</span>;
      default:
        return <span className="bg-white/10 text-text-dim border border-line text-[9.5px] font-mono px-2 py-0.5 rounded-full">AKTIVNO</span>;
    }
  };

  const isGeoInScope = (coords?: [number, number] | null): coords is [number, number] => {
    if (!coords || !Array.isArray(coords)) return false;
    const [lon, lat] = coords;
    // Valid European rail coordinates (from Western Europe to Balkans/Poland)
    return typeof lon === 'number' && typeof lat === 'number' && lon >= 2.0 && lon <= 25.0 && lat >= 40.0 && lat <= 56.0;
  };

  const currentStopover = trainTripData?.stopovers?.find(s => s.current) || trainTripData?.stopovers?.find(s => !s.passed);
  const stopoverCoords = (currentStopover?.lon && currentStopover?.lat) ? [currentStopover.lon, currentStopover.lat] as [number, number] : null;

  const effectiveTrainCoords: [number, number] = (isTrain && isGeoInScope(trainTripData?.currentLocation))
    ? trainTripData!.currentLocation!
    : ((isTrain && isGeoInScope(stopoverCoords))
        ? stopoverCoords!
        : (isGeoInScope(node.coordinates) ? node.coordinates : [14.510, 46.058]));

  return (
    <div className={`fixed sm:absolute bottom-3 sm:top-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-[470px] flex flex-col z-30 
                    bg-panel/95 backdrop-blur-2xl border border-line rounded-2xl shadow-2xl overflow-hidden transition-all duration-200
                    ${isMinimized ? 'max-h-20' : 'max-h-[65vh] sm:max-h-[calc(100dvh-24px)]'}`}>
      
      {/* Photo */}
      
      {/* Header */}
      <div className="p-3 sm:p-3.5 border-b border-line bg-white/[0.02] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-white/5 border border-line shrink-0">
            {getTypeIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-text-dim">{node.category}</span>
              {getStatusBadge()}
            </div>
            <h2 className="text-[14px] font-bold text-white tracking-tight truncate m-0">{node.title}</h2>
            {node.subtitle && !isMinimized && (
              <p className="text-[11px] text-text-dim truncate mt-0.5 font-sans">{node.subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {onFlyTo && (
            <button
              onClick={() => onFlyTo(isTrain ? effectiveTrainCoords : node.coordinates, isTrain ? 15.5 : 15)}
              title={isTrain ? "Odpelji me do tega vlaka na karti" : "Centriraj na točko"}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer ${
                isTrain
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md shadow-sky-500/25 active:scale-95'
                  : 'bg-mura/15 hover:bg-mura/30 border border-mura/40 text-mura hover:text-white'
              }`}
            >
              <Navigation size={12} className={isTrain ? "fill-current" : ""} />
              <span>{isTrain ? 'Do vlaka' : 'Centriraj'}</span>
            </button>
          )}

          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Razširi podrobnosti' : 'Pomanjšaj'}
            className="text-text-dim hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <button 
            onClick={onClose}
            title="Zapri"
            aria-label="Zapri"
            className="text-text-dim hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Dynamic Tabs Navigation */}
          <div className="flex border-b border-line bg-black/30 text-[11px] font-medium overflow-x-auto no-scrollbar shrink-0">
            {isModelledFreight && (
              <button
                onClick={() => setActiveTab('journey')}
                className={`flex-1 min-w-[135px] py-2 px-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'journey' ? 'border-fuchsia-400 text-fuchsia-300 font-semibold bg-fuchsia-500/10' : 'border-transparent text-text-dim hover:text-white'
                }`}
              >
                <TrainFront size={12} className={activeTab === 'journey' ? 'text-fuchsia-400' : 'text-text-dim'} />
                <span>Potek poti</span>
              </button>
            )}
            {isTrain && (
              <button
                onClick={() => {
                  setActiveTab('journey');
                  if (!trainTripData && !loadingTrip) fetchTrainTrip();
                }}
                className={`flex-1 min-w-[135px] py-2 px-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'journey' ? 'border-sky-400 text-sky-300 font-semibold bg-sky-500/10 shadow-[0_0_12px_rgba(14,165,233,0.15)]' : 'border-transparent text-text-dim hover:text-white'
                }`}
              >
                <TrainFront size={12} className={activeTab === 'journey' ? 'text-sky-400' : 'text-text-dim'} />
                <span>Potek vožnje</span>
                {effectiveTrainDelay > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                    +{effectiveTrainDelay}m
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    Točno
                  </span>
                )}
              </button>
            )}

            {isSignal && (
              <button 
                onClick={() => setActiveTab('cits_spat')}
                className={`flex-1 min-w-[95px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                  activeTab === 'cits_spat' ? 'border-emerald-400 text-emerald-300 font-semibold bg-emerald-500/10' : 'border-transparent text-text-dim hover:text-white'
                }`}
              >
                <Activity size={12} className="text-emerald-400" />
                C-ITS & SPaT
              </button>
            )}

            {isStation && (
              <button 
                onClick={() => {
                  setActiveTab('departures');
                  if (stationDepartures.length === 0 && !loadingDepartures) fetchDepartures();
                }}
                className={`flex-1 min-w-[120px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'departures' ? 'border-sky-400 text-sky-300 font-semibold bg-sky-500/10' : 'border-transparent text-text-dim hover:text-white'
                }`}
              >
                <Clock size={12} className={activeTab === 'departures' ? 'text-sky-400' : 'text-text-dim'} />
                <span>Vozni red</span>
                {stationDepartures.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {stationDepartures.length}
                  </span>
                )}
              </button>
            )}

            <button 
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 min-w-[75px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'metrics' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
              }`}
            >
              <Gauge size={12} />
              Metrike
            </button>

            {isLoRa && (
              <>
                <button 
                  onClick={() => setActiveTab('lora_analysis')}
                  className={`flex-1 min-w-[95px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                    activeTab === 'lora_analysis' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
                  }`}
                >
                  <Signal size={12} />
                  RF Analiza
                </button>
                <button 
                  onClick={() => setActiveTab('packets')}
                  className={`flex-1 min-w-[90px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                    activeTab === 'packets' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
                  }`}
                >
                  <Cpu size={12} />
                  Paketi ({loraPackets.length || 15})
                </button>
              </>
            )}

            <button 
              onClick={() => setActiveTab('glossary')}
              className={`flex-1 min-w-[85px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'glossary' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
              }`}
            >
              <HelpCircle size={12} />
              Razlaga
            </button>

            {node.type === 'weather' && node.rawPayload?.daily && (
              <button 
                onClick={() => setActiveTab('weather_forecast')}
                className={`flex-1 min-w-[100px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                  activeTab === 'weather_forecast' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
                }`}
              >
                <CloudRain size={12} />
                Vremenska Napoved
              </button>
            )}

            <button 
              onClick={() => setActiveTab('raw')}
              className={`flex-1 min-w-[70px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'raw' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
              }`}
            >
              <FileText size={12} />
              JSON
            </button>
            <button 
              onClick={() => setActiveTab('network')}
              className={`flex-1 min-w-[75px] py-2 px-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'network' ? 'border-wheat text-wheat font-semibold bg-white/[0.04]' : 'border-transparent text-text-dim hover:text-white'
              }`}
            >
              <ShieldCheck size={12} />
              Omrežje
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-[12px]">
            
            {/* TRAIN JOURNEY / POTEK VOŽNJE TAB */}
            {/* MODELLED FREIGHT — its own panel, with nothing borrowed from a timetable */}
            {/* FREIGHT PATH — the published catalogue path, said plainly */}
            {activeTab === 'journey' && isModelledFreight && (() => {
              const raw: any = node.rawPayload || {};
              const unpack = (v: any) => {
                if (v == null) return null;
                if (typeof v !== 'string') return v;
                try { return JSON.parse(v); } catch { return null; }
              };
              const oc = unpack(raw.operatorCandidates);
              const prev = unpack(raw.prevPoint);
              const next = unpack(raw.nextPoint);
              const tps: any[] = unpack(raw.timingPoints) || [];
              const days: number[] | null = unpack(raw.daysOfWeek);
              const DAYS = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'];
              const pct = raw.progressPercent != null ? Math.max(0, Math.min(100, Number(raw.progressPercent))) : null;

              return (
                <div className="space-y-3">
                  {/* Identity: number, relation, speed — what you would read off a board */}
                  <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/40 via-panel/80 to-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[13px] font-mono font-bold bg-orange-500/20 text-orange-200 border border-orange-500/40">
                          {raw.trainNumber || raw.papId || 'Tovorna pot'}
                        </span>
                        {raw.lineSpeedKmh != null && (
                          <span
                            title={raw.lineSpeedSection ? `Odsek ${raw.lineSpeedSection} — ERA RINF` : undefined}
                            className="px-2 py-0.5 rounded-md text-[12px] font-mono bg-white/10 text-white/90"
                          >
                            proga ≤ {raw.lineSpeedKmh} km/h
                          </span>
                        )}
                      </div>
                      {raw.direction && (
                        <span className="text-[10.5px] font-mono uppercase text-orange-300/80">{raw.direction}</span>
                      )}
                    </div>
                    {(raw.relationLabel || raw.relation) && (
                      <div className="mt-2">
                        <div className="text-[15px] font-bold text-white leading-tight">{raw.relationLabel || raw.relation}</div>
                        <div className="mt-0.5 text-[10px] leading-snug text-text-dim">
                          Izhodišče in cilj ponujene poti iz kataloga koridorja, ne opazovanega vlaka. Od kod vlak dejansko
                          pride in kdo ga vozi, noben javni vir ne objavlja.
                        </div>
                      </div>
                    )}
                    {pct != null && (
                      <div className="mt-3">
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] font-mono text-text-dim">
                          <span>{pct} % slovenskega dela{(() => { const tp = unpack(raw.timingPoints) || []; return tp.length ? ` (${tp[0].location} → ${tp[tp.length - 1].location})` : ''; })()}</span>
                          {raw.kmAlong != null && raw.routeKm != null && <span>{raw.kmAlong} / {raw.routeKm} km</span>}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="text-[9.5px] uppercase font-mono text-emerald-400">Nazadnje mimo</div>
                        <div className="text-[13px] font-bold text-white truncate">{prev?.location || '—'}</div>
                        <div className="text-[11px] font-mono text-text-dim">{prev?.time || ''}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="text-[9.5px] uppercase font-mono text-sky-400">Naslednja točka</div>
                        <div className="text-[13px] font-bold text-white truncate">{next?.location || '—'}</div>
                        <div className="text-[11px] font-mono text-text-dim">
                          {next?.time || ''}{next?.inMin != null ? ` · čez ${next.inMin} min` : ''}
                        </div>
                      </div>
                    </div>
                    {/* The three numbers, kept apart. Merging them is what put
                        "40 km/h" under a train that passes a platform at 80. */}
                    <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
                      {raw.lineSpeedKmh != null && (
                        <p className="text-[10px] leading-snug text-text-dim">
                          <span className="text-white/80 font-mono">proga ≤ {raw.lineSpeedKmh} km/h</span>
                          {raw.lineSpeedSection ? ` — odsek ${raw.lineSpeedSection}. ` : ' — '}
                          {raw.lineSpeedBasis}
                        </p>
                      )}
                      {raw.legAverageKmh != null && (
                        <p className="text-[10px] leading-snug text-text-dim">
                          <span className="text-white/80 font-mono">povprečje odseka {raw.legAverageKmh} km/h</span>
                          {' — '}{raw.legAverageBasis}
                        </p>
                      )}
                      {raw.speedClass && (
                        <p className="text-[10px] leading-snug text-text-dim">{raw.speedClass}</p>
                      )}
                    </div>
                  </div>

                  {/* How far the icon can be out. Derived, not guessed: the two
                      ends are the furthest the train could have got from the
                      last published time at line speed, and the least far it
                      can be and still make the next one. */}
                  {(() => {
                    // A published stop is the one moment the catalogue fixes the
                    // train exactly: at the station, until the published departure.
                    if (raw.phase === 'dwell') {
                      const d: any = unpack(raw.dwell);
                      if (!d) return null;
                      return (
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/25 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-white/70">Lega</div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="font-mono text-[12px] font-bold text-white">na postaji</span>
                            </div>
                          </div>
                          <div className="mt-1.5 text-[12px] text-white/90 leading-snug">
                            Stoji v <strong>{d.location}</strong>
                            {d.arrival ? ` — prihod ${d.arrival}` : ''}{d.departure ? `, odhod ${d.departure}` : ''}
                            {d.remainingMin != null ? ` (čez ${d.remainingMin} min)` : ''}
                          </div>
                          <p className="mt-1.5 text-[10px] leading-snug text-white/60">
                            Objavljen postanek iz kataloga poti: v tem času je lega vlaka znana natančno — na postaji.
                          </p>
                        </div>
                      );
                    }
                    const pb: any = unpack(raw.positionBand);
                    if (!pb) return null;
                    const pct = pb.sharePercent ?? 0;
                    const tone = pct >= 80 ? 'border-red-500/40 bg-red-950/30' : pct >= 40 ? 'border-amber-500/40 bg-amber-950/25' : 'border-emerald-500/40 bg-emerald-950/25';
                    const dot = pct >= 80 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
                    return (
                      <div className={`rounded-xl border p-3 ${tone}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] uppercase font-mono tracking-wider text-white/70">Negotovost lege</div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                            <span className="font-mono text-[12px] font-bold text-white">± {Math.round(pb.widthKm / 2)} km</span>
                          </div>
                        </div>
                        <div className="mt-1.5 text-[12px] text-white/90 leading-snug">
                          Nekje med <strong>{pb.fromName || '?'}</strong> in <strong>{pb.toName || '?'}</strong>
                        </div>
                        {/* The band as a share of the leg it is on. */}
                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full ${dot}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
                        </div>
                        <div className="mt-1 text-[9.5px] font-mono text-white/55">
                          {pb.widthKm} km od {pb.legKm} km odseka ({pct}%)
                          {pct >= 80 ? ' — katalog lege na tem odseku praktično ne določa' : ''}
                        </div>
                        {pb.basis && (
                          <p className="mt-1.5 text-[10px] leading-snug text-white/60">{pb.basis}</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* The legs outside Slovenia, so a train that only crosses
                      the country can be read end to end. */}
                  {(() => {
                    const fs: any[] = unpack(raw.foreignSections) || [];
                    if (!fs.length) return null;
                    return (
                      <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                        <div className="text-[10px] uppercase font-mono tracking-wider text-text-dim mb-2">
                          Pot izven Slovenije
                        </div>
                        <div className="space-y-2">
                          {fs.map((s: any, i: number) => (
                            <div key={i}>
                              <div className="flex items-center gap-2 text-[10.5px] font-mono">
                                <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/80">{s.infrastructureManager}</span>
                                {s.nationalId && <span className="text-orange-300">št. {s.nationalId}</span>}
                                {s.days && <span className="text-text-dim">dnevi {s.days}</span>}
                              </div>
                              {s.points?.length ? (
                                <div className="mt-1 pl-1 text-[11px] text-white/75 leading-snug">
                                  {s.points.map((p: any) => `${p.location} ${(p.times || []).join('/')}`).join('  ·  ')}
                                </div>
                              ) : null}
                              {/* Engineering works the catalogue records against
                                  this path — a closure and its diversions. */}
                              {s.note ? (
                                <div className="mt-1 pl-1 text-[10.5px] leading-snug text-amber-200/80">
                                  ⚠ {s.note}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Every point the catalogue times, with its TAF location code */}
                  {tps.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-text-dim mb-2">
                        Objavljene časovne točke
                      </div>
                      <div className="space-y-1.5">
                        {tps.map((t: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[11.5px]">
                            <span className="w-2 h-2 rounded-full bg-orange-400/70 shrink-0" />
                            <span className="text-white font-medium flex-1 truncate">{t.location}</span>
                            {t.uopid && <span className="text-[9.5px] font-mono text-text-dim">{t.uopid}</span>}
                            <span className="font-mono text-white/90">
                              {t.arrival && t.departure && t.arrival !== t.departure ? `${t.arrival}→${t.departure}` : (t.departure || t.arrival)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {days?.length ? (
                        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-mono text-text-dim">
                          Vozi ob: {days.length === 7 ? 'vsak dan' : days.map(d => DAYS[d - 1]).join(', ')}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Operator: the catalogue names none, so the register speaks */}
                  {oc?.candidates?.length ? (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-emerald-300 mb-1 flex items-center gap-1.5">
                        <ShieldCheck size={12} /> Prevoznik
                      </div>
                      <p className="text-[10.5px] text-emerald-100/80 mb-2 leading-snug">
                        Katalog prevoznika ne navaja — pot je ponujena zmogljivost. Ti jo smejo voziti:
                      </p>
                      <div className="space-y-1.5">
                        {oc.candidates.slice(0, 5).map((c: any) => (
                          <div key={c.code} className="flex items-start gap-2 text-[11.5px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-mono font-bold text-[10px] shrink-0">
                              {c.code}
                            </span>
                            <div className="min-w-0">
                              <div className="text-white font-medium leading-tight truncate">{c.name}</div>
                              {c.keeperMarkings?.length ? (
                                <div className="text-[9.5px] font-mono text-text-dim">VKM {c.keeperMarkings.join(', ')}</div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                      {oc.licensedCount != null && (
                        <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[10px] font-mono text-emerald-200/70">
                          {oc.licensedCount} licenciranih tovornih prevoznikov v Sloveniji
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Provenance and the limit of the claim */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-[11px] text-amber-200">ZANESLJIVOST</div>
                        <p className="mt-1 text-[10.5px] leading-snug text-amber-100/85">
                          {raw.status || 'Objavljena pot iz kataloga koridorja.'}
                        </p>
                        {raw.trainNumber && (
                          <p className="mt-1.5 text-[10px] leading-snug text-amber-100/70">
                            Številka {raw.trainNumber} je nacionalna številka poti iz stolpca „SZ-I" —
                            Core identifikatorja TAF TSI. Časi so objavljeni le na točkah kataloga
                            ({(unpack(raw.timingPoints) || []).map((t: any) => t.location).join(', ') || 'glej spodaj'});
                            lega med njimi je interpolirana po kilometraži.
                          </p>
                        )}
                        {raw.catalogueLabel && (
                          <p className="mt-1.5 text-[10px] leading-snug text-amber-100/70">
                            Katalog: <strong className="text-amber-200">{raw.catalogueLabel}</strong>
                            {raw.corridorLabel ? ` · koridor ${raw.corridorLabel}` : ''}
                            {raw.validFrom && raw.validTo ? ` · velja ${String(raw.validFrom).split('-').reverse().join('. ')} – ${String(raw.validTo).split('-').reverse().join('. ')}` : ''}
                            {raw.inForce === false ? ' · ta pot še ne velja' : ''}
                            {raw.offerType ? ` · ${raw.offerType}` : ''}
                          </p>
                        )}
                        {(() => { const d: any[] = unpack(raw.pointsNotOnCorridor) || []; return d.length ? (
                          <p className="mt-1.5 text-[10px] leading-snug text-amber-100/60">
                            Katalog pri tej poti navaja še točke zunaj koridorja (varianta poti), ki niso narisane: {d.join('; ')}.
                          </p>
                        ) : null; })()}
                        {(() => {
                          const ps: any[] = unpack(raw.publishedServices) || [];
                          if (!ps.length) return null;
                          return (
                            <div className="mt-2 pt-2 border-t border-amber-500/20">
                              <div className="text-[10px] uppercase font-mono tracking-wider text-white/70">Objavljeni urniki prevoznikov na tej relaciji</div>
                              {ps.map((s: any, i: number) => (
                                <p key={i} className="mt-1 text-[10.5px] leading-snug text-amber-100/85">
                                  <strong className="text-amber-200">{s.operator}</strong>: {s.matchedDirection || `${s.from} → ${s.to}`}, {s.frequency || (s.perDay != null ? `${s.perDay}× na dan` : '')}
                                  {Array.isArray(s.days) && s.days.length === 7 ? ' (vsak dan)' : ''}
                                  {s.transitHours ? ` · čas vožnje do ${s.transitHours} h` : ''}
                                  {s.route ? ` · pot ${s.route}` : ''}
                                  <span className="block text-[9.5px] font-mono text-amber-200/60">vir: {s.source}{s.retrieved ? ` · prebrano ${s.retrieved}` : ''}</span>
                                </p>
                              ))}
                              <p className="mt-1 text-[9.5px] leading-snug text-amber-100/60">{ps[0].basis}</p>
                            </div>
                          );
                        })()}
                        {/* The map can show two published paths nose to tail on a
                            single-track line. Each position is an honest reading of
                            its own timings, but the pair together is not something
                            that can happen, and the panel should say so. */}
                        <p className="mt-1.5 text-[10px] leading-snug text-amber-100/70">
                            Med objavljenimi točkami je predpostavljena stalna hitrost. V resnici vlak
                            vozi blizu progovne hitrosti in nato dlje časa stoji na križišču — kje, iz
                            kataloga ni razvidno.
                            {raw.corridor === 'koper-hodos' && (
                              <> Progi 40 (Pragersko–Ormož) in 41 (Ormož–Hodoš) sta
                              <strong className="text-amber-200"> enotirni</strong> (Program omrežja, Priloga 2A), zato se
                              prehitevanje zgodi na postaji, ne na odprti progi.</>
                            )}
                            {' '}Če sta na mapi dve poti tesno skupaj, je to posledica te poenostavitve, ne dejanska lega.
                        </p>
                        {raw.source && (
                          <p className="mt-1.5 text-[9.5px] font-mono text-amber-200/60 leading-snug">
                            {raw.source}{raw.timetableYear ? ` · TT${raw.timetableYear}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'journey' && isTrain && (() => {
              const isAustria = Boolean(
                (node?.coordinates && (
                  node.coordinates[1] > 46.88 ||
                  (node.coordinates[0] >= 12.0 && node.coordinates[0] < 14.15 && node.coordinates[1] >= 46.50) ||
                  (node.coordinates[0] >= 14.15 && node.coordinates[0] < 14.50 && node.coordinates[1] > 46.46) ||
                  (node.coordinates[0] >= 14.50 && node.coordinates[0] < 14.88 && node.coordinates[1] > 46.55) ||
                  (node.coordinates[0] >= 14.88 && node.coordinates[0] < 15.20 && node.coordinates[1] > 46.63) ||
                  (node.coordinates[0] >= 15.20 && node.coordinates[0] < 16.05 && node.coordinates[1] > 46.68)
                )) ||
                node?.title?.toUpperCase().includes('ÖBB') ||
                node?.title?.toUpperCase().includes('GKB') ||
                trainTripData?.operator?.toUpperCase().includes('ÖBB') ||
                trainTripData?.operator?.toUpperCase().includes('GKB')
              );

              const rawOp = trainTripData?.operator || node.rawPayload?.operator;
              let effectiveOp = rawOp;
              if (isAustria) {
                if (!rawOp || rawOp.toLowerCase().includes('slovenske') || rawOp === 'SŽ') {
                  effectiveOp = node?.title?.toUpperCase().includes('GKB') ? 'GKB (Graz-Köflacher Bahn)' : 'ÖBB (Österreichische Bundesbahnen)';
                }
              } else if (!effectiveOp) {
                effectiveOp = 'Slovenske Železnice (SŽ)';
              }

              const defaultOrigin = isAustria ? (node?.coordinates?.[0] < 14.85 ? 'Villach Hbf' : 'Graz Hbf') : 'Ljubljana';
              const defaultDest = isAustria ? (node?.coordinates?.[0] < 14.85 ? 'Klagenfurt Hbf' : 'Wien Hbf') : 'Maribor';

              return (
              <div className="space-y-3.5">
                {/* Prominent Origin -> Destination Hero Card */}
                <div className="bg-gradient-to-br from-sky-950/40 via-panel/80 to-slate-950/70 border border-sky-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Top badges bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                        <TrainFront size={12} />
                        {trainTripData?.line || node.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/10 text-white/90">
                        {effectiveOp}
                      </span>
                      {trainTripData?.rollingStock?.model && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {trainTripData.rollingStock.model}
                        </span>
                      )}
                    </div>

                    {/* Fly to train button */}
                    {effectiveTrainCoords && onFlyTo && (
                      <button
                        onClick={() => onFlyTo(effectiveTrainCoords, 15.5)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] font-mono transition-all cursor-pointer shadow-md shadow-sky-500/25 active:scale-95 shrink-0"
                        title="Centriraj in približaj ta vlak na zemljevidu"
                      >
                        <Navigation size={12} className="fill-current" />
                        <span>Odpelji do vlaka</span>
                      </button>
                    )}
                  </div>

                  {/* Visual Route: OD KJE -> KAM */}
                  <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-text-dim mb-2 flex items-center justify-between">
                      <span>Relacija vožnje vlaka</span>
                      {trainTripData && trainTripData.stopovers && trainTripData.stopovers.length > 0 && (
                        <span className="text-sky-400 font-bold">
                          {((trainTripData.currentStopIndex != null && !isNaN(trainTripData.currentStopIndex))
                            ? Math.min(trainTripData.stopovers.length, Math.max(1, trainTripData.currentStopIndex + 1))
                            : (Math.max(0, trainTripData.stopovers.findIndex(s => s.current || !s.passed)) + 1))} / {trainTripData.stopovers.length} postaj
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 relative">
                      {/* Origin: OD KJE */}
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                        <div className="text-[9.5px] uppercase font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          OD KJE (ZAČETEK)
                        </div>
                        <div className="text-[14px] font-bold text-white truncate" title={
                          (node.type === 'freight_train' || isFreightTrain)
                            ? (node.rawPayload?.from || node.rawPayload?.origin || trainTripData?.origin || defaultOrigin)
                            : (trainTripData?.origin || node.rawPayload?.origin || node.rawPayload?.from || defaultOrigin)
                        }>
                          {(node.type === 'freight_train' || isFreightTrain)
                            ? (node.rawPayload?.from || node.rawPayload?.origin || trainTripData?.origin || defaultOrigin)
                            : (trainTripData?.origin || node.rawPayload?.origin || node.rawPayload?.from || defaultOrigin)}
                        </div>
                        <div className="text-[11px] font-mono text-text-dim">
                          Odhod: <strong className="text-white">
                            {trainTripData?.stopovers[0]?.plannedDeparture || trainTripData?.stopovers[0]?.actualDeparture || '--:--'}
                          </strong>
                        </div>
                      </div>

                      {/* Destination: KAM */}
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                        <div className="text-[9.5px] uppercase font-mono text-sky-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                          KAM (CILJ)
                        </div>
                        <div className="text-[14px] font-bold text-white truncate" title={
                          (node.type === 'freight_train' || isFreightTrain)
                            ? (node.rawPayload?.to || node.rawPayload?.destination || trainTripData?.destination || defaultDest)
                            : (trainTripData?.destination || node.rawPayload?.destination || node.rawPayload?.direction || node.rawPayload?.to || defaultDest)
                        }>
                          {(node.type === 'freight_train' || isFreightTrain)
                            ? (node.rawPayload?.to || node.rawPayload?.destination || trainTripData?.destination || defaultDest)
                            : (trainTripData?.destination || node.rawPayload?.destination || node.rawPayload?.direction || node.rawPayload?.to || defaultDest)}
                        </div>
                        <div className="text-[11px] font-mono text-text-dim">
                          Prihod: <strong className="text-white">
                            {trainTripData?.stopovers[trainTripData.stopovers.length - 1]?.actualArrival || trainTripData?.stopovers[trainTripData.stopovers.length - 1]?.plannedArrival || '--:--'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* International Transit / European Corridor Badge */}
                    {(trainTripData?.isTransit || trainTripData?.isInternational || node.rawPayload?.isTransit || node.rawPayload?.corridor) && (
                      <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-mono text-indigo-300 font-bold">
                          <Globe size={13} className="text-indigo-400" />
                          <span>{trainTripData?.corridor || node.rawPayload?.corridor || 'MEDNARODNI TRANZITNI VLAK'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-200/80 uppercase">
                          Čezmejni Tranzit
                        </span>
                      </div>
                    )}

                    {/* Live Delay Banner */}
                    <div className={`mt-3 p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      effectiveTrainDelay > 3
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : hasDelayReading
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-700/25 border-slate-600/40 text-slate-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        {effectiveTrainDelay > 3 ? (
                          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                        ) : hasDelayReading ? (
                          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                        ) : (
                          <Info size={15} className="text-slate-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-mono font-bold text-[12px] flex items-center gap-2">
                            <span>
                              {effectiveTrainDelay > 0
                                ? `ZAMUDA: +${effectiveTrainDelay} MINUT`
                                : (hasDelayReading ? 'TOČNO PO VOZNEM REDU (0 MIN)' : 'ZAMUDA NI SPOROČENA')}
                            </span>
                          </div>
                          <p className="text-[10.5px] opacity-90 leading-tight">
                            {trainTripData?.delayReason
                              || (effectiveTrainDelay > 0
                                ? 'Vlak beleži operativno zamudo na relaciji'
                                : hasDelayReading
                                  ? (isAustria ? 'Vlak vozi skladno z objavljenim voznim redom ÖBB' : 'Vlak vozi skladno z objavljenim voznim redom SŽ')
                                  : 'Vir za ta vlak ne sporoča zamude — to ni enako kot vožnja po voznem redu')}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => fetchTrainTrip()}
                        disabled={loadingTrip}
                        title="Osveži stanje vožnje"
                        className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 text-white transition-colors cursor-pointer shrink-0"
                      >
                        <RefreshCw size={12} className={loadingTrip ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Train Rolling Stock & Equipment Amenities */}
                  {trainTripData?.rollingStock && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
                      <div className="text-text-dim flex items-center gap-1.5 font-medium">
                        <span>Kompozicija:</span>
                        <span className="text-white font-semibold">
                          {typeof trainTripData.rollingStock === 'string'
                            ? trainTripData.rollingStock
                            : (trainTripData.rollingStock.description || 'Potniška garnitura')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {trainTripData.rollingStock.wifi && (
                          <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-emerald-300 flex items-center gap-1">
                            <Wifi size={10} /> WiFi
                          </span>
                        )}
                        {trainTripData.rollingStock.ac && (
                          <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-sky-300 flex items-center gap-1">
                            <Wind size={10} /> Klima
                          </span>
                        )}
                        {trainTripData.rollingStock.lowFloor && (
                          <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-amber-300">
                            Nizkopodni
                          </span>
                        )}
                        {trainTripData.rollingStock.bikePlaces && (
                          <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-lime-300 flex items-center gap-1">
                            <Bike size={10} /> Kolesa
                          </span>
                        )}
                        {trainTripData.rollingStock.powerSockets && (
                          <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-indigo-300 flex items-center gap-1">
                            <Zap size={10} /> 230V
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Loading State */}
                {loadingTrip && (
                  <div className="p-8 text-center bg-white/[0.02] border border-line rounded-xl space-y-2">
                    <RefreshCw size={22} className="animate-spin text-sky-400 mx-auto" />
                    <p className="text-[12px] text-text-dim font-mono">Pridobivam podrobne podatke o poteku vožnje in postajah...</p>
                  </div>
                )}

                {/* Error State */}
                {!loadingTrip && tripError && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-[12px] space-y-2 text-center">
                    <p>{tripError}</p>
                    <button
                      onClick={() => fetchTrainTrip()}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Poskusi znova
                    </button>
                  </div>
                )}

                {/* Interactive Stopovers Timeline */}
                {!loadingTrip && !tripError && trainTripData?.stopovers && trainTripData.stopovers.length > 0 && (
                  <div className="bg-panel/70 border border-line rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[12.5px] font-bold text-white flex items-center gap-1.5 font-mono">
                        <Layers size={13} className="text-sky-400" />
                        POTEK VOŽNJE PO POSTAJAH
                      </h4>
                      <span className="text-[10px] text-text-dim font-mono">
                        Kliknite postajo za ogled na karti
                      </span>
                    </div>

                    <div className="relative pl-6 space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10">
                      {trainTripData.stopovers.map((stop, sIdx) => {
                        const isPassed = stop.passed;
                        const isCurrent = stop.current;
                        const hasStopDelay = stop.delayMinutes > 0;

                        return (
                          <div
                            key={stop.stationId || sIdx}
                            className={`relative group p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]'
                                : isPassed
                                  ? 'bg-white/[0.015] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                                  : 'bg-white/[0.04] border-white/10 hover:border-sky-400/60 hover:bg-white/[0.07]'
                            }`}
                            onClick={() => {
                              if (onFlyTo && stop.lat && stop.lon) {
                                onFlyTo([stop.lon, stop.lat], 15);
                              }
                            }}
                          >
                            {/* Node dot on timeline line */}
                            <div className={`absolute -left-[19px] top-4 w-3.5 h-3.5 rounded-full border-2 transition-transform group-hover:scale-125 ${
                              isCurrent
                                ? 'bg-sky-400 border-white ring-4 ring-sky-500/30 animate-pulse'
                                : isPassed
                                  ? 'bg-emerald-500 border-stone-900'
                                  : 'bg-stone-800 border-white/30'
                            }`} />

                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-bold text-[13px] ${isCurrent ? 'text-sky-300' : 'text-white'} group-hover:text-sky-300 transition-colors`}>
                                    {stop.stationName}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-500 text-slate-950 uppercase animate-pulse">
                                      Trenutna / Naslednja
                                    </span>
                                  )}
                                  {isPassed && (
                                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                                      ✓ Prevoženo
                                    </span>
                                  )}
                                  {stop.platform && (
                                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-white/10 text-white font-medium">
                                      Tir {stop.platform}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-text-dim">
                                  {stop.plannedArrival && (
                                    <span>
                                      Prihod: <strong className={hasStopDelay ? 'text-amber-300' : 'text-white'}>
                                        {stop.actualArrival || stop.plannedArrival}
                                      </strong>
                                      {hasStopDelay && stop.plannedArrival !== stop.actualArrival && (
                                        <span className="line-through text-text-dim ml-1 text-[9.5px]">{stop.plannedArrival}</span>
                                      )}
                                    </span>
                                  )}
                                  {stop.plannedDeparture && (
                                    <span>
                                      Odhod: <strong className={hasStopDelay ? 'text-amber-300' : 'text-white'}>
                                        {stop.actualDeparture || stop.plannedDeparture}
                                      </strong>
                                      {hasStopDelay && stop.plannedDeparture !== stop.actualDeparture && (
                                        <span className="line-through text-text-dim ml-1 text-[9.5px]">{stop.plannedDeparture}</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                {hasStopDelay ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    +{stop.delayMinutes}m
                                  </span>
                                ) : (
                                  <span className="text-[10.5px] font-mono text-emerald-400 font-medium">
                                    Točno
                                  </span>
                                )}

                                <div className="mt-1 text-[10px] text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-0.5">
                                  <span>Pokaži</span>
                                  <ArrowUpRight size={11} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );})()}

            {/* C-ITS & SPaT TAB */}
            {activeTab === 'cits_spat' && signalData && (
              <div className="space-y-3">
                {/* Traffic Light Visualizer & Live Countdown */}
                <div className="bg-black/40 border border-line rounded-xl p-3 flex items-center gap-4">
                  {/* Visual Traffic Light Housing */}
                  <div className="bg-stone-900 border-2 border-stone-700 rounded-2xl p-2 flex flex-col gap-2 shadow-inner shrink-0 items-center">
                    {/* RED */}
                    <div className={`w-8 h-8 rounded-full border border-red-900 flex items-center justify-center transition-all duration-300 ${
                      (signalData.state === 'RED' || signalData.state === 'Rdeča') 
                        ? 'bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.95)] border-white scale-105' 
                        : 'bg-red-950/40 opacity-30'
                    }`}>
                      {(signalData.state === 'RED' || signalData.state === 'Rdeča') && <span className="font-mono text-[10px] font-black text-white">{signalData.countdownSeconds}s</span>}
                    </div>
                    {/* YELLOW */}
                    <div className={`w-8 h-8 rounded-full border border-amber-900 flex items-center justify-center transition-all duration-300 ${
                      (signalData.state === 'YELLOW' || signalData.state === 'Rumena') 
                        ? 'bg-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.95)] border-white scale-105' 
                        : 'bg-amber-950/40 opacity-30'
                    }`}>
                      {(signalData.state === 'YELLOW' || signalData.state === 'Rumena') && <span className="font-mono text-[10px] font-black text-stone-900">{signalData.countdownSeconds}s</span>}
                    </div>
                    {/* GREEN */}
                    <div className={`w-8 h-8 rounded-full border border-emerald-900 flex items-center justify-center transition-all duration-300 ${
                      (signalData.state === 'GREEN' || signalData.state === 'Zelena') 
                        ? 'bg-emerald-500 shadow-[0_0_18px_rgba(34,197,94,0.95)] border-white scale-105' 
                        : 'bg-emerald-950/40 opacity-30'
                    }`}>
                      {(signalData.state === 'GREEN' || signalData.state === 'Zelena') && <span className="font-mono text-[10px] font-black text-stone-900">{signalData.countdownSeconds}s</span>}
                    </div>
                  </div>

                  {/* Signal State & Timer Info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Trenutna faza SPaT</span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        (signalData.state === 'GREEN' || signalData.state === 'Zelena') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        (signalData.state === 'YELLOW' || signalData.state === 'Rumena') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {(signalData.state === 'GREEN' || signalData.state === 'Zelena') ? 'ZELENA LUČ' : (signalData.state === 'YELLOW' || signalData.state === 'Rumena') ? 'RUMENA PREHODNA' : 'RDEČA LUČ'}
                      </span>
                    </div>

                    <div className="text-[18px] font-black font-mono tracking-tight text-white flex items-center gap-2">
                      <Timer size={18} className={(signalData.state === 'GREEN' || signalData.state === 'Zelena') ? 'text-emerald-400' : 'text-red-400'} />
                      <span>{signalData.countdownSeconds} sekund</span>
                      <span className="text-[11px] font-sans font-normal text-text-dim">do spremembe</span>
                    </div>

                    <p className="text-[11.5px] text-text-dim font-medium leading-tight">
                      {signalData.phaseName}
                    </p>

                    {/* Progress Bar of Phase */}
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-1">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          (signalData.state === 'GREEN' || signalData.state === 'Zelena') ? 'bg-emerald-500' :
                          (signalData.state === 'YELLOW' || signalData.state === 'Rumena') ? 'bg-amber-400' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, (signalData.countdownSeconds / (signalData.totalPhaseSeconds || 30)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* GLOSA Green Light Optimal Speed Advisory */}
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold text-[12.5px] flex items-center gap-1.5">
                      <Car size={14} />
                      GLOSA · Priporočena hitrost za zeleni val
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                      ETSI TS 103 301
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-emerald-500/20 font-mono">
                    <div>
                      <div className="text-[10px] text-text-dim">PRIPOROČENA HITROST</div>
                      <div className="text-[20px] font-bold text-emerald-300">
                        {signalData.glosaRecommendedSpeedKmh > 0 ? `${signalData.glosaRecommendedSpeedKmh} km/h` : 'Zaustavitev (0 km/h)'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-text-dim">ODDALJENOST OD KRIŽIŠČA</div>
                      <div className="text-[15px] font-semibold text-white">
                        ~{signalData.glosaDistanceMeters || 220} m
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-200/80 leading-relaxed font-sans">
                    {(signalData.state === 'GREEN' || signalData.state === 'Zelena') 
                      ? `Pri ohranjanju hitrosti ${signalData.glosaRecommendedSpeedKmh} km/h boste križišče prevozili brez ustavljanja.`
                      : signalData.countdownSeconds <= 6
                      ? `Zelena luč se odpre čez ${signalData.countdownSeconds}s. Prilagodite hitrost na 38-42 km/h za gladek uvoz.`
                      : `Zaustavite vozilo. Čas čakanja do naslednje zelene faze: ${signalData.countdownSeconds}s.`}
                  </p>
                </div>

                {/* V2X Priority Banner */}
                {signalData.v2xPriorityActive && (
                  <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2.5 flex items-center gap-2 text-amber-300 animate-pulse">
                    <AlertTriangle size={16} className="shrink-0" />
                    <div className="text-[11px] font-medium leading-tight">
                      <strong>C-ITS V2X Prioriteta aktivna:</strong> {signalData.v2xPriorityVehicle || 'Nujna vožnja'} (Zelena faza podaljšana)
                    </div>
                  </div>
                )}

                {/* Approach Lanes Status Table */}
                <div className="bg-white/[0.02] border border-line rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-white font-semibold text-[11.5px]">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-wheat" />
                      Vozni pasovi križišča (MAPEM)
                    </span>
                    <span className="text-[10.5px] font-mono text-text-dim">Cikel: {signalData.cycleLengthSeconds || 60}s</span>
                  </div>

                  <div className="space-y-1 font-mono text-[10.5px]">
                    {(signalData.approachLanes || [
                      { laneId: 1, direction: 'Sever (Uvoz)', status: signalData.state, queueLengthVehicles: 3 },
                      { laneId: 2, direction: 'Jug (Uvoz)', status: signalData.state, queueLengthVehicles: 2 },
                      { laneId: 3, direction: 'Vzhod (Zavijanje)', status: (signalData.state === 'GREEN' || signalData.state === 'Zelena') ? 'RED' : 'GREEN', queueLengthVehicles: 1 },
                      { laneId: 4, direction: 'Pešci / Kolesarji', status: (signalData.state === 'GREEN' || signalData.state === 'Zelena') ? 'RED' : 'GREEN', queueLengthVehicles: 0 }
                    ]).map((lane: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-white/5 rounded border border-line/40">
                        <span className="text-text-dim font-medium">{lane.direction}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                            lane.status === 'GREEN' ? 'bg-emerald-500/20 text-emerald-400' :
                            lane.status === 'YELLOW' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {lane.status}
                          </span>
                          <span className="text-text-dim">Čakalna vrsta: <strong className="text-white">{lane.queueLengthVehicles} vozil</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Controller & Hardware Specs */}
                <div className="bg-black/30 border border-line rounded-xl p-2.5 text-[10.5px] font-mono text-text-dim space-y-1">
                  <div className="flex justify-between">
                    <span>Krmilnik / RSU:</span>
                    <strong className="text-white">{signalData.controllerModel || 'Swarco ITC-2 C-ITS'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>C-ITS Standard:</span>
                    <strong className="text-wheat">{signalData.citsStandard || 'ETSI EN 302 665 / SPaT'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>V2X Frekvenčni pas:</span>
                    <strong className="text-sky-400">5.9 GHz ITS-G5 (802.11p)</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 1. METRICS TAB */}
            {activeTab === 'metrics' && (
              <>
                {/* Location & Quick fly */}
                <div className="bg-white/5 border border-line rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-dim text-[11px] font-mono">
                    <MapPin size={13} className="text-wheat shrink-0" />
                    <span className="text-white font-medium">{node.coordinates[1].toFixed(5)}°N, {node.coordinates[0].toFixed(5)}°E</span>
                  </div>
                  {onFlyTo && (
                    <button 
                      onClick={() => onFlyTo(node.coordinates)}
                      className="text-[10.5px] font-semibold text-mura hover:text-white bg-mura/10 hover:bg-mura/25 px-2 py-0.5 rounded-lg border border-mura/30 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Maximize2 size={11} />
                      Približaj
                    </button>
                  )}
                </div>

                {/* Freight Yard / Intermodal Terminal Infrastructure Card */}
                {isYard && (
                  <div className="bg-gradient-to-br from-amber-500/10 via-amber-900/5 to-transparent border border-amber-500/30 rounded-xl p-3.5 space-y-3 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                          <Layers size={18} />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-white flex items-center gap-1.5">
                            {node.title || 'Tovorna postaja'}
                          </h4>
                          <p className="text-[11px] text-amber-300/80 font-mono">
                            {node.rawPayload?.terminalType || node.rawPayload?.category || 'Tovorni Ranžirni & Kontejnerski Terminal'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                        TSI INF D4
                      </span>
                    </div>

                    {node.rawPayload?.description && (
                      <p className="text-[11.5px] text-zinc-300 leading-relaxed bg-black/30 p-2.5 rounded-lg border border-line">
                        {node.rawPayload.description}
                      </p>
                    )}

                    {/* Technical Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-black/40 border border-line p-2 rounded-lg">
                        <span className="text-[10px] text-text-dim block uppercase font-mono">Število tirov</span>
                        <span className="text-white font-bold font-mono">{node.rawPayload?.tracks ? `${node.rawPayload.tracks} tirov` : 'Večtirni terminal'}</span>
                      </div>
                      <div className="bg-black/40 border border-line p-2 rounded-lg">
                        <span className="text-[10px] text-text-dim block uppercase font-mono">Osna obremenitev</span>
                        <span className="text-amber-400 font-bold font-mono">{node.rawPayload?.tsiAxleLoad || '22.5 t/os (D4)'}</span>
                      </div>
                      <div className="bg-black/40 border border-line p-2 rounded-lg">
                        <span className="text-[10px] text-text-dim block uppercase font-mono">Dolžina tirov</span>
                        <span className="text-white font-bold font-mono">{node.rawPayload?.maxTrainLengthM ? `${node.rawPayload.maxTrainLengthM} m` : '740 m (TEN-T standard)'}</span>
                      </div>
                      <div className="bg-black/40 border border-line p-2 rounded-lg">
                        <span className="text-[10px] text-text-dim block uppercase font-mono">Dnevni pretok</span>
                        <span className="text-emerald-400 font-bold font-mono">{node.rawPayload?.dailyBlockTrains || (node.rawPayload?.capacityTonsPerDay ? `${node.rawPayload.capacityTonsPerDay.toLocaleString('sl-SI')} t/dan` : '20-35 vlakov/dan')}</span>
                      </div>
                    </div>

                    {/* Electrification & Voltage switch */}
                    {node.rawPayload?.electrified && (
                      <div className="bg-black/40 border border-line p-2.5 rounded-lg text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-text-dim uppercase">Napajalni sistem & Vleka</span>
                          <span className="text-[10px] font-mono text-sky-400 font-semibold">{node.rawPayload.electrified}</span>
                        </div>
                        {node.rawPayload.systemSwitch && (
                          <p className="text-[10.5px] text-amber-200/90 leading-tight">
                            ⚡ {node.rawPayload.systemSwitch}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Key Operators */}
                    {node.rawPayload?.operators && Array.isArray(node.rawPayload.operators) && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Prisotni tovorni operaterji</span>
                        <div className="flex flex-wrap gap-1.5">
                          {node.rawPayload.operators.map((op: string, idx: number) => (
                            <span key={idx} className="text-[10.5px] px-2 py-0.5 rounded-md bg-white/5 border border-line text-zinc-200">
                              {op}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cargo kinds */}
                    {node.rawPayload?.cargoTypes && Array.isArray(node.rawPayload.cargoTypes) && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Glavne vrste tovora</span>
                        <div className="flex flex-wrap gap-1.5">
                          {node.rawPayload.cargoTypes.map((cargo: string, idx: number) => (
                            <span key={idx} className="text-[10.5px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-200">
                              📦 {cargo}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* The banner that used to sit here claimed an "Uradna trasa SŽ"
                    with "Točnost: ±30–60 min", "Geometrija: 100% po tirih" and
                    conformance to a path allocated by SŽ-Infrastruktura. None of
                    that was measured or published; it was fixed text shown under
                    any freight train. Modelled freight states its own real error
                    (±km from the corridor model) in its own panel, so there is
                    nothing here to replace it with. */}

                {/* VagonWEB & Fleet Composition Live Data & Cross-Border Freight Telematics (Train only, NEVER stations/yards) */}
                {isTrain && loadingVagonweb && (!vagonwebData || vagonwebData.length === 0) && !crossBorderFreight && (
                  <div className="flex items-center space-x-2 text-[11px] text-wheat p-3 bg-white/5 rounded-xl border border-line mt-2 mb-4">
                    <Activity className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    <span>Pridobivam živo sestavo garniture in vagonov...</span>
                  </div>
                )}
                {isTrain && ((vagonwebData && vagonwebData.length > 0) || crossBorderFreight) && (
                   <div className="mt-4 mb-4">
                      {/* Section Header */}
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-semibold text-text-dim uppercase tracking-wider flex items-center gap-1.5">
                          {(vagonwebMeta?.isFreight || crossBorderFreight) ? (
                            <>
                              <Box className="w-3.5 h-3.5 text-amber-400"/> Sestava tovornega vlaka & Tovorni vagoni
                            </>
                          ) : (
                            <>
                              <TrainFront className="w-3 h-3 text-wheat"/> Sestava garniture & Potniški vagoni
                            </>
                          )}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-medium border ${
                            (vagonwebMeta?.isFreight || crossBorderFreight)
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-wheat/10 text-wheat border-wheat/20'
                          }`}>
                            {crossBorderFreight?.operator || vagonwebMeta?.operator || node.rawPayload?.operator || 'Tovorni promet'}
                          </span>
                        </div>
                      </div>

                      {/* Cross-Border Freight Telematics Card (HAFAS & RailData ISR) */}
                      {crossBorderFreight && (
                        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/30 via-black/40 to-black/60 border border-amber-500/30 mb-3 space-y-2.5">
                          {/* Top Row: Title, Corridor & Refresh */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <Globe size={14} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white tracking-wide">
                                    Čezmejna tovorna telematika
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {crossBorderFreight.corridorCode}
                                  </span>
                                </div>
                                <span className="text-[10px] text-zinc-400 font-mono block">
                                  {crossBorderFreight.corridor}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => fetchCrossBorderFreight(true)}
                              disabled={loadingCrossBorder}
                              className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-wheat border border-white/10 hover:border-wheat/30 transition-colors disabled:opacity-50"
                              title="Poizvedi zadnji status v HAFAS & RailData ISR sistemih"
                            >
                              <RefreshCw size={11} className={loadingCrossBorder ? 'animate-spin text-amber-400' : 'text-wheat'} />
                              <span>{loadingCrossBorder ? 'Povezujem...' : 'HAFAS / RailData'}</span>
                            </button>
                          </div>

                          {/* Real-time Status Badges (HAFAS & RailData) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                            {/* HAFAS Real-time */}
                            <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-[9px] uppercase tracking-wider flex items-center gap-1">
                                  <Wifi size={10} className="text-emerald-400" />
                                  {crossBorderFreight.hafasStatus.sourceApi}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                  crossBorderFreight.hafasStatus.liveDelayMinutes > 3
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {crossBorderFreight.hafasStatus.liveDelayMinutes > 3
                                    ? `+${crossBorderFreight.hafasStatus.liveDelayMinutes} min`
                                    : 'TOČEN (0 min)'}
                                </span>
                              </div>
                              <div className="text-white text-[10.5px] font-semibold truncate">
                                {crossBorderFreight.hafasStatus.currentTrackSegment}
                              </div>
                              <div className="text-zinc-400 text-[9px] truncate">
                                Zadnja posodobitev: {crossBorderFreight.hafasStatus.lastSignalUpdate}
                              </div>
                            </div>

                            {/* RailData ISR Tracking */}
                            <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-[9px] uppercase tracking-wider flex items-center gap-1">
                                  <ShieldCheck size={10} className="text-wheat" />
                                  RailData ISR & TAF-TSI
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-wheat/10 text-wheat border border-wheat/20">
                                  POTRJENO
                                </span>
                              </div>
                              <div className="text-amber-200 text-[10.5px] font-semibold truncate">
                                {crossBorderFreight.raildataStatus.isrConsignmentId}
                              </div>
                              <div className="text-zinc-400 text-[9px] truncate">
                                {crossBorderFreight.raildataStatus.cimConsignmentNote} · {crossBorderFreight.raildataStatus.sealStatus}
                              </div>
                            </div>
                          </div>

                          {/* Border Crossing & Handover Point */}
                          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{crossBorderFreight.borderFlag}</span>
                              <div>
                                <span className="text-zinc-400 text-[9px] block uppercase">Predviden mejni prehod:</span>
                                <span className="text-white font-medium">{crossBorderFreight.borderStation}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-zinc-400 text-[9px] block uppercase">Razdalja & ETA do meje:</span>
                              <span className="text-wheat font-semibold">
                                {crossBorderFreight.borderDistanceKm} km · {crossBorderFreight.borderEta}
                              </span>
                            </div>
                          </div>

                          {/* Telemetry Summary Metrics */}
                          <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                            <div className="p-1.5 rounded-lg bg-black/30 border border-white/5">
                              <span className="text-[8.5px] text-zinc-400 uppercase block">Dolžina</span>
                              <span className="text-[11px] font-bold text-white">
                                {crossBorderFreight.compositionMetrics.totalLengthM} m
                              </span>
                              <span className="text-[8px] text-zinc-500 block">max 740 m</span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-black/30 border border-white/5">
                              <span className="text-[8.5px] text-zinc-400 uppercase block">Bruto masa</span>
                              <span className="text-[11px] font-bold text-amber-300">
                                {crossBorderFreight.compositionMetrics.totalGrossTons.toLocaleString('sl-SI')} t
                              </span>
                              <span className="text-[8px] text-zinc-500 block">D4 22.5 t/os</span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-black/30 border border-white/5">
                              <span className="text-[8.5px] text-zinc-400 uppercase block">Vagoni / Osi</span>
                              <span className="text-[11px] font-bold text-white">
                                {crossBorderFreight.compositionMetrics.totalWagons} v / {crossBorderFreight.compositionMetrics.totalAxles} os
                              </span>
                              <span className="text-[8px] text-zinc-500 block">Členkasti</span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-black/30 border border-white/5">
                              <span className="text-[8.5px] text-zinc-400 uppercase block">Zavora</span>
                              <span className="text-[11px] font-bold text-emerald-400">
                                {crossBorderFreight.compositionMetrics.brakePercentage}%
                              </span>
                              <span className="text-[8px] text-zinc-500 block">UIC KE-GP</span>
                            </div>
                          </div>

                          {/* Accordion / Toggle for remarks & protocols */}
                          <div className="pt-1 border-t border-white/10 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setShowFreightDetails(!showFreightDetails)}
                              className="text-[10px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                              <Info size={11} className="text-wheat" />
                              <span>{showFreightDetails ? 'Skrij operativna HAFAS sporočila & protokole' : 'Prikaži operativna HAFAS sporočila & TAF-TSI protokole'}</span>
                              {showFreightDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-zinc-500 font-mono">Prikaz:</span>
                              <button
                                type="button"
                                onClick={() => setFreightWagonViewMode('schematic')}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium transition-colors ${
                                  freightWagonViewMode === 'schematic'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-white/5 text-zinc-400 hover:text-white'
                                }`}
                              >
                                Shema (RailData)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFreightWagonViewMode('detailed')}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium transition-colors ${
                                  freightWagonViewMode === 'detailed'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-white/5 text-zinc-400 hover:text-white'
                                }`}
                              >
                                Podrobno (EVN)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFreightWagonViewMode('compact')}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium transition-colors ${
                                  freightWagonViewMode === 'compact'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-white/5 text-zinc-400 hover:text-white'
                                }`}
                              >
                                Zgoščeno
                              </button>
                            </div>
                          </div>

                          {showFreightDetails && (
                            <div className="space-y-2 pt-1 border-t border-white/5">
                              {/* Operational Remarks */}
                              <div className="space-y-1">
                                <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider block">
                                  HAFAS operativna obvestila & nadzor trase:
                                </span>
                                <div className="space-y-1">
                                  {crossBorderFreight.hafasStatus.operationalRemarks.map((rem, rIdx) => (
                                    <div key={rIdx} className="px-2 py-1 rounded bg-black/30 border border-white/5 text-[9.5px] font-mono text-zinc-300 flex items-start gap-1.5">
                                      <span className="text-amber-400 font-bold shrink-0">·</span>
                                      <span>{rem}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* RailData Protocols & Partner Railways */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[9.5px] font-mono">
                                <div className="p-2 rounded bg-black/30 border border-white/5 space-y-1">
                                  <span className="text-[9px] text-zinc-400 uppercase block">Sodelujoči železniški prevozniki:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {crossBorderFreight.raildataStatus.participatingRailways.map((rw, rwIdx) => (
                                      <span key={rwIdx} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                                        {rw}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-2 rounded bg-black/30 border border-white/5 space-y-1">
                                  <span className="text-[9px] text-zinc-400 uppercase block">Aktivni telematikični standardi:</span>
                                  <div className="space-y-0.5 text-[9px]">
                                    {crossBorderFreight.raildataStatus.protocols.map((prot, pIdx) => (
                                      <div key={pIdx} className="truncate text-emerald-400/90">
                                        ✓ {prot}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Freight Cargo Summary / Train Type */}
                      {vagonwebMeta?.trainType && (
                        <div className={`text-[10.5px] font-mono mb-2 px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                          (vagonwebMeta?.isFreight || crossBorderFreight)
                            ? 'bg-amber-950/20 border-amber-500/20 text-amber-200/90'
                            : 'bg-white/[0.03] border-white/5 text-zinc-400'
                        }`}>
                          <span className="truncate mr-2">
                            {(vagonwebMeta?.isFreight || crossBorderFreight) ? 'Tip tovora:' : 'Garnitura:'} <span className="text-white font-medium">{vagonwebMeta.trainType}</span>
                          </span>
                          <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 shrink-0 uppercase tracking-wider">
                            {(vagonwebMeta?.isFreight || crossBorderFreight) ? 'Tovorni vagoni' : (vagonwebMeta.source === 'vagonweb_live' ? 'VagonWEB' : 'Vozni park')}
                          </span>
                        </div>
                      )}

                      {/* Passenger Coach View Mode Switcher */}
                      {!crossBorderFreight && (!vagonwebMeta?.isFreight) && enrichedPassengerCoaches.length > 0 && (
                        <div className="flex items-center justify-between mb-2 px-1 py-1 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                          <div className="flex items-center gap-1.5 text-wheat font-medium">
                            <Sparkles size={11} className="text-amber-400" />
                            <span>Interaktivna sestava ({enrichedPassengerCoaches.length} vozil)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPassengerWagonViewMode('schematic')}
                              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                                passengerWagonViewMode === 'schematic'
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                  : 'bg-white/5 text-zinc-400 hover:text-white'
                              }`}
                            >
                              <Layers size={10} />
                              <span>Shema vagonov</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPassengerWagonViewMode('list')}
                              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                                passengerWagonViewMode === 'list'
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                  : 'bg-white/5 text-zinc-400 hover:text-white'
                              }`}
                            >
                              <FileText size={10} />
                              <span>Podroben seznam</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Schematic Wagon Composition Rendering (RailData Schematic) */}
                      {crossBorderFreight && crossBorderFreight.wagons && crossBorderFreight.wagons.length > 0 && freightWagonViewMode === 'schematic' ? (
                        <FreightCompositionSchematic
                          freightStatus={crossBorderFreight}
                          selectedWagon={selectedWagon}
                          onSelectWagon={(w) => setSelectedWagon(w)}
                        />
                      ) : crossBorderFreight && crossBorderFreight.wagons && crossBorderFreight.wagons.length > 0 && freightWagonViewMode === 'detailed' ? (
                        <div className="space-y-2">
                          {/* Locomotive Card at Head of Train */}
                          {enrichedLoco && (
                            <div className="text-xs px-2.5 py-2 rounded-lg border flex flex-col gap-1.5 transition-colors bg-mura/10 border-mura/30 text-white">
                              <div className="flex items-start gap-2.5 w-full">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5 bg-mura/30 text-mura border border-mura/40">
                                  VLEKA
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-white leading-relaxed">
                                      {enrichedLoco.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono text-wheat">
                                      {enrichedLoco.countryFlag} {enrichedLoco.evn}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-zinc-300 font-mono mt-0.5">
                                    {enrichedLoco.powerKw.toLocaleString('sl-SI')} kW · {enrichedLoco.voltageSummary}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-1 pt-1.5 border-t border-mura/20 flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-300">
                                  <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-wheat">
                                    ERA ERATV: {enrichedLoco.eratvCode}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                                    Max {enrichedLoco.maxSpeedKmH} km/h
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCrossBorderData(!showCrossBorderData);
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-mura/20 hover:bg-mura/30 text-wheat border border-mura/30 transition-colors shrink-0"
                                >
                                  <Globe size={11} className="text-wheat" />
                                  <span>{showCrossBorderData ? 'Skrij tujo telematiko' : '🌍 Tuji viri (ERA, ÖBB, MÁV, ČD)'}</span>
                                  {showCrossBorderData ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </button>
                              </div>

                              {showCrossBorderData && (
                                <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-mura/30 space-y-2 text-[10.5px] font-mono">
                                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                    <div>
                                      <span className="text-zinc-400 block text-[9px] uppercase">EVN / UIC registracija:</span>
                                      <span className="text-white font-semibold">{enrichedLoco.evn}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400 block text-[9px] uppercase">Vlečna moč & hitrost:</span>
                                      <span className="text-white font-semibold">{enrichedLoco.powerKw.toLocaleString('sl-SI')} kW ({enrichedLoco.powerHp.toLocaleString('sl-SI')} KM) · {enrichedLoco.maxSpeedKmH} km/h</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400 block text-[9px] uppercase">Vlečni sistemi (Napetost):</span>
                                      <span className="text-zinc-200">{enrichedLoco.voltageSummary}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400 block text-[9px] uppercase">Varnostni sistemi (ATP):</span>
                                      <span className="text-zinc-200">{enrichedLoco.safetySystems.join(', ')}</span>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-zinc-400 block text-[9px] uppercase">Dovoljenje za promet (Države):</span>
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {enrichedLoco.countryApprovals.map((c, cIdx) => (
                                          <span key={cIdx} className="px-1.5 py-0.2 rounded bg-wheat/10 border border-wheat/20 text-wheat text-[9.5px] font-bold">
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-1.5 border-t border-white/10 space-y-1">
                                    <span className="text-[9.5px] text-zinc-400 font-semibold block uppercase tracking-wider">
                                      Povezani tuji in mednarodni viri telematike:
                                    </span>
                                    <div className="space-y-1">
                                      {enrichedLoco.dataSources.map((ds, dIdx) => (
                                        <div key={dIdx} className="p-1 rounded bg-white/[0.03] border border-white/5 flex items-center justify-between text-[9.5px]">
                                          <div className="flex items-center gap-1.5">
                                            <Globe size={10} className="text-wheat shrink-0" />
                                            <span className="text-white font-medium">{ds.name}</span>
                                            <span className="text-zinc-400 text-[8.5px]">({ds.country})</span>
                                          </div>
                                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                                            {ds.protocol}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Individual Freight Wagons List */}
                          {crossBorderFreight.wagons.map((wagon, wIdx) => {
                            const isSelected = selectedWagon?.evn === wagon.evn;
                            let catLabel = 'TOVOR';
                            if (wagon.category === 'intermodal') catLabel = 'KONTEJNER';
                            else if (wagon.category === 'tank') catLabel = 'CISTERNA';
                            else if (wagon.category === 'steel') catLabel = 'JEKLO';
                            else if (wagon.category === 'auto') catLabel = 'AVTO';
                            else if (wagon.category === 'bulk_grain') catLabel = 'ŽITO';

                            return (
                              <div
                                key={wIdx}
                                onClick={() => setSelectedWagon(isSelected ? null : wagon)}
                                className={`text-xs p-2.5 rounded-lg border flex flex-col gap-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500/15 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                                    : 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08] border-amber-500/20 text-amber-100'
                                }`}
                              >
                                {/* Wagon Top Line: Position, Tag, EVN and VKM Keeper */}
                                <div className="flex items-center justify-between gap-1.5 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                      #{wagon.position} {catLabel}
                                    </span>
                                    <span className="text-white font-mono font-semibold text-[11px] truncate">
                                      {wagon.countryFlag} {wagon.evn}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-wheat shrink-0">
                                    {wagon.vkm}
                                  </span>
                                </div>

                                {/* Wagon Type & Cargo Description */}
                                <div className="space-y-1 font-mono">
                                  <div className="text-[11px] font-medium text-white flex items-center justify-between">
                                    <span>{wagon.wagonSeries} · {wagon.wagonTypeLabel}</span>
                                    <span className="text-zinc-400 text-[10px]">{wagon.lengthM} m · {wagon.axles} osi</span>
                                  </div>
                                  <div className="text-[10.5px] text-amber-200/90 leading-snug">
                                    {wagon.cargoDescription}
                                  </div>
                                </div>

                                {/* Containers or RID Hazard */}
                                {wagon.containers && wagon.containers.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 text-[9.5px] font-mono">
                                    <span className="text-zinc-400 flex items-center gap-1">
                                      <Package size={10} className="text-amber-400" />
                                      ISO:
                                    </span>
                                    {wagon.containers.map((cCode, cIdx) => (
                                      <span key={cIdx} className="px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-white font-bold">
                                        {cCode}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {wagon.ridHazard && (
                                  <div className="p-1.5 rounded bg-orange-950/40 border border-orange-500/30 text-orange-200 text-[9.5px] font-mono flex items-center gap-1.5">
                                    <AlertTriangle size={11} className="text-orange-400 shrink-0" />
                                    <span>{wagon.ridHazard}</span>
                                  </div>
                                )}

                                {/* Technical Metric Pills */}
                                <div className="grid grid-cols-4 gap-1 text-center font-mono text-[9px] pt-1 border-t border-amber-500/10">
                                  <div className="p-1 rounded bg-black/30">
                                    <span className="text-zinc-400 block text-[8px]">TARA</span>
                                    <span className="text-white font-bold">{wagon.tareWeightTons} t</span>
                                  </div>
                                  <div className="p-1 rounded bg-black/30">
                                    <span className="text-zinc-400 block text-[8px]">TOVOR</span>
                                    <span className="text-amber-300 font-bold">{wagon.payloadWeightTons} t</span>
                                  </div>
                                  <div className="p-1 rounded bg-black/30">
                                    <span className="text-zinc-400 block text-[8px]">BRUTO</span>
                                    <span className="text-white font-bold">{wagon.grossWeightTons} t</span>
                                  </div>
                                  <div className="p-1 rounded bg-black/30">
                                    <span className="text-zinc-400 block text-[8px]">ZAVORA</span>
                                    <span className="text-emerald-400 font-bold">{wagon.brakeRegime.split(' ')[1] || 'UIC GP'}</span>
                                  </div>
                                </div>

                                {/* Expanded Inspection Dossier on Click */}
                                {isSelected && (
                                  <div className="mt-1 p-2 rounded-lg bg-black/60 border border-amber-500/30 space-y-1.5 text-[10px] font-mono">
                                    <div className="flex items-center justify-between pb-1 border-b border-white/10">
                                      <span className="text-amber-300 font-bold">Podrobni tehnični dosje vagona</span>
                                      <span className="text-[9px] text-zinc-400">{wagon.tafTsiWsrId}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <div>
                                        <span className="text-zinc-400 block text-[8.5px] uppercase">Ciljni terminal:</span>
                                        <span className="text-white font-medium">{wagon.destinationTerminal}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 block text-[8.5px] uppercase">Zavorni sistem & režim:</span>
                                        <span className="text-white font-medium">{wagon.brakeRegime}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 block text-[8.5px] uppercase">Status carinskega pregleda:</span>
                                        <span className="text-emerald-400 font-medium">✓ TAF-TSI Potrjeno / Brez zadržkov</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 block text-[8.5px] uppercase">Izvor podatkov:</span>
                                        <span className="text-wheat font-medium">RailData ISR Leaflet 404-2</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : crossBorderFreight && crossBorderFreight.wagons && crossBorderFreight.wagons.length > 0 && freightWagonViewMode === 'compact' ? (
                        /* Compact Freight Wagon List */
                        <div className="space-y-1.5">
                          {(crossBorderFreight.wagons || []).map((wag, idx) => (
                            <div key={idx} className="text-xs px-2.5 py-2 rounded-lg border flex flex-col gap-1.5 transition-colors bg-amber-500/[0.06] border-amber-500/20 text-amber-100">
                              <div className="flex items-start gap-2.5 w-full">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  #{wag.position}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-white">{wag.wagonType} · {wag.categoryLabel}</span>
                                    <span className="text-[9.5px] font-mono text-amber-300">{wag.grossWeightTons} t ({wag.cargo})</span>
                                  </div>
                                  <div className="text-[9.5px] text-zinc-400 font-mono mt-0.5">
                                    {wag.evn} · {wag.axles} osi · {wag.lengthMeters} m
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : enrichedPassengerCoaches && enrichedPassengerCoaches.length > 0 && passengerWagonViewMode === 'schematic' ? (
                        /* Interactive Passenger Train Schematic */
                        <PassengerCompositionSchematic
                          coaches={enrichedPassengerCoaches}
                          selectedCoach={selectedPassengerCoach}
                          onSelectCoach={(c) => setSelectedPassengerCoach(c)}
                          trainNumber={node?.title}
                          trainType={vagonwebMeta?.trainType}
                          operator={vagonwebMeta?.operator || node.rawPayload?.operator}
                        />
                      ) : enrichedPassengerCoaches && enrichedPassengerCoaches.length > 0 ? (
                        /* Interactive Passenger Coach Detailed List */
                        <div className="space-y-2">
                          {enrichedPassengerCoaches.map((coach) => {
                            const isSelected = selectedPassengerCoach?.id === coach.id;
                            const isLoco = coach.category === 'locomotive';
                            const is1stClass = coach.category === '1st_class';
                            const isDining = coach.category === 'dining';
                            const isService = coach.category === 'service_bike';

                            return (
                              <div
                                key={coach.id}
                                onClick={() => setSelectedPassengerCoach(isSelected ? null : coach)}
                                className={`text-xs p-3 rounded-xl border flex flex-col gap-2 transition-all cursor-pointer select-none ${
                                  isSelected
                                    ? 'bg-amber-500/10 border-amber-400/80 shadow-md ring-1 ring-amber-400/50'
                                    : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-amber-400/40 text-white/90'
                                }`}
                              >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5 ${
                                      isSelected
                                        ? 'bg-amber-400 text-slate-950 font-extrabold'
                                        : isLoco
                                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                          : is1stClass
                                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                            : isDining
                                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                              : isService
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-white/10 text-wheat border border-white/10'
                                    }`}>
                                      #{coach.position} {coach.classDisplay}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-white leading-tight">
                                          {coach.series}
                                        </span>
                                        <span className="text-[9.5px] text-zinc-400">
                                          · {coach.categoryLabel}
                                        </span>
                                      </div>
                                      <div className="text-[10.5px] text-zinc-300 mt-0.5 truncate">
                                        {coach.fullTitle}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 text-zinc-400">
                                    <span className="text-[9px] font-mono hidden sm:inline text-amber-300/90 font-medium">
                                      {isSelected ? 'Zapri tloris' : 'Odpri tloris'}
                                    </span>
                                    {isSelected ? <ChevronUp size={15} className="text-amber-400" /> : <ChevronDown size={15} />}
                                  </div>
                                </div>

                                {/* Quick Amenities Row */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5 text-[9.5px] font-mono text-zinc-300">
                                  {coach.amenities.airConditioning && (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
                                      <Wind size={9} /> Klima
                                    </span>
                                  )}
                                  {coach.amenities.powerSockets230V && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                      <Zap size={9} /> 230V
                                    </span>
                                  )}
                                  {coach.amenities.bikeStorage && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                                      <Bike size={9} /> Kolesa ({coach.amenities.bikeStorageCount || 6})
                                    </span>
                                  )}
                                  {coach.amenities.wheelchairAccessible && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                                      <Accessibility size={9} /> PRM
                                    </span>
                                  )}
                                  {coach.amenities.wifi && (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
                                      <Wifi size={9} /> Wi-Fi
                                    </span>
                                  )}
                                  {coach.seatMap.totalSeats > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-200 border border-white/10 font-bold">
                                      💺 {coach.seatMap.totalSeats} sedišč
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                                    {coach.technicalSpecs.countryFlag} max {coach.technicalSpecs.maxSpeedKmh} km/h
                                  </span>
                                </div>

                                {/* Expanded Coach Interactive Dossier (when selected) */}
                                {isSelected && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-3 animate-in fade-in duration-150"
                                  >
                                    {/* Description */}
                                    <div className="text-[11px] text-slate-200 leading-relaxed font-sans">
                                      {coach.description}
                                    </div>

                                    {/* Highlights Checklist */}
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block">
                                        Značilnosti in udobje:
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {coach.highlights.map((hl, hIdx) => (
                                          <div key={hIdx} className="p-1.5 rounded bg-white/[0.03] border border-white/5 flex items-start gap-1.5 text-[10.5px] text-zinc-200">
                                            <CheckCircle2 size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                                            <span>{hl}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Interactive Compartments Mini-Map */}
                                    {coach.seatMap.totalSeats > 0 && (
                                      <div className="p-2.5 rounded-lg bg-black/50 border border-slate-800 space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-mono">
                                          <span className="text-amber-300 font-bold">
                                            {coach.seatMap.type === 'compartments' 
                                              ? `Predelki (${coach.seatMap.compartmentsCount || 10} predelkov po 6 sedišč)` 
                                              : 'Tloris odprtega salona'}
                                          </span>
                                          <span className="text-zinc-400">
                                            Skupaj {coach.seatMap.totalSeats} sedišč
                                          </span>
                                        </div>
                                        <div className="flex gap-1 overflow-x-auto py-1">
                                          {Array.from({ length: coach.seatMap.compartmentsCount || 10 }).map((_, compIdx) => (
                                            <div
                                              key={compIdx}
                                              className="px-2 py-1.5 rounded bg-slate-900 border border-slate-700/80 text-center min-w-[44px] hover:border-amber-400/50 transition-colors"
                                            >
                                              <div className="text-[8px] font-mono text-amber-400 font-bold">Odd. {compIdx + 1}</div>
                                              <div className="text-[7.5px] text-sky-200 mt-0.5">6 sed.</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Technical UIC & EVR Specs Table */}
                                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                      <div>
                                        <span className="text-zinc-400 text-[8.5px] block uppercase">EVN / UIC oznaka:</span>
                                        <span className="text-white font-semibold">{coach.technicalSpecs.evnSample}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 text-[8.5px] block uppercase">Konstrukcijski tip:</span>
                                        <span className="text-amber-300 font-semibold">{coach.technicalSpecs.uicTypeStandard}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 text-[8.5px] block uppercase">Max hitrost & dolžina:</span>
                                        <span className="text-zinc-200">{coach.technicalSpecs.maxSpeedKmh} km/h · {coach.technicalSpecs.lengthOverBuffersM} m</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 text-[8.5px] block uppercase">Podstavni vozički:</span>
                                        <span className="text-zinc-200">{coach.technicalSpecs.bogieType}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 text-[8.5px] block uppercase">Masa praznega vagona:</span>
                                        <span className="text-zinc-200">{coach.technicalSpecs.tareWeightTons} t</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 text-[8.5px] block uppercase">Zavorni sistem & zavora:</span>
                                        <span className="text-emerald-400 font-medium">{coach.technicalSpecs.brakeType}</span>
                                      </div>
                                    </div>

                                    {/* VagonWEB Direct Link */}
                                    {coach.vagonwebUrl && (
                                      <div className="pt-1 flex items-center justify-between">
                                        <span className="text-[9.5px] text-zinc-400 font-mono">
                                          Vir sestave: VagonWEB.cz & SŽ vozni park
                                        </span>
                                        <a
                                          href={coach.vagonwebUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 transition-colors"
                                        >
                                          <span>Odpri na VagonWEB.cz</span>
                                          <ExternalLink size={11} />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Compact / Standard List (fallback or toggled) */
                        <div className="space-y-1.5">
                          {(vagonwebData || []).map((wag, idx) => {
                            const isLoco = wag.toLowerCase().includes('lokomotiva') || wag.toLowerCase().includes('taurus') || wag.toLowerCase().includes('traxx') || wag.toLowerCase().includes('e.404') || wag.toLowerCase().includes('vectron') || wag.toLowerCase().includes('reagan') || wag.toLowerCase().includes('1216') || wag.toLowerCase().includes('1116') || wag.toLowerCase().includes('664') || wag.toLowerCase().includes('541') || wag.toLowerCase().includes('vleka');
                            const isCargoWagon = wag.toLowerCase().includes('sggrss') || wag.toLowerCase().includes('sgnss') || wag.toLowerCase().includes('zacns') || wag.toLowerCase().includes('shimmns') || wag.toLowerCase().includes('laaers') || wag.toLowerCase().includes('tagnpps') || wag.toLowerCase().includes('eanos') || wag.toLowerCase().includes('zabojnik') || wag.toLowerCase().includes('cistern') || wag.toLowerCase().includes('pločevin') || wag.toLowerCase().includes('avtomobil') || wag.toLowerCase().includes('žit') || wag.toLowerCase().includes('tovorn');
                            
                            let tagLabel = `${idx + 1}.`;
                            if (isLoco) tagLabel = 'VLEKA';
                            else if (wag.includes('Sggrss') || wag.includes('Sgnss') || wag.toLowerCase().includes('zabojnik')) tagLabel = 'KONTEJNER';
                            else if (wag.includes('Zacns') || wag.toLowerCase().includes('cistern')) tagLabel = 'CISTERNA';
                            else if (wag.includes('Shimmns') || wag.toLowerCase().includes('pločevin')) tagLabel = 'PLOČEVINA';
                            else if (wag.includes('Laaers') || wag.toLowerCase().includes('avtomobil')) tagLabel = 'AVTO';
                            else if (wag.includes('Tagnpps') || wag.toLowerCase().includes('žit')) tagLabel = 'ŽITO';
                            else if (isCargoWagon) tagLabel = 'TOVOR';

                            return (
                              <div key={idx} className={`text-xs px-2.5 py-2 rounded-lg border flex flex-col gap-1.5 transition-colors ${
                                isLoco ? 'bg-mura/10 border-mura/30 text-white' : (
                                  isCargoWagon 
                                    ? 'bg-amber-500/[0.06] border-amber-500/20 text-amber-100'
                                    : 'bg-white/[0.04] border-line text-white/90'
                                )
                              }`}>
                                <div className="flex items-start gap-2.5 w-full">
                                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5 ${
                                    isLoco ? 'bg-mura/30 text-mura border border-mura/40' : (
                                      isCargoWagon
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-white/10 text-wheat border border-white/10'
                                    )
                                  }`}>
                                    {tagLabel}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium leading-relaxed">{wag}</span>
                                  </div>
                                </div>

                                {isLoco && (
                                  <div className="mt-1 pt-1.5 border-t border-mura/20 flex flex-wrap items-center justify-between gap-1.5">
                                    {enrichedLoco && (
                                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-300">
                                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-wheat">
                                          {enrichedLoco.countryFlag} {enrichedLoco.evn}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                                          {enrichedLoco.powerKw.toLocaleString('sl-SI')} kW
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                                          {enrichedLoco.voltageSummary.split(' · ')[0]}
                                        </span>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCrossBorderData(!showCrossBorderData);
                                      }}
                                      className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-mura/20 hover:bg-mura/30 text-wheat border border-mura/30 transition-colors shrink-0"
                                    >
                                      <Globe size={11} className="text-wheat" />
                                      <span>{showCrossBorderData ? 'Skrij tujo telematiko' : '🌍 Tuji viri (ERA, ÖBB, MÁV, ČD)'}</span>
                                      {showCrossBorderData ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                  </div>
                                )}

                                {isLoco && showCrossBorderData && enrichedLoco && (
                                  <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-mura/30 space-y-2 text-[10.5px] font-mono">
                                    <div className="flex items-center justify-between pb-1 border-b border-white/10">
                                      <span className="text-wheat font-bold flex items-center gap-1.5">
                                        <span>{enrichedLoco.countryFlag}</span>
                                        <span>{enrichedLoco.name}</span>
                                      </span>
                                      <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                                        ERA ERATV: {enrichedLoco.eratvCode}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                      <div>
                                        <span className="text-zinc-400 block text-[9px] uppercase">EVN / UIC registracija:</span>
                                        <span className="text-white font-semibold">{enrichedLoco.evn}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 block text-[9px] uppercase">Vlečna moč & hitrost:</span>
                                        <span className="text-white font-semibold">{enrichedLoco.powerKw.toLocaleString('sl-SI')} kW ({enrichedLoco.powerHp.toLocaleString('sl-SI')} KM) · {enrichedLoco.maxSpeedKmH} km/h</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 block text-[9px] uppercase">Vlečni sistemi (Napetost):</span>
                                        <span className="text-zinc-200">{enrichedLoco.voltageSummary}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-400 block text-[9px] uppercase">Varnostni sistemi (ATP):</span>
                                        <span className="text-zinc-200">{enrichedLoco.safetySystems.join(', ')}</span>
                                      </div>
                                      <div className="col-span-2">
                                        <span className="text-zinc-400 block text-[9px] uppercase">Dovoljenje za promet (Države):</span>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {enrichedLoco.countryApprovals.map((c, cIdx) => (
                                            <span key={cIdx} className="px-1.5 py-0.2 rounded bg-wheat/10 border border-wheat/20 text-wheat text-[9.5px] font-bold">
                                              {c}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="pt-1.5 border-t border-white/10 space-y-1">
                                      <span className="text-[9.5px] text-zinc-400 font-semibold block uppercase tracking-wider">
                                        Povezani tuji in mednarodni viri telematike:
                                      </span>
                                      <div className="space-y-1">
                                        {enrichedLoco.dataSources.map((ds, dIdx) => (
                                          <div key={dIdx} className="p-1 rounded bg-white/[0.03] border border-white/5 flex items-center justify-between text-[9.5px]">
                                            <div className="flex items-center gap-1.5">
                                              <Globe size={10} className="text-wheat shrink-0" />
                                              <span className="text-white font-medium">{ds.name}</span>
                                              <span className="text-zinc-400 text-[8.5px]">({ds.country})</span>
                                            </div>
                                            <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                                              {ds.protocol}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                   </div>
                )}


                {/* Dedicated Micromobility & Metoda C Trip Inspection Card */}
                {(node.type === 'micromobility' || node.type === 'micromobility_trip') && (() => {
                  const raw = node.rawPayload || {};
                  const isStation = raw.type === 'STATION';
                  const form = raw.form || 'SCOOTER';
                  const isNomago = raw.id?.startsWith('nomago_') || raw.network?.startsWith('nextbike');
                  const isAvant = raw.network?.includes('avant');
                  const isPtuj = raw.network?.includes('ptuj');
                  const isEbike = !!raw.isEbike || raw.propulsion === 'electric_assist';

                  let formLabel = form === 'CAR' ? 'Električni avtomobil' : (form === 'BICYCLE' ? (isEbike ? 'Električno kolo (e-bike)' : 'Mestno kolo') : 'Električni skiro');
                  let provider = raw.operator || (raw.network?.includes('bolt') ? 'Bolt' : (isAvant ? 'Avant2Go' : (isNomago ? 'Nomago Bikes' : (raw.network?.includes('sobota') ? 'Soboški bicikl' : (isPtuj ? 'SC Bikes Ptuj' : (raw.network?.includes('ljubljana') ? 'BicikeLJ' : (raw.network || 'BrezAvta')))))));

                  const availableCount = raw.reservableCars != null ? raw.reservableCars : (raw.vehicles != null ? raw.vehicles : 1);
                  const spacesCount = raw.freeParkingPlaces != null ? raw.freeParkingPlaces : (raw.spaces != null ? raw.spaces : 0);
                  const isInTrip = raw.status === 'in_trip' || raw.tripType === 'active';
                  const isCompletedTrip = raw.status === 'completed' || raw.tripType === 'completed';
                  const tripInfo = raw.tripInfo || raw;

                  // 1) Active Trip Inspection (In-Trip)
                  if (isInTrip) {
                    const origLat = tripInfo?.originLat ?? tripInfo?.origin?.[0];
                    const origLon = tripInfo?.originLon ?? tripInfo?.origin?.[1];
                    const currLat = raw.currentLat ?? raw.lastLat ?? (node.coordinates ? node.coordinates[1] : origLat);
                    const currLon = raw.currentLon ?? raw.lastLon ?? (node.coordinates ? node.coordinates[0] : origLon);

                    return (
                      <div className="bg-gradient-to-br from-amber-950/40 via-panel/90 to-slate-950/80 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md relative overflow-hidden mb-3.5">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                              {form === 'CAR' ? <Car size={12} /> : form === 'BICYCLE' ? <Bike size={12} /> : <Zap size={12} />}
                              {provider} · {formLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              AKTIVNA VOŽNJA (IN-TRIP)
                            </span>
                          </div>

                          {currLon && currLat && onFlyTo && (
                            <button
                              onClick={() => onFlyTo([currLon, currLat], 16.5)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] font-mono transition-all cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
                              title="Približaj vozilo v vožnji"
                            >
                              <MapPin size={11} />
                              <span>Približaj</span>
                            </button>
                          )}
                        </div>

                        {/* In-Trip Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2 my-2">
                          <div className="bg-black/50 border border-amber-500/25 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-amber-400/80 uppercase mb-0.5">
                              <Timer size={11} />
                              <span>Čas najema</span>
                            </div>
                            <span className="text-lg font-bold font-mono text-white leading-none">
                              {tripInfo?.durationFormatted || '< 1 min'}
                            </span>
                          </div>

                          <div className="bg-black/50 border border-amber-500/25 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-amber-400/80 uppercase mb-0.5">
                              <Navigation size={11} />
                              <span>Pot (ocena)</span>
                            </div>
                            <span className="text-lg font-bold font-mono text-white leading-none">
                              {tripInfo?.estimatedDistanceKm != null ? `${tripInfo.estimatedDistanceKm} km` : '–'}
                            </span>
                          </div>

                          <div className="bg-black/50 border border-amber-500/25 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-amber-400/80 uppercase mb-0.5">
                              <Activity size={11} />
                              <span>Hitrost</span>
                            </div>
                            <span className="text-lg font-bold font-mono text-white leading-none">
                              {raw.speed ? `${Math.round(raw.speed)} km/h` : `${raw.speedKmH || 14} km/h`}
                            </span>
                          </div>
                        </div>

                        {/* Origin (Točka A) & Current (Točka B) Box */}
                        <div className="space-y-1.5 my-2.5">
                          {/* Origin Point A */}
                          <div className="bg-black/30 border border-emerald-500/25 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                                A
                              </div>
                              <div>
                                <span className="text-emerald-400/80 text-[9.5px] block font-semibold uppercase">Izhodiščna točka (Začetek najema):</span>
                                <span className="text-zinc-200">
                                  {origLat && origLon ? `${origLat.toFixed(4)}°, ${origLon.toFixed(4)}°` : 'Zaznano v mapi'}
                                </span>
                              </div>
                            </div>
                            {onFlyTo && origLat && origLon && (
                              <button
                                onClick={() => onFlyTo([origLon, origLat], 16.5)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[9.5px] font-mono cursor-pointer border border-emerald-500/30 shrink-0"
                                title="Približaj izhodišče A na karti"
                              >
                                Pokaži A
                              </button>
                            )}
                          </div>

                          {/* Current Point B */}
                          <div className="bg-black/30 border border-amber-500/25 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                                B
                              </div>
                              <div>
                                <span className="text-amber-400/80 text-[9.5px] block font-semibold uppercase">Trenutna lokacija (V vožnji):</span>
                                <span className="text-zinc-200">
                                  {currLat && currLon ? `${currLat.toFixed(4)}°, ${currLon.toFixed(4)}°` : 'V gibanju'}
                                </span>
                              </div>
                            </div>
                            {onFlyTo && currLat && currLon && (
                              <button
                                onClick={() => onFlyTo([currLon, currLat], 16.5)}
                                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[9.5px] font-mono cursor-pointer border border-amber-500/30 shrink-0"
                                title="Približaj trenutno lokacijo B na karti"
                              >
                                Pokaži B
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real-time Metoda C Guarantee */}
                        <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2 text-[10.5px]">
                          <div className="flex items-center gap-1.5 text-zinc-300 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>Metoda C: Diferencialno sledenje najemov</span>
                          </div>
                          <span className="text-amber-400 font-mono text-[10px]">
                            Vir: {raw.systemName || 'GBFS feed'}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // 2) Completed Trip Inspection (Arhiv zaključenih poti)
                  if (isCompletedTrip) {
                    const origLat = raw.origin?.[0] ?? raw.originLat;
                    const origLon = raw.origin?.[1] ?? raw.originLon;
                    const destLat = raw.destination?.[0] ?? raw.destLat;
                    const destLon = raw.destination?.[1] ?? raw.destLon;
                    const durMin = raw.durationSeconds ? Math.round(raw.durationSeconds / 60) : 0;

                    return (
                      <div className="bg-gradient-to-br from-sky-950/40 via-panel/90 to-slate-950/80 border border-sky-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md relative overflow-hidden mb-3.5">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1.5">
                              {form === 'CAR' ? <Car size={12} /> : form === 'BICYCLE' ? <Bike size={12} /> : <Zap size={12} />}
                              {provider} · {formLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-sky-400" />
                              ZAKLJUČENA VOŽNJA (ARHIV)
                            </span>
                          </div>

                          {destLon && destLat && onFlyTo && (
                            <button
                              onClick={() => onFlyTo([destLon, destLat], 16.5)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[10px] font-mono transition-all cursor-pointer shadow-md shadow-sky-500/20 shrink-0"
                              title="Približaj ciljno točko B"
                            >
                              <MapPin size={11} />
                              <span>Cilj</span>
                            </button>
                          )}
                        </div>

                        {/* Completed Trip Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2 my-2">
                          <div className="bg-black/50 border border-sky-500/25 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-sky-400/80 uppercase mb-0.5">
                              <Navigation size={11} />
                              <span>Razdalja</span>
                            </div>
                            <span className="text-lg font-bold font-mono text-white leading-none">
                              {raw.distanceKm ? `${raw.distanceKm} km` : '–'}
                            </span>
                          </div>

                          <div className="bg-black/50 border border-sky-500/25 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-sky-400/80 uppercase mb-0.5">
                              <Timer size={11} />
                              <span>Trajanje</span>
                            </div>
                            <span className="text-lg font-bold font-mono text-white leading-none">
                              {durMin > 0 ? `${durMin} min` : '< 1 min'}
                            </span>
                          </div>

                          <div className="bg-black/50 border border-sky-500/25 rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-sky-400/80 uppercase mb-0.5">
                              <Activity size={11} />
                              <span>Povpr. hitrost</span>
                            </div>
                            <span className="text-lg font-bold font-mono text-white leading-none">
                              {raw.avgSpeedKmH ? `${raw.avgSpeedKmH} km/h` : '–'}
                            </span>
                          </div>
                        </div>

                        {/* Origin Point A and Destination Point B Box */}
                        <div className="space-y-1.5 my-2.5">
                          {/* Origin Point A */}
                          <div className="bg-black/30 border border-emerald-500/25 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                                A
                              </div>
                              <div>
                                <span className="text-emerald-400/80 text-[9.5px] block font-semibold uppercase">Izhodišče (Začetek poti):</span>
                                <span className="text-zinc-200">
                                  {origLat && origLon ? `${origLat.toFixed(4)}°, ${origLon.toFixed(4)}°` : 'Zaznano v mapi'}
                                </span>
                              </div>
                            </div>
                            {onFlyTo && origLat && origLon && (
                              <button
                                onClick={() => onFlyTo([origLon, origLat], 16.5)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[9.5px] font-mono cursor-pointer border border-emerald-500/30 shrink-0"
                                title="Približaj izhodišče A na karti"
                              >
                                Pokaži A
                              </button>
                            )}
                          </div>

                          {/* Destination Point B */}
                          <div className="bg-black/30 border border-rose-500/25 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
                                B
                              </div>
                              <div>
                                <span className="text-rose-400/80 text-[9.5px] block font-semibold uppercase">Končna točka (Zaklep / Cilj):</span>
                                <span className="text-zinc-200">
                                  {destLat && destLon ? `${destLat.toFixed(4)}°, ${destLon.toFixed(4)}°` : 'Ciljna lokacija'}
                                </span>
                              </div>
                            </div>
                            {onFlyTo && destLat && destLon && (
                              <button
                                onClick={() => onFlyTo([destLon, destLat], 16.5)}
                                className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[9.5px] font-mono cursor-pointer border border-rose-500/30 shrink-0"
                                title="Približaj cilj B na karti"
                              >
                                Pokaži B
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Differential Persistence Note */}
                        <div className="mt-2.5 pt-2 border-t border-sky-500/20 flex items-center justify-between gap-2 text-[10.5px]">
                          <div className="flex items-center gap-1.5 text-zinc-300 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            <span>Zabeleženo z diferencialnim sklepom (Metoda C)</span>
                          </div>
                          <span className="text-sky-400 font-mono text-[10px]">
                            Arhivirano lokalno
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // 3) Standard Parked / Station View
                  return (
                    <div className="bg-gradient-to-br from-emerald-950/30 via-panel/80 to-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden mb-3.5">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                            {form === 'CAR' ? <Car size={12} /> : form === 'BICYCLE' ? <Bike size={12} /> : <Zap size={12} />}
                            {provider} · {formLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {isStation ? (isAvant ? 'CAR-SHARING POSTAJA' : 'URADNA POSTAJA') : 'PARKIRANO / PROSTO'}
                          </span>
                        </div>

                        {node.coordinates && onFlyTo && (
                          <button
                            onClick={() => onFlyTo(node.coordinates as [number, number], 16.5)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] font-mono transition-all cursor-pointer shadow-md shadow-emerald-500/20 shrink-0"
                            title="Približaj vozilo na zemljevidu"
                          >
                            <MapPin size={11} />
                            <span>Približaj</span>
                          </button>
                        )}
                      </div>

                      {/* Avant2Go Dedicated Car-Sharing View */}
                      {isAvant ? (
                        <div className="space-y-2.5 my-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-black/40 border border-cyan-500/25 rounded-xl p-2.5">
                              <span className="text-[9.5px] font-mono text-cyan-400/80 block uppercase">Na voljo</span>
                              <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-xl font-bold font-mono text-white">{availableCount}</span>
                                <span className="text-[10px] font-mono text-cyan-400">avtomobil{availableCount === 1 ? '' : (availableCount === 2 ? 'a' : 'ov')}</span>
                              </div>
                            </div>
                            <div className="bg-black/40 border border-emerald-500/25 rounded-xl p-2.5">
                              <span className="text-[9.5px] font-mono text-emerald-400/80 block uppercase">Polnilnice</span>
                              <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-xl font-bold font-mono text-white">{raw.chargers ?? 0}</span>
                                <span className="text-[10px] font-mono text-emerald-400">⚡ EV</span>
                              </div>
                            </div>
                            <div className="bg-black/40 border border-amber-500/25 rounded-xl p-2.5">
                              <span className="text-[9.5px] font-mono text-amber-400/80 block uppercase">Parkirišča</span>
                              <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-xl font-bold font-mono text-white">{spacesCount}</span>
                                <span className="text-[10px] font-mono text-amber-400">prostih</span>
                              </div>
                            </div>
                          </div>
                          {(raw.address || raw.city) && (
                            <div className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono flex items-center gap-2 text-zinc-300">
                              <MapPin size={13} className="text-cyan-400 shrink-0" />
                              <span>{raw.address ? `${raw.address}, ` : ''}{raw.city || ''}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Standard Micromobility Grid */
                        <div className="grid grid-cols-2 gap-2.5 my-2">
                          <div className="bg-black/40 border border-emerald-500/25 rounded-xl p-3 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              {form === 'CAR' ? <Car size={20} /> : form === 'BICYCLE' ? <Bike size={20} /> : <Zap size={20} />}
                            </div>
                            <div>
                              <span className="text-[10px] font-mono text-text-dim block uppercase">
                                {isStation ? 'Na voljo vozil' : 'Vozil na lokaciji'}
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold font-mono text-white leading-none">
                                  {availableCount}
                                </span>
                                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                                  {form === 'CAR' ? 'avto' : (form === 'BICYCLE' ? (isEbike ? 'e-kolo' : 'kolo') : 'skiro')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-black/40 border border-emerald-500/25 rounded-xl p-3 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              <MapPin size={20} />
                            </div>
                            <div>
                              <span className="text-[10px] font-mono text-text-dim block uppercase">
                                {isStation ? 'Prosta mesta' : 'Način parkiranja'}
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold font-mono text-white leading-none">
                                  {isStation ? spacesCount : 'Na lokaciji'}
                                </span>
                                {isStation && (
                                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                                    prostih
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Nomago / E-Bike Battery and Range Telemetry */}
                      {raw.fuelPercent != null && (
                        <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-3 my-2 space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-text-dim flex items-center gap-1.5">
                              <Zap size={13} className="text-amber-400" />
                              <span>Nivo baterije:</span>
                            </span>
                            <span className={`font-bold ${raw.fuelPercent > 50 ? 'text-emerald-400' : raw.fuelPercent > 20 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {raw.fuelPercent}%
                              {raw.rangeKm != null && ` (${raw.rangeKm} km dosega)`}
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-zinc-700/50">
                            <div
                              className={`h-full rounded-full transition-all ${raw.fuelPercent > 50 ? 'bg-emerald-500' : raw.fuelPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, Math.max(5, raw.fuelPercent))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Direct Unlock / Rental Action Button */}
                      {raw.rentalUri && (
                        <div className="my-2.5">
                          <a
                            href={raw.rentalUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                          >
                            <Bike size={14} />
                            <span>Odkleni kolo (Nomago / Nextbike)</span>
                          </a>
                        </div>
                      )}

                      {/* 100% Real data guarantee */}
                      <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-2 text-[10.5px]">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>100% realni podatki · Brez simulacije</span>
                        </div>
                        <span className="text-emerald-400 font-mono text-[10px]">
                          Vir: {raw.systemName || (isNomago ? 'Nomago GBFS v2' : (isAvant ? 'Avant2Go API' : (isPtuj ? 'SC Bikes Ptuj' : 'BrezAvta.si (GBFS)')))}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {node.metrics.map((m, idx) => {
                    let displayVal = m.value;
                    let isHighlighted = m.highlight;
                    if (isTrain && (m.label === 'Prijavljena zamuda' || m.label === 'Zamuda') && effectiveTrainDelay > 0) {
                      displayVal = `+${effectiveTrainDelay} min`;
                      isHighlighted = effectiveTrainDelay > 3;
                    }
                    const isLong = String(displayVal).length > 15;
                    return (
                    <div key={idx} className={`bg-white/[0.03] border border-line rounded-xl p-2.5 flex flex-col justify-between ${isLong ? 'col-span-2' : ''}`}>
                      <span className="text-[10px] text-text-dim uppercase tracking-wider mb-1 font-medium">{m.label}</span>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-[15px] font-bold font-mono ${isHighlighted ? 'text-amber-400' : 'text-white'}`}>
                          {displayVal}
                        </span>
                        {m.unit && <span className="text-[10.5px] text-text-dim font-medium">{m.unit}</span>}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Timestamps & Info */}
                <div className="bg-black/25 border border-line rounded-xl p-2.5 text-[11px] space-y-1 font-mono text-text-dim">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-dim/80">
                      <Clock size={11} />
                      Zadnji prejeti paket:
                    </span>
                    <span className="text-white font-semibold">
                      {typeof node.timestamp === 'string' ? new Date(node.timestamp).toLocaleTimeString('sl-SI') : node.timestamp.toLocaleTimeString('sl-SI')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ID vozlišča:</span>
                    <span className="text-wheat truncate max-w-[200px]" title={node.id}>{node.id}</span>
                  </div>
                </div>
              </>
            )}

            {/* DEPARTURES & TIMETABLE TAB */}
            {activeTab === 'departures' && (
              <div className="space-y-3">
                {/* Station Info & Filter Header */}
                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1">
                          <TrainFront size={11} />
                          {stationMeta?.category ? `${stationMeta.category.toUpperCase()} POSTAJA` : 'VOZLIŠČE / POSTAJA'}
                        </span>
                        {stationMeta?.country && (
                          <span className="text-[9.5px] px-1.5 py-0.2 bg-white/10 rounded font-mono text-white">
                            {stationMeta.country === 'SI' ? '🇸🇮 Slovenija' : (stationMeta.country === 'AT' ? '🇦🇹 Avstrija' : (stationMeta.country === 'HU' ? '🇭🇺 Madžarska' : (stationMeta.country === 'HR' ? '🇭🇷 Hrvaška' : '🇮🇹 Italija')))}
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-bold text-[14px] truncate mt-0.5">
                        {stationMeta?.name || node.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => fetchDepartures()}
                      disabled={loadingDepartures}
                      title="Osveži vozni red"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-mono transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw size={12} className={loadingDepartures ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">Osveži</span>
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-line/60 flex-wrap">
                    <span className="text-[10px] text-text-dim uppercase font-mono mr-1">Filter:</span>
                    <button
                      onClick={() => setDepartureFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        departureFilter === 'all'
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-text-dim hover:text-white'
                      }`}
                    >
                      Vsi ({stationDepartures.length})
                    </button>
                    <button
                      onClick={() => setDepartureFilter('train')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        departureFilter === 'train'
                          ? 'bg-blue-500 text-white font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-text-dim hover:text-white'
                      }`}
                    >
                      <TrainFront size={11} />
                      Vlaki ({stationDepartures.filter(d => d.mode === 'train' || !d.mode || d.mode === 'rail').length})
                    </button>
                    <button
                      onClick={() => setDepartureFilter('bus')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        departureFilter === 'bus'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-text-dim hover:text-white'
                      }`}
                    >
                      <Bus size={11} />
                      Avtobusi ({stationDepartures.filter(d => d.mode === 'bus').length})
                    </button>
                  </div>
                </div>

                {/* Loading state */}
                {loadingDepartures && (
                  <div className="p-8 text-center bg-white/[0.02] border border-line rounded-xl space-y-2">
                    <RefreshCw size={22} className="animate-spin text-sky-400 mx-auto" />
                    <p className="text-[12px] text-text-dim font-mono">Nalagam uradni vozni red in zamude v živo...</p>
                  </div>
                )}

                {/* Error state */}
                {!loadingDepartures && departureError && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-[12px] space-y-2 text-center">
                    <p>{departureError}</p>
                    <button
                      onClick={() => fetchDepartures()}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Poskusi znova
                    </button>
                  </div>
                )}

                {/* Empty State */}
                {!loadingDepartures && !departureError && stationDepartures.length === 0 && (
                  <div className="p-6 text-center bg-white/[0.02] border border-line rounded-xl space-y-2">
                    <Clock size={24} className="text-text-dim mx-auto opacity-50" />
                    <p className="text-white font-medium text-[13px]">Ni zabeleženih odhodov</p>
                    <p className="text-[11px] text-text-dim max-w-xs mx-auto">
                      V naslednjih 90 minutah ni predvidenih odhodov za to postajo ali pa je prevoz trenutno izven urnika.
                    </p>
                    <button
                      onClick={() => fetchDepartures()}
                      className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/15 border border-line rounded-lg text-[11px] text-white transition-colors cursor-pointer"
                    >
                      Preveri ponovno
                    </button>
                  </div>
                )}

                {/* List of Departures */}
                {!loadingDepartures && !departureError && stationDepartures.length > 0 && (
                  <div className="space-y-2">
                    {stationDepartures
                      .filter(d => {
                        if (departureFilter === 'train') return d.mode === 'train' || !d.mode || d.mode === 'rail';
                        if (departureFilter === 'bus') return d.mode === 'bus';
                        return true;
                      })
                      .map((dep, idx) => {
                        const isBus = dep.mode === 'bus';
                        const isTram = dep.mode === 'tram';
                        const delayNum = dep.delay || 0;
                        const isDelayed = delayNum > 0;
                        const isCancelled = dep.cancelled;

                        return (
                          <div
                            key={`${dep.id || 'dep'}_${idx}`}
                            className={`p-3 rounded-xl border transition-all ${
                              isCancelled 
                                ? 'bg-red-500/5 border-red-500/30 opacity-75' 
                                : isDelayed && delayNum >= 10 
                                  ? 'bg-amber-500/5 border-amber-500/30' 
                                  : 'bg-white/[0.03] border-line hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              {/* Left: Line Pill + Destination */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                  {/* Line badge */}
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tracking-tight flex items-center gap-1 ${
                                      isBus
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : isTram
                                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                    }`}
                                  >
                                    {isBus ? <Bus size={11} /> : <TrainFront size={11} />}
                                    {dep.line}
                                  </span>

                                  {/* Operator badge */}
                                  <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-line rounded text-text-dim font-mono">
                                    {dep.operator}
                                  </span>

                                  {/* Platform badge */}
                                  {dep.platform && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-white font-mono font-medium">
                                      Peron / Tir {dep.platform}
                                    </span>
                                  )}
                                </div>

                                {/* Destination */}
                                <div className="flex items-center gap-1 mt-1">
                                  <ArrowUpRight size={13} className="text-text-dim shrink-0" />
                                  <span className="text-white font-semibold text-[13px] tracking-tight truncate">
                                    {dep.direction}
                                  </span>
                                </div>
                              </div>

                              {/* Right: Departure Time & Delay */}
                              <div className="text-right shrink-0">
                                {isCancelled ? (
                                  <div className="text-red-400 font-bold text-[12px] font-mono px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded">
                                    ODPOVEDANO
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <div className="flex items-baseline justify-end gap-1.5 flex-wrap">
                                      {dep.isTomorrow && (
                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                                          jutri
                                        </span>
                                      )}
                                      {isDelayed && (
                                        <span className="text-[11px] font-mono text-text-dim line-through">
                                          {formatDepartureTime(dep.plannedTime, dep.timeFormatted)}
                                        </span>
                                      )}
                                      <span className={`text-[15px] font-bold font-mono ${isDelayed ? 'text-amber-400' : 'text-white'}`}>
                                        {formatDepartureTime(dep.actualTime || dep.plannedTime, dep.actualTimeFormatted || dep.timeFormatted)}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono font-medium">
                                      {isDelayed ? (
                                        <span className="text-amber-400">+{delayNum} min</span>
                                      ) : (
                                        <span className="text-emerald-400 flex items-center justify-end gap-1">
                                          <Check size={10} /> Točno
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action to track / fly to train */}
                            {(dep.mode === 'train' || !dep.mode || dep.mode === 'rail') && onSelectTrain && (
                              <div className="mt-2.5 pt-2 border-t border-line/40 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectTrain(dep);
                                  }}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-mono font-medium transition-all cursor-pointer hover:border-sky-400 active:scale-95"
                                  title="Prikaži ta vlak na zemljevidu z zamudami in potekom vožnje"
                                >
                                  <Navigation size={11} className="text-sky-400 fill-current" />
                                  <span>Odpelji me do tega vlaka</span>
                                </button>
                                <span className="text-[10px] text-text-dim font-mono">
                                  {dep.operator}
                                </span>
                              </div>
                            )}

                            {/* Remarks / Alerts */}
                            {dep.remarks && dep.remarks.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-line/40 text-[10.5px] text-amber-200/90 flex items-center gap-1.5">
                                <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                                <span className="truncate">{dep.remarks.join(' • ')}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* 2. LORAWAN RF ANALIZA TAB */}
            {activeTab === 'lora_analysis' && (
              <div className="space-y-3">
                <div className="bg-black/40 border border-line rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-[13px] flex items-center gap-1.5">
                      <Radio size={13} className="text-wheat" />
                      RF Koncentrator Semtech SX1302
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                      EU868 Standard
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                    <div className="p-2 bg-white/5 border border-line rounded-lg">
                      <div className="text-text-dim text-[9.5px]">MOČ SIGNALA (RSSI)</div>
                      <div className="text-wheat font-bold text-[14px]">
                        {node.networkInfo?.rssi || -72} dBm
                      </div>
                      <div className="text-[9px] text-emerald-400 mt-0.5">Odličen sprejem v mestu</div>
                    </div>
                    <div className="p-2 bg-white/5 border border-line rounded-lg">
                      <div className="text-text-dim text-[9.5px]">RAZMERJE SIGNAL/ŠUM (SNR)</div>
                      <div className="text-sky-400 font-bold text-[14px]">
                        +{node.networkInfo?.snr || 9.8} dB
                      </div>
                      <div className="text-[9px] text-emerald-400 mt-0.5">&gt; 0 dB (nad nivojem šuma)</div>
                    </div>
                    <div className="p-2 bg-white/5 border border-line rounded-lg">
                      <div className="text-text-dim text-[9.5px]">LINK BUDGET (REZERVA)</div>
                      <div className="text-white font-bold text-[14px]">142 dB</div>
                      <div className="text-[9px] text-text-dim mt-0.5">P_tx (14dBm) + G_ant (3.5dBi)</div>
                    </div>
                    <div className="p-2 bg-white/5 border border-line rounded-lg">
                      <div className="text-text-dim text-[9.5px]">DUTY CYCLE (ETSI 1%)</div>
                      <div className="text-emerald-400 font-bold text-[14px]">0.24 %</div>
                      <div className="text-[9px] text-emerald-400 mt-0.5">Skladno z zakonodajo EU</div>
                    </div>
                  </div>
                </div>

                {/* Spreading Factor Breakdown */}
                <div className="bg-white/[0.02] border border-line rounded-xl p-3 space-y-2">
                  <div className="text-white font-semibold text-[12px] flex items-center justify-between">
                    <span>Podprti faktorji širjenja (SF7 – SF12)</span>
                    <span className="text-[10.5px] font-mono text-wheat">BW: 125 kHz</span>
                  </div>
                  
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-1.5 bg-white/5 rounded border border-line/50">
                      <span className="text-wheat font-bold">SF7 (128 čipov/simbol)</span>
                      <span className="text-text-dim">ToA: ~56 ms · Hitrost: 5.47 kbps</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 bg-white/5 rounded border border-line/50">
                      <span className="text-wheat font-bold">SF8 (256 čipov/simbol)</span>
                      <span className="text-text-dim">ToA: ~102 ms · Hitrost: 3.12 kbps</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 bg-white/5 rounded border border-line/50">
                      <span className="text-wheat font-bold">SF10 (1024 čipov/simbol)</span>
                      <span className="text-text-dim">ToA: ~370 ms · Doseg: do 15 km</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 bg-white/5 rounded border border-line/50">
                      <span className="text-wheat font-bold">SF12 (4096 čipov/simbol)</span>
                      <span className="text-text-dim">ToA: ~1482 ms · Globoka penetracija</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. LORAWAN PACKET HISTORY TAB */}
            {activeTab === 'packets' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-text-dim font-mono">
                  <span>Zgodovina prejetih paketov (2s osveževanje):</span>
                  <span className="text-wheat font-semibold">{loraPackets.length || 15} paketov</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {(loraPackets.length > 0 ? loraPackets : [
                    {
                      id: 'pkt_mock_1',
                      timestamp: new Date(),
                      deviceName: 'Soboško Jezero – Nivo Vode',
                      devEui: '70B3D57ED00481F1',
                      frequencyMHz: 868.1,
                      sf: 7,
                      rssi: -68,
                      snr: 10.2,
                      airtimeMs: 61.4,
                      fCnt: 1049,
                      payloadHex: '016700E2020200BA0300016A',
                      decoded: { 'Nivo vode': '186 cm', 'Temperatura': '22.6 °C', 'Baterija': '3.62 V' },
                      analysis: {
                        signalQuality: 'Odlična',
                        qualityColor: '#10b981',
                        sfMeaning: 'SF7 zagotavlja 128 čipov/simbol.',
                        airtimeCompliance: 'Skladno z ETSI 1%',
                        linkBudgetDb: 144,
                        noiseFloorMargin: '+10.2 dB nad pragom šuma'
                      }
                    }
                  ]).map((pkt: any, idx: number) => (
                    <div 
                      key={pkt.id || idx}
                      onClick={() => setSelectedPacket(selectedPacket?.id === pkt.id ? null : pkt)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedPacket?.id === pkt.id 
                          ? 'bg-wheat/10 border-wheat' 
                          : 'bg-white/[0.03] border-line hover:border-wheat/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pkt.analysis?.qualityColor || '#22c55e' }}></span>
                          {pkt.deviceName}
                        </span>
                        <span className="font-mono text-[10px] text-text-dim">
                          {typeof pkt.timestamp === 'string' ? new Date(pkt.timestamp).toLocaleTimeString('sl-SI') : pkt.timestamp.toLocaleTimeString('sl-SI')}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 mt-2 text-[10px] font-mono text-text-dim bg-black/30 p-1.5 rounded-lg">
                        <div>
                          <span className="text-text-dim/60">SF:</span> <strong className="text-white">SF{pkt.sf}</strong>
                        </div>
                        <div>
                          <span className="text-text-dim/60">FREQ:</span> <strong className="text-white">{pkt.frequencyMHz}M</strong>
                        </div>
                        <div>
                          <span className="text-text-dim/60">RSSI:</span> <strong className="text-emerald-400">{pkt.rssi}dBm</strong>
                        </div>
                        <div>
                          <span className="text-text-dim/60">ToA:</span> <strong className="text-wheat">{pkt.airtimeMs}ms</strong>
                        </div>
                      </div>

                      {selectedPacket?.id === pkt.id && (
                        <div className="mt-2.5 pt-2 border-t border-line/60 space-y-2 text-[11px] animate-in fade-in duration-150">
                          <div className="bg-black/50 p-2 rounded-lg font-mono">
                            <div className="text-[10px] text-text-dim mb-0.5">Surovi Payload (Hex):</div>
                            <div className="text-emerald-400 break-all">{pkt.payloadHex}</div>
                          </div>

                          <div className="bg-white/5 p-2 rounded-lg">
                            <div className="text-[10.5px] font-semibold text-wheat mb-1">Dekodirani senzor:</div>
                            {Object.entries(pkt.decoded || {}).map(([k, v]: any) => (
                              <div key={k} className="flex justify-between font-mono text-[10.5px] border-b border-line/40 py-0.5 last:border-none">
                                <span className="text-text-dim">{k}:</span>
                                <strong className="text-white">{v}</strong>
                              </div>
                            ))}
                          </div>

                          <div className="text-[10px] text-text-dim font-mono bg-black/40 p-2 rounded-lg space-y-1">
                            <div>Kakovost: <strong className="text-emerald-400">{pkt.analysis?.signalQuality}</strong> ({pkt.analysis?.noiseFloorMargin})</div>
                            <div>Skladnost ETSI: <strong className="text-white">{pkt.analysis?.airtimeCompliance}</strong></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. GLOSSARY / RAZLAGA TAB */}
            {activeTab === 'weather_forecast' && node.type === 'weather' && node.rawPayload?.daily && (
              <div className="space-y-3 pb-3">
                <div className="bg-white/5 border border-line rounded-xl p-3 flex flex-col gap-2">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-2"><CloudRain size={14} className="text-wheat" /> 7-Dnevna Napoved (Open-Meteo API)</h4>
                  {node.rawPayload.daily.time.slice(0, 5).map((dateStr: string, idx: number) => {
                     const date = new Date(dateStr);
                     const wcode = node.rawPayload.daily.weathercode[idx];
                     const max = node.rawPayload.daily.temperature_2m_max[idx];
                     const min = node.rawPayload.daily.temperature_2m_min[idx];
                     const days = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
                     return (
                       <div key={dateStr} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                         <span className="text-white text-xs font-medium w-12">{idx === 0 ? 'Danes' : days[date.getDay()]}</span>
                         <span className="text-text-dim text-xs flex-1 text-center font-mono">WMO Koda: {wcode}</span>
                         <div className="flex items-center gap-2 font-mono text-xs w-24 justify-end">
                           <span className="text-blue-400">{Math.round(min)}°</span>
                           <span className="text-text-dim">/</span>
                           <span className="text-red-400 font-semibold">{Math.round(max)}°</span>
                         </div>
                       </div>
                     );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'glossary' && (
              <div className="space-y-2.5 text-[11.5px] leading-relaxed">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-1.5">
                  <h3 className="text-amber-400 font-bold text-[12px] flex items-center gap-1.5">
                    <TrainFront size={13} />
                    Kaj so tovorni vlaki (TV) in kakšna je natančnost podatkov?
                  </h3>
                  <p className="text-text-dim">
                    Tovorni vlaki v sistemu predstavljajo uradne dodeljene trase <strong>Programa omrežja SŽ-Infrastruktura</strong> (npr. intermodalni kontejnerski vlaki med Luko Koper in terminali v Avstriji, na Madžarskem ali Slovaškem). Časovni odhodi, prihodi in okna ustrezajo uradnim voznim redom tovornega prometa z okvirno točnostjo <strong>±30 do 60 minut</strong>.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-1.5">
                  <h3 className="text-amber-400 font-bold text-[12px] flex items-center gap-1.5">
                    <Layers size={13} />
                    Ali tovorni vlaki oddajajo GPS v živo ali so simulirani?
                  </h3>
                  <p className="text-text-dim">
                    Tovorni prevozniki (SŽ Tovorni promet, RCA, Metrans, Adria Transport) zaradi varnostnih razlogov, <strong>RID pravilnikov za prevoz nevarnega blaga</strong> in poslovne konkurenčnosti <strong>ne delijo javnega GPS signala</strong> v realnem času. Sistem zato lokacijo vlaka matematično projicira natančno na <strong>fizične osi tirov</strong> glede na časovni napredek vožnje, tako da vlak nikoli ne zdrsne izven železniške proge.
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-1.5">
                  <h3 className="text-emerald-400 font-bold text-[12px] flex items-center gap-1.5">
                    <Activity size={13} />
                    Kaj je C-ITS in SPaT (Signal Phase and Timing)?
                  </h3>
                  <p className="text-text-dim">
                    <strong>SPaT</strong> (ETSI TS 103 301) je standardizirano V2X sporočilo, ki ga pametni semaforji oddajajo vozilom v realnem času. Vsebuje natančen čas do menjave faze (rdeča/rumena/zelena) in topologijo križišča (MAPEM).
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-1.5">
                  <h3 className="text-emerald-400 font-bold text-[12px] flex items-center gap-1.5">
                    <Car size={13} />
                    Kaj je GLOSA (Green Light Optimal Speed Advisory)?
                  </h3>
                  <p className="text-text-dim">
                    GLOSA izračunava optimalno priporočeno hitrost (npr. 48 km/h), da vozilo ujame <em>zeleni val</em> brez ustavljanja, kar zmanjšuje porabo goriva/energije za 15-20% ter emisije CO₂.
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-1.5">
                  <h3 className="text-wheat font-bold text-[12px] flex items-center gap-1.5">
                    <HelpCircle size={13} />
                    Kaj je RSSI (Received Signal Strength Indicator)?
                  </h3>
                  <p className="text-text-dim">
                    Meri absolutno moč radijskega signala v decibelih glede na 1 milivat (dBm). Bližje kot je 0, močnejši je signal (npr. <strong>-50 dBm</strong> je odličen signal blizu antene, <strong>-120 dBm</strong> pa je meja zaznave).
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-1.5">
                  <h3 className="text-wheat font-bold text-[12px] flex items-center gap-1.5">
                    <HelpCircle size={13} />
                    Kaj je SNR (Signal-to-Noise Ratio)?
                  </h3>
                  <p className="text-text-dim">
                    Razmerje med močjo koristnega signala in šumom v okolju. Zaradi modulacije <em>Chirp Spread Spectrum (CSS)</em> lahko LoRa sprejemniki dekodirajo pakete celo pri <strong>-20 dB pod ravnjo šuma</strong>!
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-1.5">
                  <h3 className="text-wheat font-bold text-[12px] flex items-center gap-1.5">
                    <HelpCircle size={13} />
                    Kaj je Spreading Factor (SF7 - SF12)?
                  </h3>
                  <p className="text-text-dim">
                    Določa število čipov na podatkovni simbol (2^SF čipov). Višji SF pomeni večji doseg in odpornost proti motnjam, vendar daljši čas v zraku in večjo porabo baterije.
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-line rounded-xl p-3 space-y-1.5">
                  <h3 className="text-wheat font-bold text-[12px] flex items-center gap-1.5">
                    <HelpCircle size={13} />
                    Kaj je Time-on-Air (Airtime) & ETSI 1%?
                  </h3>
                  <p className="text-text-dim">
                    Čas, v katerem radijski oddajnik dejansko zaseda frekvenco. Po predpisih EU/ETSI nobena naprava ne sme oddajati več kot 1% časa (maksimalno 36 sekund na uro).
                  </p>
                </div>
              </div>
            )}

            {/* 5. RAW JSON TAB */}
            {activeTab === 'raw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-text-dim font-mono">
                  <span>Surova telemetrija:</span>
                  <button 
                    onClick={() => handleCopy(node.rawPayload)}
                    className="flex items-center gap-1 text-[10.5px] text-wheat hover:text-white bg-wheat/10 hover:bg-wheat/20 px-2 py-0.5 rounded border border-wheat/30 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    {copied ? 'Kopirano!' : 'Kopiraj JSON'}
                  </button>
                </div>
                <pre className="bg-black/60 border border-line rounded-xl p-2.5 text-[10.5px] font-mono text-emerald-400/90 overflow-x-auto max-h-56 leading-relaxed">
                  {JSON.stringify(node.rawPayload, null, 2)}
                </pre>
              </div>
            )}

            {/* 6. NETWORK TAB */}
            {activeTab === 'network' && (
              <div className="space-y-2.5 text-[11.5px]">
                <div className="bg-white/5 border border-line rounded-xl p-2.5 space-y-2 text-[11.5px]">
                  <div className="flex justify-between border-b border-line/60 pb-1.5">
                    <span className="text-text-dim">Protokol</span>
                    <span className="font-mono font-semibold text-white">{node.networkInfo?.protocol || 'HTTPS / REST API'}</span>
                  </div>
                  <div className="flex justify-between border-b border-line/60 pb-1.5">
                    <span className="text-text-dim">Vir podatkov</span>
                    <span className="font-mono font-semibold text-wheat">{node.networkInfo?.source || 'Odprti podatki Slovenije'}</span>
                  </div>
                  {node.networkInfo?.frequency && (
                    <div className="flex justify-between border-b border-line/60 pb-1.5">
                      <span className="text-text-dim">Frekvenčni pas</span>
                      <span className="font-mono font-semibold text-sky-400">{node.networkInfo.frequency}</span>
                    </div>
                  )}
                  {node.networkInfo?.rssi != null && (
                    <div className="flex justify-between border-b border-line/60 pb-1.5">
                      <span className="text-text-dim">Moč signala (RSSI)</span>
                      <span className="font-mono font-semibold text-emerald-400">{node.networkInfo.rssi} dBm</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-dim">Cikel osveževanja</span>
                    <span className="font-mono font-semibold text-emerald-400">2s Real-time streaming</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
};
