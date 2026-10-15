import { useEffect } from 'react';
import { browserZ3 } from './checker/z3-browser';
import { useGame } from './game/store';
import { World } from './scene/World';
import { HomeOverlay } from './ui/home/HomeOverlay';
import { Hud } from './ui/hud/Hud';
import { RulesCard } from './ui/rules/RulesCard';

// The page: the 3D world behind everything, and the home screen or the level's HUD over it.

export function App() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);

  // Warm up the solver in the background so the first Check is quick.
  useEffect(() => {
    const t = setTimeout(() => void browserZ3().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="app">
      <div className="world">
        <World />
      </div>
      {mode === 'menu' && <HomeOverlay />}
      {mode !== 'menu' && level && <Hud />}
      <RulesCard />
    </div>
  );
}
