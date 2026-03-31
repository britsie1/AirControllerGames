import React, { useEffect, useRef, useMemo, useState } from 'react';
import type { Player, MessageType } from '../hooks/usePeer';
import { generateMaze } from '../utils/mazeGen';

interface MazeGameProps {
  players: Record<string, Player>;
  sendToPeer: (peerId: string, type: MessageType, payload: unknown) => void;
}

interface MarbleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  finished: boolean;
  time?: string;
  position?: number;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#a855f7',
  '#6366f1', '#14b8a6', '#facc15', '#fb7185', '#94a3b8', '#475569'
];

export const MazeGame: React.FC<MazeGameProps> = ({ players, sendToPeer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maze = useMemo(() => generateMaze(31, 21), []);
  const [marbleStates, setMarbleStates] = useState<Record<string, MarbleState>>({});
  const marbleStatesRef = useRef<Record<string, MarbleState>>({});
  const requestRef = useRef<number>(0);
  const playersRef = useRef(players);
  const sendToPeerRef = useRef(sendToPeer);
  const [gameState, setGameState] = useState<'WARMUP' | 'PLAYING' | 'SCOREBOARD'>('WARMUP');
  const [countdown, setCountdown] = useState(5);
  const [closingTimer, setClosingTimer] = useState<number | null>(null);
  const startTime = useRef<number>(0);
  const finishCount = useRef<number>(0);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    marbleStatesRef.current = marbleStates;
  }, [marbleStates]);

  useEffect(() => {
    sendToPeerRef.current = sendToPeer;
  }, [sendToPeer]);

  useEffect(() => {
    if (gameState === 'WARMUP') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setGameState('PLAYING');
            startTime.current = Date.now();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  useEffect(() => {
    if (closingTimer !== null && closingTimer > 0 && gameState === 'PLAYING') {
      const timer = setInterval(() => {
        setClosingTimer((prev) => {
          if (prev !== null && prev <= 1) {
            setGameState('SCOREBOARD');
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [closingTimer !== null, gameState]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellW = canvas.width / maze.width;
      const cellH = canvas.height / maze.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (gameState !== 'SCOREBOARD') {
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
          if (!marbleStates[player.id]) {
            const start = maze.possibleStarts[index % maze.possibleStarts.length];
            setMarbleStates(prev => ({
              ...prev,
              [player.id]: {
                x: (start.x + 0.5) * cellW,
                y: (start.y + 0.5) * cellH,
                vx: 0,
                vy: 0,
                color: COLORS[index % COLORS.length],
                finished: false
              }
            }));
          }

          const marble = marbleStatesRef.current[player.id];
          if (!marble) return;

          const radius = Math.min(cellW, cellH) * 0.3;

          if (gameState === 'PLAYING' && !marble.finished) {
            // Physics: Acceleration from tilt (player.x, player.y are 0-1 range)
            const ax = (player.x - 0.5) * 0.8;
            const ay = (player.y - 0.5) * 0.8;

            marble.vx += ax;
            marble.vy += ay;
            
            // Damping
            marble.vx *= 0.95;
            marble.vy *= 0.95;

            // Collision Detection with Radius
            const nextX = marble.x + marble.vx;
            const xBuffer = marble.vx > 0 ? radius : -radius;
            const gridX = Math.floor((nextX + xBuffer) / cellW);
            const gridYCenter = Math.floor(marble.y / cellH);
            const gridYTop = Math.floor((marble.y - radius * 0.8) / cellH);
            const gridYBottom = Math.floor((marble.y + radius * 0.8) / cellH);

            if (
              maze.grid[gridYCenter][gridX] === 1 ||
              maze.grid[gridYTop][gridX] === 1 ||
              maze.grid[gridYBottom][gridX] === 1
            ) {
              marble.vx *= -0.5;
            } else {
              marble.x = nextX;
            }

            const nextY = marble.y + marble.vy;
            const yBuffer = marble.vy > 0 ? radius : -radius;
            const gridY = Math.floor((nextY + yBuffer) / cellH);
            const gridXCenter = Math.floor(marble.x / cellW);
            const gridXLeft = Math.floor((marble.x - radius * 0.8) / cellW);
            const gridXRight = Math.floor((marble.x + radius * 0.8) / cellW);

            if (
              maze.grid[gridY][gridXCenter] === 1 ||
              maze.grid[gridY][gridXLeft] === 1 ||
              maze.grid[gridY][gridXRight] === 1
            ) {
              marble.vy *= -0.5;
            } else {
              marble.y = nextY;
            }

            // Check Goal
            const currentGridX = Math.floor(marble.x / cellW);
            const currentGridY = Math.floor(marble.y / cellH);
            if (currentGridX === maze.endX && currentGridY === maze.endY) {
              finishCount.current += 1;
              
              const elapsed = (Date.now() - startTime.current) / 1000;
              const timeStr = `${elapsed.toFixed(2)}s`;
              
              setMarbleStates(prev => {
                const next = {
                  ...prev,
                  [player.id]: {
                    ...prev[player.id],
                    finished: true,
                    vx: 0,
                    vy: 0,
                    time: timeStr,
                    position: finishCount.current
                  }
                };
                
                // Check if everyone finished
                const playerIds = Object.keys(playersRef.current);
                const allFinished = playerIds.every(id => next[id]?.finished);
                if (playerIds.length > 0 && allFinished) {
                  setGameState('SCOREBOARD');
                }
                
                return next;
              });
              
              sendToPeerRef.current(player.id, 'WIN', {
                time: timeStr,
                position: finishCount.current
              });

              // Start 30s closing timer if first finisher
              if (finishCount.current === 1) {
                setClosingTimer(30);
              }
            }
          }

          // Draw Marble
          ctx.shadowBlur = marble.finished ? 30 : 15;
          ctx.shadowColor = marble.color;
          ctx.fillStyle = marble.color;
          ctx.beginPath();
          ctx.arc(marble.x, marble.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Draw Player Name
          ctx.fillStyle = 'white';
          ctx.font = `bold ${Math.max(12, cellH * 0.4)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          ctx.fillText(player.name, marble.x, marble.y - radius - 5);
          ctx.shadowBlur = 0;
        });
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
  }, [maze, gameState, marbleStates]);

  const results = useMemo(() => {
    return Object.values(players).map(p => {
      const state = marbleStates[p.id];
      return {
        name: p.name,
        time: state?.time || 'DNF',
        position: state?.position || Infinity,
        color: state?.color || '#ffffff'
      };
    }).sort((a, b) => a.position - b.position);
  }, [players, marbleStates]);

  return (
    <div className="w-full h-full bg-slate-950 overflow-hidden relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      
      {gameState === 'WARMUP' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <h2 className="text-4xl font-bold text-white mb-4 uppercase tracking-tighter italic">Get Ready!</h2>
          <p className="text-xl text-slate-200 mb-8 text-center max-w-md">
            Hold your phone flat and face up to orient your marble.
          </p>
          <div className="text-8xl font-black text-white animate-bounce">
            {countdown}
          </div>
        </div>
      )}

      {closingTimer !== null && gameState === 'PLAYING' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-600 px-6 py-2 rounded-full border-2 border-red-400 shadow-lg shadow-red-600/40 flex items-center gap-4 animate-pulse">
          <span className="text-white font-bold uppercase tracking-widest text-sm">Maze Closing In</span>
          <span className="text-2xl font-black text-white font-mono">{closingTimer}s</span>
        </div>
      )}

      {gameState === 'SCOREBOARD' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-8">
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase">Race Results</h2>
              <p className="text-slate-400 text-xl font-medium">Well played, everyone!</p>
            </div>

            <div className="space-y-4">
              {results.map((res, idx) => (
                <div 
                  key={res.name} 
                  className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm"
                  style={{ borderColor: res.time === 'DNF' ? '#334155' : `${res.color}44` }}
                >
                  <div className="flex items-center gap-6">
                    <span className="text-4xl font-black italic text-slate-700 w-12">#{idx + 1}</span>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: res.color }} />
                    <span className="text-2xl font-bold text-white">{res.name}</span>
                  </div>
                  <div className="text-3xl font-mono font-black text-white">
                    {res.time}
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 uppercase tracking-widest"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
