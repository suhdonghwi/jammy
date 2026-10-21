import { lazy, Suspense, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { browserZ3 } from './checker/z3-browser';
import { useGame } from './game/store';
import { World } from './scene/World';
import { HomeOverlay } from './ui/home/HomeOverlay';
import { Hud } from './ui/hud/Hud';
import { RulesCard } from './ui/rules/RulesCard';
import { SyntaxCard } from './ui/rules/SyntaxCard';

const Poster =
  import.meta.env.DEV && new URLSearchParams(location.search).has('poster') ? lazy(() => import('./ui/dev/Poster').then((m) => ({ default: m.Poster }))) : null;

export function App() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  const menuView = useGame((s) => s.menuView);

  const wantSolver = mode !== 'menu' || menuView === 'levels';
  useEffect(() => {
    if (wantSolver) void browserZ3().catch(() => {});
  }, [wantSolver]);

  return (
    <div className="fixed inset-0">
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
      <Analytics scriptSrc="/ribbit/script.js" endpoint="/ribbit" />
    </div>
  );
}
