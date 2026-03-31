import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Player } from '../hooks/usePeer';
import { Loader2, CheckCircle, Clock } from 'lucide-react';

interface LobbyProps {
  hostId: string;
  players: Record<string, Player>;
  onStartGame: (mode: 'FREE' | 'MAZE') => void;
}

export const Lobby: React.FC<LobbyProps> = ({ hostId, players, onStartGame }) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const playerList = Object.values(players);
  const allReady = playerList.length > 0 && playerList.every((p) => p.isReady);

  const votes = playerList.reduce((acc, p) => {
    if (p.vote) acc[p.vote]++;
    return acc;
  }, { FREE: 0, MAZE: 0 });

  useEffect(() => {
    let timer: number;
    if (allReady) {
      setCountdown(10);
      timer = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(timer);
            // Decide mode
            let finalMode: 'FREE' | 'MAZE' = 'FREE';
            if (votes.MAZE > votes.FREE) finalMode = 'MAZE';
            else if (votes.FREE > votes.MAZE) finalMode = 'FREE';
            else finalMode = Math.random() > 0.5 ? 'MAZE' : 'FREE';
            
            onStartGame(finalMode);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    } else {
      setCountdown(null);
    }
    return () => clearInterval(timer);
  }, [allReady, onStartGame, votes.FREE, votes.MAZE]);

  const joinUrl = `${window.location.origin}?join=${hostId}`;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          AirController
        </h1>
        <p className="text-slate-400 text-xl">Scan to join or enter code: <span className="text-white font-mono font-bold">{hostId}</span></p>
      </div>

      <div className="flex gap-16 items-start">
        <div className="bg-white p-6 rounded-3xl shadow-2xl shadow-blue-500/20">
          <QRCodeSVG value={joinUrl} size={256} />
        </div>

        <div className="w-96 space-y-6">
          <div className="flex gap-4 mb-8">
            <div className="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Free Roam</div>
              <div className="text-3xl font-bold text-blue-400">{votes.FREE}</div>
            </div>
            <div className="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Maze Runner</div>
              <div className="text-3xl font-bold text-amber-400">{votes.MAZE}</div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold flex items-center gap-2">
            Players ({playerList.length})
            {allReady && <Loader2 className="animate-spin text-blue-400" />}
          </h2>
          
          <div className="space-y-3">
            {playerList.length === 0 ? (
              <p className="text-slate-500 italic">Waiting for players to connect...</p>
            ) : (
              playerList.map((player) => (
                <div 
                  key={player.id} 
                  className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center transition-all animate-in fade-in slide-in-from-right-4"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{player.name}</span>
                    <span className="text-xs text-slate-500">
                      {player.vote === 'FREE' ? 'Voted Free Roam' : player.vote === 'MAZE' ? 'Voted Maze' : 'Not voted'}
                    </span>
                  </div>
                  {player.isReady ? (
                    <CheckCircle className="text-emerald-400 w-6 h-6" />
                  ) : (
                    <Clock className="text-slate-600 w-6 h-6" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {countdown !== null && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
          <div className="text-[12rem] font-black text-white leading-none">
            {countdown}
          </div>
          <p className="text-2xl text-slate-400 font-medium">Starting Game...</p>
        </div>
      )}
    </div>
  );
};
