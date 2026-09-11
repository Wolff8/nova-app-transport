import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, Crosshair, X, Loader2, Train, Radio, Zap, Activity } from 'lucide-react';
import { searchGeocode } from '../lib/api';

interface SearchBarProps {
  onSelectLocation: (coords: [number, number], title: string, zoom?: number) => void;
  onFlyHome: () => void;
}

const PRESET_LOCATIONS = [
  { name: 'MS Center', coords: [16.1664, 46.6592] as [number, number], icon: MapPin, type: 'Center mesta' },
  { name: 'C-ITS Lendavska', coords: [16.1710, 46.6590] as [number, number], icon: Activity, type: 'C-ITS SPaT Semafor' },
  { name: 'C-ITS BTC Mura', coords: [16.1785, 46.6570] as [number, number], icon: Activity, type: 'C-ITS Zeleni Val' },
  { name: 'SŽ ŽP Sobota', coords: [16.1718, 46.6588] as [number, number], icon: Train, type: 'Železniška postaja' },
  { name: 'Expano Jezero', coords: [16.1392, 46.6478] as [number, number], icon: Activity, type: 'Soboško jezero' },
  { name: 'LoRaWAN IoT', coords: [16.1668, 46.6625] as [number, number], icon: Radio, type: 'IoT Gateway' },
  { name: 'EV Supercharger', coords: [16.1725, 46.6612] as [number, number], icon: Zap, type: '150 kW Polnilnica' },
  { name: 'Lipovci SŽ', coords: [16.2160, 46.6120] as [number, number], icon: Train, type: 'Postajališče Lipovci' },
  { name: 'Hodoš Meja', coords: [16.3260, 46.9050] as [number, number], icon: Navigation, type: 'Mejna postaja HU' },
];

export const SearchBar: React.FC<SearchBarProps> = ({ onSelectLocation, onFlyHome }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const res = await searchGeocode(query);
      setResults(res);
      setIsLoading(false);
      setIsOpen(true);
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside clicks
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const parseCoordinates = (str: string): { lat: number; lon: number; name: string } | null => {
    const clean = str.replace(/[°NSEW]/gi, '').trim();
    const match = clean.match(/^([-+]?\d{1,3}(?:\.\d+)?)[,\s/]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (!match) return null;
    const v1 = parseFloat(match[1]);
    const v2 = parseFloat(match[2]);
    if (isNaN(v1) || isNaN(v2)) return null;

    let lat = v1;
    let lon = v2;
    // In Slovenia / Europe, lat is ~45..48, lon is ~13..18
    if (v2 >= 35 && v2 <= 65 && v1 >= -15 && v1 <= 40) {
      lat = v2;
      lon = v1;
    } else if (v1 >= 35 && v1 <= 65 && v2 >= -15 && v2 <= 40) {
      lat = v1;
      lon = v2;
    }

    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        lat,
        lon,
        name: `GPS: ${lat.toFixed(5)}°N, ${lon.toFixed(5)}°E`
      };
    }
    return null;
  };

  const handleSelect = (r: any) => {
    onSelectLocation([r.lon, r.lat], r.name || r.displayName, 16);
    setQuery(r.name);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const coord = parseCoordinates(query);
      if (coord) {
        onSelectLocation([coord.lon, coord.lat], coord.name, 16);
        setIsOpen(false);
        return;
      }
      if (results.length > 0) {
        handleSelect(results[0]);
      }
    }
  };

  const handlePresetClick = (preset: typeof PRESET_LOCATIONS[0]) => {
    onSelectLocation(preset.coords, preset.name, 15.5);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative z-30 w-full max-w-xl">
      {/* Main Input Box */}
      <div className="flex items-center gap-2 bg-panel/95 backdrop-blur-xl border border-line rounded-2xl px-3 py-1.5 shadow-2xl transition-all focus-within:border-mura focus-within:ring-1 focus-within:ring-mura/40">
        <Search className="w-4 h-4 text-text-dim shrink-0" />
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Išči lokacijo, naslov, SŽ postajo ali vpiši koordinate (npr. 46.659, 16.166)..."
          className="w-full bg-transparent border-none outline-none text-[12.5px] text-text-main placeholder:text-text-dim/60 font-sans"
        />

        {isLoading && <Loader2 className="w-4 h-4 text-wheat animate-spin shrink-0" />}

        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="p-1 text-text-dim hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        )}

        <button
          onClick={onFlyHome}
          title="Centriraj na Mursko Soboto"
          className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/15 border border-line rounded-xl text-wheat text-[11px] font-mono font-medium transition-all shrink-0 cursor-pointer"
        >
          <Crosshair size={12} />
          <span className="hidden sm:inline">MS Center</span>
        </button>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
        {PRESET_LOCATIONS.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              onClick={() => handlePresetClick(p)}
              className="flex items-center gap-1 px-2.5 py-0.5 bg-ink/80 hover:bg-panel/95 backdrop-blur-md border border-line hover:border-wheat/50 rounded-lg text-[10.5px] text-text-dim hover:text-white whitespace-nowrap transition-all cursor-pointer font-mono"
            >
              <Icon size={11} className="text-wheat/80" />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Geocoding Dropdown Suggestions */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-panel/95 backdrop-blur-xl border border-line rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-line/40 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-mono text-text-dim uppercase tracking-wider bg-ink/40">
            Rezultati iskanja (Geocoding)
          </div>
          {results.map((r, i) => (
            <button
              key={r.id || i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-start gap-2.5 transition-colors group cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-mura mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-white group-hover:text-wheat truncate">
                  {r.name}
                </div>
                <div className="text-[10px] text-text-dim truncate font-mono">
                  {r.displayName}
                </div>
              </div>
              <span className="text-[9.5px] font-mono text-text-dim/60 shrink-0 uppercase px-1.5 py-0.5 rounded bg-white/5 border border-line">
                {r.type || 'Kraj'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
