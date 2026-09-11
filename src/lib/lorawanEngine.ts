import { LoRaGatewayInfo, LoRaPacket } from '../types';

// Mathematical LoRa Time on Air (ToA) calculation according to Semtech SX1276/SX1262 datasheet
export function calculateAirtime(payloadBytes: number, sf: number, bwKHz = 125, cr = 1, explicitHeader = true, lowDataRateOpt?: boolean): number {
  if (lowDataRateOpt === undefined) {
    lowDataRateOpt = sf >= 11 && bwKHz === 125;
  }
  const preambleSymbols = 8;
  const tSymbol = (Math.pow(2, sf) / (bwKHz * 1000)) * 1000; // in ms
  const tPreamble = (preambleSymbols + 4.25) * tSymbol;
  
  const h = explicitHeader ? 0 : 1;
  const de = lowDataRateOpt ? 1 : 0;
  const crc = 1;
  
  const num = 8 * payloadBytes - 4 * sf + 28 + 16 * crc - 20 * h;
  const den = 4 * (sf - 2 * de);
  const payloadSymbols = 8 + Math.max(Math.ceil(num / den) * (cr + 4), 0);
  
  const tPayload = payloadSymbols * tSymbol;
  return Math.round((tPreamble + tPayload) * 10) / 10;
}

// LoRaWAN Sensor Device Archetypes in Pomurje
const LORA_DEVICES = [
  {
    devEui: '70B3D57ED00481F1',
    name: 'Soboško Jezero – Nivo Vode & Temperatura',
    type: 'voda' as const,
    sfRange: [7, 9],
    channels: [868.1, 868.3, 868.5],
    generate: (seq: number) => {
      const level = Math.round(185 + Math.sin(seq * 0.1) * 8);
      const temp = Math.round((21.8 + Math.cos(seq * 0.05) * 2) * 10) / 10;
      const battery = 3.62;
      return {
        hex: `0167${Math.round(temp * 10).toString(16).padStart(4, '0')}0202${level.toString(16).padStart(4, '0')}0300${Math.round(battery * 100).toString(16).padStart(4, '0')}`,
        decoded: { 'Nivo vode': `${level} cm`, 'Temperatura': `${temp} °C`, 'Baterija': `${battery} V`, 'Stanje': 'Normalno' },
        sizeBytes: 15
      };
    }
  },
  {
    devEui: '70B3D57ED00499C4',
    name: 'MOMS Trg Zmage – Smart Parking Senzor #08',
    type: 'parkirisce' as const,
    sfRange: [7, 8],
    channels: [868.1, 867.3, 868.3],
    generate: (seq: number) => {
      const occupied = (seq % 4) === 0 || (seq % 7) === 0;
      const magX = 142;
      const magY = -38;
      const magZ = 490;
      return {
        hex: `0100${occupied ? '01' : '00'}0271${magX.toString(16).slice(-4)}`,
        decoded: { 'Zasedenost': occupied ? 'ZASEDENO' : 'PROSTO', 'Magnetni X/Y/Z': `${magX}/${magY}/${magZ} µT`, 'Baterija': '3.58 V' },
        sizeBytes: 11
      };
    }
  },
  {
    devEui: '70B3D57ED004AA32',
    name: 'Rakičan Kmetijski Senzor – Vlaga & EC Tal',
    type: 'tla' as const,
    sfRange: [8, 10],
    channels: [868.3, 867.5, 867.7],
    generate: (seq: number) => {
      const moisture = Math.round(38 + Math.sin(seq * 0.05) * 6);
      const ec = 1.24;
      const tempTal = 18.5;
      return {
        hex: `0368${(moisture * 2).toString(16).padStart(2, '0')}0467${Math.round(tempTal * 10).toString(16).padStart(4, '0')}`,
        decoded: { 'Vlažnost tal': `${moisture} %`, 'Temperatura tal': `${tempTal} °C`, 'Električna prevodnost (EC)': `${ec} dS/m` },
        sizeBytes: 14
      };
    }
  },
  {
    devEui: '70B3D57ED004BC55',
    name: 'SŽ ŽP Sobota – Tiri & Vibracijski Senzor (C-ITS)',
    type: 'zeleznica' as const,
    sfRange: [7, 8],
    channels: [868.1, 868.5],
    generate: (seq: number) => {
      const vibration = (seq % 3 === 0) ? 4.8 : 0.4;
      const trackTemp = Math.round((28.2 + Math.sin(seq * 0.1) * 3) * 10) / 10;
      return {
        hex: `0771${Math.round(vibration * 10).toString(16).padStart(4, '0')}0867${Math.round(trackTemp * 10).toString(16).padStart(4, '0')}`,
        decoded: { 'Vibracije tirnice': `${vibration} mm/s²`, 'Temperatura jekla': `${trackTemp} °C`, 'Status tirnice': vibration > 3 ? 'Vlak na tiru' : 'Mirovanje' },
        sizeBytes: 12
      };
    }
  },
  {
    devEui: '70B3D57ED004DE11',
    name: 'BTC Murska Sobota – Pametni Ekološki Otok #02',
    type: 'smetnjak' as const,
    sfRange: [8, 10],
    channels: [868.5, 867.1],
    generate: (seq: number) => {
      const fullness = Math.min(95, Math.round(45 + (seq % 20) * 2.5));
      return {
        hex: `0968${fullness.toString(16).padStart(2, '0')}0A0001`,
        decoded: { 'Napolnjenost posode': `${fullness} %`, 'Optični ToF senzor': 'OK', 'Opozorilo za praznjenje': fullness > 80 ? 'DA' : 'NE' },
        sizeBytes: 9
      };
    }
  },
  {
    devEui: '70B3D57ED004F099',
    name: 'Goričko Grad – Avtomatska Vremenska Postaja',
    type: 'vreme' as const,
    sfRange: [9, 11],
    channels: [868.1, 868.3],
    generate: (seq: number) => {
      const temp = 22.4;
      const humidity = 56;
      const pressure = 1016.2;
      const solarW = 680;
      return {
        hex: `016700E0026870037327B2040202A8`,
        decoded: { 'Temperatura': `${temp} °C`, 'Vlažnost zraka': `${humidity} %`, 'Zračni tlak': `${pressure} hPa`, 'Sončno obsevanje': `${solarW} W/m²` },
        sizeBytes: 20
      };
    }
  }
];

// Base LoRaWAN Gateways in Pomurje
const INITIAL_GATEWAYS: Omit<LoRaGatewayInfo, 'recentPackets'>[] = [
  {
    id: 'eui-58a0cbfffe801124',
    name: 'LoRaWAN Gateway MS Center (Mestna občina)',
    lat: 46.6625,
    lon: 16.1668,
    online: true,
    frequencyPlan: 'EU868 (868.1 – 868.5 MHz)',
    antennaCount: 2,
    antennaGainDbi: 3.5,
    txPowerDbm: 14,
    rssi: -72,
    snr: 9.8,
    noiseFloorDbm: -118,
    activeNodes: 38,
    rxPackets: 18420,
    txPackets: 412,
    dutyCyclePercent: 0.28,
    channelUtilization: { '868.1': 24, '868.3': 31, '868.5': 18, '867.3': 12 }
  },
  {
    id: 'eui-58a0cbfffe802991',
    name: 'LoRaWAN Gateway SŽ ŽP Murska Sobota',
    lat: 46.6582,
    lon: 16.1712,
    online: true,
    frequencyPlan: 'EU868 (868.3 MHz)',
    antennaCount: 1,
    antennaGainDbi: 5.0,
    txPowerDbm: 14,
    rssi: -66,
    snr: 10.6,
    noiseFloorDbm: -120,
    activeNodes: 24,
    rxPackets: 12940,
    txPackets: 280,
    dutyCyclePercent: 0.19,
    channelUtilization: { '868.1': 19, '868.3': 38, '868.5': 15, '867.1': 8 }
  },
  {
    id: 'eui-a840411d88209210',
    name: 'LoRaWAN Gateway Industrijska cona BTC',
    lat: 46.6710,
    lon: 16.1820,
    online: true,
    frequencyPlan: 'EU868 (868.5 MHz)',
    antennaCount: 1,
    antennaGainDbi: 4.0,
    txPowerDbm: 14,
    rssi: -78,
    snr: 8.4,
    noiseFloorDbm: -116,
    activeNodes: 46,
    rxPackets: 34180,
    txPackets: 890,
    dutyCyclePercent: 0.44,
    channelUtilization: { '868.1': 32, '868.3': 22, '868.5': 36, '867.5': 14 }
  },
  {
    id: 'eui-58a0cbfffe805541',
    name: 'LoRaWAN Gateway Expano & Soboško jezero',
    lat: 46.6485,
    lon: 16.1390,
    online: true,
    frequencyPlan: 'EU868 (868.1 MHz)',
    antennaCount: 1,
    antennaGainDbi: 6.0,
    txPowerDbm: 14,
    rssi: -62,
    snr: 11.2,
    noiseFloorDbm: -122,
    activeNodes: 19,
    rxPackets: 8750,
    txPackets: 120,
    dutyCyclePercent: 0.12,
    channelUtilization: { '868.1': 28, '868.3': 15, '868.5': 10, '867.9': 4 }
  },
  {
    id: 'eui-58a0cbfffe806118',
    name: 'LoRaWAN Gateway SB Murska Sobota (Rakičan)',
    lat: 46.6528,
    lon: 16.2010,
    online: true,
    frequencyPlan: 'EU868 (868.3 MHz)',
    antennaCount: 2,
    antennaGainDbi: 4.5,
    txPowerDbm: 14,
    rssi: -70,
    snr: 9.9,
    noiseFloorDbm: -119,
    activeNodes: 29,
    rxPackets: 16320,
    txPackets: 340,
    dutyCyclePercent: 0.22,
    channelUtilization: { '868.1': 18, '868.3': 26, '868.5': 20, '867.7': 16 }
  },
  {
    id: 'eui-58a0cbfffe807293',
    name: 'LoRaWAN Gateway Lendava – Vinarium stolp',
    lat: 46.5682,
    lon: 16.4520,
    online: true,
    frequencyPlan: 'EU868 (868.1 MHz)',
    antennaCount: 1,
    antennaGainDbi: 8.0,
    txPowerDbm: 14,
    rssi: -84,
    snr: 7.1,
    noiseFloorDbm: -124,
    activeNodes: 31,
    rxPackets: 21400,
    txPackets: 480,
    dutyCyclePercent: 0.31,
    channelUtilization: { '868.1': 35, '868.3': 20, '868.5': 18, '867.3': 11 }
  },
  {
    id: 'eui-58a0cbfffe808442',
    name: 'LoRaWAN Gateway Gornja Radgona – Grad',
    lat: 46.6890,
    lon: 15.9910,
    online: true,
    frequencyPlan: 'EU868 (868.3 MHz)',
    antennaCount: 1,
    antennaGainDbi: 5.5,
    txPowerDbm: 14,
    rssi: -76,
    snr: 8.8,
    noiseFloorDbm: -121,
    activeNodes: 22,
    rxPackets: 11200,
    txPackets: 190,
    dutyCyclePercent: 0.16,
    channelUtilization: { '868.1': 20, '868.3': 30, '868.5': 14, '867.5': 9 }
  },
  {
    id: 'eui-58a0cbfffe809315',
    name: 'LoRaWAN Gateway Ljutomer – Glavni trg',
    lat: 46.5180,
    lon: 16.1960,
    online: true,
    frequencyPlan: 'EU868 (868.5 MHz)',
    antennaCount: 1,
    antennaGainDbi: 4.0,
    txPowerDbm: 14,
    rssi: -74,
    snr: 9.4,
    noiseFloorDbm: -120,
    activeNodes: 26,
    rxPackets: 14890,
    txPackets: 260,
    dutyCyclePercent: 0.21,
    channelUtilization: { '868.1': 22, '868.3': 24, '868.5': 28, '867.1': 10 }
  }
];

class LoRaWANEngine {
  private gateways: LoRaGatewayInfo[] = [];
  private packetHistory: LoRaPacket[] = [];
  private seqCounter = 1048;

  constructor() {
    this.gateways = INITIAL_GATEWAYS.map(gw => ({
      ...gw,
      recentPackets: []
    }));
    // Seed initial history
    for (let i = 0; i < 15; i++) {
      this.generatePacket(true);
    }
  }

  public getGateways(): LoRaGatewayInfo[] {
    return this.gateways;
  }

  public getPacketHistory(): LoRaPacket[] {
    return this.packetHistory;
  }

  public tick2s(): { newPacket: LoRaPacket; updatedGateways: LoRaGatewayInfo[] } {
    this.seqCounter++;
    const newPacket = this.generatePacket(false);

    // Increment gateway stats
    const gw = this.gateways.find(g => g.id === newPacket.gatewayId);
    if (gw) {
      gw.rxPackets++;
      gw.rssi = newPacket.rssi;
      gw.snr = newPacket.snr;
      gw.recentPackets = [newPacket, ...gw.recentPackets].slice(0, 30);
      // Small random walk on duty cycle
      gw.dutyCyclePercent = Math.max(0.05, Math.min(0.95, Math.round((gw.dutyCyclePercent + (Math.random() - 0.5) * 0.04) * 100) / 100));
    }

    return {
      newPacket,
      updatedGateways: this.gateways
    };
  }

  private generatePacket(isHistorySeed = false): LoRaPacket {
    const dev = LORA_DEVICES[Math.floor(Math.random() * LORA_DEVICES.length)];
    const gw = this.gateways[Math.floor(Math.random() * this.gateways.length)];
    const sf = dev.sfRange[0] + Math.floor(Math.random() * (dev.sfRange[1] - dev.sfRange[0] + 1));
    const freq = dev.channels[Math.floor(Math.random() * dev.channels.length)];
    const payload = dev.generate(this.seqCounter);
    
    // RF Calculation
    const airtimeMs = calculateAirtime(payload.sizeBytes, sf, 125, 1);
    
    // Distance-based RSSI estimate between gateway and hypothetical sensor
    const baseRssi = -55 - (sf - 7) * 10 - Math.floor(Math.random() * 18);
    const snr = Math.round((12.5 - (sf - 7) * 3.5 - Math.random() * 4) * 10) / 10;
    
    let signalQuality: LoRaPacket['analysis']['signalQuality'] = 'Dobra';
    let qualityColor = '#22c55e';
    if (baseRssi > -65 && snr > 8) {
      signalQuality = 'Odlična';
      qualityColor = '#10b981';
    } else if (baseRssi > -80 && snr > 4) {
      signalQuality = 'Dobra';
      qualityColor = '#22c55e';
    } else if (baseRssi > -100 && snr > -2) {
      signalQuality = 'Zmerna';
      qualityColor = '#eab308';
    } else if (baseRssi > -115 && snr > -10) {
      signalQuality = 'Mejna';
      qualityColor = '#f97316';
    } else {
      signalQuality = 'Šibka';
      qualityColor = '#ef4444';
    }

    const linkBudget = Math.round(14 + 3.5 + 2.15 - baseRssi); // Tx + Gtx + Grx - RSSI
    const margin = snr >= 0 ? `+${snr} dB nad pragom šuma` : `${snr} dB (demodulacija pod ravnjo šuma z LoRa CSS)`;

    const timestamp = isHistorySeed 
      ? new Date(Date.now() - (15 - (this.packetHistory.length % 15)) * 12000)
      : new Date();

    const packet: LoRaPacket = {
      id: `pkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      gatewayId: gw.id,
      gatewayName: gw.name,
      devEui: dev.devEui,
      deviceName: dev.name,
      deviceType: dev.type,
      frequencyMHz: freq,
      sf,
      bandwidthKHz: 125,
      cr: '4/5',
      rssi: baseRssi,
      snr,
      airtimeMs,
      fCnt: this.seqCounter,
      payloadHex: payload.hex,
      decoded: payload.decoded,
      analysis: {
        signalQuality,
        qualityColor,
        sfMeaning: `SF${sf} zagotavlja ${Math.pow(2, sf)} čipov/simbol. Čas v zraku: ${airtimeMs} ms.`,
        airtimeCompliance: airtimeMs < 100 ? 'Skladno z ETSI 1% Fair Access (<30s/dan)' : 'Zmerna poraba pasovne širine',
        linkBudgetDb: linkBudget,
        noiseFloorMargin: margin
      }
    };

    this.packetHistory = [packet, ...this.packetHistory].slice(0, 100);
    return packet;
  }
}

export const globalLoRaWANEngine = new LoRaWANEngine();
