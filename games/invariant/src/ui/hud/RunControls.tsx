import { BookOpen, Braces, Lightbulb, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';
import { pauseRun, runFrogs, stepFrogs } from '../../director/controls';
import { resetScreen, showLevelHint } from '../../game/actions';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { showHint } from '../../tutorial/script';
import { button } from '../classes';

export function RunControls() {
  const reveal = useGame((s) => s.reveal);
  const runningNow = useGame((s) => s.running);
  const busy = useGame((s) => s.busy);
  const stepping = useGame((s) => s.stepping);
  const mode = useGame((s) => s.mode);
  const hint = useGame((s) => s.tutorial.hint);
  const levelHints = useGame((s) => (s.mode === 'level' ? (s.level?.hints?.length ?? 0) : 0));
  const awaitingCheck = useGame((s) => s.tutorial.check !== null);
  const spot = useGame((s) => s.tutorial.spotlight);
  const allow = useGame((s) => s.tutorial.allow);
  const tut = mode === 'tutorial';
  const tr = useT();
  const hinting = tut && !!hint && !hint.shown && awaitingCheck;
  const onHint = hinting ? showHint : levelHints > 0 ? showLevelHint : null;
  const rules = reveal.lights.length > 0;
  const crowded = !!onHint || (reveal.run && !tut) || (rules && reveal.formula);
  return (
    <div className="flex animate-rise-slow items-center gap-1.5 max-xs:gap-1">
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
        <ToolButton variant="plain" iconOnly={crowded} label={tr.controls.reset} title={tr.controls.resetTitle} disabled={busy} onClick={resetScreen}>
          <RotateCcw size={16} strokeWidth={2.4} className="text-warn" />
        </ToolButton>
      )}
      <span className="flex-1" />
      {onHint && (
        <ToolButton variant="glass" iconOnly={!tut} label={tr.controls.hint} title={tr.controls.hintTitle} disabled={busy} onClick={onHint}>
          <Lightbulb size={16} strokeWidth={2.2} />
        </ToolButton>
      )}
      {reveal.formula && (
        <ToolButton variant="glass" iconOnly={crowded} label={tr.controls.syntax} title={tr.controls.syntaxTitle} onClick={() => useGame.setState({ showSyntax: true })}>
          <Braces size={16} strokeWidth={2.2} />
        </ToolButton>
      )}
      {rules && (
        <ToolButton variant="glass" iconOnly={crowded} label={tr.controls.rules} title={tr.controls.rules} onClick={() => useGame.setState({ showRules: true })}>
          <BookOpen size={16} strokeWidth={2.2} />
        </ToolButton>
      )}
    </div>
  );
}

function ToolButton({
  variant,
  iconOnly,
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  variant: 'plain' | 'glass';
  iconOnly: boolean;
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`${button(variant)} ${iconOnly ? 'compact:w-9.5 compact:self-stretch compact:px-0!' : ''}`} disabled={disabled} title={title} aria-label={label} onClick={onClick}>
      {children} <span className={iconOnly ? 'compact:hidden' : ''}>{label}</span>
    </button>
  );
}
