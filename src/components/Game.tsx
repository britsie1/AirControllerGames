import React, { useEffect, useRef } from 'react';
import type { Player } from '../hooks/usePeer';

interface GameProps {
  players: Record<string, Player>;
}

interface VisualState {
  x: number;
  y: number;
}

export const Game: React.FC<GameProps> = ({ players }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualStates = useRef<Record<string, VisualState>>({});
  const requestRef = useRef<number>(0);

  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid for depth
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    Object.values(players).forEach((player, index) => {
      // Initialize visual state if not exists
      if (!visualStates.current[player.id]) {
        visualStates.current[player.id] = { x: player.x, y: player.y };
      }

      // Interpolate visual state towards target (player.x, player.y)
      // Factor of 0.1 for smooth movement
      const vs = visualStates.current[player.id];
      vs.x = lerp(vs.x, player.x, 0.1);
      vs.y = lerp(vs.y, player.y, 0.1);

      // Draw player
      const x = vs.x * canvas.width;
      const y = vs.y * canvas.height;
      const radius = 20;

      // Glow effect
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
      const color = colors[index % colors.length];

      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, x, y - radius - 10);
    });

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
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
  }, [players]);

  return (
    <div className="w-full h-full bg-slate-950 overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      <div className="absolute top-4 left-4 p-4 bg-slate-900/50 backdrop-blur rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Live Controllers</h3>
        <div className="flex gap-2">
          {Object.values(players).map((p, i) => (
            <div key={p.id} className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] }} />
          ))}
        </div>
      </div>
    </div>
  );
};
