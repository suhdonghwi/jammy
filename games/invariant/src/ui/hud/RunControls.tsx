import { Braces, Lightbulb, Pause, Play, RotateCcw, StepForward, Wand2 } from 'lucide-react';
import { pauseRun, resetFrogs, runFrogs, stepFrogs } from '../../director/frogs';
import { useGame } from '../../game/store';
import { climbHint } from '../../tutorial/script';
import { button } from '../classes';

// Run / Pause, Step and Reset; on the right, the syntax reference (once there
// is an area box) and, in the tutorial, the hint ladder.

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
  return (
    <div className="flex items-center gap-1.5">
      {reveal.run &&
        (runningNow ? (
          <button className={button()} onClick={pauseRun}>
            <Pause size={16} strokeWidth={2.4} /> Pause
          </button>
        ) : (
          <button
            className={`${button()} ${spot === 'run' ? 'spotlight' : ''}`}
            disabled={busy || stepping || (tut && !allow.run)}
            onClick={() => void runFrogs()}
          >
            <Play size={16} strokeWidth={2.4} /> Run
          </button>
        ))}
      {reveal.step && (
        <button
          className={`${button()} ${spot === 'step' ? 'spotlight' : ''}`}
          disabled={busy || runningNow || stepping || (tut && !allow.step)}
          onClick={() => void stepFrogs()}
        >
          <StepForward size={16} strokeWidth={2.4} /> Step
        </button>
      )}
      {reveal.run && !tut && (
        <button className={button('glass')} disabled={busy} title="Put every frog back in its egg (your area stays)" onClick={resetFrogs}>
          <RotateCcw size={16} strokeWidth={2.2} /> Reset
        </button>
      )}
      <span className="flex-1" />
      {/* the hint ladder: a nudge, then a formula to try, then filling it in */}
      {tut && hint && hint.rung < 3 && awaitingCheck && (
        <button className={button('glass')} disabled={busy} onClick={climbHint}>
          {hint.rung < 2 ? <Lightbulb size={16} strokeWidth={2.2} /> : <Wand2 size={16} strokeWidth={2.2} />}
          {hint.rung === 0 ? 'Hint' : hint.rung === 1 ? 'Another hint' : 'Fill it in'}
        </button>
      )}
      {reveal.formula && (
        <button className={button('glass')} title="What you can type into the area box" onClick={() => useGame.setState({ showSyntax: true })}>
          <Braces size={16} strokeWidth={2.2} /> Syntax
        </button>
      )}
    </div>
  );
}
