import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Terminal, Radio, Navigation, Wind, Activity, Compass, 
  ArrowUpRight, Package, Train, Pause, Play, ArrowUpToLine, Disc
} from 'lucide-react';
import { TelemetryLogEntry } from '../types';

interface LiveTelemetryStreamProps {
  isOpen: boolean;
  onClose: () => void;
  logs: TelemetryLogEntry[];
  onSelectLog: (log: TelemetryLogEntry) => void;
}

export const LiveTelemetryStream: React.FC<LiveTelemetryStreamProps> = ({
  isOpen,
  onClose,
  logs,
  onSelectLog
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isPinnedToTop, setIsPinnedToTop] = useState<boolean>(true);
  const [displayedLogs, setDisplayedLogs] = useState<TelemetryLogEntry[]>(logs);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // When new logs arrive, update displayed logs unless user paused
  useEffect(() => {
    if (!isPaused) {
      setDisplayedLogs(logs);
      if (isPinnedToTop && listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
    }
  }, [logs, isPaused, isPinnedToTop]);

  if (!isOpen) return null;

  console.log('logs length:', displayedLogs.length, 'filter:', filter);
  const filteredLogs = filter === 'all' 
    ? displayedLogs 
    : displayedLogs.filter(l => {
        if (filter === 'train') return ['freight', 'eurorail', 'transit', 'hafas', 'train', 'bus'].includes(l.type);
        if (filter === 'air') return ['arso', 'sensorcommunity', 'openaq', 'opensense', 'air', 'moms'].includes(l.type);
        return l.type === filter;
      });

  const handleScroll = () => {
    if (!listContainerRef.current) return;
    const { scrollTop } = listContainerRef.current;
    // If user scrolled down more than 15px, disable auto-lock to top so view doesn't jump
    if (scrollTop > 15) {
      if (isPinnedToTop) setIsPinnedToTop(false);
    } else {
      if (!isPinnedToTop) setIsPinnedToTop(true);
    }
  };

  const scrollToTop = () => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setIsPinnedToTop(true);
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'drone':
        return <Compass size={14} className="text-rose-400 shrink-0" />;
      case 'train':
      case 'hafas':
      case 'eurorail':
      case 'freight':
      case 'transit':
        return <Train size={14} className="text-sky-400 shrink-0" />;
      case 'bus':
        return <Navigation size={14} className="text-teal-400 shrink-0" />;
      case 'signal':
        return <Activity size={14} className="text-emerald-400 shrink-0" />;
      case 'lorawan':
        return <Radio size={14} className="text-amber-400 shrink-0" />;
      case 'nbiot':
        return <Radio size={14} className="text-orange-500 shrink-0" />;
      case 'air':
        return <Wind size={14} className="text-cyan-400 shrink-0" />;
      case 'traffic_counter':
        return <Activity size={14} className="text-rose-400 shrink-0" />;
      case 'aircraft':
        return <Compass size={14} className="text-slate-300 shrink-0" />;
      default:
        return <Terminal size={14} className="text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="absolute bottom-12 left-3 right-3 sm:left-auto sm:right-3 sm:w-[540px] h-[430px] flex flex-col z-30 
                    bg-panel/95 backdrop-blur-2xl border border-line rounded-2xl shadow-2xl overflow-hidden font-mono text-[11.5px] select-none">
      
      {/* Header */}
      <div className="p-3 bg-black/50 border-b border-line flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-wheat shrink-0" />
          <span className="font-bold text-white tracking-wide text-xs">Živi telemetrijski tok paketov</span>
          
          {isPaused ? (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1">
              <Pause size={8} /> Pavza
            </span>
          ) : (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Najnovejši zgoraj (2s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Pause / Resume button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Nadaljuj sprejemanje novih paketov' : 'Zaustavi tok (Pavza za branje)'}
            className="text-text-dim hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
          >
            {isPaused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} className="text-amber-400" />}
            <span className="hidden sm:inline">{isPaused ? 'Nadaljuj' : 'Pavza'}</span>
          </button>

          {/* Jump to top if scrolled down */}
          {!isPinnedToTop && (
            <button
              onClick={scrollToTop}
              title="Skoči na najnovejše pakete na vrhu"
              className="text-wheat bg-wheat/10 border border-wheat/30 px-2 py-0.5 rounded-lg hover:bg-wheat hover:text-ink transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
            >
              <ArrowUpToLine size={11} />
              <span>Vrh</span>
            </button>
          )}

          {/* Close button */}
          <button 
            onClick={onClose}
            className="text-text-dim hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-3 py-2 bg-black/30 border-b border-line flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-[10px] shrink-0">
        {[
          { id: 'all', label: 'Vsi viri' },
          { id: 'train', label: 'SŽ & Tuji Vlaki' },
          { id: 'air', label: 'Zrak (ARSO/OpenSense)' },
          { id: 'aircraft', label: 'ADS-B Letala' },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => {
              setFilter(btn.id);
              if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
            }}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              filter === btn.id 
                ? 'bg-wheat text-ink font-bold shadow-[0_0_10px_rgba(217,164,65,0.4)]' 
                : 'bg-white/5 text-text-dim hover:text-white hover:bg-white/10'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Log Feed Container (Fixed height, smooth scroll, zero vertical jitter) */}
      <div 
        ref={listContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar bg-ink/75"
        style={{ scrollBehavior: 'auto' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-dim/60 italic gap-2">
            <Disc className="w-5 h-5 animate-spin text-wheat/40" />
            <span>Čakam na naslednje telemetrijske pakete...</span>
          </div>
        ) : (
          filteredLogs.map((l, idx) => (
            <div 
              key={`${l.id}_${idx}_${l.timestamp.getTime()}`}
              onClick={() => onSelectLog(l)}
              className={`h-[50px] max-h-[50px] p-2 rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer group overflow-hidden ${
                idx === 0 && !isPaused
                  ? 'bg-white/[0.06] border-wheat/30 shadow-[0_0_8px_rgba(217,164,65,0.15)]'
                  : 'bg-white/[0.02] hover:bg-white/[0.07] border-white/5 hover:border-line'
              }`}
            >
              <div className="p-1 rounded-lg bg-black/40 border border-white/5 shrink-0">
                {getLogIcon(l.type)}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-white truncate text-[11px] group-hover:text-wheat transition-colors">
                      {l.nodeName}
                    </span>
                    {idx === 0 && !isPaused && (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[8px] px-1 py-0.2 rounded font-bold uppercase shrink-0">
                        Novo
                      </span>
                    )}
                  </div>
                  <span className="text-[9.5px] text-text-dim font-mono shrink-0">
                    {l.timestamp.toLocaleTimeString('sl-SI')}
                  </span>
                </div>
                <p className="text-[10px] text-text-dim truncate mt-0.5 font-mono">
                  {l.summary}
                </p>
              </div>

              <ArrowUpRight size={13} className="text-wheat opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          ))
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="px-3 py-1.5 bg-black/40 border-t border-line flex items-center justify-between text-[9.5px] text-text-dim shrink-0">
        <span>Prikazanih {filteredLogs.length} paketov</span>
        <span>Klikni na vrstico za skok na zemljevid</span>
      </div>

    </div>
  );
};
