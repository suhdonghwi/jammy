import { lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useGame } from './game/store';
import { hasWebGL2, isWebGLError } from './scene/webgl';
import { World } from './scene/World';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { HomeOverlay } from './ui/home/HomeOverlay';
import { Hud } from './ui/hud/Hud';
import { RulesCard } from './ui/rules/RulesCard';
import { SyntaxCard } from './ui/rules/SyntaxCard';
import { Trouble } from './ui/Trouble';

const Poster =
  import.meta.env.DEV && new URLSearchParams(location.search).has('poster') ? lazy(() => import('./ui/dev/Poster').then((m) => ({ default: m.Poster }))) : null;

export function App() {
  if (!hasWebGL2) return <Trouble reason="webgl" />;
  return (
    <ErrorBoundary fallback={(error) => <Trouble reason={isWebGLError(error) ? 'webgl' : 'crash'} />}>
      <Game />
    </ErrorBoundary>
  );
}

function Game() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  return (
    <div className="fixed inset-0">
      <div className="screen">
        <div className="world fixed inset-x-0 top-0 h-lvh">
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
