import React, { useState, useRef } from 'react';
import { 
  Train, 
  Wind, 
  Zap, 
  Wifi, 
  Bike, 
  Accessibility, 
  Baby, 
  Luggage, 
  VolumeX, 
  Coffee, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  ExternalLink, 
  Layers, 
  Gauge, 
  ShieldCheck,
  CheckCircle2,
  Sliders,
  X,
  Sparkles
} from 'lucide-react';
import { EnrichedPassengerCoach } from '../data/passengerCoachRegistry';

interface PassengerCompositionSchematicProps {
  coaches: EnrichedPassengerCoach[];
  selectedCoach: EnrichedPassengerCoach | null;
  onSelectCoach: (coach: EnrichedPassengerCoach | null) => void;
  trainNumber?: string;
  trainType?: string;
  operator?: string;
}

export const PassengerCompositionSchematic: React.FC<PassengerCompositionSchematicProps> = ({
  coaches,
  selectedCoach,
  onSelectCoach,
  trainNumber,
  trainType,
  operator
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'floorplan' | 'technical'>('overview');
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const trackScrollRef = useRef<HTMLDivElement>(null);

  if (!coaches || coaches.length === 0) return null;

  const scrollConsist = (offset: number) => {
    if (trackScrollRef.current) {
      trackScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollToCoach = (idx: number) => {
    if (trackScrollRef.current) {
      const items = trackScrollRef.current.querySelectorAll('.coach-node');
      if (items[idx]) {
        (items[idx] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const selectNextCoach = () => {
    if (!selectedCoach) {
      onSelectCoach(coaches[0]);
      return;
    }
    const currentIdx = coaches.findIndex(c => c.id === selectedCoach.id);
    if (currentIdx < coaches.length - 1) {
      const next = coaches[currentIdx + 1];
      onSelectCoach(next);
      scrollToCoach(currentIdx + 1);
    }
  };

  const selectPrevCoach = () => {
    if (!selectedCoach) {
      onSelectCoach(coaches[coaches.length - 1]);
      return;
    }
    const currentIdx = coaches.findIndex(c => c.id === selectedCoach.id);
    if (currentIdx > 0) {
      const prev = coaches[currentIdx - 1];
      onSelectCoach(prev);
      scrollToCoach(currentIdx - 1);
    }
  };

  // Render individual realistic coach body on track
  const renderCoachBody = (coach: EnrichedPassengerCoach, idx: number) => {
    const isSelected = selectedCoach?.id === coach.id;
    const isLoco = coach.category === 'locomotive';
    const is1stClass = coach.category === '1st_class';
    const isDining = coach.category === 'dining';
    const isService = coach.category === 'service_bike';

    // Color theme based on coach type and UIC conventions
    // UIC standard: 1st class has a yellow band above the windows
    let liveryBg = 'from-slate-800 to-slate-900 border-slate-700';
    let roofBg = 'bg-slate-700';
    let bandColor = 'bg-sky-500/80';

    if (isLoco) {
      liveryBg = 'from-amber-900/60 via-slate-900 to-slate-950 border-amber-500/50';
      roofBg = 'bg-amber-600/60';
      bandColor = 'bg-amber-400';
    } else if (is1stClass) {
      liveryBg = 'from-amber-950/40 via-slate-900 to-slate-950 border-amber-400/40';
      roofBg = 'bg-slate-700';
      bandColor = 'bg-amber-400'; // Standard European 1st class yellow roofline band
    } else if (isDining) {
      liveryBg = 'from-red-950/40 via-slate-900 to-slate-950 border-red-500/40';
      roofBg = 'bg-slate-700';
      bandColor = 'bg-red-500';
    } else if (isService) {
      liveryBg = 'from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/40';
      roofBg = 'bg-slate-700';
      bandColor = 'bg-emerald-400';
    }

    return (
      <div 
        key={coach.id}
        onClick={() => {
          onSelectCoach(isSelected ? null : coach);
          scrollToCoach(idx);
        }}
        className={`coach-node shrink-0 cursor-pointer transition-all duration-200 flex flex-col items-center select-none group ${
          isSelected ? 'scale-105 z-20' : 'hover:scale-102 opacity-90 hover:opacity-100'
        }`}
        style={{ width: isLoco ? '110px' : '135px' }}
      >
        {/* Top Indicator / Number */}
        <div className="flex items-center gap-1 mb-1">
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors ${
            isSelected 
              ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm' 
              : 'bg-slate-800/90 text-slate-300 border border-slate-700'
          }`}>
            #{coach.position}
          </span>
          <span className={`text-[8.5px] font-mono px-1 rounded truncate max-w-[70px] ${
            isLoco 
              ? 'bg-amber-500/20 text-amber-300' 
              : is1stClass 
                ? 'bg-amber-400/20 text-amber-300' 
                : isDining 
                  ? 'bg-red-500/20 text-red-300' 
                  : isService 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-sky-500/10 text-sky-300'
          }`}>
            {coach.classDisplay}
          </span>
        </div>

        {/* Coach Railcar Body Graphic */}
        <div className={`relative w-full rounded-md border flex flex-col justify-between overflow-hidden shadow-md transition-all ${
          isSelected 
            ? 'ring-2 ring-amber-400 shadow-amber-500/20 bg-gradient-to-b ' + liveryBg
            : 'bg-gradient-to-b ' + liveryBg
        }`}
        style={{ height: '52px' }}
        >
          {/* Pantograph on Locomotive */}
          {isLoco && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
              <div className="w-6 h-1 bg-amber-400/80 rounded-t" />
              <div className="absolute -top-1 w-8 h-0.5 bg-amber-300" />
            </div>
          )}

          {/* Yellow 1st class roofline stripe (European UIC 567 Standard) */}
          {is1stClass && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" title="1. razred – rumena obrobna črta" />
          )}

          {/* Roof Line */}
          <div className={`w-full h-1.5 ${roofBg} opacity-80 border-b border-black/40`} />

          {/* Windows row */}
          <div className="flex-1 px-1.5 py-1 flex items-center justify-between gap-1">
            {isLoco ? (
              // Locomotive Cab Windows
              <div className="w-full flex items-center justify-between px-1">
                <div className="w-4 h-3 bg-sky-200/40 rounded-sm border border-sky-400/30 flex items-center justify-center text-[7px] text-sky-100">
                  ⚡
                </div>
                <div className="text-[9px] font-mono font-bold text-amber-300 tracking-wider">
                  {coach.operatorCode}
                </div>
                <div className="w-4 h-3 bg-sky-200/40 rounded-sm border border-sky-400/30" />
              </div>
            ) : (
              // Passenger Coach Windows
              <div className="w-full flex items-center justify-between gap-0.5">
                {Array.from({ length: 6 }).map((_, wIdx) => (
                  <div 
                    key={wIdx} 
                    className="flex-1 h-3 bg-gradient-to-b from-sky-200/30 to-sky-900/40 rounded-[2px] border border-sky-300/30 flex items-center justify-center"
                  >
                    {wIdx === 0 && is1stClass && <span className="text-[6.5px] font-bold text-amber-300">1</span>}
                    {wIdx === 0 && !is1stClass && !isDining && <span className="text-[6.5px] font-bold text-slate-300">2</span>}
                    {wIdx === 2 && isDining && <Coffee size={7} className="text-red-300" />}
                    {wIdx === 4 && isService && <Bike size={7} className="text-emerald-300" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coach Series Label on Body */}
          <div className="px-1.5 pb-1 flex items-center justify-between text-[8px] font-mono text-slate-300 border-t border-black/30 bg-black/20">
            <span className="truncate max-w-[80px] font-semibold">{coach.series.split(' ')[0]} {coach.series.split(' ')[1] || ''}</span>
            <span className="text-[7.5px] opacity-75">{coach.technicalSpecs.countryFlag}</span>
          </div>

          {/* Underbody Equipment Skirt */}
          <div className="h-1 bg-slate-950 w-full" />
        </div>

        {/* Bogies (Podstavni vozički) & Wheels & Track */}
        <div className="w-full flex justify-between px-3 -mt-0.5">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600 shadow-sm" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600 shadow-sm" />
          </div>
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600 shadow-sm" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600 shadow-sm" />
          </div>
        </div>

        {/* Coach Name Caption */}
        <div className="mt-1 text-center max-w-[130px]">
          <div className="text-[10px] font-semibold text-slate-200 truncate group-hover:text-amber-300 transition-colors">
            {coach.series}
          </div>
          <div className="text-[8.5px] text-slate-400 truncate">
            {coach.categoryLabel}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header bar with Mode info & Quick Stats */}
      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Train size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-wide">
                Sestava vlaka {trainNumber ? `· ${trainNumber}` : ''}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono">
                {coaches.length} vagonov
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Interaktivni pregled: kliknite na poljuben vagon za tloris sedežev in specifikacije
            </p>
          </div>
        </div>

        {/* Scroll navigation helpers */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollConsist(-200)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Pomakni levo"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => scrollConsist(200)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Pomakni desno"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Horizontal Railway Track & Consist Carousel */}
      <div className="relative rounded-xl bg-slate-950/90 border border-slate-800 p-3 pt-4 overflow-hidden">
        {/* Track Rails and Sleepers Visual Background */}
        <div className="absolute left-0 right-0 bottom-7 h-2 bg-gradient-to-r from-amber-600/30 via-slate-700 to-amber-600/30 border-y border-slate-600/50 pointer-events-none" />
        <div className="absolute left-0 right-0 bottom-4 flex justify-between pointer-events-none opacity-40 px-2">
          {Array.from({ length: 40 }).map((_, sIdx) => (
            <div key={sIdx} className="w-1.5 h-3 bg-amber-800/80 rounded-xs shadow-xs" />
          ))}
        </div>

        {/* Scrollable Track Container */}
        <div 
          ref={trackScrollRef}
          className="flex items-end gap-2.5 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent relative z-10"
          style={{ scrollBehavior: 'smooth' }}
        >
          {coaches.map((coach, idx) => (
            <React.Fragment key={coach.id}>
              {renderCoachBody(coach, idx)}
              {/* Coupler and Buffers between coaches */}
              {idx < coaches.length - 1 && (
                <div className="flex flex-col items-center justify-center shrink-0 mb-7 pointer-events-none">
                  <div className="w-3 h-1 bg-slate-500 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-slate-600 rounded-full -mt-0.5" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 font-mono border-t border-slate-800/60 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 1. razred
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> 2. razred
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Kolesa / PRM
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Restavracija
            </span>
          </div>
          <span className="text-slate-500">
            {selectedCoach ? `Izbran vagon: #${selectedCoach.position} ${selectedCoach.series}` : 'Izberite vagon za podrobnosti'}
          </span>
        </div>
      </div>

      {/* Expanded Interactive Coach Dossier Card */}
      {selectedCoach && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-amber-500/40 shadow-xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Top Dossier Header: Navigation & Identity */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-mono font-bold text-sm shrink-0">
                #{selectedCoach.position}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-white truncate">
                    {selectedCoach.fullTitle}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold">
                    {selectedCoach.series}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                    {selectedCoach.technicalSpecs.countryFlag} {selectedCoach.operator}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans mt-0.5 leading-relaxed">
                  {selectedCoach.description}
                </p>
              </div>
            </div>

            {/* Prev / Next Coach Stepper */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={selectPrevCoach}
                disabled={selectedCoach.position <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Prejšnji vagon"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={selectNextCoach}
                disabled={selectedCoach.position >= coaches.length}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Naslednji vagon"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => onSelectCoach(null)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                title="Zapri opis"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Dossier Tabs: Overview / Floorplan / Technical Specs */}
          <div className="flex items-center gap-1 border-b border-slate-800/80 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Sparkles size={13} />
              <span>Oprema in udobje</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('floorplan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'floorplan'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Layers size={13} />
              <span>Tloris sedežev in predelkov</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('technical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'technical'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Gauge size={13} />
              <span>Tehnični dosje (UIC/ERA)</span>
            </button>
          </div>

          {/* TAB 1: Oprema in udobje */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Highlights pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedCoach.highlights.map((hl, hIdx) => (
                  <div key={hIdx} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2 text-xs text-slate-200">
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>

              {/* Amenities Grid */}
              <div className="pt-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                  Potovalne storitve in udobje:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Klima */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.airConditioning
                      ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <Wind size={15} className={selectedCoach.amenities.airConditioning ? 'text-sky-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">Klimatizacija</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.airConditioning ? 'Avtomatska klima' : 'Klasično zračenje'}
                      </span>
                    </div>
                  </div>

                  {/* Vtičnice 230V */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.powerSockets230V
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <Zap size={15} className={selectedCoach.amenities.powerSockets230V ? 'text-amber-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">230V vtičnice</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.powerSockets230V ? 'Pri vseh sedežih' : 'Brez vtičnic'}
                      </span>
                    </div>
                  </div>

                  {/* Kolesa */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.bikeStorage
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <Bike size={15} className={selectedCoach.amenities.bikeStorage ? 'text-emerald-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">Prevoz koles</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.bikeStorage ? `Da (${selectedCoach.amenities.bikeStorageCount || 6} mest)` : 'Ni prostora za kolesa'}
                      </span>
                    </div>
                  </div>

                  {/* Invalidi / PRM */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.wheelchairAccessible
                      ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <Accessibility size={15} className={selectedCoach.amenities.wheelchairAccessible ? 'text-indigo-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">PRM invalidi</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.wheelchairAccessible ? 'Klančina + PRM WC' : 'Standardni vstop'}
                      </span>
                    </div>
                  </div>

                  {/* WiFi */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.wifi
                      ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <Wifi size={15} className={selectedCoach.amenities.wifi ? 'text-sky-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">Brezžični internet</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.wifi ? 'Brezplačen Wi-Fi' : 'Brez Wi-Fi'}
                      </span>
                    </div>
                  </div>

                  {/* Stranišče */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.vacuumToilet
                      ? 'bg-teal-950/30 border-teal-500/30 text-teal-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <CheckCircle2 size={15} className={selectedCoach.amenities.vacuumToilet ? 'text-teal-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">Vakuumski WC</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.vacuumToilet ? 'Zaprto biološko' : 'Gravitacijsko'}
                      </span>
                    </div>
                  </div>

                  {/* Tiha cona */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.quietZone
                      ? 'bg-purple-950/30 border-purple-500/30 text-purple-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <VolumeX size={15} className={selectedCoach.amenities.quietZone ? 'text-purple-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">Tiha cona</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.quietZone ? 'Tiho območje' : 'Standardno'}
                      </span>
                    </div>
                  </div>

                  {/* Gostinska ponudba */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    selectedCoach.amenities.restaurantService
                      ? 'bg-red-950/30 border-red-500/30 text-red-200'
                      : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                  }`}>
                    <Coffee size={15} className={selectedCoach.amenities.restaurantService ? 'text-red-400' : 'text-slate-500'} />
                    <div>
                      <span className="font-semibold block text-[11px]">Postrežba</span>
                      <span className="text-[9.5px] opacity-80">
                        {selectedCoach.amenities.restaurantService ? 'Bife / Minibar' : 'Brez strežbe'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Interaktivni tloris sedežev (Floorplan) */}
          {activeTab === 'floorplan' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span>Tloris vagona: {selectedCoach.series}</span>
                    <span className="text-amber-300 font-mono">({selectedCoach.seatMap.totalSeats} sedišč)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedCoach.seatMap.type === 'compartments' ? 'Oddelčna razporeditev (predelki)' : 'Odprti salon (2+2)'}
                  </span>
                </div>

                {/* Visual Coach Floorplan SVG / HTML */}
                {selectedCoach.category === 'locomotive' ? (
                  <div className="p-6 rounded-lg bg-black/40 border border-amber-500/20 text-center space-y-2">
                    <div className="text-3xl">⚡ 🚂</div>
                    <div className="text-xs font-bold text-amber-300 font-mono">
                      Strojna kabina lokomotive {selectedCoach.series}
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Vlečno vozilo brez potniških sedežev. Opremljeno z upravljalnico, pretvorniki, kompresorji in ETCS varnostnimi računalniki.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <div className="min-w-[550px] p-3 rounded-lg bg-slate-900/90 border border-slate-700/80 space-y-2">
                      {/* Coach outer boundary representation */}
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 border-b border-slate-800 pb-1 px-2">
                        <span>🚪 Vhodna vrata A + WC</span>
                        <span>Prehod med vagoni</span>
                        <span>🚪 Vhodna vrata B</span>
                      </div>

                      {/* Compartments or Saloon grid */}
                      {selectedCoach.seatMap.type === 'compartments' ? (
                        <div className="grid grid-cols-10 gap-1.5 py-1">
                          {Array.from({ length: selectedCoach.seatMap.compartmentsCount || 10 }).map((_, cIdx) => (
                            <div 
                              key={cIdx}
                              className="p-1.5 rounded bg-slate-950 border border-slate-800 flex flex-col items-center justify-between gap-1 hover:border-amber-400/50 transition-colors"
                            >
                              <span className="text-[8px] font-mono text-slate-400">#{cIdx + 1}</span>
                              {/* 6 seats representation */}
                              <div className="grid grid-cols-2 gap-1 w-full text-center">
                                {Array.from({ length: 6 }).map((_, sIdx) => {
                                  const seatNum = cIdx * 10 + sIdx + 1;
                                  const isSelected = selectedSeat === seatNum;
                                  return (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => setSelectedSeat(isSelected ? null : seatNum)}
                                      className={`h-4 rounded-[2px] text-[7.5px] font-mono flex items-center justify-center font-semibold transition-all cursor-pointer ${
                                        isSelected 
                                          ? 'bg-amber-400 text-slate-950 font-bold' 
                                          : 'bg-sky-950/60 hover:bg-sky-800/80 text-sky-200 border border-sky-600/30'
                                      }`}
                                      title={`Sedež št. ${seatNum}`}
                                    >
                                      {seatNum % 10}
                                    </button>
                                  );
                                })}
                              </div>
                              <span className="text-[7px] text-slate-500 font-mono">okno</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Saloon Open-plan seats
                        <div className="space-y-1 py-1">
                          <div className="flex justify-between gap-1 overflow-x-auto">
                            {Array.from({ length: 16 }).map((_, colIdx) => (
                              <div key={colIdx} className="flex flex-col gap-1 items-center">
                                <div className="flex gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSeat(colIdx * 4 + 1)}
                                    className="w-4 h-4 rounded-xs bg-sky-950/80 border border-sky-500/40 hover:bg-amber-400 hover:text-slate-950 text-[7px] text-sky-200 flex items-center justify-center cursor-pointer"
                                  >
                                    💺
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSeat(colIdx * 4 + 2)}
                                    className="w-4 h-4 rounded-xs bg-sky-950/80 border border-sky-500/40 hover:bg-amber-400 hover:text-slate-950 text-[7px] text-sky-200 flex items-center justify-center cursor-pointer"
                                  >
                                    💺
                                  </button>
                                </div>
                                <div className="h-2 w-full flex items-center justify-center text-[6px] text-slate-600 font-mono">
                                  |
                                </div>
                                <div className="flex gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSeat(colIdx * 4 + 3)}
                                    className="w-4 h-4 rounded-xs bg-sky-950/80 border border-sky-500/40 hover:bg-amber-400 hover:text-slate-950 text-[7px] text-sky-200 flex items-center justify-center cursor-pointer"
                                  >
                                    💺
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSeat(colIdx * 4 + 4)}
                                    className="w-4 h-4 rounded-xs bg-sky-950/80 border border-sky-500/40 hover:bg-amber-400 hover:text-slate-950 text-[7px] text-sky-200 flex items-center justify-center cursor-pointer"
                                  >
                                    💺
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hallway corridor line */}
                      <div className="h-2 rounded bg-slate-800/80 flex items-center justify-center text-[7.5px] font-mono text-slate-400 tracking-wider">
                        ⟵ OSREDNJI HODNIK / PREHOD MED VAGONI ⟶
                      </div>
                    </div>
                  </div>
                )}

                {selectedSeat != null && (
                  <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
                    <span>Izbran sedež: <strong className="text-amber-300 font-mono">št. {selectedSeat}</strong> ({selectedCoach.fullTitle})</span>
                    <span className="text-[10px] text-slate-300 font-mono">230V vtičnica v dosegu roke</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Tehnični dosje (UIC/ERA) */}
          {activeTab === 'technical' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">12-mestna EVN oznaka (UIC):</span>
                  <span className="text-white font-bold text-xs">{selectedCoach.technicalSpecs.evnSample}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Standard in serija konstrukcije:</span>
                  <span className="text-amber-300 font-bold text-xs">{selectedCoach.technicalSpecs.uicTypeStandard}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Najvišja konstrukcijska hitrost:</span>
                  <span className="text-emerald-400 font-bold text-xs">{selectedCoach.technicalSpecs.maxSpeedKmh} km/h (RIC)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Dolžina čez odbojnike & tara:</span>
                  <span className="text-white font-medium text-xs">{selectedCoach.technicalSpecs.lengthOverBuffersM} m · {selectedCoach.technicalSpecs.tareWeightTons} ton</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Tip podstavnih vozičkov:</span>
                  <span className="text-slate-200 text-xs">{selectedCoach.technicalSpecs.bogieType}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Ogrevalni & napajalni vod:</span>
                  <span className="text-slate-200 text-xs">{selectedCoach.technicalSpecs.heatingPowerSystem}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 col-span-1 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase">Zavorni sistem & zavorni odstotek:</span>
                  <span className="text-slate-200 text-xs">{selectedCoach.technicalSpecs.brakeType}</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Action: External link to VagonWEB */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Info size={12} className="text-amber-400 shrink-0" />
              <span>Podatki temeljijo na uradnih tehničnih specifikacijah UIC, ERA in VagonWEB.</span>
            </div>

            {selectedCoach.vagonwebUrl && (
              <a
                href={selectedCoach.vagonwebUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-mono text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <span>VagonWEB.cz sestava</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
