import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Tv, Play, Radio, Calendar, Heart, ShieldAlert } from 'lucide-react';

export default function PublicWatchPortal({ initialEventCode, onLeave }) {
  const [eventCode] = useState(initialEventCode || 'PV-101');
  const [status, setStatus] = useState('idle');
  const [eventTitle, setEventTitle] = useState('PAVALAM TV Live Telecast');
  const [eventDescription, setEventDescription] = useState('Enjoy high quality live streaming.');
  const [youtubeId, setYoutubeId] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [likeCount, setLikeCount] = useState(24);
  const [hasLiked, setHasLiked] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    // Socket initialization
    const rawUrl = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : `http://${window.location.hostname}:5000`);
    const serverUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const socket = io(serverUrl, { transports: ['websocket', 'polling'], upgrade: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionError(null);
    });

    socket.on('connect_error', (err) => {
      setConnectionError(`Connection error: ${err.message || 'Server Unreachable'}`);
    });

    socket.emit('join-room', {
      eventCode,
      role: 'viewer'
    });

    socket.on('room-state', (roomState) => {
      setStatus(roomState.status);
      setEventTitle(roomState.title || 'PAVALAM TV Live Broadcast');
      setEventDescription(roomState.description || 'Welcome to our multi-camera live telecast.');
      setYoutubeId(roomState.youtubeId || '');
    });

    socket.on('event-status-changed', ({ status: nextStatus, title, description }) => {
      setStatus(nextStatus);
      if (title) setEventTitle(title);
      if (description) setEventDescription(description);
    });

    socket.on('youtube-id-updated', (nextYoutubeId) => {
      setYoutubeId(nextYoutubeId);
    });

    return () => {
      socket.disconnect();
    };
  }, [eventCode]);

  const handleLike = () => {
    if (!hasLiked) {
      setLikeCount(prev => prev + 1);
      setHasLiked(true);
    } else {
      setLikeCount(prev => prev - 1);
      setHasLiked(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-red-600/10 border border-red-500/20 text-red-500 p-2.5 rounded-xl">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-200">PAVALAM TV - Live Watch Portal</h1>
          </div>
        </div>
        <button
          onClick={onLeave}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-900 px-4 py-2 rounded-xl font-medium transition-colors"
        >
          Exit Watch Page
        </button>
      </header>

      {connectionError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold px-8 py-3 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 animate-bounce" />
          <span>{connectionError}. Connection to streaming backend failed.</span>
        </div>
      )}

      {/* Main Watch Container */}
      <main className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 max-w-[1200px] mx-auto w-full space-y-6">
        
        {/* Video Player Frame */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-2xl relative">
          {status === 'live' && youtubeId ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&modestbranding=1&rel=0&showinfo=0`}
              title="PAVALAM TV Live Player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          ) : (
            /* Broadcast Offline State */
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950">
              <div className="p-4 bg-slate-900/60 rounded-full border border-slate-800 animate-pulse mb-4">
                <Tv className="w-12 h-12 text-slate-500" />
              </div>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Broadcast Offline</span>
              <p className="text-xs text-slate-550 max-w-sm mt-2 leading-relaxed">
                The live stream is currently offline or waiting for the host to start. Please stay tuned or check back soon!
              </p>
            </div>
          )}
        </div>

        {/* Stream Details Card */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-6 shadow-xl">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                status === 'live' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-950 border-slate-850 text-slate-500'
              }`}>
                {status === 'live' ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                    LIVE STREAMING
                  </>
                ) : 'OFFLINE'}
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-450 text-xs font-mono">Event: {eventCode}</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-200 tracking-tight">{eventTitle}</h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">{eventDescription}</p>
          </div>

          {/* User engagement widgets */}
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-slate-850 pt-4 md:pt-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-400">Live Broadcast Portal</span>
            </div>
            
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                hasLiked
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-md shadow-red-500/5'
                  : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-300'
              }`}
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-500 text-red-500 animate-ping' : ''}`} />
              <span>Like ({likeCount})</span>
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
