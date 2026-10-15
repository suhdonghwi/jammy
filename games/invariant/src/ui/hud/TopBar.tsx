import { ArrowLeft, BookOpen, CircleCheck, CircleDashed, CircleHelp, CircleX, LoaderCircle } from 'lucide-react';
import { playCounterexample } from '../../director/verdicts';
import { goMenu } from '../../game/actions';
import { useGame } from '../../game/store';
import { RULE_NAMES, RULES } from '../../levels/level';
import { button } from '../classes';

// The top bar: back, the level's name, the three rule lights (dim until the
// tutorial reaches them; a failed one replays its counterexample) and the
// rules card.

export function TopBar() {
  const level = useGame((s) => s.level);
  const mode = useGame((s) => s.mode);
  const lights = useGame((s) => s.reveal.lights);
  const awake = useGame((s) => s.reveal.awake);
  const verdicts = useGame((s) => s.verdicts);
  const checking = useGame((s) => s.checking);
  const busy = useGame((s) => s.busy);
  const spot = useGame((s) => s.spotlight);
  if (!level) return null;
  return (
    // .topbar and .pill-group: HoverReadout measures them to lift itself into this row when the middle is free
    <div className="topbar pointer-events-none! flex flex-wrap items-center justify-between gap-3">
      <div className={PILLS}>
        {/* just an arrow: the level's name is what this pill is about */}
        <button
          className={button('quiet', 'icon')}
          title={mode === 'tutorial' ? 'Home' : 'All levels'}
          aria-label={mode === 'tutorial' ? 'Home' : 'All levels'}
          onClick={() => goMenu(mode === 'tutorial' ? 'home' : 'levels')}
        >
          <ArrowLeft size={17} strokeWidth={2.4} />
        </button>
        <div className="flex items-center gap-2 pr-3 font-display text-lg font-semibold">
          {/* the mono digits sit high in their line box: a little more padding on top centres them on the title */}
          {mode === 'level' && <span className="rounded-full bg-shade/6 px-2 pt-0.75 pb-0.25 font-mono text-xs text-muted">{level.id}</span>}
          {level.title}
        </div>
      </div>
      <div className={`${PILLS} ${spot === 'lights' ? 'spotlight' : ''}`}>
        {RULES
          .filter((r) => lights.includes(r))
          .map((r) => {
            const v = verdicts[r];
            const status: LightStatus = !awake.includes(r) ? 'dim' : checking && !v ? 'checking' : (v?.status ?? 'idle');
            return (
              <button
                key={r}
                className={`flex animate-[pop_0.35s_ease-out] items-center gap-1.5 rounded-full px-3 py-1.75 font-display text-sm font-medium max-md:px-2 max-md:py-1.25 max-md:text-xs [&_svg]:shrink-0 ${LIGHT[status]}`}
                disabled={busy || v?.status !== 'fail'}
                title={v?.status === 'fail' ? 'Replay the counterexample' : RULE_NAMES[r]}
                onClick={() => v?.status === 'fail' && void playCounterexample(v.cex)}
              >
                <LightIcon status={status} />
                {RULE_NAMES[r]}
              </button>
            );
          })}
        <button className={button('quiet')} onClick={() => useGame.setState({ showRules: true })}>
          <BookOpen size={16} strokeWidth={2.2} /> Rules
        </button>
      </div>
    </div>
  );
}

type LightStatus = 'dim' | 'idle' | 'checking' | 'pass' | 'fail' | 'undecided';

/** A rounded bar of controls floating over the scene. */
const PILLS = 'pill-group pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-card p-1.25 shadow-card backdrop-blur-md';

const LIGHT: Record<LightStatus, string> = {
  // revealed, but its stage hasn't come yet
  dim: 'text-faint opacity-60',
  idle: 'text-muted',
  checking: 'text-muted',
  pass: 'bg-pass-soft text-pass',
  // a failed rule replays its counterexample
  fail: 'cursor-pointer bg-fail-soft text-fail',
  undecided: 'bg-warn-soft text-warn',
};

function LightIcon({ status }: { status: LightStatus }) {
  if (status === 'pass') return <CircleCheck size={16} strokeWidth={2.4} />;
  if (status === 'fail') return <CircleX size={16} strokeWidth={2.4} />;
  if (status === 'undecided') return <CircleHelp size={16} strokeWidth={2.4} />;
  if (status === 'checking') return <LoaderCircle size={16} strokeWidth={2.4} className="animate-spin" />;
  return <CircleDashed size={16} strokeWidth={2.2} />;
}
