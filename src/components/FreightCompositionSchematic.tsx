import React, { useState, useRef } from 'react';
import { 
  Train, 
  Container, 
  Fuel, 
  Boxes, 
  ShieldAlert, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  FileText, 
  Gauge, 
  Info,
  Maximize2,
  Minimize2,
  Sparkles,
  Weight
} from 'lucide-react';
import { CrossBorderFreightStatus, EnrichedFreightWagon } from '../data/crossBorderFreightRegistry';

interface FreightCompositionSchematicProps {
  freightStatus: CrossBorderFreightStatus;
  selectedWagon: EnrichedFreightWagon | null;
  onSelectWagon: (wagon: EnrichedFreightWagon | null) => void;
}

export const FreightCompositionSchematic: React.FC<FreightCompositionSchematicProps> = ({
  freightStatus,
  selectedWagon,
  onSelectWagon,
}) => {
  const [zoomMode, setZoomMode] = useState<'detailed' | 'compact'>('detailed');
  const [filterMode, setFilterMode] = useState<'all' | 'rid' | 'intermodal' | 'heavy'>('all');
  const trackScrollRef = useRef<HTMLDivElement>(null);

  const wagons = freightStatus.wagons || [];
  const loco = freightStatus.locomotive;
  const metrics = freightStatus.compositionMetrics;
  const raildata = freightStatus.raildataStatus;

  // Counts
  const ridCount = wagons.filter(w => !!w.ridHazard).length;
  const intermodalCount = wagons.filter(w => w.category === 'intermodal').length;
  const tankCount = wagons.filter(w => w.category === 'tank').length;
  const steelCount = wagons.filter(w => w.category === 'steel').length;

  const scrollConsist = (offset: number) => {
    if (trackScrollRef.current) {
      trackScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollToPosition = (pos: 'head' | 'mid' | 'tail') => {
    if (!trackScrollRef.current) return;
    if (pos === 'head') {
      trackScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (pos === 'tail') {
      trackScrollRef.current.scrollTo({ left: trackScrollRef.current.scrollWidth, behavior: 'smooth' });
    } else {
      trackScrollRef.current.scrollTo({ left: trackScrollRef.current.scrollWidth / 2, behavior: 'smooth' });
    }
  };

  // Render graphic container box with realistic shipping brand colors
  const renderContainerBox = (boxText: string, index: number) => {
    const brand = boxText.toUpperCase();
    let bg = 'bg-sky-700 border-sky-500 text-sky-100';
    let brandName = 'MAERSK';

    if (brand.includes('MSKU') || brand.includes('MAERSK')) {
      bg = 'bg-[#007da5] border-[#40bce3] text-white';
      brandName = 'MAERSK';
    } else if (brand.includes('MEDU') || brand.includes('MSC')) {
      bg = 'bg-[#cca400] border-[#ffe043] text-zinc-950 font-bold';
      brandName = 'MSC';
    } else if (brand.includes('CMA') || brand.includes('CMAU')) {
      bg = 'bg-[#0a2f5c] border-[#2563eb] text-white';
      brandName = 'CMA CGM';
    } else if (brand.includes('HLXU') || brand.includes('HAPAG')) {
      bg = 'bg-[#d9480f] border-[#ff7043] text-white font-bold';
      brandName = 'HAPAG-LLOYD';
    } else if (brand.includes('EGLV') || brand.includes('EVERGREEN')) {
      bg = 'bg-[#1b5e20] border-[#4caf50] text-emerald-100';
      brandName = 'EVERGREEN';
    } else if (brand.includes('ONEY') || brand.includes('ONE')) {
      bg = 'bg-[#c2185b] border-[#f06292] text-white';
      brandName = 'ONE';
    } else {
      bg = index % 2 === 0 ? 'bg-indigo-900 border-indigo-600 text-indigo-100' : 'bg-slate-800 border-slate-600 text-slate-100';
      brandName = 'ISO 40\' HC';
    }

    return (
      <div 
        key={index}
        className={`h-7 px-1.5 rounded-[3px] border shadow-inner flex flex-col justify-between py-0.5 text-[8.5px] font-mono leading-none min-w-[70px] ${bg}`}
      >
        <div className="flex items-center justify-between text-[7px] font-bold tracking-tight opacity-90">
          <span>{brandName}</span>
          <span>45G1</span>
        </div>
        <div className="truncate font-semibold text-[8px] text-center tracking-wider">
          {boxText}
        </div>
        <div className="flex items-center justify-between text-[6.5px] opacity-75">
          <span>MAX 32.5t</span>
          <span>TAF-TSI</span>
        </div>
      </div>
    );
  };

  // Render individual wagon schematic
  const renderWagonGraphic = (wagon: EnrichedFreightWagon, isSelected: boolean) => {
    const isRid = !!wagon.ridHazard;
    const isIntermodal = wagon.category === 'intermodal';
    const isTank = wagon.category === 'tank';
    const isSteel = wagon.category === 'steel';
    const isAuto = wagon.category === 'auto';
    const isBulk = wagon.category === 'bulk' || (wagon as any).category === 'bulk_grain';

    const isDimmed = (
      (filterMode === 'rid' && !isRid) ||
      (filterMode === 'intermodal' && !isIntermodal) ||
      (filterMode === 'heavy' && wagon.grossWeightTons < 70)
    );

    return (
      <div
        key={wagon.position}
        onClick={() => onSelectWagon(isSelected ? null : wagon)}
        className={`group relative flex flex-col items-center select-none cursor-pointer transition-all duration-200 shrink-0 ${
          zoomMode === 'compact' ? 'w-[105px]' : 'w-[155px]'
        } ${isDimmed ? 'opacity-30 grayscale' : 'opacity-100'}`}
      >
        {/* Wagon Selection Beacon Top */}
        <div className="h-4 flex items-center justify-center">
          {isSelected ? (
            <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-bold bg-amber-400 text-slate-950 animate-pulse shadow-sm shadow-amber-400/50">
              IZBRAN #{wagon.position}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
              #{wagon.position}
            </span>
          )}
        </div>

        {/* Wagon Body Shell Container */}
        <div 
          className={`w-full rounded-md p-1.5 flex flex-col justify-between border transition-all ${
            isSelected
              ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50'
              : 'bg-black/50 hover:bg-white/[0.06] border-white/15 hover:border-white/30'
          }`}
          style={{ minHeight: zoomMode === 'compact' ? '68px' : '88px' }}
        >
          {/* Top Identifier & Flags */}
          <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 mb-1">
            <span className="text-white font-semibold flex items-center gap-1">
              <span>{wagon.countryFlag}</span>
              <span className="truncate max-w-[70px]">{wagon.vkm}</span>
            </span>
            <span className="text-[7.5px] px-1 rounded bg-white/5 border border-white/10 text-zinc-300">
              {wagon.wagonSeries.split(' ')[0]}
            </span>
          </div>

          {/* Graphical Payload Representation */}
          <div className="my-auto w-full flex items-center justify-center">
            {isIntermodal ? (
              <div className="w-full flex items-center gap-1 justify-center overflow-hidden">
                {wagon.containers && wagon.containers.length > 0 ? (
                  wagon.containers.slice(0, 2).map((c, cIdx) => renderContainerBox(c, cIdx))
                ) : (
                  <div className="h-7 w-full rounded border border-dashed border-sky-400/40 bg-sky-950/30 flex items-center justify-center text-[8px] font-mono text-sky-300">
                    <Container size={11} className="mr-1" />
                    <span>80&apos; SPG PLOŠČAD</span>
                  </div>
                )}
              </div>
            ) : isTank ? (
              <div className="w-full relative py-1">
                {/* Tank Barrel Graphic */}
                <div className="h-7 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700 border border-zinc-400/40 relative flex items-center justify-between px-2 shadow-inner">
                  {/* Inspection Dome */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1.5 rounded-t-sm bg-zinc-500 border-t border-x border-zinc-300"></div>
                  {/* HAZMAT Placard */}
                  {wagon.ridHazard && (
                    <div className="px-1 py-0.2 rounded-sm bg-amber-500 text-slate-950 font-bold text-[7.5px] font-mono shadow leading-tight">
                      {wagon.ridHazard.kemlerCode} / {wagon.ridHazard.unNumber}
                    </div>
                  )}
                  <span className="text-[7.5px] font-mono text-zinc-300 truncate font-semibold">
                    {wagon.cargoDescription.split(' ')[0]}
                  </span>
                </div>
              </div>
            ) : isSteel ? (
              <div className="w-full py-0.5">
                {/* Telescopic Sliding Hoods */}
                <div className="h-6 rounded bg-gradient-to-b from-blue-950 via-slate-800 to-slate-900 border border-blue-400/30 flex items-center justify-around px-1 text-[7.5px] font-mono text-blue-200">
                  <div className="w-1/3 border-r border-blue-400/20 text-center truncate">1</div>
                  <div className="w-1/3 border-r border-blue-400/20 text-center truncate">2</div>
                  <div className="w-1/3 text-center truncate">3</div>
                </div>
                <div className="text-[7px] text-center font-mono text-zinc-400 mt-0.5">
                  Kolobarji jekla
                </div>
              </div>
            ) : isBulk ? (
              <div className="w-full py-0.5">
                {/* Hopper Funnel Shape */}
                <div className="h-6 rounded-t-md bg-amber-950/40 border border-amber-600/40 flex items-center justify-center text-[8px] font-mono text-amber-200">
                  <span>ŽITO / TAGNPPS</span>
                </div>
              </div>
            ) : isAuto ? (
              <div className="w-full py-0.5 space-y-0.5">
                <div className="h-2.5 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-around text-[6px] text-zinc-400">
                  <span>🚗</span><span>🚗</span><span>🚗</span>
                </div>
                <div className="h-2.5 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-around text-[6px] text-zinc-400">
                  <span>🚗</span><span>🚗</span><span>🚗</span>
                </div>
              </div>
            ) : (
              <div className="h-6 w-full rounded bg-zinc-800/80 border border-zinc-600 flex items-center justify-center text-[7.5px] font-mono text-zinc-300">
                <Boxes size={10} className="mr-1 text-zinc-400" />
                <span>{wagon.wagonSeries}</span>
              </div>
            )}
          </div>

          {/* Underframe Wagon Metrics Bar */}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[7.5px] font-mono text-zinc-400">
            <span className="text-white font-medium">{wagon.grossWeightTons} t</span>
            <span>{wagon.axles} osi</span>
            <span className="text-zinc-500">{wagon.lengthM}m</span>
          </div>
        </div>

        {/* Chassis, Bogies & Wheels on Steel Rails */}
        <div className="w-full flex items-center justify-between px-2 pt-0.5">
          {/* Bogie 1 (Left 2 wheels) */}
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-400 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-zinc-950"></div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-400 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-zinc-950"></div>
            </div>
          </div>

          {/* Center Brake Cylinder & Air Tank */}
          <div className="w-4 h-1 rounded bg-zinc-700 border border-zinc-600"></div>

          {/* Bogie 2 (Right 2 wheels) */}
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-400 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-zinc-950"></div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-400 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-zinc-950"></div>
            </div>
          </div>
        </div>

        {/* Wagon Coupler & Air Hose Connection */}
        <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-3 flex flex-col items-center pointer-events-none z-10">
          <div className="w-2.5 h-1 bg-zinc-400 border border-zinc-600 rounded-sm"></div>
          <div className="w-1.5 h-1 border-b border-red-500/70"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3.5 rounded-xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-sky-500/30 shadow-lg text-white space-y-3 font-sans">
      {/* 1. Header & RailData ISR Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400">
            <Train size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold uppercase font-mono tracking-wide text-white">
                Shematski prikaz kompozicije
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                RAILDATA ISR
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>CIM: <strong className="text-zinc-200">{raildata.cimConsignmentNote}</strong></span>
              <span>·</span>
              <span>ISR ID: <strong className="text-sky-300">{raildata.isrConsignmentId}</strong></span>
              <span>·</span>
              <span className="text-emerald-400">{raildata.sealStatus}</span>
            </div>
          </div>
        </div>

        {/* View & Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg bg-black/50 border border-white/10 p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setZoomMode('compact')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                zoomMode === 'compact' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
              title="Pregled celega vlaka (Fit)"
            >
              <Minimize2 size={11} />
              <span className="hidden sm:inline">Kompaktno</span>
            </button>
            <button
              onClick={() => setZoomMode('detailed')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                zoomMode === 'detailed' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
              title="Podroben pogled s pomikom"
            >
              <Maximize2 size={11} />
              <span className="hidden sm:inline">Podrobno</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => scrollConsist(-220)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Pomik levo"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => scrollConsist(220)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Pomik desno"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Consist Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/40 border border-white/5 rounded-lg p-2 text-center text-[10px] font-mono">
        <div className="p-1.5 rounded bg-white/[0.02]">
          <span className="text-zinc-500 block text-[9px] uppercase">Dolžina vlaka</span>
          <span className="text-[13px] font-bold text-white">{metrics.totalLengthM} m</span>
          <span className="text-[8.5px] text-emerald-400 block">Skladno TEN-T 740m</span>
        </div>
        <div className="p-1.5 rounded bg-white/[0.02]">
          <span className="text-zinc-500 block text-[9px] uppercase">Bruto masa</span>
          <span className="text-[13px] font-bold text-amber-300">{metrics.totalGrossTons.toLocaleString('sl-SI')} t</span>
          <span className="text-[8.5px] text-zinc-400 block">{metrics.axleLoadClass}</span>
        </div>
        <div className="p-1.5 rounded bg-white/[0.02]">
          <span className="text-zinc-500 block text-[9px] uppercase">Vagoni in osi</span>
          <span className="text-[13px] font-bold text-sky-300">{metrics.totalWagons} vagonov</span>
          <span className="text-[8.5px] text-zinc-400 block">{metrics.totalAxles} osi</span>
        </div>
        <div className="p-1.5 rounded bg-white/[0.02]">
          <span className="text-zinc-500 block text-[9px] uppercase">Zaviranje (UIC)</span>
          <span className="text-[13px] font-bold text-emerald-300">{metrics.brakePercentage}%</span>
          <span className="text-[8.5px] text-zinc-400 block">Režim UIC KE-GP</span>
        </div>
      </div>

      {/* 3. Filter and Quick Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-zinc-500 text-[9px] uppercase mr-0.5">Filter:</span>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
            }`}
          >
            Vsi ({wagons.length})
          </button>
          {intermodalCount > 0 && (
            <button
              onClick={() => setFilterMode('intermodal')}
              className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'intermodal'
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25 hover:bg-cyan-500/20'
              }`}
            >
              <Container size={10} />
              Kontejnerji ({intermodalCount})
            </button>
          )}
          {ridCount > 0 && (
            <button
              onClick={() => setFilterMode('rid')}
              className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'rid'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20'
              }`}
            >
              <ShieldAlert size={10} />
              Nevaren tovor RID ({ridCount})
            </button>
          )}
          <button
            onClick={() => setFilterMode('heavy')}
            className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 ${
              filterMode === 'heavy'
                ? 'bg-purple-500 text-slate-950 font-bold border-purple-400'
                : 'bg-purple-500/10 text-purple-300 border-purple-500/25 hover:bg-purple-500/20'
            }`}
          >
            <Weight size={10} />
            Težki vagoni (&gt;70 t)
          </button>
        </div>

        {/* Consist Position Jumpers */}
        <div className="flex items-center gap-1 text-[9px]">
          <span className="text-zinc-500 mr-1">Skoči:</span>
          <button
            onClick={() => scrollToPosition('head')}
            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
          >
            Lokomotiva
          </button>
          <button
            onClick={() => scrollToPosition('mid')}
            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
          >
            Sredina
          </button>
          <button
            onClick={() => scrollToPosition('tail')}
            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
          >
            Konec
          </button>
        </div>
      </div>

      {/* 4. The Visual Interactive Consist Track Diagram */}
      <div className="relative rounded-xl border border-white/10 bg-gradient-to-b from-slate-950 to-zinc-950/90 overflow-hidden shadow-inner p-3">
        {/* Overhead Catenary Wire Graphic */}
        <div className="w-full flex items-center justify-between mb-2 px-4 border-b border-zinc-700/60 pb-1">
          <div className="flex items-center gap-1 text-[8.5px] font-mono text-sky-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>Vozni vod / Vozno omrežje: 3 kV DC (SŽ) ➔ 25 kV 50Hz (MÁV / HŽ)</span>
          </div>
          <div className="text-[8.5px] font-mono text-zinc-500">
            ◄ Smer vožnje (Glava vlaka na levi)
          </div>
        </div>

        {/* Scrollable Trackbed Canvas */}
        <div 
          ref={trackScrollRef}
          className="overflow-x-auto pb-4 pt-1 flex items-end gap-2.5 no-scrollbar scroll-smooth"
        >
          {/* Lead Locomotive Graphic */}
          <div 
            className={`group flex flex-col items-center shrink-0 select-none cursor-pointer transition-all ${
              zoomMode === 'compact' ? 'w-[125px]' : 'w-[185px]'
            }`}
            onClick={() => onSelectWagon(null)}
          >
            {/* Header / Direction */}
            <div className="h-4 flex items-center justify-center">
              <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-bold bg-sky-400 text-slate-950 flex items-center gap-1 shadow-sm shadow-sky-400/50">
                <span>◄ VLEKA</span>
              </span>
            </div>

            {/* Locomotive Body Box */}
            <div 
              className="w-full rounded-md p-1.5 flex flex-col justify-between border bg-gradient-to-r from-sky-950/80 via-slate-800 to-slate-900 border-sky-400/40 shadow-md ring-1 ring-sky-500/20"
              style={{ minHeight: zoomMode === 'compact' ? '68px' : '88px' }}
            >
              {/* Pantograph and Country */}
              <div className="flex items-center justify-between text-[8px] font-mono text-zinc-300">
                <span className="font-bold text-wheat flex items-center gap-1">
                  <span>{loco?.countryFlag || '🇸🇮'}</span>
                  <span className="truncate max-w-[80px]">{loco?.operator || 'SŽ-TP'}</span>
                </span>
                <span className="text-[7.5px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {loco?.powerKw ? `${(loco.powerKw / 1000).toFixed(1)} MW` : '6.4 MW'}
                </span>
              </div>

              {/* Cab Graphic Silhouette with Headlights */}
              <div className="my-auto py-1 flex items-center justify-between px-1">
                {/* Dual LED Headlights (Glowing) */}
                <div className="flex flex-col gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047]"></div>
                </div>

                {/* Cab Center Windshield */}
                <div className="flex-1 mx-2 flex flex-col items-center">
                  <div className="h-4 w-12 rounded-t bg-sky-900/60 border border-sky-400/40 flex items-center justify-center text-[7.5px] font-bold text-sky-200">
                    CAB 1
                  </div>
                  <div className="text-[8px] font-mono font-bold text-white truncate max-w-[110px] mt-0.5">
                    {loco?.name || 'SŽ 541 Taurus'}
                  </div>
                </div>

                <div className="w-2 h-4 rounded-l bg-zinc-700 border border-zinc-500"></div>
              </div>

              {/* Underframe Technical Details */}
              <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[7.5px] font-mono text-zinc-400">
                <span className="text-wheat truncate font-semibold">{loco?.evn || '91 56 193 214-8'}</span>
                <span>Bo&apos;Bo&apos;</span>
              </div>
            </div>

            {/* Locomotive Bogies and Wheels */}
            <div className="w-full flex items-center justify-between px-2 pt-0.5">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-zinc-500 border border-zinc-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                </div>
                <div className="w-3 h-3 rounded-full bg-zinc-500 border border-zinc-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                </div>
              </div>
              <div className="w-6 h-1.5 rounded bg-zinc-600 border border-zinc-500"></div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-zinc-500 border border-zinc-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                </div>
                <div className="w-3 h-3 rounded-full bg-zinc-500 border border-zinc-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                </div>
              </div>
            </div>

            {/* Coupler to first wagon */}
            <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-3 flex flex-col items-center pointer-events-none z-10">
              <div className="w-2.5 h-1 bg-zinc-400 border border-zinc-600 rounded-sm"></div>
            </div>
          </div>

          {/* Wagons List in Consist */}
          {wagons.map(wagon => renderWagonGraphic(wagon, selectedWagon?.evn === wagon.evn))}
        </div>

        {/* Ballast and Steel Track Rails Layer */}
        <div className="w-full pt-1">
          {/* Steel Rail Top Head */}
          <div className="h-1 bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-300 shadow-[0_0_6px_rgba(255,255,255,0.4)]"></div>
          {/* Wooden / Concrete Sleepers (Ties) */}
          <div className="h-3 bg-[repeating-linear-gradient(90deg,#27272a_0px,#27272a_6px,#09090b_6px,#09090b_12px)] opacity-70"></div>
          {/* Crushed Rock Ballast */}
          <div className="h-1.5 bg-gradient-to-b from-zinc-800 to-zinc-950 border-t border-zinc-700/50"></div>
        </div>
      </div>

      {/* 5. Selected Wagon Detailed Technical Dossier Drawer (RailData TAF-TSI) */}
      {selectedWagon ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 space-y-2.5 animate-fadeIn font-mono text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-white flex items-center gap-1.5">
                <span>{selectedWagon.countryFlag}</span>
                <span>#{selectedWagon.position} {selectedWagon.wagonSeries}</span>
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9.5px] font-bold">
                {selectedWagon.category.toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-300">
                Imetnik (VKM): <strong className="text-white">{selectedWagon.vkm}</strong> ({selectedWagon.countryName})
              </span>
            </div>

            <button
              onClick={() => onSelectWagon(null)}
              className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
            >
              Zapri dosje ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div>
              <span className="text-zinc-400 block text-[9px] uppercase">EVN / UIC Številka:</span>
              <span className="text-white font-bold">{selectedWagon.evn}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[9px] uppercase">Bruto / Tara / Tovor:</span>
              <span className="text-white font-bold">{selectedWagon.grossWeightTons} t ({selectedWagon.tareWeightTons}t + {selectedWagon.payloadWeightTons}t)</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[9px] uppercase">Dolžina & Osi:</span>
              <span className="text-white font-bold">{selectedWagon.lengthM} m · {selectedWagon.axles} osi</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[9px] uppercase">Zavorni režim:</span>
              <span className="text-emerald-300 font-bold">{selectedWagon.brakeRegime}</span>
            </div>
          </div>

          {/* Cargo & Containers */}
          <div className="p-2 rounded-lg bg-black/40 border border-amber-500/20 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">Opis tovora v vagonu:</span>
              <span className="text-amber-300 font-semibold">{selectedWagon.cargoDescription}</span>
            </div>
            {selectedWagon.containers && selectedWagon.containers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5 text-[9.5px]">
                <span className="text-zinc-400">ISO Kontejnerji:</span>
                {selectedWagon.containers.map((cnt, idx) => (
                  <span key={idx} className="px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30 text-sky-200 font-bold">
                    {cnt}
                  </span>
                ))}
              </div>
            )}
            {selectedWagon.ridHazard && (
              <div className="p-1.5 rounded bg-red-500/15 border border-red-500/40 text-red-200 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-red-400 shrink-0" />
                  <span>NEVARNO BLAGO (RID / ADR): <strong>{selectedWagon.ridHazard.description}</strong></span>
                </div>
                <div className="flex items-center gap-1 shrink-0 font-bold">
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950">
                    {selectedWagon.ridHazard.kemlerCode}
                  </span>
                  <span className="px-1 py-0.2 rounded bg-slate-900 text-white border border-amber-500">
                    UN {selectedWagon.ridHazard.unNumber}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* TAF-TSI Consignment & Customs Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-zinc-400 pt-1 border-t border-amber-500/20">
            <div>
              <span>TAF-TSI WSR sporočilo: <strong className="text-white">{selectedWagon.tafTsiWsrId}</strong></span>
              <span className="mx-2">·</span>
              <span>Ciljni terminal: <strong className="text-wheat">{selectedWagon.destinationTerminal}</strong></span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 font-bold">
              <CheckCircle2 size={12} />
              <span>{selectedWagon.inspectionStatus}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-[10px] font-mono text-zinc-500 flex items-center justify-center gap-1.5">
          <Info size={12} />
          <span>Kliknite na posamezen vagon na shemi zgoraj za ogled celotnega tehničnega dosjeja in tovora (RailData ISR / TAF-TSI).</span>
        </div>
      )}
    </div>
  );
};
