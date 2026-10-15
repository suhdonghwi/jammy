import { useGame } from '../../game/store';
import { RevealSlot } from '../RevealSlot';
import { CaptionBar } from './CaptionBar';
import { CodePanel } from './CodePanel';
import { FormulaBox } from './FormulaBox';
import { HoverReadout } from './HoverReadout';
import { PlaneSlider } from './PlaneSlider';
import { RunControls } from './RunControls';
import { TopBar } from './TopBar';

/** Everything over the scene while a level (or the tutorial) is open. */
export function Hud() {
  const reveal = useGame((s) => s.reveal);
  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col gap-3 px-4 pt-3.5 pb-4 *:pointer-events-auto">
      <TopBar />
      <div className="pointer-events-none! relative flex min-h-0 flex-1 items-start gap-3 *:pointer-events-auto">
        <CodePanel />
        {/* centred on the screen, not in the space left beside the side panels */}
        <div className="pointer-events-none! absolute inset-x-0 top-0 flex flex-col items-center gap-2 *:pointer-events-none">
          <HoverReadout />
        </div>
        <PlaneSlider />
      </div>
      {/* data-frame: on phones the scene centres itself in the gap between the top and bottom parts (scene/PhoneFraming) */}
      <div className="pointer-events-none! flex flex-col items-center gap-2 *:w-full *:max-w-200 *:pointer-events-auto" data-frame="bottom">
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
