import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  ShieldAlert, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Lock, 
  ShieldCheck, 
  AlertTriangle,
  Pencil,
  Check,
  X
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

export function UsersModule() {
  const [usersList, setUsersList] = useState<UserCredentials[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'limited' | 'view'>('admin');
  const [accountStatus, setAccountStatus] = useState<'active' | 'inactive'>('active');
  const [pickingAllowed, setPickingAllowed] = useState(true);
  const [checkingAllowed, setCheckingAllowed] = useState(true);
  const [deliveryAllowed, setDeliveryAllowed] = useState(true);
  
  // State for password inline editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState<string>('');
  
  // State for full user profile editing
  const [editingUser, setEditingUser] = useState<UserCredentials | null>(null);
  
  // Keep track of which passwords are shown in the credentials grid
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  
  // Visual toast notification
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'amber' | 'error' } | null>(null);

  // Load local users on mounting
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
            setUsersList(migrated);
          } else {
            setUsersList(parsed);
          }
          return;
        }
      } catch (err) {
        console.error('Error loading users registry:', err);
      }
    }
    // Set and cache initial defaults if not found
    setUsersList(DEFAULT_USERS);
    safeStorage.setItem('scanflow_users_credentials', JSON.stringify(DEFAULT_USERS));
  }, []);

  const triggerNotification = (text: string, type: 'success' | 'amber' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleStartEditPassword = (id: string, currentVal: string) => {
    setEditingUserId(id);
    setEditPasswordValue(currentVal || '');
  };

  const handleSavePassword = (id: string) => {
    const trimmed = editPasswordValue;
    if (!trimmed) {
      triggerNotification('Password cannot be empty.', 'error');
      return;
    }
    const updated = usersList.map(u => {
      if (u.id === id) {
        return { ...u, password: trimmed };
      }
      return u;
    });
    setUsersList(updated);
    safeStorage.setItem('scanflow_users_credentials', JSON.stringify(updated));
    setEditingUserId(null);
    triggerNotification('Password updated successfully.', 'success');
  };

  const handleStartEditUser = (usr: UserCredentials) => {
    setEditingUser(usr);
    setUsernameInput(usr.username);
    setPasswordInput(usr.password);
    setSelectedRole(usr.role);
    setAccountStatus(usr.status);
    
    const allowed = usr.allowedProcesses || ['picking', 'checking', 'delivery'];
    setPickingAllowed(allowed.includes('picking'));
    setCheckingAllowed(allowed.includes('checking'));
    setDeliveryAllowed(allowed.includes('delivery'));
    
    // Scroll to form smoothly
    const formElement = document.getElementById('user-form-section');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setUsernameInput('');
    setPasswordInput('');
    setSelectedRole('admin');
    setAccountStatus('active');
    setPickingAllowed(true);
    setCheckingAllowed(true);
    setDeliveryAllowed(true);
    setShowFormPassword(false);
  };

  const handleCreateUser = (e: FormEvent) => {
    e.preventDefault();
    
    const uname = usernameInput.trim();
    const pword = passwordInput.trim();

    if (!uname) {
      triggerNotification('Please provide a valid Username.', 'error');
      return;
    }
    if (!pword) {
      triggerNotification('Please specify a secure sign-in password.', 'error');
      return;
    }

    // Check pre-existence (case insensitive, skip self if editing)
    const exists = usersList.some(u => 
      u.username.toLowerCase() === uname.toLowerCase() && 
      (!editingUser || u.id !== editingUser.id)
    );
    if (exists) {
      triggerNotification(`User "${uname}" already exists in the system directory.`, 'error');
      return;
    }

    const allowed: ('picking' | 'checking' | 'delivery')[] = [];
    if (pickingAllowed) allowed.push('picking');
    if (checkingAllowed) allowed.push('checking');
    if (deliveryAllowed) allowed.push('delivery');

    if (editingUser) {
      // Update existing user
      const updated = usersList.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            username: uname,
            password: pword,
            role: selectedRole,
            status: accountStatus,
            allowedProcesses: allowed
          };
        }
        return u;
      });

      setUsersList(updated);
      safeStorage.setItem('scanflow_users_credentials', JSON.stringify(updated));

      // Sync active logged-in user in real-time if they edit themselves
      const activeUserStr = safeStorage.getItem('scanflow_active_system_user');
      if (activeUserStr) {
        try {
          const activeUser = JSON.parse(activeUserStr);
          if (activeUser.id === editingUser.id) {
            const updatedActive = {
              ...activeUser,
              username: uname,
              password: pword,
              role: selectedRole,
              status: accountStatus,
              allowedProcesses: allowed
            };
            safeStorage.setItem('scanflow_active_system_user', JSON.stringify(updatedActive));
            window.dispatchEvent(new Event('storage'));
          }
        } catch (e) {
          console.error(e);
        }
      }

      setEditingUser(null);
      
      // Reset inputs
      setUsernameInput('');
      setPasswordInput('');
      setSelectedRole('admin');
      setAccountStatus('active');
      setShowFormPassword(false);
      setPickingAllowed(true);
      setCheckingAllowed(true);
      setDeliveryAllowed(true);

      triggerNotification(`Successfully updated profile for "${uname}"!`, 'success');
      return;
    }

    const newUser: UserCredentials = {
      id: String(Date.now()),
      username: uname,
      password: pword,
      role: selectedRole,
      status: accountStatus,
      createdAt: new Date().toISOString(),
      allowedProcesses: allowed
    };

    const updated = [...usersList, newUser];
    setUsersList(updated);
    safeStorage.setItem('scanflow_users_credentials', JSON.stringify(updated));

    // Reset inputs
    setUsernameInput('');
    setPasswordInput('');
    setSelectedRole('admin');
    setAccountStatus('active');
    setShowFormPassword(false);
    setPickingAllowed(true);
    setCheckingAllowed(true);
    setDeliveryAllowed(true);

    triggerNotification(`Successfully registered new workspace profile for "${uname}"!`, 'success');
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (username === 'admin') {
      triggerNotification('Root administrator account is immune and protected against deletion.', 'error');
      return;
    }

    const updated = usersList.filter(u => u.id !== id);
    setUsersList(updated);
    safeStorage.setItem('scanflow_users_credentials', JSON.stringify(updated));
    triggerNotification(`Removed account credential profile: ${username}`, 'amber');
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div id="user-management-module-container" className="space-y-6">
      
      {/* Module Title Banner */}
      <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex flex-col gap-2.5">
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-400 text-blue-800 text-[10px] font-extrabold uppercase rounded-full tracking-wider animate-pulse">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Access Credentials Manager</span>
          </span>
        </div>
        <div>
          <h2 className="font-display font-black text-slate-900 text-2xl tracking-wide uppercase">
            User Management Module
          </h2>
          <p className="text-xs sm:text-xs text-slate-500 font-semibold tracking-wide mt-1 leading-relaxed">
            Allow system administrators to create personnel profiles, define database access levels, and audit active key credentials.
          </p>
        </div>
      </div>

      {/* Floating Dynamic Feedback Alerts */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 p-4 border-2 rounded-2xl flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] max-w-sm ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-500'
                : notification.type === 'amber'
                ? 'bg-amber-50 text-amber-950 border-amber-500'
                : 'bg-red-50 text-red-950 border-red-500'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 animate-bounce" />
            ) : notification.type === 'amber' ? (
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
            )}
            <span className="text-xs font-bold font-sans tracking-wide leading-relaxed">
              {notification.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Create/Edit Account Form */}
        <section id="user-form-section" className="xl:col-span-5 bg-white rounded-3xl border-2 border-slate-900 p-5 md:p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-3">
            {editingUser ? (
              <>
                <Pencil className="w-5 h-5 text-blue-600 animate-pulse" />
                <h3 className="font-display font-black text-slate-900 text-sm sm:text-base uppercase tracking-wider">
                  Edit User Profile
                </h3>
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-display font-black text-slate-900 text-sm sm:text-base uppercase tracking-wider">
                  Create New User Account
                </h3>
              </>
            )}
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4 font-sans">
            
            {/* Field A: Username */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">
                User Handle / Username
              </label>
              <input
                type="text"
                required
                disabled={editingUser?.username === 'admin'}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. jsmith"
                className={`w-full border-2 border-slate-900 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all ${
                  editingUser?.username === 'admin'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-400'
                    : 'bg-slate-50 text-slate-800 focus:bg-white'
                }`}
              />
              {editingUser?.username === 'admin' && (
                <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-1">
                  ⚠️ Root administrator username cannot be renamed
                </p>
              )}
            </div>

            {/* Field B: Password */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">
                Secure Sign-In Password
              </label>
              <div className="relative">
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password string"
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 transition-colors"
                >
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field C: Access Right Choice List */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase mb-1">
                Access Right Level Selection
              </label>
              
              <div className="space-y-2">
                
                {/* Rule 1: Admin */}
                <div 
                  onClick={() => setSelectedRole('admin')}
                  className={`border-2 rounded-2xl p-3.5 cursor-pointer transition-all flex items-start gap-3 select-none ${
                    selectedRole === 'admin'
                      ? 'border-slate-900 bg-blue-50/20 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                      : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedRole === 'admin' ? 'bg-slate-900' : 'bg-transparent'
                  }`}>
                    {selectedRole === 'admin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">1. administrator (full control)</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-normal">
                      Complete privileges to configure, manage, edit and delete everything.
                    </p>
                  </div>
                </div>

                {/* Rule 2: Limited Access */}
                <div 
                  onClick={() => setSelectedRole('limited')}
                  className={`border-2 rounded-2xl p-3.5 cursor-pointer transition-all flex items-start gap-3 select-none ${
                    selectedRole === 'limited'
                      ? 'border-slate-900 bg-blue-50/20 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                      : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedRole === 'limited' ? 'bg-slate-900' : 'bg-transparent'
                  }`}>
                    {selectedRole === 'limited' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">2. Limited access right (able to add New product)</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-normal">
                      Authorization to view, register, and update stock items but restricted from deletes and users.
                    </p>
                  </div>
                </div>

                {/* Rule 3: View Access */}
                <div 
                  onClick={() => setSelectedRole('view')}
                  className={`border-2 rounded-2xl p-3.5 cursor-pointer transition-all flex items-start gap-3 select-none ${
                    selectedRole === 'view'
                      ? 'border-slate-900 bg-blue-50/20 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                      : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedRole === 'view' ? 'bg-slate-900' : 'bg-transparent'
                  }`}>
                    {selectedRole === 'view' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">3. View (can view only)</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-normal">
                      Read-only access limits the account strictly to dashboards and searches.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Field: Process Permission Selection */}
            <div className="space-y-3 bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <label className="block text-[10px] text-slate-900 font-extrabold tracking-wider uppercase">
                Process Access Permissions
              </label>
              <p className="text-[10px] text-slate-500 font-semibold leading-normal -mt-1">
                Restrict this user profile to only scan/process the selected stages:
              </p>
              
              <div className="space-y-2.5 mt-2">
                {/* 1. Picking Process */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pickingAllowed}
                    onChange={(e) => setPickingAllowed(e.target.checked)}
                    className="w-4 h-4 rounded-md border-2 border-slate-900 bg-white text-blue-600 focus:ring-4 focus:ring-blue-100 cursor-pointer transition-all"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">1. Picking Process</span>
                    <span className="text-[9px] text-slate-500 font-medium leading-normal">Allows starting/finishing picking scans</span>
                  </div>
                </label>

                {/* 2. Checking Process */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkingAllowed}
                    onChange={(e) => setCheckingAllowed(e.target.checked)}
                    className="w-4 h-4 rounded-md border-2 border-slate-900 bg-white text-blue-600 focus:ring-4 focus:ring-blue-100 cursor-pointer transition-all"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">2. Checking Process</span>
                    <span className="text-[9px] text-slate-500 font-medium leading-normal">Allows quality assurance checking scans</span>
                  </div>
                </label>

                {/* 3. Delivery Process */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deliveryAllowed}
                    onChange={(e) => setDeliveryAllowed(e.target.checked)}
                    className="w-4 h-4 rounded-md border-2 border-slate-900 bg-white text-blue-600 focus:ring-4 focus:ring-blue-100 cursor-pointer transition-all"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">3. Delivery Process</span>
                    <span className="text-[9px] text-slate-500 font-medium leading-normal">Allows initiating and completing delivery dispatches</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Field D: Account Status */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase mb-1">
                Initial Account Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountStatus('active')}
                  className={`py-2 px-3.5 border-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    accountStatus === 'active'
                      ? 'border-blue-600 bg-blue-50/30 text-blue-800 font-black shadow-[1.5px_1.5px_0px_0px_rgba(29,78,216,1)]'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400 bg-white'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setAccountStatus('inactive')}
                  className={`py-2 px-3.5 border-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    accountStatus === 'inactive'
                      ? 'border-blue-600 bg-blue-50/30 text-blue-800 font-black shadow-[1.5px_1.5px_0px_0px_rgba(29,78,216,1)]'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400 bg-white'
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            {editingUser ? (
              <div className="space-y-2 mt-4">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 border-2 border-slate-900 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <Check className="w-4 h-4 text-white shrink-0" />
                  <span>Update Profile</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-750 font-black py-3 border-2 border-slate-900 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <X className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Cancel Edit</span>
                </button>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 border-2 border-slate-900 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <UserPlus className="w-4 h-4 text-white shrink-0" />
                <span>Save User Account</span>
              </button>
            )}

          </form>
        </section>

        {/* RIGHT COLUMN: Active System Credentials list */}
        <section className="xl:col-span-7 space-y-6">
          
          <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 md:p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                <h3 className="font-display font-black text-slate-900 text-sm sm:text-base uppercase tracking-wider">
                  Active System Credentials
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] bg-slate-100 border-2 border-slate-900 px-2.5 py-0.5 rounded-full font-mono font-black text-slate-700 uppercase tracking-wider">
                {usersList.length} Profiles
              </span>
            </div>

            {/* List Table of Users */}
            <div className="overflow-x-auto max-w-full rounded-2xl border-2 border-slate-900 bg-white">
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-900 text-slate-500 font-extrabold text-[10px] tracking-wider uppercase">
                    <th className="px-3.5 py-3">Username</th>
                    <th className="px-3.5 py-3">Password</th>
                    <th className="px-3.5 py-3">Permissions / Role</th>
                    <th className="px-3.5 py-3">Status</th>
                    <th className="px-3.5 py-3">Created At</th>
                    <th className="px-3.5 py-3 text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {usersList.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50/50 transition-colors">
                      
                      {/* Column 1: Username & Root Indicator */}
                      <td className="px-3.5 py-3.5 font-bold text-slate-800 font-mono flex items-center gap-1.5 flex-wrap">
                        <span>{usr.username}</span>
                        {usr.username === 'admin' && (
                          <span className="bg-amber-500 text-white font-mono text-[8px] px-1 py-0.2 rounded border border-slate-900 text-center uppercase tracking-normal select-none font-black scale-95 origin-left">
                            Root
                          </span>
                        )}
                      </td>
                      
                      {/* Column 2: Password masked / readable / editable */}
                      <td className="px-3.5 py-3.5 font-bold text-slate-700">
                        {editingUserId === usr.id ? (
                          <div id={`editing-password-field-${usr.id}`} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editPasswordValue}
                              onChange={(e) => setEditPasswordValue(e.target.value)}
                              className="px-2 py-1 border-2 border-slate-900 rounded bg-slate-50 text-xs font-mono font-bold w-36 outline-none focus:bg-white"
                              autoFocus
                              placeholder="New password"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSavePassword(usr.id);
                                } else if (e.key === 'Escape') {
                                  setEditingUserId(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePassword(usr.id)}
                              className="p-1 bg-emerald-500 hover:bg-emerald-400 border border-slate-900 rounded text-slate-950 transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[0.5px]"
                              title="Save Password"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 border border-slate-900 rounded text-slate-800 transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[0.5px]"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className={visiblePasswords[usr.id] ? '' : 'tracking-widest opacity-80'}>
                              {visiblePasswords[usr.id] ? usr.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(usr.id)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800 transition-colors"
                              title={visiblePasswords[usr.id] ? "Hide password" : "Show password"}
                            >
                              {visiblePasswords[usr.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditPassword(usr.id, usr.password || '')}
                              className="p-1 hover:bg-slate-100 rounded text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
                              title="Edit Password"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Column 3: Badge permissions role */}
                      <td className="px-3.5 py-3.5 space-y-1.5">
                        <div>
                          {usr.role === 'admin' ? (
                            <span className="inline-flex items-center text-[9px] px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold uppercase tracking-wide">
                              Administrator
                            </span>
                          ) : usr.role === 'limited' ? (
                            <span className="inline-flex items-center text-[9px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-bold uppercase tracking-wide">
                              Limited Access
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[9px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold uppercase tracking-wide">
                              Viewer (Can View)
                            </span>
                          )}
                        </div>

                        {/* Process permissions details */}
                        <div className="flex flex-wrap gap-1">
                          {(!usr.allowedProcesses || usr.allowedProcesses.length === 3) ? (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-200 rounded uppercase tracking-wider font-sans">
                              Full Access
                            </span>
                          ) : usr.allowedProcesses.length === 0 ? (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-red-100 text-red-700 border border-red-200 rounded uppercase tracking-wider font-sans">
                              No Scanner Access
                            </span>
                          ) : (
                            usr.allowedProcesses.map(p => {
                              let pLabel = p;
                              let pStyle = 'bg-slate-50 text-slate-600 border-slate-200';
                              if (p === 'picking') {
                                pLabel = 'Picking';
                                pStyle = 'bg-amber-50 text-amber-800 border-amber-250';
                              } else if (p === 'checking') {
                                pLabel = 'Checking';
                                pStyle = 'bg-purple-50 text-purple-800 border-purple-250';
                              } else if (p === 'delivery') {
                                pLabel = 'Delivery';
                                pStyle = 'bg-teal-50 text-teal-800 border-teal-250';
                              }
                              return (
                                <span key={p} className={`text-[8px] font-black px-1.5 py-0.2 border rounded uppercase tracking-wider font-sans ${pStyle}`}>
                                  {pLabel}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Column 4: Status badge */}
                      <td className="px-3.5 py-3.5">
                        <span className="inline-flex items-center gap-1 font-bold text-[11px]">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            usr.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`} />
                          <span className={usr.status === 'active' ? 'text-slate-800' : 'text-slate-400'}>
                            {usr.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </span>
                      </td>

                      {/* Column 5: Created date */}
                      <td className="px-3.5 py-3.5 font-medium text-slate-500 text-[10px]">
                        {(() => {
                          try {
                            const date = new Date(usr.createdAt);
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          } catch (_) {
                            return 'Jun 3, 2026';
                          }
                        })()}
                      </td>

                       {/* Column 6: Manage (Edit & Delete buttons) */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditUser(usr)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-250 text-blue-600 hover:text-blue-700 rounded-lg transition-all active:translate-y-[1px] cursor-pointer"
                            title="Edit user profile & process permissions"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(usr.id, usr.username)}
                            disabled={usr.username === 'admin'}
                            className={`p-1.5 rounded-lg border transition-all ${
                              usr.username === 'admin'
                                ? 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-red-50 hover:bg-red-100 border-red-250 text-red-600 hover:text-red-700 active:translate-y-[1px] cursor-pointer'
                            }`}
                            title={usr.username === 'admin' ? 'Root admin account cannot be deleted' : 'Delete user profile'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Security notice block */}
            <div className="mt-6 bg-slate-900/5 border border-slate-900/10 rounded-2xl p-4 flex gap-3 text-slate-700">
              <Lock className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Security Hardening Protocols</h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  The main account 'admin' is protected against removal to safeguard system configuration accessibility. Modifications to access definitions update live client constraints instantly.
                </p>
              </div>
            </div>

          </div>

        </section>

      </div>

    </div>
  );
}
