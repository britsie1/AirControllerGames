import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Player } from '../hooks/usePeer';
import { Loader2, CheckCircle, Clock } from 'lucide-react';

interface LobbyProps {
  hostId: string;
  players: Record<string, Player>;
  onStartGame: (mode: 'FREE' | 'MAZE' | 'BALANCE') => void;
}

export const Lobby: React.FC<LobbyProps> = ({ hostId, players, onStartGame }) => {
  const playerList = Object.values(players);
  const allReady = playerList.length > 0 && playerList.every((p) => p.isReady);
  
  const [countdown, setCountdown] = useState<number | null>(null);

  // Adjust state during render if players un-ready
  if (!allReady && countdown !== null) {
    setCountdown(null);
  }

  const votes = playerList.reduce((acc, p) => {
    if (p.vote) acc[p.vote]++;
    return acc;
  }, { FREE: 0, MAZE: 0, BALANCE: 0 });

  useEffect(() => {
    if (allReady) {
      const timer = window.setInterval(() => {
        setCountdown((prev) => (prev === null ? 9 : prev - 1));
      }, 1000);
      return () => window.clearInterval(timer);
    }
  }, [allReady]);

  useEffect(() => {
    if (allReady && countdown === 0) {
      // Decide mode
      const modes: ('FREE' | 'MAZE' | 'BALANCE')[] = ['FREE', 'MAZE', 'BALANCE'];
      const winner = modes.reduce((a, b) => (votes[a] > votes[b] ? a : b));
      
      // Handle ties randomly among top voted
      const maxVotes = votes[winner];
      const candidates = modes.filter(m => votes[m] === maxVotes);
      const finalMode = candidates[Math.floor(Math.random() * candidates.length)];
      
      onStartGame(finalMode);
    }
  }, [countdown, allReady, onStartGame, votes]);

  const displayCountdown = countdown === null && allReady ? 10 : countdown;

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
          <div className="grid grid-cols-3 gap-2 mb-8">
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Free</div>
              <div className="text-xl font-bold text-blue-400">{votes.FREE}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Maze</div>
              <div className="text-xl font-bold text-amber-400">{votes.MAZE}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Beam</div>
              <div className="text-xl font-bold text-purple-400">{votes.BALANCE}</div>
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
                      {player.vote === 'FREE' ? 'Voted Free Roam' : player.vote === 'MAZE' ? 'Voted Maze' : player.vote === 'BALANCE' ? 'Voted Balance Beam' : 'Not voted'}
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

      {displayCountdown !== null && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
          <div className="text-[12rem] font-black text-white leading-none">
            {displayCountdown}
          </div>
          <p className="text-2xl text-slate-400 font-medium">Starting Game...</p>
        </div>
      )}
    </div>
  );
};
