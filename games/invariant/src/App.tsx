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
const Poster = import.meta.env.DEV ? lazy(() => import('./ui/dev/Poster').then((m) => ({ default: m.Poster }))) : null;
const showPoster = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('poster');

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

  if (Poster && showPoster)
    return (
      <Suspense fallback={null}>
        <Poster />
      </Suspense>
    );

  return (
    <div className="fixed inset-0">
      {/* the 3D world fades in on load rather than popping in */}
      <div className="fixed inset-0 bg-linear-to-b from-sky via-horizon via-60% to-[#e3e8ef] [&_canvas]:animate-[fade_0.8s_ease-out_both]">
        <World />
      </div>
      {mode === 'menu' && <HomeOverlay />}
      {mode !== 'menu' && level && <Hud />}
      <RulesCard />
      <SyntaxCard />
    </div>
  );
}
