import { lazy, Suspense, useEffect } from 'react';
import { browserZ3 } from './checker/z3-browser';
import { useGame } from './game/store';
import { World } from './scene/World';
import { HomeOverlay } from './ui/home/HomeOverlay';
import { Hud } from './ui/hud/Hud';
import { RulesCard } from './ui/rules/RulesCard';
import { SyntaxCard } from './ui/rules/SyntaxCard';

// The page: the 3D world behind everything, and the home screen or the level's HUD over it.

/** The link preview image's page (`?poster`, see ui/dev/Poster), in development only: it isn't in the built game. */
const Poster =
  import.meta.env.DEV && new URLSearchParams(location.search).has('poster') ? lazy(() => import('./ui/dev/Poster').then((m) => ({ default: m.Poster }))) : null;

export function App() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  const menuView = useGame((s) => s.menuView);

  // Warm up the solver in the background so the first Check is quick, but only
  // once the player heads for a level: it is a large download, and someone who
  // only looks at the home screen never needs it.
  const wantSolver = mode !== 'menu' || menuView === 'levels';
  useEffect(() => {
    if (wantSolver) void browserZ3().catch(() => {});
  }, [wantSolver]);

  return (
    // the sky, and over it the screen: the world and what floats over it, which
    // come in and go out together (.screen and .world, see scene/sceneTime)
    <div className="fixed inset-0 bg-linear-to-b from-sky via-horizon via-60% to-[#e3e8ef]">
      <div className="screen">
        <div className="world fixed inset-0">
          <World />
        </div>
        {Poster ? (
          <Suspense fallback={null}>
            <Poster />
          </Suspense>
        ) : (
          mode === 'menu' && <HomeOverlay />
        )}
        {mode !== 'menu' && level && <Hud />}
        <RulesCard />
        <SyntaxCard />
      </div>
    </div>
  );
}
