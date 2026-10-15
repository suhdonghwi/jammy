import { Braces, Lightbulb, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { pauseRun, resetFrogs, runFrogs, stepFrogs } from '../../director/frogs';
import { useGame } from '../../game/store';
import { showHint } from '../../tutorial/script';
import { button } from '../classes';

// Run / Pause, Step and Reset; on the right, the syntax reference (once there
// is an area box) and, in the tutorial, the stage's hint.

export function RunControls() {
  const reveal = useGame((s) => s.reveal);
  const runningNow = useGame((s) => s.running);
  const busy = useGame((s) => s.busy);
  const stepping = useGame((s) => s.stepping);
  const mode = useGame((s) => s.mode);
  const hint = useGame((s) => s.hint);
  const awaitingCheck = useGame((s) => s.awaitingCheck);
  const spot = useGame((s) => s.spotlight);
  const allow = useGame((s) => s.tutorialAllow);
  const tut = mode === 'tutorial';
  const hinting = tut && !!hint && !hint.shown && awaitingCheck;
  // on phones the row only has room for Syntax's label when neither Reset nor a hint is in it
  const crowded = hinting || (reveal.run && !tut);
  return (
    <div className="flex items-center gap-1.5 max-[22.5rem]:gap-1">
      {/* three alike buttons: their icons carry the colour that tells them apart */}
      {reveal.run &&
        (runningNow ? (
          <button className={button()} onClick={pauseRun}>
            <Pause size={16} strokeWidth={2.4} className="text-pass" /> Pause
          </button>
        ) : (
          <button
            className={`${button()} ${spot === 'run' ? 'spotlight' : ''}`}
            disabled={busy || stepping || (tut && !allow.run)}
            onClick={() => void runFrogs()}
          >
            <Play size={16} strokeWidth={2.4} className="text-pass" /> Run
          </button>
        ))}
      {reveal.step && (
        <button
          className={`${button()} ${spot === 'step' ? 'spotlight' : ''}`}
          disabled={busy || runningNow || stepping || (tut && !allow.step)}
          onClick={() => void stepFrogs()}
        >
          <StepForward size={16} strokeWidth={2.4} className="text-brand" /> Step
        </button>
      )}
      {reveal.run && !tut && (
        <button className={button()} disabled={busy} title="Put every frog back in its egg (your area stays)" onClick={resetFrogs}>
          <RotateCcw size={16} strokeWidth={2.4} className="text-warn" /> Reset
        </button>
      )}
      <span className="flex-1" />
      {/* one sentence, once: the button goes when it's shown */}
      {hinting && (
        <button className={button('glass')} disabled={busy} onClick={showHint}>
          <Lightbulb size={16} strokeWidth={2.2} /> Hint
        </button>
      )}
      {reveal.formula && (
        <button
          className={button('glass')}
          title="What you can type into the area box"
          aria-label="Syntax"
          onClick={() => useGame.setState({ showSyntax: true })}
        >
          <Braces size={16} strokeWidth={2.2} /> <span className={crowded ? 'max-sm:hidden' : ''}>Syntax</span>
        </button>
      )}
    </div>
  );
}
