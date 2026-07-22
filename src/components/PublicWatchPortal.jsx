import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Tv, Radio, Calendar, Heart, ShieldAlert, Users, MessageSquare, Send, Share2, Check, Smile, Volume2, VolumeX } from 'lucide-react';

export default function PublicWatchPortal({ initialEventCode, onLeave }) {
  const [eventCode] = useState(initialEventCode || 'PV-101');
  const [status, setStatus] = useState('idle');
  const [eventTitle, setEventTitle] = useState('PAVALAM TV Live Telecast');
  const [eventDescription, setEventDescription] = useState('Enjoy high quality live streaming.');
  const [connectionError, setConnectionError] = useState(null);
  
  // Dynamic stats
  const [likeCount, setLikeCount] = useState(148);
  const [hasLiked, setHasLiked] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Live Wishes / Chat Board
  const [wishes, setWishes] = useState([
    { id: 1, name: 'Palani Kumar', text: 'ஸ்ரீ பவளம்மன் துணை! நேரலை அருமை 🙏' },
    { id: 2, name: 'Saraswathi', text: 'மிகவும் அருமையான ஒளிபரப்பு வாழ்த்துக்கள்!' },
    { id: 3, name: 'Ramesh Krishnan', text: 'Om Namah Shivaya! Blessings from Chennai.' }
  ]);
  const [viewerName, setViewerName] = useState('');
  const [wishText, setWishText] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const queueRef = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Socket initialization
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
      role: 'viewer'
    });

    socket.on('room-state', (roomState) => {
      setStatus(roomState.status);
      setEventTitle(roomState.title || 'PAVALAM TV Live Broadcast');
      setEventDescription(roomState.description || 'Welcome to our live telecast.');
    });

    socket.on('event-status-changed', ({ status: nextStatus, title, description }) => {
      setStatus(nextStatus);
      if (title) setEventTitle(title);
      if (description) setEventDescription(description);
      if (nextStatus !== 'live') {
        setIsStreamActive(false);
      }
    });

    // Real-time viewer count sync
    socket.on('viewer-count-updated', (count) => {
      setViewerCount(count || 1);
    });

    // Real-time chat/wishes sync
    socket.on('receive-chat-msg', (newWish) => {
      setWishes(prev => [...prev, newWish]);
    });

    // Listen to real-time WebM stream chunks relayed from Host Console
    socket.on('viewer-stream-chunk', (chunk) => {
      setIsStreamActive(true);
      const arrayBuffer = new Uint8Array(chunk);
      const sb = sourceBufferRef.current;
      
      if (sb) {
        if (!sb.updating && queueRef.current.length === 0) {
          try {
            sb.appendBuffer(arrayBuffer);
          } catch (e) {
            console.error('Error appending WebM stream chunk directly:', e);
          }
        } else {
          queueRef.current.push(arrayBuffer);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [eventCode]);

  // Initialize MediaSource Extensions (MSE) pipeline to pipe WebSockets binary chunks to native video player
  useEffect(() => {
    if (status !== 'live' || !videoRef.current) return;

    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    videoRef.current.src = URL.createObjectURL(mediaSource);

    const onSourceOpen = () => {
      try {
        if (mediaSource.sourceBuffers.length > 0) return; // Prevent duplicate additions
        
        // Create Ebml decoder buffer with vp8 video & opus audio codec support
        const sb = mediaSource.addSourceBuffer('video/webm; codecs="vp8,opus"');
        sourceBufferRef.current = sb;

        sb.addEventListener('updateend', () => {
          if (queueRef.current.length > 0 && !sb.updating) {
            const nextChunk = queueRef.current.shift();
            try {
              sb.appendBuffer(nextChunk);
            } catch (e) {
              console.error('Error appending queued chunk:', e);
            }
          }
        });
      } catch (e) {
        console.error('Failed to register MediaSource source buffer:', e);
      }
    };

    mediaSource.addEventListener('sourceopen', onSourceOpen);

    return () => {
      if (mediaSource.readyState === 'open') {
        try {
          mediaSource.endOfStream();
        } catch (e) {}
      }
      mediaSource.removeEventListener('sourceopen', onSourceOpen);
      mediaSourceRef.current = null;
      sourceBufferRef.current = null;
      queueRef.current = [];
    };
  }, [status]);

  // Scroll wishes to bottom when updated
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [wishes]);

  const handleLike = () => {
    if (!hasLiked) {
      setLikeCount(prev => prev + 1);
      setHasLiked(true);
    } else {
      setLikeCount(prev => prev - 1);
      setHasLiked(false);
    }
  };

  const handleSendWish = (e) => {
    e.preventDefault();
    if (!wishText.trim()) return;

    const nameToUse = viewerName.trim() || 'Anonymous Devotee';
    const newWish = {
      id: Date.now(),
      name: nameToUse,
      text: wishText.trim()
    };

    // Add locally
    setWishes(prev => [...prev, newWish]);
    setWishText('');

    // Emit to socket so other viewers see it instantly
    if (socketRef.current) {
      socketRef.current.emit('send-chat-msg', newWish);
    }
  };

  const sharePortalLink = () => {
    const link = `${window.location.origin}/?role=viewer&code=${eventCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareToWhatsApp = () => {
    const link = `${window.location.origin}/?role=viewer&code=${eventCode}`;
    const text = encodeURIComponent(`🔴 Watch "${eventTitle}" live on PAVALAM TV! Click link: `);
    window.open(`https://api.whatsapp.com/send?text=${text}${encodeURIComponent(link)}`, '_blank');
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handlePlayOverlayClick = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.play().catch(err => console.warn('Overlay play failed:', err));
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#090d16] text-slate-100 min-h-screen font-sans selection:bg-rose-500/25 selection:text-rose-200">
      
      {/* Background ambient lighting glow */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-rose-600/5 rounded-full filter blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full filter blur-[100px] pointer-events-none"></div>

      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-[#090d16]/75 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 border border-red-500/25 text-red-500 p-2.5 rounded-2xl shadow-inner animate-pulse">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-200 tracking-tight flex items-center gap-2">
              PAVALAM TV <span className="text-[10px] text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded bg-rose-500/5">LIVE WATCH PORTAL</span>
            </h1>
          </div>
        </div>
        <button
          onClick={onLeave}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-900 px-4 py-2 rounded-xl font-semibold transition-all hover:bg-slate-850 active:scale-95"
        >
          Exit Watch Page
        </button>
      </header>

      {connectionError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold px-8 py-3 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 animate-bounce" />
          <span>{connectionError}. Connection to streaming backend failed. Trying to reconnect...</span>
        </div>
      )}

      {/* Main Watch Layout Container */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 md:p-8 max-w-[1400px] mx-auto w-full relative z-10">
        
        {/* Left 2 Columns: Video Player & Details */}
        <div className="lg:col-span-2 space-y-6 flex flex-col justify-start">
          
          {/* Video Player Frame */}
          <div className="w-full bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden aspect-video shadow-2xl relative group">
            {status === 'live' ? (
              <div className="w-full h-full bg-black relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  controls
                  muted={isMuted}
                  className="w-full h-full object-contain"
                />
                
                {isStreamActive && isMuted && (
                  /* Autoplay Audio Block Banner */
                  <button
                    onClick={handlePlayOverlayClick}
                    className="absolute bottom-16 left-6 right-6 bg-rose-650/90 hover:bg-rose-600 backdrop-blur-sm text-white px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-extrabold shadow-2xl transition-all hover:scale-[1.01] active:scale-95 animate-bounce z-10"
                  >
                    <span className="flex items-center gap-2">
                      <VolumeX className="w-4 h-4 text-rose-200 animate-pulse" />
                      TAP TO UNMUTE LIVE BROADCAST 🔊
                    </span>
                    <span className="border border-white/20 bg-white/10 px-2.5 py-0.5 rounded text-[10px]">TAP</span>
                  </button>
                )}

                {!isStreamActive && (
                  /* Connecting Stream State */
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/95 z-10">
                    <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Connecting Live Stream Feed...</span>
                    <p className="text-[11px] text-slate-500 mt-2">Waiting for the host broadcast transmitter to push media packets.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Broadcast Offline State */
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#0c121e]">
                <div className="p-5 bg-[#121b2d] rounded-full border border-slate-800 animate-pulse mb-4">
                  <Tv className="w-14 h-14 text-slate-500" />
                </div>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Broadcast Offline</span>
                <p className="text-xs text-slate-500 max-w-sm mt-2.5 leading-relaxed">
                  The live stream is currently offline or waiting for the host to start. Please stay tuned or check back soon!
                </p>
              </div>
            )}
          </div>

          {/* Stream Details Card */}
          <div className="w-full bg-[#0d1524] border border-slate-850 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-1.5`}>
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                    LIVE STREAM
                  </span>
                  
                  <span className="text-slate-650 text-xs">•</span>
                  
                  <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono">
                    Code: {eventCode}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-200 tracking-tight leading-tight">
                  {eventTitle}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">{eventDescription}</p>
              </div>

              {/* Like widget */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  disabled={!isStreamActive}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                    isStreamActive
                      ? 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-350 cursor-pointer'
                      : 'bg-slate-900/50 border-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border self-start ${
                    hasLiked
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-md shadow-rose-500/5'
                      : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>Like ({likeCount})</span>
                </button>
              </div>
            </div>

            {/* Social Share & Portal Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-850 pt-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs">Devotional & Event Broadcast Network</span>
              </div>
              
              <div className="flex items-center sm:justify-end gap-2">
                <button
                  onClick={sharePortalLink}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied Watch URL!' : 'Share URL'}</span>
                </button>
                <button
                  onClick={shareToWhatsApp}
                  className="bg-emerald-650 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/5"
                >
                  WhatsApp Share
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Chat Wishes Wall & Active Viewers */}
        <div className="lg:col-span-1 flex flex-col h-full space-y-6">
          
          {/* Wishes Wall card */}
          <div className="bg-[#0d1524] border border-slate-850 rounded-3xl p-6 flex flex-col flex-1 shadow-xl max-h-[600px] lg:max-h-[none]">
            
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-extrabold uppercase text-slate-300 tracking-wider">Devotee Wishes Wall</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-850 px-3 py-1 rounded-xl text-xs text-slate-400 font-semibold">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>{viewerCount} Live</span>
              </div>
            </div>

            {/* Wishes message stream */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 min-h-[220px] max-h-[350px] lg:max-h-none scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
              {wishes.map((wish) => (
                <div key={wish.id} className="bg-slate-950/50 border border-slate-900 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-gradient-to-tr from-rose-500 to-indigo-500 rounded-full flex items-center justify-center">
                      <Smile className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-indigo-400">{wish.name}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pl-5">{wish.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Wishes input form */}
            <form onSubmit={handleSendWish} className="mt-4 border-t border-slate-850 pt-4 space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Your Name (பெயர்)"
                  value={viewerName}
                  onChange={(e) => setViewerName(e.target.value)}
                  maxLength={25}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-slate-350 focus:outline-none focus:border-rose-500/50 placeholder-slate-700 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Type your blessings/wishes (வாழ்த்துக்கள்)"
                  value={wishText}
                  onChange={(e) => setWishText(e.target.value)}
                  maxLength={100}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-rose-500/50 placeholder-slate-700 transition-colors"
                />
                <button
                  type="submit"
                  className="bg-rose-650 hover:bg-rose-600 text-white rounded-xl px-4 flex items-center justify-center transition-all active:scale-95 shadow-md shadow-rose-500/5"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

          </div>

        </div>

      </main>
    </div>
  );
}
