import { lazy, Suspense, useEffect } from 'react';
import { browserZ3 } from './checker/z3-browser';
import { useGame } from './game/store';
import { World } from './scene/World';
import { HomeOverlay } from './ui/home/HomeOverlay';
import { Hud } from './ui/hud/Hud';
import { RulesCard } from './ui/rules/RulesCard';
import { SyntaxCard } from './ui/rules/SyntaxCard';

// The page: the 3D world behind everything, and the home screen or the level's HUD over it.

/** The sound lab (`?sfx-lab`), in development only: it isn't in the built game. */
const SfxLab = import.meta.env.DEV ? lazy(() => import('./ui/dev/SfxLab').then((m) => ({ default: m.SfxLab }))) : null;
const showLab = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('sfx-lab');

export function App() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);

  // Warm up the solver in the background so the first Check is quick.
  useEffect(() => {
    const t = setTimeout(() => void browserZ3().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, []);

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
      {SfxLab && showLab && (
        <Suspense fallback={null}>
          <SfxLab />
        </Suspense>
      )}
    </div>
  );
}
