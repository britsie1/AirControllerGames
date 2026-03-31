import React, { useState, useEffect, useRef } from 'react';
import { usePeer } from '../hooks/usePeer';
import { Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface MobileControllerProps {
  hostId: string;
}

export const MobileController: React.FC<MobileControllerProps> = ({ hostId }) => {
  const { isConnected, sendMessage, error } = usePeer(false, hostId);
  const sendMessageRef = useRef(sendMessage);
  
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const [isReady, setIsReady] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [debug, setDebug] = useState('');

  const lastSent = useRef(0);
  const JITTER_THRESHOLD = 0.03;
  const lastX = useRef(0.5);
  const lastY = useRef(0.5);

  useEffect(() => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      setNeedsPermission(true);
    } else {
      startListening();
    }
  }, []);

  const requestPermission = async () => {
    try {
      const response = await (DeviceMotionEvent as any).requestPermission();
      if (response === 'granted') {
        setNeedsPermission(false);
        startListening();
      }
    } catch (err) {
      console.error('Permission error:', err);
      setDebug(`Permission failed: ${err}`);
    }
  };

  const [motionData, setMotionData] = useState({ x: 0, y: 0 });

  const startListening = () => {
    window.addEventListener('devicemotion', (event) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;

      const rawX = accel.x || 0;
      const rawY = accel.y || 0;
      setMotionData({ x: rawX, y: rawY });

      const now = Date.now();
      if (now - lastSent.current < 50) return; // 50ms interval (20Hz)

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
  };

  const toggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    sendMessage('READY', next);
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
          Motion: X: {motionData.x.toFixed(2)}, Y: {motionData.y.toFixed(2)}
        </div>
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
