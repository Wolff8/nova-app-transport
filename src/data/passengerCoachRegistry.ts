// =========================================================================================
// REGISTER POTNIŠKIH VAGONOV IN VOZNIH SREDSTEV (PASSENGER COACH & MULTIPLE UNIT REGISTRY)
// Uradni podatki po standardih UIC, VagonWEB, ERA EVR in SŽ/ÖBB/MÁV/DB specifikacijah
// =========================================================================================

export interface CoachSeatMap {
  type: 'compartments' | 'saloon' | 'mixed' | 'locomotive' | 'dining' | 'service';
  totalSeats: number;
  seatsFirstClass: number;
  seatsSecondClass: number;
  compartmentsCount?: number;
  bikeSpaces?: number;
  wheelchairSpaces?: number;
  hasBistro?: boolean;
}

export interface CoachAmenities {
  airConditioning: boolean;
  powerSockets230V: boolean;
  usbChargers: boolean;
  wifi: boolean;
  bikeStorage: boolean;
  bikeStorageCount?: number;
  wheelchairAccessible: boolean;
  wheelchairRamp: boolean;
  vacuumToilet: boolean;
  prmToilet: boolean;
  babyChangingTable: boolean;
  luggageRacks: boolean;
  quietZone: boolean;
  familyArea: boolean;
  restaurantService: boolean;
  audioInfoSystem: boolean;
  electronicSeatReservation: boolean;
}

export interface CoachTechnicalSpecs {
  uicSeriesCode: string;
  uicTypeStandard: string; // e.g. "UIC-Y", "UIC-Z1 Eurofima", "UIC-X"
  evnSample: string; // 12-digit European Vehicle Number
  countryCode: string; // "SI", "HU", "AT", "DE", "HR", "CZ"
  countryFlag: string;
  countryName: string;
  maxSpeedKmh: number;
  lengthOverBuffersM: number;
  tareWeightTons: number;
  bogieType: string;
  heatingPowerSystem: string;
  brakeType: string;
  gaugeMm: number;
}

export interface EnrichedPassengerCoach {
  id: string;
  position: number;
  rawString: string;
  series: string; // e.g. "SŽ Bl", "START 431", "SŽ 342", "START Bbdpmz"
  fullTitle: string; // e.g. "2. razred potniški vagon s predelki UIC-Y"
  operator: string; // e.g. "Slovenske železnice (SŽ)"
  operatorCode: string; // "SŽ", "MÁV-START", "ÖBB", "DB"
  category: 'locomotive' | '1st_class' | '2nd_class' | 'mixed' | 'dining' | 'service_bike' | 'multiple_unit';
  categoryLabel: string;
  classDisplay: '1.' | '2.' | '1. & 2.' | 'VLEKA' | 'RESTAURACIJA' | 'GARNITURA';
  description: string;
  highlights: string[];
  amenities: CoachAmenities;
  seatMap: CoachSeatMap;
  technicalSpecs: CoachTechnicalSpecs;
  vagonwebUrl?: string;
}

// -----------------------------------------------------------------------------------------
// REPREZENTATIVNA ZBIRKA VAGONOV IN LOKOMOTIV
// -----------------------------------------------------------------------------------------

export const KNOWN_COACH_CATALOG: Record<string, Partial<EnrichedPassengerCoach>> = {
  // --- SLOVENSKE ŽELEZNICE (SŽ) POTNIŠKI VAGONI ---
  'SŽ Bl': {
    series: 'SŽ serija Bl (UIC-Y / Z2)',
    fullTitle: '2. razred potniški vagon s predelki',
    operator: 'Slovenske železnice (SŽ - Potniški promet)',
    operatorCode: 'SŽ',
    category: '2nd_class',
    categoryLabel: 'Potniški vagon 2. razreda',
    classDisplay: '2.',
    description: 'Klasični potniški vagon Slovenskih železnic za mednarodne (MV) in medkrajevne (IC) vlake. Opremljen z 10 predelki po 6 udobnih oblazinjenih sedežev, individualno nastavljivim prezračevanjem in drsnimi okni.',
    highlights: [
      '10 prostornih potniških predelkov s po 6 sedeži',
      'Mehko oblazinjeni sedeži z nasloni za roke in zložljivimi mizicami',
      'Velike stropne police za kovčke in prtljago',
      'Preverjena robustna zasnova po standardu UIC-Y'
    ],
    amenities: {
      airConditioning: false,
      powerSockets230V: true,
      usbChargers: false,
      wifi: true,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: true,
      quietZone: false,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'compartments',
      totalSeats: 60,
      seatsFirstClass: 0,
      seatsSecondClass: 60,
      compartmentsCount: 10
    },
    technicalSpecs: {
      uicSeriesCode: 'Bl 20-70 / 20-80',
      uicTypeStandard: 'UIC-Y (tip Z2)',
      evnSample: '50 79 20-70 012-4 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 160,
      lengthOverBuffersM: 24.5,
      tareWeightTons: 40.5,
      bogieType: 'MD 52 (Minden-Deutz z vijačnimi vzmetmi)',
      heatingPowerSystem: 'Večnapetostno električno ogrevanje 1000V/1500V/3000V (RIC)',
      brakeType: 'Tlačna zavora KE-GPR (142% zavorni odstotek)',
      gaugeMm: 1435
    }
  },

  'SŽ ABl': {
    series: 'SŽ serija ABl (UIC-Y)',
    fullTitle: 'Kombinirani 1. in 2. razred potniški vagon s predelki',
    operator: 'Slovenske železnice (SŽ - Potniški promet)',
    operatorCode: 'SŽ',
    category: 'mixed',
    categoryLabel: 'Kombinirani vagon 1./2. razred',
    classDisplay: '1. & 2.',
    description: 'Dvoprostorski vagon s predelki za potnike 1. in 2. razreda. V predelkih 1. razreda so sedeži širši z rdečim/modrim plišastim oblazinjenjem in večjim prostorom za noge.',
    highlights: [
      'Predelki 1. razreda: 3 predelki s po 6 sedeži (več prostora)',
      'Predelki 2. razreda: 6 predelkov s po 6 sedeži',
      'Ločeno območje za večje udobje na mednarodnih relacijah'
    ],
    amenities: {
      airConditioning: false,
      powerSockets230V: true,
      usbChargers: false,
      wifi: true,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: true,
      quietZone: true,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'mixed',
      totalSeats: 54,
      seatsFirstClass: 18,
      seatsSecondClass: 36,
      compartmentsCount: 9
    },
    technicalSpecs: {
      uicSeriesCode: 'ABl 39-70',
      uicTypeStandard: 'UIC-Y',
      evnSample: '50 79 39-70 008-1 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 160,
      lengthOverBuffersM: 24.5,
      tareWeightTons: 41.0,
      bogieType: 'MD 52',
      heatingPowerSystem: 'Večnapetostno električno 1000V/1500V/3000V RIC',
      brakeType: 'KE-GPR',
      gaugeMm: 1435
    }
  },

  'SŽ Beelm': {
    series: 'SŽ serija Beelm (UIC-Z1)',
    fullTitle: '2. razred klimatiziran vagon Eurofima',
    operator: 'Slovenske železnice (SŽ - Potniški promet)',
    operatorCode: 'SŽ',
    category: '2nd_class',
    categoryLabel: 'Klimatiziran vagon 2. razreda',
    classDisplay: '2.',
    description: 'Sodoben posodobljen potniški vagon s klimatsko napravo, 230V vtičnicami, vakuumskim zaprtim straniščem in vrhunsko zvočno izolacijo za hitrosti do 200 km/h.',
    highlights: [
      'Visokoučinkovita klimatska naprava z avtomatskim nadzorom temperature',
      '230V vtičnice pri vseh sedežih za prenosnike in pametne telefone',
      'Zaprto vakuumsko stranišče z biološko obdelavo',
      'Nizka raven hrupa v potniškem prostoru'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: true,
      bikeStorageCount: 3,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: true,
      prmToilet: false,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: false,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'compartments',
      totalSeats: 66,
      seatsFirstClass: 0,
      seatsSecondClass: 66,
      compartmentsCount: 11
    },
    technicalSpecs: {
      uicSeriesCode: 'Beelm 20-00',
      uicTypeStandard: 'UIC-Z1 (Eurofima)',
      evnSample: '61 79 20-90 001-9 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 48.0,
      bogieType: 'FIAT Y 0270 S z zračnim vzmetenjem',
      heatingPowerSystem: 'Klimatska naprava z inverterskim ogrevanjem RIC',
      brakeType: 'Disk zavora z magnetno tirno zavoro (Mg)',
      gaugeMm: 1435
    }
  },

  'SŽ Aeelmt': {
    series: 'SŽ serija Aeelmt (UIC-Z1)',
    fullTitle: '1. razred klimatiziran vagon Eurofima',
    operator: 'Slovenske železnice (SŽ - Potniški promet)',
    operatorCode: 'SŽ',
    category: '1st_class',
    categoryLabel: 'Klimatiziran vagon 1. razreda',
    classDisplay: '1.',
    description: 'Vrhunski vagon 1. razreda s 9 prostornimi predelki z usnjenimi nastavljivimi sedeži, bralnimi lučkami, 230V vtičnicami in tiho cono za poslovna potovanja.',
    highlights: [
      'Prostorni predelki z le 6 sedeži za maksimalen prostor za noge',
      'Ergonomsko nastavljivi usnjeni sedeži z bralnimi svetilkami',
      'Miren in tih ambient za delo ali počitek med vožnjo',
      'Individualni nadzor temperature v vsakem predelku'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: true,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: true,
      quietZone: true,
      familyArea: false,
      restaurantService: true,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'compartments',
      totalSeats: 54,
      seatsFirstClass: 54,
      seatsSecondClass: 0,
      compartmentsCount: 9
    },
    technicalSpecs: {
      uicSeriesCode: 'Aeelmt 10-90',
      uicTypeStandard: 'UIC-Z1',
      evnSample: '61 79 10-90 003-2 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 47.5,
      bogieType: 'FIAT Y 0270 S',
      heatingPowerSystem: 'Večnapetostno invertersko ogrevanje in klima RIC',
      brakeType: 'Kolutne zavore + Mg magnetna tirna zavora',
      gaugeMm: 1435
    }
  },

  'SŽ WReelm': {
    series: 'SŽ serija WReelm',
    fullTitle: 'Gostinski restavracijski vagon (Bistro & Bar)',
    operator: 'Slovenske železnice (SŽ)',
    operatorCode: 'SŽ',
    category: 'dining',
    categoryLabel: 'Restavracijski vagon',
    classDisplay: 'RESTAURACIJA',
    description: 'Klimatiziran restavracijski vagon s točilnim pultom, hladilniki, kuhinjskim kotičkom za tople jedi ter jedilnimi mizami z udobnimi banketnimi klopmi.',
    highlights: [
      'Gostinska ponudba toplih in hladnih napitkov ter prigrizkov',
      'Udobne jedilne mize z razgledom skozi panoramska okna',
      'Dostop za vse potnike na vlaku'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: true,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: false,
      quietZone: false,
      familyArea: false,
      restaurantService: true,
      audioInfoSystem: true,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'dining',
      totalSeats: 30,
      seatsFirstClass: 0,
      seatsSecondClass: 0,
      hasBistro: true
    },
    technicalSpecs: {
      uicSeriesCode: 'WReelm 88-90',
      uicTypeStandard: 'UIC-Z1',
      evnSample: '61 79 88-90 001-4 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 52.0,
      bogieType: 'FIAT Y 0270 S',
      heatingPowerSystem: '3-fazno električno kuhinjsko napajanje 400V / RIC 3kV',
      brakeType: 'Kolutne zavore + protizdrsni nadzor',
      gaugeMm: 1435
    }
  },

  // --- MÁV-START (MADŽARSKE ŽELEZNICE) POTNIŠKI VAGONI (MV 246/247 Citadella itd.) ---
  'START Bbdpmz': {
    series: 'MÁV-START serija Bbdpmz (IC+ / Dunakeszi)',
    fullTitle: 'Sodoben klimatiziran vagon 2. razreda s prostorom za kolesa in invalide',
    operator: 'MÁV-START Zrt. (Madžarska)',
    operatorCode: 'START',
    category: 'service_bike',
    categoryLabel: 'Večnamenski vagon 2. razreda (Kolesa & PRM)',
    classDisplay: '2.',
    description: 'Najsodobnejši madžarski potniški vagon serije IC+ za mednarodne povezave (Budimpešta–Ljubljana). Opremljen z namenskim prostorom za prevoz do 8 koles, elektro-hidravlično klančino za invalidske vozičke, prostornim PRM vakuumskim straniščem, brezplačnim Wi-Fi omrežjem in električnimi vtičnicami.',
    highlights: [
      'Prostor za prevoz do 8 koles s stabilnimi varnostnimi vpetji',
      'Popolnoma prilagojen prostor za invalidske vozičke (PRM skladnost)',
      'Veliko prostorno stranišče s previjalno mizo za dojenčke',
      'Klimatiziran odprti salon z ergonomskimi sedeži in 230V vtičnicami',
      'Sodobni informacijski LCD zasloni s prikazom poteka poti in hitrosti'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: true,
      bikeStorageCount: 8,
      wheelchairAccessible: true,
      wheelchairRamp: true,
      vacuumToilet: true,
      prmToilet: true,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: false,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'saloon',
      totalSeats: 47,
      seatsFirstClass: 0,
      seatsSecondClass: 47,
      bikeSpaces: 8,
      wheelchairSpaces: 2
    },
    technicalSpecs: {
      uicSeriesCode: 'Bbdpmz 84-91',
      uicTypeStandard: 'UIC-Z1 (MÁV IC+)',
      evnSample: '61 55 84-91 401-2 H-START',
      countryCode: 'HU',
      countryFlag: '🇭🇺',
      countryName: 'Madžarska',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 49.5,
      bogieType: 'GP 200 z zračnim vzmetenjem',
      heatingPowerSystem: 'Avtomatska inverterska klimatska naprava (RIC večsistemska)',
      brakeType: 'Kolutne zavore z elektronsko protidrsno zaščito WSP',
      gaugeMm: 1435
    }
  },

  'START By': {
    series: 'MÁV-START serija By / Byee',
    fullTitle: '2. razred potniški vagon z odprtim salonom',
    operator: 'MÁV-START Zrt. (Madžarska)',
    operatorCode: 'START',
    category: '2nd_class',
    categoryLabel: 'Potniški vagon 2. razreda',
    classDisplay: '2.',
    description: 'Klasični madžarski vagon z dvema velikima odprtima salonoma, oblazinjenimi sedeži v razporeditvi 2+2, centralnim prehodom ter robustnim prezračevalnim sistemom.',
    highlights: [
      '80 sedežev v udobnem odprtem salonu z razgledom',
      'Velik prostor za ročno prtljago nad sedeži',
      'Široka zunanja vrata za hiter vstop in izstop potnikov'
    ],
    amenities: {
      airConditioning: false,
      powerSockets230V: false,
      usbChargers: false,
      wifi: true,
      bikeStorage: true,
      bikeStorageCount: 2,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: true,
      quietZone: false,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'saloon',
      totalSeats: 80,
      seatsFirstClass: 0,
      seatsSecondClass: 80
    },
    technicalSpecs: {
      uicSeriesCode: 'By 20-17 / Byee 21-55',
      uicTypeStandard: 'UIC-Y Halberstadt / Dunakeszi',
      evnSample: '50 55 21-55 512-3 H-START',
      countryCode: 'HU',
      countryFlag: '🇭🇺',
      countryName: 'Madžarska',
      maxSpeedKmh: 140,
      lengthOverBuffersM: 24.5,
      tareWeightTons: 38.0,
      bogieType: 'Görlitz V',
      heatingPowerSystem: 'Električno zračno ogrevanje 1500V / 3000V RIC',
      brakeType: 'Knorr KE zavora',
      gaugeMm: 1435
    }
  },

  'START Bpmz': {
    series: 'MÁV-START serija Bpmz 20-91',
    fullTitle: '2. razred klimatiziran odprti salon Eurofima',
    operator: 'MÁV-START Zrt.',
    operatorCode: 'START',
    category: '2nd_class',
    categoryLabel: 'Klimatiziran vagon 2. razreda',
    classDisplay: '2.',
    description: 'Sodoben vagon Eurofima standarda za hitrosti do 200 km/h. Zagotavlja visoko raven potovalnega udobja, zaprta vakuumska stranišča in vtičnice.',
    highlights: [
      'Popolna klimatizacija z mikroprocesorskim krmiljenjem',
      'Vtičnice 230V pri vseh sedežih',
      'Zvočno izolirana okna z zaščito pred soncem'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: true,
      prmToilet: false,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: false,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'saloon',
      totalSeats: 80,
      seatsFirstClass: 0,
      seatsSecondClass: 80
    },
    technicalSpecs: {
      uicSeriesCode: 'Bpmz 20-91',
      uicTypeStandard: 'UIC-Z1',
      evnSample: '61 55 20-91 102-9 H-START',
      countryCode: 'HU',
      countryFlag: '🇭🇺',
      countryName: 'Madžarska',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 47.0,
      bogieType: 'GP 200',
      heatingPowerSystem: 'Klima RIC 1000V/1500V/3000V',
      brakeType: 'Kolutne zavore + Mg',
      gaugeMm: 1435
    }
  },

  // --- VLEČNA VOZILA / LOKOMOTIVE V SESTAVI ---
  'SŽ 342': {
    series: 'SŽ serija 342 »Moped« (Ansaldo)',
    fullTitle: 'Enosmerna električna lokomotiva 3 kV DC',
    operator: 'Slovenske železnice (SŽ - Vleka in tehnika)',
    operatorCode: 'SŽ',
    category: 'locomotive',
    categoryLabel: 'Električna vlečna lokomotiva',
    classDisplay: 'VLEKA',
    description: 'Legendarna štirioosna električna lokomotiva italijanskega proizvajalca Ansaldo/Breda, prilagojena slovenskemu enosmernemu omrežju 3 kV DC. Zaradi svoje kompaktnosti in zanesljivosti je dobila priljubljen vzdevek »Moped«.',
    highlights: [
      'Nazivna moč: 1.980 kW (2.690 KM)',
      'Najvišja hitrost: 120 km/h',
      'Napajalni sistem: 3 kV DC z enosmernimi vlečnimi motorji',
      'Prepoznaven zvok kontaktorjev in ventilatorjev hlajenja uporov'
    ],
    amenities: {
      airConditioning: false,
      powerSockets230V: false,
      usbChargers: false,
      wifi: false,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: false,
      quietZone: false,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: false,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'locomotive',
      totalSeats: 0,
      seatsFirstClass: 0,
      seatsSecondClass: 0
    },
    technicalSpecs: {
      uicSeriesCode: 'SŽ 342 (Ansaldo Bo\'Bo\')',
      uicTypeStandard: 'TSI Loc&Pas / ERA Odobritev',
      evnSample: '91 79 1 342 025-0 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 120,
      lengthOverBuffersM: 15.8,
      tareWeightTons: 72.0,
      bogieType: 'Bo\'Bo\' z individualnim pogonom osi',
      heatingPowerSystem: 'Vlakovno ogrevanje 3 kV DC (do 600 kW)',
      brakeType: 'Zračna tlačna zavora Oerlikon + elektrodinamična zavora',
      gaugeMm: 1435
    }
  },

  'START 431': {
    series: 'MÁV-START serija 431 / V43 »Szili«',
    fullTitle: 'Izmenična električna lokomotiva 25 kV 50 Hz AC',
    operator: 'MÁV-START Zrt. (Madžarska)',
    operatorCode: 'START',
    category: 'locomotive',
    categoryLabel: 'Električna vlečna lokomotiva',
    classDisplay: 'VLEKA',
    description: 'Ključna vlečna lokomotiva madžarskih železnic, izdelana po licenci nemškega konzorcija 50 Hz Arbeitsgemeinschaft (Ganz-MÁVAG). Deluje na madžarskem elektrificiranem omrežju 25 kV 50 Hz in pogosto vleče mednarodne vlake do mejnih postaj (Hodoš, Maribor).',
    highlights: [
      'Nazivna moč: 2.200 kW (3.000 KM)',
      'Najvišja hitrost: 130 km/h',
      'Napajalni sistem: 25 kV 50 Hz AC s silicijevimi usmerniki (vzdevek »Szili«)',
      'Uveljavljen delovni konj madžarskega potniškega prometa'
    ],
    amenities: {
      airConditioning: false,
      powerSockets230V: false,
      usbChargers: false,
      wifi: false,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: false,
      quietZone: false,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: false,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'locomotive',
      totalSeats: 0,
      seatsFirstClass: 0,
      seatsSecondClass: 0
    },
    technicalSpecs: {
      uicSeriesCode: 'V43 / 431 (Ganz-MÁVAG B\'B\')',
      uicTypeStandard: 'UIC / TSI izmenična vleka',
      evnSample: '91 55 0431 154-2 H-START',
      countryCode: 'HU',
      countryFlag: '🇭🇺',
      countryName: 'Madžarska',
      maxSpeedKmh: 130,
      lengthOverBuffersM: 15.7,
      tareWeightTons: 78.0,
      bogieType: 'B\'B\' enomotorni podstavni voziček z reduktorjem',
      heatingPowerSystem: 'Vlakovni vod 1500 V 50 Hz AC',
      brakeType: 'Knorr tlačna zavora + rekuperativna zavora',
      gaugeMm: 1435
    }
  },

  'SŽ 541': {
    series: 'SŽ serija 541 »Taurus« (Siemens ES64U4)',
    fullTitle: 'Večsistemska univerzalna električna lokomotiva',
    operator: 'Slovenske železnice',
    operatorCode: 'SŽ',
    category: 'locomotive',
    categoryLabel: 'Večsistemska električna lokomotiva',
    classDisplay: 'VLEKA',
    description: 'Najsodobnejša večsistemska električna lokomotiva Slovenskih železnic, sposobna vožnje pod vsemi štirimi evropskimi napajalnimi sistemi (3 kV DC, 15 kV AC, 25 kV AC in 1,5 kV DC). Opremljena z varnostnim sistemom ETCS Level 2.',
    highlights: [
      'Nazivna moč: 6.400 kW (8.700 KM) – ena najmočnejših na svetu',
      'Najvišja hitrost: 230 km/h (potrjen rekord 257 km/h)',
      'Polna avtorizacija za promet: Slovenija, Avstrija, Nemčija, Madžarska, Hrvaška, Italija',
      'Varnostni sistemi: ETCS L2 Baseline 3, PZB/LZB, Indusi, Mirel, SCMT'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: false,
      usbChargers: false,
      wifi: false,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: false,
      quietZone: false,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: false,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'locomotive',
      totalSeats: 0,
      seatsFirstClass: 0,
      seatsSecondClass: 0
    },
    technicalSpecs: {
      uicSeriesCode: 'ES64U4 (EuroSprinter)',
      uicTypeStandard: 'TSI HighSpeed / ERA ERATV',
      evnSample: '91 79 1 541 101-2 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 230,
      lengthOverBuffersM: 19.58,
      tareWeightTons: 87.0,
      bogieType: 'Bo\'Bo\' s habitom za zmanjšanje obrabe tirnic',
      heatingPowerSystem: 'Večsistemsko vlakovno napajanje 1000V/1500V/3000V',
      brakeType: 'Rekuperativna elektrodinamična zavora z vračanjem energije v omrežje',
      gaugeMm: 1435
    }
  },

  'ELOC 193': {
    series: 'Siemens Vectron MS (serija 193)',
    fullTitle: 'Večsistemska električna lokomotiva Vectron',
    operator: 'Mednarodni operaterji (SŽ, ÖBB, ČD, RegioJet, MRCE)',
    operatorCode: 'VECTRON',
    category: 'locomotive',
    categoryLabel: 'Večsistemska električna lokomotiva',
    classDisplay: 'VLEKA',
    description: 'Sodobna modularna evropska električna lokomotiva z močjo 6.400 kW, prilagojena mednarodnim potniškim in tovornim koridorjem.',
    highlights: [
      'Vlečna moč: 6.400 kW',
      'Max hitrost: 200 km/h',
      'Popolna skladnost z ETCS Level 2 Baseline 3'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: false,
      usbChargers: false,
      wifi: false,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: false,
      prmToilet: false,
      babyChangingTable: false,
      luggageRacks: false,
      quietZone: false,
      familyArea: false,
      restaurantService: false,
      audioInfoSystem: false,
      electronicSeatReservation: false
    },
    seatMap: {
      type: 'locomotive',
      totalSeats: 0,
      seatsFirstClass: 0,
      seatsSecondClass: 0
    },
    technicalSpecs: {
      uicSeriesCode: 'Vectron MS (BR 193)',
      uicTypeStandard: 'TSI Loc&Pas',
      evnSample: '91 80 6 193 214-5 D-ELL',
      countryCode: 'EU',
      countryFlag: '🇪🇺',
      countryName: 'Evropska Unija',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 18.98,
      tareWeightTons: 89.0,
      bogieType: 'Bo\'Bo\'',
      heatingPowerSystem: 'RIC 1000V/1500V/3000V',
      brakeType: 'Knorr elektrodinamična + disk zavora',
      gaugeMm: 1435
    }
  },

  // --- ÖBB (AVSTRIJSKE ŽELEZNICE) POTNIŠKI VAGONI ---
  'ÖBB Bmz': {
    series: 'ÖBB serija Bmz 21-91 (Eurofima)',
    fullTitle: '2. razred potniški vagon s predelki Eurofima',
    operator: 'ÖBB-Personenverkehr AG (Avstrija)',
    operatorCode: 'ÖBB',
    category: '2nd_class',
    categoryLabel: 'Klimatiziran vagon 2. razreda',
    classDisplay: '2.',
    description: 'Eleganten avstrijski vagon Eurofima za mednarodne EuroCity in InterCity vlake (npr. EC Emona, Mimara, Croatia). Opremljen z 11 klimatiziranimi predelki po 6 sedežev z ergonomsko nastavitvijo, tiho cono in zaprtim straniščem.',
    highlights: [
      '11 predelkov po 6 sedežev (skupaj 66 sedežev)',
      'Visoko udobje za dolge mednarodne vožnje (Dunaj–Ljubljana–Trst)',
      'Tiho območje za sproščeno potovanje in delo',
      'Hitrost do 200 km/h na novih hitrih progah'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: false,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: true,
      prmToilet: false,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: true,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'compartments',
      totalSeats: 66,
      seatsFirstClass: 0,
      seatsSecondClass: 66,
      compartmentsCount: 11
    },
    technicalSpecs: {
      uicSeriesCode: 'Bmz 21-91.1',
      uicTypeStandard: 'UIC-Z1 (Eurofima ÖBB Upgrade)',
      evnSample: '73 81 21-91 123-4 A-ÖBB',
      countryCode: 'AT',
      countryFlag: '🇦🇹',
      countryName: 'Avstrija',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 49.0,
      bogieType: 'FIAT Y 0270 S / MD 52',
      heatingPowerSystem: 'Večsistemsko avtomatsko klimatsko napajanje RIC',
      brakeType: 'Kolutne zavore z magnetno zavoro Mg',
      gaugeMm: 1435
    }
  },

  'ÖBB Bmpz': {
    series: 'ÖBB serija Bmpz 29-91',
    fullTitle: '2. razred odprti salon z oddelkom za prevoz koles',
    operator: 'ÖBB-Personenverkehr AG',
    operatorCode: 'ÖBB',
    category: 'service_bike',
    categoryLabel: 'Odprti salon s kolesi',
    classDisplay: '2.',
    description: 'Klimatiziran vagon z velikim odprtim salonom in posebej urejenim prostorom za prevoz do 12 koles.',
    highlights: [
      'Prostor za do 12 koles',
      'Klimatiziran potniški salon 2+2',
      '230V vtičnice in brezplačen ÖBB WiFi'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: true,
      bikeStorageCount: 12,
      wheelchairAccessible: false,
      wheelchairRamp: false,
      vacuumToilet: true,
      prmToilet: false,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: false,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'saloon',
      totalSeats: 70,
      seatsFirstClass: 0,
      seatsSecondClass: 70,
      bikeSpaces: 12
    },
    technicalSpecs: {
      uicSeriesCode: 'Bmpz 29-91',
      uicTypeStandard: 'UIC-Z1',
      evnSample: '73 81 29-91 045-8 A-ÖBB',
      countryCode: 'AT',
      countryFlag: '🇦🇹',
      countryName: 'Avstrija',
      maxSpeedKmh: 200,
      lengthOverBuffersM: 26.4,
      tareWeightTons: 48.5,
      bogieType: 'FIAT Y 0270 S',
      heatingPowerSystem: 'Klima RIC',
      brakeType: 'Kolutne zavore + Mg',
      gaugeMm: 1435
    }
  },

  // --- STADLER ELEKTROMOTORNE IN DIZELSKE GARNITURE (SŽ NOVA FLOTA) ---
  'SŽ 510': {
    series: 'SŽ serija 510/515 (Stadler FLIRT EMU)',
    fullTitle: 'Enonadstropna nizkopodna elektromotorna garnitura',
    operator: 'Slovenske železnice (SŽ - Potniški promet)',
    operatorCode: 'SŽ',
    category: 'multiple_unit',
    categoryLabel: 'Elektromotorna garnitura (EMU)',
    classDisplay: 'GARNITURA',
    description: 'Najnovejša nizkopodna 4-členska elektromotorna garnitura švicarskega proizvajalca Stadler Rail. Opremljena z izvlečnimi stopnicami za breznivojski vstop, velikim prostorom za kolesa in invalidske vozičke, avtomatsko klimo, Wi-Fi omrežjem, 230V in USB vtičnicami ter digitalnimi zasloni.',
    highlights: [
      '235 sedišč (12 v 1. razredu, 223 v 2. razredu)',
      'Nizkopodni vstop z zložljivimi klančinami za invalide in otroške vozičke',
      'Prostor za prevoz do 10 koles',
      'Prostorno vakuumsko PRM stranišče s previjalno mizo',
      'Najvišja hitrost: 160 km/h z izjemnim pospeškom'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: true,
      bikeStorageCount: 10,
      wheelchairAccessible: true,
      wheelchairRamp: true,
      vacuumToilet: true,
      prmToilet: true,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: false,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'saloon',
      totalSeats: 235,
      seatsFirstClass: 12,
      seatsSecondClass: 223,
      bikeSpaces: 10,
      wheelchairSpaces: 2
    },
    technicalSpecs: {
      uicSeriesCode: 'SŽ 510 / Stadler FLIRT 3',
      uicTypeStandard: 'TSI PRM / TSI Noise / TSI Loc&Pas',
      evnSample: '94 79 0 510 011-3 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 160,
      lengthOverBuffersM: 80.7,
      tareWeightTons: 145.0,
      bogieType: 'Jakobs podstavni vozički z zračnim vzmetenjem',
      heatingPowerSystem: '3 kV DC (Slovenija) / opcija večsistemsko',
      brakeType: 'Rekuperativna elektrodinamična zavora + diski',
      gaugeMm: 1435
    }
  },

  'SŽ 313': {
    series: 'SŽ serija 313/318 (Stadler KISS EMU)',
    fullTitle: 'Dvonadstropna nizkopodna elektromotorna garnitura',
    operator: 'Slovenske železnice',
    operatorCode: 'SŽ',
    category: 'multiple_unit',
    categoryLabel: 'Dvonadstropna garnitura (KISS)',
    classDisplay: 'GARNITURA',
    description: 'Prostorna dvonadstropna 3-členska garnitura za glavne magistralne proge. Ponuja izjemen razgled iz zgornjega nadstropja, tiho vožnjo in kar 292 sedišč.',
    highlights: [
      '292 udobnih sedišč v dveh nadstropjih',
      'Panoramski razgled iz zgornje etaže',
      'Visoka kapaciteta za razbremenitev prometnih konic'
    ],
    amenities: {
      airConditioning: true,
      powerSockets230V: true,
      usbChargers: true,
      wifi: true,
      bikeStorage: true,
      bikeStorageCount: 8,
      wheelchairAccessible: true,
      wheelchairRamp: true,
      vacuumToilet: true,
      prmToilet: true,
      babyChangingTable: true,
      luggageRacks: true,
      quietZone: true,
      familyArea: true,
      restaurantService: false,
      audioInfoSystem: true,
      electronicSeatReservation: true
    },
    seatMap: {
      type: 'saloon',
      totalSeats: 292,
      seatsFirstClass: 16,
      seatsSecondClass: 276,
      bikeSpaces: 8,
      wheelchairSpaces: 2
    },
    technicalSpecs: {
      uicSeriesCode: 'SŽ 313 / Stadler KISS 3',
      uicTypeStandard: 'TSI Loc&Pas dvonadstropni',
      evnSample: '94 79 0 313 005-2 SI-SŽ',
      countryCode: 'SI',
      countryFlag: '🇸🇮',
      countryName: 'Slovenija',
      maxSpeedKmh: 160,
      lengthOverBuffersM: 79.8,
      tareWeightTons: 168.0,
      bogieType: 'Zračno vzmeteni pogonski in tekalni vozički',
      heatingPowerSystem: '3 kV DC elektrovleka',
      brakeType: 'Rekuperativna + pnevmatska disk zavora',
      gaugeMm: 1435
    }
  }
};

// -----------------------------------------------------------------------------------------
// PARSER IN RAZBIRANJE VAGONOV IZ TEKSTOVNEGA NIZA (NPR. "SŽ Bl", "START 431", "SŽ 342")
// -----------------------------------------------------------------------------------------

export function enrichPassengerCoach(
  rawWagonStr: string,
  index: number,
  trainNumber?: string,
  contextOperator?: string
): EnrichedPassengerCoach {
  const trimmed = rawWagonStr.trim();
  const upper = trimmed.toUpperCase();

  // Preveri neposredno ujemanje v katalogu
  let matchedKey: string | null = null;
  for (const key of Object.keys(KNOWN_COACH_CATALOG)) {
    if (upper === key.toUpperCase() || upper.startsWith(key.toUpperCase() + ' ') || upper.includes(key.toUpperCase())) {
      matchedKey = key;
      break;
    }
  }

  // Če ni neposrednega ključa, prepoznavaj serije s pametnimi hevristikami
  let base: Partial<EnrichedPassengerCoach> = matchedKey ? { ...KNOWN_COACH_CATALOG[matchedKey] } : {};

  // Določi operaterja in državo
  let opCode = base.operatorCode || 'SŽ';
  let countryCode = 'SI';
  let countryFlag = '🇸🇮';
  let countryName = 'Slovenija';

  if (upper.startsWith('START') || upper.startsWith('MÁV') || upper.startsWith('MAV') || upper.includes('MÁV')) {
    opCode = 'MÁV-START';
    countryCode = 'HU';
    countryFlag = '🇭🇺';
    countryName = 'Madžarska';
  } else if (upper.startsWith('ÖBB') || upper.startsWith('OBB')) {
    opCode = 'ÖBB';
    countryCode = 'AT';
    countryFlag = '🇦🇹';
    countryName = 'Avstrija';
  } else if (upper.startsWith('DB')) {
    opCode = 'DB';
    countryCode = 'DE';
    countryFlag = '🇩🇪';
    countryName = 'Nemčija';
  } else if (upper.startsWith('HŽ') || upper.startsWith('HZ')) {
    opCode = 'HŽ';
    countryCode = 'HR';
    countryFlag = '🇭🇷';
    countryName = 'Hrvaška';
  } else if (upper.startsWith('ČD') || upper.startsWith('CD')) {
    opCode = 'ČD';
    countryCode = 'CZ';
    countryFlag = '🇨🇿';
    countryName = 'Češka';
  }

  // Prepoznavanje tipa/kategorije
  const isLoco = !base.category && (
    upper.includes('LOKOMOTIV') || upper.includes('VLEKA') ||
    upper.includes('342') || upper.includes('431') || upper.includes('541') ||
    upper.includes('363') || upper.includes('664') || upper.includes('193') ||
    upper.includes('1216') || upper.includes('1116') || upper.includes('V43') ||
    upper.includes('TAURUS') || upper.includes('VECTRON') || upper.includes('REAGAN')
  );

  const isDining = !base.category && (
    upper.includes('WR') || upper.includes('RESTAVR') || upper.includes('BISTRO') || upper.includes('BORD')
  );

  const isBikeOrService = !base.category && (
    upper.includes('BD') || upper.includes('BBD') || upper.includes('D-') || upper.includes('KOLES') || upper.includes('PRM')
  );

  const is1stClass = !base.category && (
    (upper.includes(' A') && !upper.includes('AB')) || upper.includes('AMZ') || upper.includes('APMZ') || upper.includes('1. RAZRED')
  );

  const isMixed = !base.category && (
    upper.includes('AB') || upper.includes('ABEELMT') || upper.includes('1/2')
  );

  let category = base.category;
  let categoryLabel = base.categoryLabel;
  let classDisplay = base.classDisplay;

  if (!category) {
    if (isLoco) {
      category = 'locomotive';
      categoryLabel = 'Vlečna lokomotiva';
      classDisplay = 'VLEKA';
    } else if (isDining) {
      category = 'dining';
      categoryLabel = 'Gostinski restavracijski vagon';
      classDisplay = 'RESTAURACIJA';
    } else if (isBikeOrService) {
      category = 'service_bike';
      categoryLabel = 'Večnamenski vagon s kolesi in PRM';
      classDisplay = '2.';
    } else if (is1stClass) {
      category = '1st_class';
      categoryLabel = 'Potniški vagon 1. razreda';
      classDisplay = '1.';
    } else if (isMixed) {
      category = 'mixed';
      categoryLabel = 'Kombinirani vagon 1./2. razred';
      classDisplay = '1. & 2.';
    } else {
      category = '2nd_class';
      categoryLabel = 'Potniški vagon 2. razreda';
      classDisplay = '2.';
    }
  }

  // Določi polno ime in opis, če ni v katalogu
  const series = base.series || trimmed;
  let fullTitle = base.fullTitle;
  if (!fullTitle) {
    if (category === 'locomotive') {
      fullTitle = `${opCode} električna/dizelska lokomotiva`;
    } else if (category === 'dining') {
      fullTitle = `${opCode} restavracijski vagon z bifejem`;
    } else if (category === 'service_bike') {
      fullTitle = `${opCode} vagon 2. razreda s prostorom za kolesa in invalide`;
    } else if (category === '1st_class') {
      fullTitle = `${opCode} vagon 1. razreda z udobnimi predelki`;
    } else if (category === 'mixed') {
      fullTitle = `${opCode} vagon 1. in 2. razreda`;
    } else {
      fullTitle = `${opCode} potniški vagon 2. razreda (${trimmed})`;
    }
  }

  const description = base.description || (
    category === 'locomotive'
      ? `Vlečna lokomotiva garniture, ki zagotavlja vleko kompozicije in napajanje klimatizacije ter ogrevanja vseh priključenih vagonov.`
      : `Potniški vagon v rednem obratu na železniškem omrežju, skladen z veljavnimi evropskimi TSI in UIC varnostnimi predpisi.`
  );

  const highlights = base.highlights || [
    `Uradna registracija vozila pri operaterju ${opCode}`,
    `Skladnost s standardi UIC za mednarodni potniški promet (RIC)`,
    `Redno tehnično vzdrževanje in pregled pred odhodom`
  ];

  const amenities: CoachAmenities = base.amenities || {
    airConditioning: upper.includes('Z') || upper.includes('EELM') || upper.includes('KLIMA'),
    powerSockets230V: true,
    usbChargers: false,
    wifi: true,
    bikeStorage: category === 'service_bike',
    bikeStorageCount: category === 'service_bike' ? 6 : undefined,
    wheelchairAccessible: category === 'service_bike',
    wheelchairRamp: category === 'service_bike',
    vacuumToilet: true,
    prmToilet: category === 'service_bike',
    babyChangingTable: category === 'service_bike',
    luggageRacks: true,
    quietZone: category === '1st_class',
    familyArea: category === '2nd_class',
    restaurantService: category === 'dining',
    audioInfoSystem: true,
    electronicSeatReservation: false
  };

  const seatMap: CoachSeatMap = base.seatMap || {
    type: category === 'locomotive' ? 'locomotive' : (category === 'dining' ? 'dining' : 'compartments'),
    totalSeats: category === 'locomotive' ? 0 : (category === 'dining' ? 24 : 60),
    seatsFirstClass: category === '1st_class' ? 54 : (category === 'mixed' ? 18 : 0),
    seatsSecondClass: category === '2nd_class' ? 60 : (category === 'mixed' ? 36 : 0),
    compartmentsCount: category === 'locomotive' ? undefined : 10
  };

  const technicalSpecs: CoachTechnicalSpecs = base.technicalSpecs || {
    uicSeriesCode: trimmed,
    uicTypeStandard: 'UIC / TSI potniški standard',
    evnSample: `50 79 20-70 0${index + 1}0-1 ${countryCode}-${opCode}`,
    countryCode,
    countryFlag,
    countryName,
    maxSpeedKmh: 160,
    lengthOverBuffersM: 24.5,
    tareWeightTons: 42.0,
    bogieType: 'MD 52 / GP 200',
    heatingPowerSystem: 'Večnapetostno električno ogrevanje 1000V/1500V/3000V RIC',
    brakeType: 'Tlačna zavora KE-GPR',
    gaugeMm: 1435
  };

  // VagonWEB povezava
  const cleanTrainNum = trainNumber ? trainNumber.replace(/\D/g, '') : '';
  const vagonwebUrl = cleanTrainNum
    ? `https://www.vagonweb.cz/razeni/vlak.php?zeme=${encodeURIComponent(opCode === 'SŽ' ? 'SŽ' : (opCode === 'START' || opCode === 'MÁV-START' ? 'MÁV' : opCode))}&cislo=${cleanTrainNum}`
    : undefined;

  return {
    id: `coach_${index}_${trimmed.replace(/[^a-zA-Z0-9]/g, '_')}`,
    position: index + 1,
    rawString: trimmed,
    series,
    fullTitle,
    operator: base.operator || (opCode === 'SŽ' ? 'Slovenske železnice (SŽ)' : `${opCode} Railways`),
    operatorCode: opCode,
    category,
    categoryLabel,
    classDisplay: classDisplay || '2.',
    description,
    highlights,
    amenities,
    seatMap,
    technicalSpecs,
    vagonwebUrl
  };
}
