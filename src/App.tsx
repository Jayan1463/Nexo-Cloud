import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  signInWithPopup, 
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  db,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  getDocs,
  limit,
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from './firebase';
import { useAppStore } from './store';
import { Organization, Project } from './types';
import { cn } from './lib/utils';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Topology3D } from './components/Topology3D';
import { Servers } from './pages/Servers';
import { Analytics } from './pages/Analytics';
import { Logs } from './pages/Logs';
import { Alerts } from './pages/Alerts';
import { Cost } from './pages/Cost';
import { Settings } from './pages/Settings';
import { 
  Zap, 
  ShieldCheck, 
  Globe, 
  ChevronDown,
  CheckCircle2,
  Cpu, 
  Lock,
  ArrowRight,
  Activity,
  Settings as SettingsIcon,
  Server,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const { user, setUser, currentOrgId, setOrg, setProject, theme, isSidebarCollapsed } = useAppStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const inviteHandledRef = useRef(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    inviteHandledRef.current = false;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        let orgId = '';
        
        if (!userSnap.exists()) {
          // Create default organization for new user
          const orgRef = doc(collection(db, 'organizations'));
          orgId = orgRef.id;
          
          try {
            await setDoc(orgRef, {
              id: orgId,
              name: `${firebaseUser.displayName || 'My'}'s Organization`,
              ownerId: firebaseUser.uid,
              plan: 'free',
              createdAt: serverTimestamp(),
            });

            // Create member document
            const memberRef = doc(db, `organizations/${orgId}/members`, firebaseUser.uid);
            await setDoc(memberRef, {
              uid: firebaseUser.uid,
              role: 'owner',
              joinedAt: serverTimestamp(),
            });

            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: 'owner',
              currentOrgId: orgId,
              orgIds: [orgId],
              createdAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'organizations/users/members');
          }
        } else {
          const userData = userSnap.data();
          orgId = userData.currentOrgId;
          
          // If user doesn't have an orgId for some reason, find one or create one
          if (!orgId) {
            try {
              const orgsQuery = query(collection(db, 'organizations'), where('ownerId', '==', firebaseUser.uid));
              const orgsSnap = await getDocs(orgsQuery);
              if (!orgsSnap.empty) {
                orgId = orgsSnap.docs[0].id;
                await setDoc(userRef, { currentOrgId: orgId, orgIds: [orgId] }, { merge: true });
              } else {
                const orgRef = doc(collection(db, 'organizations'));
                orgId = orgRef.id;
                await setDoc(orgRef, {
                  id: orgId,
                  name: `${firebaseUser.displayName || 'My'}'s Organization`,
                  ownerId: firebaseUser.uid,
                  plan: 'free',
                  createdAt: serverTimestamp(),
                });
                // Create member document
                const memberRef = doc(db, `organizations/${orgId}/members`, firebaseUser.uid);
                await setDoc(memberRef, {
                  uid: firebaseUser.uid,
                  role: 'owner',
                  joinedAt: serverTimestamp(),
                });
                await setDoc(userRef, { currentOrgId: orgId, orgIds: [orgId] }, { merge: true });
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, 'organizations/users');
            }
          }
        }
        
        setUser(firebaseUser);
        setOrg(orgId);

        // Initialize first project
        try {
          const projectsQuery = query(collection(db, `organizations/${orgId}/projects`), limit(1));
          const projectsSnap = await getDocs(projectsQuery);
          if (!projectsSnap.empty) {
            setProject(projectsSnap.docs[0].id);
          } else {
            // Create a default project if none exists
            const projectRef = doc(collection(db, `organizations/${orgId}/projects`));
            await setDoc(projectRef, {
              id: projectRef.id,
              orgId: orgId,
              name: 'Default Project',
              environment: 'prod',
              createdAt: serverTimestamp()
            });
            setProject(projectRef.id);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `organizations/${orgId}/projects`);
        }
      } else {
        setUser(null);
        setOrg(null);
        setProject(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setOrg]);

  useEffect(() => {
    const acceptInvite = async () => {
      if (!user || inviteHandledRef.current) return;
      if (window.location.pathname !== '/accept-invite') return;

      inviteHandledRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const orgId = params.get('orgId');
      const inviteId = params.get('inviteId');
      const token = params.get('token');

      if (!orgId || !inviteId || !token || !user.email) {
        alert('Invalid invite link. Please ask for a new invitation.');
        window.history.replaceState({}, '', '/');
        return;
      }

      try {
        const inviteRef = doc(db, `organizations/${orgId}/invites`, inviteId);
        const inviteSnap = await getDoc(inviteRef);
        if (!inviteSnap.exists()) {
          alert('Invite not found or expired.');
          window.history.replaceState({}, '', '/');
          return;
        }

        const invite = inviteSnap.data() as any;
        const inviteEmail = String(invite.email || '').toLowerCase();
        const userEmail = String(user.email || '').toLowerCase();
        if (invite.status !== 'pending' || invite.inviteToken !== token || inviteEmail !== userEmail) {
          alert('This invite is invalid for your account.');
          window.history.replaceState({}, '', '/');
          return;
        }

        const memberRef = doc(db, `organizations/${orgId}/members`, user.uid);
        await setDoc(memberRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          role: invite.role || 'viewer',
          joinedAt: serverTimestamp(),
        }, { merge: true });

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const existingOrgIds = (userSnap.exists() ? (userSnap.data().orgIds || []) : []) as string[];
        const mergedOrgIds = Array.from(new Set([orgId, ...existingOrgIds]));
        await setDoc(userRef, {
          currentOrgId: orgId,
          orgIds: mergedOrgIds,
        }, { merge: true });

        await updateDoc(inviteRef, {
          status: 'accepted',
          acceptedBy: user.uid,
          acceptedAt: serverTimestamp(),
        });

        setOrg(orgId);
        alert('Invite accepted. Welcome to the organization.');
      } catch (error) {
        console.error('Failed to accept invite', error);
        alert('Failed to accept invite. Please try again.');
      } finally {
        window.history.replaceState({}, '', '/');
      }
    };

    acceptInvite();
  }, [user, setOrg]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-4 transition-colors duration-300">
        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center animate-pulse">
          <Zap className="text-zinc-950 w-6 h-6 fill-current" />
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 font-mono text-sm tracking-widest animate-pulse">INITIALIZING NEXO CLOUD...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 overflow-hidden font-sans transition-colors duration-300">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className={cn(
        "h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-scroll force-scrollbar transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
        isSidebarCollapsed ? "lg:ml-24" : "lg:ml-72"
      )}>
        <TopBar
          onSettingsClick={() => setActiveTab('settings')}
          showContextSelectors={false}
          showQuickContext={true}
        />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'servers' && <Servers />}
            {activeTab === 'analytics' && <Analytics />}
            {activeTab === 'logs' && <Logs />}
            {activeTab === 'alerts' && <Alerts />}
            {activeTab === 'cost' && <Cost />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

const LoginPage = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setErrorMessage('');
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      setErrorMessage('Google sign-in failed. Please try again.');
    }
  };

  const handleEmailAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setErrorMessage('Email and password are required.');
      return;
    }
    if (mode === 'signup') {
      if (!displayName.trim()) {
        setErrorMessage('Display name is required for sign up.');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
    } catch (error) {
      console.error('Email auth failed', error);
      setErrorMessage(mode === 'login' ? 'Invalid email/password.' : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-white dark:bg-zinc-950 flex items-center justify-center overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 p-12 rounded-[2.5rem] shadow-2xl shadow-emerald-500/5 backdrop-blur-xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-10">
          <div className="w-20 h-20 bg-zinc-900 dark:bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 group cursor-pointer transition-transform hover:scale-105 active:scale-95">
            <Zap className="text-emerald-500 w-10 h-10 fill-current group-hover:animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-white">Nexo Cloud</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">The next generation of cloud observability.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <FeatureItem icon={ShieldCheck} label="Enterprise RBAC" />
            <FeatureItem icon={Globe} label="Global Mesh" />
            <FeatureItem icon={Server} label="Real Servers" />
            <FeatureItem icon={Lock} label="Zero Trust" />
          </div>

          <div className="w-full space-y-4">
            <div className="inline-flex bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-white/10 rounded-xl p-1 w-full">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={cn(
                  "flex-1 px-4 py-2 text-sm rounded-lg font-semibold transition-colors",
                  mode === 'login'
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={cn(
                  "flex-1 px-4 py-2 text-sm rounded-lg font-semibold transition-colors",
                  mode === 'signup'
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                Sign Up
              </button>
            </div>

            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {mode === 'signup' && (
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            )}
            {errorMessage && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 px-3 py-2 text-xs text-left">
                {errorMessage}
              </div>
            )}
            <button
              onClick={handleEmailAuth}
              disabled={submitting}
              className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-2xl font-bold text-base hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">or</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              By signing in, you agree to our <span className="underline cursor-pointer hover:text-emerald-500">Terms</span> and <span className="underline cursor-pointer hover:text-emerald-500">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const FeatureItem = ({ icon: Icon, label }: any) => (
  <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/5 transition-colors hover:border-emerald-500/30 group">
    <Icon className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
    <span className="text-[10px] uppercase tracking-widest font-black text-zinc-500 dark:text-zinc-400">{label}</span>
  </div>
);

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
      <Activity className="w-10 h-10 text-zinc-700" />
    </div>
    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
    <p className="text-zinc-500 max-w-md">
      This module is currently processing real-time data from your infrastructure. 
      Advanced visualization will be available shortly.
    </p>
  </div>
);
