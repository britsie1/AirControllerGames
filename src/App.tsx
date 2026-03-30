import { useState, useEffect } from 'react';
import { usePeer } from './hooks/usePeer';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { MobileController } from './components/MobileController';
import { Loader2 } from 'lucide-react';

type Screen = 'LOBBY' | 'GAME' | 'MOBILE';

function App() {
  const [screen, setScreen] = useState<Screen>('LOBBY');
  const [joinId, setJoinId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get('join');
    if (join) {
      setJoinId(join);
      setScreen('MOBILE');
    }
  }, []);

  if (screen === 'MOBILE' && joinId) {
    return <MobileController hostId={joinId} />;
  }

  return <HostContainer onStartGame={() => setScreen('GAME')} screen={screen} />;
}

function HostContainer({ onStartGame, screen }: { onStartGame: () => void, screen: Screen }) {
  const { id, players, isConnected } = usePeer(true);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
        <h2 className="text-xl font-medium text-slate-400">Initializing Lobby...</h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {screen === 'LOBBY' ? (
        <Lobby 
          hostId={id} 
          players={players} 
          onStartGame={onStartGame} 
        />
      ) : (
        <Game players={players} />
      )}
    </div>
  );
}

export default App;
