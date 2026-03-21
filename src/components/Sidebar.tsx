import React from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  FileText, 
  Bell, 
  DollarSign, 
  Settings,
  LogOut,
  ChevronRight,
  Zap,
  Server,
  ChevronLeft,
  Menu,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, signOut } from '../firebase';
import { useAppStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Server, label: 'Servers', id: 'servers' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: FileText, label: 'Logs', id: 'logs' },
  { icon: Bell, label: 'Alerts', id: 'alerts' },
  { icon: DollarSign, label: 'Cost Intelligence', id: 'cost' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (id: string) => void }) => {
  const { isSidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed bottom-8 right-8 z-50 w-16 h-16 bg-emerald-500 text-zinc-950 rounded-3xl shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center justify-center hover:bg-emerald-400 transition-all active:scale-90 hover:scale-110"
      >
        <Menu className="w-7 h-7" />
      </button>

      {/* Sidebar Container */}
      <div className={cn(
        "fixed lg:fixed lg:left-0 lg:top-0 z-40 h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 flex flex-col overflow-visible transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl dark:shadow-none",
        isSidebarCollapsed ? "w-24" : "w-72",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo Section */}
        <div className={cn(
          "p-8 flex items-center gap-4 relative",
          isSidebarCollapsed && "justify-center px-0"
        )}>
          <motion.div 
            whileHover={{ rotate: 180, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-11 h-11 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-2xl shadow-emerald-500/20 group cursor-pointer"
          >
            <Zap className="text-emerald-500 w-6 h-6 fill-current group-hover:scale-125 transition-transform" />
          </motion.div>
          
          <AnimatePresence>
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col"
              >
                <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white leading-none">Nexo Cloud</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              "hidden lg:flex absolute -right-4 w-9 h-9 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl items-center justify-center text-zinc-500 hover:text-emerald-500 transition-all shadow-xl hover:scale-110 active:scale-90 z-[90]",
              isSidebarCollapsed ? "top-6" : "top-10"
            )}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 mt-10 space-y-2 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                activeTab === item.id 
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xl shadow-zinc-900/20 dark:shadow-white/10 scale-[1.02]" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-white/5",
                isSidebarCollapsed && "justify-center px-0"
              )}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={cn(
                "w-5 h-5 shrink-0 transition-all duration-500 group-hover:scale-110",
                activeTab === item.id ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
              )} />
              
              {!isSidebarCollapsed && (
                <>
                  <span className="text-sm font-black truncate tracking-tight">{item.label}</span>
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="activeIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" 
                    />
                  )}
                </>
              )}
              
              {isSidebarCollapsed && activeTab === item.id && (
                <motion.div 
                  layoutId="activeIndicatorCollapsed"
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-emerald-500 rounded-l-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                />
              )}
            </button>
          ))}
        </nav>
        
        {/* Footer Section */}
        <div className="p-6 space-y-4">
          {!isSidebarCollapsed && (
            <div className="bg-zinc-50 dark:bg-white/5 rounded-2xl p-4 border border-zinc-100 dark:border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Security Status</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "94%" }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-zinc-500">94% Secure</span>
                <span className="text-[10px] font-bold text-emerald-500">Optimal</span>
              </div>
            </div>
          )}

          <button 
            onClick={() => signOut(auth)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3.5 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/5 rounded-2xl transition-all group",
              isSidebarCollapsed && "justify-center px-0"
            )}
            title={isSidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
            {!isSidebarCollapsed && <span className="text-sm font-black tracking-tight">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
