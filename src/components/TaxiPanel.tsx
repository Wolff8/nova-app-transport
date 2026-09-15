import { useCallback, useEffect, useState } from 'react';
import { X, Phone, Globe, Smartphone, MapPin, AlertTriangle, ArrowLeftRight, RefreshCw, Users, Euro } from 'lucide-react';
import taxiData from '../data/taxiProviders.json';

interface TaxiPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PrevozRide { id: string; time: string; driver: string; price: string; url: string }
interface PrevozRoute { from: string; to: string; rides: PrevozRide[] }
interface PrevozResponse { routes: PrevozRoute[]; totalRides: number; sourceUrl: string; basis: string }

/**
 * Real, currently-posted carpool offers (prevoz.org) — not live GPS, but
 * the same public listing any visitor to that site sees. Fetched from our
 * own server (/api/prevoz), which reads prevoz.org server-side; see
 * server.ts for the scrape + the honest "basis" line returned with it.
 */
function PrevozSopotnistvo() {
  const [from, setFrom] = useState('Murska Sobota');
  const [to, setTo] = useState('Ljubljana');
  const [data, setData] = useState<PrevozResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prevoz?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const json = await res.json();
      setData(json);
    } catch {
      setError('Prevoz.org trenutno ni dosegljiv.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="m-3 rounded-xl bg-white/[0.03] border border-line overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] border-b border-line">
        <div>
          <h3 className="text-[13px] font-bold text-white">Prevoz.org · Sopotništvo</h3>
          <p className="text-[10px] text-text-dim font-mono">Javno objavljene ponudbe za danes, ne živa GPS pozicija</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg border border-line text-text-dim hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Osveži"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/60">
        <span className="flex-1 text-[12px] text-white font-semibold truncate">{from}</span>
        <button
          onClick={() => { setFrom(to); setTo(from); }}
          className="p-1.5 rounded-lg border border-line text-text-dim hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Zamenjaj smer"
        >
          <ArrowLeftRight size={13} />
        </button>
        <span className="flex-1 text-[12px] text-white font-semibold truncate text-right">{to}</span>
      </div>

      {loading && !data && (
        <p className="px-3 py-5 text-[12px] text-text-dim text-center">Nalagam …</p>
      )}
      {error && (
        <p className="px-3 py-4 text-[11px] text-red-400">{error}</p>
      )}
      {data && data.routes.length === 0 && !loading && (
        <p className="px-3 py-5 text-[12px] text-text-dim text-center">Za danes ni objavljenih ponudb za to relacijo.</p>
      )}
      {data && data.routes.map((route, i) => (
        <div key={i} className="px-3 py-2 border-b border-line/40 last:border-b-0">
          <div className="text-[10px] uppercase tracking-wider text-text-dim font-semibold mb-1">
            {route.from} → {route.to}
          </div>
          <div className="space-y-1">
            {route.rides.map((ride) => (
              <a
                key={ride.id}
                href={ride.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
              >
                <span className="font-mono text-[11.5px] text-mura font-bold shrink-0">{ride.time}</span>
                <span className="flex-1 text-[11.5px] text-white/90 truncate flex items-center gap-1">
                  <Users size={11} className="text-text-dim shrink-0" /> {ride.driver}
                </span>
                <span className="text-[11px] text-emerald-300 font-mono flex items-center gap-0.5 shrink-0">
                  <Euro size={10} /> {ride.price.replace('€', '')}
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
      {data && (
        <p className="px-3 py-2 text-[9.5px] text-text-dim/60 font-mono">
          {data.basis}
        </p>
      )}
    </div>
  );
}

/**
 * Static, source-checked reference panel — not a live layer. Every field
 * (coverage cities, phone numbers, store links) was read directly off each
 * provider's own website; see src/data/taxiProviders.json for retrieval date
 * and per-entry notes. No taxi platform found publishes a public live-position
 * API, so this panel exists to hand the user a real, verified path (call or
 * open the app) instead of pretending the map can show taxis it cannot.
 */
export function TaxiPanel({ isOpen, onClose }: TaxiPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[60] h-[78dvh] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[420px]
                    flex flex-col bg-panel/95 backdrop-blur-xl border-t sm:border-t-0 sm:border-l border-line
                    rounded-t-2xl sm:rounded-none shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <div>
          <h2 className="text-white font-bold text-sm">Taxi & Prevozi</h2>
          <p className="text-[11px] text-text-dim font-mono">
            {taxiData.providers.length} preverjenih ponudnikov · Ljubljana / Maribor / Koper / Kamnik
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

      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <PrevozSopotnistvo />

        {/* Coverage & API honesty note, same pattern as the VagonWEB explanation elsewhere in the app */}
        <div className="m-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex gap-2.5">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-100/90 leading-relaxed space-y-1.5">
            <p><strong className="text-amber-300">Murska Sobota nima pokritosti.</strong> {taxiData.coverageNote}</p>
            <p className="text-amber-200/70">{taxiData.apiNote}</p>
          </div>
        </div>

        {taxiData.providers.map((p) => (
          <div key={p.id} className="mx-3 mb-3 p-3 rounded-xl bg-white/[0.03] border border-line">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[13px] font-bold text-white">{p.name}</h3>
              <div className="flex items-center gap-1 text-[10px] text-text-dim">
                <MapPin size={11} />
                {p.cities.join(', ')}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              <a
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] text-text-dim hover:text-white hover:bg-white/10 transition-colors"
              >
                <Globe size={11} /> Spletna stran
              </a>
              {'phone' in p && p.phone && (
                <a
                  href={`tel:${p.phone.replace(/\s+/g, '')}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] text-text-dim hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Phone size={11} /> {p.phone}
                </a>
              )}
              {'playStore' in p && p.playStore && (
                <a
                  href={p.playStore}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] text-text-dim hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Smartphone size={11} /> Android
                </a>
              )}
              {'appStore' in p && p.appStore && (
                <a
                  href={p.appStore}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] text-text-dim hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Smartphone size={11} /> iOS
                </a>
              )}
            </div>

            {'address' in p && p.address && (
              <p className="text-[10.5px] text-text-dim/80 font-mono mb-1">{p.address}</p>
            )}
            {'note' in p && p.note && (
              <p className="text-[10.5px] text-text-dim leading-snug">{p.note}</p>
            )}
            {'websiteUnreachableNote' in p && p.websiteUnreachableNote && (
              <p className="text-[10.5px] text-amber-300/70 leading-snug">{p.websiteUnreachableNote}</p>
            )}
          </div>
        ))}

        <p className="mx-3 mb-4 text-[9.5px] text-text-dim/60 font-mono">
          Vir: uradne spletne strani ponudnikov, pregledane {taxiData.retrieved}.
        </p>
      </div>
    </div>
  );
}
