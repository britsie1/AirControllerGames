import React, { useEffect, useRef, useMemo } from 'react';
import type { Player } from '../hooks/usePeer';
import { generateMaze } from '../utils/mazeGen';

interface MazeGameProps {
  players: Record<string, Player>;
}

interface MarbleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const MazeGame: React.FC<MazeGameProps> = ({ players }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maze = useMemo(() => generateMaze(31, 21), []);
  const marbleStates = useRef<Record<string, MarbleState>>({});
  const requestRef = useRef<number>(0);
  const playersRef = useRef(players);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellW = canvas.width / maze.width;
      const cellH = canvas.height / maze.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Maze Walls
      ctx.fillStyle = '#1e293b';
      for (let y = 0; y < maze.height; y++) {
        for (let x = 0; x < maze.width; x++) {
          if (maze.grid[y][x] === 1) {
            ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
          }
        }
      }

      // Draw Goal (Center)
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fbbf24';
      ctx.fillRect(maze.endX * cellW, maze.endY * cellH, cellW, cellH);
      ctx.shadowBlur = 0;

      // Update and Draw Marbles
      Object.values(playersRef.current).forEach((player, index) => {
        if (!marbleStates.current[player.id]) {
          // Start from corners or random edge points for fairness
          const starts = [
            { x: 1, y: 1 },
            { x: maze.width - 2, y: 1 },
            { x: 1, y: maze.height - 2 },
            { x: maze.width - 2, y: maze.height - 2 }
          ];
          const start = starts[index % starts.length];
          marbleStates.current[player.id] = {
            x: (start.x + 0.5) * cellW,
            y: (start.y + 0.5) * cellH,
            vx: 0,
            vy: 0,
            color: COLORS[index % COLORS.length]
          };
        }

        const marble = marbleStates.current[player.id];
        
        // Physics: Acceleration from tilt (player.x, player.y are 0-1 range)
        const ax = (player.x - 0.5) * 0.8;
        const ay = (player.y - 0.5) * 0.8;

        marble.vx += ax;
        marble.vy += ay;
        
        // Damping
        marble.vx *= 0.95;
        marble.vy *= 0.95;

        // Potential Next Position
        let nextX = marble.x + marble.vx;
        let nextY = marble.y + marble.vy;

        // Collision Detection (simple)
        const radius = Math.min(cellW, cellH) * 0.3;
        
        // Check wall collisions and bounce
        if (maze.grid[Math.floor(nextY / cellH)][Math.floor(nextX / cellW)] === 1) {
          // If hitting a wall, zero out velocity or bounce
          if (maze.grid[Math.floor(marble.y / cellH)][Math.floor(nextX / cellW)] === 1) {
            marble.vx *= -0.5;
            nextX = marble.x;
          }
          if (maze.grid[Math.floor(nextY / cellH)][Math.floor(marble.x / cellW)] === 1) {
            marble.vy *= -0.5;
            nextY = marble.y;
          }
        }

        marble.x = nextX;
        marble.y = nextY;

        // Draw Marble
        ctx.shadowBlur = 15;
        ctx.shadowColor = marble.color;
        ctx.fillStyle = marble.color;
        ctx.beginPath();
        ctx.arc(marble.x, marble.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

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
  }, [maze]);

  return (
    <div className="w-full h-full bg-slate-950 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
