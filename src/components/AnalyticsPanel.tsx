import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Search, Eye, EyeOff, Crosshair, ArrowUpDown, Tag, Gauge, Bus, Train, Bike, Plane, Zap, Anchor
} from 'lucide-react';
import { MapController } from '../lib/MapController';

/**
 * Each dataset reads straight from the GeoJSON source that backs the map, so
 * the table and the map can never disagree about what is live.
 */
interface DatasetDef {
  sourceId: string;
  layerKey: string;
  label: string;
  icon: any;
  accent: string;
  /** Row -> display fields. Keeps per-feed naming differences out of the view. */
  primary: (r: any) => string;
  secondary: (r: any) => string;
  metric: (r: any) => string;
  /** Numeric value used when sorting by "value". */
  sortValue: (r: any) => number;
  nodeType: string;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const speedText = (r: any) => {
  const s = Math.round(num(r.speed ?? r.speedKmh ?? r.velocity));
  return s > 0 ? `${s} km/h` : 'miruje';
};

const DATASETS: DatasetDef[] = [
  {
    sourceId: 'buses', layerKey: 'buses', label: 'Avtobusi', icon: Bus, accent: '#10b981',
    primary: r => r.name || r.route || r.plate || 'Avtobus',
    secondary: r => [r.operator, r.destination].filter(Boolean).join(' → ') || '—',
    metric: speedText,
    sortValue: r => num(r.speed),
    nodeType: 'buses'
  },
  {
    sourceId: 'transit', layerKey: 'transit', label: 'Vlaki', icon: Train, accent: '#06b6d4',
    primary: r => r.name || r.trainNum || 'Vlak',
    secondary: r => [r.operator, r.destination].filter(Boolean).join(' → ') || '—',
    metric: r => {
      const d = Math.round(num(r.delayMin ?? r.delay));
      return d > 0 ? `${speedText(r)} · +${d} min` : speedText(r);
    },
    sortValue: r => num(r.speed),
    nodeType: 'transit'
  },
  {
    sourceId: 'freight_trains', layerKey: 'freight_trains', label: 'Tovorni', icon: Anchor, accent: '#f59e0b',
    primary: r => r.name || r.trainNum || 'Tovorni vlak',
    secondary: r => [r.operator, r.destination].filter(Boolean).join(' → ') || '—',
    metric: speedText,
    sortValue: r => num(r.speed),
    nodeType: 'freight_trains'
  },
  {
    sourceId: 'micromobility', layerKey: 'micromobility', label: 'Mikromobilnost', icon: Bike, accent: '#65a30d',
    primary: r => r.name || r.network || 'Postajališče',
    secondary: r => r.network || '—',
    // GBFS stations report availability; free-floating vehicles report a count of 1.
    metric: r => (r.spaces != null && num(r.spaces) > 0)
      ? `${num(r.vehicles)}/${num(r.vehicles) + num(r.spaces)} na voljo`
      : `${num(r.vehicles)} na voljo`,
    sortValue: r => num(r.vehicles),
    nodeType: 'micromobility'
  },
  {
    sourceId: 'evcharge', layerKey: 'evcharge', label: 'EV polnilnice', icon: Zap, accent: '#a3e635',
    primary: r => r.name || 'Polnilnica',
    secondary: r => r.operator || r.network || '—',
    metric: r => (r.power ? `${r.power} kW` : (r.status || '—')),
    sortValue: r => num(r.power),
    nodeType: 'evcharge'
  },
  {
    sourceId: 'aircraft', layerKey: 'aircraft', label: 'Letala', icon: Plane, accent: '#93c5fd',
    primary: r => r.callsign || r.name || 'Letalo',
    secondary: r => r.origin_country || r.operator || '—',
    metric: speedText,
    sortValue: r => num(r.speed ?? r.velocity),
    nodeType: 'aircraft'
  }
];

/**
 * Italian services are a station board, not map markers. ViaggiaTreno publishes
 * arrivals and departures per station with no live coordinates, so plotting
 * them would mean inventing positions. They are listed here instead, which is
 * exactly what the data supports.
 */
interface ItalyService {
  station: string;
  direction: 'odhod' | 'prihod';
  trainNumber: string;
  category: string;
  counterpart: string;
  scheduled: string;
  delayMin: number;
  platform: string;
}

function useItalyBoard(isOpen: boolean, active: boolean) {
  const [board, setBoard] = useState<{ services: ItalyService[]; delayed: number; worst: number } | null>(null);
  useEffect(() => {
    if (!isOpen || !active) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/italy/board');
        const data = await res.json();
        const services: ItalyService[] = [];
        for (const st of data.stations || []) {
          for (const d of st.departures || []) services.push({ ...d, station: st.name, direction: 'odhod' });
          for (const a of st.arrivals || []) services.push({ ...a, station: st.name, direction: 'prihod' });
        }
        if (!cancelled) setBoard({ services, delayed: data.delayedCount || 0, worst: data.worstDelayMin || 0 });
      } catch {
        if (!cancelled) setBoard(null);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [isOpen, active]);
  return board;
}

const ITALY_ID = '__italy';

interface AnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mapController: MapController | null;
  onSelectNode?: (node: any) => void;
}

export function AnalyticsPanel({ isOpen, onClose, mapController, onSelectNode }: AnalyticsPanelProps) {
  const [activeId, setActiveId] = useState(DATASETS[0].sourceId);
  const [query, setQuery] = useState('');
  const [sortByValue, setSortByValue] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [labelsOn, setLabelsOn] = useState(true);

  const active = useMemo(
    () => DATASETS.find(d => d.sourceId === activeId) || DATASETS[0],
    [activeId]
  );
  const isItaly = activeId === ITALY_ID;
  const italyBoard = useItalyBoard(isOpen, isItaly);

  // Poll the live sources while the panel is open. The map updates these on its
  // own cadence, so re-reading is how the table stays in step with it.
  useEffect(() => {
    if (!isOpen || !mapController) return;
    const read = () => {
      setRows(mapController.getLiveDataset(active.sourceId));
      const next: Record<string, number> = {};
      const vis: Record<string, boolean> = {};
      for (const d of DATASETS) {
        next[d.sourceId] = mapController.getLiveDataset(d.sourceId).length;
        vis[d.sourceId] = mapController.isLayerVisible(d.layerKey);
      }
      setCounts(next);
      setVisible(vis);
      setLabelsOn(mapController.areLabelsVisible());
    };
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, [isOpen, mapController, active.sourceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(r => {
      if (!q) return true;
      return `${active.primary(r)} ${active.secondary(r)}`.toLowerCase().includes(q);
    });
    return list.sort((a, b) =>
      sortByValue
        ? active.sortValue(b) - active.sortValue(a)
        : active.primary(a).localeCompare(active.primary(b))
    );
  }, [rows, query, sortByValue, active]);

  const focusRow = useCallback((row: any) => {
    if (!mapController || row.lon == null || row.lat == null) return;
    const coords: [number, number] = [row.lon, row.lat];
    mapController.flyTo(coords, 15.5);
    if (onSelectNode) {
      onSelectNode(mapController.buildTelemetryNode(active.nodeType, row, coords));
    }
  }, [mapController, onSelectNode, active.nodeType]);

  const toggleDataset = useCallback((d: DatasetDef) => {
    if (!mapController) return;
    const next = !visible[d.sourceId];
    mapController.toggleLayer(d.layerKey, next);
    setVisible(v => ({ ...v, [d.sourceId]: next }));
  }, [mapController, visible]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[60] h-[78dvh] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[420px]
                    flex flex-col bg-panel/95 backdrop-blur-xl border-t sm:border-t-0 sm:border-l border-line
                    rounded-t-2xl sm:rounded-none shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <div>
          <h2 className="text-white font-bold text-sm">Analitika živih podatkov</h2>
          <p className="text-[11px] text-text-dim font-mono">
            {isItaly
              ? `${italyBoard?.services.length ?? 0} storitev · ${italyBoard?.delayed ?? 0} z zamudo · vir: ViaggiaTreno`
              : `${filtered.length} od ${rows.length} zapisov · vir: ${active.sourceId}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg border border-line text-text-dim hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Zapri"
        >
          <X size={16} />
        </button>
      </div>

      {/* Dataset selector — count doubles as the live total */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-line shrink-0">
        {DATASETS.map(d => {
          const Icon = d.icon;
          const on = d.sourceId === activeId;
          return (
            <button
              key={d.sourceId}
              onClick={() => setActiveId(d.sourceId)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors ${
                on ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-text-dim border-line hover:text-white'
              }`}
              style={on ? { borderColor: d.accent, color: d.accent } : undefined}
            >
              <Icon size={12} />
              {d.label}
              <span className="text-text-dim font-mono">{counts[d.sourceId] ?? 0}</span>
            </button>
          );
        })}
        <button
          onClick={() => setActiveId(ITALY_ID)}
          title="Italija — postajna tabla (ViaggiaTreno)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors ${
            isItaly ? 'bg-white/10 text-white border-sky-400' : 'bg-white/[0.03] text-text-dim border-line hover:text-white'
          }`}
        >
          <Train size={12} />
          Italija
          <span className="text-text-dim font-mono">{italyBoard?.services.length ?? '·'}</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line shrink-0">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Išči po imenu, prevozniku, relaciji…"
            className="w-full bg-white/5 border border-line rounded-lg pl-8 pr-2 py-1.5 text-[12px] text-white
                       placeholder:text-text-dim outline-none focus:border-wheat/60"
          />
        </div>
        <button
          onClick={() => setSortByValue(v => !v)}
          title={sortByValue ? 'Razvrsti po imenu' : 'Razvrsti po vrednosti'}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-line text-[11px] text-text-dim hover:text-white hover:bg-white/10 transition-colors"
        >
          {sortByValue ? <Gauge size={13} /> : <ArrowUpDown size={13} />}
        </button>
        {!isItaly && <button
          onClick={() => toggleDataset(active)}
          title={visible[active.sourceId] ? 'Skrij sloj na zemljevidu' : 'Prikaži sloj na zemljevidu'}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
            visible[active.sourceId]
              ? 'border-wheat/50 text-wheat bg-wheat/10'
              : 'border-line text-text-dim hover:text-white hover:bg-white/10'
          }`}
        >
          {visible[active.sourceId] ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>}
        <button
          onClick={() => { mapController?.setLabelsVisible(!labelsOn); setLabelsOn(!labelsOn); }}
          title={labelsOn ? 'Skrij oznake na zemljevidu' : 'Prikaži oznake na zemljevidu'}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
            labelsOn
              ? 'border-line text-text-dim hover:text-white hover:bg-white/10'
              : 'border-wheat/50 text-wheat bg-wheat/10'
          }`}
        >
          <Tag size={13} />
        </button>
      </div>

      {/* Italian station board — listed, never plotted, since ViaggiaTreno
          publishes no live coordinates. */}
      {isItaly && (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <p className="px-4 py-2 text-[10.5px] text-text-dim border-b border-line/60 leading-snug">
            Postajna tabla Villa Opicina (mejni prehod) in Trst. ViaggiaTreno ne objavlja
            koordinat, zato ti vlaki niso izrisani na zemljevidu.
          </p>
          {!italyBoard && <p className="px-4 py-6 text-[12px] text-text-dim text-center">Nalagam …</p>}
          {italyBoard && italyBoard.services.length === 0 && (
            <p className="px-4 py-6 text-[12px] text-text-dim text-center">Trenutno ni objavljenih storitev.</p>
          )}
          {(italyBoard?.services || [])
            .filter(s => !query.trim() || `${s.trainNumber} ${s.counterpart} ${s.station}`.toLowerCase().includes(query.toLowerCase()))
            .map((s, i) => (
              <div key={`${s.station}-${s.direction}-${s.trainNumber}-${i}`}
                   className="flex items-center gap-3 px-4 py-2.5 border-b border-line/60">
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  s.direction === 'odhod' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'
                }`}>{s.category}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] text-white font-semibold truncate">
                    {s.trainNumber} · {s.counterpart || '—'}
                  </span>
                  <span className="block text-[11px] text-text-dim truncate">
                    {s.station} · {s.direction}{s.platform ? ` · tir ${s.platform}` : ''}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[11px] font-mono text-text-dim">{s.scheduled}</span>
                  <span className={`block text-[11px] font-mono font-bold ${
                    s.delayMin > 5 ? 'text-red-400' : s.delayMin > 0 ? 'text-amber-300' : 'text-emerald-400'
                  }`}>
                    {s.delayMin > 0 ? `+${s.delayMin} min` : 'točno'}
                  </span>
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Rows */}
      {!isItaly && <div className="flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-text-dim text-center">
            Ni živih zapisov za ta sloj.
          </p>
        )}
        {filtered.map((r, i) => (
          <button
            key={`${r.id ?? i}`}
            onClick={() => focusRow(r)}
            className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-line/60 text-left
                       hover:bg-white/[0.06] transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.operatorColor || active.accent }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-white font-semibold truncate">{active.primary(r)}</span>
              <span className="block text-[11px] text-text-dim truncate">{active.secondary(r)}</span>
            </span>
            <span className="text-[11px] font-mono text-text-dim shrink-0">{active.metric(r)}</span>
            <Crosshair size={13} className="text-text-dim opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>}
    </div>
  );
}
