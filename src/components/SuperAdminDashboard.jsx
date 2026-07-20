import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Radio, Settings, BarChart2, Cpu, HardDrive, Network, Users, Play, Square, Layers, Sparkles, Image, AlertCircle, Camera, Copy, Check, HelpCircle, ExternalLink, Megaphone, Tv } from 'lucide-react';

export default function SuperAdminDashboard({ initialEventCode, onLeave }) {
  const [eventCode] = useState(initialEventCode || 'PV-101');
  const [eventTitle, setEventTitle] = useState('ஸ்ரீ பவளம்மன் கோவில் ஆடி திருவிழா 2026');
  const [eventDescription, setEventDescription] = useState('பவளம்மன் கோவில் திருவிழா நேரலை ஒளிபரப்பு');
  
  // Real-time states
  const [isLive, setIsLive] = useState(false);
  const [cameras, setCameras] = useState({});
  const [camerasCount, setCamerasCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState(false);

  // Overlay graphics
  const [tickerText, setTickerText] = useState('');
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [tickerSpeed, setTickerSpeed] = useState(15);
  const [tickerColor, setTickerColor] = useState('#ffffff');
  const [tickerBg, setTickerBg] = useState('#ef4444');
  
  const [logoUrl, setLogoUrl] = useState('https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=100&auto=format&fit=crop&q=60');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [logoEnabled, setLogoEnabled] = useState(true);

  // Suddenly News Alerts (Flash News)
  const [flashNewsText, setFlashNewsText] = useState('');
  const [flashNewsEnabled, setFlashNewsEnabled] = useState(false);
  const [youtubeId, setYoutubeId] = useState('');

  // Streaming targets
  const [streamTargets, setStreamTargets] = useState({
    youtube: false,
    facebook: false,
    rtmpServer: 'rtmp://live.pavalamtv.com/live',
    streamKey: 'live_pv_987654321_abcd'
  });

  // UI state
  const [showYoutubeHelp, setShowYoutubeHelp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Resource analytics Simulation state
  const [systemMetrics, setSystemMetrics] = useState({
    cpu: 24,
    memory: 42,
    uploadSpeed: 18.4,
    networkQuality: 'Excellent'
  });

  const [connectionError, setConnectionError] = useState(null);
  const [isRtmpSaved, setIsRtmpSaved] = useState(false);
  const socketRef = useRef(null);

  // Camera Operator enrollment URL
  const cameraJoinUrl = `${window.location.origin}/?role=camera&code=${eventCode}`;
  const viewerWatchUrl = `${window.location.origin}/?role=viewer&code=${eventCode}`;
  const [copiedWatchLink, setCopiedWatchLink] = useState(false);

  useEffect(() => {
    // Setup Socket connection
    const rawUrl = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : `http://${window.location.hostname}:5000`);
    const serverUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const socket = io(serverUrl, { transports: ['polling', 'websocket'], upgrade: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionError(null);
    });

    socket.on('connect_error', (err) => {
      setConnectionError(`Connection error: ${err.message || 'Server Unreachable'}`);
    });

    socket.emit('join-room', {
      eventCode,
      role: 'admin'
    });

    socket.on('room-state', (room) => {
      setEventTitle(room.title);
      setEventDescription(room.description);
      setIsLive(room.status === 'live');
      setCameras(room.cameras || {});
      setCamerasCount(Object.keys(room.cameras || {}).length);
      setRecordingStatus(room.recording);
      
      // Ticker setup
      setTickerText(room.ticker.text);
      setTickerEnabled(room.ticker.enabled);
      setTickerSpeed(room.ticker.speed);
      setTickerColor(room.ticker.color);
      setTickerBg(room.ticker.bg);

      // Graphics
      setLogoUrl(room.graphics.logo);
      setWatermarkEnabled(room.graphics.watermark);
      setLogoEnabled(room.graphics.logoEnabled);
      setStreamTargets(prev => ({
        ...prev,
        youtube: room.rtmpOutputs.youtube,
        facebook: room.rtmpOutputs.facebook,
        rtmpServer: room.rtmpOutputs.custom || prev.rtmpServer
      }));
      if (room.youtubeId) {
        setYoutubeId(room.youtubeId);
      }
    });

    socket.on('cameras-updated', (updatedCameras) => {
      setCameras(updatedCameras);
      setCamerasCount(Object.keys(updatedCameras || {}).length);
    });

    socket.on('recording-status-updated', (status) => {
      setRecordingStatus(status);
    });

    // Simulate metrics fluctuation
    const interval = setInterval(() => {
      setSystemMetrics({
        cpu: Math.floor(18 + Math.random() * 15),
        memory: Math.floor(38 + Math.random() * 8),
        uploadSpeed: parseFloat((15 + Math.random() * 6).toFixed(1)),
        networkQuality: Math.random() > 0.15 ? 'Excellent' : 'Good'
      });
      // Simulate changing viewer counts if live
      if (isLive) {
        setViewerCount(prev => Math.max(12, prev + Math.floor(Math.random() * 7) - 3));
      } else {
        setViewerCount(0);
      }
    }, 3000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [eventCode, isLive]);

  const toggleLive = () => {
    const nextLive = !isLive;
    setIsLive(nextLive);
    if (nextLive) {
      setViewerCount(Math.floor(25 + Math.random() * 10));
    }
    if (socketRef.current) {
      socketRef.current.emit('update-event-status', {
        status: nextLive ? 'live' : 'idle',
        title: eventTitle,
        description: eventDescription
      });
    }
  };

  const updateGraphics = () => {
    if (socketRef.current) {
      socketRef.current.emit('update-graphics', {
        logo: logoUrl,
        watermark: watermarkEnabled,
        logoEnabled: logoEnabled
      });
    }
  };

  const updateTicker = () => {
    if (socketRef.current) {
      socketRef.current.emit('update-ticker', {
        text: tickerText,
        enabled: tickerEnabled,
        speed: tickerSpeed,
        color: tickerColor,
        bg: tickerBg
      });
    }
  };

  // Suddenly News Flasher
  const handleFlashNewsSubmit = (e) => {
    e.preventDefault();
    if (!flashNewsText) return;

    const formattedNews = `🚨 BREAKING NEWS: ${flashNewsText} 🚨`;
    setTickerText(formattedNews);
    setTickerBg('#dc2626'); // Forced Warning Red
    setTickerColor('#ffffff');
    setTickerEnabled(true);

    if (socketRef.current) {
      socketRef.current.emit('update-ticker', {
        text: formattedNews,
        enabled: true,
        speed: 12, // Faster speed for urgent news
        color: '#ffffff',
        bg: '#dc2626'
      });
    }
    setFlashNewsEnabled(true);
  };

  const clearFlashNews = () => {
    setFlashNewsText('');
    setFlashNewsEnabled(false);
    const standardTicker = '🔴 LIVE | ஸ்ரீ பவளம்மன் கோவில் திருவிழா | அனைவரும் நேரலையில் இணைந்திருப்பதற்கு நன்றி';
    setTickerText(standardTicker);
    setTickerBg('#ef4444');
    if (socketRef.current) {
      socketRef.current.emit('update-ticker', {
        text: standardTicker,
        enabled: true,
        speed: 15,
        color: '#ffffff',
        bg: '#ef4444'
      });
    }
  };

  const handleRtmpUpdate = (e) => {
    e.preventDefault();
    if (socketRef.current) {
      socketRef.current.emit('update-rtmp-outputs', {
        youtube: streamTargets.youtube,
        facebook: streamTargets.facebook,
        custom: streamTargets.rtmpServer,
        rtmpServer: streamTargets.rtmpServer,
        streamKey: streamTargets.streamKey
      });
      socketRef.current.emit('update-youtube-id', youtubeId);
      setIsRtmpSaved(true);
      setTimeout(() => setIsRtmpSaved(false), 2000);
    }
  };

  const copyOperatorLink = () => {
    navigator.clipboard.writeText(cameraJoinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyWatchLink = () => {
    navigator.clipboard.writeText(viewerWatchUrl);
    setCopiedWatchLink(true);
    setTimeout(() => setCopiedWatchLink(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen">
      {/* Admin header */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur-md px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 border border-blue-500/20 text-blue-500 p-2.5 rounded-xl">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">SUPER ADMIN</span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">{eventCode}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-200">PAVALAM TV - Control Panel</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleLive}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
              isLive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10'
            }`}
          >
            {isLive ? (
              <>
                <Square className="w-4 h-4" /> Stop Live Broadcast
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Live Broadcast
              </>
            )}
          </button>

          <button
            onClick={onLeave}
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-900 px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            Exit Control Panel
          </button>
        </div>
      </header>

      {connectionError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold px-8 py-3 flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
          <span>{connectionError}. Make sure your Render backend is active and Netlify environment variables are fully built.</span>
        </div>
      )}

      {/* Main Grid content */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 p-8 max-w-[1600px] mx-auto w-full">
        
        {/* Left Column: Event details, Diagnostics, Link enrollment */}
        <div className="space-y-6">
          {/* Event Metadata card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" /> Event Details
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description / Location</label>
                <textarea
                  rows={2}
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Copy camera link component */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center justify-center gap-2">
              <Camera className="w-4 h-4 text-emerald-500" /> Camera Operator Invitation
            </h2>
            <p className="text-xs text-slate-500">Share this link with smartphone operators. When they click it, their browser will automatically join the live broadcast room.</p>
            
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={cameraJoinUrl}
                className="flex-1 bg-slate-950 border border-slate-850 text-slate-400 text-xs px-3 rounded-xl py-2.5 truncate font-mono select-all"
              />
              <button
                onClick={copyOperatorLink}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 flex items-center justify-center transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-[10px] text-slate-500">
              Alternatively, operators can manually join by entering Code: <strong className="text-slate-300 font-mono">{eventCode}</strong>
            </div>
          </div>

          {/* Copy viewer live watch link component */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center justify-center gap-2">
              <Tv className="w-4 h-4 text-rose-500" /> Public Viewer Watch Link
            </h2>
            <p className="text-xs text-slate-500">Share this link with your public audience. They can watch your live broadcast directly in their browser with player tools (Pause, Fullscreen).</p>
            
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={viewerWatchUrl}
                className="flex-1 bg-slate-950 border border-slate-850 text-slate-400 text-xs px-3 rounded-xl py-2.5 truncate font-mono select-all"
              />
              <button
                onClick={copyWatchLink}
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-4 flex items-center justify-center transition-colors"
              >
                {copiedWatchLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Real-time system diagnostics */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-500" /> Diagnostics & Performance
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Live Status</span>
                  <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></span>
                </div>
                <div className="text-lg font-bold">{isLive ? 'ON AIR' : 'OFFLINE'}</div>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Viewer Count</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-lg font-bold">{viewerCount}</div>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">CPU Usage</span>
                  <Cpu className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-lg font-bold">{systemMetrics.cpu}%</div>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Memory</span>
                  <HardDrive className="w-4 h-4 text-teal-500" />
                </div>
                <div className="text-lg font-bold">{systemMetrics.memory}%</div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Active Cameras</span>
                <span className="font-semibold text-slate-300">{camerasCount} Joined</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Uplink Speed</span>
                <span className="font-semibold text-slate-300">{systemMetrics.uploadSpeed} Mbps</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Network Quality</span>
                <span className="font-semibold text-emerald-400">{systemMetrics.networkQuality}</span>
              </div>
              {recordingStatus && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl p-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                  <span>Active Cloud/Local Recording In Progress...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Suddenly News alerts, Graphics, Ticker overlay */}
        <div className="space-y-6">
          
          {/* Suddenly News / Flash Alerts overlay panel */}
          <div className="bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-900/30 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold uppercase text-red-400 tracking-wider flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-red-500 animate-bounce" /> Suddenly News Overlay
            </h2>
            <p className="text-xs text-slate-400">Broadcast immediate flashing breaking news overlay directly to the program ticker feed.</p>
            
            <form onSubmit={handleFlashNewsSubmit} className="space-y-3">
              <input
                type="text"
                required
                value={flashNewsText}
                onChange={(e) => setFlashNewsText(e.target.value)}
                placeholder="e.g. பவளம்மன் கோவில் அபிஷேகம் தொடங்கியது..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-500"
              />
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-red-650 hover:bg-red-600 text-white font-semibold py-2 rounded-xl text-xs transition-colors"
                >
                  Flash News
                </button>
                {flashNewsEnabled && (
                  <button
                    type="button"
                    onClick={clearFlashNews}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 font-semibold py-2 px-4 rounded-xl text-xs transition-colors"
                  >
                    Clear Alert
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Running Ticker controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Live Ticker Running Text
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ticker Content (Supports Tamil & English)</label>
                <textarea
                  rows={2}
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="🔴 LIVE | ஸ்ரீ பவளம்மன் கோவில் திருவிழா..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Text Color</label>
                  <input
                    type="color"
                    value={tickerColor}
                    onChange={(e) => setTickerColor(e.target.value)}
                    className="w-full h-10 bg-slate-950 border border-slate-850 rounded-xl p-1 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Background Color</label>
                  <input
                    type="color"
                    value={tickerBg}
                    onChange={(e) => setTickerBg(e.target.value)}
                    className="w-full h-10 bg-slate-950 border border-slate-850 rounded-xl p-1 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                  <span>Scrolling Speed</span>
                  <span className="text-slate-300">{tickerSpeed}s duration</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={tickerSpeed}
                  onChange={(e) => setTickerSpeed(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300">Enable Ticker</h3>
                  <p className="text-xs text-slate-500">Show/hide running text marquee</p>
                </div>
                <input
                  type="checkbox"
                  checked={tickerEnabled}
                  onChange={(e) => setTickerEnabled(e.target.checked)}
                  className="rounded border-slate-850 bg-slate-950 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
              </div>

              <button
                onClick={updateTicker}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-semibold py-2.5 rounded-xl text-xs tracking-wider uppercase transition-colors"
              >
                Sync Ticker Content
              </button>
            </div>
          </div>

          {/* Logo overlay settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" /> Graphics & Brand Overlays
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">TV Logo (URL)</label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300">Show Brand Logo</h3>
                  <p className="text-xs text-slate-500">Toggles visibility of TV/Event logo</p>
                </div>
                <input
                  type="checkbox"
                  checked={logoEnabled}
                  onChange={(e) => setLogoEnabled(e.target.checked)}
                  className="rounded border-slate-850 bg-slate-950 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300">Sponsor Watermark</h3>
                  <p className="text-xs text-slate-500">Overlays a subtle transparent sponsor brand</p>
                </div>
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  className="rounded border-slate-850 bg-slate-950 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
              </div>

              <button
                onClick={updateGraphics}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-semibold py-2.5 rounded-xl text-xs tracking-wider uppercase transition-colors"
              >
                Apply Graphic Layers
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Outbound RTMP outputs, YouTube help guide, Camera Previews list */}
        <div className="space-y-6">
          
          {/* Active Camera previews monitoring panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-500" /> Connected Camera Feeds
            </h2>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {Object.keys(cameras).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-650 border border-dashed border-slate-850 rounded-xl">
                  No camera operators online
                </div>
              ) : (
                Object.keys(cameras).map((camId) => {
                  const cam = cameras[camId];
                  return (
                    <div key={camId} className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{cam.name}</p>
                          <p className="text-[9px] text-slate-500 truncate">{cam.device} ({cam.network})</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-right flex-shrink-0 font-semibold space-y-0.5">
                        <p className="text-emerald-400 font-mono">BAT: {cam.battery}%</p>
                        <p className="text-slate-500">SIG: {cam.signal}/4 bars</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Outbound RTMP stream outputs config */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-rose-500" /> Stream Destinations
              </h2>
              
              <button
                type="button"
                onClick={() => setShowYoutubeHelp(!showYoutubeHelp)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Guide
              </button>
            </div>

            {/* YouTube Guide Panel */}
            {showYoutubeHelp && (
              <div className="bg-blue-600/10 border border-blue-500/20 text-xs rounded-xl p-4 space-y-2 text-slate-350">
                <h4 className="font-bold text-blue-400 flex items-center gap-1.5">
                  How to get YouTube RTMP settings:
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                  <li>Go to your <strong>YouTube Studio Dashboard</strong>.</li>
                  <li>Click <strong>Create</strong> (top right) and select <strong>Go Live</strong>.</li>
                  <li>Under the <strong>Stream Settings</strong> tab, locate the <strong>Stream URL</strong>.</li>
                  <li>Copy and paste it into the <em>RTMP Server Target URL</em> input below.</li>
                  <li>Find the <strong>Stream Key</strong> (revealed / masked). Copy it into the <em>Stream Key</em> input.</li>
                  <li>Toggle YouTube Live on and click Update.</li>
                </ol>
              </div>
            )}

            <form onSubmit={handleRtmpUpdate} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-300">YouTube Live</h3>
                  <p className="text-[10px] text-slate-500">Push to YouTube Studio live encoder</p>
                </div>
                <input
                  type="checkbox"
                  checked={streamTargets.youtube}
                  onChange={(e) => setStreamTargets({ ...streamTargets, youtube: e.target.checked })}
                  className="rounded border-slate-850 bg-slate-950 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-300">Facebook Live</h3>
                  <p className="text-[10px] text-slate-500">Push to Facebook Producer Portal</p>
                </div>
                <input
                  type="checkbox"
                  checked={streamTargets.facebook}
                  onChange={(e) => setStreamTargets({ ...streamTargets, facebook: e.target.checked })}
                  className="rounded border-slate-850 bg-slate-950 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="border-t border-slate-850 pt-3 space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">RTMP Server Target URL</label>
                  <input
                    type="text"
                    value={streamTargets.rtmpServer}
                    onChange={(e) => setStreamTargets({ ...streamTargets, rtmpServer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Stream Key</label>
                  <input
                    type="password"
                    value={streamTargets.streamKey}
                    onChange={(e) => setStreamTargets({ ...streamTargets, streamKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">YouTube Live Video ID (For Watch Portal Player)</label>
                  <input
                    type="text"
                    placeholder="e.g. dQw4w9WgXcQ (copied from watch link)"
                    value={youtubeId}
                    onChange={(e) => setYoutubeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-400 focus:outline-none placeholder-slate-600"
                  />
                  <p className="text-[9px] text-slate-550 leading-relaxed mt-1">
                    Enter the unique letters after <code className="text-blue-400 font-mono">v=</code> in your YouTube live stream link to embed the stream player.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full font-semibold py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-200 active:scale-[0.98] ${
                  isRtmpSaved
                    ? 'bg-emerald-650 hover:bg-emerald-600 text-white border border-emerald-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750'
                }`}
              >
                {isRtmpSaved ? '✓ Outbound Streams Saved!' : 'Update Outbound Streams'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
