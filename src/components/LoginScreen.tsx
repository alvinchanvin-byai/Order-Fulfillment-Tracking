import React, { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Barcode, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldAlert, 
  KeyRound, 
  Users, 
  ExternalLink 
} from 'lucide-react';
import { UserCredentials } from '../types';
import { safeStorage } from '../lib/storage';

const DEFAULT_USERS: UserCredentials[] = [
  { id: '1', username: 'admin', password: 'admin', role: 'admin', status: 'active', createdAt: '2026-06-03T00:00:00.000Z' },
  { id: '2', username: 'CSP', password: 'csp123', role: 'admin', status: 'active', createdAt: '2026-06-03T00:00:00.000Z' },
  { id: '3', username: 'manager', password: 'manager123', role: 'limited', status: 'active', createdAt: '2026-06-03T00:00:00.000Z' },
  { id: '4', username: 'viewer', password: 'viewer123', role: 'view', status: 'active', createdAt: '2026-06-03T00:00:00.000Z' },
  { id: '5', username: 'mbk', password: 'mbk123', role: 'admin', status: 'active', createdAt: '2026-06-24T00:00:00.000Z' }
];

interface LoginScreenProps {
  onLoginSuccess: (user: UserCredentials) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserCredentials[]>([]);
  const [showCredentials, setShowCredentials] = useState(false);

  // Load latest users database from local storage on mount
  useEffect(() => {
    const cached = safeStorage.getItem('scanflow_users_credentials');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if migration is needed (e.g. if any old passwords exist or mbk is missing)
          let changed = false;
          const migrated = parsed.map(user => {
            const updatedUser = { ...user };
            if (user.username.toLowerCase() === 'admin' && user.password === 'password123') {
              updatedUser.password = 'admin';
              changed = true;
            } else if (user.username.toLowerCase() === 'csp' && user.password === 'cspSecure456') {
              updatedUser.password = 'csp123';
              changed = true;
            } else if (user.username.toLowerCase() === 'manager' && user.password === 'managerPass789') {
              updatedUser.password = 'manager123';
              changed = true;
            } else if (user.username.toLowerCase() === 'viewer' && user.password === 'viewerPass2026') {
              updatedUser.password = 'viewer123';
              changed = true;
            }
            return updatedUser;
          });

          const hasMbk = migrated.some(user => user.username.toLowerCase() === 'mbk');
          if (!hasMbk) {
            migrated.push({
              id: '5',
              username: 'mbk',
              password: 'mbk123',
              role: 'admin',
              status: 'active',
              createdAt: '2026-06-24T00:00:00.000Z'
            });
            changed = true;
          }

          if (changed) {
            safeStorage.setItem('scanflow_users_credentials', JSON.stringify(migrated));
            setAvailableUsers(migrated);
          } else {
            setAvailableUsers(parsed);
          }
          return;
        }
      } catch (err) {
        console.error('Error parsing loaded user credentials list:', err);
      }
    }
    setAvailableUsers(DEFAULT_USERS);
    safeStorage.setItem('scanflow_users_credentials', JSON.stringify(DEFAULT_USERS));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const matchUsername = username.trim().toLowerCase();
    const matchPassword = password.trim();

    if (!matchUsername) {
      setErrorMsg('Please specify your username.');
      setLoading(false);
      return;
    }
    if (!matchPassword) {
      setErrorMsg('Please specify your password.');
      setLoading(false);
      return;
    }

    // Match in state (case insensitive username)
    const matchedUser = availableUsers.find(
      (u) => u.username.toLowerCase() === matchUsername
    );

    if (!matchedUser) {
      setErrorMsg('Invalid credentials. The user account does not exist in our directory.');
      setLoading(false);
      return;
    }

    if (matchedUser.password !== matchPassword) {
      setErrorMsg('Incorrect password. Please verify your credentials and try again.');
      setLoading(false);
      return;
    }

    if (matchedUser.status !== 'active') {
      setErrorMsg('This account credential profile is currently suspended/inactive. Please request system administrator activation.');
      setLoading(false);
      return;
    }

    // Success login simulation delay for visual feedback of auth flow
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(matchedUser);
    }, 850);
  };

  const handleUseCredentialDraft = (user: UserCredentials) => {
    setUsername(user.username);
    setPassword(user.password || '');
    setErrorMsg(null);
  };

  return (
    <div id="scanflow-secure-gate-screen" className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 select-none">
      
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo Card Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-slate-900 border-4 border-slate-900 text-white p-3.5 rounded-3xl shrink-0 shadow-[4px_4px_0px_0px_rgba(30,41,59,0.35)]">
            <Barcode className="w-10 h-10 stroke-[2] text-white" />
          </div>
          <h1 className="font-display font-black text-slate-900 text-3xl sm:text-4xl uppercase tracking-tight leading-none">
            ScanFlow
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-500 font-extrabold uppercase tracking-widest">
            Fulfillment and Barcode Operations station
          </p>
        </div>

        {/* Secure login Card */}
        <div className="bg-white border-4 border-slate-900 rounded-[32px] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-6 relative overflow-hidden">
          
          <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-3">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <h2 className="font-display font-black text-slate-900 text-sm uppercase tracking-wider">
              Secure Sign-In Terminal
            </h2>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-900 text-xs p-3.5 rounded-2xl border-2 border-red-300 flex items-start gap-2.5 font-sans font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-sans">
            
            {/* Username field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">
                Username / Handled ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-3 text-xs font-black text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">
                Security Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password string"
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-10 py-3 text-xs font-black text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all font-mono"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-slate-900 hover:bg-slate-850 text-white font-black py-4 border-2 border-slate-900 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 select-none"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>{loading ? 'Authenticating Profile...' : 'Authorize Login'}</span>
            </button>

          </form>

          {/* Quick Demo Sign-In help directory - hidden by default behind an understated toggle */}
          <div className="pt-4 border-t-2 border-slate-100">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 font-extrabold uppercase tracking-wider transition-colors cursor-pointer select-none"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{showCredentials ? 'Hide System Credentials Directory' : 'Show System Credentials Directory'}</span>
            </button>
            
            {showCredentials && (
              <div className="mt-3 space-y-2.5 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleUseCredentialDraft(u)}
                      className="p-2.5 border-2 border-slate-200 hover:border-slate-900 rounded-xl bg-slate-50 hover:bg-slate-100 text-left transition-all active:translate-y-[0.5px] group cursor-pointer"
                      title="Click to instantly load these credentials"
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="font-mono text-slate-800 group-hover:text-blue-600 transition-colors">{u.username}</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded border uppercase tracking-wide font-extrabold ${
                          u.role === 'admin' ? 'bg-red-50 text-red-600 border-red-200' :
                          u.role === 'limited' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-blue-50 text-blue-600 border-blue-200'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 font-semibold">
                        <span>Key: <strong className="text-slate-700 font-bold">{u.password}</strong></span>
                        <span className="text-[8px] text-blue-500 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Autofill ➔</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>



      </div>

    </div>
  );
}
