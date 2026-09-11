import { useEffect, useRef, useState, useCallback } from 'react';
import { MapController } from './lib/MapController';
import { Sidebar } from './components/Sidebar';
import { AiInsights } from './components/AiInsights';
import { TelemetryInspector } from './components/TelemetryInspector';
import { LiveTelemetryStream } from './components/LiveTelemetryStream';
import { SearchBar } from './components/SearchBar';
import { AlertSystem } from './components/AlertSystem';
import { FreightIntelligenceModal } from './components/FreightIntelligenceModal';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { AppState, TelemetryNode, TelemetryLogEntry } from './types';
import { Loader2, Radio, Train, Activity, Terminal, Anchor, Bus } from 'lucide-react';

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapController, setMapController] = useState<MapController | null>(null);
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [freightModalOpen, setFreightModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TelemetryNode | null>(null);
  const [isStreamOpen, setIsStreamOpen] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([]);

  // Ref buffer for telemetry logs to prevent re-render thrashing
  const logBufferRef = useRef<TelemetryLogEntry[]>([]);

  // Safety net: never trap the user on the loading overlay. The overlay is
  // normally dismissed by the first telemetry broadcast, but if the map or its
  // data pipeline stalls (e.g. a basemap CDN hiccup), force it away so the map
  // and controls become usable instead of showing an indefinite spinner.
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 20000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isStreamOpen) return;

    // Flush buffered logs immediately upon opening the terminal stream
    if (logBufferRef.current.length > 0) {
      const buffered = logBufferRef.current;
      logBufferRef.current = [];
      setTelemetryLogs((prev) => [...buffered, ...prev].slice(0, 100));
    }

    // Flush buffered telemetry logs at a smooth 1.2s cadence only when stream is open
    const flushInterval = setInterval(() => {
      if (logBufferRef.current.length > 0) {
        const buffered = logBufferRef.current;
        logBufferRef.current = [];
        setTelemetryLogs((prev) => [...buffered, ...prev].slice(0, 100));
      }
    }, 1200);

    return () => clearInterval(flushInterval);
  }, [isStreamOpen]);

  useEffect(() => {
    if (!mapContainer.current) return;

    const controller = new MapController(
      mapContainer.current, 
      (state) => {
        setAppState(prev => {
          const base: AppState = prev || {
            counts: {},
            onlineLorawan: 0,
            errors: [],
            lastUpdate: null,
            osmIsLive: true,
            activeTrips: [],
            completedTrips: [],
            micromobilityStats: null
          };
          const prevC = base.counts || {};
          const nextC = state?.counts || {};
          if (
            prev &&
            prevC.buses === nextC.buses &&
            prevC.transit === nextC.transit &&
            prevC.hafas === nextC.hafas &&
            prevC.aircraft === nextC.aircraft &&
            prevC.freight_trains === nextC.freight_trains &&
            prev.onlineLorawan === state.onlineLorawan &&
            prev.error === state.error &&
            !state.activeTrips &&
            !state.completedTrips
          ) {
            return prev;
          }
          return {
            ...base,
            ...state,
            activeTrips: state.activeTrips || base.activeTrips,
            completedTrips: state.completedTrips || base.completedTrips,
            counts: {
              ...prevC,
              ...nextC
            }
          };
        });
        setLoading(false);
      },
      (node) => {
        setSelectedNode(prev => {
          if (!prev || !node) return node;
          if (
            prev.id === node.id &&
            prev.type === node.type &&
            prev.coordinates[0] === node.coordinates[0] &&
            prev.coordinates[1] === node.coordinates[1] &&
            prev.status === node.status
          ) {
            return prev;
          }
          return node;
        });
      },
      (log) => {
        // Enqueue into buffer instead of triggering immediate state setter
        logBufferRef.current.unshift(log);
        if (logBufferRef.current.length > 100) {
          logBufferRef.current.length = 100;
        }
      }
    );

    setMapController(controller);

    return () => {
      controller.destroy();
    };
  }, []);

  const handleSelectLog = useCallback((log: TelemetryLogEntry) => {
    if (!mapController) return;
    const coords: [number, number] = log.raw?.lat != null && log.raw?.lon != null
      ? [log.raw.lon, log.raw.lat]
      : (log.coordinates || [16.166, 46.659]);
    
    mapController.flyTo(coords, 15.5);
    const layerType = log.type === 'train' ? 'transit' : (log.type === 'drone' ? 'drones' : log.type);
    const node = mapController.buildTelemetryNode(layerType, log.raw, coords);
    setSelectedNode(node);
  }, [mapController]);

  const handleFlyTo = useCallback((coords: [number, number], zoom = 15.5) => {
    if (mapController) {
      mapController.flyTo(coords, zoom);
    }
  }, [mapController]);

  const handleSelectTrain = useCallback((departure: any) => {
    if (mapController) {
      mapController.selectTrainFromDeparture(departure, selectedNode?.coordinates);
    }
  }, [mapController, selectedNode?.coordinates]);

  const handleHighlightRoute = useCallback((polyline: any) => {
    if (mapController) {
      mapController.highlightTripRoute(polyline);
    }
  }, [mapController]);

  const handleFlyHome = useCallback(() => {
    if (mapController) {
      mapController.flyHome();
    }
  }, [mapController]);

  const handleSelectLocation = useCallback((coords: [number, number], title: string, _zoom = 15.5) => {
    if (mapController) {
      mapController.setSearchLocation(coords, title);
      const node = mapController.buildTelemetryNode('location', { name: title, displayName: title }, coords);
      setSelectedNode(node);
    }
  }, [mapController]);

  const transitCount = appState?.counts?.transit || 0;
  const lorawanOnline = appState?.onlineLorawan || 0;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-ink select-none font-sans text-text-main">
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        id="map-container"
        className="absolute inset-0 z-0 outline-none w-full h-full" 
      />

      {/* Loading Overlay */}
      {appState?.error && <div className="absolute z-[9999] bg-red-900 text-white p-4 m-4 top-0 left-0 max-w-lg whitespace-pre-wrap">{appState.error}\n{appState.stack}</div>}
      {loading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-ink/90 backdrop-blur-md text-text-dim transition-opacity duration-500">
          <Loader2 className="w-9 h-9 text-wheat animate-spin" />
          <div className="text-center">
            <h2 className="text-white font-bold text-base mb-1">Murska Sobota & Pomurje Live Data</h2>
            <p className="font-mono text-[12px] text-text-dim">Povezujem SŽ INSPIRE vlake in GTFS avtobuse...</p>
          </div>
        </div>
      )}

      {/* Top Search & Geocoding Bar */}
      <div className="absolute top-3 left-3 sm:left-[350px] right-3 sm:right-auto z-20 flex flex-col gap-2 max-w-xl">
        <SearchBar 
          onSelectLocation={handleSelectLocation}
          onFlyHome={handleFlyHome}
        />
      </div>

      {/* Top Right Quick Stats Bar */}
      <div className="hidden lg:flex absolute top-3 right-3 z-10 items-center gap-3 bg-panel/90 backdrop-blur-xl border border-line px-3.5 py-1.5 rounded-2xl shadow-xl font-mono text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Bus size={13} />
          <span>Avtobusi IJPP: <strong>{appState?.counts?.buses ?? 0}</strong></span>
        </div>
        <span className="w-1 h-1 rounded-full bg-line"></span>
        <div className="flex items-center gap-1.5 text-sky-400">
          <Train size={13} />
          <span>Vlaki na tirih: <strong>{appState?.counts?.transit_trains ?? appState?.counts?.transit ?? appState?.counts?.hafas ?? 20}</strong></span>
        </div>
        <span className="w-1 h-1 rounded-full bg-line"></span>
        <button
          onClick={() => setFreightModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer text-[10.5px] font-bold shadow-sm"
          title="Tovorni Železniški Promet & Luka Koper (TEN-T RFC 5/6)"
        >
          <Anchor size={11} className="text-amber-400" />
          <span>Luka Koper & Tovorni Promet</span>
        </button>
        <span className="w-1 h-1 rounded-full bg-line"></span>
        <button
          onClick={() => setIsStreamOpen(!isStreamOpen)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors cursor-pointer text-[10.5px] font-bold ${
            isStreamOpen 
              ? 'bg-wheat text-ink border-wheat' 
              : 'bg-white/5 border-line text-text-dim hover:text-white hover:bg-white/10'
          }`}
        >
          <Terminal size={11} />
          Tok
        </button>
      </div>

      <AnalyticsPanel
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        mapController={mapController}
        onSelectNode={setSelectedNode}
      />

      {/* Main Sidebar */}
      <Sidebar
        appState={appState} 
        mapController={mapController} 
        onSelectNode={setSelectedNode}
        onOpenInsights={() => setInsightsOpen(true)} 
        onOpenFreightModal={() => setFreightModalOpen(true)}
        onToggleTelemetryStream={() => setIsStreamOpen(!isStreamOpen)}
        isStreamOpen={isStreamOpen}
        onToggleAnalytics={() => setAnalyticsOpen(o => !o)}
        analyticsOpen={analyticsOpen}
      />

      {/* AI Insights Flyout */}
      <AiInsights 
        isOpen={insightsOpen} 
        onClose={() => setInsightsOpen(false)} 
        appState={appState} 
      />

      {/* Interactive Telemetry Node Inspector */}
      <TelemetryInspector 
        node={selectedNode}
        onClose={() => { 
          setSelectedNode(null); 
          if (mapController) {
            mapController.clearSelectedNode();
            mapController.highlightTripRoute(null);
          }
        }}
        onFlyTo={handleFlyTo}
        onSelectTrain={handleSelectTrain}
        onHighlightRoute={handleHighlightRoute}
      />

      {/* Live Telemetry Log Stream / Terminal */}
      <LiveTelemetryStream
        isOpen={isStreamOpen}
        onClose={() => setIsStreamOpen(false)}
        logs={telemetryLogs}
        onSelectLog={handleSelectLog}
      />

      {/* Multimodal Freight Intelligence Modal */}
      <FreightIntelligenceModal
        isOpen={freightModalOpen}
        onClose={() => setFreightModalOpen(false)}
        onFlyTo={handleFlyTo}
        onSelectTerminal={(terminal) => {
          if (mapController && terminal.lat && terminal.lon) {
            const coords: [number, number] = [terminal.lon, terminal.lat];
            const node = mapController.buildTelemetryNode('yard', terminal, coords);
            setSelectedNode(node);
          }
        }}
      />

      {/* Bottom Footer Source Banner */}
      <div className="hidden sm:flex absolute bottom-2 right-3 z-10 
                      bg-panel/90 backdrop-blur-md border border-line rounded-xl px-3 py-1.5 
                      text-[10px] text-text-dim font-mono shadow-xl items-center gap-4">
        <div className="truncate">
          🛰️ Viri: <strong className="text-white">SŽ-Infrastruktura INSPIRE (RFC 6)</strong> · C-ITS SPaT/GLOSA · The Things Network (LoRaWAN) · ARSO
        </div>
        <div className="text-mura shrink-0 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-mura animate-ping"></span>
          1.5s OSVEŽEVANJE
        </div>
      </div>
    </div>
  );
}
