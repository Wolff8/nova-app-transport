// Comprehensive European Rail Freight Corridors (RFC), Intermodal Geometries, and Cross-Border Timetable Slots
// Supporting TEN-T RFC 1, RFC 3, RFC 5, RFC 6, RFC 10 and Slovenian / European Rail Transit

export interface EuropeanFreightSlot {
  id: string;
  trainNumber: string;
  name: string;
  routeGeometry: [number, number][];
  routeKm: number;
  fromName: string;
  toName: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  depTime: string;
  arrTime: string;
  operator: string;
  locomotive: string;
  wagonType: string;
  cargo: string;
  grossWeightTons: number;
  lengthM: number;
  speedRange: [number, number];
  axleLoadClass: string;
  brakePercentage: string;
  trucksEquivalent: number;
  co2SavedKg: number;
  ridHazard: string | null;
  corridor: string;
  corridorId: string;
  isTransit: boolean;
  countryFrom: string;
  countryTo: string;
  checkpoints: { km: number; name: string }[];
}

// 1. Precise European corridor track polyline segments (Lon, Lat)
export const GEO_SPILJE_GRAZ_WIEN: [number, number][] = [
  [15.6321, 46.7032], // Spielfeld-Straß (meja SI/AT)
  [15.5423, 46.7812], // Leibnitz
  [15.5132, 46.8894], // Wildon
  [15.4214, 47.0521], // Graz Don Bosco / Graz Süd CFF
  [15.4168, 47.0722], // Graz Hauptbahnhof
  [15.3421, 47.2084], // Peggau-Deutschfeistritz
  [15.2712, 47.4123], // Bruck an der Mur
  [15.2921, 47.4452], // Kapfenberg
  [15.6724, 47.6071], // Mürzzuschlag
  [15.8312, 47.6432], // Semmering (Glavni alpski prelaz)
  [15.9421, 47.6742], // Gloggnitz
  [16.2341, 47.8112], // Wiener Neustadt Hbf
  [16.2352, 48.0084], // Baden bei Wien
  [16.3421, 48.1421], // Wien Inzersdorf Terminal
  [16.4824, 48.1685]  // Wien Freudenau Hafen (Donavsko pristanišče & CFF)
];

export const GEO_SPILJE_LINZ_VOEST: [number, number][] = [
  [15.6321, 46.7032], // Spielfeld
  [15.4168, 47.0722], // Graz Hbf
  [15.2712, 47.4123], // Bruck an der Mur
  [15.0952, 47.3821], // Leoben Hbf
  [15.0214, 47.3421], // St. Michael in Obersteiermark
  [14.3124, 47.5512], // Selzthal
  [14.1221, 47.9052], // Kirchdorf an der Krems
  [14.2912, 48.2902], // Linz Hbf
  [14.3312, 48.2721]  // Linz Voestalpine (Železarna & jeklarski industrijski tir)
];

export const GEO_HODOS_BUDAPEST_BILK: [number, number][] = [
  [16.3262, 46.9054], // Hodoš (meja SI/HU)
  [16.4172, 46.8402], // Őriszentpéter
  [16.5921, 46.8482], // Zalalövő
  [16.8482, 46.8402], // Zalaegerszeg
  [17.1512, 47.1612], // Boba
  [17.1482, 47.2582], // Celldömölk
  [17.6352, 47.6832], // Győr
  [18.1214, 47.7421], // Komárom
  [18.3982, 47.5852], // Tatabánya
  [18.6321, 47.4912], // Bicske
  [18.8214, 47.4721], // Biatorbágy
  [19.0205, 47.4644], // Budapest-Kelenföld
  [19.1124, 47.4212]  // Budapest BILK Kombiterminal (Največji kontejnerski hub v regiji)
];

export const GEO_JESENICE_VILLACH_SALZBURG_MUNICH: [number, number][] = [
  [14.0539, 46.4363], // Jesenice (Karavanški predor meja SI/AT)
  [14.0292, 46.5292], // Rosenbach
  [13.9142, 46.5772], // Faak am See
  [13.8421, 46.5782], // Villach Süd CFF (Velika ranžirna postaja)
  [13.8543, 46.6182], // Villach Hbf
  [13.4952, 46.7921], // Spittal-Millstättersee
  [13.1812, 46.9852], // Mallnitz-Obervellach (Tauern predor)
  [13.1352, 47.1124], // Bad Gastein
  [13.1521, 47.3212], // Schwarzach-St. Veit
  [13.2182, 47.4121], // Bischofshofen
  [13.0952, 47.6821], // Hallein
  [13.0452, 47.8132], // Salzburg Hbf
  [12.9721, 47.8382], // Freilassing (meja AT/DE)
  [12.6452, 47.8682], // Traunstein
  [12.1282, 47.8542], // Rosenheim
  [11.9652, 48.0482], // Grafing Bahnhof
  [11.6921, 48.1482]  // München Riem Umschlagbahnhof (Glavni bavarski intermodalni terminal)
];

export const GEO_DOBOVA_ZAGREB_BELGRADE: [number, number][] = [
  [15.6580, 45.8980], // Dobova (meja SI/HR)
  [15.7312, 45.8654], // Savski Marof
  [15.8082, 45.8592], // Zaprešić
  [15.9782, 45.8052], // Zagreb Glavni kolodvor
  [16.0124, 45.7621], // Zagreb Ranžirni kolodvor (HŽ Cargo Hub)
  [16.2382, 45.8082], // Dugo Selo
  [16.3952, 45.7112], // Ivanić-Grad
  [16.7812, 45.4821], // Kutina
  [16.9821, 45.3412], // Novska
  [17.3821, 45.2582], // Nova Gradiška
  [18.0124, 45.1612], // Slavonski Brod
  [18.8052, 45.2912], // Vinkovci
  [19.1521, 45.1682], // Tovarnik (meja HR/RS)
  [19.2282, 45.1282], // Šid
  [19.6124, 44.9782], // Sremska Mitrovica
  [19.8214, 45.0082], // Ruma
  [20.3721, 44.7312]  // Beograd Ranžirna Makiš
];

export const GEO_OPICINA_TRIESTE_VENICE_VERONA_MILAN: [number, number][] = [
  [13.7880, 45.6880], // Villa Opicina (meja SI/IT)
  [13.7712, 45.6572], // Trieste Campo Marzio (Tržaško pristanišče)
  [13.5352, 45.8062], // Monfalcone
  [13.3362, 45.8202], // Cervignano del Friuli
  [12.8382, 45.7721], // Portogruaro
  [12.5621, 45.6312], // San Donà di Piave
  [12.2312, 45.4821], // Venezia Mestre
  [11.8812, 45.4182], // Padova Interporto
  [11.5421, 45.5421], // Vicenza
  [10.9214, 45.4182], // Verona Quadrante Europa (Vodilni italijanski freight hub)
  [10.2124, 45.5352], // Brescia
  [9.5921, 45.5212],  // Treviglio
  [9.2782, 45.4682]   // Milano Smistamento (Največja ranžirna postaja v Lombardiji)
];

export const GEO_VERONA_BRENNER_MUNICH: [number, number][] = [
  [10.9214, 45.4182], // Verona Quadrante Europa
  [11.0352, 45.8912], // Rovereto
  [11.1214, 46.0721], // Trento
  [11.3521, 46.4952], // Bolzano / Bozen
  [11.6521, 46.7121], // Bressanone / Brixen
  [11.6124, 46.7952], // Fortezza / Franzensfeste
  [11.5052, 47.0052], // Brennero / Brenner (meja IT/AT, 1371m n.v.)
  [11.4012, 47.2621], // Innsbruck Hbf
  [11.7721, 47.3912], // Jenbach
  [12.0621, 47.4882], // Wörgl Hbf (Ro-La terminal)
  [12.1721, 47.5852], // Kufstein (meja AT/DE)
  [12.1282, 47.8542], // Rosenheim
  [11.6921, 48.1482]  // München Riem
];

export const GEO_ROTTERDAM_DUISBURG_BASEL_MILAN: [number, number][] = [
  [4.4321, 51.8852],  // Rotterdam Waalhaven (Havenbedrijf Rotterdam)
  [5.8982, 51.9852],  // Arnhem (Betuweroute)
  [6.2421, 51.8321],  // Emmerich (meja NL/DE)
  [6.7621, 51.4352],  // Duisburg DIT (Duisburg Intermodal Terminal - Rhein Hub)
  [6.9214, 50.9124],  // Köln Eifeltor
  [7.5882, 50.3552],  // Koblenz
  [8.4821, 49.4882],  // Mannheim Rbf
  [8.4012, 49.0012],  // Karlsruhe Hbf
  [7.8421, 47.9952],  // Freiburg im Breisgau
  [7.6182, 47.5382],  // Basel Wolf (Švicarski mejni ranžirni terminal)
  [7.9052, 47.3521],  // Olten
  [8.6482, 46.8282],  // Erstfeld (Severni portal baznega predora Gotthard)
  [8.9124, 46.3812],  // Bodio (Južni portal Gotthard Base Tunnel - 57 km)
  [9.0282, 46.1952],  // Bellinzona
  [9.0312, 45.8321],  // Chiasso (meja CH/IT)
  [9.2782, 45.4682]   // Milano Smistamento
];

export const GEO_GDYNIA_KATOWICE_OSTRAVA_WIEN: [number, number][] = [
  [18.5282, 54.5382], // Gdynia Port (Poljski baltski kontejnerski terminal)
  [18.0052, 53.1352], // Bydgoszcz
  [19.4582, 51.7682], // Łódź Olechów
  [19.1282, 50.8124], // Częstochowa
  [19.0214, 50.2582], // Katowice / Dąbrowa Górnicza (Šlezijski premog & jeklo)
  [18.3521, 49.9052], // Bohumín (meja PL/CZ)
  [18.2812, 49.8512], // Ostrava hl.n.
  [17.4521, 49.4521], // Přerov
  [16.8821, 48.7582], // Břeclav (meja CZ/AT)
  [16.4824, 48.1685]  // Wien Freudenau Hafen
];

// Helper to construct composite European routes connected to Slovenian network
export function buildCompositeEuropeanRoute(
  sloTrack: [number, number][],
  foreignTrack: [number, number][],
  reverseForeign = false
): [number, number][] {
  const foreign = reverseForeign ? foreignTrack.slice().reverse() : foreignTrack;
  return [...sloTrack, ...foreign.slice(1)];
}

// 2. High-Fidelity European Freight Slots
export function createEuropeanFreightSlots(
  geoKoperZalog: [number, number][],
  geoZalogMaribor: [number, number][],
  geoMariborSpilje: [number, number][],
  geoKoperHodos: [number, number][],
  geoZalogJesenice: [number, number][]
): EuropeanFreightSlot[] {
  const GEO_KOPER_WIEN = [
    ...geoKoperZalog,
    ...geoZalogMaribor.slice(1),
    ...geoMariborSpilje.slice(1),
    ...GEO_SPILJE_GRAZ_WIEN.slice(1)
  ];
  const GEO_WIEN_KOPER = GEO_KOPER_WIEN.slice().reverse();

  const GEO_KOPER_LINZ = [
    ...geoKoperZalog,
    ...geoZalogMaribor.slice(1),
    ...geoMariborSpilje.slice(1),
    ...GEO_SPILJE_LINZ_VOEST.slice(1)
  ];
  const GEO_LINZ_KOPER = GEO_KOPER_LINZ.slice().reverse();

  const GEO_KOPER_BUDAPEST = [
    ...geoKoperHodos,
    ...GEO_HODOS_BUDAPEST_BILK.slice(1)
  ];
  const GEO_BUDAPEST_KOPER = GEO_KOPER_BUDAPEST.slice().reverse();

  const GEO_KOPER_MUNICH = [
    ...geoKoperZalog,
    ...geoZalogJesenice.slice(1),
    ...GEO_JESENICE_VILLACH_SALZBURG_MUNICH.slice(1)
  ];
  const GEO_MUNICH_KOPER = GEO_KOPER_MUNICH.slice().reverse();

  const GEO_VILLACH_ZAGREB = [
    [13.8421, 46.5782] as [number, number],
    [14.0539, 46.4363] as [number, number],
    ...geoZalogJesenice.slice().reverse().slice(1),
    ...geoKoperZalog.slice(0, 18),
    ...GEO_DOBOVA_ZAGREB_BELGRADE.slice(1, 5)
  ];

  return [
    // --- ÖBB RAIL CARGO GROUP (Avstrija, Slovenija, Madžarska, Nemčija) ---
    {
      id: 'RCG_48402',
      trainNumber: 'RCG 48402',
      name: 'RCG 48402 Koper Tovorna ➔ Wien Freudenau (ÖBB Container Express)',
      routeGeometry: GEO_KOPER_WIEN,
      routeKm: 512,
      fromName: 'Luka Koper Tovorna (SI)',
      toName: 'Wien Freudenau Hafen CFF (AT)',
      fromCoords: [13.7380, 45.5480],
      toCoords: [16.4824, 48.1685],
      depTime: '02:15',
      arrTime: '11:45',
      operator: 'ÖBB Rail Cargo Group',
      locomotive: 'ÖBB 1116 "Taurus" (6.4 MW Čezmejna električna lokomotiva)',
      wagonType: '24x Sggmrss 90\' (Kontejnerski zglobni vagoni, 48 FEU)',
      cargo: 'Pomorski zabojniki Maersk & MSC za dunajski logistični bazen',
      grossWeightTons: 1650,
      lengthM: 640,
      speedRange: [50, 100],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '116% (UIC KE-GP)',
      trucksEquivalent: 54,
      co2SavedKg: 52800,
      ridHazard: null,
      corridor: 'TEN-T RFC 5 (Baltsko-jadranski koridor)',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'SI',
      countryTo: 'AT',
      checkpoints: [
        { km: 0, name: 'Luka Koper Tovorna' },
        { km: 42, name: 'Divača' },
        { km: 154, name: 'Ljubljana Zalog' },
        { km: 285, name: 'Maribor Tezno' },
        { km: 310, name: 'Šentilj / Spielfeld (meja SI/AT)' },
        { km: 360, name: 'Graz Süd CFF' },
        { km: 420, name: 'Bruck an der Mur' },
        { km: 465, name: 'Semmering' },
        { km: 512, name: 'Wien Freudenau Hafen' }
      ]
    },
    {
      id: 'RCG_48404',
      trainNumber: 'RCG 48404',
      name: 'RCG 48404 Koper ➔ Linz Voestalpine (Težki rudarski blok 2200t)',
      routeGeometry: GEO_KOPER_LINZ,
      routeKm: 480,
      fromName: 'Luka Koper Tovorna (SI)',
      toName: 'Linz Voestalpine Jeklarna (AT)',
      fromCoords: [13.7380, 45.5480],
      toCoords: [14.3312, 48.2721],
      depTime: '06:20',
      arrTime: '15:10',
      operator: 'ÖBB Rail Cargo Group',
      locomotive: '2x ÖBB 1293 "Vectron MS" (Dvojna vleka 12.8 MW)',
      wagonType: '28x Falns 4-osni samoizsipalniki za rudo',
      cargo: 'Železova ruda (hematit) iz prekomorskih ladij za plavže Voestalpine',
      grossWeightTons: 2200,
      lengthM: 590,
      speedRange: [40, 85],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '108% (UIC KE-GP)',
      trucksEquivalent: 72,
      co2SavedKg: 64200,
      ridHazard: null,
      corridor: 'TEN-T RFC 5 (Baltsko-jadranski koridor)',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'SI',
      countryTo: 'AT',
      checkpoints: [
        { km: 0, name: 'Luka Koper' },
        { km: 42, name: 'Divača' },
        { km: 154, name: 'Ljubljana Zalog' },
        { km: 285, name: 'Maribor' },
        { km: 310, name: 'Spielfeld (meja SI/AT)' },
        { km: 360, name: 'Graz' },
        { km: 420, name: 'Selzthal' },
        { km: 480, name: 'Linz Voestalpine' }
      ]
    },
    {
      id: 'RCG_48410',
      trainNumber: 'RCG 48410',
      name: 'RCG 48410 Wien Freudenau ➔ Koper Tovorna (Avstrijski izvoz)',
      routeGeometry: GEO_WIEN_KOPER,
      routeKm: 512,
      fromName: 'Wien Freudenau Hafen (AT)',
      toName: 'Luka Koper Tovorna (SI)',
      fromCoords: [16.4824, 48.1685],
      toCoords: [13.7380, 45.5480],
      depTime: '14:30',
      arrTime: '23:55',
      operator: 'ÖBB Rail Cargo Group',
      locomotive: 'ÖBB 1116 "Taurus"',
      wagonType: '22x Shimmns zaščiteni vagoni za pločevinaste tuljave',
      cargo: 'Visokokakovostno jeklo Voestalpine in les za izvoz v Azijo preko Kopra',
      grossWeightTons: 1580,
      lengthM: 520,
      speedRange: [50, 95],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '115% (UIC KE-GP)',
      trucksEquivalent: 50,
      co2SavedKg: 49500,
      ridHazard: null,
      corridor: 'TEN-T RFC 5 (Baltsko-jadranski koridor)',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'AT',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Wien Freudenau' },
        { km: 152, name: 'Graz' },
        { km: 202, name: 'Spielfeld (meja AT/SI)' },
        { km: 227, name: 'Maribor' },
        { km: 358, name: 'Ljubljana Zalog' },
        { km: 512, name: 'Luka Koper' }
      ]
    },

    // --- METRANS / RAIL CARGO HUNGARIA (Madžarska & Srednja Evropa) ---
    {
      id: 'MET_48020',
      trainNumber: 'MET 48020',
      name: 'MET 48020 Koper ➔ Budapest BILK (Metrans Evergreen Shuttle)',
      routeGeometry: GEO_KOPER_BUDAPEST,
      routeKm: 546,
      fromName: 'Luka Koper Tovorna (SI)',
      toName: 'Budapest BILK Kombiterminal (HU)',
      fromCoords: [13.7380, 45.5480],
      toCoords: [19.1124, 47.4212],
      depTime: '03:40',
      arrTime: '14:20',
      operator: 'Metrans / Rail Cargo Hungaria',
      locomotive: 'Siemens Vectron MS 383 (Metrans livery, 6.4 MW)',
      wagonType: '26x Sggnss 80\' (52 TEU visokozmogljivi vagoni)',
      cargo: 'Pomorski kontejnerji Evergreen & Yang Ming za madžarsko industrijo',
      grossWeightTons: 1680,
      lengthM: 650,
      speedRange: [48, 100],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '118% (UIC KE-GP)',
      trucksEquivalent: 56,
      co2SavedKg: 58900,
      ridHazard: null,
      corridor: 'TEN-T RFC 6 (Sredozemski koridor)',
      corridorId: 'rfc_6',
      isTransit: true,
      countryFrom: 'SI',
      countryTo: 'HU',
      checkpoints: [
        { km: 0, name: 'Luka Koper' },
        { km: 154, name: 'Ljubljana Zalog' },
        { km: 275, name: 'Pragersko' },
        { km: 320, name: 'Murska Sobota' },
        { km: 345, name: 'Hodoš (meja SI/HU)' },
        { km: 395, name: 'Zalaegerszeg' },
        { km: 470, name: 'Győr' },
        { km: 546, name: 'Budapest BILK' }
      ]
    },
    {
      id: 'MET_48022',
      trainNumber: 'MET 48022',
      name: 'MET 48022 Budapest BILK ➔ Koper Tovorna (Cosco & ONE Shuttle)',
      routeGeometry: GEO_BUDAPEST_KOPER,
      routeKm: 546,
      fromName: 'Budapest BILK Kombiterminal (HU)',
      toName: 'Luka Koper Tovorna (SI)',
      fromCoords: [19.1124, 47.4212],
      toCoords: [13.7380, 45.5480],
      depTime: '16:15',
      arrTime: '02:50',
      operator: 'Metrans / Rail Cargo Hungaria',
      locomotive: 'Siemens Vectron MS 383 (Metrans)',
      wagonType: '24x Sggnss 80\'',
      cargo: 'Izvozni zabojniki z madžarsko elektroniko (Samsung SDI) in avtodeli',
      grossWeightTons: 1520,
      lengthM: 610,
      speedRange: [48, 98],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '116% (UIC KE-GP)',
      trucksEquivalent: 50,
      co2SavedKg: 54100,
      ridHazard: null,
      corridor: 'TEN-T RFC 6 (Sredozemski koridor)',
      corridorId: 'rfc_6',
      isTransit: true,
      countryFrom: 'HU',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Budapest BILK' },
        { km: 76, name: 'Győr' },
        { km: 151, name: 'Zalaegerszeg' },
        { km: 201, name: 'Hodoš (meja HU/SI)' },
        { km: 226, name: 'Murska Sobota' },
        { km: 392, name: 'Ljubljana Zalog' },
        { km: 546, name: 'Luka Koper' }
      ]
    },
    {
      id: 'CER_44512',
      trainNumber: 'CER 44512',
      name: 'CER 44512 Békéscsaba ➔ Koper (Panonsko žito & koruza 1800t)',
      routeGeometry: GEO_BUDAPEST_KOPER,
      routeKm: 546,
      fromName: 'Békéscsaba / Budapest (HU)',
      toName: 'Luka Koper Žitni Silosi (SI)',
      fromCoords: [19.1124, 47.4212],
      toCoords: [13.7380, 45.5480],
      depTime: '09:00',
      arrTime: '19:45',
      operator: 'CER Cargo Hungary',
      locomotive: 'Transmontana 6000 kW (CER)',
      wagonType: '25x Uagps 4-osni žitni vagoni s pnevmatskim praznjenjem',
      cargo: 'Pšenica in koruza iz Panonske nižine za prekomorski izvoz v Severno Afriko',
      grossWeightTons: 1850,
      lengthM: 520,
      speedRange: [40, 85],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '110% (UIC KE-GP)',
      trucksEquivalent: 60,
      co2SavedKg: 61000,
      ridHazard: null,
      corridor: 'TEN-T RFC 6 (Sredozemski koridor)',
      corridorId: 'rfc_6',
      isTransit: true,
      countryFrom: 'HU',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Budapest' },
        { km: 201, name: 'Hodoš (meja HU/SI)' },
        { km: 226, name: 'Murska Sobota' },
        { km: 392, name: 'Ljubljana Zalog' },
        { km: 546, name: 'Luka Koper Žitni terminal' }
      ]
    },

    // --- DB CARGO & ALPSKO-BAVARSKI KORIDOR (Nemčija - Avstrija - Slovenija) ---
    {
      id: 'DBC_47812',
      trainNumber: 'DBC 47812',
      name: 'DBC 47812 München Riem ➔ Koper (DB Cargo Bavarsko-jadranski shuttle)',
      routeGeometry: GEO_MUNICH_KOPER,
      routeKm: 560,
      fromName: 'München Riem Umschlagbahnhof (DE)',
      toName: 'Luka Koper Tovorna (SI)',
      fromCoords: [11.6921, 48.1482],
      toCoords: [13.7380, 45.5480],
      depTime: '01:10',
      arrTime: '12:30',
      operator: 'DB Cargo',
      locomotive: 'DB Baureihe 193 "Vectron" (Večsistemska lokomotiva DB Cargo)',
      wagonType: '22x T3000e žepni vagoni za polpriklopnike in zabojnike',
      cargo: 'Bavarska industrijska oprema, stroji in avtodeli (BMW / Siemens)',
      grossWeightTons: 1540,
      lengthM: 620,
      speedRange: [50, 100],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '118% (UIC KE-GP)',
      trucksEquivalent: 48,
      co2SavedKg: 61500,
      ridHazard: null,
      corridor: 'TEN-T RFC 5 / RFC 10 (Alpski tranzit)',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'DE',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'München Riem (DE)' },
        { km: 85, name: 'Rosenheim' },
        { km: 145, name: 'Salzburg Hbf (AT)' },
        { km: 240, name: 'Tauern predor' },
        { km: 310, name: 'Villach Süd' },
        { km: 345, name: 'Jesenice (meja AT/SI)' },
        { km: 410, name: 'Ljubljana Zalog' },
        { km: 560, name: 'Luka Koper' }
      ]
    },
    {
      id: 'DBC_47814',
      trainNumber: 'DBC 47814',
      name: 'DBC 47814 Koper Tovorna ➔ München Riem (Audi & BMW Logistics)',
      routeGeometry: GEO_KOPER_MUNICH,
      routeKm: 560,
      fromName: 'Luka Koper Tovorna (SI)',
      toName: 'München Riem (DE)',
      fromCoords: [13.7380, 45.5480],
      toCoords: [11.6921, 48.1482],
      depTime: '13:00',
      arrTime: '23:45',
      operator: 'DB Cargo',
      locomotive: 'DB Baureihe 193 "Vectron"',
      wagonType: '20x Sggrss 80\' z zabojniki visoke vrednosti',
      cargo: 'Uvoženi polprevodniki, litijeve baterije in elektronika za bavarske tovarne',
      grossWeightTons: 1420,
      lengthM: 580,
      speedRange: [52, 100],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '120% (UIC KE-GP)',
      trucksEquivalent: 44,
      co2SavedKg: 58400,
      ridHazard: 'Razred 9 (Litij-ionske baterije)',
      corridor: 'TEN-T RFC 5 / RFC 10',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'SI',
      countryTo: 'DE',
      checkpoints: [
        { km: 0, name: 'Luka Koper' },
        { km: 150, name: 'Ljubljana Zalog' },
        { km: 215, name: 'Jesenice (meja SI/AT)' },
        { km: 250, name: 'Villach Süd' },
        { km: 320, name: 'Tauern predor' },
        { km: 415, name: 'Salzburg Hbf' },
        { km: 560, name: 'München Riem (DE)' }
      ]
    },

    // --- MERCITALIA RAIL & TX LOGISTIK (Italija - Avstrija - Nemčija / Brenner) ---
    {
      id: 'TXL_40120',
      trainNumber: 'TXL 40120',
      name: 'TXL 40120 Verona Quadrante ➔ München Riem (Brenner Intermodal Shuttle)',
      routeGeometry: GEO_VERONA_BRENNER_MUNICH,
      routeKm: 442,
      fromName: 'Verona Quadrante Europa (IT)',
      toName: 'München Riem (DE)',
      fromCoords: [10.9214, 45.4182],
      toCoords: [11.6921, 48.1482],
      depTime: '04:15',
      arrTime: '13:05',
      operator: 'TX Logistik / Mercitalia Rail',
      locomotive: 'Siemens Vectron MS (TX Logistik livery)',
      wagonType: '24x T3000e intermodalni vagoni s sedli za priklopnike',
      cargo: 'Ro-La in swap bodies (italijanska prehrambena industrija, keramika, vino)',
      grossWeightTons: 1620,
      lengthM: 630,
      speedRange: [50, 100],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '118% (UIC KE-GP)',
      trucksEquivalent: 52,
      co2SavedKg: 51200,
      ridHazard: null,
      corridor: 'TEN-T RFC 3 (Skandinavsko-sredozemski / Brenner)',
      corridorId: 'rfc_3',
      isTransit: false,
      countryFrom: 'IT',
      countryTo: 'DE',
      checkpoints: [
        { km: 0, name: 'Verona Quadrante Europa (IT)' },
        { km: 90, name: 'Trento' },
        { km: 150, name: 'Bolzano / Bozen' },
        { km: 215, name: 'Brennero / Brenner Pass (meja IT/AT)' },
        { km: 255, name: 'Innsbruck Hbf' },
        { km: 315, name: 'Kufstein (meja AT/DE)' },
        { km: 442, name: 'München Riem (DE)' }
      ]
    },
    {
      id: 'MIR_41850',
      trainNumber: 'MIR 41850',
      name: 'MIR 41850 Villa Opicina ➔ Ljubljana Zalog (Mercitalia West-East Transit)',
      routeGeometry: [
        [13.7880, 45.6880],
        [13.8723, 45.7061],
        ...geoKoperZalog.slice(10)
      ],
      routeKm: 110,
      fromName: 'Villa Opicina / Trieste (IT)',
      toName: 'Ljubljana Zalog (SI)',
      fromCoords: [13.7880, 45.6880],
      toCoords: [14.6050, 46.0600],
      depTime: '11:20',
      arrTime: '13:55',
      operator: 'Mercitalia Rail / SŽ Tovorni',
      locomotive: 'SŽ 541 / Mercitalia E.405',
      wagonType: '18x Rils vagoni s ponjavo',
      cargo: 'Italijanski industrijski polizdelki, keramika iz Sassuola in papir',
      grossWeightTons: 1180,
      lengthM: 420,
      speedRange: [45, 80],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '112% (UIC KE-GP)',
      trucksEquivalent: 38,
      co2SavedKg: 12400,
      ridHazard: null,
      corridor: 'TEN-T RFC 6 (Sredozemski koridor)',
      corridorId: 'rfc_6',
      isTransit: true,
      countryFrom: 'IT',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Villa Opicina (IT)' },
        { km: 8, name: 'Sežana (meja IT/SI)' },
        { km: 20, name: 'Divača' },
        { km: 60, name: 'Postojna' },
        { km: 110, name: 'Ljubljana Zalog' }
      ]
    },

    // --- RHINE-ALPINE CORRIDOR RFC 1 (Rotterdam - Duisburg - Basel - Milano) ---
    {
      id: 'BLS_43100',
      trainNumber: 'BLS 43100',
      name: 'BLS 43100 Duisburg DIT ➔ Milano Smistamento (Rhine-Alpine Gotthard Shuttle)',
      routeGeometry: GEO_ROTTERDAM_DUISBURG_BASEL_MILAN.slice(3),
      routeKm: 680,
      fromName: 'Duisburg Intermodal Terminal DIT (DE)',
      toName: 'Milano Smistamento (IT)',
      fromCoords: [6.7621, 51.4352],
      toCoords: [9.2782, 45.4682],
      depTime: '00:30',
      arrTime: '11:15',
      operator: 'BLS Cargo / SBB Cargo International',
      locomotive: 'BLS Re 475 "Vectron" (Večsistemska alpska lokomotiva)',
      wagonType: '26x T3000e / Megapack intermodalni vagoni',
      cargo: 'Severnomorski zabojniki, kemikalije BASF in oprema za severno Italijo',
      grossWeightTons: 1650,
      lengthM: 650,
      speedRange: [60, 100],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '120% (UIC KE-GP)',
      trucksEquivalent: 56,
      co2SavedKg: 78200,
      ridHazard: null,
      corridor: 'TEN-T RFC 1 (Ren-Alpe koridor)',
      corridorId: 'rfc_1',
      isTransit: false,
      countryFrom: 'DE',
      countryTo: 'IT',
      checkpoints: [
        { km: 0, name: 'Duisburg DIT (DE)' },
        { km: 70, name: 'Köln Eifeltor' },
        { km: 240, name: 'Mannheim Rbf' },
        { km: 380, name: 'Basel Wolf (CH)' },
        { km: 480, name: 'Erstfeld (vstop v Gotthard Base Tunnel 57km)' },
        { km: 537, name: 'Bodio (izstop Gotthard)' },
        { km: 610, name: 'Chiasso (meja CH/IT)' },
        { km: 680, name: 'Milano Smistamento (IT)' }
      ]
    },

    // --- BALTIC-ADRIATIC RFC 5 (Poljska, Češka, Avstrija, Slovenija) ---
    {
      id: 'PKP_45010',
      trainNumber: 'PKP 45010',
      name: 'PKP 45010 Katowice ➔ Koper Tovorna (Slezijski jeklarski & premogovni blok)',
      routeGeometry: [
        [19.0214, 50.2582] as [number, number],
        [18.3521, 49.9052] as [number, number],
        [18.2812, 49.8512] as [number, number],
        [16.8821, 48.7582] as [number, number],
        ...GEO_WIEN_KOPER.slice(1)
      ],
      routeKm: 760,
      fromName: 'Katowice Dąbrowa (PL)',
      toName: 'Luka Koper Tovorna (SI)',
      fromCoords: [19.0214, 50.2582],
      toCoords: [13.7380, 45.5480],
      depTime: '18:20',
      arrTime: '08:45',
      operator: 'PKP Cargo / SŽ Tovorni',
      locomotive: 'PKP EU46 "Vectron" (Večsistemska vleka)',
      wagonType: '24x Eanos 4-osni odprti vagoni z visokimi stranicami',
      cargo: 'Metalurški koks in jekleni profili iz šlezijskih jeklarn za izvoz preko Kopra',
      grossWeightTons: 1780,
      lengthM: 580,
      speedRange: [45, 90],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '110% (UIC KE-GP)',
      trucksEquivalent: 58,
      co2SavedKg: 82000,
      ridHazard: null,
      corridor: 'TEN-T RFC 5 (Baltsko-jadranski koridor)',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'PL',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Katowice (PL)' },
        { km: 55, name: 'Bohumín (meja PL/CZ)' },
        { km: 195, name: 'Břeclav (meja CZ/AT)' },
        { km: 260, name: 'Wien Inzersdorf' },
        { km: 412, name: 'Graz' },
        { km: 462, name: 'Spielfeld (meja AT/SI)' },
        { km: 487, name: 'Maribor' },
        { km: 618, name: 'Ljubljana Zalog' },
        { km: 760, name: 'Luka Koper' }
      ]
    },
    {
      id: 'CDC_42018',
      trainNumber: 'CDC 42018',
      name: 'ČD 42018 Praha Uhříněves ➔ Koper Tovorna (Češki intermodalni ekspres)',
      routeGeometry: [
        [14.5952, 50.0382] as [number, number],
        [14.4721, 48.9742] as [number, number], // České Budějovice
        [14.2912, 48.2902] as [number, number], // Linz Hbf
        ...GEO_SPILJE_LINZ_VOEST.slice().reverse().slice(1),
        ...geoMariborSpilje.slice().reverse().slice(1),
        ...geoZalogMaribor.slice().reverse().slice(1),
        ...geoKoperZalog.slice().reverse().slice(1)
      ],
      routeKm: 680,
      fromName: 'Praha Uhříněves Terminal (CZ)',
      toName: 'Luka Koper Tovorna (SI)',
      fromCoords: [14.5952, 50.0382],
      toCoords: [13.7380, 45.5480],
      depTime: '20:10',
      arrTime: '07:30',
      operator: 'ČD Cargo',
      locomotive: 'ČD 388 "TRAXX 3 MS" (Bombardier 5.6 MW)',
      wagonType: '22x Sggmrss 90\' kontejnerski zglobni vagoni',
      cargo: 'Škoda Auto rezervni deli, industrijski stroji in češki potrošniški izdelki',
      grossWeightTons: 1480,
      lengthM: 600,
      speedRange: [50, 95],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '115% (UIC KE-GP)',
      trucksEquivalent: 46,
      co2SavedKg: 71200,
      ridHazard: null,
      corridor: 'TEN-T RFC 5 (Baltsko-jadranski koridor)',
      corridorId: 'rfc_5',
      isTransit: true,
      countryFrom: 'CZ',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Praha Uhříněves (CZ)' },
        { km: 145, name: 'České Budějovice' },
        { km: 230, name: 'Summerau (meja CZ/AT)' },
        { km: 290, name: 'Linz Hbf' },
        { km: 410, name: 'Graz' },
        { km: 460, name: 'Spielfeld (meja AT/SI)' },
        { km: 485, name: 'Maribor' },
        { km: 680, name: 'Luka Koper' }
      ]
    },

    // --- ALPSKO-ZAHODNOBALKANSKI KORIDOR RFC 10 (Avstrija - Slovenija - Hrvaška - Srbija) ---
    {
      id: 'HZ_47020',
      trainNumber: 'HZ 47020',
      name: 'HZ 47020 Villach Süd ➔ Zagreb Ranžirni (Sava Alps-Balkan Transit)',
      routeGeometry: GEO_VILLACH_ZAGREB,
      routeKm: 275,
      fromName: 'Villach Süd CFF (AT)',
      toName: 'Zagreb Ranžirni kolodvor (HR)',
      fromCoords: [13.8421, 46.5782],
      toCoords: [16.0124, 45.7621],
      depTime: '07:45',
      arrTime: '12:50',
      operator: 'HŽ Cargo / SŽ Tovorni',
      locomotive: 'SŽ 541 / HŽ 1141 "Diocletian"',
      wagonType: '20x Shimmns zaščiteni vagoni za pločevino',
      cargo: 'Tranzitni tovor jekla in kemikalij iz Avstrije/Nemčije proti Hrvaški in BiH',
      grossWeightTons: 1420,
      lengthM: 490,
      speedRange: [45, 85],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '112% (UIC KE-GP)',
      trucksEquivalent: 44,
      co2SavedKg: 28400,
      ridHazard: null,
      corridor: 'TEN-T RFC 10 (Alpsko-zahodnobalkanski koridor)',
      corridorId: 'rfc_10',
      isTransit: true,
      countryFrom: 'AT',
      countryTo: 'HR',
      checkpoints: [
        { km: 0, name: 'Villach Süd (AT)' },
        { km: 35, name: 'Jesenice (meja AT/SI)' },
        { km: 100, name: 'Ljubljana Zalog' },
        { km: 164, name: 'Zidani Most' },
        { km: 222, name: 'Dobova (meja SI/HR)' },
        { km: 275, name: 'Zagreb Ranžirni kolodvor (HR)' }
      ]
    },
    {
      id: 'HZ_47022',
      trainNumber: 'HZ 47022',
      name: 'HZ 47022 Zagreb Ranžirni ➔ Koper Tovorna (HŽ Lesni & Žitni ekspres)',
      routeGeometry: [
        [16.0124, 45.7621] as [number, number],
        [15.6580, 45.8980] as [number, number],
        ...geoKoperZalog.slice(0, 18).reverse(),
        ...geoKoperZalog.slice(18).reverse()
      ],
      routeKm: 310,
      fromName: 'Zagreb Ranžirni kolodvor (HR)',
      toName: 'Luka Koper Tovorna (SI)',
      fromCoords: [16.0124, 45.7621],
      toCoords: [13.7380, 45.5480],
      depTime: '15:20',
      arrTime: '21:40',
      operator: 'HŽ Cargo / SŽ Tovorni',
      locomotive: 'SŽ 541 Taurus',
      wagonType: '22x Roos 4-osni vagoni s stebrički za hlodovino',
      cargo: 'Hrastova in bukova hlodovina iz Slavonije za kontejnerski izvoz v Luko Koper',
      grossWeightTons: 1510,
      lengthM: 510,
      speedRange: [42, 80],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '114% (UIC KE-GP)',
      trucksEquivalent: 46,
      co2SavedKg: 32100,
      ridHazard: null,
      corridor: 'TEN-T RFC 10 (Alpsko-zahodnobalkanski koridor)',
      corridorId: 'rfc_10',
      isTransit: true,
      countryFrom: 'HR',
      countryTo: 'SI',
      checkpoints: [
        { km: 0, name: 'Zagreb Ranžirni (HR)' },
        { km: 45, name: 'Dobova (meja HR/SI)' },
        { km: 103, name: 'Zidani Most' },
        { km: 167, name: 'Ljubljana Zalog' },
        { km: 268, name: 'Divača' },
        { km: 310, name: 'Luka Koper Tovorna' }
      ]
    },
    {
      id: 'HZ_47026',
      trainNumber: 'HZ 47026',
      name: 'HZ 47026 Zagreb ➔ Vinkovci ➔ Tovarnik / Beograd Makiš (Balkan Corridor)',
      routeGeometry: GEO_DOBOVA_ZAGREB_BELGRADE.slice(4),
      routeKm: 410,
      fromName: 'Zagreb Ranžirni (HR)',
      toName: 'Beograd Ranžirna Makiš (RS)',
      fromCoords: [16.0124, 45.7621],
      toCoords: [20.3721, 44.7312],
      depTime: '21:00',
      arrTime: '05:30',
      operator: 'HŽ Cargo / Srbija Kargo',
      locomotive: 'HŽ 1142 / 444 Bo-Bo',
      wagonType: '24x Gbs / Hbbillns zaprti vagoni',
      cargo: 'Surovine, papir in industrijski izdelki za južnobalkanska tržišča',
      grossWeightTons: 1350,
      lengthM: 480,
      speedRange: [45, 90],
      axleLoadClass: 'D4 (22.5 t/os)',
      brakePercentage: '110% (UIC KE-GP)',
      trucksEquivalent: 42,
      co2SavedKg: 43500,
      ridHazard: null,
      corridor: 'TEN-T RFC 10 (Alpsko-zahodnobalkanski koridor)',
      corridorId: 'rfc_10',
      isTransit: true,
      countryFrom: 'HR',
      countryTo: 'RS',
      checkpoints: [
        { km: 0, name: 'Zagreb Ranžirni (HR)' },
        { km: 140, name: 'Novska' },
        { km: 235, name: 'Slavonski Brod' },
        { km: 295, name: 'Vinkovci' },
        { km: 330, name: 'Tovarnik (meja HR/RS)' },
        { km: 410, name: 'Beograd Ranžirna Makiš (RS)' }
      ]
    }
  ];
}

// 3. Comprehensive European Rail Freight Corridors (RFC) Registry
export const ALL_EUROPEAN_RFC_CORRIDORS = [
  {
    id: 'rfc_6',
    name: 'TEN-T Sredozemski koridor (RFC 6)',
    euCorridorNumber: 6,
    alignment: 'Algeciras - Madrid - Barcelona - Lyon - Torino - Milano - Verona - Trst/Koper - Ljubljana - Budimpešta - Záhony (UA)',
    totalLengthKm: 6500,
    totalLengthKmInSi: 312,
    electrification: '3 kV DC (Slovenija, Italija) / 25 kV AC 50Hz (Madžarska, Španija)',
    axleLoad: 'D4 (22.5 t/os)',
    maxFreightSpeedKmh: 100,
    maxTrainLengthM: 740,
    mainHubs: ['Luka Koper', 'Budapest BILK', 'Verona Quadrante Europa', 'Milano Smistamento', 'Ljubljana Zalog'],
    operators: ['SŽ - Tovorni promet', 'Metrans', 'Rail Cargo Hungaria', 'Mercitalia Rail', 'Adria Transport'],
    status: 'Visoko izkoriščen koridor (92% kapacitete na Kraškem robu)'
  },
  {
    id: 'rfc_5',
    name: 'TEN-T Baltsko-jadranski koridor (RFC 5)',
    euCorridorNumber: 5,
    alignment: 'Gdynia / Gdańsk - Varšava - Katowice - Ostrava - Dunaj - Graz - Maribor - Ljubljana - Koper / Trst',
    totalLengthKm: 2400,
    totalLengthKmInSi: 278,
    electrification: '3 kV DC (Slovenija, Poljska) / 15 kV 16.7Hz AC (Avstrija)',
    axleLoad: 'D4 (22.5 t/os)',
    maxFreightSpeedKmh: 100,
    maxTrainLengthM: 740,
    mainHubs: ['Gdynia Port', 'Katowice Sosnowiec', 'Wien Freudenau', 'Graz Süd CFF', 'Maribor Tezno', 'Luka Koper'],
    operators: ['ÖBB Rail Cargo Group', 'PKP Cargo', 'ČD Cargo', 'SŽ - Tovorni promet'],
    status: 'Ključna povezava srednje Evrope z Jadranskim morjem'
  },
  {
    id: 'rfc_10',
    name: 'TEN-T Alpsko-zahodnobalkanski koridor (RFC 10)',
    euCorridorNumber: 10,
    alignment: 'Salzburg - Beljak (Villach) - Jesenice - Ljubljana - Dobova - Zagreb - Vinkovci - Beograd - Niš - Skopje / Sofija',
    totalLengthKm: 2150,
    totalLengthKmInSi: 158,
    electrification: '15 kV 16.7Hz (Avstrija) / 3 kV DC (Slovenija) / 25 kV AC 50Hz (Hrvaška, Srbija)',
    axleLoad: 'D4 (22.5 t/os)',
    maxFreightSpeedKmh: 100,
    maxTrainLengthM: 740,
    mainHubs: ['Villach Süd', 'Ljubljana Zalog', 'Zagreb Ranžirni', 'Beograd Makiš'],
    operators: ['HŽ Cargo', 'SŽ - Tovorni promet', 'ÖBB RCG', 'Srbija Kargo'],
    status: 'Glavna tranzitna arterija za jugovzhodno Evropo in Turčijo'
  },
  {
    id: 'rfc_1',
    name: 'TEN-T Ren-Alpe koridor (RFC 1)',
    euCorridorNumber: 1,
    alignment: 'Rotterdam / Antwerpen - Duisburg - Köln - Mannheim - Basel - Gotthard / Lötschberg - Milano - Genova',
    totalLengthKm: 1500,
    totalLengthKmInSi: 0,
    electrification: '15 kV AC 16.7Hz (Nemčija, Švica) / 3 kV DC (Italija, Belgija) / 25 kV AC (Betuweroute)',
    axleLoad: 'D4 (22.5 t/os)',
    maxFreightSpeedKmh: 100,
    maxTrainLengthM: 740,
    mainHubs: ['Rotterdam Waalhaven', 'Duisburg DIT', 'Basel Wolf', 'Milano Smistamento', 'Genova Voltri'],
    operators: ['DB Cargo', 'BLS Cargo', 'SBB Cargo International', 'Mercitalia Rail'],
    status: 'Najbolj obremenjen tovorni železniški koridor v Evropi'
  },
  {
    id: 'rfc_3',
    name: 'TEN-T Skandinavsko-sredozemski koridor (Brenner RFC 3)',
    euCorridorNumber: 3,
    alignment: 'Stockholm - Hamburg - Hannover - Würzburg - Nürnberg - München - Innsbruck - Brenner - Verona - Bologna - Rim',
    totalLengthKm: 4800,
    totalLengthKmInSi: 0,
    electrification: '15 kV 16.7Hz (Nemčija, Avstrija) / 3 kV DC & 25 kV AC (Italija)',
    axleLoad: 'D4 (22.5 t/os)',
    maxFreightSpeedKmh: 100,
    maxTrainLengthM: 740,
    mainHubs: ['München Riem', 'Verona Quadrante Europa', 'Bologna Interporto', 'Innsbruck Hbf'],
    operators: ['TX Logistik', 'DB Cargo', 'ÖBB RCG', 'Mercitalia Rail'],
    status: 'Ključni alpski prelaz (Brenner Ro-La & intermodal)'
  }
];

// 4. European Intermodal Terminals & Marshalling Yards
export const EUROPEAN_INTERMODAL_TERMINALS = [
  {
    id: 'terminal_wien_freudenau',
    name: 'Wien Freudenau Hafen & CFF Terminal',
    code: 'ATWFD',
    lat: 48.1685,
    lon: 16.4824,
    country: 'AT',
    type: 'terminal',
    category: 'Trimodealni Donavski & Železniški Hub',
    terminalType: 'Kontejnerski in ladijski terminal Dunaj',
    tracks: 14,
    electrified: '15 kV 16.7 Hz AC',
    capacityTonsPerDay: 35000,
    dailyBlockTrains: '22 - 30 vlakov/dan',
    tsiAxleLoad: 'Razred D4 (22.5 t/os)',
    maxTrainLengthM: 700,
    operators: ['ÖBB Rail Cargo Group', 'Metrans', 'DB Cargo'],
    cargoTypes: ['Pomorski zabojniki', 'Avtodeli', 'Kemični izdelki', 'Donavski pretovor'],
    status: 'Vodilni srednjeevropski hub'
  },
  {
    id: 'terminal_budapest_bilk',
    name: 'Budapest BILK Logisztikai Központ',
    code: 'HUBILK',
    lat: 47.4212,
    lon: 19.1124,
    country: 'HU',
    type: 'terminal',
    category: 'Vodilni madžarski kontejnerski terminal',
    terminalType: 'Intermodalni terminal Budimpešta-Jug',
    tracks: 12,
    electrified: '25 kV 50 Hz AC',
    capacityTonsPerDay: 32000,
    dailyBlockTrains: '20 - 28 vlakov/dan',
    tsiAxleLoad: 'Razred D4 (22.5 t/os)',
    maxTrainLengthM: 720,
    operators: ['Rail Cargo Hungaria', 'Metrans', 'CER Cargo', 'Adria Transport'],
    cargoTypes: ['Evergreen / Cosco zabojniki', 'Elektronika', 'Potrošniško blago'],
    status: 'Glavni ciljni terminal za tovor iz Luke Koper'
  },
  {
    id: 'terminal_graz_werndorf',
    name: 'Cargo Center Graz (Werndorf CFF)',
    code: 'ATGRZ',
    lat: 46.9182,
    lon: 15.4852,
    country: 'AT',
    type: 'terminal',
    category: 'Štajerski logistični center',
    terminalType: 'Kontejnerski in ranžirni terminal Graz-Süd',
    tracks: 10,
    electrified: '15 kV 16.7 Hz AC',
    capacityTonsPerDay: 20000,
    dailyBlockTrains: '14 - 18 vlakov/dan',
    tsiAxleLoad: 'Razred D4 (22.5 t/os)',
    maxTrainLengthM: 650,
    operators: ['ÖBB Rail Cargo Group', 'SŽ - Tovorni promet', 'LTE'],
    cargoTypes: ['Kontejnerski bloki', 'Automotive Magna Steyr', 'Les'],
    status: 'Operativen'
  },
  {
    id: 'terminal_munchen_riem',
    name: 'Umschlagbahnhof München-Riem',
    code: 'DEMUC',
    lat: 48.1482,
    lon: 11.6921,
    country: 'DE',
    type: 'terminal',
    category: 'Največji bavarski intermodalni terminal',
    terminalType: 'Kombinirani transport ceste in železnice',
    tracks: 16,
    electrified: '15 kV 16.7 Hz AC',
    capacityTonsPerDay: 40000,
    dailyBlockTrains: '25 - 35 vlakov/dan',
    tsiAxleLoad: 'Razred D4 (22.5 t/os)',
    maxTrainLengthM: 740,
    operators: ['DB Cargo', 'TX Logistik', 'KombiVerkehr'],
    cargoTypes: ['Polpriklopniki', 'Pomorski zabojniki', 'Bavarski avtomobili'],
    status: 'Vodilni nemški južni hub'
  },
  {
    id: 'terminal_verona_quadrante',
    name: 'Interporto Verona Quadrante Europa',
    code: 'ITVRN',
    lat: 45.4182,
    lon: 10.9214,
    country: 'IT',
    type: 'terminal',
    category: 'Št. 1 evropski interporto po pretovoru',
    terminalType: 'Brenner / Sredozemsko vozlišče',
    tracks: 18,
    electrified: '3 kV DC',
    capacityTonsPerDay: 45000,
    dailyBlockTrains: '30 - 45 vlakov/dan',
    tsiAxleLoad: 'Razred D4 (22.5 t/os)',
    maxTrainLengthM: 750,
    operators: ['Mercitalia Rail', 'TX Logistik', 'RTC', 'SBB Cargo'],
    cargoTypes: ['Brenner Ro-La', 'Keramika', 'Sadje in zelenjava', 'Industrijski polpriklopniki'],
    status: 'Največji intermodalni center v Italiji'
  },
  {
    id: 'terminal_zagreb_ranzirni',
    name: 'Zagreb Ranžirni kolodvor (HŽ Cargo Hub)',
    code: 'HRZAG',
    lat: 45.7621,
    lon: 16.0124,
    country: 'HR',
    type: 'yard',
    category: 'Osrednja hrvaška ranžirna postaja',
    terminalType: 'Gravitacijska drča in ranžirni park',
    tracks: 32,
    electrified: '25 kV 50 Hz AC',
    capacityTonsPerDay: 25000,
    dailyBlockTrains: '16 - 22 vlakov/dan',
    tsiAxleLoad: 'Razred D4 (22.5 t/os)',
    maxTrainLengthM: 700,
    operators: ['HŽ Cargo', 'SŽ - Tovorni promet', 'Rail Cargo Austria'],
    cargoTypes: ['Les', 'Žito', 'Naftni derivati INA', 'Kontejnerski tranzit'],
    status: 'Operativen'
  }
];
