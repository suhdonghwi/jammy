import { useGame } from '../../game/store';
import { RevealSlot } from '../RevealSlot';
import { CaptionBar } from './CaptionBar';
import { CodePanel } from './CodePanel';
import { FormulaBox } from './FormulaBox';
import { HoverReadout } from './HoverReadout';
import { ElevatorToast, PondGauge } from './PondGauge';
import { RunControls } from './RunControls';
import { TopBar } from './TopBar';

/** Everything over the scene while a level (or the tutorial) is open. */
export function Hud() {
  const reveal = useGame((s) => s.reveal);
  // during a cinematic only the top bar, caption and toasts stay
  const cinematic = useGame((s) => s.cinematic);
  return (
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
  );
}
