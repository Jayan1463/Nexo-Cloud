import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter,
  MoreVertical,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, query, where, onSnapshot, db, handleFirestoreError, OperationType } from '../firebase';
import { useAppStore } from '../store';
import { Alert } from '../types';

export const Alerts = () => {
  const { currentProjectId } = useAppStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!currentProjectId) return;

    const alertsQuery = query(
      collection(db, `projects/${currentProjectId}/alerts`)
    );

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const alertList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      // Sort by timestamp descending
      const sorted = alertList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAlerts(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${currentProjectId}/alerts`);
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  const filteredAlerts = alerts.filter(alert => {
    if (activeFilter === 'all') return true;
    return alert.status === activeFilter;
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Alert Management</h1>
          <p className="text-zinc-500 mt-1">Monitor and respond to system incidents</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 px-4 py-2 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            Configure Rules
          </button>
          <button className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-400 transition-colors">
            Integrations
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-white/5 pb-4">
            <FilterTab label="All Alerts" count={alerts.length} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
            <FilterTab label="Active" count={alerts.filter(a => a.status === 'active').length} active={activeFilter === 'active'} onClick={() => setActiveFilter('active')} />
            <FilterTab label="Resolved" count={alerts.filter(a => a.status === 'resolved').length} active={activeFilter === 'resolved'} onClick={() => setActiveFilter('resolved')} />
          </div>

          <div className="space-y-3">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((alert) => (
                <AlertCard key={alert.id} {...alert} />
              ))
            ) : (
              <div className="py-20 text-center border border-dashed border-zinc-200 dark:border-white/5 rounded-2xl">
                <Bell className="w-12 h-12 text-zinc-300 dark:text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 text-sm">No alerts found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl p-6 shadow-sm dark:shadow-none">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Alert Distribution</h3>
            <div className="space-y-4">
              <SeverityStat label="Critical" count={criticalCount} color="bg-red-500" />
              <SeverityStat label="Warning" count={warningCount} color="bg-amber-500" />
              <SeverityStat label="Info" count={infoCount} color="bg-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl p-6 shadow-sm dark:shadow-none">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Notification Channels</h3>
            <div className="space-y-4">
              <ChannelItem name="Slack (#ops-alerts)" status="connected" />
              <ChannelItem name="Email (Team)" status="connected" />
              <ChannelItem name="PagerDuty" status="disconnected" />
              <ChannelItem name="Webhooks" status="connected" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FilterTab = ({ label, count, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
      active ? "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    )}
  >
    {label}
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded-md font-bold",
      active ? "bg-emerald-500 text-zinc-950" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
    )}>
      {count}
    </span>
  </button>
);

const AlertCard = ({ severity, message, timestamp, status }: Alert) => (
  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-white/10 transition-all group cursor-pointer shadow-sm dark:shadow-none">
    <div className="flex items-start gap-4">
      <div className={cn(
        "p-2 rounded-lg",
        severity === 'critical' ? 'bg-red-500/10 text-red-500' : 
        severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
      )}>
        {severity === 'critical' ? <AlertTriangle className="w-5 h-5" /> : 
         severity === 'warning' ? <Bell className="w-5 h-5" /> : <Info className="w-5 h-5" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
              status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
            )}>
              {status}
            </span>
          </div>
          <span className="text-xs text-zinc-500">{new Date(timestamp).toLocaleString()}</span>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-200 font-medium">{message}</p>
      </div>
      <button className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100">
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const SeverityStat = ({ label, count, color }: any) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
    </div>
    <span className="text-xs font-mono text-zinc-500">{count}</span>
  </div>
);

const ChannelItem = ({ name, status }: any) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-500 dark:text-zinc-400">{name}</span>
    <div className={cn(
      "w-1.5 h-1.5 rounded-full",
      status === 'connected' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
    )} />
  </div>
);
