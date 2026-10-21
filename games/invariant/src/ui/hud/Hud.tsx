import { useGame } from '../../game/store';
import { RevealSlot } from '../RevealSlot';
import { CaptionBar } from './CaptionBar';
import { CodePanel } from './CodePanel';
import { FormulaBox } from './FormulaBox';
import { HoverReadout } from './HoverReadout';
import { RunControls } from './RunControls';
import { TopBar } from './TopBar';

export function Hud() {
  const reveal = useGame((s) => s.reveal);
  const levelId = useGame((s) => s.level?.id);
  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col gap-3 px-4 pt-3.5 pb-4 *:pointer-events-auto compact:gap-2 compact:p-2.5 short:grid short:grid-cols-[minmax(0,1fr)_min(23rem,max(20rem,46%))] short:grid-rows-[auto_minmax(0,1fr)]">
      <TopBar />
      <div className="pointer-events-none! relative flex min-h-0 flex-1 items-start gap-3 *:pointer-events-auto compact:gap-2 short:col-start-1 short:row-start-2">
        <div className="pointer-events-none! flex max-h-full min-h-0 max-w-105 flex-col *:pointer-events-auto max-md:max-w-64">
          <CodePanel key={levelId} />
        </div>
        <div className="pointer-events-none! absolute inset-x-0 top-0 flex flex-col items-center gap-2 *:pointer-events-none">
          <HoverReadout />
        </div>
      </div>
      <div className="pointer-events-none! flex flex-col items-center *:w-full *:max-w-200 *:pointer-events-auto short:col-start-2 short:row-span-2 short:row-start-1 short:min-h-0 short:justify-end" data-frame>
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
