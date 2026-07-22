import React, { useState, useEffect } from 'react';
import CameraOperator from './components/CameraOperator';
import HostConsole from './components/HostConsole';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import PublicWatchPortal from './components/PublicWatchPortal';
import { Tv, Shield, Users, Radio, Key, Eye, EyeOff } from 'lucide-react';

export default function App() {
  const [selectedRole, setSelectedRole] = useState(null); // 'admin' | 'host' | 'camera'
  const [eventCode, setEventCode] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Extract query params and pathnames for QR Code & hidden Admin routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');
    const urlCode = params.get('code');
    const path = window.location.pathname;

    if (urlRole === 'camera' && urlCode) {
      setEventCode(urlCode);
      setSelectedRole('camera');
    } else if (urlRole === 'preview' && urlCode) {
      setEventCode(urlCode);
      setSelectedRole('preview');
    } else if (urlRole === 'viewer' && urlCode) {
      setEventCode(urlCode);
      setSelectedRole('viewer');
    } else if (path === '/superadmin') {
      setEventCode('PV-101');
      setAuthPassword('admin123');
      setSelectedRole('admin');
    } else if (path === '/host') {
      setEventCode('PV-101');
      setAuthPassword('host123');
      setSelectedRole('host');
    }
  }, []);

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setStatusMessage('');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!eventCode) {
      setStatusMessage('Please enter an Event Access Code.');
      return;
    }

    // Basic password validation for Super Admin / Host mock roles (case-insensitive)
    if (selectedRole === 'admin' && authPassword.toLowerCase() !== 'admin123') {
      setStatusMessage('Invalid Super Admin passcode.');
      return;
    }

    if (selectedRole === 'host' && authPassword.toLowerCase() !== 'host123') {
      setStatusMessage('Invalid Host passcode.');
      return;
    }

    // Success - routing state takes care of loading component
    setStatusMessage('');
  };

  const resetState = () => {
    // Reset query params, pathnames, and selected states
    window.history.replaceState({}, document.title, '/');
    setSelectedRole(null);
    setEventCode('');
    setAuthPassword('');
    setShowPassword(false);
    setStatusMessage('');
  };

  // 1. Render Active Role Dashboards
  if (selectedRole === 'camera' && eventCode) {
    return <CameraOperator initialEventCode={eventCode} onLeave={resetState} />;
  }

  if (selectedRole === 'preview' && eventCode) {
    return <HostConsole initialEventCode={eventCode} onLeave={resetState} isCleanPreview={true} />;
  }

  if (selectedRole === 'viewer' && eventCode) {
    return <PublicWatchPortal initialEventCode={eventCode} onLeave={resetState} />;
  }

  if (selectedRole === 'host' && eventCode && authPassword.toLowerCase() === 'host123') {
    return <HostConsole initialEventCode={eventCode} onLeave={resetState} />;
  }

  if (selectedRole === 'admin' && eventCode && authPassword.toLowerCase() === 'admin123') {
    return <SuperAdminDashboard initialEventCode={eventCode} onLeave={resetState} />;
  }

  // 2. Render Login Form for Admin/Host or Code Input
  if (selectedRole) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full mb-2">
              {selectedRole === 'admin' ? <Shield className="w-8 h-8" /> : <Users className="w-8 h-8" />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight capitalize">{selectedRole} Authentication</h2>
            <p className="text-sm text-slate-400">Enter event code and passcode to proceed.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Event Access Code</label>
              <input
                type="text"
                required
                placeholder="e.g. PV-101"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Security Passcode</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-550 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Use <code className="text-indigo-400">admin123</code> for Admin, <code className="text-indigo-400">host123</code> for Host.
              </p>
            </div>

            {statusMessage && (
              <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center font-medium">
                {statusMessage}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetState}
                className="flex-1 bg-slate-800 hover:bg-slate-705 border border-slate-750 text-slate-300 font-semibold py-3.5 rounded-xl text-sm transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10"
              >
                Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. Render Landing / Portal Selection
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative overflow-hidden bg-slate-950">
      {/* Background ambient lighting glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full filter blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-4xl text-center space-y-12 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 mb-2">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">VERSION 1.0.0 (MVP)</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            PAVALAM TV
          </h1>
          <p className="text-slate-450 text-lg md:text-xl max-w-2xl mx-auto">
            Professional Web-Based Live Broadcasting Hub. Transform ordinary smartphones into professional camera rigs instantly.
          </p>
        </div>

        {/* Portal option cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Host console option */}
          <button
            onClick={() => handleRoleSelection('host')}
            className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/30 p-6 rounded-2xl text-left space-y-4 transition-all hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-650 group-hover:text-white transition-all">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">Host Mixer</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Live camera switcher grid, audio mixer volume, program canvas preview, Lower Third controls, and local broadcast recording.
              </p>
            </div>
          </button>

          {/* Camera Operator option */}
          <button
            onClick={() => handleRoleSelection('camera')}
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/30 p-6 rounded-2xl text-left space-y-4 transition-all hover:shadow-2xl hover:shadow-emerald-500/5 hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center group-hover:bg-emerald-650 group-hover:text-white transition-all">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">Camera Operator</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect mobile camera browser directly. Toggles audio/video feed, flips lenses, shows battery level, and handles connectivity.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
