import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, Activity } from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

interface MetricChartProps {
  data: any[];
  type: 'cpu' | 'memory' | 'network' | 'disk';
  title: string;
  color?: string;
}

export const MetricChart: React.FC<MetricChartProps> = ({ data, type, title, color = '#10b981' }) => {
  const { theme } = useAppStore();
  const lastValue = data[data.length - 1]?.value || 0;
  const avgValue = data.reduce((acc, d) => acc + d.value, 0) / (data.length || 1);

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] p-10 shadow-xl dark:shadow-none backdrop-blur-xl group transition-all hover:border-emerald-500/30 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between mb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-emerald-500" />
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">{title}</h3>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              {lastValue.toFixed(1)}
            </span>
            <span className="text-sm font-black text-zinc-400 uppercase tracking-widest">{type === 'network' ? 'MB/s' : '%'}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 shadow-sm">
            <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]", {
              "bg-emerald-500": lastValue < 80,
              "bg-amber-500": lastValue >= 80 && lastValue < 95,
              "bg-red-500": lastValue >= 95,
            })} />
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Real-time Feed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Average</span>
            <span className="text-xs font-black text-zinc-900 dark:text-white">{avgValue.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      
      <div className="h-[280px] w-full -mx-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="8 8" 
              stroke={theme === 'dark' ? "#ffffff03" : "#00000003"} 
              vertical={false} 
            />
            <XAxis 
              dataKey="timestamp" 
              hide 
            />
            <YAxis 
              domain={[0, type === 'network' ? 'auto' : 100]} 
              hide 
            />
            <Tooltip 
              cursor={{ stroke: theme === 'dark' ? '#ffffff10' : '#00000010', strokeWidth: 2 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-zinc-900 dark:bg-white border border-white/10 dark:border-zinc-200 p-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
                    >
                      <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] mb-2">
                        {format(payload[0].payload.timestamp, 'HH:mm:ss')}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <p className="text-2xl font-black text-white dark:text-zinc-950 tracking-tighter">
                          {(payload[0].value as number).toFixed(2)}
                          <span className="text-xs ml-1 font-bold opacity-50">{type === 'network' ? ' MB/s' : '%'}</span>
                        </p>
                      </div>
                    </motion.div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              fillOpacity={1} 
              fill={`url(#gradient-${type})`} 
              strokeWidth={4}
              isAnimationActive={true}
              animationDuration={1500}
              dot={false}
              activeDot={{ r: 8, strokeWidth: 4, stroke: theme === 'dark' ? '#18181b' : '#ffffff', fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Minimum</span>
            <span className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
              {data.length > 0 ? Math.min(...data.map(d => d.value)).toFixed(1) : '0.0'}
              <span className="text-[10px] ml-1 opacity-50">%</span>
            </span>
          </div>
          <div className="w-px h-10 bg-zinc-100 dark:bg-white/5" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Maximum</span>
            <span className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
              {data.length > 0 ? Math.max(...data.map(d => d.value)).toFixed(1) : '0.0'}
              <span className="text-[10px] ml-1 opacity-50">%</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-emerald-500 bg-emerald-500/10 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-500/10 shadow-sm">
          <TrendingUp className="w-4 h-4" />
          Cluster Stable
        </div>
      </div>
    </motion.div>
  );
};
