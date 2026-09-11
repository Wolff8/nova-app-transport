import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { MapController } from './lib/MapController';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { AlertSystem } from './components/AlertSystem';

// Nothing below is needed to paint the map. The inspector alone is 230 KB of
// source and the freight modal 120 KB; loading them after first render takes
// them off the path between the user opening the page and seeing something.
const TelemetryInspector = lazy(() => import('./components/TelemetryInspector').then(m => ({ default: m.TelemetryInspector })));
const FreightIntelligenceModal = lazy(() => import('./components/FreightIntelligenceModal').then(m => ({ default: m.FreightIntelligenceModal })));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel').then(m => ({ default: m.AnalyticsPanel })));
const AiInsights = lazy(() => import('./components/AiInsights').then(m => ({ default: m.AiInsights })));
const LiveTelemetryStream = lazy(() => import('./components/LiveTelemetryStream').then(m => ({ default: m.LiveTelemetryStream })));
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

  // Each lazy panel is mounted the first time it is asked for and stays
  // mounted after, so its chunk is not downloaded on a phone that never opens
  // it, and its state is not thrown away every time it is closed.
  const [everOpened, setEverOpened] = useState({ insights: false, freight: false, analytics: false, stream: false, inspector: false });
  useEffect(() => { if (insightsOpen) setEverOpened(e => e.insights ? e : { ...e, insights: true }); }, [insightsOpen]);
  useEffect(() => { if (freightModalOpen) setEverOpened(e => e.freight ? e : { ...e, freight: true }); }, [freightModalOpen]);
  useEffect(() => { if (analyticsOpen) setEverOpened(e => e.analytics ? e : { ...e, analytics: true }); }, [analyticsOpen]);
  useEffect(() => { if (isStreamOpen) setEverOpened(e => e.stream ? e : { ...e, stream: true }); }, [isStreamOpen]);
  useEffect(() => { if (selectedNode) setEverOpened(e => e.inspector ? e : { ...e, inspector: true }); }, [selectedNode]);

  // Ref buffer for telemetry logs to prevent re-render thrashing
  const logBufferRef = useRef<TelemetryLogEntry[]>([]);

  // Safety net: never trap the user on the loading overlay. It is normally
  // dismissed the moment the map style is usable (see onReady below); if even
  // that stalls, force it away so the controls become usable.
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
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
      },
      // The overlay used to wait for the first telemetry broadcast, which on
      // the production instance could be fifteen seconds behind the map being
      // perfectly usable. The map is what the user is waiting for.
      () => setLoading(false)
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
          <span>Vlaki na tirih: <strong>{appState?.counts?.transit_trains ?? appState?.counts?.transit ?? appState?.counts?.hafas ?? '—'}</strong></span>
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

      {everOpened.analytics && (
      <Suspense fallback={null}>
      <AnalyticsPanel
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        mapController={mapController}
        onSelectNode={setSelectedNode}
      />
      </Suspense>
      )}

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
      {everOpened.insights && (
      <Suspense fallback={null}>
      <AiInsights 
        isOpen={insightsOpen} 
        onClose={() => setInsightsOpen(false)} 
        appState={appState} 
      />
      </Suspense>
      )}

      {/* Interactive Telemetry Node Inspector */}
      {everOpened.inspector && (
      <Suspense fallback={null}>
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
      </Suspense>
      )}

      {/* Live Telemetry Log Stream / Terminal */}
      {everOpened.stream && (
      <Suspense fallback={null}>
      <LiveTelemetryStream
        isOpen={isStreamOpen}
        onClose={() => setIsStreamOpen(false)}
        logs={telemetryLogs}
        onSelectLog={handleSelectLog}
      />
      </Suspense>
      )}

      {/* Multimodal Freight Intelligence Modal */}
      {everOpened.freight && (
      <Suspense fallback={null}>
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
      </Suspense>
      )}

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
