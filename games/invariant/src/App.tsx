import { useEffect } from 'react';
import { World } from './scene/World';
import { useGame } from './store/game';
import { CaptionBar, CodePanel, PondSlider, RunControls, TopBar } from './ui/Panels';
import { FormulaBox } from './ui/FormulaBox';
import { Menu, RulesCard } from './ui/Menu';
import { browserZ3 } from './checker/z3-browser';

export function App() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  const reveal = useGame((s) => s.reveal);

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
      {mode === 'menu' && <Menu />}
      {mode !== 'menu' && level && (
        <div className="hud">
          <TopBar />
          <div className="hud-middle">
            <CodePanel />
            <span className="spacer" />
            <PondSlider />
          </div>
          <div className="hud-bottom">
            <CaptionBar />
            {reveal.formula && <FormulaBox />}
            <RunControls />
          </div>
        </div>
      )}
      <RulesCard />
    </div>
  );
}
