import { useEffect } from 'react';
import { World } from './scene/World';
import { useGame } from './store/game';
import { CaptionBar, CodePanel, ElevatorToast, HoverReadout, PondGauge, RunControls, TopBar } from './ui/Hud';
import { FormulaBox } from './ui/FormulaBox';
import { HomeOverlay, RulesCard } from './ui/Home';
import { RevealSlot } from './ui/RevealSlot';
import { browserZ3 } from './checker/z3-browser';

export function App() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  const reveal = useGame((s) => s.reveal);
  const cinematic = useGame((s) => s.cinematic);

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
      {mode !== 'menu' && level && (
        <div className="hud">
          <TopBar />
          <div className="hud-middle">
            {!cinematic && <CodePanel />}
            <div className="hud-center">
              {!cinematic && <HoverReadout />}
              <ElevatorToast />
            </div>
            {!cinematic && <PondGauge />}
          </div>
          <div className="hud-bottom">
            <CaptionBar />
            <RevealSlot open={reveal.formula}>
              <FormulaBox />
            </RevealSlot>
            <RevealSlot open={reveal.run || reveal.step}>
              <RunControls />
            </RevealSlot>
          </div>
        </div>
      )}
      <RulesCard />
    </div>
  );
}
