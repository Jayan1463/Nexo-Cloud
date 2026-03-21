import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Cloud,
  HardDrive,
  Network,
  Download,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { cn } from '../lib/utils';
import { collection, query, where, onSnapshot, db, orderBy, limit } from '../firebase';
import { useAppStore } from '../store';
import { Server as ServerType, ServerMetric } from '../types';

export const Cost = () => {
  const { currentProjectId } = useAppStore();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [livePieData, setLivePieData] = useState([
    { name: 'Compute', value: 0, color: '#10b981' },
    { name: 'Storage', value: 0, color: '#3b82f6' },
    { name: 'Networking', value: 0, color: '#8b5cf6' },
  ]);
  const [liveBarData, setLiveBarData] = useState([
    { month: 'Oct', amount: 0 },
    { month: 'Nov', amount: 0 },
    { month: 'Dec', amount: 0 },
    { month: 'Jan', amount: 0 },
    { month: 'Feb', amount: 0 },
    { month: 'Mar', amount: 0 },
  ]);

  useEffect(() => {
    if (!currentProjectId) return;

    const q = query(
      collection(db, 'servers'),
      where('projectId', '==', currentProjectId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serverList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerType));
      setServers(serverList);
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  const [avgCostPerServer, setAvgCostPerServer] = useState(45);

  const toDate = (ts: any): Date => {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    if (typeof ts?.toDate === 'function') return ts.toDate();
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    return new Date();
  };

  useEffect(() => {
    if (!servers.length) {
      setLivePieData([
        { name: 'Compute', value: 0, color: '#10b981' },
        { name: 'Storage', value: 0, color: '#3b82f6' },
        { name: 'Networking', value: 0, color: '#8b5cf6' },
      ]);
      setLiveBarData([
        { month: 'Oct', amount: 0 },
        { month: 'Nov', amount: 0 },
        { month: 'Dec', amount: 0 },
        { month: 'Jan', amount: 0 },
        { month: 'Feb', amount: 0 },
        { month: 'Mar', amount: 0 },
      ]);
      return;
    }

    const metricsByServer: Record<string, ServerMetric[]> = {};

    const recompute = () => {
      const serverIds = servers.map((s) => s.id);

      const latestMetrics = serverIds
        .map((serverId) => metricsByServer[serverId]?.[0])
        .filter(Boolean) as ServerMetric[];

      const avgCpu = latestMetrics.length
        ? latestMetrics.reduce((sum, m) => sum + (m.cpu || 0), 0) / latestMetrics.length
        : 0;
      const avgMemory = latestMetrics.length
        ? latestMetrics.reduce((sum, m) => sum + (m.memory || 0), 0) / latestMetrics.length
        : 0;
      const avgNetwork = latestMetrics.length
        ? latestMetrics.reduce((sum, m) => sum + (m.network || 0), 0) / latestMetrics.length
        : 0;

      const resourceTotal = avgCpu + avgMemory + avgNetwork;
      const pie = resourceTotal > 0
        ? [
            { name: 'Compute', value: Math.round((avgCpu / resourceTotal) * 100), color: '#10b981' },
            { name: 'Storage', value: Math.round((avgMemory / resourceTotal) * 100), color: '#3b82f6' },
            { name: 'Networking', value: Math.round((avgNetwork / resourceTotal) * 100), color: '#8b5cf6' },
          ]
        : [
            { name: 'Compute', value: 0, color: '#10b981' },
            { name: 'Storage', value: 0, color: '#3b82f6' },
            { name: 'Networking', value: 0, color: '#8b5cf6' },
          ];
      setLivePieData(pie);

      const now = new Date();
      const months = Array.from({ length: 6 }, (_, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { key, month: d.toLocaleString('en-US', { month: 'short' }) };
      });

      const bar = months.map((m) => {
        let amount = 0;
        for (const serverId of serverIds) {
          const metrics = metricsByServer[serverId] || [];
          const monthMetrics = metrics.filter((metric) => {
            const dt = toDate(metric.timestamp);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            return key === m.key;
          });
          const avgUtilization = monthMetrics.length
            ? monthMetrics.reduce((sum, metric) => sum + (((metric.cpu || 0) + (metric.memory || 0) + (metric.network || 0)) / 3), 0) / monthMetrics.length
            : 0;
          amount += avgCostPerServer * (avgUtilization / 100);
        }
        return { month: m.month, amount: Number(amount.toFixed(2)) };
      });
      setLiveBarData(bar);
    };

    const unsubscribers = servers.map((server) => {
      const metricsQuery = query(
        collection(db, `servers/${server.id}/metrics`),
        orderBy('timestamp', 'desc'),
        limit(500)
      );

      return onSnapshot(metricsQuery, (snapshot) => {
        metricsByServer[server.id] = snapshot.docs.map((doc) => doc.data() as ServerMetric);
        recompute();
      });
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [servers, avgCostPerServer]);

  const monthlySpend = liveBarData[liveBarData.length - 1]?.amount ?? 0;
  const lastMonthSpend = liveBarData[liveBarData.length - 2]?.amount ?? 0;
  const diff = monthlySpend - lastMonthSpend;
  const percentChange = lastMonthSpend > 0 ? ((diff / lastMonthSpend) * 100).toFixed(1) : "0";
  const projectedSavings = monthlySpend * 0.1;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Cost Intelligence</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Predictive analytics and cloud spend optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Avg Cost/Server</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-400">$</span>
              <input 
                type="number" 
                value={avgCostPerServer}
                onChange={(e) => setAvgCostPerServer(parseInt(e.target.value) || 0)}
                className="w-12 bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
          <button className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-4 py-2 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <Download className="w-4 h-4" />
            Download Invoice
          </button>
          <button className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-400 transition-colors">
            Optimize Spend
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CostMetricCard 
          title="Monthly Spend" 
          value={`$${monthlySpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} 
          trend={`${percentChange}%`} 
          trendUp={Number(percentChange) >= 0} 
        />
        <CostMetricCard 
          title="Daily Average" 
          value={`$${(monthlySpend / 30).toFixed(2)}`} 
          trend="+1.2%" 
          trendUp={true} 
        />
        <CostMetricCard 
          title="Projected Savings" 
          value={`$${projectedSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} 
          trend="Actionable" 
          trendUp={true} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">Spend by Resource Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={livePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {livePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {livePieData.map((item) => (
              <div key={item.name} className="text-center">
                <div className="text-xs text-zinc-500 mb-1">{item.name}</div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">{item.value}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">Historical Spend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">Predictive Cost Forecast</h3>
        <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h4 className="text-zinc-900 dark:text-white font-medium">Projected Growth Analysis</h4>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Based on current utilization patterns across your {servers.length} active servers, your infrastructure costs are projected to increase by 8% next month. 
              We recommend reviewing your compute allocation for {servers[0]?.name || 'your primary nodes'} to optimize for cost-efficiency.
            </p>
            <button className="mt-4 text-sm text-blue-500 font-medium hover:text-blue-400 transition-colors">
              View Optimization Recommendations →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CostMetricCard = ({ title, value, trend, trendUp }: any) => (
  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
    <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
    <div className="flex items-end justify-between mt-2">
      <h4 className="text-3xl font-bold text-zinc-900 dark:text-white">{value}</h4>
      <div className={cn(
        "flex items-center gap-1 text-sm font-medium",
        trendUp ? "text-emerald-500" : "text-red-500"
      )}>
        {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        {trend}
      </div>
    </div>
  </div>
);

const ServiceCostItem = ({ icon: Icon, name, amount, percentage, color }: any) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-zinc-500" />
        <span className="text-sm text-zinc-300">{name}</span>
      </div>
      <span className="text-sm font-bold text-white">{amount}</span>
    </div>
    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
      <div 
        className={cn("h-full rounded-full transition-all duration-1000", color)} 
        style={{ width: `${percentage}%` }} 
      />
    </div>
  </div>
);
