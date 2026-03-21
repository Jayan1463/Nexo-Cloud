import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Terminal, 
  Filter, 
  Download, 
  Play, 
  Pause,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

import { collection, query, where, onSnapshot, db, handleFirestoreError, OperationType } from '../firebase';
import { useAppStore } from '../store';

export const Logs = () => {
  const { currentProjectId } = useAppStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentProjectId || isPaused) return;

    const logsQuery = query(
      collection(db, `projects/${currentProjectId}/logs`),
      // orderBy('timestamp', 'desc'), // Index needed
      // limit(100)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
        };
      });
      
      // Sort manually since we don't have an index yet
      const sorted = logList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setLogs(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${currentProjectId}/logs`);
    });

    return () => unsubscribe();
  }, [currentProjectId, isPaused]);

  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         log.service.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Log Explorer</h1>
          <p className="text-zinc-500 mt-1">Real-time system logs and event streaming</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 pl-10 pr-4 py-2 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors w-64 shadow-sm dark:shadow-none"
            />
          </div>
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
              isPaused 
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/5 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors shadow-sm dark:shadow-none">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-sm dark:shadow-2xl">
        <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-3 border-b border-zinc-200 dark:border-white/5 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Streaming</span>
          </div>
          <div className="h-4 w-px bg-zinc-200 dark:bg-white/10" />
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Level:</span>
              <select 
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as any)}
                className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors border-none focus:ring-0 cursor-pointer"
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-1 selection:bg-emerald-500/30"
        >
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-4 py-0.5 group hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors rounded px-2">
                <span className="text-zinc-500 shrink-0">{log.timestamp.toLocaleTimeString()}</span>
                <span className={cn(
                  "uppercase font-bold w-12 shrink-0",
                  log.level === 'error' ? 'text-red-500' : 
                  log.level === 'warn' ? 'text-amber-500' : 'text-emerald-500'
                )}>
                  {log.level}
                </span>
                <span className="text-blue-500 dark:text-blue-400 shrink-0">[{log.service}]</span>
                <span className="text-zinc-700 dark:text-zinc-300">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 italic">
              No logs found matching your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FilterBadge = ({ label }: { label: string }) => (
  <button className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors">
    {label}
    <ChevronRight className="w-3 h-3 rotate-90" />
  </button>
);
