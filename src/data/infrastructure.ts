// Vektorski podatki za Slovenske železnice (SŽ INSPIRE standard) in prometno/logistično infrastrukturo v Pomurju in Sloveniji
import proga41Coords from './proga41_coords.json';

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString' | 'Point' | 'MultiLineString';
    coordinates: any;
  };
  properties: Record<string, any>;
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// 🚆 SŽ ŽELEZNIŠKE PROGE (INSPIRE standard: Transport Networks - Railway)
export const SZ_RAILWAYS: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: proga41Coords,
      },
      properties: {
        id: 'sz_41',
        name: 'Glavna proga št. 41: Ormož – Murska Sobota – Hodoš d.m.',
        operator: 'Slovenske železnice (SŽ-Infrastruktura)',
        gauge: '1435 mm (standardna)',
        electrified: '3 kV DC (elektrificirana proga)',
        maxSpeed: '160 km/h',
        etcs: 'ETCS Nivo 1 + GSM-R',
        corridor: 'Evropski koridor RFC 6 (Mediteranski koridor)',
        category: 'Glavna železniška proga TEN-T',
        inspireTheme: 'Transport Networks: Railway'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Proga 42: Ljutomer - Gornja Radgona
          [16.188, 46.518], // Ljutomer
          [16.142, 46.558], // Križevci
          [16.082, 46.612], // Radenci
          [15.992, 46.675], // Gornja Radgona ŽP
        ],
      },
      properties: {
        id: 'sz_42',
        name: 'Regionalna proga št. 42: Ljutomer – Gornja Radgona',
        operator: 'SŽ-Infrastruktura',
        gauge: '1435 mm',
        electrified: 'Neelektrificirana (dizel vleka)',
        maxSpeed: '60 km/h',
        category: 'Regionalna proga (tovorni & industrijski promet)',
        inspireTheme: 'Transport Networks: Railway'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Proga 40: Pragersko - Ptuj - Ormož
          [15.658, 46.398], // Pragersko (vozlišče)
          [15.868, 46.425], // Ptuj
          [16.148, 46.408], // Ormož
          [16.275, 46.392], // Središče ob Dravi (d.m. HR - Čakovec)
        ],
      },
      properties: {
        id: 'sz_40',
        name: 'Glavna proga št. 40: Pragersko – Ptuj – Ormož – Središče d.m.',
        operator: 'SŽ-Infrastruktura',
        gauge: '1435 mm',
        electrified: '3 kV DC',
        maxSpeed: '120 km/h',
        category: 'Glavna proga (koridor proti Hrvaški)',
        inspireTheme: 'Transport Networks: Railway'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Proga 30: Celje - Maribor - Šentilj (Avstrija meja)
          [15.265, 46.228], // Celje
          [15.658, 46.398], // Pragersko
          [15.651, 46.558], // Maribor Glavna Postaja
          [15.655, 46.685], // Šentilj d.m. (ÖBB povezava proti Graz / Dunaj)
        ],
      },
      properties: {
        id: 'sz_30',
        name: 'Glavna magistralna proga št. 30: Zidani Most – Maribor – Šentilj d.m.',
        operator: 'SŽ-Infrastruktura / ÖBB',
        gauge: '1435 mm',
        electrified: '3 kV DC (dvotirna proga)',
        maxSpeed: '140 km/h',
        category: 'Glavna magistralna proga (Baltsko-Jadranski koridor)',
        inspireTheme: 'Transport Networks: Railway'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Proga Lendava - Rédics (HU povezava)
          [16.452, 46.564], // Lendava ŽP
          [16.485, 46.582], // Most na Muri
          [16.518, 46.602], // Rédics (MÁV Madžarska)
        ],
      },
      properties: {
        id: 'sz_lendava_redics',
        name: 'Čezmejna proga Lendava – Rédics (MÁV)',
        operator: 'SŽ-Infrastruktura / MÁV',
        gauge: '1435 mm',
        electrified: 'Neelektrificirana',
        maxSpeed: '50 km/h',
        category: 'Čezmejna proga za tovorni promet',
        inspireTheme: 'Transport Networks: Railway'
      }
    }
  ]
};

// 🚉 SŽ ŽELEZNIŠKE POSTAJE IN POSTAJALIŠČA (INSPIRE Railway Nodes)
export const SZ_STATIONS: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1719, 46.6594] },
      properties: {
        id: 'sz_stat_ms',
        name: 'Železniška postaja Murska Sobota',
        type: 'rail_station',
        code: 'MS',
        tracks: 6,
        platforms: 3,
        services: ['Potniški promet SŽ', 'Mednarodni vlaki (EC Citadella Budimpešta–Ljubljana)', 'Tovorni kontejnerski terminal', 'Park & Ride', 'Brezplačen Wi-Fi'],
        accessible: true,
        ticketOffice: true,
        electrified: '3 kV DC',
        inspireClass: 'RailwayStationNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.2114, 46.6233] },
      properties: {
        id: 'sz_stat_lip',
        name: 'Železniško postajališče Lipovci',
        type: 'rail_station',
        code: 'LIP',
        tracks: 2,
        platforms: 2,
        services: ['Regionalni potniški vlaki (LP, RG)'],
        accessible: true,
        inspireClass: 'RailwayStopNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1782, 46.7212] },
      properties: {
        id: 'sz_stat_puc',
        name: 'Železniška postaja Puconci',
        type: 'rail_station',
        code: 'PUC',
        tracks: 3,
        platforms: 2,
        services: ['Regionalni vlaki', 'Industrijski tir za kmetijstvo'],
        accessible: true,
        electrified: '3 kV DC',
        inspireClass: 'RailwayStationNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.2125, 46.7954] },
      properties: {
        id: 'sz_stat_mack',
        name: 'Železniško postajališče Mačkovci',
        type: 'rail_station',
        code: 'MACK',
        tracks: 2,
        platforms: 1,
        services: ['Lokalni potniški vlaki (LP)'],
        accessible: true,
        inspireClass: 'RailwayStopNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.2851, 46.8722] },
      properties: {
        id: 'sz_stat_gp',
        name: 'Železniška postaja Gornji Petrovci',
        type: 'rail_station',
        code: 'GP',
        tracks: 3,
        platforms: 2,
        services: ['Regionalni vlaki', 'Križanje tovornih vlakov'],
        accessible: true,
        electrified: '3 kV DC',
        inspireClass: 'RailwayStationNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.3255, 46.9054] },
      properties: {
        id: 'sz_stat_hod',
        name: 'Mejna železniška postaja Hodoš (HU Meja)',
        type: 'rail_station',
        code: 'HOD',
        tracks: 8,
        platforms: 3,
        services: ['Mednarodni mejni prehod (MÁV Madžarska)', 'Menjava lokomotiv 3kV DC / 25kV AC', 'Carinski in fitosanitarni pregled'],
        accessible: true,
        ticketOffice: true,
        electrified: '3 kV DC / 25 kV AC 50Hz (mejni stik)',
        inspireClass: 'BorderRailwayStation'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1884, 46.5182] },
      properties: {
        id: 'sz_stat_lju',
        name: 'Železniška postaja Ljutomer Mesto',
        type: 'rail_station',
        code: 'LJU_M',
        tracks: 4,
        platforms: 2,
        services: ['Regionalno vozlišče', 'Potniški in tovorni promet'],
        accessible: true,
        electrified: '3 kV DC',
        inspireClass: 'RailwayStationNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [15.9922, 46.6751] },
      properties: {
        id: 'sz_stat_grad',
        name: 'Železniška postaja Gornja Radgona',
        type: 'rail_station',
        code: 'GR',
        tracks: 3,
        platforms: 1,
        services: ['Tovorni promet (Radenska, Arcont)', 'Povezava proti Bad Radkersburg (AT)'],
        accessible: true,
        inspireClass: 'RailwayStationNode'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [15.6514, 46.5582] },
      properties: {
        id: 'sz_stat_mb',
        name: 'Glavna železniška postaja Maribor',
        type: 'rail_station',
        code: 'MB',
        tracks: 12,
        platforms: 5,
        services: ['Središče Štajerske & Podravja', 'ÖBB Railjet, SŽ ICS, Flirt, EC Emona'],
        accessible: true,
        ticketOffice: true,
        electrified: '3 kV DC',
        inspireClass: 'MainJunctionRailwayStation'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [15.6552, 46.6854] },
      properties: {
        id: 'sz_stat_sen',
        name: 'Mejna železniška postaja Šentilj (AT Meja)',
        type: 'rail_station',
        code: 'SEN',
        tracks: 6,
        platforms: 2,
        services: ['Mejni prehod z Avstrijo (Spielfeld-Straß ÖBB)', 'ÖBB Railjet & Tovorni promet'],
        accessible: true,
        electrified: '3 kV DC (stik z 15 kV AC 16.7Hz ÖBB)',
        inspireClass: 'BorderRailwayStation'
      }
    }
  ]
};

// ⚠️ SŽ NIVOJSKI PREHODI (Level Crossings)
export const SZ_CROSSINGS: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1668, 46.6625] },
      properties: {
        id: 'sz_npr_ms_panonska',
        name: 'NPr km 45.2 – Murska Sobota Panonska (Avtomatske zapornice)',
        protection: 'Avtomatske polzapornice + LED svetlobni signal + Radar ovir',
        speedLimit: '120 km/h',
        citsConnected: true
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1764, 46.7198] },
      properties: {
        id: 'sz_npr_puconci',
        name: 'NPr km 49.8 – Puconci Center (Zavarovan nivojski prehod)',
        protection: 'Polzapornice z zvočnim signalom',
        speedLimit: '140 km/h',
        citsConnected: true
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.2085, 46.5824] },
      properties: {
        id: 'sz_npr_verzej',
        name: 'NPr km 38.1 – Veržej / Križevci',
        protection: 'Avtomatske zapornice z videonadzorom SŽ',
        speedLimit: '140 km/h',
        citsConnected: true
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.2162, 46.6125] },
      properties: {
        id: 'sz_npr_lipovci',
        name: 'NPr km 41.5 – Lipovci Industrijska cona',
        protection: 'Zapornice + C-ITS V2X senzor',
        speedLimit: '160 km/h',
        citsConnected: true
      }
    }
  ]
};

// 🛣️ CESTNO OMREŽJE ZA LOGISTIKO IN MESTNI PROMET
export const ROAD_NETWORK: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Avtocesta A5 Pomurski krak (Maribor - Vučja vas - MS - Lendava - Pince d.m. HU)
          [15.750, 46.580], // Maribor / Dragučova
          [15.980, 46.620], // Vučja vas
          [16.140, 46.640], // Murska Sobota Zahod
          [16.180, 46.645], // Murska Sobota Vzhod (BTC)
          [16.220, 46.630], // Lipovci priključek
          [16.290, 46.600], // Gančani
          [16.360, 46.580], // Turnišče
          [16.450, 46.550], // Lendava
          [16.530, 46.520], // Pince d.m. HU
        ]
      },
      properties: {
        id: 'road_a5',
        name: 'Avtocesta A5 (Pomurska magistrala TEN-T)',
        category: 'Avtocesta',
        speedLimit: '130 km/h',
        operator: 'DARS'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Glavna mestna os Murska Sobota (Expano - Slovenska - BTC - Noršinci)
          [16.138, 46.648], // Expano
          [16.155, 46.655], // Tišinska vpadnica
          [16.166, 46.659], // Slovenska ulica
          [16.172, 46.662], // Kocljeva / ŽP
          [16.182, 46.671], // Lendavska BTC
          [16.195, 46.678], // Noršinska cona (DPD / GLS Logistični center)
        ]
      },
      properties: {
        id: 'road_city_main',
        name: 'Mestna prometna os Murska Sobota (Glavna linija)',
        category: 'Glavna mestna cesta',
        speedLimit: '50 km/h',
        operator: 'MOMS'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          // Regionalna cesta MS - Puconci - Grad Goričko
          [16.166, 46.659], // MS Center
          [16.178, 46.721], // Puconci
          [16.195, 46.758], // Mačkovci
          [16.160, 46.800], // Grad Goričko
        ]
      },
      properties: {
        id: 'road_goricko',
        name: 'Regionalna cesta R1-232: MS – Puconci – Goričko',
        category: 'Regionalna cesta',
        speedLimit: '90 km/h',
        operator: 'DRSI'
      }
    }
  ]
};

// 📦 LOGISTIČNI IN DOSTAVNI CENTRI (DPD, GLS, Pošta Slovenije, DHL)
export const LOGISTICS_HUBS: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1912, 46.6745] },
      properties: {
        id: 'hub_dpd_ms',
        name: 'DPD Slovenija – Depo & Hub Murska Sobota',
        provider: 'DPD',
        address: 'Noršinska ulica 14, 9000 Murska Sobota',
        fleetActive: 12,
        dailyPackages: 3850,
        type: 'logistics_hub'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1855, 46.6720] },
      properties: {
        id: 'hub_gls_ms',
        name: 'GLS Slovenija – Paketni Depo 9000',
        provider: 'GLS',
        address: 'Obrtna ulica 28, 9000 Murska Sobota',
        fleetActive: 15,
        dailyPackages: 4200,
        type: 'logistics_hub'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1648, 46.6610] },
      properties: {
        id: 'hub_posta_ms',
        name: 'Pošta Slovenije – Glavni Poštni Center 9101 Murska Sobota',
        provider: 'Pošta Slovenije',
        address: 'Trg Zmage 5, 9000 Murska Sobota',
        fleetActive: 22,
        dailyPackages: 5600,
        type: 'logistics_hub'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1795, 46.6450] },
      properties: {
        id: 'hub_dhl_ms',
        name: 'DHL Express – Logistično vozlišče Pomurje',
        provider: 'DHL',
        address: 'Panonska ulica 60, 9000 Murska Sobota',
        fleetActive: 8,
        dailyPackages: 1900,
        type: 'logistics_hub'
      }
    }
  ]
};

// 📊 CESTNI ŠTEVCI PROMETA (DARS / DRSI)
export const TRAFFIC_COUNTERS: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1425, 46.6412] },
      properties: {
        id: 'dars_a5_ms_zahod',
        name: 'DARS Števec: A5 – MS Zahod (km 42.1)',
        corridor: 'Avtocesta A5 (Smer Budimpešta)',
        flowVehiclesPerHour: 1140,
        avgSpeedKmH: 124,
        heavyTruckPercent: 24.2,
        occupancyPercent: 18.5,
        status: 'Tekoč promet'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1835, 46.6475] },
      properties: {
        id: 'dars_a5_ms_vzhod',
        name: 'DARS Števec: A5 – MS Vzhod (km 46.8)',
        corridor: 'Avtocesta A5 (Smer Maribor)',
        flowVehiclesPerHour: 980,
        avgSpeedKmH: 126,
        heavyTruckPercent: 26.8,
        occupancyPercent: 15.2,
        status: 'Tekoč promet'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1712, 46.6645] },
      properties: {
        id: 'moms_lendavska',
        name: 'MOMS Števec: Lendavska ulica (Vpadnica Vzhod)',
        corridor: 'G1-3 Lendavska',
        flowVehiclesPerHour: 620,
        avgSpeedKmH: 48,
        heavyTruckPercent: 5.1,
        occupancyPercent: 42.0,
        status: 'Zmerna gostota'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1585, 46.6545] },
      properties: {
        id: 'moms_tisinska',
        name: 'MOMS Števec: Tišinska ulica (Vpadnica Zahod)',
        corridor: 'R1-232 Tišinska',
        flowVehiclesPerHour: 480,
        avgSpeedKmH: 49,
        heavyTruckPercent: 3.8,
        occupancyPercent: 31.5,
        status: 'Tekoč promet'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1605, 46.6508] },
      properties: {
        id: 'moms_bakovska',
        name: 'MOMS Števec: Bakovska ulica (Vpadnica Jug)',
        corridor: 'R2-441 Bakovska',
        flowVehiclesPerHour: 510,
        avgSpeedKmH: 47,
        heavyTruckPercent: 6.4,
        occupancyPercent: 36.2,
        status: 'Tekoč promet'
      }
    }
  ]
};

// ⚡ EV POLNILNICE V POMURJU
export const EV_STATIONS_POMURJE: GeoJSONCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1825, 46.6712] },
      properties: {
        id: 'ev_ms_btc_ionity',
        name: 'Ionity & Petrol Ultra-Fast EV (BTC Sobota)',
        town: 'Murska Sobota',
        points: 6,
        maxKw: 350,
        operational: true,
        connectors: ['CCS2 Combo', 'Type 2'],
        operator: 'Ionity / Petrol'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1662, 46.6598] },
      properties: {
        id: 'ev_ms_center_moms',
        name: 'MOMS Mestna Hitra Polnilnica (Slovenska ulica)',
        town: 'Murska Sobota',
        points: 4,
        maxKw: 50,
        operational: true,
        connectors: ['Type 2', 'CCS2'],
        operator: 'Mestna občina Murska Sobota'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1715, 46.6591] },
      properties: {
        id: 'ev_ms_kolodvor',
        name: 'SŽ Intermodalna EV Polnilnica (ŽP Kolodvor)',
        town: 'Murska Sobota',
        points: 4,
        maxKw: 22,
        operational: true,
        connectors: ['Type 2'],
        operator: 'Slovenske železnice'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.1395, 46.6478] },
      properties: {
        id: 'ev_ms_expano',
        name: 'Expano E-Mobilnost (Soboško jezero)',
        town: 'Murska Sobota',
        points: 4,
        maxKw: 22,
        operational: true,
        connectors: ['Type 2'],
        operator: 'Expano Regijski Park'
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.2025, 46.6515] },
      properties: {
        id: 'ev_ms_rakican',
        name: 'SBMS EV Polnilnica za Obiskovalce & Osoblje',
        town: 'Rakičan',
        points: 4,
        maxKw: 50,
        operational: true,
        connectors: ['CCS2', 'Type 2'],
        operator: 'Splošna bolnišnica Murska Sobota'
      }
    }
  ]
};
