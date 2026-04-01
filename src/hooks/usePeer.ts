import { useEffect, useState, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export type MessageType = 'READY' | 'MOVE' | 'PLAYER_JOINED' | 'VOTE' | 'WIN' | 'JUMP';

export interface PeerMessage {
  type: MessageType;
  payload: unknown;
}

export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  vote: 'FREE' | 'MAZE' | 'BALANCE' | null;
  x: number;
  y: number;
  lastJumpTime?: number;
}

export function usePeer(isHost: boolean, hostId?: string) {
  const [connections, setConnections] = useState<Record<string, DataConnection>>({});
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [id, setId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [winData, setWinData] = useState<{ time: string, position: number } | null>(null);

  const generatedId = useRef<string | null>(null);

  const handleConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      setConnections((prev) => ({ ...prev, [conn.peer]: conn }));
      
      if (isHost) {
        setPlayers((prev) => ({
          ...prev,
          [conn.peer]: {
            id: conn.peer,
            name: `Player ${Object.keys(prev).length + 1}`,
            isReady: false,
            vote: null,
            x: 0.5,
            y: 0.5,
          },
        }));
      }
    });

    conn.on('data', (data: unknown) => {
      const msg = data as PeerMessage;
      if (isHost) {
        if (msg.type === 'READY') {
          setPlayers((prev) => ({
            ...prev,
            [conn.peer]: { ...prev[conn.peer], isReady: msg.payload as boolean },
          }));
        } else if (msg.type === 'VOTE') {
          setPlayers((prev) => ({
            ...prev,
            [conn.peer]: { ...prev[conn.peer], vote: msg.payload as 'FREE' | 'MAZE' | 'BALANCE' },
          }));
        } else if (msg.type === 'MOVE') {
          const moveData = msg.payload as { x: number, y: number };
          setPlayers((prev) => ({
            ...prev,
            [conn.peer]: { ...prev[conn.peer], x: moveData.x, y: moveData.y },
          }));
        } else if (msg.type === 'JUMP') {
          setPlayers((prev) => ({
            ...prev,
            [conn.peer]: { ...prev[conn.peer], lastJumpTime: Date.now() },
          }));
        }
      } else {
        if (msg.type === 'WIN') {
          setWinData(msg.payload as { time: string, position: number });
        }
      }
    });

    conn.on('close', () => {
      setConnections((prev) => {
        const next = { ...prev };
        delete next[conn.peer];
        return next;
      });
      if (isHost) {
        setPlayers((prev) => {
          const next = { ...prev };
          delete next[conn.peer];
          return next;
        });
      }
    });
  }, [isHost]);

  useEffect(() => {
    if (!generatedId.current) {
      generatedId.current = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const config = {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    };

    const newPeer = isHost 
      ? new Peer(generatedId.current, config) 
      : new Peer('', config);

    newPeer.on('open', (id) => {
      setId(id);
      setIsConnected(true);
      if (!isHost && hostId) {
        const conn = newPeer.connect(hostId, { serialization: 'json' });
        handleConnection(conn);
      }
    });

    newPeer.on('connection', (conn) => {
      handleConnection(conn);
    });

    newPeer.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      newPeer.destroy();
    };
  }, [isHost, hostId, handleConnection]);

  const sendMessage = useCallback((type: MessageType, payload: unknown) => {
    const msg: PeerMessage = { type, payload };
    Object.values(connections).forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }, [connections]);

  const sendToPeer = useCallback((peerId: string, type: MessageType, payload: unknown) => {
    const conn = connections[peerId];
    if (conn && conn.open) {
      conn.send({ type, payload });
    }
  }, [connections]);

  return {
    id,
    players,
    isConnected,
    error,
    winData,
    sendMessage,
    sendToPeer,
  };
}
