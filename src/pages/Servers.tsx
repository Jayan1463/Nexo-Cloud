import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  YAxis, 
  XAxis 
} from 'recharts';
import { 
  Server as ServerIcon, 
  Plus, 
  Terminal, 
  Copy, 
  Check, 
  Activity, 
  Clock, 
  Shield, 
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { useAppStore } from '../store';
import { Server, ServerMetric } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const Servers = () => {
  const { currentOrgId, currentProjectId, setProject } = useAppStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [tags, setTags] = useState<{ key: string, value: string }[]>([{ key: '', value: '' }]);
  const [generatedConfig, setGeneratedConfig] = useState<{ id: string, apiKey: string } | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentProjectId) return;

    const serversQuery = query(
      collection(db, 'servers'),
      where('projectId', '==', currentProjectId)
    );

    const unsubscribe = onSnapshot(serversQuery, (snapshot) => {
      const serverList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Server));
      setServers(serverList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'servers');
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId || !newServerName) return;

    const serverId = Math.random().toString(36).substring(2, 15);
    const apiKey = 'nx_' + Math.random().toString(36).substring(2, 32);

    const tagsObject = tags.reduce((acc, tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        acc[tag.key.trim()] = tag.value.trim();
      }
      return acc;
    }, {} as Record<string, string>);

    const serverRef = doc(db, 'servers', serverId);
    const newServer: Server = {
      id: serverId,
      projectId: currentProjectId,
      name: newServerName,
      apiKey: apiKey,
      status: 'offline',
      createdAt: serverTimestamp(),
      tags: tagsObject
    };

    await setDoc(serverRef, newServer);
    setGeneratedConfig({ id: serverId, apiKey });
    setNewServerName('');
    setTags([{ key: '', value: '' }]);
  };

  const addTag = () => setTags([...tags, { key: '', value: '' }]);
  const removeTag = (index: number) => setTags(tags.filter((_, i) => i !== index));
  const updateTag = (index: number, field: 'key' | 'value', value: string) => {
    const newTags = [...tags];
    newTags[index][field] = value;
    setTags(newTags);
  };

  const handleDeleteServer = async (serverId: string) => {
    await deleteDoc(doc(db, 'servers', serverId));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 space-y-10 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-[0.2em]">
            <ServerIcon className="w-4 h-4" />
            Infrastructure
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-white">Connected Nodes</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-xl">
            Manage and monitor your hybrid cloud infrastructure from a single pane of glass.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-8 py-4 rounded-2xl text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5 flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          Provision Node
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Synchronizing Infrastructure...</p>
        </div>
      ) : servers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-white/10 rounded-[3rem] p-20 text-center shadow-sm dark:shadow-none backdrop-blur-sm">
          <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-950 rounded-[2rem] border border-zinc-200 dark:border-white/5 flex items-center justify-center mx-auto mb-8 shadow-inner">
            <ServerIcon className="w-10 h-10 text-zinc-400 dark:text-zinc-700" />
          </div>
          <h3 className="text-3xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">No nodes detected</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-10 font-medium leading-relaxed">
            Your infrastructure is currently silent. Deploy the Nexo Agent to start streaming real-time telemetry from your servers.
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 text-zinc-950 px-10 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-lg shadow-emerald-500/20"
          >
            Connect your first server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servers.map((server) => (
            <ServerCard 
              key={server.id} 
              server={server} 
              onDelete={() => handleDeleteServer(server.id)} 
              onSelect={() => setSelectedServer(server)}
            />
          ))}
        </div>
      )}


      {/* Add Server Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddModal(false);
                setGeneratedConfig(null);
              }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              {!generatedConfig ? (
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-500 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Plus className="text-zinc-950 w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Provision Node</h2>
                      <p className="text-zinc-500 dark:text-zinc-400 font-medium">Register a new machine to start streaming telemetry</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddServer} className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Node Identifier</label>
                      <div className="relative group">
                        <ServerIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="e.g. production-api-01"
                          value={newServerName}
                          onChange={(e) => setNewServerName(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-4 text-zinc-900 dark:text-white font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Metadata Tags</label>
                        <button 
                          type="button"
                          onClick={addTag}
                          className="flex items-center gap-2 text-[10px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest transition-colors bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10"
                        >
                          <Plus className="w-3 h-3" />
                          Add Tag
                        </button>
                      </div>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                        <AnimatePresence mode="popLayout">
                          {tags.map((tag, index) => (
                            <motion.div 
                              key={index}
                              layout
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex gap-3"
                            >
                              <input 
                                type="text" 
                                placeholder="Key"
                                value={tag.key}
                                onChange={(e) => updateTag(index, 'key', e.target.value)}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
                              />
                              <input 
                                type="text" 
                                placeholder="Value"
                                value={tag.value}
                                onChange={(e) => updateTag(index, 'value', e.target.value)}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
                              />
                              {tags.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeTag(index)}
                                  className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={!newServerName}
                      className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-5 rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5 disabled:opacity-50 disabled:scale-100"
                    >
                      Generate Provisioning Key
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-500 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Terminal className="text-zinc-950 w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Provisioning Ready</h2>
                      <p className="text-zinc-500 dark:text-zinc-400 font-medium">Follow these steps to connect your node</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-5 border border-zinc-200 dark:border-white/5 space-y-2 group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Node ID</span>
                          <button onClick={() => copyToClipboard(generatedConfig.id)} className="text-zinc-400 hover:text-emerald-500 transition-colors">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <code className="text-emerald-500 font-mono text-sm block truncate font-bold">{generatedConfig.id}</code>
                      </div>

                      <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-5 border border-zinc-200 dark:border-white/5 space-y-2 group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">API Key</span>
                          <button onClick={() => copyToClipboard(generatedConfig.apiKey)} className="text-zinc-400 hover:text-emerald-500 transition-colors">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <code className="text-emerald-500 font-mono text-sm block truncate font-bold">{generatedConfig.apiKey}</code>
                      </div>
                    </div>

                    <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">1. Install Nexo Agent</p>
                          <span className="text-[10px] font-bold text-zinc-400">Node.js required</span>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-xl font-mono text-xs text-emerald-500 border border-white/5 flex items-center justify-between group">
                          <code className="font-bold">npm install systeminformation axios</code>
                          <button onClick={() => copyToClipboard('npm install systeminformation axios')} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy className="w-4 h-4 text-zinc-500 hover:text-white" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">2. Deploy Agent Script</p>
                        <div className="bg-zinc-950 p-4 rounded-xl font-mono text-[10px] text-emerald-500 border border-white/5 relative group">
                          <pre className="overflow-x-auto max-h-40 no-scrollbar font-bold leading-relaxed">
{`const si = require('systeminformation');
const axios = require('axios');

const API_KEY = '${generatedConfig.apiKey}';
const SERVER_ID = '${generatedConfig.id}';
const API_URL = '${window.location.origin}/api/metrics';

async function collectAndSend() {
  try {
    const [cpu, mem, net, fs] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
      si.fsSize()
    ]);

    const metrics = {
      serverId: SERVER_ID,
      cpu: Math.round(cpu.currentLoad),
      memory: Math.round((mem.active / mem.total) * 100),
      network: Math.round((net[0].rx_sec + net[0].tx_sec) / 1024),
      disk: Math.round(fs[0].use),
      timestamp: new Date().toISOString()
    };

    await axios.post(API_URL, metrics, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });

    console.log(\`[\${new Date().toLocaleTimeString()}] Metrics sent: CPU \${metrics.cpu}% | MEM \${metrics.memory}%\`);
  } catch (error) {
    console.error(\`❌ Error: \`, error.message);
  }
}

setInterval(collectAndSend, 5000);
collectAndSend();`}
                          </pre>
                          <button 
                            onClick={() => {
                              const script = `const si = require('systeminformation');
const axios = require('axios');

const API_KEY = '${generatedConfig.apiKey}';
const SERVER_ID = '${generatedConfig.id}';
const API_URL = '${window.location.origin}/api/metrics';

async function collectAndSend() {
  try {
    const [cpu, mem, net, fs] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
      si.fsSize()
    ]);

    const metrics = {
      serverId: SERVER_ID,
      cpu: Math.round(cpu.currentLoad),
      memory: Math.round((mem.active / mem.total) * 100),
      network: Math.round((net[0].rx_sec + net[0].tx_sec) / 1024),
      disk: Math.round(fs[0].use),
      timestamp: new Date().toISOString()
    };

    await axios.post(API_URL, metrics, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });

    console.log(\`[\${new Date().toLocaleTimeString()}] Metrics sent: CPU \${metrics.cpu}% | MEM \${metrics.memory}%\`);
  } catch (error) {
    console.error(\`❌ Error: \`, error.message);
  }
}

setInterval(collectAndSend, 5000);
collectAndSend();`;
                              copyToClipboard(script);
                            }} 
                            className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="w-4 h-4 text-zinc-500 hover:text-white" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setShowAddModal(false);
                        setGeneratedConfig(null);
                      }}
                      className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-5 rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
                    >
                      Complete Provisioning
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Server Details Modal */}
      <AnimatePresence>
        {selectedServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedServer(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="space-y-10 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-16 h-16 rounded-[1.25rem] flex items-center justify-center border shadow-lg transition-all duration-700",
                      selectedServer.status === 'online' 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10" 
                        : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-white/5 text-zinc-400 dark:text-zinc-500"
                    )}>
                      <ServerIcon className={cn("w-8 h-8", selectedServer.status === 'online' && "animate-pulse")} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{selectedServer.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-zinc-500 dark:text-zinc-400 font-mono text-xs font-bold">{selectedServer.id}</p>
                        <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          selectedServer.status === 'online' ? "text-emerald-500" : "text-zinc-400"
                        )}>
                          {selectedServer.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedServer(null)}
                    className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-all"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-6 border border-zinc-200 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Provisioned On</p>
                          <Clock className="w-4 h-4 text-zinc-400" />
                        </div>
                        <p className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                          {selectedServer.createdAt ? new Date(selectedServer.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className="text-xs font-bold text-zinc-500">
                          {selectedServer.createdAt ? new Date(selectedServer.createdAt.toDate()).toLocaleTimeString() : ''}
                        </p>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-6 border border-zinc-200 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Last Telemetry</p>
                          <Activity className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                          {selectedServer.lastSeen ? new Date(selectedServer.lastSeen.toDate()).toLocaleTimeString() : 'Never'}
                        </p>
                        <p className="text-xs font-bold text-zinc-500">
                          {selectedServer.status === 'online' ? 'Active Stream' : 'Connection Lost'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-white/5 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Metadata Tags</h3>
                        <span className="text-[10px] font-bold text-zinc-400">{Object.keys(selectedServer.tags || {}).length} Tags</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {selectedServer.tags && Object.entries(selectedServer.tags).length > 0 ? (
                          Object.entries(selectedServer.tags).map(([key, value]) => (
                            <div key={key} className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-xs font-bold text-zinc-500 shadow-sm flex items-center gap-3 group/tag">
                              <span className="text-emerald-500 uppercase tracking-widest text-[9px] font-black">{key}</span>
                              <div className="w-px h-3 bg-zinc-200 dark:bg-white/10" />
                              <span className="text-zinc-900 dark:text-zinc-200">{value}</span>
                            </div>
                          ))
                        ) : (
                          <div className="w-full py-10 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-white/10 rounded-3xl">
                            <p className="text-xs text-zinc-400 italic font-medium">No metadata tags assigned to this node.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-white/5 space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Provisioning Key</p>
                          <button onClick={() => copyToClipboard(selectedServer.apiKey)} className="text-zinc-400 hover:text-emerald-500 transition-colors">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-white/5 relative group">
                          <code className="text-xs text-emerald-500 font-mono block truncate font-bold">{selectedServer.apiKey}</code>
                          <div className="absolute inset-0 bg-zinc-900/80 dark:bg-zinc-950/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Click to copy</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8 border-t border-zinc-200 dark:border-white/5">
                        {!showDeleteConfirm ? (
                          <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full py-4 bg-red-500/5 border border-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
                          >
                            Terminate Node
                          </button>
                        ) : (
                          <div className="space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center leading-relaxed">
                                This action is irreversible. All telemetry data will be purged.
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => {
                                  handleDeleteServer(selectedServer.id);
                                  setSelectedServer(null);
                                  setShowDeleteConfirm(false);
                                }}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                              >
                                Confirm
                              </button>
                              <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Security Audit</span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                        This node is currently protected by Nexo's Zero-Trust mesh. All traffic is encrypted end-to-end.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

const Gauge = ({ value, label, color, icon: Icon }: { value: number, label: string, color: string, icon: any }) => {
  const radius = 32;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 group/gauge">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.05)]"
        >
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset: 0 }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-zinc-100 dark:text-zinc-800"
          />
          <motion.circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-3 h-3 text-zinc-400 mb-0.5" />
          <span className="text-xs font-black text-zinc-900 dark:text-white tracking-tighter">
            {Math.round(value)}%
          </span>
        </div>
        
        {/* Glow effect */}
        <div 
          className="absolute inset-0 rounded-full opacity-0 group-hover/gauge:opacity-20 transition-opacity blur-xl"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
};

const ServerCard = ({ server, onDelete, onSelect }: { server: Server, onDelete: () => void, onSelect: () => void }) => {
  const [metrics, setMetrics] = useState<ServerMetric[]>([]);

  useEffect(() => {
    const metricsQuery = query(
      collection(db, `servers/${server.id}/metrics`),
      where('serverId', '==', server.id),
    );

    const unsubscribe = onSnapshot(metricsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sorted = snapshot.docs
          .map(d => d.data() as ServerMetric)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        setMetrics(sorted.slice(-20));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `servers/${server.id}/metrics`);
    });

    return () => unsubscribe();
  }, [server.id]);

  const latestMetric = metrics[metrics.length - 1];
  const isOnline = server.status === 'online' && 
    server.lastSeen && 
    (new Date().getTime() - server.lastSeen.toDate().getTime() < 15000);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onSelect}
      className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] p-8 hover:border-emerald-500/30 transition-all group shadow-sm dark:shadow-none cursor-pointer flex flex-col h-full relative overflow-hidden backdrop-blur-sm"
    >
      {/* Background Glow */}
      <div className={cn(
        "absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[100px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none",
        isOnline ? "bg-emerald-500" : "bg-zinc-500"
      )} />

      <div className="flex items-start justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-[1.5rem] flex items-center justify-center border transition-all duration-700",
            isOnline 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)]" 
              : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-white/5 text-zinc-400 dark:text-zinc-500"
          )}>
            <ServerIcon className={cn("w-8 h-8", isOnline && "animate-pulse")} />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-zinc-900 dark:text-white group-hover:text-emerald-500 transition-colors text-xl tracking-tight leading-none">{server.name}</h3>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-400 dark:bg-zinc-600")} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                {isOnline ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Prominent Tags */}
      {server.tags && Object.entries(server.tags).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10 relative z-10">
          {Object.entries(server.tags).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl shadow-sm">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{key}</span>
              <div className="w-px h-3 bg-zinc-200 dark:bg-white/10" />
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-10 flex-1 relative z-10">
        <div className="flex items-center justify-around py-4 bg-zinc-50/50 dark:bg-zinc-950/30 rounded-[2rem] border border-zinc-100 dark:border-white/5">
          <Gauge 
            value={isOnline ? (latestMetric?.cpu || 0) : 0} 
            label="CPU Load" 
            color="#10b981" 
            icon={Activity}
          />
          <div className="w-px h-12 bg-zinc-200 dark:bg-white/10" />
          <Gauge 
            value={isOnline ? (latestMetric?.memory || 0) : 0} 
            label="Memory" 
            color="#3b82f6" 
            icon={Shield}
          />
        </div>

        <div className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-white/5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Network Throughput</span>
          </div>
          <span className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">
            {isOnline ? `${latestMetric?.network.toFixed(1)} MB/s` : '--'}
          </span>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {server.lastSeen ? `Seen ${new Date(server.lastSeen.toDate()).toLocaleTimeString()}` : 'Never seen'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
          Inspect
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};


const MetricMiniCard = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 rounded-lg p-2 text-center">
    <p className="text-[8px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-tighter mb-1">{label}</p>
    <p className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">{value}</p>
  </div>
);
