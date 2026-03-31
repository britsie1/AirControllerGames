import { useState } from 'react';
import { usePeer } from './hooks/usePeer';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { MazeGame } from './components/MazeGame';
import { MobileController } from './components/MobileController';
import { Loader2 } from 'lucide-react';

type Screen = 'LOBBY' | 'GAME' | 'MAZE' | 'MOBILE';

function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') ? 'MOBILE' : 'LOBBY';
  });

  const [joinId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join');
  });

  if (screen === 'MOBILE' && joinId) {
    return <MobileController hostId={joinId} />;
  }

  return (
    <HostContainer 
      onStartGame={(mode) => setScreen(mode)} 
      screen={screen} 
    />
  );
}

function HostContainer({ onStartGame, screen }: { 
  onStartGame: (mode: Screen) => void, 
  screen: Screen
}) {
  const { id, players, isConnected, sendToPeer } = usePeer(true);

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
          onStartGame={(mode) => onStartGame(mode === 'FREE' ? 'GAME' : 'MAZE')} 
        />
      ) : screen === 'MAZE' ? (
        <MazeGame players={players} sendToPeer={sendToPeer} />
      ) : (
        <Game players={players} />
      )}
    </div>
  );
}

export default App;
