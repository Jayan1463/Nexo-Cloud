import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Filter, 
  Download, 
  Calendar,
  Search,
  MoreVertical,
  ChevronDown,
  Activity,
  Cpu,
  Database,
  ArrowUpRight,
  TrendingUp,
  Zap,
  Layers,
  Server
} from 'lucide-react';
import { MetricChart } from '../components/MetricChart';
import { cn } from '../lib/utils';
import { collection, query, orderBy, limit, onSnapshot, db, where, handleFirestoreError, OperationType } from '../firebase';
import { Server as ServerType, ServerMetric } from '../types';
import { useAppStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

export const Analytics = () => {
  const { currentProjectId } = useAppStore();
  const [cpuData, setCpuData] = useState<any[]>([]);
  const [memData, setMemData] = useState<any[]>([]);
  const [netData, setNetData] = useState<any[]>([]);
  const [servers, setServers] = useState<ServerType[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

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
      if (serverList.length > 0 && !selectedServerId) {
        setSelectedServerId(serverList[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'servers');
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  // Fetch real metrics
  useEffect(() => {
    if (!selectedServerId) return;

    const q = query(
      collection(db, `servers/${selectedServerId}/metrics`),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const metrics = snapshot.docs.map(doc => doc.data() as ServerMetric).reverse();
      
      setCpuData(metrics.map(m => ({ 
        timestamp: typeof m.timestamp === 'string' ? new Date(m.timestamp) : (m.timestamp as any).toDate(), 
        value: m.cpu 
      })));
      setMemData(metrics.map(m => ({ 
        timestamp: typeof m.timestamp === 'string' ? new Date(m.timestamp) : (m.timestamp as any).toDate(), 
        value: m.memory 
      })));
      setNetData(metrics.map(m => ({ 
        timestamp: typeof m.timestamp === 'string' ? new Date(m.timestamp) : (m.timestamp as any).toDate(), 
        value: m.network 
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `servers/${selectedServerId}/metrics`);
    });

    return () => unsubscribe();
  }, [selectedServerId]);

  const selectedServer = servers.find(s => s.id === selectedServerId);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => setIsExporting(false), 2000);
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-10 space-y-12 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <Zap className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Performance Intelligence</span>
          </div>
          <h1 className="text-6xl font-black text-zinc-900 dark:text-white tracking-tighter">
            System <span className="text-zinc-400">Analytics</span>
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl font-medium leading-relaxed">
            Real-time telemetry and predictive resource analysis across your global infrastructure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Server Selector */}
          <div className="relative group">
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="appearance-none bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white pl-12 pr-12 py-3.5 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/10 shadow-sm dark:shadow-none w-64"
            >
              {servers.length === 0 && <option value="">No Servers Found</option>}
              {servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
            <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          <button className="flex items-center gap-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 px-6 py-3.5 rounded-2xl text-sm font-black text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all hover:scale-105 active:scale-95 shadow-sm dark:shadow-none">
            <Calendar className="w-4 h-4" />
            Last 24h
          </button>
          
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-8 py-3.5 rounded-2xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-zinc-900/20 dark:shadow-white/10 disabled:opacity-50"
          >
            {isExporting ? (
              <Activity className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? 'Preparing...' : 'Export Data'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Main Charts Area */}
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="xl:col-span-2 space-y-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div variants={item}>
              <MetricChart 
                data={cpuData} 
                type="cpu" 
                title="Processor Load" 
                color="#10b981" 
              />
            </motion.div>
            <motion.div variants={item}>
              <MetricChart 
                data={memData} 
                type="memory" 
                title="Memory Allocation" 
                color="#3b82f6" 
              />
            </motion.div>
            <motion.div variants={item}>
              <MetricChart 
                data={netData} 
                type="network" 
                title="Network Throughput" 
                color="#8b5cf6" 
              />
            </motion.div>
            <motion.div variants={item}>
              <MetricChart 
                data={cpuData} 
                type="disk" 
                title="Disk I/O Performance" 
                color="#f59e0b" 
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Top Resources */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] p-10 shadow-xl dark:shadow-none backdrop-blur-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.07] pointer-events-none">
              <Database className="w-32 h-32" />
            </div>
            
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Top Resources</h3>
              <button className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline">View All</button>
            </div>
            
            <div className="space-y-6">
              {servers.length > 0 ? (
                servers.slice(0, 5).map((server, idx) => (
                  <ResourceItem key={idx} name={server.name} load={Math.floor(Math.random() * 40) + 20} delay={idx * 0.1} />
                ))
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-zinc-500 italic">No resources detected.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Anomaly Insights */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900 dark:bg-white rounded-[2.5rem] p-10 text-white dark:text-zinc-950 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-white/10 dark:bg-zinc-950/10 rounded-2xl">
                  <Activity className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Anomaly Insights</h3>
              </div>
              
              <p className="text-2xl font-black tracking-tighter mb-6 leading-tight">
                No critical <span className="text-emerald-400 dark:text-emerald-600">deviations</span> detected in the last 24h.
              </p>
              
              <button className="flex items-center gap-3 text-xs font-black uppercase tracking-widest group/btn">
                Run Deep Scan
                <ArrowUpRight className="w-4 h-4 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const ResourceItem = ({ name, load, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="group/item"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-black text-zinc-700 dark:text-zinc-300 group-hover/item:text-emerald-500 transition-colors tracking-tight">{name}</span>
      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{load}% Load</span>
    </div>
    <div className="h-2 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${load}%` }}
        transition={{ duration: 1, delay }}
        className={cn(
          "h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]",
          load > 80 ? "bg-red-500" : load > 50 ? "bg-amber-500" : "bg-emerald-500"
        )} 
      />
    </div>
  </motion.div>
);
