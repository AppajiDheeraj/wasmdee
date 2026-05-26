import React from 'react';
import { Button } from './components/ui/button';

function App() {
  return (
    <div className="dark bg-neutral-950 text-neutral-50 min-h-screen flex flex-col items-center justify-center font-sans selection:bg-neutral-800">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
          Wasmdee
        </h1>
        <div>
          <Button className="bg-neutral-50 text-neutral-950 hover:bg-neutral-200 font-semibold px-8 py-5 text-base rounded-xl shadow-xl transition-all duration-300 transform hover:scale-105">
            Join
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;
