import { JSX, useState } from "react";
import ChatDemo from "./demos/chatdemo";
import SimGame from "./demos/simgame/simgame";


function App() {
  const [app, setApp] = useState<JSX.Element | null>(<SimGame />);
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {app}
      </div>
    </div>
  );
}

export default App;
