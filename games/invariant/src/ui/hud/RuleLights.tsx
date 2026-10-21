import { CircleCheck, CircleDashed, CircleHelp, CircleX, LoaderCircle } from 'lucide-react';
import { playCounterexample } from '../../director/verdicts';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { RULES } from '../../checker/types';

export function RuleLights() {
  const lights = useGame((s) => s.reveal.lights);
  const awake = useGame((s) => s.reveal.awake);
  const verdicts = useGame((s) => s.verdicts);
  const pending = useGame((s) => s.pending);
  const busy = useGame((s) => s.busy);
  const spot = useGame((s) => s.tutorial.spotlight);
  const tr = useT();
  if (!lights.length) return null;
  return (
    <div className={`flex w-fit flex-wrap items-center gap-1 rounded-full max-[22.5rem]:gap-0.5 ${spot === 'lights' ? 'spotlight spotlight-soft' : ''}`}>
      {RULES
        .filter((r) => lights.includes(r))
        .map((r) => {
          const v = verdicts[r];
          const status: LightStatus = !awake.includes(r) ? 'dim' : v ? v.status : pending.includes(r) ? 'checking' : 'idle';
          return (
            <button
              key={r}
              className={`flex animate-[pop_0.35s_var(--ease-entrance)] items-center gap-1 rounded-full px-1.75 py-1 font-display text-xs font-medium max-[22.5rem]:gap-0.75 max-[22.5rem]:px-1.25 max-[22.5rem]:text-[11px] [&_svg]:shrink-0 ${LIGHT[status]}`}
              disabled={busy || v?.status !== 'fail'}
              title={v?.status === 'fail' ? tr.formula.replay : tr.rules[r]}
              onClick={() => v?.status === 'fail' && void playCounterexample(v.cex)}
            >
              <LightIcon status={status} />
              {tr.rules[r]}
            </button>
          );
        })}
    </div>
  );
}

type LightStatus = 'dim' | 'idle' | 'checking' | 'pass' | 'fail' | 'undecided';

const LIGHT: Record<LightStatus, string> = {
  dim: 'text-faint opacity-60',
  idle: 'text-muted',
  checking: 'text-muted',
  pass: 'bg-pass-soft text-pass',
  fail: 'cursor-pointer bg-fail-soft text-fail',
  undecided: 'bg-warn-soft text-warn',
};

function LightIcon({ status }: { status: LightStatus }) {
  if (status === 'pass') return <CircleCheck size={14} strokeWidth={2.4} />;
  if (status === 'fail') return <CircleX size={14} strokeWidth={2.4} />;
  if (status === 'undecided') return <CircleHelp size={14} strokeWidth={2.4} />;
  if (status === 'checking') return <LoaderCircle size={14} strokeWidth={2.4} className="animate-spin" />;
  return <CircleDashed size={14} strokeWidth={2.2} />;
}
