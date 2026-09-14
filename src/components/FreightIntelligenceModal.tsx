import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Train, Anchor, Factory, ArrowRightLeft, ShieldCheck, 
  Leaf, Gauge, Navigation, ChevronRight, Search, Info, ExternalLink,
  Layers, CheckCircle2, TrendingUp, AlertTriangle, ArrowUpRight,
  Clock, Activity, Filter, RefreshCw, MapPin, ArrowRight
} from 'lucide-react';

interface FreightIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFlyTo?: (coords: [number, number], zoom?: number) => void;
  onSelectTerminal?: (terminal: any) => void;
}

export const FreightIntelligenceModal: React.FC<FreightIntelligenceModalProps> = ({
  isOpen,
  onClose,
  onFlyTo,
  onSelectTerminal
}) => {
  const [activeTab, setActiveTab] = useState<'trains' | 'pipeline' | 'yards' | 'corridors' | 'modalsplit' | 'uic' | 'registers' | 'murska_sobota'>('trains');
  
  // Data states
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [koperShips, setKoperShips] = useState<any>(null);
  const [msDepartures, setMsDepartures] = useState<any>(null);
  const [corridorLoad, setCorridorLoad] = useState<any>(null);
  const [registerQuery, setRegisterQuery] = useState('');
  const [registerKind, setRegisterKind] = useState<'vkm' | 'operators' | 'lines' | 'vehicles' | 'terms' | 'params' | 'freightStations' | 'commodities' | 'rcc'>('vkm');
  const [paramTable, setParamTable] = useState<any>(null);
  const [paramsNetworkOnly, setParamsNetworkOnly] = useState(false);
  const [glossary, setGlossary] = useState<any>(null);
  const [eratvData, setEratvData] = useState<any>(null);
  const [eratvDetail, setEratvDetail] = useState<any>(null);
  const [eratvLoading, setEratvLoading] = useState<string | null>(null);
  // DIUM SI: the stations Slovenia's network is open to freight on, and the
  // one station's entry the user has opened.
  const [diumData, setDiumData] = useState<any>(null);
  const [diumStation, setDiumStation] = useState<any>(null);
  // NHM: the commodity code a consignment note carries, and the one code the
  // user has opened.
  const [nhmData, setNhmData] = useState<any>(null);
  const [nhmCode, setNhmCode] = useState<any>(null);
  // RCC: route-compatibility check of a locomotive type against the SI network.
  const [rccLocos, setRccLocos] = useState<any>(null);
  const [rccResult, setRccResult] = useState<any>(null);
  const [rccLoading, setRccLoading] = useState(false);
  const [registerResults, setRegisterResults] = useState<any>(null);
  const [networkRef, setNetworkRef] = useState<any>(null);
  const [feedHealth, setFeedHealth] = useState<any>(null);
  const [terminalsData, setTerminalsData] = useState<any[]>([]);
  const [corridorsData, setCorridorsData] = useState<any>(null);
  const [modalSplitData, setModalSplitData] = useState<any>(null);
  // SURS official rail-freight flows by partner country (annual tonnage).
  const [sursFlows, setSursFlows] = useState<any>(null);
  // SŽ-Infrastruktura Capacity Strategy 2026: bookable train paths per hour
  // per section, passenger vs freight — the supply side of freight capacity.
  const [capacityStrategy, setCapacityStrategy] = useState<any>(null);
  // RNE RFC KPIs: last year's international freight trains per Slovenian
  // border, dwell times, punctuality — official annual aggregates from TIS.
  const [rfcKpis, setRfcKpis] = useState<any>(null);
  // Eurostat: what is carried (NST 2007), quarterly tonnes, intermodal units
  // and partner countries — the server's summary of the full cubes.
  const [eurostat, setEurostat] = useState<any>(null);
  // The data panels live several tabs deep, and the tab strip used to scroll
  // sideways with nothing to show it did — so half the tabs were never seen.
  // A jump sets the tab (and register kind) and scrolls to the panel once it
  // has rendered.
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const jumpTo = (tab: typeof activeTab, anchor: string | null, kind?: typeof registerKind) => {
    setActiveTab(tab);
    if (kind) setRegisterKind(kind);
    setPendingAnchor(anchor);
  };
  useEffect(() => {
    if (!pendingAnchor) return;
    const t = window.setTimeout(() => {
      document.getElementById(pendingAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingAnchor(null);
    }, 150);
    return () => window.clearTimeout(t);
  }, [pendingAnchor, activeTab, capacityStrategy, rfcKpis, sursFlows]);
  const [activeTrains, setActiveTrains] = useState<any[]>([]);
  const [freightPayload, setFreightPayload] = useState<any>(null);
  const [murskaSobotaData, setMurskaSobotaData] = useState<any>(null);
  const [rinfSummary, setRinfSummary] = useState<any>(null);
  const [trainFilter, setTrainFilter] = useState<'running' | 'terminals' | 'all'>('running');
  const [msDirectionFilter, setMsDirectionFilter] = useState<'all' | 'hodos' | 'koper'>('all');
  
  // UIC decoder states
  const [uicQuery, setUicQuery] = useState('SGGRSS');
  const [uicResult, setUicResult] = useState<any>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/rinf/summary').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setRinfSummary(j); }).catch(() => {});

    // Load active trains with real-time timetable integration
    const loadTrains = () => {
      fetch('/api/freight/active-trains')
        .then(async res => {
          if (!res.ok) return;
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            setFreightPayload(data);
            setActiveTrains(data.trains || []);
          }
        })
        .catch(() => {});
    };
    loadTrains();
    const trainTimer = setInterval(loadTrains, 4000);

    // Load dedicated Murska Sobota & Prekmurje freight radar
    const loadMurskaSobota = () => {
      fetch('/api/freight/murska-sobota')
        .then(async res => {
          if (!res.ok) return;
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            setMurskaSobotaData(data);
          }
        })
        .catch(() => {});
    };
    loadMurskaSobota();
    const msTimer = setInterval(loadMurskaSobota, 4000);

    // Load initial pipeline and terminals
    fetch('/api/freight/pipeline')
      .then(async res => {
        if (!res.ok) return;
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const data = JSON.parse(text);
          setPipelineData(data);
        }
      })
      .catch(() => {});

    // The one live freight source on this corridor — reread while the modal is
    // open, since ships are worked and moved through the day.
    const loadKoperShips = () => {
      fetch('/api/freight/port-rail')
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(data => { if (data && data.atBerth) setKoperShips(data); })
        .catch(() => {});
    };
    loadKoperShips();
    const koperTimer = setInterval(loadKoperShips, 120000);

    // What that cargo means for the line, refreshed alongside the ships.
    const loadCorridor = () => {
      fetch('/api/freight/corridor-load')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => { if (d?.sections) setCorridorLoad(d); })
        .catch(() => {});
    };
    loadCorridor();
    const corridorTimer = setInterval(loadCorridor, 120000);

    // Static reference: official line register, classes and traction series.
    fetch('/api/freight/network')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (d?.networkStatement) setNetworkRef(d); })
      .catch(() => {});

    // Murska Sobota's own departures, and how fresh the feed behind them is.
    const loadStationLive = () => {
      fetch('/api/motis/departures?stopId=sz_1122956&n=10')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => { if (d?.departures) setMsDepartures(d); })
        .catch(() => {});
      fetch('/api/motis/health')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => { if (d?.feeds) setFeedHealth(d); })
        .catch(() => {});
    };
    loadStationLive();
    const stationTimer = setInterval(loadStationLive, 60000);

    fetch('/api/freight/terminals')
      .then(res => res.json())
      .then(data => setTerminalsData(data.terminals || []))
      .catch(err => console.error('Failed to load freight terminals:', err));

    fetch('/api/freight/corridors')
      .then(res => res.json())
      .then(data => setCorridorsData(data))
      .catch(err => console.error('Failed to load freight corridors:', err));

    // A 503 body parses perfectly well as JSON, so storing whatever comes back
    // used to leave an error object sitting where the statistics should be and
    // the panel stuck on its loading line. Only a response carrying figures
    // counts, and one attempt is retried in case the server was still warming.
    const loadModalSplit = (attemptsLeft: number) => {
      fetch('/api/freight/modal-split')
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(data => {
          if (data && data.tonneKm) setModalSplitData(data);
          else throw new Error('Modal split response carried no figures');
        })
        .catch(err => {
          if (attemptsLeft > 0) {
            setTimeout(() => loadModalSplit(attemptsLeft - 1), 4000);
          } else {
            console.error('Failed to load modal split:', err);
          }
        });
    };
    loadModalSplit(2);

    fetch('/api/freight/surs-flows')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && data.loadedInSlovenia) setSursFlows(data); })
      .catch(() => {});

    fetch('/api/freight/capacity-strategy')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && data.mainLines) setCapacityStrategy(data); })
      .catch(() => {});

    fetch('/api/freight/rfc-kpis')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && data.corridors) setRfcKpis(data); })
      .catch(() => {});

    fetch('/api/freight/eurostat')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && (data.commodities || data.quarterly)) setEurostat(data); })
      .catch(() => {});

    // Initial UIC decoder lookup
    runUicDecoder('SGGRSS');

    return () => {
      clearInterval(trainTimer);
      clearInterval(msTimer);
      clearInterval(koperTimer);
      clearInterval(stationTimer);
      clearInterval(corridorTimer);
    };
  }, [isOpen]);

  const runUicDecoder = (query: string) => {
    fetch(`/api/freight/uic-decoder?code=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => setUicResult(data))
      .catch(err => console.error('Failed to decode UIC:', err));
  };

  const handleUicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uicQuery.trim()) {
      runUicDecoder(uicQuery.trim());
    }
  };

  const runningTrainsList = useMemo(() => {
    if (freightPayload?.runningTrains) return freightPayload.runningTrains;
    return activeTrains.filter((t: any) => t.isRunning);
  }, [freightPayload, activeTrains]);

  const terminalTrainsList = useMemo(() => {
    if (freightPayload?.terminalTrains) return freightPayload.terminalTrains;
    return activeTrains.filter((t: any) => t.isAtTerminal);
  }, [freightPayload, activeTrains]);

  const allSlotsList = useMemo(() => {
    return freightPayload?.allSlots || activeTrains;
  }, [freightPayload, activeTrains]);

  const displayedTrains = useMemo(() => {
    if (trainFilter === 'running') return runningTrainsList;
    if (trainFilter === 'terminals') return terminalTrainsList;
    return allSlotsList;
  }, [trainFilter, runningTrainsList, terminalTrainsList, allSlotsList]);

  const totalTransitTons = useMemo(() => {
    return runningTrainsList.reduce((acc: number, t: any) => acc + (t.grossWeightTons || 0), 0);
  }, [runningTrainsList]);

  const totalTrucksOffset = useMemo(() => {
    return runningTrainsList.reduce((acc: number, t: any) => acc + (t.trucksEquivalent || 0), 0);
  }, [runningTrainsList]);

  const filteredMsTrains = useMemo(() => {
    const list = murskaSobotaData?.allScheduledToday || [];
    if (msDirectionFilter === 'hodos') {
      return list.filter((t: any) => t.isHeadingNorthEast);
    }
    if (msDirectionFilter === 'koper') {
      return list.filter((t: any) => !t.isHeadingNorthEast);
    }
    return list;
  }, [murskaSobotaData, msDirectionFilter]);

  if (!isOpen) return null;

  const filteredTerminals = terminalsData.filter(t => 
    t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.code?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (t.cargoTypes && t.cargoTypes.some((c: string) => c.toLowerCase().includes(searchFilter.toLowerCase())))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl h-[90vh] max-h-[850px] flex flex-col 
                   bg-[#0b1320] border border-sky-500/30 rounded-2xl shadow-[0_0_50px_rgba(14,165,233,0.15)] 
                   overflow-hidden text-slate-200 font-sans"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-sky-900/40 bg-gradient-to-r from-sky-950/50 via-slate-900/60 to-amber-950/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Train size={22} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                  Tovorni Železniški Promet & Multimodalna Logistika
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                  TEN-T RFC 5 & 6
                </span>
              </div>
              <p className="text-[12px] text-slate-400 mt-1 font-medium">
                Intermodalni tokovni koridorji Luke Koper · Digitalni dvojček ranžirnih postaj · UIC Dekoder vagonov
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Zapri"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="px-5 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-1 flex-wrap shrink-0 py-2">
          <button
            onClick={() => setActiveTab('trains')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trains'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Train size={14} className="text-amber-400" />
            <span>Objavljene poti ({freightPayload?.totalActiveOnTracks ?? 0} v vožnji)</span>
          </button>

          <button
            onClick={() => setActiveTab('murska_sobota')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'murska_sobota'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Navigation size={14} className="text-emerald-400" />
            <span>Radar Murska Sobota & Prekmurje</span>
            {murskaSobotaData?.counts?.passingNowCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-mono animate-pulse">
                {murskaSobotaData.counts.passingNowCount} zdaj
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pipeline'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Anchor size={14} />
            <span>Luka Koper ➔ Železnica</span>
          </button>

          <button
            onClick={() => setActiveTab('yards')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'yards'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Factory size={14} />
            <span>Ranžirne Postaje & Terminali ({terminalsData.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('corridors')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'corridors'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Gauge size={14} />
            <span>TEN-T Prepustnost & Trase</span>
          </button>

          <button
            onClick={() => setActiveTab('modalsplit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'modalsplit'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Leaf size={14} />
            <span>Modal Split & Ekologija</span>
          </button>

          <button
            onClick={() => setActiveTab('uic')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'uic'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <ShieldCheck size={14} />
            <span>UIC Dekoder Vagonov</span>
          </button>

          <button
            onClick={() => setActiveTab('registers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'registers'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Search size={14} />
            <span>Uradni registri</span>
          </button>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">

          {/* Where the official datasets are. Every chip names its source and
              jumps straight to the panel; counts appear once that source has
              loaded, so nothing here is claimed before it is on screen. */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
            <span className="text-slate-500 font-mono uppercase tracking-wider mr-1">Uradni podatki:</span>
            <button onClick={() => jumpTo('corridors', 'panel-rfc-kpis')}
              className="px-2 py-0.5 rounded-md border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 cursor-pointer font-semibold">
              RNE RFC KPI · tovorni vlaki na mejah{rfcKpis?.sloveniaBordersByStation ? ` (${Object.keys(rfcKpis.sloveniaBordersByStation).length} prehodi)` : ''}
            </button>
            <button onClick={() => jumpTo('corridors', 'panel-capacity')}
              className="px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 cursor-pointer font-semibold">
              SŽ-I vlakovne poti {capacityStrategy?.timetable || '2026'}{capacityStrategy?.mainLines ? ` (${capacityStrategy.mainLines.length} odsekov)` : ''}
            </button>
            <button onClick={() => jumpTo('modalsplit', 'panel-surs')}
              className="px-2 py-0.5 rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 cursor-pointer font-semibold">
              SURS tokovi tovora{sursFlows?.latestYear ? ` ${sursFlows.latestYear}` : ''}
            </button>
            <button onClick={() => jumpTo('modalsplit', 'panel-eurostat')}
              className="px-2 py-0.5 rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 cursor-pointer font-semibold">
              Eurostat · blago, četrtletja, intermodal{eurostat?.quarterly?.latestQuarter ? ` (do ${eurostat.quarterly.latestQuarter})` : ''}
            </button>
            <button onClick={() => jumpTo('registers', null, 'freightStations')}
              className="px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer font-semibold">
              DIUM SI · tovorne postaje
            </button>
            <button onClick={() => jumpTo('registers', null, 'commodities')}
              className="px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer font-semibold">
              NHM 2026 · blago
            </button>
            <button onClick={() => jumpTo('registers', null, 'rcc')}
              className="px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer font-semibold">
              RCC · združljivost lokomotiv
            </button>
          </div>

          {/* TAB 0: ACTIVE FREIGHT TRAINS (REAL TIMETABLE-SYNCHRONIZED SŽ ENGINE) */}
          {activeTab === 'trains' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top Key Metrics Bento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* These three counted the app's own invented trains: "live
                    trains on the tracks", their combined mass, the lorries
                    they supposedly displaced. None of it was observed. They
                    now count ships, which are. */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ladij s tovorom za tir</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-emerald-400">
                    {corridorLoad?.load?.shipsContributing ?? '—'}
                  </div>
                  <span className="text-[10px] text-emerald-300/80">V živo iz Luke Koper</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tovor za železnico</span>
                  <div className="my-1 text-2xl font-bold font-mono text-sky-400">
                    {corridorLoad ? `${Number(corridorLoad.load.railTonnes).toLocaleString('sl-SI')} t` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">Izpeljano iz pristaniških tonaž</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Obremenitev koridorja</span>
                  <div className="my-1 text-2xl font-bold font-mono text-amber-400">
                    {corridorLoad ? `${Number(corridorLoad.load.daysOfAverageThroughput).toLocaleString('sl-SI')} dni` : '—'}
                  </div>
                  <span className="text-[10px] text-amber-300/80">Pri {corridorLoad?.load?.averageTrainsPerDay ?? '—'} vlakih/dan</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-purple-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Lokalni Čas (CET)</span>
                    <Clock size={12} className="text-purple-400" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-purple-300">
                    {freightPayload?.currentTimeInSlovenia || 'Slovenija'}
                  </div>
                  <span className="text-[10px] text-slate-400">Vozni red SŽ-Infrastruktura</span>
                </div>
              </div>

              {/* This banner used to call these paths "uradne dodeljene trase"
                  — officially allocated train paths. They are not: the numbers,
                  times, locomotives and loads below were written into this
                  app's source, not taken from a timetable. No public feed
                  carries freight positions anywhere on this corridor (checked:
                  MÁV vonatinfo is passenger-only, ViaggiaTreno resolves no
                  freight number, and neither SŽ nor HŽ publish one), so nothing
                  here is live. What the registers do confirm is shown per train
                  and labelled as such. */}
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
                <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-amber-200">
                    Tovorni vlaki tu niso v živo — pozicij ne objavlja nihče
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Za tovorni promet ni javnega vira pozicij: MÁV vonatinfo vrača samo potniške vlake, ViaggiaTreno ne pozna
                    tovornih številk, SŽ in HŽ pa jih ne objavljata. Spodaj so zato <strong className="text-amber-300">objavljene poti
                    iz katalogov koridorjev RFC5, RFC6 in RFC10 (vozna reda 2026 in 2027)</strong> — iste, kot jih riše karta. Lega med objavljenimi
                    časi je interpolirana; katalog ne pove, ali pot danes res vozi. Kjer prevoznik objavlja urnik na isti relaciji
                    (METRANS, RCG, Tailwind …), je to navedeno kot ujemanje relacije, ne kot potrditev. Vlaki z oznako
                    <strong className="text-amber-300"> URNIK PREVOZNIKA</strong> so iz objavljenih ur odhoda prevoznika (Tailwind Graz → Koper,
                    Adria Kombi ROLA Maribor → Wels); lega je ocena iz ure odhoda in objavljenega časa vožnje.
                  </p>
                </div>
              </div>

              {/* The published paths themselves, so the panel and the map agree. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">Objavljene poti skozi Slovenijo</h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {freightPayload?.totalActiveOnTracks ?? 0} v vožnji · {freightPayload?.totalAtTerminals ?? 0} na postanku · {freightPayload?.totalScheduledSlots ?? 0} danes · {allSlotsList.length} v katalogih (od tega {allSlotsList.filter((t: any) => t.status === 'future').length} iz voznega reda 2027)
                  </span>
                </div>
                {allSlotsList.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">Katalog se nalaga.</div>
                ) : (
                  <div className="space-y-1.5">
                    {allSlotsList.map((t: any, idx: number) => {
                      const badge = t.status === 'running' ? ['V VOŽNJI', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40']
                        : t.status === 'dwell' ? ['POSTANEK', 'bg-sky-500/20 text-sky-300 border-sky-500/40']
                        : t.status === 'scheduled' ? ['DANES', 'bg-slate-800 text-slate-300 border-slate-700']
                        : t.status === 'future' ? [`OD ${String(t.validFrom || '').split('-').reverse().join('. ')}`, 'bg-violet-500/15 text-violet-300 border-violet-500/40']
                        : t.daysKnown === false ? ['DNEVI NISO OBJAVLJENI', 'bg-slate-900 text-slate-500 border-slate-800']
                        : ['NE VOZI DANES', 'bg-slate-900 text-slate-500 border-slate-800'];
                      return (
                        <div key={`${t.id}_${idx}`} className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${t.isRunning ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-slate-900/70 border-slate-800'}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${badge[1]}`}>{badge[0]}</span>
                              <span className="font-bold text-white font-mono text-xs">{t.trainNumber}</span>
                              <span className="text-[10px] font-mono text-slate-400">{t.direction}</span>
                              {t.estimatedFromOperator && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border bg-amber-500/15 text-amber-300 border-amber-500/40">URNIK PREVOZNIKA · OCENA LEGE</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-200 font-semibold mt-0.5 truncate">{t.relation}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {t.fromName} {t.depTime} → {t.toName} {t.arrTime} · {t.corridor}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {t.catalogueLabel} · {t.operator}
                              {t.isRunning && t.currentSection ? ` · med ${t.currentSection}${t.bandHalfKm != null ? ` (±${t.bandHalfKm} km)` : ''}` : ''}
                              {t.status === 'dwell' && t.dwell ? ` · stoji v ${t.dwell.location} do ${t.dwell.departure}` : ''}
                            </div>
                          </div>
                          {t.currentLon != null && t.currentLat != null && (
                            <button
                              onClick={() => { if (onFlyTo) { onFlyTo([t.currentLon, t.currentLat], 12.5); onClose(); } }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-medium text-xs border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Navigation size={12} />
                              <span>Na karti</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* What the operators themselves publish: relations and frequencies,
                  never times. Kept apart from the catalogue paths above. */}
              {Array.isArray(freightPayload?.operatorServices) && freightPayload.operatorServices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white">Objavljeni urniki prevoznikov (relacije in pogostost, brez ur)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {freightPayload.operatorServices.map((s: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                        <div className="text-xs font-semibold text-slate-100">{s.operator}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{s.from} {s.bothWays ? '⇄' : '→'} {s.to}</div>
                        <div className="text-[11px] text-emerald-300 mt-0.5">
                          {s.perDay != null ? `${s.perDay}× na dan` : (s.perWeek != null ? `${s.perWeek}× na teden` : (s.operatingDays ? 'objavljeni odhodi' : 'pogostost ni objavljena'))}
                          {Array.isArray(s.days) && s.days.length === 7 ? ' · vsak dan' : ''}
                          {s.transitHours ? ` · čas vožnje do ${s.transitHours} h` : ''}
                          {s.validFrom ? ` · velja od ${String(s.validFrom).split('-').reverse().join('. ')}` : ''}
                          {s.validUntil ? ` · velja do ${String(s.validUntil).split('-').reverse().join('. ')}` : ''}
                        </div>
                        {s.operatingDays && <div className="text-[10px] text-slate-300 mt-0.5">dnevi: {s.operatingDays}</div>}
                        {s.route && <div className="text-[10px] text-slate-400 mt-0.5">pot: {s.route}</div>}
                        {s.cargo && <div className="text-[10px] text-slate-400">{s.cargo}</div>}
                        {Array.isArray(s.schedule) && s.schedule.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {s.schedule.map((line: string, j: number) => <li key={j} className="text-[10px] text-slate-300 leading-snug">· {line}</li>)}
                          </ul>
                        )}
                        {s.note && <div className="text-[10px] text-slate-500 mt-1 leading-snug">{s.note}</div>}
                        <a href={s.source} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-sky-300/80 hover:text-sky-200 break-all block mt-1">
                          vir: {s.source}{s.retrieved ? ` · prebrano ${s.retrieved}` : ''}
                        </a>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">Večina prevoznikov objavlja pogostost, ne ur odhodov; teh vlakov ni mogoče postaviti na karto. Kjer je ura odhoda objavljena (Tailwind Graz → Koper, Adria Kombi ROLA Maribor → Wels), je vlak na karti in v seznamu zgoraj označen kot ocena lege po urniku prevoznika. Kjer relacija ustreza objavljeni poti kataloga, je to pri poti navedeno kot ujemanje.</p>
                </div>
              )}

              {/* The port's own list of every regular block train — the fullest
                  public answer to "which freight trains run through Slovenia".
                  Frequencies only: no times and no route, so nothing here is on
                  the map. */}
              {Array.isArray(freightPayload?.portServices) && freightPayload.portServices.length > 0 && (() => {
                const byCountry = new Map<string, any[]>();
                for (const s of freightPayload.portServices as any[]) { const k = s.country || '—'; if (!byCountry.has(k)) byCountry.set(k, []); byCountry.get(k)!.push(s); }
                const first = freightPayload.portServices[0];
                return (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-white">Redni vlaki iz Luke Koper in vanjo – seznam pristanišča ({freightPayload.portServices.length} zvez)</h4>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      {freightPayload.portServicesNote || 'Seznam rednih vlakov, ki ga objavlja Luka Koper.'}
                      {first?.pageUpdated ? ` Stran posodobljena ${String(first.pageUpdated).split('-').reverse().join('. ')}.` : ''}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[...byCountry.entries()].map(([country, list]) => (
                        <div key={country} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="text-xs font-semibold text-slate-100 mb-1">{country} <span className="text-slate-500 font-normal">({list.length})</span></div>
                          <ul className="space-y-1">
                            {list.map((s: any, i: number) => (
                              <li key={i} className="text-[10.5px] leading-snug text-slate-300">
                                <span className="text-slate-100">{s.relation}</span>
                                <span className="text-emerald-300"> · {s.frequency}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <a href={first?.source} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-sky-300/80 hover:text-sky-200 break-all block">
                      vir: {first?.source}{first?.retrieved ? ` · prebrano ${first.retrieved}` : ''}
                    </a>
                  </div>
                );
              })()}

              {/* The Slovenian network as ERA's RINF register describes it:
                  kilometres by electrification, ETCS, corridor and load
                  category, border points with their partner points, freight
                  points and the longest tunnels. All of it is the manager's
                  submission to the register, none of it is derived here. */}
              {rinfSummary && (() => {
                const rs = rinfSummary;
                const KmList = ({ title, rows }: { title: string; rows: any[] }) => (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                    <div className="text-[9.5px] uppercase font-mono tracking-wider text-sky-300 mb-1">{title}</div>
                    <ul className="space-y-0.5">
                      {rows.map((r: any) => (
                        <li key={r.key} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                          <span className="text-white/85 truncate">{r.key}</span>
                          <span className="font-mono text-white shrink-0">{r.km} km</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
                return (
                  <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-950/15 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[11px] font-bold text-white uppercase tracking-wide">Slovensko omrežje v registru infrastrukture (ERA RINF)</div>
                      <span className="text-[9px] font-mono text-sky-200/80">graf upravljavca 0079 · {rs.validity?.[0]?.replace('Validity period', 'veljavnost') || ''}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {[
                        ['operativnih točk', rs.counts.operationalPoints], ['odsekov prog', rs.counts.sections],
                        ['km odsekov', rs.counts.sectionKm], ['km dvotirnih', rs.counts.doubleTrackKm],
                        ['tirov v odsekih', rs.counts.tracks], ['predorov', rs.counts.tunnels],
                        ['mejnih točk', rs.borderPoints.length], ['tovornih točk', rs.freightPoints.length]
                      ].map(([l, v]) => (
                        <div key={String(l)} className="rounded-lg bg-black/25 border border-white/10 px-2 py-1.5">
                          <div className="text-[15px] font-bold font-mono text-white">{v as any}</div>
                          <div className="text-[9px] uppercase text-text-dim">{l as any}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <KmList title="Elektrifikacija" rows={rs.kmByEnergySupply} />
                      <KmList title="ETCS" rows={rs.kmByEtcsLevel} />
                      <KmList title="Tovorni koridorji (RFC)" rows={rs.kmByCorridor} />
                      <KmList title="Kategorija proge (osna obremenitev)" rows={rs.kmByLoadCategory} />
                      <KmList title="Nakladalni profil" rows={rs.kmByGauging} />
                      <KmList title="Zaščita vlaka razreda B" rows={rs.kmByProtection} />
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                      <div className="text-[9.5px] uppercase font-mono tracking-wider text-sky-300 mb-1">Mejne točke (referenca EU, TAF koda, partnerska točka)</div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                        {rs.borderPoints.map((b: any) => (
                          <li key={b.uopid} className="text-[10.5px] leading-snug">
                            <span className="text-white/90">{b.name}</span>
                            <span className="font-mono text-text-dim"> · {b.code}{b.plc ? ` · TAF ${b.plc}` : ''}{b.line ? ` · proga ${b.line} km ${b.km}` : ''}</span>
                            {b.partner ? <span className="block font-mono text-[9.5px] text-emerald-200/80">↔ {b.partner.name} ({b.partner.countrySl}, {b.partner.uopid})</span> : null}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[9px] text-text-dim mt-1">{rs.partnerNote}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                        <div className="text-[9.5px] uppercase font-mono tracking-wider text-sky-300 mb-1">Tovorni terminali in ranžirna postaja</div>
                        <ul className="space-y-0.5">
                          {rs.freightPoints.map((f: any) => (
                            <li key={f.uopid} className="text-[10.5px] leading-snug">
                              <span className="text-white/90">{f.name}</span>
                              <span className="font-mono text-text-dim"> · {f.typeSl}{f.plc ? ` · TAF ${f.plc}` : ''} · {f.tracks} tirov / {f.sidings} stranskih</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                        <div className="text-[9.5px] uppercase font-mono tracking-wider text-sky-300 mb-1">Najdaljši predori</div>
                        <ul className="space-y-0.5">
                          {rs.longestTunnels.map((t: any) => (
                            <li key={t.name} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                              <span className="text-white/85 truncate">{t.name}{t.line ? ` (proga ${t.line})` : ''}</span>
                              <span className="font-mono text-white shrink-0">{t.lengthM} m</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <p className="text-[9px] leading-snug text-text-dim">{rs.note}</p>
                    <a href={rs.endpoint} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-sky-300/80 hover:text-sky-200 break-all block">
                      vir: {rs.source} · posnetek {String(rs.retrieved).slice(0, 10)} · licenca: {rs.license}
                    </a>
                  </div>
                );
              })()}

              {/* National aggregates from ERA's Railway Factsheet: published
                  figures with the source ERA names, replacing the invented
                  per-terminal throughput numbers this panel used to carry. */}
              {Array.isArray(freightPayload?.countryStats?.indicators) && freightPayload.countryStats.indicators.length > 0 && (() => {
                const cs = freightPayload.countryStats;
                const pick = [
                  'Freight transport modal share', 'Freight transport tkm', 'Licensed railway undertakings - Freight only',
                  'Railway undertakings with safety certificate - Freight only', 'Domestic incumbent market share in the rail freight market',
                  'Non-incumbent market share in the rail freight market', 'Freight - punctuality',
                  'Freight - domestic - average timetable speed', 'Freight - international - average timetable speed',
                  'Electric locomotives', 'Diesel locomotives', 'Freight terminals', 'Line kilometres', 'Single track lines',
                  'Electrified lines', 'ERTMS Level 1 lines'
                ];
                const rows = pick.map(v => cs.indicators.find((i: any) => i.variable === v)).filter(Boolean);
                const fmt = (i: any) => {
                  const v = i.latest?.value;
                  const num = typeof v === 'number' ? v.toLocaleString('sl-SI') : String(v ?? '—');
                  const unit = i.unit === 'total number' || i.unit === 'count' ? '' : (i.unit?.startsWith('vozil') ? '' : ` ${i.unit}`);
                  return `${num}${unit}`;
                };
                return (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-white">Slovenija v številkah – tovorni železniški promet (ERA Railway Factsheet)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {rows.map((i: any, k: number) => (
                        <div key={k} className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="text-[10px] text-slate-400 leading-snug">{i.label}</div>
                          <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">{fmt(i)}</div>
                          <div className="text-[9.5px] font-mono text-slate-500">{i.latest?.year} · {i.source}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">{cs.note} Vir: {cs.source}.</p>
                  </div>
                );
              })()}

              {/* Murska Sobota & Prekmurje Spotlight Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-amber-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <Navigation size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <span>Fokus: Tovorni promet skozi Mursko Soboto & Prekmurje</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold">
                        Glavna proga št. 40
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mejni prehod Hodoš je edini železniški izstop proti Madžarski; promet skozenj ni javno objavljen.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('murska_sobota')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Odpri Radar Murska Sobota</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Corridor load, in place of the invented trains.
                  This tab used to list fifty-four made-up workings with
                  made-up numbers, times and speeds. Nothing publishes freight
                  positions here, so instead it shows what is measurably in the
                  port converted into the movement it implies, laid against the
                  line that movement has to use. */}
              {corridorLoad ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Tovor za tir', value: `${Number(corridorLoad.load.railTonnes).toLocaleString('sl-SI')} t`, tone: 'text-amber-300' },
                      { label: 'Vagonov', value: Number(corridorLoad.load.wagons).toLocaleString('sl-SI'), tone: 'text-sky-300' },
                      { label: 'Vlakov', value: Number(corridorLoad.load.trains).toLocaleString('sl-SI'), tone: 'text-emerald-300' },
                      { label: 'Dni povprečne odpreme', value: Number(corridorLoad.load.daysOfAverageThroughput).toLocaleString('sl-SI'), tone: 'text-purple-300' }
                    ].map(c => (
                      <div key={c.label} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                        <div className={`font-mono font-bold text-xl ${c.tone}`}>{c.value}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{c.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* The map shows modelled markers again; this says what
                      they are, so the number above and the dots agree. */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/25 text-[10.5px] text-slate-300 leading-relaxed">
                    <strong className="text-amber-300">Na mapi:</strong> tovorni vlaki so prikazani kot{' '}
                    <strong className="text-amber-300">modelirana lega</strong> — ne meritev. Koliko jih je, izhaja iz objavljenih{' '}
                    {corridorLoad.basis?.annualTrains?.toLocaleString('sl-SI')} odprem na leto in časa vožnje; kje so, iz prave geometrije tira in
                    objavljenih hitrostnih omejitev (75 km/h Koper–Divača, 100 km/h drugje). Pas okoli vlaka je razpon,
                    kjer lahko je — širši pas pomeni manj zanesljivo oceno. Številk vlakov ni, ker niso objavljene.
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tovor, ki je zdaj v Luki Koper, pomeni približno{' '}
                    <strong className="text-emerald-300">{corridorLoad.load.trains} vlakov</strong> — to je{' '}
                    <strong className="text-purple-300">{Number(corridorLoad.load.daysOfAverageThroughput).toLocaleString('sl-SI')} dni</strong>{' '}
                    pri objavljenem povprečju {corridorLoad.load.averageTrainsPerDay} vlakov na dan.
                  </p>

                  {corridorLoad.certainSection && (
                    <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/30">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-amber-200">
                          Ozko grlo: {corridorLoad.certainSection.from} → {corridorLoad.certainSection.to}
                        </span>
                        <span className="font-mono text-[11px] text-amber-300">{corridorLoad.certainSection.km} km</span>
                      </div>
                      <p className="text-[10.5px] text-slate-300 leading-relaxed">
                        {corridorLoad.certainSection.note} Luka Koper ima en sam železniški priključek, zato gre{' '}
                        <strong className="text-amber-300">ves</strong> ta tovor čez ta odsek — to ni ocena, ampak posledica omrežja.
                      </p>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Odseki po registru RINF
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        {corridorLoad.route.from} → {corridorLoad.route.to} · {corridorLoad.route.km} km
                      </span>
                    </div>
                    <div className="max-h-72 overflow-auto custom-scrollbar space-y-1">
                      {corridorLoad.sections.map((s: any, i: number) => (
                        <div key={i} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[10.5px] ${
                          s.certainty === 'all-port-traffic'
                            ? 'bg-amber-950/20 border-amber-500/25'
                            : 'bg-slate-950/50 border-slate-800/70'
                        }`}>
                          <span className="truncate text-slate-200">
                            {s.from} → {s.to}
                          </span>
                          <span className="font-mono shrink-0 text-right">
                            <span className="text-slate-400">{s.km} km</span>
                            <span className={s.certainty === 'all-port-traffic' ? ' text-amber-300' : ' text-slate-500'}>
                              {' '}· {s.certainty === 'all-port-traffic' ? 'ves tovor' : 'zgornja meja'}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Za Divačo se koridor razcepi (Sežana, Pivka, Ljubljana). Brez vira o delitvi prometa je
                      obremenitev naprej <span className="text-slate-400">zgornja meja</span>, ne izmerjena vrednost.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Od katerih ladij</h4>
                    {corridorLoad.contributors.slice(0, 8).map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
                        <span className="text-slate-200 truncate">{c.vessel}</span>
                        <span className="text-slate-400 shrink-0 text-right truncate max-w-[55%]">
                          {c.cargo} · {Number(c.railTonnes).toLocaleString('sl-SI')} t · {c.wagons} vag
                          {c.wagonSeries ? ` ${c.wagonSeries}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">
                  Nalagam obremenitev koridorja …
                </div>
              )}
            </div>
          )}

          {/* TAB 1: PORT-TO-RAIL PIPELINE (LUKA KOPER) */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top Key Metrics Bento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Every number in this row is the port's own published result
                    for the reporting year. The fallbacks that used to stand
                    here — 1.025.000 TEU, 801.000 vehicles, 61,2 % rail, "65–80
                    trains a day, max 88 observed" — were invented and wrong
                    against what Luka Koper actually reports. There are no
                    fallbacks now: without the endpoint the cards stay empty
                    rather than assert a figure. */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Letni TEU Zabojniki</span>
                  <div className="my-1 text-2xl font-bold font-mono text-sky-400">
                    {pipelineData?.annualTeu ? Number(pipelineData.annualTeu).toLocaleString('sl-SI') : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {pipelineData?.dailyTeuAverage ? `~${Number(pipelineData.dailyTeuAverage).toLocaleString('sl-SI')} TEU / dan` : 'Nalagam …'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Železniški Delež (Modal)</span>
                  <div className="my-1 text-2xl font-bold font-mono text-amber-400">
                    {pipelineData?.railModalSplitPercent != null ? `${pipelineData.railModalSplitPercent} %` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {pipelineData?.reportingYear ? `Objava Luke Koper za ${pipelineData.reportingYear}` : 'Nalagam …'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Vlakov na Dan (Povprečje)</span>
                  <div className="my-1 text-2xl font-bold font-mono text-emerald-400">
                    {pipelineData?.dailyBlockTrainsAverage ?? '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {pipelineData?.annualTrains
                      ? `${Number(pipelineData.annualTrains).toLocaleString('sl-SI')} vlakov na leto ÷ 365`
                      : 'Nalagam …'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-purple-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Letni Avtomobili (Ro-Ro)</span>
                  <div className="my-1 text-2xl font-bold font-mono text-purple-300">
                    {pipelineData?.annualCars ? Number(pipelineData.annualCars).toLocaleString('sl-SI') : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {pipelineData?.annualWagons ? `${Number(pipelineData.annualWagons).toLocaleString('sl-SI')} vagonov na leto` : 'Nalagam …'}
                  </span>
                </div>
              </div>

              {/* Modal Split Comparison Bar */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                {/* Both the split and the tonnage were hardcoded into this
                    markup at 61,2 / 38,8 and 23,2 mio t. The port reports 51 /
                    49 on 23.003.522 t, so the bar now follows the endpoint and
                    the claim of being first in the Mediterranean — which the
                    port does not make in these results — is gone. */}
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">Razdelitev transportnih poti Luke Koper:</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {pipelineData?.annualMaritimeTonnage
                        ? `(Skupaj ${Number(pipelineData.annualMaritimeTonnage).toLocaleString('sl-SI')} ton, ${pipelineData.reportingYear})`
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono">
                    <span className="text-amber-400 font-bold">🚂 Železnica: {pipelineData?.railModalSplitPercent ?? '—'} %</span>
                    <span className="text-sky-400 font-bold">🚛 Cesta: {pipelineData?.roadModalSplitPercent ?? '—'} %</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-700/60 p-0.5">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-l-full" style={{ width: `${pipelineData?.railModalSplitPercent ?? 0}%` }}></div>
                  <div className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-r-full" style={{ width: `${pipelineData?.roadModalSplitPercent ?? 0}%` }}></div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Železnica odpelje večino tovora iz Luke Koper, zato je proga Koper – Divača – Ljubljana – Maribor/Hodoš ozko grlo celotnega koridorja.
                  {pipelineData?.source && (
                    <span className="block mt-1 text-[10px] text-emerald-400/80 font-mono break-words">Vir: {pipelineData.source}</span>
                  )}
                </p>
              </div>

              {/* Live ship movements — the only genuinely live freight source
                  on this corridor, and what replaced the three invented
                  vessels this tab used to name as berthed. */}
              {koperShips?.atBerth && (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-emerald-500/25 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Anchor size={14} className="text-emerald-400" />
                      Ladje v Luki Koper — v živo
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {koperShips.shipTotals?.working} na vezu · {koperShips.shipTotals?.arriving} najavljenih · {koperShips.shipTotals?.pilotMovements} premikov
                    </span>
                  </div>

                  {/* What the ships mean for the railway, in aggregate. */}
                  {koperShips.totals && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Tovor na ladjah', value: `${Number(koperShips.totals.cargoTonnes).toLocaleString('sl-SI')} t`, tone: 'text-slate-200' },
                        { label: 'Od tega po tiru', value: `${Number(koperShips.totals.railTonnes).toLocaleString('sl-SI')} t`, tone: 'text-amber-300' },
                        { label: 'Vagonov', value: Number(koperShips.totals.wagons).toLocaleString('sl-SI'), tone: 'text-sky-300' },
                        { label: 'Vlakov', value: Number(koperShips.totals.trains).toLocaleString('sl-SI'), tone: 'text-emerald-300' }
                      ].map(c => (
                        <div key={c.label} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center">
                          <div className={`font-mono font-bold text-base ${c.tone}`}>{c.value}</div>
                          <div className="text-[9.5px] text-slate-400 uppercase tracking-wider">{c.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {koperShips.atBerth.map((s: any, i: number) => (
                      <div key={`${s.callNumber}-${i}`} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px]">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-white truncate">{s.vessel}</span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            Vez {s.berth} · {s.operation}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                          <span className="text-amber-300 font-medium truncate">{s.cargo}</span>
                          <span className="font-mono text-slate-300 shrink-0">
                            {s.cargoTonnes != null ? `${Number(s.cargoTonnes).toLocaleString('sl-SI')} t` : ''}
                          </span>
                        </div>
                        {s.percentComplete != null && (
                          <div className="mt-1.5">
                            <div className="flex justify-between text-[9.5px] text-slate-400 font-mono mb-0.5">
                              <span>Pretovorjeno {Number(s.handledTonnes).toLocaleString('sl-SI')} t</span>
                              <span className="text-emerald-300">{Number(s.percentComplete).toLocaleString('sl-SI')} %</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                                   style={{ width: `${Math.min(100, Math.max(0, s.percentComplete))}%` }} />
                            </div>
                          </div>
                        )}
                        {/* The rail side of the same cargo. Derived, and the
                            wagon series is a classification, so both are worded
                            as consequences rather than as readings. */}
                        {/* Where a ship's agent is also a registered rail
                            vehicle keeper, the same company appears on both
                            sides of the quay. */}
                        {s.agentIsRailKeeper?.length > 0 && (
                          <div className="mt-1 text-[9.5px] font-mono text-sky-400/90 truncate">
                            Agent je tudi imetnik vagonov: {s.agentIsRailKeeper.map((k: any) => `${k.vkm}`).join(', ')}
                          </div>
                        )}
                        {s.rail?.isFreight ? (
                          <>
                            <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono">
                              <span className="text-slate-400">
                                ≈ <strong className="text-amber-300">{Number(s.rail.railTonnes).toLocaleString('sl-SI')} t</strong> po tiru
                              </span>
                              <span className="text-slate-400 text-right">
                                ≈ <strong className="text-sky-300">{s.rail.wagonsAtPortAverage}</strong> vagonov
                                {s.rail.wagonSeries && <span className="text-slate-500"> {s.rail.wagonSeries}</span>}
                                {s.rail.trains > 0 && <> · <strong className="text-emerald-300">{s.rail.trains}</strong> vlakov</>}
                              </span>
                            </div>
                            {/* The national rail share for this commodity
                                class. Deliberately not multiplied into the
                                figure above — the port's 51 % and this are
                                different populations — but it says which way
                                the port average is likely to be wrong for this
                                particular cargo. */}
                            {s.rail.nationalCommodityShare && (
                              <div className="mt-1 flex items-center justify-between gap-2 text-[9.5px] font-mono">
                                <span className="text-slate-500 truncate">
                                  {s.rail.nationalCommodityShare.nst07} nacionalno
                                </span>
                                <span className={
                                  s.rail.nationalCommodityShare.railSharePercent >= 51
                                    ? 'text-emerald-400/90 shrink-0'
                                    : 'text-amber-400/80 shrink-0'
                                }>
                                  {Number(s.rail.nationalCommodityShare.railSharePercent).toLocaleString('sl-SI')} % po tiru
                                  <span className="text-slate-600">
                                    {' '}({s.rail.nationalCommodityShare.railSharePercent >= 51 ? 'nad' : 'pod'} 51 %)
                                  </span>
                                </span>
                              </div>
                            )}
                          </>
                        ) : s.rail?.note ? (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-500">
                            {s.rail.note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {koperShips.arriving?.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Najavljeni prihodi</span>
                      {koperShips.arriving.slice(0, 6).map((a: any, i: number) => (
                        <div key={`${a.callNumber}-${i}`} className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
                          <span className="text-slate-200 truncate">
                            {a.vessel}
                            {a.agentIsRailKeeper?.length > 0 && (
                              <span className="text-sky-400/90" title={`Agent ${a.agent} je registriran imetnik železniških vozil`}>
                                {' '}· VKM {a.agentIsRailKeeper.map((k: any) => k.vkm).join(', ')}
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 shrink-0 truncate max-w-[55%] text-right">
                            {a.cargo}{a.cargoTonnes ? ` · ${Number(a.cargoTonnes).toLocaleString('sl-SI')} t` : ''}
                            {a.rail?.isFreight && a.rail.wagonsAtPortAverage
                              ? ` → ${a.rail.wagonsAtPortAverage} vag.`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {koperShips.outboundLine && (
                    <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                      Vse to zapušča pristanišče po isti progi:{' '}
                      <strong className="text-slate-200">
                        {koperShips.outboundLine.from} → {koperShips.outboundLine.to}, {koperShips.outboundLine.km} km
                      </strong>{' '}
                      prek {koperShips.outboundLine.operationalPoints} službenih mest (RINF). {koperShips.outboundLine.note}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 leading-relaxed pt-1 border-t border-slate-800">
                    Ladje, tovor in tonaža so v živo iz Luke Koper. Pretvorba v vagone in vlake je{' '}
                    <span className="text-amber-400/90">izračun</span>, ne meritev: {koperShips.basis?.railSharePercent} % tovora po tiru,{' '}
                    {koperShips.basis?.tonnesPerTrain} t na vlak in {koperShips.basis?.tonnesPerWagon} t na vagon so povprečja,
                    izpeljana iz objavljenih letnih številk pristanišča za {koperShips.basis?.reportingYear}
                    {' '}({Number(koperShips.basis?.annualTrains).toLocaleString('sl-SI')} vlakov,{' '}
                    {Number(koperShips.basis?.annualWagons).toLocaleString('sl-SI')} vagonov). Tip vagona je uvrstitev po vrsti tovora.
                    {koperShips.commoditySplit && (
                      <span className="block mt-1">
                        Vrstica pod vsako ladjo pove, koliko te blagovne skupine gre po tiru{' '}
                        <strong className="text-slate-300">v vsej Sloveniji</strong> ({koperShips.commoditySplit.year},{' '}
                        {koperShips.commoditySplit.source}) — od {' '}
                        {Math.min(...koperShips.commoditySplit.groups.map((g: any) => g.railSharePercent)).toLocaleString('sl-SI')} %
                        do {Math.max(...koperShips.commoditySplit.groups.map((g: any) => g.railSharePercent)).toLocaleString('sl-SI')} % glede na tovor.
                        To ni delež Luke Koper in ni vračunano v številke zgoraj; pove le, v katero smer je pristaniško povprečje za ta tovor verjetno napačno.
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-emerald-400/80 font-mono break-words">
                    Vir: {koperShips.shipSource} · osveženo {new Date(koperShips.updatedAt).toLocaleTimeString('sl-SI')}
                  </p>
                </div>
              )}

              {/* Outbound Corridors Breakdown */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <TrendingUp size={14} className="text-amber-400" />
                  Glavni Zaledni Železniški Koridorji iz Luke Koper
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(pipelineData?.corridors || []).map((cor: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{cor.destinationCountry}</span>
                      </div>
                      {/* The per-corridor share and trains-per-day shown here
                          were invented and are gone; the route is real. */}
                      <div className="text-[10px] text-slate-500 break-words">
                        Trasa: {cor.primaryRoute}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Infrastructure Notice: Divača-Koper Incline & 2. Tir */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-amber-300">
                    Ozkotirno gorsko ozko grlo: Kraški klanec (26 ‰) & Gradnja II. tira
                  </h4>
                  <p className="text-slate-300 leading-relaxed">
                    Sedanja enotirna proga Koper – Divača z naklonom do 26 ‰ zahteva obvezno vprego ali doprego dveh električnih lokomotiv 
                    (SŽ 541 Siemens Taurus ali Vectron), kar omejuje skupno maso vlaka na cca. 1.500 ton.
                    Z zagonom <strong>II. tira Divača–Koper</strong> se bo dnevna prepustnost povečala z današnjih 82 na več kot <strong>220 tovornih vlakov/dan</strong>, 
                    maksimalna dolžina kompozicij pa bo znašala polnih 740 metrov po standardih TEN-T.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DIGITAL TWIN OF FREIGHT YARDS & TERMINALS */}
          {activeTab === 'yards' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Search filter */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Išči po postajah (npr. Zalog, Koper, Hodoš, Moste, žito, kontejnerji)..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredTerminals.map(terminal => (
                  <div 
                    key={terminal.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-amber-500/40 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                              {terminal.name}
                            </h4>
                            {terminal.code && (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-white/10 text-slate-300">
                                {terminal.code}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-amber-400">
                            {terminal.category}
                          </span>
                          {/* Whether the Commission designates this place, as
                              opposed to it simply being a working freight
                              yard. Most on this list are the latter. */}
                          {terminal.tenT && (
                            <div className="mt-1">
                              {terminal.tenT.designated ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-300">
                                  TEN-T {terminal.tenT.kind === 'port' ? 'pristanišče' : 'terminal'} · {terminal.tenT.network === 'core' ? 'jedrno' : 'celovito'}
                                  {terminal.tenT.corridors ? ` · ${terminal.tenT.corridors}` : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-slate-700/40 border border-slate-600/40 text-slate-400">
                                  ni vozlišče TEN-T
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                          {terminal.tracks} tirov
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mb-3">
                        {terminal.description}
                      </p>

                      {/* Technical Specs Tags */}
                      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono mb-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60">
                        <div>
                          <span className="text-slate-500 block text-[9.5px]">TSI Osni razred:</span>
                          <span className="text-slate-200 font-semibold">{terminal.tsiAxleLoad || 'D4 (22.5 t/os)'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9.5px]">Elektrifikacija:</span>
                          <span className="text-slate-200 font-semibold">{terminal.electrified || '3 kV DC'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9.5px]">Max dolžina vlaka:</span>
                          <span className="text-slate-200 font-semibold">{terminal.maxTrainLengthM} m</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9.5px]">Frekvenca prometa:</span>
                          <span className="text-slate-400 font-semibold">{terminal.dailyBlockTrains || 'ni objavljeno'}</span>
                        </div>
                      </div>

                      {/* Cargo tags */}
                      {terminal.cargoTypes && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {terminal.cargoTypes.map((c: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9.5px] bg-slate-800/80 text-slate-400 border border-slate-700/40">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {terminal.status || 'Operativen'}
                      </span>
                      <button
                        onClick={() => {
                          if (onFlyTo && terminal.lat && terminal.lon) {
                            onFlyTo([terminal.lon, terminal.lat], 15.5);
                            onClose();
                          }
                          if (onSelectTerminal) onSelectTerminal(terminal);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Navigation size={12} />
                        <span>Pokaži na zemljevidu</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TEN-T CORRIDOR CAPACITY & AVAILABLE SLOTS */}
          {activeTab === 'corridors' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge size={16} className="text-amber-400" />
                    Analizator Prepustnosti & Prostih Tovornih Tras (Capacity Slots)
                  </h3>
                  <span className="px-2.5 py-1 rounded-full text-[10.5px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {corridorsData?.openFreightSlotsEstimateTotal ?? 134} Prostih Tras Danes
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Izračun temelji na križanju voznih redov potniških vlakov (HAFAS in SŽ) s tehnično kapaciteto proge (RINF). 
                  Tovorni vlaki imajo največje število prostih oken v nočnem času med 22:00 in 05:00.
                </p>
              </div>

              {/* SŽ-Infrastruktura Capacity Strategy 2026: the infrastructure
                  manager's own published supply of train paths per hour per
                  section. Official, transcribed, non-binding — and says so. */}
              {capacityStrategy && (() => {
                const fmt = (v: any) => v == null ? 'nesist.' : String(v).replace('.', ',');
                const rows = capacityStrategy.mainLines as any[];
                const maxF = Math.max(1, ...rows.map(r => r.freightTotal || 0));
                return (
                  <div id="panel-capacity" className="p-4 rounded-xl bg-slate-900/70 border border-amber-500/25 space-y-3 scroll-mt-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-white">Uradna ponudba vlakovnih poti — SŽ-Infrastruktura, vozni red {capacityStrategy.timetable}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{capacityStrategy.unit} · potniške (daljinske + regionalne) proti tovornim (mednarodne + nacionalne)</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">registrski podatek, ne vlak · nezavezujoče</span>
                    </div>

                    <div className="space-y-1.5">
                      {rows.map((r: any) => (
                        <div key={r.section} className="space-y-0.5">
                          <div className="flex items-baseline justify-between gap-2 text-[11px]">
                            <span className="text-slate-200 font-medium truncate">
                              {r.section}
                              {r.rinfLines?.length ? <span className="text-slate-500 font-mono"> · proga {r.rinfLines.join('/')}</span> : null}
                            </span>
                            <span className="font-mono text-slate-300 shrink-0">
                              <span className="text-amber-300">{fmt(r.freightInternational)}</span>
                              <span className="text-slate-500"> + </span>
                              <span className="text-amber-300/80">{fmt(r.freightNational)}</span>
                              <span className="text-slate-500"> tovor · </span>
                              <span className="text-sky-300">{fmt(r.passengerLongDistance)}</span>
                              <span className="text-slate-500"> + </span>
                              <span className="text-sky-300/80">{fmt(r.passengerRegional)}</span>
                              <span className="text-slate-500"> potn.</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                            <div className="h-full bg-amber-400" style={{ width: `${(r.freightTotal / maxF) * 60}%` }} title={`tovor ${r.freightTotal}/h`} />
                            <div className="h-full bg-sky-400/70" style={{ width: `${(r.passengerTotal / maxF) * 60}%` }} title={`potniški ${r.passengerTotal}/h`} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-2">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">Mejni odseki — tovorne poti/uro (usklajeno s sosednjim upravljavcem)</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5">
                        {capacityStrategy.borderSections.map((b: any) => (
                          <div key={b.section} className="flex items-baseline justify-between gap-2 text-[10.5px]" title={b.harmonisationNote || ''}>
                            <span className="text-slate-400 truncate">{b.country} · {b.section}{b.harmonised ? '' : ' *'}</span>
                            <span className="font-mono text-amber-300 shrink-0">{fmt(b.freightInternational)}</span>
                          </div>
                        ))}
                      </div>
                      {capacityStrategy.borderSections.some((b: any) => !b.harmonised) && (
                        <p className="text-[9.5px] text-slate-500 mt-1">* ponudba ni usklajena s sosednjim upravljavcem (Hodoš / Őriszentpéter)</p>
                      )}
                    </div>

                    {capacityStrategy.capacityChanges2026?.additional?.length > 0 && (
                      <details className="border-t border-slate-800 pt-2">
                        <summary className="text-[10.5px] text-slate-300 cursor-pointer select-none">
                          Projekti, ki spreminjajo zmogljivost ({capacityStrategy.capacityChanges2026.additional.length}) in večje omejitve (TCR) 2026
                        </summary>
                        <ul className="mt-1.5 space-y-1">
                          {capacityStrategy.capacityChanges2026.additional.map((p: any) => (
                            <li key={p.project} className="text-[10px] leading-snug text-slate-400">
                              <span className="text-slate-200 font-medium">{p.project}</span> — {p.effect} <span className="text-slate-500">({p.status})</span>
                            </li>
                          ))}
                        </ul>
                        <div className="text-[10px] text-slate-400 mt-1.5">
                          <span className="text-slate-300 font-medium">Večje TCR 2026:</span> {capacityStrategy.tcr2026?.majorProjects?.join('; ')}
                        </div>
                      </details>
                    )}

                    <p className="text-[9.5px] leading-snug text-slate-500">
                      {capacityStrategy.note} Vir: {capacityStrategy.source}; {capacityStrategy.validation}
                    </p>
                  </div>
                );
              })()}

              {/* RNE RFC KPIs: the only public, official count of international
                  freight trains at Slovenia's borders — last year's totals from
                  TIS, per corridor, as each corridor published them. */}
              {rfcKpis && (() => {
                const n = (v: any) => v == null ? '—' : Number(v).toLocaleString('sl-SI');
                const borders = Object.entries(rfcKpis.sloveniaBordersByStation || {}) as [string, any[]][];
                const maxTrains = Math.max(1, ...borders.flatMap(([, arr]) => arr.map(b => b.trains?.['2024'] || 0)));
                return (
                  <div id="panel-rfc-kpis" className="p-4 rounded-xl bg-slate-900/70 border border-violet-500/25 space-y-3 scroll-mt-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-white">Mednarodni tovorni vlaki na slovenskih mejah — uradni KPI koridorjev RFC (2024)</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">RFC 5 Baltik–Jadran · RFC 6 Mediteran · RFC 11 Amber · letni agregati iz RNE TIS, kot jih objavlja vsak koridor</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono bg-violet-500/15 text-violet-300 border border-violet-500/30">lanski števec, ne položaj</span>
                    </div>

                    <div className="space-y-2">
                      {borders.map(([station, arr]) => (
                        <div key={station} className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-200">{station} <span className="text-slate-500 font-normal">· {arr[0].border} ({arr[0].countries})</span></div>
                          {arr.map((b: any) => (
                            <div key={b.corridor} className="space-y-0.5">
                              <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                                <span className="text-slate-400">{b.corridor} <span className="text-slate-600">{b.corridorName}</span></span>
                                <span className="font-mono text-slate-200">
                                  <span className="text-slate-500">{n(b.trains?.['2022'])} · {n(b.trains?.['2023'])} · </span>
                                  <span className="text-violet-300">{n(b.trains?.['2024'])}</span>
                                  {b.change2024Pct != null && <span className={b.change2024Pct >= 0 ? ' text-emerald-400' : ' text-rose-400'}> {b.change2024Pct >= 0 ? '+' : ''}{String(b.change2024Pct).replace('.', ',')} %</span>}
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(2, ((b.trains?.['2024'] || 0) / maxTrains) * 100)}%` }} />
                              </div>
                              <div className="text-[9.5px] text-slate-500 flex flex-wrap gap-x-3">
                                {b.trainKm2024 != null && <span>{n(b.trainKm2024)} vlak-km (2024)</span>}
                                {b.dwellMin2024 && <span>zadrževanje na meji: načrt {b.dwellMin2024.planned} min · dejansko <span className={b.dwellMin2024.real > b.dwellMin2024.planned ? 'text-amber-300' : 'text-emerald-300'}>{b.dwellMin2024.real} min</span></span>}
                                {b.cossAllocationPct?.['2024'] != null && <span>C-OSS dodelil: {String(b.cossAllocationPct['2024']).replace('.', ',')}{typeof b.cossAllocationPct['2024'] === 'number' ? ' %' : ''}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {rfcKpis.corridors.map((c: any) => {
                        const p = c.operations?.punctualityPct || {};
                        return (
                          <div key={c.id} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 space-y-0.5">
                            <div className="text-[10.5px] font-semibold text-slate-200">{c.id} · {c.name}</div>
                            <div className="text-[10px] text-slate-400">vlakov na koridorju 2024: <span className="font-mono text-slate-200">{n(c.operations?.trains?.['2024'])}</span>{c.operations?.trainKmMio?.['2024'] != null && <> · {String(c.operations.trainKmMio['2024']).replace('.', ',')} mio vlak-km</>}</div>
                            <div className="text-[10px] text-slate-400">točnost ≤30 min 2024: vstop <span className="font-mono text-slate-200">{p.entryWithin30?.['2024']} %</span> · izstop <span className="font-mono text-slate-200">{p.exitWithin30?.['2024']} %</span></div>
                            {c.capacity?.preBookedRatioPct?.['TT2026'] != null && <div className="text-[10px] text-slate-400">PaP TT2026: ponujeno {String(c.capacity.offeredPapMioPathKm?.['TT2026']).replace('.', ',')} mio poti-km, vnaprej rezervirano {String(c.capacity.preBookedRatioPct['TT2026']).replace('.', ',')} %</div>}
                            {(c.papPlannedSpeedKmh || []).slice(0, 2).map((s: any) => (
                              <div key={s.section} className="text-[9.5px] text-slate-500">PaP {s.section} ({s.lengthKm} km): {String(s.TT2026 ?? s.TT2025).replace('.', ',')} km/h</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[9.5px] leading-snug text-slate-500">
                      {rfcKpis.definitions?.trainsPerBorder} {rfcKpis.definitions?.rfcTrain} Vir: {rfcKpis.source}.
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-4">
                {(corridorsData?.corridors || []).map((cor: any) => (
                  <div key={cor.id} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="font-bold text-sm text-amber-300">{cor.name}</h4>
                        <p className="text-[11px] text-slate-400">{cor.alignment}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10.5px] font-mono text-slate-400">
                        <span>Dolžina: <strong className="text-white">{cor.totalLengthKmInSi} km</strong></span>
                        <span>·</span>
                        <span>Vleka: <strong className="text-white">{cor.electrification}</strong></span>
                      </div>
                    </div>

                    {/* Sector cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(cor.criticalSectors || []).map((sec: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white truncate max-w-[200px]">{sec.sector}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/10 text-slate-300">
                              {sec.tracks} {sec.tracks === 1 ? 'tir' : 'tira'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>Vzpon: <strong className="text-amber-300">{sec.maxGradientPermil} ‰</strong></span>
                            <span>Zasedenost: <strong className={sec.currentUtilizationPercent > 85 ? 'text-rose-400' : 'text-emerald-400'}>{sec.currentUtilizationPercent} %</strong></span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${sec.currentUtilizationPercent > 85 ? 'bg-rose-500' : 'bg-amber-400'}`}
                              style={{ width: `${sec.currentUtilizationPercent}%` }}
                            ></div>
                          </div>

                          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                            <span>Proste tovorne trase:</span>
                            <span className="font-bold font-mono text-emerald-400">+{sec.availableDailySlots} oken/dan</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MODAL SPLIT & ECOLOGY (ROAD VS RAIL) */}
          {activeTab === 'modalsplit' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <Leaf size={22} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold text-emerald-300 text-sm">
                    Ekološki & Logistični Učinek: Cesta (DARS A1) vs. Tir (Slovenske Železnice)
                  </h3>
                  <p className="text-slate-300 leading-relaxed">
                    Slovenski železniški tovorni promet z visoko stopnjo elektrifikacije (3 kV DC) in uporabo zelene električne energije
                    dnevno preusmeri na tisoče težkih tovornjakov z avtocestnega križa A1 (Koper – Ljubljana – Maribor) in A5 (Pomurje).
                  </p>
                </div>
              </div>

              {/* Sourced national figures. The three cards that stood here —
                  1.452 t of CO2 a day, 2.420 lorries removed, 485.000 L of
                  diesel — were constants with no origin, and they implied rail
                  carries most Slovenian freight when Eurostat puts it near a
                  sixth. Only what the statistics support is shown, and the one
                  derived number is labelled as derived. */}
              {modalSplitData?.tonneKm ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 text-center space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Delež železnice</span>
                      <div className="text-3xl font-bold font-mono text-amber-400">{modalSplitData.tonneKm.railSharePercent} %</div>
                      <span className="text-[11px] text-slate-400">tonskih kilometrov ({modalSplitData.year})</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-sky-500/20 text-center space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Železnica</span>
                      <div className="text-3xl font-bold font-mono text-sky-400">{Number(modalSplitData.tonneKm.rail).toLocaleString('sl-SI')}</div>
                      <span className="text-[11px] text-slate-400">mio t·km · {Number(modalSplitData.tonnes.rail).toLocaleString('sl-SI')} tis. ton</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-rose-500/20 text-center space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cesta</span>
                      <div className="text-3xl font-bold font-mono text-rose-400">{Number(modalSplitData.tonneKm.road).toLocaleString('sl-SI')}</div>
                      <span className="text-[11px] text-slate-400">mio t·km · {Number(modalSplitData.tonnes.road).toLocaleString('sl-SI')} tis. ton</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <span className="font-bold text-white">Delitev tovora v Sloveniji ({modalSplitData.year})</span>
                      <span className="text-[10px] text-emerald-400/80 font-mono">Vir: {modalSplitData.source}</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-700/60 p-0.5">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-l-full" style={{ width: `${modalSplitData.tonneKm.railSharePercent}%` }}></div>
                      <div className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-r-full" style={{ width: `${100 - modalSplitData.tonneKm.railSharePercent}%` }}></div>
                    </div>
                    {modalSplitData.co2 && (
                      <p className="text-[10.5px] text-slate-400 leading-relaxed">
                        Ob {Number(modalSplitData.co2.railGramsPerTonneKm)} g CO2/t·km za železnico in {Number(modalSplitData.co2.roadGramsPerTonneKm)} g za cesto
                        bi prenos teh tonskih kilometrov na cesto pomenil dodatnih
                        <strong className="text-emerald-400"> {Number(modalSplitData.co2.avoidedTonnesCo2PerYear).toLocaleString('sl-SI')} t CO2 </strong>
                        na leto. <span className="text-amber-400/80">Izračun, ne meritev</span> — temelji na zgoraj navedenih faktorjih.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">
                  Nalagam uradne statistike (Eurostat) …
                </div>
              )}

              {/* Emission factors, read from the same place the CO2 figure above
                  is derived from. This table used to hardcode a different pair
                  (14,8 and 82,4 g/t·km) than the calculation it sat beside, and
                  closed with an unsourced €32m asphalt saving. One set of
                  factors now feeds both, and they are labelled as assumptions. */}
              {modalSplitData?.co2 && (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Uporabljeni referenčni faktorji (g CO2 / t·km)
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1 font-mono gap-2">
                        <span className="text-emerald-400 font-bold">🚂 Železnica</span>
                        <span className="text-emerald-400 font-bold shrink-0">{modalSplitData.co2.railGramsPerTonneKm} g / t·km</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(modalSplitData.co2.railGramsPerTonneKm / modalSplitData.co2.roadGramsPerTonneKm) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 font-mono gap-2">
                        <span className="text-rose-400 font-bold">🚛 Cestni tovorni promet</span>
                        <span className="text-rose-400 font-bold shrink-0">{modalSplitData.co2.roadGramsPerTonneKm} g / t·km</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 leading-relaxed">
                    Razmerje <strong className="text-white">{(modalSplitData.co2.roadGramsPerTonneKm / modalSplitData.co2.railGramsPerTonneKm).toFixed(1)}×</strong> v korist železnice.
                    Tonski kilometri zgoraj so uradna statistika Eurostata.
                    {' '}<span className="text-amber-400/90">Ta dva faktorja pa nimata navedenega vira</span> — sta privzeti vrednosti,
                    zato je izračunani prihranek CO2 ocena in ne podatek.
                  </p>
                </div>
              )}

              {/* SURS: where the freight actually goes. Real annual tonnage
                  from the national statistical office, by partner country —
                  what the Eurostat share above does not break out. */}
              {sursFlows && (
                <div id="panel-surs" className="space-y-3 pt-2 scroll-mt-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold text-white text-sm">Kam gre slovenski železniški tovor ({sursFlows.latestYear})</h3>
                    <span className="text-[10px] font-mono text-slate-400">vir: SURS · {sursFlows.unit}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { title: 'Naloženo v SI → namembna država', rows: sursFlows.loadedInSlovenia.countries, total: sursFlows.loadedInSlovenia.totalThousand, bar: 'bg-amber-400' },
                      { title: 'Razloženo v SI ← država nakladanja', rows: sursFlows.unloadedInSlovenia.countries, total: sursFlows.unloadedInSlovenia.totalThousand, bar: 'bg-sky-400' },
                      { title: 'Tranzit skozi SI (od → do)', pairs: sursFlows.transit.pairs, total: sursFlows.transit.totalThousand, bar: 'bg-violet-400' }
                    ].map((col, ci) => {
                      const items: { label: string; v: number }[] = col.pairs
                        ? col.pairs.map((p: any) => ({ label: `${p.from} → ${p.to}`, v: p.tonnesThousand }))
                        : col.rows.map((r: any) => ({ label: r.country, v: r.tonnesThousand }));
                      const max = items.length ? items[0].v : 1;
                      return (
                        <div key={ci} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="text-[11px] font-semibold text-slate-300 leading-tight min-h-[28px]">{col.title}</div>
                          <div className="space-y-1">
                            {items.slice(0, 8).map((it, i) => (
                              <div key={i} className="space-y-0.5">
                                <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                                  <span className="text-slate-300 truncate">{it.label}</span>
                                  <span className="font-mono text-white shrink-0">{Number(it.v).toLocaleString('sl-SI')}</span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${col.bar}`} style={{ width: `${Math.max(3, (it.v / max) * 100)}%` }}></div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {col.total != null && (
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                              skupaj {Number(col.total).toLocaleString('sl-SI')} tis. ton
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                    {sursFlows.note} Vir: {sursFlows.source} (SiStat {Object.values(sursFlows.matrices).join(', ')}).
                    To so letne tone, ne položaji vlakov — natančnejša slika tokov, ne lokacija posameznega vlaka.
                  </p>
                </div>
              )}

              {/* Eurostat: what the freight is (NST 2007 groups), quarter by
                  quarter, intermodal units, and both partner-country
                  directions. Everything SURS above does not break out. */}
              {eurostat && (() => {
                const n = (v: any) => (v == null ? '—' : Number(v).toLocaleString('sl-SI'));
                const cm = eurostat.commodities, qt = eurostat.quarterly, im = eurostat.intermodal;
                const maxC = Math.max(1, ...((cm?.groups || []).map((g: any) => g.tonnesThousand || 0)));
                const maxQ = Math.max(1, ...((qt?.rows || []).flatMap((r: any) => [r.tonnesThousand || 0, r.yearEarlier || 0])));
                const maxI = Math.max(1, ...((im?.byYear || []).map((r: any) => r.tonnesThousand || 0)));
                return (
                  <div id="panel-eurostat" className="space-y-3 pt-2 scroll-mt-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-sm">Kaj, kdaj in s kom vozi železniški tovor v Sloveniji (Eurostat)</h3>
                      <span className="text-[10px] font-mono text-slate-400">vir: Eurostat · tisoč ton · {eurostat.licence}</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {cm && (
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-[11px] font-semibold text-slate-300">Vrste blaga (NST 2007), {cm.year}</div>
                            <div className="text-[10px] font-mono text-slate-400">skupaj {n(cm.total?.tonnesThousand)} · {cm.prevYear}: {n(cm.totalTenYearsAgo)}</div>
                          </div>
                          <div className="space-y-1">
                            {cm.groups.slice(0, 12).map((g: any) => (
                              <div key={g.code} className="space-y-0.5" title={`${g.code} · ${g.label} · ${n(g.tkmMio)} mio t·km`}>
                                <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                                  <span className="text-slate-300 truncate">{g.labelSl || g.label}</span>
                                  <span className="font-mono text-white shrink-0">
                                    {n(g.tonnesThousand)}
                                    {g.tonnesThousandTenYearsAgo != null && g.tonnesThousandTenYearsAgo > 0 && (
                                      <span className={`ml-1.5 text-[9.5px] ${g.tonnesThousand >= g.tonnesThousandTenYearsAgo ? 'text-emerald-300' : 'text-rose-300'}`}>
                                        {g.tonnesThousand >= g.tonnesThousandTenYearsAgo ? '+' : ''}{Math.round(((g.tonnesThousand - g.tonnesThousandTenYearsAgo) / g.tonnesThousandTenYearsAgo) * 100)} % / 10 let
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(2, ((g.tonnesThousand || 0) / maxC) * 100)}%` }}></div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {cm.labelSlTranslatedByApp && (
                            <div className="text-[9.5px] text-slate-500 pt-1 border-t border-slate-800">Slovenska imena skupin so prevod aplikacije; kode in vrednosti so Eurostatove (rail_go_grpgood, posodobljeno {cm.updated}).</div>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        {qt && (
                          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-[11px] font-semibold text-slate-300">Po četrtletjih, do {qt.latestQuarter}</div>
                              <div className="text-[10px] font-mono text-slate-400">svetlo: isto četrtletje leto prej</div>
                            </div>
                            <div className="flex items-end gap-1 h-24">
                              {qt.rows.map((r: any) => (
                                <div key={r.quarter} className="flex-1 flex items-end gap-px h-full" title={`${r.quarter}: ${n(r.tonnesThousand)} tis. t (leto prej ${n(r.yearEarlier)})`}>
                                  <div className="flex-1 rounded-t bg-sky-900/70" style={{ height: `${((r.yearEarlier || 0) / maxQ) * 100}%` }}></div>
                                  <div className="flex-1 rounded-t bg-sky-400" style={{ height: `${((r.tonnesThousand || 0) / maxQ) * 100}%` }}></div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between text-[9px] font-mono text-slate-500">
                              <span>{qt.rows[0]?.quarter}</span>
                              <span>{qt.rows[qt.rows.length - 1]?.quarter}: {n(qt.rows[qt.rows.length - 1]?.tonnesThousand)} tis. t</span>
                            </div>
                          </div>
                        )}
                        {im && (
                          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                            <div className="text-[11px] font-semibold text-slate-300">Kontejnerji in zamenljiva tovorišča, {im.latestYear}</div>
                            <div className="flex items-end gap-1 h-14">
                              {im.byYear.map((r: any) => (
                                <div key={r.year} className="flex-1 flex flex-col items-center justify-end h-full" title={`${r.year}: ${n(r.tonnesThousand)} tis. t`}>
                                  <div className="w-full rounded-t bg-violet-400" style={{ height: `${((r.tonnesThousand || 0) / maxI) * 100}%` }}></div>
                                  <span className="text-[8.5px] font-mono text-slate-500">{String(r.year).slice(2)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono text-slate-300">
                              {im.split.map((s: any) => <span key={s.code}>{s.label}: <span className="text-white">{n(s.tonnesThousand)}</span></span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {(eurostat.loadingCountry || eurostat.unloadingCountry) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { t: `Mednarodno: država nakladanja → SI, ${eurostat.loadingCountry?.year}`, d: eurostat.loadingCountry, bar: 'bg-sky-400' },
                          { t: `Mednarodno: SI → država razkladanja, ${eurostat.unloadingCountry?.year}`, d: eurostat.unloadingCountry, bar: 'bg-amber-400' }
                        ].filter(x => x.d).map((x, i) => {
                          const max = x.d.rows[0]?.tonnesThousand || 1;
                          return (
                            <div key={i} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-300">{x.t}</div>
                              {x.d.rows.map((r: any) => (
                                <div key={r.code} className="space-y-0.5">
                                  <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                                    <span className="text-slate-300 truncate">{r.label}</span>
                                    <span className="font-mono text-white shrink-0">{n(r.tonnesThousand)}</span>
                                  </div>
                                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${x.bar}`} style={{ width: `${Math.max(2, (r.tonnesThousand / max) * 100)}%` }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                      Eurostat, kocke rail_go_grpgood, rail_go_quartal, rail_go_contwgt, rail_go_intcmgn, rail_go_intgong (prebrano {String(eurostat.retrieved).slice(0, 10)}).
                      Letne in četrtletne tone, kot jih poroča SURS Eurostatu — statistika tokov, ne položaji vlakov.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 5: UIC ROLLING STOCK & WAGON DECODER */}
          {activeTab === 'registers' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Four registers were being consulted server-side with nothing
                  on screen to show them. This is that data, searchable. */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-fit flex-wrap">
                {[
                  { k: 'vkm', label: 'Imetniki vozil (VKM)' },
                  { k: 'operators', label: 'Prevozniki (ERA)' },
                  { k: 'lines', label: 'Proge SŽ' },
                  { k: 'vehicles', label: 'Tipi vozil (ERATV)' },
                  { k: 'terms', label: 'Izrazje (IATE)' },
                  { k: 'params', label: 'Parametri in TSI (ERA)' },
                  { k: 'freightStations', label: 'Tovorne postaje (DIUM)' },
                  { k: 'commodities', label: 'Blagovne šifre (NHM)' },
                  { k: 'rcc', label: 'Združljivost s progo (RCC)' }
                ].map(t => (
                  <button
                    key={t.k}
                    onClick={() => {
                      setRegisterKind(t.k as any); setRegisterResults(null); setEratvDetail(null);
                      if (t.k === 'vehicles' && !eratvData) {
                        fetch('/api/eratv/slovenia').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setEratvData(j); }).catch(() => {});
                      }
                      if (t.k === 'terms' && !glossary) {
                        fetch('/api/glossary/rail').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setGlossary(j); }).catch(() => {});
                      }
                      if (t.k === 'params' && !paramTable) {
                        fetch('/api/era/parameters').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setParamTable(j); }).catch(() => {});
                      }
                      if (t.k === 'freightStations' && !diumData) {
                        fetch('/api/dium/slovenia').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setDiumData(j); }).catch(() => {});
                      }
                      if (t.k === 'commodities' && !nhmData) {
                        fetch('/api/freight/nhm?rail=1').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setNhmData(j); }).catch(() => {});
                      }
                      if (t.k === 'rcc' && !rccLocos) {
                        fetch('/api/rcc/locomotives').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setRccLocos(j); }).catch(() => {});
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      registerKind === t.k
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {registerKind !== 'lines' && registerKind !== 'rcc' && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (registerKind === 'params') {
                      fetch(`/api/era/parameters?q=${encodeURIComponent(registerQuery)}${paramsNetworkOnly ? '&network=1' : ''}`)
                        .then(r => r.json()).then(setParamTable).catch(() => {});
                      return;
                    }
                    if (registerKind === 'terms') {
                      fetch(`/api/glossary/rail?q=${encodeURIComponent(registerQuery)}`)
                        .then(r => r.json()).then(setGlossary).catch(() => {});
                      return;
                    }
                    if (registerKind === 'commodities') {
                      setNhmCode(null);
                      fetch(`/api/freight/nhm?q=${encodeURIComponent(registerQuery)}`)
                        .then(r => r.json()).then(setNhmData).catch(() => {});
                      return;
                    }
                    if (registerKind === 'freightStations') {
                      setDiumStation(null);
                      fetch(`/api/dium/slovenia?q=${encodeURIComponent(registerQuery)}`)
                        .then(r => r.json()).then(setDiumData).catch(() => {});
                      return;
                    }
                    if (registerKind === 'vehicles') {
                      setEratvDetail(null);
                      fetch(`/api/eratv/slovenia?q=${encodeURIComponent(registerQuery)}`)
                        .then(r => r.json()).then(setEratvData).catch(() => {});
                      return;
                    }
                    const url = registerKind === 'vkm'
                      ? `/api/era/vkm?q=${encodeURIComponent(registerQuery)}`
                      : `/api/era/organisations?q=${encodeURIComponent(registerQuery)}`;
                    fetch(url).then(r => r.json()).then(setRegisterResults).catch(() => setRegisterResults(null));
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={registerQuery}
                    onChange={e => setRegisterQuery(e.target.value)}
                    placeholder={registerKind === 'vkm' ? 'Ime imetnika ali oznaka (npr. SZTP, Koper)' : registerKind === 'vehicles' ? 'Ime ali koda tipa (npr. 744, FLIRT, Vectron)' : registerKind === 'terms' ? 'Izraz (npr. profil, hitrost, ETCS)' : registerKind === 'params' ? 'Številka ali ime parametra (npr. 2.1.2, pantograph)' : registerKind === 'freightStations' ? 'Ime postaje, industrijskega tira ali šifra (npr. Koper, Cinkarna)' : registerKind === 'commodities' ? 'Blagovna šifra ali ime blaga (npr. 992110, premog, prazen vagon)' : 'Ime prevoznika (npr. Metrans, Adria)'}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button type="submit" className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shrink-0">
                    Išči
                  </button>
                </form>
              )}

              {registerKind === 'rcc' ? (
                rccLocos ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Združljivost vozila s progo (RCC)</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Izberi tip lokomotive; izračunam, po katerih odsekih slovenskega omrežja (RINF) sme tehnično voziti — po elektrifikaciji,
                        osni obremenitvi in zaščiti vlaka. Vsak izid je izračun iz registrskih vrednosti; kjer registra ne odločita, je »ročna presoja«.
                        <span className="text-amber-400/90"> Ni dovoljenje za vožnjo in ne položaj vlaka.</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {rccLocos.locomotives.map((l: any) => (
                        <button
                          key={l.id}
                          onClick={() => {
                            setRccResult(null); setRccLoading(true);
                            fetch(`/api/rcc/${l.id}`).then(r => (r.ok ? r.json() : null)).then(j => { if (j && !j.error) setRccResult(j); }).finally(() => setRccLoading(false));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                            rccResult?.locomotive?.id === l.id ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-amber-500/40'
                          }`}
                          title={l.voltageSummary}
                        >
                          {l.countryFlag} {l.name.replace(/\s*\(.*\)/, '')}
                        </button>
                      ))}
                    </div>

                    {rccLoading && <p className="text-[11px] text-slate-400">Računam združljivost…</p>}

                    {rccResult && (() => {
                      const total = rccResult.networkKm || 1;
                      const pct = (km: number) => Math.round((km / total) * 100);
                      const VS: Record<string, { t: string; c: string }> = {
                        'compatible': { t: 'združljivo', c: 'text-emerald-400' },
                        'not-compatible': { t: 'ni združljivo', c: 'text-rose-400' },
                        'manual-check': { t: 'ročna presoja', c: 'text-amber-400' },
                        'info': { t: 'info', c: 'text-slate-400' }
                      };
                      const PNAME: Record<string, string> = { loadCategory: 'osna obremenitev', electrification: 'elektrifikacija', trainProtection: 'zaščita vlaka' };
                      const blocked = Object.entries(rccResult.sections.reduce((acc: any, s: any) => { if (s.verdict !== 'compatible') (acc[s.verdict] ||= []).push(s); return acc; }, {}));
                      return (
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
                          <div>
                            <div className="text-sm font-bold text-white">{rccResult.locomotive.name}</div>
                            <div className="text-[10px] font-mono text-amber-200/70">
                              {rccResult.locomotive.axleLoadTonnes ?? '?'} t/os · do {rccResult.locomotive.maxSpeedKmh} km/h · {(rccResult.locomotive.voltageSystems || []).join(', ')}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {[['compatible', rccResult.summary.compatibleKm, 'bg-emerald-400'], ['not-compatible', rccResult.summary.notCompatibleKm, 'bg-rose-400'], ['manual-check', rccResult.summary.manualCheckKm, 'bg-amber-400']].map(([v, km, bar]: any) => (
                              <div key={v} className="space-y-0.5">
                                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                  <span className={VS[v].c}>{VS[v].t}</span>
                                  <span className="font-mono text-white">{Number(km).toLocaleString('sl-SI')} km ({pct(km)} %)</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(1, pct(km))}%` }} /></div>
                              </div>
                            ))}
                            <div className="text-[10px] text-slate-500">od skupno {Number(rccResult.networkKm).toLocaleString('sl-SI')} km omrežja RINF Slovenija</div>
                          </div>
                          {Object.keys(rccResult.blockingKmByParameter || {}).length > 0 && (
                            <div className="border-t border-white/10 pt-2">
                              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">Kaj blokira (km po parametru)</div>
                              {Object.entries(rccResult.blockingKmByParameter).sort((a: any, b: any) => b[1] - a[1]).map(([k, km]: any) => (
                                <div key={k} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                                  <span className="text-slate-300">{PNAME[k] || k}</span>
                                  <span className="font-mono text-slate-200">{Number(km).toLocaleString('sl-SI')} km</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {blocked.length > 0 && (
                            <div className="border-t border-white/10 pt-2">
                              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">Primeri odsekov</div>
                              <div className="space-y-1 max-h-52 overflow-y-auto">
                                {(blocked as any).flatMap(([v, arr]: any) => arr.slice(0, 6).map((s: any) => (
                                  <div key={s.sectionId} className="text-[10px] leading-snug">
                                    <span className={`font-semibold ${VS[s.verdict].c}`}>{VS[s.verdict].t}</span>
                                    <span className="text-slate-300"> · {s.from} – {s.to} ({s.lengthKm} km)</span>
                                    <div className="text-slate-500 pl-2">
                                      {Object.entries(s.parameters).filter(([, p]: any) => p.verdict === 'not-compatible' || p.verdict === 'manual-check').map(([k, p]: any) => `${PNAME[k] || k}: ${p.why}`).join(' · ')}
                                    </div>
                                  </div>
                                )))}
                              </div>
                            </div>
                          )}
                          <p className="text-[9px] leading-snug font-mono text-amber-200/60">{rccResult.disclaimer}</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Nalagam register lokomotiv…</p>
                )
              ) : registerKind === 'commodities' ? (
                nhmData ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Blagovne šifre NHM ({nhmData.counts.withCode})
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">
                          {nhmData.counts.nhmLevel} šestmestnih · {nhmData.counts.railChapters} železniških · velja od {nhmData.effective}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{nhmData.note}</p>
                      <p className="text-[10px] font-mono text-slate-500 break-words">{nhmData.source} · {nhmData.publisher}</p>
                      <p className="text-[10px] text-amber-300/80">{nhmData.slNote}</p>
                    </div>

                    {nhmCode && (
                      <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white">
                              {nhmCode.slIsCroatian ? nhmCode.en : nhmCode.sl}
                            </div>
                            <div className="text-[10px] font-mono text-amber-200/70">
                              NHM {nhmCode.display}
                              {!nhmCode.exact && ` · iskano ${nhmCode.asked}, najden nadrejeni zapis`}
                            </div>
                          </div>
                          <button onClick={() => setNhmCode(null)} className="text-[10px] text-slate-400 hover:text-white cursor-pointer shrink-0">zapri</button>
                        </div>
                        {nhmCode.slIsCroatian && (
                          <p className="text-[10px] text-amber-300/80 border-l-2 border-amber-500/40 pl-2">
                            V viru je v slovenskem stolpcu te šifre hrvaško besedilo („{nhmCode.sl}"), zato je zgoraj naveden angleški zapis.
                          </p>
                        )}
                        {nhmCode.en && !nhmCode.slIsCroatian && (
                          <div className="text-[11px] text-slate-300">{nhmCode.en}</div>
                        )}
                        {nhmCode.path?.length > 1 && (
                          <div className="border-t border-white/10 pt-2">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">Uvrstitev</div>
                            <div className="text-[10.5px] leading-snug text-slate-300">
                              {nhmCode.path.map((p: any, i: number) => (
                                <span key={i}>
                                  {i > 0 && <span className="text-slate-600"> › </span>}
                                  <span className={i === nhmCode.path.length - 1 ? 'text-white' : ''}>{p.sl}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {nhmCode.chapterNote && (
                          <p className="text-[10px] text-slate-400 border-l-2 border-slate-700 pl-2">{nhmCode.chapterNote}</p>
                        )}
                        {nhmCode.consignmentNote && (
                          <div className="border-t border-white/10 pt-2">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">Tovorni list CIM in carina</div>
                            <p className="text-[10.5px] leading-snug text-slate-300">{nhmCode.consignmentNote}</p>
                          </div>
                        )}
                        {nhmCode.footnote && (
                          <p className="text-[10px] text-slate-400 border-l-2 border-slate-700 pl-2">{nhmCode.footnote}</p>
                        )}
                        {nhmCode.subdivisions?.length > 0 && (
                          <div className="border-t border-white/10 pt-2">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">
                              Podrazdelitve ({nhmCode.subdivisions.length})
                            </div>
                            <div className="space-y-0.5">
                              {nhmCode.subdivisions.map((d: any) => (
                                <button
                                  key={d.code}
                                  onClick={() => fetch(`/api/freight/nhm/${d.code}`).then(r => (r.ok ? r.json() : null)).then(j => { if (j && !j.error) setNhmCode(j); }).catch(() => {})}
                                  className="w-full text-left text-[10.5px] text-slate-300 hover:text-white cursor-pointer flex gap-2"
                                >
                                  <span className="font-mono text-slate-500 shrink-0">{d.display}</span>
                                  <span className="truncate">{d.sl}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      {nhmData.codes.map((c: any) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            setNhmCode(null);
                            fetch(`/api/freight/nhm/${c.code}`).then(r => (r.ok ? r.json() : null)).then(j => { if (j && !j.error) setNhmCode(j); }).catch(() => {});
                          }}
                          className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{c.slIsCroatian ? c.en : c.sl}</div>
                            {c.en && !c.slIsCroatian && <div className="text-[10px] text-slate-400 truncate">{c.en}</div>}
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 shrink-0">{c.display}</span>
                        </button>
                      ))}
                      {nhmData.codes.length === 0 && (
                        <p className="text-[11px] text-slate-400">V nomenklaturi NHM ni šifre ali blaga, ki bi ustrezalo iskanju.</p>
                      )}
                      {nhmData.truncated && (
                        <p className="text-[10px] text-slate-500">Prikazanih je prvih 200 zadetkov; zožite iskanje.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Berem nomenklaturo NHM…</p>
                )
              ) : registerKind === 'freightStations' ? (
                diumData ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Postaje, odprte za tovorni promet ({diumData.counts.stations})
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">
                          {diumData.counts.loadingPlaces} krajev prevzema/izročitve · {diumData.counts.intermodalTerminals} ITE terminali · {diumData.counts.borderPoints} mejnih prehodov
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{diumData.note}</p>
                      <p className="text-[10px] font-mono text-slate-500 break-words">
                        {diumData.source} · izdaja {diumData.edition} · {diumData.copyright}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">
                        {diumData.counts.stationsWithRinf} od {diumData.counts.stations} postaj ima koordinate iz registra RINF (ujemanje po isti šifri službenega mesta).
                      </p>
                    </div>

                    {diumStation && (
                      <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-white">{diumStation.name}</div>
                            <div className="text-[10px] font-mono text-amber-200/70">
                              UIC {diumStation.uic}{diumStation.rinf ? ` · RINF ${diumStation.rinf.uopid}` : ' · ni v registru RINF'}
                            </div>
                          </div>
                          <button onClick={() => setDiumStation(null)} className="text-[10px] text-slate-400 hover:text-white cursor-pointer shrink-0">zapri</button>
                        </div>
                        {diumStation.intermodal && (
                          <div className="text-[11px] text-amber-100/90">
                            ITE terminal · kontejner do {diumStation.intermodal.maxContainerLengthFt} čevljev, bruto do {diumStation.intermodal.maxGrossTonnesContainer} t
                            {diumStation.intermodal.privateTerminal ? ' · privatni terminal' : ''}
                          </div>
                        )}
                        {diumStation.conditions?.length > 0 && (
                          <ul className="space-y-1 border-t border-white/10 pt-2">
                            {diumStation.conditions.map((c: string, i: number) => (
                              <li key={i} className="text-[10.5px] leading-snug text-slate-300 flex gap-1.5">
                                <span className="text-amber-400/70 shrink-0">•</span><span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {diumStation.loadingPlaces?.length > 0 && (
                          <div className="border-t border-white/10 pt-2">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">
                              Kraji prevzema / izročitve in industrijski tiri ({diumStation.loadingPlaces.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {diumStation.loadingPlaces.map((p: any) => (
                                <span
                                  key={p.code}
                                  title={p.notes?.length ? p.notes.join('\n') : undefined}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-slate-700 text-slate-300"
                                >
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {diumStation.borderDistancesKm?.length > 0 && (
                          <div className="border-t border-white/10 pt-2">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">Tarifna razdalja do mejnih prehodov</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5">
                              {diumStation.borderDistancesKm.map((b: any) => (
                                <div key={b.code} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                                  <span className="text-slate-400 truncate" title={b.neighbour ? `${b.name} – ${b.neighbour}` : b.name}>
                                    {b.name.replace(/ meja$/, '')}{b.country ? ` (${b.country})` : ''}
                                  </span>
                                  <span className="font-mono text-slate-200 shrink-0">{b.km == null ? '–' : `${b.km} km`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      {diumData.stations.map((s: any) => (
                        <button
                          key={s.code}
                          onClick={() => {
                            setDiumStation(null);
                            fetch(`/api/dium/station/${s.code}`).then(r => (r.ok ? r.json() : null)).then(j => { if (j && !j.error) setDiumStation(j); }).catch(() => {});
                          }}
                          className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{s.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {s.uic}{s.rinfType ? ` · ${s.rinfType}` : ' · ni v RINF'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {s.intermodal && <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-500/15 text-sky-300 border border-sky-500/30">ITE</span>}
                            {s.loadingPlaces > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700">
                                {s.loadingPlaces} tirov
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {diumData.stations.length === 0 && (
                        <p className="text-[11px] text-slate-400">V daljinarju ni službenega mesta, ki bi ustrezalo iskanju.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Berem daljinar DIUM SI…</p>
                )
              ) : registerKind === 'params' ? (
                paramTable ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Parametri za ugotavljanje skladnosti ({paramTable.counts.parameters})
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">
                          {paramTable.counts.networkCompatibility} za združljivost s progo · {paramTable.counts.withTsi} s klavzulo TSI
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        ERATV pri vozilu navede le številke teh parametrov. Tu so njihova imena, oznaka, ali se uporabljajo za združljivost s progo, in klavzule TSI, ki jih pokrivajo.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !paramsNetworkOnly;
                          setParamsNetworkOnly(next);
                          fetch(`/api/era/parameters?q=${encodeURIComponent(registerQuery)}${next ? '&network=1' : ''}`)
                            .then(r => r.json()).then(setParamTable).catch(() => {});
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                          paramsNetworkOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-950 text-slate-400 border-slate-700'
                        }`}
                      >
                        {paramsNetworkOnly ? 'Samo združljivost s progo' : 'Vsi parametri'}
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                      {paramTable.parameters.map((p: any) => (
                        <div key={p.number} className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-white">{p.number} {p.name}</span>
                            {p.networkCompatibility ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">združljivost s progo</span>
                            ) : null}
                          </div>
                          {p.tsis.length ? (
                            <ul className="mt-1 space-y-0.5">
                              {p.tsis.map((t: any) => (
                                <li key={t.column || t.tsi} className="text-[10px] leading-snug">
                                  <span className="text-sky-300/90">{t.tsi}</span>
                                  <span className="block font-mono text-slate-400">{t.clauses.slice(0, 3).join(' · ')}{t.clauses.length > 3 ? ` · +${t.clauses.length - 3}` : ''}</span>
                                </li>
                              ))}
                            </ul>
                          ) : <div className="text-[10px] text-slate-500 mt-0.5">brez navedene klavzule TSI</div>}
                        </div>
                      ))}
                    </div>
                    <p className="text-[9.5px] leading-snug text-slate-400">{paramTable.note}</p>
                    <p className="text-[10px] font-mono text-sky-300/80">vir: {paramTable.source}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">Nalagam tabelo parametrov…</p>
                )
              ) : registerKind === 'terms' ? (
                glossary ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Izrazje EU za železnico ({glossary.counts.withSlovene} od {glossary.counts.concepts} pojmov)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Oznake ob registrskih podatkih so bile prevedene v aplikaciji. Tu je uradni izraz iz zbirke IATE in akt, iz katerega izhaja.
                      </p>
                    </div>
                    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                      {glossary.entries.map((e: any) => (
                        <div key={e.query} className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-white">
                              {e.slTerms?.length ? e.slTerms.map((t: any) => t.term).join(' · ') : <span className="text-slate-500">ni izraza</span>}
                            </span>
                            <span className="text-[9.5px] font-mono text-slate-400">{e.query}</span>
                          </div>
                          <div className="text-[9.5px] font-mono text-slate-500">v aplikaciji: {e.where}</div>
                          {e.note ? <div className="text-[10px] text-amber-200/80 mt-1">{e.note}</div> : null}
                          {e.definition ? <p className="text-[10.5px] text-slate-300 leading-snug mt-1">{e.definition}</p> : null}
                          {(e.slTerms || []).flatMap((t: any) => t.references || []).slice(0, 2).map((r: any, i: number) => (
                            <a key={i} href={r.url || undefined} target="_blank" rel="noreferrer" className="block text-[9.5px] font-mono text-sky-300/80 hover:text-sky-200 mt-0.5 truncate">
                              vir izraza: {r.text}
                            </a>
                          ))}
                          {e.iateUrl ? (
                            <a href={e.iateUrl} target="_blank" rel="noreferrer" className="block text-[9.5px] font-mono text-slate-500 hover:text-slate-300 mt-0.5">
                              zapis IATE {e.id}{e.domainFit ? ` · ${e.domainFit}` : ''}
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <a href={glossary.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-sky-300/80 hover:text-sky-200 break-all block">
                      vir: {glossary.source} · posnetek {String(glossary.retrieved).slice(0, 10)}
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">Nalagam pojmovnik…</p>
                )
              ) : registerKind === 'vehicles' ? (
                eratvData ? (() => {
                  const d = eratvData;
                  const val = (x: any) => (Array.isArray(x) ? (x.length ? x.join(', ') : null) : (x ?? null));
                  const Row = ({ label, value, unit }: { label: string; value: any; unit?: string }) => {
                    const v = val(value);
                    return v == null || v === '' ? null : (
                      <div className="flex items-baseline justify-between gap-2 text-[10.5px] leading-snug">
                        <span className="text-slate-400 shrink-0">{label}</span>
                        <span className="font-mono text-slate-100 text-right">{v}{unit ? ` ${unit}` : ''}</span>
                      </div>
                    );
                  };
                  return (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Tipi vozil z dovoljenjem za Slovenijo ({d.counts.types})
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            {d.counts.withDetail} s podrobnim zapisom{d.query ? ` · zadetkov: ${d.matched}` : ''}
                          </span>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                          {Object.entries(d.counts.byCategory).map(([k, n]) => (
                            <li key={k} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                              <span className="text-slate-300 truncate">{k}</span>
                              <span className="font-mono text-white shrink-0">{n as any}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
                        {d.types.map((t: any) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (eratvDetail?.id === t.id) { setEratvDetail(null); return; }
                              setEratvDetail(null); setEratvLoading(t.id);
                              fetch(`/api/eratv/type/${encodeURIComponent(t.id)}`)
                                .then(r => (r.ok ? r.json() : null))
                                .then(j => { if (j) setEratvDetail(j); })
                                .catch(() => {})
                                .finally(() => setEratvLoading(null));
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                              eratvDetail?.id === t.id || eratvLoading === t.id ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                              <span className="text-[12px] font-semibold text-white">{t.name}</span>
                              <span className="text-[9.5px] font-mono text-slate-400">{t.id}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {[t.subcategory || t.category, t.maxSpeedKmh != null ? `${t.maxSpeedKmh} km/h` : null,
                                t.energySupply?.length ? t.energySupply.join(', ') : null, t.status].filter(Boolean).join(' · ')}
                            </div>
                            {t.holder ? <div className="text-[9.5px] text-slate-500 truncate">imetnik dovoljenja: {t.holder}</div> : null}

                            {eratvLoading === t.id && (
                              <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-mono text-amber-200/90">
                                Berem zapis iz registra ERATV… to traja okoli pol minute.
                              </div>
                            )}
                            {eratvDetail?.id === t.id && (
                              <div className="mt-2 pt-2 border-t border-white/10 space-y-0.5">
                                <Row label="Alternativno ime" value={eratvDetail.altName} />
                                <Row label="Kategorija" value={[eratvDetail.categorySl, eratvDetail.subcategorySl].filter(Boolean).join(' / ')} />
                                <Row label="Proizvajalec" value={eratvDetail.manufacturer} />
                                <Row label="Imetnik dovoljenja" value={eratvDetail.holder} />
                                <Row label="Koda organizacije" value={eratvDetail.holderCode} />
                                <Row label="Dovoljenje" value={eratvDetail.authDocRef} />
                                <Row label="Datum dovoljenja" value={eratvDetail.authDate} />
                                <Row label="Območje uporabe" value={eratvDetail.areaOfUse} />
                                <Row label="Največja konstrukcijska hitrost" value={eratvDetail.maxSpeedKmh} unit="km/h" />
                                <Row label="Napajanje" value={eratvDetail.energySupply} />
                                <Row label="Tirna širina" value={eratvDetail.wheelSetGauge} unit="mm" />
                                <Row label="Referenčni profil" value={eratvDetail.referenceProfile} />
                                <Row label="Kategorije prog (EN)" value={eratvDetail.lineCategories} />
                                <Row label="Masa v obratovalnem stanju" value={eratvDetail.designMassKg} unit="kg" />
                                <Row label="Statična osna obremenitev" value={eratvDetail.axleLoadKg} unit="kg" />
                                <Row label="Dolžina vozila" value={eratvDetail.lengthM} unit="m" />
                                <Row label="Najmanjši polmer krivine" value={eratvDetail.minCurveRadiusM} unit="m" />
                                <Row label="Najmanjši premer kolesa" value={eratvDetail.minWheelDiameterMm} unit="mm" />
                                <Row label="Največji pojemek" value={eratvDetail.maxDecelerationMs2} unit="m/s²" />
                                <Row label="Vrsta spenjače" value={eratvDetail.coupling} />
                                <Row label="ETCS" value={eratvDetail.etcs} />
                                <Row label="Izvedba ETCS" value={eratvDetail.etcsImplementation} />
                                <Row label="Zaščita vlaka (razred B)" value={eratvDetail.trainProtectionLegacy} />
                                <Row label="GSM-R govor" value={eratvDetail.gsmrVoice} />
                                <Row label="Sistemi zaznavanja vlaka" value={eratvDetail.trainDetection} />
                                <Row label="Temperaturno območje" value={eratvDetail.temperatureRange} />
                                <Row label="Požarna kategorija" value={eratvDetail.fireCategory} />
                                <Row label="Države dovoljenja" value={eratvDetail.memberStates} />
                                <Row label="Združljivost ETCS" value={eratvDetail.etcsCompatibility} />
                                <Row label="Vozil v stalni sestavi" value={eratvDetail.fixedFormationVehicles} />
                                <Row label="Potrdila o pregledu tipa" value={eratvDetail.typeExaminationCertificates} />
                                <Row label="Kodirane omejitve" value={eratvDetail.codedRestrictions} />
                                {Array.isArray(eratvDetail.nationalRuleParameters) && eratvDetail.nationalRuleParameters.length > 0 && (
                                  <div className="mt-1.5 pt-1.5 border-t border-white/10">
                                    <div className="text-[9.5px] uppercase font-mono tracking-wider text-sky-300 mb-0.5">
                                      Parametri, ocenjeni po nacionalnih predpisih
                                    </div>
                                    <ul className="space-y-0.5">
                                      {eratvDetail.nationalRuleParameters.map((p: any, i: number) => (
                                        <li key={i} className="text-[10px] leading-snug">
                                          {p.isParameter ? (
                                            <>
                                              <span className="text-white/90">{p.number} {p.name}</span>
                                              {p.networkCompatibility ? <span className="ml-1 text-[9px] font-mono text-emerald-300">· združljivost s progo</span> : null}
                                              {p.tsis?.length ? <span className="block font-mono text-[9px] text-slate-400">{p.tsis[0].tsi}</span> : null}
                                            </>
                                          ) : (
                                            <span className="font-mono text-slate-400">{p.raw}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {eratvDetail.detailNote ? <p className="text-[9.5px] text-amber-200/80 leading-snug">{eratvDetail.detailNote}</p> : null}
                                <a href={eratvDetail.sourceUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9.5px] font-mono text-sky-300/80 hover:text-sky-200 break-all block pt-1">
                                  zapis v registru: {eratvDetail.sourceUrl}
                                </a>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      <p className="text-[9.5px] leading-snug text-slate-400">{d.note}</p>
                      <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-sky-300/80 hover:text-sky-200 break-all block">
                        vir: {d.source} · {d.legalBasis} · posnetek {String(d.retrieved).slice(0, 10)}
                      </a>
                    </div>
                  );
                })() : (
                  <p className="text-xs text-slate-400 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">Nalagam register tipov vozil…</p>
                )
              ) : registerKind === 'lines' ? (
                networkRef?.networkStatement?.lines ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Uradni register prog ({networkRef.networkStatement.lines.length})
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">R1–R4 = progovni razred</span>
                    </div>
                    <div className="max-h-80 overflow-auto custom-scrollbar space-y-1">
                      {networkRef.networkStatement.lines.map((l: any) => (
                        <div key={l.number} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-[11px]">
                          <span className="truncate">
                            <span className="font-mono font-bold text-amber-300">{l.number}</span>
                            <span className="text-slate-200"> {l.name}</span>
                          </span>
                          <span className={`font-mono shrink-0 ${l.lineClass === 'R4' ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {l.lineClass}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-emerald-400/80 font-mono break-words pt-1 border-t border-slate-800">
                      Vir: {networkRef.networkStatement.source}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">Nalagam register prog …</div>
                )
              ) : registerResults ? (
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {registerResults.matched ?? 0} zadetkov od {registerResults.total ?? 0}
                    </h4>
                    {registerResults.issue && (
                      <span className="text-[10px] font-mono text-slate-400">izdaja {registerResults.issue}</span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-auto custom-scrollbar space-y-1">
                    {(registerResults.keepers ?? registerResults.organisations ?? []).slice(0, 80).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-[11px]">
                        <span className="truncate text-slate-200">{r.keeper ?? r.name}</span>
                        <span className="font-mono shrink-0 text-right">
                          <span className="text-amber-300">{r.vkm ?? r.code}</span>
                          <span className="text-slate-500"> {r.country}</span>
                          {r.status && r.status !== 'in use' && (
                            <span className="text-rose-400/90"> · {r.status}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-emerald-400/80 font-mono break-words pt-1 border-t border-slate-800">
                    Vir: {registerResults.source}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">
                  {registerKind === 'vkm'
                    ? 'Register oznak imetnikov vozil (VKM) — 4.988 vpisov, ERA/OTIF. Vpišite ime ali oznako.'
                    : 'Register organizacij ERA/UIC — 1.394 prevoznikov in upravljavcev. Vpišite ime.'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'uic' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Decoder Input Box */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-400" />
                  Pametni Dekoder Tovornih Vagonov & UIC Oznak
                </h3>

                <form onSubmit={handleUicSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={uicQuery}
                      onChange={e => setUicQuery(e.target.value)}
                      placeholder="Vnesite serijo (npr. Sggrss, Zacns, Shimmns) ali 12-mestno UIC kodo (npr. 31 79 4552 104-2)..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                  >
                    Razčleni
                  </button>
                </form>

                {/* Quick select pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
                  <span className="text-[11px] text-slate-500 shrink-0">Priljubljeni vagoni:</span>
                  {['SGGRSS', 'ZACNS', 'SHIMMNS', 'TAGNPPS', 'LAAERS', 'EANOS', 'HABBIILLNS'].map(code => (
                    <button
                      key={code}
                      onClick={() => {
                        setUicQuery(code);
                        runUicDecoder(code);
                      }}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold transition-colors cursor-pointer ${
                        uicQuery.toUpperCase().includes(code)
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Decoded Wagon Presentation */}
              {uicResult?.matchedWagon && (
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white font-mono">
                          {uicResult.matchedWagon.typeCode}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {uicResult.matchedWagon.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {uicResult.matchedWagon.fullName}
                      </p>
                    </div>

                    {uicResult.uicBreakdown && (
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          {uicResult.uicBreakdown.fullUicNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {uicResult.uicBreakdown.registeredCountry}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visual Wagon Graphic Card */}
                  <div className="p-4 rounded-xl bg-black/40 border border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="w-full max-w-md h-16 rounded-lg border-2 border-dashed border-amber-500/40 bg-amber-500/5 flex items-center justify-center p-2">
                      <div className="flex items-center gap-3">
                        <Train size={28} className="text-amber-400" />
                        <div className="text-left font-mono">
                          <div className="text-xs font-bold text-white">{uicResult.matchedWagon.cargo}</div>
                          <div className="text-[10px] text-amber-300/80">{uicResult.matchedWagon.keyUsage}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
                      <span>Dolžina čez odbojnike: <strong>{uicResult.matchedWagon.lengthOverBuffersM} m</strong></span>
                      <span>·</span>
                      <span>Število osi: <strong>{uicResult.matchedWagon.axleCount} osi</strong></span>
                    </div>
                  </div>

                  {/* Specifications Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Tara (Masa praznega):</span>
                      <span className="text-white font-bold text-sm">{uicResult.matchedWagon.tareWeightTons} t</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Nosilnost (Payload):</span>
                      <span className="text-amber-400 font-bold text-sm">{uicResult.matchedWagon.maxPayloadTons} t</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">TSI Obremenitev:</span>
                      <span className="text-emerald-400 font-bold text-sm">{uicResult.matchedWagon.tsiClass}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Maksimalna hitrost:</span>
                      <span className="text-white font-bold text-xs">{uicResult.matchedWagon.maxSpeedKmh}</span>
                    </div>
                  </div>

                  {/* Braking and Silent Freight */}
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs space-y-1">
                    <span className="text-slate-400 font-semibold block text-[11px]">
                      Zavorni sistem & Tihi tovorni promet (TSI NOISE):
                    </span>
                    <p className="text-slate-300 font-mono text-[11px]">
                      {uicResult.matchedWagon.brakeType}
                    </p>
                  </div>

                  {/* Typical Operators */}
                  {uicResult.matchedWagon.operators && (
                    <div className="text-xs">
                      <span className="text-slate-400 text-[11px]">Glavni prevozniki in lastniki:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {uicResult.matchedWagon.operators.map((op: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-slate-300">
                            {op}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: MURSKA SOBOTA & PREKMURJE FREIGHT RADAR */}
          {activeTab === 'murska_sobota' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Corridor & Station Header Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-sky-950/30 border border-emerald-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
                    <Navigation size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        Železniška Postaja Murska Sobota & Proga št. 40
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                        km 78.6 Pragersko–Hodoš
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/20 border border-sky-500/40 text-sky-300">
                        TEN-T RFC 6 & RFC 11
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Stičišče mednarodnega tovornega prometa med Luko Koper, Madžarsko (Budimpešta / Zahodna Evropa) ter lokalnih industrijskih tirov Panvita (žito) in Kema Puconci (pesek). Vsi vlaki so vezani na točno os tirov z ničelnim odstopanjem.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => {
                      if (onFlyTo) {
                        onFlyTo([16.1714, 46.6631], 14);
                        onClose();
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <MapPin size={14} />
                    <span>Skoči na ŽP Murska Sobota</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onFlyTo) {
                        onFlyTo([16.3270, 46.8280], 14);
                        onClose();
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin size={14} />
                    <span>Mejna postaja Hodoš</span>
                  </button>
                </div>
              </div>

              {/* The station's own departures, from the SŽ GTFS-RT feed. The
                  app could show a board for Villa Opicina but not for any
                  Slovenian station, which was backwards for an app about this
                  corridor. Each row says whether its time is observed or only
                  scheduled, so the two are never confused. */}
              {msDepartures?.departures?.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-sky-500/25 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Clock size={14} className="text-sky-400" />
                      Odhodi — Murska Sobota
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {msDepartures.realtimeCount}/{msDepartures.departures.length} v realnem času
                    </span>
                  </div>

                  <div className="space-y-1">
                    {msDepartures.departures.map((d: any, i: number) => (
                      <div key={`${d.tripId}-${i}`} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${
                        d.minutesFromNow != null && d.minutesFromNow <= 30
                          ? 'bg-emerald-950/25 border-emerald-500/30'
                          : 'bg-slate-950/60 border-slate-800/70'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Minutes away, because that is the question someone
                              on the platform is actually asking. */}
                          <span className={`font-mono font-bold shrink-0 tabular-nums w-14 ${
                            d.minutesFromNow != null && d.minutesFromNow <= 30 ? 'text-emerald-300' : 'text-slate-400'
                          }`}>
                            {d.minutesFromNow == null ? '—'
                              : d.minutesFromNow <= 0 ? 'zdaj'
                              : d.minutesFromNow < 60 ? `${d.minutesFromNow} min`
                              : `${Math.floor(d.minutesFromNow / 60)} h ${d.minutesFromNow % 60}`}
                          </span>
                          <span className="font-mono font-bold text-white shrink-0">{d.train}</span>
                          <span className="text-slate-400 truncate">
                            {d.towards ? <>→ {d.towards}</> : d.headsign}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          {d.cancelled ? (
                            <span className="text-rose-400 font-bold">odpovedan</span>
                          ) : (
                            <>
                              <span className={d.delayMin ? 'text-slate-500 line-through' : 'text-slate-200'}>
                                {d.scheduled ? new Date(d.scheduled).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                              {d.delayMin ? (
                                <span className="text-rose-300 font-bold">
                                  {new Date(d.actual).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                                  <span className="text-rose-400/80"> +{d.delayMin}</span>
                                </span>
                              ) : null}
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.isRealtime ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                    title={d.isRealtime ? 'Realni čas' : 'Samo vozni red'} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {msDepartures.coverage && (
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {msDepartures.coverage}
                    </p>
                  )}

                  {/* Feed quality, stated rather than implied by a "live" dot. */}
                  {feedHealth?.agencies?.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed font-mono">
                      {feedHealth.agencies
                        // Only the feeds that carry trains through here; the
                        // gateway also serves Montenegro, which says nothing
                        // about Prekmurje.
                        .filter((a: any) => a.running > 0 && (a.tag === 'sz' || a.tag === 'hzpp'))
                        .map((a: any) => (
                          <span key={a.tag} className="inline-block mr-3">
                            {a.tag.toUpperCase()}:{' '}
                            <strong className={a.realtimePercent >= 80 ? 'text-emerald-300' : 'text-amber-300'}>
                              {a.withRealtime}/{a.running}
                            </strong>{' '}
                            v živo
                          </span>
                        ))}
                      {feedHealth.totals?.worstFeedAgeSeconds != null && (
                        <span className="block mt-1 text-slate-500">
                          Vir GTFS-RT star {feedHealth.totals.worstFeedAgeSeconds} s · polna pika = izmerjen čas, prazna = vozni red
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4 Radar Metric KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">V Bližini Postaje (&le;15 km)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-emerald-400">
                    {murskaSobotaData?.counts?.passingNowCount || 0}
                  </div>
                  <span className="text-[10px] text-emerald-300/80">Pravkar v prekmurskem loku</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">V Prihodu (&le;90 min)</span>
                    <Clock size={13} className="text-amber-400" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-amber-400">
                    {murskaSobotaData?.counts?.approachingSoonCount || 0}
                  </div>
                  <span className="text-[10px] text-amber-300/80">Predviden prehod kmalu</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/30 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Aktivno v Prekmurju</span>
                    <Activity size={13} className="text-sky-400" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-sky-400">
                    {murskaSobotaData?.counts?.activeInRegionCount || 0}
                  </div>
                  <span className="text-[10px] text-slate-400">Odsek Ormož–Hodoš</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Objavljene poti danes</span>
                    <Layers size={13} className="text-slate-400" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-white">
                    {murskaSobotaData?.counts?.totalScheduledToday || 0}
                  </div>
                  <span className="text-[10px] text-slate-400">Poti kataloga skozi MS</span>
                </div>
              </div>

              {/* LIVE SECTION: Passing Now or Active in Prekmurje */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      Živi Radar: Tovorni Vlaki v Prekmurskem Sektorju (Ormož ➔ Murska Sobota ➔ Hodoš)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Lokalni čas: <strong className="text-emerald-300">{murskaSobotaData?.currentTimeInSlovenia || '00:00'}</strong>
                  </span>
                </div>

                {murskaSobotaData?.activeInRegion && murskaSobotaData.activeInRegion.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {murskaSobotaData.activeInRegion.map((train: any, idx: number) => {
                      const isPassingNow = train.distToMsKm <= 15;

                      return (
                        <div
                          key={`${train.id || 'train'}_${idx}`}
                          className={`p-4 rounded-xl bg-slate-900/90 border transition-all flex flex-col justify-between space-y-3 shadow-lg ${
                            isPassingNow
                              ? 'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-gradient-to-b from-slate-900/90 to-emerald-950/20'
                              : 'border-sky-500/40 hover:border-sky-500/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${isPassingNow ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
                                <span className="font-bold text-sm text-white font-mono">
                                  {train.trainNumber}
                                </span>
                                <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-semibold ${
                                  train.isHeadingNorthEast
                                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                                }`}>
                                  {train.directionLabel}
                                </span>
                              </div>
                              <h5 className="text-xs text-slate-200 font-semibold mt-1">
                                {train.name}
                              </h5>
                              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                                {train.title}
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 block">
                                {train.currentSpeed ?? '—'} km/h progovna
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                                {train.distToMsKm} km od MS
                              </span>
                            </div>
                          </div>

                          {/* Current Track Section Banner */}
                          <div className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                            <span className="text-slate-400 text-[10px]">Tirni odsek:</span>
                            <span className="font-semibold text-emerald-300 text-[11px] truncate">
                              {train.currentSection}
                            </span>
                          </div>

                          {/* Logistics & Cargo specs */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/60">
                              <span className="text-slate-500 block text-[10px] font-sans">Prevoznik</span>
                              <span className="font-semibold text-slate-200 truncate block">{train.operator}</span>
                            </div>
                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/60">
                              <span className="text-slate-500 block text-[10px] font-sans">Katalog</span>
                              <span className="font-semibold text-amber-300 truncate block">{train.catalogueLabel}</span>
                            </div>
                          </div>

                          {/* Multi-Source Estimation & Snapping Provenance */}
                          <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-[10px]">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                              <span>Objavljena pot iz kataloga · lega interpolirana, ne izmerjena</span>
                            </div>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                              {train.snappedToRailTrack ? 'Tirna os: Poravnano' : 'Vektorska tirna os'}
                            </span>
                          </div>

                          {/* Track GPS Navigation Button */}
                          <button
                            onClick={() => {
                              if (onFlyTo && train.currentLon != null && train.currentLat != null) {
                                onFlyTo([train.currentLon, train.currentLat], 14.5);
                                onClose();
                              }
                            }}
                            className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                          >
                            <Navigation size={13} />
                            <span>Sledi temu vlaku na tirih Murske Sobote</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-1.5">
                    <p className="text-xs text-slate-300 font-medium">
                      Trenutno noben tovorni vlak ni v neposrednem prevozu med Ormožem in Hodošem.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Oglejte si spodnji celodnevni 24-urni razpored za naslednje predvidene prehode skozi postajo Murska Sobota.
                    </p>
                  </div>
                )}
              </div>

              {/* FULL 24-HOUR TIMETABLE: Freight Trains Through Murska Sobota */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Celodnevni Vozni Red Tovornih Vlakov skozi Mursko Soboto (24h Razpored)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Objavljene poti katalogov koridorjev (RFC6, RFC10) skozi Mursko Soboto. Ura prehoda je interpolirana med objavljenima točkama okoli postaje. Katalog ne pove, ali pot danes vozi.
                    </p>
                  </div>

                  {/* Direction Filters */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                    <button
                      onClick={() => setMsDirectionFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        msDirectionFilter === 'all'
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Vse smeri ({murskaSobotaData?.allScheduledToday?.length || 0})
                    </button>
                    <button
                      onClick={() => setMsDirectionFilter('hodos')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        msDirectionFilter === 'hodos'
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Proti Madžarski ➔
                    </button>
                    <button
                      onClick={() => setMsDirectionFilter('koper')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        msDirectionFilter === 'koper'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Proti Kopru ➔
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {filteredMsTrains.map((train: any, idx: number) => {
                    const isPassingNow = train.passageStatus === 'passing_now';
                    const isApproaching = train.passageStatus === 'approaching_soon';

                    return (
                      <div
                        key={`${train.id || 'train'}_${idx}`}
                        className={`p-3.5 rounded-xl bg-slate-900/80 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          isPassingNow
                            ? 'border-emerald-500/60 bg-emerald-950/20 shadow-md'
                            : isApproaching
                            ? 'border-amber-500/40 bg-amber-950/10'
                            : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Time & Train identification */}
                        <div className="flex items-start sm:items-center gap-3">
                          <div className={`px-2.5 py-2 rounded-lg font-mono text-center shrink-0 ${
                            isPassingNow
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                              : isApproaching
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'bg-slate-950 text-slate-200 border border-slate-800'
                          }`}>
                            <span className="text-[10px] block opacity-70">Prehod MS</span>
                            <span className="text-sm font-bold">{train.scheduledPassageTime}</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white font-mono text-xs">
                                {train.trainNumber}
                              </span>
                              <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-medium ${
                                train.isHeadingNorthEast
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              }`}>
                                {train.directionLabel}
                              </span>
                              {isPassingNow && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500 text-slate-950 animate-pulse">
                                  PRAVKAR V PREVOZU
                                </span>
                              )}
                              {isApproaching && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Čez {train.etaMinutes} min
                                </span>
                              )}
                            </div>

                            <h5 className="text-xs font-semibold text-slate-200 mt-0.5">
                              {train.name}
                            </h5>

                            <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{train.fromName}</span>
                              <span className="text-slate-600">➔</span>
                              <span>{train.toName}</span>
                              <span className="text-slate-600">·</span>
                              <span className="text-amber-300 font-medium">{train.passageBasis}</span>
                            </p>
                          </div>
                        </div>

                        {/* Specs & Action */}
                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                          <div className="text-right text-[10px] font-mono text-slate-400">
                            <div><strong className="text-slate-200">{train.title}</strong></div>
                            <div>{train.operator}</div>
                          </div>

                          {train.isRunning && train.currentLon != null && train.currentLat != null ? (
                            <button
                              onClick={() => {
                                if (onFlyTo) {
                                  onFlyTo([train.currentLon, train.currentLat], 14.5);
                                  onClose();
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-medium text-xs border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Navigation size={12} />
                              <span>Sledi</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (onFlyTo) {
                                  onFlyTo([16.1714, 46.6631], 13.5);
                                  onClose();
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin size={12} />
                              <span>Trasa MS</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prekmurje Industrial Hubs & Rail Infrastructure Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Factory size={16} className="text-amber-400" />
                  <h4 className="text-sm font-bold text-white">
                    Prekmurska Industrijska Tovorna Vozlišča & Tehnična Infrastruktura
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-300 block">Panvita Silos Murska Sobota</span>
                    <p className="text-[11px] text-slate-400">
                      2 industrijska tira neposredno ob postaji. Zmogljivost 60.000 ton žita in krmil, sprejem vagonov Tagnpps za Luko Koper in izvoz.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-300 block">Kema Puconci (km 84.1)</span>
                    <p className="text-[11px] text-slate-400">
                      Nakladalna točka za visokokakovosten kremenčev pesek. Prevoz z vagoni Faccns v steklarne in gradbeno industrijo.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="font-bold text-emerald-300 block">Mejna Postaja Hodoš (km 106.8)</span>
                    <p className="text-[11px] text-slate-400">
                      Sistemska ločilka med SŽ (3 kV DC) in MÁV (25 kV AC 50 Hz). Carinski pregled, fitosanitarna in veterinarska kontrola za Madžarsko.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="font-bold text-sky-300 block">Specifikacija Proge št. 40</span>
                    <p className="text-[11px] text-slate-400">
                      Elektrificirana proga, osna kategorija D4 (22.5 t/os, 8.0 t/m), signalno-varnostni sistem APB z ETCS Level 1 ter hitrostjo do 160 km/h.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Uradni viri: SŽ-Infrastruktura · Luka Koper d.d. · ERA RINF · UIC 438-2</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
          >
            Zapri pregledovalnik
          </button>
        </div>
      </div>
    </div>
  );
};
