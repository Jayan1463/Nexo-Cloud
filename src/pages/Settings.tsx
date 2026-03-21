import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building, 
  Shield, 
  Bell, 
  CreditCard, 
  Save, 
  Loader2, 
  Users, 
  UserMinus, 
  UserPlus,
  Mail, 
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Folder,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  sendPasswordResetEmail,
  auth,
  updateProfile,
  signOut
} from '../firebase';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { Organization, UserProfile, Invite, Project, OrgMember } from '../types';

export const Settings = () => {
  const { user, currentOrgId, setUser, setOrg: setCurrentOrg, setProject } = useAppStore();
  const [activeSection, setActiveSection] = useState<'profile' | 'organization' | 'projects' | 'security' | 'notifications'>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<(UserProfile & { role: string })[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  // Notification settings
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifFrequency, setNotifFrequency] = useState(50); // Slider value

  // Security settings
  const [twoFactor, setTwoFactor] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Billing settings
  const [billingEmail, setBillingEmail] = useState(user?.email || '');

  // Project creation state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectEnv, setNewProjectEnv] = useState<'prod' | 'staging' | 'dev'>('dev');
  const [inviteRows, setInviteRows] = useState<Array<{ email: string; role: 'admin' | 'developer' | 'viewer' }>>([
    { email: '', role: 'viewer' },
  ]);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setBillingEmail(user?.email || '');
  }, [user?.displayName, user?.email]);

  useEffect(() => {
    if (!user?.uid) return;
    const key = `nexo_settings_${user.uid}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.notifEmail === 'boolean') setNotifEmail(parsed.notifEmail);
      if (typeof parsed.notifPush === 'boolean') setNotifPush(parsed.notifPush);
      if (typeof parsed.notifFrequency === 'number') setNotifFrequency(parsed.notifFrequency);
      if (typeof parsed.twoFactor === 'boolean') setTwoFactor(parsed.twoFactor);
      if (typeof parsed.billingEmail === 'string') setBillingEmail(parsed.billingEmail);
    } catch {
      // Ignore malformed local settings.
    }
  }, [user?.uid]);

  // Fetch Organization Data
  useEffect(() => {
    if (!currentOrgId) return;

    const orgRef = doc(db, 'organizations', currentOrgId);
    const unsubscribeOrg = onSnapshot(orgRef, (doc) => {
      if (doc.exists()) {
        setOrg(doc.data() as Organization);
      }
    });

    // Fetch Members from subcollection
    const membersSubQuery = collection(db, `organizations/${currentOrgId}/members`);
    const unsubscribeMembers = onSnapshot(membersSubQuery, async (snapshot) => {
      const memberDocs = snapshot.docs.map(d => d.data() as OrgMember);
      
      // Fetch user profiles for these members
      const memberProfiles = await Promise.all(memberDocs.map(async (m) => {
        const uSnap = await getDoc(doc(db, 'users', m.uid));
        return { ...(uSnap.data() as UserProfile), role: m.role };
      }));
      
      setMembers(memberProfiles);
    });

    // Fetch Invites
    const invitesQuery = query(collection(db, `organizations/${currentOrgId}/invites`), where('status', '==', 'pending'));
    const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
      const invitesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite));
      setInvites(invitesList);
    });

    // Fetch Projects
    const projectsQuery = collection(db, `organizations/${currentOrgId}/projects`);
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projectsList);
    });

    return () => {
      unsubscribeOrg();
      unsubscribeMembers();
      unsubscribeInvites();
      unsubscribeProjects();
    };
  }, [currentOrgId]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setErrorMessage('');
    setSuccessMessage('');
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const payload = {
        displayName: normalizedDisplayName,
        photoURL: user.photoURL || '',
        ...(currentOrgId ? { currentOrgId } : {}),
      };
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, payload);
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          role: 'viewer',
          createdAt: serverTimestamp(),
          ...payload,
        }, { merge: true });
      }
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: normalizedDisplayName });
        setUser(auth.currentUser);
      }
      setDisplayName(normalizedDisplayName);

      setSaved(true);
      setSuccessMessage('Profile updated successfully.');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save profile", error);
      setErrorMessage('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrg = async (updates: Partial<Organization>) => {
    if (!currentOrgId) return;
    setErrorMessage('');
    setLoading(true);
    try {
      const orgRef = doc(db, 'organizations', currentOrgId);
      await setDoc(orgRef, updates, { merge: true });
      setSaved(true);
      setSuccessMessage('Organization updated.');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to update organization", error);
      setErrorMessage('Failed to update organization.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberUid: string, newRole: string) => {
    if (!currentOrgId) return;
    try {
      const memberRef = doc(db, `organizations/${currentOrgId}/members`, memberUid);
      await updateDoc(memberRef, { role: newRole });
    } catch (error) {
      console.error("Failed to update member role", error);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    if (!currentOrgId || memberUid === user?.uid) return;
    if (!window.confirm("Are you sure you want to remove this member?")) return;

    try {
      const memberRef = doc(db, `organizations/${currentOrgId}/members`, memberUid);
      await deleteDoc(memberRef);
    } catch (error) {
      console.error("Failed to remove member", error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!currentOrgId) return;
    try {
      const inviteRef = doc(db, `organizations/${currentOrgId}/invites`, inviteId);
      await deleteDoc(inviteRef);
    } catch (error) {
      console.error("Failed to cancel invite", error);
    }
  };

  const updateInviteRow = (index: number, updates: Partial<{ email: string; role: 'admin' | 'developer' | 'viewer' }>) => {
    setInviteRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  };

  const addInviteRow = () => {
    setInviteRows((prev) => [...prev, { email: '', role: 'viewer' }]);
  };

  const removeInviteRow = (index: number) => {
    setInviteRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSendInvites = async () => {
    if (!currentOrgId || !user?.uid || !canManage) return;

    const trimmedRows = inviteRows
      .map((row) => ({ ...row, email: row.email.trim().toLowerCase() }))
      .filter((row) => row.email.length > 0);

    if (trimmedRows.length === 0) {
      alert('Add at least one email to send invites.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = trimmedRows.find((row) => !emailRegex.test(row.email));
    if (invalid) {
      alert(`Invalid email: ${invalid.email}`);
      return;
    }

    const pendingEmails = new Set(invites.map((i) => i.email.toLowerCase()));
    const uniqueRows = trimmedRows.filter((row, idx, arr) => arr.findIndex((r) => r.email === row.email) === idx);
    const rowsToInvite = uniqueRows.filter((row) => !pendingEmails.has(row.email));

    if (rowsToInvite.length === 0) {
      alert('All entered emails already have pending invites.');
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        rowsToInvite.map(async (row) => {
          const response = await fetch('/api/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orgId: currentOrgId,
              email: row.email,
              role: row.role,
              invitedBy: user.uid,
            }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.error || `Failed to invite ${row.email}`);
          }
          return response.json();
        })
      );

      const hadFallbackLogging = results.some((r: any) => typeof r?.inviteLink === 'string');
      setInviteRows([{ email: '', role: 'viewer' }]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (hadFallbackLogging) {
        console.warn('Invite links returned in API response. Configure RESEND_API_KEY to send real emails.');
      }
    } catch (error) {
      console.error('Failed to send invites', error);
      const message = error instanceof Error ? error.message : 'Failed to send invites';
      setErrorMessage(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !newProjectName) return;
    setLoading(true);
    try {
      const projectsRef = collection(db, `organizations/${currentOrgId}/projects`);
      const newProjectRef = doc(projectsRef);
      await setDoc(newProjectRef, {
        id: newProjectRef.id,
        orgId: currentOrgId,
        name: newProjectName,
        environment: newProjectEnv,
        createdAt: serverTimestamp()
      });
      setNewProjectName('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to add project", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!currentOrgId) return;
    if (!window.confirm("Are you sure you want to delete this project? All associated metrics and logs will be lost.")) return;
    try {
      const projectRef = doc(db, `organizations/${currentOrgId}/projects`, projectId);
      await deleteDoc(projectRef);
    } catch (error) {
      console.error("Failed to delete project", error);
    }
  };

  const handleSaveAll = async () => {
    if (!user?.uid) return;
    setErrorMessage('');
    setLoading(true);
    try {
      const key = `nexo_settings_${user.uid}`;
      localStorage.setItem(key, JSON.stringify({
        notifEmail,
        notifPush,
        notifFrequency,
        twoFactor,
        billingEmail: billingEmail.trim(),
        updatedAt: Date.now(),
      }));
      setSaved(true);
      setSuccessMessage('Settings saved successfully.');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings', error);
      setErrorMessage('Failed to save settings in this browser.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setErrorMessage('No email found for this account.');
      return;
    }
    if (!currentPassword.trim() || !newPassword.trim()) {
      setErrorMessage('Current and new password fields are required.');
      return;
    }
    if (newPassword.trim().length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setPasswordResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccessMessage('Password reset email sent. Please check your inbox.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      console.error('Failed to send password reset email', error);
      setErrorMessage('Failed to send password reset email.');
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser || !user?.uid) {
      setErrorMessage('You need to be signed in to delete your account.');
      return;
    }

    const typed = window.prompt('Type DELETE to permanently delete your account.');
    if (typed !== 'DELETE') {
      setErrorMessage('Account deletion canceled. Type DELETE exactly to confirm.');
      return;
    }

    if (!window.confirm('This permanently deletes your account and removes your org memberships. Continue?')) {
      return;
    }

    setDeleteAccountLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete account');
      }

      localStorage.removeItem(`nexo_settings_${user.uid}`);
      setProject(null);
      setCurrentOrg(null);
      setUser(null);
      await signOut(auth).catch(() => undefined);
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to delete account', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete account.');
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const currentUserRole = members.find(m => m.uid === user?.uid)?.role || (org?.ownerId === user?.uid ? 'owner' : 'viewer');
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin' || org?.ownerId === user?.uid;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-zinc-500 mt-1">Manage your account and organization preferences</p>
        </div>
        {(activeSection === 'security' || activeSection === 'notifications') && (
          <button 
            onClick={handleSaveAll}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>
      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 px-4 py-3 text-sm">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-1 bg-white dark:bg-zinc-900/30 p-2 rounded-2xl border border-zinc-200 dark:border-white/5 h-fit sticky top-24 shadow-sm dark:shadow-none">
          <div className="px-3 py-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Menu</span>
          </div>
          <SettingsNav 
            icon={User} 
            label="Profile" 
            active={activeSection === 'profile'} 
            onClick={() => setActiveSection('profile')} 
          />
          <SettingsNav 
            icon={Building} 
            label="Organization" 
            active={activeSection === 'organization'} 
            onClick={() => setActiveSection('organization')} 
          />
          <SettingsNav 
            icon={Folder} 
            label="Projects" 
            active={activeSection === 'projects'} 
            onClick={() => setActiveSection('projects')} 
          />
          <SettingsNav 
            icon={Shield} 
            label="Security" 
            active={activeSection === 'security'} 
            onClick={() => setActiveSection('security')} 
          />
          <SettingsNav 
            icon={Bell} 
            label="Notifications" 
            active={activeSection === 'notifications'} 
            onClick={() => setActiveSection('notifications')} 
          />
        </div>

        <div className="md:col-span-3 space-y-8">
          {activeSection === 'profile' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  Profile Information
                </h2>
                
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-end gap-4">
                {saved && <span className="text-emerald-500 text-sm font-medium animate-in fade-in">Settings saved!</span>}
                <button 
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="bg-zinc-900 dark:bg-emerald-500 text-white dark:text-zinc-950 px-8 py-3 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Profile
                </button>
              </div>
            </div>
          )}

          {activeSection === 'organization' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Organization Details */}
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-500" />
                  Organization Details
                </h2>
                
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Organization Name</label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        defaultValue={org?.name || ''}
                        onBlur={(e) => handleUpdateOrg({ name: e.target.value })}
                        className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Organization Owner</label>
                      <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-500 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {members.find(m => m.uid === org?.ownerId)?.email || 'Loading...'}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Team Management */}
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" />
                    Team Members
                  </h2>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{members.length} Members</span>
                </div>

                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.uid} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 rounded-xl group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-white/5 flex items-center justify-center overflow-hidden">
                          <User className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{member.displayName || 'Anonymous'}</p>
                          <p className="text-xs text-zinc-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {canManage && member.role !== 'owner' ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.uid, e.target.value)}
                            className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border-none focus:ring-0 cursor-pointer"
                          >
                            <option value="admin">Admin</option>
                            <option value="developer">Developer</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                            member.role === 'owner' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400"
                          )}>
                            {member.role}
                          </span>
                        )}
                        {member.uid !== user?.uid && member.role !== 'owner' && (
                          <button 
                            onClick={() => handleRemoveMember(member.uid)}
                            className="p-2 text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Invite Members */}
              {canManage && (
                <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-blue-500" />
                      Invite Members
                    </h2>
                    <button
                      type="button"
                      onClick={addInviteRow}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>

                  <div className="space-y-3">
                    {inviteRows.map((row, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <input
                          type="email"
                          placeholder="member@company.com"
                          value={row.email}
                          onChange={(e) => updateInviteRow(index, { email: e.target.value })}
                          className="md:col-span-7 w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                        <select
                          value={row.role}
                          onChange={(e) => updateInviteRow(index, { role: e.target.value as 'admin' | 'developer' | 'viewer' })}
                          className="md:col-span-3 w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="developer">Developer</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeInviteRow(index)}
                          className="md:col-span-2 w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    {saved && <span className="text-emerald-500 text-sm font-medium animate-in fade-in">Invites sent!</span>}
                    <button
                      type="button"
                      onClick={handleSendInvites}
                      disabled={loading}
                      className="flex items-center gap-2 bg-emerald-500 text-zinc-950 px-6 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Send Invites
                    </button>
                  </div>
                </section>
              )}

              {/* Pending Invites */}
              {invites.length > 0 && (
                <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Mail className="w-5 h-5 text-amber-500" />
                    Pending Invitations
                  </h2>

                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 rounded-xl group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-white/5 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{invite.email}</p>
                            <p className="text-xs text-zinc-500">Invited as {invite.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCancelInvite(invite.id!)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeSection === 'projects' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Add Project */}
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" />
                  New Project
                </h2>
                
                <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <input
                      type="text"
                      placeholder="Project Name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <select
                      value={newProjectEnv}
                      onChange={(e) => setNewProjectEnv(e.target.value as any)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                    >
                      <option value="prod">Production</option>
                      <option value="staging">Staging</option>
                      <option value="dev">Development</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading || !newProjectName}
                    className="bg-zinc-900 dark:bg-emerald-500 text-white dark:text-zinc-950 px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Create Project
                  </button>
                </form>
              </section>

              {/* Projects List */}
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Folder className="w-5 h-5 text-emerald-500" />
                  Existing Projects
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  {projects.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-white/5 rounded-2xl">
                      <p className="text-zinc-500 text-sm">No projects found in this organization.</p>
                    </div>
                  ) : (
                    projects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 rounded-2xl group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-white/5">
                            <Folder className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-zinc-900 dark:text-white">{project.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                                project.environment === 'prod' ? "bg-emerald-500/10 text-emerald-500" :
                                project.environment === 'staging' ? "bg-amber-500/10 text-amber-500" :
                                "bg-blue-500/10 text-blue-500"
                              )}>
                                {project.environment}
                              </span>
                              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">ID: {project.id}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleDeleteProject(project.id)}
                            className="p-3 text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Security Controls
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">Two-Factor Authentication</p>
                      <p className="text-xs text-zinc-500">Add an extra layer of security to your account</p>
                    </div>
                    <button 
                      onClick={() => setTwoFactor(!twoFactor)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        twoFactor ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-800"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        twoFactor ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Change Password</label>
                    <div className="grid grid-cols-1 gap-4">
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      />
                      <input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={passwordResetLoading}
                        className="bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors w-fit disabled:opacity-50"
                      >
                        {passwordResetLoading ? 'Sending...' : 'Send Password Reset Email'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-zinc-900/50 border border-red-200 dark:border-red-500/30 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Danger Zone
                </h2>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Delete Account</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      This permanently deletes your user account, removes your memberships, and signs you out everywhere.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountLoading}
                    className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
                  >
                    {deleteAccountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Account
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-8 space-y-6 shadow-sm dark:shadow-none">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-500" />
                  Notification Preferences
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">Email Notifications</p>
                      <p className="text-xs text-zinc-500">Receive alerts and reports via email</p>
                    </div>
                    <button 
                      onClick={() => setNotifEmail(!notifEmail)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        notifEmail ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-800"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        notifEmail ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">Push Notifications</p>
                      <p className="text-xs text-zinc-500">Receive real-time alerts on your device</p>
                    </div>
                    <button 
                      onClick={() => setNotifPush(!notifPush)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        notifPush ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-800"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        notifPush ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Alert Sensitivity</label>
                      <span className="text-xs font-mono text-emerald-500">{notifFrequency}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={notifFrequency}
                      onChange={(e) => setNotifFrequency(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                      <span>Low</span>
                      <span>Balanced</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingsNav = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
      active ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);
