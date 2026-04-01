import React, { useState, useEffect, useRef } from 'react';
import { usePeer } from '../hooks/usePeer';
import { Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface MobileControllerProps {
  hostId: string;
}

export const MobileController: React.FC<MobileControllerProps> = ({ hostId }) => {
  const { isConnected, sendMessage, error, winData } = usePeer(false, hostId);
  const sendMessageRef = useRef(sendMessage);
  
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const [isReady, setIsReady] = useState(false);
  const [vote, setVote] = useState<'FREE' | 'MAZE' | 'BALANCE' | null>(null);
  const [needsPermission, setNeedsPermission] = useState(() => {
    const DeviceMotion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    return typeof DeviceMotion.requestPermission === 'function';
  });
  const [debug, setDebug] = useState('');
  const [motionDisplay, setMotionDisplay] = useState({ x: 0, y: 0 });

  const lastSent = useRef(0);
  const JITTER_THRESHOLD = 0.03;
  const lastX = useRef(0.5);
  const lastY = useRef(0.5);

  const handleJump = () => {
    sendMessage('JUMP', null);
    // Visual feedback
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const startListening = useRef(() => {
    window.addEventListener('devicemotion', (event) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;

      const rawX = accel.x || 0;
      const rawY = accel.y || 0;
      
      // Update UI every 100ms only to save battery/renders
      const now = Date.now();
      if (now % 5 === 0) {
        setMotionDisplay({ x: rawX, y: rawY });
      }

      if (now - lastSent.current < 100) return; // 100ms interval (10Hz)

      // Normalize values (assuming phone is held vertically)
      let x = rawX / 10;
      let y = rawY / 10;

      // Flip and center
      x = 0.5 - (x * 0.5);
      y = 0.5 + (y * 0.5);

      // Clamp
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));

      // Eliminate jitter
      if (Math.abs(x - lastX.current) > JITTER_THRESHOLD || Math.abs(y - lastY.current) > JITTER_THRESHOLD) {
        lastX.current = x;
        lastY.current = y;
        sendMessageRef.current('MOVE', { x, y });
        lastSent.current = now;
      }
    });
  });

  useEffect(() => {
    const DeviceMotion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DeviceMotion.requestPermission !== 'function') {
      startListening.current();
    }
  }, []);

  const requestPermission = async () => {
    try {
      const DeviceMotion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DeviceMotion.requestPermission === 'function') {
        const response = await DeviceMotion.requestPermission();
        if (response === 'granted') {
          setNeedsPermission(false);
          startListening.current();
        }
      }
    } catch (err) {
      console.error('Permission error:', err);
      setDebug(`Permission failed: ${err}`);
    }
  };

  const toggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    sendMessage('READY', next);
  };

  const handleVote = (mode: 'FREE' | 'MAZE' | 'BALANCE') => {
    setVote(mode);
    sendMessage('VOTE', mode);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        <h2 className="text-2xl font-bold">Connecting to Host...</h2>
        {error && (
          <div className="p-4 bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  if (winData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-emerald-950 text-white text-center gap-8">
        <div className="bg-emerald-500 w-24 h-24 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/50 animate-bounce">
          <CheckCircle className="w-16 h-16 text-white" />
        </div>
        <div className="space-y-4">
          <h2 className="text-5xl font-black italic tracking-tighter">FINISH!</h2>
          <p className="text-emerald-200 text-xl font-medium">You completed the maze!</p>
        </div>

        <div className="w-full max-w-xs space-y-4">
          <div className="bg-emerald-900/50 p-6 rounded-2xl border border-emerald-800 backdrop-blur">
            <div className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-1">Clear Time</div>
            <div className="text-4xl font-mono font-black">{winData.time}</div>
          </div>

          <div className="bg-emerald-900/50 p-6 rounded-2xl border border-emerald-800 backdrop-blur">
            <div className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-1">Position</div>
            <div className="text-4xl font-black">
              {winData.position === 1 ? '1st' : 
               winData.position === 2 ? '2nd' : 
               winData.position === 3 ? '3rd' : 
               `${winData.position}th`}
            </div>
          </div>
        </div>

        <p className="text-emerald-400/60 text-sm">Wait for others to finish or the host to restart.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between h-full p-8 bg-slate-900">
      <div className="text-center space-y-2">
        <div className="bg-blue-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone className="text-white w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold italic tracking-tighter">CONTROLLER</h2>
        <p className="text-slate-400">Tilt your phone to move!</p>
      </div>

      <div className="w-full space-y-6">
        <div className="text-xs text-slate-500 font-mono text-center p-2 bg-slate-800/50 rounded-lg">
          Motion: X: {motionDisplay.x.toFixed(2)}, Y: {motionDisplay.y.toFixed(2)}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleVote('FREE')}
            className={`py-3 rounded-xl font-bold text-xs transition-all ${
              vote === 'FREE' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400 border-transparent' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            Free
          </button>
          <button
            onClick={() => handleVote('MAZE')}
            className={`py-3 rounded-xl font-bold text-xs transition-all ${
              vote === 'MAZE' 
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-400 border-transparent' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            Maze
          </button>
          <button
            onClick={() => handleVote('BALANCE')}
            className={`py-3 rounded-xl font-bold text-xs transition-all ${
              vote === 'BALANCE' 
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400 border-transparent' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            Beam
          </button>
        </div>

        {!needsPermission && isReady && (
          <button
            onClick={handleJump}
            className="w-full py-12 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-3xl font-black text-5xl transition-all shadow-lg shadow-red-600/40 border-b-8 border-red-800 active:border-b-0 active:translate-y-2 uppercase italic tracking-tighter"
          >
            Jump!
          </button>
        )}

        {needsPermission ? (
          <button
            onClick={requestPermission}
            className="w-full py-6 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-xl transition-all"
          >
            Enable Motion Sensors
          </button>
        ) : (
          <button
            onClick={toggleReady}
            className={`w-full py-8 rounded-3xl font-black text-3xl transition-all flex items-center justify-center gap-4 ${
              isReady 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-2 border-slate-700'
            }`}
          >
            {isReady ? <CheckCircle className="w-10 h-10" /> : null}
            {isReady ? 'READY!' : 'READY?'}
          </button>
        )}
      </div>

      <div className="text-xs text-slate-600 font-mono max-w-full truncate">
        Host ID: {hostId}
        {debug && <div className="text-red-800">{debug}</div>}
      </div>
    </div>
  );
};
