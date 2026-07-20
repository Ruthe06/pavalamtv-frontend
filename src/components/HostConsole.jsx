import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { Video, VideoOff, Volume2, VolumeX, Grid, Layers, Sparkles, Tv, HelpCircle, Download, Square, Play, ShieldAlert, MonitorPlay, Maximize2, Minimize2 } from 'lucide-react';

export default function HostConsole({ initialEventCode, onLeave, isCleanPreview = false }) {
  const [eventCode] = useState(initialEventCode || 'PV-101');
  const [cameras, setCameras] = useState({});
  const [activeLayout, setActiveLayout] = useState('SOLO'); // SOLO, SPLIT, PIP
  const [primaryCamId, setPrimaryCamId] = useState(null);
  const [secondaryCamId, setSecondaryCamId] = useState(null);

  // Audio mix volumes (0 - 100)
  const [volumes, setVolumes] = useState({});
  const [mutedStates, setMutedStates] = useState({});

  // Overlay states synced from backend
  const [ticker, setTicker] = useState({ text: '', enabled: true, speed: 15, color: '#ffffff', bg: '#ef4444' });
  const [lowerThird, setLowerThird] = useState({ name: 'Speaker Name', role: 'Speaker Role', template: 'default', enabled: false });
  const [graphics, setGraphics] = useState({ logo: '', watermark: true, logoEnabled: true });
  const [status, setStatus] = useState('idle');
  const [rtmpOutputs, setRtmpOutputs] = useState({ youtube: false, facebook: false, rtmpServer: '', streamKey: '' });
  const [connectionError, setConnectionError] = useState(null);

  // Input states for updating lower thirds
  const [ltName, setLtName] = useState('Priest Soundararajan');
  const [ltRole, setLtRole] = useState('Head Archagar');
  const [ltEnabled, setLtEnabled] = useState(false);

  // Recording status
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingTime, setRecordingTime] = useState(0);

  // References
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({}); // cameraSocketId -> RTCPeerConnection
  const streamObjectsRef = useRef({}); // cameraSocketId -> MediaStream (WebRTC)
  const videoElementsRef = useRef({}); // cameraSocketId -> HTMLVideoElement refs

  // Refs to allow the draw loop (compositeCanvas) to always read the latest state
  // without triggering a socket reconnect via useEffect dependencies.
  const activeLayoutRef = useRef(activeLayout);
  const primaryCamIdRef = useRef(primaryCamId);
  const secondaryCamIdRef = useRef(secondaryCamId);
  const tickerRef = useRef(ticker);
  const lowerThirdRef = useRef(lowerThird);
  const graphicsRef = useRef(graphics);
  const camerasRef = useRef(cameras);

  useEffect(() => { activeLayoutRef.current = activeLayout; }, [activeLayout]);
  useEffect(() => { primaryCamIdRef.current = primaryCamId; }, [primaryCamId]);
  useEffect(() => { secondaryCamIdRef.current = secondaryCamId; }, [secondaryCamId]);
  useEffect(() => { tickerRef.current = ticker; }, [ticker]);
  useEffect(() => { lowerThirdRef.current = lowerThird; }, [lowerThird]);
  useEffect(() => { graphicsRef.current = graphics; }, [graphics]);
  useEffect(() => { camerasRef.current = cameras; }, [cameras]);
  
  const rtmpRecorderRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    // If the event is live, start streaming canvas to server for viewers
    if (status === 'live') {
      console.log('Initiating direct live stream output push to server...');
      
      // Notify server to spawn FFmpeg only if RTMP targets are active
      if (socketRef.current && (rtmpOutputs.youtube || rtmpOutputs.facebook) && rtmpOutputs.streamKey) {
        const rtmpUrl = `${rtmpOutputs.rtmpServer}/${rtmpOutputs.streamKey}`;
        socketRef.current.emit('start-rtmp-stream', { rtmpUrl });
      }

      // Mix Audio and Video from Canvas
      try {
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasStream = canvas.captureStream(30); // 30 fps
          const compositeStream = new MediaStream();
          
          // Add video track
          compositeStream.addTrack(canvasStream.getVideoTracks()[0]);

          // Mix audios using Web Audio API if available
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const dest = audioCtx.createMediaStreamDestination();
            let hasAudioSources = false;

            Object.keys(streamObjectsRef.current).forEach(camId => {
              const stream = streamObjectsRef.current[camId];
              if (stream && stream.getAudioTracks().length > 0) {
                try {
                  const source = audioCtx.createMediaStreamSource(stream);
                  source.connect(dest);
                  hasAudioSources = true;
                } catch (e) {
                  console.warn(`Could not connect audio stream for camera ${camId}:`, e);
                }
              }
            });

            if (hasAudioSources && dest.stream.getAudioTracks().length > 0) {
              compositeStream.addTrack(dest.stream.getAudioTracks()[0]);
            }
          }

          // Start MediaRecorder in WebM format to stream back to Node.js
          const recorder = new MediaRecorder(compositeStream, {
            mimeType: 'video/webm;codecs=vp8,opus',
            videoBitsPerSecond: 300000 // 300 Kbps - optimized for free tier proxy limits
          });
          rtmpRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0 && socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('stream-chunk', event.data);
            }
          };

          recorder.start(1000); // Send WebM chunks every 1 second
          console.log('Direct RTMP canvas recorder started');
        }
      } catch (err) {
        console.error('Error starting direct RTMP canvas streaming MediaRecorder:', err);
      }
    } else {
      // Clean up and stop direct streaming
      if (rtmpRecorderRef.current) {
        try {
          rtmpRecorderRef.current.stop();
        } catch (e) {}
        rtmpRecorderRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.emit('stop-rtmp-stream');
      }
      console.log('Direct RTMP stream push stopped');
    }

    return () => {
      if (rtmpRecorderRef.current) {
        try {
          rtmpRecorderRef.current.stop();
        } catch (e) {}
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }
      if (socketRef.current) {
        socketRef.current.emit('stop-rtmp-stream');
      }
    };
  }, [status, rtmpOutputs]);
  
  // Canvas composition references
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // QR Code Join link
  const cameraJoinUrl = `${window.location.origin}/?role=camera&code=${eventCode}`;

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
      role: 'host'
    });

    socket.on('room-state', (roomState) => {
      setStatus(roomState.status);
      setTicker(roomState.ticker);
      setLowerThird(roomState.lowerThird);
      setGraphics(roomState.graphics);
      setLtName(roomState.lowerThird.name);
      setLtRole(roomState.lowerThird.role);
      setLtEnabled(roomState.lowerThird.enabled);
      if (roomState.rtmpOutputs) {
        setRtmpOutputs(roomState.rtmpOutputs);
      }
      
      const incomingCams = roomState.cameras || {};
      setCameras(incomingCams);
      initializeWebRTCConnections(incomingCams);
    });

    socket.on('rtmp-outputs-updated', (updatedRtmp) => {
      setRtmpOutputs(updatedRtmp);
    });

    socket.on('cameras-updated', (updatedCameras) => {
      setCameras(updatedCameras);
      // Synchronize connections: add new ones, remove stale ones
      initializeWebRTCConnections(updatedCameras);
    });

    socket.on('ticker-updated', (updatedTicker) => {
      setTicker(updatedTicker);
    });

    socket.on('lower-third-updated', (updatedLt) => {
      setLowerThird(updatedLt);
      setLtName(updatedLt.name);
      setLtRole(updatedLt.role);
      setLtEnabled(updatedLt.enabled);
    });

    socket.on('graphics-updated', (updatedGraphics) => {
      setGraphics(updatedGraphics);
    });

    socket.on('event-status-changed', ({ status: nextStatus }) => {
      setStatus(nextStatus);
      if (nextStatus === 'idle') {
        alert('Live Broadcast stopped by Super Admin. Disconnecting Host.');
        onLeave();
      }
    });

    // Handle WebRTC answers and candidates
    socket.on('webrtc-signal', async ({ senderSocketId, signal }) => {
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc) {
        if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal));
          } catch (e) {
            console.error('Error adding ice candidate', e);
          }
        }
      }
    });

    // Handle WebRTC cleanup when camera leaves
    socket.on('camera-disconnected', (cameraId) => {
      cleanupCameraConnection(cameraId);
    });

    // Start Canvas composition Loop
    requestRef.current = requestAnimationFrame(compositeCanvas);

    return () => {
      socket.disconnect();
      cancelAnimationFrame(requestRef.current);
      Object.keys(peerConnectionsRef.current).forEach(cleanupCameraConnection);
      stopRecording();
    };
  }, [eventCode]);

  // Clean up a closed camera connection
  const cleanupCameraConnection = (cameraId) => {
    if (peerConnectionsRef.current[cameraId]) {
      peerConnectionsRef.current[cameraId].close();
      delete peerConnectionsRef.current[cameraId];
    }
    if (streamObjectsRef.current[cameraId]) {
      delete streamObjectsRef.current[cameraId];
    }
    if (videoElementsRef.current[cameraId]) {
      delete videoElementsRef.current[cameraId];
    }
    if (primaryCamId === cameraId) {
      setPrimaryCamId(null);
    }
    if (secondaryCamId === cameraId) {
      setSecondaryCamId(null);
    }
    setCameras(prev => {
      const copy = { ...prev };
      delete copy[cameraId];
      return copy;
    });
  };

  // Build WebRTC call out to camera operators
  const initializeWebRTCConnections = async (currentCameras) => {
    Object.keys(currentCameras).forEach(async (camId) => {
      // If we don't have a peer connection yet, establish one
      if (!peerConnectionsRef.current[camId]) {
        console.log(`Initiating WebRTC offer to Camera: ${camId}`);
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnectionsRef.current[camId] = pc;

        // Listen for remote audio/video tracks
        pc.ontrack = (event) => {
          console.log(`Received track from camera ${camId}:`, event.streams[0]);
          streamObjectsRef.current[camId] = event.streams[0];
          
          // Force assign to local video element
          if (videoElementsRef.current[camId]) {
            videoElementsRef.current[camId].srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('webrtc-signal', {
              targetSocketId: camId,
              signal: event.candidate
            });
          }
        };

        // Create WebRTC Offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);

        socketRef.current.emit('webrtc-signal', {
          targetSocketId: camId,
          signal: { type: 'offer', sdp: pc.localDescription.sdp }
        });
      }
    });

    // Auto-assign primary camera if not selected
    const activeIds = Object.keys(currentCameras);
    if (activeIds.length > 0 && !primaryCamId) {
      setPrimaryCamId(activeIds[0]);
    }
    if (activeIds.length > 1 && !secondaryCamId) {
      setSecondaryCamId(activeIds[1]);
    }
  };

  // Canvas Compositing Loop (Program Output Generator)
  const compositeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      requestRef.current = requestAnimationFrame(compositeCanvas);
      return;
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Draw Background
    ctx.fillStyle = '#080B11';
    ctx.fillRect(0, 0, w, h);

    // Helpers to draw individual camera feeds (actual WebRTC or simulated test bars)
    const drawFeed = (camId, x, y, width, height, name) => {
      const videoEl = videoElementsRef.current[camId];
      const hasStream = streamObjectsRef.current[camId] && videoEl && videoEl.readyState >= 2;

      if (hasStream) {
        ctx.save();
        // Mirrors camera feed nicely if front cam
        if (camerasRef.current[camId]?.isFront) {
          ctx.translate(x + width, y);
          ctx.scale(-1, 1);
          ctx.drawImage(videoEl, 0, 0, width, height);
        } else {
          ctx.drawImage(videoEl, x, y, width, height);
        }
        ctx.restore();
      } else {
        // Render beautiful simulated camera test cards with SMPTE color bars
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, width, height);

        // SMPTE Bar Simulation
        const barWidth = width / 7;
        const colors = ['#ffffff', '#eeee00', '#00eeee', '#00ee00', '#ee00ee', '#ee0000', '#0000ee'];
        colors.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.fillRect(x + i * barWidth, y, barWidth, height * 0.7);
        });

        // Bottom dark bar with camera info
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y + height * 0.7, width, height * 0.3);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 20px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name || 'FEED OFFLINE / SIMULATION', x + width / 2, y + height * 0.85);

        // Oscillating sinewave to indicate active feed simulation
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const time = Date.now() / 200;
        for (let sx = 0; sx < width; sx += 5) {
          const sy = y + height * 0.5 + Math.sin(sx * 0.05 + time) * 15;
          if (sx === 0) ctx.moveTo(x + sx, sy);
          else ctx.lineTo(x + sx, sy);
        }
        ctx.stroke();
      }
    };

    // Render Scene Layouts
    if (activeLayoutRef.current === 'SOLO' && primaryCamIdRef.current) {
      drawFeed(primaryCamIdRef.current, 0, 0, w, h, camerasRef.current[primaryCamIdRef.current]?.name);
    } else if (activeLayoutRef.current === 'SPLIT') {
      const leftId = primaryCamIdRef.current;
      const rightId = secondaryCamIdRef.current || Object.keys(camerasRef.current).find(id => id !== leftId);

      if (leftId) drawFeed(leftId, 0, 0, w / 2, h, camerasRef.current[leftId]?.name);
      if (rightId) {
        drawFeed(rightId, w / 2, 0, w / 2, h, camerasRef.current[rightId]?.name);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(w / 2, 0, w / 2, h);
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAITING FOR CAMERA 2...', w * 0.75, h / 2);
      }
    } else if (activeLayoutRef.current === 'PIP') {
      const mainId = primaryCamIdRef.current;
      const pipId = secondaryCamIdRef.current || Object.keys(camerasRef.current).find(id => id !== mainId);

      if (mainId) drawFeed(mainId, 0, 0, w, h, camerasRef.current[mainId]?.name);
      if (pipId) {
        // Draw nested smaller camera frame on top right
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 4;
        const pw = w * 0.28;
        const ph = h * 0.28;
        const px = w - pw - 30;
        const py = 30;
        ctx.strokeRect(px, py, pw, ph);
        drawFeed(pipId, px, py, pw, ph, camerasRef.current[pipId]?.name);
      }
    }

    // --- Overlay Logo ---
    if (graphicsRef.current.logoEnabled && graphicsRef.current.logo) {
      const logoImg = new Image();
      logoImg.src = graphics.logo;
      try {
        // Just draw placeholder or let browser cache load it
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(30, 30, 110, 45);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px Outfit';
        ctx.fillText('PAVALAM TV', 42, 58);
      } catch (e) {}
    }

    // --- Overlay Watermark ---
    if (graphicsRef.current.watermark) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = '12px Outfit';
      ctx.textAlign = 'right';
      ctx.fillText('PAVALAM TV 🔴 LIVE BROADCAST SYSTEM', w - 30, h - 60);
    }

    // --- Overlay Lower Third ---
    if (lowerThirdRef.current.enabled) {
      const ltx = 50;
      const lty = h - 160;
      const ltw = 450;
      const lth = 75;

      // Draw lower third theme styling
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(ltx, lty, ltw, lth);
      
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(ltx, lty, 8, lth);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(lowerThirdRef.current.name, ltx + 24, lty + 30);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Outfit, sans-serif';
      ctx.fillText(lowerThirdRef.current.role, ltx + 24, lty + 55);
    }

    // --- Overlay Ticker (Running Text) ---
    if (tickerRef.current.enabled && tickerRef.current.text) {
      const tickerHeight = 40;
      const tickerY = h - tickerHeight;
      
      // Draw background bar
      ctx.fillStyle = tickerRef.current.bg || '#ef4444';
      ctx.fillRect(0, tickerY, w, tickerHeight);

      // Text scrolling math
      ctx.fillStyle = tickerRef.current.color || '#ffffff';
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'left';
      
      const charWidth = 9.5; // Average size multiplier
      const textWidth = tickerRef.current.text.length * charWidth;
      const timeMs = Date.now();
      const speedCoeff = (35 - (tickerRef.current.speed || 15)) * 0.02; // mapping slider to speed
      const offset = (timeMs * speedCoeff) % (textWidth + w);
      const textX = w - offset;

      ctx.fillText(tickerRef.current.text, textX, tickerY + 24);
      // Double render to create continuous running text effect if text is shorter
      if (textX + textWidth < w) {
        ctx.fillText(tickerRef.current.text, textX + textWidth + 150, tickerY + 24);
      }
    }

    requestRef.current = requestAnimationFrame(compositeCanvas);
  };

  // Update lower third settings to signaling room
  const handleLowerThirdSync = (e) => {
    e.preventDefault();
    if (socketRef.current) {
      socketRef.current.emit('update-lower-third', {
        name: ltName,
        role: ltRole,
        enabled: ltEnabled
      });
    }
  };

  const handleLowerThirdToggle = () => {
    const nextVal = !ltEnabled;
    setLtEnabled(nextVal);
    if (socketRef.current) {
      socketRef.current.emit('update-lower-third', {
        name: ltName,
        role: ltRole,
        enabled: nextVal
      });
    }
  };

  // Start Canvas Recording to downloadable file
  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setRecordedChunks([]);
    const stream = canvas.captureStream(30); // 30 FPS Capture

    // Find any audio tracks from current streams to combine
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioContext.createMediaStreamDestination();
    let hasAudio = false;

    Object.keys(streamObjectsRef.current).forEach((camId) => {
      const camStream = streamObjectsRef.current[camId];
      if (camStream && camStream.getAudioTracks().length > 0) {
        const source = audioContext.createMediaStreamSource(camStream);
        source.connect(dest);
        hasAudio = true;
      }
    });

    if (hasAudio) {
      // Combine canvas video tracks with WebRTC audio composition
      const audioTrack = dest.stream.getAudioTracks()[0];
      stream.addTrack(audioTrack);
    }

    const options = { mimeType: 'video/webm;codecs=vp9' };
    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        setRecordedChunks(prev => [...prev, e.data]);
      }
    };

    recorder.onstop = () => {
      console.log('Recording finalized.');
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // chunk every 1s
    setIsRecording(true);
    setRecordingTime(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    if (socketRef.current) {
      socketRef.current.emit('update-recording-status', true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    if (socketRef.current) {
      socketRef.current.emit('update-recording-status', false);
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pavalam-tv-${eventCode}-recording.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setRecordedChunks([]);
  };

  const toggleMute = (camId) => {
    const nextVal = !mutedStates[camId];
    setMutedStates(prev => ({ ...prev, [camId]: nextVal }));
    const videoEl = videoElementsRef.current[camId];
    if (videoEl) {
      videoEl.muted = nextVal;
    }
  };

  const changeVolume = (camId, val) => {
    setVolumes(prev => ({ ...prev, [camId]: val }));
    const videoEl = videoElementsRef.current[camId];
    if (videoEl) {
      videoEl.volume = val / 100;
    }
  };

  const getFormatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (isCleanPreview) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        {/* Compositor program output canvas */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="w-full h-full object-contain"
        />

        {/* Hidden WebRTC raw video buffers */}
        <div style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none', zIndex: -100 }}>
          {Object.keys(cameras).map((camId) => (
            <video
              key={camId}
              ref={(el) => {
                if (el) {
                  videoElementsRef.current[camId] = el;
                  if (streamObjectsRef.current[camId]) {
                    el.srcObject = streamObjectsRef.current[camId];
                  }
                }
              }}
              autoPlay
              playsInline
              muted={false} // Allow audio in clean preview
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen">
      {/* Hidden WebRTC raw video buffers */}
      <div style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none', zIndex: -100 }}>
        {Object.keys(cameras).map((camId) => (
          <video
            key={camId}
            ref={(el) => {
              if (el) {
                videoElementsRef.current[camId] = el;
                // Auto attach if stream is present
                if (streamObjectsRef.current[camId]) {
                  el.srcObject = streamObjectsRef.current[camId];
                }
              }
            }}
            autoPlay
            playsInline
            controls
            muted={mutedStates[camId] !== false}
          />
        ))}
      </div>

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur-md px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 border border-blue-500/20 text-blue-500 p-2.5 rounded-xl">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">HOST CONSOLE</span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">Event: {eventCode}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-200">Video Mixer & Program Compositor</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Recording Panel */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-4 py-1.5 rounded-xl">
            {isRecording ? (
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                <span className="text-xs font-semibold text-red-500 font-mono">REC {getFormatTime(recordingTime)}</span>
                <button
                  onClick={stopRecording}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg p-1.5 transition-colors"
                >
                  <Square className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {recordedChunks.length > 0 ? (
                  <button
                    onClick={downloadRecording}
                    className="flex items-center gap-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Recording
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-slate-500">Record System Offline</span>
                )}
                <button
                  onClick={startRecording}
                  disabled={status !== 'live'}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-lg p-1.5 transition-colors disabled:opacity-30"
                >
                  <Play className="w-4 h-4 text-emerald-500" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onLeave}
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-900 px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            Exit Console
          </button>
        </div>
      </header>

      {connectionError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold px-8 py-3 flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
          <span>{connectionError}. Make sure your Render backend is active and Netlify environment variables are fully built.</span>
        </div>
      )}

      {/* Console Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 p-8 max-w-[1600px] mx-auto w-full">
        
        {/* Left Column: Live Previews Grid */}
        <div className="xl:col-span-3 space-y-6 flex flex-col">
          
          {/* Main program output canvas monitor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <MonitorPlay className="w-4 h-4 text-blue-500" /> LIVE PROGRAM CANVAS (1080P COMPOSITE)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(`/?role=preview&code=${eventCode}`, '_blank')}
                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all active:scale-[0.97]"
                >
                  <Maximize2 className="w-3 h-3" /> Clean Feed (New Tab)
                </button>

                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                  status === 'live' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-950 border-slate-850 text-slate-500'
                }`}>
                  {status === 'live' ? 'BROADCASTING' : 'PROGRAM PREVIEW'}
                </span>
              </div>
            </div>
            
            <div className="bg-black rounded-xl overflow-hidden aspect-video border border-slate-850 relative">
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Camera switcher console grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Multi-Camera Feed Matrix</h2>
                <p className="text-xs text-slate-500">Select source tags to set primary and secondary slots</p>
              </div>

              {/* Layout buttons */}
              <div className="flex bg-slate-950 border border-slate-850 p-1.5 rounded-xl gap-1">
                {['SOLO', 'SPLIT', 'PIP'].map((lay) => (
                  <button
                    key={lay}
                    onClick={() => setActiveLayout(lay)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeLayout === lay ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {lay}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Previews Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1">
              {Object.keys(cameras).length === 0 ? (
                <div className="col-span-full bg-slate-950/60 border border-dashed border-slate-850 rounded-xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <VideoOff className="w-10 h-10 mb-2 text-slate-600" />
                  <span className="text-sm font-medium">No Cameras Online</span>
                  <span className="text-xs mt-1">Scan the QR code or share access link to connect device feeds.</span>
                </div>
              ) : (
                Object.keys(cameras).map((camId) => {
                  const cam = cameras[camId];
                  const isPrimary = primaryCamId === camId;
                  const isSecondary = secondaryCamId === camId;

                  return (
                    <div
                      key={camId}
                      className={`bg-slate-950 border rounded-xl overflow-hidden flex flex-col transition-all relative ${
                        isPrimary
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : isSecondary
                          ? 'border-amber-500 ring-2 ring-amber-500/20'
                          : 'border-slate-850 hover:border-slate-750'
                      }`}
                    >
                      {/* Thumbnail frame / preview (Canvas will mirror WebRTC feed or display bars) */}
                      <div className="aspect-video bg-slate-900 relative flex items-center justify-center overflow-hidden">
                        {streamObjectsRef.current[camId] ? (
                          <span className="text-xs text-blue-400 font-semibold px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded absolute top-2 left-2 z-10">WebRTC ACTIVE</span>
                        ) : (
                          <div className="flex flex-col items-center text-[10px] text-slate-600 select-none">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping mb-1.5"></span>
                            <span>TEST CARD SIMULATION</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-slate-950/20"></div>
                      </div>

                      {/* Info & action buttons */}
                      <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                            <span className="truncate">{cam.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">{cam.network} ({cam.battery}%)</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{cam.device}</span>
                        </div>

                        {/* Mixer controls */}
                        <div className="space-y-1.5">
                          {/* Volume slider */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleMute(camId)}
                              className="text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              {mutedStates[camId] ? (
                                <VolumeX className="w-3.5 h-3.5 text-red-500" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={volumes[camId] !== undefined ? volumes[camId] : 80}
                              onChange={(e) => changeVolume(camId, Number(e.target.value))}
                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>

                          {/* Switch buttons */}
                          <div className="grid grid-cols-2 gap-1 pt-1">
                            <button
                              onClick={() => setPrimaryCamId(camId)}
                              className={`text-[9px] font-bold py-1 px-1 rounded transition-colors ${
                                isPrimary ? 'bg-blue-600 text-white' : 'bg-slate-900 hover:bg-slate-850 text-slate-400'
                              }`}
                            >
                              Set Primary
                            </button>
                            <button
                              onClick={() => setSecondaryCamId(camId)}
                              className={`text-[9px] font-bold py-1 px-1 rounded transition-colors ${
                                isSecondary ? 'bg-amber-600 text-white' : 'bg-slate-900 hover:bg-slate-850 text-slate-400'
                              }`}
                            >
                              Set PIP/Split
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Overlay management & QR Enrollment */}
        <div className="space-y-6">
          {/* Lower third graphics card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" /> Lower Third Banner
            </h2>

            <form onSubmit={handleLowerThirdSync} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Speaker Name</label>
                <input
                  type="text"
                  value={ltName}
                  onChange={(e) => setLtName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Role / Designation</label>
                <input
                  type="text"
                  value={ltRole}
                  onChange={(e) => setLtRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                <span className="text-xs text-slate-400">Enable Lower Third</span>
                <button
                  type="button"
                  onClick={handleLowerThirdToggle}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    ltEnabled ? 'bg-blue-600' : 'bg-slate-800'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    ltEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 text-indigo-400 font-semibold py-2 rounded-xl text-xs transition-colors"
              >
                Sync Banner Info
              </button>
            </form>
          </div>

          {/* QR Code Enrollment card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wider flex items-center justify-center gap-2">
              <Grid className="w-4 h-4 text-emerald-500" /> Connect Camera Device
            </h2>
            
            <div className="bg-white p-4 rounded-2xl inline-block border border-slate-200">
              <QRCodeSVG
                value={cameraJoinUrl}
                size={140}
                level="M"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-300 font-semibold">Join QR Code Scanner</p>
              <p className="text-[10px] text-slate-500 px-3">Point a mobile camera to join immediately as a wireless camera feed.</p>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-[10px] text-slate-400 truncate select-all cursor-pointer">
              {cameraJoinUrl}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
