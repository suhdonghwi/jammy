import { BookOpen, Braces, Lightbulb, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { pauseRun, resetFrogs, runFrogs, stepFrogs } from '../../director/frogs';
import { showLevelHint } from '../../game/actions';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { showHint } from '../../tutorial/script';
import { button } from '../classes';

// Run / Pause, Step and Reset; on the right, the hint (the tutorial stage's
// one, or a level's few) and the two reference cards: the syntax (once there
// is an area box) and the rules (once their lights are up).

export function RunControls() {
  const reveal = useGame((s) => s.reveal);
  const runningNow = useGame((s) => s.running);
  const busy = useGame((s) => s.busy);
  const stepping = useGame((s) => s.stepping);
  const mode = useGame((s) => s.mode);
  const hint = useGame((s) => s.hint);
  const levelHints = useGame((s) => (s.mode === 'level' ? (s.level?.hints?.length ?? 0) : 0));
  const awaitingCheck = useGame((s) => s.awaitingCheck);
  const spot = useGame((s) => s.spotlight);
  const allow = useGame((s) => s.tutorialAllow);
  const tut = mode === 'tutorial';
  const tr = useT();
  const hinting = tut && !!hint && !hint.shown && awaitingCheck;
  const onHint = hinting ? showHint : levelHints > 0 ? showLevelHint : null;
  const rules = reveal.lights.length > 0;
  // on phones the row only has room for the labels of Reset and the references when neither Reset nor a hint is in it
  const crowded = !!onHint || (reveal.run && !tut) || (rules && reveal.formula);
  // a button that gives up its label on phones is square there, like an icon button
  const square = (iconOnly: boolean) => (iconOnly ? 'max-sm:w-9.5 max-sm:self-stretch max-sm:px-0!' : '');
  return (
    <div className="flex items-center gap-1.5 max-[22.5rem]:gap-1">
      {/* three alike buttons: their icons carry the colour that tells them apart */}
      {reveal.run &&
        (runningNow ? (
          <button className={button()} onClick={pauseRun}>
            <Pause size={16} strokeWidth={2.4} className="text-pass" /> {tr.controls.pause}
          </button>
        ) : (
          <button
            className={`${button()} ${spot === 'run' ? 'spotlight' : ''}`}
            disabled={busy || stepping || (tut && !allow.run)}
            onClick={() => void runFrogs()}
          >
            <Play size={16} strokeWidth={2.4} className="text-pass" /> {tr.controls.run}
          </button>
        ))}
      {reveal.step && (
        <button
          className={`${button()} ${spot === 'step' ? 'spotlight' : ''}`}
          disabled={busy || runningNow || stepping || (tut && !allow.step)}
          onClick={() => void stepFrogs()}
        >
          <StepForward size={16} strokeWidth={2.4} className="text-brand" /> {tr.controls.step}
        </button>
      )}
      {reveal.run && !tut && (
        <button className={`${button()} ${square(crowded)}`} disabled={busy} title={tr.controls.resetTitle} aria-label={tr.controls.reset} onClick={resetFrogs}>
          {/* on phones a level's row also holds the hint and the references: Reset gives up its label */}
          <RotateCcw size={16} strokeWidth={2.4} className="text-warn" /> <span className={crowded ? 'max-sm:hidden' : ''}>{tr.controls.reset}</span>
        </button>
      )}
      <span className="flex-1" />
      {/* the tutorial's one sentence goes once it's shown; a level's hints come one at a time from the caption */}
      {onHint && (
        <button className={`${button('glass')} ${square(!tut)}`} disabled={busy} title={tr.controls.hintTitle} aria-label={tr.controls.hint} onClick={onHint}>
          <Lightbulb size={16} strokeWidth={2.2} /> <span className={tut ? '' : 'max-sm:hidden'}>{tr.controls.hint}</span>
        </button>
      )}
      {reveal.formula && (
        <button
          className={`${button('glass')} ${square(crowded)}`}
          title={tr.controls.syntaxTitle}
          aria-label={tr.controls.syntax}
          onClick={() => useGame.setState({ showSyntax: true })}
        >
          <Braces size={16} strokeWidth={2.2} /> <span className={crowded ? 'max-sm:hidden' : ''}>{tr.controls.syntax}</span>
        </button>
      )}
      {rules && (
        <button className={`${button('glass')} ${square(crowded)}`} title={tr.controls.rules} aria-label={tr.controls.rules} onClick={() => useGame.setState({ showRules: true })}>
          <BookOpen size={16} strokeWidth={2.2} /> <span className={crowded ? 'max-sm:hidden' : ''}>{tr.controls.rules}</span>
        </button>
      )}
    </div>
  );
}
