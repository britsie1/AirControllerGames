import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { Player, MessageType } from '../hooks/usePeer';

interface BalanceBeamGameProps {
  players: Record<string, Player>;
  sendToPeer: (peerId: string, type: MessageType, payload: unknown) => void;
}

interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isOut: boolean;
  score: number;
  lastJumpProcessed: number;
  jumpCooldown: number;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#a855f7',
  '#6366f1', '#14b8a6', '#facc15', '#fb7185', '#94a3b8', '#475569'
];

export const BalanceBeamGame: React.FC<BalanceBeamGameProps> = ({ players, sendToPeer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'WARMUP' | 'PLAYING' | 'SCOREBOARD'>('WARMUP');
  const [countdown, setCountdown] = useState(5);
  const [gameTime, setGameTime] = useState(0);
  const [playerStates, setPlayerStates] = useState<Record<string, PlayerState>>({});
  
  const playerStatesRef = useRef<Record<string, PlayerState>>({});
  const playersRef = useRef(players);
  const beamAngleRef = useRef(0);
  const beamLengthRef = useRef(800);
  const beamWidthRef = useRef(120);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    playerStatesRef.current = playerStates;
  }, [playerStates]);

  useEffect(() => {
    if (gameState === 'WARMUP') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setGameState('PLAYING');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const activePlayers = Object.values(playerStatesRef.current).filter(p => !p.isOut);

      // Background decoration
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 100) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      if (gameState === 'PLAYING') {
        setGameTime(prev => prev + 1/60);
        
        // Shrink beam
        beamLengthRef.current = Math.max(200, 800 - gameTime * 10);
        beamWidthRef.current = Math.max(40, 120 - gameTime * 1);

        // Update beam angle based on players
        let totalTorque = 0;
        
        activePlayers.forEach(p => {
          // Local Y is along the beam
          const localY = (p.x - centerX) * Math.sin(beamAngleRef.current) + (p.y - centerY) * Math.cos(beamAngleRef.current);
          totalTorque += localY * 0.0001;
        });

        beamAngleRef.current += totalTorque;
        beamAngleRef.current *= 0.98; // Damping
      }

      // Draw Beam
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-beamAngleRef.current);
      
      ctx.fillStyle = '#1e293b';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#000';
      ctx.fillRect(-beamWidthRef.current / 2, -beamLengthRef.current / 2, beamWidthRef.current, beamLengthRef.current);
      
      // Pivot point
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();

      // Update and Draw Players
      const currentPlayers = Object.values(playersRef.current);
      currentPlayers.forEach((player, index) => {
        if (!playerStatesRef.current[player.id]) {
          const spawnY = (Math.random() - 0.5) * 600;
          setPlayerStates(prev => ({
            ...prev,
            [player.id]: {
              id: player.id,
              name: player.name,
              x: centerX,
              y: centerY + spawnY,
              vx: 0,
              vy: 0,
              radius: 20,
              color: COLORS[index % COLORS.length],
              isOut: false,
              score: 0,
              lastJumpProcessed: 0,
              jumpCooldown: 0
            }
          }));
          return;
        }

        const pState = playerStatesRef.current[player.id];
        if (pState.isOut) return;

        if (gameState === 'PLAYING') {
          // Physics
          // Acceleration from tilt
          const ax = (player.x - 0.5) * 0.5;
          const ay = (player.y - 0.5) * 0.5;
          
          pState.vx += ax;
          pState.vy += ay;

          // Apply beam tilt force (gravity towards "down")
          const gravityMag = 0.1;
          pState.vx += Math.sin(beamAngleRef.current) * gravityMag;
          pState.vy += Math.cos(beamAngleRef.current) * gravityMag;

          // Jump logic
          if (player.lastJumpTime && player.lastJumpTime > pState.lastJumpProcessed) {
            pState.lastJumpProcessed = player.lastJumpTime;
            // Jump away from center? Or just a random burst?
            // Let's make it a burst in the direction they are already moving
            const jumpPower = 5;
            const angle = Math.atan2(pState.vy, pState.vx);
            pState.vx += Math.cos(angle) * jumpPower;
            pState.vy += Math.sin(angle) * jumpPower;
          }

          pState.vx *= 0.95;
          pState.vy *= 0.95;

          pState.x += pState.vx;
          pState.y += pState.vy;

          // Collision with other players
          activePlayers.forEach(other => {
            if (other.id === pState.id) return;
            const dx = other.x - pState.x;
            const dy = other.y - pState.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = pState.radius + other.radius;
            if (dist < minDist) {
              const angle = Math.atan2(dy, dx);
              const overlap = minDist - dist;
              const force = 0.1;
              pState.vx -= Math.cos(angle) * overlap * force;
              pState.vy -= Math.sin(angle) * overlap * force;
            }
          });

          // Check if off beam
          // Rotate player position to beam-local coordinates
          const dx = pState.x - centerX;
          const dy = pState.y - centerY;
          const localX = dx * Math.cos(beamAngleRef.current) - dy * Math.sin(beamAngleRef.current);
          const localY = dx * Math.sin(beamAngleRef.current) + dy * Math.cos(beamAngleRef.current);

          if (Math.abs(localX) > beamWidthRef.current / 2 || Math.abs(localY) > beamLengthRef.current / 2) {
            pState.isOut = true;
            pState.score = Math.floor(gameTime);
            
            // Send to peer
            sendToPeer(pState.id, 'WIN', {
              time: `${pState.score}s`,
              position: Object.values(playerStatesRef.current).filter(ps => !ps.isOut).length + 1
            });
          }
        }

        // Draw Player
        ctx.shadowBlur = 15;
        ctx.shadowColor = pState.color;
        ctx.fillStyle = pState.color;
        ctx.beginPath();
        ctx.arc(pState.x, pState.y, pState.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pState.name, pState.x, pState.y - pState.radius - 10);
      });

      // Check end game
      if (gameState === 'PLAYING') {
        const anyAlive = Object.values(playerStatesRef.current).some(p => !p.isOut);
        if (!anyAlive && Object.keys(playerStatesRef.current).length > 0) {
          setGameState('SCOREBOARD');
        }
      }

      requestRef.current = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, gameTime]);

  const results = useMemo(() => {
    return Object.values(playerStates).map(p => ({
      name: p.name,
      score: p.score,
      color: p.color
    })).sort((a, b) => b.score - a.score);
  }, [playerStates]);

  return (
    <div className="w-full h-full bg-slate-950 overflow-hidden relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      
      <div className="absolute top-8 left-8">
        <div className="text-slate-500 uppercase tracking-widest text-xs font-bold mb-1">Survive Time</div>
        <div className="text-4xl font-black text-white font-mono">{Math.floor(gameTime)}s</div>
      </div>

      {gameState === 'WARMUP' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <h2 className="text-4xl font-bold text-white mb-4 uppercase tracking-tighter italic">Balance Beam</h2>
          <p className="text-xl text-slate-200 mb-8 text-center max-w-md">
            Stay on the beam! It's shrinking and tilting!
          </p>
          <div className="text-8xl font-black text-white animate-bounce">
            {countdown}
          </div>
        </div>
      )}

      {gameState === 'SCOREBOARD' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-8">
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase">Game Over</h2>
              <p className="text-slate-400 text-xl font-medium">Who lasted the longest?</p>
            </div>

            <div className="space-y-4">
              {results.map((res, idx) => (
                <div 
                  key={res.name} 
                  className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm"
                  style={{ borderColor: `${res.color}44` }}
                >
                  <div className="flex items-center gap-6">
                    <span className="text-4xl font-black italic text-slate-700 w-12">#{idx + 1}</span>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: res.color }} />
                    <span className="text-2xl font-bold text-white">{res.name}</span>
                  </div>
                  <div className="text-3xl font-mono font-black text-white">
                    {res.score}s
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-600/30 uppercase tracking-widest"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
