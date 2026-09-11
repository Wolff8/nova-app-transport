import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Clock, Info, ShieldAlert } from 'lucide-react';
import { TelemetryLogEntry } from '../types';

interface AlertSystemProps {
  logs: TelemetryLogEntry[];
}

interface ToastAlert {
  id: string;
  type: 'delay' | 'congestion' | 'incident' | 'general';
  message: string;
  nodeName: string;
}

export const AlertSystem: React.FC<AlertSystemProps> = ({ logs }) => {
  const [alerts, setAlerts] = useState<ToastAlert[]>([]);

  useEffect(() => {
    if (logs.length === 0) return;
    const latestLog = logs[0];
    
    // Check if this log has already triggered an alert recently
    const textToSearch = `${latestLog.summary} ${latestLog.nodeName} ${JSON.stringify(latestLog.raw)}`.toLowerCase();
    
    let type: ToastAlert['type'] | null = null;
    let icon = Info;

    if (textToSearch.includes('zamuda') || textToSearch.includes('delay')) {
      type = 'delay';
    } else if (textToSearch.includes('zastoj') || textToSearch.includes('congestion')) {
      type = 'congestion';
    } else if (textToSearch.includes('nesreča') || textToSearch.includes('incident') || textToSearch.includes('ovira')) {
      type = 'incident';
    }

    if (type) {
      const newAlert: ToastAlert = {
        id: latestLog.id + '-' + Date.now(),
        type,
        message: latestLog.summary || 'Zaznan kritičen dogodek v telemetriji',
        nodeName: latestLog.nodeName
      };

      setAlerts(prev => {
        // Prevent duplicate spam for the same node
        if (prev.some(a => a.nodeName === newAlert.nodeName && a.type === newAlert.type)) {
          return prev;
        }
        return [newAlert, ...prev].slice(0, 5); // Keep max 5 visible
      });
    }
  }, [logs]);

  // Auto-remove alerts after 6 seconds
  useEffect(() => {
    if (alerts.length > 0) {
      const timer = setTimeout(() => {
        setAlerts(prev => prev.slice(0, prev.length - 1));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const getAlertConfig = (type: ToastAlert['type']) => {
    switch (type) {
      case 'incident': return { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'congestion': return { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
      case 'delay': return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
      default: return { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none w-80">
      <AnimatePresence>
        {alerts.map(alert => {
          const config = getAlertConfig(alert.type);
          const Icon = config.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-3 rounded-lg shadow-lg border backdrop-blur-md pointer-events-auto cursor-pointer flex items-start gap-3 ${config.bg} ${config.border}`}
              onClick={() => removeAlert(alert.id)}
            >
              <div className={`mt-0.5 \${config.color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-text-dim mb-0.5">
                  {alert.type === 'incident' ? 'Nujni Dogodek' : alert.type === 'congestion' ? 'Zastoj na trasi' : 'Zamuda'}
                </div>
                <div className="text-sm font-semibold text-white leading-tight">
                  {alert.nodeName}
                </div>
                <div className="text-xs text-text-main mt-1 line-clamp-2">
                  {alert.message}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
