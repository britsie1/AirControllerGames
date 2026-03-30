import { useEffect, useState, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export type MessageType = 'READY' | 'MOVE' | 'PLAYER_JOINED';

export interface PeerMessage {
  type: MessageType;
  payload: any;
}

export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  x: number;
  y: number;
}

export function usePeer(isHost: boolean, hostId?: string) {
  const [connections, setConnections] = useState<Record<string, DataConnection>>({});
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [id, setId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Generate a random 6-digit code if we are the host and no ID is provided
  const generatedId = useRef(Math.floor(100000 + Math.random() * 900000).toString());

  useEffect(() => {
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
        const conn = newPeer.connect(hostId);
        handleConnection(conn);
      }
    });

    newPeer.on('connection', (conn) => {
      handleConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setError(err.message);
    });

    return () => {
      newPeer.destroy();
    };
  }, [isHost, hostId]);

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
            x: 0.5,
            y: 0.5,
          },
        }));
      }
    });

    conn.on('data', (data: any) => {
      const msg = data as PeerMessage;
      if (isHost) {
        if (msg.type === 'READY') {
          setPlayers((prev) => ({
            ...prev,
            [conn.peer]: { ...prev[conn.peer], isReady: msg.payload },
          }));
        } else if (msg.type === 'MOVE') {
          setPlayers((prev) => ({
            ...prev,
            [conn.peer]: { ...prev[conn.peer], x: msg.payload.x, y: msg.payload.y },
          }));
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

  const sendMessage = useCallback((type: MessageType, payload: any) => {
    const msg: PeerMessage = { type, payload };
    Object.values(connections).forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }, [connections]);

  return {
    id,
    players,
    isConnected,
    error,
    sendMessage,
  };
}
