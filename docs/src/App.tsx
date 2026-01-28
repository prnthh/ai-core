import { JSX, useState } from "react";
import ChatDemo from "./demos/chatdemo";
import SimGame from "./demos/simgame/simgame";


function App() {
  const [app, setApp] = useState<JSX.Element | null>(<SimGame />);
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute top-5 right-5">
        <select className="bg-gray-800 text-white p-2 rounded" value={app ? app.type.name : ''} onChange={(e) => {
          const value = e.target.value;
          switch (value) {
            case 'ChatDemo':
              setApp(<ChatDemo />);
              break;
            case 'SimGame':
              setApp(<SimGame />);
              break;
            default:
              setApp(null);
              break;
          }
        }}>
          <option value="ChatDemo">Chat Demo</option>
          <option value="SimGame">Simulation Game</option>
        </select>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {app}
      </div>
    </div>
  );
}

export default App;
