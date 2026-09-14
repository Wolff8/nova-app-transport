import React, { useState } from 'react';
import { X, Cpu, Wifi, Database, Code, Radio, Server, Map } from 'lucide-react';

interface DeveloperDocsModalProps {
  onClose: () => void;
}

export const DeveloperDocsModal: React.FC<DeveloperDocsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'esp32' | 'cits' | 'sparql'>('esp32');
  const [sparqlResult, setSparqlResult] = useState<string | null>(null);
  const [loadingSparql, setLoadingSparql] = useState(false);

  const runSparqlTest = async () => {
    setLoadingSparql(true);
    try {
      // Direct call to official ERA RINF-Plus SPARQL endpoint (or local proxy)
      const res = await fetch('/api/rinf/stations');
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      setSparqlResult(JSON.stringify(data.slice(0, 5), null, 2));
    } catch (e) {
      setSparqlResult(String(e));
    }
    setLoadingSparql(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-dark w-full max-w-4xl border border-white/10 rounded-xl shadow-2xl flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Code size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Arhitektura & API Integracije</h2>
              <p className="text-xs text-text-dim">C-ITS, SPARQL, in ESP32-C5 (RISC-V) povezljivost</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-dim hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-56 border-r border-white/10 bg-black/20 p-2 space-y-1 overflow-y-auto">
            <button 
              onClick={() => setActiveTab('esp32')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === 'esp32' ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-text-main hover:bg-white/5'}`}
            >
              <Cpu size={16} />
              ESP32-C5 (Wi-Fi 6)
            </button>
            <button 
              onClick={() => setActiveTab('cits')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === 'cits' ? 'bg-green-500/20 text-green-400 font-medium' : 'text-text-main hover:bg-white/5'}`}
            >
              <Radio size={16} />
              C-ITS & C-Roads API
            </button>
            <button 
              onClick={() => setActiveTab('sparql')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === 'sparql' ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-text-main hover:bg-white/5'}`}
            >
              <Database size={16} />
              SPARQL (ERA / TEN-T)
            </button>
          </div>

          {/* Tab Panels */}
          <div className="flex-1 p-6 overflow-y-auto bg-surface-dark">
            {activeTab === 'esp32' && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Cpu size={24} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Integracija ESP32-C5 (RISC-V)</h3>
                    <p className="text-sm text-text-main leading-relaxed">
                      Vaš <strong>ESP32-C5 Dual-Band Wi-Fi 6</strong> (240MHz RISC-V) modul je idealen za C-ITS (Cooperative Intelligent Transport Systems) On-Board Unit (OBU) ali stacionarni senzor. Wi-Fi 6 (802.11ax) zagotavlja nizko latenco in visoko gostoto, kar je ključno za <strong>V2X komunikacijo</strong>. Podatke lahko pošilja preko MQTT direktno v naš nadzorni center.
                    </p>
                  </div>
                </div>
                <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-text-dim">esp32_cits_client.cpp</span>
                    <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">C++ / Arduino</span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto">
{`#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ESP32-C5 Wi-Fi 6 Configuration
const char* ssid = "<WIFI_SSID>";
const char* password = "<WIFI_PASSWORD>";
const char* mqtt_server = "cits.broker.example.com"; // C-Roads AMQP/MQTT broker

WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  // ESP32-C5 specific Wi-Fi 6 optimizacije se vklopijo avtomatsko v ESP-IDF v5+
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void send_cam_message() {
  // Generiranje C-ITS CAM (Cooperative Awareness Message) standardiziranega sporočila
  StaticJsonDocument<200> doc;
  doc["stationID"] = "ESP32C5_OBU_001";
  doc["type"] = "vehicle";
  doc["lat"] = 46.6592;
  doc["lon"] = 16.1664;
  doc["speed_kmh"] = 42.5;
  doc["heading"] = 180;
  
  char output[200];
  serializeJson(doc, output);
  
  // Publikacija na MQTT (v praksi C-Roads uporablja specifične IF2/IF3 topic-e)
  client.publish("cits/v2x/cam/slovenia", output);
}`}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'cits' && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><Radio size={24} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">C-Roads Slovenia & C-ITS API</h3>
                    <p className="text-sm text-text-main leading-relaxed mb-4">
                      V Sloveniji projekt <strong>C-Roads (DARS, Promet.si)</strong> uporablja standardizirane evropske C-ITS profile. Podatki (npr. GLOSA semaforji, delo na cesti) ne potekajo preko klasičnega REST API-ja, temveč preko <strong>AMQP (Advanced Message Queuing Protocol)</strong> in <strong>MQTT</strong> brokerjev.
                    </p>
                    <ul className="space-y-2 text-sm text-text-main list-disc list-inside">
                      <li><strong>IF2 / IF3 Vmesniki:</strong> To so uradni vmesniki za izmenjavo podatkov med C-ITS centralo in zunanjimi sistemi (kot je vaš ESP32).</li>
                      <li><strong>Format podatkov:</strong> Sporočila so kodirana po standardih ETSI (npr. DENM, CAM, SPAT, MAP). Za branje teh rabi sistem ASN.1 dekoder.</li>
                      <li><strong>Dostop v živo:</strong> Za popoln produkcijski dostop do DARS C-ITS AMQP brokerja je običajno potreben dogovor/NDA z nacionalnim upravljavcem (DARS/Direkcija za infrastrukturo). Vendar se agregirani podatki pojavljajo na <strong>Nacionalni točki dostopa (NAP - nap.si)</strong>, platforma x4its.eu pa skrbi za čezmejno izmenjavo.</li>
                      <li><strong>GIoTo (Telos):</strong> Platforme kot je iot.telos.si (GIoTo) uporabljajo MQTT in LoRaWAN Network Serverje (npr. ChirpStack, TTN) za agregacijo senzorjev preden podatke posredujejo v nadzorno ploščo. Vaš ESP32 se lahko poveže nanje kot MQTT klient.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sparql' && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400"><Database size={24} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">SPARQL, ERA RINF & TEN-T (Evropske Železnice)</h3>
                    <p className="text-sm text-text-main leading-relaxed mb-4">
                      Za infrastrukturo (železniške proge SectionOfLine, operativne točke in postaje OperationalPoint) Evropska agencija za železnice (ERA) ponuja uradni <strong>RINF-Plus Knowledge Graph</strong> (<code className="text-xs text-purple-300">graph.data.era.europa.eu</code>). Z uporabo <strong>SPARQL</strong> poizvedb aplikacija v realnem času zajema celotno slovensko železniško topologijo SŽ.
                    </p>
                    
                    <div className="bg-black/50 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-white">Live SPARQL Test (ERA RINF-Plus)</span>
                        <button 
                          onClick={runSparqlTest}
                          disabled={loadingSparql}
                          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors"
                        >
                          {loadingSparql ? 'Poizvedovanje...' : 'Zaženi poizvedbo'}
                        </button>
                      </div>
                      
                      {sparqlResult && (
                        <div className="mt-3">
                          <div className="text-[10px] text-text-dim mb-1 uppercase tracking-wider">Rezultat:</div>
                          <pre className="p-3 bg-black/80 rounded border border-white/5 text-xs font-mono text-purple-300 max-h-48 overflow-y-auto">
                            {sparqlResult}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
