import { Pause, Play, RotateCcw, StepForward, Wand2 } from 'lucide-react';
import { pauseRun, resetFrogs, runFrogs, stepFrogs } from '../../director/frogs';
import { useGame } from '../../game/store';

// Run / Pause, Step and Reset (and, in the tutorial, "Show me").

export function RunControls() {
  const reveal = useGame((s) => s.reveal);
  const runningNow = useGame((s) => s.running);
  const busy = useGame((s) => s.busy);
  const stepping = useGame((s) => s.stepping);
  const mode = useGame((s) => s.mode);
  const suggestion = useGame((s) => s.suggestion);
  const spot = useGame((s) => s.spotlight);
  const allow = useGame((s) => s.tutorialAllow);
  const tut = mode === 'tutorial';
  return (
    <div className="run-controls">
      {reveal.run &&
        (runningNow ? (
          <button className="btn icon-btn" onClick={pauseRun}>
            <Pause size={16} strokeWidth={2.4} /> Pause
          </button>
        ) : (
          <button
            className={`btn icon-btn ${spot === 'run' ? 'spotlight' : ''}`}
            disabled={busy || stepping || (tut && !allow.run)}
            onClick={() => void runFrogs()}
          >
            <Play size={16} strokeWidth={2.4} /> Run
          </button>
        ))}
      {reveal.step && (
        <button
          className={`btn icon-btn ${spot === 'step' ? 'spotlight' : ''}`}
          disabled={busy || runningNow || stepping || (tut && !allow.step)}
          onClick={() => void stepFrogs()}
        >
          <StepForward size={16} strokeWidth={2.4} /> Step
        </button>
      )}
      {reveal.run && !tut && (
        <button className="btn ghost icon-btn" disabled={busy} title="Put every frog back in its egg (your area stays)" onClick={resetFrogs}>
          <RotateCcw size={16} strokeWidth={2.2} /> Reset
        </button>
      )}
      <span className="spacer" />
      {tut && suggestion && reveal.formula && (
        <button className="btn ghost icon-btn" onClick={() => useGame.getState().setFormula(suggestion)}>
          <Wand2 size={16} strokeWidth={2.2} /> Show me
        </button>
      )}
    </div>
  );
}
