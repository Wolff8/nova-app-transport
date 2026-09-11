export interface LocomotiveDataSource {
  name: string;
  source: string;
  country: string;
  countryFlag: string;
  status: 'ACTIVE' | 'CONNECTED';
  description: string;
  apiProtocol: string;
  protocol?: string;
}

export interface EnrichedLocomotive {
  id: string;
  series: string; // e.g. "Vectron MS 193 / ÖBB 1293 / GySEV 471"
  name: string; // Display name
  evn: string; // 12-digit European Vehicle Number e.g. "91 55 0471 002-1 H-GYSEV"
  eratvCode: string; // ERA type authorization
  countryCode: string; // "SI" | "AT" | "HU" | "CZ" | "DE" | "IT" | "HR" | "PL"
  countryName: string;
  countryFlag: string;
  uicCountryCode: number; // 79 = SI, 81 = AT, 55 = HU, 54 = CZ, 80 = DE, 83 = IT, 78 = HR, 51 = PL
  operator: string;
  manufacturer: string;
  propulsion: 'electric_multisystem' | 'electric_dc' | 'electric_ac' | 'diesel_electric' | 'dmu' | 'emu';
  propulsionLabel: string;
  powerKw: number;
  powerHp: number;
  maxSpeedKmh: number;
  maxSpeedKmH?: number;
  voltageSystems: string[];
  voltageSummary: string;
  safetySystems: string[];
  authorizedCountries: string[];
  countryApprovals?: string[];
  axleArrangement: string;
  weightTons: number;
  lengthMeters: number;
  dataSources: LocomotiveDataSource[];
  compositionLine: string;
}

export const COMMON_DATA_SOURCES: Record<string, LocomotiveDataSource> = {
  era: {
    name: 'ERA ERATV / EVR',
    source: 'Evropska železniška agencija (ERA) – Register odobrenih tipov vozil & EVR',
    country: 'Evropska Unija (EU)',
    countryFlag: '🇪🇺',
    status: 'ACTIVE',
    description: 'Uradna registracija vozila po direktivi (EU) 2016/797, 12-mestna EVN oznaka, TSI skladnost.',
    apiProtocol: 'SPARQL Linked Open Data (graph.data.era.europa.eu)'
  },
  obb: {
    name: 'ÖBB Open Data / RCG TransFER',
    source: 'ÖBB-Infrastruktur AG & Rail Cargo Group (Avstrija)',
    country: 'Avstrija',
    countryFlag: '🇦🇹',
    status: 'CONNECTED',
    description: 'Voznoredni podatki, vlečna vozila Siemens Taurus/Vectron in čezmejni koridorji (Šentilj, Jesenice, Tarvisio).',
    apiProtocol: 'Open Rail Data Austria & HAFAS API'
  },
  mav: {
    name: 'MÁV EMIG / VPE / GySEV',
    source: 'MÁV Zrt. & GySEV Cargo (Madžarska / Avstrija)',
    country: 'Madžarska',
    countryFlag: '🇭🇺',
    status: 'CONNECTED',
    description: 'Nadzorni sistem EMIG, dodelitev tras VPE in sledenje tovornih vlakov prek mejne postaje Hodoš (Őrihodos).',
    apiProtocol: 'MÁV Open Telematics & VPE Kapacitás'
  },
  cd: {
    name: 'ČD Cargo / Správa železnic',
    source: 'ČD Cargo a.s. & Správa železnic (Češka)',
    country: 'Češka',
    countryFlag: '🇨🇿',
    status: 'CONNECTED',
    description: 'Sledenje težkih industrijskih kompozicij (jeklo, avtomobili) po koridorju RFC 11 Amber do Luke Koper.',
    apiProtocol: 'Správa železnic GTFS-RT & TAF-TSI'
  },
  sz: {
    name: 'SŽ-Infrastruktura & SŽ-TP',
    source: 'Slovenske železnice – Tovorni promet & Program omrežja RS',
    country: 'Slovenija',
    countryFlag: '🇸🇮',
    status: 'ACTIVE',
    description: 'Nacionalni register vlečnih vozil, vozni redi tovornega prometa in geometrija prog.',
    apiProtocol: 'SŽ TIS & Program omrežja RS'
  },
  uic: {
    name: 'UIC TAF-TSI / ISR',
    source: 'Mednarodna železniška zveza (UIC) – International Service for Freight Train Tracing',
    country: 'Mednarodno (UIC)',
    countryFlag: '🇪🇺',
    status: 'ACTIVE',
    description: 'Elektronska izmenjava podatkov o sestavi tovornega vlaka in prehodih državnih meja v realnem času.',
    apiProtocol: 'UIC Leaflet 404-2 / TAF TSI'
  }
};

export const EUROPEAN_LOCOMOTIVES: EnrichedLocomotive[] = [
  // 1. GySEV Vectron (Hungary / Austria)
  {
    id: 'gysev_vectron_193',
    series: 'Siemens Vectron AC/DC (GySEV 471)',
    name: 'GySEV 471 »Vectron« (Siemens Vectron MS)',
    evn: '91 55 0471 002-1 H-GYSEV',
    eratvCode: '11-094-0001-2-001',
    countryCode: 'HU',
    countryName: 'Madžarska',
    countryFlag: '🇭🇺',
    uicCountryCode: 55,
    operator: 'GySEV Cargo / Raaberbahn',
    manufacturer: 'Siemens Mobility (München-Allach)',
    propulsion: 'electric_multisystem',
    propulsionLabel: 'Večsistemska električna lokomotiva (4-sistemska AC/DC)',
    powerKw: 6400,
    powerHp: 8700,
    maxSpeedKmh: 160,
    voltageSystems: ['25 kV 50 Hz AC', '15 kV 16.7 Hz AC', '3 kV DC', '1.5 kV DC'],
    voltageSummary: '3 kV DC (SI/IT) · 15 kV AC (AT/DE) · 25 kV AC (HU/HR/SK)',
    safetySystems: ['ETCS Baseline 3 (Level 2)', 'PZB 90 / LZB (AT/DE)', 'MIREL VZ1 (HU/SK/CZ)', 'INDUSI I60R (SI)'],
    authorizedCountries: ['SI', 'AT', 'HU', 'DE', 'PL', 'RO', 'HR', 'CZ', 'SK'],
    axleArrangement: "Bo'Bo'",
    weightTons: 87.0,
    lengthMeters: 18.98,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.mav, COMMON_DATA_SOURCES.uic],
    compositionLine: 'GySEV 471 002 »Vectron« – Siemens Vectron AC/DC (6.400 kW, UIC 91 55 0471 002-1 H-GYSEV, 25 kV/15 kV/3 kV, ETCS L2)'
  },

  // 2. ÖBB Taurus 1216 (Austria)
  {
    id: 'obb_taurus_1216',
    series: 'Siemens EuroSprinter ES64U4 (ÖBB 1216)',
    name: 'ÖBB 1216 »Taurus« (Siemens ES64U4)',
    evn: '91 81 1216 019-0 A-ÖBB',
    eratvCode: '11-042-0001-3-001',
    countryCode: 'AT',
    countryName: 'Avstrija',
    countryFlag: '🇦🇹',
    uicCountryCode: 81,
    operator: 'Rail Cargo Group (ÖBB RCG)',
    manufacturer: 'Siemens Transportation Systems (Graz/München)',
    propulsion: 'electric_multisystem',
    propulsionLabel: 'Večsistemska električna lokomotiva (3-sistemska AC/DC)',
    powerKw: 6400,
    powerHp: 8700,
    maxSpeedKmh: 230,
    voltageSystems: ['15 kV 16.7 Hz AC', '25 kV 50 Hz AC', '3 kV DC'],
    voltageSummary: '15 kV AC (Avstrija/Nemčija) · 25 kV AC (Madžarska) · 3 kV DC (Slovenija/Italija)',
    safetySystems: ['ETCS Level 2', 'PZB 90 / LZB', 'MIREL VZ1', 'SCMT (Italija)', 'INDUSI I60R'],
    authorizedCountries: ['AT', 'SI', 'IT', 'DE', 'HU', 'HR', 'CZ', 'SK'],
    axleArrangement: "Bo'Bo'",
    weightTons: 86.5,
    lengthMeters: 19.58,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.obb, COMMON_DATA_SOURCES.uic],
    compositionLine: 'ÖBB 1216 019 »Taurus« – Siemens EuroSprinter ES64U4 (6.400 kW, UIC 91 81 1216 019-0 A-ÖBB, 15 kV/25 kV/3 kV, ETCS L2)'
  },

  // 3. ÖBB Vectron 1293 (Austria)
  {
    id: 'obb_vectron_1293',
    series: 'Siemens Vectron MS (ÖBB 1293)',
    name: 'ÖBB 1293 »Vectron MS«',
    evn: '91 81 1293 018-8 A-ÖBB',
    eratvCode: '11-094-0001-2-001',
    countryCode: 'AT',
    countryName: 'Avstrija',
    countryFlag: '🇦🇹',
    uicCountryCode: 81,
    operator: 'Rail Cargo Group (ÖBB RCG)',
    manufacturer: 'Siemens Mobility (München-Allach)',
    propulsion: 'electric_multisystem',
    propulsionLabel: 'Večsistemska tovorna električna lokomotiva (4-sistemska)',
    powerKw: 6400,
    powerHp: 8700,
    maxSpeedKmh: 160,
    voltageSystems: ['15 kV 16.7 Hz AC', '25 kV 50 Hz AC', '3 kV DC', '1.5 kV DC'],
    voltageSummary: '3 kV DC · 15 kV AC · 25 kV AC · 1.5 kV DC',
    safetySystems: ['ETCS Baseline 3 (Level 2)', 'PZB 90 / LZB', 'MIREL', 'INDUSI'],
    authorizedCountries: ['AT', 'DE', 'SI', 'IT', 'HU', 'CZ', 'SK', 'PL', 'HR'],
    axleArrangement: "Bo'Bo'",
    weightTons: 87.0,
    lengthMeters: 18.98,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.obb, COMMON_DATA_SOURCES.uic],
    compositionLine: 'ÖBB 1293 018 »Vectron« – Večsistemska tovorna lokomotiva (6.400 kW, UIC 91 81 1293 018-8 A-ÖBB, ETCS Baseline 3)'
  },

  // 4. ČD Cargo Vectron 383 (Czechia)
  {
    id: 'cd_vectron_383',
    series: 'Siemens Vectron MS (ČD Cargo 383)',
    name: 'ČD Cargo 383 »Vectron MS«',
    evn: '91 54 7383 005-6 CZ-CDC',
    eratvCode: '11-094-0001-2-001',
    countryCode: 'CZ',
    countryName: 'Češka',
    countryFlag: '🇨🇿',
    uicCountryCode: 54,
    operator: 'ČD Cargo a.s.',
    manufacturer: 'Siemens Mobility (München-Allach)',
    propulsion: 'electric_multisystem',
    propulsionLabel: 'Večsistemska tovorna električna lokomotiva (4-sistemska)',
    powerKw: 6400,
    powerHp: 8700,
    maxSpeedKmh: 160,
    voltageSystems: ['3 kV DC', '25 kV 50 Hz AC', '15 kV 16.7 Hz AC', '1.5 kV DC'],
    voltageSummary: '3 kV DC (CZ/SI) · 25 kV AC (CZ/HU/SK) · 15 kV AC (AT/DE)',
    safetySystems: ['ETCS Baseline 3', 'MIREL VZ1', 'PZB 90', 'INDUSI I60R'],
    authorizedCountries: ['CZ', 'SK', 'PL', 'AT', 'DE', 'HU', 'SI', 'HR', 'RO'],
    axleArrangement: "Bo'Bo'",
    weightTons: 87.0,
    lengthMeters: 18.98,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.cd, COMMON_DATA_SOURCES.uic],
    compositionLine: 'ČD Cargo 383 005 »Vectron« – Siemens Vectron MS (6.400 kW, UIC 91 54 7383 005-6 CZ-CDC, RFC 11 Amber, ETCS L2)'
  },

  // 5. Adria Transport Taurus 1216 (Slovenia / Port of Koper)
  {
    id: 'adria_transport_1216',
    series: 'Siemens EuroSprinter ES64U4 (Adria Transport 1216)',
    name: 'Adria Transport 1216-920 »Taurus«',
    evn: '91 81 1216 920-5 A-AT',
    eratvCode: '11-042-0001-3-001',
    countryCode: 'SI',
    countryName: 'Slovenija / Avstrija',
    countryFlag: '🇸🇮',
    uicCountryCode: 81,
    operator: 'Adria Transport d.o.o. (Luka Koper / GKB)',
    manufacturer: 'Siemens Transportation Systems',
    propulsion: 'electric_multisystem',
    propulsionLabel: 'Večsistemska električna lokomotiva (3-sistemska)',
    powerKw: 6400,
    powerHp: 8700,
    maxSpeedKmh: 230,
    voltageSystems: ['3 kV DC', '15 kV 16.7 Hz AC', '25 kV 50 Hz AC'],
    voltageSummary: '3 kV DC (Slovenija) · 15 kV AC (Avstrija/Nemčija) · 25 kV AC (Madžarska)',
    safetySystems: ['ETCS Level 2', 'INDUSI I60R', 'PZB 90', 'MIREL'],
    authorizedCountries: ['SI', 'AT', 'DE', 'HU', 'HR', 'IT'],
    axleArrangement: "Bo'Bo'",
    weightTons: 86.5,
    lengthMeters: 19.58,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.sz, COMMON_DATA_SOURCES.uic],
    compositionLine: 'Adria Transport 1216-920 »Taurus« – Siemens ES64U4 (6.400 kW, UIC 91 81 1216 920-5 A-AT, Luka Koper, ETCS L2)'
  },

  // 6. SŽ 541 Taurus (Slovenia)
  {
    id: 'sz_taurus_541',
    series: 'SŽ serija 541 (Siemens ES64U4)',
    name: 'SŽ 541 »Taurus« (Siemens ES64U4)',
    evn: '91 79 1 541 101-2 SI-SŽ',
    eratvCode: '11-042-0001-3-001',
    countryCode: 'SI',
    countryName: 'Slovenija',
    countryFlag: '🇸🇮',
    uicCountryCode: 79,
    operator: 'SŽ - Tovorni promet / SŽ - Potniški promet',
    manufacturer: 'Siemens Transportation Systems',
    propulsion: 'electric_multisystem',
    propulsionLabel: 'Večsistemska univerzalna električna lokomotiva (3-sistemska)',
    powerKw: 6400,
    powerHp: 8700,
    maxSpeedKmh: 230,
    voltageSystems: ['3 kV DC', '15 kV 16.7 Hz AC', '25 kV 50 Hz AC'],
    voltageSummary: '3 kV DC (Slovenija/Italija) · 15 kV AC (Avstrija/Nemčija) · 25 kV AC (Madžarska/Hrvaška)',
    safetySystems: ['ETCS Level 2 (Baseline 3)', 'INDUSI I60R', 'PZB 90 / LZB', 'MIREL VZ1', 'SCMT'],
    authorizedCountries: ['SI', 'AT', 'DE', 'HU', 'HR', 'IT'],
    axleArrangement: "Bo'Bo'",
    weightTons: 87.0,
    lengthMeters: 19.58,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.sz, COMMON_DATA_SOURCES.uic],
    compositionLine: 'SŽ 541-101 »Taurus« – Večsistemska električna lokomotiva (Siemens ES64U4, 6.400 kW, UIC 91 79 1 541 101-2 SI-SŽ)'
  },

  // 7. SŽ 664 "Reagan" (Diesel heavy hauler)
  {
    id: 'sz_reagan_664',
    series: 'SŽ serija 664 (General Motors EMD GT26CW-2)',
    name: 'SŽ 664 »Reagan« (EMD GT26CW-2)',
    evn: '92 79 2 664 112-8 SI-SŽ',
    eratvCode: '11-000-0064-2-001',
    countryCode: 'SI',
    countryName: 'Slovenija',
    countryFlag: '🇸🇮',
    uicCountryCode: 79,
    operator: 'SŽ - Tovorni promet',
    manufacturer: 'General Motors Electro-Motive Division (London, Ontario / Đuro Đaković)',
    propulsion: 'diesel_electric',
    propulsionLabel: 'Težka 6-osna dizel-električna tovorna lokomotiva',
    powerKw: 1680,
    powerHp: 2250,
    maxSpeedKmh: 105,
    voltageSystems: ['Neelektrificirane proge / Dizelska avtonomija'],
    voltageSummary: 'Dizel-električni pogon (V16 EMD 16-645E3 dvotaktni turbodizel, 6 vlečnih elektromotorjev)',
    safetySystems: ['INDUSI I60R', 'Avtostop naprava', 'Radio-dispečerska zveza RDZ'],
    authorizedCountries: ['SI', 'HR'],
    axleArrangement: "Co'Co'",
    weightTons: 113.0,
    lengthMeters: 20.73,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.sz],
    compositionLine: 'SŽ 664-112 »Reagan« – Težka 6-osna dizel-električna lokomotiva (EMD 16-645E3, 2.250 KM, UIC 92 79 2 664 112-8 SI-SŽ)'
  },

  // 8. MÁV 480 Traxx (Hungary)
  {
    id: 'mav_traxx_480',
    series: 'Bombardier Traxx AC2 (MÁV 480)',
    name: 'MÁV 480 »Traxx AC2«',
    evn: '91 55 0480 005-9 H-START',
    eratvCode: '11-036-0001-2-001',
    countryCode: 'HU',
    countryName: 'Madžarska',
    countryFlag: '🇭🇺',
    uicCountryCode: 55,
    operator: 'MÁV-START / Rail Cargo Hungaria',
    manufacturer: 'Bombardier Transportation (Kassel)',
    propulsion: 'electric_ac',
    propulsionLabel: 'Dvofrekvenčna električna lokomotiva (25 kV / 15 kV AC)',
    powerKw: 5600,
    powerHp: 7600,
    maxSpeedKmh: 160,
    voltageSystems: ['25 kV 50 Hz AC', '15 kV 16.7 Hz AC'],
    voltageSummary: '25 kV 50 Hz AC (Madžarska/Slovaška) · 15 kV 16.7 Hz AC (Avstrija/Nemčija)',
    safetySystems: ['ETCS Baseline 2/3', 'MIREL VZ1 (HU/SK)', 'PZB 90'],
    authorizedCountries: ['HU', 'AT', 'DE', 'RO', 'SK'],
    axleArrangement: "Bo'Bo'",
    weightTons: 84.0,
    lengthMeters: 18.90,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.mav, COMMON_DATA_SOURCES.uic],
    compositionLine: 'MÁV 480 005 »Traxx« – Dvofrekvenčna električna lokomotiva (Bombardier Traxx AC2, 5.600 kW, UIC 91 55 0480 005-9 H-START)'
  },

  // 9. SŽ 363 "Brižita" (Alsthom)
  {
    id: 'sz_brizita_363',
    series: 'SŽ serija 363 (Alsthom CC 3 kV)',
    name: 'SŽ 363 »Brižita« (Alsthom)',
    evn: '91 79 1 363 019-3 SI-SŽ',
    eratvCode: '11-000-0063-1-001',
    countryCode: 'SI',
    countryName: 'Slovenija',
    countryFlag: '🇸🇮',
    uicCountryCode: 79,
    operator: 'SŽ - Tovorni promet',
    manufacturer: 'Alsthom (Belfort, Francija)',
    propulsion: 'electric_dc',
    propulsionLabel: 'Težka 6-osna enosmerna tovorna električna lokomotiva',
    powerKw: 2750,
    powerHp: 3740,
    maxSpeedKmh: 125,
    voltageSystems: ['3 kV DC'],
    voltageSummary: 'Enosmerni sistem 3 kV DC (Glavno slovensko omrežje & klanec Koper–Divača)',
    safetySystems: ['INDUSI I60R', 'Avtostop naprava', 'RDZ'],
    authorizedCountries: ['SI'],
    axleArrangement: "C'C'",
    weightTons: 114.0,
    lengthMeters: 19.50,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.sz],
    compositionLine: 'SŽ 363-019 »Brižita« – Težka 6-osna električna lokomotiva (Alsthom, 2.750 kW, UIC 91 79 1 363 019-3 SI-SŽ, 3 kV DC)'
  },

  // 10. Stadler FLIRT EMU (SŽ 510)
  {
    id: 'sz_flirt_510',
    series: 'SŽ serija 510 (Stadler FLIRT 3 EMU)',
    name: 'SŽ 510 »Stadler FLIRT« (Električna garnitura)',
    evn: '94 79 1 510 001-4 SI-SŽ',
    eratvCode: '11-105-0001-4-001',
    countryCode: 'SI',
    countryName: 'Slovenija',
    countryFlag: '🇸🇮',
    uicCountryCode: 79,
    operator: 'SŽ - Potniški promet',
    manufacturer: 'Stadler Rail (Siedlce / Bussnang)',
    propulsion: 'emu',
    propulsionLabel: '4-členska nizkopodna električna garnitura (3-sistemska)',
    powerKw: 1600,
    powerHp: 2180,
    maxSpeedKmh: 160,
    voltageSystems: ['3 kV DC', '15 kV 16.7 Hz AC', '25 kV 50 Hz AC'],
    voltageSummary: '3 kV DC (Slovenija) · 15 kV AC (Avstrija) · 25 kV AC (Hrvaška)',
    safetySystems: ['ETCS Baseline 3 Level 2', 'INDUSI I60R', 'PZB 90'],
    authorizedCountries: ['SI', 'AT', 'HR'],
    axleArrangement: "Bo'2'2'2'Bo'",
    weightTons: 135.0,
    lengthMeters: 80.70,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.sz],
    compositionLine: 'SŽ 510 »Stadler FLIRT« – 4-členska nizkopodna večsistemska električna garnitura (160 km/h, UIC 94 79 1 510 001-4 SI-SŽ)'
  },

  // 11. Stadler KISS EMU (SŽ 313)
  {
    id: 'sz_kiss_313',
    series: 'SŽ serija 313 (Stadler KISS 3 Double-decker)',
    name: 'SŽ 313 »Stadler KISS« (Dvonadstropna garnitura)',
    evn: '94 79 1 313 001-3 SI-SŽ',
    eratvCode: '11-105-0002-3-001',
    countryCode: 'SI',
    countryName: 'Slovenija',
    countryFlag: '🇸🇮',
    uicCountryCode: 79,
    operator: 'SŽ - Potniški promet',
    manufacturer: 'Stadler Rail (Bussnang, Švica)',
    propulsion: 'emu',
    propulsionLabel: '3-členska dvonadstropna električna garnitura',
    powerKw: 4000,
    powerHp: 5440,
    maxSpeedKmh: 160,
    voltageSystems: ['3 kV DC'],
    voltageSummary: '3 kV DC enosmerni sistem (Slovenske glavne proge)',
    safetySystems: ['ETCS Baseline 3 Level 2', 'INDUSI I60R'],
    authorizedCountries: ['SI'],
    axleArrangement: "Bo'Bo' + 2'2' + Bo'Bo'",
    weightTons: 215.0,
    lengthMeters: 79.84,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.sz],
    compositionLine: 'SŽ 313 »Stadler KISS« – 3-členska dvonadstropna električna garnitura (4.000 kW, 592 potnikov, UIC 94 79 1 313 001-3 SI-SŽ)'
  },

  // 12. ÖBB Desiro ML (4746 Cityjet)
  {
    id: 'obb_cityjet_4746',
    series: 'Siemens Desiro ML (ÖBB 4746 Cityjet)',
    name: 'ÖBB 4746 »Cityjet« (Siemens Desiro ML)',
    evn: '94 81 4746 052-1 A-ÖBB',
    eratvCode: '11-098-0001-3-001',
    countryCode: 'AT',
    countryName: 'Avstrija',
    countryFlag: '🇦🇹',
    uicCountryCode: 81,
    operator: 'ÖBB Personenverkehr AG',
    manufacturer: 'Siemens Mobility (Krefeld / Wien)',
    propulsion: 'emu',
    propulsionLabel: '3-členska regionalna električna garnitura (dvofrekvenčna)',
    powerKw: 2600,
    powerHp: 3540,
    maxSpeedKmh: 160,
    voltageSystems: ['15 kV 16.7 Hz AC', '25 kV 50 Hz AC'],
    voltageSummary: '15 kV 16.7 Hz AC (Avstrija/Nemčija) · 25 kV 50 Hz AC (Madžarska/Češka)',
    safetySystems: ['PZB 90', 'ETCS Baseline 3 Level 2'],
    authorizedCountries: ['AT', 'DE', 'HU', 'CZ'],
    axleArrangement: "Bo'2' + 2'2' + 2'Bo'",
    weightTons: 144.0,
    lengthMeters: 75.15,
    dataSources: [COMMON_DATA_SOURCES.era, COMMON_DATA_SOURCES.obb],
    compositionLine: 'ÖBB 4746 »Cityjet« – Siemens Desiro ML (2.600 kW, 160 km/h, UIC 94 81 4746 052-1 A-ÖBB, klimatski komfort)'
  }
];

// Populate compatibility aliases
EUROPEAN_LOCOMOTIVES.forEach(loco => {
  loco.maxSpeedKmH = loco.maxSpeedKmh;
  loco.countryApprovals = loco.authorizedCountries;
  loco.dataSources.forEach(ds => {
    ds.protocol = ds.apiProtocol;
  });
});

/**
 * Intelligent European Locomotive Resolver.
 * Maps any free-form locomotive string, operator name, train number, or corridor
 * to its exact, authoritative ERATV / EVR specification.
 */
export function getEnrichedLocomotiveData(
  locomotiveHint?: string,
  operatorHint?: string,
  trainNum?: string,
  cargoHint?: string
): EnrichedLocomotive {
  const locoStr = String(locomotiveHint || '').toLowerCase();
  const opStr = String(operatorHint || '').toLowerCase();
  const numStr = String(trainNum || '').toUpperCase();
  const cargoStr = String(cargoHint || '').toLowerCase();

  // 1. Specific GySEV Vectron
  if (
    locoStr.includes('gysev') ||
    opStr.includes('gysev') ||
    opStr.includes('raaberbahn') ||
    numStr.includes('43810') ||
    (locoStr.includes('vectron') && (opStr.includes('gysev') || locoStr.includes('193 (gysev)')))
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'gysev_vectron_193')!;
  }

  // 2. ČD Cargo Vectron 383
  if (
    locoStr.includes('čd') ||
    locoStr.includes('cd cargo') ||
    locoStr.includes('383') ||
    opStr.includes('čd') ||
    opStr.includes('cd cargo') ||
    numStr.includes('47201')
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'cd_vectron_383')!;
  }

  // 3. Adria Transport Taurus 1216
  if (
    locoStr.includes('adria transport') ||
    opStr.includes('adria transport') ||
    locoStr.includes('1216-920') ||
    numStr.includes('42312')
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'adria_transport_1216')!;
  }

  // 4. SŽ 664 Reagan (Heavy Diesel)
  if (
    locoStr.includes('664') ||
    locoStr.includes('reagan') ||
    numStr.includes('50640') ||
    cargoStr.includes('pesek') ||
    cargoStr.includes('kema')
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'sz_reagan_664')!;
  }

  // 5. SŽ 363 Brižita
  if (locoStr.includes('363') || locoStr.includes('brižita') || locoStr.includes('brizita')) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'sz_brizita_363')!;
  }

  // 6. ÖBB Vectron 1293
  if (
    locoStr.includes('1293') ||
    (locoStr.includes('vectron') && (opStr.includes('öbb') || opStr.includes('obb') || opStr.includes('rcg') || opStr.includes('rail cargo')))
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'obb_vectron_1293')!;
  }

  // 7. ÖBB Taurus 1216
  if (
    locoStr.includes('1216') ||
    locoStr.includes('1116') ||
    numStr.includes('48401') ||
    numStr.includes('48402') ||
    ((opStr.includes('öbb') || opStr.includes('obb') || opStr.includes('rcg') || opStr.includes('rail cargo')) && (locoStr.includes('taurus') || !locoStr.includes('desiro')))
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'obb_taurus_1216')!;
  }

  // 8. MÁV 480 Traxx
  if (
    locoStr.includes('traxx') ||
    locoStr.includes('480') ||
    opStr.includes('máv') ||
    opStr.includes('mav') ||
    opStr.includes('hungaria')
  ) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'mav_traxx_480')!;
  }

  // 9. Stadler KISS (SŽ 313)
  if (locoStr.includes('kiss') || locoStr.includes('313') || numStr.includes('313')) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'sz_kiss_313')!;
  }

  // 10. Stadler FLIRT (SŽ 510 / 610)
  if (locoStr.includes('flirt') || locoStr.includes('510') || locoStr.includes('610')) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'sz_flirt_510')!;
  }

  // 11. ÖBB Cityjet 4746
  if (locoStr.includes('4746') || locoStr.includes('cityjet') || (opStr.includes('öbb') && locoStr.includes('desiro'))) {
    return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'obb_cityjet_4746')!;
  }

  // 12. Generic SŽ Taurus 541 (Default Slovenian high-power flagship)
  return EUROPEAN_LOCOMOTIVES.find(l => l.id === 'sz_taurus_541')!;
}
