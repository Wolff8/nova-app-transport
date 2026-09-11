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
  const [activeTab, setActiveTab] = useState<'trains' | 'pipeline' | 'yards' | 'corridors' | 'modalsplit' | 'uic' | 'murska_sobota'>('trains');
  
  // Data states
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [terminalsData, setTerminalsData] = useState<any[]>([]);
  const [corridorsData, setCorridorsData] = useState<any>(null);
  const [modalSplitData, setModalSplitData] = useState<any>(null);
  const [activeTrains, setActiveTrains] = useState<any[]>([]);
  const [freightPayload, setFreightPayload] = useState<any>(null);
  const [murskaSobotaData, setMurskaSobotaData] = useState<any>(null);
  const [trainFilter, setTrainFilter] = useState<'running' | 'terminals' | 'all'>('running');
  const [msDirectionFilter, setMsDirectionFilter] = useState<'all' | 'hodos' | 'koper'>('all');
  
  // UIC decoder states
  const [uicQuery, setUicQuery] = useState('SGGRSS');
  const [uicResult, setUicResult] = useState<any>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!isOpen) return;

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

    // Initial UIC decoder lookup
    runUicDecoder('SGGRSS');

    return () => {
      clearInterval(trainTimer);
      clearInterval(msTimer);
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
        <div className="px-5 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0 py-2">
          <button
            onClick={() => setActiveTab('trains')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trains'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Train size={14} className="text-amber-400" />
            <span>Živi Tovorni Vlaki ({activeTrains.length})</span>
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
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
          
          {/* TAB 0: ACTIVE FREIGHT TRAINS (REAL TIMETABLE-SYNCHRONIZED SŽ ENGINE) */}
          {activeTab === 'trains' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top Key Metrics Bento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Vlaki v Živo na Tirih</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-emerald-400">
                    {runningTrainsList.length}
                  </div>
                  <span className="text-[10px] text-emerald-300/80">Aktivno na slovenskem omrežju</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Masa Tovora v Gibanju</span>
                  <div className="my-1 text-2xl font-bold font-mono text-sky-400">
                    {totalTransitTons.toLocaleString('sl-SI')} t
                  </div>
                  <span className="text-[10px] text-slate-400">Trenutno v železniškem tranzitu</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Razbremenitev Avtocest</span>
                  <div className="my-1 text-2xl font-bold font-mono text-amber-400">
                    {totalTrucksOffset} vlačilcev
                  </div>
                  <span className="text-[10px] text-amber-300/80">Manj tovornjakov na A1 / A2</span>
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
                    Za tovorni promet na tem koridorju ni javnega vira pozicij: MÁV vonatinfo vrača samo potniške vlake,
                    ViaggiaTreno ne pozna tovornih številk, SŽ in HŽ pa jih ne objavljata. Številke vlakov, časi, lokomotive
                    in tovor spodaj so <strong className="text-amber-300">predloga te aplikacije, ne vozni red</strong>, in jih ne gre brati kot
                    dejanski promet. Preverljivo je omrežje pod njimi: pri vsakem vlaku je z oznako
                    <strong className="text-emerald-300"> „Iz uradnih registrov“</strong> prikazano, kar potrjujejo ERA RINF (službena mesta in
                    dolžine odsekov), register organizacij ERA/UIC (licencirani prevozniki) in Program omrežja SŽ-Infrastruktura
                    (razredi mase, dolžine in hitrosti).
                  </p>
                </div>
              </div>

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
                      15 celodnevnih tovornih vlakov (Metrans, SŽ-TP, Foxrail, CER Cargo) do mejne tovorne postaje Hodoš s točno tirno osjo.
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

              {/* Segmented Filter Control */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setTrainFilter('running')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      trainFilter === 'running'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>V vožnji po odsekih ({runningTrainsList.length})</span>
                  </button>

                  <button
                    onClick={() => setTrainFilter('terminals')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      trainFilter === 'terminals'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Factory size={13} />
                    <span>Na terminalih & ranžirnih tirih ({terminalTrainsList.length})</span>
                  </button>

                  <button
                    onClick={() => setTrainFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      trainFilter === 'all'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers size={13} />
                    <span>Vse 24h voznoredne trase ({allSlotsList.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <Activity size={13} className="text-emerald-400" />
                  <span>Telemetrija: v realnem času</span>
                </div>
              </div>

              {/* Active / Scheduled Trains List */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayedTrains.map((train: any, idx: number) => {
                    const isRunning = train.isRunning ?? (train.status && train.status.includes('V vožnji'));
                    const isTerminal = train.isAtTerminal ?? (train.status && train.status.includes('Priprava'));

                    return (
                      <div 
                        key={`${train.id || train.slotId || 'train'}_${idx}`}
                        className={`p-4 rounded-xl bg-slate-900/90 border transition-all flex flex-col justify-between space-y-3 shadow-lg group ${
                          isRunning 
                            ? 'border-emerald-500/30 hover:border-emerald-500/60' 
                            : isTerminal 
                            ? 'border-amber-500/30 hover:border-amber-500/60'
                            : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              {isRunning ? (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              ) : isTerminal ? (
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-600" />
                              )}
                              <span className="font-bold text-sm text-slate-100 font-mono group-hover:text-amber-300 transition-colors">
                                {train.name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-sans mt-0.5">
                              {train.title}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              isRunning 
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                                : isTerminal 
                                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isRunning ? `${train.speedKmh} km/h` : isTerminal ? '0 km/h (Postanek)' : 'V čakanju'}
                            </span>
                          </div>
                        </div>

                        {/* Route and Timetable Banner */}
                        <div className="px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 font-medium text-slate-200">
                            <span className="text-amber-400 font-mono font-bold">{train.from}</span>
                            <span className="text-slate-500">➔</span>
                            <span className="text-sky-400 font-mono font-bold">{train.to}</span>
                          </div>
                          <div className="text-[11px] font-mono flex items-center gap-1.5 text-slate-400">
                            <Clock size={11} className="text-slate-500" />
                            <span>{train.departureTime} – {train.arrivalTime}</span>
                          </div>
                        </div>

                        {/* Current section status */}
                        {train.currentSection && (
                          <div className="text-[11px] px-2.5 py-1 rounded bg-slate-950/50 border border-slate-800/60 flex items-center justify-between text-slate-300">
                            <span className="text-slate-400 text-[10px]">Odsek:</span>
                            <span className="font-medium text-slate-200 truncate">{train.currentSection}</span>
                          </div>
                        )}

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-950/40 p-2 rounded border border-slate-800/50">
                            <span className="text-slate-500 block text-[10px]">Prevoznik</span>
                            <span className="font-semibold text-slate-300 truncate block">{train.operator}</span>
                          </div>
                          <div className="bg-slate-950/40 p-2 rounded border border-slate-800/50">
                            <span className="text-slate-500 block text-[10px]">Tovor</span>
                            <span className="font-semibold text-amber-300 truncate block">{train.cargo}</span>
                          </div>
                          <div className="bg-slate-950/40 p-2 rounded border border-slate-800/50">
                            <span className="text-slate-500 block text-[10px]">Vleka (Lokomotiva)</span>
                            <span className="font-mono text-slate-300 truncate block">{train.locomotive}</span>
                          </div>
                          <div className="bg-slate-950/40 p-2 rounded border border-slate-800/50">
                            <span className="text-slate-500 block text-[10px]">Bruto masa / Dolžina</span>
                            <span className="font-mono text-slate-300 block">{train.grossWeightTons} t · {train.lengthM} m</span>
                          </div>
                        </div>

                        {/* What the public registers say about this path, kept
                            visibly apart from the scheduled figures above. The
                            fields in the grid are this app's own schedule; the
                            ones below come from ERA RINF, the ERA/UIC
                            organisation register and the SŽ Network Statement,
                            and say so. */}
                        {train.registerData && (
                          <div className="px-2.5 py-2 rounded-lg bg-slate-950/60 border border-slate-800/70 space-y-1.5 text-[10px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-300 uppercase tracking-wider text-[9.5px]">Iz uradnih registrov</span>
                              {train.registerData.classification?.speedClass && (
                                <span className="font-mono text-slate-400 shrink-0">
                                  {train.registerData.classification.speedClass.code} · maks. {train.registerData.classification.speedClass.maxSpeedKmh} km/h
                                </span>
                              )}
                            </div>

                            {train.registerData.route?.unresolved ? (
                              <div className="text-slate-500 leading-relaxed">
                                Trasa ni preverljiva v RINF — ena od končnih točk ni v registru.
                              </div>
                            ) : train.registerData.route ? (
                              <>
                                <div className="flex items-center justify-between gap-2 font-mono">
                                  <span className="text-slate-400">Dolžina po RINF</span>
                                  <span className="text-emerald-300 font-bold">
                                    {train.registerData.route.km} km
                                    {train.registerData.route.kmDeltaVsSchedule !== 0 && (
                                      <span className="text-slate-500 font-normal">
                                        {' '}(vozni red navaja {train.registerData.route.scheduleKm})
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 font-mono">
                                  <span className="text-slate-400">Službena mesta</span>
                                  <span className="text-slate-300">{train.registerData.route.operationalPoints.length}</span>
                                </div>
                                {train.registerData.route.borderCrossings?.length > 0 && (
                                  <div className="flex items-center justify-between gap-2 font-mono">
                                    <span className="text-slate-400 shrink-0">Mejni prehod</span>
                                    <span className="text-sky-300 truncate">{train.registerData.route.borderCrossings.join(', ')}</span>
                                  </div>
                                )}
                              </>
                            ) : null}

                            {train.registerData.operators && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-slate-400 shrink-0">Prevoznik v registru</span>
                                <span className="text-right min-w-0">
                                  {train.registerData.operators.registered.map((o: any) => (
                                    <span key={o.code} className="block font-mono text-emerald-300 truncate">
                                      {o.name} <span className="text-slate-500">[{o.code}]</span>
                                    </span>
                                  ))}
                                  {train.registerData.operators.unregistered.map((name: string) => (
                                    <span key={name} className="block font-mono text-amber-400/90 truncate">
                                      {name} <span className="text-slate-500">— ni v registru</span>
                                    </span>
                                  ))}
                                </span>
                              </div>
                            )}

                            {(train.registerData.classification?.massClass || train.registerData.classification?.lengthClass) && (
                              <div className="flex items-center justify-between gap-2 font-mono">
                                <span className="text-slate-400">Razred SŽ</span>
                                <span className="text-slate-300">
                                  {[train.registerData.classification.massClass?.code, train.registerData.classification.lengthClass?.code]
                                    .filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Environmental & Road Offload Metrics */}
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[10px]">
                          <div className="flex items-center gap-1.5 text-emerald-300 font-mono">
                            <Leaf size={12} className="text-emerald-400 shrink-0" />
                            <span>-{train.co2SavedKg ? Number(train.co2SavedKg).toLocaleString('sl-SI') : '---'} kg CO₂</span>
                          </div>
                          <div className="text-slate-400 font-mono">
                            Odstranjeno: <strong className="text-amber-300">{train.trucksEquivalent || Math.round(train.grossWeightTons / 25)}</strong> tovornjakov
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                            <span>Napredek po progi ({train.currentKm != null ? `${train.currentKm} / ${train.totalKm} km` : `${train.progressPercent}%`})</span>
                            <span className="text-amber-300">{train.progressPercent} %</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-300 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, train.progressPercent || 0))}%` }}
                            />
                          </div>
                        </div>

                        {/* Multi-Source Estimation & Snapping Provenance */}
                        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-[10px]">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                            <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                            <span>Brez simulacije · Fuzija 5 uradnih virov</span>
                          </div>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300">
                            {train.multiSourceEstimation?.snappedToRailTrack ? 'Tirna os: Poravnano' : 'Vektorska tirna os'}
                          </span>
                        </div>

                        {train.weatherAdvisory && (
                          <div className="text-[10px] px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
                            <AlertTriangle size={11} className="shrink-0 text-amber-400" />
                            <span className="truncate">{train.weatherAdvisory}</span>
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={() => {
                            if (onFlyTo && train.lon != null && train.lat != null) {
                              onFlyTo([train.lon, train.lat], 14.5);
                              onClose();
                            }
                          }}
                          disabled={train.lon == null || train.lat == null}
                          className="w-full py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer group-hover:bg-amber-500 group-hover:text-slate-950 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Navigation size={13} />
                          <span>Centriraj na karti</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                          <span className="text-amber-300 font-semibold">{terminal.dailyBlockTrains}</span>
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
            </div>
          )}

          {/* TAB 5: UIC ROLLING STOCK & WAGON DECODER */}
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
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">24h Vozni Red Slotov</span>
                    <Layers size={13} className="text-slate-400" />
                  </div>
                  <div className="my-1 text-2xl font-bold font-mono text-white">
                    {murskaSobotaData?.counts?.totalScheduledToday || 15}
                  </div>
                  <span className="text-[10px] text-slate-400">Tovornih vlakov skozi MS</span>
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
                                {train.currentSpeed} km/h
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
                              <span className="text-slate-500 block text-[10px] font-sans">Prevoznik / Vleka</span>
                              <span className="font-semibold text-slate-200 truncate block">{train.operator} · {train.locomotive}</span>
                            </div>
                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/60">
                              <span className="text-slate-500 block text-[10px] font-sans">Tovor / Vagoni</span>
                              <span className="font-semibold text-amber-300 truncate block">{train.cargo}</span>
                            </div>
                          </div>

                          {/* Multi-Source Estimation & Snapping Provenance */}
                          <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-[10px]">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                              <span>Brez simulacije · Fuzija 4 uradnih virov</span>
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
                      Kronološki seznam vseh 15 rednih tovornih tras s predvidenimi urami prehoda, operaterji in tipi vagonov.
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
                      Vse smeri ({murskaSobotaData?.allScheduledToday?.length || 15})
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
                              <span className="text-amber-300 font-medium">{train.cargo}</span>
                            </p>
                          </div>
                        </div>

                        {/* Specs & Action */}
                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                          <div className="text-right text-[10px] font-mono text-slate-400">
                            <div><strong className="text-slate-200">{train.locomotive}</strong></div>
                            <div>{train.grossWeightTons} t · {train.lengthM} m · {train.trucksEquivalent} tov. manj</div>
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
