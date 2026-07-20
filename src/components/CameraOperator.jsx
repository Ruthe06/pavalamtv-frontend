import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Camera, CameraOff, Mic, MicOff, Wifi, Battery, RefreshCw, LogOut, Radio, Info, Zap } from 'lucide-react';

export default function CameraOperator({ initialEventCode, onLeave }) {
  const [eventCode, setEventCode] = useState(initialEventCode || '');
  const [cameraName, setCameraName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState('user'); // user = front, environment = back
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [networkType, setNetworkType] = useState('WiFi');
  const [signalStrength, setSignalStrength] = useState(4); // 1-4 bars
  const [networkMode, setNetworkMode] = useState('Hybrid'); // WiFi, Mobile Data, Hybrid
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // hostSocketId -> RTCPeerConnection

  // Detect battery and browser info
  useEffect(() => {
    // Battery Status API
    if (navigator.getBattery) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          const level = Math.round(battery.level * 100);
          setBatteryLevel(level);
          if (socketRef.current) {
            socketRef.current.emit('update-camera-status', { battery: level });
          }
        });
      });
    }

    // Network connection detection
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const updateNetInfo = () => {
        const type = connection.type === 'wifi' ? 'WiFi' : 'Mobile Data (4G/5G)';
        setNetworkType(type);
        setSignalStrength(connection.downlink > 5 ? 4 : connection.downlink > 2 ? 3 : 2);
        if (socketRef.current) {
          socketRef.current.emit('update-camera-status', { network: type, signal: connection.downlink > 2 ? 4 : 2 });
        }
      };
      connection.addEventListener('change', updateNetInfo);
      updateNetInfo();
    }

    // Get Device Name / Info
    const userAgent = navigator.userAgent;
    let device = 'Mobile Device';
    if (userAgent.match(/iPhone/i)) device = 'iPhone';
    else if (userAgent.match(/Android/i)) device = 'Android Smartphone';
    else if (userAgent.match(/iPad/i)) device = 'iPad';
    else device = 'Web Client';
    setDeviceInfo(device);

    return () => {
      stopCamera();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const startCamera = async (currentFacingMode = facingMode) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: videoEnabled ? {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: audioEnabled
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Check for flashlight/torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setTimeout(() => {
          try {
            const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
            setHasTorch(!!capabilities.torch);
          } catch (e) {
            setHasTorch(false);
          }
        }, 500);
      }

      // If already connected, replace tracks in all active peer connections
      Object.keys(peerConnectionsRef.current).forEach((hostId) => {
        const pc = peerConnectionsRef.current[hostId];
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        });
      });

      setStatusMessage('Camera stream initialized successfully');
    } catch (err) {
      console.error('Error starting media capture:', err);
      setStatusMessage('Camera error: Permissions denied or busy');
    }
  };

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!eventCode || !cameraName) {
      setStatusMessage('Please enter both code and name');
      return;
    }

    setIsConnecting(true);
    setStatusMessage('Connecting to signaling server...');

    // Socket.io initialization
    const serverUrl = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : `http://${window.location.hostname}:5000`);
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatusMessage('Connected to room signaling server');
      socket.emit('join-room', {
        eventCode,
        role: 'camera',
        details: {
          name: cameraName,
          battery: batteryLevel,
          signal: signalStrength,
          network: networkType,
          device: deviceInfo,
          isFront: facingMode === 'user',
          audioEnabled,
          videoEnabled
        }
      });
      setIsJoined(true);
      setIsConnecting(false);
      startCamera();
    });

    socket.on('event-status-changed', ({ status }) => {
      if (status === 'idle') {
        alert('Live Broadcast stopped by Super Admin. Camera disconnected.');
        handleDisconnect();
      }
    });

    socket.on('connect_error', () => {
      setStatusMessage('Signaling Server Unreachable. Connecting locally...');
      setIsConnecting(false);
      // Fallback mockup mode for testing UI without backend server
      setIsJoined(true);
      startCamera();
    });

    // Handle incoming WebRTC connection request from host
    socket.on('webrtc-signal', async ({ senderSocketId, signal }) => {
      let pc = peerConnectionsRef.current[senderSocketId];

      if (signal.type === 'offer') {
        if (!pc) {
          pc = createPeerConnection(senderSocketId);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-signal', {
          targetSocketId: senderSocketId,
          signal: { type: 'answer', sdp: pc.localDescription.sdp }
        });
      } else if (signal.candidate) {
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        }
      }
    });

    socket.on('camera-disconnected', (id) => {
      if (peerConnectionsRef.current[id]) {
        peerConnectionsRef.current[id].close();
        delete peerConnectionsRef.current[id];
      }
    });
  };

  const createPeerConnection = (hostSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnectionsRef.current[hostSocketId] = pc;

    // Add local tracks to WebRTC connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-signal', {
          targetSocketId: hostSocketId,
          signal: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with host ${hostSocketId}: ${pc.connectionState}`);
    };

    return pc;
  };

  const toggleAudio = () => {
    const newVal = !audioEnabled;
    setAudioEnabled(newVal);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = newVal);
    }
    if (socketRef.current) {
      socketRef.current.emit('update-camera-status', { audioEnabled: newVal });
    }
  };

  const toggleVideo = () => {
    const newVal = !videoEnabled;
    setVideoEnabled(newVal);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = newVal);
    }
    if (socketRef.current) {
      socketRef.current.emit('update-camera-status', { videoEnabled: newVal });
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setTorchEnabled(false);
    startCamera(nextMode);
    if (socketRef.current) {
      socketRef.current.emit('update-camera-status', { isFront: nextMode === 'user' });
    }
  };

  const toggleTorch = async () => {
    try {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        const nextTorch = !torchEnabled;
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchEnabled(nextTorch);
        setStatusMessage(nextTorch ? 'Flashlight ON' : 'Flashlight OFF');
      }
    } catch (err) {
      console.error('Flashlight error:', err);
      setStatusMessage('Flashlight not supported on this lens');
    }
  };

  // Simulate network mode switching for Hybrid mode
  const simulateNetworkFailover = () => {
    if (networkMode === 'Hybrid') {
      setStatusMessage('WiFi Disconnected! Auto-switching to Mobile Data (4G)...');
      setNetworkType('Mobile Data (4G)');
      setSignalStrength(3);
      setTimeout(() => {
        setStatusMessage('Reconnected to main WiFi. Switched back automatically!');
        setNetworkType('WiFi');
        setSignalStrength(4);
      }, 4000);
    }
  };

  const handleDisconnect = () => {
    stopCamera();
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setIsJoined(false);
    onLeave();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {!isJoined ? (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full mb-2">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Camera Portal</h2>
              <p className="text-sm text-slate-400">Stream high-quality live video directly from your smartphone browser.</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Event Access Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PV-101"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Camera Operator Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Camera Left / Ravi"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl py-3.5 font-semibold text-sm transition-all shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] disabled:opacity-50"
              >
                {isConnecting ? 'Registering Camera...' : 'Join Broadcast'}
              </button>
            </form>

            {statusMessage && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 text-center flex items-center justify-center gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative h-full">
          {/* Top Status Bar overlay */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-slate-950/80 to-transparent p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 bg-slate-950/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-medium tracking-wide uppercase text-slate-300">LIVE FEED</span>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/5 text-xs">
              <div className="flex items-center gap-1 text-slate-300">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span>{batteryLevel}%</span>
              </div>
              <span className="w-px h-3 bg-white/10"></span>
              <div className="flex items-center gap-1 text-slate-300" onClick={simulateNetworkFailover}>
                <Wifi className={`w-4 h-4 ${signalStrength > 2 ? 'text-blue-400' : 'text-amber-400 animate-pulse'}`} />
                <span>{networkType}</span>
              </div>
            </div>
          </div>

          {/* Full Screen Live Viewport */}
          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
            {videoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <CameraOff className="w-16 h-16" />
                <span className="text-sm font-medium">Camera Feed Paused</span>
              </div>
            )}
          </div>

          {/* Bottom Actions Overlay */}
          <div className="bg-slate-950 border-t border-slate-900 px-6 py-5 flex flex-col gap-4">
            {/* Status alerts */}
            {statusMessage && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-center text-slate-400 truncate">
                {statusMessage}
              </div>
            )}

            <div className="flex items-center justify-around">
              {/* Audio button */}
              <button
                onClick={toggleAudio}
                className={`p-4 rounded-full border transition-all ${
                  audioEnabled
                    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                    : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                }`}
              >
                {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              {/* Video pause/resume */}
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full border transition-all ${
                  videoEnabled
                    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                    : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                }`}
              >
                {videoEnabled ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
              </button>

              {/* Flip camera */}
              <button
                onClick={switchCamera}
                disabled={!videoEnabled}
                className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-40"
              >
                <RefreshCw className="w-6 h-6" />
              </button>

              {/* Torch / Flashlight */}
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  disabled={!videoEnabled || facingMode === 'user'}
                  className={`p-4 rounded-full border transition-all ${
                    torchEnabled
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20 ring-2 ring-amber-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Zap className="w-6 h-6" />
                </button>
              )}

              {/* Leave Event */}
              <button
                onClick={handleDisconnect}
                className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/20"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>

            {/* Network hybrid settings display */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-2">
              <span className="font-medium">Device: {deviceInfo}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Mode: <strong className="text-slate-400">{networkMode} (Auto-Switch)</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
