import React, { useState } from 'react';
import { X, Mail, Shield, Loader2, Check } from 'lucide-react';
import { db, collection, addDoc, serverTimestamp } from '../firebase';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

export const InviteModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user, currentOrgId } = useAppStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId) return;

    setLoading(true);
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          orgId: currentOrgId,
          role,
          invitedBy: user.uid
        })
      });

      if (!response.ok) throw new Error('Failed to send invite');

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setEmail('');
      }, 2000);
    } catch (error) {
      console.error("Failed to send invite", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Invite Team Member</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleInvite} className="p-6 space-y-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                <Check className="text-zinc-950 w-6 h-6" />
              </div>
              <p className="text-emerald-500 font-medium">Invitation sent successfully!</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'developer', 'viewer'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all",
                        role === r 
                          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                          : "bg-zinc-950 border-white/5 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full bg-emerald-500 text-zinc-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invitation'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
