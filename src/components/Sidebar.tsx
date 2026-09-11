import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, ChevronUp, ChevronRight, Radio, Activity, Navigation, 
  LocateFixed, Sun, Moon, Sparkles, Terminal, Globe,
  Package, Compass, BarChart3
} from 'lucide-react';
import { LAYER_META, MapController } from '../lib/MapController';
import { AppState } from '../types';
import { DeveloperDocsModal } from './DeveloperDocsModal';
import { Code, Clock, Train, Bus, AlertCircle, Zap, ShieldCheck, Bike, Car, MapPin, Timer } from 'lucide-react';

const CATEGORIES = [
  { 
    name: 'Javni Avtobusni Promet (BrezAvta IJPP)', 
    keys: ['buses'], 
    icon: Bus,
    accent: '#10b981'
  },
  { 
    name: 'SŽ Potniški & Tovorni Promet (TEN-T)', 
    keys: ['sz_rail', 'orm', 'rinf_network', 'sz_stations', 'rinf', 'sz_crossings', 'delays_heatmap', 'transit', 'eurorail', 'rail_sensors', 'hafas', 'yard', 'tent_railways'], 
    icon: Train,
    accent: '#38bdf8'
  },
  { 
    name: 'Dostava, Paketi & Droni (UAV)', 
    keys: ['drones', 'logistics_hubs', 'trajectories', 'logistics_sensors', 'warehouse', 'github'], 
    icon: Package,
    accent: '#ec4899'
  },
  { 
    name: 'C-ITS Semaforji & Promet (Siemens/DARS)', 
    keys: ['roads', 'traffic_counts', 'traffic_sensors', 'traffic'], 
    icon: Activity,
    accent: '#22c55e'
  },
  { 
    name: 'Mikromobilnost & EV Polnilnice', 
    keys: ['bikeshare', 'micromobility', 'evcharge'], 
    icon: Navigation,
    accent: '#84cc16'
  },
  { 
    name: 'IoT Senzorji & Okolje (ARSO/Nokia/Telekom)', 
    keys: ['hydro', 'arso', 'openaq', 'opensense', 'ttn', 'lorawan', 'nbiot', 'air', 'aprs', 'loramesh', 'sparql', 'sensorcommunity'], 
    icon: Radio,
    accent: '#f59e0b'
  },
  { 
    name: 'Letalstvo & Seizmologija (ADS-B)', 
    keys: ['aircraft', 'quakes'], 
    icon: Globe,
    accent: '#94a3b8'
  },
];

interface SidebarProps {
  appState: AppState | null;
  mapController: MapController | null;
  onSelectNode?: (node: any) => void;
  onOpenInsights?: () => void;
  onOpenFreightModal?: () => void;
  onToggleTelemetryStream?: () => void;
  isStreamOpen?: boolean;
  onToggleAnalytics?: () => void;
  analyticsOpen?: boolean;
}

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('sl-SI'));
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString('sl-SI')), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="text-text-dim/80">{time}</span>;
};

export const Sidebar: React.FC<SidebarProps> = React.memo(({ 
  appState, 
  mapController, 
  onSelectNode,
  onOpenInsights, 
  onOpenFreightModal,
  onToggleTelemetryStream,
  isStreamOpen,
  onToggleAnalytics,
  analyticsOpen
}) => {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(() => {
    const initial = Object.keys(LAYER_META).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>);
    return initial;
  });
  const [basemap, setBasemap] = useState<'dark' | 'light' | 'sat'>('dark');
  const [docsOpen, setDocsOpen] = useState(false);
  const [tripSubTab, setTripSubTab] = useState<'active' | 'completed'>('active');

  const handleToggleLayer = (key: string) => {
    const nextVal = !layerVisibility[key];
    setLayerVisibility(prev => ({ ...prev, [key]: nextVal }));
    if (mapController) {
      mapController.toggleLayer(key, nextVal);
    }
  };

  const handleSetBasemap = (type: 'dark' | 'light' | 'sat') => {
    setBasemap(type);
    if (mapController) {
      mapController.setBasemap(type);
    }
  };

  const handleFlyHome = () => {
    if (mapController) {
      mapController.flyHome();
    }
  };

  return (
    <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-84 max-h-[calc(100dvh-24px)] flex flex-col z-20 
                    bg-panel backdrop-blur-2xl border border-line rounded-2xl shadow-2xl
                    overflow-hidden transition-all duration-300">
      
      {/* Header */}
      <div className="p-3 sm:p-4 flex items-start justify-between gap-2 border-b border-line/60 bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[14px] sm:text-[15px] font-bold tracking-tight text-white m-0 leading-tight truncate">
              Live City · Murska Sobota
            </h1>
          </div>
          <p className="text-[11px] text-text-dim mt-0.5 mb-2 font-medium truncate">
            SŽ Vlaki · DPD/GLS Sledenje · C-ITS Semaforji
          </p>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase font-semibold text-mura tracking-wider">
            <span className="w-2 h-2 rounded-full bg-mura animate-pulse shadow-[0_0_10px_rgba(47,184,166,0.9)]"></span>
            <span>LIVE 2s</span>
            <LiveClock />
          </div>
        </div>
        {/* Control row. Touch targets are 32px on phones (28px from sm up) and
            the row never shrinks, so the buttons cannot be squeezed or overlapped
            by the heading beside them. */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleTelemetryStream}
            className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer focus:outline-none ${
              isStreamOpen
                ? 'bg-wheat text-ink border-wheat shadow-[0_0_8px_rgba(217,164,65,0.6)] font-bold'
                : 'border-line text-text-dim hover:text-white hover:border-white/25 bg-white/5'
            }`}
            title="Živi telemetrijski tok (Terminal)"
          >
            <Terminal size={14} />
          </button>
          <button
            onClick={onToggleAnalytics}
            className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer focus:outline-none ${
              analyticsOpen
                ? 'bg-wheat text-ink border-wheat shadow-[0_0_8px_rgba(217,164,65,0.6)]'
                : 'border-line text-text-dim hover:text-white hover:border-white/25 bg-white/5'
            }`}
            title="Analitika živih podatkov"
          >
            <BarChart3 size={14} />
          </button>
          <button
            onClick={onOpenInsights}
            className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-mura/20 border border-mura/30 text-mura hover:bg-mura/30 transition-colors cursor-pointer focus:outline-none"
            title="AI Prometna & Logistična Analitika"
          >
            <Sparkles size={14} />
          </button>
          <button
            onClick={handleFlyHome}
            className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-line text-text-dim hover:text-white hover:border-white/25 transition-colors cursor-pointer focus:outline-none"
            title="Centriraj na Mursko Soboto"
          >
            <LocateFixed size={14} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-line text-text-dim hover:text-white hover:border-white/25 transition-colors cursor-pointer focus:outline-none"
            title="Skrči/razširi"
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Basemap Switcher Strip */}
      {!collapsed && (
        <div className="px-4 py-2 bg-black/30 border-b border-line flex items-center justify-between text-[11px]">
          <span className="text-text-dim font-medium">Podlaga:</span>
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-line">
            <button
              onClick={() => handleSetBasemap('dark')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                basemap === 'dark' ? 'bg-white/20 text-white font-bold' : 'text-text-dim hover:text-white'
              }`}
            >
              <Moon size={11} /> Temna
            </button>
            <button
              onClick={() => handleSetBasemap('light')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                basemap === 'light' ? 'bg-white/20 text-white font-bold' : 'text-text-dim hover:text-white'
              }`}
            >
              <Sun size={11} /> Svetla
            </button>
            <button
              onClick={() => handleSetBasemap('sat')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                basemap === 'sat' ? 'bg-white/20 text-white font-bold' : 'text-text-dim hover:text-white'
              }`}
            >
              <Globe size={11} /> Satelit
            </button>
          </div>
        </div>
      )}

      {/* Layers Body */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* Tovorni promet & Luka Koper Quick Launcher */}
          {onOpenFreightModal && (() => {
            const runningFreight = appState?.freight?.filter((t: any) => t.isRunning) || [];
            const nearMsFreight = runningFreight.find((t: any) => 
              t.currentSection && (
                t.currentSection.toLowerCase().includes('murska') || 
                t.currentSection.toLowerCase().includes('lipovci') ||
                t.currentSection.toLowerCase().includes('puconci')
              )
            );

            return (
              <div className="p-2.5 border-b border-line/60 bg-gradient-to-r from-amber-500/10 to-sky-500/10">
                <button
                  onClick={onOpenFreightModal}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition-all flex items-center justify-between cursor-pointer group shadow-sm text-left"
                >
                  <div className="flex items-center gap-2 text-left">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/30 flex items-center justify-center text-amber-400 relative">
                      <Train size={13} />
                      {nearMsFreight && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                    <div>
                      <div className="text-[11.5px] font-bold text-white group-hover:text-amber-300 leading-tight flex items-center gap-1.5">
                        <span>Tovorni Promet & Luka Koper</span>
                        {nearMsFreight ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                            V ŽIVO
                          </span>
                        ) : runningFreight.length > 0 ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300">
                            {runningFreight.length} na tirih
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[9.5px] text-amber-400/80 font-mono">
                        {nearMsFreight 
                          ? `🚂 ${nearMsFreight.trainNumber}: ${nearMsFreight.currentSection || 'Murska Sobota'}`
                          : 'TEN-T RFC 5/6 · UIC'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-amber-400/70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })()}

          {/* DELAYS WIDGET INTEGRATED */}
          {appState?.hafas && appState.hafas.some(t => typeof t.delay === 'number' && t.delay > 0) && (
            <div className="border-b border-line/60 bg-red-500/5">
              <details className="group" open>
                <summary className="cursor-pointer p-2.5 pl-4 pr-3 list-none text-[10.5px] font-bold tracking-wider text-red-400 uppercase flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={13} className="shrink-0 animate-pulse" />
                    <span>Zamude Vlakov (SŽ)</span>
                  </div>
                  <ChevronDown size={13} className="group-open:rotate-180 transition-transform text-red-400/70" />
                </summary>
                <div className="pb-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {appState.hafas
                    .filter(t => typeof t.delay === 'number' && t.delay > 0)
                    .sort((a, b) => (b.delay || 0) - (a.delay || 0))

                    .map((train, idx) => {
                      let cleanName = train.name || '';
                      if (cleanName.startsWith('SŽ ')) cleanName = cleanName.substring(3);
                      return (
                        <div 
                          key={`${train.id || 'train'}_${idx}`}
                          className="px-4 py-1.5 hover:bg-white/10 cursor-pointer transition-colors flex items-center justify-between"
                          onClick={() => {
                            if (mapController) {
                              mapController.flyTo([train.lon, train.lat], 15.5);
                              mapController.setSearchLocation([train.lon, train.lat], cleanName);
                            }
                          }}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Train size={11} className="text-red-400/80" />
                              <span className="text-[11px] font-bold text-white/90">{cleanName}</span>
                            </div>
                            <div className="text-[9.5px] text-text-dim truncate max-w-[130px]">
                              {train.destination || 'Neznano'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                            <Clock size={10} />
                            +{train.delay} min
                          </div>
                        </div>
                      );
                  })}
                </div>
              </details>
            </div>
          )}
          
          <div className="pb-2">
            {CATEGORIES.map((cat) => (
              <details key={cat.name} className="border-b border-line/60 group" open>
                <summary className="cursor-pointer p-2.5 pl-4 pr-3 list-none text-[10.5px] font-semibold tracking-wider text-text-dim uppercase flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2" style={{ color: cat.accent }}>
                    <cat.icon size={13} className="shrink-0" />
                    <span className="text-white/90">{cat.name}</span>
                  </div>
                  <ChevronDown size={13} className="group-open:rotate-180 transition-transform text-text-dim" />
                </summary>
                <div className="pb-1.5 pt-0.5">
                  {cat.keys.map((k) => {
                    const m = LAYER_META[k];
                    if (!m) return null;
                    const count = appState?.counts?.[k] ?? '–';
                    const isLorawan = k === 'lorawan';
                    const lwOnline = appState?.onlineLorawan ?? 0;
                    
                    return (
                      <React.Fragment key={k}>
                        <label className="flex items-center gap-2.5 py-1 px-4 text-[12px] cursor-pointer hover:bg-white/5 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={layerVisibility[k] ?? true} 
                            onChange={() => handleToggleLayer(k)}
                            className="accent-wheat cursor-pointer w-3.5 h-3.5 focus:ring-1 focus:ring-focus focus:outline-none"
                          />
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor]" style={{ backgroundColor: m.color, color: m.color }}></span>
                          <span className="flex-1 truncate select-none text-text-main/90">{m.label}</span>
                          <span className="font-mono text-[11px] font-semibold text-text-dim min-w-[26px] text-right">
                            {isLorawan && count !== '–' ? `${count} (${lwOnline})` : count}
                          </span>
                        </label>

                        {/* 100% Real IJPP Buses Feed Badge */}
                        {k === 'buses' && (layerVisibility[k] ?? true) && (
                          <div className="mx-4 my-1.5 space-y-1.5">
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[10.5px]">
                              <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                                <span>100% Realni podatki (BrezAvta IJPP)</span>
                              </div>
                              <span className="font-mono text-[9.5px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300 font-semibold">
                                {count} vozil
                              </span>
                            </div>
                            <div className="px-2 py-1 text-[10px] text-text-dim flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
                              <span className="text-emerald-400">● LPP</span>
                              <span className="text-sky-400">● Nomago</span>
                              <span className="text-blue-400">● Arriva</span>
                              <span className="text-red-400">● Marprom</span>
                              <span className="text-amber-400">● AP MS</span>
                            </div>
                          </div>
                        )}

                        {/* 100% Real GBFS Feed Badge & Metoda C In-Trip Status */}
                        {k === 'micromobility' && (layerVisibility[k] ?? true) && (
                          <div className="mx-4 my-1.5 space-y-1.5">
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[10.5px]">
                              <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                                <span>100% Realni podatki (Nomago GBFS · Avant2Go · BrezAvta)</span>
                              </div>
                              <span className="font-mono text-[9.5px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300 font-semibold">
                                Brez simulacije
                              </span>
                            </div>

                            {/* Metoda C Trips Section (Active In-Trip & Completed Trips) */}
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[10.5px] space-y-2">
                              {/* Subtabs: Active vs Completed */}
                              <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-amber-500/20">
                                <button
                                  onClick={() => setTripSubTab('active')}
                                  className={`flex-1 py-1 px-1.5 rounded-md text-[9.5px] font-mono font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    tripSubTab === 'active'
                                      ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40 shadow-sm'
                                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  <span>V vožnji ({appState?.activeTrips?.length || 0})</span>
                                </button>
                                <button
                                  onClick={() => setTripSubTab('completed')}
                                  className={`flex-1 py-1 px-1.5 rounded-md text-[9.5px] font-mono font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    tripSubTab === 'completed'
                                      ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40 shadow-sm'
                                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                  <span>Zaključene ({appState?.completedTrips?.length || 0})</span>
                                </button>
                              </div>

                              {/* Active Trips Tab Content */}
                              {tripSubTab === 'active' && (
                                <>
                                  {appState?.activeTrips && appState.activeTrips.length > 0 ? (
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                                      {appState.activeTrips.map((trip) => {
                                        const formIcon = trip.form === 'CAR' ? <Car size={11} /> : trip.form === 'BICYCLE' ? <Bike size={11} /> : <Zap size={11} />;
                                        const netShort = trip.network ? trip.network.split('_')[0].toUpperCase() : 'BREZAVTA';
                                        const isSelected = mapController?.getSelectedTripId?.() === trip.id;

                                        return (
                                          <div
                                            key={trip.id || trip.vehicleId}
                                            onClick={() => {
                                              if (isSelected) {
                                                mapController?.clearSelectedTrip();
                                                if (onSelectNode) onSelectNode(null);
                                                return;
                                              }
                                              if (mapController) {
                                                mapController.selectTrip(trip);
                                              }
                                              if (onSelectNode) {
                                                const origLat = trip.originLat ?? trip.origin?.[0];
                                                const origLon = trip.originLon ?? trip.origin?.[1];
                                                const currLat = trip.currentLat ?? trip.lastLat ?? origLat;
                                                const currLon = trip.currentLon ?? trip.lastLon ?? origLon;
                                                onSelectNode({
                                                  id: String(trip.id),
                                                  type: 'micromobility_trip',
                                                  title: `⚡ ${trip.name || 'Vozilo v vožnji'}`,
                                                  category: '⚡ AKTIVNA VOŽNJA (METODA C)',
                                                  coordinates: [currLon, currLat],
                                                  timestamp: new Date(),
                                                  metrics: [
                                                    { label: 'Status vožnje', value: '⚡ AKTIVNA VOŽNJA V TEKU (In-Trip)', highlight: true },
                                                    { label: 'Vozilo / Model', value: trip.name || 'Mikromobilnost', highlight: true },
                                                    { label: 'Točka A (Začetek najema)', value: origLat && origLon ? `${origLat.toFixed(4)}°, ${origLon.toFixed(4)}°` : 'Zaznano v mapi', highlight: false },
                                                    { label: 'Točka B (Trenutna pozicija)', value: currLat && currLon ? `${currLat.toFixed(4)}°, ${currLon.toFixed(4)}°` : 'V gibanju', highlight: true },
                                                    { label: 'Trajanje najema', value: trip.durationFormatted || '< 1 min', highlight: true },
                                                    { label: 'Prevožena razdalja (ocena)', value: `${trip.estimatedDistanceKm || 0} km`, highlight: true },
                                                    { label: 'Hitrost premikanja', value: `${Math.round(trip.speedKmH || 14)} km/h`, highlight: false }
                                                  ],
                                                  rawPayload: trip
                                                });
                                              }
                                            }}
                                            className={`p-1.5 rounded-lg border transition-all cursor-pointer font-mono text-[10px] ${
                                              isSelected
                                                ? 'bg-amber-500/20 border-amber-400 text-amber-100 shadow-sm'
                                                : 'bg-black/40 hover:bg-black/70 border-amber-500/20 hover:border-amber-400/50 text-zinc-200'
                                            }`}
                                            title="Kliknite za prikaz trase (Točka A ➔ Točka B) in telemetrije"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 truncate">
                                                <span className="text-amber-400 shrink-0">{formIcon}</span>
                                                <span className="truncate font-semibold">{trip.name || `${netShort} #${trip.vehicleId.slice(-6)}`}</span>
                                              </div>
                                              <div className="flex items-center gap-1 text-amber-300 shrink-0 font-bold">
                                                <Timer size={10} />
                                                <span>{trip.durationFormatted}</span>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[9px] text-zinc-400 mt-1 pt-1 border-t border-amber-500/15">
                                              <span className="flex items-center gap-1">
                                                <span className="text-emerald-400 font-bold">A</span>
                                                <span>➔</span>
                                                <span className="text-amber-400 font-bold">V vožnji (B)</span>
                                              </span>
                                              <span className="text-amber-300 font-semibold">{trip.estimatedDistanceKm || 0} km</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[9.5px] font-mono text-text-dim leading-tight">
                                      Diferencialni detektor spremlja odklepe koles, skirojev in e-vozil v realnem času.
                                    </p>
                                  )}
                                </>
                              )}

                              {/* Completed Trips Tab Content */}
                              {tripSubTab === 'completed' && (
                                <>
                                  {appState?.completedTrips && appState.completedTrips.length > 0 ? (
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                                      {appState.completedTrips.map((trip) => {
                                        const formIcon = trip.form === 'CAR' ? <Car size={11} /> : trip.form === 'BICYCLE' ? <Bike size={11} /> : <Zap size={11} />;
                                        const isSelected = mapController?.getSelectedTripId?.() === trip.id;
                                        const origLat = trip.origin?.[0] ?? trip.originLat;
                                        const origLon = trip.origin?.[1] ?? trip.originLon;
                                        const destLat = trip.destination?.[0] ?? trip.destLat;
                                        const destLon = trip.destination?.[1] ?? trip.destLon;
                                        const durMin = trip.durationSeconds ? Math.round(trip.durationSeconds / 60) : 0;

                                        return (
                                          <div
                                            key={trip.id}
                                            onClick={() => {
                                              if (isSelected) {
                                                mapController?.clearSelectedTrip();
                                                if (onSelectNode) onSelectNode(null);
                                                return;
                                              }
                                              if (mapController) {
                                                mapController.selectTrip(trip);
                                              }
                                              if (onSelectNode) {
                                                onSelectNode({
                                                  id: String(trip.id),
                                                  type: 'micromobility_trip',
                                                  title: `🏁 ${trip.name || 'Zaključena pot'}`,
                                                  category: '🏁 ZAKLJUČENA POT (ARHIV)',
                                                  coordinates: [destLon, destLat],
                                                  timestamp: new Date(),
                                                  metrics: [
                                                    { label: 'Status poti', value: '🏁 ZAKLJUČENA VOŽNJA (Izvor ➔ Ponovna prijava)', highlight: true },
                                                    { label: 'Vozilo / Sistem', value: trip.name, highlight: true },
                                                    { label: 'Točka A (Izhodišče / Začetek)', value: `${origLat?.toFixed(4)}°, ${origLon?.toFixed(4)}°`, highlight: false },
                                                    { label: 'Točka B (Cilj / Zaklep)', value: `${destLat?.toFixed(4)}°, ${destLon?.toFixed(4)}°`, highlight: true },
                                                    { label: 'Skupna razdalja', value: `${trip.distanceKm} km`, highlight: true },
                                                    { label: 'Čas trajanja najema', value: `${durMin} min`, highlight: false },
                                                    { label: 'Povprečna hitrost', value: `${trip.avgSpeedKmH} km/h`, highlight: false }
                                                  ],
                                                  rawPayload: trip
                                                });
                                              }
                                            }}
                                            className={`p-1.5 rounded-lg border transition-all cursor-pointer font-mono text-[10px] ${
                                              isSelected
                                                ? 'bg-sky-500/20 border-sky-400 text-sky-100 shadow-sm'
                                                : 'bg-black/40 hover:bg-black/70 border-sky-500/20 hover:border-sky-400/50 text-zinc-200'
                                            }`}
                                            title="Kliknite za prikaz celotne trase (Točka A ➔ Točka B) na karti"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 truncate">
                                                <span className="text-sky-400 shrink-0">{formIcon}</span>
                                                <span className="truncate font-semibold">{trip.name}</span>
                                              </div>
                                              <span className="text-sky-300 font-bold shrink-0">{trip.distanceKm} km</span>
                                            </div>

                                            <div className="flex items-center justify-between text-[9px] text-zinc-400 mt-1 pt-1 border-t border-sky-500/15">
                                              <span className="flex items-center gap-1">
                                                <span className="text-emerald-400 font-bold">A (Začetek)</span>
                                                <span>➔</span>
                                                <span className="text-rose-400 font-bold">B (Cilj)</span>
                                              </span>
                                              <span className="text-zinc-300">{durMin} min · {trip.avgSpeedKmH} km/h</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[9.5px] font-mono text-text-dim leading-tight">
                                      Ni še zabeleženih zaključenih voženj.
                                    </p>
                                  )}
                                </>
                              )}

                              {mapController?.getSelectedTripId?.() && (
                                <button
                                  onClick={() => {
                                    if (mapController) {
                                      mapController.clearSelectedTrip();
                                    }
                                  }}
                                  className="w-full py-1 rounded bg-black/40 hover:bg-black/60 border border-zinc-700 text-zinc-300 hover:text-white text-[9px] font-mono transition-colors cursor-pointer"
                                >
                                  Počisti izbrano traso
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>

          {/* Status and Telemetry summary */}
          <div className="bg-black/25 p-3 px-4 text-[11px] text-text-dim font-medium leading-relaxed space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-wheat font-semibold">Zadnja osvežitev podatkov:</span>
              <span className="text-white">
                {appState?.lastUpdate ? appState.lastUpdate.toLocaleTimeString('sl-SI') : 'Nalaganje...'}
              </span>
            </div>
            
            <div className="text-[10px] text-text-dim/80 pt-1 border-t border-line/40 flex items-center justify-between">
              <span>Kliknite na katerikoli element za <strong>surovo telemetrijo</strong>.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
