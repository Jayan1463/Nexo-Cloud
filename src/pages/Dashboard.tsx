import React, { useState, useEffect } from 'react';
import { MetricChart } from '../components/MetricChart';
import { 
  Activity, 
  Cpu, 
  Database, 
  Globe, 
  TrendingUp, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  ChevronDown
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, db, where, handleFirestoreError, OperationType } from '../firebase';
import { Metric, Alert, Server as ServerType, ServerMetric } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { InviteModal } from '../components/InviteModal';
import { useAppStore } from '../store';

import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';

export const Dashboard = () => {
  const { currentProjectId } = useAppStore();
  const [cpuData, setCpuData] = useState<any[]>([]);
  const [memData, setMemData] = useState<any[]>([]);
  const [netData, setNetData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [servers, setServers] = useState<ServerType[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | 'all'>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Fetch servers for the current project
  useEffect(() => {
    if (!currentProjectId) return;

    const q = query(
      collection(db, 'servers'),
      where('projectId', '==', currentProjectId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serverList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerType));
      setServers(serverList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'servers');
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  // Fetch alerts for the current project
  useEffect(() => {
    if (!currentProjectId) return;

    const q = query(
      collection(db, `projects/${currentProjectId}/alerts`),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertList = snapshot.docs.map(doc => doc.data() as Alert);
      setAlerts(alertList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `projects/${currentProjectId}/alerts`);
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  // Fetch real metrics
  useEffect(() => {
    if (!currentProjectId) return;

    let q;
    if (selectedServerId === 'all') {
      const activeServer = servers.find(s => s.status === 'online');
      if (!activeServer) {
        setCpuData([]);
        setMemData([]);
        setNetData([]);
        return;
      }
      q = query(
        collection(db, `servers/${activeServer.id}/metrics`),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    } else {
      q = query(
        collection(db, `servers/${selectedServerId}/metrics`),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const metrics = snapshot.docs.map(doc => doc.data() as ServerMetric).reverse();
      
      const formatTimestamp = (ts: any) => {
        if (ts instanceof Date) return ts;
        if (typeof ts === 'string') return new Date(ts);
        if (ts?.toDate) return ts.toDate();
        return new Date();
      };

      setCpuData(metrics.map(m => ({ 
        timestamp: formatTimestamp(m.timestamp), 
        value: m.cpu 
      })));
      setMemData(metrics.map(m => ({ 
        timestamp: formatTimestamp(m.timestamp), 
        value: m.memory 
      })));
      setNetData(metrics.map(m => ({ 
        timestamp: formatTimestamp(m.timestamp), 
        value: m.network 
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, selectedServerId === 'all' ? 'metrics' : `servers/${selectedServerId}/metrics`);
      setCpuData([]);
      setMemData([]);
      setNetData([]);
    });

    return () => unsubscribe();
  }, [selectedServerId, currentProjectId, servers]);

  const activeNodes = servers.filter(s => s.status === 'online').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  const avgThroughput = netData.length > 0 
    ? (netData.reduce((acc, curr) => acc + curr.value, 0) / netData.length)
    : 0;

  return (
    <div className="p-8 space-y-10 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-[0.2em]">
            <Activity className="w-4 h-4" />
            Live Infrastructure
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-white">System Overview</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-xl">
            Real-time monitoring across {servers.length} nodes. System health is currently <span className="text-emerald-500 font-bold">Optimal</span>.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white px-5 py-3 pr-12 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer shadow-sm"
            >
              <option value="all">Global Infrastructure</option>
              {servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none group-hover:text-emerald-500 transition-colors" />
          </div>

          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-6 py-3 rounded-2xl text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
          >
            Invite Team
          </button>
        </div>
      </div>

      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Network Throughput" 
          value={`${avgThroughput.toFixed(1)}`}
          unit="MB/s"
          data={netData}
          trend="+12.5%" 
          trendUp={true} 
          icon={Globe} 
          color="emerald" 
        />
        <StatCard 
          title="Avg Latency" 
          value={netData.length > 0 ? `${(netData[netData.length-1].value / 2).toFixed(0)}` : "0"} 
          unit="ms"
          data={netData.map(d => ({ ...d, value: d.value / 2 }))}
          trend="-4.2%" 
          trendUp={false} 
          icon={Activity} 
          color="blue" 
        />
        <StatCard 
          title="Active Nodes" 
          value={activeNodes.toString()} 
          unit={`/ ${servers.length}`}
          data={[]} // No sparkline for static count
          trend="Stable" 
          trendUp={true} 
          icon={Database} 
          color="purple" 
        />
        <StatCard 
          title="Critical Alerts" 
          value={criticalAlerts.toString()} 
          unit="Active"
          data={[]}
          trend={alerts.length > 0 ? "Action Required" : "All Clear"} 
          trendUp={criticalAlerts === 0} 
          icon={AlertCircle} 
          color="red" 
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MetricChart title="CPU Utilization" type="cpu" data={cpuData} color="#10b981" />
        <MetricChart title="Memory Usage" type="memory" data={memData} color="#3b82f6" />
        <MetricChart title="Network Throughput" type="network" data={netData} color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Alerts */}
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2rem] p-8 shadow-sm dark:shadow-none backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Recent Alerts</h3>
              <p className="text-xs text-zinc-500 font-medium">Real-time anomaly detection</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">View History</button>
          </div>
          <div className="space-y-2">
            {alerts.length > 0 ? (
              alerts.map((alert, idx) => (
                <AlertItem 
                  key={idx}
                  severity={alert.severity} 
                  message={alert.message} 
                  time={new Date(alert.timestamp).toLocaleTimeString()} 
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">No active alerts detected.</p>
              </div>
            )}
          </div>
        </div>

        {/* Cost Forecast */}
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] p-10 shadow-sm dark:shadow-none backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700" />
          
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Cost Intelligence</h3>
              <p className="text-xs text-zinc-500 font-medium">Projected resource expenditure</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
          </div>

          <div className="space-y-12 relative z-10">
            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Estimated Monthly Spend</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">${(servers.length * 45).toLocaleString()}</span>
                  <span className="text-2xl font-bold text-zinc-400 dark:text-zinc-600">.00</span>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-500 font-black text-xl">
                  <ArrowUpRight className="w-6 h-6" /> 2.4%
                </div>
                <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">vs last month</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <CostBar label="Compute Resources" percentage={70} color="bg-emerald-500" />
              <CostBar label="Storage Systems" percentage={20} color="bg-blue-500" />
              <CostBar label="Networking Fabric" percentage={10} color="bg-purple-500" />
            </div>

            <div className="pt-8 border-t border-zinc-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex -space-x-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center overflow-hidden">
                    <img src={`https://picsum.photos/seed/user${i}/32/32`} alt="User" referrerPolicy="no-referrer" />
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-950">+5</div>
              </div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Shared with 8 team members</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, unit, data, trend, trendUp, icon: Icon, color }: any) => {
  const colorClasses = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5",
    purple: "text-purple-500 bg-purple-500/10 border-purple-500/20 shadow-purple-500/5",
    red: "text-red-500 bg-red-500/10 border-red-500/20 shadow-red-500/5"
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] p-8 hover:border-emerald-500/30 transition-all group shadow-sm dark:shadow-none backdrop-blur-xl relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none",
        color === 'emerald' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-500' : color === 'purple' ? 'bg-purple-500' : 'bg-red-500'
      )} />

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className={cn("p-4 rounded-2xl border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg", colorClasses[color as keyof typeof colorClasses])}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl border transition-colors",
          trendUp 
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
            : "bg-red-500/10 text-red-500 border-red-500/20"
        )}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      
      <div className="space-y-2 relative z-10">
        <h3 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{value}</span>
          <span className="text-sm font-bold text-zinc-400 dark:text-zinc-600">{unit}</span>
        </div>
      </div>

      {/* Sparkline */}
      {data && data.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-20 opacity-20 group-hover:opacity-40 transition-all duration-700 translate-y-2 group-hover:translate-y-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : '#8b5cf6'} stopOpacity={0.5}/>
                  <stop offset="95%" stopColor={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : '#8b5cf6'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : '#8b5cf6'} 
                strokeWidth={3} 
                fillOpacity={1} 
                fill={`url(#gradient-${color})`} 
                isAnimationActive={true}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
};

const AlertItem = ({ severity, message, time }: any) => (
  <motion.div 
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center gap-5 p-5 rounded-[1.5rem] hover:bg-zinc-100 dark:hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-zinc-200 dark:hover:border-white/10 shadow-sm hover:shadow-md"
  >
    <div className="relative">
      <div className={cn(
        "w-3 h-3 rounded-full shrink-0 animate-pulse relative z-10",
        severity === 'critical' ? 'bg-red-500' : 
        severity === 'warning' ? 'bg-amber-500' : 
        'bg-blue-500'
      )} />
      <div className={cn(
        "absolute inset-0 rounded-full blur-md animate-ping opacity-40",
        severity === 'critical' ? 'bg-red-500' : 
        severity === 'warning' ? 'bg-amber-500' : 
        'bg-blue-500'
      )} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-950 dark:group-hover:text-white transition-colors tracking-tight">{message}</p>
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-zinc-400" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{time}</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <span className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
          severity === 'critical' ? 'text-red-500 border-red-500/20 bg-red-500/5' : 
          severity === 'warning' ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' : 
          'text-blue-500 border-blue-500/20 bg-blue-500/5'
        )}>
          {severity}
        </span>
      </div>
    </div>
    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
      <ChevronRight className="w-5 h-5 text-emerald-500" />
    </div>
  </motion.div>
);

const CostBar = ({ label, percentage, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-900 dark:text-white">{percentage}%</span>
    </div>
    <div className="h-2 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className={cn("h-full rounded-full shadow-lg", color)} 
      />
    </div>
  </div>
);

import { CheckCircle2, ChevronRight } from 'lucide-react';
